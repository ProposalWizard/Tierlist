import re
from mdlib import *

def qrows(lines, rx):
    out=[]
    for l in lines:
        m=re.match(rx,l)
        if m: out.append(split_row(l))
    return out

def clean(s): return s.replace('\\|','|')

# ---------- ADMIN
def admin():
    L=read('admin.md'); items={}
    for r in qrows(L,r'^\| Q(\d+) \|'):
        n=int(r[0][1:]); assert len(r)>=4,r
        items[n]=dict(id='ADM-Q%d'%n,q=clean(r[1]),rec=clean(r[2]),ev=clean(' | '.join(r[3:]) if len(r)>4 else r[3]))
    groups=[("First pass (kept)",1,9),("The 28 unlocked pages",10,37),("Other per-page choices",38,67),
     ("Duplicates and overlaps",68,91),("API routes",92,96),("Testers",97,103),("Registry",104,112),
     ("The new admin home",113,130),("One lock for every page",131,138),("Tool-page side list",139,145),
     ("Build steps: what you see first",146,153)]
    return [dict(name=g,items=[items[n] for n in range(a,b+1)]) for g,a,b in groups], len(items)

# ---------- PATCH NOTES
def patchnotes():
    L=read('patchnotes.md'); items={}
    for r in qrows(L,r'^\| Q(\d+) \|'):
        n=int(r[0][1:])
        if len(r)==6:  # date rows Q140-147
            items[n]=dict(id='PN-Q%d'%n,q='Date for %s: %s → %s?'%(r[1],r[2],r[3]),rec=r[5],ev=r[4])
        elif len(r)==3:
            items[n]=dict(id='PN-Q%d'%n,q=clean(r[1]),rec=clean(r[2]),ev='')
        else:
            assert len(r)==4,(n,r)
            items[n]=dict(id='PN-Q%d'%n,q=clean(r[1]),rec=clean(r[2]),ev=clean(r[3]))
    # note titles Q75-139
    for l in L:
        if re.match(r'^\| N\d+ \|',l):
            r=split_row(l); assert len(r)==10,(r)
            m=re.match(r'Q(\d+) (".*")\?$',r[9]); assert m,r[9]
            n=int(m.group(1))
            items[n]=dict(id='PN-Q%d'%n,q='Title for %s: %s?'%(r[1],m.group(2)),rec='Yes, as written',ev='Evidence %s'%r[7])
    return items

PN_EV={152:'Split: pages exist for all five (Q4).',153:'Split: page is a copy in Leo\'s skill.',154:'Split: page is a copy in Leo\'s skill.',
 155:'Keeps the old merged text on the first note.',156:'Split: Mikey\'s page v0.1 exists (unwired).',157:'Split: merged text stays on v0.2.',
 184:'Step 0 of the move.',185:'Step 1: a type change only.',186:'Step 2: a pure move; 58 notes in, 58 out.',187:'Step 3: the author/version table in section 2.',
 188:'Step 4: split titles Q152–Q157.',189:'Step 5: copy and wiring only.',190:'Step 6: old links like ?v=0.53 must still open.',191:'Step 7: date fixes Q140–Q151.',
 192:'Step 8: 65 one-line summaries.',193:'Step 9: a test plus a build hook.',194:'Step 10: the new archive screen.',195:'Step 11: skills text.',
 196:'Step 12: pages pulled from claude.ai, one note per commit.',197:'Q3 and the rule need Leo and Mikey to agree.'}
PN_EV_ARCH='Archive design, section 7.'

def pn_groups():
    items=patchnotes()
    for n,v in items.items():
        if not v['ev']:
            v['ev']=PN_EV.get(n) or (PN_EV_ARCH if 158<=n<=183 else '')
        assert v['ev'],n
    groups=[("Main questions",1,11),("Clashes: which note keeps the number",12,30),
     ("Missing or wrong pages: pull, rebuild, or lost",31,47),("Other links, later content, page copies",48,74),
     ("Note titles · Harry (33)",75,107),("Note titles · Leo (16)",108,123),("Note titles · Mikey (16)",124,139),
     ("Placeholder dates",140,151),("Splits: titles of the resulting notes",152,157),
     ("Archive design choices",158,183),("Migration steps: what you see or approve first",184,197)]
    return [dict(name=g,items=[items[n] for n in range(a,b+1)]) for g,a,b in groups], len(items)

# ---------- LAG
LAG_EV={
 'Q1':'Snapshot read-back costs 2.4–3.8 s per return here (profiles).',
 'Q2':'Rebuild per return is 4–14 s here; kept alive uses ~10–20 MB of graphics memory (plan).',
 'Q3':'Shader checks are 7.6 s of the 12 s garden open (measured). A broken shader would show black.',
 'Q4':'18.5 s of waiting, 0.2 s of work (measured). It is a feel change.',
 'Q5':'Home idle: 13 fps, 955 ms of blocks per 5 s (measured here).',
 'Q6':'Match code plus scenarios are ~351 KB raw off Home\'s first load (measured).',
 'Q7':'Esc leaves full screen, but the saved "on" brings it back on the next tap (reproduced here).',
 'Q8':'Saved "on" turns it on with no off switch (reproduced in an iPhone profile, not real Safari).',
 'Q9':'From the Home Screen icon the page is always full screen (plan).',
 'Q10':'Name banks 483 KB, club sheets ~200–300 KB raw (measured / estimate).',
 'Q11':'Settings first open fetched 352 KB, Play 413 KB, 2D→3D 95 KB (measured).',
 'Q12':'House second visit: 3.0 s shown, 2.8 s of blocks (measured here).',
 'Q13':'Build order, section 5 of the plan.',
 'Q14':'Phone numbers cannot be measured here: no graphics chip.',
 'QB1':'patch-notes/ 125 MB, playtest-notes/ 33 MB; .git is 614 MB (measured).',
 'QB2':'tools/modeltest is 39 MB of test renders (measured).',
 'QB3':'67 entries = ~88k tokens on every turn (bytes ÷ 4, estimate).',
 'QB4':'Same cause: session entries are 345 KB of the 429 KB file.',
 'QB5':'Biggest skill, 32 KB; not read line by line.',
 'QB6':'Getters return a fixed value since 12 Oct; old scenes are 64 KB and 28 KB.',
 'QB7':'12 MB in public/star/human3d/, never shown in the game (code read).',
 'QB8':'8.4 MB; the new pictures are the fixed value.',
 'QB9':'16 differing lines, both pages 54 KB.',
 'QB10':'418 KB of copied engine; CLAUDE.md says "to port next".',
 'QB11':'Not in the menu, not linked; first load 913, 912 and 445 KB.',
 'QB12':'Last change 26 Sep – 5 Oct; no visit logs, so only owners know.',
 'QB13':'Same Scenario Builder as the gallery tab (see also ADM-Q74).',
 'QB14':'Not in guides or links; last change 2 Sep.',
 'QB15':'Masks may need lossless pixels; not compared yet.',
 'QB16':'It is Mikey\'s own list; your standing rule says you set your own order.',
 'QB17':'The measuring scripts are uncommitted in the worktree.',
 'QB18':'Six loose SoFIFA scripts sit at the top of scripts/.',
 'QB19':'Import graph plus a grep; the list has 18, one (middleware) is a false alarm.',
 'QB20':'Table 8e; callers not opened one by one.',
 'QB21':'10 pictures at the site root; WebP cut 20.6 → 1.4 MB on 20 earlier files.',
 'QB22':'Handbook is 1,041 lines, ~690 are history.',
 'QB23':'Handbook rule 1 and the 3d-building skill still say "every new look gets a toggle".',
 'QB24':'Overruled by "Deploy only when told".',
 'QB25':'CLAUDE.md is the cheapest fix and costs tokens on every turn.'}
def lag():
    L=read('lag.md'); a=[];b=[]
    for l in L:
        m=re.match(r'^\| Q-B(\d+) \|',l)
        if m:
            r=split_row(l); assert len(r)==3
            b.append(dict(id='LAG-QB%s'%m.group(1),q=clean(r[1]),rec=clean(r[2]),ev=LAG_EV['QB'+m.group(1)]))
            continue
        m=re.match(r'^\| Q(\d+) \|',l)
        if m:
            r=split_row(l); assert len(r)==3
            a.append(dict(id='LAG-Q%s'%m.group(1),q=clean(r[1]),rec=clean(r[2]),ev=LAG_EV['Q'+m.group(1)]))
    return [dict(name='Lag, quickness and full screen',items=a),dict(name='Bloat and organisation',items=b)], len(a)+len(b), (len(a),len(b))

# ---------- TEAM BOARD
TB_EV={1:'Claude forgot the progress skill twice; a hook adds 0 tokens, a command ~50k a day per person (reasoned).',
 2:'Pushes need no setup; live bars need SQL and a secret (about 2.5 h, then 3 h more).',
 3:'Leo\'s v0.16 pull request came from a claude/ branch (measured).',
 4:'Admin-only page, admin-only rows; live updates follow the same rule.',
 5:'The hook skips exact repeats; the site limits to one a minute per person.',
 6:'Local pull does not work for you (CLAUDE.md); the hook only runs if that copy is current.',
 7:'Sketch shows a live dot under 10 min and grey over 30.',
 8:'The usage block is long; folded it stays out of the way.',
 9:'Only the owner can open a session link; it still shows which session sent it.',
 10:'50 rows × 3 people ≈ 0.2 MB, no effect on the 500 MB limit.'}
def teamboard():
    L=read('teamboard.md'); s=next(i for i,l in enumerate(L) if l.startswith('## 7. Open questions'))
    L=L[s+1:]; blocks=[]
    for l in L:
        if re.match(r'^\d+\.\s+\*\*',l): blocks.append([l])
        elif blocks and l.strip(): blocks[-1].append(l.strip())
    items=[]
    for bl in blocks:
        txt=' '.join(bl)
        m=re.match(r'^(\d+)\.\s+\*\*(.*?)\*\*\s*(.*)$',txt); n=int(m.group(1))
        rec=m.group(3).replace('**','')
        rec=re.sub(r'^Recommend\s+','',rec)
        items.append(dict(id='TB-Q%d'%n,q=re.sub(r'\s+',' ',m.group(2)),rec=rec[0].upper()+rec[1:],ev=TB_EV[n]))
    return [dict(name='Questions for you',items=items)], len(items)

def all_plans():
    lg,nl,(la,lb)=lag(); pn,np_=pn_groups(); ad,na=admin(); tb,nt=teamboard()
    return [dict(code='LAG',name='Lag, speed and bloat',groups=lg,n=nl),
            dict(code='PN',name='Patch notes',groups=pn,n=np_),
            dict(code='ADM',name='Admin revamp',groups=ad,n=na),
            dict(code='TB',name='Team board',groups=tb,n=nt)], (la,lb)

if __name__=='__main__':
    P,(la,lb)=all_plans()
    for p in P:
        ids=[q['id'] for g in p['groups'] for q in g['items']]
        print(p['code'],p['n'],len(ids),len(set(ids)))
        for g in p['groups']: print('   ',g['name'],len(g['items']))
    print(la,lb, sum(p['n'] for p in P))
    for p in P:
        for g in p['groups']:
            for q in g['items']:
                assert q['q'] and q['rec'] and q['ev'],q['id']
    print(P[3]['groups'][0]['items'][2])
