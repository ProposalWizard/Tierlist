"""CARRY TODAY'S FACE ONTO A RE-SHAPED BODY (B5d, 20 Oct 2026).

    python3 tools/bodies/carry_face.py <head h1..h6> <today toon-pN.glb> <new toon-*.glb> [...more new files]

A body made by reshape.py with RS_RIGIDHEAD=1 carries the head as one piece: today's head, moved
and scaled about the head joint (k = the head's scale, from head_end - Head). So the moving face's
landmarks are today's measured ones (lib/star/style3d/toon/faceLandmarks.ts) carried the same way,
exactly, instead of measured again off a smaller picture (which would move the eyes by the
measurement's own noise). Writes each new file's entry into faceFileLandmarks.ts (keyed by its model
name), keeping the others. Check against a fresh measure: scripts/bench3d/faces.mjs --files=… (no --write).
"""
import json, os, re, struct, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
LM = os.path.join(ROOT, "lib/star/style3d/toon/faceLandmarks.ts")
FF = os.path.join(ROOT, "lib/star/style3d/toon/faceFileLandmarks.ts")


def meta(p):
    b = open(p, "rb").read(); n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n])["scenes"][0]["extras"]


head, today, news = sys.argv[1], sys.argv[2], sys.argv[3:]
src = open(LM).read()
m = re.search(r"^  " + head + r": (\{.*\}),$", src, re.M)
L = json.loads(m.group(1))
Jt = meta(today)["joints"]
ff = open(FF).read()
have = dict(re.findall(r'^  "([^"]+)": (\{.*\}),$', ff, re.M))
for f in news:
    mn = meta(f); J = mn["joints"]
    k = (J["head_end"][1] - J["Head"][1]) / (Jt["head_end"][1] - Jt["Head"][1])
    X = lambda v, a: round(J["Head"][a] + k * (v - Jt["Head"][a]), 4)
    S = lambda v: round(v * k, 4)
    out = {
        "eyes": [[X(e[0], 0), X(e[1], 1), S(e[2]), S(e[3])] for e in L["eyes"]],
        "iris": [[X(e[0], 0), X(e[1], 1), S(e[2])] for e in L["iris"]],
        "eyeZ": X(L["eyeZ"], 2), "browY": X(L["browY"], 1),
        "nose": [X(L["nose"][0], 0), X(L["nose"][1], 1), X(L["nose"][2], 2)],
        "mouth": [X(L["mouth"][0], 0), X(L["mouth"][1], 1), S(L["mouth"][2]), X(L["mouth"][3], 2)],
        "chinY": X(L["chinY"], 1), "colors": L["colors"],
    }
    have[mn["model"]] = json.dumps(out, separators=(",", ":"))
    print(mn["model"], "k", round(k, 3), "eyes", out["eyes"][0][:2], "mouth", out["mouth"][:2])
body = "\n".join(f'  "{h}": {j},' for h, j in have.items())
ff = re.sub(r"export const TOON_FACE_FILE_LANDMARKS[\s\S]*$", "export const TOON_FACE_FILE_LANDMARKS: Record<string, ToonFaceLandmarks> = {\n" + body + "\n};\n", ff)
open(FF, "w").write(ff)
print("wrote", FF)
