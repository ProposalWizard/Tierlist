"""Build public/star/garden3d/anims.glb: the extra clips the 3D garden's people use.

    python tools/garden3d/build_anims.py <UAL1_Standard.glb> <UAL2_Standard.glb> public/star/shop3d/character.glb public/star/garden3d/anims.glb

Same method as tools/shop3d/build_assets.py's build_anims (rotations only,
plus the pelvis height re-based onto the shop footballer's body), for clips
from Quaternius' Universal Animation Library 1 and 2 (CC0). The body is the
shop's own character.glb, so these play on the same person.
"""
import sys
sys.path.insert(0, "tools/shop3d")
import build_assets as B

CLIPS = {
    "ual1": ["Sitting_Idle_Loop", "Sitting_Talking_Loop", "Idle_Talking_Loop"],
    "ual2": ["Consume", "Idle_TalkingPhone_Loop", "Idle_FoldArms_Loop"],
}


def main(ual1, ual2, body, out):
    bj, _, _ = B.read_gltf(body)
    body_pelvis = [n for n in bj["nodes"] if n["name"] == "pelvis"][0]["translation"]
    W = B.Writer()
    first = True
    anims = []
    for path, names in ((ual1, CLIPS["ual1"]), (ual2, CLIPS["ual2"])):
        uj, uviews, _ = B.read_gltf(path)
        joints = set(uj["skins"][0]["joints"])
        keep = [i for i, n in enumerate(uj["nodes"]) if "mesh" not in n]
        remap = {old: new for new, old in enumerate(keep)}
        if first:
            nodes = []
            for i in keep:
                n = {k: v for k, v in uj["nodes"][i].items() if k not in ("skin", "mesh")}
                if "children" in n:
                    n["children"] = [remap[c] for c in n["children"] if c in remap]
                nodes.append(n)
            W.j["nodes"] = nodes
            W.j["scenes"] = [{"nodes": [remap[r] for r in uj["scenes"][0]["nodes"] if r in remap]}]
            W.j["scene"] = 0
            our = {n["name"]: i for i, n in enumerate(nodes)}
            first = False
        ual_pelvis = [n for n in uj["nodes"] if n["name"] == "pelvis"][0]["translation"]
        cache = {}
        for a in uj["animations"]:
            if a["name"] not in names:
                continue
            samplers, channels = [], []
            for c in a["channels"]:
                node, tpath = c["target"]["node"], c["target"]["path"]
                name = uj["nodes"][node]["name"]
                if node not in joints or tpath == "scale" or name not in our:
                    continue
                if tpath == "translation" and name != "pelvis":
                    continue
                s = a["samplers"][c["sampler"]]
                inp = W.copy_accessor(uj, uviews, s["input"], cache)
                if tpath == "translation":
                    rows = B.accessor_floats(uj, uviews, s["output"])
                    rows = [[r[k] - ual_pelvis[k] + body_pelvis[k] for k in range(3)] for r in rows]
                    outp = W.float_accessor(rows, "VEC3")
                else:
                    outp = W.copy_accessor(uj, uviews, s["output"], {})
                samplers.append({"input": inp, "output": outp, "interpolation": s.get("interpolation", "LINEAR")})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": our[name], "path": tpath}})
            anims.append({"name": a["name"], "samplers": samplers, "channels": channels})
    W.j["animations"] = anims
    print("anims", [a["name"] for a in anims], W.save(out), "bytes")


if __name__ == "__main__":
    main(*sys.argv[1:5])
    # A rebuild writes it big: pack it small (scripts/perf3d/shrink-models.mjs).
    sys.path.insert(0, "scripts/perf3d")
    from shrink_after_build import shrink
    shrink([sys.argv[4]])
