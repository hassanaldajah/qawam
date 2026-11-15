# Qawam / قوام — PLAN (draft v0)

## Context
Free, bilingual (AR RTL default / EN) mobile-first fitness+nutrition PWA on Cloudflare free tier at qawam.al-hassan.dev. Health numbers => accuracy and security first. Project dir: C:\Users\plati\qawam (local git, no push). Reviewers: alsaqr (+ alsheikh only for plan review and final review), security-reviewer each phase. ("الوحش" does not exist.)

## Verified so far (to be copied to docs/VERIFIED.md with dates, 2026-11-15)
- Workers AI free: 10,000 Neurons/day shared pool, resets 00:00 UTC, errors after (developers.cloudflare.com/workers-ai/platform/pricing). VERIFIED.
- D1 free: 5M rows read/day, 100k rows written/day, 500 MB/db, 5 GB/account; queries fail at cap (developers.cloudflare.com/d1/platform/pricing). VERIFIED.
- Pages Functions share Workers Free: 100k req/day, **10 ms CPU/invocation**. Mostly verified.
- UNVERIFIED: Cron on Pages (likely not supported, needs a separate Worker); free-plan cron limits; VAPID signing within 10 ms; iOS Web Push details; Shortcut variable alert time.

## Key risks found
1. **10 ms CPU** breaks PBKDF2/bcrypt for owner password. Use Web Crypto SHA-256 on a high-entropy owner secret (random 32+ chars) with constant-time compare, plus rate limit. Session tokens are 256-bit random, so SHA-256 hashing is fine.
2. **Neurons budget**: one vision call may cost hundreds+ neurons => maybe only dozens of photos/day globally. Measure real cost first; global daily counter pauses AI. Per-user quotas (3 photos/day) may exceed the shared pool; global cap decides.
3. **Cron + Web Push**: put in a separate Worker (cron trigger) sharing the D1; VAPID ES256 signing via Web Crypto per push; if >10 ms, batch small or fall back to in-app reminders only. Decide after a measured spike.
4. 100k req/day: no polling, cache nutrition JSON as static asset.

## Architecture
- Vite + React + TS + Tailwind, Radix, lucide, Framer Motion, zustand, i18next (logical CSS props), Three.js lazy-loaded.
- Cloudflare Pages + `functions/api/*` (same-origin), D1 (migrations in /migrations), separate `workers/cron` for reminders.
- Auth: anonymous account, 256-bit random token in HttpOnly/Secure/SameSite=Lax cookie (~1y), only SHA-256 hash in D1; backup code (>=128-bit, shown once, hashed, rate-limited, lockout); CSRF via SameSite + Origin check + custom header.
- Every query scoped by user_id (IDOR tests). Zod validation, parameterized SQL, strict CSP, security headers.
- AI: only extracts {name, grams}; output schema-validated, untrusted; all kcal/macro math deterministic over nutrition table. Photo: size/type cap, EXIF strip, never stored.
- Nutrition: USDA FDC build script -> versioned JSON + D1 mirror; Arabic recipes computed; Arabic fuzzy matching; sanity check 4/4/9.
- Goal engine: pure functions with hand-computed unit tests (90 kg ->80 kg/100 d ≈ 770 kcal/day, ≈0.78%/wk).
- Security: ASVS L2 target, OWASP API Top 10, STRIDE in docs/THREAT_MODEL.md first.

## Phases (each: tests green -> security review -> /compact)
0. Pre-flight docs: THREAT_MODEL, VERIFIED, PLAN review by alsaqr+alsheikh; spike: measure neuron cost + CPU ms (needs your Cloudflare login, interactive).
1. Brand/logo: 3 SVG directions -> your pick -> tokens, icons, BRAND.md, preview.html.
2. Foundation: scaffold, design system, i18n/RTL, D1 schema, auth/session, CI (audit + secret scan).
3. Nutrition table + fuzzy search + manual logging + dashboard.
4. AI logging (photo/text) + quotas + rate limits + global pause.
5. Goal engine + steps + water + measurements + plateau.
6. Workouts + Three.js mannequin.
7. Ramadan, favorites/recipes, reminders (push + cron), shortcut endpoint + guides, owner panel.
8. Full QA (Playwright iPhone/Android/320/tablet x AR/EN, axe, Lighthouse), final security audit, deploy guide.

## Token plan
Cheap model (Sonnet) for scaffolding/CRUD/UI/tests/docs; alsaqr for schema, auth, goal math, security; grep-first reads; docs/ as memory; /compact after each phase; PROGRESS.md updated per milestone.

## Needs from you later (not now)
Cloudflare login (wrangler), real iPhone for push/shortcut tests, `wrangler secret put` for OWNER_SECRET/VAPID keys (never in chat).

## Verification of this phase
Review PLAN with alsaqr and alsheikh; fill VERIFIED.md; then wait for your "go".

## Challenges (alsaqr review, 2026-11-15; details in docs/THREAT_MODEL.md)
1. **Reviewer roster is out of date**: the owner dropped alsheikh on 2026-11-13. Phase 0 and the final review should be alsaqr + security-reviewer only.
2. **Account farming bypasses per-user AI quotas**: anonymous accounts cost nothing to create. Add Turnstile (free) on account creation and on AI calls, a per-IP quota, and an atomic quota reservation before each AI call. The global neuron counter stays authoritative.
3. **iOS Home-Screen PWA storage is separate from Safari**, so the cookie does not carry over after "Add to Home Screen". The onboarding and restore UX must plan for this. Add it to VERIFIED.md as UNVERIFIED.
4. **Web Push cost is underestimated**: payloads need RFC 8291 encryption (ECDH+HKDF+AES-GCM) on top of ES256 signing. Use payload-less pushes plus a service worker fetch, and cache the VAPID JWT per push origin (up to 24 h).
5. **Push SSRF is missing**: the cron Worker fetches user-supplied endpoints. Allowlist the push-service hosts at subscribe time and at send time.
6. **The owner panel should use Cloudflare Access** (Zero Trust free tier) as its first gate, with OWNER_SECRET as the second. It should show pre-aggregated `stats_daily` built by cron, never raw health rows, to respect privacy and the 10 ms CPU limit.
7. **The shortcut key is not designed**: it needs a separate hashed credential, write-only scopes, a Bearer header (never in the URL), a revoke list, value bounds and idempotency. Add it to the phase 2 schema, not phase 7.
8. **Backup-code "lockout" lets anyone lock out a victim**: use per-account exponential backoff plus per-IP limits plus Turnstile. The code format includes a public id so lookup and rate limiting can be done per account.
9. **D1 write budget**: per-request `last_seen` or rate-limit writes would burn 100k writes/day. Refresh at most daily, and count only failures and expensive calls. Check whether the Workers Rate Limiting binding exists on Free.
10. **"EXIF strip" server-side is not CPU-feasible**: resize plus re-encode on the client via canvas (<= 768 px). The server checks only magic bytes and size, and accepts raw bytes, not base64.
11. **Missing privacy features**: data export, hard delete of the account, generic lock-screen notification text, and checking whether Oman PDPL applies to health data. Add these to the acceptance criteria.
12. **Cookie needs the `__Host-` prefix**: other `*.al-hassan.dev` sites (portfolio etc.) could otherwise inject cookies. Enable HSTS `preload` only after auditing every subdomain.
13. **Security headers must cover Functions responses too**: `_headers` only covers static assets. Add shared middleware and test both paths.
14. **Accuracy**: AI grams estimates are unreliable. The user must confirm or edit items before saving, and kcal/macro math always comes from the nutrition table.
15. **The spike list is missing items**: CPU for the session path, a 1 MB AI request, Access JWT verify, the free-tier cron trigger count, D1 Time Travel retention on Free, and the push host list.
