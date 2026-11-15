import { useTranslation } from "react-i18next";
import { AppBar } from "../app/ui";

function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const { t } = useTranslation();
  const sections = kind === "privacy" ? (["a", "b", "c", "d", "e"] as const) : (["a", "b", "c", "d"] as const);
  return (
    <>
      <AppBar title={t(`legal.${kind}`)} back="/" />
      <main id="main" className="page route" tabIndex={-1}>
        <article className="card prose p-6">
          <h1 className="page-h">{t(`legal.${kind}`)}</h1>
          <p className="muted">{t("legal.updated")}</p>
          {sections.map((s) => (
            <section key={s}>
              <h2>{t(`legal.${kind}_${s}`)}</h2>
              <p>{t(`legal.${kind}_${s}_d`)}</p>
            </section>
          ))}
        </article>
        <p className="mt-8 text-center text-xs muted">{t("disclaimer")}</p>
      </main>
    </>
  );
}
export const Privacy = () => <LegalPage kind="privacy" />;
export const Terms = () => <LegalPage kind="terms" />;
