# Qawam / قوام: Threat Model (v0, 2026-11-15)

Scope: Qawam PWA on Cloudflare free tier (Pages + `functions/api/*`, D1, Workers AI, separate cron Worker, Web Push, iOS Shortcut endpoint, owner panel). Target: OWASP ASVS 4.0.3 Level 2 plus the OWASP API Security Top 10 (2023).
Hard limit: **10 ms CPU per invocation**. I/O wait (D1, AI, fetch) does not count toward CPU time. Parsing, crypto, JSON and base64 work does count.
Data class: health data (weight, measurements, food, Ramadan fasting habits). Treat all of it as **sensitive personal data**. Oman PDPL (Royal Decree 6/2022) treats health data as a special category. Applicability is UNVERIFIED, so check before launch.

## 1. Assets
| Asset | Why it matters |
|---|---|
| Session token (cookie) | Full access to one account |
| Backup code | Account recovery, so it is a long-term credential |
| Shortcut key | Lets an attacker write health data without a browser |
| Owner secret / owner session | Read-all aggregate view, global AI pause control |
| Health records in D1 | Privacy, and a reputational or legal risk |
| Neurons / request / D1-write budgets | Shared daily pools. Exhausting one is a full outage (DoS) |
| VAPID private key | Lets an attacker send push to every subscriber |
| Push subscriptions (endpoint + keys) | Can be abused for spam or SSRF |

## 2. Trust boundaries
Browser/PWA <-> Pages Function (internet). Function <-> D1 / Workers AI (internal binding). Cron Worker -> push services (outbound internet). iOS Shortcut -> API (internet, no cookie). Owner browser -> owner panel.

## 3. STRIDE per component

### 3.1 Anonymous account and session cookie
| Threat | Example | Mitigation |
|---|---|---|
| S | Stolen or guessed token | 256-bit token from `crypto.getRandomValues`. Store only SHA-256(token) in D1. Cookie: `__Host-qs=...; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`. The `__Host-` prefix prevents subdomain cookie injection from other `*.al-hassan.dev` sites. |
| T | Session fixation | Always issue the token server-side. Rotate it on backup-code restore and on any privilege change. |
| R | User disputes deleting data | Keep a minimal audit row (event, ts, user_id, no payload) for delete, restore and key-create events. |
| I | Token in logs or URLs | Never put tokens in query strings. Redact `Cookie`/`Authorization` in any logging. Do not log request bodies. |
| D | Mass account creation fills D1 (100k writes/day) | Use Turnstile (free) on account creation. Add a per-IP creation limit (for example 5/h). Lazily create the account on the first real write, not on first visit. |
| E | Accessing another user's rows (IDOR, API1) | Derive `user_id` **only** from the session hash, never from the request. Every query includes `WHERE user_id = ?`. Use a repository layer whose functions require `userId`. Add IDOR tests per endpoint (user A token + user B ids -> 404). |

Sliding refresh: update `last_seen` at most once per day (D1 write budget). Never update it per request.

### 3.2 Backup code (recovery)
- Format: `QW-<account_public_id 8 chars>-<secret 26 chars Base32>`. That gives 130 bits of secret. Group it in chunks for readability. Show it once, offer copy and download, and require an "I saved it" confirmation.
- Storage: SHA-256(secret) with constant-time compare. A slow KDF is unnecessary at 128+ bits of entropy, and the 10 ms limit forbids one anyway.
- Lookup by public id, then compare. This lets you rate-limit **per account** and **per IP**.
- Lockout: use exponential backoff per account (1, 2, 4 ... up to 1 h) rather than a hard lock, because a hard lock lets anyone deny service to a victim whose public id they know. Add a per-IP limit (10 failures/h) and Turnstile after 3 failures. At 130 bits, brute force is infeasible anyway. The limits mainly protect D1 and the CPU budget.
- On a successful restore: issue a new session, revoke all old sessions (option shown to the user), and offer to regenerate the code.
- Maps to ASVS V2.5 (credential recovery), V2.2 (anti-automation), V2.6 (look-up secrets: high entropy, single display, hashed).

### 3.3 API (`functions/api/*`)
| Threat | Mitigation |
|---|---|
| CSRF | `SameSite=Lax` plus a strict `Origin` check (must equal `https://qawam.al-hassan.dev`; reject a missing Origin on state-changing methods) plus a required custom header `X-Qawam: 1`, which forces a CORS preflight. No CORS `Access-Control-Allow-Origin` for cookie routes. State changes only via POST/PUT/DELETE, never GET. |
| Injection (SQL) | Use D1 prepared statements with `.bind()` only. Lint rule: no template strings inside `prepare()`. |
| Mass assignment (API3) | Zod `.strict()` schemas per endpoint. The server sets `user_id`, `created_at` and computed kcal. |
| Unrestricted resource use (API4) | Body size cap (JSON 16 KB, photo 1 MB after client resize). Pagination caps (max 100). Per-user and per-IP rate limits. |
| Excessive data exposure | Response DTOs are explicit allowlists. No `SELECT *` serialization. |
| Broken function-level auth (API5) | Owner routes are under `/api/owner/*` with separate middleware. Default deny. Run route-table tests that list every route with its required role. |
| Error leakage | Generic error JSON with a correlation id. No stack traces. |
| Security misconfiguration (API8) | Apply headers to **both** static (`_headers`) and Functions responses (shared middleware), and test both. |

Rate-limit storage: D1 counters cost writes. Prefer the Workers Rate Limiting binding if it is available on Free (UNVERIFIED). Otherwise use a per-minute bucket row per key with an `INSERT ... ON CONFLICT DO UPDATE`. Only count failures and expensive calls (AI, auth), not every read.

### 3.4 Photo/text -> Workers AI
| Threat | Mitigation |
|---|---|
| Prompt injection (text inside the image, or a typed "ignore instructions") | Treat the model as an untrusted parser. A fixed system prompt asks only for JSON `[{name, grams}]`. Validate output with Zod: max 10 items, name <= 60 chars, grams an integer in 1..2000. Map names to the **nutrition table only** (fuzzy match). Unknown items need the user to pick one. Never render model text as HTML. Never let model output trigger actions. The user confirms before saving. |
| Quota bypass (new anonymous accounts, parallel requests) | Per-user quota **plus** a per-IP quota **plus** a global daily neuron counter (the counter is authoritative) **plus** Turnstile token per AI call. Reserve quota atomically **before** calling the AI: `UPDATE quota SET used=used+1 WHERE user_id=? AND day=? AND used<?`, and proceed only if changes=1. Refund on AI failure. This avoids the TOCTOU race. |
| DoS on budget (one user burns the shared neurons) | Global pause threshold at about 85% of the measured daily neurons. The owner can pause. Degrade to manual logging. |
| Malicious file (polyglot, decompression bomb) | Resize on the client to <= 768 px JPEG via canvas, which also strips EXIF/GPS. The server checks magic bytes (FFD8FF / PNG / WebP), a size cap and Content-Type. The server does not decode the image (CPU). It never stores the photo. |
| CPU over 10 ms | Accept raw bytes (not base64 JSON), pass a `Uint8Array` straight to the binding, and keep the image small. Measure in the spike. |
| Information disclosure | Photos may show faces or homes. Do not store them, do not log them, and state this in the privacy text. |

### 3.5 Shortcut key (iOS Shortcuts)
- A separate credential from the session: `qk_` + 256-bit random. Store only the hash. Show it once.
- **Scope**: write-only and narrow (`POST /api/shortcut/water`, `/steps`, `/weight`). It cannot read history, export, delete, create keys or touch the backup code. Each key carries an explicit `scopes` column.
- Send it in the `Authorization: Bearer` header, never in the URL (URLs leak into logs, history and screenshots).
- Revocation: list the keys (label, created, last used, rounded to the day) with one-tap revoke. Limit of 3 keys per user. Optional expiry. Revoke all keys when the backup code is restored.
- Validation: bounded values (water 0..5000 ml, steps 0..100k, weight 20..400 kg). Idempotency key for each day plus value to stop duplicate floods. Rate limit of 60/h per key.
- No CORS on these routes. CSRF does not apply because there is no cookie. Reject requests that carry a cookie on shortcut routes, so the two auth modes stay separate.

### 3.6 Owner panel
- Put **Cloudflare Access (Zero Trust free tier, up to 50 users)** in front of `/owner*` and `/api/owner/*` as the first gate (One-time PIN to the owner email). In the Function, verify the `Cf-Access-Jwt-Assertion` JWT (JWKS cached; one RS256 verify fits in 10 ms but needs measuring). Add `OWNER_SECRET` as a second factor: SHA-256 plus constant-time compare, which is fine at 32+ random chars. Mark this UNVERIFIED until the spike.
- If Access is not used: owner login issues a separate short-lived session (`__Host-qo`, 8 h, `SameSite=Strict`) with a lockout of 5 failures/15 min per IP plus global alerting.
- **CPU**: D1 query time is I/O and does not count, but serializing big results does. The cron Worker pre-aggregates into `stats_daily`. The panel reads only aggregates, with pagination of 50 and no raw health rows. Maintain counts incrementally where possible.
- Privacy by design: the owner sees counts and budgets, **not** individual users' health data. Least privilege (ASVS V1.4, V4.1).
- Owner actions (global AI pause, key rotation) are audit-logged and need a re-check of the secret.

### 3.7 Web Push and cron Worker
| Threat | Mitigation |
|---|---|
| SSRF via subscription endpoint (the attacker submits `https://internal/...` or any URL; the cron fetches it) | Allowlist the endpoint **host** at subscribe time **and** at send time: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com`. Require `https:`, no credentials, no IP literals, no non-default ports, URL length <= 1024. Check this list against current browsers in the spike (UNVERIFIED). |
| Push spam / subscription flooding | At most 5 subscriptions per user, deduplicated by endpoint. Delete on 404/410. |
| VAPID key theft | Keep it in `wrangler secret` only, in the cron Worker only. The Pages Function never needs the private key. Have a rotation plan (users must resubscribe). |
| CPU over 10 ms | Payload encryption (ECDH + HKDF + AES-GCM, RFC 8291) plus ES256 signing per message is heavy. **Send payload-less pushes** (VAPID JWT only). The JWT can be cached per push-service origin for up to 24 h, so a batch costs about 1 signature per origin. The service worker then fetches `/api/reminders/next` to show content. Process a small batch per cron tick. Note: iOS requires a visible notification per push. Make sure the SW always shows one. |
| Information disclosure | Notification text stays generic ("time to log water"), with no weights or values on the lock screen. |
| Cron abuse | The cron Worker has no public `fetch` handler (or returns 404). Use `scheduled` only. |

### 3.8 D1 / data layer
- Encryption at rest is provided by Cloudflare. There is no field-level encryption (the key would sit next to the data anyway).
- Data minimization: no name, email or phone. Optional age, sex, height. Measurements are user-entered.
- Rights: **export** (JSON) and **delete account** (hard delete of all rows, sessions, keys and subscriptions) in settings. ASVS V8.3.
- Backups: D1 Time Travel (verify the free-tier window, UNVERIFIED). Migrations are reviewed and reversible.
- Integrity: CHECK constraints for value ranges in the schema, plus Zod.

### 3.9 Frontend / PWA
- CSP (strict, nonce-free because the app is a static SPA): `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests`. Framer Motion and Radix set styles via CSSOM, which `style-src` does not block, but verify in the browser before deciding on `'unsafe-inline'` for styles. No inline scripts (Vite build). Three.js needs no `unsafe-eval`. Use CSP report-only first in staging.
- Headers: `Strict-Transport-Security: max-age=63072000; includeSubDomains` (add `preload` only after checking every subdomain of al-hassan.dev serves HTTPS), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), geolocation=(), microphone=()`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
- Service worker: never cache `/api/*` responses that hold health data in the Cache API. Cache static assets and the nutrition JSON only. Scope it to `/`.
- Store no secrets in localStorage. Show the backup code only in memory.
- XSS: React escaping. Ban `dangerouslySetInnerHTML` (lint). i18n strings must not contain HTML.
- Bidi/RTL: strip control chars (U+202A-202E, U+2066-2069) from user labels (key labels, recipe names) to stop display spoofing.

### 3.10 Supply chain / CI
- Lockfile committed, `npm ci`, `npm audit --audit-level=high` in CI, secret scan (gitleaks), pinned action SHAs, minimal dependencies. Follow the dependency rule: no libraries with recurring CVEs. Every Three.js / Framer addition needs a reason.

## 4. OWASP API Top 10 (2023) mapping
| # | Risk | Where handled |
|---|---|---|
| API1 | BOLA/IDOR | 3.1 E, repository layer, IDOR tests |
| API2 | Broken auth | 3.1, 3.2, 3.5, 3.6 |
| API3 | Property-level auth | Zod strict schemas, DTO allowlists (3.3) |
| API4 | Resource consumption | Quotas, global neuron counter, body caps, Turnstile (3.3, 3.4) |
| API5 | Function-level auth | Owner middleware, route-role tests (3.3, 3.6) |
| API6 | Sensitive business flows | AI quota race, account farming (3.4, 3.1 D) |
| API7 | SSRF | Push endpoint allowlist (3.7) |
| API8 | Misconfiguration | Headers on static and Functions, CSP, no CORS (3.3, 3.9) |
| API9 | Inventory | Route table doc plus test. No debug routes in prod |
| API10 | Unsafe API consumption | AI output and push service responses treated as untrusted (3.4, 3.7) |

## 5. ASVS L2 focus chapters
V1 architecture (this doc), V2 authentication (2.2 anti-automation, 2.5 recovery, 2.6 look-up secrets, 2.9 crypto keys), V3 session (3.2 binding, 3.3 logout/revoke, 3.4 cookie flags), V4 access control (4.1, 4.2 IDOR), V5 validation (Zod, SQL params, output encoding), V7 errors/logging (no sensitive data in logs), V8 data protection (8.3 export/delete, no caching of sensitive responses), V9 TLS/HSTS, V12 files (photo caps, magic bytes, no storage), V13 API (CSRF, content type, schemas), V14 config (headers, dependencies, secrets in wrangler only).
Note on ASVS 2.4 (slow password hashing): there are no user passwords. Secrets are 128-256-bit random, so a fast hash (SHA-256) is acceptable. Document this deviation explicitly for the owner secret.

## 6. Residual risks / to verify in the spike
1. Real neurons per photo, and therefore the real daily photo capacity.
2. CPU ms for: session lookup path, AI request handling with a 1 MB body, ES256 sign, Access JWT verify.
3. iOS Home-Screen PWA uses **separate storage from Safari**, so a cookie made in Safari does not carry over. The restore-via-backup-code UX must cover this (UNVERIFIED on current iOS).
4. Workers Rate Limiting binding availability on Free. Cron trigger limit per account on Free.
5. Push-service host list is current for Safari/iOS, Chrome, Firefox, Edge.
