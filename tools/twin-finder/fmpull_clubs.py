# Every club in the top 5 leagues, this season (Mikey, 15 Nov 2026: "find his next club").
# python3 fmpull_clubs.py FM_DIR  ->  FM_DIR/../clubs.json
# From FotMob's public pages: each league's table (one team page per league carries it), then each club's page:
# squad (age, position, value, nation), last line-up (formation + who started where), and the league-wide team stats
# files those pages point at (possession, xG, big chances, crosses, touches in the box, ball won high up, ...).
# --history: fetch every club again to add its past league finishes and trophy list.
# About 100 pages, one a second. Never commit the output.
import json, re, sys, os, time, gzip, urllib.request
OUT = os.path.join(sys.argv[1], '..', 'clubs.json')
SEED = {47: 9825, 87: 8633, 55: 8636, 54: 9823, 53: 9847}   # one club per league: Arsenal, Real Madrid, Inter, Bayern, PSG
STATS = ['rating_team', 'goals_team_match', 'goals_conceded_team_match', 'possession_percentage_team', 'expected_goals_team', 'expected_goals_conceded_team',
         'big_chance_team', 'accurate_pass_team', 'accurate_long_balls_team', 'accurate_cross_team', 'touches_in_opp_box_team', 'poss_won_att_3rd_team',
         'ontarget_scoring_att_team', 'clean_sheet_team']
def raw(u):
    b = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip'}), timeout=40).read()
    return gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b
def team(tid):
    h = raw(f'https://www.fotmob.com/teams/{tid}/squad/x').decode()
    return json.loads(re.search(r'__NEXT_DATA__" type="application/json">(.*?)</script>', h).group(1))['props']['pageProps']['fallback'][f'team-{tid}']
out = json.load(open(OUT)) if os.path.exists(OUT) else {'clubs': {}, 'stats': {}}
for lg, seed in SEED.items():
    d = team(seed); time.sleep(1)
    tb = next(t['data'] for t in d['table'] if t['data']['leagueId'] == lg)
    legend = {i: L['title'] for L in tb.get('legend', []) for i in L.get('indices', [])}
    rows = tb['table']['all']
    for i, r in enumerate(rows):
        out['clubs'].setdefault(str(r['id']), {}).update({'name': r['name'], 'short': r.get('shortName'), 'league': lg, 'pos': r['idx'], 'n': len(rows), 'played': r['played'],
                                                           'pts': r['pts'], 'gd': r['goalConDiff'], 'zone': legend.get(i)})
    for t_ in d['stats']['teams']:
        if t_['stat'] in STATS and f"{lg}|{t_['stat']}" not in out['stats']:
            j = json.loads(raw(t_['fetchAllUrl']))
            out['stats'][f"{lg}|{t_['stat']}"] = {str(x['TeamId']): x['StatValue'] for x in j['TopLists'][0]['StatList']}
            time.sleep(0.4)
    print(lg, len(rows), 'clubs', flush=True)
json.dump(out, open(OUT, 'w'))
REDO = '--history' in sys.argv   # 16 Nov 2026: also keep each club's past league finishes and trophies (club stature)
for tid, c in out['clubs'].items():
    if c.get('squad') and (not REDO or 'history' in c): continue
    try: d = team(tid)
    except Exception as e: print('skip', tid, e); continue
    sq = []
    for g in d['squad']['squad']:
        if g['title'] == 'coach': c['coach'] = (g['members'] or [{}])[0].get('name'); continue
        for m in g['members']:
            sq.append({'id': m['id'], 'name': m['name'], 'age': m.get('age'), 'pos': m.get('positionIdsDesc'), 'posIds': m.get('positionIds'), 'value': m.get('transferValue'), 'cc': m.get('ccode'),
                       'injured': bool(m.get('injury'))})
    c['squad'] = sq
    ll = (d['overview'] or {}).get('lastLineupStats') or {}
    c['formation'] = ll.get('formation')
    c['starters'] = [{'id': p['id'], 'name': p['name'], 'posId': p.get('positionId'), 'usual': p.get('usualPlayingPositionId')} for p in ll.get('starters', [])]
    hi = d.get('history') or {}
    c['history'] = [{'season': r.get('seasonName'), 'league': r.get('templateId'), 'name': r.get('tournamentName'), 'pos': r.get('position'), 'n': r.get('numberOfTeams')}
                    for r in (hi.get('historicalTableData') or {}).get('ranks', [])]
    c['divisions'] = (hi.get('historicalTableData') or {}).get('divisions', [])
    c['trophies'] = [{'name': x.get('name'), 'league': x.get('leagueId'), 'won': x.get('won'), 'seasonsWon': x.get('seasonsWon'), 'runnerup': x.get('runnerup')} for x in hi.get('trophyList', [])]
    c['colors'] = ((d['overview'] or {}).get('teamColors') or {}).get('lightMode') if isinstance((d['overview'] or {}).get('teamColors'), dict) else None
    json.dump(out, open(OUT, 'w')); print(c['name'], len(sq), c['formation'], flush=True); time.sleep(1)
print('done', len(out['clubs']))
