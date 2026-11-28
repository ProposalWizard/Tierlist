#!/usr/bin/env python3
"""
THE GARDEN TREES' ONE PICTURE (28 Nov 2026). Packs the three pictures the textured trees use
(public/star/garden3d/h/: leaves, needles, bark, made by h_nature.py from Poly Haven CC0 scans)
into one atlas, so every tree and bush in a zone is one material and one draw
(lib/star/garden3d/cardTrees.ts reads the layout below; change both together).

  2048 x 1024, RGBA
    x    0..1024, y 0..1024   leaves   (the broadleaf spray, as is)
    x 1024..1536, y 0..512    needles  (the fir spray, as is)
    x 1536..2048, y 0..1024   bark     (512 wide, two copies down: a trunk runs the strip once)
    x 1024..1536, y 512..1024 empty (transparent)
  trees-atlas-nrm.webp: the same layout at half size, lossless, flat everywhere but the bark strip (bark-nrm).

Usage: python3 tools/garden3d/tree_atlas.py   (needs Pillow)
"""
from pathlib import Path
from PIL import Image

H = Path(__file__).resolve().parents[2] / "public/star/garden3d/h"
W, HT = 2048, 1024

col = Image.new("RGBA", (W, HT), (0, 0, 0, 0))
nrm = Image.new("RGB", (W, HT), (128, 128, 255))

leaves = Image.open(H / "leaves.webp").convert("RGBA").resize((1024, 1024), Image.LANCZOS)
col.paste(leaves, (0, 0))
needles = Image.open(H / "needles.webp").convert("RGBA").resize((512, 512), Image.LANCZOS)
col.paste(needles, (1024, 0))
bark = Image.open(H / "bark.webp").convert("RGBA").resize((512, 512), Image.LANCZOS)
bn = Image.open(H / "bark-nrm.webp").convert("RGB").resize((512, 512), Image.LANCZOS)
for k in range(2):
    col.paste(bark, (1536, 512 * k))
    nrm.paste(bn, (1536, 512 * k))

col.save(H / "trees-atlas.webp", "WEBP", quality=88, method=6)
# lossless (the leaves must stay exactly flat), at half size (only the bark strip has any detail)
nrm.resize((W // 2, HT // 2), Image.LANCZOS).save(H / "trees-atlas-nrm.webp", "WEBP", lossless=True, method=6)
print("wrote", H / "trees-atlas.webp", H / "trees-atlas-nrm.webp")
