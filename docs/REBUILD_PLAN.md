# Qawam rebuild plan (v1, awaiting owner "go")

## 0. What changes vs. what stays
- STAYS (verified working, 82 tests): API, auth, D1, security headers, i18n, tokens, tests. Rebuild = presentation layer only. No migration needed; if one is, it gets a test.
- CHANGES: the runner-figure intro is REMOVED (owner: no character, no mascot). The mark itself animates. The 3D mannequin stays only for the future Workouts screen, never in the logo.
- Replaced: landing page, app shell polish, all motion. Old hero 3D scene is dropped unless it passes the budget (section 6).

## 1. Facts measured today (2026-11-15)
- public/logo-symbol.svg: viewBox 0 0 591 502, 16 traced fill paths, 12 colours, 36.7 KB. Lockup: 40 KB.
- Problem: a 36 KB inline mark on every page is too heavy and traced shapes have no strokes, so "stroke draw" is impossible without changing the shape.
- Decision: keep the geometry unchanged; reduce path precision (SVGO, 1 decimal, verified by pixel diff = 0 visible change, owner approves side by side). Target mark <= 12 KB gzip 4 KB. Used once as an SVG `<symbol>` and referenced by `<use>`; animated per colour layer (groups).

## 2. QawamMark component
`<QawamMark state="intro|idle|loading|success" size reducedMotion />`, one file src/brand/QawamMark.tsx + CSS file (CSP safe: no inline styles/scripts).
Engine: CSS keyframes + Web Animations API; transform/opacity only. GSAP not used (licence/size not needed; will note result of licence check in VERIFIED.md only if reconsidered). Framer Motion only if already in the bundle; currently it is not, so not added.
| state | motion | time | easing |
|---|---|---|---|
| intro | layers reveal with a clip-path wipe along the mark direction, 40 ms stagger, then settle: scale 1.06 to 1 with a small elastic overshoot ("stance") | <= 1.4 s, skippable, once per session (sessionStorage in try/catch), never blocks app | cubic-bezier(.2,.9,.3,1.2) |
| idle | breathing scale 1 to 1.02, highlight sweep every ~6 s on the accent layers | 5 to 6 s loop | ease-in-out |
| interaction | hover/press: scale 1.05/0.96 + accent layer shift 2 px | 120 to 180 ms | ease-out |
| loading | accent layers pulse in sequence (replaces spinner), aria-busy | 1.2 s loop | linear-ish |
| success | accent layers fill once + 6 tiny sparks (transform/opacity) | 700 ms once | ease-out |
Rules: prefers-reduced-motion = static mark or opacity fade; pause when `document.hidden`; `will-change` only during animation; fixed width/height so CLS = 0; RTL-safe (wipe direction uses logical direction; mark itself is NOT mirrored); small sizes (16 px) use the unanimated favicon version; no copy of any brand's animation (original wipe+settle composition, reviewed).
Optional Three.js hero mark: only if after section 6 measurement the app chunk is unaffected (lazy chunk, SVG fallback on weak devices/reduced motion/Save-Data). Otherwise dropped.

## 3. Page map
Landing `/` (hero with mark + value proposition, feature sections with mini-demos built from real components, how it works, privacy/no-account, install guide iPhone + Android, FAQ, footer), `/privacy`, `/terms`, `/install`, app routes unchanged. hreflang ar/en, correct lang/dir, canonical, OG image. No fake testimonials/numbers; unknown facts = `[PLACEHOLDER]`.
App shell: bottom nav, short interruptible transitions (View Transitions API when available, else opacity), skeletons, empty/error states, dark/light.

## 4. Team and ownership (one owner per file)
design-lead: motion spec in docs/BRAND.md + tokens. ux-designer: landing copy/flows. barmej (Opus, medium): QawamMark, landing, shell. alsaqr: bundle/perf review. security-reviewer: CSP regression. qa-tester: Playwright. Reviewers of this plan: alsheikh (owner chose) and alsaqr ("الوحش" does not exist in /agents).

## 5. Fonts
Self-host a subsetted Arabic+Latin font only after its licence is verified upstream (IBM Plex Sans Arabic is OFL; to confirm and log). Until then system stack. font-display: swap, preload one weight.

## 6. Budgets (measured, not promised)
Mark + component <= 6 KB gzip JS/CSS plus <= 4 KB gzip SVG. Landing JS (no Three.js) <= 150 KB gzip. Lighthouse mobile perf >= 90, LCP < 2.5 s (4G, mid phone), CLS < 0.1. Today three.js chunk is 132 KB gzip lazy; it stays lazy and out of LCP.
Measure with Lighthouse CLI (free) on the deployed site and a throttled profile; report real numbers.

## 7. QA (before "done")
Playwright (free): screenshots + short recordings of each mark state, iPhone/Android/desktop, AR/EN, light/dark; reduced-motion run; hidden-tab pause check; throttled CPU frame-rate numbers; axe; Lighthouse; existing 82 tests; CSP check. Short results table, previews, wait for owner approval. Not testable by me: real iPhone/Android hardware (owner checks).

## 8. Risks
1. Exactness vs size of the mark (mitigated by pixel diff + owner sign-off). 2. Traced layers may not animate nicely as groups: spike first with 2 states, show owner, then continue. 3. Headless Edge is not a mid-range Android; frame rate numbers are indicative only. 4. Turnstile site key still missing (signup blocked until owner creates the widget).

## 9. Steps after "go"
1 SVGO + pixel diff, 2 QawamMark spike (intro+idle) + /brand/motion.html, owner checkpoint, 3 remaining states, 4 landing, 5 shell polish, 6 QA + budgets, 7 review (alsaqr, alsheikh), 8 deploy.

## Review (alsaqr)
Measured during review: logo-symbol.svg = 36.7 KB raw, 14.0 KB gzip, ~2,960 `L` points already at 1 decimal. framer-motion is in package.json but not imported in src.

### Must-fix
1. **Size target is unreachable as written.** The paths are already 1 decimal, so SVGO at 1 decimal saves almost nothing (14 KB gzip vs a 4 KB target). Options: integer + relative coordinates (estimate 6-8 KB gzip), or point decimation, which changes the geometry. Re-set the budget from a real SVGO run, or get the owner to approve simplification using the pixel diff. Don't promise "0 visible change" and 4 KB together.
2. **`<symbol>`/`<use>` blocks per-layer animation.** The cloned shadow tree can't be targeted by outside CSS or WAAPI; only inherited props and CSS custom properties pass through. The animated mark must be inline SVG (a build-time JSX component, rendered only where it animates). Static uses get `<img src>` (cached, 0 JS). Drop the sprite idea.
3. **The clip-path wipe is not compositor-only.** On SVG children it repaints the whole SVG every frame (jank on mid-range Android). Per-layer motion should be opacity + transform only, with `transform-box: fill-box` and an explicit `transform-origin`. If a wipe is wanted, put one clip-path/mask on the HTML wrapper, not on 12 layers. Measure with the DevTools paint-flashing and Performance panels under 4x CPU throttle.
4. **Grouping by colour can break paint order.** The 16 paths are interleaved in z-order. A group may only merge paths that sit next to each other in that order. Run the pixel diff after grouping, not just after SVGO.
5. **Idle loop.** Pause off-screen with IntersectionObserver, not only on `document.hidden` (browsers already throttle hidden tabs). Consider stopping the breathing after about 3 cycles on the landing page to save battery and main-thread time.
6. **Session-once intro and LCP.** Lighthouse always runs a fresh session, so it always sees the intro. Play the intro in place on the hero mark, not as an overlay. Real content must never be opacity 0 or covered (that delays LCP). sessionStorage try/catch is fine; reuse the existing helpers.
7. **View Transitions.** Use React Router 7's `viewTransition` flag. Skip it when prefers-reduced-motion is set. Keep it <= 200 ms. Give the mark its own `view-transition-name` or exclude it, so it isn't snapshotted mid-animation. A Suspense lazy route must resolve before the transition starts, or you get a blank frame. CSP is fine (pseudo-elements in a 'self' stylesheet).
8. **CSP.** `style-src 'self'` allows WAAPI `el.animate()` and CSSOM `style.setProperty` (scripted CSSOM is not blocked). SVG `style="..."` attributes and `<style>` inside the SVG are blocked, so strip them in SVGO (convertStyleToAttrs). Add a Playwright check that fails on any `securitypolicyviolation` event.
9. **Measurement.** Lighthouse mobile: 5 runs, report the median. Add TBT/INP and a dist gzip size check script that fails the build when over budget. If the owner has any Android phone, use Chrome remote debugging (free) for one real frame-rate trace. Headless numbers are indicative only.
10. **Remove the unused framer-motion dependency** (plan section 2 already says it is not used).

### Delete / reuse
- Delete: `src/intro/Intro.tsx` (after moving `shouldPlayIntro`/`markPlayed` into src/brand) and `src/three/introScene.ts`; remove their import in `src/app/App.tsx`.
- `src/three/heroScene.ts`: drop unless it passes section 6 (default: delete).
- `src/three/Runner.tsx`: currently not imported anywhere. Park it for the Workouts screen, out of every chunk.

### Verdict
**Approve with changes.** The direction is sound (CSS/WAAPI, transform/opacity, lazy three, budgets). Fix items 1-3 before the step 1-2 spike, because they change the SVG pipeline and the component design. Items 4-10 can be folded into the steps.

## Review (alsheikh) 2026-11-15
Verdict: GO for steps 1-2 (spike) only, after the must-fix items below are folded in. Full build waits for the owner checkpoint. Presentation-only scope and the no-GSAP/no-Framer decision are sound.

Measured during review: `public/logo-symbol.svg` is 36,697 B raw, 14,005 B gzip, 16 paths with 16 distinct fills (not 12), no `<g>`, no `style=` attributes, coordinates already at 1 decimal and polyline-only (`L` segments).

Must-fix
1. Size target is not reachable as written. The file is already 1-decimal, so SVGO precision gives almost nothing; 14 KB gzip to 4 KB needs point reduction / curve refit, which does change geometry. Replace "pixel diff = 0" with a stated tolerance (e.g. rendered at 512 px and 64 px, max visible delta agreed by owner side by side), try 0-decimal + relative commands first, then simplification. If 4 KB cannot be met without visible change, raise the SVG budget (8 to 10 KB gzip, loaded once and cached as a file) instead of bending the shape. Section 6 must carry the same number as section 1.
2. `<symbol>` + `<use>` conflicts with per-layer state animation. Selectors match the original tree, not the `<use>` instance, so two marks in different states cannot be styled independently, and an external-file `<use>` cannot be styled at all. Decide: the animated instance is inline SVG (one per page, hero/loader); every static instance is `<img>`/`<use>` of the cached file.
3. The layers are colour-quantised trace bands, each a compound multi-subpath, not semantic parts. Per-layer translate ("accent shift 2 px") or per-layer scale will open seams between bands. Restrict per-layer motion to opacity and stagger; do transform (scale, settle, press) on the root only. Name the "accent" paths by fill in BRAND.md (the two orange fills #eb801c / #f8aa1f are the obvious candidates) before the spike.
4. Engine rule contradicts itself: "transform/opacity only" but intro uses a clip-path wipe. Either allow one clip-path animation on the root for the intro only (one-shot, measured on throttled CPU) or do the wipe as a translated cover/mask rect. Also set `transform-box: fill-box; transform-origin: center` for anything transformed inside the SVG.
5. Four states vs five rows. The brief says 4 states; the table has intro, idle, interaction, loading, success and the prop lists 4. Make "interaction" a CSS `:hover/:active` modifier of idle, not a state, and say so.
6. CSP (`style-src 'self'`, no `unsafe-inline`): allowed = external CSS classes, WAAPI, CSSOM writes from script (`el.style.setProperty`, React `style` prop on the client). Blocked = `style=""` in served/prerendered HTML, `<style>` blocks, runtime style-tag injection, SMIL is to be avoided. So: `size` via width/height attributes or classes, stagger via `:nth-child` rules in the CSS file, sparks as pre-declared elements, `/brand/motion.html` with external CSS/JS only. `public/_headers` and `functions/_lib/http.ts` are not edited; `tests/api/static-rules.test.ts` stays green untouched.
7. RTL: do not flip the wipe with `dir`. A mark that is not mirrored must animate identically in AR and EN (direction follows the mark's own geometry). Only the lockup placement and page layout follow `dir`. Add an AR/EN screenshot-equality check for the mark.
8. Protect the passing work. The project is not a git repository, so there is no rollback. Before step 1: local `git init` + baseline commit (no remote, no push), run the 82 tests and record the result. Rule for the rebuild: existing tests are never edited to pass, new UI gets new tests, `functions/`, D1, auth and i18n keys are frozen. `src/intro/Intro.tsx` is imported by the app (the logo is referenced in `App.tsx`, `ui.tsx`, `Intro.tsx`); remove it in its own step with a test run after.
9. `framer-motion` is listed in package.json but imported nowhere in `src`. The plan's "not in the bundle" is true, but remove the dependency so it cannot creep in, and re-run the build.

Should-fix
- Idle loop on a 16-path compound SVG repaints on every scale frame on weak phones. Run idle only while on screen (IntersectionObserver) plus the `document.hidden` pause, and promote the root to its own layer only while animating.
- Three.js hero mark: default is dropped. It adds risk and no acceptance criterion needs it; revisit only after budgets pass.
- Once-per-session intro must render the final static mark in the first paint (animation is enhancement), so LCP and CLS do not depend on JS.
- Fonts: a subsetted Arabic face can exceed the mark budget several times over; give it its own number in section 6.

## Amendments v2 (alrais, folds both reviews; these override sections 1, 2, 6)
1. Mark is INLINE SVG for the animated instance (hero/loader); static instances use the cached file via `<img>`. No `<use>` for animated states.
2. Per-layer motion = opacity + stagger only (layers are colour bands, transforms open seams). Scale/settle/press happen on the SVG root. Accent layers named by fill in BRAND.md: #eb801c and #f8aa1f.
3. Intro reveal = translated cover rect or one measured clip-path on the root, one-shot; everything else transform/opacity. `transform-box: fill-box` for inner transforms.
4. States = 4 (intro, idle, loading, success). Hover/press is a CSS modifier, not a state.
5. Budget: mark is 14 KB gzip today, so target is <= 15 KB gzip SVG (owner may choose to simplify geometry, only with a side-by-side approval) + <= 6 KB gzip component code. Fonts get their own budget, measured before bundling.
6. RTL: the mark animates identically in AR and EN (not mirrored); test = screenshot equality of the mark.
7. Idle runs only while on screen (IntersectionObserver) and tab visible. The static final mark is in the first paint (animation is an enhancement, no LCP/CLS dependence on JS).
8. Cleanup in its own step, tests run after: delete src/intro/Intro.tsx, src/three/introScene.ts, heroScene.ts (dropped, no Three.js hero unless budgets pass later), park Runner.tsx for Workouts, remove framer-motion.
9. Rollback/baseline: the repo IS under git with remote (commit dc5e3bb, 82 tests pass); one extra tag `pre-rebuild` is created before step 1. Rule: existing tests are never edited to pass; functions/, D1, auth and i18n keys are frozen.
10. Spike first (steps 1-2: mark optimization check + intro/idle + /brand/motion.html), owner checkpoint, then the rest.
