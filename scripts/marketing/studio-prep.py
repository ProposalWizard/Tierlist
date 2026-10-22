#!/usr/bin/env python3
"""
studio-prep.py — the helper files the Studio's editing suite reads beside a video (ported 22 Oct 2026 from the other
app's timeline / lanes / auto-QC scripts; only the general checks came across).

For one video it writes, into --out (a folder; never this repo):
  <name>.peaks.json   the sound wave (20 values a second, 0..100) + the filmstrip's sizes   (lib/studio/timeline.ts)
  <name>.strip.jpg    the filmstrip: one 54x96 frame every 0.5 s (1 s past 45 s), side by side
  <name>.lanes.json   Video (shots found by scene detection) + Audio (full mix)              (lib/studio/elements.ts)
  <name>.qc.json      the auto-QC lane: short shots, loudness, long gaps in the sound        (lib/studio/qc.ts)
where <name> is the video's storage key with every character outside A-Z a-z 0-9 . _ - turned into _ (the same name
the development storage uses, so a local run shows up at once with MARKETING_DEV_NOTES_DIR=--out).

  python3 scripts/marketing/studio-prep.py <video file> --key <storage key> --out <folder>

Then put them beside the video in R2:  npx tsx scripts/marketing/suite-notes.mts put-side <key> <folder>
Needs ffmpeg and ffprobe. Nothing here talks to the network.
"""
import argparse, array, json, math, re, subprocess, sys
from pathlib import Path

STRIP_W, STRIP_H, PEAK_RATE = 54, 96, 20
SCENE_THRESHOLD, MIN_SHOT = 10.0, 0.4
SHORT_SHOT = 1.0
LUFS, LUFS_TOL = -14.0, 1.5
GAP_MIN, GAP_MAX = 0.6, 2.5


def run(cmd, **k):
    return subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL, **k)


def duration(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))


def r3(x):
    return round(x, 3)


def strip_every(dur):
    return 0.5 if dur <= 45 else 1.0 if dur <= 120 else round(dur / 120, 2)


def timeline(src, dur, out, name):
    every = strip_every(dur)
    frames = max(1, math.ceil(dur / every - 1e-6))
    run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-an",
         "-vf", f"fps=1/{every},scale={STRIP_W}:{STRIP_H}:force_original_aspect_ratio=decrease,"
                f"pad={STRIP_W}:{STRIP_H}:(ow-iw)/2:(oh-ih)/2,tile={frames}x1",
         "-frames:v", "1", "-q:v", "6", str(out / f"{name}.strip.jpg")])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True).stdout
    a = array.array("h")
    a.frombytes(raw[: len(raw) // 2 * 2])
    if sys.byteorder == "big":
        a.byteswap()
    step = 8000 // PEAK_RATE
    buckets = [max((abs(x) for x in a[i:i + step]), default=0) for i in range(0, len(a), step)] or [0]
    top = sorted(buckets)[int(len(buckets) * 0.99) - 1 if len(buckets) > 1 else 0] or 1
    peaks = [min(100, round(100 * b / top)) for b in buckets]
    data = {"v": 1, "duration": r3(dur), "strip": {"every": every, "frames": frames, "w": STRIP_W, "h": STRIP_H}, "rate": PEAK_RATE, "peaks": peaks}
    (out / f"{name}.peaks.json").write_text(json.dumps(data, separators=(",", ":")) + "\n")
    return data


def scene_cuts(src):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(src), "-an", "-vf",
                        f"scale=180:-2,scdet=threshold={SCENE_THRESHOLD}:sc_pass=1,metadata=print:file=-", "-f", "null", "-"],
                       capture_output=True, text=True)
    return sorted({round(float(m), 3) for m in re.findall(r"lavfi\.scd\.time=([\d.]+)", r.stdout + r.stderr)})


def shots_from_cuts(cuts, total):
    edges = [0.0] + [c for c in cuts if 0 < c < total] + [total]
    out = []
    for a, b in zip(edges, edges[1:]):
        if out and b - a < MIN_SHOT:
            out[-1] = (out[-1][0], b)
        else:
            out.append((a, b))
    return [(r3(a), r3(b)) for a, b in out]


def loudness(src):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], capture_output=True, text=True)
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(i[-1]) if i else None


def gaps(src, total):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af", f"silencedetect=noise=-38dB:d={GAP_MIN}", "-f", "null", "-"], capture_output=True, text=True)
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", r.stderr)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    out = []
    for s, e in zip(starts, ends):
        if s > 0.3 and e < total - 0.3 and GAP_MIN <= e - s <= GAP_MAX:
            out.append((r3(s), r3(e)))
    return out


def qc(src, total, shots):
    flags = []

    def flag(check, n, start, end, title, reason, proposal, confidence, edit):
        flags.append({"id": f"{check}-{n}", "check": check, "start": r3(start), "end": r3(max(end, start + 0.1)), "title": title,
                      "reason": reason, "proposal": proposal, "confidence": confidence, "edit": edit})

    for i, (a, b) in enumerate(shots):
        if b - a < SHORT_SHOT and 0 < i < len(shots) - 1:
            nxt = shots[i + 1]
            flag("short", int(a * 10), a, b, f"Shot {i + 1} is {b - a:.2f} s",
                 f"Shot {i + 1} is on screen for {b - a:.2f} s, under the 1 s a viewer needs to read it.",
                 "Hold it to 1.0 s by trimming the start of the next shot.", "possible" if b - a > 0.6 else "likely",
                 {"type": "at", "start": r3(a), "end": r3(min(total, nxt[1])), "text": f"Hold shot {i + 1} to 1.0 s (trim the start of shot {i + 2})."})
    lufs = loudness(src)
    if lufs is not None and abs(lufs - LUFS) > LUFS_TOL:
        g = round(LUFS - lufs, 1)
        flag("loudness", 0, 0, total, f"{'Quiet' if g > 0 else 'Loud'}: {lufs:.1f} LUFS",
             f"The whole video measures {lufs:.1f} LUFS; short-video apps play around -14.",
             f"{'Raise' if g > 0 else 'Lower'} the whole mix by {abs(g)} dB.", "likely",
             {"type": "general", "text": f"Whole mix: {'+' if g > 0 else ''}{g} dB to reach -14 LUFS.",
              "element": {"target": "audio", "lane": "audio", "label": "Audio", "op": "volume", "db": max(-60, min(6, g))}})
    for s, e in gaps(src, total):
        flag("silence", int(s * 10), s, e, f"{e - s:.1f} s of quiet",
             f"Nothing is heard from {s:.1f} s to {e:.1f} s.", "Close the gap, or put sound under it.",
             "possible" if e - s < 0.9 else "likely",
             {"type": "cut", "start": r3(s + 0.1), "end": r3(e - 0.1), "text": "Close this quiet gap."})
    checks = [
        {"id": "short", "label": "Short shot", "ran": True, "flags": sum(1 for f in flags if f["check"] == "short"), "how": "Shots from scene detection (ffmpeg scdet); a shot under 1 s between two others is flagged.", "rule": "scripts/marketing/studio-prep.py"},
        {"id": "loudness", "label": "Loudness", "ran": lufs is not None, "flags": sum(1 for f in flags if f["check"] == "loudness"), "how": "Integrated loudness (ffmpeg ebur128) more than 1.5 LU from -14 LUFS.", "rule": "scripts/marketing/studio-prep.py"},
        {"id": "silence", "label": "Gap in the voice", "ran": True, "flags": sum(1 for f in flags if f["check"] == "silence"), "how": "ffmpeg silencedetect under -38 dB for 0.6 to 2.5 s (not at the very start or end).", "rule": "scripts/marketing/studio-prep.py"},
    ]
    return {"v": 1, "kind": "flat", "checks": checks, "flags": flags, "taste": []}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--key", required=True, help="the video's storage key (videos/<card>/<file> or local/<folder>/<file>)")
    ap.add_argument("--out", required=True, help="folder to write into (never this repo)")
    a = ap.parse_args()
    src, out = Path(a.video), Path(a.out).resolve()
    repo = Path(__file__).resolve().parent.parent.parent
    if out == repo or repo in out.parents:
        sys.exit("studio-prep: --out must be outside the repo (video files never go in the code).")
    out.mkdir(parents=True, exist_ok=True)
    name = re.sub(r"[^A-Za-z0-9._-]", "_", a.key)
    total = duration(src)
    timeline(src, total, out, name)
    shots = shots_from_cuts(scene_cuts(src), total)
    lanes = {"v": 1, "kind": "flat", "duration": r3(total), "source": f"scene detection (ffmpeg scdet, threshold {SCENE_THRESHOLD:g})", "lanes": [
        {"id": "video", "kind": "video", "label": "Video", "clips": [{"id": f"s{i + 1}", "start": x, "end": y, "label": f"Shot {i + 1}"} for i, (x, y) in enumerate(shots)]},
        {"id": "audio", "kind": "audio", "label": "Audio (full mix)", "clips": [{"id": "mix", "start": 0.0, "end": r3(total), "label": "Full mix"}]},
    ]}
    (out / f"{name}.lanes.json").write_text(json.dumps(lanes, indent=1) + "\n")
    q = qc(src, total, shots)
    (out / f"{name}.qc.json").write_text(json.dumps(q, indent=1) + "\n")
    print(f"studio-prep: {total:.1f} s, {len(shots)} shots, {len(q['flags'])} QC flags -> {out}/{name}.*")


if __name__ == "__main__":
    main()
