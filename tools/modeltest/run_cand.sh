#!/bin/bash
# Fit one generated model to the game skeleton, add clips, take quick previews.
# tools/modeltest/run_cand.sh <repo> <scratch> <candDir> [yaw]
REPO=$1; SCR=$2; D=$3; YAW=${4:--90}
timeout 900 blender -b --python "$REPO/tools/modeltest/fit.py" -- "$D/gen.glb" "$SCR/human_s.glb" "$D/fit.glb" "$YAW" > "$D/fit.log" 2>&1
grep -E "FIT|LM |WEIGHTS|POSE|WROTE|Traceback|Error:" "$D/fit.log" | grep -v "EGL\|unfreed"
node "$REPO/tools/modeltest/addclips.mjs" "$D/fit.glb" "$SCR/mocap-unpacked.glb" "$D/anim.glb" "$SCR/gt" run,kick_r,sprint,idle
mkdir -p "$D/prev"
for spec in "rest:-:0" "run:run:6" "run2:run:13" "kick:kick_r:24" "kick2:kick_r:31" "sprint:sprint:9"; do
  IFS=: read name act fr <<< "$spec"
  if [ "$act" = "-" ]; then
    timeout 300 blender -b --python "$REPO/tools/modeltest/preview.py" -- "$D/anim.glb" "$D/prev/$name.png" > /dev/null 2>&1
  else
    timeout 300 blender -b --python "$REPO/tools/modeltest/preview.py" -- "$D/anim.glb" "$D/prev/$name.png" "$act" "$fr" > /dev/null 2>&1
  fi
done
ls "$D/prev"
