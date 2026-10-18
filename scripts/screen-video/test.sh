#!/usr/bin/env bash
# Tests for the video breakdown. Run: bash scripts/screen-video/test.sh
# Makes a 4-second silent test video with a 0.3 s cut hidden between 1.1 s and
# 1.4 s, between two of screen mode's 0.5 s looks (the sub-second-cut lesson), then checks: ad mode catches the short cut,
# screen mode misses it, the report page is built, a re-run
# leaves no stale pictures, and share-page links are recognised.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
pass=0; fail=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "FAIL: $1 (got [$2] want [$3])"; fi; }

python3 - "$T" <<'PY'
import sys, av, numpy as np
out = sys.argv[1]
for name in ("ad", "screen"):
    c = av.open(f"{out}/{name}.mp4", "w")
    s = c.add_stream("mpeg4", rate=30); s.width, s.height, s.pix_fmt = 320, 240, "yuv420p"
    for i in range(120):                       # 4 s at 30 fps
        t = i / 30
        colour = 200 if 1.1 <= t < 1.4 else (40 if t < 2 else 120)   # grey, 0.3 s flash, grey, lighter
        img = np.full((240, 320, 3), colour, dtype=np.uint8)
        for p in s.encode(av.VideoFrame.from_ndarray(img, format="rgb24")): c.mux(p)
    for p in s.encode(): c.mux(p)
    c.close()
PY
mkdir -p "$T/ad" "$T/screen"; mv "$T/ad.mp4" "$T/ad/video.mp4"; mv "$T/screen.mp4" "$T/screen/video.mp4"

python3 "$HERE/breakdown.py" "$T/ad/video.mp4" --mode ad --no-audio >/dev/null 2>&1
flash() { python3 -c "import json;print(any(1.1<=f['t']<1.4 for f in json.load(open('$1/frames.json'))))"; }
check "ad mode keeps the 0.3 s cut" "$(flash "$T/ad")" True
check "report.html built" "$([ -s "$T/ad/report.html" ] && echo yes)" yes
check "report has the sheet" "$(grep -c 'report-files/sheet_001.jpg' "$T/ad/report.html" | tr -d ' ' | sed 's/^[1-9][0-9]*$/yes/')" yes
check "meta.json says ad" "$(python3 -c "import json;print(json.load(open('$T/ad/meta.json'))['mode'])")" ad

# --stills: one picture per kept frame, a Frames grid in the report; gone again without the flag.
python3 "$HERE/breakdown.py" "$T/ad/video.mp4" --mode ad --no-audio --stills >/dev/null 2>&1
check "--stills writes one still per frame" "$(python3 -c "import json,os;f=json.load(open('$T/ad/frames.json'));print(len(f)==len(os.listdir('$T/ad/report-files/stills')) and all('still' in x for x in f))")" True
check "--stills adds the Frames grid" "$(grep -c 'id=\"frames\"' "$T/ad/report.html" | tr -d ' ')" 1
python3 "$HERE/breakdown.py" "$T/ad/video.mp4" --mode ad --no-audio >/dev/null 2>&1
check "no --stills, no stills or grid" "$([ -e "$T/ad/report-files/stills" ] || grep -q 'id=\"frames\"' "$T/ad/report.html" && echo stale || echo clean)" clean

touch "$T/ad/frames/t9999.99.jpg" "$T/ad/sheets/sheet_099.jpg"
python3 "$HERE/breakdown.py" "$T/ad/video.mp4" --mode ad --no-audio >/dev/null 2>&1
check "re-run clears stale frames" "$([ -e "$T/ad/frames/t9999.99.jpg" ] && echo stale || echo clean)" clean
check "re-run clears stale sheets" "$([ -e "$T/ad/sheets/sheet_099.jpg" ] && echo stale || echo clean)" clean

python3 "$HERE/breakdown.py" "$T/screen/video.mp4" --no-audio >/dev/null 2>&1
check "screen mode misses it (why ad mode exists)" "$(flash "$T/screen")" False

# A re-run with no sound must not keep the previous run's transcript (the report
# would pair old speech with new pictures).
echo '[{"start": 0.5, "end": 1, "text": "OLD SPEECH"}]' > "$T/ad/transcript.json"
python3 "$HERE/breakdown.py" "$T/ad/video.mp4" --mode ad --no-audio >/dev/null 2>&1
check "re-run drops a stale transcript" "$(grep -c 'OLD SPEECH' "$T/ad/report.html" | tr -d ' ')" 0

# Two sub-second clips in the same second get their own folders.
python3 "$HERE/breakdown.py" "$T/ad/video.mp4" --clip-only --clip 0:00.2-0:00.5 --clip 0:00.6-0:00.9 >/dev/null 2>&1
check "sub-second clips never share a folder" "$(ls "$T/ad/clips" | wc -l | tr -d ' ')" 2

# A video in some other folder: its own frames/ folder is never deleted.
mkdir -p "$T/loose/frames"; touch "$T/loose/frames/keep.jpg"; cp "$T/ad/video.mp4" "$T/loose/clip.mp4"
python3 "$HERE/breakdown.py" "$T/loose/clip.mp4" --no-audio >/dev/null 2>&1
check "never wipes a folder this tool did not make" "$([ -e "$T/loose/frames/keep.jpg" ] && echo kept || echo wiped)" kept

check "--name cannot escape .recordings" "$(cd "$HERE" && python3 fetch.py https://example.com/x.mp4 --name ../x >/dev/null 2>&1; echo $?)" 1

links="$(cd "$HERE" && python3 -c "
import fetch
print(fetch.is_page_link('https://www.loom.com/share/x'), fetch.is_page_link('https://evil-loom.com/x'),
      fetch.direct_url('https://drive.google.com/file/d/1AbCdefghijklmnopqrstuvwx/view').startswith('https://drive.usercontent.google.com/download?id=1AbC'))")"
check "links: loom yes, lookalike no, drive rewritten" "$links" "True False True"

echo "screen-video: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
