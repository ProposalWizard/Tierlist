# Stylised player look test (Harry, 9 Oct 2026)

A look test, not part of the game. It puts today's human body
(`public/star/human3d/human.glb`) on a Blender copy of the golden-hour pitch
(the game's own grass, sky, crowd, LED and HDR maps in `public/star/h3d`) and
in the 3D shop (its parquet and plank maps), and renders four styles:

- **A** cel shading: 3 bands, ink outline, bigger head and hands
- **B** Spider-Verse: 2 bands, halftone dots, tinted shadows, bold ink, colour offset
- **C** stylised PBR: smooth skin, saturated, soft, rim light, softened face
- **D** control: the realistic body as it is, with a textured kit

Every option wears the same textured kit: woven cloth, the shirt's fold map,
a back and shorts number, collar/cuff/side trims and an invented badge.
All styling is materials, an inverted-hull outline and bone scales, so every
clip still plays on the body.

```bash
S=<scratch>
npm i --prefix $S/gt @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer draco3dgltf sharp
node tools/ovation3d/unpack.mjs public/star/human3d/human.glb $S/human3d_human.glb --tools=$S/gt
node tools/styletest/strip.mjs $S/human3d_human.glb $S/human_s.glb $S/gt    # Blender cannot read the vec3 helper attributes
python3 tools/styletest/gen_tex.py $S/style-test/tex                        # number + badge
bash tools/styletest/run_all.sh $PWD $S "A B C D"                           # Eevee, ~1.5 min per option
python3 tools/styletest/sheet.py $S/style-test                              # pitch.png per option + sheet.jpg
```
