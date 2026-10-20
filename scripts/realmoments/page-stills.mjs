// B3 stills: the Real moments page with its "In the game" marks (390 x 844).
//   node scripts/realmoments/page-stills.mjs [port=3026] [outDir]
import { chromium } from "playwright";
const port = Number(process.argv[2] ?? 3026);
const out = process.argv[3] ?? "docs/handoffs/2026-10-20-builds/b3";
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(`http://localhost:${port}/star-real-moments-dev`, { waitUntil: "domcontentloaded", timeout: 600000 });
await pg.waitForSelector("[data-moment]", { timeout: 600000 });
await pg.waitForSelector("[data-in-game-count]", { timeout: 300000 });
await pg.waitForSelector("[data-in-game]", { timeout: 300000 });
console.log(await pg.locator("[data-in-game-count]").innerText());
// A SoccerTrack moment (the new data): search for it.
await pg.fill(".rm-search", "Tsukuba");
await pg.waitForTimeout(800);
await pg.locator("[data-moment]").nth(2).click();
await pg.waitForTimeout(1200);
await pg.evaluate(() => window.scrollTo(0, 0));
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${out}/b3-06-new-data-a-soccertrack-moment-390.jpg`, type: "jpeg", quality: 62 });
// Mark it "Don't use".
await pg.locator("[data-pick-buttons]").getByText("Don't use", { exact: true }).click();
await pg.waitForSelector("[data-pick-msg]", { timeout: 30000 });
await pg.waitForTimeout(600);
console.log("after Don't use:", await pg.locator("[data-game-pick]").first().getAttribute("data-game-pick"), "|", await pg.locator("[data-pick-msg]").innerText());
await pg.evaluate(() => document.querySelector("[data-game-pick]")?.scrollIntoView({ block: "center" }));
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${out}/b3-04-real-moments-dont-use-390.jpg`, type: "jpeg", quality: 62 });
// The rail: the count, the marks waiting, Commit; the list shows "Left out (by hand)".
await pg.evaluate(() => { document.querySelector("[data-picks-panel]")?.scrollIntoView({ block: "start" }); window.scrollBy(0, -70); });
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${out}/b3-05-real-moments-in-the-game-390.jpg`, type: "jpeg", quality: 62 });
console.log(await pg.locator("[data-picks-panel]").innerText());
// Put it back: Automatic.
await pg.locator("[data-pick-buttons]").getByText("Automatic", { exact: true }).click();
await pg.waitForTimeout(800);
console.log("after Automatic:", await pg.locator("[data-game-pick]").first().getAttribute("data-game-pick"));
console.log("page errors:", errs.length, errs.slice(0, 3).join(" | "));
await b.close();
