// B2 (Full highlights rebuild, 20 Oct 2026): stills and a clip of the build-ups
// on Infinite Highlights, at phone size (390x844, JPG), with the switch On.
//
//   node scripts/fhr/b2-stills.mjs [--url=http://localhost:3033] [--out=docs/handoffs/2026-10-20-builds/b2] [--only=open,cover,foul,clip]
//
// open  — an open-play build-up mid-way, and the hand-over (men still running)
// cover — a build-up where the extra defender sprints in from off the screen
// foul  — a free kick with the foul first, at the foul
// clip  — ≤10 s MP4: a build-up running into a moving chance
// Reads window.__starLastBuildUp (lib/star/fhr/builders.ts) to know what was built.
import { phone, startRec, stopRec } from "../film/rec.mjs";

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3033");
const OUT = arg("out", "docs/handoffs/2026-10-20-builds/b2");
const ONLY = new Set(arg("only", "open,cover,foul,clip").split(","));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function openHighlights(kinds) {
  const { browser, context, page } = await phone({ deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript((k) => {
    localStorage.setItem("star-fhr", "on");
    localStorage.setItem("star-highlights-kinds-v1", JSON.stringify(k));
    localStorage.setItem("star-fhr-adjust", JSON.stringify({ moment: "auto", length: "auto", intensity: "auto" }));
  }, kinds);
  await page.goto(`${URL0}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.locator(".ih-play").first().waitFor({ timeout: 300000 });
  await wait(2500);
  return { browser, page, errors };
}
const last = (page) => page.evaluate(() => globalThis.__starLastBuildUp ?? null);
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 72 });
/** Play the chance on screen; resolves once the build-up is built (or not). */
async function play(page) {
  await page.evaluate(() => { globalThis.__starLastBuildUp = null; });
  await page.locator(".ih-play").first().click();
  for (let i = 0; i < 40; i++) { await wait(100); const b = await last(page); if (b) return b; }
  return null;
}
async function stop(page) { await page.locator(".ih-play").first().click(); await wait(400); }
async function next(page) { await page.locator(".ih-next").first().click(); await wait(700); }
/** Scroll the picture into view under the dock. */
async function frame(page) { await page.locator(".ih-stage").first().scrollIntoViewIfNeeded(); await wait(300); }
/** The build-up's label over the picture ("Build-up · tap to skip"), or null once the chance is yours. */
const label = (page) => page.evaluate(() => document.querySelector("[data-buildup]")?.textContent ?? null);
async function until(page, test, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const l = await label(page); if (test(l)) return l; await wait(40); }
  return null;
}

if (ONLY.has("open")) {
  const { browser, page, errors } = await openHighlights(["one_on_one", "through_ball", "long_range", "cutback"]);
  await frame(page);
  const b = await play(page);
  console.log("open:", JSON.stringify(b));
  if (b) {
    await until(page, (l) => !!l);
    await wait(Math.max(800, (b.durS / 2) * 1000 - 300));
    await shot(page, "b2-highlights-buildup");
    // The moment the chance is yours: the label goes, the men are still running.
    await until(page, (l) => l === null, 12000);
    await shot(page, "b2-highlights-handover");
  }
  console.log("open errors:", errors.length ? errors.slice(0, 3) : "none");
  await browser.close();
}

if (ONLY.has("cover")) {
  const { browser, page, errors } = await openHighlights(["one_on_one", "through_ball", "long_range"]);
  await frame(page);
  let got = null;
  for (let i = 0; i < 30 && !got; i++) {
    const b = await play(page);
    if (b?.cover) { got = b; break; }
    await stop(page); await next(page);
  }
  console.log("cover:", JSON.stringify(got));
  if (got) {
    // The extra defender comes on the screen in the second half of the build-up: two stills.
    await until(page, (l) => !!l);
    await wait(Math.max(500, got.durS * 1000 * 0.72));
    await shot(page, "b2-extra-defender-running-in");
    await until(page, (l) => l === null, 12000);
    await wait(1100);
    await shot(page, "b2-extra-defender-in-the-chance");
  }
  console.log("cover errors:", errors.length ? errors.slice(0, 3) : "none");
  await browser.close();
}

if (ONLY.has("foul")) {
  const { browser, page, errors } = await openHighlights(["free_kick", "penalty"]);
  await frame(page);
  let got = null;
  for (let i = 0; i < 20 && !got; i++) {
    const b = await play(page);
    if (b?.what === "foul") { got = b; break; }
    await stop(page); await next(page);
  }
  console.log("foul:", JSON.stringify(got));
  if (got) {
    await until(page, (l) => !!l);
    await wait(900);
    await shot(page, "b2-foul-driving-at-goal");
    await until(page, (l) => !!l && /Foul|Penalty/.test(l), 8000);
    await wait(150);
    await shot(page, "b2-foul-the-foul");
    await until(page, (l) => l === null, 12000);
    await wait(300);
    await shot(page, "b2-foul-set-piece");
  }
  console.log("foul errors:", errors.length ? errors.slice(0, 3) : "none");
  await browser.close();
}

if (ONLY.has("clip")) {
  const { browser, page, errors } = await openHighlights(["one_on_one", "through_ball"]);
  await frame(page);
  // A short one, so the whole build-up and the moving hand-over fit in 10 s.
  let got = null;
  for (let i = 0; i < 15; i++) {
    const b = await play(page);
    if (b && b.durS <= 6.6) { got = b; break; }
    await stop(page); await next(page);
  }
  if (got) {
    await stop(page);
    const r = await startRec(page);
    await wait(300);
    await play(page);
    await wait(Math.min(9300, got.durS * 1000 + 1600));
    await stopRec(r, `${OUT}/b2-buildup-into-chance.mp4`, { holdEnd: 0.3 });
  }
  console.log("clip:", JSON.stringify(got), "errors:", errors.length ? errors.slice(0, 3) : "none");
  await browser.close();
}
