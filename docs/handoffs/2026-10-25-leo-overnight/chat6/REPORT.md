# Chat 6 overnight (25 Oct 2026): the end of season, made solid

Branch `leo-season-end` (origin/main merged in at the start). Everything sits behind Leo's 24 Oct switch (season video = `seasonReel`, awards night = `awardsNight`). Switch off: the game is as main.

## Results

| Job | Result | How sure |
|---|---|---|
| (a) White screen on the awards night | **Never came back in 10 runs** (straight, played in full, reloads mid-night, on the awards page, on the reel). No blank frame at any step, no page errors. Most likely the two earlier white frames were the screenshot tool catching the 3D room as it loaded or closed, not the game. | measured: 10 runs, 170 stills pixel-checked (`whitescreen/runs.md`) |
| (b) Awards night frame rate, slow phone | **Not settled.** In this machine's software 3D, the night runs at 3–6 fps on every quality setting, before and after. A real phone's graphics chip does the drawing here done by the processor, so these numbers can't say if a cheap phone holds 30 fps. Made lighter anyway, with the picture pixel-identical: draw calls 38–56 → 26–27 (Low) and 41–58 → 29–30 (Medium). | measured here (software 3D); phone fps not seen |
| (c) Season video sound | **Fixed.** Loudness −12.8 → −15.3 LUFS (a phone video's range); peak −1.6 → −4.1 dB; quick-fire goals' roar 1.8 → 8.2 dB over the music; live playback sound vs picture: drifting 16–67 ms → about 0 (worst 20 ms after a pause). The net sound already landed 12 ms after the ball crossed the line on every goal. | measured (meters, not ears) |
| (d) Film, with sound | **Done**: `film/season-end-full.mp4` (109 s, 4.1 MB): season video → Ballon d'Or → transfer window → awards night (you win two) → awards page → Season Review → next season. Plus `season-video.mp4` (29 s), `awards-night.mp4` (22 s), `handover.mp4` (19 s). Real play: the last 3 league matches played for real to make goal recordings; extra drawn-card goals and bigger season numbers were added to the save so you win the Golden Boot. | seen: frames checked, sound checked |
| Found while filming: silent cheers | The awards night's cheer at each name was **silent if no match had been played since the app opened** (the cheer uses the match sound, which only a match switched on). Fixed: the night switches it on itself. | see "Cheer check" below |

## Cheer check
VERIFY_LINE

## Not done / unsure

- Awards night is about 15–17 dB quieter than the season video (−36.6 vs −19.8 LUFS, measured): mostly quiet music with a cheer at each name. Not changed: the cheer is the shared match crowd sound; raising it would change the match too. Leo's call.
- The Ballon d'Or night uses the same cheer and so has the same "silent after a fresh open" gap. Its file is not mine; not changed.
- The film's save was edited (14 extra goal rows, 32 goals for the season), so its title card says 16 goals and its end card 32. Not a game bug.
- The hub's earlier proposal for a dark loading frame (lazy screens show nothing while loading) was not applied: no blank was ever seen, and that file is shared by every screen.
- Nothing here was heard by ear or run on a real phone.

## Files
`lib/star/goalClip/reel.ts`, `reelAudio.ts`, `components/star/SeasonReel.tsx` (sound), `lib/star/awardsNight3d.ts` (lighter room), `components/star/SeasonAwardsNight.tsx` (cheer), `tests/star/seasonReel.mts`, `docs/3D_HANDBOOK.md` (one line), `scripts/film/scenes/season-end-sound.mjs`, this folder (`whitescreen/`, `fps/`, `sound/`, `film/`).
