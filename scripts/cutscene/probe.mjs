#!/usr/bin/env node
// Numbers from a cut scene at chosen seconds: the camera, where it looks, and
// where each actor's head is on screen (x, y in −1..1; |x| > 1 = out of frame).
//   node scripts/cutscene/probe.mjs "<url>" <t> [t ...]
import { chromium } from "playwright";
import fs from "node:fs";
const [url, ...ts] = process.argv.slice(2);
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(url, { waitUntil: "load", timeout: 240000 });
await page.waitForFunction(() => window.__frameStep && window.__cutsceneDebug && window.__styleReady !== false, null, { timeout: 300000 });
for (const t of ts) {
  const r = await page.evaluate((t) => {
    window.__frameStep.seek(Number(t));
    const D = window.__cutsceneDebug, cam = D.camera;
    const f = (v) => v.toArray().map((x) => +x.toFixed(2));
    const wd = cam.getWorldDirection(cam.position.clone()); const out = { t, dir: f(wd), up: f(cam.up), cam: f(cam.position), fov: +cam.fov.toFixed(1), aspect: +cam.aspect.toFixed(2), actors: {} };
    for (const [id, c] of D.cast) {
      const h = c.actor.point("head"); const p = h.clone().project(cam);
      out.actors[id] = { root: f(c.actor.root.position), chest: f(c.actor.point("chest")), hips: f(c.actor.point("hips")), head: f(h), screen: [+p.x.toFixed(2), +p.y.toFixed(2)] };
    }
    return out;
  }, t);
  console.log(JSON.stringify(r));
}
await browser.close();
