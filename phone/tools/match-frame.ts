/**
 * PER-FRAME COST OF THE MATCH PICTURE, HEADLESS: the phone's own drawing code
 * (src/match/drawPitch.ts + figures.ts + sprites.ts), on the same Skia
 * (CanvasKit through RN Skia's JsiSkApi), timed while a bot plays a match.
 *
 *   cd phone && npx tsx tools/match-frame.ts [frames] [--png DIR]
 *
 * Prints: the sheet's load and per-kit colouring time (once per kit), then
 * the JS time to record one frame (driver tick + picture), median / p95 / max,
 * and how much of it is the players. --png writes a few frames to look at.
 * A desktop CPU, not a phone: read the numbers as relative, not absolute.
 */
import fs from "node:fs";
import path from "node:path";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { kitsFor } from "@/lib/star/kits";
import { setSkia } from "../src/match/skiaApi";
import { setSpriteSheet, setAtlas, atlasFor, tintTimes, type SpriteIndex } from "../src/match/sprites";
import { drawPitch, paintPitch } from "../src/match/drawPitch";
import { MatchDriver } from "../src/match/driver";
import { matchSetupFor } from "../src/match/setup";
import { botAim, botContact, flatPullFor } from "./match-bot";
import { testCareer } from "./match-run-career";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
setVisitSalt(0);

const args = process.argv.slice(2);
const FRAMES = Number(args.find((a) => /^\d+$/.test(a)) ?? 3000);
const PNG = args.includes("--png") ? args[args.indexOf("--png") + 1] : null;
const W = 390, H = 640;

async function main() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  setSkia(Skia);
  const dir = path.join(__dirname, "../src/match/assets/sprites");
  const t0 = performance.now();
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as SpriteIndex;
  const img = (f: string) => Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(path.join(dir, f)))))!;
  setSpriteSheet(idx, img("atlas-0.webp"), img("mask-0.webp"));
  const tLoad = performance.now() - t0;
  // Atlases 1-5 (the New kicks and saves, celebrations, aerial moves, keeper catches), as the phone loads them later.
  const tL = performance.now();
  for (let n = 1; n <= 5; n++) setAtlas(n, img(`atlas-${n}.webp`), img(`mask-${n}.webp`));
  console.log(`atlases 1-5 decoded in ${(performance.now() - tL).toFixed(0)} ms (on the phone: off the frame loop, at idle)`);

  const career = testCareer();
  const fx = career.fixtures.find((f) => !f.played)!;
  const kits = fx.home ? kitsFor(career.player.club, fx.opponent) : kitsFor(fx.opponent, career.player.club);
  const t1 = performance.now();
  for (const k of [kits.home, kits.away, kits.keeper]) for (let n = 0; n <= 5; n++) atlasFor({ shirt: k.shirt, shorts: k.trim, socks: k.shirt }, n);
  const tTint = (performance.now() - t1) / 3;
  console.log(`sprite sheet decoded in ${tLoad.toFixed(0)} ms; coloured per kit (all six atlases) in ${tTint.toFixed(0)} ms (once, before kick-off); per atlas median ${[...tintTimes].sort((a, b) => a - b)[tintTimes.length >> 1]} ms`);

  const d = new MatchDriver(matchSetupFor({ ...career, week: fx.week }, fx), { hw: H / W });
  d.start();
  const surf = Skia.Surface.Make(W, H)!;
  const rec: number[] = [], tick: number[] = [];
  let drawn = 0, aimT = 0, contactT = 0, last = "", chances = 0, pngs = 0;
  if (PNG) fs.mkdirSync(PNG, { recursive: true });
  for (let n = 0; n < 2_000_000 && drawn < FRAMES && !d.done; n++) {
    if (d.pause) { d.continuePause(); continue; }
    if (d.phase === "aim" && last !== "aim") { aimT = 0; chances++; }
    if (d.phase === "contact" && last !== "contact") contactT = 0;
    last = d.phase;
    if (d.phase === "aim" && !d.lead && ++aimT === 40) {
      const b = d.sc.ball, pull = flatPullFor(d.viewport, d.facing);
      d.pointerDown({ x: b.x, y: b.y }, 99, 0); d.pointerMove(botAim(b, d.viewport, d.facing, 3, chances), pull); d.pointerUp(pull);
    }
    if (d.tdReady) d.tdTap({ x: 0, y: 0 });
    if (d.phase === "contact" && !d.contactLocked && ++contactT === 6) { const c = botContact(chances); d.tapContact(c.cx, c.cy); }
    const a = performance.now();
    d.tick();
    const b = performance.now();
    if (d.phase === "feed") continue;
    const pic = drawPitch(d, kits, W, H);
    const e = performance.now();
    tick.push(b - a); rec.push(e - b); drawn++;
    if (PNG && pngs < 12 && drawn % 97 === 0) {
      const cv = surf.getCanvas(); cv.clear(Skia.Color("black")); cv.drawPicture(pic);
      surf.flush();
      fs.writeFileSync(path.join(PNG, `frame-${String(pngs++).padStart(2, "0")}-${d.phase}.png`), Buffer.from(surf.makeImageSnapshot().encodeToBytes()));
    }
  }
  // The players' share: the same frames with the sheet missing (old shapes) vs with it.
  const q = (xs: number[], p: number) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  console.log(`${drawn} pitch frames over ${chances} chances`);
  console.log(`record a frame (picture):  median ${q(rec, 0.5).toFixed(2)} ms   p95 ${q(rec, 0.95).toFixed(2)} ms   max ${Math.max(...rec).toFixed(2)} ms`);
  console.log(`driver tick:               median ${q(tick, 0.5).toFixed(2)} ms   p95 ${q(tick, 0.95).toFixed(2)} ms   max ${Math.max(...tick).toFixed(2)} ms`);
  // Raster cost of playing that picture back (on the phone this is the graphics chip, not JS).
  const r: number[] = [];
  for (let i = 0; i < 200; i++) { const a = performance.now(); const cv = surf.getCanvas(); paintPitch(cv, d, kits, W, H); surf.flush(); r.push(performance.now() - a); }
  console.log(`CPU raster of one frame (CanvasKit, for scale only): median ${q(r, 0.5).toFixed(2)} ms`);
}
void main();
