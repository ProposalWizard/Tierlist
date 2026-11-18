/**
 * GOAL VIDEOS, HEADLESS: a bot plays career matches on the phone's driver with
 * goal recording on (driver.clipSink, CanvasMatch onGoalClip), then each
 * recording is cut (lib/star/goalClip/edit.ts makeEdit) and drawn frame by
 * frame with the phone's renderer (src/match/goalClip/render.ts, through the
 * canvas-2D stand-in on Skia, the phone's sprite sheets), and its sound planned
 * (lib/star/goalClip/audio.ts planAudio). Also a goal from a match you did
 * not play (lib/star/goalClip/synth.ts).
 *
 *   cd phone && npx tsx tools/match-goal-video.ts [matches] [--png DIR]
 *
 * Checks: every goal of yours or a team-mate's seen on the pitch has a
 * recording with its clip id on the goal; each recording survives
 * trackToStored → trackFromStored; frames draw without throwing.
 * Prints the time to draw one video frame (desktop CPU: read it as relative).
 */
import fs from "node:fs";
import path from "node:path";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { kitsFor } from "@/lib/star/kits";
import { makeEdit, editDuration, posterMoment } from "@/lib/star/goalClip/edit";
import { planAudio } from "@/lib/star/goalClip/audio";
import { trackToStored, trackFromStored, type GoalTrack } from "@/lib/star/goalClip/track";
import { synthTrack } from "@/lib/star/goalClip/synth";
import { setSkia } from "../src/match/skiaApi";
import { setSpriteSheet, setAtlas, type SpriteIndex } from "../src/match/sprites";
import { drawEditFrame } from "../src/match/goalClip/render";
import { Ctx2D } from "../src/draw/ctx2d";
import { withCanvasDocument } from "../src/draw/offscreen";
import { MatchDriver } from "../src/match/driver";
import { matchSetupFor } from "../src/match/setup";
import { playWithBot } from "./match-bot";
import { testCareer } from "./match-run-career";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
setVisitSalt(0);

const args = process.argv.slice(2);
const MATCHES = Number(args.find((a) => /^\d+$/.test(a)) ?? 4);
const PNG = args.includes("--png") ? args[args.indexOf("--png") + 1] : null;

async function main() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  setSkia(Skia);
  const dir = path.join(__dirname, "../src/match/assets/sprites");
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as SpriteIndex;
  const img = (f: string) => Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(path.join(dir, f)))))!;
  setSpriteSheet(idx, img("atlas-0.webp"), img("mask-0.webp"));
  for (let n = 1; n <= 5; n++) setAtlas(n, img(`atlas-${n}.webp`), img(`mask-${n}.webp`));

  const career = testCareer();
  const tracks: GoalTrack[] = [];
  let seenGoals = 0, withClip = 0, fail = 0;
  for (const [i, fx] of career.fixtures.filter((f) => !f.played).slice(0, MATCHES).entries()) {
    const c = { ...career, week: fx.week };
    const kits = fx.home ? kitsFor(c.player.club, fx.opponent) : kitsFor(fx.opponent, c.player.club);
    const d = new MatchDriver(matchSetupFor(c, fx), { hw: 2.0 });
    const got: GoalTrack[] = [];
    d.clipSink = { kits, onClip: (t) => got.push(t) };
    playWithBot(d, 2000 + i);
    // Goals scored on the pitch (yours, a team-mate's, a penalty taken for you) carry a clip id.
    const live = d.goalEvents.filter((g) => g.how !== undefined);
    const ids = new Set(got.map((t) => t.meta.id));
    for (const g of live) {
      seenGoals++;
      if (g.clipId && ids.has(g.clipId)) withClip++;
      else { fail++; console.log(`MISSING  a goal with no recording: ${g.scorer} ${g.minute}' (${g.how}) clipId=${g.clipId ?? "-"}`); }
    }
    for (const t of got) {
      const back = trackFromStored(JSON.parse(JSON.stringify(trackToStored(t))));
      if (!back || back.n !== t.n || back.data.length !== t.data.length) { fail++; console.log(`BAD STORE ${t.meta.id}`); }
    }
    console.log(`${fx.home ? "H" : "A"} v ${fx.opponent.padEnd(24)} ${d.userScore}-${d.oppScore}  goals on the pitch ${live.length}, recordings ${got.length}`);
    tracks.push(...got);
  }
  const synth = synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: true, minute: 63, scoreAfter: [1, 0], seed: "test-synth-1" });
  if (!synth) { fail++; console.log("BAD SYNTH: no track"); } else tracks.push(synth);

  // Draw: every style once for the first recording, every frame of a broadcast cut timed.
  const W = 640, H = 360;
  const times: number[] = [];
  let pngs = 0;
  if (PNG) fs.mkdirSync(PNG, { recursive: true });
  for (const [ti, t] of tracks.slice(0, 3).entries()) {
    for (const style of ["broadcast", "reverse", "fan", "tiktok"] as const) {
      const edit = makeEdit([t], style, "new", ti);
      const surf = Skia.Surface.Make(edit.w, edit.h)!;
      const dur = editDuration(edit);
      const plan = planAudio(edit);
      const frames = Math.floor(dur * edit.fps);
      for (let f = 0; f < frames; f += style === "broadcast" ? 1 : 15) {
        // Recorded into a picture, as the phone does (JS only; the graphics chip draws it).
        const rec = Skia.PictureRecorder();
        const pc = rec.beginRecording(Skia.XYWHRect(0, 0, edit.w, edit.h));
        const ctx = new Ctx2D(Skia, pc, { width: edit.w, height: edit.h });
        const a = performance.now();
        try { withCanvasDocument(Skia, () => drawEditFrame(ctx as unknown as CanvasRenderingContext2D, edit, f / edit.fps)); }
        catch (e) { fail++; console.log(`DRAW FAILED ${style} frame ${f}: ${(e as Error).message}`); break; }
        const pic = rec.finishRecordingAsPicture();
        if (f > 0) times.push(performance.now() - a);
        if (PNG && pngs < 24 && (f === Math.floor(frames * 0.45) || f === 0)) {
          const cv = surf.getCanvas();
          cv.clear(Skia.Color("black"));
          cv.drawPicture(pic);
          surf.flush();
          fs.writeFileSync(path.join(PNG, `goal-${ti}-${style}-${f}.png`), Buffer.from(surf.makeImageSnapshot().encodeToBytes()));
          pngs++;
        }
        // CanvasKit's objects are freed by hand in node (the phone's are garbage-collected).
        (pic as unknown as { dispose?: () => void }).dispose?.();
        (rec as unknown as { dispose?: () => void }).dispose?.();
      }
      if (style === "broadcast") console.log(`  ${t.meta.scorer} ${t.meta.minuteLabel}: ${dur.toFixed(1)} s broadcast cut, ${plan.cues.length} sound cues (${plan.cues.map((q) => q.sound).join(", ")})`);
      void posterMoment; void W; void H;
    }
  }
  const q = (xs: number[], p: number) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  console.log(`\n${tracks.length} recordings (${tracks.length - (synth ? 1 : 0)} played, ${synth ? 1 : 0} made); goals on the pitch ${seenGoals}, with a recording ${withClip}`);
  if (times.length) console.log(`record one video frame (JS, through the canvas stand-in, into a picture): median ${q(times, 0.5).toFixed(2)} ms  p95 ${q(times, 0.95).toFixed(2)} ms  max ${Math.max(...times).toFixed(1)} ms`);
  console.log(fail ? `${fail} FAILED` : "All goal video checks passed.");
  process.exit(fail ? 1 : 0);
}
void main();
