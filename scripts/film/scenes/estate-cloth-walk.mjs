/**
 * FILM: a 10-second walk through the estate in the cloth clothes (Harry, 21 Nov 2026: "put them in houses").
 *   node scripts/film/scenes/estate-cloth-walk.mjs <port> <outDir> [cloth=0]
 * From the hallway through the lounge door, past the sofa where the team-mates sit.
 * Virtual clock, 30 fps, phone size 780x1688. Writes <outDir>/estate-walk.mp4 and estate-walk-strip.jpg.
 * Test only: needs a dev server, never Vercel's.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { installVClock, vStart, vCapture, vStep, encode } from "../vclock.mjs";

const [PORT = "3000", OUT = "/tmp/estate-walk", CLOTH = ""] = process.argv.slice(2);
const FPS = 30, N = 300;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const FR = path.join(OUT, "estate-walk-frames");
fs.rmSync(FR, { recursive: true, force: true });
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await installVClock(ctx, { fps: FPS });
await ctx.addInitScript(() => { try { localStorage.setItem("kib-3d-follow-zoom", "0"); localStorage.setItem("kib-cookie-consent", "no"); } catch { /* */ } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/star-home3d-dev?bare=1&q=high&tier=estate${CLOTH ? "&" + CLOTH : ""}`, { waitUntil: "domcontentloaded", timeout: 300000 });
for (let i = 0; i < 400; i++) { if (await page.evaluate(() => !!window.__home3d)) break; await wait(1000); }
await page.addStyleTag({ content: ".tr-float,[data-page-guide],nextjs-portal,[data-home3d-dev]{display:none!important}" });
await wait(5000);
await vStart(page, { scale: 2 });
const ctl = (fn, arg) => page.evaluate(([src, a]) => new Function("c", "a", src)(window.__home3d, a), [fn, arg]);
// the team-mates loaded and sat first (into the lounge and back, off camera), then from the hallway through the
// lounge door, past the sofa where they sit
await ctl("c.goToRoom('lounge')");
let ppl = [];
for (let i = 0; i < 120 && ppl.length < 2; i++) { await vStep(page, 15); ppl = ((await ctl("return c.lifeDebug()")).people ?? []).filter((p) => p.visible && p.state === "use"); }
await ctl("c.goToRoom('hallway')");
await vStep(page, 90);
const plan0 = await ctl("return c.plan()");
const d = plan0.doors.find((x) => x.to === "lounge");
const w2 = plan0.w / 2, d2 = plan0.d / 2, B = 1.6;
const at = d.wall === "s" ? [d.x, d2 - B, 0] : d.wall === "n" ? [d.x, -d2 + B, Math.PI] : d.wall === "e" ? [w2 - B, d.z, Math.PI / 2] : [-w2 + B, d.z, -Math.PI / 2];
await ctl("c.place(a[0], a[1], a[2])", at);
await vStep(page, 40);
await vCapture(page, FR, {});
let n = 0;
const step = async (k) => { k = Math.min(k, N - n); if (k > 0) { await vStep(page, k); n += k; } };
await step(10);
await ctl("c.setStick(0, 0.7)");
while (n < 150 && (await ctl("return c.room()")) !== "lounge") await step(2);
await step(8); await ctl("c.setStick(0, 0.7)"); await step(38);
await ctl("c.setStick(0, 0)"); await step(N);
const plan = { mates: ppl.map((p) => p.id + "@" + p.using) };
await vCapture(page, null);
const mp4 = path.join(OUT, "estate-walk.mp4");
encode(FR, null, mp4, { fps: FPS, outFps: 30 });
const all = fs.readdirSync(FR).filter((f) => f.endsWith(".jpg")).sort();
const pick = all.filter((_, i) => i % 30 === 0).map((f) => path.join(FR, f));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...pick.flatMap((f) => ["-i", f]), "-filter_complex",
  pick.map((_, i) => `[${i}]scale=260:-2[s${i}]`).join(";") + ";" + pick.map((_, i) => `[s${i}]`).join("") + `xstack=inputs=${pick.length}:layout=` +
  pick.map((_, i) => `${(i % 5) * 260}_${Math.floor(i / 5) * 563}`).join("|") + `:fill=black`, "-frames:v", "1", path.join(OUT, "estate-walk-strip.jpg")]);
console.log(JSON.stringify({ frames: all.length, plan, errors: errors.slice(0, 5), room: await ctl("return c.room()") }));
await browser.close();
