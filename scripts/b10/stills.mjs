// B10 (headers and volleys back on, 20 Oct 2026): stills and a clip at phone
// size (390x844) on Infinite Highlights, which plays the real match.
//
//   node scripts/b10/stills.mjs [--url=http://localhost:3041] [--out=docs/handoffs/2026-10-20-builds/b10] [--only=signal,contact,buildup,clip,sheet]
//
// signal  — a header and a volley chance as you aim: the ball in the air, its shadow on the grass
// contact — the strike screen for each ("Head it?" / "Volley it?")
// buildup — Full highlights rebuild On: the cross in the air on its way to you
// clip    — ≤8 s MP4: the lofted build-up, then the header
// sheet   — 16 served header and volley chances as you aim them (8 each), on one sheet, to check by eye
import fs from "node:fs";
import { phone, startRec, stopRec } from "../film/rec.mjs";

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3041");
const OUT = arg("out", "docs/handoffs/2026-10-20-builds/b10");
const ONLY = new Set(arg("only", "signal,contact,buildup,clip,sheet").split(","));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

async function open(kinds, fhr) {
  const { browser, context, page } = await phone({ deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(([k, f]) => {
    localStorage.setItem("star-fhr", f ? "on" : "off");
    localStorage.setItem("star-highlights-kinds-v1", JSON.stringify(k));
  }, [kinds, fhr]);
  await page.goto(`${URL0}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.locator(".ih-play").first().waitFor({ timeout: 300000 });
  await wait(2000);
  await page.locator(".ih-stage").first().scrollIntoViewIfNeeded();
  return { browser, page, errors };
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 70 });
const phase = (page) => page.evaluate(() => globalThis.__starMatch?.phase?.() ?? null);
const kindNow = (page) => page.evaluate(() => globalThis.__starMatch?.kind?.() ?? null);
async function until(page, test, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await test()) return true; await wait(50); }
  return false;
}
const label = (page) => page.evaluate(() => document.querySelector("[data-buildup]")?.textContent ?? null);
/** Play the chance on screen and wait until it is yours to aim (after any build-up). */
async function playToAim(page) {
  await page.locator(".ih-play").first().click();
  await until(page, async () => (await phase(page)) === "aim" && !(await label(page)), 30000);
  await wait(500);
}
async function stop(page) { await page.locator(".ih-play").first().click(); await wait(400); }
async function next(page) { await page.locator(".ih-next").first().click(); await wait(800); }
/** Drag back from the ball (a slingshot) toward the far post, and let go: the run-up, then the strike screen. */
async function aimAndRelease(page, pull = 70) {
  const b = await page.evaluate(() => globalThis.__starMatch?.ball?.());
  const g = await page.evaluate(() => globalThis.__starMatch?.goal?.());
  if (!b || !g) return false;
  const dx = g.x - b.x, dy = g.y - b.y, L = Math.hypot(dx, dy) || 1;
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(b.x - (dx / L) * pull * i / 12, b.y - (dy / L) * pull * i / 12); await wait(16); }
  await page.mouse.up();
  return until(page, async () => (await page.locator("[data-air-hint]").count()) > 0, 8000);
}
async function tapBall(page, cy = -0.3) {
  const ball = page.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  const b = await ball.boundingBox();
  if (!b) return false;
  const r = b.width / 2;
  await page.mouse.click(b.x + r, b.y + r + cy * r);
  return true;
}

if (ONLY.has("signal") || ONLY.has("contact")) {
  for (const kind of ["header", "volley"]) {
    const { browser, page, errors } = await open([kind], false);
    await playToAim(page);
    console.log(kind, "phase", await phase(page), "kind", await kindNow(page));
    if (ONLY.has("signal")) {
      // A volley bounces: catch it near the top of a bounce (VOLLEY_BOUNCE_S 0.9 s; top at whole periods).
      if (kind === "volley") await wait(850);
      await shot(page, `b10-${kind}-signal`);
    }
    if (ONLY.has("contact")) {
      const ok = await aimAndRelease(page);
      await wait(kind === "volley" ? 700 : 400);
      await shot(page, `b10-${kind}-contact`);
      console.log(kind, "strike screen:", ok);
      await tapBall(page, kind === "header" ? -0.35 : -0.05);
      await wait(1500);
      await shot(page, `b10-${kind}-after-strike`);
    }
    console.log(kind, "errors:", errors.length ? errors.slice(0, 3) : "none");
    await browser.close();
  }
}

if (ONLY.has("buildup") || ONLY.has("clip")) {
  const { browser, page, errors } = await open(["header"], true);
  let built = null;
  for (let i = 0; i < 8 && !built; i++) {
    await page.evaluate(() => { globalThis.__starLastBuildUp = null; });
    await page.locator(".ih-play").first().click();
    await until(page, async () => !!(await page.evaluate(() => globalThis.__starLastBuildUp)), 8000);
    const b = await page.evaluate(() => globalThis.__starLastBuildUp);
    if (b && b.durS <= 7.2) { built = b; break; }
    await stop(page); await next(page);
  }
  console.log("build-up:", JSON.stringify(built));
  if (built && ONLY.has("buildup")) {
    // The cross is the last ~1.5 s of the build-up: catch it in the air.
    await until(page, async () => !!(await label(page)), 5000);
    await wait(Math.max(300, (built.durS - 1.0) * 1000));
    await shot(page, "b10-buildup-cross");
    await until(page, async () => !(await label(page)), 8000);
    await wait(300);
    await shot(page, "b10-buildup-handover");
  }
  if (built && ONLY.has("clip")) {
    await stop(page);
    const t0 = Date.now();
    await page.evaluate(() => { globalThis.__starLastBuildUp = null; });
    await page.locator(".ih-play").first().click();
    await until(page, async () => !!(await label(page)), 5000);
    // Film from ~2.4 s before the hand-over: the cross, the ball hanging, the header.
    await wait(Math.max(0, (built.durS - 2.4) * 1000 - (Date.now() - t0)));
    const r = await startRec(page);
    await until(page, async () => (await phase(page)) === "aim" && !(await label(page)), 9000);
    await wait(300);
    await aimAndRelease(page, 75);
    await wait(250);
    await tapBall(page, -0.35);
    await wait(1700);
    await stopRec(r, `${OUT}/b10-header-from-buildup.mp4`, { holdEnd: 0.2 });
  }
  console.log("build-up errors:", errors.length ? errors.slice(0, 3) : "none");
  await browser.close();
}

if (ONLY.has("sheet")) {
  const cells = [];
  for (const kind of ["header", "volley"]) {
    const { browser, page, errors } = await open([kind], false);
    for (let i = 0; i < 8; i++) {
      if (i) { await next(page); }
      await playToAim(page);
      if (kind === "volley") await wait(850);
      const canvas = page.locator(".ih-stage canvas").first();
      const buf = await canvas.screenshot({ type: "jpeg", quality: 68 });
      const seed = await page.evaluate(() => document.querySelector(".ih-lower-text span")?.textContent ?? "");
      cells.push({ kind, seed, src: `data:image/jpeg;base64,${buf.toString("base64")}`, k: await kindNow(page) });
      await stop(page);
    }
    console.log(kind, "sheet errors:", errors.length ? errors.slice(0, 3) : "none");
    await browser.close();
  }
  const { browser, page } = await phone({ deviceScaleFactor: 1, viewport: { width: 1240, height: 900 }, isMobile: false, hasTouch: false });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#0b0f14;color:#e5e7eb;font:13px system-ui}
  .g{display:grid;grid-template-columns:repeat(8,150px);gap:6px;padding:8px}.c img{width:150px;display:block;border-radius:4px}.c div{font-size:11px;padding:2px 0}</style></head><body>
  <div style="padding:8px 8px 0;font-weight:700">B10 — 8 headers (top) and 8 volleys (bottom), served by the real chance maker, as you aim them (the ball in the air, its shadow under it)</div>
  <div class="g">${cells.map((c, i) => `<div class="c"><img src="${c.src}"/><div>${i + 1}. ${c.k} ${c.seed}</div></div>`).join("")}</div></body></html>`;
  await page.setContent(html);
  await page.screenshot({ path: `${OUT}/b10-air-chances-sheet.jpg`, type: "jpeg", quality: 72, fullPage: true });
  await browser.close();
  console.log("sheet:", cells.map((c) => `${c.k}${c.seed}`).join(" "));
}
