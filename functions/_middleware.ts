import type { Ctx } from "./_lib/types";
import { HttpError, MAX_JSON_BYTES, SECURITY_HEADERS, error } from "./_lib/http";

const SAFE_METHODS = new Set(["GET", "HEAD"]);

function harden(res: Response): Response {
  // Responses from fetch/Response may have immutable headers; copy to be safe.
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  out.headers.delete("Access-Control-Allow-Origin");
  return out;
}

/** CSRF defence for cookie routes: exact Origin match + custom header (forces preflight cross-site). */
function checkCsrf(req: Request, allowedOrigin: string): Response | null {
  if (SAFE_METHODS.has(req.method)) return null;
  // No CORS: preflights are never answered positively.
  if (req.method === "OPTIONS") return error(403, "cors_forbidden");
  const origin = req.headers.get("Origin");
  if (!origin || origin !== allowedOrigin) return error(403, "bad_origin");
  if (req.headers.get("X-Qawam") !== "1") return error(403, "missing_csrf_header");
  const len = Number(req.headers.get("Content-Length") ?? "0");
  if (len > MAX_JSON_BYTES) return error(413, "payload_too_large");
  return null;
}

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  try {
    const blocked = checkCsrf(ctx.request, ctx.env.ALLOWED_ORIGIN);
    if (blocked) return harden(blocked);
    return harden(await ctx.next());
  } catch (e) {
    if (e instanceof HttpError) return harden(error(e.status, e.code));
    // Never log request bodies or cookies; message only.
    console.error("unhandled", e instanceof Error ? e.name : "error");
    return harden(error(500, "internal_error"));
  }
};
