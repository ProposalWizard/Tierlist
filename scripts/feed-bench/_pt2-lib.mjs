import { chromium } from "playwright";
export const SH="/tmp/claude-0/-home-user-Tierlist/15d4b7b5-92a8-51b4-9c56-57239ead124f/scratchpad/s";
export async function open(){
 const ctx=await chromium.launchPersistentContext(SH+"/prof",{executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const pg=ctx.pages()[0]||await ctx.newPage(); const errors=[];
 pg.on("pageerror",e=>errors.push("PAGEERROR "+e.message));
 pg.on("console",m=>{const t=m.text();if(m.type()==="error"&&!/googletagmanager|flagcdn|ERR_TUNNEL|club_logos|ERR_CERT|sentry|status of (4|5)\d\d/i.test(t))errors.push("CONSOLE "+t.slice(0,250));});
 let n=0; const snap=async l=>{await pg.screenshot({path:`${SH}/${String(++n).padStart(2,"0")}-${l}.png`});};
 const lines=async()=>(await pg.locator("body").innerText()).split("\n").map(s=>s.trim()).filter(Boolean);
 const click=async(re,ms=2500)=>{const b=pg.locator("button:visible").filter({hasText:re}).first();try{await b.waitFor({state:"visible",timeout:ms});const t=(await b.innerText()).replace(/\s+/g," ").trim();await b.click({timeout:4000});await pg.waitForTimeout(1200);return t;}catch{return null;}};
 return {ctx,pg,errors,snap,lines,click};
}
export async function shoot(pg,aimDx,pull,cy){const cv=pg.locator("canvas").first();const bx=await cv.boundingBox();if(!bx)return "no-canvas";
 const x=bx.x+bx.width/2,y=bx.y+bx.height*0.74;await pg.mouse.move(x,y);await pg.mouse.down();
 for(let i=1;i<=12;i++){await pg.mouse.move(x-aimDx*i/12,y+pull*i/12);await pg.waitForTimeout(16);} await pg.mouse.up();await pg.waitForTimeout(800);
 const ball=pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
 if(await ball.count()){const b=await ball.boundingBox();if(b){const r=b.width/2;await pg.mouse.click(b.x+r,b.y+r+cy*r);await pg.waitForTimeout(3200);return "struck";}}
 return "no-contact";}
