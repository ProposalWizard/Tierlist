"""
ANIME GOAL — effects and the video (after render_goal.py).

    python3 tools/anime3d/post.py <out dir>      -> <out dir>/anime-goal.mp4, stills/

White-out shots get a white page with speed lines aimed at the ball. The
strike gets an impact frame (a white flash, then two inverted black-and-white
frames). The scorer's name comes in on the hero shot, a flash on the goal,
and a GOAL card at the end.
"""
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import av

OUT = sys.argv[1]
M = json.load(open(os.path.join(OUT, "frames.json")))
FR = M["frames"]
FONT = "/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf"


def font(size):
    return ImageFont.truetype(FONT, size)


def speed_lines(size, cx, cy, seed, n=90, col=(20, 20, 28)):
    W, H = size
    im = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    R = math.hypot(W, H)
    for _ in range(n):
        a = rnd.uniform(0, 2 * math.pi)
        r0 = rnd.uniform(0.22, 0.5) * H
        w = rnd.uniform(0.004, 0.03)
        x0, y0 = cx + math.cos(a) * r0, cy + math.sin(a) * r0
        p = [(x0, y0), (cx + math.cos(a - w) * R, cy + math.sin(a - w) * R), (cx + math.cos(a + w) * R, cy + math.sin(a + w) * R)]
        d.polygon(p, fill=(*col, rnd.randint(150, 235)))
    return im


def text_card(im, text, size, xy, fill, stroke, angle=-8, sw=8):
    W, H = im.size
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text(xy, text, font=font(size), fill=fill, stroke_width=sw, stroke_fill=stroke, anchor="mm")
    layer = layer.rotate(angle, center=xy, resample=Image.BICUBIC)
    im.alpha_composite(layer)


def grade(im):
    """Glow on the bright parts, a touch more colour, cool shadows."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    hot = (np.clip((lum - 0.86) / 0.14, 0, 1)[..., None] * a * 255).astype(np.uint8)
    glow = np.asarray(Image.fromarray(hot).filter(ImageFilter.GaussianBlur(10)), dtype=np.float32) / 255
    a = 1 - (1 - a) * (1 - 0.3 * glow)
    m = a.mean(axis=2, keepdims=True)
    a = np.clip(m + (a - m) * 1.08, 0, 1)
    a = a + (1 - lum[..., None]) * np.array([-0.012, 0.0, 0.025], dtype=np.float32)
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).convert("RGBA")


def impact(im):
    g = ImageOps.grayscale(im.convert("RGB"))
    a = np.asarray(g, dtype=np.float32)
    bw = np.where(a > 128, 0, 255).astype(np.uint8)  # inverted
    out = Image.fromarray(bw).convert("RGBA")
    return out


frames = []
contact_i = next((f["i"] for f in FR if f["shot"] == "impact" and f["t"] >= M["tc"] - 1e-4), None)
goal_seen = False
hero_n = sum(1 for f in FR if f["shot"] == "hero")
hero_j = 0
card_n = sum(1 for f in FR if f["shot"] == "card")
card_j = 0
for f in FR:
    src = Image.open(os.path.join(OUT, "frames", f"{f['i']:04d}.png")).convert("RGBA")
    W, H = src.size
    bx, by = f["ball"][0] * W, (1 - f["ball"][1]) * H
    if f["whiteout"]:
        bg = Image.new("RGBA", (W, H), (250, 250, 252, 255))
        bg.alpha_composite(speed_lines((W, H), bx, by, seed=f["i"] // 2))
        bg.alpha_composite(src)
        im = bg
    else:
        im = src
    im = grade(im)
    if contact_i is not None:
        if f["i"] == contact_i - 1:
            im = Image.blend(im, Image.new("RGBA", (W, H), (255, 255, 255, 255)), 0.7)
        elif f["i"] in (contact_i, contact_i + 1):
            im = impact(im)
            im.alpha_composite(speed_lines((W, H), bx, by, seed=99 + f["i"], n=60, col=(0, 0, 0)))
    if f["shot"] == "hero":
        k = min(1.0, hero_j / 6)
        x = int(-420 + 420 * (1 - (1 - k) ** 3))
        bar = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(bar)
        d.polygon([(x, H - 150), (x + 470, H - 150), (x + 430, H - 70), (x, H - 70)], fill=(211, 32, 42, 235))
        im.alpha_composite(bar)
        name = (M.get("scorer") or "STRIKER").upper()
        text_card(im, name, 58, (x + 215, H - 112), (255, 255, 255, 255), (15, 15, 20, 255), angle=0, sw=5)
        hero_j += 1
    if f["shot"] == "card":
        k = min(1.0, card_j / 5)
        im = Image.blend(im, Image.new("RGBA", (W, H), (255, 255, 255, 255)), 0.25)
        band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(band).polygon([(0, H * 0.36), (W, H * 0.24), (W, H * 0.62), (0, H * 0.74)], fill=(211, 32, 42, 230))
        im.alpha_composite(band)
        text_card(im, "GOAL!!", int(150 + 60 * (1 - k)), (W // 2, int(H * 0.49)), (255, 255, 255, 255), (12, 12, 18, 255), angle=-7, sw=10)
        if card_j == 0:
            im = Image.blend(im, Image.new("RGBA", (W, H), (255, 255, 255, 255)), 0.6)
        card_j += 1
    frames.append(im.convert("RGB"))

path = os.path.join(OUT, "anime-goal.mp4")
c = av.open(path, "w")
s = c.add_stream("libx264", rate=M["fps"])
s.width, s.height = frames[0].size
s.pix_fmt = "yuv420p"
s.options = {"crf": "19", "preset": "slow"}
for im in frames:
    for p in s.encode(av.VideoFrame.from_image(im)):
        c.mux(p)
for p in s.encode():
    c.mux(p)
c.close()

os.makedirs(os.path.join(OUT, "stills"), exist_ok=True)
for name in ("wide", "hero", "impact", "follow", "net", "top", "card"):
    idx = [n for n, f in enumerate(FR) if f["shot"] == name]
    if idx:
        pick = idx[len(idx) * 2 // 3] if name != "impact" else (contact_i if contact_i is not None else idx[0])
        frames[pick].save(os.path.join(OUT, "stills", f"{name}.jpg"), quality=88)
print("video", path, len(frames), "frames", round(len(frames) / M["fps"], 2), "s", os.path.getsize(path) // 1024, "KB")
