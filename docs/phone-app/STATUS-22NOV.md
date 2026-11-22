# KIB Next: where it stands (22 Nov 2026) — paused to decide if it is worth continuing

Why paused: the build-and-playtest loop used 4-5 five-hour usage limits very fast. Mikey and Harry are
deciding whether to keep KIB Next (React Native/Expo, `phone/`) or make the packed web app (Capacitor,
`mobile/`) smooth instead. Reason KIB Next exists: a more real-app feel and less lag between screens.

## Done and merged (branch claude/eloquent-bohr-6veqfh, last merge 6b88dcf4)
Whole game on the shared lib/star rules; parity checks identical (match-parity, career-flow, screens, world,
boot, popin). Fit fixes, hidden bars, font size fixed, farewell crash fixed, players-appearing fix, match rounds
1-3, career and world missing pieces, three playtests (found ~100 measured differences).

## Not merged, saved in worktrees under .claude/worktrees/ (may be lost if the container is reclaimed)
- agent-a872f640f18e663ef: app-wide text look (line heights, Anton >=16px bold, shadows, top/bottom bars). THE key fix for "things feel off".
- agent-a1274733d13d916e8: world round 2 (59 findings). agent-a6496abd44f1373e0: career round 2 (32). agent-a7d5b0d04987b8c3a: match round 2 (9).

## Still to do
1. Merge the four worktrees above and rebuild; 2. Playtest round 3 (match: extra time, shootout, half time, subs, corners, own goal);
3. Release setup: real package uk.co.knowitball.game, upload key, remove extra permissions, 32-bit phones, move saves from the packed app;
4. Merge to main needs Harry's OK (one-engine guard + root tsconfig must skip `phone/`).
Only a real phone can confirm: font size, camera hole, hidden bars, buzz, music, photo, 3D, smoothness.

## Mikey's playtest of test app 4 (22 Nov)
- FIXED (not yet in an app): title "Main menu" from "Who are you?" closed the app → the title's player is now inside a safety net (TitleMenu `Quiet`); real cause unknown without the error screen. Cans "FULL" wrapped to FUL/L → one line, shrinks to fit. Phone → Social: less gap above the ticker and the ALL/ENGLAND/CLUB chips.
- OPEN: trial dribble ignores taps (MatchFirstPerson gesture inside Trial's ScrollView; code reads fine, needs a device run). Mikey unsure the dribble stage should stay.
- OPEN: trial free kick: after the ball leaves the screen the player chases it and it takes a while to move on.
- NOTE: photo has no face scan like the website (known). A deflection up into the air looked great.
