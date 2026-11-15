import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { KeyRound } from "lucide-react";
import { AppBar, Button, Card, Notice } from "../app/ui";
import { api, ApiError } from "../lib/api";
import { useApp } from "../lib/store";
import { useTurnstile } from "./useTurnstile";
import { errKey } from "./Onboarding";

/** Restore an account on this device with the backup code (reachable from the first screen). */
export function Restore() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const setAuthed = useApp((s) => s.setAuthed);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ts = useTurnstile("restore", i18n.language);
  const id = useId(), hintId = useId(), errId = useId();
  const clean = code.replace(/[\s-]/g, "");
  const valid = clean.length === 36;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    try {
      const token = await ts.token().catch(() => { throw new ApiError("turnstile"); });
      await api.restore(code, token);
      setAuthed(true);
      nav("/", { replace: true });
    } catch (x) { setErr(errKey(x)); } finally { setBusy(false); }
  };
  const blocked = ts.state === "missing" || ts.state === "failed";

  return (
    <>
      <AppBar title={t("restore.title")} back="/" />
      <main id="main" className="page route" tabIndex={-1}>
        <h1 className="page-h">{t("restore.title")}</h1>
        <p className="page-sub">{t("restore.sub")}</p>
        <form onSubmit={submit} noValidate className="stack">
          <Card hue="teal">
            <div className="field m-0">
              <label htmlFor={id} className="label">{t("restore.label")}</label>
              <input id={id} name="backup-code" className="input num" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)}
                autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text" maxLength={64}
                placeholder="XXXX-XXXX-XXXX-…" aria-invalid={!!err && err === "err.invalid_code"} aria-describedby={`${hintId}${err ? ` ${errId}` : ""}`} />
              <span id={hintId} className="hint">{t("restore.hint")}</span>
            </div>
          </Card>
          <div ref={ts.box} className="ts-box" />
          {ts.state === "missing" && <Notice kind="info" role="status">{t("err.noSiteKey")}</Notice>}
          {ts.state === "failed" && <Notice role="alert">{t("err.turnstileLoad")}</Notice>}
          {err && <div id={errId}><Notice role="alert">{t(err)}</Notice></div>}
          <Button type="submit" size="lg" block busy={busy} disabled={!valid || blocked || ts.state === "loading"} icon={<KeyRound size={20} aria-hidden="true" />}>
            {t("restore.submit")}
          </Button>
        </form>
        <p className="mt-8 text-center text-xs muted">{t("disclaimer")}</p>
      </main>
    </>
  );
}
