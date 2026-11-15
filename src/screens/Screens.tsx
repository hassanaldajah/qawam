import { useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Droplets, Footprints, Flame, Minus, Plus, Trash2, Target, ChevronRight, LogOut, FileDown, KeyRound, Languages, Sun, Moon, Monitor, Shield, ScrollText, Bell, MoonStar, Smartphone, TriangleAlert } from "lucide-react";
import { Bar, Button, ButtonLink, Card, Check, EmptyArt, Notice, NumField, Ring, Screen } from "../app/ui";
import { dayKey, useApp, type Theme } from "../lib/store";
import { evaluate } from "../lib/plan";
import { api } from "../lib/api";
import { setLang } from "../i18n";
import { errKey } from "../onboarding/Onboarding";
import { WeekChart } from "./WeekChart";

const fmtNum = (lang: string) => new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-latn" : "en");

function useTargets() {
  const goal = useApp((s) => s.goal);
  return useMemo(() => {
    if (!goal) return null;
    const p = evaluate(goal);
    const kcal = Math.max(0, p.kcal);
    const protein = Math.round(goal.current * 1.6);
    const fat = Math.round((kcal * 0.27) / 9);
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { kcal, protein, fat, carbs, pct: p.pctPerWeek };
  }, [goal]);
}

function ResetBanner() {
  const { t } = useTranslation();
  const at = useApp((s) => s.backupCodeResetAt);
  if (!at) return null;
  return <div className="banner"><Notice role="status">{t("more.resetBanner")}</Notice></div>;
}

export function Today() {
  const { t, i18n } = useTranslation();
  const T = (k: string) => t(`today.${k}`);
  const targets = useTargets();
  const meals = useApp((s) => s.meals);
  const water = useApp((s) => s.water[dayKey()] ?? 0);
  const addWater = useApp((s) => s.addWater);
  const removeMeal = useApp((s) => s.removeMeal);
  const today = meals[dayKey()] ?? [];
  const sum = today.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const nf = fmtNum(i18n.language);
  const target = targets?.kcal ?? 0;
  const left = Math.max(0, target - sum.kcal);
  const dateStr = new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-u-nu-latn" : "en", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const v = (meals[dayKey(d)] ?? []).reduce((a, m) => a + m.kcal, 0);
    return { label: new Intl.DateTimeFormat(i18n.language, { weekday: "narrow" }).format(d), value: v, today: i === 6 };
  });
  const timeFmt = new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-u-nu-latn" : "en", { hour: "numeric", minute: "2-digit" });

  return (
    <Screen title={t("screens.today")} sub={dateStr}>
      <ResetBanner />
      <div className="stack">
        {!targets && (
          <Card hue="coral" className="row between">
            <span className="row gap-3"><span className="icon-tile c-coral"><Target size={20} aria-hidden="true" /></span><span>{t("today.noGoal")}</span></span>
            <ButtonLink to="/start/goal" size="sm" variant="secondary">{t("today.setGoal")}</ButtonLink>
          </Card>
        )}
        <section aria-labelledby="kcal-h" className="hero-card">
          <h2 id="kcal-h" className="sr-only">{T("kcal")}</h2>
          <div className="hero-grid">
            <Ring size={148} stroke={12} glow value={sum.kcal} max={target || 1} hue="teal" label={T("kcal")} unit={T("kcalUnit")} valueClass="text-3xl" display={nf.format(sum.kcal)} />
            <div className="hero-stats">
              <div><div className="stat-big">{nf.format(left)}</div><div className="stat-label muted-on-dark">{T("left")}</div></div>
              <div className="row gap-2 text-sm muted-on-dark"><Target size={16} aria-hidden="true" /><bdi className="num">{T("target")}: {nf.format(target)}</bdi></div>
              {targets && <div className="row gap-2 text-sm muted-on-dark"><Flame size={16} aria-hidden="true" /><bdi className="num">{t("today.pace", { pct: targets.pct })}</bdi></div>}
            </div>
          </div>
        </section>

        <Card as="section" aria-labelledby="mac-h" className="stack">
          <h2 id="mac-h" className="section-h m-0">{T("macros")}</h2>
          <Bar label={T("protein")} value={Math.round(sum.protein)} max={targets?.protein ?? 0} hue="teal" unit={T("g")} />
          <Bar label={T("carbs")} value={Math.round(sum.carbs)} max={targets?.carbs ?? 0} hue="coral" unit={T("g")} />
          <Bar label={T("fat")} value={Math.round(sum.fat)} max={targets?.fat ?? 0} hue="lime" unit={T("g")} />
        </Card>

        <div className="mini-grid">
          <Card hue="sky" className="metric c-sky">
            <span className="row gap-2 font-bold text-sm"><span className="icon-tile c-sky"><Droplets size={20} aria-hidden="true" /></span>{T("water")}</span>
            <div className="metric-v" aria-live="polite"><bdi>{nf.format(water)}/8</bdi> <span className="text-sm muted">{T("cups")}</span></div>
            <div className="water-cups" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} className={`cup ${i < water ? "full" : ""}`} />)}</div>
            <div className="row gap-2">
              <button type="button" className="icon-btn" aria-label={T("waterLess")} onClick={() => addWater(-1)} disabled={water <= 0}><Minus size={18} aria-hidden="true" /></button>
              <button type="button" className="icon-btn" aria-label={T("waterMore")} onClick={() => addWater(1)}><Plus size={18} aria-hidden="true" /></button>
            </div>
          </Card>
          <Card hue="pink" className="metric c-pink">
            <span className="row gap-2 font-bold text-sm"><span className="icon-tile c-pink"><Footprints size={20} aria-hidden="true" /></span>{T("steps")}</span>
            <div className="metric-v">—</div>
            <p className="m-0 text-sm muted">{T("stepsSoon")}</p>
          </Card>
        </div>

        <Card as="section" aria-labelledby="meals-h">
          <div className="section-h"><h2 id="meals-h" className="m-0 text-[1.0625rem] font-extrabold">{T("meals")}</h2>
            <ButtonLink to="/log" size="sm" variant="ghost" icon={<Plus size={18} aria-hidden="true" />}>{t("empty.logCta")}</ButtonLink></div>
          {today.length === 0 ? (
            <div className="stack items-center py-4 text-center">
              <EmptyArt kind="plate" />
              <p className="m-0 muted">{t("empty.today")}</p>
              <ButtonLink to="/log">{t("empty.logCta")}</ButtonLink>
            </div>
          ) : (
            <ul className="timeline">
              {today.slice().reverse().map((m) => (
                <li key={m.id}>
                  <span className="tl-time num">{timeFmt.format(m.at)}</span>
                  <span className="tl-name" dir="auto">{m.name}</span>
                  <bdi className="tl-kcal">{nf.format(m.kcal)} {T("kcalUnit")}</bdi>
                  <button type="button" className="icon-btn" aria-label={t("today.remove", { name: m.name })} onClick={() => removeMeal(m.id)}><Trash2 size={18} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="wk-h">
          <h2 id="wk-h" className="section-h">{T("week")}<span className="chip"><span className="dot c-coral" aria-hidden="true" />{T("target")}</span></h2>
          <WeekChart days={week} target={target} />
        </Card>
      </div>
    </Screen>
  );
}

export function Log() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const offline = useApp((s) => s.offline);
  const addMeal = useApp((s) => s.addMeal);
  const [tab, setTab] = useState<"text" | "photo" | "manual">(offline ? "manual" : "text");
  const tabs = ["text", "photo", "manual"] as const;
  const base = useId();
  const [m, setM] = useState({ name: "", kcal: NaN, protein: 0, carbs: 0, fat: 0 });
  const [confirmed, setConfirmed] = useState(false);
  const nameId = useId();
  const ok = m.name.trim().length > 0 && Number.isFinite(m.kcal) && m.kcal >= 0 && m.kcal <= 5000 && [m.protein, m.carbs, m.fat].every((v) => Number.isFinite(v) && v >= 0 && v <= 500);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const dir = document.documentElement.dir === "rtl" ? -d : d;
    const next = tabs[(i + dir + tabs.length) % tabs.length]!;
    if (offline && next !== "manual") return;
    setTab(next); document.getElementById(`${base}-tab-${next}`)?.focus();
  };
  return (
    <Screen title={t("screens.log")} sub={t("log.sub")}>
      <div role="tablist" aria-label={t("log.tabs")} className="seg mb-3">
        {tabs.map((k, i) => (
          <button key={k} id={`${base}-tab-${k}`} role="tab" type="button" aria-selected={tab === k} aria-controls={`${base}-panel`}
            tabIndex={tab === k ? 0 : -1} disabled={offline && k !== "manual"} onClick={() => setTab(k)} onKeyDown={(e) => onKey(e, i)}>
            {t(`log.${k}`)}
          </button>
        ))}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${tab}`}>
        {tab !== "manual" ? (
          <Card hue="teal" className="stack items-center py-6 text-center">
            <EmptyArt kind="plate" />
            <h2 className="m-0 text-lg font-extrabold">{t(`log.${tab}Title`)}</h2>
            <p className="m-0 muted">{t("log.aiSoon")}</p>
            {offline && <p className="m-0 text-sm text-accent">{t("log.aiOff")}</p>}
            <Button variant="secondary" onClick={() => setTab("manual")}>{t("log.useManual")}</Button>
          </Card>
        ) : (
          <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (!ok || !confirmed) return; addMeal({ ...m, name: m.name.trim() }); nav("/"); }} noValidate>
            <div className="field m-0">
              <label htmlFor={nameId} className="label">{t("log.name")}</label>
              <input id={nameId} name="meal-name" className="input" dir="auto" autoComplete="off" maxLength={80} required value={m.name}
                placeholder={t("log.namePh")} onChange={(e) => setM({ ...m, name: e.target.value })} />
            </div>
            <NumField name="kcal" label={t("today.kcal")} unit={t("today.kcalUnit")} inputMode="numeric" min={0} max={5000} value={m.kcal} onChange={(n) => setM({ ...m, kcal: n })} />
            <div className="grid grid-cols-3 gap-3">
              <NumField name="protein" label={t("today.protein")} unit={t("today.g")} min={0} max={500} value={m.protein} onChange={(n) => setM({ ...m, protein: n })} />
              <NumField name="carbs" label={t("today.carbs")} unit={t("today.g")} min={0} max={500} value={m.carbs} onChange={(n) => setM({ ...m, carbs: n })} />
              <NumField name="fat" label={t("today.fat")} unit={t("today.g")} min={0} max={500} value={m.fat} onChange={(n) => setM({ ...m, fat: n })} />
            </div>
            <Check name="confirm" label={t("confirm")} checked={confirmed} onChange={setConfirmed} />
            <Button type="submit" size="lg" block disabled={!ok || !confirmed}>{t("save")}</Button>
            <p className="m-0 text-xs muted">{t("log.localNote")}</p>
          </form>
        )}
      </div>
    </Screen>
  );
}

export function Workouts() {
  const { t } = useTranslation();
  return (
    <Screen title={t("screens.workouts")} sub={t("workouts.sub")}>
      <Card hue="pink" className="stack items-center py-8 text-center">
        <EmptyArt kind="dumbbell" />
        <h2 className="m-0 text-lg font-extrabold">{t("empty.workouts")}</h2>
        <p className="m-0 muted">{t("workouts.soon")}</p>
      </Card>
    </Screen>
  );
}

export function Progress() {
  const { t } = useTranslation();
  return (
    <Screen title={t("screens.progress")} sub={t("progress.sub")}>
      <Card hue="lime" className="stack items-center py-8 text-center">
        <EmptyArt kind="chart" />
        <h2 className="m-0 text-lg font-extrabold">{t("empty.progress")}</h2>
        <p className="m-0 muted">{t("progress.soon")}</p>
      </Card>
    </Screen>
  );
}

function Row({ icon, title, sub, to, onClick, busy, danger }: { icon: React.ReactNode; title: string; sub?: string; to?: string; onClick?: () => void; busy?: boolean; danger?: boolean }) {
  const inner = (<>{icon}<span className="grow"><span className={`t ${danger ? "text-accent" : ""}`}>{title}</span>{sub && <span className="s">{sub}</span>}</span><ChevronRight size={18} aria-hidden="true" className="icon-dir muted" /></>);
  return (
    <li>{to
      ? <Link to={to} className="list-item card card-glow c-teal">{inner}</Link>
      : <button type="button" className="list-item card card-glow c-teal" onClick={onClick} aria-busy={busy || undefined}>{inner}</button>}
    </li>
  );
}

export function More() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const signedOut = useApp((s) => s.signedOut);
  const [busy, setBusy] = useState<"" | "export" | "logout">("");
  const [msg, setMsg] = useState<{ k: string; ok: boolean } | null>(null);
  const themes: { k: Theme; I: typeof Sun }[] = [{ k: "system", I: Monitor }, { k: "light", I: Sun }, { k: "dark", I: Moon }];

  const doExport = async () => {
    setBusy("export"); setMsg(null);
    try {
      const data = await api.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `qawam-export-${dayKey()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg({ k: "more.exported", ok: true });
    } catch (e) { setMsg({ k: errKey(e), ok: false }); } finally { setBusy(""); }
  };
  const logout = async () => {
    setBusy("logout"); setMsg(null);
    try { await api.logout(); signedOut(); nav("/", { replace: true }); }
    catch (e) { setMsg({ k: errKey(e), ok: false }); setBusy(""); }
  };

  return (
    <Screen title={t("screens.more")}>
      <ResetBanner />
      <div className="stack">
        <Card as="section" aria-labelledby="ap-h" className="stack">
          <h2 id="ap-h" className="section-h m-0">{t("more.appearance")}</h2>
          <div className="field m-0"><span className="label" id="lang-l"><Languages size={16} aria-hidden="true" className="me-1 inline" />{t("more.language")}</span>
            <div className="seg" role="group" aria-labelledby="lang-l">
              {(["ar", "en"] as const).map((l) => <button key={l} type="button" lang={l} aria-pressed={i18n.language === l} onClick={() => setLang(l)}>{l === "ar" ? "العربية" : "English"}</button>)}
            </div></div>
          <div className="field m-0"><span className="label" id="theme-l">{t("more.theme")}</span>
            <div className="seg" role="group" aria-labelledby="theme-l">
              {themes.map(({ k, I }) => <button key={k} type="button" aria-pressed={theme === k} onClick={() => setTheme(k)}><span className="row justify-center gap-2"><I size={16} aria-hidden="true" />{t(`more.t_${k}`)}</span></button>)}
            </div></div>
        </Card>

        <section aria-labelledby="acc-h">
          <h2 id="acc-h" className="section-h">{t("more.account")}</h2>
          <ul className="list">
            <Row icon={<span className="icon-tile c-teal"><FileDown size={20} aria-hidden="true" /></span>} title={t("more.export")} sub={busy === "export" ? t("loading") : t("more.exportSub")} onClick={doExport} busy={busy === "export"} />
            <Row icon={<span className="icon-tile c-sky"><KeyRound size={20} aria-hidden="true" /></span>} title={t("more.restore")} sub={t("more.restoreSub")} to="/restore" />
            <Row icon={<span className="icon-tile c-lime"><LogOut size={20} aria-hidden="true" /></span>} title={t("more.logout")} sub={t("more.logoutSub")} onClick={logout} busy={busy === "logout"} />
            <Row icon={<span className="icon-tile c-coral"><Trash2 size={20} aria-hidden="true" /></span>} title={t("more.del")} sub={t("more.delSub")} to="/more/delete" danger />
          </ul>
          <div aria-live="polite" className="mt-3">{msg && <Notice kind={msg.ok ? "ok" : "warn"} role={msg.ok ? "status" : "alert"}>{t(msg.k)}</Notice>}</div>
        </section>

        <section aria-labelledby="soon-h">
          <h2 id="soon-h" className="section-h">{t("more.soonH")}</h2>
          <ul className="list">
            {([["reminders", Bell, "lime"], ["ramadan", MoonStar, "teal"], ["install", Smartphone, "sky"]] as const).map(([k, I, h]) => (
              <li key={k} className="list-item card"><span className={`icon-tile c-${h}`}><I size={20} aria-hidden="true" /></span><span className="grow"><span className="t">{t(`more.${k}`)}</span></span><span className="chip">{t("more.soon")}</span></li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="leg-h">
          <h2 id="leg-h" className="section-h">{t("more.legal")}</h2>
          <ul className="list">
            <Row icon={<span className="icon-tile c-teal"><Shield size={20} aria-hidden="true" /></span>} title={t("legal.privacy")} to="/privacy" />
            <Row icon={<span className="icon-tile c-teal"><ScrollText size={20} aria-hidden="true" /></span>} title={t("legal.terms")} to="/terms" />
            <Row icon={<span className="icon-tile c-teal"><Monitor size={20} aria-hidden="true" /></span>} title={t("more.site")} to="/welcome" />
          </ul>
        </section>
      </div>
    </Screen>
  );
}

/** Sub-screen with Back: permanent deletion (server hard-deletes every row). */
export function DeleteAccount() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const signedOut = useApp((s) => s.signedOut);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const del = async () => {
    setBusy(true); setErr(null);
    try { await api.deleteAccount(); signedOut(); nav("/", { replace: true }); }
    catch (e) { setErr(errKey(e)); setBusy(false); }
  };
  return (
    <Screen title={t("more.del")} back="/more">
      <Card hue="coral" className="stack">
        <span className="icon-tile c-coral"><TriangleAlert size={22} aria-hidden="true" /></span>
        <p className="m-0">{t("more.delWarn")}</p>
        <p className="m-0 text-sm muted">{t("more.delExportHint")}</p>
        <Check name="confirm-delete" label={t("more.delConfirm")} checked={sure} onChange={setSure} />
        {err && <Notice role="alert">{t(err)}</Notice>}
        <div className="grid-2">
          <ButtonLink to="/more" variant="secondary">{t("more.cancel")}</ButtonLink>
          <Button variant="danger" disabled={!sure} busy={busy} onClick={del} icon={<Trash2 size={18} aria-hidden="true" />}>{t("more.delBtn")}</Button>
        </div>
      </Card>
    </Screen>
  );
}
