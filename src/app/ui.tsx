import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { WifiOff } from "lucide-react";
import { useApp } from "../lib/store";

export function Btn({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const v = variant === "primary" ? "cta" : "border border-line bg-transparent text-fg";
  return <button type="button" {...p} className={`min-h-11 min-w-11 rounded-full px-5 text-base font-bold ${v} ${className}`} />;
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card-pop rise rounded-3xl border border-line bg-card p-4 shadow-sm ${className}`}>{children}</div>;
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
      <h1 className="mb-4 text-3xl font-extrabold tracking-tight">{title}</h1>
      {children}
      <p className="mt-6 text-center text-xs">{t("disclaimer")}</p>
    </main>
  );
}

/** Progress ring: starts at top, value in center, role=progressbar, mirrored in RTL. */
export function Ring({ value, max, color, size = 96, label, unit, big = false }: { value: number; max: number; color: string; size?: number; label: string; unit?: string; big?: boolean }) {
  const stroke = 8, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden="true" className="rtl:-scale-x-100">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth={stroke} />
            <circle className="ring-fill" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} style={{ color }} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <bdi className={big ? "stat neon-num text-4xl" : "text-xl font-extrabold"}>{value}</bdi>
          {unit && <span className="text-xs">{unit}</span>}
        </div>
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
