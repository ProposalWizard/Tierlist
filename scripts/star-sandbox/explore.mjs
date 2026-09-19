/**
 * scripts/star-sandbox/explore.mjs — resume an existing career and walk the
 * screens, reporting what each one shows. See README.md.
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i+1] ? argv[i+1] : d; };
const SHOTS = val("--shots", "/tmp/star-explore"); mkdirSync(SHOTS, { recursive: true });
const ctx = await chromium.launchPersistentContext(val("--profile", "/tmp/star-profile"), {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium",
  ...devices["iPhone 13"],
});
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", e => errors.push(`PAGEERROR: ${e.message}`));
pg.on("console", m => { const t=m.text(); if (m.type()==="error" && !/flagcdn|googletagmanager|ERR_CERT|sentry|500|404|400/i.test(t)) errors.push(`CONSOLE: ${t.slice(0,220)}`); });
let n=0;
const snap = async l => { await pg.screenshot({ path: `${SHOTS}/${String(++n).padStart(2,"0")}-${l.replace(/\W+/g,"-").slice(0,40)}.png` }); };
const lines = async () => { const t=await pg.locator("body").innerText(); const a=t.split("\n").map(s=>s.trim()).filter(Boolean); const i=a.findIndex(l=>l==="BETA"); const j=a.findIndex(l=>/Any Feedback Good or Bad/.test(l)); return a.slice(i>=0?i+1:0, j>0?j:undefined); };
const btns = async () => (await pg.locator("button:visible").allInnerTexts()).map(s=>s.replace(/\s+/g," ").trim()).filter(Boolean);
const say = async l => { console.log(`\n───── ${l} ─────`); console.log((await lines()).slice(0,20).join("\n")); const b=await btns(); if(b.length) console.log(`[btn] ${b.slice(0,20).join(" | ")}`); await snap(l); };
const click = async (re,ms=2500) => { const b=pg.locator("button:visible").filter({hasText:re}).first(); try{ await b.waitFor({state:"visible",timeout:ms}); const t=(await b.innerText()).replace(/\s+/g," ").trim(); await b.click({timeout:4000}); await pg.waitForTimeout(1600); return t;}catch{return null;} };

await pg.goto(`${val("--url","http://localhost:3000")}/star-dev`, { waitUntil:"networkidle", timeout:120000 });
await pg.waitForTimeout(4000);
await say("00 landing");
// clear any modal / continue into the hub
for (let i=0;i<5;i++){ const d=await click(/^(Continue|Sign it|Accept|Done|Next|Claim|OK)$/i,1800); if(!d) break; await say(`01.${i+1} ${d}`); }
await say("02 hub");

// walk the bottom nav + the home quick buttons
for (const target of (val("--visit","League,Skills,Media,Shop,Life,Training,Play").split(","))) {
  const d = await click(new RegExp(target, "i"), 2500);
  if (d) { await say(`visit:${target}`); await click(/(← *Back|^Back$|^Home$|^✕$|^Close$)/i, 1500); }
  else console.log(`\n(no button for "${target}")`);
}
console.log("\n───── ERRORS ─────");
console.log(errors.length ? [...new Set(errors)].slice(0,10).join("\n") : "(none)");
await ctx.close();
