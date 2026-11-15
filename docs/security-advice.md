# Security advice for review 1 (free plan only, 2026-11-15)

Cloudflare docs checked today.

**H1 `_headers`.** `/*`: every SECURITY_HEADERS value except `Cache-Control`. Then `/assets/*`: `public, max-age=31536000, immutable`; `/sw.js`, `/index.html`: `no-cache`. Test: `_headers` equals SECURITY_HEADERS minus Cache-Control. `_routes.json` is right as is. **Trap:** copying `no-store` kills offline; a header repeated across matching rules is comma-joined; 2000 chars per line. Never add plugin-legacy or inline SW registration. If a library injects `<style>`, allow only `style-src-elem 'self' 'unsafe-inline'`.

**M1 Turnstile.** Free: unlimited challenges, 20 widgets. Add `script-src` and `frame-src https://challenges.cloudflare.com` in both header sources. Load `api.js?render=explicit` from the bundle on create/restore only. Server order: siteverify (check `success`, `hostname`, `action`), per-IP consume, global `create_global` (200/h). Require it on every restore: no failure-count state. **Trap:** tokens are single-use, 300 s, so execute at submit; never self-host api.js or add COEP; SW must ignore that origin; siteverify error = 503.

**IPv6.** Expand `::`, key on the first 4 hextets; IPv4 whole. **Trap:** naive `split(":")` miskeys `2001:db8::1`.

**M2, L2, L3 restore.** Delete the per-account lock. Flow: `consume(ip, 10/h)` first, SELECT by public id, always hash and compare (dummy hash if unknown), one 401 shape. A correct code always works: no lockout, no oracle. Brute force stays infeasible (130 bits; NIST 800-63B requires throttling only below 64). **Trap:** decay does not fix M2; any account-keyed lock is attacker-controlled.

**M3.** Edit 0001 (not deployed): `UNIQUE (id, user_id)` on both parents; composite FKs, `ON DELETE CASCADE` for meals, no action clause for custom_foods. **Trap:** RESTRICT fires immediately and can break the `users` cascade; a missing parent UNIQUE errors only at first insert, so test real inserts; null `custom_food_id` before deleting a food; map FK errors to 404.

**M4.** Non-safe methods: Content-Length must match `^\d+$` (else 411) and fit a per-route cap; then read `req.body` by reader, count bytes, cancel past the cap; `TextDecoder({fatal:true})`. **Trap:** `arrayBuffer()` buffers everything first; `Number("x")` is NaN and passes today's check.

**M5.** `consume("export:"+userId, 5/h)`, per-table cursor.

**L1.** Rotation requires the current code; 3/day. Lost-code path: session-only, other sessions kept, banner everywhere. **Trap:** "revoke other sessions" lets a cookie thief evict the owner.

**L4.** HMAC with secret `RL_KEY`, throw if missing. Purge on 1% of consumes until the cron exists. **Trap:** unbounded DELETE; limit by rowid subquery.

**L5.** 400 without CF-Connecting-IP. **Trap:** dev flag only in `.dev.vars`.

**L6.** Return `cf-ray` as correlation id; 90-day purge. **Trap:** never log `e.message`.

**L7.** `created_at > now - 2y`. **Trap:** silent data loss without a backup code; client must not auto-create an account on 401.

**L8.** Reject non-safe requests whose Sec-Fetch-Site is present and not `same-origin`. **Trap:** exempt by `pathname.startsWith("/api/shortcut/")`, never `includes`.

**Extra.** Use the one free WAF rate-limit rule on `/api/*`: blocked requests never spend the 100k/day budget.
