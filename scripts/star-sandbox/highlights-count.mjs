/**
 * scripts/star-sandbox/highlights-count.mjs — play ONE real career match at
 * phone size (390 x 844), signed out, and count the highlights (your chances)
 * and time every build-up on the wall clock (22 Oct 2026, Harry: "barely any
 * highlights" and "buildups are still too slow").
 *
 *   node scripts/star-sandbox/highlights-count.mjs --url http://localhost:3109 \
 *     --query "fhr=on&realmoments=on" --out docs/handoffs/2026-10-22-highlights [--tag now]
 *
 * New career → (sims the trial with its dev panel) → first match. In the match:
 * every chance is struck at goal; every build-up ("Build-up · tap to skip",
 * [data-buildup]) is timed from the moment it shows to the moment it goes
 * (the chance is yours). The page's frame rate is sampled. Writes stills.
 * Handles the "Who are you?" sign-up page (ProfileSetup) and the old two-input one.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = val("--url", "http://localhost:3109");
const Q = val("--query", "fhr=on&realmoments=on");
const OUT = val("--out", "/tmp/highlights"); mkdirSync(OUT, { recursive: true });
const TAG = val("--tag", "run");
const MAX_MIN = Number(val("--minutes", "25"));

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false });
const pg = await ctx.newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
pg.on("console", (m) => { if (m.type() === "error" && !/sentry|posthog|status of (404|400|500)|favicon|flagcdn/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
const click = async (re, ms = 4000) => {
  const btn = pg.locator("button:visible").filter({ hasText: re }).first();
  try { await btn.waitFor({ state: "visible", timeout: ms }); const t = (await btn.innerText()).replace(/\s+/g, " ").trim(); await btn.click({ timeout: 4000 }); await pg.waitForTimeout(1200); return t; } catch { return null; }
};
const text = async () => (await pg.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
let still = 0;
const snap = (name) => pg.screenshot({ path: `${OUT}/${TAG}-${String(++still).padStart(2, "0")}-${name}.jpg`, type: "jpeg", quality: 62 }).catch(() => {});

await pg.goto(`${BASE}/star-dev?${Q}`, { waitUntil: "domcontentloaded", timeout: 600000 });
await pg.locator("input").first().waitFor({ timeout: 600000 });
await pg.waitForTimeout(1500);

// ── The sign-up: "Who are you?" (ProfileSetup) or the old two inputs ──
async function signUp() {
  const inputs = pg.locator("input:visible");
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const inp = inputs.nth(i);
    const type = (await inp.getAttribute("type")) ?? "text";
    if (type !== "text" && type !== "search" && type !== null) continue;
    const ph = ((await inp.getAttribute("placeholder")) ?? "").toLowerCase();
    const v = /last|surname/.test(ph) ? "Striker" : i === 0 || /first|name/.test(ph) ? "Test" : "Striker";
    if (!(await inp.inputValue().catch(() => ""))) await inp.fill(v).catch(() => {});
  }
}
await signUp();
await snap("signup");
await click(/Next|Continue/i);

// ── Walk to the first match ──
const t0 = Date.now();
let inMatch = false, kicked = false, playedOnce = 0, stuckN = 0;
while (Date.now() - t0 < 10 * 60 * 1000) {
  if (kicked && await pg.evaluate(() => !!window.__starMatch)) { inMatch = true; break; }
  if (await pg.locator("input:visible").count() && /Who are you|first name|last name/i.test(await text())) { await signUp(); }
  const dev = pg.locator("button").filter({ hasText: /Dev: Skip \/ Sim Trial/i }).first();
  if (await dev.isVisible().catch(() => false)) {
    const sim = pg.locator("button").filter({ hasText: /Sim whole trial/i }).first();
    if (!(await sim.isVisible().catch(() => false))) { await dev.click(); await pg.waitForTimeout(800); }
    if ((await sim.isVisible().catch(() => false)) && (await sim.isEnabled().catch(() => false))) { await sim.click(); await pg.waitForTimeout(3000); console.log("trial simmed"); continue; }
    await pg.waitForTimeout(1500); continue;
  }
  const card = pg.locator('[role="button"][aria-label="Continue"]').first();
  if (await card.isVisible().catch(() => false)) { await card.click({ timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(1000); continue; }
  if (await click(/^\s*CLOSE\s*$/i, 400)) continue;
  const tour = pg.getByText(/^\s*(next|done|got it|finish)\s*[▸›>]?\s*$/i).first();
  if (await tour.isVisible().catch(() => false)) { await tour.click({ timeout: 3000 }).catch(() => {}); await pg.waitForTimeout(600); continue; }
  const go = await click(/Kick off|Team sheets|Play Match|Play match|Next match|Match day/i, 1200);
  if (go) { kicked = true; console.log("step:", go); continue; }
  const texts = await pg.locator("button:visible").allInnerTexts();
  const playAt = texts.findIndex((t) => t.replace(/\s+/g, " ").trim().toUpperCase() === "PLAY");
  if (playAt >= 0 && playedOnce < 30) { playedOnce++; await pg.locator("button:visible").nth(playAt).click({ timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(2500); continue; }
  const did = await click(/Kick off|Team sheets|Play Match|▶ *Play|hear him out|Accept|Continue|Next|Start|Let.s go|^OK|Got it|Done|Sign|^\s*Skip\s*$|Tap to|Create|Begin/i, 2500);
  if (did && /Kick off|Play Match|Team sheets/i.test(did)) kicked = true;
  if (!did) {
    stuckN++;
    if (stuckN === 3) await snap("stuck");
    if (stuckN % 4 === 3) {
      // A full-screen scene with a SKIP corner button: press it by its box.
      const sk = pg.locator("button:visible").filter({ hasText: /^\s*SKIP\s*$/i }).first();
      const bb = await sk.boundingBox().catch(() => null);
      if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      else await pg.mouse.click(195, 600);
    }
    console.log("  stuck? buttons:", (await pg.locator("button:visible").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 25).join(" | "));
    await pg.waitForTimeout(1500);
  }
}
console.log("in match:", inMatch, `(${((Date.now() - t0) / 1000).toFixed(0)} s to get there)`);
await snap("kickoff");

// Frame rate, sampled in the page.
await pg.evaluate(() => {
  const w = window; w.__fps = { n: 0, t0: performance.now() };
  const f = () => { w.__fps.n++; requestAnimationFrame(f); }; requestAnimationFrame(f);
});

// ── The match ──
const buildUps = []; // { start, end, wall, kind, planned }
const chances = [];
let bu = null, lastKey = null, shots = 0;
const tM = Date.now();
let lastProgress = Date.now();
let noMatchSince = null, lastStrike = 0, retryKey = null, stalls = 0, lastSig = "";
while (inMatch && Date.now() - tM < MAX_MIN * 60 * 1000) {
  const st = await pg.evaluate(() => {
    const m = window.__starMatch;
    const buEl = document.querySelector("[data-buildup]");
    const last = window.__starLastBuildUp ?? null;
    let key = null, kind = null;
    try { const f = m?.frame?.(); kind = f?.kind ?? null; key = f ? `${f.kind}:${f.sc.ball.x.toFixed(2)}:${f.sc.ball.y.toFixed(2)}` : null; } catch {}
    return { has: !!m, phase: m?.phase?.() ?? null, kind, key, bu: !!buEl, buText: buEl?.textContent ?? null, last, realLast: window.__starLastRealMoment ?? null };
  }).catch(() => ({ has: false }));
  const now = Date.now();
  const sig = `${st.phase}/${st.bu ? "bu" : "-"}`;
  if (sig !== lastSig) { if (process.env.HC_TRACE) console.log(`    [${((now - tM) / 1000).toFixed(1)} s] ${sig} ${st.kind ?? ""}`); lastSig = sig; }
  if (st.bu && !bu) { bu = { start: now, kind: st.kind, planned: st.last?.durS ?? null, real: !!(st.realLast && now - st.realLast.at < 3000) }; if (buildUps.length < 2) { await pg.waitForTimeout(900); await snap(`buildup-${buildUps.length + 1}`); } }
  if (!st.bu && bu) { bu.end = now; bu.wall = (bu.end - bu.start) / 1000; buildUps.push(bu); console.log(`  build-up ${buildUps.length}: ${bu.wall.toFixed(2)} s wall (planned ${bu.planned?.toFixed?.(2) ?? "?"} s, ${bu.kind}${bu.real ? ", REAL moment" : ""})`); bu = null; }
  // The same chance still waiting (a strike that did not take): strike it again.
  if (st.has && st.phase === "aim" && !st.bu && st.key === lastKey && now - lastStrike > 12000) lastKey = null;
  if (st.has && st.phase === "aim" && !st.bu && st.key && st.key !== lastKey) {
    // The build-up's label renders a moment after the phase turns to aim: look
    // again before touching anything (a touch would skip it).
    await pg.waitForTimeout(450);
    const buNow = await pg.evaluate(() => !!document.querySelector("[data-buildup]")).catch(() => false);
    if (buNow) continue;
    lastStrike = Date.now();
    const isNew = retryKey !== st.key;
    retryKey = st.key;
    lastKey = st.key; lastProgress = now;
    if (isNew) {
    const real = !!(st.realLast && now - st.realLast.at < 15000 && chances.length && false);
    chances.push({ at: now, kind: st.kind, real });
    console.log(`  chance ${chances.length}: ${st.kind} at ${((now - tM) / 1000).toFixed(1)} s`);
    if (chances.length <= 2) await snap(`chance-${chances.length}-${st.kind}`);
    }
    await pg.waitForTimeout(200);
    // Strike it at goal: pull back from the ball, away from the goal, then tap the contact ball.
    const g = await pg.evaluate(() => ({ ball: window.__starMatch.ball(), goal: window.__starMatch.goal() })).catch(() => null);
    if (g) {
      const dx = g.ball.x - g.goal.x, dy = g.ball.y - g.goal.y, L = Math.hypot(dx, dy) || 1;
      await pg.mouse.move(g.ball.x, g.ball.y); await pg.mouse.down();
      for (let i = 1; i <= 12; i++) { await pg.mouse.move(g.ball.x + (dx / L) * 85 * i / 12, g.ball.y + (dy / L) * 85 * i / 12); await pg.waitForTimeout(16); }
      await pg.mouse.up(); await pg.waitForTimeout(500);
      // A penalty or free kick runs up first: the contact ball shows when he arrives.
      const cb = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
      await cb.waitFor({ state: "visible", timeout: 7000 }).catch(() => {});
      const bb = await cb.boundingBox().catch(() => null);
      if (bb) { await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); shots++; }
    }
    continue;
  }
  if (st.has) noMatchSince = null; else noMatchSince ??= now;
  if (!st.has || st.phase === "result" || st.phase === "feed" || st.phase === null) {
    // The match is over once the match has been gone a while (a page re-render
    // mid-match removes it for a moment) and a full-time screen shows.
    if (noMatchSince && now - noMatchSince > 8000) {
      const t = await text();
      if (/FULL TIME|Full time|Player Ratings|MATCH STATS|Match report|Rating/i.test(t) || now - noMatchSince > 90000) { console.log("→ full time:", t.slice(0, 160)); break; }
    }
    await click(/^(Continue|Next|Play on|Resume|OK|Kick off|Second half|GET OUT THERE|FULL TIME)/i, 300);
  }
  // A dribble or anything else waiting on a tap: nudge it on after a while.
  if (now - lastProgress > 25000) {
    stalls++;
    const bt = (await pg.locator("button:visible").allInnerTexts().catch(() => [])).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 14).join(" | ");
    console.log(`  (stall ${stalls}: has ${st.has}, phase ${st.phase}, kind ${st.kind}; buttons: ${bt})`);
    if (stalls <= 3) await snap(`stall-${stalls}`);
    // Any obvious way on, then a tap on the pitch.
    if (!(await click(/^(Continue|Next|Play on|Resume|OK|Kick off|Second half|Done|Skip|Close|Back to match)/i, 500)) && st.phase !== "feed") {
      const c = await pg.evaluate(() => { const cv = document.querySelector("canvas"); const r = cv?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height * 0.4 } : null; });
      if (c) await pg.mouse.click(c.x, c.y);
    }
    lastProgress = now;
  }
  await pg.waitForTimeout(60);
}
const fps = await pg.evaluate(() => { const f = window.__fps; return f ? f.n / ((performance.now() - f.t0) / 1000) : null; }).catch(() => null);
await snap("end");
const tx = await text();
const score = (tx.match(/\b\d+\s*[-–]\s*\d+\b/) ?? [""])[0];
const walls = buildUps.map((x) => x.wall);
const sum = walls.reduce((a, c) => a + c, 0);
console.log(`\nRESULT ${TAG}: chances ${chances.length} (shots taken ${shots}), build-ups ${buildUps.length}, wall seconds in build-ups ${sum.toFixed(1)} (mean ${(sum / Math.max(1, walls.length)).toFixed(2)}, min ${Math.min(...walls).toFixed(2)}, max ${Math.max(...walls).toFixed(2)}), page fps ${fps?.toFixed(1)}, match ${((Date.now() - tM) / 1000).toFixed(0)} s wall, score text "${score}"`);
console.log("kinds:", chances.map((c) => c.kind).join(", "));
console.log("planned vs wall:", buildUps.map((x) => `${x.planned?.toFixed?.(1) ?? "?"}/${x.wall.toFixed(1)}`).join(" "));
console.log("errors:", errs.length ? [...new Set(errs)].slice(0, 6).join("\n") : "(none)");
await b.close();
