// Where the camera LANDS after a build-up, in the real page (Mikey + Harry,
// 25 Oct 2026: "we need to review the buildup/camera angles and make sure
// they all land on the same size").
//
//   [FHR=on|off] [FRAMING=v2] [STILLS_N=3] node scripts/camera/landing-probe.mjs <baseUrl> <outJson> [kinds=one_on_one,header,...] [n=20] [stillsDir]
//
// Infinite Highlights (/star-highlights-dev), a 390x844 phone, build-ups On
// (FHR=off: Off — the same chances, none of them with a build-up). Needs a
// build with NEXT_PUBLIC_STAR_OFFLINE_DEV=1 (window.__starMatch).
// For every chance of every kind asked: the chance's own frame with NO
// build-up (the page's still, which is the match's first frame: pinned by
// scripts/fhr/still-vs-play.mjs), then ▶ Play: the real match plays the
// build-up and the frame at the moment the chance is yours (the first frame
// with no build-up left) is read off window.__starMatch.frame(). Writes, per
// chance: both frames (pitch metres), the centre gap and size gap in glass
// px, and the men's height on the glass (figPx) at control.
// With a stills folder: the first STILLS_N chances of each kind get the whole
// phone screen at the moment the chance is yours: <kind>-<i>-after.jpg (the
// first frame after the build-up) or <kind>-<i>-nobuild.jpg (no build-up).
// Summarise with scripts/camera/landing-report.mjs.
import { chromium } from "playwright";
import fs from "node:fs";

const FHR = process.env.FHR || "on";
// FRAMING=v2: Settings → "New framing (test)" on (lib/star/matchView.ts framingV2On).
const V2 = process.env.FRAMING === "v2";
const [base = "http://localhost:3062", out = "/tmp/landing.json", kindsArg = "one_on_one,tight_angle,cutback,long_range,header,volley,through_ball,byline_cross,free_kick,penalty,corner", nArg = "20", stills = ""] = process.argv.slice(2);
const KINDS = kindsArg.split(",");
const N = Number(nArg);
const STILLS_N = Number(process.env.STILLS_N || 3);
if (stills) fs.mkdirSync(stills, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"], ...(exe && fs.statSync(exe).isFile() ? { executablePath: exe } : {}) });
const errors = [];
const rows = [];

for (const kind of KINDS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: stills ? 2 : 1, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([k, fhr, v2]) => {
    try {
      if (!sessionStorage.getItem("lp-init")) {
        localStorage.setItem("star-highlights-kinds-v1", JSON.stringify([k]));
        localStorage.setItem("star-fhr", fhr);
        localStorage.setItem("star-framing-v2", v2 ? "1" : "0");
        sessionStorage.setItem("lp-init", "1");
      }
    } catch { /* */ }
    // Every frame while the match is up: its camera, phase, build-up and the men's size.
    const rec = (window.__lp = []);
    const tick = () => {
      try {
        const m = window.__starMatch;
        if (m && m.frame) {
          const f = m.frame();
          rec.push({ t: performance.now(), phase: m.phase(), lead: m.leadIn ? !!m.leadIn() : !!document.querySelector("[data-buildup]"), cam: f.cam, facing: f.facing, figPx: f.figPx, box: f.box, kind: f.kind });
          if (rec.length > 4000) rec.splice(0, 2000);
        }
      } catch { /* */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [kind, FHR, V2]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${base}/star-highlights-dev?fhr=${FHR}`, { waitUntil: "domcontentloaded", timeout: 600000 });
  { const w = page.getByRole("button", { name: "Watch these" }); await w.waitFor({ timeout: 120000 }).catch(() => {}); if (await w.count()) await w.click(); }
  await page.waitForSelector(".ih-stage[data-still-cam]", { timeout: 120000 });
  await page.waitForTimeout(800);
  for (let i = 0; i < N; i++) {
    const still = await page.evaluate(() => {
      const st = document.querySelector(".ih-stage");
      return { cam: JSON.parse(st.dataset.stillCam), facing: st.dataset.stillFacing, kind: st.dataset.stillKind, seed: document.querySelector("[data-hl-seed]")?.getAttribute("data-hl-seed") ?? null };
    });
    // Pictures of the first STILLS_N chances: the match at the moment the chance is yours.
    const wantStill = stills && i < STILLS_N;
    await page.evaluate(() => { window.__lp.length = 0; });
    await page.click("button.ih-play");
    // A build-up starts within ~1.5 s or never. With one: the first frame after
    // it (the hand-over), caught in the page itself (no polling lag).
    const handOver = await page.waitForFunction(() => {
      const r = window.__lp.filter((x) => x.box && x.box.w > 0);
      const i = r.findIndex((x, j) => j > 0 && r[j - 1].lead && !x.lead);
      if (i > 0) return "build";
      if (!r.some((x) => x.lead) && r.length > 90 && r[r.length - 1].phase === "aim") return "none";
      return false;
    }, null, { timeout: 30000, polling: "raf" }).then((h) => h.jsonValue()).catch(() => null);
    if (wantStill && handOver) await page.screenshot({ path: `${stills}/${kind}-${i}-${handOver === "build" ? "after" : "nobuild"}.jpg`, type: "jpeg", quality: 85 });
    if (handOver === "build") {
      await page.waitForTimeout(300);
      const l2 = (await page.evaluate(() => window.__lp.slice())).filter((x) => x.box && x.box.w > 0);
      const j2 = l2.findIndex((x, j) => j > 0 && l2[j - 1].lead && !x.lead);
      rows.push({ kind, seed: still.seed, build: true, still, last: l2[j2 - 1], first: l2[j2], ctrl: l2[Math.min(l2.length - 1, j2 + 10)] });
    } else if (handOver === "none") {
      const live = (await page.evaluate(() => window.__lp.slice())).filter((x) => x.box && x.box.w > 0);
      rows.push({ kind, seed: still.seed, build: false, still, first: live[5], ctrl: live[live.length - 1] });
    }
    await page.click("button.ih-play").catch(() => {}); // Stop
    await page.waitForTimeout(250);
    await page.click("button.ih-next").catch(() => {});
    await page.waitForTimeout(350);
  }
  await ctx.close();
  const mine = rows.filter((r) => r.kind === kind);
  console.log(`${kind}: ${mine.length} chances, ${mine.filter((r) => r.build).length} with a build-up`);
  fs.writeFileSync(out, JSON.stringify({ rows, errors: errors.slice(0, 10) }, null, 1));
}
fs.writeFileSync(out, JSON.stringify({ rows, errors: errors.slice(0, 10) }, null, 1));
console.log(`errors: ${errors.length}${errors.length ? " " + errors.slice(0, 3).join(" | ") : ""}`);
await browser.close();
