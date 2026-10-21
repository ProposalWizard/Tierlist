#!/bin/sh
# Film one cut scene twice, frame by frame at phone size: before (?fluid=old) and after.
#   film-pair.sh <fixture> <frames dir> [fps] [from-seconds] [to-seconds]
# Needs a dev server on BASE (default http://localhost:3064). Then side_by_side.py joins them with the reference.
BASE="${BASE:-http://localhost:3064}"
FX="$1"; DIR="$2"; FPS="${3:-24}"
R="$(cd "$(dirname "$0")/../.." && pwd)"
EXTRA=""
if [ -n "$4" ]; then EXTRA="--from $(python3 -c "print(int($4*$FPS))") --to $(python3 -c "print(int($5*$FPS))")"; fi
for v in old new; do
  node "$R/scripts/film/frames3d.mjs" "$BASE/star-3d-bench-dev/scene?scene=director&clean=1&fixture=$FX&fluid=$v" --out "$DIR/$FX-$v" --fps "$FPS" $EXTRA >/dev/null 2>&1
  echo "$FX $v: $(ls "$DIR/$FX-$v" | grep -c frame_) frames"
done
