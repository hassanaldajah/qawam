# BRAND
Logo: owner-supplied design (Gemini image, `brand/source/logo-board.jpg`), auto-traced to SVG: `brand/logo-symbol.svg`, `logo-wordmark-traced.svg` (outlined, no font), `logo-lockup.svg`. Wordmark is white: use on dark backgrounds; a dark variant is TODO.
Icons: `public/icons/` (192/512, maskable 192/512 with 58% safe zone, apple-touch 180, favicon 16/32), rendered from the SVG on navy `#101729`.

## Palette (from the logo)
green `#75D02B`, teal `#16869E`, orange `#FA9414`, navy `#101729`, white.
## UI tokens (WCAG AA verified by `tests/contrast.test.ts`)
| Token | Light | Dark |
|---|---|---|
| bg / text | #F6F8F7 / #101729 | #101729 / #FFFFFF |
| primary (button bg / on) | #0E6577 / #FFFFFF | #75D02B / #101729 |
| accent text | #A65300 | #FA9414 |
| green text | #2F7A12 | #75D02B |
Raw teal #16869E fails AA with white (4.25:1): never use it for text.
## Fonts
Not chosen yet (system stack for now). Candidates must be open-licensed (e.g. Noto Kufi Arabic / IBM Plex Sans Arabic, OFL): license check pending.
## TODO
Dark wordmark variant, OG image 1200x630, splash, clear-space/min-size rules, check distinctness from known fitness brands, 16px legibility review.
