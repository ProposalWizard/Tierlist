// B3 still: a REAL moment served in the real match (Infinite Match, the Play
// Area), with Full highlights rebuild On and Real moment highlights On (?fhr=on&realmoments=on).
// Shoots every chance until the chance maker serves a real moment
// (lib/star/fhr/realMomentHighlights.ts sets window.__starLastRealMoment), then
// takes the still.  node scripts/realmoments/match-stills.mjs [port=3026] [outDir]
import { chromium } from "playwright";
const port = Number(process.argv[2] ?? 3026);
const out = process.argv[3] ?? "docs/handoffs/2026-10-20-builds/b3";
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(`http://localhost:${port}/star-play-dev?fhr=on&realmoments=on`, { waitUntil: "domcontentloaded", timeout: 600000 });
const door = pg.getByText(/Infinite Match/).first();
await door.waitFor({ timeout: 600000 });
await pg.waitForTimeout(1500);
// The door to the match (a link or a button saying Infinite Match).
const doors = pg.locator("button, a").filter({ hasText: /Infinite Match/ });
const n = await doors.count();
for (let i = 0; i < n; i++) {
  const t = (await doors.nth(i).innerText()).replace(/\s+/g, " ");
  if (!/highlights/i.test(t)) { await doors.nth(i).click(); break; }
}
await pg.waitForFunction(() => !!window.__starMatch, null, { timeout: 600000 });
console.log("match on");
let seen = null, shots = 0;
const t0 = Date.now();
while (Date.now() - t0 < 8 * 60 * 1000) {
  const st = await pg.evaluate(() => ({ phase: window.__starMatch?.phase?.(), kind: window.__starMatch?.kind?.(), last: window.__starLastRealMoment ?? null }));
  if (st.phase === "aim" && st.last && st.last.id !== seen && st.last.kind === st.kind && Date.now() - st.last.at < 20000) {
    seen = st.last.id;
    await pg.waitForTimeout(1500);
    const fr = await pg.evaluate(() => window.__starMatch.frame());
    console.log("real moment served:", JSON.stringify(st.last), "on screen:", fr.kind, fr.men.length, "people");
    await pg.locator("canvas").first().scrollIntoViewIfNeeded();
    await pg.screenshot({ path: `${out}/b3-03-real-moment-in-the-match-390.jpg`, type: "jpeg", quality: 62 });
    break;
  }
  if (st.phase === "aim") {
    const ball = await pg.evaluate(() => window.__starMatch.ball());
    await pg.mouse.move(ball.x, ball.y);
    await pg.mouse.down();
    for (let i = 1; i <= 10; i++) { await pg.mouse.move(ball.x + 4 * i, ball.y + 11 * i); await pg.waitForTimeout(16); }
    await pg.mouse.up();
    await pg.waitForTimeout(700);
    const contact = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
    if (await contact.count()) { const bb = await contact.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height * 0.55); }
    shots++;
    await pg.waitForTimeout(2500);
  } else {
    // a dribble or a lead-in: tap through
    if (st.phase === "fpDribble" || st.phase === "dribble") { const c = pg.locator("canvas").first(); const bb = await c.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 3); }
    await pg.waitForTimeout(1000);
  }
}
console.log("shots taken:", shots, "served:", seen, "page errors:", errs.length, errs.slice(0, 3).join(" | "));
await b.close();
