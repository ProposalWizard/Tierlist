/**
 * WHAT FREEZES WHEN YOU COME ON FROM THE BENCH (lag pass 4, 9 Oct 2026).
 * The same route as measure.mjs (a signed-out save, Home → PLAY → KICK OFF),
 * then a CPU profile from the "GET OUT THERE" tap to the first chance's aim,
 * with every long task and the functions inside the worst one.
 *
 *   npx tsx scripts/perf2d/make-save.mts > /tmp/save.json
 *   node scripts/perf2d/bench-prof.mjs http://localhost:3123 /tmp/save.json
 */
import { chromium, devices } from "playwright";
import { readFileSync } from "node:fs";
const BASE = process.argv[2] || "http://localhost:3123";
const SAVE = JSON.parse(readFileSync(process.argv[3], "utf8"));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", headless: true });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
await ctx.addInitScript((save) => {
  try { if (!localStorage.getItem("perf-seeded")) { for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v); localStorage.setItem("perf-seeded", "1"); } } catch {}
  window.__perf = { long: [] };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "longtask", buffered: true }); } catch {}
}, SAVE);
const pg = await ctx.newPage();
const cdp = await ctx.newCDPSession(pg);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await pg.goto(`${BASE}/star-dev`);
await pg.locator("button:visible").first().waitFor({ timeout: 120000 });
await pg.waitForTimeout(3000);
const texts = async () => (await pg.locator("button:visible").allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
for (let i = 0; i < 30; i++) {
  const btns = await texts();
  const pick = [/KICK OFF/i, /Team sheets/i, /Play Match/i, /^NEXT/i, /Got it/i, /^Done/i, /^Skip/i, /^Continue/i, /^Close/i, /Let.s go/i, /^▶? *PLAY$/i].find((re) => btns.some((b) => re.test(b)));
  if (!pick) break;
  await pg.locator("button:visible").filter({ hasText: pick }).first().click();
  if (/KICK OFF|Play Match/.test(String(pick))) break;
  await pg.waitForTimeout(1500);
}
const getOut = pg.locator("button:visible").filter({ hasText: /GET OUT THERE|Come on|Go on/i }).first();
await getOut.waitFor({ state: "visible", timeout: 60000 });
await pg.waitForTimeout(1500);
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 250 });
await pg.evaluate(() => { window.__perf.long = []; window.__t0 = performance.now(); });
await cdp.send("Profiler.start");
const tStart = await pg.evaluate(() => performance.now());
await getOut.click();
await pg.evaluate(async () => { for (let i = 0; i < 1200; i++) { if (window.__starMatch && window.__starMatch.phase() === "aim") return; await new Promise((r) => setTimeout(r, 25)); } });
await pg.waitForTimeout(1500);
const { profile } = await cdp.send("Profiler.stop");
const long = await pg.evaluate(() => window.__perf.long.map(([s, d]) => [Math.round(s - window.__t0), d]));
console.log("long tasks [ms after the tap, ms long]:", JSON.stringify(long));
// the worst long task's window, in profile time (µs since the profile's start)
const ranked = [...long].sort((a, b) => b[1] - a[1]);
const worst = ranked[+(process.env.NTH || 0)] ?? null; // NTH=1: the second-worst
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const name = (n) => `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`;
const t0us = profile.startTime;
const pageT0 = tStart; // performance.now() at the profile's start (close enough: the tap follows at once)
let t = t0us;
const incl = new Map();
profile.samples.forEach((id, i) => {
  t += profile.timeDeltas[i] || 0;
  const ms = (t - t0us) / 1000;
  if (!worst || ms < worst[0] - 20 || ms > worst[0] + worst[1] + 20) return;
  const seen = new Set(); let p = id;
  while (p) { const k = name(byId.get(p)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + (profile.timeDeltas[i] || 0)); } p = parent.get(p); }
});
void pageT0;
console.log("worst long task:", JSON.stringify(worst), "— functions inside it (inclusive ms):");
[...incl].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOP || 60)).forEach(([k, us]) => console.log((us / 1000).toFixed(0).padStart(6), k));
await browser.close();
