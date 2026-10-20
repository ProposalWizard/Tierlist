"""Build the ONE multi-file artifact: the four-tab index plus every patch-notes page, with relative links so a card opens
its page inside the artifact (Harry, 20 Oct: "why are they opening as external links rather than just opening in the artifact?").

Usage: PN_OUT=/abs/out python3 build_site.py
  Reads   : patch-notes/pages/<version>/ (the kept copies), PN_OUT/urls.json (key -> artifact url), the four-tab index
            (patch-notes/pages/0.75/index.html, which carries the claude.ai links).
  Writes  : PN_OUT/site/index.html            the index, with relative links (the artifact's main page)
            PN_OUT/site/pages/<key>/index.html each page, wrapped as its own document, with a sticky "back" bar
            PN_OUT/site/pages/<key>/img|clips  the page's pictures and clips
            PN_OUT/site/files.json             list of every published path, in two rounds (max 255 files per publish)
The kept copies in the repo are NOT changed: the admin archive needs their absolute links.

After 20 Oct the kept copies in patch-notes/pages are the source of truth: the questions and the how-it-works block were taken out of
them by strip_questions.py, B7's Vision was rewritten by fix_b7_vision.py, B17 is made by run_b17.py. The older page generators
(b*.py, d19.py, topics.py, index19.py, index_topics.py) still write the old blocks if run again: run strip_questions.py after them.
The questions are in questions_data.py and become the Patch Notes Questions artifact (build_questions.py)."""
import os, re, json, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import OUT, BASE
from topics import URLS

REPO = os.path.normpath(os.path.join(BASE, '..', '..', '..'))
PG = os.path.join(REPO, 'patch-notes', 'pages')
SITE = os.path.join(OUT, 'site')

PAGES = [  # key, kept version
    ('t82', '0.82'), ('t83', '0.83'), ('t84', '0.84'),
    ('b1', '0.66'), ('b3', '0.67'), ('b4', '0.68'), ('b5', '0.69'), ('b6', '0.70'), ('b7', '0.71'), ('b8', '0.72'), ('b9', '0.73'),
    ('b11', '0.74'), ('b12', '0.76'), ('b7b', '0.77'), ('b13', '0.78'), ('b15', '0.79'), ('b9b', '0.80'), ('b16', '0.81'),
    ('a19admin', '0.65'), ('a19team', '0.60'), ('a19drift', '0.62'), ('a19fhr', '0.63'), ('a19data', '0.64'), ('a19scene', '0.61'),
    ('b17', '0.85'), ('b2', '0.86'), ('b19', '0.87'), ('b10', '0.88'), ('lag', '0.89'), ('jobs', '0.90'),   # these have no artifact of their own: each is a page of this one
]

PAGE_KEYS = {k for k, _ in PAGES}

up = os.path.join(OUT, 'urls.json')
if os.path.exists(up):
    URLS.update(json.load(open(up)))
ID2KEY = {}
for k, u in URLS.items():
    m = re.match(r'https://claude\.ai/artifact/([A-Za-z0-9]+)$', u)
    if m:
        ID2KEY[m.group(1)] = k

BASE_CSS = ('<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
            'html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>')
NAV_CSS = ('<style>.pnnav{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;background:var(--bg);border-bottom:1px solid var(--line)}'
           '.pnnav a{display:flex;align-items:center;max-width:760px;margin:0 auto;min-height:44px;box-sizing:border-box;padding:0 max(16px,env(safe-area-inset-left,0px));'
           'font-size:14px;font-weight:800;color:var(--blue);text-decoration:none}'
           'body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:30;background:var(--bg)}</style>')
NAV = '<nav class="pnnav"><a href="../../#pages">&larr; All patch notes</a></nav>'


def localize(html, prefix, index_href):
    """Anchors that point at a page in this artifact become relative links in the same tab. Others stay as they were."""
    def fix(m):
        tag = m.group(0)
        hm = re.search(r'href="https://claude\.ai/artifact/([A-Za-z0-9]+)"', tag)
        if not hm or hm.group(1) not in ID2KEY:
            return tag
        key = ID2KEY[hm.group(1)]
        if key != 'last2' and key not in PAGE_KEYS:   # another artifact (e.g. the Questions page): stays an external link
            return tag
        rel = index_href if key == 'last2' else '%s%s/index.html' % (prefix, key)
        tag = tag.replace(hm.group(0), 'href="%s"' % rel)
        tag = re.sub(r'\s+target="_blank"', '', tag)
        tag = re.sub(r'\s+rel="noopener"', '', tag)
        return tag
    return re.sub(r'<a\b[^>]*>', fix, html)


if os.path.isdir(SITE):
    shutil.rmtree(SITE)
os.makedirs(os.path.join(SITE, 'pages'))
published = []   # (published path, absolute source)

for key, ver in PAGES:
    src_dir = os.path.join(PG, ver)
    h = open(os.path.join(src_dir, 'index.html'), encoding='utf-8').read()
    assert h.startswith('<title>'), key
    cut = h.index('<div class="wrap">')
    head, body = h[:cut], h[cut:]
    body = re.sub(r'<a class="back"[^>]*>[^<]*</a><br>', '', body, count=1)   # the old "all notes" link; the sticky bar replaces it
    body = localize(body, '../', '../../#pages')
    doc = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
           + BASE_CSS + head + NAV_CSS + '</head><body>' + NAV + body + '</body></html>')
    out_dir = os.path.join(SITE, 'pages', key)
    os.makedirs(out_dir)
    open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8').write(doc)
    published.append(('pages/%s/index.html' % key, os.path.join(out_dir, 'index.html')))
    for sub in ('img', 'clips'):
        d = os.path.join(src_dir, sub)
        if os.path.isdir(d):
            shutil.copytree(d, os.path.join(out_dir, sub))
            for f in sorted(os.listdir(d)):
                published.append(('pages/%s/%s/%s' % (key, sub, f), os.path.join(out_dir, sub, f)))

idx = open(os.path.join(PG, '0.75', 'index.html'), encoding='utf-8').read()
idx = localize(idx, 'pages/', 'index.html')
# B17, B2 and B19's cards link the notes artifact with #b17 in the kept copy (the admin archive needs an absolute link); here it opens the page
idx = re.sub(r'<a class="bcard" href="https://claude\.ai/artifact/Jjqh5F2Qjym1GMBwhA2dSN#(\w+)" target="_blank" rel="noopener">', r'<a class="bcard" href="pages/\1/index.html">', idx)
assert 'artifact/Jjqh5F2Qjym1GMBwhA2dSN#' not in idx
note = 'This index is v0.75. Pages open here, in the same tab: use &ldquo;&larr; All patch notes&rdquo; at the top of a page to come back.'
assert 'This index is v0.75.' in idx
idx = idx.replace('This index is v0.75.', note, 1)
open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8').write(idx)

# every path must be unique; split into two rounds
paths = [p for p, _ in published]
assert len(paths) == len(set(paths))
rounds = [published[:250], published[250:]]
json.dump({'count': len(published) + 1, 'bytes': sum(os.path.getsize(s) for _, s in published) + len(idx.encode()),
           'round1': [p for p, _ in rounds[0]], 'round2': [p for p, _ in rounds[1]]}, open(os.path.join(SITE, 'files.json'), 'w'), indent=1)
print('pages', len(PAGES), 'files', len(published) + 1, 'round1', len(rounds[0]), 'round2', len(rounds[1]),
      'MB', round((sum(os.path.getsize(s) for _, s in published) + len(idx)) / 1e6, 1))
