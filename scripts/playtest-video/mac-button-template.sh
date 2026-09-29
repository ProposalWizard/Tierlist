#!/bin/bash
# Knowitball playtest breakdown, for a Mac.
# Turns a screen recording into pictures + a transcript ON YOUR MAC (fast, no
# upload of the big video), then zips the small result and drops it in the
# Drive folder for Claude.
#
# Run it:  open Terminal, type   bash   then a space, drag THIS file into the
# window, type a space, drag your video into the window, press Return.
# (Or just run it with no video and it asks you to pick one.)

set -u
HERE="$HOME/.knowitball-video"
DRIVE_URL="https://drive.google.com/drive/folders/1w_AJFndensiBWMicxiSReM9ZDlyQfBik"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
stop() { printf '\n%s\n\nPress Return to close.' "$*"; read -r _; exit 1; }

# 1. Which video?
VIDEO="${1:-}"
if [ -z "$VIDEO" ]; then
  VIDEO="$(osascript -e 'POSIX path of (choose file with prompt "Pick the playtest recording")' 2>/dev/null)" || true
fi
[ -n "$VIDEO" ] && [ -f "$VIDEO" ] || stop "No video picked (or the file wasn't found)."
shift || true

# 2. Python. A fresh Mac may ask to install Apple's command line tools first.
if ! command -v python3 >/dev/null 2>&1; then
  xcode-select --install >/dev/null 2>&1 || true
  stop "This Mac has no Python yet. A window has popped up asking to install Apple's command line tools: click Install, wait for it to finish (a few minutes), then run this again."
fi

# 3. One-time setup: a private folder with the libraries (a few hundred MB).
mkdir -p "$HERE"
if [ ! -f "$HERE/.ready" ]; then
  say "First time only: installing what's needed (a few minutes)…"
  python3 -m venv "$HERE/venv" || stop "Couldn't set up Python. Tell Claude what this window says."
  "$HERE/venv/bin/pip" install -q --upgrade pip
  "$HERE/venv/bin/pip" install -q av faster-whisper numpy pillow || stop "The install failed. Tell Claude what this window says above."
  touch "$HERE/.ready"
fi

# 4. The breakdown tool itself (folded into this file).
cat > "$HERE/breakdown.py" <<'PYEOF'
@@BREAKDOWN@@
PYEOF

# 5. Run it.
BASE="$(basename "$VIDEO")"; NAME="${BASE%.*}-$(date +%m%d-%H%M)"
OUT="$HOME/Movies/Knowitball breakdowns/$NAME"
mkdir -p "$OUT"
say "Breaking down $BASE. The first run also downloads the speech model (~0.5 GB)."
"$HERE/venv/bin/python" "$HERE/breakdown.py" "$VIDEO" --out "$OUT" "$@" || stop "The breakdown failed. Tell Claude what this window says above."

# 6. One small zip, nothing of the big video.
ZIP="$HOME/Movies/Knowitball breakdowns/$NAME.zip"
( cd "$OUT" && zip -qr "$ZIP" . )
SIZE="$(du -h "$ZIP" | cut -f1)"

# 7. Into the Drive folder, if Google Drive for desktop is on this Mac.
GOT=""
for d in "$HOME"/Library/CloudStorage/GoogleDrive-*/"My Drive"/"Knowitball playtest recordings" \
         "$HOME/Google Drive/My Drive/Knowitball playtest recordings" \
         "$HOME/Google Drive/Knowitball playtest recordings"; do
  if [ -d "$d" ]; then cp "$ZIP" "$d/" && GOT="$d"; break; fi
done
if [ -n "$GOT" ]; then
  say "Done. $SIZE zip copied into your Drive folder. Tell Claude: new breakdown's in ($NAME.zip)."
else
  say "Done. $SIZE zip is ready but Drive isn't on this Mac, so drag it in yourself."
  open -R "$ZIP"; open "$DRIVE_URL"
  echo "Drag  $NAME.zip  into the Drive folder that just opened, then tell Claude: new breakdown's in."
fi
printf '\nPress Return to close.'; read -r _
exit 0
