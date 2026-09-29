#!/usr/bin/env bash
# Writes Breakdown-on-Mac.command: ONE file for the Mac, with breakdown.py
# folded inside (into mac-button-template.sh at @@BREAKDOWN@@), so nothing has
# to be pulled from git. Re-run after changing breakdown.py or the template:
#   bash scripts/playtest-video/build-mac-button.sh
set -e
D="$(cd "$(dirname "$0")" && pwd)"
python3 - "$D" <<'PY'
import sys, os
d = sys.argv[1]
t = open(os.path.join(d, "mac-button-template.sh")).read()
b = open(os.path.join(d, "breakdown.py")).read()
assert "PYEOF" not in b
out = os.path.join(d, "Breakdown-on-Mac.command")
open(out, "w").write(t.replace("@@BREAKDOWN@@\n", b if b.endswith("\n") else b + "\n"))
os.chmod(out, 0o755)
print("wrote", out, os.path.getsize(out), "bytes")
PY
