"""How much JavaScript /star-dev needs before it can run (speed job D).

Reads .next/app-build-manifest.json after a build and adds up every JS file
the page and its layouts list (the "first load"), raw and gzipped. Also says
whether three.js (WebGLRenderer) is in any of them.

    python3 scripts/perf2d/first-load.py [.next] [route]
"""
import gzip, json, os, sys

dist = sys.argv[1] if len(sys.argv) > 1 else ".next"
route = sys.argv[2] if len(sys.argv) > 2 else "/star-dev/page"
man = json.load(open(os.path.join(dist, "app-build-manifest.json")))["pages"]
files = set()
for key, fl in man.items():
    if key == route or (key.endswith("/layout") and route.startswith(key[: -len("layout")])):
        files.update(f for f in fl if f.endswith(".js"))
raw = gz = 0
three = []
for f in sorted(files):
    b = open(os.path.join(dist, f), "rb").read()
    raw += len(b)
    gz += len(gzip.compress(b, 6))
    if b"THREE.WebGLRenderer: Context Lost" in b:
        three.append(f)
all_js = []
for root, _, names in os.walk(os.path.join(dist, "static", "chunks")):
    for n in names:
        if n.endswith(".js"):
            all_js.append(os.path.join(root, n))
print(json.dumps({
    "route": route, "files": len(files), "rawKB": round(raw / 1024), "gzipKB": round(gz / 1024),
    "threeInFirstLoad": three,
    "allClientChunks": len(all_js),
}, indent=1))
