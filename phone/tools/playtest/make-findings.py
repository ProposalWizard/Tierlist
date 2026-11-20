"""notes.txt (F|rank|screen|packed|next|shots rows) -> CAREER-FINDINGS.md, ranked HIGH, MED, LOW.
   python3 phone/tools/playtest/make-findings.py"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
S = "/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/playtest/career/"
rows = [l.rstrip("\n").split("|") for l in open(os.path.join(HERE, "notes.txt")) if l.startswith("F|")]
order = {"HIGH": 0, "MED": 1, "LOW": 2}
rows.sort(key=lambda r: order[r[1]])
cnt = {k: sum(1 for r in rows if r[1] == k) for k in order}
esc = lambda s: s.replace("|", "/")
out = f"""# KIB Next vs the packed app: a played career (20 Nov 2026)

Played, not just screenshotted: both apps side by side in Chromium with touch on, main size
**412×915** (Galaxy S20+), every step shot in both at the same moment; key screens also at
**360×780** and **360×640**. The packed app (`mobile/www`) is the reference. No app code changed.

**How far each app got**
- Packed: title → new career (all steps) → trial (all 5 stages) → scout talk → 3D signing → news →
  tour → 3 National League South matches played (bot) → training (2 drills) → can offer → phone gift →
  every phone app, Star Pass (claimed level 2), Locker → then an Arsenal save (all screens open):
  Shop (every category, bought a Beach Hut), Store, Sponsors, Owner, Garden, House, Kickabout,
  Community Shield played, league matches → a season-end save (1 match left, `make-season-end.mts`) →
  last match simmed → international break (2 matches) → contract renewal (negotiated) → Player of the
  Month → Golden Ball → transfer window → signed for Aston Villa (3D scene) → season awards → season 2 Home.
- KIB Next: the same path. Blocked spots: Training and Phone stayed locked after 3 story matches
  (opened by hand with `__kibNav` to compare); Locker / Garden / House / 3D shop are "coming soon";
  no international break or renewal at season end. Reached season 2 Home at Aston Villa.

**Count:** {cnt['HIGH']} HIGH, {cnt['MED']} MED, {cnt['LOW']} LOW ({len(rows)} in all).

**Caveats:** KIB Next ran as its web build (`phone/tools/look/build-web.mjs`): no 3D player on Home/title
(known limit), Roboto/emoji fonts, and Chromium SwiftShader is slower than a phone (affects the "freeze"
row). Random parts differ on purpose (trial distances, which club scouts you). Matches were played by a
simple bot (find ball, pull back, tap ball), the same bot in both apps.

Screenshots: `{S}` (`<name>-packed.png`, `<name>-next.png`, `<name>-pair.jpg`; size sheets
`200-<screen>-sizes.jpg`). Worst 12 pairs: `{S}worst.jpg`.

Tools (this folder): `drive.mjs` (both apps open, steered by `cmd.mjs` / `pt.sh`), `ball.mjs`, `pair.py`,
`sizes.py`, `contact.py`, `make-season-end.mts`, `notes.txt` (raw rows), `make-findings.py` (this table).

| # | Rank | Screen | Packed app does | KIB Next does | Shots |
|---|---|---|---|---|---|
"""
for i, r in enumerate(rows, 1):
    out += f"| {i} | {r[1]} | {esc(r[2])} | {esc(r[3])} | {esc(r[4])} | {esc(r[5])} |\n"
open(os.path.join(HERE, "CAREER-FINDINGS.md"), "w").write(out)
for i, r in enumerate(rows[:15], 1):
    print(i, r[2], "::", r[4][:120])
