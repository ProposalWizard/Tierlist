# Chat 2 · Smooth feed scrolling — report (25 Oct 2026)

Branch `leo-feed` (origin/main merged in). Everything below is behind Leo's 24 Oct update switch: "Fast social feed" and "Goal videos play at once". With the switch off, the feed is exactly as on main.

**Late:** the job reached this session at 12:29 UTC, after the 06:30 deadline.

## (a) Scroll hiccups (frames over 0.1 s), phone slowed 4× and 6×

**How:** production build, 390×844, the 150-post test career, a player's phone (no admin tab). The feed is scrolled top to bottom in 120 px steps (82–85 steps). A "hiccup" is a long task over 100 ms on the page (PerformanceObserver). **All numbers are measured.**

| | Frames over 0.1 s | Worst frame |
|---|---|---|
| Switch OFF (the feed as on main), 4× | 9 | 0.20 s |
| Switch OFF, 6× | 39 | 0.28 s |
| Switch ON, start of today (before tonight's change), 4× | 0 | 0.064 s |
| Switch ON, start of today, 6× (5 runs, player + team) | 0, 1, 0, 1, 2 | 0.11 s |
| **Switch ON, after, 4× (3 runs)** | **0, 0, 0** | **0.059 s** |
| **Switch ON, after, 6× player (3 runs)** | **1, 0, 6** | **0.12 s** |
| **Switch ON, after, 6× team view (2 runs)** | **0, 0** | **0.094 s** |

- **The 11–16 hiccups (0.14–0.17 s) from 22 Oct** did not come back when I re-measured the start of today on a quiet machine. On 22 Oct other builds and browsers were running on the same machine. So today's "start" row is the fair before, not 11–16.
- **What the long frames are (measured, performance trace at 6×):** the browser building each post as it comes near the screen. Style 26 ms, paint 23 ms, pre-paint 19 ms, layout 15 ms, layers 9 ms; our own JavaScript is about 2 ms of a 95 ms frame. Posts are already built one per frame, nearest first, and off-screen posts are not painted.
- **Tonight's change (seen in the trace, reasoned for the effect):** the frosted-glass blur on the video play button and on the feed's bottom tab bar is gone, with the fast feed on. A blur is repainted on every scroll frame. The tab bar is now a solid dark bar (almost the same look); the play button is a solid dark circle.
- **Target:**
  - **4×: met** (0 hiccups in 3 of 3 runs).
  - **6×: not met every run.** 0–1 hiccups in 4 of 5 runs; one run had 6, with that run's scroll taking longer overall (9.2 s v 7.3 s), which looks like the machine being busy. The worst frame is 0.12 s.
  - Getting 6× under 0.1 s every time needs posts that are cheaper for the phone to build (fewer elements and effects per post). That is a look change, so I left it.

## (b) Your goal's own post after a match

**How often it has a video (measured):** 200 simulated matches where you score (pure media pass, `scripts/feed-bench/your-goal-rate.mts`).
- **Before (16 Oct rule, 1 or 2 videos a match at random): 96 of 200 = 48%.** When the match keeps only 1 video, your goal's post loses its video.
- **After (switch on, "Goal videos play at once"): 200 of 200 = 100%.** Your goal's post always keeps its video next to the highlights.
- Videos per match: 1.68 → 2.2.
- The fix is one line in `lib/star/media/feed.ts` capVideos, read through `lib/star/media/updateFlags.ts` (`yourGoalVideo`, set from the switch).

**Tap → playing after a real match (measured):** a real career match (Arsenal v Man City, a real shot that went in at 30+1'), dev server (slower than live, so a worst case), CPU slowed from full time on:

| Post in Post Match Reactions | Full speed | 4× |
|---|---|---|
| **Your goal's own post** (it now has a video) | **0.03 s** (live player) | **0.05 s** (live player) |
| Match highlights | 0.06 s (file ready) | 0.06 s (file ready) |

- **Seen:** the clips show "Striker v Manchester City: 1 goal 🎥" with its video, the burnt-in time, and the goal playing (with sound).
- **Not re-measured tonight:** reopening in Social and the Stats → Goals gallery. Main's merge changed the screens on the way there, so my script didn't reach them. Both were measured on 24 Oct (0.09 s and 1.6 s at 4×).

## (c) Film

- `film/feed-scroll-4x-side-by-side.mp4` (16 s, 1.9 MB): the same feed scrolled at 4×. Left: switch off (as main). Right: switch on.
- The two halves on their own: `film/feed-scroll-4x-off.mp4`, `film/feed-scroll-4x-on.mp4`.
- `after-match/your-goal-reactions-{1x,4x}.mp4` and `after-match/highlights-reactions-{1x,4x}.mp4`, with the game's sound and the time burnt in.
- **Seen:** 6 frames of each clip checked. Production build for the feed clips. The after-match clips are from the dev server, because the match bot only scores reliably there.

## Also changed

- **The media flags** are kept on `globalThis`. The Node test runner loaded `updateFlags.ts` twice, so a flag set by a test was not seen by the feed code. The browser bundles one copy, so the game was never affected.
- **Scripts:**
  - `measure.mjs` gains `--leo on|off` and `--trace-ms`.
  - `feed.mjs` gains `--leo`.
  - `after-match.mjs` turns the switch on by default.

## Checks

- `npx tsc --noEmit` and the one-engine guard pass.
- Star tests pass: goalVideo, media, goalOfMonth, leagueAccountLabel, plus the full list below.
- `npm run build` passes.
