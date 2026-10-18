import { chromium } from '/home/user/Tierlist/node_modules/playwright/index.mjs';
import fs from 'fs';
const SP='/tmp/claude-0/-home-user-Tierlist/36643638-fd75-5950-83da-ee5f6b43df22/scratchpad/';
const body=fs.readFileSync(SP+'planpage/index.html','utf8');
fs.writeFileSync(SP+'planpage/_test.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const oldIds=[...fs.readFileSync(SP+'planpage/index.v2.html','utf8').matchAll(/data-id="([^"]+)"/g)].map(m=>m[1]).sort();
const exe=process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b=await chromium.launch({executablePath:exe});
async function run(name,w,h,scheme,shots){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,colorScheme:scheme,permissions:['clipboard-read','clipboard-write'],isMobile:name==='m',hasTouch:name==='m'});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  // seed old-format answers: an old ✓ on a lettered card, an old ✗, and a note
  await p.addInitScript(()=>{ if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('kib-plans-2026-10-15',JSON.stringify({'LAG-Q4':{a:'y',t:''},'ADM-Q10':{a:'n',t:''},'PN-Q75':{a:'',t:'shorter please'}}));}});
  await p.goto('file://'+SP+'planpage/_test.html');
  const r={name};
  const ids=await p.evaluate(()=>[...document.querySelectorAll('.qi')].map(e=>e.dataset.id));
  r.n=ids.length; r.uniq=new Set(ids).size;
  r.same=JSON.stringify([...ids].sort())===JSON.stringify(oldIds);
  r.tiers=await p.evaluate(()=>{const o={};document.querySelectorAll('.qi').forEach(e=>{const k=e.dataset.plan+':'+e.dataset.tier;o[k]=(o[k]||0)+1});return o});
  r.perPlan=await p.evaluate(()=>{const o={};document.querySelectorAll('.qi').forEach(e=>{o[e.dataset.plan]=(o[e.dataset.plan]||0)+1});return o});
  r.sw=await p.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
  r.off=await p.evaluate(()=>{document.querySelector('details.hl').open=true;const W=innerWidth,o=[];document.querySelectorAll('body *').forEach(e=>{const b=e.getBoundingClientRect();if(b.right>W+1&&b.width>0&&getComputedStyle(e).position!=='fixed')o.push(e.tagName+'.'+e.className+' '+Math.round(b.right))});document.querySelector('details.hl').open=false;return o.slice(0,8)});
  r.cnt0=await p.textContent('#cnt');
  r.migr=await p.evaluate(()=>JSON.parse(localStorage.getItem('kib-plans-2026-10-15'))['LAG-Q4'].a);
  if(shots){
    await p.screenshot({path:SP+'planpage/img/check2-390-top.png'});
  }
  // need card: tap option C on LAG-Q5, Agree on ADM-Q1, note on TB-Q6
  await p.locator('[data-id="LAG-Q5"] button[data-a="C"]').click();
  await p.locator('[data-id="ADM-Q1"] button[data-a="y"]').click();
  await p.locator('[data-id="TB-Q6"] button[data-a="note"]').click();
  await p.locator('[data-id="TB-Q6"] input.qn').fill('ask Leo');
  // quick: ✗ on PN-Q11
  await p.locator('[data-id="PN-Q11"] button[data-a="n"]').click();
  r.cnt1=await p.textContent('#cnt');
  await p.click('[data-acc="quick"]'); r.accQ=await p.textContent('[data-am="quick"]');
  await p.click('[data-acc="house"]'); r.accH=await p.textContent('[data-am="house"]');
  r.cnt2=await p.textContent('#cnt');
  r.pn11=await p.evaluate(()=>JSON.parse(localStorage.getItem('kib-plans-2026-10-15'))['PN-Q11'].a);
  r.adm10=await p.evaluate(()=>JSON.parse(localStorage.getItem('kib-plans-2026-10-15'))['ADM-Q10'].a);
  await p.click('#fun');
  r.visibleAfterFilter=await p.evaluate(()=>[...document.querySelectorAll('.qi')].filter(e=>e.offsetParent!==null).map(e=>e.dataset.id).length);
  await p.click('#fun');
  await p.click('#copy'); await p.waitForTimeout(300);
  r.msg=await p.textContent('#cmsg');
  let clip=''; try{clip=await p.evaluate(()=>navigator.clipboard.readText());}catch(e){clip='ERR '+e;}
  const L=clip.split('\n'); r.copyLines=L.length;
  r.copySample=L.filter(l=>/^(LAG-Q4|LAG-Q5|ADM-Q1|TB-Q6|PN-Q11|ADM-Q10|PN-Q75|LAG-QB2) /.test(l));
  r.copyBad=L.filter(l=>!/^[A-Z]+-Q[B]?\d+ (✓|✗|A|B|C|✎)( .+)?$/.test(l)).slice(0,3);
  // reload: answers persist
  await p.reload(); r.cntReload=await p.textContent('#cnt');
  if(shots){
    await p.evaluate(()=>{document.getElementById('need').scrollIntoView();});
    await p.waitForTimeout(150);
    await p.screenshot({path:SP+'planpage/img/check2-390-needs.png'});
  }
  r.errs=errs; console.log(JSON.stringify(r));
  await ctx.close();
}
await run('m',390,844,'dark',true);
await run('m',390,844,'light',false);
await run('d',1280,900,'light',false);
await b.close();
