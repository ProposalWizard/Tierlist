/**
 * THE STORY BOOK'S SCREENSHOTS: every story played in the real game screens and photographed
 * (Harry, 28 Nov 2026: "I MEANT TAKE SCREENSHOTS IN GAME!!!"). Real captures only: no image
 * generator, no drawings made for the page.
 *
 * How: the life test page (/star-life-dev, a dev page, nothing reaches a career) has a hook,
 * window.__shot (app/star-life-dev/page.tsx): start any story, open any beat, answer, roll a game,
 * keep and restore. This script drives it in one Chromium at a phone's size (390 x 844, 2x
 * pixels, reduced motion so the screens are still) and saves a picture of:
 *   - each beat as it opens (the talk, the card, the text, the call),
 *   - each screen on the way through, answering with the FIRST reply,
 *   - the outcome card the first reply gives,
 *   - for big stories, the outcome of every other first-moment reply too,
 *   - a game: its set-up, a frame of it being played on the real engine, then the dice finish it,
 *   - the story in the phone's Stories list at the end.
 *
 * Run (a dev server on --base, default http://localhost:3105):
 *   node scripts/life/story-book-shots.mjs --data <story-book data.json> --out <folder> [--from 0 --to 181] [--only id,id]
 * Writes <out>/raw/<slug>/NN-kind.jpg and <out>/stories/<slug>.json (the list of shots, what each
 * shows, and anything that went wrong). A story with a .json already is skipped (run in batches).
 * Then: python3 scripts/life/story-book-sheets.py <out> packs each story's shots into one sheet.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3105");
const OUT = path.resolve(arg("out", "story-book-shots"));
const data = JSON.parse(fs.readFileSync(arg("data"), "utf8"));
const only = arg("only", "") ? new Set(arg("only").split(",")) : null;
const from = Number(arg("from", 0)), to = Number(arg("to", 9999));
const BIG = new Set(["big", "unspecified"]);

// The site's own extras that are not the game: the cookie banner, the chat badge, the admin tab.
const HIDE = `div.fixed.inset-x-0.bottom-0[class*="z-[200]"], .tr-float, .tr-vars, button.fixed.left-0[class*="top-1/2"], nextjs-portal[data-hidden] { display: none !important; }`;

fs.mkdirSync(path.join(OUT, "stories"), { recursive: true });

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
let page;
const consoleErrors = [];

/** A fresh page; a crashed one (memory on a busy machine) gets up to three more tries, 20 s apart. */
async function load() {
  for (let t = 0; ; t++) {
    try { return await load1(); } catch (e) {
      if (t >= 3) throw e;
      console.log(`page load failed (${String(e).slice(0, 80)}), trying again`);
      await new Promise((r) => setTimeout(r, 20000));
    }
  }
}
async function load1() {
  if (page) await page.close().catch(() => {});
  page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));
  await page.goto(`${BASE}/star-life-dev?full=1&shot=1&prep=fresh&clock=off`, { waitUntil: "networkidle", timeout: 300000 });
  await page.addStyleTag({ content: HIDE });
  await page.waitForFunction(() => window.__shot, null, { timeout: 120000 });
}

const call = (fn, ...a) => page.evaluate(([f, args]) => window.__shot[f](...args), [fn, a]);

async function settle(ms = 260) {
  await page.waitForTimeout(ms);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  // Telltale: the lines and replies come up once the world has slowed (data-phase "ask").
  await page.waitForFunction(() => { const t = document.querySelector("[data-telltale]"); return !t || t.getAttribute("data-phase") !== "in"; }, null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(120);
  // A new screen starts at the top of the phone.
  await page.evaluate(() => { const e = document.querySelector("[data-life-scroll]"); if (e) e.scrollTop = 0; });
}

/** What on the screen could be wrong: the Next error overlay, nothing drawn, words running off the side. */
async function screenCheck() {
  return page.evaluate(() => {
    const probs = [];
    const portal = document.querySelector("nextjs-portal");
    if (portal && portal.shadowRoot && portal.shadowRoot.textContent && /error|unhandled/i.test(portal.shadowRoot.textContent)) probs.push("Next error overlay");
    const phone = document.querySelector("[data-life-phone]");
    if (!phone) probs.push("no phone on screen");
    const txt = phone ? phone.innerText.trim() : "";
    if (phone && txt.length < 3 && !phone.querySelector("canvas,img")) probs.push("empty screen");
    if (/\{[a-z]+\.[a-zA-Z]+\}|\{if |\{\/if\}|undefined|NaN/.test(txt)) probs.push(`raw text on screen: "${(txt.match(/.{0,30}(\{[a-z]+\.[a-zA-Z]+\}|\{if [^}]*\}|\{\/if\}|undefined|NaN).{0,30}/) || [""])[0].replace(/\s+/g, " ")}"`);
    // Text cut off at the right edge of the phone.
    const W = window.innerWidth;
    for (const el of phone ? phone.querySelectorAll("button, p, div, span") : []) {
      if (!el.childElementCount && el.textContent.trim() && el.getBoundingClientRect().right > W + 2 && el.getBoundingClientRect().width < W * 1.5) { probs.push(`text runs off the right edge: "${el.textContent.trim().slice(0, 40)}"`); break; }
    }
    // Something meant to be read is below the bottom of the phone and the screen cannot scroll to it.
    const sc = document.querySelector("[data-life-scroll]");
    const canScroll = sc && sc.scrollHeight > sc.clientHeight + 4;
    const low = [...(phone ? phone.querySelectorAll("[data-choice], [data-continue], .dd-main") : [])].find((b) => b.getBoundingClientRect().top > window.innerHeight - 4);
    if (low && !canScroll) probs.push(`a button is below the bottom of the screen and cannot be reached: "${low.textContent.trim().slice(0, 40)}"`);
    return { probs, scroll: canScroll ? sc.scrollHeight - sc.clientHeight : 0, text: txt.slice(0, 600) };
  });
}

let story, shots, notes, dir, n;
async function shot(kind, info = {}) {
  await settle(info.wait ?? 260);
  const chk = await screenCheck();
  const file = `${String(n++).padStart(2, "0")}-${kind}.jpg`;
  await page.screenshot({ path: path.join(dir, file), type: "jpeg", quality: 88 });
  const rec = { file, kind, ...info, probs: chk.probs, text: chk.text };
  delete rec.wait;
  // A long screen: a second picture scrolled to the bottom, as the player would scroll.
  if (chk.scroll > 40) {
    await page.evaluate(() => { const e = document.querySelector("[data-life-scroll]"); e.scrollTop = e.scrollHeight; });
    await page.waitForTimeout(150);
    const f2 = file.replace(".jpg", "-b.jpg");
    await page.screenshot({ path: path.join(dir, f2), type: "jpeg", quality: 88 });
    rec.more = f2;
    await page.evaluate(() => { const e = document.querySelector("[data-life-scroll]"); e.scrollTop = 0; });
  }
  shots.push(rec);
  return rec;
}

const state = () => call("state");

/** A game on screen: its set-up, a frame of it being played, then the dice finish it. */
async function playActivity(beat, st, alt) {
  // Another reply's path to the same game: the game is already photographed on the main path.
  if (alt) { await call("dice"); return; }
  await shot("game-setup", { beat, mode: st.mode, alt });
  // The drill's round card goes, the call, then play: wait for the engine, then take one shot at goal.
  const playing = await page.waitForFunction(() => { const d = document.querySelector("[data-activity]"); return d && d.getAttribute("data-phase") === "play"; }, null, { timeout: 9000 }).then(() => true).catch(() => false);
  if (playing) {
    await page.waitForTimeout(500);
    const at = await page.evaluate(() => { const d = document.querySelector("[data-activity]"); if (!d || !d.querySelector("canvas")) return null; const r = d.getBoundingClientRect(); const bp = (d.getAttribute("data-ballpct") || "50,80").split(",").map(Number); return { x: r.left + r.width * bp[0] / 100, y: r.top + r.height * bp[1] / 100 }; });
    if (at) {
      await page.mouse.move(at.x, at.y); await page.mouse.down();
      for (let i = 1; i <= 8; i++) { await page.mouse.move(at.x - i * 2, at.y + i * 14); await page.waitForTimeout(16); }
      await page.mouse.up();
      await page.waitForTimeout(650);
    }
    await shot("game-play", { beat, mode: st.mode, alt, wait: 60 });
  } else {
    // The other modes (crossbar, feed-drill) or a game that is not built: one picture of what shows after a moment.
    await page.waitForTimeout(2500);
    await shot("game-play", { beat, mode: st.mode, alt, note: "no play phase found; picture after 2.5 s" });
  }
  await call("dice");
}

/** Answer with `pick` at the first screen, then the first reply after, to the end of the beat. */
async function walk(beat, pick, alt, main) {
  let first = true, last = main;
  for (let step = 0; step < 14; step++) {
    const st = await state();
    if (!st.k) return { end: "closed" };
    if (st.k === "activity") { await playActivity(beat, st, alt); continue; }
    if ((st.k === "talk" || st.k === "card") && st.picked) {
      await shot(alt ? "alt-outcome" : "outcome", { beat, alt });
      return { end: "outcome" };
    }
    if (st.k === "notices") { await shot(alt ? "alt-outcome" : "notice", { beat, alt }); return { end: "notice" }; }
    if (st.k === "talk" || st.k === "card" || st.k === "invite") {
      const ch = (st.choices || []).filter((c) => !c.locked);
      if (!ch.length) { notes.push(`${beat}: a screen with no reply to tap (node ${st.node})`); return { end: "stuck" }; }
      const c = first ? ch[Math.min(pick, ch.length - 1)] : ch[0];
      if (!first && !alt) last = await shot(st.k === "invite" ? "invite" : "screen", { beat, node: st.node });
      await call("choose", c.id);
      if (!alt && last) last.chose = c.label;
      first = false;
      continue;
    }
    if (st.k === "menu" || st.k === "phone") return { end: st.k };
  }
  notes.push(`${beat}: still going after 14 screens`);
  return { end: "long" };
}

const list = data.stories.filter((s, i) => i >= from && i < to && (!only || only.has(s.id) || only.has(s.slug)));
console.log(`${list.length} stories to photograph`);
await load();
let done = 0;
for (const s of list) {
  const jf = path.join(OUT, "stories", `${s.slug}.json`);
  if (fs.existsSync(jf)) { done++; continue; }
  story = s; shots = []; notes = []; n = 0; consoleErrors.length = 0;
  dir = path.join(OUT, "raw", s.slug); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  let began;
  try {
    began = await call("begin", s.id);
    if (!began.ok) notes.push(`Could not start: ${began.why}`);
    else {
      for (const b of s.beats) {
        await call("close");
        const ok = await call("open", b.id);
        if (!ok) { notes.push(`${b.id}: could not open (its people cannot be cast here)`); continue; }
        const st = await state();
        const first = await shot(st.k === "invite" ? "invite" : "open", { beat: b.id, node: st.node, screen: st.screen, template: st.template, stage: st.k });
        const nCh = (st.choices || []).filter((c) => !c.locked).length;
        first.replies = (st.choices || []).map((c) => c.label);
        // Big stories: every other first reply's outcome too (from a copy of the career, put back after).
        if (BIG.has(s.size) && nCh > 1) {
          const keep = await call("snap");
          for (let i = 1; i < nCh; i++) {
            await call("restore", keep); await settle(120);
            await walk(b.id, i, (st.choices.filter((c) => !c.locked)[i] || {}).label || `reply ${i + 1}`, null);
          }
          await call("restore", keep); await settle(120);
        }
        const r = await walk(b.id, 0, null, first);
        if (r.end === "stuck" || r.end === "long") continue;
      }
      await call("phone");
      await shot("phone", { note: "the phone's Stories list" });
    }
  } catch (e) {
    notes.push(`The run broke: ${String(e).slice(0, 200)}`);
    // The page crashed: a fresh page (a second try if the first one does too).
    await load().catch(async () => { await page.waitForTimeout(5000).catch(() => {}); page = null; await load(); });
  }
  const rec = { id: s.id, slug: s.slug, size: s.size, waiting: s.waiting || null, base: began?.base ?? null, shots, notes, consoleErrors: [...new Set(consoleErrors)].slice(0, 8), seconds: Math.round((Date.now() - t0) / 1000) };
  fs.writeFileSync(jf, JSON.stringify(rec, null, 1));
  done++;
  console.log(`${done}/${list.length} ${s.slug}: ${shots.length} shots, ${notes.length} notes, ${rec.seconds}s`);
  // A fresh page now and then keeps the dev server's page memory down.
  if (done % 10 === 0) await load();
}
await browser.close();
