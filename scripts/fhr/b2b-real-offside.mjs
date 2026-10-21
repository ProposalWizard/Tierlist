// B2b: how the REAL match calls an offside (no build-up; switch Off), for
// comparison with a build-up's called offside. Infinite Highlights' Play is
// the real CanvasMatch: through-ball chances, a pass played straight at the
// runner, until the referee flags one. Saves the still the moment it is made.
//
//   node scripts/fhr/b2b-real-offside.mjs [--url=http://localhost:3062] [--out=docs/handoffs/2026-10-20-builds/b2b]
import { phone } from "../film/rec.mjs";

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3062");
const OUT = arg("out", "docs/handoffs/2026-10-20-builds/b2b");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { browser, context, page } = await phone({ deviceScaleFactor: 1 });
await context.addInitScript(() => {
  localStorage.setItem("star-fhr", "off");
  localStorage.setItem("star-highlights-kinds-v1", JSON.stringify(["through_ball"]));
});
await page.goto(`${URL0}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.locator(".ih-play").first().waitFor({ timeout: 300000 });
await wait(2500);
await page.locator(".ih-stage").first().scrollIntoViewIfNeeded();
let done = false;
for (let i = 0; i < 40 && !done; i++) {
  await page.locator(".ih-play").first().click();
  await page.waitForFunction(() => window.__starMatch?.phase?.() === "aim", null, { timeout: 30000 }).catch(() => {});
  await wait(600);
  const f = await page.evaluate(() => { const fr = window.__starMatch.frame(); return { ball: window.__starMatch.ball(), run: fr.men.find((m) => m.role === "runner") }; });
  if (f.run && f.ball) {
    // Pull back away from the runner (a slingshot), about a third of the way.
    const dx = f.run.cx - f.ball.x, dy = f.run.cy - f.ball.y, n = Math.hypot(dx, dy) || 1;
    await page.mouse.move(f.ball.x, f.ball.y); await page.mouse.down();
    for (let k = 1; k <= 12; k++) { await page.mouse.move(f.ball.x - (dx / n) * 7 * k, f.ball.y - (dy / n) * 7 * k); await wait(16); }
    await page.mouse.up(); await wait(700);
    const ball = page.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
    if (await ball.count()) { const bb = await ball.boundingBox(); if (bb) await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2 + 0.3 * bb.width / 2); }
    for (let k = 0; k < 40; k++) {
      const off = await page.evaluate(() => [...document.querySelectorAll("div")].some((d) => d.textContent === "OFFSIDE" && d.className.includes("ring-yellow")));
      if (off) { await wait(150); await page.screenshot({ path: `${OUT}/b2b-real-match-offside.jpg`, type: "jpeg", quality: 74 }); console.log("still:", `${OUT}/b2b-real-match-offside.jpg`, "after", i + 1, "tries"); done = true; break; }
      await wait(100);
    }
  }
  if (!done) { await page.locator(".ih-play").first().click().catch(() => {}); await wait(400); await page.locator(".ih-next").first().click(); await wait(700); }
}
console.log("real-match offside seen:", done);
await browser.close();
