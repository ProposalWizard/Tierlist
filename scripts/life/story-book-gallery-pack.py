"""Packs story-book-gallery.mjs's captures into the page's files and writes gallery.json.
Run by story-book-gallery.mjs:  python3 story-book-gallery-pack.py <raw> <page> <shots folder> <public/star/life>"""
import json, os, sys
from PIL import Image

RAW, PAGE, OUT, PUB = sys.argv[1:5]
L = json.load(open(os.path.join(RAW, "list.json")))
SH = os.path.join(PAGE, "shots")


def sheet(files, cw, ch, cols, name, bg=(5, 7, 13), q=72):
    rows = (len(files) + cols - 1) // cols
    cols = min(cols, len(files))
    S = Image.new("RGB", (cols * cw, rows * ch), bg)
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGBA")
        im.thumbnail((cw, ch), Image.LANCZOS)
        S.paste(im, ((i % cols) * cw + (cw - im.width) // 2, (i // cols) * ch + (ch - im.height) // 2), im)
    S.save(os.path.join(SH, name), "WEBP", quality=q, method=6)
    def pos(i):
        c, r = i % cols, i // cols
        return {"img": f"shots/{name}", "ratio": f"{cw} / {ch}", "size": f"{cols * 100}% {rows * 100}%", "pos": f"{c / (cols - 1) * 100 if cols > 1 else 0}% {r / (rows - 1) * 100 if rows > 1 else 0}%"}
    return pos


gal = []
# The People page and the cast sheet: phone screens.
files = L["pp"] + [L["castF"]]
pos = sheet(files, 390, 844, 4, "gallery-people.webp")
items = [{"title": f"People page, part {i + 1}", "cap": "A lived-in sample career: who you know, with their faces and bars.", **pos(i)} for i in range(len(L["pp"]))]
items.append({"title": "Every role's face", "cap": "As the story screens draw each role today: a still where one exists, else the drawn tile.", **pos(len(L["pp"]))})
gal.append({"title": "People as the game draws them", "note": "The game's own People page and story faces, from the living-world test page. Family, staff, press and the agent have no pictures yet: the game shows a drawn tile for each.", "items": items})

# The pooled people in the 3D toon renderer.
looks = [lk for lk in L["portrait"]]
if looks:
    pos = sheet([L["portrait"][lk] for lk in looks], 300, 450, 4, "gallery-portraits.webp", bg=(22, 30, 27))
    items = []
    for i, lk in enumerate(looks):
        who = [p for p in L["pool"] if p["look"] == lk]
        items.append({"title": ", ".join(p["name"] for p in who), "cap": "; ".join(f"{p['role']}, {p['age']}" for p in who) + f". Look preset {lk}, drawn by the game's 3D toon renderer.", **pos(i)})
    gal.append({"title": "The pooled people in 3D", "note": "Each career gets one person per role from a pool. These are their looks as the game's 3D people renderer draws them (the same renderer that made the kit man's stills). People who share a look preset share a picture.", "items": items})

# The place stills that exist.
items = []
for rel, title, cap in [
    ("kitman/bg-garden-dusk.webp", "Pitch two at dusk (empty)", "Behind every training-ground talk with no still of its own."),
    ("kitman/bg-garden-van.webp", "By the van (empty)", "The van, the soup scenes."),
    ("kitman/bg-garden.webp", "Pitch two by day (empty)", ""),
    ("kitman/bg-stadium-night.webp", "The stadium at night (empty)", "Behind stadium scenes and cards."),
    ("kitman/bg-stadium.webp", "The stadium (empty)", ""),
    ("kitman/pitch2-den.webp", "Pitch two, with Den", "Only Den (one kit man of four) has his own stills."),
    ("kitman/pitch2-kid.webp", "Pitch two, with the kid", "A hundred balls, beat 7."),
    ("kitman/van-den.webp", "The van, with Den", ""),
    ("kitman/stadium-den.webp", "The stadium, with Den", ""),
    ("kitman/corridor-gaffer.webp", "The corridor, with the gaffer", "A hundred balls, beat 2 (the tone dial)."),
    ("still-bench-group.webp", "The bench, a group", "Behind the round menu with a team-mate."),
    ("still-bench-talk.webp", "The bench, a talk", "Behind a Telltale talk with a team-mate."),
]:
    f = os.path.join(PUB, rel)
    if not os.path.exists(f):
        continue
    im = Image.open(f).convert("RGB")
    im.thumbnail((780, 1100), Image.LANCZOS)
    name = "gallery-place-" + os.path.basename(rel).replace(".webp", "") + ".webp"
    im.save(os.path.join(SH, name), "WEBP", quality=72, method=6)
    items.append({"title": title, "cap": cap + f" (public/star/life/{rel})", "img": f"shots/{name}", "wide": True})
gal.append({"title": "Places: the stills that exist", "note": "The pictures the story screens put behind a talk, as they are in the game today. Every other place in the stories (the canteen, home, the car, the chairman's office, town) has no picture yet: the screens show these or a plain colour.", "items": items})
json.dump(gal, open(os.path.join(OUT, "gallery.json"), "w"), indent=1)
print(f"gallery: {sum(len(g['items']) for g in gal)} pictures")
