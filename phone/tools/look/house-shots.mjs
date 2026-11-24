// Opens your 3D house and the 3D phone in your hand in KIB Next's web build (phone/tools/look/out/web, made by
// build-web.mjs) in headless Chromium and takes stills with REAL touches (Chromium's touch events, as a finger).
//
//   node phone/tools/look/house-shots.mjs [--out DIR] [--sizes 412x915,360x780] [--web DIR] [--dpr 2] [--speed]
//
// It goes in every way the app does: the Garden's house door (stands at it, taps "Your house ›"); the wardrobe
// (a real tap on a set; the choice is saved on the career); the cabinet and the drive window; a doorway to another
// room; the front door out to the Garden (and the Shop then shows the casual clothes); the Phone tab (the hand, the
// real phone on the glass, the house loading behind it); a real tap on a phone app; BACK (the hand lowers, the house);
// the "📱 Phone" pill; "Your house" on the phone's grid; HOME. Same screens, host and scene as the phone
// (src/screens/world/House3D.tsx, HousePhone.tsx, src/three/Walk3D.tsx); only the GL comes from a <canvas>.
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
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "house-shots"));
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
career.ownedItems = [...(career.ownedItems ?? []), item("car-1", "Hatch", "vehicle"), item("watch-smart", "Smartwatch", "item"), item("house-1", "House", "property")];
career.money = 250000;
save[key] = JSON.stringify(career);

const server = await serve(WEB, 0);
const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log("   FAIL " + m); } };
for (const [W, H] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await ctx.addInitScript((kv) => {
    if (sessionStorage.getItem("seeded")) return;
    const speed = kv.__speed; delete kv.__speed;
    localStorage.clear();
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    // what a real Android phone gets on Auto (Medium); the headless browser's software GL would read as Low, which keeps the 3D phone off (as the website does)
    localStorage.setItem("star-3d-quality", "medium");
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
  const houseUp = (ms = 280000) => p.waitForFunction(() => window.__home3d, null, { timeout: ms });
  const stack = () => p.evaluate(() => window.__kibNav.stack.map((r) => r.name).join(" > "));
  const phone3d = () => p.evaluate(() => window.__phone3d ?? null);
  /** A real finger on the middle of some text. */
  const tapText = async (re, nth = 0) => {
    const box = await p.getByText(re).nth(nth).boundingBox().catch(() => null);
    if (!box) return false;
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    return true;
  };
  /** The way a player gets to a spot: find it on the screen, tap it with a real finger; he walks up and its card opens. */
  const tapSpot = async (spot) => {
    const at = await p.evaluate(([spot, W, H]) => {
      const c = window.__home3d;
      for (let y = 0.15; y < 0.85; y += 0.04) for (let x = 0.05; x < 0.95; x += 0.04) if (c.pick(W * x, H * y) === spot) return [W * x, H * y];
      return null;
    }, [spot, W, H]);
    if (!at) return false;
    await p.touchscreen.tap(at[0], at[1]);
    return true;
  };
  const textShown = (re) => p.getByText(re).first().isVisible().catch(() => false);
  /** Wait (software GL draws a frame or two a second) for some text to show; false if it never does. */
  const waitText = (re, ms = 60000) => p.getByText(re).first().waitFor({ state: "visible", timeout: ms }).then(() => true).catch(() => false);
  console.log(`\n== ${W}x${H} css at ${DPR}x`);
  const t0 = Date.now();
  await p.goto(server.url + "/", { waitUntil: "load", timeout: 120000 });
  await p.waitForTimeout(5000);
  const re = /^continue$/i;
  let cont = p.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (!(await cont.count())) cont = p.getByText(re).first();
  try { await cont.click({ timeout: 20000 }); } catch (e) { await shot("title"); console.log("   no Continue button:", errors.slice(0, 5)); throw e; }
  await p.waitForTimeout(4500);

  // ── 1. the Garden's house door: stand at it, tap "Your house ›" ──
  await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("garden"); });
  try { await p.waitForFunction(() => window.__garden3d, null, { timeout: 280000 }); } catch { ok(false, "the garden did not start"); await shot("failed-garden"); await ctx.close(); continue; }
  await p.waitForTimeout(3000);
  await p.evaluate(() => window.__garden3d.place(16.4, 6.6, Math.PI / 2));
  await p.waitForTimeout(4000);
  const card = p.getByText(/^Your house ›$/).first();
  try { await card.waitFor({ state: "visible", timeout: 60000 }); } catch { /* shown below */ }
  ok(await card.isVisible().catch(() => false), "standing at the garden's house door did not show its card");
  await shot("garden-house-door");
  const t1 = Date.now();
  await tapText(/^Your house ›$/);
  try { await houseUp(); } catch { console.log("   the 3D house did not come up in 280 s:", errors.slice(0, 6)); await shot("failed-house"); ok(false, "the 3D house did not start from the garden's door"); await ctx.close(); continue; }
  console.log(`   garden door -> 3D house up after ${((Date.now() - t1) / 1000).toFixed(1)} s (page ${((Date.now() - t0) / 1000).toFixed(0)} s); stack ${await stack()}`);
  await p.waitForTimeout(5000);
  const where0 = await p.evaluate(() => ({ room: window.__home3d.room(), rooms: window.__home3d.rooms().map((r) => r.id), stats: window.__home3d.stats() }));
  console.log(`   opened in the ${where0.room}; rooms ${where0.rooms.join(", ")}; ${where0.stats.calls} draws (last pass), ${(where0.stats.triangles / 1000).toFixed(0)}k tris, tier ${where0.stats.quality}`);
  await shot("house-in");
  ok(/garden > house$/.test(await stack()), "the house did not open on top of the garden");

  // ── 2. the wardrobe: a real tap on a set; it is saved on the career ──
  await p.evaluate(async () => { const c = window.__home3d; for (const id of c.rooms().map((r) => r.id)) { if (id === "bedroom" || id === "dressing" || id === "main") { await c.goToRoom(id); return; } } });
  await p.waitForTimeout(4000);
  const shown = await tapSpot("wardrobe");
  console.log(`   wardrobe: found on screen and tapped with a finger: ${shown}`);
  ok(shown, "the wardrobe is not in the picture to tap");
  ok(await waitText(/^Clothes$/), "the wardrobe's card did not open");
  await shot("wardrobe-card");
  await tapText(/^Club tracksuit$/);
  await p.waitForTimeout(7000);
  await shot("wardrobe-tracksuit");
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("knowitball-career\\career-v2")).outfit);
  console.log(`   saved outfit: ${JSON.stringify(saved)}`);
  ok(saved && saved.wear === "casual" && saved.casual === "tracksuit", "the wardrobe's choice was not saved on the career");
  await tapText(/^Kits$/);
  await p.waitForTimeout(1200);
  await tapText(/^Away kit$/);
  await p.waitForTimeout(6000);
  await shot("wardrobe-away-kit");
  await tapText(/^Clothes$/);
  await p.waitForTimeout(1000);
  await tapText(/^Hoodie$/);
  await p.waitForTimeout(6000);
  await p.getByText("✕").first().click().catch(() => {});
  await p.waitForTimeout(800);

  // ── 3. the cabinet and the drive window ──
  for (const [spot, name, re2] of [["cabinet", "cabinet-card", /Trophy cabinet/i], ["drive", "drive-card", /Your cars/i]]) {
    let rid = null;
    for (const r of await p.evaluate(() => window.__home3d.rooms().map((x) => x.id))) {
      await p.evaluate((id) => window.__home3d.goToRoom(id), r);
      await p.waitForTimeout(3500);
      if (await tapSpot(spot)) { rid = r; break; }
    }
    console.log(`   ${spot}: found in the ${rid}`);
    ok(!!rid || spot === "drive", `no ${spot} in the picture of any room`); // the drive window is not always in the picture of a room: its card is also checked by tools/walk-check.ts --living off
    if (rid) ok(await waitText(re2), `the ${spot}'s card did not open`);
    await shot(name);
    await p.getByText("✕").first().click().catch(() => {});
    await p.waitForTimeout(800);
  }
  // a room dot (a doorway's twin)
  await p.evaluate(() => window.__home3d.goToRoom(window.__home3d.rooms()[0].id));
  await p.waitForTimeout(4000);
  await shot("first-room");

  // ── 4. real touches: the stick, a tap on the floor, a drag to look round ──
  {
    const a = await p.evaluate(() => window.__home3d.where());
    const cx = 22 + 66, cy = H - Math.max(28, 16) - 66;
    await touch("touchStart", [[cx, cy]]);
    for (let i = 1; i <= 6; i++) { await touch("touchMove", [[cx, cy - i * 9]]); await p.waitForTimeout(60); }
    await p.waitForTimeout(5000);
    const b = await p.evaluate(() => window.__home3d.where());
    await touch("touchEnd", []);
    const moved = Math.hypot(b.x - a.x, b.z - a.z);
    console.log(`   touch: stick pushed up for 5 s moved him ${moved.toFixed(2)} m`);
    ok(moved > 0.2, "a finger on the stick did not walk him");
    await p.touchscreen.tap(W * 0.5, H * 0.45);
    await p.waitForTimeout(3500);
    const c = await p.evaluate(() => window.__home3d.where());
    console.log(`   touch: a tap on the floor: he is at ${c.x.toFixed(1)}, ${c.z.toFixed(1)}`);
    await touch("touchStart", [[W * 0.7, H * 0.4]]);
    for (let i = 1; i <= 8; i++) { await touch("touchMove", [[W * 0.7 - i * 14, H * 0.4]]); await p.waitForTimeout(50); }
    await touch("touchEnd", []);
    await p.waitForTimeout(1500);
    await shot("after-touches");
  }

  // ── 5. the front door out to the Garden; the shop then shows the casual clothes ──
  const fd = await p.evaluate(async () => {
    const c = window.__home3d;
    for (const r of c.rooms()) {
      await c.goToRoom(r.id);
      await new Promise((res) => setTimeout(res, 1500));
      const d = c.plan().doors?.find((x) => x.to === "garden");
      if (d) { c.place(d.x + d.nx * 1.6, d.z + d.nz * 1.6, Math.atan2(-d.nx, -d.nz)); return { room: r.id }; }
    }
    return null;
  });
  console.log(`   the front door: ${fd ? `in the ${fd.room}` : "not found"}`);
  ok(!!fd, "no front door in any room");
  await p.waitForTimeout(2500);
  {
    // walk out of it with a real finger on the stick
    const cx = 22 + 66, cy = H - Math.max(28, 16) - 66;
    await touch("touchStart", [[cx, cy]]);
    for (let i = 1; i <= 6; i++) { await touch("touchMove", [[cx, cy - i * 9]]); await p.waitForTimeout(60); }
    await p.waitForTimeout(12000);
    await touch("touchEnd", []);
  }
  await p.waitForTimeout(3000);
  const out = await stack();
  console.log(`   walked out of the front door: stack ${out}`);
  ok(/garden$/.test(out) && !/house/.test(out), "the front door did not lead out to the Garden");
  try { await p.waitForFunction(() => window.__garden3d, null, { timeout: 200000 }); await p.waitForTimeout(4000); await shot("garden-after-house"); } catch { ok(false, "the garden did not reopen after the house"); }
  const gw = await p.evaluate(() => window.__garden3d.where());
  console.log(`   back in the garden at ${gw.x.toFixed(1)}, ${gw.z.toFixed(1)} (the house door is at x 18, z 6.6)`);
  ok(gw.x > 14, "he did not step out at the house's door");

  // ── 6. the Phone tab: the hand, the real phone on the glass, the house loading behind it ──
  await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("phone"); delete window.__home3d; delete window.__phone3d; });
  await p.waitForTimeout(900);
  await shot("phone-opening");
  await p.waitForTimeout(1800);
  const ph0 = await phone3d();
  console.log(`   Phone tab: ${JSON.stringify(ph0)}`);
  ok(ph0 && ph0.scene === "phone", "the 3D phone is not up after 2.7 s");
  await shot("phone-up");
  // a real tap on an app (the glass is turned and scaled: the finger must still land on the right app)
  const tSquad = await tapText(/^Squad$/);
  await p.waitForTimeout(2000);
  const inSquad = await textShown(/NAME/);
  console.log(`   a real tap on Squad: ${tSquad ? (inSquad ? "the Squad app opened" : "did NOT open") : "no Squad icon found"}`);
  ok(inSquad, "a real tap on the Squad icon did not open the Squad app on the glass");
  await shot("phone-squad");
  // BACK inside an app returns to the grid, not out of the phone
  await tapText(/^BACK$/);
  await p.waitForTimeout(1500);
  ok(!(await textShown(/NAME/)), "BACK inside an app did not return to the phone's home screen");
  // the house loads behind (after 2.5 s, in idle time)
  try { await houseUp(120000); } catch { ok(false, "the house did not load behind the phone"); }
  await p.waitForTimeout(3500);
  const ph1 = await phone3d();
  console.log(`   house behind the phone: ${JSON.stringify(ph1)}`);
  ok(ph1 && ph1.houseReady, "the house is not ready behind the phone");
  await shot("phone-house-behind");

  // ── 7. BACK on the phone's home screen: the hand lowers, the camera eases out; the pill takes it out again ──
  await tapText(/^BACK$/);
  await p.waitForTimeout(500);
  await shot("phone-putting-away");
  await p.waitForTimeout(2500);
  const ph2 = await phone3d();
  console.log(`   BACK: ${JSON.stringify(ph2)}`);
  ok(ph2 && ph2.scene === "away", "BACK did not put the phone away");
  await shot("phone-away-house");
  ok(await textShown(/Phone/), "no Phone pill in the house");
  await tapText(/📱 Phone/);
  await p.waitForTimeout(450);
  await shot("phone-taking-out");
  await p.waitForTimeout(1800);
  const ph3 = await phone3d();
  console.log(`   Phone pill: ${JSON.stringify(ph3)}`);
  ok(ph3 && ph3.scene === "phone", "the Phone pill did not bring the phone up");
  await shot("phone-up-again");

  // ── 8. "Your house" on the phone's grid puts it away into the house; HOME on the grid goes Home ──
  const th = await tapText(/^Your house$/);
  await p.waitForTimeout(3500);
  const ph4 = await phone3d();
  console.log(`   Your house app: ${th ? "tapped" : "no icon"} ${JSON.stringify(ph4)}`);
  ok(th && ph4 && ph4.scene === "away", "the phone's Your house app did not put the phone away into the house");
  await tapText(/📱 Phone/);
  await p.waitForTimeout(2500);
  await tapText(/^HOME$/);
  await p.waitForTimeout(2500);
  const st = await stack();
  console.log(`   HOME: stack ${st}`);
  ok(!/phone|house/.test(st), "HOME on the phone did not leave for the Home screen");
  await shot("after-home");

  // ── 9. no GL canvas is left behind ──
  await p.evaluate(() => { const n = window.__kibNav; n.home(); n.go("shop"); });
  await p.waitForTimeout(4000);
  const gl = await p.evaluate(() => Array.from(document.querySelectorAll("canvas")).filter((c) => c.width > innerWidth).length);
  console.log(`   big GL canvases left in the page: ${gl}`);
  ok(gl === 0, "a GL view stayed after leaving the house and phone");
  const bad = errors.filter((e) => !/KHR_parallel_shader_compile|GPU stall|WEBGL_debug|Failed to load resource|deprecated|HALF_FLOAT/i.test(e));
  if (bad.length) console.log("   messages:\n   " + Array.from(new Set(bad)).slice(0, 12).join("\n   "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(`\npictures: ${OUT}/<name>-<size>.jpg`);
console.log(failed ? `${failed} problem(s)` : "all good");
process.exit(failed ? 1 : 0);
