/**
 * FILM SCENES — PLAY ONE REAL CAREER MATCH (Leo, 24 Oct 2026).
 *
 *   import { loadSave, playToReactions } from "./match-lib.mjs";
 *
 * Plays the next fixture of a seeded save to full time with real touches and
 * stops on the Post Match Reactions phone feed. Never moves the ball or sets a
 * result: every shot is a real drag from the ball plus a real tap on the
 * strike screen. Aiming reads where the ball and the posts are on the glass
 * (window.__starMatch, read-only, dev builds only).
 *
 * The match is seeded by the save (season*1000+week), but each page visit
 * also draws a random "visit salt" that picks which drawing a chance is served
 * from. loadSave pins the browser's random numbers (VISIT_SEED) so the same
 * save serves the same chances; the aims below then score the same way.
 * DEFAULT_AIMS[0] was found for the 24 Oct seedMatch.json save (Arsenal v Man
 * City, Community Shield, 30-minute match, skills 90): 7 of 7 runs scored.
 * Another save serves other chances: sweep aims for it (stopAfterChance).
 * Energy: the cans the save owns are drunk first (an empty player is left out).
 */
import { readFileSync } from "node:fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CAREER_KEY = "star-career-v2::anon";

/**
 * The same page visit every run. The match is seeded by the save, but each
 * page visit also draws a "visit salt" from crypto.getRandomValues
 * (lib/star/chanceMaker.ts saltFor) that picks WHICH drawing a chance is
 * served from, so two runs of the same save got different pictures. Here the
 * browser's crypto random numbers (and Math.random) come from a fixed seed
 * instead, so the same save serves the same chances. It picks the situation only: the ball, the
 * keeper and the result are the game's own, untouched.
 */
export const VISIT_SEED = 0x5eed1;
async function pinVisitRandom(page, seed) {
  await page.addInitScript((seed) => {
    let a = seed >>> 0;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0); };
    const orig = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (arr) => {
      if (!(arr instanceof Uint32Array || arr instanceof Uint8Array || arr instanceof Uint16Array || arr instanceof Int32Array)) return orig(arr);
      const max = arr instanceof Uint8Array ? 256 : arr instanceof Uint16Array ? 65536 : 4294967296;
      for (let i = 0; i < arr.length; i++) arr[i] = next() % max;
      return arr;
    };
    // Math.random too (the run after a pass, playOnRngRef, still draws from it).
    let b = (seed ^ 0x9e3779b9) >>> 0;
    Math.random = () => { b = (b + 0x6d2b79f5) >>> 0; let t = b; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, seed);
}

/** Open /star-dev with a save {career, clips} and wait for the Home screen. */
export async function loadSave(page, baseUrl, savePath, { visitSeed = VISIT_SEED } = {}) {
  const seed = JSON.parse(readFileSync(savePath, "utf8"));
  if (visitSeed != null && !page.__visitPinned) { await pinVisitRandom(page, visitSeed); page.__visitPinned = true; }
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(`${baseUrl}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
      await page.evaluate(async ({ career, clips }) => {
        localStorage.clear();
        localStorage.setItem("kib-admin-mode", "off");
        localStorage.setItem("star-career-v2::anon", JSON.stringify(career));
        localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" }));
        for (const n of ["star-goal-clips", "star-goal-videos"]) await new Promise((res) => { const d = indexedDB.deleteDatabase(n); d.onsuccess = d.onerror = d.onblocked = () => res(); });
        const db = await new Promise((res, rej) => { const r = indexedDB.open("star-goal-clips", 1); r.onupgradeneeded = () => { const st = r.result.createObjectStore("clips", { keyPath: "id" }); st.createIndex("createdAt", "createdAt"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        const tx = db.transaction("clips", "readwrite"); for (const c of clips || []) tx.objectStore("clips").put(c); await new Promise((res) => { tx.oncomplete = res; }); db.close();
      }, seed);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
      await page.waitForSelector('[data-tour="nav-play"]', { state: "visible", timeout: 180000 });
      return;
    } catch (e) {
      // The dev server may be recompiling (another chat edits code): retry.
      if (attempt >= 3) throw e;
      await sleep(5000);
    }
  }
}

const readCareer = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, CAREER_KEY);

/** Visible buttons' text (as shown: CSS uppercase is applied). */
const buttons = (page) => page.evaluate(() => Array.from(document.querySelectorAll("button")).filter((b) => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; }).map((b) => b.innerText.replace(/\s+/g, " ").trim()).filter(Boolean));

/** Click the first visible button whose shown text matches. */
async function clickText(page, re) {
  const el = await page.evaluateHandle((src) => {
    const re = new RegExp(src, "i");
    return Array.from(document.querySelectorAll("button")).find((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !b.disabled && re.test(b.innerText.replace(/\s+/g, " ").trim());
    }) || null;
  }, re.source);
  const h = el.asElement();
  if (!h) return null;
  const t = (await h.innerText()).replace(/\s+/g, " ").trim();
  try { await h.click({ timeout: 5000 }); } catch { try { await h.click({ timeout: 3000, force: true }); } catch { return null; } }
  return t;
}

/** The match's read-only dev window: phase, kind, ball and posts on the glass. */
const matchState = (page) => page.evaluate(() => {
  const m = window.__starMatch;
  if (!m) return null;
  try {
    const f = m.frame();
    const get = (r) => f.men.find((x) => x.role === r);
    return { phase: m.phase(), kind: m.kind(), auto: !!(f.sc && f.sc.autoKick), ball: m.ball(), postL: get("postL"), postR: get("postR"), keeper: get("keeper"), you: get("you"), canvas: f.canvas, facing: f.facing };
  } catch { return { phase: m.phase(), kind: m.kind() }; }
});


const bodyText = (page) => page.evaluate(() => document.body.innerText);

/** Dismiss a talking-head dialogue (the agent's "a word", tour cards). */
export async function dismissDialogues(page, log) {
  for (let i = 0; i < 12; i++) {
    const o = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll(".fixed.inset-0")).find((e) => e.innerText.trim() && e.getBoundingClientRect().height > 0);
      if (!el) return null;
      return el.innerText.replace(/\s+/g, " ").slice(0, 100);
    });
    if (!o) return;
    log?.(`dialogue: ${o}`);
    if (!(await clickText(page, /^(OK|Got it|Next ▸|Close|Done)$/))) await page.mouse.click(240, 700);
    await sleep(700);
  }
}

/** The scoreline as the career saw it, and your goals this season. */
const careerGoals = async (page) => (await readCareer(page))?.seasonStats?.goals ?? 0;

/** Wait until fn() is truthy (polls), or the time runs out. */
async function waitFor(fn, ms, every = 250) {
  const end = Date.now() + ms;
  for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await sleep(every); }
}

/**
 * Wait for the chance to settle, untouched: the build-up replay plays out to
 * its drawn end, the run-on men reach their spots and the camera stops. Every
 * man then stands on the same spot every run, whatever the frame rate, so the
 * same aim plays the same way. (Skipping the build-up with a tap, or shooting
 * while men still run, made each run's picture different.)
 */
async function stableAim(page, ms = 60000) {
  let prev = "", same = 0;
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await page.evaluate(() => {
      const m = window.__starMatch;
      if (!m) return null;
      const ph = m.phase();
      if (ph !== "aim") return { ph };
      const f = m.frame();
      const sig = f.men.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(" ") + ` cam ${f.cam.x1.toFixed(2)},${f.cam.y1.toFixed(2)},${f.cam.x2.toFixed(2)},${f.cam.y2.toFixed(2)}`;
      return { ph, sig, bu: /Build-up\s*·\s*tap to skip/i.test(document.body.innerText) };
    }).catch(() => null);
    if (!r || r.ph !== "aim") return await matchState(page);
    if (!r.bu && r.sig === prev) { if (++same >= 4) return await matchState(page); } else same = 0;
    prev = r.sig;
    await sleep(200);
  }
  return await matchState(page);
}

/**
 * One chance, taken for real. `aim`: { t, power, cy } — t is where on the goal
 * line (0 = left post, 1 = right post, on the glass), power 0..1 from the
 * drag length, cy where on the ball you strike (-1 top .. 1 bottom).
 */
async function takeChance(page, s, aim, log) {
  const { ball } = s;
  const tx = s.postL.cx + (s.postR.cx - s.postL.cx) * aim.t;
  const ty = s.postL.cy + (s.postR.cy - s.postL.cy) * aim.t;
  let ux = ball.x - tx, uy = ball.y - ty; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
  // Find the pull length that gives the power asked for (the game's own sum).
  let lo = 10, hi = 260;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const p = await page.evaluate(([dx, dy]) => window.__starMatch?.power(dx, dy) ?? 0, [ux * mid, uy * mid]);
    if (p < aim.power) lo = mid; else hi = mid;
  }
  const pull = (lo + hi) / 2;
  const ex = ball.x + ux * pull, ey = ball.y + uy * pull;
  // Real touches, like a thumb: down on the ball, pull back, let go.
  await page.mouse.move(ball.x, ball.y);
  await page.mouse.down();
  const steps = 14;
  for (let i = 1; i <= steps; i++) { await page.mouse.move(ball.x + (ex - ball.x) * i / steps, ball.y + (ey - ball.y) * i / steps); await sleep(16); }
  await page.mouse.up();
  log?.(`  aim ${s.kind}: t=${aim.t} power=${aim.power} pull=${pull.toFixed(0)}px cy=${aim.cy}`);
  // The strike screen: the ball is a div (ContactBall.tsx). A penalty or free
  // kick jogs up first. A header or volley's ball drifts: tap where it is now.
  const sel = 'div.cursor-pointer[style*="aspect-ratio"]';
  const got = await waitFor(async () => {
    if (await page.locator(sel).count()) return "contact";
    const m = await matchState(page);
    return m && m.phase !== "aim" && m.phase !== "runup" && m.phase !== "contact" ? "gone:" + m.phase : null;
  }, 20000, 60);
  if (got !== "contact") { log?.(`  no strike screen (${got})`); return false; }
  await sleep(350);
  const bb = await page.locator(sel).first().boundingBox().catch(() => null);
  if (!bb) return false;
  const r = bb.width / 2;
  await page.mouse.click(bb.x + r + (aim.cx ?? 0) * r, bb.y + r + aim.cy * r);
  return true;
}

/** Your scoreline on the match's scoreboard (top bar): [you, them]. */
const scoreNow = (page) => page.evaluate(() => {
  const t = document.body.innerText.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 6);
  const n = t.filter((x) => /^\d+$/.test(x)).slice(0, 2).map(Number);
  return n.length === 2 ? n : null;
});

/** The aims, one per chance in the order they come. Picked to score (see top). */
export const DEFAULT_AIMS = [
  // Chance 1 (30+1', a tight angle from the left, ball 11 m wide of the near
  // post): full power at the far post, struck above centre so it stays low.
  // Scored 4 of 4 with VISIT_SEED; t 0.8-0.95 or a chip were saved or over.
  { t: 1.0, power: 1.0, cy: -0.3 },
  // Later chances: not tuned (the header at 30+4 was saved or blocked with
  // every aim tried). A 1-1 goes to penalties, which the loop plays through.
  { t: 0.2, power: 0.85, cy: 0.3 },
  { t: 0.85, power: 0.75, cy: 0.3 },
  { t: 0.15, power: 0.75, cy: 0.3 },
];

/**
 * From the Home screen: top up energy with the cans you own (a tired player is
 * left out), play the match, stop on Post Match Reactions.
 */
export async function playToReactions(page, { log = () => {}, onFullTime, aims = DEFAULT_AIMS, mode = null, penaltyAim = { t: 0.85, power: 0.75, cy: -0.2 }, timeoutMs = 600000, stopAfterChance = 0, onStrike } = {}) {
  const t0 = Date.now();
  const goalsBefore = await careerGoals(page);
  await dismissDialogues(page, log);
  // Energy: a real player drinks his cans to be picked (selection.ts).
  for (let i = 0; i < 3; i++) {
    const c = await readCareer(page);
    if (!c || c.energy >= 100 || !(c.kibCans?.basic > 0)) break;
    log(`energy ${c.energy}: using a can`);
    await page.locator("button:visible").filter({ hasText: /^\s*USE\s*$/i }).first().click({ timeout: 30000 });
    await waitFor(async () => (await readCareer(page))?.energy > c.energy, 5000);
    await sleep(500);
    await dismissDialogues(page, log);
  }
  log("PLAY");
  await page.locator("[data-tour=nav-play]:visible").first().click({ timeout: 30000 });
  let chances = 0, modeSet = false, fullTimeSeen = false, fullTimeOrPens = false;
  const shots = [];
  let beat = 0, lastSig = "";
  while (Date.now() - t0 < timeoutMs) {
    if (Date.now() - beat > 10000) {
      beat = Date.now();
      const m = await matchState(page).catch(() => null);
      const sig = JSON.stringify([m?.phase, m?.kind, (await buttons(page)).slice(0, 5)]);
      if (sig !== lastSig) { log(`… ${sig}`); lastSig = sig; }
    }
    const s = await matchState(page);
    if (s && s.phase === "aim" && s.auto) { await sleep(300); continue; }   // somebody else's penalty: watch it
    if (s && s.phase === "aim" && !fullTimeSeen) {
      const st = await stableAim(page);
      if (st && st.phase === "aim" && st.ball && st.postL) {
        const inShootout = fullTimeOrPens;
        // A penalty in the match is aimed like one in a shootout.
        const aim = (inShootout || st.kind === "penalty") ? penaltyAim : aims[Math.min(chances, aims.length - 1)];
        const before = await scoreNow(page);
        const minute = await page.evaluate(() => (document.body.innerText.match(/\b\d+(\+\d+)?'/) || [""])[0]);
        chances++;
        log(`chance ${chances} at ${minute}: ${st.kind} (score ${before})`);
        const ok = await takeChance(page, st, aim, log);
        if (onStrike) await onStrike(chances, st);
        // Wait for the chance to finish (back to the feed or the next screen).
        await waitFor(async () => { const m = await matchState(page); return !m || m.phase === "feed" || m.phase === "postmatch" || (m.phase === "aim" && (await page.locator('div.cursor-pointer[style*="aspect-ratio"]').count()) === 0 && false); }, 30000, 200);
        const after = await scoreNow(page);
        const scored = !!(before && after && after[0] > before[0]);
        shots.push({ n: chances, minute, kind: st.kind, aim, struck: ok, scored });
        log(`  → ${scored ? "GOAL" : "no goal"} (score ${after})`);
        if (stopAfterChance && chances >= stopAfterChance) return { stopped: true, chances, shots, ms: Date.now() - t0 };
        continue;
      }
    }
    if (s && s.phase === "tdDribble") {
      // The top-down dribble waits for a first touch; then it plays itself.
      if (await page.evaluate(() => /Tap to start/i.test(document.body.innerText))) {
        log("dribble: tap to start"); const c = s.canvas; await page.mouse.click(c.x + c.w / 2, c.y + c.h * 0.6);
      }
      await sleep(400); continue;
    }
    const text = await bodyText(page);
    if (/Post Match Reactions/.test(text)) {
      // A first-time tour card may cover the top bar.
      for (let i = 0; i < 5; i++) { const g = await clickText(page, /^(Got it|Next ▸)$/); if (!g) break; log(`tour: ${g}`); await sleep(500); }
      const c = await readCareer(page);
      const goalsByYou = (c?.seasonStats?.goals ?? 0) - goalsBefore;
      const last = c?.results?.[c.results.length - 1] ?? c?.fixtures?.filter?.((f) => f.played)?.slice(-1)[0];
      const score = await page.evaluate(() => (document.body.innerText.match(/\b[A-Z][A-Z .'&-]+ \d+-\d+ [A-Z][A-Z .'&-]+/) || [null])[0]);
      return { goalsByYou, score, ms: Date.now() - t0, chances, shots, result: last ? { for: last.goalsFor ?? last.scoreFor, against: last.goalsAgainst ?? last.scoreAgainst } : null };
    }
    const btn = await buttons(page);
    // Full time: the FULL TIME button, or (after a shootout, which has none)
    // the first result screen (MATCH RATING … CONTINUE).
    if (!fullTimeSeen && (btn.some((b) => /^FULL TIME/i.test(b)) || btn.some((b) => /^MATCH RATING/i.test(b)))) {
      fullTimeSeen = true;
      log(`full time at ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      if (onFullTime) await onFullTime();
    }
    if (mode && !modeSet && s && s.phase === "feed" && btn.some((b) => b === mode)) {
      await clickText(page, new RegExp(`^${mode}$`)); modeSet = true; log(`energy mode ${mode}`);
    }
    if (btn.some((b) => /^PENALTIES/i.test(b))) fullTimeOrPens = true;
    const clicked = await clickText(page, /^(Team sheets.*|KICK OFF.*|Play Match.*|Get out there.*|PENALTIES.*|CONTINUE.*|Continue.*|FULL TIME.*|Next ▸|Got it|OK)$/);
    if (clicked) { log(`click: ${clicked}`); await sleep(600); continue; }
    await sleep(300);
  }
  throw new Error("playToReactions: timed out");
}
