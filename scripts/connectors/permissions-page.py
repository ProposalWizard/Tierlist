#!/usr/bin/env python3
"""scripts/connectors/permissions-page.py: one page to set every connector's tool permissions.

Harry, 23 Oct 2026: "lay it out in an artifact exactly how it is in the connector even with the ones that
stay the same so it's easy to go through and just toggle". Reads tools.json (connector -> tool names),
sorts each tool with classify.py, and draws it the way claude.ai shows it: Read-only tools, then
Write/delete tools, each row with the three buttons (Always allow / Needs approval / Never) and the
recommended one lit. Usage: python3 permissions-page.py OUT.html [tools.json] ["Title"]"""
import html, json, sys
from classify import classify, WHY
out = sys.argv[1]; src = sys.argv[2] if len(sys.argv) > 2 else "tools.json"; title = sys.argv[3] if len(sys.argv) > 3 else "Connector Permissions"
data = json.load(open(src))
PREF = ["notion-calendar-","notion-","slack_"]
def nice(t):
    s = t
    for p in PREF:
        if s.startswith(p): s = s[len(p):]; break
    s = s.replace("_", " ").replace("-", " ").strip()
    return s[:1].upper() + s[1:]
ICON = {"always": "✓", "ask": "✋", "never": "⊘"}
LBL = {"always": "Always allow", "ask": "Needs approval", "never": "Never"}
sections = []; summary = []
for conn, tools in data.items():
    rows = {"always": [], "ask": [], "never": []}
    for t in tools.split(): rows[classify(conn, t)].append(t)
    ro = sorted(rows["always"], key=nice); wr = sorted(rows["ask"] + rows["never"], key=nice)
    def row(t):
        c = classify(conn, t)
        btn = "".join(f'<span class="b{" on "+k if k==c else ""}" title="{LBL[k]}">{ICON[k]}</span>' for k in ("always","ask","never"))
        flag = f'<span class="chg {c}">{LBL[c]}</span>' if c != "ask" else '<span class="same">stays</span>'
        return f'<li class="r {c}"><span class="nm">{html.escape(nice(t))}<small>{html.escape(t)}</small></span>{flag}<span class="bs">{btn}</span></li>'
    nvr = len(rows["never"]); cid = "c" + str(len(sections))
    sections.append(f"""<details class="conn" id="{cid}"><summary><span class="cn">{html.escape(conn)}</span>
<span class="ct"><b>{len(rows['always'])}</b> to ✓ · <b>{nvr}</b> to ⊘ · {len(rows['ask'])} stay ✋</span><label class="dn"><input type="checkbox" data-k="{cid}"> done</label></summary>
<div class="grp"><div class="gh"><b>Read-only tools</b> <span class="pc">{len(ro)}</span><span class="gs">Set the group to <b>✓ Always allow</b> (one tap)</span></div>
<ul>{''.join(row(t) for t in ro) or '<li class="none">none</li>'}</ul></div>
<div class="grp"><div class="gh"><b>Write/delete tools</b> <span class="pc">{len(wr)}</span><span class="gs">Leave the group on <b>✋ Needs approval</b>{', then set the red ones to <b>⊘ Never</b>' if nvr else ''}</span></div>
<ul>{''.join(row(t) for t in wr)}</ul></div></details>""")
    summary.append((conn, len(rows["always"]), len(rows["ask"]), nvr))
total = sum(a for _, a, _, _ in summary), sum(n for *_, n in summary)
page = f"""<title>{html.escape(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{{--bg:#171717;--card:#1f1f1f;--row:#262626;--ink:#ececec;--ink2:#a3a3a3;--line:#2e2e2e;--g:#3ddc84;--a:#f5b942;--r:#ff6b6b;color-scheme:dark}}
@media (prefers-color-scheme:light){{:root:not([data-theme="dark"]){{--bg:#f5f5f4;--card:#fff;--row:#f3f3f2;--ink:#1c1c1c;--ink2:#5c5c5c;--line:#e2e2e0;--g:#0b7a43;--a:#8f6200;--r:#c62828;color-scheme:light}}}}
:root[data-theme="light"]{{--bg:#f5f5f4;--card:#fff;--row:#f3f3f2;--ink:#1c1c1c;--ink2:#5c5c5c;--line:#e2e2e0;--g:#0b7a43;--a:#8f6200;--r:#c62828;color-scheme:light}}
body{{background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding-block:22px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
.wrap{{max-width:820px;margin:0 auto;display:flex;flex-direction:column;gap:12px}}
h1{{font-size:clamp(24px,6vw,32px);margin:0;line-height:1.1}}
.how{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--ink2);font-size:14px}}.how b{{color:var(--ink)}}.how ol{{margin:6px 0 0;padding-left:20px}}
.key{{display:flex;flex-wrap:wrap;gap:12px;font-size:13px;color:var(--ink2)}}
.conn{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0 12px}}
.conn summary{{cursor:pointer;list-style:none;padding:12px 0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}}.conn summary::-webkit-details-marker{{display:none}}
.cn{{font-weight:800;font-size:17px}}.ct{{color:var(--ink2);font-size:13px}}.ct b{{color:var(--ink)}}.dn{{margin-left:auto;font-size:13px;color:var(--ink2)}}
.grp{{margin:0 0 12px}}.gh{{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 0;border-bottom:1px solid var(--line)}}
.pc{{border:1px solid var(--line);border-radius:999px;padding:0 8px;font-size:12px}}.gs{{font-size:13px;color:var(--ink2);margin-left:auto}}
ul{{list-style:none;margin:0;padding:0}}
.r{{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)}}
.nm{{min-width:0;overflow-wrap:anywhere}}.nm small{{display:block;color:var(--ink2);font-size:11px;font-family:ui-monospace,Menlo,monospace}}
.bs{{display:flex;background:var(--row);border-radius:9px;padding:2px}}
.b{{width:30px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:7px;color:var(--ink2);font-size:15px}}
.b.on.always{{background:var(--g);color:#06170e}}.b.on.ask{{background:var(--line);color:var(--ink)}}.b.on.never{{background:var(--r);color:#fff}}
.chg{{font-size:11px;font-weight:800;padding:2px 7px;border-radius:999px;white-space:nowrap}}.chg.always{{color:var(--g);border:1px solid var(--g)}}.chg.never{{color:var(--r);border:1px solid var(--r)}}
.same{{font-size:11px;color:var(--ink2)}}.none{{color:var(--ink2);padding:8px 0}}
table{{border-collapse:collapse;width:100%;font-size:13.5px}}td,th{{padding:6px 4px;border-bottom:1px solid var(--line);text-align:left}}th{{color:var(--ink2);font-weight:600}}
</style>
<div class="wrap">
<h1>{html.escape(title)}</h1>
<div class="how"><b>How to use:</b> claude.ai → Settings → Connectors → open a connector → Tool permissions. The rows below are in the same groups and order.
<ol><li><b>Read-only tools:</b> set the group dropdown to <b>✓ Always allow</b>. One tap does every row.</li>
<li><b>Write/delete tools:</b> leave the group on <b>✋ Needs approval</b>, then tap <b>⊘</b> on each row marked <b>Never</b> (red).</li>
<li>Tick <b>done</b> on the connector here.</li></ol>
Rule of thumb: look-only = ✓; changes, sends, spends or publishes = ✋; wipes data in bulk, takes the site down or can't be undone = ⊘. Names may read slightly differently in the app; the small grey name is the exact tool.</div>
<div class="key"><span>Totals: <b>{total[0]}</b> tools to ✓ Always allow · <b>{total[1]}</b> to ⊘ Never · the rest stay ✋</span></div>
<table><tr><th>Connector</th><th>✓ allow</th><th>✋ stays</th><th>⊘ never</th></tr>{''.join(f'<tr><td>{html.escape(c)}</td><td>{a}</td><td>{k}</td><td>{n}</td></tr>' for c,a,k,n in summary)}</table>
{''.join(sections)}
</div>
<script>(function(){{var K='conn-perm-done',s={{}};try{{s=JSON.parse(localStorage.getItem(K)||'{{}}')}}catch(e){{}}
document.querySelectorAll('.dn input').forEach(function(b){{var k=b.getAttribute('data-k');b.checked=!!s[k];b.addEventListener('click',function(e){{e.stopPropagation()}});b.addEventListener('change',function(){{s[k]=b.checked;try{{localStorage.setItem(K,JSON.stringify(s))}}catch(e){{}}}})}})}})();</script>
"""
open(out, "w").write(page)
print("wrote", out, summary)
