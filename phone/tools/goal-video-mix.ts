/**
 * THE SAVED GOAL VIDEO'S SOUND, HEADLESS.
 *
 *   cd phone && npx tsx tools/goal-video-mix.ts [--wav DIR]
 *
 * Makes a goal (lib/star/goalClip/synth.ts), cuts it four ways (broadcast,
 * behind the goal, fan, TikTok), plans its sound (lib/star/goalClip/audio.ts
 * planAudio) and mixes it with src/match/goalClip/clipMix.ts, the phone's
 * stand-in for the website's Web Audio mix. The sound files are the phone's
 * bundled ones (src/match/assets/clip), decoded here with ffmpeg (on the phone
 * the encoder module decodes them). Checks: the mix is as long as the video,
 * is not silent, peaks under 1.5 (the website's own mix measured 1.03), and
 * every cue in the plan is heard (the mix without it is quieter where it plays). --wav writes each mix as a WAV to listen to.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { makeEdit, editDuration, type ClipStyle } from "@/lib/star/goalClip/edit";
import { planAudio, MIX_RATE } from "@/lib/star/goalClip/audio";
import { synthTrack } from "@/lib/star/goalClip/synth";
import { mixPlan, toPcm16, type Pcm } from "../src/match/goalClip/clipMix";

(globalThis as Record<string, unknown>).window ??= {};
const args = process.argv.slice(2);
const WAV = args.includes("--wav") ? args[args.indexOf("--wav") + 1] : null;
const dir = path.join(__dirname, "../src/match/assets/clip");

function decode(name: string): Pcm | null {
  const f = path.join(dir, `${name}.mp3`);
  if (!fs.existsSync(f)) return null;
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", f, "-f", "f32le", "-ac", "1", "-"], { maxBuffer: 1 << 28 });
  const rate = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", f]).toString().trim());
  const ch = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  return { sampleRate: rate, channels: [ch] };
}

function wav(pcm: Int16Array, rate: number): Buffer {
  const b = Buffer.alloc(44 + pcm.byteLength);
  b.write("RIFF", 0); b.writeUInt32LE(36 + pcm.byteLength, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(pcm.byteLength, 40);
  Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).copy(b, 44);
  return b;
}

const t = synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: true, minute: 63, scoreAfter: [1, 0], seed: "mix-1" })!;
let bad = 0;
if (WAV) fs.mkdirSync(WAV, { recursive: true });
for (const style of ["broadcast", "reverse", "fan", "tiktok"] as ClipStyle[]) {
  const edit = makeEdit([t], style, "new", 0);
  const plan = planAudio(edit);
  const files = new Map<string, Pcm>();
  for (const n of new Set(plan.cues.map((c) => c.sound))) { const p = decode(n); if (p) files.set(n, p); }
  const a = performance.now();
  const mix = mixPlan(plan, files, MIX_RATE)!;
  const ms = performance.now() - a;
  const n = mix[0].length;
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) { const v = Math.max(Math.abs(mix[0][i]), Math.abs(mix[1][i])); peak = Math.max(peak, v); sum += mix[0][i] ** 2; }
  const rmsDb = 10 * Math.log10(sum / n + 1e-12);
  const missing = [...new Set(plan.cues.map((c) => c.sound))].filter((s) => !files.has(s));
  // Every cue is heard: where it plays (0.3 s), the mix minus the mix without it is
  // no more than 20 dB under what else is playing.
  const unheard = plan.cues.filter((c) => c.at < plan.duration - 0.1).filter((c) => {
    const without = mixPlan({ ...plan, cues: plan.cues.filter((x) => x !== c) }, files, MIX_RATE)!;
    const i0 = Math.floor(c.at * MIX_RATE), i1 = Math.min(n, i0 + Math.floor(0.3 * MIX_RATE));
    let d = 0, b = 0;
    for (let i = i0; i < i1; i++) for (let ch = 0; ch < 2; ch++) { d += (mix[ch][i] - without[ch][i]) ** 2; b += without[ch][i] ** 2; }
    return 10 * Math.log10((d + 1e-12) / (b + 1e-12)) < -20;
  });
  const okLen = Math.abs(n / MIX_RATE - editDuration(edit)) < 0.05;
  // The website's own mix peaks a little over 1 too (measured 1.03); the file clips the rest, as there.
  const ok = okLen && peak < 1.5 && rmsDb > -40 && !missing.length && !unheard.length;
  if (!ok) bad++;
  console.log(`${style.padEnd(9)} ${(n / MIX_RATE).toFixed(2)} s (video ${editDuration(edit).toFixed(2)} s), ${plan.cues.length} cues, peak ${peak.toFixed(3)}, level ${rmsDb.toFixed(1)} dB, mixed in ${ms.toFixed(0)} ms` +
    (missing.length ? `; MISSING ${missing.join(",")}` : "") + (unheard.length ? `; not heard: ${unheard.map((c) => `${c.sound}@${c.at.toFixed(2)} gain ${c.gain.toFixed(2)} rate ${c.rate}`).join(",")}` : "") + (ok ? "" : "  <- FAIL"));
  if (WAV) fs.writeFileSync(path.join(WAV, `${style}.wav`), wav(toPcm16(mix), MIX_RATE));
}
if (bad) { console.log(`${bad} cut(s) failed`); process.exit(1); }
console.log("goal video mix: ok");
