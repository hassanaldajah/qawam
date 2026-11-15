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

/**
 * CSRF defence for cookie routes: exact Origin match + custom header (forces preflight
 * cross-site) + Sec-Fetch-Site when the browser sends it. Body framing: a request with a
 * body must carry a numeric Content-Length (else 411) within the global cap; handlers
 * still count bytes while reading (readBodyBounded), so the header is never trusted alone.
 * Future /api/shortcut/* exemption: see docs/DECISIONS.md (not implemented).
 */
function checkRequest(req: Request, allowedOrigin: string): Response | null {
  if (SAFE_METHODS.has(req.method)) return null;
  // No CORS: preflights are never answered positively.
  if (req.method === "OPTIONS") return error(403, "cors_forbidden");
  const origin = req.headers.get("Origin");
  if (!origin || origin !== allowedOrigin) return error(403, "bad_origin");
  const sfs = req.headers.get("Sec-Fetch-Site");
  if (sfs !== null && sfs !== "same-origin") return error(403, "bad_fetch_site");
  if (req.headers.get("X-Qawam") !== "1") return error(403, "missing_csrf_header");
  const cl = req.headers.get("Content-Length");
  if (cl === null) {
    if (req.body !== null) return error(411, "length_required");
  } else {
    if (!/^\d+$/.test(cl)) return error(411, "length_required");
    if (Number(cl) > MAX_JSON_BYTES) return error(413, "payload_too_large");
  }
  return null;
}

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  try {
    const blocked = checkRequest(ctx.request, ctx.env.ALLOWED_ORIGIN);
    if (blocked) return harden(blocked);
    return harden(await ctx.next());
  } catch (e) {
    if (e instanceof HttpError) return harden(error(e.status, e.code));
    // Correlation id = Cloudflare's cf-ray. Never log e.message, bodies or cookies.
    const ray = ctx.request.headers.get("cf-ray") ?? "none";
    console.error("unhandled", e instanceof Error ? e.name : "error", ray);
    return harden(json500(ray));
  }
};

function json500(ray: string): Response {
  return new Response(JSON.stringify({ error: "internal_error", ray }), {
    status: 500,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
