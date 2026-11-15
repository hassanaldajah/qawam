# QA report 1 (2026-11-15)

Baseline: `npm test` (5 files, 32 tests), `npm run typecheck`, `npm run build` all pass. Added `tests/qa/api-gaps.test.ts` and `tests/qa/ui-gaps.test.tsx`; the full suite is now 52 tests (51 pass, 1 expected fail).

## QA-1 (medium): no lower bound on target BMI in onboarding safety gate
- Repro: `canLeaveSafety({current:50, target:35, heightCm:170, age:30, sex:"m", activity:1.55, weeks:60, pregnant:false, medical:false})` returns true (target BMI 12.1).
- Cause: `src/lib/plan.ts` `evaluate()` checks rate, kcal floor, age, pregnancy and medical flags. It never checks the target BMI. docs/ux.md says an unsafe plan can't be saved, and a goal far below a healthy weight is unsafe.
- Fix: add an issue such as "bmi" when target BMI < 18.5.
- Test: `it.fails` in `ui-gaps.test.tsx`. Remove `.fails` once fixed.

## QA-2 (low, docs mismatch): backup code has no `QW-` prefix
- THREAT_MODEL 3.2 specifies `QW-<id>-<secret>`. `generateBackupCode()` returns grouped base32 only (10-char id + 26-char secret, 4-char groups). Functionally fine (tests pass). Update the doc or the code.

## QA-3 (low, gap): onboarding `makeBackupCode()` is not the server code
- `src/lib/plan.ts` `makeBackupCode()` makes a 16-char client-only code (80 bits), whereas the server issues a 36-char (130-bit) code through POST /api/auth/backup-code. If onboarding shows the client code, it can't restore anything. Check that the UI wires up the server code.

## Passing checks (new)
IDOR (forged user_id header, cross-user delete), 401 without session, delete strictness (confirm, extra fields, origin, CSRF header), export no-store with no hashes, restore (no enumeration, bounded backoff, no hard lock, revokes old sessions and shortcut keys), RTL default and dir switching, ar/en key parity, nav order, safety boundaries (1%/week, age 18, pregnancy/medical).

## Not covered
Real-browser RTL layout, a11y (axe), offline/quota states, Turnstile. These need Phase 8 tooling.
