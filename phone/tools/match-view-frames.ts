/**
 * THE 3D MATCH VIEW'S FRAMES, HEADLESS: plays a real match with the bot on the phone's one driver, draws each frame with the
 * phone's own 2D drawing (CanvasKit; the men's animations are read from it, as on the phone) and builds the frame the 3D
 * view is handed (src/three/matchFrame.ts). Shared by tools/match-view-check.ts (which feeds them to the 3D view in a
 * Web Worker) and usable alone:
 *
 *   cd phone && npx tsx tools/match-view-frames.ts [frames]
 *
 * Prints the JS time of the 2D frame (driver tick + picture), of the frame hand-over, and the frames' shape.
 */
import fs from "node:fs";
import path from "node:path";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { kitsFor } from "@/lib/star/kits";
import type { EngineFrame } from "@/lib/star/engineFrame";
import { setSkia } from "../src/match/skiaApi";
import { setSpriteSheet, setAtlas, type SpriteIndex } from "../src/match/sprites";
import { drawPitch } from "../src/match/drawPitch";
import { MatchDriver } from "../src/match/driver";
import { matchSetupFor } from "../src/match/setup";
import { engineFrameOf, viewDrawsPhase } from "../src/three/matchFrame";
import { botAim, botContact, flatPullFor } from "./match-bot";
import { testCareer } from "./match-run-career";

export interface Recorded { frames: EngineFrame[]; tickMs: number[]; drawMs: number[]; frameMs: number[]; chances: number; W: number; H: number }

export async function recordFrames(want: number, W = 412, H = 720, every = 1): Promise<Recorded> {
  (globalThis as Record<string, unknown>).window ??= {};
  (globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
  setVisitSalt(0);
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  setSkia(Skia);
  const dir = path.join(__dirname, "../src/match/assets/sprites");
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as SpriteIndex;
  const img = (f: string) => Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(path.join(dir, f)))))!;
  setSpriteSheet(idx, img("atlas-0.webp"), img("mask-0.webp"));
  for (let n = 1; n <= 5; n++) setAtlas(n, img(`atlas-${n}.webp`), img(`mask-${n}.webp`));
  const career = testCareer();
  const fx = career.fixtures.find((f) => !f.played)!;
  const kits = fx.home ? kitsFor(career.player.club, fx.opponent) : kitsFor(fx.opponent, career.player.club);
  const d = new MatchDriver(matchSetupFor({ ...career, week: fx.week }, fx), { hw: H / W });
  d.start();
  const out: Recorded = { frames: [], tickMs: [], drawMs: [], frameMs: [], chances: 0, W, H };
  let aimT = 0, contactT = 0, last = "", n = 0;
  for (let i = 0; i < 4_000_000 && out.frames.length < want && !d.done; i++) {
    if (d.pause) { d.continuePause(); continue; }
    if (d.phase === "aim" && last !== "aim") { aimT = 0; out.chances++; }
    if (d.phase === "contact" && last !== "contact") contactT = 0;
    last = d.phase;
    if (d.phase === "aim" && !d.lead && ++aimT === 40) {
      const b = d.sc.ball, pull = flatPullFor(d.viewport, d.facing);
      d.pointerDown({ x: b.x, y: b.y }, 99, 0); d.pointerMove(botAim(b, d.viewport, d.facing, 3, out.chances), pull); d.pointerUp(pull);
    }
    if (d.tdReady) d.tdTap({ x: 0, y: 0 });
    if (d.phase === "contact" && !d.contactLocked && ++contactT === 6) { const c = botContact(out.chances); d.tapContact(c.cx, c.cy); }
    const a = performance.now();
    d.tick();
    const b = performance.now();
    if (!viewDrawsPhase(d.phase)) continue;
    drawPitch(d, kits, W, H);
    const c = performance.now();
    const f = engineFrameOf(d, kits, W, H);
    const e = performance.now();
    out.tickMs.push(b - a); out.drawMs.push(c - b); out.frameMs.push(e - c);
    if (n++ % every === 0) out.frames.push(JSON.parse(JSON.stringify(f)) as EngineFrame);
  }
  return out;
}

const q = (xs: number[], p: number) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
export const quant = q;

if (require.main === module) {
  const N = Number(process.argv[2] ?? 3000);
  recordFrames(N).then((r) => {
    console.log(`${r.frames.length} frames over ${r.chances} chances`);
    console.log(`driver tick:        median ${q(r.tickMs, 0.5).toFixed(3)} ms  p95 ${q(r.tickMs, 0.95).toFixed(3)} ms`);
    console.log(`2D picture:         median ${q(r.drawMs, 0.5).toFixed(3)} ms  p95 ${q(r.drawMs, 0.95).toFixed(3)} ms`);
    console.log(`3D frame hand-over: median ${q(r.frameMs, 0.5).toFixed(3)} ms  p95 ${q(r.frameMs, 0.95).toFixed(3)} ms`);
    const kinds: Record<string, number> = {};
    r.frames.forEach((f) => { kinds[f.phase] = (kinds[f.phase] ?? 0) + 1; });
    console.log("phases:", kinds);
    const f = r.frames.find((x) => x.phase === "aim")!;
    console.log("an aim frame:", JSON.stringify({ kind: f.kind, men: f.figures.map((m) => m.sid + (m.team === "them" ? "!" : "")).join(" "), keeper: !!f.keeper, ball: f.ball, cam: { vp: f.cam.viewport, facing: f.cam.facing, W: f.cam.W, H: f.cam.H, tilt: !!f.cam.tilt } }));
  }).catch((e) => { console.error(e); process.exit(1); });
}
