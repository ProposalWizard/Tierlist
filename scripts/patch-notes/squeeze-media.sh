#!/usr/bin/env bash
# scripts/patch-notes/squeeze-media.sh — shrink a patch note's clips and stills
# in place, the way Leo did for 0.119/0.121/0.123 (e5aedcbd: 29.1 -> 15.5 MB).
# Why: the patch-notes folder ships inside admin routes that Vercel caps at
# 250 MB each; one heavy note failed a deploy. Same size, same look.
#   clips:  H.264 at CRF 30, same width/height, +faststart, audio kept (AAC 96k)
#   stills: JPEG re-saved at quality 4 (about 80%)
# A file is only replaced when the new one is at least 5% smaller.
# Usage: scripts/patch-notes/squeeze-media.sh 0.109h 0.110h   (or --all-h)
set -euo pipefail
cd "$(dirname "$0")/../.."
dirs=()
if [[ "${1:-}" == "--all-h" ]]; then
  for d in patch-notes/pages/*h; do dirs+=("$d"); done
else
  for v in "$@"; do dirs+=("patch-notes/pages/$v"); done
fi
before=0; after=0
for d in "${dirs[@]}"; do
  [[ -d "$d" ]] || { echo "no folder $d" >&2; continue; }
  while IFS= read -r -d '' f; do
    s=$(stat -c %s "$f"); before=$((before+s)); tmp="${f%.*}.sq.${f##*.}"
    case "${f,,}" in
      *.mp4) ffmpeg -nostdin -v error -y -i "$f" -map 0:v:0 -map '0:a?' -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p \
               -c:a aac -b:a 96k -movflags +faststart "$tmp" ;;
      *.jpg|*.jpeg) ffmpeg -nostdin -v error -y -i "$f" -q:v 4 "$tmp" ;;
    esac
    if [[ -f "$tmp" ]]; then
      n=$(stat -c %s "$tmp")
      if (( n * 100 < s * 95 )); then mv "$tmp" "$f"; s=$n; else rm -f "$tmp"; fi
    fi
    after=$((after+s))
  done < <(find "$d" -type f \( -iname '*.mp4' -o -iname '*.jpg' -o -iname '*.jpeg' \) -print0)
done
printf 'squeeze-media: %.1f MB -> %.1f MB\n' "$(echo "$before/1048576" | bc -l)" "$(echo "$after/1048576" | bc -l)"
