/**
 * THE 3D BENCH'S STILLS AND NUMBERS — every shot in lib/star/bench3d.ts at
 * phone size (390 × 844): a still, the frame numbers (window.__frame3d) and the
 * skin (the toon skin probe paints bare skin magenta; the still's own pixels
 * under it are measured: hue and saturation, against the 8 skin tones a player
 * can pick, whose hue is 23–31°).
 *
 *   npx tsx scripts/bench3d/shots.mts --out=DIR --tag=after [--old] [--base=http://localhost:3027] [id ...]
 * --old: each shot as it was on 19 Oct 2026 (old skin, old cut-scene cameras, still faces).
 *
 * Writes DIR/<id>-<tag>.jpg (≤ 200 KB) and DIR/bench-<tag>.json. Needs the dev
 * server running. This machine has no graphics chip: the frame numbers compare
 * shots and before/after, never a phone.
 */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { BENCH3D_SHOTS, benchUrl } from "../../lib/star/bench3d";

const args = process.argv.slice(2);
const flag = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const OUT = path.resolve(flag("out") ?? "bench3d-out");
const TAG = flag("tag") ?? "now";
const BASE = flag("base") ?? "http://localhost:3027";
const OLD = args.includes("--old") || args.includes("--old-skin");
const ids = args.filter((a) => !a.startsWith("--"));
const shots = ids.length ? BENCH3D_SHOTS.filter((s) => ids.includes(s.id)) : BENCH3D_SHOTS;
fs.mkdirSync(OUT, { recursive: true });

const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

/** Hue/saturation of the still's pixels under the probe's magenta (both screenshots, PNG). */
async function skinStats(page: Page, still: Buffer, probe: Buffer) {
  return page.evaluate(async ([a, b]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const get = (img: HTMLImageElement) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d")!; x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
    const A = get(ia), B = get(ib), W = A.width, H = A.height;
    // magenta in the probe (three's own ACES lets some green in: pink), and far bluer than the still there (skin has little blue)
    const mag = (i: number) => B.data[i] > 150 && B.data[i + 2] > 150 && B.data[i + 1] < 0.75 * Math.min(B.data[i], B.data[i + 2]) && B.data[i + 2] - A.data[i + 2] > 60;
    const hues: number[] = [], sats: number[] = [], vals: number[] = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      if (!mag(i) || !mag(i - 4) || !mag(i + 4) || !mag(i - W * 4) || !mag(i + W * 4)) continue;
      const r = A.data[i] / 255, g = A.data[i + 1] / 255, bl = A.data[i + 2] / 255;
      const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl), d = mx - mn;
      if (mx < 0.08) continue;
      let h = 0;
      if (d > 1e-6) h = mx === r ? 60 * (((g - bl) / d) % 6) : mx === g ? 60 * ((bl - r) / d + 2) : 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
      if (h > 300) h -= 360; // a pinkish red reads as just under 0
      hues.push(h); sats.push(mx > 0 ? d / mx : 0); vals.push(mx);
    }
    const q = (v: number[], p: number) => { if (!v.length) return null; const s = [...v].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3); };
    const share = (f: (h: number) => boolean) => (hues.length ? +(hues.filter(f).length / hues.length).toFixed(3) : null);
    return {
      pixels: hues.length,
      hue: { p25: q(hues, 0.25), median: q(hues, 0.5), p75: q(hues, 0.75) },
      sat: { median: q(sats, 0.5) }, val: { median: q(vals, 0.5) },
      /** Hue over 36°: yellow (the picked tones are 23–31°). */
      yellow: share((h) => h > 36),
      /** Hue under 14°: red-orange. */
      red: share((h) => h < 14),
      natural: share((h) => h >= 14 && h <= 36),
    };
  }, [`data:image/png;base64,${still.toString("base64")}`, `data:image/png;base64,${probe.toString("base64")}`] as const);
}

const results: Record<string, unknown>[] = [];
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  // tsx keeps function names with a helper the page does not have
  await page.addInitScript({ content: "window.__name = (f) => f;" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/CERT_AUTHORITY|favicon|404/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  const url = BASE + benchUrl(s, { old: OLD });
  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: "load", timeout: 300000 });
    if (s.kind === "cut") {
      await page.waitForFunction(() => (window as never as { __frameStep?: unknown; __cutsceneDebug?: unknown }).__frameStep && (window as never as { __cutsceneDebug?: unknown }).__cutsceneDebug, null, { timeout: 400000 });
      await page.waitForTimeout(4000);
    } else {
      await page.waitForFunction(() => { const f = (window as never as { __frame3d?: { frames: number } }).__frame3d; return !!f && f.frames >= 3; }, null, { timeout: 400000 });
      await page.waitForTimeout(s.settle ?? 6000);
    }
    const frame = await page.evaluate(() => (window as never as { __frame3d?: unknown }).__frame3d ?? null);
    const seek = async () => { if (s.t !== undefined) { await page.evaluate((t) => (window as never as { __frameStep: { seek(t: number): void } }).__frameStep.seek(t), s.t); await page.waitForTimeout(400); } };
    // the stills without the test page's own buttons (team chat, the page guide's eye, the frame meter)
    await page.addStyleTag({ content: ".tr-fab,.tr-pop,[data-page-guide],[data-frame-meter]{display:none!important}" });
    await seek();
    const still = await page.screenshot({ type: "png" });
    await page.screenshot({ path: path.join(OUT, `${s.id}-${TAG}.jpg`), type: "jpeg", quality: 82 });
    await page.evaluate(() => (window as never as { __toonSkin?: { probe(on: boolean): void } }).__toonSkin?.probe(true));
    if (s.t !== undefined) await seek(); else await page.waitForTimeout(3500);
    const probe = await page.screenshot({ type: "png" });
    await page.evaluate(() => (window as never as { __toonSkin?: { probe(on: boolean): void } }).__toonSkin?.probe(false));
    const skin = await skinStats(page, still, probe);
    const r = { id: s.id, label: s.label, url, secs: Math.round((Date.now() - t0) / 1000), frame, skin, errors: errors.slice(0, 5) };
    results.push(r);
    console.log(`${s.id.padEnd(11)} skin hue ${skin.hue.median}° (${skin.hue.p25}–${skin.hue.p75}) sat ${skin.sat.median} yellow ${skin.yellow} px ${skin.pixels}  ${frame ? `fps ${(frame as { fps: number }).fps.toFixed(1)} draws ${(frame as { draws: number }).draws}` : "no frame numbers"}  ${errors.length ? "ERRORS " + errors[0] : ""}`);
  } catch (e) {
    console.log(`${s.id.padEnd(11)} FAILED ${(e as Error).message.slice(0, 200)}`);
    results.push({ id: s.id, url, failed: (e as Error).message.slice(0, 300), errors });
  }
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, `bench-${TAG}.json`), JSON.stringify({ tag: TAG, oldSkin: OLD, at: new Date().toISOString(), shots: results }, null, 1));
console.log(`wrote ${path.join(OUT, `bench-${TAG}.json`)}`);
