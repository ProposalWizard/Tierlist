// B3 still: a REAL moment in a CAREER match, with its real build-up playing
// first (Full highlights rebuild On + Real moment highlights On, by URL).
// Makes a new career on a fresh phone, plays into the first match, shoots every
// chance until a real moment is served (window.__starLastRealMoment), then
// takes a still during its build-up and one when the chance is yours.
//   node scripts/realmoments/career-stills.mjs [port=3026] [outDir]
import { chromium, devices } from "playwright";
const port = Number(process.argv[2] ?? 3026);
const out = process.argv[3] ?? "docs/handoffs/2026-10-20-builds/b3";
const BASE = `http://localhost:${port}`;
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const pg = await (await b.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
const click = async (re, ms = 4000) => {
  const btn = pg.locator("button:visible").filter({ hasText: re }).first();
  try { await btn.waitFor({ state: "visible", timeout: ms }); const t = (await btn.innerText()).replace(/\s+/g, " ").trim(); await btn.click(); await pg.waitForTimeout(1500); return t; } catch { return null; }
};
const text = async () => (await pg.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300);
await pg.goto(`${BASE}/star-dev?fhr=on&realmoments=every`, { waitUntil: "domcontentloaded", timeout: 600000 });
await pg.locator("input").first().waitFor({ timeout: 600000 });
await pg.waitForTimeout(1500);
await pg.locator("input").first().fill("Test");
await pg.locator("input").nth(1).fill("Striker");
await click(/Next|Continue/i);
// Walk forward until a MATCH is on (photo, Start Career, the trial — simmed by
// its dev panel — offers, signing, intros, then Play / Team sheets / Kick off).
const t0 = Date.now();
let inMatch = false, kicked = false, playedOnce = 0;
while (Date.now() - t0 < 8 * 60 * 1000) {
  if (kicked && await pg.evaluate(() => !!window.__starMatch)) { inMatch = true; break; }
  const dev = pg.locator("button").filter({ hasText: /Dev: Skip \/ Sim Trial/i }).first();
  if (await dev.isVisible().catch(() => false)) {
    const sim = pg.locator("button").filter({ hasText: /Sim whole trial/i }).first();
    if (!(await sim.isVisible().catch(() => false))) { await dev.click(); await pg.waitForTimeout(800); }
    if ((await sim.isVisible().catch(() => false)) && (await sim.isEnabled().catch(() => false))) {
      await sim.click(); await pg.waitForTimeout(3000); console.log("trial simmed"); continue;
    }
    await pg.waitForTimeout(1500);
    continue;
  }
  // The dashboard's PLAY (its text holds more than the word, so match what it shows).
  // A full-screen card over everything (BREAKING NEWS …): tap it away.
  const card = pg.locator('[role="button"][aria-label="Continue"]').first();
  if (await card.isVisible().catch(() => false)) { await card.click({ timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(1200); console.log("step: card"); continue; }
  // The first-visit tour over the home screen: "NEXT ▸" until it is gone.
  if (await click(/^\s*CLOSE\s*$/i, 400)) { console.log("step: close"); continue; }
  const tour = pg.getByText(/^\s*(next|done|got it|finish)\s*[▸›>]?\s*$/i).first();
  if (await tour.isVisible().catch(() => false)) { await tour.click({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(700); console.log("step: tour"); continue; }
  const go = await click(/Kick off|Team sheets|Play Match|Play match|Next match|Match day/i, 1200);
  if (go) { kicked = true; console.log("step:", go); continue; }
  const texts = await pg.locator("button:visible").allInnerTexts();
  const playAt = texts.findIndex((t) => t.replace(/\s+/g, " ").trim().toUpperCase() === "PLAY");
  if (playAt >= 0 && playedOnce < 3 && !(await click(/^\s*CLOSE\s*$/i, 600))) {
    playedOnce++;
    await pg.locator("button:visible").nth(playAt).click({ timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(2500);
    console.log("step: PLAY →", (await pg.locator("button:visible").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 30).join(" | "));
    if (process.env.B3_DEBUG_SHOTS) await pg.screenshot({ path: `${process.env.B3_DEBUG_SHOTS}/after-play-${playedOnce}.jpg`, type: "jpeg", quality: 50 });
    continue;
  }
  const did = await click(/Kick off|Team sheets|Play Match|▶ *Play|hear him out|Accept|Continue|Next|Start|Let.s go|^OK|Got it|Done|Sign|^\s*Skip\s*$|Tap to/i, 2500);
  if (did && /Kick off|Play Match|Team sheets/i.test(did)) kicked = true;
  if (!did) await pg.waitForTimeout(1500);
  console.log("step:", did ?? "(none)", "|", (await text()).slice(0, 120));
  if (!did) console.log("  buttons:", (await pg.locator("button:visible").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 40).join(" | "));
}
console.log("in match:", inMatch);
let seen = null, shots = 0;
const t1 = Date.now();
while (inMatch && Date.now() - t1 < 10 * 60 * 1000) {
  const st = await pg.evaluate(() => ({ phase: window.__starMatch?.phase?.(), kind: window.__starMatch?.kind?.(), last: window.__starLastRealMoment ?? null }));
  if (st.last && st.last.id !== seen && Date.now() - st.last.at < 6000) {
    seen = st.last.id;
    await pg.waitForTimeout(1300);
    await pg.screenshot({ path: `${out}/b3-07-career-real-build-up-390.jpg`, type: "jpeg", quality: 62 });
    await pg.waitForTimeout(4200);
    await pg.screenshot({ path: `${out}/b3-08-career-real-chance-390.jpg`, type: "jpeg", quality: 62 });
    console.log("real moment served in the career:", JSON.stringify(st.last));
    break;
  }
  if (!st.phase) { await click(/Continue|Next|Kick off|Second half|Play/i, 1500); await pg.waitForTimeout(800); continue; }
  if (st.phase === "aim") {
    const ball = await pg.evaluate(() => window.__starMatch.ball());
    await pg.mouse.move(ball.x, ball.y); await pg.mouse.down();
    for (let i = 1; i <= 10; i++) { await pg.mouse.move(ball.x + 4 * i, ball.y + 11 * i); await pg.waitForTimeout(16); }
    await pg.mouse.up(); await pg.waitForTimeout(700);
    const contact = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
    if (await contact.count()) { const bb = await contact.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height * 0.55); }
    shots++; await pg.waitForTimeout(2200);
  } else {
    await click(/Continue|Next|Skip|Kick off|Second half/i, 1200);
    await pg.waitForTimeout(800);
  }
}
console.log("shots:", shots, "served:", seen, "page errors:", errs.length, errs.slice(0, 3).join(" | "));
await b.close();
