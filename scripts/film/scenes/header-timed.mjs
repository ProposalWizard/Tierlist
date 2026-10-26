// Scene: a header chance on Infinite Highlights (build-up → cross → "Head it?").
//
//   node scripts/film/scenes/header-timed.mjs <baseUrl> <out.mp4> [tapsMs...]
//
// One chance per number in tapsMs: wait that long on the strike screen, then
// head it on top of the ball. "late" instead of a number = never tap (the
// timed screen runs out and meets it late). Before the timer existed, a "late"
// chance would wait for ever, so the "before" film uses numbers only.
// Writes <out.mp4> and the same-name .jpg (the strike screen).
import { phone, startRec, stopRec, shot } from "../rec.mjs";

const [base = "http://localhost:3191", out = "/tmp/header.mp4", ...taps] = process.argv.slice(2);
const plan = taps.length ? taps : ["700", "late"];
const { browser, page } = await phone();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`${base}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.evaluate(() => { localStorage.setItem("star-highlights-kinds-v1", JSON.stringify(["header"])); });
await page.reload({ waitUntil: "networkidle", timeout: 300000 });
{ const w = page.getByRole("button", { name: "Watch these" }); if (await w.count()) await w.click(); }
await page.waitForSelector(".ih-play", { timeout: 120000 });
await page.waitForTimeout(800);
const r = await startRec(page);
let posterDone = false;
for (let k = 0; k < plan.length; k++) {
  if (k > 0) { await page.click(".ih-next"); await page.waitForTimeout(700); }
  if (/play/i.test(await page.locator(".ih-play").innerText())) await page.click(".ih-play");
  // The build-up plays, then the chance waits for your aim.
  await page.waitForFunction(() => window.__starMatch && window.__starMatch.phase() === "aim", null, { timeout: 60000 });
  await page.waitForFunction(() => !/tap to skip/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(500);
  const fr = await page.evaluate(() => ({ ball: window.__starMatch.ball(), goal: window.__starMatch.goal(), kind: window.__starMatch.kind() }));
  const dx = fr.ball.x - fr.goal.x, dy = fr.ball.y - fr.goal.y, L = Math.hypot(dx, dy) || 1;
  await page.mouse.move(fr.ball.x, fr.ball.y); await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(fr.ball.x + (dx / L) * 90 * i / 14, fr.ball.y + (dy / L) * 90 * i / 14); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForFunction(() => window.__starMatch.phase() === "contact", null, { timeout: 8000 }).catch(() => {});
  const t0 = Date.now();
  const how = plan[k];
  if (how !== "late") {
    await page.waitForTimeout(Math.max(0, Number(how) - 250));
    if (!posterDone) { await shot(page, out.replace(/\.mp4$/, ".jpg")); posterDone = true; }
    const b = page.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
    const bb = await b.boundingBox();
    if (bb) { const rr = bb.width / 2; await page.mouse.click(bb.x + rr, bb.y + rr - 0.35 * rr); }
  } else if (!posterDone) { await page.waitForTimeout(500); await shot(page, out.replace(/\.mp4$/, ".jpg")); posterDone = true; }
  await page.waitForFunction(() => window.__starMatch.phase() !== "contact", null, { timeout: 15000 }).catch(() => {});
  console.log(`chance ${k + 1} (${fr.kind}): ${how === "late" ? "no tap" : `tap at ${how} ms`}, strike screen open ${((Date.now() - t0) / 1000).toFixed(2)} s`);
  await page.waitForTimeout(2600);
}
await stopRec(r, out, { holdEnd: 0.6 });
console.log(`page errors: ${errs.length}${errs.length ? " " + errs.slice(0, 3).join(" | ") : ""}`);
await browser.close();
