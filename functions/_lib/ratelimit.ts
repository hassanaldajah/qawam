import type { D1Database } from "./types";
import { sha256Hex } from "./crypto";

/** Rate-limit keys never store raw IPs: they are SHA-256 hashed. */
export async function ipKey(prefix: string, ip: string): Promise<string> {
  return `${prefix}:${(await sha256Hex("ip:" + ip)).slice(0, 32)}`;
}

function windowStart(now: number, windowSec: number): number {
  return now - (now % windowSec);
}

/**
 * Atomically consume one unit. Returns false if the bucket is already at `limit`.
 * Single statement: INSERT ... ON CONFLICT DO UPDATE ... WHERE count < limit RETURNING.
 */
export async function consume(
  db: D1Database, key: string, limit: number, windowSec: number, now: number,
): Promise<boolean> {
  const row = await db
    .prepare(
      "INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1) " +
        "ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 WHERE count < ?3 RETURNING count",
    )
    .bind(key, windowStart(now, windowSec), limit)
    .first<{ count: number }>();
  return row !== null;
}

/** Read-only check: true if the bucket has reached `limit`. */
export async function isLimited(
  db: D1Database, key: string, limit: number, windowSec: number, now: number,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT count FROM rate_limits WHERE key = ?1 AND window_start = ?2")
    .bind(key, windowStart(now, windowSec))
    .first<{ count: number }>();
  return (row?.count ?? 0) >= limit;
}

/** Count a failure (unbounded increment). */
export function bumpStatement(db: D1Database, key: string, windowSec: number, now: number) {
  return db
    .prepare(
      "INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1) " +
        "ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1",
    )
    .bind(key, windowStart(now, windowSec));
}
