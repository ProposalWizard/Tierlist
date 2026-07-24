// Procedural sound effects for the canvas match engine — Web Audio synthesis,
// zero asset dependencies (no SFX files were supplied). Each play*() function
// is a self-contained call; if real recorded SFX are added later under
// public/star/sfx/*.mp3, swap the body of the relevant function for an
// <audio>/decodeAudioData playback and every call site stays the same.

let ctx: AudioContext | null = null;
let muted = false;

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
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
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
  tone(120, 0.12, "sine", 0.55, 55);
  noiseBurst(0.08, 0.22, 1800, 0.7, "bandpass");
}

// PLUG-IN (optional asset): net ripple/rustle, ~0.35s, /public/star/sfx/net.mp3
export function playNet() {
  noiseBurst(0.32, 0.35, 2600, 0.5, "bandpass");
  noiseBurst(0.22, 0.18, 5200, 0.4, "highpass");
}

// PLUG-IN (optional asset): metallic woodwork clang, ~0.5s, /public/star/sfx/post.mp3
export function playPost() {
  tone(880, 0.5, "triangle", 0.4, 760);
  tone(1320, 0.45, "sine", 0.22, 1180);
}

// PLUG-IN (optional asset): glove catch / block thud, ~0.15s, /public/star/sfx/save.mp3
export function playSave() {
  tone(180, 0.14, "sine", 0.4, 90);
  noiseBurst(0.1, 0.25, 700, 1.2, "lowpass");
}

// PLUG-IN (optional asset): referee whistle, ~0.25s, /public/star/sfx/whistle.mp3
export function playWhistle() {
  if (!ctx || muted) return;
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
  if (!ctx || muted) return;
  const dur = kind === "cheer" ? 1.6 : 0.9;
  const peak = kind === "cheer" ? 0.28 : 0.16;
  const freq = kind === "cheer" ? 1400 : 500;
  noiseBurst(dur, peak, freq, 0.6, "bandpass");
  if (kind === "cheer") noiseBurst(dur * 0.8, peak * 0.6, freq * 2.2, 0.4, "highpass");
}
