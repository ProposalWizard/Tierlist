/**
 * scripts/perf/tap-profile.mjs — which code runs during a slow tap (speed audit, 20 Nov 2026).
 * Records a CPU profile from the tap to 6 s after, and prints the top functions
 * by self time with a snippet of the minified chunk around each (string
 * literals in the snippet name the source module).
 *   node scripts/perf/tap-profile.mjs http://localhost:3123 /tmp/save.json stats|kickoff|garden|house|teamsheet
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [BASE, SAVEF, WHICH] = process.argv.slice(2);
const SAVE = JSON.parse(readFileSync(SAVEF, "utf8"));
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => { if (!localStorage.getItem("perf-seeded")) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); localStorage.setItem("perf-seeded", "1"); } localStorage.setItem("kib-cookie-consent", "no"); }, SAVE);
const pg = await ctx.newPage();
const cdp = await ctx.newCDPSession(pg);
await pg.goto(`${BASE}/star-dev`); await pg.locator('[data-tour="home"]').first().waitFor({ timeout: 60000 }); await pg.waitForTimeout(3000);
const btn = (re) => pg.locator("button:visible").filter({ hasText: re }).first();
let target;
if (WHICH === "stats") target = pg.locator('[aria-label="Go to Stats"]').first();
if (WHICH === "teamsheet") target = pg.locator('[data-tour="nav-play"]').first();
if (WHICH === "garden" || WHICH === "house") { await pg.locator('[data-tour="nav-phone"]').first().click(); await pg.waitForTimeout(1500); target = btn(WHICH === "garden" ? /^\W*Garden$/ : /Your house/); }
if (WHICH === "kickoff") { await pg.locator('[data-tour="nav-play"]').first().click(); await pg.waitForTimeout(3000); target = btn(/KICK OFF/i); }
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); await cdp.send("Profiler.start");
await target.click(); await pg.waitForTimeout(6000);
const { profile } = await cdp.send("Profiler.stop");
const dt = {}; const ids = profile.samples; const deltas = profile.timeDeltas;
for (let i = 0; i < ids.length; i++) dt[ids[i]] = (dt[ids[i]] || 0) + (deltas[i] || 0);
const agg = new Map();
for (const n of profile.nodes) { const cf = n.callFrame; if (!dt[n.id]) continue; const k = `${cf.functionName || "(anon)"}|${cf.url}|${cf.lineNumber}|${cf.columnNumber}`; agg.set(k, (agg.get(k) || 0) + dt[n.id] / 1000); }
const byFile = new Map(); for (const [k, ms] of agg) { const u = k.split("|")[1].replace(/.*\/_next\//, "") || "(native)"; byFile.set(u, (byFile.get(u) || 0) + ms); }
console.log("== self ms by file"); [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([u, ms]) => console.log(Math.round(ms), u));
console.log("== top functions");
const srcCache = {};
for (const [k, ms] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  const [fn, url, line, col] = k.split("|"); let snip = "";
  if (url.startsWith("http")) { srcCache[url] ??= await (await fetch(url)).text(); const lines = srcCache[url].split("\n"); const L = lines[+line] || ""; snip = L.slice(Math.max(0, +col - 60), +col + 160).replace(/\s+/g, " "); }
  console.log(Math.round(ms) + "ms", fn, url.replace(/.*\/_next\//, ""), "::", snip);
}
await browser.close();
