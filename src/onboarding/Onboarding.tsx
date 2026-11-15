import { useMemo, useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import i18n, { applyLang, type Lang } from "../i18n";
import { Btn, Card } from "../app/ui";
import { evaluate, makeBackupCode, type Goal } from "../lib/plan";
import { useApp } from "../lib/store";

const input = "h-12 w-full rounded-lg border border-line bg-card px-3 text-base text-fg";

/** Pure gate rules, unit-tested. */
export const canLeaveGoal = (g: Goal) => evaluate(g).issues.every((i) => i !== "invalid");
export const canLeaveSafety = (g: Goal) => evaluate(g).ok;
export const canFinishBackup = (savedChecked: boolean) => savedChecked;

function Num({ label, value, onChange, invalid }: { label: string; value: number; onChange: (n: number) => void; invalid: boolean }) {
  const id = useId();
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={id} type="number" inputMode="decimal" className={input} value={Number.isFinite(value) ? value : ""}
        aria-invalid={invalid} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} />
    </div>
  );
}

export function Onboarding() {
  const { t } = useTranslation();
  const finish = useApp((s) => s.finish);
  const [step, setStep] = useState(0);
  const [g, setG] = useState<Goal>({ current: 80, target: 75, heightCm: 170, age: 30, sex: "m", activity: 1.55, weeks: 12, pregnant: false, medical: false });
  const [code] = useState(makeBackupCode);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const plan = useMemo(() => evaluate(g), [g]);
  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setG((p) => ({ ...p, [k]: v }));
  const total = 4;
  const lang = i18n.language as Lang;
  const invalid = plan.issues.includes("invalid");
  const nextOk = step === 1 ? canLeaveGoal(g) : step === 2 ? canLeaveSafety(g) : step === 3 ? canFinishBackup(saved) : true;

  const switchLang = (l: Lang) => { i18n.changeLanguage(l); applyLang(l); };
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { /* user can copy manually */ } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Qawam recovery code: ${code}\n`], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "qawam-recovery-code.txt"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-md p-4 pb-8">
      <p className="m-0 text-sm" aria-live="polite">{t("ob.step", { n: step + 1, total })}</p>
      {step === 0 && (
        <section aria-labelledby="ob-h"><h1 id="ob-h" className="my-4 text-2xl font-bold">{t("ob.langTitle")}</h1>
          <div className="flex gap-2" role="group" aria-label={t("ob.langTitle")}>
            {(["ar", "en"] as const).map((l) => (
              <Btn key={l} variant={lang === l ? "primary" : "secondary"} aria-pressed={lang === l} className="flex-1" onClick={() => switchLang(l)} lang={l}>
                {l === "ar" ? "العربية" : "English"}
              </Btn>
            ))}
          </div>
        </section>
      )}
      {step === 1 && (
        <section aria-labelledby="ob-h"><h1 id="ob-h" className="my-4 text-2xl font-bold">{t("ob.goalTitle")}</h1>
          <Num label={t("ob.current")} value={g.current} onChange={(n) => set("current", n)} invalid={invalid} />
          <Num label={t("ob.target")} value={g.target} onChange={(n) => set("target", n)} invalid={invalid} />
          <Num label={t("ob.weeks")} value={g.weeks} onChange={(n) => set("weeks", n)} invalid={invalid} />
          <Num label={t("ob.height")} value={g.heightCm} onChange={(n) => set("heightCm", n)} invalid={invalid} />
          <Num label={t("ob.age")} value={g.age} onChange={(n) => set("age", n)} invalid={invalid} />
          <div className="mb-3">
            <label htmlFor="sex" className="mb-1 block text-sm font-medium">{t("ob.sex")}</label>
            <select id="sex" className={input} value={g.sex} onChange={(e) => set("sex", e.target.value as "m" | "f")}>
              <option value="m">{t("ob.male")}</option><option value="f">{t("ob.female")}</option>
            </select>
          </div>
          <div className="mb-3">
            <label htmlFor="act" className="mb-1 block text-sm font-medium">{t("ob.activity")}</label>
            <select id="act" className={input} value={g.activity} onChange={(e) => set("activity", Number(e.target.value))}>
              <option value={1.375}>{t("ob.act1")}</option><option value={1.55}>{t("ob.act2")}</option><option value={1.725}>{t("ob.act3")}</option>
            </select>
          </div>
          {([["pregnant", "ob.pregnant"], ["medical", "ob.medical"]] as const).map(([k, label]) => (
            <label key={k} className="mb-2 flex min-h-11 items-center gap-3">
              <input type="checkbox" className="h-6 w-6 accent-[var(--primary)]" checked={g[k]} onChange={(e) => set(k, e.target.checked)} />{t(label)}
            </label>
          ))}
          <p aria-live="polite" className="mt-2">
            {invalid
              ? <span role="alert" className="flex items-center gap-2 text-accent"><AlertTriangle aria-hidden="true" size={20} />{t("ob.fieldError")}</span>
              : <bdi>{t("ob.preview", { kcal: plan.kcal, pct: plan.pctPerWeek })}</bdi>}
          </p>
        </section>
      )}
      {step === 2 && (
        <section aria-labelledby="ob-h"><h1 id="ob-h" className="my-4 text-2xl font-bold">{t("ob.safetyTitle")}</h1>
          {plan.ok ? (
            <Card className="flex items-center gap-2 text-green"><CheckCircle2 aria-hidden="true" size={20} />{t("ob.safeOk")}</Card>
          ) : (
            <Card>
              <div role="alert">
                <p className="m-0 flex items-center gap-2 font-bold text-accent"><AlertTriangle aria-hidden="true" size={20} />{t("unsafe")}</p>
                <ul className="my-3">{plan.issues.map((i) => <li key={i}>{t(`ob.i_${i}`)}</li>)}</ul>
              </div>
              {plan.issues.includes("rate") && (
                <>
                  <p className="m-0">{t("ob.suggest", { weeks: plan.safeWeeks })}</p>
                  <Btn className="mt-3" onClick={() => set("weeks", plan.safeWeeks)}>{t("ob.useSafe")}</Btn>
                </>
              )}
            </Card>
          )}
        </section>
      )}
      {step === 3 && (
        <section aria-labelledby="ob-h"><h1 id="ob-h" className="my-4 text-2xl font-bold">{t("backup")}</h1>
          <Card>
            <p className="m-0 mb-3 text-sm">{t("ob.backupNotice")}</p>
            <p className="m-0 mb-3 font-medium">{t("lost")}</p>
            <p dir="ltr" className="my-3 select-all break-all rounded-lg border border-line p-3 text-center font-mono text-xl font-bold" aria-label={t("ob.backupTitle")}>{code}</p>
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={copy}>{copied ? t("ob.copied") : t("ob.copy")}</Btn>
              <Btn variant="secondary" onClick={download}>{t("ob.download")}</Btn>
            </div>
            <label className="mt-4 flex min-h-11 items-center gap-3">
              <input type="checkbox" className="h-6 w-6 accent-[var(--primary)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} aria-describedby="saved-hint" />
              {t("ob.saved")}
            </label>
            {!saved && <p id="saved-hint" className="m-0 mt-1 text-sm text-accent">{t("ob.savedHint")}</p>}
          </Card>
        </section>
      )}
      <div className="mt-6 flex gap-2">
        {step > 0 && <Btn variant="secondary" onClick={() => setStep(step - 1)}>{t("ob.back")}</Btn>}
        <Btn className="flex-1" disabled={!nextOk} onClick={() => (step === total - 1 ? finish() : setStep(step + 1))}>
          {step === total - 1 ? t("ob.finish") : t("ob.next")}
        </Btn>
      </div>
      <p className="mt-6 text-center text-xs">{t("disclaimer")}</p>
    </main>
  );
}
