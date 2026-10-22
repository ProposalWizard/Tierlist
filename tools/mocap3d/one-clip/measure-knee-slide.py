import os, sys, numpy as np
ROOT = "/home/user/Tierlist"
sys.path[:0] = [os.path.join(ROOT, "tools/mocap3d"), os.path.join(ROOT, "tools/anims3d"), os.path.join(ROOT, "scripts/people3d")]
from rig import Rig, solve
import importlib
import keyed
name = sys.argv[1] if len(sys.argv) > 1 else "knee_slide"
kinds = [("p3", f"{ROOT}/public/star/people3d/anims.glb"), ("ual", f"{ROOT}/public/star/shop3d/character.glb")]

def segdist(p1, q1, p2, q2):
    # closest distance between segments
    d1, d2, r = q1 - p1, q2 - p2, p1 - p2
    a, e, f = d1 @ d1, d2 @ d2, d2 @ r
    c = d1 @ r; b = d1 @ d2; den = a * e - b * b
    s = np.clip((b * f - c * e) / den, 0, 1) if den > 1e-12 else 0.0
    t = (b * s + f) / e
    if t < 0: t = 0; s = np.clip(-c / a, 0, 1)
    elif t > 1: t = 1; s = np.clip((b - c) / a, 0, 1)
    return float(np.linalg.norm(p1 + d1 * s - (p2 + d2 * t)))

for kind, glb in kinds:
    rig = Rig(kind, glb)
    importlib.reload(keyed)
    dur, loop, fn, meta = keyed.KEYED[name]
    n = int(round(dur * 30)) + 1
    worst = {}
    def upd(k, v, t):
        if k not in worst or v < worst[k][0]: worst[k] = (v, t)
    minY = (9, 0, "")
    for i in range(n):
        t = i / 30
        _, _, c = solve(rig, fn(rig, t))
        P = c.pos
        upd("knee-knee", np.linalg.norm(P("shinL") - P("shinR")), t)
        upd("ankle-ankle", np.linalg.norm(P("footL") - P("footR")), t)
        upd("shin-shin seg", segdist(P("shinL"), P("footL"), P("shinR"), P("footR")), t)
        upd("thigh-thigh seg", segdist(P("thighL"), P("shinL"), P("thighR"), P("shinR")), t)
        for s in "LR":
            upd(f"hand{s}-head", np.linalg.norm(P("hand" + s) - c.head_at((0, 0.09, 0.02))), t)
            upd(f"fore{s}-torso seg", segdist(P("fore" + s), P("hand" + s), P("hips"), P("neck")), t)
            upd(f"hand{s}-thigh seg", min(segdist(P("hand"+s), P("hand"+s)+1e-6, P("thigh"+o), P("shin"+o)) for o in "LR"), t)
        for k in ("hips", "shinL", "shinR", "footL", "footR", "toeL", "toeR", "handL", "handR", "head"):
            if P(k)[1] < minY[0]: minY = (P(k)[1], t, k)
    print(kind, name)
    for k, (v, t) in worst.items():
        print(f"  {k:18s} min {v*100:6.1f} cm at {t:.2f}s")
    print(f"  lowest joint y     {minY[0]*100:6.1f} cm at {minY[1]:.2f}s ({minY[2]})")
