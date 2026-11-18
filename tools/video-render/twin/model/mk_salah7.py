# v02 cut 5 (Mikey, 8 Nov 2026, Poster style): Salah's own seasons removed with an animation and the list re-ranked
# to a top 5 (Palmer #1); every "this season" place its own line; why/diff held longer; end card in club colours.
import json,shutil,os
src=json.load(open('v02f/scenes.json')); L0={l['id']:l for l in json.load(open('v02f/lines.json'))}
top8=src['lists']['top']['rows']; others=[dict(r) for r in top8 if not r.get('excluded')]
for r in others: r.pop('twin',None)
others[0]['twin']=True
lists=dict(src['lists']); lists['top8']={**src['lists']['top'],'rows':top8}; lists['top']={**src['lists']['top'],'title':'The top five.','rows':others}
sc=src['scenes']; aside=dict(sc['saka']['aside']); aside['rank']=28; aside['text']='Not even top 25'   # 31st with Salah's 3 seasons, 28th without them
names=[r['name'] for r in others]; assert names==['Cole Palmer','Roberto Firmino','Kelechi Iheanacho','Harvey Barnes','Heung-Min Son'],names
own=sc['own']; own.update(list='top8',collapse={'at':'LEAVES'})
def cd(show,before,at,pop=None,frm=1,extra={}):
    d={'type':'cd2','list':'top','show':[show],'before':before,'prevShow':[before[-1]] if before else [],'at':at,'cont':True,'from':frm}
    if pop: d['pop']=pop
    d.update(extra); return d
P=lambda k:sc[k].get('pop')
sc['c8']=cd(5,[],'SON',{**P('c8'),'at':'TOTTENHAM'},1)
sc['c6']=cd(4,[5],'HARVEY',{**P('c6'),'at':'NEWCASTLE'},-1)
sc['saka']={'type':'cd2','list':'top','show':[],'before':[5,4],'prevShow':[4],'at':'SAKA','aside':aside,'cont':True,'from':1,'pop':{**P('saka'),'at':"HE'S"}}
sc['c5']=cd(3,[5,4],'KELECHI',{**P('c5'),'at':'LEICESTER'},-1)
sc['c4']=cd(2,[5,4,3],'ROBERTO',{**P('c4'),'at':'78%'},1,{'sticker':sc['c4']['sticker']})
sc['c3']=cd(1,[5,4,3,2],'COLE',{**P('c3'),'at':'HIS'},-1,{'twinAt':'THAT'})
for k in ['n0','n5','n4','n3','n2']: pass
sc['n0']={'type':'countdown','list':'now','upto':6,'at':0.0}
for rk,w in [(5,'JULIO'),(4,'JOÃO'),(3,'BRYAN'),(2,'EVANILSON')]: sc[f'n{rk}']={'type':'countdown','list':'now','upto':rk,'at':w,'cont':True}
sc.pop('now4',None)
sc['end']['pairs'][0].update(aClub='t8650',bClub=others[0]['club']); sc['end']['pairs'][1].update(aClub='t8650',bClub=lists['now']['rows'][0]['club'])
new={
 'own':dict(id='own',say="First, Salah himself. Three of his own seasons made the top eight. They don't count. So that leaves five.",cap="FIRST, SALAH HIMSELF. THREE OF HIS OWN SEASONS MADE THE TOP EIGHT. THEY DON'T COUNT. SO THAT LEAVES FIVE.",hold=0.9,sfx=[["pop","SALAH",0.5],["whoosh","LEAVES",0.5]]),
 'c8':dict(id='c8',say="Number five: Son Heung-min. Tottenham. Seventy-six percent.",cap="NUMBER FIVE: SON HEUNG-MIN. TOTTENHAM. 76%.|x-percent",hold=0.9,sfx=[["pop","SON",0.5],["tick","TOTTENHAM",0.4]]),
 'c6':dict(id='c6',say="Four: Harvey Barnes. Newcastle. Seventy-six percent.",cap="FOUR: HARVEY BARNES. NEWCASTLE. 76%.|x-percent",hold=0.9,sfx=[["pop","HARVEY",0.5]]),
 'saka':dict(id='saka',say="You'd think Saka would be up here? He's twenty-eighth.",cap="YOU'D THINK SAKA WOULD BE UP HERE? HE'S 28TH.|twenty-eighth",hold=0.9,sfx=[["hit","HE'S",0.5]]),
 'c5':dict(id='c5',say="Three: Kelechi Iheanacho. Leicester. Yes, really.",cap="THREE: KELECHI IHEANACHO. LEICESTER. YES, REALLY.",hold=0.9,sfx=[["pop","KELECHI",0.5]]),
 'c4':dict(id='c4',say="Two: his old Liverpool team-mate, Roberto Firmino. Seventy-eight percent. Guess the twin in the comments.",cap="TWO: HIS OLD LIVERPOOL TEAM-MATE, ROBERTO FIRMINO. 78%.|x-percent GUESS THE TWIN IN THE COMMENTS.",hold=0.6,sfx=[["pop","ROBERTO",0.55],["pop","GUESS",0.45]]),
 'c3':dict(id='c3',say="And number one... Cole Palmer. His first season at Chelsea. Seventy-nine percent. That makes him Salah's statistical twin.",cap="AND NUMBER ONE... COLE PALMER. HIS FIRST SEASON AT CHELSEA. 79%.|x-percent THAT MAKES HIM SALAH'S STATISTICAL TWIN.",hold=0.4,sfx=[["hit","COLE",0.7],["hit","THAT",0.5]]),
 'n0':dict(id='n0',say="And this season only?",cap="AND THIS SEASON ONLY?",hold=0.3),
 'n5':dict(id='n5',say="Five: Julio Enciso.",cap="FIVE: JULIO ENCISO.",hold=0.6,sfx=[["pop","JULIO",0.5]]),
 'n4':dict(id='n4',say="Four: João Pedro.",cap="FOUR: JOÃO PEDRO.",hold=0.6,sfx=[["pop","JOÃO",0.5]]),
 'n3':dict(id='n3',say="Three: Bryan Mbeumo.",cap="THREE: BRYAN MBEUMO.",hold=0.6,sfx=[["pop","BRYAN",0.5]]),
 'n2':dict(id='n2',say="Two: Evanilson.",cap="TWO: EVANILSON.",hold=0.6,sfx=[["pop","EVANILSON",0.5]]),
}
order=['intro','own','c8','c6','saka','c5','c4','c3','tests','why','diff','n0','n5','n4','n3','n2','now1','nowcmp','end']
L=[]
for k in order:
    l=new.get(k) or dict(L0[k])
    if k=='why': l['hold']=l.get('hold',0)+0.2
    if k=='diff': l['hold']=l.get('hold',0)+0.35
    L.append(l)
    if k not in new and k!='intro' and os.path.exists(f'v02f/vo/{k}.mp3'): shutil.copy(f'v02f/vo/{k}.mp3',f'v02g/vo/{k}.mp3')
INTRO={"id": "intro", "say": "Who is prime Mo Salah's statistical twin? From the last five seasons.", "cap": "WHO IS PRIME MO SALAH'S STATISTICAL TWIN? FROM THE LAST FIVE SEASONS.", "sfx": [["hit", 0.05, 0.6]], "seed": 23, "voiceSettings": {"speed": 1.1}, "tempo": 1.05, "gapDb": -33, "maxGap": 0.06}
L=[INTRO if l['id']=='intro' else l for l in L]
sc['intro']['at']=[0.3,0.9,1.5]
src['lists']=lists; src['scenes']=sc; src['meta']['engine']='video_full.html'; src['meta']['layout']='poster'
json.dump(L,open('v02g/lines.json','w'),indent=0,ensure_ascii=False); json.dump(src,open('v02g/scenes.json','w'),indent=0,ensure_ascii=False)
shutil.copy('v02f/voice.json','v02g/voice.json')
print('reused',sorted(os.listdir('v02g/vo'))); print('new',[k for k in order if k in new])
