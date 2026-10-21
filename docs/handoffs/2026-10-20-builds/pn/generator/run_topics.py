"""Build the three topic pages (v0.82 to v0.84) and the four-tab index (v0.75).
Usage: PN_OUT=/abs/out python3 run_topics.py t82 t83 t84 index        (or: all)
PN_OUT is where built pages go. If PN_OUT/urls.json exists (key -> artifact url) its links are used for the topic cards
(add "t82", "t83", "t84" after they are published, then build "index").
Kept copies for the repo: copy PN_OUT/<key>/ to patch-notes/pages/<version>/ (t82 -> 0.82, t83 -> 0.83, t84 -> 0.84, last2 -> 0.75)."""
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import topics
from topics import team_page, admin_page, else_page, URLS
import index_topics

NOPEN = {'b1': 0, 'b3': 1, 'b4': 0, 'b5': 1, 'b6': 2, 'b7': 2, 'b8': 2, 'b9': 0, 'b11': 2, 'b12': 2, 'b7b': 2, 'b13': 2, 'b15': 2, 'b9b': 2, 'b16': 2}

up = os.path.join(OUT, 'urls.json')
if os.path.exists(up):
    URLS.update(json.load(open(up)))

want = sys.argv[1:]
FN = {'t82': team_page, 't83': admin_page, 't84': else_page}
specs = {}
meta = {}
for key, fn in FN.items():
    p, spec = fn()
    specs[key] = spec
    if key in want or 'all' in want:
        d, no, nd = write_page(p, spec, URLS['last2'])
        fm = {}
        for pub, src in p.used:
            fm['img/' + pub] = os.path.join(d, 'img', pub)
        for pub, src in p.clips:
            fm['clips/' + pub] = os.path.join(d, 'clips', pub)
        json.dump(fm, open(os.path.join(d, 'files.json'), 'w'), indent=1)
        size = sum(os.path.getsize(s) for _, s in p.used) + sum(os.path.getsize(s) for _, s in p.clips)
        meta[key] = dict(title=spec['title'], ver=spec['ver'], nopen=no, ndone=nd, imgs=len(p.used), clips=len(p.clips), bytes=size,
                         html=os.path.getsize(os.path.join(d, 'index.html')))

if 'index' in want or 'all' in want:
    body, n_open, n_done = index_topics.build_topic_index(URLS, NOPEN, specs)
    os.makedirs(os.path.join(OUT, 'last2'), exist_ok=True)
    open(os.path.join(OUT, 'last2', 'index.html'), 'w', encoding='utf-8').write(body)
    meta['index'] = dict(open=n_open, done=n_done, html=len(body))
print(json.dumps(meta, indent=1))
