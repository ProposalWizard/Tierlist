"""Tiny glTF-binary reader/writer (numpy only). Used by build_people3d.py."""
import json, struct
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read(path):
    d = open(path, "rb").read()
    off = 12
    j = b = None
    while off < len(d):
        l, t = struct.unpack("<I4s", d[off:off + 8])
        c = d[off + 8:off + 8 + l]
        if t == b"JSON":
            j = json.loads(c)
        elif t[:3] == b"BIN":
            b = c
        off += 8 + l
    return j, b


def accessor(j, b, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    dt = np.dtype(CT[a["componentType"]])
    n = NC[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0)
    if stride and stride != dt.itemsize * n:
        raw = np.frombuffer(b, np.uint8, count=stride * a["count"], offset=off).reshape(a["count"], stride)
        arr = raw[:, :dt.itemsize * n].copy().view(dt).reshape(a["count"], n)
    else:
        arr = np.frombuffer(b, dt, count=a["count"] * n, offset=off).reshape(a["count"], n).copy()
    if a.get("normalized"):
        arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr if n > 1 else arr[:, 0]


def image_bytes(j, b, i):
    bv = j["bufferViews"][j["images"][i]["bufferView"]]
    o = bv.get("byteOffset", 0)
    return b[o:o + bv["byteLength"]]


def bind_joints(j, b):
    """Each joint's bind-pose world matrix (metres), by name."""
    sk = j["skins"][0]
    ibm = accessor(j, b, sk["inverseBindMatrices"]).reshape(-1, 4, 4)
    out = {}
    for i, M in zip(sk["joints"], ibm):
        out[j["nodes"][i]["name"]] = np.linalg.inv(M.T)
    return out


class Writer:
    """Builds a new glb: add buffer views/accessors, then save(json)."""

    def __init__(self):
        self.bin = bytearray()
        self.views = []
        self.accessors = []

    def view(self, data: bytes, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target:
            v["target"] = target
        self.bin += data
        self.views.append(v)
        return len(self.views) - 1

    def acc(self, arr, type_, target=None, normalized=False, minmax=False):
        arr = np.ascontiguousarray(arr)
        ct = {np.dtype(np.float32): 5126, np.dtype(np.uint8): 5121, np.dtype(np.uint16): 5123, np.dtype(np.uint32): 5125}[arr.dtype]
        v = self.view(arr.tobytes(), target)
        a = {"bufferView": v, "componentType": ct, "count": int(arr.shape[0]), "type": type_}
        if normalized:
            a["normalized"] = True
        if minmax:
            r = arr.reshape(arr.shape[0], -1)
            a["min"] = [float(x) for x in r.min(0)]
            a["max"] = [float(x) for x in r.max(0)]
        self.accessors.append(a)
        return len(self.accessors) - 1

    def save(self, path, j):
        j["bufferViews"] = self.views
        j["accessors"] = self.accessors
        while len(self.bin) % 4:
            self.bin.append(0)
        j["buffers"] = [{"byteLength": len(self.bin)}]
        js = json.dumps(j, separators=(",", ":")).encode()
        while len(js) % 4:
            js += b" "
        out = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(self.bin))
        out += struct.pack("<I4s", len(js), b"JSON") + js
        out += struct.pack("<I4s", len(self.bin), b"BIN\x00") + bytes(self.bin)
        open(path, "wb").write(out)
        return len(out)
