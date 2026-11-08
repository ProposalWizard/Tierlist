"""The Twin Finder method in Python, so a video and the Finder page give the same answer (Mikey, 9 Nov 2026).
Reads the packed data from tools/twin-finder/pack.py (top 5 leagues). Same rules as tools/twin-finder/index.html:
same position group only; stats per 90; ranked 0-100 within league + season + group (900+ minutes, 450+ this season);
weighted gap, skipping stats either side lacks; a candidate must share 60% of the weight; match % = 100 - gap;
2,000 tests with every weight shuffled to between 0.5 and 1.5 times."""
import json, math, random, collections, bisect

W = {
 'ST': {'npG': 3, 'npxG': 3, 'shots': 2, 'SoT': 1.5, 'conv': 1, 'bigMiss': 1, 'A': 1, 'xA': 1, 'chances': 1, 'bigCC': 1, 'drib': .5, 'passes': .5, 'pass%': .5, 'wonHigh': .5, 'def': .25, 'rec': .25, 'penWon': .5},
 'AMW': {'npG': 3, 'npxG': 3, 'shots': 2, 'SoT': 1, 'conv': 1, 'A': 2, 'xA': 2, 'chances': 2, 'bigCC': 2, 'drib': 1.5, 'drib%': .5, 'passes': 1, 'pass%': 1, 'long': .5, 'def': .5, 'rec': .5, 'wonHigh': .5, 'bigMiss': 1, 'penWon': .5, 'tkl': .25, 'int': .25},
 'MID': {'passes': 2, 'pass%': 2, 'long': 1.5, 'long%': 1, 'chances': 1.5, 'bigCC': 1, 'A': 1, 'xA': 1, 'npG': 1, 'npxG': 1, 'shots': .5, 'drib': 1, 'def': 1.5, 'tkl': 1.5, 'int': 1.5, 'rec': 1.5, 'wonHigh': 1, 'fouls': .5},
 'FB': {'def': 1.5, 'tkl': 1.5, 'int': 1.5, 'rec': 1, 'clear': 1, 'block': .5, 'chances': 1.5, 'bigCC': 1, 'A': 1, 'xA': 1, 'drib': 1, 'passes': 1, 'pass%': 1, 'long': 1, 'npG': .5, 'wonHigh': .5},
 'CB': {'def': 2, 'int': 2, 'tkl': 1, 'rec': 1, 'clear': 2, 'block': 1.5, 'passes': 2, 'pass%': 2, 'long': 2, 'long%': 1.5, 'npG': 1, 'A': .5, 'fouls': .5},
 'GK': {'save%': 3, 'prevented': 3, 'saves': 2, 'cs': 1.5, 'conceded': 1, 'long': 1.5, 'long%': 1, 'passes': 1, 'pass%': 1}}
W['ATT'] = W['AMW']
GROUP_NAME = {'GK': 'goalkeeper', 'CB': 'centre-back', 'FB': 'full-back', 'MID': 'midfielder', 'AMW': 'attacker', 'ST': 'striker', 'ATT': 'attacker'}

def group(pos):
    if pos == 11: return 'GK'
    if pos in (32, 38, 62, 68, 71, 72, 39, 31): return 'FB'
    if 30 <= pos < 40: return 'CB'
    if 60 <= pos < 80: return 'MID'
    if 80 <= pos < 100 or pos in (103, 104, 106, 107): return 'AMW'
    if pos >= 100: return 'ST'
    return 'MID'

def feats(r):
    p = (r.get('mins') or 0) / 90 or 1; pens = r.get('pens') or 0
    per = lambda k: None if r.get(k) is None else r[k] / p
    f = {'npG': ((r.get('G') or 0) - pens) / p, 'npxG': None if r.get('xG') is None else max(r['xG'] - 0.79 * pens, 0) / p,
         'A': (r.get('A') or 0) / p, 'xA': per('xA'), 'chances': per('CC'), 'bigCC': per('bigCC'), 'bigMiss': per('bigMiss'),
         'penWon': per('penWon'), 'prevented': per('prevented'), 'cs': per('cs')}
    for k in ('shots', 'SoT', 'conv', 'drib', 'drib%', 'passes', 'pass%', 'long', 'long%', 'def', 'tkl', 'int', 'rec', 'wonHigh', 'fouls', 'clear', 'block', 'saves', 'save%', 'conceded'):
        f[k] = r.get(k)
    return f

TOT = ['mins', 'apps', 'G', 'pens', 'A', 'xG', 'xA', 'xGOT', 'bigCC', 'CC', 'bigMiss', 'penWon', 'prevented', 'cs']

class Data:
    def __init__(self, path):
        D = json.load(open(path)); self.D = D; cols = D['cols']; self.CUR = len(D['seasons']) - 1
        self.rows = []
        for i in range(len(D['L'])):
            r = dict(zip(cols, D['X'][i]))
            o = {'i': i, 'name': D['names'][D['N'][i]], 'season': D['seasons'][D['S'][i]], 's': D['S'][i], 'league': D['L'][i],
                 'leagueName': D['leagues'][str(D['L'][i])] if str(D['L'][i]) in D['leagues'] else D['leagues'].get(D['L'][i]),
                 'teamId': D['T'][i], 'id': str(D['id'][i]), 'pos': D['P'][i], 'group': group(D['P'][i]), 'raw': r,
                 'mins_played': r.get('mins') or 0, 'goals': r.get('G'), 'goal_assist': r.get('A'), 'rating': r.get('rating')}
            o['f'] = feats(r); self.rows.append(o)
        self._pools = {}
    def min_ok(self, o): return o['mins_played'] >= (450 if o['s'] == self.CUR else 900)
    def in_group(self, o, g): return o['group'] in ('AMW', 'ST') if g == 'ATT' else o['group'] == g
    def pool(self, league, s, g):
        k = (league, s, g)
        if k not in self._pools:
            ids = [o for o in self.rows if o['league'] == league and o['s'] == s and self.in_group(o, g) and self.min_ok(o)]
            self._pools[k] = (ids, {key: sorted(o['f'][key] for o in ids if o['f'][key] is not None) for key in W[g]})
        return self._pools[k]
    @staticmethod
    def pct(sorted_vals, x):
        if x is None or not sorted_vals: return None
        lo = bisect.bisect_left(sorted_vals, x); hi = bisect.bisect_right(sorted_vals, x)
        return 100 * (lo + 0.5 * (hi - lo)) / len(sorted_vals)
    def pct_of(self, f, pool_, g): return {k: self.pct(pool_[1][k], f[k]) for k in W[g]}
    @staticmethod
    def dist(a, b, w):
        s = t = tot = 0
        for k, x in w.items():
            tot += x
            if a.get(k) is None or b.get(k) is None: continue
            s += x * (a[k] - b[k]) ** 2; t += x
        return math.sqrt(s / t) if t and t >= 0.6 * tot else 99
    def combine(self, rows):
        out = {}
        for c in self.D['cols']:
            if c in TOT:
                vals = [o['raw'][c] for o in rows if o['raw'].get(c) is not None]; out[c] = sum(vals) if vals else None
            else:
                s = w = 0
                for o in rows:
                    if o['raw'].get(c) is not None: s += o['raw'][c] * o['mins_played']; w += o['mins_played']
                out[c] = s / w if w else None
        return out
    def find(self, name, season):
        return [o for o in self.rows if o['name'] == name and o['season'] == season]
    def rank(self, target_rows, seasons, leagues, g=None, include_own=True, n=2000, seed=7):
        """-> (order [(dist, row)], wins {(name, season): count}, target pct, group, candidates)"""
        ref = sorted(target_rows, key=lambda o: o['s'])[-1]; g = g or ref['group']; w = W[g]
        tf = feats(self.combine(target_rows)); tp = self.pct_of(tf, self.pool(ref['league'], ref['s'], g), g)
        ids = {o['i'] for o in target_rows}; name = ref['name']
        cand = [o for o in self.rows if o['league'] in leagues and o['season'] in seasons and self.in_group(o, g) and self.min_ok(o)
                and o['i'] not in ids and (include_own or o['name'] != name)]
        cp = {o['i']: self.pct_of(o['f'], self.pool(o['league'], o['s'], g), g) for o in cand}
        order = sorted(((self.dist(tp, cp[o['i']], w), o) for o in cand), key=lambda x: x[0]); order = [x for x in order if x[0] < 99]
        others = [o for d, o in order if o['name'] != name][:60]; rnd = random.Random(seed); wins = collections.Counter()
        for _ in range(n):
            wr = {k: x * (0.5 + rnd.random()) for k, x in w.items()}
            b = min(others, key=lambda o: self.dist(tp, cp[o['i']], wr)); wins[(b['name'], b['season'])] += 1
        for o in cand: o['_pct'] = cp[o['i']]
        return order, wins, tp, tf, g, cand
