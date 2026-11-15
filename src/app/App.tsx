import { useEffect } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Today, Log, Workouts, Progress, More } from "../screens/Screens";
import { Onboarding } from "../onboarding/Onboarding";
import { useApp } from "../lib/store";

export function App() {
  const onboarded = useApp((s) => s.onboarded);
  const setOffline = useApp((s) => s.setOffline);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [setOffline]);
  if (!onboarded) return <Onboarding />;
  return (
    <>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/log" element={<Log />} />
        <Route path="/workouts" element={<Workouts />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/more" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  );
}
