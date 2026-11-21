#!/bin/bash
# round 2 playtest: snap.sh NAME -> $SHOTS/NAME-pair.jpg (packed | KIB side by side), the pngs removed.
# Needs PT_PORT (the drive.mjs port) and SHOTS (drive.mjs's --shots folder) in the environment.
H=$(dirname "$0")/..
node $H/cmd.mjs "return await shot('$1')" >/dev/null
python3 $H/pair.py "$SHOTS" "$1" 0.6 && rm -f "$SHOTS/$1-packed.png" "$SHOTS/$1-next.png"
