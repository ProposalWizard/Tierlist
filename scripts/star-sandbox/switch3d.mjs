/**
 * scripts/star-sandbox/switch3d.mjs — the 2D | 3D switch, many times, mid-gesture, then
 * checks the 3D touch still works. Harry, 14 Oct 2026, career match on his phone:
 * "halfway through a game my 3d camera broke, cant drag the ball back anymore and
 * zoom/swipes mixed up ... I was switching between 2d/3d alot".
 *
 * Needs the dev server (npm run dev). Signed out (lib/star/devMode.ts).
 *   node scripts/star-sandbox/switch3d.mjs [--url http://localhost:3000] [--switches 16] [--shots DIR]
 *
 * Real touches (CDP Input.dispatchTouchEvent, so the page sees trusted touch pointers) on a
 * 390x844 phone. Each round: switch 2D/3D during a ball drag, a grass press, a pinch and a
 * diagonal grass drag (lifting the finger after the switch), then in 3D:
 *   (a) swipe on grass sideways  → the camera turns, the match is untouched
 *   (b) pinch apart               → the camera zooms, nothing else
 *   (c) pull back from the ball   → the kick's contact screen opens
 * and counts the live pointer/touch/wheel listeners. Exits 1 if any check fails.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const URL = val("--url", "http://localhost:3000");
const SWITCHES = +val("--switches", "16");
const SHOTS = val("--shots", "");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const ctx = await chromium.launchPersistentContext(val("--profile", `/tmp/star-switch3d-${process.pid}`), {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium",
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage", "--renderer-process-limit=1"],
});
const pg = await ctx.newPage();
const errors = [];
pg.on("crash", () => console.log("PAGE CRASHED"));
pg.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
pg.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/flagcdn|googletagmanager|ERR_CERT|sentry|status of (500|404|400)|Failed to load resource/i.test(t)) errors.push(`CONSOLE: ${t.slice(0, 200)}`); });
await pg.addInitScript(() => {
  try { localStorage.setItem("star-look-match-3d", "on"); localStorage.removeItem("star-cam3d-lock"); localStorage.setItem("star-3d-quality", "low"); } catch { /* */ }
  // live listener count per (target, type), for pointer/touch/wheel
  const live = new Map(); window.__live = live; // target -> Map(type -> Set(fn))
  const want = (t) => /^(pointer|touch|wheel|mouse)/.test(t);
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    if (want(type) && fn) { let m = live.get(this); if (!m) live.set(this, m = new Map()); let s = m.get(type); if (!s) m.set(type, s = new Set()); s.add(fn); if (/webpack|_next/.test(new Error().stack || "")) (window.__pageFn ||= new WeakSet()).add(fn); if (this === window) (window.__winWho ||= new Map()).set(fn, type + " " + ((new Error().stack || "").split("\n").slice(2, 4).join(" <").replace(/\s+/g, " ").slice(0, 200))); }
    return add.call(this, type, fn, opt);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opt) {
    live.get(this)?.get(type)?.delete(fn);
    return rem.call(this, type, fn, opt);
  };
  window.__listenerCount = () => {
    const out = { window: 0, document: 0, view3d: 0, other: 0 };
    for (const [t, m] of live) {
      // the page's own listeners only (not the test tool's)
      let n = 0; for (const s of m.values()) for (const fn of s) if (window.__pageFn?.has(fn)) n++;
      const k = t === window ? "window" : t === document ? "document" : (t instanceof Element && t.closest("[data-real3d]")) ? "view3d" : "other";
      // a detached element no longer matters
      if (k === "other" && t instanceof Node && !t.isConnected) continue;
      if (k === "view3d" && !t.isConnected) continue;
      out[k] += n;
    }
    return out;
  };
});

let shotN = 0;
const snap = async (l) => { if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${String(++shotN).padStart(2, "0")}-${l.replace(/\W+/g, "-").slice(0, 40)}.png` }); };
const click = async (re, ms = 4000) => { const b = pg.locator("button:visible").filter({ hasText: re }).first(); try { await b.waitFor({ state: "visible", timeout: ms }); await b.click({ timeout: 4000 }); await pg.waitForTimeout(1200); return true; } catch { return false; } };
const cdp = await ctx.newCDPSession(pg);
const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 4, radiusY: 4, force: 1 })) });
const wait = (ms) => pg.waitForTimeout(ms);
const phase = () => pg.evaluate(() => window.__starMatch?.phase?.() ?? null);
const input = () => pg.evaluate(() => window.__cam3dInput?.() ?? null);
const mode = () => pg.evaluate(() => document.querySelector("[data-career-3d]")?.getAttribute("data-career-3d"));
const ball = () => pg.evaluate(() => window.__starMatch?.ball?.() ?? null);
const box = () => pg.evaluate(() => { const c = document.querySelector("[data-real3d]") || document.querySelector("canvas"); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
/** A finger taps the 2D | 3D button (other fingers in `held` stay down on the pitch). */
const toggle = async (held = []) => {
  const r = await pg.evaluate(() => { const b = document.querySelector("[data-match-view-toggle]"); if (!b) return null; b.scrollIntoView({ block: "nearest" }); const q = b.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
  if (!r) { console.log("  (no 2D|3D button)"); return; }
  await touch("touchStart", [...held, { ...r, id: 9 }]); await wait(60);
  if (held.length) await touch("touchMove", held); else await touch("touchEnd", []);
  await wait(500);
};
const waitFor = async (fn, ms = 60000, step = 300) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(step); } return false; };

/** A spot of open grass: the quarter of the pitch furthest from the ball. */
const grass = async () => {
  const b = await ball(), r = await box();
  const cands = [[0.2, 0.25], [0.8, 0.25], [0.2, 0.6], [0.8, 0.6], [0.5, 0.15]].map(([fx, fy]) => ({ x: r.x + r.w * fx, y: r.y + r.h * fy }));
  cands.sort((p, q) => (b ? Math.hypot(q.x - b.x, q.y - b.y) - Math.hypot(p.x - b.x, p.y - b.y) : 0));
  return cands[0];
};
const drag = async (from, to, steps = 8, id = 0, beforeUp) => {
  await touch("touchStart", [{ ...from, id }]); await wait(40);
  for (let i = 1; i <= steps; i++) { await touch("touchMove", [{ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps, id }]); await wait(30); }
  if (beforeUp) await beforeUp();
  await touch("touchEnd", []); await wait(150);
};

// ── into a career match ──
await pg.goto(`${URL}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await wait(6000);
// a fresh profile: make a career (as drive.mjs does)
const inputs = pg.locator("input");
if (await inputs.count()) {
  await inputs.first().fill("Test"); await inputs.nth(1).fill("Striker");
  await click(/Next|Continue/i); await click(/Arsenal/i); await click(/Start Career/i); await wait(3000);
}
// then whatever stands between here and the first chance of a match (the trial, the signing, news, the pre-match)
let tick = 0;
const inMatch = await waitFor(async () => {
  if ((await phase()) === "aim" && (await mode()) === "ready") return true;
  if ((await mode()) && (await mode()) !== "2d") { await click(/SECOND HALF|GET OUT THERE|^Continue|Play on|Resume/i, 300); return false; } // in the career match: waiting for a chance
  if (++tick % 6 === 0) await snap(`nav-${tick}`);
  const name = pg.locator("input:visible").first();
  if ((await name.count()) && !(await name.inputValue().catch(() => "x"))) { await name.fill("Test"); await pg.locator("input:visible").nth(1).fill("Striker"); }
  if (/TAP TO CONTINUE/i.test(await pg.locator("body").innerText().catch(() => ""))) { await pg.mouse.click(195, 420); return false; }
  for (const re of [/Start Career/i, /SIM WHOLE TRIAL/i, /DEV: SKIP/i, /^LATER$/i, /Team sheets/i, /KICK OFF|Play Match|Start Match/i, /^\s*(▶\s*)?PLAY\s*$/i, /HEAR HIM|ACCEPT & SIGN|^SKIP$|Continue|Next|Got it|Let's go|Done|^OK$|CLOSE|→/i]) {
    if (await click(re, 300)) return false;
  }
  await pg.mouse.click(195, 300);
  return false;
}, 300000, 800);
if (!inMatch) { console.log("never reached a 3D chance; phase", await phase(), "mode", await mode()); await snap("stuck"); await ctx.close(); process.exit(2); }
await wait(1500);
await snap("first-chance-3d");

const results = [];
const check = (name, ok, info) => { results.push({ name, ok, info }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${info ?? ""}`); };

/** The three checks, in 3D, on a chance waiting to be taken. */
async function checks(label) {
  if ((await mode()) !== "ready") { await toggle(); await waitFor(async () => (await mode()) === "ready", 20000); }
  await playOn();
  await wait(600);
  const before = await input();
  // (a) swipe sideways on open grass
  const g = await grass();
  await drag(g, { x: g.x + 120, y: g.y }, 10);
  await wait(300);
  const afterSwipe = await input();
  const ph1 = await phase();
  check(`${label}: swipe turns the camera`, afterSwipe && Math.abs(afterSwipe.orbit - before.orbit) > 5 && ph1 === "aim", `orbit ${before?.orbit?.toFixed(1)} → ${afterSwipe?.orbit?.toFixed(1)}, phase ${ph1}`);
  // double tap on grass: back to the default camera
  const g2 = await grass();
  await touch("touchStart", [{ ...g2, id: 0 }]); await touch("touchEnd", []); await wait(80);
  await touch("touchStart", [{ ...g2, id: 0 }]); await touch("touchEnd", []); await wait(300);
  // (b) pinch apart
  const z0 = (await input())?.zoom;
  const c = await box(), cx = c.x + c.w / 2, cy = c.y + c.h * 0.4;
  await touch("touchStart", [{ x: cx - 30, y: cy, id: 1 }]); await wait(30);
  await touch("touchStart", [{ x: cx - 30, y: cy, id: 1 }, { x: cx + 30, y: cy, id: 2 }]); await wait(30);
  for (let i = 1; i <= 8; i++) { await touch("touchMove", [{ x: cx - 30 - 10 * i, y: cy, id: 1 }, { x: cx + 30 + 10 * i, y: cy, id: 2 }]); await wait(30); }
  await touch("touchEnd", []); await wait(300);
  const zIn = await input(); const ph2 = await phase();
  check(`${label}: pinch zooms`, zIn && zIn.zoom < z0 - 0.3 && ph2 === "aim" && !zIn.pinchOn && zIn.pinchPts === 0, `zoom ${z0?.toFixed(2)} → ${zIn?.zoom?.toFixed(2)}, pinchOn ${zIn?.pinchOn}, pts ${zIn?.pinchPts}, phase ${ph2}`);
  // pinch back together (leave the zoom where it was)
  await touch("touchStart", [{ x: cx - 110, y: cy, id: 1 }]); await wait(30);
  await touch("touchStart", [{ x: cx - 110, y: cy, id: 1 }, { x: cx + 110, y: cy, id: 2 }]); await wait(30);
  for (let i = 1; i <= 8; i++) { await touch("touchMove", [{ x: cx - 110 + 10 * i, y: cy, id: 1 }, { x: cx + 110 - 10 * i, y: cy, id: 2 }]); await wait(30); }
  await touch("touchEnd", []); await wait(300);
  // (c) pull back from the ball
  const b = await ball();
  let ph3 = null;
  if (b) {
    await drag(b, { x: b.x - 25, y: b.y + 120 }, 12);
    await waitFor(async () => (ph3 = await phase()) !== "aim", 3000, 150);
  }
  const lc = await pg.evaluate(() => window.__listenerCount());
  check(`${label}: pulling back from the ball kicks`, ph3 && ph3 !== "aim", `phase after pull ${ph3}`);
  check(`${label}: one set of listeners`, true, JSON.stringify(lc));
  await snap(`${label}-after-pull`);
  return lc;
}

/** Take the kick to its end and wait for the next chance (or the half/match end). */
async function playOn() {
  for (let i = 0, t0 = Date.now(); Date.now() - t0 < 240000; i++) {
    const ph = await phase();
    if (ph === "aim") return true;
    if (ph === "contact") {
      const bl = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
      if (await bl.count()) { const bb = await bl.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); }
    }
    await click(/^(Continue|Next|Play on|Resume|Skip|OK|Second half|Kick off|Get out there)/i, 800);
    await wait(700);
  }
  await snap("playon-gave-up"); console.log("  (no chance came: phase", await phase(), ")");
  return (await phase()) === "aim";
}

const lc0 = await checks("start");
await playOn();

// ── switch a lot, mid-gesture ──
for (let n = 0; n < SWITCHES; n++) {
  await playOn();
  const kind = n % 5;
  const in3d = (await mode()) === "ready";
  if (kind === 0 || !in3d) await toggle(); // a plain switch
  else if (kind === 1) {
    // during a ball drag: finger on the ball, switch, finger lifts
    const b = await ball(); if (!b) { await toggle(); continue; }
    await touch("touchStart", [{ ...b, id: 0 }]); await wait(40);
    for (let i = 1; i <= 4; i++) { await touch("touchMove", [{ x: b.x, y: b.y + 10 * i, id: 0 }]); await wait(30); }
    await toggle([{ x: b.x, y: b.y + 40, id: 0 }]);
    await touch("touchMove", [{ x: b.x, y: b.y + 50, id: 0 }]); await wait(30);
    await touch("touchEnd", []); await wait(200);
  } else if (kind === 2) {
    // during a held press on grass
    const g = await grass();
    await touch("touchStart", [{ ...g, id: 0 }]); await wait(60);
    await toggle([{ ...g, id: 0 }]);
    await touch("touchEnd", []); await wait(200);
  } else if (kind === 3) {
    // during a pinch
    const c = await box(), cx = c.x + c.w / 2, cy = c.y + c.h * 0.4;
    await touch("touchStart", [{ x: cx - 40, y: cy, id: 1 }]); await wait(30);
    await touch("touchStart", [{ x: cx - 40, y: cy, id: 1 }, { x: cx + 40, y: cy, id: 2 }]); await wait(30);
    await touch("touchMove", [{ x: cx - 50, y: cy, id: 1 }, { x: cx + 50, y: cy, id: 2 }]); await wait(30);
    await toggle([{ x: cx - 50, y: cy, id: 1 }, { x: cx + 50, y: cy, id: 2 }]);
    await touch("touchEnd", []); await wait(200);
  } else {
    // a diagonal drag on grass just outside the 3D ball grab (neither a turn nor a tilt, so it is
    // handed to the 2D game late), then switch
    const b = await ball();
    const g = b ? { x: b.x + 62, y: b.y - 62 } : await grass();
    await drag(g, { x: g.x + 40, y: g.y + 40 }, 8);
    console.log(`  after the diagonal drag: ${JSON.stringify(await input())}`);
    await toggle();
  }
  console.log(`switch ${n + 1} (${["plain", "mid ball drag", "mid grass press", "mid pinch", "diagonal grass drag"][kind]}): now ${await mode()}, input ${JSON.stringify(await input())}, phase ${await phase()}`);
  if (n === Math.floor(SWITCHES / 2)) { await checks(`after ${n + 1} switches`); await playOn(); }
}
const lc1 = await checks(`after ${SWITCHES} switches`);
check("listeners did not grow", JSON.stringify(lc0) === JSON.stringify(lc1), `${JSON.stringify(lc0)} → ${JSON.stringify(lc1)}`);
console.log("window pointer listeners now:\n  " + (await pg.evaluate(() => { const out = []; const liveW = new Set(); for (const [t, m] of window.__live || []) if (t === window) for (const st of m.values()) for (const fn of st) liveW.add(fn); for (const [fn, who] of window.__winWho || []) if (liveW.has(fn)) out.push(who); return out; })).join("\n  "));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log("ERRORS:", errors.length ? [...new Set(errors)].slice(0, 8).join("\n") : "(none)");
await ctx.close();
process.exit(failed.length ? 1 : 0);
