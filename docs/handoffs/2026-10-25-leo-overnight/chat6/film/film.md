# Season end, filmed with the game's sound (25 Oct 2026)

Build: production build of `leo-season-end` @ 99fd5c93 on :3530 (offline dev build). Switch ON (`kib-update-leo-2026-10-24`). Headless Chromium 1194, 390×844 phone, touch dots on.
Driver: `scripts/film/scenes/season-end-sound.mjs` (real taps only). Picture: Playwright screen recording. Sound: `audio-tap.mjs` + `audio-pcm.mjs` (every Web Audio node and `<video>`, sample-accurate PCM on the audio clock).
All clips: H.264 + AAC 128k, 390 wide, 30 fps. Dead time cut; the cuts have 40 ms sound fades.

## The clips

| Clip | Length | Size | Loudness (integrated / true peak) | What it shows |
|---|---|---|---|---|
| `season-end-full.mp4` | 108.6 s | 4.1 MB | -21.7 LUFS / -7.4 dBTP | Home → End of Season → "Your season" video (title, 2 drawn cards, the 2 recorded goals, Goal of the Season live + slow-mo, end card) → Ballon d'Or night (doors open, final three, the winner) → "Not nominated" result → Continue → transfer window → Stay → 3D awards night (Golden Boot: you win; Player of the Season: you win) → awards page → Continue → Season Review → Golden Boot achievement pop-up → new season's first screen ("In the dugout": the manager is sacked) |
| `season-video.mp4` | 29.1 s | 1.6 MB | -19.8 LUFS / -6.9 dBTP | The reel's best part: title, 4 recorded goals with their roar (89' Woking, 94' Tamworth, 67' and 70' Southend), Goal of the Season (live + slow-mo), end card |
| `awards-night.mp4` | 21.5 s | 1.0 MB | -36.6 LUFS / -11.9 dBTP | 3D awards night in real time: Golden Boot (nominees, "and the winner is", you walk up and lift it, cheer), then Player of the Season (you again) |
| `handover.mp4` | 18.7 s | 0.5 MB | -35.3 LUFS / -11.7 dBTP | Awards page (scrolled: trophies, awards, Team of the Season, records) → Continue → Season Review → Continue → achievement pop-up closed → "In the dugout" (season 2's first screen) |

Not silent, not clipped (measured): true peak -6.9 dBTP at most; no sample near full scale.

**Finding (measured): the awards night and the pages after it are about 15-17 dB quieter than the season video** (awards night -36.6 LUFS vs the reel's -19.8). Game music is on; its result-scene level is 0.34 (`gameMusic.ts` RESULT_VOLUME) and the per-award cheer is a short swell, so on a phone the awards night will sound faint next to the reel. Nothing was boosted here: every clip is at the game's own level.

**Finding (code, reasoned + seen in take 3): the awards-night cheer is silent if no match was played since the page loaded.** `playCrowdSwell` needs the match-sound context, which only `primeMatchSound()` creates (CanvasMatch, FeelPreview). Take 3 opened the app straight at End of Season: no cheer spike at any reveal. Take 4 (the one used) played the last match first in the same page visit: a +6 to +10 dB swell at each name. A player who reopens the app at season end gets no cheers.

## Sound sync (spot-check)

On-screen goal moment = the goal flash frame (frame brightness jump, measured); roar onset = first 20 ms window ≥ 4 dB over the 0.3 s before and staying there 0.2 s.

| Goal | Clip | Roar minus picture |
|---|---|---|
| 89' v Woking | season-video | **-80 ms** (the roar is planned to start 50 ms early) |
| 67' v Southend | season-video | **0 ms** |
| 94' v Tamworth | season-end-full | **0 ms** |
| 90' v Woking | season-end-full | +180 ms (the kick and crowd overlap; less reliable) |
| 70' v Southend (pen) | season-video | +440 ms (unreliable: the previous goal's roar is still up) |

The screen recording lags the page: cut.py assumes 0.2 s; measured here it was 0.39 s (5 goals, 0.16-0.24 s off with 0.2 s), so the sound is laid 0.39 s after the PCM's start.

## What was edited, played, or not filmed

- **Played for real** (match-lib.mjs, real drags + taps, never a moved ball): the last three league matches from a W47 save (Woking 4-2, Tamworth 2-3, Southend 2-0): 4 goals recorded on the device in take 3. In take 4 the third match was played in the same page visit just before filming; it ended 0-0 for you, so that reel has **2** recorded goals. `season-video.mp4` is cut from take 3 (4 recorded goals); the other three clips from take 4. Same build, same save, same flow.
- **Save edited** (before End of Season): 14 goal rows added to `goalLog` (drawn cards in the reel, no recordings), season numbers raised (32 goals in take 4 / 34 in take 3, 9 assists, 44 apps, league 29 goals) so he wins the Golden Boot. Side effect seen: the title card says "16 GOALS" (the rows) while the end card says 32. Two of the added rows name clubs from other divisions (Barrow, Carlisle).
- **Game music turned ON** (Settings → Game music, a player setting; off by default).
- **3D awards night: real time, not stepped.** It ran smoothly enough in this browser (no frame stepping, nothing sped up).
- Ballon d'Or: not nominated (a National League player), so the night shows another winner.
- The film ends on season 2's first screen ("In the dugout"), not the Home dashboard behind it.
- Two "Achievement unlocked" pop-ups at the start (from the edited numbers) were closed before filming started.
