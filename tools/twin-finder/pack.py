"""Twin Finder data pack: FotMob player-stat pages (PL from model/fmpull.py, other leagues from fmpull_lg.py)
-> one compact JSON the page loads (columns, not objects). usage: python3 pack.py FM_DIR OUT.json
Keeps players with 450+ minutes. Per-90/percent stats as FotMob gives them; totals kept as totals (the page
adds seasons together and divides by minutes)."""
import json, glob, os, re, sys, collections
FM, OUT = sys.argv[1], sys.argv[2]
LEAGUE = {47: 'Premier League', 87: 'La Liga', 55: 'Serie A', 54: 'Bundesliga', 53: 'Ligue 1'}
PL_SEASONS = {36781: '2026/27', 27110: '2025/26', 23685: '2024/25', 20720: '2023/24', 17664: '2022/23', 16390: '2021/22', 15382: '2020/21', 14022: '2019/20', 12776: '2018/19', 11522: '2017/18', 10418: '2016/17'}
# stat -> (column for statValue, column for substatValue or None)
MAP = {'mins_played': ('mins', 'apps'), 'goals': ('G', 'pens'), 'goal_assist': ('A', None), 'rating': ('rating', None), 'expected_goals': ('xG', None),
       'expected_goalsontarget': ('xGOT', None), 'ontarget_scoring_att': ('SoT', None), 'total_scoring_att': ('shots', 'conv'), 'accurate_pass': ('passes', 'pass%'),
       'big_chance_created': ('bigCC', None), 'total_att_assist': ('CC', None), 'accurate_long_balls': ('long', 'long%'), 'expected_assists': ('xA', None),
       'won_contest': ('drib', 'drib%'), 'big_chance_missed': ('bigMiss', None), 'penalty_won': ('penWon', None), 'defensive_contributions': ('def', None),
       'total_tackle': ('tkl', None), 'interception': ('int', None), 'ball_recovery': ('rec', None), 'poss_won_att_3rd': ('wonHigh', None), 'fouls': ('fouls', None),
       'effective_clearance': ('clear', None), 'outfielder_block': ('block', None), 'saves': ('saves', None), '_save_percentage': ('save%', None),
       '_goals_prevented': ('prevented', None), 'clean_sheet': ('cs', None), 'goals_conceded': ('conceded', None)}
COLS = ['mins', 'apps', 'G', 'pens', 'A', 'xG', 'xA', 'xGOT', 'shots', 'conv', 'SoT', 'passes', 'pass%', 'long', 'long%', 'bigCC', 'CC', 'drib', 'drib%', 'bigMiss',
        'penWon', 'def', 'tkl', 'int', 'rec', 'wonHigh', 'fouls', 'clear', 'block', 'saves', 'save%', 'prevented', 'cs', 'conceded', 'rating']
rows = collections.defaultdict(dict); colors = {}
def season_name(s):
    m = re.match(r'(\d{4})/(\d{4})$', s); return f"{m.group(1)}/{m.group(2)[2:]}" if m else s
def add(lid, season, stat, data, tc=None):
    if stat not in MAP: return
    a, b = MAP[stat]
    for r in data:
        k = (lid, season, r['id']); o = rows[k]
        o.update(name=r['name'], team=r['teamId'], pos=r.get('position'))
        o[a] = r['statValue']['value']
        if b and r.get('substatValue'): o[b] = r['substatValue']['value']
    if tc: colors.update({int(k): v.get('darkMode') or v.get('lightMode') for k, v in tc.items() if isinstance(v, dict)})
for f in glob.glob(os.path.join(FM, 'raw', '*.json')):
    d = json.load(open(f)); add(47, d['season'], d['stat'], d['rows'])
for f in glob.glob(os.path.join(FM, 'raw_lg', '*_*_*.json')):
    d = json.load(open(f)); add(d['league'], season_name(d['season']), d['stat'], d['rows'], d.get('teamColors'))
keep = [(k, v) for k, v in rows.items() if (v.get('mins') or 0) >= 450 and 'name' in v]
names = sorted({v['name'] for k, v in keep}); nidx = {n: i for i, n in enumerate(names)}
seasons = sorted({k[1] for k, v in keep}); sidx = {s: i for i, s in enumerate(seasons)}
out = {'leagues': LEAGUE, 'seasons': seasons, 'names': names, 'cols': COLS,
       'L': [], 'S': [], 'N': [], 'P': [], 'T': [], 'id': [], 'X': [],
       'teamColors': colors}
for (lid, s, pid), v in sorted(keep, key=lambda kv: (kv[0][1], kv[0][0])):
    out['L'].append(lid); out['S'].append(sidx[s]); out['N'].append(nidx[v['name']]); out['P'].append(v.get('pos') or 0); out['T'].append(v['team']); out['id'].append(pid)
    out['X'].append([None if v.get(c) is None else round(v[c], 3) for c in COLS])
json.dump(out, open(OUT, 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(keep), 'player-seasons;', collections.Counter(LEAGUE.get(k[0]) for k, v in keep), os.path.getsize(OUT) // 1024, 'KB')
