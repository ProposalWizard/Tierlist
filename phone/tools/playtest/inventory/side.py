"""Stills side by side for the inventory (packed | KIB Next | ...), labelled.

    python3 side.py <out.png> <a.png> [<b.png> ...] [--labels "packed,KIB Next"]

Every picture keeps its own size (a 412x915 and a 360x780 still can sit together);
the label is written over the top-left corner of each.
"""
import sys
from PIL import Image, ImageDraw

args = sys.argv[1:]
labels = []
if "--labels" in args:
    i = args.index("--labels")
    labels = args[i + 1].split(",")
    args = args[:i] + args[i + 2:]
out, ins = args[0], args[1:]
ims = [Image.open(f).convert("RGB") for f in ins]
H = max(i.height for i in ims)
W = sum(i.width for i in ims) + 10 * (len(ims) - 1)
c = Image.new("RGB", (W, H), (255, 255, 255))
dr = ImageDraw.Draw(c)
x = 0
for k, im in enumerate(ims):
    c.paste(im, (x, 0))
    if k < len(labels):
        dr.rectangle([x, 0, x + 8 + 7 * len(labels[k]), 14], fill=(0, 0, 0))
        dr.text((x + 4, 2), labels[k], fill=(255, 255, 0))
    x += im.width + 10
c.save(out)
print(out)
