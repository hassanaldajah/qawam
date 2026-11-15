import type { z } from "zod";

export const MAX_JSON_BYTES = 16 * 1024;

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    // Turnstile (free) needs its script + iframe origin; nothing else third-party.
    "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; " +
    "img-src 'self' blob: data:; connect-src 'self'; frame-src https://challenges.cloudflare.com; " +
    "worker-src 'self'; manifest-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; " +
    "frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), geolocation=(), microphone=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
};

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers: h });
}

export function error(status: number, code: string, headers: HeadersInit = {}): Response {
  return json({ error: code }, status, headers);
}

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/**
 * Read at most `max` bytes from the body stream. Never trusts Content-Length
 * (chunked bodies have none); stops as soon as the cap is passed.
 */
export async function readBodyBounded(req: Request, max: number): Promise<Uint8Array> {
  const cl = req.headers.get("Content-Length");
  if (cl !== null && (!/^\d+$/.test(cl) || Number(cl) > max)) {
    throw new HttpError(/^\d+$/.test(cl) ? 413 : 411, /^\d+$/.test(cl) ? "payload_too_large" : "length_required");
  }
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, "payload_too_large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/** Read a JSON body with content-type + byte-size checks, then validate with a strict Zod schema. */
export async function readJson<S extends z.ZodType>(
  req: Request, schema: S, maxBytes = MAX_JSON_BYTES,
): Promise<z.infer<S>> {
  const ct = req.headers.get("Content-Type") ?? "";
  if (!/^application\/json(\s*;|$)/i.test(ct)) throw new HttpError(415, "unsupported_media_type");
  const bytes = await readBodyBounded(req, maxBytes);
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new HttpError(400, "invalid_body");
  return parsed.data;
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Client IP from Cloudflare. Fails closed (400) when missing so clients never share
 * one "unknown" bucket. Cloudflare and `wrangler pages dev` both set this header.
 */
export function clientIp(req: Request): string {
  const ip = req.headers.get("CF-Connecting-IP");
  if (!ip) throw new HttpError(400, "missing_client_ip");
  return ip;
}

/**
 * Rate-limit bucket for an IP: IPv4 as-is, IPv6 reduced to its /64 prefix
 * (a subscriber usually owns a whole /64, so /128 rotation must not reset limits).
 */
export function ipBucket(ip: string): string {
  const raw = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]!;
  if (!raw.includes(":")) return raw;
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return mapped[1]!;
  let groups: string[];
  if (raw.includes("::")) {
    const [head = "", tail = ""] = raw.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    groups = [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  } else {
    groups = raw.split(":");
  }
  const prefix = groups.slice(0, 4).map((g) => g.replace(/^0+/, "") || "0");
  while (prefix.length < 4) prefix.push("0");
  return prefix.join(":") + "::/64";
}
