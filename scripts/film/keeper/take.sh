#!/bin/bash
# take.sh <want> <look> <cpow|-> : retry fresh 4-minute takes until one is filmed (max 8)
W=$1; L=$2; P=$3; [ "$P" = "-" ] && P=""
for i in 1 2 3 4 5 6 7 8; do
  rm -rf prof-${W}${P:+p$P}-$L
  CPOW=$P CSIDE=$CSIDE timeout 240 node "$(dirname "$0")/vsave.mjs" ${PORT:-3421} $W . --seed seed.json --look $L > t-$W$P$CSIDE-$L.log 2>&1
  if grep -qE "^ *[0-9]+ filmed" t-$W$P$CSIDE-$L.log; then echo "OK $W $L run $i"; exit 0; fi
  echo "miss $W $L run $i"
done
