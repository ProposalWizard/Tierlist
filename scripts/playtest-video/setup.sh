#!/usr/bin/env bash
# One-time setup for the playtest video breakdown (each new container).
# av = reads the mp4, faster-whisper = turns the talking into text.
set -e
pip install -q av faster-whisper numpy pillow 2>&1 | grep -v "Running pip as the 'root' user" || true
python3 -c "import av, faster_whisper, numpy, PIL; print('playtest-video: ready')"
