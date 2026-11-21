import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BottomNav } from "./BottomNav";
import { Today, Log, Workouts, Progress, More, DeleteAccount } from "../screens/Screens";
import { Onboarding } from "../onboarding/Onboarding";
import { Restore } from "../onboarding/Restore";
import { Privacy, Terms } from "../landing/Legal";
import { QawamMark } from "../brand/QawamMark";
import { applyTheme, useApp } from "../lib/store";

// Landing (with its fx and styles) is split out so the signed-in app stays small.
const Landing = lazy(() => import("../landing/Landing").then((m) => ({ default: m.Landing })));

function Scene() {
  return (
    <div className="scene" aria-hidden="true">
      <div className="ribbon r1" /><div className="ribbon r2" /><div className="ribbon r3" />
    </div>
  );
}

function Splash() {
  const { t } = useTranslation();
  return (
    <div className="splash" role="status" aria-label={t("loading")}>
      <QawamMark width={132} />
      <div className="bar-load" aria-hidden="true" />
    </div>
  );
}

/** The intro splash stays ~1.8s on the first load of a session so the running mark is seen; never on later loads. */
const INTRO_MS = 1800;
function useIntroHold() {
  const [hold, setHold] = useState(() => {
    try { return !sessionStorage.getItem("qawam.intro") && !matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  });
  useEffect(() => {
    if (!hold) return;
    try { sessionStorage.setItem("qawam.intro", "1"); } catch { /* private mode */ }
    const id = window.setTimeout(() => setHold(false), INTRO_MS);
    return () => window.clearTimeout(id);
  }, [hold]);
  return hold;
}

const TAB_PATHS = new Set(["/", "/log", "/workouts", "/progress", "/more"]);

export function App() {
  const { t, i18n } = useTranslation();
  const status = useApp((s) => s.status);
  const theme = useApp((s) => s.theme);
  const checkSession = useApp((s) => s.checkSession);
  const setOffline = useApp((s) => s.setOffline);
  const loc = useLocation();
  const first = useRef(true);
  const hold = useIntroHold();

  useEffect(() => { void checkSession(); }, [checkSession]);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { document.title = t("meta.title"); }, [t, i18n.language]);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [setOffline]);
  // Route change: scroll to top and move focus to the new page (screen readers announce it).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (loc.hash) return;
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [loc.pathname, loc.hash]);

  const authed = status === "authed";
  const showNav = authed && TAB_PATHS.has(loc.pathname);

  return (
    <>
      <Scene />
      {status === "checking" || hold ? <Splash /> : (
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/start/*" element={<Onboarding />} />
            <Route path="/restore" element={<Restore />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/welcome" element={<Landing />} />
            {authed ? (
              <>
                <Route path="/" element={<Today />} />
                <Route path="/log" element={<Log />} />
                <Route path="/workouts" element={<Workouts />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/more" element={<More />} />
                <Route path="/more/delete" element={<DeleteAccount />} />
              </>
            ) : (
              <Route path="/" element={<Landing />} />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          {showNav && <BottomNav />}
        </Suspense>
      )}
    </>
  );
}
