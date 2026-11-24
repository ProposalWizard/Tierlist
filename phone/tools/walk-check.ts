/**
 * CHECKS THE PHONE'S WALK-AROUND 3D (src/three/walkHost.ts + the garden) WITHOUT A PHONE.
 *
 *   cd phone && npx tsx tools/walk-check.ts [--out DIR] [--sizes 412x915,360x780] [--sky day|sunset|night] [--quality low|medium|high] [--dpr 2]
 *
 * The garden is started through the phone's host inside a Web Worker in headless Chromium.
 * A worker has no `document`, no `window`, no storage and no DOM, like the phone's JavaScript
 * engine (Hermes), so the stand-ins (src/three/standIn.ts, env.ts) are what the scene meets;
 * the GL is an OffscreenCanvas's, the pictures are unpacked by Skia (CanvasKit), the 3D files
 * come only through the phone's file reader (and are listed: each must be bundled,
 * src/three/assetList.ts). It then walks to spots, takes a still of each, reads the scene's own
 * numbers (draw calls, triangles) and the frames drawn, and checks that leaving puts everything back.
 * The machine has no graphics chip (SwiftShader draws on the processor): read times as relative.
 * Exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { THREE_ASSET_URLS } from "../src/three/assetList";

const args = process.argv.slice(2);
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "walk-check"));
const SIZES = arg("--sizes", "412x915,360x780").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const SKY = arg("--sky", "day");
const QUALITY = arg("--quality", "medium");
const DPR = Number(arg("--dpr", "2"));
const PHONE = path.join(__dirname, "..");
const ROOT = path.join(PHONE, "..");
let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.log(`   FAIL ${what}`); } };

(async () => {
  const esbuildAt = findEsbuild();
  const chrome = process.env.CHROME ?? findChrome();
  if (!esbuildAt || !chrome) { console.log(`skipped (chrome: ${chrome ?? "not found"}, esbuild: ${esbuildAt ?? "not found"})`); return; }
  const eb = require(esbuildAt) as typeof import("esbuild");
  const built = await eb.build({
    entryPoints: [path.join(__dirname, "walk-worker-entry.ts")], bundle: true, format: "iife", write: false,
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

  for (const [W, H] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
    const served = new Map<string, "app" | "public">();
    const stray = new Set<string>();
    await ctx.route("http://kib.test/**", (route) => {
      const u = new URL(route.request().url());
      const p = decodeURIComponent(u.pathname);
      if (p === "/") return route.fulfill({ contentType: "text/html", body: `<html><body style="margin:0;background:#000"><canvas id="c" style="width:${W}px;height:${H}px;display:block"></canvas></body></html>` });
      if (p === "/worker.js") return route.fulfill({ contentType: "text/javascript", body: workerJs });
      if (p === "/font-bold.ttf") return route.fulfill({ body: fs.readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf") });
      if (p === "/canvaskit.wasm") return route.fulfill({ contentType: "application/wasm", body: fs.readFileSync(path.join(PHONE, "node_modules/canvaskit-wasm/bin/full/canvaskit.wasm")) });
      // the phone reads the copies in phone/assets/3d (some unpacked: tools/garden-props-unpack.mjs)
      const mine = path.join(PHONE, "assets/3d", p.replace(/^\/star\//, "").replace(/\.json$/, ".bin"));
      if (p.startsWith("/star/") && fs.existsSync(mine)) { served.set(p, "app"); return route.fulfill({ body: fs.readFileSync(mine) }); }
      const pub = path.join(ROOT, "public", p);
      if (fs.existsSync(pub)) { served.set(p, "public"); return route.fulfill({ body: fs.readFileSync(pub) }); }
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
    console.log(`\n== ${W}x${H} css, dpr ${DPR}, GL buffer ${bw}x${bh} (${pr} per point), tier ${QUALITY}, sky ${SKY}`);
    const t0 = Date.now();
    let started: { ms: number; requested: string[]; log: string[] };
    try {
      started = await page.evaluate(async ([W, H, pr, q, sky]) => {
        const w = window as unknown as { call: (o: string, e: object, t?: Transferable[]) => Promise<unknown>; __off: OffscreenCanvas };
        return w.call("start", { canvas: w.__off, w: W, h: H, pr, quality: q, arrive: "gate", sky }, [w.__off]);
      }, [W, H, pr, QUALITY, SKY] as const) as { ms: number; requested: string[]; log: string[] };
    } catch (e) {
      console.log("   the garden did not start:", (e as Error).message.split("\n").slice(0, 6).join("\n   "));
      console.log("   page errors:", errors.slice(0, 5));
      ok(false, "the garden did not start");
      await ctx.close();
      continue;
    }
    console.log(`   started in ${started.ms.toFixed(0)} ms (wall ${Date.now() - t0} ms); the scene asked for ${started.requested.length} files`);
    const missing = started.requested.filter((u) => !THREE_ASSET_URLS.includes(u));
    ok(missing.length === 0, `not bundled in the app (src/three/assetList.ts): ${missing.join(", ")}`);
    const notMine = Array.from(served).filter(([p, w]) => w === "public" && p.startsWith("/star/")).map(([p]) => p);
    if (notMine.length) console.log(`   served from the website's folder (not phone/assets/3d): ${notMine.join(", ")}`);
    ok(stray.size === 0, `404 (not found anywhere): ${Array.from(stray).join(", ")}`);
    if (started.log.length) console.log("   log:", started.log.slice(0, 8));
    await sleep(2500);

    const spots: { name: string; at: [number, number, number]; want?: string }[] = [
      { name: "gate", at: [0, 15.5, Math.PI] },
      { name: "fountain", at: [0, 0.8, Math.PI], want: "fountain" },
      { name: "horse", at: [-5.6, 6.5, -Math.PI / 2], want: "horse" },
      { name: "cars", at: [9.5, 10.2, Math.PI], want: "cars" },
      { name: "shop", at: [0, -7.9, 0], want: "shop" },
      { name: "trophies", at: [-5.4, -5.8, -Math.PI / 2], want: "trophies" },
      { name: "mates", at: [8.2, 2.2, Math.PI / 2], want: "mates" },
    ];
    const shot = async (name: string) => { await page.locator("#c").screenshot({ path: path.join(OUT, `${name}-${W}x${H}.jpg`), type: "jpeg", quality: 82 }); };
    for (const s of spots) {
      await call("cmd", { fn: "place", args: s.at });
      await sleep(1800);
      // frames drawn over 3 s standing there
      const a = await call("state", { reset: true }) as { frames: number };
      await sleep(3000);
      const b = await call("state") as { frames: number; near: string | null; stats: { calls: number; triangles: number; pixelRatio: number; quality?: string }; where: { x: number; z: number }; js: { n: number; median: number; p95: number } };
      const fps = (b.frames - a.frames) / 3;
      console.log(`   ${s.name.padEnd(9)} near=${String(b.near).padEnd(9)} ${b.stats.calls} draws, ${(b.stats.triangles / 1000).toFixed(0)}k tris, JS/frame median ${b.js.median.toFixed(1)} ms p95 ${b.js.p95.toFixed(1)} ms (${b.js.n} frames), ${fps.toFixed(1)} fps (software GL), pr ${b.stats.pixelRatio}, tier ${b.stats.quality ?? "?"}`);
      if (s.want) ok(b.near === s.want, `at the ${s.name}: expected near=${s.want}, got ${b.near}`);
      await shot(s.name);
    }
    // touch paths: a tap on the ground walks, the stick walks, a drag looks round
    await call("cmd", { fn: "place", args: [0, 15.5, Math.PI] });
    await sleep(800);
    const w0 = (await call("state") as { where: { x: number; z: number; yaw: number } }).where;
    await call("cmd", { fn: "stick", args: [0, 1] });
    await sleep(2500);
    await call("cmd", { fn: "stick", args: [0, 0] });
    const w1 = (await call("state") as { where: { x: number; z: number; yaw: number } }).where;
    console.log(`   stick forward 2.5 s: moved ${Math.hypot(w1.x - w0.x, w1.z - w0.z).toFixed(2)} m`);
    ok(Math.hypot(w1.x - w0.x, w1.z - w0.z) > 0.5, "the stick did not walk him");
    await call("cmd", { fn: "tap", args: [W * 0.5, H * 0.62] });
    await sleep(2500);
    const st = (await call("state")) as { walking: { to: [number, number] | null; active: boolean } | undefined; where: { x: number; z: number } };
    console.log(`   tap on the ground: walking=${JSON.stringify(st.walking)} now at ${st.where.x.toFixed(1)}, ${st.where.z.toFixed(1)}`);
    ok(!!st.walking, "no tap-walk in the controller");
    // a pinch: two pointers handed to the scene's own listeners
    await call("cmd", { fn: "pointer", type: "pointerdown", args: [1, 100, 400] });
    await call("cmd", { fn: "pointer", type: "pointerdown", args: [2, 300, 400] });
    const pin = (await call("state")) as { pinching: boolean };
    await call("cmd", { fn: "pointer", type: "pointerup", args: [1, 100, 400] });
    await call("cmd", { fn: "pointer", type: "pointerup", args: [2, 300, 400] });
    ok(pin.pinching, "two fingers did not start the scene's pinch");
    // pause holds the frames, resume goes on
    await call("cmd", { fn: "pause" });
    await sleep(300);
    const p0 = (await call("state") as { frames: number }).frames;
    await sleep(1500);
    const p1 = (await call("state") as { frames: number }).frames;
    await call("cmd", { fn: "resume" });
    await sleep(1500);
    const p2 = (await call("state") as { frames: number }).frames;
    console.log(`   paused: ${p1 - p0} frames in 1.5 s; resumed: ${p2 - p1} frames in 1.5 s`);
    ok(p1 - p0 <= 1, "frames kept drawing while paused");
    ok(p2 - p1 >= 1, "frames did not come back after resume");
    const fin = (await call("state")) as { log: string[] };
    const gone = (await call("dispose")) as { document: string; dpr: number | undefined; log: string[] };
    console.log(`   after leaving: document is ${gone.document}, devicePixelRatio ${gone.dpr}`);
    ok(gone.document === "undefined", "the stand-in document was left behind");
    ok(gone.dpr === undefined || gone.dpr === 1, "devicePixelRatio was not put back");
    const bad = fin.log.concat(errors).filter((l) => !/Failed to load resource|WEBGL_debug|GPU stall|ReadPixels/i.test(l));
    if (bad.length) console.log("   messages:", Array.from(new Set(bad)).slice(0, 10));
    const asked = Array.from(new Set(started.requested));
    console.log(`   files read through the phone's reader (${asked.length}): ${asked.map((u) => u.replace("/star/", "")).join(", ")}`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\npictures: ${OUT}/<spot>-<size>.jpg`);
  console.log(failed ? `${failed} problem(s)` : "all good");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
