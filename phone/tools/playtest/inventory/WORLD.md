# Inventory, part 3: THE WORLD AROUND THE CAREER (packed app vs KIB Next)

21 Nov 2026. Built from `claude/eloquent-bohr-6veqfh` at aec937eb. Packed = `mobile/www` (the website's
own screens, `app/star-dev/page.tsx` + `components/star/**`, New UI, `NEXT_PUBLIC_KIB_APP=1`, so no casino).
KIB Next = `phone/` (its web build, `phone/tools/look/out/web`).

**How it was checked.** Both apps side by side in `phone/tools/playtest/drive.mjs` at **412×915** (Mikey's
S20+ in dp, bars hidden) and **360×780**, with the same career in both: the fresh Arsenal career
(`phone/tools/look/make-save.mts`), a late-season Arsenal career with a Champions League bracket and three
cups (`phone/tools/playtest/make-season-end.mts --left 6`), and an end-of-season National League South
career with 57 feed posts (an older playtest save, loaded with the new `phone/tools/playtest/save-from.mts`).
Every row says whether it was **seen** (a still) or **read** (code only).

**Stills** (`<name>-packed.png`, `<name>-next.png`, `<name>-pair.jpg`; `m-*.jpg` are several pairs on one
sheet): `/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/inventory/world/`.
The stills are in a scratch folder (they are not kept in git); rerun the steps under "How to redo it" to make them again.

**Out of scope here** (the other two lists): the match, pre/post-match, the trial, drills and the
Kickabout pitch itself (MATCH); title, new career, Home, story, Stats (and its Achievements tab), Training,
season end, transfers, awards and retirement (CAREER). Rows on the border are marked **BORDER**.

## Fix pass 2 (21 Nov 2026, the world builder)

Every DIFFERENT / MISSING row below now carries its result in the status column:
**FIXED (seen)** = looked at beside the packed app at 412×915 in the look check; **FIXED (reasoned)** = built from
the packed app's code but not looked at this pass; **PARTLY**, **OPEN** (with why) and **LEFT OUT (Mikey)**.
The summary counts above are the first inventory's (before this pass).

## Summary

| | count |
|---|---|
| Rows (elements checked) | 201 |
| SAME | 71 |
| DIFFERENT | 78 |
| MISSING | 43 |
| LEFT OUT (Mikey) | 9 |
| HIGH (of DIFFERENT + MISSING) | 26 |
| MED | 42 |
| LOW | 53 |
| Rows marked ANDROID RISK: YES | 22 (one of them, text size, covers every screen) |

(Severity is counted on DIFFERENT and MISSING rows only; a few SAME rows carry LOW for small size differences. The counts are made from the tables below by
`python3 phone/tools/playtest/inventory/count.py`.)

### The 20 most important gaps (most important first)

1. **Every font and box grows with the phone's font-size setting** (no `allowFontScaling`/`maxFontSizeMultiplier` anywhere in `phone/src`). The packed app's WebView does not grow its text with that setting. KIB Next also has 97 fixed pixel heights in the world screens. On a Samsung phone with a larger font size, text gets cut or spills over. This is the most likely reason for "wrong sizes / doesn't fit" on every screen. ANDROID RISK, HIGH.
2. **Knockout tree missing** (League → any cup's "Quarter-finals" chip, and Champions/Europa League → KO). The packed app draws the bracket from the last 16 (or last 8) to the final, with lines and scores, and you tap a box for both legs. KIB Next shows a list of ties for one round. HIGH.
3. **International → your nation is nearly empty**: the packed app shows the ENGLAND card (flag, FIFA ranking #4, caps, goals), the "England manager" card with its squad/starter bar and "NOT PICKED", and five tabs (Tables · Matches · Scorers · Ranking · Who won). KIB Next shows only "No international matches yet." HIGH.
4. **Help "?" is a different thing**: in the packed app it is a pointer tour over the real screen (a white bubble with GOT IT). In KIB Next it opens a separate "HOW IT WORKS" page. The first-visit tours of the League, Phone, Shop, Sponsors and Star Pass are missing too. HIGH.
5. **Shop item sheet (style items)**: the packed app has the trophy level ladder L1–L5 with prices (tap a rung to see it), three tiles (FAME · LASTS · OF INCOME), the red "You need ★850 more" save-up box with its bar, "You have ★0. Play matches to earn your wage." and the full-width NOT ENOUGH MONEY button. KIB Next has five pips, one line of words and a small button. HIGH.
6. **Shop can sheet**: the packed app has the big Anton effect line, three tiles (×0 YOU HAVE · Next match FOR · 100 ENERGY NOW), the note "Cans cost a slice of your weekly wage…" and two wide buttons. KIB Next has a name line and small chips. HIGH.
7. **Locker missing** (Star Pass → LOCKER: Penalty run-ups, Free-kick run-ups, Celebrations, Wearables, Boots, Balls, Vehicles, Watches & jewellery, Homes, Outfits, Trophy cabinet, Other). KIB Next has no button and no screen. HIGH.
8. **Store layout**: the packed app uses picture cards in two columns (Today's Pick hero with the boot picture, run-up preview tiles, coin piles) and a tap-for-sheet item page. KIB Next uses one-column rows with buttons in the row and no item sheet. Its tab row wraps onto two lines ("Coins" alone) and does not fit at 412 or 360. The packed app's top HUD is missing. HIGH.
9. **Settings is missing most rows**: Settings/Updates tabs, Full screen, 3D quality, Texture pack, Harry changes, Full highlights rebuild (with ?), Real moment highlights, and the Match, 3D match camera and Screens groups. KIB Next adds rows the packed app does not show there ("Player names" in Quick, "? How it works"). HIGH.
10. **Settings → Your look**: the packed app shows picture tiles (six drawn heads, three body shapes, skin swatches). KIB Next shows plain word chips. HIGH.
11. **Live-score alerts (the 🔔 next to LEAGUE) missing**, with its sheet of club crests you tick. HIGH.
12. **Shop "For You"** is a short-video style feed in the packed app (caption "Summer break, sorted. #holiday…", side buttons Like · Info · See all · Save up). KIB Next shows plain product pages. HIGH.
13. **Shop: no ⋯ More menu** (Sponsors, Store, 3D shop), **no fame banner** (tap ★0 👑1), **no "Next up"** (each category opens on the cheapest item you don't own, with a NEXT UP tag) and **no purchase moment** after buying (KIB Next shows a line of text). MED–HIGH.
14. **League table does not fit**: at 412×915 the packed app shows all 20 clubs above the bar. KIB Next's rows are taller (12.5 px text, 6 px padding, 2 px gaps), so the 20th club is under the bottom bar. At 360×780 KIB Next shows 15 clubs where the packed app shows 17. The same bigger type is on Results, Goals, History, the cup ties and the ranking. HIGH (doesn't fit).
15. **Phone → Relationships** opens inside the phone in the packed app (bars Boss · Team · Fans with ▶ and ?, England manager, Sponsors, Partner, Reputation, Fame). KIB Next leaves the phone for a full Relationships page with no bottom bar. HIGH.
16. **Chooser and sheets as Android `Modal`s with no `statusBarTranslucent`/`navigationBarTranslucent`** (League chooser, Shop sheet, Shop confirm, Star Pass preview). On Android a Modal is its own window, so the hidden bars can come back and the sheet's bottom can sit under or above the navigation bar. ANDROID RISK, HIGH.
17. **Hall of Fame**: the packed app has the gold-rayed HALL OF FAME header with FAME in gold, "Kept on this device…" and a bottom bar with BACK and ⚖️ COMPARE (plus Share on a career). KIB Next has a stadium page, a ‹ chip and no Compare. MED–HIGH.
18. **FIFA ranking and nation flags**: the packed app draws real flags. KIB Next shows three-letter grey tags ("SPA", "ARG"). MED.
19. **Investments**: the packed app's club list is a fixed box (about 10 rows) under a BALANCE bar. KIB Next runs the list down the whole page, adds club badges and puts the balance in a plaque. MED.
20. **Star Pass reward claim**: the packed app opens a full-screen RewardReveal ("LEVEL n REWARD", Later / Use now) and has the 3D "Drag to spin it" preview and the pulsing/bouncing podiums. KIB Next uses a small modal with "Use it", a still picture and no motion. MED.

---

## 0. Across every world screen

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Text size vs the phone's font setting | WebView: CSS px, not scaled by Android's font size | every `Text` scales with Android font size; none sets `allowFontScaling={false}`/`maxFontSizeMultiplier` | FIXED (reasoned): src/rn.js (fit builder) fixes every Text at font scale 1 | HIGH | YES: 97 fixed `height:` values in `screens/world/*` + League; text grows, boxes don't | phone/src (grep: 0 hits for allowFontScaling) | (read) |
| Top bar (HUD) on League/Phone | name, AGE, ★money, ⚙ (no ? on League: the ? sits next to LEAGUE), star badge + bar, energy bolt + bar | same bar, but **adds a ? on League and Phone** (two ? on the League page) | FIXED (seen): no ? in the bar on League (it sits beside LEAGUE); Phone's ? is the pointer tour | LOW | no | page.tsx:4830 `screenHud("league")`; phone/src/world/chrome.tsx:11 | league-table-pair.jpg |
| Bottom bar badges on League/Phone/Shop/Star Pass | Phone shows a **red dot** (unread), Training shows **no "2"** on these screens | Phone shows the number "3", Training shows ⚡2 | OPEN: the bar is the shared ui/look/BottomBar (career builders' file); low | LOW | no | MainBar.tsx; phone/src/ui/look/BottomBar.tsx | league-table-pair.jpg, starpass-pair.jpg |
| Star Pass's own bottom bar style | boxed buttons (League · Training · Home · Phone) + PLAY | the normal bar | OPEN: same shared bar; low | LOW | no | StarRatingSheet.tsx | starpass-pair.jpg |
| Panel style (glass) | frosted glass, club-glow tint (`ClubCard`, `rgba(glow,…)`) | see-through navy glass, no blur by rule; club colour only on the edge | PARTLY: the tree, nation and cup cards are plain navy glass (the club fill read too strong); no blur by the kit's rule | LOW | inset boxShadow needs Android 9+ | ui/ClubCard; phone/src/ui/look/Glass.tsx | m-league1.jpg |
| Motion at rest (pulses, bounces, ticker, jiggles) | yes (podium pulse/bounce, feed trend ticker, cup pot jiggle, confetti shimmer) | none (kit rule "nothing moves at rest") | PARTLY (seen): podium pulse and box bob, trend ticker, purchase moment, reward reveal now move; pot jiggle and confetti shimmer still do not | MED | no | phone/src/ui/look/README.md | (read) |
| Safe area with bars hidden | WebView fills the screen (`hideTopBar`) | `paddingTop: inset.top + 6` (TopBar, ScreenFrame); with immersive mode the inset may be 0 or the camera-hole height | OPEN: not checked on the S20+ itself (needs the phone) | LOW | YES: S20+ camera hole at top centre; check nothing sits under it | ui/look/TopBar.tsx:41; world/ui.tsx:72 | (read) |
| Anton / Cinzel fonts | web fonts | `FONT.display` / `FONT.serif` (loaded fonts, one weight) | SAME | | YES: if a font fails to load, Roboto with no `fontWeight` looks thin and narrow | ui/look/fonts.ts | (read) |

## 1. League page (bar → League) — `components/star/MatchWeek.tsx`, `WorldPane.tsx` | `phone/src/screens/League.tsx`, `screens/world/WorldPane.tsx`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Backdrop | blurred stadium, pitch tone | blurred stadium | SAME | | no | MatchWeek.tsx:54; League.tsx:22 | league-table-pair.jpg |
| Title "LEAGUE" | 15 px heavy white caps, centred | Anton 20 px | FIXED (seen): 15 px heavy caps | LOW | no | MatchWeek.tsx:69; League.tsx:26 | league-table-pair.jpg |
| 🔔 live-score bell next to the title (red dot when any club is ticked) | yes, 22×22 grey square | **none** | FIXED (seen) | HIGH | | MatchWeek.tsx:71-74 | league-table-pair.jpg |
| Live scores sheet (🔔 LIVE SCORES, count, ✕, two-column grid of crests to tick, amber when on) | yes | **none** | FIXED (seen) | HIGH | | MatchWeek.tsx:87-122 | (read) |
| ? help chip next to the title | 22×22 grey square, amber ?; opens the League pointer tour | 24×24 chip; opens the "How it works" page | FIXED (seen): 22 px grey square, amber ?, replays the pointer tour | HIGH | no | MatchWeek.tsx:76; League.tsx:28 | help-league-pair.jpg |
| First-visit League tour (LEAGUE_SCREEN_TOUR), then the "first two training sessions" pop | yes (story careers) | none on this screen | FIXED (reasoned): LEAGUE_SCREEN_TOUR on the first visit, then recordLeagueVisit (the "first two training sessions" pop is the career area's) | MED | | page.tsx:4842-4853 | (read) |
| Competition picker button (icon, name, YOURS pill, "Change ▾") | filled with the club's glow (Arsenal: pink-red tint), 15 px | dark navy glass with a red edge, 16 px, YOURS gold gradient | FIXED (seen): filled with the club glow, 15 px, amber YOURS pill | MED | no | WorldPane.tsx:130-145; WorldPane(K):145-152 | league-facup-crop130.jpg |
| "Other leagues are played at the end of the season." (WORLD_LIVE off) | small dark note | `Empty` card | SAME | | no | WorldPane.tsx:147; (K):156 | (read) |
| Chooser: full screen, "Every league and cup", ✕ | solid dark green `#071a10`, plain bold 18 px title, appears at once | stadium backdrop, Anton 22 px title, **slides up** (Modal) | FIXED (seen): solid #071a10, plain 18 px title, appears at once | MED | YES: RN `Modal` without statusBarTranslucent/navigationBarTranslucent | WorldPane.tsx:162-196; (K):189-228 | league-chooser-pair.jpg |
| Chooser: 📜 Last season row (when last season exists) | gold-tinted row | same | SAME | | no | WorldPane.tsx:170; (K):204 | (read) |
| Chooser groups England · Cups · Europe · International, YOURS tag, current row lit | dark solid rows, amber group titles | glass rows, green group titles | FIXED (seen): solid dark rows, amber group titles | LOW | no | WorldPane.tsx:175-193; (K):210-224 | league-chooser-pair.jpg |
| League tabs Table · Results · Goals · Assists · History | SegTabs | Seg (same words) | SAME | | no | WorldPane.tsx:287; (K):399 | league-table-pair.jpg |
| Table: one card, header # CLUB P W D L GD PTS, badge 15 px, 11 px rows, zone stripe on the left, your row lit | fits all 20 clubs at 412×915 | separate rows with 2 px gaps, 16 px badge, 12.5 px text; **20th club under the bottom bar at 412×915; at 360×780 15 clubs on screen vs the packed app's 17** | FIXED (seen) (fit builder): 20 clubs fit at 412×915 | HIGH | YES: fixed column widths `W=[24,0,26,26,26,26,32,34]` + font scaling | WorldPane.tsx:203-232; (K):230-256 | league-table-pair.jpg, league-360-pair.jpg, late-table-pair.jpg |
| Zone key under the table (Promotion / Play-offs / Relegation, Europe colours) | **not shown** | added | OPEN: kept (it explains the stripes; low) | LOW | no | (K):405 ZoneKey, :377 | (read) |
| Results: ‹ Round n › with "of 38" / "Still to play" | 36 px buttons, 14 px label | 40 px, bigger | FIXED (seen) (fit builder) | LOW | no | WorldPane.tsx:299-312; world/ui.tsx:131 | late-results-pair.jpg |
| Results rows (score pill, winner bold, scorers "Smith 5', 15'" under) | one card, 11 px rows, 9.5 px scorers | separate rows, 14 px (no fontSize set) names, 10.5 px scorers | FIXED (seen) (fit builder) | MED | YES: `MatchLine` names have no fontSize, so they follow system size | WorldPane.tsx:237-265; (K):273-297 | late-results-pair.jpg |
| Fixtures of a future round ("v") | one card | separate rows | OPEN: still separate rows; low | LOW | no | WorldPane.tsx:333-349 | league-results (m-league1.jpg) |
| Goals / Assists list (rank, badge, name, n goals; you under "⋯" if outside the top 10) | one card, 12 px | separate rows | SAME | | no | WorldPane.tsx:267-291; (K):298-312 | late-goals-pair.jpg |
| History: season label + REAL tag, 🏆 winner + 2ND runner-up, ⚽ 🅰️ ⭐ leaders | one card, 11.5 px | separate rows, bigger | SAME | LOW | no | WorldPane.tsx:394-431; (K):318-345 | league-history (m-league1.jpg) |
| Empty texts ("No named players here yet.", "No games played yet.", …) | same words | same words | SAME | | no | | league-goals-pair.jpg |

## 2. League → Europe (Champions League / Europa League)

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Winners bar (🏆 badge, club, WINNERS) | yes | yes | SAME | | no | WorldPane.tsx:555; (K):420 | late-uclko-pair.jpg |
| Tabs League · KO · Goals · Assists · History | yes | yes | SAME | | no | WorldPane.tsx:447 | league-ucl-pair.jpg |
| League-phase table, zone stripes (top 8 green, 9–24 blue, out red) | 36 rows in one card | separate rows + an added zone key | OPEN: separate rows + key kept; low | LOW | no | WorldPane.tsx:448; (K):478 | league-ucl-pair.jpg |
| KO: "Round of 32 · knockout play-off" folding card (9th to 24th…) | yes, folds open | **none** | FIXED (seen) | MED | | KnockoutTree.tsx:128-165 | late-uclko-pair.jpg |
| KO: the tree Last 16 → Quarters → Semis → Final (boxes with both clubs and the aggregate, lines between, your tie lit, tap a box for both legs/penalties) | yes | **none**: chips Last 32 · Last 16 · Quarter-Final · Semi-Final · Final and one list | FIXED (seen): boxes, lines, aggregate, your tie gold, tap a box for both legs | HIGH | | KnockoutTree.tsx:27-116, 128-170; (K):450-470 | late-uclko-pair.jpg |
| "The knockout starts after the league phase." | yes | yes | SAME | | no | | league-ucl-ko-pair.jpg |
| Goals/Assists with you under "⋯" | yes | yes | SAME | | no | | (read) |

## 3. League → Cups and shields (FA Cup, League Cup, Lower League Trophy, Community Shield, Super Cup)

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Tabs Rounds · Goals · Assists · History | yes | yes | SAME | | no | WorldPane.tsx:494 | league-facup-pair.jpg |
| Round chips (Third Qual … ) | one row that scrolls sideways | **wraps onto two rows** | FIXED (seen) (fit builder): one row that scrolls | MED | YES: wrap height grows with font scale | KnockoutTree.tsx:232; world/ui.tsx:113 | late-facup-pair.jpg |
| Last chip "Quarter-finals" → the cup's knockout tree (last 8 to the final) | yes; opens on the tree once reached | **none** (chips go up to "Quarter-Final" as a plain round) | FIXED (seen): opens on the tree once the last 8 is drawn | HIGH | | KnockoutTree.tsx:173-245 | league-facup-crop130.jpg, late-facup-pair.jpg |
| "STILL TO JOIN" card (round, n clubs, "you join here") | amber title inside a card | green title | FIXED (seen): amber title in a card | LOW | no | WorldPane.tsx:503-515; (K):520 | league-facup-crop130.jpg |
| Round heading "THIRD QUALIFYING ROUND · 16 TIES" and its ties | inside one card, amber title, 11 px ties | green heading outside, separate 14 px rows | FIXED (seen): one card, amber title, 11 px ties | MED | no | KnockoutTree.tsx:238; (K):497 | league-facup-crop130.jpg |
| Shield: Final card (two badges 40 px, score, pens, 🏆 winner) | yes | yes, a little bigger | SAME | | no | WorldPane.tsx:541; (K):543 | late-shield-pair.jpg |
| "This cup isn't being played this season." | yes | yes | SAME | | no | | (read) |

## 4. League → International (your nation, FIFA ranking, international competitions)

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Nation card: flag, ENGLAND (Anton), "FIFA ranking #4 · 1,923 pts", CAPS, GOALS | yes | **none** | FIXED (seen) | HIGH | | IntlWorldPanel.tsx:39 | intl-nation-crop0.jpg |
| "England manager" card: line about whether he knows your name, NOT PICKED, squad/starter bar (SQUAD 34 · STARTER 55) | yes | **none** | FIXED (seen) | HIGH | | IntlWorldPanel.tsx | intl-nation-crop0.jpg |
| Tabs Tables · Matches · Scorers · Ranking · Who won + "No group games yet. England's first is in the September–October break." | yes | **none**: only "No international matches yet." | FIXED (seen): Tables seen; Matches, Scorers, Ranking, Who won ported by code | HIGH | | IntlWorldPanel.tsx; (K):600-612 | intl-nation-crop0.jpg |
| FIFA ranking list (rank, flag, nation, points; yours lit) | one card, drawn flags | separate rows, **three-letter grey tags instead of flags** | FIXED (reasoned): one card, drawn flags, 11.5 px rows (flags seen by the fit builder) | MED | no | WorldPane.tsx RankingView; (K):614, world/ui.tsx:53 Flag | intl-ranking-crop0.jpg |
| International competitions (Euros, World Cup, Nations League…): Tables · Results ‹round› · Goals · Assists · History | `IntlCompPane` | `IntlCompView` (same tabs, read) | SAME | | no | WorldPane.tsx:570-610; (K):630+ | (read; none drawn yet in the save) |

## 5. Last season / Season review (`season-review`, chooser → 📜 Last season)

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Every trophy as a row (🏆, competition, winner, YOU), tap for its table/scorers/knockout | yes | yes (port) | SAME | | no | WorldPane.tsx LastSeason; (K):755-800 | (read: no save with last season) |
| Knockout inside a trophy | the tree | a list (no tree, see §2) | FIXED (reasoned): the same tree; opens on it at the review | MED | | | (read) |
| Header from Season Awards ("Every league and cup") | BORDER with CAREER (SeasonAwardsScreen.tsx:311) | `season-review` screen | SAME | | no | areas/world.tsx:52 | (read) |

## 6. Cup draw reveal (`cup-draw`) — `components/star/CupDrawReveal.tsx` | `screens/world/CupDrawReveal.tsx`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Header: competition + round name between two lines | yes | yes (Anton 24) | SAME | | no | | (read) |
| Before the draw: trophy and ticket **photos**, stadium-floodlight and confetti photos blended in | yes | **emoji** 🏆 🎟️, a blue glow | FIXED (reasoned): the website's trophy, confetti and floodlight photos (made see-through by tools/look/make-cupdraw-pics.py); not reached with a save in this pass | MED | emoji differ per phone | CupDrawReveal.tsx:378-404; (K):85-86 | (read) |
| "n ties to be drawn for the …", "Run the Draw" with two lightning-bolt drawings | yes | "⚡ Run the Draw ⚡" (emoji) | FIXED (reasoned): drawn bolts either side | LOW | no | CupDrawReveal.tsx:406, Bolt | (read) |
| The pot of balls (jiggling) | yes, balls jiggle | a still pot | OPEN: the pot is still (low) | LOW | no | CupDrawReveal.tsx:320-348 | (read) |
| Names pop in (ball drop, unfold), "drawing…" dots, your tie gold with a burst and shine | yes | pop-in with reanimated + haptic buzz, no burst/shine | OPEN: no burst or shine on your tie (low) | LOW | no | | (read) |
| Skip ›, DRAW COMPLETE, Continue (pulsing) | yes | yes (no pulse) | SAME | | no | | (read) |

## 7. The Phone (bar → Phone) — `components/star/PhoneHome.tsx`, `PhoneFrame.tsx` | `screens/world/Phone.tsx`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| The drawn phone: graphite bezel lit in the club colour, wallpaper, island, status bar (date, signal, wifi, battery), HOME / BACK ‹ nav bar | yes, as tall as the room, ≤0.6 as wide | same drawing; sits a little higher and wider | SAME | LOW | YES: side buttons at fixed `top: 96/128/176` | PhoneHome.tsx:119-140; Phone.tsx:137-185 | phone-crop120.jpg |
| Next-match widget (NEXT MATCH, date, crests with a glow, "Arsenal v Man City", ★ money counting up) | two-team "duel" glow card, glowing crests, rises in | flat dark glass, crests without glow, no count-up | OPEN: flat widget, no glow or count-up (low) | LOW | no | PhoneHome.tsx:314-351; Phone.tsx:269 | phone-crop120.jpg |
| "Season complete · ★ in the bank" widget | yes | yes | SAME | | no | PhoneHome.tsx:281 | feed (eos) phone grid |
| App grid (Relationships, Squad, Shop, Store, Sponsors, Owner, Settings), 50 px icons, 9.5 px labels | yes | yes; icon size shrinks to fit a short phone | SAME | | no | PhoneHome.tsx:56-75; Phone.tsx:48-62 | phone-pair.jpg, s360-phone-pair.jpg |
| Garden app | yes | not on the phone | LEFT OUT (Mikey) | | | PhoneHome.tsx:71 | phone-crop120.jpg |
| Your house app (HOME3D_IN_CAREER) | yes | not on the phone | LEFT OUT (Mikey) | | | PhoneHome.tsx:72 | phone-crop120.jpg |
| Dock (Social, Kickabout, Fixtures, Messages) | yes | yes | SAME | | no | | phone-pair.jpg |
| Badges: Sponsors offers, Messages unread, Social unread; NEW tag; blacked-out ??? apps + App Store (unlock chain) | yes | yes | SAME | | no | PhoneHome.tsx:144-150; Phone.tsx:79-84 | phone-pair.jpg |
| An app that is not built ("… is coming to the phone app.") | n/a | toast for Store/Relationships/Settings if their screen is missing (they exist now) | SAME | | no | Phone.tsx:91 | (read) |
| First-visit Phone tour, "phone-relations" tour | yes | none | FIXED (reasoned): HELP_TOURS.phone on the first visit and from ?, the phone-relations pointer inside Relationships | MED | | page.tsx:5443, 5658 | (read) |

## 8. Phone apps

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| App header (icon tile, title) | yes | yes | SAME | | no | PhoneHome.tsx:353; Phone.tsx:289 | m-phone2.jpg |
| **Social** — see §9 | | | | | | | |
| **Squad**: header NAME OVR POS G A; face, name, "Age · ★value", OVR chip by level, your row ★level | `LeagueScreen view="squad"` | own copy, same columns and chips | SAME | LOW | YES: 8.5 px sub-line, no font guard | LeagueScreen.tsx; Phone.tsx:312 | ph-squad (m-phone2.jpg) |
| **Fixtures & results**: every game in date order, MW/UCL/FA Cup label, badge, opponent (H/A), date or W/D/L score pill, next game glowing blue, opens on it | yes | yes, rows fixed 44 px | SAME | | YES: fixed `height: 44` + `getItemLayout 48` | PhoneHome.tsx:441-487; Phone.tsx:381 | ph-fixtures (m-phone2.jpg) |
| **Messages**: TODAY, round avatars, sender, bubbles, tappable ones (→ scout report / sponsors) | yes, rise in one by one | yes, no rise-in | SAME | LOW | no | PhoneHome.tsx:489-531; Phone.tsx:420 | ph-messages (m-phone3.jpg) |
| **Scout report** (from the gaffer's message) | `ScoutPane` (MatchWeekPanes.tsx) | own version (crest card, last 5, key man, three cards, cup run) | OPEN: the phone keeps its own scout report layout (med); not compared this pass | MED | no | MatchWeekPanes.tsx ScoutPane; Phone.tsx:447 | (read) |
| **Kickabout**: app header with ⚽ goals/chances, the real pitch | yes | yes, plus an extra "▶ Goal replays" chip; pitch drawing is the MATCH list's | OPEN: border with the MATCH list | LOW | no | PhoneHome.tsx:375-421; MatchKickabout.tsx — BORDER (MATCH) | ph-kickabout-crop120.jpg |
| **Relationships**: opens INSIDE the phone (Boss/Team/Fans bars with ▶ and ?, England manager, Sponsors, Partner, Reputation, Fame) | yes | leaves the phone for a full "RELATIONSHIPS" page (no bottom bar, its own header) | FIXED (seen): opens inside the phone frame (flat rows, square bars with ticks, ▶, ?); faces are icons, not photos | HIGH | no | PhoneHome.tsx:166, 196-201; Phone.tsx:51 → screen "relations" — BORDER (CAREER owns the page) | ph-relationships (m-phone3.jpg) |
| **App Store** (unlock chain: apps to add, price, Added; Backgrounds "Coming soon") | `AppStore` (UnlockChain.tsx) | own list (casino left out) | SAME | LOW | no | UnlockChain.tsx AppStore; Phone.tsx:518 | (read) |

## 9. Social feed (Phone → Social; post-match "moment" mode is the MATCH list's) — `MediaFeed.tsx`, `media/PostCard.tsx` | `screens/world/Feed.tsx`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Header "Matchday" with the app mark | yes | yes | SAME | | no | MediaFeed.tsx:331; Feed.tsx:56 | feed-pair.jpg |
| Trending strip ("Tester 6.4K posts", 🔥) | a ticker that **scrolls by itself** | a still row you swipe | FIXED (seen): scrolls by itself (drawn twice, slides one width) | LOW | no | MediaFeed.tsx:355-385; Feed.tsx:69 | feed-pair.jpg |
| Filters ALL · ENGLAND · CLUB | yes | yes | SAME | | no | | feed-pair.jpg |
| Post avatars | **drawn icons** (📰 paper, “ quote, face emoji, club crest) | **initials** in a circle (CS, GW, PE, TP) | FIXED (seen): the website's 17 drawn glyphs on a two-colour disc; clubs keep letters | MED | no | media/Avatar.tsx; Feed.tsx:137 | feed-pair.jpg |
| Post header: name, ✔ tick, @handle · 1w, "···" | yes, with ··· | no ··· | FIXED (seen): ··· added | LOW | no | media/PostCard.tsx; Feed.tsx:149 | feed-pair.jpg |
| Action row (replies, reposts, likes, views, share) | drawn line icons | emoji 💬 🔁 ♡ 📊 | FIXED (seen): the website's five line icons, one drawing per post | LOW | YES: emoji look different on Samsung | media/PostCard.tsx; Feed.tsx | feed-pair.jpg |
| Graphics (CONFIRMED card, result card, Player of the Month, milestone, highlights video with Save video) | caps match line "MAIDENHEAD UNITED 0-2 EBBSFLEET UNITED" | mixed case, bigger "Maidenhead United 0-2" (wraps) | OPEN: the graphics are still the short versions (caps match line, kit-colour plates not ported); med | MED | YES: big text in fixed card | media/Graphics.tsx; Feed.tsx:215 | feed-pair.jpg |
| Quotes, reply threads, goal-of-the-month poll (when on) | yes | yes | SAME | | no | Feed.tsx:179-214 | (read) |
| "You're all caught up. Touch grass." | yes | yes (list loads as you scroll: 6 posts first, 57 in the end) | SAME | | no | MediaFeed.tsx:228; Feed.tsx:98 | (seen by scrolling) |
| Bottom tabs ⌂ FEED · ⇄ TRANSFERS; Transfers "This Window" | yes | yes | SAME | | no | MediaFeed.tsx:243; Feed.tsx:332 | feed-transfers-pair.jpg |

## 10. Shop (Home → SHOP, or the bar's Shop) — `shop2d/ShowroomShop.tsx`, `shop2d/parts.tsx` | `screens/world/Shop.tsx`, `world/shop.ts`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Top row: ◂ BACK pill, 1 · 3 · 5 switch, ★money 👑fame chip | yes | yes | SAME | | no | ShowroomShop.tsx:770-800; Shop.tsx:421-430 | shop-pair.jpg |
| The 1·3·5 choice kept per phone (default 5) | kept (`star-shop-items-view`) | default 5, **not kept** after leaving | FIXED (reasoned): kept on the phone (star-shop-items-view) | LOW | no | lib/star/shopItemsView.ts; Shop.tsx:393 | (read) |
| ⋯ More menu (Sponsors, Store, 3D shop) | yes | **none** | FIXED (seen): ⋯ More → Store (Sponsors is on the bar; no 3D shop) | MED | | ShowroomShop.tsx:777, 810 | shop-pair.jpg |
| Tap ★/👑 chip → the fame banner drops down | yes | the chip does nothing | FIXED (seen) | MED | | ShowroomShop.tsx:780, 821 | (read) |
| Category words (Anton, bar under the chosen): Cans Drip Gadgets Cars Homes Holiday | scrolls to keep the chosen word in view | all from the left | OPEN: words start from the left (shared AntonTabs); low | LOW | YES: Anton row at 360 just fits; font scale pushes "Holiday" off | ShowroomShop.tsx; Shop.tsx | shop-drip-pair.jpg |
| Swipe up/down = next category, left/right = next item, dots | yes | swipe pages (left/right), category by tap | OPEN: swipe left/right between items, category by tap; low | LOW | no | ShowroomShop.tsx:1-30; Shop.tsx:221 | shop-3 (m-shop1.jpg) |
| List view (5): card with still, name, "family · L1 Starter", NOT ENOUGH / price | 80 px cards, more items on screen | taller cards, fewer items | FIXED (seen): 126 px cards, 8 px apart, as the website | LOW | YES: fixed card height | Shop.tsx | shop-drip-pair.jpg |
| "NEXT UP" tag and opening on the cheapest item you don't own (`shopNextItem`), in every view | yes (Drip opens on Poster Print 3/6) | **no tag; opens on item 1** | FIXED (seen): NEXT UP tag, list and pages open on it, comes back to it after a purchase | MED | | ShowroomShop.tsx; lib/star/shopNextItem.ts | shop-drip-pair.jpg, m-shop1.jpg |
| 3 view: centre big, neighbours small and faded with their names | yes | yes | SAME | | no | | m-shop1.jpg |
| 1 view: one item fills the screen, name, level, fame/lasts, price button | yes | yes | SAME | | no | | m-shop1.jpg |
| Item sheet (style item): category kicker, big picture, name + LEVEL 1 · STARTER | yes | kicker is the category ("DRIP" not "ART PIECE"), smaller picture | FIXED (seen): kicker is the family ("ART PIECE"), 4:3 lit picture box | MED | YES: Modal (see §0) | parts.tsx:217 StoreSheet; Shop.tsx:460 | shop-item-sheet-pair.jpg |
| Item sheet: trophy level ladder L1–L5 with prices, tap a rung to see that level | yes | **five pips** | FIXED (seen) | HIGH | | parts.tsx:172 LevelLadder | shop-item-sheet-pair.jpg, s360-shopsheet-pair.jpg |
| Item sheet: tiles +0.7 FAME · Forever LASTS · 0.10 wks OF INCOME | yes | one line "+0.7 fame  Lasts forever" | FIXED (seen) | HIGH | | parts.tsx GiveChips | shop-item-sheet-pair.jpg |
| Item sheet: save-up box "You need ★850 more", bar, "You have ★0. Play matches to earn your wage." | yes | **none** | FIXED (reasoned): the red box with its bar (the test save could pay; code is the website's) | HIGH | | StyleShop.tsx SaveUp | shop-item-sheet-pair.jpg |
| Item sheet: full-width NOT ENOUGH MONEY / Buy / Upgrade / Repair button | yes | small "Not enough ★850" pill | FIXED (seen) | MED | no | parts.tsx GoldButton | shop-item-sheet-pair.jpg |
| Can sheet: big effect line in Anton, tiles ×0 YOU HAVE · Next match FOR · 100 ENERGY NOW, note "Cans cost a slice of your weekly wage…", USE ONE + NOT ENOUGH wide | yes | name, "KIB Can", ×0 owned pill, one line of chips, small buttons, **no note** | FIXED (seen) | HIGH | YES: Modal | ShowroomShop.tsx can sheet; Shop.tsx | shop-sheet-pair.jpg |
| Boots: Black market (FA-banned boots), lawyers tick in the confirm sheet, boot deal 25%, "Sold out — back next visit", Equipped/Worn out badges | yes | yes (same rules) | SAME | | no | ShowroomShop.tsx:440-470; Shop.tsx:120-145, 514 | shop-boots (m-shop1.jpg) |
| Confirm sheet (Buy x for ★…, note, lawyers) | yes | yes | SAME | LOW | YES: Modal | parts.tsx ConfirmSheet; Shop.tsx:514 | (read) |
| Purchase moment ("Purchased!" with the item and effects) | yes | **a line of text** ("…: yours!") | FIXED (seen): burst, the item drops in under its trophy, "YOURS!" | MED | | parts.tsx:344 PurchaseMoment; Shop.tsx:399 | (read) |
| Phone opens / style unlock chain lines (PhoneOpens) | yes | read: lock rules ported (styleUnlockStar) | SAME | | no | StyleShop.tsx PhoneOpens | (read) |
| For You: a short-video feed (big picture, caption "Summer break, sorted. #holiday #level1 #knowitball", side buttons Like · Info · See all · Save up) | yes | **product pages** (a can, stats, Use one) with no caption or side buttons | FIXED (seen): caption, tags, Like · Info · See all · Buy / Save up | HIGH | | shop2d/ForYouFeed.tsx; Shop.tsx:473 | shop-foryou (m-shop1.jpg) |
| Shop bar: Shop · For You · **3D** · Boots · Sponsors (white line icons) | yes | Shop · For You · Boots · Sponsors (emoji) | FIXED (seen): the website's white line icons (no 3D button) | LOW | emoji | ShowroomShop.tsx:654 | shop-pair.jpg |
| 3D shop (the 3D button, "View in 3D") | yes | not in the app | LEFT OUT (Mikey) | | | ShowroomShop.tsx | shop-pair.jpg |
| Game bottom bar under the shop bar | yes | yes | SAME | | no | | shop-pair.jpg |
| Story shop tour (cans, then boots), "help-cans/boots/style" first tours, "phone-tip" pointer | yes | none | FIXED (reasoned): STORY_SHOP_TOUR (cans, then Boots) and the first-visit shop line | MED | | page.tsx:4931-4945 | (read) |

## 11. Store (Phone → Store) — `store/CareerStore.tsx`, `store/StoreView.tsx` | `screens/world/Store.tsx`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Game HUD on top (name, age, bars) | yes | **none** | FIXED (seen) | MED | | page.tsx:4860 `hud={screenHud("shop")}` | m-store.jpg |
| Header: ◂ BACK · STORE · ★0 · 🪙0 + | a row under the HUD | a centred plaque "THE STORE ★0 · 🪙0" | FIXED (seen) | MED | no | StoreView.tsx:242+; Store.tsx:36 | m-store.jpg |
| Tabs Daily · Animations · Accessories · Boots · Coins | **one row, scrolls sideways** | **wraps: "Coins" on a second row** at 412 and 360 | FIXED (seen) | HIGH | YES: wraps more with font scale | StoreView.tsx; Store.tsx | store-pair.jpg, s360-store-pair.jpg |
| Daily: "Daily specials / Same for everyone today", ⏱ New in 23h chip | two lines + a chip | one long caps line that wraps | FIXED (seen) | MED | YES | StoreView.tsx:524 DailyTab; Store.tsx:244 | m-store.jpg |
| Daily: TODAY'S PICK hero (boot **picture**, −20%, RARE, ★ + 🪙 prices, old price struck) then a 2-column grid | yes | hero shows a **green figure wearing it**, not the boot picture; smaller cards | FIXED (seen): the boot picture | MED | no | StoreView.tsx:524-585; Store.tsx:232 ItemPicture | s360-store-pair.jpg |
| Animations: 2-column picture tiles with the run-up preview, "✓ Wearing" | yes | one-column rows, small still figure, price buttons in the row | FIXED (seen): two columns; the run-up is a still (the man at the ball), not the looping preview | HIGH | | store/RunupPreview.tsx; Store.tsx | store-animations (m-store.jpg) |
| Accessories: "Your player" card with the figure and what you wear, then a 2-column grid | yes | "Your player" card, then one-column rows | FIXED (reasoned): "Your player" card with the figure, two-column picture tiles with the try-on corner | MED | | StoreView.tsx:369; StoreFigure.tsx | store-accessories (m-store.jpg) |
| Coins: 2-column coin-pile pictures (Handful, Pouch, Bag "FIRST PURCHASE ×2", Chest, Vault "BEST VALUE"), Coming soon; Swap coins | yes | one-column rows, no pictures | FIXED (seen): coin-pile pictures, banners, Coming soon | MED | | StoreView.tsx:586-640 | store-coins (m-store.jpg) |
| Tap an item → item sheet (big picture, try-on, Buy/Wear/Use for penalties) | yes | **no sheet**: Buy/Wear buttons in the row | FIXED (reasoned): sheet with rarity, Cosmetic/Helps you win, big picture, ★ and Coins buttons, Wear / Use for penalties | MED | | StoreView.tsx:247, 286 | (read) |
| Boots tab | yes | yes | SAME | LOW | no | | (read) |

## 12. Sponsors (Phone → Sponsors, Shop bar → Sponsors) — `SponsorsScreen.tsx` | `screens/world/Sponsors.tsx`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Header ◂ BACK, plaque YOUR DEALS / SPONSORS, ★ fame chip | yes | yes | SAME | | no | SponsorsScreen.tsx:209; Sponsors.tsx:166 | sponsors-pair.jpg |
| SPONSOR MONEY ★0 "a week, paid with your wage", DEAL SLOTS 0 of 1, NEXT SLOT · RISING STAR bar | yes | yes | SAME | | no | | m-sp.jpg |
| Tabs Deals · Offers · Brands | yes | yes | SAME | | no | | m-sp.jpg |
| Empty states (🤝 No deals yet…, 📱 No offers right now…) | yes | yes | SAME | | no | | m-sp.jpg |
| Brands list (13 kinds, need line, 🔒/📨, bar) and the footer line | yes, compact rows | same rows, taller (fewer on screen) | OPEN: rows a little taller (low) | LOW | YES: text wraps in fixed rows | SponsorsScreen.tsx; Sponsors.tsx | sponsors-brands-pair.jpg |
| Deal card (targets, walk away, advert shoot) and Offer card (accept / negotiate) | yes | yes (port) | SAME | | no | SponsorsScreen.tsx:88-198; Sponsors.tsx:67-164 | (read) |
| Sponsor negotiation (`NegotiationScreen` selling) | yes | `screens/world/Negotiation.tsx` | SAME | | no | page.tsx:5058 | (read) |
| Note over the screen after talks ("Agreed: ★… a week. Sign it…") | gold-edged toast at the top | `Note` | SAME | | no | page.tsx:5056 | (read) |
| First-visit Sponsors tour | yes | none | FIXED (reasoned) | LOW | | page.tsx:5055 | (read) |

## 13. Star Pass (tap the star) — `StarRatingSheet.tsx`, `RewardReveal.tsx` | `screens/world/StarPass.tsx`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Top: gold star with the level, STAR PASS (Cinzel), title (STARTING OUT) | yes | yes | SAME | | no | StarRatingSheet.tsx:230-260 | starpass-pair.jpg |
| LOCKER button | yes | **none** | FIXED (seen) | HIGH | | StarRatingSheet.tsx:241-247 | starpass-pair.jpg |
| ★ PTS button → Star Points panel (Matches, Trophies, Awards, Milestones, Fame) | yes | yes | SAME | | no | | starpass-pts-pair.jpg |
| The road 1→100, the gold rail with level marks, your face at your level, podiums with reward stills, themes every 20 levels | yes | yes | SAME | | no | | starpass-pair.jpg |
| Podium glow pulse and the bouncing box on the next/claimable reward | yes | still | FIXED (reasoned): glow breathes, box bobs on the next / claimable podium | LOW | no | StarRatingSheet.tsx:340-346 | (read) |
| CLAIM button on a reached podium; ✓ claimed; COMING SOON | yes | yes | SAME | | no | StarRatingSheet.tsx:350-365; StarPass.tsx:262-272 | (read) |
| Tap a reward → preview with the **3D spin** ("Drag to spin it") | yes | still picture in a small modal | LEFT OUT (Mikey): no 3D; the still is shown | MED | YES: Modal | StarRatingSheet.tsx:414; StarPass.tsx:210 | (read) |
| Claim → full-screen RewardReveal: "LEVEL n REWARD", category, name in display type, Later / **Use now** | yes | modal with Later / **Use it** | FIXED (seen): rays, LEVEL n REWARD, category, name, Later / Use now | MED | | RewardReveal.tsx:46-59; StarPass.tsx:282-307 | (read) |

## 14. Locker (Star Pass → LOCKER) — `LockerSheet.tsx`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| LOCKER title (gold serif) | yes | **no screen** | FIXED (seen) | HIGH | | LockerSheet.tsx:31 | locker-packed.png |
| Tabs: Penalty run-ups, Free-kick run-ups, Celebrations, Wearables, Boots, Balls, Vehicles, Watches & jewellery, Homes, Outfits, Trophy cabinet, Other | yes | none | FIXED (seen) | HIGH | | LockerSheet.tsx | locker-packed.png |
| Grid of cards: IN USE tag, picture, STANDARD; locked ones as dark ??? silhouettes; tap to use | yes | none | FIXED (seen) | HIGH | | LockerSheet.tsx | locker-packed.png |
| Bottom BACK | yes | none | FIXED (seen) | HIGH | | | locker-packed.png |

## 15. Owner app: Ownership, Reputation, Rule Book, votes, Investments, Boardroom

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Ownership: plaque YOUR EMPIRE / OWNERSHIP; 🌍 Reputation card (bars, Details →); ⚖️ Rule Book card (FA/UEFA/FIFA/CONMEBOL influence, Open →) | yes | yes, bigger type | SAME | LOW | no | OwnershipScreen.tsx:44; Ownership.tsx:33 | owner (m-own.jpg) |
| YOUR CLUBS heading, "You don't hold a stake…", BROWSE CLUBS TO INVEST IN | grey heading, slim caps button | green heading, tall "Browse Clubs to Invest In" | OPEN: low | LOW | no | | owner (m-own.jpg) |
| Your clubs list (stake %, boardroom link) | yes | yes (read) | SAME | | no | | (read) |
| Fame & Reputation page: fame card (levels Unknown 0+ … Icon 80+), reputation card (0+/30+/60+/90+ unlocks) | yes | yes | SAME | | no | Ownership.tsx:123 | reputation (m-own.jpg) |
| Rule Book: body tabs, CONTROLS, Your influence 0.0/100, amount box + Invest | box "10000" | "★ 10,000" | OPEN: low | LOW | no | RuleBookScreen.tsx; RuleBook.tsx | rulebook (m-own.jpg) |
| Rule Book: buttons you can't use yet (Stand for president, every Propose) | **greyed** | look **active** (gold/blue) | FIXED (seen) (fit builder) | MED | no | RuleBook.tsx | rulebook (m-own.jpg) |
| Rule Book: lawyers line "Hire lawyers first (★5000 — …)" | ★5000 (written into the page) | ★71k (the real LAWYER_FEE) | OPEN: KIB shows the real fee (the website's line is a written-in number); kept | LOW | no | RuleBookScreen.tsx:185; RuleBook.tsx:110 | rulebook (m-own.jpg) |
| Rule Book: Banned equipment (every boot as a chip) and Force a club in (every club as a chip) | long chip lists | a drop-down picker | OPEN: drop-down kept (low) | LOW | YES: custom drop-down in a scroll view | RuleBookScreen.tsx; politicsKit.tsx:42 Choose | (read) |
| Rule Book: Points per result, Draws, Match length, Offside, Squad size, Create a new competition, the footer note | yes | yes | SAME | | no | | (read) |
| Vote ceremony (Present the proposal → the room writes → the board counts → stamp → Overrule) | yes | yes (port) | SAME | | no | VoteCeremony.tsx; world/VoteCeremony.tsx | (read) |
| Investments: header BACK + BALANCE ★0 bar | yes | plaque "BALANCE ★0 / INVESTMENTS" | FIXED (seen): BACK + one BALANCE bar | LOW | no | Investments.tsx; world/Investments.tsx | invest (m-inv.jpg) |
| Investments: Market · Portfolio · Boardroom tabs, search, A–Z / ★ Value | yes | yes | SAME | | no | | m-inv.jpg |
| Investments: club list | a **fixed box** (~10 rows, scrolls inside), names only | runs the whole page, **adds club badges** | FIXED (seen): a fixed box (60% of the screen) that scrolls inside, names only | MED | no | | invest (m-inv.jpg) |
| Investments: buy panel (★ amount, = %, 10/25/50/MAX, Buy ★…, Most you can afford) | yes | yes | SAME | | no | | invest-club (m-inv.jpg) |
| Boardroom: "Own 50.1%…" and, with control: budget, sign/sell players, manager, recommendations, formation, line-up, captain, talisman, kit + kit vote, president, merge, son, stadium name/capacity, training ground, youth academy | yes | ported (read: 884 lines, same handlers in world/politics.ts) | SAME | | no | page.tsx:5016-5049; world/Investments.tsx | invest-board (m-inv.jpg) |

## 16. Achievements, badges, trophies (BORDER: Stats is the CAREER list)

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Achievements screen (phase `achievements`, "See all" from a pop): AchievementWall + first-steps list (UnlockChallenges) + tour | yes | only the Stats → Achievements tab | OPEN: border with CAREER (Stats → Achievements has it) | MED | | page.tsx:5100-5116; SecondaryScreens.tsx:141 | (read) |
| Trophies screen (phase `trophies`): TrophyCabinet | yes | Stats' "The cabinet" | OPEN: border with CAREER | LOW | | page.tsx:5118 | (read) |
| Achievement / unlock pops over the world screens (AchievementPop on League after the tour) | yes | Home only | OPEN: border with CAREER (pops are the career area's) | LOW | | page.tsx:4853 | (read) |

## 17. Settings (⚙) — `SettingsScreen.tsx`, `DeviceSettings.tsx`, `Quality3dRow.tsx` | `screens/career/Misc.tsx` SettingsScreen

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| HUD on top, BACK, plaque ARSENAL / SETTINGS, ⌂ Main menu | yes | yes | SAME | | no | SettingsScreen.tsx:239-251; Misc.tsx:198-215 | settings-pair.jpg |
| Tabs Settings · Updates (· 🛠 Dev for testers) | yes | **none** | LEFT OUT (Mikey): the Updates tab is every New/Old test switch; a player has no use for it | MED | | SettingsScreen.tsx:254-259 | settings-pair.jpg |
| Updates tab (UpdatesPanel: every New/Old update switch) | yes | none | LEFT OUT (Mikey): test switches | MED | | UpdatesPanel.tsx | (read) |
| QUICK: Full screen | yes (off) | none (the app is always full screen) | LEFT OUT: the app is always full screen | LOW | | DeviceSettings.tsx:67 | settings-pair.jpg |
| QUICK: Sound effects (on), Game music (off) | yes | "Sound" + "Game music", each with a grey second line | FIXED (seen): "Sound effects", "Game music", one line each | LOW | no | DeviceSettings.tsx:127-129; Misc.tsx:217 | settings-pair.jpg |
| QUICK: 3D quality Auto · Low · Med · High + note | yes (Auto) | none | LEFT OUT (Mikey): 3D quality is a 3D-scene setting; no 3D places in the app | MED | | Quality3dRow.tsx | settings-pair.jpg |
| QUICK: Texture pack drop-down with pictures ("Realism + cartoon") | yes | none | LEFT OUT (Mikey): test switch | MED | | Quality3dRow.tsx:61-140 | settings-pair.jpg |
| QUICK: Harry changes (folded drop-down) | yes | none | LEFT OUT (Mikey): test switch | LOW | | Quality3dRow.tsx:145-170 | settings-pair.jpg |
| QUICK: Skip the line-up | yes (off) | yes, with a second line | SAME | | no | | settings-pair.jpg |
| QUICK: Full highlights rebuild OFF/ON with ? (default ON) and its child "Real moment highlights" OFF/ON (default OFF) | yes | **none** | LEFT OUT (Mikey): test switch | HIGH | | FhrSwitchRow.tsx; DeviceSettings.tsx:133 | settings-pair.jpg |
| QUICK: Player names | not here (it is in More → Match) | added to QUICK | FIXED (seen): moved to More → Match | LOW | no | DeviceSettings.tsx:196; Misc.tsx | settings-pair.jpg |
| MORE → Match (3): Keepers New/Old, Keeper finish New/Old, Match view 3D On/Off, Player names | yes | none | PARTLY: More → Match has Player names (the other three are test switches) | MED | | DeviceSettings.tsx:178-202 | (read) |
| MORE → 3D match camera (2): zoom slider, height test slider | yes | none | LEFT OUT (Mikey): test sliders | LOW | | DeviceSettings.tsx:205-216 | (read) |
| MORE → Screens (1): UI New/Old, skin Glass/Pitch | yes | none | LEFT OUT (Mikey): test switches | LOW | | DeviceSettings.tsx:219-230 | (read) |
| MORE groups open one at a time (opening one closes the other and scrolls it up); count on the right ("3 ▸", "18 ▸") | yes | both can be open; no counts; a coloured bar on the left | FIXED (seen): one group open at a time, counts on the right | LOW | no | DeviceSettings.tsx:254-300 | settings-career-pair.jpg |
| Career & saves → Your look: **picture tiles** (six drawn heads, Slim/Strong/Tall body shapes, skin swatches, hair colour chips) | yes | **word chips** | FIXED (seen): six head pictures, three build outlines, skin swatches, hair chips | HIGH | | YourLookPanel.tsx; Misc.tsx YourLook | settings-career-pair.jpg |
| Career & saves → Penalties and free kicks (run-up pickers) | yes | yes | SAME | | no | SettingsScreen.tsx:173-193 | settings-career-pair.jpg |
| Career & saves → Saves (3 slots, PLAYING, Delete & start over, Start career) | yes | yes | SAME | | no | SaveSlotsPanel.tsx | settings-career-pair.jpg |
| Career & saves → Move my saves (copy / paste a save code) | yes | none | OPEN: not built (low; needs a paste box and a check of the code format) | LOW | | MoveSavesPanel.tsx | settings-career-pair.jpg |
| Exit career — back to Knowitball + "Your career stays saved…" | red button | caps button, asks first | SAME | LOW | no | SettingsScreen.tsx:218-232 | settings-career-pair.jpg |
| "? HOW IT WORKS" button at the bottom | not on this page | added | FIXED (seen): removed | LOW | no | Misc.tsx | settings-pair.jpg |
| Goal replays panel (watch / save / delete) | in the 🛠 Dev tab (testers) | a "Goal replays" screen from Kickabout | OPEN: border with MATCH | LOW | no | SettingsScreen.tsx:391; areas/match.tsx:106 | (read) |
| Settings from the title (no career): GlobalSettingsScreen (full screen, sound, music, 3D quality, saves, credits) | yes | `career-settings` without a career (read) | OPEN: border with CAREER (title) | LOW | | GlobalSettingsScreen.tsx:32 | (read) |

## 18. Data credits (Settings → More → Data credits) — `DataCredits.tsx`, `lib/star/dataCredits.ts`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Row: "Data credits / Where the real football data comes from / 18 ▸" | yes | "Who made the data, pictures and sounds", no count | FIXED (seen) | LOW | no | DeviceSettings.tsx:267 | settings-pair.jpg |
| Intro "The game's real football data, models, voices and fonts are free to use with credit. Thank you to:" | yes | none | FIXED (reasoned) | LOW | | DataCredits.tsx:15 | credits-pair.jpg |
| Groups (How real football plays, Player roles, Real moments, Facts, 3D models…, Sound, Fonts) with a one-line description each ("Averages and counts only: no real match is replayed.") | yes | group titles only, no descriptions | FIXED (reasoned) | LOW | no | DataCredits.tsx | credits-pair.jpg |
| Each line | the credit sentence | a bold source name + licence line, then the sentence | FIXED (reasoned) | LOW | no | | credits-pair.jpg |
| Notes ("University-level matches: kept on file…", "Kept for a future game mode…", "Each goal's own source link…") | yes | none | FIXED (reasoned) | LOW | | | credits-pair.jpg |
| Footer "Also on the web at knowitball.co.uk/credits." | yes | none | FIXED (reasoned) | LOW | | | credits-pair.jpg |

## 19. Help pages (every "?")

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| ? on League, Phone, Shop, Sponsors, Star Pass, Training… | replays that screen's **pointer tour** (HELP_TOURS: dark screen, ring, hand, white bubble, NEXT ▸ / GOT IT) over the real screen | opens a separate **HOW IT WORKS** page listing the same lines | FIXED (seen): League seen; Phone, Shop, Sponsors by the same code (Star Pass has no tour on the website) | HIGH | no | page.tsx:5513 onHelp → setHelpTour; Moments.tsx:192 HelpScreen; ui/tour.tsx (exists, used on Home only) | help-league-pair.jpg |
| Title → TUTORIAL | BORDER (CAREER) | | | | | | |

## 20. Hall of Fame (title → HALL OF FAME) — `HallOfFame.tsx` | `screens/career/Farewell.tsx` HallOfFameScreen

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Page look: dark page, gold light rays, "YOUR CAREERS", HALL OF **FAME** (FAME in gold) | yes | stadium backdrop, white Anton title | FIXED (seen) | MED | no | HallOfFame.tsx:124; Farewell.tsx:216 | hall (m-hall.jpg) |
| "Kept on this device. Sign in to keep it in your account." | yes | none | FIXED (seen): "Kept on this device." (the app has no sign-in) | LOW | | HallOfFame.tsx | hall (m-hall.jpg) |
| Three dark slots, "RETIRE A CAREER TO FILL THIS" | yes | yes | SAME | | no | Farewell.tsx:250 | hall (m-hall.jpg) |
| Bottom bar: ‹ BACK · ⚖️ COMPARE | yes | a ‹ chip at the top, **no Compare** | FIXED (seen): BACK · COMPARE; Compare is between two of your own careers (a friend's code needs an account) | MED | | HallOfFame.tsx:77-90; LegendShare.tsx CompareFlow | hall (m-hall.jpg) |
| A career's row (HallCardRow) and its page (overview, Share link, Compare) | yes | a card + overview; REMOVE; no Share/Compare | FIXED (reasoned): the website's row; a career's page has Hall of Fame · Compare · Share (the phone's share sheet) · Remove | MED | no | HallOfFame.tsx:191; Farewell.tsx:220-247 | (read) |

## 21. Credits (title → CREDITS)

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| Sheet: CREDITS ✕, KNOWITBALL, ROAD TO THE GOLDEN BALL, "Made by Harry, Mikey and Leo", knowitball.co.uk, BACK | see-through over the title | solid sheet | SAME | LOW | no | TitleScreen.tsx; Title.tsx | credits-title (m-hall.jpg) |

## 22. Transfers window (BORDER: the CAREER list owns it) — `TransferHub.tsx` | `screens/world/TransferHub.tsx`

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| League → Club → Negotiate, keen bars, season letter | yes | ported (`transfers` lives in the world area's code) | SAME | | | areas/world.tsx:68 | see the CAREER list |

## 23. Left out on purpose (Mikey)

| element | packed | KIB Next | status | severity | android risk | files | stills |
|---|---|---|---|---|---|---|---|
| 3D garden (phone app, garden phase) | yes | no | LEFT OUT (Mikey) | | | Garden3D.tsx | phone-crop120.jpg |
| 3D shop (shop bar 3D button, More → 3D shop, View in 3D, open-on-item from 3D) | yes | no | LEFT OUT (Mikey) | | | Shop3D.tsx | shop-pair.jpg |
| Your house (home-3d) | yes | no | LEFT OUT (Mikey) | | | Home3D.tsx | phone-crop120.jpg |
| 3D training pitch (garden gate) | yes | no | LEFT OUT (Mikey) | | | Training3D.tsx | (read) |
| 3D casino | hidden in the packed app too (KIB_APP) | no | LEFT OUT (Mikey) | | | page.tsx:4948 | (read) |
| Casino app and Shop → Casino link | hidden in the packed app (KIB_APP) | no | LEFT OUT (Mikey) | | | PhoneHome.tsx:69 | (read) |

---

## How to redo it

```bash
# a web build of KIB Next (phone/tools/look/build-web.mjs; ~3.5 min) or link one from another worktree
node phone/tools/playtest/drive.mjs --port <free port> --w 412 --h 915 --shots <dir> &
npx tsx phone/tools/look/make-save.mts > save.json                       # fresh Arsenal career
npx tsx phone/tools/playtest/make-season-end.mts --left 6 > late.json    # late season: cups, Europe bracket
npx tsx phone/tools/playtest/save-from.mts some-career.json --no-tour > s.json   # any career JSON
```
In each command: seed both apps from a page that does not run the game (the packed app's `/404.html`),
otherwise the packed app saves its old career over the new one when the page unloads. Then reload `/`,
press CONTINUE in KIB Next, and open screens with `window.__kibNav.go(name)` (KIB Next) or the buttons (packed).
Recount the summary: `python3 phone/tools/playtest/inventory/count.py`.
