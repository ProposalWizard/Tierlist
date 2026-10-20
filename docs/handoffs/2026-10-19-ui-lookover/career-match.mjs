// Baseline: gets /star-dev into the real career match and reads the engine's props there.
// Usage: PROFILE=<dir> node career-match.mjs <w>x<h>
import { chromium } from "/home/user/Tierlist/node_modules/playwright/index.mjs";
const [W, H] = process.argv[2].split("x").map(Number);
const opts = { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"], viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: W < 600, isMobile: W < 600 };
const ctx = await chromium.launchPersistentContext(process.env.PROFILE, opts);
const pg = ctx.pages()[0] || await ctx.newPage();
await pg.goto("http://localhost:3050/star-dev", { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.waitForTimeout(8000);
const PRIORITY = [/^SIM WHOLE TRIAL/i, /Play Match|Kick Off|KICK OFF/i, /Team sheets/i, /^▶ *Play|^Play$/i, /TAP TO HEAR|Continue|Next|Accept|Sign|Start Career|Skip|Done|OK|Close|Let's go|Begin/i];
const readEngine = () => pg.evaluate(() => {
  const live = (f) => { if (!f.alternate) return f; return { ...f, memoizedProps: { ...f.alternate.memoizedProps, ...Object.fromEntries(Object.entries(f.memoizedProps).filter(([, v]) => v !== undefined)) } }; };
  for (const cv of document.querySelectorAll("canvas")) {
    const key = Object.keys(cv).find((k) => k.startsWith("__reactFiber$")); let f = key ? cv[key] : null;
    while (f) { const n = f.type && (f.type.displayName || f.type.name); if (n === "CanvasMatch") { f = live(f); const p = f.memoizedProps; let ch = f.child; while (ch && typeof ch.type !== "string") ch = ch.child; const q = ch && ch.stateNode.getBoundingClientRect(); const root = q ? `${Math.round(q.width)}x${Math.round(q.height)}` : null; if (p.career && p.fixture && !p.bare) { const r = cv.getBoundingClientRect(), pr = cv.parentElement.getBoundingClientRect(); return { root, box: `${Math.round(pr.width)}x${Math.round(pr.height)}`, canvas: `${Math.round(r.width)}x${Math.round(r.height)}`, dragReferenceHeightPx: p.dragReferenceHeightPx, skills: p.skills, keeperStrength: p.keeperStrength, oppStrength: p.oppStrength, position: p.position, pressure: p.pressure, conditions: p.conditions ? p.conditions.label : null, fatigueResetEvery: p.fatigueResetEvery, neverHooked: p.neverHooked, scene: p.scene, forceKeeperStrength: p.forceKeeperStrength, canCurve: p.canCurve, teamRelationship: p.teamRelationship, penaltyRunup: p.penaltyRunup, freeKickRunup: p.freeKickRunup, squad: (p.career.squad || []).length, leagueSquads: Object.keys(p.career.leagueSquads || {}).length }; } break; } f = f.return; }
  }
  return null;
});
for (let i = 0; i < 40; i++) {
  const got = await readEngine();
  if (got) { console.log(JSON.stringify({ size: `${W}x${H}`, ...got })); if (process.env.SHOT) await pg.screenshot({ path: process.env.SHOT }); break; }
  const btns = (await pg.locator("button:visible").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  console.log(i, btns.slice(0, 8).join(" | ").slice(0, 200));
  let clicked = false;
  for (const re of PRIORITY) {
    const b = pg.locator("button:visible").filter({ hasText: re }).first();
    if (await b.count()) { try { await b.click({ timeout: 3000 }); clicked = true; break; } catch {} }
  }
  if (!clicked) { await pg.mouse.click(W / 2, H / 2); }
  await pg.waitForTimeout(2500);
}
await ctx.close();
