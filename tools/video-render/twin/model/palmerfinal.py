import os; DATA=os.environ.get('TWIN_DATA','fm')  # folder for the downloaded FotMob pages (never commit it)
from model import *
import json
P,bys=pool(); W=noxg(W_PALMER); R={}
def get(n,s): return [v for v in P if v['name']==n and v['season']==s][0]
pal=get('Cole Palmer','2024/25'); p23=get('Cole Palmer','2023/24')
tgt={k:(pal['pct'][k]+p23['pct'][k])/2 for k in W}
old=[v for v in P if v['season'] in('2016/17','2017/18')]
R['pool']=[('2016/17',len(bys['2016/17'])),('2017/18',len(bys['2017/18']))]
base,wins=runs(tgt,old,W); R['top8']=[(v['name'],v['season'],round(d,1),v.get('goals'),v.get('goal_assist'),v['mins_played']) for d,v in base[:8]]; R['wins']=wins.most_common(4)
b2,w2=runs(pal['pct'],[v for v in P if v['season']=='2016/17'],W); R['p2425_vs_1617']=[(v['name'],round(d,1)) for d,v in b2[:4]]; R['p2425_wins']=w2.most_common(3)
b3,w3=runs(p23['pct'],[v for v in P if v['season']=='2016/17'],W); R['p2324_vs_1617']=[(v['name'],round(d,1)) for d,v in b3[:4]]; R['p2324_wins']=w3.most_common(3)
cou=get('Philippe Coutinho','2016/17')
R['vs_coutinho_pct']={k:(round(tgt[k]),round(cou['pct'][k])) for k in W}
R['palmer_raw_2425']={k:round(pal['f'][k],2) for k in ['npG','A','chances','bigCC','shots','drib','passes','long']}
R['palmer_raw_2324']={k:round(p23['f'][k],2) for k in ['npG','A','chances','bigCC','shots','drib','passes','long']}
R['coutinho_raw']={k:round(cou['f'][k],2) for k in ['npG','A','chances','bigCC','shots','drib','passes','long']}
L=bys['2024/25']
R['palmer2425_rank_of']=len(L); R['palmer2425_ranks']={k:[i+1 for i,v in enumerate(sorted(L,key=lambda v:-v['f'][k])) if v['name']=='Cole Palmer'][0] for k in ['chances','long','bigCC','shots','passes']}
R['weights']=W
json.dump(R,open('palmer_final.json','w'),indent=0,ensure_ascii=False); print(json.dumps(R,ensure_ascii=False)[:2500])
