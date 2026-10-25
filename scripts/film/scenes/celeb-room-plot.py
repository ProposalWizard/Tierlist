"""Top-down sheet of one celebration: as recorded (top) and with room (bottom). chat 1, 25 Oct 2026.
   python3 scripts/film/scenes/celeb-room-plot.py <export.json> <out.jpg>"""
import json, sys, math
from PIL import Image, ImageDraw
j = json.load(open(sys.argv[1]))
W, H, PX = 230, 230, 14.0   # 230 px boxes, 14 px a metre: 16 m around you
img = Image.new("RGB", (W * 8, H * 2 + 40), (20, 90, 40)); d = ImageDraw.Draw(img)
for row, key in enumerate(["raw", "room"]):
    for k, f in enumerate(j["frames"]):
        ox, oy = k * W, 40 + row * H
        cx, cy = f["you"]["x"], f["you"]["y"]
        P = lambda p: (ox + W / 2 + (p["x"] - cx) * PX, oy + H / 2 + (p["y"] - cy) * PX)
        d.rectangle([ox, oy, ox + W - 1, oy + H - 1], outline=(10, 50, 20))
        a, b = P(j["from"]), P(j["end"])
        def clipline(a, b):  # the part of your run inside this box
            pts = [(a[0] + (b[0] - a[0]) * u / 200, a[1] + (b[1] - a[1]) * u / 200) for u in range(201)]
            return [q for q in pts if ox < q[0] < ox + W and oy < q[1] < oy + H]
        seg = clipline(a, b)
        if len(seg) > 1: d.line(seg, fill=(120, 170, 120), width=1)        # your run
        gl = P({"x": 0, "y": 0})
        if oy < gl[1] < oy + H: d.line([ox, gl[1], ox + W, gl[1]], fill=(255, 255, 255), width=1)  # goal line
        x, y = P(f["you"]); r0 = 1.6 * PX
        d.ellipse([x - r0, y - r0, x + r0, y + r0], outline=(255, 230, 120))      # 1.6 m around you
        for m in f["men"]:
            q = P(m[key])
            if not (ox + 4 < q[0] < ox + W - 4 and oy + 4 < q[1] < oy + H - 4): continue   # off this box: not drawn into the next one
            col = (255, 210, 0) if m["id"] == "keeper" else (60, 120, 255) if m["side"] == "them" else (255, 255, 255)
            dist = math.hypot(m[key]["x"] - f["you"]["x"], m[key]["y"] - f["you"]["y"])
            rr = 6
            d.ellipse([q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr], fill=col, outline=(255, 0, 0) if dist < 0.8 else (0, 0, 0), width=3 if dist < 0.8 else 1)
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(255, 80, 80), outline=(0, 0, 0))
        d.text((ox + 6, oy + 6), f"+{f['dt']:.1f} s", fill=(255, 255, 255))
    d.text((6, 40 + row * H + H - 16), "AS RECORDED (old)" if key == "raw" else "WITH ROOM (new)", fill=(255, 255, 0))
d.text((6, 8), f"{j['move']} goal {j['id']}: you = red dot, ring = 1.6 m, blue = them, white = your team, red edge = touching you (<0.8 m)", fill=(255, 255, 255))
img.save(sys.argv[2], quality=85)
