import json
D=json.load(open('v2data.json')); M=json.load(open('img/meta.json'))
def P(r,line=None,sure=None):
    return {'name':r['name'],'season':r['season'],'face':'p'+r['id'],'club':'t'+str(r['teamId']),'flag':'c'+M[r['id']]['cc'],'match':r['match'],'line':line,'sure':sure}
T=D['palmer_target']; tgt={'name':'Cole Palmer','season':'24/25 to 26/27','face':'p'+T['id'],'club':'t'+str(T['teamId']),'flag':'cENG'}
top=D['palmer_top8']; tw=D['palmer2425_top3'][0]
assert [r['name'] for r in top]==['Roberto Firmino','Philippe Coutinho','Alexis Sánchez','Ross Barkley','Christian Eriksen','Kevin De Bruyne','Paul Pogba','Juan Mata'],[r['name'] for r in top]
story={'Juan Mata':'Ex-Chelsea','Paul Pogba':'That summer\'s record signing','Kevin De Bruyne':'Ex-Chelsea too','Christian Eriksen':"Spurs' playmaker",'Ross Barkley':'Later joined Chelsea','Alexis Sánchez':'24 league goals that season','Philippe Coutinho':"Firmino's team-mate"}
sure20=round(top[0]['sure10']*2)
lists={'top':{'title':'Ten years ago.','sub':'Match to Palmer 24/25–26/27 · 100% = identical','target':tgt,'rows':[P(r,story.get(r['name']),f"#1 in {sure20} of 20 tests" if i==0 else None) for i,r in enumerate(top)]}}
pc=lambda r:round(r['match'])
W={77:'seventy-seven',78:'seventy-eight',79:'seventy-nine',80:'eighty',81:'eighty-one',83:'eighty-three',84:'eighty-four',85:'eighty-five',86:'eighty-six'}
pf=T['f']; ff=top[0]['f']
L=[
 dict(id='intro',say="Who was Cole Palmer ten years ago? His last three seasons. Every attacker from 2016/17. Nineteen stats.",
      cap="WHO WAS COLE PALMER 10|ten YEARS AGO? HIS LAST THREE SEASONS. EVERY ATTACKER FROM 2016/17.|twenty-sixteen-seventeen 19|nineteen STATS.",sfx=[["hit",0.05,0.6]]),
 dict(id='c8',say=f"Here's the top eight. A hundred percent would be identical. Number eight: Juan Mata. Manchester United. {W[pc(top[7])]} percent.",cap=f"HERE'S THE TOP EIGHT. 100%|a-hundred-percent WOULD BE IDENTICAL. NUMBER EIGHT: JUAN MATA. MANCHESTER UNITED. {pc(top[7])}%.|x-percent",sfx=[["pop","JUAN",0.5]]),
 dict(id='c7',say=f"Seven: Paul Pogba. That summer's record signing. {W[pc(top[6])]} percent.",cap=f"SEVEN: PAUL POGBA. THAT SUMMER'S RECORD SIGNING. {pc(top[6])}%.|x-percent",hold=0.6,sfx=[["pop","PAUL",0.5]]),
 dict(id='c6',say=f"Six: Kevin De Broyna. Manchester City. {W[pc(top[5])]} percent.",cap=f"SIX: KEVIN DE BRUYNE.|de-broyna MANCHESTER CITY. {pc(top[5])}%.|x-percent",hold=0.6,sfx=[["pop","KEVIN",0.5]]),
 dict(id='c5',say=f"Five: Christian Eriksen. Tottenham. {W[pc(top[4])]} percent.",cap=f"FIVE: CHRISTIAN ERIKSEN. TOTTENHAM. {pc(top[4])}%.|x-percent",hold=0.6,sfx=[["pop","CHRISTIAN",0.5]]),
 dict(id='c4',say=f"Four: Ross Barkley. Everton. Who later joined Chelsea.",cap="FOUR: ROSS BARKLEY. EVERTON. WHO LATER JOINED CHELSEA.",hold=0.6,sfx=[["pop","ROSS",0.5]]),
 dict(id='c3',say=f"Three: Alexis Sánchez. Arsenal. {W[pc(top[2])]} percent.",cap=f"THREE: ALEXIS SÁNCHEZ. ARSENAL. {pc(top[2])}%.|x-percent",hold=0.6,sfx=[["pop","ALEXIS",0.5]]),
 dict(id='c2',say=f"Two: Philippe Koo-cheen-yo. Liverpool. {W[pc(top[1])]} percent.",cap=f"TWO: PHILIPPE COUTINHO.|koo-cheen-yo LIVERPOOL. {pc(top[1])}%.|x-percent",hold=0.6,sfx=[["pop","PHILIPPE",0.55]]),
 dict(id='c1',say=f"And number one... his team-mate. Roberto Firmino. A {W[pc(top[0])]} percent match.",cap=f"AND NUMBER ONE... HIS TEAM-MATE. ROBERTO FIRMINO. A {pc(top[0])}%|x-percent MATCH.",hold=0.3,sfx=[["hit","ROBERTO",0.75]]),
 dict(id='tests',say=f"We changed how much each stat counts, two thousand times. Firmino stayed number one in {['','','','','','','','','','','','','','','','','','','eighteen','nineteen','twenty'][sure20]} out of twenty.",cap=f"WE CHANGED HOW MUCH EACH STAT COUNTS, 2,000|two-thousand TIMES. FIRMINO STAYED NUMBER ONE IN {sure20}|x OUT OF 20.|twenty",sfx=[["tick","FIRMINO",0.4]]),
 dict(id='why',say="Why? Two chances created every ninety minutes. And they score and assist at almost the same rate.",cap="WHY? TWO CHANCES CREATED EVERY 90|ninety MINUTES. AND THEY SCORE AND ASSIST AT ALMOST THE SAME RATE."),
 dict(id='diff',say="The difference? Palmer makes way more big chances, and plays more long balls. Firmino won the ball back more.",cap="THE DIFFERENCE? PALMER MAKES WAY MORE BIG CHANCES, AND PLAYS MORE LONG BALLS. FIRMINO WON THE BALL BACK MORE."),
 dict(id='twist',say=f"But use only Palmer's 24/25? Then it's Koo-cheen-yo. {W[pc(tw)]} percent.",cap=f"BUT USE ONLY PALMER'S 24/25?|twenty-four-twenty-five THEN IT'S COUTINHO.|koo-cheen-yo {pc(tw)}%.|x-percent",hold=0.3,sfx=[["hit","COUTINHO",0.6]]),
 dict(id='end',say="So ten years ago, Cole Palmer was Roberto Firmino. Who should I do next? Comment below.",cap="SO 10|ten YEARS AGO, COLE PALMER WAS ROBERTO FIRMINO. WHO SHOULD I DO NEXT? COMMENT BELOW."),
]
sc={'intro':{'type':'intro','face':tgt['face'],'club':tgt['club'],'flag':tgt['flag'],'name':'PALMER','season':'24/25 → 26/27',
             'facts':[['3','seasons added up · 24/25 to 26/27'],[str(D['palmer_pool']),'Premier League attackers in 2016/17'],['19','stats, all per 90 minutes']],'at':['LAST','EVERY','19']},
    'c8':{'type':'countdown','list':'top','upto':8,'at':'JUAN'},'c7':{'type':'countdown','list':'top','upto':7,'at':'PAUL','cont':True},
    'c6':{'type':'countdown','list':'top','upto':6,'at':'KEVIN','cont':True},'c5':{'type':'countdown','list':'top','upto':5,'at':'CHRISTIAN','cont':True},
    'c4':{'type':'countdown','list':'top','upto':4,'at':'ROSS','cont':True},'c3':{'type':'countdown','list':'top','upto':3,'at':'ALEXIS','cont':True},
    'c2':{'type':'countdown','list':'top','upto':2,'at':'PHILIPPE','cont':True},'c1':{'type':'countdown','list':'top','upto':1,'at':'ROBERTO','cont':True},
    'tests':{'type':'statement','face':'p'+top[0]['id'],'lines':[['ROBERTO FIRMINO · 16/17',48,'#141414'],[f'#1 IN {sure20} OF 20 TESTS',72,'#c8102e'],['each test counts the stats differently',30,'#5b564d']],'at':[0.1,'FIRMINO','CHANGED'],'dots':{'at':'FIRMINO','n':sure20,'total':20}},
    'why':{'type':'compare','kicker':'Why Firmino','title':'They create the same.','a':{**tgt,'season':'24/25 to 26/27'},'b':{'name':'Roberto Firmino','season':'2016/17','face':'p'+top[0]['id']},
           'rows':[{'label':'Chances created','a':pf['chances'],'b':ff['chances']},{'label':'Goals (no pens)','a':pf['npG'],'b':ff['npG']},{'label':'Assists','a':pf['A'],'b':ff['A']}],'at':['CHANCES','SCORE','ASSIST']},
    'diff':{'type':'compare','kicker':'But…','title':'Not the same player.','a':{**tgt,'season':'24/25 to 26/27'},'b':{'name':'Roberto Firmino','season':'2016/17','face':'p'+top[0]['id']},
           'rows':[{'label':'Big chances made','a':pf['bigCC'],'b':ff['bigCC']},{'label':'Long balls','a':pf['long'],'b':ff['long']},{'label':'Ball recoveries','a':pf['rec'],'b':ff['rec']}],'at':['BIG','LONG','FIRMINO']},
    'twist':{'type':'statement','face':'p'+tw['id'],'lines':[["PALMER'S 24/25 ONLY",44,'#5b564d'],['PHILIPPE COUTINHO',64,'#c8102e'],[f"{pc(tw)}% match · Liverpool 16/17",36,'#141414']],'at':[0.1,'COUTINHO','COUTINHO']},
    'end':{'type':'end','faces':[tgt['face'],'p'+top[0]['id']],'lines':["WHO'S NEXT?",'COMMENT BELOW'],'captions':True}}
meta={'series':'STAT TWINS · EP 2','source':'Data: Opta via FotMob · PL attackers 900+ mins (26/27: 450+)','engine':'video2.html','imgDir':'/tmp/claude-0/-home-user-Tierlist/84a0c395-3776-5543-b933-7d1eba9d58ff/scratchpad/img'}
json.dump(L,open('v03b/lines.json','w'),indent=0,ensure_ascii=False); json.dump({'meta':meta,'lists':lists,'scenes':sc},open('v03b/scenes.json','w'),indent=0,ensure_ascii=False)
print('ok', [(r['name'],r['match']) for r in top], sure20, tw['name'],tw['match'])
