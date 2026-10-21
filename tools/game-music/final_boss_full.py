# Original "final boss" cue v3: between v1 (too bright) and v2 (too evil).
# Played through real orchestra recordings (VSCO 2 CE, CC0). No melody copied.
import os, sys, numpy as np
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from sampler import Inst, Mix
BPM=92; B=60/BPM; BAR=4*B
NOTE={'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
def P(s): return 12*(int(s[-1])+1)+NOTE[s[:-1]]
I=dict(
 vln=Inst('Strings/Violin Section/susVib/*.wav',pan=-0.35,release=0.5),
 vlnTrem=Inst('Strings/Violin Section/Trem/*.wav',pan=-0.3,release=0.4),
 vla=Inst('Strings/Viola Section/susvib/*.wav',pan=0.15,release=0.5),
 vlaSpic=Inst('Strings/Viola Section/spic/*.wav',pan=0.2,release=0.08),
 vc=Inst('Strings/Cello Section/susvib/*.wav',pan=0.35,release=0.5),
 vcSpic=Inst('Strings/Cello Section/spic/*.wav',pan=0.35,release=0.08),
 cb=Inst('Strings/Solo Contrabass/SusVib/*.wav',pan=0.45,release=0.4,gain=1.3),
 horn=Inst('Brass/F Horn/sus/*.wav',pan=-0.15,release=0.4,gain=0.7),
 tbn=Inst('Brass/Tenor Trombone/sus/*.wav',pan=0.1,release=0.35,gain=0.55),
 tuba=Inst('Brass/Tuba/sus/*.wav',pan=0.2,release=0.35,gain=0.7),
 harp=Inst('Strings/Harp/*.wav',pan=-0.5,release=1.5),
 timp=Inst('Percussion/Timpani/Timpani*_Hit*.wav',pan=0.05,release=1.2),
 timpRoll=Inst('Percussion/Timpani/Rolls/*.wav',pan=0.05,release=0.6,pitched=False),
 bd=Inst('Percussion/BDrumNewhit*.wav',pitched=False,release=1.0,gain=1.2),
 snare=Inst('Percussion/Snare2-HitNS*.wav',pitched=False,release=0.3,gain=0.6,pan=-0.1),
 crash=Inst('Percussion/cymbal-crash1_*.wav',pitched=False,release=2.5,gain=0.8,pan=0.25),
 swell=Inst('Percussion/susCymb1-cresc-Short*.wav',pitched=False,release=0.2,gain=0.7),
 gong=Inst('Percussion/gongHit_f*.wav',pitched=False,release=4,gain=0.9),
)
CH={'Em':['E','G','B'],'C':['C','E','G'],'Am':['A','C','E'],'B':['B','D#','F#'],'D':['D','F#','A'],'F':['F','A','C']}
intro=['Em','C','Am','B']; build=['Em','C','D','B']; main=['Em','C','Am','B','Em','C','F','B']
prog=intro+build+main
END=len(prog)*BAR
mix=Mix(END+7)
def add(i,p,s,d,v,g='orch'): mix.add(I[i],p,s,d,v,g)
for bi,c in enumerate(prog):
    t=bi*BAR; tones=CH[c]; r=tones[0]; sec='intro' if bi<4 else 'build' if bi<8 else 'main'
    k=bi/len(prog)
    # low strings hold the root
    add('cb',P(r+'1') if r not in('E','F') else P(r+'1')+12*(r=='F'),t,BAR,60+40*k)
    add('vc',P(r+'2'),t,BAR,55+45*k)
    if sec=='intro':
        add('vlnTrem',P('E4'),t,BAR,45+bi*8); add('vlnTrem',P('B4'),t,BAR,40+bi*8)
        for b in range(4): add('timp',P('E2'),t+b*B,B,45+bi*10)
        add('harp',P(r+'2'),t,2*B,70); add('harp',P(tones[2]+'2'),t+2*B,2*B,60)
    else:
        # spiccato engine: strings drive it, not brass
        sub=16 if sec=='main' else 8
        pat=[P(r+'3'),P(r+'3'),P(tones[2]+'2'),P(r+'3'),P(tones[1]+'3'),P(r+'3'),P(tones[2]+'2'),P(r+'3')]
        for s in range(sub):
            v=(70 if sec=='build' else 88)+(14 if s%4==0 else 0)
            add('vcSpic',pat[s%8],t+s*BAR/sub,BAR/sub*0.6,v); add('vlaSpic',pat[s%8]+12,t+s*BAR/sub,BAR/sub*0.6,v-12)
        for x in tones: add('horn',P(x+'3'),t,BAR,(50 if sec=='build' else 62)+10*k)
        add('vla',P(tones[1]+'4'),t,BAR,55+20*k)
    if sec=='build':
        add('bd',36,t,0.8,80+bi*6); add('bd',36,t+2*B,0.8,70+bi*6)
        add('timp',P(r+'2'),t,B,70+bi*5); add('timp',P(r+'2'),t+2.5*B,B,65+bi*5)
        if bi==7:
            for s in range(16): add('snare',38,t+s*B/4,0.1,40+s*5)
            add('swell',0,t+0.6*B,3.3*B,110)
    if sec=='main':
        add('tbn',P(r+'2'),t,2*B,80); add('tbn',P(r+'2'),t+2*B,2*B,72)
        add('tuba',P(r+'1') if r in('B','A') else P(r+'2'),t,BAR,72)
        for s in (0,1.5,2,3.5): add('bd',36,t+s*B,0.8,100 if s in (0,2) else 80)
        add('snare',38,t+3*B,0.2,70); 
        for s in (0,1,2,2.5,3): add('timp',P(r+'2') if s!=2.5 else P(tones[2]+'2'),t+s*B,B,95 if s==0 else 75)
        if bi in (8,12): add('crash',0,t,3,110)
        if bi==15: add('swell',0,t+0.6*B,3.3*B,115)
# the theme: violins carry it, horns an octave under and kept soft
theme=[[('B4',1),('E5',1),('F#5',1),('G5',1)],[('E5',2),('D5',1),('E5',1)],[('C5',1),('E5',1),('A5',2)],[('G5',1),('F#5',1),('D#5',2)],
       [('B4',1),('E5',1),('F#5',1),('G5',1)],[('B5',2),('A5',1),('G5',1)],[('A5',1),('F5',1),('E5',1),('D5',1)],[('D#5',2),('F#5',1),('B5',1)]]
for j,bar in enumerate(theme):
    t=(8+j)*BAR
    for p,d in bar:
        v=92+(8 if j>=4 else 0)
        add('vln',P(p),t,d*B,v); add('vln',P(p)-12,t,d*B,v-18)
        add('horn',P(p)-12,t,d*B,62+(6 if j>=4 else 0))
        t+=d*B
# ending: one full E minor chord, gong and timpani roll
for p,i,v in [('E1','cb',110),('E2','vc',110),('E2','tbn',95),('B2','tbn',90),('E2','tuba',95),('E3','horn',80),('G3','horn',78),('B3','horn',78),
              ('E4','vla',100),('G4','vln',100),('B4','vln',100),('E5','vln',105)]:
    add(i,P(p),END,4.5,v)
add('timp',P('E2'),END,3,120); add('bd',36,END,1,120); add('gong',0,END,5,115); add('crash',0,END,3,105); add('timpRoll',0,END+0.1,3,90)
mix.out(os.path.join(os.path.dirname(os.path.abspath(__file__)),'cues','final-boss-full.wav'),wet={'orch':0.30})
print('done', round(END+7,1))
