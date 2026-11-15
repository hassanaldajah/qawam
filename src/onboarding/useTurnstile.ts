import { useEffect, useRef, useState } from "react";
import { mountTurnstile, siteKey, type Widget } from "../lib/turnstile";

/** Mounts Turnstile into the returned ref when enabled. state: missing key / loading / ready / failed. */
export function useTurnstile(action: "create" | "restore", lang: string, enabled = true) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<Widget | null>(null);
  const [state, setState] = useState<"missing" | "loading" | "ready" | "failed">(siteKey() ? "loading" : "missing");
  useEffect(() => {
    if (!enabled || !siteKey() || !box.current) return;
    let alive = true;
    setState("loading");
    mountTurnstile(box.current, action, lang)
      .then((w) => { if (alive) { widget.current = w; setState("ready"); } else w.destroy(); })
      .catch(() => alive && setState("failed"));
    return () => { alive = false; widget.current?.destroy(); widget.current = null; };
  }, [action, lang, enabled]);
  return { box, state, token: () => (widget.current ? widget.current.token() : Promise.reject(new Error("turnstile"))) };
}
