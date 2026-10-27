#!/usr/bin/env python3
"""
Camera preview: draws match frames (roblox/bench/frames.dump.ts) the way the
Roblox match camera frames them (the same maths as roblox/src/Client/Match.luau
chanceCamera / dribbleCamera), as a contact sheet. A stand-in for Studio:
it shows where the camera looks and what is in shot, not the 3D look.
  python3 roblox/tools/camera-preview.py frames.json out.png [landscape|portrait]
"""
import json, math, sys
from PIL import Image, ImageDraw

frames = json.load(open(sys.argv[1]))
out = sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else "landscape"
W, H = (480, 270) if mode == "landscape" else (230, 500)
VFOV = 50.0

def norm(v):
    l = math.sqrt(sum(c * c for c in v)) or 1
    return tuple(c / l for c in v)
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def dot(a, b): return sum(x * y for x, y in zip(a, b))

def chance_camera(f, aspect):
    cam = f["camera"]; facing = cam.get("facing", "up")
    cx, cy = (cam["x1"] + cam["x2"]) / 2, (cam["y1"] + cam["y2"]) / 2
    across = (cam["x2"] - cam["x1"]) if facing == "up" else (cam["y2"] - cam["y1"])
    down = (cam["y2"] - cam["y1"]) if facing == "up" else (cam["x2"] - cam["x1"])
    look = (0, 0, -1) if facing == "up" else (-1, 0, 0) if facing == "right" else (1, 0, 0)
    elev = math.radians(52)
    hfov = 2 * math.atan(math.tan(math.radians(VFOV) / 2) * aspect)
    dist = max((across * 0.5) / math.tan(hfov / 2), (down * 0.5 * math.sin(elev)) / math.tan(math.radians(VFOV) / 2))
    dist = max(dist * 1.08, 9)
    target = (cx, 0, cy)
    pos = (target[0] - look[0] * dist * math.cos(elev), dist * math.sin(elev), target[2] - look[2] * dist * math.cos(elev))
    return pos, target

def chase_camera(you):
    return (you["x"], 7.5, you["y"] + 9), (you["x"], 0, you["y"] - 9)

def projector(pos, target, aspect):
    fw = norm(sub(target, pos)); right = norm(cross(fw, (0, 1, 0))); up = cross(right, fw)
    t = math.tan(math.radians(VFOV) / 2)
    def p(x, y, z):  # pitch x, pitch y, height
        d = sub((x, z, y), pos)
        depth = dot(d, fw)
        if depth < 0.3: return None
        sx = dot(d, right) / depth / (t * aspect); sy = dot(d, up) / depth / t
        return ((sx + 1) / 2 * W, (1 - sy) / 2 * H)
    return p

def line(dr, p, a, b, fill, width=1, steps=12):
    pts = [p(a[0] + (b[0]-a[0])*i/steps, a[1] + (b[1]-a[1])*i/steps, 0) for i in range(steps + 1)]
    for u, v in zip(pts, pts[1:]):
        if u and v: dr.line([u, v], fill=fill, width=width)

def draw(f):
    img = Image.new("RGB", (W, H), (120, 170, 220))
    dr = ImageDraw.Draw(img)
    aspect = W / H
    cam = f.get("camLand" if mode == "landscape" else "camPort")
    if cam:  # roblox/game/camera3d.ts, worked out by the dump
        pos = (cam["pos"]["x"], cam["pos"]["h"], cam["pos"]["y"])
        target = (cam["target"]["x"], cam["target"]["h"], cam["target"]["y"])
    elif f.get("cameraMode") == "chase":
        pos, target = chase_camera(f["bodies"][0])
    else:
        pos, target = chance_camera(f, aspect)
    p = projector(pos, target, aspect)
    # grass (a grid of tiles)
    for gx in range(-8, 76, 4):
        for gy in range(-8, 105, 4):
            q = [p(gx, gy, 0), p(gx + 4, gy, 0), p(gx + 4, gy + 4, 0), p(gx, gy + 4, 0)]
            if all(q):
                col = (63, 155, 85) if (gy // 4) % 2 == 0 else (55, 144, 77)
                dr.polygon(q, fill=col)
    white = (240, 240, 240)
    CX = 34
    for a, b in [((0, 0), (68, 0)), ((0, 0), (0, 105)), ((68, 0), (68, 105)), ((CX-20.16, 0), (CX-20.16, 16.5)), ((CX+20.16, 0), (CX+20.16, 16.5)),
                 ((CX-20.16, 16.5), (CX+20.16, 16.5)), ((CX-9.16, 0), (CX-9.16, 5.5)), ((CX+9.16, 0), (CX+9.16, 5.5)), ((CX-9.16, 5.5), (CX+9.16, 5.5)), ((0, 52.5), (68, 52.5))]:
        line(dr, p, a, b, white)
    # goal
    for gx in (30.34, 37.66):
        a, b = p(gx, 0, 0), p(gx, 0, 2.44)
        if a and b: dr.line([a, b], fill=white, width=3)
    a, b = p(30.34, 0, 2.44), p(37.66, 0, 2.44)
    if a and b: dr.line([a, b], fill=white, width=3)
    kits = f["kits"]
    col = {"you": kits["us"]["shirt"], "mate": kits["us"]["shirt"], "opp": kits["them"]["shirt"], "keeper": kits["keeper"]["shirt"]}
    bodies = sorted(f["bodies"], key=lambda b: -b["y"])
    for b in bodies:
        foot, head = p(b["x"], b["y"], 0), p(b["x"], b["y"], 1.8)
        if not foot or not head: continue
        c = col[b["side"]]
        h = abs(foot[1] - head[1]); w = max(2, h * 0.28)
        dr.rectangle([foot[0] - w / 2, head[1], foot[0] + w / 2, foot[1]], fill=c, outline=(0, 0, 0))
        if b["side"] == "you":
            dr.ellipse([foot[0] - w, foot[1] - w * 0.3, foot[0] + w, foot[1] + w * 0.3], outline=(253, 224, 71), width=2)
    bl = f.get("ball")
    if bl:
        q = p(bl["x"], bl["y"], 0.17 + (bl.get("z") or 0)); s = p(bl["x"], bl["y"], 0)
        if q and s:
            r = max(2, abs(p(bl["x"], bl["y"], 0.34)[1] - s[1]) if p(bl["x"], bl["y"], 0.34) else 3)
            dr.ellipse([s[0] - r, s[1] - r * 0.4, s[0] + r, s[1] + r * 0.4], fill=(0, 0, 0))
            dr.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=(255, 255, 255), outline=(0, 0, 0))
    dr.rectangle([0, 0, W, 14], fill=(11, 18, 32))
    kind = f.get("phase", "") + " · " + str(f["camera"].get("facing")) + " · " + f.get("cameraMode", "")
    dr.text((4, 2), kind, fill=(253, 224, 71))
    return img

imgs = [draw(f) for f in frames]
cols = 4 if mode == "landscape" else 6
rows = (len(imgs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (W + 6), rows * (H + 6)), (0, 0, 0))
for i, im in enumerate(imgs):
    sheet.paste(im, ((i % cols) * (W + 6), (i // cols) * (H + 6)))
sheet.save(out)
print(out, sheet.size)
