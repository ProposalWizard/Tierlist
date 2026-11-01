/**
 * FIRST TOUCH check (live chances): on the test page, pick a kind, flick the
 * ball as it reaches you (a direction on the PITCH, e.g. forward-left), then
 * finish with the normal aim + kick screen once you catch it up.
 *   node scripts/film/live/touchcheck.mjs [--port 3421] [--kind "one on one"] [--n 3]
 *     [--dir -0.7,-0.7] (pitch: -y is towards goal) [--len 0.14] (share of height) [--at 0] [--shots dir] [--noshot]
 * Needs an offline-dev build (window.__live).
 */
import { chromium } from "playwright";
import fs from "node:fs";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PORT = arg("port", "3421"), KIND = arg("kind", "one on one"), N = Number(arg("n", "3"));
const DIR = arg("dir", "-0.7,-0.7").split(",").map(Number), LEN = Number(arg("len", "0.14")), AT = Number(arg("at", "0")), SHOTS = arg("shots", "");
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const pg = await (await b.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
pg.on("pageerror", (e) => console.log("PAGE ERROR:", String(e).slice(0, 400))); pg.on("crash", () => console.log("PAGE CRASHED")); pg.on("close", () => console.log("PAGE CLOSED")); b.on("disconnected", () => console.log("BROWSER DISCONNECTED")); pg.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 200)); });
await pg.addInitScript(() => { window.__swings = []; window.addEventListener("kib-live-swing", (e) => window.__swings.push(e.detail)); window.__outs = []; });
await pg.goto(`http://localhost:${PORT}/star-live-chances-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await pg.waitForSelector("[data-live-kinds]", { timeout: 120000 });
await pg.waitForTimeout(1500);
await pg.locator("[data-live-kinds] >> text=" + KIND).first().click();
await pg.waitForTimeout(800);
const live = () => pg.evaluate(() => (window.__live ? { ...window.__live, px: undefined } : null));
const px = (x, y) => pg.evaluate(([x, y]) => window.__live?.px?.(x, y) ?? null, [x, y]);
const shot = async (name) => { if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${name}.png`, clip: { x: 0, y: 0, width: 440, height: 1000 } }); };
for (let i = 0; i < N; i++) {
  await pg.evaluate(() => { window.__live = undefined; window.__swings = []; });
  let L = null; const t0 = Date.now();
  while (Date.now() - t0 < 25000 && !(L = await live())) await pg.waitForTimeout(50);
  if (!L) { console.log(i, "NOT LIVE", await pg.evaluate(() => document.body.innerText.match(/#\d+ of \d+ · [a-z ]+/)?.[0])); await pg.getByText("Next chance", { exact: true }).click(); continue; }
  const k0 = L.keeper;
  // 1) the flick: press on the ring, a quick swipe along DIR on the pitch, as the ball arrives
  while ((L = await live()) && !L.touched && L.along < AT) await pg.waitForTimeout(8);
  if (!L || L.touched) { console.log(i, "missed the moment"); continue; }
  // --round: take it round the side the keeper is not on (forwards and across)
  if (process.argv.includes("--round")) { const sd = Math.sign(L.plan.spot.x - L.keeper.x) || 1; DIR[0] = sd * 0.85; DIR[1] = -0.5; }
  const sp = L.spotPx, d = Math.hypot(DIR[0], DIR[1]) || 1;
  const far = await px(L.plan.spot.x + DIR[0] / d * 6, L.plan.spot.y + DIR[1] / d * 6);
  const H = await pg.evaluate(() => { const cs = [...document.querySelectorAll("canvas")].sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height); return cs[0].getBoundingClientRect().height; });
  const vx = far.x - sp.x, vy = far.y - sp.y, vl = Math.hypot(vx, vy) || 1, len = LEN * H;
  await shot(`t${i}-a-before`);
  await pg.mouse.move(sp.x, sp.y); await pg.mouse.down();
  await pg.mouse.move(sp.x + vx / vl * len * 0.5, sp.y + vy / vl * len * 0.5, { steps: 2 });
  await pg.mouse.move(sp.x + vx / vl * len, sp.y + vy / vl * len, { steps: 2 });
  await pg.mouse.up();
  await pg.waitForTimeout(120);
  const sw = await pg.evaluate(() => window.__swings.at(-1) ?? null);
  console.log("flick:", JSON.stringify(await pg.evaluate(() => window.__flick ?? null)));
  if (process.argv.includes("--trace")) for (let q = 0; q < 15; q++) { const st = await pg.evaluate(() => { const l = window.__live; return l ? { T: +l.T.toFixed(2), along: +l.along.toFixed(2), t1: +l.plan.t1.toFixed(2), you: l.you, k: l.keeper, kp: l.kp, ph: window.__starMatch?.phase?.() } : null; }).catch((e) => "ERR " + e.message.slice(0, 80)); console.log("  trace", JSON.stringify(st)); await pg.waitForTimeout(200); }
  L = await live();
  await shot(`t${i}-b-touched`);
  const line = [`${i}`, `touch: ${sw ? (sw.ok ? `${sw.timing} along ${sw.along.toFixed(2)} v0 ${sw.v0.toFixed(1)}` : `miss ${sw.why}`) : "none"}`, `keeper ${L?.kp ? (L.kp.smother ? "SMOTHERS" : "beaten") : "-"}`, `k0 ${k0.x.toFixed(1)},${k0.y.toFixed(1)}`];
  // 2) the finish: when you catch it up, aim at the far post side of the open goal and let go; tap the kick screen's middle
  let mid = false;
  const t1 = Date.now();
  while (Date.now() - t1 < 8000) {
    L = await live();
    if (!L || !L.touched || L.last) break;
    if (!mid && L.T > L.plan.t1 * 0.5) { mid = true; await shot(`t${i}-c-running`); }
    if (L.along >= -0.1 && !process.argv.includes("--noshot")) {
      const ph = await pg.evaluate(() => window.__starMatch?.phase?.());
      if (ph !== "aim") break;
      // aim: pull back from the ring away from the goal's open side
      const goalX = L.keeper.x > 34 ? 31.5 : 36.5;
      const g = await px(goalX, 0);
      const bx = L.spotPx.x, by = L.spotPx.y, gx = g.x - bx, gy = g.y - by, gl = Math.hypot(gx, gy) || 1;
      console.log("aim press at", bx.toFixed(0), by.toFixed(0), "goal px", g.x.toFixed(0), g.y.toFixed(0));
      await pg.mouse.move(bx, by); await pg.mouse.down();
      for (let k = 1; k <= 8; k++) { await pg.mouse.move(bx - gx / gl * 9 * k, by - gy / gl * 9 * k); await pg.waitForTimeout(25); }
      await pg.mouse.up();
      let bb = null;
      for (let k = 0; k < 40 && !bb; k++) { bb = await pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first().boundingBox().catch(() => null); if (!bb) await pg.waitForTimeout(30); }
      await shot(`t${i}-d-kickscreen`);
      if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height * 0.55);
      break;
    }
    await pg.waitForTimeout(8);
  }
  await pg.waitForTimeout(2200);
  await shot(`t${i}-e-after`);
  const out = await pg.evaluate(() => (window.__liveOutcomes ?? []).at(-1) ?? null);
  const fin = await pg.evaluate(() => window.__swings.filter((s) => !s.touch).at(-1) ?? null);
  line.push(`finish: ${fin ? (fin.hit ? `${fin.timing} ${fin.along?.toFixed(2)}` : `miss ${fin.why}`) : "-"}`, `result: ${out ? out.outcome : "?"}`);
  console.log(line.join(" | "));
  await pg.waitForTimeout(3500);
}
await b.close();
