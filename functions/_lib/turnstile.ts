import type { D1Database, Env } from "./types";
import { consume, ipKey } from "./ratelimit";
import { HttpError } from "./http";

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** A hung siteverify must not hold the request; timeout = 503 (fail closed). */
export const SITEVERIFY_TIMEOUT_MS = 3000;

export type TurnstileAction = "create" | "restore";

/**
 * Server-side Cloudflare Turnstile check (free plan). Tokens are single-use and valid
 * for 300 s, so the client must execute the widget at submit time.
 * Checks success + hostname (our origin) + action. Failure = 403; siteverify
 * unreachable or secret missing = 503 (fail closed).
 * Secret: `wrangler pages secret put TURNSTILE_SECRET` (never in the repo).
 */
export async function verifyTurnstile(env: Env, token: string, action: TurnstileAction, ip: string): Promise<void> {
  if (!env.TURNSTILE_SECRET) throw new HttpError(503, "turnstile_unavailable");
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  form.append("remoteip", ip);
  let data: { success?: boolean; hostname?: string; action?: string };
  try {
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body: form, signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS) });
    if (!res.ok) throw new Error("siteverify_status");
    data = (await res.json()) as typeof data;
  } catch {
    throw new HttpError(503, "turnstile_unavailable");
  }
  const expectedHost = new URL(env.ALLOWED_ORIGIN).hostname;
  if (data.success !== true || data.hostname !== expectedHost || data.action !== action) {
    throw new HttpError(403, "turnstile_failed");
  }
}

/** Siteverify fetches per IP bucket (IPv6 /64) per hour, across create + restore. */
export const SITEVERIFY_PER_IP_PER_HOUR = 30;

/**
 * Meter outbound siteverify calls per IP BEFORE fetching (N2), with a looser bucket than
 * the action limits, so garbage tokens cannot cause unbounded fetches, while the strict
 * action buckets are consumed only after Turnstile passes (N4: bots without valid solves
 * cannot use up a shared IP's restore/create allowance).
 */
export async function verifyTurnstileMetered(
  env: Env, db: D1Database, token: string, action: TurnstileAction, ip: string, now: number,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<void> {
  const key = await ipKey(env, "siteverify", ip);
  if (!(await consume(db, key, SITEVERIFY_PER_IP_PER_HOUR, 3600, now, waitUntil))) {
    throw new HttpError(429, "rate_limited");
  }
  await verifyTurnstile(env, token, action, ip);
}
