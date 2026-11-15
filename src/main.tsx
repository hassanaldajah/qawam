import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import i18n, { applyLang, type Lang } from "./i18n";
import { useTranslation } from "react-i18next";

function App() {
  const { t } = useTranslation();
  const next: Lang = i18n.language === "ar" ? "en" : "ar";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-4 text-center">
      <img src="/logo-lockup.svg" alt={t("app")} className="w-48" />
      <h1 className="text-2xl font-bold">{t("hello")}</h1>
      <p className="opacity-80">{t("tagline")}</p>
      <button className="min-h-11 rounded-xl bg-primary px-6 font-semibold text-onprimary"
        onClick={() => { i18n.changeLanguage(next); applyLang(next); }}>{t("toggle")}</button>
      <p className="text-sm opacity-70">{t("disclaimer")}</p>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
