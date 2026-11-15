import i18n from "i18next";
import { initReactI18next } from "react-i18next";
const resources = {
  ar: { translation: { app: "قوام", tagline: "صحة · غذاء · رياضة", hello: "أهلاً بك في قوام", toggle: "English", disclaimer: "للتثقيف فقط وليس نصيحة طبية." } },
  en: { translation: { app: "Qawam", tagline: "Health · Nutrition · Fitness", hello: "Welcome to Qawam", toggle: "العربية", disclaimer: "For education only, not medical advice." } },
} as const;
export type Lang = "ar" | "en";
export function applyLang(l: Lang) {
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  try { localStorage.setItem("lang", l); } catch { /* ignore */ }
}
let saved: Lang = "ar";
try { const s = localStorage.getItem("lang"); if (s === "en" || s === "ar") saved = s; } catch { /* ignore */ }
i18n.use(initReactI18next).init({ resources, lng: saved, fallbackLng: "ar", interpolation: { escapeValue: false } });
applyLang(saved);
export default i18n;
