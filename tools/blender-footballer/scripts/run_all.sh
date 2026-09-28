#!/bin/bash
# re-render every layer set (neutral kit) — see NOTES.md
cd "$(dirname "$0")/.."
export LD_LIBRARY_PATH=venv/lib
PY=./venv/bin/python
F='FRAME|RENDER_S|Traceback|Error:'
$PY scripts/render_layers.py -- stills 512 40 2>&1 | grep -E "$F" | grep -v 'Cannot read'
for a in IDLE_LOOP CELEBRATE_JUMP KNEESLIDE_ANIM; do
  $PY scripts/render_layers.py -- anim $a 512 16 2>&1 | grep -E "$F" | grep -v 'Cannot read'
done
