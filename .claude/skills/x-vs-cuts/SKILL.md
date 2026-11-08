---
name: x-vs-cuts
description: Make an "X vs 1000 cuts" TikTok-style video (a food chopped 10, 50, 100, 250, 500, 1000 times with counters and sound) in Blender for any food — avocado, red apple, or a new one. Use when the user asks for a cutting video of a food, a new food for the cuts template, or to re-render one.
---

# X vs 1000 cuts

A 72-second vertical video: a food on a board, chopped down, sideways, then diced, in six
rounds (10 to 1,000 cuts), with CUTS / CUBES counters and chop sounds. The cutting is one
template; each food is a small profile file.

The user does not write code. Keep messages short and plain, and during long renders post
progress with a rough finish time.

## Where the code is

GitHub `ProposalWizard/Tierlist`, branch `main`, folder `tools/x-vs-cuts/blender/`
(`render_all.py`, `cuts2.py`, `cuts3.py`, `finish.py`, `plan_avocado.json`, `foods/`) and
`tools/x-vs-cuts/audio.py`. Download the files with curl from
`https://raw.githubusercontent.com/ProposalWizard/Tierlist/main/tools/x-vs-cuts/...`, keeping
the layout `x-vs-cuts/audio.py`, `x-vs-cuts/blender/...`. On the user's PC a working copy
is at `C:\Users\mikey\OneDrive\Desktop\Documentsknowitball-cuts\x-vs-cuts\` (check it is
current against main before using it).

Read `blender/foods/README.md` first: it lists everything a food file can set.

## Needs (ask before installing anything)

- Blender **4.1 exactly** (4.2+ changed EEVEE). On the user's PC:
  `C:\Blender41\blender-4.1.1-windows-x64\blender.exe`.
- Python 3 with numpy and Pillow; ffmpeg (on the user's PC from winget, maybe not on PATH:
  `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\ffmpeg-*\bin`).
- `finish.py` loads the Inter font from `/usr/share/fonts/opentype/inter/`. On Windows put
  `InterDisplay-Black.otf` and `InterDisplay-ExtraBold.otf` (rsms/inter release) in
  `C:\usr\share\fonts\opentype\inter\`.
- Windows: set `PYTHONUTF8=1` (finish.py prints a "≈").

## A new food

1. Copy `foods/apple.py` to `foods/<name>.py`; set shape (`L, RM, EH, rad, CZ_A, CZ_B`),
   core (`STONE`), colours (`LOOK`), extras such as a stem (`EXTRAS`). The shape must be
   round-ish slices along one axis (no hollow or strongly curved foods without new code).
2. With `XCUTS_FOOD=<name>`: build + check round 1 (`cuts2.py -- build` / `-- check`) and
   rounds 2-6 (`cuts3.py -- build i` / `-- check i`, i = 1..5). Every one must print
   CHECK PASS; if a check fails, fix the food (e.g. `LOOK` `tip`, `pile_floor`), never the check.
3. Look at stills before rendering (round 1 frames 0 72 130 165; round 5 frames 1320 1440 1580 1690).
4. `python render_all.py --blender "<blender 4.1>" --food <name> --test` (~15 min), show it,
   then the full run (~1.5-2 h on the user's integrated AMD GPU; use 1 worker).
   Output: `blender/out_<name>/<name>_full.mp4`.
5. Any template change must leave the avocado pixel-identical: new settings get a
   do-nothing default in `LOOK`. Re-render a few avocado frames and compare to confirm.

## What the user approved (keep it this way)

- Rounds 4-6, stages 1 and 2: the knife chops fast (down/up on alternate frames) and a lighter
  band shows the cut area growing; stage 2 lightens it again from the bottom up.
- Rounds 5-6, stage 3 (dice): same fast chop; round 4's dice stays the normal motion.
- Pieces must land on the board, not float; the blade must look like it goes through.

## Long renders

The laptop sleeps when the session goes idle, which pauses Blender for hours. Request
keep-awake, keep a Monitor running with frequent events, and suggest the user sets sleep
(plugged in) to Never.
