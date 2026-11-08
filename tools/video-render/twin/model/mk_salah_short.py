# v02 short cut (~45 s, stronger hook), from the v02g (cut 5) scenes. Mikey, 9 Nov 2026.
import json,shutil
src=json.load(open('v02g/scenes.json')); sc=src['scenes']; Lg={l['id']:l for l in json.load(open('v02g/lines.json'))}
pal=src['lists']['top']['rows'][0]; ch=src['lists']['now']['rows'][0]
L=[
 dict(id='hook',say="Mo Salah's statistical twin is not who you think.",sfx=[["hit",0.0,0.7]],voiceSettings={"speed":1.1},tempo=1.05,gapDb=-33,maxGap=0.06),
 dict(id='own',say="His own seasons don't count. That leaves five.",hold=0.6,sfx=[["whoosh","LEAVES",0.5]]),
 dict(id='c8',say="Five: Son Heung-min.",hold=0.7,sfx=[["pop","SON",0.5]]),
 dict(id='c6',say="Four: Harvey Barnes.",hold=0.7,sfx=[["pop","HARVEY",0.5]]),
 dict(id='saka',say="Saka? Twenty-eighth.",cap="SAKA? 28TH.|twenty-eighth",hold=0.7,sfx=[["hit","28TH",0.5]]),
 dict(id='c5',say="Three: Kelechi Iheanacho. Yes, really.",hold=0.7,sfx=[["pop","KELECHI",0.5]]),
 dict(id='c4',say="Two: Roberto Firmino. Guess the twin in the comments.",hold=0.5,sfx=[["pop","ROBERTO",0.55],["pop","GUESS",0.45]]),
 dict(id='c3',say="And number one... Cole Palmer. A seventy-nine percent match.",cap="AND NUMBER ONE... COLE PALMER. A 79%|seventy-nine-percent MATCH.",hold=0.4,sfx=[["hit","COLE",0.75]]),
 dict(id='why',say="They create the same. Same chances, same shots on target.",hold=0.6),
 dict(Lg['diff']),
 dict(id='now1',say="And right now? Rayan Cherki.",hold=0.5,sfx=[["hit","RAYAN",0.7]]),
 dict(Lg['nowcmp']),
 dict(id='end',say="Salah's twin is Cole Palmer. Follow for more."),
]
HOLD={'own':0.8,'c8':1.3,'c6':1.3,'saka':1.3,'c5':1.2,'c4':1.0,'c3':1.1,'why':0.9}
for l in L:
    l.setdefault('cap',l['say'].upper())
    if l['id'] in HOLD: l['hold']=HOLD[l['id']]
S={}
S['hook']={**sc['intro'],'instant':True,'kicker':'HIS TWIN IS NOT WHO YOU THINK','facts':[],'at':[0.5,0.9,1.3],'mystery':[{**m,'delay':0} for m in sc['intro']['mystery']]}
S['own']={**sc['own'],'at':'HIS'}
for k,w in [('c8','SON'),('c6','HARVEY'),('c5','KELECHI'),('c4','ROBERTO'),('c3','COLE')]:
    S[k]=dict(sc[k]); S[k]['at']=w
    if S[k].get('pop'): S[k]['pop']={**S[k]['pop'],'at':w}
S['c3']['twinAt']='MATCH'
S['saka']={**sc['saka'],'at':'SAKA','pop':{**sc['saka']['pop'],'at':'28TH'}}
S['c4']['sticker']={'text':'GUESS THE TWIN IN THE COMMENTS','at':'GUESS'}
S['why']={**sc['why'],'at':['CHANCES','SHOTS']}
S['diff']=sc['diff']; S['nowcmp']=sc['nowcmp']
S['now1']={'type':'countdown','list':'now','upto':1,'at':'RAYAN'}
S['end']={**sc['end'],'at':['COLE',0.9]}
src['scenes']=S
json.dump(L,open('v02s/lines.json','w'),indent=0,ensure_ascii=False); json.dump(src,open('v02s/scenes.json','w'),indent=0,ensure_ascii=False)
shutil.copy('v02g/voice.json','v02s/voice.json')
for k in ('diff','nowcmp'): shutil.copy(f'v02g/vo/{k}.mp3',f'v02s/vo/{k}.mp3')
print('ok', sum(len(l['say']) for l in L),'chars')
