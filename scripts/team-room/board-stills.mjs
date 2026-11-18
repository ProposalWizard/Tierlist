/**
 * scripts/team-room/board-stills.mjs — pictures of the Team board TAB inside
 * the Team room, with sample rows (a dev build with no database: nothing is
 * saved anywhere), in both looks at a phone's size and a computer's.
 *
 *   npx next dev -p 3451
 *   node scripts/team-room/board-stills.mjs [--url http://localhost:3451] [--out docs/stills/team-board-tab-v2] [--name after]
 *
 * Saves <name>-<look>-<size>.png (what you see) and, for the phone, a tall
 * picture of the whole tab. Prints the tab's full height and any page error.
 * Exits 1 on a page error.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--url", "http://localhost:3451");
const OUT = arg("--out", "docs/stills/team-board-tab-v2");
const NAME = arg("--name", "after");
mkdirSync(OUT, { recursive: true });

const SIZES = [{ name: "390x844", width: 390, height: 844, phone: true }, { name: "1440x900", width: 1440, height: 900, phone: false }];
const errors = [];
const browser = await chromium.launch();
for (const look of ["dark", "light"]) {
  for (const size of SIZES) {
    const tag = `${look}-${size.name}`;
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.phone ? 2 : 1, hasTouch: size.phone, isMobile: size.phone });
    await ctx.addInitScript((l) => { try { localStorage.setItem("kib-tr-look", l); localStorage.setItem("kib-tr-notify-asked", "1"); } catch { /* private */ } }, look);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|supabase|ERR_|127\.0\.0\.1:9/i.test(m.text())) errors.push(`${tag}: ${m.text().slice(0, 200)}`); });
    await page.goto(`${BASE}/admin/team?tab=chat&view=board`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.waitForSelector(".trh-board", { timeout: 180_000 });
    await page.waitForTimeout(1500);
    const b = page.locator("[data-cookie-reject]"); if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(150); }
    await page.screenshot({ path: `${OUT}/${NAME}-${tag}.png` });
    const tall = await page.evaluate(() => document.querySelector(".trh-board")?.scrollHeight ?? 0);
    console.log(`${NAME} ${tag}: the tab is ${tall}px tall`);
    if (size.phone && tall > size.height - 120) {
      await page.setViewportSize({ width: size.width, height: tall + 160 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/${NAME}-${tag}-whole.png` });
    }
    await ctx.close();
  }
}
await browser.close();
if (errors.length) { console.error("Page errors:\n" + errors.join("\n")); process.exit(1); }
console.log("No page errors.");
