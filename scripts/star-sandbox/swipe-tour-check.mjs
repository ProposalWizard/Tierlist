/**
 * scripts/star-sandbox/swipe-tour-check.mjs — the story's "to your stats" step
 * shows a swipe, and a swipe (not only a tap) takes you there
 * (Mikey's phone test, 17 Nov 2026).
 *
 *   node scripts/star-sandbox/swipe-tour-check.mjs --save career.json --out dir [--url ...] [--viewport 360x752]
 *
 * The save must be a story career. The script marks the story steps before
 * "stats" as seen, gives the player one goal, opens Home, presses "Got it" on
 * "Your first goal", takes stills of the pointer, then swipes right.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = val("--url", "http://localhost:3300");
const OUT = path.resolve(val("--out", "swipe-out"));
const [W, H] = val("--viewport", "360x752").split("x").map(Number);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const raw = JSON.parse(fs.readFileSync(val("--save"), "utf8"));
const career = raw.career ?? raw;
const before = ["boots", "boss", "training", "ready", "candeal", "starpass", "can", "phone", "shop"];
career.unlocks.seen = [...new Set([...career.unlocks.seen.filter((k) => k !== "beat-stats" && k !== "help-stats"), ...before.map((b) => `beat-${b}`), "phone-tour", "help-phone", "help-shop", "story-shop-tour"])];
career.unlocks.open = [...new Set([...career.unlocks.open, "training", "phone", "relations", "shop"])];
career.careerStats = { ...(career.careerStats ?? {}), goals: Math.max(1, career.careerStats?.goals ?? 0) };
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: W, height: H } });
const page = await ctx.newPage();
await page.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded" });
await sleep(2000);
await page.evaluate((c) => { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-admin-mode", "off");
  localStorage.setItem("star-career-v2::anon", JSON.stringify(c)); localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" })); }, career);
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(7000);
for (let i = 0; i < 10; i++) {
  if (await page.getByText("Your first goal").count()) break;
  const x = page.locator("button:visible", { hasText: /^(Got it|OK|Continue|Thanks!?|Later|Nice)/i }).first();
  if (await x.count()) await x.click({ force: true }).catch(() => {}); else break;
  await sleep(900);
}
console.log("first goal card:", await page.getByText("Your first goal").count() > 0);
await page.screenshot({ path: path.join(OUT, "1-card.jpg"), type: "jpeg", quality: 70 });
await page.locator("button:visible", { hasText: /^Got it/ }).first().click({ force: true }).catch(() => {});
for (const t of [400, 900, 1400]) { await sleep(t === 400 ? 400 : 500); await page.screenshot({ path: path.join(OUT, `2-hand-${t}.jpg`), type: "jpeg", quality: 70 }); }
console.log("swipe hand on screen:", await page.locator("[data-tour-swipe]").count() > 0);
// Swipe right across the middle of the page, like a thumb.
await page.mouse.move(W * 0.2, H * 0.45); await page.mouse.down();
for (let k = 1; k <= 12; k++) { await page.mouse.move(W * 0.2 + (W * 0.6 * k) / 12, H * 0.45); await sleep(16); }
await page.mouse.up();
await sleep(1500);
await page.screenshot({ path: path.join(OUT, "3-after-swipe.jpg"), type: "jpeg", quality: 70 });
console.log("page on screen after the swipe:", await page.evaluate(() => [...document.querySelectorAll("[data-page-active=true]")].map((e) => e.textContent?.slice(0, 60)).join(" | ")));
console.log("pointer gone:", (await page.locator("[data-tour-overlay]").count()) === 0);
await b.close();
