# Chat 7 · Bug hunt — report (22 Oct 2026)

Branch `leo-bughunt` (main merged in at the start). Plain English first; file names at the end of each line for checking.

## In one look
- **Played:** 3 careers in a real headless browser at phone size (390 × 844). One went to retirement and the Hall of Fame. The 20-season soak ran twice: 420 seasons, 20,672 matches, all rules held both times.
- **Tests:** before 408 of 414 passing; after LAG_TESTS_AFTER. 3 stale tests fixed. 3 left are in Harry's match/chance area, so they are team jobs.
- **Refresh safety:** every refresh landed on Home. Cause found and fixed. Ballon d'Or night, the window list, the talks and "Deal agreed" now come back where you were (seen in the browser).
- **Fixed tonight:** 16 bugs plus 3 stale tests (list below). **Team jobs:** 5 (in `team/jobs.json`).
- **Not real squads:** this sandbox could not reach the database (`cagkgfketucousksgtbk.supabase.co` blocked by the network rules), so every club used invented players and badges showed initials. Bugs that need real squads were not looked for.

## Bugs fixed (each seen or tested; ✅ = seen in a browser after the fix)
| # | Where | What you saw | Fix | Still |
|---|---|---|---|---|
| 1 | Refresh anywhere | Every refresh landed on Home: the saved "resume here" screen was wiped at start-up before it was read | The save of the screen waits until the load has decided the screen (`app/star-dev/page.tsx` init + `loadCareerIntoState` wrapper). Also fixes a slot switch writing the old slot's screen into the new slot ✅ | save-ballondor.jpg → save-fixed-ballondor.jpg |
| 2 | Refresh after "Deal agreed" | The agreed transfer was lost: Home, still at the old club, window gone | Refresh goes back to the window list (talks again) ✅ | save-signing.jpg → save-fixed-signing.jpg |
| 3 | Signing news after a summer move | "…has joined Brackley and wants to take charge of the National League", age 16 (really National League North, age 17) | The card reads the new league and next season's age (`lib/star/breakingNews.ts`) | career2-signing-news-wrong-league-age.jpg |
| 4 | Contract talks (transfer) | Header "Their wage offer ★28", card "★21" | Header shows their real offer, follows their counters (`NegotiationScreen.tsx`) | career2-negotiation-header-wage-mismatch.jpg |
| 5 | Transfer list | 4 NL North clubs all "Finished 24th" | Clubs up from Step 3 say "Promoted" (`transferInterest.ts`) | — |
| 6 | Line-up screen | ⏩ and ⚙ floated over the away crest and cut off "PLAY AS ST" | Both moved into the header's top-right corner (`LineupIntro.tsx`, `VersusScreen.tsx`) | career3-prematch-buttons-overlap.jpg |
| 7 | Badges, offline | A failed badge read was retried by every badge on every redraw (~2,000 failed reads in one session) | One read at a time; a failed read waits 30 s (`lib/star/clubLogos.ts`) | — |
| 8 | Career overview, Hall of Fame, farewell | First season labelled 2027/28; the calendar and Home say 2026/27 | One label helper on the calendar's year; old Hall cards read right too (`careerOverview.ts`, `hallRecords.ts`, `farewell.ts`, `HallOfFame.tsx`; test `seasonLabels.mts`) | — |
| 9 | Welcome tour on Home | Replayed on every Home visit for 20 seasons; covered ⚙ and "End of Season" | The last step counts as done the moment you press it, or when it leaves the screen (`PointerTour.tsx`) | career1-tutorial-replays-blocks-end-of-season.jpg |
| 10 | Welcome tip | "You've got a game today" with the match 2 days away | Says today / tomorrow / in N days (`tours.ts`; test `welcomeTour.mts`) | — |
| 11 | Manager after promotion | Manager sacked "after a season below what the board wanted" the summer his club went up | A manager who just won promotion is never sacked (`manager.ts sackCheck`, `careerFlow.ts`) — **Mikey's career area, 3 lines** | career3-sacked-manager-after-promotion.jpg |
| 12 | Team sheet | Manager "John McGrath" on the team sheet, "Diego Doherty" on Home | Your club's manager comes from the career on both (`VersusScreen.tsx`) | career2-manager-name-differs-home-vs-teamsheet.jpg |
| 13 | Home league dropdown | See-through: chips showed through the table | Solid background (`MiniLeague.tsx`, `IntlKit.tsx`) | career3-league-dropdown-see-through.jpg |
| 14 | Transfer window | White "Pick a club…" on yellow, hard to read | Dark pill behind it (`TransferHub.tsx`) | career3-transfer-window-contrast.jpg |
| 15 | Scout talk | "The through the gate is nowhere near it yet." | Each trial stage has a proper phrase ("Your first touch is…") (`signingTalk.ts`) | — |
| 16 | New career setup | "Step 1 of 2" twice, then "Step 2 of 2" | "Step 1, 2, 3 of 3" (`ProfileSetup.tsx`) | — |
| 17 | 3 stale tests | chanceMaker, chanceJudge, identity failing on main | Test-only fixes (see Tests) | — |

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

## Team jobs posted (`team/jobs.json`)
1. **match2dCam** (Harry): at 372 × 704 the ball is 1 px short of a full-power drag above the bottom. Likely the size B change.
2. **longRangeRules** (Harry): a drawing disagrees with a law; 36 of 300 long shots have a fault.
3. **realGoals** (Harry): the word StatsBomb is still in patch notes 0.101h and 0.107 (his pages, not edited).
4. **3D training freeze** (Harry): `/star-training3d-dev`, Head/Volley → Free Roam → Head/Volley freezes 10–60 s in the test browser; stack in the shadow pass (`shadowCache.ts:479/625` → shader compile). Check on a real phone.
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
- **After:** LAG_TESTS_AFTER
- **Soak** (`careerSoak.mts 20`): all held, before and after the fixes.
- New tests: `seasonLabels.mts`, `welcomeTour.mts`; extended `flowTalks`, `transferInterest`, `signingTalk`, `club`, `hallRecords`.

## Lag on a slow phone (6× CPU slowdown, 390 × 844)
LAG_TABLE

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
- **Not seen:** a real 20-season run (season 3 → 20 was jumped by editing the save), the farewell match itself, cups for your own club (Dev Skip jumped them), real squads, a keeper career, the 3D garden/shop in a career. SEEN_AFTER
- **Harness trouble (not game bugs):** the dev server ran out of memory (5–6.5 GB) and was killed three times with five testers on it; the lag numbers were then taken on a production build.

## Files touched
`app/star-dev/page.tsx` (refresh fix, one tip line) · `lib/star/{clubLogos,breakingNews,transferInterest,careerOverview,hallRecords,farewell,manager,careerFlow,signingTalk,tours}.ts` · `components/star/{NegotiationScreen,LineupIntro,VersusScreen,MatchdayScreen,HallOfFame,PointerTour,ProfileSetup,MiniLeague,IntlKit,TransferHub}.tsx` · tests listed above · `team/jobs.json` · stills in this folder. No match-engine file was touched.
