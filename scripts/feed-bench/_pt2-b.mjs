import {open,shoot} from "./_pt2-lib.mjs";
const {ctx,pg,errors,snap,lines,click}=await open();
await pg.goto("http://localhost:3000/star-dev",{waitUntil:"networkidle",timeout:180000});await pg.waitForTimeout(3000);
for(let i=0;i<14;i++){
 const l=(await lines()).join(" / ");console.log(i,l.slice(0,230));
 if(/THE TRIAL/i.test(l)){break;}
 const inp=pg.locator("input:visible");if(await inp.count()>=2){await inp.nth(0).fill("Leo");await inp.nth(1).fill("Vance");}
 const c=await click(/Start Career|Continue|Next|Arsenal/i,2000);console.log(" click",c);
 await snap("c"+i);
}
console.log(errors);await ctx.close();
