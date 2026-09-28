"""Recolour one neutral-kit layer set into any club's kit.

The render was made once with every kit panel in a neutral grey albedo
(KIT_BASE = 0.5 linear). For each pixel, in linear light, premultiplied:

    out = beauty + shade * sum_r  mask_r * (club_r - KIT_BASE)

shade  = the diffuse light that landed on the cloth (Cycles DiffDir+DiffInd),
mask_r = antialiased coverage of region r (shirt, sleeves, shorts, socks,
         trim, sock band), from shader AOVs.
Crest and number are UV-lookup decals: the render stores (u, v) of the decal
patch per pixel, so any crest/number image is projected on perspective-correct
and follows the body in every animation frame.

Only numpy + Pillow. The same maths is ~15 lines of JS on a canvas.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

KIT_BASE = 0.5
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

CLUBS = {
    'chelsea': dict(shirt='#034694', sleeve='#034694', shorts='#034694', socks='#f4f5f7',
                    trim='#f4f5f7', band='#034694', code='CHE', crest_bg='#0a2f6b', crest_fg='#f4f5f7',
                    number='#f4f5f7'),
    'arsenal': dict(shirt='#db0007', sleeve='#f4f5f7', shorts='#f4f5f7', socks='#f4f5f7',
                    trim='#f4f5f7', band='#db0007', code='ARS', crest_bg='#9c0006', crest_fg='#f4f5f7',
                    number='#db0007'),
    'liverpool': dict(shirt='#c8102e', sleeve='#c8102e', shorts='#c8102e', socks='#c8102e',
                      trim='#f4f5f7', band='#f4f5f7', code='LIV', crest_bg='#8e0b20', crest_fg='#f4f5f7',
                      number='#f4f5f7'),
}


def s2l(a):
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def l2s(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)


def hexlin(h):
    h = h.lstrip('#')
    return s2l(np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32))


def load(path, n):
    im = Image.open(path)
    a = np.asarray(im).astype(np.float32)
    return a / (65535.0 if a.max() > 255.5 or im.mode.startswith('I') else 255.0)


def make_crest(club, size=512):
    """generic text badge (no real club marks): ring + fill + 3-letter code"""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    fg = club['crest_fg']; bg = club['crest_bg']
    d.ellipse((12, 12, size - 12, size - 12), fill=fg)
    d.ellipse((40, 40, size - 40, size - 40), fill=bg)
    d.ellipse((60, 60, size - 60, size - 60), outline=fg, width=10)
    f = ImageFont.truetype(FONT, int(size * 0.24))
    d.text((size / 2, size / 2 + 4), club['code'], font=f, fill=fg, anchor='mm')
    return im


def make_number(club, num='19', size=512):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, int(size * 0.62))
    d.text((size / 2, size / 2), num, font=f, fill=club['number'], anchor='mm',
           stroke_width=int(size * 0.02), stroke_fill=club['number'])
    return im


def sample(img, u, v):
    """bilinear sample of an RGBA image (float, straight alpha) at uv in 0..1"""
    a = np.asarray(img).astype(np.float32) / 255.0
    h, w = a.shape[:2]
    x = np.clip(u, 0, 1) * (w - 1)
    y = np.clip(1 - v, 0, 1) * (h - 1)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    x1 = np.minimum(x0 + 1, w - 1); y1 = np.minimum(y0 + 1, h - 1)
    fx = (x - x0)[..., None]; fy = (y - y0)[..., None]
    out = (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x1] * fx * (1 - fy) +
           a[y1, x0] * (1 - fx) * fy + a[y1, x1] * fx * fy)
    inside = ((u >= 0) & (u <= 1) & (v >= 0) & (v <= 1))[..., None]
    return out * inside


def recolour(layer_dir, frame, club, number='19', crest_img=None, num_img=None):
    f = f'{frame:04d}'
    beauty = load(os.path.join(layer_dir, f'beauty_{f}.png'), 4)
    alpha = beauty[..., 3:4]
    B = s2l(beauty[..., :3]) * alpha                           # premultiplied linear
    S = s2l(load(os.path.join(layer_dir, f'shade_{f}.png'), 3)[..., :3]) * 4.0
    kA = s2l(load(os.path.join(layer_dir, f'kitA_{f}.png'), 3)[..., :3])
    kB = s2l(load(os.path.join(layer_dir, f'kitB_{f}.png'), 3)[..., :3])
    masks = dict(shirt=kA[..., 0], sleeve=kA[..., 1], shorts=kA[..., 2],
                 socks=kB[..., 0], trim=kB[..., 1], band=kB[..., 2])
    delta = np.zeros_like(B)
    for k, m in masks.items():
        delta += m[..., None] * (hexlin(club[k]) - KIT_BASE)
    # decals: colour = crest over the garment colour underneath
    crest_img = crest_img or make_crest(club)
    num_img = num_img or make_number(club, number)
    for layer, img, under in (('crest', crest_img, 'shirt'), ('num', num_img, 'shorts')):
        d = s2l(load(os.path.join(layer_dir, f'{layer}_{f}.png'), 3)[..., :3])
        cov = d[..., 2]
        safe = np.maximum(cov, 1e-4)
        u = d[..., 0] / safe; v = d[..., 1] / safe
        smp = sample(img, u, v)
        a = smp[..., 3:4]
        col = s2l(smp[..., :3]) * a + hexlin(club[under]) * (1 - a)
        delta += cov[..., None] * (col - KIT_BASE)
    out = B + S * delta
    straight = out / np.maximum(alpha, 1e-4)
    rgb = l2s(straight)
    rgba = np.concatenate([rgb, alpha], -1)
    return Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')


if __name__ == '__main__':
    layer_dir, frame, club, out = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
    recolour(layer_dir, frame, CLUBS[club]).save(out)
