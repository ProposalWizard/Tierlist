// Navigation stills at 390x844. Usage: node nav.mjs <outdir> <prefix> [--new]
// Creates (or resumes) a signed-out career with every feature open, then walks
// the navigation routes and saves a still per step.
import { chromium } from "playwright";
import { mkdirSync, existsSync, readFileSync } from "node:fs";

const [OUT, PREFIX = "x"] = process.argv.slice(2);
const NEW = process.argv.includes("--new");
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
const BASE = process.env.BASE || "http://localhost:3099";
const STATE = "/tmp/claude-0/-home-user-Tierlist/06265a1b-84e9-513f-a9d9-be07aadc231e/scratchpad/state.json";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  ...(NEW || !existsSync(STATE) ? {} : { storageState: STATE }),
});
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
pg.on("console", (m) => { if (m.type() === "error") errors.push(`CONSOLE: ${m.text().slice(0, 200)}`); });

const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await wait(1500); await pg.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` }); console.log("shot", name); };
const click = async (sel, nth = 0) => { const l = pg.locator(sel).filter({ visible: true }).nth(nth); await l.click({ timeout: 8000 }); await wait(900); };
const clickText = async (re) => { const l = pg.locator("button:visible").filter({ hasText: re }).first(); await l.click({ timeout: 8000 }); await wait(900); };
const dismiss = async () => {
  // Close any pointer tour / pop-up that is in the way.
  for (let i = 0; i < 12; i++) {
    const b = pg.locator("button:visible").filter({ hasText: /^(Skip|Got it|OK|Continue|Next|Close|Not now|Keep)/i }).first();
    if (await b.count() === 0) break;
    try { await b.click({ timeout: 1500 }); } catch { break; }
    await wait(400);
  }
};

await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(4000);

if (NEW) {
  // A ready-made Arsenal save with every screen open (scripts/perf2d/make-save.mts).
  const save = JSON.parse(readFileSync(process.env.SAVE, "utf8"));
  await pg.evaluate((kv) => { localStorage.clear(); for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, save);
  await pg.reload({ waitUntil: "domcontentloaded" });
  await wait(6000);
  await ctx.storageState({ path: STATE });
}

const steps = {
  async home() { await dismiss(); await shot("home"); },
  async phoneOwnerBack() {
    await click('[data-tour="nav-phone"]'); await dismiss(); await shot("phone");
    await clickText(/Owner/i); await dismiss(); await shot("phone-owner");
    await clickText(/Back/i); await dismiss(); await shot("phone-owner-back");
  },
  async houseOnHome() {
    await click('[data-tour="home"]'); await dismiss(); await shot("home-house-tap");
  },
  async stats() {
    await click('[data-tour="home"]'); await dismiss();
    const a = pg.locator('button[aria-label^="Previous"]').filter({ visible: true }).first();
    await a.click(); await wait(900); await dismiss(); await shot("stats");
  },
};

for (const [k, fn] of Object.entries(steps)) {
  if (ONLY && !ONLY.split(",").includes(k)) continue;
  try { await fn(); } catch (e) { console.log("step failed", k, e.message.split("\n")[0]); await shot(`${k}-FAILED`); }
}
await ctx.storageState({ path: STATE });
console.log("ERRORS:", errors.length ? [...new Set(errors)].slice(0, 10).join("\n") : "(none)");
await browser.close();
