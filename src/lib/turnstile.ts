// Cloudflare Turnstile, explicit render + execute at submit (docs/DECISIONS.md).
// The script is injected from the bundle (CSP allows challenges.cloudflare.com), never self-hosted.

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(id: string): void;
  reset(id: string): void;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

export const siteKey = (): string => (import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined)?.trim() ?? "";

function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC; s.async = true; s.defer = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => { loading = null; s.remove(); reject(new Error("turnstile")); };
    document.head.appendChild(s);
  });
  return loading;
}

export interface Widget { token(): Promise<string>; destroy(): void }

/** Mounts an invisible-until-needed widget; token() executes a fresh single-use challenge. */
export async function mountTurnstile(el: HTMLElement, action: "create" | "restore", lang: string): Promise<Widget> {
  const ts = await load();
  let pending: { ok: (t: string) => void; fail: (e: Error) => void } | null = null;
  const id = ts.render(el, {
    sitekey: siteKey(), action, execution: "execute", appearance: "interaction-only", language: lang, "refresh-expired": "manual",
    callback: (t: string) => { pending?.ok(t); pending = null; },
    "error-callback": () => { pending?.fail(new Error("turnstile")); pending = null; return true; },
    "timeout-callback": () => { pending?.fail(new Error("turnstile")); pending = null; },
  });
  return {
    token: () => new Promise<string>((ok, fail) => {
      pending = { ok, fail };
      try { ts.reset(id); ts.execute(id); } catch { pending = null; fail(new Error("turnstile")); }
    }),
    destroy: () => { try { ts.remove(id); } catch { /* already gone */ } },
  };
}
