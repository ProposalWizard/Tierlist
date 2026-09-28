#!/usr/bin/env bash
# One-time setup for the playtest video breakdown (each new container).
# av = reads the mp4, faster-whisper = turns the talking into text,
# yt-dlp (+ curl_cffi for TikTok) = links to YouTube/TikTok/etc.
set -e
pip install -q av faster-whisper numpy pillow "yt-dlp[default]" curl_cffi deno imageio-ffmpeg 2>&1 | grep -v "Running pip as the 'root' user" || true
python3 -c "import av, faster_whisper, numpy, PIL, yt_dlp, imageio_ffmpeg; print('playtest-video: ready')"
