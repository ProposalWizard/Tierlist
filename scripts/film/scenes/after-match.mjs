/**
 * AFTER A REAL MATCH: how long from the tap until YOUR goal / the highlights
 * play, every way a player opens them (Leo, 24 Oct 2026: "I don't EVER wanna
 * wait more than a few seconds … test it!").
 *
 *   node scripts/film/scenes/after-match.mjs <baseUrl> <save.json> <outDir> <rate>
 *
 * Plays one real match with match-lib.mjs (a 30-minute match by the career's
 * own rule book, a real shot that goes in), slows the CPU to <rate> from full
 * time on, then films and times:
 *   A  your goal post, in Post Match Reactions
 *   B  the match highlights post, in Post Match Reactions
 *   C  your goal again from Phone → Social, after leaving (Continue)
 *   D  Goal Replays (Settings) → Watch your goal
 * Each clip has the measured time burnt in, and the game's sound (audio-tap).
 * Prints one JSON line with every time.
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { showTouches, startRec, stopRec } from "../rec.mjs";
import { installAudioTap, startAudio, stopAudio, muxAudio, loudness } from "./audio-tap.mjs";
import { tapToPlaying, stopwatch } from "./tap-timing.mjs";
import { loadSave, playToReactions, dismissDialogues } from "./match-lib.mjs";
import { spawnSync } from "node:child_process";

const [base, savePath, outDir, rateArg] = process.argv.slice(2);
const RATE = Number(rateArg || 1);
const tag = RATE > 1 ? `-${RATE}x` : "-1x";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--autoplay-policy=no-user-gesture-required", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await showTouches(ctx);
await installAudioTap(ctx);
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", e => errors.push(e.message));
const cdp = await ctx.newCDPSession(pg);
const slow = (r) => cdp.send("Emulation.setCPUThrottlingRate", { rate: r });

await loadSave(pg, base, savePath);
const match = await playToReactions(pg, { log: (m) => console.error("  ·", m), onFullTime: () => slow(RATE) });
const times = { rate: RATE, match };

/** Film one case: scroll `find` into view, tap its video, hold, save clip + sound. */
async function filmCase(...args) {
  try { await filmCaseInner(...args); } catch (e) { times[args[0]] = { ms: null, how: "error: " + String(e.message || e).slice(0, 120) }; }
  if (times[args[0]]?.ms == null) {
    await pg.screenshot({ path: path.join(outDir, `${args[0]}${tag}-FAIL.jpg`), type: "jpeg", quality: 60 }).catch(() => {});
    console.error("  buttons:", (await pg.locator("button:visible").allInnerTexts().catch(() => [])).map(t => t.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 16).join(" | "));
  }
  console.error("  CASE", args[0], JSON.stringify(times[args[0]]));
}
async function filmCaseInner(name, label, find, { prep, timer } = {}) {
  const raw = path.join(outDir, `${name}${tag}.raw.mp4`);
  const aud = path.join(outDir, `${name}${tag}.webm`);
  const rec = await startRec(pg);
  const a0 = await startAudio(pg);
  if (prep) await prep();
  const w = await find();
  if (!w) { await stopRec(rec, raw).catch(() => {}); await stopAudio(pg, aud).catch(() => {}); times[name] = { ms: null, how: "not found" }; return; }
  let r, status = null;
  if (timer) r = await timer(w);
  else {
    await w.scrollIntoViewIfNeeded();
    await pg.waitForTimeout(900);
    status = await w.getAttribute("data-goal-video-status").catch(() => null);
    r = await tapToPlaying(pg, w);
  }
  times[name] = { ...r, statusAtTap: status };
  await stopwatch(pg, r.ms === null ? `${label}: did not play` : `${label} · tap → playing: ${(r.ms / 1000).toFixed(1)} s`, 6000);
  await pg.waitForTimeout(6500);
  const rec0 = rec.t0;
  await stopRec(rec, raw, { holdEnd: 0.3 });
  const a = await stopAudio(pg, aud);
  const out = path.join(outDir, `${name}${tag}.mp4`);
  // 390 wide, with its sound.
  const small = raw.replace(".raw.mp4", ".small.mp4");
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-vf", "scale=390:-2:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-an", small]);
  muxAudio(small, aud, out, Math.max(0, a.startedAt - rec0));
  rmSync(raw, { force: true }); rmSync(small, { force: true }); rmSync(aud, { force: true });
  const l = loudness(out);
  times[name].loudPeak = l.length ? l.reduce((m, x) => (x.db > m.db ? x : m), l[0]) : null;
  await pg.screenshot({ path: path.join(outDir, `${name}${tag}.jpg`), type: "jpeg", quality: 72 });
}

/** Through the cards between the match and Home (press, contract, awards…). */
async function toHome() {
  for (let i = 0; i < 14; i++) {
    const nav = pg.locator('[data-tour="nav-phone"]').first();
    const free = await nav.isVisible().catch(() => false)
      && await nav.evaluate(el => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!t && (el === t || el.contains(t)); }).catch(() => false);
    if (free) return true;
    await dismissDialogues(pg, (m) => console.error("  ·", m)).catch(() => {});
    const b = pg.locator("button:visible").filter({ hasText: /^\s*(Continue|CONTINUE|OK|Got it|GOT IT|Next|Done|Skip|Decline offer|CLOSE|Close)\b/ }).first();
    if (await b.count()) await b.click().catch(() => {});
    else await pg.keyboard.press("Escape").catch(() => {});
    await pg.waitForTimeout(1300);
  }
  return false;
}

const byEvent = (ev) => async () => {
  // Older builds have no data-post-event: find the post by its words.
  const words = { "match-highlights": /HIGHLIGHTS \|/, "your-highlights": /🎥/ }[ev];
  const tagged = pg.locator(`article[data-post-event="${ev}"]`);
  const a = (await pg.locator("article[data-post-event]").count()) ? tagged.first() : pg.locator("article").filter({ hasText: words }).first();
  if (!(await a.count())) {
    // Drawn only near the screen: scroll down until it is.
    for (let i = 0; i < 30 && !(await a.count()); i++) {
      await pg.evaluate(() => document.querySelector("[data-feed-scroll]")?.scrollBy({ top: 500 }));
      await pg.waitForTimeout(250);
    }
  }
  if (!(await a.count())) return null;
  await a.scrollIntoViewIfNeeded();
  const v = a.locator("[data-goal-video]").first();
  return (await v.count()) ? v : null;
};

// Your goal's own post has a video about half the time (feed.ts, by design);
// without it, the club's or a fan's post of your goal; else none.
const yourGoal = async () => (await byEvent("your-highlights")())
  ?? (await (async () => {
    const vids = pg.locator('article:not([data-post-event="match-highlights"]) [data-goal-video]');
    return (await vids.count()) ? vids.first() : null;
  })());
// A and B: on the Post Match Reactions screen.
await filmCase("your-goal-reactions", "Your goal", yourGoal);
await pg.evaluate(() => document.querySelector("[data-feed-scroll]")?.scrollTo({ top: 0 }));
await filmCase("highlights-reactions", "Highlights", byEvent("match-highlights"));

// C: Continue, then Phone → Social, your goal again.
await filmCase("highlights-social", "Highlights (Social, later)", byEvent("match-highlights"), {
  prep: async () => {
    // Continue, then any screens in between (a press question, an award…).
    if (!(await toHome())) {
      await pg.screenshot({ path: path.join(outDir, `stuck${tag}.jpg`), type: "jpeg", quality: 60 });
    }
    await pg.waitForTimeout(800);
    await pg.locator('[data-tour="nav-phone"]').first().click();
    await pg.waitForTimeout(900);
    await pg.locator("button").filter({ hasText: /Social\s*$/ }).first().click();
    await pg.waitForSelector("[data-feed-scroll]", { timeout: 30000 });
  },
});

// D: Stats → GOALS (the career goals gallery) → your goal. Timed from that tap.
await filmCase("goal-gallery", "Goals gallery", async () => {
  await toHome();
  const home = pg.locator("button").filter({ hasText: /^\s*HOME\s*$/i }).first();
  if (await home.isEnabled().catch(() => false)) { await home.click(); await pg.waitForTimeout(800); }
  await pg.locator('[data-tour="home"]').first().click().catch(() => {});
  await pg.waitForTimeout(800);
  // Stats (the carousel under the player) → GOALS (the gallery tab). Tapped
  // where they sit on a 390×844 phone: both are swipe rows, which the test
  // tool cannot click by name.
  await pg.mouse.click(60, 765);
  await pg.waitForTimeout(1500);
  await pg.mouse.click(225, 442);
  await pg.waitForTimeout(1200);
  const row = pg.locator("[data-goal-row]").first();
  await row.waitFor({ timeout: 20000 }).catch(() => {});
  if (!(await row.count())) return null;
  await row.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(700);
  return row;
}, {
  timer: async (row) => {
    const el = await row.elementHandle();
    return pg.evaluate(async (btn) => {
      const t0 = performance.now();
      btn.click();
      while (performance.now() - t0 < 60000) {
        const v = document.querySelector("[data-goal-sheet] [data-goal-video]");
        if (v?.querySelector('[data-goal-video-live="playing"]')) return { ms: Math.round(performance.now() - t0), how: "live" };
        const vid = v?.querySelector("video");
        if (vid && !vid.paused && vid.currentTime > 0.05) return { ms: Math.round(performance.now() - t0), how: "file" };
        if (document.querySelector("[data-goal-sheet] [data-goal-facts]") && !document.querySelector("[data-goal-sheet] [data-goal-clip-viewer]") && performance.now() - t0 > 3000) return { ms: null, how: "no recording (facts card)" };
        await new Promise(r => requestAnimationFrame(() => r()));
      }
      return { ms: null, how: "timeout" };
    }, el);
  },
});

console.log(JSON.stringify({ ...times, errors: [...new Set(errors)].slice(0, 4) }));
await browser.close();
