import type { z } from "zod";

export const MAX_JSON_BYTES = 16 * 1024;

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; " +
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

/** Read a JSON body with content-type + size checks, then validate with a strict Zod schema. */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const ct = req.headers.get("Content-Type") ?? "";
  if (!/^application\/json(\s*;|$)/i.test(ct)) throw new HttpError(415, "unsupported_media_type");
  const len = Number(req.headers.get("Content-Length") ?? "0");
  if (len > MAX_JSON_BYTES) throw new HttpError(413, "payload_too_large");
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw new HttpError(413, "payload_too_large");
  let data: unknown;
  try {
    data = JSON.parse(text);
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

export function clientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP") ?? "unknown";
}
