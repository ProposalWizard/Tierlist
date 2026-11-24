// Opens the 3D Ballon d'Or night, the 3D season awards night and the Star Pass's spinning rewards in KIB Next's web build
// (phone/tools/look/out/web, made by build-web.mjs) in headless Chromium and takes stills with REAL touches (Chromium's touch events, as a finger).
//
//   node phone/tools/look/night-shots.mjs [--out DIR] [--sizes 412x915,360x780] [--web DIR] [--dpr 2] [--speed] [--only ballon,awards,starpass,fail]
//
// ballon    Home -> career-golden-ball: "Taking your seats…" while the stage loads, the host, the walk-on, the call, the reveal (the golden ball
//           over the winner), your place; held at each beat with window.__kibNight.seek(t); a real tap on Skip leaves for the result page; no GL canvas left.
// awards    career-season-awards: the intro, each award's nominees, the winner, the walk and the lift (seek); a real tap for the next award; Skip all.
// starpass  star-pass: a real tap on level 28's reward (claimable: the reveal, the Star Ball live on its podium), on level 48's (the gold aviators: drag round,
//           tap to zoom on the glasses) and on level 64's (a celebration, spun by a real drag), each with the still under it until the 3D is up; closing lets the GL go.
// fail      The crash guard has the 3D off: the drawn nights and the stills take over (never a blank or a crash).
// Same screens, host and scenes as the phone; only the GL comes from a <canvas> (expo-gl's web view). Software GL: read speed as relative.
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
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "night-shots"));
const WEB = arg("--web", path.join(HERE, "out/web"));
const SIZES = arg("--sizes", "412x915,360x780").split(",").map((s) => s.split("x").map(Number));
const DPR = Number(arg("--dpr", "2"));
const SPEED = args.includes("--speed");
const ONLY = arg("--only", "ballon,awards,starpass,fail").split(",");
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = require(require.resolve("playwright", { paths: [REPO] }));
const chrome = (() => {
  for (const r of [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(process.env.HOME ?? "", ".cache/ms-playwright")].filter(Boolean)) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter((x) => x.startsWith("chromium-")).sort().reverse()) for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) { const f = path.join(r, d, sub); if (fs.existsSync(f)) return f; }
  }
  return undefined;
})();

const made = JSON.parse(execFileSync("npx", ["tsx", path.join(HERE, "make-night-save.mts")], { cwd: REPO, encoding: "utf8", maxBuffer: 256 << 20 }).trim().split("\n").pop());
console.log(`career: ${made.entries} on the Ballon d'Or list, you finish ${made.rank}; ${made.awards} awards`);
const key = "knowitball-career\\career-v2";
const seed = (patch = {}, extraKv = {}) => {
  const c = JSON.parse(made.next[key]);
  Object.assign(c, patch);
  return { ...made.next, [key]: JSON.stringify(c), ...extraKv };
};

const server = await serve(WEB, 0);
const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log("   FAIL " + m); } };

async function scenario(name, W, H, kv, body) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await ctx.addInitScript((o) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(o.kv)) localStorage.setItem(k, v);
    // Android's Auto is Medium; a small phone opens one step lower (Walk3D walkTier), so the stills are the tier a phone gets
    if (o.speed) localStorage.setItem("knowitball-career\\prefs-v1", JSON.stringify({ show3dSpeed: true }));
    sessionStorage.setItem("seeded", "1");
  }, { kv, speed: SPEED });
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
  const tapAt = async (x, y) => { await touch("touchStart", [[x, y]]); await p.waitForTimeout(60); await touch("touchEnd", []); };
  const dragFrom = async (x, y, dx, steps = 6) => {
    await touch("touchStart", [[x, y]]);
    for (let i = 1; i <= steps; i++) { await p.waitForTimeout(30); await touch("touchMove", [[x + (dx * i) / steps, y]]); }
    await touch("touchEnd", []);
  };
  const shot = (n) => p.screenshot({ path: path.join(OUT, `${name}-${n}-${W}x${H}.jpg`), type: "jpeg", quality: 82 });
  const shown = (re) => p.getByText(re).first().isVisible().catch(() => false);
  const bigCanvases = () => p.evaluate(() => Array.from(document.querySelectorAll("canvas")).filter((c) => c.getBoundingClientRect().width > 150 && c.getBoundingClientRect().height > 150).length);
  const box = async (re) => p.getByText(re).first().boundingBox().catch(() => null);
  const nav = (screen, params) => p.evaluate(([s, pr]) => { const n = window.__kibNav; n.home(); n.go(s, pr); }, [screen, params ?? null]);
  console.log(`\n== ${name}  ${W}x${H} css at ${DPR}x`);
  await p.goto(server.url + "/", { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(5000);
  const re = /^continue$/i;
  let cont = p.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (!(await cont.count())) cont = p.getByText(re).first();
  try { await cont.click({ timeout: 20000 }); } catch (e) { await shot("title"); console.log("   no Continue button:", errors.slice(0, 5)); throw e; }
  await p.waitForTimeout(4500);
  const base = await bigCanvases();
  console.log(`   big canvases on Home before anything opens: ${base}`);
  try { await body({ p, W, H, touch, tapAt, dragFrom, shot, shown, bigCanvases, box, nav, errors, base }); } catch (e) { ok(false, `${name}: ${String(e).slice(0, 400)}`); await shot("error").catch(() => {}); }
  const bad = errors.filter((l) => !/Failed to load resource|WEBGL_debug|GPU stall|ReadPixels|KHR_parallel|HALF_FLOAT|favicon|deprecat|shadow\*|pointerEvents/i.test(l));
  if (bad.length) console.log("   messages:", Array.from(new Set(bad)).slice(0, 8));
  await ctx.close();
}

const waitFor = (p, fn, arg0, ms = 280000) => p.waitForFunction(fn, arg0 ?? null, { timeout: ms });
const night = (p) => p.evaluate(() => { const n = window.__kibNight; return n ? { mode: n.mode } : null; });
const seek = async (p, t) => { await p.evaluate((t) => window.__kibNight.seek(t), t); await p.waitForTimeout(900); };

for (const [W, H] of SIZES) {
  if (ONLY.includes("ballon")) await scenario("ballon", W, H, seed(), async (c) => {
    const { p, tapAt, shot, shown, bigCanvases, box, nav, base } = c;
    await nav("career-golden-ball");
    const t0 = Date.now();
    try { await waitFor(p, () => window.__kibNight); } catch { ok(false, "the night did not open"); await shot("failed"); return; }
    ok((await night(p)).mode === "3d", "the night did not start in 3D");
    await p.waitForTimeout(1500);
    // while the stage loads the words say so
    const loading = await shown(/Taking your seats/);
    console.log(`   "Taking your seats…" seen while loading: ${loading}`);
    try { await p.waitForFunction(() => !/Taking your seats/.test(document.body.innerText), null, { timeout: 240000 }); } catch { ok(false, "the 3D stage never came up"); await shot("loading"); return; }
    console.log(`   3D stage up after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    ok((await bigCanvases()) >= 1, "no 3D canvas on screen");
    const plan = await p.evaluate(() => { const n = window.__kibNight.plan; return { hostFrom: n.hostFrom, callAt: n.callAt, pauseAt: n.pauseAt, revealAt: n.revealAt, yourPlaceAt: n.yourPlaceAt, end: n.end, walks: n.finalists.map((f) => [f.walkFrom, f.walkTo]), kind: n.kind }; });
    console.log(`   the night: ${plan.kind}, ${plan.end.toFixed(1)} s, winner named at ${plan.revealAt.toFixed(1)} s`);
    await seek(p, plan.hostFrom + 0.6); await shot("1-host");
    ok(await shown(/Your host tonight/), "the host's caption is not on screen at his beat");
    await seek(p, (plan.walks[0][0] + plan.walks[0][1]) / 2); await shot("2-walk");
    await seek(p, plan.callAt + 0.8); await shot("3-call");
    ok(await shown(/And the winner is/), "no 'And the winner is…'");
    await seek(p, plan.revealAt + 1.2); await shot("4-reveal");
    ok(await shown(/You!|wins the Golden Ball/), "no winner on screen at the reveal");
    await seek(p, plan.revealAt + 2.8); await shot("5-ball-over");
    await seek(p, Math.max(plan.yourPlaceAt + 1.0, plan.revealAt + 3.6)); await shot("6-your-place");
    // a real tap on Skip › leaves for the result page
    const sk = await box(/^(Skip|Continue) ›$/);
    ok(!!sk, "no Skip button");
    if (sk) await tapAt(sk.x + sk.width / 2, sk.y + sk.height / 2);
    await p.waitForTimeout(4000);
    ok(await shown(/Golden Ball Winner|Your Finish|Final Top 10|Top 10|Continue/i), "the result page is not there after Skip");
    await shot("7-result");
    ok(await p.evaluate(() => window.__kibNight == null), "the night's stage was not let go when the ceremony ended");
    ok((await bigCanvases()) <= base, `a 3D canvas is left behind (${await bigCanvases()} > ${base})`);
  });
  if (ONLY.includes("awards")) await scenario("awards", W, H, seed({}, { "kib-update-leo-2026-10-24": JSON.stringify({ on: true, off: [] }) }), async (c) => {
    const { p, tapAt, shot, shown, bigCanvases, box, nav, base } = c;
    await nav("career-season-awards");
    const t0 = Date.now();
    try { await waitFor(p, () => window.__kibNight); } catch { ok(false, "the awards night did not open"); await shot("failed"); return; }
    ok((await night(p)).mode === "3d", "the awards night did not start in 3D");
    try { await p.waitForFunction(() => !/Finding your table/.test(document.body.innerText), null, { timeout: 240000 }); } catch { ok(false, "the 3D room never came up"); await shot("loading"); return; }
    console.log(`   3D room up after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    ok((await bigCanvases()) >= 1, "no 3D canvas on screen");
    const aw = await p.evaluate(() => window.__kibNight.plan.awards.map((a) => ({ key: a.key, label: a.label, from: a.from, nomineesAt: a.nomineesAt, revealAt: a.revealAt, walkTo: a.walkTo, end: a.end, you: a.winner.isYou })));
    console.log(`   ${aw.length} awards: ${aw.map((a) => a.label + (a.you ? " (you)" : "")).join(", ")}`);
    await seek(p, 1.2); await shot("1-intro");
    ok(await shown(/The Season Awards/), "no 'The Season Awards' caption at the start");
    const a0 = aw[0];
    await seek(p, a0.nomineesAt + 1.4); await shot("2-nominees");
    ok(await shown(/the nominees/i), "no nominee cards");
    await seek(p, a0.revealAt + 0.8); await shot("3-winner");
    await seek(p, a0.walkTo - 0.6); await shot("4-walk");
    await seek(p, a0.end - 0.3); await shot("5-lift");
    const yours = aw.find((a) => a.you) ?? aw[1];
    await seek(p, yours.nomineesAt + 1.4); await shot("6-your-nominees");
    await seek(p, yours.end - 0.3); await shot("7-your-lift");
    // a real tap on the next-award button moves on to the next award
    const nb = await box(/^(Next award|Skip) ›$/);
    ok(!!nb, "no next-award button");
    if (nb) await tapAt(nb.x + nb.width / 2, nb.y + nb.height / 2);
    await p.waitForTimeout(1500);
    const sa = await box(/^Skip all$/);
    ok(!!sa, "no Skip all");
    if (sa) await tapAt(sa.x + sa.width / 2, sa.y + sa.height / 2);
    await p.waitForTimeout(4000);
    await shot("8-awards-page");
    ok(await p.evaluate(() => window.__kibNight == null), "the awards room was not let go when the night ended");
    ok((await bigCanvases()) <= base, `a 3D canvas is left behind (${await bigCanvases()} > ${base})`);
  });
  if (ONLY.includes("starpass")) await scenario("starpass", W, H, seed(), async (c) => {
    const { p, tapAt, dragFrom, shot, shown, bigCanvases, box, nav, base } = c;
    await nav("star-pass");
    await p.waitForTimeout(3500);
    /** Open the reward at this level: scroll its number into the middle, tap the podium beside it. */
    const openLevel = async (lvl) => {
      const found = await p.evaluate((lvl) => {
        const els = Array.from(document.querySelectorAll("div, span")).filter((e) => e.children.length === 0 && e.textContent.trim() === String(lvl) && e.getBoundingClientRect().left < 60);
        const el = els[0];
        if (!el) return false;
        el.scrollIntoView({ block: "center" });
        return true;
      }, lvl);
      if (!found) return null;
      await p.waitForTimeout(800);
      const y = await p.evaluate((lvl) => {
        const els = Array.from(document.querySelectorAll("div, span")).filter((e) => e.children.length === 0 && e.textContent.trim() === String(lvl) && e.getBoundingClientRect().left < 60);
        const r = els[0].getBoundingClientRect();
        return r.top + r.height / 2;
      }, lvl);
      for (const dy of [30, 60, 0, 90]) {
        await tapAt(c.W * 0.62, y + dy);
        await p.waitForTimeout(900);
        if ((await shown(new RegExp(`^LEVEL ${lvl}$`))) || (await shown(new RegExp(`^LEVEL ${lvl} REWARD$`, "i")))) return y;
      }
      return null;
    };
    const live = () => p.evaluate(() => Array.from(document.querySelectorAll("canvas")).filter((c) => c.getBoundingClientRect().width > 100).length);
    // level 28: claimable (the career has 29 stars): a tap opens the claim reveal, the Star Ball live on its podium (the website's RewardReveal)
    ok((await openLevel(28)) !== null, "could not open level 28");
    const t0 = Date.now();
    try { await p.waitForFunction(() => Array.from(document.querySelectorAll("canvas")).filter((c) => c.getBoundingClientRect().width > 100).length >= 1, null, { timeout: 200000 }); } catch { ok(false, "no live 3D in the claim reveal"); await shot("reveal-failed"); }
    console.log(`   claim reveal: live canvas after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await p.waitForTimeout(2500);
    await shot("1-reveal-live");
    const rv = await box(/^Later$/);
    if (rv) await tapAt(rv.x + rv.width / 2, rv.y + rv.height / 2);
    await p.waitForTimeout(2500);
    ok((await bigCanvases()) <= base, `a 3D canvas is left after the reveal closed (${await bigCanvases()} > ${base})`);
    // level 48: the gold aviators (not reached yet: the preview): drag it round with a real finger, tap to zoom on the glasses
    ok((await openLevel(48)) !== null, "could not open level 48");
    try { await p.waitForFunction(() => Array.from(document.querySelectorAll("canvas")).filter((c) => c.getBoundingClientRect().width > 100).length >= 1, null, { timeout: 200000 }); } catch { ok(false, "no live 3D in the preview of level 48"); await shot("preview-failed"); }
    await p.waitForTimeout(3000);
    await shot("2-aviators-opened");
    ok(await shown(/Drag to spin it/), "no 'Drag to spin it' once the 3D is up");
    const cv = await p.evaluate(() => { const c = Array.from(document.querySelectorAll("canvas")).find((c) => c.getBoundingClientRect().width > 100); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await dragFrom(cv.x + cv.w * 0.3, cv.y + cv.h / 2, cv.w * 0.4);
    await p.waitForTimeout(1500);
    await shot("3-aviators-dragged");
    await tapAt(cv.x + cv.w / 2, cv.y + cv.h / 2);
    await p.waitForTimeout(4000);
    await shot("4-aviators-zoomed");
    // close with the ✕: the GL is let go
    const x = await box(/^✕$/);
    if (x) await tapAt(x.x + x.width / 2, x.y + x.height / 2);
    await p.waitForTimeout(2500);
    ok((await bigCanvases()) <= base, `a 3D canvas is left after the preview closed (${await bigCanvases()} > ${base})`);
    // level 64: a celebration (the spin model, no live card)
    ok((await openLevel(64)) !== null, "could not open level 64");
    try { await p.waitForFunction(() => Array.from(document.querySelectorAll("canvas")).filter((c) => c.getBoundingClientRect().width > 100).length >= 1, null, { timeout: 200000 }); } catch { ok(false, "no live 3D in the preview of level 64"); await shot("preview64-failed"); }
    await p.waitForTimeout(3000);
    await shot("5-celebration");
    const cv2 = await p.evaluate(() => { const c = Array.from(document.querySelectorAll("canvas")).find((c) => c.getBoundingClientRect().width > 100); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    if (cv2) { await dragFrom(cv2.x + cv2.w * 0.25, cv2.y + cv2.h / 2, cv2.w * 0.5); await p.waitForTimeout(1500); await shot("6-celebration-turned"); }
    void live;
  });
  if (ONLY.includes("fail")) await scenario("fail", W, H, seed({}, { "knowitball-safety\\off:3d": "1", "knowitball-safety\\wait:3d": "99", "kib-update-leo-2026-10-24": JSON.stringify({ on: true, off: [] }) }), async (c) => {
    const { p, shot, shown, bigCanvases, nav, base } = c;
    // the crash guard has the 3D off (phone/src/safety.ts): the drawn nights and the stills, never a blank or a crash
    await nav("career-golden-ball");
    await p.waitForTimeout(5000);
    ok((await night(p))?.mode === "drawn", "the Ballon d'Or night did not start drawn with the 3D off");
    ok(await shown(/Your host tonight|Golden Ball/), "the drawn stage's words are not there");
    ok((await bigCanvases()) <= base, "a 3D canvas started although the guard has it off");
    await shot("1-drawn-ballon");
    await nav("career-season-awards");
    await p.waitForTimeout(5000);
    ok((await night(p))?.mode === "drawn", "the awards night did not start drawn with the 3D off");
    await shot("2-drawn-awards");
    await nav("star-pass");
    await p.waitForTimeout(3500);
    await shot("3-star-pass");
  });
}
await browser.close();
await server.close?.();
console.log(failed ? `\n${failed} problem(s)` : "\nall good");
console.log(`pictures: ${OUT}/<scenario>-<spot>-<size>.jpg`);
process.exit(failed ? 1 : 0);
