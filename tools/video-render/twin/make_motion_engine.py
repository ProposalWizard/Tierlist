# Builds video_motion.html from video_full.html: the same scenes, with a motion layer on top (Mikey, 11 Nov 2026,
# after the Tifo Football Short: "there's always animation on the screen happening to keep the users engaged").
# Measured before: our videos were still 74-76% of the time; the Tifo Short 2%.
# What it adds (every frame still drawn from t alone):
#   (no camera push or drift: tried and taken out, Mikey 11 Nov 2026)
#   life    - backgrounds that move: scrolling stripes, a drifting wallpaper of the club badge, floating light specks
#   faces   - a gentle bob and breathe on every face
#   flips   - a countdown player turns edge-on and comes back as the next one (a card flip), not a slide
#   irises  - a circle grows from the middle to bring in a new part of the video (intro -> list -> why -> this season -> end)
#   tickers - comparison numbers count up as their bars grow; gold confetti on the twin reveal
# Usage: python3 make_motion_engine.py   (writes video_motion.html next to video_full.html); an episode uses it with "engine": "video_motion.html"
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(HERE, 'video_full.html')).read()
def rep(old, new, count=1):
    global s
    assert old in s, old[:80]
    s = s.replace(old, new, count)

rep("const C=document.getElementById('c'), x=C.getContext('2d');",
    "const C=document.getElementById('c'); let x=C.getContext('2d'); let TNOW=0, SEGI=0;\nconst BUF=[0,1].map(()=>{const c=document.createElement('canvas');c.width=1080;c.height=1920;return c;});")
# moving stripes
rep("function stripes(a){x.save();x.globalAlpha=a;x.fillStyle='#fff';for(let i=-6;i<14;i++){x.save();x.translate(i*160,0);",
    "function stripes(a){x.save();x.globalAlpha=a;x.fillStyle='#fff';const off=(TNOW*38)%160;for(let i=-7;i<14;i++){x.save();x.translate(i*160+off,0);")
# club background: a drifting badge wallpaper + light specks
rep("function clubBg(club,Y0=0,H=1920){const c=col(club);const g=x.createLinearGradient(0,Y0,0,Y0+H);g.addColorStop(0,c);g.addColorStop(0.6,shade(c,0.55));g.addColorStop(1,shade(c,0.2));x.fillStyle=g;x.fillRect(0,Y0,1080,H);}",
    "function clubBg(club,Y0=0,H=1920){const c=col(club);const g=x.createLinearGradient(0,Y0,0,Y0+H);g.addColorStop(0,c);g.addColorStop(0.6,shade(c,0.55));g.addColorStop(1,shade(c,0.2));x.fillStyle=g;x.fillRect(0,Y0,1080,H);wallpaper(club,Y0,H);specks(Y0,H);}\n"
    "function wallpaper(club,Y0,H){const im=IMG[club];if(!im)return;x.save();x.beginPath();x.rect(0,Y0,1080,H);x.clip();x.globalAlpha=0.07;const st=180,ox=(TNOW*22)%st,oy=(TNOW*14)%st;"
    "for(let r=-1;r<H/st+2;r++)for(let q=-1;q<1080/st+2;q++){const X=q*st-ox+(r%2?st/2:0),Y=Y0+r*st-oy;x.drawImage(im,X,Y,110,110);}x.restore();}\n"
    "function specks(Y0=0,H=1920){x.save();for(let i=0;i<26;i++){const sd=i*97.13,sp=18+(i%7)*9,X=(sd*13.7)%1080+Math.sin(TNOW*0.6+i)*30,Y=Y0+H-((TNOW*sp+sd*7)%(H+80))+40,r=3+(i%5)*2.2;"
    "x.globalAlpha=0.10+0.10*Math.sin(TNOW*1.3+i);x.fillStyle='#fff';x.beginPath();x.arc(X,Y,r,0,7);x.fill();}x.restore();}")
rep("function darkBg(){const g=x.createLinearGradient(0,0,0,1920);g.addColorStop(0,'#141c33');g.addColorStop(1,'#05070f');x.fillStyle=g;x.fillRect(0,0,1080,1920);",
    "function darkBg(){const g=x.createLinearGradient(0,0,0,1920);g.addColorStop(0,'#141c33');g.addColorStop(1,'#05070f');x.fillStyle=g;x.fillRect(0,0,1080,1920);"
    "{const gx=540+260*Math.sin(TNOW*0.35),gy=900+220*Math.cos(TNOW*0.28),rg=x.createRadialGradient(gx,gy,0,gx,gy,700);rg.addColorStop(0,'rgba(90,120,220,0.20)');rg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rg;x.fillRect(0,0,1080,1920);}specks();")
# faces bob and breathe
rep("function face(k,cx,cy,r,a=1,ring=null,blur=false){if(a<=0||r<=0)return;",
    "function face(k,cx,cy,r,a=1,ring=null,blur=false){if(a<=0||r<=0)return;cy+=r*0.035*Math.sin(TNOW*2.1+cx*0.013);r*=1+0.018*Math.sin(TNOW*2.9+cx*0.02);")
# countdown: the player card flips edge-on and back at the name (replaces the slide)
rep("tag(); x.save();x.translate(slide,0);x.globalAlpha=pl.target?1:clamp(k*1.5);",
    "tag(); x.save();{const fd=Math.abs(t-rt),fl=(rt>0&&fd<0.22)?Math.max(0.03,fd/0.22):1;x.translate(540,0);x.scale(fl,1);x.translate(-540,0);}x.globalAlpha=pl.target?1:clamp(k*1.5);")
# confetti on the twin reveal
rep("      if(gold)T(TGT().short+\"'S STATISTICAL TWIN\",64,1180,F(900,44),GOLD,'left',ease((t-wordT(s,sc.twinAt))/0.3));",
    "      if(gold){T(TGT().short+\"'S STATISTICAL TWIN\",64,1180,F(900,44),GOLD,'left',ease((t-wordT(s,sc.twinAt))/0.3));confetti(t-wordT(s,sc.twinAt));}")
rep("function range(a,b){",
    "function confetti(d){if(d<0||d>2.4)return;x.save();for(let i=0;i<70;i++){const an=i*2.399,v=420+(i%9)*60,X=540+Math.cos(an)*v*d,Y=700+Math.sin(an)*v*d*0.8+520*d*d,rot=d*6+i;"
    "x.save();x.globalAlpha=clamp(1.6-d*0.7);x.translate(X,Y);x.rotate(rot);x.fillStyle=i%3?GOLD:'#fff';x.fillRect(-9,-5,18,10);x.restore();}x.restore();}\nfunction range(a,b){")
# comparison numbers tick up with their bars
rep("T(String(v),d<0?540-30-w:570+w,yy+136,F(900,40),cl,d<0?'right':'left');",
    "{const dp=(String(v).split('.')[1]||'').length;T((v*clamp(a)).toFixed(dp),d<0?540-30-w:570+w,yy+136,F(900,40),cl,d<0?'right':'left');}")
# render: camera + irises between parts
rep("function render(t){x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter='none';const s=seg(t);const sc=SC[s.id];const E=LAYOUT==='split'",
    "function partOf(sc){return sc.type==='cd2'||sc.type==='countdown'?(sc.list||'top'):sc.type==='compare'?'cmp':sc.type;}\n"
    "function drawAt(ctx,s,t){const prev=x;x=ctx;x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter='none';x.clearRect(0,0,1080,1920);const sc=SC[s.id];const E=LAYOUT==='split'?Q:P;"
    "(E[sc.type]||P.end2)(sc,t-s.start,s,t);x.setTransform(1,0,0,1,0,0);x=prev;}\n"   # no camera push/drift (Mikey, 11 Nov 2026: "confusing for the brain", it reset every scene)
    "function render(t){TNOW=t;const s=seg(t);const i=TL.segs.indexOf(s),ps=TL.segs[i-1],sc=SC[s.id];x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter='none';"
    "const d=t-s.start,IR=0.45,iris=ps&&d<IR&&partOf(SC[ps.id])!==partOf(sc);"
    "if(iris){drawAt(BUF[0].getContext('2d'),ps,ps.end-0.02);drawAt(BUF[1].getContext('2d'),s,t);x.drawImage(BUF[0],0,0);const r=ease(d/IR)*1150;"
    "x.save();x.beginPath();x.arc(540,960,r,0,7);x.clip();x.drawImage(BUF[1],0,0);x.restore();x.save();x.strokeStyle='rgba(255,255,255,0.85)';x.lineWidth=14*(1-d/IR);x.beginPath();x.arc(540,960,r,0,7);x.stroke();x.restore();}"
    "else drawAt(x,s,t);"
    "if(sc.type!=='end2'||sc.captions)captions(t,s);}\n"
    "function renderOld(t){x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter='none';const s=seg(t);const sc=SC[s.id];const E=LAYOUT==='split'")
s = s.replace("// Stat Twins full-page engine (8 Nov 2026)", "// Stat Twins MOTION engine (11 Nov 2026), built by make_motion_engine.py from the full-page engine (8 Nov 2026)", 1)
open(os.path.join(HERE, 'video_motion.html'), 'w').write(s)
print('video_motion.html written', len(s))

# ---- the same motion layer for the "How do you replace him?" engine (Mikey, 12 Nov 2026: "apply that same type of thing to
# this replacement player video") -> video_replace_motion.html. Same rules: no camera push/drift; circle wipes between parts.
s = open(os.path.join(HERE, 'video_replace.html')).read()
rep("const C=document.getElementById('c'), x=C.getContext('2d');",
    "const C=document.getElementById('c'); let x=C.getContext('2d'); let TNOW=0;\nconst BUF=[0,1].map(()=>{const c=document.createElement('canvas');c.width=1080;c.height=1920;return c;});")
rep("function stripes(a){x.save();x.globalAlpha=a;x.fillStyle='#fff';for(let i=-6;i<14;i++){x.save();x.translate(i*160,0);",
    "function stripes(a){x.save();x.globalAlpha=a;x.fillStyle='#fff';const off=(TNOW*38)%160;for(let i=-7;i<14;i++){x.save();x.translate(i*160+off,0);")
rep("function clubBg(club,Y0=0,H=1920){const c=col(club);const g=x.createLinearGradient(0,Y0,0,Y0+H);g.addColorStop(0,c);g.addColorStop(0.6,shade(c,0.55));g.addColorStop(1,shade(c,0.2));x.fillStyle=g;x.fillRect(0,Y0,1080,H);}",
    "function clubBg(club,Y0=0,H=1920){const c=col(club);const g=x.createLinearGradient(0,Y0,0,Y0+H);g.addColorStop(0,c);g.addColorStop(0.6,shade(c,0.55));g.addColorStop(1,shade(c,0.2));x.fillStyle=g;x.fillRect(0,Y0,1080,H);wallpaper(club,Y0,H);specks(Y0,H);}\n"
    "function wallpaper(club,Y0,H){const im=IMG[club];if(!im)return;x.save();x.beginPath();x.rect(0,Y0,1080,H);x.clip();x.globalAlpha=0.07;const st=180,ox=(TNOW*22)%st,oy=(TNOW*14)%st;"
    "for(let r=-1;r<H/st+2;r++)for(let q=-1;q<1080/st+2;q++){const X=q*st-ox+(r%2?st/2:0),Y=Y0+r*st-oy;x.drawImage(im,X,Y,110,110);}x.restore();}\n"
    "function specks(Y0=0,H=1920){x.save();for(let i=0;i<26;i++){const sd=i*97.13,sp=18+(i%7)*9,X=(sd*13.7)%1080+Math.sin(TNOW*0.6+i)*30,Y=Y0+H-((TNOW*sp+sd*7)%(H+80))+40,r=3+(i%5)*2.2;"
    "x.globalAlpha=0.10+0.10*Math.sin(TNOW*1.3+i);x.fillStyle='#fff';x.beginPath();x.arc(X,Y,r,0,7);x.fill();}x.restore();}")
rep("function darkBg(){const g=x.createLinearGradient(0,0,0,1920);g.addColorStop(0,'#141c33');g.addColorStop(1,'#05070f');x.fillStyle=g;x.fillRect(0,0,1080,1920);",
    "function darkBg(){const g=x.createLinearGradient(0,0,0,1920);g.addColorStop(0,'#141c33');g.addColorStop(1,'#05070f');x.fillStyle=g;x.fillRect(0,0,1080,1920);"
    "{const gx=540+260*Math.sin(TNOW*0.35),gy=900+220*Math.cos(TNOW*0.28),rg=x.createRadialGradient(gx,gy,0,gx,gy,700);rg.addColorStop(0,'rgba(90,120,220,0.20)');rg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rg;x.fillRect(0,0,1080,1920);}specks();")
rep("function face(k,cx,cy,r,a=1,ring=null,blur=false){if(a<=0||r<=0)return;",
    "function face(k,cx,cy,r,a=1,ring=null,blur=false){if(a<=0||r<=0)return;cy+=r*0.035*Math.sin(TNOW*2.1+cx*0.013);r*=1+0.018*Math.sin(TNOW*2.9+cx*0.02);")
rep("T(String(v),d<0?540-30-w:570+w,yy+136,F(900,40),cl,d<0?'right':'left');",
    "{const dp=(String(v).split('.')[1]||'').length;T((v*clamp(a)).toFixed(dp),d<0?540-30-w:570+w,yy+136,F(900,40),cl,d<0?'right':'left');}")
# gold confetti when each option is named (the OPTION pill lands)
rep("  if(sc.pill){const ft=wordT(s,sc.pillAt);if(t>=ft)pill(sc.pill,540,250,44,GOLD,'#111',-0.03,clamp(back((t-ft)/0.4),0,1.2));}",
    "  if(sc.pill){const ft=wordT(s,sc.pillAt);if(t>=ft){pill(sc.pill,540,250,44,GOLD,'#111',-0.03,clamp(back((t-ft)/0.4),0,1.2));confetti(t-ft);}}")
rep("const P={};",
    "function confetti(d){if(d<0||d>2.4)return;x.save();for(let i=0;i<70;i++){const an=i*2.399,v=420+(i%9)*60,X=540+Math.cos(an)*v*d,Y=560+Math.sin(an)*v*d*0.8+520*d*d,rot=d*6+i;"
    "x.save();x.globalAlpha=clamp(1.6-d*0.7);x.translate(X,Y);x.rotate(rot);x.fillStyle=i%3?GOLD:'#fff';x.fillRect(-9,-5,18,10);x.restore();}x.restore();}\nconst P={};")
rep("function render(t){x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter='none';const s=seg(t);const sc=SC[s.id];(P[sc.type]||P.end)(sc,t-s.start,s,t);x.setTransform(1,0,0,1,0,0);captions(t,s);}",
    "function drawAt(ctx,s,t){const prev=x;x=ctx;x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter='none';x.clearRect(0,0,1080,1920);const sc=SC[s.id];(P[sc.type]||P.end)(sc,t-s.start,s,t);x.setTransform(1,0,0,1,0,0);x=prev;}\n"
    "function render(t){TNOW=t;const s=seg(t);const i=TL.segs.indexOf(s),ps=TL.segs[i-1],sc=SC[s.id];x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter='none';"
    "const d=t-s.start,IR=0.45,iris=ps&&d<IR&&SC[ps.id].type!==sc.type;"
    "if(iris){drawAt(BUF[0].getContext('2d'),ps,ps.end-0.02);drawAt(BUF[1].getContext('2d'),s,t);x.drawImage(BUF[0],0,0);const r=ease(d/IR)*1150;"
    "x.save();x.beginPath();x.arc(540,960,r,0,7);x.clip();x.drawImage(BUF[1],0,0);x.restore();x.save();x.strokeStyle='rgba(255,255,255,0.85)';x.lineWidth=14*(1-d/IR);x.beginPath();x.arc(540,960,r,0,7);x.stroke();x.restore();}"
    "else drawAt(x,s,t);captions(t,s);}")
open(os.path.join(HERE, 'video_replace_motion.html'), 'w').write(s)
print('video_replace_motion.html written', len(s))
