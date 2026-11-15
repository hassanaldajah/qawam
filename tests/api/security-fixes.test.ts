// Regression tests for docs/security-review-1.md findings (H1, M1-M5, L1-L8).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Miniflare } from "miniflare";
import type { Ctx, Env } from "../../functions/_lib/types";
import { ORIGIN, call, cookieOf, newAccount, setup, siteverifyCalls } from "./harness";
import { sha256Hex } from "../../functions/_lib/crypto";
import { HttpError, ipBucket, readBodyBounded } from "../../functions/_lib/http";
import { ipKey, purgeExpired } from "../../functions/_lib/ratelimit";
import { onRequest as middleware } from "../../functions/_middleware";
import { EXPORT_PAGE } from "../../functions/api/auth/export";

let mf: Miniflare;
let env: Env;
let n = 10;
const freshIp = () => `198.18.${Math.floor(n / 250)}.${n++ % 250}`;
const uidOf = async (c: string) =>
  (await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash = ?1").bind(await sha256Hex(c.split("=")[1]!)).first<{ user_id: string }>())!.user_id;

beforeAll(async () => {
  ({ mf, env } = await setup());
});
afterAll(async () => {
  await mf.dispose();
});

describe("M1 Turnstile", () => {
  it("create requires a valid token for our hostname and action", async () => {
    const post = (turnstile: string | null, body?: unknown) =>
      call(env, "/api/auth/account", { method: "POST", ip: freshIp(), turnstile, body });
    expect((await post(null, {})).status).toBe(400);
    expect((await post("nope")).status).toBe(403);
    expect((await post("host:create")).status).toBe(403);
    expect((await post("ok:restore")).status).toBe(403);
    expect((await post("down")).status).toBe(503);
    const before = siteverifyCalls.length;
    expect((await post("ok:create")).status).toBe(201);
    const last = siteverifyCalls[before]!;
    expect(last.secret).toBe("test-turnstile-secret");
  });

  it("fails closed (503) when the secret is not configured", async () => {
    const res = await call({ ...env, TURNSTILE_SECRET: undefined }, "/api/auth/account", { method: "POST", ip: freshIp() });
    expect(res.status).toBe(503);
  });

  it("restore requires Turnstile on every attempt", async () => {
    const res = await call(env, "/api/auth/restore", { method: "POST", body: { code: "0".repeat(36) }, ip: freshIp(), turnstile: "nope" });
    expect(res.status).toBe(403);
  });

  it("global creation cap applies", async () => {
    const ws = Math.floor(Date.now() / 1000);
    const start = ws - (ws % 3600);
    await env.DB.prepare("INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES ('create_global', ?1, 200)").bind(start).run();
    expect((await call(env, "/api/auth/account", { method: "POST", ip: freshIp() })).status).toBe(429);
    await env.DB.prepare("DELETE FROM rate_limits WHERE key = 'create_global'").run();
  });
});

describe("IPv6 /64 bucketing", () => {
  it("expands :: and keys on the first 4 hextets", () => {
    expect(ipBucket("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(ipBucket("2001:0db8:0000:0000:ffff:1:2:3")).toBe("2001:db8:0:0::/64");
    expect(ipBucket("2001:db8:1:2::")).toBe("2001:db8:1:2::/64");
    expect(ipBucket("::1")).toBe("0:0:0:0::/64");
    expect(ipBucket("::ffff:192.0.2.1")).toBe("192.0.2.1");
    expect(ipBucket("203.0.113.9")).toBe("203.0.113.9");
    expect(ipBucket("2001:db8:aa:1::5")).not.toBe(ipBucket("2001:db8:aa:2::5"));
  });

  it("rotating /128 inside one /64 shares the create limit", async () => {
    for (let i = 1; i <= 5; i++) {
      expect((await call(env, "/api/auth/account", { method: "POST", ip: `2001:db8:77:1::${i}` })).status).toBe(201);
    }
    expect((await call(env, "/api/auth/account", { method: "POST", ip: "2001:db8:77:1:ffff::9" })).status).toBe(429);
    expect((await call(env, "/api/auth/account", { method: "POST", ip: "2001:db8:77:2::1" })).status).toBe(201);
  });
});

describe("M2/L2/L3 restore", () => {
  it("parallel attempts cannot exceed the per-IP cap (consume first)", async () => {
    const ip = freshIp();
    const rs = await Promise.all(
      Array.from({ length: 15 }, () => call(env, "/api/auth/restore", { method: "POST", body: { code: "0".repeat(36) }, ip })),
    );
    expect(rs.filter((r) => r.status === 401)).toHaveLength(10);
    expect(rs.filter((r) => r.status === 429)).toHaveLength(5);
  });

  it("schema has no account-keyed lock columns", async () => {
    const cols = await env.DB.prepare("SELECT name FROM pragma_table_info('backup_codes')").all<{ name: string }>();
    const names = cols.results.map((c) => c.name);
    expect(names).not.toContain("locked_until");
    expect(names).not.toContain("failed_attempts");
  });
});

describe("M3 user-scoped FKs", () => {
  it("meal_items cannot reference another user's meal or custom food; cascades still work", async () => {
    const ua = await uidOf(await newAccount(env, freshIp()));
    const ub = await uidOf(await newAccount(env, freshIp()));
    const meal = await env.DB.prepare("INSERT INTO meals (user_id, day, meal_type, created_at) VALUES (?1, '2026-11-15', 'lunch', 1) RETURNING id").bind(ua).first<{ id: number }>();
    const food = await env.DB.prepare("INSERT INTO custom_foods (user_id, name, kcal_100g, created_at) VALUES (?1, 'x', 100, 1) RETURNING id").bind(ua).first<{ id: number }>();
    const item = (user: string, mealId: number, foodId: number | null) =>
      env.DB.prepare("INSERT INTO meal_items (meal_id, user_id, custom_food_id, name, grams, kcal, created_at) VALUES (?1, ?2, ?3, 'i', 100, 100, 1)")
        .bind(mealId, user, foodId).run();
    await expect(item(ub, meal!.id, null)).rejects.toThrow(/FOREIGN KEY/i);
    const mealB = await env.DB.prepare("INSERT INTO meals (user_id, day, meal_type, created_at) VALUES (?1, '2026-11-15', 'lunch', 1) RETURNING id").bind(ub).first<{ id: number }>();
    await expect(item(ub, mealB!.id, food!.id)).rejects.toThrow(/FOREIGN KEY/i);
    await item(ua, meal!.id, food!.id);
    // Deleting the user cascades through meals, custom_foods and meal_items.
    await env.DB.prepare("DELETE FROM users WHERE id = ?1").bind(ua).run();
    expect(await env.DB.prepare("SELECT COUNT(*) AS c FROM meal_items WHERE user_id = ?1").bind(ua).first<{ c: number }>().then((r) => r!.c)).toBe(0);
  });
});

describe("M4 body cap", () => {
  const post = (headers: Record<string, string>, body: BodyInit | null) =>
    new Request(ORIGIN + "/api/auth/restore", {
      method: "POST",
      headers: { Origin: ORIGIN, "X-Qawam": "1", "CF-Connecting-IP": freshIp(), "Content-Type": "application/json", ...headers },
      body,
      // @ts-expect-error Node needs duplex for stream bodies
      duplex: "half",
    });
  const run = (request: Request) =>
    middleware({ request, env, params: {}, data: {}, waitUntil: () => {}, next: async () => new Response("unreached") } as Ctx);

  it("body without Content-Length -> 411; non-numeric -> 411; too large -> 413", async () => {
    const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("{}")); c.close(); } });
    expect((await run(post({}, stream))).status).toBe(411);
    expect((await run(post({ "Content-Length": "abc" }, "{}"))).status).toBe(411);
    expect((await run(post({ "Content-Length": "999999" }, "{}"))).status).toBe(413);
  });

  it("counts bytes, not the header, and stops past the cap", async () => {
    const chunk = new Uint8Array(4096);
    let pulled = 0;
    const stream = new ReadableStream({ pull(c) { pulled++; c.enqueue(chunk); } }); // endless
    const req = new Request(ORIGIN, { method: "POST", headers: { "Content-Length": "10" }, body: stream, duplex: "half" } as RequestInit);
    await expect(readBodyBounded(req, 16 * 1024)).rejects.toMatchObject({ status: 413 });
    expect(pulled).toBeLessThan(10);
    const ar = "ع".repeat(9000); // 2 bytes each in UTF-8, 9000 UTF-16 units
    const big = new Request(ORIGIN, { method: "POST", body: JSON.stringify({ a: ar }) });
    await expect(readBodyBounded(big, 16 * 1024)).rejects.toBeInstanceOf(HttpError);
  });

  it("invalid UTF-8 -> 400 invalid_json", async () => {
    const bytes = new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d]);
    const req = new Request(ORIGIN, { method: "POST", headers: { "Content-Type": "application/json" }, body: bytes });
    const { readJson } = await import("../../functions/_lib/http");
    const { z } = await import("zod");
    await expect(readJson(req, z.unknown())).rejects.toMatchObject({ status: 400, code: "invalid_json" });
  });
});

describe("M5 export", () => {
  it("is rate limited (5/h) and paged per table by cursor", async () => {
    const cookie = await newAccount(env, freshIp());
    const u = await uidOf(cookie);
    await env.DB
      .prepare(
        "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?2) " +
          "INSERT INTO water (user_id, day, ml, created_at) SELECT ?1, '2026-11-15', 250, i FROM n",
      )
      .bind(u, EXPORT_PAGE + 5)
      .run();
    const ft = await (await call(env, "/api/auth/export", { cookie })).text();
    const first = JSON.parse(ft) as { water: unknown[]; next: Record<string, number> };
    expect(first.water).toHaveLength(EXPORT_PAGE);
    expect(JSON.stringify(first.water[0])).not.toContain("_cursor");
    const cursor = first.next.water!;
    const p2 = (await (await call(env, `/api/auth/export?table=water&after=${cursor}`, { cookie })).json()) as { rows: unknown[]; next: number | null };
    expect(p2.rows).toHaveLength(5);
    expect(p2.next).toBeNull();
    expect((await call(env, "/api/auth/export?table=sessions_hash&after=0", { cookie })).status).toBe(400);
    expect((await call(env, "/api/auth/export?table=water&after=-1", { cookie })).status).toBe(400);
    for (let i = 0; i < 4; i++) expect((await call(env, "/api/auth/export", { cookie })).status).toBe(200);
    expect((await call(env, "/api/auth/export", { cookie })).status).toBe(429);
  });
});

describe("L1 backup-code rotation", () => {
  it("rotation needs the current code; lost-code reset keeps sessions and raises a banner", async () => {
    const a = await newAccount(env, freshIp());
    const first = ((await (await call(env, "/api/auth/backup-code", { method: "POST", cookie: a })).json()) as { code: string }).code;
    // Second device for the same account.
    const r = await call(env, "/api/auth/restore", { method: "POST", body: { code: first, revokeOthers: false }, ip: freshIp() });
    const b = cookieOf(r)!;
    expect((await call(env, "/api/auth/backup-code", { method: "POST", cookie: a })).status).toBe(400);
    expect((await call(env, "/api/auth/backup-code", { method: "POST", cookie: a, body: { currentCode: "0".repeat(36) } })).status).toBe(401);
    const rot = await call(env, "/api/auth/backup-code", { method: "POST", cookie: a, body: { currentCode: first } });
    expect(rot.status).toBe(201);
    const lost = await call(env, "/api/auth/backup-code", { method: "POST", cookie: b, body: { lostCode: true } });
    expect(lost.status).toBe(201);
    const sa = (await (await call(env, "/api/auth/session", { cookie: a })).json()) as Record<string, unknown>;
    expect(sa.authenticated).toBe(true); // other session kept
    expect(typeof sa.backupCodeResetAt).toBe("number");
    // 3/day cap
    expect((await call(env, "/api/auth/backup-code", { method: "POST", cookie: a, body: { lostCode: true } })).status).toBe(429);
  });
});

describe("L4-L8", () => {
  it("L4: IP keys are HMAC with RL_KEY (required), never the raw IP", async () => {
    await expect(ipKey({}, "x", "203.0.113.5")).rejects.toThrow(/RL_KEY/);
    const k1 = await ipKey({ RL_KEY: "a" }, "x", "203.0.113.5");
    const k2 = await ipKey({ RL_KEY: "b" }, "x", "203.0.113.5");
    expect(k1).not.toBe(k2);
    expect(k1).not.toContain("203.0.113.5");
    expect(k1).not.toContain((await sha256Hex("ip:203.0.113.5")).slice(0, 32));
  });

  it("L4/L6: purge removes old buckets and audit rows, bounded per run", async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB
      .prepare(
        "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 600) " +
          "INSERT INTO rate_limits (key, window_start, count) SELECT 'old:' || i, 1000, 1 FROM n",
      )
      .run();
    await env.DB.prepare("INSERT INTO audit_log (user_id, event, ts) VALUES ('u', 'restore', 1000)").run();
    await env.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES ('fresh', ?1, 1)").bind(now).run();
    await purgeExpired(env.DB, now);
    expect(await env.DB.prepare("SELECT COUNT(*) AS c FROM rate_limits WHERE key LIKE 'old:%'").first<{ c: number }>().then((r) => r!.c)).toBe(100);
    await purgeExpired(env.DB, now);
    expect(await env.DB.prepare("SELECT COUNT(*) AS c FROM rate_limits WHERE key LIKE 'old:%'").first<{ c: number }>().then((r) => r!.c)).toBe(0);
    expect(await env.DB.prepare("SELECT COUNT(*) AS c FROM rate_limits WHERE key = 'fresh'").first<{ c: number }>().then((r) => r!.c)).toBe(1);
    expect(await env.DB.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE ts = 1000").first<{ c: number }>().then((r) => r!.c)).toBe(0);
  });

  it("L4: account delete removes user-keyed buckets", async () => {
    const c = await newAccount(env, freshIp());
    const u = await uidOf(c);
    await call(env, "/api/auth/export", { cookie: c });
    await call(env, "/api/auth/account", { method: "DELETE", cookie: c, body: { confirm: "DELETE" } });
    expect(await env.DB.prepare("SELECT COUNT(*) AS c FROM rate_limits WHERE key LIKE ?1").bind("%" + u).first<{ c: number }>().then((r) => r!.c)).toBe(0);
  });

  it("L5: missing CF-Connecting-IP -> 400", async () => {
    const request = new Request(ORIGIN + "/api/auth/account", {
      method: "POST",
      headers: { Origin: ORIGIN, "X-Qawam": "1", "Content-Type": "application/json", "Content-Length": "2" },
      body: "{}",
    });
    const { onRequestPost } = await import("../../functions/api/auth/account");
    const ctx = { request, env, params: {}, data: {}, waitUntil: () => {}, next: () => onRequestPost(ctx) } as Ctx;
    expect((await middleware(ctx)).status).toBe(400);
  });

  it("L6: unhandled errors return the cf-ray correlation id, no message", async () => {
    const request = new Request(ORIGIN + "/api/x", { headers: { "cf-ray": "abc123-MCT" } });
    const ctx = { request, env, params: {}, data: {}, waitUntil: () => {}, next: async () => { throw new Error("secret detail"); } } as Ctx;
    const res = await middleware(ctx);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "internal_error", ray: "abc123-MCT" });
    expect(text).not.toContain("secret detail");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("L7: sessions older than 2 years are rejected even if recently used", async () => {
    const c = await newAccount(env, freshIp());
    const h = await sha256Hex(c.split("=")[1]!);
    await env.DB.prepare("UPDATE sessions SET created_at = created_at - 63072001 WHERE token_hash = ?1").bind(h).run();
    expect(await (await call(env, "/api/auth/session", { cookie: c })).json()).toEqual({ authenticated: false });
  });

  it("L8: non-safe requests with cross-site Sec-Fetch-Site are rejected", async () => {
    const r1 = await call(env, "/api/auth/account", { method: "POST", ip: freshIp(), headers: { "Sec-Fetch-Site": "cross-site" } });
    expect(r1.status).toBe(403);
    const r2 = await call(env, "/api/auth/account", { method: "POST", ip: freshIp(), headers: { "Sec-Fetch-Site": "same-site" } });
    expect(r2.status).toBe(403);
    const r3 = await call(env, "/api/auth/account", { method: "POST", ip: freshIp(), headers: { "Sec-Fetch-Site": "same-origin" } });
    expect(r3.status).toBe(201);
  });
});

describe("Re-review round 2 (N1-N5, I3)", () => {
  it("N2: hung siteverify is aborted after the timeout and fails closed (503)", async () => {
    const t0 = Date.now();
    const res = await call(env, "/api/auth/account", { method: "POST", ip: freshIp(), turnstile: "hang" });
    expect(res.status).toBe(503);
    expect(Date.now() - t0).toBeLessThan(6000);
  }, 10000);

  it("N2: siteverify calls are metered per IP before fetching", async () => {
    const ip = freshIp();
    for (let i = 0; i < 30; i++) {
      expect((await call(env, "/api/auth/restore", { method: "POST", body: { code: "0".repeat(36) }, ip, turnstile: "bad" })).status).toBe(403);
    }
    const before = siteverifyCalls.length;
    expect((await call(env, "/api/auth/restore", { method: "POST", body: { code: "0".repeat(36) }, ip, turnstile: "bad" })).status).toBe(429);
    expect(siteverifyCalls.length).toBe(before);
  });

  it("N4: failed Turnstile does not use up the restore bucket of a shared IP", async () => {
    const ip = freshIp();
    for (let i = 0; i < 12; i++) {
      await call(env, "/api/auth/restore", { method: "POST", body: { code: "0".repeat(36) }, ip, turnstile: "bad" });
    }
    expect((await call(env, "/api/auth/restore", { method: "POST", body: { code: "0".repeat(36) }, ip })).status).toBe(401);
  });

  it("N1: one IP cannot take more than its daily share of the global create cap", async () => {
    const prefix = "2001:db8:99:";
    let created = 0;
    // 3 hours' worth: hourly cap 5, daily cap 10. Simulate by clearing the hourly bucket.
    for (let h = 0; h < 3; h++) {
      for (let i = 0; i < 5; i++) {
        const r = await call(env, "/api/auth/account", { method: "POST", ip: `${prefix}1::${h}${i}` });
        if (r.status === 201) created++;
      }
      await env.DB.prepare("DELETE FROM rate_limits WHERE key LIKE 'create:%'").run();
    }
    expect(created).toBe(10);
  });

  it("N3: two parallel rotations with the same current code: exactly one wins", async () => {
    const a = await newAccount(env, freshIp());
    const code = ((await (await call(env, "/api/auth/backup-code", { method: "POST", cookie: a })).json()) as { code: string }).code;
    const rs = await Promise.all(
      [0, 1].map(() => call(env, "/api/auth/backup-code", { method: "POST", cookie: a, body: { currentCode: code } })),
    );
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    const u = await uidOf(a);
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS c FROM audit_log WHERE user_id = ?1 AND event = 'backup_code_create'").bind(u)
        .first<{ c: number }>().then((r) => r!.c),
    ).toBe(2);
  });

  it("N3: lost-code path has its own 1/day bucket and does not burn the rotation cap", async () => {
    const a = await newAccount(env, freshIp());
    await call(env, "/api/auth/backup-code", { method: "POST", cookie: a });
    const lost = await call(env, "/api/auth/backup-code", { method: "POST", cookie: a, body: { lostCode: true } });
    expect(lost.status).toBe(201);
    const issued = ((await lost.json()) as { code: string }).code;
    expect((await call(env, "/api/auth/backup-code", { method: "POST", cookie: a, body: { lostCode: true } })).status).toBe(429);
    expect((await call(env, "/api/auth/backup-code", { method: "POST", cookie: a, body: { currentCode: issued } })).status).toBe(201);
  });

  it("N5 + I3: purge deletes expired sessions and unreachable accounts only", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await newAccount(env, freshIp());
    const withCode = await newAccount(env, freshIp());
    const live = await newAccount(env, freshIp());
    const [ue, uc, ul] = [await uidOf(expired), await uidOf(withCode), await uidOf(live)];
    await call(env, "/api/auth/backup-code", { method: "POST", cookie: withCode });
    await env.DB.prepare("INSERT INTO weight_log (user_id, day, weight_kg, created_at) VALUES (?1, '2026-11-15', 80, 1)").bind(ue).run();
    // Age all three past the orphan grace; expire the sessions of two of them.
    await env.DB.prepare("UPDATE users SET created_at = created_at - 172800 WHERE id IN (?1, ?2, ?3)").bind(ue, uc, ul).run();
    await env.DB.prepare("UPDATE sessions SET expires_at = ?1 - 1 WHERE user_id IN (?2, ?3)").bind(now, ue, uc).run();
    await purgeExpired(env.DB, now);
    const count = (sql: string, id: string) => env.DB.prepare(sql).bind(id).first<{ c: number }>().then((r) => r!.c);
    expect(await count("SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?1", ue)).toBe(0);
    expect(await count("SELECT COUNT(*) AS c FROM sessions WHERE user_id = ?1", uc)).toBe(0);
    await purgeExpired(env.DB, now);
    expect(await count("SELECT COUNT(*) AS c FROM users WHERE id = ?1", ue)).toBe(0);
    expect(await count("SELECT COUNT(*) AS c FROM weight_log WHERE user_id = ?1", ue)).toBe(0);
    expect(await count("SELECT COUNT(*) AS c FROM users WHERE id = ?1", uc)).toBe(1); // has a backup code
    expect(await count("SELECT COUNT(*) AS c FROM users WHERE id = ?1", ul)).toBe(1); // has a live session
  });
});
