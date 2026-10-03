# V1, newest first, with v0.26 and v0.27 added (Harry, 3 Oct 2026).
import re, os, shutil, html, json
from bs4 import BeautifulSoup, NavigableString
SP = "/tmp/claude-0/-home-user-Tierlist/36643638-fd75-5950-83da-ee5f6b43df22/scratchpad"
SRC = "/root/.claude/projects/-home-user-Tierlist/36643638-fd75-5950-83da-ee5f6b43df22/tool-results/artifact-fce7178e-1790993349-9e32.html"
OUT = SP + "/v1n"
raw = open(SRC).read()
body = raw[raw.find("<title>"):]
soup = BeautifulSoup(body, "html.parser")
wrap = soup.find("div", class_="wrap")
frag = lambda h: BeautifulSoup(h, "html.parser")

# ---------- new cards from the v0.26 and v0.27 pages ----------
next_c = max(int(x) for x in re.findall(r'id="c(\d+)"', body)) + 1
new_files = {}
def cards_from(page, ver, prefix, group_of):
    global next_c
    s = BeautifulSoup(open(page).read(), "html.parser")
    out, idx = [], []
    for a in s.select("article.it"):
        h = a.find("h3"); pill = a.select_one(".pill")
        if not h or not pill: continue
        kd = {"New": "added", "Fixed": "fixed", "Changed": "changed"}.get(pill.get_text(), "changed")
        blks = a.select(".blk")
        prob = fix = ""
        for bk in blks:
            lab = bk.find("h4").get_text()
            txt = " ".join(x.get_text(" ", strip=True) for x in bk.find_all(["p", "li"]) ) or bk.get_text(" ", strip=True).replace(lab, "", 1)
            if lab == "Problem": prob = txt
            else: fix = txt
        figs = ""
        imgs = a.select("figure")[:2]
        if imgs:
            figs = '<div class="ba">'
            for fg in imgs:
                src = fg.find("img")["src"]; cap = fg.find("figcaption").get_text(" ", strip=True)
                name = prefix + os.path.basename(src)
                shutil.copy(os.path.join(os.path.dirname(page), src), OUT + "/img/" + name)
                new_files["img/" + name] = OUT + "/img/" + name
                figs += f'<figure><img alt="{html.escape(cap)}" loading="lazy" src="img/{name}"/><figcaption>{html.escape(cap)}</figcaption></figure>'
            figs += "</div>"
        how = a.select_one(".how")
        ev = "seen in stills" if imgs else ("measured" if how and "measured" in how.get_text().lower() else "worked out")
        cid = f"c{next_c}"; next_c += 1
        title = h.get_text(" ", strip=True)
        card = (f'<div class="pc" id="{cid}"><div class="meta"><span class="num">{group_of(a.get("id") or "")}</span><span class="kd {kd}">{kd}</span><span class="ev">{ev}</span></div>'
                f'<h3>{html.escape(title)}</h3><div class="pwf">'
                + (f'<div class="pp"><b>Problem</b><span>{html.escape(prob)}</span></div>' if prob else "")
                + f'<div class="pf"><b>Fix</b><span>{html.escape(fix)}</span></div></div>{figs}</div>')
        out.append(card); idx.append((cid, title))
    return out, idx

g26 = lambda i: {"m": "MATCH", "s": "3D SCENES", "t": "TRIAL & SAVES"}.get(i[:1], "MATCH")
c26, i26 = cards_from(SP + "/v026/page/index.html", "v0.26", "v26-", g26)
c27, i27 = cards_from(SP + "/v027/page/index.html", "v0.27", "v27-", lambda i: "MATCH")

def vblock(vid, title, link, nb, lead, cards, branch=False):
    cls = "vblock branch" if branch else "vblock"
    return (f'<section class="{cls}" data-author="Harry" id="{vid}"><div class="vhead"><span class="vn">{vid}</span><span class="who Harry">Harry</span>'
            f'<span class="nb">{nb}</span><span class="th">{title} · <a href="{link}">full page with stills</a></span></div>'
            f'<p class="lead">{lead}</p>' + "".join(cards) + "</section>")

v27 = vblock("v0.27", "a 20° camera, a zoom per highlight, an even mix, a fixed keeper, a ball that never just stops",
             "https://claude.ai/artifact/997ZvUvR6NiqyfDnjh2jDm", "on branch Harry · zoom and mix live",
             "Built on 3 Oct from Harry's feedback on the new match view, filmed frame by frame at 20° and flat. The zoom per highlight and the even mix went live with the v0.26 merge; the rest is on branch Harry until it is merged.", c27, branch=True)
v26 = vblock("v0.26", "a new-looking match: zoomed out, 3D players, about 100 pictures of every chance",
             "https://claude.ai/artifact/2XikkuNj5Q7hm9xcy9kmYS", "live 3 Oct",
             "Built overnight on 2–3 Oct. Live on knowitball.co.uk. Every new look has an Old switch in Settings → Look.", c26)

# ---------- newest first ----------
days = wrap.find_all("div", class_="day", recursive=False)
# the 3 Oct day gets v0.26 and v0.27
d3 = [d for d in days if d.get("data-day") == "2026-10-03"][0]
d3.append(frag(v26 + v27))
anchor = days[0]
for d in days:
    secs = [c for c in d.find_all(recursive=False) if c.name != "h2"]
    for sct in secs: sct.extract()
    for sct in reversed(secs):
        d.append(sct)
    d.extract()
open_h2 = wrap.find("h2", id="open")
for d in reversed(days):
    open_h2.insert_before(d)

# index: v0.27, v0.26 first, everything reversed
idxdiv = wrap.select_one("#indexwrap .idx")
dets = idxdiv.find_all("details", recursive=False)
for dt in dets: dt.extract()
def idx_details(v, label, items):
    lis = "".join(f'<li><a href="#{c}">{html.escape(t)}</a></li>' for c, t in items)
    return frag(f'<details data-author="Harry"><summary>{v} · Harry <span>— {label} ({len(items)})</span></summary><ol>{lis}</ol></details>')
idxdiv.append(idx_details("v0.27", "a 20° camera, a zoom per highlight, the keeper fixed", i27))
idxdiv.append(idx_details("v0.26", "a new-looking match, 100 pictures of every chance", i26))
for dt in reversed(dets): idxdiv.append(dt)

# nav: headline, index, then newest day first
nav = wrap.find("nav", class_="toc")
links = nav.find_all("a")
head = [a for a in links if a["href"] in ("#headline", "#index")]
tail = [a for a in links if a["href"] in ("#open", "#sources")]
mid = [a for a in links if a not in head and a not in tail]
for a in links: a.extract()
byhref = {a["href"]: a for a in mid}
byhref["#v0.27"] = frag('<a href="#v0.27">v0.27</a>').a
byhref["#v0.26"] = frag('<a href="#v0.26">v0.26</a>').a
ordered = []
for d in wrap.find_all("div", class_="day", recursive=False):
    for hid in ["#" + d.find("h2")["id"]] + ["#" + sct["id"] for sct in d.find_all("section", recursive=False)]:
        if hid in byhref and byhref[hid] not in ordered: ordered.append(byhref[hid])
ordered += [a for a in mid if a not in ordered]
for a in head + ordered + tail: nav.append(a)

# still open: newest first, with v0.26–v0.27's issues on top
def openlist_reverse(div):
    pcs = div.find_all("div", class_="pc", recursive=False)
    for p in pcs: p.extract()
    for p in reversed(pcs): div.append(p)
ols = wrap.find_all("div", class_="open-list", recursive=False)
openlist_reverse(ols[0])
newopen = [
 ("v0.27", "The keeper sometimes dives at a ball that isn't a shot", "A soft ball rolling out along the byline gets a full dive. That is the match's own keeper deciding, not the picture."),
 ("v0.27", "After a deflected free kick, the wall chases the loose ball toward the goal", "Filmed at 20° and flat. The match's defenders reacting to the loose ball."),
 ("v0.27", "On byline crosses two players can overlap and flip between lying and standing", "The 3D running frames seen side-on read as lying down."),
 ("v0.27", "20° is subtle, 30° can cut off an arm at the bottom corner", "The tilt crops the near corners; the camera pulls back for the ball, you, the target and the keeper, not for everyone."),
 ("v0.26", "3D kick foot: left-footers kick with the right in the 3D view", "The drawn view is right. Signing hands are one fixed shape; the long-hair model reads as slicked back; the shop walk is a slowed jog."),
]
for v, t, p in reversed(newopen):
    ols[0].insert(0, frag(f'<div class="pc" data-author="Harry"><div class="meta"><span class="num">RAISED IN {v}</span><span class="who Harry" style="font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:999px">Harry</span></div><h3>{html.escape(t)}</h3><div class="pwf"><div class="pp"><b>Problem</b><span>{html.escape(p)}</span></div><div class="ps"><b>Status</b><span>Open.</span></div></div></div>'))
lead_open = open_h2.find_next_sibling("p", class_="lead")
lead_open.string = lead_open.get_text().replace("oldest first", "newest first") if "oldest first" in lead_open.get_text() else lead_open.get_text() + " Newest first."

# decisions and closed groups: newest group first
def group(start_id):
    p = wrap.find("p", id=start_id); out = [p]; n = p.find_next_sibling()
    while n is not None and not (n.name == "p" and "sublead" in (n.get("class") or [])) and n.name != "h2":
        out.append(n); n = n.find_next_sibling()
    return out
order = ["decide23", "decide22", "decide20", "decide18", "decide16", "closed23", "closed18", "closed16"]
groups = {g: group(g) for g in order}
for g in order:
    for el in groups[g]: el.extract()
src_h2 = wrap.find("h2", id="sources")
for g in order:
    for el in groups[g]: src_h2.insert_before(el)

# sources newest first, with v0.26 and v0.27
ul = src_h2.find_next_sibling("ul")
lis = ul.find_all("li", recursive=False)
for li in lis: li.extract()
for h in ['<li>v0.27 · Harry · 2026-10-03 · <a href="https://claude.ai/artifact/997ZvUvR6NiqyfDnjh2jDm">https://claude.ai/artifact/997ZvUvR6NiqyfDnjh2jDm</a> (stills)</li>',
          '<li>v0.26 · Harry · 2026-10-03 · <a href="https://claude.ai/artifact/2XikkuNj5Q7hm9xcy9kmYS">https://claude.ai/artifact/2XikkuNj5Q7hm9xcy9kmYS</a> (stills and 2 clips)</li>']:
    ul.append(frag(h))
for li in reversed(lis): ul.append(li)

# header, update note, strip
sub = wrap.find("header").find("p", class_="sub")
sub.string = "Every change from the patch notes so far, newest first: 3 October back to 21 September, from Harry, Leo and Mikey. Each one says what was wrong, why it happened, and what fixed it, so it reads fine even if you weren't there."
n_new = len(c26) + len(c27)
upd = wrap.find("p", class_="upd")
upd.clear()
upd.append(frag(f'<b>Updated 3 Oct, evening. Newest first from now on.</b> The page now reads from the latest version at the top back to 21 September. Adds Harry\'s <a href="#v0.27">v0.27</a> (a 20° camera, a zoom per highlight, an even mix of highlights, the keeper fixed, the ball no longer just stops) and <a href="#v0.26">v0.26</a> (a zoomed-out match with 3D players, about 100 pictures of every chance, playstyle and energy), {n_new} new changes, and 5 new known issues at the top of <a href="#open">Still open</a>.'))
strip = wrap.find("div", class_="strip").find_all("div", class_="s")
b0 = strip[0].find("b"); b0.string = str(int(b0.get_text()) + n_new)
strip[0].find("span").string = f"problems fixed or features added in the game, 21 Sep to 3 Oct ({n_new} of them in v0.26 and v0.27), plus tools and rules from Harry's branch"
b1 = strip[1].find("b"); b1.string = str(int(b1.get_text()) + 2)
strip[1].find("span").string = "patch notes and review pages folded into this one page, newest first (v0.26 and v0.27 are the latest), plus Mikey's 6 drawing commits, which had no page"
b2 = strip[2].find("b"); hv, lv, mv = [int(x) for x in b2.get_text().split("·")]; b2.string = f"{hv + n_new} · {lv} · {mv}"
b3 = strip[3].find("b"); b3.string = str(int(b3.get_text()) + 5)
sp3 = strip[3].find("span"); sp3.string = "5 of them raised in v0.26 and v0.27 (newest at the top of Still open); " + sp3.get_text()

# headline: the newest big change
hero = wrap.find("section", id="headline")
hero.clear()
hero.append(frag('<div class="kick">The headline · v0.26 and v0.27</div><h2 class="big">A new-looking match: zoomed out, 3D players, a 20° camera</h2>'
    '<div class="pwf"><div class="pp"><b>Problem</b><span>The match was a close-up, flat, drawn view that showed one bit of pitch, and the same highlights kept coming back.</span></div>'
    '<div class="pf"><b>Fix</b><span>v0.26 zoomed the match out with 3D players and dealt chances so they rarely repeat. v0.27 tipped the camera back 20°, gave each kind of highlight its own zoom, evened out the mix of highlights, fixed the keeper, and made the ball leave the screen when it goes out instead of stopping on the grass. Every new look has an Old switch in Settings → Look.</span></div></div>'
    f'<div class="ba"><figure><img alt="Flat, the old top-down view." loading="lazy" src="img/v27-t-flat.jpg"/><figcaption>v0.26: flat, straight down.</figcaption></figure><figure><img alt="The new 20 degree camera." loading="lazy" src="img/v27-t-20.jpg"/><figcaption>v0.27: tipped back 20°.</figcaption></figure></div>'
    '<p class="note">The previous headline, every player you drew plays (v0.16), is <a href="#c182">card 182</a>.</p>'))
for n in ("t-flat.jpg", "t-20.jpg"):
    shutil.copy(SP + "/v027/page/img/" + n, OUT + "/img/v27-" + n); new_files["img/v27-" + n] = OUT + "/img/v27-" + n

out = str(soup).replace("You said: ", "Harry said: ")
open(OUT + "/index.html", "w").write(out)
json.dump(new_files, open(OUT + "/files.json", "w"))
print(len(out), "bytes;", n_new, "new cards;", len(new_files), "new files")
