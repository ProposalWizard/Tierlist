// Procedural sound effects for the canvas match engine — Web Audio synthesis,
// zero asset dependencies (no SFX files were supplied). Each play*() function
// is a self-contained call; if real recorded SFX are added later under
// public/star/sfx/*.mp3, swap the body of the relevant function for an
// <audio>/decodeAudioData playback and every call site stays the same.

import { audioContext } from "./audioOut";
import { makeSoundGate, nowMs } from "./soundGate";
import { sfxOn, sfxUrl } from "./sfx";
import { soundSet } from "./style3d/texturePack";

let ctx: AudioContext | null = null;
let muted = false;
/** v0.25 item 6: the same match sound is not repeated on top of itself (soundGate.ts). */
const gate = makeSoundGate();
/** May this one play now? Muted in the match, Settings → Sound effects off, or too soon: no. */
function may(name: string): boolean {
  if (!ctx || muted) return false;
  try { if (!sfxOn()) return false; } catch { /* no storage: on */ }
  return gate(name, nowMs());
}

export function setMatchSoundMuted(m: boolean) {
  muted = m;
}

export function isMatchSoundMuted() {
  return muted;
}

// Must be called from inside a user-gesture handler (pointerdown) — browsers
// block AudioContext output until one has happened.
export function primeMatchSound() {
  if (typeof window === "undefined") return;
  // One context for the whole game, shared with the UI sounds (audioOut.ts):
  // iOS allows only a few per page.
  if (!ctx) ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (soundSet() === "arcade") MATCH_FILES.forEach(decodeFile);
  // The header thump plays in every sound set (Match feel: New): loaded up front.
  decodeFile("match-header");
}

// ── The Arcade set's files (Harry, 14 Oct 2026; scripts/sfx/arcade.py) ──
// The pass thud, the goal sting and the crowd swell play from public/sfx,
// decoded once on the shared context and kept. A file that has not loaded
// yet, or failed, falls back to the sound made in code below. sfxUrl() means
// a Sound Board replacement is used when there is one.
// Only the Arcade texture pack plays them (texturePack.ts soundSet); every
// other pack keeps the sounds made in code, exactly as before.
type MatchFile = "match-pass" | "match-goal" | "match-crowd" | "match-header";
const MATCH_FILES: MatchFile[] = ["match-pass", "match-goal", "match-crowd"];
const fileBuffers = new Map<MatchFile, AudioBuffer | null | "loading">();

function decodeFile(name: MatchFile) {
  const c = ctx;
  if (!c || fileBuffers.has(name) || typeof fetch === "undefined") return;
  fileBuffers.set(name, "loading");
  fetch(sfxUrl(name))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("no file"))))
    .then((data) => new Promise<AudioBuffer>((res, rej) => {
      // The callback form: old iOS Safari has no promise-returning decodeAudioData.
      const p = c.decodeAudioData(data, res, rej);
      if (p && typeof (p as Promise<AudioBuffer>).then === "function") (p as Promise<AudioBuffer>).then(res, rej);
    }))
    .then((b) => { fileBuffers.set(name, b); })
    .catch(() => { fileBuffers.set(name, null); });
}

/** Play a decoded file now. False when it is not ready (the caller makes its own sound instead). */
function playFile(name: MatchFile, gain: number, anySet = false): boolean {
  if (!ctx || (!anySet && soundSet() !== "arcade")) return false;
  const b = fileBuffers.get(name);
  if (!b || b === "loading") { decodeFile(name); return false; }
  try {
    const src = ctx.createBufferSource();
    src.buffer = b;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(ctx.destination);
    src.start(now());
    return true;
  } catch {
    return false;
  }
}

function now(): number {
  return ctx?.currentTime ?? 0;
}

// A gain node with a quick linear attack and an exponential decay to silence.
function envGain(duration: number, peak: number, attack = 0.006): GainNode | null {
  if (!ctx) return null;
  const g = ctx.createGain();
  const t = now();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + duration);
  g.connect(ctx.destination);
  return g;
}

function tone(freq: number, duration: number, type: OscillatorType, peak: number, glideTo?: number) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  const t = now();
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(glideTo, t + duration);
  const g = envGain(duration, peak);
  if (!g) return;
  osc.connect(g);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function noiseBurst(duration: number, peak: number, filterFreq: number, filterQ = 1, type: BiquadFilterType = "bandpass") {
  if (!ctx || muted) return;
  const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;
  const g = envGain(duration, peak, 0.002);
  if (!g) return;
  src.connect(filter);
  filter.connect(g);
  src.start(now());
}

// PLUG-IN (optional asset): boot-on-ball thump, ~0.15s, /public/star/sfx/kick.mp3
export function playKick() {
  if (!may("kick")) return;
  if (playFile("match-pass", 0.85)) return; // Arcade pass thud
  tone(120, 0.12, "sine", 0.55, 55);
  noiseBurst(0.08, 0.22, 1800, 0.7, "bandpass");
}

// PLUG-IN (optional asset): net ripple/rustle, ~0.35s, /public/star/sfx/net.mp3
export function playNet() {
  if (!may("net")) return;
  noiseBurst(0.32, 0.35, 2600, 0.5, "bandpass");
  noiseBurst(0.22, 0.18, 5200, 0.4, "highpass");
}

/** The goal sting (Arcade set): a bright, rising brass stab. Plays with the net and the crowd. */
export function playGoalSting() {
  if (soundSet() !== "arcade" || !may("goal-sting")) return;
  if (playFile("match-goal", 0.85)) return;
  // Not loaded yet: a rising stab made here, still nothing like the pass.
  tone(392, 0.12, "sawtooth", 0.12, 523);
  tone(523, 0.6, "sawtooth", 0.1);
  tone(659, 0.6, "sawtooth", 0.07);
  tone(784, 0.6, "triangle", 0.08);
}

// PLUG-IN (optional asset): metallic woodwork clang, ~0.5s, /public/star/sfx/post.mp3
export function playPost() {
  if (!may("post")) return;
  tone(880, 0.5, "triangle", 0.4, 760);
  tone(1320, 0.45, "sine", 0.22, 1180);
}

// PLUG-IN (optional asset): glove catch / block thud, ~0.15s, /public/star/sfx/save.mp3
export function playSave() {
  if (!may("save")) return;
  tone(180, 0.14, "sine", 0.4, 90);
  noiseBurst(0.1, 0.25, 700, 1.2, "lowpass");
}

// PLUG-IN (optional asset): referee whistle, ~0.25s, /public/star/sfx/whistle.mp3
export function playWhistle() {
  if (!may("whistle") || !ctx) return;
  const osc = ctx.createOscillator();
  osc.type = "square";
  const t = now();
  osc.frequency.setValueAtTime(2200, t);
  osc.frequency.linearRampToValueAtTime(2450, t + 0.05);
  osc.frequency.linearRampToValueAtTime(2200, t + 0.1);
  osc.frequency.linearRampToValueAtTime(2450, t + 0.15);
  const g = envGain(0.22, 0.18, 0.01);
  if (!g) return;
  osc.connect(g);
  osc.start(t);
  osc.stop(t + 0.25);
}

// PLUG-IN (optional asset): crowd cheer / groan swell, ~1-1.6s,
// /public/star/sfx/crowd-cheer.mp3 and /public/star/sfx/crowd-groan.mp3
export function playCrowdSwell(kind: "cheer" | "groan") {
  if (!may(`crowd-${kind}`) || !ctx) return;
  // Arcade crowd swell: 5 dB under the options page's set A (Harry: "a bit too loud").
  if (kind === "cheer" && playFile("match-crowd", 1)) return;
  const dur = kind === "cheer" ? 1.6 : 0.9;
  const peak = kind === "cheer" ? 0.28 : 0.16;
  const freq = kind === "cheer" ? 1400 : 500;
  noiseBurst(dur, peak, freq, 0.6, "bandpass");
  if (kind === "cheer") noiseBurst(dur * 0.8, peak * 0.6, freq * 2.2, 0.4, "highpass");
}

// ── Match feel: New (lib/star/matchFeel.ts) ── the heavier, layered sounds.
// Each scales with how hard it was; Old never calls these.

/** A strike: a deep thump (bassier and louder with power), a leather crack on
 *  top for a clean hit, or a dull lowpassed scuff for a bad one. */
export function playStrike(power: number, gain: number, bass: number, scuff: boolean) {
  if (!may("kick") || !(gain > 0)) return;
  const p = Math.max(0, Math.min(1, power));
  if (scuff) {
    tone(150, 0.1, "sine", 0.35 * gain, 80);
    noiseBurst(0.09, 0.3 * gain, 500, 0.8, "lowpass");
    return;
  }
  // Body: a low sine that drops, longer and deeper the harder it is.
  tone(95 + 45 * (1 - bass), 0.1 + 0.12 * p, "sine", (0.45 + 0.4 * p) * gain, 38 + 14 * (1 - bass));
  // Sub thud under it for a big one.
  if (p > 0.45) tone(60, 0.16 + 0.08 * p, "sine", 0.35 * p * gain, 32);
  // Leather crack: a bright, very short burst.
  noiseBurst(0.035 + 0.03 * p, (0.18 + 0.32 * p) * gain, 2600 + 1600 * p, 0.9, "bandpass");
  // Boot on turf.
  noiseBurst(0.07, 0.12 * gain, 900, 0.7, "lowpass");
}

/** Your header (headers piece 5, 22 Oct 2026): public/sfx/match-header.mp3, a
 *  forehead-on-ball thump with a small crowd "ooh" under it (made in code:
 *  scripts/sfx/header.py, CC0). Any sound set. Until the file has loaded, a
 *  round thump made here instead. */
export function playHeader(power: number, gain: number) {
  if (!may("kick") || !(gain > 0)) return;
  const p = Math.max(0, Math.min(1, power));
  if (playFile("match-header", (0.75 + 0.35 * p) * gain, true)) return;
  tone(210, 0.16, "sine", (0.5 + 0.3 * p) * gain, 90);
  tone(540, 0.05, "sine", 0.18 * gain, 500);
  noiseBurst(0.03, 0.2 * gain, 1400, 0.8, "lowpass");
}

/** The ball landing: a soft thud, heavier from higher up. */
export function playThud(v: number, gain: number) {
  if (!may("thud") || !(gain > 0)) return;
  const k = Math.max(0, Math.min(1, v));
  tone(110, 0.09 + 0.05 * k, "sine", (0.12 + 0.3 * k) * gain, 55);
  noiseBurst(0.06, (0.05 + 0.12 * k) * gain, 600, 0.8, "lowpass");
}

/** Woodwork: a ringing metal clang, louder for a harder shot. */
export function playClang(v: number, gain: number) {
  if (!may("clang") || !(gain > 0)) return;
  const k = Math.max(0.3, Math.min(1, v));
  tone(640, 0.7, "triangle", 0.35 * k * gain, 600);
  tone(1710, 0.5, "sine", 0.18 * k * gain, 1650);
  tone(2930, 0.3, "sine", 0.08 * k * gain, 2900);
  noiseBurst(0.04, 0.3 * k * gain, 3500, 1.2, "bandpass");
}

/** The ball smacking into the keeper's gloves. */
export function playGlove(v: number, gain: number, held: boolean) {
  if (!may("glove") || !(gain > 0)) return;
  const k = Math.max(0.25, Math.min(1, v));
  tone(held ? 140 : 190, held ? 0.16 : 0.1, "sine", (0.3 + 0.3 * k) * gain, held ? 70 : 100);
  noiseBurst(0.05, (0.22 + 0.25 * k) * gain, held ? 900 : 1800, 1.1, "bandpass");
}

// ── BIG MOMENTS (Leo, 22 Oct 2026; lib/star/bigMoment.ts) ──
// 85'+, level or one down, a chance falls to you: the crowd rises and a
// heartbeat beats under the sound until the chance is over. Made in code.

/** A murmur that swells over ~2 s: the crowd getting to its feet. */
export function playCrowdRise() {
  if (!may("crowd-rise") || !ctx) return;
  const c = ctx, t = now(), dur = 2.2;
  const size = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, size, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass"; f.Q.value = 0.7;
  f.frequency.setValueAtTime(500, t);
  f.frequency.linearRampToValueAtTime(1300, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + dur * 0.85);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(t); src.stop(t + dur + 0.05);
}

/** A heartbeat (lub-dub, ~72 a minute) until the returned stop is called (or 20 s). */
export function startHeartbeat(): () => void {
  if (!ctx || muted) return () => {};
  try { if (!sfxOn()) return () => {}; } catch { /* no storage: on */ }
  const c = ctx;
  let stopped = false;
  const beat = (at: number, peak: number) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(62, at);
    o.frequency.exponentialRampToValueAtTime(38, at + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
    o.connect(g); g.connect(c.destination);
    o.start(at); o.stop(at + 0.2);
  };
  const period = 60 / 72;
  let next = now() + 0.05, n = 0;
  const tick = () => {
    if (stopped || n > 24) return;
    while (next < now() + 0.25) { beat(next, 0.55); beat(next + 0.17, 0.38); next += period; n++; }
    timer = setTimeout(tick, 120);
  };
  let timer: ReturnType<typeof setTimeout> = setTimeout(tick, 0);
  return () => { stopped = true; clearTimeout(timer); };
}

/** The big roar for a late goal: the usual cheer and a longer, deeper wall of noise. */
export function playBigRoar() {
  if (!may("crowd-roar") || !ctx) return;
  noiseBurst(3.2, 0.3, 900, 0.5, "bandpass");
  noiseBurst(2.6, 0.2, 2600, 0.4, "highpass");
  noiseBurst(3.0, 0.16, 260, 0.7, "lowpass");
}
