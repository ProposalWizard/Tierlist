"""The machinery build.py drives: one clip spec -> baked tracks + measured moments.

A clip spec (build.py CLIPS[name]):
  trial      CMU trial "SS_TT" (tools/mocap3d/README.md lists every one used)
  cut        (t0, t1) seconds of the trial; for a loop, the search window
  loop       True: find the cycle inside `cut` (`period` = (min, max) s), take
             its travel out (`speed` goes in the file), close the seam
  mirror     True: reflected (left <-> right)
  face       "start" | "end" | "travel" | seconds: when he faces +z
  turn       extra yaw (radians) after facing
  rate       play speed (1.2 = 20 % faster)
  moments    {name: seconds from t0} (contact, launch, land, release, trap...)
  meta       copied as-is (foot, part, ...)
  end        True: write `end` (where the hips finish, his frame) for root motion
  inplace    True for a one-shot: take its travel out too
  hold       seconds to hold the last pose (a one-shot that should settle)
  ik / lock  feet IK and planting (default on)
  edit       fn(rt, frames, src) -> frames: a careful hand-made change on top
             (an "adapted" clip; build.py says which and why)
"""
import numpy as np
from rig import CANON, Ctx, qmul, qinv, qnorm, qrot, qfromto, qaxis
from retarget import Source, Retarget, solve_clip, local_tracks, close_loop, resample, find_cycle, slerp
from cmu import Skeleton, Motion

FPS = 30
_cache = {}


def motion(cmu_dir, trial):
    if trial not in _cache:
        subj = trial.split("_")[0]
        sk = Skeleton(f"{cmu_dir}/{subj}.asf")
        _cache[trial] = Motion(sk, f"{cmu_dir}/{trial}.amc")
    return _cache[trial]


def cut_for(mo, spec):
    t0, t1 = spec["cut"]
    if spec.get("loop") and "period" in spec:
        a, b, e = find_cycle(mo, t0, t1, *spec["period"])
        return a, b
    return t0, t1


def bake_clip(rig, cmu_dir, name, spec):
    mo = motion(cmu_dir, spec["trial"])
    a, b = cut_for(mo, spec)
    rate = spec.get("rate", 1.0)
    if "face" in spec:
        face = spec["face"]
    elif spec.get("loop"):
        fa, fb = int(a * mo.fps), int(b * mo.fps)
        face = "travel" if np.linalg.norm((mo.root[fb] - mo.root[fa])[[0, 2]]) > 0.3 else "mean"
    else:
        face = "start"
    ft = None
    if isinstance(face, (int, float)):
        ft, face = a + face, "t"
    src = Source(mo, a, b, mirror=spec.get("mirror", False), face=face, face_t=ft, yaw_extra=spec.get("turn", 0.0), speed=rate)
    if "unturn" in spec:
        src.unturn(*spec["unturn"])
    if "src_edit" in spec:
        spec["src_edit"](src)
    rt = Retarget(rig, mo.sk)
    loop = bool(spec.get("loop"))
    frames, info = solve_clip(rt, src, loop=loop, lock_feet=spec.get("lock", True), inplace=loop or spec.get("inplace", False),
                              ik=spec.get("ik", True), hip_drop=spec.get("hip_drop", 0.0), floor=spec.get("floor"))
    if "edit" in spec:
        frames = spec["edit"](rt, frames, src)
    rots, hipsT = local_tracks(rt, frames)
    dur = (src.n - 1) / src.fps
    if loop:
        rots, hipsT = close_loop(rots, hipsT)
        nseg = max(4, int(round(dur * FPS)))
        times = np.linspace(0, dur, nseg + 1)
    else:
        hold = spec.get("hold", 0.0)
        nseg = int(round((dur + hold) * FPS))
        times = np.arange(nseg + 1) / FPS
        times = np.minimum(times, dur)
    r2, h2 = resample(rots, hipsT, src.fps, times)
    if loop:
        for k in r2:
            r2[k][-1] = r2[k][0]
        h2[-1] = h2[0]
    out_times = np.arange(nseg + 1) / FPS if not loop else times
    if not loop:
        out_times = np.arange(nseg + 1) / FPS
    total = float(out_times[-1])
    # measured moments
    m = dict(spec.get("meta", {}))
    m["duration"] = round(total, 4)
    m["loop"] = loop
    m["source"] = f"CMU {spec['trial']}" + (" (mirrored)" if spec.get("mirror") else "") + (f", {spec['adapted']}" if spec.get("adapted") else "")
    if info.get("speed") is not None and loop and info["speed"] > 0.3:
        m["speed"] = round(info["speed"], 3)
        m["travel"] = [round(v, 3) for v in info["vel"]]  # m/s, his frame (x = his left, z = forward)
    # contact markers: when each foot is planted (seconds), so a body of any
    # height can pin its feet at runtime (footballAnims.ts plantedAt)
    m["plants"] = {s: [[round(i / src.fps, 3), round(j / src.fps, 3)] for i, j in info["runs"].get(s, [])] for s in "LR"}
    if "touch_foot" in spec:
        # a touch on each stride of that foot: when it is furthest ahead of the hips
        s = spec["touch_foot"]
        ahead = [frames[i][5][rig.b["foot" + s]][2] - frames[i][5][rig.b["hips"]][2] for i in range(len(frames))]
        i = int(np.argmax(ahead))
        spec = dict(spec, touches=[(i / src.fps * rate, s)])
    for k, v in spec.get("moments", {}).items():
        m[k] = round((v - a) / rate if spec.get("abs_moments") else v / rate, 3)
    if "contact" in m and m.get("part", "foot") == "foot" and spec.get("snap", True):
        # the strike is the instant the kicking foot is fastest, near the guess
        s = m.get("foot", "R")
        pts = np.array([instep(frame_ctx(rt, frames, i), s) for i in range(len(frames))])
        v = np.zeros(len(pts))
        v[1:] = np.linalg.norm(np.diff(pts, axis=0), axis=1) * src.fps
        c = int(round(m["contact"] * src.fps))
        lo, hi = max(1, c - int(0.2 * src.fps)), min(len(v), c + int(0.2 * src.fps))
        m["contact"] = round(float((lo + int(np.argmax(v[lo:hi]))) / src.fps), 3)
        m["footSpeed"] = round(float(v[lo:hi].max()), 1)
    ctx_at = lambda t: frame_ctx(rt, frames, min(int(round(t * src.fps)), len(frames) - 1))
    if "contact" in m:
        c = ctx_at(m["contact"])
        ip = part_point(c, m)
        if m.get("part", "foot") == "foot":
            m["ball"] = [round(float(ip[0]), 3), round(float(ip[2]) + 0.09, 3)]
            m["contactFoot"] = [round(float(v), 3) for v in ip]
        m["contactPoint"] = [round(float(v), 3) for v in ip]
        m.setdefault("part", "foot")
    if "touches" in spec:
        m["touches"] = []
        for tt, s in spec["touches"]:
            tt2 = round(tt / rate, 3)
            c = ctx_at(tt2)
            p = instep(c, s) + np.array([0, 0.12, 0.03])
            m["touches"].append([tt2, s, [round(float(v), 3) for v in p]])
    if spec.get("end"):
        hp = frames[-1][5][rig.b["hips"]]
        h0 = rig.restP[rig.b["hips"]]
        m["end"] = [round(float(hp[0] - h0[0]), 3), round(float(hp[2] - h0[2]), 3)]
    baked = (name, out_times, {k: list(v) for k, v in r2.items()}, list(h2))
    return baked, m, (rt, frames, src, times)


def frame_ctx(rt, frames, i):
    W, hp, R, T, Q, P = frames[i]
    return Ctx(rt.rig, Q, P)


def instep(ctx, side):
    a, t = ctx.pos("foot" + side), ctx.pos("toe" + side)
    return a * 0.45 + t * 0.55


def part_point(ctx, m):
    part = m.get("part", "foot")
    if part == "foot":
        return instep(ctx, m.get("foot", "R"))
    if part == "head":
        return ctx.head_at((0, 0.12, 0.10))
    if part == "chest":
        return ctx.chest((0, 0.02, 0.15))
    if part.startswith("thigh"):
        s = part[-1]
        a, b = ctx.pos("thigh" + s), ctx.pos("shin" + s)
        return a + (b - a) * 0.72 + np.array([0, 0.08, 0])
    if part == "hands":
        return (ctx.pos("handL") + ctx.pos("handR")) / 2
    if part.startswith("hand"):
        return ctx.pos("hand" + part[-1])
    raise ValueError(part)


# ── stick-figure sheet of the SOLVED body (our skeleton) ─────────────────
BONES = [("hips", "spine1"), ("spine1", "spine2"), ("spine2", "spine3"), ("spine3", "neck"), ("neck", "head"),
         ("spine3", "shL"), ("shL", "armL"), ("armL", "foreL"), ("foreL", "handL"),
         ("spine3", "shR"), ("shR", "armR"), ("armR", "foreR"), ("foreR", "handR"),
         ("hips", "thighL"), ("thighL", "shinL"), ("shinL", "footL"), ("footL", "toeL"),
         ("hips", "thighR"), ("thighR", "shinR"), ("shinR", "footR"), ("footR", "toeR")]


def sheet(rows, path, cols=10):
    """rows: [(name, rt, frames, src, moments)] -> png (side + front per clip)."""
    from PIL import Image, ImageDraw
    cw, ch = 120, 170
    img = Image.new("RGB", (cols * cw, len(rows) * 2 * ch), "white")
    d = ImageDraw.Draw(img)
    for r, (name, rt, frames, src, mom) in enumerate(rows):
        n = len(frames)
        idx = [int(round(i * (n - 1) / (cols - 1))) for i in range(cols)]
        for c in mom.values():
            if isinstance(c, (int, float)):
                j = min(range(cols), key=lambda i: abs(idx[i] / src.fps - c))
                idx[j] = min(n - 1, int(round(c * src.fps)))
        for ci, f in enumerate(idx):
            W, hp, R, T, Q, P = frames[f]
            ctx = Ctx(rt.rig, Q, P)
            pts = {k: ctx.pos(k) for k in CANON}
            pts["head"] = ctx.head_top((0, -0.08, 0))
            cz = np.mean([fr[5][rt.rig.b["hips"]][2] for fr in frames])
            cx = np.mean([fr[5][rt.rig.b["hips"]][0] for fr in frames])
            for view in (0, 1):
                ox, oy = ci * cw, (r * 2 + view) * ch
                d.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], outline="#ddd")
                d.text((ox + 3, oy + 2), f"{name} {f / src.fps:.2f}", fill="black")
                sc = 70
                def pt(p):
                    if view == 0:
                        return ox + cw / 2 + (p[2] - cz) * sc, oy + ch - 12 - p[1] * sc
                    return ox + cw / 2 - (p[0] - cx) * sc, oy + ch - 12 - p[1] * sc
                d.line([ox, oy + ch - 12, ox + cw, oy + ch - 12], fill="#8c8")
                for a, b in BONES:
                    col = "red" if a.endswith("R") or b.endswith("R") else ("blue" if a.endswith("L") or b.endswith("L") else "black")
                    d.line([pt(pts[a]), pt(pts[b])], fill=col, width=3)
                hx, hy = pt(pts["head"])
                d.ellipse([hx - 7, hy - 7, hx + 7, hy + 7], outline="black", width=2)
    img.save(path)
