import { create } from "zustand";
import { evaluate, type Goal } from "./plan";
import { api } from "./api";
import { DEBUG, dbg, demoMeals } from "./debug";

// Session lives in an HttpOnly cookie (server). Locally we keep only non-secret, user-owned
// conveniences (goal numbers, today's manual meals, water). The backup code is memory-only.
export type Status = "checking" | "anon" | "authed";
export type Theme = "system" | "light" | "dark";
export interface Meal { id: string; name: string; kcal: number; protein: number; carbs: number; fat: number; at: number }

const K = { goal: "qawam.goal", meals: "qawam.meals", water: "qawam.water", theme: "qawam.theme" };
const read = <T,>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const clearLocal = () => { try { for (const k of [K.goal, K.meals, K.water]) localStorage.removeItem(k); } catch { /* ignore */ } };
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const DEFAULT_GOAL: Goal = { current: 80, target: 75, heightCm: 170, age: 30, sex: "m", activity: 1.55, weeks: 12, pregnant: false, medical: false };

interface S {
  status: Status; offline: boolean; hasBackupCode: boolean; backupCodeResetAt: number | null;
  draft: Goal; goal: Goal | null; issuedCode: string | null; theme: Theme;
  meals: Record<string, Meal[]>; water: Record<string, number>;
  checkSession: () => Promise<void>;
  setDraft: <K extends keyof Goal>(k: K, v: Goal[K]) => void;
  setAuthed: (hasCode: boolean) => void;
  setIssuedCode: (c: string | null) => void;
  completeOnboarding: () => void;
  signedOut: () => void;
  addMeal: (m: Omit<Meal, "id" | "at">) => void;
  removeMeal: (id: string) => void;
  addWater: (d: number) => void;
  setTheme: (t: Theme) => void;
  setOffline: (v: boolean) => void;
}

export const applyTheme = (t: Theme) => {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", t);
  const dark = t === "dark" || (t === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (t === "system") { m.setAttribute("content", m.getAttribute("media")?.includes("dark") ? "#0B1222" : "#F4F7F8"); return; }
    m.setAttribute("content", dark ? "#0B1222" : "#F4F7F8");
  });
};

export const useApp = create<S>((set, get) => ({
  status: "checking",
  offline: typeof navigator !== "undefined" && navigator.onLine === false,
  hasBackupCode: false, backupCodeResetAt: null,
  draft: read<Goal>(K.goal, DEFAULT_GOAL), goal: read<Goal | null>(K.goal, null), issuedCode: null,
  theme: read<Theme>(K.theme, "system"),
  meals: read<Record<string, Meal[]>>(K.meals, {}), water: read<Record<string, number>>(K.water, {}),
  checkSession: async () => {
    if (DEBUG && dbg("demo")) {
      const days: Record<string, Meal[]> = {};
      for (let i = 1; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); days[dayKey(d)] = [{ id: "w" + i, name: "x", kcal: 1500 + ((i * 137) % 600), protein: 0, carbs: 0, fat: 0, at: d.getTime() }]; }
      days[dayKey()] = demoMeals();
      set({ status: "authed", hasBackupCode: true, goal: DEFAULT_GOAL, meals: days, water: { [dayKey()]: 5 } });
      return;
    }
    try {
      const s = await api.session();
      set({ status: s.authenticated ? "authed" : "anon", hasBackupCode: !!s.hasBackupCode, backupCodeResetAt: s.backupCodeResetAt ?? null });
    } catch { set({ status: "anon" }); }
  },
  setDraft: (k, v) => set((p) => ({ draft: { ...p.draft, [k]: v } })),
  setAuthed: (hasBackupCode) => set({ status: "authed", hasBackupCode }),
  setIssuedCode: (issuedCode) => set({ issuedCode }),
  completeOnboarding: () => {
    const g = get().draft;
    if (evaluate(g).ok) { write(K.goal, g); set({ goal: g }); }
    set({ issuedCode: null, status: "authed", hasBackupCode: true });
  },
  signedOut: () => { clearLocal(); set({ status: "anon", goal: null, meals: {}, water: {}, issuedCode: null, hasBackupCode: false, draft: DEFAULT_GOAL }); },
  addMeal: (m) => {
    const k = dayKey();
    const meal: Meal = { ...m, id: crypto.randomUUID(), at: Date.now() };
    const meals = { ...get().meals, [k]: [...(get().meals[k] ?? []), meal] };
    // keep 14 days locally
    const keep = Object.keys(meals).sort().slice(-14);
    const trimmed = Object.fromEntries(keep.map((d) => [d, meals[d]!]));
    write(K.meals, trimmed); set({ meals: trimmed });
  },
  removeMeal: (id) => {
    const k = dayKey();
    const meals = { ...get().meals, [k]: (get().meals[k] ?? []).filter((m) => m.id !== id) };
    write(K.meals, meals); set({ meals });
  },
  addWater: (d) => {
    const k = dayKey();
    const v = Math.max(0, Math.min(20, (get().water[k] ?? 0) + d));
    const water = { ...get().water, [k]: v };
    write(K.water, water); set({ water });
  },
  setTheme: (theme) => { write(K.theme, theme); applyTheme(theme); set({ theme }); },
  setOffline: (offline) => set({ offline }),
}));
