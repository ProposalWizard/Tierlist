#!/bin/bash
# Usage: trial-to-strike.sh <app packed|next> <name> <w> <h>
# New career -> trial free kick -> aim (still) -> pull back -> strike screen (still).
# Uses the live bench (live.mjs), which must be running.
P="node $(dirname "$0")/pt.mjs"; A=$1; N=$2; W=$3; H=$4
$P open "{\"app\":\"$A\",\"name\":\"$N\",\"w\":$W,\"h\":$H,\"video\":false}" >/dev/null
[ "$A" = next ] && $P click "{\"name\":\"$N\",\"re\":\"new game\"}" >/dev/null
$P eval "{\"name\":\"$N\",\"js\":\"(()=>{const i=[...document.querySelectorAll('input')];const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(i[0],'Play');i[0].dispatchEvent(new Event('input',{bubbles:true}));s.call(i[1],'Test');i[1].dispatchEvent(new Event('input',{bubbles:true}));return 1})()\"}" >/dev/null
$P click "{\"name\":\"$N\",\"re\":\"Continue\"}" >/dev/null; $P click "{\"name\":\"$N\",\"re\":\"^RIGHT\$\"}" >/dev/null; $P click "{\"name\":\"$N\",\"re\":\"Continue\"}" >/dev/null
$P click "{\"name\":\"$N\",\"re\":\"Start Career\",\"wait\":3000}" >/dev/null 2>&1
$P wait "{\"name\":\"$N\",\"ms\":2500}" >/dev/null
$P shot "{\"name\":\"$N\",\"file\":\"size-$N-howto\"}" >/dev/null
$P tap "{\"name\":\"$N\",\"x\":$((W/2)),\"y\":$((H/3)),\"wait\":1200}" >/dev/null
B=$($P ball "{\"name\":\"$N\"}")
X=$(echo "$B" | python3 -c "import json,sys;b=json.load(sys.stdin)['balls'];print(int(b[0]['x']) if b else -1)")
Y=$(echo "$B" | python3 -c "import json,sys;b=json.load(sys.stdin)['balls'];print(int(b[0]['y']) if b else -1)")
echo "$N ball $X $Y"
$P drag "{\"name\":\"$N\",\"x1\":$X,\"y1\":$Y,\"x2\":$((X-10)),\"y2\":$((Y+90)),\"hold\":200,\"file\":\"size-$N-aim\"}" >/dev/null
$P tap "{\"name\":\"$N\",\"x\":$((W/2)),\"y\":$((H/4)),\"wait\":1600}" >/dev/null
$P tap "{\"name\":\"$N\",\"x\":$((W/2)),\"y\":$((H/6)),\"wait\":300}" >/dev/null
$P shot "{\"name\":\"$N\",\"file\":\"size-$N-strike\"}" >/dev/null
$P text "{\"name\":\"$N\"}" | grep -c "STRIKE IT"
$P close "{\"name\":\"$N\"}" >/dev/null
