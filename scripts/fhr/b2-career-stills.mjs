// B2 (Full highlights rebuild, 20 Oct 2026): stills of the switch in the
// career, at phone size (390x844, JPG): main Settings, the "?" rundown,
// pre-match settings (the line-up's ⚙) and in-match settings (the match's ⚙).
//
//   node scripts/fhr/b2-career-stills.mjs --save=<save.json> [--url=http://localhost:3033] [--out=docs/handoffs/2026-10-20-builds/b2]
//
// --save is a JSON object of localStorage entries (a signed-out dev career).
import { readFileSync } from "node:fs";
import { phone } from "../film/rec.mjs";

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3033");
const OUT = arg("out", "docs/handoffs/2026-10-20-builds/b2");
const SAVE = JSON.parse(readFileSync(arg("save", ""), "utf8"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { browser, context, page } = await phone({ deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.addInitScript((s) => {
  if (sessionStorage.getItem("b2-seeded")) return;
  sessionStorage.setItem("b2-seeded", "1");
  for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  localStorage.setItem("star-fhr", "off");
}, SAVE);
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 70 });
const click = async (re, ms = 4000) => {
  const b = page.locator("button:visible").filter({ hasText: re }).first();
  try { await b.waitFor({ state: "visible", timeout: ms }); await b.click({ timeout: 4000 }); await wait(1200); return true; } catch { return false; }
};
const step = (s) => console.log("·", s);
/** Tap through the first-visit tour ("NEXT ▸" … "DONE"). */
async function dismissTour() {
  for (let i = 0; i < 14; i++) {
    const n = page.getByText(/^\s*(NEXT|DONE|GOT IT|FINISH|LET'S GO|OK|LATER)\s*▸?\s*$/i).first();
    if (!(await n.count())) return;
    await n.click({ timeout: 2000 }).catch(() => {});
    await wait(500);
  }
}

await page.goto(`${URL0}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(9000);
await dismissTour();
step("home");

// 1. Main Settings: the switch row.
const opened = await page.getByRole("button", { name: "Settings", exact: true }).first().click({ timeout: 6000, force: true }).then(() => true, (e) => { step(String(e).slice(0, 200)); return false; });
await wait(1500);
await dismissTour();
await wait(400);
step(`settings opened: ${opened}`);
if (process.env.B2_DEBUG) await page.screenshot({ path: `${process.env.B2_DEBUG}/settings.png`, fullPage: true });
const row = page.locator("[data-fhr-help]").first();
if (await row.count()) {
  await row.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await wait(500);
  await shot("b2-settings-switch");
  await row.click();
  await wait(800);
  await shot("b2-help-rundown");
  await page.locator("[data-fhr-help-sheet]").click({ position: { x: 20, y: 20 } });
  await wait(500);
} else step("no FHR row in Settings");

// 2. Back home, then to the match: Play → Team sheets → the line-up.
await page.goto(`${URL0}/star-dev`, { waitUntil: "domcontentloaded" });
await wait(7000);
await dismissTour();
// Play opens the line-up (LineupIntro), which kicks off by itself: tap its ⚙ at once.
await page.locator('button:has-text("PLAY"):visible').first().click({ timeout: 6000, force: true }).catch((e) => step(String(e).slice(0, 120)));
const pre = page.locator("[data-prematch-settings]").first();
await pre.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
if (process.env.B2_DEBUG) await page.screenshot({ path: `${process.env.B2_DEBUG}/after-play.png` });
if (await pre.count()) {
  await pre.click();
  await wait(900);
  await shot("b2-prematch-settings");
  await page.locator("[data-prematch-settings-sheet] [data-fhr-help]").count().then((n) => step(`pre-match sheet has the row: ${n > 0}`));
  await click(/Back to the line-up/i, 3000);
} else step("no pre-match ⚙ found");

// 3. Kick off and open the match's ⚙.
for (let i = 0; i < 12 && !(await page.locator("[data-match-settings]").count()); i++) {
  await click(/Kick Off|Play Match|Continue|Start|Skip/i, 1500);
  await wait(800);
}
const ms = page.locator("[data-match-settings]").first();
if (await ms.count()) {
  await wait(2500);
  await ms.click();
  await wait(1000);
  const r = page.locator("[data-match-settings-sheet] [data-fhr-help]").first();
  if (await r.count()) { await r.scrollIntoViewIfNeeded(); await wait(300); }
  await shot("b2-inmatch-settings");
  step(`in-match sheet has the row: ${await r.count() > 0}`);
} else step("no match ⚙ found");

console.log("errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
