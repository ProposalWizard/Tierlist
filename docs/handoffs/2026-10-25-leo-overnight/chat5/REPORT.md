# Chat 5 · Real Goals ready for players — report (25 Oct 2026)

Branch `leo-realgoals` (origin/main ac28a57d merged in). Started 12:34 UTC (the job reached this chat at 12:29 UTC, after the first deadline; the hub moved it to 16:30).
**Only the Real Goals test page changed** (`app/star-real-goals-dev/page.tsx`) plus test scripts and docs. No game file changed, so the game is exactly as before with or without Leo's switch (nothing new needs the switch: it is all on the admin test page).

## (a) Played every path (production build, phone slowed 4×, 390 × 844)
A script played the first 5 levels of all 8 paths like a player: open the path, open the level, watch the real build-up, then pull back and tap to shoot, aiming from the result picture until it scores (at most 12 tries). Script: `scripts/film/scenes/rg-play.mjs`. Every level's start and result still, and the numbers, are in `play/a` and `play/b` (`play.json`).

| Path | Levels played | Scored by the bot | Stars kept after a reload |
|---|---|---|---|
| World Cup & Euro | 4 | 3 | ✓ (5) |
| Premier League | 4 | 3 | ✓ (4) |
| La Liga | 5 | 4 | ✓ (6) |
| Serie A | 5 | 5 | ✓ (13) |
| Bundesliga | 5 | 5 | ✓ (7) |
| Ligue 1 | 5 | 5 | ✓ (5) |
| Worldies 17/18 | 2 | 1 | ✓ (1) |
| Bangers | 5 | 4 | ✓ (5) |
| **All** | **35** | **30** | **8 of 8** |
(measured) Levels not played were still locked behind one the bot could not score. The 5 it could not score were the bot, not the game: it picked a white shirt instead of the ball (Lazio and Dortmund levels), or kept hitting the post / being claimed on a cross. No page errors in any run.

Speed at 4× slower (measured): a path opens in 0.9–3.2 s; a level's match is ready in 0.7–2.4 s (the first one in a path ~2 s, then under 1 s).

**Bugs found and fixed**
1. **After 6 shots at one goal the screen turned into a "FULL TIME · Training session · Total Cash" card** and the level could not be tried again (seen: `play` first run, Bundesliga level 1). The match under the page ends after 6 chances. Now it quietly starts again every 5 tries, on the same goal, without replaying the build-up (`TRIES_PER_MATCH`). Seen fixed: 0 FULL TIME cards in the 35 levels after (before: hit on the first hard level).
2. **Empty stars looked like stars won.** A miss showed ★★★ in bright white: the admin page's readability helper (the "ink guard", Harry's) turns faint words white, and the faint empty stars counted as words. Empty stars are now grey outlines ☆ (seen in the result stills, e.g. `play/b/pl-4-result.jpg`).

**Seen, not changed (not mine / not a bug)**
- Today's daily goal (Xhaka v Serbia, 27 m out): the camera starts with Xhaka almost off the left edge of the phone; only the ball shows (seen). The framing is the match camera (Harry's area).
- On a cross, a slow shot is "Claimed by the keeper before it can find its man" and the result reads "Saved · never reached the line" — correct, but a first-time player may not know they must strike as the ball arrives. The plan below adds a first-goal help.
- Daily-goal stars do not count towards a path's stars (by design).

## (b) Why tests/star/realGoals.mts fails on main
1 check of 70 fails: "no line in the game, tests, scripts or patch notes is sourced to [the deleted licensed data source]". The lines that name it are in **Harry's research patch notes 0.101h** (`lib/patchNotesData.ts` lines 1915, 1959, 1963 and `patch-notes/pages/0.101h/index.html` line 223: "several live numbers were tuned from [it]…"). Not Real Goals code and not Leo's notes, and patch notes are the hub's, so **not fixed**. Fix for Harry/hub: reword those three sentences without the name (e.g. "the licensed data removed on 19 Oct"), or let the check skip history in patch notes. Everything else passes (measured): the real line scores 100% on the featured goals, 93.3% on sampled league goals, 95.6% on the bangers; the no-lane fingerprint is unchanged (cedc67e1).

## (c) Plan for players
`PLAN-real-goals-for-players.md` (docs only): a "⚽ Real Goals" row on the title screen with the streak as its hint (recommended), a player page without the admin parts, behind a new Leo switch; needs Harry's yes on the one-engine guard's test-only entry for the real-goal extras, and a decision on real names on the Bangers. About a day of work after those two answers.

## (d) Clips with the game's sound (production build, real play)
| Clip | Length | Size | What |
|---|---|---|---|
| `film/rg-level-sound.mp4` | 19.7 s | 0.71 MB | Serie A path → level 3 (Duván Zapata v Chievo): the real build-up, the shot, GOAL, **100% ★★★**, Next level; the stage goes 6 → 9 stars. Levels 1–2 were marked won in the phone's save so level 3 is open. |
| `film/rg-daily-sound.mp4` | 15.5 s | 0.56 MB | The daily card (🔥 0 days) → play → GOAL 44% ★ → back home: "🔥 1 day · ✓ Beaten today". The phone's clock was set to 23 Nov (Daily #33, Sergi Roberto v PSG); today's goal (a 27 m shot) beat the bot in 12 tries. |
Both scored on the first try (no cuts). Sound: the game's own, recorded inside the page (`audio-tap.mjs` + `audio-pcm.mjs`); mean −34 dB, peaks −3.7 dB (measured). Six frames of each were looked at (seen).

## Checks
`npx tsc --noEmit` clean · `node scripts/one-engine-guard.mjs` passes · `tests/star/realGoals.mts` 1 failure (above, Harry's notes) · penalty/shootout tests 5/5 · `npm run build` passes (built at 13:19 UTC with the final page code; only scripts and docs changed after).

## Files
Changed: `app/star-real-goals-dev/page.tsx` (match restarts every 5 tries; outline empty stars). New: `scripts/film/scenes/rg-play.mjs` (play every path), `rg-sound.mjs` (clips with sound), `rg-lib.mjs` (ball finder: only white spots on grass, never the commentary words). Docs: this folder.
