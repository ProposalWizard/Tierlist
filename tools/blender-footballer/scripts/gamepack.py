"""Pack one layer set into the 3 small 8-bit files a browser would load, and
measure sizes for both game routes.
  base.webp   RGBA  beauty (neutral kit)
  light.webp  RGB   shade (sRGB-encoded diffuse light / 4)
  masks.png   RGBA  R shirt  G sleeve  B shorts  A socks
  masks2.png  RGBA  R trim   G band    B crest-coverage  A number-coverage
  decal.png   RGBA  R,G crest u,v   B,A number u,v   (8-bit is enough at sprite size)
"""
import os, sys, io, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import recolour as rc


def pack(layer_dir, frame, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    f = f'{frame:04d}'
    ld = lambda n: rc.load(os.path.join(layer_dir, f'{n}_{f}.png'), 3)[..., :3]
    kA, kB, cr, nm = ld('kitA'), ld('kitB'), ld('crest'), ld('num')
    lin = rc.s2l
    kA, kB, cr, nm = lin(kA), lin(kB), lin(cr), lin(nm)
    to8 = lambda a: (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    m1 = np.stack([kA[..., 0], kA[..., 1], kA[..., 2], kB[..., 0]], -1)
    m2 = np.stack([kB[..., 1], kB[..., 2], cr[..., 2], nm[..., 2]], -1)
    su = lambda d: d[..., 0] / np.maximum(d[..., 2], 1e-4)
    sv = lambda d: d[..., 1] / np.maximum(d[..., 2], 1e-4)
    dc = np.stack([su(cr), sv(cr), su(nm), sv(nm)], -1) * (np.stack([cr[..., 2]] * 2 + [nm[..., 2]] * 2, -1) > 0.01)
    sizes = {}
    Image.open(os.path.join(layer_dir, f'beauty_{f}.png')).save(os.path.join(out_dir, 'base.webp'), lossless=True)
    Image.open(os.path.join(layer_dir, f'shade_{f}.png')).convert('RGB').save(os.path.join(out_dir, 'light.webp'), lossless=True) \
        if False else Image.fromarray(to8(rc.load(os.path.join(layer_dir, f'shade_{f}.png'), 3)[..., :3])).save(os.path.join(out_dir, 'light.webp'), lossless=True)
    Image.fromarray(to8(m1), 'RGBA').save(os.path.join(out_dir, 'masks.png'), optimize=True)
    Image.fromarray(to8(m2), 'RGBA').save(os.path.join(out_dir, 'masks2.png'), optimize=True)
    Image.fromarray(to8(dc), 'RGBA').save(os.path.join(out_dir, 'decal.png'), optimize=True)
    for n in os.listdir(out_dir):
        sizes[n] = os.path.getsize(os.path.join(out_dir, n))
    # baked per-club frame for comparison
    b = io.BytesIO(); rc.recolour(layer_dir, frame, rc.CLUBS['chelsea']).save(b, 'WEBP', quality=88)
    sizes['_baked_club_frame.webp'] = len(b.getvalue())
    return sizes


if __name__ == '__main__':
    print(json.dumps(pack(sys.argv[1], int(sys.argv[2]), sys.argv[3]), indent=1))
