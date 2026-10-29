/**
 * scripts/star-sandbox/seasons.mjs — play Road to Ballon d'Or like a player,
 * screen by screen, and keep a still and the words of every new screen.
 * (Mikey, 28 Oct 2026: "playtest 2.5 full seasons … the big moments within the
 * first 10 games, and the end of the season: Ballon d'Or, awards, transfers".)
 *
 *   node scripts/star-sandbox/seasons.mjs --out <dir> [--url http://localhost:3300]
 *        [--save save.json] [--games 10] [--until-season 2] [--max-min 60]
 *
 * --save: start from a career (localStorage JSON {career, phase?}); without it
 *   the run starts from the title screen with a brand-new player.
 * --games N: stop after N more matches played.  --until-season S: stop when
 *   career.season reaches S (the season-end screens are played through).
 *
 * Every chance is a real drag from the ball and a real tap on the strike
 * screen (window.__starMatch, read-only, needs an offline-dev build). Buttons
 * are pressed by their words; nothing in the save is changed by the script.
 * Writes <out>/log.txt, <out>/screens/NNN-*.jpg and <out>/career.json at the end.
 */
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = path.resolve(val("--out", "seasons-out"));
const BASE = val("--url", "http://localhost:3300");
const SAVE = val("--save", null);
const GAMES = Number(val("--games", 0));
const UNTIL_SEASON = Number(val("--until-season", 0));
const MAX_MS = Number(val("--max-min", 60)) * 60000;
const KEY = "star-career-v2::anon";
fs.mkdirSync(path.join(OUT, "screens"), { recursive: true });
const logf = fs.createWriteStream(path.join(OUT, "log.txt"), { flags: "a" });
const log = (s) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${s}`; console.log(l); logf.write(l + "\n"); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const errors = new Map();
const noise = /flagcdn|googletagmanager|ERR_CERT|ERR_TUNNEL|sentry|supabase|club_logos|status of (4\d\d|5\d\d)|Failed to fetch|posthog/i;
page.on("pageerror", (e) => { const k = `PAGEERROR ${e.message.slice(0, 200)}`; errors.set(k, (errors.get(k) ?? 0) + 1); });
page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !noise.test(t)) { const k = `CONSOLE ${t.slice(0, 200)}`; errors.set(k, (errors.get(k) ?? 0) + 1); } });

const readCareer = () => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, KEY);
// The phase is kept as a plain word ("dashboard"); an old test save may hold {phase}.
const readPhase = () => page.evaluate(() => { const v = localStorage.getItem("star-career-phase-v1::anon"); if (!v) return null; try { const j = JSON.parse(v); return typeof j === "string" ? j : j?.phase ?? v; } catch { return v; } });
const bodyLines = () => page.evaluate(() => document.body.innerText.split("\n").map((s) => s.trim()).filter(Boolean));
const visibleButtons = () => page.evaluate(() => Array.from(document.querySelectorAll("button")).filter((b) => {
  const r = b.getBoundingClientRect(); const s = getComputedStyle(b);
  return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !b.disabled;
}).map((b) => b.innerText.replace(/\s+/g, " ").trim()).filter(Boolean));

async function clickText(re) {
  const h = (await page.evaluateHandle((src) => {
    const re = new RegExp(src, "i");
    return Array.from(document.querySelectorAll("button")).find((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !b.disabled && re.test(b.innerText.replace(/\s+/g, " ").trim());
    }) || null;
  }, re.source)).asElement();
  if (!h) return null;
  const t = (await h.innerText()).replace(/\s+/g, " ").trim();
  // A real tap on the button's middle, at once: animated buttons (pulsing,
  // sliding in) never count as "stable", so waiting for that stalls a run.
  await h.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  const bb = await h.boundingBox();
  if (!bb) return null;
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  return t;
}

let shotN = 0;
async function still(label) {
  const f = path.join(OUT, "screens", `${String(++shotN).padStart(3, "0")}-${label.replace(/[^\w]+/g, "-").slice(0, 50)}.jpg`);
  await page.screenshot({ path: f, type: "jpeg", quality: 60 }).catch(() => {});
  return path.basename(f);
}

// ── chances (same method as scripts/film/scenes/match-lib.mjs) ─────────────
const matchState = () => page.evaluate(() => {
  const m = window.__starMatch; if (!m) return null;
  try { const f = m.frame(); const get = (r) => f.men.find((x) => x.role === r);
    return { phase: m.phase(), kind: m.kind(), auto: !!(f.sc && f.sc.autoKick), ball: m.ball(), postL: get("postL"), postR: get("postR"), canvas: f.canvas };
  } catch { return { phase: m.phase(), kind: m.kind() }; }
}).catch(() => null);

async function settle(ms = 45000) {
  let prev = "", same = 0; const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await page.evaluate(() => {
      const m = window.__starMatch; if (!m) return null; const ph = m.phase(); if (ph !== "aim") return { ph };
      const f = m.frame();
      return { ph, sig: f.men.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(" ") + `${f.cam.x1.toFixed(2)},${f.cam.y1.toFixed(2)}` };
    }).catch(() => null);
    if (!r || r.ph !== "aim") return matchState();
    if (r.sig === prev) { if (++same >= 4) return matchState(); } else same = 0;
    prev = r.sig; await sleep(200);
  }
  return matchState();
}

const AIMS = [{ t: 0.9, power: 0.85, cy: 0.2 }, { t: 0.12, power: 0.85, cy: 0.2 }, { t: 0.8, power: 0.95, cy: -0.1 }, { t: 0.2, power: 0.7, cy: 0.3 }];
let chanceN = 0;
async function takeChance(s) {
  const aim = s.kind === "penalty" ? { t: 0.85, power: 0.75, cy: -0.2 } : AIMS[chanceN % AIMS.length];
  chanceN++;
  const tx = s.postL.cx + (s.postR.cx - s.postL.cx) * aim.t, ty = s.postL.cy + (s.postR.cy - s.postL.cy) * aim.t;
  let ux = s.ball.x - tx, uy = s.ball.y - ty; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
  let lo = 10, hi = 260;
  for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; const p = await page.evaluate(([dx, dy]) => window.__starMatch?.power(dx, dy) ?? 0, [ux * mid, uy * mid]); if (p < aim.power) lo = mid; else hi = mid; }
  const pull = (lo + hi) / 2, ex = s.ball.x + ux * pull, ey = s.ball.y + uy * pull;
  await page.mouse.move(s.ball.x, s.ball.y); await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(s.ball.x + (ex - s.ball.x) * i / 14, s.ball.y + (ey - s.ball.y) * i / 14); await sleep(16); }
  await page.mouse.up();
  const sel = 'div.cursor-pointer[style*="aspect-ratio"]';
  const end = Date.now() + 15000;
  while (Date.now() < end) { if (await page.locator(sel).count()) break; const m = await matchState(); if (m && !["aim", "runup", "contact"].includes(m.phase)) return false; await sleep(80); }
  await sleep(300);
  const bb = await page.locator(sel).first().boundingBox().catch(() => null);
  if (!bb) return false;
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2 + aim.cy * bb.width / 2);
  return true;
}

// ── the loop ────────────────────────────────────────────────────────────────
// Words pressed, in order of preference. A player's normal way forward; never
// spends money, never opens the casino, never deletes or resets.
const FORWARD = [
  /^(Got it|OK|Okay|Next ▸|Next|Close|Done|Nice|Cool|Great|Thanks!?|Let's go!?|Let’s go!?)$/,
  /^(Claim.*|Collect.*|Sign.*|Accept.*|Agree.*|Shake on it.*|Join .*)$/,
  // the story's pointers: "Go to training", "Open your phone", "See the boss"
  /^(Go to .*|Open .*|See .*|Meet .*|Talk to .*|Read .*|Reply.*|Start drill.*|Play drill.*|Take a look|Tag along|Use the can|Use now|Run the draw|Reveal.*|Play anyway|End of Season|Buy it for ★\d+|BUY & DRINK A CAN ★\d+)$/,
  /^(Team sheets.*|KICK OFF.*|Play Match.*|Get out there.*|PENALTIES.*|FULL TIME.*)$/,
  /^(CONTINUE.*|Continue.*|Carry on.*|Start.*|Begin.*|Enter.*|Take the trial.*|Ready.*|Next season.*|Start next season.*|Back to Home.*)$/,
  // story cards: "… TAP TO HEAR HIM OUT →", "Read it →"
  /(TAP TO .*|→)$/,
];
const BLOCK = /delete|reset|casino|bet|spend|£|retire|quit|main menu|sign out|log out|^(?!Buy it for|BUY & DRINK).*(buy|★\d)/i;

const t0 = Date.now();
let lastSig = "", sameCount = 0, games = 0, lastApps = null, lastPhase = "";
const seenPhases = new Map();
const trialSeen = new Set();
let lastCaption = "";
let lastBeat = 0;
let homeSince = 0, lastCheckpoint = 0, lastRing = "";
let ceremonySince = 0, lastCeremonyShot = 0, transferTried = false;

await page.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await sleep(3000);
await page.evaluate(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-admin-mode", "off"); } catch {} });
if (SAVE) {
  const s = JSON.parse(fs.readFileSync(SAVE, "utf8"));
  await page.evaluate(({ career, phase }) => {
    localStorage.setItem("star-career-v2::anon", JSON.stringify(career));
    localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: phase ?? "dashboard" }));
  }, s);
} else {
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/star-career/.test(k)) localStorage.removeItem(k); });
}
await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
await sleep(5000);
await page.addStyleTag({ content: ".tr-float{display:none!important}" }).catch(() => {});

const played = (c) => (c?.fixtures ?? []).filter((f) => f.played && !f.skipped).length + (c?.seasonHistory?.length ?? 0) * 1000;
let startPlayed = played(await readCareer());
const startSeason = (await readCareer())?.season ?? 1;

while (Date.now() - t0 < MAX_MS) {
  const c = await readCareer();
  // Which screen: the saved phase when the game keeps one; Home when its
  // league box is up; otherwise the screen's first words.
  const onHome = (await page.locator("[data-home-league]").count()) > 0;
  const head = (await bodyLines()).filter((l) => !/^[?⚙✕‹]$|^\d+$/.test(l)).slice(0, 2).join(" ").slice(0, 40);
  const phase = onHome ? "dashboard" : ((await readPhase()) ?? `screen:${head}`);
  if (c) {
    const p = played(c);
    if (p !== startPlayed) { games += p > startPlayed && p - startPlayed < 500 ? p - startPlayed : 1; startPlayed = p;
      const last = (c.fixtures ?? []).filter((f) => f.played).slice(-1)[0];
      log(`MATCH ${games} done: ${last ? `${last.competition ?? ""} ${last.round ?? ""} v ${last.opponent} ${last.homeScore ?? "?"}-${last.awayScore ?? "?"}` : ""} · season goals ${c.seasonStats?.goals} · apps ${c.seasonStats?.appearances} · stars ${Math.round((c.starRating ?? 0) * 100) / 100} · £${Math.round(c.money)}`); }
    if (GAMES && games >= GAMES && phase === "dashboard") { log(`stop: ${games} games played`); break; }
    if (UNTIL_SEASON && c.season >= UNTIL_SEASON && phase === "dashboard") { log(`stop: season ${c.season} reached`); break; }
  }
  if (phase !== "dashboard") homeSince = 0;
  if (phase !== lastPhase) {
    seenPhases.set(phase, (seenPhases.get(phase) ?? 0) + 1);
    const lines = await bodyLines();
    const f = await still(`${phase}`);
    log(`SCREEN ${phase} (${f}): ${lines.slice(0, 30).join(" | ").slice(0, 900)}`);
    lastPhase = phase;
  }
  // The trial's five stages are their own mini-games (not the match's chance
  // screen): each stage's opening screen is kept, then the dev panel skips
  // it at "average" (DevTrialPanel.tsx), so the run reaches the signing.
  if (phase === "trial-stages") {
    const stage = await page.evaluate(() => { const t = document.body.innerText; const n = (t.match(/\b([1-5])\/5\b/) || [""])[0]; const lines = t.split("\n").map((x) => x.trim()).filter(Boolean); const i = lines.indexOf("YOU"); return n ? `${n} ${lines[i + 1] ?? ""}` : ""; });
    if (stage && !trialSeen.has(stage)) { trialSeen.add(stage); log(`TRIAL stage ${stage} (${await still(`trial-${stage}`)})`); }
    const devBtn = page.locator("button", { hasText: /Skip \/ Sim Trial/i }).first();
    if (await devBtn.count()) {
      await devBtn.click({ force: true, timeout: 3000 }).catch((e) => log(`  dev button: ${e.message.slice(0, 80)}`)); await sleep(400); const sk = await page.locator("button", { hasText: /^Skip / }).first().click({ force: true, timeout: 3000 }).then(() => "skip", () => null); log(`  dev panel: ${sk ?? "no skip button"}`); await sleep(1500); continue; }
  }
  // A forced pointer (PointerTour): a ring sits on the one thing you may tap. Tap it.
  const ring = await page.locator(".kit-tour-ring").first().boundingBox().catch(() => null);
  if (ring && ring.width > 4) {
    const what = await page.evaluate(() => document.querySelector("[data-tour-overlay]")?.getAttribute("aria-label") ?? "");
    if (what !== lastRing) { lastRing = what; log(`  pointer: ${what.slice(0, 160)}`); }
    await page.mouse.click(ring.x + ring.width / 2, ring.y + ring.height / 2); await sleep(1500); continue;
  }
  // Coach tips ("… NEXT ▸", "GOT IT"): not buttons; tap the words.
  const tip = page.getByText(/^(NEXT ▸|GOT IT|NEXT|OK, GOT IT)$/i).first();
  if (await tip.count() && await tip.isVisible().catch(() => false)) {
    const words = (await page.evaluate(() => document.body.innerText)).match(/[^\n]{0,160}\n?(NEXT ▸|GOT IT)/i)?.[0]?.replace(/\s+/g, " ") ?? "";
    log(`  tip: ${words.slice(0, 200)}`);
    const bb = await tip.boundingBox().catch(() => null);
    if (bb) { await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(800); continue; }
  }
  // A chance in a match.
  const m = await matchState();
  if (Date.now() - lastBeat > 60000) {
    lastBeat = Date.now();
    await page.screenshot({ path: path.join(OUT, "now.jpg"), type: "jpeg", quality: 50 }).catch(() => {});
    log(`  … ${m ? `match phase ${m.phase} ${m.kind ?? ""}` : "no match"} · buttons: ${(await visibleButtons()).slice(0, 8).join(" | ")}`);
  }
  if (m && m.phase === "aim" && !m.auto) {
    const s = await settle();
    if (s && s.phase === "aim" && s.ball && s.postL) {
      const minute = await page.evaluate(() => (document.body.innerText.match(/\b\d+(\+\d+)?'/) || [""])[0]);
      const ok = await takeChance(s);
      log(`  chance ${chanceN} ${s.kind} at ${minute}: ${ok ? "struck" : "no strike screen"}`);
      await sleep(2500);
      continue;
    }
  }
  if (m && m.phase === "tdDribble" && await page.evaluate(() => /Tap to start/i.test(document.body.innerText))) {
    await page.mouse.click(m.canvas.x + m.canvas.w / 2, m.canvas.y + m.canvas.h * 0.6); await sleep(400); continue;
  }
  if (m && ["aim", "runup", "contact", "flight", "replay"].includes(m.phase)) { await sleep(300); continue; }

  // Full-screen cards that say "TAP TO CONTINUE" / "TAP ANYWHERE": keep a still, tap.
  const tapCard = await page.evaluate(() => /TAP (TO CONTINUE|ANYWHERE)/i.test(document.body.innerText));
  if (tapCard && !(m && m.phase === "aim")) {
    const words = (await bodyLines()).slice(0, 10).join(" | ");
    if (words !== lastCaption) { lastCaption = words; log(`CARD (${await still("card")}): ${words.slice(0, 300)}`); }
    const t = await page.getByText(/TAP (TO CONTINUE|ANYWHERE)/i).first().boundingBox().catch(() => null);
    await page.mouse.click(195, t ? t.y + t.height / 2 : 600); await sleep(1500); continue;
  }
  // Home: play the next match (drink a can first if tired). First give the
  // story a moment: its card ("Go to training", "Take a look") comes up a
  // beat after Home opens, and a player reads it.
  if (phase === "dashboard") {
    if (!homeSince) homeSince = Date.now();
    if (Date.now() - homeSince < 4000) { await sleep(500); continue; }
    // A checkpoint, so a later run can start from here (--save).
    if (c && Date.now() - lastCheckpoint > 30000) { lastCheckpoint = Date.now(); fs.writeFileSync(path.join(OUT, "checkpoint.json"), JSON.stringify({ career: c, phase: "dashboard" })); }
    // A pointer tour that says "Tap Play" is a way in, not a blocker.
    const dialog = await page.evaluate(() => !/Tap Play/i.test(document.body.innerText) && !!Array.from(document.querySelectorAll(".fixed.inset-0")).find((e) => e.innerText.trim() && e.getBoundingClientRect().height > 0));
    if (!dialog) {
      // The season is over: Home's button says so.
      const eos = await clickText(/End of Season/);
      if (eos) { log(`  press: ${eos}`); await sleep(2000); continue; }
      // The story asked for two drills ("Time to train"): follow the hand to Training.
      if (c?.unlocks?.story && c.unlocks.seen?.includes("beat-training") && (c.unlocks.drills ?? 0) < 2) {
        const tr = page.locator("[data-tour=nav-training]:visible").first();
        const bb = await tr.boundingBox().catch(() => null);
        if (bb) { log("  story: to Training for the two drills"); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(1500); continue; }
      }
      if (c && c.energy < 70 && c.kibCans?.basic > 0) { if (await clickText(/^USE$/)) { log("energy: used a can"); await sleep(800); continue; } }
      const play = page.locator("[data-tour=nav-play]:visible").first();
      if (await play.count()) { const bb = await play.boundingBox(); if (bb) await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(1500); continue; }
    }
  }
  // Cut-scene captions move on with a tap ("1/5 · tap ›"): read it, then tap.
  const capt = await page.evaluate(() => { const m = document.body.innerText.match(/\b(\d+)\/(\d+) · tap/); return m ? m[0] : null; });
  if (capt) {
    const words = (await bodyLines()).slice(0, 8).join(" | ");
    if (words !== lastCaption) { log(`  scene ${capt}: ${words.slice(0, 260)}`); lastCaption = words; if (/^1\//.test(capt)) await still(`scene-${phase}`); }
    // Tap the caption box itself (the "· tap ›" line sits in it).
    const box = await page.getByText(/· tap/).first().boundingBox().catch(() => null);
    await page.mouse.click(box ? box.x : 195, box ? box.y - 20 : 600); await sleep(1200); continue;
  }
  // A drill's level ladder: "Level N is next" → tap level N.
  const nextLv = await page.evaluate(() => (document.body.innerText.match(/Level (\d+) is next/) || [])[1] ?? null);
  if (nextLv && !(m && m.phase)) {
    const got = await clickText(new RegExp(`^${nextLv}$`));
    if (got) { log(`  drill: level ${nextLv}`); await sleep(1500); continue; }
  }
  // The Star Pass: claim what is there (CLAIM / USE NOW above), then leave by
  // the game's own bar (Home), like a player.
  if (await page.locator("[data-star-pass]").count()) {
    const claim = await clickText(/^CLAIM$/);
    if (claim) { log("  star pass: claim"); await sleep(1500); continue; }
    if (!(await page.locator("[data-reward-preview]").count())) {
      log(`  star pass seen (${await still("star-pass")}), back Home`);
      const h = page.locator("[data-star-pass-bar] [data-tour=home]").first();
      const bb = await h.boundingBox().catch(() => null);
      if (bb) { await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(1500); continue; }
    }
  }
  // A ceremony (the Ballon d'Or night, the awards night): watch it, the way
  // a player does, while it still offers SKIP; a still every 20 s.
  if (/ballon-dor|season-awards|vote-ceremony/.test(phase) && await page.evaluate(() => /\bSKIP\b/i.test(document.body.innerText))) {
    if (!ceremonySince) ceremonySince = Date.now();
    if (Date.now() - ceremonySince < 150000) {
      if (Date.now() - lastCeremonyShot > 20000) { lastCeremonyShot = Date.now(); log(`  watching ${phase} (${await still(`watch-${phase}`)}): ${(await bodyLines()).slice(0, 8).join(" | ").slice(0, 200)}`); }
      await sleep(1500); continue;
    }
  } else ceremonySince = 0;
  // The summer window (TransferHub): an ambitious player looks at the best
  // league that wants him, takes the keenest club there, then negotiates.
  if (phase === "season-transfer") {
    const picked = await page.locator("[data-picked-club]").count();
    if (!picked && !transferTried) {
      transferTried = true;
      await page.locator("[data-chooser=league]").first().click({ timeout: 3000 }).catch(() => {});
      await sleep(1200);
      const leagues = await page.locator("[data-league]").evaluateAll((els) => els.map((e) => e.getAttribute("data-league") + " · " + e.innerText.replace(/\s+/g, " ").slice(0, 60)));
      log(`TRANSFER leagues (${await still("transfer-leagues")}): ${leagues.join(" | ")}`);
      await page.locator("[data-league]").first().click({ timeout: 3000 }).catch(() => {});
      await sleep(1200);
      const clubs = await page.locator("[data-club]").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ").slice(0, 70)));
      log(`TRANSFER clubs (${await still("transfer-clubs")}): ${clubs.slice(0, 12).join(" | ")}`);
      // The best-placed club that is not relegated (ties: the keenest, listed first).
      const best = await page.locator("[data-club]").evaluateAll((els) => {
        let pick = 0, bestPos = 99;
        els.forEach((e, i) => { const t = e.innerText; if (/Relegated/i.test(t)) return; const m = t.match(/Finished (\d+)/); const pos = m ? +m[1] : 50; if (pos < bestPos) { bestPos = pos; pick = i; } });
        return pick;
      });
      await page.locator("[data-club]").nth(best).click({ timeout: 3000 }).catch(() => {});
      await sleep(1200);
      log(`TRANSFER picked (${await still("transfer-picked")}): ${(await bodyLines()).slice(0, 30).join(" | ").slice(0, 400)}`);
    }
    const neg = await clickText(/^✓? ?Negotiate · /);
    if (neg) { log(`  press: ${neg}`); await sleep(2000); continue; }
  }
  // Empty name fields (a new player).
  const empty = page.locator("input[type=text]:visible, input:not([type]):visible");
  if (await empty.count()) {
    const n = await empty.count();
    for (let i = 0; i < n; i++) { const el = empty.nth(i); if (!(await el.inputValue().catch(() => "x"))) await el.fill(i === 0 ? "Sam" : "Tester").catch(() => {}); }
  }
  let clicked = null;
  // Match on the words: a leading ✓ ▶ ⚽ or arrow is ignored.
  const bare = (b) => b.replace(/^[^\p{L}\p{N}']+/u, "").trim();
  for (const re0 of FORWARD) { const re = new RegExp(re0.source, "i"); const btns = (await visibleButtons()).filter((b) => re.test(bare(b)) && !BLOCK.test(b)); if (btns.length) { clicked = await clickText(new RegExp(`^${btns[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)); if (clicked) break; } }
  const sig = `${phase}|${(await visibleButtons()).slice(0, 8).join(",")}|${(await bodyLines()).slice(0, 4).join(",")}`;
  if (clicked) { log(`  press: ${clicked}`); await sleep(900); }
  // A match runs on its own between chances: never "stuck" while one is on.
  if (m) { sameCount = 0; lastSig = sig; }
  else if (sig === lastSig) sameCount++; else { sameCount = 0; lastSig = sig; }
  // A talking head ("Sam, a word." ▶): tap the speech to read on.
  if (!clicked && sameCount >= 2) {
    const speech = await page.evaluate(() => {
      const ov = Array.from(document.querySelectorAll(".fixed.inset-0, [role=dialog]")).filter((e) => e.innerText.trim() && e.getBoundingClientRect().height > 0).pop();
      if (!ov) return null;
      const els = Array.from(ov.querySelectorAll("div,p,span")).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 80 && r.height > 20 && r.top > 0 && r.bottom < innerHeight && e.children.length === 0 && e.innerText.trim().length > 6; });
      const e = els.pop(); if (!e) return null; const r = e.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: e.innerText.trim().slice(0, 140) };
    }).catch(() => null);
    if (speech) { if (speech.t !== lastCaption) { lastCaption = speech.t; log(`  says: ${speech.t}`); } await page.mouse.click(speech.x, speech.y); await sleep(1200); continue; }
  }
  // Somewhere with nothing to press (the phone, a list): look, then Home.
  if (sameCount === 4 && phase !== "dashboard") {
    const h = page.locator("[data-tour=home]:visible").first();
    const bb = await h.boundingBox().catch(() => null);
    if (bb) { log(`  looked at ${phase} (${await still(`look-${phase}`)}), back Home`); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await sleep(1500); sameCount = 0; continue; }
  }
  if (sameCount === 8) {
    const f = await still(`stuck-${phase}`);
    log(`STUCK? ${phase} (${f}) buttons: ${(await visibleButtons()).join(" | ")}`);
    // try a tap in the middle (story cards, "tap to continue")
    await page.mouse.click(195, 600); await sleep(800);
  }
  if (sameCount > 40) { log(`GIVING UP at ${phase}`); await still(`gave-up-${phase}`); break; }
  if (!clicked) await sleep(500);
}

const c = await readCareer();
fs.writeFileSync(path.join(OUT, "career.json"), JSON.stringify({ career: c, phase: "dashboard" }));
log(`END after ${((Date.now() - t0) / 60000).toFixed(1)} min · games ${games} · season ${c?.season} · club ${c?.player?.club} · phases ${[...seenPhases.keys()].join(",")}`);
log(`ERRORS: ${errors.size ? [...errors].map(([k, n]) => `${n}× ${k}`).join("\n  ") : "(none)"}`);
await browser.close();
