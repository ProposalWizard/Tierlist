/**
 * PROBE: what happens after full time, 3D view on or off (chat 1, 24 Oct 2026).
 *
 *   node scripts/film/scenes/fulltime-probe.mjs <port> <seed.json> <outDir> <3d|2d>
 *
 * Opens the seed save, plays every chance with a quick real shot (it does not need to
 * score), and from full time on logs every 5 s: the phase, the screen's words, whether
 * the page still answers, and every console/page error; a still every 15 s.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [PORT, SEED, OUT, VIEW] = process.argv.slice(2);
const V3 = VIEW === "3d";
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now(), at = () => ((Date.now() - T0) / 1000).toFixed(1);
const log = (...a) => console.log(at(), ...a);
const prof = path.join(OUT, `prof-${VIEW}`);
fs.rmSync(prof, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(prof, {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--disable-dev-shm-usage"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
});
const pg = ctx.pages()[0] || (await ctx.newPage());
pg.on("pageerror", (e) => log("PAGEERROR", e.message.slice(0, 300)));
pg.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (!/supabase|status of 5|flagcdn|googletag|ERR_TUNNEL|preload/i.test(t)) log("CONSOLE", m.type(), t.slice(0, 300)); } });
pg.on("crash", () => log("RENDERER CRASHED"));
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
await pg.addInitScript(([seed, v3]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now() + 1e6));
  localStorage.setItem("star-look-match-3d", v3 ? "on" : "off");
}, [seed, V3]);
await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(6000);
const ask = (fn, ms = 8000) => Promise.race([pg.evaluate(fn).catch((e) => "ERR " + e.message.slice(0, 60)), wait(ms).then(() => "NO ANSWER")]);
const within = (p, ms = 6000) => Promise.race([p.catch(() => null), wait(ms).then(() => null)]);
let fullTime = null, lastShot = 0, n = 0;
while (Date.now() - T0 < 40 * 60000) {
  const st = await ask(() => ({ ph: window.__starMatch?.phase?.() ?? null, txt: document.body.innerText.slice(0, 120).replace(/\s+/g, " "), hidden: document.visibilityState }));
  if (typeof st === "string") { log("PAGE NOT ANSWERING", st); await within(pg.screenshot({ path: path.join(OUT, `${VIEW}-frozen-${at()}.jpg`), type: "jpeg", quality: 50, timeout: 15000 }), 16000); await wait(5000); continue; }
  if (!fullTime) log("state", st.ph, st.txt.slice(0, 60));
  if (!fullTime && Date.now() - (globalThis.lastShotPic || 0) > 60000) { globalThis.lastShotPic = Date.now(); await within(pg.screenshot({ path: path.join(OUT, `${VIEW}-before-${at()}.jpg`), type: "jpeg", quality: 50, timeout: 15000 }), 16000); }
  // full time: the match's own "FULL TIME →" button is up (the words at the top of the screen are the score bar)
  const ftBtn = pg.locator("button:visible").filter({ hasText: /^\s*full time/i }).first();
  const over = st.ph !== "aim" && !!(await within(ftBtn.count(), 4000));
  if (!fullTime && over) {
    fullTime = Date.now(); log("FULL TIME button up", JSON.stringify(st));
    await within(pg.screenshot({ path: path.join(OUT, `${VIEW}-fulltime.jpg`), type: "jpeg", quality: 50, timeout: 15000 }), 16000);
    await within(ftBtn.click({ timeout: 5000 })); log("tapped FULL TIME");
    await wait(1500);
  }
  if (fullTime) {
    if (n % 3 === 0) await pg.screenshot({ path: path.join(OUT, `${VIEW}-${String(n).padStart(3, "0")}.jpg`), type: "jpeg", quality: 50, timeout: 20000 }).catch((e) => log("SCREENSHOT FAILED", e.message.slice(0, 80)));
    log("after FT", JSON.stringify(st)); n++;
    // press on through the post-match screens the way a player would
    const b = pg.locator("button:visible").filter({ hasText: /full time|continue|got it|next|done|close/i }).first();
    if (await within(b.count())) { const t = (await within(b.innerText())) || ""; log("tap", t.replace(/\s+/g, " ").slice(0, 40)); await within(b.click({ timeout: 5000 })); }
    if (Date.now() - fullTime > 6 * 60000) break;
    await wait(5000); continue;
  }
  if (st.ph === "aim" && Date.now() - lastShot > 4000) {
    lastShot = Date.now();
    const f = await ask(() => ({ b: window.__starMatch.ball(), g: window.__starMatch.goal() }));
    if (f && f !== "NO ANSWER" && f.b && f.g) {
      await pg.mouse.move(f.b.x, f.b.y); await pg.mouse.down();
      for (let i = 1; i <= 8; i++) { await pg.mouse.move(f.b.x + (f.b.x - f.g.x) * 0.15 * i / 8, f.b.y + 60 * i / 8); await wait(40); }
      await pg.mouse.up(); await wait(1500);
      const ball = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
      if (await ball.count()) { const bb = await ball.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2); }
      log("shot");
    }
  } else if (!st.ph || st.ph === "feed") {
    for (const re of [/get out there/i, /play match|kick off/i, /team sheets/i, /second half|^next|play on|resume/i, /^▶ *play|^play$/i, /continue|tap to hear|^ok$|skip|close|done/i]) {
      const b = pg.locator("button:visible").filter({ hasText: re }).first();
      if (await within(b.count())) { await within(b.click({ timeout: 2000 })); break; }
    }
    if (st.ph === "feed") await within(pg.mouse.click(195, 400));
  }
  await wait(1500);
}
await ctx.close().catch(() => {});
log("end");
