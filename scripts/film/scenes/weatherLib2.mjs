// Get to the wide-view chance (the 3rd of seed 11: a header near goal, 39 x 78 m in view),
// clearing the first two off camera with a quick low shot each.
import { strikeAndSet } from "./weatherLib.mjs";
export async function toWideChance(page) {
  for (let k = 0; k < 6; k++) {
    const f = await page.evaluate(() => { const f = window.__starMatch.frame(); return { w: f.cam.x2 - f.cam.x1, kind: f.kind, facing: f.facing }; });
    if (f.w > 35 && f.facing === "up") return f;
    await strikeAndSet(page, { speed: 30, angle: 3, heading: 0 });
    try {
      await page.waitForFunction(() => window.__starMatch.phase() === "aim", null, { timeout: 12000 });
    } catch {
      const ph = await page.evaluate(() => window.__starMatch?.phase());
      throw new Error(`stuck between chances (phase ${ph})`);
    }
    await page.waitForTimeout(600);
  }
  throw new Error("no wide chance");
}
