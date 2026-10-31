#!/usr/bin/env node
/**
 * GOAL-VIDEO BENCH: render goal videos offline, frame by frame, with the
 * game's own drawing code (lib/star/goalClip/render.ts) in headless Chromium.
 *
 *   node scripts/goal-video-bench/render.mjs <jobs.json> <outDir>
 *
 * jobs.json: [{ name, fixtures?: ["lay-off"], synth?: [SynthGoal], style,
 *   variant, opts?, handle? }]. For each job it writes <name>.mp4 (30 fps,
 *   ffmpeg) and <name>-sheet.jpg (a frame every 0.25 s, time in the corner).
 * Needs: playwright (node_modules) with a Chromium, esbuild (node_modules, or
 * the npx cache that `npx tsx` fills), ffmpeg. No server, no build.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "node:fs";
import { join, resolve, extname, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const require = createRequire(join(root, "package.json"));

function findEsbuild() {
  try { return require("esbuild"); } catch { /* look in the npx cache */ }
  const npx = join(process.env.HOME ?? "/root", ".npm/_npx");
  for (const d of existsSync(npx) ? readdirSync(npx) : []) {
    const p = join(npx, d, "node_modules/esbuild");
    if (existsSync(join(p, "package.json"))) return createRequire(join(p, "package.json"))(p);
  }
  throw new Error("esbuild not found (run `npx tsx --version` once to fetch it)");
}

const [jobsPath, outDirArg, only] = process.argv.slice(2);
if (!jobsPath || !outDirArg) { console.error("usage: render.mjs <jobs.json> <outDir> [nameFilter]"); process.exit(1); }
const outDir = resolve(outDirArg);
mkdirSync(outDir, { recursive: true });
const jobs = JSON.parse(readFileSync(jobsPath, "utf8")).filter((j) => !only || j.name.includes(only));

const esbuild = findEsbuild();
const bundle = esbuild.buildSync({
  entryPoints: [join(here, "entry.ts")], bundle: true, write: false, format: "iife", platform: "browser",
  tsconfig: join(root, "tsconfig.json"), define: { "process.env.NODE_ENV": '"development"' }, logLevel: "error",
}).outputFiles[0].text;

const { chromium } = require("playwright");
// Any Chromium will do: BENCH_CHROME, else whichever the browsers folder has.
function chromePath() {
  if (process.env.BENCH_CHROME) return process.env.BENCH_CHROME;
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  for (const d of dir && existsSync(dir) ? readdirSync(dir) : []) {
    const p = join(dir, d, "chrome-linux/chrome");
    if (d.startsWith("chromium-") && existsSync(p)) return p;
  }
  return undefined;
}
const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage();
const MIME = { ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".jpg": "image/jpeg", ".glb": "model/gltf-binary" };
await page.route("http://bench.local/**", async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body style='margin:0;background:#000'></body></html>" });
  if (url.pathname === "/bench.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
  const file = join(root, "public", decodeURIComponent(url.pathname));
  if (existsSync(file)) return route.fulfill({ contentType: MIME[extname(file)] ?? "application/octet-stream", body: readFileSync(file) });
  return route.fulfill({ status: 404, body: "" });
});
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto("http://bench.local/");
await page.addScriptTag({ url: "http://bench.local/bench.js" });

const fixture = (n) => JSON.parse(readFileSync(join(root, "tests/star/fixtures/goalClips", `${n}.json`), "utf8"));
for (const job of jobs) {
  const info = await page.evaluate((j) => window.benchSetup(j), { stored: (job.fixtures ?? []).map(fixture), synth: job.synth, style: job.style, variant: job.variant ?? 0, opts: job.opts, handle: job.handle });
  const frames = Math.round(info.duration * info.fps);
  const tmp = join(outDir, `.${job.name}-frames`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp);
  for (let f = 0; f < frames; f++) {
    const url = await page.evaluate((t) => window.benchFrame(t), f / info.fps);
    writeFileSync(join(tmp, `${String(f).padStart(5, "0")}.jpg`), Buffer.from(url.split(",")[1], "base64"));
  }
  const mp4 = join(outDir, `${job.name}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(info.fps), "-i", join(tmp, "%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", mp4]);
  const tall = info.h > info.w;
  const cellW = tall ? 150 : 256;
  const cols = tall ? 10 : 6;
  const rows = Math.ceil((frames / info.fps) * 4 / cols);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(info.fps), "-i", join(tmp, "%05d.jpg"),
    "-vf", `fps=4,scale=${cellW}:-2,drawtext=text='%{pts\\:flt}':x=3:y=3:fontsize=12:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=${cols}x${rows}:padding=2:color=black`,
    "-frames:v", "1", "-q:v", "5", join(outDir, `${job.name}-sheet.jpg`)]);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${job.name}: ${info.duration.toFixed(2)} s, ${info.shots} shots, ${info.w}x${info.h}`);
}
await browser.close();
