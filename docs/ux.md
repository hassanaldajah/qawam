# Qawam UX (AR RTL default / EN)

## Principles
Honest numbers (estimates labelled), user confirms before save, no shaming, phone-first (320px+), one-hand reach, logical CSS props, no owner panel.

## Screens
Onboarding (language, goal, safety, backup code), Today (dashboard), Log (search/photo/text/manual + confirm), Food detail, Workouts (list, session, mannequin), Progress (weight, measurements, steps, water, plateau), More (settings, reminders, Ramadan, export, delete, restore, install guide, shortcut guide).

## Bottom nav (5)
Today | Log (center, primary) | Workouts | Progress | More. Labels always visible; active = color + icon fill + `aria-current`. Mirrors in RTL.

## Onboarding
1. Language (AR default, switch anytime).
2. Goal: current/target weight, date, height, age, sex, activity. Live preview: kcal/day and %/week.
3. Safety gating: loss above ~1%/week, kcal below floor, age under 18, pregnancy/breastfeeding, or medical condition shows a warning and caps or redirects to "talk to a professional". User cannot save an unsafe plan; the app suggests a safe date.
4. Backup code, shown once: copy, download .txt, mandatory "I saved it" checkbox. Honest notice: "No email or password. If you clear browser data or switch device or browser, you lose access unless you have this code."
5. Optional: reminders and install, never blocking.

## Meal logging
- Entry: Log tab, 3 tabs: Text (default), Photo (bonus), Manual.
- Text: free text in AR/EN, AI extracts name+grams, user reviews.
- Photo: camera or gallery, client resizes (~768px), shows quota left. Never stored.
- Manual: fuzzy Arabic search, recents, favorites.
- Confirm sheet (required): each item has editable grams (stepper + input), raw/cooked toggle where relevant, "Estimate" chip on AI grams, kcal/macros computed from table, total. Save disabled until user taps Confirm. Remove or add item, unmatched item prompts search.
- Undo toast after save (6s).

## States
- Empty: Today "No meals yet. Log your first one." with CTA. Progress: "Add your first weigh-in."
- Loading: skeletons (no spinner only), AI: "Analysing..." with Cancel, 20s timeout.
- Error: inline, plain, retry button, keep user input. Never lose a draft.
- Offline: banner "Offline. You can log manually; it syncs later." AI tabs disabled with reason. Queue manual logs locally.
- Quota exhausted (per user/IP): "Photo limit reached for today. Text and manual logging still work. Resets at {time}" where {time} = 00:00 UTC rendered in the user's own timezone via Intl.DateTimeFormat (e.g. 04:00 in Muscat, UTC+4). Never hardcode.
- Global AI paused: "AI is resting today to stay free. Manual logging works." No blame.
- Rate limited restore: "Too many tries. Wait N minutes."

## Ramadan mode
Toggle in More (suggest by date). Today shows Suhoor / Iftar / Evening slots, fasting window from user-set prayer times, water plan in the eating window, reminders shift. Workout suggestion after iftar. Neutral language, user can skip fasting days.

## iOS install and push
Detect iOS Safari not standalone: after first log (not first load) show a sheet: Share, Add to Home Screen, with illustrated steps. Warning: "The installed app may start as a new account. Restore with your backup code." Restore screen reachable from first screen. Push: ask only inside installed app, after a user tap on "Enable reminders" with a pre-explanation, never on load. Denied: show how to re-enable. Lock-screen text generic: "Qawam: time to check in".

## Microcopy
| Key | AR | EN |
|---|---|---|
| estimate | تقدير | Estimate |
| confirm | أكّد الكميات | Confirm amounts |
| save | احفظ الوجبة | Save meal |
| backup | رمز الاسترجاع: احفظه الآن | Recovery code: save it now |
| lost | بدونه لا يمكن استرجاع حسابك | Without it your account can't be recovered |
| offline | لا يوجد اتصال | You're offline |
| quota | انتهى حد الصور اليوم | Photo limit reached today |
| unsafe | هذه الخطة قد لا تكون آمنة. استشر مختصاً | This plan may be unsafe. Please consult a professional |
| disclaimer | معلومات عامة وليست نصيحة طبية | General info, not medical advice |

## WCAG 2.2 AA checklist
- Contrast 4.5:1 text, 3:1 UI, both themes.
- Targets at least 44px (min 24px).
- Visible focus ring, logical order mirrored in RTL, no traps in sheets (Radix), Esc closes.
- `lang`/`dir` on html, mixed content with `dir="auto"`, numerals consistent (user choice AR-Indic/Latin).
- Labels on all inputs, errors linked via `aria-describedby`, `role="alert"` for errors, `aria-live=polite` for totals.
- Never color alone (macros have icons/text); charts have text/table alternative.
- `prefers-reduced-motion` disables Framer and 3D autoplay; mannequin has text alternative.
- Zoom 200% and 320px reflow, no horizontal scroll; text resizable.
- Toasts persist 6s+ and are pausable; no time limits on the backup step.
- Camera/photo has file picker fallback; screen reader tested (TalkBack, VoiceOver).
- axe + Lighthouse a11y in Phase 8 on 320/phone/tablet x AR/EN.
