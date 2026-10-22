# Chat 6 · End of season — report (22 Oct 2026)

Branch `leo-season-end`. Nothing merged to main or Leo. No patch notes (the hub writes them).

## What was built

| Part | What the player gets | Seen |
|---|---|---|
| A · Your season video | At the season end, before the Ballon d'Or: a title card in club colours, every goal of the season in order with a counter and caption, "Goal of the season" (live, then slow from behind the net), and an end card (goals, assists, average rating, apps, trophies) counting up. Music from the game's own tracks under the crowd. Save video in one tap. Skip always on screen. | Real career, 390 wide (playtest) + test page |
| B · Career goals | Stats → new "⚽ Goals" chip: every goal (minute, opponent, home/away, competition, season, score), a still from the video if this phone has it, else a small pitch with the strike spot. Tap to play or see the facts. Best 10 kept in the Hall of Fame ("⚽ Best goals"). | Real career + test page |
| C · Season awards night | After the rollover: a 3D night in a small function room (round tables, low stage, one lectern, a screen naming the award). Five awards in turn: Golden Boot, Assist King, Golden Glove, Young Player, Player of the Season. The host calls it, 3 nominees, the winner walks up from his table and lifts the cup; you, in your kit and face, when you win. Tap = next award, Skip all. Then the old awards page as before. A drawn room when 3D can't run. | Real career (3D) + test page |
| D · Injuries plan | `docs/plans/2026-10-22-injuries-revamp-for-mikey.md`: kinds and weeks, risk by energy, going down in the match, rehab choice, coming back short of fitness, feed posts, file list, 10 questions with letters. No code. | — |
| Under it | `career.goalLog`: one small row per goal of yours (about 120 bytes), written for every match you play. The season's recordings are kept from the newest-80 prune until its reel is made or skipped; the career's best 10 are always kept. | Playtest: 6 → 8 rows after 2 sim goals |
| Bug-hunt find | A refresh on the awards screen landed on Home and skipped a forced contract renewal. Now a refresh on the reel or the awards night lands back on it. | Refresh playtest: see below |

## Numbers

| | Before | After |
|---|---|---|
| Goals kept in the save | 0 (numbers only) | every goal, max 1,200 rows |
| Reel, 20 goals with videos | — | 72 s; no videos 66 s; no goals 9.6 s; 40 goals 84–88 s (16 full + 24 quick-fire) |
| Reel sound (20 goals, measured) | — | music −18.3 dB on the title, −15.5 dB on the end card; crowd 7.8 dB above the music at each goal (lowest 5.6); peak −1.6 dBFS |
| Saved reel file (20 goals) | — | 11.9 MB, made in 23 s (headless Chrome, WebM; MP4 on iPhone not measured) |
| Awards night | — | 5 awards × ~8.2 s ≈ 44 s, each skippable |
| Goals list, 600 goals | — | ready in ~0.3 s |
| Season label, first season | "2027/28" (wrong) | "2026/27" (matches the game's calendar) |

## Checks

- `npx tsc --noEmit` clean. `npm run build` passes (needs `NODE_OPTIONS=--max-old-space-size=6144` here; the default heap ran out once).
- `node scripts/one-engine-guard.mjs` passes.
- `node scripts/run-star-tests.mjs finishing keeper aiming outcomes career`: 12 of 12 pass. New: `goalLog`, `seasonReel`, `awardsNight` pass; `ballonDorNight`, `hallOfFame` still pass.
- No match-engine file was touched. The engine warning did not fire.

## What was seen in a browser (playtest, real career, Braintree Town)

Stills in this folder, `play-*.jpg`:
- Reel title, a goal card, Goal of the season, end card; Skip landed on the Ballon d'Or; `reelDoneSeason` was set afterwards.
- Awards night in 3D after the transfer window; Skip all → awards page → Continue → season review → dashboard.
- Stats → Goals in season 2 listed season 1's goals.
- No page errors from the new screens (only sandbox network errors: no real Supabase key here).

Test-page stills: `reel-*.jpg` (with recordings, `reel-none-*` without, `reel-zero-*` no goals, `reel-montage.jpg`, `reel-saved-file-frame.jpg` = a frame of the saved file), `awards-*.jpg` (3D and drawn), `gallery-*.jpg`.

## Not seen / not done

- Reel with real recordings inside a real career (only on the test page, with made recordings). Sound not heard by ear (measured only). Save as MP4 on an iPhone not tried.
- Awards night frame rate and load time on a real phone not measured.
- The reel starts from the dashboard's "End of Season" button, the same way the Ballon d'Or did before (not straight after the last match).

## Known issues

- **For Harry (one-engine rule):** the reel screen draws recorded goals on a canvas every frame, like a video player. It runs no ball physics (it plays back recordings with the goal videos' own drawing code). The drawing call lives in `lib/star/goalClip/reelRender.ts` (`paintReelOn`), so the guard's canvas check does not list it. I did not add it to `KNOWN_CANVASES`. Harry may want to say whether that is fine.
- **Same season-label slip elsewhere (not my files):** `lib/star/careerOverview.ts` `longSeason`/`shortSeason`, `hallRecords.ts` and `farewell.ts` use `startYear + season − 1`, so the Career Overview, Hall records and farewell probably say "2027/28" for a first season. Sent to the hub.
- Awards night: the host shot crops the back-wall screen; on the trophy lift his head tilts down a little; on the drawn fallback the tables show through the nominee cards.
- Reel: lifted TV shots can leave the goal near the left edge; in the quick-fire run the music leads the crowd; past ~60 goals the reel goes over 95 s.
- The goal list starts tonight: goals from older saves were never kept and can't be shown.
- A goal for your country is filed with your club name in `club` (the competition says which).

## Files

New: `lib/star/goalLog.ts`, `lib/star/goalClip/reel.ts`, `reelRender.ts`, `reelAudio.ts`, `reelEncode.ts`, `components/star/SeasonReel.tsx`, `components/star/CareerGoalsGallery.tsx`, `lib/star/awardsNight.ts`, `awardsNight3d.ts`, `awardsNightScreen.ts`, `components/star/SeasonAwardsNight.tsx`, test pages `app/star-season-reel-dev`, `app/star-goals-gallery-dev`, `app/star-awards-night-dev`, tests `tests/star/{goalLog,seasonReel,awardsNight}.mts`, `docs/plans/2026-10-22-injuries-revamp-for-mikey.md`.

Small additions: `app/star-dev/page.tsx` (season-reel phase, two lazy screens, awards night in place of the awards screen, resume on refresh, clips kept from the prune), `lib/star/types.ts` (`goalLog`, `reelDoneSeason`, phase `season-reel`), `lib/star/careerFlow.ts` (one line: log your goals), `lib/star/storage.ts` (two resumable phases), `lib/star/seasonAwards.ts` (top 3 nominees per award), `lib/star/hallOfFame.ts` (keeps the best 10 goals), `components/star/StatsTabs.tsx` (Goals chip), `components/star/HallOfFame.tsx` (Best goals), `lib/adminGuides.ts`, `lib/adminRegistry.ts`, `docs/3D_HANDBOOK.md`.
