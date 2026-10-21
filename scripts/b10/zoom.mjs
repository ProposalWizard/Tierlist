// B10: a close look at the ball as you aim a header / volley (2x, clipped round the ball), plus a reference kind.
//   node scripts/b10/zoom.mjs [--url=http://localhost:3041] [--kinds=header,volley,cutback]
import { phone } from "../film/rec.mjs";
const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3041");
const OUT = arg("out", "/tmp/claude-0/-home-user-Tierlist/06265a1b-84e9-513f-a9d9-be07aadc231e/scratchpad/b10");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const kind of arg("kinds", "header,volley,cutback").split(",")) {
  const { browser, context, page } = await phone({ deviceScaleFactor: Number(arg("dpr", "2")) });
  await context.addInitScript((k) => { localStorage.setItem("star-fhr", "off"); localStorage.setItem("star-highlights-kinds-v1", JSON.stringify([k])); }, kind);
  await page.goto(`${URL0}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.locator(".ih-play").first().waitFor({ timeout: 300000 });
  await wait(3000);
  await page.locator(".ih-stage").first().scrollIntoViewIfNeeded();
  await page.locator(".ih-play").first().click();
  for (let i = 0; i < 200; i++) { if ((await page.evaluate(() => globalThis.__starMatch?.phase?.())) === "aim") break; await wait(100); }
  await wait(1200);
  const b = await page.evaluate(() => globalThis.__starMatch?.ball?.());
  const k = await page.evaluate(() => globalThis.__starMatch?.kind?.());
  console.log(kind, "served", k, "ball on screen", b);
  await page.screenshot({ path: `${OUT}/zoom-${kind}-full.jpg`, type: "jpeg", quality: 70 });
  if (b) await page.screenshot({ path: `${OUT}/zoom-${kind}.png`, clip: { x: Math.max(0, b.x - 35), y: Math.max(0, b.y - 45), width: 70, height: 70 } });
  await browser.close();
}
