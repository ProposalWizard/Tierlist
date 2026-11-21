# KIB Next career: the playtest-and-fix loop (21 Nov 2026)

One round was started and stopped part-way (Mikey moved playtesting to separate playtesters). Both apps were side by
side at 412×915 in one Chromium, the packed app drawn with Roboto (see README-situations.md, "The bench").
Every row below was MEASURED (the position, size, line height and font of each word, read from both pages),
not judged by eye. "px" = how far KIB Next's word sat from the packed app's.

## The one cause behind most rows

The packed app gives every word a line box (Tailwind: `text-[10px]` = 15 px line, `text-xs` 16, `text-sm` 20,
`text-base` 24, `text-lg`/`xl` 28, `text-2xl` 32, `text-3xl` 36, unless a `leading-*` says otherwise). KIB Next's
`<Text>` had no `lineHeight` on most words, so each line was 3 to 5 px shorter and a screen drifted 5 to 30 px
by its foot. The fix is always the same: give the word the packed line height (and its letter spacing). Also:
any bold word of 16 px or more is **Anton** in the packed app (`components/star/ui/flat.css` rule 1), not bold Roboto.
**Still to do on every career screen not listed as fixed here.**

## Round 1

| Screen | What | Sev | Status |
|---|---|---|---|
| New career: Who are you? | page side padding 12 (packed 14); header 4 px low; labels, boxes and the nationality row 9 to 21 px high (label line 11 not 15, box 43 not 44, row 43 not 48.5); title 21 px (packed 20); tag letter spacing 1.6 (packed 1); Back/Continue 45 tall (packed 48) and 3 px low | MED | FIXED (measured after: every word within 4 px) |
| New career: Who are you? | the ✓ is bold Roboto (packed: Anton 18) | LOW | FIXED (reasoned: changed after the last build) |
| New career: Your style | every row 9 to 31 px high (same cause); ✓ − + bold Roboto (packed: Anton); tiles #1f2a40 (packed #1c2a42); label gaps 6/16 | MED | FIXED (measured after: no difference left) |
| New career: Your photo | "Add a photo"/"Take a photo" 11 px words, 31 tall, radius 8 (packed 12 px, 34 tall, radius 12, three-stop green); an extra line "Your photo stays on this phone…" the packed app does not have; rows 9 to 12 px high | MED | FIXED (measured after; "Or pick a face" still 5 px high). The extra line now shows only when the picker reports a problem |
| New career: step line | "Step 1 of 2" 3 px higher than packed (103 v 106) | LOW | OPEN (inside tolerance) |
| New career: Continue / Start Career colour | packed: flat #10b981; KIB: gradient #34d399→#10b981 with a glow. Back: packed `bg-gray-700` as the look re-colours it; not measured | LOW | OPEN: not verified (the packed button was read while hovered) |
| Scout's talk | pill, club name, league line, card words 5 to 16 px high (line heights); league line letter spacing 1.6 (packed 1.1); "'S SCOUT"/"TAP TO HEAR" spacing 1.5 (packed 1) | MED | FIXED (measured after: no position difference) |
| Scout's talk: club name colour | packed: white→70 % white gradient in the letters; KIB: flat #b4b9c1 | LOW | OPEN (React Native has no gradient text; looks close) |
| Scout's talk: ⚙ | packed glyph 20 wide, KIB 14 (emoji font) | LOW | OPEN: needs the phone (Android's own glyph) |
| The offer card | ★35 bold Roboto (packed: Anton 30, " a week" Anton 14); words 5 to 10 px low; button words spacing 1.5 (packed 1.2), button 38 tall (packed 42) | MED | FIXED: button and paragraph measured after; the price line was 7 px tall in the browser, held to 32 (reasoned, after the last build) |
| Signing | packed: the 3D office scene with the manager's lines; KIB: the drawn paper | — | LEFT OUT (Mikey: no 3D office). Header "SIGNING FOR…" sits at 16,27 in #fcd34d; packed 12,20 in #fbbf24 | 
| Signing header | as above: 4 px right, 7 px low, lighter amber | LOW | OPEN |
| Trial stage scoreboard [border: MATCH, `MatchStages.tsx`] | top strip 35 tall (packed 31 + 8 gap = 39), card 67 (packed 70.3): everything 4 to 7 px high; "0/1" 26 px (packed 24/24 Anton); title line 10 (packed 13.5); EXIT line 11 (packed 15), spacing 0.4 (packed 0.25); "1/5" spacing 1.5 (packed 1) | LOW | OPEN: match loop's file |

## Not reached this round (still to playtest)

Signing after the paper, Breaking News (stripes, TAP TO CONTINUE), first Home and every tour and story beat,
Training, Stats tabs, energy/rest, injuries, every prepared save in README-situations.md, the "reasoned only"
states of CAREER.md, long names and big numbers, 360×780 and 360×640, title parallax, share picture.

## Round 2 (Opus playtest, 21 Nov 2026)

Both apps side by side at 412×915 in one Chromium (`drive.mjs --port 7833`, packed drawn with Roboto through a copy
of `bench/fonts.conf`), KIB Next's web build made from `claude/eloquent-bohr-6veqfh` at 195cce00. Rows were
**measured** with `bench/diff.js` / `bench/insp.js` (numbers given) and looked at in a pair still, unless they say
"seen" (looked at only) or "code". Rows already open in CAREER.md, the two app-wide rules the fixer is applying
(line heights; bold ≥16 px is Anton + soft shadow) and the top/bottom bars are not repeated.

Stills: `/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/loop/c2/<name>-pair.jpg`
(packed left, KIB right). Worst pairs: `/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/loop/c2/worst.jpg`.

**How to reach each state** (new tools in this folder, see README-situations.md "Round 2 additions"):
`st/<x>.json` = `make-career-states.mts <x>`. `b1`…`b6` = the real Maidenhead career signed in the packed app this
round (localStorage dump `st/signed-packed-ls.json`), moved on N matches with
`advance.mts <dump> N --seen <beats seen> --trained`, then `save-from.mts`:
b1 = 1 game, seen boots,training; b2 = 2, +candeal,starpass; b2b = +can; b3 = 3, +phone; b3b = +shop; b3c = +stats; b6 = 6, +sponsor.
Load: `cmd.mjs "const FILE='<state>.json'; $(cat bench/load.js)"`. The packed app opens on Stats: press Home (206,880).

### Counts

| HIGH | MED | LOW | Total |
|---|---|---|---|
| 1 | 19 | 12 | 32 |

### Findings

| # | Screen | Steps | Packed | KIB Next (measured) | Sev | How known | Still | Likely KIB file |
|---|---|---|---|---|---|---|---|---|
| R2-1 | Stats → Achievements | `b6`, Later, Got it, ‹ STATS, GOT IT, ACHIEVEMENTS | first a "COMING UP" card: 🤝 "Sponsors are open · Brands pay you every week to wear their name" + green "Go →" (y 424–490) | no Coming-up card; the ring card starts at y 441 where packed's card is | HIGH | measured | stats-ACHIEVEMENTS | screens/career/Achievements.tsx |
| R2-2 | Stats → Achievements | same | ring + tier bars sit inside a framed card (amber 1 px ring, dark glass) | ring and bars sit on the page, no card | MED | seen | stats-ACHIEVEMENTS | Achievements.tsx |
| R2-3 | Free agent page | `st/free-agent.json`; KIB: `__kibNav.go('career-free-agent')` (why: "Not reached") | charcoal page; "Look Check" 18 px left at 16,13 with amber "FREE AGENT" under it; SETTINGS pill top right (323,23); the HOME/GYM/GAMES/SOCIAL/WEEK bar right under the cards (y 577) | blue stadium blur; green "FREE AGENT" 10 px over a centred 26 px name (147,12); "Settings" a full-width button in the body (y 416); the five-tab bar pinned at the foot (y 860); labels 72 % white (packed 50 %), body 13 px (packed 12) | MED | measured | st-free-agent | screens/career/Youth.tsx (FreeAgentScreen) |
| R2-4 | Training list | `b1`, Go to training, tap Training | Aerial & Acrobatics: "Opens after your third game" is screen-reader text only (1×1 px); row 90 tall | the line shows in amber 12 px under the bar; row 110 tall, the list 20 px longer | MED | measured | train2 | screens/career/Training.tsx:107 |
| R2-5 | Training level select | same, tap Power | header card 16,43 380×140 radius 2; level tiles 70×70 radius 2 from y 273 | card 18,56 (13 px low, 4 px narrower) radius 16; tiles 68×68 radius 12 from y 281 | MED | measured | train-level | Training.tsx (level select) |
| R2-6 | Stats, first visit tour | `b6`, ‹ STATS | bubble "Your stats, your form and your records" at 72,183 (268×86) | at 72,320: 137 px lower, over the card's foot | MED | measured | stats1 | Stats.tsx tour step / ui/tour.tsx |
| R2-7 | Stats → Goals & assists chart | `b6` Stats, scroll | bars 18 wide, 6 goals = 66 px; "10" 70 px under the heading, "0" at 180; 👑 over the best season; axis numbers white | bars 12 wide, 6 goals = 59 px; "10" at 32, "0" at 146 (plot 34–38 px higher); no 👑; axis numbers 60 % white | MED | measured | stats2 | Stats.tsx (chart) |
| R2-8 | Stats → Records | `b6` Stats, RECORDS | each best has a square icon tile and a divider; rows ~46 px; "YOUR BESTS" 10 px 70 % white; sub-lines "Season 26/27" | bare emoji, no tiles or dividers; rows ~41 px (list ends 64 px higher); "YOUR BESTS" 11 px amber; sub-lines "Season 27/28" (packed's own label disagrees with its season table, 27/28: check which is right) | MED | measured | stats-RECORDS | Stats.tsx (Records) |
| R2-9 | Stats → Contract | `b6` Stats, CONTRACT | paper rows 28 px apart (Position 540 … Assist bonus 680), Clauses 711, PROPOSE RENEWAL 841 | rows 23–24 px apart (527 … 645), Clauses 672, PROPOSE RENEWAL 795 (46 px higher); paper 45 px shorter | MED | measured | stats-CONTRACT | Stats.tsx (contract paper) |
| R2-10 | Home, the three cans | any Home (`mid-season`, `intl-duty`, first Home) | "USE"/"FULL" at 45 % white when the can cannot be used (energy full, or ★36 against a ★6k can) | always full white: USE looks pressable when it is not | MED | measured | mid-home412 | screens/Home.tsx (can tiles) |
| R2-11 | First match after signing | `trial-done` → sign → news → boots → tour → PLAY | straight into the match ("THE TEAMS WALK OUT · KICK OFF"): Maidenhead has no XI of 9, `teamsReady` false | the team sheet with invented names (Wright, Savic…), KICK OFF | MED | seen; cause by code: LineupIntro.tsx:115 and PreMatch.tsx:103 use the same rule, so KIB's squad source gives an XI where packed's has none | — | screens/career/PreMatch.tsx, game/squads.ts |
| R2-12 | Season 2 after a summer move | `season-over` → End of Season → SKIP → Continue → CLUB → Aston Villa → NEGOTIATE → Accept offer → Continue → SKIP → awards → CONTINUE | season 2 opens with the "ACHIEVEMENT 3 OF 3 · On the Move" toast; no Breaking News in this run | Breaking News "YOUNGSTER SIGNS FOR VILLA" first, and it says "Look Check, **18**" while the top bar says AGE 19 | MED | seen (packed shows toasts only with an empty news queue, page.tsx:5589) | season2b | game/flow.ts:775-778 (signingNews), NewsMoments.tsx |
| R2-13 | Breaking News ticker | `trial-done` → … → news | scrolls for ever (x changes every frame) | runs one 14 s lap, then stops at translateX(−3993): same x 1 s apart after ~20 s | MED | measured (web build; check on the phone) | news412 | screens/career/NewsMoments.tsx:39-58 (Animated.loop) |
| R2-14 | Golden Ball result | `season-over` → End of Season → SKIP › | cards 360 wide at x 26 (text at 42); Top-10 rows 34 tall, 40 px apart; section label spacing 1 | cards 388 wide at x 12 (text at 28); rows 40 tall, 46 px apart (#9 is 29 px lower); label spacing 2 | MED | measured | gb-result | screens/career/Ceremonies.tsx (result) |
| R2-15 | Season awards | as R2-12 to the awards | award cards tinted per award (navy, greens); number 16 px; name 13 px; club 10 px white | every card navy; number 24 px; name 15 px; club 11 px 72 % | MED | measured | after-sign2 | screens/career/SeasonEnd.tsx (award cards) |
| R2-16 | Contract talks (transfer) | as R2-12 to NEGOTIATE · VILLA | "Their wage offer, per week" 11 px; asking/offer icons in round tiles; "Set Asking Price" / "Accept Offer"; offer card y 475, Your offer 591 | that line 14 px; bare icons; "Set asking price" / "Accept offer"; 17–34 px higher (444, 557) | MED | measured | talks | screens/world/Negotiation.tsx [border: WORLD] |
| R2-17 | Injured, PLAY | `st/injured.json`, Home, PLAY | "YOU'RE INJURED", then the button; no reason line; button square, white glass | an extra line "Hamstring strain. Out for 4 more weeks."; button radius 12, navy; title spacing 0.6 (packed 0.24) | MED | measured | injured-play | screens/career/PreMatch.tsx (injured gate) |
| R2-18 | Youth week | `st/youth.json`, Thanks!, tour, PLAY twice | body 12 px, labels 50 % white, "You are too good…" 11 px, week buttons 11 px | 13 px, 72 %, 13 px, 12 px; the page climbs: 19 px high at "Where you have ended up", 58 px high at THE WEEK | MED | measured | youth-week | screens/career/Youth.tsx |
| R2-19 | Transfer window ticker | `season-over` → End of Season → SKIP → Continue | the foot ticker scrolls (x −249 → −283 in 1.5 s) | one copy, still, cut with an ellipsis | MED | measured | after-gb | screens/world/TransferHub.tsx [border: WORLD] |
| R2-20 | Career overview | `retire-due` → End of Season → SKIP → Continue → HANG THEM UP → SKIP | page from y 94; no toast | everything 17 px higher (name 93 v 110), pager 9 px higher (12 v 21); an "ACHIEVEMENT 2 OF 2 · GOLD · Golden Ball Podium" toast covers THE JOURNEY and the chart | MED | measured | overview | screens/career/EndScreens.tsx; toast host |
| R2-21 | Low energy, PLAY | `st/low-energy.json`, PLAY | the manager's office still over the card, card at the top (📋 y 336) | no picture; an extra line "Running on empty — not fit enough to risk, even off the bench."; card centred (📋 y 165) | LOW | measured (the still is the 3D office: left out) | lowenergy | PreMatch.tsx |
| R2-22 | Transfer window labels | as R2-19, pick Aston Villa | GOALS/ASSISTS/AVG/GAMES, CONTRACT, YOUR CLUB GETS… 80 % white; "Finished 2nd" 85 % | 62 % | LOW | measured | villa-picked | world/TransferHub.tsx |
| R2-23 | Career overview chart | as R2-20, scroll | a season label under every other bar (27/28, 29/30 … 46/47) | only the first and the last | LOW | measured (text) | overview | EndScreens.tsx (chart) |
| R2-24 | Final season notice | `final-next` → End of Season → SKIP → Continue | "SEASON 19 IS OVER" y 239, title 319 | 253 and 333: the column 12–14 px lower | LOW | measured | final-season | SeasonEnd.tsx:124 |
| R2-25 | The final whistle | `retire-due` → … → Continue | "20 SEASONS" pill y 193 | y 204 (11 px low); stat numbers 14 px low | LOW | measured | final-whistle | SeasonEnd.tsx |
| R2-26 | Scout's talk (both apps) | `trial-done`, tap 3× | line 3: "The through the gate is nowhere near it yet." | same | LOW | seen: a broken sentence in the shared text (lib/star), not a KIB difference | offer412 | lib/star scout lines |
| R2-27 | Home pager under the cans | any Home | "‹ 📊 Stats" from x 12; "Shop 🛍️ ›" | "◀ 📊 STATS" from x 18 (the word 12 px right); ▶ for › | LOW | measured | mid-home412 | screens/Home.tsx |
| R2-28 | Not selected (international) | `st/intl-due.json` | team names 85 % white; flag drawn with a fold | 100 % white; flag bigger, rounded | LOW | measured / seen | intl1 | screens/career/IntlScreens.tsx |
| R2-29 | Title | `b6` + packed `star-title-force=1` | "Tutorial" 226,765 | 235,761 (9 px right) | LOW | measured | title1 | screens/career/TitleMenu.tsx |
| R2-30 | Credits sheet | title → CREDITS | KNOWITBALL 121 wide at 145,724 | 151 wide at 131,729 | LOW | measured | credits | TitleMenu.tsx |
| R2-31 | Boots beat button | first Home | "Thanks!" 15 px | 16 px | LOW | measured | home1 | screens/career/StoryBeat.tsx |
| R2-32 | Long name in the top bar | `st/long-names.json` (29-letter name, ★1,250,000), 360×640 | name 15 px, cut after "MAXIMILIANO-ALEXAND…" | 17 px, cut after "MAXIMILIANO-ALE…" (134 px box); ★ shows 1.2m in both | LOW | measured (the top bar is the fixer's: listed for the long-name case only) | long-360x640-top.jpg | ui/look/TopBar.tsx |

Same in both (measured, no row): scout talk and offer (except R2-26); boots beat; welcome tour (energy, Tap Play);
"Time to train" and the Training pointer; every story beat after games 1–6 in order (club shop half price, physio,
team-mate's phone, chairman "Wages are in", gaffer "first goal is on your card", "New in your game" headers and
dribble; `sheet-beats.jpg`); the not-selected page layout; the On duty Home row; farewell invite (22 faces) and team
sheets; Hall of Fame entry; load sheet with one save; tutorial replay; final whistle words. 360×780 and 360×640:
Home, Stats contract, call-up: no clipping or overlap beyond the rows above.

### Not reached this round, and why

- **Free agent on resume (a test-state limit, not a KIB bug)**: KIB Next keeps no phase; a trial with zero scores
  still gets Maidenhead from `offersForTrial`, so KIB resumes on the scout's talk. Packed opens the free-agent page only
  because `make-career-states.mts` writes its saved phase; page.tsx `clublessPhaseFor` gives the same as KIB. The page
  was opened with `__kibNav` (R2-3).
- **Renewal game, loan brief, play-off bracket, promotion/relegation, cup final win, Deadline Day, Player of the
  Month, watched-on-TV, "Boss wants a word", set-piece talk, record banners, ScoutOffers back page, Unlocked pop-up**:
  no state reaches them in both apps yet. The new `loan` state lands on Home with the boots beat in both (packed's
  `loan-brief` phase is not resumable). Most come from the post-match flow: matches were not played (MATCH lane).
- **Farewell match, ovation, farewell full time**: MATCH lane. The walk-out was reached; KIB's web build uses the
  drawn guard of honour, which moves on by itself (packed's 3D waits on KICK OFF ›); 3D only on the phone.
- **3 saves in the load sheet, a 10+ season career with long lists, a 30-letter club, share picture**: not built.
- **Drill intro and drills**: MATCH lane.
