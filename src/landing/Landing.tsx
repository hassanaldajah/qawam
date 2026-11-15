import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, MessageSquareText, Target, Dumbbell, Moon, Bell, ShieldCheck, Plus, CircleCheck, Lock, Sparkles, Flame, Droplets, Footprints, KeyRound } from "lucide-react";
import { ButtonLink, Logo, LangToggle, Ring, Bar } from "../app/ui";
import { reducedMotion, useDotCursor, useReveal, useTilt } from "../lib/fx";
import { useApp } from "../lib/store";
import { dbgVal } from "../lib/debug";

const FEATURES = [
  { k: "photo", Icon: Camera, hue: "teal", soon: true },
  { k: "text", Icon: MessageSquareText, hue: "sky", soon: true },
  { k: "accuracy", Icon: CircleCheck, hue: "lime", soon: false },
  { k: "goal", Icon: Target, hue: "coral", soon: false },
  { k: "workouts", Icon: Dumbbell, hue: "pink", soon: true },
  { k: "ramadan", Icon: Moon, hue: "teal", soon: true },
  { k: "reminders", Icon: Bell, hue: "lime", soon: true },
] as const;

/** Phone mockup built from the real UI components (static demo values, clearly a preview). */
function PhoneMock() {
  const { t } = useTranslation();
  return (
    <div className="phone tilt" aria-hidden="true">
      <div className="phone-screen">
        <div className="row between"><strong className="text-xs">{t("screens.today")}</strong><span className="text-[10px] muted-on-dark">{t("lp.mockDate")}</span></div>
        <div className="hero-card">
          <div className="hero-grid">
            <Ring size={92} stroke={8} value={1240} max={2000} hue="teal" glow label={t("today.kcal")} unit={t("today.kcalUnit")} valueClass="text-base" />
            <div className="hero-stats">
              <div><div className="text-lg font-extrabold num">760</div><div className="text-[10px] muted-on-dark">{t("today.left")}</div></div>
              <div className="row gap-1 text-[10px] muted-on-dark"><Flame size={12} />{t("lp.mockStreak")}</div>
            </div>
          </div>
        </div>
        <div className="card stack gap-2">
          <Bar label={t("today.protein")} value={82} max={120} hue="teal" />
          <Bar label={t("today.carbs")} value={140} max={220} hue="coral" />
          <Bar label={t("today.fat")} value={38} max={65} hue="lime" />
        </div>
        <div className="mini-grid gap-2">
          <div className="card c-sky"><div className="row gap-1 text-[10px]"><Droplets size={12} />{t("today.water")}</div><div className="font-extrabold num">5/8</div></div>
          <div className="card c-pink"><div className="row gap-1 text-[10px]"><Footprints size={12} />{t("today.steps")}</div><div className="font-extrabold num">6.4k</div></div>
        </div>
        <div className="card tl-mini"><strong className="text-[11px]">{t("today.meals")}</strong><div><span>8:10</span><span className="flex-1">{t("lp.mockMeal1")}</span><b className="num">420</b></div><div><span>13:30</span><span className="flex-1">{t("lp.mockMeal2")}</span><b className="num">610</b></div></div>
        <div className="phone-tabs"><span className="on" /><span /><span /><span /><span /></div>
      </div>
    </div>
  );
}

function HeroStage() {
  const { t } = useTranslation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (reducedMotion()) return;
    let stop: (() => void) | undefined, cancelled = false;
    const start = () => import("../three/heroScene").then(({ startHero }) => {
      if (cancelled || !canvas.current) return;
      const dark = getComputedStyle(document.documentElement).colorScheme.includes("dark");
      try { stop = startHero(canvas.current, dark).stop; setOn(true); } catch { /* static SVG stays */ }
    });
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = idle ? idle(() => void start(), { timeout: 1200 }) : window.setTimeout(() => void start(), 400);
    return () => { cancelled = true; if (!idle) window.clearTimeout(id); stop?.(); };
  }, []);
  return (
    <div className="stage">
      <svg className="stage-static" viewBox="0 0 400 400" aria-hidden="true" fill="none">
        <ellipse cx="200" cy="200" rx="180" ry="70" className="k-teal" strokeWidth="2" transform="rotate(-18 200 200)" />
        <ellipse cx="200" cy="200" rx="160" ry="60" className="k-lime" strokeWidth="2" transform="rotate(24 200 200)" />
        <ellipse cx="200" cy="200" rx="190" ry="54" className="k-coral" strokeWidth="1.5" transform="rotate(70 200 200)" strokeDasharray="3 7" />
      </svg>
      <canvas ref={canvas} className={`stage-3d ${on ? "on" : ""}`} aria-hidden="true" />
      <PhoneMock />
      <div className="float f1 c-lime"><span className="icon-tile"><Sparkles size={18} /></span><span><b className="num">+24 g</b><br />{t("lp.floatProtein")}</span></div>
      <div className="float f2 c-teal"><span className="icon-tile"><Target size={18} /></span><span><b className="num">0.6%</b><br />{t("lp.floatRate")}</span></div>
      <div className="float f3 c-coral"><span className="icon-tile"><Lock size={18} /></span><span>{t("lp.floatPrivacy")}</span></div>
    </div>
  );
}

export function Landing() {
  const { t } = useTranslation();
  const status = useApp((s) => s.status);
  const page = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useReveal(page); useTilt(page); useDotCursor();
  useEffect(() => { const id = dbgVal("scroll"); if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 300); }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const authed = status === "authed";
  const ctaTo = authed ? "/" : "/start";
  const ctaLabel = authed ? t("lp.openApp") : t("lp.start");
  const faq = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

  return (
    <div ref={page}>
      <a className="skip-link" href="#main">{t("a11y.skip")}</a>
      <header className={`lp-header ${scrolled ? "scrolled" : ""}`}>
        <div className="appbar-in">
          <Logo />
          <nav aria-label={t("lp.navLabel")} className="lp-nav">
            <a href="#features">{t("lp.navFeatures")}</a><a href="#how">{t("lp.navHow")}</a><a href="#privacy">{t("lp.navPrivacy")}</a><a href="#faq">{t("lp.navFaq")}</a>
          </nav>
          <span className="spacer" />
          <LangToggle />
          <ButtonLink to={ctaTo} size="sm">{ctaLabel}</ButtonLink>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="lp-hero" aria-labelledby="hero-h">
          <div>
            <span className="eyebrow" data-reveal="0"><span className="dot c-lime" aria-hidden="true" />{t("lp.eyebrow")}</span>
            <h1 id="hero-h" className="display" data-reveal="1">{t("lp.h1a")} <span className="grad-text">{t("lp.h1b")}</span></h1>
            <p className="lead" data-reveal="2">{t("lp.lead")}</p>
            <div className="cta-row" data-reveal="3">
              <ButtonLink to={ctaTo} size="lg" icon={<Plus size={20} aria-hidden="true" />}>{ctaLabel}</ButtonLink>
              {!authed && <ButtonLink to="/restore" size="lg" variant="secondary" icon={<KeyRound size={20} aria-hidden="true" />}>{t("lp.restore")}</ButtonLink>}
            </div>
            <ul className="trust m-0 list-none p-0" data-reveal="4">
              {(["t1", "t2", "t3"] as const).map((k) => <li key={k}><span><CircleCheck size={16} aria-hidden="true" />{t(`lp.${k}`)}</span></li>)}
            </ul>
          </div>
          <div data-reveal="2"><HeroStage /></div>
        </section>

        <section id="features" className="lp-section" aria-labelledby="f-h">
          <h2 id="f-h" className="lp-h2" data-reveal="0">{t("lp.fH")}</h2>
          <p className="lp-sub" data-reveal="1">{t("lp.fSub")}</p>
          <ul className="features m-0 list-none p-0">
            {FEATURES.map(({ k, Icon, hue, soon }, i) => (
              <li key={k} className={`card card-glow feature tilt c-${hue}`} data-reveal={String(i % 3)}>
                <span className="row between"><span className="icon-tile"><Icon size={22} aria-hidden="true" /></span>{soon ? <span className="chip">{t("more.soon")}</span> : <span className="chip chip-brand">{t("lp.live")}</span>}</span>
                <h3>{t(`lp.f_${k}`)}</h3>
                <p>{t(`lp.f_${k}_d`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="lp-section" aria-labelledby="h-h">
          <h2 id="h-h" className="lp-h2" data-reveal="0">{t("lp.hH")}</h2>
          <p className="lp-sub" data-reveal="1">{t("lp.hSub")}</p>
          <ol className="steps">
            {(["1", "2", "3"] as const).map((n, i) => (
              <li key={n} className={`card card-glow step c-${["teal", "lime", "coral"][i]}`} data-reveal={String(i)}>
                <span className="step-n num" aria-hidden="true">{n}</span>
                <h3>{t(`lp.s${n}`)}</h3><p>{t(`lp.s${n}_d`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="privacy" className="lp-section" aria-labelledby="p-h">
          <div className="privacy">
            <div data-reveal="0">
              <span className="icon-tile c-lime mb-3"><ShieldCheck size={22} aria-hidden="true" /></span>
              <h2 id="p-h" className="lp-h2">{t("lp.pH")}</h2>
              <p className="lp-sub">{t("lp.pSub")}</p>
            </div>
            <div className="card card-glow c-teal p-6" data-reveal="1">
              <ul className="check-list">
                {(["p1", "p2", "p3", "p4", "p5"] as const).map((k) => <li key={k}><CircleCheck size={18} aria-hidden="true" /><span>{t(`lp.${k}`)}</span></li>)}
              </ul>
            </div>
          </div>
        </section>

        <section id="faq" className="lp-section" aria-labelledby="q-h">
          <h2 id="q-h" className="lp-h2" data-reveal="0">{t("lp.qH")}</h2>
          <div className="faq">
            {faq.map((q, i) => (
              <details key={q} className="card card-glow c-teal" data-reveal={String(i % 3)}>
                <summary><span>{t(`lp.${q}`)}</span><Plus className="plus" size={20} aria-hidden="true" /></summary>
                <p className="ans">{t(`lp.${q}_a`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-section" aria-labelledby="c-h">
          <div className="cta-band" data-reveal="0">
            <h2 id="c-h" className="lp-h2">{t("lp.cH")}</h2>
            <p>{t("lp.cSub")}</p>
            <ButtonLink to={ctaTo} size="lg">{ctaLabel}</ButtonLink>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-in">
          <span>© {new Date().getFullYear()} {t("app")} · {t("disclaimer")}</span>
          <nav aria-label={t("lp.footerNav")} className="row wrap">
            <Link to="/privacy">{t("legal.privacy")}</Link><Link to="/terms">{t("legal.terms")}</Link><Link to="/restore">{t("lp.restore")}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
