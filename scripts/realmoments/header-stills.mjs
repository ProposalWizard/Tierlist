// Headers piece 1 playtest: a REAL header served in the real match (Infinite
// Match, the Play Area) with Full highlights rebuild On and every real moment
// served (?fhr=on&realmoments=every). Shoots every other chance until a real
// header is served, then takes stills: the ball in the air while you aim, the
// "Head it?" strike screen, and the ball in flight.
//   node scripts/realmoments/header-stills.mjs [port=3095] [outDir] [kind=header]
import { chromium } from "playwright";
const port = Number(process.argv[2] ?? 3095);
const out = process.argv[3] ?? "docs/handoffs/2026-10-21-headers";
const want = process.argv[4] ?? "header";
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const pg = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(`http://localhost:${port}/star-play-dev?fhr=on&realmoments=every`, { waitUntil: "domcontentloaded", timeout: 600000 });
await pg.getByText(/Infinite Match/).first().waitFor({ timeout: 600000 });
await pg.waitForTimeout(1500);
const doors = pg.locator("button, a").filter({ hasText: /Infinite Match/ });
const n = await doors.count();
for (let i = 0; i < n; i++) {
  const t = (await doors.nth(i).innerText()).replace(/\s+/g, " ");
  if (!/highlights/i.test(t)) { await doors.nth(i).click(); break; }
}
await pg.waitForFunction(() => !!window.__starMatch, null, { timeout: 600000 });
console.log("match on");
let shots = 0, done = false, kinds = [];
const t0 = Date.now();
const shoot = async (tag) => {
  const ball = await pg.evaluate(() => window.__starMatch.ball());
  await pg.mouse.move(ball.x, ball.y);
  await pg.mouse.down();
  for (let i = 1; i <= 10; i++) { await pg.mouse.move(ball.x + 2 * i, ball.y + 11 * i); await pg.waitForTimeout(16); }
  await pg.mouse.up();
  await pg.waitForTimeout(700);
  const contact = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  if (tag) await pg.screenshot({ path: `${out}/${tag}-2-strike-screen-390.jpg`, type: "jpeg", quality: 70 });
  if (await contact.count()) { const bb = await contact.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height * 0.45); }
  shots++;
  if (tag) { await pg.waitForTimeout(650); await pg.screenshot({ path: `${out}/${tag}-3-flight-390.jpg`, type: "jpeg", quality: 70 }); }
  await pg.waitForTimeout(2500);
};
while (!done && Date.now() - t0 < 9 * 60 * 1000) {
  const st = await pg.evaluate(() => ({ phase: window.__starMatch?.phase?.(), kind: window.__starMatch?.kind?.(), last: window.__starLastRealMoment ?? null }));
  if (st.phase === "aim") {
    kinds.push(st.kind);
    if (st.kind === want && st.last && st.last.kind === want && Date.now() - st.last.at < 30000) {
      await pg.waitForTimeout(1200);
      const fr = await pg.evaluate(() => window.__starMatch.frame());
      console.log(`real ${want} served:`, JSON.stringify(st.last), "on screen:", fr.kind, fr.men.length, "people");
      await pg.screenshot({ path: `${out}/real-${want}-1-aim-390.jpg`, type: "jpeg", quality: 70 });
      await shoot(`real-${want}`);
      const after = await pg.evaluate(() => ({ phase: window.__starMatch?.phase?.() }));
      console.log("after the strike:", JSON.stringify(after));
      done = true;
      break;
    }
    await shoot(null);
  } else {
    if (st.phase === "fpDribble" || st.phase === "dribble") { const c = pg.locator("canvas").first(); const bb = await c.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 3); }
    await pg.waitForTimeout(800);
  }
}
console.log("shots taken:", shots, "kinds seen at aim:", kinds.join(","), "found:", done, "page errors:", errs.length, errs.slice(0, 3).join(" | "));
await b.close();
