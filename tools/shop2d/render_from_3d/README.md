# Showroom stills from the 3D shop's models

Harry, 12 Oct 2026: the 2D shop's pictures were "a really bad version" of the
3D shop's models. These tools render the 3D shop's own generated GLBs
(`public/star/shop3d/items/*-hf.glb`) as the showroom's big stills, in one
studio look: soft key light, a cool rim from behind, a faint floor shadow, a
see-through background, 1440×1080, one camera angle per kind.

Output: `public/star/shop2d/items3d/`. The shop picks them by
`shopPic3d()` in `lib/star/shopPicsLook.ts` (Settings → Look → "Shop
pictures: New | Old"; Old = the Blender drawings in `shop2d/items/`).

- Cars, the motorbike: the model repainted on the old level ladder (L1 worn,
  L2 blue, L3 red, L4 black, L5 gold) by a paint-swap shader in `index.html`
  (texels near the model's own paint colour take the level's colour).
- SUV (black paint) and jet (white): the shader cannot pick the paint out, so
  all five levels are the same picture.
- Homes, watches, jewellery, boots: one picture for all five levels, as the 3D
  shop shows them (boots tinted in their family colour, like the 3D shop).

Run from the repo root (software GL is fine, about 1 s a picture):

```
node tools/shop2d/render_from_3d/server.mjs &          # serves on :8765
node tools/shop2d/render_from_3d/render.mjs tools/shop2d/render_from_3d/jobs.json /tmp/out
python3 tools/shop2d/render_from_3d/pack.py /tmp/out public/star/shop2d/items3d
```

`jobs.json`: one entry per picture (`url`, camera `yaw`/`elev`, `turn`,
`paint` swap, `tint`). Names ending `-ALL` become one file for every level.
