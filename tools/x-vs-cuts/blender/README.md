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
