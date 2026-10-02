"""Build the files the LIVE 3D signing scene loads (/star-3d-area-dev/signing).

    python3 tools/signing3d/build_assets.py <UBC dir> <UAL1_Standard.glb> <out dir>

  <UBC dir> is the unzipped Quaternius "Universal Base Characters [Standard]"
  folder (the one holding "Base Characters" and "Hairstyles"), the same pack
  tools/blender-footballer/fetch_assets.sh puts in place.

  people.glb   "Superhero_Male_FullBody" (body, eyes, eyebrows) plus three of
               the pack's hair meshes on the same skeleton: Hair_SimpleParted
               and Hair_Long (you, either), Hair_Buzzed and Hair_Beard (the
               manager, or a buzz cut for you). The page shows
               or hides each one. The skin texture is the pack's LIGHT map; the
               page tints it to the player's skin tone. Only the attributes the
               page draws are kept (position, normal, uv, joints, weights).
  anims.glb    Clips from Quaternius' Universal Animation Library with no mesh:
               sitting, sitting and talking, standing up from a chair, idle and
               idle talking. Same skeleton and bone names as the body, so they
               play as they are. Rotations only, plus the pelvis's movement
               re-based onto the body's own rest pelvis.
  aviators.glb The gold aviator sunglasses from Mikey's Star Pass reward
               (public/star/star-pass/3d/reward-glasses.glb), cut out on their
               own with the rest pose baked in, so the page can sit them on any
               head. The glasses are Mikey's own model (tools/star-pass-art).

Both Quaternius packs are CC0 1.0 (public domain); see LICENSE.txt next to the
outputs. Needs Pillow. Nothing here runs at build time; the outputs are
committed.
"""
import io, json, math, struct, sys, os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shop3d"))
from build_assets import read_gltf, accessor_floats, Writer, NCOMP, COMP  # noqa: E402
from PIL import Image  # noqa: E402

CLIPS = ["Sitting_Idle_Loop", "Sitting_Talking_Loop", "Sitting_Exit", "Idle_Loop", "Idle_Talking_Loop"]
KEEP_ATTR = ("POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0")


def jpeg(path, size, q=84):
    im = Image.open(path).convert("RGB").resize((size, size), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, "JPEG", quality=q, optimize=True)
    return b.getvalue()


def build_people(ubc, out):
    body_dir = ubc + "/Base Characters/Godot - UE/"
    tex_dir = ubc + "/Base Characters/Textures/"
    hair_dir = ubc + "/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/"
    W = Writer()
    bj, bviews, _ = read_gltf(body_dir + "Superhero_Male_FullBody.gltf")

    imgs, tex = [], []

    def add_tex(data):
        imgs.append({"bufferView": W.view(data), "mimeType": "image/jpeg"})
        tex.append({"sampler": 0, "source": len(imgs) - 1})
        return len(tex) - 1

    skin_base = add_tex(jpeg(tex_dir + "T_Superhero_Male_Ligh.png", 1024))
    skin_norm = add_tex(jpeg(tex_dir + "T_Superhero_Male_Normal.png", 512, 86))
    hair_base = add_tex(jpeg(hair_dir + "T_Hair_1_BaseColor.png", 512))
    hair2_base = add_tex(jpeg(hair_dir + "T_Hair_2_BaseColor.png", 512))
    eye_base = add_tex(jpeg(body_dir + "T_Eye_Brown.png", 256))
    W.j["images"] = imgs
    W.j["textures"] = tex
    W.j["samplers"] = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
    W.j["materials"] = [
        {"name": "Hair", "doubleSided": True, "alphaMode": "MASK", "alphaCutoff": 0.4,
         "pbrMetallicRoughness": {"baseColorTexture": {"index": hair_base}, "metallicFactor": 0, "roughnessFactor": 0.85}},
        {"name": "Eyes", "pbrMetallicRoughness": {"baseColorTexture": {"index": eye_base}, "metallicFactor": 0, "roughnessFactor": 0.35}},
        {"name": "Skin", "normalTexture": {"index": skin_norm},
         "pbrMetallicRoughness": {"baseColorTexture": {"index": skin_base}, "metallicFactor": 0, "roughnessFactor": 0.62}},
        {"name": "Hair2", "doubleSided": True, "alphaMode": "MASK", "alphaCutoff": 0.4,
         "pbrMetallicRoughness": {"baseColorTexture": {"index": hair2_base}, "metallicFactor": 0, "roughnessFactor": 0.8}},
    ]

    def prims_of(sj, sviews, m, cache, mat):
        out_p = []
        for p in m["primitives"]:
            out_p.append({"attributes": {k: W.copy_accessor(sj, sviews, v, cache) for k, v in p["attributes"].items() if k in KEEP_ATTR},
                          "indices": W.copy_accessor(sj, sviews, p["indices"], cache),
                          "material": mat if mat is not None else p["material"]})
        return out_p

    W.j["nodes"] = [dict(n) for n in bj["nodes"]]
    cache = {}
    meshes = [{"name": m["name"], "primitives": prims_of(bj, bviews, m, cache, None)} for m in bj["meshes"]]
    # Name the body's meshes for the page.
    for n in W.j["nodes"]:
        if n.get("mesh") == 0: n["name"] = "Eyebrows"
        if n.get("mesh") == 1: n["name"] = "Eyes"
        if n.get("mesh") == 2: n["name"] = "Body"
    skin0 = {"joints": bj["skins"][0]["joints"],
             "inverseBindMatrices": W.copy_accessor(bj, bviews, bj["skins"][0]["inverseBindMatrices"], cache)}
    skins = [skin0]
    by_name = {n["name"]: i for i, n in enumerate(bj["nodes"])}
    arm = by_name["Armature"]
    for hair, mat in [("Hair_SimpleParted", 0), ("Hair_Buzzed", 0), ("Hair_Beard", 0), ("Hair_Long", 3)]:
        hj, hviews, _ = read_gltf(hair_dir + hair + ".gltf")
        hc = {}
        meshes.append({"name": hair, "primitives": prims_of(hj, hviews, hj["meshes"][0], hc, mat)})
        hs = hj["skins"][0]
        skins.append({"joints": [by_name[hj["nodes"][i]["name"]] for i in hs["joints"]],
                      "inverseBindMatrices": W.copy_accessor(hj, hviews, hs["inverseBindMatrices"], hc)})
        W.j["nodes"].append({"name": hair, "mesh": len(meshes) - 1, "skin": len(skins) - 1})
        W.j["nodes"][arm]["children"] = W.j["nodes"][arm]["children"] + [len(W.j["nodes"]) - 1]
    W.j["meshes"] = meshes
    W.j["skins"] = skins
    W.j["scenes"] = bj["scenes"]
    W.j["scene"] = 0
    return W.save(out)


def build_anims(ual_path, ubc, out):
    uj, uviews, _ = read_gltf(ual_path)
    bj, _, _ = read_gltf(ubc + "/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf")
    W = Writer()
    joints = set(uj["skins"][0]["joints"])
    keep = [i for i, n in enumerate(uj["nodes"]) if "mesh" not in n]
    remap = {old: new for new, old in enumerate(keep)}
    nodes = []
    for i in keep:
        n = {k: v for k, v in uj["nodes"][i].items() if k not in ("skin", "mesh")}
        if "children" in n:
            n["children"] = [remap[c] for c in n["children"] if c in remap]
        nodes.append(n)
    W.j["nodes"] = nodes
    W.j["scenes"] = [{"nodes": [remap[r] for r in uj["scenes"][0]["nodes"] if r in remap]}]
    W.j["scene"] = 0
    body_pelvis = [n for n in bj["nodes"] if n["name"] == "pelvis"][0]["translation"]
    ual_pelvis = [n for n in uj["nodes"] if n["name"] == "pelvis"][0]["translation"]
    anims = []
    cache = {}
    for a in uj["animations"]:
        if a["name"] not in CLIPS:
            continue
        samplers, channels = [], []
        for c in a["channels"]:
            node = c["target"]["node"]
            path = c["target"]["path"]
            name = uj["nodes"][node]["name"]
            if node not in joints or path == "scale" or name.endswith("_leaf_l") or name.endswith("_leaf_r"):
                continue
            if path == "translation" and name != "pelvis":
                continue
            s = a["samplers"][c["sampler"]]
            inp = W.copy_accessor(uj, uviews, s["input"], cache)
            rows = accessor_floats(uj, uviews, s["output"])
            if path == "translation":
                rows = [[r[k] - ual_pelvis[k] + body_pelvis[k] for k in range(3)] for r in rows]
                outp = W.float_accessor(rows, "VEC3")
            else:
                # A bone that never turns needs one key, not one per frame.
                if all(max(abs(r[k] - rows[0][k]) for k in range(4)) < 1e-4 for r in rows):
                    t0 = accessor_floats(uj, uviews, s["input"])[0]
                    inp = W.float_accessor([t0], "SCALAR")
                    rows = [rows[0]]
                outp = W.float_accessor(rows, "VEC4")
            samplers.append({"input": inp, "output": outp, "interpolation": s.get("interpolation", "LINEAR")})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": remap[node], "path": path}})
        anims.append({"name": a["name"], "samplers": samplers, "channels": channels})
    W.j["animations"] = anims
    return W.save(out)


# ── the aviators, cut out of Mikey's reward file ──

def qmat(q):
    x, y, z, w = q
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]


def trs(n):
    if "matrix" in n:
        m = n["matrix"]
        return [[m[0], m[4], m[8], m[12]], [m[1], m[5], m[9], m[13]], [m[2], m[6], m[10], m[14]], [0, 0, 0, 1]]
    r = qmat(n.get("rotation", [0, 0, 0, 1]))
    s = n.get("scale", [1, 1, 1])
    t = n.get("translation", [0, 0, 0])
    return [[r[i][0] * s[0], r[i][1] * s[1], r[i][2] * s[2], t[i]] for i in range(3)] + [[0, 0, 0, 1]]


def mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def build_aviators(src, out):
    sj, sviews, _ = read_gltf(src)
    parent = {}
    for i, n in enumerate(sj["nodes"]):
        for c in n.get("children", []):
            parent[c] = i
    gi = [i for i, n in enumerate(sj["nodes"]) if n["name"] == "Sunglasses"][0]
    M = trs(sj["nodes"][gi])
    p = parent.get(gi)
    while p is not None:
        M = mul(trs(sj["nodes"][p]), M)
        p = parent.get(p)
    mi = sj["nodes"][gi]["mesh"]
    W = Writer()
    used_mats = []
    prims = []
    for pr in sj["meshes"][mi]["primitives"]:
        pos = accessor_floats(sj, sviews, pr["attributes"]["POSITION"])
        nor = accessor_floats(sj, sviews, pr["attributes"]["NORMAL"])
        P = [[M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2] + M[i][3] for i in range(3)] for v in pos]
        N = []
        for v in nor:
            q = [M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2] for i in range(3)]
            l = math.sqrt(sum(x * x for x in q)) or 1
            N.append([x / l for x in q])
        pa = W.float_accessor(P, "VEC3")
        W.j["accessors"][pa]["min"] = [min(v[k] for v in P) for k in range(3)]
        W.j["accessors"][pa]["max"] = [max(v[k] for v in P) for k in range(3)]
        na = W.float_accessor(N, "VEC3")
        ia = W.copy_accessor(sj, sviews, pr["indices"], {})
        if pr["material"] not in used_mats:
            used_mats.append(pr["material"])
        prims.append({"attributes": {"POSITION": pa, "NORMAL": na}, "indices": ia, "material": used_mats.index(pr["material"])})
    mats = []
    for m in used_mats:
        d = dict(sj["materials"][m])
        pbr = dict(d.get("pbrMetallicRoughness", {}))
        pbr.pop("baseColorTexture", None)
        pbr.pop("metallicRoughnessTexture", None)
        d["pbrMetallicRoughness"] = pbr
        d.pop("normalTexture", None)
        d.pop("extensions", None)
        mats.append(d)
    W.j["materials"] = mats
    W.j["meshes"] = [{"name": "Aviators", "primitives": prims}]
    W.j["nodes"] = [{"name": "Aviators", "mesh": 0}]
    W.j["scenes"] = [{"nodes": [0]}]
    W.j["scene"] = 0
    print("aviator materials", json.dumps(mats))
    return W.save(out)


if __name__ == "__main__":
    ubc, ual, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    print("people.glb", build_people(ubc, out + "/people.glb"))
    print("anims.glb", build_anims(ual, ubc, out + "/anims.glb"))
    here = os.path.dirname(os.path.abspath(__file__))
    print("aviators.glb", build_aviators(os.path.join(here, "..", "..", "public/star/star-pass/3d/reward-glasses.glb"), out + "/aviators.glb"))
