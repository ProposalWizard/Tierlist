// Walks the first-career trial with the dev "skip" panel and reads the engine's props at each stage.
// Usage: node trial.mjs <w>x<h>     (fresh profile every run)
import { chromium } from "/home/user/Tierlist/node_modules/playwright/index.mjs";
import { mkdtempSync } from "node:fs";
const [W, H] = process.argv[2].split("x").map(Number);
const opts = { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"], viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 600, isMobile: W < 600 };
const ctx = await chromium.launchPersistentContext(mkdtempSync("/tmp/claude-0/trial-"), opts);
const pg = ctx.pages()[0] || await ctx.newPage();
for (let i = 0; i < 8; i++) { try { await pg.goto("http://localhost:3050/star-dev", { waitUntil: "domcontentloaded", timeout: 180000 }); break; } catch (e) { if (i === 7) throw e; await pg.waitForTimeout(15000); } }
await pg.waitForTimeout(9000);
const inputs = pg.locator("input");
if (await inputs.count()) {
  await inputs.first().fill("Test"); await inputs.nth(1).fill("Striker");
  for (const re of [/Next|Continue/i, /Next|Continue/i, /Arsenal/i, /Start Career/i]) { try { await pg.locator("button:visible").filter({ hasText: re }).first().click({ timeout: 6000 }); } catch {} await pg.waitForTimeout(1800); }
  await pg.waitForTimeout(3000);
}
try { await pg.waitForSelector("canvas", { timeout: 60000 }); } catch {}
await pg.waitForTimeout(3000);
const read = () => pg.evaluate(() => {
  const live = (f) => { if (!f.alternate) return f; return { ...f, memoizedProps: { ...f.alternate.memoizedProps, ...Object.fromEntries(Object.entries(f.memoizedProps).filter(([, v]) => v !== undefined)) } }; };
  const out = [];
  for (const cv of document.querySelectorAll("canvas")) {
    const r = cv.getBoundingClientRect(); if (r.width < 150) continue;
    const key = Object.keys(cv).find((k) => k.startsWith("__reactFiber$")); let f = cv[key]; let p = null, root = null, names = [];
    while (f) { const n = f.type && (f.type.displayName || f.type.name); if (typeof f.type === "function" && n && names.length < 4) names.push(n); if (n === "CanvasMatch") { let c = f.child; while (c && typeof c.type !== "string") c = c.child; const q = c && c.stateNode.getBoundingClientRect(); root = q ? `${Math.round(q.width)}x${Math.round(q.height)}` : null; p = live(f).memoizedProps; break; } f = f.return; }
    const pr = cv.parentElement.getBoundingClientRect();
    out.push({ box: `${Math.round(pr.width)}x${Math.round(pr.height)}`, engine: !!p, root, names: names.join(">"), drag: p && p.dragReferenceHeightPx, scene: p && p.scene && JSON.stringify(p.scene), skills: p && JSON.stringify(p.skills), keeper: p && p.keeperStrength, setPiece: p && p.setPieceSkill });
  }
  return { text: document.body.innerText.replace(/\n+/g, " | ").slice(0, 110), canvases: out };
});
for (let i = 0; i < 9; i++) {
  console.log(JSON.stringify({ size: `${W}x${H}`, stage: i, ...(await read()) }));
  // open the dev panel from inside the page (it is scrolled off the top), press the first "SKIP ..." button
  await pg.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /DEV: SKIP/.test(x.innerText)); if (b) b.click(); });
  await pg.waitForTimeout(1200);
  const label = await pg.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /^\s*SKIP /i.test(x.innerText)); return b ? b.innerText.trim() : null; });
  if (!label) { console.log("no skip button"); break; }
  console.log("skip:", label);
  await pg.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /^\s*SKIP /i.test(x.innerText)); if (b) b.click(); });
  await pg.waitForTimeout(3500);
  // intro cards: tap through anything that is not a canvas yet
  for (let k = 0; k < 3; k++) {
    if ((await pg.locator("canvas").count()) > 0 && (await read()).canvases.some((c) => c.engine)) break;
    for (const re of [/Let's go|Start|Continue|Next|TAP/i]) { try { await pg.locator("button:visible").filter({ hasText: re }).first().click({ timeout: 1500 }); } catch {} }
    await pg.waitForTimeout(1500);
  }
}
await ctx.close();
