#!/usr/bin/env python3
"""Join frames from scripts/film/frames3d.mjs into a smooth MP4 (H.264, PyAV, no ffmpeg binary needed)
and make a contact sheet PNG (every Nth frame in a grid with timestamps) for quick reading.

  python3 scripts/film/frames3d_encode.py FRAMES_DIR OUT.mp4 [--fps 30] [--sheet OUT.png] [--every 6]
                                          [--cols 6] [--thumb 240] [--crf 20] [--width 720] [--no-video]

--width  scale the video to this width (default: the frames' own width, so 2x phone frames stay sharp;
         use 720 to match scripts/film/rec.mjs clips). The sheet defaults to OUT with .png instead of .mp4.
"""
import argparse, glob, json, os, sys
import av
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("frames"); ap.add_argument("out")
ap.add_argument("--fps", type=float); ap.add_argument("--sheet"); ap.add_argument("--every", type=int, default=6)
ap.add_argument("--cols", type=int, default=6); ap.add_argument("--thumb", type=int, default=240)
ap.add_argument("--crf", type=int, default=20); ap.add_argument("--width", type=int)
ap.add_argument("--no-video", action="store_true")
a = ap.parse_args()

files = sorted(glob.glob(os.path.join(a.frames, "frame_*.jpg")) + glob.glob(os.path.join(a.frames, "frame_*.png")))
if not files:
    sys.exit(f"no frames in {a.frames}")
meta = {}
mp = os.path.join(a.frames, "frames.json")
if os.path.exists(mp):
    meta = json.load(open(mp))
fps = a.fps or meta.get("fps") or 30
# frames must be a gapless run 0..n-1 (a gap would make the video jump)
nums = [int(os.path.basename(f).split("_")[1].split(".")[0]) for f in files]
missing = sorted(set(range(max(nums) + 1)) - set(nums))
if missing:
    print(f"WARNING: {len(missing)} frame(s) missing, first {missing[:5]}; the video will skip them", file=sys.stderr)

first = Image.open(files[0]).convert("RGB")
w, h = first.size
if a.width:
    h = round(h * a.width / w); w = a.width
w -= w % 2; h -= h % 2

if not a.no_video:
    out = av.open(a.out, "w")
    st = out.add_stream("libx264", rate=round(fps))
    st.width, st.height, st.pix_fmt = w, h, "yuv420p"
    st.options = {"crf": str(a.crf), "preset": "medium", "movflags": "faststart"}
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGB")
        if im.size != (w, h):
            im = im.resize((w, h), Image.LANCZOS)
        fr = av.VideoFrame.from_image(im)
        for p in st.encode(fr):
            out.mux(p)
    for p in st.encode():
        out.mux(p)
    out.close()
    print(f"{a.out}: {len(files)} frames, {len(files)/fps:.2f}s at {round(fps)} fps, {w}x{h}, {os.path.getsize(a.out)/1e6:.1f} MB")

sheet = a.sheet or os.path.splitext(a.out)[0] + ".png"
pick = files[:: max(1, a.every)]
tw = a.thumb; th = round(tw * first.size[1] / first.size[0])
cols = min(a.cols, len(pick)); rows = (len(pick) + cols - 1) // cols
pad = 6
S = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + pad + 14) + pad), (24, 24, 28))
d = ImageDraw.Draw(S)
for k, f in enumerate(pick):
    n = int(os.path.basename(f).split("_")[1].split(".")[0])
    im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
    x = pad + (k % cols) * (tw + pad); y = pad + (k // cols) * (th + pad + 14)
    S.paste(im, (x, y + 14))
    d.text((x, y), f"{n / fps:5.2f}s  #{n}", fill=(255, 220, 90))
S.save(sheet)
print(f"{sheet}: {len(pick)} thumbnails (every {a.every}th frame)")
