#!/usr/bin/env python3
"""scripts/supabase/sql-page.py — one page for SQL Harry runs by hand.

Harry, 23 Oct 2026: "whenever we do sqls give me artifacts - the name + full
copy and paste" (Brain note RUL-DAT-001). Each SQL file becomes a card: its
name, one line on what it does, a Copy button and the whole file, in the order
to run them. Publish the output with the Artifact tool.

Usage:
  python3 scripts/supabase/sql-page.py OUT.html "Title" \
      path/to/a.sql "What it does" [path/to/b.sql "What it does" ...]
  (a path may be git:<ref>:<path> to read it from a branch, e.g. git:origin/main:supabase/migrations/x.sql)
"""
import html, subprocess, sys

def read(p):
    if p.startswith("git:"):
        ref, path = p[4:].split(":", 1)
        return subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True, check=True).stdout
    return open(p, encoding="utf8").read()

out, title, rest = sys.argv[1], sys.argv[2], sys.argv[3:]
cards = []
for i in range(0, len(rest), 2):
    path, what = rest[i], rest[i + 1]
    name = path.rsplit("/", 1)[-1]
    sql = read(path).rstrip() + "\n"
    cards.append(f"""<section class="card"><div class="top"><span class="n">{i//2+1}</span><div class="nm"><b>{html.escape(name)}</b><span>{html.escape(what)}</span></div></div>
<button class="cp" type="button">Copy all</button><span class="ok" hidden>Copied ✓</span>
<pre tabindex="0">{html.escape(sql)}</pre></section>""")

page = f"""<title>{html.escape(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{{--bg:#f4f6f5;--card:#fff;--ink:#121a16;--ink2:#4d5f56;--line:#d9e1dc;--code:#f0f3f1;--acc:#0b7a43;--acc2:#fff;color-scheme:light}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#0b100e;--card:#141c18;--ink:#eef4f0;--ink2:#9fb3a8;--line:#26332c;--code:#0f1512;--acc:#3ddc84;--acc2:#06170e;color-scheme:dark}}}}
:root[data-theme="dark"]{{--bg:#0b100e;--card:#141c18;--ink:#eef4f0;--ink2:#9fb3a8;--line:#26332c;--code:#0f1512;--acc:#3ddc84;--acc2:#06170e;color-scheme:dark}}
body{{background:var(--bg);color:var(--ink);font:15.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding-block:22px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
.wrap{{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:14px}}
h1{{font-size:clamp(24px,6vw,32px);line-height:1.1;margin:0;text-wrap:balance}}
.how{{color:var(--ink2);margin:0}}.how b{{color:var(--ink)}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}}
.top{{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px}}
.n{{flex:none;width:28px;height:28px;border-radius:50%;background:var(--acc);color:var(--acc2);font-weight:800;display:flex;align-items:center;justify-content:center}}
.nm{{min-width:0;display:flex;flex-direction:column}}.nm b{{font-size:17px;overflow-wrap:anywhere}}.nm span{{color:var(--ink2);font-size:14px}}
.cp{{font:700 15px system-ui;background:var(--acc);color:var(--acc2);border:0;border-radius:10px;padding:11px 18px;cursor:pointer}}
.ok{{margin-left:10px;color:var(--acc);font-weight:700}}
pre{{background:var(--code);border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0 0;overflow:auto;max-height:420px;font:12.5px/1.45 ui-monospace,Menlo,Consolas,monospace;white-space:pre}}
</style>
<div class="wrap">
<h1>{html.escape(title)}</h1>
<p class="how">Supabase → <b>SQL Editor</b> → <b>New query</b>. For each card in order: <b>Copy all</b>, paste, <b>Run</b>. Each is safe to run twice.</p>
{''.join(cards)}
</div>
<script>
document.querySelectorAll('.card').forEach(function(c){{var b=c.querySelector('.cp'),p=c.querySelector('pre'),ok=c.querySelector('.ok');
b.addEventListener('click',function(){{var t=p.textContent;function sel(){{var r=document.createRange();r.selectNodeContents(p);var s=getSelection();s.removeAllRanges();s.addRange(r);ok.textContent='Selected: press copy';ok.hidden=false}}
try{{navigator.clipboard.writeText(t).then(function(){{ok.textContent='Copied ✓';ok.hidden=false;setTimeout(function(){{ok.hidden=true}},2500)}},sel)}}catch(e){{sel()}}}});}});
</script>
"""
open(out, "w", encoding="utf8").write(page)
print(f"wrote {out}: {len(cards)} SQL file(s)")
