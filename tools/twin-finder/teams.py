"""Club names (FotMob short names; the project's CLUB_SHORT_NAMES first) and small badges (40 px, data URIs) for every
team in the pack. Cached in CACHE.json so re-runs only fetch new teams. usage: python3 teams.py data.json CACHE.json"""
import json, sys, re, os, io, base64, urllib.request, concurrent.futures as cf
from PIL import Image
D = json.load(open(sys.argv[1])); CACHE = sys.argv[2]
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
ts = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'lib', 'star', 'clubs.ts')).read()
SHORT = dict(re.findall(r'"([^"]+)":\s*"([^"]+)"', ts[ts.index('CLUB_SHORT_NAMES'):ts.index('};', ts.index('CLUB_SHORT_NAMES'))]))
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=40).read()
def one(tid):
    out = {}
    try:
        h = get(f'https://www.fotmob.com/teams/{tid}/overview/x').decode()
        full = re.search(r'<title[^>]*>([^<]+?) - ', h).group(1).strip(); sh = re.search(r'"shortName":\s*"([^"]+)"', h)
        out['name'] = SHORT.get(full) or (sh.group(1) if sh else full)
    except Exception: out['name'] = None
    try:
        im = Image.open(io.BytesIO(get(f'https://images.fotmob.com/image_resources/logo/teamlogo/{tid}.png'))).convert('RGBA'); im.thumbnail((40, 40))
        b = io.BytesIO(); im.save(b, 'PNG', optimize=True); out['badge'] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
    except Exception: out['badge'] = None
    return str(tid), out
todo = sorted({t for t in D['T'] if str(t) not in cache})
with cf.ThreadPoolExecutor(4) as ex:
    for tid, o in ex.map(one, todo): cache[tid] = o
json.dump(cache, open(CACHE, 'w'))
print(len(todo), 'fetched;', len(cache), 'teams;', sum(1 for v in cache.values() if v.get('name')), 'named')
