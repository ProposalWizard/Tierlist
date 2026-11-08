# Blender version (test, 7 Nov 2026)

Round 1 of the avocado made the "real model" way: a modelled avocado with skin,
flesh and stone, sliced for real into pieces, a modelled knife, and Blender
rigid-body physics for the drop. Eevee render through software graphics.

Setup once: `apt-get install -y libegl1 libgl1-mesa-dri libegl-mesa0` (Eevee
needs EGL; Cycles in this Blender has no denoiser).

- `blender -b --factory-startup --python avo_blend.py -- build` makes `avo_r1.blend` (about 15 s).
- `blender -b avo_r1.blend --python avo_blend.py -- still 0 132` test stills.
- `blender -b avo_r1.blend --python avo_blend.py -- render 0 55` frames (run 3 parts at once).
- `python3 overlay.py`: upscale to 1080x1920 and draw the two counters.

Lessons: Blender's camera `angle` is not the vertical angle (use `angle_y`);
colour the flesh from a stored `orig` position (each piece's own centre moves);
tip a slice from its front bottom edge, never its centre, or pieces push into
their neighbours and fly. About 11 s a frame at 540x960, 32 samples.

## Version 2: cuts2.py (8 Nov 2026), use this one

Every cut is one event (frame, kind, plane). The knife pose, the line on the
skin and the slice drop all read that same event, so they cannot drift apart.

- `blender -b --factory-startup --python cuts2.py -- build` builds round 1 (cut frames measured from the original, see STUDY-round1.md).
- `blender -b --factory-startup --python cuts2.py -- check` THE SYNC CHECK. For every cut: the blade is on the plane on the cut frame, the line appears on that frame and not before, no cube shows before its own chop, and no cube rises above the avocado. Prints CHECK PASS or FAIL. Never send a render that fails it.
- `... -- still <frames>` and `... -- render <from> <to>` as before; `overlay2.py` draws the counters from the same events; `sound2.py` puts a sound on every cut frame.

Bugs found on the way (do not repeat):
- `transform_apply(scale=True)` also applies location and rotation (they default to True). It moved the board's collision box 8 cm up, which buried every cube and shot them into the air. Always pass location=False, rotation=False.
- Physics on a parented object goes wrong: unparent the cubes, keep their world position.
- Blender reuses a baked physics result from the .blend, so tests on a saved file can be stale: rebuild from scratch to test physics.
- A procedural texture with no coordinates stretches over the whole object (giant bricks): feed it Object coordinates.
- Filmic colour, not AgX, matches their saturated wood and green.

## Rounds 2-6: cuts3.py (8 Nov 2026)

`blender -b --factory-startup --python cuts3.py -- build <i>` / `check <i>` / `still <i> <frames>` / `render <i> <from> <to>`
(i = 1..5 for rounds 2..6). Cut times come from the original's measured
timeline (avocado-practice plan.json). The knife is worked out from the cut
times, so any number of cuts works; the check proves every cut (2,000+) lands
on its line at its cut time. Cubes are one mesh animated by us (no Blender
physics: tens of thousands of pieces), released when the dice passes them,
falling into a mound shaped like the avocado.
`runall.sh` renders rounds 2-6 with 3 workers; `finish.py video|sound` draws
the counters and makes the sound for all 72 s.
Pile colour: tiny pieces must blend toward the average flesh colour (theirs
measures about RGB 216,215,171), and touch each other, or the pile reads grey
and speckled.

## Fixes after the first PC render (8 Nov 2026)
1. Pale skin in rounds 4-6: the hundreds of fine cut lines lightened it. Lines fade out as they crowd (none drawn past 34 per direction).
2. The last-round stone moment: pieces fall faster in late rounds (0.07-0.12 s) and fill the mound bottom-up and front-first, so a low pancake sits in front and the cut face with the stone stays in view.
3. Pile colour per round (PILE / GLOW in cuts3.py), measured against the original at each round's end: within about 3-9% in every round.
4. Board deeper orange, bricks larger and darker.

## PC render fixes and the food template (8 Nov 2026)

Rendered on a Windows PC (Blender 4.1.1, integrated AMD GPU, about 1.5 h for 72 s).
1. Fast stages read as slow: with 1-4 cuts per frame, every frame caught the knife at
   a random point of its stroke (a strobe effect), so it seemed to drift. When cuts come
   faster than one per 2 frames (down and side, rounds 4-6) or one per 1.5 frames (dice,
   rounds 5-6), the knife is posed per frame instead: down on the newest cut line on even
   frames, up over the next line on odd frames (`chop_pose` in cuts3.py). The check
   proves every "down" frame sits on a line cut in the last two frames.
2. Rounds 4-6 show the cutting again: dense lines are drawn wide (35% of the spacing) so
   they blend into a lighter band; the down cuts lighten the skin and the side cuts
   lighten it further, so each stage shows its own progress.
3. Foods: the avocado's shape and colours are now settings, and `foods/<name>.py` can
   replace them (`render_all.py --food apple`). See `foods/README.md`. The avocado renders
   pixel-identical to before. First extra food: a red apple with a stem.
4. Windows: set `PYTHONUTF8=1` (finish.py prints a "≈"), and finish.py's Linux font path
   resolves to `C:\usr\share\fonts\opentype\inter\` on the C: drive.
