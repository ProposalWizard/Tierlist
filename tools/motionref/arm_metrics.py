"""How robotic are the arms? The same numbers for our cut scenes and for real people.

  python3 tools/motionref/arm_metrics.py game  dump.json  [actor ...]   # from dump-arms.mjs
  python3 tools/motionref/arm_metrics.py video poses.npz  [person ...]  # from pose_video.py

Both are reduced to the same points (shoulders, elbows, wrists, chest) and the
same low-pass filter (6 Hz), so a number means the same thing for both:

  frozen   share of the time a wrist moves under 2 cm/s against the chest
           (a hand pinned by IK, or arms hanging dead). Real people, standing
           still, sit near 0.05-0.3: something always drifts.
  sparc    smoothness of each wrist's speed (spectral arc length; closer to 0 =
           smoother, a real reach is about -1.6 to -2.5; snaps and steps go
           far below -4).
  jerk     95th percentile of the wrist's jerk against the chest, m/s^3.
  lag_ms   how long the elbow's bend follows the upper arm's swing (cross-
           correlation of their angular speeds). Real arms: the lower part
           follows a little later (overlapping action, ~30-120 ms); a solved
           IK arm moves every joint at once (0) or the wrong way round.
  rest     mean elbow bend while the wrist is still, degrees (a relaxed arm
           ~10-25; a locked straight arm ~0-5).
"""
import json
import sys

import numpy as np

FILT_HZ = 6.0


def lowpass(x, fps, hz=FILT_HZ):
    """Zero-phase 2nd-order Butterworth, numpy only (forward + backward)."""
    w = np.tan(np.pi * hz / fps)
    k1 = np.sqrt(2) * w
    k2 = w * w
    a0 = 1 + k1 + k2
    b = np.array([k2, 2 * k2, k2]) / a0
    a = np.array([1, 2 * (k2 - 1) / a0, (1 - k1 + k2) / a0])

    def run(y):
        out = np.zeros_like(y)
        x1 = x2 = y[0]
        y1 = y2 = y[0]
        for i in range(len(y)):
            v = b[0] * y[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
            x2, x1 = x1, y[i]
            y2, y1 = y1, v
            out[i] = v
        return out

    x = np.asarray(x, float)
    if x.ndim == 1:
        return run(run(x)[::-1])[::-1]
    return np.stack([run(run(x[:, j])[::-1])[::-1] for j in range(x.shape[1])], axis=1)


def sparc(speed, fps, fc=10.0, amp_th=0.05, pad=4):
    """Spectral arc length (Balasubramanian et al. 2015)."""
    s = np.asarray(speed, float)
    if s.max() < 1e-6:
        return 0.0
    n = int(2 ** (np.ceil(np.log2(len(s))) + pad))
    f = np.arange(0, fps, fps / n)
    m = np.abs(np.fft.fft(s, n))
    m = m / m.max()
    sel = f <= fc
    f, m = f[sel], m[sel]
    idx = np.nonzero(m >= amp_th)[0]
    hi = idx[-1] if len(idx) else len(f) - 1
    f, m = f[: hi + 1], m[: hi + 1]
    df = np.diff(f) / (f[-1] - f[0] + 1e-9)
    dm = np.diff(m)
    return float(-np.sum(np.sqrt(df ** 2 + dm ** 2)))


def chest_frame(Ls, Rs, chest):
    """Rows: across (to his left), up, forward."""
    across = Ls - Rs
    across /= np.linalg.norm(across, axis=1, keepdims=True) + 1e-9
    up = (Ls + Rs) / 2 - chest
    up -= across * np.sum(up * across, axis=1, keepdims=True)
    up /= np.linalg.norm(up, axis=1, keepdims=True) + 1e-9
    fwd = np.cross(across, up)
    return np.stack([across, up, fwd], axis=1)  # (n,3,3)


def side_metrics(S, E, W, F, fps):
    """S/E/W: shoulder, elbow, wrist world points (n,3); F: chest frames."""
    rel = lambda p: np.einsum("nij,nj->ni", F, p - S)
    e, w = rel(E), rel(W)
    up = e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-9)
    fo = (w - e)
    fo /= np.linalg.norm(fo, axis=1, keepdims=True) + 1e-9
    bend = np.degrees(np.arccos(np.clip(np.sum(up * fo, axis=1), -1, 1)))
    v = np.gradient(w, 1 / fps, axis=0)
    spd = np.linalg.norm(v, axis=1)
    jerk = np.linalg.norm(np.gradient(np.gradient(v, 1 / fps, axis=0), 1 / fps, axis=0), axis=1)
    om_u = np.degrees(np.arccos(np.clip(np.sum(up[1:] * up[:-1], axis=1), -1, 1))) * fps
    om_b = np.abs(np.diff(bend)) * fps
    still = spd < 0.02
    # lag: elbow speed behind the upper arm's swing
    lag = 0.0
    a, b = om_u - om_u.mean(), om_b - om_b.mean()
    if a.std() > 1e-6 and b.std() > 1e-6:
        L = int(0.3 * fps)
        cs = [np.dot(a[max(0, -k): len(a) - max(0, k)], b[max(0, k): len(b) - max(0, -k)]) for k in range(-L, L + 1)]
        lag = (int(np.argmax(cs)) - L) / fps * 1000
    return dict(frozen=float(still.mean()), sparc=sparc(spd, fps), jerk=float(np.percentile(jerk, 95)),
                lag_ms=lag, rest=float(bend[still].mean()) if still.any() else float("nan"),
                speed=float(spd.mean()), swing=float(om_u.mean()))


def report(name, P, fps):
    P = {k: lowpass(v, fps) for k, v in P.items()}
    F = chest_frame(P["Ls"], P["Rs"], P["chest"])
    out = {}
    for s in "LR":
        out[s] = side_metrics(P[s + "s"], P[s + "e"], P[s + "w"], F, fps)
    m = {k: (out["L"][k] + out["R"][k]) / 2 for k in out["L"]}
    print(f"{name:28s} frozen {m['frozen']:.2f}  sparc {m['sparc']:6.2f}  jerk95 {m['jerk']:6.1f}  lag {m['lag_ms']:6.0f} ms  "
          f"rest-bend {m['rest']:5.1f}  wrist {m['speed']:.2f} m/s  swing {m['swing']:5.1f} deg/s")
    return m


def from_game(path, only):
    d = json.load(open(path))
    fps = d["fps"]
    res = {}
    for aid, B in d["actors"].items():
        if only and aid not in only:
            continue
        if any(x is None for x in B["LeftArm"]):
            continue
        pt = lambda b: np.array([r[4:7] for r in B[b]], float)
        P = {"Ls": pt("LeftArm"), "Rs": pt("RightArm"), "Le": pt("LeftForeArm"), "Re": pt("RightForeArm"),
             "Lw": pt("LeftHand"), "Rw": pt("RightHand"), "chest": pt("Spine02")}
        res[aid] = report(f"{path.split('/')[-1]}:{aid}", P, fps)
    return res


def from_video(path, only):
    z = np.load(path, allow_pickle=True)
    fps = float(z["fps"])
    res = {}
    for pid in z["people"]:
        pid = str(pid)
        if only and pid not in only:
            continue
        X = z[f"world_{pid}"]  # (n,33,3) metres, y up
        ok = z[f"ok_{pid}"]
        if ok.mean() < 0.6:
            continue
        X = X[ok]
        P = {"Ls": X[:, 11], "Rs": X[:, 12], "Le": X[:, 13], "Re": X[:, 14], "Lw": X[:, 15], "Rw": X[:, 16],
             "chest": (X[:, 23] + X[:, 24]) / 2 * 0.45 + (X[:, 11] + X[:, 12]) / 2 * 0.55}
        res[pid] = report(f"{path.split('/')[-1]}:{pid}", P, fps)
    return res


if __name__ == "__main__":
    kind, path, *only = sys.argv[1:]
    (from_game if kind == "game" else from_video)(path, set(only))
