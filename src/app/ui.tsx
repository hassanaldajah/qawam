import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, WifiOff, TriangleAlert, CircleCheck, Info } from "lucide-react";
import { useApp } from "../lib/store";
import { setLang } from "../i18n";
import { QawamMark } from "../brand/QawamMark";

export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean; busy?: boolean; icon?: ReactNode };

export const btnClass = (variant: Variant = "primary", size: Size = "md", block = false, extra = "") =>
  `btn btn-${variant} ${size !== "md" ? `btn-${size}` : ""} ${block ? "btn-block" : ""} ${extra}`.replace(/\s+/g, " ").trim();

/** One button for the whole app. Busy = aria-busy + sweeping bar (no spinner), click blocked. */
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", size = "md", block, busy, icon, className = "", children, disabled, onClick, ...p }, ref) {
  return (
    <button ref={ref} type="button" {...p} className={btnClass(variant, size, block, className)}
      disabled={disabled} aria-busy={busy || undefined} aria-disabled={busy || undefined}
      onClick={busy ? (e) => e.preventDefault() : onClick}>
      {icon}<span className="btn-label">{children}</span>
    </button>
  );
});
/** Kept for older imports. */
export const Btn = Button;

export function ButtonLink({ to, variant = "primary", size = "md", block, icon, children, className = "" }:
  { to: string; variant?: Variant; size?: Size; block?: boolean; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <Link to={to} className={btnClass(variant, size, block, className)}>{icon}<span className="btn-label">{children}</span></Link>;
}

/** Visible back control: 44px, aria-label, arrow mirrors in RTL. Uses history when we came from inside the app. */
export function BackButton({ fallback = "/", onBack }: { fallback?: string; onBack?: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const go = () => {
    if (onBack) return onBack();
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0 && loc.key !== "default") nav(-1); else nav(fallback, { replace: true });
  };
  return (
    <button type="button" className="icon-btn" aria-label={t("a11y.back")} title={t("a11y.back")} onClick={go}>
      <ArrowLeft aria-hidden="true" size={22} className="icon-dir" />
    </button>
  );
}

export function Logo({ size = 38, withText = true, to = "/", motion = "hover" }: { size?: number; withText?: boolean; to?: string; motion?: "run" | "hover" | "none" }) {
  const { t } = useTranslation();
  return (
    <Link to={to} className="brand" aria-label={t("a11y.home")}>
      <QawamMark width={size} motion={motion} />
      {withText && <span aria-hidden="true">{t("app")}</span>}
    </Link>
  );
}

export function LangToggle() {
  const { t, i18n } = useTranslation();
  const next = i18n.language === "ar" ? "en" : "ar";
  return (
    <button type="button" className="icon-btn" lang={next} aria-label={t("a11y.switchLang")} title={t("a11y.switchLang")}
      onClick={() => setLang(next)}>
      <span aria-hidden="true" className="text-sm font-extrabold">{next === "ar" ? "ع" : "EN"}</span>
    </button>
  );
}

export function AppBar({ title, back, actions }: { title?: string; back?: string | false; actions?: ReactNode }) {
  return (
    <header className="appbar">
      <div className="appbar-in">
        {back !== undefined && back !== false ? <BackButton fallback={back} /> : <Logo withText={!title} to="/" />}
        {title ? <p className="appbar-title" aria-hidden="true">{title}</p> : <span className="spacer" />}
        {actions}
        <LangToggle />
      </div>
    </header>
  );
}

export function Card({ children, className = "", hue, as: As = "div", ...p }: { children: ReactNode; className?: string; hue?: string; as?: "div" | "section" | "article" | "li"; "aria-labelledby"?: string; "aria-label"?: string }) {
  return <As className={`card ${hue ? `card-glow c-${hue}` : ""} ${className}`} {...p}>{children}</As>;
}

export function Notice({ kind = "warn", children, role }: { kind?: "warn" | "ok" | "info"; children: ReactNode; role?: "alert" | "status" }) {
  const I = kind === "ok" ? CircleCheck : kind === "info" ? Info : TriangleAlert;
  return <div className={`alert ${kind === "warn" ? "" : kind}`} role={role}><I aria-hidden="true" size={20} /><div>{children}</div></div>;
}

export function OfflineBanner() {
  const { t } = useTranslation();
  const offline = useApp((s) => s.offline);
  if (!offline) return null;
  return (
    <div role="status" className="alert info banner"><WifiOff aria-hidden="true" size={20} /><span><strong>{t("offline")}.</strong> {t("offlineBanner")}</span></div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" aria-label={t("loading")} className="stack">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
    </div>
  );
}

/** App page: app bar + main landmark + disclaimer. */
export function Screen({ title, sub, back, actions, children, hideTitle }: { title: string; sub?: string; back?: string; actions?: ReactNode; children: ReactNode; hideTitle?: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <AppBar title={back ? title : undefined} back={back} actions={actions} />
      <main id="main" className="page route" tabIndex={-1}>
        <OfflineBanner />
        <h1 className={hideTitle ? "sr-only" : "page-h"}>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
        {children}
        <p className="mt-8 text-center text-xs muted">{t("disclaimer")}</p>
      </main>
    </>
  );
}

/** Progress ring: starts at top, clockwise in LTR, counter-clockwise in RTL; role=progressbar. */
export function Ring({ value, max, hue = "teal", size = 96, stroke = 9, label, unit, display, glow, valueClass = "text-xl" }:
  { value: number; max: number; hue?: string; size?: number; stroke?: number; label: string; unit?: string; display?: ReactNode; glow?: boolean; valueClass?: string }) {
  const gid = useId().replace(/:/g, "");
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className={`ring-wrap c-${hue}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="rtl:-scale-x-100">
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="s-hue" /><stop offset="1" className={hue === "teal" ? "s-lime" : "s-hue"} />
          </linearGradient>
        </defs>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
          <circle className={`ring-fill ${glow ? "ring-glow" : ""}`} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#g${gid})`} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={pct === 0 ? c - 0.001 : c * (1 - pct)} />
        </g>
      </svg>
      <div className="ring-center">
        <bdi className={`ring-val ${valueClass}`}>{display ?? value}</bdi>
        {unit && <span className="ring-unit">{unit}</span>}
      </div>
    </div>
  );
}

/** Linear bar (SVG attributes only, CSP-safe). */
export function Bar({ label, value, max, hue, unit = "g" }: { label: string; value: number; max: number; hue: string; unit?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`bar c-${hue}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="bar-top"><span className="row gap-2"><span className="dot" aria-hidden="true" />{label}</span>
        <bdi className="num">{value} / {max} {unit}</bdi></div>
      <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" className="rtl:-scale-x-100">
        <rect className="bar-track" x="0" y="0" width="100" height="8" rx="4" />
        <rect className="bar-fill" x="0" y="0" width={pct} height="8" rx="4" />
      </svg>
    </div>
  );
}

type NumProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { label: string; value: number; onChange: (n: number) => void; unit?: string; hint?: string; errorId?: string };
export function NumField({ label, value, onChange, unit, hint, errorId, name, ...p }: NumProps) {
  const id = useId();
  const hintId = hint ? `${id}-h` : undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      <div className="input-unit">
        <input id={id} name={name} type="number" inputMode="decimal" autoComplete="off" className="input num"
          value={Number.isFinite(value) ? value : ""} aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} {...p} />
        {unit && <span className="unit" aria-hidden="true">{unit}</span>}
      </div>
      {hint && <span id={hintId} className="hint">{hint}</span>}
    </div>
  );
}

export function Check({ label, checked, onChange, describedBy, name }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; describedBy?: string; name?: string }) {
  return (
    <label className="check">
      <input type="checkbox" name={name} checked={checked} aria-describedby={describedBy} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Small inline illustrations for empty states (decorative). */
export function EmptyArt({ kind }: { kind: "plate" | "dumbbell" | "chart" }) {
  return (
    <svg className="empty-art" viewBox="0 0 160 110" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="80" cy="98" rx="52" ry="6" className="f-primary" opacity=".12" />
      {kind === "plate" && <>
        <circle cx="80" cy="56" r="38" className="f-card2 k-bstrong" strokeWidth="2" />
        <circle cx="80" cy="56" r="26" className="k-primary" strokeWidth="2" strokeDasharray="4 6" />
        <path d="M70 52c4-8 16-8 20 0M66 62c8 6 20 6 28 0" className="k-lime" strokeWidth="3" />
        <path d="M30 26v26m-5-26v12m10-12v12M128 26c6 4 6 18 0 22v12" className="k-muted" strokeWidth="2.5" />
      </>}
      {kind === "dumbbell" && <>
        <rect x="28" y="38" width="16" height="38" rx="5" className="f-primary" />
        <rect x="116" y="38" width="16" height="38" rx="5" className="f-primary" />
        <rect x="16" y="46" width="10" height="22" rx="4" className="f-lime" />
        <rect x="134" y="46" width="10" height="22" rx="4" className="f-lime" />
        <path d="M44 57h72" className="k-bstrong" strokeWidth="6" />
        <path d="M70 20l6 8M80 16v10M90 20l-6 8" className="k-coral" strokeWidth="2.5" />
      </>}
      {kind === "chart" && <>
        <path d="M24 86h112" className="k-bstrong" strokeWidth="2" />
        <rect x="34" y="60" width="14" height="26" rx="4" className="f-border" />
        <rect x="58" y="48" width="14" height="38" rx="4" className="f-border" />
        <rect x="82" y="54" width="14" height="32" rx="4" className="f-border" />
        <rect x="106" y="34" width="14" height="52" rx="4" className="f-primary" />
        <path d="M30 40c20-14 40 4 58-8s28-10 40-18" className="k-lime" strokeWidth="3" />
      </>}
    </svg>
  );
}
