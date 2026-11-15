import { z } from "zod";
import type { Ctx } from "../../_lib/types";
import { clientIp, error, json, nowSec, readJson } from "../../_lib/http";
import { auditStatement, getSession, newSession, sessionCookie } from "../../_lib/session";
import { sha256Hex, timingSafeEqual } from "../../_lib/crypto";
import { parseBackupCode } from "../../_lib/backup";
import { consume, ipKey } from "../../_lib/ratelimit";
import { verifyTurnstile } from "../../_lib/turnstile";

/** Attempts per IP bucket (IPv6 /64) per hour, success or not. */
export const IP_ATTEMPTS_PER_HOUR = 10;
/** Compared against when the public id is unknown, so both paths do the same work. */
const DUMMY_HASH = "0".repeat(64);

const Body = z.strictObject({
  code: z.string().min(1).max(64),
  turnstileToken: z.string().min(1).max(2048),
  revokeOthers: z.boolean().optional(),
});

/**
 * POST /api/auth/restore : exchange a backup code for a new session.
 *
 * No per-account lock (any account-keyed lock is attacker-controlled: whoever knows a
 * public id could keep the owner out). Defence = 130-bit secret + per-IP attempt cap
 * consumed atomically before anything else + Turnstile on every attempt. A correct code
 * always works; unknown id and wrong secret return the identical 401.
 */
export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const db = ctx.env.DB;
  const now = nowSec();
  const ip = clientIp(ctx.request);
  if (!(await consume(db, await ipKey(ctx.env, "restore_ip", ip), IP_ATTEMPTS_PER_HOUR, 3600, now, ctx.waitUntil))) {
    return error(429, "rate_limited", { "Retry-After": "3600" });
  }
  const body = await readJson(ctx.request, Body);
  await verifyTurnstile(ctx.env, body.turnstileToken, "restore", ip);

  const parsed = parseBackupCode(body.code);
  if (!parsed) return error(401, "invalid_code");
  const row = await db
    .prepare("SELECT user_id, secret_hash FROM backup_codes WHERE public_id = ?1")
    .bind(parsed.publicId)
    .first<{ user_id: string; secret_hash: string }>();
  const hash = await sha256Hex(parsed.secret);
  const ok = timingSafeEqual(hash, row?.secret_hash ?? DUMMY_HASH);
  if (!row || !ok) return error(401, "invalid_code");

  const userId = row.user_id;
  const current = await getSession(ctx);
  const s = await newSession(db, userId, now);
  const stmts = [];
  if (body.revokeOthers !== false) {
    stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(userId));
  }
  // The device's previous session (possibly another anonymous account) is ended; session fixation safe.
  if (current) stmts.push(db.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(current.tokenHash));
  stmts.push(
    db.prepare("UPDATE shortcut_keys SET revoked_at = ?1 WHERE user_id = ?2 AND revoked_at IS NULL").bind(now, userId),
  );
  stmts.push(s.stmt);
  stmts.push(auditStatement(db, userId, "restore", now));
  await db.batch(stmts);
  return json({ restored: true, regenerateSuggested: true }, 200, { "Set-Cookie": sessionCookie(s.token) });
};
