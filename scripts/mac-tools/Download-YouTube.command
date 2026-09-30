#!/bin/bash
# Download a YouTube (or TikTok, Instagram, X...) video onto this Mac as an mp4.
# It lands in your Downloads folder.
#
# Run it: open Terminal, type   bash   and a space, drag THIS file into the
# window, press Return. Paste the link when it asks.
#
# First run only: it installs Homebrew (the Mac's app installer for tools like
# this), then yt-dlp (the downloader) and ffmpeg (joins picture and sound).
# Homebrew asks for your Mac password once; nothing shows as you type it.

set -u
QUALITY=720   # 720 is plenty to watch. Use 1080 if you need to read small text.
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
stop() { printf '\n%s\n\nPress Return to close.' "$*"; read -r _; exit 1; }

# 1. Homebrew
if ! command -v brew >/dev/null 2>&1; then
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$("$b" shellenv)"; done
fi
if ! command -v brew >/dev/null 2>&1; then
  say "First time only: installing Homebrew. It will ask for your Mac password."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
    || stop "Homebrew didn't install. Tell whoever sent you this what the window says above."
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$("$b" shellenv)"; done
  command -v brew >/dev/null 2>&1 || stop "Homebrew installed but can't be found. Close this window and run it again."
fi

# 2. The downloader and the video joiner
if ! command -v yt-dlp >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  say "First time only: installing the downloader (a few minutes)..."
  brew install yt-dlp ffmpeg || stop "The install failed. Tell whoever sent you this what the window says above."
else
  brew upgrade yt-dlp >/dev/null 2>&1   # YouTube changes often; a stale yt-dlp is the usual cause of failures
fi

# 3. The link
LINK="${1:-}"
if [ -z "$LINK" ]; then
  LINK="$(osascript -e 'text returned of (display dialog "Paste the video link:" default answer "" with title "Download video")' 2>/dev/null)" || true
fi
if [ -z "$LINK" ]; then
  printf '\nPaste the video link and press Return: '; read -r LINK
fi
[ -n "$LINK" ] || stop "No link given."

# 4. Download
say "Downloading at up to ${QUALITY}p..."
cd "$HOME/Downloads" || stop "Couldn't open your Downloads folder."
yt-dlp --no-playlist \
  -f "bv*[height<=${QUALITY}][ext=mp4]+ba[ext=m4a]/bv*[height<=${QUALITY}]+ba/b[height<=${QUALITY}]/b" \
  --merge-output-format mp4 -o "%(title).80s.%(ext)s" --print after_move:filepath \
  "$LINK" > /tmp/ytdl-last.txt || stop "The download failed. If it says 'Sign in' or 'private', the video needs a login and won't work."

FILE="$(tail -1 /tmp/ytdl-last.txt)"
say "Done: $(basename "$FILE") is in your Downloads folder."
[ -f "$FILE" ] && open -R "$FILE"
printf '\nPress Return to close.'; read -r _
