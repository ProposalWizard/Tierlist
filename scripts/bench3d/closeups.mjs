#!/usr/bin/env node
// Close-up stills of one person in a cut scene, from any side, at true phone
// quality (390x844 at 2x = 780x1688), through the director's debug camera
// (__cutsceneDebug.shoot: the scene at second t, seen from where you say).
//
//   node scripts/bench3d/closeups.mjs "<director url>" OUTDIR shots.json
// shots.json: [{ "name": "walk-front", "t": 5.2, "who": "you", "view": "front|side|back|left|<deg>",
//               "part": "hips|head|chest|feet", "dist": 2.4, "up": 0, "fov": 30, "size": "390x844", "hide": ["id", "#grid"] }]
// view "top" looks straight down; "#grid" in hide draws a floor grid (10 cm squares, bold every 50 cm).
// view is turned from the person's own facing (front = looking at his face).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [url, out, shotsFile] = process.argv.slice(2);
const shots = JSON.parse(fs.readFileSync(shotsFile, "utf8"));
fs.mkdirSync(out, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const [w, h] = (shots[0]?.size ?? "390x844").split("x").map(Number);
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); } catch {} });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("console", m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: "load", timeout: 300000 });
const t0 = Date.now();
while (!(await page.evaluate(() => !!(window.__cutsceneDebug && window.__frameStep && window.__styleReady !== false)))) { if (Date.now() - t0 > 600000) throw new Error("page never ready"); await page.waitForTimeout(3000); }
console.log("ready in", ((Date.now() - t0) / 1000).toFixed(0), "s");
await page.waitForTimeout(1500);
// hide anything that is not the 3D canvas (cookie banner, dev pills)
await page.addStyleTag({ content: `nextjs-portal{display:none!important}` });
// every floating thing over the scene (chat bubble, dev pills) that is not the 3D canvas
await page.evaluate(() => { for (const el of Array.from(document.querySelectorAll("body *"))) { const cs = getComputedStyle(el); if ((cs.position === "fixed" || cs.position === "sticky") && !el.querySelector("canvas") && el.tagName !== "CANVAS") el.style.display = "none"; } });
for (const s of shots) {
  await page.evaluate((s) => {
    const D = window.__cutsceneDebug;
    window.__frameStep.seek(s.t);
    const at = D.part(s.who, s.part ?? "hips");
    const yaw = D.yaw(s.who);
    const turn = { front: 0, side: 90, back: 180, left: -90 }[s.view] ?? Number(s.view);
    const a = yaw + (turn * Math.PI) / 180;
    const d = s.dist ?? 2.4;
    // "top": straight down on him (his front towards the top of the picture)
    const pos = s.view === "top" ? [at[0] - Math.sin(yaw) * 0.02, at[1] + d, at[2] - Math.cos(yaw) * 0.02] : [at[0] + Math.sin(a) * d, at[1] + (s.up ?? 0), at[2] + Math.cos(a) * d];
    D.shoot(s.t, pos, at, s.fov ?? 30, s.hide ?? []);
  }, s);
  await page.waitForTimeout(200);
  const f = path.join(out, `${s.name}.png`);
  await page.screenshot({ path: f });
  console.log("still", f);
}
await browser.close();
