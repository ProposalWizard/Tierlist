(function(){
var P=__PAGES__;
var KEY="kib-admin-fates-v1",saved={};
try{saved=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){saved={}}
var cur={};P.forEach(function(p){cur[p.u]=saved[p.u]||p.f});
var ORDER=[["RBD","Career screens"],["RBD","Chances"],["RBD","Match tests"],["RBD","Real data"],["RBD","3D places"],["RBD","Players + animation"],["RBD","Money + rewards"],["RBD","Sound"],["Site",""],["PL Draft",""],["Tierlists",""],["Old","Old tests"]];
var LBL={keep:"Keep",old:"Old",del:"Delete"},CLS={keep:"k",old:"o",del:"d"};
var box=document.getElementById("fates");
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function title(s,g){return s==="RBD"?"Road to Ballon d'Or › "+g:(s==="Old"?"Old tests and deletes":s)}
ORDER.forEach(function(sg){
  var list=P.filter(function(p){return p.s===sg[0]&&p.g===sg[1]});
  if(!list.length)return;
  var d=document.createElement("details");
  if(sg[0]==="Old")d.open=true;
  var h='<summary>'+esc(title(sg[0],sg[1]))+' ('+list.length+')</summary><ul class="fl">';
  list.forEach(function(p){
    var id=p.u.replace(/[^a-z0-9]/gi,"_");
    h+='<li data-u="'+esc(p.u)+'"><div class="top"><div class="nm"><b>'+esc(p.n)+'</b>'+(p.you?'<span class="tag t-you">you said</span>':'')+'<span class="tag t-chg" hidden>changed</span><div class="u">'+esc(p.u)+'</div></div><div class="seg" role="group" aria-label="Fate of '+esc(p.n)+'">';
    ["keep","old","del"].forEach(function(f){h+='<button type="button" id="'+id+'_'+f+'" class="'+CLS[f]+'" data-f="'+f+'">'+LBL[f]+'</button>'});
    h+='</div></div><div class="meta">'+esc(p.w)+' · '+esc(p.o)+' · '+esc(p.l)+'</div>'+(p.why?'<div class="why">'+esc(p.why)+'</div>':'')+'</li>';
  });
  d.innerHTML=h+'</ul>';box.appendChild(d);
});
function paint(){
  var c={keep:0,old:0,del:0};
  P.forEach(function(p){c[cur[p.u]]++;
    var li=box.querySelector('li[data-u="'+p.u+'"]');if(!li)return;
    li.querySelectorAll("button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.f===cur[p.u]?"true":"false")});
    li.querySelector(".t-chg").hidden=(cur[p.u]===p.f);
  });
  document.getElementById("tot").innerHTML='<span class="k">Keep '+c.keep+'</span><span class="o">Old '+c.old+'</span><span class="d">Delete '+c.del+'</span>';
  document.querySelectorAll("[data-k]").forEach(function(e){var p0={keep:0,old:0,del:0};P.forEach(function(p){p0[p.f]++});e.textContent=p0[e.dataset.k]});
}
box.addEventListener("click",function(e){var b=e.target.closest("button[data-f]");if(!b)return;
  var u=b.closest("li").dataset.u;cur[u]=b.dataset.f;var s={};P.forEach(function(p){if(cur[p.u]!==p.f)s[p.u]=cur[p.u]});
  try{localStorage.setItem(KEY,JSON.stringify(s))}catch(x){}paint()});
function text(){
  var ch=P.filter(function(p){return cur[p.u]!==p.f});
  var t="ADMIN PAGE LIST (point 8): "+(ch.length?ch.length+" change(s) from recommended":"all as recommended")+"\n";
  ch.forEach(function(p){t+="- "+p.n+" ("+p.u+"): "+LBL[p.f]+" -> "+LBL[cur[p.u]]+"\n"});
  ["del","old"].forEach(function(f){t+="\n"+(f==="del"?"DELETE":"OLD TESTS")+": "+P.filter(function(p){return cur[p.u]===f}).map(function(p){return p.u}).join(", ")+"\n"});
  return t;
}
function copyText(t,msgEl,ta){
  var done=function(ok){if(msgEl)msgEl.textContent=ok?"Copied. Paste it into the chat.":"Copy was blocked. Select the text below and copy it."};
  if(ta){ta.value=t;}
  try{navigator.clipboard.writeText(t).then(function(){done(true)},function(){if(ta){ta.hidden=false;ta.select()}done(false)})}catch(e){if(ta){ta.hidden=false;ta.select()}done(false)}
}
document.getElementById("copyFates").addEventListener("click",function(){copyText(text(),document.getElementById("copyMsg"),document.getElementById("fateOut"))});
document.getElementById("resetFates").addEventListener("click",function(){P.forEach(function(p){cur[p.u]=p.f});try{localStorage.removeItem(KEY)}catch(x){}paint()});
document.querySelectorAll("[data-copy]").forEach(function(b){b.addEventListener("click",function(){var t=document.getElementById(b.dataset.copy).textContent;
  try{navigator.clipboard.writeText(t).then(function(){b.textContent="Copied"},function(){b.textContent="Copy blocked: select the text"})}catch(e){b.textContent="Copy blocked: select the text"}})});
paint();
})();
