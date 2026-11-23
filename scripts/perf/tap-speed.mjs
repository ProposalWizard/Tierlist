/**
 * scripts/perf/tap-speed.mjs — SPEED AUDIT (measure only, 20 Nov 2026).
 *
 * Time from a tap to the next screen being painted, at 390x844, against a
 * production server built with NEXT_PUBLIC_STAR_OFFLINE_DEV=1.
 *
 *   npx tsx scripts/perf2d/make-save.mts > /tmp/save.json
 *   node scripts/perf/tap-speed.mjs http://localhost:3123 /tmp/save.json [--cpu 4] [--shots dir] [--reps 3]
 *
 * How a tap is timed: a capture-phase listener stamps the click event's time
 * (performance.now clock). Then a requestAnimationFrame loop checks each
 * frame for the new screen's first element; when it is there, one more
 * requestAnimationFrame, and that time is "painted". Result = painted - tap.
 * Also counts long tasks (>50 ms) in the 8 s after the tap; "settled" = when the last of them ended ("busy ms").
 * Prints JSON: median of the repeats for each step.
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const BASE = argv[0] || "http://localhost:3123";
const SAVE = JSON.parse(readFileSync(argv[1] || "/tmp/save.json", "utf8"));
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const CPU = Number(opt("--cpu", "1"));
const REPS = Number(opt("--reps", "3"));
const SHOTS = opt("--shots", null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const median = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

async function newPage({ seed = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(([save, seed]) => {
    try {
      if (!localStorage.getItem("perf-seeded")) {
        if (seed) for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v);
        localStorage.setItem("perf-seeded", "1");
      }
      // No cookie banner in the way.
      localStorage.setItem("kib-cookie-consent", "no");
    } catch {}
    window.__long = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true }); } catch {}
    document.addEventListener("click", (e) => { window.__tap = e.timeStamp; }, true);
  }, [SAVE, seed]);
  const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg);
  if (CPU > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  pg.__errors = [];
  pg.on("pageerror", (e) => pg.__errors.push(e.message.slice(0, 160)));
  return { ctx, pg, cdp };
}

const dismissCookies = async (pg) => { const b = pg.locator("button:visible").filter({ hasText: /^No thanks$/ }).first(); if (await b.count()) await b.click().catch(() => {}); };
const toHome = async (pg) => {
  await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded" });
  await pg.locator('[data-tour="home"]').first().waitFor({ state: "visible", timeout: 60000 });
  await dismissCookies(pg);
  await pg.waitForTimeout(1500);
};

/** Tap `locator`, then wait in the page for `ready` (a function source run each frame). */
async function timeTap(pg, locator, ready, label) {
  await pg.evaluate(() => { window.__tap = null; window.__long = []; });
  await locator.click({ timeout: 8000 });
  const r = await pg.evaluate(async (src) => {
    const ready = new Function(`return (${src})()`);
    const frame = () => new Promise((res) => requestAnimationFrame(() => res(performance.now())));
    const tEnd = performance.now() + 20000;
    while (performance.now() < tEnd) {
      await frame();
      let ok = false; try { ok = !!ready(); } catch {}
      if (ok) { const painted = await frame(); return { ms: painted - (window.__tap ?? painted) }; }
    }
    return { ms: null };
  }, ready.toString());
  await pg.waitForTimeout(8000);
  r.settled = await pg.evaluate(() => { const t = window.__tap; const l = window.__long.filter((x) => x[0] >= t - 5); return t == null ? null : Math.round(l.length ? Math.max(...l.map((x) => x[0] + x[1])) - t : 0); });
  r.busy = await pg.evaluate(() => Math.round(window.__long.reduce((s, l) => s + l[1], 0)));
  r.worst = await pg.evaluate(() => Math.round(Math.max(0, ...window.__long.map((l) => l[1]))));
  if (r.ms != null) r.ms = Math.round(r.ms);
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${label}.png`, timeout: 8000 }).catch(() => {});
  return r;
}

// Predicates run inside the page.
const visText = (re) => `() => ${re}.test(document.body.innerText)`;
const P = {
  league: () => /\bPts\b|\bPTS\b/.test(document.body.innerText),
  stats: () => !!document.querySelector("[data-stats-chip]") || /Appearances|Apps/i.test(document.body.innerText),
  shop: () => /Boots|Lifestyle|KIB/i.test(document.body.innerText) && !document.querySelector('[data-tour="home"][aria-current="page"]'),
  phone: () => [...document.querySelectorAll("button")].some((b) => /Garden/.test(b.innerText)),
  canvas3d: () => [...document.querySelectorAll("canvas")].some((c) => c.width > 100 && c.getBoundingClientRect().height > 300 && !c.dataset.before),
  settings: () => /Full screen|Sound/i.test(document.body.innerText),
  versus: () => /KICK OFF/i.test(document.body.innerText),
  match: () => [...document.querySelectorAll("canvas")].some((c) => { if (c.dataset.before || c.getBoundingClientRect().height < 300 || !c.width) return false; const g = c.getContext("2d"); if (!g) return true; return g.getImageData(c.width / 2, c.height / 2, 1, 1).data[3] > 0; }),
};
const markCanvases = (pg) => pg.evaluate(() => document.querySelectorAll("canvas").forEach((c) => { c.dataset.before = "1"; }));

const btnText = (pg, re) => pg.locator("button:visible").filter({ hasText: re }).first();

const STEPS = {
  async "Home → League"(pg) { await toHome(pg); return timeTap(pg, pg.locator('[data-tour="nav-league"]').first(), P.league, "league"); },
  async "Home → Stats"(pg) { await toHome(pg); return timeTap(pg, pg.locator('[aria-label="Go to Stats"]').first(), P.stats, "stats"); },
  async "Home → Shop"(pg) { await toHome(pg); return timeTap(pg, pg.locator('[aria-label="Go to Shop"]').first(), P.shop, "shop"); },
  async "Open the phone"(pg) { await toHome(pg); return timeTap(pg, pg.locator('[data-tour="nav-phone"]').first(), P.phone, "phone"); },
  async "Phone → Garden (3D)"(pg) { await toHome(pg); await pg.locator('[data-tour="nav-phone"]').first().click(); await pg.waitForTimeout(1500); await markCanvases(pg); return timeTap(pg, btnText(pg, /^\W*Garden$/), P.canvas3d, "garden"); },
  async "Phone → House (3D)"(pg) { await toHome(pg); await pg.locator('[data-tour="nav-phone"]').first().click(); await pg.waitForTimeout(1500); await markCanvases(pg); return timeTap(pg, btnText(pg, /Your house/), P.canvas3d, "house"); },
  async "Open Settings"(pg) { await toHome(pg); return timeTap(pg, pg.locator('button[aria-label="Settings"]').first(), P.settings, "settings"); },
  async "Play → team sheet"(pg) { await toHome(pg); return timeTap(pg, pg.locator('[data-tour="nav-play"]').first(), P.versus, "teamsheet"); },
  async "Kick off"(pg) { await toHome(pg); await toPreMatch(pg); await markCanvases(pg); return timeTap(pg, btnText(pg, /KICK OFF/i), P.match, "kickoff"); },
};

async function toPreMatch(pg) {
  await pg.locator('[data-tour="nav-play"]').first().click();
  for (let i = 0; i < 12; i++) {
    await pg.waitForTimeout(1500);
    const txt = (await pg.locator("button:visible").allInnerTexts()).join(" | ");
    if (/KICK OFF/i.test(txt)) return;
    if (/Team sheets/i.test(txt)) { await btnText(pg, /Team sheets/i).click(); continue; }
    const pick = [/^Got it/i, /^Skip/i, /^Continue/i, /^NEXT/i, /^Close/i, /Let.s go/i, /^Done/i, /Pre-match|Match day|^▶? *PLAY$/i].find((re) => txt.split(" | ").some((b) => re.test(b.trim())));
    if (!pick) throw new Error("stuck before Team sheets: " + txt.slice(0, 200));
    await btnText(pg, pick).click().catch(() => {});
  }
  throw new Error("Team sheets never showed");
}

const out = { cpu: CPU, steps: {}, errors: [] };

// First load: cold (fresh browser cache) and JS on the wire.
for (let rep = 0; rep < REPS; rep++) {
  const { ctx, pg, cdp } = await newPage();
  await cdp.send("Network.enable");
  const reqs = new Map();
  cdp.on("Network.responseReceived", (e) => reqs.set(e.requestId, { ...(reqs.get(e.requestId) || {}), type: e.type, url: e.response.url }));
  cdp.on("Network.loadingFinished", (e) => reqs.set(e.requestId, { ...(reqs.get(e.requestId) || {}), bytes: e.encodedDataLength }));
  const t0 = Date.now();
  await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded" });
  await pg.locator('[data-tour="home"]').first().waitFor({ state: "visible", timeout: 120000 });
  const tHome = Date.now() - t0;
  await pg.waitForTimeout(4000);
  const all = [...reqs.values()];
  const kb = (a) => Math.round(a.reduce((s, r) => s + (r.bytes || 0), 0) / 1024);
  const nav = await pg.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; const fcp = performance.getEntriesByName("first-contentful-paint")[0]; return { fcp: fcp ? Math.round(fcp.startTime) : null, dcl: Math.round(n.domContentLoadedEventEnd) }; });
  (out.firstLoad ||= []).push({ msToHomeVisible: tHome, ...nav, jsKB: kb(all.filter((r) => r.type === "Script")), jsFiles: all.filter((r) => r.type === "Script").length, allKB: kb(all), requests: all.length });
  await ctx.close();
}

// Start a career: a fresh device, profile → club → Start Career.
const startRuns = [];
for (let rep = 0; rep < REPS; rep++) {
  const { ctx, pg } = await newPage({ seed: false });
  try {
    await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded" });
    await pg.locator("input").first().waitFor({ timeout: 60000 });
    await dismissCookies(pg);
    let startBtn = null;
    for (let i = 0; i < 12 && !startBtn; i++) {
      const ins = pg.locator("input:visible");
      if (await ins.count() >= 2) { await ins.first().fill("Speed"); await ins.nth(1).fill("Test"); }
      const txt = (await pg.locator("button:visible").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
      const st = txt.find((t) => /Start (my |your )?career|Begin|Sign (for|the contract)|Let.s go/i.test(t));
      if (st) { startBtn = btnText(pg, new RegExp("^" + st.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$")); break; }
      const ars = txt.find((t) => /^Arsenal/i.test(t));
      if (ars && i > 0) await btnText(pg, /^Arsenal/i).click().catch(() => {});
      await btnText(pg, /^(Continue|Next)/i).click({ timeout: 3000 }).catch(() => {});
      await pg.waitForTimeout(1200);
    }
    if (!startBtn) throw new Error("no start button: " + (await pg.locator("button:visible").allInnerTexts()).join(" | ").slice(0, 200));
    // Next screen = the start button is gone and something else is drawn (a signing scene may come before Home).
    await pg.evaluate((t) => { window.__startText = t; }, await startBtn.innerText());
    const r = await timeTap(pg, startBtn, () => ![...document.querySelectorAll("button")].some((b) => b.innerText === window.__startText) && document.body.innerText.trim().length > 0, "start-career");
    r.label = await pg.evaluate(() => window.__startText);
    startRuns.push(r);
  } catch (e) { startRuns.push({ ms: null, error: e.message.split("\n")[0].slice(0, 160) }); if (SHOTS) await pg.screenshot({ path: `${SHOTS}/start-career-FAIL-${rep}.png`, timeout: 8000 }).catch(() => {}); }
  out.errors.push(...pg.__errors); await ctx.close();
}
out.steps["Start a career"] = startRuns;

for (const [name, fn] of Object.entries(STEPS)) {
  const runs = [];
  for (let rep = 0; rep < REPS; rep++) {
    const { ctx, pg } = await newPage();
    console.error("…", name, rep); try { runs.push(await fn(pg)); }
    catch (e) { runs.push({ ms: null, error: e.message.split("\n")[0].slice(0, 160) }); if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${name.replace(/\W+/g, "-")}-FAIL-${rep}.png`, timeout: 8000 }).catch(() => {}); }
    out.errors.push(...pg.__errors); await ctx.close();
  }
  out.steps[name] = runs;
}

out.summary = Object.fromEntries(Object.entries(out.steps).map(([k, runs]) => [k, { medianMs: median(runs.map((r) => r.ms)), runs: runs.map((r) => r.ms), medianBusyMs: median(runs.map((r) => r.busy)), medianSettledMs: median(runs.map((r) => r.settled)), worstTaskMs: Math.max(0, ...runs.map((r) => r.worst || 0)), errors: runs.map((r) => r.error).filter(Boolean) }]));
out.firstLoadMedian = out.firstLoad && Object.fromEntries(Object.keys(out.firstLoad[0]).map((k) => [k, median(out.firstLoad.map((f) => f[k]))]));
out.errors = [...new Set(out.errors)].slice(0, 12);
console.log(JSON.stringify({ cpu: out.cpu, firstLoad: out.firstLoad, firstLoadMedian: out.firstLoadMedian, summary: out.summary, errors: out.errors }, null, 1));
await browser.close();
