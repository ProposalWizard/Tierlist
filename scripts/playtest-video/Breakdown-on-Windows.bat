@echo off
rem Knowitball playtest breakdown, for Windows.
rem Turns a screen recording into pictures + a transcript ON YOUR PC (fast, no
rem upload of the big video), then zips the small result and drops it in the
rem Drive folder for Claude.
rem
rem Run it: drag your video onto this file, or double-click it and pick one.
rem (Windows may say "Windows protected your PC": click More info, then Run anyway.)
setlocal EnableExtensions
title Knowitball playtest breakdown
set "HERE=%LOCALAPPDATA%\KnowitballVideo"
set "DRIVE_URL=https://drive.google.com/drive/folders/1w_AJFndensiBWMicxiSReM9ZDlyQfBik"
set "SELF=%~f0"
set "PYTHONUTF8=1"

rem 1. Which video?
set "VIDEO=%~1"
if not "%VIDEO%"=="" goto havevideo
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = 'Pick the playtest recording'; $d.Filter = 'Videos|*.mp4;*.mkv;*.mov;*.webm;*.avi|All files|*.*'; if ($d.ShowDialog() -eq 'OK') { $d.FileName }"`) do set "VIDEO=%%F"
:havevideo
if "%VIDEO%"=="" goto novideo
if not exist "%VIDEO%" goto novideo

rem 2. Python. Windows has none by default; winget can install it.
set "PY="
py -3 --version >nul 2>&1
if not errorlevel 1 set "PY=py -3"
if defined PY goto havepython
python --version >nul 2>&1
if not errorlevel 1 set "PY=python"
if defined PY goto havepython
echo.
echo This PC has no Python yet. Installing it now (one time, about a minute)...
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
echo.
echo Python is installed. CLOSE THIS WINDOW, then run this again (drag the video on again).
pause
exit /b 1
:havepython

rem 3. One-time setup: a private folder with the libraries (a few hundred MB).
if not exist "%HERE%" mkdir "%HERE%"
if exist "%HERE%\.ready" goto ready
echo.
echo First time only: installing what is needed (a few minutes)...
%PY% -m venv "%HERE%\venv"
if errorlevel 1 goto fail
"%HERE%\venv\Scripts\python.exe" -m pip install -q --upgrade pip
"%HERE%\venv\Scripts\python.exe" -m pip install -q av faster-whisper numpy pillow
if errorlevel 1 goto fail
echo ok>"%HERE%\.ready"
:ready

rem 4. The breakdown tool itself (folded into the end of this file).
powershell -NoProfile -Command "$t = [IO.File]::ReadAllText($env:SELF); $i = $t.IndexOf(':' + ':PY' + 'START'); $p = $t.Substring($i); $p = $p.Substring($p.IndexOf([char]10) + 1); [IO.File]::WriteAllText($env:HERE + '\breakdown.py', $p, (New-Object System.Text.UTF8Encoding($false)))"
if errorlevel 1 goto fail

rem 5. Run it.
for %%I in ("%VIDEO%") do set "BASE=%%~nI"
for /f %%D in ('powershell -NoProfile -Command "Get-Date -Format MMdd-HHmm"') do set "STAMP=%%D"
set "NAME=%BASE%-%STAMP%"
set "OUT=%USERPROFILE%\Videos\Knowitball breakdowns\%NAME%"
mkdir "%OUT%" 2>nul
echo.
echo Breaking down %BASE%. The first run also downloads the speech model (about 0.5 GB).
"%HERE%\venv\Scripts\python.exe" "%HERE%\breakdown.py" "%VIDEO%" --out "%OUT%"
if errorlevel 1 goto fail

rem 6. One small zip (made by Python, so it opens correctly everywhere), nothing of the big video.
"%HERE%\venv\Scripts\python.exe" -c "import shutil, sys; shutil.make_archive(sys.argv[1], 'zip', sys.argv[1])" "%OUT%"
if errorlevel 1 goto fail
for %%Z in ("%OUT%.zip") do set "BYTES=%%~zZ"
set /a KB=%BYTES%/1024

rem 7. Into the Drive folder, if Google Drive for desktop is on this PC.
set "GOT="
for %%L in (D E F G H I J K L M N O P Q R S T U V W X Y Z) do if exist "%%L:\My Drive\Knowitball playtest recordings\" if not defined GOT set "GOT=%%L:\My Drive\Knowitball playtest recordings"
if not defined GOT if exist "%USERPROFILE%\Google Drive\My Drive\Knowitball playtest recordings\" set "GOT=%USERPROFILE%\Google Drive\My Drive\Knowitball playtest recordings"
if not defined GOT goto nodrive
copy /y "%OUT%.zip" "%GOT%\" >nul
echo.
echo Done. %KB% KB zip copied into your Drive folder.
echo Tell Claude: new breakdown's in (%NAME%.zip)
goto finish
:nodrive
echo.
echo Done. %KB% KB zip is ready, but Drive isn't on this PC, so drag it in yourself.
explorer /select,"%OUT%.zip"
start "" "%DRIVE_URL%"
echo Drag  %NAME%.zip  into the Drive folder that just opened, then tell Claude: new breakdown's in.
:finish
echo.
pause
exit /b 0

:novideo
echo.
echo No video picked (or the file was not found).
pause
exit /b 1

:fail
echo.
echo Something went wrong. Tell Claude what this window says above.
pause
exit /b 1

::PYSTART
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
              "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
              "C:/Windows/Fonts/arialbd.ttf"):
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
