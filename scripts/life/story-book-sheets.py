"""THE STORY BOOK'S SHEETS: packs each story's screenshots (scripts/life/story-book-shots.mjs) into
ONE picture per story, so the page stays inside the artifact's file limits (511 files in all).

Run:  python3 scripts/life/story-book-sheets.py <shots folder> <page folder>
Reads <shots>/stories/<slug>.json and <shots>/raw/<slug>/*.jpg. Writes:
  <page>/shots/<slug>.webp      every shot of the story, 360 x 779 each, 4 to a row (80 a sheet)
  <page>/shots/<slug>-full.webp the same at full phone size (780 x 1688), big stories only (36 a sheet)
  <page>/shots.json             per story: the sheet, the grid, and what each shot shows
The page crops one shot out of a sheet with CSS (a background position), so a story's shots cost
one download, and only when its card is opened.
"""
import json, os, sys
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
W, H = 360, 779          # one cell (a 390 x 844 phone at 0.92)
FW, FH = 780, 1688       # full size
COLS = 4
BIG = {"big", "unspecified"}
os.makedirs(os.path.join(DST, "shots"), exist_ok=True)

out = {"cell": [W, H], "full": [FW, FH], "cols": COLS, "stories": {}}
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

    sheets, size = pack(W, H, 80, "", 70)
    fulls, fsize = pack(FW, FH, 36, "-full", 62) if big else ([], 0)
    shots = []
    for i, (fn, s, more) in enumerate(cells):
        shots.append({"i": i, "beat": s.get("beat"), "kind": s["kind"] + ("-scrolled" if more else ""), "node": s.get("node"),
                      "chose": s.get("chose"), "alt": s.get("alt"), "mode": s.get("mode"), "screen": s.get("screen"),
                      "template": s.get("template"), "probs": s.get("probs", []), "note": s.get("note"), "replies": s.get("replies")})
    total += size + fsize
    out["stories"][slug] = {"id": rec["id"], "size": rec["size"], "waiting": rec["waiting"], "notes": rec["notes"], "consoleErrors": rec["consoleErrors"],
                            "sheets": sheets, "fulls": fulls, "kb": round(size / 1024), "fullKb": round(fsize / 1024), "shots": shots}
    print(f"{slug}: {len(cells)} cells, {size // 1024} KB" + (f", full {fsize // 1024} KB" if fsize else ""))
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
