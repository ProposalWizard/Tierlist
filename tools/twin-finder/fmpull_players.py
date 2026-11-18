# Ages, market values, current clubs, foot and country for every player who counts in the last two seasons
# (FotMob player pages). -> <dir>/../fmplayers.json (the same cache make_replace.py reads).
#   python3 fmpull_players.py <dir with twin_data.json> [threads]
import json, os, re, sys, time, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor
DIR = sys.argv[1]; TH = int(sys.argv[2]) if len(sys.argv) > 2 else 4
D = json.load(open(os.path.join(DIR, 'twin_data.json'))); cols = D['cols']; mi = cols.index('mins'); NS = len(D['seasons'])
ids = sorted({str(D['id'][i]) for i in range(len(D['L'])) if D['S'][i] >= NS - 2 and (D['X'][i][mi] or 0) >= 300})
CACHE = os.path.join(DIR, '..', 'fmplayers.json'); C = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
todo = [p for p in ids if p not in C or 'birth' not in C[p]]; print(len(ids), 'players,', len(todo), 'to fetch', flush=True)
lock = threading.Lock(); done = [0]
def one(pid):
    for attempt in range(3):
        try:
            h = urllib.request.urlopen(urllib.request.Request(f'https://www.fotmob.com/players/{pid}/x', headers={'User-Agent': 'Mozilla/5.0'}), timeout=40).read().decode()
            d = json.loads(re.search(r'__NEXT_DATA__" type="application/json">(.*?)</script>', h).group(1))['props']['pageProps']['data']
            pi = {x.get('title'): (x.get('value') or {}) for x in d.get('playerInformation', [])}
            m = re.search(r'"countryCode":\s*"([A-Z]{3})"', json.dumps(d)); pt = d.get('primaryTeam') or {}
            r = {'age': pi.get('Age', {}).get('numberValue'), 'birth': ((d.get('birthDate') or {}).get('utcTime') or '')[:10], 'value': pi.get('Market value', {}).get('numberValue'),
                 'team': pt.get('teamName'), 'teamId': pt.get('teamId'), 'onLoan': pt.get('onLoan'), 'contract': pi.get('Contract end', {}).get('dateValue'),
                 'foot': pi.get('Preferred foot', {}).get('key'), 'height': pi.get('Height', {}).get('numberValue'), 'cc': m.group(1) if m else None}
            break
        except Exception as e:
            r = None; time.sleep(2 + attempt * 3)
    with lock:
        if r: C[pid] = r
        done[0] += 1
        if done[0] % 100 == 0: json.dump(C, open(CACHE, 'w')); print(done[0], '/', len(todo), flush=True)
    time.sleep(0.15)
with ThreadPoolExecutor(TH) as ex: list(ex.map(one, todo))
json.dump(C, open(CACHE, 'w')); print('done', sum(1 for p in ids if p in C and 'birth' in C[p]), 'of', len(ids))
