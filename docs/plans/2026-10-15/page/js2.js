(function(){
  var KEY='__KEY__', st={};
  try{var s=localStorage.getItem(KEY); if(s){var o=JSON.parse(s); if(o&&typeof o==='object')st=o;}}catch(e){}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
  var items=[].slice.call(document.querySelectorAll('.qi'));
  var byId={}; items.forEach(function(el){byId[el.getAttribute('data-id')]=el;});
  var cnt=document.getElementById('cnt'), msg=document.getElementById('cmsg'), cpy=document.getElementById('cpy');
  // carry over old answers: on a card with lettered options, an old "agree" means the recommended letter
  items.forEach(function(el){
    var id=el.getAttribute('data-id'), v=st[id];
    if(v&&v.a==='y'&&el.querySelector('.ops.abc')){var r=el.getAttribute('data-rec'); if(r&&r!=='y'){v.a=r;}}
  });
  save();
  function g(id){return st[id]||(st[id]={a:'',t:''});}
  function done(id){var v=st[id]; return !!(v&&(v.a||(v.t&&v.t.trim())));}
  function paint(el){
    var id=el.getAttribute('data-id'), v=st[id]||{a:'',t:''}, d=done(id);
    el.classList.toggle('done',d);
    [].forEach.call(el.querySelectorAll('button[data-a]'),function(b){
      var a=b.getAttribute('data-a');
      if(a==='note'){b.setAttribute('aria-pressed',!!(v.t&&v.t.trim()));}
      else b.setAttribute('aria-pressed',v.a===a);
    });
    var was=el.querySelector('.was');
    if(was){var abc=el.querySelector('.ops.abc'); was.hidden=!(abc&&v.a==='n'); was.textContent='Earlier answer: ✗ No';}
    var inp=el.querySelector('.qn'); if(document.activeElement!==inp) inp.value=v.t||'';
  }
  var tiers=['need','quick','house'];
  function totals(){
    var n=0,per={need:[0,0],quick:[0,0],house:[0,0]};
    items.forEach(function(el){var t=el.getAttribute('data-tier'),d=done(el.getAttribute('data-id'));per[t][1]++; if(d){per[t][0]++;n++;}});
    cnt.textContent=n+' of '+items.length+' answered';
    tiers.forEach(function(t){var e=document.querySelector('[data-tc="'+t+'"]'); if(e)e.textContent=per[t][0]+' of '+per[t][1]+' answered';});
    [].forEach.call(document.querySelectorAll('ul.sl'),function(u){
      var all=u.querySelectorAll('.qi'),d=u.querySelectorAll('.qi.done').length, emp=d===all.length;
      u.classList.toggle('empty',emp); var h=u.previousElementSibling; if(h&&h.classList.contains('ph'))h.classList.toggle('empty',emp);
    });
  }
  function all(){items.forEach(paint);totals();}
  items.forEach(function(el){
    var id=el.getAttribute('data-id'),inp=el.querySelector('.qn');
    el.addEventListener('click',function(ev){
      var b=ev.target.closest('button[data-a]'); if(!b||!el.contains(b))return;
      var a=b.getAttribute('data-a'),v=g(id);
      if(a==='note'){inp.hidden=!inp.hidden; if(!inp.hidden)inp.focus();}
      else v.a=(v.a===a)?'':a;
      save();paint(el);totals();
    });
    inp.addEventListener('input',function(){g(id).t=inp.value;save();paint(el);totals();});
    if(st[id]&&st[id].t) inp.hidden=false;
  });
  [].forEach.call(document.querySelectorAll('[data-acc]'),function(b){
    b.addEventListener('click',function(){
      var t=b.getAttribute('data-acc'),c=0;
      items.forEach(function(el){
        if(el.getAttribute('data-tier')!==t)return;
        var id=el.getAttribute('data-id'); if(!done(id)){g(id).a='y';c++;}
      });
      save();all();
      var m=document.querySelector('[data-am="'+t+'"]'); if(m)m.textContent=c?c+' accepted. Answered ones were left as they were.':'Nothing left to accept here.';
    });
  });
  var fun=document.getElementById('fun');
  fun.addEventListener('click',function(){
    var on=fun.getAttribute('aria-pressed')!=='true'; fun.setAttribute('aria-pressed',on);
    document.body.classList.toggle('f-un',on);
    if(on){var hl=document.querySelector('details.hl'); if(hl)hl.open=true;}
    totals();
  });
  function lines(){
    var out=[];
    items.forEach(function(el){
      var id=el.getAttribute('data-id'); if(!done(id))return;
      var v=st[id],a=v.a,sym=a==='y'?'✓':(a==='n'?'✗':(a?a:'✎')),t=(v.t||'').replace(/\s+/g,' ').trim();
      out.push(id+' '+sym+(t?' '+t:''));
    });
    return out.join('\n');
  }
  function ok(){msg.textContent='Copied. Paste it into the chat.';cpy.hidden=true;}
  function fb(text){
    cpy.hidden=false;cpy.value=text;cpy.focus();cpy.select();
    var r=false;try{r=document.execCommand('copy');}catch(e){}
    msg.textContent=r?'Copied. Paste it into the chat.':'Select the text and copy it.';
    if(r)cpy.hidden=true;
  }
  document.getElementById('copy').addEventListener('click',function(){
    var text=lines();
    if(!text){msg.textContent='Nothing answered yet.';return;}
    try{ if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok,function(){fb(text);});} else fb(text);}catch(e){fb(text);}
  });
  all();
})();
