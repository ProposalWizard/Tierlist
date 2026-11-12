import json
D=json.load(open('v2data.json')); M=json.load(open('img/meta.json'))
def P(r,line=None,sure=None):
    m=M[r['id']]; return {'name':r['name'],'season':r['season'],'face':'p'+r['id'],'club':'t'+str(r['teamId']),'flag':'c'+m['cc'],'match':r['match'],'line':line,'sure':sure}
T=D['salah_target']; tgt={'name':'Mohamed Salah','season':'2024/25','face':'p'+T['id'],'club':'t'+str(T['teamId']),'flag':'cEGY'}
top=D['salah_top8']; now=D['salah_now5']
names=[r['name'] for r in top]; assert names==['Cole Palmer','Roberto Firmino','Kelechi Iheanacho','Harvey Barnes','Heung-Min Son','Rayan Cherki','Alexander Isak','Darwin Núñez'],names
lines_story={'Cole Palmer':'His first season at Chelsea','Roberto Firmino':'His old Liverpool team-mate','Darwin Núñez':'Another Liverpool team-mate','Rayan Cherki':'Doing it this season','Alexander Isak':'A striker','Kelechi Iheanacho':'Yes, really'}
sure1=f"#1 in {round(top[0]['sure10'])} of 10 tests"
lists={'top':{'title':'The top eight.','sub':'Match to Salah 24/25 · 100% = identical','target':tgt,'rows':[P(r,lines_story.get(r['name']),sure1 if i==0 else None) for i,r in enumerate(top)]},
       'now':{'title':'This season only.','sub':'26/27 · about 10 games in · 450+ mins','target':tgt,'rows':[P(r,None,f"#1 in {round(r['sure10'])} of 10 tests" if i==0 else None) for i,r in enumerate(now)]}}
pc=lambda r:f"{round(r['match'])}"
sf=T['f']; pf=top[0]['f']; cf=now[0]['f']
npool=sum(D['salah_pool'].values())-1
L=[
 dict(id='intro',say="Who is Mo Salah's statistical twin? Last five seasons. Every Premier League attacker. Twenty-three stats.",
      cap="WHO IS MO SALAH'S STATISTICAL TWIN? LAST FIVE SEASONS. EVERY PREMIER LEAGUE ATTACKER. 23|twenty-three STATS.",sfx=[["hit",0.05,0.6]]),
 dict(id='c8',say=f"Here's the top eight. A hundred percent would be identical. Number eight: Darwin Núñez. {pc(top[7])} percent.",cap=f"HERE'S THE TOP EIGHT. 100%|a-hundred-percent WOULD BE IDENTICAL. NUMBER EIGHT: DARWIN NÚÑEZ. {pc(top[7])}%.|seventy-five-percent",sfx=[["pop","DARWIN",0.5]]),
 dict(id='c7',say="Seven: Alexander Isak. Newcastle, twenty-four twenty-five. Seventy-five percent.",cap="SEVEN: ALEXANDER ISAK. NEWCASTLE, 24/25.|twenty-four-twenty-five 75%.|seventy-five-percent",hold=0.6,sfx=[["pop","ALEXANDER",0.5]]),
 dict(id='c6',say="Six: Rayan Cherki. Seventy-six percent. And that's this season.",cap="SIX: RAYAN CHERKI. 76%.|seventy-six-percent AND THAT'S THIS SEASON.",hold=0.6,sfx=[["pop","RAYAN",0.5]]),
 dict(id='c5',say="Five: Son Heung-min. Tottenham, twenty-three twenty-four. Seventy-six percent.",cap="FIVE: SON HEUNG-MIN. TOTTENHAM, 23/24.|twenty-three-twenty-four 76%.|seventy-six-percent",hold=0.6,sfx=[["pop","SON",0.5]]),
 dict(id='c4',say="Four: Harvey Barnes. Newcastle, twenty-four twenty-five. Seventy-six percent.",cap="FOUR: HARVEY BARNES. NEWCASTLE, 24/25.|twenty-four-twenty-five 76%.|seventy-six-percent",hold=0.6,sfx=[["pop","HARVEY",0.5]]),
 dict(id='c3',say="Three... Kelechi Iheanacho. Leicester, twenty-two twenty-three. Yes, really.",cap="THREE... KELECHI IHEANACHO. LEICESTER, 22/23.|twenty-two-twenty-three YES, REALLY.",hold=0.6,sfx=[["pop","KELECHI",0.55]]),
 dict(id='c2',say="Two: his old Liverpool team-mate, Roberto Firmino. Seventy-eight percent.",cap="TWO: HIS OLD LIVERPOOL TEAM-MATE, ROBERTO FIRMINO. 78%.|seventy-eight-percent",hold=0.6,sfx=[["pop","ROBERTO",0.55]]),
 dict(id='c1',say=f"And number one... Cole Palmer. His first season at Chelsea. A {pc(top[0])} percent match.",cap=f"AND NUMBER ONE... COLE PALMER. HIS FIRST SEASON AT CHELSEA. A {pc(top[0])}%|seventy-nine-percent MATCH.",hold=0.3,sfx=[["hit","COLE",0.75]]),
 dict(id='tests',say=f"We changed how much each stat counts, two thousand times. Palmer stayed number one in {round(top[0]['sure10'])} out of ten.",cap=f"WE CHANGED HOW MUCH EACH STAT COUNTS, 2,000|two-thousand TIMES. PALMER STAYED NUMBER ONE IN {round(top[0]['sure10'])}|eight OUT OF TEN.",sfx=[["tick","PALMER",0.4]]),
 dict(id='why',say="Why? They create the same. Nearly two and a half chances every ninety minutes. The same shots on target.",cap="WHY? THEY CREATE THE SAME. NEARLY TWO AND A HALF CHANCES EVERY 90|ninety MINUTES. THE SAME SHOTS ON TARGET."),
 dict(id='diff',say="The difference? Palmer passes way more. Salah scores more, and makes more big chances.",cap="THE DIFFERENCE? PALMER PASSES WAY MORE. SALAH SCORES MORE, AND MAKES MORE BIG CHANCES."),
 dict(id='now4',say="And this season only? Five, João Pedro. Four, Julio Enciso. Three, Bryan Mbeumo. Two, Evanilson.",cap="AND THIS SEASON ONLY? FIVE, JOÃO PEDRO. FOUR, JULIO ENCISO. THREE, BRYAN MBEUMO. TWO, EVANILSON."),
 dict(id='now1',say=f"And number one, after about ten games... Rayan Cherki. {pc(now[0])} percent.",cap=f"AND NUMBER ONE, AFTER ABOUT TEN GAMES... RAYAN CHERKI. {pc(now[0])}%.|seventy-six-percent",hold=0.3,sfx=[["hit","RAYAN",0.7]]),
 dict(id='end',say="So Salah's twin? Cole Palmer. Who should I do next? Comment below.",cap="SO SALAH'S TWIN? COLE PALMER. WHO SHOULD I DO NEXT? COMMENT BELOW."),
]
# check now-list order matches spoken order
assert [r['name'] for r in now]==['Rayan Cherki','Evanilson','Bryan Mbeumo','João Pedro','Julio Enciso'],[r['name'] for r in now]
# spoken order must follow rank: 5 João Pedro? rows are #4 João Pedro, #5 Enciso
L[12]['say']="And this season only? Five, Julio Enciso. Four, João Pedro. Three, Bryan Mbeumo. Two, Evanilson."
L[12]['cap']="AND THIS SEASON ONLY? FIVE, JULIO ENCISO. FOUR, JOÃO PEDRO. THREE, BRYAN MBEUMO. TWO, EVANILSON."
sc={'intro':{'type':'intro','face':tgt['face'],'club':tgt['club'],'flag':tgt['flag'],'name':'SALAH','season':'2024/25',
             'facts':[['5','seasons · 22/23 to 26/27'],[str(npool),'Premier League attacker seasons'],['23','stats, all per 90 minutes']],'at':['LAST','EVERY','23']},
    'c8':{'type':'countdown','list':'top','upto':8,'at':'DARWIN'},'c7':{'type':'countdown','list':'top','upto':7,'at':'ALEXANDER','cont':True},
    'c6':{'type':'countdown','list':'top','upto':6,'at':'RAYAN','cont':True},'c5':{'type':'countdown','list':'top','upto':5,'at':'SON','cont':True},
    'c4':{'type':'countdown','list':'top','upto':4,'at':'HARVEY','cont':True},'c3':{'type':'countdown','list':'top','upto':3,'at':'KELECHI','cont':True},
    'c2':{'type':'countdown','list':'top','upto':2,'at':'ROBERTO','cont':True},'c1':{'type':'countdown','list':'top','upto':1,'at':'COLE','cont':True},
    'tests':{'type':'statement','face':'p'+top[0]['id'],'lines':[['COLE PALMER · 23/24',48,'#141414'],[f"#1 IN {round(top[0]['sure10'])} OF 10 TESTS",72,'#c8102e'],['each test counts the stats differently',30,'#5b564d']],'at':[0.1,'PALMER','CHANGED'],'dots':{'at':'PALMER','n':round(top[0]['sure10']),'total':10}},
    'why':{'type':'compare','kicker':'Why Palmer','title':'They create the same.','a':{**tgt,'season':'2024/25'},'b':{'name':'Cole Palmer','season':'2023/24','face':'p'+top[0]['id']},
           'rows':[{'label':'Chances created','a':sf['chances'],'b':pf['chances']},{'label':'Shots on target','a':sf['SoT'],'b':pf['SoT']}],'at':['CHANCES','SHOTS']},
    'diff':{'type':'compare','kicker':'But…','title':'Not the same player.','a':{**tgt,'season':'2024/25'},'b':{'name':'Cole Palmer','season':'2023/24','face':'p'+top[0]['id']},
           'rows':[{'label':'Passes','a':sf['passes'],'b':pf['passes']},{'label':'Goals (no pens)','a':sf['npG'],'b':pf['npG']},{'label':'Big chances made','a':sf['bigCC'],'b':pf['bigCC']}],'at':['PALMER','SALAH','BIG']},
    'now4':{'type':'countdown','list':'now','steps':[[5,'JULIO'],[4,'JOÃO'],[3,'BRYAN'],[2,'EVANILSON']]},
    'now1':{'type':'countdown','list':'now','upto':1,'at':'RAYAN','cont':True},
    'end':{'type':'end','faces':[tgt['face'],'p'+top[0]['id']],'lines':["WHO'S NEXT?",'COMMENT BELOW'],'captions':True}}
meta={'series':'STAT TWINS · EP 1','source':'Data: Opta via FotMob · PL attackers 900+ mins (26/27: 450+)','engine':'video2.html','imgDir':'/tmp/claude-0/-home-user-Tierlist/84a0c395-3776-5543-b933-7d1eba9d58ff/scratchpad/img'}
json.dump(L,open('v02b/lines.json','w'),indent=0,ensure_ascii=False); json.dump({'meta':meta,'lists':lists,'scenes':sc},open('v02b/scenes.json','w'),indent=0,ensure_ascii=False)
print('ok',npool, [ (r['name'],r['match'],r['sure10']) for r in top])
