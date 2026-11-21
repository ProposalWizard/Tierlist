"""Words the packed app shows that KIB Next's counterpart does not (a first pass for inventory/CAREER.md).

    python3 phone/tools/playtest/inventory/textdiff.py <packed.tsx[,more.tsx]> <kib.tsx[,more.tsx]>

Pulls JSX text (>Text<) and capitalised string literals out of both sides, normalises them
(lower case, letters and spaces only) and prints the packed ones KIB Next has nowhere.
A hint, not a verdict: KIB Next may build the same words from parts, or take them from lib/star.
"""
import re
import sys


def texts(paths):
    out = set()
    for p in paths:
        s = open(p).read()
        s = re.sub(r"/\*.*?\*/", "", s, flags=re.S)
        s = re.sub(r"^\s*//.*$", "", s, flags=re.M)
        for m in re.finditer(r">([^<>{}\n]{4,})<", s):
            out.add(m.group(1).strip())
        for m in re.finditer(r'"([A-Z][a-z][^"\n]{5,})"', s):
            out.add(m.group(1).strip())
        for m in re.finditer(r"`([A-Z][a-z][^`\n]{5,})`", s):
            out.add(m.group(1).strip())
    return {t for t in out if re.search(r"[a-z]{3}", t) and not re.search(r"className|=>|\(\)|import|\.tsx?$", t)}


def norm(t):
    return re.sub(r"[^a-z ]", "", t.lower().replace("&apos;", "'")).strip()


a = texts(sys.argv[1].split(","))
b = texts(sys.argv[2].split(","))
bn = {norm(t) for t in b}
blob = " ".join(bn)
for t in sorted(a):
    n = norm(t)
    if n and n not in bn and n[:25] not in blob:
        print(t)
