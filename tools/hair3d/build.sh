#!/bin/bash
# Build every toon hair for both hair heads and pack them.  tools/hair3d/build.sh <scratch dir> <dir with @gltf-transform etc.> [style ...]
set -e
S=$1; GT=$2; shift 2
cd "$(dirname "$0")/../.."
mkdir -p public/star/people3d/hair
for pair in h3:toon-p3 m2:toon-mgr2; do
  base=${pair%%:*}; file=${pair##*:}
  node tools/hair3d/dump_head.mjs public/star/people3d/$file.glb $S/$base --tools=$GT > /dev/null
  blender -b --python tools/hair3d/build_hair.py -- $S/$base $S/out $base "$@" 2>&1 | grep -E "^(HEAD|HAIR|HAIRLINE)|Error|Traceback|line "
  for f in $S/out/hair-$base-*.raw.glb; do
    n=$(basename $f .raw.glb)
    if [ $# -eq 0 ] || echo "$@" | grep -qw "${n#hair-$base-}"; then cp $f public/star/people3d/hair/$n.glb; fi
  done
  cp $S/out/hair-$base.json tools/hair3d/hair-$base.json
done
node scripts/perf3d/shrink-models.mjs --tools=$GT $(ls public/star/people3d/hair/*.glb | sed 's#public/##') | tail -3
