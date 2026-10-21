# The eleven Knowitball cues. Every tune and chord line here is original; each
# cue only follows the speed, key and energy measured from Mikey's reference.
import sys
from cuelib import Cue, P, chord

def spic_engine(c,inst,name,t,bars,v,sub=16,octave=3,pat=(0,0,2,0,1,0,2,0)):
    for b in range(bars):
        r,iv=chord(name); base=12*(octave+1)+r; tones=[base+iv[0],base+iv[1],base+iv[2]-12]
        for s in range(sub):
            c.n(inst,tones[pat[s%len(pat)]],t+b*c.BAR+s*c.BAR/sub,c.BAR/sub*0.6,v+(12 if s%4==0 else 0))

def drive_drums(c,t,v,snare=True,busy=False):
    B=c.B
    for s in (0,1.5,2,3.5) if busy else (0,2): c.hit('bd',t+s*B,0.8,v if s in(0,2) else v-18)
    if snare: c.hit('snare',t+3*B,0.2,v-25)

# 01 the game turns: F minor, 86 bpm, one shot, rises into a lift
def cue01():
    c=Cue('01-turning-point',86,13,loop=False,tail=5); B=c.B
    prog=['Fm','Db','Eb','C','Fm','Db','Eb','C','Db','Eb','Fm','Ab','Fm']
    for i,ch in enumerate(prog[:12]):
        t=i*c.BAR; k=i/12
        r,iv=chord(ch)
        c.n('cb',12*1+r+12 if r>4 else 12*2+r,t,c.BAR,70+30*k)
        c.pad('vla',ch,t,c.BAR,50+25*k,octave=3)
        spic_engine(c,'vcSpic',ch,t,1,72+20*k,sub=16 if i>=4 else 8)
        if i>=4: spic_engine(c,'vlaSpic',ch,t,1,62+20*k,octave=4)
        for b in range(4): c.n('timp',P('F2') if r in(5,1,3) else P('C2'),t+b*c.B,B,60+40*k)
        if i>=4: drive_drums(c,t,80+25*k,busy=i>=8)
        if i==7: [c.hit('snare',t+s*B/4,0.1,40+s*5) for s in range(16)]; c.hit('swell',t+0.6*B,3.3*B,110)
        if i>=8: c.pad('horn',ch,t,c.BAR,62+10*k,octave=3)
    c.hit('crash',8*c.BAR,3,105)
    # the lift: violins climb, the moment it turns
    th=[('C5',1),('Eb5',1),('F5',2), ('G5',1),('Ab5',1),('Bb5',2), ('Ab5',1),('G5',1),('F5',1),('Eb5',1), ('C6',3),('Bb5',1)]
    c.theme([('vln',0,0),('vln',-12,-18),('horn',-12,-30)],th,8*c.BAR,92)
    end=12*c.BAR
    for p,i,v in [('F1','cb',105),('F2','vc',105),('C3','tbn',85),('F2','tuba',90),('Ab3','horn',75),('C4','horn',75),('F4','vla',95),('Ab4','vln',95),('C5','vln',100),('F5','vln',100)]:
        c.n(i,P(p),end,4,v)
    c.n('timp',P('F2'),end,3,115); c.hit('bd',end,1,115); c.hit('crash',end,3,110)
    return c.render(lufs=-18)

# 02 working it out: D major, 72 bpm, thoughtful bed, piano and pizzicato
def cue02():
    c=Cue('02-working-it-out',72,16); B=c.B
    prog=['D','Bm','G','A','D','F#m','G','A']*2
    for i,ch in enumerate(prog):
        t=i*c.BAR; second=i>=8
        r,iv=chord(ch)
        c.n('vc',12*3+r if r<5 else 12*2+r,t,c.BAR,60)
        c.pad('vla',ch,t,c.BAR,45,octave=3)
        # piano broken chord in eighths
        tones=c.chord_at(ch,4)
        for s,ix in enumerate([0,1,2,1,0,1,2,1]):
            c.n('piano',tones[ix]-(12 if s%4==0 else 0),t+s*B/2,B/2,58 if s%2==0 else 48)
        for b in (0,2): c.n('vcPizz',12*2+r if r>=4 else 12*3+r,t+b*B,B,72)
        if second:
            for b in (1,3): c.n('vlnPizz',tones[2],t+b*B+B/2,B/2,55)
            c.hit('bd',t,0.8,55)
    th=[('F#5',1.5),('E5',0.5),('D5',1),('A4',1), ('B4',1.5),('D5',0.5),('F#5',2), ('G5',1),('F#5',1),('E5',1),('D5',1), ('E5',3),(None,1)]
    c.theme([('clar',-12,0)],th,4*c.BAR,72)
    c.theme([('flute',0,0),('clar',-12,-12)],th,12*c.BAR,72)
    return c.render(lufs=-21)

# 03 winning / main hype: B major with G# minor colour, 103 bpm, bed
def cue03():
    c=Cue('03-winning',103,16); B=c.B
    prog=['G#m','E','B','F#']*4
    for i,ch in enumerate(prog):
        t=i*c.BAR; k=i/16; second=i>=8
        r,iv=chord(ch)
        c.n('cb',12*2+r if r<8 else 12*1+r,t,c.BAR,85)
        c.pad('vla',ch,t,c.BAR,60,octave=3); c.pad('horn',ch,t,c.BAR,58,octave=3)
        spic_engine(c,'vcSpic',ch,t,1,84); spic_engine(c,'vlaSpic',ch,t,1,72,octave=4)
        drive_drums(c,t,100,busy=True)
        for b in (0,2,3): c.n('timp',12*3+r if r<7 else 12*2+r,t+b*B,B,85)
        if i%4==0: c.hit('crash',t,3,95)
    th=[('D#5',1),('F#5',1),('G#5',2), ('G#5',1),('B5',1),('E5',2), ('D#5',1),('F#5',1),('B5',2), ('A#5',2),('F#5',2)]
    for start in (0,4,8,12):
        c.theme([('vln',0,0),('vln',-12,-16),('horn',-12,-26 if start<8 else -16)],th,start*c.BAR,90 if start<8 else 98)
    for i in range(8,16): c.n('glock',P('D#6') if i%2==0 else P('F#6'),i*c.BAR,c.BAR,55)
    return c.render(lufs=-20)

# 04 dribbling, solo moment: D minor, 103 bpm, nimble and urgent bed
def cue04():
    c=Cue('04-dribble',103,16); B=c.B
    prog=['Dm','Bb','C','A']*4
    for i,ch in enumerate(prog):
        t=i*c.BAR; r,iv=chord(ch); second=i>=8
        c.n('cb',12*2+r if r<5 else 12*1+r,t,c.BAR,75)
        spic_engine(c,'vcSpic',ch,t,1,82,pat=(0,2,0,1,0,2,1,2))
        if second: spic_engine(c,'vlnSpic',ch,t,1,62,octave=5,pat=(1,2,0,2,1,2,0,2))
        for s in range(8): c.n('vlnPizz' if s%2 else 'vcPizz',c.chord_at(ch,4)[s%3],t+s*B/2,B/2,60)
        c.hit('bd',t,0.8,85); c.hit('bd',t+1.5*B,0.8,65); c.hit('bd',t+2.5*B,0.8,70)
        for s in (1,3): c.hit('snare',t+s*B,0.2,62)
        for s in range(16):
            if s%4==2: c.hit('snare',t+s*B/4,0.1,38)
    run=[('D5',.25),('E5',.25),('F5',.25),('A5',.25),('D6',1),('C6',.5),('A5',.5),('F5',1), ('Bb5',.5),('A5',.5),('G5',.5),('F5',.5),('E5',1),('C5',1),
         ('E5',.25),('F5',.25),('G5',.25),('A5',.25),('C6',1),('Bb5',.5),('A5',.5),('G5',1), ('A5',1),('C#6',1),('E6',2)]
    c.theme([('flute',0,0),('vln',-12,-10)],run,4*c.BAR,80)
    c.theme([('flute',0,0),('vln',0,-6),('oboe',-12,-20)],run,12*c.BAR,86)
    return c.render(lufs=-20)

# 05 they are destroying you: D minor, 96 bpm, heavy, climbing bed (darker than 11, not horror)
def cue05():
    c=Cue('05-under-the-cosh',96,16); B=c.B
    prog=['Dm','Bb','Gm','A']*4
    for i,ch in enumerate(prog):
        t=i*c.BAR; k=i/16; r,iv=chord(ch)
        c.n('cb',12*2+r if r<5 else 12*1+r,t,c.BAR,90)
        c.n('tuba',12*2+r if r<5 else 12*1+r,t,c.BAR,62+15*k)
        c.n('tbn',12*3+r if r<5 else 12*2+r,t,c.BAR*0.5,70+15*k)
        c.pad('vcTrem',ch,t,c.BAR,55+20*k,octave=2)
        spic_engine(c,'vlaSpic',ch,t,1,70+15*k,sub=8,octave=3,pat=(0,0,1,0))
        for s in (0,0.75,2,2.75): c.hit('bd',t+s*B,0.8,95)
        for b in range(4): c.n('timp',P('D2') if r in(2,10,7) else P('A1'),t+b*B,B,70+20*k)
        if i%4==3: [c.hit('snare',t+3*B+s*B/4,0.1,60+s*8) for s in range(4)]
    th=[('A4',2),('Bb4',1),('A4',1), ('F4',2),('D4',2), ('G4',1),('A4',1),('Bb4',1),('D5',1), ('C#5',3),(None,1)]
    c.theme([('horn',-12,0),('vc',-12,-5)],th,4*c.BAR,82)
    c.theme([('horn',-12,0),('vln',0,-5),('vc',-12,-5)],th,8*c.BAR,88)
    c.theme([('horn',-12,4),('vln',0,0),('vln',-12,-10)],th,12*c.BAR,94)
    return c.render(lufs=-20)

# 06 lost / runner-up: E minor, 56 bpm, quiet piano and strings, bed
def cue06():
    c=Cue('06-defeat',56,8); B=c.B
    prog=['Em','C','G','D','Am','Em','C','B']
    for i,ch in enumerate(prog):
        t=i*c.BAR; r,iv=chord(ch)
        c.n('vc',12*3+r if r<5 else 12*2+r,t,c.BAR,58)
        c.pad('vla',ch,t,c.BAR,40,octave=3); c.pad('vln',ch,t,c.BAR,32,octave=4)
        tones=c.chord_at(ch,3)
        for s,ix in enumerate([0,2,1,2]): c.n('piano',tones[ix]+12*(s==3),t+s*B,B*1.5,45)
        c.n('harp',tones[0]-12,t,2*B,45)
    th=[('B4',2),('A4',1),('G4',1), ('E4',3),(None,1), ('D4',1),('E4',1),('G4',1),('B4',1), ('A4',3),(None,1),
        ('C5',2),('B4',1),('A4',1), ('G4',2),('E4',2), ('E4',1),('G4',1),('A4',1),('G4',1), ('F#4',4)]
    c.theme([('piano',12,10)],th,0,55)
    return c.render(lufs=-22)

# 07 it's going wrong, find a way back: A minor, 81 bpm, quiet then rising bed
def cue07():
    c=Cue('07-find-a-way',81,16); B=c.B
    prog=['Am','F','Dm','E','Am','F','G','E']*2
    for i,ch in enumerate(prog):
        t=i*c.BAR; k=i/16; r,iv=chord(ch); second=i>=8
        c.n('cb',12*2+r if r<5 else 12*1+r,t,c.BAR,70+20*k)
        c.pad('vlaTrem',ch,t,c.BAR,40+25*k,octave=3)
        for s in range(8): c.n('bsnStac',12*3+r if r<5 else 12*2+r,t+s*B/2,B/2,62 if s%2==0 else 50)
        c.n('timp',P('A1') if r in(9,5) else P('E2'),t,B,55+30*k); c.n('timp',P('A1') if r in(9,5) else P('E2'),t+2*B,B,50+30*k)
        if second:
            spic_engine(c,'vcSpic',ch,t,1,70+10*k,sub=8,octave=3); c.hit('bd',t,0.8,75); c.hit('bd',t+2*B,0.8,65)
            c.pad('horn',ch,t,c.BAR,50,octave=3)
    th=[('E5',1),('C5',1),('A4',2), ('F5',1),('E5',1),('D5',2), ('D5',1),('F5',1),('A5',1),('G#5',1), ('E5',4)]
    c.theme([('oboe',-12,0)],th,4*c.BAR,70)
    c.theme([('vln',0,0),('vln',-12,-14),('oboe',-12,-10)],th,8*c.BAR,82)
    c.theme([('vln',0,4),('vln',-12,-10),('horn',-12,-22)],th,12*c.BAR,88)
    return c.render(lufs=-20)

# 08 lobby / after a loss: Eb minor, 92 bpm, cool and calm home-screen bed
def cue08():
    c=Cue('08-lobby',92,16); B=c.B
    prog=['Ebm','B','Gb','Db']*4
    for i,ch in enumerate(prog):
        t=i*c.BAR; r,iv=chord(ch); second=i>=8
        c.n('vc',12*3+r if r<5 else 12*2+r,t,c.BAR,55)
        c.pad('vla',ch,t,c.BAR,42,octave=3)
        tones=c.chord_at(ch,4)
        for s,ix in enumerate([0,1,2,1,2,1,0,1]): c.n('piano',tones[ix],t+s*B/2,B/2,52 if s%2==0 else 40)
        for b in (0,2.5): c.n('vcPizz',12*2+r if r>=4 else 12*3+r,t+b*B,B,66)
        c.hit('bd',t,0.8,50); c.hit('bd',t+2.5*B,0.8,40)
        if second: c.hit('snare',t+3*B,0.2,30)
    th=[('Bb5',1.5),('Gb5',.5),('F5',2), ('Eb5',1),('F5',1),('Gb5',2), ('Bb5',1),('Db6',1),('Bb5',1),('Ab5',1), ('F5',4)]
    c.theme([('flute',0,0)],th,4*c.BAR,62); c.theme([('flute',0,0),('clar',-12,-12)],th,12*c.BAR,66)
    return c.render(lufs=-22)

# 09 level, one last attack: Db major, 103 bpm, urgent and hopeful bed
def cue09():
    c=Cue('09-last-attack',103,16); B=c.B
    prog=['Db','Bbm','Gb','Ab']*4
    for i,ch in enumerate(prog):
        t=i*c.BAR; k=i/16; r,iv=chord(ch)
        c.n('cb',12*2+r if r<5 else 12*1+r,t,c.BAR,85)
        c.pad('vla',ch,t,c.BAR,58,octave=3)
        spic_engine(c,'vcSpic',ch,t,1,82+10*k); spic_engine(c,'vlnSpic',ch,t,1,60+12*k,octave=5,pat=(0,1,2,1))
        drive_drums(c,t,92+10*k,busy=True)
        for b in range(4): c.n('timp',12*3+r if r<7 else 12*2+r,t+b*B,B,72+15*k)
        if i%4==3: [c.hit('snare',t+2*B+s*B/4,0.1,50+s*6) for s in range(8)]
        if i in (8,12): c.hit('crash',t,3,100)
    th=[('Ab4',1),('Db5',1),('Eb5',1),('F5',1), ('F5',1),('Eb5',1),('Db5',2), ('Bb4',1),('Db5',1),('Gb5',2), ('F5',1),('Eb5',1),('C5',2)]
    c.theme([('horn',-12,0),('vla',0,-10)],th,4*c.BAR,80)
    c.theme([('vln',0,0),('vln',-12,-14),('horn',-12,-12)],th,8*c.BAR,92)
    c.theme([('vln',12,-4),('vln',0,0),('horn',-12,-8)],th,12*c.BAR,96)
    return c.render(lufs=-20)

# 10 a good spell: Db major, 118 bpm, light and moving forward bed
def cue10():
    c=Cue('10-good-spell',118,16); B=c.B
    prog=['Db','Ab','Bbm','Gb']*4
    for i,ch in enumerate(prog):
        t=i*c.BAR; r,iv=chord(ch); second=i>=8
        c.n('cb',12*2+r if r<5 else 12*1+r,t,c.BAR,72)
        c.pad('vla',ch,t,c.BAR,48,octave=3)
        for s in range(8): c.n('vcPizz' if s%2==0 else 'vlnPizz',c.chord_at(ch,3 if s%2==0 else 4)[s%3],t+s*B/2,B/2,64)
        if second: spic_engine(c,'vlaSpic',ch,t,1,62,octave=4)
        c.hit('bd',t,0.8,70); c.hit('bd',t+2*B,0.8,62); c.hit('snare',t+B,0.2,40); c.hit('snare',t+3*B,0.2,46)
        c.n('glock',c.chord_at(ch,6)[0],t,c.BAR,40)
    th=[('F5',1),('Ab5',1),('Bb5',1),('Ab5',1), ('Eb5',2),('C5',2), ('Db5',1),('F5',1),('Bb5',1),('C6',1), ('Db6',2),('Bb5',2)]
    c.theme([('flute',0,0),('oboe',-12,-14)],th,4*c.BAR,72)
    c.theme([('vln',0,0),('flute',12,-16),('horn',-12,-24)],th,12*c.BAR,80)
    return c.render(lufs=-21)

# 11 final boss: loop bed made from v3's main section (the full v3 is the one-shot)
def cue11():
    c=Cue('11-final-boss',92,8); B=c.B
    prog=['Em','C','Am','B','Em','C','F','B']
    for i,ch in enumerate(prog):
        t=i*c.BAR; r,iv=chord(ch)
        c.n('cb',12*1+r+(12 if r>4 else 0),t,c.BAR,95); c.n('vc',12*2+r if r>=4 else 12*3+r,t,c.BAR,90)
        spic_engine(c,'vcSpic',ch,t,1,88); spic_engine(c,'vlaSpic',ch,t,1,76,octave=4)
        c.pad('horn',ch,t,c.BAR,62,octave=3)
        c.n('tbn',12*3+r if r<5 else 12*2+r,t,2*B,80); c.n('tuba',12*2+r if r<8 else 12*1+r,t,c.BAR,72)
        for s in (0,1.5,2,3.5): c.hit('bd',t+s*B,0.8,100 if s in(0,2) else 80)
        c.hit('snare',t+3*B,0.2,70)
        for s in (0,1,2,3): c.n('timp',12*3+r if r<7 else 12*2+r,t+s*B,B,90 if s==0 else 72)
        if i==0: c.hit('crash',t,3,105)
    th=[('B4',1),('E5',1),('F#5',1),('G5',1),('E5',2),('D5',1),('E5',1),('C5',1),('E5',1),('A5',2),('G5',1),('F#5',1),('D#5',2),
        ('B4',1),('E5',1),('F#5',1),('G5',1),('B5',2),('A5',1),('G5',1),('A5',1),('F5',1),('E5',1),('D5',1),('D#5',2),('F#5',1),('B5',1)]
    c.theme([('vln',0,0),('vln',-12,-18),('horn',-12,-32)],th,0,94)
    return c.render(lufs=-20)

CUES={k[3:]:v for k,v in globals().items() if k.startswith('cue')}
if __name__=='__main__':
    for k in sys.argv[1:]: CUES[k]()
