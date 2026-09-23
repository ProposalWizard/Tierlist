/**
 * lib/patchNotesDemos.ts
 *
 * The hand-built visuals that go with individual patch-note items in the
 * SHAREABLE ARTIFACT. lib/patchNotesData.ts names one with `demo: "<key>"`;
 * scripts/patch-notes-artifact.mts looks the key up here and drops the markup
 * in under that item. The archive at /admin/patch-notes ignores them.
 *
 * Why they are here and not in the data file: everything in patchNotesData.ts
 * is plain data — readable, queryable, diffable. These are markup and script.
 * Keeping them apart means the words still have exactly one copy, and a demo
 * is an extra rather than something the archive has to know how to render.
 *
 * These exist because the notes were reported back as unclear: the reader is
 * not a coder, and "a team-mate was in your shooting lane 34.4% of the time"
 * lands very differently from a pitch you can press Simulate on and watch it
 * happen.
 *
 * THEY ARE ILLUSTRATIONS, NOT THE PRODUCT, and each one says so on its face.
 * Asked for directly: the demo "should not be directly linked to what happens
 * on the site, it's just an example to help understand". So do NOT keep these
 * in step with the gallery as it changes, and do not let anyone read a number
 * off them. The mechanics they teach are real — Save and Commit go to two
 * different places, a chance is checked against rules and repaired, three
 * matching corrections make a proposal. The geometry, the odds and the
 * wording are a cartoon of that, chosen to be understood in ten seconds.
 */

/**
 * The colour tokens the demos draw with.
 *
 * The artifact already defines these for its whole page, so it never needs
 * this. The archive at /admin/patch-notes does: it is a Tailwind page with
 * hard-coded hex, no CSS variables, and it runs each demo inside its own
 * frame — which starts with nothing. Dark only, because that page is.
 */
export const DEMO_TOKENS = `
  :root{
    --card:#141d18;--card2:#192520;--line:#24332b;
    --ink:#f2f7f4;--ink2:#9fb6aa;--ink3:#6f8679;
    --green:#3ddc84;--amber:#f5b942;--red:#ff6b6b;--blue:#6fb8ff;
    --r:12px;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:transparent;color:var(--ink);
    font:15.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  .demo{margin:0 !important}
`;

/* Shared look for every demo box. Emitted once, before the first demo. */
export const DEMO_CSS = `
  .demo{background:var(--card);border:1px solid var(--line);border-radius:var(--r);
    padding:14px;margin:12px 0 2px}
  .demo h4{margin:0 0 3px;font-size:13px;font-weight:800;letter-spacing:.04em;
    text-transform:uppercase;color:var(--ink3)}
  .demo .how{margin:0 0 11px;font-size:13px;color:var(--ink2)}
  .demo .eg{display:block;font-size:11.5px;font-weight:700;color:var(--ink3);
    border:1px dashed var(--line);border-radius:8px;padding:7px 10px;margin:0 0 11px}
  .demo svg{width:100%;height:auto;display:block;border-radius:8px;background:var(--card2);
    border:1px solid var(--line);touch-action:none}
  .btn{appearance:none;border:1px solid var(--line);background:var(--card2);color:var(--ink);
    font:inherit;font-size:13px;font-weight:700;padding:8px 14px;border-radius:999px;cursor:pointer}
  .btn:hover{border-color:var(--ink3)}
  .btn:disabled{opacity:.4;cursor:default}
  .btn.go{background:var(--green);border-color:var(--green);color:#06170e}
  .btn.go:disabled{background:var(--card2);border-color:var(--line);color:var(--ink)}
  .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:11px}
  .rules{list-style:none;margin:11px 0 0;padding:0;font-size:13.5px}
  .rules li{display:flex;gap:8px;align-items:flex-start;padding:4px 0;color:var(--ink2)}
  .rules .m{flex:0 0 auto;font-weight:800;width:14px;text-align:center}
  .ok .m{color:var(--green)} .no .m{color:var(--red)} .fixed .m{color:var(--amber)}
  .note{margin-top:11px;font-size:13px;color:var(--ink2);min-height:19px}
  .note b{color:var(--ink)}
  .tag{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.06em;
    text-transform:uppercase;padding:2px 8px;border-radius:999px;border:1px solid var(--line);
    background:var(--card2);color:var(--ink3)}
  .tag.on{background:var(--green);border-color:var(--green);color:#06170e}
  .tag.warn{background:var(--amber);border-color:var(--amber);color:#1a1200}
  .where{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px}
  .where div{border:1px solid var(--line);border-radius:8px;padding:10px;background:var(--card2)}
  .where b{display:block;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink3)}
  .where span{display:block;font-size:13px;margin-top:5px;color:var(--ink2)}
  .where.hit-db div:first-child, .where.hit-code div:last-child{border-color:var(--green)}
  .where.hit-db div:first-child b, .where.hit-code div:last-child b{color:var(--green)}
  .prop{margin-top:11px;border:1px solid var(--line);border-left:3px solid var(--green);
    border-radius:8px;padding:11px 13px;background:var(--card2)}
  .prop b{display:block;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--green)}
  .prop p{margin:6px 0 0;font-size:13.5px;color:var(--ink2)}
  .count{font-variant-numeric:tabular-nums;font-weight:800;color:var(--ink)}
`;

/* ── Shared pitch drawing ────────────────────────────────────────────────
 * One top-down view of the attacking third, in a 320x210 box. Goal along
 * the top. Every demo below draws into the same geometry so the three read
 * as the same pitch, and so "between the ball and the goal" means the same
 * thing in all of them.
 */
/**
 * Lines are drawn in currentColor, not a fixed white: these pages render in
 * whichever theme the reader is in, and a white-on-white pitch shows nothing
 * at all. The goal itself is the one heavy mark, so it reads first.
 */
const PITCH = `
  <g stroke="currentColor" fill="none" stroke-width="1.5" opacity=".22">
    <rect x="62" y="10" width="196" height="76"/>
    <rect x="112" y="10" width="96" height="31"/>
    <path d="M118 86 A 46 34 0 0 0 202 86"/>
  </g>
  <line x1="0" y1="11" x2="320" y2="11" stroke="currentColor" stroke-width="2" opacity=".4"/>
  <line x1="126" y1="11" x2="194" y2="11" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
`;

/* ── 1. Save vs Commit ─────────────────────────────────────────────────── */
const SAVE_VS_COMMIT = `
<div class="demo" id="d1">
  <h4>Press them and see where the scenario ends up</h4>
  <p class="eg">A drawing to explain the idea \u2014 <b>not</b> the real screen. Simplified on purpose, and the numbers here are made up.</p>
  <p class="how">Two buttons, two destinations. Press either one.</p>

  <div class="row">
    <span class="tag" id="d1-badge">Draft</span>
    <button class="btn" id="d1-save">Save</button>
    <button class="btn" id="d1-commit">Commit to repo</button>
    <button class="btn" id="d1-reset">Start again</button>
  </div>

  <div class="where" id="d1-where">
    <div><b>Database</b><span id="d1-db">empty</span></div>
    <div><b>The game's code</b><span id="d1-code">empty</span></div>
  </div>

  <p class="note" id="d1-note">A new scenario is a <b>draft</b>. It is in your browser and nowhere else.</p>
</div>
<script>
(function(){
  var db=false, code=false, dirty=false;
  var badge=document.getElementById('d1-badge'), where=document.getElementById('d1-where');
  var dbEl=document.getElementById('d1-db'), codeEl=document.getElementById('d1-code');
  var note=document.getElementById('d1-note');
  function paint(){
    dbEl.textContent = db ? 'has this scenario' : 'empty';
    codeEl.textContent = code ? 'has this scenario' : 'empty';
    var label = !db && !code ? 'Draft' : (code && dirty ? 'Modified' : (code ? 'Committed' : 'Saved'));
    badge.textContent = label;
    badge.className = 'tag' + (label==='Committed' ? ' on' : (label==='Modified' ? ' warn' : ''));
  }
  document.getElementById('d1-save').onclick=function(){
    db=true; if(code) dirty=true;
    where.className='where hit-db';
    note.innerHTML = dirty
      ? 'Saved again. The code still has the <b>older</b> version, so this is <b>Modified</b> \\u2014 that badge is the one to watch.'
      : 'Saved. <b>Instant</b>, no waiting. Everyone opening the gallery sees it and the game is already using it.';
    paint();
  };
  document.getElementById('d1-commit').onclick=function(){
    code=true; dirty=false;
    where.className='where hit-code';
    note.innerHTML = 'Committed. Took about <b>two minutes</b> to rebuild \\u2014 and now it survives anything happening to the database.';
    paint();
  };
  document.getElementById('d1-reset').onclick=function(){
    db=false; code=false; dirty=false; where.className='where';
    note.innerHTML='A new scenario is a <b>draft</b>. It is in your browser and nowhere else.';
    paint();
  };
  paint();
})();
</script>`;

/* ── 2. How the tuning works ───────────────────────────────────────────── */
const HOW_TUNING_WORKS = `
<div class="demo" id="d2">
  <h4>Press Simulate</h4>
  <p class="eg">A drawing to explain the idea \u2014 <b>not</b> the real screen. Simplified on purpose, and the numbers here are made up.</p>
  <p class="how">Each press throws up a rough one-on-one and checks it against three rules. Some come
  out wrong on purpose so you can watch one get repaired \u2014 the real gallery does not break this often.</p>

  <svg viewBox="0 0 320 210" role="img" aria-label="A one-on-one chance drawn top down, goal at the top">
    ${PITCH}
    <g id="d2-figs" color="var(--ink)"></g>
  </svg>

  <ul class="rules" id="d2-rules"></ul>
  <div class="row">
    <button class="btn go" id="d2-go">Simulate</button>
    <span class="note" style="margin:0" id="d2-note"></span>
  </div>
</div>
<script>
(function(){
  var figs=document.getElementById('d2-figs'), rules=document.getElementById('d2-rules');
  var note=document.getElementById('d2-note');
  var GOAL={x:160,y:8};
  // A figure near the top of the box gets its name ABOVE it, or the text sits
  // on whoever is standing behind him.
  function fig(x,y,fill,label){
    var ly = y+21;
    return '<g><circle cx="'+x+'" cy="'+y+'" r="8" fill="'+fill+'" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>'+
      '<text x="'+x+'" y="'+ly+'" text-anchor="middle" font-size="9.5" font-weight="700" fill="currentColor" opacity=".75">'+label+'</text></g>';
  }
  function rnd(a,b){return a+Math.random()*(b-a);}
  function draw(s){
    var h='<line x1="'+s.ball.x+'" y1="'+s.ball.y+'" x2="'+GOAL.x+'" y2="'+GOAL.y+
      '" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".55"/>';
    h+=fig(s.keeper.x,s.keeper.y,'#f5b942','keeper');
    s.defs.forEach(function(d){h+=fig(d.x,d.y,'#ff6b6b','defender');});
    h+=fig(s.ball.x,s.ball.y,'#6fb8ff','you');
    h+='<circle cx="'+(s.ball.x+11)+'" cy="'+(s.ball.y+6)+'" r="3.4" fill="#f2f7f4"/>';
    figs.innerHTML=h;
  }
  // "Between the ball and the goal" = close to the dashed line, and ahead of the ball.
  function inLane(p,ball){
    var dx=GOAL.x-ball.x, dy=GOAL.y-ball.y, L=Math.hypot(dx,dy);
    var t=((p.x-ball.x)*dx+(p.y-ball.y)*dy)/(L*L);
    if(t<=0.04||t>=1) return false;
    return Math.abs((p.x-ball.x)*dy-(p.y-ball.y)*dx)/L < 17;
  }
  function line(state,text){
    return '<li class="'+state+'"><span class="m">'+(state==='no'?'\\u2717':(state==='fixed'?'\\u21BB':'\\u2713'))+
      '</span><span>'+text+'</span></li>';
  }
  document.getElementById('d2-go').onclick=function(){
    var ball={x:rnd(108,212),y:rnd(132,176)};
    var keeper={x:GOAL.x+(ball.x-GOAL.x)*0.22,y:rnd(30,42)};
    var defs=[{x:rnd(34,80),y:rnd(72,116)},{x:rnd(240,290),y:rnd(72,116)}];
    var broke=Math.random()<0.34;
    if(broke) defs.push({x:(ball.x+GOAL.x)/2+rnd(-7,7), y:(ball.y+GOAL.y)/2+rnd(-7,7)});
    var s={ball:ball,keeper:keeper,defs:defs};
    draw(s);
    var bad=defs.filter(function(d){return inLane(d,ball);});
    if(bad.length){
      rules.innerHTML=line('no','A defender is between you and the goal \\u2014 so this is not a one-on-one')
        +line('ok','Nobody is nearer the goal than the ball')
        +line('ok','No team-mate in the way of your shot');
      note.innerHTML='<b>Broken.</b> Repairing\\u2026';
      setTimeout(function(){
        bad.forEach(function(d){ d.x = d.x < GOAL.x ? d.x-52 : d.x+52; });
        draw(s);
        rules.innerHTML=line('fixed','Defender moved out from between you and the goal')
          +line('ok','Nobody is nearer the goal than the ball')
          +line('ok','No team-mate in the way of your shot');
        note.innerHTML='<b>Repaired.</b> This is what you would actually have been shown \\u2014 you never see the broken one.';
      },900);
    } else {
      rules.innerHTML=line('ok','No defender between you and the goal')
        +line('ok','Nobody is nearer the goal than the ball')
        +line('ok','No team-mate in the way of your shot');
      note.innerHTML='Passed all three. Served as it is.';
    }
  };
  document.getElementById('d2-go').click();
})();
</script>`;

/* ── 3. Corrections ────────────────────────────────────────────────────── */
const CORRECTIONS = `
<div class="demo" id="d3">
  <h4>Drag the team-mate out of the way, then press Tune</h4>
  <p class="eg">A drawing to explain the idea \u2014 <b>not</b> the real screen. Simplified on purpose, and the numbers here are made up.</p>
  <p class="how">He is standing in front of your shot. Move him somewhere sensible and press Tune.
  Then do it twice more and watch what happens on the third. Three is the real threshold; everything
  else here is simplified.</p>

  <svg viewBox="0 0 320 210" role="img" aria-label="A chance with a team-mate blocking the shot">
    ${PITCH}
    <line id="d3-lane" stroke="var(--green)" stroke-width="1.5" stroke-dasharray="4 4" opacity=".55"/>
    <g id="d3-figs" color="var(--ink)"></g>
    <g id="d3-mate" color="var(--ink)" style="cursor:grab">
      <circle r="9.5" fill="#ff9f43" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>
      <circle r="18" fill="transparent"/>
      <text y="22" text-anchor="middle" font-size="9.5" font-weight="700"
        fill="currentColor" opacity=".75">team-mate</text>
    </g>
  </svg>

  <div class="row">
    <button class="btn go" id="d3-tune" disabled>Tune</button>
    <span class="tag" id="d3-count">0 of 3 corrections</span>
    <button class="btn" id="d3-reset">Start again</button>
  </div>
  <p class="note" id="d3-note">Drag the <b>orange</b> figure out of the dashed line.</p>
  <div id="d3-prop"></div>
</div>
<script>
(function(){
  var svg=document.querySelector('#d3 svg'), figs=document.getElementById('d3-figs');
  var lane=document.getElementById('d3-lane'), tune=document.getElementById('d3-tune');
  var count=document.getElementById('d3-count'), note=document.getElementById('d3-note');
  var prop=document.getElementById('d3-prop');
  var GOAL={x:160,y:8}, n=0, mate, ball, start, dragging=false;
  function rnd(a,b){return a+Math.random()*(b-a);}
  function inLane(p){
    var dx=GOAL.x-ball.x, dy=GOAL.y-ball.y, L=Math.hypot(dx,dy);
    var t=((p.x-ball.x)*dx+(p.y-ball.y)*dy)/(L*L);
    if(t<=0.04||t>=1) return false;
    return Math.abs((p.x-ball.x)*dy-(p.y-ball.y)*dx)/L < 17;
  }
  var mateEl=document.getElementById('d3-mate');
  function fig(x,y,fill,label){
    var ly = y+21;
    return '<g><circle cx="'+x+'" cy="'+y+'" r="8" fill="'+fill+'" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/>'+
      '<text x="'+x+'" y="'+ly+'" text-anchor="middle" font-size="9.5" font-weight="700" fill="currentColor" opacity=".75">'+label+'</text></g>';
  }
  // The team-mate is a PERSISTENT node moved by transform, never redrawn:
  // replacing the markup mid-drag destroys the very element being dragged,
  // which drops the pointer capture and the drag dies after one move.
  function placeMate(){ mateEl.setAttribute('transform','translate('+mate.x+','+mate.y+')'); }
  function draw(){
    lane.setAttribute('x1',ball.x); lane.setAttribute('y1',ball.y);
    lane.setAttribute('x2',GOAL.x); lane.setAttribute('y2',GOAL.y);
    figs.innerHTML = fig(GOAL.x+(ball.x-GOAL.x)*0.22,34,'#f5b942','keeper')
      + fig(64,92,'#ff6b6b','defender') + fig(258,96,'#ff6b6b','defender')
      + fig(ball.x,ball.y,'#6fb8ff','you')
      + '<circle cx="'+(ball.x+11)+'" cy="'+(ball.y+6)+'" r="3.4" fill="#f2f7f4"/>';
    placeMate();
  }
  function deal(){
    ball={x:rnd(118,202),y:rnd(148,178)};
    // 0.45 of the way to goal, not half: the midpoint lands him on the keeper.
    mate={x:ball.x+(GOAL.x-ball.x)*0.45+rnd(-5,5), y:ball.y+(GOAL.y-ball.y)*0.45+rnd(-4,4)};
    start={x:mate.x,y:mate.y};
    tune.disabled=true; draw();
    note.innerHTML='Drag the <b>orange</b> figure out of the dashed line.';
  }
  function pt(e){
    var r=svg.getBoundingClientRect();
    return {x:(e.clientX-r.left)/r.width*320, y:(e.clientY-r.top)/r.height*210};
  }
  // Grab anywhere on the pitch rather than only on the small circle: on a
  // phone the figure is about 12px across and would be near-impossible to hit.
  svg.addEventListener('pointerdown',function(e){
    dragging=true;
    if(svg.setPointerCapture) try{ svg.setPointerCapture(e.pointerId); }catch(_){}
    move(e); e.preventDefault();
  });
  function move(e){
    var p=pt(e);
    mate.x=Math.max(14,Math.min(306,p.x)); mate.y=Math.max(14,Math.min(188,p.y));
    placeMate();
    var moved=Math.hypot(mate.x-start.x,mate.y-start.y);
    var clear=!inLane(mate);
    tune.disabled = !(clear && moved>14);
    note.innerHTML = clear
      ? (moved>14 ? 'Out of the way. Press <b>Tune</b>.' : 'Nudge him a bit further \\u2014 a tiny move is not counted as a correction.')
      : 'Still in front of your shot.';
  }
  svg.addEventListener('pointermove',function(e){ if(dragging) move(e); });
  ['pointerup','pointercancel'].forEach(function(k){
    svg.addEventListener(k,function(){dragging=false;});
  });
  tune.onclick=function(){
    n++; count.textContent = n+' of 3 corrections';
    count.className = 'tag' + (n>=3 ? ' on' : '');
    if(n<3){
      note.innerHTML='Recorded. <b>Nothing has changed yet</b> \\u2014 one bad chance is not evidence of anything. '+
        'It did not become one of the 17 drawings either.';
      prop.innerHTML='';
      setTimeout(deal,700);
    } else {
      note.innerHTML='Same fix, three times. That is a <b>pattern</b>.';
      prop.innerHTML='<div class="prop"><b>Proposal \\u2014 waiting in the commit tab</b>'+
        '<p>\\u201cA team-mate was standing in your shooting line, and you moved him out, on 3 separate chances. '+
        'Suggested rule: never place a team-mate in the line between the ball and the goal.\\u201d</p>'+
        '<p style="color:var(--ink3)">You approve it or you ignore it. It never changes anything on its own.</p></div>';
      tune.disabled=true;
    }
  };
  document.getElementById('d3-reset').onclick=function(){ n=0; count.textContent='0 of 3 corrections';
    count.className='tag'; prop.innerHTML=''; deal(); };
  deal();
})();
</script>`;

export const DEMOS: Record<string, string> = {
  "save-vs-commit": SAVE_VS_COMMIT,
  "how-tuning-works": HOW_TUNING_WORKS,
  corrections: CORRECTIONS,
};
