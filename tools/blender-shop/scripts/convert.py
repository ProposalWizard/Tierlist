"""Final PNG masters -> public/shop/*.webp (300x225, quality 80).
Masters: ../final/<fam>-L<n>.png (600x450, from run.py/car.py/house.py/boot.py).
The first 45 pictures (boots, car-3, house-1) levels 1-4 come from the older 300px copies in tools/blender-shop/renders/300."""
import os, sys, glob
from PIL import Image
OUT = sys.argv[1]
OLD = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
n = 0
tot = 0
def save(im, name):
    global n, tot
    im = im.convert('RGBA')
    if im.size != (400, 300):
        im = im.resize((400, 300), Image.LANCZOS)
    p = f'{OUT}/{name}.webp'
    im.save(p, 'WEBP', quality=82, method=4)
    n += 1; tot += os.path.getsize(p)
for p in sorted(glob.glob('/dev/shm/blender-shop/final/*.png')):
    b = os.path.basename(p)[:-4]
    save(Image.open(p), b)
# older renders: boots levels 1-4, car-3 L1-4, house-1 L1-4 (L5 re-rendered without baked sparkles)
for p in sorted(glob.glob(OLD + '/*.png')):
    b = os.path.basename(p)[:-4]
    lv = int(b[-1])
    if b.startswith('car-L'): b = 'car-3-L' + str(lv)
    elif b.startswith('house-L'): b = 'house-1-L' + str(lv)
    if os.path.exists(f'{OUT}/{b}.webp') and lv == 5: continue
    if lv == 5 and not os.path.exists('/dev/shm/blender-shop/final/' + b + '.png'):
        continue  # not re-rendered yet
    if os.path.exists('/dev/shm/blender-shop/final/' + b + '.png'): continue
    save(Image.open(p), b)
print(n, 'files', round(tot / 1e6, 2), 'MB')
