import sys, json, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from b1_b4 import b1, b4
from b7_b9 import b7, b9
from b11_b3 import b11, b3
from b6_b8 import b6, b8
from b5 import b5
from d19 import admin19, team19, drift19, fhr19, data19, scene19
import index19
from index19 import PAGES, build_index, build_old_index

urls = {}
up = os.path.join(OUT, 'urls.json')
if os.path.exists(up): urls = json.load(open(up))
index_url = urls.get('last2', '')

FNS = [('b1', b1), ('b3', b3), ('b4', b4), ('b5', b5), ('b6', b6), ('b7', b7), ('b8', b8), ('b9', b9), ('b11', b11),
       ('a19admin', admin19), ('a19team', team19), ('a19drift', drift19), ('a19fhr', fhr19), ('a19data', data19), ('a19scene', scene19)]
meta = {}
nopen = {}
for key, fn in FNS:
    p, spec = fn()
    assert spec['key'] == key, (key, spec['key'])
    assert spec['ver'] == PAGES[key][1], (key, spec['ver'], PAGES[key][1])
    d, no, nd = write_page(p, spec, index_url)
    nopen[key] = no
    fm = {}
    for pub, src in p.used: fm['img/' + pub] = os.path.join(d, 'img', pub)
    for pub, src in p.clips: fm['clips/' + pub] = os.path.join(d, 'clips', pub)
    json.dump(fm, open(os.path.join(d, 'files.json'), 'w'), indent=1)
    size = sum(os.path.getsize(src) for _, src in p.used) + sum(os.path.getsize(src) for _, src in p.clips)
    meta[key] = dict(title=spec['title'], ver=spec['ver'], nopen=no, ndone=nd, imgs=len(p.used), clips=len(p.clips), bytes=size, html=os.path.getsize(os.path.join(d, 'index.html')))
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)

os.makedirs(os.path.join(OUT, 'last2'), exist_ok=True)
open(os.path.join(OUT, 'last2', 'index.html'), 'w', encoding='utf-8').write(build_index(urls, nopen))
os.makedirs(os.path.join(OUT, 'index'), exist_ok=True)
open(os.path.join(OUT, 'index', 'index.html'), 'w', encoding='utf-8').write(build_old_index(urls, nopen, index_url or '#'))
print(json.dumps(meta, indent=1))
