/**
 * Full Highlights Rebuild, phase 1 check: Infinite Highlights' still against
 * the first frame the real match plays, press after press.
 *
 *   node scripts/fhr/still-vs-play.mjs [presses=100] [on|off] [phone|desktop] [port=3051] [stillsDir]
 *
 * For each chance: read the still's framing off the stage (data-still-*: the
 * camera in pitch metres, the turn, the angle, the canvas shape), press ▶ Play,
 * read the real match's own framing (window.__starMatch.frame(), dev builds
 * only), compare, press Stop, press Next. A mismatch is any camera edge more
 * than 0.05 m apart, a different turn, a different angle, or a canvas more
 * than 2 px off in width or height. Prints the count and every mismatch.
 * With a stills folder, saves still + played pictures of the first 3 chances.
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const presses = Number(process.argv[2] ?? 100);
const mode = process.argv[3] ?? "on";
const form = process.argv[4] ?? "phone";
const port = Number(process.argv[5] ?? 3051);
const stills = process.argv[6] ?? null;
if (stills) mkdirSync(stills, { recursive: true });

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
const ctx = await b.newContext(form === "phone" ? { ...devices["iPhone 13"] } : { viewport: { width: 1440, height: 900 } });
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", (e) => errors.push(String(e)));
await pg.goto(`http://localhost:${port}/star-highlights-dev?fhr=${mode}`, { waitUntil: "domcontentloaded", timeout: 600000 });
await pg.waitForSelector(".ih-stage[data-still-cam]", { timeout: 600000 });
await pg.waitForTimeout(1500);

const readStill = () => pg.evaluate(() => {
  const st = document.querySelector(".ih-stage");
  const el = st.querySelector("[data-still-tilt]") ?? st.querySelector("canvas");
  const r = el.getBoundingClientRect();
  return {
    cam: JSON.parse(st.dataset.stillCam), facing: st.dataset.stillFacing, tilt: Number(st.dataset.stillTilt),
    you: st.dataset.stillYou, kind: st.dataset.stillKind, w: r.width, h: r.height,
  };
});
const readMatch = () => pg.evaluate(() => {
  const m = window.__starMatch;
  if (!m) return null;
  const f = m.frame();
  if (!f.canvas || f.canvas.w <= 0) return null;
  return { cam: f.cam, facing: f.facing, tilt: f.tilt, w: f.box.w, h: f.box.h, phase: m.phase() };
});
const same = (a, b) => a && b && JSON.stringify(a) === JSON.stringify(b);

let mism = 0;
const rows = [];
for (let i = 0; i < presses; i++) {
  const s = await readStill();
  if (stills && i < 3) await pg.locator(".ih-stage").screenshot({ path: `${stills}/fhr-${mode}-${i + 1}-still.jpg`, type: "jpeg", quality: 85 });
  await pg.click("button.ih-play");
  // The match's first frame: wait for the hook, then for two equal reads
  // (the pitch box measures itself once after mounting and re-frames).
  let m = null, prev = null;
  for (let t = 0; t < 120; t++) {
    await pg.waitForTimeout(150);
    m = await readMatch();
    if (m && same(m, prev)) break;
    prev = m;
  }
  if (stills && i < 3) await pg.locator(".ih-stage").screenshot({ path: `${stills}/fhr-${mode}-${i + 1}-play.jpg`, type: "jpeg", quality: 85 });
  const why = [];
  if (!m) why.push("match never framed");
  else {
    for (const k of ["x1", "x2", "y1", "y2"]) if (Math.abs(s.cam[k] - m.cam[k]) > 0.05) why.push(`cam ${k} ${s.cam[k].toFixed(2)} vs ${m.cam[k].toFixed(2)}`);
    if ((s.facing || "up") !== (m.facing || "up")) why.push(`facing ${s.facing} vs ${m.facing}`);
    if (s.tilt !== m.tilt) why.push(`tilt ${s.tilt} vs ${m.tilt}`);
    if (Math.abs(s.w - m.w) > 2 || Math.abs(s.h - m.h) > 2) why.push(`size ${s.w.toFixed(0)}x${s.h.toFixed(0)} vs ${m.w.toFixed(0)}x${m.h.toFixed(0)}`);
  }
  if (why.length) { mism++; rows.push(`#${i + 1} ${s.kind}: ${why.join("; ")}`); }
  await pg.click("button.ih-play"); // Stop
  await pg.waitForTimeout(200);
  await pg.click("button.ih-next");
  await pg.waitForTimeout(350);
  if ((i + 1) % 10 === 0) console.log(`${i + 1} presses, ${mism} mismatches`);
}
console.log(`\n${mode.toUpperCase()} (${form}): ${presses} presses, ${mism} framing mismatches`);
for (const r of rows.slice(0, 40)) console.log("  " + r);
if (errors.length) console.log(`page errors: ${errors.length}\n  ${errors.slice(0, 5).join("\n  ")}`);
await b.close();
