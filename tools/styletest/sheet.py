"""Joins the look-test stills: <opt>/pitch.png (in-game camera + close-up) and sheet.jpg (A–D side by side).
python3 tools/styletest/sheet.py <style-test dir>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1]
NAMES = {"A": "A  Cel-shaded", "B": "B  Spider-Verse", "C": "C  Stylised PBR", "D": "D  Realistic + textured kit"}
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf", 22)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf", 15)
opts = [o for o in "ABCD" if os.path.exists(f"{D}/{o}/shop.png")]
for o in opts:
    w, c = Image.open(f"{D}/{o}/wide.png"), Image.open(f"{D}/{o}/close.png")
    p = Image.new("RGB", (w.width + c.width + 12, w.height), (16, 16, 20)); p.paste(w, (0, 0)); p.paste(c, (w.width + 12, 0))
    p.save(f"{D}/{o}/pitch.png")
TW, TH, G = 240, 427, 8
sheet = Image.new("RGB", (len(opts) * (TW + G) + G, 3 * (TH + G) + 44 + G), (16, 16, 20))
d = ImageDraw.Draw(sheet)
for i, o in enumerate(opts):
    x = G + i * (TW + G)
    d.text((x + 4, 10), NAMES[o], font=font if len(NAMES[o]) < 18 else small, fill=(255, 255, 255))
    for j, s in enumerate(("wide", "close", "shop")):
        im = Image.open(f"{D}/{o}/{s}.png").convert("RGB").resize((TW, TH), Image.LANCZOS)
        sheet.paste(im, (x, 44 + j * (TH + G)))
sheet.save(f"{D}/sheet.jpg", quality=88)
print("sheet", sheet.size, opts)
