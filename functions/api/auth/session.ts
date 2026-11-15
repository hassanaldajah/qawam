import type { Ctx } from "../../_lib/types";
import { json } from "../../_lib/http";
import { clearCookie, getSession, withRefresh } from "../../_lib/session";

/** GET /api/auth/session : is there a valid session, and does it have a backup code? */
export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const s = await getSession(ctx);
  if (!s) return json({ authenticated: false });
  const bc = await ctx.env.DB
    .prepare("SELECT 1 AS x FROM backup_codes WHERE user_id = ?1")
    .bind(s.userId)
    .first();
  return withRefresh(json({ authenticated: true, hasBackupCode: bc !== null }), s);
};

/** DELETE /api/auth/session : log out this device. */
export const onRequestDelete = async (ctx: Ctx): Promise<Response> => {
  const s = await getSession(ctx);
  if (s) await ctx.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(s.tokenHash).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
};
