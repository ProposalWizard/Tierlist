# v02 cut 4 = cut 3 (mk_salah3) + only Mikey's picks (8 Nov 2026): 4-s intro, "100% = identical" on screen only,
# "You'd think Saka? 31st", guess sticker at #4, a pop-up fact per player, cards slide in from alternating sides. Hugo sped up.
import json,os,urllib.request
src=open('mk_salah3.py').read().replace("open('v02c/","open('v02e/")
exec(src)
# Saka aside (best place outside the top 8)
sk=[(i+1,d,v) for i,(d,v) in enumerate(base) if v['name']=='Bukayo Saka'][0]; sk_rank,sk_d,sk_v=sk; sk_id=idx[(sk_v['season'],'Bukayo Saka')]
aside={'name':'Bukayo Saka','season':sk_v['season'],'face':'p'+sk_id,'club':'t'+str(sk_v['teamId']),'flag':'cENG','rank':sk_rank,'match':round(100-sk_d,1),'text':'Not even top 30'}
# pop-up facts: each player's best rank among that season's PL attackers (checked 8 Nov 2026)
def fact(nm,se,k,label,fmt):
    L2=b9[se]; v=[x for x in L2 if x['name']==nm][0]; r=sorted(L2,key=lambda y:-y['f'][k]); rk=[i+1 for i,y in enumerate(r) if y is v][0]
    o={1:'st',2:'nd',3:'rd'}.get(rk if rk<20 else rk%10,'th'); return {'big':fmt.format(v['f'][k]),'label':label,'rank':f'{rk}{o} of {len(L2)} PL attackers'}
pops={'c8':fact('Heung-Min Son','2023/24','bigCC','big chances made per 90','{:.2f}'),
      'c6':fact('Harvey Barnes','2024/25','npG','goals per 90 (no pens)','{:.2f}'),
      'saka':fact('Bukayo Saka','2023/24','chances','chances created per 90','{:.2f}'),
      'c5':fact('Kelechi Iheanacho','2022/23','A','assists per 90','{:.2f}'),
      'c4':fact('Roberto Firmino','2022/23','npG','goals per 90 (no pens)','{:.2f}')}
pv=[v for v in P9 if v['name']=='Cole Palmer' and v['season']=='2023/24'][0]; pops['c3']={'big':f"{pv['goals']}+{pv['goal_assist']}",'label':'goals + assists','rank':'Premier League 2023/24'}
print('saka',sk_rank,aside['match']); print(pops)
newL={
 'intro':dict(id='intro',say="Who is Mo Salah's statistical twin? Last five seasons, every Premier League attacker.",cap="WHO IS MO SALAH'S STATISTICAL TWIN? LAST FIVE SEASONS, EVERY PREMIER LEAGUE ATTACKER.",sfx=[["hit",0.05,0.6]]),
 'c8':dict(id='c8',say=f"Now from the bottom. Number eight: Son Heung-min. Tottenham. Seventy-six percent.",cap="NOW FROM THE BOTTOM. NUMBER EIGHT: SON HEUNG-MIN. TOTTENHAM. 76%.|x-percent",hold=0.5,sfx=[["pop","SON",0.5],["tick","TOTTENHAM",0.4]]),
 'saka':dict(id='saka',say=f"You'd think Saka would be up here? He's thirty-first.",cap=f"YOU'D THINK SAKA WOULD BE UP HERE? HE'S {sk_rank}ST.|thirty-first",hold=0.6,sfx=[["hit","HE'S",0.5]]),
 'c4':dict(id='c4',say="Four: his old Liverpool team-mate, Roberto Firmino. Seventy-eight percent. Guess the twin in the comments.",cap="FOUR: HIS OLD LIVERPOOL TEAM-MATE, ROBERTO FIRMINO. 78%.|x-percent GUESS THE TWIN IN THE COMMENTS.",hold=0.6,sfx=[["pop","ROBERTO",0.55],["pop","GUESS",0.45]]),
}
out=[]
for l in L:
    out.append(newL.get(l['id'],l))
    if l['id']=='c6': out.append(newL['saka'])
L=out
sc['intro']['at']=['LAST','EVERY','EVERY']
sc['saka']={'type':'cd2','list':'top','show':[],'before':G[0]+G[1]+G[2],'prevShow':G[2],'at':'SAKA','aside':aside,'cont':True}
side=1
for k in ['c8','c6','saka','c5','c4','c3']:
    sc[k]['from']=side; side=-side
    if k in pops: sc[k]['pop']={**pops[k],'at':{'c8':'TOTTENHAM','c6':'NEWCASTLE','saka':"HE'S",'c5':'LEICESTER','c4':'78%','c3':'HIS'}[k]}
sc['c4']['sticker']={'text':'GUESS THE TWIN IN THE COMMENTS','at':'GUESS'}
json.dump(L,open('v02e/lines.json','w'),indent=0,ensure_ascii=False); json.dump({'meta':meta,'lists':lists,'scenes':sc},open('v02e/scenes.json','w'),indent=0,ensure_ascii=False)
json.dump({'provider':'elevenlabs','voiceId':'WAppqUXeqDqXjNTaQxG9'},open('v02e/voice.json','w'))
print([l['id'] for l in L])
