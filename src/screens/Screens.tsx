import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Btn, Card, Screen, Skeleton } from "../app/ui";
import { useApp } from "../lib/store";

function Empty({ text, cta, to }: { text: string; cta?: string; to?: string }) {
  return (
    <Card className="flex flex-col items-start gap-3">
      <p className="m-0">{text}</p>
      {cta && to && (
        <Link to={to} className="inline-flex min-h-11 min-w-11 items-center rounded-xl bg-primary px-4 font-medium text-onprimary no-underline">{cta}</Link>
      )}
    </Card>
  );
}
// Mock loading toggle so the skeleton state is reviewable.
function WithLoading({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  return (
    <>
      {loading ? <Skeleton /> : children}
      <Btn variant="secondary" className="mt-3" aria-pressed={loading} onClick={() => setLoading((v) => !v)}>{t("showLoading")}</Btn>
    </>
  );
}

export function Today() {
  const { t } = useTranslation();
  return <Screen title={t("screens.today")}><WithLoading><Empty text={t("empty.today")} cta={t("empty.logCta")} to="/log" /></WithLoading></Screen>;
}
export function Log() {
  const { t } = useTranslation();
  const offline = useApp((s) => s.offline);
  const [tab, setTab] = useState<"text" | "photo" | "manual">("text");
  const tabs = ["text", "photo", "manual"] as const;
  return (
    <Screen title={t("screens.log")}>
      <div role="tablist" aria-label={t("log.tabs")} className="mb-3 flex gap-2">
        {tabs.map((k) => {
          const disabled = offline && k !== "manual";
          return (
            <button key={k} role="tab" type="button" aria-selected={tab === k} disabled={disabled} onClick={() => setTab(k)}
              className={`min-h-11 min-w-11 flex-1 rounded-xl border border-line px-3 font-medium ${tab === k ? "bg-primary text-onprimary" : "bg-transparent text-fg"}`}>
              {t(`log.${k}`)}
            </button>
          );
        })}
      </div>
      <Card>
        <p className="m-0" role="tabpanel">{t(`log.${tab}`)}</p>
        {offline && tab !== "manual" && <p className="mb-0 mt-2 text-sm text-accent">{t("log.aiOff")}</p>}
      </Card>
    </Screen>
  );
}
export function Workouts() {
  const { t } = useTranslation();
  return <Screen title={t("screens.workouts")}><WithLoading><Empty text={t("empty.workouts")} /></WithLoading></Screen>;
}
export function Progress() {
  const { t } = useTranslation();
  return <Screen title={t("screens.progress")}><WithLoading><Empty text={t("empty.progress")} cta={t("empty.progressCta")} to="/progress" /></WithLoading></Screen>;
}
export function More() {
  const { t } = useTranslation();
  const items = ["settings", "reminders", "ramadan", "export", "restore", "install", "del"] as const;
  return (
    <Screen title={t("screens.more")}>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((k) => (
          <li key={k}>
            <Card className="flex min-h-11 items-center justify-between">
              <span>{t(`more.${k}`)}</span><span className="text-sm">{t("more.soon")}</span>
            </Card>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
