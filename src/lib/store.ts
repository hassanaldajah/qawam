import { create } from "zustand";
// Mock-only state; no network, nothing persisted (backup code is never stored).
interface S { onboarded: boolean; offline: boolean; finish: () => void; setOffline: (v: boolean) => void }
export const useApp = create<S>((set) => ({
  onboarded: false,
  offline: typeof navigator !== "undefined" && navigator.onLine === false,
  finish: () => set({ onboarded: true }),
  setOffline: (offline) => set({ offline }),
}));
