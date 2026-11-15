# Security review 1: backend (functions/, migrations/0001_init.sql, wrangler.toml, public/_routes.json)

Date: 2026-11-15. Against docs/THREAT_MODEL.md. Read-only review; no code was changed.
Checks done: manual read of every backend file, npm audit (0 vulnerabilities, prod and dev), grep for secrets (none found).
Not reviewed: src/ frontend, tests, features not yet written (AI, shortcut keys, push, owner panel). SSRF: no outbound fetch exists in the backend yet, so nothing to flag; re-check when push is added.

Count: Critical 0, High 1, Medium 5, Low 8, Info 3.

## Status (2026-11-15, fix round 1; approach per docs/security-advice.md; tests in tests/api/security-fixes.test.ts + static-rules.test.ts)
| ID | Status | Fix |
|---|---|---|
| H1 | Fixed | public/_headers: /* = SECURITY_HEADERS minus Cache-Control (test enforces equality); /assets/* immutable; /, /index.html, /sw.js no-cache. Built index.html has no inline script/style. Runtime CSP check in a browser still UNVERIFIED. |
| M1 | Fixed (server) | Turnstile siteverify (success+hostname+action) on create and every restore; 503 fail-closed; IPv6 keyed on /64; global create cap 200/h. Frontend widget not yet built (contract in DECISIONS.md). |
| M2 | Fixed | Per-account lock removed entirely (columns dropped); correct code always works. |
| M3 | Fixed | UNIQUE (id, user_id) on meals/custom_foods; composite FKs on meal_items (CASCADE for meals, no action for custom_foods). Insert tests cover cross-user rejection + users cascade. |
| M4 | Fixed | Non-safe requests with a body need numeric Content-Length (411); readBodyBounded counts stream bytes and cancels past cap; fatal UTF-8 decode. |
| M5 | Fixed | 5 exports/h; per-table rowid cursor pages of 2000 (200 pages/h). CPU not measured on Cloudflare. |
| L1 | Fixed | Rotation needs current code; lost-code path keeps sessions and sets a banner flag; 3/day. |
| L2 | Fixed | Locked path gone; unknown id and wrong secret share one 401; dummy-hash compare. |
| L3 | Fixed | consume() (atomic) before any work; parallel test proves cap holds. |
| L4 | Fixed | HMAC-SHA256 with required RL_KEY; bounded purge on 1% of consumes; user-keyed buckets deleted on account delete. |
| L5 | Fixed | 400 missing_client_ip. |
| L6 | Fixed | 500 returns cf-ray as correlation id, logs name + ray only; audit purge after 90 days. |
| L7 | Fixed | Absolute 2-year session cap. |
| L8 | Fixed | Sec-Fetch-Site must be same-origin when present. Shortcut exemption: design note only (DECISIONS.md). |

## High

### H1. Static assets get no security headers (known)
- Location: public/_routes.json:3 (include only /api/*), no public/_headers.
- Risk: the middleware (functions/_middleware.ts:6-12) only runs for /api/*. HTML, JS, SW and manifest are served with no CSP, HSTS, nosniff, frame-ancestors, COOP/CORP. This is the XSS and framing defence for the SPA (threat model 3.9, API8).
- Fix: add public/_headers with the same values as SECURITY_HEADERS (functions/_lib/http.ts:5-18) under a /* rule, plus Cache-Control: no-cache for /sw.js. Generate both from one source and add a test that parses _headers and compares it with SECURITY_HEADERS.

## Medium

### M1. No Turnstile and weak anti-automation on account creation and restore
- Location: functions/api/auth/account.ts:11-30, functions/api/auth/restore.ts:22-59.
- Risk: threat model 3.1 D and 3.2 require Turnstile (creation; restore after 3 failures). Only a per-IP limit exists. IPv6 attackers rotate /128 addresses, so 5/h is bypassable and the D1 write budget (100k/day) can be exhausted by account farming.
- Fix: verify a Turnstile token (siteverify fetch; secret via wrangler secret). Key the IP limit on the IPv6 /64 (first 4 groups). Add a global creation cap per hour.

### M2. Backup-code backoff allows lock-out of a victim whose public_id is known
- Location: functions/api/auth/restore.ts:38-56.
- Risk: whoever learns a 10-char public id can send one bad guess per lock window and keep the owner at try_later (up to 1 h) indefinitely. This is the accepted trade-off of the design, but failed_attempts never decays and there is no alert. Likelihood of id leakage is unclear.
- Fix: decay on age inside the UPDATE (CASE WHEN last_failed_at < ?1 - 86400 THEN 0 ELSE failed_attempts END), add Turnstile (M1), show recent failed restores in settings.

### M3. FKs are not user-scoped (future IDOR)
- Location: migrations/0001_init.sql:76 (meal_items.meal_id -> meals(id)), :79 (custom_food_id -> custom_foods(id)).
- Risk: a row with user_id = A can reference user B meal or custom food. No insert endpoint exists yet, but the first one that trusts a client meal_id creates a cross-user link. Scoping is by convention only.
- Fix: composite keys. Add UNIQUE (id, user_id) to meals and custom_foods, then in meal_items use FOREIGN KEY (meal_id, user_id) REFERENCES meals(id, user_id) ON DELETE CASCADE and FOREIGN KEY (custom_food_id, user_id) REFERENCES custom_foods(id, user_id). ON DELETE SET NULL on a composite FK would null user_id, so use RESTRICT (delete order in tables.ts already handles it). Add per-endpoint IDOR tests (A token + B ids -> 404).

### M4. Body size cap bypassable and measured in characters
- Location: functions/_middleware.ts:22-23, functions/_lib/http.ts:40-43.
- Risk: the cap trusts Content-Length; with chunked transfer it is 0, so req.text() reads the whole body before text.length is checked (CPU/memory). text.length counts UTF-16 units, not bytes.
- Fix: require Content-Length on bodies (411), or read bytes first: const buf = await req.arrayBuffer(); if (buf.byteLength > MAX_JSON_BYTES) throw new HttpError(413, "payload_too_large"); then decode with TextDecoder.

### M5. Export has no rate limit and no size bound
- Location: functions/api/auth/export.ts:7-17.
- Risk: 13 queries per call and JSON.stringify of all rows. A heavy user can exceed the 10 ms CPU limit, so export fails when needed (ASVS V8.3); a stolen session or script can burn the D1 read budget. UNVERIFIED whether the CPU limit is hit; measure with a large seed.
- Fix: consume(db, "export:" + s.userId, 5, 3600, now) first; measure CPU; if close, export per table with a cursor (?table=meals&after=id, limit 5000).

## Low

### L1. Backup code regeneration needs only a session
- Location: functions/api/auth/backup-code.ts:15-36.
- Risk: a stolen cookie can mint a new code, invalidating the saved code and giving the attacker a permanent recovery credential. Other sessions survive.
- Fix: on regenerate when a code exists, revoke other sessions (DELETE FROM sessions WHERE user_id = ?1 AND token_hash <> ?2); lower the cap from 10/day to about 3.

### L2. Locked state leaks account existence and skips the IP limiter
- Location: functions/api/auth/restore.ts:47-55.
- Risk: locked id returns 429, unknown id 401, so ids can be enumerated (50-bit space, impractical). The 429 path does not bump the IP bucket, so a locked id can be hammered (UPDATE + SELECT per request).
- Fix: call bumpStatement on the locked path and return the same 401 invalid_code shape for both.

### L3. IP check-then-bump race
- Location: functions/api/auth/restore.ts:26,31.
- Risk: parallel requests all pass isLimited before any bump, exceeding 10/h by the concurrency level.
- Fix: bump first (consume style) and decide on the result.

### L4. rate_limits never purged; IP hash unsalted
- Location: functions/_lib/ratelimit.ts:5-7, migrations/0001_init.sql:172-178.
- Risk: unbounded growth (storage and writes). sha256("ip:"+ip) is reversible by enumerating IPv4, so a D1 leak exposes IPs. bc:<userId> rows survive account deletion.
- Fix: cron DELETE FROM rate_limits WHERE window_start < ?1; use HMAC-SHA256 with a secret key; delete user-keyed rows on account delete.

### L5. clientIp falls back to shared "unknown"
- Location: functions/_lib/http.ts:59-61.
- Risk: a missing header puts all clients in one bucket (self-DoS or test bypass).
- Fix: fail closed in production (400); fixed value only under a dev flag.

### L6. Audit log keeps user_id after deletion; no correlation id
- Location: functions/api/auth/account.ts:43, migrations/0001_init.sql:181-187, functions/_middleware.ts:33-37.
- Risk: pseudonymous UUID retained forever (deliberate; PDPL applicability UNVERIFIED, so set a retention). Error JSON has no correlation id (threat model 3.3).
- Fix: cron purge of audit rows older than 90 days; generate crypto.randomUUID() in the 500 path, log it, return it.

### L7. No absolute session lifetime
- Location: functions/_lib/session.ts:62-73.
- Risk: sliding refresh extends forever; a leaked cookie stays valid while the device is in use (ASVS V3.3).
- Fix: reject sessions with created_at older than 2 years (add AND created_at > ?now - 63072000).

### L8. CSRF defence-in-depth gaps
- Location: functions/_middleware.ts:15-25.
- Risk: current CSRF checks (exact Origin, X-Qawam, no CORS, no GET mutation) are sound. Missing: Sec-Fetch-Site check, and future shortcut routes (Bearer, no Origin) may be exempted too broadly.
- Fix: also reject when Sec-Fetch-Site is present and not same-origin. Exempt only /api/shortcut/*, require Authorization: Bearer, reject if a Cookie header is present.

## Info
- I1. Good: cookie flags match the threat model (__Host-qs, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain; session.ts:25); 256-bit token, only SHA-256 stored; restore issues a fresh session and deletes the old one (fixation safe); constant-time compare; backoff claimed atomically before compare.
- I2. Good: all queries use literal SQL with .bind(); user_id comes only from the session hash; export/delete tables filter user_id; hashes never exported; default-deny catch-all at functions/api/[[path]].ts (I believe more specific routes take precedence in Pages but did not run it).
- I3. Backup code format differs from spec (10-char id, no QW- prefix); entropy 130 bits matches. Restore deletes only the previous session of the device, so an orphaned anonymous account may remain; consider cleanup of sessionless users.

## Dependencies and secrets
- npm audit: 0 vulnerabilities (prod and dev) today. Versions in package.json (typescript 7, vite 8, vitest 5, zod 4) are newer than my knowledge, so I cannot judge them independently. Lockfile is committed. Add npm ci, npm audit --audit-level=high and gitleaks to CI (threat model 3.10).
- Secrets: none in tracked files. wrangler.toml holds only the public origin and a placeholder D1 id; .gitignore covers .dev.vars and .env*. Git history was only searched for one keyword, not fully scanned.

---

# Re-review (commit b4669e6, 2026-11-15)

Method: read the code, migration, `_headers`, built `dist/`, and tests; did not trust the status table. `npm audit`: 0 vulnerabilities. Secret grep: nothing real (only `.dev.vars.example` placeholders; `.dev.vars` ignored and untracked). Not run: the test suite, a browser, or Cloudflare (so CSP with the Turnstile widget, export CPU, and `_routes` precedence stay UNVERIFIED).

Result: all 14 original findings are closed in code. New: 0 Critical, 0 High, 0 Medium, 5 Low, 2 Info.

## Verification of the 14 findings
| ID | Verdict | Evidence |
|---|---|---|
| H1 | Closed | `public/_headers` `/*` matches SECURITY_HEADERS minus Cache-Control; `dist/_headers` identical; `dist/index.html` has no inline script/style; no sw.js exists yet. Browser CSP run UNVERIFIED. |
| M1 | Closed (server) | `turnstile.ts` checks success + hostname + action, 503 on missing secret or siteverify error. `/64` keying correct (`ipBucket` handles `::`, mapped IPv4, zone). Global cap in place. No frontend widget yet. |
| M2 | Closed | No lock columns or logic in `restore.ts`; correct code always works. |
| M3 | Closed | Composite FKs and parent `UNIQUE (id, user_id)` present; NULL `custom_food_id` is not checked by SQLite (correct); delete order meal_items, meals, custom_foods holds. |
| M4 | Closed | Middleware demands numeric Content-Length (411) and cap (413); `readBodyBounded` counts stream bytes and cancels; fatal UTF-8. |
| M5 | Closed | 5/h and 200 pages/h; cursor paging. CPU not measured (first page is still 13 tables x 2000 rows). |
| L1 | Closed, with residual (N3) | Rotation needs the current code. |
| L2, L3 | Closed | Consume first (atomic upsert); one 401 shape; dummy hash. |
| L4 | Closed | HMAC with RL_KEY; throws if missing (no plain-hash fallback); bounded purge; user buckets deleted on account delete. |
| L5 | Closed | 400 without CF-Connecting-IP. |
| L6 | Closed | 500 returns cf-ray only; no `e.message` logged; 90-day audit purge. |
| L7 | Closed | `created_at` absolute cap in `getSession`. |
| L8 | Closed | `Sec-Fetch-Site` must be `same-origin` when present. |

## New findings
### Low
- **N1. Global creation cap is a DoS lever.** `account.ts:12,31`. Anyone who can pay for Turnstile solves can spend 200/h and block new users. Accepted trade-off of the advice. Fix: keep it, add the free WAF rate rule on `/api/auth/account`, alert on `create_global` hitting the cap.
- **N2. Siteverify is unmetered and has no timeout.** `turnstile.ts:23`, `account.ts:26`. Turnstile runs before the per-IP consume, so garbage tokens cost one outbound fetch each; the fetch can hang. Fix: `fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(3000) })`, and use the WAF rule.
- **N3. Cookie thief can burn the backup-code cap and rotate with `lostCode`.** `backup-code.ts:42-51`. Three `lostCode` calls use the shared `bc:` bucket, so the owner cannot regenerate for 24 h; rotation check and upsert are not atomic, so two parallel rotations with the same current code both succeed. Banner is the only alert. Fix: separate bucket for `lostCode`, and make the upsert conditional on the old `secret_hash` (`WHERE secret_hash = ?old`, check `meta.changes`).
- **N4. Restore bucket is consumed before Turnstile.** `restore.ts:33-37`. Bots can use up 10/h for a shared IP or /64 (CGNAT, mobile) and block real users from restoring. Trade-off with N2. Fix: WAF rule; consider bumping on failed Turnstile only.
- **N5. Expired sessions are never purged.** `ratelimit.ts:29-38` handles rate_limits and audit_log only. Expired or abandoned rows grow (bounded by creation caps). Fix: add `DELETE FROM sessions WHERE rowid IN (SELECT rowid FROM sessions WHERE expires_at < ?1 LIMIT ?2)` to `purgeExpired`.

### Info
- **N6. UNVERIFIED: CSP with the live Turnstile widget.** Docs may also require `connect-src https://challenges.cloudflare.com` or style allowances; test in a real browser before the widget ships, and keep `_headers` and SECURITY_HEADERS equal.
- **N7. Deployment checklist.** `RL_KEY` and `TURNSTILE_SECRET` must exist as Pages secrets (missing RL_KEY gives 500 on create, restore, and later rate-limited routes, after a Turnstile token is spent). Replace the placeholder D1 id. I3 (orphaned anonymous accounts after restore) is still open and low risk.

Remaining by severity: Critical none, High none, Medium none, Low N1-N5, Info N6-N7 (plus I3).

## Status after fix round 2 (2026-11-15; tests in tests/api/security-fixes.test.ts "Re-review round 2")
| ID | Status | Fix |
|---|---|---|
| N1 | Fixed, residual accepted | Per-IP (/64) caps 5/h and 10/day bound one IP's share of the 200/h global cap; `create_global_cap_hit` logged as an alert hook. Residual: many IPs + paid Turnstile solves can still fill the global cap (availability only, no data risk); mitigate with the free WAF rate rule on /api/auth/* (owner dashboard task). |
| N2 | Fixed | siteverify has a 3 s AbortSignal timeout (503, fail closed) and is metered per IP (30/h, `siteverify` bucket) BEFORE the fetch. |
| N3 | Fixed | Rotation is a compare-and-swap (`WHERE secret_hash = old`, `meta.changes` checked, audit row via `changes() > 0` in the same batch); a losing parallel rotation gets 409. Lost-code path has its own 1/day bucket, so it cannot burn the 3/day rotation cap. Residual: a cookie thief can still do one lost-code reset per day (banner on all devices); a full cookie theft already equals account access. |
| N4 | Fixed | Strict restore bucket (10/h) consumed only after Turnstile passes; failed solves only hit the looser siteverify meter. |
| N5 | Fixed | purgeExpired deletes expired (sliding or 2-year absolute) sessions, bounded; getSession deletes on use. purgeExpired is the entry point for the future cron Worker. |
| I3 | Fixed | purgeExpired deletes unreachable accounts (no session, no backup code, older than 1 day) via the users FK cascade. |
| N6, N7 | Open (info) | Browser CSP check with the live widget and the deploy checklist (RL_KEY, TURNSTILE_SECRET, D1 id) remain before deploy. |
