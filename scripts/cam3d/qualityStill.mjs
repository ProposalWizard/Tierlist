// A still of the in-match ⚙ Settings with the 3D quality row (a real career match, signed out).
// Usage: node scripts/cam3d/qualityStill.mjs URL OUT.png
import { chromium, devices } from "playwright";
const [url = "http://localhost:3592", out = "/tmp/q.png"] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(`/tmp/claude-q3d-${Date.now()}`, { ...devices["iPhone 13"] });
await ctx.addInitScript(() => { localStorage.setItem("star-look-match-3d", "off"); });
const pg = await ctx.newPage();
const click = async (re, ms = 6000) => { const b = pg.locator("button:visible").filter({ hasText: re }).first(); try { await b.waitFor({ state: "visible", timeout: ms }); await b.click({ timeout: 5000 }); await pg.waitForTimeout(1500); return true; } catch { return false; } };
await pg.goto(`${url}/star-dev`, { waitUntil: "domcontentloaded", timeout: 600000 });
await pg.waitForTimeout(15000);
for (let i = 0; i < 12; i++) {
  if (await pg.locator("[data-match-settings]").count()) break;
  await click(/▶ *Play|Team sheets|Play Match|Kick Off|Start Match|Continue|Skip/i, 4000);
  await pg.waitForTimeout(2000);
}
await pg.locator("[data-match-settings]").first().click({ timeout: 60000 });
await pg.waitForTimeout(1500);
await pg.screenshot({ path: out });
console.log(out);
await ctx.close();
