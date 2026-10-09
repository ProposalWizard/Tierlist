#!/usr/bin/env python3
"""
THE 3D SHOP'S ROOM MAPS (look H) — public/star/shop3d/h/.

Harry, 9 Oct 2026: the shop "is dark and bare". Look H gives the room a real
floor and real wall panelling (Old keeps today's shop):

  parquet.webp / parquet-nrm.webp   Poly Haven herringbone_parquet (CC0)
  planks.webp / planks-nrm.webp     Poly Haven dark_wooden_planks (CC0)

Usage: python3 -I tools/shop3d/h_room.py SRC_DIR public/star/shop3d/h
SRC_DIR holds parquet_diff.jpg, parquet_nor_gl.jpg, planks_diff.jpg,
planks_nor_gl.jpg (the 1k JPGs). Needs Pillow.
"""
import os
import sys

from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
for name, src, size, q in [
    ("parquet.webp", "parquet_diff.jpg", 1024, 82), ("parquet-nrm.webp", "parquet_nor_gl.jpg", 512, 88),
    ("planks.webp", "planks_diff.jpg", 512, 82), ("planks-nrm.webp", "planks_nor_gl.jpg", 256, 88),
]:
    im = Image.open(os.path.join(SRC, src)).convert("RGB").resize((size, size), Image.LANCZOS)
    im.save(os.path.join(OUT, name), "WEBP", quality=q, method=6)
    print(f"{name}: {os.path.getsize(os.path.join(OUT, name)) / 1024:.0f} KB")
