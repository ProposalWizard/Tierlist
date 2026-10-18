import { chromium } from '/home/user/Tierlist/node_modules/playwright/index.mjs';
const SP='/tmp/claude-0/-home-user-Tierlist/36643638-fd75-5950-83da-ee5f6b43df22/scratchpad/';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,colorScheme:'dark',isMobile:true,hasTouch:true});
const p=await ctx.newPage(); await p.goto('file://'+SP+'planpage/_test.html');
const ys=[];for(const a of process.argv.slice(2)){ys.push(isNaN(Number(a))?await p.evaluate(sel=>{const e=document.querySelector(sel);return Math.round(e.getBoundingClientRect().top+scrollY)-10},a):Number(a)); }
for(const y of ys){ await p.evaluate(y=>window.scrollTo(0,y),y); await p.waitForTimeout(100); await p.screenshot({path:SP+'planpage-gen/s_'+y+'.png'}); }
console.log(await p.evaluate(()=>document.documentElement.scrollHeight));
await b.close();
