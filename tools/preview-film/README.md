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

## The second ad: fast motion graphics (11 Nov 2026)
`ad2/ad.html` is a page that can draw itself at any moment (`window.setT(seconds)`): big
words that slam in, phones with the real game on them, a gold wipe at each cut, all on
the beat of the game's track "Last attack" (first beat 0.569 s, one every 0.58 s; the goal
lands on beat 18). `node ad2/render.mjs <work dir with foot/, clean/, cinzel.ttf> <music> <out.mp4>`
photographs it 30 times a second (about 5 minutes for 25 s) and adds the music.
No rendering in Blender: a change of words or timing is a 5-minute re-run.
The match footage stops before the scorer names appear, so no real player name is shown.
