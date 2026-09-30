#!/usr/bin/env bash
# Writes Breakdown-on-Mac.command AND Breakdown-on-Windows.bat: ONE file each, with breakdown.py
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
# Windows: the same tool folded into a batch file (CRLF, as Windows expects).
w = open(os.path.join(d, "windows-button-template.bat")).read()
assert w.rstrip().endswith("::PYSTART")
w = w.rstrip() + "\n" + (b if b.endswith("\n") else b + "\n")
wout = os.path.join(d, "Breakdown-on-Windows.bat")
open(wout, "w", newline="").write(w.replace("\r\n", "\n").replace("\n", "\r\n"))
print("wrote", wout, os.path.getsize(wout), "bytes")
PY
