// Thin client for /api/auth/* (contract: functions/api/auth/*, docs/DECISIONS.md).
// Every mutating call sends X-Qawam: 1 (CSRF header); the browser adds Origin. No secrets are stored.

export type ApiErrorCode =
  | "network" | "turnstile" | "rate_limited" | "unavailable" | "invalid_code" | "unauthorized"
  | "current_code_required" | "server";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, public status = 0) { super(code); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "X-Qawam": "1", Accept: "application/json" };
  const init: RequestInit = { method, credentials: "same-origin", headers, cache: "no-store" };
  if (body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
  let res: Response;
  try { res = await fetch(path, init); } catch { throw new ApiError("network"); }
  let data: Record<string, unknown> = {};
  try { data = (await res.json()) as Record<string, unknown>; } catch { /* non-JSON (e.g. static preview) */ }
  if (res.ok) return data as T;
  const err = typeof data.error === "string" ? data.error : "";
  if (res.status === 403 && err.startsWith("turnstile")) throw new ApiError("turnstile", 403);
  if (res.status === 403) throw new ApiError("turnstile", 403);
  if (res.status === 429) throw new ApiError("rate_limited", 429);
  if (res.status === 503) throw new ApiError("unavailable", 503);
  if (res.status === 401 && err === "invalid_code") throw new ApiError("invalid_code", 401);
  if (res.status === 401) throw new ApiError("unauthorized", 401);
  if (res.status === 400 && err === "current_code_required") throw new ApiError("current_code_required", 400);
  throw new ApiError("server", res.status);
}

export interface SessionInfo { authenticated: boolean; hasBackupCode?: boolean; backupCodeResetAt?: number }

export const api = {
  session: () => call<SessionInfo>("GET", "/api/auth/session"),
  createAccount: (turnstileToken: string) => call<{ created: boolean }>("POST", "/api/auth/account", { turnstileToken }),
  /** First creation only (no body): the server returns the plain code exactly once. */
  createBackupCode: () => call<{ code: string }>("POST", "/api/auth/backup-code"),
  restore: (code: string, turnstileToken: string) =>
    call<{ restored: boolean; regenerateSuggested?: boolean }>("POST", "/api/auth/restore", { code, turnstileToken }),
  logout: () => call<{ ok: boolean }>("DELETE", "/api/auth/session"),
  deleteAccount: () => call<{ deleted: boolean }>("DELETE", "/api/auth/account", { confirm: "DELETE" }),
  /** Export v2: first page of every table, then follow `next` cursors per table. */
  exportData: async () => {
    const data = await call<Record<string, unknown> & { next?: Record<string, number> }>("GET", "/api/auth/export");
    const next = { ...(data.next ?? {}) };
    for (const [table, start] of Object.entries(next)) {
      let after: number | null = start;
      const rows = (data[table] as unknown[]) ?? [];
      while (after !== null) {
        const p: { rows: unknown[]; next: number | null } =
          await call("GET", `/api/auth/export?table=${encodeURIComponent(table)}&after=${after}`);
        rows.push(...p.rows);
        after = p.next;
      }
      data[table] = rows;
    }
    delete data.next;
    return data;
  },
};
