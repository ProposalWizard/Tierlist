#!/usr/bin/env python3
"""
SCREEN RECORDING BREAKDOWN

Turns a screen recording (mp4, mov, mkv, webm) into things Claude can read:

  .recordings/<name>/
    index.md          the whole recording on one page: every stretch of the
                      video, what was said during it, and which sheet shows it
    transcript.txt    everything said, one line per sentence, [mm:ss] stamped
    transcript.json   the same, with exact start/end seconds
    frames/           one picture every time the screen really changes
                      (and at least every --max-gap seconds), named by time
    sheets/           those pictures twelve to a page, each stamped mm:ss
    clips/<from>/     --clip: every frame of a short stretch, for a moment
                      that happens too fast for the sheets (a flicker, a
                      menu that opens and closes, an animation)

    python3 scripts/screen-video/breakdown.py .recordings/<name>/video.mp4
    python3 scripts/screen-video/breakdown.py <video> --clip 12:31-12:34 --clip-fps 20
    python3 scripts/screen-video/breakdown.py <video> --no-audio --crop 0,0,960,1080
    python3 scripts/screen-video/breakdown.py <ad.mp4> --mode ad
    python3 scripts/screen-video/breakdown.py <ai-ad.mp4> --mode ad --stills

TWO MODES:
  screen (default)  someone talking over their own screen: a website, a task,
                    a Loom. The screen changes slowly, so look every 0.5 s.
  ad                somebody else's short-form ad. Cuts can be shorter than a
                    second (one reference ad hid its two key shots in
                    sub-second cuts), so look every 0.1 s, keep smaller changes,
                    and never go more than 2 s without a picture.
Every run also writes report.html + report-files/: the whole video on one page,
each stretch's pictures beside what was said, ready to publish as an artifact.

--stills (opt-in, mainly for AI videos you re-create in an image tool): also
save every kept picture on its own, about 720 px on the long side, into
report-files/stills/still_0001_t00-07.3.jpg (number, then mm-ss.tenths). The
report then gets a Frames grid where any picture opens big with Copy image and
Save. frames.json maps each still back to its exact second.

The voice matters as much as the picture: people talk while they record, and
what they say at 12:31 is about what is on screen at 12:31. index.md puts the
two side by side so a comment can be checked against the frame it was about,
instead of being paraphrased from memory.

Setup (once per machine or container): bash scripts/screen-video/setup.sh
"""
import argparse
import json
import os
import re
import shutil
import sys
import time

try:
    import av
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Missing libraries. Run: bash scripts/screen-video/setup.sh")


def ts(sec: float) -> str:
    sec = max(0, sec)
    h, rem = divmod(int(sec), 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def parse_ts(s: str) -> float:
    parts = [float(p) for p in s.split(":")]
    out = 0.0
    for p in parts:
        out = out * 60 + p
    return out


def font(size: int):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/System/Library/Fonts/Supplemental/Arial Bold.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def fit(img: Image.Image, width: int) -> Image.Image:
    if img.width <= width:
        return img
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


# Per-mode defaults; any flag given on the command line wins.
MODES = {
    "screen": {"every": 0.5, "threshold": 10.0, "max_gap": 8.0, "width": 720},
    "ad": {"every": 0.1, "threshold": 14.0, "max_gap": 2.0, "width": 540},
}


# ── Pictures ────────────────────────────────────────────────────────────────

STILL_LONG_SIDE = 720   # a reference image an AI image tool reads well, small to publish
STILL_QUALITY = 82


def still_name(i: int, t: float) -> str:
    """still_0008_t00-07.3.jpg: the order, then the time to a tenth (mm-ss.t)."""
    t = round(t, 1)
    m, s = divmod(t, 60)
    return f"still_{i:04d}_t{int(m):02d}-{int(s):02d}.{int(round(t * 10)) % 10}.jpg"


def save_still(img: Image.Image, path: str):
    """The full-size picture (not the smaller saved frame), longest side 720 px."""
    scale = STILL_LONG_SIDE / max(img.size)
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    img.convert("RGB").save(path, quality=STILL_QUALITY)
    return img.size


def video_rotation(path) -> int:
    """Degrees (counterclockwise, as ffprobe reports) a phone's portrait video must be
    turned to look upright. PyAV hands over the stored pixels and ignores the flag, so a
    portrait phone recording came out on its side (found 2026-10-06 on a 4K iPhone clip)."""
    import subprocess
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
             "stream_side_data=rotation:stream_tags=rotate", "-of", "default=nw=1:nk=1", path],
            capture_output=True, text=True, timeout=30).stdout.split()
        return int(round(float(out[0]))) % 360 if out else 0
    except Exception:
        return 0


def extract_frames(path, out_dir, every, threshold, max_gap, crop, width, start, end, fast, stills_dir=None):
    """One pass over the video. A frame is kept when it differs enough from the
    last kept one (the screen really changed) or when max_gap has passed.
    With stills_dir, each kept frame is also saved on its own as a reference still."""
    os.makedirs(out_dir, exist_ok=True)
    if stills_dir:
        os.makedirs(stills_dir, exist_ok=True)
    kept = []
    rot = video_rotation(path)
    with av.open(path) as c:
        vs = c.streams.video[0]
        vs.thread_type = "AUTO"
        if fast:
            vs.codec_context.skip_frame = "NONKEY"
        if start:
            c.seek(int(start / vs.time_base), stream=vs)
        last_thumb, last_t, next_t = None, -1e9, start or 0.0
        t0 = time.time()
        for frame in c.decode(vs):
            if frame.time is None:
                continue
            t = float(frame.time)
            if end is not None and t > end:
                break
            if t < next_t:
                continue
            next_t = t + every
            img = frame.to_image()
            if rot:
                img = img.rotate(rot, expand=True)
            if crop:
                x, y, w, h = crop
                img = img.crop((x, y, x + w, y + h))
            thumb = np.asarray(img.convert("L").resize((96, 54)), dtype=np.int16)
            diff = 255.0 if last_thumb is None else float(np.abs(thumb - last_thumb).mean())
            if diff >= threshold or t - last_t >= max_gap:
                name = f"t{t:08.2f}.jpg"
                fit(img, width).save(os.path.join(out_dir, name), quality=82)
                kept.append({"t": round(t, 2), "file": name, "change": round(diff, 1)})
                if stills_dir:
                    sname = still_name(len(kept), t)
                    kept[-1]["still"] = sname
                    kept[-1]["still_size"] = list(save_still(img, os.path.join(stills_dir, sname)))
                last_thumb, last_t = thumb, t
                if len(kept) % 50 == 0:
                    print(f"  {ts(t)}  {len(kept)} frames kept  ({time.time() - t0:.0f}s)", flush=True)
    return kept


def contact_sheets(frames, frame_dir, out_dir, per_sheet=12, cols=4, tile_w=360):
    os.makedirs(out_dir, exist_ok=True)
    f = font(22)
    sheets = []
    for si in range(0, len(frames), per_sheet):
        chunk = frames[si:si + per_sheet]
        tiles = [fit(Image.open(os.path.join(frame_dir, fr["file"])), tile_w) for fr in chunk]
        th = max(t.height for t in tiles)
        rows = (len(tiles) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (tile_w + 6), rows * (th + 34)), (16, 20, 18))
        d = ImageDraw.Draw(sheet)
        for i, (tile, fr) in enumerate(zip(tiles, chunk)):
            r, col = divmod(i, cols)
            x, y = col * (tile_w + 6), r * (th + 34)
            sheet.paste(tile, (x, y + 30))
            d.text((x + 6, y + 3), ts(fr["t"]), fill=(255, 214, 90), font=f)
        name = f"sheet_{len(sheets) + 1:03d}.jpg"
        sheet.save(os.path.join(out_dir, name), quality=80)
        sheets.append({"file": name, "from": chunk[0]["t"], "to": chunk[-1]["t"]})
    return sheets


def clip(path, out_root, spec, fps, crop, width):
    a, b = spec.split("-")
    t_from, t_to = parse_ts(a), parse_ts(b)
    # Named by the exact start AND end, so two sub-second clips in the same second
    # (the ad-mode case) never share a folder; a re-run of one clip starts clean.
    out_dir = os.path.join(out_root, f"{t_from:07.2f}-{t_to:07.2f}".replace(".", "s"))
    shutil.rmtree(out_dir, ignore_errors=True)
    frames = extract_frames(path, out_dir, 1.0 / fps, 0.0, 0.0, crop, width, t_from, t_to, False)
    sheets = contact_sheets(frames, out_dir, os.path.join(out_dir, "sheets"), per_sheet=16, cols=4)
    print(f"Clip {spec}: {len(frames)} frames, {len(sheets)} sheets in {os.path.relpath(out_dir)}")


# ── Voice ───────────────────────────────────────────────────────────────────

def load_audio(path):
    with av.open(path) as c:
        if not c.streams.audio:
            return None
        res = av.AudioResampler(format="s16", layout="mono", rate=16000)
        chunks = []
        for frame in c.decode(c.streams.audio[0]):
            for out in res.resample(frame):
                chunks.append(out.to_ndarray().reshape(-1))
        for out in res.resample(None):
            chunks.append(out.to_ndarray().reshape(-1))
    if not chunks:
        return None
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def transcribe(audio, model_name):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("  (no faster-whisper: skipping the transcript; run setup.sh)")
        return []
    model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 4)
    segs, info = model.transcribe(audio, vad_filter=True, beam_size=1, language="en")
    out = []
    t0 = time.time()
    for s in segs:
        out.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()})
        if len(out) % 40 == 0:
            print(f"  heard up to {ts(s.end)}  ({time.time() - t0:.0f}s)", flush=True)
    return out


# ── The one page ────────────────────────────────────────────────────────────

def write_index(out, video, duration, frames, sheets, lines):
    rel = lambda p: os.path.relpath(p, out)
    md = [f"# Recording breakdown — {os.path.basename(os.path.dirname(os.path.abspath(video)))}", "",
          f"- Video: `{rel(video)}` — {ts(duration)} long",
          f"- {len(frames)} pictures on {len(sheets)} sheets, {len(lines)} lines of speech",
          "- Each section below is one sheet: the stretch of video it covers and everything said in it.",
          "- A moment too quick for a sheet: rerun with `--clip mm:ss-mm:ss --clip-fps 20`.", ""]
    for i, sh in enumerate(sheets):
        lo = sh["from"] if i else 0.0
        hi = sheets[i + 1]["from"] if i + 1 < len(sheets) else duration + 1
        md.append(f"## {ts(lo)} – {ts(hi)}  ·  sheets/{sh['file']}")
        said = [l for l in lines if lo <= l["start"] < hi]
        md += [f"- **[{ts(l['start'])}]** {l['text']}" for l in said] or ["- *(nothing said)*"]
        md.append("")
    with open(os.path.join(out, "index.md"), "w") as f:
        f.write("\n".join(md))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--out", help="default: the video's own folder")
    ap.add_argument("--mode", choices=sorted(MODES), default="screen",
                    help="screen = someone talking over their screen; ad = a short-form ad with fast cuts")
    ap.add_argument("--every", type=float, help="seconds between looks at the screen (mode default)")
    ap.add_argument("--threshold", type=float, help="how different a frame must be to keep, 0-255 (mode default)")
    ap.add_argument("--max-gap", type=float, help="keep a frame at least this often, seconds (mode default)")
    ap.add_argument("--crop", help="x,y,w,h of the part of the screen that matters (e.g. the browser window)")
    ap.add_argument("--width", type=int, help="saved frame width (mode default)")
    ap.add_argument("--fast", action="store_true", help="keyframes only: much quicker, coarser")
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--model", default="small", help="whisper model: tiny, base, small (default), medium; .en variants work too")
    ap.add_argument("--clip", action="append", default=[], help="mm:ss-mm:ss, every frame of that stretch")
    ap.add_argument("--clip-fps", type=float, default=15)
    ap.add_argument("--clip-only", action="store_true", help="just the --clip stretches, skip everything else")
    ap.add_argument("--stills", action="store_true",
                    help="also save every kept picture on its own (720 px) for copying into an AI image tool; "
                         "the report gets a Frames grid with Copy image and Save")
    a = ap.parse_args()
    for k, v in MODES[a.mode].items():
        if getattr(a, k) is None:
            setattr(a, k, v)

    video = os.path.abspath(a.video)
    out = os.path.abspath(a.out or os.path.dirname(video))
    crop = tuple(int(v) for v in a.crop.split(",")) if a.crop else None
    os.makedirs(out, exist_ok=True)

    with av.open(video) as c:
        vs = c.streams.video[0]
        # A browser-recorded webm often carries no length in its header (Chrome's
        # MediaRecorder): then it is measured from the last frame, after the pass.
        if c.duration:
            duration = float(c.duration / av.time_base)
        elif vs.duration is not None:
            duration = float(vs.duration * vs.time_base)
        else:
            duration = None
        header_duration = duration
        print(f"{os.path.basename(video)}: {ts(duration) if duration is not None else 'length not in the file'}, "
              f"{vs.codec_context.width}x{vs.codec_context.height}, "
              f"{float(vs.average_rate or 0):.0f} fps, audio: {'yes' if c.streams.audio else 'no'}")

    for spec in a.clip:
        clip(video, os.path.join(out, "clips"), spec, a.clip_fps, crop, a.width)
    if a.clip_only:
        return

    # A re-run starts clean: stale pictures and speech from an earlier run would
    # otherwise sit beside the new ones (and the report would pair old speech with
    # new pictures). Only in a folder this tool already wrote (it has frames.json or
    # meta.json), so a video sitting in some other folder never has that folder's
    # own frames/ or sheets/ deleted.
    if any(os.path.exists(os.path.join(out, f)) for f in ("frames.json", "meta.json")):
        for sub in ("frames", "sheets", "report-files"):
            shutil.rmtree(os.path.join(out, sub), ignore_errors=True)
        for f in ("transcript.json", "transcript.txt", "report.html", "index.md"):
            try:
                os.remove(os.path.join(out, f))
            except FileNotFoundError:
                pass
    print("Pictures…")
    stills_dir = os.path.join(out, "report-files", "stills") if a.stills else None
    frames = extract_frames(video, os.path.join(out, "frames"), a.every, a.threshold, a.max_gap,
                            crop, a.width, 0.0, None, a.fast, stills_dir)
    sheets = contact_sheets(frames, os.path.join(out, "frames"), os.path.join(out, "sheets"))
    json.dump(frames, open(os.path.join(out, "frames.json"), "w"))
    print(f"  {len(frames)} frames, {len(sheets)} sheets" + (f", {len(frames)} stills" if a.stills else ""))
    if duration is None:
        duration = (frames[-1]["t"] + a.every) if frames else 0.0

    lines = []
    if not a.no_audio:
        print("Voice…")
        audio = load_audio(video)
        if audio is None:
            print("  no audio track (record with the microphone on to get a transcript)")
        else:
            lines = transcribe(audio, a.model)
            json.dump(lines, open(os.path.join(out, "transcript.json"), "w"), indent=0)
            with open(os.path.join(out, "transcript.txt"), "w") as f:
                f.write("\n".join(f"[{ts(l['start'])}] {l['text']}" for l in lines))
            print(f"  {len(lines)} lines")

    # With no length in the header, the last kept picture can be seconds before the
    # true end (a still screen keeps no new pictures), so stretch to the last thing
    # heard too: closing speech over a still screen must stay in the last stretch.
    if header_duration is None and lines:
        duration = max(duration, lines[-1]["end"])
    write_index(out, video, duration, frames, sheets, lines)
    json.dump({"video": os.path.basename(video), "name": os.path.basename(out), "mode": a.mode,
               "duration": round(duration, 2), "sheets": sheets},
              open(os.path.join(out, "meta.json"), "w"), indent=1)
    try:
        from report import write_report
        print(f"Report: {os.path.relpath(write_report(out))}")
    except Exception as e:  # the breakdown is still complete without the page
        print(f"  (report.html skipped: {e})")
    print(f"Done: {os.path.relpath(os.path.join(out, 'index.md'))}")


if __name__ == "__main__":
    main()
