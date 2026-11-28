#!/usr/bin/env node
/**
 * The house's bathroom mirror (Shave / Trim beard / Tidy hair, lib/star/barber.ts applyMirror) at phone size:
 *   node scripts/barber3d/mirror-shots.mjs OUTDIR [cut=crew.s.3.1.1] [head=h3]
 * The house test page in the bathroom, the mirror's card, then each act, a close look at your face after it.
 * Needs a dev server (BASE=http://localhost:3112). Chrome with SwiftShader WebGL.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [out = ".", cut = "crew.s.3.1.1", head = "h3"] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3112";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errs = [];
p.on("pageerror", (e) => errs.push(`PAGEERR ${e.message.slice(0, 200)}`));
await p.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-3d-view", "third"); } catch { /* fine */ } });
const hide = async () => p.addStyleTag({ content: ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide],[data-pageguide],.page-guide{display:none!important}" }).catch(() => {});
const shot = async (name) => { await hide(); await p.waitForTimeout(400); const f = path.join(out, `${name}.png`); await p.screenshot({ path: f }); console.log(f); };
const wait = (ms) => p.waitForTimeout(ms);
await p.goto(`${BASE}/star-home3d-dev?bare=1&tier=house&cut=${cut}&head=${head}&skin=light`, { timeout: 240000 });
await p.waitForFunction("!!window.__home3d", null, { timeout: 240000 });
await wait(3000);
await p.evaluate(() => window.__home3d.goToRoom("bathroom"));
await wait(3000);
await p.evaluate(() => window.__home3d.tapThing?.("mirror"));
await wait(6000);
// a close look at his face from the mirror's side (the face is towards the mirror on the west wall)
const face = async (name) => {
  const pos = await p.evaluate(() => window.__home3d.where?.() ?? null);
  await shot(name);
  if (!pos) return;
  // his face from the mirror's side, then back to camera D
  const fx = pos.x + Math.sin(pos.yaw) * 0.75, fz = pos.z + Math.cos(pos.yaw) * 0.75;
  await p.evaluate(([x, z, hx, hz]) => window.__home3d.debugCamera([x, 1.62, z + 0.25], [hx, 1.52, hz], 40), [fx, fz, pos.x, pos.z]);
  await wait(1200);
  await shot(`${name}-face`);
  await p.evaluate(() => window.__home3d.debugCamera(null));
};
await face("m1-mirror-card");
for (const act of ["trimBeard", "shave", "tidy"]) {
  const btn = await p.$(`[data-mirror-act=${act}]`);
  if (!btn || await btn.isDisabled()) { console.log("not offered:", act); continue; }
  await btn.click();
  await wait(2500);
  await face(`m-${act}`);
}
console.log(errs.length ? errs.join("\n") : "no page errors");
await b.close();
