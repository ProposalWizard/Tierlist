# Knowitball 3D footballer (Blender, v2)

Saved here from the session scratchpad on 28 Sep 2026. See it on the test page
**/star-blender-dev** ("Blender 3D", linked from the Play Area and the admin menu).

What is in this folder, and what isn't:

| Kept here | Not kept (and how to get it back) |
|---|---|
| `scripts/` — build, render, recolour, pack, mock-up | `assets/` — the CC0 pack: `fetch_assets.sh` (download link inside) |
| `footballer.blend` (17 MB, editable, 3 actions) | `layers/`, `frames/` — re-render with `scripts/run_all.sh` |
| `NOTES.md`, `LICENSE-Quaternius-UBC.txt`, `assets.sha256` | the frame zips (5–7 MB each) and the sheets — re-made by `deliver.py` |

The browser pictures are in `public/star/blender/` (layer packs for the idle
hero and the 5 stills, the 3 clips as mp4 + webm, `hair.jpg`, the mock-up), made
by `scripts/webpack.py`. The page's recolour is `lib/star/blenderRecolour.ts`
(tested in `tests/star/blenderRecolour.mts`).

## What it's built from
- **Body, face, eyes, eyebrows and the hair meshes:** Quaternius, *Universal Base Characters* (Standard, free edition), model `Superhero_Male_FullBody` (rigged, UE-style skeleton with 65 bones and fingers).
  - Licence: **CC0 1.0** (public domain), stated in `assets/ubc/License_Standard.txt`.
  - Source: https://quaternius.com/packs/universalbasecharacters.html, downloaded from https://quaternius.itch.io/universal-base-characters (the free "Standard" zip).
  - No photo face: it's a modelled, textured game head. Two skin textures ship with it (Dark and Light), and `skin='medium'` is a shader brightening of Dark, which gives 3 tones.
- **Built in code (`scripts/fb.py`), not downloaded:** everything else.
  - The kit: shirt with a V-neck and short sleeves, shorts, socks with a turned-over band, boots with a sole and flash.
  - The ball, the lights, the poses and clips, the crest and number decals, and the render layers.

### How the kit is made
Each garment is cut from the skinned body mesh, so it keeps the rig weights and deforms with the body. Each one is then:
- welded at the UV seams;
- sliced with planes for straight hems and cuffs;
- pushed out, Laplacian-smoothed and shrink-wrapped outside the skin;
- given a solidify and subdivision modifier.

Skin that is well inside the cloth is masked out, so it can't poke through. Seams, trims and the sock band are **shader masks driven by a stored rest-pose attribute**, which gives clean lines that stay glued to the cloth in animation.

## Hair (Harry: "everyone can't be bald")
There are 4 styles and 3 colours; see `hair.jpg`. The approach is a hybrid:

| Style | Technique |
|---|---|
| Buzz cut | Sculpted hair-card mesh from the CC0 pack, rigged to the Head bone |
| Short crop (side part) | Same technique (the pack's `Hair_SimpleParted`) |
| Curly / afro | **Real curve hair**: about 36k particle strands with curl kink, grown from the buzz-cut cap, rendered as Cycles round curves with the Principled Hair BSDF (melanin model) |
| Long | The pack's `Hair_Long` card mesh over the buzz cap |

- **Colours:** black, brown and blonde.
  - Card meshes use a luminance-keeping tint of the pack's strand texture.
  - Strands use melanin and redness values.
  - Eyebrows follow the hair colour.
- **Code:** `fb.add_hair(arm, style, colour)`; to use it, pass `style=` / `colour=` to `build_scene`.
- **Weak spots, stated plainly:**
  - The pack's **Long** style has a curtain-like fringe that reads feminine.
  - I tried a swept-back curve-hair style, but it wasn't good enough in the time, so I removed it. A proper medium swept style needs a hand-groomed curve set.
  - The afro is the costliest head to render: about 46 s at 360×414 and 32 samples, against 18–40 s for the others.
- **What was rendered with which hair:** the stills, the three clips and the .blend all use the pack crop in dark brown (the original look). The hero, the mock-up and `compare.jpg` use the new hair system (crop, brown).

## Recolouring: one render set covers every club
Each pose or frame is rendered **once** with every kit panel in neutral grey (albedo 0.5). Alongside it, the render writes these layers:
- `shade`: the diffuse light the cloth received (DiffDir+DiffInd, OIDN-denoised in the compositor, stored /4, sRGB 16-bit);
- `kitA`: antialiased masks for shirt, sleeves and shorts (from shader AOVs);
- `kitB`: masks for socks, trim and sock band;
- `crest` and `num`: **(u, v, coverage)** of a decal patch on the left chest and on the right shorts leg.

The recolour step (`scripts/recolour.py`, numpy + Pillow) works in linear light on premultiplied values:

```
out = beauty + shade * Σ mask_r * (club_r − 0.5)
```

The crest and number are looked up per pixel in any image through the stored UVs. That makes them perspective-correct, and they follow the body in every animation frame.
- Clubs are defined in `CLUBS` (Chelsea, Arsenal, Liverpool).
- Badges are generic text roundels ("CHE"); no real club marks are used.

## Deliverables
| File | What |
|---|---|
| `stills.jpg` | idle, arms-up, knee slide, pointing at badge, hands on hips (Chelsea), 512×768 each |
| `clubs.jpg` | the idle pose from ONE render set, recoloured Chelsea / Arsenal / Liverpool |
| `hair.jpg` | 4 hair styles in brown, plus the short crop in 3 colours |
| `anim-idle.mp4` | 2.0 s breathing loop, played 3× (6 s), 24 fps, H.264 High, yuv420p, faststart, 235 KB |
| `anim-celebrate.mp4` | 2.0 s crouch, jump, arms-up and land, plus a 0.5 s hold, 206 KB |
| `anim-kneeslide.mp4` | 2.5 s slide in, arch back and fist pump, plus a 0.5 s hold, 159 KB |
| `frames/*_rgba_png.zip` | the Chelsea frames as RGBA PNG with alpha (the ground shadow is in the alpha), 5–7 MB each |
| `mockup-home.png` | the 1024×1536 idle hero placed into the A2 home screen |
| `compare.jpg` | A2 next to the new 3D, same crop |
| `footballer.blend` | an editable scene with actions `IDLE_LOOP`, `CELEBRATE_JUMP` and `KNEESLIDE_ANIM` (17 MB); textures are relative to `assets/` |
| `layers/` | every neutral render set (the input to recolouring), 82 MB |

In the mock-up, the A2 figure is erased first. Its box is filled by row-wise normalised convolution plus the dot-grid detail, copied a whole number of dot periods (21 px) away, so there are no streaks.

## Render times (CPU, 4 cores, Cycles with OIDN, adaptive sampling)
| Render | Resolution and samples | Time |
|---|---|---|
| Stills | 512×768, 40 samples | **about 14 s each** (21 s for the first, which builds the BVH) |
| Animation frames | 512×768, 16 samples | **7.6 s** (idle), **8.4 s** (celebrate), **10.1 s** (knee slide) per frame, **156 frames in 23 min** |
| Hero | 1024×1536, 64 samples | **248 s** |
| Hair heads | 360×414, 32 samples | 18–46 s |

The recolour step takes about 1 s per 512×768 frame in numpy, and would be faster on a canvas or a GPU.

## Re-rendering
Everything below runs from `tools/blender-footballer/`.
```
bash fetch_assets.sh "path/to/Universal Base Characters[Standard].zip"   # see the link inside
python3 -m venv venv && ./venv/bin/pip install --no-cache-dir bpy==4.5.14 tbb av pillow numpy   # 1.1 GB
export LD_LIBRARY_PATH=venv/lib
./scripts/run_all.sh                                   # 5 stills + 3 clips  (≈ 25 min)
SETPREFIX=hero_ HAIRSTYLE=crop ./venv/bin/python scripts/render_layers.py -- stills 1024 64 IDLE
./venv/bin/python scripts/deliver.py stills|clubs|anims|mockup   # mockup needs A2_SCREENSHOT=<A2 home screen png>
./venv/bin/python scripts/hairgrid.py -- buzz:brown,crop:brown,afro:brown,long:brown,crop:black,crop:blonde 360 32 work/hair
PYTHONPATH=scripts ./venv/bin/python scripts/hairsheet.py
# the page's files (idle hero halved to 512x768):
for s in idle celebrate kneeslide point hips; do python3 scripts/webpack.py layers/still_$s 1 ../../public/star/blender/layers/$s; done
python3 scripts/webpack.py layers/hero_idle 1 ../../public/star/blender/layers/hero --half
```

Where things live:
- Poses are in `scripts/poses.py`: FK in rest-axis degrees, plus IK for the foot on the ball, hands on hips and the pointing arm.
- Clips are in `scripts/anims.py`.
- Cameras are in `render_layers.py`.

A gotcha: don't name a script `inspect.py`, because it shadows the stdlib module and bpy crashes.

## How it would go into the game

### (a) Pre-rendered sprites, recoloured in the browser (fits today)
Per pose or frame, ship 6 small files (`scripts/webpack.py`; the older 5-file `gamepack.py` layout kept data in PNG alpha channels, which a browser canvas destroys — see below):
- `base.webp`: RGBA, lossless;
- `light.webp`: RGB, lossless;
- `kitA.png`: shirt, sleeves, shorts (RGB, linear coverage);
- `kitB.png`: socks, trim, sock band;
- `crest.png` / `num.png`: that decal's u, v and coverage.

**Two browser gotchas, both hit and fixed on the test page (28 Sep):**
1. A canvas stores pixels premultiplied, so any data kept in an alpha channel is wiped wherever alpha is 0. Only the picture's own alpha is in an alpha channel now.
2. The masks are stored LINEAR. Decoding them as sRGB under-covers every soft edge and left a pale square round the crest.

The page measured **130–215 ms** to recolour all six 512×768 packs on the filming machine (headless Chromium, one pick).

A canvas `getImageData` pass does the formula above with the club's colours, crest image and shirt number. It runs once per club and is then cached, so it is not per frame and not a render loop.

I checked the 8-bit pack against the 16-bit path at **44.8 dB PSNR**, which is visually identical. Lossy WebP for base/light blocks up after recolouring (29.7 dB), so keep those two lossless.

Sizes at 512×768:

| Item | Size |
|---|---|
| Layer pack per frame | **≈149 KB** |
| A baked single-club frame (WebP q88) | ≈38 KB |
| All 5 stills as layer packs | ≈0.75 MB, covering every club |
| All 156 animation frames as layer packs | ≈23 MB, covering every club |
| The same frames baked | ≈6 MB per club, so ≈600 MB for 100 clubs |

The phone hero is shown at about 300 px wide, so 256×384 sprites cut all of these by about 4× (a still pack is ≈40 KB). The short H.264 clips (160–240 KB for 2–2.5 s) suit fixed cut-scenes, but can't be recoloured unless you use the PNG layers.

This route adds no canvas animation loop: the recolour is a one-off pixel pass, and playback is a timed `<img>` swap or `<video>`. So it most likely passes `scripts/one-engine-guard.mjs` as-is. I haven't run the guard to confirm.

### (b) Future: real-time 3D in the browser (three.js / GLB)
- **Weight:** the rigged body, kit and 3 clips as a GLB would be about 3–5 MB. The body is 7.3k verts and the textures are 2k PNGs; with KTX2 textures and 1k maps it would be about 1.5–2.5 MB. Recolouring then happens in the shader, and hair is a mesh swap. Curve-hair afros would need baking to cards first.
- **Guard:** three.js runs its own `requestAnimationFrame` render loop, which `scripts/one-engine-guard.mjs` blocks ("a new canvas animation loop"). So (b) needs **Harry's explicit OK and a guard exemption**; route (a) needs neither.

## What's left before it's game-ready
- **Shirt fit:** the shirt still hugs the physique (pecs and abs show through). A proper cloth sim or a hand-sculpted looser shirt would read more like a real kit. Raised arms pull the shirt side up a little.
- **Crest:** it's small (8.5 cm) and slightly creased by the fold; a real club crest image drops straight in.
- **Hair:** add a hand-groomed medium swept style. Hair colour could become a recolour mask too, like the kit.
- **Animation:** the clips are hand-keyed and short; a CC0 mocap set would add a run-up to the slide.
- **Mock-up:** the figure sits a touch darker than A2's glow-outlined cut-out. A rim glow or outline layer would match the card's style.
