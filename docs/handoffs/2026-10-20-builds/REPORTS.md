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
