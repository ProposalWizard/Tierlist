/**
 * CHECKS THE PHONE'S 3D MATCH VIEW (src/three/matchViewScene.ts through the walk host) WITHOUT A PHONE.
 *
 *   cd phone && npx tsx tools/match-view-check.ts [--quality low|medium|high] [--tod day|golden|night] [--sizes 388x560] [--out DIR] [--frames 900]
 *
 * A real match is played headless with the bot on the phone's one driver (tools/match-view-frames.ts) and every frame of
 * every chance is turned into the frame the 3D view is handed (src/three/matchFrame.ts). The 3D view then runs in a Web
 * Worker in headless Chromium (no `document`, no `window`, like Hermes), started through the phone's host, and is handed
 * those frames one after another as the match screen does. Its files come only through the phone's file reader and are
 * listed (each must be bundled: src/three/assetList.ts). Prints what the 3D costs: the JS time of one frame, the draw
 * calls and triangles a frame (counted by the GL itself), the start time. Also the 2D match's own JS time with and
 * without handing frames over. Pause holds, hiding stops, leaving puts everything back. Software GL: read times as
 * relative. Exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { THREE_ASSET_URLS } from "../src/three/assetList";
import { recordFrames, quant } from "./match-view-frames";

const args = process.argv.slice(2);
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "match-view-check"));
const [W, H] = arg("--sizes", "388x560").split("x").map(Number);
const QUALITY = arg("--quality", "low");
const TOD = arg("--tod", "golden");
const DPR = Number(arg("--dpr", "2"));
const NFRAMES = Number(arg("--frames", "900"));
const PHONE = path.join(__dirname, "..");
const ROOT = path.join(PHONE, "..");
let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.log(`   FAIL ${what}`); } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const esbuildAt = findEsbuild();
  const chrome = process.env.CHROME ?? findChrome();
  if (!esbuildAt || !chrome) { console.log(`skipped (chrome: ${chrome ?? "not found"}, esbuild: ${esbuildAt ?? "not found"})`); return; }
  console.log(`recording ${NFRAMES} frames of a real match (the bot, the phone's one driver) at ${W}x${H} ...`);
  const rec = await recordFrames(NFRAMES, W, H);
  const fq = (xs: number[]) => `median ${quant(xs, 0.5).toFixed(3)} ms, p95 ${quant(xs, 0.95).toFixed(3)} ms`;
  console.log(`   ${rec.frames.length} frames over ${rec.chances} chances. JS per frame (V8, no JIT limits of Hermes): driver tick ${fq(rec.tickMs)}; 2D picture ${fq(rec.drawMs)}; handing the frame over ${fq(rec.frameMs)}`);
  const phases = new Map<string, number>();
  rec.frames.forEach((f) => phases.set(f.phase, (phases.get(f.phase) ?? 0) + 1));
  console.log("   phases:", Object.fromEntries(phases));
  const eb = require(esbuildAt) as typeof import("esbuild");
  const built = await eb.build({
    entryPoints: [path.join(__dirname, "match-view-worker-entry.ts")], bundle: true, format: "iife", write: false,
    tsconfig: path.join(PHONE, "tsconfig.json"), platform: "browser", logLevel: "error", plugins: [aliasPlugin()],
    define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [path.join(PHONE, "node_modules"), path.join(ROOT, "node_modules")],
    external: ["fs", "path", "react-native", "react-native-mmkv"],
  });
  const workerJs = built.outputFiles[0].text;
  const { chromium } = require(require.resolve("playwright", { paths: [ROOT] })) as typeof import("playwright");
  // --jitless: V8 with its optimising compilers off (Ignition only; a real --jitless would also stop WebAssembly, which the check's Skia needs), nearer to the phone's Hermes, which has none: the JS times are then several times slower
  const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", ...(args.includes("--jitless") ? ["--js-flags=--no-opt --no-sparkplug --no-maglev"] : [])] });
  fs.mkdirSync(OUT, { recursive: true });
  const prof: Record<string, { pr: number }> = { low: { pr: 1.25 }, medium: { pr: 1.5 }, high: { pr: 1.5 } };
  const pr = prof[QUALITY].pr;
  const bw = Math.round(W * pr), bh = Math.round(H * pr);

  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
  const stray = new Set<string>();
  await ctx.route("http://kib.test/**", (route) => {
    const u = new URL(route.request().url());
    const p = decodeURIComponent(u.pathname);
    if (p === "/") return route.fulfill({ contentType: "text/html", body: `<html><body style="margin:0;background:#000"><canvas id="c" style="width:${W}px;height:${H}px;display:block"></canvas></body></html>` });
    if (p === "/worker.js") return route.fulfill({ contentType: "text/javascript", body: workerJs });
    if (p === "/font-bold.ttf") return route.fulfill({ body: fs.readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf") });
    if (p === "/canvaskit.wasm") return route.fulfill({ contentType: "application/wasm", body: fs.readFileSync(path.join(PHONE, "node_modules/canvaskit-wasm/bin/full/canvaskit.wasm")) });
    const mine = p.startsWith("/star/trophies/") ? path.join(PHONE, "assets/trophies", path.basename(p)) : path.join(PHONE, "assets/3d", p.replace(/^\/star\//, "").replace(/\.json$/, ".bin"));
    if (p.startsWith("/star/") && fs.existsSync(mine)) return route.fulfill({ body: fs.readFileSync(mine) });
    stray.add(p);
    return route.fulfill({ status: 404, body: "" });
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://kib.test/");
  await page.evaluate(([bw, bh]) => {
    const c = document.getElementById("c") as HTMLCanvasElement;
    c.width = bw; c.height = bh;
    const off = c.transferControlToOffscreen();
    const w = new Worker("/worker.js");
    const waits = new Map<number, (v: { ok: boolean; v?: unknown; e?: string }) => void>();
    w.onmessage = (e) => waits.get(e.data.id)?.(e.data);
    let n = 0;
    (window as unknown as { call: (op: string, extra: object, transfer?: Transferable[]) => Promise<unknown> }).call = (op, extra, transfer) => new Promise((res, rej) => {
      const id = ++n;
      waits.set(id, (d) => (d.ok ? res(d.v) : rej(new Error(d.e))));
      w.postMessage({ id, op, ...extra }, transfer ?? []);
    });
    (window as unknown as { __off: OffscreenCanvas }).__off = off;
  }, [bw, bh]);
  const call = (op: string, extra: object = {}) => page.evaluate(([op, extra]) => (window as unknown as { call: (o: string, e: object) => Promise<unknown> }).call(op as string, extra as object), [op, extra]);
  const cmd = (fn: string, extra: object = {}) => call("cmd", { fn, ...extra });
  const shot = async (name: string) => { await page.locator("#c").screenshot({ path: path.join(OUT, `match-${name}-${W}x${H}-${QUALITY}-${TOD}.jpg`), type: "jpeg", quality: 82 }); };
  type St = { frames: number; draws: number; tris: number; log: string[]; fed: number; js: { n: number; median: number; p95: number; max: number } };
  const st = async (reset = false) => (await call("state", { reset })) as St;
  const feed = async (n: number) => (await call("feed", { n })) as { fed: number; errs: string[]; nErrs: number };

  console.log(`\n== the 3D match view  ${W}x${H} css, dpr ${DPR}, GL buffer ${bw}x${bh}, tier ${QUALITY}, ${TOD}`);
  let started: { ms: number; requested: string[]; log: string[] };
  try {
    started = await page.evaluate(async ([W, H, pr, q, tod]) => {
      const w = window as unknown as { call: (o: string, e: object, t?: Transferable[]) => Promise<unknown>; __off: OffscreenCanvas };
      return w.call("start", { canvas: w.__off, w: W, h: H, pr, quality: q, tod }, [w.__off]);
    }, [W, H, pr, QUALITY, TOD] as const) as { ms: number; requested: string[]; log: string[] };
  } catch (e) {
    console.log(`   did not start:`, (e as Error).message.split("\n").slice(0, 10).join("\n   "));
    console.log("   page errors:", errors.slice(0, 5));
    await browser.close();
    process.exit(1);
  }
  console.log(`   started in ${started.ms.toFixed(0)} ms; the scene asked for ${started.requested.length} files`);
  const files = new Set(started.requested);
  const missing = started.requested.filter((u) => !THREE_ASSET_URLS.includes(u));
  ok(missing.length === 0, `not bundled in the app (src/three/assetList.ts): ${missing.join(", ")}`);
  ok(stray.size === 0, `404 (not found anywhere): ${Array.from(stray).join(", ")}`);
  if (started.log.length) console.log("   log:", started.log.slice(0, 8));
  await call("load", { frames: rec.frames });

  // pick one frame of each kind to look at
  const at = (ph: string, k = 0) => rec.frames.map((f, i) => (f.phase === ph ? i : -1)).filter((i) => i >= 0)[k] ?? -1;
  const marks: [string, number][] = [["aim", at("aim", 12)], ["flight", at("flight", 18)], ["result", at("result", 30)]];
  console.log("   still frames at", marks.map(([n, i]) => `${n}=#${i}`).join(" "));

  // warm up (the first frames build the men's shadows and the skins), then measure
  let r = await feed(8);
  ok(r.nErrs === 0, `frames threw: ${r.errs.join(" | ")}`);
  await st(true);
  const g0 = await st(true);
  const N = Math.min(240, rec.frames.length - 20);
  r = await feed(N);
  ok(r.nErrs === 0, `frames threw while measuring: ${r.errs.join(" | ")}`);
  const g1 = await st();
  const nf = Math.max(1, g1.frames - g0.frames);
  console.log(`   ${N} frames handed over: JS in the 3D frame median ${g1.js.median.toFixed(1)} ms, p95 ${g1.js.p95.toFixed(1)} ms, max ${g1.js.max.toFixed(1)} ms; ${(g1.draws - g0.draws) / nf | 0} draw calls and ${Math.round((g1.tris - g0.tris) / nf / 1000)}k triangles a frame (counted by the GL, ${nf} drawn)`);
  for (const [name, i] of marks) {
    if (i < 0) continue;
    await call("seek", { to: i });
    await feed(2);
    await sleep(300);
    await shot(name);
  }
  // hidden: no frame is asked of the scene when the screen does not hand any over
  await cmd("visible", { on: false });
  const h0 = (await st()).frames;
  await sleep(1500);
  const h1 = (await st()).frames;
  console.log(`   hidden and not fed: ${h1 - h0} frames in 1.5 s`);
  ok(h1 - h0 <= 0, "the 3D drew while it was hidden and nothing was handed over");
  await cmd("visible", { on: true });
  await call("seek", { to: 60 });
  await feed(6);
  const h2 = (await st()).frames;
  ok(h2 > h1, "the 3D did not draw again after it was shown");
  // pause holds, resume goes on (the app in the background)
  await cmd("pause");
  await sleep(300);
  const p0 = (await st()).frames;
  await sleep(1200);
  const p1 = (await st()).frames;
  await cmd("resume");
  console.log(`   paused: ${p1 - p0} frames in 1.2 s`);
  ok(p1 - p0 <= 0, "frames kept drawing while paused");
  const fin = await st();
  const gone = (await call("dispose")) as { document: string; dpr: number | undefined; log: string[] };
  console.log(`   after leaving: document is ${gone.document}, devicePixelRatio ${gone.dpr}`);
  ok(gone.document === "undefined", "the stand-in document was left behind");
  ok(gone.dpr === undefined || gone.dpr === 1, "devicePixelRatio was not put back");
  const noisy = fin.log.concat(errors).filter((l) => !/Failed to load resource|WEBGL_debug|GPU stall|ReadPixels/i.test(l));
  if (noisy.length) console.log("   messages:", Array.from(new Set(noisy)).slice(0, 10));
  const asked = Array.from(new Set(((await call("asked")) as string[]).concat(started.requested)));
  asked.forEach((u) => files.add(u));
  const missing2 = asked.filter((u) => !THREE_ASSET_URLS.includes(u));
  ok(missing2.length === 0, `not bundled: ${missing2.join(", ")}`);
  await ctx.close();
  await browser.close();
  const bytes = Array.from(files).reduce((n, u) => { const f = path.join(PHONE, "assets/3d", u.replace(/^\/star\//, "").replace(/\.json$/, ".bin")); return n + (fs.existsSync(f) ? fs.statSync(f).size : 0); }, 0);
  console.log(`\nfiles read: ${files.size}, ${(bytes / 1048576).toFixed(1)} MB in the app (some were already there for the garden and the training pitch)`);
  console.log(Array.from(files).map((u) => u.replace("/star/", "")).join(", "));
  console.log(`pictures: ${OUT}/match-<phase>-<size>-<tier>-<tod>.jpg`);
  console.log(failed ? `${failed} problem(s)` : "all good");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

/** The phone's two swaps (phone/metro.config.js) for esbuild. */
function aliasPlugin(): import("esbuild").Plugin {
  return {
    name: "kib-three",
    setup(b) {
      const here = (p: string) => path.join(PHONE, "src/three", p);
      b.onResolve({ filter: /(^|\/)meshopt$/ }, (a) => {
        const abs = a.path.startsWith("@/") ? path.join(ROOT, a.path.slice(2)) : a.path.startsWith(".") ? path.resolve(a.resolveDir, a.path) : "";
        return abs === path.join(ROOT, "lib/star/three3d/meshopt") ? { path: here("meshopt.ts") } : undefined;
      });
      b.onResolve({ filter: /^three\/examples\/jsm\/loaders\/GLTFLoader\.js$/ }, (a) => (!a.importer.endsWith(path.join("src/three/GLTFLoader.ts")) ? { path: here("GLTFLoader.ts") } : undefined));
      b.onResolve({ filter: /^three$/ }, () => ({ path: require.resolve("three", { paths: [ROOT] }) }));
    },
  };
}

function findEsbuild(): string | null {
  try { return require.resolve("esbuild"); } catch { /* look further */ }
  try { return require.resolve("esbuild", { paths: [ROOT] }); } catch { /* look further */ }
  const npx = path.join(process.env.HOME ?? "/root", ".npm/_npx");
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) {
    const f = path.join(npx, d, "node_modules/esbuild");
    if (fs.existsSync(f)) return f;
  }
  return null;
}
function findChrome(): string | null {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(process.env.HOME ?? "", ".cache/ms-playwright")].filter(Boolean) as string[];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter((x) => x.startsWith("chromium-")).sort().reverse()) {
      for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const f = path.join(r, d, sub);
        if (fs.existsSync(f)) return f;
      }
    }
  }
  return null;
}
