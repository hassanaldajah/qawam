import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { WifiOff } from "lucide-react";
import { useApp } from "../lib/store";

export function Btn({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const v = variant === "primary" ? "bg-primary text-onprimary" : "border border-line bg-transparent text-fg";
  return <button type="button" {...p} className={`min-h-11 min-w-11 rounded-xl px-4 text-base font-medium ${v} ${className}`} />;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</div>;
}
export function OfflineBanner() {
  const { t } = useTranslation();
  const offline = useApp((s) => s.offline);
  if (!offline) return null;
  return (
    <div role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-card p-3 text-sm text-accent">
      <WifiOff aria-hidden="true" size={20} /> <span><strong>{t("offline")}.</strong> {t("offlineBanner")}</span>
    </div>
  );
}
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-16" />)}
    </div>
  );
}
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <OfflineBanner />
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      {children}
      <p className="mt-6 text-center text-xs">{t("disclaimer")}</p>
    </main>
  );
}
