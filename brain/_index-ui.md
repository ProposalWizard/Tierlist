# Brain index ui
ID | summary | tags
FACT-UI-001 | Settings keeps only real player preferences (sound, full screen, 3D quality, faces, names) and the Settings UI Old/New row. | three-d,ui
FACT-UI-002 | Decided, no toggle: to see or bring back an old option, read the files at ebe02ad; old stored values are ignored. | ui
FACT-UI-003 | Chances: the team's drawn chances only, everywhere; the New chance library and the Generator were DELETED. | team,ui
FACT-UI-004 | Chance mix: the basic even mix; the Kane drawings were deleted with the StatsBomb data (19 Oct 2026). | ui
FACT-UI-005 | Animations: New; Clearances: always on; Keepers New/Old row kept, default New. | ui
FACT-UI-006 | Dribble: top-down in every match with team-mates to pass to; the first-person duel is on /star-dribble-dev only. | admin,team,ui
FACT-UI-007 | Match camera (action fit): Old until the rebuilt camera lands. | ui
FACT-UI-008 | 2D match: match view New, chance framing Zoom, wide chances Old, camera angle 20 degrees, 2D players Style A, ball New. | ui
FACT-UI-009 | Your player is shown on EVERY chance (Mikey, 20 Oct), moved clear of the ball; still to be re-agreed with Harry. | team,ui
FACT-UI-010 | Shot spread cone: drawn in the test area only (lib/star/testArea.ts). | ui
FACT-UI-011 | 3D world decided: garden New, house New, 3D look H, shop player New, motion Mocap, signing 3D, drill controls Auto. | three-d,ui,economy
FACT-UI-012 | Screens decided: badges, all seasons, Ballon d'Or night, home, shop and ovation New; drawn players Shaded. | career,economy,ui
FACT-UI-013 | Rows that stay: full screen, sound, 3D quality, skip the line-up, Keepers, Match view 3D, player names, UI Old/New, v0.15 test box. | three-d,ui
FACT-UI-014 | Cut scenes: people and camera New, no row; the Version picker went; the rows left live in lib/star/lookRows.ts. | ui
FACT-UI-015 | Faces: photo faces OFF for everyone, every head is the drawn one (PHOTO_FACES); face editors hidden until the photo revamp. | ui
FACT-UI-016 | A new career opens its match moves one at a time (headers and volleys after game 3, steer at Pace 60, sprint at Pace 65, dribble after game 4); power shot, knuckleball, skill moves and one-twos wait for an update. | career,ui
FACT-UI-017 | Mikey's Broadcast pop-ups (scoreboard for a goal, TV caption for the rest) are the only match pop-ups; no setting, the Classic and Arcade words are gone. | team,ui
FACT-UI-018 | [SUPERSEDED] Players reach the game at /road-to-ballon-dor; /star-dev forwards there, and the page's code stays in app/star-dev/. | admin,ui
FACT-UI-019 | The phone app is a separate packed build of the game only (mobile/): offline, saves on the phone, no sign-in, no casino; the website is unchanged. | economy,ui
FACT-UI-020 | The game is named Road to the Golden Ball, its award the Golden Ball; players reach it at /road-to-the-golden-ball. | ui
FACT-UI-021 | The admin's default look is "Knowitball": calm tiles on the admin home, a dark green menu and rows everywhere else; the four older looks stay as skins. | ui,admin
FACT-UI-022 | The new public home is on the test page /home-new-dev in three looks (a Stadium night, b Friv Classic, c Clean arcade); the live home is unchanged until Harry picks. | ui
FACT-UI-023 | Whole-site plan (Leo, 24 Nov 2026, not built): every public page gets the home's cream/green look and one frame (green top bar with one menu, a game bar, green footer); old games refreshed; Draft in three waves. Today only the home and All games have that look (home.css overrides). | ui,team
FACT-UI-024 | The New look preview: an admin-only switch (Admin → New look, or ?look=v2 / ?look=off) shows the new site look on that device only, Light (cream) or Dark; public pages only, never the game or admin. All Tailwind colours read CSS variables whose normal values are Tailwind's own. | ui,admin,rule
FACT-UI-025 | Behind the New look switch (usePreview): Daily Draft (same spins for all by UK date, first-season points ranked by /api/draft/daily via draft_runs.event_key "daily:<date>:", first per player), Draft spot ratings + best spot, Tic Tac Toe today-first + streak + Share, Ten-A-Ball topics + bests + Share; Rankings run past the pause for the tester (middleware.ts). | ui,career
FACT-UI-026 | PL Draft (New look switch): every draft is Ranked (full era, 3 re-spins, ratings shown) for one of three Hall of Fame boards (Normal, Prime, Chemistry with Normal ratings) or Custom (history only); FIFA-style Chemistry (lib/draft/chemistry.ts, up to +3 each, ~6-10 pts a season at 33); the Chemistry board needs supabase/migrations/draft_records_chemistry.sql run (PENDING). | ui,career,data
FACT-UI-027 | When the browser gives the page no WebGL, the game says so once per visit (bottom notice with the fix steps) instead of silently showing the flat garden, shop and house. | economy,ui
RUL-UI-001 | [SUPERSEDED] Decide, don't toggle: a new look or gameplay change is built as THE game, with no new New/Old row in Settings. | ui
RUL-UI-002 | Unfinished work lives on a test page (a /star-*-dev page), not behind a switch in the real game. | ui,admin
RUL-UI-003 | Existing switches stay until someone decides each one; never delete one unasked. | rule,ui
RUL-UI-004 | "Preview" (game version) is used only when someone asks for it in those words; otherwise a change goes straight into the game. | rule,ui
RUL-UI-005 | Harry's changes go straight into the game when he says push: no new New/Old row, no Preview entry. | deploy,ui
RUL-UI-006 | "No scroll wheel inside a screen: just show it and you scroll down; never add a scroll wheel unless Mikey specifically says." | team,rule,ui
RUL-UI-007 | Decide, don't toggle, EXCEPT skins: a whole-UI skin (e.g. Glass stadium) may be a Settings choice; gameplay and single-feature looks still get no New/Old row. | ui
RUL-UI-008 | The 3D phone: Phone tab = eye-blink into a 3D phone in your hands (the phone UI on it); Home goes to Home, Put phone away leaves you in your 3D house; today's Showroom shop moves onto the 3D phone, the menus get a new plain unified shop. | three-d,economy,ui
RUL-UI-009 | [SUPERSEDED] Every page has the relevant stats as the top 2 bars, in the Home bar style (3D icon over the bar): shop fame + money with a dollar bill icon; phone level + money; relations happiness + rep. | three-d,economy,ui
RUL-UI-010 | The menu shop is B (big picture + thumbnails) on G1 (the 3D store blurred behind frosted glass), no pitch background, SHOP at top middle, money up where fitness is, age and stars not needed on this page. | three-d,economy,ui
RUL-UI-011 | Money should be £ instead of dollars (£ pounds): the shop goes into the game, the Owner app gets Money + Reputation, the Sponsors fame pill goes. | economy,ui
RUL-UI-012 | The original blink was better (one quick half-blink, ~0.8 s); the houses and 3D space need cleaning up, sticking to the style but making it clean; driving from here to training/matchday is wanted. | three-d,ui
RUL-UI-013 | Red Dead Redemption hair idea (hair and facial hair grow over a szn, style it in your bathroom, go to a barbers), a training centre food hall where teammates naturally go about their day, random events; bit by bit, mobile and PC. | team,ui
RUL-UI-014 | Any change to the site's look must pass the readability check (scripts/site-look/contrast.mjs) on every public page, light and dark, signed out AND signed in, phone and computer, before it ships; never only signed-out pictures. | ui,rule
