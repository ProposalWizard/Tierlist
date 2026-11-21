/**
 * THE FIT CHECK: one screen at several phone sizes, packed app next to one or
 * more web builds of KIB Next (for example "before" and "after"), and with the
 * OLD text behaviour (Android's font size setting at 1.3×, `?fs=1.3`, src/rn.js).
 *
 *   node phone/tools/look/fit.mjs --out <dir> --web after=<webdir>[,before=<webdir>]
 *        [--only title,league] [--sizes 412x915,360x780] [--fs 1.3] [--save <save.json>] [--late <save.json>]
 *
 * Writes <out>/<scene>-<size>-<label>.png and <out>/sheet-<scene>.jpg (one row per size).
 * --fs adds a column "<first label> at old ×fs" (what a large font setting did before the fix).
 * Saves: make-save.mts output (--save, made if absent) and make-season-end.mts output (--late, for cups).
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = path.resolve(val("--out", path.join(HERE, "out/fit")));
const ONLY = (val("--only", "") || "").split(",").filter(Boolean);
const SIZES = val("--sizes", "412x915,360x780").split(",").map((s) => s.split("x").map(Number));
const FS = val("--fs", "");
const WEBS = val("--web", `after=${path.join(HERE, "out/web")}`).split(",").map((s) => { const i = s.indexOf("="); return { label: s.slice(0, i), dir: path.resolve(s.slice(i + 1)) }; });
const NO_PACKED = argv.includes("--no-packed");
fs.mkdirSync(OUT, { recursive: true });

function packedDir() {
  const c = [path.join(REPO, "mobile/www")];
  for (let d = path.dirname(REPO); d !== path.dirname(d); d = path.dirname(d)) c.push(path.join(d, "mobile/www"));
  return c.find((d) => fs.existsSync(path.join(d, "index.html")));
}
function saveFrom(flag, script, extra = []) {
  const f = val(flag, "");
  if (f && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8").trim().split("\n").pop());
  const json = execFileSync("npx", ["tsx", script, ...extra], { cwd: REPO, encoding: "utf8", maxBuffer: 64 << 20 });
  if (f) fs.writeFileSync(f, json);
  return JSON.parse(json.trim().split("\n").pop());
}

const wait = (p, ms) => p.waitForTimeout(ms);
async function click(p, re, timeout = 6000) {
  if (!re.flags.includes("i")) re = new RegExp(re.source, re.flags + "i");
  let l = p.locator("button:visible, [role=button]:visible").filter({ hasText: re }).first();
  if (!(await l.count())) l = p.getByText(re).first();
  await l.click({ timeout });
  await wait(p, 1400);
}
async function fill(p, i, v) { await p.locator("input:visible").nth(i).fill(v); await wait(p, 300); }
async function kib(p, screen, params) {
  await p.evaluate(([s, pr]) => { const n = window.__kibNav; n.home(); if (s !== "tabs") n.go(s, pr ?? undefined); }, [screen, params ?? null]);
  await wait(p, 2200);
}
async function kibContinue(p) { await click(p, /^continue$/i); await wait(p, 4500); }
const names = async (p) => { await fill(p, 0, "Look"); await fill(p, 1, "Check"); await click(p, /Continue/i); };

// save: false (new phone) | true (Arsenal career) | "late" (six games from the end) | "title" (career, packed shows its title)
const SCENES = [
  { id: "title-new", save: false, packed: async (p) => { await click(p, /Main menu/i); }, next: async () => {} },
  { id: "title", save: "title", packed: async () => {}, next: async () => {} },
  { id: "load", save: "title", packed: async (p) => { await click(p, /Load game/i); }, next: async (p) => { await click(p, /Load game/i); } },
  { id: "credits", save: "title", packed: async (p) => { await click(p, /^Credits$/i); }, next: async (p) => { await click(p, /^Credits$/i); } },
  { id: "nc1", save: false, packed: async () => {}, next: async (p) => { await click(p, /new game/i); } },
  { id: "nc2", save: false, packed: async (p) => { await names(p); }, next: async (p) => { await click(p, /new game/i); await names(p); } },
  { id: "nc3", save: false,
    packed: async (p) => { await names(p); await click(p, /^RIGHT$/); await click(p, /Continue/i); },
    next: async (p) => { await click(p, /new game/i); await names(p); await click(p, /^Right$/); await click(p, /Continue/i); } },
  { id: "home", save: true, packed: async () => {}, next: async (p) => { await kibContinue(p); } },
  { id: "league", save: true, packed: async (p) => { await click(p, /^League$/); }, next: async (p) => { await kibContinue(p); await click(p, /^League$/); } },
  { id: "late-table", save: "late", packed: async (p) => { await click(p, /^League$/); }, next: async (p) => { await kibContinue(p); await click(p, /^League$/); } },
  { id: "late-results", save: "late",
    packed: async (p) => { await click(p, /^League$/); await click(p, /^Results$/); },
    next: async (p) => { await kibContinue(p); await click(p, /^League$/); await click(p, /^Results$/); } },
  { id: "late-facup", save: "late",
    packed: async (p) => { await click(p, /^League$/); await click(p, /Premier League|All leagues|▾|🌍/); await click(p, /FA Cup/); },
    next: async (p) => { await kibContinue(p); await click(p, /^League$/); await click(p, /Premier League|All leagues|▾|🌍/); await click(p, /FA Cup/); } },
  { id: "phone", save: true, packed: async (p) => { await click(p, /^Phone/); }, next: async (p) => { await kibContinue(p); await kib(p, "phone"); } },
  { id: "store", save: true, packed: async (p) => { await click(p, /^Phone/); await click(p, /^Store$/); }, next: async (p) => { await kibContinue(p); await kib(p, "store"); } },
  { id: "shop", save: true, packed: async (p) => { await click(p, /^shop/i); }, next: async (p) => { await kibContinue(p); await kib(p, "shop"); } },
  { id: "shop-sheet", save: true, packed: async (p) => { await click(p, /^shop/i); await click(p, /Premium/); }, next: async (p) => { await kibContinue(p); await kib(p, "shop"); await click(p, /Premium/); } },
  { id: "sponsors", save: true, packed: async (p) => { await click(p, /^Phone/); await click(p, /^Sponsors$/); }, next: async (p) => { await kibContinue(p); await kib(p, "sponsors"); } },
  { id: "squad", save: true, packed: async (p) => { await click(p, /^Phone/); await click(p, /^Squad$/); }, next: async (p) => { await kibContinue(p); await kib(p, "phone"); await click(p, /^Squad$/); } },
  { id: "social", save: true, packed: async (p) => { await click(p, /^Phone/); await click(p, /^Social$/); }, next: async (p) => { await kibContinue(p); await kib(p, "phone"); await click(p, /^Social$/); } },
  { id: "stats", save: true, packed: null, next: async (p) => { await kibContinue(p); await kib(p, "career-stats"); } },
  { id: "star-pass", save: true, packed: async (p) => { await p.locator("[data-tour=rating]").first().click(); await wait(p, 2200); }, next: async (p) => { await kibContinue(p); await kib(p, "star-pass"); } },
  { id: "rulebook", save: true, packed: null, next: async (p) => { await kibContinue(p); await kib(p, "rule-book"); } },
  { id: "settings", save: true, packed: async (p) => { await p.locator('[aria-label="Settings"]').first().click(); await wait(p, 1800); }, next: async (p) => { await kibContinue(p); await kib(p, "career-settings"); } },
  // KIB Next only: opened by name. `--only x:<screen>` shoots any registered screen.
];
for (const o of ONLY) if (o.startsWith("x:")) SCENES.push({ id: o, save: true, packed: null, next: async (p) => { await kibContinue(p); await kib(p, o.slice(2)); } });

async function shoot(browser, app, url, scene, kv, [W, H], file, query = "") {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  if (kv) {
    await ctx.addInitScript((kv) => {
      if (sessionStorage.getItem("look-seeded")) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
      sessionStorage.setItem("look-seeded", "1");
    }, kv);
  }
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  let note = "";
  try {
    await p.goto(url + "/" + query, { waitUntil: "load", timeout: 120000 });
    await wait(p, 5000);
    await scene[app === "packed" ? "packed" : "next"](p);
    await wait(p, 900);
  } catch (e) { note = String(e.message || e).split("\n")[0].slice(0, 120); }
  await p.screenshot({ path: file });
  await ctx.close();
  if (note || errors.length) console.log(`   ! ${path.basename(file)}: ${note} ${[...new Set(errors)].slice(0, 3).join(" | ")}`);
}

const main = async () => {
  const scenes = SCENES.filter((s) => !ONLY.length || ONLY.includes(s.id));
  const need = (k) => scenes.some((s) => s.save === k || (k === true && s.save === "title"));
  const save = need(true) ? saveFrom("--save", path.join(HERE, "make-save.mts")) : null;
  const late = need("late") ? saveFrom("--late", path.join(HERE, "../playtest/make-season-end.mts"), ["--left", "6"]) : null;
  const packed = NO_PACKED ? null : await serve(packedDir());
  const webs = [];
  for (const w of WEBS) webs.push({ ...w, srv: await serve(w.dir) });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
  for (const scene of scenes) {
    console.log(scene.id);
    const src = scene.save === "late" ? late : scene.save ? save : null;
    const rows = [];
    for (const size of SIZES) {
      const tag = `${scene.id.replace(/[^a-z0-9-]/gi, "_")}-${size[0]}`;
      const cols = [];
      const jobs = [];
      if (packed && scene.packed) {
        const f = path.join(OUT, `${tag}-packed.png`);
        const kv = src ? { ...src.packed, ...(scene.save === "title" ? { "star-title-force": "1" } : {}) } : null;
        jobs.push(shoot(browser, "packed", packed.url, scene, kv, size, f));
        cols.push({ label: "PACKED", f });
      }
      for (const w of webs) {
        const f = path.join(OUT, `${tag}-${w.label}.png`);
        jobs.push(shoot(browser, "next", w.srv.url, scene, src ? src.next : null, size, f));
        cols.push({ label: `KIB ${w.label}`, f });
      }
      if (FS) {
        const w = webs[0];
        const f = path.join(OUT, `${tag}-${w.label}-fs.png`);
        jobs.push(shoot(browser, "next", w.srv.url, scene, src ? src.next : null, size, f, `?fs=${FS}`));
        cols.push({ label: `KIB ${w.label}, old text ×${FS}`, f });
      }
      await Promise.all(jobs);
      rows.push({ size, cols });
    }
    // one sheet per scene: a row per size
    const img = (f) => (fs.existsSync(f) ? `data:image/png;base64,${fs.readFileSync(f).toString("base64")}` : "");
    const html = `<html><body style="margin:0;background:#222;font:600 14px system-ui,sans-serif;color:#fff"><div style="padding:8px 12px;font-size:18px">${scene.id}</div>${rows.map((r) =>
      `<div style="display:flex;gap:10px;padding:0 10px 10px">${r.cols.map((c) => `<div><div style="height:22px;color:#ccc">${c.label} · ${r.size[0]}×${r.size[1]}</div><img style="display:block;width:${r.size[0]}px;height:${r.size[1]}px" src="${img(c.f)}"></div>`).join("")}</div>`).join("")}</body></html>`;
    const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await pg.setContent(html); await pg.waitForTimeout(200);
    await pg.screenshot({ path: path.join(OUT, `sheet-${scene.id.replace(/[^a-z0-9-]/gi, "_")}.jpg`), fullPage: true, type: "jpeg", quality: 82 });
    await pg.close();
  }
  await browser.close();
  packed?.close(); for (const w of webs) w.srv.close();
};
main().catch((e) => { console.error(e); process.exit(1); });
