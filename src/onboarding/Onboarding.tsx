import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Copy, Download, KeyRound, ShieldCheck, ArrowLeft, Check as CheckIcon, Languages, Target, Minus, Plus, Mars, Venus,
  Armchair, Footprints, Flame, HeartPulse, Baby, CalendarDays, Scale, Gauge, TriangleAlert, Sparkles, Lightbulb,
} from "lucide-react";
import { setLang, type Lang } from "../i18n";
import { BackButton, Button, LangToggle, Logo, Notice } from "../app/ui";
import { QawamMark } from "../brand/QawamMark";
import { evaluate, type Goal } from "../lib/plan";
import { useApp } from "../lib/store";
import { api, ApiError } from "../lib/api";
import { useTurnstile } from "./useTurnstile";
import "./onboarding.css";

/** Pure gate rules, unit-tested. */
export const canLeaveGoal = (g: Goal) => evaluate(g).issues.every((i) => i !== "invalid");
export const canLeaveSafety = (g: Goal) => evaluate(g).ok;
export const canFinishBackup = (savedChecked: boolean) => savedChecked;

export const errKey = (e: unknown) => `err.${e instanceof ApiError ? e.code : "server"}`;

const STEPS = ["", "goal", "safety", "account"] as const;
const STEP_ICONS = [Languages, Target, ShieldCheck, KeyRound];
const nextIcon = <ArrowLeft size={20} aria-hidden="true" className="ltr:-scale-x-100" />;

/* ---------------------------------------------------------------- shell */
function Shell({ step, title, sub, children, footer, art }: { step: number; title: string; sub?: string; children: ReactNode; footer: ReactNode; art?: ReactNode }) {
  const { t } = useTranslation();
  const total = STEPS.length;
  return (
    <div className="ob" data-step={step}>
      <div className="ob-bg" aria-hidden="true"><span className="blob b1" /><span className="blob b2" /></div>
      <header className="ob-top">
        <div className="ob-top-in">
          {step > 0 ? <BackButton fallback={`/start/${STEPS[step - 1]}`.replace(/\/$/, "")} /> : <Link to="/welcome" className="icon-btn" aria-label={t("a11y.back")}><ArrowLeft size={20} aria-hidden="true" className="icon-dir" /></Link>}
          <Logo motion="run" size={36} to="/welcome" />
          <span className="spacer" />
          <span className="ob-count" aria-hidden="true"><bdi dir="ltr" className="num">{t("ob.stepOf", { n: step + 1, total })}</bdi></span>
          <LangToggle />
        </div>
        <div className="ob-progress" aria-hidden="true"><span style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
      </header>

      <div className="ob-wrap">
        <aside className="ob-side" aria-hidden="true">
          <div className="ob-side-mark">{art ?? <QawamMark width="100%" />}</div>
          <ol className="ob-steps">
            {STEPS.map((_, i) => {
              const Icon = STEP_ICONS[i]!;
              return (
                <li key={i} className={i < step ? "done" : i === step ? "now" : ""}>
                  <span className="ob-step-ic">{i < step ? <CheckIcon size={16} /> : <Icon size={16} />}</span>
                  <span>{t(`ob.s${i}`)}</span>
                </li>
              );
            })}
          </ol>
          <p className="ob-tip"><Lightbulb size={16} />{t(`ob.tip${step}`)}</p>
        </aside>

        <main id="main" className="ob-main" tabIndex={-1} key={step}>
          <p className="ob-kicker">{t("ob.step", { n: step + 1, total })} · {t(`ob.s${step}`)}</p>
          <section aria-labelledby="ob-h" className="ob-body">
            <h1 id="ob-h" className="ob-h">{title}</h1>
            {sub && <p className="ob-sub">{sub}</p>}
            {children}
          </section>
          <div className="ob-foot">{footer}</div>
          <p className="ob-disc">{t("disclaimer")}</p>
        </main>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- inputs */
function Stepper({ label, value, onChange, unit, min, max, step = 1, name, invalid, errorId, Icon }:
  { label: string; value: number; onChange: (n: number) => void; unit: string; min: number; max: number; step?: number; name: string; invalid?: boolean; errorId?: string; Icon: typeof Scale }) {
  const { t } = useTranslation();
  const id = useId();
  const bump = (d: number) => {
    const base = Number.isFinite(value) ? value : min;
    onChange(Math.round(Math.min(max, Math.max(min, base + d)) * 10) / 10);
  };
  return (
    <div className={`stp ${invalid ? "bad" : ""}`}>
      <label htmlFor={id} className="stp-label"><Icon size={16} aria-hidden="true" />{label}</label>
      <div className="stp-row">
        <button type="button" className="stp-btn" aria-label={t("ob.dec", { x: label })} onClick={() => bump(-step)}><Minus size={18} aria-hidden="true" /></button>
        <div className="stp-val">
          <input id={id} name={name} type="number" inputMode="decimal" autoComplete="off" className="num" min={min} max={max} step={step}
            value={Number.isFinite(value) ? value : ""} aria-invalid={invalid || undefined} aria-describedby={errorId}
            onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} />
          <span className="stp-unit" aria-hidden="true">{unit}</span>
        </div>
        <button type="button" className="stp-btn" aria-label={t("ob.inc", { x: label })} onClick={() => bump(step)}><Plus size={18} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

function Choices<T extends string | number>({ legend, name, value, onChange, options }:
  { legend: string; name: string; value: T; onChange: (v: T) => void; options: { v: T; label: string; desc?: string; Icon: typeof Mars; hue: string }[] }) {
  return (
    <fieldset className="chs">
      <legend className="sr-only">{legend}</legend>
      {options.map(({ v, label, desc, Icon, hue }) => (
        <label key={String(v)} className={`ch c-${hue}`}>
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
          <span className="ch-ic"><Icon size={22} aria-hidden="true" /></span>
          <span className="ch-txt"><b>{label}</b>{desc && <small>{desc}</small>}</span>
          <span className="ch-dot" aria-hidden="true"><CheckIcon size={14} /></span>
        </label>
      ))}
    </fieldset>
  );
}

function Switch({ label, checked, onChange, name, Icon }: { label: string; checked: boolean; onChange: (v: boolean) => void; name: string; Icon: typeof Baby }) {
  return (
    <label className="sw">
      <span className="sw-ic"><Icon size={18} aria-hidden="true" /></span>
      <span className="sw-txt">{label}</span>
      <input type="checkbox" role="switch" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="sw-track" aria-hidden="true"><span /></span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div className="grp"><h2 className="grp-h">{title}</h2>{children}</div>;
}

/* ---------------------------------------------------------------- step 0: language */
function LangStep() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const lang = i18n.language as Lang;
  return (
    <Shell step={0} title={t("ob.welcome")} sub={t("ob.welcomeSub")}
      footer={<>
        <Button size="lg" block onClick={() => nav("/start/goal")} icon={nextIcon}>{t("ob.next")}</Button>
        <Button variant="ghost" block onClick={() => nav("/restore")} icon={<KeyRound size={18} aria-hidden="true" />}>{t("ob.haveCode")}</Button>
      </>}>
      <div className="ob-hero-mark" aria-hidden="true"><span className="ring" /><QawamMark width="100%" /></div>
      <div className="langs" role="group" aria-label={t("ob.langTitle")}>
        {(["ar", "en"] as const).map((l) => (
          <button key={l} type="button" className="lang" aria-pressed={lang === l} lang={l} onClick={() => setLang(l)}>
            <span className="lang-glyph" aria-hidden="true">{l === "ar" ? "ع" : "Aa"}</span>
            <span className="lang-name">{l === "ar" ? "العربية" : "English"}</span>
            <span className="ch-dot" aria-hidden="true"><CheckIcon size={14} /></span>
          </button>
        ))}
      </div>
    </Shell>
  );
}

/* ---------------------------------------------------------------- step 1: goal */
function GoalStep() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const g = useApp((s) => s.draft);
  const set = useApp((s) => s.setDraft);
  const plan = useMemo(() => evaluate(g), [g]);
  const invalid = plan.issues.includes("invalid");
  const errId = useId();
  const weeksId = useId();
  const go = () => { if (canLeaveGoal(g)) nav("/start/safety"); };
  const fast = plan.pctPerWeek > 1;
  const weeksMax = Math.max(104, Number.isFinite(g.weeks) ? g.weeks : 0);
  return (
    <Shell step={1} title={t("ob.goalTitle")} sub={t("ob.goalSub")}
      footer={
        <div className="ob-live">
          <div className="ob-live-val" aria-live="polite">
            {invalid ? <span className="bad-txt">{t("ob.fieldError")}</span> : <>
              <b className="num"><bdi>{plan.kcal}</bdi></b><span>{t("ob.perDay")}</span>
              <span className={`pace ${fast ? "warn" : "ok"}`}><bdi dir="ltr" className="num">{plan.pctPerWeek}%</bdi> {t("ob.perWeek")}</span>
            </>}
          </div>
          <Button size="lg" disabled={!canLeaveGoal(g)} onClick={go} icon={nextIcon}>{t("ob.next")}</Button>
        </div>}>
      <form onSubmit={(e) => { e.preventDefault(); go(); }} noValidate className="ob-form">
        <Group title={t("ob.secAbout")}>
          <Choices legend={t("ob.sex")} name="sex" value={g.sex} onChange={(v) => set("sex", v)}
            options={[{ v: "m", label: t("ob.male"), Icon: Mars, hue: "sky" }, { v: "f", label: t("ob.female"), Icon: Venus, hue: "pink" }]} />
          <Stepper name="age" label={t("ob.age")} unit={t("u.yr")} min={1} max={120} value={g.age} onChange={(n) => set("age", n)} Icon={CalendarDays} invalid={invalid} errorId={invalid ? errId : undefined} />
        </Group>
        <Group title={t("ob.secBody")}>
          <div className="stp-grid">
            <Stepper name="height" label={t("ob.height")} unit={t("u.cm")} min={100} max={250} value={g.heightCm} onChange={(n) => set("heightCm", n)} Icon={Gauge} invalid={invalid} errorId={invalid ? errId : undefined} />
            <Stepper name="current" label={t("ob.current")} unit={t("u.kg")} min={30} max={400} step={0.5} value={g.current} onChange={(n) => set("current", n)} Icon={Scale} invalid={invalid} errorId={invalid ? errId : undefined} />
            <Stepper name="target" label={t("ob.target")} unit={t("u.kg")} min={30} max={400} step={0.5} value={g.target} onChange={(n) => set("target", n)} Icon={Target} invalid={invalid} errorId={invalid ? errId : undefined} />
          </div>
        </Group>
        <Group title={t("ob.secPace")}>
          <div className="rng">
            <div className="rng-top"><label htmlFor={weeksId}>{t("ob.weeks")}</label><output htmlFor={weeksId} className="num">{t("ob.weeksVal", { n: Number.isFinite(g.weeks) ? g.weeks : 0 })}</output></div>
            <input id={weeksId} type="range" name="weeks" min={1} max={weeksMax} step={1} value={Number.isFinite(g.weeks) ? g.weeks : 12}
              aria-valuetext={t("ob.weeksVal", { n: g.weeks })} onChange={(e) => set("weeks", Number(e.target.value))}
              style={{ "--fill": `${((Math.min(weeksMax, g.weeks || 1) - 1) / (weeksMax - 1)) * 100}%` } as React.CSSProperties} />
          </div>
          <Choices legend={t("ob.activity")} name="activity" value={g.activity} onChange={(v) => set("activity", v)}
            options={[
              { v: 1.375, label: t("ob.act1"), desc: t("ob.act1_d"), Icon: Armchair, hue: "teal" },
              { v: 1.55, label: t("ob.act2"), desc: t("ob.act2_d"), Icon: Footprints, hue: "lime" },
              { v: 1.725, label: t("ob.act3"), desc: t("ob.act3_d"), Icon: Flame, hue: "orange" },
            ]} />
        </Group>
        <Group title={t("ob.secHealth")}>
          <Switch name="pregnant" label={t("ob.pregnant")} checked={g.pregnant} onChange={(v) => set("pregnant", v)} Icon={Baby} />
          <Switch name="medical" label={t("ob.medical")} checked={g.medical} onChange={(v) => set("medical", v)} Icon={HeartPulse} />
          <p className="grp-hint">{t("ob.healthHint")}</p>
        </Group>
        {invalid && <div id={errId}><Notice role="alert">{t("ob.fieldError")}</Notice></div>}
        <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
      </form>
    </Shell>
  );
}

/* ---------------------------------------------------------------- step 2: safety */
function SafetyStep() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const g = useApp((s) => s.draft);
  const set = useApp((s) => s.setDraft);
  const plan = evaluate(g);
  if (!canLeaveGoal(g)) return <Navigate to="/start/goal" replace />;
  const ok = plan.ok;
  return (
    <Shell step={2} title={ok ? t("ob.safeOk") : t("ob.unsafeTitle")} sub={t("ob.safetySub")}
      art={<div className={`badge-art ${ok ? "ok" : "warn"}`}><span className="ring r1" /><span className="ring r2" /><span className="badge-ic">{ok ? <ShieldCheck size={56} strokeWidth={1.5} /> : <TriangleAlert size={52} strokeWidth={1.5} />}</span></div>}
      footer={<Button size="lg" block disabled={!canLeaveSafety(g)} onClick={() => nav("/start/account")} icon={nextIcon}>{t("ob.next")}</Button>}>
      {ok ? (
        <div className="res" role="status">
          <div className="res-main">
            <span className="res-ic"><Sparkles size={20} aria-hidden="true" /></span>
            <span className="res-lbl">{t("ob.dailyTarget")}</span>
            <b className="res-kcal num"><bdi>{plan.kcal}</bdi></b>
            <span className="res-unit">{t("ob.perDay")}</span>
          </div>
          <dl className="res-grid">
            <div><dt>{t("ob.sumTarget")}</dt><dd className="num"><bdi>{g.target}</bdi> {t("u.kg")}</dd></div>
            <div><dt>{t("ob.sumWeeks")}</dt><dd className="num">{t("ob.weeksVal", { n: g.weeks })}</dd></div>
            <div><dt>{t("ob.sumPace")}</dt><dd><bdi dir="ltr" className="num">{plan.pctPerWeek}%</bdi></dd></div>
          </dl>
        </div>
      ) : (
        <div className="warns">
          <ul role="alert" className="warn-list">
            {plan.issues.map((i) => <li key={i}><TriangleAlert size={18} aria-hidden="true" /><span>{t(`ob.i_${i}`)}</span></li>)}
          </ul>
          {plan.issues.includes("rate") && (
            <div className="fix">
              <p>{t("ob.suggest", { weeks: plan.safeWeeks })}</p>
              <Button variant="secondary" onClick={() => set("weeks", plan.safeWeeks)} icon={<CheckIcon size={18} aria-hidden="true" />}>{t("ob.useSafe")}</Button>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* ---------------------------------------------------------------- step 3: recovery code */
function AccountStep() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const g = useApp((s) => s.draft);
  const status = useApp((s) => s.status);
  const hasCode = useApp((s) => s.hasBackupCode);
  const code = useApp((s) => s.issuedCode);
  const setAuthed = useApp((s) => s.setAuthed);
  const setIssuedCode = useApp((s) => s.setIssuedCode);
  const complete = useApp((s) => s.completeOnboarding);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const needCreate = status !== "authed";
  const ts = useTurnstile("create", i18n.language, needCreate);
  const hintId = useId();
  const keyArt = <div className="badge-art key"><span className="ring r1" /><span className="ring r2" /><span className="badge-ic"><KeyRound size={52} strokeWidth={1.5} /></span></div>;

  if (!canLeaveSafety(g)) return <Navigate to="/start/safety" replace />;

  const issueCode = async () => {
    const r = await api.createBackupCode();
    setIssuedCode(r.code); setAuthed(true);
  };
  const create = async () => {
    setBusy(true); setErr(null);
    try {
      if (needCreate) {
        const token = await ts.token().catch(() => { throw new ApiError("turnstile"); });
        await api.createAccount(token);
        setAuthed(false);
      }
      await issueCode();
    } catch (e) {
      if (e instanceof ApiError && e.code === "current_code_required") { setAuthed(true); setErr("err.codeExists"); }
      else setErr(errKey(e));
    } finally { setBusy(false); }
  };
  const copy = async () => { if (!code) return; try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* user can select manually */ } };
  const download = () => {
    if (!code) return;
    const url = URL.createObjectURL(new Blob([`Qawam / قوام recovery code:\n${code}\n`], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "qawam-recovery-code.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const finish = () => { complete(); nav("/", { replace: true }); };

  if (code) {
    const chunks = code.split(/[-\s]+/).filter(Boolean);
    return (
      <Shell step={3} title={t("ob.codeReady")} sub={t("ob.backupNotice")} art={keyArt}
        footer={<Button size="lg" block disabled={!canFinishBackup(saved)} aria-describedby={!saved ? hintId : undefined} onClick={finish} icon={<Sparkles size={20} aria-hidden="true" />}>{t("ob.finish")}</Button>}>
        <div className="code-card">
          <p className="code-lost"><TriangleAlert size={18} aria-hidden="true" />{t("lost")}</p>
          <p className="code-tiles" aria-label={`${t("ob.backupTitle")}: ${code}`}>
            {chunks.map((c, i) => <span key={i} aria-hidden="true">{c}</span>)}
          </p>
          <p className="code-raw">{code}</p>
          <div className="code-actions">
            <Button variant="secondary" onClick={copy} icon={copied ? <CheckIcon size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}>{copied ? t("ob.copied") : t("ob.copy")}</Button>
            <Button variant="secondary" onClick={download} icon={<Download size={18} aria-hidden="true" />}>{t("ob.download")}</Button>
          </div>
          <span className="sr-only" aria-live="polite">{copied ? t("ob.copied") : ""}</span>
          <Switch name="saved" label={t("ob.saved")} checked={saved} onChange={setSaved} Icon={ShieldCheck} />
          <p id={hintId} className={`code-hint ${saved ? "ok" : ""}`}>{saved ? t("ob.savedOk") : t("ob.savedHint")}</p>
        </div>
      </Shell>
    );
  }
  if (status === "authed" && hasCode) {
    return (
      <Shell step={3} title={t("ob.accountTitle")} art={keyArt} footer={<Button size="lg" block onClick={finish}>{t("ob.finish")}</Button>}>
        <Notice kind="info">{t("ob.alreadyHasCode")}</Notice>
      </Shell>
    );
  }
  const blocked = needCreate && (ts.state === "missing" || ts.state === "failed");
  return (
    <Shell step={3} title={t("ob.accountTitle")} sub={t("ob.accountSub")} art={keyArt}
      footer={<Button size="lg" block busy={busy} disabled={blocked || (needCreate && ts.state === "loading")} onClick={create}
        icon={<ShieldCheck size={20} aria-hidden="true" />}>{needCreate ? t("ob.create") : t("ob.makeCode")}</Button>}>
      <div className="stack">
        <ul className="perks">
          {(["p1", "p2", "p3"] as const).map((k, i) => (
            <li key={k} className={`c-${["lime", "teal", "orange"][i]}`}><span className="ch-ic"><CheckIcon size={18} aria-hidden="true" /></span><span>{t(`lp.${k}`)}</span></li>
          ))}
        </ul>
        {needCreate && <div ref={ts.box} className="ts-box" />}
        {needCreate && ts.state === "missing" && <Notice kind="info" role="status">{t("err.noSiteKey")}</Notice>}
        {needCreate && ts.state === "failed" && <Notice role="alert">{t("err.turnstileLoad")}</Notice>}
        {err && <Notice role="alert">{t(err)}</Notice>}
      </div>
    </Shell>
  );
}

export function Onboarding() {
  const loc = useLocation();
  useEffect(() => { document.getElementById("main")?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <Routes>
      <Route index element={<LangStep />} />
      <Route path="goal" element={<GoalStep />} />
      <Route path="safety" element={<SafetyStep />} />
      <Route path="account" element={<AccountStep />} />
      <Route path="*" element={<Navigate to="/start" replace />} />
    </Routes>
  );
}
