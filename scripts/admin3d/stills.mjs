#!/usr/bin/env node
/**
 * THE 3D AREA'S CARD STILLS — a real still of every 3D place and every
 * hand-made cut scene, in today's look (Harry, 21 Oct 2026: "I still don't
 * think the new cut scenes are updated on the admin page"). Re-run after any
 * change to how a 3D place or a cut scene looks, and commit the pictures.
 *
 *   node scripts/admin3d/stills.mjs [--base=http://localhost:3084] [--only=places|cuts|previews] [id ...]
 *
 * Writes (webp, small):
 *   public/admin/3d-area/<place>.webp   640 × 400  the Places cards
 *   public/admin/3d-area/cut-<id>.webp  300 × 557  the Cut scenes cards (lib/star/cutscene/sceneList.ts),
 *                                       a phone still (390 × 844) of the scene at CUT_STILL_AT[id], without its letterbox
 *   public/admin/previews/<page>.webp   640 × 400  the 3D places group page's cards (lib/adminPreviews.ts)
 * Needs the dev server running. This machine has no graphics chip: a 3D place takes 10–40 s.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const args = process.argv.slice(2);
const flag = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const BASE = flag("base") ?? "http://localhost:3084";
const ONLY = flag("only");
const ids = args.filter((a) => !a.startsWith("--"));
const want = (group, id) => (!ONLY || ONLY === group) && (!ids.length || ids.includes(id));

// the seconds each cut-scene still is taken at: read from lib/star/cutscene/sceneList.ts (one place)
const listSrc = fs.readFileSync(path.join(ROOT, "lib/star/cutscene/sceneList.ts"), "utf8");
const CUT_AT = Object.fromEntries([...listSrc.match(/export const CUT_STILL_AT[^{]*=\s*\{([^}]*)\}/)[1].matchAll(/(\w+):\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])]));

/** The Places cards: the place full screen (bare), a landscape still. */
const PLACES = [
  { id: "signing", url: "/star-3d-area-dev/signing?bare=1", settle: 20000 },
  { id: "office", url: "/star-3d-area-dev/office?bare=1", settle: 20000 },
  { id: "shop", url: "/star-shop3d-dev?bare=1", settle: 25000 },
  { id: "garden", url: "/star-garden3d-dev?bare=1", settle: 30000 },
  { id: "house", url: "/star-home3d-dev", settle: 25000, sel: "canvas" },
  { id: "training", url: "/star-training3d-dev", settle: 8000 },
  { id: "scene-editor", url: "/star-scene-editor-dev?place=director&scene=signing", settle: 25000, sel: ".se-canvas", seek: 9 },
];
/** The group page's cards (desktop page stills, 1152 × 720). */
const PREVIEWS = [
  { id: "star-3d-area-dev", url: "/star-3d-area-dev", settle: 5000, tab: "cuts" },
  { id: "star-scene-editor-dev", url: "/star-scene-editor-dev?place=director&scene=goal", settle: 25000, seek: 6.5 },
  { id: "star-3d-area-dev-signing", url: "/star-3d-area-dev/signing", settle: 20000 },
  { id: "star-3d-area-dev-office", url: "/star-3d-area-dev/office", settle: 20000 },
  { id: "star-shop3d-dev", url: "/star-shop3d-dev", settle: 25000 },
  { id: "star-garden3d-dev", url: "/star-garden3d-dev", settle: 30000 },
  { id: "star-home3d-dev", url: "/star-home3d-dev", settle: 25000 },
];

const HIDE = "[data-page-guide], .tr-vars, [data-admin-nav] { display: none !important; }";
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "admin3d-"));

/** PNG → webp at a size (python3 + Pillow: crop box first, then resize). */
function webp(png, out, w, h, crop) {
  execFileSync("python3", ["-I", "-c", `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
c = [int(v) for v in sys.argv[5].split(",")] if sys.argv[5] else None
if c: im = im.crop(tuple(c))
im = im.resize((int(sys.argv[3]), int(sys.argv[4])), Image.LANCZOS)
im.save(sys.argv[2], "WEBP", quality=78, method=6)
`, png, out, String(w), String(h), crop ? crop.join(",") : ""]);
  console.log("wrote", path.relative(ROOT, out), `${Math.round(fs.statSync(out).size / 1024)} KB`);
}

async function open(url, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("  pageerror", e.message.slice(0, 200)));
  await page.goto(BASE + url, { waitUntil: "load", timeout: 300000 });
  await page.addStyleTag({ content: HIDE });
  return page;
}
const seekTo = (page, t) => page.waitForFunction(() => !!window.__frameStep, null, { timeout: 240000 })
  .then(() => page.evaluate((t) => window.__frameStep.seek(t), t)).then(() => page.waitForTimeout(800));

for (const p of PLACES) {
  if (!want("places", p.id)) continue;
  const page = await open(p.url, 800, 500);
  await page.waitForTimeout(p.settle);
  if (p.seek !== undefined) await seekTo(page, p.seek).catch(() => console.log("  no frame step on", p.id));
  const png = path.join(tmp, `${p.id}.png`);
  if (p.sel) await page.locator(p.sel).first().screenshot({ path: png }); else await page.screenshot({ path: png });
  const { width, height } = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  // the element shot may not be 16:10: crop its middle to 16:10
  const box = p.sel ? await page.locator(p.sel).first().boundingBox() : { width, height };
  const bw = Math.round(box.width), bh = Math.round(box.height);
  const cw = Math.min(bw, Math.round(bh * 1.6)), ch = Math.round(cw / 1.6);
  webp(png, path.join(ROOT, "public/admin/3d-area", `${p.id}.webp`), 640, 400, [Math.round((bw - cw) / 2), Math.round((bh - ch) / 2), Math.round((bw - cw) / 2) + cw, Math.round((bh - ch) / 2) + ch]);
  await page.close();
}

for (const [id, t] of Object.entries(CUT_AT)) {
  if (!want("cuts", id)) continue;
  const page = await open(`/star-3d-bench-dev/scene?scene=director&fixture=${id}&clean=1`, 390, 844);
  await page.waitForFunction(() => window.__frameStep && window.__styleReady !== false, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  await seekTo(page, t);
  const png = path.join(tmp, `cut-${id}.png`);
  await page.screenshot({ path: png });
  // the phone frame without the scene's black letterbox bars (60 px top and bottom): 390 × 724
  webp(png, path.join(ROOT, "public/admin/3d-area", `cut-${id}.webp`), 300, 557, [0, 60, 390, 784]);
  await page.close();
}

for (const p of PREVIEWS) {
  if (!want("previews", p.id)) continue;
  const page = await open(p.url, 1152, 720);
  if (p.tab) { await page.waitForTimeout(3000); await page.click(`[data-tab=${p.tab}]`); }
  await page.waitForTimeout(p.settle);
  if (p.seek !== undefined) await seekTo(page, p.seek).catch(() => console.log("  no frame step on", p.id));
  const png = path.join(tmp, `${p.id}.png`);
  await page.screenshot({ path: png });
  webp(png, path.join(ROOT, "public/admin/previews", `${p.id}.webp`), 640, 400);
  await page.close();
}
await browser.close();
