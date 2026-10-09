#!/usr/bin/env python3
"""
THE 3D CASINO'S ROOM MAPS (Settings -> Look -> "Casino look: New") —
public/star/casino3d/h/.

Harry, 9 Oct 2026: the casino's walls and floor were plain colour. New gives:

  wall-nrm.webp               Poly Haven quatrefoil_jacquard_fabric (CC0), normal
                              map only: the woven damask on the upper red walls
  pile-nrm.webp               Poly Haven velour_velvet (CC0), normal map only:
                              the carpet's pile under its painted pattern

Usage: python3 -I tools/casino3d/h_room.py SRC_DIR public/star/casino3d/h
SRC_DIR holds the 1k JPGs (<name>_diff.jpg, <name>_nor_gl.jpg). Needs Pillow.
"""
import os
import sys

from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
for name, src, size, q in [
    ("wall-nrm.webp", "quatrefoil_jacquard_fabric_nor_gl.jpg", 512, 88),
    ("pile-nrm.webp", "velour_velvet_nor_gl.jpg", 256, 88),
]:
    im = Image.open(os.path.join(SRC, src)).convert("RGB").resize((size, size), Image.LANCZOS)
    im.save(os.path.join(OUT, name), "WEBP", quality=q, method=6)
    print(f"{name}: {os.path.getsize(os.path.join(OUT, name)) / 1024:.0f} KB")
