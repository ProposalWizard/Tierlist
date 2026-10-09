"""Build the football and casino clip files, for both 3D skeletons.

    python3 tools/anims3d/build.py [<UAL1_Standard.glb>] [--sheet <dir>]

Writes (then packs small with scripts/perf3d/shrink-models.mjs):
  public/star/anims3d/football.glb      the new 3D people (people3d.ts / onebody)
  public/star/anims3d/casino.glb
  public/star/anims3d/football-ual.glb  the old shop/garden footballer (shop3d/character.glb)
  public/star/anims3d/casino-ual.glb

Every clip is hand-made here (tools/anims3d/clips.py): a pose per frame in
the character's own frame, solved onto each skeleton (tools/anims3d/rig.py).
Only bone turns go in, plus the hips' position; no mesh. The moments code
times things to (the kick's contact, where the ball sits, juggling touches)
are measured off the solved bodies and written into the file (scene extras
"clips"), so the game reads them rather than guessing.

UAL1_Standard.glb (Quaternius, CC0) is optional: if given, the old
footballer's fingers take their resting curl from its Idle_Loop.
--sheet draws a stick-figure contact sheet of every clip (needs Pillow).
"""
import os, sys, json, struct
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "scripts", "people3d"))
from rig import Rig, solve, qrot, CANON  # noqa: E402
import clips as C  # noqa: E402

FPS = 30
OUT = os.path.join(ROOT, "public", "star", "anims3d")


def ual_finger_base(ual1):
    import glb
    j, b = glb.read(ual1)
    names = [n["name"] for n in j["nodes"]]
    a = [x for x in j["animations"] if x["name"] == "Idle_Loop"][0]
    out = {}
    for ch in a["channels"]:
        nm = names[ch["target"]["node"]]
        if ch["target"]["path"] != "rotation":
            continue
        if not any(k in nm for k in ("thumb", "index", "middle", "ring", "pinky")):
            continue
        out[nm] = glb.accessor(j, b, a["samplers"][ch["sampler"]]["output"])[0].tolist()
    return out


class Writer:
    def __init__(self):
        self.j = {"asset": {"version": "2.0", "generator": "knowitball tools/anims3d/build.py"}, "bufferViews": [], "accessors": []}
        self.blob = bytearray()

    def acc(self, arr, typ):
        arr = np.asarray(arr, np.float32)
        while len(self.blob) % 4:
            self.blob.append(0)
        self.j["bufferViews"].append({"buffer": 0, "byteOffset": len(self.blob), "byteLength": arr.nbytes})
        self.blob += arr.tobytes()
        a = {"bufferView": len(self.j["bufferViews"]) - 1, "componentType": 5126, "count": int(arr.shape[0]), "type": typ}
        if typ == "SCALAR":
            a["min"], a["max"] = [float(arr.min())], [float(arr.max())]
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


def instep(ctx, side):
    """Where a ball meets the laces: between ankle and toe joints, a touch below."""
    a, t = ctx.pos("foot" + side), ctx.pos("toe" + side)
    return a * 0.45 + t * 0.55


def part_point(ctx, m):
    """The point of the body that meets the ball (meta "part"; default the instep of meta "foot")."""
    part = m.get("part", "foot")
    if part == "foot":
        return instep(ctx, m.get("foot", "R"))
    if part == "head":  # the forehead
        return ctx.head_at((0, 0.12, 0.10))
    if part == "chest":
        return ctx.chest((0, 0.02, 0.15))
    if part.startswith("thigh"):  # the top of the thigh, near the knee
        s = part[-1]
        return lerp3(ctx.pos("thigh" + s), ctx.pos("shin" + s), 0.72) + np.array([0, 0.08, 0])
    if part == "hands":
        return (ctx.pos("handL") + ctx.pos("handR")) / 2
    if part.startswith("hand"):
        return ctx.pos("hand" + part[-1])
    raise ValueError(part)


def lerp3(a, b, k):
    return a + (b - a) * k


def bake(rig, table):
    """-> (animations json-ready list of (name, times, {bone: rots}, hips pos), meta)"""
    out, meta = [], {}
    for name, (dur, loop, fn, m) in table.items():
        n = int(round(dur * FPS))
        frames = n if loop else n + 1
        times = np.arange(frames) / FPS
        if loop:
            times = np.append(times, dur)  # the loop's last key = its first
        rots = {k: [] for k in CANON}
        hips = []
        ctxs = []
        for i, t in enumerate(times):
            tt = 0.0 if (loop and i == len(times) - 1) else t
            local, hp, ctx = solve(rig, fn(rig, tt))
            for k in CANON:
                q = local[rig.b[k]]
                prev = rots[k][-1] if rots[k] else None
                if prev is not None and np.dot(prev, q) < 0:
                    q = -q
                rots[k].append(q)
            hips.append(hp)
            ctxs.append((t, ctx))
        mm = dict(m)
        mm["duration"] = dur
        mm["loop"] = loop
        # measured moments, in the character's own frame (metres, x = his left, z = forward)
        def at(time):
            return min(ctxs, key=lambda c: abs(c[0] - time))[1]
        if "contact" in m:
            ip = part_point(at(m["contact"]), m)
            if m.get("part", "foot") == "foot":
                mm["ball"] = [round(float(ip[0]), 3), round(float(ip[2]) + 0.09, 3)]
                mm["contactFoot"] = [round(float(v), 3) for v in ip]
            mm["contactPoint"] = [round(float(v), 3) for v in ip]
            mm.setdefault("part", "foot")
        if "touches" in m:
            mm["touches"] = [[tt, s, [round(float(v), 3) for v in instep(at(tt), s) + np.array([0, 0.12, 0.03])]] for tt, s in m["touches"]]
        meta[name] = mm
        out.append((name, times, rots, hips))
    return out, meta


def write(rig, src_json, baked, meta, path, hips_y):
    W = Writer()
    keep = [i for i, nd in enumerate(src_json["nodes"]) if "mesh" not in nd and "skin" not in nd]
    remap = {o: k for k, o in enumerate(keep)}
    nodes = []
    for i in keep:
        nd = {k: v for k, v in src_json["nodes"][i].items() if k not in ("mesh", "skin", "extras")}
        if "children" in nd:
            nd["children"] = [remap[c] for c in nd["children"] if c in remap]
        nodes.append(nd)
    W.j["nodes"] = nodes
    roots = [remap[r] for r in src_json["scenes"][0]["nodes"] if r in remap]
    W.j["scenes"] = [{"nodes": roots, "extras": {"hipsY": hips_y, "clips": meta}}]
    W.j["scene"] = 0
    anims = []
    for name, times, rots, hips in baked:
        tin = W.acc(times, "SCALAR")
        samplers, channels = [], []
        for k in CANON:
            node = remap[rig.b[k]]
            arr = np.array(rots[k])
            if np.max(np.abs(arr - arr[0])) < 1e-5:
                samplers.append({"input": W.acc(times[[0, -1]], "SCALAR"), "output": W.acc(arr[[0, -1]], "VEC4"), "interpolation": "LINEAR"})
            else:
                samplers.append({"input": tin, "output": W.acc(arr, "VEC4"), "interpolation": "LINEAR"})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": "rotation"}})
        samplers.append({"input": tin, "output": W.acc(np.array(hips), "VEC3"), "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": remap[rig.b["hips"]], "path": "translation"}})
        anims.append({"name": name, "samplers": samplers, "channels": channels})
    W.j["animations"] = anims
    return W.save(path)


def sheet(rig, table, path):
    from PIL import Image, ImageDraw
    bones = [("hips", "spine1"), ("spine1", "spine2"), ("spine2", "spine3"), ("spine3", "neck"), ("neck", "head"),
             ("spine3", "shL"), ("shL", "armL"), ("armL", "foreL"), ("foreL", "handL"),
             ("spine3", "shR"), ("shR", "armR"), ("armR", "foreR"), ("foreR", "handR"),
             ("hips", "thighL"), ("thighL", "shinL"), ("shinL", "footL"), ("footL", "toeL"),
             ("hips", "thighR"), ("thighR", "shinR"), ("shinR", "footR"), ("footR", "toeR")]
    cols = 8
    cw, ch = 150, 190
    names = list(table)
    img = Image.new("RGB", (cols * cw, len(names) * 2 * ch), "white")
    d = ImageDraw.Draw(img)
    for r, name in enumerate(names):
        dur, loop, fn, m = table[name]
        ts = [dur * cidx / (cols - 1 if not loop else cols) for cidx in range(cols)]
        if "contact" in m:
            j = min(range(cols), key=lambda i: abs(ts[i] - m["contact"]))
            ts[j] = m["contact"]
        for cidx in range(cols):
            t = ts[cidx]
            _, _, ctx = solve(rig, fn(rig, t))
            P = {k: ctx.pos(k) for k in CANON}
            P["head"] = ctx.head_top((0, -0.08, 0))
            cz = P["hips"][2]
            for view in (0, 1):
                ox, oy = cidx * cw, (r * 2 + view) * ch
                d.rectangle([ox, oy, ox + cw - 1, oy + ch - 1], outline="#ddd")
                d.text((ox + 3, oy + 2), f"{name} {t:.2f} {'side' if view == 0 else 'front'}", fill="black")
                sc = 80
                def pt(p):
                    if view == 0:  # side: z to the right
                        return ox + cw / 2 + (p[2] - cz) * sc, oy + ch - 12 - p[1] * sc
                    return ox + cw / 2 - p[0] * sc, oy + ch - 12 - p[1] * sc
                d.line([ox, oy + ch - 12, ox + cw, oy + ch - 12], fill="#8c8")
                for a, b in bones:
                    col = "red" if a.endswith("R") or b.endswith("R") else ("blue" if a.endswith("L") or b.endswith("L") else "black")
                    d.line([pt(P[a]), pt(P[b])], fill=col, width=3)
                hx, hy = pt(P["head"])
                d.ellipse([hx - 7, hy - 7, hx + 7, hy + 7], outline="black", width=2)
                if "contact" in m and abs(t - m["contact"]) < dur / cols / 2 + 1e-6:
                    bp = part_point(ctx, m)
                    bx, by = pt(bp)
                    d.ellipse([bx - 9, by - 9, bx + 9, by + 9], outline="green", width=2)
    img.save(path)


def main():
    args = sys.argv[1:]
    sheet_dir = None
    if "--sheet" in args:
        i = args.index("--sheet")
        sheet_dir = args[i + 1]
        args = args[:i] + args[i + 2:]
    args = [a for a in args if not a.startswith("--")]
    ual1 = args[0] if args else None
    os.makedirs(OUT, exist_ok=True)
    p3 = Rig("p3", os.path.join(ROOT, "public", "star", "people3d", "anims.glb"))
    base = ual_finger_base(ual1) if ual1 else None
    ual = Rig("ual", os.path.join(ROOT, "public", "star", "shop3d", "character.glb"), base)
    written = []
    for rig, suffix in ((p3, ""), (ual, "-ual")):
        for label, table in (("football", C.FOOTBALL), ("casino", C.CASINO)):
            baked, meta = bake(rig, table)
            path = os.path.join(OUT, f"{label}{suffix}.glb")
            # p3: the hips' rest height in the file's own (centimetre) units, as people3d/anims.glb has it
            hy = float(rig.T[rig.b["hips"]][1])
            size = write(rig, rig.json, baked, meta, path, hy)
            print(path, size, "bytes;", {k: {kk: v for kk, v in m.items() if kk in ("ball", "contact", "touches")} for k, m in meta.items() if "ball" in m or "touches" in m})
            written.append(path)
            if sheet_dir:
                os.makedirs(sheet_dir, exist_ok=True)
                sheet(rig, table, os.path.join(sheet_dir, f"{label}{suffix}.png"))
    return written


if __name__ == "__main__":
    files = main()
    if "--no-shrink" not in sys.argv:
        sys.path.insert(0, os.path.join(ROOT, "scripts", "perf3d"))
        from shrink_after_build import shrink
        shrink(files)
