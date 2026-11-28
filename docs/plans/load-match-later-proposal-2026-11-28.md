# Load the match later: what it saves, what the guard says, what to decide (28 Nov 2026)

For Harry, Mikey and Leo. Research only. No code was changed. No build was run. The guard was read, not run.

## The ask

Harry: "load the match later to shrink the first load."
An earlier try was blocked by the one-engine guard. We must not edit the guard's lists (RUL-ENG-004). That is a team decision.

## 1. What the first load of /star-dev downloads today

How sure I am: the only real measure is from 15 Oct 2026. The `.next` folder here is a dev build (page.js is 40 MB), so it says nothing about real size. Everything marked "estimate" is my own sum from source file sizes.

1. **Measured on 15 Oct** (production build, `docs/plans/2026-10-15/lag.md` section 1b): 52 files, 4,072 KB raw, 1,207 KB gzipped. three.js is not in it.
2. **Estimate for today:** the code has grown in 5 weeks. The game's static code is 662 source files, 9.7 MB of source (my sum, `wc -c` style). Treat the real figure as "about 4 to 5 MB raw, about 1.2 to 1.5 MB gzipped". Re-measure before deciding.
3. **Biggest match pieces, source size:**
   - `components/star/CanvasMatch.tsx`: 647 KB
   - `lib/star/canvasEngine.ts`: 434 KB
   - `lib/star/hiddenMatch.ts`: 90 KB
   - `components/star/EnginePlay.tsx`: 23 KB
   - 15 Oct measure of CanvasMatch after minify: 177 KB raw.
4. **Why the match is in the first load.** Three static links, found by tracing imports:
   - `app/star-dev/page.tsx` line 157 imports CanvasMatch. It is mounted at lines 4349, 4410, 4661 and in `OldUiMatch` (5813).
   - `components/star/PhoneHome.tsx` line 48 imports EnginePlay (the Kickabout). EnginePlay imports CanvasMatch.
   - `lib/star/simMatch.ts` (the match you do not play) imports `canvasEngine`, `hiddenMatch` and `firstPersonDribble`. `leadInGen.ts` pulls in `keeperBrain` and the build-up code. `PhoneHome` also pulls `canvasEngine` and `gallerySim` to `chanceMaker` to `hiddenMatch`.
5. **Important:** the engine files (`canvasEngine`, `hiddenMatch`) are NOT only used by the match screen. Home needs them for simulated matches. So making CanvasMatch lazy does not remove them.

## 2. What would have to change to load the match only when a match starts

Counted by tracing static imports from page.tsx (estimate, source bytes):

| Cut | Source removed from first load |
|---|---|
| CanvasMatch + EnginePlay lazy (and what only they use) | about 1.27 MB of 9.7 MB (13%) |
| Also cut `simMatch` from the first load | about 1.30 MB (almost nothing more: PhoneHome still pulls the engine) |

So the engine itself (`canvasEngine` 434 KB, `hiddenMatch` 90 KB) stays in the first load unless Home's simulated matches, Kickabout and the gallery sim are also made lazy. That is a bigger job.

The code change for the simple cut, in plain steps:

1. In `app/star-dev/page.tsx`, replace the line-157 import with `const CanvasMatch = lazyScreen(() => import("@/components/star/CanvasMatch"), { fallback: loadingCover("match") })`. `lazyScreen` is in `lib/star/lazyScreen.ts`. The loading curtain already has a "match" section (`components/star/loading/`, `LoadSection`).
2. Keep `import type CanvasMatch` for the `OldUiMatch` props (type only, the guard ignores types).
3. In `PhoneHome.tsx`, load EnginePlay the same way (Kickabout only).
4. Preload CanvasMatch when Home is up (the 15 Oct plan, item F4a, said the same: "preload it first after Home"). Then the tap on "play" has no wait.
5. Drills: `TrainingMinigame` is reached through `RelationshipGame` and `BossPenalties`. The trial stages mount EnginePlay too. They would each need the same lazy load, or they stay as they are and only the real match is lazy.

### What the guard would flag, and why (reasoned from `scripts/one-engine-guard.mjs`; not run)

1. **"The settings check is blind" (build fails).** The guard reads the `<CanvasMatch ...>` tags in page.tsx and EnginePlay to compare their settings (rule 5). It finds a tag by following the name back to CanvasMatch.tsx. After step 1 the tag name is a local lazy wrapper, so it points to `lazyScreen`, not CanvasMatch. The guard sees no tag and fails.
2. **"Listed as mounting CanvasMatch but no longer does" (build fails).** Page.tsx has no import of CanvasMatch any more, only a text path in a dynamic import. The guard may stop counting page.tsx as a mount. I am not certain either way; running the guard would tell us.
3. **The same two for EnginePlay**, if EnginePlay is made lazy.

None of this is a bug in the plan. The guard was written to catch copies, and a lazy wrapper hides the tag by design (the canary file `mount.tsx` plants exactly that trick: a tag under another name).

Fixing it means one of these, all of which touch what RUL-ENG-004 protects:
- teach `isCanvasMatch` to follow a `lazyScreen` wrapper (a guard code change, and the canary must prove it still sees the trick); or
- change `REAL_MOUNT` / `TEST_MOUNT` / `CANVASMATCH_MOUNTS`.

We will not do either without the team's words.

## 3. Options

Savings are estimates. 4G time = download of gzipped bytes at about 4 to 5 Mbps real, plus parse on a mid Android (about 1 s per 400 to 500 KB of raw JS). Not measured.

| Option | What it does | First-load saving (estimate) | Time on mid Android, 4G (estimate) | Risk | Needs the guard changed? |
|---|---|---|---|---|---|
| A. Lazy CanvasMatch and EnginePlay | The plan in part 2, with preload after Home. | about 180 to 250 KB raw, about 55 to 80 KB gzipped (15 Oct measure of CanvasMatch 177 KB, plus EnginePlay and its own files) | about 0.3 to 0.6 s on first load | Medium: first match tap may show the "match" curtain for a moment on a cold phone; the preload hides it. Guard fails the build until it is taught. | Yes. A team decision. |
| B. Lazy the match's data, not the match | Load `authoredScenarios.json` (357 KB source today; 174 KB in the 15 Oct measure), `nation-names.json` (488 KB source), the media templates (226 KB source) and international tournaments when first needed. | about 600 to 900 KB raw, about 150 to 250 KB gzipped (15 Oct list M1, M6, M8, M9; sizes have grown) | about 0.8 to 1.5 s | Medium: needs async reads where the code reads these now (some are read in simulation). Does not touch CanvasMatch's mount, but `authoredChance.ts` and `airDrawings.ts` feed the engine, so an engine-warn hook (RUL-ENG-001) will ask. | No. |
| C. Do nothing to the code; preload harder | Keep everything as is. Start downloading the match files as soon as Home shows, ahead of Settings, Shop and the rest (item F7 in the 15 Oct plan). | 0 KB on first load. Removes the wait when you tap play. | 0 s on first load | Low | No. |

My view (reasoned, not measured): B gives the largest saving for the least risk and needs no guard change. A is smaller than it looks because the engine stays in. A is only worth doing together with a decision to make simulated matches lazy too, which is a larger job.

## The decision needed

Harry, Mikey and Leo, please answer these two questions:

1. **Do we want Option B first (lazy data, guard untouched)?** Yes or no.
2. **Do we allow a change to the guard so a lazy CanvasMatch mount can be seen (Option A)?** If yes, say it in these words, as RUL-ENG-004 asks: "change the one-engine guard to follow a lazy CanvasMatch". If no, A is closed.

Before either is built, one step is needed: a real production-build measure of today's first load (JS KB by file), so we compare against a true number and not my estimate. That needs a build, so it is not done here.
