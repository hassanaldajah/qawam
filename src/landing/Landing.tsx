import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Camera, MessageSquareText, Target, Dumbbell, Moon, Bell, ShieldCheck, Plus, CircleCheck, Lock, Sparkles, Flame,
  Droplets, Footprints, KeyRound, ArrowLeft, Gauge, Activity, Leaf,
} from "lucide-react";
import { ButtonLink, Logo, LangToggle, Ring, Bar } from "../app/ui";
import { QawamMark } from "../brand/QawamMark";
import { useReveal, useTilt } from "../lib/fx";
import { useApp } from "../lib/store";
import { dbgVal } from "../lib/debug";
import "./landing.css";

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

/** Hero centrepiece: the real logo (legs running in place) inside slow orbit rings. */
function HeroMark() {
  const { t } = useTranslation();
  return (
    <div className="hm">
      <div className="hm-glow" aria-hidden="true" />
      <svg className="hm-orbits" viewBox="0 0 600 600" aria-hidden="true" fill="none">
        <defs>
          <linearGradient id="hmG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8BE04E" /><stop offset=".55" stopColor="#2CC6DA" /><stop offset="1" stopColor="#16869E" stopOpacity=".2" /></linearGradient>
        </defs>
        <circle cx="300" cy="300" r="292" stroke="url(#hmG)" strokeOpacity=".35" />
        <circle cx="300" cy="300" r="236" stroke="#FFFFFF" strokeOpacity=".07" strokeDasharray="2 10" />
        <g className="hm-spin"><circle cx="300" cy="8" r="5" fill="#8BE04E" /><circle cx="8" cy="300" r="3.5" fill="#2CC6DA" /></g>
        <g className="hm-spin rev"><circle cx="536" cy="300" r="4" fill="#FA9414" /></g>
      </svg>
      <QawamMark width="100%" className="hm-logo" label={t("app")} />
      <div className="chipf cf1 c-lime" aria-hidden="true"><span className="lp-ico"><Sparkles size={16} /></span><span><b><bdi dir="ltr" className="num">+24 g</bdi></b><small>{t("lp.floatProtein")}</small></span></div>
      <div className="chipf cf2 c-teal" aria-hidden="true"><span className="lp-ico"><Target size={16} /></span><span><b><bdi dir="ltr" className="num">0.6%</bdi></b><small>{t("lp.floatRate")}</small></span></div>
      <div className="chipf cf3 c-orange" aria-hidden="true"><span className="lp-ico"><Lock size={16} /></span><span><b>{t("lp.floatPrivacy")}</b></span></div>
    </div>
  );
}

function Marquee() {
  const { t } = useTranslation();
  const words = [t("lp.tag1"), t("lp.tag2"), t("lp.tag3")];
  const group = (k: number) => (
    <div className="mq-group" key={k}>
      {[0, 1, 2].flatMap((r) => words.map((w, i) => <span key={`${r}${i}`} className={`mq-w w${i}`}>{w}<i aria-hidden="true" /></span>))}
    </div>
  );
  return <div className="mq" aria-hidden="true"><div className="mq-track">{group(0)}{group(1)}</div></div>;
}

function SectionHead({ id, eyebrow, title, sub, center }: { id: string; eyebrow: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={`sh ${center ? "center" : ""}`}>
      <span className="kicker" data-reveal="0">{eyebrow}</span>
      <h2 id={id} className="lp-h2" data-reveal="1">{title}</h2>
      {sub && <p className="lp-sub" data-reveal="2">{sub}</p>}
    </div>
  );
}

function Soon() { const { t } = useTranslation(); return <span className="pill">{t("more.soon")}</span>; }
function Live() { const { t } = useTranslation(); return <span className="pill live"><i aria-hidden="true" />{t("lp.live")}</span>; }

export function Landing() {
  const { t } = useTranslation();
  const status = useApp((s) => s.status);
  const page = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useReveal(page); useTilt(page, 8);
  useEffect(() => { const id = dbgVal("scroll"); if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 300); }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const authed = status === "authed";
  const ctaTo = authed ? "/" : "/start";
  const ctaLabel = authed ? t("lp.openApp") : t("lp.start");
  const arrow = <ArrowLeft size={20} aria-hidden="true" className="ltr:-scale-x-100" />;
  const faq = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

  return (
    <div ref={page} className="lp">
      <a className="skip-link" href="#main">{t("a11y.skip")}</a>
      <header className={`lp-header ${scrolled ? "scrolled" : ""}`}>
        <div className="lp-bar">
          <Logo motion="run" size={40} />
          <nav aria-label={t("lp.navLabel")} className="lp-nav">
            <a href="#app">{t("lp.navApp")}</a><a href="#features">{t("lp.navFeatures")}</a><a href="#how">{t("lp.navHow")}</a><a href="#privacy">{t("lp.navPrivacy")}</a><a href="#faq">{t("lp.navFaq")}</a>
          </nav>
          <span className="spacer" />
          <LangToggle />
          <ButtonLink to={ctaTo} size="sm" className="hide-xs">{ctaLabel}</ButtonLink>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {/* ---------- Hero ---------- */}
        <section className="hero" aria-labelledby="hero-h">
          <div className="hero-copy">
            <span className="eyebrow" data-reveal="0"><span className="pulse" aria-hidden="true" />{t("lp.eyebrow")}</span>
            <h1 id="hero-h" className="display" data-reveal="1"><span>{t("lp.h1a")}</span> <span className="grad-text">{t("lp.h1b")}</span></h1>
            <p className="lead" data-reveal="2">{t("lp.lead")}</p>
            <div className="cta-row" data-reveal="3">
              <ButtonLink to={ctaTo} size="lg" icon={<Plus size={20} aria-hidden="true" />}>{ctaLabel}</ButtonLink>
              {!authed && <ButtonLink to="/restore" size="lg" variant="secondary" icon={<KeyRound size={20} aria-hidden="true" />}>{t("lp.restore")}</ButtonLink>}
            </div>
            <ul className="trust" data-reveal="4">
              {(["t1", "t2", "t3"] as const).map((k) => <li key={k}><CircleCheck size={16} aria-hidden="true" />{t(`lp.${k}`)}</li>)}
            </ul>
          </div>
          <div className="hero-art" data-reveal="2"><HeroMark /></div>
        </section>

        <Marquee />

        {/* ---------- Product showcase ---------- */}
        <section id="app" className="lp-section" aria-labelledby="app-h">
          <div className="show">
            <div className="show-copy">
              <SectionHead id="app-h" eyebrow={t("lp.shEyebrow")} title={t("lp.shH")} sub={t("lp.shSub")} />
              <ul className="show-list">
                {([["sh1", Gauge, "teal"], ["sh2", Activity, "lime"], ["sh3", Droplets, "orange"]] as const).map(([k, Icon, hue], i) => (
                  <li key={k} className={`c-${hue}`} data-reveal={String(i)}>
                    <span className="lp-ico lg"><Icon size={22} aria-hidden="true" /></span>
                    <div><h3>{t(`lp.${k}`)}</h3><p>{t(`lp.${k}_d`)}</p></div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="show-art" data-reveal="1"><div className="show-halo" aria-hidden="true" /><PhoneMock /></div>
          </div>
        </section>

        {/* ---------- Bento features ---------- */}
        <section id="features" className="lp-section" aria-labelledby="f-h">
          <SectionHead id="f-h" eyebrow={t("lp.fEyebrow")} title={t("lp.fH")} sub={t("lp.fSub")} center />
          <ul className="bento">
            <li className="tile t-goal c-lime" data-reveal="0">
              <div className="tile-top"><span className="lp-ico"><Target size={20} aria-hidden="true" /></span><Live /></div>
              <h3>{t("lp.f_goal")}</h3><p>{t("lp.f_goal_d")}</p>
              <div className="gauge" aria-hidden="true">
                <svg viewBox="0 0 220 120" fill="none">
                  <defs><linearGradient id="gaugeG" x1="0" x2="1"><stop offset="0" stopColor="#2CC6DA" /><stop offset="1" stopColor="#8BE04E" /></linearGradient></defs>
                  <path d="M20 110a90 90 0 0 1 180 0" stroke="#FFFFFF" strokeOpacity=".08" strokeWidth="14" strokeLinecap="round" />
                  <path d="M20 110a90 90 0 0 1 128-81.5" stroke="url(#gaugeG)" strokeWidth="14" strokeLinecap="round" />
                  <path d="M171 46a90 90 0 0 1 29 64" stroke="#FF7A59" strokeOpacity=".6" strokeWidth="8" strokeLinecap="round" strokeDasharray="0.1 16" />
                </svg>
                <div className="gauge-val"><b><bdi dir="ltr" className="num">0.6%</bdi></b><span>{t("lp.bWeek")}</span></div>
                <span className="pill safe">{t("lp.bSafe")}</span>
              </div>
            </li>
            <li className="tile t-acc c-teal" data-reveal="1">
              <div className="tile-top"><span className="lp-ico"><CircleCheck size={20} aria-hidden="true" /></span><Live /></div>
              <h3>{t("lp.f_accuracy")}</h3><p>{t("lp.f_accuracy_d")}</p>
              <div className="bars" aria-hidden="true">
                <Bar label={t("today.protein")} value={82} max={120} hue="teal" />
                <Bar label={t("today.carbs")} value={140} max={220} hue="coral" />
              </div>
            </li>
            <li className="tile t-text c-sky" data-reveal="2">
              <div className="tile-top"><span className="lp-ico"><MessageSquareText size={20} aria-hidden="true" /></span><Soon /></div>
              <h3>{t("lp.f_text")}</h3><p>{t("lp.f_text_d")}</p>
              <div className="chat" aria-hidden="true">
                <span className="bub me">{t("lp.bChat")}</span>
                <span className="bub ai"><b><bdi dir="ltr" className="num">≈ 720</bdi></b> {t("today.kcalUnit")}<em>{t("estimate")}</em></span>
              </div>
            </li>
            {([["photo", Camera, "orange"], ["ramadan", Moon, "teal"], ["reminders", Bell, "lime"], ["workouts", Dumbbell, "pink"]] as const).map(([k, Icon, hue], i) => (
              <li key={k} className={`tile t-sm c-${hue}`} data-reveal={String(i % 3)}>
                <div className="tile-top"><span className="lp-ico"><Icon size={20} aria-hidden="true" /></span><Soon /></div>
                <h3>{t(`lp.f_${k}`)}</h3><p>{t(`lp.f_${k}_d`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Numbers ---------- */}
        <section className="lp-section tight" aria-labelledby="st-h">
          <h2 id="st-h" className="sr-only">{t("lp.stH")}</h2>
          <dl className="stats">
            {(["st1", "st2", "st3", "st4"] as const).map((k, i) => (
              <div key={k} className="stat" data-reveal={String(i)}><dt>{t(`lp.${k}`)}</dt><dd><bdi dir="ltr" className="num">{t(`lp.${k}v`)}</bdi></dd></div>
            ))}
          </dl>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="lp-section" aria-labelledby="h-h">
          <SectionHead id="h-h" eyebrow={t("lp.hEyebrow")} title={t("lp.hH")} sub={t("lp.hSub")} center />
          <ol className="steps">
            {(["1", "2", "3"] as const).map((n, i) => (
              <li key={n} className={`step c-${["teal", "lime", "orange"][i]}`} data-reveal={String(i)}>
                <span className="step-n num" aria-hidden="true">0{n}</span>
                <h3>{t(`lp.s${n}`)}</h3><p>{t(`lp.s${n}_d`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Privacy ---------- */}
        <section id="privacy" className="lp-section" aria-labelledby="p-h">
          <div className="priv">
            <div className="priv-art" aria-hidden="true" data-reveal="0">
              <span className="ring r1" /><span className="ring r2" /><span className="ring r3" />
              <span className="shield"><ShieldCheck size={64} strokeWidth={1.5} /></span>
            </div>
            <div>
              <SectionHead id="p-h" eyebrow={t("lp.pEyebrow")} title={t("lp.pH")} sub={t("lp.pSub")} />
              <ul className="checks">
                {(["p1", "p2", "p3", "p4", "p5"] as const).map((k, i) => <li key={k} data-reveal={String(i % 3)}><CircleCheck size={20} aria-hidden="true" /><span>{t(`lp.${k}`)}</span></li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="lp-section" aria-labelledby="q-h">
          <div className="faq-wrap">
            <SectionHead id="q-h" eyebrow={t("lp.qEyebrow")} title={t("lp.qH")} sub={t("lp.qSub")} />
            <div className="faq">
              {faq.map((q, i) => (
                <details key={q} data-reveal={String(i % 3)}>
                  <summary><span>{t(`lp.${q}`)}</span><span className="plus" aria-hidden="true"><Plus size={18} /></span></summary>
                  <p className="ans">{t(`lp.${q}_a`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="lp-section" aria-labelledby="c-h">
          <div className="final" data-reveal="0">
            <QawamMark width={112} className="final-mark" />
            <h2 id="c-h" className="lp-h2">{t("lp.cH")}</h2>
            <p>{t("lp.cSub")}</p>
            <div className="cta-row center">
              <ButtonLink to={ctaTo} size="lg" icon={arrow}>{ctaLabel}</ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="foot">
          <div className="foot-brand">
            <Logo size={44} />
            <p>{t("lp.footTag")}</p>
            <p className="tags"><Leaf size={14} aria-hidden="true" />{t("lp.tag1")} · {t("lp.tag2")} · {t("lp.tag3")}</p>
          </div>
          <nav aria-label={t("lp.footProduct")} className="foot-col">
            <h3>{t("lp.footProduct")}</h3>
            <a href="#app">{t("lp.navApp")}</a><a href="#features">{t("lp.navFeatures")}</a><a href="#how">{t("lp.navHow")}</a><Link to="/restore">{t("lp.restore")}</Link>
          </nav>
          <nav aria-label={t("lp.footLegal")} className="foot-col">
            <h3>{t("lp.footLegal")}</h3>
            <Link to="/privacy">{t("legal.privacy")}</Link><Link to="/terms">{t("legal.terms")}</Link><a href="#faq">{t("lp.navFaq")}</a>
          </nav>
        </div>
        <div className="foot-base"><span>© {new Date().getFullYear()} {t("app")}</span><span>{t("disclaimer")}</span></div>
      </footer>
    </div>
  );
}
