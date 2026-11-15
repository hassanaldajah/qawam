import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Miniflare } from "miniflare";
import type { Env } from "../../functions/_lib/types";
import { call, cookieOf, newAccount, setup } from "./harness";
import { generateBackupCode, parseBackupCode } from "../../functions/_lib/backup";
import { sha256Hex } from "../../functions/_lib/crypto";

let mf: Miniflare;
let env: Env;
let ipN = 10;
const freshIp = () => `192.0.2.${ipN++}`;

beforeAll(async () => {
  ({ mf, env } = await setup());
});
afterAll(async () => {
  await mf.dispose();
});

describe("middleware", () => {
  it("adds security headers and no-store", async () => {
    const res = await call(env, "/api/auth/session");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects non-GET with missing or foreign Origin, or without X-Qawam", async () => {
    expect((await call(env, "/api/auth/account", { method: "POST", origin: null })).status).toBe(403);
    expect((await call(env, "/api/auth/account", { method: "POST", origin: "https://evil.example" })).status).toBe(403);
    expect((await call(env, "/api/auth/account", { method: "POST", csrf: false })).status).toBe(403);
    expect((await call(env, "/api/auth/account", { method: "OPTIONS" })).status).toBe(403);
  });

  it("returns JSON 404 for unknown routes and headers still applied", async () => {
    const res = await call(env, "/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("rejects oversized bodies", async () => {
    const cookie = await newAccount(env, freshIp());
    const big = JSON.stringify({ confirm: "DELETE", pad: "x".repeat(20000) });
    const res = await call(env, "/api/auth/account", { method: "DELETE", cookie, body: big });
    expect(res.status).toBe(413);
  });
});

describe("account + session", () => {
  it("creates an anonymous account with a __Host- HttpOnly Secure Lax cookie, stores only the hash", async () => {
    const res = await call(env, "/api/auth/account", { method: "POST", ip: freshIp() });
    expect(res.status).toBe(201);
    const sc = res.headers.get("Set-Cookie")!;
    expect(sc).toMatch(/^__Host-qs=[0-9a-f]{64}; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000$/);
    const token = sc.split(";")[0]!.split("=")[1]!;
    const raw = await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?1").bind(token).first<{ n: number }>();
    expect(raw!.n).toBe(0);
    const hashed = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?1")
      .bind(await sha256Hex(token))
      .first<{ n: number }>();
    expect(hashed!.n).toBe(1);

    const s = await call(env, "/api/auth/session", { cookie: cookieOf(res) });
    expect(await s.json()).toEqual({ authenticated: true, hasBackupCode: false });
  });

  it("treats unknown / malformed tokens as unauthenticated", async () => {
    const s1 = await call(env, "/api/auth/session", { cookie: "__Host-qs=" + "a".repeat(64) });
    expect(await s1.json()).toEqual({ authenticated: false });
    const s2 = await call(env, "/api/auth/session", { cookie: "__Host-qs=' OR 1=1 --" });
    expect(await s2.json()).toEqual({ authenticated: false });
    expect((await call(env, "/api/auth/export", { cookie: "__Host-qs=zz" })).status).toBe(401);
  });

  it("limits account creation per IP (5/h)", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) expect((await call(env, "/api/auth/account", { method: "POST", ip })).status).toBe(201);
    expect((await call(env, "/api/auth/account", { method: "POST", ip })).status).toBe(429);
  });

  it("logout deletes the session", async () => {
    const cookie = await newAccount(env, freshIp());
    const out = await call(env, "/api/auth/session", { method: "DELETE", cookie });
    expect(out.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(await (await call(env, "/api/auth/session", { cookie })).json()).toEqual({ authenticated: false });
  });

  it("expired sessions are rejected", async () => {
    const cookie = await newAccount(env, freshIp());
    const hash = await sha256Hex(cookie.split("=")[1]!);
    await env.DB.prepare("UPDATE sessions SET expires_at = 1 WHERE token_hash = ?1").bind(hash).run();
    expect(await (await call(env, "/api/auth/session", { cookie })).json()).toEqual({ authenticated: false });
  });

  it("sliding refresh at most once per day", async () => {
    const cookie = await newAccount(env, freshIp());
    const r1 = await call(env, "/api/auth/session", { cookie });
    expect(r1.headers.get("Set-Cookie")).toBeNull();
    const hash = await sha256Hex(cookie.split("=")[1]!);
    await env.DB.prepare("UPDATE sessions SET last_seen = last_seen - 90000 WHERE token_hash = ?1").bind(hash).run();
    const r2 = await call(env, "/api/auth/session", { cookie });
    expect(r2.headers.get("Set-Cookie")).toContain("__Host-qs=");
  });
});

describe("backup code", () => {
  it("format: >=128-bit secret, parse is tolerant to case/dashes/look-alikes", () => {
    const c = generateBackupCode();
    expect(c.secret.length * 5).toBeGreaterThanOrEqual(128);
    expect(parseBackupCode(c.display.toLowerCase())).toEqual({ publicId: c.publicId, secret: c.secret });
    expect(parseBackupCode("short")).toBeNull();
    expect(parseBackupCode("U".repeat(36))).toBeNull();
  });

  it("requires a session; shown once; only hash stored", async () => {
    expect((await call(env, "/api/auth/backup-code", { method: "POST" })).status).toBe(401);
    const cookie = await newAccount(env, freshIp());
    const res = await call(env, "/api/auth/backup-code", { method: "POST", cookie });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    const p = parseBackupCode(code)!;
    const row = await env.DB
      .prepare("SELECT secret_hash FROM backup_codes WHERE public_id = ?1")
      .bind(p.publicId)
      .first<{ secret_hash: string }>();
    expect(row!.secret_hash).toBe(await sha256Hex(p.secret));
    expect(JSON.stringify(row)).not.toContain(p.secret);
    expect(await (await call(env, "/api/auth/session", { cookie })).json()).toEqual({ authenticated: true, hasBackupCode: true });
  });

  it("restore issues a new session, revokes old ones, and old regen'd code stops working", async () => {
    const oldCookie = await newAccount(env, freshIp());
    const { code } = (await (await call(env, "/api/auth/backup-code", { method: "POST", cookie: oldCookie })).json()) as { code: string };
    const otherDevice = await newAccount(env, freshIp());

    const res = await call(env, "/api/auth/restore", { method: "POST", cookie: otherDevice, body: { code }, ip: freshIp() });
    expect(res.status).toBe(200);
    const newCookie = cookieOf(res)!;
    expect(newCookie).not.toBe(oldCookie);
    expect(await (await call(env, "/api/auth/session", { cookie: newCookie })).json()).toMatchObject({ authenticated: true });
    expect(await (await call(env, "/api/auth/session", { cookie: oldCookie })).json()).toEqual({ authenticated: false });
    expect(await (await call(env, "/api/auth/session", { cookie: otherDevice })).json()).toEqual({ authenticated: false });

    // Regenerate -> previous code invalid.
    await call(env, "/api/auth/backup-code", { method: "POST", cookie: newCookie, body: { currentCode: code } });
    const again = await call(env, "/api/auth/restore", { method: "POST", body: { code }, ip: freshIp() });
    expect(again.status).toBe(401);
  });

  it("no per-account lock: failures from an attacker never block the correct code", async () => {
    const cookie = await newAccount(env, freshIp());
    const { code } = (await (await call(env, "/api/auth/backup-code", { method: "POST", cookie })).json()) as { code: string };
    const p = parseBackupCode(code)!;
    const wrong = p.publicId + (p.secret[0] === "0" ? "1" : "0") + p.secret.slice(1);
    // Attacker exhausts several IP buckets on this public id.
    for (let k = 0; k < 3; k++) {
      const ip = freshIp();
      for (let i = 0; i < 10; i++) {
        expect((await call(env, "/api/auth/restore", { method: "POST", body: { code: wrong }, ip })).status).toBe(401);
      }
    }
    const ok = await call(env, "/api/auth/restore", { method: "POST", body: { code }, ip: freshIp() });
    expect(ok.status).toBe(200);
  });

  it("per-IP failure cap (10/h)", async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i++) {
      const r = await call(env, "/api/auth/restore", { method: "POST", body: { code: "0".repeat(36) }, ip });
      expect(r.status).toBe(401);
    }
    expect((await call(env, "/api/auth/restore", { method: "POST", body: { code: "0".repeat(36) }, ip })).status).toBe(429);
  });

  it("rejects extra fields and bad content-type (strict Zod)", async () => {
    const ip = freshIp();
    expect((await call(env, "/api/auth/restore", { method: "POST", body: { code: "x", userId: "y" }, ip })).status).toBe(400);
    expect((await call(env, "/api/auth/restore", { method: "POST", body: "{bad", ip })).status).toBe(400);
    expect(
      (await call(env, "/api/auth/restore", { method: "POST", body: "code=x", ip, headers: { "Content-Type": "text/plain" } })).status,
    ).toBe(415);
  });
});

describe("export + delete", () => {
  it("export returns only own data and no secrets (IDOR)", async () => {
    const a = await newAccount(env, freshIp());
    const b = await newAccount(env, freshIp());
    await call(env, "/api/auth/backup-code", { method: "POST", cookie: a });
    const uid = async (c: string) =>
      (await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash = ?1").bind(await sha256Hex(c.split("=")[1]!)).first<{ user_id: string }>())!.user_id;
    const ua = await uid(a);
    const ub = await uid(b);
    await env.DB.prepare("INSERT INTO weight_log (user_id, day, weight_kg, created_at) VALUES (?1, '2026-11-15', 80, 1)").bind(ua).run();
    await env.DB.prepare("INSERT INTO weight_log (user_id, day, weight_kg, created_at) VALUES (?1, '2026-11-15', 99, 1)").bind(ub).run();

    const res = await call(env, "/api/auth/export", { cookie: a });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    const text = await res.text();
    const data = JSON.parse(text);
    expect(data.weight_log).toHaveLength(1);
    expect(data.weight_log[0].weight_kg).toBe(80);
    expect(text).not.toMatch(/secret_hash|token_hash|key_hash|public_id/);
    expect(text).not.toContain(ua);
  });

  it("delete-account requires confirm and hard-deletes everything", async () => {
    const c = await newAccount(env, freshIp());
    await call(env, "/api/auth/backup-code", { method: "POST", cookie: c });
    const u = (await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash = ?1").bind(await sha256Hex(c.split("=")[1]!)).first<{ user_id: string }>())!.user_id;
    await env.DB.prepare("INSERT INTO meals (user_id, day, meal_type, created_at) VALUES (?1, '2026-11-15', 'lunch', 1)").bind(u).run();
    const meal = (await env.DB.prepare("SELECT id FROM meals WHERE user_id = ?1").bind(u).first<{ id: number }>())!.id;
    await env.DB.prepare("INSERT INTO meal_items (meal_id, user_id, name, grams, kcal, created_at) VALUES (?1, ?2, 'rice', 100, 130, 1)").bind(meal, u).run();

    expect((await call(env, "/api/auth/account", { method: "DELETE", cookie: c, body: { confirm: "no" } })).status).toBe(400);
    const res = await call(env, "/api/auth/account", { method: "DELETE", cookie: c, body: { confirm: "DELETE" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    for (const t of ["sessions", "backup_codes", "meals", "meal_items"]) {
      const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM " + t + " WHERE user_id = ?1").bind(u).first<{ n: number }>();
      expect(n!.n, t).toBe(0);
    }
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE id = ?1").bind(u).first<{ n: number }>())!.n).toBe(0);
    expect((await call(env, "/api/auth/export", { cookie: c })).status).toBe(401);
  });
});
