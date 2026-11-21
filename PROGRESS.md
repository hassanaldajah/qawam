# PROGRESS (2026-11-21)
Done: plan + threat model + security reviews; D1/auth/API; app screens.
2026-11-21 landing rebuild (not committed yet): new brand-dark landing (src/landing/Landing.tsx + landing.css), Alexandria font self-hosted,
3D robot intro/hero removed (three.js dropped). Logo rebuilt from owner's artwork: scripts/build-mark.py -> src/brand/markPaths.ts +
public/brand/qawam-mark.webp; <QawamMark> animates ONLY the legs in place. New icons, og.png, logo-mark.svg.
Verified: build OK, 82/82 tests, typecheck, desktop + 390px screenshots.
Next: owner review -> commit + push (Cloudflare Pages deploys qawam.al-hassan.dev). Needs VITE_TURNSTILE_SITEKEY in Pages env.
