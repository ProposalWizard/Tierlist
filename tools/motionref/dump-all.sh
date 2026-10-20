#!/bin/sh
# Dump the arms of every hand-made cut scene: dump-all.sh <out dir> <tag> [extra query, e.g. &fluid=old]
# Needs a dev server on BASE (default http://localhost:3064).
BASE="${BASE:-http://localhost:3064}"
OUT="$1"; TAG="$2"; Q="$3"
mkdir -p "$OUT"
for f in signing trophy goal mentor press walkout farewell; do
  node "$(dirname "$0")/dump-arms.mjs" "$BASE/star-style-dev?scene=director&clean=1&fixture=$f$Q" "$OUT/$TAG-$f.json" | tail -1
done
