/**
 * THE FIRST-PERSON RUN, HEADLESS (screens/MatchFirstPerson.tsx: the trial's
 * "Take him on" and the Pace drill): the run (lib/star/firstPersonDribble.ts)
 * stepped by a simple bot, each frame drawn by the website's own
 * renderFirstPerson through the phone's canvas stand-in into a Skia picture.
 *
 *   cd phone && npx tsx tools/match-firstperson.ts [--png DIR]
 *
 * Prints how the bot's runs end and the JS time to record one frame (a
 * desktop CPU: read it as relative). Exit 1 if a frame throws.
 */
import fs from "node:fs";
import path from "node:path";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { newRun, stepRun, applyBurst, applySteer, knockTaker, knockRing } from "@/lib/star/firstPersonDribble";
import { cameraFor } from "@/lib/star/firstPersonView";
import { poseFor } from "@/lib/star/dribbleCamera";
import { renderFirstPerson } from "@/lib/star/firstPersonRender";
import { mulberry32 } from "@/lib/star/season";
import { levelConfig } from "@/lib/star/trainingLevelData";
import { dribbleSetup } from "@/lib/star/trialStages";
import { startTrial } from "@/lib/star/trial";
import { Ctx2D } from "../src/draw/ctx2d";
import { withCanvasDocument, loadedFace } from "../src/draw/offscreen";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
const args = process.argv.slice(2);
const PNG = args.includes("--png") ? args[args.indexOf("--png") + 1] : null;

async function main() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  const asset = (f: string, url: string) => loadedFace(url, Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(path.join(__dirname, "../src/match/assets/fp", f)))))!);
  const ball = asset("ball.webp", "/star/ball.webp"), backdrop = asset("scene-sunset.webp", "/home/scene-sunset.webp");
  const W = 390 * 2, H = 560 * 2;
  const times: number[] = [];
  let fail = 0, pngs = 0;
  if (PNG) fs.mkdirSync(PNG, { recursive: true });
  const runs: { name: string; make: () => ReturnType<typeof newRun> }[] = [];
  for (const lvl of [1, 15, 30]) {
    const cfg = levelConfig("pace", lvl);
    const ws: number[] = [];
    for (let left = cfg.chasers; left > 0; left -= Math.max(1, cfg.waveMax)) ws.push(Math.min(Math.max(1, cfg.waveMax), left));
    runs.push({ name: `pace level ${lvl}`, make: () => newRun({ pace: cfg.runPace, oppStrength: cfg.oppStrength, rounds: 3, waveSizes: ws, rng: mulberry32(lvl * 97), mates: 0, knockOn: true, lanes: cfg.lanes }) });
  }
  const trial = startTrial(7, "ST" as never);
  const ds = dribbleSetup(trial);
  runs.push({ name: "trial: take him on", make: () => newRun({ pace: 60, oppStrength: ds.oppStrength, rounds: 3, waveSizes: ds.waveSizes, rng: mulberry32(trial.seed), mates: 0 }) });
  for (const r of runs) {
    const run = r.make();
    let res = "running", t = 0, f = 0;
    while (res === "running" && t < 40) {
      const dt = 1 / 60;
      // The bot: burst away from a knock-on taker as his ring turns green, else drift to the open side.
      const k = run.knockOn ? knockTaker(run) : null;
      if (k && knockRing(k, run.elapsed).stage === "go") applyBurst(run, run.x >= k.x + k.commitSide * 1.1 ? 1 : -1);
      else if (f % 30 === 0) { const d = run.defenders.find((x) => x.phase !== "beaten" && x.y < run.y); if (d) { applySteer(run, d.x > run.x ? run.x - 2 : run.x + 2); if (f % 60 === 0) applyBurst(run, d.x > run.x ? -1 : 1); } }
      res = stepRun(run, dt);
      t += dt; f++;
      if (f % 3) continue;
      const pose = poseFor("C1", 0.5);
      const cam = cameraFor({ x: run.x, y: run.y + pose.offset }, W, H, { eye: pose.eye, pitch: (pose.pitchDeg * Math.PI) / 180 });
      const rec = Skia.PictureRecorder();
      const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
      const ctx = new Ctx2D(Skia, c, { width: W, height: H });
      const a = performance.now();
      try {
        withCanvasDocument(Skia, () => renderFirstPerson({ width: W, height: H, getContext: () => ctx } as unknown as HTMLCanvasElement, {
          cam, defenders: run.defenders, stride: run.stride, minX: run.minX, maxX: run.maxX, ball: { x: run.x + 0.3, y: run.y - 1, z: 0 },
          ballImage: ball as unknown as HTMLImageElement, backdrop: backdrop as unknown as HTMLImageElement, assist: false, reducedMotion: false,
          own: { x: run.x, y: run.y }, ballBehindYou: true, mates: run.mates, knockClock: run.knockOn ? run.elapsed : undefined,
        }));
      } catch (e) { fail++; console.log(`DRAW FAILED ${r.name}: ${(e as Error).message}`); break; }
      const picture = rec.finishRecordingAsPicture();
      if (f > 6) times.push(performance.now() - a);
      if (PNG && pngs < 8 && f % 120 === 0) {
        const surf = Skia.Surface.Make(W, H)!;
        surf.getCanvas().drawPicture(picture); surf.flush();
        fs.writeFileSync(path.join(PNG, `fp-${pngs++}.png`), Buffer.from(surf.makeImageSnapshot().encodeToBytes()));
      }
      (picture as unknown as { dispose(): void }).dispose(); (rec as unknown as { dispose(): void }).dispose();
    }
    console.log(`${r.name.padEnd(22)} ${res} after ${t.toFixed(1)} s (${run.defenders.filter((d) => d.phase === "beaten").length}/${run.defenders.length} beaten)`);
  }
  const q = (xs: number[], p: number) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  console.log(`record one frame (JS, the website's renderFirstPerson through the canvas stand-in): median ${q(times, 0.5).toFixed(2)} ms  p95 ${q(times, 0.95).toFixed(2)} ms`);
  console.log(fail ? `${fail} FAILED` : "All first-person checks passed.");
  process.exit(fail ? 1 : 0);
}
void main();
