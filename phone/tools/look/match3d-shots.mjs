// Plays a match in KIB Next's web build (phone/tools/look/out/web, made by build-web.mjs) in headless Chromium with REAL touches
// and takes stills of the match radar (the commentary) and the 3D match view (the pitch, with its 3D | 2D button).
//
//   node phone/tools/look/match3d-shots.mjs [--out DIR] [--sizes 412x915,360x780] [--web DIR] [--dpr 2] [--speed] [--quality low|medium|high] [--only radar,view,default]
//
// default: no setting changed (3D off, radar off): the match as it was, with the "2D" button on the plate.
// radar:   Settings -> Match radar on: the radar over the commentary, minute by minute.
// view:    the 3D | 2D button tapped (a real touch): the 3D picture over the pitch; tapped again: back to 2D at once; a third time: 3D again.
// Software GL: read speed as relative.
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
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "match3d-shots"));
const WEB = arg("--web", path.join(HERE, "out/web"));
const SIZES = arg("--sizes", "412x915,360x780").split(",").map((s) => s.split("x").map(Number));
const DPR = Number(arg("--dpr", "2"));
const SPEED = args.includes("--speed");
const QUALITY = arg("--quality", "");
const ONLY = arg("--only", "default,radar,view").split(",");
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

for (const mode of ONLY) for (const [W, H] of SIZES) {
  const prefs = { show3dSpeed: SPEED, matchRadar: mode === "radar", matchView3d: false };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([kv, prefs, q]) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    localStorage.setItem("knowitball-career\\prefs-v1", JSON.stringify(prefs));
    if (q) localStorage.setItem("star-3d-quality", q);
    sessionStorage.setItem("seeded", "1");
  }, [save, prefs, QUALITY]);
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
  const cdp = await ctx.newCDPSession(p);
  const touch = async (x, y) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 0 }] }); await p.waitForTimeout(60); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
  const tapText = async (re, timeout = 15000) => { const l = p.getByText(re).first(); await l.waitFor({ state: "visible", timeout }); const b = await l.boundingBox(); await touch(b.x + b.width / 2, b.y + b.height / 2); };
  const tapLabel = async (label, timeout = 15000) => { const l = p.locator(`[aria-label="${label}"]`).first(); await l.waitFor({ state: "visible", timeout }); const b = await l.boundingBox(); await touch(b.x + b.width / 2, b.y + b.height / 2); };
  const shot = (name) => p.screenshot({ path: path.join(OUT, `${mode}-${name}-${W}x${H}.jpg`), type: "jpeg", quality: 82 });
  const v3 = () => p.evaluate(() => { const v = window.__matchView3d; return v ? { status: v.status, shown: v.shown, errRun: v.errRun } : null; });
  const phase = () => p.evaluate(() => (window.__kibMatch ? window.__kibMatch.phase : null));
  console.log(`\n== ${mode}  ${W}x${H} css at ${DPR}x`);
  await p.goto(server.url + "/", { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(5000);
  await tapText(/^continue$/i, 30000);
  await p.waitForTimeout(4500);
  await tapText(/^PLAY$/i);
  await p.waitForTimeout(1500);
  await p.getByText(/^KICK OFF$/i).first().click({ timeout: 6000 }).catch(() => {});
  // the commentary: let the clock run a while (speed up with the plate) so the radar has minutes
  await p.waitForFunction(() => window.__kibMatch && window.__kibMatch.phase === "feed", null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(6000);
  await shot("feed");
  const hasRadar = await p.evaluate(() => /\d+%/.test(document.body.innerText) && /[▶◀]/.test(document.body.innerText));
  console.log(`   commentary: radar ${mode === "radar" ? (hasRadar ? "drawn" : "NOT drawn") : "off (default)"}`);
  if (mode === "radar") ok(hasRadar, "the radar did not draw over the commentary");
  else ok(!(await p.evaluate(() => /\d+%\s*\d+%/.test(document.body.innerText))), "a radar showed with the setting off");
  if (mode === "radar") {
    // a few more minutes at speed: the ball moves, momentum bars grow
    for (let i = 0; i < 3; i++) { await tapText(/^\d+'$/, 5000).catch(() => {}); await p.waitForTimeout(500); }
    await p.waitForTimeout(5000);
    await shot("feed-later");
  }
  // to the pitch
  await tapText(/get out there/i, 90000);
  await p.waitForFunction(() => window.__kibMatch && window.__kibMatch.phase !== "feed", null, { timeout: 30000 }).catch(() => {});
  for (let t = 0; t < 40; t++) {
    if (/tap to skip/i.test(await p.evaluate(() => document.body.innerText))) { await p.getByText(/tap to skip/i).first().click({ timeout: 3000 }).catch(() => {}); break; }
    await p.waitForTimeout(250);
  }
  await p.waitForTimeout(2500);
  console.log(`   on the pitch: phase ${await phase()}, 3D ${JSON.stringify(await v3())}`);
  await shot("pitch-2d");
  const btn = (re) => p.getByText(re).first();
  ok(await btn(/^(2D|3D)$/).isVisible().catch(() => false), "no 3D | 2D button on the plate");
  if (mode === "view") {
    const t0 = Date.now();
    await tapText(/^2D$/); // a real touch on the plate's button turns the 3D on
    let s = null;
    for (let i = 0; i < 160; i++) { s = await v3(); if (s && s.status === "ready") break; await p.waitForTimeout(1000); }
    console.log(`   the 3D came up ${((Date.now() - t0) / 1000).toFixed(0)} s after the tap: ${JSON.stringify(s)}`);
    ok(s && s.status === "ready", "the 3D view did not get ready");
    await p.waitForTimeout(4000);
    console.log(`   after: phase ${await phase()}, 3D ${JSON.stringify(await v3())}`);
    await shot("pitch-3d");
    ok((await p.evaluate(() => Array.from(document.querySelectorAll("canvas")).length)) >= 2, "no GL canvas under the strike screen");
    // 3D -> 2D at once, mid-chance
    await tapText(/^3D$/);
    await p.waitForTimeout(800);
    await shot("pitch-back-2d");
    ok(await btn(/^2D$/).isVisible().catch(() => false), "the button did not say 2D after the switch");
    console.log(`   switched to 2D: ${JSON.stringify(await v3())}`);
    // and play on in 3D: tap it on, drag the ball, strike
    await tapText(/^2D$/);
    await p.waitForTimeout(5000);
    const ball = await p.evaluate(() => { const d = window.__kibMatch; return d && d.phase === "aim" ? { phase: d.phase } : { phase: d && d.phase }; });
    console.log(`   3D on again, match phase ${ball.phase}`);
    await shot("pitch-3d-again");
  }
  const noisy = errors.filter((l) => !/Failed to load resource|WEBGL_debug|GPU stall|ReadPixels|KHR_parallel|drawImage from a source/i.test(l));
  if (noisy.length) console.log("   messages:", Array.from(new Set(noisy)).slice(0, 8));
  await ctx.close();
}
await browser.close();
server.close?.();
console.log(failed ? `${failed} problem(s)` : "all good");
console.log(`pictures: ${OUT}`);
process.exit(failed ? 1 : 0);
