import type { Ctx } from "../../_lib/types";
import { json } from "../../_lib/http";
import { clearCookie, getSession, withRefresh } from "../../_lib/session";

/** GET /api/auth/session : is there a valid session, and does it have a backup code? */
export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const s = await getSession(ctx);
  if (!s) return json({ authenticated: false });
  const bc = await ctx.env.DB
    .prepare("SELECT reset_without_code_at AS r FROM backup_codes WHERE user_id = ?1")
    .bind(s.userId)
    .first<{ r: number | null }>();
  const out: Record<string, unknown> = { authenticated: true, hasBackupCode: bc !== null };
  // Banner on every device: the code was reset without the old code (possible cookie theft).
  if (bc?.r) out.backupCodeResetAt = bc.r;
  return withRefresh(json(out), s);
};

/** DELETE /api/auth/session : log out this device. */
export const onRequestDelete = async (ctx: Ctx): Promise<Response> => {
  const s = await getSession(ctx);
  if (s) await ctx.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(s.tokenHash).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
};
