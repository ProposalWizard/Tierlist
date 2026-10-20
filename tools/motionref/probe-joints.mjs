#!/usr/bin/env node
/**
 * Where an actor's joints are at given moments of a cut scene (metres, world),
 * and his root (feet) height: for checking a seat or desk against the body.
 *
 *   node tools/motionref/probe-joints.mjs "<director url>" you 3 5.5 [...]
 */
import { chromium } from "playwright";
import fs from "node:fs";

const [url, actor, ...ts] = process.argv.slice(2);
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__cutsceneDebug?.pose && window.__frameStep, null, { timeout: 300000 });
const out = await page.evaluate(({ actor, ts }) => {
  const D = window.__cutsceneDebug;
  const a = D.cast.get(actor).actor;
  const res = [];
  for (const t of ts.map(Number)) {
    D.pose(t);
    const r = D.rootAt(actor, t);
    const P = (n) => { const b = a.bone(n); if (!b) return null; const v = new b.position.constructor(); b.getWorldPosition(v); return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; };
    const row = { t, root: r };
    for (const n of ["Hips", "Spine", "neck", "Head", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand", "LeftUpLeg", "LeftLeg"]) row[n] = P(n);
    res.push(row);
  }
  const props = [];
  for (const [id, p] of D.props ?? []) { const o = p.object ?? p.root ?? p; try { const B = new (o.position.constructor)(); o.getWorldPosition(B); props.push([id, +B.x.toFixed(2), +B.y.toFixed(2), +B.z.toFixed(2)]); } catch { props.push([id]); } }
  return { res, props };
}, { actor, ts });
console.log(JSON.stringify(out, null, 1));
await browser.close();
