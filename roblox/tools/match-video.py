#!/usr/bin/env python3
"""
Match video: draws a recorded match (roblox/bench/video.dump.ts) through the
Roblox camera, frame by frame, and joins it into an mp4. A stand-in for
filming Studio (Roblox does not run here): the camera, the people's places
and the ball are the game's own; the look (stadium, figures) is not.
  python3 roblox/tools/match-video.py video.json out.mp4
"""
import json, math, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

frames = json.load(open(sys.argv[1]))
out = sys.argv[2]
W, H = 960, 540
VFOV = 50.0
T = math.tan(math.radians(VFOV) / 2)
ASPECT = W / H
try:
    FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    SMALL = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
except OSError:
    FONT = SMALL = ImageFont.load_default()

def norm(v):
    l = math.sqrt(sum(c * c for c in v)) or 1
    return tuple(c / l for c in v)
def sub(a, b): return tuple(x - y for x, y in zip(a, b))
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def hexcol(h): h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def projector(cam):
    pos = (cam["pos"]["x"], cam["pos"]["h"], cam["pos"]["y"])
    target = (cam["target"]["x"], cam["target"]["h"], cam["target"]["y"])
    fw = norm(sub(target, pos)); right = norm(cross(fw, (0, 1, 0))); up = cross(right, fw)
    def p(x, y, z):  # pitch x, pitch y, height
        d = sub((x, z, y), pos)
        depth = dot(d, fw)
        if depth < 0.3: return None
        return ((dot(d, right) / depth / (T * ASPECT) + 1) / 2 * W, (1 - dot(d, up) / depth / T) / 2 * H)
    return p

def line(dr, p, a, b, width=2, steps=16):
    pts = [p(a[0] + (b[0]-a[0])*i/steps, a[1] + (b[1]-a[1])*i/steps, 0) for i in range(steps + 1)]
    for u, v in zip(pts, pts[1:]):
        if u and v: dr.line([u, v], fill=(240, 240, 240), width=width)

CAPTION = {"aim": "Aim: drag back from the ball", "contact": "Strike: tap where on the ball", "runup": "The run-up",
           "flight": "", "result": "", "feed": "Commentary", "tdDribble": "Dribble: W A S D", "pause": ""}

def person(dr, p, b, shirt, shorts, you):
    foot, head = p(b["x"], b["y"], 0), p(b["x"], b["y"], 1.8)
    if not foot or not head: return
    h = foot[1] - head[1]
    if h < 3 or h > H * 3: return
    w = h * 0.26
    hip = foot[1] - h * 0.47
    # shadow, legs (shorts), shirt, head
    dr.ellipse([foot[0] - w * 0.9, foot[1] - w * 0.25, foot[0] + w * 0.9, foot[1] + w * 0.25], fill=(40, 100, 55))
    dr.rectangle([foot[0] - w * 0.4, hip, foot[0] - w * 0.08, foot[1]], fill=(230, 200, 170))
    dr.rectangle([foot[0] + w * 0.08, hip, foot[0] + w * 0.4, foot[1]], fill=(230, 200, 170))
    dr.rectangle([foot[0] - w * 0.5, hip, foot[0] + w * 0.5, hip + h * 0.16], fill=shorts)
    dr.rounded_rectangle([foot[0] - w * 0.55, head[1] + h * 0.2, foot[0] + w * 0.55, hip + 1], radius=max(1, w * 0.2), fill=shirt)
    r = h * 0.11
    dr.ellipse([foot[0] - r, head[1], foot[0] + r, head[1] + 2 * r], fill=(205, 160, 120))
    if you:
        dr.ellipse([foot[0] - w * 1.2, foot[1] - w * 0.35, foot[0] + w * 1.2, foot[1] + w * 0.35], outline=(253, 224, 71), width=3)

def draw(f):
    img = Image.new("RGB", (W, H), (125, 175, 225))
    dr = ImageDraw.Draw(img)
    p = projector(f["cam"])
    # grass in mowing stripes
    for gy in range(-12, 110, 6):
        for gx in range(-12, 80, 6):
            q = [p(gx, gy, 0), p(gx + 6, gy, 0), p(gx + 6, gy + 6, 0), p(gx, gy + 6, 0)]
            if all(q):
                dr.polygon(q, fill=(64, 158, 86) if (gy // 6) % 2 == 0 else (56, 146, 78))
    CX = 34
    for a, b in [((0, 0), (68, 0)), ((0, 0), (0, 105)), ((68, 0), (68, 105)), ((CX-20.16, 0), (CX-20.16, 16.5)), ((CX+20.16, 0), (CX+20.16, 16.5)),
                 ((CX-20.16, 16.5), (CX+20.16, 16.5)), ((CX-9.16, 0), (CX-9.16, 5.5)), ((CX+9.16, 0), (CX+9.16, 5.5)), ((CX-9.16, 5.5), (CX+9.16, 5.5)), ((0, 52.5), (68, 52.5))]:
        line(dr, p, a, b)
    spot = p(CX, 11, 0)
    if spot: dr.ellipse([spot[0] - 2, spot[1] - 2, spot[0] + 2, spot[1] + 2], fill=(240, 240, 240))
    # the goal: net behind, then posts and bar
    g = f["goal"]
    net = [p(g["x1"], -2, 0), p(g["x1"], -2, g["crossbar"] * 0.8), p(g["x2"], -2, g["crossbar"] * 0.8), p(g["x2"], -2, 0)]
    if all(net): dr.polygon(net, fill=(200, 210, 215))
    for gx in (g["x1"], g["x2"]):
        a, b = p(gx, 0, 0), p(gx, 0, g["crossbar"])
        if a and b: dr.line([a, b], fill=(255, 255, 255), width=5)
    a, b = p(g["x1"], 0, g["crossbar"]), p(g["x2"], 0, g["crossbar"])
    if a and b: dr.line([a, b], fill=(255, 255, 255), width=5)
    kits = f["kits"]
    shirts = {"you": kits["us"], "mate": kits["us"], "opp": kits["them"], "keeper": kits["keeper"]}
    items = [(b["y"], "body", b) for b in f["bodies"]]
    if f.get("ball"): items.append((f["ball"]["y"], "ball", f["ball"]))
    for _, kind, b in sorted(items, key=lambda i: -i[0]):  # far first
        if kind == "body":
            k = shirts.get(b["side"], kits["us"])
            person(dr, p, b, hexcol(k["shirt"]), hexcol(k["trim"]), b["side"] == "you")
        else:
            q = p(b["x"], b["y"], 0.11 + (b.get("z") or 0)); s = p(b["x"], b["y"], 0); top = p(b["x"], b["y"], 0.22 + (b.get("z") or 0))
            if q and s and top:
                r = max(3, abs(top[1] - q[1]))
                dr.ellipse([s[0] - r, s[1] - r * 0.35, s[0] + r, s[1] + r * 0.35], fill=(30, 80, 45))
                dr.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=(255, 255, 255), outline=(20, 20, 20))
    # aim arrow
    if f.get("aim") and f.get("ball") and f["phase"] == "aim":
        b, a = f["ball"], f["aim"]
        s = p(b["x"], b["y"], 0); e = p(b["x"] + a["dir"]["x"] * 8 * a["power"], b["y"] + a["dir"]["y"] * 8 * a["power"], 0)
        if s and e: dr.line([s, e], fill=(253, 224, 71), width=5)
    # the bar on top: score and minute
    sc = f["score"]
    home, away = (sc["usName"], sc["themName"]) if sc["home"] else (sc["themName"], sc["usName"])
    hs, as_ = (sc["us"], sc["them"]) if sc["home"] else (sc["them"], sc["us"])
    text = f"{home}  {hs} - {as_}  {away}     {f['minute']}'"
    tw = dr.textlength(text, font=FONT)
    dr.rounded_rectangle([W / 2 - tw / 2 - 16, 10, W / 2 + tw / 2 + 16, 46], radius=10, fill=(11, 18, 32))
    dr.text((W / 2 - tw / 2, 16), text, fill=(255, 255, 255), font=FONT)
    cap = f.get("banner") or CAPTION.get(f["phase"], "")
    if cap:
        cw = dr.textlength(cap, font=FONT)
        dr.rounded_rectangle([W / 2 - cw / 2 - 16, H - 60, W / 2 + cw / 2 + 16, H - 22], radius=10, fill=(11, 18, 32))
        dr.text((W / 2 - cw / 2, H - 54), cap, fill=(253, 224, 71), font=FONT)
    dr.text((12, H - 22), "Drawn from the Roblox game's own match and camera (not filmed in Roblox)", fill=(230, 240, 250), font=SMALL)
    return img

tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    draw(f).save(os.path.join(tmp, f"{i:05d}.png"))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "30", "-i", os.path.join(tmp, "%05d.png"),
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", out], check=True)
print(out, len(frames), "frames")
