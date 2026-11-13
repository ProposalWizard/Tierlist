/**
 * scripts/team-room/stills.mjs — pictures of the Team room's Patch bot at a
 * phone's size and a computer's (Harry, 12 Nov 2026). A dev build with no
 * database shows sample rows (lib/teamRoom/demo.ts), so this needs no sign-in.
 *
 *   npx next dev -p 3417
 *   node scripts/team-room/stills.mjs [--url http://localhost:3417] [--out docs/stills/team-room-v2]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg("--url", "http://localhost:3417");
const OUT = arg("--out", "docs/stills/team-room-v2");
mkdirSync(OUT, { recursive: true });

const SIZES = [{ name: "390x844", width: 390, height: 844, phone: true }, { name: "1440x900", width: 1440, height: 900, phone: false }];
const errors = [];
const browser = await chromium.launch();
for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.phone ? 2 : 1, hasTouch: size.phone, isMobile: size.phone });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${size.name}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|supabase|ERR_/i.test(m.text())) errors.push(`${size.name}: ${m.text().slice(0, 200)}`); });
  const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}-${size.name}.png` }); console.log(`  ${name}-${size.name}.png`); };
  const open = async (q) => { await page.goto(`${BASE}/admin/team?tab=chat${q}`, { waitUntil: "domcontentloaded" }); await page.waitForSelector(".trr", { timeout: 120_000 }); await page.waitForTimeout(900); await noCookies(); };
  // The site's cookie question sits over the Send button: answer it once.
  const noCookies = async () => { const b = page.locator("[data-cookie-reject]"); if (await b.count()) { await b.first().click(); await page.waitForTimeout(200); } };

  // 1. #general with the Patch bot's post.
  await open("");
  await page.locator('[data-bot="patch:0.136"]').scrollIntoViewIfNeeded();
  await shot("1-general-patch-bot-post");

  // 2. Its thread (right on a computer, full screen on a phone), with Copy thread for Claude.
  await page.locator('[data-bot="patch:0.136"] .tr-threadline').click();
  await page.waitForSelector(".trr-thread");
  await shot("2-patch-thread");
  await page.locator(".trb-copy").click();
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  console.log(copied ? `  copied ${copied.split("\n").length} lines, starts: ${copied.split("\n")[0]}` : "  (clipboard not readable here)");
  await shot("3-copy-thread-for-claude");

  // 3. A comment typed in the thread.
  await page.locator("#tr-compose-thread").fill("Looks good. One thing: the Open button is small on a phone.");
  await page.locator(".trr-thread .tr-send").click();
  await shot("4-thread-after-my-comment");

  // 4. The bot's own page, then switched off.
  await open("&bot=patch-notes");
  await shot("5-patch-bot-page");
  await page.locator(".trb-switch").click();
  await shot("6-patch-bot-page-off");
  await page.locator(".trb-switch").click();
  await open("&bot=health");
  await shot("7-health-bot-page");
  await open("&bot=bug");
  await shot("8-bug-bot-page");

  // 5. Everyone reads it: the post leaves #general for #patch-notes.
  await open("");
  await page.locator('[data-bot="patch:0.136"] .tr-botfoot .tr-btn').first().click();
  await page.waitForTimeout(400);
  const stillThere = await page.locator('[data-bot="patch:0.136"]').count();
  console.log(`  after my Read and understood: post in #general = ${stillThere} (Mikey has not read it in the sample, so 1 is right)`);
  await shot("9-general-after-i-read");

  // 6. The patch note page's quick comment box.
  await page.goto(`${BASE}/admin/team?tab=notes&v=0.136`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".tr-quick", { timeout: 120_000 });
  await page.locator(".tr-quick").scrollIntoViewIfNeeded();
  await page.locator(".tr-quick input").fill("Reading now: the lag test section is clear.");
  await shot("10-patch-note-page-comment-box");
  await page.locator(".tr-quick .tr-btn").click();
  await shot("11-patch-note-page-comment-sent");
  await ctx.close();
}
await browser.close();
if (errors.length) { console.log(`\n${errors.length} page error(s):`); for (const e of errors.slice(0, 12)) console.log("  " + e); } else console.log("\nNo page errors.");
