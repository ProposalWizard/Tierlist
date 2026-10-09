"""
MakeHuman proxies (CC0 system assets): clothes, hair, eyebrows, teeth — each
fitted to the base mesh the way MakeHuman fits them (.mhclo: every proxy vertex
is a weighted mix of three base vertices plus a scaled offset), so they follow
the body's shape, and skinned from those same three vertices.

Assets: makehuman_system_assets_cc0.zip
(https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/), unzipped;
build_human.py takes its folder as the third argument.
"""
import numpy as np


def parse_ranges(tokens):
    out = []
    i = 0
    while i < len(tokens):
        if i + 2 < len(tokens) and tokens[i + 1] == "-":
            out.extend(range(int(tokens[i]), int(tokens[i + 2]) + 1)); i += 3
        else:
            out.append(int(tokens[i])); i += 1
    return out


def read_mhclo(path):
    refs, w, off = [], [], []
    scale = {}
    delete = []
    mode = None
    obj = None
    for line in open(path, encoding="utf-8", errors="ignore"):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        t = s.split()
        if t[0] in ("x_scale", "y_scale", "z_scale"):
            scale[t[0][0]] = (int(t[1]), int(t[2]), float(t[3])); continue
        if t[0] == "obj_file":
            obj = t[1]; continue
        if t[0] == "verts":
            mode = "verts"; continue
        if t[0] == "delete_verts":
            mode = "delete"; continue
        if not t[0].lstrip("-").replace(".", "").isdigit():
            continue
        if mode == "verts":
            if len(t) == 1:
                refs.append([int(t[0])] * 3); w.append([1.0, 0, 0]); off.append([0, 0, 0])
            elif len(t) >= 9:
                refs.append([int(x) for x in t[:3]]); w.append([float(x) for x in t[3:6]]); off.append([float(x) for x in t[6:9]])
        elif mode == "delete":
            delete.extend(parse_ranges(t))
    return {"refs": np.array(refs, dtype=np.int64), "w": np.array(w), "off": np.array(off), "scale": scale, "delete": np.array(delete, dtype=np.int64), "obj": obj}


def read_obj(path):
    """Vertices, UVs and faces (each face: list of (v, vt))."""
    V, VT, F = [], [], []
    for line in open(path, encoding="utf-8", errors="ignore"):
        if line.startswith("v "):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vt "):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith("f "):
            face = []
            for tok in line.split()[1:]:
                a = tok.split("/")
                face.append((int(a[0]) - 1, int(a[1]) - 1 if len(a) > 1 and a[1] else -1))
            F.append(face)
    return np.array(V), np.array(VT) if VT else np.zeros((0, 2)), F


def fit(clo, Vmh):
    """Proxy vertex positions on a (shaped, unposed) base mesh, MakeHuman units."""
    r, w, off = clo["refs"], clo["w"], clo["off"]
    P = (Vmh[r] * w[:, :, None]).sum(1)
    sc = np.ones(3)
    for k, ax in (("x", 0), ("y", 1), ("z", 2)):
        if k in clo["scale"]:
            a, b, d = clo["scale"][k]
            sc[ax] = abs(Vmh[a, ax] - Vmh[b, ax]) / d
    return P + off * sc


def split_uv(V, VT, F):
    """One vertex per (position, uv) pair, and triangles over them."""
    key = {}
    pos, uv, src = [], [], []
    tris = []
    for face in F:
        ids = []
        for v, t in face:
            k = (v, t)
            if k not in key:
                key[k] = len(pos)
                pos.append(v); src.append(v)
                uv.append(VT[t] if t >= 0 and len(VT) else [0, 0])
            ids.append(key[k])
        for i in range(1, len(ids) - 1):
            tris.append((ids[0], ids[i], ids[i + 1]))
    return np.array(src), np.array(uv, dtype=np.float32), np.array(tris, dtype=np.int64)
