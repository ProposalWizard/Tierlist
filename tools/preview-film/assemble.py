"""
tools/preview-film/assemble.py — cut the cleaned shots into the film, with captions, the end card and music.

    python assemble.py <clean root: <shot>/c_0001.png..> <font.ttf> <music.mp3> <out.mp4>

The script of the film is CUT below: shot, how many frames, the words. 24 frames a second, 1080x1920.
"""
import os, sys, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT, FONT, MUSIC, OUT = sys.argv[1:5]
W, H, FPS = 1080, 1920, 24
CUT = [  # shot, frames, line 1, line 2
    ("open",  96,  "YOU ARE SIXTEEN.", "NOBODY KNOWS YOUR NAME."),
    ("trial", 96,  "ONE TRIAL.", "ONE CHANCE."),
    ("sign",  96,  "SIGN YOUR", "FIRST CONTRACT."),
    ("match", 120, "EVERY CHANCE", "IS YOURS TO TAKE."),
    ("train", 96,  "TRAIN. EARN.", "SPEND."),
    ("climb", 96,  "CLIMB EVERY LEAGUE.", "LIVE A WHOLE CAREER."),
    ("gold",  132, "", "WIN THE GOLDEN BALL."),
]
END = 108  # the end card's frames
GOLD = (255, 204, 96)

def font(size, weight=800):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([weight])
    except Exception: pass
    return f

def text_layer(lines, y, sizes, colours, alpha, drift=0):
    """Centred lines with a soft dark glow behind, as an RGBA picture."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); glow = Image.new("L", (W, H), 0)
    d, g = ImageDraw.Draw(im), ImageDraw.Draw(glow)
    yy = y + drift
    for line, size, col in zip(lines, sizes, colours):
        if not line: continue
        f = font(size); w = d.textlength(line, font=f)
        while w > W - 120: size -= 4; f = font(size); w = d.textlength(line, font=f)
        g.text(((W - w) / 2, yy), line, font=f, fill=255, stroke_width=10)
        d.text(((W - w) / 2, yy), line, font=f, fill=(*col, 255))
        yy += int(size * 1.32)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); shadow.putalpha(glow.filter(ImageFilter.GaussianBlur(22)).point(lambda v: int(v * 0.85)))
    out = Image.alpha_composite(shadow, im)
    if alpha < 1: out.putalpha(out.getchannel("A").point(lambda v: int(v * alpha)))
    return out

ease = lambda k: k * k * (3 - 2 * k)
tmp = OUT + ".frames"; os.makedirs(tmp, exist_ok=True)
n = 0; last = None
for si, (shot, frames, l1, l2) in enumerate(CUT):
    for f in range(1, frames + 1):
        n += 1
        im = Image.open(os.path.join(ROOT, shot, f"c_{f:04d}.png")).convert("RGBA"); last = im
        # words: in from frame 10, out before the cut (the last shot keeps its line to the end)
        a_in = ease(min(1, max(0, (f - 10) / 10))); a_out = 1 if si == len(CUT) - 1 else ease(min(1, max(0, (frames - 4 - f) / 8)))
        if shot == "gold": a_in = ease(min(1, max(0, (f - 78) / 16)))
        a = a_in * a_out
        if a > 0:
            cols = ((255, 255, 255), (255, 255, 255)) if shot != "gold" else (GOLD, GOLD)
            im = Image.alpha_composite(im, text_layer([l1, l2], 1470, (66, 66), cols, a, drift=int((1 - a_in) * 18)))
        if si == 0 and f <= 12:  # up from black
            im = Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 255)), im, ease(f / 12))
        im.convert("RGB").save(f"{tmp}/a_{n:05d}.png", compress_level=1)
# the end card: the last picture, blurred and darkened, the name over it
base = last.convert("RGB").filter(ImageFilter.GaussianBlur(28)).point(lambda v: int(v * 0.32)).convert("RGBA")
for f in range(1, END + 1):
    n += 1
    k = ease(min(1, f / 14)); im = Image.blend(last, base, k)
    a1 = ease(min(1, max(0, (f - 8) / 14))); a2 = ease(min(1, max(0, (f - 26) / 14))); a3 = ease(min(1, max(0, (f - 44) / 14)))
    im = Image.alpha_composite(im, text_layer(["KNOWITBALL"], 700, (120,), ((255, 255, 255),), a1))
    im = Image.alpha_composite(im, text_layer(["ROAD TO", "GOLDEN BALL"], 880, (64, 104), (GOLD, GOLD), a2))
    im = Image.alpha_composite(im, text_layer(["FREE TO PLAY"], 1290, (46,), ((255, 255, 255),), a3))
    im = Image.alpha_composite(im, text_layer(["knowitball.co.uk"], 1360, (46,), ((255, 255, 255),), a3))
    if f > END - 12: im = Image.blend(im, Image.new("RGBA", (W, H), (0, 0, 0, 255)), ease((f - (END - 12)) / 12))
    im.convert("RGB").save(f"{tmp}/a_{n:05d}.png", compress_level=1)
dur = n / FPS
subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", f"{tmp}/a_%05d.png", "-i", MUSIC,
    "-filter_complex", f"[0:v]atadenoise=0a=0.02:0b=0.04:1a=0.02:1b=0.04:s=5[v];[1:a]afade=t=in:d=0.4,afade=t=out:st={dur - 2.2:.2f}:d=2.2[a]",
    "-map", "[v]", "-map", "[a]", "-t", f"{dur:.3f}", "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", OUT], check=True)
print("film:", OUT, f"{dur:.1f}s")
