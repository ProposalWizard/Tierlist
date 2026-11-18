/**
 * "SAVE VIDEO", HEADLESS: the file the phone would write, made here with
 * ffmpeg standing in for the phone's encoder.
 *
 *   cd phone && npx tsx tools/goal-video-file.ts [--out DIR]
 *
 * Runs the phone's own pipeline up to the encoder: a made goal
 * (lib/star/goalClip/synth.ts) cut four ways, every frame drawn by
 * src/match/goalClip/videoFrames.ts (render.ts on the phone's sprite sheets,
 * through CanvasKit), the sound planned (planAudio) and mixed by clipMix.ts
 * from the bundled files. The RGBA frames and the 16-bit mix go to ffmpeg
 * with the phone encoder's settings (H.264 Baseline, the website's bit rate,
 * a key frame every 2 s, AAC 96 kb/s 48 kHz stereo) instead of MediaCodec.
 * Prints size, length and frames; checks the file's length matches the edit;
 * --out keeps the MP4s and a still from the middle of each.
 * A desktop CPU on CanvasKit, not a phone: the drawing times are relative.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { makeEdit, editDuration, editFrameCount, clipFileName, type ClipStyle } from "@/lib/star/goalClip/edit";
import { planAudio, MIX_RATE } from "@/lib/star/goalClip/audio";
import { synthTrack } from "@/lib/star/goalClip/synth";
import { setSkia } from "../src/match/skiaApi";
import { setSpriteSheet, setAtlas, type SpriteIndex } from "../src/match/sprites";
import { videoFrameReader } from "../src/match/goalClip/videoFrames";
import { mixPlan, toPcm16, type Pcm } from "../src/match/goalClip/clipMix";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
const args = process.argv.slice(2);
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : fs.mkdtempSync(path.join(os.tmpdir(), "goal-video-"));
const clipDir = path.join(__dirname, "../src/match/assets/clip");

function decode(name: string): Pcm | null {
  const f = path.join(clipDir, `${name}.mp3`);
  if (!fs.existsSync(f)) return null;
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", f, "-f", "f32le", "-ac", "1", "-"], { maxBuffer: 1 << 28 });
  const rate = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", f]).toString().trim());
  return { sampleRate: rate, channels: [new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))] };
}
const bitrateFor = (w: number, h: number) => Math.round(Math.min(4_000_000, Math.max(900_000, w * h * 30 * 0.22)));

async function main() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  setSkia(Skia);
  const dir = path.join(__dirname, "../src/match/assets/sprites");
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as SpriteIndex;
  const img = (f: string) => Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(path.join(dir, f)))))!;
  setSpriteSheet(idx, img("atlas-0.webp"), img("mask-0.webp"));
  for (let n = 1; n <= 5; n++) setAtlas(n, img(`atlas-${n}.webp`), img(`mask-${n}.webp`));
  fs.mkdirSync(OUT, { recursive: true });

  const t = synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: true, minute: 63, scoreAfter: [1, 0], seed: "file-1" })!;
  let bad = 0;
  for (const style of ["broadcast", "reverse", "fan", "tiktok"] as ClipStyle[]) {
    const edit = makeEdit([t], style, "new", 0);
    const { w, h, fps } = edit;
    const plan = planAudio(edit);
    const files = new Map<string, Pcm>();
    for (const n of new Set(plan.cues.map((c) => c.sound))) { const p = decode(n); if (p) files.set(n, p); }
    const pcm = toPcm16(mixPlan(plan, files, MIX_RATE)!);
    const wav = path.join(OUT, `${style}.pcm`);
    fs.writeFileSync(wav, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
    const name = path.join(OUT, clipFileName(edit.tracks, "mp4", edit.style));
    const ff = spawn("ffmpeg", ["-v", "error", "-y",
      "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${w}x${h}`, "-r", String(fps), "-i", "-",
      "-f", "s16le", "-ar", String(MIX_RATE), "-ac", "2", "-i", wav,
      "-c:v", "libx264", "-profile:v", "baseline", "-pix_fmt", "yuv420p", "-b:v", String(bitrateFor(w, h)), "-g", String(fps * 2),
      "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", name], { stdio: ["pipe", "inherit", "inherit"] });
    const done = new Promise<number>((r) => ff.on("close", (c) => r(c ?? 1)));
    const frames = videoFrameReader(Skia, w, h);
    const n = editFrameCount(edit);
    const ms: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = performance.now();
      const px = frames.read(edit, i / fps);
      ms.push(performance.now() - a);
      if (px.length !== w * h * 4) throw new Error(`frame ${i} is ${px.length} bytes`);
      if (!ff.stdin.write(Buffer.from(px.buffer, px.byteOffset, px.byteLength))) await new Promise((r) => ff.stdin.once("drain", r));
    }
    frames.dispose();
    ff.stdin.end();
    if ((await done) !== 0) { console.log(`${style}: ffmpeg failed`); bad++; continue; }
    fs.rmSync(wav);
    const probe = (k: string, s: string) => execFileSync("ffprobe", ["-v", "error", "-select_streams", s, "-show_entries", k, "-of", "csv=p=0", name]).toString().trim();
    const vDur = Number(probe("stream=duration", "v:0")), aDur = Number(probe("stream=duration", "a:0"));
    const size = fs.statSync(name).size;
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", (editDuration(edit) / 2).toFixed(2), "-i", name, "-frames:v", "1", path.join(OUT, `${style}-middle.png`)]);
    const med = [...ms].sort((x, y) => x - y)[Math.floor(ms.length / 2)];
    const ok = Math.abs(vDur - editDuration(edit)) < 0.1 && Math.abs(aDur - editDuration(edit)) < 0.15;
    if (!ok) bad++;
    console.log(`${style.padEnd(9)} ${w}x${h} ${fps} fps, ${n} frames (${editDuration(edit).toFixed(2)} s): video ${vDur.toFixed(2)} s, sound ${aDur.toFixed(2)} s, ${(size / 1024).toFixed(0)} KB; draw+read a frame median ${med.toFixed(1)} ms${ok ? "" : "  <- FAIL"}`);
  }
  console.log(`files in ${OUT}`);
  if (bad) process.exit(1);
  console.log("goal video file: ok");
}
main().catch((e) => { console.error(e); process.exit(1); });
