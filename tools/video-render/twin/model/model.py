import os; DATA=os.environ.get('TWIN_DATA','fm')  # folder for the downloaded FotMob pages (never commit it)
import json,random,math,collections,sys
t=json.load(open(DATA+'/table.json'))
def g(v,k): return v.get(k) or 0
def feats(v):
    m=g(v,'mins_played'); p=m/90
    pens=g(v,'goals__sub'); shots=g(v,'total_scoring_att')
    npxg=max(g(v,'expected_goals')-0.79*pens,0)
    return {
     'npG':(g(v,'goals')-pens)/p,'npxG':npxg/p,'shots':shots,'xG_per_shot':(npxg/p/shots if shots else 0),
     'SoT':g(v,'ontarget_scoring_att'),'conv':g(v,'total_scoring_att__sub'),'finish':(g(v,'expected_goalsontarget')-g(v,'expected_goals'))/p,
     'A':g(v,'goal_assist')/p,'xA':g(v,'expected_assists')/p,'chances':g(v,'total_att_assist')/p,'bigCC':g(v,'big_chance_created')/p,
     'drib':g(v,'won_contest'),'drib%':g(v,'won_contest__sub'),'passes':g(v,'accurate_pass'),'pass%':g(v,'accurate_pass__sub'),
     'long':g(v,'accurate_long_balls'),'def':g(v,'defensive_contributions'),'tkl':g(v,'total_tackle'),'int':g(v,'interception'),
     'rec':g(v,'ball_recovery'),'wonAtt3rd':g(v,'poss_won_att_3rd'),'bigMiss':g(v,'big_chance_missed')/p,'penWon':g(v,'penalty_won')/p}
def pool(minm=900):
    P=[dict(v) for v in t.values() if (v.get('pos') or 0)>=83 and g(v,'mins_played')>=minm and v.get('total_scoring_att') is not None and v.get('accurate_pass') is not None and v.get('won_contest') is not None]
    bys=collections.defaultdict(list)
    for v in P: v['f']=feats(v); bys[v['season']].append(v)
    for s,L in bys.items():
        for k in L[0]['f']:
            vals=sorted(x['f'][k] for x in L)
            for x in L:
                lo=sum(1 for y in vals if y<x['f'][k]); eq=sum(1 for y in vals if y==x['f'][k])
                x.setdefault('pct',{})[k]=100*(lo+0.5*eq)/len(vals)
    return P,bys
W_SALAH={'npG':3,'npxG':3,'shots':2,'xG_per_shot':1,'SoT':1,'conv':1,'finish':1,'A':2,'xA':2,'chances':2,'bigCC':2,'drib':1.5,'drib%':.5,'passes':1,'pass%':1,'long':.5,'def':.5,'rec':.5,'wonAtt3rd':.5,'bigMiss':1,'penWon':.5,'tkl':.25,'int':.25}
W_PALMER={'npG':2,'npxG':2,'shots':2,'xG_per_shot':1,'SoT':1,'conv':1,'finish':1,'A':2,'xA':2.5,'chances':3,'bigCC':2.5,'drib':1.5,'drib%':.5,'passes':2,'pass%':1,'long':1,'def':.5,'rec':.5,'wonAtt3rd':.5,'bigMiss':.5,'penWon':1,'tkl':.25,'int':.25}
def dist(a,b,W):
    return math.sqrt(sum(w*(a[k]-b[k])**2 for k,w in W.items())/sum(W.values()))
def runs(target,cands,W,n=2000,seed=7):
    rnd=random.Random(seed); wins=collections.Counter(); tot=collections.Counter()
    base=sorted(((dist(target,c['pct'],W),c) for c in cands),key=lambda x:x[0])
    for _ in range(n):
        Wr={k:w*rnd.uniform(.5,1.5) for k,w in W.items()}
        best=min(cands,key=lambda c:dist(target,c['pct'],Wr)); wins[best['name']+' '+best['season']]+=1
    return base,wins

NOXG=['npxG','xG_per_shot','finish','xA']
def noxg(W): return {k:v for k,v in W.items() if k not in NOXG}
