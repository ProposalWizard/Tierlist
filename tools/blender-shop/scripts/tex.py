"""Procedural pictures for screens and canvases (made with PIL at render time, nothing downloaded)."""
import os, math, random
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
D = '/dev/shm/blender-shop/tex'
os.makedirs(D, exist_ok=True)


def grad(w, h, c0, c1, c2=None, vertical=True):
    t = np.linspace(0, 1, h if vertical else w)[:, None] if vertical else np.linspace(0, 1, w)[None, :]
    a = np.array(c0, float); b = np.array(c1, float)
    if c2 is None:
        arr = a * (1 - t[..., None]) + b * t[..., None]
    else:
        c = np.array(c2, float)
        arr = np.where(t[..., None] < 0.5, a * (1 - 2 * t[..., None]) + b * 2 * t[..., None], b * (2 - 2 * t[..., None]) + c * (2 * t[..., None] - 1))
    if vertical:
        arr = np.repeat(arr, w, axis=1)
    else:
        arr = np.repeat(arr, h, axis=0)
    return Image.fromarray(arr.astype('uint8')).convert('RGB')


def rr(d, box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)


def phone_screen(kind, name):
    p = f'{D}/{name}.png'
    w, h = 360, 780
    if kind == 'old':
        im = Image.new('RGB', (w, h), (150, 170, 120)); d = ImageDraw.Draw(im)
        for k in range(4):
            d.rectangle((30, 60 + k * 60, 30 + 200 - k * 20, 90 + k * 60), fill=(40, 52, 36))
    elif kind == 'flip':
        im = Image.new('RGB', (w, h), (20, 40, 60)); d = ImageDraw.Draw(im)
        d.rectangle((20, 20, 340, 200), fill=(80, 190, 235))
        for k in range(5): d.rectangle((40, 240 + k * 80, 320, 290 + k * 80), fill=(235, 240, 245))
    elif kind == 'one':
        im = grad(w, h, (47, 70, 216), (14, 165, 233)); d = ImageDraw.Draw(im)
        d.polygon([(0, h * 0.62), (w * 0.5, h * 0.52), (w, h * 0.66), (w, h), (0, h)], fill=(20, 150, 215))
        tiles = [(52, 211, 153), (96, 165, 250), (244, 114, 182), (251, 191, 36), (167, 139, 250), (251, 113, 133), (34, 211, 238), (249, 115, 22), (74, 222, 128), (232, 121, 249), (56, 189, 248), (250, 204, 21)]
        for k, c in enumerate(tiles):
            rr(d, (34 + (k % 3) * 108, 130 + (k // 3) * 112, 34 + (k % 3) * 108 + 86, 130 + (k // 3) * 112 + 86), 24, c)
        rr(d, (w / 2 - 40, h - 26, w / 2 + 40, h - 16), 5, (240, 244, 255))
    else:
        top, bot = {'sm': ((255, 120, 90), (60, 40, 150)), 'pro': ((20, 200, 220), (30, 20, 100)), 'gold': ((255, 205, 90), (120, 40, 60))}[kind]
        im = grad(w, h, top, bot, (200, 80, 160) if kind != 'gold' else (240, 130, 60)); d = ImageDraw.Draw(im)
        for r in range(5):
            for c in range(4):
                rr(d, (28 + c * 80, 150 + r * 100, 28 + c * 80 + 62, 150 + r * 100 + 62), 16, tuple(int(x) for x in np.random.RandomState(r * 4 + c).randint(80, 255, 3)))
        rr(d, (60, 30, 300, 60), 14, (10, 10, 12))
        rr(d, (20, 690, 340, 760), 30, (250, 250, 255))
    if kind == 'flip':
        im = im.rotate(90, expand=True)
    im.save(p); return p


def tv_screen(name, w=960, h=540, mood='day'):
    p = f'{D}/{name}.png'
    top, bot = ((90, 170, 255), (255, 200, 120)) if mood in ('day', 'smart') else ((20, 20, 70), (255, 100, 60))
    im = grad(w, h, top, bot); d = ImageDraw.Draw(im)
    # a pitch with players: green strip + little figures
    d.rectangle((0, int(h * 0.55), w, h), fill=(40, 140, 60))
    for k in range(0, w, 80):
        d.rectangle((k, int(h * 0.55), k + 40, h), fill=(48, 156, 70))
    d.ellipse((w / 2 - 70, h * 0.62, w / 2 + 70, h * 0.88), outline=(255, 255, 255), width=4)
    random.seed(4)
    for k in range(10):
        x = random.randint(100, w - 100); y = random.randint(int(h * 0.58), int(h * 0.9))
        d.ellipse((x - 8, y - 22, x + 8, y - 6), fill=(240, 220, 200)); d.rectangle((x - 9, y - 6, x + 9, y + 16), fill=(220, 40, 40) if k % 2 else (40, 80, 220))
    d.rectangle((0, h - 46, w, h), fill=(10, 10, 20)); d.rectangle((20, h - 36, 200, h - 12), fill=(250, 200, 40))
    if mood == 'smart':
        d.rectangle((0, int(h * 0.62), w, h), fill=(12, 14, 26))
        cols = [(229, 57, 53), (67, 160, 71), (30, 136, 229), (253, 216, 53), (142, 36, 170), (255, 112, 67), (0, 172, 193)]
        for k in range(7):
            d.rounded_rectangle((30 + k * 130, int(h * 0.7), 30 + k * 130 + 110, int(h * 0.7) + 130), radius=18, fill=cols[k])
    im.save(p); return p


def laptop_screen(name, w=960, h=600):
    p = f'{D}/{name}.png'
    im = grad(w, h, (30, 20, 80), (200, 60, 120)); d = ImageDraw.Draw(im)
    d.polygon([(0, h * 0.7), (w * 0.3, h * 0.45), (w * 0.55, h * 0.65), (w * 0.8, h * 0.4), (w, h * 0.6), (w, h), (0, h)], fill=(15, 12, 40))
    d.ellipse((w * 0.7, h * 0.12, w * 0.7 + 110, h * 0.12 + 110), fill=(255, 220, 140))
    im.save(p); return p


def painting(kind, name, w=600, h=760):
    p = f'{D}/{name}.png'
    rs = np.random.RandomState({'poster': 1, 'print': 2, 'orig': 3, 'gallery': 4, 'master': 5}[kind])
    if kind == 'poster':
        im = grad(w, h, (255, 190, 70), (230, 60, 90), (120, 40, 140)); d = ImageDraw.Draw(im)
        d.ellipse((w * 0.25, h * 0.2, w * 0.75, h * 0.2 + w * 0.5), fill=(255, 245, 190))
        d.polygon([(0, h * 0.72), (w * 0.4, h * 0.5), (w * 0.7, h * 0.7), (w, h * 0.55), (w, h), (0, h)], fill=(40, 20, 70))
        d.rectangle((w * 0.1, h * 0.84, w * 0.9, h * 0.88), fill=(255, 255, 255))
        d.rectangle((w * 0.25, h * 0.91, w * 0.75, h * 0.93), fill=(255, 255, 255))
    elif kind == 'print':
        im = grad(w, h, (170, 215, 245), (245, 240, 225)); d = ImageDraw.Draw(im)
        d.polygon([(0, h * 0.7), (w * 0.3, h * 0.35), (w * 0.5, h * 0.6), (w * 0.72, h * 0.28), (w, h * 0.7), (w, h), (0, h)], fill=(80, 110, 140))
        d.polygon([(w * 0.62, h * 0.4), (w * 0.72, h * 0.28), (w * 0.82, h * 0.4), (w * 0.72, h * 0.37)], fill=(250, 250, 255))
        d.rectangle((0, h * 0.8, w, h), fill=(60, 120, 80))
    elif kind == 'orig':
        im = Image.new('RGB', (w, h), (240, 230, 205)); d = ImageDraw.Draw(im)
        for k in range(26):
            x = rs.randint(0, w); y = rs.randint(0, h); r = rs.randint(40, 170)
            d.ellipse((x - r, y - r, x + r, y + r), fill=tuple(int(c) for c in rs.randint(30, 255, 3)))
        im = im.filter(ImageFilter.GaussianBlur(3))
    elif kind == 'gallery':
        im = Image.new('RGB', (w, h), (245, 245, 240)); d = ImageDraw.Draw(im)
        cols = [(215, 40, 40), (250, 200, 30), (30, 70, 190), (20, 20, 20)]
        d.rectangle((0, 0, w * 0.55, h * 0.45), fill=cols[0]); d.rectangle((w * 0.55, 0, w, h * 0.3), fill=cols[1])
        d.rectangle((w * 0.55, h * 0.3, w, h * 0.45), fill=(245, 245, 240)); d.rectangle((0, h * 0.45, w * 0.3, h), fill=cols[2])
        d.rectangle((w * 0.3, h * 0.45, w * 0.55, h * 0.7), fill=(245, 245, 240)); d.rectangle((w * 0.3, h * 0.7, w, h), fill=cols[1])
        for x in (w * 0.3, w * 0.55): d.rectangle((x - 6, 0, x + 6, h), fill=cols[3])
        for y in (h * 0.3, h * 0.45, h * 0.7): d.rectangle((0, y - 6, w, y + 6), fill=cols[3])
    else:
        im = grad(w, h, (40, 34, 24), (120, 90, 50), (30, 24, 16)); d = ImageDraw.Draw(im)
        # a dark portrait: oval face, dark clothes, warm light
        d.polygon([(w * 0.1, h), (w * 0.25, h * 0.68), (w * 0.75, h * 0.68), (w * 0.9, h)], fill=(25, 22, 28))
        d.ellipse((w * 0.34, h * 0.26, w * 0.66, h * 0.62), fill=(214, 170, 130))
        d.pieslice((w * 0.3, h * 0.2, w * 0.7, h * 0.5), 180, 360, fill=(36, 26, 20))
        d.polygon([(w * 0.42, h * 0.66), (w * 0.58, h * 0.66), (w * 0.5, h * 0.75)], fill=(235, 230, 215))
        im = im.filter(ImageFilter.GaussianBlur(1.5))
    im.save(p); return p


FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def _f(sz):
    from PIL import ImageFont
    return ImageFont.truetype(FONT, sz)


def wearable(kind, name):
    p = f'{D}/{name}.png'
    w, h = 400, 460
    if kind == 'digital':
        im = Image.new('RGB', (w, h), (150, 168, 120)); d = ImageDraw.Draw(im)
        d.text((w / 2, h / 2), '10:09', font=_f(130), fill=(30, 40, 26), anchor='mm')
        d.text((w / 2, h * 0.82), 'MON 21', font=_f(46), fill=(30, 40, 26), anchor='mm')
    elif kind == 'band':
        im = Image.new('RGB', (w, h), (6, 8, 14)); d = ImageDraw.Draw(im)
        d.text((w / 2, h * 0.38), '10:09', font=_f(120), fill=(255, 255, 255), anchor='mm')
        d.rounded_rectangle((60, h * 0.7, w - 60, h * 0.76), radius=10, fill=(40, 40, 50)); d.rounded_rectangle((60, h * 0.7, 250, h * 0.76), radius=10, fill=(80, 220, 160))
    elif kind == 'face':
        im = Image.new('RGB', (w, h), (4, 6, 14)); d = ImageDraw.Draw(im)
        c = (w / 2, h / 2); R = 170
        d.ellipse((c[0] - R, c[1] - R, c[0] + R, c[1] + R), fill=(20, 30, 70))
        for k in range(12):
            a = k * math.pi / 6
            d.line((c[0] + math.cos(a) * (R - 26), c[1] + math.sin(a) * (R - 26), c[0] + math.cos(a) * (R - 4), c[1] + math.sin(a) * (R - 4)), fill=(255, 255, 255), width=8 if k % 3 == 0 else 4)
        d.line((c[0], c[1], c[0] - 50, c[1] - 90), fill=(255, 255, 255), width=14); d.line((c[0], c[1], c[0] + 100, c[1] - 30), fill=(255, 255, 255), width=10)
        d.ellipse((c[0] - 9, c[1] - 9, c[0] + 9, c[1] + 9), fill=(255, 90, 60))
    elif kind == 'rings':
        im = Image.new('RGB', (w, h), (0, 0, 0)); d = ImageDraw.Draw(im)
        c = (w / 2, h * 0.46)
        for R, col, sw in ((150, (255, 40, 90), 36), (108, (120, 255, 60), 36), (66, (40, 220, 255), 36)):
            d.ellipse((c[0] - R, c[1] - R, c[0] + R, c[1] + R), outline=tuple(int(x * 0.25) for x in col), width=sw)
            d.arc((c[0] - R, c[1] - R, c[0] + R, c[1] + R), -90, 200, fill=col, width=sw)
        d.text((w / 2, h * 0.92), '10:09', font=_f(48), fill=(255, 255, 255), anchor='mm')
    else:
        im = Image.new('RGB', (w, h), (18, 12, 4)); d = ImageDraw.Draw(im)
        c = (w / 2, h / 2); R = 175
        d.ellipse((c[0] - R, c[1] - R, c[0] + R, c[1] + R), outline=(255, 205, 90), width=10)
        for k in range(12):
            a = k * math.pi / 6
            d.line((c[0] + math.cos(a) * (R - 30), c[1] + math.sin(a) * (R - 30), c[0] + math.cos(a) * (R - 12), c[1] + math.sin(a) * (R - 12)), fill=(255, 205, 90), width=8)
        d.text(c, '10:09', font=_f(86), fill=(255, 225, 140), anchor='mm')
    im.save(p); return p


def os_screen(kind, name, w=960, h=600):
    p = f'{D}/{name}.png'
    if kind == 'old':
        im = Image.new('RGB', (w, h), (0, 0, 170)); d = ImageDraw.Draw(im)
        d.text((40, 40), 'C:\\> LOADING...', font=_f(48), fill=(255, 255, 255))
        d.rectangle((40, 160, 40 + 520, 200), outline=(255, 255, 255), width=4); d.rectangle((46, 166, 46 + 300, 194), fill=(255, 255, 255))
    elif kind == 'game':
        im = grad(w, h, (20, 8, 40), (230, 40, 70)); d = ImageDraw.Draw(im)
        d.polygon([(0, h * 0.75), (w * 0.3, h * 0.45), (w * 0.5, h * 0.7), (w * 0.8, h * 0.4), (w, h * 0.7), (w, h), (0, h)], fill=(12, 8, 30))
        d.ellipse((w * 0.62, h * 0.12, w * 0.62 + 120, h * 0.12 + 120), fill=(255, 215, 140))
        d.rectangle((40, h - 70, 40 + 360, h - 40), fill=(60, 255, 120)); d.rectangle((40, h - 70, 40 + 360, h - 40), outline=(255, 255, 255), width=3)
    elif kind == 'rgb':
        im = grad(w, h, (10, 40, 90), (140, 30, 190)); d = ImageDraw.Draw(im)
        for k in range(8):
            d.ellipse((60 + k * 105, 140 + (k % 3) * 70, 150 + k * 105, 230 + (k % 3) * 70), outline=(255, 255, 255), width=5)
        d.rectangle((0, h - 60, w, h), fill=(6, 6, 14)); d.rectangle((20, h - 46, 220, h - 16), fill=(255, 210, 60))
    else:
        im = grad(w, h, (255, 190, 80), (60, 30, 120)); d = ImageDraw.Draw(im)
        d.rectangle((0, h - 70, w, h), fill=(10, 10, 24)); d.ellipse((w * 0.7, h * 0.15, w * 0.7 + 140, h * 0.15 + 140), fill=(255, 245, 200))
        d.polygon([(0, h * 0.8), (w * 0.4, h * 0.5), (w * 0.7, h * 0.78), (w, h * 0.55), (w, h), (0, h)], fill=(30, 14, 56))
    im.save(p); return p
