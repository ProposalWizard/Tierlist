"""Contact sheets for the video factory (Mikey, 4 Nov 2026).
  python3 sheet.py stories/<id>.json [--out out/<id>-preview.jpg] [--at 0.8] [--cols 5]
      draws every line's scene WITHOUT making the voice (each line 4 s, captions spread
      evenly), one still per line at `--at` of the line. Quick layout checks.
  python3 sheet.py --video out/<id>.mp4 [--out out/<id>-sheet.jpg]
      one still from the middle of every scene of a finished video (reads work/<id>/timeline.js).
Uses the same engine and badges as make.py."""
import argparse, json, os, re, shutil, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import make  # noqa: E402

def montage(files, out, cols, w=360):
    rows = (len(files) + cols - 1) // cols; h = int(w * 16 / 9)
    from PIL import Image
    sheet = Image.new("RGB", (cols * w, rows * h), (12, 12, 16))
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGB").resize((w, h)); sheet.paste(im, ((i % cols) * w, (i // cols) * h))
    sheet.save(out, quality=88); print("sheet", out, len(files), "tiles")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("story", nargs="?"); ap.add_argument("--video"); ap.add_argument("--out"); ap.add_argument("--at", type=float, default=0.8); ap.add_argument("--cols", type=int, default=5)
    a = ap.parse_args()
    if a.video:
        vid = os.path.basename(a.video)[:-4]; tl = open(os.path.join(HERE, "work", vid, "timeline.js")).read()
        TL = json.loads(re.search(r"window\.TL = (.*);", tl).group(1)); d = os.path.join(HERE, "work", vid, "sheet"); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
        files = []
        for i, s in enumerate(TL["scenes"]):
            tm = s["t0"] + (s["t1"] - s["t0"]) * a.at; f = os.path.join(d, f"s{i:02d}.jpg")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{tm:.2f}", "-i", a.video, "-frames:v", "1", f], check=True); files.append(f)
        f = os.path.join(d, "end.jpg"); subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{TL['total'] - 0.3:.2f}", "-i", a.video, "-frames:v", "1", f], check=True); files.append(f)
        montage(files, a.out or os.path.join(HERE, "out", vid + "-sheet.jpg"), a.cols); return
    story = json.load(open(a.story)); vid = story["id"]; work = os.path.join(HERE, "work", "preview-" + vid); shutil.rmtree(work, ignore_errors=True); os.makedirs(work)
    scenes, chunks, at = [], [], 0.0
    for ln in story["lines"]:
        d = float(ln.get("dur", 4.0)); sc = dict(ln["scene"])
        if sc.get("type") == "gameclip": sc["frames"], sc["fps"], sc["goalAt"] = make.clip_frames(sc)
        scenes.append({"t0": at, "t1": at + d, "scene": sc}); words = ln["text"].split()
        for j in range(0, len(words), 3):
            t0 = at + d * j / len(words); chunks.append({"t0": t0, "t1": at + d * min(len(words), j + 3) / len(words), "words": [{"w": w.upper(), "t0": t0 + 0.2 * q} for q, w in enumerate(words[j:j + 3])]})
        at += d
    clubs = story.get("clubs", {})
    for cid, c in clubs.items():
        f = make.badge_file(c.get("badge") or c.get("name") or cid) if c.get("badge") is not False else None
        if f: c["badgeSrc"] = f; c["badgeDark"] = make.badge_dark(f)
    tl = {"total": at + 2.0, "end": at, "endCard": at, "scenes": scenes, "chunks": chunks, "env": []}
    with open(os.path.join(work, "timeline.js"), "w") as f:
        f.write("window.STORY = " + json.dumps({"series": story.get("series", ""), "clubs": clubs, "people": story.get("people", {})}) + ";\n")
        f.write("window.TL = " + json.dumps(tl) + ";\n")
    eng = os.path.join(HERE, "engine")
    html = open(os.path.join(eng, "edit.html")).read().replace('src="avatars.js"', f'src="{eng}/avatars.js"').replace('src="scenes.js"', f'src="{eng}/scenes.js"').replace('src="charts.js"', f'src="{eng}/charts.js"').replace("url(../assets/", f"url({HERE}/assets/")
    open(os.path.join(work, "edit.html"), "w").write(html)
    frames = [int((s["t0"] + (s["t1"] - s["t0"]) * (0.97 if s["scene"].get("type") == "cta" else a.at)) * 30) for s in scenes]
    r = subprocess.run(["node", os.path.join(HERE, "render.mjs"), work, "--frames", ",".join(map(str, frames))], capture_output=True, text=True)
    print(r.stdout.strip(), r.stderr.strip()[-2000:])
    montage([os.path.join(work, "eframes", f"f{f:05d}.jpg") for f in frames], a.out or os.path.join(HERE, "out", vid + "-preview.jpg"), a.cols)

if __name__ == "__main__": main()
