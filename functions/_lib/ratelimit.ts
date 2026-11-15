import type { D1Database, Env } from "./types";
import { hmacSha256Hex } from "./crypto";
import { ipBucket } from "./http";

/**
 * Rate-limit key for an IP bucket (IPv6 -> /64). Raw IPs are never stored: the key is
 * HMAC-SHA256 with the RL_KEY secret, so a D1 leak cannot be reversed by enumerating IPv4.
 * Throws (500) if RL_KEY is missing: never fall back to a plain hash.
 */
export async function ipKey(env: Pick<Env, "RL_KEY">, prefix: string, ip: string): Promise<string> {
  if (!env.RL_KEY) throw new Error("RL_KEY missing");
  return `${prefix}:${(await hmacSha256Hex(env.RL_KEY, "ip:" + ipBucket(ip))).slice(0, 32)}`;
}

function windowStart(now: number, windowSec: number): number {
  return now - (now % windowSec);
}

/** Longest window in use is one day; keep one extra day. */
export const RATE_LIMIT_RETENTION = 2 * 86400;
/** Audit rows are pseudonymous; kept 90 days for abuse investigation, then purged. */
export const AUDIT_RETENTION = 90 * 86400;
/** Rows deleted per table per purge (bounded; never an unbounded DELETE). */
export const PURGE_BATCH = 500;
/** Fraction of consume() calls that trigger a purge (Pages has no cron yet). */
export const PURGE_RATE = 0.01;

/** Delete expired rate-limit buckets and old audit rows, bounded via rowid subqueries. */
export async function purgeExpired(db: D1Database, now: number): Promise<void> {
  await db.batch([
    db
      .prepare("DELETE FROM rate_limits WHERE rowid IN (SELECT rowid FROM rate_limits WHERE window_start < ?1 LIMIT ?2)")
      .bind(now - RATE_LIMIT_RETENTION, PURGE_BATCH),
    db
      .prepare("DELETE FROM audit_log WHERE rowid IN (SELECT rowid FROM audit_log WHERE ts < ?1 LIMIT ?2)")
      .bind(now - AUDIT_RETENTION, PURGE_BATCH),
  ]);
}

/**
 * Atomically consume one unit. Returns false if the bucket is already at `limit`.
 * Single statement: INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit RETURNING.
 * Pass `waitUntil` to enable the 1% background purge.
 */
export async function consume(
  db: D1Database, key: string, limit: number, windowSec: number, now: number,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<boolean> {
  const row = await db
    .prepare(
      "INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1) " +
        "ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 WHERE count < ?3 RETURNING count",
    )
    .bind(key, windowStart(now, windowSec), limit)
    .first<{ count: number }>();
  if (waitUntil && Math.random() < PURGE_RATE) {
    waitUntil(purgeExpired(db, now).catch(() => console.error("purge_failed")));
  }
  return row !== null;
}
