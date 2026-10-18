import { chromium } from '/home/user/Tierlist/node_modules/playwright/index.mjs';
import fs from 'fs';
const SP='/tmp/claude-0/-home-user-Tierlist/36643638-fd75-5950-83da-ee5f6b43df22/scratchpad/';
const body=fs.readFileSync(SP+'planpage/index.html','utf8');
// wrapper acts like the publish skeleton
fs.writeFileSync(SP+'planpage/_test.html','<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>');
const exe=process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b=await chromium.launch({executablePath:exe});
const out={};
async function run(name,w,h,scheme){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:name==='m'?2:1,colorScheme:scheme,permissions:['clipboard-read','clipboard-write'],isMobile:name==='m',hasTouch:name==='m'});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto('file://'+SP+'planpage/_test.html');
  const r={};
  r.sw=await p.evaluate(()=>[document.documentElement.scrollWidth,document.body.scrollWidth,innerWidth]);
  // find offenders wider than viewport not inside .tw
  r.off=await p.evaluate(()=>{const W=innerWidth,o=[];document.querySelectorAll('body *').forEach(e=>{if(e.closest('.tw')||e.closest('svg'))return;const b=e.getBoundingClientRect();if(b.right>W+1&&b.width>0)o.push(e.tagName+'.'+e.className+' '+Math.round(b.right))});return o.slice(0,8)});
  r.qi=await p.evaluate(()=>document.querySelectorAll('li.qi').length);
  r.cnt0=await p.textContent('#cnt');
  // open first group is open? count open grp
  r.openGroups=await p.evaluate(()=>[...document.querySelectorAll('details.grp')].map(d=>d.open));
  const first=p.locator('li.qi').first();
  await first.scrollIntoViewIfNeeded();
  await first.locator('button[data-a=y]').click();
  const second=p.locator('li.qi').nth(1);
  await second.locator('button[data-a=n]').click();
  await second.locator('button[data-a=note]').click();
  await second.locator('input.qn').fill('needs Leo');
  const third=p.locator('li.qi').nth(2);
  await third.locator('button[data-a=note]').click();
  await third.locator('input.qn').fill('only a note');
  r.cnt1=await p.textContent('#cnt');
  // agree all in PN
  await p.locator('[data-agree=PN]').click();
  r.cnt2=await p.textContent('#cnt');
  r.pnpc=await p.textContent('[data-pc=PN]');
  r.lagpc=await p.textContent('[data-pc=LAG]');
  // filter unanswered
  await p.locator('[data-f=un]').click();
  r.visibleQi=await p.evaluate(()=>[...document.querySelectorAll('li.qi')].filter(e=>e.offsetParent!==null).length);
  await p.locator('[data-f=all]').click();
  // copy
  await p.locator('#copy').click(); await p.waitForTimeout(300);
  r.clip=await p.evaluate(()=>navigator.clipboard.readText().then(t=>t.split('\n').slice(0,4).join(' || ')+' ... lines='+t.split('\n').length));
  r.msg=await p.textContent('#cmsg');
  // fallback
  await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true})});
  await p.locator('#copy').click(); await p.waitForTimeout(200);
  r.fbVisible=await p.evaluate(()=>!document.getElementById('cpy').hidden||document.getElementById('cmsg').textContent);
  // persistence
  await p.reload();
  r.cntReload=await p.textContent('#cnt');
  r.third=await p.evaluate(()=>document.querySelectorAll('li.qi')[2].querySelector('.qn').value);
  r.sw2=await p.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
  r.errs=errs;
  // reset state then screenshots
  await p.evaluate(()=>localStorage.clear()); await p.reload();
  if(name==='m'&&scheme==='dark'){
    // answer a few for screenshot
    await p.evaluate(()=>document.getElementById('calls').scrollIntoView());
    const f=p.locator('li.qi').first(); await f.locator('button[data-a=y]').click();
    await p.locator('li.qi').nth(1).locator('button[data-a=n]').click();
    await p.locator('li.qi').nth(2).locator('button[data-a=note]').click(); await p.locator('li.qi').nth(2).locator('input.qn').fill('ask Leo first');
    await p.evaluate(()=>window.scrollBy(0,120));
    await p.screenshot({path:SP+'planpage/img/check-390.png'});
    r.pageH=await p.evaluate(()=>document.documentElement.scrollHeight);
  } else if(name==='d') {
    await p.evaluate(()=>document.getElementById('calls').scrollIntoView());
    await p.locator('li.qi').first().locator('button[data-a=y]').click();
    await p.locator('li.qi').nth(1).locator('button[data-a=n]').click();
    await p.locator('li.qi').nth(2).locator('button[data-a=note]').click(); await p.locator('li.qi').nth(2).locator('input.qn').fill('ask Leo first');
    await p.evaluate(()=>window.scrollBy(0,120));
    await p.screenshot({path:SP+'planpage/img/check-desktop.png'});
    await p.evaluate(()=>localStorage.clear());
  }
  out[name+scheme]=r; await ctx.close();
}
await run('m',390,844,'dark');
await run('m',390,844,'light');
await run('d',1280,900,'dark');
console.log(JSON.stringify(out));
fs.unlinkSync(SP+'planpage/_test.html');
await b.close();
