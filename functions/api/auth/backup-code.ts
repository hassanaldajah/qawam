import { z } from "zod";
import type { Ctx } from "../../_lib/types";
import { error, json, nowSec, readJson } from "../../_lib/http";
import { auditStatement, requireSession, withRefresh } from "../../_lib/session";
import { sha256Hex, timingSafeEqual } from "../../_lib/crypto";
import { generateBackupCode, parseBackupCode } from "../../_lib/backup";
import { consume } from "../../_lib/ratelimit";

export const CREATES_PER_DAY = 3;
export const LOST_RESETS_PER_DAY = 1;

const Body = z.strictObject({
  currentCode: z.string().min(1).max(64).optional(),
  lostCode: z.literal(true).optional(),
});

/**
 * POST /api/auth/backup-code : create, rotate, or reset the account's backup code.
 * - No code yet: session only (first creation).
 * - Rotation: requires { currentCode } (the existing code); wrong code = 401.
 * - Lost code: { lostCode: true }, session only. Other sessions are KEPT (revoking them
 *   would let a cookie thief evict the owner); instead reset_without_code_at is set and
 *   every session sees a banner via GET /api/auth/session until a proper rotation.
 * The plain code is returned exactly once; only SHA-256(secret) is stored (130-bit secret).
 */
export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const s = await requireSession(ctx);
  const db = ctx.env.DB;
  const now = nowSec();
  const body = ctx.request.headers.get("Content-Type") ? await readJson(ctx.request, Body) : {};
  const existing = await db
    .prepare("SELECT public_id, secret_hash FROM backup_codes WHERE user_id = ?1")
    .bind(s.userId)
    .first<{ public_id: string; secret_hash: string }>();

  let resetAt: number | null = null;
  if (existing) {
    if (body.currentCode !== undefined) {
      const p = parseBackupCode(body.currentCode);
      const hash = p ? await sha256Hex(p.secret) : "";
      const ok = p !== null && p.publicId === existing.public_id && timingSafeEqual(hash, existing.secret_hash);
      if (!ok) return withRefresh(error(401, "invalid_code"), s);
    } else if (body.lostCode === true) {
      resetAt = now;
    } else {
      return withRefresh(error(400, "current_code_required"), s);
    }
  }
  // Separate buckets (N3): a cookie thief can use the session-only lost-code path once a
  // day, but cannot exhaust the bucket the owner needs for a normal rotation.
  const bucket = resetAt === null ? "bc:" : "bc_lost:";
  const cap = resetAt === null ? CREATES_PER_DAY : LOST_RESETS_PER_DAY;
  if (!(await consume(db, bucket + s.userId, cap, 86400, now, ctx.waitUntil))) {
    return withRefresh(error(429, "rate_limited"), s);
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const code = generateBackupCode();
    const secretHash = await sha256Hex(code.secret);
    // Compare-and-swap (N3): the write only applies if the code we validated is still the
    // stored one (or, for first creation, none exists yet); the audit row is written only
    // if the swap changed a row. One D1 batch = one transaction.
    const write = existing
      ? db
          .prepare(
            "UPDATE backup_codes SET public_id = ?2, secret_hash = ?3, created_at = ?4, reset_without_code_at = ?5 " +
              "WHERE user_id = ?1 AND secret_hash = ?6",
          )
          .bind(s.userId, code.publicId, secretHash, now, resetAt, existing.secret_hash)
      : db
          .prepare(
            "INSERT INTO backup_codes (user_id, public_id, secret_hash, created_at, reset_without_code_at) " +
              "VALUES (?1, ?2, ?3, ?4, NULL) ON CONFLICT (user_id) DO NOTHING",
          )
          .bind(s.userId, code.publicId, secretHash, now);
    try {
      const [res] = await db.batch([
        write,
        db
          .prepare("INSERT INTO audit_log (user_id, event, ts) SELECT ?1, ?2, ?3 WHERE changes() > 0")
          .bind(s.userId, resetAt === null ? "backup_code_create" : "backup_code_reset", now),
      ]);
      if (!res || (res.meta.changes ?? 0) === 0) return withRefresh(error(409, "code_changed"), s);
      return withRefresh(json({ code: code.display }, 201), s);
    } catch (e) {
      // public_id UNIQUE collision (~2^-50): retry once with a fresh code.
      if (attempt === 1) throw e;
    }
  }
  return error(500, "internal_error");
};
