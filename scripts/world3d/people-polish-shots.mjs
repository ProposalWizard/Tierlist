#!/usr/bin/env node
// scripts/world3d/people-polish-shots.mjs — THE PEOPLE PLAN'S TWO POLISH POINTS, ON CAMERA (28 Nov 2026):
//  1. a visitor walks out through the front door onto the porch and the door shuts behind him (and in again);
//  2. the chef cooks at the range (stirring, the spoon in the pan, steam) at the villa and the estate.
// The living house on /star-world3d-dev?place=house, 390×844 at 1×, frame-stepped (?film=1: 1/30 s a frame).
//   node scripts/world3d/people-polish-shots.mjs --out DIR [--base http://localhost:3114] [--only door,film,chef] [--tier villa]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const outDir = path.resolve(opt("out", "people-polish"));
const base = opt("base", "http://localhost:3114");
const only = opt("only", "door,film,chef").split(",");
const doorTier = opt("tier", "villa");
fs.mkdirSync(outDir, { recursive: true });
const HIDE = ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide],[data-pageguide],.page-guide,[data-chat-badge],nextjs-portal{display:none!important}";

const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-3d-view", "third"); } catch { /* fine */ } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
const shot = async (name) => { await page.screenshot({ path: path.join(outDir, `${name}.jpg`), quality: 86 }); console.log(name); };
/** Step the house n frames of 1/30 s (held: nothing moves between steps). */
const step = (n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__home3d.renderOnce(); }, n);
const guest = () => page.evaluate(() => (window.__home3d.lifeDebug().guests ?? [])[0] ?? null);
const person = () => page.evaluate(() => (window.__home3d.lifeDebug().people ?? []).find((p) => p.id.startsWith("guest")) ?? null);

const open = async (tier, visit) => {
  await page.goto(`${base}/star-world3d-dev?place=house&tier=${tier}&bare=1&q=medium&visit=${visit}&film=1`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => !!window.__home3d, null, { timeout: 300000 });
  await page.addStyleTag({ content: HIDE });
  await page.evaluate(() => window.__home3d.hold(true));
};
/** Step until f() is true (at most max frames), in chunks. */
const until = async (f, max = 3000, chunk = 15) => {
  for (let i = 0; i < max; i += chunk) { await step(chunk); if (await f()) return true; }
  return false;
};

try {
  if (only.includes("door") || only.includes("film")) {
    await open(doorTier, "door");
    const plan = await page.evaluate(() => window.__home3d.plan());
    const D2 = plan.d / 2;
    // you stand back by the wall; the camera watches the front door from inside the hall
    await page.evaluate(([d2]) => window.__home3d.place(-1.05, d2 - 2.6, Math.PI), [D2]);
    await page.evaluate(([d2]) => window.__home3d.debugCamera([0.75, 1.65, d2 - 3.6], [0, 1.0, d2 + 0.6], 58), [D2]);
    // arriving: the door opens, he steps in off the porch
    await until(async () => (await guest())?.visible, 4000);
    await until(async () => (await page.evaluate(() => window.__home3d.lifeDebug().people.find((p) => p.id.startsWith("guest"))?.z)) < D2 + 0.4, 600, 3);
    await shot(`arrive-1-door-open-${doorTier}`);
    await step(45);
    await shot(`arrive-2-in-the-hall-${doorTier}`);
    // the call in the hall, then out: to the door, it opens, onto the porch, it shuts
    await until(async () => (await guest())?.mode === "leaving", 6000, 15);
    const film = only.includes("film");
    const framesDir = path.join(outDir, "film-frames");
    if (film) fs.mkdirSync(framesDir, { recursive: true });
    let k = 0;
    const marks = { through: false, porch: false, shut: false };
    for (let f = 0; f < 420; f++) {
      await step(1);
      if (film) await page.screenshot({ path: path.join(framesDir, `f${String(k++).padStart(4, "0")}.jpg`), quality: 80 });
      if (f % 6 !== 0) continue;
      const p = await person(), g = await guest();
      if (!p) continue;
      if (!marks.through && p.z > D2 - 0.25 && p.z < D2 + 0.25) { marks.through = true; await shot(`leave-1-through-the-door-${doorTier}`); }
      else if (!marks.porch && p.z > D2 + 1.2) { marks.porch = true; await shot(`leave-2-on-the-porch-${doorTier}`); }
      else if (marks.porch && !marks.shut && !g.visible) { marks.shut = true; await shot(`leave-3-door-shut-${doorTier}`); if (!film) break; }
    }
    if (!marks.shut) console.log("not shut:", JSON.stringify(await guest()), JSON.stringify(await person()), await page.evaluate(() => window.__home3d.lifeDebug().frontDoor));
    if (film) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", path.join(framesDir, "f%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=390:844", path.join(outDir, `visitor-leaves-${doorTier}.mp4`)]);
      console.log("film", `visitor-leaves-${doorTier}.mp4`);
    }
  }
  if (only.includes("chef")) {
    for (const tier of ["villa", "estate"]) {
      await open(tier, "chef");
      await page.evaluate(() => window.__home3d.goToRoom("kitchen"));
      await step(30);
      const plan = await page.evaluate(() => window.__home3d.plan());
      const D2 = plan.d / 2;
      // he comes in and cooks: wait till he is at the hob
      const ok = await until(async () => { const p = await person(); return !!p && p.using?.startsWith("hob") && p.state === "use"; }, 9000, 30);
      if (!ok) console.log(tier, "the chef never got to the hob", JSON.stringify(await guest()));
      await page.evaluate(() => window.__home3d.place(1.6, 0.9, Math.PI));
      const p = await person();
      await page.evaluate(([x, z, d2]) => window.__home3d.debugCamera([x + 1.25, 1.75, Math.min(d2 - 0.4, -d2 + 2.75)], [x - 0.15, 1.05, -d2 + 0.4], 52), [p.x, p.z, D2]);
      await step(40);
      await shot(`chef-cooks-${tier}`);
      await step(18);
      await shot(`chef-cooks-${tier}-b`);
      await page.evaluate(([x, d2]) => window.__home3d.debugCamera([x + 0.4, 1.55, -d2 + 1.25], [x - 0.15, 1.0, -d2 + 0.45], 50), [p.x, D2]);
      await step(6);
      await shot(`chef-cooks-${tier}-close`);
    }
  }
} finally {
  await browser.close();
}
