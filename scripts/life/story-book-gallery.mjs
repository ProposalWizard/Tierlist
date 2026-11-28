/**
 * THE STORY BOOK'S GALLERY: the people and places of the stories as the game draws them today,
 * all real captures (no image generator):
 *   - the People page of a lived-in sample career (the test page /star-life-dev),
 *   - every role's face as the story screens draw it (the test page's cast sheet, window.__shot.cast),
 *   - every pooled person (kit man, groundsman, physio, reporter, legend) in the game's 3D toon
 *     renderer (/star-life-dev/portrait?single=1, the same renderer that made the kit man's stills),
 *   - the place stills that exist (public/star/life/), as the story screens use them.
 *
 * Run (dev server on --base):  node scripts/life/story-book-gallery.mjs --out <shots folder> --page <page folder>
 * Writes <page>/shots/gallery-*.webp|png and <out>/gallery.json (story-book-sheets.py puts it in shots.json).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "http://localhost:3105");
const OUT = path.resolve(arg("out")), PAGE = path.resolve(arg("page"));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const RAW = path.join(OUT, "gallery-raw");
fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(path.join(PAGE, "shots"), { recursive: true });
const HIDE = `div.fixed.inset-x-0.bottom-0[class*="z-[200]"], .tr-float, .tr-vars, button.fixed.left-0[class*="top-1/2"] { display: none !important; }`;

// The pooled people (pool.ts), read from the source so nothing is typed twice.
const poolSrc = fs.readFileSync(path.join(ROOT, "lib/star/life/pool.ts"), "utf8");
const pool = [];
let role = "";
for (const line of poolSrc.split("\n")) {
  const r = line.match(/^  ([a-z]+): \[/); if (r) role = r[1];
  const m = line.match(/first: "([^"]+)", last: "([^"]+)".*?age: (\d+).*?look: "([^"]+)"/);
  if (m && role) pool.push({ role, name: `${m[1]} ${m[2]}`, age: m[3], look: m[4] });
}

const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await ctx.newPage();
const shots = [];

// 1. The People page and the cast sheet, on the lived-in sample career.
await page.goto(`${BASE}/star-life-dev?full=1&shot=1&prep=lived`, { waitUntil: "networkidle", timeout: 300000 });
await page.addStyleTag({ content: HIDE });
await page.waitForFunction(() => window.__shot, null, { timeout: 180000 });
await page.waitForTimeout(1200);
const scroller = "[data-life-scroll]";
const tall = await page.evaluate((s) => { const e = document.querySelector(s); return e ? e.scrollHeight - e.clientHeight : 0; }, scroller);
const pp = [];
for (let y = 0, k = 0; k < 4 && (k === 0 || y - 760 < tall); y += 760, k++) {
  await page.evaluate(([s, yy]) => { document.querySelector(s).scrollTop = yy; }, [scroller, y]);
  await page.waitForTimeout(400);
  const f = path.join(RAW, `people-${k}.png`); await page.screenshot({ path: f }); pp.push(f);
}
await page.evaluate(() => window.__shot.cast());
await page.waitForTimeout(900);
await page.evaluate((s) => { document.querySelector(s).scrollTop = 0; }, scroller);
const castF = path.join(RAW, "cast.png"); await page.screenshot({ path: castF });

// 2. Every pooled person in the 3D toon renderer (one person, see-through background).
const looks = [...new Set(pool.map((p) => p.look))];
const portrait = {};
for (const look of looks) {
  const have = path.join(RAW, `portrait-${look}.png`);
  if (fs.existsSync(have)) { portrait[look] = have; continue; }
  const pg = await ctx.newPage();
  const ok = await pg.goto(`${BASE}/star-life-dev/portrait?single=1&id=${look}&w=600&h=900`, { waitUntil: "load", timeout: 300000 })
    .then(() => pg.waitForFunction(() => window.__portrait, null, { timeout: 120000 })).then(() => true).catch((e) => { console.log(`portrait ${look}: ${String(e).slice(0, 120)}`); return false; });
  if (ok) {
    const b64 = (await pg.evaluate(() => window.__portrait)).split(",")[1];
    const f = path.join(RAW, `portrait-${look}.png`); fs.writeFileSync(f, Buffer.from(b64, "base64")); portrait[look] = f;
  } else console.log(`portrait ${look}: did not render`);
  await pg.close();
}
await browser.close();
fs.writeFileSync(path.join(RAW, "list.json"), JSON.stringify({ pp, castF, portrait, pool }, null, 1));
// 3. Pack into the page's files (python: PIL makes the sheets).
execFileSync("python3", [path.join(ROOT, "scripts/life/story-book-gallery-pack.py"), RAW, PAGE, OUT, path.join(ROOT, "public/star/life")], { stdio: "inherit" });
