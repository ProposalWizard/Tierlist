#!/bin/bash
# Play an open bench page on to FULL TIME: kick off, go on, take every chance
# (drag back from each ball-like blob in turn until one kicks; tap the strike
# screen's ball), then press FULL TIME and shoot each screen after it.
#   to-fulltime.sh <page name> <w> <h> [max loops=400]
P="node $(dirname "$0")/pt.mjs"; N=$1; W=$2; H=$3; MAX=${4:-400}; IDX=0
for i in $(seq 1 $MAX); do
  T=$($P text "{\"name\":\"$N\"}")
  if echo "$T" | grep -qE "^\s*FULL TIME\s*$"; then break; fi
  if echo "$T" | grep -qE "^KICK OFF$"; then $P click "{\"name\":\"$N\",\"re\":\"^KICK OFF\$\",\"wait\":800}" >/dev/null 2>&1; continue; fi
  if echo "$T" | grep -q "GET OUT THERE"; then $P click "{\"name\":\"$N\",\"re\":\"^get out there\$\",\"wait\":800}" >/dev/null; continue; fi
  if echo "$T" | grep -qE "(STRIKE|HEAD|VOLLEY) IT\?"; then
    echo "$T" | grep -qi "TAP ANYWHERE" && $P tap "{\"name\":\"$N\",\"x\":$((W/2)),\"y\":$((H/3)),\"wait\":200}" >/dev/null
    $P tap "{\"name\":\"$N\",\"x\":$((W/2)),\"y\":$((H*${SYP:-80}/100)),\"wait\":600}" >/dev/null; IDX=0; continue; fi
  if echo "$T" | grep -q "STAMINA"; then
    B=$($P ball "{\"name\":\"$N\",\"loose\":true}")
    read X Y < <(echo "$B" | python3 -c "import json,sys;b=json.load(sys.stdin)['balls'];i=$IDX % max(1,len(b));print(int(b[i]['x']),int(b[i]['y'])) if b else print(-1,-1)")
    IDX=$((IDX+1))
    if [ "$X" != -1 ]; then $P drag "{\"name\":\"$N\",\"x1\":$X,\"y1\":$Y,\"x2\":$X,\"y2\":$((Y+80)),\"after\":900}" >/dev/null; fi
    continue
  fi
  IDX=0; $P wait "{\"name\":\"$N\",\"ms\":700}" >/dev/null
done
$P shot "{\"name\":\"$N\",\"file\":\"$N-ft\"}" >/dev/null
$P click "{\"name\":\"$N\",\"re\":\"^\\\\s*FULL TIME\\\\s*\$\",\"wait\":3500}"
for k in 1 2 3 4 5; do
  $P shot "{\"name\":\"$N\",\"file\":\"$N-post-$k\"}" >/dev/null
  $P text "{\"name\":\"$N\"}" | head -8 | tr '\n' '|'; echo
  $P click "{\"name\":\"$N\",\"re\":\"^(continue|next|done|ok|got it)\",\"wait\":2500}" >/dev/null 2>&1 || $P tap "{\"name\":\"$N\",\"x\":$((W/2)),\"y\":$((H*85/100)),\"wait\":2500}" >/dev/null
done
$P errors "{\"name\":\"$N\"}" | head -c 800
