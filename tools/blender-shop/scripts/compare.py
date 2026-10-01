"""Side-by-side sheets: the game's current drawing (top row) vs the Blender
render (bottom row), same background, same size, level 1 -> 5."""
import sys, os
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, '/dev/shm/blender-shop')
from comp import on_tile
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
f1, f2, f3 = ImageFont.truetype(F, 15), ImageFont.truetype(F, 22), ImageFont.truetype(F, 13)
CUR = '/dev/shm/blender-shop/svg/cur'
DEL = '/dev/shm/blender-shop/deliver'
NAMES = {
    'car': ["Rusty Kit Car", "Used Coupé", "Sports Car", "Twin-Turbo GT", "Track Racer"],
    'house': ["Terraced House", "Semi-Detached House", "Detached House", "Gated House", "Executive Home"],
}
BOOTNAME = {'starter': 'NS-Pure', 'speed': 'NS-Flash', 'power': 'NS-Thunder', 'control': 'NS-Control', 'elite': 'NS-Elite', 'curl': 'NS-Swerve', 'maestro': 'NS-Maestro'}
TW, TH = 300, 225

def tile_for(item, lv, which):
    if which == 'now':
        im = Image.open(f'{CUR}/{item}-L{lv}.png').convert('RGB')
    else:
        im = on_tile(f'{DEL}/{item}-L{lv}.png', 0 if item.startswith('boot') else lv).convert('RGB')
    return im.resize((TW, TH), Image.LANCZOS)

def ladder(item, title, names, out=None):
    pad, lab = 10, 30
    W = 120 + 5 * (TW + pad) + pad
    H = 46 + 2 * (TH + lab + pad) + pad
    S = Image.new('RGB', (W, H), (6, 9, 16)); d = ImageDraw.Draw(S)
    d.text((pad, 12), title, font=f2, fill=(255, 255, 255))
    for r, which in enumerate(('now', 'blender')):
        y = 46 + r * (TH + lab + pad)
        d.text((pad, y + TH // 2 - 10), 'NOW' if which == 'now' else 'BLENDER', font=f1, fill=(253, 224, 71) if which == 'blender' else (180, 186, 196))
        for c in range(5):
            x = 120 + c * (TW + pad)
            S.paste(tile_for(item, c + 1, which), (x, y))
            if r == 0:
                pass
            d.text((x + 4, y + TH + 6), f'L{c + 1}  {names[c]}', font=f3, fill=(230, 232, 236))
    if out:
        S.save(out)
    return S

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    ladder('car', 'Sports Car (car-3) — now vs Blender', NAMES['car'], f'{out}/compare-car.png')
    ladder('house', 'House (house-1) — now vs Blender', NAMES['house'], f'{out}/compare-house.png')
    sheets = []
    for b in ['speed', 'starter', 'power', 'control', 'elite', 'curl', 'maestro']:
        if all(os.path.exists(f'{DEL}/boot-{b}-L{l}.png') for l in range(1, 6)):
            sheets.append(ladder(f'boot-{b}', f'{BOOTNAME[b]} boots — now vs Blender', [BOOTNAME[b]] * 5, f'{out}/compare-boot-{b}.png'))
    print('ok', len(sheets))
