"""Kit decals for the stylised-player look test: a shirt number and an invented club badge.
python3 tools/styletest/gen_tex.py <outdir>"""
import sys, glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter

out = sys.argv[1]
fonts = [f for f in glob.glob("/usr/share/fonts/**/*.ttf", recursive=True) if "Bold" in f and ("DejaVuSans" in f or "Liberation" in f)]
font_path = sorted(fonts, key=lambda f: ("Condensed" not in f, f))[0] if fonts else None
print("font", font_path)


def number(txt, fill, edge, name, size=512):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    f = ImageFont.truetype(font_path, int(size * 0.9)) if font_path else ImageFont.load_default()
    d = ImageDraw.Draw(im)
    bb = d.textbbox((0, 0), txt, font=f, stroke_width=14)
    x = (size - (bb[2] - bb[0])) / 2 - bb[0]; y = (size - (bb[3] - bb[1])) / 2 - bb[1]
    d.text((x, y), txt, font=f, fill=fill, stroke_width=14, stroke_fill=edge)
    im.save(f"{out}/{name}.png")


number("10", (255, 255, 255, 255), (232, 190, 70, 255), "num_back")
number("10", (255, 255, 255, 255), (20, 40, 110, 255), "num_shorts")

# an invented badge: a shield, white rim, navy field, gold star, a blue sash
S = 256
im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
shield = [(40, 30), (216, 30), (216, 120), (128, 230), (40, 120)]
d.polygon(shield, fill=(255, 255, 255, 255))
inner = [(56, 44), (200, 44), (200, 116), (128, 208), (56, 116)]
d.polygon(inner, fill=(18, 36, 100, 255))
d.polygon([(56, 92), (200, 60), (200, 84), (56, 116)], fill=(40, 110, 230, 255))
import math
pts = []
for i in range(10):
    r = 34 if i % 2 == 0 else 14
    a = -math.pi / 2 + i * math.pi / 5
    pts.append((128 + r * math.cos(a), 140 + r * math.sin(a)))
d.polygon(pts, fill=(240, 196, 60, 255))
im = im.filter(ImageFilter.SMOOTH)
im.save(f"{out}/badge.png")
print("ok")
