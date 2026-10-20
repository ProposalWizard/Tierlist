"""Build only some of the overnight pages (and the index).
Usage: PN_OUT=/abs/out python3 run_new.py b1 b3 b9 b12 b7b b13 index
(PN_OUT must hold urls.json: page key -> artifact url.)
The 19 Oct pages (stills in other folders) are not rebuilt here; the index takes their
open-question counts from NOPEN below."""
import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import index19
from index19 import PAGES, build_index

urls = json.load(open(os.path.join(OUT, 'urls.json')))
index_url = urls.get('last2', '')


def fns():
    from b1_b4 import b1
    from b7_b9 import b9
    from b11_b3 import b3
    from b12_b7b_b13 import b12, b7b, b13
    from b15_b9b import b15, b9b
    return {'b1': b1, 'b3': b3, 'b9': b9, 'b12': b12, 'b7b': b7b, 'b13': b13, 'b15': b15, 'b9b': b9b}


# open-question counts for pages not rebuilt here (read off the live index, 20 Oct)
NOPEN = {'b4': 0, 'b5': 1, 'b6': 2, 'b7': 2, 'b8': 2, 'b11': 2, 'a19admin': 2, 'a19team': 0, 'a19drift': 0,
         'a19fhr': 0, 'a19data': 0, 'a19scene': 0}

want = sys.argv[1:]
F = fns()
mp = os.path.join(OUT, 'meta.json')
meta = json.load(open(mp)) if os.path.exists(mp) else {}
nopen = dict(NOPEN)
for key, fn in F.items():
    if key not in want and 'all' not in want:
        continue
    p, spec = fn()
    assert spec['key'] == key, (key, spec['key'])
    assert spec['ver'] == PAGES[key][1], (key, spec['ver'], PAGES[key][1])
    d, no, nd = write_page(p, spec, index_url)
    fm = {}
    for pub, src in p.used:
        fm['img/' + pub] = os.path.join(d, 'img', pub)
    for pub, src in p.clips:
        fm['clips/' + pub] = os.path.join(d, 'clips', pub)
    json.dump(fm, open(os.path.join(d, 'files.json'), 'w'), indent=1)
    size = sum(os.path.getsize(s) for _, s in p.used) + sum(os.path.getsize(s) for _, s in p.clips)
    meta[key] = dict(title=spec['title'], ver=spec['ver'], nopen=no, ndone=nd, imgs=len(p.used), clips=len(p.clips),
                     bytes=size, html=os.path.getsize(os.path.join(d, 'index.html')))
json.dump(meta, open(mp, 'w'), indent=1)
for k, v in meta.items():
    nopen[k] = v['nopen']
if 'index' in want or 'all' in want:
    os.makedirs(os.path.join(OUT, 'last2'), exist_ok=True)
    open(os.path.join(OUT, 'last2', 'index.html'), 'w', encoding='utf-8').write(build_index(urls, nopen))
print(json.dumps({k: v for k, v in meta.items() if k in want or 'all' in want}, indent=1))
