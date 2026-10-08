"""Keyframe curves for authoring: smooth (Catmull-Rom) through keys."""
import numpy as np


def K(keys, t, loop=None):
    """keys: [(time, value), ...] (value a number or a list). Catmull-Rom through
    them; held flat before the first and after the last. loop=period wraps."""
    ts = [k[0] for k in keys]
    vs = [np.asarray(k[1], float) for k in keys]
    if loop:
        t = t % loop
        # pad with wrapped neighbours
        ts = [ts[-2] - loop] + ts + [ts[1] + loop]
        vs = [vs[-2]] + vs + [vs[1]]
    else:
        if t <= ts[0]:
            return vs[0].copy() if vs[0].ndim else float(vs[0])
        if t >= ts[-1]:
            return vs[-1].copy() if vs[-1].ndim else float(vs[-1])
        ts = [ts[0] - (ts[1] - ts[0])] + ts + [ts[-1] + (ts[-1] - ts[-2])]
        vs = [vs[0]] + vs + [vs[-1]]
    i = 1
    while i < len(ts) - 2 and t > ts[i + 1]:
        i += 1
    t0, t1, t2, t3 = ts[i - 1], ts[i], ts[i + 1], ts[i + 2]
    p0, p1, p2, p3 = vs[i - 1], vs[i], vs[i + 1], vs[i + 2]
    u = (t - t1) / max(1e-9, t2 - t1)
    # non-uniform Catmull-Rom tangents (clamped near flat keys: no overshoot past a hold)
    m1 = (p2 - p0) / max(1e-9, t2 - t0) * (t2 - t1)
    m2 = (p3 - p1) / max(1e-9, t3 - t1) * (t2 - t1)
    u2, u3 = u * u, u * u * u
    v = (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2
    return v if v.ndim else float(v)


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def lerp(a, b, k):
    return np.asarray(a, float) + (np.asarray(b, float) - np.asarray(a, float)) * k


def foot(t, events, rest, lift_h=0.12, heel=0.55, land_pitch=-0.25):
    """A walking/running foot. events: [(t_lift, t_land, to_xz, height?), ...] in time
    order; the foot starts at `rest` (x, z). Returns (ankle [x, lift, z], pitch, toe bend).
    Before each lift the heel peels up (pitch toes-down, toes bend); a landing
    comes in heel first and the toe slaps down after it."""
    at = np.array([rest[0], 0.0, rest[1]], float)
    landed = -1e9
    for ev in events:
        tl, td, to = ev[0], ev[1], ev[2]
        h = ev[3] if len(ev) > 3 else lift_h
        dst = np.array([to[0], 0.0, to[1]], float)
        if t < tl:
            k = ease((t - (tl - 0.12)) / 0.12)
            settle = 1 - ease((t - landed) / 0.1)
            pitch = heel * k + land_pitch * settle
            a = at.copy()
            a[1] = 0.1 * max(0.0, np.sin(heel * k))
            return a, pitch, heel * k
        if t < td:
            u = (t - tl) / (td - tl)
            a = lerp(at, dst, ease(u) * 0.85 + u * 0.15)
            a[1] = h * np.sin(np.pi * u) ** 0.8 + 0.06 * (1 - u)
            pitch = K([(0, heel), (0.35, 0.35), (0.8, 0.0), (1, land_pitch)], u)
            return a, pitch, heel * max(0.0, 1 - u * 4)
        at = dst
        landed = td
    settle = 1 - ease((t - landed) / 0.1)
    return at.copy(), land_pitch * settle, 0.0
