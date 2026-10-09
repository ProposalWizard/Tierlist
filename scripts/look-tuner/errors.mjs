#!/usr/bin/env node
// scripts/look-tuner/errors.mjs — open a 3D screen and print its console errors and warnings once each
// (shader compile errors show up here). node scripts/look-tuner/errors.mjs <url> [--wait "js"] [--ms 15000]
import { openPhone } from "./browser.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const seen = new Set();
const { browser, page } = await openPhone(args[0], {
  waitFor: opt("wait", "document.querySelector('canvas')"),
  settleMs: Number(opt("ms", "15000")),
  onConsole: (m) => { const t = m.text(); if ((m.type() === "error" || m.type() === "warning") && !seen.has(t.slice(0, 80))) { seen.add(t.slice(0, 80)); console.log(m.type(), t.slice(0, 2500)); } },
});
await page.waitForTimeout(2000);
await browser.close();
