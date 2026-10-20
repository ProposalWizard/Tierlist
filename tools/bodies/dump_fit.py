"""A fitted body (tools/modeltest/fit.py or reshape.py output) written the way graft.py reads a body,
so today's Style A head can be put on it (Harry, 20 Oct 18:41, on B2/B3: "losing the face working").

    python3 tools/bodies/dump_fit.py <fit.glb> <out.json>

Every vertex is tagged by its strongest bone group: "skin.head" (head bones: dropped by graft.py),
"skin.neck" (kept only where the new neck does not reach, GRAFT_KEEPNECK=1), else "skin.body" (kept,
painted from the body's own picture).
"""
import base64, io, json, os, sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts", "people3d"))
import glb  # noqa: E402

SRC, OUT = sys.argv[1:3]
j, b = glb.read(SRC)
prim = j["meshes"][0]["primitives"][0]
A = prim["attributes"]
P = glb.accessor(j, b, A["POSITION"]).astype(np.float64)
UV = glb.accessor(j, b, A["TEXCOORD_0"]).astype(np.float64)
JN = glb.accessor(j, b, A["JOINTS_0"]).astype(int)
WT = glb.accessor(j, b, A["WEIGHTS_0"]).astype(np.float64)
WT = WT / np.maximum(WT.sum(1, keepdims=True), 1e-9)
I = glb.accessor(j, b, prim["indices"]).reshape(-1).astype(int)
sk = j["skins"][0]
names = [j["nodes"][i]["name"] for i in sk["joints"]]
ibm = glb.accessor(j, b, sk["inverseBindMatrices"]).astype(np.float64).reshape(-1, 4, 4)
joints = {n: np.linalg.inv(M.T)[:3, 3].tolist() for n, M in zip(names, ibm)}
HEAD = {k for k, n in enumerate(names) if n in ("Head", "head_end", "headfront")}
NECK = {k for k, n in enumerate(names) if n == "neck"}
parts = ["skin.body", "skin.neck", "skin.head"]
wh = np.array([sum(WT[v, c] for c in range(4) if JN[v, c] in HEAD) for v in range(len(P))])
wn = np.array([sum(WT[v, c] for c in range(4) if JN[v, c] in NECK) for v in range(len(P))])
part = np.where(wh >= 0.5, 2, np.where(wn >= 0.5, 1, 0))
mat = j["materials"][prim.get("material", 0)]
ti = mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]
img = glb.image_bytes(j, b, j["textures"][ti]["source"])
from PIL import Image  # noqa: E402
buf = io.BytesIO(); Image.open(io.BytesIO(img)).convert("RGB").save(buf, "PNG")
d = {
    "pos": P.reshape(-1).tolist(), "uv": UV.reshape(-1).tolist(), "part": part.tolist(), "index": I.tolist(),
    "groups": [{"start": 0, "count": len(I), "mat": 0}], "maps": ["data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()],
    "parts": parts, "joints": joints, "skinIndex": JN.reshape(-1).tolist(), "skinWeight": WT.reshape(-1).tolist(),
    "bones": names, "color": None,
}
json.dump(d, open(OUT, "w"))
print("DUMPED", OUT, "verts", len(P), "tris", len(I) // 3, "head verts", int((part == 2).sum()), "neck verts", int((part == 1).sum()))
