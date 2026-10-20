# Drift audit: every screen that plays football (19 Oct 2026)

Harry: "work to fix any drifts across the game". A drift is anything the engine is given that differs from the real career match.

## How it was measured

- Playwright, Chromium, dev server, 390x844 and 1440x900.
- `probe.mjs` finds the real `CanvasMatch` behind each canvas through React's fiber tree and prints the props it was given (drag reference, keeper, pressure, scene, fatigue, skills...) plus the pitch's real size on screen and whether a parent clips its edges. `career-match.mjs` does the same for the career (baseline). `trial.mjs` walks the five trial stages with the dev skip panel.
- Real match sizes (baseline, measured): **366 px wide on a 390 phone, 384 px on a computer** (career box 366x744 / 384x800).
- Pitch height varies by design (the new view fills the room under the page's bars), so only width and props are judged.

## Before / after (pitch width in px)

| Screen | 390 before | 390 after | 1440 before | 1440 after | Drag reference |
|---|---|---|---|---|---|
| /star-dev career match (baseline) | 366 | 366 | 384 | 384 | none (real) |
| Trial: free kicks, gate, penalty shootout | 366 | 366 | 384 | 384 | none (real) |
| Trial: Take him on (own dribble picture) | 362 | **366** | 380 | **384** | n/a |
| Trial: Find the pass (own picture) | 366 | 366 | 384 | 384 | n/a |
| Training drills (strike drills) | 346 | **366** | 364 | **384** | set, correct |
| /star-highlights-dev Play | 366 | 366 | 493 (bigger on purpose) | 493 | set, 614.4 |
| /star-gallery-dev Play | 366 | 366 | 493 (bigger on purpose) | 493 | set, 614.4 |
| /star-play-dev Infinite Match | 366 | 366 | 384 | 384 | none |
| /star-sim90-dev your chance | 366 | 366 | 384 | 384 | none |
| /star-real-moments-dev Play | 318 | **366** | 340 | **384** | set |
| /star-statsbomb-dev Real shots (+ Moving highlight) | 344 | **366** | 384 | 384 | set |
| /star-real-goals-dev | 360 | **366** | 384 | 384 | set |
| /star-dribble-stick-dev | 362 | **366** | 384 | 384 | set |
| /star-vfx-lab-dev live match | 340 | **366** | 384 | 384 | set |
| /star-goal-clips-dev | 332 | **366** | 384 | 384 | set |

In every squeezed case the drag was already read against the real canvas (`dragReferenceHeightPx` 585.6 / 614.4), so a kick was never harder or softer. What differed was the size of the pitch and the men: smaller than a career's.

## What the engine is given, by screen (settings that differ from the career)

All of these are named Play Area dials or a page's own explicit settings, not accidents. Nothing here was changed.

| Screen | Differs from the career match |
|---|---|
| Every EnginePlay screen | `neverHooked`, `fatigueResetEvery` 90 (test-only, in the guard's TEST_ONLY); keeper 62 / opposition 65 / skills 55 are the Play Area's defaults, and the keeper is the opposition's real keeper (`forceKeeperStrength` false); weather is the real roll; real squads loaded (20 own, 20 league) |
| Trial stages | `scene` leaves out team-mates / keeper / goal per drill; invisible stats (40/40/40, set piece 40); keeper 45-95 per stage |
| Training drills | no career, `scene` (no keeper, no team-mates, no banners), keeper 0, skills 40 |
| Goal videos | keeper forced to 25 and weather clear (its own `SETTINGS`, so goals get scored and recorded) |
| Real goals | keeper forced to 80, skills 85/95, curve on, weather clear, pressure 0, `scene.ownFrame` (the real goal's own framing) |
| Real shots / Moving highlight | `scene.ownFrame` (their real players stay on screen) |
| Dribble stick | `dribbleOnly`, stick steering (the page's purpose) |
| Highlights / Gallery | `bare`, `openOn` picture; bigger canvas by request (`testPlayWidth`) with the drag reference set |

No keeper strength, squads, weather, fatigue or camera-framing drift was found beyond these named dials.

## What was fixed (one commit each, except the first which fixes five screens through one shared path)

1. `4fd14026` EnginePlay/EngineFeature: the box measures the room its page gives it and steps out into the page's side gutters by exactly the missing amount (never within 4 px of the screen edge; no sideways scroll). Fixes Goal videos, Real moments, Visual effects lab, Real shots, Dribble on a stick. One shared mechanism, so one commit; each page was re-measured on its own after.
2. `ea412543` Training drills: the card's 10 px padding no longer squeezes the pitch.
3. `bb88737a` Real goals: the goal card no longer clips the match's edges.
4. Trial Take him on: the pitch frame's border is a ring now (it ate 4 px).

Checks: tsc clean; one-engine guard clean (no change to KNOWN_COPIES, CEILING or the canary); admin-look guard clean; `finishing aiming outcomes oneEngine` all pass. `lib/star/canvasEngine.ts` untouched.

## Not fixed, and why

- `components/star/FiveASide.tsx` is a known copy in the guard's list, but nothing mounts it any more (no page or stage imports it), so there is no screen to measure. Porting or deleting it is a decision for Harry.
- Highlights and Gallery Play are 493 px wide on a computer: bigger on purpose (`testPlayWidth`), with the drag reference set so the kick is identical. Left as designed.
- Not driven end to end: the other Full match layout ("TV broadcast") and the 3D / radar views of sim90, the Gallery's 5-a-side and Tuning tabs, the statsbomb "Ours vs real" tab. They either mount the same EnginePlay or no match.
- Not measured live: a real iPhone (this machine has no graphics chip; sizes are layout measurements, not feel).

## Re-running it

```
node docs/handoffs/2026-10-19-ui-lookover/probe.mjs /star-goal-clips-dev 390x844
node docs/handoffs/2026-10-19-ui-lookover/trial.mjs 390x844
PROFILE=<dir> node docs/handoffs/2026-10-19-ui-lookover/career-match.mjs 390x844
```
(Dev server on port 3050; `probe.mjs` takes click arguments, `~text` clicks by text and `@css` by selector.)
