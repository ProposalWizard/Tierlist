import os; DATA=os.environ.get('TWIN_DATA','fm')  # folder for the downloaded FotMob pages (never commit it)
from model import *
import json,random,collections
P9,b9=pool(900); P4,b4=pool(450)
def season_pool(s): return b4[s] if s=='2026/27' else b9[s]
def rank_in(f,L,W): return {k:100*(sum(1 for y in L if y['f'][k]<f[k])+0.5*sum(1 for y in L if y['f'][k]==f[k]))/len(L) for k in W}
def solve(tf,cands,W,n=2000,seed=7,own=None):
    # target ranked against its OWN era (own = list of attacker seasons it played in); every candidate ranked in its own season
    T=rank_in(tf,own,W); tp=collections.defaultdict(lambda:T)
    base=sorted(((dist(tp[v['season']],v['pct'],W),v) for v in cands),key=lambda x:x[0])
    rnd=random.Random(seed); wins=collections.Counter()
    for _ in range(n):
        Wr={k:w*rnd.uniform(.5,1.5) for k,w in W.items()}
        b=min(cands,key=lambda v:dist(tp[v['season']],v['pct'],Wr)); wins[(b['name'],b['season'])]+=1
    return base,wins
def row(d,v,wins): return {'name':v['name'],'id':v['id'] if 'id' in v else None,'season':v['season'],'teamId':v['teamId'],'match':round(100-d,1),'sure10':round(wins.get((v['name'],v['season']),0)/200,1),'mins':v['mins_played'],'goals':v.get('goals'),'pens':v.get('goals__sub'),'assists':v.get('goal_assist'),'f':{k:round(x,2) for k,x in v['f'].items()}}
# need ids: table keys are season|id
for L in (P9,P4):
    for v in L: pass
idx={(v['season'],v['name']):k.split('|')[1] for k,v in t.items()}
OUT={}
# SALAH
sal=[v for v in P9 if v['name']=='Mohamed Salah' and v['season']=='2024/25'][0]
five=['2022/23','2023/24','2024/25','2025/26','2026/27']
c=[v for s in five for v in season_pool(s) if v['name']!='Mohamed Salah']
base,wins=solve(sal['f'],c,W_SALAH,own=b9['2024/25'])
OUT['salah_target']={'name':'Mohamed Salah','season':'2024/25','teamId':sal['teamId'],'f':{k:round(x,2) for k,x in sal['f'].items()},'goals':sal.get('goals'),'pens':sal.get('goals__sub'),'assists':sal.get('goal_assist'),'mins':sal['mins_played']}
OUT['salah_pool']={s:len(season_pool(s)) for s in five}
OUT['salah_top8']=[row(d,v,wins) for d,v in base[:8]]
cur=[v for v in season_pool('2026/27') if v['name']!='Mohamed Salah']
base,wins=solve(sal['f'],cur,W_SALAH,own=b9['2024/25']); OUT['salah_now5']=[row(d,v,wins) for d,v in base[:5]]
ds=sorted(dist(sal['pct'],v['pct'],W_SALAH) for v in b9['2024/25'] if v is not sal); OUT['salah_typical']=round(100-ds[len(ds)//2],1)
# PALMER combined
raw=[v for v in t.values() if v['name']=='Cole Palmer' and v['season'] in('2024/25','2025/26','2026/27')]
M=sum(g(v,'mins_played') for v in raw); comb={'mins_played':M}
TOT=['goals','goals__sub','goal_assist','expected_goals','expected_goalsontarget','expected_assists','big_chance_created','total_att_assist','big_chance_missed','penalty_won']
P90=['total_scoring_att','ontarget_scoring_att','won_contest','accurate_pass','accurate_long_balls','defensive_contributions','total_tackle','interception','ball_recovery','poss_won_att_3rd','fouls','total_scoring_att__sub','won_contest__sub','accurate_pass__sub']
for k in TOT: comb[k]=sum(g(v,k) for v in raw)
for k in P90: comb[k]=sum(g(v,k)*g(v,'mins_played') for v in raw)/M
pf=feats(comb); W=noxg(W_PALMER)
c=b9['2016/17']; base,wins=solve(pf,c,W,own=b9['2024/25']+b9['2025/26']+b4['2026/27'])
OUT['palmer_target']={'seasons':sorted((v['season'],v['mins_played'],v.get('goals'),v.get('goal_assist')) for v in raw),'mins':M,'goals':comb['goals'],'pens':comb['goals__sub'],'assists':comb['goal_assist'],'f':{k:round(x,2) for k,x in pf.items()}}
OUT['palmer_pool']=len(c); OUT['palmer_top8']=[row(d,v,wins) for d,v in base[:8]]
p25=[v for v in P9 if v['name']=='Cole Palmer' and v['season']=='2024/25'][0]
base,wins=solve(p25['f'],c,W,own=b9['2024/25']); OUT['palmer2425_top3']=[row(d,v,wins) for d,v in base[:3]]
for k in ('salah_top8','salah_now5','palmer_top8','palmer2425_top3'):
    for r in OUT[k]: r['id']=idx[(r['season'],r['name'])]
OUT['salah_target']['id']=idx[('2024/25','Mohamed Salah')]; OUT['palmer_target']['id']=idx[('2024/25','Cole Palmer')]; OUT['palmer_target']['teamId']=p25['teamId']
json.dump(OUT,open('v2data.json','w'),indent=1,ensure_ascii=False)
for k in ('salah_pool','salah_typical'): print(k,OUT[k])
for k in ('salah_top8','salah_now5','palmer_top8','palmer2425_top3'): print(k,[(r['name'],r['season'],r['match'],r['sure10']) for r in OUT[k]])
print('palmer target',OUT['palmer_target']['seasons'],OUT['palmer_target']['mins'],{k:OUT['palmer_target']['f'][k] for k in ['npG','A','chances','bigCC','drib','passes','long','shots']})
