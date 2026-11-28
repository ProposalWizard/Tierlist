// Lunch card + Drive card stills on the Training page at 390 wide, deviceScaleFactor 1.
// Usage: BASE=http://localhost:3115 node scripts/star-sandbox/lunch-stills.mjs <outdir> <save.json> <prefix> [steps...]
// steps: plain | plate:<id> | wait | chat | long | drive-on
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const [OUT, SAVE, PREFIX, ...STEPS] = process.argv.slice(2);
const BASE = process.env.BASE || "http://localhost:3115";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
pg.on("console", (m) => { if (m.type() === "error") errors.push(`CONSOLE: ${m.text().slice(0, 200)}`); });
const wait = (ms) => pg.waitForTimeout(ms);

const HIDE = `[data-cookie-consent], .cookie-consent, [aria-label*="ookie"], [data-team-bubble], [data-chat-bubble], [aria-label="Team chat"], [data-page-guide] { display: none !important; }`;
await pg.addInitScript((css) => {
  const add = () => { const st = document.createElement("style"); st.textContent = css; document.documentElement.appendChild(st); };
  if (document.documentElement) add(); else document.addEventListener("DOMContentLoaded", add);
}, HIDE);

await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(3000);
const save = JSON.parse(readFileSync(SAVE, "utf8"));
const driveOn = STEPS.includes("drive-on");
await pg.evaluate(([kv, d]) => { localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); if (d) localStorage.setItem("kib-drive-to-training", "on"); }, [save, driveOn]);
await pg.reload({ waitUntil: "domcontentloaded" });
await pg.locator('[data-tour="nav-training"]').first().waitFor({ state: "visible", timeout: 240000 });
await wait(1500);
const dismiss = async () => {
  for (let i = 0; i < 8; i++) {
    const b = pg.locator("button:visible").filter({ hasText: /^(Skip|Got it|OK|Not now|Close)$/i }).first();
    if (await b.count() === 0) break;
    try { await b.click({ timeout: 1500 }); } catch { break; }
    await wait(300);
  }
};
await dismiss();
await pg.locator('[data-tour="nav-training"]').first().click();
await wait(1500);
await dismiss();

let n = 0;
const shot = async (name, sel = "[data-lunch-card]") => {
  const el = pg.locator(sel).first();
  if (await el.count()) await el.scrollIntoViewIfNeeded().catch(() => {});
  await wait(600);
  const file = `${OUT}/${PREFIX}-${String(++n).padStart(2, "0")}-${name}.png`;
  await pg.screenshot({ path: file });
  const h = await pg.evaluate(() => document.documentElement.scrollHeight);
  console.log("shot", file, "page height", h);
};
const top = async (name) => { await pg.evaluate(() => window.scrollTo(0, 0)); await wait(400); const file = `${OUT}/${PREFIX}-${String(++n).padStart(2, "0")}-${name}.png`; await pg.screenshot({ path: file }); console.log("shot", file); };

for (const s of STEPS) {
  if (s === "plain") await shot("lunch");
  else if (s === "top") await top("training-top");
  else if (s === "drive-on") await top("drive-card");
  else if (s === "wait") { await pg.locator("[data-lunch-card] button", { hasText: /Wait till/ }).click(); await wait(800); await shot("after-wait"); }
  else if (s.startsWith("plate:")) { await pg.locator(`[data-plate="${s.slice(6)}"]`).click(); await wait(800); await shot(`ate-${s.slice(6)}`); }
  else if (s === "chat") { await pg.locator("[data-lunch-table] button", { hasText: /^Chat/ }).first().click(); await wait(800); await shot("chat", "[data-lunch-table]"); }
  else if (s === "long") { await pg.locator("[data-lunch-table] button", { hasText: /^Long lunch/ }).first().click(); await wait(800); await shot("long-lunch", "[data-lunch-table]"); }
  else if (s === "table") await shot("table", "[data-lunch-table]");
  else if (s === "drive-click") { await pg.locator("[data-drive-card]").click(); await wait(6000); const file = `${OUT}/${PREFIX}-${String(++n).padStart(2, "0")}-drive-opened.png`; await pg.screenshot({ path: file }); console.log("shot", file); }
}
console.log(errors.length ? `ERRORS (${errors.length}):\n` + errors.slice(0, 10).join("\n") : "no console or page errors");
await browser.close();
