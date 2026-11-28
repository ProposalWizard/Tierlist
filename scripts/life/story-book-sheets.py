"""THE STORY BOOK'S SHEETS: packs each story's screenshots (scripts/life/story-book-shots.mjs) into
ONE picture per story, so the page stays inside the artifact's file limits (511 files in all).

Run:  python3 scripts/life/story-book-sheets.py <shots folder> <page folder>
Reads <shots>/stories/<slug>.json and <shots>/raw/<slug>/*.jpg. Writes:
  <page>/shots/<slug>.webp      every shot of the story, 480 x 1039 each, 3 to a row, 12 a sheet (-2, -3 …)
  <page>/shots/tiles-N.webp     the home grid's tiles, 36 to a sheet (the grid loads only these)
  <page>/shots.json             per story: the sheet, the grid, and what each shot shows
The page crops one shot out of a sheet with CSS (a background position), so a story's shots cost
one download, and only when its card is opened.
"""
import json, os, sys
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
W, H = 480, 1039         # one cell (a 390 x 844 phone at 1.23x: sharp when enlarged on a phone)
COLS = 3
PER = 12                 # 12 cells a sheet (1440 x 4156): small enough for a phone to decode
TW, TH = 300, 400        # a story's tile on the home grid (a 3:4 crop of its first screen)
TCOLS, TPER = 6, 36
BIG = {"big", "unspecified"}
os.makedirs(os.path.join(DST, "shots"), exist_ok=True)

out = {"cell": [W, H], "cols": COLS, "stories": {}}
tiles = []
total = 0
for f in sorted(os.listdir(os.path.join(SRC, "stories"))):
    rec = json.load(open(os.path.join(SRC, "stories", f)))
    slug = rec["slug"]
    cells = []
    for s in rec["shots"]:
        cells.append((s["file"], s, False))
        if s.get("more"):
            cells.append((s["more"], s, True))
    if not cells:
        out["stories"][slug] = {**{k: rec[k] for k in ("id", "size", "waiting", "notes", "consoleErrors")}, "shots": []}
        continue
    big = rec["size"] in BIG

    def pack(cw, ch, per, suffix, q):
        """Cells into sheets of at most `per` cells (a WebP side is at most 16383 pixels)."""
        files, kb = [], 0
        for k in range(0, len(cells), per):
            part = cells[k:k + per]
            cols = min(COLS, len(part)); rows = (len(part) + COLS - 1) // COLS
            sheet = Image.new("RGB", (cols * cw, rows * ch), (5, 7, 13))
            for i, (fn, _s, _m) in enumerate(part):
                im = Image.open(os.path.join(SRC, "raw", slug, fn)).convert("RGB")
                if im.size != (cw, ch):
                    im = im.resize((cw, ch), Image.LANCZOS)
                sheet.paste(im, ((i % cols) * cw, (i // cols) * ch))
            name = f"shots/{slug}{suffix}{'' if k == 0 else '-' + str(k // per + 1)}.webp"
            sheet.save(os.path.join(DST, name), "WEBP", quality=q, method=6)
            kb += os.path.getsize(os.path.join(DST, name))
            files.append({"file": name, "cols": cols, "rows": rows, "from": k, "count": len(part)})
        return files, kb

    sheets, size = pack(W, H, PER, "", 72)
    fulls, fsize = [], 0
    first = next((fn for fn, x, m in cells if x["kind"] in ("open", "invite") and not m), cells[0][0])
    tiles.append((slug, os.path.join(SRC, "raw", slug, first)))
    shots = []
    for i, (fn, s, more) in enumerate(cells):
        shots.append({"i": i, "beat": s.get("beat"), "kind": s["kind"] + ("-scrolled" if more else ""), "node": s.get("node"),
                      "chose": s.get("chose"), "alt": s.get("alt"), "mode": s.get("mode"), "screen": s.get("screen"),
                      "template": s.get("template"), "probs": s.get("probs", []), "note": s.get("note"), "replies": s.get("replies")})
    total += size + fsize
    out["stories"][slug] = {"id": rec["id"], "size": rec["size"], "waiting": rec["waiting"], "notes": rec["notes"], "consoleErrors": rec["consoleErrors"],
                            "sheets": sheets, "fulls": fulls, "kb": round(size / 1024), "fullKb": round(fsize / 1024), "shots": shots}
    print(f"{slug}: {len(cells)} cells, {size // 1024} KB" + (f", full {fsize // 1024} KB" if fsize else ""))
# The home grid's tiles: one 3:4 crop of each story's first screen, 36 to a sheet.
out["tiles"] = {}
for k in range(0, len(tiles), TPER):
    part = tiles[k:k + TPER]
    cols = min(TCOLS, len(part)); rows = (len(part) + TCOLS - 1) // TCOLS
    sheet = Image.new("RGB", (cols * TW, rows * TH), (5, 7, 13))
    for i, (slug, f) in enumerate(part):
        im = Image.open(f).convert("RGB")
        y0 = int(im.height * 0.40)
        crop = im.crop((0, y0, im.width, min(im.height, y0 + int(im.width * 4 / 3)))).resize((TW, TH), Image.LANCZOS)
        sheet.paste(crop, ((i % cols) * TW, (i // cols) * TH))
        out["tiles"][slug] = {"file": f"shots/tiles-{k // TPER + 1}.webp", "cols": cols, "rows": rows, "c": i % cols, "r": i // cols}
    sheet.save(os.path.join(DST, "shots", f"tiles-{k // TPER + 1}.webp"), "WEBP", quality=70, method=6)
    total += os.path.getsize(os.path.join(DST, "shots", f"tiles-{k // TPER + 1}.webp"))

# Totals for the page, and the hand-written parts: what was seen wrong on screen (problems.json),
# the people and places pictures (gallery.json, made by story-book-gallery.mjs), stories with no shots.
out["total"] = sum(len(v["shots"]) for v in out["stories"].values())
out["storiesSeen"] = sum(1 for v in out["stories"].values() if v["shots"])
out["beatsSeen"] = sum(len({x["beat"] for x in v["shots"] if x["beat"]}) for v in out["stories"].values())
for extra in ("problems", "gallery", "missing", "problemsLead"):
    fp = os.path.join(SRC, f"{extra}.json")
    if os.path.exists(fp):
        out[extra] = json.load(open(fp))
if "gallery" in out:
    for g in out["gallery"]:
        for it in g["items"]:
            out["total"] += 1
json.dump(out, open(os.path.join(DST, "shots.json"), "w"), separators=(",", ":"))
print(f"{len(out['stories'])} stories, {total / 1048576:.1f} MB of pictures")
