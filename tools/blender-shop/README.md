# Shop pictures in Blender (1 Oct 2026)

Every picture in the shop is a Blender render. Harry, on the first test renders
(P56-P57): "Oh damn, you have done it. That's so much better ... Do them all
like this ... Don't do an in-between." So there is no mix of drawings and
renders: all 31 Style families (155 level pictures, the phone is now one) and
all 7 boots (35 pictures) are rendered here. The game shows them from
`public/shop/*.webp`; the old SVG drawings in `StylePicture.tsx` /
`BootPicture.tsx` are only the fallback if an image fails to load.

## What ships
| Where | What |
|---|---|
| `public/shop/<family>-L<1..5>.webp` | Style pictures. `<family>` is the `baseId` (`car-3`, `house-1`, `phone` ...). The phone is one item, so only `phone-L1.webp` exists. |
| `public/shop/boot-<type>-L<1..5>.webp` | Boots (`starter speed power control elite curl maestro`). |
| size | 400x300, WebP quality 82, about 10-25 KB each, total under 3 MB. |
| level 5 sparkles | NOT in the images. `StylePicture` draws them over the render (`Sparkles`), in the top-middle / right-edge spots that stay clear of the "Level 5 of 5" and "YOURS" badges. |
| framing | The game shows the image in a 100:64 box with `slice` (like `object-fit: cover`), so the top and bottom 7.5% can be cropped. Every render keeps its subject inside the middle 85%. |

## Families (31) and what each level is
Level names are in `lib/star/lifestyleLevels.ts`. Script = which file builds it.

| Group | Families (script) |
|---|---|
| Drip | suit, silver (chains), gold (watch), rolex (watch), diamond (necklaces), art (`drip.py`) |
| Gadgets | phone (one picture), console, headphones, music, tablet, smartwatch, tv, gaming-pc (`gadgets.py`) |
| Cars | bike (`bikes.py`), car-1, car-2, suv, car-3 (`car.py`), classic, car-4 (`cars.py`) |
| Homes | flat-1, flat-2, penthouse (`homes_a.py`), house-1 (`house.py`), house-2, estate (`homes_b.py`), stable (`homes_c.py`) |
| Holiday | jet (`jets.py`), villa and island (`homes_c.py`) |
| Boots | all 7 (`boot.py`) |

## How they are made
- `bpy` 4.5.14 as a Python module in a venv in `/dev/shm/blender-shop` (lost on restart; recreate with `python3 -m venv venv && venv/bin/pip install bpy==4.5.14 pillow numpy`, outside the repo). `export LD_LIBRARY_PATH=<venv>/lib` before running.
- Cycles on CPU, 32 samples + OpenImageDenoise, Standard view transform, 600x450 masters with a transparent background and the floor shadow kept in alpha.
- One studio for everything (`studio.py`): soft key, strip fill, cool rim, top box, shadow-catcher floor, three-quarter camera, the camera framed to the subject (`frame_objects`).
- Everything is modelled in code. No downloaded assets, no brands or logos. The only outside file is the system font DejaVu Sans Bold (free licence) for racing numbers. Screens, paintings and watch faces are small images drawn with PIL at render time (`tex.py`).
- Run one picture: `python run.py -- <family> <level> out.png [samples] [w h]` (cars, bikes, jets, homes, gadgets, drip). Boots, car-3 and house-1 keep their own scripts: `boot.py -- <type> <level> out.png`, `car.py -- <level> out.png`, `house.py -- <level> out.png`.
- Low-quality 5-level preview of a family: `prev.sh <family>` then `python sheet2.py <family>`; contact sheet of finals: `python fsheet.py <family> ...`.
- Whole batch: put `family level` lines in `queue.txt` and run `queue.sh` (renders to `final/`, `nice`, 2 threads, waits if memory is short). `convert.py` turns `final/*.png` into the shipped WebP.
- Time on a shared 4-core machine, 2 threads at `nice 19`: 22-62 s per picture, about 40 s on average.

## Files
| File | What |
|---|---|
| `studio.py` | lights, camera, floor, materials, loft builder (shared). New: `THREADS` env for the thread count. |
| `kit.py` | boxes, cylinders, spheres, tori, tubes, gems, text, screens. |
| `tex.py` | PIL pictures for screens, watch faces and paintings. |
| `run.py` | one-picture entry point for the families above. |
| `cars.py` | car-1, car-2, suv, classic, car-4 (an extended `car.py`: wheel counts, lift, open tops, plinth, wire wheels). |
| `bikes.py`, `jets.py`, `gadgets.py`, `drip.py` | those families. |
| `homes_common.py`, `homes_a.py`, `homes_b.py`, `homes_c.py`, `homes.py` | the dioramas: procedural window walls, towers, grand houses, castle, stables with horses, beach villas, islands. |
| `boot.py`, `car.py`, `house.py`, `comp.py`, `post.py`, `compare.py`, `mock_*`, `sheet.py`, `shot*.mjs`, `render.cjs`, `data.cjs`, `run_*.sh` | the first 45 pictures and their comparison / mock-up tooling (earlier round). |
| `queue.sh`, `queue2.sh`, `convert.py`, `prev.sh`, `sheet2.py`, `fsheet.py` | batch helpers. |

The `compare/` and `mockups/` folders and `renders/300/` are from the first test round (drawings vs renders). The 45 renders in `renders/300/` were re-rendered at the new settings and replaced in `public/shop/`.

## Not seen / known soft spots
- Horses are simple (barrel body, tube legs); jewellery stones are flat-shaded cut stones that blow out to white at 400 px.
- Level pictures inside one family were checked on contact sheets; the in-game crop was checked on the Style grid, item sheet and boots shelf only.
