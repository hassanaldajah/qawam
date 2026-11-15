import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Miniflare } from "miniflare";
import type { Env } from "../../functions/_lib/types";
import { call, newAccount, setup } from "../api/harness";
import { parseBackupCode } from "../../functions/_lib/backup";
import { sha256Hex } from "../../functions/_lib/crypto";

let mf: Miniflare;
let env: Env;
let n = 100;
const ip = () => `192.0.2.${n++}`;
beforeAll(async () => {
  ({ mf, env } = await setup());
});
afterAll(async () => {
  await mf.dispose();
});

const uid = async (c: string) =>
  (await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash = ?1").bind(await sha256Hex(c.split("=")[1]!)).first<{ user_id: string }>())!.user_id;

async function issueCode(cookie: string): Promise<string> {
  const gen = (await (await call(env, "/api/auth/backup-code", { method: "POST", cookie })).json()) as Record<string, unknown>;
  return gen.code as string;
}
const pubOf = (shown: string) => parseBackupCode(shown)!.publicId;

describe("QA: IDOR / delete / export", () => {
  it("export, delete and backup-code require a session (401)", async () => {
    expect((await call(env, "/api/auth/export")).status).toBe(401);
    expect((await call(env, "/api/auth/account", { method: "DELETE", body: { confirm: "DELETE" } })).status).toBe(401);
    expect((await call(env, "/api/auth/backup-code", { method: "POST" })).status).toBe(401);
  });
  it("forged user_id in query/header never changes the exported owner", async () => {
    const a = await newAccount(env, ip());
    const b = await newAccount(env, ip());
    const ub = await uid(b);
    await env.DB.prepare("INSERT INTO weight_log (user_id, day, weight_kg, created_at) VALUES (?1,'2026-11-15',77,1)").bind(ub).run();
    const res = await call(env, "/api/auth/export", { cookie: a, headers: { "X-User-Id": ub } });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { weight_log: unknown[] };
    expect(data.weight_log).toHaveLength(0);
  });
  it("deleting account A leaves account B data and session intact", async () => {
    const a = await newAccount(env, ip());
    const b = await newAccount(env, ip());
    const ua = await uid(a);
    const ub = await uid(b);
    for (const u of [ua, ub])
      await env.DB.prepare("INSERT INTO weight_log (user_id, day, weight_kg, created_at) VALUES (?1,'2026-11-15',80,1)").bind(u).run();
    expect((await call(env, "/api/auth/account", { method: "DELETE", cookie: a, body: { confirm: "DELETE" } })).status).toBe(200);
    const left = await env.DB.prepare("SELECT COUNT(*) n FROM weight_log WHERE user_id=?1").bind(ub).first<{ n: number }>();
    expect(left!.n).toBe(1);
    expect((await call(env, "/api/auth/export", { cookie: b })).status).toBe(200);
  });
  it("delete rejects wrong confirm, extra fields, foreign origin, missing CSRF header", async () => {
    const a = await newAccount(env, ip());
    expect((await call(env, "/api/auth/account", { method: "DELETE", cookie: a, body: { confirm: "delete" } })).status).toBe(400);
    expect((await call(env, "/api/auth/account", { method: "DELETE", cookie: a, body: { confirm: "DELETE", user_id: "x" } })).status).toBe(400);
    expect((await call(env, "/api/auth/account", { method: "DELETE", cookie: a, body: { confirm: "DELETE" }, csrf: false })).status).toBeGreaterThanOrEqual(400);
    expect((await call(env, "/api/auth/account", { method: "DELETE", cookie: a, body: { confirm: "DELETE" }, origin: "https://evil.example" })).status).toBe(403);
    expect((await call(env, "/api/auth/export", { cookie: a })).status).toBe(200);
  });
  it("export is no-store and exposes no hashes", async () => {
    const a = await newAccount(env, ip());
    await issueCode(a);
    const res = await call(env, "/api/auth/export", { cookie: a });
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
    expect(await res.text()).not.toMatch(/secret_hash|token_hash|key_hash|locked_until/);
  });
});

describe("QA: restore lockout", () => {
  const code = (pub: string) => `${pub}${"A".repeat(26)}`;
  it("garbage / oversized / non-string codes give 4xx, never 5xx", async () => {
    const i = ip();
    for (const body of [{ code: "" }, { code: "x".repeat(500) }, { code: 5 }, {}, { code: "QW--" }]) {
      const s = (await call(env, "/api/auth/restore", { method: "POST", body, ip: i })).status;
      expect(s, JSON.stringify(body)).toBeGreaterThanOrEqual(400);
      expect(s).toBeLessThan(500);
    }
  });
  it("unknown public id and wrong secret give the same status and body (no enumeration)", async () => {
    const a = await newAccount(env, ip());
    const pub = pubOf(await issueCode(a));
    const r1 = await call(env, "/api/auth/restore", { method: "POST", body: { code: code(pub) }, ip: ip() });
    const r2 = await call(env, "/api/auth/restore", { method: "POST", body: { code: code("ZZZZZZZZZZ") }, ip: ip() });
    expect(r1.status).toBe(r2.status);
    expect(await r1.text()).toBe(await r2.text());
  });
  it("failed guesses cause bounded delay (<=1h), not a hard lock", async () => {
    const a = await newAccount(env, ip());
    const shown = await issueCode(a);
    const pub = pubOf(shown);
    for (let k = 0; k < 3; k++) await call(env, "/api/auth/restore", { method: "POST", body: { code: code(pub) }, ip: ip() });
    const row = await env.DB.prepare("SELECT locked_until FROM backup_codes WHERE public_id=?1").bind(pub).first<{ locked_until: number }>();
    expect(row!.locked_until - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(3600);
    await env.DB.prepare("UPDATE backup_codes SET locked_until = 0 WHERE public_id=?1").bind(pub).run();
    expect((await call(env, "/api/auth/restore", { method: "POST", body: { code: shown }, ip: ip() })).status).toBe(200);
  });
  it("restore revokes shortcut keys and the old session", async () => {
    const a = await newAccount(env, ip());
    const shown = await issueCode(a);
    const u = await uid(a);
    await env.DB.prepare("INSERT INTO shortcut_keys (user_id,key_hash,label,scopes,created_at) VALUES (?1,?2,'k','water',1)").bind(u, "a".repeat(64)).run();
    expect((await call(env, "/api/auth/restore", { method: "POST", body: { code: shown }, ip: ip() })).status).toBe(200);
    const k = await env.DB.prepare("SELECT revoked_at FROM shortcut_keys WHERE user_id=?1").bind(u).first<{ revoked_at: number | null }>();
    expect(k!.revoked_at).not.toBeNull();
    expect((await call(env, "/api/auth/export", { cookie: a })).status).toBe(401);
  });
});
