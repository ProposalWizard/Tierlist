"""Take the questions and the how-it-works block out of the kept patch-notes pages (Harry, 20 Oct: "'How these patch notes
work' doesn't need to be on every page, and you can remove the questions into a separate artifact").

Usage: python3 strip_questions.py            (from anywhere; edits patch-notes/pages/<version>/index.html in place)

For each of the 24 pages (0.60 to 0.84):
  - removes the "HOW THESE PATCH NOTES WORK" block (heading + drawing + 5 steps)
  - removes the NEEDS YOUR OK and ALREADY DECIDED sections (everything from the id="ok" heading up to the footer)
  - removes the header chips that pointed at them ("N need your OK", "N decided", "How this works")
For the index (0.75):
  - the how-it-works block becomes ONE small closed toggle near the top (keep_how_once)
  - the combined NEEDS YOUR OK / ALREADY DECIDED sections become one line that links the Patch Notes Questions artifact
  - the "N need your OK" pills on the cards go (the questions live in the other artifact now)
The questions themselves are in questions_data.py (they were read off these pages first; see build_questions.py).
Safe to run twice: a page with nothing left to strip is skipped.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..'))
PG = os.path.join(REPO, 'patch-notes', 'pages')

PAGES = ['0.60h', '0.61h', '0.62h', '0.63h', '0.64', '0.65', '0.66', '0.67', '0.68', '0.69', '0.70', '0.71', '0.72', '0.73', '0.74',
         '0.76', '0.77', '0.78', '0.79', '0.80', '0.81', '0.82', '0.83', '0.84']

RE_CHIPS = re.compile(r'<a class="chip(?: hot)?" href="#(?:ok|how)">[^<]*</a>')
RE_HOW = re.compile(r'\s*<h2 class="nxt" id="how"><i></i>HOW THESE PATCH NOTES WORK</h2><div class="how">.*?<p class="where">.*?</p></div>', re.S)
RE_OK = re.compile(r'\s*<h2 class="bug" id="ok">.*?(?=\s*<footer>)', re.S)


def strip_page(h):
    """Return (new html, did something). Every part must be found exactly once, or the page is not the shape this expects."""
    if 'id="ok"' not in h and 'id="how"' not in h:
        return h, False
    assert len(RE_HOW.findall(h)) == 1, 'how block'
    assert len(RE_OK.findall(h)) == 1, 'ok section'
    h = RE_HOW.sub('', h, count=1)
    h = RE_OK.sub('', h, count=1)
    n = len(RE_CHIPS.findall(h))
    assert n in (2, 3), 'chips %d' % n   # the OK chip, the How chip, and a Decided chip when something was decided
    h = RE_CHIPS.sub('', h)
    assert 'id="ok"' not in h and 'id="how"' not in h and 'href="#ok"' not in h and 'href="#how"' not in h
    return h, True



NOTES_URL = 'https://claude.ai/artifact/Jjqh5F2Qjym1GMBwhA2dSN'


def fix_refs(qurl):
    """Lines like "See Needs your OK." pointed at a section that is gone. Point them at the Q number on the Questions page."""
    link = '<a href="%s" target="_blank" rel="noopener">Patch Notes Questions</a>' % qurl
    subs = [
        ('0.76', 'See Needs your OK: add drawn offside pictures?', 'Q4 on the %s page: add drawn offside pictures?'),
        ('0.70', 'Waiting for your pick (below).', 'Waiting for your pick: Q21 on the %s page.'),
        ('0.78', 'None come before 1 January. See Needs your OK.', 'None come before 1 January. Q6 on the %s page.'),
        ('0.78', 'Run the checker again after it merges. See Needs your OK.', 'Run the checker again after it merges. Q7 on the %s page.'),
        ('0.79', 'Not changed. See Needs your OK.', 'Not changed. Q9 on the %s page.'),
        ('0.79', 'if you want them. See Needs your OK.', 'if you want them. Q8 on the %s page.'),
        ('0.80', 'See Needs your OK: hide it?', 'Q10 on the %s page: hide it?'),
        ('0.80', 'The emoji stays for now. See Needs your OK.', 'The emoji stays for now. Q11 on the %s page.'),
        ('0.81', 'goals now come easier. See Needs your OK.', 'goals now come easier. Q13 on the %s page.'),
        ('0.81', 'Found, not fixed. See Needs your OK.', 'Found, not fixed. Q15 on the %s page.'),
        ('0.82', 'until it runs. See Needs your OK.', 'until it runs. Q17 on the %s page.'),
        ('0.83', 'One question about Goal videos is open (below).', 'One question about Goal videos is open: Q20 on the %s page.'),
        ('0.84', 'Waiting on you (below).', 'Waiting on you: Q21 and Q22 on the %s page.'),
    ]
    for v, old, new in subs:
        p = os.path.join(PG, v, 'index.html')
        h = open(p, encoding='utf-8').read()
        if (new % link) in h:
            continue
        assert h.count(old) == 1, (v, old, h.count(old))
        open(p, 'w', encoding='utf-8').write(h.replace(old, new % link, 1))
    left = []
    for v in PAGES:
        h = open(os.path.join(PG, v, 'index.html'), encoding='utf-8').read()
        for m in re.finditer(r'(?i)needs your ok|\(below\)', h):
            left.append((v, h[max(0, m.start() - 50):m.end() + 20]))
    print('references fixed; left over:', left)


QLINE_CSS = ('.qline{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--amber);border-radius:var(--r);padding:11px 14px;margin:14px 0 0;font-size:15px}'
             '.qline b{color:var(--ink)} .howd{margin:12px 0 0}')
B17_CARD = ('<a class="bcard" href="%s#b17" target="_blank" rel="noopener"><div class="n"><b>B17 PC Match + Radar</b><span class="pill p-amb">Harry branch &middot; not live</span></div>'
            '<p>A test page: the real match beside a live radar of the whole pitch. Has a clip.</p><div class="vtag">v0.85 in Admin &rarr; Patch notes</div><span class="go">Open the notes &rarr;</span></a>') % NOTES_URL


def strip_index(h, qurl, n_open):
    """The index (0.75): one line for the questions, the how-it-works block once as a closed toggle, a B17 card."""
    if 'id="ok"' not in h:
        return h, False
    # the how block, rebuilt as a toggle
    m = re.search(r'<h2 class="nxt" id="how"><i></i>HOW THESE PATCH NOTES WORK</h2>(<div class="how">.*?<p class="where">.*?</p></div>)', h, re.S)
    assert m
    how = m.group(1)
    how = how.replace('4 Needs your OK, 5 the Read and understood button on the admin Patch notes page.', '4 Questions on their own page, 5 the Read and understood button on the admin Patch notes page.')
    how = how.replace('<text x="220" y="211">Needs your OK</text>', '<text x="220" y="211">Questions page</text>')
    old_li = re.search(r'<li><b>Needs your OK</b>.*?</li>', how, re.S).group(0)
    new_li = ('<li><b>Questions are not on the pages.</b> They are on one page, <a href="%s" target="_blank" rel="noopener">Patch Notes Questions</a>. '
              'Press <span class="btn">Read and understood</span> on the admin Patch notes page when you have read a page, so we know.</li>') % qurl
    how = how.replace(old_li, new_li, 1)
    assert 'Needs your OK' not in how
    howd = '<details class="howd" id="how"><summary>How these patch notes work</summary>%s</details>' % how
    qline = '<p class="qline"><b>Questions for you:</b> %d open &mdash; <a href="%s" target="_blank" rel="noopener">Patch Notes Questions &rarr;</a></p>' % (n_open, qurl)
    # replace everything from the how heading to the pages heading
    i = h.index('<h2 class="nxt" id="how">')
    j = h.index('<h2 class="nxt" id="pages">')
    h = h[:i] + qline + '\n' + howd + '\n\n' + h[j:]
    # header chips
    chips = re.search(r'<div class="chips">.*?</div>', h, re.S).group(0)
    new_chips = '<div class="chips"><a class="chip hot" href="%s" target="_blank" rel="noopener">%d questions open</a><a class="chip" href="#pages">The pages &darr;</a></div>' % (qurl, n_open)
    h = h.replace(chips, new_chips, 1)
    # pills on the cards
    h, n = re.subn(r'<span class="pill p-(?:blu|grn)">(?:\d+ need your OK|nothing waiting)</span>', '', h)
    assert n >= 15, n
    # B17: the queued card becomes a real one, after B16
    soon = re.search(r'<div class="bcard soon"><div class="n"><b>B17 A PC match layout</b>.*?</p></div>', h, re.S)
    assert soon
    h = h.replace(soon.group(0), '', 1)
    k = h.index('<h3 class="grp">Still building</h3>')
    assert h[k - 6:k] == '</div>'
    h = h[:k - 6] + B17_CARD + h[k - 6:]
    h = h.replace('Overnight work <small>15</small>', 'Overnight work <small>16</small>', 1)
    h = h.replace('v0.76 to v0.81, and the three topic pages v0.82 to v0.84. This index is v0.75.', 'v0.76 to v0.81, the three topic pages v0.82 to v0.84, and v0.85. This index is v0.75.', 1)
    h = h.replace('</style>', QLINE_CSS + '</style>', 1)
    assert 'id="ok"' not in h and 'need your OK' not in h and 'Needs your OK' not in h, 'left over'
    return h, True

if __name__ == '__main__':
    # python3 strip_questions.py                    strip the 24 pages
    # python3 strip_questions.py --refs QURL        point leftover "See Needs your OK" lines at the Questions page
    # python3 strip_questions.py --index QURL N     rebuild the index (0.75): questions line, how toggle, B17 card
    args = sys.argv[1:]
    if args[:1] == ['--refs']:
        fix_refs(args[1])
    elif args[:1] == ['--index']:
        p = os.path.join(PG, '0.75', 'index.html')
        h = open(p, encoding='utf-8').read()
        new, changed = strip_index(h, args[1], int(args[2]))
        if changed:
            open(p, 'w', encoding='utf-8').write(new)
        print('index', len(h), '->', len(new), 'changed' if changed else 'nothing to do')
    else:
        done = 0
        for v in PAGES:
            p = os.path.join(PG, v, 'index.html')
            h = open(p, encoding='utf-8').read()
            new, changed = strip_page(h)
            if changed:
                open(p, 'w', encoding='utf-8').write(new)
                done += 1
                print(v, len(h), '->', len(new))
            else:
                print(v, 'nothing to strip')
        print('pages changed', done)
