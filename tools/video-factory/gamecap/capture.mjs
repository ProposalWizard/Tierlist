#!/usr/bin/env node
// GAMECAP — film football moments with Knowitball's own goal-clip renderer.
//
//   node tools/video-factory/gamecap/capture.mjs <spec.json> <outdir/> [--port N] [--no-popup] [--no-preview] [--quality 0.9]
//   node tools/video-factory/gamecap/capture.mjs --cleanup      (undo a run that was killed hard)
//
// What it does, in order: refuses to start unless the game files it patches are
// clean in git; applies the temporary patches (patches/game-patches.mjs) and
// copies the capture page (template/) to app/zz-gamecap-tmp/; starts `next dev`
// on a free port; films every clip and camera in the spec with Playwright; and
// ALWAYS puts everything back (patched files checked out, app/zz-gamecap-tmp
// deleted, the server stopped) — on success, on an error, on Ctrl-C.
// Read README.md first.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { PATCHES, MARKER, applyEdits } from "./patches/game-patches.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const PAGE_DIR = path.join(REPO, "app/zz-gamecap-tmp");
const LOCK = path.join(HERE, ".lock");
const ROUTE = "/zz-gamecap-tmp";
// Files `next dev` itself may rewrite. Put back only if they were clean before.
const DEV_TOUCHED = ["next-env.d.ts", "tsconfig.json", "lib/star/three3d/assetVersions.ts"];

const log = (...a) => console.log("[gamecap]", ...a);
const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8" });
const dirty = (files) => git("status", "--porcelain", "--", ...files).trim();

// ── cleanup (always) ─────────────────────────────────────────────────────────
let server = null, cleaned = false, devClean = [];
function cleanup(reason) {
  if (cleaned) return;
  cleaned = true;
  try { if (server && server.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ } try { process.kill(-server.pid, "SIGKILL"); } catch { /* gone */ } } } catch { /* ignore */ }
  try { fs.rmSync(PAGE_DIR, { recursive: true, force: true }); } catch (e) { console.error("[gamecap] could not delete", PAGE_DIR, e.message); }
  for (const p of PATCHES) {
    const f = path.join(REPO, p.file);
    try { if (fs.readFileSync(f, "utf8").includes(MARKER)) git("checkout", "--", p.file); } catch (e) { console.error("[gamecap] could not revert", p.file, e.message); }
  }
  for (const f of devClean) { try { if (dirty([f])) git("checkout", "--", f); } catch { /* ignore */ } }
  try { if (fs.existsSync(LOCK) && fs.readFileSync(LOCK, "utf8").trim() === String(process.pid)) fs.rmSync(LOCK); } catch { /* ignore */ }
  log(`reverted (${reason}): ${PATCHES.map(p => p.file).join(", ")} checked out; ${path.relative(REPO, PAGE_DIR)} deleted; server stopped`);
}
process.on("exit", () => cleanup("exit"));
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { cleanup(sig); process.exit(130); });
process.on("uncaughtException", (e) => { console.error(e); cleanup("error"); process.exit(1); });
process.on("unhandledRejection", (e) => { console.error(e); cleanup("error"); process.exit(1); });

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
if (flag("--cleanup")) {
  // Only undo files that hold our marker, and our own page folder.
  if (fs.existsSync(LOCK)) { const pid = +fs.readFileSync(LOCK, "utf8"); try { process.kill(pid, 0); console.error(`[gamecap] a capture is running (pid ${pid}); stop it first`); cleaned = true; process.exit(1); } catch { fs.rmSync(LOCK); } }
  cleanup("--cleanup");
  process.exit(0);
}
const pos = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--port", "--quality"].includes(argv[i - 1])));
if (pos.length < 2) { console.error("usage: node capture.mjs <spec.json> <outdir/> [--port N] [--no-popup] [--no-preview] [--quality 0.9]"); cleaned = true; process.exit(2); }
const specPath = path.resolve(pos[0]), outDir = path.resolve(pos[1]);
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const quality = +opt("--quality", "0.9");

// ── refuse to start unless it is safe ───────────────────────────────────────
if (fs.existsSync(LOCK)) {
  const pid = +fs.readFileSync(LOCK, "utf8");
  let alive = false; try { process.kill(pid, 0); alive = true; } catch { /* stale */ }
  if (alive) { console.error(`[gamecap] another capture is running in this checkout (pid ${pid}). One at a time.`); cleaned = true; process.exit(1); }
  console.error("[gamecap] a stale lock: an earlier run was killed. Run `node capture.mjs --cleanup` first."); cleaned = true; process.exit(1);
}
const patched = PATCHES.map(p => p.file);
const d0 = dirty(patched);
if (d0) { console.error(`[gamecap] refusing: these game files have changes in git; commit or stash them first:\n${d0}`); cleaned = true; process.exit(1); }
if (fs.existsSync(PAGE_DIR)) { console.error(`[gamecap] refusing: ${PAGE_DIR} already exists (run --cleanup)`); cleaned = true; process.exit(1); }
devClean = DEV_TOUCHED.filter(f => fs.existsSync(path.join(REPO, f)) && !dirty([f]));
fs.writeFileSync(LOCK, String(process.pid));

// Validate the spec before touching anything.
validate(spec);

// ── apply ────────────────────────────────────────────────────────────────────
const patchedText = PATCHES.map(p => ({ file: p.file, text: applyEdits(p.file, fs.readFileSync(path.join(REPO, p.file), "utf8"), p.edits) }));
for (const p of patchedText) fs.writeFileSync(path.join(REPO, p.file), p.text);
fs.mkdirSync(PAGE_DIR, { recursive: true });
for (const f of fs.readdirSync(path.join(HERE, "template"))) fs.copyFileSync(path.join(HERE, "template", f), path.join(PAGE_DIR, f));
log("patched", patched.join(", "), "and wrote", path.relative(REPO, PAGE_DIR));

// ── server ───────────────────────────────────────────────────────────────────
const port = +(opt("--port", 0)) || await freePort();
fs.mkdirSync(outDir, { recursive: true });
const devLog = fs.openSync(path.join(outDir, "_dev.log"), "w");
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", PORT: String(port) };
const envFile = path.join(REPO, ".env.local");
const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
if (!/NEXT_PUBLIC_SUPABASE_URL=\S/.test(envText) && !env.NEXT_PUBLIC_SUPABASE_URL) {
  // The capture page reads no data; the site's middleware only needs a well-formed URL and key.
  log("no .env.local Supabase values: using the public project URL and a placeholder key (fine for capture)");
  env.NEXT_PUBLIC_SUPABASE_URL = "https://cagkgfketucousksgtbk.supabase.co";
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "gamecap-placeholder";
}
const nextBin = path.join(REPO, "node_modules/next/dist/bin/next");
server = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], { cwd: REPO, env, detached: true, stdio: ["ignore", devLog, devLog] });
log(`next dev on :${port} (log: ${path.join(outDir, "_dev.log")})`);
const base = `http://localhost:${port}`;
await waitHttp(`${base}${ROUTE}`, 8 * 60_000);
log("page compiled");

// ── film ─────────────────────────────────────────────────────────────────────
const require = createRequire(path.join(REPO, "package.json"));
const { chromium } = require("playwright");
const browser = await launch(chromium);
try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", e => errs.push(String(e)));
  await page.goto(`${base}${ROUTE}`, { timeout: 8 * 60_000 });
  await page.waitForFunction(() => window.__gc, null, { timeout: 5 * 60_000 });
  const { infos, warm } = await page.evaluate((s) => window.__gc.load(s), spec);
  const notWarm = warm.filter(w => !w[2]);
  if (notWarm.length) log("WARNING: sprite clips still loading (frames may use the older moves):", JSON.stringify(notWarm));
  const all = {};
  for (const clip of spec.clips) {
    const info = infos[clip.id];
    const dir = path.join(outDir, clip.id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const cams = (clip.cameras ?? ["tv", "high"]).map(c => typeof c === "string" ? { angle: c } : c);
    const meta = { ...info, size: [720, 1280], cameras: {} };
    for (const cam of cams) {
      const name = cam.name ?? cam.angle;
      // tight: the celebration. high (behind the scorer): from just before the strike for a cross or corner,
      // whose start is the ball out on the wing, off this camera.
      const defFrom = cam.angle === "tight" ? (info.goal != null ? "goal-0.3" : "end-2.5")
        : cam.angle === "high" && ["header", "volley"].includes(info.built_as) ? "shot-0.9" : "start";
      const t0 = Math.max(0, timeOf(cam.from ?? defFrom, info)), t1 = Math.min(info.duration, timeOf(cam.to ?? "end", info));
      const cdir = path.join(dir, name); fs.mkdirSync(cdir, { recursive: true });
      let k = 0;
      for (let t = t0; t <= t1 + 1e-6; t = t0 + (++k) / 30 - 0) {
        const u = await page.evaluate(([id, a, tt, q]) => window.__gc.draw(id, a, tt, q), [clip.id, cam.angle, t, quality]);
        fs.writeFileSync(path.join(cdir, `${String(k).padStart(5, "0")}.jpg`), Buffer.from(u.split(",")[1], "base64"));
      }
      const fr = (t) => (t == null || t < t0 || t > t1 + 1e-6) ? null : Math.round((t - t0) * 30);
      meta.cameras[name] = {
        angle: cam.angle, from_s: +t0.toFixed(3), to_s: +t1.toFixed(3), frames: k,
        key_frames: { pass: fr(info.pass), shot: fr(info.shot), goal: fr(info.goal), miss: fr(info.miss), save: fr(info.save), celebration_start: fr(info.celebration_start), celebration_move: fr(info.celebration_move) },
      };
      log(`${clip.id}/${name}: ${k} frames (${t0.toFixed(2)}-${t1.toFixed(2)} s)`);
    }
    // The goal pop-up.
    const popSpec = popupFor(spec, clip, info);
    if (popSpec && !flag("--no-popup")) {
      meta.popup = await capturePopup(browser, base, popSpec, path.join(dir, "popup"));
      log(`${clip.id}/popup: ${meta.popup.frames} PNGs`);
    }
    if (!flag("--no-preview")) {
      const pv = makePreview(dir, meta);
      if (pv) meta.preview = pv;
    }
    fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
    all[clip.id] = meta;
  }
  fs.writeFileSync(path.join(outDir, "capture.json"), JSON.stringify({ spec: path.relative(REPO, specPath), clips: all, page_errors: errs.slice(0, 10) }, null, 2));
  if (errs.length) log("page errors:", errs.slice(0, 3));
  log("done:", outDir);
} finally {
  await browser.close().catch(() => {});
  cleanup("finished");
}
process.exit(0);

// ── helpers ──────────────────────────────────────────────────────────────────
function validate(s) {
  const bad = (m) => { throw new Error(`spec: ${m}`); };
  if (!s.teams?.home?.kit || !s.teams?.away?.kit) bad("teams.home and teams.away need a kit {shirt, shorts, socks}");
  if (!Array.isArray(s.clips) || !s.clips.length) bad("clips: at least one");
  const KINDS = ["header", "tap_in", "long_range", "one_on_one", "volley", "penalty", "free_kick", "miss", "save"];
  const ANGLES = ["tv", "high", "tight", "fan", "net", "side", "match", "reverse", "strike", "follow", "spider", "fanSide", "fanHigh"];
  const ids = new Set();
  for (const c of s.clips) {
    if (!c.id || !/^[a-z0-9_-]+$/i.test(c.id)) bad(`clip id "${c.id}" (letters, digits, - and _ only)`);
    if (ids.has(c.id)) bad(`clip id "${c.id}" twice`); ids.add(c.id);
    if (!KINDS.includes(c.kind)) bad(`clip ${c.id}: kind "${c.kind}" (one of ${KINDS.join(", ")})`);
    if (!["home", "away"].includes(c.attacking)) bad(`clip ${c.id}: attacking must be "home" or "away"`);
    for (const p of [c.scorer, c.assister, c.keeper, ...(c.defenders ?? []), ...(c.teammates ?? [])]) if (p && !s.people?.[p]) bad(`clip ${c.id}: person "${p}" is not in people`);
    for (const cam of c.cameras ?? []) { const a = typeof cam === "string" ? cam : cam.angle; if (!ANGLES.includes(a)) bad(`clip ${c.id}: camera "${a}" (one of ${ANGLES.join(", ")})`); }
  }
}
function timeOf(x, info) {
  if (typeof x === "number") return x;
  const m = /^([a-z_]+)\s*([+-]\s*[\d.]+)?$/.exec(String(x).trim());
  if (!m) throw new Error(`time "${x}"`);
  const baseT = { start: 0, end: info.duration, pass: info.pass, shot: info.shot, goal: info.goal ?? info.miss ?? info.save, miss: info.miss, save: info.save, celebration: info.celebration_start ?? info.goal, celebration_move: info.celebration_move ?? info.celebration_start }[m[1]];
  if (baseT == null) throw new Error(`time "${x}": this clip has no ${m[1]}`);
  return baseT + (m[2] ? +m[2].replace(/\s/g, "") : 0);
}
function popupFor(s, c, info) {
  if (c.popup === false || info.goal == null) return null;
  const P = s.people ?? {};
  const before = c.scoreBefore ?? [0, 0];
  const after = c.scoreAfter ?? (c.attacking === "home" ? [before[0] + 1, before[1]] : [before[0], before[1] + 1]);
  if (c.popupTheirs) return { home: s.teams.home, away: s.teams.away, from: before, to: after, theirs: true, position: c.popupPosition ?? s.popupPosition ?? "top" };
  return {
    home: s.teams.home, away: s.teams.away, from: before, to: after,
    scorer: P[c.scorer]?.name, scorerShown: P[c.scorer]?.popupName,
    assist: c.assister ? P[c.assister]?.name : undefined, assistShown: c.assister ? P[c.assister]?.popupName : undefined,
    theirs: c.popupTheirs ?? false,
    position: c.popupPosition ?? s.popupPosition ?? "top",
  };
}
async function capturePopup(browser, base, pop, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 720 / 390 });
  const p = await ctx.newPage();
  await p.addInitScript((g) => { window.__GC_POP = g; }, pop);
  await p.goto(`${base}${ROUTE}?scene=pop`, { timeout: 5 * 60_000 });
  await p.waitForSelector("[data-mikey-popup]", { timeout: 5 * 60_000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  // The game draws the goal board at 70% of the height (MikeyPopup.tsx); videos want it at the top.
  const top = pop.position === "game" ? null : pop.position === "top" ? "3%" : pop.position;
  await p.addStyleTag({ content: `html,body{background:transparent!important} nextjs-portal{display:none!important} body *{visibility:hidden!important} #gcpop, #gcpop *{visibility:visible!important}${top ? ` [data-mikey-popup]{top:${top}!important;transition:none!important}` : ""}` });
  for (let f = 0; f <= 45; f++) {
    await p.evaluate((ms) => { document.querySelectorAll("nextjs-portal").forEach(e => e.remove()); for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, f * 1000 / 30);
    await p.screenshot({ path: path.join(dir, `${String(f).padStart(5, "0")}.png`), omitBackground: true });
  }
  await ctx.close();
  return { frames: 46, fps: 30, size: [720, 1279], position: top ?? "70% (the game's own)", slide_in: [0, 6], score_roll: [10, 15], slide_out: [39, 45], shown: { scorer: pop.scorerShown ?? "(surname, popupName)", assist: pop.assistShown ?? "(surname, popupName)" } };
}
function makePreview(dir, meta) {
  const names = Object.keys(meta.cameras);
  const pick = ["tv", "high"].filter(n => names.includes(n));
  const use = pick.length ? pick : names.slice(0, 2);
  const parts = [];
  for (const n of use) {
    const c = meta.cameras[n];
    const key = c.key_frames.goal ?? c.key_frames.miss ?? c.key_frames.save ?? c.key_frames.shot ?? Math.floor(c.frames / 2);
    const a = Math.max(0, key - 60), b = Math.min(c.frames - 1, a + 75);
    parts.push({ n, a, b });
  }
  const list = path.join(dir, "_preview.txt");
  fs.writeFileSync(list, parts.flatMap(({ n, a, b }) => Array.from({ length: b - a + 1 }, (_, i) => `file '${path.join(dir, n, String(a + i).padStart(5, "0") + ".jpg")}'\nduration 0.0333333`)).join("\n") + "\n");
  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", "scale=360:640,fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", path.join(dir, "preview.mp4")]);
    return { file: "preview.mp4", parts };
  } catch (e) { log("preview skipped (ffmpeg):", e.message.split("\n")[0]); return null; } finally { fs.rmSync(list, { force: true }); }
}
async function launch(chromium) {
  const tries = [{}, ...["/opt/pw-browsers/chromium", process.env.GAMECAP_CHROMIUM].filter(Boolean).filter(p => fs.existsSync(p)).map(p => ({ executablePath: p }))];
  let last;
  for (const t of tries.reverse()) { try { return await chromium.launch(t); } catch (e) { last = e; } }
  throw new Error(`could not start Chromium (run: npx playwright install chromium): ${last?.message}`);
}
function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); s.on("error", rej); });
}
async function waitHttp(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (server.exitCode !== null) throw new Error("next dev exited; see _dev.log");
    try { const r = await fetch(url); if (r.status === 200) return; } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`timed out waiting for ${url}`);
}
