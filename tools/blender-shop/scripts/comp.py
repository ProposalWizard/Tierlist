"""Put a transparent render on the shop's level tile gradient (LEVEL_TILE in StylePicture.tsx)."""
import sys
from PIL import Image
TILE = {1: ("#3a3f4a", "#1c2029"), 2: ("#155e75", "#0b2b36"), 3: ("#1e40af", "#111a3d"), 4: ("#6b21a8", "#2a0f45"), 5: ("#b7791f", "#4a2a06"), 0: ("#1f2937", "#0c111c")}
def hx(h): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
def tile(lv, size):
    a, b = hx(TILE[lv][0]), hx(TILE[lv][1]); w, h = size
    g = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / (h - 1); g.putpixel((0, y), tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3)))
    return g.resize((w, h)).convert('RGBA')
def on_tile(png, lv):
    im = Image.open(png).convert('RGBA'); bg = tile(lv, im.size); bg.alpha_composite(im); return bg
if __name__ == '__main__':
    on_tile(sys.argv[1], int(sys.argv[2])).convert('RGB').save(sys.argv[3])
