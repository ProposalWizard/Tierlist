# Chat 7 · Bug hunt — report (22 Oct 2026)

Checks before the final push: `npx tsc --noEmit` clean · one-engine guard and `npm run build` BUILD_RESULT · soak all held.

Branch `leo-bughunt` (main merged in at the start). Plain English first; file names at the end of each line for checking.

## In one look
- **Played:** 3 careers in a real headless browser at phone size (390 × 844). One went to retirement and the Hall of Fame. The 20-season soak ran twice: 420 seasons, 20,672 matches, all rules held both times.
- **Tests:** before 408 of 414 passing; after 414 of 417 on this branch (3 new test files). 3 stale tests fixed. 3 left are in Harry's match/chance area, so they are team jobs. Merging tonight's newer main in at the end brought 2 new failures from Harry's build-up work (a 6th team job).
- **Refresh safety:** every refresh landed on Home. Cause found and fixed. Ballon d'Or night, the window list, the talks and "Deal agreed" now come back where you were (seen in the browser).
- **Fixed tonight:** 17 bugs plus 3 stale tests (list below). **Team jobs:** 6 (in `team/jobs.json`).
- **Not real squads:** this sandbox could not reach the database (`cagkgfketucousksgtbk.supabase.co` blocked by the network rules), so every club used invented players and badges showed initials. Bugs that need real squads were not looked for.

## Bugs fixed (each tested; ✅ = seen in a browser after the fix)
| # | Where | What you saw | Fix | Still |
|---|---|---|---|---|
| 1 | Refresh anywhere | Every refresh landed on Home: the saved "resume here" screen was wiped at start-up before it was read | The save of the screen waits until the load has decided the screen (`app/star-dev/page.tsx` init + `loadCareerIntoState` wrapper). Also fixes a slot switch writing the old slot's screen into the new slot ✅ | save-ballondor.jpg → save-fixed-ballondor.jpg |
| 2 | Refresh after "Deal agreed" | The agreed transfer was lost: Home, still at the old club, window gone | Refresh goes back to the window list (talks again) ✅ | save-signing.jpg → save-fixed-signing.jpg |
| 3 | Signing news after a summer move | "…has joined Brackley and wants to take charge of the National League", age 16 (really National League North, age 17) | The card reads the new league and next season's age (`lib/star/breakingNews.ts`) | career2-signing-news-wrong-league-age.jpg |
| 4 | Contract talks (transfer) | Header "Their wage offer ★28", card "★21" | Header shows their real offer, follows their counters (`NegotiationScreen.tsx`) ✅ | career2-negotiation-header-wage-mismatch.jpg |
| 5 | Transfer list | 4 NL North clubs all "Finished 24th" | Clubs up from Step 3 say "Promoted" (`transferInterest.ts`) | — |
| 6 | Line-up screen | ⏩ and ⚙ floated over the away crest and cut off "PLAY AS ST" | Both moved into the header's top-right corner (`LineupIntro.tsx`, `VersusScreen.tsx`) ✅ | career3-prematch-buttons-overlap.jpg |
| 7 | Badges, offline | A failed badge read was retried by every badge on every redraw (~2,000 failed reads in one session) | One read at a time; a failed read waits 30 s (`lib/star/clubLogos.ts`) | — |
| 8 | Career overview, Hall of Fame, farewell | First season labelled 2027/28; the calendar and Home say 2026/27 | One label helper on the calendar's year; old Hall cards read right too (`careerOverview.ts`, `hallRecords.ts`, `farewell.ts`, `HallOfFame.tsx`; test `seasonLabels.mts`) | — |
| 9 | Welcome tour on Home | Replayed on every Home visit for 20 seasons; covered ⚙ and "End of Season" | The last step counts as done the moment you press it, or when it leaves the screen (`PointerTour.tsx`) ✅ | career1-tutorial-replays-blocks-end-of-season.jpg |
| 10 | Welcome tip | "You've got a game today" with the match 2 days away | Says today / tomorrow / in N days (`tours.ts`; test `welcomeTour.mts`) ✅ | — |
| 11 | Manager after promotion | Manager sacked "after a season below what the board wanted" the summer his club went up | A manager who just won promotion is never sacked (`manager.ts sackCheck`, `careerFlow.ts`) — **Mikey's career area, 3 lines** | career3-sacked-manager-after-promotion.jpg |
| 12 | Team sheet | Manager "John McGrath" on the team sheet, "Diego Doherty" on Home | Your club's manager comes from the career on both (`VersusScreen.tsx`) | career2-manager-name-differs-home-vs-teamsheet.jpg |
| 13 | Home league dropdown | See-through: chips showed through the table | Solid background (`MiniLeague.tsx`, `IntlKit.tsx`) ✅ | career3-league-dropdown-see-through.jpg |
| 14 | Transfer window | White "Pick a club…" on yellow, hard to read | Dark pill behind it (`TransferHub.tsx`) ✅ | career3-transfer-window-contrast.jpg |
| 15 | Scout talk | "The through the gate is nowhere near it yet." | Each trial stage has a proper phrase ("Your first touch is…") (`signingTalk.ts`) ✅ | — |
| 16 | New career setup | "Step 1 of 2" twice, then "Step 2 of 2" | "Step 1, 2, 3 of 3" (`ProfileSetup.tsx`) ✅ | — |
| 17 | Admin tab on a phone (Admin mode on) | The tab placer read ~700 points every 0.5 s: 30–45% of a slow phone on every screen | Reads each point only when needed (~50), same spot; rests when the page is hidden (`components/AdminNavPanel.tsx`) | lag table below |
| 18 | 3 stale tests | chanceMaker, chanceJudge, identity failing on main | Test-only fixes (see Tests) | — |

## Not fixed: other chats' areas, or needs a decision
| Where | What | Who |
|---|---|---|
| Season awards refresh | A refresh on the awards screen skipped a forced contract renewal (seen: season 3 with 0 seasons left, no renewal) | Chat 6 — fixed on `leo-season-end` (44a86838), told the hub |
| Contract renewal at end of season 2 | Career 1 reached season 3 with 0 seasons left and saw no renewal, **without** a refresh. Not confirmed (it skipped the Ballon d'Or night video and pressed Stay) | Chat 6 / hub to check |
| Vote ceremony with a bribe | A refresh during the vote loses the bribe money: it is taken before the vote and the vote is never settled (code reading, `page.tsx` ~3214) | Chat 6 (awards) |
| Talks re-roll | Talks use `Math.random`, so a refresh gives a new opening offer (★18 then ★16): a mild save-scum (`NegotiationScreen.tsx:219,278`) | Mikey (economy) |
| "Deadline Day" recap at season end | The January window recap showed after the play-off at season end. Likely a Dev Skip side effect | Low; only with Dev Skip |
| Match header at 390 px | In a play-off match "ASSISTS" touches "PASS", "AVG RAT" touches the "2D" button | Match screen (engine area): not touched |
| Open-play chances look frozen | The match waits for your drag with no hint; a new player may think it hung | Design call for Harry |
| "Status: Substitute" after an 8.1 play-off; "Manager's Favourite" right after a Dev Skip | Low confidence, likely Dev Skip | — |
| Keepers | No position picker at career start, so a keeper (or defender) career cannot be made | Design note |
| FeedbackForm | React warning "Extra attributes from the server: style" on the footer's textarea (4×) | Harmless |

## Team jobs posted (`team/jobs.json`, 6)
1. **match2dCam** (Harry): at 372 × 704 the ball is 1 px short of a full-power drag above the bottom. Likely the size B change.
2. **longRangeRules** (Harry): a drawing disagrees with a law; 36 of 300 long shots have a fault.
3. **realGoals** (Harry): the word StatsBomb is still in patch notes 0.101h and 0.107 (his pages, not edited).
4. **3D training freeze** (Harry): `/star-training3d-dev`, Head/Volley → Free Roam → Head/Volley freezes 10–60 s in the test browser; stack in the shadow pass (`shadowCache.ts:479/625` → shader compile). Check on a real phone.
6. **Build-up mix** (Harry): 2 chance tests fail on main after this evening's build-up work (see Tests).
5. **Save size** (all): the save is ~1 MB (other clubs' squads 547 KB) and is rewritten on every change: 25 ms on the build machine, likely 150 ms+ on a cheap phone.

The old "Training levels page freezes on the second tab switch" (20 Oct report) did **not** come back: 6 runs, every switch answered in under 0.7 s.

## Tests
`node scripts/run-star-tests.mjs` (414 files):
- **Before** (main at 22 Oct evening): 408 passed, 6 failed — chanceMaker, chanceJudge, identity, longRangeRules, match2dCam, realGoals.
- **Causes:**
  - chanceMaker: a drawing holds a team-mate parked off the pitch; the test counted him on one side only. Test fixed, game unchanged.
  - chanceJudge: the "Old" fingerprint moved with 712caeb3 (licensed numbers swapped for free data, 21 Oct). Checked: its parent still gives the old value. Re-pinned with a note.
  - identity: the new Aerial skill (21 Oct) adds two fields the saved careers predate. Test ignores them, like Free kick.
  - longRangeRules, match2dCam, realGoals: Harry's area → team jobs.
- **After** (this branch before the final merge of main, 22:00): 413 passed, 4 failed → 414 of 417 once `teamRoomJobs` was fixed (my own job entries said "Leo (chat 7…)" where only a name is allowed). Left: longRangeRules, match2dCam, realGoals (team jobs).
- **After merging tonight's main (850ff5b0) at the end:** chanceMaker "even mix: a one-on-one about 1 in 10 (11/200)" and chanceJudge "forcing Old serves what Old serves" fail — they fail on main itself too (checked). From Harry's build-up/highlights merges this evening → team job 6.
- **Soak** (`careerSoak.mts 20`): all held, before and after the fixes.
- New tests: `seasonLabels.mts`, `welcomeTour.mts`; extended `flowTalks`, `transferInterest`, `signingTalk`, `club`, `hallRecords`.

## Lag on a slow phone (6× CPU slowdown, 390 × 844)
Measured on a **production build** (the dev server was too heavy), signed out, invented squads, 3 tries each, middle value. "Long tasks" = moments the phone is frozen for more than 50 ms, counted from the tap until the screen is quiet. The test browser has no graphics card, so 3D screens look worse here than on a real phone.

**Before → after tonight's admin-tab fix** (the fix only matters with Admin mode on, which signed-out test play and Harry/Mikey/Leo have; ordinary players never had the admin tab):

| Screen | Opens in (ms) | Frozen moments | Total frozen (ms) | Longest freeze (ms) |
|---|---|---|---|---|
| Shop (2D) | 1506 → 911 | 145 → 243 | 33,618 → 38,707 | 491 → 358 |
| Stats | 1610 → 850 | 82 → 206 | 19,036 → 36,994 | 597 → 313 |
| Home (back from League) | 1573 → 1069 | 14 → 3 | 5,270 → 725 | 1312 → 589 |
| Fixtures | 468 → 176 | 19 → 1 | 3,788 → 77 | 343 → 77 |
| My Home (3D house) | 448 → 230 | 11 → 5 | 3,315 → 2,574 | 1447 → 1455 |
| League table | 1502 → 1112 | 8 → 5 | 2,861 → 618 | 604 → 221 |
| All leagues | 876 → 329 | 10 → 3 | 2,207 → 345 | 384 → 144 |
| Settings | 338 → 417 | 14 → 4 | 2,216 → 1,056 | 244 → 443 |
| Line-up screen (Play) | 458 | 12 | 1,748 | 526 |
| Match: KICK OFF → picture | 1388 | 11 | 1,615 | 417 |
| Match: 15 s of play | 24 frames a second (60 at full speed) | 36 | 3,892 | 275 |
| Sim this match | 1585 | 4 | 1,364 | 962 |
| Page load → Home | 2898 (944 at full speed) | 14 | 3,635 | 634 |

**The 10 slowest and why** (from CPU recordings; production code has no names, so causes are read from the call path):
1. **Shop** and 2. **Stats** — busy the whole time, even at full speed (about 39 s busy in 40 s). Before the fix, 30–45% of it was the admin tab placer (`components/AdminNavPanel.tsx`, ~700 hit tests every 0.5 s); now 3.6 s instead of 13.2 s in a 40 s recording. What is left is drawing, not game code ("program" time, a little three.js): most likely a 3D or animated picture redrawing all the time, on the test browser's software graphics. **Not confirmed on a phone** — worth one look in the in-game Lag test (Stats and Shop steps).
3. **Home** — one 1.1 s picture export (canvas → image) when Home opens, plus the placer (now fixed). Sometimes a whole try was busy like Stats.
4. **My Home (3D house)** — one 1.4 s freeze on open: three.js preparing its shaders and textures. Same before and after.
5. **League table** — was mostly the placer; now 0.6 s total.
6. **Match** — 24 frames a second at 6× slower (60 at full speed); 36 freezes of ~0.1 s in 15 s: the match drawing itself (engine area, not touched).
7. **Page load** — 2.9 s to Home at 6×; the 1 MB save is read and checked on start (see the save-size team job).
8. **Sim this match** — one 1 s freeze (the match is played out at once).
9. **Fixtures**, 10. **All leagues** — were mostly the placer; now small.
- Every change to the career also writes the whole ~1 MB save to the phone's storage: about 25 ms on the build machine, likely 150 ms+ on a cheap phone → team job.
- Not timed: the season-end screens, Ballon d'Or night, the summer window, the garden, the phone feed (locked on a new career).

## Refresh safety (seen in the browser, signed-out career)
| Refresh during… | Before | After the fix |
|---|---|---|
| Ballon d'Or night | Home | Back on the ceremony ✅ |
| Summer window list | Home | Back on the list ✅ |
| Contract talks | Home | Back on the window list ✅ |
| "Deal agreed" signing screen | Home, deal lost | Back on the window list ✅ |
| A match (minute 22, 0–0) | Home, nothing lost, match replays | Same ✅ (nothing is saved mid-match; a goal scored before the refresh is not kept) |
| Post-match screen | Home; the result was already saved | Same |
| Season awards | Home; forced renewal skipped | Chat 6's fix |
| Goal replays / feed | Home; nothing lost (clips in IndexedDB) | Same |
| Brand-new career | — | Setup → trial → signing all normal ✅ |

For signed-in players on the live site, the start-up wipe mostly hit an empty key (the account isn't known yet at that moment), so the live game mostly lost #2 and the awards renewal. The slot-switch variant could hit anyone.

## What was seen and what was not
- **Seen:** 3 careers (Hemel Hempstead, Halifax → Brackley, Southend), 9 real matches, 3 season ends, Ballon d'Or nights, awards, 3 summer windows (a move, two walk-aways), promotion screens, the All-leagues viewer (11 competitions, row counts right, table sums right), retirement → farewell invite → Career Over → Hall of Fame; the refresh fix.
- **Not seen:** a real 20-season run (season 3 → 20 was jumped by editing the save), the farewell match itself, cups for your own club (Dev Skip jumped them), real squads, a keeper career, the 3D garden/shop in a career. 
- **Fixes seen after the fix** (production build, phone size): setup steps 1/2/3 of 3, scout talk in proper English, line-up buttons in the header, the welcome tour gone after pressing Play (also after a reload), the "in 4 days" tip matching the card, a solid league dropdown, the dark "Pick a club" pill, and the talks header equal to their offer. Stills: `fixed-*.jpg`. Small leftover: on the line-up screen a long competition name wraps to two lines ("NATIONAL LEAGUE SOUTH / · MATCHDAY 1"), and the "PLAY AS" pill touches the header card by ~5 px.
- **Not seen after the fix:** the signing-news card after a move, the "Promoted" label in the window list, the manager name on the team sheet, the no-sack-after-promotion rule (all covered by tests or type-check only).
- **Harness trouble (not game bugs):** the dev server ran out of memory (5–6.5 GB) and was killed three times with five testers on it; the lag numbers were then taken on a production build.

## Files touched
`app/star-dev/page.tsx` (refresh fix, one tip line) · `lib/star/{clubLogos,breakingNews,transferInterest,careerOverview,hallRecords,farewell,manager,careerFlow,signingTalk,tours}.ts` · `components/star/{NegotiationScreen,LineupIntro,VersusScreen,MatchdayScreen,HallOfFame,PointerTour,ProfileSetup,MiniLeague,IntlKit,TransferHub}.tsx` · tests listed above · `team/jobs.json` · stills in this folder. No match-engine file was touched.
