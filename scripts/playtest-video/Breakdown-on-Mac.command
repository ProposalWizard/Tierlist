#!/bin/bash
# Knowitball playtest breakdown, for a Mac.
# Turns a screen recording into pictures + a transcript ON YOUR MAC (fast, no
# upload of the big video), then zips the small result and drops it in the
# Drive folder for Claude.
#
# Run it:  open Terminal, type   bash   then a space, drag THIS file into the
# window, type a space, drag your video into the window, press Return.
# (Or just run it with no video and it asks you to pick one.)

set -u
HERE="$HOME/.knowitball-video"
DRIVE_URL="https://drive.google.com/drive/folders/1w_AJFndensiBWMicxiSReM9ZDlyQfBik"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
stop() { printf '\n%s\n\nPress Return to close.' "$*"; read -r _; exit 1; }

# 1. Which video?
VIDEO="${1:-}"
if [ -z "$VIDEO" ]; then
  VIDEO="$(osascript -e 'POSIX path of (choose file with prompt "Pick the playtest recording")' 2>/dev/null)" || true
fi
[ -n "$VIDEO" ] && [ -f "$VIDEO" ] || stop "No video picked (or the file wasn't found)."
shift || true

# 2. Python. A fresh Mac may ask to install Apple's command line tools first.
if ! command -v python3 >/dev/null 2>&1; then
  xcode-select --install >/dev/null 2>&1 || true
  stop "This Mac has no Python yet. A window has popped up asking to install Apple's command line tools: click Install, wait for it to finish (a few minutes), then run this again."
fi

# 3. One-time setup: a private folder with the libraries (a few hundred MB).
mkdir -p "$HERE"
if [ ! -f "$HERE/.ready" ]; then
  say "First time only: installing what's needed (a few minutes)…"
  python3 -m venv "$HERE/venv" || stop "Couldn't set up Python. Tell Claude what this window says."
  "$HERE/venv/bin/pip" install -q --upgrade pip
  "$HERE/venv/bin/pip" install -q av faster-whisper numpy pillow || stop "The install failed. Tell Claude what this window says above."
  touch "$HERE/.ready"
fi

# 4. The breakdown tool itself (folded into this file).
cat > "$HERE/breakdown.py" <<'PYEOF'
#!/usr/bin/env python3
"""
PLAYTEST VIDEO BREAKDOWN

Turns a screen recording of a playtest (OBS, mp4) into things Claude can read:

  .playtests/<name>/
    index.md          the whole session on one page: every stretch of the
                      video, what was said during it, and which sheet shows it
    transcript.txt    everything said, one line per sentence, [mm:ss] stamped
    transcript.json   the same, with exact start/end seconds
    frames/           one picture every time the screen really changes
                      (and at least every --max-gap seconds), named by time
    sheets/           those pictures twelve to a page, each stamped mm:ss
    clips/<from>/     --clip: every frame of a short stretch, for a moment
                      that happens too fast for the sheets (a keeper's dive)

    python3 scripts/playtest-video/breakdown.py .playtests/<name>/video.mp4
    python3 scripts/playtest-video/breakdown.py <video> --clip 12:31-12:34 --clip-fps 20
    python3 scripts/playtest-video/breakdown.py <video> --no-audio --crop 0,0,960,1080

The voice matters as much as the picture: Harry and Mikey talk the whole way
through a playtest, and what they say at 12:31 is about what is on screen at
12:31. index.md puts the two side by side so a comment can be checked against
the frame it was about, instead of being paraphrased from memory.

Setup (once per container): bash scripts/playtest-video/setup.sh
"""
import argparse
import json
import os
import re
import sys
import time

try:
    import av
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Missing libraries. Run: bash scripts/playtest-video/setup.sh")


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


# ── Pictures ────────────────────────────────────────────────────────────────

def extract_frames(path, out_dir, every, threshold, max_gap, crop, width, start, end, fast):
    """One pass over the video. A frame is kept when it differs enough from the
    last kept one (the screen really changed) or when max_gap has passed."""
    os.makedirs(out_dir, exist_ok=True)
    kept = []
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
            if crop:
                x, y, w, h = crop
                img = img.crop((x, y, x + w, y + h))
            thumb = np.asarray(img.convert("L").resize((96, 54)), dtype=np.int16)
            diff = 255.0 if last_thumb is None else float(np.abs(thumb - last_thumb).mean())
            if diff >= threshold or t - last_t >= max_gap:
                name = f"t{t:08.2f}.jpg"
                fit(img, width).save(os.path.join(out_dir, name), quality=82)
                kept.append({"t": round(t, 2), "file": name, "change": round(diff, 1)})
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
    out_dir = os.path.join(out_root, ts(t_from).replace(":", "m") + "s")
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
    md = [f"# Playtest breakdown — {os.path.basename(os.path.dirname(os.path.abspath(video)))}", "",
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
    ap.add_argument("--every", type=float, default=0.5, help="seconds between looks at the screen")
    ap.add_argument("--threshold", type=float, default=10.0, help="how different a frame must be to keep (0-255)")
    ap.add_argument("--max-gap", type=float, default=8.0, help="keep a frame at least this often, seconds")
    ap.add_argument("--crop", help="x,y,w,h of the part of the screen that is the game")
    ap.add_argument("--width", type=int, default=720, help="saved frame width")
    ap.add_argument("--fast", action="store_true", help="keyframes only: much quicker, coarser")
    ap.add_argument("--no-audio", action="store_true")
    ap.add_argument("--model", default="small.en", help="whisper model: tiny.en, base.en, small.en, medium.en")
    ap.add_argument("--clip", action="append", default=[], help="mm:ss-mm:ss, every frame of that stretch")
    ap.add_argument("--clip-fps", type=float, default=15)
    ap.add_argument("--clip-only", action="store_true", help="just the --clip stretches, skip everything else")
    a = ap.parse_args()

    video = os.path.abspath(a.video)
    out = os.path.abspath(a.out or os.path.dirname(video))
    crop = tuple(int(v) for v in a.crop.split(",")) if a.crop else None
    os.makedirs(out, exist_ok=True)

    with av.open(video) as c:
        vs = c.streams.video[0]
        duration = float(c.duration / av.time_base) if c.duration else float(vs.duration * vs.time_base)
        print(f"{os.path.basename(video)}: {ts(duration)}, {vs.codec_context.width}x{vs.codec_context.height}, "
              f"{float(vs.average_rate or 0):.0f} fps, audio: {'yes' if c.streams.audio else 'no'}")

    for spec in a.clip:
        clip(video, os.path.join(out, "clips"), spec, a.clip_fps, crop, a.width)
    if a.clip_only:
        return

    print("Pictures…")
    frames = extract_frames(video, os.path.join(out, "frames"), a.every, a.threshold, a.max_gap,
                            crop, a.width, 0.0, None, a.fast)
    sheets = contact_sheets(frames, os.path.join(out, "frames"), os.path.join(out, "sheets"))
    json.dump(frames, open(os.path.join(out, "frames.json"), "w"))
    print(f"  {len(frames)} frames, {len(sheets)} sheets")

    lines = []
    if not a.no_audio:
        print("Voice…")
        audio = load_audio(video)
        if audio is None:
            print("  no audio track (turn on the mic / desktop audio in OBS to get a transcript)")
        else:
            lines = transcribe(audio, a.model)
            json.dump(lines, open(os.path.join(out, "transcript.json"), "w"), indent=0)
            with open(os.path.join(out, "transcript.txt"), "w") as f:
                f.write("\n".join(f"[{ts(l['start'])}] {l['text']}" for l in lines))
            print(f"  {len(lines)} lines")

    write_index(out, video, duration, frames, sheets, lines)
    print(f"Done: {os.path.relpath(os.path.join(out, 'index.md'))}")


if __name__ == "__main__":
    main()
PYEOF

# 5. Run it.
BASE="$(basename "$VIDEO")"; NAME="${BASE%.*}-$(date +%m%d-%H%M)"
OUT="$HOME/Movies/Knowitball breakdowns/$NAME"
mkdir -p "$OUT"
say "Breaking down $BASE. The first run also downloads the speech model (~0.5 GB)."
"$HERE/venv/bin/python" "$HERE/breakdown.py" "$VIDEO" --out "$OUT" "$@" || stop "The breakdown failed. Tell Claude what this window says above."

# 6. One small zip, nothing of the big video.
ZIP="$HOME/Movies/Knowitball breakdowns/$NAME.zip"
( cd "$OUT" && zip -qr "$ZIP" . )
SIZE="$(du -h "$ZIP" | cut -f1)"

# 7. Into the Drive folder, if Google Drive for desktop is on this Mac.
GOT=""
for d in "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive"/"Knowitball playtest recordings" \
         "$HOME/Google Drive/My Drive/Knowitball playtest recordings" \
         "$HOME/Google Drive/Knowitball playtest recordings"; do
  if [ -d "$d" ]; then cp "$ZIP" "$d/" && GOT="$d"; break; fi
done
if [ -n "$GOT" ]; then
  say "Done. $SIZE zip copied into your Drive folder. Tell Claude: new breakdown's in ($NAME.zip)."
else
  say "Done. $SIZE zip is ready but Drive isn't on this Mac, so drag it in yourself."
  open -R "$ZIP"; open "$DRIVE_URL"
  echo "Drag  $NAME.zip  into the Drive folder that just opened, then tell Claude: new breakdown's in."
fi
printf '\nPress Return to close.'; read -r _
exit 0
