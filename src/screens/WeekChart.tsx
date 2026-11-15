import { useId } from "react";
import { useTranslation } from "react-i18next";

/** 7-day bar chart (SVG) with a target line and a text alternative. Oldest at the start side (mirrors in RTL). */
export function WeekChart({ days: input, target }: { days: { label: string; value: number; today?: boolean }[]; target: number }) {
  const { t, i18n } = useTranslation();
  const days = i18n.dir() === "rtl" ? [...input].reverse() : input;
  const descId = useId();
  const W = 320, H = 170, top = 14, bottom = 26, left = 6, right = 6;
  const max = Math.max(target * 1.2, ...days.map((d) => d.value), 1);
  const ch = H - top - bottom, bw = (W - left - right) / days.length;
  const y = (v: number) => top + ch - (v / max) * ch;
  const any = days.some((d) => d.value > 0);
  return (
    <figure className="m-0">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={descId}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0" className="s-teal" /><stop offset="1" className="s-lime" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} className="chart-grid" x1={left} x2={W - right} y1={top + ch * (1 - f)} y2={top + ch * (1 - f)} />)}
        {days.map((d, i) => {
          const x = left + i * bw + bw * 0.22, w = bw * 0.56;
          const v = d.value > 0 ? d.value : max * 0.18;
          return <rect key={i} className={d.value > 0 ? "chart-bar" : "chart-ghost"} x={x} y={y(v)} width={w} height={top + ch - y(v)} rx="6" />;
        })}
        {target > 0 && <line className="chart-target" x1={left} x2={W - right} y1={y(target)} y2={y(target)} />}
        {days.map((d, i) => (
          <text key={i} className={`chart-lbl ${d.today ? "chart-today" : ""}`} x={left + i * bw + bw / 2} y={H - 8} textAnchor="middle">{d.label}</text>
        ))}
      </svg>
      <figcaption id={descId} className="sr-only">
        {t("chart.summary", { target })} {any ? input.map((d) => `${d.label}: ${d.value}`).join("، ") : t("chart.none")}
      </figcaption>
    </figure>
  );
}
