import { chromium } from "/home/user/Tierlist/node_modules/playwright/index.mjs";
import fs from "fs";
const ROOT = "/tmp/claude-0/-home-user-Tierlist/06265a1b-84e9-513f-a9d9-be07aadc231e/scratchpad/pn-split/";
const keys = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const k of keys) {
  const dir = ROOT + (k === "index" ? "index" : k) + "/";
  const body = fs.readFileSync(dir + "index.html", "utf8");
  fs.writeFileSync(dir + "_preview.html", '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}</style>' + body);
  for (const [name, vp, scheme] of [["phone-dark", { width: 390, height: 844 }, "dark"], ["phone-light", { width: 390, height: 844 }, "light"], ["pc-dark", { width: 1280, height: 900 }, "dark"]]) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", e => errs.push(e.message));
    p.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
    await p.goto("file://" + dir + "_preview.html");
    await p.waitForTimeout(400);
    // force-load lazy images
    await p.evaluate(async () => { for (const i of document.images) { i.loading = "eager"; } await Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))); });
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight,
      broken: [...document.images].filter(i => !i.naturalWidth).map(i => i.getAttribute("src")),
      wide: [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map(e => e.tagName + "." + e.className) }));
    console.log(k, name, JSON.stringify(m), errs.length ? "ERR " + errs.join("|") : "");
    if (name !== "phone-light" || k === "b1" || k === "index" || k === "b9") await p.screenshot({ path: `${dir}_${name}.png`, fullPage: true });
    await ctx.close();
  }
}
await b.close();
