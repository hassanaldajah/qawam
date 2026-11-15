import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { reducedMotion } from "../lib/fx";

const KEY = "qawam.intro";
export function shouldPlayIntro(): boolean {
  if (typeof window === "undefined") return false;
  if (!["/", "/welcome"].includes(window.location.pathname)) return false;
  if (debugFrame() !== undefined) return true;
  if (import.meta.env.VITE_INTRO_DEBUG === "1" && new URLSearchParams(window.location.search).has("nointro")) return false;
  try { return sessionStorage.getItem(KEY) !== "1"; } catch { return true; }
}
const markPlayed = () => { try { sessionStorage.setItem(KEY, "1"); } catch { /* blocked storage: plays again next load */ } };
/** Debug only (`VITE_INTRO_DEBUG=1` builds): ?intro-frame=<seconds> freezes the intro on a frame. */
function debugFrame(): number | undefined {
  if (import.meta.env.VITE_INTRO_DEBUG !== "1") return undefined;
  const v = new URLSearchParams(window.location.search).get("intro-frame");
  return v === null ? undefined : Math.max(0, Number(v) || 0);
}

/** Cinematic intro: logo SVG paints instantly, Three.js chunk loads lazily, then wipe. */
export function Intro({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const skipBtn = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<"logo" | "run" | "word" | "out">("logo");
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true; markPlayed(); onDone();
  };
  const wipe = () => { setPhase("out"); window.setTimeout(finish, 700); };

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    const frame = debugFrame();
    skipBtn.current?.focus({ preventScroll: true });
    if (reducedMotion() && frame === undefined) {
      const id = window.setTimeout(() => { setPhase("out"); window.setTimeout(finish, 500); }, 900);
      return () => window.clearTimeout(id);
    }
    const fallback = window.setTimeout(() => { if (!cancelled && phase === "logo") wipe(); }, 6000);
    import("../three/introScene").then(({ startIntro }) => {
      if (cancelled || !canvas.current) return;
      try {
        const ctl = startIntro(canvas.current, { onWord: () => setPhase("word"), onOut: wipe, onDone: () => {} }, frame);
        stop = ctl.stop;
        window.clearTimeout(fallback);
        setPhase((p) => (p === "logo" ? "run" : p));
      } catch { wipe(); }
    }).catch(() => wipe());
    return () => { cancelled = true; window.clearTimeout(fallback); stop?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reduced = reducedMotion() && debugFrame() === undefined;
  return (
    <div ref={root} className={`intro ${phase === "out" ? (reduced ? "fade" : "out") : ""}`} role="dialog" aria-modal="true" aria-label={t("intro.label")}>
      <canvas ref={canvas} aria-hidden="true" />
      <img className={`intro-logo ${phase !== "logo" ? "hide" : ""}`} src="/logo-symbol.svg" alt="" width="220" height="187" />
      <img className={`intro-word ${phase === "word" || phase === "out" ? "show" : ""}`} src="/logo-lockup.svg" alt="" width="280" height="351" />
      <p className="sr-only" aria-live="polite">{t("intro.label")}</p>
      <button ref={skipBtn} type="button" className="btn btn-secondary btn-sm intro-skip" onClick={wipe}>{t("intro.skip")}</button>
    </div>
  );
}
