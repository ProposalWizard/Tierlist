#!/usr/bin/env node
/**
 * THE LOADING SCREENS' BACKDROPS — a real still of each place you can be
 * loading into, taken from the game's own 3D (Harry, 27 Nov 2026: loading
 * screens "must match the section you're going into"; "make sure the 3D looks
 * really good"). The loading screen (components/star/loading/) never runs 3D
 * itself: it would slow the very load it covers. It shows these.
 *
 *   node scripts/loading-stills/shoot.mjs [--base=http://localhost:3000] [id ...]
 *
 * Writes public/star/loading/<id>.webp, 540 × 1170 (a phone at 390 × 844,
 * a touch sharper), small. Needs the dev server. No graphics chip here: a
 * place takes 10–40 s. Re-run after a place's look changes and commit them.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const args = process.argv.slice(2);
const flag = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const BASE = flag("base") ?? "http://localhost:3000";
const ids = args.filter((a) => !a.startsWith("--"));
const OUT = path.join(ROOT, "public/star/loading");
fs.mkdirSync(OUT, { recursive: true });

/** ready(): the place is drawn. click: a dev-page button to press first (and wait again). */
// nobody: the place on its own. The loading screen is a still of WHERE you are going; a stand-in
// footballer in someone else's kit or clothes in it would not be you (and the ball is in front).
const SHOTS = [
  { id: "garden-day", url: "/star-garden3d-dev?bare=1", settle: 9000, nobody: true },
  { id: "garden-sunset", url: "/star-garden3d-dev?bare=1", click: "sunset", settle: 9000, nobody: true },
  { id: "garden-night", url: "/star-garden3d-dev?bare=1", click: "night", settle: 9000, nobody: true },
  { id: "house", url: "/star-home3d-dev?bare=1", settle: 9000, nobody: true },
  { id: "shop", url: "/star-shop3d-dev?bare=1", settle: 9000, nobody: true },
  { id: "casino", url: "/star-garden3d-dev?place=casino", settle: 12000, nobody: true },
  // the gym (world kit): a fixed camera from the far corner, eye height, across the kit to the mirror wall
  { id: "gym", url: "/star-world3d-dev?place=gym&bare=1&clean=1", settle: 9000, nobody: true, cam: [[4.3, 1.7, 3.7], [-1.2, 1.1, -2.6]] },
  // the shopping street: a fixed camera in the road at the bottom of the street, looking up it to the shops
  { id: "street", url: "/star-street-dev?bare=1", settle: 9000, nobody: true, streetCam: [[-0.8, 2.0, 21.0], [2.0, 3.3, -6]] },
  // the walk-out cut scene (lib/star/cutscene/fixtures.ts walkout): its wide shots, where no face or kit is close
  { id: "tunnel-1", url: "/star-3d-bench-dev/scene?scene=director&fixture=walkout&clean=1", seek: 0.3 },
  { id: "tunnel-2", url: "/star-3d-bench-dev/scene?scene=director&fixture=walkout&clean=1", seek: 1.3 },
];

// Only the 3D picture: every word, stick and button hidden.
const HIDE = "body * { visibility: hidden !important; } canvas { visibility: visible !important; } [data-kib-curtain] { display: none !important; }";
const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"] });
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "loadstills-"));

function webp(png, out) {
  execFileSync("python3", ["-I", "-c", `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB").resize((540, 1170), Image.LANCZOS)
im.save(sys.argv[2], "WEBP", quality=58, method=6)
`, png, out]);
  console.log("wrote", path.relative(ROOT, out), `${Math.round(fs.statSync(out).size / 1024)} KB`);
}

const drawn = (page) => page.waitForFunction(() => {
  const c = document.querySelector("canvas");
  if (!c || c.width < 100) return false;
  const t = document.body.innerText;
  // the place is built when its loading screen has gone (components/star/loading)
  return !/Opening…|Building the scene/.test(t) && !document.querySelector("[data-kib-curtain]");
}, null, { timeout: 240000, polling: 500 });

for (const s of SHOTS) {
  if (ids.length && !ids.includes(s.id)) continue;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
  // three.js tells a devtools hook about every scene it makes: kept, so the people can be hidden for the still
  await page.addInitScript(() => {
    const hook = new EventTarget();
    window.__kibScenes = [];
    hook.addEventListener("observe", (e) => { if (e.detail && e.detail.isScene) window.__kibScenes.push(e.detail); });
    window.__THREE_DEVTOOLS__ = hook;
  });
  await page.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("star-3d-quality", "high"); } catch { /* fine */ } });
  page.on("pageerror", (e) => console.log("  pageerror", e.message.slice(0, 160)));
  try {
    await page.goto(BASE + s.url, { waitUntil: "load", timeout: 300000 });
    if (s.seek !== undefined) {
      await page.waitForFunction(() => window.__frameStep && window.__styleReady !== false, null, { timeout: 300000 });
      await page.waitForTimeout(1500);
      await page.evaluate((t) => window.__frameStep.seek(t), s.seek);
      await page.waitForTimeout(900);
    } else {
      await drawn(page);
      if (s.click) {
        await page.getByRole("button", { name: s.click, exact: true }).click();
        await page.waitForTimeout(1500);
        await drawn(page);
      }
      await page.waitForTimeout(s.settle);
    }
    if (s.cam) { await page.evaluate((c) => window.__world3dCam?.(c[0], c[1]), s.cam); await page.waitForTimeout(800); }
    if (s.streetCam) { await page.evaluate((c) => window.__street3d?.debugCamera(c[0], c[1]), s.streetCam); await page.waitForTimeout(800); }
    if (s.nobody) {
      // again every frame: some places show their people afresh each frame (cullPeople, the casino)
      const hidden = await page.evaluate(() => {
        let n = 0;
        const hide = () => { for (const sc of window.__kibScenes ?? []) sc.traverse((o) => { if (o.isSkinnedMesh && o.visible) { o.visible = false; n++; } }); };
        hide();
        const loop = () => { hide(); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
        return n;
      });
      console.log("  hid", hidden, "people meshes");
      await page.waitForTimeout(1200);
    }
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(300);
    const png = path.join(tmp, `${s.id}.png`);
    await page.screenshot({ path: png });
    webp(png, path.join(OUT, `${s.id}.webp`));
  } catch (e) {
    console.log("FAILED", s.id, String(e).slice(0, 200));
  }
  await page.close();
}
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
