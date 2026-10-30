// Real Goals clips WITH THE GAME'S SOUND (chat 5, 25 Oct 2026): one full path level
// (path tile → level → the real build-up → your shot → result and stars) and the
// daily goal (card → play → result → back home with the streak). Real play only.
// Needs a built server (`next start`, NEXT_PUBLIC_STAR_OFFLINE_DEV=1) on FILM_BASE.
//   node scripts/film/scenes/rg-sound.mjs <outDir> level <pathId> <levelIndex> <dx> <pull> <lift>
//   node scripts/film/scenes/rg-sound.mjs <outDir> daily <dx> <pull> <lift>
// dx/pull/lift: the pull that scored that goal in rg-play.mjs (play.json). If it
// misses, ↺ Again is pressed and the next try is aimed from the result picture;
// the cut then starts at the scoring try (the marks are printed).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { installAudioTap } from "./audio-tap.mjs";
import { startPcm, stopPcm } from "./audio-pcm.mjs";
import { findBall, BASE } from "./rg-lib.mjs";

const [outDir, mode, ...rest] = process.argv.slice(2);
const OUT = path.resolve(outDir);
fs.mkdirSync(OUT, { recursive: true });
const name = mode === "daily" ? "rg-daily-sound" : `rg-level-sound`;
const raw = path.join(OUT, `.${name}-raw`);
fs.mkdirSync(raw, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: raw, size: { width: 390, height: 844 } } });
await installAudioTap(ctx);
// Optional saved progress (e.g. the levels before the filmed one won): RG_SEED = {"key": "json"}.
if (process.env.RG_SEED) await ctx.addInitScript((seed) => { for (const [k, v] of Object.entries(seed)) { try { if (!localStorage.getItem(k)) localStorage.setItem(k, v); } catch { /* */ } } }, JSON.parse(process.env.RG_SEED));
// Optional: the phone's clock on another UTC day (RG_DAY=YYYY-MM-DD), to film a chosen daily goal.
if (process.env.RG_DAY) await ctx.addInitScript((t) => { const off = t - Date.now(); const real = Date.now.bind(Date); Date.now = () => real() + off; }, Date.parse(`${process.env.RG_DAY}T12:00:00Z`));
const page = await ctx.newPage();
const tRec = Date.now();
const clipT = () => (Date.now() - tRec) / 1000;
const marks = {};
const mark = (k) => { marks[k] = +clipT().toFixed(2); console.log(k, marks[k]); };

// A visible finger dot.
await page.addInitScript(() => {
  addEventListener("pointerdown", (e) => {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:${e.clientX - 16}px;top:${e.clientY - 16}px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.45);border:2px solid #fff;z-index:2147483647;pointer-events:none;transition:opacity .6s`;
    document.documentElement.appendChild(d); setTimeout(() => { d.style.opacity = "0"; }, 350); setTimeout(() => d.remove(), 1000);
  }, true);
});

async function strike(dx, pull, lift, tapWait = 500) {
  const contact = 'div.cursor-pointer[style*="aspect-ratio"]';
  const cands = (await findBall(page)).sort((a, b) => Math.abs(a[0] - 195) - Math.abs(b[0] - 195));
  for (const [x, y] of cands.slice(0, 8)) {
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 16; i++) { await page.mouse.move(x - (dx * i) / 16, y + (pull * i) / 16); await page.waitForTimeout(25); }
    await page.mouse.up(); await page.waitForTimeout(900);
    if (await page.locator(contact).count()) {
      const bb = await page.locator(contact).first().boundingBox(); const r = bb.width / 2;
      await page.waitForTimeout(tapWait);
      await page.mouse.click(bb.x + r, bb.y + r * (1 + lift));
      return true;
    }
  }
  return false;
}
const scrollToPitch = () => page.evaluate(() => { const c = document.querySelector("[data-playing] canvas"); if (c) window.scrollBy({ top: c.getBoundingClientRect().top - 40, behavior: "smooth" }); });

async function shootUntilGoal(dx, pull, lift, tapWait = 500) {
  const hist = [];
  for (let i = 0; i < 12; i++) {
    if (i > 0 && (await page.getByText("↺ Again").count())) { await page.getByText("↺ Again").click(); await page.waitForTimeout(2600); }
    if (i > 0) { await scrollToPitch(); await page.waitForTimeout(600); }
    mark(`try${i + 1}`);
    if (!(await strike(dx, pull, lift, tapWait))) { dx += 8; continue; }
    await page.waitForSelector("[data-result]", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(300);
    const r = ((await page.locator("[data-result]").first().innerText().catch(() => "")) ?? "").replace(/\s+/g, " ");
    console.log(`try ${i + 1} (${dx.toFixed(1)}, ${pull}, ${lift.toFixed(2)}, ${tapWait}):`, r.slice(0, 120));
    if (/^Goal!/i.test(r)) { marks.scoredTry = i + 1; marks.aim = [dx, pull, lift, tapWait]; return r; }
    const d = await page.evaluate(() => {
      const svg = [...document.querySelectorAll("[data-result] svg")].pop(); if (!svg) return null;
      const c = [...svg.querySelectorAll("circle")]; const g = (f) => c.find((e) => e.getAttribute("fill") === f);
      const xy = (e) => (e ? { x: +e.getAttribute("cx"), y: +e.getAttribute("cy") } : null);
      return { real: xy(g("#22c55e")), you: xy(g("#38bdf8")) };
    });
    if (d?.you && d.real) {
      const err = d.you.x - d.real.x; hist.push([dx, err]);
      if (hist.length >= 2 && Math.abs(hist[hist.length - 1][1] - hist[hist.length - 2][1]) > 2) {
        const [x1, e1] = hist[hist.length - 1], [x0, e0] = hist[hist.length - 2];
        dx = Math.max(-140, Math.min(140, x1 - (e1 * (x1 - x0)) / (e1 - e0)));
      } else dx += err > 0 ? -25 : 25;
      lift = Math.max(-0.6, Math.min(0.9, lift + (d.real.y - d.you.y > 0 ? -0.15 : 0.15)));
    } else { pull = pull === 120 ? 165 : 120; tapWait = tapWait === 500 ? 150 : tapWait === 150 ? 900 : 500; }
  }
  throw new Error("never scored");
}

let pcm = null;
try {
  if (mode === "level") {
    const [pathId, lvl, dx, pull, lift] = rest;
    await page.goto(`${BASE}/star-real-goals-dev`);
    await page.waitForSelector("[data-path-tile]");
    await page.waitForTimeout(1200);
    pcm = await startPcm(page, clipT);
    mark("start");
    await page.waitForTimeout(800);
    await page.locator(`[data-path-tile="${pathId}"]`).click();
    await page.waitForSelector(`[data-path="${pathId}"] [data-level="${lvl}"]`, { timeout: 120000 });
    await page.waitForTimeout(1200);
    await page.locator(`[data-level="${lvl}"]`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.locator(`[data-level="${lvl}"]`).click();
    await page.waitForSelector("[data-playing] canvas", { timeout: 120000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.waitForTimeout(1500);
    await scrollToPitch();
    await page.waitForFunction(() => /Your turn/.test(document.querySelector("[data-caption]")?.textContent ?? ""), null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(700);
    const r = await shootUntilGoal(+dx, +pull, +lift, +(rest[5] ?? 500) || 500);
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector("[data-result]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 85 });
    mark("end");
    marks.result = r.slice(0, 80);
  } else {
    const [dx, pull, lift, tw] = rest;
    await page.goto(`${BASE}/star-real-goals-dev`);
    await page.waitForSelector("[data-play-daily]");
    await page.waitForTimeout(1200);
    pcm = await startPcm(page, clipT);
    mark("start");
    await page.waitForTimeout(1500);
    await page.locator("[data-play-daily]").click();
    await page.waitForSelector("[data-playing] canvas", { timeout: 120000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.waitForTimeout(1500);
    await scrollToPitch();
    await page.waitForFunction(() => /Your turn/.test(document.querySelector("[data-caption]")?.textContent ?? ""), null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(700);
    const r = await shootUntilGoal(+dx, +pull, +lift, +(tw ?? 500) || 500);
    await page.waitForTimeout(2000);
    await page.evaluate(() => document.querySelector("[data-result]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "✕" }).first().click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await page.waitForSelector("[data-daily] .rg-ddone", { timeout: 10000 });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 85 });
    mark("end");
    marks.result = r.slice(0, 80);
    marks.card = ((await page.locator("[data-daily]").innerText()) ?? "").replace(/\s+/g, " ").slice(0, 160);
  }
} finally {
  if (pcm) { try { marks.audioAt = await stopPcm(page, path.join(raw, "sound.wav"), pcm); } catch (e) { console.log("no sound:", e.message); } }
  const vid = page.video();
  await ctx.close();
  await browser.close();
  const webm = await vid.path();
  fs.writeFileSync(path.join(raw, "marks.json"), JSON.stringify(marks, null, 1));
  console.log(JSON.stringify(marks));
  // Cut: from the start (or the scoring try's lead-in when earlier tries missed) to the end, with the sound.
  if (marks.end) {
    const s0 = Math.max(0, (marks.start ?? 0) - 0.3);
    const args = ["scripts/film/scenes/cut.py", webm, path.join(OUT, `${name}.mp4`), String(s0), String(marks.end + 0.3), "--crf", "27", "--still", String(marks.end - 0.2)];
    if (marks.audioAt != null) args.push("--audio", path.join(raw, "sound.wav"), "--audio-at", String(marks.audioAt));
    const c = spawnSync("python3", args, { stdio: "inherit" });
    console.log("cut exit", c.status);
  }
}
