import re, sys
from mdlib import *
from questions import all_plans
from css import CSS
from js import JS

PLANS,(LA,LB)=all_plans()
TOTAL=sum(p['n'] for p in PLANS)
N={p['code']:p['n'] for p in PLANS}

def pre_for(code):
    def f(s):
        if code=='LAG':
            s=re.sub(r'(?<![-\w])Q-B(\d+)',r'LAG-QB\1',s)
        return re.sub(r'(?<![-\w])Q(\d+)\b',code+r'-Q\1',s)
    return f
PRE={c:pre_for(c) for c in ('LAG','PN','ADM','TB')}

def tog(label, lines, code, rows=True, open_=False):
    h,n=render(lines,PRE[code],skip_h=False)
    lab=label+(' · %d rows'%n if rows and n else '')
    return '<details%s><summary>%s</summary>%s</details>'%(' open' if open_ else '',lab,h)

def tog_html(label, h):
    return '<details><summary>%s</summary>%s</details>'%(label,h)

def tbl(lines,code):
    h,n=render(lines,PRE[code]); return h

def bar(label,was,now,mx,txt,cls=''):
    w=min(100,was/mx*100)
    if now is None:
        return '<div class="bar"><span class="lb">%s</span><div class="track"><div class="fill now %s" style="width:%.1f%%"></div></div><span class="vv">%s</span></div>'%(label,cls or 'warn',w,txt)
    n=min(100,now/mx*100)
    return '<div class="bar"><span class="lb">%s</span><div class="track"><div class="fill was" style="width:%.1f%%"></div><div class="fill now %s" style="width:%.1f%%"></div></div><span class="vv">%s</span></div>'%(label,w,cls,n,txt)

def pts(items):
    return '<ol class="pts">'+''.join('<li><div class="hd">%s</div><div class="dt">%s</div></li>'%(a,b) for a,b in items)+'</ol>'

def sh(t): return '<h3 class="sh">%s</h3>'%t
def fig(src,cap): return '<figure class="fig"><img src="img/%s" alt="" loading="lazy"><figcaption>%s</figcaption></figure>'%(src,cap)
def small_table(head,rows,nw=True):
    h='<div class="tw"><table class="%s" style="min-width:%dpx"><tr>%s</tr>'%('nw' if nw else '',(0 if len(head)<=3 else len(head)*110),''.join('<th>%s</th>'%x for x in head))
    for r in rows: h+='<tr>'+''.join('<td>%s</td>'%x for x in r)+'</tr>'
    return h+'</table></div>'

def arrowdefs(i): return '<defs><marker id="m%s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--ink3)"/></marker></defs>'%i
def box(x,y,w,h,l1,l2='',fill='var(--card2)',stroke='var(--line)',col='var(--ink)'):
    s='<rect x="%d" y="%d" width="%d" height="%d" rx="9" fill="%s" stroke="%s" stroke-width="1.4"/>'%(x,y,w,h,fill,stroke)
    if l2:
        s+='<text x="%d" y="%d" text-anchor="middle" font-size="11.5" font-weight="700" fill="%s">%s</text><text x="%d" y="%d" text-anchor="middle" font-size="11" fill="var(--ink2)">%s</text>'%(x+w/2,y+h/2-2,col,l1,x+w/2,y+h/2+12,l2)
    else:
        s+='<text x="%d" y="%d" text-anchor="middle" font-size="11.5" font-weight="700" fill="%s">%s</text>'%(x+w/2,y+h/2+4,col,l1)
    return s
def arr(x1,y1,x2,y2,i,dash=False):
    return '<path d="M%d %dL%d %d" stroke="var(--ink3)" stroke-width="1.6" fill="none" marker-end="url(#m%s)"%s/>'%(x1,y1,x2,y2,i,' stroke-dasharray="4 4"' if dash else '')

# ================= DIAGRAMS
def svg_home():
    s='<div class="tw diag"><svg viewBox="0 0 400 190" width="100%" style="display:block">'+arrowdefs('a')
    s+='<text x="4" y="14" font-size="12" font-weight="800" fill="var(--red)">TODAY, every return to Home</text>'
    xs=[4,84,164,244,324]
    for x,(a,b) in zip(xs,[('Tap','Back'),('New 3D','context'),('Compile','shaders'),('Photo','snapshot'),('Home','shows')]):
        s+=box(x,22,72,44,a,b)
    for x in xs[:-1]: s+=arr(x+72,44,x+80,44,'a')
    s+='<text x="4" y="86" font-size="12" fill="var(--red)">4–14 s here (computer with no graphics chip)</text>'
    s+='<text x="4" y="118" font-size="12" font-weight="800" fill="var(--green)">PROPOSED</text>'
    xs2=[4,104,204]
    for x,(a,b) in zip(xs2,[('Tap','Back'),('Re-attach','kept player'),('Home','shows')]):
        s+=box(x,126,92,44,a,b,fill='rgba(61,220,132,.10)',stroke='var(--green)')
    for x in xs2[:-1]: s+=arr(x+92,148,x+100,148,'a')
    s+='<text x="304" y="144" font-size="11" fill="var(--ink2)">after: not</text><text x="304" y="158" font-size="11" fill="var(--ink2)">measured yet</text>'
    return s+'</svg></div>'

def svg_pn():
    s='<div class="tw diag"><svg viewBox="0 0 400 176" width="100%" style="display:block">'+arrowdefs('b')
    for y,(a,b) in zip([8,62,116],[('Harry v0.56','own number line'),('Leo v0.17','own number line'),('Mikey v0.16','own number line')]):
        s+=box(4,y,130,46,a,b)
        s+=arr(134,y+23,176,88,'b')
    s+=box(178,60,112,56,'One list','newest first',fill='rgba(61,220,132,.10)',stroke='var(--green)',col='var(--green)')
    s+=arr(290,88,312,88,'b')
    s+=box(314,48,84,80,'id =','harry-v0.56')
    s+='<text x="356" y="118" text-anchor="middle" font-size="10.5" fill="var(--ink2)">old site no.</text><text x="356" y="130" text-anchor="middle" font-size="10.5" fill="var(--ink2)">= alias</text>'
    return s+'</svg></div>'

def svg_adm():
    s='<div class="tw diag"><svg viewBox="0 0 400 200" width="100%" style="display:block">'+arrowdefs('c')
    for y,l in zip([6,44,82,120,158],['Tester-only wrapper','Admin-only wrapper','Server redirect in page','Browser admin check','Browser admin-or-tester']):
        s+=box(4,y,142,32,l)
        s+=arr(146,y+16,176,100,'c')
    s+=box(178,70,86,60,'One gate','DevGate',fill='rgba(61,220,132,.10)',stroke='var(--green)',col='var(--green)')
    s+=arr(264,88,290,52,'c')+arr(264,112,290,148,'c')
    s+=box(292,24,106,52,'26 pages','admins only')
    s+=box(292,124,106,52,'43 pages','admins + testers')
    return s+'</svg></div>'

def svg_tb():
    s='<div class="tw diag"><svg viewBox="0 0 400 190" width="100%" style="display:block">'+arrowdefs('d')
    s+='<text x="4" y="14" font-size="12" font-weight="800" fill="var(--green)">STEP 1 · works the day it ships</text>'
    s+=box(4,22,112,44,'GitHub','pushes, PRs, deploy')+arr(116,44,150,44,'d')
    s+=box(152,22,112,44,'Team board','admin page',fill='rgba(61,220,132,.10)',stroke='var(--green)',col='var(--green)')
    s+='<text x="4" y="104" font-size="12" font-weight="800" fill="var(--blue)">STEP 2 · needs the SQL and a secret</text>'
    xs=[4,104,204,304]
    for x,(a,b) in zip(xs,[('Claude ends','a turn'),('Hook picks','the bar lines'),('Site stores','them'),('Card shows','live bars')]):
        s+=box(x,112,92,44,a,b)
    for x in xs[:-1]: s+=arr(x+92,134,x+100,134,'d')
    s+='<text x="4" y="178" font-size="11" fill="var(--ink2)">No tokens spent, nothing to remember. Skips exact repeats.</text>'
    return s+'</svg></div>'

# ================= PLAN SECTIONS
LAGL=read('lag.md'); PNL=read('patchnotes.md'); ADML=read('admin.md'); TBL=read('teamboard.md')

def lag_section():
    c='LAG'; o=[]
    o.append('<h2 class="fix" id="lag"><i></i>Lag, speed and bloat <span class="qc">%d questions</span></h2>'%N[c])
    o.append('<div class="dt">Measured on a build of the live code, phone-sized, with the processor slowed 4×. This machine has no graphics chip, so every 3D number is worse than a phone. Read 3D numbers as before and after only.</div>')
    o.append(sh('The short version'))
    o.append(pts([
     ('Going back to Home is slow.','The Home player is built again from nothing each time you leave a menu. Here that costs 4–14 s. Fix: keep it, and take a photo of it only when none is saved.'),
     ('The first switch to 3D waits 30 s on a test nobody needs.','A throwaway graphics test runs because the match never says which renderer it uses. Fix: say it once.'),
     ('Full screen cannot be turned off.','On iPhone the row has no switch. On desktop, Esc leaves it and the next tap puts it back. Fix: four small changes and a test.'),
     ('Home loads 1.4 MB of match and data code it does not use.','Out of 4.0 MB. Fix: load it when Play is near.'),
     ('After GET OUT THERE you wait 18.5 s, and only 0.2 s is work.','The commentary plays up to your minute. Faster commentary is a feel change, so it is your call (LAG-Q4).'),
     ('Every chat reads about 107k tokens of notes before it starts.','About 88k of that is old session entries. Fix: move them to the log file.'),
     ('Code and files nothing uses.','18 source files, 36 "decided" settings whose other branch is dead, 12 MB + 8.4 MB of old pictures, and 125 MB of old patch-notes pictures in the repo.')]))
    o.append(svg_home())
    o.append(fig('fullscreen-no-switch.webp','Look at the Full screen row: it only says "How?". There is no switch to turn the full-screen look off. (iPhone profile in a desktop browser, not real Safari.)'))
    o.append(sh('The numbers: before → proposed'))
    b='<div class="bars">'
    b+=bar('Phone → Home',12.1,None,15,'12.1 s',cls='bad')
    b+=bar('League → Home',8.6,None,15,'8.6 s',cls='bad')
    b+=bar('Training → Home',7.5,None,15,'7.5 s',cls='bad')
    b+=bar('Relations → Home',6.8,None,15,'6.8 s',cls='bad')
    b+=bar('Settings → Home',6.3,None,15,'6.3 s',cls='bad')
    b+=bar('Shop → Home',5.3,None,15,'5.3 s',cls='bad')
    b+='</div><div class="note">Return to Home, measured here. After: not measured yet. Step 2 alone removes 2.4–3.8 s of each (the photo read-back). The rest needs the "keep it alive" step.</div>'
    b+='<div class="bars" style="margin-top:14px">'
    b+=bar('First 2D → 3D',40.1,10.1,45,'<s>40.1 s</s> ≈10 s')
    b+=bar('Garden opens',12.0,4.4,45,'<s>12.0 s</s> ≈4.4 s')
    b+=bar('Home first load',4072,3238,4072,'<s>4.0 MB</s> ≈3.2 MB')
    b+=bar('…all four trims',4072,2800,4072,'≈2.8 MB','warn')
    b+=bar('Notes per chat',107,25,107,'<s>107k</s> ≤25k tokens')
    b+='</div><div class="note">First 2D → 3D: plan says −30 s here. Garden: plan says −7.6 s. First load: the plan\'s per-fix sizes added up (two trims = −0.83 MB; all four ≈ −1.2 to −1.3 MB). Notes: a target, not a result. Phone times: reasoned, not measured.</div>'
    o.append(b)
    o.append(tog_html('Repo size today · 6 rows',small_table(['What','Size'],[['patch-notes/ (old patch-notes pages)','125 MB'],['playtest-notes/','33 MB (13 folders)'],['tools/ (modeltest 39 MB of it)','74 MB'],['public/','139 MB, 1,031 files'],['.git on disk','614 MB'],['CLAUDE.md (read every turn)','429 KB, 1,727 lines']])))
    o.append(sh('Findings, ranked by cost'))
    rows=[['Bug','Full screen cannot be turned off','Reproduced here (iPhone profile, not real Safari)'],
     ['C1','3D picture packer opens a throwaway graphics context','30 s of the first 2D → 3D switch. Phone: reasoned 20–200 ms'],
     ['C2','Home 3D player rebuilt on every return to Home','4–14 s per return. Phone: reasoned 150–600 ms'],
     ['C3','Shader checks block the first draw','Garden 7.6 of 12 s. Phone: reasoned, real on Android'],
     ['C4','Home loads 1.4 MB of match and data code it does not use','Home shown 5.2 s; 8.9 s of blocks. Phone: reasoned 0.5–1.5 s'],
     ['C5','After GET OUT THERE the commentary plays to your minute','18.5 s of waiting, 0.2 s of work. Same on a phone'],
     ['C6','Home idle draws the 3D player at 30 fps','955 ms of blocks per 5 s, 13 fps. Phone: reasoned small'],
     ['C7','Lazy screens preload one at a time in a 50-item list','352 KB / 413 KB / 95 KB on first use. Phone: not measured'],
     ['C8','3D house rebuilt every visit','2.8 s of blocks on revisit. Phone: reasoned 0.3–1 s'],
     ['C9','2D flight frames hitch','p95 66.7 ms; one 867 ms; 9 slow in 5 s. Phone: unknown'],
     ['C10','Reload spends 5.2 s on native work, unattributed','5.6 s. Not attributed yet'],
     ['C11','3D → 2D: two runs disagree','10.5 s once, 0.17 s once. Re-check first']]
    o.append(small_table(['#','Finding','Cost, measured here'],rows))
    o.append(tog('Fixes F1–F11 and what each changes',sect(LAGL,'## 3. Fix proposals'),c))
    o.append(tog('Every measured step',sect(LAGL,'### 1a.'),c))
    o.append(tog('Biggest modules in Home\'s first load',sect(LAGL,'### 1b.')[:20],c))
    o.append(tog('Where the time goes: profiles',sect(LAGL,'### 1c.'),c))
    o.append(tog('Causes in full, with phone cost and evidence',sect(LAGL,'## 2. Causes'),c))
    o.append(tog('Full screen: the two cases and the four fixes',sect(LAGL,'## 4. Full screen'),c))
    o.append(tog('What every chat loads',sect(LAGL,'### 8a.'),c))
    o.append(tog('CLAUDE.md, block by block, and the 67 session entries',sect(LAGL,'### 8b.'),c))
    o.append(tog('Skills, agents and the 3D handbook',sect(LAGL,'### 8c.'),c))
    o.append(tog('Source files nothing uses',sect(LAGL,'### 8d.'),c))
    o.append(tog('"Decided, no toggle" settings: the dead branch behind each',sect(LAGL,'### 8e.'),c))
    o.append(tog('Every dev and admin page',sect(LAGL,'### 8f.'),c))
    o.append(tog('public/: biggest files, unnamed files, PNG twins, root pictures',sect(LAGL,'### 8g.'),c))
    o.append(tog('Repo organisation: top level and scripts',sect(LAGL,'### 8h.'),c))
    o.append(tog('Appendix A: raw measured steps',sect(LAGL,'## Appendix A.'),c))
    o.append(tog('Appendix B: first-load JavaScript, every route',sect(LAGL,'## Appendix B.'),c))
    o.append(tog('Appendix C: sound files no code names',sect(LAGL,'## Appendix C.'),c))
    o.append(sh('Build steps'))
    o.append(small_table(['#','Step','Why here'],[
     ['1','Full-screen fix (FS1–4)','A bug; small; its own commit'],
     ['2','Home photo only when missing; release old graphics (F2a, F2b, F2d)','Every return to Home; low risk; one file'],
     ['3','Tell the picture packer which renderer the match uses (F1)','The first 3D switch; one call'],
     ['4','Preload order (F7)','List order only'],
     ['5','Graphics checks off in the live game (F3)','One flag per renderer'],
     ['6','Re-measure with the same script','A before and after table'],
     ['7','Load the match engine and name lists on demand (F4a, F4b)','First load −0.8 MB'],
     ['8','Keep the Home player and the 3D house alive (F2c, F8)','Medium risk; needs its own playtest'],
     ['9','Load templates and club sheets on demand (F4c, F4d)','Bigger refactors'],
     ['10','Profile 2D frames, the reload and 3D → 2D (F9–F11)','Profile first, then plan'],
     ['11','Commentary pace and Home idle rate (F5, F6)','Only if you say yes: they change the feel']],nw=True))
    o.append('<div class="note">Each step: type-check, the one-engine guard, the perf and loading tests, a build, the measuring script, then a playtest. Never touched by any fix: 3D sizes, the match physics, the one-engine guard, Settings rows. Steps 1–5 ship together (LAG-Q13).</div>')
    o.append(sh('Risks'))
    o.append(small_table(['Fix','What','Risk','Changes look or play?'],[
     ['F1','Tell the picture packer which renderer the match uses','Low','No'],
     ['F2a','Take the Home player photo only when none is saved','Low','No'],
     ['F2b','Take it once per session, off the tap, at normal density','Low','No'],
     ['F2c','Keep one Home player alive for the session','Medium: lifetime bugs, lost graphics context','No'],
     ['F2d','Release the old graphics context when Home closes','Low','No'],
     ['F3','Graphics checks off in the live game','Low–medium: a broken shader shows black with no message','No'],
     ['F4a','Load the match engine only when Play is near','Medium: the one-engine guard must still pass','No'],
     ['F4b','Load name lists on demand','Low–medium: callers wait for them today','No'],
     ['F4c','Load media templates and the international engine on demand','Medium: many callers','No'],
     ['F4d','Slim the club sheet data','Medium: the data builder changes','No'],
     ['F5','Fast-forward the commentary after GET OUT THERE','Low technically; a design call','Yes: pacing (LAG-Q4)'],
     ['F6','Draw the Home player only while it moves','Low','Slightly: idle breathing (LAG-Q5)'],
     ['F7','Reorder what preloads; preload on tap-down','Low','No'],
     ['F8','Keep the 3D house for the session','Medium','No'],
     ['F9','Profile 2D flight frames, fix what it names','Unknown until profiled','No'],
     ['F10','Find where the reload\'s 5.2 s goes','Unknown until profiled','No'],
     ['F11','Re-measure 3D → 2D','None: measuring only','No'],
     ['FS1','Leaving full screen clears the saved choice','Low: the photo picker also drops it (LAG-Q7)','No'],
     ['FS2–4','iPhone ignores a saved "on"; switch shows whenever on; a small test','Low','No']],nw=True))
    o.append(sh('What we could not check'))
    o.append(tbl(sect(LAGL,'## 6. What can'),c))
    o.append(tog('Could not check in the bloat audit',sect(LAGL,'### 8i.'),c))
    return '\n'.join(o)

def pn_section():
    c='PN'; o=[]
    o.append('<h2 class="add" id="pn"><i></i>Patch notes <span class="qc">%d questions</span></h2>'%N[c])
    o.append('<div class="dt">Read from the repo at the time of writing, git history, Mikey\'s version list, Leo\'s skill link list and Harry\'s V1 page. One claude.ai page was opened; the other 68 links were not.</div>')
    o.append(sh('The short version'))
    o.append(pts([
     ('Every note gets a name made of who wrote it and their own number.','harry-v0.56, leo-v0.17. Each person counts only their own notes. The old shared number stays as a frozen alias so old links keep working.'),
     ('The 15 renumber clashes are settled one by one.','Each old number goes to the note that held it last (PN-Q12 to Q26).'),
     ('Missing pages come back.','5 can be wired from the repo and 12 pulled from claude.ai. Videos become a still plus a link. Each page is capped at 5 MB. One note is probably lost (Harry v0.51).'),
     ('7 rounds that never got an entry now get one.','Harry v0.14, v0.26, v0.27, v1.1; Leo v0.3, v0.4; Mikey v0.1. Notes go from 58 to 65.'),
     ('Dates become real push times.','8 midnight placeholders and 11 dates later than the note went live get fixed. Each row shows "Live since".'),
     ('The archive screen gets search, a filter by person and day groups.','A note with no kept page says "Full page not kept" and links the original.'),
     ('A check inside the build blocks the next clash.','A duplicate author + version, a missing page or a bad alias stops the deploy.')]))
    o.append(svg_pn())
    o.append(fig('patch-notes-today.webp','Look at the row of version pills: one long line of numbers shared by three people. (Signed out here, so the page shows "Forbidden".)'))
    o.append(sh('The numbers: before → proposed'))
    b='<div class="bars">'
    b+=bar('Notes in the list',58,65,70,'<s>58</s> 65')
    b+=bar('Rounds with no entry',7,0,70,'<s>7</s> 0')
    b+=bar('Renumber clashes',15,0,70,'<s>15</s> blocked by a test','')
    b+=bar('No full page kept',13,1,70,'<s>13</s> 1 (if pulls work)')
    b+=bar('Midnight dates',8,0,70,'<s>8</s> 0')
    b+=bar('Dates after live',11,0,70,'<s>11</s> 0')
    b+='</div><div class="note">Harry 29 → 33, Leo 14 → 16, Mikey 15 → 16. "If pulls work" = the claude.ai pages still open; only 1 of 69 links was read. Repo: patch-notes/ is 125 MB today.</div>'
    o.append(b)
    o.append(sh('Findings, ranked by cost'))
    o.append(small_table(['Finding','Number'],[
     ['Rounds with no note of their own','7'],['Renumbers and clashes in git','15'],
     ['Notes with no full page today','13 (10 + 3 new)'],['Can be pulled from claude.ai','12'],['Can be wired from the repo','5'],
     ['Probably lost: Harry v0.51 (its link now shows v0.52)','1'],['Links where one page shows a later version','2 (v0.9/v0.10 and v0.51/v0.52)'],
     ['Midnight placeholder dates','8'],['Dates later than the note reached main','11'],
     ['claude.ai links found','69'],['Plan pages the archive cannot reach','3']],nw=False))
    o.append('<div class="note">Evidence codes in the tables: P = the page\'s own title or header · D = data entry · C = commit · J = Mikey\'s version list · S = Leo\'s skill · V1 = Harry\'s V1 page · H = another kept page\'s version list.</div>')
    o.append(tog('Every note, Harry (33 rows)',sect(PNL,'### Harry (33)'),c,rows=False))
    o.append(tog('Every note, Leo (16 rows)',sect(PNL,'### Leo (16)'),c,rows=False))
    o.append(tog('Every note, Mikey (16 rows)',sect(PNL,'### Mikey (16)'),c,rows=False))
    o.append(tog('Every clash and renumber',sect(PNL,'## 3. Every clash'),c))
    o.append(tog('Every kept page and copy',sect(PNL,'## 4. Every kept page'),c))
    o.append(tog('Every claude.ai link',sect(PNL,'## 5. Every claude.ai link'),c))
    o.append(tog('The rule in full',sect(PNL,'## 6. The rule'),c))
    o.append(tog('Archive screen sketch',sect(PNL,'## 7. Archive design'),c,rows=False))
    o.append(tog('Summary numbers',sect(PNL,'## 1. Summary'),c))
    o.append(sh('Build steps'))
    o.append(small_table(['#','Step','You see or approve first'],[
     ['0','Merge main; tell Leo\'s and Mikey\'s sessions','OK to tell them first (PN-Q184)'],
     ['1','Add the new fields; author required','Nothing (PN-Q185)'],
     ['2','Split the notes into 3 files, one per person (58 in, 58 out)','The 58 = 58 check (PN-Q186)'],
     ['3','Fill in author and version for every note','The author and version table (PN-Q187)'],
     ['4','Split merged entries; add v0.14, v0.26, v0.27, v1.1','The split titles (PN-Q188)'],
     ['5','Point notes at their pages; wire 3 pages; copy Leo\'s v0.3 and v0.4','Nothing (PN-Q189)'],
     ['6','Links take the new id and the old number','Old links tested (PN-Q190)'],
     ['7','Fix dates; add "live since"; add a stamp script','The date fixes (PN-Q191)'],
     ['8','Write the 65 one-line summaries','All 65 as one list (PN-Q192)'],
     ['9','Add the test and the build hook','Nothing (PN-Q193)'],
     ['10','New archive screen and page-guide text','Stills at 390 px first (PN-Q194)'],
     ['11','Skills, including a new Harry skill','The skill text (PN-Q195)'],
     ['12','Pull pages from claude.ai, one note per commit','A still of each page (PN-Q196)']],nw=True))
    o.append(sh('Risks'))
    o.append(small_table(['Risk','Guard'],[
     ['Two other people\'s number lines change','Harry asks each once (PN-Q197). Leo\'s second v0.16 needs his nod (PN-Q3).'],
     ['Old links break (?v=0.53, ?v=1.1)','Routes take the new id and the old number. Test the old links (PN-Q190).'],
     ['A pulled page is heavy (125 MB already)','5 MB cap each; videos become a still plus a link (PN-Q45, PN-Q46).'],
     ['A claude.ai link shows a later version, or is gone','Mark "link now shows a later version" (PN-Q58, PN-Q59). v0.51 stays text only (PN-Q39).'],
     ['The date fixes rewrite about 20 dates','You approve the list first (PN-Q191).'],
     ['A clash comes back','A test inside the build blocks it (PN-Q7).']],nw=False))
    o.append(sh('What we could not check'))
    o.append(render(sect(PNL,'## 10. Not checked'),PRE[c])[0])
    return '\n'.join(o)

def adm_section():
    c='ADM'; o=[]
    o.append('<h2 class="chg" id="adm"><i></i>Admin revamp <span class="qc">%d questions</span></h2>'%N[c])
    o.append('<div class="dt">Read from the code. Owner names come from page headers, patch notes and commit authors; 4 pages have no proof of an owner. The admin pop-up itself was not seen: it only draws for a signed-in admin.</div>')
    o.append(sh('The short version'))
    o.append(pts([
     ('One home page for every admin and test page.','Cards with a name, one line, owner letter, status and a "writes real data" badge. Search and filters on top. Old tests are folded away.'),
     ('One lock replaces five.','28 pages have no lock today. After: 26 pages for admins only, 43 for admins and testers.'),
     ('Testers get their own list.','Today a tester can only open a page by typing its address. After: a pop-up and a phone menu row showing their 43 pages.'),
     ('One list file holds all 70 pages.','A test inside the build fails if a page is missing from it. A page with no lock can never go live.'),
     ('Tool pages get a side list.','It overlays the page on tool pages and docks beside it on 6 list pages. Phone: a drawer.'),
     ('Clean-up.','Two draft pages merge into one with a V2 | Hero switch. Two dead files go. 6 missing page guides are written. 15 pages move to "Old tests".')]))
    o.append(svg_adm())
    o.append(fig('play-area-today.webp','Look at the page: mostly big link cards to other pages. The side list replaces them, so this page gets shorter. (Top of a 3,999 px page.)'))
    o.append(sh('The numbers: before → proposed'))
    b='<div class="bars">'
    b+=bar('Pages, no lock',28,0,70,'<s>28</s> 0')
    b+=bar('Lock methods',5,1,70,'<s>5</s> 1')
    b+=bar('Testers can open',52,43,70,'<s>52</s> 43')
    b+=bar('In the pop-up',56,69,70,'<s>56</s> 69','')
    b+=bar('Pages with no guide',6,0,70,'<s>6</s> 0')
    b+='</div><div class="note">Lock proposed: admins 26, admins + testers 43. Fate: keep 53 · old tests 15 · merge 1 · delete 0 pages (2 dead files). 49 admin API routes already check admin on every write; no API change.</div>'
    o.append(b)
    o.append(sh('Findings, ranked by cost'))
    o.append(small_table(['Finding','Number / detail'],[
     ['Pages with no lock, many writing shared data','28 of 69'],
     ['Testers can open today, found by typed address only','52 pages'],
     ['Pages missing from today\'s pop-up','13 of 69'],
     ['Tester guide is stale','lists 14 pages, real is 24; says a migration is pending (it is RUN)'],
     ['Pages with no guide','6'],
     ['Two pages with the same name','Squad Builder (×2), Ballon d\'Or (×2)'],
     ['The draft test page sends rooms to the real Draft page','a fix is proposed'],
     ['Dead files nothing imports','2'],
     ['Admin API routes with a write and no admin check','0 of 49']],nw=False))
    o.append(tog('The numbers table',sect(ADML,'## 0. Numbers'),c))
    o.append(tog('Every page: lock now, lock proposed, home, fate',sect(ADML,'## 1. Every page'),c))
    o.append(tog('Every admin API route and its server check',sect(ADML,'## 6. API routes')[:70],c))
    o.append(tog('Testers: today and proposed',sect(ADML,'## 7. Testers')[:8],c))
    o.append(tog('Sketch of the new admin home',sect(ADML,'## 8. Design')[16:33],c,rows=False))
    o.append(sh('Build steps'))
    o.append(small_table(['#','Step','Size','You see or approve first'],[
     ['1','The list file of 70 pages','≈1 h','The page table, answered (ADM-Q146)'],
     ['2','The test inside the build','30 min','One deliberate failing run (ADM-Q147)'],
     ['3','6 missing page guides; names read from the list file','1 h','The 6 guide texts (ADM-Q148)'],
     ['4','One lock; drop the 9 browser checks','1–1.5 h','The list of pages whose access changes (ADM-Q149)'],
     ['5','Pop-up reads the list file; tester pop-up','1 h','Stills at 390 and 1280 (ADM-Q150)'],
     ['6','New admin home and side list','1.5–2 h','A Higgsfield design, then stills (ADM-Q151)'],
     ['7','Draft V2 | Hero switch; redirect; dead files','30 min','The switch working on the draft test page (ADM-Q152)'],
     ['8','Checks and stills','45 min','Pop-up, home on phone and desktop, one tool page (ADM-Q153)']],nw=True))
    o.append(sh('Risks'))
    o.append(small_table(['Risk','Guard'],[
     ['28 open pages close; someone used one signed out','List them in the patch notes'],
     ['A folder is missed when the lock goes in','The list-file test blocks the build'],
     ['The docked side list squeezes a pitch','Overlay by default; dock only on 6 list pages (ADM-Q143)'],
     ['The draft merge touches the real Draft save','The switch only picks the setup screen; save keys stay the same'],
     ['Removing browser checks also hides features','Remove only the page gate; keep feature flags'],
     ['The pop-up rewrite breaks the phone menu','Keep the existing open-menu event and the portal'],
     ['A gate in the middle layer would crash every page','Not used: a failure there breaks every page'],
     ['Other builders edit the same menu and guide files','The list file is new; small changes elsewhere']],nw=False))
    o.append(sh('What we could not check'))
    o.append(small_table(['Item','Why'],[
     ['The admin pop-up on screen','It only draws for a signed-in admin; this machine cannot sign in'],
     ['Owners of pages made before 3 Sep','The copy of the history starts on 3 Sep'],
     ['Who still uses each page','No visit logs; "last change" dates include lock-only commits'],
     ['A size cap on the tuning-notes POST','Not read'],
     ['Admin pages that read the database from the browser (beyond one)','Not checked table by table'],
     ['The tester view on a real tester account','No tester account here']],nw=False))
    return '\n'.join(o)

def tb_section():
    c='TB'; o=[]
    o.append('<h2 class="add" id="tb"><i></i>Team board <span class="qc">%d questions</span></h2>'%N[c])
    o.append('<div class="dt">Each claim in the plan is tagged measured, read or reasoned. Nothing was built; two draft files were deleted.</div>')
    o.append(sh('The short version'))
    o.append(pts([
     ('One admin page shows what each of you is doing.','One card per person: live progress bars, last push, who it is waiting on. Below: open pull requests and whether main is deployed.'),
     ('Pushes first, live bars second.','Pushes work the day it ships with no setup (about 2.5 h). Live bars need Mikey to run one SQL file and set one secret (about 3 h more).'),
     ('Bars are sent by a hook when Claude ends a turn.','No extra tokens, nothing to remember. A command Claude runs itself would cost about 50k tokens a day per person and gets forgotten.')]))
    o.append(svg_tb())
    o.append('<div class="mock"><div class="who">HARRY <span>Harry branch · 2 min ago ●</span></div><div class="bars">'+bar('Keeper dive fix',80,None,100,'80%','')+bar('Patch notes v0.57',30,None,100,'30%','')+'</div><div class="wait">Waiting on: you, to merge → main</div></div><div class="note">A sketch of one card at phone width. Made-up values.</div>')
    o.append(sh('The numbers: before → proposed'))
    b='<div class="bars">'
    b+=bar('Tokens a day, per person',50,0,50,'<s>≈50k</s> 0 (hook)')
    b+=bar('Build time, pushes',2.5,None,6,'2.5 h','')
    b+=bar('Build time, live bars',3,None,6,'+3 h','')
    b+=bar('Database used',0.2,None,6,'0.2 MB of 500','')
    b+='</div><div class="note">A command run by Claude vs the hook (reasoned). Total build about 5.5 h. Rows kept: 50 per person.</div>'
    o.append(b)
    o.append(sh('Findings, ranked by cost'))
    o.append(small_table(['Finding','How known'],[
     ['Not every push is on a named branch: Leo\'s v0.16 came from a claude/ branch. A board watching only Harry, Mikey, Leo and main would miss it.','measured'],
     ['Every commit\'s author is "Claude", so who pushed must come from the branch name or the pull-request opener.','measured'],
     ['Anonymous GitHub is unusable: 0 of 60 calls an hour were left.','measured'],
     ['Vercel\'s own GitHub token can read branches and PRs (repo is public). The real token could not be tested.','reasoned'],
     ['"Last deployed" is readable from main\'s Vercel status.','measured'],
     ['Sessions can reach the site (200). A secret added as a "Network secret" may be a stand-in that fails.','measured / reasoned']],nw=False))
    o.append(tog('Everything that exists now (GitHub, live updates, admin gates, hooks)',sect(TBL,'## 1. What exists now'),c))
    o.append(tog('Three designs compared',sect(TBL,'### Compared'),c))
    o.append(tog('Page sketch at 390 px',sect(TBL,'### Page sketch at 390 px'),c,rows=False))
    o.append(tog('How each person\'s sessions send updates',sect(TBL,'## 4. How each'),c))
    o.append(tog('Security: who reads and who writes',sect(TBL,'## 5. Security'),c))
    o.append(sh('Build steps'))
    o.append(small_table(['#','Step','Size'],[
     ['1','Pushes data: branch commits, open PRs (opener → person), main\'s deploy state, 60 s cache','40 min'],
     ['2','Admin data route: pushes, status rows, "switched on?" flags','20 min'],
     ['3','The page, phone-first, with the page guide eye','60 min'],
     ['4','Tests: PR → person, deploy-state pick, cache','20 min'],
     ['','<b>Ship point 1: pushes live, no setup</b>','≈2.5 h'],
     ['5','The database file: table, admin-read rule, live updates, keep newest 50, check queries','25 min'],
     ['6','Update parser and POST route with token check and rate limit','35 min'],
     ['7','Send script, Stop hook and its settings entry','45 min'],
     ['8','Live updates on the page and the history toggle','30 min'],
     ['9','Tests: parser, validation, token check, hook extract and scrub','25 min'],
     ['10','Skill section, CLAUDE.md row and env line, a still at 390×844','20 min'],
     ['','<b>Ship point 2: live bars, once Mikey runs the SQL and sets the secret</b>','≈3 h more']],nw=True))
    o.append('<div class="note">Total about 5.5 h of building. Needs Mikey: the SQL and the secret (steps below).</div>')
    o.append(tog('Setup steps for Mikey, in plain words',[l for l in sect(TBL,'### Setup steps for Mikey')],c,rows=False))
    o.append(sh('Risks'))
    wc=sect(TBL,'### What can go wrong'); o.append(tbl(wc,c))
    o.append(sh('What we could not check'))
    o.append(small_table(['Item','Status'],[
     ['Vercel\'s own GitHub token reading branches and PRs','Reasoned. The real token is not in this session.'],
     ['Live rows reach only signed-in admins (Realtime follows the table rule)','Reasoned from how the service works; not tested.'],
     ['A secret added as a "Network secret" may be a stand-in','Reasoned from the stand-in seen on the GitHub token.'],
     ['A Stop hook gets the transcript path','Reasoned from how Claude Code hooks work.'],
     ['Whether anyone works on a local computer (TB-Q6)','Unknown. Local sessions only work if that copy of the repo is current.']],nw=False))
    return '\n'.join(o)

# ================= YOUR CALLS
def calls():
    o=['<h2 class="nxt" id="calls"><i></i>Your calls <span class="qc">%d questions</span></h2>'%TOTAL]
    o.append('<div class="dt">Every question from every plan, with its recommended answer. Tap ✓ to agree, ✗ to say no, ✎ to add a line. Your answers stay on this phone. When you are done, tap Copy and paste the result into the chat.</div>')
    o.append('<div id="calls"><div class="cbar"><div class="cnt" id="cnt">0 of %d answered</div><button type="button" class="btn pri" id="copy">Copy my answers</button><div id="cmsg" role="status"></div></div><div class="frow"><span>Show</span><div class="seg" role="group" aria-label="Filter"><button type="button" data-f="all" aria-pressed="true">All</button><button type="button" data-f="un" aria-pressed="false">Unanswered</button></div></div><textarea id="cpy" hidden readonly></textarea>'%TOTAL)
    for pi,p in enumerate(PLANS):
        o.append('<div class="plan"><div class="ph"><b>%s · %d</b><span class="pc" data-pc="%s">0 of %d answered</span><button type="button" class="btn" data-agree="%s">Agree to all unanswered in this plan</button></div>'%(p['name'],p['n'],p['code'],p['n'],p['code']))
        for gi,g in enumerate(p['groups']):
            op=' open' if pi==0 else ''
            o.append('<details class="grp"%s><summary>%s<span class="gc">0/%d</span></summary><ul class="ql">'%(op,esc(g['name']),len(g['items'])))
            for q in g['items']:
                o.append('<li class="qi" data-id="%s" data-plan="%s"><div class="qt"><span class="qid">%s</span>%s</div><div class="qr"><b>Recommended:</b> %s</div><div class="qe"><b>Evidence:</b> %s</div><div class="qb"><button type="button" data-a="y" aria-pressed="false">✓ Agree</button><button type="button" data-a="n" aria-pressed="false">✗ No</button><button type="button" data-a="note" aria-pressed="false">✎ Note</button></div><input class="qn" type="text" maxlength="300" placeholder="One-line note" aria-label="Note for %s" hidden></li>'%(q['id'],p['code'],q['id'],inline(q['q'],bold=False),inline(q['rec'],bold=False),inline(q['ev'],bold=False),q['id']))
            o.append('</ul></details>')
        o.append('</div>')
    o.append('</div>')
    return '\n'.join(o)

def order_list(rows):
    return '<ol class="pts">'+''.join('<li><div class="hd">%s</div><div class="dt"><b>Plan asks:</b> %s</div><div class="dt"><b>This order:</b> %s</div></li>'%tuple(r) for r in rows)+'</ol>'

def top():
    o=[CSS,'<div class="wrap"><header><span class="ver">PLANS</span><h1>Four plans, one page</h1><p class="sub">Lag and bloat · Patch notes · Admin · Team board. Nothing is built yet. %d questions, each with a recommended answer.</p></header>'%TOTAL]
    o.append('<div class="nav"><a href="#order">Build order</a><a href="#lag">Lag</a><a href="#pn">Patch notes</a><a href="#adm">Admin</a><a href="#tb">Team board</a><a href="#calls">Your calls</a><a href="#next">Next</a></div>')
    o.append('<h2 class="fix"><i></i>THE FOUR PLANS</h2><div class="cards">')
    def card(href,t,one,kv,n):
        return '<div class="card"><h3><a href="%s">%s</a><span class="qc">%d Q</span></h3><p class="one">%s</p>%s</div>'%(href,t,n,one,''.join('<div class="kv"><span>%s</span><b>%s</b></div>'%(a,b) for a,b in kv))
    o.append(card('#lag','Lag, speed and bloat','Menus are slow to return to Home. Full screen cannot be turned off. Every chat reads too many notes.',[('Back to Home','4–14 s'),('First 2D → 3D','40 s → ≈10 s'),('Notes per chat','107k → ≤25k tokens')],N['LAG']))
    o.append(card('#pn','Patch notes','Three people share one number line, so numbers clash. Organise all notes by author and fix the archive.',[('Notes','58 → 65'),('Renumber clashes','15 → 0'),('Old pages in the repo','125 MB')],N['PN']))
    o.append(card('#adm','Admin revamp','One home page, one lock, a tester list, and a list file checked by the build.',[('Pages with no lock','28 → 0'),('Testers can open','52 → 43'),('Pages covered','70')],N['ADM']))
    o.append(card('#tb','Team board','One admin page: who pushed what, and live progress bars from each session.',[('Pushes live','≈2.5 h, no setup'),('Live bars','+≈3 h, needs SQL'),('Tokens saved a day','≈50k per person')],N['TB']))
    o.append('</div>')
    o.append('<h2 class="add" id="order"><i></i>BUILD ORDER</h2><div class="dt">Proposed: one piece at a time, each signed off before the next. One build per chat. Where a plan asks for a different order, its order wins. The table shows where.</div>')
    o.append('<div class="flow"><span><b>0</b> · Notes file trim</span><span><b>1</b> · Full-screen fix</span><span><b>2</b> · Lag quick wins</span><span><b>3</b> · Patch notes</span><span><b>4</b> · Admin</span><span><b>5</b> · Team board</span><span><b>6</b> · Code and asset clean-up</span><span class="later">later · bigger lag steps</span></div>')
    o.append(order_list([
     ['Lag plan, LAG-QB25','Trim the notes file first: cheapest, and it cuts about 82k tokens from every turn.','Piece 0. The proposal had the clean-up last; the plan wins. The code and asset deletions stay last (piece 6).'],
     ['Lag plan, step 1 and LAG-Q13','Full-screen fix first. Steps 1–5 ship together, then re-measure.','Piece 1, then piece 2 (Home snapshot, 3D renderer, preload order, shader checks), then a re-measure.'],
     ['Lag plan, steps 7–11','Bigger refactors (keep 3D alive, load code on demand) come after the re-measure. Pacing and idle changes only if you say yes.','Held as "later". Not in pieces 0–6.'],
     ['Patch notes plan, step 0','Merge main and tell Leo\'s and Mikey\'s sessions before the cut-over.','You send one message to each before piece 3 (PN-Q184, PN-Q197).'],
     ['Admin plan, steps 1–8','Each step needs a sign-off first: the table, a failing test run, guide texts, access list, stills, a design pass.','Piece 4 follows those steps. Patch notes stay "link only" there (ADM-Q43).'],
     ['Team board plan, two ship points','Pushes first. Live bars wait for Mikey\'s SQL and the secret.','Piece 5 ships pushes. Live bars follow when Mikey is ready. The admin list file would need a row for this page (reasoned, ADM-Q111).']]))
    return '\n'.join(o)

def nxt():
    return '''<h2 class="nxt" id="next"><i></i>NEXT</h2>
<ol class="pts">
<li><div class="hd">You answer.</div><div class="dt">Use "Agree to all unanswered" for a plan you accept, then change the ones you disagree with. Copy and paste the result here.</div></li>
<li><div class="hd">We update the four plans.</div><div class="dt">One pass, with your answers in.</div></li>
<li><div class="hd">Design with Higgsfield.</div><div class="dt">Pictures of the admin home, the archive screen and the team board before anything is built.</div></li>
<li><div class="hd">Build piece 0, then piece 1.</div><div class="dt">One build per chat, a handoff at the end of each, and your sign-off before the next.</div></li>
</ol>
<footer>15 Oct 2026. Nothing in the game or the site has changed from these plans yet.</footer></div>'''

html_out='\n'.join([top(),lag_section(),pn_section(),adm_section(),tb_section(),calls(),nxt(),JS])
open(sys.argv[1],'w',encoding='utf-8').write(html_out)
print(len(html_out)//1024,'KB')
