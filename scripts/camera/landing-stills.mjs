// Stills for the build-up landing sheet (25 Oct 2026): one chance, the
// moment it becomes yours, with no build-up and after its build-up.
//
//   node scripts/camera/landing-stills.mjs <baseUrl> <outDir> <kind:index,...> [tag]
//
// Infinite Highlights on a 390x844 phone at 2x. For each kind:index (the
// index-th chance of that kind in a fresh visit, so the same chance on any
// build): Build-ups Off — the match once it is waiting for your aim; then
// Build-ups On — the first frame after the build-up (caught in the page, no
// lag). Writes <outDir>/<tag>-<kind>-<index>-nobuild.jpg / -after.jpg and
// <tag>-frames.json (the camera and the men's height at each).
// Needs a build with NEXT_PUBLIC_STAR_OFFLINE_DEV=1 (window.__starMatch).
import { phone } from "../film/rec.mjs";
import fs from "node:fs";

const [base, outDir, specArg, tag = "x"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const specs = specArg.split(",").map((s) => { const [kind, i] = s.split(":"); return { kind, i: Number(i ?? 0) }; });
// Added to what an earlier run with the same tag wrote (by name).
const framesPath = `${outDir}/${tag}-frames.json`;
const frames = fs.existsSync(framesPath) ? JSON.parse(fs.readFileSync(framesPath, "utf8")) : [];

for (const { kind, i } of specs) {
  for (const fhr of ["off", "on"]) {
    const { browser, context, page } = await phone({ touches: false });
    await context.addInitScript(([k, fhr]) => {
      if (!sessionStorage.getItem("ls")) { localStorage.setItem("star-highlights-kinds-v1", JSON.stringify([k])); localStorage.setItem("star-fhr", fhr); sessionStorage.setItem("ls", "1"); }
      const rec = (window.__lp = []);
      const tick = () => {
        try {
          const m = window.__starMatch;
          if (m && m.frame) { const f = m.frame(); rec.push({ phase: m.phase(), lead: m.leadIn ? !!m.leadIn() : !!document.querySelector("[data-buildup]"), cam: f.cam, figPx: f.figPx, box: f.box }); }
        } catch { /* */ }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, [kind, fhr]);
    await page.goto(`${base}/star-highlights-dev?fhr=${fhr}`, { waitUntil: "domcontentloaded", timeout: 600000 });
    { const w = page.getByRole("button", { name: "Watch these" }); await w.waitFor({ timeout: 120000 }).catch(() => {}); if (await w.count()) await w.click(); }
    await page.waitForSelector(".ih-stage[data-still-cam]", { timeout: 120000 });
    await page.waitForTimeout(800);
    for (let k = 0; k < i; k++) { await page.click("button.ih-next"); await page.waitForTimeout(300); }
    const seed = await page.evaluate(() => document.querySelector("[data-hl-seed]")?.getAttribute("data-hl-seed") ?? null);
    await page.evaluate(() => { window.__lp.length = 0; });
    await page.click("button.ih-play");
    const got = await page.waitForFunction((fhr) => {
      const r = window.__lp.filter((x) => x.box && x.box.w > 0);
      if (fhr === "on") { const j = r.findIndex((x, n) => n > 0 && r[n - 1].lead && !x.lead); return j > 0 ? r[j] : false; }
      return r.length > 90 && r[r.length - 1].phase === "aim" ? r[r.length - 1] : false;
    }, fhr, { timeout: 30000, polling: "raf" }).then((h) => h.jsonValue()).catch(() => null);
    const name = `${tag}-${kind}-${i}-${fhr === "on" ? "after" : "nobuild"}`;
    await page.screenshot({ path: `${outDir}/${name}.jpg`, type: "jpeg", quality: 88 });
    frames.splice(0, frames.length, ...frames.filter((f) => f.name !== name));
    frames.push({ name, kind, i, seed, fhr, frame: got });
    console.log(`${name} #${seed}: ${got ? `${(got.cam.x2 - got.cam.x1).toFixed(2)} m across, men ${got.figPx?.toFixed(1)} px` : "not caught"}`);
    await browser.close();
  }
}
fs.writeFileSync(framesPath, JSON.stringify(frames, null, 1));
