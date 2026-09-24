---
name: one-engine
description: The rule that every football-playing screen in Knowitball runs the ONE real match engine, never a copy. Load BEFORE building or changing anything that plays football — a new mode, drill, trial stage, minigame, test/dev screen, highlight or scenario player — or anything touching components/star/{CanvasMatch,EnginePlay,ScenarioPlay,InfiniteMatch,TrainingMinigame,FiveASide}.tsx, components/star/stages/**, lib/star/{engineProfile,playArea}.ts or scripts/one-engine-guard.mjs. Also load when the build fails with "ONE ENGINE GUARD", "GUARD IS BLIND", or "runs its own copy of the match".
---

# One engine

Asked for by Harry (24 Sep 2026): *"the engine isn't being used gamewide… there
has to be a way that ANY new feature used the base engine — when we are
trialling new features, that can be extra stuff built on top of the base
engine."* And: *"yes never drifting — but if an area is specific for tuning
(i.e. the play area) it should be the base game with guardrails + adaptable
gameplay, but adapting that gameplay should only happen inside the test area
and not uniformly."*

## Why

An audit found the trial, the training, five-a-side and two prototypes each
running their OWN copy of the match loop. Every copy had drifted:

- a trial keeper who guessed at the strike
- a ball drawn at half its height
- one physics step a frame where the match takes three
- a free-kick wall that never jumped

Nobody drifted them on purpose. Each copy was right on the day it was made,
and the real match moved on without it.

## The rules

1. **Football is played by `CanvasMatch`, and nothing else runs its loop.**
   - The real career match mounts it directly (`app/star-dev/page.tsx`).
   - Everything else mounts **`EnginePlay`** (`components/star/EnginePlay.tsx`).
2. **A new feature is extras AROUND EnginePlay**, never a new loop. It gets
   what it needs from:
   - `openOn`: which picture to play
   - `onChanceServed`: before each chance
   - `onChanceResolved`: after it, with the outcome and where the ball went
   - its own buttons, overlays and scoring, drawn outside the canvas

   If a feature needs something the engine does not do yet, add it to the
   engine as an optional prop that is **off by default**, so the real match is
   untouched. Never modify `lib/star/canvasEngine.ts` (Mikey's rule).
3. **A test screen is the real game plus dials.**
   - `EnginePlay` gives it:
     - the real match's size (`realMatchWidth`) by default; drag power depends on canvas size, so a bigger `width` (guardrailed, `testPlayWidth`) is only allowed because EnginePlay then passes CanvasMatch `dragReferenceHeightPx` (the real match's canvas height) and the same finger movement kicks exactly as hard
     - the real squads
     - the real weather
     - fresh legs every 90 minutes
   - The Play Area's dials (`lib/star/playArea.ts`) are props on that one mount.
   - A dial must never write to a career, to `tuning.ts`, or to the engine.
   - Every dial's default is the real game.
4. **Something wrong in a copy gets fixed in the engine, not in the copy.** If
   the trial's keeper felt better, that behaviour belongs in the real match
   too, or it goes. Ask Harry which.

## The guard, and what to do when it fails

`scripts/one-engine-guard.mjs` runs on every `npm run build`, so it blocks
every Vercel deploy. It also runs from `npm run guard:engine` and
`tests/star/oneEngine.mts`. It uses the TypeScript compiler, not text
matching, so renamed imports, `import * as`, re-exports and functions held in
variables are all seen.

| Message | What it means | What to do |
|---|---|---|
| `X runs its own copy of the match` | A new file calls engine physics | Rebuild it on EnginePlay. Do NOT add it to `KNOWN_COPIES`. |
| `X mounts <CanvasMatch> directly` | A screen bypassed EnginePlay | Mount EnginePlay instead. |
| `X is no longer a copy — well done` | Someone ported a copy | Delete its line from `KNOWN_COPIES` and lower `CEILING` by one. |
| `GUARD IS BLIND` | The guard stopped seeing a planted copy in `tests/star/fixtures/oneEngineCanary/` | Fix the guard. Never "fix" the canary files. |
| `KNOWN_COPIES has N entries but CEILING is M` | Someone added to the list | Take it back out. The list only shrinks. |
| `GUARD IS JUMPY` | The guard flags a harmless look-alike in the canary (`launch(url)`, a type-only use) | Fix the guard. A false alarm blocks every deploy for all three of you. |
| `X runs its own canvas animation loop` | A new screen draws and animates its own canvas, which is how a screen writes its own ball physics without calling the engine | If it plays football, build it on EnginePlay. If it truly doesn't (a picture, a chart), ask Harry, and add it to `KNOWN_CANVASES` only if he says so. |
| `The real match passes "X" and EnginePlay does not` | A setting was added to the real match, so every test screen now plays without it | Pass it in EnginePlay. Use `CAREER_ONLY` (with a reason) only if it's genuinely a career fact. |
| `EnginePlay passes "X" and the real match never does` | A test-only dial was added | List it in `TEST_ONLY` with the reason, so it stays visibly a test-area thing. |
| `ONE ENGINE GUARD crashed` | The guard broke | Fix it. It fails closed on purpose: a crashed guard has checked nothing. |

**Never** add a file to `KNOWN_COPIES`, raise `CEILING`, weaken a canary,
take the guard out of the `build` script, or skip the guard to get a build through —
unless Harry, Mikey or Leo has asked for exactly that, in those words, in the
current conversation. If a build is blocked and you think the guard is wrong,
stop and say so. Don't route around it.

## The copies still to port

`KNOWN_COPIES` in the guard is the live list, each entry with its plan. The
order agreed on 24 Sep 2026 is:

1. ~~trial penalties and free kicks, and the training strike drills~~ — done 24 Sep 2026 (`EngineFeature` + `onChanceResolved`; training's gate uses `markers` + `onBallStep`; the gauntlet is the real match's `FirstPersonDribble`)
2. five-a-side: a different game, but it must use the match's own drag and arrow
3. the two dev prototypes: port or delete

When one is done, the guard itself tells you to delete its line.
