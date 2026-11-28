#!/usr/bin/env node
// scripts/world3d/compound-shots.mjs — STILLS OF THE TRAINING COMPOUND (the proof pictures for a review).
//
// Opens /star-world3d-dev?place=compound on a 390×844 phone at 2× (the game fills 780×1688) and saves a still per
// shot: where you stand (teleport), the camera (third person behind you, first person, or a pinned camera for a wide
// shot), and how long to let the people move first. Prints the frame's draws and triangles with each.
//
//   node scripts/world3d/compound-shots.mjs --out DIR [--base http://localhost:3108] [--q medium] [--sky day] [--only a,b]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const outDir = path.resolve(opt("out", "compound-shots"));
const base = opt("base", "http://localhost:3108");
const q = opt("q", "medium"), sky = opt("sky", "day");
const only = opt("only", null)?.split(",");
fs.mkdirSync(outDir, { recursive: true });

// [name, you x, z, yaw, view, wait ms, pinned camera [x,y,z] look [x,y,z] | null]
const SHOTS = [
  ["01-arrival", -3.4, 34.6, 3.3, "third", 1500, null],
  ["02-arrival-wide", -3.4, 34.6, 3.3, "third", 800, [-1, 3.6, 39], [-4, 1.8, 24]],
  ["03-pitches", 24, 6, Math.PI / 2 + 0.25, "third", 4000, [27.5, 6.5, 9], [60, 0, -4]],
  ["04-building-front", -6, 19, Math.PI, "third", 1500, [3.2, 2.3, 17.5], [-5, 3.0, 8]],
  ["05-gym-door", -11, 14.5, Math.PI, "third", 1200, null],
  ["06-people-at-work", 27, -8, Math.PI / 2, "third", 4000, [31.4, 2.2, -5.4], [39, 0.9, 4.4]],
  ["10-kit-close", 27, -8, Math.PI / 2, "third", 4000, [36.6, 1.6, 0.6], [40, 1.1, 3.8]],
  ["07-first-person-gate", 2.0, 31.0, 3.28, "first", 2500, null],
  // the loading screen backdrop (public/star/loading/compound-*.webp): nobody in it (you are moved behind the camera)
  ["L-loading", -6, 44, 0, "third", 1200, [-1, 3.6, 39], [-4, 1.8, 24]],
  ["09-car-park-looking-back", -2.5, 36.5, 0.35, "third", 1500, null],
  ["08-forecourt-people", -12, 19.5, Math.PI, "third", 3000, [-14.5, 2.2, 19.0], [-8, 1.0, 14.2]],
];

const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); } catch { /* fine */ } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.error("console", m.text().slice(0, 300)); });
  await page.goto(`${base}/star-world3d-dev?place=compound&bare=1&q=${q}&sky=${sky}${args.includes("--chips") ? "" : "&clean=1"}${opt("extra", "")}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => !!window.__world3d, null, { timeout: 300000 });
  await page.addStyleTag({ content: ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide],[data-pageguide],.page-guide{display:none!important}" }); // no chat bubble or cookie banner in a still
  // --bareui: only the 3D picture (a loading screen's backdrop): every button and bubble hidden
  if (args.includes("--bareui")) await page.addStyleTag({ content: "body *{visibility:hidden!important} canvas{visibility:visible!important}" });
  await page.waitForTimeout(3000);
  for (const [name, x, z, yaw, view, wait, cam, look] of SHOTS) {
    if (only && !only.some((o) => name.includes(o))) continue;
    await page.evaluate(([x, z, yaw, view, cam, look]) => {
      window.__world3d.setView(view);
      window.__world3d.teleport(x, z, yaw);
      window.__world3dCam(cam, look);
    }, [x, z, yaw, view, cam, look]);
    await page.waitForTimeout(wait);
    const s = await page.evaluate(() => window.__world3d.stats());
    await page.screenshot({ path: path.join(outDir, `${name}.jpg`), quality: 88 });
    console.log(`${name}: ${s.calls} draws, ${s.triangles} triangles, ${s.people} people (${s.tier})`);
    if (args.includes("--why")) {
      // the triangles in the scene by what they belong to (whole scene, not only what is on screen)
      const why = await page.evaluate(() => {
        const out = {};
        window.__world3dScene.traverse((m) => {
          if (!m.isMesh || !m.visible) return;
          let top = m; while (top.parent && top.parent.type !== "Scene") top = top.parent;
          const k = (top.name || top.type) + (m.isSkinnedMesh ? " (skinned)" : "");
          const g = m.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3 * (m.isInstancedMesh ? m.count : 1);
          const dr = g.drawRange && isFinite(g.drawRange.count) ? Math.min(n, g.drawRange.count / 3) : n;
          out[k] = (out[k] || 0) + Math.round(dr);
        });
        return out;
      });
      console.log(JSON.stringify(why));
      // one person's meshes, each with its triangles (what a body costs)
      const one = await page.evaluate(() => {
        const tops = [];
        window.__world3dScene.traverse((m) => { if (m.isSkinnedMesh) { let t = m; while (t.parent && t.parent.type !== "Scene") t = t.parent; if (!tops.includes(t)) tops.push(t); } });
        return tops.slice(0, 3).map((t) => { const l = []; t.traverse((m) => { if (m.isMesh) { const g = m.geometry; l.push(`${m.name || m.type}${m.visible ? "" : "(hidden)"}:${Math.round((g.index ? g.index.count : g.attributes.position.count) / 3)}`); } }); return l.join(" "); });
      });
      console.log(one.join("\n"));
    }
  }
  await page.evaluate(() => window.__world3dCam(null));
  const dbg = await page.evaluate(() => window.__world3d.debug().compound);
  console.log(JSON.stringify(dbg));
  if (args.includes("--who")) console.log(JSON.stringify(await page.evaluate(() => window.__world3d.debug().people)));
} finally { await browser.close(); }
