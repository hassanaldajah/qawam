import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { ar, en } from "./strings";
const resources = { ar: { translation: ar }, en: { translation: en } };
export type Lang = "ar" | "en";
export function applyLang(l: Lang) {
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  try { localStorage.setItem("lang", l); } catch { /* ignore */ }
}
let saved: Lang = "ar";
try { const s = localStorage.getItem("lang"); if (s === "en" || s === "ar") saved = s; } catch { /* ignore */ }
i18n.use(initReactI18next).init({ resources, lng: saved, fallbackLng: "ar", interpolation: { escapeValue: false } });
if (typeof document !== "undefined") applyLang(saved);
export default i18n;
