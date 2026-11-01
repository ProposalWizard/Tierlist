"""Renders from render_pass_rewards_more.py -> the road's WebP stills and
lib/star/starPassArtData.ts (each still's podium share and height).

  python3 tools/star-pass-art/build_stills.py <frames_dir>

Medium podiums come out 430 px wide, great ones 520 px (make_webp.py's
PODIUM_W), the same as the 25 Oct 2026 rewards, so every podium on the road
is drawn the same size.
"""
import glob, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
src = sys.argv[1]
GREAT = {"boots-blackout", "boots-volt", "boots-gold"}

rows = {}
for f in sorted(glob.glob(os.path.join(src, "*-000.png"))):
    job = os.path.basename(f)[:-8]
    out = os.path.join(ROOT, "public/star/star-pass", f"reward-{job}.webp")
    env = dict(os.environ, PODIUM_W="520" if job in GREAT else "430", Q="82")
    res = subprocess.run([sys.executable, os.path.join(HERE, "make_webp.py"), src, job, out, "1"],
                         env=env, capture_output=True, text=True, check=True).stdout
    m = re.search(r"\((\d+), (\d+)\).*podium/picture width = ([\d.]+)", res)
    w, h, fit = int(m.group(1)), int(m.group(2)), float(m.group(3))
    rows[job] = (fit, h / w)
    print(res.strip())

lines = [
    "// Made by tools/star-pass-art/build_stills.py: do not edit by hand.",
    "// job -> [podium width / picture width, picture height / width]",
    "export const PASS_STILLS: Record<string, [number, number]> = {",
]
lines += [f'  "{k}": [{v[0]:.3f}, {v[1]:.4f}],' for k, v in rows.items()]
lines += ["};", ""]
with open(os.path.join(ROOT, "lib/star/starPassArtData.ts"), "w") as fh:
    fh.write("\n".join(lines))
print("wrote lib/star/starPassArtData.ts with", len(rows), "stills")
