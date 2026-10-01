# Shop pictures in Blender — look-first prototype (1 Oct 2026)

This is a prototype only. Nothing here is wired into the game or committed to the repo.

## What's here

| Folder / file | What |
|---|---|
| `renders/boot-<type>-L1..L5.png` | All 7 boots (`starter` NS-Pure, `speed` NS-Flash, `power` NS-Thunder, `control` NS-Control, `elite` NS-Elite, `curl` NS-Swerve, `maestro` NS-Maestro) × 5 levels = 35 pictures. 600×450, transparent, with the floor shadow kept in the alpha channel. |
| `renders/car-L1..L5.png` | The Sports Car ladder (car-3): Rusty Kit Car, Used Coupé, Sports Car, Twin-Turbo GT, Track Racer. |
| `renders/house-L1..L5.png` | The House ladder (house-1): Terraced, Semi-Detached, Detached, Gated House, Executive Home, each shown as a small diorama. |
| `renders/300/` | The same 45 files at 300×225. |
| `compare/compare-*.png` | For each ladder, the game's current drawing (top row) above the Blender render (bottom row). Same background, same size. The drawings were rendered fresh from `BootPicture.tsx` / `StylePicture.tsx`. |
| `mockups/mockup-*-side-by-side.png` | Three phone screens at 390 px (2× pixels), now vs renders: (1) the Boots shelf, all boots swapped; (2) the Sports Car item sheet, big picture plus all 5 level thumbnails swapped; (3) the Cars tab grid, with only the Rusty Kit Car card swapped, to show what one rendered card looks like next to drawn ones. |
| `mockups/mock-*-before/after.png` | The same screens as single images. Item sheet and grid: real screenshots with the picture boxes repainted. Boots: an HTML copy of `BootShelf.tsx`'s card CSS. |
| `render-times.txt` | Seconds for each final render. |
| `scripts/` | Everything that made these. `boot.py`, `car.py`, `house.py` and `studio.py` are the Blender scripts; the rest handle compositing, the comparisons and the mock-ups. |

**Level 5 sparkles.** The four-point sparkles on the level-5 pictures are 2D, added afterwards (`post.py`). They copy the shop's existing "level 5" sign. The raw renders have none.

## How it was made
- `bpy` 4.5.14 runs as a Python module, the same set-up as `tools/blender-footballer`. The venv and renders live in `/dev/shm/blender-shop`, so they are lost on restart.
- Cycles on CPU, 64 samples, OIDN denoise, Standard view transform.
- Studio lighting: a soft key, a strip fill, a cool rim and a top box. A shadow-catcher floor gives a transparent PNG with the shadow kept.
- Camera: three-quarter view.
- Framing: cars and houses are framed to survive the game's 100:64 crop.

**Assets and licences:** none were downloaded. Every model is built in code:
- boots are lofted cross-sections;
- cars are a lofted body with wheel wells cut out;
- houses are boxes, gable prisms, Blender's built-in brick texture, and procedural trees and palms.

The only outside file is the "9" on the Track Racer, which uses the system font DejaVu Sans Bold (free licence).

There are no brand names or logos. The boot side marks are the game's own shapes from `BootPicture.tsx` (bolt, zigzag, dots, chevrons, curl, star). The cars are generic and not copied from any maker.

## Render time per picture (64 samples, 600×450, 4 CPU cores)
The machine was shared with other filming jobs at load ~14, so these times are inflated. Unloaded test renders took 17–30 s at 32–40 samples.

| Item | Count | Median | Range |
|---|---|---|---|
| Boot | 35 | 73 s | 37–137 s |
| Car | 5 | 33 s | 20–42 s |
| House | 5 | 33 s | 24–57 s |

## Not seen / not done
- None of this is in the running game. The mock-ups are composited images, not the app.
- Only 3 of the 31 Style families have a model: car-3 and house-1 here, plus the boots.

**File sizes:**
- 600×450 PNGs: 7.1 MB for all 45, about 160 KB each. As lossless WebP they would be about half that.
- 300×225 copies: 2.1 MB for all 45.
