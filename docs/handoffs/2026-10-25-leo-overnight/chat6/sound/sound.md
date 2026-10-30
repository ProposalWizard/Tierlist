# The season video's sound: check and fix (25 Oct 2026)

Branch `leo-season-end` (from 7c7fcf21). Test page `/star-season-reel-dev`, Arsenal, "Every goal", 1 trophy (the winning track).
Before = the production build on :3500. After = this worktree's build on :3520. Headless Chromium 1194.
Every number below was **measured**, unless the row says **plan** (read off the sound plan in node) or **reasoned**.

## What was off, what changed

| # | Problem (measured) | Fix | File |
|---|---|---|---|
| 1 | Too loud for a phone video: **-12.8 LUFS** (20 goals), **-12.3 LUFS** (40). Aim -16 to -14. | Last trim 0.84 → **0.63** (-2.5 dB, after the limiter, so the mix's shape is unchanged). | `reelAudio.ts` `OUT_TRIM` |
| 2 | Quick-fire goals (40-goal season, goals 17-40): the roar sat only **+1.8 dB** over the music as the ball went in (min -0.7 dB). The full goals get +6.5 dB. | The music now takes a short notch at each quick-fire goal: 0.7 → 0.4 from 50 ms before the goal, held 0.3 s, back by 0.75 s. The quick-fire crowd 0.6 → 0.8. | `reel.ts` `musicLevels`, `MUSIC_QUICK_DIP`, `screenGoalAt`; `reelAudio.ts` `QUICK_CROWD` |
| 3 | Live playback was kept in step with the sound that is *queued*, not the sound that is *heard*. A phone's output delay (Bluetooth earbuds: 0.1-0.25 s, reasoned) put every roar that late. Re-sync only past 0.2 s. Under load, a straight 72 s run drifted from -45 to -67 ms and was never corrected. | Starts the sound `lead` seconds further in, where `lead` is the browser's own output delay (`getOutputTimestamp`, else `outputLatency + baseLatency`). Re-syncs past 60 ms (held 0.3 s, so one wobble does not jump), at once past 0.25 s (a seek), with a 30 ms crossfade (no click). | `SeasonReel.tsx` `heardContextTime`, `syncVoice` |

Not changed: `audio.ts`, `edit.ts`, `render.ts`, `cameras.ts`, `encode.ts`.

## 1. Loudness and clipping

ffmpeg `ebur128=peak=true` on the mixed AudioBuffer (pulled from the page as WAV) and on the saved file (Save video, audio decoded by ffmpeg).

| | Before 20 | After 20 | Before 40 | After 40 |
|---|---|---|---|---|
| Integrated, mix | -12.8 LUFS | **-15.3 LUFS** | -12.3 LUFS | **-14.4 LUFS** |
| Integrated, saved file | -12.8 LUFS | **-15.3 LUFS** | -12.3 LUFS | **-14.4 LUFS** |
| True peak, mix / file | -1.6 / -1.7 dBTP | **-4.1 / -4.2 dBTP** | -1.4 / -1.4 dBTP | **-3.8 / -3.9 dBTP** |
| Samples ≥ 0.99 (mix and file) | 0 | 0 | 0 | 0 |
| Loudness range | 2.0 LU | 2.0 LU | 2.2 LU | 2.8 LU |

RMS per section, mix (crowd stem / music stem), dB:

| Section | Before 20 | After 20 | Before 40 | After 40 |
|---|---|---|---|---|
| Title card | -19.3 (music -19.3) | -21.8 (music -21.8) | -19.3 | -21.8 |
| Full goal, mean of all | -15.7 (-16.8 / -21.4) | -18.2 (-19.3 / -23.8) | -15.3 | -17.8 |
| Quick-fire goal, mean | - | - | -14.8 (-16.7 / -17.9) | -16.5 (-17.3 / -21.9) |
| "Goal of the season" beat | -14.9 | -17.4 | -15.4 | -17.0 |
| Goal of the season (live + slow) | -15.3 | -17.8 | -15.2 | -17.7 |
| End card | -16.1 (music -16.4) | -18.6 (music -18.9) | -16.4 | -18.9 |

Music audible on the cards: yes, it is the only sound on the title card and leads the end card (crowd -30 dB there).

Crowd over music, dB (crowd stem RMS minus music stem RMS):

| | Before 20 | After 20 | Before 40 | After 40 |
|---|---|---|---|---|
| Full goals, 0-1 s after it goes in, mean (min) | 7.1 (6.0) | 7.1 (6.0) | 6.8 (5.6) | 6.8 (5.6) |
| Quick-fire, 0-0.35 s (to the clip's cut), mean (min) | - | - | **1.8 (-0.7)** | **8.2 (5.4)** |
| Quick-fire, 0-1 s (runs into the next goal), mean (min) | - | - | 1.2 (0.4) | 5.0 (3.9) |

## 2. Sync: the sound lands when the ball crosses the line on screen

On-screen goal moment = the segment's start + (goalT − shot.from) / rate. Checked against the frames too: the ball's y crosses 0 between 4 and 17 ms before goalT (plan), i.e. on the same frame.

| Sound | How measured | 20 goals | 40 goals (16 full + 24 quick) | Slow replay |
|---|---|---|---|---|
| Net | matched the goal-net sample in the mixed buffer | **+12 ms** at every goal (22/22) | **+12 ms** at every goal (42/42) | +12 ms (on the slowed picture) |
| Roar | plan cue | -50 ms (by design: its rise reaches half level 85 ms in, so it swells with the ball going in) | -50 ms | none, deliberately (below) |
| Kick | plan cue | on the strike frame | on the strike frame | on the slowed strike |
| Lead commentator | plan cue | +300 ms (the same reaction delay as every goal video, audio.ts) | +300 ms | |
| Saved file vs mix | cross-correlation | +0.0 ms (WebM/Opus, file 13 ms longer at the end) | +0.0 ms | |

Same before and after: sync of the mix was already right; the fix touched only the level of the quick-fire part.
The +12 ms is the same at every goal, so it is the decoder (the browser keeps the MP3's start padding that ffmpeg trims), not the plan.

Slow motion: the kick and the net follow the slowed clip (played at 0.6 speed, deeper); the crowd drops back to a murmur and the co-commentator talks over it. No second roar on the replay, on purpose (it is the same goal again).

Commentary (plan, both seasons): 2 lines, never overlapping (20 goals: 61.15-63.90, 64.05-66.32; 40 goals: 72.88-75.63, 75.78-78.05). The lead's call runs across the cut from live to slow (one continuous track, so nothing is cut). The co-commentator's line ends 0.1 s into the end card, not cut off.

Live playback (headless Chrome, output delay reported 32 + 10 ms). Picture clock against the sound being heard (`getOutputTimestamp`).

| | Before | After |
|---|---|---|
| Straight 72 s run, heard minus picture (outside probe, picture read from the progress bar, up to one frame stale) | -45 → -57 → -67 ms (machine busy with a build), -16 → -21 ms (idle) | +15 / +15 / +14 ms (first 20 s / middle / end) |
| Same, the screen's own probe (fresh clocks) | (not in the old build) | **0.0 ms median, range -0.1 to +0.1 ms**, 138 samples |
| After pause + resume | -19 ms | +13 ms (own probe: 0 ms, worst -20 ms) |
| After a seek to 55 s | -28 ms | +13 ms |
| Restarts of the sound in a straight run | 2 (the start, and the seek to 0) | 2 (no corrections needed) |

## 3. Tests (node, `tests/star/seasonReel.mts`, new section 6)

On synthesised recordings (the test page's goal maker), 20 and 40 goals: net within 10 ms of every on-screen goal (live and slow), the roar starts 0-80 ms before it, `screenGoalAt` agrees, the music is at the notch at every quick-fire goal and the roar stands within 2 dB of a full goal's, commentary never overlaps and never runs past the end, stacked roars ≤ 3.2 (the most measured clean, 40 goals: true peak -3.8 dBTP), `OUT_TRIM` below 0.84.
Loudness and clipping need a browser's audio engine, so they are measured here, not in node.

## Not checked

- Listening by ear (no speakers here). Everything above is meters and timing.
- An iPhone or Android phone: the saved file there is MP4/AAC, here it was WebM/Opus (this Chromium has no H.264). The AAC start padding was not measured. A real phone's output delay (and Bluetooth) was not measured; the fix uses what the browser reports, and Safari before 14.1 reports nothing (it then behaves as before).
- The picture's own display delay (one or two frames on screen) is not counted on either side.

The saved reel files were 11.9 MB (20 goals) and 14.7 MB (40 goals), so none is kept here.

## Re-measure

`measure/`: `planSync.mts` (plan, writes plan.json: `npx tsx` from this folder), `grab.mjs <url> <goals> <dir> save` (mix + stems + saved file), `analyse.py <dir> <goals>` (run with `python3 -I` from the repo root, plan.json next to it), `live.mjs <url> <goals> <out.json> [straight]`.
