#!/usr/bin/env node
/**
 * Dump every cast member's arm joints, frame by frame, from a cut scene, with
 * NO drawing: window.__cutsceneDebug.pose(t) poses the actors exactly as the
 * director does for that moment (clips, holds, reaches, hands). Then
 * tools/motionref/arm_metrics.py turns the dump into speeds and jerk.
 *
 *   node tools/motionref/dump-arms.mjs "<director url>" out.json [--fps=60]
 */
import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const [url, out] = args.filter((a) => !a.startsWith("--"));
const fps = Number(flag("fps", "60"));
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(url, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__cutsceneDebug?.pose && window.__frameStep, null, { timeout: 300000 });
await page.evaluate(() => window.__frameStep.seek(0));
const data = await page.evaluate((fps) => {
  const D = window.__cutsceneDebug;
  const dur = window.__frameStep.duration;
  const BONES = ["Spine02", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand"];
  const ids = Array.from(D.cast.keys());
  const res = { fps, dur, actors: {} };
  for (const id of ids) res.actors[id] = Object.fromEntries(BONES.map((b) => [b, []]));
  const wq = { x: 0, y: 0, z: 0, w: 1 };
  for (let i = 0; i <= Math.round(dur * fps); i++) {
    D.pose(i / fps);
    for (const id of ids) {
      const a = D.cast.get(id).actor;
      for (const b of BONES) {
        const o = a.bone(b);
        if (!o) { res.actors[id][b].push(null); continue; }
        const q = o.quaternion; // local turn (what the joint itself does)
        const p = o.getWorldPosition ? o.getWorldPosition(new o.position.constructor()) : null;
        res.actors[id][b].push([q.x, q.y, q.z, q.w, p ? p.x : 0, p ? p.y : 0, p ? p.z : 0]);
      }
    }
  }
  void wq;
  return res;
}, fps);
fs.writeFileSync(out, JSON.stringify(data));
console.log("wrote", out, Object.keys(data.actors).join(","), data.dur);
await browser.close();
