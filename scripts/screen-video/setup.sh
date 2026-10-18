#!/usr/bin/env bash
# One-time setup for the screen recording breakdown.
# av = reads the video, faster-whisper = turns the talking into text (runs
# locally, no API key), numpy + pillow = the pictures.
set -e
# yt-dlp + curl_cffi = Loom/TikTok/YouTube links (curl_cffi lets TikTok see a normal browser).
# deno = the JavaScript runtime YouTube's page needs; imageio-ffmpeg = a bundled ffmpeg
# that joins YouTube's separate picture and sound files. Both install through pip.
pip install -q av faster-whisper numpy pillow "yt-dlp[default]" curl_cffi deno imageio-ffmpeg 2>&1 | grep -v "Running pip as the 'root' user" || true
python3 -c "import av, faster_whisper, numpy, PIL, yt_dlp, curl_cffi, imageio_ffmpeg; print('screen-video: ready')"
