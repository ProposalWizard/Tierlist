/**
 * FILM: camera D, the walking camera, in each 3D area (Harry, 20 Nov 2026: "D is good and
 * should be the base for all 3D areas"; it went into the real game the same day).
 *
 *   node scripts/film/scenes/follow-cam-d.mjs <port> <house|garden|shop|casino> <outDir>
 *
 * Frame by frame on the virtual clock (../vclock.mjs), phone size (390x844 at 2x = 780x1688):
 * a walk with a zoom out and back in (pinch = the mouse wheel here); the house walks
 * through a doorway and turns straight back towards it (where the camera used to jam on
 * his head). Writes <outDir>/<area>.mp4, <area>-strip.jpg (every 0.5 s) and <area>.json:
 * the camera's distance from his head every frame (nearest, median).
 * Test only: needs a dev server started with the offline test env, never Vercel's.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { installVClock, vStart, vCapture, vStep, vLog, encode } from "../vclock.mjs";

const [PORT = "3200", AREA = "house", OUT = "/tmp/camD"] = process.argv.slice(2);
const FPS = 30;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(path.join(OUT, `${AREA}-frames`), { recursive: true, force: true });
const PAGES = {
  house: { url: "/star-home3d-dev?bare=1&tier=house", ctrl: "__home3d" },
  garden: { url: "/star-garden3d-dev?bare=1", ctrl: "__garden3d" },
  shop: { url: "/star-shop3d-dev?bare=1&door=1", ctrl: "__shop3d" },
  casino: { url: "/star-garden3d-dev?bare=1&place=casino", ctrl: "__casino3d" },
};
const P = PAGES[AREA];
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await installVClock(ctx, { fps: FPS });
await ctx.addInitScript(() => { try { localStorage.setItem("kib-3d-follow-zoom", "0"); localStorage.setItem("kib-cookie-consent", "no"); } catch { /* */ } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}${P.url}`, { waitUntil: "domcontentloaded", timeout: 300000 });
for (let i = 0; i < 400; i++) { if (await page.evaluate((k) => !!window[k], P.ctrl)) break; await wait(1000); }
if (!(await page.evaluate((k) => !!window[k], P.ctrl))) { console.error("no controller", errors); process.exit(1); }
await wait(4000);
await vStart(page, { scale: 2 });

const ctl = (fn, arg) => page.evaluate(([k, src, a]) => new Function("c", "a", src)(window[k], a), [P.ctrl, fn, arg]);
const stick = (x, y) => ctl("c.setStick(a[0], a[1])", [x, y]);
const wheel = async (dy, n = 3) => { for (let i = 0; i < n; i++) { await page.mouse.move(195, 520); await page.mouse.wheel(0, dy); await vStep(page, 3); } };
// where his head is and where the camera is (every area's controller has one or the other)
const probe = `(() => { const c = window[${JSON.stringify(P.ctrl)}]; if (!c) return null;
  const w = c.where(); const cam = c.cameraPose ? c.cameraPose().pos : w.cam; if (!cam) return null;
  return { d: +Math.hypot(cam[0] - w.x, cam[1] - 1.6, cam[2] - w.z).toFixed(3), flat: +Math.hypot(cam[0] - w.x, cam[2] - w.z).toFixed(3), room: c.room ? c.room() : null, x: +w.x.toFixed(2), z: +w.z.toFixed(2) }; })()`;

const marks = [];
const mark = (what) => marks.push({ what, s: +(vLogLen() / FPS).toFixed(2) });
let frames = 0;
const vLogLen = () => frames;
const step = async (n) => { await vStep(page, n); frames += n; };

if (AREA === "house") {
  // stand 1.4 m before a door to another room, facing it (clear of the plants beside doors)
  const plan = await ctl("return c.plan()");
  const d = plan.doors.find((x) => x.to !== "garden") ?? plan.doors[0];
  const w2 = plan.w / 2, d2 = plan.d / 2;
  const B = 1.4;
  const at = d.wall === "s" ? [d.x, d2 - B, 0] : d.wall === "n" ? [d.x, -d2 + B, Math.PI] : d.wall === "e" ? [w2 - B, d.z, Math.PI / 2] : [-w2 + B, d.z, -Math.PI / 2];
  await ctl("c.place(a[0], a[1], a[2])", at);
  await vStep(page, 20);
  console.log("door", d, "from", plan.room);
}
await vStep(page, 10);
await vCapture(page, path.join(OUT, `${AREA}-frames`), { probe });
mark("walk");
if (AREA === "house") {
  const room0 = await ctl("return c.room()");
  await stick(0, 0.85);
  for (let i = 0; i < 150 && (await ctl("return c.room()")) === room0; i++) await step(1);
  mark("through the door");
  await step(8); await stick(0, 0.85); await step(22); // (a doorway stops the stick: push it again)
  await stick(0, 0); await step(8);
  mark("turn back to the door");
  await stick(0, -0.85); await step(36);
  await stick(0, 0); await step(10);
} else {
  await stick(0, 0.85); await step(45);
  mark("turn round");
  await stick(0.9, -0.3); await step(30);
  await stick(0, 0.85); await step(20);
  await stick(0, 0); await step(6);
}
mark("zoom out");
await wheel(220, 4); frames += 12;
await stick(0.55, 0.6); await step(36);
await stick(0, 0); await step(6);
mark("zoom in");
await wheel(-220, 4); frames += 12;
await stick(-0.4, 0.7); await step(24);
await stick(0, 0); await step(10);
const log = vLog(page).filter(Boolean); // (read before the capture stops: stopping clears it)
await vCapture(page, null);
const ds = log.map((l) => l.d).sort((a, b) => a - b);
const res = { area: AREA, frames: log.length, seconds: +(log.length / FPS).toFixed(1), nearestHead: ds[0], medianHead: ds[Math.floor(ds.length / 2)], rooms: [...new Set(log.map((l) => l.room))], marks, errors: errors.slice(0, 5) };
fs.writeFileSync(path.join(OUT, `${AREA}.json`), JSON.stringify({ ...res, log }, null, 1));
const mp4 = path.join(OUT, `${AREA}.mp4`);
encode(path.join(OUT, `${AREA}-frames`), null, mp4, { fps: FPS, outFps: 30 });
// a strip: one frame every 0.5 s
const all = fs.readdirSync(path.join(OUT, `${AREA}-frames`)).filter((f) => f.endsWith(".jpg")).sort();
const pick = all.filter((_, i) => i % 15 === 0).map((f) => path.join(OUT, `${AREA}-frames`, f));
const rows = Math.ceil(pick.length / 6);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...pick.flatMap((f) => ["-i", f]), "-filter_complex",
  pick.map((_, i) => `[${i}]scale=260:-2[s${i}]`).join(";") + ";" + pick.map((_, i) => `[s${i}]`).join("") + `xstack=inputs=${pick.length}:layout=` +
  pick.map((_, i) => `${(i % 6) * 260}_${Math.floor(i / 6) * 563}`).join("|") + `:fill=black`, "-frames:v", "1", path.join(OUT, `${AREA}-strip.jpg`)]);
console.log(JSON.stringify(res));
await browser.close();
void rows;
