import {open,shoot} from "./_pt2-lib.mjs";
const {ctx,pg,errors,snap,lines,click}=await open();
await pg.goto("http://localhost:3000/star-dev",{waitUntil:"networkidle",timeout:180000});
await pg.waitForFunction(()=>!/Loading career/.test(document.body.innerText),null,{timeout:120000});await pg.waitForTimeout(2000);
const aims=[[55,95,.1],[-55,95,.1],[40,110,.3],[-40,110,.3],[20,80,0],[-20,130,.25]];
for(let i=0;i<70;i++){
 const l=(await lines()).join(" / ");console.log(i,l.replace(/^.*?EXIT \//,"").slice(0,110));
 if(!/THE TRIAL|1\/5|\/5|HOW TO PLAY|TAP ANYWHERE/i.test(l)&&!(await pg.locator("canvas").count())){
   const d=await click(/^(Continue|Next|Accept|Sign it|Claim|Done|Confirm|Start)/i,2000);console.log(" btn",d);if(!d)break;continue;}
 if(/TAP ANYWHERE/i.test(l)){await pg.mouse.click(195,420);await pg.waitForTimeout(1000);continue;}
 if(await pg.locator("canvas").count()){console.log(" shot",await shoot(pg,...aims[i%6]));}
 await click(/^(Continue|Next|Again|Retake|Shoot|Accept|Sign it)/i,1200);
 await snap("t"+i);
}
await snap("end");console.log(errors);await ctx.close();
