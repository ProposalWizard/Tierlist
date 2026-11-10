# Preview film (Mikey, 10 Nov 2026)

A short film that shows the game to people who do not know it. Free to make:
Blender here, the real game on the phone's screen, the game's own music.
Public name: "KnowItBall: Road to Golden Ball". No real club or player names
in anything public.

## How the film is made (all free)
1. **Film the game**: `node scripts/star-sandbox/seasons.mjs --video <dir> --games 5` (the
   robot plays the real game at phone size; a .webm). Cut each shot's frames with ffmpeg
   into `<footage>/<shot>/s_0001.png..` (24 a second, 780x1688).
2. **Render the room**: `blender -b -P scene.py -- --shot <name> --screen <footage/shot> --out <r/shot>`.
   Seven shots on one set (`SHOTS` in scene.py: open, trial, sign, match, train, climb, gold),
   the light going from afternoon to night. 540x960, 16 samples, about 20 s a frame on 4
   processors with no graphics card. It also writes `corners.json`: where the phone's
   screen is in every frame. A stopped render carries on where it stopped.
3. **Clean and lay the screen on**: `python post.py <r/shot> <footage/shot> <clean/shot> --oidn <oidnDenoise>`.
   Takes the grain off with Intel Open Image Denoise (free download from its GitHub
   releases; this Blender build has none), enlarges to 1080x1920 and warps the game's own
   frame onto the phone, so the game is as sharp as the game.
4. **Cut it**: `python assemble.py <clean> <cinzel.ttf> public/star/music/<track>.mp3 out.mp4`.
   The words are `CUT` in assemble.py. The font is the game's own (app/fonts, turned
   from .woff2 to .ttf with fontTools). Music is the game's own.

Python needs: opencv-python-headless, OpenEXR, pillow, numpy, fonttools, brotli (a venv).

Reference only (not copied): the breakdown in Drive, "one-prompt Blender film reference".
