/**
 * Settings → Match → Live chances (switched on: strike screen and sliders), as a picture.
 * Opened from the main menu's Settings → Match (a fresh phone), so no career tour is in the way.
 *   node scripts/film/live/settingsshot.mjs <out.png> [port]
 */
import { chromium } from "playwright";
const [OUT, PORT = "3421"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { if (sessionStorage.getItem("s")) return; sessionStorage.setItem("s", "1"); localStorage.clear(); localStorage.setItem("kib-live-chances", JSON.stringify({ on: true, strike: true, dials: { arriveS: 2.2 } })); });
const pg = await ctx.newPage();
await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await pg.waitForTimeout(8000);
await pg.locator("button:visible").filter({ hasText: /^\s*no thanks\s*$/i }).first().click().catch(() => {});
await pg.locator("button:visible").filter({ hasText: /main menu/i }).first().click().catch(() => {});
await pg.waitForTimeout(2500);
const gear = pg.locator('button[aria-label="Settings"]:visible, button:visible:has-text("Settings")').first();
await gear.click({ timeout: 8000 }).catch((e) => console.log("gear:", e.message.slice(0, 60)));
await pg.waitForTimeout(1500);
// Settings → More → Match (Live chances sits under Player names, for admins)
await pg.locator('text="Match" >> visible=true').first().click().catch((e) => console.log("match:", e.message.slice(0, 60)));
await pg.waitForTimeout(1500);
const card = pg.locator("[data-live-chances]");
await card.scrollIntoViewIfNeeded().catch(() => {});
await pg.waitForTimeout(600);
if (!(await card.count())) console.log(await pg.evaluate(() => document.body.innerText.slice(0, 300)));
await pg.screenshot({ path: OUT.replace(".png", "-page.png") }); console.log(JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 15))));
console.log("card:", await card.count(), "sliders:", await pg.locator("[data-live-dial]").count());
await (await card.count() ? card : pg).screenshot({ path: OUT });
await b.close();
