// Visual-QA helpers, compiled in ONLY when VITE_INTRO_DEBUG=1 (dead code in production builds).
import type { Meal } from "./store";
export const DEBUG = import.meta.env.VITE_INTRO_DEBUG === "1";
const q = () => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search));
export const dbg = (k: string) => DEBUG && q().has(k);
export const dbgVal = (k: string) => (DEBUG ? q().get(k) : null);
export function demoMeals(): Meal[] {
  const at = (h: number, m: number) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };
  return [
    { id: "d1", name: "Oats, banana & laban", kcal: 420, protein: 22, carbs: 64, fat: 9, at: at(8, 10) },
    { id: "d2", name: "كبسة دجاج", kcal: 610, protein: 38, carbs: 72, fat: 18, at: at(13, 30) },
    { id: "d3", name: "Greek yogurt + dates", kcal: 210, protein: 14, carbs: 30, fat: 4, at: at(17, 5) },
  ];
}
