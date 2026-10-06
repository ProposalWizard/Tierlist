"""Build the two small files the 3D shop test page loads.

    python3 tools/shop3d/build_assets.py <UBC "Base Characters/Godot - UE" dir> <UBC "Hairstyles/.../glTF (Godot -Unreal)" dir> <UAL1_Standard.glb> <out dir>

  character.glb  Quaternius Universal Base Characters "Superhero_Male_FullBody"
                 (body, eyes, eyebrows) + the pack's "Hair_SimpleParted", merged
                 onto one skeleton. Textures shrunk to 1024 px JPEG; the
                 roughness map and the hair/eye normal maps are dropped.
  anims.glb      Four clips from Quaternius' Universal Animation Library
                 ("UAL1_Standard.glb") with no mesh: Idle_Loop, Walk_Loop,
                 Jog_Fwd_Loop, Interact. Built for the same 65-bone skeleton
                 (same bone names), so they play on the body as they are.
                 Only rotations are kept, plus the pelvis's height (re-based
                 from the animation's mannequin onto this body's rest pelvis),
                 so the body keeps its own proportions.

Both packs are CC0 1.0 (public domain) - see public/star/shop3d/LICENSE.txt.
Needs Pillow. Nothing here runs at build time; the outputs are committed.
"""
import io, json, struct, sys
from PIL import Image

KEEP_CLIPS = ["Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Interact"]

COMP = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_gltf(path):
    """-> (json, [bytes per bufferView]) for a .gltf (+.bin) or a .glb."""
    if path.endswith(".glb"):
        b = open(path, "rb").read()
        jl = struct.unpack("<I", b[12:16])[0]
        j = json.loads(b[20:20 + jl])
        off = 20 + jl
        bl = struct.unpack("<I", b[off:off + 4])[0]
        bins = [b[off + 8:off + 8 + bl]]
        imgdir = None
    else:
        j = json.load(open(path))
        d = path.rsplit("/", 1)[0] + "/"
        bins = [open(d + buf["uri"], "rb").read() for buf in j["buffers"]]
        imgdir = d
    views = []
    for v in j["bufferViews"]:
        # A file packed by scripts/perf3d/shrink-models.mjs (EXT_meshopt_compression)
        # keeps its data compressed and points the plain views at an empty
        # fallback buffer: those views read as None here. Only the JSON
        # (node names, rest translations) can be read from such a file, which
        # is all tools/garden3d/build_anims.py takes from character.glb.
        if v.get("buffer", 0) >= len(bins):
            views.append(None)
            continue
        src = bins[v.get("buffer", 0)]
        o = v.get("byteOffset", 0)
        views.append(src[o:o + v["byteLength"]])
    return j, views, imgdir


def accessor_floats(j, views, ai):
    a = j["accessors"][ai]
    v = j["bufferViews"][a["bufferView"]]
    n = NCOMP[a["type"]]
    data = views[a["bufferView"]]
    off = a.get("byteOffset", 0)
    stride = v.get("byteStride", 0) or n * 4
    out = []
    for i in range(a["count"]):
        out.append(list(struct.unpack_from("<" + "f" * n, data, off + i * stride)))
    return out


class Writer:
    """Collects bufferViews/accessors/images and writes a .glb."""

    def __init__(self):
        self.j = {"asset": {"version": "2.0", "generator": "knowitball shop3d build_assets.py"},
                  "bufferViews": [], "accessors": []}
        self.blob = bytearray()

    def view(self, data, target=None):
        while len(self.blob) % 4:
            self.blob.append(0)
        v = {"buffer": 0, "byteOffset": len(self.blob), "byteLength": len(data)}
        if target:
            v["target"] = target
        self.blob += data
        self.j["bufferViews"].append(v)
        return len(self.j["bufferViews"]) - 1

    def copy_accessor(self, sj, sviews, ai, cache):
        if ai in cache:
            return cache[ai]
        a = dict(sj["accessors"][ai])
        sv = sj["bufferViews"][a["bufferView"]]
        n = NCOMP[a["type"]] * struct.calcsize(COMP[a["componentType"]])
        stride = sv.get("byteStride", 0) or n
        raw = sviews[a["bufferView"]]
        off = a.get("byteOffset", 0)
        packed = b"".join(raw[off + i * stride: off + i * stride + n] for i in range(a["count"]))
        a["bufferView"] = self.view(packed, sv.get("target"))
        a.pop("byteOffset", None)
        self.j["accessors"].append(a)
        cache[ai] = len(self.j["accessors"]) - 1
        return cache[ai]

    def float_accessor(self, rows, typ):
        n = NCOMP[typ]
        data = b"".join(struct.pack("<" + "f" * n, *r) for r in rows)
        a = {"bufferView": self.view(data), "componentType": 5126, "count": len(rows), "type": typ}
        if typ == "SCALAR":
            a["min"] = [min(r[0] for r in rows)]
            a["max"] = [max(r[0] for r in rows)]
        self.j["accessors"].append(a)
        return len(self.j["accessors"]) - 1

    def save(self, path):
        while len(self.blob) % 4:
            self.blob.append(0)
        self.j["buffers"] = [{"byteLength": len(self.blob)}]
        js = json.dumps(self.j, separators=(",", ":")).encode()
        while len(js) % 4:
            js += b" "
        out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.blob))
        out += struct.pack("<II", len(js), 0x4E4F534A) + js
        out += struct.pack("<II", len(self.blob), 0x004E4942) + bytes(self.blob)
        open(path, "wb").write(out)
        return len(out)


def jpeg(path, size, q=85):
    im = Image.open(path).convert("RGB").resize((size, size), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, "JPEG", quality=q, optimize=True, progressive=False)
    return b.getvalue()


def build_character(body_dir, hair_dir, out):
    W = Writer()
    bj, bviews, bdir = read_gltf(body_dir + "/Superhero_Male_FullBody.gltf")
    hj, hviews, hdir = read_gltf(hair_dir + "/Hair_SimpleParted.gltf")

    # Images: keep only what is drawn.
    imgs = []
    def add_image(data, mime):
        imgs.append({"bufferView": W.view(data), "mimeType": mime})
        return len(imgs) - 1
    tex = []
    def add_tex(img):
        tex.append({"sampler": 0, "source": img})
        return len(tex) - 1
    skin_base = add_tex(add_image(jpeg(bdir + "T_Superhero_Male_Dark.png", 1024), "image/jpeg"))
    skin_norm = add_tex(add_image(jpeg(bdir + "T_Superhero_Male_Normal.png", 1024, 88), "image/jpeg"))
    hair_base = add_tex(add_image(jpeg(hdir + "T_Hair_1_BaseColor.png", 512), "image/jpeg"))
    eye_base = add_tex(add_image(jpeg(bdir + "T_Eye_Brown.png", 256), "image/jpeg"))
    W.j["images"] = imgs
    W.j["textures"] = tex
    W.j["samplers"] = [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]
    W.j["materials"] = [
        {"name": "Hair", "doubleSided": True, "pbrMetallicRoughness": {"baseColorTexture": {"index": hair_base}, "metallicFactor": 0, "roughnessFactor": 0.85}},
        {"name": "Eyes", "pbrMetallicRoughness": {"baseColorTexture": {"index": eye_base}, "metallicFactor": 0, "roughnessFactor": 0.35}},
        {"name": "Skin", "normalTexture": {"index": skin_norm}, "pbrMetallicRoughness": {"baseColorTexture": {"index": skin_base}, "metallicFactor": 0, "roughnessFactor": 0.62}},
    ]
    body_mat = {0: 0, 1: 1, 2: 2}  # source material -> ours (same order)

    # Nodes: the body's, as they are.
    W.j["nodes"] = [dict(n) for n in bj["nodes"]]
    cache = {}
    meshes = []
    for m in bj["meshes"]:
        prims = []
        for p in m["primitives"]:
            q = {"attributes": {k: W.copy_accessor(bj, bviews, v, cache) for k, v in p["attributes"].items()},
                 "indices": W.copy_accessor(bj, bviews, p["indices"], cache),
                 "material": body_mat[p["material"]]}
            prims.append(q)
        meshes.append({"name": m["name"], "primitives": prims})
    skins = [{"joints": bj["skins"][0]["joints"],
              "inverseBindMatrices": W.copy_accessor(bj, bviews, bj["skins"][0]["inverseBindMatrices"], cache),
              "skeleton": bj["skins"][0].get("skeleton")}]
    if skins[0]["skeleton"] is None:
        del skins[0]["skeleton"]

    # The hair: its own mesh and skin, the skin's joints mapped by bone name
    # onto the body's nodes.
    by_name = {n["name"]: i for i, n in enumerate(bj["nodes"])}
    hcache = {}
    hm = hj["meshes"][0]
    hprims = []
    for p in hm["primitives"]:
        hprims.append({"attributes": {k: W.copy_accessor(hj, hviews, v, hcache) for k, v in p["attributes"].items()},
                       "indices": W.copy_accessor(hj, hviews, p["indices"], hcache), "material": 0})
    meshes.append({"name": "Hair", "primitives": hprims})
    hs = hj["skins"][0]
    skins.append({"joints": [by_name[hj["nodes"][i]["name"]] for i in hs["joints"]],
                  "inverseBindMatrices": W.copy_accessor(hj, hviews, hs["inverseBindMatrices"], hcache)})
    W.j["nodes"].append({"name": "Hair", "mesh": len(meshes) - 1, "skin": 1})
    arm = by_name["Armature"]
    W.j["nodes"][arm]["children"] = W.j["nodes"][arm]["children"] + [len(W.j["nodes"]) - 1]
    W.j["meshes"] = meshes
    W.j["skins"] = skins
    W.j["scenes"] = bj["scenes"]
    W.j["scene"] = 0
    return W.save(out)


def build_anims(ual_path, body_dir, out):
    uj, uviews, _ = read_gltf(ual_path)
    bj, _, _ = read_gltf(body_dir + "/Superhero_Male_FullBody.gltf")
    W = Writer()
    joints = set(uj["skins"][0]["joints"])
    # Keep the skeleton's node tree (no meshes, no skin).
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
        if a["name"] not in KEEP_CLIPS:
            continue
        samplers, channels = [], []
        for c in a["channels"]:
            node = c["target"]["node"]
            path = c["target"]["path"]
            name = uj["nodes"][node]["name"]
            if node not in joints or path == "scale":
                continue
            if path == "translation" and name != "pelvis":
                continue
            s = a["samplers"][c["sampler"]]
            inp = W.copy_accessor(uj, uviews, s["input"], cache)
            if path == "translation":
                rows = accessor_floats(uj, uviews, s["output"])
                rows = [[r[k] - ual_pelvis[k] + body_pelvis[k] for k in range(3)] for r in rows]
                outp = W.float_accessor(rows, "VEC3")
            else:
                outp = W.copy_accessor(uj, uviews, s["output"], {})
            samplers.append({"input": inp, "output": outp, "interpolation": s.get("interpolation", "LINEAR")})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": remap[node], "path": path}})
        anims.append({"name": a["name"], "samplers": samplers, "channels": channels})
    W.j["animations"] = anims
    return W.save(out)


if __name__ == "__main__":
    body_dir, hair_dir, ual, out = sys.argv[1:5]
    print("character.glb", build_character(body_dir, hair_dir, out + "/character.glb"))
    print("anims.glb", build_anims(ual, body_dir, out + "/anims.glb"))
    # A rebuild writes them big: pack them small (scripts/perf3d/shrink-models.mjs).
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts", "perf3d"))
    from shrink_after_build import shrink
    shrink([out + "/character.glb", out + "/anims.glb"])
