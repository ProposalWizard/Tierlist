"""
THE NEW 3D PEOPLE, MADE SMALL FOR THE WEB.

    python3 scripts/people3d/build_people3d.py <folder with the Higgsfield .glb files>

Reads the approved characters (each ~10 MB, 2048² textures, one clip each)
and writes, into public/star/people3d/:

  player.glb, player-buzz.glb, player-long.glb, manager.glb
      one skinned mesh each: positions, normals, uvs, bone ids/weights as
      bytes, no tangents; a 1024 base-colour JPEG and a 1024 normal JPEG;
      no emissive / metal-rough maps (flat roughness instead); the clip
      stripped. scene.extras carries what the game needs to recolour it
      (average skin and hair colour, face heights, kit hem lines).
  anims.glb
      the 24-joint skeleton (no mesh) and every clip, renamed short. Only
      bone ROTATIONS are kept, plus the hips' position, so one clip plays
      on every model whatever its own bone lengths. Jog/sprint have their
      forward travel taken out (the game moves the body itself).

player-long's texture has a stray "0" printed on the shirt back: it is
painted out here (texels on the back of the shirt that are dark become the
shirt's own white).
"""
import io, json, os, sys
import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
import glb, raster  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "star", "people3d")
os.makedirs(OUT, exist_ok=True)

TEX = 1024

# Face heights (rest pose, metres), read off front renders of each head.
FACE = {
    "player": {"chinY": 1.573, "eyeY": 1.676, "browY": 1.690},
    "player-buzz": {"chinY": 1.586, "eyeY": 1.688, "browY": 1.700},
    "player-long": {"chinY": 1.568, "eyeY": 1.676, "browY": 1.688},
    "manager": {"chinY": 1.559, "eyeY": 1.666, "browY": 1.680},
}
# Kit lines (rest pose y): shirt over the hem, socks under the knee gap, boots under the ankle.
KIT = {"hemY": 0.965, "sockY": 0.60, "bootY": 0.13}

CLIPS = {
    "player-idle": "idle", "player-sitdown": "sitdown", "player-sitidle": "sitidle",
    "player-pickup": "pickup", "player-wave": "wave", "player-celebrate": "celebrate",
    "player-jog": "jog", "manager-idle": "boss-idle", "manager-talk": "boss-talk",
    "manager-sit": "boss-sit", "manager-wave": "boss-wave",
}
IN_PLACE = {"jog"}


def srgb_to_lin(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def texel_colours(img, uv):
    h, w = img.shape[:2]
    return img[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)]


def paint_out_number(img, P, UV, I):
    """White over the dark print on the back of the shirt."""
    h, w = img.shape[:2]
    tris = I[(P[I][:, :, 2].max(1) < -0.02) & (P[I][:, :, 1].min(1) > 1.0) & (P[I][:, :, 1].max(1) < 1.5) & (np.abs(P[I][:, :, 0]).max(1) < 0.2)]
    pos = raster.raster(UV[tris] * [w, h], P[tris].astype(np.float32), w, h)
    on = ~np.isnan(pos[..., 0])
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    region = on & (z < -0.04) & (y > 1.08) & (y < 1.45) & (np.abs(x) < 0.16)
    lum = img.mean(2)
    # Texels no triangle covers (the gutters round each island) bleed into
    # the island once the texture is filtered: near the print, they go too.
    allpos = raster.raster(UV[I] * [w, h], np.zeros((len(I), 3, 1), np.float32), w, h)
    gutter = np.isnan(allpos[..., 0])
    grow = lambda a, k: np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(k))) > 0
    near = grow(region, 9)
    dark = region & (lum < 0.9)
    dark = (grow(dark, 7) & region) | (near & gutter)
    white = np.median(img[region & ~dark], 0)
    img = img.copy()
    img[dark] = white
    print(f"  painted out {dark.sum()} texels of the shirt-back print (white {np.round(white, 3)})")
    return img


def smooth_normals(P, I):
    """Area-weighted normals, shared across the UV seams (the generated
    mesh splits a vertex at every seam, so its own normals show facets and
    hard creases that the outline shell then pokes through)."""
    key = np.round(P / 1e-5).astype(np.int64)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.reshape(-1)
    a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
    fn = np.cross(b - a, c - a)
    acc = np.zeros((weld.max() + 1, 3))
    for k in range(3):
        np.add.at(acc, weld[I[:, k]], fn)
    n = acc[weld]
    return (n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)).astype(np.float32)


def jpeg(img_f, q):
    im = Image.fromarray((np.clip(img_f, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((TEX, TEX), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q, optimize=True, progressive=False)
    return buf.getvalue()


def build_model(name):
    j, b = glb.read(os.path.join(SRC, name + ".glb"))
    prim = j["meshes"][0]["primitives"][0]
    A = prim["attributes"]
    P = glb.accessor(j, b, A["POSITION"]).astype(np.float32)
    N = glb.accessor(j, b, A["NORMAL"]).astype(np.float32)
    UV = glb.accessor(j, b, A["TEXCOORD_0"]).astype(np.float32)
    JN = glb.accessor(j, b, A["JOINTS_0"])
    WT = glb.accessor(j, b, A["WEIGHTS_0"]).astype(np.float64)
    I = glb.accessor(j, b, prim["indices"]).reshape(-1, 3)
    mat = j["materials"][0]
    src_of = lambda ti: j["textures"][ti]["source"]
    base = np.asarray(Image.open(io.BytesIO(glb.image_bytes(j, b, src_of(mat["pbrMetallicRoughness"]["baseColorTexture"]["index"])))).convert("RGB")).astype(np.float32) / 255
    nrm = np.asarray(Image.open(io.BytesIO(glb.image_bytes(j, b, src_of(mat["normalTexture"]["index"])))).convert("RGB")).astype(np.float32) / 255
    if name == "player-long":
        base = paint_out_number(base, P, UV, I)

    # Average skin (forearms and face) and hair (crown), linear light.
    c = texel_colours(base, UV)
    forearm = (np.abs(P[:, 0]) > 0.26) & (P[:, 1] > 1.05) & (P[:, 1] < 1.2)
    face = (P[:, 2] > 0.06) & (P[:, 1] > 1.57) & (P[:, 1] < 1.67) & (np.abs(P[:, 0]) < 0.04)
    crown = P[:, 1] > 1.74
    if name == "manager":
        skin_sel = face
    else:
        skin_sel = forearm | face
    skin = srgb_to_lin(np.median(c[skin_sel], 0))
    hair = srgb_to_lin(np.median(c[crown], 0))

    # Rest landmarks off the bind pose.
    J = glb.bind_joints(j, b)
    jp = {k: [round(float(v), 4) for v in M[:3, 3]] for k, M in J.items()}
    head = P[:, 1] > FACE[name]["chinY"]
    front_z = float(P[head & (np.abs(P[:, 0]) < 0.02)][:, 2].max())

    # Each hand's own axes (rest pose, world): fingers "along", the palm's
    # normal (towards the thigh), the thumb's side (forwards); and its length.
    names = [j["nodes"][i]["name"] for i in j["skins"][0]["joints"]]
    hands = {}
    for side, bone in (("L", "LeftHand"), ("R", "RightHand")):
        hi = names.index(bone)
        sel = ((JN == hi) * WT).sum(1) > 0.5
        H = P[sel].astype(np.float64)
        wrist = J[bone][:3, 3]
        c = H.mean(0)
        ev, vec = np.linalg.eigh(np.cov((H - c).T))
        along = vec[:, 2] * np.sign(np.dot(vec[:, 2], c - wrist))
        palm = vec[:, 0]
        palm = palm * (-np.sign(palm[0] * wrist[0]))  # towards the body's middle
        thumb = np.cross(along, palm)
        thumb = thumb * np.sign(thumb[2])  # thumbs forward in the rest pose
        length = float(((H - wrist) @ along).max())
        hands[side] = {"along": [round(float(v), 4) for v in along], "palm": [round(float(v), 4) for v in palm],
                       "thumb": [round(float(v), 4) for v in thumb], "len": round(length, 4)}

    # Skin weights as bytes, each vertex's four summing to exactly 255.
    WT = WT / np.maximum(WT.sum(1, keepdims=True), 1e-9)
    wq = np.floor(WT * 255).astype(np.int32)
    rem = 255 - wq.sum(1)
    order = np.argsort(-(WT * 255 - wq), 1)
    for k in range(4):
        add = rem > k
        wq[np.arange(len(wq))[add], order[add, k]] += 1
    w = glb.Writer()
    acc = {
        "POSITION": w.acc(P, "VEC3", 34962, minmax=True),
        "NORMAL": w.acc(smooth_normals(P, I), "VEC3", 34962),
        "TEXCOORD_0": w.acc(UV, "VEC2", 34962),
        "JOINTS_0": w.acc(JN.astype(np.uint8), "VEC4", 34962),
        "WEIGHTS_0": w.acc(wq.astype(np.uint8), "VEC4", 34962, normalized=True),
    }
    idx = w.acc(I.reshape(-1).astype(np.uint16 if len(P) < 65536 else np.uint32), "SCALAR", 34963)
    sk = j["skins"][0]
    ibm = glb.accessor(j, b, sk["inverseBindMatrices"]).astype(np.float32)
    ibm_acc = w.acc(ibm, "MAT4")
    img0 = w.view(jpeg(base, 86))
    img1 = w.view(jpeg(nrm, 82))
    nodes = [{k: v for k, v in n.items() if k not in ("mesh", "skin")} for n in j["nodes"]]
    mesh_node = next(i for i, n in enumerate(j["nodes"]) if "mesh" in n)
    nodes[mesh_node]["mesh"] = 0
    nodes[mesh_node]["skin"] = 0
    nodes[mesh_node]["name"] = "Body"
    out = {
        "asset": {"version": "2.0", "generator": "knowitball build_people3d.py"},
        "scene": 0,
        "scenes": [{"name": name, "nodes": j["scenes"][0]["nodes"], "extras": {
            "model": name,
            "skinAvg": [round(float(v), 5) for v in skin],
            "hairAvg": [round(float(v), 5) for v in hair],
            "face": {**FACE[name], "frontZ": round(front_z, 4)},
            "kit": KIT,
            "joints": jp,
            "hands": hands,
        }}],
        "nodes": nodes,
        "meshes": [{"name": "Body", "primitives": [{"attributes": acc, "indices": idx, "material": 0}]}],
        "skins": [{"joints": sk["joints"], "inverseBindMatrices": ibm_acc, **({"skeleton": sk["skeleton"]} if "skeleton" in sk else {})}],
        "materials": [{
            "name": "Body",
            "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.72},
            "normalTexture": {"index": 1},
            "doubleSided": True,
        }],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": img0, "mimeType": "image/jpeg"}, {"bufferView": img1, "mimeType": "image/jpeg"}],
        "textures": [{"sampler": 0, "source": 0}, {"sampler": 0, "source": 1}],
    }
    n = w.save(os.path.join(OUT, name + ".glb"), out)
    print(f"{name}.glb  {n / 1e6:.2f} MB  skin {np.round(skin, 3)} hair {np.round(hair, 3)} frontZ {front_z:.3f}")


def build_anims():
    w = glb.Writer()
    base_j, base_b = glb.read(os.path.join(SRC, "player.glb"))
    # Skeleton only: Armature + bones (no mesh).
    keep = [i for i, n in enumerate(base_j["nodes"]) if "mesh" not in n]
    remap = {old: new for new, old in enumerate(keep)}
    nodes = []
    for i in keep:
        n = {k: v for k, v in base_j["nodes"][i].items() if k != "children"}
        ch = [remap[c] for c in base_j["nodes"][i].get("children", []) if c in remap]
        if ch:
            n["children"] = ch
        nodes.append(n)
    name_to_node = {n["name"]: i for i, n in enumerate(nodes)}
    root = name_to_node["Armature"]
    hips_y = next(n for n in nodes if n["name"] == "Hips")["translation"][1]
    anims = []
    for file, short in CLIPS.items():
        j, b = glb.read(os.path.join(SRC, file + ".glb"))
        a = j["animations"][0]
        # Each clip file was rigged on its own copy of the body (hips at 93-97
        # cm, not player.glb's 102.7): its hip heights are scaled to player.glb.
        k = hips_y / next(n for n in j["nodes"] if n.get("name") == "Hips")["translation"][1]
        chans, samps = [], []
        for ch in a["channels"]:
            tgt = j["nodes"][ch["target"]["node"]]["name"]
            path = ch["target"]["path"]
            if path == "scale" or (path == "translation" and tgt != "Hips"):
                continue
            s = a["samplers"][ch["sampler"]]
            t = glb.accessor(j, b, s["input"]).astype(np.float32)
            v = glb.accessor(j, b, s["output"]).astype(np.float32)
            if path == "translation":
                v = v * k
            if path == "translation" and short in IN_PLACE:
                # take out the travel: z held, x's drift removed (the sway stays)
                v = v.copy()
                v[:, 2] = v[0, 2]
                fit = np.polyfit(t, v[:, 0], 1)
                v[:, 0] = v[:, 0] - (fit[0] * t)
            samps.append({"input": w.acc(t, "SCALAR", minmax=True), "output": w.acc(v, "VEC4" if path == "rotation" else "VEC3"),
                          "interpolation": s.get("interpolation", "LINEAR")})
            chans.append({"sampler": len(samps) - 1, "target": {"node": name_to_node[tgt], "path": path}})
        anims.append({"name": short, "channels": chans, "samplers": samps})
    out = {
        "asset": {"version": "2.0", "generator": "knowitball build_people3d.py"},
        "scene": 0, "scenes": [{"nodes": [root], "extras": {"hipsY": hips_y}}], "nodes": nodes, "animations": anims,
    }
    n = w.save(os.path.join(OUT, "anims.glb"), out)
    print(f"anims.glb  {n / 1e6:.2f} MB  clips {[a['name'] for a in anims]}")


if __name__ == "__main__":
    for m in ["player", "player-buzz", "player-long", "manager"]:
        build_model(m)
    build_anims()
    # Pack the clips small (scripts/perf3d/shrink-models.mjs). The bodies stay
    # plain: build_onebody.py reads them, and packs them at its own end.
    sys.path.insert(0, os.path.join(HERE, "..", "perf3d"))
    from shrink_after_build import shrink
    shrink([os.path.join(OUT, "anims.glb")])
    print("Next: python3 scripts/people3d/build_onebody.py (reads these bodies, then packs them and onebody/ small).")
