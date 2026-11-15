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
  return { mf, env: { DB: db, ALLOWED_ORIGIN: ORIGIN } };
}

export interface CallOpts {
  method?: string;
  body?: unknown;
  cookie?: string | null;
  ip?: string;
  origin?: string | null;
  csrf?: boolean;
  headers?: Record<string, string>;
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
  let body: string | undefined;
  if (o.body !== undefined) {
    body = typeof o.body === "string" ? o.body : JSON.stringify(o.body);
    if (!h.has("Content-Type")) h.set("Content-Type", "application/json");
  }
  const request = new Request("https://qawam.al-hassan.dev" + path, { method, headers: h, body });
  const ctx: Ctx = {
    request,
    env,
    params: {},
    data: {},
    waitUntil: () => {},
    next: async () => pick(ROUTES[path], method)(ctx),
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
