import { readFileSync } from "node:fs";
import { Miniflare } from "miniflare";
import type { Ctx, D1Database, Env, Handler } from "../../functions/_lib/types";
import { onRequest as middleware } from "../../functions/_middleware";
import * as account from "../../functions/api/auth/account";
import * as session from "../../functions/api/auth/session";
import * as backupCode from "../../functions/api/auth/backup-code";
import * as restore from "../../functions/api/auth/restore";
import * as exportRoute from "../../functions/api/auth/export";
import { onRequest as catchAll } from "../../functions/api/[[path]]";
import { SITEVERIFY_URL } from "../../functions/_lib/turnstile";

export const ORIGIN = "https://qawam.al-hassan.dev";

type Mod = Partial<Record<"onRequestGet" | "onRequestPost" | "onRequestDelete" | "onRequest", Handler>>;
// Mirrors the file-based Pages routes under functions/api.
const ROUTES: Record<string, Mod> = {
  "/api/auth/account": account,
  "/api/auth/session": session,
  "/api/auth/backup-code": backupCode,
  "/api/auth/restore": restore,
  "/api/auth/export": exportRoute,
};

function pick(mod: Mod | undefined, method: string): Handler {
  if (!mod) return catchAll;
  const m = method[0] + method.slice(1).toLowerCase();
  return mod[`onRequest${m}` as keyof Mod] ?? mod.onRequest ?? catchAll;
}

export function splitSql(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function setup(): Promise<{ mf: Miniflare; env: Env }> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    d1Databases: ["DB"],
  });
  const db = (await mf.getD1Database("DB")) as unknown as D1Database;
  const sql = readFileSync(new URL("../../migrations/0001_init.sql", import.meta.url), "utf8");
  await db.batch(splitSql(sql).map((s) => db.prepare(s)));
  installTurnstileMock();
  return { mf, env: { DB: db, ALLOWED_ORIGIN: ORIGIN, RL_KEY: "test-rl-key", TURNSTILE_SECRET: "test-turnstile-secret" } };
}

/**
 * Mock Cloudflare siteverify (no network in tests). Token grammar:
 * "ok:<action>" -> success for our hostname; "host:<action>" -> wrong hostname;
 * "down" -> HTTP 500; "hang" -> never answers (until aborted); anything else -> success:false. Other URLs pass through.
 */
export const siteverifyCalls: Array<{ secret: string; response: string; remoteip: string }> = [];
let mockInstalled = false;
function installTurnstileMock(): void {
  if (mockInstalled) return;
  mockInstalled = true;
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url !== SITEVERIFY_URL) return real(input, init);
    const f = init!.body as FormData;
    const call = { secret: String(f.get("secret")), response: String(f.get("response")), remoteip: String(f.get("remoteip")) };
    siteverifyCalls.push(call);
    if (call.response === "down") return new Response("err", { status: 500 });
    if (call.response === "hang") {
      const signal = init!.signal!;
      return new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    }
    const [kind, action] = call.response.split(":");
    const host = new URL(ORIGIN).hostname;
    if (kind === "ok") return Response.json({ success: true, hostname: host, action });
    if (kind === "host") return Response.json({ success: true, hostname: "evil.example", action });
    return Response.json({ success: false, "error-codes": ["invalid-input-response"] });
  }) as typeof fetch;
}

export interface CallOpts {
  method?: string;
  body?: unknown;
  cookie?: string | null;
  ip?: string;
  origin?: string | null;
  csrf?: boolean;
  headers?: Record<string, string>;
  /** Turnstile token auto-added for create/restore; null = omit. */
  turnstile?: string | null;
}

export async function call(env: Env, path: string, o: CallOpts = {}): Promise<Response> {
  const method = o.method ?? "GET";
  const h = new Headers(o.headers);
  h.set("CF-Connecting-IP", o.ip ?? "203.0.113.1");
  if (method !== "GET" && method !== "HEAD") {
    if (o.origin !== null) h.set("Origin", o.origin ?? ORIGIN);
    if (o.csrf !== false) h.set("X-Qawam", "1");
  }
  if (o.cookie) h.set("Cookie", o.cookie);
  let payload = o.body;
  if (method === "POST" && o.turnstile !== null) {
    const action = path === "/api/auth/account" ? "create" : path === "/api/auth/restore" ? "restore" : null;
    if (action) {
      const token = o.turnstile ?? "ok:" + action;
      if (payload === undefined) payload = { turnstileToken: token };
      else if (typeof payload === "object" && payload !== null && !("turnstileToken" in payload)) {
        payload = { ...(payload as Record<string, unknown>), turnstileToken: token };
      }
    }
  }
  let body: string | undefined;
  if (payload !== undefined) {
    o = { ...o, body: payload };
    body = typeof o.body === "string" ? o.body : JSON.stringify(o.body);
    if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
    if (!h.has("Content-Length")) h.set("Content-Length", String(new TextEncoder().encode(body).byteLength));
  }
  const request = new Request("https://qawam.al-hassan.dev" + path, { method, headers: h, body });
  const ctx: Ctx = {
    request,
    env,
    params: {},
    data: {},
    waitUntil: () => {},
    next: async () => pick(ROUTES[path.split("?")[0]!], method)(ctx),
  };
  return middleware(ctx);
}

/** Extract "name=value" from a Set-Cookie response header. */
export function cookieOf(res: Response): string | null {
  const sc = res.headers.get("Set-Cookie");
  if (!sc) return null;
  return sc.split(";")[0] ?? null;
}

export async function newAccount(env: Env, ip = "198.51.100.7"): Promise<string> {
  const res = await call(env, "/api/auth/account", { method: "POST", ip });
  if (res.status !== 201) throw new Error("account create failed " + res.status);
  return cookieOf(res)!;
}
