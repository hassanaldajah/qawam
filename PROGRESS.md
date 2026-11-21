# PROGRESS (2026-11-21)
Done: plan + threat model + security reviews; D1/auth/API; app screens.
2026-11-21 landing rebuild (not committed yet): new brand-dark landing (src/landing/Landing.tsx + landing.css), Alexandria font self-hosted,
3D robot intro/hero removed (three.js dropped). Logo rebuilt from owner's artwork: scripts/build-mark.py -> src/brand/markPaths.ts +
public/brand/qawam-mark.webp; <QawamMark> animates ONLY the legs in place. New icons, og.png, logo-mark.svg.
Verified: build OK, 82/82 tests, typecheck, desktop + 390px screenshots.
Next: owner review -> commit + push (Cloudflare Pages deploys qawam.al-hassan.dev). Needs VITE_TURNSTILE_SITEKEY in Pages env.
2026-11-21 v2 (not committed): Rubik font, softer palette (--bg #0A141F), living background (section tones via @property, pointer spotlight, logo pattern),
header with scrollspy + progress + mobile menu, interactive "Try it" demo, back-to-top, new copy AR/EN. Build OK, 82/82 tests. Deploy = manual wrangler (no git integration).
2026-11-21 v3 (not committed): frameless animated landing header (gradient underline scrollspy, top progress line, flowing CTA);
onboarding fully rebuilt (src/onboarding/Onboarding.tsx + onboarding.css): side stepper, steppers, choice cards, range, switches, live plan bar,
results summary, code tiles; logic/API/gates unchanged. Intro splash holds 1.8s first load per session, legs faster (.5s, splash .36s). 82/82 tests.
