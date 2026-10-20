"""Frame folders side by side, labelled, as one phone-size video (B5c arms before/after).

  python3 -I tools/motionref/four_up.py out.mp4 "LABEL=frames_dir" ... [--fps=24] [--crop=w:h:x:y] [--loops=2]
"""
import subprocess
import sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
out, panels = args[0], [a.split("=", 1) for a in args[1:]]
fps, crop, loops = opt.get("fps", "24"), opt.get("crop", "330:760:30:40"), int(opt.get("loops", "2"))
font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
cmd = ["ffmpeg", "-y", "-loglevel", "error"]
for _, d in panels:
    cmd += ["-stream_loop", str(loops - 1), "-framerate", fps, "-i", f"{d}/frame_%05d.jpg"]
fc = []
for i, (label, _) in enumerate(panels):
    col = "0xb00020" if "BEFORE" in label else "0x007a3d"
    fc.append(f"[{i}:v]crop={crop},drawtext=fontfile={font}:text='{label}':x=10:y=10:fontsize=18:fontcolor=white:box=1:boxcolor={col}@0.85:boxborderw=6[p{i}]")
fc.append("".join(f"[p{i}]" for i in range(len(panels))) + f"hstack=inputs={len(panels)}[v]")
cmd += ["-filter_complex", ";".join(fc), "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", out]
subprocess.run(cmd, check=True)
print(out)
