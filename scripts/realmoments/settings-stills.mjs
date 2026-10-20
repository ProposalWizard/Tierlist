// B3 stills: Settings → Data credits, and the two switches (390 x 844).
import { chromium } from "playwright";
const port = Number(process.argv[2] ?? 3026);
const out = process.argv[3];
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(`http://localhost:${port}/star-dev`, { waitUntil: "domcontentloaded", timeout: 600000 });
// A new phone opens on "Who are you?": its "Main menu" goes to the title screen, whose Settings is the game's own.
const menu = pg.getByRole("button", { name: /Main menu/ }).first();
await menu.waitFor({ timeout: 600000 });
await pg.waitForTimeout(1000);
await menu.click();
const settings = pg.getByRole("button", { name: /Settings/ }).first();
await settings.waitFor({ timeout: 120000 });
await pg.waitForTimeout(1500);
await settings.click();
await pg.waitForTimeout(1500);
// Data credits group.
const credits = pg.locator('[data-group="credits"] button').first();
await credits.waitFor({ timeout: 60000 });
await credits.click();
await pg.waitForTimeout(800);
await pg.locator("[data-data-credits]").scrollIntoViewIfNeeded();
await pg.evaluate(() => document.querySelector('[data-group="credits"]')?.scrollIntoView({ block: "start" }));
await pg.waitForTimeout(600);
await pg.screenshot({ path: `${out}/b3-01-settings-data-credits-390.jpg`, type: "jpeg", quality: 70 });
const lines = await pg.locator("[data-credit-line]").count();
console.log("credit lines shown:", lines);
// The switches: Harry changes → Full highlights rebuild On → Real moment highlights.
const hc = pg.locator("[data-harry-changes-toggle]").first();
if (await hc.count()) {
  await hc.scrollIntoViewIfNeeded();
  await hc.click();
  await pg.waitForTimeout(500);
  const fhrOn = pg.locator("[data-fhr-row]").getByRole("button", { name: /On/ }).first();
  const tabOn = (await fhrOn.count()) ? fhrOn : pg.locator("[data-fhr-row] >> text=On (test)").first();
  await tabOn.click();
  await pg.waitForTimeout(500);
  const rm = pg.locator("[data-real-moments-row]");
  console.log("real moments row shown after On:", await rm.count());
  const rmOn = rm.getByText("On", { exact: true }).first();
  await rmOn.click();
  await pg.waitForTimeout(500);
  await pg.evaluate(() => document.querySelector("[data-fhr-row]")?.scrollIntoView({ block: "center" }));
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${out}/b3-02-settings-two-switches-390.jpg`, type: "jpeg", quality: 70 });
  const stored = await pg.evaluate(() => [localStorage.getItem("star-fhr"), localStorage.getItem("star-real-moment-highlights")]);
  console.log("stored:", stored);
  // And Off hides it.
  await pg.locator("[data-fhr-row]").getByText("Off", { exact: true }).first().click();
  await pg.waitForTimeout(400);
  console.log("real moments row with the rebuild Off:", await pg.locator("[data-real-moments-row]").count());
} else console.log("no Harry changes dropdown on this screen");
console.log("page errors:", errs.length, errs.slice(0, 3).join(" | "));
await b.close();
