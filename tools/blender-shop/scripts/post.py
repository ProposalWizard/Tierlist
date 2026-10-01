"""Finish the renders: soft sparkles on level 5 (the shop's own level-5 sign),
300x225 copies, and tight crops for the boot shelf mock."""
import os, glob, math
from PIL import Image, ImageDraw, ImageFilter
SRC = '/dev/shm/blender-shop/final'
OUT = '/dev/shm/blender-shop/deliver'
os.makedirs(OUT + '/300', exist_ok=True); os.makedirs('/dev/shm/blender-shop/shelf', exist_ok=True)

def star(d, x, y, r, fill):
    pts = []
    for k in range(8):
        a = math.pi / 4 * k - math.pi / 2
        rr = r if k % 2 == 0 else r * 0.22
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a)))
    d.polygon(pts, fill=fill)

def sparkle(im):
    w, h = im.size
    a = im.split()[3]
    spots = [(0.57, 0.15, 22), (0.88, 0.25, 30), (0.74, 0.08, 15), (0.14, 0.2, 18)]
    glow = Image.new('RGBA', im.size, (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    core = Image.new('RGBA', im.size, (0, 0, 0, 0)); c = ImageDraw.Draw(core)
    for fx, fy, r in spots:
        x, y = fx * w, fy * h
        # keep off the object itself
        box = [a.getpixel((min(w - 1, max(0, int(x + dx))), min(h - 1, max(0, int(y + dy))))) for dx in (-r, 0, r) for dy in (-r, 0, r)]
        if max(box) > 40:
            continue
        star(g, x, y, r * 1.6, (255, 236, 170, 150))
        star(c, x, y, r, (255, 251, 230, 255))
    glow = glow.filter(ImageFilter.GaussianBlur(7))
    out = im.copy(); out.alpha_composite(glow); out.alpha_composite(core)
    return out

for p in sorted(glob.glob(SRC + '/*.png')):
    name = os.path.basename(p)
    im = Image.open(p).convert('RGBA')
    if name.endswith('-L5.png'):
        im = sparkle(im)
    im.save(f'{OUT}/{name}')
    im.resize((300, 225), Image.LANCZOS).save(f'{OUT}/300/{name}')
    if name.startswith('boot-'):
        raw = Image.open(p).convert('RGBA')
        a = raw.split()[3].point(lambda v: 255 if v > 150 else 0)
        bb = a.getbbox()
        if bb:
            l, t, r, b = bb; pad = int((r - l) * 0.03)
            # drop the floor shadow (the shelf plank grounds it instead): keep only
            # the boot and a 2px antialiased rim
            keep = a.filter(ImageFilter.MaxFilter(5))
            r0, g0, b0, a0 = raw.split()
            a0 = Image.composite(a0, Image.new('L', raw.size, 0), keep)
            raw = Image.merge('RGBA', (r0, g0, b0, a0))
            raw.crop((max(0, l - pad), max(0, t - pad), min(600, r + pad), min(450, b + 2))).save(f'/dev/shm/blender-shop/shelf/{name}')
print('ok')
