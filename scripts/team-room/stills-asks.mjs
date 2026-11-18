/**
 * scripts/team-room/stills-asks.mjs — pictures of messages → tasks, the /
 * commands and quick links (12 Nov 2026), in the Team room's current look.
 *   node scripts/team-room/stills-asks.mjs [--url http://localhost:3417] [--out docs/stills/team-room-v2]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--url", "http://localhost:3417");
const OUT = arg("--out", "docs/stills/team-room-v2");
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch();
for (const size of [{ name: "390x844", width: 390, height: 844, phone: true }, { name: "1440x900", width: 1440, height: 900, phone: false }]) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.phone ? 2 : 1, hasTouch: size.phone, isMobile: size.phone });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${size.name}: ${e.message}`));
  const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}-${size.name}.png` }); console.log(`  ${name}-${size.name}.png`); };
  const open = async (q) => {
    await page.goto(`${BASE}/admin/team?tab=chat${q}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".trr", { timeout: 120_000 }); await page.waitForTimeout(900);
    const b = page.locator("[data-cookie-reject]"); if (await b.count()) await b.first().click();
  };
  const say = async (text) => { await page.locator("#tr-compose").fill(text); await page.locator(".trr-main .tr-send").click(); await page.waitForTimeout(500); };

  await open("");
  await shot("12-suggestion-row");
  await say("@Mikey do the cup-final thumbnail by Friday");
  await shot("13-add-as-task-offer");
  await page.locator(".tr-askbtn").last().click();
  await shot("14-task-sent-to-mikey");
  await say("/today");
  await shot("15-slash-today");
  await say("/todo ring the kit supplier");
  await shot("16-slash-todo-added");

  // The proposal waiting on Harry (the sample: Leo asked), then accepted.
  await open("&ch=todo");
  await page.locator(".trr-tabs button", { hasText: "Tasks" }).click();
  await shot("17-todo-proposal-accept-decline");
  const before = await page.locator(".tr-ask").count();
  await page.locator(".tr-ask .tr-btn", { hasText: "Accept" }).first().click();
  await page.waitForTimeout(400);
  console.log(`  proposals: ${before} → ${await page.locator(".tr-ask").count()} after Accept`);
  await shot("18-todo-after-accept");

  // Quick links on You.
  await open("");
  if (size.phone) await page.locator(".trr-bottom button", { hasText: "You" }).click(); else await page.locator(".trr-me").click();
  await page.waitForSelector(".trr-links");
  await page.locator(".trr-linkadd").selectOption({ index: 3 });
  await shot("19-me-quick-links");
  await ctx.close();
}
await browser.close();
console.log(errors.length ? `\n${errors.length} page error(s):\n  ${errors.slice(0, 8).join("\n  ")}` : "\nNo page errors.");
