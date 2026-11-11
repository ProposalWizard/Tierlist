import os; DATA=os.environ.get('TWIN_DATA','fm')  # folder for the downloaded FotMob pages (never commit it)
from model import *
import json
R={}
P,bys=pool(); P2,_=pool(450)
def get(n,s,L=P): return [v for v in L if v['name']==n and v['season']==s][0]
sal=get('Mohamed Salah','2024/25')
seas=['2020/21','2021/22','2022/23','2023/24','2024/25','2025/26']
allc=[v for v in P if v['season'] in seas and v is not sal]
base,wins=runs(sal['pct'],allc,W_SALAH)
R['salah_all']=[(v['name'],v['season'],round(d,1)) for d,v in base[:8]]; R['salah_all_wins']=wins.most_common(4)
oth=[v for v in allc if v['name']!='Mohamed Salah']
base,wins=runs(sal['pct'],oth,W_SALAH); R['salah_oth']=[(v['name'],v['season'],round(d,1)) for d,v in base[:8]]; R['salah_oth_wins']=wins.most_common(4)
eq={k:1 for k in W_SALAH}; att={k:W_SALAH[k] for k in ['npG','npxG','shots','SoT','A','xA','chances','bigCC']}
R['salah_oth_eq']=runs(sal['pct'],oth,eq)[0][0][1]['name']; R['salah_oth_att']=[(v['name'],v['season']) for d,v in runs(sal['pct'],oth,att)[0][:2]]
WING=(83,84,86,87,103,107)
wc=[v for v in P if v['season'] in('2024/25','2025/26') and v['pos'] in WING and v['name']!='Mohamed Salah']
base,wins=runs(sal['pct'],wc,W_SALAH); R['wing']=[(v['name'],v['season'],round(d,1)) for d,v in base[:5]]; R['wing_wins']=wins.most_common(3)
cur={v['name']:v for v in P2 if v['season']=='2026/27'}; last={v['name']:v for v in P if v['season']=='2025/26'}
blend=[]
for n,a in cur.items():
    b=last.get(n); pct={k:.65*a['pct'][k]+.35*b['pct'][k] for k in a['pct']} if b else a['pct']
    blend.append({'name':n,'season':'now','pct':pct,'pos':a['pos'],'mins':a['mins_played']})
base,wins=runs(sal['pct'],blend,W_SALAH); R['now']=[(v['name'],round(d,1),v['mins']) for d,v in base[:5]]; R['now_wins']=wins.most_common(4)
R['now_eq']=runs(sal['pct'],blend,eq)[0][0][1]['name']
ch=[b for b in blend if b['name']=='Rayan Cherki'][0]
kane=get('Harry Kane','2021/22'); bar=get('Harvey Barnes','2024/25')
for nm,o in [('kane',kane),('barnes',bar),('cherki',ch)]: R['vs_'+nm]={k:(round(sal['pct'][k]),round(o['pct'][k])) for k in W_SALAH}
R['pool']=[(s,len(bys[s])) for s in seas]
json.dump(R,open('salah_final.json','w'),indent=0,ensure_ascii=False)
for k,v in R.items():
    if not k.startswith('vs_'): print(k,v)
for k in ['vs_kane','vs_barnes','vs_cherki']: print(k,R[k])
