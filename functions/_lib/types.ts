// Minimal structural types so Functions code type-checks with the DOM lib
// (same shape as Cloudflare's D1 binding). Keeps tests runnable in Node.

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number; [k: string]: unknown };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface Env {
  DB: D1Database;
  /** Exact origin allowed for state-changing requests, e.g. https://qawam.al-hassan.dev */
  ALLOWED_ORIGIN: string;
  /** Secret (wrangler pages secret / .dev.vars) for HMAC of rate-limit IP keys. Required. */
  RL_KEY?: string;
  /** Turnstile secret (wrangler pages secret / .dev.vars). Required for create + restore. */
  TURNSTILE_SECRET?: string;
}

/** Subset of the Pages Functions EventContext that our code uses. */
export interface Ctx {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  next: () => Promise<Response>;
  waitUntil: (p: Promise<unknown>) => void;
}

export type Handler = (ctx: Ctx) => Promise<Response>;
