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

## 2026-11-15 security-review-1 fixes (per docs/security-advice.md)
- Restore: NO per-account lock or failure counter (any account-keyed lock is attacker-controlled). Defence = 130-bit secret + per-IP (/64) 10 attempts/h consumed first + Turnstile on every attempt; one 401 shape, dummy-hash compare for unknown ids.
- Turnstile (free: unlimited challenges, 20 widgets) required on account create (body `{turnstileToken}`) and restore (`{code, turnstileToken}`). Server: siteverify checks success + hostname + action (`create`/`restore`); failure 403, siteverify down or secret missing 503. Secret only via `wrangler pages secret put TURNSTILE_SECRET` / `.dev.vars`.
- Frontend contract (src/, not done yet): load `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` from the bundle on the create/restore screens only; execute at submit (tokens single-use, 300 s); never self-host api.js, never add COEP; the future service worker must not intercept challenges.cloudflare.com. Client must not auto-create an account on 401 (2-year absolute session cap, L7).
- RL_KEY secret (HMAC for IP rate-limit keys) is required; missing = 500. Set with `wrangler pages secret put RL_KEY`.
- Backup code: rotation needs `{currentCode}`; lost code = `{lostCode:true}` with session only, other sessions KEPT, `backupCodeResetAt` returned by GET /api/auth/session for a banner on every device. 3 codes/day.
- Export v2: first call returns page 1 of every table + `next` cursors; `?table=<name>&after=<cursor>` for further pages (2000 rows/page). 5 full exports/h, 200 pages/h.
- Housekeeping: 1% of consume() calls purge old rate_limits (>2 days) and audit_log (>90 days), 500 rows per table per run. Replace with a cron Worker when one exists.
- meal_items FKs are composite (meal_id, user_id) / (custom_food_id, user_id). Deleting a custom food endpoint must first `UPDATE meal_items SET custom_food_id = NULL WHERE custom_food_id = ? AND user_id = ?` in the same batch; map FK errors on insert to 404.
- Owner dashboard task (free): one WAF rate-limiting rule on `/api/*` so floods are blocked before they spend the 100k/day Functions budget.

## 2026-11-15 design note: future /api/shortcut/* (iOS Shortcuts), not implemented
- Exempt from the Origin / X-Qawam / Sec-Fetch-Site checks ONLY when `new URL(req.url).pathname.startsWith("/api/shortcut/")` (never `includes`).
- Such requests MUST carry `Authorization: Bearer <key>` (hash looked up in shortcut_keys, scopes enforced, revoked/expired rejected) and MUST be rejected (400) if a `Cookie` header is present, so the cookie session can never ride on the exemption.
- Per-key rate limit + body cap apply as everywhere else.

## 2026-11-15 security fix round 2
- Turnstile order (create + restore): per-IP siteverify meter (30/h) -> siteverify (3 s timeout) -> strict action buckets. Bots without valid solves cannot drain a shared IP's restore/create allowance; garbage tokens cannot cause unbounded outbound fetches.
- Account creation: 5/h and 10/day per /64, 200/h global. Accepted residual: a distributed attacker paying for solves can fill the global cap (sign-up outage, no data exposure). Owner should add the free WAF rate rule and watch for `create_global_cap_hit` in logs.
- Orphan accounts (no session, no backup code, >1 day old) are deleted by purgeExpired: they are unreachable, so keeping their health data has no user benefit.
- Backup code: lost-code reset 1/day (own bucket), rotation 3/day; rotation is compare-and-swap.
