#!/usr/bin/env bash
# Put the CC0 character pack where the scripts and footballer.blend expect it
# (tools/blender-footballer/assets/ubc/...). The pack is not kept in the repo
# (about 20 MB of it is needed, the zip is 122 MB).
#
#  1. Download it (free, CC0 — "No thanks, just take me to the downloads"):
#       https://quaternius.itch.io/universal-base-characters
#     File: "Universal Base Characters[Standard].zip" (122 MB)
#     Also linked from https://quaternius.com/packs/universalbasecharacters.html
#     (itch.io's download link expires within seconds, so it can't be scripted
#     with a plain URL — it has to be clicked.)
#  2. bash tools/blender-footballer/fetch_assets.sh "path/to/Universal Base Characters[Standard].zip"
#
# Copies only the files the build uses (the glTFs, the textures they name) and checks each against
# assets.sha256 (the exact files the renders were made from).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ZIP=${1:?"usage: fetch_assets.sh <path to Universal Base Characters[Standard].zip>"}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP"
# The zip's own top folder name may change between versions: find the folder
# that holds "Base Characters".
SRC=$(dirname "$(find "$TMP" -type d -name "Base Characters" | head -1)")
[ -d "$SRC/Base Characters" ] || { echo "No 'Base Characters' folder in the zip"; exit 1; }
DST="$HERE/assets/ubc"
while read -r sum path; do
  mkdir -p "$DST/$(dirname "$path")"
  cp "$SRC/$path" "$DST/$path"
done < <(sed 's/  /\t/' "$HERE/assets.sha256" | tr '\t' ' ' | awk '{s=$1; $1=""; sub(/^ /,""); print s" "$0}')
cd "$DST" && sha256sum -c --quiet "$HERE/assets.sha256" && echo "assets ready in $DST (every file matches assets.sha256)"
