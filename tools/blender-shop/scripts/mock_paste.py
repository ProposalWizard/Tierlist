"""Image mock-ups: paste the renders into real shop screenshots (390px css, 2x).
The picture boxes there are plain LEVEL_TILE gradients, so each box is repainted
with its gradient, the render goes on top, and the badges/pips are copied back."""
import sys
from PIL import Image, ImageDraw
SHOTS = '/tmp/claude-0/-home-user-Tierlist/36643638-fd75-5950-83da-ee5f6b43df22/scratchpad/mikeytab/film/shop'
TILE = {1: ("#3a3f4a", "#1c2029"), 2: ("#155e75", "#0b2b36"), 3: ("#1e40af", "#111a3d"), 4: ("#6b21a8", "#2a0f45"), 5: ("#b7791f", "#4a2a06")}
hx = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def put(shot, box, lv, render, radius, inset=3, keep=(), top_only=False):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    saved = [(k, shot.crop(k)) for k in keep]
    a, b = hx(TILE[lv][0]), hx(TILE[lv][1])
    grad = Image.new('RGBA', (w, h))
    for y in range(h):
        t = y / (h - 1)
        ImageDraw.Draw(grad).line([(0, y), (w, y)], fill=tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3)) + (255,))
    # render: same 100:64 crop the game uses (aspect-[100/64], width-filling)
    r = Image.open(render).convert('RGBA')
    rw, rh = w, round(w * r.height / r.width)
    r = r.resize((rw, rh), Image.LANCZOS)
    grad.alpha_composite(r, (0, (h - rh) // 2))
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([inset, inset, w - 1 - inset, h - 1 + (radius if top_only else -inset)], radius=radius - inset, fill=255)
    shot.paste(grad.convert('RGB'), (x0, y0), mask)
    for k, im in saved:
        shot.paste(im, k[:2])

def item_sheet(car):
    s = Image.open(f'{SHOTS}/04-item-sheet-after.jpg').convert('RGB')
    put(s, (24, 529, 757, 996), 2, car(2), 32, keep=[(40, 543, 206, 583)])
    xs = [24 + i * 148.8 for i in range(5)]
    for i, x in enumerate(xs):
        put(s, (round(x), 1075, round(x + 136.8), 1165), i + 1, car(i + 1), 24, inset=4, top_only=True)
    return s

def cars_grid(car):
    s = Image.open(f'{SHOTS}/03-drawings-after.jpg').convert('RGB')
    put(s, (274, 905, 505, 1055), 1, car(1), 32, inset=3, top_only=True, keep=[(282, 911, 398, 941), (396, 1016, 500, 1050)])
    return s

if __name__ == '__main__':
    pat = sys.argv[1]  # e.g. /dev/shm/blender-shop/final/car-L{}.png
    out = sys.argv[2]
    car = lambda l: pat.format(l)
    item_sheet(car).save(f'{out}/mock-item-sheet-after.png')
    cars_grid(car).save(f'{out}/mock-cars-grid-after.png')
