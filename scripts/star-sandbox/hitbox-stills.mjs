// Stills of the hitbox view on /star-highlights-dev at phone size (390x844).
import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-Tierlist/619b3a80-fdc5-58c4-9c63-508130f38a00/scratchpad/g16/hitbox";
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: false });
await ctx.addInitScript(() => { localStorage.setItem("star-hitbox-show", "1"); });
const pg = await ctx.newPage();
pg.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await pg.goto("http://localhost:3202/star-highlights-dev", { waitUntil: "networkidle", timeout: 300000 });
await pg.waitForFunction(() => !!document.querySelector("main")?.getAttribute("data-hl-kind"), null, { timeout: 180000 });
await pg.waitForTimeout(2500);
// open the panel so it shows
await pg.locator("[data-hitbox-panel] button").first().click();
await pg.waitForTimeout(500);
await pg.locator("[data-hitbox-panel]").scrollIntoViewIfNeeded();
await pg.screenshot({ path: `${OUT}/01-panel.png` });
await pg.evaluate(() => window.scrollTo(0, 0));
await pg.locator("button:visible").filter({ hasText: /Play/ }).first().click();
await pg.waitForFunction(() => !!window.__starMatch, null, { timeout: 180000 });
await pg.waitForTimeout(3000);
await pg.screenshot({ path: `${OUT}/02-aim-hitboxes.png` });
const fr = await pg.evaluate(() => window.__starMatch?.frame());
console.log("kind", fr?.kind, "men", fr?.men?.length);
// Kick: drag back from the ball, then hit the contact ball.
const q = await pg.evaluate(() => window.__starMatch.ball());
await pg.mouse.move(q.x, q.y); await pg.mouse.down();
for (let i = 1; i <= 12; i++) { await pg.mouse.move(q.x, q.y + 70 * i / 12); await pg.waitForTimeout(16); }
await pg.mouse.up(); await pg.waitForTimeout(700);
const cb = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
if (await cb.count()) { const bb = await cb.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
// In flight: send a lofted ball onto a team-mate's head (or over a defender's).
let ok = false;
for (let i = 0; i < 40 && !ok; i++) {
  await pg.waitForTimeout(30);
  ok = await pg.evaluate(() => {
    const m = window.__starMatch; if (m.phase() !== "flight") return false;
    const sc = m.frame().sc;
    const r = sc.runner?.pos ?? sc.secondaryRunners?.[0]?.pos ?? { x: sc.follower.x, y: sc.follower.y };
    const from = { x: r.x + 7, y: r.y + 9 }, d = Math.hypot(r.x - from.x, r.y - from.y), s = 13, t = d / s;
    const H = 2.3, z0 = 1.0;
    return m.setBall({ x: from.x, y: from.y, z: z0, vx: (r.x - from.x) / d * s, vy: (r.y - from.y) / d * s, vz: (H - z0 + 4.9 * t * t) / t, shot: false });
  });
}
console.log("ball set", ok);
let shot = false;
for (let i = 0; i < 120 && !shot; i++) {
  await pg.waitForTimeout(16);
  const j = await pg.evaluate(() => {
    const sc = window.__starMatch.frame().sc;
    const all = [sc.runner, ...(sc.secondaryRunners ?? [])].filter(Boolean).map((r) => r.jump?.z ?? 0);
    all.push(sc.follower?.jump?.z ?? 0); sc.defenders.forEach((d) => all.push(d.z ?? 0));
    return Math.max(...all);
  });
  if (j > 0.3) { await pg.screenshot({ path: `${OUT}/03-jump.png` }); console.log("jump still at", j.toFixed(2)); shot = true; }
}
if (!shot) await pg.screenshot({ path: `${OUT}/03-nojump.png` });
await b.close();
