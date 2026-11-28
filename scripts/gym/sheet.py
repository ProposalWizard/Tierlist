"""Tile gym stills into one contact sheet: python3 scripts/gym/sheet.py out.jpg cols a.png b.png ... (each scaled to 390 wide, its name under it)."""
import sys
from PIL import Image, ImageDraw

out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
W = 390
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    im = im.resize((W, int(im.height * W / im.width)))
    ims.append((f.split("/")[-1].rsplit(".", 1)[0], im))
H = max(im.height for _, im in ims) + 24
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W, rows * H), "white")
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(ims):
    x, y = (i % cols) * W, (i // cols) * H
    sheet.paste(im, (x, y))
    d.text((x + 8, y + im.height + 4), name, fill="black")
sheet.save(out, quality=88)
print(out, sheet.size)
