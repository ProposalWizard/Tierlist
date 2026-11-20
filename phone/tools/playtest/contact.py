"""Contact sheet of chosen pairs:  python3 contact.py <dir> <out.jpg> <name> [<name> ...]
Each <name>-pair.jpg (pair.py) is placed in a 3-column grid with a caption."""
import sys, os
from PIL import Image, ImageDraw
d, out, names = sys.argv[1], sys.argv[2], sys.argv[3:]
ims = [Image.open(os.path.join(d, f"{n}-pair.jpg")).convert("RGB") for n in names]
cw = max(i.width for i in ims)
ch = max(i.height for i in ims)
cols = 3
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (cw + 12) + 12, rows * (ch + 30) + 40), (14, 14, 14))
dr = ImageDraw.Draw(sheet)
dr.text((12, 12), "Worst 12 differences: left of each pair = packed app (reference), right = KIB Next. 412x915 unless named.", fill=(255, 255, 255))
for k, (n, im) in enumerate(zip(names, ims)):
    x = 12 + (k % cols) * (cw + 12)
    y = 40 + (k // cols) * (ch + 30)
    dr.text((x, y), f"{k + 1}. {n}", fill=(255, 220, 80))
    sheet.paste(im, (x, y + 16))
sheet.save(out, quality=82)
print(out, sheet.size)
