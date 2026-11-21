"""Bake the stadium backdrop's blur into pictures (Stage 1 tap speed, 19 Nov 2026).

The Glass and Pitch looks used a live CSS `filter: blur(...) brightness(...)
saturate(...)` on a full-screen copy of /home/title-stadium-day.webp. The phone
redid that blur every time a screen opened. These files are the same picture
with the same filter already applied, so the CSS draws a plain image.

Run from the repo root:  python3 scripts/perf2d/bake-blur.py
CSS px -> picture px: on a phone the 752x1344 picture is drawn about 1.45x
smaller than its own size (cover on a ~400x930 screen), so blur(12px) is
about 17 picture px. The output is shrunk (4x, or 2x for the light column blur).
"""
from PIL import Image, ImageEnhance, ImageFilter

SRC = "public/home/title-stadium-day.webp"
SCALE = 1.45   # picture px per CSS px on a phone
SHRINK = 4     # blurred pictures keep their look at a quarter size

# name: (css blur px, brightness, saturate, shrink)
BAKES = {
    "title-stadium-day-glass": (12, 0.85, 1.15, SHRINK),   # glassLook.css page floor
    "title-stadium-day-pitch": (12, 0.55, 1.10, SHRINK),   # pitchLook.css page floor
    "title-stadium-day-column": (5, 0.82, 1.05, 2),        # pitchLook.css phone column (light blur: keep more detail)
}

src = Image.open(SRC).convert("RGB")
for name, (blur, bright, sat, shrink) in BAKES.items():
    w, h = src.size
    small = src.resize((w // shrink, h // shrink), Image.LANCZOS)
    im = small.filter(ImageFilter.GaussianBlur(blur * SCALE / shrink))
    im = ImageEnhance.Brightness(im).enhance(bright)
    im = ImageEnhance.Color(im).enhance(sat)
    out = f"public/home/{name}.webp"
    im.save(out, "WEBP", quality=82)
    print(out, im.size)
