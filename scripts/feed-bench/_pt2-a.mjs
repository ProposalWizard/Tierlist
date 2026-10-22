import {open,shoot} from "./_pt2-lib.mjs";
const {ctx,pg,errors,snap,lines,click}=await open();
await pg.goto("http://localhost:3000/star-dev",{waitUntil:"networkidle",timeout:180000});await pg.waitForTimeout(4000);
if(await pg.locator("input").count()){await pg.locator("input").first().fill("Leo");await pg.locator("input").nth(1).fill("Vance");await click(/Next|Continue/i);await click(/Arsenal/i);await click(/Start Career/i);await pg.waitForTimeout(3000);}
const aims=[[55,95,.1],[-55,95,.1],[40,110,.3],[-40,110,.3],[20,80,0],[-20,130,.25]];
for(let i=0;i<14;i++){const l=await lines();if(!/THE TRIAL/i.test(l.join(" ")))break;console.log("trial",i,await shoot(pg,...aims[i%6]));await click(/^(Continue|Next|Again|Retake|Shoot)$/i,1500);}
for(let i=0;i<10;i++){const d=await click(/^(Continue|Next|Accept|Sign it|Claim|Done|Confirm|Start)$/i,2000);if(!d)break;console.log("step",d);}
await snap("dash");console.log((await lines()).slice(0,25).join(" / "));console.log(errors);await ctx.close();
