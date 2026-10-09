"""Big shop stills for the Showroom + Feed shop (9 Oct 2026).

The 2D shop shows one item full screen; the 400x300 stills in public/shop blur
there. This re-runs the same Blender scripts (tools/blender-shop/scripts) at
1440x1080 with no shadow-catcher floor (no baked shadow edge), then packs each
to public/star/shop2d/items/<name>.webp (1440x1080, WebP q80, transparent).

usage: python3 tools/shop2d/render_big.py [name ...]
  needs bpy 4.5.14 on PYTHONPATH (see tools/blender-shop/README.md); no names = all.
env: THREADS (default 4), SHOP_SAMPLES (default 10), MASTERS (default /dev/shm/blender-shop/hi)
"""
import os, sys, glob, subprocess, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SCRIPTS = os.path.join(ROOT, 'tools', 'blender-shop', 'scripts')
OUT = os.path.join(ROOT, 'public', 'star', 'shop2d', 'items')
MASTERS = os.environ.get('MASTERS', '/dev/shm/blender-shop/hi')

# category order = the shop's order (cans have no render: drawn in code)
ORDER = ['boot-', 'suit', 'silver', 'gold', 'rolex', 'diamond', 'art',
         'phone', 'console', 'headphones', 'music', 'tablet', 'smartwatch', 'tv', 'gaming-pc',
         'bike', 'car-1', 'car-2', 'suv', 'car-3', 'classic', 'car-4',
         'flat-1', 'flat-2', 'penthouse', 'house-1', 'house-2', 'estate', 'stable',
         'jet', 'villa', 'island']


def names():
    all_ = sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(ROOT, 'public', 'shop', '*-L[1-5].webp')))
    def key(n):
        fam = n.rsplit('-L', 1)[0]
        for i, o in enumerate(ORDER):
            if fam == o or (o.endswith('-') and fam.startswith(o)):
                return (i, n)
        return (99, n)
    return sorted(all_, key=key)


def cmd(name, png):
    fam, lv = name.rsplit('-L', 1)
    if fam.startswith('boot-'):
        return [os.path.join(SCRIPTS, 'boot.py'), '--', fam[5:], lv, png]
    if fam == 'car-3':
        return [os.path.join(SCRIPTS, 'car.py'), '--', lv, png]
    if fam == 'house-1':
        return [os.path.join(SCRIPTS, 'house.py'), '--', lv, png]
    return [os.path.join(SCRIPTS, 'run.py'), '--', fam, lv, png]


def pack(png, name):
    from PIL import Image
    im = Image.open(png).convert('RGBA')
    bbox = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not bbox:
        return
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=80, method=5)


def main():
    todo = sys.argv[1:] or names()
    os.makedirs(MASTERS, exist_ok=True)
    env = dict(os.environ, SHOP_RES='1440x1080', SHOP_NO_FLOOR='1',
               SHOP_SAMPLES=os.environ.get('SHOP_SAMPLES', '10'), THREADS=os.environ.get('THREADS', '4'))
    for n in todo:
        png = os.path.join(MASTERS, n + '.png')
        if not os.path.exists(png):
            t = time.time()
            r = subprocess.run(['nice', '-n', '10', sys.executable] + cmd(n, png), env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(n, 'rc', r.returncode, round(time.time() - t), 's', flush=True)
        if os.path.exists(png):
            pack(png, n)


if __name__ == '__main__':
    main()
