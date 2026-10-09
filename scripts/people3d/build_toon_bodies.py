"""
STYLE A BODIES (Harry, 9 Oct 2026: "Style A becomes the Knowitball standard …
it just needs a new model cos I don't like that guy").

    python3 scripts/people3d/build_toon_bodies.py <model-test folder with c1/ c2/ c3/>
    node scripts/perf3d/shrink-models.mjs star/people3d/toon-c1.glb star/people3d/toon-c2.glb star/people3d/toon-c3.glb

Reads the three Higgsfield-generated bodies (cN/anim.glb: rigged to the
MakeHuman skeleton the game already uses, ~9.4-10k triangles, a 4096 baked
colour texture) and writes public/star/people3d/toon-c1.glb .. toon-c3.glb:

  - scaled to 1.83 m (positions, bone lengths and inverse bind matrices);
  - one skinned mesh "Body", smooth normals (no facets for the outline);
  - baseColorTexture 1024: the body's own colours, except every kit texel
    (shirt, shorts, socks, boots) becomes a GREY of its own shading (folds and
    seams kept), so the game paints any club's colours onto it;
  - occlusionTexture 512 (a MASK, not occlusion; people3d.ts takes it off the
    material): R = kit, G = skin, B = hair. The shader splits the kit into
    shirt / shorts / socks / boots by the rest-pose heights in extras.kit;
  - scene.extras: what the game needs (as build_people3d.py's bodies), plus
    toon: true. The clips are NOT kept: people3d/anims.glb plays on these.
"""
import io, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
import glb, raster  # noqa: E402
from build_people3d import smooth_normals, srgb_to_lin  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "star", "people3d")
HEIGHT = 1.83
TEX = int(os.environ.get("TOON_TEX", "1024"))  # 2048 for the higher-detail heads (sharper faces)
MASK = 512


def lum(c):
    return c[..., 0] * 0.2126 + c[..., 1] * 0.7152 + c[..., 2] * 0.0722


def dilate_into(img, covered, steps=10):
    """Fill uncovered texels from their covered neighbours (gutter bleed)."""
    img = img.copy()
    have = covered.copy()
    for _ in range(steps):
        acc = np.zeros_like(img)
        n = np.zeros(have.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(have, dy, 0), dx, 1)
            acc += np.roll(np.roll(img * have[..., None], dy, 0), dx, 1)
            n += sh
        grow = (~have) & (n > 0)
        img[grow] = acc[grow] / n[grow][:, None]
        have = have | grow
    return img


def build(src, tag, suit=False):
    """src: a fitted .glb (tools/modeltest/fit.py). suit: a manager in a suit — his clothes
    keep their own colours (no kit mask), only skin and hair are recoloured."""
    name = tag
    j, b = glb.read(src)
    prim = j["meshes"][0]["primitives"][0]
    A = prim["attributes"]
    P = glb.accessor(j, b, A["POSITION"]).astype(np.float64)
    UV = glb.accessor(j, b, A["TEXCOORD_0"]).astype(np.float32)
    JN = glb.accessor(j, b, A["JOINTS_0"])
    WT = glb.accessor(j, b, A["WEIGHTS_0"]).astype(np.float64)
    I = glb.accessor(j, b, prim["indices"]).reshape(-1, 3)
    s = HEIGHT / P[:, 1].max()
    P = (P * s).astype(np.float32)

    sk = j["skins"][0]
    ibm = glb.accessor(j, b, sk["inverseBindMatrices"]).astype(np.float64).reshape(-1, 16)
    ibm[:, 12:15] *= s  # column-major: the translation
    nodes = [{k: v for k, v in n.items() if k not in ("mesh", "skin")} for n in j["nodes"]]
    for i in sk["joints"]:
        if "translation" in nodes[i]:
            nodes[i]["translation"] = [float(v) * s for v in nodes[i]["translation"]]
    J = {j["nodes"][i]["name"]: np.linalg.inv(M.reshape(4, 4).T) for i, M in zip(sk["joints"], ibm)}
    jp = {k: [round(float(v), 4) for v in M[:3, 3]] for k, M in J.items()}
    jy = lambda n: J[n][1, 3]

    # Colour texture, down to 1024.
    mat = j["materials"][0]
    ti = mat["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    big = Image.open(io.BytesIO(glb.image_bytes(j, b, j["textures"][ti]["source"]))).convert("RGB")
    base = np.asarray(big.resize((TEX, TEX), Image.LANCZOS)).astype(np.float32) / 255

    # Where on the body each texel is (rest pose, metres).
    pos = raster.raster(UV[I] * [TEX, TEX], P[I].astype(np.float32), TEX, TEX)
    cov = ~np.isnan(pos[..., 0])
    x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
    top = float(P[:, 1].max())

    # Reference colours, read where each thing must be.
    def med(sel):
        return np.median(base[cov & sel], 0)
    hipsY, kneeY, footY = jy("Hips"), jy("LeftLeg"), jy("LeftFoot")
    neckY = jy("neck")
    ref = {
        "hair": med((y > top - 0.03)),
        "shirt": med((np.abs(x) < 0.08) & (y > (hipsY + neckY) / 2) & (y < neckY - 0.12) & (z > 0.02)),
        "shorts": med((np.abs(np.abs(x) - 0.1) < 0.04) & (y > hipsY - 0.14) & (y < hipsY - 0.08) & (z > 0)),
        "socks": med((np.abs(y - (kneeY + footY) / 2) < 0.06) & (np.abs(x) > 0.04)),
        "boots": med((y < 0.05) & (np.abs(x) > 0.03)),
    }
    fore = np.zeros_like(cov)
    for side in ("Left", "Right"):
        e, w = J[side + "ForeArm"][:3, 3], J[side + "Hand"][:3, 3]
        ab = w - e
        t = ((pos - e) @ ab) / (ab @ ab)
        d = np.linalg.norm(pos - (e + np.clip(t, 0, 1)[..., None] * ab), axis=-1)
        fore |= (t > 0.25) & (t < 0.85) & (d < 0.06)
    ref["skin"] = med(fore)
    if suit:
        # sleeves cover his forearms: skin from the front of the face, below the eyes
        ref["skin"] = med((y > neckY + 0.06) & (y < top - 0.14) & (z > 0) & (np.abs(x) > 0.02) & (np.abs(x) < 0.06))
    print(name, {k: np.round(v, 2).tolist() for k, v in ref.items()})

    # Classify each texel by the nearest reference, within where it can be.
    names = ["skin", "hair", "shirt", "shorts", "socks", "boots"]
    R = np.stack([ref[n] for n in names])
    d = np.linalg.norm(base[..., None, :] - R[None, None], axis=-1)
    head = y > neckY + 0.02
    allow = np.ones(d.shape, bool)
    allow[..., 1] = head                                   # hair only on the head
    allow[..., 2] = (~head) & (y > hipsY - 0.2)            # shirt
    allow[..., 3] = (~head) & (y > kneeY - 0.02) & (y < hipsY + 0.12)
    allow[..., 4] = (~head) & (y < kneeY + 0.08) & (y > 0.02)
    allow[..., 5] = y < footY + 0.06
    allow[..., 2:] &= ~head[..., None]
    d = np.where(allow, d, 9.0)
    cls = np.argmin(d, -1)
    dmin = np.min(d, -1)
    # On the head, a texel far from both skin and hair (eyes, mouth, brows) stays as it is.
    keep = head & (dmin > 0.22)
    kit = cov & (cls >= 2) & ~keep
    if suit:
        kit = np.zeros_like(kit)
    skin = cov & (cls == 0) & ~keep
    hair = cov & (cls == 1) & ~keep

    # Kit lines (rest y), from the classes.
    legs = cov & (np.abs(x) > 0.03)
    def pct(sel, q, fall):
        v = y[sel]
        return float(np.percentile(v, q)) if v.size > 50 else fall
    shirt_lo = pct(cov & (cls == 2) & (y < hipsY + 0.1) & (z > 0) & (np.abs(x) < 0.12), 5, hipsY - 0.06)
    sock_top = pct(legs & (cls == 4), 97, kneeY - 0.05)
    boot_top = pct(legs & (cls == 5) & (y < footY + 0.1), 95, footY + 0.02)
    if np.linalg.norm(ref["shirt"] - ref["shorts"]) < 0.15:
        shirt_lo = hipsY - 0.055   # one colour: the hem where the generated shirt ends (cN/concept.png)
    collar = pct(cov & kit & (np.abs(x) < 0.1) & ~head, 98, neckY - 0.06)
    shorts_lo = pct(legs & (cls == 3) & (y < shirt_lo), 3, kneeY + 0.08)
    ts = []
    for side in ("Left", "Right"):
        a_, e_ = J[side + "Arm"][:3, 3], J[side + "ForeArm"][:3, 3]
        ab = e_ - a_
        t = ((pos - a_) @ ab) / (ab @ ab)
        dd = np.linalg.norm(pos - (a_ + np.clip(t, 0, 1)[..., None] * ab), axis=-1)
        sel = kit & (dd < 0.1) & (np.abs(x) > 0.12) & (t > 0) & (t < 1.1)
        if sel.sum() > 50:
            ts.append(float(np.percentile(t[sel], 97)))
    sleeve_t = float(np.mean(ts)) if ts else 0.45
    kitlines = {"hemY": round(float(shirt_lo), 4), "sockY": round(sock_top, 4), "bootY": round(boot_top, 4),
                "collarY": round(collar, 4), "shortsLoY": round(shorts_lo, 4), "sleeveT": round(sleeve_t, 3)}

    # The kit becomes a grey of its own shading (0.7 = the cloth's own colour).
    gref = np.zeros(base.shape[:2], np.float32)
    for k, n in enumerate(names[2:], start=2):
        gref[cls == k] = max(lum(ref[n]), 0.03)
    shade = np.clip(lum(base) / np.maximum(gref, 1e-3), 0.25, 1.4) * 0.7
    out = base.copy()
    out[kit] = shade[kit][:, None]
    inner = ndimage.binary_erosion(cov, iterations=1)  # an island's edge texels mix in the gutter: redo them
    out = dilate_into(out, inner, 48)

    # The mask, smoothed a texel, at 512.
    m = np.stack([kit, skin, hair], -1).astype(np.float32)
    m = dilate_into(m, inner, 48)
    m = ndimage.uniform_filter(m, (3, 3, 1))
    mimg = Image.fromarray((np.clip(m, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((MASK, MASK), Image.BILINEAR)

    # Averages for the recolour (linear), and the face lines.
    skinAvg = srgb_to_lin(ref["skin"])
    hairAvg = srgb_to_lin(ref["hair"])
    front = cov & head & (z > 0) & (np.abs(x) < 0.07)
    white = front & (lum(base) > 0.78) & (np.ptp(base, -1) < 0.12) & (np.abs(x) > 0.012)
    eyeY = float(np.median(y[white])) if white.sum() > 10 else neckY + 0.6 * (top - neckY)
    chinY = max(neckY + 0.02, 2 * eyeY - top)
    browY = eyeY + 0.12 * (top - eyeY)
    hd = P[:, 1] > chinY
    frontZ = float(P[hd & (np.abs(P[:, 0]) < 0.02)][:, 2].max())

    bnames = [j["nodes"][i]["name"] for i in sk["joints"]]
    hands = {}
    for side, bone in (("L", "LeftHand"), ("R", "RightHand")):
        hi = bnames.index(bone)
        sel = ((JN == hi) * WT).sum(1) > 0.5
        H = P[sel].astype(np.float64)
        wrist = J[bone][:3, 3]
        c = H.mean(0)
        ev, vec = np.linalg.eigh(np.cov((H - c).T))
        along = vec[:, 2] * np.sign(np.dot(vec[:, 2], c - wrist))
        palm = vec[:, 0] * (-np.sign(vec[0, 0] * wrist[0]))
        thumb = np.cross(along, palm)
        thumb = thumb * np.sign(thumb[2])
        hands[side] = {"along": [round(float(v), 4) for v in along], "palm": [round(float(v), 4) for v in palm],
                       "thumb": [round(float(v), 4) for v in thumb], "len": round(float(((H - wrist) @ along).max()), 4)}

    # Fingers (their bones came with the rig): the axis each one curls about,
    # as the one body's (build_onebody.py), so the grips and relaxed hands work.
    fingers = {}
    for side, pre in (("L", "Left"), ("R", "Right")):
        palm = np.array(hands[side]["palm"])
        out_f = {}
        for f in ("Thumb", "Index", "Middle", "Ring", "Little"):
            bn = [f"{pre}Hand{f}{k}" for k in (1, 2, 3)]
            if not all(n in J for n in bn):
                break
            p1, p3 = J[bn[0]][:3, 3], J[bn[2]][:3, 3]
            d = (p3 - p1) / max(np.linalg.norm(p3 - p1), 1e-6)
            ax = np.cross(d, palm); ax /= max(np.linalg.norm(ax), 1e-6)
            m = {"bones": bn, "axis": [round(float(v), 5) for v in ax], "dir": [round(float(v), 5) for v in d],
                 "len": round(float(np.linalg.norm(p3 - p1) * 1.35), 4)}
            if f == "Thumb":
                sw = -palm - d * np.dot(-palm, d); sw /= max(np.linalg.norm(sw), 1e-6)
                m["swing"] = [round(float(v), 5) for v in sw]
            out_f[f.lower()] = m
        if len(out_f) == 5:
            fingers[side] = out_f
    WT = WT / np.maximum(WT.sum(1, keepdims=True), 1e-9)
    wq = np.floor(WT * 255).astype(np.int32)
    rem = 255 - wq.sum(1)
    order = np.argsort(-(WT * 255 - wq), 1)
    for k in range(4):
        add = rem > k
        wq[np.arange(len(wq))[add], order[add, k]] += 1

    def enc(im, fmt, **kw):
        buf = io.BytesIO(); im.save(buf, fmt, **kw); return buf.getvalue()

    w = glb.Writer()
    acc = {
        "POSITION": w.acc(P, "VEC3", 34962, minmax=True),
        "NORMAL": w.acc(smooth_normals(P, I), "VEC3", 34962),
        "TEXCOORD_0": w.acc(UV, "VEC2", 34962),
        "JOINTS_0": w.acc(JN.astype(np.uint8), "VEC4", 34962),
        "WEIGHTS_0": w.acc(wq.astype(np.uint8), "VEC4", 34962, normalized=True),
    }
    idx = w.acc(I.reshape(-1).astype(np.uint16), "SCALAR", 34963)
    ibm_acc = w.acc(ibm.astype(np.float32), "MAT4")
    img0 = w.view(enc(Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)), "JPEG", quality=88))
    img1 = w.view(enc(mimg, "PNG", optimize=True))
    mesh_node = next(i for i, n in enumerate(j["nodes"]) if "mesh" in n)
    nodes[mesh_node].update({"mesh": 0, "skin": 0, "name": "Body"})
    model = f"toon-{tag}"
    doc = {
        "asset": {"version": "2.0", "generator": "knowitball build_toon_bodies.py"},
        "scene": 0,
        "scenes": [{"name": model, "nodes": j["scenes"][0]["nodes"], "extras": {
            "model": model, "toon": True,
            "skinAvg": [round(float(v), 5) for v in skinAvg],
            "hairAvg": [round(float(v), 5) for v in hairAvg],
            "face": {"chinY": round(chinY, 4), "eyeY": round(eyeY, 4), "browY": round(browY, 4), "frontZ": round(frontZ, 4)},
            "kit": kitlines,
            "joints": jp,
            "hands": hands,
            **({"fingers": fingers} if len(fingers) == 2 else {}),
        }}],
        "nodes": nodes,
        "meshes": [{"name": "Body", "primitives": [{"attributes": acc, "indices": idx, "material": 0}]}],
        "skins": [{"joints": sk["joints"], "inverseBindMatrices": ibm_acc, **({"skeleton": sk["skeleton"]} if "skeleton" in sk else {})}],
        "materials": [{
            "name": "Body",
            "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.85},
            "occlusionTexture": {"index": 1},
        }],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": img0, "mimeType": "image/jpeg"}, {"bufferView": img1, "mimeType": "image/png"}],
        "textures": [{"sampler": 0, "source": 0}, {"sampler": 0, "source": 1}],
    }
    n = w.save(os.path.join(OUT, model + ".glb"), doc)
    print(f"  {model}.glb {n / 1e6:.2f} MB  scale {s:.3f}  tris {len(I)}  kit {kitlines}  face eye {eyeY:.3f} chin {chinY:.3f}  "
          f"kit {kit.sum()} skin {skin.sum()} hair {hair.sum()} kept {(cov & keep).sum()} texels")
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).resize((256, 256)).save(os.path.join(SRC, f"toon-{tag}-base.png"))
    mimg.resize((256, 256)).save(os.path.join(SRC, f"toon-{tag}-mask.png"))


if __name__ == "__main__":
    # build_toon_bodies.py <dir>                      the first three: <dir>/c1/anim.glb … c3
    # build_toon_bodies.py <dir> tag:file[:suit] …    any fitted body (file relative to <dir>)
    jobs = sys.argv[2:] or [f"{t}:{t}/anim.glb" for t in ("c1", "c2", "c3")]
    for jb in jobs:
        parts = jb.split(":")
        build(os.path.join(SRC, parts[1]), parts[0], suit=len(parts) > 2 and parts[2] == "suit")
