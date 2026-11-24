/**
 * CHECKS THE PHONE'S 3D TRAINING PITCH (src/three/trainingScene.ts through the walk host) WITHOUT A PHONE.
 *
 *   cd phone && npx tsx tools/training-check.ts [--only crossbar,two-touch,free-roam,headers-volleys,wembley,pace] [--out DIR] [--sizes 412x915] [--quality low|medium|high] [--plain]
 *
 * Each place is started through the phone's host inside a Web Worker in headless Chromium (no `document`, no
 * `window`, no DOM, like Hermes), built from the same data code the screens use (src/three/trainingData.ts). The 3D
 * files come only through the phone's file reader and are listed (each must be bundled: src/three/assetList.ts).
 * Crossbar: your kick with the engine's ball fed in, his shot as a cut-scene, the camera, rest and wake. A drill:
 * the World runs, a tap and a swipe are handed to it, the HUD moves, the camera's numbers answer. Pause holds
 * every frame; leaving puts everything back. Software GL: read times as relative. Exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { THREE_ASSET_URLS } from "../src/three/assetList";

const args = process.argv.slice(2);
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "training-check"));
const SIZES = arg("--sizes", "412x915").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const QUALITY = arg("--quality", "low");
const DPR = Number(arg("--dpr", "2"));
const PLAIN = args.includes("--plain");
const ONLY = arg("--only", "crossbar,two-touch,free-roam,headers-volleys,wembley,pace").split(",");
const PHONE = path.join(__dirname, "..");
const ROOT = path.join(PHONE, "..");
let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.log(`   FAIL ${what}`); } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const esbuildAt = findEsbuild();
  const chrome = process.env.CHROME ?? findChrome();
  if (!esbuildAt || !chrome) { console.log(`skipped (chrome: ${chrome ?? "not found"}, esbuild: ${esbuildAt ?? "not found"})`); return; }
  const eb = require(esbuildAt) as typeof import("esbuild");
  const built = await eb.build({
    entryPoints: [path.join(__dirname, "training-worker-entry.ts")], bundle: true, format: "iife", write: false,
    tsconfig: path.join(PHONE, "tsconfig.json"), platform: "browser", logLevel: "error", plugins: [aliasPlugin()],
    define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [path.join(PHONE, "node_modules"), path.join(ROOT, "node_modules")],
    external: ["fs", "path", "react-native", "react-native-mmkv"],
  });
  const workerJs = built.outputFiles[0].text;
  const { chromium } = require(require.resolve("playwright", { paths: [ROOT] })) as typeof import("playwright");
  const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  fs.mkdirSync(OUT, { recursive: true });
  const prof: Record<string, { pr: number }> = { low: { pr: 1.25 }, medium: { pr: 1.5 }, high: { pr: 1.5 } };
  const [W, H] = SIZES[0];
  const mate = { shot: { hit: true, tx: 0, tz: 2.4, sx: 0 } };
  let allFiles = new Set<string>();

  for (const place of ONLY) {
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
    const pr = prof[QUALITY].pr;
    const bw = Math.round(W * pr), bh = Math.round(H * pr);
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
    const shot = async (name: string) => { await page.locator("#c").screenshot({ path: path.join(OUT, `${place}-${name}-${W}x${H}.jpg`), type: "jpeg", quality: 82 }); };
    const st = async (reset = false) => (await call("state", { reset })) as { frames: number; draws: number; log: string[]; stats: { calls: number; triangles: number } | null; hud: { big: string; small: string; banner?: { text: string } | null; flash?: string } | null; done: boolean; world: { t: number; ball: { x: number; y: number; z: number }; you: { x: number; y: number } | null } | null; screens: { ball: { x: number; y: number } | null; heading: number } | null; js: { n: number; median: number; p95: number } };
    console.log(`\n== ${place}  ${W}x${H} css, dpr ${DPR}, GL buffer ${bw}x${bh}, tier ${QUALITY}${PLAIN ? ", plain (no look H)" : ""}`);
    let started: { ms: number; requested: string[]; log: string[] };
    try {
      started = await page.evaluate(async ([W, H, pr, q, place, plain]) => {
        const w = window as unknown as { call: (o: string, e: object, t?: Transferable[]) => Promise<unknown>; __off: OffscreenCanvas };
        return w.call("start", { canvas: w.__off, w: W, h: H, pr, quality: q, place: place === "crossbar" ? "crossbar" : "drill", drill: place, plain }, [w.__off]);
      }, [W, H, pr, QUALITY, place, PLAIN] as const) as { ms: number; requested: string[]; log: string[] };
    } catch (e) {
      console.log(`   did not start:`, (e as Error).message.split("\n").slice(0, 8).join("\n   "));
      console.log("   page errors:", errors.slice(0, 5));
      ok(false, `${place} did not start`);
      await ctx.close();
      continue;
    }
    console.log(`   started in ${started.ms.toFixed(0)} ms; the scene asked for ${started.requested.length} files`);
    started.requested.forEach((u) => allFiles.add(u));
    const missing = started.requested.filter((u) => !THREE_ASSET_URLS.includes(u));
    ok(missing.length === 0, `not bundled in the app (src/three/assetList.ts): ${missing.join(", ")}`);
    ok(stray.size === 0, `404 (not found anywhere): ${Array.from(stray).join(", ")}`);
    if (started.log.length) console.log("   log:", started.log.slice(0, 8));
    await sleep(2000);

    if (place === "crossbar") {
      await cmd("call", { name: "setShooter", args: ["you"] });
      await cmd("call", { name: "setActive", args: [true] });
      await sleep(2500);
      await shot("behind");
      await cmd("engineShot");
      await cmd("call", { name: "setCamera", args: ["goal"] });
      await sleep(2500);
      await shot("goal");
      const s1 = await st(true);
      console.log(`   your shot (the engine's ball fed in): ${s1.frames} frames so far`);
      const done = await Promise.race([cmd("mateShot", { shot: mate.shot }), sleep(60000).then(() => "timeout")]);
      console.log(`   his shot: ${done}`);
      ok(done === "done", "his cut-scene shot never finished");
      await shot("mate");
      await cmd("call", { name: "play", args: ["you", "celebrate"] });
      await cmd("call", { name: "play", args: ["mate", "frustrated"] });
      await sleep(1500);
      await shot("celebrate");
      // rest: while the engine's own pitch is on screen the 3D stops drawing
      await cmd("call", { name: "setActive", args: [false] });
      await sleep(1200);
      const r0 = (await st()).frames;
      await sleep(2500);
      const r1 = (await st()).frames;
      console.log(`   at rest: ${r1 - r0} frames in 2.5 s`);
      ok(r1 - r0 <= 1, "the 3D pitch kept drawing while the engine's pitch was on screen");
      await cmd("call", { name: "setActive", args: [true] });
      await sleep(2500);
      const r2 = (await st()).frames;
      console.log(`   woken: ${r2 - r1} frames`);
      ok(r2 - r1 >= 1, "the 3D pitch did not draw again after it was woken");
      const s = await st();
      console.log(`   JS/frame median ${s.js.median.toFixed(1)} ms p95 ${s.js.p95.toFixed(1)} ms (${s.js.n} frames); ${s.draws} draws counted by the GL in all`);
    } else {
      const a = await st(true);
      console.log(`   hud at the start: "${a.hud?.big}" / "${a.hud?.small}"`);
      await sleep(3000);
      await shot("start");
      const b = await st();
      console.log(`   after 3 s: world time ${b.world?.t.toFixed(1)} (was ${a.world?.t.toFixed(1)}), ball ${b.screens?.ball ? `drawn at ${b.screens.ball.x.toFixed(0)},${b.screens.ball.y.toFixed(0)}` : "not on screen"}, heading ${b.screens?.heading.toFixed(2)}`);
      ok((b.world?.t ?? 0) > (a.world?.t ?? 0), "the drill's World did not run");
      ok(b.screens?.heading !== undefined && Number.isFinite(b.screens.heading), "no camera heading from the scene");
      // a move, a tap and a swipe, as the screen hands them to the World
      await cmd("move", { x: 0, y: -1, sprint: false });
      await sleep(2500);
      await cmd("move", { x: 0, y: 0 });
      await cmd("act", { action: { kind: "tap" } });
      await cmd("act", { action: { kind: "shoot", dir: { x: 0, y: -1 }, pull: 0.1 } });
      await sleep(3500);
      await shot("played");
      const c = await st();
      console.log(`   after a move, a tap and a swipe: hud "${c.hud?.big}" / "${c.hud?.small}", you at ${c.world?.you?.x.toFixed(1)},${c.world?.you?.y.toFixed(1)}, JS/frame median ${c.js.median.toFixed(1)} ms p95 ${c.js.p95.toFixed(1)} ms, ${c.stats?.calls ?? "?"} draws ${c.stats ? (c.stats.triangles / 1000).toFixed(0) + "k tris" : ""}`);
      const bad = c.log.filter((l) => /look H failed/.test(l));
      if (bad.length) console.log("   look H:", bad[0]);
      ok(!c.log.some((l) => /3D drill failed|did not start/i.test(l)), "the scene logged a failure");
    }
    // pause holds the frames, resume goes on
    await cmd("pause");
    await sleep(300);
    const p0 = (await st()).frames;
    await sleep(1500);
    const p1 = (await st()).frames;
    await cmd("resume");
    await sleep(2500);
    const p2 = (await st()).frames;
    console.log(`   paused: ${p1 - p0} frames in 1.5 s; resumed: ${p2 - p1} frames in 2.5 s`);
    ok(p1 - p0 <= 1, "frames kept drawing while paused");
    ok(p2 - p1 >= 1, "frames did not come back after resume");
    const fin = await st();
    const gone = (await call("dispose")) as { document: string; dpr: number | undefined; log: string[] };
    console.log(`   after leaving: document is ${gone.document}, devicePixelRatio ${gone.dpr}`);
    ok(gone.document === "undefined", "the stand-in document was left behind");
    ok(gone.dpr === undefined || gone.dpr === 1, "devicePixelRatio was not put back");
    const noisy = fin.log.concat(errors).filter((l) => !/Failed to load resource|WEBGL_debug|GPU stall|ReadPixels/i.test(l));
    if (noisy.length) console.log("   messages:", Array.from(new Set(noisy)).slice(0, 10));
    const asked = Array.from(new Set(((await call("asked")) as string[]).concat(started.requested)));
    asked.forEach((u) => allFiles.add(u));
    const missing2 = asked.filter((u) => !THREE_ASSET_URLS.includes(u));
    ok(missing2.length === 0, `not bundled: ${missing2.join(", ")}`);
    await ctx.close();
  }
  await browser.close();
  const bytes = Array.from(allFiles).reduce((n, u) => { const f = path.join(PHONE, "assets/3d", u.replace(/^\/star\//, "").replace(/\.json$/, ".bin")); return n + (fs.existsSync(f) ? fs.statSync(f).size : 0); }, 0);
  console.log(`\nfiles read by everything above: ${allFiles.size}, ${(bytes / 1048576).toFixed(1)} MB in the app (some were already there for the garden)`);
  console.log(Array.from(allFiles).map((u) => u.replace("/star/", "")).join(", "));
  console.log(`pictures: ${OUT}/<place>-<spot>-<size>.jpg`);
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
