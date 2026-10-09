#!/bin/bash
# Renders the look-test options one after another (one Blender at a time: memory is tight).
# tools/styletest/run_all.sh <repo> <scratch> "A B C D"
REPO=$1; SCR=$2; OPTS=${3:-"A B C D"}
for o in $OPTS; do
  timeout 900 blender -b --python "$REPO/tools/styletest/render.py" -- "$o" "$REPO" "$SCR" "$SCR/style-test/$o" wide,close,shop > "$SCR/style-test/log$o.txt" 2>&1
  grep -E "WROTE|Traceback|Error:" "$SCR/style-test/log$o.txt" | grep -v EGL
done
