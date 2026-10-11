/**
 * scripts/star-sandbox/radar.mjs — stills of the live match radar (Leo v0.15).
 *
 * Starts (or resumes) a signed-out career, kicks off the next match, and takes
 * a still of the commentary screen every few seconds while the unseen match
 * runs, skipping each chance with Sim-like quick shots. See README.md.
 *
 *   node scripts/star-sandbox/radar.mjs --url http://localhost:3105 --shots DIR [--look old]
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SHOTS = val("--shots", "/tmp/radar"); mkdirSync(SHOTS, { recursive: true });
const BASE = val("--url", "http://localhost:3105");
const PREFIX = val("--prefix", "after");
const ctx = await chromium.launchPersistentContext(val("--profile", `${SHOTS}/profile`), {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", ...devices["iPhone 13"], args: ["--disable-dev-shm-usage", "--disable-gpu", "--renderer-process-limit=1"],
});
const pg = await ctx.newPage(); const errors = [];
pg.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
pg.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/flagcdn|googletagmanager|ERR_CERT|sentry|status of (500|404|400)/i.test(t)) errors.push(`CONSOLE: ${t.slice(0, 200)}`); });
let n = 0;
const snap = async (l) => { const p = `${SHOTS}/${PREFIX}-${String(++n).padStart(2, "0")}-${l.replace(/\W+/g, "-").slice(0, 30)}.png`; await pg.screenshot({ path: p }); console.log("  still:", p); };
const btns = async () => (await pg.locator("button:visible").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
const click = async (re, ms = 2500) => { const b = pg.locator("button:visible").filter({ hasText: re }).first(); try { await b.waitFor({ state: "visible", timeout: ms }); const t = (await b.innerText()).replace(/\s+/g, " ").trim(); await b.click({ timeout: 4000 }); await pg.waitForTimeout(1500); return t; } catch { return null; } };

await pg.goto(`${BASE}/star-dev`, { waitUntil: "networkidle", timeout: 180000 });
// Light on memory: no 3D anywhere but the match as a new phone sees it.
const LIGHT = {"star-look-match-3d":"off","star-garden3d-look":"old","star-house-look":"old","star-3d-look":"old","star-shop3d-player":"old","star-look-3d-people":"old","star-look-3d-body":"before","star-look-cutscene-people":"old","star-look-cutscene-camera":"old","star-look-motion":"old","star-look-boss-room":"old","star-casino3d-look":"classic","star-signing-3d":"off","star-ballon-dor-night-look":"old","star-home-look":"old","star-ovation-look":"old","star-look-dribble-3d":"old"};
await pg.evaluate(([look, light]) => { for (const [k, v] of Object.entries(light)) localStorage.setItem(k, v); localStorage.setItem("star-match-radar", look); }, [val("--look", "new"), LIGHT]);
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
await pg.waitForTimeout(4000);
const inputs = pg.locator("input");
if (await inputs.count()) {
  await inputs.first().fill("Radar"); await inputs.nth(1).fill("Test");
  await click(/Next|Continue/i); await click(/Arsenal/i); await click(/Start Career/i); await pg.waitForTimeout(3000);
}
console.log("buttons:", (await btns()).slice(0, 14).join(" | "));
// Get to a match: through any trial / intro screens.
let misses = 0;
for (let i = 0; i < 70; i++) {
  const b = await btns();
  if (await pg.locator("[data-live-radar]").count()) break;
  if (b.some((x) => /^▶ *Play|Play$/i.test(x))) { await click(/▶ *Play|^Play$/i); continue; }
  if (b.some((x) => /Sim Trial/i.test(x))) { await click(/Sim Trial/i); await click(/Sim whole trial/i, 3000); await pg.waitForTimeout(2500); continue; }
  const t = await click(/Team sheets|Play Match|KICK OFF|Kick Off|Start Match|TAP TO|Continue|Next|Got it|Let's go|Accept|Sign|Done|→/i, 2500)
    ?? await click(/Skip|Start|OK/i, 1500);
  console.log("  clicked:", t);
  if (!t) { if (++misses > 6) { await snap(`stuck-${i}`); break; } await pg.waitForTimeout(2000); } else misses = 0;
}
// Watch the feed: a still every 2.5 s; take any chance with a quick drag.
let shotsTaken = 0;
for (let i = 0; i < 40 && shotsTaken < 14; i++) {
  if (await pg.locator("[data-live-radar]").count()) { await snap(`feed-${i}`); shotsTaken++; await pg.waitForTimeout(2500); continue; }
  const cv = pg.locator("canvas").first();
  if (await cv.count()) {
    const bx = await cv.boundingBox();
    if (bx) {
      const x = bx.x + bx.width / 2, y = bx.y + bx.height * 0.74;
      await pg.mouse.move(x, y); await pg.mouse.down();
      for (let k = 1; k <= 10; k++) { await pg.mouse.move(x - 20 * k / 10, y + 100 * k / 10); await pg.waitForTimeout(16); }
      await pg.mouse.up(); await pg.waitForTimeout(700);
      const ball = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
      if (await ball.count()) { const b = await ball.boundingBox(); if (b) await pg.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
      await pg.waitForTimeout(3000);
    }
  }
  const c = await click(/^(Continue|Next|Play on|Resume|OK|Second half|Kick off.*)$/i, 1500);
  if (!c && !(await cv.count())) { await snap(`other-${i}`); console.log("  other screen:", (await btns()).slice(0, 8).join(" | ")); await pg.waitForTimeout(2000); }
}
console.log("\nERRORS:", errors.length ? [...new Set(errors)].slice(0, 8).join("\n") : "(none)");
await ctx.close();
