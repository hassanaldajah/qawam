# Design System (Qawam)
Palette and tokens are fixed: see `docs/BRAND.md`, `src/index.css`, `src/tokens.ts`. Do not change them. Arabic RTL is default; EN is LTR.

## Scales
- Spacing (px): 4, 8, 12, 16, 24, 32, 48. Page padding 16; card padding 16; gap between cards 12.
- Radius: 8 input/chip, 12 button, 16 card, 9999 pill/ring.
- Type (rem, line-height): 12 caption 1.4; 14 small 1.5; 16 body 1.6 (min body size); 20 title 1.4; 24 h2 1.3; 32 h1/stat 1.2. Weights 400/500/700. Arabic gets +0.1 line-height.

## Color usage
Use only CSS vars: `--bg` page, `--card` surfaces, `--border` lines, `--fg` text, `--primary` fills (button bg, active nav, ring), `--accent` emphasis text, `--green` success text. Light: primary #0E6577 with white text. Dark: primary #75D02B with #101729 text. Never use raw teal #16869E for text. Never hardcode hex in components. Chart series: primary, accent, green, then `--fg` at 50% opacity. Do not rely on color alone (add icon or label).

## Components
- Button: min-height 44, min-width 44, padding 0 16, radius 12, 16/500. Primary = `--primary` bg + `--on-primary`. Secondary = transparent, 1px `--border`, `--fg`. States: hover +8% darken, pressed scale .98, disabled 40% opacity, focus 2px `--primary` outline offset 2.
- Card: `--card` bg, 1px `--border`, radius 16, padding 16, no shadow in dark, `0 1px 2px rgb(16 23 41/.08)` in light.
- Input: height 48, radius 8, 1px `--border`, padding-inline 12, 16px font (prevents iOS zoom). Focus 2px `--primary`. Error: 1px `--accent` plus message text plus icon. Label above, 14/500.
- Bottom nav: height 56 + safe-area-bottom, 4-5 items, each at least 44x44 hit area, icon 24 + 12px label always visible. Active = `--primary` icon/label plus 3px top bar. `--card` bg, top border.
- Progress ring: 96 default (160 hero), stroke 8, round cap, track `--border`, value `--primary`, start at top, center shows 24/700 value + 12 unit. Fill direction clockwise in LTR, counterclockwise in RTL. Expose `role=progressbar` with aria-valuenow.
- Chart: height 160-200, 1px `--border` gridlines (max 4), 12px axis labels, 2px lines, bars radius 4 top. Mirror x-axis order in RTL (oldest at right). Provide text summary for screen readers. Numerals: follow locale setting consistently.
- Toast: bottom 72 + safe-area (above nav), max-width 360, radius 12, `--card` bg, 1px border, 14px text, 4s auto dismiss (6s with action), `role=status`. Error uses `role=alert`.
- Skeleton: `--border` fill, radius matching target, shimmer 1.2s linear loop; static fill under reduced motion.

## RTL rules
- Use logical properties only: `margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align:start`, Tailwind `ms-/me-/ps-/pe-/start-/end-`. No `left/right`.
- Set `<html dir lang>` per language.
- Mirror directional icons (back, chevron, arrows, progress direction, swipe): `[dir=rtl] .icon-dir{transform:scaleX(-1)}`. Do not mirror logos, clocks, checkmarks, play, charts' axes glyphs, or media.
- Keep numbers/units in `<bdi>` or `dir=auto`; latin names inline use `unicode-bidi:isolate`.

## Motion
Durations: 120 micro, 200 standard, 300 sheet/page. Easing `cubic-bezier(.2,0,0,1)`. Animate only transform/opacity. Under `prefers-reduced-motion: reduce`: durations 0.01ms, no shimmer, no ring/chart sweep (render final value), no parallax.

## Touch and a11y
All interactive targets 44x44 min, 8px gap between neighbors. Text contrast at least 4.5:1 (verified in `tests/contrast.test.ts`), UI components 3:1. Visible focus on all controls.

## Font recommendation (not yet adopted)
Primary: IBM Plex Sans Arabic (Arabic) plus IBM Plex Sans (Latin), both SIL OFL 1.1; matched metrics. Alternative: Noto Sans Arabic + Inter (OFL). Verify license text in each upstream repo before bundling, include OFL files, self-host WOFF2 (no Google CDN, for privacy/offline PWA), subset, `font-display:swap`. Stack: `"IBM Plex Sans Arabic","IBM Plex Sans",system-ui,sans-serif`. Weights 400/500/700 only.

## Neon
Tokens (additive; base palette unchanged): `--neon-teal #19D3F0`, `--neon-lime #9BFF2E`, `--neon-orange #FFA630`, `--neon-navy #101729`.
Contrast (WCAG): navy text on neon fill: lime 14.2, teal 9.9, orange 9.1. Neon text on navy bg: same values (AA). Neon vs light bg #F6F8F7: lime 1.2, teal 1.7, orange 1.8; vs white 1.25/1.8/1.95. White text on neon always fails.

Gradients (angle 135deg):
- `--g-tl: linear-gradient(135deg,#19D3F0,#9BFF2E)`
- `--g-lo: linear-gradient(135deg,#9BFF2E,#FFA630)`
- `--g-to: linear-gradient(135deg,#19D3F0,#FFA630)`
- `--g-tlo: linear-gradient(135deg,#19D3F0,#9BFF2E 50%,#FFA630)`
- `--g-night: linear-gradient(160deg,#101729,#0E6577)`

Glow: `0 0 8px color-mix(in srgb,C 60%,transparent),0 0 24px color-mix(in srgb,C 30%,transparent)` (C = a neon token). Dark mode only; light mode uses `0 4px 14px` at 25% alpha.

Usage:
- Fills (buttons, ring, bars, badges): any gradient with `#101729` text (AA, at least 9.1). Never white text.
- Text: neon only on dark bg. Light mode keeps `--primary/--accent/--green`.
- Borders and icons: dark bg only (3:1 passes). On light, 2px `--primary` outline; neon is decoration.
- Glows and large graphics (hero ring, streak, confetti): decorative, never the sole signal.
- Reduced motion: no pulsing glow.

Macros (dark / light): protein `#19D3F0`/`#0E6577` (9.9 / 6.3), carbs `#FFA630`/`--accent` (9.1), fat `#9BFF2E`/`--green` (14.2), water `#4DA3FF` (6.8 on navy), steps `#FF5FA2` (6.3 on navy). Always pair with label or icon.
