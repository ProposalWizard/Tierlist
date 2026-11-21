"""Bake the menu shop's background (RUL-UI-010, Harry 19 Nov 2026: "G1", navy).

The menu shop (components/star/shop/MenuShop.tsx) sits on the 3D store still,
blurred, under a navy tint. A live CSS blur is redone at every screen change
(the tap-speed work, scripts/perf2d/bake-blur.py), so the blur AND the navy
tint are baked into one small picture here and the page draws a plain image.

The tint is the approved draft's:
  linear-gradient(180deg, rgba(10,30,70,.55), rgba(5,14,36,.8))
painted top to bottom over the blurred store. The store still is wider than a
phone, so `cover` fills the screen's height: the gradient's top and bottom are
the picture's top and bottom.

Run from the repo root:  python3 scripts/perf2d/bake-shop-bg.py
"""
from PIL import Image, ImageFilter

SRC = "public/star/area3d/shop3d.jpg"
OUT = "public/star/shop/bg-store-navy.webp"
SHRINK = 4      # a heavy blur keeps its look at a quarter size (640x808 -> 160x202)
BLUR = 5        # px at the shrunk size (about 20 px on the full picture)
TOP = (10, 30, 70, 0.55)
BOTTOM = (5, 14, 36, 0.80)

src = Image.open(SRC).convert("RGB")
w, h = src.size
im = src.resize((w // SHRINK, h // SHRINK), Image.LANCZOS)
# Pad before blurring so the edges do not go dark, then crop back.
pad = BLUR * 3
big = Image.new("RGB", (im.width + pad * 2, im.height + pad * 2))
big.paste(im.resize((im.width + pad * 2, im.height + pad * 2), Image.LANCZOS))
big.paste(im, (pad, pad))
im = big.filter(ImageFilter.GaussianBlur(BLUR)).crop((pad, pad, pad + im.width, pad + im.height))

# The navy tint, top to bottom (source-over, as the CSS gradient would draw).
px = im.load()
for y in range(im.height):
    t = y / max(1, im.height - 1)
    r, g, b, a = (TOP[i] + (BOTTOM[i] - TOP[i]) * t for i in range(4))
    for x in range(im.width):
        R, G, B = px[x, y]
        px[x, y] = (round(R * (1 - a) + r * a), round(G * (1 - a) + g * a), round(B * (1 - a) + b * a))

im.save(OUT, "WEBP", quality=84)
print(OUT, im.size)
