#!/usr/bin/env python3
"""Trim a raw Playwright recording into a phone-sized H.264 clip + one still.

    python3 scripts/film/scenes/cut.py <in.webm> <out.mp4> <start_s> <end_s> [--speed 2] [--still <s>] [--crf 30]

390 px wide, 30 fps, no sound, faststart (plays on a phone over WhatsApp). The still is
written next to the clip as <out>.jpg, at --still seconds into the RAW recording
(default: the middle of the cut).
"""
import subprocess, sys, os, shutil

a = sys.argv[1:]
src, out, s0, s1 = a[0], a[1], float(a[2]), float(a[3])
opt = lambda f, d: a[a.index(f) + 1] if f in a else d
speed = float(opt("--speed", "1"))
still = float(opt("--still", str((s0 + s1) / 2)))
crf = opt("--crf", "30")
ff = shutil.which("ffmpeg")
if not ff:
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
vf = f"setpts=PTS/{speed},scale=390:-2,fps=30" if speed != 1 else "scale=390:-2,fps=30"
subprocess.run([ff, "-loglevel", "error", "-y", "-ss", f"{s0:.2f}", "-to", f"{s1:.2f}", "-i", src,
                "-vf", vf, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", out], check=True)
subprocess.run([ff, "-loglevel", "error", "-y", "-ss", f"{still:.2f}", "-i", src, "-frames:v", "1", "-q:v", "4",
                os.path.splitext(out)[0] + ".jpg"], check=True)
print(out, f"{os.path.getsize(out) / 1e6:.2f} MB", f"{(s1 - s0) / speed:.1f} s")
