import type { Env } from "./types";
import { HttpError } from "./http";

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
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
