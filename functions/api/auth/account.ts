import { z } from "zod";
import type { Ctx } from "../../_lib/types";
import { clientIp, error, json, nowSec, readJson } from "../../_lib/http";
import { auditStatement, clearCookie, getSession, newSession, requireSession, sessionCookie } from "../../_lib/session";
import { consume, ipKey } from "../../_lib/ratelimit";
import { verifyTurnstileMetered } from "../../_lib/turnstile";
import { USER_TABLES } from "../../_lib/tables";

/** Per IP bucket (IPv6 /64). */
export const CREATE_PER_IP_PER_HOUR = 5;
export const CREATE_PER_IP_PER_DAY = 10;
/** Global ceiling protecting the D1 write budget (100k/day) from account farming. */
export const CREATE_GLOBAL_PER_HOUR = 200;

const CreateBody = z.strictObject({ turnstileToken: z.string().min(1).max(2048) });

/** POST /api/auth/account : create an anonymous account and set the session cookie. */
export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const db = ctx.env.DB;
  const existing = await getSession(ctx);
  if (existing) return json({ created: false }, 200);

  const now = nowSec();
  const ip = clientIp(ctx.request);
  const body = await readJson(ctx.request, CreateBody);
  // Order: metered siteverify (looser per-IP bucket, 3 s timeout), then the strict per-IP
  // hourly + daily caps, then the global cap. Per-IP caps bound any one /64 to a small
  // share of the global cap (N1); residual risk = many IPs + paid solves, see DECISIONS.md.
  await verifyTurnstileMetered(ctx.env, db, body.turnstileToken, "create", ip, now, ctx.waitUntil);
  if (
    !(await consume(db, await ipKey(ctx.env, "create", ip), CREATE_PER_IP_PER_HOUR, 3600, now)) ||
    !(await consume(db, await ipKey(ctx.env, "create_day", ip), CREATE_PER_IP_PER_DAY, 86400, now))
  ) {
    return error(429, "rate_limited", { "Retry-After": "3600" });
  }
  if (!(await consume(db, "create_global", CREATE_GLOBAL_PER_HOUR, 3600, now))) {
    // Alert hook: visible in Workers logs / Logpush; the owner reacts (WAF rule, raise cap).
    console.error("create_global_cap_hit");
    return error(429, "rate_limited", { "Retry-After": "3600" });
  }

  const userId = crypto.randomUUID();
  const s = await newSession(db, userId, now);
  await db.batch([
    db.prepare("INSERT INTO users (id, created_at) VALUES (?1, ?2)").bind(userId, now),
    s.stmt,
    auditStatement(db, userId, "account_create", now),
  ]);
  return json({ created: true }, 201, { "Set-Cookie": sessionCookie(s.token) });
};

const DeleteBody = z.strictObject({ confirm: z.literal("DELETE") });

/** DELETE /api/auth/account : hard delete of every row owned by the user. */
export const onRequestDelete = async (ctx: Ctx): Promise<Response> => {
  const s = await requireSession(ctx);
  await readJson(ctx.request, DeleteBody);
  const db = ctx.env.DB;
  const now = nowSec();
  // Explicit deletes (do not rely only on FK cascade); children before parents.
  const stmts = USER_TABLES.map((t) => db.prepare(t.deleteSql).bind(s.userId));
  stmts.push(db.prepare("DELETE FROM users WHERE id = ?1").bind(s.userId));
  // User-keyed rate-limit buckets (IP buckets are hashed and not linkable to the user).
  stmts.push(
    db
      .prepare("DELETE FROM rate_limits WHERE key IN (?1, ?2, ?3, ?4)")
      .bind("bc:" + s.userId, "bc_lost:" + s.userId, "export:" + s.userId, "export_page:" + s.userId),
  );
  stmts.push(auditStatement(db, s.userId, "account_delete", now));
  await db.batch(stmts);
  return json({ deleted: true }, 200, { "Set-Cookie": clearCookie() });
};
