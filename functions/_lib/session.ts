import type { Ctx, D1Database, D1PreparedStatement } from "./types";
import { randomHex, sha256Hex } from "./crypto";
import { HttpError, nowSec } from "./http";

export const COOKIE_NAME = "__Host-qs";
export const SESSION_TTL = 31536000; // 1 year
const REFRESH_AFTER = 86400; // sliding refresh at most once per day (D1 write budget)
const TOKEN_RE = /^[0-9a-f]{64}$/;

export function readSessionToken(req: Request): string | null {
  const header = req.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === COOKIE_NAME) {
      const v = part.slice(i + 1).trim();
      return TOKEN_RE.test(v) ? v : null;
    }
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}`;
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export interface Session {
  userId: string;
  tokenHash: string;
  /** Set-Cookie value to attach when the session was refreshed. */
  refreshCookie?: string;
}

/** Issue a new 256-bit token. Returns the raw token (cookie only) and the insert statement. */
export async function newSession(
  db: D1Database, userId: string, now: number,
): Promise<{ token: string; tokenHash: string; stmt: D1PreparedStatement }> {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const stmt = db
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, last_seen, expires_at) VALUES (?1, ?2, ?3, ?3, ?4)")
    .bind(tokenHash, userId, now, now + SESSION_TTL);
  return { token, tokenHash, stmt };
}

/** user_id comes ONLY from the session hash, never from the request body/params. */
export async function getSession(ctx: Ctx): Promise<Session | null> {
  const token = readSessionToken(ctx.request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = nowSec();
  const row = await ctx.env.DB
    .prepare("SELECT user_id, last_seen, expires_at FROM sessions WHERE token_hash = ?1")
    .bind(tokenHash)
    .first<{ user_id: string; last_seen: number; expires_at: number }>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await ctx.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
    return null;
  }
  const s: Session = { userId: row.user_id, tokenHash };
  if (now - row.last_seen >= REFRESH_AFTER) {
    await ctx.env.DB
      .prepare("UPDATE sessions SET last_seen = ?1, expires_at = ?2 WHERE token_hash = ?3")
      .bind(now, now + SESSION_TTL, tokenHash)
      .run();
    s.refreshCookie = sessionCookie(token);
  }
  return s;
}

export async function requireSession(ctx: Ctx): Promise<Session> {
  const s = await getSession(ctx);
  if (!s) throw new HttpError(401, "unauthenticated");
  return s;
}

export function withRefresh(res: Response, s: Session): Response {
  if (s.refreshCookie) res.headers.append("Set-Cookie", s.refreshCookie);
  return res;
}

export function auditStatement(db: D1Database, userId: string, event: string, now: number) {
  return db.prepare("INSERT INTO audit_log (user_id, event, ts) VALUES (?1, ?2, ?3)").bind(userId, event, now);
}
