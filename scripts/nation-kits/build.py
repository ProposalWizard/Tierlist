"""Turn analysed.json (+ corrections.json, checked by eye) into the game's file."""
import json, os, sys
exec(open("analyze.py").read().split("if __name__")[0])
an = json.load(open("analysed.json"))
names = json.load(open("nations.json"))
corr = json.load(open("corrections.json")) if os.path.exists("corrections.json") else {}
def snap(h, box):
    """The infobox's exact colour when the picture's colour is that colour."""
    if box and h and dE(rgb(h), rgb(box)) < 15: return box
    return h
out = {}
for fifa, a in an.items():
    game = names.get(fifa, fifa)
    if not a: continue
    rec = {"source": "https://en.wikipedia.org/wiki/" + a["title"].replace(" ", "_")}
    notes = []
    for side in ("home", "away"):
        k = a[side]; box = k["infobox"]; c = corr.get(fifa, {}).get(side, {})
        shirt = c.get("shirtHex") or snap(k["shirt"], box.get("body"))
        trim = c.get("trimHex") or k["trim"]
        sleeves = c.get("sleevesHex") or snap(k["sleeves"], box.get("leftarm"))
        shorts = c.get("shortsHex") or snap(k["shorts"], box.get("shorts"))
        socks = c.get("socksHex") or snap(k["socks"], box.get("socks"))
        nm = lambda h: name(rgb(h)).title() if h else None
        kit = {
            "shirt": c.get("shirt") or nm(shirt), "trim": c.get("trim") or nm(trim),
            "pattern": c.get("pattern") or k["words"],
            "shirtHex": shirt, "trimHex": trim,
            "sleeves": nm(sleeves), "sleevesHex": sleeves,
            "shorts": c.get("shorts") or nm(shorts), "shortsHex": shorts,
            "socks": c.get("socks") or nm(socks), "socksHex": socks,
        }
        rec[side + "Kit"] = {k2: v for k2, v in kit.items() if v}
        if c: notes.append(side)
        if c.get("note", "").startswith("Wikipedia shows no"): rec["checked_note"] = f"{side.title()}: {c['note']}"
    if notes: rec["checked"] = "Fixed by eye: " + " and ".join(notes) + (". " + rec.pop("checked_note") if "checked_note" in rec else "")
    out[game] = rec
doc = {
    "_about": "Every nation's current home and away kit, 13 Oct 2026. Source: each national team's Wikipedia page kit box (colours per sleeve, shirt, shorts, socks, and the kit design pictures from Wikimedia Commons). Read by scripts/nation-kits/analyze.py (shirt colour, second colour, pattern), then every kit checked by eye against the real picture; corrections carry a 'checked' note. Read through lib/star/data/nationKits.ts.",
    "nations": dict(sorted(out.items())),
}
json.dump(doc, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
print(len(out), "nations")
