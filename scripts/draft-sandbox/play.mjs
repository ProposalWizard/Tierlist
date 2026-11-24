/**
 * scripts/draft-sandbox/play.mjs — plays PL Draft end to end in a phone-sized
 * headless browser and logs every error, every screen's buttons and how long
 * each squad took to appear after a spin.
 *   node scripts/draft-sandbox/play.mjs <outDir> [--url http://localhost:3300] [--steps 160]
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
const argv = process.argv.slice(2);
const OUT = argv[0] || "draft-out";
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const BASE = val("--url", "http://localhost:3300");
const STEPS = Number(val("--steps", "160"));
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["iPhone 13"] });
await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-admin-mode", "off"); } catch {} });
const p = await ctx.newPage();
const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(1);
const log = (...a) => console.log(`[${T()}]`, ...a);
p.on("pageerror", e => log("PAGEERR", e.message.slice(0, 300)));
p.on("console", m => { if (m.type() === "error") log("CONSOLE-ERR", m.text().slice(0, 300)); });
p.on("response", r => { const u = r.url(); if (u.includes("/api/") && r.status() >= 400) log("HTTP", r.status(), u.slice(0, 120)); });
const slow = new Map();
p.on("request", r => { if (r.url().includes("/api/draft/")) slow.set(r.url(), Date.now()); });
p.on("requestfinished", r => { const s = slow.get(r.url()); if (s) { const ms = Date.now() - s; if (ms > 1500) log("SLOW", ms + "ms", r.url().slice(0, 120)); } });
await p.goto(BASE + "/draft", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForTimeout(6000);
let shot = 0, lastSig = "", same = 0;
const snap = async (n) => p.screenshot({ path: `${OUT}/${String(shot++).padStart(3, "0")}-${n}.jpg`, type: "jpeg", quality: 55 });
const NOSKIP = argv.includes("--watch-sim");
const PRIORITY = [/^START DRAFT/i, /^SPIN/i, /^SIM(ULATE)?\b/i, /SIMULATE/i, /^PLAY SEASON/i, /^CONTINUE/i, /^NEXT/i, /^CONFIRM/i, /^LOCK/i, /^DONE/i, ...(NOSKIP ? [] : [/^SKIP/i]), /^START/i];
for (let step = 0; step < STEPS; step++) {
  await p.waitForTimeout(900);
  const texts = (await p.locator("button:visible").allInnerTexts()).map(t => t.replace(/\s+/g, " ").trim());
  const body = (await p.locator("body").innerText()).slice(0, 4000);
  const sig = texts.join("|").slice(0, 400);
  if (sig === lastSig) same++; else { same = 0; lastSig = sig; log("BUTTONS", JSON.stringify(texts.filter(Boolean).slice(0, 30).map(t => t.slice(0, 40)))); await snap("s" + step); }
  if (/undefined|NaN|\[object Object\]/.test(body)) log("TEXT-GLITCH", (body.match(/.{0,40}(undefined|NaN|\[object Object\]).{0,40}/) || [""])[0]);
  let hit = null;
  for (const re of PRIORITY) { const i = texts.findIndex(t => re.test(t)); if (i >= 0) { hit = p.locator("button:visible").nth(i); log("CLICK", texts[i].slice(0, 30)); break; } }
  if (!hit) {
    const i = texts.findIndex(t => /NATURAL FIT/i.test(t));
    if (i >= 0) { hit = p.locator("button:visible").nth(i); log("SLOT", texts[i]); }
    else if (texts.some(t => /^Back to roster/i.test(t))) {
      const j = texts.findIndex(t => /^(GK|RB|CB|LB|CDM|CM|CAM|RM|LM|RW|LW|ST|CF|RWB|LWB|BENCH)\b/.test(t));
      if (j >= 0) { hit = p.locator("button:visible").nth(j); log("SLOT-ANY", texts[j]); }
    }
  }
  if (!hit) {
    // a player card / slot to pick: any visible button with a rating number in it
    const i = texts.findIndex(t => /\b[4-9]\d\b/.test(t) && t.length < 80 && !/SPIN/i.test(t));
    if (i >= 0) { hit = p.locator("button:visible").nth(i); log("PICK", texts[i].slice(0, 40)); }
  }
  if (!hit) { if (same > 6) { log("STUCK"); await snap("stuck"); break; } continue; }
  await hit.click({ timeout: 4000 }).catch(e => log("CLICKFAIL", e.message.slice(0, 80)));
}
await snap("end");
await b.close();
