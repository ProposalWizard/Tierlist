/**
 * B14 playtest: the real career match (/star-dev, signed out via devMode.ts).
 * Gets into a match, PASSES to a team-mate in open-play chances, then:
 *   computer (1440x900): holds W + Shift (and A/D toward the box) and watches
 *     the stamina bar drain, lets go and watches Auto run take over;
 *   phone (390x844): steers nothing (Auto run).
 * Logs the run each 0.25 s (window.__starMatch.playOn: speed, bar, cap, sprinting,
 * auto, the man's choice) and saves stills to --out the moment each is made.
 *
 *   node scripts/star-sandbox/run-after.mjs --url http://localhost:3071 --size 1440x900 --out docs/handoffs/2026-10-20-builds/b14 [--profile dir] [--video dir] [--passes 8]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = val("--url", "http://localhost:3071");
const [W, H] = val("--size", "390x844").split("x").map(Number);
const OUT = val("--out", "/tmp/b14");
const TAG = val("--tag", "") + (W < 600 ? "phone" : "pc");
const PASSES = Number(val("--passes", "8"));
const VIDEO = val("--video", null);
mkdirSync(OUT, { recursive: true });
const phone = W < 600;
const ctx = await chromium.launchPersistentContext(val("--profile", `/tmp/b14-profile-${TAG}`), {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  viewport: { width: W, height: H }, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone,
  ...(VIDEO ? { recordVideo: { dir: VIDEO, size: { width: W, height: H } } } : {}),
});
const pg = ctx.pages()[0] || await ctx.newPage();
const T0 = Date.now();
const errors = [];
pg.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
pg.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/flagcdn|googletagmanager|ERR_CERT|sentry|status of (500|404|400)|Failed to load resource/i.test(t)) errors.push(`CONSOLE: ${t.slice(0, 200)}`); });
let shotN = 0;
const snap = async (label) => { const p = `${OUT}/b14b-${TAG}-${String(++shotN).padStart(2, "0")}-${label}.jpg`; await pg.screenshot({ path: p, type: "jpeg", quality: 82 }); console.log("  still:", p); return p; };
const camLog = [];
const sm = (fn, ...a) => pg.evaluate(([f, args]) => { const m = globalThis.__starMatch; return m && m[f] ? m[f](...args) : null; }, [fn, a]);

await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await pg.waitForTimeout(8000);
// A new career if there isn't one.
const inputs = pg.locator("input:visible");
if (await inputs.count() >= 2) {
  await inputs.first().fill("Test"); await inputs.nth(1).fill("Runner");
  for (const re of [/Next|Continue/i, /Arsenal/i, /Start Career/i]) { const b = pg.locator("button:visible").filter({ hasText: re }).first(); if (await b.count()) { await b.click().catch(() => {}); await pg.waitForTimeout(2500); } }
}
const PRIORITY = [/^SIM WHOLE TRIAL/i, /GET OUT THERE/i, /Play Match|Kick Off|KICK OFF/i, /Team sheets/i, /^▶ *Play|^Play$/i, /TAP TO HEAR|Continue|Next|Accept|Sign|Start Career|Skip|Done|OK|Close|Let's go|Begin/i];
// The career match (not the trial's own EnginePlay): a CanvasMatch given a career and a fixture.
const careerMatch = () => pg.evaluate(() => {
  for (const cv of document.querySelectorAll("canvas")) {
    const key = Object.keys(cv).find((k) => k.startsWith("__reactFiber$")); let f = key ? cv[key] : null;
    while (f) { const n = f.type && (f.type.displayName || f.type.name); if (n === "CanvasMatch") { const p = f.memoizedProps; return !!(p.career && p.fixture && !p.bare); } f = f.return; }
  }
  return false;
});
let inMatch = false;
const PRIORITY2 = [/FULL TIME/i, ...PRIORITY];
async function enterMatch() {
inMatch = false;
for (let i = 0; i < 90 && !inMatch; i++) {
  if ((await sm("phase")) === "aim" && await careerMatch()) { inMatch = true; break; }
  let clicked = false;
  for (const re of PRIORITY2) {
    const b = pg.locator("button:visible").filter({ hasText: re }).first();
    if (await b.count()) { try { await b.click({ timeout: 3000 }); clicked = true; break; } catch { /* next */ } }
  }
  if (!clicked) await pg.mouse.click(W / 2, H / 2);
  await pg.waitForTimeout(2500);
}
}
await enterMatch();
let matches = 1;
console.log(`[${TAG}] in match:`, inMatch);
// Pitch width (drift check): the career CanvasMatch's own box.
console.log(`[${TAG}] pitch width`, await pg.evaluate(() => { for (const cv of document.querySelectorAll("canvas")) { const key = Object.keys(cv).find((k) => k.startsWith("__reactFiber$")); let f = key ? cv[key] : null; while (f) { const n = f.type && (f.type.displayName || f.type.name); if (n === "CanvasMatch") { const p = f.memoizedProps; if (p.career && p.fixture && !p.bare) { const r = cv.parentElement.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)} px`; } break; } f = f.return; } } return null; }));

const OPEN = new Set(["one_on_one", "long_range", "cutback", "through_ball", "tight_angle", "byline_cross", "volley", "header"]);
const drag = async (from, to, steps = 12) => {
  if (phone) {
    const cdp = await ctx.newCDPSession(pg);
    const tp = (x, y) => [{ x, y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(from.x, from.y) });
    for (let i = 1; i <= steps; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps) }); await pg.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    await pg.mouse.move(from.x, from.y); await pg.mouse.down();
    for (let i = 1; i <= steps; i++) { await pg.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps); await pg.waitForTimeout(16); }
    await pg.mouse.up();
  }
};
const tap = async (x, y) => { if (phone) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y); };

let passes = 0, backs = 0, sprintSeen = false, recoverSeen = false, autoSeen = false;
const log = [];
for (let loop = 0; loop < 600 && passes < PASSES; loop++) {
  const phase = await sm("phase");
  if (phase === "tdDribble") {
    // The top-down dribble: flick up the pitch until it ends (this driver does not play it well, only gets through it).
    await drag({ x: W / 2, y: H * 0.62 }, { x: W / 2 + (Math.random() - 0.5) * 60, y: H * 0.35 }, 8);
    await pg.waitForTimeout(900);
    continue;
  }
  if (phase !== "aim") {
    const b = pg.locator("button:visible").filter({ hasText: /^(GET OUT THERE.*|Continue|Next|Play on|Resume|Skip|OK|Second half.*|Kick off.*|Start the second half.*)$/i }).first();
    if (await b.count()) await b.click().catch(() => {});
    if (loop % 20 === 0) {
      const btns = (await pg.locator("button:visible").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
      console.log(`  [${((Date.now() - T0) / 1000).toFixed(0)} s] phase ${phase} · buttons: ${btns.slice(0, 8).join(" | ").slice(0, 160)}`);
      if (btns.some((x) => /^FULL TIME/i.test(x)) || (!phase && btns.some((x) => /Player Ratings|Post.?match|Home/i.test(x)) && !btns.some((x) => /half/i.test(x)))) { console.log("  match over"); if (++matches > 4) break; await enterMatch(); console.log(`[${TAG}] next match, in match:`, inMatch); continue; }
    }
    await pg.waitForTimeout(1200);
    continue;
  }
  await pg.waitForTimeout(600);
  const fr = await sm("frame");
  const ball = await sm("ball");
  if (!fr || !ball) { await pg.waitForTimeout(800); continue; }
  const open = OPEN.has(fr.kind);
  const mates = fr.men.filter((m) => m.role === "runner" || m.role === "runner2" || m.role === "follower")
    .filter((m) => Math.hypot(m.cx - ball.x, m.cy - ball.y) > 30);
  if (passes === 0) await snap(`aim-${fr.kind}`);
  const camOf = (f, tag) => { const c = f.cam; const r = { tag, kind: f.kind, facing: f.facing, zoom: +f.zoom.toFixed(2), figPx: +f.figPx.toFixed(1), across: +f.metres.across.toFixed(1), down: +f.metres.down.toFixed(1), cam: [c.x1, c.x2, c.y1, c.y2].map((v) => +v.toFixed(2)).join(",") }; camLog.push(r); console.log("   CAM", JSON.stringify(r)); return r; };
  camOf(fr, `aim${passes + 1}`);
  if (fr.facing !== "up" && !globalThis.__sideSnap) { globalThis.__sideSnap = 1; await snap(`side-on-${fr.facing}-bar-${fr.barCorner}`); }
  if (fr.barCorner && fr.barCorner !== "bl" && !globalThis["__bar" + fr.barCorner]) { globalThis["__bar" + fr.barCorner] = 1; await snap(`bar-moved-${fr.barCorner}`); }
  let target;
  if (open && mates.length) target = mates.sort((a, b) => a.y - b.y)[0];
  else { const g = await sm("goal"); target = { cx: g.x + 20, cy: g.y }; }
  const dx = target.cx - ball.x, dy = target.cy - ball.y, d = Math.hypot(dx, dy) || 1;
  const pull = 70;
  await drag({ x: ball.x, y: ball.y }, { x: ball.x - (dx / d) * pull, y: ball.y - (dy / d) * pull });
  await pg.waitForTimeout(700);
  // The contact screen: strike the middle of the ball.
  const cball = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  if (await cball.count()) { const bb = await cball.boundingBox(); if (bb) await tap(bb.x + bb.width / 2, bb.y + bb.height * 0.55); }
  if (!(open && mates.length)) { await pg.waitForTimeout(3500); continue; }
  passes++;
  console.log(`[${TAG}] pass ${passes}: ${fr.kind} at ${((Date.now() - T0) / 1000).toFixed(1)} s into the recording`);
  // Watch the run.
  let caughtChoice = null, lastBar = 1, minBar = 1, t0 = Date.now(), steered = false, phaseNow = "flight";
  const gx = (await sm("goal")).x;
  for (let k = 0; k < 40; k++) {
    const po = await sm("playOn");
    phaseNow = await sm("phase");
    if (!po) { if (k > 2) break; await pg.waitForTimeout(150); continue; }
    // computer: 1.6 s of W + Shift (toward the box), then let go (Auto run again).
    if (!phone && !steered && po.you) {
      steered = true;
      const side = (po.youOnScreen?.x ?? W / 2) < gx ? "KeyD" : "KeyA";
      await pg.keyboard.down("ShiftLeft"); await pg.keyboard.down("KeyW"); await pg.keyboard.down(side);
      setTimeout(async () => { await pg.keyboard.up(side).catch(() => {}); }, 700);
      setTimeout(async () => { await pg.keyboard.up("KeyW").catch(() => {}); await pg.keyboard.up("ShiftLeft").catch(() => {}); }, 1600);
    }
    { const f2 = await sm("frame"); if (f2) camOf(f2, `run${passes} t${Date.now() - t0}`); }
    const L = po.legs;
    const row = { t: Date.now() - t0, phase: phaseNow, auto: po.auto, choice: po.choice, layOff: po.layOffLive, bar: L?.bar?.toFixed(2), cap: L?.cap?.toFixed(2), spr: L?.sprinting, v: L?.speed?.toFixed(1), e: po.energy?.toFixed(2) };
    log.push(row);
    if (L) { minBar = Math.min(minBar, L.bar); }
    if (L?.sprinting && !sprintSeen && (Date.now() - t0) > 600) { sprintSeen = true; await snap(`sprinting-bar-${(L.bar * 100).toFixed(0)}`); }
    if (L && L.bar > lastBar + 0.01 && minBar < 0.95 && !recoverSeen) { recoverSeen = true; await snap(`recovering-bar-${(L.bar * 100).toFixed(0)}`); }
    if (po.auto && !autoSeen && (Date.now() - t0) > (phone ? 300 : 2300)) { autoSeen = true; await snap("auto-run"); }
    if ((po.choice === "feet" || po.choice === "through") && !caughtChoice) {
      caughtChoice = po.choice; backs++; await snap(`ball-back-${po.choice}`);
      // Every frame for 2.5 s from here: the camera's worst one-frame move (edge px) and the men's size.
      const rec = await pg.evaluate(() => new Promise((res) => {
        const out = []; const t0 = performance.now();
        const tick = () => { const m = globalThis.__starMatch; const f = m && m.frame(); if (f) out.push({ t: performance.now() - t0, cam: f.cam, w: f.box.w, fig: f.figPx, ph: m.phase(), facing: f.facing });
          if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else res(out); };
        requestAnimationFrame(tick);
      }));
      let worst = 0, worstAt = null, figs = rec.map((r) => r.fig);
      for (let i = 1; i < rec.length; i++) { const a = rec[i - 1], b = rec[i]; const px = b.w / (a.cam.x2 - a.cam.x1);
        const d = Math.max(...["x1", "x2", "y1", "y2"].map((k) => Math.abs(b.cam[k] - a.cam[k]) * px)); if (d > worst) { worst = d; worstAt = `${a.ph}->${b.ph} at ${b.t.toFixed(0)} ms`; } }
      const r = { tag: `frames${passes}`, frames: rec.length, worstEdgePxPerFrame: +worst.toFixed(2), worstAt, figMin: +Math.min(...figs).toFixed(1), figMax: +Math.max(...figs).toFixed(1), phases: [...new Set(rec.map((x) => x.ph))].join(">") };
      console.log("   FRAMES", JSON.stringify(r)); camLog.push(r);
    }
    if (L) lastBar = L.bar;
    if (phaseNow !== "flight") break;
    await pg.waitForTimeout(250);
  }
  console.log(`  choice ${caughtChoice ?? "-"}, min bar ${minBar.toFixed(2)}, ended in ${phaseNow}`);
  if (caughtChoice) { for (let q = 0; q < 6; q++) { const f3 = await sm("frame"); if (f3) camOf(f3, `back${passes} +${q * 200}ms ${await sm("phase")}`); await pg.waitForTimeout(200); } await snap(`after-the-ball-back-${await sm("phase")}`); }
  await pg.waitForTimeout(1500);
}
console.log(`[${TAG}] passes ${passes}, ball back ${backs}, sprint seen ${sprintSeen}, recover seen ${recoverSeen}, auto seen ${autoSeen}`);
console.log("run log (last 30):"); for (const r of log.slice(-30)) console.log(" ", JSON.stringify(r));
// Pitch width (drift check): the career match's canvas box.
console.log("ERRORS:", errors.length ? [...new Set(errors)].slice(0, 8).join("\n") : "(none)");
await ctx.close();
