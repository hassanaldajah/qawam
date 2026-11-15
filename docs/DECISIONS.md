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

## 2026-11-15 alsaqr review (proposed; see docs/THREAT_MODEL.md + PLAN.md "Challenges")
- Quota bypass via free anon accounts: per-IP quota, atomic reserve-before-AI-call, global neuron counter as final limit; Turnstile (free, VERIFY it stays free).
- Push SSRF: cron Worker only fetches allow-listed push-service hosts.
- Push: payload-less pushes (encryption costs CPU); service worker fetches content.
- Backup-code lockout: increasing delays per account + per-IP limits, no hard lock (avoid victim lockout).
- iOS Home-Screen PWA may not share Safari cookies => possible second account; UNVERIFIED, test on real iPhone; backup code is the bridge.
- Owner panel: aggregates only, Cloudflare Access only if verified free.
- Session cookie `__Host-` prefix; shortcut-key schema moves to phase 2; export + delete account built early.
- Reviewer note: alsaqr suggested dropping alsheikh (owner dropped it 2026-11-13), but owner re-chose "alsaqr + alsheikh" today for plan/final review only.

## 2026-11-15 owner instruction: no owner password / no owner panel
- Dropped: owner panel, OWNER_SECRET, Cloudflare Access for the panel, owner-hash CPU concern.
- Replacement: admin tasks (usage stats, pause/resume AI, approve foods) via `wrangler d1 execute` / a local script run by the owner. A global `ai_enabled` flag lives in D1. Zero extra attack surface, free.
- Foods: only the built-in USDA/recipe table; user custom foods stay private. No public approval flow.
- PLAN.md feature H and related threat-model rows are superseded by this entry.
