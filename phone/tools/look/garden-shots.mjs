// Opens the 3D Garden in KIB Next's web build (phone/tools/look/out/web, made by build-web.mjs) in
// headless Chromium and takes a still at each spot, with the scene's own numbers.
//
//   node phone/tools/look/garden-shots.mjs [--out DIR] [--sizes 412x915,360x780] [--web DIR] [--dpr 2] [--speed]
//
// The career is the look check's (make-save.mts) with a horse, three cars and some trophies added,
// so the garden has something in every corner. The web build runs the SAME screen, host and scene as
// the phone (src/screens/world/Garden.tsx, src/three/Walk3D.tsx); only the GL comes from a <canvas>
// (expo-gl's web view) and the page keeps its own `document`. Software GL: read speed as relative.
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
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "garden-shots"));
const WEB = arg("--web", path.join(HERE, "out/web"));
const SIZES = arg("--sizes", "412x915,360x780").split(",").map((s) => s.split("x").map(Number));
const DPR = Number(arg("--dpr", "2"));
const SPEED = args.includes("--speed");
const SKY = arg("--sky", "");
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
const career = JSON.parse(save[key]);
const item = (id, name, category) => ({ id, name, category, price: 1000, lifestyleValue: 10, level: 1 });
career.ownedItems = [...(career.ownedItems ?? []), item("car-1", "Hatch", "vehicle"), item("car-2", "Saloon", "vehicle"), item("car-classic", "Classic", "vehicle"), item("stable", "Stable", "property"), item("house-1", "House", "property")];
career.horse = { name: "Comet", breed: "Thoroughbred", speed: 78, stamina: 64, energy: 100, racesRun: 12, racesWon: 5, earnings: 40000 };
career.trophies = [{ season: 1, competition: "Premier League", club: "Arsenal" }, { season: 2, competition: "Premier League", club: "Arsenal" }, { season: 2, competition: "FA Cup", club: "Arsenal" }, { season: 3, competition: "Champions League", club: "Arsenal" }];
career.ballonDorWins = 1;
save[key] = JSON.stringify(career);

const server = await serve(WEB, 0);
const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const spots = [
  { name: "gate", at: [0, 15.5, Math.PI] },
  { name: "fountain", at: [0, 0.8, Math.PI], want: "fountain" },
  { name: "horse", at: [-5.6, 6.5, -Math.PI / 2], want: "horse" },
  { name: "cars", at: [9.5, 9.6, 0], want: "cars" },
  { name: "shop", at: [0, -7.9, 0], want: "shop" },
  { name: "trophies", at: [-5.4, -5.8, -Math.PI / 2], want: "trophies" },
  { name: "mates", at: [8.2, 2.2, Math.PI / 2], want: "mates" },
];
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log("   FAIL " + m); } };
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
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  p.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(server.url, "")}`); });
  console.log(`\n== ${W}x${H} css at ${DPR}x`);
  const t0 = Date.now();
  await p.goto(server.url + "/", { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(5000);
  // Continue on the title loads the career and its squads (as on the phone), then the Garden opens as the Phone's icon does
  const re = /^continue$/i;
  let cont = p.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (!(await cont.count())) cont = p.getByText(re).first();
  try { await cont.click({ timeout: 20000 }); } catch (e) {
    await p.screenshot({ path: path.join(OUT, `title-${W}x${H}.jpg`), type: "jpeg", quality: 70 });
    console.log("   no Continue button:", errors.slice(0, 5));
    throw e;
  }
  await p.waitForTimeout(4500);
  await p.evaluate((sky) => { const n = window.__kibNav; n.home(); n.go("garden", sky ? { sky } : undefined); }, SKY);
  try {
    await p.waitForFunction(() => window.__garden3d, null, { timeout: 280000 });
  } catch {
    console.log("   the garden did not come up in 280 s");
    console.log("   " + errors.slice(0, 8).join("\n   "));
    await p.screenshot({ path: path.join(OUT, `failed-${W}x${H}.jpg`), type: "jpeg", quality: 80 });
    ok(false, "the garden did not start");
    await ctx.close();
    continue;
  }
  console.log(`   up after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await p.waitForTimeout(4000);
  for (const s of spots) {
    await p.evaluate(([x, z, yaw]) => window.__garden3d.place(x, z, yaw), s.at);
    await p.waitForTimeout(2500);
    const st = await p.evaluate(() => ({ s: window.__garden3d.stats(), w: window.__garden3d.where() }));
    console.log(`   ${s.name.padEnd(9)} ${st.s.calls} draws, ${(st.s.triangles / 1000).toFixed(0)}k tris, pixel ratio ${st.s.pixelRatio}, tier ${st.s.quality ?? "?"}`);
    await p.screenshot({ path: path.join(OUT, `${s.name}-${W}x${H}.jpg`), type: "jpeg", quality: 82 });
  }
  // real touches (Chromium's touch events, as a finger): the stick, a tap on the ground, a drag to look round, then Back
  {
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    await p.evaluate(() => window.__garden3d.place(0, 15.5, Math.PI));
    await p.waitForTimeout(1500);
    const w0 = await p.evaluate(() => window.__garden3d.where());
    const cx = 22 + 66, cy = H - Math.max(28, 16) - 66;
    await touch("touchStart", [[cx, cy]]);
    for (let i = 1; i <= 6; i++) { await touch("touchMove", [[cx, cy - i * 9]]); await p.waitForTimeout(60); }
    await p.waitForTimeout(6000);
    const w1 = await p.evaluate(() => window.__garden3d.where());
    await touch("touchEnd", []);
    const moved = Math.hypot(w1.x - w0.x, w1.z - w0.z);
    console.log(`   touch: stick pushed up for 6 s moved him ${moved.toFixed(2)} m`);
    ok(moved > 0.3, "a finger on the stick did not walk him");
    await p.waitForTimeout(800);
    await p.evaluate(() => window.__garden3d.place(0, 15.5, Math.PI));
    await p.waitForTimeout(1500);
    await p.evaluate(() => { const c = window.__garden3d, t = c.tap.bind(c); window.__tapLog = []; c.tap = (x, y) => { const r = t(x, y); window.__tapLog.push([Math.round(x), Math.round(y), r]); return r; }; });
    await p.touchscreen.tap(W * 0.5, H * 0.3);
    await p.waitForTimeout(2500);
    const walk = await p.evaluate(() => window.__garden3d.walking());
    console.log(`   touch: a tap on the ground: walking=${JSON.stringify(walk)} calls=${JSON.stringify(await p.evaluate(() => window.__tapLog))}`);
    ok(walk && (walk.active || walk.to), "a tap did not start a walk");
    const yaw0 = (await p.evaluate(() => window.__garden3d.where())).cam;
    await touch("touchStart", [[W * 0.7, H * 0.4]]);
    for (let i = 1; i <= 8; i++) { await touch("touchMove", [[W * 0.7 - i * 14, H * 0.4]]); await p.waitForTimeout(50); }
    await touch("touchEnd", []);
    await p.waitForTimeout(1500);
    const yaw1 = (await p.evaluate(() => window.__garden3d.where())).cam;
    console.log(`   touch: a drag to look round: camera ${JSON.stringify(yaw0?.map((n) => +n.toFixed(2)))} -> ${JSON.stringify(yaw1?.map((n) => +n.toFixed(2)))}`);
    ok(JSON.stringify(yaw0) !== JSON.stringify(yaw1), "a drag did not turn the view");
    await p.getByText(/^Back$/).first().click();
    await p.waitForTimeout(2500);
    const left = await p.evaluate(() => ({ gl: Array.from(document.querySelectorAll("canvas")).filter((c) => c.width === Math.round(innerWidth * 1.5 * (window.devicePixelRatio === 1 ? 1 : 1))).length, doc: typeof document, dpr: window.devicePixelRatio }));
    console.log(`   Back: big GL canvases still in the page: ${left.gl}, devicePixelRatio ${left.dpr}`);
    ok(left.gl === 0, "the garden's GL view stayed after Back");
  }
  const bad = errors.filter((e) => !/KHR_parallel_shader_compile|GPU stall|WEBGL_debug|Failed to load resource|deprecated/i.test(e));
  if (bad.length) console.log("   messages:\n   " + Array.from(new Set(bad)).slice(0, 10).join("\n   "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} problem(s)` : "\nall good");
process.exit(failed ? 1 : 0);
