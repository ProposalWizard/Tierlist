#!/usr/bin/env node
/**
 * Dump every cast member's whole pose (each bone's own turn), frame by frame,
 * from a cut scene, with NO drawing (window.__cutsceneDebug.pose(t) poses the
 * actors exactly as the director does). tools/motionref/body_overlap.mts
 * --poses=out.json then checks no body part goes inside another.
 *
 *   node tools/motionref/dump-pose.mjs "<director url>" out.json [--fps=10] [--scene=name]
 */
import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const [url, out] = args.filter((a) => !a.startsWith("--"));
const fps = Number(flag("fps", "10"));
const scene = flag("scene", new URL(url).searchParams.get("fixture") ?? "scene");
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(url, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__cutsceneDebug?.pose && window.__frameStep, null, { timeout: 300000 });
await page.evaluate(() => window.__frameStep.seek(0));
const data = await page.evaluate(({ fps, scene }) => {
  const D = window.__cutsceneDebug;
  const dur = window.__frameStep.duration;
  const res = { fps, dur, scene, actors: {} };
  const ids = Array.from(D.cast.keys());
  const boneLists = {};
  D.pose(0);
  for (const id of ids) {
    const a = D.cast.get(id).actor;
    const names = [];
    const root = a.root ?? a.object ?? null;
    const visit = (o) => { if (o.isBone) names.push(o.name); (o.children ?? []).forEach(visit); };
    if (root) visit(root);
    else for (const n of ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightShoulder", "RightArm", "RightForeArm", "RightHand", "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"]) if (a.bone(n)) names.push(n);
    boneLists[id] = names.filter((n) => a.bone(n));
    res.actors[id] = { bones: boneLists[id], frames: [] };
  }
  for (let i = 0; i <= Math.round(dur * fps); i++) {
    D.pose(i / fps);
    for (const id of ids) {
      const a = D.cast.get(id).actor;
      const f = [];
      for (const n of boneLists[id]) { const q = a.bone(n).quaternion; f.push(+q.x.toFixed(5), +q.y.toFixed(5), +q.z.toFixed(5), +q.w.toFixed(5)); }
      res.actors[id].frames.push(f);
    }
  }
  return res;
}, { fps, scene });
fs.writeFileSync(out, JSON.stringify(data));
console.log("wrote", out, Object.entries(data.actors).map(([k, v]) => `${k}:${v.bones.length}`).join(","), data.dur);
await browser.close();
