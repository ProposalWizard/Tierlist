"""Count the rows of an inventory list (CAREER.md and friends) by status and severity.

    python3 phone/tools/playtest/inventory/count.py phone/tools/playtest/inventory/CAREER.md

A row is a table line with 8 cells: element | packed | KIB Next | status | sev | android risk | files | stills.
Border rows (no status) are skipped.
"""
import collections
import sys

rows = []
for line in open(sys.argv[1]):
    if not line.startswith("|") or line.startswith("|---"):
        continue
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) != 8 or cells[3] in ("Status", ""):
        continue
    rows.append(cells)

table = collections.Counter((r[3], r[4]) for r in rows)
statuses = ["SAME", "DIFFERENT", "MISSING", "LEFT OUT (Mikey)"]
sevs = ["HIGH", "MED", "LOW", "—"]
print("| Status | " + " | ".join(sevs) + " | Total |")
for s in statuses:
    n = [table[(s, v)] for v in sevs]
    print(f"| {s} | " + " | ".join(str(x) for x in n) + f" | {sum(n)} |")
tot = [sum(table[(s, v)] for s in statuses) for v in sevs]
print("| All rows | " + " | ".join(str(x) for x in tot) + f" | {sum(tot)} |")
print("ANDROID RISK rows:", sum(1 for r in rows if r[5]))
other = [r for r in rows if r[3] not in statuses or r[4] not in sevs]
for r in other:
    print("UNCOUNTED:", r[0], r[3], r[4])
