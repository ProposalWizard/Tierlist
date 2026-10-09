#!/bin/bash
# prep_batch.sh <prefix> <maxTris> name...   raw/<name>.glb → public items/<prefix>-<name>-hf.glb
T=$(cd "$(dirname "$0")" && pwd)
W=${WORK:-./work}
P=${OUT:-./public/star/shop3d/items}
pre=$1; max=$2; shift 2
for n in "$@"; do node "$T/prep.mjs" "$W/raw/$n.glb" "$P/$pre-$n-hf.glb" "$max"; done
