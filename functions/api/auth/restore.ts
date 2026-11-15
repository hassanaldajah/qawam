import { z } from "zod";
import type { Ctx } from "../../_lib/types";
import { clientIp, error, json, nowSec, readJson } from "../../_lib/http";
import { auditStatement, getSession, newSession, sessionCookie } from "../../_lib/session";
import { sha256Hex, timingSafeEqual } from "../../_lib/crypto";
import { parseBackupCode } from "../../_lib/backup";
import { bumpStatement, ipKey, isLimited } from "../../_lib/ratelimit";

const IP_FAILS_PER_HOUR = 10;

const Body = z.strictObject({
  code: z.string().min(1).max(64),
  revokeOthers: z.boolean().optional(),
});

/**
 * POST /api/auth/restore : exchange a backup code for a new session.
 * Lockout = increasing delay per account (1s, 2s, 4s ... max 1h), never a hard lock,
 * plus a per-IP failure cap. Each attempt atomically claims the next delay before the
 * compare, so parallel guesses cannot bypass the backoff.
 */
export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const db = ctx.env.DB;
  const now = nowSec();
  const ipk = await ipKey("restore_fail", clientIp(ctx.request));
  if (await isLimited(db, ipk, IP_FAILS_PER_HOUR, 3600, now)) {
    return error(429, "rate_limited", { "Retry-After": "3600" });
  }
  const body = await readJson(ctx.request, Body);
  const fail = async () => {
    await bumpStatement(db, ipk, 3600, now).run();
    return error(401, "invalid_code");
  };

  const parsed = parseBackupCode(body.code);
  if (!parsed) return fail();

  const claimed = await db
    .prepare(
      "UPDATE backup_codes SET failed_attempts = failed_attempts + 1, " +
        "locked_until = ?1 + MIN(1 << MIN(failed_attempts, 12), 3600), last_failed_at = ?1 " +
        "WHERE public_id = ?2 AND locked_until <= ?1 RETURNING user_id, secret_hash",
    )
    .bind(now, parsed.publicId)
    .first<{ user_id: string; secret_hash: string }>();

  if (!claimed) {
    const row = await db
      .prepare("SELECT locked_until FROM backup_codes WHERE public_id = ?1")
      .bind(parsed.publicId)
      .first<{ locked_until: number }>();
    if (row) {
      return error(429, "try_later", { "Retry-After": String(Math.max(1, row.locked_until - now)) });
    }
    return fail();
  }

  const hash = await sha256Hex(parsed.secret);
  if (!timingSafeEqual(hash, claimed.secret_hash)) return fail();

  const userId = claimed.user_id;
  const current = await getSession(ctx);
  const s = await newSession(db, userId, now);
  const stmts = [
    db.prepare("UPDATE backup_codes SET failed_attempts = 0, locked_until = 0 WHERE user_id = ?1").bind(userId),
  ];
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
