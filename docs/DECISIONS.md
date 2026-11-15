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
