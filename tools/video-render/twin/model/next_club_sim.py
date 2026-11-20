"""Next club, version 2 (Mikey, 16 Nov 2026): "level" from the long run, and his season simulated at every club.
  TWIN_DATA=<fm dir> python3 model/next_club_sim.py "Vinícius Júnior" OUT.json [runs]
Two parts, each 0-100:
  CLUB PULL  - how big the club is over time, not this season's table: average league finish over the last 10 full seasons
               (1st = 100, last = 0, a season outside the top flight = -25), all-time major trophies (league x3, Champions
               League x5, Europa League x2, domestic cups x1; the last 10 years count double), squad value, and this
               season's points per game (10%). Each part as the share of the 96 clubs below, then 45/25/20/10.
  HIS SEASON - his season at that club played `runs` times (sim_season.mts, the game's own match model): the club rated
               like the game rates a team (club_strength.py: average EA overall of the best eleven) with him in it.
               He must make their best eleven (else left out:
               "he wouldn't start"). Season score = 40 x title chance x league weight (the league's average club strength,
               70 = 0, the strongest league = 1) + 40 x Champions League win chance + 10 x top-places chance + 10 x his goals
               against the best club's goals.
  Total = 70% his season + 30% club pull. Left out: his own club, clubs whose squad is worth under 5x him."""
import json, os, sys, math, subprocess, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from finder_model import Data
from club_strength import Strength
MAJOR = {'league': 3, 'Champions League': 5, 'Europa League': 2}
CUPS = {'FA Cup', 'EFL Cup', 'Copa del Rey', 'Coppa Italia', 'DFB Pokal', 'Coupe de France', 'Coupe de la Ligue'}
TOPFLIGHT = {47, 87, 55, 54, 53}
LAST10 = [f"{y}/{y + 1}" for y in range(2016, 2026)]
def share(d, k): return 100 * sum(1 for x in d.values() if x < d[k]) / max(1, len(d) - 1)

def club_pull(C):
    fin, tro, val, cur = {}, {}, {}, {}
    for t, c in C.items():
        by = {h['season']: h for h in c.get('history', [])}
        sc = []
        for s in LAST10:
            h = by.get(s)
            sc.append(100 * (h['n'] - h['pos']) / (h['n'] - 1) if h and h.get('league') in TOPFLIGHT and h.get('pos') and h.get('n') else -25)
        fin[t] = sum(sc) / len(sc)
        pts = 0
        for x in c.get('trophies', []):
            nm = x.get('name') or ''; w = MAJOR.get(nm, 3 if str(x.get('league')) in {str(l) for l in TOPFLIGHT} else 1 if nm in CUPS else 0)
            if not w: continue
            won = [s for s in (x.get('seasonsWon') or '').split(',') if s]
            recent = sum(1 for s in won if s[:4].isdigit() and 2016 <= int(s[:4]) <= 2025)
            pts += w * ((x.get('won') or 0) + recent)
        tro[t] = math.log1p(pts)
        val[t] = sum(m.get('value') or 0 for m in c.get('squad', []))
        cur[t] = c['pts'] / max(1, c['played'])
    out = {}
    for t in C:
        out[t] = {'pull': round(0.45 * fin[t] + 0.25 * share(tro, t) + 0.2 * share(val, t) + 0.1 * share(cur, t), 1), 'finishes': round(fin[t], 1),
                  'trophyPts': round(math.expm1(tro[t])), 'squadValue': val[t], 'ppg': round(cur[t], 2),
                  'last10': [next((h['pos'] if h.get('league') in TOPFLIGHT else f"{h['name']} {h['pos']}") for h in C[t].get('history', []) if h['season'] == s) if any(h['season'] == s for h in C[t].get('history', [])) else None for s in LAST10]}
    return out

def run(D, data_dir, name, runs=400):
    sc_dir = os.path.join(data_dir, '..')
    st = Strength(os.path.join(sc_dir, 'clubs.json'), [os.path.join(sc_dir, f'sofifa{y}.json') for y in (2027, 2026)])
    C = st.C
    me = home = None
    for t, c in C.items():
        for m in c.get('squad', []):
            if m['name'] == name: me, home = m, t
    assert me, 'not in any top-5 squad today: ' + name
    ov = st.ov[me['id']][0]; extra = (ov, me['id'], me['name'], {x for x in (me.get('pos') or '').split(',') if x})
    # his share of his club's goals and assists, this season + last (only men with 450+ minutes are on file: a small undercount)
    seas = ['2025/26', '2026/27']; mine = [o for o in D.rows if str(o['id']) == str(me['id']) and o['season'] in seas]
    G = sum(o.get('goals') or 0 for o in mine)
    A = sum(o.get('goal_assist') or 0 for o in mine); mins = sum(o['mins_played'] for o in mine)
    team = collections.Counter(); games = {}
    for o in D.rows:
        if o['season'] in seas and any(o['season'] == m['season'] and o['teamId'] == m['teamId'] for m in mine): team[o['season']] += o.get('goals') or 0
    for m in mine: games[m['season']] = C[home]['played'] if m['season'] == '2026/27' else (38 if m['league'] in (47, 87, 55, 53) and C[home]['n'] == 20 else 34 if C[home]['n'] == 18 else 38)
    tg = sum(team.values()); gp = sum(games.values())
    P = {'goalShare': round(G / tg, 3) if tg else 0.2, 'assistShare': round(A / max(1, tg - G), 3) if tg else 0.15, 'avail': round(min(1, mins / (gp * 90)), 3),
         'goals': G, 'assists': A, 'teamGoals': tg, 'mins': mins, 'games': gp}
    pull = club_pull(C)
    val = (me.get('value') or 0)
    strength = {t: st.strength(t)[0] for t in C}
    cands = [t for t in C if t != home and C[t].get('squad') and pull[t]['squadValue'] >= 5 * val]
    withp = {t: st.strength(t, extra) for t in cands}
    IN = {'clubs': [{'id': t, 'name': C[t]['name'], 'league': C[t]['league'], 's': round(strength[t], 2), **({'sWith': round(withp[t][0], 2)} if t in withp else {})} for t in C],
          'cands': cands, 'player': P, 'cl': {'places': {'47': 4, '87': 4, '55': 4, '54': 4, '53': 3}}}
    tmp = os.path.join(sc_dir, 'sim_in.json'); tout = os.path.join(sc_dir, 'sim_out.json'); json.dump(IN, open(tmp, 'w'))
    subprocess.run(['npx', 'tsx', os.path.join(HERE, 'sim_season.mts'), tmp, tout, str(runs)], check=True, cwd=os.path.join(HERE, '..', '..', '..', '..'))
    SIM = json.load(open(tout))
    # a title is worth what its league is worth: the league's average club strength, 70 = nothing, the strongest league = 1
    lav = collections.defaultdict(list)
    for t in C: lav[C[t]['league']].append(strength[t])
    lav = {k: sum(v) / len(v) for k, v in lav.items()}; lw = {k: max(0, v - 70) / (max(lav.values()) - 70) for k, v in lav.items()}
    cands = [t for t in cands if any(x[2] == me['id'] for x in withp[t][1])]   # he must walk into their eleven
    gmax = max(SIM[t]['goals'] for t in cands) or 1
    rows = []
    for t in cands:
        s = SIM[t]; season = 40 * s['title'] * lw[C[t]['league']] + 40 * s['clWin'] + 10 * s['top'] + 10 * s['goals'] / gmax
        rows.append({'id': t, 'name': C[t]['name'], 'league': C[t]['league'], 'pos': C[t]['pos'], 'n': C[t]['n'], 'formation': C[t].get('formation'),
                     'strength': round(strength[t], 2), 'strengthWith': round(withp[t][0], 2), 'lift': round(withp[t][0] - strength[t], 2),
                     'xiWith': [[x[0], x[3], x[1]] for x in withp[t][1]], 'replaces': next((x[3] for x in st.strength(t)[1] if x[2] not in {y[2] for y in withp[t][1]}), None),
                     'season': round(season, 1), 'leagueWeight': round(lw[C[t]['league']], 2), 'sim': s, **pull[t]})
    smax = max(r['season'] for r in rows) or 1
    for r in rows: r['seasonScore'] = round(100 * r['season'] / smax, 1); r['total'] = round(0.7 * r['seasonScore'] + 0.3 * r['pull'], 1)
    rows.sort(key=lambda r: -r['total'])
    benched = [C[t]['name'] for t in withp if not any(x[2] == me['id'] for x in withp[t][1])]
    return {'benched': benched, 'leagueAvg': {str(k): round(v, 2) for k, v in lav.items()}, 'player': name, 'id': me['id'], 'home': home, 'overall': ov, 'value': val, 'pos': me.get('pos'), 'P': P, 'clubs': rows, 'n': len(C), 'runs': runs}

if __name__ == '__main__':
    D = Data(os.path.join(os.environ.get('TWIN_DATA', 'fm'), 'twin_data.json'))
    r = run(D, os.environ.get('TWIN_DATA', 'fm'), sys.argv[1], int(sys.argv[3]) if len(sys.argv) > 3 else 400)
    json.dump(r, open(sys.argv[2], 'w'), ensure_ascii=False)
    print(r['player'], 'overall', r['overall'], 'shares', r['P'], 'benched at', r['benched'], 'leagues', r['leagueAvg'])
    for x in r['clubs'][:10]:
        s = x['sim']; print(f"{x['total']:5.1f} {x['name']:24s} season {x['seasonScore']:5.1f} pull {x['pull']:5.1f} | str {x['strength']}->{x['strengthWith']} replaces {x['replaces']} | title {s['title']:.0%} top {s['top']:.0%} CLwin {s['clWin']:.0%} goals {s['goals']:.1f} avgPos {s['avgPos']:.1f}")
