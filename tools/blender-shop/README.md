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

## v0.23.1 (Harry and Mikey's review of v0.23)
- **House-1 level 1** is now one small, tired two-up-two-down with a yard (it was a row of three big houses: "quite big. That should be the starter house", P52). Box Room (`flat-1` L1) and Shared Flat (`flat-2` L1) were trimmed to 2 and 3 floors for the same reason.
- **Boots shelf** (BootShelf.tsx): the picture stands at 72% of the card (it was 100%, so a boot was almost as wide as its card, "size 18", P55), and the 35 boot WebPs had the hard edge of the floor shadow softened (`shadow` pixels faded 16% in from each edge) so a smaller picture shows no box.
- **Redone**: suit (all 5: a jacket on a display form with sleeves, lapels, tie/bow tie, pocket square, pinstripe / tweed / gold thread), silver (chunky links, sized per level, a stone on every link at L5), diamond (a real display bust; the stones are a grey-blue mid tone with medium gloss, so they keep their facets and no longer clip to white; riviera necklace, collar), and the whole **stable ladder** with proper horses (`horses.py`: lofted body, neck and head, jointed legs, mane, tail, ears, eyes; five coats; stand / graze / trot poses; tighter paddocks so the horses read at 400 px).
- **Store pictures** (`store.py`, `public/shop/store/`): 6 coin packs, 2 boosts (Training Boost, Stat Can), 10 accessories and 3 accessory boots (`acc-<id>.webp`). The Store page (components/star/store/StoreView.tsx) uses them where a picture exists today and falls back to the old drawing if one won't load; the Boots tab now shows the same boot renders as the shop shelf. Celebrations and the run-up animation cards stay as they are (a pose and an animated sketch, not objects). Same studio, same 400x300 WebP.
- `drip.py` gem material fixed; `run.py` can frame on the jewellery only (`frame_parts`).

## Not seen / known soft spots
- Horses are stylised (no rider, one pose per level); the three celebrations in the Store have no render.
- Level pictures inside one family were checked on contact sheets; the in-game crop was checked on the Style grid, item sheet and boots shelf only.

## Top-bar icons (v0.24)
Harry, 2 Oct (P1-37, P1-38): a 3D icon sits ABOVE each top bar, as an overlay.
| File | What | Bar |
|---|---|---|
| `public/icons3d/energy.png` | yellow lightning bolt | Energy |
| `public/icons3d/world.png` | small Earth with clouds | Reputation ("world") |
| `public/icons3d/fame.png` | gold crown with stones | Fame |
| `public/icons3d/happiness.png` | yellow smiley, no cheeks (redone 2 Oct: "cleaner and more polished") | Happiness |
| `public/icons3d/heart.png` | pink heart (spare) | — |
| `public/icons3d/money.png` | gold coin with a raised ★ | Money |
| `public/icons3d/star-full.png`, `star-empty.png` | gold star and grey star, same shape and framing | Star rating: draw the grey one, then the gold one clipped from the bottom to the % through the level |

- 256x256 PNG, transparent, no floor shadow. All about 18-73 KB.
- Script: `scripts/icons3d.py -- <name> <out.png> [samples] [size]`. Rendered at 512, 32 samples, then scaled to 256 (LANCZOS).
- One style: "puffy" extruded outlines (bolt, star, heart) and glossy round shapes, turned a little left so the thickness shows, lit by `studio.py`.
