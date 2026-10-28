/**
 * THE ANIMATIONS: NEW 3D CLIPS — baker for the second sprite atlas.
 *
 * The first atlas (atlas-0) was baked by ../bake.mjs from GLB files that were
 * never committed. Leo, 7 Oct 2026: the baked man is the same person as
 * public/star/people3d/player.glb (checked frame by frame against atlas-0:
 * same body, hair, boots, poses from the shared anims.glb; within 1 px once
 * scaled by FIT below). So the new clips are keyframed here (defs.js, bone
 * turns on that skeleton, clips.js builds them) and baked with the same
 * camera, size, outline and kit masks as atlas-0 by bake-new.html (a copy of
 * ../bake.html that reads the people3d body and these clips). The keeper is
 * the same body with long sleeves and light gloves painted on, as atlas-0's
 * keeper was.
 *
 * Run:   node tools/sprites/new/bake-new.mjs            bake + install
 *        node tools/sprites/new/bake-new.mjs sheet player:shotKick,volley:2,0   a look sheet (to tools/sprites/new/preview/)
 *        node tools/sprites/new/bake-new.mjs spike       compare with atlas-0 (idle, jog, celebrate; keeper)
 *        node tools/sprites/new/bake-new.mjs styleA      Style A 2D players: own cells → atlas-0a/1a, mask-0a/1a, index-a.json
 *        node tools/sprites/new/bake-new.mjs reskin      Style A: every cell again on toon-p1, same rects and anchors
 *                                                         → atlas-0a/mask-0a/atlas-1a/mask-1a (index.json untouched)
 *        node tools/sprites/new/bake-new.mjs celebs [a|current|both]   GOAL CELEBRATIONS (Leo, 22 Oct 2026)
 *            Six clips from anims3d/mocap.glb (celebrate_safe/_airplane/_pump/_jump/_roar,
 *            knee_slide) → player celebHandsUp, celebArmsOut, celebKneeSlide, celebFistPump,
 *            celebJump, celebRoar, 8 facings, into a NEW atlas 2: atlas-2a.webp + mask-2a.webp
 *            (index-a.json, Style A, the live look) and atlas-2.webp + mask-2.webp (index.json).
 *            Same body, camera, size, outline and masks as the other clips; only atlases["2"]
 *            and those six entries are written. Travel taken out (the knee slide fully: the
 *            game slides him; the airplane's circle and its turn too). Frames that put one
 *            limb into another are skipped or the legs set a few degrees wider (CELEBS in
 *            bake-new.html says which and why). Once clips carry `t3d`, each frame's second
 *            in the 3D clip (lib/star/sprites.ts spriteFrame).
 *        node tools/sprites/new/bake-new.mjs celebs both 4   THE STAR PASS FOUR (25 Oct 2026): celebCornerFlag,
 *            celebBackflip, celebOwnName, celebStatue (keyed: tools/mocap3d/keyed_celebs.py) → their own
 *            atlas 4 (atlas-4/-4a, mask-4/-4a); atlas 2 and 3 untouched. A group number picks the CELEBS with that
 *            `group` (none = 2, the six above).
 *        node tools/sprites/new/bake-new.mjs keepers [a|current|both]   THE KEEPER CATCHES (Leo, 26 Oct 2026; keeper.js):
 *            kCatchDiveR, kCatchLowR, kParryDiveR, kGetUpBallR, kGetUpR, kCatchChest, kCatchFeet, kHoldBall
 *            (+ kCatchDiveL, kCatchLowL, kParryDiveL, kGetUpBallL, kGetUpL drawn mirrored), 4 facings, into a NEW
 *            atlas 5 (atlas-5/-5a, mask-5/-5a). Each cell has `pts` = [x, y, g, 0, 0], the ball's centre in his
 *            gloves (the aerials' units); clips carry contactFrame, landFrame, landM, hold, ballPx.
 *        node tools/sprites/new/bake-new.mjs keepersheet a "kCatchDiveR,kCatchLowR:1,3[:80]"   look sheet → preview/
 *        node tools/sprites/new/bake-new.mjs keeperbones a kCatchDiveR   joints under 14 cm, ball vs body, per frame
 *        node tools/sprites/new/bake-new.mjs celebsheet a "celebJump,celebRoar:2,0"   look sheet → preview/
 *        node tools/sprites/new/bake-new.mjs celebbones a celebKneeSlide [n]   per frame: lowest point and
 *            the joints closer than 14 cm (n = 0: the baked frames; n > 0: n even steps)
 *        node tools/sprites/new/bake-new.mjs celebclose a celebKneeSlide 90 70   big close-ups (facing°, tilt°)
 * Needs: three (site package) and Playwright's Chromium (swiftshader, no GPU).
 * Writes public/star/sprites/{atlas-1.webp,mask-1.png} and merges only the new
 * clips (and atlases["1"]) into index.json. atlas-0, mask-0 and every old
 * clip entry are never touched.
 * The game reads the masks as LOSSLESS WebP (mask-*.webp, pixel-identical,
 * about a third of the PNG; 12 Oct 2026). After a bake, make the .webp again
 * (Pillow: save(..., "WEBP", lossless=True, exact=True)) and point the index
 * at it, or the index goes back to the bigger PNG (it still works).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "package.json"));
const threeDir = path.resolve(path.dirname(require.resolve("three")), "..");
const { chromium } = require("playwright");
/** The people3d body is ~4% bigger than the old bake's; this brings it to atlas-0's size. */
const FIT = "?s=0.96&dy=-0.015";
const outDir = path.join(root, "public/star/sprites");
const previewDir = path.join(here, "preview");

const [mode = "bake", arg = ""] = process.argv.slice(2);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file;
  if (u.startsWith("/three/")) file = path.join(threeDir, u.slice(7));
  else if (u.startsWith("/star/")) file = path.join(root, "public", u);
  else file = path.join(here, path.basename(u));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const dataOf = (url) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
/** Open the baker page on one look's body: "a" = Style A (toon-p1, fitted to index-a's standH), "" = current. */
async function openLook(tag, wide = false) {
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/bake-new.html${tag === "a" ? "?file=/star/people3d/toon-p1.glb" : FIT}${wide ? "&view=wide" : ""}`);
  await page.waitForFunction(() => window.bakerReady === true, null, { timeout: 120000 });
  if (tag === "a") {
    const standH = JSON.parse(fs.readFileSync(path.join(outDir, "index-a.json"), "utf8")).standH;
    console.log("Style A fit scale", (await page.evaluate((h) => window.fitHeight(h), standH)).toFixed(3));
  }
  return page;
}
/** PNG → lossless WebP (pixel-identical), as the game reads the masks. */
function losslessWebp(png, out) {
  const r = spawnSync("python3", ["-I", "-c", "import sys;from PIL import Image;Image.open(sys.argv[1]).save(sys.argv[2],'WEBP',lossless=True,exact=True)", png, out], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("webp conversion failed (needs python3 + Pillow)");
}
if (mode.startsWith("keeper")) {
  // keepers [a|current|both]  ·  keepersheet <a|current> "<clip,clip:dirIdx,dirIdx[:tilt]>"  ·  keeperbones <a|current> <clip>
  // THE KEEPER CATCHES (Leo, 26 Oct 2026; keeper.js): eight keyed keeper clips (+ five
  // mirrored L entries), 4 facings, into atlas 5 (atlas-5a.webp + mask-5a.webp in
  // index-a.json, atlas-5.webp + mask-5.webp in index.json). Each cell carries `pts`
  // (the ball's centre in his gloves). Only atlases["5"] and those keeper entries are written.
  const which = (arg || (mode === "keepers" ? "both" : "a"));
  const looks = which === "both" ? ["a", ""] : [which === "current" ? "" : "a"];
  try {
    for (const tag of looks) {
      const page = await openLook(tag, true);
      const t0 = Date.now();
      if (mode === "keepers") {
        const r = await page.evaluate(([t, q]) => window.bakeKeepers(t, q), [tag, tag === "a" ? 0.8 : 0.74]);
        const color = path.join(outDir, `atlas-5${tag}.webp`);
        fs.writeFileSync(color, dataOf(r.color));
        fs.mkdirSync(previewDir, { recursive: true });
        const tmp = path.join(previewDir, `mask-5${tag}.png`);
        fs.writeFileSync(tmp, dataOf(r.mask));
        const mask = path.join(outDir, `mask-5${tag}.webp`);
        losslessWebp(tmp, mask); fs.unlinkSync(tmp);
        const frag = JSON.parse(r.frag);
        const ip = path.join(outDir, tag === "a" ? "index-a.json" : "index.json");
        const idx = JSON.parse(fs.readFileSync(ip, "utf8"));
        const others = (x) => JSON.stringify({ atlas: x.atlas, rest: Object.entries(x.atlases ?? {}).filter(([k]) => k !== "5"), standH: x.standH, player: x.chars.player,
          keeper: Object.entries(x.chars.keeper.clips).filter(([n]) => !(n in frag.clips)) });
        const keep = others(idx);
        idx.atlases = { ...(idx.atlases ?? {}), 5: frag.atlas };
        for (const [n, cl] of Object.entries(frag.clips)) {
          const was = idx.chars.keeper.clips[n];
          if (was && was.atlas !== 5) throw new Error(`refusing to overwrite clip keeper.${n}`);
          idx.chars.keeper.clips[n] = cl;
        }
        if (others(idx) !== keep) throw new Error("another atlas or clip entry changed");
        fs.writeFileSync(ip, JSON.stringify(idx));
        console.log(`atlas-5${tag}.webp`, (fs.statSync(color).size / 1024).toFixed(0), "KB ·", `mask-5${tag}.webp`, (fs.statSync(mask).size / 1024).toFixed(0), "KB ·", frag.atlas.w + "x" + frag.atlas.h);
        for (const [n, cl] of Object.entries(frag.clips)) if (!cl.mirrorOf) console.log(" ", n, cl.frames, "frames ·", cl.fps, "fps ·", cl.loop, cl.contactFrame != null ? "contact " + cl.contactFrame : "", cl.landFrame != null ? "land " + cl.landFrame : "");
        console.log(path.basename(ip), "updated ·", ((Date.now() - t0) / 1000).toFixed(0), "s");
      } else if (mode === "keepersheet") {
        fs.mkdirSync(previewDir, { recursive: true });
        const r = await page.evaluate((s) => window.keeperSheet(s), process.argv[4] ?? "");
        const f = path.join(previewDir, `keepers-${tag || "current"}-${(process.argv[4] ?? "all").replace(/\W+/g, "_")}.png`);
        fs.writeFileSync(f, dataOf(r.url)); console.log("wrote", f);
      } else if (mode === "keeperbones") {
        // per frame: lowest point, joints closer than 14 cm (RUL-3D-005), the gloves' gap, the ball's
        // height and its distance to his chest / head / hips (under 0.22 m = the ball in his body)
        const D = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 9);
        const PAIRS = [["LeftLeg", "RightLeg"], ["LeftFoot", "RightFoot"], ["LeftHand", "RightHand"], ["LeftHand", "Head"], ["RightHand", "Head"], ["LeftHand", "Hips"], ["RightHand", "Hips"], ["LeftForeArm", "Spine02"], ["RightForeArm", "Spine02"], ["LeftForeArm", "Spine01"], ["RightForeArm", "Spine01"], ["LeftHand", "Spine02"], ["RightHand", "Spine02"], ["LeftFoot", "Hips"], ["RightFoot", "Hips"], ["LeftHand", "LeftUpLeg"], ["RightHand", "RightUpLeg"], ["LeftHand", "LeftLeg"], ["RightHand", "RightLeg"], ["LeftLeg", "Spine02"], ["RightLeg", "Spine02"], ["LeftForeArm", "RightForeArm"]];
        // all figures in REAL centimetres (world units ÷ the body's scale S)
        let bad = 0;
        for (const row of await page.evaluate((nm) => window.keeperBones(nm), process.argv[4])) {
          const cm = (x) => ((x / row.S) * 100).toFixed(0);
          const near = PAIRS.map(([a, b]) => [a + "-" + b, D(row.j[a], row.j[b]) / row.S]).filter(([, d]) => d < 0.14).map(([k, d]) => `${k} ${(d * 100).toFixed(0)}cm`);
          const bd = ["Spine02", "Head", "Hips"].map((b) => `${b} ${cm(D(row.ball, row.j[b]))}`).join(" ");
          if (near.length) bad++;
          console.log(`f${row.i}${row.floor === "lift" ? "^" : " "} low ${cm(row.minY)}cm · ball x ${cm(-row.ball[0])} · hips ${cm(row.j.Hips[1])}cm · ball h ${cm(row.ball[1])}cm gap ${cm(row.palmGap)}cm · ball→ ${bd}`, near.length ? "· NEAR " + near.join(" · ") : "");
        }
        console.log(bad ? `${bad} frame(s) with joints under 14 cm` : "no joints under 14 cm");
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(0);
}
if (mode.startsWith("aerial")) {
  // aerials [a|current|both]  ·  aerialsheet <a|current> <clip,clip:dirIdx,dirIdx>
  // THE AERIAL MOVES (Harry, 25 Oct 2026; aerials.js): eight clips into atlas 3
  // (atlas-3a.webp + mask-3a.webp in index-a.json, atlas-3.webp + mask-3.webp in
  // index.json), each cell with its contact points (`pts`). Only atlases["3"] and
  // those eight entries are written.
  const which = (arg || (mode === "aerials" ? "both" : "a"));
  const looks = which === "both" ? ["a", ""] : [which === "current" ? "" : "a"];
  try {
    for (const tag of looks) {
      const page = await openLook(tag);
      const t0 = Date.now();
      if (mode === "aerials") {
        const r = await page.evaluate(([t, q]) => window.bakeAerials(t, q), [tag, tag === "a" ? 0.8 : 0.74]);
        const color = path.join(outDir, `atlas-3${tag}.webp`);
        fs.writeFileSync(color, dataOf(r.color));
        fs.mkdirSync(previewDir, { recursive: true });
        const tmp = path.join(previewDir, `mask-3${tag}.png`);
        fs.writeFileSync(tmp, dataOf(r.mask));
        const mask = path.join(outDir, `mask-3${tag}.webp`);
        losslessWebp(tmp, mask); fs.unlinkSync(tmp);
        const frag = JSON.parse(r.frag);
        const ip = path.join(outDir, tag === "a" ? "index-a.json" : "index.json");
        const idx = JSON.parse(fs.readFileSync(ip, "utf8"));
        const keep = JSON.stringify({ atlas: idx.atlas, a1: idx.atlases?.["1"], a2: idx.atlases?.["2"], standH: idx.standH });
        idx.atlases = { ...(idx.atlases ?? {}), 3: frag.atlas };
        for (const [n, cl] of Object.entries(frag.clips)) {
          const was = idx.chars.player.clips[n];
          if (was && was.atlas !== 3) throw new Error(`refusing to overwrite clip player.${n}`);
          idx.chars.player.clips[n] = cl;
        }
        if (JSON.stringify({ atlas: idx.atlas, a1: idx.atlases["1"], a2: idx.atlases["2"], standH: idx.standH }) !== keep) throw new Error("atlas 0/1/2 entry changed");
        fs.writeFileSync(ip, JSON.stringify(idx));
        console.log(`atlas-3${tag}.webp`, (fs.statSync(color).size / 1024).toFixed(0), "KB ·", `mask-3${tag}.webp`, (fs.statSync(mask).size / 1024).toFixed(0), "KB ·", frag.atlas.w + "x" + frag.atlas.h);
        console.log(path.basename(ip), "updated ·", ((Date.now() - t0) / 1000).toFixed(0), "s");
      } else {
        fs.mkdirSync(previewDir, { recursive: true });
        const r = await page.evaluate((s) => window.aerialSheet(s), process.argv[4] ?? "");
        const f = path.join(previewDir, `aerials-${tag || "current"}-${(process.argv[4] ?? "all").replace(/\W+/g, "_")}.png`);
        fs.writeFileSync(f, dataOf(r.url)); console.log("wrote", f);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(0);
}
if (mode.startsWith("celeb")) {
  // celebs [a|current|both]  ·  celebsheet <a|current> <clip,clip:dirIdx,dirIdx>  ·  celebclose <a|current> <clip> <facingDeg> [tiltDeg: 25 = game camera, 88 = from the side]
  const which = (arg || (mode === "celebs" ? "both" : "a"));
  const group = mode === "celebs" ? Number(process.argv[4] ?? 2) : 2;
  const looks = which === "both" ? ["a", ""] : [which === "current" ? "" : "a"];
  try {
    for (const tag of looks) {
      const page = await openLook(tag);
      const t0 = Date.now();
      if (mode === "celebs") {
        // WebP quality: kept under ~400 KB an atlas (Style A 0.8, current 0.74)
        const r = await page.evaluate(([t, q, g]) => window.bakeCelebs(t, q, g), [tag, tag === "a" ? 0.8 : 0.74, group]);
        const color = path.join(outDir, `atlas-${group}${tag}.webp`);
        fs.writeFileSync(color, dataOf(r.color));
        const tmp = path.join(previewDir, `mask-${group}${tag}.png`); fs.mkdirSync(previewDir, { recursive: true });
        fs.writeFileSync(tmp, dataOf(r.mask));
        const mask = path.join(outDir, `mask-${group}${tag}.webp`);
        losslessWebp(tmp, mask); fs.unlinkSync(tmp);
        const frag = JSON.parse(r.frag);
        const ip = path.join(outDir, tag === "a" ? "index-a.json" : "index.json");
        const idx = JSON.parse(fs.readFileSync(ip, "utf8"));
        // every other atlas entry must come through unchanged
        const others = (x) => JSON.stringify({ atlas: x.atlas, rest: Object.entries(x.atlases ?? {}).filter(([k]) => k !== String(group)), standH: x.standH });
        const keep = others(idx);
        idx.atlases = { ...(idx.atlases ?? {}), [group]: frag.atlas };
        for (const [n, cl] of Object.entries(frag.clips)) {
          const was = idx.chars.player.clips[n];
          if (was && was.atlas !== group) throw new Error(`refusing to overwrite clip player.${n}`);
          idx.chars.player.clips[n] = cl;
        }
        if (others(idx) !== keep) throw new Error("another atlas entry changed");
        fs.writeFileSync(ip, JSON.stringify(idx));
        console.log(`atlas-${group}${tag}.webp`, (fs.statSync(color).size / 1024).toFixed(0), "KB ·", `mask-${group}${tag}.webp`, (fs.statSync(mask).size / 1024).toFixed(0), "KB ·", frag.atlas.w + "x" + frag.atlas.h);
        for (const [n, cl] of Object.entries(frag.clips)) console.log(" ", n, cl.frames, "frames ·", cl.fps, "fps ·", r.durations[n], "s ·", cl.loop);
        console.log(path.basename(ip), "updated ·", ((Date.now() - t0) / 1000).toFixed(0), "s");
      } else if (mode === "celebsheet") {
        fs.mkdirSync(previewDir, { recursive: true });
        const r = await page.evaluate((s) => window.celebSheet(s), process.argv[4] ?? "");
        const f = path.join(previewDir, `celebs-${tag || "current"}-${(process.argv[4] ?? "all").replace(/\W+/g, "_")}.png`);
        fs.writeFileSync(f, dataOf(r.url)); console.log("wrote", f);
      } else if (mode === "celebbones") {
        // celebbones <look> <clip> [n]: n = 0 (default) the baked frames' times. Prints the closest pairs of joints.
        const D = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 9);
        const PAIRS = [["LeftLeg", "RightLeg"], ["LeftFoot", "RightFoot"], ["LeftHand", "RightHand"], ["LeftHand", "Head"], ["RightHand", "Head"], ["LeftHand", "Hips"], ["RightHand", "Hips"], ["LeftForeArm", "Spine2"], ["RightForeArm", "Spine2"], ["LeftFoot", "Hips"], ["RightFoot", "Hips"], ["LeftHand", "LeftUpLeg"], ["RightHand", "RightUpLeg"]];
        for (const row of await page.evaluate(([nm, n]) => window.celebBones(nm, n), [process.argv[4], +(process.argv[5] ?? 0)])) {
          const near = PAIRS.map(([a, b]) => [a + "-" + b, D(row[a], row[b])]).filter(([, d]) => d < 0.14).map(([k, d]) => `${k} ${(d * 100).toFixed(0)}cm`);
          console.log(`t=${row.t} lowest ${(row.minY * 100).toFixed(1)}cm top ${(row.maxY * 100).toFixed(0)}cm`, near.join(" · "));
        }
      } else if (mode === "celebclose") {
        fs.mkdirSync(previewDir, { recursive: true });
        const urls = await page.evaluate(([n, d, t]) => window.celebClose(n, (d * Math.PI) / 180, 0, t), [process.argv[4], +(process.argv[5] ?? 0), +(process.argv[6] ?? 25)]);
        urls.forEach((u, i) => { const f = path.join(previewDir, `close-${tag || "current"}-${process.argv[4]}-${process.argv[5] ?? 0}-${i}.jpg`); fs.writeFileSync(f, dataOf(u)); });
        console.log("wrote", urls.length, "close-ups to", previewDir);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(0);
}
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/bake-new.html${mode === "reskin" || mode === "probe" || mode === "styleA" ? "?file=/star/people3d/toon-p1.glb" : FIT}`);
  await page.waitForFunction(() => window.bakerReady === true, null, { timeout: 120000 });
  const t0 = Date.now();
  if (mode === "probe") {
    fs.mkdirSync(previewDir, { recursive: true });
    await page.evaluate((h) => window.fitHeight(h), JSON.parse(fs.readFileSync(path.join(outDir, "index.json"), "utf8")).standH);
    for (const spec of arg.split(";")) {
      const [file, frac, fac] = spec.split(",");
      const r = await page.evaluate(([f, a, b]) => window.probe(f, +a, +b), [file, frac, fac]);
      const name = `probe-${file.replace(/\W/g, "_")}-${frac}-${fac}.png`;
      fs.writeFileSync(path.join(previewDir, name), dataOf(r.url));
      console.log(name, JSON.stringify(r.b), r.ax, r.ay);
    }
  } else if (mode === "styleA") {
    // Style A 2D players: own cells, own index (index-a.json); the current files untouched
    const idx = JSON.parse(fs.readFileSync(path.join(outDir, "index.json"), "utf8"));
    const s = await page.evaluate((h) => window.fitHeight(h), idx.standH);
    console.log("fit scale", s.toFixed(3));
    const r = await page.evaluate((i) => window.rebakeA(i), idx);
    for (const [name, url] of Object.entries(r.files)) { const b = dataOf(url); fs.writeFileSync(path.join(outDir, name), b); console.log(name, (b.length / 1024).toFixed(0), "KB"); }
    fs.writeFileSync(path.join(outDir, "index-a.json"), JSON.stringify(r.index));
    console.log("index-a.json · standH", r.index.standH, "vs", idx.standH, "·", ((Date.now() - t0) / 1000).toFixed(0), "s");
  } else if (mode === "reskin") {
    const idx = JSON.parse(fs.readFileSync(path.join(outDir, "index.json"), "utf8"));
    const s = await page.evaluate((h) => window.fitHeight(h), idx.standH);
    console.log("fit scale", s.toFixed(3));
    for (const which of [0, 1]) {
      const r = await page.evaluate(([i, w]) => window.reskin(i, w), [idx, which]);
      fs.writeFileSync(path.join(outDir, `atlas-${which}a.webp`), dataOf(r.color));
      fs.writeFileSync(path.join(outDir, `mask-${which}a.png`), dataOf(r.mask));
      console.log(`atlas-${which}a: ${r.cells} cells · drawn smaller to fit (least scale):`, JSON.stringify(r.shrunk), "·", ((Date.now() - t0) / 1000).toFixed(0), "s");
    }
  } else if (mode === "bake") {
    const res = await page.evaluate(() => window.bakeNew());
    let total = 0;
    for (const name of ["atlas-1.webp", "mask-1.png"]) {
      const buf = dataOf(res[name]); total += buf.length;
      fs.writeFileSync(path.join(outDir, name), buf);
      console.log(name, (buf.length / 1024).toFixed(0), "KB");
    }
    const frag = JSON.parse(res["frag.json"]);
    const p = path.join(outDir, "index.json");
    const idx = JSON.parse(fs.readFileSync(p, "utf8"));
    const old = JSON.stringify({ atlas: idx.atlas, standH: idx.standH });
    idx.atlases = { ...(idx.atlases ?? {}), 1: frag.atlas };
    for (const [c, v] of Object.entries(frag.chars)) for (const [n, cl] of Object.entries(v.clips)) {
      const was = idx.chars[c].clips[n];
      if (was && !was.atlas && !was.mirrorOf) throw new Error(`refusing to overwrite old clip ${c}.${n}`);
      idx.chars[c].clips[n] = cl;
    }
    if (JSON.stringify({ atlas: idx.atlas, standH: idx.standH }) !== old) throw new Error("atlas 0 entry changed");
    fs.writeFileSync(p, JSON.stringify(idx));
    console.log("index.json updated · total", (total / 1024).toFixed(0), "KB ·", ((Date.now() - t0) / 1000).toFixed(0), "s");
  } else {
    fs.mkdirSync(previewDir, { recursive: true });
    const res = mode === "sheet" ? await page.evaluate((a) => window.clipSheet(a), arg)
      : { ...(await page.evaluate(() => window.spike())), ...(await page.evaluate(() => window.spikeKeeper())) };
    for (const [name, v] of Object.entries(res)) {
      fs.writeFileSync(path.join(previewDir, name), typeof v === "string" && v.startsWith("data:") ? dataOf(v) : v);
      console.log("wrote", path.join(previewDir, name));
    }
  }
} finally {
  await browser.close();
  server.close();
}
