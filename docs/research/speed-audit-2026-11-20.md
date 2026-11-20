# Speed audit: the slowest taps (measure only), 20 Nov 2026

No game code changed. Branch `Harry` at the time of the run, production build
(`npm run build` + `next start`), built with `NEXT_PUBLIC_STAR_OFFLINE_DEV=1`
so a signed-out save plays. Phone size 390x844, touch on.
Script: `scripts/perf/tap-speed.mjs` (timings), `scripts/perf/tap-profile.mjs`
(what code runs during one tap). Save: `scripts/perf2d/make-save.mts`
(fresh Arsenal career, every screen open).

## How each tap was timed

- **Painted**: from the tap to the frame after the new screen's first element
  appears (a `requestAnimationFrame` loop checks every frame).
- **Frozen until**: the end of the last long task (a block over 50 ms) in the
  8 s after the tap. Until then the screen may be drawn but does not answer
  taps or animate smoothly.
- **Ready** = the later of the two. The table is sorted by it.
- 3 repeats each, median shown. Each repeat is a new browser tab with a warm
  server.

**Warning about the numbers.** This machine has no graphics chip. WebGL runs
in software (SwiftShader), so the 3D numbers (Garden, House, Stats' 3D face)
are much worse than a real phone. Read them as "where the time goes", not as
"what a player waits". The CPU was not slowed down. A mid phone is about 4x
slower on the CPU parts. A 4x run was started; see the end.

## All measured taps, slowest first

| # | Tap | Painted (ms) | Frozen until (ms) | Ready (ms) | Longest single block (ms) | Runs (painted) |
|---|-----|-------------:|------------------:|-----------:|--------------------------:|----------------|
| 1 | Phone → Garden (3D) | 203 | 7,805 | **7,805** | 6,461 | 215 / 203 / 189 |
| 2 | Play → team sheet | 499 | 4,417 | **4,417** | 149 | 443 / 499 / 642 |
| 3 | Phone → Your house (3D) | 183 | 2,079 | **2,079** | 961 | 182 / 183 / 206 |
| 4 | Home → Stats | 374 | 1,945 | **1,945** | 1,709 | 432 / 374 / 224 |
| 5 | Kick off (team sheet → match) | 1,682 | 1,657 | **1,682** | 1,689 | 1,956 / 1,682 / 1,610 |
| 6 | First load of /star-dev (to Home's bar) | 925 | n/a | **925** | n/a | 962 / 925 / 786 |
| 7 | Home → League | 506 | 274 | **506** | 89 | 506 / 400 / 576 |
| 8 | Open Settings | 240 | 422 | **422** | 109 | 146 / 420 / 240 |
| 9 | Home → Shop | 413 | 397 | **413** | 85 | 418 / 413 / 349 |
| 10 | Open the phone | 323 | 377 | **377** | 88 | 451 / 323 / 167 |
| 11 | Start a career (Start tap → next screen) | 207 | 112 | **207** | 59 | 440 / 207 / 188 |

First load, in numbers (median of 3, cold browser, local server, no network
slow-down): first paint 504 ms, Home's bar visible 925 ms. **2,873 KB of
JavaScript in 142 files**, 8,172 KB in total over 265 requests. On "Fast 4G"
(9 Mbit/s) the JavaScript alone is about 2.6 s of download (reasoned from the
size, not measured).

## The 10 slowest, and the likely cause

Causes come from a CPU profile of one tap each (measured) and the code it
points to (read). Where I only reasoned, I say so.

1. **Phone → Garden (3D), 7.8 s frozen.** About 6.9 s is the GPU building
   shaders: three.js waits for each material's shader to compile and checks
   it for errors (`getProgramInfoLog` 3.9 s, `getShaderInfoLog` 3.0 s),
   all in one block. Software WebGL makes this far worse here; a real phone
   still pays it once per new material (measured here, phone size reasoned).
2. **Play → team sheet, 4.4 s.** The team sheet is drawn in 0.5 s. A small
   block runs about 4 s later (busy only 443 ms in total), so the screen is
   usable well before 4.4 s. Not profiled; cause unknown (no number).
3. **Phone → Your house (3D), 2.1 s.** Same as the Garden: shader building
   (`getProgramInfoLog` 1.0 s) plus 0.76 s resizing the 3D renderer
   (`setSize`) at the phone's 2x pixel ratio (measured).
4. **Home → Stats, 1.9 s frozen.** The screen paints in 0.4 s, then freezes
   about 1.7 s. The player card draws a 3D face (`Headshot3D` →
   `lib/star/headshot3d/maker.ts`): it builds a 3D scene, compiles shaders and
   encodes the result as a picture (`toBlob` 3.9 s of CPU in the profile).
   It does this on the first visit of each session (measured + read).
5. **Kick off, 1.7 s.** One 1.7 s block before the first match frame. The
   biggest piece of our own code in it recolours the player sprite sheet
   pixel by pixel into each team's shirt, shorts and socks
   (`lib/star/sprites.ts`, tint per kit; 340 ms self time unthrottled), plus
   building the chance list (measured + read).
6. **First load, 0.9 s here, about 3+ s on 4G.** 2.9 MB of JavaScript in 142
   files before Home can be tapped; `/star-dev` itself is 1.53 MB at build
   time (the build's own "First Load JS"), the rest loads after (measured).
7. **Home → League, 0.5 s.** No long block (worst 89 ms). The time is React
   drawing the whole table and fixtures in one go (reasoned; not profiled).
8. **Open Settings, 0.4 s.** A long page of rows drawn at once; worst block
   109 ms (reasoned from the screen; not profiled).
9. **Home → Shop, 0.4 s.** The swipe animation plus the shop page's pictures;
   no block over 85 ms (reasoned).
10. **Open the phone, 0.4 s.** The phone and its app grid open in one draw;
    worst block 88 ms (reasoned).

Anything under about 100 ms feels instant; 100 to 300 ms feels quick; over
1 s feels broken. Items 1 to 6 are the ones a player would notice.

## What I could not measure

- **Home → Garden / Home → House directly.** There is no button on Home for
  them; both open from the Phone. I timed the tap on the Phone's "Garden" and
  "Your house" icons, with the phone already open.
- **"Pre-match → team sheets".** There is no separate pre-match screen now:
  Play goes straight to the team sheet with KICK OFF on it. I timed the Play
  tap instead.
- **"Start a career" to Home.** I timed the Start button to the next screen.
  I did not check by eye what that screen is (it may be the signing scene).
- **The 3D first real frame.** The 3D canvas appears in about 0.2 s; I could
  not read its pixels (WebGL), so "Frozen until" is the honest number there.
- **Real phone GPU.** No GPU on this machine: the 3D numbers are too high.
- **Real players' data.** No Supabase key here, so every club uses invented
  squads. Real squads mean more pictures to load.
- **4x slower CPU run.** Started after the normal run; it had not finished when
  this report was committed. Not in the table.

## Fixes, 20 Nov

Commits on `Harry`: 5421147c (fix 1, kick off), 3c082313 (fix 2, Stats
headshot), b66e3cbb (fix 3, 3D entry). Production builds of the commit
before the fixes (281e09f3) and of b66e3cbb, both with
`NEXT_PUBLIC_STAR_OFFLINE_DEV=1` and no squad data (invented squads, as in
the audit). The machine was shared with other builders (a dev server, a
3D shooter), so a plain before-run then after-run was not fair: untouched
taps (Settings, League) came out 50-160% slower in the later run. The table
below is an **interleaved A/B**: both servers up at once, each repeat taps
BEFORE then AFTER, one browser at a time. Median of 3 (Garden after: 2;
the third was cut short). ms, this software-GPU machine.

| Tap | Painted before → after | Frozen until before → after | Longest block before → after |
|-----|-----------------------:|----------------------------:|-----------------------------:|
| Kick off | 278 → 228 | 121 → 89 | 121 → 89 |
| Play → team sheet | 545 → 693 | 4,436 → 4,618 | 346 → 238 |
| Home → Stats | 526 → 830 | 1,450 → 1,773 | 680 → 615 |
| Phone → House (3D) | 2,502 → 1,744 | 11,991 → 11,642 | 4,145 → 4,725 |
| Phone → Garden (3D) | 3,617 → 3,462 | 4,968 → 5,442 | 19,058 → 23,026 |

Read it as: kick off a little better; everything else within this
machine's noise (run-to-run spread is 30-100% on the 3D taps). No tap got
measurably worse beyond that noise, and none got clearly better except kick off.

What was found (measured with CPU profiles and Chrome traces):

1. **Kick off.** The audit's 1.7 s block did not come back on 281e09f3:
   kick off measured 0.26-0.37 s before any fix. The player's first match is
   from the bench, and the match already coloured its kits in slices while
   the commentary ran. Fix 1 starts that colouring on the team sheet, in idle
   time (lib/star/matchSpriteWarm.ts, called from MatchdayScreen.tsx). After
   it, the profile at kick off shows only the sliced colouring (no
   one-block colouring by the first frame). Same kits as CanvasMatch picks
   (test tests/star/matchSpriteWarm.mts compares all four kits, home and
   away, against CanvasMatch's own formula), same colouring function, so the
   same pixels. CanvasMatch.tsx was not changed.
2. **Play → team sheet, the job ~4 s later.** It is the team sheet's own
   automatic kick off (the bar at the top runs out and the match starts by
   itself): the match mounting, its chance list and its kit colouring. It
   is the match start, not a stray job. It is about 100-130 ms of React plus
   sliced work. Fix 1 moves part of it earlier. Nothing else was changed.
3. **Home → Stats.** The 0.7-0.8 s block is the headshot draw plus reading
   the picture back (`toBlob` waits for the software GPU). Fix 2 starts the
   face only in idle time and builds its shaders before the draw. The block
   is still about 0.6 s here: the read-back is GPU drawing, which a phone's
   GPU does far faster (reasoned, not measured).
4. **House and Garden.** Traces show the freeze is not mainly shader linking.
   It is Chrome's software compositor reading the WebGL frame back on the
   page thread (`Commit → GLES2::ReadPixels`, 8-11 s for the Garden's first
   frame): SwiftShader builds its drawing code at the first draw and rasters
   at 2x. A phone with a GPU does not read the frame back on the page thread.
   Fix 3 (shaders finished one at a time between frames on devices without
   parallel compile; no resize to the same size) cut the linking pieces to
   ≤150 ms each, but the big first-frame block stays on this machine. A
   tried extra step, drawing each new material once into one pixel before
   the first frame, moved about 3 s out of that block but made 0.7-0.9 s
   pieces and changed what is drawn before the first frame; it was
   reverted, not committed.
5. **First load.** Not changed: `/star-dev` first load 1.53 MB before, 1.54 MB
   after (`next build`); 2,791 → 2,794 KB of JavaScript in 125 files on the
   wire. Biggest things in it (source size, from webpack's module list):
   CanvasMatch.tsx 764 KB, canvasEngine.ts 418 KB, nation-names.json 471 KB,
   researched club data 221 KB, authoredScenarios.json 174 KB, mp4/webm
   muxers 130 KB, supabase auth/realtime/storage 434 KB. Making the match load
   on demand (`lazyScreen`) was tried: the one-engine guard then fails
   ("app/star-dev/page.tsx is listed as mounting <CanvasMatch> but no longer
   does"), because it cannot see a lazy mount. The guard may not be edited,
   so this needs a team decision. The name lists are read synchronously by
   career code; moving them out is a refactor, not an additive change.
