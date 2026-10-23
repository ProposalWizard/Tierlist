#!/usr/bin/env python3
"""
THE SKIN SHEET (Harry, 23 Oct 2026: "we have got to fix this skin colour issue
on the 3d guys"). Reads the pictures scripts/bench3d/skin.mjs (the card's man)
and skin-garden.mjs (the 3D garden) wrote, finds each skin region through the
probe picture (face magenta, neck cyan, upper arm yellow, forearm green, hand
blue), and measures the real picture there:

  med   the region's median colour
  dE    how far that is from the tone picked in Settings -> Your look (CIE76;
        under ~10 reads as the same skin under light)
  p90   how patchy the region is: 90% of its pixels are within this dE of
        its own median (blotches and pale rims push it up)

Writes one contact sheet (every tone x each view: the render, then a swatch
per region with its dE) and the numbers as JSON.

  python3 scripts/bench3d/skin_sheet.py DIR OUT.png [--cards=h2,h4] [--garden=h4] [--title=...]
"""
import colorsys
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

TONES = [("porcelain", "#f7dcc4"), ("fair", "#eec095"), ("light", "#d4a373"), ("tan", "#c68642"),
         ("olive", "#a9714b"), ("brown", "#8d5524"), ("deep", "#6b3d1f"), ("dark", "#4a2b18")]
REGIONS = [("face", 300), ("neck", 180), ("upper arm", 60), ("forearm", 120), ("hand", 240)]


def lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    l = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    x = (l[..., 0] * 0.4124 + l[..., 1] * 0.3576 + l[..., 2] * 0.1805) / 0.95047
    y = l[..., 0] * 0.2126 + l[..., 1] * 0.7152 + l[..., 2] * 0.0722
    z = (l[..., 0] * 0.0193 + l[..., 1] * 0.1192 + l[..., 2] * 0.9505) / 1.08883
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.stack([116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))], -1)


def hexrgb(h):
    return [int(h[i:i + 2], 16) for i in (1, 3, 5)]


def regions(probe, pic):
    """Each region's mask from the probe picture, by hue, shrunk by a pixel (no edge pixels). Only
    where the probe changed the picture (the garden's grass and sky are the same in both)."""
    p = np.asarray(probe.convert("RGB"), dtype=np.float64) / 255.0
    changed = np.abs(p - np.asarray(pic.convert("RGB"), dtype=np.float64) / 255.0).sum(-1) > 0.25
    mx, mn = p.max(-1), p.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = p[..., 0], p[..., 1], p[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    ok = (sat > 0.45) & (mx > 0.25) & changed
    out = {}
    for name, h in REGIONS:
        dh = np.abs((hue - h + 180) % 360 - 180)
        m = ok & (dh < 25)
        e = m.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            e &= np.roll(np.roll(m, dy, 0), dx, 1)
        out[name] = e
    return out


def measure(pic, probe, tone_hex):
    img = np.asarray(pic.convert("RGB"), dtype=np.float64)
    if probe.size != pic.size:
        probe = probe.resize(pic.size, Image.NEAREST)
    want = lab(hexrgb(tone_hex))
    res = {}
    for name, m in regions(probe, pic).items():
        n = int(m.sum())
        if n < 12:
            continue
        px = img[m]
        med = np.median(px, 0)
        L = lab(px)
        spread = np.linalg.norm(L - lab(med), axis=-1)
        res[name] = {"n": n, "med": [int(round(v)) for v in med],
                     "dE": round(float(np.linalg.norm(lab(med) - want)), 1),
                     "p90": round(float(np.percentile(spread, 90)), 1)}
    if "face" in res and "forearm" in res:
        res["faceVsArm"] = round(float(np.linalg.norm(lab(res["face"]["med"]) - lab(res["forearm"]["med"]))), 1)
    if "face" in res and "neck" in res:
        res["faceVsNeck"] = round(float(np.linalg.norm(lab(res["face"]["med"]) - lab(res["neck"]["med"]))), 1)
    return res


def main():
    d, out = sys.argv[1], sys.argv[2]
    flags = dict(a[2:].split("=", 1) for a in sys.argv[3:] if a.startswith("--"))
    cards = [h for h in flags.get("cards", "h2,h4").split(",") if h]
    garden = [h for h in flags.get("garden", "h4").split(",") if h]
    title = flags.get("title", "Skin sheet")
    views = [("card " + h, f"card-{h}-{{t}}.png", f"card-{h}-{{t}}-probe.png") for h in cards]
    views += [("garden " + h, f"close-{h}-{{t}}.png", f"close-{h}-{{t}}-probe.png") for h in garden]
    numbers = {}
    TH, SW = 150, 46
    col_w = TH + len(REGIONS) * (SW + 4) + 16
    W, H = 110 + col_w * len(views), 40 + 24 + len(TONES) * (TH + 10)
    sheet = Image.new("RGB", (W, H), (11, 18, 32))
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        big = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except OSError:
        font = big = ImageFont.load_default()
    dr.text((10, 10), title, fill=(255, 255, 255), font=big)
    for vi, (vname, _, _) in enumerate(views):
        x0 = 110 + vi * col_w
        dr.text((x0, 40), vname, fill=(255, 255, 255), font=font)
        for ri, (rn, _) in enumerate(REGIONS):
            dr.text((x0 + TH + 6 + ri * (SW + 4), 40), rn.split(" ")[-1][:7], fill=(200, 200, 200), font=font)
    for ti, (tn, th) in enumerate(TONES):
        y0 = 64 + ti * (TH + 10)
        dr.text((10, y0), tn, fill=(255, 255, 255), font=font)
        dr.rectangle((10, y0 + 18, 90, y0 + 58), fill=tuple(hexrgb(th)))
        dr.text((10, y0 + 62), "picked", fill=(160, 160, 160), font=font)
        for vi, (vname, pf, prf) in enumerate(views):
            x0 = 110 + vi * col_w
            pp, prp = os.path.join(d, pf.format(t=tn)), os.path.join(d, prf.format(t=tn))
            if not (os.path.exists(pp) and os.path.exists(prp)):
                continue
            pic, probe = Image.open(pp), Image.open(prp)
            m = measure(pic, probe, th)
            numbers.setdefault(vname, {})[tn] = m
            # the render: a card's whole square; the garden close view cropped to head and arms
            src = pic.convert("RGBA")
            if vname.startswith("garden"):
                pr = probe.resize(pic.size, Image.NEAREST) if probe.size != pic.size else probe
                rg = np.argwhere(np.any(list(regions(pr, pic).values()), axis=0))
                if len(rg):
                    (ya, xa), (yb, xb) = rg.min(0), rg.max(0)
                    s = max(yb - ya, xb - xa) + 20
                    cx, cy = (xa + xb) // 2, (ya + yb) // 2
                    src = src.crop((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2))
            bg = Image.new("RGBA", src.size, (42, 51, 70, 255))
            bg.alpha_composite(src)
            sheet.paste(bg.convert("RGB").resize((TH, TH), Image.LANCZOS), (x0, y0))
            for ri, (rn, _) in enumerate(REGIONS):
                sx = x0 + TH + 6 + ri * (SW + 4)
                r = m.get(rn)
                dr.rectangle((sx, y0 + 18, sx + SW, y0 + 18 + SW), fill=tuple(r["med"]) if r else (11, 18, 32), outline=(80, 90, 110))
                dr.rectangle((sx + SW // 2 - 8, y0 + 18 + SW + 3, sx + SW // 2 + 8, y0 + 18 + SW + 9), fill=tuple(hexrgb(th)))
                if r:
                    dr.text((sx, y0 + 18 + SW + 12), f"dE {r['dE']:.0f}", fill=(255, 255, 255), font=font)
                    dr.text((sx, y0 + 18 + SW + 26), f"p90 {r['p90']:.0f}", fill=(170, 170, 170), font=font)
            if "faceVsArm" in m:
                dr.text((x0 + TH + 6, y0 + TH - 14), f"face vs arm dE {m['faceVsArm']:.0f}   face vs neck dE {m.get('faceVsNeck', 0):.0f}", fill=(250, 210, 120), font=font)
    sheet.save(out)
    with open(os.path.splitext(out)[0] + ".json", "w") as f:
        json.dump(numbers, f, indent=1)
    for v, rows in numbers.items():
        print(v)
        for tn, m in rows.items():
            print(f"  {tn:9s}", " ".join(f"{k[:5]}={m[k]['med']} dE{m[k]['dE']:.0f}/p{m[k]['p90']:.0f}" for k, _ in REGIONS if k in m), f"| face-arm {m.get('faceVsArm', '-')} face-neck {m.get('faceVsNeck', '-')}")


if __name__ == "__main__":
    main()
