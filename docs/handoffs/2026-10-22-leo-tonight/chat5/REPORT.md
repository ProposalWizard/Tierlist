# Chat 5 · Real Goals — report (22 Oct 2026)

Branch `leo-realgoals` (origin/Leo merged in). All four parts built, checked and pushed. Test pages only; the real game is unchanged.

## What was built

### A · League paths (plan part 7)
- The Real Goals page now opens on a **home**: the daily goal card, then **8 path tiles** with your stars on each.
- **World Cup & Euro**: the old level map, exactly (test: same 50 goals in the same order; stars still in `star-real-goals-progress-v2`).
- **Premier League, La Liga, Serie A, Bundesliga, Ligue 1 (2017/18)**: 5 stages × 10 from each league, easiest first. Stages: Matchday 1 → Autumn → Winter → The run-in → Title decider.
- **Worldies 17/18**: the 10 hardest goals of each league (struck with a foot from 18–35 m, a 6% chance or less, into a corner or high). Mean difficulty 4.53 against 2.06 for all 4,393 league goals. Stages: Long shots → Top bins → Screamers → Outrageous → Impossible. (Over 35 m was left out: mostly empty nets.)
- **Bangers**: all 61 (5 stages of 13: Classics → Golazos → Puskás shortlist → Goal of the season → Goal of the decade).
- Each path has its own stars and gates (6 / 15 / 26 / 38 of its own stars; Bangers 8 / 20 / 34 / 49). Stars on one path never open another.
- Files: `lib/star/realGoalPaths.ts` (new), `buildLevels` gained options in `lib/star/realGoals.ts` (default unchanged).

### B · Bangers (7a)
- **61 famous goals, 2010–2025**, written by us from public record: Premier League 15, Champions League 15, La Liga / Copa del Rey 7, Serie A 8, Bundesliga 4, Ligue 1 2, internationals 10.
- Each has scorer, sides, competition, date, minute, score before and final, keeper, body part, how it was struck, shot spot, where it went in, the 1–6 passes and runs before it, a match-report URL (`source`), what was checked (`checked`) and what is uncertain (`note`). Marked `src: "drafted"` and "drafted from public record". Names as labels only.
- 4 helpers checked every fact with web search. Web pages could not be opened (DNS), so facts come from search results; every URL came back from a real search. No BBC links came up.
- Swaps from the brief: Harry Kane from his own half v Darmstadt (Bundesliga slot), Ben Arfa at Saint-Étienne and Ibrahimović's backheel v Bastia (Ligue 1), Neymar v Villarreal, Yamal v Espanyol, Bellingham v Barcelona, Quagliarella v Napoli, Totti v Lazio, Leão's 6.76 s goal (La Liga / Serie A picks). Corrections found: Altıntop's goal was 3 Sep 2010; Dimarco's 12 Nov 2023; Zlatan's volley v Anderlecht was his third (36'); Bellingham v Slovakia was the Round of 16.
- Data: `data/realmoments/bangers.json`, built by `python3 -I scripts/realmoments/build_bangers.py` from `scripts/realmoments/bangers_drafts/*.json`. Same shapes as the Wyscout files; xG from the same model. Served as `/api/star/real-moments?file=bangers`. New "Bangers" chip in the All goals list.
- **Fix a banger (admin)**: bottom of the Real Goals page (`?fix=1` opens it). Drag the shot spot and the pass dots on a pitch, drag the end spot on the goal mouth, Play it, Download a corrected `bangers.json`. Fixes stay on the phone until downloaded and committed.
- Small fix found while checking: on a cross or header, the commentary named a test-club player ("Williams whips it across"). It now names the real last passer ("Nani whips it across"). Real Goals only (`dressFor`).

### C · Daily Real Goal (part 8, phone only, no leaderboard)
- One goal a UTC day, the same for everyone, from an **append-only list** of 121 goals (22 Oct 2026 → 20 Feb 2027): bangers, Worldies, World Cup / Euro favourites. Add new goals at the end only. After the end it goes round again.
- Score it (★+) to keep the streak: 🔥 days in a row and your best. A missed day shows 0 and the next goal starts again at 1. Kept in `localStorage` (`star-real-goals-daily-v1`).
- File: `lib/star/realGoalDaily.ts`.

### D · Shootout keeper reads your habits (part 6, test page only)
- New page **/star-shootout-dev** (registered: admin menu, test pages, guide, DevGate). A bar shows the keeper's read ("4 of your 4 kicks went left → he now leans left"), your kicks so far, an On/Off switch and Reset.
- The keeper learns your side (left / middle / right as you see it) and height. He needs 2 kicks; recent kicks count more; he leans only when 60%+ of your kicks went one way; at most he goes your usual way on 6 kicks in 10. A mixed-up taker gets no lean. Height is shown, not used by the dive yet.
- **With no history the keeper is exactly as before**: fingerprint of his settings, 400 decisions and 300 full kicks taken before the change; same after with no, empty, one-kick and mixed histories (`tests/star/penaltyKeeperHabits.mts`).

## Numbers (before → after)
| | Before | After |
|---|---|---|
| Real Goals paths | 1 (50 levels) | 8 (411 levels) |
| Playable goals | 4,625 | 4,686 (+61 bangers) |
| Bangers' real line scoring (aimed exactly, 3 seeds each) | – | 95.6% of 183 strikes |
| Keeper saves, same side 5 times (5th kick) | 22.8% | 34.8% with habits on |
| Keeper saves, same side 5 times (all kicks) | 23.2% | 28.3% |
| Keeper saves, mixed taker | 19.2% | 19.0% |
(Keeper rated 62, 600 shootouts of 5 kicks, real engine.)

## Seen in a browser (390 × 844)
- Home (daily card + tiles), Premier League, Worldies and Bangers paths, the daily goal playing, the fixer: `rg-*.jpg`.
- **Every banger's start picture**, all 61: `bangers-start-1..4.jpg`. Each shooter is on his real spot with the real keeper named in goal; walls on the free kicks; none looked broken. Two (Bale v Barcelona, Kvaratskhelia v Atalanta) have a placed defender tight on the shooter: the game's own placing rule.
- Shootout: 4 kicks left, the bar went 0% → 33% → 67% → 100%; the keeper dived the right way on kick 4 (`shootout-*.jpg`). No console errors.

## Not seen / known issues
- **Engine-adjacent change, said plainly:** `lib/star/keeperBrain.ts` (3 lines: the keeper's hop before a penalty uses the same rule, now through `sideWithHabit`, which is the old rule when there is no habit). `EnginePlay.tsx` passes a new optional `penaltyRead`. All 14 keeper / penalty / finishing / aiming / outcomes test files pass. The play screens' pitch width was not re-measured (nothing about the picture changed).
- On the shootout page you take all of your side's kicks and "Another shootout" keeps your kicks until Reset (in a real shootout you take one, so he would never learn). Both are settings only this page uses. Decision for Leo if he wants it different.
- Only high kicks were recorded in the shootout check (the test script lofted every kick); a low kick was not seen.
- Banger placements are estimates from descriptions (each `note` says what). The fixer is there to correct them by eye.
- The daily goal and paths were not played to a finish in the browser (accuracy and stars are the existing, tested code).
- `tests/star/realGoals.mts` section 1 fails on a line that was already failing before this chat: patch notes (`lib/patchNotesData.ts`, `patch-notes/pages/0.101h`, `0.107`) name the removed data source. Not in this chat's files.
- `npm run build` needed `NODE_OPTIONS=--max-old-space-size=8192` in this sandbox (out of memory with the default); then it passed.

## Checks
`npx tsc --noEmit` clean · `node scripts/one-engine-guard.mjs` passes · `node scripts/run-star-tests.mjs finishing keeper aiming outcomes penalty Habits` 14/14 · `tests/star/realGoals.mts` all new sections pass · `npm run build` passes.

## Quality pass (after the hub's check, ~19:45–21:30 UK)

**1. Played like a player** (a helper drove a production build at 390 × 844; stills `play-*.jpg`):
- All 8 paths opened; 2 goals played on 6 of them (World Cup, Premier League, La Liga, Serie A, Ligue 1, Bangers) to a result box with % and stars, and "Next level →" after a star. Bundesliga and Worldies: one goal each, no goal scored (the driver aims blind; Worldies are 30-40 m shots). Best accuracy seen: 92% (Serie A).
- Daily goal: Rooney's overhead kick (Daily #1). Scored on try 2; back home the card read "🔥 1 day · best 1 · ✓ Beaten today". Works.
- Bangers played: Rooney, Messi's free kick, Adam from his own half, Schick from halfway, Mkhitaryan, Sergi Roberto: start pictures clean, ghost line to the goal.
- No horizontal overflow at 390 px on any path; no stuck "Loading…"; no page errors (only the expected 500s for real squads, as this sandbox has no database).
- **Fixed:** the shootout page showed a "FULL TIME 5–0 · Total Cash" card after a few kicks. Every kick is one chance of the match underneath, and that match ends after a handful of chances. The match now starts again every 3 kicks, after the kick's result has shown (`ShootoutPlay.tsx`; this also helps the shootout on the Highlights test page in sudden death). Re-played: 6 kicks over two shootouts, no FULL TIME card. Bar: 1 kick "needs 2" 0% → 2 right 33% → 4 right 100% → then 2 left "mixed → he can't read you" 0%; the Off switch reads "he only reads this kick" (`v2-shootout-*.jpg`).
- Seen, left as they are (all from before tonight, not this chat's code): Messi's free-kick wall stands bunched (the game's free-kick wall rule); a saved shot that a team-mate scores on the rebound counts "No goal" for you (by design: you must score it); the 2D view leaves the bottom of the pitch empty on close chances (the existing framing); World Cup / league goals' real spot is the middle of Wyscout's 3 × 3 goal-mouth zone (a known limit, in the data README).

**2. Bangers, second fact-check** (two helpers, fresh web searches on all 61): 22 goals corrected, 39 confirmed. Main fixes:
- Wilshere v Norwich: right foot (was left), bottom-left corner, the real order of the one-twos (Arsenal.com).
- Messi v Athletic 2015: keeper Herrerín (was Iraizoz). Higuaín v Frosinone: keeper Zappino (was Leali), struck from 20 yards.
- Messi v Betis 2019: the one-two was with Rakitić (was Suárez). Yamal v Espanyol: a solo run (no assist; the Olmo pass removed).
- Rooney v Man City: struck from the penalty spot. Van Persie v Villa: just outside the box. Garnacho, Bale v Liverpool: ~15 yards.
- Son v Burnley: 71.4 m in 11 s (the Premier League's figure). Messi v Real Madrid 2011: the one-two with Busquets. Mkhitaryan: Pogba's pass to Zlatan added.
- Bale v Barcelona: inside the near post. Kvaratskhelia: 12 yards, not a tight angle. Quagliarella: top corner. Altıntop: 25 m. Ben Arfa: Koziello's assist added.
- Still open (each in its `note`): which corner for 15 goals no source names; Messi v Real Madrid 2017 (sources split bottom left / right); Bellingham v Barcelona (top left / right).
- Stills of the 16 moved ones: `bangers-start-corrected.jpg` (all clean). Bangers test still all green (real line 95.6%).

**3. Load speed** (production build, 6× slower CPU, 390 × 844, `scripts/star-sandbox/real-goals-loadtime.mjs`):
| | Before | After |
|---|---|---|
| Home (tiles + daily card) ready | 4.8–5.2 s | 3.4–4.2 s |
| Data before the home shows | 6.3 MB (all 5 leagues) | 1.4 MB (World Cup + Bangers) |
| A league path opened directly | 7.0–9.5 s | 6.0–7.5 s (loads only its own league) |
The five league files (3.7 MB) now load only for a league path (its own file), Worldies, the All goals list, or a daily goal from a league. Any path view takes about 2 s longer than the home at 6× (1.0 s against 0.6 s at full speed); it is the same level-map screen as before tonight.

**4. Home under 1 s** (hub ask, ~22:00 UK). The home now draws from a 28 KB index shipped with the page (`data/realmoments/rg_index.json`: each path's levels and stars, each daily goal's card), built by `npx tsx scripts/realmoments/build_rg_index.mts` (`--check` fails if it drifts from the data). The tiles and the daily card are in the server's first HTML. No data file loads for the home; a path loads only its own file; the daily goal's file loads when you press Play (the button reads "Loading the goal…" meanwhile); the match engine and the fixer load only when used.
| 6× slower CPU, production build | Before tonight's fixes | After the first fix | Now |
|---|---|---|---|
| Home tiles on screen (first paint) | 4.8–5.2 s | 3.4–4.2 s | **0.39–0.55 s** |
| Home tappable (scripts ready) | ~5 s | ~4 s | 1.9–2.8 s |
| Data before the home | 6.3 MB | 1.4 MB | 0 (the index is in the page) |
| Page first download | 1.15 MB | 1.15 MB | 811 KB |
Not re-played after this last change beyond the load measure (tiles, daily card); the path and goal screens are the same code as the playthrough above.

## Files touched
New: `lib/star/realGoalPaths.ts`, `lib/star/realGoalDaily.ts`, `app/star-real-goals-dev/BangerFixer.tsx`, `data/realmoments/bangers.json`, `scripts/realmoments/build_bangers.py`, `scripts/realmoments/bangers_drafts/*.json`, `app/star-shootout-dev/{page,layout}.tsx`, `tests/star/penaltyKeeperHabits.mts`, `scripts/star-sandbox/banger-stills.mjs`.
New (late): `lib/star/realGoalIndex.ts`, `data/realmoments/rg_index.json`, `scripts/realmoments/build_rg_index.mts`, `scripts/star-sandbox/real-goals-loadtime.mjs`.
Changed: `lib/star/realGoals.ts` (buildLevels options, banger kits, badges, crosser name, isTournament skips bangers), `lib/star/realMoments/{types,index}.ts` ("drafted" source), `app/api/star/real-moments/route.ts` (bangers), `app/star-real-goals-dev/{page.tsx,real-goals.css}`, `tests/star/realGoals.mts`, `lib/star/penaltyKeeper.ts`, `lib/star/keeperBrain.ts`, `components/star/{ShootoutPlay,EnginePlay}.tsx` (ShootoutPlay also: the match restarts every 3 kicks), `lib/adminRegistry.ts`, `lib/adminGuides.ts`.
