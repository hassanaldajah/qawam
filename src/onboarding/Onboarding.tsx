import { useEffect, useId, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Copy, Download, KeyRound, ShieldCheck, ArrowRight, Check as CheckIcon } from "lucide-react";
import { setLang, type Lang } from "../i18n";
import { AppBar, Button, Card, Check, Notice, NumField } from "../app/ui";
import { evaluate, type Goal } from "../lib/plan";
import { useApp } from "../lib/store";
import { api, ApiError } from "../lib/api";
import { useTurnstile } from "./useTurnstile";

/** Pure gate rules, unit-tested. */
export const canLeaveGoal = (g: Goal) => evaluate(g).issues.every((i) => i !== "invalid");
export const canLeaveSafety = (g: Goal) => evaluate(g).ok;
export const canFinishBackup = (savedChecked: boolean) => savedChecked;

export const errKey = (e: unknown) => `err.${e instanceof ApiError ? e.code : "server"}`;

const STEPS = ["", "goal", "safety", "account"] as const;

function Shell({ step, title, sub, children, footer }: { step: number; title: string; sub?: string; children: React.ReactNode; footer: React.ReactNode }) {
  const { t } = useTranslation();
  const total = STEPS.length;
  return (
    <>
      <AppBar back={step > 0 ? `/start/${STEPS[step - 1]}`.replace(/\/$/, "") : undefined} title={step > 0 ? t("ob.title") : undefined} />
      <main id="main" className="page route" tabIndex={-1} key={step}>
        <div className="mb-5">
          <p className="m-0 mb-2 text-sm font-semibold muted">{t("ob.step", { n: step + 1, total })}</p>
          <div className="row gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-line"}`} />)}
          </div>
        </div>
        <section aria-labelledby="ob-h">
          <h1 id="ob-h" className="page-h">{title}</h1>
          {sub && <p className="page-sub">{sub}</p>}
          {children}
        </section>
        <div className="mt-6 stack">{footer}</div>
        <p className="mt-8 text-center text-xs muted">{t("disclaimer")}</p>
      </main>
    </>
  );
}

function LangStep() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const lang = i18n.language as Lang;
  return (
    <Shell step={0} title={t("ob.langTitle")} sub={t("ob.langSub")}
      footer={<>
        <Button size="lg" block onClick={() => nav("/start/goal")} icon={<ArrowRight size={20} aria-hidden="true" className="icon-dir" />}>{t("ob.next")}</Button>
        <Button variant="ghost" block onClick={() => nav("/restore")} icon={<KeyRound size={18} aria-hidden="true" />}>{t("ob.haveCode")}</Button>
      </>}>
      <div className="grid-2" role="group" aria-label={t("ob.langTitle")}>
        {(["ar", "en"] as const).map((l) => (
          <Button key={l} size="lg" variant="secondary" aria-pressed={lang === l} lang={l} onClick={() => setLang(l)}
            icon={lang === l ? <CheckIcon size={18} aria-hidden="true" /> : undefined}>
            {l === "ar" ? "العربية" : "English"}
          </Button>
        ))}
      </div>
    </Shell>
  );
}

function GoalStep() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const g = useApp((s) => s.draft);
  const set = useApp((s) => s.setDraft);
  const plan = useMemo(() => evaluate(g), [g]);
  const invalid = plan.issues.includes("invalid");
  const errId = useId();
  const sexId = useId(), actId = useId();
  return (
    <Shell step={1} title={t("ob.goalTitle")} sub={t("ob.goalSub")}
      footer={<Button size="lg" block disabled={!canLeaveGoal(g)} onClick={() => nav("/start/safety")} icon={<ArrowRight size={20} aria-hidden="true" className="icon-dir" />}>{t("ob.next")}</Button>}>
      <form onSubmit={(e) => { e.preventDefault(); if (canLeaveGoal(g)) nav("/start/safety"); }} noValidate>
        <div className="grid-2">
          <NumField name="current" label={t("ob.current")} unit={t("u.kg")} min={30} max={400} step="0.1" value={g.current} onChange={(n) => set("current", n)} aria-invalid={invalid} errorId={invalid ? errId : undefined} />
          <NumField name="target" label={t("ob.target")} unit={t("u.kg")} min={30} max={400} step="0.1" value={g.target} onChange={(n) => set("target", n)} aria-invalid={invalid} errorId={invalid ? errId : undefined} />
          <NumField name="height" label={t("ob.height")} unit={t("u.cm")} min={100} max={250} value={g.heightCm} onChange={(n) => set("heightCm", n)} aria-invalid={invalid} errorId={invalid ? errId : undefined} />
          <NumField name="age" label={t("ob.age")} unit={t("u.yr")} min={1} max={120} inputMode="numeric" value={g.age} onChange={(n) => set("age", n)} aria-invalid={invalid} errorId={invalid ? errId : undefined} />
        </div>
        <NumField name="weeks" label={t("ob.weeks")} unit={t("u.wk")} min={1} max={520} inputMode="numeric" value={g.weeks} onChange={(n) => set("weeks", n)} aria-invalid={invalid} errorId={invalid ? errId : undefined} />
        <div className="grid-2">
          <div className="field">
            <label htmlFor={sexId} className="label">{t("ob.sex")}</label>
            <select id={sexId} name="sex" className="input" value={g.sex} onChange={(e) => set("sex", e.target.value as "m" | "f")}>
              <option value="m">{t("ob.male")}</option><option value="f">{t("ob.female")}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor={actId} className="label">{t("ob.activity")}</label>
            <select id={actId} name="activity" className="input" value={g.activity} onChange={(e) => set("activity", Number(e.target.value))}>
              <option value={1.375}>{t("ob.act1")}</option><option value={1.55}>{t("ob.act2")}</option><option value={1.725}>{t("ob.act3")}</option>
            </select>
          </div>
        </div>
        <div className="stack mb-4">
          <Check name="pregnant" label={t("ob.pregnant")} checked={g.pregnant} onChange={(v) => set("pregnant", v)} />
          <Check name="medical" label={t("ob.medical")} checked={g.medical} onChange={(v) => set("medical", v)} />
        </div>
        <div aria-live="polite">
          {invalid
            ? <div id={errId}><Notice role="alert">{t("ob.fieldError")}</Notice></div>
            : <Card className="row between bg-transparent" hue="teal"><span className="muted text-sm">{t("ob.previewLabel")}</span>
                <bdi className="font-extrabold num">{t("ob.preview", { kcal: plan.kcal, pct: plan.pctPerWeek })}</bdi></Card>}
        </div>
        <button type="submit" hidden tabIndex={-1} aria-hidden="true" />
      </form>
    </Shell>
  );
}

function SafetyStep() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const g = useApp((s) => s.draft);
  const set = useApp((s) => s.setDraft);
  const plan = evaluate(g);
  if (!canLeaveGoal(g)) return <Navigate to="/start/goal" replace />;
  return (
    <Shell step={2} title={t("ob.safetyTitle")} sub={t("ob.safetySub")}
      footer={<Button size="lg" block disabled={!canLeaveSafety(g)} onClick={() => nav("/start/account")} icon={<ArrowRight size={20} aria-hidden="true" className="icon-dir" />}>{t("ob.next")}</Button>}>
      {plan.ok ? (
        <div className="stack">
          <Notice kind="ok" role="status">{t("ob.safeOk")}</Notice>
          <Card hue="lime" className="row between"><span className="muted">{t("ob.dailyTarget")}</span><bdi className="text-2xl font-extrabold num">{plan.kcal} {t("today.kcalUnit")}</bdi></Card>
        </div>
      ) : (
        <div className="stack">
          <div role="alert" className="alert">
            <ShieldCheck aria-hidden="true" size={20} />
            <div><p className="m-0 font-bold">{t("unsafe")}</p>
              <ul className="my-2 ps-5">{plan.issues.map((i) => <li key={i}>{t(`ob.i_${i}`)}</li>)}</ul></div>
          </div>
          {plan.issues.includes("rate") && (
            <Card hue="teal" className="stack">
              <p className="m-0">{t("ob.suggest", { weeks: plan.safeWeeks })}</p>
              <Button variant="secondary" onClick={() => set("weeks", plan.safeWeeks)}>{t("ob.useSafe")}</Button>
            </Card>
          )}
        </div>
      )}
    </Shell>
  );
}

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
    return (
      <Shell step={3} title={t("backup")} sub={t("ob.backupNotice")}
        footer={<>
          <Button size="lg" block disabled={!canFinishBackup(saved)} aria-describedby={!saved ? hintId : undefined} onClick={finish}>{t("ob.finish")}</Button>
        </>}>
        <Card hue="teal" className="stack">
          <p className="m-0 font-bold">{t("lost")}</p>
          <p className="code-box" aria-label={t("ob.backupTitle")}>{code}</p>
          <div className="grid-2">
            <Button variant="secondary" onClick={copy} icon={copied ? <CheckIcon size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}>{copied ? t("ob.copied") : t("ob.copy")}</Button>
            <Button variant="secondary" onClick={download} icon={<Download size={18} aria-hidden="true" />}>{t("ob.download")}</Button>
          </div>
          <span className="sr-only" aria-live="polite">{copied ? t("ob.copied") : ""}</span>
          <Check name="saved" label={t("ob.saved")} checked={saved} onChange={setSaved} describedBy={hintId} />
          <p id={hintId} className={`m-0 text-sm ${saved ? "text-green" : "text-accent"}`}>{saved ? t("ob.savedOk") : t("ob.savedHint")}</p>
        </Card>
      </Shell>
    );
  }
  if (status === "authed" && hasCode) {
    return (
      <Shell step={3} title={t("ob.accountTitle")} footer={<Button size="lg" block onClick={finish}>{t("ob.finish")}</Button>}>
        <Notice kind="info">{t("ob.alreadyHasCode")}</Notice>
      </Shell>
    );
  }
  const blocked = needCreate && (ts.state === "missing" || ts.state === "failed");
  return (
    <Shell step={3} title={t("ob.accountTitle")} sub={t("ob.accountSub")}
      footer={<Button size="lg" block busy={busy} disabled={blocked || (needCreate && ts.state === "loading")} onClick={create}
        icon={<ShieldCheck size={20} aria-hidden="true" />}>{needCreate ? t("ob.create") : t("ob.makeCode")}</Button>}>
      <div className="stack">
        <Card hue="lime" className="stack">
          <ul className="check-list">
            {(["p1", "p2", "p3"] as const).map((k) => <li key={k}><CheckIcon size={18} aria-hidden="true" /><span>{t(`lp.${k}`)}</span></li>)}
          </ul>
        </Card>
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
