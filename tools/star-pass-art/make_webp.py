"""Frames -> one (animated) WebP for the Star Pass.

  python tools/star-pass-art/make_webp.py <frames_dir> <prefix> <out.webp> <fps> [hold_last_ms] [width]

Crops every frame to the same box: the union of what is drawn in any frame,
kept symmetric about the podium's centre so the podium sits in the middle of
the picture. Identical neighbouring frames are merged into one longer frame.
Prints the podium's width as a share of the picture's (the screen sizes the
picture so its podium matches the plain podiums beside it).
"""
import glob, os, sys
from PIL import Image, ImageChops

src, prefix, out, fps = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
hold = int(sys.argv[5]) if len(sys.argv) > 5 else 0
width = int(sys.argv[6]) if len(sys.argv) > 6 else 0
files = sorted(glob.glob(os.path.join(src, f"{prefix}-*.png")))
frames = [Image.open(f).convert("RGBA") for f in files]
W, H = frames[0].size

box = None
for im in frames:
    b = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if b:
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
cx = W / 2
half = max(cx - box[0], box[2] - cx) + 6

# The podium's width: the widest drawn row in the bottom fifth of frame 0.
a0 = frames[0].getchannel("A").point(lambda a: 255 if a > 8 else 0)
lo = int(box[1] + (box[3] - box[1]) * 0.8)
pb = a0.crop((0, lo, W, box[3])).getbbox()
plinth_w = pb[2] - pb[0]
# MAX_OVER: how far past the podium's own edges the picture may reach (a ball
# flying off is let go at that edge rather than widening the whole picture).
if os.environ.get("MAX_OVER"):
    half = min(half, plinth_w / 2 * float(os.environ["MAX_OVER"]))
crop = (int(cx - half), max(0, box[1] - 6), int(cx + half), min(H, box[3] + 6))

frames = [im.crop(crop) for im in frames]
if width:
    h = round(frames[0].height * width / frames[0].width)
    frames = [im.resize((width, h), Image.LANCZOS) for im in frames]

step = round(1000 / fps)
merged, durs = [], []
for im in frames:
    if merged and ImageChops.difference(im, merged[-1]).getbbox() is None:
        durs[-1] += step
    else:
        merged.append(im); durs.append(step)
if hold:
    durs[-1] += hold
kw = dict(format="WEBP", quality=int(os.environ.get("Q", 80)), method=4)
if len(merged) > 1:
    merged[0].save(out, save_all=True, append_images=merged[1:], duration=durs, loop=0, **kw)
else:
    merged[0].save(out, **kw)
print(f"{out}: {len(merged)} frames, {merged[0].size}, {os.path.getsize(out)//1024} KB, "
      f"loop {sum(durs)/1000:.2f}s, podium/picture width = {plinth_w / (crop[2]-crop[0]):.3f}")
