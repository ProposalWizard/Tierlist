"""
THE LOOK TARGET — fit the MakeHuman body to a reference footballer mesh.

Harry, 9 Oct 2026, after the bake-off: "ours is defo the worst out of the body
builds, it definitely needs to look more like the other ones." The reference
(an image-to-3D footballer, scratchpad/refs/3d/player.glb) has the right
proportions but cannot morph, blink or change kit. So we keep our body and
borrow its SHAPE:

  1. Pose our body into the reference's pose, bone by bone, the arms brought
     toward its length and the head to its size and place.
  2. Push every skin vertex along its normal onto the reference's surface,
     less the cloth over it (shirt, shorts, socks, cropped hair), smoothed
     (the head heavily: its overall shape only, never its features).
  3. Undo the pose. What is left is one offset per vertex in MakeHuman's own
     space: a new default shape. Every build slider still works on top.

    python3 tools/human3d/fit_a.py <mpfb2 data> <reference.npz> [out]

<reference.npz> comes from scratchpad/bake/export_a.py (Blender). Writes
tools/human3d/fit_a.npz, which build_human.py adds to every body it makes.
"""
import os, sys
import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))


def load_build(mpfb):
    """The build script's own base mesh, shapes, joints and weights (no writing)."""
    W = os.path.join(HERE, "build_human.py")
    src = open(W).read()
    src = src[:src.index("print(\"base …\")")]
    argv = sys.argv
    sys.argv = ["build_human.py", mpfb, "-"]
    g = {"__file__": W, "__name__": "fit"}
    os.environ["HUMAN_NO_FIT"] = "1"
    exec(compile(src, W, "exec"), g)
    sys.argv = argv
    return g


def unit(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-12)


def vnormals(V, T):
    N = np.zeros_like(V)
    fn = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]])
    for k in range(3):
        np.add.at(N, T[:, k], fn)
    return unit(N)


GROUP = {}
for b in ("Hips", "Spine02", "Spine01", "Spine", "LeftShoulder", "RightShoulder"):
    GROUP[b] = "torso"
GROUP["neck"] = "neck"; GROUP["Head"] = "head"
for S in ("Left", "Right"):
    GROUP[f"{S}Arm"] = f"{S}arm"; GROUP[f"{S}ForeArm"] = f"{S}arm"; GROUP[f"{S}Hand"] = f"{S}hand"
    GROUP[f"{S}UpLeg"] = f"{S}leg"; GROUP[f"{S}Leg"] = f"{S}leg"; GROUP[f"{S}Foot"] = f"{S}foot"; GROUP[f"{S}ToeBase"] = f"{S}foot"
# which reference groups a body group may land on
NEAR = {"torso": ("torso", "neck"), "neck": ("neck", "torso", "head"), "head": ("head", "neck")}
for S in ("Left", "Right"):
    NEAR[f"{S}arm"] = (f"{S}arm",); NEAR[f"{S}leg"] = (f"{S}leg", "torso"); NEAR[f"{S}hand"] = (); NEAR[f"{S}foot"] = ()

CHAIN = ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head"]
AIMS = {"Hips": "Spine02", "Spine02": "Spine01", "Spine01": "Spine", "Spine": "neck", "neck": "Head", "Head": "head_end"}
for S in ("Left", "Right"):
    AIMS.update({f"{S}Shoulder": f"{S}Arm", f"{S}Arm": f"{S}ForeArm", f"{S}ForeArm": f"{S}Hand",
                 f"{S}UpLeg": f"{S}Leg", f"{S}Leg": f"{S}Foot", f"{S}Foot": f"{S}ToeBase"})
PARENT = {"Spine02": "Hips", "Spine01": "Spine02", "Spine": "Spine01", "neck": "Spine", "Head": "neck"}
for S in ("Left", "Right"):
    PARENT.update({f"{S}Shoulder": "Spine", f"{S}Arm": f"{S}Shoulder", f"{S}ForeArm": f"{S}Arm", f"{S}Hand": f"{S}ForeArm",
                   f"{S}UpLeg": "Hips", f"{S}Leg": f"{S}UpLeg", f"{S}Foot": f"{S}Leg", f"{S}ToeBase": f"{S}Foot"})
ORDER = ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head"] + [f"{S}{b}" for S in ("Left", "Right") for b in ("Shoulder", "Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot", "ToeBase")]


def rot_between(a, b):
    a, b = unit(a), unit(b)
    v = np.cross(a, b); c = float(a @ b)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


def main():
    mpfb, ref = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "fit_a.npz")
    g = load_build(mpfb)
    V = g["shape"](g["BASE"], g["BASE_EXTRA"]) * g["DM"]          # metres, MakeHuman space
    J = g["joints_of"](V / g["DM"])
    BONE_W = g["BONE_W"]
    BODY = g["vrange"]("body")
    FACES, FGROUP = g["FACES"], g["FGROUP"]
    TB = np.array([(f[0], f[k], f[k + 1]) for f, gr in zip(FACES, FGROUP) if gr == "body" for k in range(1, len(f) - 1)])

    # ── The reference, in MakeHuman's axes (y up, facing +z), same height, feet together on our ground.
    A = np.load(ref)
    conv = lambda P: np.stack([P[..., 0], P[..., 2], -P[..., 1]], -1)
    AV = conv(A["V"]); AJ = {str(n): conv(h) for n, h in zip(A["jn"], A["jh"])}
    hA = AV[:, 1].max() - AV[:, 1].min()
    hM = V[BODY, 1].max() - V[BODY, 1].min()
    s = hM / hA
    o = np.array([AJ["Hips"][0], AV[:, 1].min(), AJ["Hips"][2]])
    t = np.array([J["Hips"][0], V[BODY, 1].min(), J["Hips"][2]])
    AV = (AV - o) * s + t
    AJ = {k: (v - o) * s + t for k, v in AJ.items()}
    print(f"reference {hA:.3f} m → {hM:.3f} m; hips at {(AJ['Hips'][1] - t[1]) / hM:.3f} of height (ours {(J['Hips'][1] - t[1]) / hM:.3f})")
    for side in ("Left",):
        for a, b in (("UpLeg", "Leg"), ("Leg", "Foot"), ("Arm", "ForeArm"), ("ForeArm", "Hand")):
            la = np.linalg.norm(AJ[side + b] - AJ[side + a]); lm = np.linalg.norm(J[side + b] - J[side + a])
            print(f"  {side}{a}: reference {la:.3f}, ours {lm:.3f}")

    # ── 1. Pose ours into the reference: each bone turned to its direction. The arms are
    # brought toward its length (shoulder to wrist, within 5%: its elbow is a guess, so
    # only the whole arm is trusted).
    # The reference's crotch is its shorts' gusset (a few cm low), so its leg length can't be read
    # off it: the legs keep MakeHuman's (real-world) length; the kit decides how long they look.
    kLeg = 1.0
    kArm = {}
    for S_ in ("Left", "Right"):
        ours = np.linalg.norm(J[S_ + "ForeArm"] - J[S_ + "Arm"]) + np.linalg.norm(J[S_ + "Hand"] - J[S_ + "ForeArm"])
        kArm[S_] = float(np.clip(np.linalg.norm(AJ[S_ + "Hand"] - AJ[S_ + "Arm"]) / ours, 0.95, 1.05))
    print(f"stretch: legs {kLeg:.3f}, arms {kArm['Left']:.3f} / {kArm['Right']:.3f}")
    R, P = {}, {}
    for b in ORDER:
        par = PARENT.get(b)
        P[b] = J[b].copy() if par is None else P[par] + R[par] @ (J[b] - J[par])
        if b in AIMS and AIMS[b] in J and AIMS[b] in AJ and not b.endswith(("Foot", "ToeBase", "Hand")):
            c = AIMS[b]
            Rr = rot_between(J[c] - J[b], AJ[c] - AJ[b])
            k = kLeg if b.endswith(("UpLeg", "Leg")) else kArm.get(b[:-3] if b.endswith("Arm") and not b.endswith("ForeArm") else b[:-7], 1.0) if "Arm" in b else 1.0
            a = unit(AJ[c] - AJ[b])
            R[b] = (np.eye(3) + (k - 1) * np.outer(a, a)) @ Rr
        else:
            R[b] = R[par] if par else np.eye(3)
    # The head: the reference's head size and place (a few rounds of nearest-point matching).
    headi = np.array([i for i in BODY if BONE_W[i] and max(BONE_W[i], key=lambda x: x[1])[0] == "Head"])
    hp = np.einsum("ij,nj->ni", R["Head"], V[headi] - J["Head"]) + P["Head"]
    dom_a0 = np.array(list(A["names"]))[A["W"].argmax(1)]
    ah = AV[dom_a0 == "Head"]
    ah_face = ah[ah[:, 1] < np.percentile(ah[:, 1], 70)]          # below the hair line
    hp_face = hp[hp[:, 1] < np.percentile(hp[:, 1], 70)]
    tr_h = cKDTree(ah_face)
    sc, sh = 1.0, np.zeros(3)
    c0 = hp_face.mean(0)
    for _ in range(25):
        q = (hp_face - c0) * sc + c0 + sh
        _, j = tr_h.query(q)
        tgt = ah_face[j]
        sh += (tgt - q).mean(0) * 0.8
        num = ((q - q.mean(0)) * (tgt - tgt.mean(0))).sum(); den = ((q - q.mean(0)) ** 2).sum()
        sc *= float(np.clip(1 + (num / den - 1) * 0.5, 0.97, 1.03))
    sc = float(np.clip(sc, 0.9, 1.15))
    print(f"head: scale {sc:.3f}, shift {np.round(sh * 100, 1)} cm")
    # fold it into the Head bone: x' = sc*(R(x-J)+P - c0) + c0 + sh
    R["Head"] = sc * R["Head"]
    P["Head"] = sc * (P["Head"] - c0) + c0 + sh
    # every vertex: blended affine (M, tr) so posed = M @ v + tr
    n = len(V)
    M = np.zeros((n, 3, 3)); TR = np.zeros((n, 3))
    for i, lst in enumerate(BONE_W):
        for b, w in lst:
            if b not in R:   # fingers follow their hand
                bb = "LeftHand" if b.startswith("LeftHand") else "RightHand" if b.startswith("RightHand") else b
                Rb, Pb, Jb = R[bb], P[bb], J[bb]
            else:
                Rb, Pb, Jb = R[b], P[b], J[b]
            M[i] += w * Rb; TR[i] += w * (Pb - Rb @ Jb)
    Vp = np.einsum("nij,nj->ni", M, V) + TR

    # ── 2. Onto the reference's surface, less the cloth.
    AT = A["T"]; TUV = A["TUV"]; tex = A["tex"]
    dom_a = np.array(list(A["names"]))[A["W"].argmax(1)]
    rng = np.random.default_rng(1)
    k = 24
    r1 = rng.random((len(AT), k)); r2 = rng.random((len(AT), k))
    flip = r1 + r2 > 1; r1[flip] = 1 - r1[flip]; r2[flip] = 1 - r2[flip]
    a0, a1, a2 = AV[AT[:, 0]], AV[AT[:, 1]], AV[AT[:, 2]]
    pts = a0[:, None] + r1[..., None] * (a1 - a0)[:, None] + r2[..., None] * (a2 - a0)[:, None]
    uvs = TUV[:, 0][:, None] + r1[..., None] * (TUV[:, 1] - TUV[:, 0])[:, None] + r2[..., None] * (TUV[:, 2] - TUV[:, 0])[:, None]
    pts = pts.reshape(-1, 3); uvs = uvs.reshape(-1, 2)
    grp_a = np.repeat(np.array([GROUP.get(str(dom_a[t[0]]), "torso") for t in AT]), k)
    H, Wd = tex.shape[:2]
    col = tex[np.clip(((1 - uvs[:, 1]) * (H - 1)).astype(int), 0, H - 1), np.clip((uvs[:, 0] * (Wd - 1)).astype(int), 0, Wd - 1)].astype(float) / 255
    mx, mn = col.max(1), col.min(1); sat = (mx - mn) / np.maximum(mx, 1e-3); lum = col @ [0.299, 0.587, 0.114]
    hy = pts[:, 1] - t[1]
    kitred = (col[:, 0] > 0.25) & (col[:, 0] > col[:, 1] * 1.9) & (sat > 0.55)
    hair = (lum < 0.16) & (hy > 0.92 * hM)
    # cloth thickness under each reference point (metres)
    cloth = np.zeros(len(pts))
    cloth[kitred & (hy > 0.5 * hM)] = 0.009                              # shirt and shorts
    cloth[kitred & (hy <= 0.5 * hM)] = 0.004                             # socks (shin pads under them)
    cloth[hair] = 0.004
    trees = {gname: (cKDTree(pts[grp_a == gname]), np.nonzero(grp_a == gname)[0]) for gname in set(grp_a)}

    NB = vnormals(Vp, TB)
    dom = np.array([max(w, key=lambda x: x[1])[0] if w else "Hips" for w in BONE_W])
    d = np.zeros(n); ok = np.zeros(n, bool)
    for gname in set(GROUP.values()):
        sel = np.array([i for i in BODY if GROUP.get(dom[i], "hand" if "Hand" in dom[i] else "torso") == gname])
        if not len(sel):
            continue
        cands = [trees[x] for x in NEAR.get(gname, ()) if x in trees]
        if not cands:
            continue
        def nearest(Q):
            best_d = np.full(len(Q), np.inf); best_j = np.zeros(len(Q), int)
            for tr, idx in cands:
                dd, jj = tr.query(Q)
                better = dd < best_d
                best_d[better] = dd[better]; best_j[better] = idx[jj[better]]
            return best_d, best_j
        # Line the segment up with the reference first (a shift only): the fit then
        # changes its SHAPE, not where it is (the bones decided that).
        sh_g = np.zeros(3)
        if gname != "head":
            for _ in range(8):
                _, j = nearest(Vp[sel] + sh_g)
                sh_g += np.median(pts[j] - (Vp[sel] + sh_g), axis=0) * 0.8
        best_d, best_j = nearest(Vp[sel] + sh_g)
        q = pts[best_j] - sh_g
        dn = np.einsum("ij,ij->i", q - Vp[sel], NB[sel]) - cloth[best_j]
        good = best_d < 0.06
        d[sel[good]] = dn[good]; ok[sel[good]] = True
    # The head keeps our own face (the reference's features are painted on a rough surface:
    # fitted to, they come out mangled); it takes only the reference's head size and place.
    ok[headi] = False
    d[~ok] = 0
    # smooth along the body surface (weights fade at the edges of what was fitted);
    # the head much more: only its overall shape is taken, never the reference's features.
    from scipy.sparse import coo_matrix, diags
    rows = np.concatenate([TB[:, 0], TB[:, 1], TB[:, 2], TB[:, 1], TB[:, 2], TB[:, 0]])
    cols = np.concatenate([TB[:, 1], TB[:, 2], TB[:, 0], TB[:, 0], TB[:, 1], TB[:, 2]])
    Adj = coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(n, n)).tocsr()
    Adj.data[:] = 1
    deg = np.asarray(Adj.sum(1)).ravel()
    L = diags(1 / np.maximum(deg, 1)) @ Adj
    w0 = ok.astype(float)
    dd = d * w0; ww = w0.copy()
    isHead = np.zeros(n, bool); isHead[headi] = True
    for it in range(80):
        m = np.ones(n) if it < 12 else isHead.astype(float)
        dd = dd + 0.5 * m * (L @ dd - dd); ww = ww + 0.5 * m * (L @ ww - ww)
    d = np.where(ww > 1e-3, dd / np.maximum(ww, 1e-3), 0) * np.clip(ww * 3, 0, 1)
    d = np.clip(d, -0.035, 0.035)
    Vf = Vp.copy()
    Vf[BODY] += NB[BODY] * d[BODY, None]
    print(f"fit: {ok.sum()} of {len(BODY)} skin points matched; move mean {np.abs(d[BODY]).mean() * 100:.2f} cm, max {np.abs(d[BODY]).max() * 100:.1f} cm")

    # ── 3. Undo the pose: back into MakeHuman's own space.
    Minv = np.linalg.inv(M)
    Vr = np.einsum("nij,nj->ni", Minv, Vf - TR)
    FIT = Vr - V
    # The head: the reference's head SIZE only (the pose above is undone, so its place and
    # lean never come back as a forward-hunched neck). Scaled round the head joint, fading
    # down the neck with the head bone's own weight; the face's features stay ours.
    hw = np.array([sum(w for b, w in lst if b == "Head") for lst in BONE_W])
    FIT += (sc - 1) * (V - J["Head"]) * hw[:, None]
    # every non-body point (joint cubes, helpers) follows the nearest skin
    tree = cKDTree(V[BODY])
    rest = np.setdiff1d(np.arange(n), BODY)
    dq, jq = tree.query(V[rest], k=8)
    wq = 1 / np.maximum(dq, 1e-3); wq /= wq.sum(1, keepdims=True)
    FIT[rest] = (FIT[BODY][jq] * wq[..., None]).sum(1)
    np.savez_compressed(out, fit=(FIT / g["DM"]).astype(np.float32))   # decimetres, MakeHuman units
    if os.environ.get("FIT_DEBUG"):
        np.savez_compressed(os.environ["FIT_DEBUG"], Vp=Vp, Vf=Vf, Vr0=V, Vr1=V + FIT, AV=AV, AT=AT, TB=TB)
    print("wrote", out)


if __name__ == "__main__":
    main()
