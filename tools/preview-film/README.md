# Preview film (Mikey, 10 Nov 2026)

A short film that shows the game to people who do not know it. Free to make:
Blender here, the real game on the phone's screen, the game's own music.
Public name: "KnowItBall: Road to Golden Ball". No real club or player names
in anything public.

- `scene.py`: the whole set, built by script (bench, football, phone, shirts,
  golden ball, light, a slow camera push-in). `blender -b -P scene.py -- --screen
  <folder of frames, or one picture> --out <dir> [--still 48] [--w 720 --h 1280 --samples 48]`.
- The screen footage: `node scripts/star-sandbox/seasons.mjs --video <dir> --games 2`
  films the robot playing the real game (a .webm); cut 96 frames from it with ffmpeg.
- This Blender build has no denoiser and the machine has no graphics card:
  about 1 minute a frame at 540x960. Clean the grain with ffmpeg afterwards.

Reference only (not copied): the breakdown in Drive, "one-prompt Blender film reference".
