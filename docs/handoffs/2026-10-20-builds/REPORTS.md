# Overnight builds, 20 Oct 2026 — what each build did (from the builders' reports)

All on branch `Harry`, NOT live (Harry has not said push). Stills in `docs/handoffs/2026-10-20-builds/<build>/`.

## B1 — Phone touch fixes + old failing tests
- 26 of 27 touch fixes built. G5 (in-match mute / TOUCH / Power button sizes) LEFT: it's in a drift file and needs Harry's OK. Change needed is class-only.
- Seen on a touch phone screen: negotiation −/+ (one tap = one step, 1.9m → 2.15m; holding and sliding off stops); energy mode captions LOW/MEDIUM/HIGH; achievements show their description on tap; profile delete ✕ shown on touch, 32 px, tap opens the confirm and doesn't navigate; admin image grip ⠿ ("phone: hold an image, then drag"); zoom overlay − / + buttons and pinch (+ + = 150%, pinch 100% → 300%).
- Reasoned (not seen): bigger touch areas on page arrows, grab bar, help button, close/sound buttons, colour inputs, minimap markers, sliders, gallery dots, chips; tap-to-show names on trophies and last-5 opponents; pointerdown click-outside; create-tierlist ✕/✂ on touch; crop hint "pinch or use the slider".
- Old tests: all 4 now pass. chanceJudge, keeperPro, keeperBrain broke when the drawings were redrawn/deleted on 14–15 Oct, not from code: fed the 14 Oct drawings, all three passed with the old numbers. Re-pinned fingerprints; samples raised (keeperPro 80 → 240 seeds, keeperBrain 200 → 600); limits NOT loosened. keeperPro errors 1.6% → 0.8% (limit 1.5%), rebound goals 7.2% → 5.5% (limit 7%). keeperBrain "moves early" 54.6% → 59.5% (floor 55%).
- Wembley test = a real game change (3D Wembley minigame): the stronger striker's rising shot crossed at 2.2–2.3 m and hit the bar 17 times in 124 shots. Now aimed lower; keeper 36 → 70; valve drop 6 → 10. The 80-rated striker's win share 23% → 40% (fair share 25%). Session 89 s → 146 s. Shots in 53% → 38%. Never passed in visible history.
- Player of the Month cards: now drawn heads (photo links needed a SoFIFA sign-in). Seen: 11 drawn heads, 0 broken images.
- Full suite: 365 passed, 3 failed (chanceMaker, longRangeRules, match2dCam), all failing the same on the base before B1.

## B4 — Admin: one layout, four skins, back arrow, chat bubble, Research
- All 4 looks (Broadcast, Bento, Ops room, Clean light) share Broadcast's layout; only colours/fonts/surfaces change. Bento cards readable (dark words on pale tint, white count pill).
- Light looks on ~40 test pages: an "ink guard" fixes unreadable words. Measured: ~320 unreadable words on 12 pages → 0–3 per page.
- One back arrow, top left, same place everywhere (measured at the same corner on every framed page on a phone). A page goes back to its group; a group page to its game's home.
- Chat bubble: 40 px (was 50), fixed bottom left; only the round button takes taps; fades to 40% while scrolling and lets taps through. Measured on a phone: nothing under it on admin home, Infinite Highlights, Full match, gallery, Play Area; on Training levels it covers the left 11 px of "Let's go", which still takes the tap.
- Research area on the Studio tab: /admin/research, 4 write-ups as cards, one-line list in lib/research.ts.
- Not done: 3D garden/house/shop/training keep their own in-game back.

## B7 — Training levels editable + harder final levels
- All 150 levels (5 drills × 30) are data now; editable on the Training levels page like the gallery: sliders/number boxes, ▶ Play at once, Save (shared table + device), Commit (to the repo), Undo, Back to committed. Dots: amber unsaved, green saved for everyone, orange device only.
- Vision: a new picture each try (before: try 2 was just the answer). Level 30: 8 → 11 team-mates, 6 → 13 defenders, 0.95 → 0.85 s, tap area 3.2 → 2.2 m. Modelled player first-try pass rate: L30 67% → 41% (L20 93%, L25 70%, L28 54%).
- Pace: was flat 28% cleared from L24 to L30; now L20 43% → L25 22% → L30 14% (bot on the real run).
- Power / Free kick / Technique top levels a bit harder and need placed shots (reasoned, not measured).
- Seen in a browser: editor, ▶ Play of an edited Technique L30 (5 m gate), Save "on this device only", reload kept it.
- Pending database file for Mikey: star_training_levels.sql.

## B9 — Lower League Trophy + hold to speed up / double-tap to skip
- Lower League Trophy: 120 clubs (League One, League Two, National League, North, South — this season's ladder), 128-slot draw, 8 byes to last season's League One top 8, 7 rounds, 119 matches, Wednesdays (weekends 4, 8, 16, 21, 25, 29, 34). Penalties straight away before the quarter-finals; extra time then penalties from the quarter-finals.
- Tested over 200 seasons: 200/200 a winner and exactly 119 matches; no date clashes with league or FA Cup.
- Prize: trophy in the cabinet, 30,000 XP (League Cup 108,000), fame +2, a small transfer-interest boost from those leagues (+0.05 semi-final, +0.1 winner). Cash prize of 2 weeks' wage — DECISION FOR HARRY (no cup ever paid cash before).
- Hold anywhere after a match: 4×; double-tap: skip to the end of that screen. Star bar measured: ~3.4 s normal, ~1.1 s held, ~0.6 s double-tap. Crediting unchanged. Hint shows the first 3 times.
- Found, not fixed: below the Championship, the FA Cup Round of 64 lands the day after a league game.

## B11 — Team room: seen faces, replies, @, #, Shift+X, patch-note receipts
- Seen faces (H/M/L) under messages; Reply with quote and tap-to-jump; @ suggestions + gold highlight + "Waiting on me" list; 🔗 attach this page + # page suggestions as cards; Shift+X / 👉 Point: drag a box, write a note, pick who; the link scrolls to the box, outlines it and shows the note until Got it.
- Patch notes: "Read by" faces, "Read and understood" button, notes thread per version; Team board shows "N patch notes to read" per person.
- Seen in the local test room at phone and computer size. Not tried against the real database, a real iPhone, or two people at once.
- Pending database file for Mikey: team_room_v2.sql. Until then replies/@/points work; seen faces and Got it stay on the device (screen says so).

## B3 — Free data, credits, Real moment highlights
- Afriskaut removed (Harry's ask). Matches 2,104 → 1,983 (lost 136, added SoccerTrack v2 + SkillCorner 2019/20). Tracked matches 27 → 42. Fully real moments 702 → 926 (750 shots, 176 corners). Real goals 67 → 93.
- New sources: SoccerTrack v2 (CC BY 4.0, 6 of 10 matches; Google Drive refused the other 4 — re-run later), SkillCorner first release (MIT, 9 matches, pattern data only).
- Checked and NOT used (licence unclear): European Soccer Database, Global Football Data Lake, PFF World Cup 2022, Metrica, Last Row, SoccerTrack v1, SoccerNet. Not allowed: a women's set (non-commercial), SoccerMon (98 GB, one team).
- Settings → More → Data credits (8 lines).
- New switch: Settings → Full highlights rebuild → "Real moment highlights: Off | On" (only while the rebuild is On). With it on, 1 in 4 open-play one-on-ones / tight angles / long range become a real moment of the same kind, with the real 4 s build-up. 652 moments allowed in the game. Tested over 120 matches: 24.5% served, right kind 100%, "Don't use" served 0 of 400.
- Real moments page: per moment Use in game / Don't use / Automatic, filter, count, "Commit marks to the game". README explains add/remove/edit.
- Seen: credits, switches, the page marks, a SoccerTrack moment, a real moment served in Infinite Match. Not seen: inside a career match.
- Pending database file for Mikey: star_real_moments_picks.sql.

## B6 — Scene editor 3b, Approve + Commit to game, Scene generator, last 6 pages framed
- Scene editor: the 3D Shop, Garden and House now edit live like Signing and Office (Walking view + card/room views; Turn, Rise, Distance, Lens; key light, angle, colour, exposure; drag the preview; drag the sun). No edit = plays exactly as before.
- "Use in the game" panel on every place: ✓ APPROVE / Withdraw; Where (career and/or test page); When (always, or one moment: signing first contract/move, shop entry, garden day/sunset/night, which home, which Director event). The game reads ONLY approved edits (committed file lib/star/data/sceneEdits.json + shared approved rows; newer wins).
- Measured: an approved office edit moved the office test camera from 44° to 19.4° (70 mm lens); reverted after.
- Commit to game: writes approved edits into the repo file on main (needs GITHUB_TOKEN + admin; honest message when missing). Each commit triggers a Vercel production rebuild.
- Scene generator (Studio tab, /admin/scene-generator): pick event (18), feeling (12), size, intensity, seed; Generate / Re-roll; recipe (place, mood, length, people, film-rules score, beats, shots); 👍/👎; Keep as a hand-made scene (opens in the editor).
- "When does this play?": 18 rows, all "Not wired" — generated scenes play only on test pages today. A test fails if a career screen starts calling the generator while every row says Not wired.
- Last 6 admin pages (signing, office, shop, garden, house, style test) on the Broadcast frame: 37 → 43 of 43. ?bare=1 gives the old full screen.
- Fixed along the way: shop/garden/house scenes could stop the shared 3D renderer when a build was thrown away mid-start (game time stayed at 0 on the framed shop page; now moves).
- No new database file. Seen in a browser: all of the above except career paths with a real admin save (reasoned).

## B8 — Five-a-side test area with tabs (/star-fiveaside-dev)
- New test page with three tabs: Scenarios (the gallery's 10 five-a-side pictures, each playable as Yours / Team-mate's / Theirs, Prev/Again/Next pinned on top), Full match (kick-off to full time with a new five-a-side radar showing all 10 players and the ball), Data (from 500 simulated matches).
- The old Match radar can't show five-a-side (zones only, no players), so a new SVG radar was drawn in the same look, fed by a read-only callback. No engine or drift file changed.
- Gallery chance pictures moved into one shared file (not copied).
- Fixed: at full time straight after their chance, the scene was drawn the wrong way round with kits swapped (also reaches the trial's five-a-side).
- Numbers (500 matches, Even, skill 70): goals 1.83 yours – 1.09 theirs; won 56%, drew 19%, lost 24%; shots 6.1 v 5.8; 53% of the ball. By level: Easy 2.58–0.56 (82% won), Hard 1.15–1.55 (28% won).
- BROKEN, found not fixed (gameplay calls for Harry): (1) a pass to a team-mate in the last third never becomes his shot — 0 of 1,000 (he keeps the ball; five-a-side chances never name a receiver), so you can never get an assist. (2) Chance pictures 1 and 6 never score for the bot: 0 of 200 each (66% and 99.5% of shots blocked).
- Seen in Chromium: all three tabs on phone and computer, two full matches to full time with the radar matching the pitch. Clip: b8/10-pc-full-match-radar.mp4 (8 s).

## B5 — 3D: bench, natural skin, phone cut-scene cameras, moving faces, Home player alive
- Bench page /star-3d-bench-dev: the same 10 shots at phone size (Home, signing, office, press, trophy lift, walk-out, garden, Free Roam drill, 2 generated scenes), frame numbers each, "Now / Before (19 Oct)" switch, skin probe. Sub-pages /home, /face, /faces.
- Skin and light. Cause: the film-style tone mapping maxes out red first, and the warm grade added yellow. Fix (no new light, no new draw): skin keeps half of each light's colour; skin is tone-mapped by brightness only and spared 80% of the colour grade. Soft rim light on Home only.
- Skin median hue, before → after (player skin tones sit at 23–31°; "yellow" = share of skin over 36°): signing 42.7° (94% yellow) → 27.1° (0%); press 45.2° (94%) → 28.1° (0.2%); walk-out 38.2° (61%) → 27.1° (0%); generated trophy 40.0° (90%) → 28.4° (0.2%); trophy lift 20.5° sat 0.99 → 24.2° sat 0.68; office 32.6° → 25.0°; Home 27.2° → 26.4°.
- Phone cut-scene cameras: each person shot has a minimum width on a tall screen, head in the top part; inserts show the whole prop; a still camera is checked at every moment of its shot and swings round to clear any head within 1.3 m of the lens (found from a 6 s clip: the mentor's face filled the screen 0.4 s into a shot). Bad shots at phone size: the 3D audit's 23 moments 11 → 0; every camera shot mid-shot 27 of 65 → 0; 3 moments per shot 82 of 195 → 0.
- Moving faces on every Style A head (cut scenes and Home): blinks, glances, moving irises, expressions from each beat's feeling, lips with teeth when speaking. No photo faces.
- Home player alive: a 33 s loop from existing clips — idle, keepy-uppies with his own ball, idle, a few words, idle, a quad stretch; feet apart, weight shift; camera a quarter-turn round; soft shadow, side sun, rim light.
- Seen: every bench before/after still, the face loop, the Home loop, the mentor clip before/after. Measured: skin and framing numbers. Reasoned, not seen: Low quality tier, phone frame rates, shop/casino skin, screens other than 390×844.
- Left: the 90th-minute winner → celebration → trophy cut scene; props held in hands; one stadium for cut scenes. Walk-out wide shot still has away players passing ~1 m from the lens (same as before) — Harry to judge on his phone.
- Old looks: ?skinfix=0, ?framing=old, ?face=old on the test pages.
- Stills/clips: docs/handoffs/2026-10-20-builds/b5/ (home-idling.mp4, cutscene-mentor-talking.mp4).

## B12 — Vision rebuilt as "Pick the Pass"
- Pictures: 263 real passes from tracked matches (DFL, SkillCorner, SoccerTrack) plus the team's drawn chances on levels 1, 2 and 10. Drawn in the real match's new view through EngineFeature. No guide line. Only the men who matter are drawn; the two deepest defenders always stay, so the offside line is exact.
- The question: who gets the pass? Traps: a man offside, a cut lane, a marked man. The right man is checked with the engine's own rules; every pass in every picture was played 24 times on the engine (right man reached ≥ 80%, cut lane < 40%).
- Levels 1–9: tap the man (4.0 s down to 1.3 s). From level 10: kick the pass with the real drag and strike. Time to start the kick: 1.8 s at L10 → 0.3 s from L28. The engine judges the kick.
- After each try: RIGHT MAN / OFFSIDE / CUT OUT / MARKED / NOT THE BALL / MISPLACED / TOO SLOW, one line why ("Gnabry was beyond the last man. Coman was the ball."), right man ringed green ✓, your pick red ✗. A real picture names its match and minute.
- Fewer repeats: 1 → 30 shows 45 different pictures in 90 tries (32 before); an ordinary picture comes back on 3 levels at most (7 before).
- Curve, modelled good player, kicks played on the engine (first try): L1 99%, L10 93%, L20 36%, L25 28%, L30 21%. Steepest step L14 87% → L16 51%. Every level's numbers can be softened in the editor.
- Measured on the engine: 30/30 passes to an offside man ended OFFSIDE; 240/240 good passes found the right man; 119/120 passes into a cut lane were lost.
- Seen at 390×844 (stills + 9 s clip in b12/). Not tried on a real phone at 0.3 s.
- Open: only 5 real offside pictures for 13 offside levels (one comes back on 6 levels). No engine or drift file changed.

## B7b — Training editor drag and drop, auto skill, Pace skill
- Drag and drop like the gallery: the level's picture from above beside the sliders. Power: ball and each man; Technique: ball, either cone, or the gate's middle; Free kick: ball and each wall man; Pace: each man along his wave's line. ↶ Undo per step, Undo all, dots unchanged, ▶ Play uses the dragged picture. Vision can't be dragged yet (one entry to add in lib/star/trainingLayout.ts).
- No "your skills" slider: a level plays with the skills you'd have after the levels before it, by the career's own rule (40 + stars × 60 / 90), taking 2 of 3 stars on each earlier level. One line: "Plays with: Power 65 · Technique 65 — what you'd have after levels 1–19". Range shown (level 20: 53 with 1 star each, 65 with 2, 78 with 3).
- Pace "knock-on": one man per wave comes for the ball and wears a ring; amber, then green for a short window (0.30 s v weak men → 0.05 s v the best): flick the other way then. Too early: he goes with you. Training drill only; the real match and trial unchanged (tested).
- Cleared runs, before → after (L1–10 / L11–20 / L21–30): good bot 75→85 / 64→75 / 61→37%; decent 68→65 / 60→52 / 52→22%; hasty 45→20 / 56→29 / 27→8%; careless 16→8 / 17→15 / 5→3%. Before, waiting for the right moment made no difference.
- Seen at 390×844 and 1440: drags (mouse and finger), Undo, Play, Save ("this device only"), reload kept it, the rings, "Knocked it past him!". Stills + 7 s clip in b7b/.
- Found, not fixed: the Training levels page freezes on the second tab switch after picking a level, then crashes, in the test browser (the old page does the same). Not checked on a phone.
- Decision for Harry: at 2 stars a level, a career player is always behind on Power levels, so they always get eased (level 20: 26 m drawn, 22 m played). That's how the career already works; it's now visible.

## B13 — Every fixture date checked, plus admin fixes
- New checker tests/star/fixtureClashes.mts: 5 seasons (2026/27–2030/31) through the real career code in every division, every cup/Europe tie won, play-offs reached, called up every window. Rules: no two games a day, none on days in a row, two clear days between games, rounds in order, season over by 31 May and before the June window, PL and Championship stop for FIFA windows.
- Clashes over 45 seasons: 170 → 0 (PL Leeds 5→0, PL+CL 31→0, PL+EL 31→0, Championship 23→0, League One/Two/National/North/South 16→0 each).
- Main causes before: play-off games after the season (48), games inside an international break (42), FA Cup R64 the day after a Tuesday league round (30), a game 1–2 days from an international (22), FA Cup QF the day after a PL Tuesday (10), the European final on Tue 1 June (10), Community Shield the day after the Super Cup (8).
- Changes: Championship-and-below Tuesday rounds moved; midweek games inside a FIFA window move to the Wednesday after; PL clubs in Europe play both domestic cups on their own fixed weekends; European final week 38 → 36; play-offs all in May; Community Shield the Saturday a week before the league; squad named 3 days before internationals, and a club game up to 2 days after the last international is missed.
- Still clashes (not counted): a Championship club in Europe that wins everything needs ~38 midweeks; a season has 34. 56 → 20, none before 1 January.
- XP Rewards "Failed to fetch": now loads on a test build (read-only note); every failure said in plain words.
- Chat bubble: pages mark their own bottom-left controls; the bubble sits above them (Office: up 132 px, "Next line ›" clear).
- Team board push count: now real pushes from GitHub's push log, any branch, last 7 days, own work only. Seen: Harry 166, Mikey 34, Leo 21 (before: capped at the newest 20 commits, and main's merged work counted as his).
- "GitHub refused the site's key": came from the local test computer's key, not Vercel's; a refused key is tried once then the board reads without it; one line says whose key.
- Watch: Mikey's unmerged "FA Cup: ten rounds" touches the same calendar — run tests/star/fixtureClashes.mts after it merges.

## B15 — 3D-model headshots on award cards
- Player of the Month (shortlist, winner card, "You won it" pop-up), season awards (each award + Team of the Season) and Ballon d'Or (result page, top ten, countdown, winner, runner-up) now show a head-and-shoulders picture from our 3D Style A model in the player's club kit. Before: drawn heads (PotM) and the made-up photo faces (season awards, Ballon d'Or) even though photo faces are off.
- Each player has the same seeded look the 3D match men use (keyed to squad id); you get your own look from Settings → Your look. One hidden renderer, one fixed lens/pose/studio light, never resized.
- Made only when a card comes near the screen, one at a time; kept on the device (~10 KB each, newest 400). Second visit: 0 new pictures, all 13 faces in 0.5 s.
- Fallback: the drawn head until ready, and if WebGL is missing (seen: 10 failed → 10 drawn heads, no blank circles).
- Time on this machine (no graphics chip): start-up 1.3–3.3 s once per visit, each picture ~0.2 s (first 0.6–1.0 s); 13 faces from scratch ~6 s.
- Not changed: team sheets (drawn head; one-line swap if wanted), scout report, transfers panel, league and matchday screens (still photo-face paths).
- Looks odd: blond hair colour also goes on eyebrows and beard; on dark skin up close it reads oddly (still 09). Shared 3D look, not changed.
- Seen on test pages at 390×844; not in a real career or on a phone. Stills in b15/.

## B9b — The Lower League Trophy gets its own screen (and so do the other cups)
- "Mikey's FA Cup screen" on Harry is the after-match round-up: results board, "Road to the Final" bracket, the cup draw. B9 had wired those to the Trophy. Where you browse cups (League → Table → a cup's tab), each was a long list: the Trophy's Round 1 was 56 rows (about two phone screens).
- Now League → Table → Trophy tab: cup colour, headline ("Round 1"), your next tie ("Wed 9 Sep · away at Walsall"), a road with a segment per round, and Open the Trophy. Fits one 844 px screen.
- The cup's own screen (CupScreen): headline (Winners / Out / Not in it / Cup-tied / bye), your road, Mikey's bracket from the last 16, every round's results with ‹ › arrows (byes under Round 1), "Still in it" crests; bottom bar Back · The draw · Play.
- One screen for all three domestic cups (FA Cup and League Cup tabs work the same way now, each in its own colour). The FA Cup tab no longer lists every tie; the list is one tap away.
- Reused, not copied: Mikey's Board and Bracket, CupDrawReveal, cupBoard/cupBracket. page.tsx not touched.
- Seen at 390×844 in the real game (League One career at Huddersfield, matches played through the real Sim): Round 1 went 1–1, 4–3 on penalties (penalties straight away, as the rules say). Stills in b9b/.
- Open: no Trophy picture yet (🏆 emoji); a tie you only watched goes straight back to Home (same as the FA Cup); after a Round 1 bye no draw pops up (see it with "The draw"); a Premier League career still shows the Trophy tab as "Not in it" — hide it?

## B16 — 3D keepers save about 1 in 3
- 3D games with a keeper: Free Roam, Headers & Volleys, Wembley (the dribble run has a keeper but no shooting; Crossbar, Two Touch and Pace have none).
- Save rate of on-target shots, before → after (600 shots per bot; "on target" = it goes in with the keeper removed): Free Roam decent 70→33%, good 25→14%, careless 75→56%; Headers & Volleys decent 52→31%, good 37→20%, careless 75→54%; Wembley (you) decent 69→33%, good 40→15%, careless 76→55%; Wembley AI men 60s 45→18%, the 80 31→11%.
- What was wrong: his cover had a hard edge (saved everything within ~2.6 m of his spot, missed everything beyond). Now a slope: reaction 0.30→0.33 s, read error for a 66 keeper 0.39→0.77 m, body reach 1.36→1.17 m, hands past body 0.8→0.66 m, stretch varies ±30% dive to dive, close-range reflex slower and shorter. Dive speed, grab and all sizes unchanged. A better keeper still saves more (at 18 m: 35% in v a 90 keeper, 44% v 70, 49% v 50).
- Wembley's keeper 70 → 66 (same as the other two; at 70 a decent player was still saved 38%). Sessions shorter: 146 s → 83 s; wembley3d.mts floor moved 100 → 75 s with the reason in the test. The 80 still wins more than his fair quarter (30%, was 40%). Bar hits checked per shooter.
- Headers & Volleys win bar 6 → 8 points (at 6 the average bot would win 82% of sessions; at 8, 53%, same as before) — say if you'd rather keep 6. Free Roam's win bar (10) unchanged, never measured; goals now come easier.
- Found, not fixed: high-skill players blaze over in 3D (a 3D swipe always strikes the middle of the ball: an 80-power firm shot from 12–20 m goes over ~78%); Wembley AI men all aim tight to the post (saved 18% v a human's 33%).
- Seen once per game at 390×844 (a save and a goal each); stills + 6 s clip in b16/. Reasoned: dive animation unchanged while his reach is shorter, so near full stretch a ball may pass just beyond the drawn glove.

## B17 — PC match + radar test page (/star-pc-match-dev)
- New test page "PC match + radar" (Match tests group). Computer: the real 90-minute match on the left at its real size (384 px), a live radar on the right pinned to the top; at 1440×900 the whole pitch and radar fit. Radar in FiveRadar's look (stripes, your goal left, blue you / orange them, you ringed yellow, white ball). Under it: momentum bar, one-line status, a "This match" list (goals, shots, corners, your chances and how each ended). Bar above: ↻ New match, View 2D | 3D, "Club and dials: Play Area ›". Always plays 90 minutes.
- Between chances: the unseen match minute by minute (ball dot glides area to area with a trail; the area lit in the side's colour; GOAL!/SHOT/CORNER/YOUR CHANCE flash). Data from the match's own small commentary radar via a read-only hook (MatchRadar.tsx) and a page-only override (matchRadarLook.ts); absent from every real match. During a chance: every man, both keepers and the ball at the positions the match just drew (EngineFrameContext), plus the visible-frame box. During a dribble: holds the last minute and says so.
- Phone 390×844: the radar folds under the match (pitch 366 px, same as the real match).
- 3D: built — the page's 2D | 3D switch uses the career's Match view 3D picture, this page only (~12 s to load here, no graphics chip).
- No red-guarded file edited. Measured: the dot sat inside the named area 455 of 455 minutes over 5 matches.
- Seen: ~6 minutes over several matches at both sizes, 3 chances checked by eye, 3D view, dribble hold. Not seen: full time panel, a penalty against you.
- Found, not fixed (career change, Harry's call): the career's in-match radar (Settings → Match radar: New) draws its dot outside its own lit area 220 of 455 minutes, 50 of them off the pitch — its position shuffle can go negative. One-line fix in MatchRadar.tsx `jitter` (end with `>>> 0`). The test page uses a corrected copy.

## B2 — Highlights rebuild: the switch, build-ups, moving players, extra defender, fouls
- Chances and goals unchanged Off or On: 5.81 chances / 2.31 goals a match over 500 matches (Off, On, On + build-ups).
- Switch "Full highlights rebuild: Off | On" with "?" in main Settings → Quick, a ⚙ on the pre-match line-up, and the match ⚙; visible to everyone. "?" lists 8 parts. /star-fhr-dev left the Chances group (test page, Ruler | Build-ups tabs).
- Infinite Highlights / Infinite Match use the career's build-up builder; Moment / Length / Intensity control on the test pages only.
- Big moments: median 6.4 s ordinary → 9.4 s in a level final at 90' (max 11.4 s); quicker passing; ordinary moments keep the old tempo.
- Players moving at hand-over ease into place ~0.9 s (≤ 1.6 m), stop at the kick; 358 build-ups: ~8 men moving, median 2.6 m/s, 0 problems.
- Extra defender from off screen when the defence is thin, always behind the ball: 269 of 2,757 open-play chances (9.8%); goals 14.5% → 14.9%, blocked/tackled 31.6% → 30.5%, players reacting 4.62 → 5.74.
- Fouls before ~half of free kicks and penalties (carry, foul, whistle, "Foul! Free kick." / "Penalty!", walk to places): 44 of 44, 4.4–6.3 s.
- Mikey's gallery never written to (tested). canvasEngine.ts unchanged (Harry refused two engine edits; left out). Drift files changed for the switch only; pitch widths re-measured as the audit (366/493, 366/384).
- Seen at 390×844 incl. a 9 s clip and a 24-build-up sheet (0 problems). Reasoned: run-on stopping on an early kick, the whistle sound, drag feel on a phone.

## B19 — Team is the admin home
- Admins land on the Team board from: the site menu's Admin, Settings → Developer → Admin pages, the slide-out top link ("Admin & Dev · Team"), the KIB Admin app (new /admin/home), a game home's back arrow, old breadcrumbs. Testers keep their home.
- Left menu: Team first (people icon); inside it Team board, Team chat, Ideas, My to-do, Patch notes; then Games; then Videos. Patch notes moved into the Team area. Folded/phone: Team first. All four skins, same layout.
- Seen at 1440×900 and 390×844 locally. Reasoned: the site menu's Admin link (needs real admin sign-in), testers' view, live database path.
- Left over: phones that added the KIB Admin app may open the old home until re-added; Site content (/admin) is now at Website games → Tierlists.

## Team jobs by push (Harry: "just use pushes")
- Jobs live in team/jobs.json (id, owner Harry/Mikey/Leo/all, title ≤ 200, prompt ≤ 4000, from, added). A Claude chat adds one by editing the file and pushing its own branch; no SQL, no deploy (team/README.md).
- The board reads main, Harry, Mikey and Leo from GitHub (GITHUB_TOKEN), cached 60 s, newest `added` wins; built-in copy when GitHub can't be reached.
- To-do: "Given to me", tag "from a push · Harry", Copy prompt (871 characters copied; fallback box selected), no ✕, counts in the amber badge.
- Ticks: the person's own team_tasks row "[job:<id>] <title>", hidden from the normal lists; each person ticks their own.
- First job: the lag test, for all, with the prompt. Seen in demo mode only (not against the real database, no live GitHub read: rate-limited). Reaches the live board only after the next merge to main.
- Found, not fixed: tick boxes look stretched tall at phone width (older jobs too).
