# Video render (how v01 was made)

The working files of the first viral video (docs/marketing/videos/v01-patch-0.1-0.3/),
kept so the `patch-note-video` and `tiktok-remix` skills can reuse them. Free and offline:
no paid tools.

A video is a folder V holding `lines.json` (the voice lines), `assets/` (stills, the
Oswald font (OFL), the game's own sfx) and, after the steps below, `vo/`, `timeline.json`
and `mix.wav`. `v01/` is the first video's folder as an example.

1. `python3 tts.py V` — voice with Kokoro (`bm_george`, speed 1.2, en-gb) into V/vo/.
   Needs `pip install kokoro-onnx soundfile` and the Kokoro v1.0 model files (free, from
   the kokoro-onnx GitHub release; ~340 MB, never commit them).
2. `python3 timeline.py V` — beat timings from the voice lengths → V/timeline.json, and
   the sound mix (whooshes made in numpy + the game sfx) → V/mix.wav.
3. Copy `video.html` into V (or point the render at it). Every frame is drawn from the
   time t alone, so a frame always looks the same.
4. `node render.cjs V` — Playwright Chromium screenshots each frame and pipes them to
   ffmpeg (H.264 + AAC, 1080×1920, 30 fps) → V/out.mp4. A long run can crash the page:
   `node render.cjs V frames A B` renders frames A..B (250 at a time) instead.
5. `python3 sheet.py` — a contact sheet to check captions against the safe area.

`render.cjs` has the session's paths (node_modules, the Chromium path) written in;
change them if the machine differs. Captions stay inside x 64–950, y 150–1536 (out of
the right 12% and the bottom 20%).
