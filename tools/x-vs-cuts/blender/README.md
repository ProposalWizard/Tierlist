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
