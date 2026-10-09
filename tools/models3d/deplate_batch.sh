#!/bin/bash
# deplate_batch.sh name... : raw/<name>.glb → prep → deplate → public car-<name>-hf.glb
T=$(cd "$(dirname "$0")" && pwd)
W=${WORK:-./work}
P=${OUT:-./public/star/shop3d/items}
mkdir -p "$W/dp"
for n in "$@"; do
  node "$T/prep.mjs" "$W/raw/$n.glb" "$W/dp/$n.glb" 24000
  node "$T/deplate.mjs" "$W/dp/$n.glb" "$P/car-$n-hf.glb"
done
