import sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, '/dev/shm/blender-shop')
from comp import on_tile
# usage: sheet.py out.png cols lv1:path lv2:path ...
out, cols = sys.argv[1], int(sys.argv[2])
items = [a.split(':', 1) for a in sys.argv[3:]]
ims = [on_tile(p, int(l)).resize((300, 225)) for l, p in items]
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * 304 + 4, rows * 229 + 4), (8, 10, 16))
for i, im in enumerate(ims):
    S.paste(im.convert('RGB'), (4 + (i % cols) * 304, 4 + (i // cols) * 229))
S.save(out)
