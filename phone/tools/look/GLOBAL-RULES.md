# The packed app's rules for EVERY word and box, and where KIB Next applies them

21 Nov 2026. The packed app is a web page. Four style sheets restyle every screen at once, whatever the screen's
own code says: Tailwind's base (`app/globals.css`), `components/star/ui/flat.css`, `pitchLook.css` and
`glassLook.css` (the last three are loaded by `app/star-dev/page.tsx`; the root carries
`star-root star-look-pitch star-skin-glass`). KIB Next has no style sheets, so each rule is either applied
ONCE in the middle (rules 1 to 3) or by a shared piece (the rest). How each line is known: **read** (from the
style sheet), **measured** (the two apps side by side in one browser, numbers read from both pages; see the end).

## Applied once, to every `<Text>` (`phone/src/rn.js` → `phone/src/ui/look/globalText.js`)

| # | Packed rule | Exactly | In KIB Next |
|---|---|---|---|
| 1 | **Line box.** Every word sits on a line 1.5 × its size | Tailwind base: `html { line-height: 1.5 }`. `text-[Npx]` sets the size only, so a 10 px word has a 15 px line, 11 → 16.5, 12 → 18. Named sizes carry their own: `text-xs` 12/16, `text-sm` 14/20, `text-base` 16/24, `text-lg` 18/28, `text-xl` 20/28, `text-2xl` 24/32, `text-3xl` 30/36, `text-4xl` 36/40, `text-5xl` and up 1.0. A `leading-*` class wins: `leading-none` 1.0, `leading-tight` 1.25, `leading-snug` 1.375, `leading-relaxed` 1.625, `leading-[N]` N | A Text whose style sets no `lineHeight` gets `fontSize × 1.5`. A style's own `lineHeight` always wins (use it for `leading-none`, `leading-tight` and the named sizes). Left alone: a Text inside a Text (it sits on the outer one's line), a `TextInput`, and a Text that is only signs or emoji (`★`, `▾`, `🏆`: up to 8 characters with no letter or digit), because a tight line can cut an emoji on a phone |
| 2 | **Anton** for headings and big bold words | `flat.css` rule 1: `h1`–`h4`, `.sk-display`, `.sk-num`, and any element with `font-bold`, `font-extrabold` or `font-black` AND a size class of 16 px or more (`text-[16px]`…`text-[69px]`, `text-lg` and up), not `input`/`textarea`: `font-family: Anton; font-weight: 400`. With `font-extrabold`/`font-black` (not `font-bold`) at 16–39 px and no `leading-none`: `letter-spacing: 0.012em`. NOT matched: `text-base` (16 px by name), a size set by an inline style, `font-semibold`. Words inside such an element inherit Anton | A Text with `fontWeight` 700 or more and `fontSize` 16 or more, and no `fontFamily` of its own, is drawn in Anton at weight 400; with weight 800/900 under 40 px and no `letterSpacing` of its own it gets `fontSize × 0.012`. A Text inside a Text uses the outer size when it sets none. To keep the body font on a big bold word (the packed app's `text-base font-bold`, or a size set inline): `fontFamily: FONT.sans`. `.sk-num` under 16 px (the top bar's 13 px numbers, the 14 px star level) is not caught by size: those name `FONT.display` themselves |
| 3 | **Soft shadow** on light words | `glassLook.css` rule 3: `.text-white`, `text-white/NN`, `text-amber-*`, `text-yellow-*`, `h1`–`h3`: `text-shadow: 0 1px 2px rgba(0,0,0,.55)`. Inherited by everything inside. NOT matched: a colour set by an inline style or by another rule (the bottom bar's words, the top bar's `?`, round filter pills) | A Text whose `color` is white at any strength, or an amber/yellow (hue 34°–58° with saturation ≥ 0.7, plus Tailwind's amber-600/700 and yellow-700), and that sets no shadow of its own, gets `rgba(0,0,0,0.55)`, offset 0/1, radius 2. Switch it off for one Text with `NO_SHADOW` (`ui/look/tokens.ts`). A style's own shadow always wins |

Also set there: `allowFontScaling={false}` (the packed page ignores the phone's font size) and, on Android,
`includeFontPadding: false` (so a line is exactly as tall as its `lineHeight`). `Animated.Text` and Skia's drawn
words do not pass through `rn.js`: they keep what their own code sets.

Browser only, for comparing: `localStorage["kib.look"] = "off"` draws every Text without the three rules;
`"lh"`, `"anton"`, `"shadow"` (any list) leaves those out.

## Read, and NOT applied in the middle (why)

| Packed rule | Exactly | KIB Next |
|---|---|---|
| Stronger shadow on small capitals over the stadium | `pitchLook.css` (end): inside a dashboard page or a `stadium` Screen, an element that is `uppercase` or has `tracking-*` AND is white / amber / yellow / emerald / green / lime / sky (or a `[data-sk-kicker]`), not in the top bar or the player card: `0 1px 2px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.55)` | React Native draws one shadow per Text and cannot tell which page it is on. Kickers set `TEXT_SHADOW` themselves (`Kicker`, `world/ui Title`). Measured: 8 words in 34 screens |
| Scoreboard glow | `pitchLook.css`: `.font-black.tabular-nums` of 16–39 px: `0 0 10px rgba(255,255,255,.18), 0 1px 0 rgba(0,0,0,.6)` | Not applied (two shadows; a faint glow). Open |
| Default ink | `<body class="text-gray-100">`: a word with no colour is `#f3f4f6` | No KIB Next word is left without a colour (measured: 0 in 34 screens), so nothing is set |
| Shadow inherited by dark words | A dark word inside a `.text-white` box still gets rule 3's shadow (the player card's numbers) | Not applied: KIB Next sees one Text at a time. Measured: about 250 words in 34 screens, most of them emoji and the player card |

## Applied by shared pieces

| Packed rule | Exactly | KIB Next piece |
|---|---|---|
| Top bar, row 1 (`ui/GameBar.tsx`, glassLook 4) | 48 tall, 12 at the sides, 6 between; fill `rgba(14,30,52,.42)` with a blur behind, a 1 px line `rgba(255,255,255,.26)` under it, bottom corners 20. Name: Anton 15 on an 18.75 line, spacing 0.375, capitals, cut with "…". Chips: white 16 %, a 1 px rim `rgba(255,255,255,.26)` inside, radius 10, padding 4/6, 4 between. AGE 9 px black on a 9 line, spacing 1.08, white 78 %. Numbers: Anton 13 on a 13 line. ★ 12 px `#f59e0b`. `?` and the gear: 32 square, radius 10, white 16 %, rim white 30 %; `?` Anton 17, no shadow; the gear is an 18 px drawing | `ui/look/TopBar.tsx` (the gear is `assets/look/icons/gear.png`, made from the website's own drawing) |
| Top bar, row 2 (`ui/TopHud.tsx`) | its own band, same fill, line and corners; 8 at the sides, 10 above, 8 below; two cells 36 tall; the star's level Anton 14; a round red `!` (15 px, at 34/−6) while a Star Pass reward waits | same file. `world/chrome.tsx GameTop` now always passes the Star Pass, so the `!` shows on League and Phone too |
| Bottom bar (`MainBar.tsx`, glassLook 5 and 6) | 1 px line `rgba(255,255,255,.28)`, top corners 22, fill `rgba(14,30,52,.48)` with a blur behind; 4 above, 6 at the sides and below, 4 between. Buttons 50 tall, radius 14, no fill; 18 px picture on an 18 line, 2 under it the word: 12 px black on a 15 line (11 on 13.75 under 380 wide), white 88 %, no shadow. The screen you are on: a green line (20 × 3, `#34d399`, 4 from the foot) and a shadow on its word. Home: always a shadow; on Home a pane (white 18 %, rim white 34 %) and pure white. PLAY: 66 round, 20 above its place, rim 1 px `rgba(200,255,220,.9)` (also on a match day: glassLook 6 overrules the amber ring), a drawn triangle (24 box) over PLAY 11 px on an 11 line, spacing 0.55. Numbers: 17 tall, 10.5 px, ring `rgba(255,255,255,.26)` 2 px. On a FULL screen (League, Shop, Sponsors, Achievements, Star Pass: `page.tsx mainBarRaw`) the bar gets no numbers, only a red dot on Phone while something is unread | `ui/look/BottomBar.tsx` (`plain` = the full-screen bar), `ui/look/Buttons.tsx PlayButton` |
| Glass card | `--sk-card: linear-gradient(180deg, rgba(14,30,52,.62), rgba(10,22,40,.70))`, blur 14 behind; `.kit-card`: radius 16, `inset 0 1px 0 rgba(255,255,255,.22), inset 0 0 0 1px rgba(255,255,255,.2), 0 8px 22px -10px rgba(0,0,0,.55)` | `ui/look/Glass.tsx` (a little more solid, no blur) |
| Rows, tabs, inputs | `.kit-row` white 7 %, rim white 10 %; `.kit-tabs` `rgba(10,22,40,.6)`, rim white 16 %, radius 14.4, padding 3; `.kit-tab` black, capitals, spacing 0.12em, white 72 %; `.kit-tab-on` white 20 %, rim white 34 %, 2 px `#22e36b` line inside its foot; `.kit-input` `rgba(6,14,28,.7)` | `ui/look/CapsTabs.tsx`, `world/ui.tsx Seg`, the screens' own rows |
| Screen title plaque | `[data-sk-header] > .min-w-0`: padding 2/12/4, radius 10, `rgba(10,22,40,.58)`, rim white 20 % | `ui/look/BackPill.tsx ScreenHeader` |
| Old Tailwind greys | `bg-gray-400…950` and `slate` are re-pointed to blue-slate (`--sk-g400: 120 140 170` … `--sk-g950: 10 20 38`; calm pages: `128 134 144` … `21 23 27`) | `LOOK.navy` / `navyDeep` and each screen's own colours |
| Page floor | the day stadium, blurred 12, brightness .85, under `--sk-page` (6,18,34 at 10 % → 4,14,24 at 55 %); Shop, Store, Casino: charcoal `#262a31 → #15171b` | `ui/look/Backdrop.tsx` |
| Switch | rim white 30 %; on: knob `#22e36b` with a glow | each screen's own |

## How it was measured

Both apps in one Chromium at 412 × 915 and 360 × 780 (`phone/tools/playtest/drive.mjs`, the packed page drawing
Roboto through `bench/fonts.conf`), the same save in both. For every word on a screen: its box, size, weight,
font, line height, spacing, colour and shadow, read from both pages and paired by the words themselves.
The tour and the counting scripts are in `phone/tools/look/global/` (`README.md` there).
