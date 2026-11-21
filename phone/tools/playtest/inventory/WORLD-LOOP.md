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

## Round 2 (Opus playtest, 21 Nov 2026)

Packed app (`mobile/www`) beside KIB Next's web build of `claude/eloquent-bohr-6veqfh` (877d074f), same save in both,
412×915 unless said, plus 360×780 and 360×640. Packed page made Roboto first (`roboto.js`); numbers from `measure.sh`
(text diff `diff()`, box probe `boxes()`). Not repeated here: the Anton/shadow rule and the top and bottom bars
(another fixer has them). **59 rows: HIGH 1 · MED 27 · LOW 31.**

Saves (remake with the commands): `late.json` = `make-season-end.mts --left 6`;
`fresh.json` = `look/make-save.mts` (★0: the poor save); `feed.json` = `save-from.mts <older Maidenhead save with 57 posts, scratchpad/save-eos.json> --no-tour`;
`big.json` = late.json's career with ★1,250,000 and the name "Maximilian-Alexander Oxlade-Chamberlainson", through `save-from.mts`;
`s2.json` = `make-season-end.mts --season2` (NEW flag: season 2, "📜 Last season" in the chooser);
`hall1.json` / `hall3.json` = `add-hall.mts late.json 1|3` (NEW tool: careers in both apps' Hall of Fame);
`tours.json` = `make-season-end.mts --left 30 --tours` (NEW flag: unlocks kept).
`measure.sh` and `roboto.js` no longer point at another worktree (repo found from the script; `PT_SCR` sets the stills folder).
Stills: `/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/loop/w2/s/<name>-pair.jpg`
(packed left, KIB right; `fm0..fm3.jpg` = the feed scrolled, `m*.jpg` = sheets); worst pairs: `loop/w2/worst.jpg`.

| # | Screen | Steps | Packed | KIB Next (measured) | Sev | How | Stills | Likely KIB file |
|---|---|---|---|---|---|---|---|---|
| R2-1 | League chooser | late.json, League, Change ▾ | header row at y 24 (top pad 24) | title and every row 8 px higher (KIB pad 16: "Every league and cup" y 29→21, rows 140→132) | LOW | measured | lg-chooser | screens/world/WorldPane.tsx (chooser) |
| R2-2 | Cup round chips (FA Cup, Lower League Trophy) | late.json, League, Change, FA Cup | chips white 10% fill, no ring, 11 px text, 76×29 ("Third Qual") | dark navy rgba(10,22,40,0.6) with a 1 px white 22% ring, 12 px text, 81×30; whole strip 5-18 px wider | MED | measured | cup-fa | world/ui.tsx (round chips) |
| R2-3 | Cup round list, ties decided on penalties | FA Cup, tap "Third Qual" | tie row 53 px tall (6 px pad, "9-8 on penalties" on its own 17 px line) | pens line squeezed: each pens row ~7 px shorter, rows below drift up (Harborough y 498→484) | LOW | measured | cup-fa-r1 | WorldPane.tsx (MatchLine pens) |
| R2-4 | Amber section titles in cards (every world list) | any cup round, Europe KO, International tabs | letter-spacing 2 px ("THIRD QUALIFYING ROUND · 16 TIES" 169 wide) | letter-spacing 1.2 (152 wide); same on "ROUND OF 32 · KNOCKOUT PLAY-OFF", "NATIONS LEAGUE 2026 · LEAGUE A", "INTERNATIONAL SCORERS", "FIFA RANKING · TOP 10", "WHO WON", "NEXT", "LAST RESULTS" | LOW | measured | cup-fa-r1, intl-* | world/ui.tsx card title |
| R2-5 | Europe KO, tie detail card | Champions League → KO → tap Dortmund box | loser white 75%, "Legs 0-2 · 1-0" 10 px at y 837 | loser white 60%, legs 9.5 px at y 827 | LOW | measured | ucl-tie | KnockoutTree (KIB) |
| R2-6 | Your nation's lit row (International tables, FIFA ranking, Matches) | Change → England (or FIFA ranking) | England lit in England's colours: grey-violet gradient rgba(126,126,158,.85)→rgba(89,89,130,.3), rim rgba(172,172,193,.95) | lit blue rgba(102,158,248,.85)→rgba(59,130,246,.3), rim rgba(157,193,251,.95) | MED | measured | intl-eng, fifa, intl-matches | world/ui.tsx youRow (nation colour) |
| R2-7 | International → England card | Change → England | ENGLAND card 92 px; table card starts y 459 | the same card, but everything under it 6 px lower ("NATIONS LEAGUE 2026" y 467→473) | LOW | measured | intl-eng | WorldPane international |
| R2-8 | International competition group tables (Nations League etc.) | Change → Nations League | each group is ONE glass card: amber 10 px "GROUP A1" title inside, head row, columns P at x 246, W 275, D 306, GD 335 | no card: green 10.5 px title outside, rows on the page, columns P at 261, W 288, D 317, GD 342; England row weight 700 (packed 900), its PTS white (packed amber rgb(254,240,138)) | MED | seen + measured | intl-nl | WorldPane international groups (round 1 #22, still open) |
| R2-9 | Live scores sheet | League → 🔔 | unticked bells greyed: opacity .35 + grayscale(1) | opacity .35 only: the bells show amber/yellow | LOW | measured | bell, bell-on | League live-scores sheet |
| R2-10 | Live scores sheet | League → 🔔 | sheet 455 tall from y 460; rows 39 px | sheet 452 from y 463; rows 38 px; title 8 px lower | LOW | measured | bell | League live-scores sheet |
| R2-11 | Season review ("📜 Last season") | s2.json (new: make-season-end.mts --season2), League, Change, Last season | "Season 1" is Roboto 400 22 px (its font is var(--font-display, inherit), unset there); "← This season" 12 px | "Season 1" is Anton 22 px; "← This season" 14 px; button 117 wide (104) | LOW | measured | review | season review list |
| R2-12 | Season review trophy rows | same | rows are a gradient: leagues green rgba(34,197,94,.32)→.12→white 4%, cups amber; competition word green rgb(133,223,166) / amber rgb(250,202,121), ls .5; group word "LEAGUES" amber 10 px; rows 60 tall | flat green .2 fill with 1 px border; competition word white 62%, ls 1; group word green 10.5 px; rows 58 tall (rows drift: FA Cup y 736→717) | MED | seen + measured | review | season review list (round 1 #18 "FIXED (read)": not right) |
| R2-13 | Phone home: wallpaper | feed.json (Maidenhead), Phone | wallpaper glow in the club colour (Maidenhead: grey rgba(104,105,106,.62)), no glow around the phone | glow always emerald rgba(16,185,129,.62) + an emerald 34 px glow around the phone body | MED | measured | phone | screens/world/Phone*.tsx (shell) |
| R2-14 | Phone home: status card "SEASON COMPLETE / ★1.8k in the bank" | feed.json, Phone | card 46 tall (pad 8/12); title 9 px; money line 11 px white 75% | card 52 tall (pad 12); title 10 px; money line 14 px white 62%; app grid 8-10 px lower | LOW | measured | phone | Phone shell |
| R2-15 | Social feed: filter chips and trend ticker | feed.json, Phone → Social, scroll | ALL · ENGLAND · CLUB chips and the trend ticker stay pinned under "Matchday" while the posts scroll | chips and ticker scroll away with the posts | MED | seen | feed-s1..s8 (fm0.jpg) | screens/world/Feed*.tsx |
| R2-16 | Social feed: highlight video posts | feed.json, Social, scroll to "HIGHLIGHTS ǀ Ebbsfleet United 2-0" and "Christian Ba ǀ Slough Town" | a 16:9 video still of the goal (pitch picture, ▶) above "Save video 0:12" | NO picture: only the row "🔊 Save video HIGHLIGHTS 0:12" | HIGH | seen | fm0.jpg, fm1.jpg | Feed post (video) |
| R2-17 | Social feed: Player of the Month graphic | scroll to "Coulibaly wins Player of the Month" | a picture card: drawn player, yellow plate "PLAYER OF THE MONTH / Pablo COULIBALY / TORQUAY", strip "MAY · 3 GOALS · 1 ASSIST" | a text card: "PLAYER OF THE MONTH · MAY / Pablo Coulibaly / Torquay United · 3G 1A" | MED | seen | fm3.jpg | Feed graphics |
| R2-18 | Social feed: poll | scroll to "Who is to blame for that?" | bars filled to each share (17 %, 23 %, 26 %, 34 %) with "176 votes" | a text list "The manager — 17%" ... no bars, no vote count | MED | seen | fm3.jpg | Feed graphics |
| R2-19 | Social feed: result graphics | scroll to "Play-Offs ǀ Ebbsfleet United 2-0" and "Farnham Town 2-0" | kit-colour plates: red bar EBBSFLEET ǀ 2 ǀ 0 ǀ MAIDENHEAD, title "PLAY-OFFS" / "NATIONAL LEAGUE SOUTH" | a card "PLAY-OFFS · FULL TIME" with two badges and a big 2 - 0, names under ("Maidenhead Uni..." cut) | MED | seen | fm1.jpg, fm2.jpg | Feed graphics (known open: kit-colour plates) |
| R2-20 | Social feed: league table graphic | scroll to "0 matches left" | 8 rows, "Hemel Hempstead Town" on one line | "Hemel Hempstead Town" wraps onto 2 lines | MED | seen | z (feed-s6/s7) | Feed graphics (table) |
| R2-21 | Social feed: verified tick | any post | a filled blue rosette badge with a white tick | a bare blue "✔︎" glyph (13 px) | LOW | seen | feed1 zoom | Feed post header |
| R2-22 | Social feed: post action row | scroll fast | the icons (reply, repost, like, views, share) are always there | twice seen with numbers only, no icons, ~1 s after a scroll (The Star — Back Page, Chronicle Sport) | LOW | seen once | feed-s6-next | Feed post actions |
| R2-23 | Social feed: second "The Daily Post" avatar | scroll to "Maidenhead United 0-2 Farnham Town" | newspaper icon on red | a plain red circle, no icon | LOW | seen | fm1.jpg | Feed avatar |
| R2-24 | Feed → Transfers (empty) | Social → TRANSFERS | "No business yet…" 11 px white 60% | 12 px pure white | LOW | measured | feed-tr | Feed transfers tab |
| R2-25 | Fixtures & results app | feed.json, Phone → Fixtures | rows 32 px tall (pitch 36), result pill 11 px: 17 rows on screen | rows 44 px tall (pitch 48), result pill 14 px: 14 rows on screen | MED | measured | ph-fixtures | screens/world (Phone fixtures) |
| R2-26 | Relationships (inside the phone) | Phone → Relationships | BOSS shows the manager's face, TEAM two team-mates' faces; bars are rounded glossy pills | BOSS 🗣️ and TEAM 👥 emoji; bars square (radius 0) with a 1 px white 30% border | MED | seen + measured | ph-relationships, z | Relationships (phone) |
| R2-27 | Owner app, Reputation, Rule Book, Investments (every "Your empire" page) | Phone → Owner (and Details →, Open →, Browse) | page margin 26 px: cards 360 wide; small type (9-10 px body, 10 px titles); title plaque with gradient-filled text 19 px | margin 12 px: cards 388 wide; every text 1-2 px bigger (9→10/11, 10→11/12); title plaque solid text 21 px; BACK 14 px (12) | MED | measured | ph-owner, rep, rule, inv | screens/world/Ownership*.tsx, RuleBook.tsx, Investments.tsx |
| R2-28 | Owner app: "Browse clubs to invest in" | Phone → Owner | 360×40 button, caps "BROWSE CLUBS TO INVEST IN" 13 px | 388×50 button, "Browse Clubs to Invest In" 17 px | LOW | measured | ph-owner | Ownership |
| R2-29 | Owner app cards | Phone → Owner | plain glass cards (white 20% ring) | cards with an emerald glow ring (1.5 px green + green shadow); "YOUR CLUBS" green (packed white 60%) | LOW | measured | ph-owner | Ownership |
| R2-30 | Rule Book: lawyers line | Owner → Rule Book: Open → | "Hire lawyers first (★5000 — …" | "Hire lawyers first (★71k — …" (KIB shows the real LAWYER_FEE; the packed label is a fixed ★5000) | MED | seen | rule | RuleBook.tsx:110 vs components/star/RuleBookScreen.tsx:185 (decide which) |
| R2-31 | Rule Book: disabled buttons | Rule Book | "Propose: …" buttons blue-tinted with white text; "Stand for president of FA" amber-brown | grey text rgb(170,178,191) on dark; president button grey | MED | seen + measured | rule | RuleBook.tsx |
| R2-32 | Rule Book tabs | Rule Book | "GOVERNING BODIES" indigo rgb(165,180,252); tab words white 72%, ls 1.2 | amber rgb(252,211,77); chosen white, others 55%, ls .6 | LOW | measured | rule | RuleBook.tsx |
| R2-33 | Investments: sell | Browse → Arsenal → Buy → Confirm → PORTFOLIO → Sell some | a red slider for the share to sell | a "− 50% of your stake +" stepper instead of the slider | MED | seen | inv-sell | Investments.tsx |
| R2-34 | Investments: portfolio row | after a buy | Arsenal row with no badge; buttons 10 px | club badge added; buttons 12 px and taller | LOW | measured | inv-port | Investments.tsx |
| R2-35 | Boardroom (empty) | Investments → BOARDROOM | "Own 50.1% or more…" weight 400, white 90%, y 145 | weight 700, white, y 123 | LOW | measured | board | Investments boardroom |
| R2-36 | Shop category strip | big.json, Home → SHOP | the chosen category is centred (strip padding 156 px, gap 20, 16 px words): "Cans" at x 157 | strip starts at the left edge (x 12, gap 16, 17 px words), "Holiday" is on screen where packed shows it cut | MED | measured | shop | screens/world/Shop.tsx category strip (known open item) |
| R2-37 | Shop list top | any category | first card at y 80 | first card at y 96 (16 px lower; one card fewer on screen, the 6th card sits under the shop bar) | LOW | measured | shop, drip | Shop.tsx |
| R2-38 | Shop → ⋯ More menu | Shop → ⋯ | Store row icon 🛒 | Store row icon 🪙; menu 5 px lower | LOW | measured | more | Shop.tsx more menu |
| R2-39 | Shop fame banner | Shop → tap "★1.2m 👑1" | the FAME · UNKNOWN banner floats over the list; it has "3D SHOP ›" | the banner pushes the list down; no 3D SHOP (3D is left out) | LOW | seen | fame | Shop.tsx fame banner |
| R2-40 | Shop → Homes | Shop → Homes | a "🏠 BUY A HOME TO MOVE IN" banner on the list | none (it leads to the 3D house, left out: decide if the line should stay) | LOW | seen | cat-homes | Shop.tsx |
| R2-41 | Shop → For You | Shop → For You | product picture 110×264 at y 232 | picture box 198×321 at y 210: the can is drawn about a third bigger | MED | measured | foryou | Shop For You |
| R2-42 | Store: every picture card (Today's Pick, tiles, coin packs) and the Ownership/International "rarity" cards | ⋯ → Store, Daily | glass: radial glow at the top-left corner over see-through navy rgba(14,30,52,.6), 2 px inset ring, a coloured drop glow (0 16 30 -14) | a 135° gradient to near-opaque rgba(31,41,55,.9)→rgba(12,17,28,.96), a plain border, no glow under it | MED | measured | store, intl-eng (manager card) | ui card with rarity tint (shared by Store, International manager card) |
| R2-43 | Store → Coins | Store → Coins | coin packs full brightness, tiles 256 tall, "Coming soon" buttons 32 tall | every pack dimmed to opacity .45, tiles 243 tall, buttons 27 tall | MED | measured | store-coins | Store.tsx coins |
| R2-44 | Store item sheet, cannot afford | fresh.json (★0), Store → Daily → Sweatband | both buy buttons greyed (cannot buy) | ★3,780 button bright gold and the 30-coin button amber: they look tappable | MED | seen | store-item | Store item sheet |
| R2-45 | Store balance pills | Store | coins balance amber rgb(254,240,138) "0 +" | white "0" and "+" | LOW | measured | store | Store.tsx header |
| R2-46 | Store at 360×780 | Store, Daily | "Premium KIB Can" description wraps to 2 lines in full | cut with "…" after one line | LOW | seen | s7-store | Store tiles |
| R2-47 | Sponsors (all tabs) | Shop bar → Sponsors (or Messages → "Pulse Audio want you…") | margin 26 px, offer rows 26-27 px apart, title text gradient 19 px | margin 12 px, rows 24 px apart (Weekly fee y 349→340, Target 428→412), every text +0.5-1 px, title solid 21 px | MED | measured | spons | screens/world/Sponsors.tsx |
| R2-48 | Sponsors: sign an offer | Sponsors → OFFERS → Sign | stays on OFFERS ("No offers right now"); "Here's your signing-on payment" toast floats over the header and goes | jumps to DEALS; the toast is a bar inside the page that pushes everything 54 px down for 3-6 s | MED | seen + measured | spons-sign1, spons-sign2 | Sponsors.tsx |
| R2-49 | Sponsors → BRANDS | BRANDS | rows ~66 px apart ("Needs" y 532) | taller rows ("Needs" y 558) | LOW | measured | spons-brands | Sponsors.tsx |
| R2-50 | Star Pass road | big.json, tap the star (30,70) | your level sits at y 549 of 915 | your level at ~469: the road is scrolled 80 px further | LOW | measured | pass | screens/world/StarPass.tsx |
| R2-51 | Locker: locked items | Star Pass → LOCKER → CELEBRATIONS | locked items are black silhouettes, "???" | locked items are the real coloured figures, only dimmed: you can see what they are | MED | seen | locker-cel | Locker.tsx |
| R2-52 | Locker bottom bar | Locker | a flat strip, "◀ BACK" 12 px | a bordered button "‹ BACK" 14 px | LOW | measured | locker | Locker.tsx |
| R2-53 | Settings rows (Quick) | ⚙ | rows 41 px tall, label 14 px | rows 49 px tall, label 15 px | LOW | measured | set1 | screens/career/Misc.tsx SettingsScreen |
| R2-54 | Settings → Data credits | Data credits | group lines 11 px white | 10 px white 60% | LOW | measured | credits-data | DataCredits (KIB) |
| R2-55 | Help tour on the Phone | big.json, Phone, ? | the bubble "Your phone. Messages, fixtures…" at y 194 (over the next-match card) | the bubble at y 331, 137 px lower (over the app grid) | MED | measured | tour-phone1 | Phone help tour |
| R2-56 | Hall of Fame bottom bar | title → HALL OF FAME | one flat bar, white icons 18 px, words 12 px | two bordered boxes, amber icons 16 px, words 10.5 px; "Kept on this device." loses "Sign in to keep it in your account." | LOW | measured | hof0, hof3 | areas/world.tsx HallOfFame |
| R2-57 | Hall of Fame → a career | hall3.json (new: add-hall.mts), Hall of Fame → SAM BA | SHARE PICTURE and SHARE LINK side by side; goals chart with the value on each bar and 👑; bar: HALL OF FAME · COMPARE · REMOVE | one SHARE PICTURE; SHARE moved into a 4-button bar; chart bars without values; header 11 px higher | MED | seen + measured | hof-career | HallOfFame career page |
| R2-58 | Hall of Fame → Compare | Hall of Fame → COMPARE | "COMPARE WITH A FRIEND": THEIR CODE OR LINK box + FIND, then YOUR CAREER list (compact rows, ✓ on yours) | "COMPARE YOUR CAREERS / PICK THE SECOND CAREER" with big cards; no friend code | MED | seen | hof-compare | HallOfFame compare |
| R2-59 | Credits sheet | title → CREDITS | see-through sheet, KNOWITBALL gradient | solid navy sheet, KNOWITBALL solid white | LOW | seen | credits | Title credits |

### Checked and the same (no row)
League table, Results, chooser rows, Champions League league phase and KO tree, cup trees (FA Cup, Lower League Trophy),
Community Shield final, World Cup history, FIFA ranking list (except R2-6), International Matches/Scorers/Ranking/Who won
layout (except R2-4/6/7), season review → a league's table, Messages (incl. the sponsor offer, which opens Sponsors in
both), Investments market list, buy confirm and sell confirm (same money after: ★906), shop can sheet, can buy confirm,
style item sheet with the L1-L5 ladder, cannot-afford item sheet (red save-up box, NOT ENOUGH MONEY), Star Pass reward
reveal (LATER / USE NOW), PTS sheet, Your look tiles (113×93 vs 116×97: too small to list), Hall of Fame list with 3
careers, the long name in the top bar (both cut it with "…").
360×640: League, FA Cup chips (both run off the right edge and scroll), England, Phone home: no new clipping in KIB
(the packed app itself clips "Relationships" and lets its next-match card's money line spill out; KIB does not).

### Not a finding
- Star Pass: once the podiums all sat half off the left edge after a tap. It came from the test tool (Playwright's
  scroll-into-view on a CLAIM scrolled the road sideways); with a real tap the road is fine and CLAIM works (`spr.jpg`).
- The packed phone sits 32 px lower after BACK from Sponsors: the packed app's own page scroll.

### Could not reach (and why)
- **Vote ceremony and boardroom with a stake**: needs 50.1% of a club; ★1.25m buys 0.03% (clubs cost ★361m-4b).
  Needs a save tool that writes a stake into the career; not built.
- **First-visit tours of League, Phone, Shop, Sponsors**: a story career with unlocks (`tours.json`) opens on the
  Gaffer's "Time to train" story step first (career area). The ? tour was checked on the Phone only (R2-55).
- **Shoot an advert** (sponsor mini-game), **Goal replays**, the **Kickabout pitch**: MATCH area; the Kickabout launcher
  was seen (known open item: the replays pill).
- **Cup draw reveal**: needs a cup match played in the packed app (match area); not done this round.
- **Hall of Fame with exactly 1 career**: `hall1.json` made, not opened (the 3-career list matched).
- **Shop levels L2-L5 owned**: only L1 items and the ladder looked at.
- 360×780 / 360×640 for Settings, Star Pass, Locker, Hall of Fame, Sponsors: not done.
