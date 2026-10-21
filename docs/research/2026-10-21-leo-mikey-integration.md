# Leo and Mikey on main: what is wired into Harry's systems (21 Oct 2026)

Read-only audit. Branch Harry, merged with main (origin/main 6e2fb5c5). No code changed.
Tags: [code] = read in the code, [measured] = counted with a small read-only script, [reasoned] = worked out, not seen running.
I could not run the test suite: `tsx` is not installed in this sandbox [measured: no node_modules/tsx], so every "tests pass" line below is the commit message's claim, not mine.

---

## Plain English summary

**Leo's 4,393 league goals are in the repo and on one page only. They do not reach anything else.**

| Where | Do the 4,393 goals reach it? |
|---|---|
| Real Goals test page (/star-real-goals-dev) | **Yes.** In the "All 4,625 goals" list only. Not in the level map. [code] |
| Real moments page (/star-real-moments-dev) | **No.** It reads only the tracked file and the World Cup/Euro shot file. [code] |
| Real shots page | **No.** Same two files. [code] |
| Real moment highlights (Settings, Full highlights rebuild, Real moment highlights) | **No.** The pool is only "fully real" tracked shots (DFL, SkillCorner, SoccerTrack). League goals are Wyscout, and Wyscout is excluded by one line: `isFullyReal = src !== "wyscout"`. [code] Zero of 4,393 can be served. [measured] |
| Highlights in the real match and Infinite Highlights | **No**, for the same reason. They get real moments only through `chanceMaker.ts` step 1b, which uses that pool. [code] |
| Match radar | **No.** The radar draws the unseen match's own minutes. It reads no real data. [code] |
| Simulation formula (hiddenMatch, chance mix, conversion, tuning.ts, scenarioRules, kindRules) | **No.** None of these files read Wyscout, data/opendata or data/realmoments. [code, grep] |

What could be served, if you wanted it: of the 4,393 goals, 2,166 are open-play, within 35 m, and of a kind the highlights serve (one-on-one, tight angle, long range). [measured] The real-moment pool today is about 660 shots before its checks (260 one-on-one, 140 tight angle, 261 long range) and only 93 of them are goals. [measured] So the league data would be 3 to 4 times bigger, but every one is a goal, so it would skew the chance mix toward goals. [reasoned]

**Is it in the admin menu?** Yes. Real Goals has a registry entry, a PageGuide eye, and the guide text was updated for the league goals. [code] Two small faults: the menu blurb still says "Recreate real WC/Euro goals", and the page is not in the Real moments or Real shots pages at all.

**The bigger find, not asked for:** several numbers in the live simulation were tuned from StatsBomb data. Harry deleted that data on 19 Oct because its licence forbids commercial use "or any analysis derived from" it (`data/opendata/LICENCES.md` line 162). The numbers stayed in the code: the deep-touch rate and the "real" chance mix (Mikey's Kane count), the keeper's far-corner and top-corner save rates, and the shot model's rates. [code] Whether that matters is a licensing call for Harry, not for me. Wyscout (CC BY 4.0, already in the repo) could replace them.

**Everything else from Leo and Mikey this week** is mostly well wired: every dev page I checked is in the admin menu and has a PageGuide. The gaps are small: the world season has no admin page, the career soak is not in the build, and `star_xp_config.sql` is not run. Mikey's corner rule touches two drift files. Seven star tests fail according to Mikey's own handoff.

---

## 1. Leo's Real Goals (796a2b76, c74e769c, patch notes Leo v0.19, site 0.61)

### Where the data lives [code]
- `data/realmoments/wyscout_league_{england,spain,italy,germany,france}.json`. Each file has `shots` (the goal shot rows) and `goals` (match facts and the whole move). 931 + 911 + 889 + 763 + 899 = 4,393 goals. [measured]
- Made by `scripts/realmoments/extract_wyscout_leagues.py`. It keeps goals only, so the leagues' other ~43,000 shots are not in the repo.
- Served by `/api/star/real-moments?file=league-<x>` (`app/api/star/real-moments/route.ts`).
- Credit lines: `lib/star/dataCredits.ts` ("wyscout-moments", CC BY 4.0). OK.

### Everything that imports or fetches it [code, grep]
- `lib/star/realGoals.ts` defines `LEAGUES` and `LeagueFile` and the club kits (`CLUB_KITS_1718`).
- `app/star-real-goals-dev/page.tsx` loads all five at page load (line ~413). They fill the goal list and the competition chips. The level map (`buildLevels`) stays on the 232 World Cup and Euro goals.
- `lib/star/realMoments/index.ts` only names the file types.
- Nothing else. No import from `chanceMaker`, `hiddenMatch`, `fhr/*`, `CanvasMatch` or the radar. `CanvasMatch` and `canvasEngine` only carry the test-only `realGoal` prop and `Scenario.realLane`, which the one-engine guard lists as TEST_ONLY.

### a) Real moments and real-moment highlights
- `loadRealMomentPool()` fetches only `tracked` and `tracks` (+ picks). [code, `realMomentHighlights.ts` ~147-160]
- `servedKindOf` returns null unless `isFullyReal(m)`. League goals have `src: "wyscout"`, so they can never pass. [code]
- `picks.json` is empty (`"picks": {}`), so no manual "Use in game" mark exists that could let one in. [measured]
- The Real moments page lists "Fully real shots" and the Wyscout World Cup/Euro shots. It does not list league goals.
- Result: 0 of 4,393 reachable. [measured]

### b) Highlights in the real match and Infinite Highlights
- Both get real moments through `chanceMaker.makeChance` step 1b, which calls `serveRealMoment` (1 in 4 open-play one-on-one, tight angle and long range chances, only when Settings, Full highlights rebuild: On and Real moment highlights: On; default Off). [code]
- So the answer is the same as (a): the league goals contribute nothing. What they do reach is the Real Goals test page, where a person plays them.

### c) Match radar
- `components/star/MatchRadar.tsx` and `lib/star/matchRadar.ts` draw `hiddenMatch`'s `radarTrace`. No real data is read. [code]
- The only Wyscout tie-in is indirect: `lib/star/fhr/patterns.json` (build-up patterns) was made from `data/opendata/wyscout_*.json` (1,941 matches, which include these same league matches) by `scripts/fhr/make-patterns.mts`. That feeds the build-up before a chance, not the radar. [code]

### d) Simulation formula
- `grep -i "wyscout|opendata|realMoments"` over `hiddenMatch.ts`, `chanceMaker.ts`, `tuning.ts`, `scenarioRules.ts`, `kindRules/`, `authoredChance.ts`: no hits except the real-moment serving call in `chanceMaker.ts`. [code]
- The only code that reads `data/opendata` is `scripts/fhr/make-patterns.mts` (build-up). `wyscout_chances.json` (shots by distance, body part and situation), `wyscout_match_flow.json` and `wyscout_set_pieces.json` are not read by any sim number. [code]
- The xG model in the goal files (fitted on 45,287 Wyscout shots; weights in `wyscout_shots.json` meta) is used only to rank Real Goals difficulty and to label cards. [code: `difficultyOf` in `realGoals.ts`]
- Note: the goal files cannot give conversion rates, because they hold goals only. A conversion or chance-mix check needs `wyscout_chances.json`, which already exists.

### e) Admin
- `lib/adminRegistry.ts` line 140: "/star-real-goals-dev", group rbd/data, owner Leo, access "admin". In TEST_PAGES. [code]
- `app/star-real-goals-dev/page.tsx` renders `<PageGuide page="/star-real-goals-dev">`. The guide in `lib/adminGuides.ts` (~348-370) names the league goals, the chips, the files and the extractor. [code]
- Faults: (1) the registry blurb is stale ("Recreate real WC/Euro goals"); (2) the page-preview image (`lib/adminPreviews.ts`) is from before; (3) the Real moments page and its "Commit marks" flow do not know about league goals.

---

## 2. Everything else Leo and Mikey shipped to main in the last ~8 days

All commits are authored "Claude", so I used the patch notes (Leo v0.16 to v0.19, Mikey v0.17 to v0.19) and the commit subjects. Every commit below is an ancestor of origin/main. [measured: `git merge-base --is-ancestor`]

I ran a script over every `app/star-*-dev` and `app/admin/*` folder: each has a registry entry, a guide entry and a PageGuide use, except `/admin/home` (no guide entry) and the `/admin` index. [measured]

| Feature | Who, when | Admin or dev page | In admin menu | PageGuide | Wired into Harry's systems |
|---|---|---|---|---|---|
| Real Goals league goals | Leo v0.19, 20 Oct | /star-real-goals-dev | yes (stale blurb) | yes | patch notes archive yes (0.61); not in real moments, highlights, radar, sim |
| Real Goals mode (WC/Euro, ghost, stars) | Leo v0.17, 18 Oct | same page | yes | yes | one-engine: `realGoal` prop is in the guard's TEST_ONLY list [code per adminGuides]. Its StatsBomb 908-goal version (v0.18) was deleted 19 Oct; patch notes 0.60 still describe it [code] |
| Visual Effects Lab | Leo v0.17, 15 Oct | /star-vfx-lab-dev | yes | yes | test page; effects tried in the real match |
| Sound Lab | Leo v0.16, 14 Oct | /star-sound-lab-dev | yes | yes | separate from /admin/sound-board; both exist |
| Keeper realism (Henry finish, top corners), hitboxes and jumping | Leo v0.16, 14 Oct | panels on Infinite Highlights / Infinite Match | n/a | in those guides | dials are in tuning.ts "Keepers (new)" so the tuner sees them. The keeper numbers cite StatsBomb (see gap 4) |
| Settings, Updates tab (every New/Old switch) | Leo v0.16 | Settings | n/a | n/a | lists Mikey's pop-ups row too [code `UpdatesPanel.tsx`] |
| Arcade texture pack, Harry changes dropdown | Leo v0.16 | Settings | n/a | n/a | in patch notes 0.55 |
| Nation kits, all 211 nations | Leo, 16 Oct | /admin/clubs, International section | yes | yes | CLAUDE.md section; `international.ts` uses it |
| Transfer window rebuild + world ageing (patch notes titled Mikey v0.17) | Leo's branch, 18 Oct | in the career (TransferHub); tests `transferInterest`, `worldAgeing` | no page | n/a | CLAUDE.md; patch notes 0.59 |
| Admin room, team board, Videos tab and screen recorder | Leo, 18 Oct | /admin/home, /admin/team, /admin/videos | yes | `/admin/home` has no guide entry [measured] | team jobs by push, as CLAUDE.md says; patch notes 0.57 |
| World season (every league, cup and European competition played) | Mikey v0.18, 19 Oct | **none**: only the in-game World pane (`WorldPane.tsx`) | no | no | docs/WORLD_SEASON.md, tests `world.mts`; not in the tuner [code] |
| FA Cup, ten rounds | Mikey v0.19, 19 Oct | none (in-game) | no | no | tests `faCupRounds.mts`; patch notes 0.63 |
| Mikey's new pop-ups | Mikey v0.19, 20 Oct | Settings → Match toggle, default Old | in Updates tab | none (no page) | listed in `lookRows.ts` and `gameVersions.mts`. No test of its own. The Oswald font has its licence file [code]. It is a New/Old toggle added after Harry's 12 Oct "decide, don't toggle" ruling; Mikey asked for it by name, so Harry may want to rule |
| Corner taker rule (`cornerReach.ts`) | Mikey, 20 Oct | none | no | no | test `cornerReach.mts` yes. No tuning.ts entry, no tuner dial. See drift note below |
| Your player shown on every chance (`youSpot.ts`) | Mikey, 20 Oct | none | no | no | test `youSpot.mts`; CLAUDE.md says "to be agreed with Harry" |
| Team-mate goals kept on reload (`realSquad.ts`) | Mikey, 20 Oct | none | no | no | test `squadReload.mts` |
| PL Draft FC 27 offered 177 clubs, now the game's 20; player search per spelling | Mikey, 20 Oct | /api routes only | n/a | n/a | **no test** for either route [measured: no matching file in tests] |
| Career soak (`scripts/soak/careerSoak.mts`) | Mikey, 20 Oct | none | no | no | not in `package.json`, not in the build, not run by `test:star`. CLAUDE.md line 207 says to run it by hand [code] |
| `star_xp_config.sql` + /admin/star-xp (Career XP book) | Mikey | /admin/star-xp | yes | yes | **migration PENDING** (CLAUDE.md migration table, "seen missing 20 Oct"). Until run, saves stay on the device and the game uses built-in amounts |
| Team room "ideas from Claude" route | Mikey, 19 Oct | none | none | none | **reverted** the same day (e3e385d9). No leftover route or migration found [measured] |
| Broadcast look on ~40 admin pages, admin look guard, scene editor | Mikey, 19 Oct | /star-scene-editor-dev etc. | yes | yes | `admin-look-guard.mjs` runs inside `npm run build` [code, package.json] |
| FHR phase 2 build-ups, Wyscout/DFL/SkillCorner data, Real moment highlights | Harry's branch, merged to main | /star-fhr-dev, /star-real-moments-dev | yes | yes | this is Harry's side |

Drift note on the corner rule [code]: `06d711a3` edits `lib/star/hiddenMatch.ts` (new `canTakeCorners` input and an early return in the corner check) and `CanvasMatch.tsx` (passes the input). `18ab5d6d` adds a 24-line read-only `airCarry` to `canvasEngine.ts` so the one-engine guard passes. Both drift files are on the engine-warn list, and `canvasEngine.ts` is the engine. I cannot tell from git whether the red warning fired or the match tests were run. The commit message says "measured with the match's own ball physics", not that the match tests ran. [reasoned] The radar, sim90 and the ruler build their own inputs without `canTakeCorners`, and "absent = no limit", so they still give you every corner. [reasoned]

Tests that fail on main today, from Mikey's handoff (20 Oct), **not re-run by me**: keeperPro, keeperBrain, longRangeRules, chanceJudge, chanceMaker, match2dCam, wembley3d. These guard the sim formula, so someone should run `node scripts/run-star-tests.mjs` and sort out which are old and which are from this week.

---

## 3. Gap list

| # | Gap | Size | Files | Touches canvasEngine or drift files? |
|---|---|---|---|---|
| 1 | League goals not on the Real moments or Real shots pages (no way to browse, mark or filter them outside the Real Goals list) | small to medium | `app/star-real-moments-dev/page.tsx`, `lib/star/realMoments/index.ts` (`fetchRealFile` already knows `league-*`) | no |
| 2 | League goals cannot be served as highlights. Needs a `serveRealGoal` like `serveRealMoment`, a placed-defenders path (`scenarioForShot` already does this for Real shots), pick marks for `wy…` ids, and a decision on the goals-only skew | medium | `lib/star/fhr/realMomentHighlights.ts`, `lib/star/chanceMaker.ts` step 1b, `lib/star/realMoments/picks.ts`, the Real moments page, `tests/star/realMomentHighlights.mts` | `chanceMaker.ts` decides what the screen hands the engine; engine-warn has no entry for it but I would treat it as a drift file. `canvasEngine.ts` and `CanvasMatch.tsx` not needed |
| 3 | Nothing in the sim or radar comes from Wyscout. `wyscout_chances.json` and `wyscout_match_flow.json` could check or set conversion by distance and the chance mix. The cheap, safe step is a read-only "real-world" column in the FHR ruler | small (ruler column) to large (changing sim numbers) | `lib/star/fhr/ruler.ts`, `scripts/fhr/ruler.mts`, `lib/star/tuning.ts`; changing numbers touches `hiddenMatch.ts` | the ruler column: no. Changing numbers: yes, `hiddenMatch.ts` (drift) |
| 4 | StatsBomb-derived constants still in the live sim: `DEEP_TOUCH` (`hiddenMatch.ts` ~690), `REAL_MIX` (`kindMix.ts` ~43), shot rates (`shotModel.ts` ~60, ~131), keeper far/top-corner rates (`keeperBrain.ts` ~1162, ~1356, ~1403), `chanceFormula.ts` ~40. LICENCES.md says StatsBomb forbids commercial use of derived analysis. A decision for Harry, then a re-derivation from Wyscout | medium to large | `hiddenMatch.ts`, `kindMix.ts`, `shotModel.ts`, `keeperBrain.ts`, `chanceFormula.ts` | yes: `hiddenMatch.ts` is a drift file; `keeperBrain.ts` feeds the engine's keeper |
| 5 | Registry blurb for Real Goals is stale; Real moments blurb still says "(DFL, SkillCorner, Wyscout)" | small | `lib/adminRegistry.ts`, `lib/adminPreviews.ts` | no |
| 6 | Patch notes 0.58 and 0.60 (Leo v0.17 and v0.18) describe StatsBomb goals that were deleted on 19 Oct | small | `lib/patchNotesData.ts` (add a note, don't rewrite history) | no |
| 7 | `star_xp_config.sql` not run, so the Career XP book saves on one device only | small (Mikey runs the SQL) | `supabase/migrations/star_xp_config.sql` | no |
| 8 | World season, FA Cup rounds and transfer window have no admin or test page and no PageGuide. The only check is the soak script and unit tests | medium | new `app/star-world-dev`, `lib/adminRegistry.ts`, `lib/adminGuides.ts` | no |
| 9 | Career soak is manual only | small | `package.json` script, or add to the build checks | no |
| 10 | Corner rule has no tuning entry or tuner dial; its effect is invisible in the radar, sim90 and the ruler | small | `lib/star/cornerReach.ts`, `lib/star/tuning.ts`, ruler inputs | the inputs in `hiddenMatch.ts` are already edited; passing the flag from the ruler needs no new engine edit |
| 11 | The 7 failing star tests (per Mikey's handoff) | medium to find, unknown to fix | `tests/star/{keeperPro,keeperBrain,longRangeRules,chanceJudge,chanceMaker,match2dCam,wembley3d}.mts` | the fixes probably touch `keeperBrain.ts`, `chanceMaker.ts` |
| 12 | PL Draft clubs route and player search have no tests | small | `app/api/draft/clubs/route.ts`, `app/api/star/player-search/route.ts` | no |
| 13 | Mikey's pop-ups are a New/Old toggle after the "decide, don't toggle" ruling, with no test of their own and no PageGuide | small, but Harry's call | `lib/star/lookRows.ts`, `components/star/MikeyPopup.tsx` | `CanvasMatch.tsx` (drift) already edited |

### Suggested order (my view, not a decision)
1. Gap 4 first, because it is a licensing question and it is cheap to ask.
2. Gap 11, so there is a trustworthy test run before anyone changes sim numbers.
3. Gaps 5, 6, 7, 9 (all small).
4. Gap 1, then 2 if Harry wants the league goals in the game's highlights.
5. Gap 3 as a ruler column before touching any sim number.

### Not checked
- Whether the engine-warn hook fired for Mikey's corner edit.
- Whether any of this runs correctly in a browser (I saw no screens).
- The star test suite (no `tsx`).
- The exact size of the real-moment pool after `autoCheck` (I counted before the checks).
