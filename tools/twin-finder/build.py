"""Build the Twin Finder page folder: python3 build.py FM_DIR OUT_DIR
FM_DIR holds raw/ (Premier League) and raw_lg/ (other leagues) from the FotMob pulls. Writes OUT_DIR/index.html + data.js."""
import json, os, sys, shutil, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); FM, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
data = os.path.join(FM, 'twin_data.json'); cache = os.path.join(FM, 'twin_teams.json')
subprocess.run([sys.executable, '-I', os.path.join(HERE, 'pack.py'), FM, data], check=True)
subprocess.run([sys.executable, '-I', os.path.join(HERE, 'teams.py'), data, cache], check=True)
D = json.load(open(data)); T = json.load(open(cache))
import glob, time
fs = glob.glob(os.path.join(FM, 'raw*', '*.json')); D['asOf'] = time.strftime('%d %b %Y', time.gmtime(max(os.path.getmtime(f) for f in fs)))
D['teams'] = {k: v['name'] for k, v in T.items() if v.get('name')}; D['badges'] = {k: v['badge'] for k, v in T.items() if v.get('badge')}
pl = os.path.join(FM, '..', 'fmplayers.json')   # ages, values, clubs today (fmpull_players.py); the Replace tab reads D.players
if os.path.exists(pl):
    P = json.load(open(pl)); NS = len(D['seasons']); ids = {str(D['id'][i]) for i in range(len(D['L'])) if D['S'][i] >= NS - 2}
    D['players'] = {k: [v.get('age'), None if v.get('value') is None else round(v['value'] / 1e6, 1), v.get('team'), v.get('foot'), (v.get('contract') or '')[:4] or None, v.get('teamId')]
                    for k, v in P.items() if k in ids}
    D['playersAsOf'] = time.strftime('%d %b %Y', time.gmtime(os.path.getmtime(pl)))
cl = os.path.join(FM, '..', 'clubs.json')   # every top-5 club this season (fmpull_clubs.py --history); the Next club tab reads D.clubs
if os.path.exists(cl):
    sys.path.insert(0, os.path.join(HERE, '..', 'video-render', 'twin', 'model'))
    from club_strength import Strength; from next_club_sim import club_pull
    sof = [os.path.join(FM, '..', f'sofifa{y}.json') for y in (2027, 2026)]   # EA ratings from our sofifa_players table (see club_strength.py)
    ST = Strength(cl, [f for f in sof if os.path.exists(f)]); PULL = club_pull(ST.C)
    D['clubs'] = {t: {'name': c['name'], 'short': c.get('short'), 'league': c['league'], 'pos': c['pos'], 'n': c['n'], 'played': c['played'], 'pts': c['pts'], 'zone': c.get('zone'),
                      'formation': c.get('formation'),
                      'squad': [[m['id'], m['name'], m.get('age'), m.get('pos'), ST.ov[m['id']][0], 1 if ST.ov[m['id']][1] == 'ea' else 0, m.get('value')] for m in c.get('squad', [])],
                      'pull': PULL[t]['pull'], 'finishes': PULL[t]['finishes'], 'trophyPts': PULL[t]['trophyPts'], 'last10': PULL[t]['last10'], 'squadValue': PULL[t]['squadValue']}
                  for t, c in ST.C.items() if c.get('squad')}
    D['clubsAsOf'] = time.strftime('%d %b %Y', time.gmtime(os.path.getmtime(cl)))
open(os.path.join(OUT, 'data.js'), 'w').write('window.TWIN_DATA=' + json.dumps(D, separators=(',', ':'), ensure_ascii=False) + ';')
shutil.copy(os.path.join(HERE, 'index.html'), os.path.join(OUT, 'index.html'))
print('built', OUT, os.path.getsize(os.path.join(OUT, 'data.js')) // 1024, 'KB')
