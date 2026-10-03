# 3D cutscenes in Blender (v0.24)

> **The signing scene is now live 3D** (v0.25): three.js in the browser, built
> from `tools/signing3d/build_assets.py` and `lib/star/signing3d{Scene,Rig,Textures}.ts`.
> The pictures this script made are no longer shipped. `match_look.py` is still in use.

Seen on the site in the **3D Test Area** (`/star-3d-area-dev`).

| Script | What it makes | Where it goes |
|---|---|---|
| `signing.py` | The signing scene: the manager's office, you and the manager at the desk, 5 camera beats (talk, reply, contract, signing, signed) | `public/star/signing3d/<beat>-<skin>.webp`, shown by `/star-3d-area-dev/signing` |
| `match_look.py` | The Blender footballer from the 2D match's high camera, two kits, two poses (a proposal for Harry P2-74) | `public/star/area3d/match-sprite-*.png`, plus the before/after still |

## How the signing scene is built
- Built on `tools/blender-footballer/scripts/fb.py`: the CC0 Quaternius body, the modelled kit and hair. That folder's `assets/` must be in place (`fetch_assets.sh`).
- **You:** the footballer in a white/navy home kit. Skin tone comes from `TONES` (the pack's own Light/Dark maps are only a few shades apart). Hair follows the tone (`LOOKS`). `ACCESSORY=headband` puts the store's headband on him, placed in the head bone's frame.
- **The manager:** a second body from the same pack. Grey buzz cut and beard, glasses placed on his eyes, a navy suit cut from his body like the kit (white shirt, red tie and lapels are shader masks). A modelled face, never a photo (P49).
- **The room:** all modelled in code. The view out of the window is a crop of the generated `public/star/signing3d/room-golden-hour.webp`, which also set the light (low gold sun behind him, warm lamps inside).
- **The contract:** drawn with PIL (`paper_png`), turned to face you. The terms are a fixed sample (Enfield Town, 2 seasons, 35 a week, #39).

## Run
```
export LD_LIBRARY_PATH=<venv>/lib THREADS=3          # venv as in tools/blender-shop/README.md
python signing.py -- medium all out 24 600 750
ACCESSORY=headband python signing.py -- dark all out 24 600 750
python match_look.py -- out/match 24 256
```
- Time on the shared 4-core sandbox: 50-170 s per beat at 600x750, 24 samples (the machine was busy). Scene build about 40 s.
- Then turn the PNGs into WebP (quality 82) into `public/star/signing3d/`, and re-run `node scripts/assets3d-manifest.mjs`.

## Known soft spots
- Both men have the pack's "superhero" build: the suit and the shirt show it.
- The pen is placed near the right hand, not held by fingers keyed to grip it.
- No handshake (the free moves have none; it needs keying by hand).
- The terms are baked into the paper. For the game they would be page text over the paper, or rendered per offer.
