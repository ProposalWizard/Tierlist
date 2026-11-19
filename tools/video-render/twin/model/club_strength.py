"""Every top-5 club's strength the way Road to Ballon d'Or rates a team (Mikey, 16 Nov 2026: simulate his season at each club).
The game: a team's strength = the average EA (SoFIFA) overall of its starting eleven (lib/star/leagueSquads.ts
averageStartingXIRating), and season.ts simulateFixtureScore turns two strengths into a score.
Here: each club's squad today (FotMob, clubs.json) -> each man's overall from our sofifa_players table (FC 27 where it has
him, else FC 26; matched by name), else an estimate from his market value -> the best eleven in a 4-3-3
(GK; RB, CB, CB, LB; three midfielders; LW, ST, RW), filled greedily by overall from the men who play there.
with_player(): the same club with one more man (the player we are moving), so the gain = how much he lifts them."""
import json, math, re, unicodedata, collections
SLOTS = ['GK', 'RB', 'CB', 'CB', 'LB', 'MID', 'MID', 'MID', 'LW', 'ST', 'RW']
FITS = {'GK': {'GK'}, 'RB': {'RB', 'RWB'}, 'LB': {'LB', 'LWB'}, 'CB': {'CB'}, 'MID': {'CM', 'CDM', 'CAM', 'DM', 'AM', 'LM', 'RM'},
        'LW': {'LW', 'LM'}, 'RW': {'RW', 'RM'}, 'ST': {'ST', 'CF'}}
def norm(s): return [w for w in re.sub(r"[^a-z ]", " ", unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower()).split() if w]
def name_match(fm, so):
    a, b = norm(fm), norm(so)
    if not a or not b: return False
    words = [w for w in b if len(w) > 1]; inits = [w for w in b if len(w) == 1]
    if not words or not all(w in a for w in words): return False
    return not inits or any(x.startswith(inits[0]) for x in a)

class Strength:
    def __init__(self, clubs_path, sofifa_paths):
        self.C = json.load(open(clubs_path))['clubs']
        rows = []
        for p in sofifa_paths: rows += json.load(open(p))
        self.by_last = collections.defaultdict(list)   # last name -> rows, newest edition first
        for r in sorted(rows, key=lambda r: -(r.get('fifa_year') or 2027)):
            ov = r.get('manual_overall') or r.get('overall')
            if ov is None: continue
            ws = [w for w in norm(r['name']) if len(w) > 1]
            if ws: self.by_last[ws[-1]].append((r, ov))
        self.ov = {}; vals = []
        for t, c in self.C.items():
            for m in c.get('squad', []):
                o = self.lookup(m['name'])
                if o is not None:
                    self.ov[m['id']] = (o, 'ea')
                    if m.get('value'): vals.append((math.log(m['value']), o))
        # everyone else: an estimate from his market value (a straight line through the men we have)
        n = len(vals); mx = sum(v for v, _ in vals) / n; my = sum(o for _, o in vals) / n
        self.b = sum((v - mx) * (o - my) for v, o in vals) / sum((v - mx) ** 2 for v, _ in vals); self.a = my - self.b * mx
        for t, c in self.C.items():
            for m in c.get('squad', []):
                if m['id'] not in self.ov: self.ov[m['id']] = (round(self.a + self.b * math.log(m['value']), 1) if m.get('value') else 60.0, 'value')
    def lookup(self, name):
        a = norm(name)
        for key in ([a[-1]] if a else []) + a[:-1]:
            for r, ov in self.by_last.get(key, []):
                if name_match(name, r['name']): return ov
        return None
    def xi(self, squad, extra=None):
        men = [(self.ov[m['id']][0], m['id'], m['name'], {x for x in (m.get('pos') or '').split(',') if x}) for m in squad if not m.get('injuredLong')]
        if extra: men.append(extra)
        used = set(); xi = []
        for slot in sorted(range(len(SLOTS)), key=lambda i: SLOTS[i] == 'MID'):   # the specific slots first, midfield last
            s = SLOTS[slot]; best = None
            for ov, pid, nm, pos in men:
                if pid in used or not (pos & FITS[s]): continue
                if best is None or ov > best[0]: best = (ov, pid, nm)
            if best is None:   # nobody listed there: the best man left who is not a keeper
                for ov, pid, nm, pos in men:
                    if pid in used or ('GK' in pos) != (s == 'GK'): continue
                    if best is None or ov > best[0]: best = (ov, pid, nm)
            if best: used.add(best[1]); xi.append((s, best[0], best[1], best[2]))
        return xi
    def strength(self, tid, extra=None):
        xi = self.xi(self.C[tid].get('squad', []), extra); return sum(x[1] for x in xi) / max(1, len(xi)), xi
