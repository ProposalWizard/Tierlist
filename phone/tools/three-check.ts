/**
 * CHECKS THE PHONE'S 3D (src/three) WITHOUT A PHONE.
 *
 *   cd phone && npx tsx tools/three-check.ts [--out DIR] [--no-browser] [--frames N]
 *
 * 1. Files: every 3D file the phone bundles (src/three/assetList.ts) is in
 *    phone/assets/3d and is byte-for-byte the website's (public/).
 * 2. Decoder: every meshopt-packed part of those files, unpacked by the
 *    phone's plain-JavaScript decoder (src/three/meshoptDecoder.ts) and by
 *    three's WebAssembly decoder (the website's), must give the same bytes.
 * 3. If a Chromium is found (playwright's, or CHROME=path): the Home player,
 *    the guard of honour and the standing ovation are drawn twice on a real
 *    WebGL2 canvas, once through the phone's path and once through the
 *    website's, and compared pixel by pixel; the phone path's per-frame
 *    JavaScript time, draw calls and triangles are printed. Every file the
 *    phone path asked for must be bundled. Writes DIR/<scene>.png:
 *    website | phone | difference (x4).
 *    The machine has no graphics chip (SwiftShader draws on the processor):
 *    read times as relative, not as a phone's.
 * Exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { MeshoptDecoderJS } from "../src/three/meshoptDecoder";
import { THREE_ASSET_URLS } from "../src/three/assetList";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : path.join(process.env.TMPDIR ?? "/tmp", "three-check");
const FRAMES = args.includes("--frames") ? Number(args[args.indexOf("--frames") + 1]) : 120;
const PHONE = path.join(__dirname, "..");
const ROOT = path.join(PHONE, "..");
let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.log(`   FAIL ${what}`); } };

(async () => {
  console.log("1. bundled 3D files");
  let total = 0;
  // two kinds of copy differ from the website's file on purpose: Draco files unpacked for the phone
  // (tools/garden-props-unpack.mjs), and a .json kept as .bin (the bundler would read .json as code)
  const UNPACKED = (u: string) => u === "/star/garden3d/props.glb" || /^\/star\/shop3d\/items\/car-[^/]+\.glb$/.test(u);
  for (const u of THREE_ASSET_URLS) {
    const mine = path.join(PHONE, "assets/3d", u.replace(/^\/star\//, "").replace(/\.json$/, ".bin"));
    const web = path.join(ROOT, "public", u);
    const has = fs.existsSync(mine);
    ok(has, `${u} not in phone/assets/3d`);
    if (!has) continue;
    total += fs.statSync(mine).size;
    if (!UNPACKED(u)) ok(fs.readFileSync(mine).equals(fs.readFileSync(web)), `${u} differs from the website's copy`);
  }
  console.log(`   ${THREE_ASSET_URLS.length} files, ${(total / 1024).toFixed(0)} KB`);

  console.log("2. meshopt: the phone's decoder vs three's WebAssembly decoder");
  const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
  await MeshoptDecoder.ready;
  let parts = 0, bytes = 0, jsMs = 0, wasmMs = 0;
  for (const u of THREE_ASSET_URLS) {
    if (!u.endsWith(".glb")) continue;
    const buf = fs.readFileSync(path.join(ROOT, "public", u));
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
    const binStart = 20 + jsonLen + 8;
    const bin = new Uint8Array(buf.buffer, buf.byteOffset + binStart, buf.readUInt32LE(20 + jsonLen));
    for (const bv of json.bufferViews ?? []) {
      const ext = bv.extensions?.EXT_meshopt_compression;
      if (!ext) continue;
      if ((ext.buffer ?? 0) !== 0) continue;
      const src = bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength);
      const a = new Uint8Array(ext.count * ext.byteStride), b = new Uint8Array(ext.count * ext.byteStride);
      let t = performance.now();
      MeshoptDecoderJS.decodeGltfBuffer(a, ext.count, ext.byteStride, src, ext.mode, ext.filter);
      jsMs += performance.now() - t;
      t = performance.now();
      MeshoptDecoder.decodeGltfBuffer(b, ext.count, ext.byteStride, src, ext.mode, ext.filter);
      wasmMs += performance.now() - t;
      parts++; bytes += a.length;
      if (!Buffer.from(a).equals(Buffer.from(b))) {
        let diff = 0;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
        ok(false, `${u}: ${ext.mode} ${ext.filter ?? ""} part differs in ${diff} of ${a.length} bytes`);
      }
    }
  }
  console.log(`   ${parts} packed parts, ${(bytes / 1024).toFixed(0)} KB unpacked: JS ${jsMs.toFixed(1)} ms, WebAssembly ${wasmMs.toFixed(1)} ms (this machine)`);

  const esbuildAt = findEsbuild();
  if (esbuildAt && !args.includes("--no-interp")) {
    console.log("2b. with no JIT (node --jitless: an interpreter, like the phone's Hermes)");
    const eb0 = require(esbuildAt) as typeof import("esbuild");
    const out = path.join(PHONE, ".tmpcheck", "three-interp-bench.cjs");
    await eb0.build({
      entryPoints: [path.join(__dirname, "three-interp-bench.ts")], bundle: true, platform: "node", format: "cjs", outfile: out,
      tsconfig: path.join(PHONE, "tsconfig.json"), logLevel: "error", plugins: [aliasPlugin("phone")],
      nodePaths: [path.join(PHONE, "node_modules"), path.join(ROOT, "node_modules")],
      external: ["react-native", "react-native-mmkv", "@shopify/react-native-skia"],
    });
    const r = require("node:child_process").spawnSync(process.execPath, ["--jitless", out], { encoding: "utf8" });
    for (const line of `${r.stdout}${r.stderr}`.trim().split("\n")) if (!line.startsWith("Warning:")) console.log("   " + line);
    ok(r.status === 0, "the no-JIT run failed");
    fs.rmSync(out, { force: true });
  }

  if (args.includes("--no-browser")) return finish();
  const chrome = process.env.CHROME ?? findChrome();
  const esbuild = findEsbuild();
  if (!chrome || !esbuild) { console.log(`3. browser check skipped (chrome: ${chrome ?? "not found"}, esbuild: ${esbuild ? "found" : "not found"})`); return finish(); }
  console.log("3. the same scenes through the phone's path and the website's, on a real WebGL2 canvas");
  const eb = require(esbuild) as typeof import("esbuild");
  const bundle = async (mode: "phone" | "web") => {
    const alias = aliasPlugin(mode);
    const r = await eb.build({
      entryPoints: [path.join(__dirname, "three-browser-entry.ts")], bundle: true, format: "iife", write: false,
      tsconfig: path.join(PHONE, "tsconfig.json"), platform: "browser", logLevel: "error", plugins: [alias],
      define: { __MODE__: JSON.stringify(mode), "process.env.NODE_ENV": '"production"' },
      nodePaths: [path.join(PHONE, "node_modules"), path.join(ROOT, "node_modules")],
      external: ["fs", "path"],
    });
    return r.outputFiles[0].text;
  };
  const [phoneJs, webJs] = await Promise.all([bundle("phone"), bundle("web")]);
  const { chromium } = require(require.resolve("playwright", { paths: [ROOT] })) as typeof import("playwright");
  const browser = await chromium.launch({ executablePath: chrome, args: ["--force-device-scale-factor=1", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const served: Record<string, Set<string>> = { phone: new Set(), web: new Set() };
  const run = async (js: string, who: "phone" | "web") => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("   page error:", e.message));
    await page.route("http://kib.test/**", (route) => {
      const u = new URL(route.request().url());
      served[who].add(decodeURIComponent(u.pathname));
      if (u.pathname === "/") return route.fulfill({ contentType: "text/html", body: "<html><body style='margin:0;background:#000'></body></html>" });
      if (u.pathname === "/font-bold.ttf") return route.fulfill({ body: fs.readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf") });
      if (u.pathname === "/canvaskit.wasm") return route.fulfill({ contentType: "application/wasm", body: fs.readFileSync(path.join(PHONE, "node_modules/canvaskit-wasm/bin/full/canvaskit.wasm")) });
      const f = path.join(ROOT, "public", decodeURIComponent(u.pathname));
      if (fs.existsSync(f)) return route.fulfill({ body: fs.readFileSync(f) });
      return route.fulfill({ status: 404, body: "" });
    });
    await page.goto("http://kib.test/");
    await page.addScriptTag({ content: js });
    await page.evaluate(() => (window as unknown as { __three: { ready: Promise<void> } }).__three.ready);
    return page;
  };
  const phonePage = await run(phoneJs, "phone"), webPage = await run(webJs, "web");
  const Skia = await skia();
  const fromUrl = (u: string) => {
    const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(Buffer.from(u.split(",")[1], "base64"))))!;
    const w = img.width(), h = img.height();
    return { w, h, data: img.readPixels(0, 0, { width: w, height: h, colorType: 4, alphaType: 3 } as never) as Uint8Array };
  };
  fs.mkdirSync(OUT, { recursive: true });
  const compare = (name: string, a: string, b: string, limit: number) => {
    const A = fromUrl(a), B = fromUrl(b);
    let big = 0, sum = 0;
    const diff = new Uint8Array(A.data.length);
    for (let i = 0; i < A.data.length; i += 4) {
      let d = 0;
      for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(A.data[i + k] - B.data[i + k]));
      sum += d; if (d > 24) big++;
      diff[i] = diff[i + 1] = diff[i + 2] = Math.min(255, d * 4); diff[i + 3] = 255;
    }
    const share = big / (A.data.length / 4);
    ok(share <= limit, `${name}: ${(share * 100).toFixed(2)}% of pixels differ (limit ${limit * 100}%)`);
    savePng(Skia, path.join(OUT, `${name}.png`), [A, B, { w: A.w, h: A.h, data: diff }]);
    return { share, mean: sum / (A.data.length / 4) };
  };
  type HomeRes = { png: string; buildMs: number; firstMs: number; js: number[]; calls: number; triangles: number };
  type FareRes = { png: string; buildMs: number; seekMs: number; live: number[]; calls: number; triangles: number };
  const W = 287, H = 340;
  const ph = await phonePage.evaluate(([w, h, f]) => (window as unknown as { __three: { home: (w: number, h: number, f: number) => Promise<unknown> } }).__three.home(w, h, f), [W, H, FRAMES]) as HomeRes;
  const wb = await webPage.evaluate(([w, h, f]) => (window as unknown as { __three: { home: (w: number, h: number, f: number) => Promise<unknown> } }).__three.home(w, h, f), [W, H, FRAMES]) as HomeRes;
  // edges only differ: the website's canvas is multisampled, the phone's GL view is not
  const c = compare("home", wb.png, ph.png, 0.03);
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];
  console.log(`   home (${W}x${H} px): ${(c.share * 100).toFixed(2)}% px differ, mean ${c.mean.toFixed(2)}/255`);
  console.log(`     phone path: build ${ph.buildMs.toFixed(0)} ms, first frame ${ph.firstMs.toFixed(0)} ms, then per frame JS median ${med(ph.js).toFixed(2)} ms, 95% ${p95(ph.js).toFixed(2)} ms; ${ph.calls} draw calls, ${ph.triangles} triangles`);
  console.log(`     website path: build ${wb.buildMs.toFixed(0)} ms, per frame JS median ${med(wb.js).toFixed(2)} ms; ${wb.calls} draw calls, ${wb.triangles} triangles`);
  for (const [which, at] of [["guard", 6], ["ovation", 5]] as const) {
    const fw = 360, fh = 640;
    const a = await webPage.evaluate(([k, w, h, t]) => (window as unknown as { __three: { farewell: (k: string, w: number, h: number, t: number) => Promise<unknown> } }).__three.farewell(k as string, w as number, h as number, t as number), [which, fw, fh, at]) as FareRes;
    const b = await phonePage.evaluate(([k, w, h, t]) => (window as unknown as { __three: { farewell: (k: string, w: number, h: number, t: number) => Promise<unknown> } }).__three.farewell(k as string, w as number, h as number, t as number), [which, fw, fh, at]) as FareRes;
    // a second build, left to run on its own for 3 seconds (the still above is stepped, not lived)
    b.live = ((await phonePage.evaluate(([k, w, h]) => (window as unknown as { __three: { farewell: (k: string, w: number, h: number, t: number) => Promise<unknown> } }).__three.farewell(k as string, w as number, h as number, -1), [which, fw, fh])) as FareRes).live;
    // edges only (the website's canvas is multisampled, the phone's GL view is not; with both
    // multisampled the pictures were identical, 0.00%, 18 Nov 2026)
    const r = compare(which, a.png, b.png, 0.05);
    console.log(`   ${which} (${fw}x${fh} px, t=${at}s): ${(r.share * 100).toFixed(2)}% px differ, mean ${r.mean.toFixed(2)}/255`);
    console.log(`     phone path: build ${b.buildMs.toFixed(0)} ms; its own loop drew ${b.live.length} frames in 3 s, JS per frame median ${med(b.live).toFixed(2)} ms, 95% ${p95(b.live).toFixed(2)} ms; ${b.calls} draw calls, ${b.triangles} triangles (website: ${a.calls}, ${a.triangles})`);
  }
  for (const frame of ["head", "card"] as const) {
    type HsRes = { pngs: string[]; ms: number[] };
    const a = await webPage.evaluate((f) => (window as unknown as { __three: { headshot: (f: string) => Promise<unknown> } }).__three.headshot(f), frame) as HsRes;
    const b = await phonePage.evaluate((f) => (window as unknown as { __three: { headshot: (f: string) => Promise<unknown> } }).__three.headshot(f), frame) as HsRes;
    a.pngs.forEach((u, i) => {
      if (!u || !b.pngs[i]) { ok(false, `headshot ${frame} ${i}: ${u ? "" : "website "}${b.pngs[i] ? "" : "phone "}made none`); return; }
      // edges only: the website smooths them with 4 samples, the phone by drawing twice the size and halving
      const r = compare(`headshot-${frame}-${i}`, u, b.pngs[i], 0.03);
      console.log(`   headshot ${frame} #${i}: ${(r.share * 100).toFixed(2)}% px differ, mean ${r.mean.toFixed(2)}/255; phone ${b.ms[i].toFixed(0)} ms (website ${a.ms[i].toFixed(0)} ms, first includes loading)`);
    });
  }
  const asked = await phonePage.evaluate(() => (window as unknown as { __three: { urls: () => string[] } }).__three.urls());
  for (const u of asked) ok(THREE_ASSET_URLS.includes(u.split("?")[0]), `the phone asked for ${u}, which is not bundled (src/three/assetList.ts)`);
  // anything fetched NOT through the phone's file reader (a TextureLoader, a fetch) would find nothing on a phone
  const stray = Array.from(served.phone).filter((p) => !["/", "/canvaskit.wasm", "/font-bold.ttf"].includes(p) && !THREE_ASSET_URLS.includes(p));
  ok(stray.length === 0, `the phone path fetched files outside the app: ${stray.join(", ")}`);
  console.log(`   files the phone path asked for: ${asked.join(", ")}`);
  const ms = await phonePage.evaluate(() => (window as unknown as { __three: { meshopt: () => { parts: number; bytes: number; ms: number } } }).__three.meshopt());
  ok(ms.parts > 0, "the phone path never used the phone's meshopt decoder");
  console.log(`   the phone's decoder unpacked ${ms.parts} parts (${(ms.bytes / 1024).toFixed(0)} KB) in ${ms.ms.toFixed(0)} ms (browser JIT; Hermes on a phone is slower)`);
  await browser.close();
  console.log(`   pictures: ${OUT}/<scene>.png  (website | phone | difference x4)`);
  finish();
})().catch((e) => { console.error(e); process.exit(1); });

/** The phone's two swaps (phone/metro.config.js) for esbuild; "web" points src/three back at the website's own files. */
function aliasPlugin(mode: "phone" | "web"): import("esbuild").Plugin {
  return {
    name: "kib-three",
    setup(b) {
      const here = (p: string) => path.join(PHONE, "src/three", p);
      // the same rule as phone/metro.config.js: every import of lib/star/three3d/meshopt
      b.onResolve({ filter: /(^|\/)meshopt$/ }, (a) => {
        if (mode !== "phone") return undefined;
        const abs = a.path.startsWith("@/") ? path.join(ROOT, a.path.slice(2)) : a.path.startsWith(".") ? path.resolve(a.resolveDir, a.path) : "";
        return abs === path.join(ROOT, "lib/star/three3d/meshopt") ? { path: here("meshopt.ts") } : undefined;
      });
      b.onResolve({ filter: /^three\/examples\/jsm\/loaders\/GLTFLoader\.js$/ }, (a) => (mode === "phone" && !a.importer.endsWith(path.join("src/three/GLTFLoader.ts")) ? { path: here("GLTFLoader.ts") } : undefined));
      b.onResolve({ filter: /^\.\/(GLTFLoader|meshopt)$/ }, (a) => {
        if (mode !== "web" || !a.importer.startsWith(path.join(PHONE, "src/three"))) return undefined;
        return a.path === "./meshopt" ? { path: path.join(ROOT, "lib/star/three3d/meshopt.ts") } : { path: require.resolve("three/examples/jsm/loaders/GLTFLoader.js", { paths: [ROOT] }) };
      });
      b.onResolve({ filter: /^three$/ }, () => ({ path: require.resolve("three", { paths: [ROOT] }) }));
    },
  };
}

async function skia() {
  const CanvasKitInit = (await import("canvaskit-wasm/bin/full/canvaskit.js")).default as unknown as (o: object) => Promise<unknown>;
  const { JsiSkApi } = await import("@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia");
  return JsiSkApi((await CanvasKitInit({})) as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
}
function savePng(Skia: typeof import("@shopify/react-native-skia").Skia, file: string, parts: { w: number; h: number; data: Uint8Array }[]) {
  const W = parts.reduce((a, p) => a + p.w, 0), H = Math.max(...parts.map((p) => p.h));
  const surf = Skia.Surface.Make(W, H)!;
  const cv = surf.getCanvas();
  cv.clear(Skia.Color("#202428"));
  let x = 0;
  for (const p of parts) {
    const img = Skia.Image.MakeImage({ width: p.w, height: p.h, colorType: 4, alphaType: 3 } as never, Skia.Data.fromBytes(p.data), p.w * 4)!;
    cv.drawImage(img, x, 0);
    x += p.w;
  }
  surf.flush();
  const png = surf.makeImageSnapshot().encodeToBytes();
  fs.writeFileSync(file, Buffer.from(png));
}
function finish() {
  console.log(failed ? `\n${failed} problem(s)` : "\nall good");
  process.exit(failed ? 1 : 0);
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
  return fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : null;
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
