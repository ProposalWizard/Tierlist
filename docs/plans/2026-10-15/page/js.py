JS = r'''
<script>
(function(){
  var KEY='kib-plans-2026-10-15', st={};
  try{var s=localStorage.getItem(KEY); if(s){var o=JSON.parse(s); if(o&&typeof o==='object')st=o;}}catch(e){}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
  var calls=document.getElementById('calls');
  var items=[].slice.call(document.querySelectorAll('.qi'));
  var cnt=document.getElementById('cnt'), msg=document.getElementById('cmsg'), cpy=document.getElementById('cpy');
  function g(id){return st[id]||(st[id]={a:'',t:''});}
  function done(id){var v=st[id]; return !!(v&&(v.a||(v.t&&v.t.trim())));}
  function paint(el){
    var id=el.getAttribute('data-id'), v=st[id]||{a:'',t:''}, d=done(id);
    el.classList.toggle('y',v.a==='y'); el.classList.toggle('n',v.a==='n');
    el.classList.toggle('done',d); el.classList.toggle('note-only',d&&!v.a);
    var b=el.querySelectorAll('.qb button'), inp=el.querySelector('.qn');
    b[0].setAttribute('aria-pressed',v.a==='y'); b[1].setAttribute('aria-pressed',v.a==='n');
    var open=!inp.hidden; b[2].setAttribute('aria-pressed',!!(v.t&&v.t.trim())||open);
    if(document.activeElement!==inp) inp.value=v.t||'';
  }
  function totals(){
    var n=0,per={};
    items.forEach(function(el){
      var id=el.getAttribute('data-id'),p=el.getAttribute('data-plan'),d=done(id);
      per[p]=per[p]||{t:0,d:0}; per[p].t++; if(d){per[p].d++;n++;}
    });
    cnt.textContent=n+' of '+items.length+' answered';
    [].forEach.call(document.querySelectorAll('[data-pc]'),function(e){var p=per[e.getAttribute('data-pc')];e.textContent=p.d+' of '+p.t+' answered';});
    [].forEach.call(document.querySelectorAll('details.grp'),function(gp){
      var q=gp.querySelectorAll('.qi'),d=0;[].forEach.call(q,function(x){if(x.classList.contains('done'))d++;});
      gp.querySelector('.gc').textContent=d+'/'+q.length;
      gp.classList.toggle('empty',calls.classList.contains('f-un')&&d===q.length);
    });
  }
  function all(){items.forEach(paint);totals();}
  items.forEach(function(el){
    var id=el.getAttribute('data-id'),inp=el.querySelector('.qn');
    el.querySelector('.qb').addEventListener('click',function(ev){
      var b=ev.target.closest('button'); if(!b)return;
      var a=b.getAttribute('data-a'),v=g(id);
      if(a==='y'||a==='n'){v.a=(v.a===a)?'':a;}
      else{inp.hidden=!inp.hidden; if(!inp.hidden)inp.focus();}
      save();paint(el);totals();
    });
    inp.addEventListener('input',function(){g(id).t=inp.value;save();paint(el);totals();});
    if(st[id]&&st[id].t) inp.hidden=false;
  });
  [].forEach.call(document.querySelectorAll('[data-agree]'),function(b){
    b.addEventListener('click',function(){
      var p=b.getAttribute('data-agree'),c=0;
      items.forEach(function(el){
        if(el.getAttribute('data-plan')!==p)return;
        var id=el.getAttribute('data-id'); if(!done(id)){g(id).a='y';c++;}
      });
      save();all();msg.textContent=c+' marked ✓ Agree in this plan.';
    });
  });
  [].forEach.call(document.querySelectorAll('[data-f]'),function(b){
    b.addEventListener('click',function(){
      var m=b.getAttribute('data-f');calls.classList.toggle('f-un',m==='un');
      [].forEach.call(document.querySelectorAll('[data-f]'),function(x){x.setAttribute('aria-pressed',x===b);});
      totals();
    });
  });
  function lines(){
    var out=[];
    items.forEach(function(el){
      var id=el.getAttribute('data-id'); if(!done(id))return;
      var v=st[id],sym=v.a==='y'?'✓':(v.a==='n'?'✗':'✎'),t=(v.t||'').replace(/\s+/g,' ').trim();
      out.push(id+' '+sym+(t?' '+t:''));
    });
    return out.join('\n');
  }
  function ok(){msg.textContent='Copied. Paste it into the chat.';cpy.hidden=true;}
  function fb(text){
    cpy.hidden=false;cpy.value=text;cpy.focus();cpy.select();
    var r=false;try{r=document.execCommand('copy');}catch(e){}
    msg.textContent=r?'Copied. Paste it into the chat.':'Select the text below and copy it.';
    if(r)cpy.hidden=true;
  }
  document.getElementById('copy').addEventListener('click',function(){
    var text=lines();
    if(!text){msg.textContent='Nothing answered yet.';return;}
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(ok,function(){fb(text);});
      }else fb(text);
    }catch(e){fb(text);}
  });
  all();
})();
</script>
'''
