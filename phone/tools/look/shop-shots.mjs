// Opens the 3D Shop in KIB Next's web build (phone/tools/look/out/web, made by build-web.mjs) in
// headless Chromium and takes stills with REAL touches (Chromium's touch events, as a finger).
//
//   node phone/tools/look/shop-shots.mjs [--out DIR] [--sizes 412x915,360x780] [--web DIR] [--dpr 2] [--speed]
//
// It goes in every way the app does: the Garden's shop door (stands at it, taps "Shop ›"), the Shop's
// big "3D" button; walks to every display; opens a card by a real tap on an item; "See it in the
// shop" (must land on that item's sheet in the app's own Shop); the doorway out to the Garden; Back.
// Same screen, host and scene as the phone (src/screens/world/Shop3D.tsx, src/three/Walk3D.tsx); only
// the GL comes from a <canvas> (expo-gl's web view). Software GL: read speed as relative.
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
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "shop-shots"));
const WEB = arg("--web", path.join(HERE, "out/web"));
const SIZES = arg("--sizes", "412x915,360x780").split(",").map((s) => s.split("x").map(Number));
const DPR = Number(arg("--dpr", "2"));
const SPEED = args.includes("--speed");
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
career.ownedItems = [...(career.ownedItems ?? []), item("car-1", "Hatch", "vehicle"), item("watch-smart", "Smartwatch", "item")];
career.money = 250000;
save[key] = JSON.stringify(career);

const server = await serve(WEB, 0);
const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
// where to stand (x, z, facing yaw): facing 0 is +z (the doors), PI is -z (the back wall), PI/2 is +x, -PI/2 is -x
const spots = [
  { name: "start", at: [-0.5, 3.7, Math.PI] },
  { name: "boots", at: [-3.2, 0, -Math.PI / 2], want: "boots" },
  { name: "car", at: [2.35, 1.6, Math.PI], want: "car" },
  { name: "cans", at: [3.9, 4.3, Math.PI / 2], want: "cans" },
  { name: "counter", at: [-1.2, -4.95, Math.PI], want: "counter" },
  { name: "homes", at: [2.7, 5.2, 0], want: "homes" },
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
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const shot = (name) => p.screenshot({ path: path.join(OUT, `${name}-${W}x${H}.jpg`), type: "jpeg", quality: 82 });
  const shopUp = (ms = 280000) => p.waitForFunction(() => window.__shop3d, null, { timeout: ms });
  const textShown = (re) => p.getByText(re).first().isVisible().catch(() => false);
  console.log(`\n== ${W}x${H} css at ${DPR}x`);
  const t0 = Date.now();
  await p.goto(server.url + "/", { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(5000);
  const re = /^continue$/i;
  let cont = p.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (!(await cont.count())) cont = p.getByText(re).first();
  try { await cont.click({ timeout: 20000 }); } catch (e) {
    await shot("title");
    console.log("   no Continue button:", errors.slice(0, 5));
    throw e;
  }
  await p.waitForTimeout(4500);

  // ── 1. in through the Garden's shop door: stand at it, tap "Shop ›" ──
  await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("garden"); });
  try { await p.waitForFunction(() => window.__garden3d, null, { timeout: 280000 }); } catch { ok(false, "the garden did not start"); await shot("failed-garden"); await ctx.close(); continue; }
  await p.waitForTimeout(3000);
  await p.evaluate(() => window.__garden3d.place(0, -7.9, 0));
  await p.waitForTimeout(4000);
  const shopCard = p.getByText(/^Shop ›$/).first();
  try { await shopCard.waitFor({ state: "visible", timeout: 60000 }); } catch { /* shown below */ }
  ok(await shopCard.isVisible().catch(() => false), "standing at the garden's shop door did not show its card");
  await shot("garden-door");
  const t1 = Date.now();
  await shopCard.click();
  try { await shopUp(); } catch { console.log("   the 3D shop did not come up in 280 s:", errors.slice(0, 6)); await shot("failed-shop"); ok(false, "the 3D shop did not start from the garden's door"); await ctx.close(); continue; }
  console.log(`   garden door -> 3D shop up after ${((Date.now() - t1) / 1000).toFixed(1)} s (page ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  await p.waitForTimeout(5000);
  const w0 = await p.evaluate(() => window.__shop3d.where());
  console.log(`   stepped in at ${w0.x.toFixed(1)}, ${w0.z.toFixed(1)} (the doors are at z 8): ${w0.z > 3 ? "at the doors" : "NOT at the doors"}`);
  ok(w0.z > 3, "from the garden he did not step in at the doors");
  await shot("in-from-garden");

  // ── 2. every display: stand there, the card opens by itself ──
  for (const s of spots) {
    await p.evaluate(([x, z, yaw]) => window.__shop3d.place(x, z, yaw), s.at);
    await p.waitForTimeout(s.want ? 9000 : 4000);
    const st = await p.evaluate(() => ({ s: window.__shop3d.stats(), w: window.__shop3d.where() }));
    const card = s.want ? await textShown(/See it in the shop/) : false;
    console.log(`   ${s.name.padEnd(8)} ${st.s.calls} draws (last pass), ${(st.s.triangles / 1000).toFixed(0)}k tris, pixel ratio ${st.s.pixelRatio}, tier ${st.s.quality ?? "?"}${s.want ? `, card ${card ? "open" : "NOT open"}` : ""}`);
    if (s.want) ok(card, `standing at the ${s.name} did not open its card`);
    await shot(s.name);
    if (card) { await p.getByText("✕").first().click().catch(() => {}); await p.waitForTimeout(800); }
  }

  // ── 3. real touches: the stick, a tap on the floor, a drag to look round ──
  await p.evaluate(() => window.__shop3d.place(-0.5, 3.7, Math.PI));
  await p.waitForTimeout(3000);
  {
    const a = await p.evaluate(() => window.__shop3d.where());
    const cx = 22 + 66, cy = H - Math.max(28, 16) - 66;
    await touch("touchStart", [[cx, cy]]);
    for (let i = 1; i <= 6; i++) { await touch("touchMove", [[cx, cy - i * 9]]); await p.waitForTimeout(60); }
    await p.waitForTimeout(5000);
    const b = await p.evaluate(() => window.__shop3d.where());
    await touch("touchEnd", []);
    const moved = Math.hypot(b.x - a.x, b.z - a.z);
    console.log(`   touch: stick pushed up for 5 s moved him ${moved.toFixed(2)} m`);
    ok(moved > 0.2, "a finger on the stick did not walk him");
    await p.waitForTimeout(500);
    await p.evaluate(() => window.__shop3d.place(-0.5, 3.7, Math.PI));
    await p.waitForTimeout(3000);
    await p.touchscreen.tap(W * 0.5, H * 0.25);
    await p.waitForTimeout(3500);
    const walk = await p.evaluate(() => window.__shop3d.walking());
    console.log(`   touch: a tap on the floor: walking=${JSON.stringify(walk)}`);
    ok(walk && (walk.active || walk.to), "a tap on the floor did not start a walk");
    const c0 = (await p.evaluate(() => window.__shop3d.where())).camYaw;
    await touch("touchStart", [[W * 0.7, H * 0.4]]);
    for (let i = 1; i <= 8; i++) { await touch("touchMove", [[W * 0.7 - i * 14, H * 0.4]]); await p.waitForTimeout(50); }
    await touch("touchEnd", []);
    await p.waitForTimeout(1500);
    const c1 = (await p.evaluate(() => window.__shop3d.where())).camYaw;
    console.log(`   touch: a drag to look round: camera yaw ${c0?.toFixed?.(2)} -> ${c1?.toFixed?.(2)}`);
    ok(c0 !== c1, "a drag did not turn the view");
  }

  // ── 4. a real tap on an item opens its card; "See it in the shop" lands on that item in the app's Shop ──
  await p.evaluate(() => window.__shop3d.place(2.35, 3.2, Math.PI));
  await p.waitForTimeout(6000);
  // find where the turntable shows on screen: a pick on a grid of points, the first that is the car
  const hit = await p.evaluate(([W, H]) => {
    for (let y = 0.2; y < 0.8; y += 0.05) for (let x = 0.1; x < 0.9; x += 0.05) { const r = window.__shop3d.pick(W * x, H * y); if (r && r.display === "car") return [W * x, H * y]; }
    return null;
  }, [W, H]);
  console.log(`   a tap target on the cars: ${JSON.stringify(hit)}`);
  if (hit) {
    await p.touchscreen.tap(hit[0], hit[1]);
    await p.waitForTimeout(9000);
    let card = await textShown(/See it in the shop/);
    if (!card) { await p.touchscreen.tap(hit[0], hit[1]); await p.waitForTimeout(9000); card = await textShown(/See it in the shop/); }
    console.log(`   touch: a tap on the car: ${card ? "its card opened" : "no card"}`);
    ok(card, "a tap on the car did not open its card");
    await shot("tap-car-card");
    if (card) {
      await p.getByText("See it in the shop ›").first().click();
      await p.waitForTimeout(6000);
      await shot("shop-from-3d");
      const bought = await textShown(/^Buy\b|Buy ·|Level|Owned|Cars/i);
      console.log(`   See it in the shop: the Shop opened${bought ? " with text of the item" : " (no item text found)"}`);
      const left = await p.evaluate(() => !window.__kibNav ? "?" : window.__kibNav.stack.map((r) => r.name).join(" > "));
      console.log(`   screen stack now: ${left}`);
      ok(/shop$/.test(left) && !/shop-3d/.test(left), "See it in the shop did not leave the Shop on top");
      // back to the Garden (the stack under it)
      await p.getByText(/^Back$|‹/).first().click().catch(() => {});
      await p.waitForTimeout(3000);
    }
  }

  // ── 5. the Shop's own big 3D button opens the 3D shop (Back returns to the Shop) ──
  await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("shop"); });
  await p.waitForTimeout(4000);
  await shot("shop-2d-bar");
  const btn = p.getByText(/^3D$/).first();
  ok(await btn.isVisible().catch(() => false), "the Shop has no big 3D button");
  await p.evaluate(() => { delete window.__shop3d; });
  await btn.click().catch(() => {});
  try { await shopUp(); ok(true, ""); } catch { ok(false, "the Shop's 3D button did not open the 3D shop"); await shot("failed-3d-button"); }
  await p.waitForTimeout(5000);
  const w1 = await p.evaluate(() => window.__shop3d?.where());
  console.log(`   from the Shop's 3D button: starts at ${w1 ? `${w1.x.toFixed(1)}, ${w1.z.toFixed(1)}` : "?"} (not at the doors)`);
  ok(w1 && w1.z < 6, "from the Shop's button he should start in the room, not at the doors");

  // ── 6. the doorway: walk out into the Garden ──
  await p.evaluate(() => window.__shop3d.place(0, 7.0, 0));
  await p.waitForTimeout(2500);
  {
    const cx = 22 + 66, cy = H - Math.max(28, 16) - 66;
    await touch("touchStart", [[cx, cy]]);
    for (let i = 1; i <= 6; i++) { await touch("touchMove", [[cx, cy - i * 9]]); await p.waitForTimeout(60); }
    await p.waitForTimeout(9000);
    await touch("touchEnd", []);
  }
  const outStack = await p.evaluate(() => window.__kibNav.stack.map((r) => r.name).join(" > "));
  console.log(`   walked out the doorway: stack ${outStack}`);
  ok(/garden$/.test(outStack), "the doorway did not lead out to the Garden");
  try { await p.waitForFunction(() => window.__garden3d, null, { timeout: 200000 }); await p.waitForTimeout(4000); await shot("out-in-garden"); } catch { ok(false, "the garden did not open after the doorway"); }

  // ── 7. Back from the 3D shop goes to where it came from; no GL canvas is left behind ──
  await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("shop"); n.go("shop-3d", { from: "shop" }); delete window.__shop3d; });
  try { await shopUp(); } catch { ok(false, "the 3D shop did not open for the Back check"); }
  await p.waitForTimeout(4000);
  await p.getByText(/^Shop$/).first().click().catch(() => {});
  await p.waitForTimeout(3000);
  const afterBack = await p.evaluate(() => ({ stack: window.__kibNav.stack.map((r) => r.name).join(" > "), gl: Array.from(document.querySelectorAll("canvas")).filter((c) => c.width > innerWidth).length, dpr: window.devicePixelRatio }));
  console.log(`   Back: stack ${afterBack.stack}; big GL canvases left in the page: ${afterBack.gl}; devicePixelRatio ${afterBack.dpr}`);
  ok(/shop$/.test(afterBack.stack) && !/shop-3d/.test(afterBack.stack), "Back did not return to the Shop");
  ok(afterBack.gl === 0, "the shop's GL view stayed after Back");
  const bad = errors.filter((e) => !/KHR_parallel_shader_compile|GPU stall|WEBGL_debug|Failed to load resource|deprecated/i.test(e));
  if (bad.length) console.log("   messages:\n   " + Array.from(new Set(bad)).slice(0, 12).join("\n   "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(`\npictures: ${OUT}/<name>-<size>.jpg`);
console.log(failed ? `${failed} problem(s)` : "all good");
process.exit(failed ? 1 : 0);
