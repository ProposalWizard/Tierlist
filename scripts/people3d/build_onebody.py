"""
THE ONE BODY — the in-game footballer (and manager) for every 3D scene.

    python3 scripts/people3d/build_onebody.py

Harry, 5 Oct 2026: "the model has to be the same as the 3D shop, and we need
to use the same models across all cutscenes and 3D sections … They have
really wide torsos and thin waists … When he picks up the pen, his fingers
obviously don't move."

Reads the approved people (public/star/people3d/{player,player-buzz,
player-long,manager}.glb — the same characters the match sprites are baked
from) and writes public/star/onebody/ with three changes:

  1. Build: a normal torso. The waist is filled out and the lats and
     shoulders brought in a little (a smooth width change by height, measured
     on the body: see FIELD). The arms move in with the shoulders, bones and
     all, so nothing tears. The legs, head and hands are untouched.
  2. Fingers: 15 new bones a hand (index, middle, ring, little: 3 each;
     thumb: 3), found on the mesh itself (the fingers are modelled apart) and
     skinned to it. scene.extras.fingers carries each bone's name and the
     axes it bends about, in rest-pose world space.
  3. Small: positions and normals stored as 16-bit numbers in the skinned
     mesh's own frame (KHR_mesh_quantization), so the four files together are
     about the size of the old ones.

The textures, the clips (people3d/anims.glb) and every measurement the game
reads (face heights, kit lines, hands) are kept, so lib/star/people3d.ts dresses
and animates it exactly as before. The old files stay where they are for
Settings → Look → "3D people: Old".
"""
import json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import glb  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "..", "public", "star", "people3d")
OUT = os.path.join(HERE, "..", "..", "public", "star", "onebody")
os.makedirs(OUT, exist_ok=True)

# Width (x) multiplier by rest height y, for the trunk. Measured on player.glb
# (front widths, arms left out): waist 0.267 m at y 1.15 against 0.36 m across
# the lats at 1.33 and 0.46 m across the shoulders: a body-builder's taper.
# These points take the waist to ~0.30 and the lats to ~0.33 (an ordinary
# fit man's), the shoulders in by ~2 cm.
FIELD = {
    "player": [(0.97, 1.0), (1.04, 1.05), (1.10, 1.10), (1.19, 1.11), (1.26, 1.03), (1.31, 0.94), (1.38, 0.93), (1.45, 0.955), (1.52, 1.0)],
    "manager": [(0.99, 1.0), (1.10, 1.03), (1.20, 1.05), (1.30, 1.02), (1.40, 0.965), (1.47, 0.96), (1.53, 1.0)],
}
FIELD["player-buzz"] = FIELD["player"]
FIELD["player-long"] = FIELD["player"]

FINGERS = ["index", "middle", "ring", "little"]


def field(name, y):
    ys, ss = zip(*FIELD[name])
    return np.interp(y, ys, ss)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def unit(v):
    return v / np.linalg.norm(v)


def kmeans1d(x, k, it=40):
    c = np.quantile(x, np.linspace(0.08, 0.92, k))
    for _ in range(it):
        lab = np.argmin(np.abs(x[:, None] - c[None, :]), 1)
        c = np.array([x[lab == i].mean() if (lab == i).any() else c[i] for i in range(k)])
    return np.argmin(np.abs(x[:, None] - c[None, :]), 1), c


def build(name):
    j, b = glb.read(os.path.join(SRC, name + ".glb"))
    prim = j["meshes"][0]["primitives"][0]
    A = prim["attributes"]
    P = glb.accessor(j, b, A["POSITION"]).astype(np.float64)
    N = glb.accessor(j, b, A["NORMAL"]).astype(np.float32)
    UV = glb.accessor(j, b, A["TEXCOORD_0"]).astype(np.float32)
    JN = glb.accessor(j, b, A["JOINTS_0"]).astype(np.int32)
    WT = glb.accessor(j, b, A["WEIGHTS_0"]).astype(np.float64)
    WT = WT / np.maximum(WT.sum(1, keepdims=True), 1e-9)
    I = glb.accessor(j, b, prim["indices"]).reshape(-1)
    ex = j["scenes"][0]["extras"]
    sk = j["skins"][0]
    joints = list(sk["joints"])
    names = [j["nodes"][i]["name"] for i in joints]
    ibm = glb.accessor(j, b, sk["inverseBindMatrices"]).reshape(-1, 4, 4).astype(np.float64)
    Mw = [np.linalg.inv(M.T) for M in ibm]  # bind world matrices
    nodes = [dict(n) for n in j["nodes"]]
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            parent[c] = i
    bi = {n: k for k, n in enumerate(names)}
    wof = lambda bone: ((JN == bi[bone]) * WT).sum(1)

    # ── 1. The build ──
    cx = float(ex["joints"]["Hips"][0])
    s = field(name, P[:, 1])
    side = np.sign(P[:, 0] - cx)
    armw = np.zeros(len(P))
    for sd in ("Left", "Right"):
        armw += wof(sd + "Arm") + wof(sd + "ForeArm") + wof(sd + "Hand") + 0.5 * wof(sd + "Shoulder")
    armw = np.clip(armw, 0, 1)
    shift = {}
    for sd, sg in (("Left", 1), ("Right", -1)):
        jp = Mw[bi[sd + "Arm"]][:3, 3]
        shift[sg] = float((field(name, jp[1]) - 1) * (jp[0] - cx))
    arm_dx = np.where(side > 0, shift[1], shift[-1])
    dx = (1 - armw) * (P[:, 0] - cx) * (s - 1) + armw * arm_dx
    P[:, 0] += dx
    # The arm chains move with them: LeftArm's translation (in LeftShoulder's
    # frame), and every bind matrix down the arm.
    for sd, sg in (("Left", 1), ("Right", -1)):
        d = np.array([shift[sg], 0, 0])
        ni = joints[bi[sd + "Arm"]]
        Pm = Mw[bi[sd + "Shoulder"]]
        loc = np.linalg.inv(Pm[:3, :3]) @ d
        nodes[ni]["translation"] = [float(v) for v in np.array(nodes[ni]["translation"]) + loc]
        for bone in (sd + "Arm", sd + "ForeArm", sd + "Hand"):
            Mw[bi[bone]][:3, 3] += d
    print(f"{name}: arms in by {shift[1] * 1000:.1f} / {-shift[-1] * 1000:.1f} mm")

    # ── 2. Fingers ──
    newbones = []  # (name, parentJointIndex, worldPoint)
    fingers_meta = {}

    extra_w = []  # list of (boneIndex, weight array) to merge after
    for hs, bone in (("L", "LeftHand"), ("R", "RightHand")):
        hm = ex["hands"][hs]
        wr = Mw[bi[bone]][:3, 3]
        al, pa, th = (np.array(hm[k]) for k in ("along", "palm", "thumb"))
        Q = P - wr
        a, sv, pv = Q @ al, Q @ th, Q @ pa
        hw = wof(bone)
        H = hw > 0.02
        meta = {}

        # Fingers: the outer part of the hand (past the palm), split four ways.
        amax = float(np.quantile(a[H], 0.995))
        far = H & (a > amax - 0.05)
        slope = 0.4
        lab, c = kmeans1d(sv[far] - slope * a[far], 4)
        order = np.argsort(-c)  # index (thumb side, +s) first
        lines = []
        for fi, k in enumerate(order):
            m = np.where(far)[0][lab == k]
            fa = a[m]
            # The finger's centre line: through the middle of its lowest and
            # highest centimetre (a straight fit leans out past the palm).
            lo_m, hi_m = fa < fa.min() + 0.012, fa > fa.max() - 0.012
            a0, a1 = fa[lo_m].mean(), fa[hi_m].mean()
            ks = np.array([(sv[m][hi_m].mean() - sv[m][lo_m].mean()) / (a1 - a0), 0.0])
            ks[1] = sv[m][lo_m].mean() - ks[0] * a0
            kp = np.array([(pv[m][hi_m].mean() - pv[m][lo_m].mean()) / (a1 - a0), 0.0])
            kp[1] = pv[m][lo_m].mean() - kp[0] * a0
            lines.append({"ks": ks, "kp": kp, "tip": float(fa.max())})
        # The web: walking back from the tips down the gap between each pair of
        # fingers, the first skin met.
        tipmin = min(L["tip"] for L in lines)
        webs = []
        for k in range(3):
            A0, A1 = lines[k], lines[k + 1]
            for at in np.arange(tipmin - 0.012, tipmin - 0.09, -0.001):
                mid = 0.5 * (np.polyval(A0["ks"], at) + np.polyval(A1["ks"], at))
                pm = 0.5 * (np.polyval(A0["kp"], at) + np.polyval(A1["kp"], at))
                hit = H & (np.abs(a - at) < 0.0015) & (np.abs(sv - mid) < 0.0015) & (np.abs(pv - pm) < 0.02)
                if hit.any():
                    webs.append(at)
                    break
        # (The gap search above only reports. The knuckles themselves sit at a
        # fixed share of the hand, as on a real one: 53% of the way from the
        # wrist to the longest finger's tip.)
        mcp_a = 0.53 * max(L["tip"] for L in lines)
        web = mcp_a + 0.016
        # The thumb's tip: the point of the hand below the web that stands
        # furthest out from the palm, sideways (thumb side) or in front of it.
        below = H & (a > 0.015) & (a < web + 0.005)
        s_idx = np.polyval(lines[0]["ks"], a)
        pmed = float(np.median(pv[below]))
        stick = np.maximum(sv - s_idx, 0) + np.maximum(pv - pmed, 0) * 1.2
        cand_i = np.where(below)[0]
        thumb_tip_i = cand_i[np.argmax(stick[cand_i])]
        # The thumb: CMC, MCP, IP on the line from its root to its tip (3D).
        T = Q[thumb_tip_i]
        C = T * 0.22
        C = C - pa * (C @ pa) + pa * float(np.median(pv[below & (a < 0.04)]))
        seg_v = T - C
        Tl = float(np.linalg.norm(seg_v))
        Tu = seg_v / Tl
        tt = ((Q - C) @ Tu) / Tl
        perp = np.linalg.norm((Q - C) - np.outer((Q - C) @ Tu, Tu), axis=1)
        rad = 0.026 - 0.01 * np.clip(tt, 0, 1)  # thicker at the root
        thumbsel = H & (tt > -0.1) & (tt < 1.1) & (perp < rad)
        jt = [0.0, 0.5, 0.76]
        tp = [wr + C + seg_v * x for x in jt]
        dT = Tu
        flex = unit(np.cross(dT, pa))
        swing = unit(pa - dT * (pa @ dT))
        # positive swing takes the tip towards the fingers (along)
        rot = lambda v, ax, ang: v * np.cos(ang) + np.cross(ax, v) * np.sin(ang) + ax * (ax @ v) * (1 - np.cos(ang))
        if rot(dT, swing, 0.2) @ al < dT @ al:
            swing = -swing
        # positive flex takes the tip towards the palm side
        if rot(dT, flex, 0.2) @ pa < dT @ pa:
            flex = -flex
        tb = [f"{bone}Thumb{k + 1}" for k in range(3)]
        for k in range(3):
            newbones.append((tb[k], bone if k == 0 else tb[k - 1], tp[k]))
        fade = 1 - smooth(rad - 0.005, rad, perp)
        g0 = smooth(-0.1, 0.25, tt) * fade
        g1 = smooth(jt[1] - 0.06, jt[1] + 0.06, tt)
        g2 = smooth(jt[2] - 0.05, jt[2] + 0.05, tt)
        tseg = [g0 * (1 - g1), g0 * g1 * (1 - g2), g0 * g2]
        for k in range(3):
            extra_w.append((tb[k], np.where(thumbsel, hw * tseg[k], 0.0), bone))
        meta["thumb"] = {"bones": tb, "axis": [round(float(v), 5) for v in flex], "swing": [round(float(v), 5) for v in swing],
                         "dir": [round(float(v), 5) for v in dT], "len": round(Tl, 4)}

        # Which finger each other vertex follows (nearest line across).
        dist = np.stack([np.abs(sv - np.polyval(L["ks"], a)) for L in lines], 1)
        near = np.argmin(dist, 1)
        mind = dist[np.arange(len(P)), near]
        for fi, L in enumerate(lines):
            fname = FINGERS[fi]
            tip = L["tip"]
            ln = tip - mcp_a
            ja = [mcp_a, mcp_a + 0.45 * ln, mcp_a + 0.76 * ln]
            def pt(aa, L=L):
                # kept inside the hand's own width at that height
                sl = H & (np.abs(a - aa) < 0.004) & ~thumbsel
                s_ = np.polyval(L["ks"], aa)
                if sl.sum() > 4:
                    s_ = float(np.clip(s_, sv[sl].min() + 0.008, sv[sl].max() - 0.008))
                return wr + al * aa + th * s_ + pa * np.polyval(L["kp"], aa)
            pts = [pt(x) for x in ja]
            d = unit(pt(tip) - pt(mcp_a))
            axis = unit(np.cross(d, pa))
            if rot(d, axis, 0.2) @ pa < d @ pa:
                axis = -axis
            bnames = [f"{bone}{fname.capitalize()}{k + 1}" for k in range(3)]
            for k in range(3):
                newbones.append((bnames[k], bone if k == 0 else bnames[k - 1], pts[k]))
            mine = H & ~thumbsel & (near == fi) & (a > mcp_a - 0.014) & (mind < 0.03)
            f0 = smooth(mcp_a - 0.012, mcp_a + 0.008, a)
            f1 = smooth(ja[1] - 0.005, ja[1] + 0.005, a)
            f2 = smooth(ja[2] - 0.004, ja[2] + 0.004, a)
            seg = [f0 * (1 - f1), f1 * (1 - f2), f2]
            for k in range(3):
                extra_w.append((bnames[k], np.where(mine, hw * seg[k], 0.0), bone))
            meta[fname] = {"bones": bnames, "axis": [round(float(v), 5) for v in axis], "dir": [round(float(v), 5) for v in d],
                           "len": round(float(ln), 4)}
        meta["web"] = round(float(web), 4)
        fingers_meta[hs] = meta
        print(f"  {hs} hand: web {web:.3f}, tips {[round(L['tip'], 3) for L in lines]}, thumb tip {np.round(T @ np.stack([al, th, pa], 1), 3)}")

    # New joints: nodes (children of their parent bone), bind matrices.
    for bname, pname, wpt in newbones:
        pj = names.index(pname)
        Mp = Mw[pj]
        Mf = Mp.copy()
        Mf[:3, 3] = wpt
        loc = np.linalg.inv(Mp) @ np.append(wpt, 1.0)
        ni = len(nodes)
        nodes.append({"name": bname, "translation": [float(v) for v in loc[:3]], "rotation": [0, 0, 0, 1]})
        pn = joints[pj]
        nodes[pn].setdefault("children", []).append(ni)
        joints.append(ni)
        names.append(bname)
        Mw.append(Mf)

    # Weights: each finger bone takes its share of the hand's weight.
    nb = len(names)
    Wfull = np.zeros((len(P), nb))
    for k in range(4):
        np.add.at(Wfull, (np.arange(len(P)), JN[:, k]), WT[:, k])
    for bname, w, hand in extra_w:
        Wfull[:, names.index(bname)] += w
        Wfull[:, names.index(hand)] -= w
    Wfull = np.clip(Wfull, 0, None)
    top = np.argsort(-Wfull, 1)[:, :4]
    tw = np.take_along_axis(Wfull, top, 1)
    tw = tw / np.maximum(tw.sum(1, keepdims=True), 1e-9)
    wq = np.floor(tw * 255).astype(np.int32)
    rem = 255 - wq.sum(1)
    order = np.argsort(-(tw * 255 - wq), 1)
    for k in range(4):
        add = rem > k
        wq[np.arange(len(wq))[add], order[add, k]] += 1
    top = np.where(wq > 0, top, 0)

    # Joint positions for the extras (the game reads shoulders, elbows, wrists).
    jp = {n: [round(float(v), 4) for v in Mw[k][:3, 3]] for k, n in enumerate(names)}

    # ── 3. Write: quantized (KHR_mesh_quantization) ──
    # Positions as 16-bit steps of one size on every axis, normals as bytes,
    # uvs as 16-bit 0..1. A skinned mesh ignores its node's transform, so the
    # decode (scale + offset) is folded into every inverse bind matrix, as the
    # extension says; people3d.ts turns them back into metres on load (the
    # body's shader reads rest-pose metres).
    w = glb.Writer()
    lo = P.min(0)
    sc = float((P.max(0) - lo).max() / 65535.0)
    Pq = np.zeros((len(P), 4), np.uint16)
    Pq[:, :3] = np.round((P - lo) / sc).astype(np.uint16)
    Nn = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    Nq = np.zeros((len(P), 4), np.int8)
    Nq[:, :3] = np.round(Nn * 127).astype(np.int8)
    UVq = np.round(np.clip(UV, 0, 1) * 65535).astype(np.uint16)

    def strided(arr, ctype, type_, normalized=False, minmax=None):
        v = w.view(np.ascontiguousarray(arr).tobytes(), 34962)
        w.views[v]["byteStride"] = arr.shape[1] * arr.dtype.itemsize
        a_ = {"bufferView": v, "componentType": ctype, "count": int(arr.shape[0]), "type": type_}
        if normalized:
            a_["normalized"] = True
        if minmax:
            a_["min"], a_["max"] = minmax
        w.accessors.append(a_)
        return len(w.accessors) - 1

    acc = {
        "POSITION": strided(Pq, 5123, "VEC3", minmax=([float(v) for v in Pq[:, :3].min(0)], [float(v) for v in Pq[:, :3].max(0)])),
        "NORMAL": strided(Nq, 5120, "VEC3", normalized=True),
        "TEXCOORD_0": strided(UVq, 5123, "VEC2", normalized=True),
        "JOINTS_0": w.acc(top.astype(np.uint8), "VEC4", 34962),
        "WEIGHTS_0": w.acc(wq.astype(np.uint8), "VEC4", 34962, normalized=True),
    }
    idx = w.acc(I.astype(np.uint16 if len(P) < 65536 else np.uint32), "SCALAR", 34963)
    D = np.diag([sc, sc, sc, 1.0])
    D[:3, 3] = lo
    ibm_q = np.stack([(np.linalg.inv(M) @ D).T.reshape(-1) for M in Mw]).astype(np.float32)
    ibm_acc = w.acc(ibm_q, "MAT4")
    imgs = [{"bufferView": w.view(glb.image_bytes(j, b, k)), "mimeType": im.get("mimeType", "image/jpeg")} for k, im in enumerate(j["images"])]
    mesh_node = next(i for i, n in enumerate(nodes) if "mesh" in n)
    out = {
        "asset": {"version": "2.0", "generator": "knowitball build_onebody.py"},
        "extensionsUsed": ["KHR_mesh_quantization"],
        "extensionsRequired": ["KHR_mesh_quantization"],
        "scene": 0,
        "scenes": [{"name": name, "nodes": j["scenes"][0]["nodes"], "extras": {
            **ex, "joints": jp, "fingers": fingers_meta, "onebody": 1,
            "quant": {"scale": sc, "offset": [float(v) for v in lo]},
        }}],
        "nodes": nodes,
        "meshes": [{"name": "Body", "primitives": [{"attributes": acc, "indices": idx, "material": 0}]}],
        "skins": [{"joints": joints, "inverseBindMatrices": ibm_acc, **({"skeleton": sk["skeleton"]} if "skeleton" in sk else {})}],
        "materials": j["materials"],
        "samplers": j["samplers"],
        "images": imgs,
        "textures": j["textures"],
    }
    nodes[mesh_node]["mesh"] = 0
    nodes[mesh_node]["skin"] = 0
    n = w.save(os.path.join(OUT, name + ".glb"), out)
    print(f"  {name}.glb {n / 1e6:.2f} MB, {len(names)} joints")


if __name__ == "__main__":
    for m in sys.argv[1:] or ["player", "player-buzz", "player-long", "manager"]:
        build(m)

