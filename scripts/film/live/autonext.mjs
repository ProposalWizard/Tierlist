/**
 * The test page never replays a chance as a static picture: after each chance it
 * starts a new one (or, "the same one, live", replays it from its build-up).
 * Plays N chances by letting each pass run past, never pressing a button, and
 * prints which chance is on screen and whether each one went live.
 *   node scripts/film/live/autonext.mjs [--port 3421] [--n 3] [--again]
 */
import { chromium } from "playwright";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PORT = arg("port", "3421"), N = Number(arg("n", "3"));
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const pg = await (await b.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
await pg.goto(`http://localhost:${PORT}/star-live-chances-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await pg.waitForSelector("[data-live-switch]", { timeout: 120000 });
if (process.argv.includes("--again")) await pg.getByText("After a chance: the same one, live").click();
await pg.waitForTimeout(1500);
const label = () => pg.evaluate(() => document.body.innerText.match(/#\d+ of \d+ · [a-z ]+/)?.[0] ?? "?");
for (let i = 0; i < N; i++) {
  await pg.evaluate(() => { window.__live = undefined; });
  const t0 = Date.now(); let live = false, static_ = 0;
  const start = await label();
  // watch until the chance on screen changes (or 40 s)
  while (Date.now() - t0 < 40000) {
    const s = await pg.evaluate(() => ({ live: !!window.__live, ph: window.__starMatch?.phase?.() }));
    if (s.live) live = true;
    // the ball parked at your feet with no live pass, after this chance was live: a static copy
    if (live && s.ph === "aim" && !(await pg.evaluate(() => !!window.__live && window.__live.along < 3))) static_++;
    if ((await label()) !== start || (process.argv.includes("--again") && i > 0 && false)) break;
    await pg.waitForTimeout(100);
  }
  console.log(i, start, "→", await label(), live ? "went live" : "NOT live", static_ ? `(${static_} frames looked static)` : "");
}
await b.close();
