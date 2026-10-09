#!/bin/bash
# Tear check + look-A renders for each candidate (one Blender at a time).
# tools/modeltest/render_all.sh <repo> <model-test dir> "c1 c2 c3"
REPO=$1; D=$2; CS=${3:-"c1 c2 c3"}
for c in $CS; do
  timeout 900 blender -b --python "$REPO/tools/modeltest/tearcheck.py" -- "$D/$c/anim.glb" run,kick_r,sprint 2>&1 | grep TEAR | sed "s/^/$c /"
  timeout 1200 blender -b --python "$REPO/tools/modeltest/render_cand.py" -- "$D/$c/anim.glb" "$REPO" "$D/$c/look" > "$D/$c/render.log" 2>&1
  grep -E "TRIS|HEIGHT|WROTE|Traceback|Error:" "$D/$c/render.log" | grep -v "EGL\|unfreed" | sed "s/^/$c /"
done
