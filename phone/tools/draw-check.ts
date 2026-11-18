/**
 * CHECKS THE DRAWING ADAPTER (src/draw) WITHOUT A PHONE.
 *
 *   cd phone && npx tsx tools/draw-check.ts [--out DIR] [--no-browser]
 *
 * 1. Unit checks: CSS colours, canvas fonts, arc sweeps and path commands
 *    (a recorder with no Skia at all).
 * 2. Draws every scene in tools/draw-scenes.ts through src/draw/ctx2d.ts on
 *    real Skia (CanvasKit, the same Skia the phone runs, through the same
 *    JS API react-native-skia gives the app), the way <Drawn/> does.
 * 3. If a Chromium is found (playwright's, or CHROME=path), draws the same
 *    scenes on a real browser canvas — the website — and compares pixel by
 *    pixel. Writes DIR/<scene>.png: browser | phone | difference (x4).
 * Exits 1 if a unit check fails or a scene differs by more than its limit.
 */
import fs from "node:fs";
import path from "node:path";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { parseColor, parseFont, parseFilter } from "../src/draw/css";
import { PathRecorder, arcSweep, IDENTITY, type Mat } from "../src/draw/path";
import { Ctx2D, type FontFor } from "../src/draw/ctx2d";
import { OffscreenCanvas2D, withCanvasDocument, loadedFace } from "../src/draw/offscreen";
import { fitFace, type FittedHead } from "@/lib/star/faceFit";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { badgeSvgFor, svgForSkia } from "../src/draw/badgeSvg";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS,
  NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS, OTHER_CLUBS, CHAMPIONS_LEAGUE_CLUBS,
} from "@/lib/star/clubs";
import { SCENES } from "../src/draw/testScenes";

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "/tmp/draw-check";
let failed = 0;
const ok = (cond: boolean, what: string) => { if (!cond) { failed++; console.log("  FAIL", what); } };
const near = (a: number, b: number, e = 1e-3) => Math.abs(a - b) < e;
const sameRGBA = (s: string, want: number[] | null) => {
  const got = parseColor(s);
  if (want === null) return ok(got === null, `colour ${s} should be rejected, got ${got}`);
  ok(!!got && got.every((v, i) => near(v, want[i], 0.003)), `colour ${s} → ${got} (want ${want})`);
};

// ── 1. Unit checks ──────────────────────────────────────────────────────────
console.log("1. unit checks");
sameRGBA("#fff", [1, 1, 1, 1]);
sameRGBA("#D71920", [215 / 255, 25 / 255, 32 / 255, 1]);
sameRGBA("#00000080", [0, 0, 0, 128 / 255]);
sameRGBA("#f008", [1, 0, 0, 0x88 / 255]);
sameRGBA("rgba(0,0,0,0.55)", [0, 0, 0, 0.55]);
sameRGBA("rgb(255, 128, 0)", [1, 128 / 255, 0, 1]);
sameRGBA("rgb(255 128 0 / 50%)", [1, 128 / 255, 0, 0.5]);
sameRGBA("rgba(100%, 0%, 0%, .25)", [1, 0, 0, 0.25]);
sameRGBA("hsl(120, 100%, 25%)", [0, 0.5, 0, 1]);
sameRGBA("hsla(0 100% 50% / 0.3)", [1, 0, 0, 0.3]);
sameRGBA("hsl(0.5turn 100% 50%)", [0, 1, 1, 1]);
sameRGBA("gold", [1, 215 / 255, 0, 1]);
sameRGBA("RebeccaPurple", [0x66 / 255, 0x33 / 255, 0x99 / 255, 1]);
sameRGBA("transparent", [0, 0, 0, 0]);
sameRGBA("notacolour", null);
sameRGBA("#12345", null);
sameRGBA("rgb(1,2)", null);
{
  const f = parseFont("900 15px system-ui, -apple-system, 'Segoe UI', sans-serif");
  ok(!!f && f.size === 15 && f.weight === 900 && f.family === "system-ui" && f.families.length === 4 && f.families[2] === "Segoe UI", `font 1 ${JSON.stringify(f)}`);
  const g = parseFont("italic bold 12pt/1.4 \"DejaVu Sans\"");
  ok(!!g && near(g.size, 16) && g.weight === 700 && g.italic && g.family === "DejaVu Sans", `font 2 ${JSON.stringify(g)}`);
  ok(parseFont("bogus") === null, "font: rejects bogus");
  ok(parseFilter("blur(4px)")?.blur === 4 && parseFilter("none") === null, "filter blur");
}
ok(near(arcSweep(0, Math.PI * 2, false), Math.PI * 2), "full circle cw");
ok(near(arcSweep(0, -0.5, false), Math.PI * 2 - 0.5), "cw wraps");
ok(near(arcSweep(0, 0.5, true), -(Math.PI * 2 - 0.5)), "ccw wraps");
ok(near(arcSweep(1, 1, false), 0), "zero sweep");
ok(near(arcSweep(Math.PI, 0, true), -Math.PI), "ccw half");
{
  // The path recorder: a fake canvas with no Skia — check the commands it makes.
  const p = new PathRecorder();
  const m: Mat = [2, 0, 0, 2, 10, 20]; // scale 2, then move (10, 20)
  p.moveTo(m, 1, 1); p.lineTo(m, 3, 1); p.quadraticCurveTo(m, 4, 2, 3, 3); p.closePath();
  ok(JSON.stringify(p.cmds) === JSON.stringify([{ k: "M", p: [12, 22] }, { k: "L", p: [16, 22] }, { k: "Q", p: [18, 24, 16, 26] }, { k: "Z" }]), `path cmds ${JSON.stringify(p.cmds)}`);
  p.reset(); p.arc(IDENTITY, 0, 0, 10, 0, Math.PI * 2);
  ok(p.cmds.length === 5 && p.cmds[0].k === "M" && p.cmds.slice(1).every((c) => c.k === "C"), "full arc = move + 4 curves");
  const last = p.cmds[4] as { k: "C"; p: number[] };
  ok(near(last.p[4], 10) && near(last.p[5], 0), "arc ends where it started");
  const mid = p.cmds[1] as { k: "C"; p: number[] };
  ok(near(mid.p[4], 0) && near(mid.p[5], 10), "first quarter ends at (0, 10): clockwise on screen");
  p.reset(); p.lineTo(IDENTITY, 5, 5);
  ok(p.cmds[0].k === "M", "lineTo with no point moves");
  p.reset(); p.moveTo(IDENTITY, 0, 0); p.arc(IDENTITY, 20, 0, 5, Math.PI, 0, false);
  ok(p.cmds[1].k === "L" && near((p.cmds[1] as { p: number[] }).p[0], 15), "arc joins with a line");
  p.reset(); p.rect(IDENTITY, 1, 2, 3, 4);
  ok(p.cmds.map((c) => c.k).join("") === "MLLLZM", `rect ${p.cmds.map((c) => c.k).join("")}`);
  p.reset(); p.roundRect(IDENTITY, 0, 0, 40, 20, 50);
  ok(p.cmds.filter((c) => c.k === "C").length === 4, "roundRect: four corner curves even with a huge radius");
  p.reset(); p.moveTo(IDENTITY, 0, 0); p.arcTo(IDENTITY, 10, 0, 10, 10, 4);
  const end = p.cmds[p.cmds.length - 1] as { p: number[] };
  ok(near(end.p[4], 10) && near(end.p[5], 4), `arcTo ends on the second line at (10, 4): ${end.p}`);
}
{
  // Every club's badge and some flags: the SVG handed to Skia uses only what
  // Skia's SVG reader takes (no rgba()/hsl() colours, plain shapes).
  const clubs = new Set<string>([...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS, ...LEAGUE_ONE_CLUBS, ...LEAGUE_TWO_CLUBS,
    ...NATIONAL_LEAGUE_CLUBS, ...NATIONAL_LEAGUE_NORTH_CLUBS, ...NATIONAL_LEAGUE_SOUTH_CLUBS, ...OTHER_CLUBS, ...CHAMPIONS_LEAGUE_CLUBS,
    "England", "Brazil", "France", "Japan", "Argentina", "Wales"]);
  const allowed = new Set(["svg", "defs", "clipPath", "g", "rect", "path", "circle", "line", "polygon", "ellipse"]);
  let bad = 0, flags = 0;
  for (const c of clubs) {
    const { svg, flag } = badgeSvgFor(c, 28);
    if (flag) flags++;
    const s = svgForSkia(svg);
    const tags = [...s.matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1]);
    const odd = tags.filter((t) => !allowed.has(t));
    if (/rgba?\(|hsla?\(/.test(s) || odd.length) { bad++; if (bad <= 3) console.log(`  badge ${c}: ${odd.join(",")} ${s.match(/rgba?\([^)]*\)/)?.[0] ?? ""}`); }
  }
  ok(bad === 0, `${bad} badge SVGs use something Skia's SVG reader may not take`);
  ok(svgForSkia('<path stroke="rgba(0,0,0,0.35)"/>') === '<path stroke="#000000" stroke-opacity="0.35"/>', "svgForSkia rgba");
  console.log(`   badges: ${clubs.size} clubs/nations (${flags} flags) checked`);
}
console.log(failed ? `   ${failed} failed` : "   all passed");

// ── 2 and 3. Pictures ───────────────────────────────────────────────────────

type Px = { w: number; h: number; data: Uint8Array };

(async () => {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  const fontDir = "/usr/share/fonts/truetype/dejavu";
  const faces = new Map<string, ReturnType<typeof Skia.Typeface.MakeFreeTypeFaceFromData>>();
  const face = (bold: boolean) => {
    const file = path.join(fontDir, bold ? "DejaVuSans-Bold.ttf" : "DejaVuSans.ttf");
    if (!faces.has(file)) faces.set(file, fs.existsSync(file) ? Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(file)))) : null);
    return faces.get(file) ?? null;
  };
  const fontFor: FontFor = (spec) => { const t = face(spec.weight >= 600); return t ? Skia.Font(t, spec.size) : null; };

  // The website's default fake face (public/), fitted to the body by
  // lib/star/faceFit.ts through the adapter's offscreen canvases (pixels read and written).
  const faceBytes = fs.readFileSync(path.join(__dirname, "..", "..", "public", DEFAULT_FAKE_FACE));
  const faceImg = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(faceBytes)));
  let fitted: FittedHead | null = null;
  if (faceImg) fitted = withCanvasDocument(Skia, () => fitFace(loadedFace(DEFAULT_FAKE_FACE, faceImg) as unknown as HTMLImageElement), fontFor);
  ok(!!fitted, "face fit on the phone's offscreen canvases");
  console.log(`   face fit: ${fitted ? `head ${fitted.canvas.width}x${fitted.canvas.height}, skin ${fitted.skin}` : "FAILED"}`);

  /** As <Drawn/> records: `scale` > 1 is its points mode (the device's scale under the drawing). */
  const phone = (s: typeof SCENES[number], offscreen: boolean, scale = 1, prescale = 1): Px => {
    const W = s.w * scale, H = s.h * scale;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    c.saveLayer();
    const ctx = new Ctx2D(Skia, c, scale === 1 ? { width: W, height: H, fontFor } : { width: s.w, height: s.h, fontFor, base: [scale, 0, 0, scale, 0, 0] });
    if (prescale !== 1) ctx.scale(prescale, prescale);
    const env = { fitted, layer: (w: number, h: number) => new OffscreenCanvas2D(Skia, w, h, fontFor) as unknown as HTMLCanvasElement };
    const run = () => s.draw(ctx as unknown as CanvasRenderingContext2D, env);
    if (offscreen) withCanvasDocument(Skia, run, fontFor); else run();
    ctx.reset(); c.restore();
    const pic = rec.finishRecordingAsPicture();
    const surf = Skia.Surface.Make(W, H)!;
    surf.getCanvas().drawPicture(pic);
    surf.flush();
    const data = surf.makeImageSnapshot().readPixels(0, 0, { width: W, height: H, colorType: 4, alphaType: 3 }) as Uint8Array;
    return { w: W, h: H, data };
  };
  const fromPng = (buf: Buffer): Px | null => {
    const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(buf)));
    if (!img) return null;
    const w = img.width(), h = img.height();
    return { w, h, data: img.readPixels(0, 0, { width: w, height: h, colorType: 4, alphaType: 3 }) as Uint8Array };
  };
  // Over a mid grey, so a difference in see-through areas shows too.
  const over = (d: Uint8Array, i: number) => { const a = d[i + 3] / 255; return [0, 1, 2].map((k) => d[i + k] * a + 128 * (1 - a)); };
  const compare = (a: Px, b: Px) => {
    let big = 0, sum = 0;
    const n = a.w * a.h, diff = new Uint8Array(n * 4);
    for (let i = 0; i < n * 4; i += 4) {
      const x = over(a.data, i), y = over(b.data, i);
      const d = Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
      sum += d; if (d > 32) big++;
      const v = Math.min(255, d * 4); diff[i] = v; diff[i + 1] = v; diff[i + 2] = v; diff[i + 3] = 255;
    }
    return { bigShare: big / n, mean: sum / n, diff };
  };
  const savePng = (file: string, parts: Px[]) => {
    const W = parts.reduce((s, p) => s + p.w + 8, -8), H = Math.max(...parts.map((p) => p.h));
    const surf = Skia.Surface.Make(W, H)!;
    const c = surf.getCanvas();
    c.drawColor(Skia.Color("#808080"));
    let x = 0;
    for (const p of parts) {
      const img = Skia.Image.MakeImage({ width: p.w, height: p.h, colorType: 4, alphaType: 3 }, Skia.Data.fromBytes(p.data), p.w * 4);
      if (img) c.drawImage(img, x, 0);
      x += p.w + 8;
    }
    surf.flush();
    fs.writeFileSync(file, Buffer.from(surf.makeImageSnapshot().encodeToBytes()));
  };

  fs.mkdirSync(OUT, { recursive: true });
  console.log("2. scenes on Skia (CanvasKit) through the adapter");
  const phonePx = new Map<string, { off: Px; vec: Px }>();
  for (const s of SCENES) {
    try {
      const off = phone(s, true), vec = s.offscreen ? off : phone(s, false);
      const painted = off.data.some((v, i) => i % 4 === 3 && v > 0);
      ok(painted, `${s.name}: drew something`);
      phonePx.set(s.name, { off, vec });
      console.log(`   ${s.name.padEnd(20)} ok${painted ? "" : " (EMPTY)"}`);
    } catch (e) { failed++; console.log(`   ${s.name.padEnd(20)} THREW ${(e as Error).stack?.split("\n").slice(0, 3).join(" | ")}`); }
  }
  // Points mode (<Drawn/>'s default on a 3x phone): the drawing in points with the
  // device scale underneath must equal the same drawing simply scaled up 3x.
  for (const name of ["head-chip-0", "figure-3d", "match-ball"]) {
    const s = SCENES.find((x) => x.name === name)!;
    const a = phone(s, true, 3);
    const c = phone({ ...s, w: s.w * 3, h: s.h * 3 }, true, 1, 3);
    const d = compare(a, c);
    ok(d.bigShare < 0.01, `${name}: points mode at 3x differs from a plain 3x drawing (${(d.bigShare * 100).toFixed(2)}%)`);
    console.log(`   ${(name + " @3x").padEnd(20)} points mode vs plain 3x: ${(d.bigShare * 100).toFixed(2)}% big-diff px`);
  }

  if (args.includes("--no-browser")) return finish();
  const chrome = process.env.CHROME ?? findChrome();
  const esbuild = findEsbuild();
  if (!chrome || !esbuild) { console.log(`3. browser comparison skipped (chrome: ${chrome ?? "not found"}, esbuild: ${esbuild ? "found" : "not found"})`); return finish(); }
  console.log("3. the same scenes on a real browser canvas (the website), compared");
  const eb = require(esbuild) as typeof import("esbuild");
  const bundle = await eb.build({
    entryPoints: [path.join(__dirname, "draw-browser-entry.ts")], bundle: true, format: "iife", write: false,
    tsconfig: path.join(__dirname, "..", "tsconfig.json"), platform: "browser", logLevel: "error",
  });
  const { chromium } = require(require.resolve("playwright", { paths: [path.join(__dirname, "..", "..")] })) as typeof import("playwright");
  const browser = await chromium.launch({ executablePath: chrome, args: ["--force-device-scale-factor=1", "--font-render-hinting=none"] });
  const page = await browser.newPage();
  await page.setContent("<html><body></body></html>");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const urls = await page.evaluate((u) => (window as unknown as { __drawScenes: (u: string) => Promise<Record<string, string>> }).__drawScenes(u), "data:image/png;base64," + faceBytes.toString("base64"));
  await browser.close();
  // Text is drawn with different font engines on each side; the rest should match.
  const LIMIT: Record<string, number> = { "api-basics": 0.03, "figure-3d": 0.03,"hero-a2": 0.02, "hero-a2-celebrate": 0.02, "hero-back": 0.03, "hero-a1": 0.02, "hero-a2-fitted": 0.02, "hero-back-fitted": 0.03 };
  console.log("   scene                 big-diff px (phone default | no document)   mean diff /255");
  for (const s of SCENES) {
    const u = urls[s.name];
    const ph = phonePx.get(s.name);
    if (!u || u.startsWith("error:") || !ph) { console.log(`   ${s.name.padEnd(20)} browser: ${u?.slice(0, 80) ?? "none"}`); failed++; continue; }
    const web = fromPng(Buffer.from(u.split(",")[1], "base64"));
    if (!web) { failed++; continue; }
    const a = compare(web, ph.off), b = compare(web, ph.vec);
    const lim = LIMIT[s.name] ?? 0.01;
    const pass = a.bigShare <= lim;
    if (!pass) failed++;
    console.log(`   ${s.name.padEnd(20)} ${(a.bigShare * 100).toFixed(2).padStart(6)}% | ${(b.bigShare * 100).toFixed(2).padStart(6)}%   ${a.mean.toFixed(2).padStart(6)}   ${pass ? "ok" : `OVER ${lim * 100}%`}`);
    savePng(path.join(OUT, `${s.name}.png`), [web, ph.off, { w: web.w, h: web.h, data: a.diff }]);
  }
  console.log(`   pictures: ${OUT}/<scene>.png  (website | phone | difference x4)`);
  finish();
})().catch((e) => { console.error(e); process.exit(1); });

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
  return null;
}
/** esbuild is only a tool here (tsx brings one); look for it rather than add a package. */
function findEsbuild(): string | null {
  try { return require.resolve("esbuild"); } catch { /* look further */ }
  const npx = path.join(process.env.HOME ?? "/root", ".npm/_npx");
  if (fs.existsSync(npx)) for (const d of fs.readdirSync(npx)) {
    const f = path.join(npx, d, "node_modules/esbuild");
    if (fs.existsSync(f)) return f;
  }
  return null;
}
