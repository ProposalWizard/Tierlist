import os; DATA=os.environ.get('TWIN_DATA','fm')  # folder for the downloaded FotMob pages (never commit it)
import re,json,sys,time,os,urllib.request
SEAS=[(36781,'2026/27'),(27110,'2025/26'),(23685,'2024/25'),(20720,'2023/24'),(17664,'2022/23'),(16390,'2021/22'),(15382,'2020/21'),(14022,'2019/20'),(12776,'2018/19'),(11522,'2017/18'),(10418,'2016/17')]
STATS=['mins_played','goals','goal_assist','rating','expected_goals','expected_goalsontarget','ontarget_scoring_att','total_scoring_att','accurate_pass','big_chance_created','total_att_assist','accurate_long_balls','expected_assists','won_contest','big_chance_missed','penalty_won','defensive_contributions','total_tackle','interception','ball_recovery','poss_won_att_3rd','fouls','phys_ts','phys_sprints','phys_tdc']
os.makedirs(DATA+'/raw',exist_ok=True)
for sid,sn in SEAS:
  for st in STATS:
    f=DATA+f'/raw/{sid}_{st}.json'
    if os.path.exists(f): continue
    u=f'https://www.fotmob.com/leagues/47/stats/season/{sid}/players/{st}/premier-league'
    try:
      h=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read().decode()
      d=json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',h,re.S).group(1))['props']['pageProps']['data']
      json.dump({'season':sn,'stat':st,'cur':d.get('currentStatName'),'sub':d.get('substatTitle'),'rows':d['statsData']},open(f,'w'))
      print(sn,st,len(d['statsData']),d.get('currentStatName'),d.get('substatTitle'),flush=True)
    except Exception as e: print('FAIL',sn,st,str(e)[:80],flush=True)
    time.sleep(1)
