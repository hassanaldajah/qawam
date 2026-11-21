import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Camera, MessageSquareText, Target, Dumbbell, Moon, Bell, ShieldCheck, Plus, CircleCheck, Lock, Sparkles, Flame,
  Droplets, Footprints, ArrowLeft, ArrowUp, Gauge, Activity, Leaf, Menu, X, Wheat, Salad, Milk, Coffee, CookingPot, Apple, RotateCcw,
} from "lucide-react";
import { ButtonLink, Logo, LangToggle, Ring, Bar } from "../app/ui";
import { QawamMark } from "../brand/QawamMark";
import { reducedMotion, useReveal, useTilt } from "../lib/fx";
import { useApp } from "../lib/store";
import { dbgVal } from "../lib/debug";
import "./landing.css";

const SECTIONS = ["app", "try", "features", "how", "privacy", "faq"] as const;
type Section = (typeof SECTIONS)[number];
const NAV_KEY: Record<Section, string> = { app: "navApp", try: "navTry", features: "navFeatures", how: "navHow", privacy: "navPrivacy", faq: "navFaq" };

/** Scroll progress, active section (drives the header highlight and the background tone),
 *  and a pointer spotlight. CSSOM only (allowed by the CSP), rAF-throttled, off for reduced motion. */
function useLandingFx(page: RefObject<HTMLDivElement | null>) {
  const [active, setActive] = useState<Section | "hero">("hero");
  const [scrolled, setScrolled] = useState(false);
  const [far, setFar] = useState(false);
  useEffect(() => {
    const el = page.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        el.style.setProperty("--p", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
        setScrolled(window.scrollY > 8);
        setFar(window.scrollY > 900);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id as Section); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    const hero = el.querySelector("#top");
    [hero, ...SECTIONS.map((id) => el.querySelector(`#${id}`))].forEach((n) => n && io.observe(n));
    // pointer spotlight (fine pointers only)
    let praf = 0;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches && !reducedMotion();
    const onMove = (e: PointerEvent) => {
      if (praf) return;
      praf = requestAnimationFrame(() => {
        praf = 0;
        el.style.setProperty("--mx", `${e.clientX}px`);
        el.style.setProperty("--my", `${e.clientY}px`);
        const spot = (e.target as Element | null)?.closest?.<HTMLElement>(".spot");
        if (spot) {
          const r = spot.getBoundingClientRect();
          spot.style.setProperty("--x", `${e.clientX - r.left}px`);
          spot.style.setProperty("--y", `${e.clientY - r.top}px`);
        }
      });
    };
    if (fine) el.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("scroll", onScroll); io.disconnect();
      el.removeEventListener("pointermove", onMove); cancelAnimationFrame(raf); cancelAnimationFrame(praf);
    };
  }, [page]);
  return { active, scrolled, far };
}

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
          <linearGradient id="hmG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#B5EE6A" /><stop offset=".55" stopColor="#4FD8C4" /><stop offset="1" stopColor="#3CC8DC" stopOpacity=".15" /></linearGradient>
        </defs>
        <circle cx="300" cy="300" r="292" stroke="url(#hmG)" strokeOpacity=".4" />
        <circle cx="300" cy="300" r="236" stroke="#FFFFFF" strokeOpacity=".08" strokeDasharray="2 10" />
        <g className="hm-spin"><circle cx="300" cy="8" r="5" fill="#B5EE6A" /><circle cx="8" cy="300" r="3.5" fill="#4FD8C4" /></g>
        <g className="hm-spin rev"><circle cx="536" cy="300" r="4" fill="#FFB65C" /></g>
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

/* ---------- Interactive demo: tap plates, the ring and macros update (illustrative numbers) ---------- */
const GOAL = { kcal: 2000, p: 120, c: 220, f: 65 };
const FOODS = [
  { k: "fd1", Icon: Wheat, kcal: 420, p: 14, c: 72, f: 8, hue: "lime" },
  { k: "fd2", Icon: CookingPot, kcal: 610, p: 38, c: 70, f: 18, hue: "orange" },
  { k: "fd3", Icon: Salad, kcal: 180, p: 5, c: 10, f: 14, hue: "teal" },
  { k: "fd4", Icon: Milk, kcal: 120, p: 8, c: 11, f: 5, hue: "sky" },
  { k: "fd5", Icon: Apple, kcal: 70, p: 1, c: 18, f: 0, hue: "coral" },
  { k: "fd6", Icon: Coffee, kcal: 90, p: 3, c: 12, f: 3, hue: "pink" },
] as const;

function TryDemo() {
  const { t } = useTranslation();
  const [on, setOn] = useState<Set<string>>(() => new Set(["fd1"]));
  const sum = FOODS.filter((f) => on.has(f.k)).reduce((a, f) => ({ kcal: a.kcal + f.kcal, p: a.p + f.p, c: a.c + f.c, f: a.f + f.f }), { kcal: 0, p: 0, c: 0, f: 0 });
  const left = Math.max(0, GOAL.kcal - sum.kcal);
  const toggle = (k: string) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <div className="try spot" data-reveal="1">
      <div className="try-plates">
        <div className="try-head"><span className="pill">{t("lp.tryNote")}</span>
          <button type="button" className="try-reset" onClick={() => setOn(new Set())} disabled={on.size === 0}><RotateCcw size={16} aria-hidden="true" />{t("lp.tryReset")}</button>
        </div>
        <div className="plates">
          {FOODS.map(({ k, Icon, kcal, hue }) => (
            <button key={k} type="button" className={`plate c-${hue}`} aria-pressed={on.has(k)} onClick={() => toggle(k)}>
              <span className="lp-ico lg"><Icon size={22} aria-hidden="true" /></span>
              <span className="plate-name">{t(`lp.${k}`)}</span>
              <span className="plate-kcal"><bdi className="num">{kcal}</bdi> {t("today.kcalUnit")}</span>
              <span className="plate-tick" aria-hidden="true">{on.has(k) ? <CircleCheck size={18} /> : <Plus size={18} />}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="try-panel">
        <div className="try-ring">
          <Ring size={190} stroke={14} value={sum.kcal} max={GOAL.kcal} hue="lime" glow label={t("today.kcal")} unit={t("today.kcalUnit")} valueClass="text-4xl" />
        </div>
        <dl className="try-nums">
          <div><dt>{t("lp.tryEaten")}</dt><dd className="num">{sum.kcal}</dd></div>
          <div><dt>{t("lp.tryLeft")}</dt><dd className="num">{left}</dd></div>
          <div><dt>{t("lp.tryGoal")}</dt><dd className="num">{GOAL.kcal}</dd></div>
        </dl>
        <div className="try-bars">
          <Bar label={t("today.protein")} value={sum.p} max={GOAL.p} hue="teal" />
          <Bar label={t("today.carbs")} value={sum.c} max={GOAL.c} hue="coral" />
          <Bar label={t("today.fat")} value={sum.f} max={GOAL.f} hue="lime" />
        </div>
        <p className="sr-only" aria-live="polite">{t("lp.tryLive", { eaten: sum.kcal, left })}</p>
      </div>
    </div>
  );
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
  const [menu, setMenu] = useState(false);
  const { active, scrolled, far } = useLandingFx(page);
  useReveal(page); useTilt(page, 8);
  useEffect(() => { const id = dbgVal("scroll"); if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView(), 300); }, []);
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [menu]);
  const authed = status === "authed";
  const ctaTo = authed ? "/" : "/start";
  const ctaLabel = authed ? t("lp.openApp") : t("lp.start");
  const arrow = <ArrowLeft size={20} aria-hidden="true" className="ltr:-scale-x-100" />;
  const faq = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;
  const links = (onClick?: () => void) => SECTIONS.map((id) => (
    <a key={id} href={`#${id}`} className={active === id ? "on" : ""} aria-current={active === id ? "true" : undefined} onClick={onClick}>{t(`lp.${NAV_KEY[id]}`)}</a>
  ));

  return (
    <div ref={page} className="lp" data-tone={active}>
      <div className="lp-bg" aria-hidden="true"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /><span className="spotlight" /></div>
      <a className="skip-link" href="#main">{t("a11y.skip")}</a>
      <span className="lp-progress" aria-hidden="true" />

      <header className={`lp-header ${scrolled ? "scrolled" : ""} ${menu ? "open" : ""}`}>
        <div className="lp-bar">
          <Logo motion="run" size={40} />
          <nav aria-label={t("lp.navLabel")} className="lp-nav">{links()}</nav>
          <span className="spacer" />
          <LangToggle />
          <ButtonLink to={ctaTo} size="sm" className="bar-cta">{ctaLabel}</ButtonLink>
          <button type="button" className="icon-btn menu-btn" aria-expanded={menu} aria-controls="lp-menu" aria-label={menu ? t("lp.close") : t("lp.menu")} onClick={() => setMenu((m) => !m)}>
            {menu ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
        {menu && (
          <nav id="lp-menu" className="lp-sheet" aria-label={t("lp.navLabel")}>
            {links(() => setMenu(false))}
            <ButtonLink to={ctaTo} size="lg" block>{ctaLabel}</ButtonLink>
          </nav>
        )}
      </header>

      <main id="main" tabIndex={-1}>
        {/* ---------- Hero ---------- */}
        <section id="top" className="hero" aria-labelledby="hero-h">
          <div className="hero-copy">
            <span className="eyebrow" data-reveal="0"><span className="pulse" aria-hidden="true" />{t("lp.eyebrow")}</span>
            <h1 id="hero-h" className="display" data-reveal="1"><span>{t("lp.h1a")}</span> <span className="grad-text">{t("lp.h1b")}</span></h1>
            <p className="lead" data-reveal="2">{t("lp.lead")}</p>
            <div className="cta-row" data-reveal="3">
              <ButtonLink to={ctaTo} size="lg" icon={<Plus size={20} aria-hidden="true" />}>{ctaLabel}</ButtonLink>
              <a href="#try" className="btn btn-secondary btn-lg"><Sparkles size={20} aria-hidden="true" /><span className="btn-label">{t("lp.tryEyebrow")}</span></a>
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
                  <li key={k} className={`spot c-${hue}`} data-reveal={String(i)}>
                    <span className="lp-ico lg"><Icon size={22} aria-hidden="true" /></span>
                    <div><h3>{t(`lp.${k}`)}</h3><p>{t(`lp.${k}_d`)}</p></div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="show-art" data-reveal="1"><div className="show-halo" aria-hidden="true" /><PhoneMock /></div>
          </div>
        </section>

        {/* ---------- Try it ---------- */}
        <section id="try" className="lp-section" aria-labelledby="try-h">
          <SectionHead id="try-h" eyebrow={t("lp.tryEyebrow")} title={t("lp.tryH")} sub={t("lp.trySub")} center />
          <TryDemo />
        </section>

        {/* ---------- Bento features ---------- */}
        <section id="features" className="lp-section" aria-labelledby="f-h">
          <SectionHead id="f-h" eyebrow={t("lp.fEyebrow")} title={t("lp.fH")} sub={t("lp.fSub")} center />
          <ul className="bento">
            <li className="tile spot t-goal c-lime" data-reveal="0">
              <div className="tile-top"><span className="lp-ico"><Target size={20} aria-hidden="true" /></span><Live /></div>
              <h3>{t("lp.f_goal")}</h3><p>{t("lp.f_goal_d")}</p>
              <div className="gauge" aria-hidden="true">
                <svg viewBox="0 0 220 120" fill="none">
                  <defs><linearGradient id="gaugeG" x1="0" x2="1"><stop offset="0" stopColor="#3CC8DC" /><stop offset="1" stopColor="#B5EE6A" /></linearGradient></defs>
                  <path d="M20 110a90 90 0 0 1 180 0" stroke="#FFFFFF" strokeOpacity=".08" strokeWidth="14" strokeLinecap="round" />
                  <path className="gauge-arc" d="M20 110a90 90 0 0 1 128-81.5" stroke="url(#gaugeG)" strokeWidth="14" strokeLinecap="round" />
                  <path d="M171 46a90 90 0 0 1 29 64" stroke="#FF8A70" strokeOpacity=".6" strokeWidth="8" strokeLinecap="round" strokeDasharray="0.1 16" />
                </svg>
                <div className="gauge-val"><b><bdi dir="ltr" className="num">0.6%</bdi></b><span>{t("lp.bWeek")}</span></div>
                <span className="pill safe">{t("lp.bSafe")}</span>
              </div>
            </li>
            <li className="tile spot t-acc c-teal" data-reveal="1">
              <div className="tile-top"><span className="lp-ico"><CircleCheck size={20} aria-hidden="true" /></span><Live /></div>
              <h3>{t("lp.f_accuracy")}</h3><p>{t("lp.f_accuracy_d")}</p>
              <div className="bars" aria-hidden="true">
                <Bar label={t("today.protein")} value={82} max={120} hue="teal" />
                <Bar label={t("today.carbs")} value={140} max={220} hue="coral" />
              </div>
            </li>
            <li className="tile spot t-text c-sky" data-reveal="2">
              <div className="tile-top"><span className="lp-ico"><MessageSquareText size={20} aria-hidden="true" /></span><Soon /></div>
              <h3>{t("lp.f_text")}</h3><p>{t("lp.f_text_d")}</p>
              <div className="chat" aria-hidden="true">
                <span className="bub me">{t("lp.bChat")}</span>
                <span className="bub ai"><b><bdi dir="ltr" className="num">≈ 720</bdi></b> {t("today.kcalUnit")}<em>{t("estimate")}</em></span>
              </div>
            </li>
            {([["photo", Camera, "orange"], ["ramadan", Moon, "teal"], ["reminders", Bell, "lime"], ["workouts", Dumbbell, "pink"]] as const).map(([k, Icon, hue], i) => (
              <li key={k} className={`tile spot t-sm c-${hue}`} data-reveal={String(i % 3)}>
                <div className="tile-top"><span className="lp-ico"><Icon size={20} aria-hidden="true" /></span><Soon /></div>
                <h3>{t(`lp.f_${k}`)}</h3><p>{t(`lp.f_${k}_d`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- Numbers ---------- */}
        <section className="lp-section tight" aria-labelledby="st-h">
          <h2 id="st-h" className="sr-only">{t("lp.stH")}</h2>
          <dl className="stats spot">
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
              <li key={n} className={`step spot c-${["teal", "lime", "orange"][i]}`} data-reveal={String(i)}>
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
            <a href="#app">{t("lp.navApp")}</a><a href="#try">{t("lp.navTry")}</a><a href="#features">{t("lp.navFeatures")}</a><a href="#how">{t("lp.navHow")}</a>
          </nav>
          <nav aria-label={t("lp.footLegal")} className="foot-col">
            <h3>{t("lp.footLegal")}</h3>
            <Link to="/privacy">{t("legal.privacy")}</Link><Link to="/terms">{t("legal.terms")}</Link><a href="#faq">{t("lp.navFaq")}</a>
          </nav>
        </div>
        <div className="foot-base"><span>© {new Date().getFullYear()} {t("app")}</span><span>{t("disclaimer")}</span></div>
      </footer>

      <button type="button" className={`to-top ${far ? "show" : ""}`} aria-label={t("lp.toTop")} tabIndex={far ? 0 : -1}
        onClick={() => { window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" }); document.getElementById("main")?.focus({ preventScroll: true }); }}>
        <ArrowUp size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
