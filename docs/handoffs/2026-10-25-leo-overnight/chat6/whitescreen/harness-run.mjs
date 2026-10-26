// usage: node run.mjs <run#> <mode: skip|play|reloadAwardsNight|reloadAwardsPage+Reel> 
import {launch,BASE} from "./h.mjs";
import fs from "node:fs";
const RUN=+process.argv[2], MODE=process.argv[3]||"skip";
const DIR=`out/r${RUN}`; fs.mkdirSync(DIR,{recursive:true});
const log=[]; const L=(o)=>{log.push(o);console.log(JSON.stringify(o).slice(0,400))};
const {b,ctx,pg}=await launch("snap.json");
const errs=[];const _end=async()=>{try{await b.close()}catch{};process.exit(2)};process.on("SIGTERM",_end);setTimeout(_end,MODE==='play'?1000000:540000);let reqN=0,chunkReq=[];
const T0=Date.now();const now=()=>Date.now()-T0;
pg.on("pageerror",e=>{errs.push({t:now(),k:"pageerror",m:e.message.slice(0,200)});L({t:now(),pageerror:e.message.slice(0,200)})});
pg.on("console",m=>{if(m.type()==="error"){const x=m.text();if(/flagcdn|googletag|sentry|CERT/.test(x))return;errs.push({t:now(),k:"console",m:x.slice(0,200)});L({t:now(),console:x.slice(0,200)})}});
pg.on("requestfailed",r=>{const f=r.failure()?.errorText||"";if(/ERR_ABORTED/.test(f))return;if(/flagcdn|googletag|sentry|supabase|google/.test(r.url()))return;L({t:now(),reqfail:r.url().slice(0,120),f})});
pg.on("response",r=>{if(r.status()>=400&&!/flagcdn|googletag|sentry|supabase|google/.test(r.url()))L({t:now(),http:r.status(),u:r.url().slice(0,120)})});
pg.on("request",r=>{if(/_next\/static\/chunks/.test(r.url())&&r.url().endsWith(".js"))chunkReq.push({t:now(),u:r.url().split("/").pop()})});

const spans=[];
await pg.exposeFunction("__rec",(o)=>{o.t=Date.now()-T0;spans.push(o);L({blankspan:o})});
await pg.addInitScript(()=>{
  let start=null,info=null;
  const check=()=>{
    if(!document.body)return;
    const t=document.body.innerText.split("KNOWITBALL GAMES")[0].trim().length;
    const vis=[...document.querySelectorAll("canvas,svg,img,video,button")].filter(e=>{const r=e.getBoundingClientRect();return r.width>4&&r.height>4&&r.bottom>0&&r.top<innerHeight&&!e.closest("footer")}).length;
    const empty=t===0&&vis===0;
    if(empty&&start==null){start=performance.now();const n=document.getElementById("__next");info={url:location.pathname,nextHtmlLen:n?n.innerHTML.length:-1,nextHead:n?n.innerHTML.slice(0,200):null,bodyBg:getComputedStyle(document.body).backgroundColor,htmlBg:getComputedStyle(document.documentElement).backgroundColor,ready:document.readyState}}
    if(!empty&&start!=null){const ms=Math.round(performance.now()-start);start=null;window.__rec({ms,...info})}
  };
  setInterval(check,40);
});
const probe=()=>pg.evaluate(()=>{
  const W=innerWidth,H=innerHeight;let body=0,tot=0,tags=new Set();
  for(let i=1;i<=5;i++)for(let j=1;j<=7;j++){const e=document.elementFromPoint(W*i/6,H*j/8);tot++;if(!e||e===document.documentElement||e===document.body||e.id==="__next")body++;else tags.add(e.tagName+"."+(e.className&&e.className.toString().slice(0,18)))}
  const txt=document.body.innerText.split("KNOWITBALL GAMES")[0].trim();
  return {u:location.pathname+location.search,body:`${body}/${tot}`,bodyFrac:body/tot,textLen:txt.length,canv:document.querySelectorAll("canvas").length,txt:txt.replace(/\s+/g," ").slice(0,110),bg:getComputedStyle(document.body).backgroundColor,btns:[...document.querySelectorAll("button")].filter(b=>b.getClientRects().length).map(b=>b.innerText.replace(/\s+/g," ").trim()).filter(Boolean).slice(0,8)}
}).catch(e=>({err:String(e).slice(0,80)}));
let shotN=0;
const shot=async(label)=>{const f=`${DIR}/${String(++shotN).padStart(2,"0")}-${label}.jpg`;await pg.screenshot({path:f,type:"jpeg",quality:45}).catch(()=>{});return f};
const tap=(src)=>pg.evaluate((s)=>{const re=new RegExp(s,"i");const bs=[...document.querySelectorAll("button,[role=button]")].filter(b=>b.getClientRects().length);const b=bs.find(b=>re.test(b.innerText.replace(/\s+/g," ").trim()));if(b){b.click();return b.innerText.replace(/\s+/g," ").trim().slice(0,40)}return null},src).catch(()=>null);

// measure after an action: DOM probe every 200ms for 2.2s; screenshots at ~300 and ~2000
async function measure(step){
  const t0=Date.now();const tl=[];let s300=null,s2000=null;
  let blankStart=null,blankMs=0;
  while(Date.now()-t0<2300){
    const el=Date.now()-t0;
    const p=await probe();p.el=el;tl.push(p);
    const blank=p.bodyFrac>=0.95 && (p.canv===0);
    if(blank){if(blankStart==null)blankStart=el}else if(blankStart!=null){blankMs+=el-blankStart;blankStart=null}
    if(!s300&&el>=280)s300=await shot(`${step}-300ms`);
    if(!s2000&&el>=2000)s2000=await shot(`${step}-2s`);
    await pg.waitForTimeout(120);
  }
  if(blankStart!=null)blankMs+=2300-blankStart;
  return {tl,s300,s2000,blankMs,blankAtEnd:blankStart!=null};
}
const wait=ms=>pg.waitForTimeout(ms);
async function load(label){
  await pg.goto(BASE+"/star-dev",{waitUntil:"domcontentloaded"});
  const m=await measure(label);return m;
}
const steps=[];
const rec=(name,action,m,p)=>{const last=m.tl[m.tl.length-1];const first=m.tl[0];steps.push({run:RUN,step:steps.length+1,name,action,url:last.u,screen:last.txt,btns:last.btns,blankMs:m.blankMs,blankAtEnd:m.blankAtEnd,minTextLen:Math.min(...m.tl.map(x=>x.textLen)),s300:m.s300,s2000:m.s2000,chunks:chunkReq.splice(0).map(c=>c.u).join(",")});L({step:steps.length,name,action,screen:last.txt,blankMs:m.blankMs,minTextLen:Math.min(...m.tl.map(x=>x.textLen)),minBody:Math.max(...m.tl.map(x=>x.bodyFrac))})};

let m=await load("load");
rec("load","goto",m);
// clear tours helper
const tours=async()=>{for(let i=0;i<10;i++){const n=pg.getByText(/^(NEXT\s*.?|LATER|GOT IT)$/i).first();if(!(await n.count()))break;await n.click({timeout:1500,force:true}).catch(()=>{});await wait(300)}};
await wait(1500);await tours();

const reloadAt={}; // step-name triggers
let reloaded={night:false,page:false,reel:false};
let phaseSeen=new Set();
const classify=(p)=>{const t=p.txt+" "+p.btns.join(" ");
 if(/End of Season/i.test(t)&&/NATIONAL|League/i.test(t))return "dashboard-end";
 if(/SAVE VIDEO/i.test(t))return "reel";
 if(/BALLON D.OR/i.test(p.txt)&&/SKIP/i.test(t))return "ballon-night";
 if(/SUMMER WINDOW|TRANSFER WINDOW/i.test(p.txt))return "transfer";
 if(/skip all|next award/i.test(t))return "awards-night";
 if(/awards/i.test(p.txt)&&/CONTINUE/i.test(t))return "awards-page";
 if(/skip all|next award/i.test(t))return "awards-night";
 return "other"};
let done=false;
for(let i=0;i<(MODE==='play'?160:45)&&!done;i++){
  const p=await probe();const cls=classify(p);
  // choose action
  let pats;
  if(MODE==="play"){
    pats= cls==="reel"?[(await pg.evaluate(()=>!!document.querySelector('[data-reel-ended="1"]')))?"^CONTINUE$":"NEVER_MATCH_wait"]: cls==="awards-night"?[(/Continue ›/i.test(p.btns.join(" ")))?"Continue ›":"NEVER_MATCH_wait"]:["End of Season","^Skip","STAY$","Continue|Next|Done|Close|Thanks"];
  } else pats=["Skip all","^Skip","End of Season","STAY$","Continue|Next|Done|Close|Thanks"];
  // pre-action reload variants
  if(MODE==="reloadNight"&&cls==="awards-night"&&!reloaded.night){reloaded.night=true;await shot(`pre-reload-night`);L({t:now(),action:"RELOAD during awards night"});const mm=await load("reload-night");rec("reload@awards-night","reload",mm);await wait(1500);await tours();continue}
  if(MODE==="reloadPage+Reel"){
    if(cls==="reel"&&!reloaded.reel){reloaded.reel=true;L({t:now(),action:"RELOAD on reel"});const mm=await load("reload-reel");rec("reload@reel","reload",mm);await wait(1500);continue}
  }
  if(MODE==="reloadPage+Reel"&&cls==="awards-page"&&!reloaded.page){reloaded.page=true;await shot("pre-reload-awardspage");L({t:now(),action:"RELOAD on awards page"});const mm=await load("reload-awards-page");rec("reload@awards-page","reload",mm);await wait(1500);continue}
  let act=null;
  for(const pt of pats){if(pt==="NEVER_MATCH_wait")continue;act=await tap(pt);if(act)break}
  if(!act){ // wait for something clickable (video playing etc)
    if(cls==="reel"||cls==="awards-night"||cls==="other"){await wait(3000);const p2=await probe();if(i%1==0)L({t:now(),idle:cls,txt:p2.txt.slice(0,80),btns:p2.btns});
      const again=await probe(); if(/NATIONAL.*NEXT MATCH|NEXT MATCH/i.test(again.txt)&&!/End of Season/i.test(again.txt)){done=true;break}
      continue}
  }
  const mm=await measure(`s${i}`);rec(cls,act,mm);
  const after=mm.tl[mm.tl.length-1];
  if(/AGE 17/.test(after.txt)&&cls!=="dashboard-end"&&i>3){done=true}
}
await shot("final");
const st=await pg.evaluate(()=>{const c=JSON.parse(localStorage.getItem("star-career-v2::anon")||"{}");return {season:c.season,week:c.week,age:c.player?.age,lastAwardStats:!!c.lastSeasonAwardStats}});
L({final:st,errs:errs.length});
fs.writeFileSync(`${DIR}/steps.json`,JSON.stringify({run:RUN,mode:MODE,steps,errs,spans,log:log.filter(x=>x.reqfail||x.http)},null,1));
await b.close();
process.exit(0);
