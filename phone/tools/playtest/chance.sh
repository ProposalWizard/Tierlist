#!/bin/bash
# Take one chance on an open bench page like a player: find the ball, pull back
# from it away from the goal (goal assumed at the top middle of the pitch, GY),
# take the strike/head/volley screen if it comes (tap the ball low-centre),
# and keep a flip book of what happened.
#   chance.sh <page name> <file prefix> [GY=240] [pull=85] [candidate index=0]
P="node $(dirname "$0")/pt.mjs"; N=$1; F=$2; GY=${3:-240}; PULL=${4:-85}; IDX=${5:-0}
$P shot "{\"name\":\"$N\",\"file\":\"$F-0\"}" >/dev/null
B=$($P ball "{\"name\":\"$N\",\"loose\":true}")
read X Y < <(echo "$B" | python3 -c "import json,sys;b=json.load(sys.stdin)['balls'];i=min($IDX,len(b)-1);print(int(b[i]['x']),int(b[i]['y'])) if b else print(-1,-1)")
[ -n "$BX" ] && { X=$BX; Y=$BY; }
[ "$X" = -1 ] && { echo "$N: no ball"; exit 1; }
read X2 Y2 < <(python3 -c "import math;dx=206-$X;dy=$GY-$Y;n=math.hypot(dx,dy) or 1;print(int($X-dx/n*$PULL),int($Y-dy/n*$PULL))")
echo "$N: ball $X,$Y -> drag to $X2,$Y2"
$P drag "{\"name\":\"$N\",\"x1\":$X,\"y1\":$Y,\"x2\":$X2,\"y2\":$Y2,\"shots\":[8],\"hold\":150,\"file\":\"$F-aim\",\"after\":50}" >/dev/null
$P burst "{\"name\":\"$N\",\"n\":6,\"every\":250,\"file\":\"$F-a\"}" >/dev/null
T=$($P text "{\"name\":\"$N\"}")
if echo "$T" | grep -qiE "(STRIKE|HEAD|VOLLEY) IT\?"; then
  echo "$N: strike screen: $(echo "$T" | grep -iE '(STRIKE|HEAD|VOLLEY) IT\?' | head -1)"
  $P shot "{\"name\":\"$N\",\"file\":\"$F-strike\"}" >/dev/null
  echo "$T" | grep -qi "TAP ANYWHERE" && $P tap "{\"name\":\"$N\",\"x\":206,\"y\":400,\"wait\":200}" >/dev/null
  $P tap "{\"name\":\"$N\",\"x\":${SX:-206},\"y\":${SY:-760},\"wait\":20}" >/dev/null
fi
$P burst "{\"name\":\"$N\",\"n\":14,\"every\":250,\"file\":\"$F-b\"}" >/dev/null
$P text "{\"name\":\"$N\"}" | grep -E "^[A-Z !.'’]{4,}$|⚽|scor|SAVED|GOAL|WIDE|MISS" | head -6
