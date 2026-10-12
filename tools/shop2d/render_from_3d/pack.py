"""PNG renders → WebP stills. python3 pack.py <pngDir> <outDir>"""
import glob, os, sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for f in sorted(glob.glob(src + "/*.png")):
    name = os.path.basename(f)[:-4].replace("-ALL", "")
    Image.open(f).convert("RGBA").save(f"{out}/{name}.webp", "WEBP", quality=80, method=4)
    print(name)
