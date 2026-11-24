// Opens the 3D training pitch in KIB Next's web build (phone/tools/look/out/web, made by build-web.mjs) in
// headless Chromium and takes stills with REAL touches (Chromium's touch events, as a finger).
//
//   node phone/tools/look/training-shots.mjs [--out DIR] [--sizes 412x915,360x780] [--web DIR] [--dpr 2] [--speed] [--only crossbar,two-touch,...]
//
// It goes in the way the app does: the Garden's training gate (stands at it, taps "Training ›"), the picker, and each drill:
// the stick (a finger on the left), a swipe and a tap (the right), the HUD moving; the Crossbar Challenge plays YOUR shot on the
// phone's match engine (strike screen, aim, drag) and then his cut-scene on the 3D pitch; a drill ended as if it were done
// ("forced": the drill's own result, not played out) must bank on the career (Team bar, energy, the week's Team game) and return to the
// Garden at the gate; Back leaves no GL canvas behind. Same screens, host and scenes as the phone; only the GL comes from a <canvas>
// (expo-gl's web view). Software GL: read speed as relative.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "training-shots"));
const WEB = arg("--web", path.join(HERE, "out/web"));
const SIZES = arg("--sizes", "412x915,360x780").split(",").map((s) => s.split("x").map(Number));
const DPR = Number(arg("--dpr", "2"));
const SPEED = args.includes("--speed");
const ONLY = arg("--only", "crossbar,two-touch,free-roam,headers-volleys,wembley,pace").split(",");
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = require(require.resolve("playwright", { paths: [REPO] }));
const chrome = (() => {
  for (const r of [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(process.env.HOME ?? "", ".cache/ms-playwright")].filter(Boolean)) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter((x) => x.startsWith("chromium-")).sort().reverse()) for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) { const f = path.join(r, d, sub); if (fs.existsSync(f)) return f; }
  }
  return undefined;
})();

const save = JSON.parse(execFileSync("npx", ["tsx", path.join(HERE, "make-save.mts")], { cwd: REPO, encoding: "utf8", maxBuffer: 64 << 20 }).trim().split("\n").pop()).next;
const key = "knowitball-career\\career-v2";
const career0 = JSON.parse(save[key]);
career0.energy = 100;
save[key] = JSON.stringify(career0);

const server = await serve(WEB, 0);
const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log("   FAIL " + m); } };
const NAME = { crossbar: /^Crossbar Challenge$/i, "two-touch": /^Two Touch$/i, "free-roam": /^Free Roam$/i, "headers-volleys": /^Headers & Volleys$/i, wembley: /^Wembley$/i, pace: /^Pace Sprint$/i };
for (const [W, H] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await ctx.addInitScript((kv) => {
    if (sessionStorage.getItem("seeded")) return;
    const speed = kv.__speed; delete kv.__speed;
    localStorage.clear();
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    if (speed) localStorage.setItem("knowitball-career\\prefs-v1", JSON.stringify({ show3dSpeed: true }));
    sessionStorage.setItem("seeded", "1");
  }, SPEED ? { ...save, __speed: true } : save);
  // a web page's own <img> asks the server for /star/...: answer with the app's bundled copies (the phone's reader does this itself)
  await ctx.route(/\/star\//, (route) => {
    const u = new URL(route.request().url());
    const rel = decodeURIComponent(u.pathname).replace(/^\/star\//, "");
    const f = path.join(REPO, "phone/assets/3d", rel.replace(/\.json$/, ".bin"));
    return fs.existsSync(f) ? route.fulfill({ body: fs.readFileSync(f) }) : route.continue();
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  p.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(server.url, "")}`); });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const shot = (name) => p.screenshot({ path: path.join(OUT, `${name}-${W}x${H}.jpg`), type: "jpeg", quality: 82 });
  const shown = (re) => p.getByText(re).first().isVisible().catch(() => false);
  const careerNow = () => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
  const glBox = () => p.evaluate(() => { let best = null; for (const c of document.querySelectorAll("canvas")) { const r = c.getBoundingClientRect(); if (!best || r.width * r.height > best.w * best.h) best = { x: r.x, y: r.y, w: r.width, h: r.height }; } return best; });
  const bigCanvases = () => p.evaluate(() => Array.from(document.querySelectorAll("canvas")).filter((c) => c.getBoundingClientRect().width > 200 && c.getBoundingClientRect().height > 200).length);
  console.log(`\n== ${W}x${H} css at ${DPR}x`);
  const t0 = Date.now();
  await p.goto(server.url + "/", { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(5000);
  const re = /^continue$/i;
  let cont = p.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (!(await cont.count())) cont = p.getByText(re).first();
  try { await cont.click({ timeout: 20000 }); } catch (e) { await shot("title"); console.log("   no Continue button:", errors.slice(0, 5)); throw e; }
  await p.waitForTimeout(4500);

  // ── 1. in through the Garden's training gate: stand at it, tap "Training ›" ──
  await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("garden"); });
  try { await p.waitForFunction(() => window.__garden3d, null, { timeout: 280000 }); } catch { ok(false, "the garden did not start"); await shot("failed-garden"); await ctx.close(); continue; }
  await p.waitForTimeout(3000);
  const gardenTo = async () => { await p.evaluate(() => window.__garden3d.place(-10.1, -9.0, 0)); await p.waitForTimeout(4000); };
  await gardenTo();
  const card = p.getByText(/^Training ›$/).first();
  try { await card.waitFor({ state: "visible", timeout: 60000 }); } catch { /* checked below */ }
  ok(await card.isVisible().catch(() => false), "standing at the garden's training gate did not show its card");
  await shot("garden-gate");
  await card.click();
  try { await p.getByText(/Pick a drill/).first().waitFor({ state: "visible", timeout: 60000 }); } catch { /* checked below */ }
  ok(await shown(/Pick a drill/), "the Training gate's card did not open the picker");
  const stack = await p.evaluate(() => window.__kibNav.stack.map((r) => r.name).join(" > "));
  console.log(`   gate -> picker (${((Date.now() - t0) / 1000).toFixed(0)} s into the page); screens: ${stack}`);
  ok(/garden > training-3d$/.test(stack), "the gate did not open training-3d on top of the garden");
  for (const id of Object.keys(NAME)) ok(await shown(NAME[id]), `the picker has no ${id} row`);
  await shot("picker");

  // back to the garden, in again, and a random drill: it must start something
  await p.getByText("‹").first().click();
  await p.waitForTimeout(3000);
  ok(await p.evaluate(() => window.__kibNav.stack.at(-1).name) === "garden", "Back from the picker did not return to the Garden");
  await p.evaluate(() => { delete window.__garden3d; });
  try { await p.waitForFunction(() => window.__garden3d, null, { timeout: 280000 }); } catch { ok(false, "the garden did not restart after Back"); }
  const gw = await p.evaluate(() => window.__garden3d.where());
  console.log(`   back in the Garden at ${gw.x.toFixed(1)}, ${gw.z.toFixed(1)} (the gate is at x -10.1, z -10.2): ${Math.hypot(gw.x + 10.1, gw.z + 8.2) < 4 ? "at the gate" : "NOT at the gate"}`);
  ok(Math.hypot(gw.x + 10.1, gw.z + 8.2) < 4, "Back from the training did not leave him at the training gate");
  await shot("garden-back");

  const toPicker = async () => {
    await p.evaluate(() => { const n = window.__kibNav; while (n.stack.length > 1 && n.stack.at(-1).name !== "training-3d") n.back(); });
    if (await p.evaluate(() => window.__kibNav.stack.at(-1).name) !== "training-3d") { await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("training-3d"); }); }
    await p.getByText(/Pick a drill/).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  };
  await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("training-3d"); });
  await p.getByText(/Pick a drill/).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});

  // ── 2. each drill ──
  // the big canvases on Home with nothing else open (the Home player, the pitch): what is left after a drill must be no more than this
  await p.evaluate(() => { window.__kibNav.home(); });
  await p.waitForTimeout(4000);
  const baseCanvases = await bigCanvases();
  console.log(`   big canvases on Home before any drill: ${baseCanvases}`);
  await p.evaluate(() => { window.__kibNav.go("training-3d"); });
  for (const id of ONLY) {
    console.log(`\n   -- ${id}`);
    await toPicker();
    const before = await careerNow();
    const under = await p.evaluate(() => { const st = window.__kibNav.stack; return st[st.length - 2]?.name; });
    if (id === "wembley") { await p.getByText(/^Normal$/i).first().click(); await p.waitForTimeout(1200); await shot("wembley-setup"); await p.getByText(/^Start$/i).first().click(); }
    else await p.getByText(NAME[id]).first().click();
    const t1 = Date.now();
    if (id === "crossbar") {
      try { await p.waitForFunction(() => window.__crossbar3d?.ctrlRef?.current, null, { timeout: 280000 }); } catch { console.log("   the 3D pitch did not come up (the game still plays on the engine's pitch):", errors.slice(-4)); ok(false, "the crossbar's 3D pitch did not start"); }
      console.log(`   3D pitch up after ${((Date.now() - t1) / 1000).toFixed(1)} s`);
      await p.waitForTimeout(2500);
      ok(await shown(/Round 1 of 5/), "no round line");
      await shot("crossbar-aim");
      // YOUR shot, on the match engine: a drag back from the ball (the aim), then the strike screen (tap the ball)
      const t2 = Date.now();
      let shotTaken = false;
      const roundLine = await p.getByText(/Round 1 of 5/i).first().boundingBox();
      const pitchTop = roundLine ? roundLine.y + roundLine.height + 3 : H * 0.2;
      const pitchH = Math.min(W * 1.45, H - 260);
      const bx = W * 0.5, by = pitchTop + pitchH * 0.752; // where the engine puts the ball (looked at in the 412x915 still)
      let aims = 0;
      while (Date.now() - t2 < 170000 && !shotTaken) {
        const words = await p.evaluate(() => document.body.innerText).catch(() => "");
        if (/'s shot/i.test(words) && !/your shot/i.test(words)) { shotTaken = true; break; }
        if (/^POWER$/m.test(words)) { await p.touchscreen.tap(W * 0.5, H * 0.72); await p.waitForTimeout(800); continue; }
        if (/your shot/i.test(words) && aims < 6) {
          aims++;
          await touch("touchStart", [[bx, by]]);
          for (let i = 1; i <= 14; i++) { await touch("touchMove", [[bx, by + i * 6]]); await p.waitForTimeout(18); }
          if (aims === 1) await shot("crossbar-aim-held");
          await touch("touchEnd", []);
          await p.waitForTimeout(1200);
          if (aims === 1) await shot("crossbar-strike");
          continue;
        }
        await p.waitForTimeout(700);
      }
      void 0;
      console.log(`   your shot on the engine ${shotTaken ? "finished" : "did NOT finish in 170 s"}; page says: ${(await p.evaluate(() => document.body.innerText)).split("\n").filter((l) => /Round|shot|CROSSBAR|Missed|post/i.test(l)).slice(0, 4).join(" | ")}`);
      if (shotTaken) {
        await p.waitForTimeout(6000);
        await shot("crossbar-mate");
        const st = await p.evaluate(() => ({ step: window.__crossbar3d.step, round: window.__crossbar3d.round, three: window.__crossbar3d.three }));
        console.log(`   after his shot: step ${st.step}, round ${st.round + 1}, 3D ${st.three}`);
      } else ok(false, "your shot on the engine did not finish (the check's aim may have missed the ball: read crossbar-engine)");
      await p.evaluate(() => window.__crossbar3d.finishNow());
    } else {
      try { await p.waitForFunction(() => window.__drill3d?.ctrlRef?.current, null, { timeout: 280000 }); } catch { console.log("   the drill did not start:", errors.slice(-4)); ok(false, `${id} did not start`); await shot(`${id}-failed`); continue; }
      console.log(`   3D drill up after ${((Date.now() - t1) / 1000).toFixed(1)} s`);
      await p.waitForTimeout(5000);
      await shot(`${id}-start`);
      const read = () => p.evaluate(() => { const d = window.__drill3d; const w = d.session.world; const y = w.you(); return { t: w.t, you: y ? { x: y.x, y: y.y } : null, ball: { x: w.ball.x, y: w.ball.y, z: w.ball.z }, hud: d.session.hud() }; });
      const a = await read();
      const box = await glBox();
      console.log(`   GL view at ${box.x.toFixed(0)},${box.y.toFixed(0)} ${box.w.toFixed(0)}x${box.h.toFixed(0)}; hud "${a.hud.big}" / "${a.hud.small}"`);
      // the stick: a finger on the left (Two Touch: the corner nudge stick only)
      const corner = id === "two-touch";
      const sx = corner ? box.x + 54 : box.x + box.w * 0.25, sy = corner ? box.y + box.h - 92 : box.y + box.h * 0.62;
      await touch("touchStart", [[sx, sy]]);
      for (let i = 1; i <= 6; i++) { await touch("touchMove", [[sx, sy - i * 9]]); await p.waitForTimeout(60); }
      await p.waitForTimeout(6000);
      await shot(`${id}-stick`);
      const b = await read();
      await touch("touchEnd", []);
      const moved = a.you && b.you ? Math.hypot(b.you.x - a.you.x, b.you.y - a.you.y) : 0;
      console.log(`   touch: the stick held up for 6 s: world ${(b.t - a.t).toFixed(1)} s, he moved ${moved.toFixed(2)} m`);
      ok(b.t > a.t, "the drill's World did not run");
      if (id !== "pace") ok(moved > 0.1, "a finger on the stick did not move him");
      // a swipe (right half) and a tap
      const rx = box.x + box.w * 0.7, ry = box.y + box.h * 0.6;
      await touch("touchStart", [[rx, ry]]);
      for (let i = 1; i <= 8; i++) { await touch("touchMove", [[rx - i * 6, ry - i * 14]]); await p.waitForTimeout(30); }
      await touch("touchEnd", []);
      await p.waitForTimeout(1500);
      await p.touchscreen.tap(rx, ry);
      await p.waitForTimeout(4000);
      const c = await read();
      console.log(`   touch: a swipe and a tap: hud "${c.hud.big}" / "${c.hud.small}", ball ${c.ball.x.toFixed(1)},${c.ball.y.toFixed(1)},${c.ball.z.toFixed(2)} (was ${a.ball.x.toFixed(1)},${a.ball.y.toFixed(1)})`);
      await shot(`${id}-played`);
      ok(await shown(new RegExp((c.hud.small ?? "").slice(0, 8).replace(/[^\w ]/g, ".") || ".")), "the HUD line is not on screen");
      await p.evaluate(() => window.__drill3d.finishNow());
    }
    await p.waitForTimeout(1500);
    ok(await shown(/Continue →/), "the result panel did not show");
    await shot(`${id}-result`);
    console.log(`   result words: ${(await p.evaluate(() => document.body.innerText)).split("\n").filter((l) => /Nice one|Not this time|Team|beat|Level|pace/i.test(l)).slice(0, 4).join(" | ")}`);
    await p.getByText(/Continue →/).first().click();
    await p.waitForTimeout(3500);
    const after = await careerNow();
    const top = await p.evaluate(() => window.__kibNav.stack.at(-1).name);
    console.log(`   Continue -> ${top}; Team bar ${before.relationships.team} -> ${after.relationships.team}, energy ${before.energy} -> ${after.energy}, Team game this week: ${JSON.stringify(after.relGamesPlayed?.kinds)}`);
    ok(top === under, `Continue did not go back to the screen under it (${under})`);
    ok(before.energy < 30 || after.energy < before.energy, "the drill did not cost the training session's energy");
    ok((after.relGamesPlayed?.kinds ?? []).includes("team"), "the drill did not count as the week's Team game");
    // the Garden's own GL must be the only big canvas now
    await p.waitForTimeout(2000);
    const left = await bigCanvases();
    console.log(`   big canvases left: ${left} (Home had ${baseCanvases})`);
    ok(left <= baseCanvases, "a GL canvas was left behind after the drill");
    // open the next one from the gate again (the stack is garden > ...)
    await p.evaluate(() => { const n = window.__kibNav; n.go("training-3d"); });
  }
  const bad = errors.filter((e) => !/Failed to load resource|WEBGL_debug|GPU stall|ReadPixels|HALF_FLOAT|favicon/i.test(e));
  if (bad.length) console.log("\n   messages:", Array.from(new Set(bad)).slice(0, 12));
  await ctx.close();
}
await browser.close();
server.close?.();
console.log(`\npictures: ${OUT}/<name>-<size>.jpg`);
console.log(failed ? `${failed} problem(s)` : "all good");
process.exit(failed ? 1 : 0);
