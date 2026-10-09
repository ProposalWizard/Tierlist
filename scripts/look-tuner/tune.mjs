#!/usr/bin/env node
// scripts/look-tuner/tune.mjs — THE LOOK-TUNER: turn Look H's dials until a game frame looks like the benchmark.
//
// The "90,000 screenshots" trick, at this machine's speed: open one fixed game frame (the frame-step tool,
// window.__frameStep), then over and over — set the dials (window.__lookTune, dev builds only), re-draw that
// same frame, screenshot it, and score how far its look is from the benchmark pictures (score.py: colours,
// grass, brightness, contrast, colourfulness, detail). A coordinate search keeps every turn that lowers the
// score and halves its steps when nothing helps.
//
//   node scripts/look-tuner/tune.mjs --url "http://localhost:3377/star-style-dev?style=real&scene=play3d&tod=day&clean=1"
//        --tod day --iters 80 --out DIR [--write] [--params exposure,contrast,...] [--seek 0.5] [--start '{"lut":0}']
//   node scripts/look-tuner/tune.mjs --url ... --out DIR --render name='{"lut":0}' [--render ...]   (stills only)
//
// --write puts the winning dials into lib/star/look/tuned.ts (that time of day's block only).
// Writes DIR/log.jsonl (every try), DIR/best.json, DIR/best.jpg, DIR/first.jpg, DIR/curve.png.
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { openPhone, settle } from "./browser.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const all = (n) => args.flatMap((a, i) => (a === `--${n}` && i + 1 < args.length ? [args[i + 1]] : []));
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../..");
const url = opt("url");
const out = path.resolve(opt("out", "look-tune"));
const tod = opt("tod", "day");
const iters = Number(opt("iters", "80"));
const seekT = Number(opt("seek", "0.5"));
const kind = opt("kind", "match");
fs.mkdirSync(out, { recursive: true });

// the dials and their ranges, from lib/star/look/params.ts (parsed, so there is one list)
const src = fs.readFileSync(path.join(ROOT, "lib/star/look/params.ts"), "utf8");
const RANGES = Object.fromEntries([...src.matchAll(/^\s+(\w+): \[(-?[\d.]+), (-?[\d.]+)\]/gm)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]).concat(
  [...src.matchAll(/(\w+): \[(-?[\d.]+), (-?[\d.]+)\]/g)].map((m) => [m[1], [Number(m[2]), Number(m[3])]])));
const TUNED_FILE = path.join(ROOT, "lib/star/look/tuned.ts");
const tunedNow = (() => { const m = fs.readFileSync(TUNED_FILE, "utf8").match(new RegExp(`${tod}: (\\{[^}]*\\})`)); return m ? JSON.parse(m[1].replace(/(\w+):/g, '"$1":')) : {}; })();
// rim is not tuned (the score does not look at the players); see params.ts
const DEFAULT_DIALS = ["exposure", "contrast", "sat", "sun", "env", "hemi", "grassGain", "grassWarm", "lut", "ao", "shade", "bounce", "bloom", "vignette", "sharpen", "blades", "stripes"];
const dials = (opt("params") ? opt("params").split(",") : DEFAULT_DIALS).filter((d) => RANGES[d]);
const BASE = { exposure: 1, contrast: 1, sat: 1, bloom: 1, vignette: 1, sun: 1, env: 1, hemi: 1, rim: 1.8, grassGain: 1, grassWarm: 0, lut: 1, ao: 1, shade: 1, bounce: 1, sharpen: 1.6, blades: 1.8, stripes: 1.4 };
const start = { ...BASE, ...tunedNow, ...(opt("start") ? JSON.parse(opt("start")) : {}) };

const { browser, page } = await openPhone(url, {
  init: () => { window.__lookTune = { params: {}, version: 0 }; },
  waitFor: "window.__styleReady === true && window.__frameStep",
  settleMs: 4000, dsf: Number(opt("dsf", "1")),
});
// the picture only: no score bar, minimap or labels in the frames
await page.addStyleTag({ content: "body *{visibility:hidden !important} canvas{visibility:visible !important}" });
await page.evaluate(async (t) => { await window.__frameStep.seek(t); }, seekT);
// the baked light and the LUT load in the background: wait until the look reports both (or 20 s)
await page.waitForTimeout(Number(opt("settle", "6000")));

let frameN = 0;
async function shoot(params, file) {
  await page.evaluate(async ({ p, t }) => {
    window.__lookTune.params = p; window.__lookTune.version++;
    await window.__frameStep.seek(t);
  }, { p: params, t: seekT });
  await settle(page);
  await page.locator("canvas").first().screenshot({ path: file, type: "jpeg", quality: 92 });
  frameN++;
}

// stills only
const renders = all("render");
if (renders.length) {
  for (const r of renders) {
    const [name, json] = [r.slice(0, r.indexOf("=")), r.slice(r.indexOf("=") + 1)];
    const file = path.join(out, `${name}.jpg`);
    await shoot({ ...start, ...JSON.parse(json || "{}") }, file);
    console.log("wrote", file);
  }
  await browser.close();
  process.exit(0);
}

// the scorer, kept running
const scorer = spawn("python3", [path.join(HERE, "score.py"), "--serve"], { env: { ...process.env, LOOK_KIND: kind }, stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
const waiting = [];
scorer.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); waiting.shift()?.(JSON.parse(line)); } });
const scoreOf = (file) => new Promise((res) => { waiting.push(res); scorer.stdin.write(file + "\n"); });

const log = fs.createWriteStream(path.join(out, "log.jsonl"));
const clamp = (d, v) => Math.max(RANGES[d][0], Math.min(RANGES[d][1], v));
const round = (v) => Math.round(v * 1000) / 1000;
const t0 = Date.now();
let n = 0;
const tmp = path.join(out, "try.jpg");
async function evaluate(p, note) {
  await shoot(p, tmp);
  const s = await scoreOf(tmp);
  n++;
  log.write(JSON.stringify({ n, t: Math.round((Date.now() - t0) / 1000), note, score: s.score, parts: s.parts, stats: s.stats, params: p }) + "\n");
  return s;
}

let best = { ...start };
let bestS = await evaluate(best, "start");
fs.copyFileSync(tmp, path.join(out, "first.jpg"));
fs.copyFileSync(tmp, path.join(out, "best.jpg"));
const first = bestS;
console.log(`start score ${bestS.score}  ${JSON.stringify(bestS.parts)}`);
const step = Object.fromEntries(dials.map((d) => [d, (RANGES[d][1] - RANGES[d][0]) * 0.18]));
let pass = 0;
while (n < iters) {
  let improved = false;
  pass++;
  for (const d of dials) {
    if (n >= iters) break;
    for (const dir of [1, -1]) {
      if (n >= iters) break;
      const v = clamp(d, best[d] + dir * step[d]);
      if (Math.abs(v - best[d]) < 1e-6) continue;
      const cand = { ...best, [d]: round(v) };
      const s = await evaluate(cand, `${d} ${dir > 0 ? "+" : "-"}${round(step[d])}`);
      if (s.score < bestS.score - 1e-4) {
        best = cand; bestS = s; improved = true;
        fs.copyFileSync(tmp, path.join(out, "best.jpg"));
        console.log(`#${n} ${d}=${best[d]}  score ${s.score}  (${Math.round((Date.now() - t0) / n / 100) / 10} s/try)`);
        // keep going the same way while it helps (a cheap line search)
        let v2 = clamp(d, best[d] + dir * step[d]);
        while (n < iters && Math.abs(v2 - best[d]) > 1e-6) {
          const c2 = { ...best, [d]: round(v2) };
          const s2 = await evaluate(c2, `${d} again`);
          if (s2.score < bestS.score - 1e-4) { best = c2; bestS = s2; fs.copyFileSync(tmp, path.join(out, "best.jpg")); console.log(`#${n} ${d}=${best[d]}  score ${s2.score}`); v2 = clamp(d, best[d] + dir * step[d]); } else break;
        }
        break;
      }
    }
  }
  if (!improved) { for (const d of dials) step[d] *= 0.5; console.log(`pass ${pass}: no gain, halving steps`); }
}
log.end();
scorer.stdin.end();
const changed = Object.fromEntries(Object.entries(best).filter(([k, v]) => k in RANGES && Math.abs(v - (BASE[k] ?? 0)) > 1e-3));
fs.writeFileSync(path.join(out, "best.json"), JSON.stringify({ tod, url, tries: n, seconds: Math.round((Date.now() - t0) / 1000), first: first, best: bestS, params: best, changed }, null, 1));
console.log(`done: ${n} tries in ${Math.round((Date.now() - t0) / 1000)} s; score ${first.score} -> ${bestS.score}`);
console.log(`dials: ${JSON.stringify(changed)}`);
try { execFileSync("python3", [path.join(HERE, "curve.py"), path.join(out, "log.jsonl"), path.join(out, "curve.png")], { stdio: "inherit" }); } catch { /* no picture */ }
if (args.includes("--write")) {
  let s = fs.readFileSync(TUNED_FILE, "utf8");
  const block = `${tod}: ${JSON.stringify(changed).replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ")}`;
  if (new RegExp(`\\b${tod}: \\{[^}]*\\}`).test(s)) s = s.replace(new RegExp(`\\b${tod}: \\{[^}]*\\}`), block);
  else s = s.replace(/= \{\s*\};|= \{\n/, (m) => (m.startsWith("= {}") || m.includes("};") ? `= {\n  ${block},\n};` : `= {\n  ${block},\n`));
  fs.writeFileSync(TUNED_FILE, s);
  console.log(`wrote ${tod} into ${path.relative(ROOT, TUNED_FILE)}`);
}
await browser.close();
