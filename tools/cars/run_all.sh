#!/usr/bin/env bash
# THE WHEEL TOOL, all cars (driving phase 1, 28 Nov 2026). For each of the six generated shop cars
# and their six light copies: unpack (Family Car simplified to 24k), cut the wheels, write
# public/star/drive3d/car-<name>.glb and car-<name>-lod.glb, and a still sheet per car to $STILLS.
# Then pack: node scripts/perf3d/shrink-models.mjs --tools=$GLTOOLS star/drive3d/<file>.glb ...
#
#   GLTOOLS=<dir with tools/models3d's node_modules> STILLS=/some/dir bash tools/cars/run_all.sh [hatch suv ...]
# 0 credits: no new model is generated, these are the shop's own (public/star/shop3d/items/LICENSE.txt).
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${GLTOOLS:?set GLTOOLS}"
STILLS=${STILLS:-/tmp/cars-stills}
WORK=${WORK:-/tmp/cars-work}
mkdir -p "$STILLS" "$WORK" public/star/drive3d
declare -A LEN=([family]=4.3 [hatch]=4.1 [suv]=4.95 [sports]=4.35 [classic]=4.5 [super]=4.6)
CARS=${*:-family hatch suv sports classic super}
for c in $CARS; do
  cap=""; [ "$c" = family ] && cap=24000
  GLTOOLS=$GLTOOLS node tools/cars/unpack.mjs "public/star/shop3d/items/car-$c-hf.glb" "$WORK/$c.glb" $cap
  blender -b -P tools/cars/cut_wheels.py -- "$WORK/$c.glb" "public/star/drive3d/car-$c.glb" --length "${LEN[$c]}" --stills "$STILLS/$c" | grep -E "^(PAINT|INFO)"
  GLTOOLS=$GLTOOLS node tools/cars/unpack.mjs "public/star/home3d/car-$c-lod.glb" "$WORK/$c-lod.glb"
  blender -b -P tools/cars/cut_wheels.py -- "$WORK/$c-lod.glb" "public/star/drive3d/car-$c-lod.glb" --length "${LEN[$c]}" --stills "$STILLS/$c-lod" | grep -E "^(PAINT|INFO)"
done
