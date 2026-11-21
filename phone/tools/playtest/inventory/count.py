"""Count an inventory list's rows by status and severity.

    python3 phone/tools/playtest/inventory/count.py [WORLD.md]   (default: WORLD.md next to this file)

A row is a table line with 8 cells: element | packed | KIB Next | status | severity |
android risk | files | stills. Severity counts only DIFFERENT and MISSING rows.
"Android risk" counts rows whose cell starts with YES.
"""
import os, re, sys
from collections import Counter

path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "WORLD.md")
status, sev, risk, rows = Counter(), Counter(), 0, 0
for line in open(path, encoding="utf8"):
    if not line.startswith("|"):
        continue
    cells = [c.strip() for c in re.split(r"(?<!\\)\|", line.strip())[1:-1]]
    if len(cells) != 8 or cells[0] in ("element", "") or set(cells[0]) <= set("-"):
        continue
    st = cells[3]
    if not st:
        continue
    st = "LEFT OUT (Mikey)" if st.startswith("LEFT OUT") else st
    rows += 1
    status[st] += 1
    if st in ("DIFFERENT", "MISSING") and cells[4] in ("HIGH", "MED", "LOW"):
        sev[cells[4]] += 1
    if cells[5].upper().startswith("YES"):
        risk += 1
print(f"rows {rows}")
for k in ("SAME", "DIFFERENT", "MISSING", "LEFT OUT (Mikey)"):
    print(f"{k} {status[k]}")
for k in ("HIGH", "MED", "LOW"):
    print(f"{k} {sev[k]}")
print(f"android risk {risk}")
other = set(status) - {"SAME", "DIFFERENT", "MISSING", "LEFT OUT (Mikey)"}
if other:
    print("unknown statuses:", other)
