/** scripts/star-sandbox/match.mjs — play a full match. See README.md. */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
const argv=process.argv.slice(2); const val=(f,d)=>{const i=argv.indexOf(f);return i>=0&&argv[i+1]?argv[i+1]:d;};
const SHOTS=val("--shots","/tmp/star-match"); mkdirSync(SHOTS,{recursive:true});
const ctx=await chromium.launchPersistentContext(val("--profile","/tmp/star-profile"),{executablePath:process.env.PW_CHROMIUM||"/opt/pw-browsers/chromium",...devices["iPhone 13"]});
const pg=await ctx.newPage(); const errors=[];
pg.on("pageerror",e=>errors.push(`PAGEERROR: ${e.message}`));
pg.on("console",m=>{const t=m.text(); if(m.type()==="error"&&!/flagcdn|googletagmanager|ERR_CERT|sentry|status of (500|404|400)/i.test(t)) errors.push(`CONSOLE: ${t.slice(0,220)}`);});
let n=0; const snap=async l=>{await pg.screenshot({path:`${SHOTS}/${String(++n).padStart(2,"0")}-${l.replace(/\W+/g,"-").slice(0,40)}.png`});};
const lines=async()=>{const t=await pg.locator("body").innerText();const a=t.split("\n").map(s=>s.trim()).filter(Boolean);const i=a.findIndex(l=>l==="BETA");const j=a.findIndex(l=>/Any Feedback Good or Bad/.test(l));return a.slice(i>=0?i+1:0,j>0?j:undefined);};
const say=async l=>{console.log(`\n── ${l} ──`);console.log((await lines()).slice(0,14).join(" / "));await snap(l);};
const click=async(re,ms=2500)=>{const b=pg.locator("button:visible").filter({hasText:re}).first();try{await b.waitFor({state:"visible",timeout:ms});const t=(await b.innerText()).replace(/\s+/g," ").trim();await b.click({timeout:4000});await pg.waitForTimeout(1500);return t;}catch{return null;}};
async function shoot(aimDx,pull,cy){const cv=pg.locator("canvas").first();const bx=await cv.boundingBox();if(!bx)return "no-canvas";
 const x=bx.x+bx.width/2,y=bx.y+bx.height*0.74;await pg.mouse.move(x,y);await pg.mouse.down();
 for(let i=1;i<=12;i++){await pg.mouse.move(x-aimDx*i/12,y+pull*i/12);await pg.waitForTimeout(16);} await pg.mouse.up();await pg.waitForTimeout(800);
 const ball=pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
 if(await ball.count()){const b=await ball.boundingBox();if(b){const r=b.width/2;await pg.mouse.click(b.x+r,b.y+r+cy*r);await pg.waitForTimeout(3200);return "struck";}}
 return "no-contact";}

await pg.goto(`${val("--url","http://localhost:3000")}/star-dev`,{waitUntil:"networkidle",timeout:120000});
await pg.waitForTimeout(4000);
await click(/▶ *Play/i); await pg.waitForTimeout(1500); await say("pre-match");
// The green button is "Team sheets →" when your XI has 9+ players, and
// "Play Match ⚽" only when it doesn't (page.tsx's teamsReady). Both lead to
// the match; the first goes via VersusScreen, which then needs its own
// kick-off press. Match on all of it.
let started = await click(/Team sheets|Play Match|Kick Off|Start Match/i,4000);
if (started && /Team sheets/i.test(started)) {
  await pg.waitForTimeout(2000); await say("team-sheets");
  started = await click(/Play Match|Kick Off|Start|Continue/i,4000) || started;
}
console.log("start:",started); await pg.waitForTimeout(4000); await say("match-start");
const aims=[[50,95,.1],[-50,95,.1],[30,110,.25],[-30,110,.25],[65,100,.15],[-65,100,.15]];
let chances=0;
for(let i=0;i<22;i++){
  const l=await lines(); const head=l.slice(0,6).join(" / ");
  if(/FULL TIME|POST *MATCH|Player Ratings|MATCH STATS/i.test(l.join(" "))) { console.log("→ match over at loop",i); break; }
  if(await pg.locator("canvas").count()){
    const a=aims[i%aims.length]; const r=await shoot(a[0],a[1],a[2]);
    if(r==="struck"){chances++;console.log(`  chance ${chances}: ${head.slice(0,70)}`);}
    else console.log(`  (${r}) ${head.slice(0,70)}`);
  }
  const c=await click(/^(Continue|Next|Play on|Resume|Skip|OK)$/i,1600);
  if(!c && !(await pg.locator("canvas").count())) { console.log("  no canvas, no continue — stuck at:",head.slice(0,90)); break; }
}
await say("after-match");
const c=await pg.evaluate(()=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!/star-career/.test(k))continue;try{const v=JSON.parse(localStorage.getItem(k));if(v&&v.player)return v;}catch{}}return null;});
console.log("\nSTATE:",JSON.stringify(c&&{week:c.week,apps:c.seasonStats?.appearances,goals:c.seasonStats?.goals,assists:c.seasonStats?.assists,rating:c.seasonStats?.totalRating,energy:c.energy,fitness:c.matchFitness,money:c.money,star:+(c.starRating??0).toFixed(2)}));
console.log("chances taken:",chances);
console.log("\nERRORS:",errors.length?[...new Set(errors)].slice(0,8).join("\n"):"(none)");
await ctx.close();
