#!/usr/bin/env node
// scripts/world3d/home-gym-shots.mjs — STILLS OF THE HOME GYMS (lib/star/gym/homeGym.ts), one per house level, plus
// one exercise in a home gym and the compound's gym door → the gym → back out of the door.
//
// Opens /star-world3d-dev on a 390×844 phone at 1× (the brief's size), cookie banner and chat badge hidden.
//   node scripts/world3d/home-gym-shots.mjs --out DIR [--base http://localhost:3112] [--q medium] [--only villa,door]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const outDir = path.resolve(opt("out", "home-gym-shots"));
const base = opt("base", "http://localhost:3112");
const q = opt("q", "medium");
const only = opt("only", null)?.split(",");
const want = (n) => !only || only.some((o) => n.includes(o));
fs.mkdirSync(outDir, { recursive: true });

// each level: [tier, the room's box (homeGym.ts HOME_GYMS), its ceiling (homes.ts roomPreset h)]
const TIERS = [
  ["starter", [-1.5, 2.5, 0.2, 4.8], 2.55], ["flat", [-1.5, 2.5, 0.2, 4.8], 2.65], ["penthouse", [-3.7, 3.9, -3.2, 4.0], 2.9],
  ["house", [-3.7, 5.5, -4.4, 4.0], 3.0], ["villa", [-5, 5, -4, 4], 3.3], ["estate", [-5, 6.6, -4, 4], 3.7],
];
const HIDE = ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide],[data-pageguide],.page-guide{display:none!important}";

const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-3d-view", "third"); } catch { /* fine */ } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("console", m.text().slice(0, 300)); });
const ready = async () => { await page.waitForFunction(() => !!window.__world3d, null, { timeout: 300000 }); await page.addStyleTag({ content: HIDE }); };
const shot = async (name) => {
  const s = await page.evaluate(() => window.__world3d?.stats?.() ?? null);
  await page.screenshot({ path: path.join(outDir, `${name}.jpg`), quality: 86 });
  console.log(name, s ? `${s.calls} draws, ${Math.round(s.triangles / 1000)}k triangles, ${s.tier}` : "");
};

try {
  // 1. each level's gym: walking in (the game's camera) and a wide look from the far corner
  for (const [tier, [x0, x1, z0, z1], h] of TIERS) {
    if (!want(tier)) continue;
    await page.goto(`${base}/star-world3d-dev?place=gym&homeGym=${tier}&bare=1&clean=1&q=${q}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await ready();
    await page.waitForTimeout(3500);
    // 1: the game's own arrival shot (homeGym.ts homeGymIntro), you by the door, the kit in front
    await shot(`${tier}-1-walk-in`);
    const cy = Math.min(h - 0.3, 2.5), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    // 2: the wide look from the south-east corner over the whole room to the west wall's rack, you in its middle
    await page.evaluate(([x, z]) => window.__world3d.teleport(x, z, -Math.PI * 0.25), [x0 + (x1 - x0) * 0.4, z0 + (z1 - z0) * 0.42]);
    await page.evaluate(([cam, look]) => window.__world3dCam(cam, look), [[x1 - (x1 - x0) * 0.3, cy, z1 - 0.3], [x0 + (x1 - x0) * 0.35, 0.35, z0 + (z1 - z0) * 0.3]]);
    await page.waitForTimeout(1500);
    await shot(`${tier}-2-wide`);
    // 3: the other way, from the north-west corner back to the door (you stand by the door, facing in)
    await page.evaluate(([x, z]) => window.__world3d.teleport(x, z, Math.PI), [cx + 0.6, z1 - 1.0]);
    await page.evaluate(([cam, look]) => window.__world3dCam(cam, look), [[x0 + 0.3, cy, z0 + 0.3], [x0 + (x1 - x0) * 0.68, 0.35, z0 + (z1 - z0) * 0.7]]);
    await page.waitForTimeout(1500);
    await shot(`${tier}-3-wide-back`);
    if (tier === "estate") {
      // 4: the east wall from across the room: the slats, the TV, the sauna door, the towel rail
      await page.evaluate(() => window.__world3d.teleport(3.2, 0.6, -Math.PI / 2));
      await page.evaluate(() => window.__world3dCam([-1.6, 2.4, 0.4], [6.6, 1.2, 0.4]));
      await page.waitForTimeout(1500);
      await shot(`${tier}-4-sauna-wall`);
    }
    await page.evaluate(() => window.__world3dCam(null));
  }
  // 2. one exercise in a home gym (the penthouse's bench press), the bot's thumb
  if (want("exercise")) {
    await page.goto(`${base}/star-world3d-dev?place=gym&homeGym=penthouse&bare=1&q=${q}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await ready();
    await page.waitForTimeout(2500);
    await page.evaluate(() => { window.__world3d.gymBot(1); window.__world3d.tapId("bench"); });
    await page.waitForTimeout(4500);
    await page.evaluate(() => window.__world3d.act("use"));
    await page.waitForTimeout(9000);
    await shot("exercise-1-bench-set");
    await page.waitForTimeout(26000);
    await shot("exercise-2-result");
  }
  // 3. the compound's gym door → the gym → back out of the door
  if (want("door")) {
    await page.goto(`${base}/star-world3d-dev?place=compound&bare=1&q=${q}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await ready();
    await page.waitForTimeout(3000);
    await page.evaluate(() => { window.__world3d.teleport(-11, 15.2, Math.PI); });
    await page.waitForTimeout(1500);
    await shot("door-1-compound-gym-door");
    await page.evaluate(() => window.__world3d.tapId("door-gym"));
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__world3d.act("use"));
    await page.waitForTimeout(500);
    await shot("door-2-fading");
    await page.waitForFunction(() => window.__world3d?.debug?.()?.gym !== undefined && !!window.__world3d.debug().gym, null, { timeout: 300000 }).catch(() => {});
    await page.waitForTimeout(400);
    await shot("door-3-gym-fade-in");
    await page.waitForTimeout(2500);
    await shot("door-4-in-the-gym");
    await page.click("[data-world3d-back]");
    await page.waitForTimeout(1500);
    await ready();
    await page.waitForTimeout(3500);
    await shot("door-5-back-at-the-door");
  }
} finally {
  await browser.close();
}
