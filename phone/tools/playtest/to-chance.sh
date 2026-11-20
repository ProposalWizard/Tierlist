#!/bin/bash
# Open the look-check career at a size and walk to your first chance in the match (bench → Get out there → the chance).
#   to-chance.sh <packed|next> <page name> <w> <h>
# Leaves the page open on the live bench (live.mjs) and writes <name>-feed.png and <name>-chance.png.
P="node $(dirname "$0")/pt.mjs"; A=$1; N=$2; W=$3; H=$4
$P open "{\"app\":\"$A\",\"name\":\"$N\",\"w\":$W,\"h\":$H,\"save\":true,\"video\":false}" >/dev/null
[ "$A" = next ] && $P click "{\"name\":\"$N\",\"re\":\"^CONTINUE\",\"wait\":4500}" >/dev/null
$P click "{\"name\":\"$N\",\"re\":\"^PLAY\$\",\"wait\":2000}" >/dev/null
for i in $(seq 1 25); do $P text "{\"name\":\"$N\"}" | grep -q "GET OUT THERE" && break; $P click "{\"name\":\"$N\",\"re\":\"^KICK OFF\$\",\"wait\":800}" >/dev/null 2>&1; done
$P shot "{\"name\":\"$N\",\"file\":\"$N-feed\"}" >/dev/null
$P click "{\"name\":\"$N\",\"re\":\"^get out there\$\",\"wait\":500}" >/dev/null
for i in $(seq 1 40); do $P text "{\"name\":\"$N\"}" | grep -q "STAMINA" && break; $P wait "{\"name\":\"$N\",\"ms\":700}" >/dev/null; done
$P wait "{\"name\":\"$N\",\"ms\":2500}" >/dev/null
$P shot "{\"name\":\"$N\",\"file\":\"$N-chance\"}"
