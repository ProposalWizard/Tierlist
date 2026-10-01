import sys, os, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
WORLD = 0.4
_MAP = {'flat-1': 'homes_a', 'flat-2': 'homes_a', 'penthouse': 'homes_a',
        'house-2': 'homes_b', 'estate': 'homes_b',
        'stable': 'homes_c', 'villa': 'homes_c', 'island': 'homes_c'}


def make(fam, lv):
    import bpy
    parts, cfg = importlib.import_module(_MAP[fam]).make(fam, lv)
    bpy.context.scene.view_settings.exposure = cfg.get('expo', -1.0)
    return parts, cfg
