# Pull FotMob player-stat pages for several leagues (one page a second).  out: fm/raw_lg/<league>_<seasonId>_<stat>.json
import re,json,sys,time,os,urllib.request
LEAGUES={87:'laliga',54:'bundesliga',55:'seriea',53:'ligue1'}
STATS=['mins_played','goals','goal_assist','rating','expected_goals','expected_goalsontarget','ontarget_scoring_att','total_scoring_att','accurate_pass','big_chance_created','total_att_assist','accurate_long_balls','expected_assists','won_contest','big_chance_missed','penalty_won','defensive_contributions','total_tackle','interception','ball_recovery','poss_won_att_3rd','fouls','effective_clearance','outfielder_block','saves','_save_percentage','_goals_prevented','clean_sheet','goals_conceded']
os.makedirs('fm/raw_lg',exist_ok=True)
def get(u):
    h=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read().decode()
    return json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',h,re.S).group(1))['props']['pageProps']['data']
for lid,ln in LEAGUES.items():
    h=urllib.request.urlopen(urllib.request.Request(f'https://www.fotmob.com/leagues/{lid}/stats/{ln}',headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read().decode()
    sid0=re.findall(rf'/leagues/{lid}/stats/season/(\d+)/players/',h)[0]
    d=get(f'https://www.fotmob.com/leagues/{lid}/stats/season/{sid0}/players/goals/{ln}'); seasons=[(s['id'],s['name']) for s in d['seasons']][:11]
    json.dump(seasons,open(f'fm/raw_lg/{lid}_seasons.json','w')); print(ln,seasons,flush=True)
    for sid,sn in seasons:
        for st in STATS:
            f=f'fm/raw_lg/{lid}_{sid}_{st}.json'
            if os.path.exists(f): continue
            try:
                d=get(f'https://www.fotmob.com/leagues/{lid}/stats/season/{sid}/players/{st}/{ln}')
                json.dump({'league':lid,'season':sn,'stat':st,'rows':d['statsData'],'teamColors':d.get('teamColors')},open(f,'w'))
            except Exception as e: print('FAIL',ln,sn,st,str(e)[:60],flush=True)
            time.sleep(0.9)
        print('done',ln,sn,flush=True)
