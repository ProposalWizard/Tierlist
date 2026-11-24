/**
 * CHECKS THE PHONE'S 3D STAR PASS PODIUM (src/podium/podiumScene.ts through the walk host) WITHOUT A PHONE.
 *
 *   cd phone && npx tsx tools/podium-check.ts [--only pass-star-ball,acc-celeb-backflip,...|all] [--out DIR] [--quality low|medium|high]
 *
 * Each reward is started through the phone's host inside a Web Worker in headless Chromium (no `document`, no `window`, no DOM,
 * no IntersectionObserver, like Hermes), from the same card data the Star Pass screen uses (lib/star/rewardCatalogue.ts: `art.live ?? art.spin`,
 * sized as the screen sizes it). The 3D files come only through the phone's file reader and are listed (each must be bundled:
 * src/three/assetList.ts). It turns by the website's pointer events (a drag, a flick, a tap to zoom on the cards that have one),
 * rests when nothing moves, pauses and resumes, and is let go cleanly. `--only all` starts all 50 rewards of the pass.
 * Software GL: read times as relative. Exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { THREE_ASSET_URLS } from "../src/three/assetList";
import { DEFAULT_PASS_LEVELS, findCard, fullCatalogue } from "../../lib/star/rewardCatalogue";

const args = process.argv.slice(2);
const arg = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const OUT = arg("--out", path.join(process.env.TMPDIR ?? "/tmp", "podium-check"));
const QUALITY = arg("--quality", "low");
const DPR = Number(arg("--dpr", "2"));
const CAT = fullCatalogue();
const IN_PASS = Array.from(new Set(Object.values(DEFAULT_PASS_LEVELS as Record<number, string>).filter((id) => { const c = findCard(id, CAT); return !!(c?.art.live ?? c?.art.spin); })));
const ONLY = arg("--only", "pass-star-ball,pass-gold-aviators,acc-celeb-backflip,pass-supercar,pass-golden-set,acc-boots-gold") === "all" ? IN_PASS : arg("--only", "pass-star-ball,pass-gold-aviators,acc-celeb-backflip,pass-supercar,pass-golden-set,acc-boots-gold").split(",");
/** The size the Star Pass preview gives a card (screens/world/StarPass.tsx Preview): a box 340 x 260. */
const BOX = { w: 340, h: 260 };
function cfgOf(id: string) {
  const c = findCard(id, CAT)!;
  const live = (c.art.live ?? c.art.spin)!;
  if (c.art.live) { const k = Math.min(BOX.w / live.w, BOX.h / live.h); return { w: Math.round(live.w * k), h: Math.round(live.h * k), zoom: !!live.zoom }; }
  return { w: BOX.w, h: BOX.h, zoom: !!live.zoom };
}
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
    entryPoints: [path.join(__dirname, "podium-worker-entry.ts")], bundle: true, format: "iife", write: false,
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
  const allFiles = new Set<string>();

  for (const place of ONLY) {
    const { w: W, h: H, zoom: hasZoom } = cfgOf(place);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
    const stray = new Set<string>();
    await ctx.route("http://kib.test/**", (route) => {
      const u = new URL(route.request().url());
      const p = decodeURIComponent(u.pathname);
      if (p === "/") return route.fulfill({ contentType: "text/html", body: `<html><body style="margin:0;background:#000"><canvas id="c" style="width:${W}px;height:${H}px;display:block"></canvas></body></html>` });
      if (p === "/worker.js") return route.fulfill({ contentType: "text/javascript", body: workerJs });
      if (p === "/font-bold.ttf") return route.fulfill({ body: fs.readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf") });
      if (p === "/canvaskit.wasm") return route.fulfill({ contentType: "application/wasm", body: fs.readFileSync(path.join(PHONE, "node_modules/canvaskit-wasm/bin/full/canvaskit.wasm")) });
      const mine = path.join(PHONE, "assets/3d", p.replace(/^\/star\//, "").replace(/\.json$/, ".bin"));
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
    const run = (name: string, ...a: unknown[]) => cmd("call", { name, args: a });
    // (a frame the worker has just drawn reaches the page a moment later: wait for it)
    const shot = async (name: string) => { await sleep(700); await page.locator("#c").screenshot({ path: path.join(OUT, `${place}-${name}-${W}x${H}.jpg`), type: "jpeg", quality: 82 }); };
    const st = async (reset = false) => (await call("state", { reset })) as { frames: number; draws: number; events: string[]; log: string[]; js: { n: number; median: number; p95: number } };
    console.log(`\n== ${place}  ${W}x${H} css, dpr ${DPR}, GL buffer ${bw}x${bh}, tier ${QUALITY}`);
    let started: { ms: number; requested: string[]; log: string[]; cfg: { w: number; h: number; zoom: boolean } };
    try {
      started = await page.evaluate(async ([W, H, pr, q, place]) => {
        const w = window as unknown as { call: (o: string, e: object, t?: Transferable[]) => Promise<unknown>; __off: OffscreenCanvas };
        return w.call("start", { canvas: w.__off, w: W, h: H, pr, quality: q, card: place }, [w.__off]);
      }, [W, H, pr, QUALITY, place] as const) as typeof started;
    } catch (e) {
      console.log(`   did not start:`, (e as Error).message.split("\n").slice(0, 8).join("\n   "));
      console.log("   page errors:", errors.slice(0, 5));
      ok(false, `${place} did not start`);
      await ctx.close();
      continue;
    }
    console.log(`   started in ${started.ms.toFixed(0)} ms; the scene asked for ${started.requested.length} files, canvas ${W}x${H}`);
    started.requested.forEach((u) => allFiles.add(u));
    const missing = started.requested.filter((u) => !THREE_ASSET_URLS.includes(u));
    ok(missing.length === 0, `not bundled in the app (src/three/assetList.ts): ${missing.join(", ")}`);
    ok(stray.size === 0, `404 (not found anywhere): ${Array.from(stray).join(", ")}`);
    if (started.log.length) console.log("   log:", started.log.slice(0, 8));
    const s0 = await st(true);
    ok(s0.frames >= 1, "the scene drew no frame");
    console.log(`   ${s0.frames} frames so far, ${s0.draws} draws counted by the GL`);

    const info = async () => (await run("debugInfo")) as { rotation: number; zoomed: boolean; zoomMix: number; animated: boolean; frames: number };
    const ptr = (type: string, x: number, y: number) => cmd("pointer", { type, x, y });
    // it turns once by itself when it opens
    await sleep(2500);
    const i0 = await info();
    await shot("opened");
    console.log(`   after opening: turned ${i0.rotation.toFixed(2)} rad on its own, ${i0.animated ? "has clips" : "no clips"}, ${i0.frames} frames`);
    // a drag by the website's pointer events: 100 points right turns it by 100 x 0.012 rad
    const r0 = (await info()).rotation;
    await ptr("pointerdown", W / 2, H / 2); await ptr("pointermove", W / 2 + 50, H / 2); await sleep(60); await ptr("pointermove", W / 2 + 100, H / 2);
    const r1 = (await info()).rotation;
    ok(Math.abs(r1 - r0 - 1.2) < 0.25, `a drag of 100 points should turn it about 1.2 rad (turned ${(r1 - r0).toFixed(2)})`);
    await ptr("pointerup", W / 2 + 100, H / 2);
    await sleep(900);
    const r2 = (await info()).rotation;
    console.log(`   dragged: turned ${(r1 - r0).toFixed(2)} rad; after letting go it ${Math.abs(r2 - r1) > 0.01 ? "kept turning" : "stopped"} (${(r2 - r1).toFixed(2)} rad)`);
    await shot("turned");
    // a short tap zooms in (only the cards that have a zoom), another tap comes back
    if (hasZoom) {
      await ptr("pointerdown", W / 2, H / 2); await ptr("pointerup", W / 2, H / 2);
      await sleep(2500);
      const z = await info();
      ok(z.zoomed && z.zoomMix > 0.3, `a tap should zoom in (zoomed ${z.zoomed}, mix ${z.zoomMix.toFixed(2)})`);
      await shot("zoomed");
      await ptr("pointerdown", W / 2, H / 2); await ptr("pointerup", W / 2, H / 2);
      await sleep(2000);
      const back = await info();
      ok(!back.zoomed, "a second tap should zoom out");
    } else {
      const f0 = await info();
      await ptr("pointerdown", W / 2, H / 2); await ptr("pointerup", W / 2, H / 2);
      ok(!(await info()).zoomed, "a card with no zoom must not zoom");
      void f0;
    }
    // at rest it draws nothing new unless it has clips
    await sleep(1500);
    const rest0 = (await info()).frames;
    await sleep(2000);
    const rest1 = (await info()).frames;
    console.log(`   at rest: ${rest1 - rest0} frames in 2 s (${i0.animated ? "it has clips, so it keeps moving" : "nothing moves, so nothing is drawn"})`);
    if (!i0.animated) ok(rest1 - rest0 <= 2, `a reward with no clips drew ${rest1 - rest0} frames at rest`);
    // pause holds every frame, resume goes on
    await cmd("pause");
    await sleep(300);
    const p0 = (await st()).frames;
    await ptr("pointerdown", W / 2, H / 2); await ptr("pointermove", W / 2 + 40, H / 2); await ptr("pointerup", W / 2 + 40, H / 2);
    await sleep(1500);
    const p1 = (await st()).frames;
    await cmd("resume");
    await sleep(2500);
    const p2 = (await st()).frames;
    console.log(`   paused: ${p1 - p0} frames in 1.5 s; resumed: ${p2 - p1} frames in 2.5 s`);
    ok(p1 - p0 <= 1, "frames kept drawing while paused");
    ok(p2 - p1 >= 1, "frames did not come back after resume");

    const fin = await st();
    console.log(`   JS/frame median ${fin.js.median.toFixed(1)} ms p95 ${fin.js.p95.toFixed(1)} ms (${fin.js.n} frames)`);
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

/** The phone's swaps (phone/metro.config.js) for esbuild. */
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
