"""Build the deliverables from the rendered layer sets.

  python deliver.py stills|clubs|anims|mockup|compare|all
"""
import os, sys, glob, json, zipfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import recolour as rc

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
L = os.path.join(ROOT, 'layers')
# The A2 home-screen screenshot the mock-up is pasted into (not kept in the repo).
A2 = os.environ.get('A2_SCREENSHOT', os.path.join(ROOT, 'ref', 'after-hero-A2.png'))
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def backdrop(w, h, seed=3):
    """dark floodlit stadium-ish backdrop (procedural, no external art)"""
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    top = np.array([8, 12, 24], np.float32)
    mid = np.array([16, 26, 48], np.float32)
    img = top * (1 - y[..., None]) + mid * y[..., None]
    img = np.broadcast_to(img, (h, w, 3)).copy()
    # two floodlight glows + soft beams
    for cx in (0.12, 0.88):
        d = np.sqrt(((x - cx) * w / h) ** 2 + (y - 0.02) ** 2)
        img += (np.exp(-(d / 0.18) ** 2) * 90)[..., None] * np.array([0.8, 0.9, 1.0])
        beam = np.exp(-((x - (cx + (0.5 - cx) * y * 0.9)) / (0.05 + 0.18 * y)) ** 2) * (y < 0.72)
        img += (beam * 16 * (1 - y))[..., None]
    # crowd: faint dot grid in the stands
    rng = np.random.default_rng(seed)
    stands = (y > 0.08) & (y < 0.66)
    dots = np.zeros((h, w), np.float32)
    step = max(6, w // 60)
    for yy in range(int(0.1 * h), int(0.64 * h), step):
        for xx in range(step // 2, w, step):
            dots[yy:yy + 2, xx:xx + 2] = rng.uniform(4, 22)
    img += (dots * stands)[..., None] * np.array([0.8, 0.9, 1.0])
    # pitch: green with mowing stripes, fading into the dark
    p = np.clip((y - 0.62) / 0.12, 0, 1)
    stripes = (np.floor(x * 9 + 0.5 * y) % 2) * 6
    grass = np.stack([18 + stripes * 0.5, 72 + stripes * 1.6, 40 + stripes * 0.6], -1)
    img = img * (1 - p[..., None]) + grass * p[..., None]
    vign = 1 - 0.35 * (((x - 0.5) * 2) ** 2)
    img *= vign[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')


def over(bg, fg):
    bg = bg.convert('RGBA')
    bg.alpha_composite(fg.convert('RGBA'))
    return bg.convert('RGB')


def label(img, text, size=None):
    d = ImageDraw.Draw(img)
    size = size or max(14, img.width // 22)
    f = ImageFont.truetype(FONT, size)
    d.text((img.width // 2, img.height - size * 1.2), text, font=f, fill=(235, 240, 250), anchor='mm')
    return img


def stills():
    names = [('idle', 'IDLE'), ('celebrate', 'ARMS-UP CELEBRATION'), ('kneeslide', 'KNEE SLIDE'),
             ('point', 'POINTS AT THE BADGE'), ('hips', 'HANDS ON HIPS')]
    tiles = []
    for n, t in names:
        im = rc.recolour(os.path.join(L, 'still_' + n), 1, rc.CLUBS['chelsea'])
        im.save(os.path.join(ROOT, 'work', f'still_{n}_chelsea.png'))
        tiles.append(label(over(backdrop(*im.size), im), t))
    w, h = tiles[0].size
    row = Image.new('RGB', (w * len(tiles), h))
    for i, t in enumerate(tiles):
        row.paste(t, (i * w, 0))
    row.save(os.path.join(ROOT, 'stills.jpg'), quality=90)


def clubs():
    tiles = []
    for c in ('chelsea', 'arsenal', 'liverpool'):
        im = rc.recolour(os.path.join(L, 'still_idle'), 1, rc.CLUBS[c])
        tiles.append(label(over(backdrop(*im.size), im), c.upper()))
    w, h = tiles[0].size
    row = Image.new('RGB', (w * 3, h + 60), (10, 14, 26))
    for i, t in enumerate(tiles):
        row.paste(t, (i * w, 60))
    d = ImageDraw.Draw(row)
    d.text((row.width // 2, 30), 'ONE RENDER SET  ->  THREE CLUBS  (recoloured in code, folds and light kept)',
           font=ImageFont.truetype(FONT, 22), fill=(200, 210, 230), anchor='mm')
    row.save(os.path.join(ROOT, 'clubs.jpg'), quality=90)


def anims():
    import av
    clips = [('idle_loop', 'anim-idle.mp4', 3), ('celebrate_jump', 'anim-celebrate.mp4', 1),
             ('kneeslide_anim', 'anim-kneeslide.mp4', 1)]
    info = {}
    for d, mp4, loops in clips:
        src = os.path.join(L, 'anim_' + d)
        frames = sorted(int(os.path.basename(p)[7:11]) for p in glob.glob(os.path.join(src, 'beauty_*.png')))
        outdir = os.path.join(ROOT, 'frames', d)
        os.makedirs(outdir, exist_ok=True)
        rgba = []
        for f in frames:
            im = rc.recolour(src, f, rc.CLUBS['chelsea'])
            im.save(os.path.join(outdir, f'{d}_{f:04d}.png'), optimize=True)
            rgba.append(im)
        w, h = rgba[0].size
        bg = backdrop(w, h)
        path = os.path.join(ROOT, mp4)
        cont = av.open(path, 'w')
        st = cont.add_stream('libx264', rate=24)
        st.width, st.height = w, h
        st.pix_fmt = 'yuv420p'
        st.options = {'crf': '20', 'preset': 'slow', 'profile': 'high', 'movflags': '+faststart'}
        seq = rgba * loops
        if d != 'idle_loop':                       # hold the last frame a beat
            seq = seq + [rgba[-1]] * 12
        for im in seq:
            fr = av.VideoFrame.from_image(over(bg, im))
            for pk in st.encode(fr):
                cont.mux(pk)
        for pk in st.encode():
            cont.mux(pk)
        cont.close()
        # zip the alpha frames
        zp = os.path.join(ROOT, 'frames', f'{d}_rgba_png.zip')
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_STORED) as z:
            for p in sorted(glob.glob(os.path.join(outdir, '*.png'))):
                z.write(p, os.path.join(d, os.path.basename(p)))
        info[d] = dict(frames=len(frames), seconds=round(len(frames) / 24, 2), mp4_kb=os.path.getsize(path) // 1024,
                       zip_kb=os.path.getsize(zp) // 1024)
        print(d, info[d], flush=True)
    json.dump(info, open(os.path.join(ROOT, 'work', 'anim_info.json'), 'w'), indent=1)


# ------------------------------------------------------------------ home-screen mock-up
FIG_BOX = (404, 698, 776, 1356)       # A2 figure incl. glow & shadow, in the 1170x1992 shot


def erase_figure(img):
    """remove the A2 figure: smooth background by normalised convolution
    (2-D, so no streaks) + the dot/stripe detail copied from a whole number
    of dot periods away (so the grid stays aligned)."""
    a = np.asarray(img).astype(np.float32)
    H, W = a.shape[:2]
    x0, y0, x1, y1 = FIG_BOX
    mask = np.zeros((H, W), np.float32)
    mask[y0:y1, x0:x1] = 1
    m_img = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    known = 1 - mask

    def box(arr, r, axis):
        c = np.cumsum(np.pad(arr, [(r + 1, r) if i == axis else (0, 0) for i in range(arr.ndim)], mode='edge'),
                      axis=axis, dtype=np.float64)
        hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
        lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
        return ((hi - lo) / (2 * r + 1)).astype(np.float32)

    def blur(arr, sigma):
        r = max(1, int(sigma * 0.9))
        for _ in range(3):
            arr = box(box(arr, r, 0), r, 1)
        return arr
    # smooth base: normalised convolution, done at a few scales
    # (multi-scale: wide kernels reach the middle of the hole, narrow ones keep
    # the edges faithful)
    def blur2(arr, sx, sy):
        rx, ry = max(1, int(sx * 0.9)), max(1, int(sy * 0.9))
        for _ in range(3):
            arr = box(box(arr, ry, 0), rx, 1)
        return arr
    # the card's background changes mostly with height: interpolate along rows
    # (wide horizontal kernel, narrow vertical one), coarse-to-fine
    base = None
    for sx, sy in ((260, 10), (120, 6), (40, 4)):
        num = blur2((a * known[..., None]).astype(np.float32), sx, sy)
        den = blur2(known.astype(np.float32), sx, sy)[..., None]
        b = num / np.maximum(den, 1e-4)
        if base is None:
            base = b
        else:
            w = np.clip((den - 0.08) / 0.3, 0, 1)
            base = base * (1 - w) + b * w
    local = blur(a, 6)
    detail = a - local
    # dot period (measured in a clean strip by autocorrelation)
    strip = detail[y0 + 60:y0 + 260, 60:400].mean(-1).mean(0)
    strip = strip - strip.mean()
    ac = np.correlate(strip, strip, 'full')[len(strip) - 1:]
    P = int(np.argmax(ac[8:60]) + 8)
    # copy detail from left/right shifted by whole periods
    fill_d = np.zeros_like(a)
    mid = (x0 + x1) // 2
    k = int(np.ceil((mid - x0 + 4) / P))
    xs = np.arange(x0, x1)
    left = xs < mid
    src = np.where(left, xs - k * P, xs + k * P)
    src = np.clip(src, 0, W - 1)
    fill_d[y0:y1, x0:x1] = detail[y0:y1][:, src]
    # the pitch has no dots, and copying there would drag in the name badge
    ramp = np.clip((1200 - np.arange(H)) / 40.0, 0, 1)[:, None, None]
    fill_d *= ramp
    # smooth base inside the box: blend the local base toward the known ring
    fill = base + fill_d
    out = a * (1 - mask[..., None]) + fill * mask[..., None]
    # feather the seam
    mf = np.asarray(m_img, np.float32)[..., None] / 255
    out = a * (1 - mf) + out * mf
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), P


def mockup(hero_png):
    a2 = Image.open(A2).convert('RGB')
    clean, P = erase_figure(a2)
    clean.save(os.path.join(ROOT, 'work', 'a2_clean.png'))
    hero = Image.open(hero_png).convert('RGBA')
    al = np.asarray(hero)[..., 3]
    ys, xs = np.where(al > 160)          # body only (ignore faint shadow)
    body = hero.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    # full crop incl. shadow, positioned by the body's box
    x0, y0, x1, y1 = FIG_BOX
    target_h = 600                      # A2 figure: head top ~706 to boot soles ~1325
    s = target_h / body.height
    full = hero.resize((int(hero.width * s), int(hero.height * s)), Image.LANCZOS)
    bx = int(xs.min() * s); by = int(ys.min() * s); bw = int(body.width * s)
    feet_y = 1328
    ox = (x0 + x1) // 2 - (bx + bw // 2)
    oy = feet_y - (by + int(body.height * s))
    canvas = clean.convert('RGBA')
    canvas.alpha_composite(full, (ox, oy)) if ox >= 0 and oy >= 0 else canvas.paste(full, (ox, oy), full)
    canvas.convert('RGB').save(os.path.join(ROOT, 'mockup-home.png'), optimize=True)
    return P


def compare(hero_png):
    a2 = Image.open(A2).convert('RGB')
    left = a2.crop((380, 640, 800, 1400))
    mock = Image.open(os.path.join(ROOT, 'mockup-home.png')).convert('RGB')
    right = mock.crop((380, 640, 800, 1400))
    W, H = left.size
    out = Image.new('RGB', (W * 2 + 24, H + 70), (8, 10, 18))
    out.paste(left, (0, 70)); out.paste(right, (W + 24, 70))
    d = ImageDraw.Draw(out)
    f = ImageFont.truetype(FONT, 26)
    d.text((W // 2, 35), 'A2 (current 2D)', font=f, fill=(230, 235, 245), anchor='mm')
    d.text((W + 24 + W // 2, 35), 'New 3D (Blender)', font=f, fill=(230, 235, 245), anchor='mm')
    out.save(os.path.join(ROOT, 'compare.jpg'), quality=92)


if __name__ == '__main__':
    what = sys.argv[1]
    if what in ('stills', 'all'):
        stills()
    if what in ('clubs', 'all'):
        clubs()
    if what in ('anims', 'all'):
        anims()
    if what in ('mockup', 'all'):
        hero = os.path.join(ROOT, 'work', 'hero_chelsea.png')
        print('dot period', mockup(hero))
        compare(hero)
