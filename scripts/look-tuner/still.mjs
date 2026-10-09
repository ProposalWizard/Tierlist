#!/usr/bin/env node
// scripts/look-tuner/still.mjs — one still of a 3D screen, at phone size, on this machine's software WebGL.
//   node scripts/look-tuner/still.mjs <url> <out.jpg> [--wait "js"] [--seek S] [--settle ms] [--canvas]
import { openPhone, settle } from "./browser.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const [url, out] = args;
const { browser, page } = await openPhone(url, { waitFor: opt("wait"), settleMs: Number(opt("settle", "4000")), storage: opt("storage") ? JSON.parse(opt("storage")) : undefined });
const seek = opt("seek");
if (seek !== undefined) await page.evaluate(async (t) => { if (window.__frameStep) await window.__frameStep.seek(Number(t)); }, seek);
await settle(page);
if (args.includes("--canvas")) await page.locator("canvas").first().screenshot({ path: out, type: "jpeg", quality: 92 });
else await page.screenshot({ path: out, type: "jpeg", quality: 92 });
console.log("wrote", out);
await browser.close();
