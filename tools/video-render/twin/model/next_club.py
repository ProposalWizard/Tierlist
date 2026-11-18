"""Find a player's next club (Mikey, 15 Nov 2026: "according to the statistics, find his best suited club ... it ticks
all sorts of checks for both the club and the player"). Same method as the Twin Finder page's "Next club" tab.

Every club in the top 5 leagues this season (clubs.json from tools/twin-finder/fmpull_clubs.py) gets three scores, 0-100:
  NEED  - would he be an upgrade where he plays? His FotMob rating (this season + last, minutes-weighted) against the best
          player the club has in his position (a man with under 900 minutes there counts as unproven, at most 6.6).
          their man = the best of whoever started there in their last line-up
          or is listed there first. 1 point of rating better = all 85. +15 if their man is 31 or older.
  FIT   - does the way they play suit his kind of player? This season's team stats, each ranked against all the clubs
          (standard deviations), a recipe per position (an attacker wants a team that keeps the ball, makes chances and
          gets into the box). A wide player loses 25 fit (and 40% of need) if their last line-up had nobody in
          his position.
  LEVEL - is it good for him? Points per game (50%) and squad value (50%), each as a share of the clubs below.
  Total = 40% need + 30% fit + 30% level. Left out: his own club, and clubs whose whole squad is worth less than five
  times him ("can't afford him")."""
import json, math, os, collections
EQUIV = {'LM': 'LW', 'RM': 'RW', 'LWB': 'LB', 'RWB': 'RB', 'CF': 'ST'}
RECIPE = {   # team stat -> weight (negative = lower is better)
    'AMW': {'possession': 1, 'xg': 1, 'bigc': 1, 'box': 1},
    'ST': {'xg': 1.5, 'bigc': 1.5, 'cross': 0.75, 'box': 1},
    'MID': {'possession': 1.5, 'passes': 1.5, 'high': 1},
    'FB': {'possession': 1, 'cross': 1, 'xga': -1, 'high': 0.5},
    'CB': {'possession': 1, 'passes': 1, 'xga': -1.5, 'long': 0.5},
    'GK': {'possession': 1, 'passes': 1, 'xga': -1}}
SAY = {'possession': 'possession', 'xg': 'xG a game', 'bigc': 'big chances a game', 'box': 'touches in the box a game', 'cross': 'crosses a game',
       'passes': 'passes a game', 'high': 'balls won high up a game', 'xga': 'xG against a game', 'long': 'long balls a game'}
def team_stats(C, tid):
    c = C['clubs'][tid]; lg = c['league']; p = max(1, c['played']); g = lambda k: C['stats'].get(f'{lg}|{k}', {}).get(tid)
    per = lambda k: None if g(k) is None else g(k) / p
    return {'possession': g('possession_percentage_team'), 'xg': per('expected_goals_team'), 'bigc': per('big_chance_team'), 'box': per('touches_in_opp_box_team'),
            'cross': g('accurate_cross_team'), 'passes': g('accurate_pass_team'), 'high': g('poss_won_att_3rd_team'), 'xga': per('expected_goals_conceded_team'),
            'long': g('accurate_long_balls_team')}
def fam(desc): return EQUIV.get(desc, desc)
def first_pos(m): return fam((m.get('pos') or '').split(',')[0])

class NextClub:
    def __init__(self, D, clubs_path, seasons):
        self.D = D; self.C = json.load(open(clubs_path)); self.seas = seasons
        self.by = collections.defaultdict(list)
        for o in D.rows:
            if o['season'] in seasons: self.by[str(o['id'])].append(o)
        self.posmap = {}   # FotMob position id -> short name, from the squads ('87,106' <-> 'LW,ST')
        for c in self.C['clubs'].values():
            for m in c.get('squad', []):
                for i, d in zip((m.get('posIds') or '').split(','), (m.get('pos') or '').split(',')):
                    if i and d: self.posmap[int(i)] = fam(d)
        self.ts = {t: team_stats(self.C, t) for t in self.C['clubs']}
    def rating(self, pid):
        rs = [o for o in self.by.get(str(pid), []) if o.get('rating') is not None]
        m = sum(o['mins_played'] for o in rs)
        return (sum(o['rating'] * o['mins_played'] for o in rs) / m if m else None), m
    def find(self, pid, group, value):
        me = None; home = None
        for t, c in self.C['clubs'].items():
            for m in c.get('squad', []):
                if str(m['id']) == str(pid): me, home = m, t
        pos = first_pos(me) if me else None
        Rt, _ = self.rating(pid)
        rec = RECIPE[group]
        # fit: z of each team stat across every club, then the recipe
        zs = {}
        for k in {k for r in RECIPE.values() for k in r}:
            vals = [s[k] for s in self.ts.values() if s.get(k) is not None]; mu = sum(vals) / len(vals); sd = math.sqrt(sum((v - mu) ** 2 for v in vals) / len(vals)) or 1
            zs[k] = {t: (s[k] - mu) / sd for t, s in self.ts.items() if s.get(k) is not None}
        fitraw = {t: sum(w * zs[k].get(t, 0) for k, w in rec.items()) / sum(abs(w) for w in rec.values()) for t in self.C['clubs']}
        ppg = {t: c['pts'] / max(1, c['played']) for t, c in self.C['clubs'].items()}
        sval = {t: sum(m.get('value') or 0 for m in c.get('squad', [])) for t, c in self.C['clubs'].items()}
        share = lambda d, t: 100 * sum(1 for x in d.values() if x < d[t]) / max(1, len(d) - 1)
        out = []
        for t, c in self.C['clubs'].items():
            if t == home or not c.get('squad'): continue
            if value and sval[t] < 5 * value: continue
            # who plays there now: whoever started in his position in their last line-up, or is listed there first; the best of them
            st = [str(x['id']) for x in c.get('starters', []) if self.posmap.get(x.get('posId')) == pos]
            inc = [m for m in c['squad'] if str(m['id']) in st or first_pos(m) == pos]
            best = None
            for m in inc:
                r, mins = self.rating(m['id'])
                if r is None: continue
                q = r if mins >= 900 else min(r, 6.6)
                if best is None or q > best[0]: best = (q, m, r, mins)
            Rinc = best[0] if best else 6.4
            need = max(0, min(1, (Rt - Rinc) / 1.0)) * 85 + (15 if best and (best[1].get('age') or 0) >= 31 else 0)
            fit = share(fitraw, t)
            starts_pos = any(self.posmap.get(s.get('posId')) == pos for s in c.get('starters', []))
            wide = pos in ('LW', 'RW', 'LB', 'RB')
            if wide and c.get('starters') and not starts_pos: fit = max(0, fit - 25); need *= 0.6   # no wide man in their team: less room for him
            level = 0.5 * share(ppg, t) + 0.5 * share(sval, t)
            tot = 0.4 * min(100, need) + 0.3 * fit + 0.3 * level
            top2 = sorted(((w * zs[k].get(t, 0), k) for k, w in rec.items()), reverse=True)[:2]
            rankof = lambda k, sign: 1 + sum(1 for s in self.ts.values() if s.get(k) is not None and self.ts[t].get(k) is not None and sign * s[k] > sign * self.ts[t][k])
            out.append({'id': t, 'name': c['name'], 'short': c.get('short') or c['name'], 'league': c['league'], 'pos': c['pos'], 'n': c['n'], 'zone': c.get('zone'),
                        'formation': c.get('formation'), 'total': round(tot, 1), 'need': round(min(100, need), 1), 'fit': round(fit, 1), 'level': round(level, 1),
                        'inc': {'id': best[1]['id'], 'name': best[1]['name'], 'age': best[1].get('age'), 'rating': round(best[2], 2), 'mins': best[3]} if best else None,
                        'rt': round(Rt, 2), 'startsPos': starts_pos,
                        'fitFacts': [{'k': k, 'v': self.ts[t][k], 'rank': rankof(k, 1 if rec[k] > 0 else -1), 'of': len(self.ts)} for _, k in top2],
                        'ppg': round(ppg[t], 2), 'squadValue': sval[t]})
        out.sort(key=lambda r: -r['total'])
        return {'pos': pos, 'home': home, 'rt': Rt, 'clubs': out, 'n': len(self.C['clubs'])}
