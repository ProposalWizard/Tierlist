"""
The cup draw's photos (public/star/cup-draw: trophy, gold confetti, stadium
floodlights) for the phone. The website lays them over the card with
mix-blend-mode: screen (they are shot on true black). The phone gets the same
picture as a see-through PNG-style WebP: alpha = the brightest channel, the
colour un-multiplied, so drawing it normally over a dark card looks the same.

    python3 phone/tools/look/make-cupdraw-pics.py      (from the repo root)
"""
import os
import numpy as np
from PIL import Image

SRC = "public/star/cup-draw"
OUT = "phone/assets/look/cupdraw"
SIZE = {"trophy": (260, 476), "confetti": (700, 468), "stadium-lights": (700, 467)}

os.makedirs(OUT, exist_ok=True)
for name, size in SIZE.items():
    im = Image.open(os.path.join(SRC, name + ".webp")).convert("RGB").resize(size, Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    alpha = a.max(axis=2)
    rgb = np.where(alpha[..., None] > 1e-4, a / np.maximum(alpha[..., None], 1e-4), 0)
    out = np.dstack([np.clip(rgb, 0, 1), alpha])
    Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA").save(os.path.join(OUT, name + ".webp"), "WEBP", quality=80, method=6)
    print(name, size)
