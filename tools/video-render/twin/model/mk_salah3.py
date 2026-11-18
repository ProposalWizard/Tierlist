import json
exec(open('v2data.py').read().split('OUT={}')[0])
M=json.load(open('img/meta.json')); idx={(v['season'],v['name']):k.split('|')[1] for k,v in t.items()}
sal=[v for v in P9 if v['name']=='Mohamed Salah' and v['season']=='2024/25'][0]
five=['2022/23','2023/24','2024/25','2025/26','2026/27']
c=[v for s in five for v in season_pool(s) if v is not sal]
base,_=solve(sal['f'],c,W_SALAH,own=b9['2024/25'])
_,winsO=solve(sal['f'],[v for v in c if v['name']!='Mohamed Salah'],W_SALAH,own=b9['2024/25'])
top=base[:8]
def row(d,v):
    pid=idx[(v['season'],v['name'])]; return {'name':v['name'],'season':v['season'],'face':'p'+pid,'club':'t'+str(v['teamId']),'flag':'c'+M[pid]['cc'],'match':round(100-d,1),'excluded':v['name']=='Mohamed Salah'}
rows=[row(d,v) for d,v in top]
# reveal plan: target's own first, then from the bottom; a repeated player shows all his places at once
groups=[[i+1 for i,r in enumerate(rows) if r['excluded']]]; done=set(groups[0])
for k in range(len(rows),0,-1):
    if k in done: continue
    g=[i+1 for i,r in enumerate(rows) if r['name']==rows[k-1]['name'] and i+1 not in done]; groups.append(g); done|=set(g)
twin=min(i+1 for i,r in enumerate(rows) if not r['excluded']); rows[twin-1]['twin']=True
sure=round(100*winsO[(rows[twin-1]['name'],rows[twin-1]['season'])]/2000)
print('rows',[(i+1,r['name'],r['season'],r['match']) for i,r in enumerate(rows)]); print('groups',groups,'twin',twin,'sure',sure)
assert groups==[[1,2,7],[8],[6],[5],[4],[3]],groups
story={'Roberto Firmino':'His old Liverpool team-mate','Kelechi Iheanacho':'Yes, really','Cole Palmer':'His first season at Chelsea'}
for r in rows: r['line']=story.get(r['name'])
now=json.load(open('v2data.json'))['salah_now5']
def P(r): return {'name':r['name'],'season':r['season'],'face':'p'+r['id'],'club':'t'+str(r['teamId']),'flag':'c'+M[r['id']]['cc'],'match':r['match'],'line':None,'sure':None}
tgt={'name':'Mohamed Salah','season':'2024/25','face':'p'+idx[('2024/25','Mohamed Salah')],'club':'t8650','flag':'cEGY'}
pal=rows[twin-1]; ch=now[0]
lists={'top':{'title':'The top eight.','sub':'Match to Salah 24/25 · 100% = identical','target':tgt,'rows':rows,'twinLine':'SALAH\'S STATISTICAL TWIN','exLine':'Salah himself · not counted'},
       'now':{'title':'This season only.','sub':'26/27 · about 10 games in · 450+ mins','target':tgt,'rows':[P(r) for r in now]}}
sf=sal['f']; pf=[v for v in P9 if v['name']=='Cole Palmer' and v['season']=='2023/24'][0]['f']; cf=ch['f']
n=lambda x:{75:'seventy-five',76:'seventy-six',78:'seventy-eight',79:'seventy-nine'}[round(x)]
L=[
 dict(id='intro',say="Who is Mo Salah's statistical twin? Last five seasons. Every Premier League attacker. Twenty-three stats.",cap="WHO IS MO SALAH'S STATISTICAL TWIN? LAST FIVE SEASONS. EVERY PREMIER LEAGUE ATTACKER. 23|twenty-three STATS.",sfx=[["hit",0.05,0.6]]),
 dict(id='own',say="First, Salah himself. Three of his own seasons made the top eight. They don't count.",cap="FIRST, SALAH HIMSELF. THREE OF HIS OWN SEASONS MADE THE TOP EIGHT. THEY DON'T COUNT.",hold=0.4,sfx=[["pop","SALAH",0.5]]),
 dict(id='c8',say=f"Now from the bottom. A hundred percent would be identical. Number eight: Son Heung-min. Tottenham. {n(rows[7]['match'])} percent.",cap=f"NOW FROM THE BOTTOM. 100%|a-hundred-percent WOULD BE IDENTICAL. NUMBER EIGHT: SON HEUNG-MIN. TOTTENHAM. {round(rows[7]['match'])}%.|x-percent",hold=0.5,sfx=[["pop","SON",0.5]]),
 dict(id='c6',say=f"Six: Harvey Barnes. Newcastle. {n(rows[5]['match'])} percent.",cap=f"SIX: HARVEY BARNES. NEWCASTLE. {round(rows[5]['match'])}%.|x-percent",hold=0.6,sfx=[["pop","HARVEY",0.5]]),
 dict(id='c5',say="Five: Kelechi Iheanacho. Leicester. Yes, really.",cap="FIVE: KELECHI IHEANACHO. LEICESTER. YES, REALLY.",hold=0.6,sfx=[["pop","KELECHI",0.5]]),
 dict(id='c4',say=f"Four: his old Liverpool team-mate, Roberto Firmino. {n(rows[3]['match'])} percent.",cap=f"FOUR: HIS OLD LIVERPOOL TEAM-MATE, ROBERTO FIRMINO. {round(rows[3]['match'])}%.|x-percent",hold=0.6,sfx=[["pop","ROBERTO",0.55]]),
 dict(id='c3',say=f"And three... Cole Palmer. His first season at Chelsea. {n(pal['match'])} percent. That makes him Salah's statistical twin.",cap=f"AND THREE... COLE PALMER. HIS FIRST SEASON AT CHELSEA. {round(pal['match'])}%.|x-percent THAT MAKES HIM SALAH'S STATISTICAL TWIN.",hold=0.4,sfx=[["hit","COLE",0.7],["hit","THAT",0.5]]),
 dict(id='tests',say=f"We changed how much each stat counts, two thousand times. Palmer came first in {n(sure)} percent of them.",cap=f"WE CHANGED HOW MUCH EACH STAT COUNTS, 2,000|two-thousand TIMES. PALMER CAME FIRST IN {sure}%|x-percent OF THEM.",sfx=[["tick","PALMER",0.4]]),
 dict(id='why',say="Why? They create the same. Nearly two and a half chances every ninety minutes. The same shots on target.",cap="WHY? THEY CREATE THE SAME. NEARLY TWO AND A HALF CHANCES EVERY 90|ninety MINUTES. THE SAME SHOTS ON TARGET."),
 dict(id='diff',say="The difference? Palmer passes way more. Salah scores more, and makes more big chances.",cap="THE DIFFERENCE? PALMER PASSES WAY MORE. SALAH SCORES MORE, AND MAKES MORE BIG CHANCES."),
 dict(id='now4',say="And this season only? Five, Julio Enciso. Four, João Pedro. Three, Bryan Mbeumo. Two, Evanilson.",cap="AND THIS SEASON ONLY? FIVE, JULIO ENCISO. FOUR, JOÃO PEDRO. THREE, BRYAN MBEUMO. TWO, EVANILSON."),
 dict(id='now1',say=f"And number one, after about ten games... Rayan Cherki. {n(ch['match'])} percent.",cap=f"AND NUMBER ONE, AFTER ABOUT TEN GAMES... RAYAN CHERKI. {round(ch['match'])}%.|x-percent",hold=0.3,sfx=[["hit","RAYAN",0.7]]),
 dict(id='nowcmp',say="He creates even more. Over three chances every ninety minutes. And more goals, so far.",cap="HE CREATES EVEN MORE. OVER THREE CHANCES EVERY 90|ninety MINUTES. AND MORE GOALS, SO FAR."),
 dict(id='end',say="So Salah's twin is Cole Palmer. And right now, it's Rayan Cherki. Follow for more.",cap="SO SALAH'S TWIN IS COLE PALMER. AND RIGHT NOW, IT'S RAYAN CHERKI. FOLLOW FOR MORE."),
]
G=groups
sc={'intro':{'type':'intro','face':tgt['face'],'club':tgt['club'],'flag':tgt['flag'],'name':'SALAH','season':'2024/25','facts':[['5','seasons · 22/23 to 26/27'],[str(len(c)),'Premier League attacker seasons'],['23','stats, all per 90 minutes']],'at':['LAST','EVERY','23']},
    'own':{'type':'cd2','list':'top','show':G[0],'before':[],'prevShow':[],'at':'SALAH'},
    'c8':{'type':'cd2','list':'top','show':G[1],'before':G[0],'prevShow':G[0],'at':'SON','cont':True},
    'c6':{'type':'cd2','list':'top','show':G[2],'before':G[0]+G[1],'prevShow':G[1],'at':'HARVEY','cont':True},
    'c5':{'type':'cd2','list':'top','show':G[3],'before':G[0]+G[1]+G[2],'prevShow':G[2],'at':'KELECHI','cont':True},
    'c4':{'type':'cd2','list':'top','show':G[4],'before':G[0]+G[1]+G[2]+G[3],'prevShow':G[3],'at':'ROBERTO','cont':True},
    'c3':{'type':'cd2','list':'top','show':G[5],'before':G[0]+G[1]+G[2]+G[3]+G[4],'prevShow':G[4],'at':'COLE','twinAt':'THAT','cont':True},
    'tests':{'type':'statement','face':pal['face'],'lines':[['COLE PALMER · 23/24',48,'#141414'],[f'FIRST IN {sure}% OF TESTS',72,'#c8102e'],['each test counts the stats differently',30,'#5b564d']],'at':[0.1,'PALMER','CHANGED']},
    'why':{'type':'compare','kicker':'Why Palmer','title':'They create the same.','a':{**tgt},'b':{'name':'Cole Palmer','season':'2023/24','face':pal['face']},
           'rows':[{'label':'Chances created','a':sf['chances'],'b':pf['chances']},{'label':'Shots on target','a':sf['SoT'],'b':pf['SoT']}],'at':['CHANCES','SHOTS']},
    'diff':{'type':'compare','kicker':'But…','title':'Not the same player.','a':{**tgt},'b':{'name':'Cole Palmer','season':'2023/24','face':pal['face']},
           'rows':[{'label':'Passes','a':sf['passes'],'b':pf['passes']},{'label':'Goals (no pens)','a':sf['npG'],'b':pf['npG']},{'label':'Big chances made','a':sf['bigCC'],'b':pf['bigCC']}],'at':['PALMER','SALAH','BIG']},
    'now4':{'type':'countdown','list':'now','steps':[[5,'JULIO'],[4,'JOÃO'],[3,'BRYAN'],[2,'EVANILSON']]},
    'now1':{'type':'countdown','list':'now','upto':1,'at':'RAYAN','cont':True},
    'nowcmp':{'type':'compare','kicker':'This season','title':'Salah vs Cherki.','a':{**tgt},'b':{'name':'Rayan Cherki','season':'2026/27','face':'p'+ch['id']},
           'rows':[{'label':'Chances created','a':sf['chances'],'b':cf['chances']},{'label':'Goals (no pens)','a':sf['npG'],'b':cf['npG']}],'at':['THREE','GOALS']},
    'end':{'type':'end2','captions':True,'pairs':[{'label':'Last 5 seasons','a':tgt['face'],'b':pal['face'],'aName':'SALAH 24/25','bName':'PALMER 23/24'},{'label':'This season','a':tgt['face'],'b':'p'+ch['id'],'aName':'SALAH 24/25','bName':'CHERKI'}],'at':['COLE','RAYAN']}}
for v in sc.values():
    for r in v.get('rows',[]): r['a']=round(r['a'],2); r['b']=round(r['b'],2)
meta={'series':'STAT TWINS · EP 1','source':'Data: Opta via FotMob · PL attackers 900+ mins (26/27: 450+)','engine':'video2.html','imgDir':'/tmp/claude-0/-home-user-Tierlist/84a0c395-3776-5543-b933-7d1eba9d58ff/scratchpad/img'}
json.dump(L,open('v02c/lines.json','w'),indent=0,ensure_ascii=False); json.dump({'meta':meta,'lists':lists,'scenes':sc},open('v02c/scenes.json','w'),indent=0,ensure_ascii=False)
json.dump({'provider':'elevenlabs','voiceId':'WAppqUXeqDqXjNTaQxG9'},open('v02c/voice.json','w'))
print('ok',sure, sf['chances'],cf['chances'],sf['npG'],cf['npG'])
