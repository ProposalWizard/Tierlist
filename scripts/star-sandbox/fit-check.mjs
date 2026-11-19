/**
 * scripts/star-sandbox/fit-check.mjs — does every main screen fit a phone?
 * (Mikey's phone test, 17 Nov 2026: "no page really needs to scroll".)
 *
 *   node scripts/star-sandbox/fit-check.mjs --save career.json [--url http://localhost:3300] [--viewport 360x752] [--out dir]
 *
 * Loads the save, opens each screen by its words and logs how far the page,
 * and any box on screen that scrolls, runs past the phone. Writes a still of
 * each screen to <out>/. Nothing in the save is changed by the script.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = val("--url", "http://localhost:3300");
const OUT = path.resolve(val("--out", "fit-out"));
const SAVE = val("--save", null);
const [W, H] = val("--viewport", "360x752").split("x").map(Number);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: W, height: H } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message.slice(0, 160)));

await page.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await sleep(2500);
await page.evaluate((s) => {
  localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-admin-mode", "off");
  if (s) { localStorage.setItem("star-career-v2::anon", JSON.stringify(s.career)); localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" })); }
}, SAVE ? JSON.parse(fs.readFileSync(SAVE, "utf8")) : null);
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(6000);

/** How far the page and the worst on-screen scrolling box run past the phone. */
const measure = () => page.evaluate(() => {
  const d = document.documentElement.scrollHeight - innerHeight;
  let worst = 0, who = "";
  for (const el of document.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowY)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40 || r.right <= 2 || r.left >= innerWidth - 2 || r.bottom <= 0 || r.top >= innerHeight || cs.visibility === "hidden") continue;
    const over = el.scrollHeight - el.clientHeight;
    if (over > worst) { worst = over; who = (el.getAttribute("data-screen") || el.className || el.tagName).toString().slice(0, 50); }
  }
  return { page: Math.max(0, d), box: worst, who };
});

/** Close whatever pop-up is up (story beats, tours, toasts). */
async function clearPops() {
  for (let i = 0; i < 8; i++) {
    const b = page.locator("button:visible", { hasText: /^(Continue|Thanks!?|Got it|OK|Okay|Close|Later|Not now|Skip|Let's go|Nice)\b/i }).first();
    const tip = page.getByText(/^(GOT IT|Got it|Next|Done)$/).locator("visible=true").first();
    const hit = (await b.count()) ? b : (await tip.count()) ? tip : null;
    if (!hit) break;
    await hit.click({ timeout: 1500, force: true }).catch(() => {});
    await sleep(600);
  }
}

const results = [];
async function shot(name) {
  await sleep(900);
  const m = await measure();
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), quality: 70, type: "jpeg" });
  const line = `${name.padEnd(22)} page +${m.page}px · scroll box +${m.box}px ${m.box ? `(${m.who})` : ""}`;
  console.log(line); results.push({ name, ...m });
}
async function tap(re) {
  let b = page.locator("button:visible, a:visible, [role=tab]:visible", { hasText: re }).first();
  if (!(await b.count())) b = page.getByText(re).locator("visible=true").first();
  if (!(await b.count())) { console.log(`  (no button ${re})`); return false; }
  await b.click({ timeout: 3000, force: true }).catch(() => {});
  await sleep(1200);
  await clearPops();
  return true;
}

await clearPops();
await shot("home");
if (await tap(/^\s*League\s*$/)) {
  await clearPops();
  for (const t of ["TABLE", "RESULTS", "GOALS", "ASSISTS", "HISTORY"]) { if (await tap(new RegExp(`^${t}$`, "i"))) await shot(`league-${t.toLowerCase()}`); }
}
if (await tap(/^\s*Training\s*$/)) { await clearPops(); await shot("training"); }
if (await tap(/^\s*Home\s*$/)) await clearPops();
if (await tap(/STATS/)) { await clearPops(); await shot("stats"); }
if (await tap(/^\s*Home\s*$/)) await clearPops();
if (await tap(/SHOP/)) { await clearPops(); await shot("shop"); }
if (await tap(/^\s*Home\s*$/)) await clearPops();
const gear = page.locator('button[aria-label*="etting" i]:visible').first();
if (await gear.count()) { await gear.click().catch(() => {}); await sleep(1200); await shot("settings"); }

fs.writeFileSync(path.join(OUT, "fit.json"), JSON.stringify(results, null, 1));
await browser.close();
