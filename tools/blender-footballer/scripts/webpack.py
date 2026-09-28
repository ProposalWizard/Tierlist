"""Pack neutral-kit layer sets into the small browser files the test page
(/star-blender-dev) recolours on a canvas. Like gamepack.py, plus an optional
exact 2x downscale (done in linear light, so masks, light and decal UVs stay
correct) for the 1024x1536 hero.

  base.webp   RGBA lossless  the render with the kit in neutral grey
  light.webp  RGB  lossless  diffuse light on the cloth, sRGB-encoded, /4
  kitA.png    RGB   shirt, sleeves, shorts   (linear coverage)
  kitB.png    RGB   socks, trim, sock band
  crest.png   RGB   crest u, v, coverage     (u,v 0 where no crest)
  num.png     RGB   number u, v, coverage
Nothing is stored in an alpha channel except the picture's own: a browser
canvas premultiplies alpha, which would wipe any data kept there.

usage: python3 webpack.py <layer_dir> <frame> <out_dir> [--half]
"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from recolour import s2l, l2s, load


def half(a):
    h, w = a.shape[:2]
    return a.reshape(h // 2, 2, w // 2, 2, *a.shape[2:]).mean(axis=(1, 3))


def pack(layer_dir, frame, out_dir, halve=False):
    os.makedirs(out_dir, exist_ok=True)
    f = f'{frame:04d}'
    rd = lambda n: load(os.path.join(layer_dir, f'{n}_{f}.png'), 3)
    beauty = rd('beauty')
    alpha = beauty[..., 3:4]
    B = s2l(beauty[..., :3]) * alpha                      # premultiplied linear
    S = s2l(rd('shade')[..., :3])                         # linear light / 4
    kA, kB, cr, nm = (s2l(rd(n)[..., :3]) for n in ('kitA', 'kitB', 'crest', 'num'))
    if halve:
        B, alpha, S, kA, kB, cr, nm = map(half, (B, alpha, S, kA, kB, cr, nm))
    to8 = lambda a: (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    straight = B / np.maximum(alpha, 1e-4)
    Image.fromarray(to8(np.concatenate([l2s(straight), alpha], -1)), 'RGBA').save(
        os.path.join(out_dir, 'base.webp'), lossless=True, quality=100, method=6)
    Image.fromarray(to8(l2s(S)), 'RGB').save(os.path.join(out_dir, 'light.webp'), lossless=True, quality=100, method=6)
    su = lambda d: d[..., 0] / np.maximum(d[..., 2], 1e-4)
    sv = lambda d: d[..., 1] / np.maximum(d[..., 2], 1e-4)
    dec = lambda d: np.stack([su(d), sv(d), d[..., 2]], -1) * (d[..., 2:3] > 0.01)
    for name, arr in (('kitA.png', kA), ('kitB.png', kB), ('crest.png', dec(cr)), ('num.png', dec(nm))):
        Image.fromarray(to8(arr), 'RGB').save(os.path.join(out_dir, name), optimize=True)
    return {n: os.path.getsize(os.path.join(out_dir, n)) for n in sorted(os.listdir(out_dir))}


if __name__ == '__main__':
    print(json.dumps(pack(sys.argv[1], int(sys.argv[2]), sys.argv[3], '--half' in sys.argv)))
