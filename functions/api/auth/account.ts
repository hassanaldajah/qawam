import { z } from "zod";
import type { Ctx } from "../../_lib/types";
import { clientIp, error, json, nowSec, readJson } from "../../_lib/http";
import { auditStatement, clearCookie, getSession, newSession, requireSession, sessionCookie } from "../../_lib/session";
import { consume, ipKey } from "../../_lib/ratelimit";
import { USER_TABLES } from "../../_lib/tables";

const CREATE_PER_IP_PER_HOUR = 5;

/** POST /api/auth/account : create an anonymous account and set the session cookie. */
export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const db = ctx.env.DB;
  const existing = await getSession(ctx);
  if (existing) return json({ created: false }, 200);

  const now = nowSec();
  const key = await ipKey("create", clientIp(ctx.request));
  if (!(await consume(db, key, CREATE_PER_IP_PER_HOUR, 3600, now))) {
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
  stmts.push(auditStatement(db, s.userId, "account_delete", now));
  await db.batch(stmts);
  return json({ deleted: true }, 200, { "Set-Cookie": clearCookie() });
};
