#!/usr/bin/env python3
"""Mikey v0.20 · Harry's review + the changes built from it. python3 build.py -> index.html (+ img/)"""
import os, glob, shutil, json
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)) + "/"
MT = os.path.dirname(D.rstrip("/")) + "/"          # scratchpad/mikeytab/
SP = os.path.dirname(MT.rstrip("/")) + "/"          # scratchpad/
KF = "/home/user/Tierlist/playtest-notes/mikeyreview-0930/keyframes/"

src = open(SP + "pn16/build.py").read()
src = src[: src.index("P = []  # page parts")]
src = src.replace('D = os.path.dirname(os.path.abspath(__file__)) + "/"', f'D = "{D}"').replace('SP = os.path.dirname(D.rstrip("/"))', f'SP = "{SP.rstrip("/")}"')
ns = {"__file__": D + "build.py"}; exec(src, ns)
HEAD = ns["HEAD"].replace("Knowitball v0.16", "Mikey v0.20 · Harry's review")
EXTRA_CSS, det, h2 = ns["EXTRA_CSS"], ns["det"], ns["h2"]

CSS = """<style>
.area{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:14px 15px;margin:14px 0}
.area h3{margin:0 0 4px;font-size:18px}
.st{display:inline-block;font:800 11px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:5px 9px;border-radius:999px;margin-left:6px;vertical-align:2px}
.st.done{background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green)}
.st.wip{background:color-mix(in srgb,var(--amber) 18%,transparent);color:var(--amber)}
.st.dec{background:color-mix(in srgb,var(--red) 13%,transparent);color:var(--red)}
.chg{list-style:none;margin:8px 0 0;padding:0}
.chg>li{padding:9px 0;border-bottom:1px solid var(--line)} .chg>li:last-child{border-bottom:0}
.chg b.t{display:block;color:var(--ink)} .chg .w{display:block;color:var(--ink2);font-size:13.5px;margin-top:2px}
.chg .ev{display:inline-block;font:700 10.5px/1 system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--ink3);margin-left:6px}
.ba{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0 2px}
.ba figure{margin:0} .ba img{width:100%;height:auto;border-radius:8px;border:1px solid var(--line);display:block}
.ba figcaption{font-size:11.5px;color:var(--ink3);margin-top:3px}
.ba .lab{display:inline-block;font:800 10px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border-radius:5px;margin-bottom:4px}
.lab.b{background:var(--card2);color:var(--ink3)} .lab.a{background:color-mix(in srgb,var(--green) 16%,transparent);color:var(--green)}
.solo{margin:10px 0} .solo img{max-width:100%;border-radius:8px;border:1px solid var(--line)}
.note{border-left:3px solid var(--line);padding:6px 0 6px 11px;margin:9px 0}
.note.bug{border-color:var(--red)} .note.chg2{border-color:var(--amber)} .note.like{border-color:var(--green)} .note.q{border-color:var(--blue)}
.note q{display:block;color:var(--ink);font-style:normal} .note small{color:var(--ink3)}
.note .tb{font:800 10px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin-left:6px}
.toc{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 4px}
.toc a{font-size:12.5px;font-weight:700;padding:6px 10px;border-radius:999px;background:var(--card2);color:var(--ink);text-decoration:none}
.dq{border:1px solid color-mix(in srgb,var(--amber) 45%,var(--line));border-radius:12px;padding:11px 13px;margin:10px 0;background:color-mix(in srgb,var(--amber) 6%,var(--card))}
.dq b{color:var(--ink)} .dq span{display:block;color:var(--ink2);font-size:13.5px;margin-top:3px}
/* change cards: one clip at a time on a phone, both side by side when wide */
body{font-size:16px}
.cx{border-top:1px solid var(--line);padding:18px 0 6px;margin-top:6px}
.cx:first-of-type{border-top:0}
.cxh{display:flex;gap:10px;align-items:baseline}
.cxh .n{flex:none;font:800 13px/1 system-ui,sans-serif;color:var(--ink3);font-variant-numeric:tabular-nums}
.cxh h4{margin:0;font-size:17.5px;line-height:1.3;color:var(--ink);text-wrap:balance}
.cx .w{margin:6px 0 0;color:var(--ink2);font-size:15.5px;line-height:1.5}
.cx .look{margin:8px 0 0;font-size:15px;color:var(--ink);background:var(--card2);border-radius:10px;padding:9px 12px}
.cx .look b{color:var(--green);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-right:6px}
.cx .ev{font:800 10.5px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin-left:auto;white-space:nowrap}
.seg{display:flex;gap:6px;margin:12px 0 8px}
.seg button{flex:1;font:800 14px/1 system-ui,sans-serif;padding:11px 0;border-radius:10px;border:1px solid var(--line);background:var(--card2);color:var(--ink2);cursor:pointer}
.seg button.on[data-s="before"]{background:var(--ink3);border-color:var(--ink3);color:var(--bg)}
.seg button.on[data-s="after"]{background:var(--green);border-color:var(--green);color:#06170e}
.panes{display:grid;gap:14px}
.pane[hidden]{display:none!important}
.pane .lab{display:inline-block;font:800 11px/1 system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;padding:5px 8px;border-radius:6px;margin-bottom:6px}
.pane.before .lab{background:var(--card2);color:var(--ink2)} .pane.after .lab{background:color-mix(in srgb,var(--green) 18%,transparent);color:var(--green)}
.pane video,.pane img.still{display:block;width:100%;height:auto;max-height:80vh;object-fit:contain;border-radius:12px;border:1px solid var(--line);background:#05070d}
.spd{display:flex;gap:6px;align-items:center;margin:7px 0 0;font-size:13px;color:var(--ink3)}
.spd button{font:700 13px/1 system-ui,sans-serif;padding:7px 11px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink2);cursor:pointer}
.spd button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.spd a{margin-left:auto;color:var(--ink2)}
.pane .pnote{margin:0 0 8px;font-size:14px;color:var(--ink2)}
.cx .w2{margin:0;color:var(--ink2);font-size:15px;line-height:1.5} .cx .evs{color:var(--ink3);font-size:13px}
.cx details{margin-top:10px}
.pics{display:grid;gap:10px;margin-top:10px}
.pics img{width:100%;height:auto;border-radius:10px;border:1px solid var(--line);display:block}
@media (min-width:760px){.seg{display:none}.panes{grid-template-columns:repeat(2,minmax(0,1fr))}.pane[hidden]{display:block!important}}
</style>"""

def img(path, maxw=720):
    """Copy a picture into img/, shrunk. Returns the published relative path, or None."""
    if not os.path.exists(path): return None
    base = os.path.basename(path); area = os.path.basename(os.path.dirname(path))
    out_name = f"{area}-{os.path.splitext(base)[0]}"
    if path.endswith(".gif"):
        if os.path.getsize(path) > 2_800_000: return None
        dst = D + "img/" + out_name + ".gif"; shutil.copyfile(path, dst); return "img/" + out_name + ".gif"
    im = Image.open(path).convert("RGB")
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)))
    dst = D + "img/" + out_name + ".jpg"; im.save(dst, quality=80, optimize=True)
    return "img/" + out_name + ".jpg"

def ba(before, after, cap=""):
    b, a = img(before), img(after)
    if not (b and a): return ""
    c = f"<figcaption>{cap}</figcaption>" if cap else ""
    return (f'<div class="ba"><figure><span class="lab b">Before</span><a href="{b}" target="_blank"><img src="{b}" loading="lazy" alt="before"></a></figure>'
            f'<figure><span class="lab a">After</span><a href="{a}" target="_blank"><img src="{a}" loading="lazy" alt="after"></a>{c}</figure></div>')

def solo(path, cap=""):
    p = img(path, 760)
    if not p: return ""
    return f'<figure class="solo"><a href="{p}" target="_blank"><img src="{p}" loading="lazy" alt=""></a><figcaption class="bcap">{cap}</figcaption></figure>'

def pairs_in(area):
    """All NN-name-before/after pairs an agent saved, in order."""
    d = MT + area + "/"; out = []
    for b in sorted(glob.glob(d + "*-before.*")):
        stem = b[: b.rindex("-before")]
        for ext in (".jpg", ".png", ".gif"):
            if os.path.exists(stem + "-after" + ext): out.append((b, stem + "-after" + ext, os.path.basename(stem))); break
    return out

FILM = MT + "film/"
def clip(area, name):
    """Copy a clip into clips/. Returns its published path, or None."""
    if not name: return None
    src = FILM + area + "/" + name
    if not os.path.exists(src): return None
    out = f"clips/{area}-{name}"; shutil.copyfile(src, D + out); return out

def still(area, name):
    return img(FILM + area + "/" + name, 780) if name else None

def pane(area, side, m):
    if not m: return ""
    v, p = clip(area, m.get("mp4")), still(area, m.get("jpg"))
    lab = "Before" if side == "before" else "After"
    h = f'<div class="pane {side}"' + (' hidden' if side == "before" else "") + f'><span class="lab">{lab}</span>'
    if v:
        h += (f'<video src="{v}"' + (f' poster="{p}"' if p else "") + ' controls playsinline muted preload="none"></video>'
              '<div class="spd">Speed <button class="on" data-r="1">1×</button><button data-r="0.5">½×</button><button data-r="0.25">¼×</button>'
              + (f'<a href="{p}" target="_blank">Picture full size</a>' if p else "") + '</div>')
    elif p:
        h += f'<a href="{p}" target="_blank"><img class="still" src="{p}" loading="lazy" alt="{lab}"></a>'
    extra = [still(area, x) for x in m.get("extra", []) or []]
    extra = [x for x in extra if x]
    if extra:
        h += det(f"More pictures ({len(extra)})", (f'<p class="pnote">{m["note"]}</p>' if m.get("note") else "") + '<div class="pics">' + "".join(f'<a href="{x}" target="_blank"><img src="{x}" loading="lazy" alt=""></a>' for x in extra) + "</div>")
    return h + "</div>"

def card(area, i, c, f):
    short = c.get("s") or c["w"]
    h = (f'<article class="cx" id="{area}-{i}"><div class="cxh"><span class="n">{i}</span><h4>{c["t"]}</h4></div>'
         f'<p class="w">{short}</p>')
    if f:
        look = c.get("look") or f.get("look")
        if look: h += f'<p class="look"><b>Look for</b>{look}</p>'
        b, a = f.get("before"), f.get("after")
        if b and a: h += '<div class="seg"><button data-s="before">Before</button><button data-s="after" class="on">After</button></div>'
        h += '<div class="panes">' + pane(area, "before", b) + pane(area, "after", a) + "</div>"
        if b and not a: h = h.replace('class="pane before" hidden', 'class="pane before"')
    if c.get("s"):
        ev = f' <span class="evs">({c["ev"]})</span>' if c.get("ev") else ""
        h += det("The detail", f'<p class="w2">{c["w"]}{ev}</p>')
    return h + "</article>"

def manifest(area):
    p = FILM + area + "/manifest.json"
    return json.load(open(p)) if os.path.exists(p) else []

AREAS = json.load(open(D + "areas.json"))
for d in ("img", "clips"):
    shutil.rmtree(D + d, ignore_errors=True); os.makedirs(D + d)

P = []
P.append(f'''<header><span class="ver">Mikey v0.20 · site archive</span><span class="status">Harry's notes tab · updated as each part lands</span>
<h1>Harry's review, and the changes</h1>
<p class="sub">Harry's notes on this version (and on v0.21, sponsors) from his recordings, then every change built from them in a <b>test copy</b> of the game. Every change has a clip of the game before and after, filmed on a phone-sized screen. Nothing here is live yet.</p></header>''')
done = sum(1 for a in AREAS if a["status"] == "done"); total = len(AREAS)
P.append(f'''<div class="strip"><div><b>{done} of {total}</b><span>areas built in the test copy</span></div><div><b>54</b><span>points in Harry's review video</span></div>
<div><b>29</b><span>tested in the game on camera</span></div><div><b>{sum(1 for a in AREAS for d in a.get("decisions",[]))}</b><span>decisions waiting</span></div></div>''')
P.append('<nav class="toc">' + "".join(f'<a href="#{a["id"]}">{a["title"]}</a>' for a in AREAS) + '<a href="#notes">Harry\'s notes</a></nav>')

P.append(h2("changes", "c-g", "Changes, built in a test copy", "Each change has a clip of the old game and the new one, same save, same taps. Switch Before / After under each one; ½× and ¼× slow a clip down. The white dot is a finger. Each area was built in its own test copy, so a clip can still show another area's old screen (e.g. “Overall” under your name in the shop and sponsors clips) — they come together when merged."))
for a in AREAS:
    stl = {"done": ("done", "Built · in test"), "wip": ("wip", "Building now"), "dec": ("dec", "Needs your call")}[a["status"]]
    h = f'<section class="area" id="{a["id"]}"><h3>{a["title"]}<span class="st {stl[0]}">{stl[1]}</span></h3><p class="sub">{a["lead"]}</p>'
    mf = manifest(a["id"])
    byt = {m["t"]: m for m in mf}
    if mf:
        h += "".join(card(a["id"], i + 1, c, byt.get(c["t"]) or (mf[i] if i < len(mf) else None)) for i, c in enumerate(a.get("changes", [])))
    elif a.get("changes"):
        h += '<ul class="chg">' + "".join(
            f'<li><b class="t">{c["t"]}<span class="ev">{c.get("ev","")}</span></b><span class="w">{c["w"]}</span></li>' for c in a["changes"]) + "</ul>"
    for dq in a.get("decisions", []):
        h += f'<div class="dq"><b>Your call: {dq["q"]}</b><span>{dq["o"]}</span></div>'
    for s in ([] if mf else a.get("solo", [])):
        h += solo(MT + a["id"] + "/" + s[0], s[1])
    prs = pairs_in(a["id"]) if a["status"] != "wip" and not mf else []
    caps = a.get("captions", {})
    if prs:
        body = "".join(ba(b, af, caps.get(name, name.split("-", 1)[1].replace("-", " "))) for b, af, name in prs)
        h += det(f"Before and after pictures ({len(prs)})", body) if len(prs) > 3 else body
    if a.get("notdone"):
        h += det("Not done, or left for a decision", '<ul class="plain">' + "".join(f"<li>{x}</li>" for x in a["notdone"]) + "</ul>")
    P.append(h + "</section>")

# ---- Harry's notes ----
N = json.load(open(D + "notes.json"))
P.append(h2("notes", "c-v", "Harry's notes", "His words from his recordings (30 Sep), with the time. TESTED = he did it in the game on camera; READ = from Mikey's notes."))
for grp, cls in (("Broken", "bug"), ("Change", "chg2"), ("Likes", "like"), ("Questions", "q")):
    items = [n for n in N if n["g"] == grp]
    if not items: continue
    P.append(f'<p class="sub-h">{grp} ({len(items)})</p>')
    for n in items:
        pic = solo(KF + n["kf"], "") if n.get("kf") else ""
        P.append(f'<div class="note {cls}"><q>“{n["said"]}”</q><small>{n["about"]} · {n["t"]}<span class="tb">{n["how"]}</span></small>{pic}</div>')
P.append('<footer>Mikey v0.20 review · built 1 Oct 2026 in a test copy. Nothing on this page is live; each part goes in only once Harry (and Mikey, for his areas) say yes.</footer>')

page = HEAD + EXTRA_CSS + CSS + '<div class="wrap">' + "\n".join(P) + "</div>"
page += """<script>
document.addEventListener("click", function (e) {
  var b = e.target.closest && e.target.closest(".seg button");
  if (b) {
    var art = b.closest(".cx"), s = b.getAttribute("data-s");
    art.querySelectorAll(".seg button").forEach(function (x) { x.classList.toggle("on", x === b); });
    art.querySelectorAll(".pane").forEach(function (p) {
      var show = p.classList.contains(s);
      p.hidden = !show;
      if (!show) { var v = p.querySelector("video"); if (v) v.pause(); }
    });
    return;
  }
  var r = e.target.closest && e.target.closest(".spd button");
  if (r) {
    var pane = r.closest(".pane"), v = pane.querySelector("video");
    pane.querySelectorAll(".spd button").forEach(function (x) { x.classList.toggle("on", x === r); });
    if (v) { var rate = parseFloat(r.getAttribute("data-r")); v.playbackRate = rate; v.defaultPlaybackRate = rate; if (v.paused) v.play().catch(function(){}); }
  }
});
</script>"""
open(D + "index.html", "w").write(page)
print("index.html", len(page) // 1024, "KB; img", len(os.listdir(D + "img")), "clips", len(os.listdir(D + "clips")))
