# World loop: what the playtest found, and its status

21 Nov 2026. Packed app (`mobile/www`) beside KIB Next's web build at 412×915, the same save in both.
One round was started (League only), then the plan changed: playtesting moved to separate playtesters and
this builder became a fixer. Everything found is below. **seen** = a still of both apps; **measured** = the
two pages' own numbers (text box, font size, weight, colour, box size, padding, radius, shadow) read from
each page and compared; **read** = from the packed app's code only.

How the numbers were measured (reuse it): see `../README-situations.md`, "Measuring a screen".
Important for any measuring: the packed page's body font in desktop Chromium is not Roboto. Make it Roboto
first (the README says how), or every text width and line height is a false difference.

## Rule found that applies to EVERY screen (not yet applied everywhere)

`components/star/ui/flat.css` rule 1: in the packed app every heading (h1 to h4) and every **bold / black
text of 16 px or more** is drawn in **Anton** (one weight, letter-spacing 0.012em), not the body font.
KIB Next uses the body font at weight 900 in many of these places (measured on the League chooser title,
the round arrows, the top bar's numbers). Each world screen needs one pass for this: OPEN except where
marked fixed below.

`glassLook.css` rule 3: every white, amber or yellow text has a soft shadow (0 1px 2px black 55%). KIB Next
sets it only in some places. OPEN (shared `src/rn.js` would be the one place; it is not a world file).

## Round 1: League (fresh career, and 30 matches in)

| # | Screen | What | Severity | How known | Status |
|---|---|---|---|---|---|
| 1 | League table | Your row: packed is see-through club colour, lighter at the left, with a bright 1.5 px rim and a glow; KIB was a solid red band | MED | seen + measured | FIXED (`world/ui.tsx youRow` is now the website's `youRowStyle`) |
| 2 | League table | Your club's name was weight 900; packed 700 (only # and PTS are 900) | LOW | measured | FIXED |
| 3 | League table | KIB showed a colour key under the table (cut off by the bottom bar); packed shows none on a live table (only in the season review) | MED | seen + read | FIXED (removed from live league and Europe tables; kept in the review) |
| 4 | League table | Card: packed is ONE glass card, radius 16, head row `rgba(8,20,38,0.26)` with a line under; every second row white 3.5% | LOW | measured | FIXED (rows are slices of one card: `WorldPane.tsx carded()`) |
| 5 | Tabs TABLE · RESULTS · … | Track 37 px tall (KIB 42), radius 12, sunk dark `rgba(8,20,38,0.26)`; letter-spacing 0.55 (KIB 1.1); unchosen white 55% (KIB 62%); chosen pane white 15% radius 8, emerald line pokes 3 px under it | MED | measured | FIXED (`world/ui.tsx Seg`, world screens only; the shared `CapsTabs` is untouched) |
| 6 | Tabs at 360 wide | Packed drops to 10 px text under 380 wide | LOW | read | FIXED |
| 7 | "Premier League · YOURS · Change ▾" button | 46 px tall in packed, 42 in KIB | LOW | measured | FIXED |
| 8 | Results / fixtures | Packed: one card, rows 4 px apart, each row white 4%, score chip radius 6; KIB: separate boxed rows with borders | MED | seen + measured | FIXED |
| 9 | Results | Round arrows: 36 px squares radius 6, Anton 18 px; label 14 px, "of 38" 10 px white 70%. KIB: 40 px, 22 px, 15 / 11 px | LOW | measured | FIXED |
| 10 | Goals / Assists | One card, rows radius 8, 12 px bold (name 700), "goals" 9 px white 70%; KIB rows were bigger (12.5 px, 800) with borders | LOW | read + measured | FIXED |
| 11 | "No named players here yet." | 12 px in packed, 13 px in KIB; box is plain dark, radius 12 | LOW | measured | FIXED (`Empty`) |
| 12 | History | One card; year 9.5 px amber-300 `#fcd34d` (KIB 10.5 px `#f5c542`); REAL 8 px; winner 11.5 px (KIB 14); "2ND" and runner-up white 75% (KIB 62%), runner-up at most 112 px wide; leaders 10.5 px weight 600 white 75% | MED | measured | FIXED |
| 13 | Chooser "Every league and cup" | Title and ✕ are Anton 18 px; group words 10 px with 2 px spacing (KIB 10.5 / 1.8); rows 45 px (KIB 44) | LOW | measured | FIXED |
| 14 | Chooser | Your league's row uses the same lit row as #1 | LOW | seen | FIXED (same `youRow`) |
| 15 | Winner bar (cups, Europe) | Radius 12, 13 px name, glow in your club colour | LOW | read | FIXED (read only: not seen) |
| 16 | Shield final card | Glass card, score in Anton 20 px, names 12 px 700 | LOW | read | FIXED (read only: not seen) |
| 17 | International scorers and results | Same one-card rows as the leagues, drawn flag 18 wide | LOW | read | FIXED (read only: not seen) |
| 18 | Season review list | "Season N" and a trophy's title are Anton; trophy rows radius 12, 6 px apart; hint line 11.5 px white 85% | LOW | read | FIXED (read only: not seen) |
| 19 | Top bar on League (world/chrome `GameTop`) | Name 15 px in packed, 17 px in KIB; AGE chip 10 px further left in KIB; "18", "★ 500k" and the level number are Anton in packed, body font 900 in KIB; packed shows a small "!" on the star when a level reward waits, KIB none | MED | measured | OPEN |
| 20 | Title row "LEAGUE 🔔 ?" | 🔔 13 px in packed, 12 in KIB; letter-spacing 0.4 on the bell and ? | LOW | measured | OPEN |
| 21 | Bottom bar on League | Packed: no number on Training, a red dot (no number) on Phone, the chosen tab has a green line under it and no pane, buttons 50 px tall (KIB 37), PLAY letter-spacing 0.6 (KIB 1.2), no "▶" glyph text | MED | seen + measured | OPEN (shared `ui/look/BottomBar.tsx`) |
| 22 | International group tables (inside a competition) | Still KIB's own rows (title + head + rows without a card); packed uses the same card as the league table | LOW | read | OPEN |
| 23 | Chooser | KIB lists "FIFA ranking" under International; in packed it was below the fold: not compared | LOW | measured (one side) | OPEN: check |

## Not played (round 1 stopped here)

Everything else in the task's list was NOT looked at in this loop: cups and their tree, the cup draw,
Champions / Europa League, International tabs, live-score sheet, season review on a real save; the whole
Phone (feed, messages, apps, owner, investments, rule book); Shop, Store, Sponsors, Star Pass, Locker,
Settings, Your look, tours, Hall of Fame, credits; 360×780 and 360×640; long names and big numbers.
Their last known state is the status column of `WORLD.md`.

## Known open items handed over (not started here)

Feed graphics (caps match line, kit-colour plates) · scout report layout · Achievements / Trophies screens ·
pot jiggle and your-tie burst in the cup draw · next-match widget glow · shop category strip scroll ·
Rule Book small items · Store run-up tiles as the looping preview · the duplicate `hall-of-fame`
registration (`areas/career.tsx:126` and the old `HallOfFameScreen` in `screens/career/Farewell.tsx:41`
are unused: `areas/world.tsx` wins; removing them is a two-line edit in the career fixer's files) ·
Kickabout pill place and replays button in the Phone shell · contract talks' SETTINGS pill and Anton title
(`screens/world/Negotiation.tsx`).
