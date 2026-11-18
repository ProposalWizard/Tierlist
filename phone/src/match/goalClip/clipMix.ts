/**
 * A GOAL VIDEO'S SOUND, MIXED INTO ONE TRACK — lib/star/goalClip/audio.ts
 * mixAudio (read-only) done in plain numbers, for the phone's "Save video".
 *
 * The website mixes the plan with Web Audio's OfflineAudioContext. The phone
 * has no Web Audio, so this is the same graph, node for node, by hand:
 *   - every cue's file at its time, gain and speed (a slow-motion kick plays
 *     slower and deeper: linear interpolation, as Web Audio's playbackRate);
 *     a one-channel file plays in both ears, as Web Audio up-mixes it;
 *   - the crowd murmur: the website's own pink noise (same seed, same swell,
 *     same 4 s loop) through its 900 Hz band-pass (Q 0.45), its loudness
 *     following the plan's bed line (linear ramps);
 *   - the pitch bus (murmur and effects) dips to DUCK while a commentator
 *     talks (setTargetAtTime, 0.06 s down, 0.25 s back);
 *   - the commentary box: 140 Hz low cut, +3 dB presence at 3.2 kHz (90 Hz
 *     and flat for the newer voices), times 1.2;
 *   - all through the limiter (threshold -10 dB, knee 8, ratio 6, attack
 *     5 ms, release 0.2 s, with Chrome's 6 ms look-ahead and its automatic
 *     make-up gain). The limiter's static curve is Chrome's own; its timing is
 *     a simpler one-pole follower, so a loud moment can differ by a fraction
 *     of a decibel from the website's file.
 * The biquads are the Web Audio spec's formulas (the Audio EQ Cookbook).
 * Not here: a cold edit's beat (plan.music; the phone makes no cold edits).
 *
 * Pure numbers, no phone APIs: tools/goal-video-mix.ts checks it headless.
 */
import { DUCK, MIX_RATE, type AudioPlan } from "@/lib/star/goalClip/audio";
import { commentaryTable, type CommentarySet } from "@/lib/star/goalClip/commentaryVoice";

/** One decoded sound file: its rate and channels (1 or 2). */
export interface Pcm { sampleRate: number; channels: Float32Array[] }

const isComm = (s: string) => s.startsWith("cl-") || s.startsWith("cc-");

// ── Biquads (Web Audio spec / Audio EQ Cookbook) ───────────────────────────

interface Bq { b0: number; b1: number; b2: number; a1: number; a2: number }
function norm(b0: number, b1: number, b2: number, a0: number, a1: number, a2: number): Bq {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
function bandpass(f: number, q: number, sr: number): Bq {
  const w = (2 * Math.PI * f) / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  return norm(al, 0, -al, 1 + al, -2 * c, 1 - al);
}
/** Web Audio's high-pass reads Q in decibels. */
function highpass(f: number, qDb: number, sr: number): Bq {
  const w = (2 * Math.PI * f) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * Math.pow(10, qDb / 20));
  return norm((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al);
}
function peaking(f: number, q: number, gainDb: number, sr: number): Bq {
  const w = (2 * Math.PI * f) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), A = Math.pow(10, gainDb / 40);
  return norm(1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A);
}
/** Filters one channel in place (direct form I). */
function runBq(f: Bq, x: Float32Array) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = f.b0 * x0 + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    x[i] = y0;
  }
}

// ── The crowd murmur (audio.ts crowdNoise, the same samples) ───────────────

let noise: { sr: number; ch: Float32Array[] } | null = null;
export function crowdNoise(sr: number): Float32Array[] {
  if (noise && noise.sr === sr) return noise.ch;
  const len = Math.floor(sr * 4);
  const out: Float32Array[] = [];
  for (let ch = 0; ch < 2; ch++) {
    const d = new Float32Array(len);
    let b0 = 0, b1 = 0, b2 = 0, seed = 12345 + ch * 777;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
    for (let i = 0; i < len; i++) {
      const w = rnd();
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      const t = i / sr;
      const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * (0.5 * t + ch * 0.3)) * Math.sin(2 * Math.PI * 0.25 * t);
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11 * swell;
    }
    const f = Math.floor(sr * 0.05);
    for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[len - 1 - i] *= k; }
    out.push(d);
  }
  noise = { sr, ch: out };
  return out;
}

// ── Chrome's limiter curve (DynamicsCompressorKernel) ──────────────────────

const db2lin = (db: number) => Math.pow(10, db / 20);
const lin2db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -1000);
function makeCurve(thresholdDb: number, kneeDb: number, ratio: number) {
  const linT = db2lin(thresholdDb);
  const kneeCurve = (x: number, k: number) => (x < linT ? x : linT + (1 - Math.exp(-k * (x - linT))) / k);
  const slopeAt = (x: number, k: number) => {
    if (x < linT) return 1;
    const x2 = x * 1.001;
    return (lin2db(kneeCurve(x2, k)) - lin2db(kneeCurve(x, k))) / (lin2db(x2) - lin2db(x));
  };
  const kneeX = db2lin(thresholdDb + kneeDb);
  let minK = 0.1, maxK = 10000, k = 5;
  for (let i = 0; i < 15; i++) {
    if (slopeAt(kneeX, k) < 1 / ratio) maxK = k; else minK = k;
    k = Math.sqrt(minK * maxK);
  }
  const kneeYDb = lin2db(kneeCurve(kneeX, k));
  const kneeXDb = lin2db(kneeX);
  const slope = 1 / ratio;
  const sat = (x: number) => (x < kneeX ? kneeCurve(x, k) : db2lin(kneeYDb + slope * (lin2db(x) - kneeXDb)));
  const makeup = Math.pow(1 / sat(1), 0.6);
  return { sat, makeup };
}

// ── Gain lines ─────────────────────────────────────────────────────────────

/** A setTargetAtTime list from a start value: the value at every sample. */
function targetLine(n: number, sr: number, start: number, events: { t: number; v: number; tau: number }[]): Float32Array {
  const ev = events.map((e, i) => ({ ...e, i })).sort((a, b) => a.t - b.t || a.i - b.i);
  const out = new Float32Array(n);
  let v = start, k = 0, cur: { t: number; v: number; tau: number } | null = null, v0 = start;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    while (k < ev.length && ev[k].t <= t) { v0 = cur ? cur.v + (v0 - cur.v) * Math.exp(-(ev[k].t - cur.t) / cur.tau) : v; cur = ev[k++]; }
    v = cur ? cur.v + (v0 - cur.v) * Math.exp(-(t - cur.t) / cur.tau) : start;
    out[i] = v;
  }
  return out;
}
/** setValueAtTime(first, 0) then linearRampToValueAtTime for each point. */
function rampLine(n: number, sr: number, pts: { at: number; gain: number }[]): Float32Array {
  const line = [{ t: 0, v: pts[0].gain }, ...pts.map((p) => ({ t: Math.max(0, p.at), v: p.gain }))];
  const out = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    while (j < line.length - 1 && line[j + 1].t <= t) j++;
    if (j >= line.length - 1) { out[i] = line[line.length - 1].v; continue; }
    const a = line[j], b = line[j + 1];
    out[i] = b.t > a.t ? a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t) : b.v;
  }
  return out;
}

/** Adds `src` at `at` seconds, `gain`, `rate` speed, into the stereo bus. */
function addSource(bus: Float32Array[], sr: number, src: Pcm, at: number, gain: number, rate: number) {
  const n = bus[0].length;
  const start = Math.max(0, Math.round(at * sr));
  const step = (rate * src.sampleRate) / sr;
  const len = src.channels[0].length;
  for (let ch = 0; ch < 2; ch++) {
    const s = src.channels[Math.min(ch, src.channels.length - 1)];
    const d = bus[ch];
    let p = 0;
    for (let i = start; i < n; i++, p += step) {
      const k = Math.floor(p);
      if (k >= len) break;
      const f = p - k;
      const a = s[k], b = k + 1 < len ? s[k + 1] : 0;
      d[i] += (a + (b - a) * f) * gain;
    }
  }
}

/**
 * Mix the plan into stereo at MIX_RATE (48 kHz). `files` holds the decoded
 * sound for each cue name; a missing one is left out, as on the website.
 * Returns null when there is nothing to mix.
 */
export function mixPlan(plan: AudioPlan, files: Map<string, Pcm>, sr = MIX_RATE): Float32Array[] | null {
  if (plan.duration <= 0) return null;
  const n = Math.ceil(plan.duration * sr);
  const voice: CommentarySet = plan.voice === "v2" || plan.voice === "teams" ? plan.voice : "v1";
  const table = commentaryTable(voice);
  const secs = (id: string) => table[id] ?? 1.8;

  // The pitch bus: the murmur and the effects.
  const pitch = [new Float32Array(n), new Float32Array(n)];
  if (plan.bed.length) {
    const nz = crowdNoise(sr);
    const bp = bandpass(900, 0.45, sr);
    const g = rampLine(n, sr, plan.bed);
    for (let ch = 0; ch < 2; ch++) {
      const src = nz[ch], d = pitch[ch];
      for (let i = 0; i < n; i++) d[i] = src[i % src.length];
      runBq(bp, d);
      for (let i = 0; i < n; i++) d[i] *= g[i];
    }
  }
  const box = [new Float32Array(n), new Float32Array(n)];
  for (const c of plan.cues) {
    const f = files.get(c.sound);
    if (!f || c.at >= plan.duration) continue;
    addSource(isComm(c.sound) ? box : pitch, sr, f, c.at, c.gain, c.rate);
  }
  // The dip while a commentator talks.
  const talk = plan.cues.filter((c) => isComm(c.sound) && files.has(c.sound));
  if (talk.length) {
    const ev: { t: number; v: number; tau: number }[] = [];
    for (const c of talk) {
      ev.push({ t: Math.max(0, c.at - 0.08), v: DUCK, tau: 0.06 });
      ev.push({ t: c.at + secs(c.sound), v: 1, tau: 0.25 });
    }
    const g = targetLine(n, sr, 1, ev);
    for (let ch = 0; ch < 2; ch++) { const d = pitch[ch]; for (let i = 0; i < n; i++) d[i] *= g[i]; }
  }
  // The commentary box.
  const lc = highpass(voice !== "v1" ? 90 : 140, 1, sr);
  const pr = peaking(3200, 0.9, voice !== "v1" ? 0 : 3, sr);
  for (let ch = 0; ch < 2; ch++) { runBq(lc, box[ch]); runBq(pr, box[ch]); }

  // The limiter.
  const { sat, makeup } = makeCurve(-10, 8, 6);
  const pre = Math.round(0.006 * sr);
  const attackFrames = 0.005 * sr;
  const rel = 1 - Math.exp(-1 / (0.2 * sr));
  // Chrome's detector: drops at once, comes back over 2.5 ms.
  const satRel = 1 - Math.pow(10, -1 / (0.0025 * sr));
  const out = [new Float32Array(n), new Float32Array(n)];
  const L = pitch[0], R = pitch[1];
  for (let i = 0; i < n; i++) { L[i] += box[0][i] * 1.2; R[i] += box[1][i] * 1.2; }
  // Look-ahead: the gain is read from the sound `pre` samples ahead of what it is applied to.
  // Chrome works on a warped gain (asin / sin) and attacks in proportion to how far off it is.
  const H = Math.PI / 2;
  let det = 1, g = 1;
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    const att = x > 1e-4 ? Math.min(1, sat(x) / x) : 1;
    det = att < det ? att : det + (att - det) * satRel;
    const want = Math.asin(Math.min(1, det)) / H;
    if (want < g) {
      const diffDb = Math.max(0.5, lin2db(g / Math.max(1e-6, want)));
      g += (want - g) * (1 - Math.pow(0.25 / diffDb, 1 / attackFrames));
    } else g += (want - g) * rel;
    const k = Math.sin(H * g) * makeup;
    const j = i - pre;
    if (j >= 0) { out[0][i] = L[j] * k; out[1][i] = R[j] * k; }
  }
  return out;
}

/** Stereo floats → interleaved 16-bit samples (what the phone's encoder takes). */
export function toPcm16(ch: Float32Array[]): Int16Array {
  const n = ch[0].length, k = ch.length;
  const out = new Int16Array(n * k);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < k; c++) {
      const v = Math.max(-1, Math.min(1, ch[c][i]));
      out[i * k + c] = Math.round(v < 0 ? v * 32768 : v * 32767);
    }
  }
  return out;
}

/** The encoder's decoded file (8-byte header: rate, channels; then 16-bit samples) → Pcm. */
export function pcmFromBytes(bytes: Uint8Array): Pcm | null {
  if (bytes.byteLength < 8) return null;
  const copy = bytes.slice();
  const dv = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  const sampleRate = dv.getInt32(0, true), chs = Math.max(1, Math.min(2, dv.getInt32(4, true)));
  const frames = Math.floor((copy.byteLength - 8) / (2 * chs));
  const channels = Array.from({ length: chs }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < chs; c++) channels[c][i] = dv.getInt16(8 + (i * chs + c) * 2, true) / 32768;
  }
  return sampleRate > 0 && frames > 0 ? { sampleRate, channels } : null;
}
