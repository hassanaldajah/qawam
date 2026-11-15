import type { Ctx } from "../../_lib/types";
import { error, json, nowSec } from "../../_lib/http";
import { auditStatement, requireSession } from "../../_lib/session";
import { sha256Hex } from "../../_lib/crypto";
import { generateBackupCode } from "../../_lib/backup";
import { consume } from "../../_lib/ratelimit";

const CREATES_PER_DAY = 10;

/**
 * POST /api/auth/backup-code : create or regenerate the account's backup code.
 * The plain code is returned exactly once; only SHA-256(secret) is stored
 * (130-bit random secret, so a fast hash is sufficient).
 */
export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const s = await requireSession(ctx);
  const db = ctx.env.DB;
  const now = nowSec();
  if (!(await consume(db, "bc:" + s.userId, CREATES_PER_DAY, 86400, now))) {
    return error(429, "rate_limited");
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const code = generateBackupCode();
    const secretHash = await sha256Hex(code.secret);
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO backup_codes (user_id, public_id, secret_hash, created_at, failed_attempts, locked_until) " +
              "VALUES (?1, ?2, ?3, ?4, 0, 0) ON CONFLICT (user_id) DO UPDATE SET public_id = excluded.public_id, " +
              "secret_hash = excluded.secret_hash, created_at = excluded.created_at, failed_attempts = 0, locked_until = 0",
          )
          .bind(s.userId, code.publicId, secretHash, now),
        auditStatement(db, s.userId, "backup_code_create", now),
      ]);
      return json({ code: code.display }, 201);
    } catch (e) {
      // public_id UNIQUE collision (~2^-50): retry once with a fresh code.
      if (attempt === 1) throw e;
    }
  }
  return error(500, "internal_error");
};
