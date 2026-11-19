"""
The world screens' pictures, copied from the website's public/ into
phone/assets/look, and the map the screens read them through
(phone/src/ui/look/worldPics.ts). Run from the repo root:

    python3 phone/tools/look/make-world-pics.py          # copy + write the map
    python3 phone/tools/look/make-world-pics.py --map    # only rewrite the map

- Shop: public/star/shop2d/items/<name>.webp (1440x1080 renders) -> 640x480,
  WebP 78 (the phone shows them at most ~360 px wide).
- Star Pass: public/star/star-pass/*.webp as they are, except the two moving
  run-up pictures (reward-penalty, reward-slow-runup) kept as their first frame
  (nothing moves at rest) and reward-car.webp (1.2 MB, no reward uses it).
"""
import glob
import os
import sys

from PIL import Image

ROOT = os.getcwd()
SHOP_SRC = os.path.join(ROOT, "public/star/shop2d/items")
PASS_SRC = os.path.join(ROOT, "public/star/star-pass")
SHOP_OUT = os.path.join(ROOT, "phone/assets/look/shop")
PASS_OUT = os.path.join(ROOT, "phone/assets/look/starpass")
MAP = os.path.join(ROOT, "phone/src/ui/look/worldPics.ts")


def copy():
    os.makedirs(SHOP_OUT, exist_ok=True)
    os.makedirs(PASS_OUT, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(SHOP_SRC, "*.webp"))):
        im = Image.open(f).convert("RGBA").resize((640, 480), Image.LANCZOS)
        im.save(os.path.join(SHOP_OUT, os.path.basename(f)), "WEBP", quality=78, method=6)
    for f in sorted(glob.glob(os.path.join(PASS_SRC, "*.webp"))):
        b = os.path.basename(f)
        if b == "reward-car.webp":
            continue
        im = Image.open(f)
        im.seek(0)
        im.convert("RGBA").save(os.path.join(PASS_OUT, b), "WEBP", quality=82, method=6)


def write_map():
    shop = sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(SHOP_OUT, "*.webp")))
    pas = sorted(os.path.basename(f) for f in glob.glob(os.path.join(PASS_OUT, "*.webp")))
    out = [
        "// Written by phone/tools/look/make-world-pics.py: do not edit by hand.",
        "// The shop's item stills and the Star Pass art, copied from the website's public/.",
        'import type { ImageSourcePropType } from "react-native";',
        "",
        "/** Shop stills by name (ShowroomShop bigName: boot-<base>-L<n>, <base>-L<n>, phone-L1). */",
        "export const SHOP_PIC: Record<string, ImageSourcePropType> = {",
    ]
    out += [f'  "{n}": require("../../../assets/look/shop/{n}.webp"),' for n in shop]
    out += ["};", "", "/** Star Pass art by the website's path (/star/star-pass/<file>). */",
            "export const STAR_PASS_PIC: Record<string, ImageSourcePropType> = {"]
    out += [f'  "/star/star-pass/{n}": require("../../../assets/look/starpass/{n}"),' for n in pas]
    out += ["};", ""]
    with open(MAP, "w") as fh:
        fh.write("\n".join(out))
    print(f"{len(shop)} shop, {len(pas)} star pass -> {MAP}")


if __name__ == "__main__":
    if "--map" not in sys.argv:
        copy()
    write_map()
