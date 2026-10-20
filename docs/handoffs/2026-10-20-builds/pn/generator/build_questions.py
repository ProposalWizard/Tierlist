"""Build the "Patch Notes Questions" artifact: every open question from the patch notes on one page, numbered Q1, Q2, ...
so Harry can answer from his phone in a word ("Q4 yes"), then the answered ones in a closed toggle at the bottom.

Usage: PN_OUT=/abs/out python3 build_questions.py
  Reads   : questions_data.py
  Writes  : PN_OUT/questions/index.html   (publish it as its own private artifact, icon "list")
            patch-notes/questions/index.html (the kept copy in the repo)
Prints the number of open and decided questions."""
import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import CSS, OUT, BASE
from questions_data import GROUPS, OPEN, DECIDED, NOTES_URL

REPO = os.path.normpath(os.path.join(BASE, '..', '..', '..'))

EXTRA = """
  .qc{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--amber);border-radius:var(--r);padding:12px 14px;margin:0 0 12px;min-width:0}
  .qc.mikey{border-left-color:var(--blue)}
  .qh{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:0 0 7px}
  .qn{font-weight:900;font-size:13px;letter-spacing:.02em;background:var(--amber);color:var(--bg);border-radius:999px;padding:2px 11px}
  .qc.mikey .qn{background:var(--blue)}
  .qc .who{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
  .qt{font-weight:700;font-size:16px;line-height:1.35;margin:0 0 9px}
  .qc .opts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 9px}
  .qc .why{color:var(--ink2);font-size:14px;margin:0}
  .qc .rec{color:var(--ink2);font-size:14px;margin:6px 0 0}
  .qc .rec b{color:var(--green)}
  .qc .src{color:var(--ink3);font-size:12.5px;margin:9px 0 0}
  .qa{font-size:13.5px;color:var(--ink2);margin:0 0 12px}
  .qa b{color:var(--ink)}
  .gh{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin:18px 0 8px;font-weight:800}
  details .donebox{margin:0 0 6px}
"""


def tab_of(src):
    if src.startswith('Team Board'):
        return 'Team board &amp; team updates'
    if src.startswith('Admin Pages'):
        return 'Admin pages &amp; skins'
    if src.startswith('B') and '(v0.' in src:
        return 'Overnight work'
    return ''


def card(n, o):
    pills = ''
    for text, rec in o['opts']:
        if rec:
            pills += '<span class="pill p-grn">%s (recommended)</span>' % text
        else:
            pills += '<span class="pill p-blu">%s</span>' % text
    rec_line = '<p class="rec"><b>Recommended:</b> %s</p>' % o['rec'] if o.get('rec') else ''
    if o.get('nolink'):
        src = 'From: %s' % o['src']
    else:
        tab = tab_of(o['src'])
        src = 'From: <a href="%s" target="_blank" rel="noopener">%s</a>%s' % (NOTES_URL, o['src'], (' &middot; %s tab' % tab) if tab else '')
    mikey = ' mikey' if o['who'] == 'For Mikey' else ''
    return ('<div class="qc%s" id="q%d"><div class="qh"><span class="qn">Q%d</span><span class="who">%s</span></div>'
            '<p class="qt">%s</p><div class="opts">%s</div><p class="why">%s</p>%s<p class="src">%s</p></div>') % (
        mikey, n, n, o['who'], o['q'], pills, o['why'], rec_line, src)


def build():
    n = 0
    body = ''
    counts = {}
    for key, label, cls in GROUPS:
        items = OPEN[key]
        counts[key] = len(items)
        cards = ''
        for o in items:
            n += 1
            cards += card(n, o)
        body += '<h2 class="%s" id="g-%s"><i></i>%s &middot; %d</h2>%s' % (cls, key, label, len(items), cards)
    total_open = n
    decided = ''
    nd = 0
    for key, label, cls in GROUPS:
        rows = DECIDED[key]
        nd += len(rows)
        lis = ''.join('<li><div class="q">%s</div><div class="d"><span class="by">%s</span>%s</div></li>' % (q, by, a) for q, by, a in rows)
        decided += '<h3 class="gh">%s &middot; %d</h3><div class="donebox"><ul>%s</ul></div>' % (label, len(rows), lis)
    chips = ''.join('<a class="chip%s" href="#g-%s">%s %d</a>' % (' hot' if i == 0 else '', k, lab, counts[k]) for i, (k, lab, _) in enumerate(GROUPS))
    chips += '<a class="chip" href="#done">Decided %d</a>' % nd
    doc = """<title>Patch Notes Questions</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>%s%s</style>
<div class="wrap">
<header>
  <span class="ver">QUESTIONS &middot; 20 OCT 2026</span>
  <h1>%d questions are waiting. Answer each in a word, like &ldquo;Q4 leave it&rdquo;.</h1>
  <p class="status"><i></i>Every question has a recommended answer. The numbers stay the same.</p>
  <p class="sub">They come from the last 2 days of patch notes. The questions are no longer on the pages. Questions already answered are at the bottom.</p>
  <div class="chips">%s</div>
</header>

<p class="qa">The <b>From</b> link under a question opens the patch notes. Use the tab named there to find the page.</p>

%s

<h2 class="fix" id="done"><i></i>ALREADY DECIDED &middot; %d</h2>
<details><summary>%d answers, by tab. Each one is Harry&rsquo;s.</summary>%s</details>

<footer>20 Oct 2026. The questions come from the patch-notes pages v0.60 to v0.85. The same question on several pages is one question here. Private page.</footer>
</div>
""" % (CSS, EXTRA, total_open, chips, body, nd, nd, decided)
    return doc, total_open, nd, counts


if __name__ == '__main__':
    doc, no, nd, counts = build()
    out = os.path.join(OUT, 'questions')
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(doc)
    kept = os.path.join(REPO, 'patch-notes', 'questions')
    os.makedirs(kept, exist_ok=True)
    open(os.path.join(kept, 'index.html'), 'w', encoding='utf-8').write(doc)
    print('open', no, 'decided', nd, counts, 'bytes', len(doc.encode()))
