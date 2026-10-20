#!/usr/bin/env node
// One still of an admin page (the 3D Scene Editor, the Scene generator, the
// framed 3D places) at a chosen size, as a JPEG kept under 200 KB.
//
//   node scripts/scene-editor/still.mjs "<url>" <out.jpg> [--size=390x844] [--wait="js expr"]
//        [--click=<css selector>]... [--delay=ms] [--scroll=<css selector>] [--full]
//
// --wait   a JS expression to wait for (e.g. "window.__editorReady === true")
// --click  click these in order before the shot (each waits for its element)
// --scroll scroll this element into view before the shot
// No graphics chip here: 3D frames take seconds, so --delay gives them time.
import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith("--"));
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const many = (k) => args.filter((x) => x.startsWith(`--${k}=`)).map((a) => a.slice(k.length + 3));
const [url, out] = pos;
const [w, h] = opt("size", "390x844").split("x").map(Number);
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
// --init="js": run before the page's own scripts (e.g. put a saved edit in localStorage)
const init = opt("init", "");
if (init) await page.addInitScript(init);
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error" && !/CERT_AUTHORITY|favicon|Failed to load resource/.test(m.text())) console.log("console", m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: "load", timeout: 300000 });
const wait = opt("wait", "");
if (wait) await page.waitForFunction(wait, null, { timeout: 400000, polling: 1000 }).catch((e) => console.log("wait timed out:", e.message.slice(0, 120)));
for (const sel of many("click")) {
  await page.waitForSelector(sel, { timeout: 120000 }).catch(() => console.log("no", sel));
  await page.click(sel).catch((e) => console.log("click failed", sel, e.message.slice(0, 100)));
  await page.waitForTimeout(800);
}
const sc = opt("scroll", "");
if (sc) await page.evaluate((s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: "start" }); else console.log("no", s); }, sc);
await page.waitForTimeout(Number(opt("delay", "3000")));
for (const q of [72, 60, 48, 36, 26]) {
  await page.screenshot({ path: out, type: "jpeg", quality: q, fullPage: args.includes("--full") });
  const kb = fs.statSync(out).size / 1024;
  if (kb <= 200) { console.log(`still ${out} ${w}x${h} q${q} ${kb.toFixed(0)} KB`); break; }
}
await browser.close();
