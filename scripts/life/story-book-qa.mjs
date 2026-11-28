/**
 * THE STORY BOOK'S CHECK: opens EVERY story page and taps EVERY choice of the built page at a phone's
 * size (390 x 844) and fails on: a page that does not open, a beat with no screenshot (unless the page
 * says why), a blank screen, "undefined" / "NaN" / "[object Object]" in the words, a link to a story
 * that does not exist, words wider than the phone, a screenshot sheet that does not load, an error.
 *
 * Run:  node scripts/life/story-book-qa.mjs <page folder>   (the folder story-book-page.mts wrote)
 * Exit code 1 on any failure; the failures are listed.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(process.argv[2]);
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".mp4": "video/mp4" };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]); if (p === "/") p = "/index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  const size = fs.statSync(f).size, m = /bytes=(\d+)-(\d*)/.exec(q.headers.range || "");
  if (m) { const a = +m[1], b = m[2] ? +m[2] : size - 1; r.writeHead(206, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "content-range": `bytes ${a}-${b}/${size}`, "accept-ranges": "bytes", "content-length": b - a + 1 }); return fs.createReadStream(f, { start: a, end: b }).pipe(r); }
  r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "accept-ranges": "bytes", "content-length": size }); fs.createReadStream(f).pipe(r);
}).listen(0);
const port = srv.address().port;
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data.json"), "utf8"));
const shots = JSON.parse(fs.readFileSync(path.join(ROOT, "shots.json"), "utf8"));
const videos = fs.existsSync(path.join(ROOT, "videos.json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "videos.json"), "utf8")) : {};
const fails = [];
const fail = (story, where, what) => fails.push({ story, where, what });

// Every file the page names must be there.
for (const [slug, st] of Object.entries(shots.stories)) for (const sh of [...(st.sheets || []), ...(st.fulls || [])]) if (!fs.existsSync(path.join(ROOT, sh.file))) fail(slug, "files", `missing ${sh.file}`);
for (const [slug, v] of Object.entries(videos)) if (!fs.existsSync(path.join(ROOT, v.file))) fail(slug, "files", `missing ${v.file}`);

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
let errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
// A film's preload that the next story page cancels is not a failure (net::ERR_ABORTED); anything else is.
page.on("requestfailed", (r) => { if (!/ERR_ABORTED/.test(r.failure()?.errorText ?? "")) errs.push(`request failed: ${r.url()} ${r.failure()?.errorText}`); });
page.on("response", (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });
await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__bookReady);

const tiles = await page.evaluate(() => document.querySelectorAll(".tile").length);
if (tiles !== data.stories.length) fail("", "home", `${tiles} tiles for ${data.stories.length} stories`);

/** What is wrong on the sheet as it is now. */
const look = () => page.evaluate(() => {
  const sh = document.getElementById("sheet"), out = [];
  if (sh.hidden) return ["the story sheet is not open"];
  const txt = sh.innerText;
  if (txt.trim().length < 80) out.push("blank sheet");
  const m = txt.match(/.{0,30}\b(undefined|NaN|\[object Object\]|null)\b.{0,30}/);
  if (m) out.push(`bad words: "${m[0].replace(/\s+/g, " ")}"`);
  if (sh.scrollWidth > sh.clientWidth + 1) out.push(`wider than the phone (${sh.scrollWidth}px)`);
  for (const e of sh.querySelectorAll(".say, .choice, .result, .scene, h3, .endc h4, .endc p")) if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== "auto") { out.push(`words cut off: "${e.textContent.trim().slice(0, 40)}"`); break; }
  for (const a of sh.querySelectorAll('a[href^="#s-"]')) if (!window.__bookHas(a.getAttribute("href").slice(3))) out.push(`broken link ${a.getAttribute("href")}`);
  const big = sh.querySelector(".bigshot");
  const why = sh.querySelector(".shotcap");
  if (!big && !(why && /Not photographed|No screenshot/.test(why.textContent))) out.push("no screenshot and no reason given");
  if (big && !big._cell) out.push("screenshot has no picture");
  return out;
});
await page.evaluate(() => { window.__bookHas = (slug) => !!document.querySelector(".tile") && window.__slugs.has(slug); });
await page.evaluate((list) => { window.__slugs = new Set(list); }, data.stories.map((s) => s.slug));

let pages = 0, beatsSeen = 0, clicks = 0;
for (const s of data.stories) {
  errs = [];
  await page.evaluate((x) => { location.hash = "s-" + x; }, s.slug);
  await page.waitForTimeout(30);
  pages++;
  const head = await page.evaluate(() => document.querySelector("#sheet h2") && document.querySelector("#sheet h2").textContent);
  if (!head) { fail(s.slug, "page", "did not open"); continue; }
  for (const p of await look()) fail(s.slug, "page", p);
  const ends = await page.evaluate(() => document.querySelectorAll(".endc").length);
  if (ends !== s.ends.length) fail(s.slug, "endings", `${ends} ending cards for ${s.ends.length} endings`);
  if (videos[s.slug]) {
    // The film at the top: tap it, and it must load and be as long as videos.json says.
    const ok = await page.evaluate(() => { const b = document.querySelector(".watch .wbtn"); if (!b) return false; b.click(); const v = document.querySelector(".watch video"); if (v) { v.muted = true; } return true; });
    if (!ok) fail(s.slug, "film", "no film at the top");
    else {
      const dur = await page.waitForFunction(() => { const v = document.querySelector(".watch video"); return v && v.readyState >= 1 && v.duration; }, null, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => 0);
      await page.evaluate(() => { const v = document.querySelector(".watch video"); if (v) { v.pause(); v.removeAttribute("src"); v.load(); v.remove(); } });
      if (!dur) fail(s.slug, "film", "the film does not load");
      else if (Math.abs(dur - videos[s.slug].seconds) > 2) fail(s.slug, "film", `the film is ${Math.round(dur)} s, not ${videos[s.slug].seconds} s`);
    }
  }
  for (let bi = 0; bi < s.beats.length; bi++) {
    beatsSeen++;
    // Every path of answers through the beat, breadth first: [] then [0], [1], … then [0,0] …
    const queue = [[]];
    let n = 0;
    while (queue.length && n < 80) {
      const pathIdx = queue.shift(); n++;
      await page.evaluate((i) => document.querySelectorAll("#path .pdot")[i].click(), bi);
      let ok = true;
      for (const k of pathIdx) {
        ok = await page.evaluate((k) => { const c = document.querySelectorAll("#player .choice"); if (!c[k]) return false; c[k].click(); return true; }, k);
        clicks++;
        if (!ok) break;
      }
      if (!ok) { fail(s.slug, `beat ${bi + 1}`, `answer path ${pathIdx.join(">")} could not be tapped`); continue; }
      for (const p of await look()) fail(s.slug, `beat ${bi + 1}${pathIdx.length ? " after " + pathIdx.join(">") : ""}`, p);
      const st = await page.evaluate(() => ({ choices: document.querySelectorAll("#player .choice").length, result: !!document.querySelector("#player .result"), text: (document.querySelector("#player .result .txt") || {}).textContent || "" }));
      if (st.result && !st.text.trim()) fail(s.slug, `beat ${bi + 1}`, "an outcome with no words");
      if (!st.result && !st.choices && !s.waiting) fail(s.slug, `beat ${bi + 1}${pathIdx.length ? " after " + pathIdx.join(">") : ""}`, "a moment with no answers and no outcome");
      if (!st.result && pathIdx.length < 8) for (let k = 0; k < st.choices; k++) queue.push([...pathIdx, k]);
    }
  }
  for (const e of errs) fail(s.slug, "page", e);
}
await page.evaluate(() => { location.hash = ""; });
for (const k of ["gallery", "problems", "oddities", "items", "links"]) {
  errs = [];
  await page.evaluate((x) => { location.hash = "more-" + x; }, k); await page.waitForTimeout(200);
  const t = await page.evaluate(() => document.getElementById("sheet").innerText.length);
  if (t < 60) fail("", `more-${k}`, "blank page");
  if (k === "gallery" && !(await page.evaluate(() => document.querySelectorAll("#sheet .gal button").length))) fail("", "more-gallery", "no pictures");
  for (const e of errs) fail("", `more-${k}`, e);
}
await browser.close(); srv.close();
console.log(`Checked ${pages} story pages, ${beatsSeen} beats, ${clicks} taps. ${fails.length} failures.`);
const by = {};
for (const f of fails) (by[f.what.replace(/".*"/, '"…"')] ??= []).push(f);
for (const [k, list] of Object.entries(by)) console.log(`- ${k}: ${list.length} (${list.slice(0, 6).map((f) => `${f.story} ${f.where}`).join("; ")})`);
fs.writeFileSync(path.join(ROOT, "..", "qa.json"), JSON.stringify(fails, null, 1));
process.exit(fails.length ? 1 : 0);
