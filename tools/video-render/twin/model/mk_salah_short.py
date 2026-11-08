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
 dict(Lg['n0']),dict(Lg['n5']),dict(Lg['n4']),dict(Lg['n3']),dict(Lg['n2']),dict(Lg['now1']),
 dict(Lg['nowcmp']),
 dict(id='end',say="Salah's twin is Cole Palmer. Follow for more."),
]
HOLD={'own':0.12,'c8':0.12,'c6':0.12,'saka':0.15,'c5':0.15,'c4':0.25,'c3':0.5,'why':0.3,'diff':0.3,'n0':0.05,'n5':0.08,'n4':0.08,'n3':0.08,'n2':0.08,'now1':0.3,'nowcmp':0.3}
for l in L:
    l.setdefault('cap',l['say'].upper())
    if l['id'] in HOLD: l['hold']=HOLD[l['id']]
S={}
S['hook']={**sc['intro'],'instant':True,'kickerAt':'NOT','kicker':'HIS TWIN IS NOT WHO YOU THINK','facts':[],'at':[0.5,0.9,1.3],'mystery':[{**m,'delay':0} for m in sc['intro']['mystery']]}
S['own']={**sc['own'],'at':'HIS'}
for k,w in [('c8','SON'),('c6','HARVEY'),('c5','KELECHI'),('c4','ROBERTO'),('c3','COLE')]:
    S[k]=dict(sc[k]); S[k]['at']=w
    if S[k].get('pop'): S[k]['pop']={**S[k]['pop'],'at':w}
S['c3']['twinAt']='MATCH'
S['saka']={**sc['saka'],'at':'SAKA','pop':{**sc['saka']['pop'],'at':'28TH'}}
S['c4']['sticker']={'text':'GUESS THE TWIN IN THE COMMENTS','at':'GUESS'}
S['why']={**sc['why'],'at':['CHANCES','SHOTS']}
S['diff']=sc['diff']; S['nowcmp']=sc['nowcmp']
for k in ('n0','n5','n4','n3','n2','now1'): S[k]=dict(sc[k])
S['end']={**sc['end'],'at':['COLE',0.9]}
rows=src['lists']['top']['rows']; nrows=src['lists']['now']['rows']; tgc=src['lists']['top']['target']['club']
prev=tgc
for k in ['c8','c6','saka','c5','c4','c3']:
    S[k]['fromClub']=prev; prev=(S[k]['aside']['club'] if S[k].get('aside') else rows[S[k]['show'][0]-1]['club'])
prev=tgc
for k,r in [('n5',5),('n4',4),('n3',3),('n2',2),('now1',1)]:
    S[k]['fromClub']=prev; prev=nrows[r-1]['club']
for k in ('c8','c6','saka','c5','c4','n5','n4','n3','n2'): S[k]['at']=0.0
src['scenes']=S
json.dump(L,open('v02s/lines.json','w'),indent=0,ensure_ascii=False); json.dump(src,open('v02s/scenes.json','w'),indent=0,ensure_ascii=False)
shutil.copy('v02g/voice.json','v02s/voice.json')
for k in ('diff','nowcmp','n0','n5','n4','n3','n2','now1'): shutil.copy(f'v02g/vo/{k}.mp3',f'v02s/vo/{k}.mp3')
print('ok', sum(len(l['say']) for l in L),'chars')
