import re,json,sys,time,os,urllib.request
SEAS=[(36781,'2026/27'),(27110,'2025/26'),(23685,'2024/25'),(20720,'2023/24'),(17664,'2022/23'),(16390,'2021/22'),(15382,'2020/21'),(14022,'2019/20'),(12776,'2018/19'),(11522,'2017/18'),(10418,'2016/17')]
STATS=['effective_clearance','outfielder_block','saves','_save_percentage','_goals_prevented','clean_sheet','goals_conceded']
os.makedirs('fm/raw',exist_ok=True)
for sid,sn in SEAS:
  for st in STATS:
    f=f'fm/raw/{sid}_{st}.json'
    if os.path.exists(f): continue
    u=f'https://www.fotmob.com/leagues/47/stats/season/{sid}/players/{st}/premier-league'
    try:
      h=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read().decode()
      d=json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',h,re.S).group(1))['props']['pageProps']['data']
      json.dump({'season':sn,'stat':st,'cur':d.get('currentStatName'),'sub':d.get('substatTitle'),'rows':d['statsData']},open(f,'w'))
      print(sn,st,len(d['statsData']),d.get('currentStatName'),d.get('substatTitle'),flush=True)
    except Exception as e: print('FAIL',sn,st,str(e)[:80],flush=True)
    time.sleep(1)
