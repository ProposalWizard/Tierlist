/**
 * scripts/star-sandbox/shootout-check.mjs — does the trial shootout's scoreboard
 * stay on screen for every kick? (Mikey's phone test, 17 Nov 2026, 16:24.)
 *
 *   node scripts/star-sandbox/shootout-check.mjs [--url http://localhost:3300] [--viewport 360x752] --out dir
 *
 * New career, skips the first four trial stages with the dev panel, then takes a
 * still every second through the shootout and logs where the scoreboard is.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = val("--url", "http://localhost:3300");
const OUT = path.resolve(val("--out", "shootout-out"));
const [W, H] = val("--viewport", "360x752").split("x").map(Number);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ ...devices["iPhone 13"], viewport: { width: W, height: H } });
const page = await ctx.newPage();
await page.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded" });
await sleep(2000);
await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/star-/.test(k)) localStorage.removeItem(k); localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-admin-mode", "off"); });
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(5000);
const click = async (re) => { const l = page.locator("button:visible", { hasText: re }).first(); if (await l.count()) { await l.click({ force: true }).catch(() => {}); await sleep(900); return true; } return false; };
// Through the menu and the player setup to the trial.
for (let i = 0; i < 40; i++) {
  if (await page.locator("button", { hasText: /sim trial/i }).count()) break;
  for (const inp of await page.locator("input[type=text]:visible, input:not([type]):visible").all()) {
    if (!(await inp.inputValue().catch(() => "x"))) await inp.fill(Math.random() < 0.5 ? "Sam" : "Tester").catch(() => {});
  }
  if (!(await click(/(New game|New career|Start Career|Start|Continue|Take the trial|Let.s go|Begin)/i))) await page.mouse.click(W / 2, H / 2);
}
await page.screenshot({ path: path.join(OUT, "before-skip.jpg"), type: "jpeg", quality: 60 });
if (!(await page.locator("button", { hasText: /sim trial/i }).count())) { console.log("did not reach the trial"); await b.close(); process.exit(1); }
// Skip the first four stages.
for (let i = 0; i < 4; i++) {
  await page.locator("button", { hasText: /sim trial/i }).first().click({ force: true });
  await sleep(600);
  await click(/^Skip /);
  await sleep(1500);
}
await sleep(4500); // the "next up" countdown
await page.mouse.click(W / 2, H / 2); // close the how-to card
for (let t = 0; t < 26; t++) {
  const where = await page.evaluate(() => {
    const el = [...document.querySelectorAll("*")].find((e) => /^pens$/i.test(e.textContent?.trim() ?? ""));
    if (!el) return "no scoreboard";
    const r = el.getBoundingClientRect();
    return `scoreboard top ${Math.round(r.top)} (${r.top >= 0 && r.bottom <= innerHeight ? "ON screen" : "OFF screen"}), page ${document.documentElement.scrollHeight}, scrolled ${Math.round(scrollY)}`;
  });
  const cap = await page.evaluate(() => [...document.querySelectorAll("p,div")].map((e) => e.textContent?.trim() ?? "").find((s) => /steps up|scores|Saved|They score|winning penalty/.test(s) && s.length < 90) ?? "");
  console.log(`${String(t).padStart(2)}s ${where} · ${cap}`);
  await page.screenshot({ path: path.join(OUT, `so-${String(t).padStart(2, "0")}.jpg`), type: "jpeg", quality: 60 });
  await sleep(1000);
}
await b.close();
