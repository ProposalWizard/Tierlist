"""Side-by-side contact sheet of two cuts at the same moments, with a difference score per pair.
  python3 compare.py REFERENCE.mp4 NEW.mp4|FRAMES_DIR out.jpg [--times 1,5.5,...] [--every 2.0]
A frames dir holds f00000.jpg files (build.py --keep-frames or --stills). Score = mean absolute pixel difference (0-255)."""
import argparse, os, subprocess, io
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def grab(src, t, size=(240, 427)):
    if os.path.isdir(src):
        p = os.path.join(src, f"f{int(round(t * 30)):05d}.jpg")
        if not os.path.exists(p): return None
        im = Image.open(p).convert("RGB")
    else:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", src, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
        if not raw: return None
        im = Image.open(io.BytesIO(raw)).convert("RGB")
    return im.resize(size, Image.LANCZOS)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("a"); ap.add_argument("b"); ap.add_argument("out")
    ap.add_argument("--times"); ap.add_argument("--every", type=float, default=2.0); ap.add_argument("--dur", type=float)
    a = ap.parse_args()
    if a.times: ts = [float(x) for x in a.times.split(",")]
    else:
        d = a.dur or float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.a], capture_output=True, text=True).stdout)
        ts = list(np.arange(0.5, d - 0.1, a.every))
    pairs, scores = [], []
    for t in ts:
        x, y = grab(a.a, t), grab(a.b, t)
        if x is None or y is None: continue
        s = float(np.abs(np.asarray(x, float) - np.asarray(y, float)).mean()); pairs.append((t, x, y)); scores.append(s)
    cols = 4; rows = (len(pairs) + cols - 1) // cols; cw, ch = 240 * 2 + 12, 427 + 26
    sheet = Image.new("RGB", (cols * cw + 8, rows * ch + 8), (20, 20, 24)); dr = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype(os.path.join(os.path.dirname(os.path.abspath(__file__)), "template", "anton.ttf"), 18)
    except Exception: font = None
    for i, (t, x, y) in enumerate(pairs):
        ox, oy = 8 + (i % cols) * cw, 8 + (i // cols) * ch
        sheet.paste(x, (ox, oy + 24)); sheet.paste(y, (ox + 244, oy + 24))
        s = scores[i]; col = (120, 220, 120) if s < 6 else (240, 200, 80) if s < 14 else (240, 90, 90)
        dr.text((ox, oy + 2), f"{t:5.2f}s  ref | new   diff {s:.1f}", fill=col, font=font)
    sheet.save(a.out, quality=88)
    print(f"{len(pairs)} pairs, mean diff {np.mean(scores):.2f}, worst {max(scores):.2f} at {pairs[int(np.argmax(scores))][0]:.2f}s -> {a.out}")
    for (t, _, _), s in sorted(zip(pairs, scores), key=lambda z: -z[1])[:6]: print(f"  {t:6.2f}s diff {s:.1f}")

if __name__ == "__main__":
    main()
