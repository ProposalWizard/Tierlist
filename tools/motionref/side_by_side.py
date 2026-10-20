"""Before | after | the real-people reference, side by side, at phone size.

  python3 tools/motionref/side_by_side.py <before frames dir> <after frames dir> <reference.mp4> <out.mp4>
        [--fps=24] [--ref-from=0] [--title="Trophy lift"]

Before and after are frame folders from scripts/film/frames3d.mjs (same scene,
same cameras, ?fluid=old and new). The reference plays from --ref-from
seconds at real speed and holds its last frame. Each panel 300 px wide.
"""
import os
import subprocess
import sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
before, after, ref, out = args
fps = float(opt.get("fps", 24))
title = opt.get("title", "")
font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
n = len([f for f in os.listdir(after) if f.startswith("frame_")])
dur = n / fps


def label(t):
    return f"drawtext=fontfile={font}:text='{t}':x=10:y=10:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6"


fc = (
    f"[0:v]scale=300:-2,{label('BEFORE')}[a];"
    f"[1:v]scale=300:-2,{label('AFTER')}[b];"
    f"[2:v]trim=start={opt.get('ref-from', 0)},setpts=PTS-STARTPTS,fps={fps},scale=300:-2,tpad=stop_mode=clone:stop_duration={dur},"
    f"trim=duration={dur},{label('REAL PEOPLE (Higgsfield)')}[c];"
    f"[a][b][c]hstack=inputs=3,pad=iw:ih+40:0:40:black,drawtext=fontfile={font}:text='{title}':x=10:y=10:fontsize=20:fontcolor=white[v]"
)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(fps), "-i", os.path.join(before, "frame_%05d.jpg"),
                "-framerate", str(fps), "-i", os.path.join(after, "frame_%05d.jpg"), "-i", ref,
                "-filter_complex", fc, "-map", "[v]", "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", out], check=True)
print("ok", out, round(dur, 1), "s")
