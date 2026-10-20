// B2b (Full highlights rebuild, 20 Oct 2026): clips and stills at phone size
// (390x844), switch On — a build-up handing over to its chance, and one that
// ends in a called offside.
//
//   node scripts/fhr/b2b-stills.mjs [--url=http://localhost:3062] [--out=docs/handoffs/2026-10-20-builds/b2b] [--only=handover,offside]
//
// Infinite Highlights (its Play is the real match, CanvasMatch through
// EnginePlay). Reads window.__starLastBuildUp (lib/star/fhr/builders.ts) to
// know what was built; the same chance always gets the same build-up, so a
// found one is played again with the camera running. Every still and clip is
// written the moment it is made.
import { phone, startRec, stopRec } from "../film/rec.mjs";

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3062");
const OUT = arg("out", "docs/handoffs/2026-10-20-builds/b2b");
const ONLY = new Set(arg("only", "handover,offside").split(","));
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
const shot = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 74 }); console.log("still:", `${OUT}/${name}.jpg`); };
async function play(page) {
  await page.evaluate(() => { globalThis.__starLastBuildUp = null; });
  await page.locator(".ih-play").first().click();
  for (let i = 0; i < 40; i++) { await wait(100); const b = await last(page); if (b) return b; }
  return null;
}
async function stop(page) { await page.locator(".ih-play").first().click(); await wait(400); }
async function next(page) { await page.locator(".ih-next").first().click(); await wait(700); }
async function frame(page) { await page.locator(".ih-stage").first().scrollIntoViewIfNeeded(); await wait(300); }
const label = (page) => page.evaluate(() => document.querySelector("[data-buildup]")?.textContent ?? null);
async function until(page, test, ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const l = await label(page); if (test(l)) return l; await wait(40); }
  return null;
}
/** Find a chance whose build-up passes `want`; leaves it stopped, ready to play again. */
async function find(page, want, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const b = await play(page);
    if (b && want(b)) { await stop(page); return b; }
    await stop(page); await next(page);
  }
  return null;
}

if (ONLY.has("handover")) {
  const { browser, page, errors } = await openHighlights(["one_on_one", "cutback", "tight_angle", "long_range"]);
  await frame(page);
  const got = await find(page, (b) => b.what === "open" && !b.offside && b.durS <= 6.8);
  console.log("handover:", JSON.stringify(got));
  if (got) {
    const r = await startRec(page);
    await wait(300);
    await play(page);
    await until(page, (l) => !!l);
    await wait(Math.max(600, got.durS * 1000 - 900));
    await shot(page, "b2b-handover-last-buildup-moment");
    await until(page, (l) => l === null, 8000);
    await shot(page, "b2b-handover-the-chance");
    await wait(Math.min(1800, 9500 - got.durS * 1000));
    await stopRec(r, `${OUT}/b2b-buildup-into-chance.mp4`, { holdEnd: 0.3 });
    console.log("clip:", `${OUT}/b2b-buildup-into-chance.mp4`);
  }
  console.log("handover errors:", errors.length ? errors.slice(0, 3) : "none");
  await browser.close();
}

if (ONLY.has("offside")) {
  const { browser, page, errors } = await openHighlights(["one_on_one", "cutback", "tight_angle", "long_range", "byline_cross"]);
  await frame(page);
  const got = await find(page, (b) => b.what === "open" && b.offside && b.durS <= 8.3, 120);
  console.log("offside:", JSON.stringify(got));
  if (got) {
    const r = await startRec(page);
    await wait(300);
    await play(page);
    await until(page, (l) => !!l);
    await until(page, (l) => !!l && /Offside/.test(l), 12000);
    await wait(150);
    await shot(page, "b2b-offside-flag");
    await until(page, (l) => l === null, 6000);
    await wait(450);
    await shot(page, "b2b-offside-called");
    await wait(900);
    await stopRec(r, `${OUT}/b2b-buildup-offside-called.mp4`, { holdEnd: 0.3 });
    console.log("clip:", `${OUT}/b2b-buildup-offside-called.mp4`);
  }
  console.log("offside errors:", errors.length ? errors.slice(0, 3) : "none");
  await browser.close();
}
