"""Render one shop picture. usage: python run.py -- <family> <level> <out.png> [samples] [w h]
Each family module has make(family, level) -> (parts, cfg)."""
import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import studio as S

MODS = {}
for f in ('car-1', 'car-2', 'suv', 'classic', 'car-4'):
    MODS[f] = 'cars'
for f in ('bike',): MODS[f] = 'bikes'
for f in ('jet',): MODS[f] = 'jets'
for f in ('flat-1', 'flat-2', 'penthouse', 'house-2', 'estate', 'stable', 'villa', 'island'): MODS[f] = 'homes'
for f in ('phone', 'console', 'headphones', 'music', 'tablet', 'smartwatch', 'tv', 'gaming-pc'): MODS[f] = 'gadgets'
for f in ('suit', 'silver', 'gold', 'rolex', 'diamond', 'art'): MODS[f] = 'drip'


def main():
    a = S.args()
    fam, lv, out = a[0], int(a[1]), a[2]
    samples = int(a[3]) if len(a) > 3 else 32
    res = (int(a[4]), int(a[5])) if len(a) > 5 else (600, 450)
    S.reset()
    S.setup_render(res, samples)
    mod = importlib.import_module(MODS[fam])
    S.world(getattr(mod, 'WORLD', 0.35))
    parts, c = mod.make(fam, lv)
    if 'expo' in c:
        bpy.context.scene.view_settings.exposure = c['expo']
    bpy.context.view_layer.update()
    S.studio_lights(scale=c['scale'], aim=c['aim'], key=c.get('key', 1.0))
    S.shadow_catcher(c.get('floor', 0.0), size=c.get('floor_size', 80))
    cam = S.camera(c['cam'], c['target'], lens=c.get('lens', 50))
    S.frame_objects(cam, [p for p in (c.get('frame_parts') or parts) if p.type == 'MESH'], fill=c.get('fill', 0.8), offset=c.get('offset', (0, 0)), fill_y=c.get('fill_y'))
    S.render(out)


if __name__ == '__main__':
    main()
