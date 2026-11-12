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
RUL-UI-001 | [SUPERSEDED] Decide, don't toggle: a new look or gameplay change is built as THE game, with no new New/Old row in Settings. | ui
RUL-UI-002 | Unfinished work lives on a test page (a /star-*-dev page), not behind a switch in the real game. | ui,admin
RUL-UI-003 | Existing switches stay until someone decides each one; never delete one unasked. | rule,ui
RUL-UI-004 | "Preview" (game version) is used only when someone asks for it in those words; otherwise a change goes straight into the game. | rule,ui
RUL-UI-005 | Harry's changes go straight into the game when he says push: no new New/Old row, no Preview entry. | deploy,ui
RUL-UI-006 | "No scroll wheel inside a screen: just show it and you scroll down; never add a scroll wheel unless Mikey specifically says." | team,rule,ui
RUL-UI-007 | Decide, don't toggle, EXCEPT skins: a whole-UI skin (e.g. Glass stadium) may be a Settings choice; gameplay and single-feature looks still get no New/Old row. | ui
