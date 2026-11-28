#!/usr/bin/env node
// scripts/world3d/compound-why.mjs — WHAT A COMPOUND FRAME COSTS, piece by piece: stand at a viewpoint, look one
// way, and count the draws and triangles each group of the scene sent in the next frame (shadow pass included).
//   node scripts/world3d/compound-why.mjs x z yaw [--q medium] [--base http://localhost:3108]
import { chromium } from "playwright";
import fs from "node:fs";
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const [x, z, yaw0] = args.slice(0, 3).map(Number);
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const b = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const c = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await c.newPage();
await p.goto(`${opt("base", "http://localhost:3108")}/star-world3d-dev?place=compound&bare=1&clean=1&q=${opt("q", "medium")}`, { waitUntil: "domcontentloaded", timeout: 240000 });
await p.waitForFunction(() => !!window.__world3d, null, { timeout: 300000 });
await p.waitForTimeout(3000);
for (const yaw of (opt("yaws", null) ? opt("yaws").split(",").map(Number) : [yaw0])) {
await p.evaluate(([x, z, yaw]) => window.__world3d.teleport(x, z, yaw), [x, z, yaw]);
await p.waitForTimeout(2000);
const out = await p.evaluate(() => new Promise((res) => {
  const counts = {};
  const hooked = [];
  window.__world3dScene.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return;
    let top = o; while (top.parent && top.parent.type !== "Scene") top = top.parent;
    const k = (top.name || top.type) + (o.isSkinnedMesh ? "·skinned" : o.isInstancedMesh ? "·inst" : "");
    const prev = o.onBeforeRender;
    o.onBeforeRender = function (...a) {
      const g = this.geometry; const dr = g.drawRange; const n = g.index ? g.index.count : g.attributes.position.count;
      const tris = Math.min(n, isFinite(dr.count) ? dr.count : n) / 3 * (this.isInstancedMesh ? this.count : 1);
      const e = counts[k] ?? (counts[k] = { draws: 0, tris: 0 }); e.draws++; e.tris += Math.round(tris);
      return prev.apply(this, a);
    };
    hooked.push([o, prev]);
  });
  setTimeout(() => { for (const [o, prev] of hooked) o.onBeforeRender = prev; res({ counts, stats: window.__world3d.stats() }); }, 700);
}));
console.log("yaw", yaw.toFixed(2), JSON.stringify(out.stats));
for (const [k, v] of Object.entries(out.counts).sort((a, b) => b[1].tris - a[1].tris)) console.log(`${k.padEnd(28)} ${String(v.draws).padStart(4)} draws ${String(v.tris).padStart(8)} tris (over ~0.7 s of frames)`);
}
await b.close();
