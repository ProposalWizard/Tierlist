import json, re, os, time, urllib.request, urllib.parse
from PIL import Image
UA = "KnowitballKitResearch/1.0 (knowitballcontact@gmail.com)"
raw = json.load(open("raw.json"))
def field(text, key):
    m = re.search(r"\|\s*" + re.escape(key) + r"\s*=\s*([^\n|]*)", text)
    if not m: return ""
    v = re.sub(r"<!--.*?-->", "", m.group(1)).strip()
    return v
import hashlib
def fetch_img(name):
    p = "img/" + name
    if os.path.exists(p): return p if os.path.getsize(p) > 0 else None
    if os.environ.get("OFFLINE"): return None
    fn = name.replace(" ", "_")
    h = hashlib.md5(fn.encode()).hexdigest()
    for repo in ("commons", "en"):
        url = f"https://upload.wikimedia.org/wikipedia/{repo}/{h[0]}/{h[:2]}/" + urllib.parse.quote(fn)
        for a in range(4):
            try:
                d = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read()
                open(p, "wb").write(d); return p
            except urllib.error.HTTPError as e:
                if e.code == 404: break
                time.sleep(5 * (a + 1))
            except Exception:
                time.sleep(5 * (a + 1))
    open(p, "wb").close(); return None
PARTS_ORDERED = None
PARTS = [("la", "leftarm", "Kit_left_arm", (0, 0), (31, 59)), ("b", "body", "Kit_body", (31, 0), (38, 59)),
         ("ra", "rightarm", "Kit_right_arm", (69, 0), (31, 59)), ("sh", "shorts", "Kit_shorts", (0, 59), (100, 36)),
         ("so", "socks", "Kit_socks", (0, 95), (100, 40))]
def hexc(v):
    v = v.strip().lstrip("#")
    return "#" + v.upper() if re.fullmatch(r"[0-9A-Fa-f]{6}", v) else None
def compose(text, n):
    kit = {}; layers = {}
    canvas = Image.new("RGBA", (100, 135), (255, 255, 255, 255))
    for code, colkey, prefix, pos, size in sorted(PARTS, key=lambda p: p[0] != "b"):
        col = hexc(field(text, f"{colkey}{n}"))
        pat = field(text, f"pattern_{code}{n}")
        kit[colkey] = col; kit["pattern_" + code] = pat
        if not col and code in ("la", "ra") and kit.get("body"):
            col = kit["body"]  # a sleeve with no colour and no picture: the shirt's colour
        layer = Image.new("RGBA", size, tuple(int(col[i:i+2], 16) for i in (1, 3, 5)) + (255,) if col else (255, 255, 255, 255))
        if pat:
            pp = fetch_img(f"{prefix}{pat}.png")
            if not pp and code == "ra":
                lp = fetch_img(f"Kit_left_arm{pat}.png")
                if lp:
                    from PIL import ImageOps
                    os.makedirs("mirror", exist_ok=True)
                    pp = f"mirror/Kit_right_arm{pat}.png"
                    ImageOps.mirror(Image.open(lp).convert("RGBA")).save(pp)
            if pp:
                try:
                    im = Image.open(pp).convert("RGBA").resize(size)
                    layer.alpha_composite(im)
                except Exception: kit["bad_" + code] = pat
            else: kit["missing_" + code] = pat
        base = fetch_img(("Kit_socks_long.png" if code == "so" else prefix + ".png"))
        canvas.alpha_composite(layer, pos)
        layers[code] = (layer.copy(), Image.open(base).convert('RGBA').resize(size) if base else None)
        if base:
            canvas.alpha_composite(Image.open(base).convert("RGBA").resize(size), pos)
    return kit, canvas, layers
os.makedirs("kitimg", exist_ok=True)
res = {}
for name, r in raw.items():
    t = r.get("text")
    if not t: res[name] = None; continue
    res[name] = {"title": r["title"]}
    for n, side in ((1, "home"), (2, "away")):
        kit, im, _ = compose(t, n)
        res[name][side] = kit
        im.save(f"kitimg/{name.replace('/', '_')}_{side}.png")
    print(name, flush=True)
json.dump(res, open("kits_parsed.json", "w"), indent=1)
