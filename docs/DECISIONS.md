# DECISIONS
## 2026-11-15 alsheikh advisory (proposed, pending owner "go"; nothing measured yet)
- Photos: resize/re-encode on client (canvas ~768px JPEG, drops EXIF); server checks size + magic bytes only.
- Arabic fuzzy search runs client-side (Web Worker over static JSON) or D1 FTS5; not in a Function (10 ms CPU).
- `_routes.json`: only /api/* invokes Functions (100k req/day is account-wide).
- Global AI counter = one atomic `UPDATE ... WHERE used < cap RETURNING`. Text logging default, photo a bonus.
- Phase 0 spike also measures push signing.
- Accuracy: user must confirm grams before save, photo grams labelled estimates; USDA Foundation/SR Legacy only with explicit raw/cooked + yield factors; 4/4/9 check with tolerance (fibre/alcohol); goal engine moves BEFORE the dashboard phase; calorie floors + under-18/pregnancy gating.
- Cron Worker separate from Pages; cache VAPID JWT per origin; payload-less pushes; index next_fire_at; ~40 pushes/tick, carry over.
- Owner secret: generated 256-bit random, SHA-256 + constant-time compare; consider Cloudflare Access (free) in front of owner panel (to verify).

## 2026-11-15 owner instruction: publishing
- AFTER the code is finished and all gates pass: create a PUBLIC GitHub repo, push, and connect it to Cloudflare Pages (Git integration).
- Public repo => before push: secret scan clean, no .dev.vars/tokens/owner secret, no personal data, USDA credit in README, license chosen.
- Not before completion. Not earlier phases.

## 2026-11-15 owner rule: 100% free, never billed
- Stay on Cloudflare Free plan only; never upgrade to Workers Paid. On Free, limits make requests fail instead of billing (verify in docs before deploy).
- Any new tool/service/font/library/asset must be free (open license) with no trial, card, or paid tier. Check each before adding; record in VERIFIED.md.
- Cloudflare Access (free tier) only if verified free for our use; otherwise skip.
- Fail closed: global AI counter pauses AI before the free pool ends.
