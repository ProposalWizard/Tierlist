#!/usr/bin/env python3
"""Trim a raw Playwright recording into a phone-sized H.264 clip + one still.

    python3 scripts/film/scenes/cut.py <in.webm> <out.mp4> <start_s> <end_s>
        [--speed 2] [--still <s>] [--crf 30] [--audio <tap.webm> --audio-at <s>] [--crop w:h:x:y]

390 px wide, 30 fps, faststart (plays on a phone over WhatsApp). With --audio (the
recording from audio-tap.mjs) and --audio-at (seconds into the RAW recording when the
tap started), the game's sound goes under the clip as AAC 128k, lined up with the
picture. The still is written next to the clip as <out>.jpg, at --still seconds into
the RAW recording (default: the middle of the cut).
"""
import subprocess, sys, os, shutil

a = sys.argv[1:]
src, out, s0, s1 = a[0], a[1], float(a[2]), float(a[3])
opt = lambda f, d: a[a.index(f) + 1] if f in a else d
speed = float(opt("--speed", "1"))
still = float(opt("--still", str((s0 + s1) / 2)))
crf = opt("--crf", "30")
audio = opt("--audio", None)
# Playwright's screen recording shows each frame about 0.2 s after it was drawn (measured on a
# goal: the net sound 0.2 s before the GOAL frame), so the sound is laid 0.2 s later to match.
VIDEO_LAG_S = float(opt("--video-lag", "0.2"))
audio_at = float(opt("--audio-at", "0")) + VIDEO_LAG_S
crop = opt("--crop", None)
ff = shutil.which("ffmpeg")
if not ff:
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
chain = ([f"crop={crop}"] if crop else []) + ([f"setpts=PTS/{speed}"] if speed != 1 else []) + ["scale=390:-2", "fps=30"]
cmd = [ff, "-loglevel", "error", "-y", "-ss", f"{s0:.3f}", "-to", f"{s1:.3f}", "-i", src]
if audio:
    # the sound started audio_at s into the raw recording: the cut's start is (s0 - audio_at) s into the sound
    off = s0 - audio_at
    if off >= 0:
        cmd += ["-ss", f"{off:.3f}", "-t", f"{s1 - s0:.3f}", "-i", audio]
        af = []
    else:
        cmd += ["-t", f"{s1 - s0 + off:.3f}", "-i", audio]
        af = [f"adelay={int(-off * 1000)}|{int(-off * 1000)}"]
    if speed != 1:
        af.append(f"atempo={speed}")
    # pad the sound to the clip's length (never an open-ended pad: that filled the disk)
    dur = (s1 - s0) / speed
    af.append(f"apad=whole_dur={dur:.3f}")
    cmd += ["-filter_complex", f"[0:v]{','.join(chain)}[v];[1:a]{','.join(af)}[a]", "-map", "[v]", "-map", "[a]",
            "-c:a", "aac", "-b:a", "128k", "-t", f"{dur:.3f}"]
else:
    cmd += ["-vf", ",".join(chain), "-an"]
cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", crf, "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
subprocess.run(cmd, check=True)
vf_still = ",".join(([f"crop={crop}"] if crop else []) + (["scale=390:-2"] if crop else []))
subprocess.run([ff, "-loglevel", "error", "-y", "-ss", f"{still:.2f}", "-i", src, "-frames:v", "1", "-q:v", "4"]
               + (["-vf", vf_still] if vf_still else []) + [os.path.splitext(out)[0] + ".jpg"], check=True)
print(out, f"{os.path.getsize(out) / 1e6:.2f} MB", f"{(s1 - s0) / speed:.1f} s", "with sound" if audio else "silent")
