/**
 * THE DRIVE'S SOUND (driving phase 2, 28 Nov 2026). Every sound is MADE IN CODE (Web Audio synthesis):
 * no new files, 0 KB to download, nothing paid. It plays through the game's one audio output
 * (../audioOut.ts, the shared AudioContext), obeys Settings → Sound effects (../sfx.ts sfxOn, the
 * same switch as every other game sound), and the game music sits under it (../gameMusic.ts, the
 * "drive" scene: the lobby track at DRIVE_VOLUME).
 *
 * What plays when (the frame says what is happening; the player turns it into sound):
 *   always     the engine (pitch and loudness follow the speed, the gear and the Hold), the road under
 *              the tyres; a scrub on the tighter bends; a different engine for each car (CAR_ENGINES)
 *   lane change the indicator ticking
 *   the road   your street and the roundabout: a light town hum · the lane, the link, the compound:
 *              wind and birds · rain on the roof when it rains (louder from inside the car)
 *   events     Honk and wave: two toots, then the fan's cheer · the speed camera: the flash click
 *              (only when it caught you) · the race: your engine revs up, his engine beside you ·
 *              Pull over and help: your hazards tick · a lane change refused: one short toot
 *   the call   the phone rings on the dash (a UK double ring through the car's speakers); a click on answer
 *   arrival    the barrier's motor whirrs as the arm lifts (a clunk at the top), the engine stops in the bay,
 *              the door opens, the door shuts at the door moment, three footsteps as you get out
 *
 * Rules: nothing makes a sound before a tap (unlockDriveSound, called from the drive's own pointer and
 * key handlers, or the browser's own "the page has been tapped"); Sound effects off = no node is even
 * made; a hidden tab is silent; everything goes through one bus with a limiter so nothing clips.
 *
 * Pure (tested in tests/star/driveSound.mts): engineAt, ambienceFor, driveFrame, arrivalFrame, cuesBetween,
 * soundAllowed. The player (createDriveSound) takes its context and switch as arguments so a test can
 * hand it a fake one.
 */
import type { DriveCarId } from "./cars";
import type { PieceKind } from "./route";
import { at } from "./route";
import type { DriveSession, DriveCam } from "./drive";
import type { ArrivalSession } from "./arrival";

import { audioContext, resumeAudio } from "../audioOut";
import { sfxOn } from "../sfx";
import { setMusicScene, clearMusicScene } from "../gameMusic";

// ───────────────────────── pure: the engine ─────────────────────────

export interface EngineSpec {
  /** Cylinders: the firing note is rpm/60 × cyl/2. */
  cyl: number;
  idle: number;
  red: number;
  /** Top speed of each gear (m/s). */
  gears: number[];
  /** How open the tone is (the low-pass cut-off scale). */
  bright: number;
  /** How rough (noise in the note, 0..1). */
  rasp: number;
  /** Loudness (0..1 of the engine's share of the mix). */
  level: number;
}

/** A different engine per car: a buzzy little four in the hatch, a deep six in the SUV, a V8 in the supercar. */
export const CAR_ENGINES: Record<DriveCarId, EngineSpec> = {
  hatch: { cyl: 4, idle: 900, red: 6200, gears: [12, 21, 31, 41, 52], bright: 1.15, rasp: 0.35, level: 0.85 },
  family: { cyl: 4, idle: 820, red: 5600, gears: [12, 22, 32, 43, 55], bright: 0.9, rasp: 0.2, level: 0.8 },
  classic: { cyl: 4, idle: 850, red: 5200, gears: [13, 24, 36, 48], bright: 1.0, rasp: 0.6, level: 0.9 },
  suv: { cyl: 6, idle: 700, red: 5400, gears: [11, 19, 28, 38, 48, 58], bright: 0.75, rasp: 0.15, level: 0.85 },
  sports: { cyl: 6, idle: 950, red: 7400, gears: [15, 25, 36, 47, 58, 70], bright: 1.35, rasp: 0.3, level: 1 },
  super: { cyl: 8, idle: 1000, red: 8000, gears: [17, 28, 40, 52, 64, 76, 88], bright: 1.5, rasp: 0.4, level: 1 },
};

export interface EngineNote { gear: number; rpm: number; freq: number; gain: number; cutoff: number }

/**
 * The engine's note at speed v (m/s). Hold = it holds the gear longer and pulls harder (higher, louder);
 * accel > 0 adds load; rev (0..1) is the race's rev up. Pure.
 */
export function engineAt(v: number, hold: boolean, car: DriveCarId, accel = 0, rev = 0): EngineNote {
  const E = CAR_ENGINES[car] ?? CAR_ENGINES.hatch;
  // cruising changes up early (a calm 2,500-3,500 rpm); held, it hangs on to each gear (the pull you hear)
  const shift = hold ? 0.88 : 0.5;
  let g = 0;
  while (g < E.gears.length - 1 && v > E.gears[g] * shift) g++;
  const frac = Math.max(0, Math.min(1, v / E.gears[g]));
  const load = Math.max(0, Math.min(1, (hold ? 0.75 : 0.25) + Math.max(0, accel) * 0.18 + rev * 0.6));
  let rpm = E.idle + (E.red * 0.92 - E.idle) * frac * (hold ? 1.06 : 1);
  if (v < 0.3) rpm = E.idle;
  rpm = Math.min(E.red, rpm + rev * (E.red - rpm) * 0.55);
  const rf = (rpm - E.idle) / (E.red - E.idle);
  const gain = E.level * (0.42 + 0.33 * load + 0.25 * rf);
  const cutoff = (260 + rpm * 0.28 + load * 900) * E.bright;
  return { gear: g + 1, rpm, freq: (rpm / 60) * (E.cyl / 2), gain, cutoff };
}

// ───────────────────────── pure: the world around you ─────────────────────────

export type SoundRoad = PieceKind | "compound";

export interface Ambience { town: number; wind: number; birds: number; rain: number }

/** How loud each background layer is on this kind of road (0..1 of its share), and the rain. */
export function ambienceFor(road: SoundRoad, rain: number, cabin: boolean, v = 0): Ambience {
  const country = road === "lane" || road === "link" || road === "approach" || road === "park" || road === "compound";
  return {
    town: country ? 0 : 1,
    wind: country ? Math.min(1, 0.55 + v / 40) : 0.15,
    birds: country ? (road === "compound" ? 0.7 : 1) : 0.15,
    rain: Math.max(0, Math.min(1, rain)) * (cabin ? 1 : 0.7),
  };
}

/** One frame of what the sound needs to know. Built from the drive (driveFrame) or the arrival (arrivalFrame). */
export interface DriveSoundFrame {
  v: number;
  hold: boolean;
  accel: number;
  /** Sideways pull (m/s²): the tyres scrub past LAT_SCRUB. */
  lat: number;
  road: SoundRoad;
  rain: number;
  cabin: boolean;
  engineOn: boolean;
  /** 0..1: the screen's black (a skip, the hand-over). Sound fades with it, never to nothing mid-drive. */
  fade: number;
  indicator: boolean;
  hazards: boolean;
  ringing: boolean;
  answered: boolean;
  /** A refused lane change (the car's own horn). */
  blocked: boolean;
  honk: boolean;
  cheer: boolean;
  flash: boolean;
  race: boolean;
  /** The team-mate's car: 0 none … 1 right beside you, and his speed. */
  mate: number;
  mateV: number;
  /** The arrival: the barrier arm (0 down, 1 up), engine stopped, door open, door shut, out of the car. */
  lift: number;
  doorOpen: boolean;
  door: boolean;
  out: boolean;
}

export const LAT_SCRUB = 1.8;

const BASE: DriveSoundFrame = {
  v: 0, hold: false, accel: 0, lat: 0, road: "street", rain: 0, cabin: false, engineOn: true, fade: 0,
  indicator: false, hazards: false, ringing: false, answered: false, blocked: false, honk: false, cheer: false, flash: false,
  race: false, mate: 0, mateV: 0, lift: 0, doorOpen: false, door: false, out: false,
};

/** The frame for the drive (./drive.ts). */
export function driveFrame(S: DriveSession, hold: boolean, cam: DriveCam): DriveSoundFrame {
  const c = S.car, ev = S.event;
  const shown = S.eventState === "open" || S.eventState === "done";
  const m = S.mateCar;
  return {
    ...BASE,
    v: c.v, hold, accel: c.accel, lat: Math.abs(c.v * c.yawRate),
    road: at(S.route, c.s).kind, rain: S.rain, cabin: cam === "cabin", engineOn: S.phase !== "done", fade: S.fade,
    indicator: c.laneT < 1,
    hazards: ev?.id === "breakdown" && S.helping && shown,
    ringing: S.callState === "ringing",
    answered: S.callState === "answered" || (S.callState === "over" && (S.callAnswer === "yes" || S.callAnswer === "no")),
    blocked: c.horn > 0,
    honk: ev?.id === "fan-crossing" && S.eventAnswer === "yes",
    cheer: ev?.id === "fan-crossing" && S.eventAnswer === "yes" && S.eventState !== "waiting",
    flash: ev?.id === "speed-camera" && (S.eventState === "done" || S.eventState === "over") && !!S.outcome?.apply.money,
    race: S.raceT0 >= 0,
    mate: m ? Math.max(0, 1 - Math.abs(m.s - c.s) / 70) : 0,
    mateV: m ? m.v : 0,
  };
}

/** The frame for the arrival at the compound (./arrival.ts; drawn by world3d/testScene.ts). */
/** `doorAfter`: arrival.ts DOOR_AFTER_STOP (passed in, so the drive's screen never loads the compound's plan). */
export function arrivalFrame(A: ArrivalSession, lift: number, doorAfter: number): DriveSoundFrame {
  const c = A.car;
  const stopped = A.stoppedAt >= 0;
  return {
    ...BASE,
    v: c.v, accel: c.accel, lat: Math.abs(c.v * c.yawRate), road: "compound", fade: 0,
    engineOn: A.phase === "roll" && !A.skipped,
    lift: A.skipped ? 0 : lift,
    doorOpen: !A.skipped && stopped && A.t >= A.stoppedAt + 0.2,
    door: !A.skipped && stopped && A.t >= A.stoppedAt + doorAfter,
    out: A.phase === "out" || A.phase === "done",
  };
}

export type DriveCue =
  | "honk" | "cheer" | "flash" | "rev" | "blocked" | "pickup"
  | "barrier" | "barrier-stop" | "engine-off" | "door-open" | "door" | "steps";

/** The one-shot sounds due between two frames (each fires once, on the frame its moment starts). Pure. */
export function cuesBetween(prev: DriveSoundFrame | null, next: DriveSoundFrame): DriveCue[] {
  // no frame before: nothing fires for what is already so (a screen opened mid-moment)
  const p = prev ?? next;
  const out: DriveCue[] = [];
  const rose = (k: keyof DriveSoundFrame) => !!next[k] && !p[k];
  if (rose("honk")) out.push("honk");
  if (rose("cheer")) out.push("cheer");
  if (rose("flash")) out.push("flash");
  if (rose("race")) out.push("rev");
  if (rose("blocked")) out.push("blocked");
  if (rose("answered")) out.push("pickup");
  if (next.lift > 0.02 && p.lift <= 0.02) out.push("barrier");
  if (next.lift >= 0.995 && p.lift < 0.995) out.push("barrier-stop");
  if (p.engineOn && !next.engineOn && next.road === "compound") out.push("engine-off");
  if (rose("doorOpen")) out.push("door-open");
  if (rose("door")) out.push("door");
  if (rose("out")) out.push("steps");
  return out;
}

/** May the drive make a sound now? A tap first, the context running, Sound effects on, the tab in view. */
export function soundAllowed(x: { tapped: boolean; state: string | undefined; on: boolean; hidden: boolean }): boolean {
  return x.tapped && x.state === "running" && x.on && !x.hidden;
}

/** The ring's pattern (a UK double ring): on 0-0.4, on 0.6-1.0, quiet to 3.0 s. */
export const RING = { period: 3, tones: [[0, 0.4], [0.6, 1.0]] as [number, number][], freqs: [400, 450] };
/** The indicator / hazards: one tick every this many seconds (about 85 a minute, a real relay's rate). */
export const TICK_S = 0.36;
/** The music's level under the drive (gameMusic.ts "drive" scene). */
export { DRIVE_VOLUME } from "../gameMusic";
/** New audio files the drive downloads (bytes). Everything is synthesised: none. */
export const DRIVE_SOUND_FILES: string[] = [];

// ───────────────────────── the tap ─────────────────────────

let tapped = false;
/** Call from a tap or key on the drive: browsers (and iPhones) allow sound only after one. */
export function unlockDriveSound(): void {
  tapped = true;
  try { resumeAudio(); } catch { /* no audio */ }
}
function hasTapped(): boolean {
  if (tapped) return true;
  try {
    const ua = (navigator as unknown as { userActivation?: { hasBeenActive?: boolean } }).userActivation;
    if (ua?.hasBeenActive) { tapped = true; return true; }
  } catch { /* no navigator */ }
  return false;
}
/** Tests only: forget the tap. */
export function resetDriveSoundTap(): void { tapped = false; }

// ───────────────────────── the player (browser) ─────────────────────────

export interface DriveSoundPlayer {
  update(f: DriveSoundFrame, dt: number): void;
  dispose(): void;
  /** Hand the music back (its own level) while the sound itself carries on: the arrival, once you are out. */
  releaseMusic(): void;
  /** Whether the sound graph has been made (false until the first allowed frame). */
  readonly built: boolean;
}

export interface DriveSoundDeps {
  car: DriveCarId;
  /** The context (default: the game's shared one, ../audioOut.ts). */
  ctx?: () => AudioContext | null;
  /** The switch (default: Settings → Sound effects, ../sfx.ts). */
  on?: () => boolean;
  /** Was there a tap (default: unlockDriveSound or the browser's own sticky activation). */
  tapped?: () => boolean;
  /** Duck the game music under the drive (default true; ../gameMusic.ts). */
  music?: boolean;
}

/** One output for every drive sound (and the arrival's): a level, then a limiter, then the speakers. */
const buses = new WeakMap<AudioContext, { input: GainNode; out: AudioNode; taps: MediaStreamAudioDestinationNode[] }>();
function busOf(ctx: AudioContext) {
  let b = buses.get(ctx);
  if (!b) {
    const input = ctx.createGain(); input.gain.value = 0.9;
    const lim = ctx.createDynamicsCompressor();
    try { lim.threshold.value = -8; lim.knee.value = 3; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.18; } catch { /* old browser */ }
    const trim = ctx.createGain(); trim.gain.value = 0.95;
    input.connect(lim); lim.connect(trim); trim.connect(ctx.destination);
    b = { input, out: trim, taps: [] };
    buses.set(ctx, b);
  }
  return b;
}

/** The drive's sound as a stream (the proof recorder: MediaRecorder on it). Browser only. */
export function driveSoundStream(ctx: AudioContext): MediaStream | null {
  try {
    const b = busOf(ctx);
    const d = ctx.createMediaStreamDestination();
    b.out.connect(d); b.taps.push(d);
    return d.stream;
  } catch { return null; }
}

const noiseOf = new WeakMap<AudioContext, AudioBuffer>();
function noise(ctx: AudioContext): AudioBuffer {
  let b = noiseOf.get(ctx);
  if (!b) {
    const n = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 22222;
    for (let i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
    noiseOf.set(ctx, b);
  }
  return b;
}

const rnd = (() => { let s = 987654321; return () => { s = (s * 48271) % 2147483647; return s / 2147483647; }; })();

/** The drive's player. Never throws; no window / no Web Audio = silence. */
export function createDriveSound(deps: DriveSoundDeps): DriveSoundPlayer {
  const getCtx = deps.ctx ?? (() => audioContext());
  const isOn = deps.on ?? (() => { try { return sfxOn(); } catch { return true; } });
  const wasTapped = deps.tapped ?? hasTapped;
  let music = deps.music !== false && !deps.ctx;
  let musicSet = false;

  let g: Graph | null = null;
  let prev: DriveSoundFrame | null = null;
  let dead = false;
  let rev = 0;
  let nextTick = 0, tickN = 0, nextBird = 0, nextDrop = 0, ringT0 = -1, ringNext = 0, lastLog = -1;

  const player: DriveSoundPlayer = {
    get built() { return !!g; },
    update(f, dt) {
      if (dead) return;
      try {
        const ctx = getCtx();
        const hidden = typeof document !== "undefined" && !!document.hidden;
        const on = isOn();
        const ok = soundAllowed({ tapped: wasTapped(), state: ctx?.state, on, hidden });
        if (music && !musicSet) { musicSet = true; setMusicScene("drive", { kind: "drive" }, 10); }
        if (!ctx) return;
        if (!g) {
          if (!ok) { prev = f; return; }
          g = build(ctx, deps.car);
          nextBird = ctx.currentTime + 1.2;
        }
        const now = ctx.currentTime;
        // the whole drive: silent when not allowed; dips with the black (a skip, the hand-over)
        g.master.gain.setTargetAtTime(ok ? 1 - f.fade * 0.8 : 0, now, 0.08);
        if (!ok) { prev = f; return; }
        const cues = cuesBetween(prev, f);
        prev = f;
        rev = Math.max(0, rev - dt / 1.6);
        for (const c of cues) {
          if (c === "rev") { rev = 1; burst(g, now, 0.25, "lowpass", 500, 0.7, 0.05); }
          else oneShot(g, c, now);
        }
        // ── the engine ──
        const e = engineAt(f.v, f.hold, deps.car, f.accel, rev);
        // a listening log for the proof recorder (scripts/drive3d/sound-proof.mjs sets window.__driveSoundLog = [])
        const lg = (globalThis as { __driveSoundLog?: unknown[] }).__driveSoundLog;
        if (Array.isArray(lg)) { cues.forEach((c) => lg.push([+now.toFixed(2), c])); if (now - lastLog >= 0.5) { lastLog = now; lg.push([+now.toFixed(2), "engine", +f.v.toFixed(1), Math.round(e.rpm), e.gear, f.road, f.engineOn ? "on" : "off", f.hold ? "hold" : "", f.indicator ? "indicator" : "", f.ringing ? "ringing" : "", f.hazards ? "hazards" : ""]); } }
        const engGain = f.engineOn ? e.gain * 0.2 * (f.cabin ? 0.85 : 1) : 0;
        g.eng.f.frequency.setTargetAtTime(e.freq, now, f.engineOn ? 0.06 : 0.35);
        g.eng.sub.frequency.setTargetAtTime(e.freq * 0.5, now, f.engineOn ? 0.06 : 0.35);
        g.eng.hi.frequency.setTargetAtTime(e.freq * 2.01, now, f.engineOn ? 0.06 : 0.35);
        g.eng.lp.frequency.setTargetAtTime(Math.min(5000, e.cutoff * (f.cabin ? 0.7 : 1)), now, 0.08);
        g.eng.rasp.frequency.setTargetAtTime(Math.min(6000, e.freq * 4), now, 0.06);
        g.eng.gain.gain.setTargetAtTime(engGain, now, f.engineOn ? 0.05 : 0.25);
        // ── the road under the tyres, and a scrub on the bends ──
        g.roar.gain.setTargetAtTime(Math.min(0.07, f.v * 0.0026), now, 0.1);
        g.roarLp.frequency.setTargetAtTime(300 + f.v * 22, now, 0.1);
        g.scrub.gain.setTargetAtTime(Math.min(0.045, Math.max(0, f.lat - LAT_SCRUB) * 0.016) * Math.min(1, f.v / 6), now, 0.08);
        // ── the team-mate's engine beside you ──
        const me = engineAt(f.mateV, true, "sports", 0.5, 0);
        g.mate.f.frequency.setTargetAtTime(me.freq, now, 0.08);
        g.mate.lp.frequency.setTargetAtTime(me.cutoff, now, 0.08);
        g.mate.gain.gain.setTargetAtTime(f.mate * 0.11, now, 0.12);
        // ── the world ──
        const a = ambienceFor(f.road, f.rain, f.cabin, f.v);
        g.town.gain.setTargetAtTime(a.town * 0.06, now, 0.8);
        g.wind.gain.setTargetAtTime(a.wind * 0.04, now, 0.8);
        g.rain.gain.setTargetAtTime(a.rain * 0.11, now, 0.5);
        if (a.birds > 0.3 && now >= nextBird) { birds(g, now, a.birds); nextBird = now + 0.9 + rnd() * 2.6; }
        if (a.rain > 0.15 && now >= nextDrop) { drop(g, now, a.rain); nextDrop = now + 0.05 + rnd() * 0.12 / a.rain; }
        // ── the indicator / hazards ──
        if (f.indicator || f.hazards) {
          if (now >= nextTick) { tick(g, now, tickN++ % 2 === 0, f.cabin ? 0.09 : 0.055); nextTick = now + TICK_S; }
        } else { nextTick = now + 0.02; tickN = 0; }
        // ── the phone on the dash ──
        if (f.ringing) {
          if (ringT0 < 0) { ringT0 = now; ringNext = 0; }
          // schedule the next tone a little ahead
          for (;;) {
            const cycle = Math.floor(ringNext / RING.tones.length);
            const [a0, a1] = RING.tones[ringNext % RING.tones.length];
            const t0 = ringT0 + cycle * RING.period + a0;
            if (t0 > now + 0.15) break;
            if (t0 >= now - 0.05) ringTone(g, Math.max(now, t0), a1 - a0);
            ringNext++;
          }
        } else ringT0 = -1;
      } catch { /* sound never breaks the drive */ }
    },
    releaseMusic() { if (music && musicSet) { clearMusicScene("drive"); music = false; } },
    dispose() {
      if (dead) return;
      dead = true;
      if (music && musicSet) clearMusicScene("drive");
      const gg = g; g = null;
      if (!gg) return;
      try {
        const ctx = gg.ctx, t = ctx.currentTime;
        gg.master.gain.cancelScheduledValues(t); gg.master.gain.setValueAtTime(gg.master.gain.value, t);
        gg.master.gain.linearRampToValueAtTime(0, t + 0.25);
        setTimeout(() => { gg.loops.forEach((s) => { try { s.stop(); } catch { /* gone */ } }); try { gg.master.disconnect(); } catch { /* gone */ } }, 400);
      } catch { /* gone */ }
    },
  };
  return player;
}

// ───────────────────────── the graph ─────────────────────────

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  /** One-shots go here (the same master). */
  fx: GainNode;
  loops: (OscillatorNode | AudioBufferSourceNode)[];
  eng: { f: OscillatorNode; sub: OscillatorNode; hi: OscillatorNode; lp: BiquadFilterNode; rasp: BiquadFilterNode; gain: GainNode };
  mate: { f: OscillatorNode; lp: BiquadFilterNode; gain: GainNode };
  roar: GainNode; roarLp: BiquadFilterNode; scrub: GainNode;
  town: GainNode; wind: GainNode; rain: GainNode;
}

function osc(ctx: AudioContext, type: OscillatorType, f: number): OscillatorNode { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function gain(ctx: AudioContext, v: number): GainNode { const x = ctx.createGain(); x.gain.value = v; return x; }
function filt(ctx: AudioContext, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
function noiseSrc(ctx: AudioContext, loop = true): AudioBufferSourceNode {
  const s = ctx.createBufferSource(); s.buffer = noise(ctx); s.loop = loop;
  if (loop) { try { s.loopStart = 0; s.loopEnd = s.buffer.duration; } catch { /* fine */ } }
  return s;
}
function pan(ctx: AudioContext, p: number, into: AudioNode): AudioNode {
  try {
    if (typeof ctx.createStereoPanner === "function") { const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(into); return n; }
  } catch { /* old Safari */ }
  return into;
}

function build(ctx: AudioContext, car: DriveCarId): Graph {
  const E = CAR_ENGINES[car] ?? CAR_ENGINES.hatch;
  const master = gain(ctx, 0);
  master.connect(busOf(ctx).input);
  const fx = gain(ctx, 1); fx.connect(master);
  const loops: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const t = ctx.currentTime;

  // the engine: the firing note (saw), half of it (square: the body), double (a little edge), rough noise, one low-pass
  const ef = osc(ctx, "sawtooth", 40), sub = osc(ctx, "square", 20), hi = osc(ctx, "sawtooth", 80);
  const lp = filt(ctx, "lowpass", 800, 1.1);
  const eg = gain(ctx, 0);
  const g1 = gain(ctx, 0.55), g2 = gain(ctx, 0.35 + (E.cyl >= 6 ? 0.15 : 0)), g3 = gain(ctx, 0.12 * E.bright);
  ef.connect(g1); sub.connect(g2); hi.connect(g3); g1.connect(lp); g2.connect(lp); g3.connect(lp);
  const rn = noiseSrc(ctx), rasp = filt(ctx, "bandpass", 300, 1.4), rg = gain(ctx, 0.9 * E.rasp);
  rn.connect(rasp); rasp.connect(rg); rg.connect(lp);
  // a phone speaker plays nothing under ~70 Hz: cut it, so the limiter is not spent on rumble nobody hears
  const hp = filt(ctx, "highpass", 70, 0.7);
  lp.connect(hp); hp.connect(eg); eg.connect(master);
  loops.push(ef, sub, hi, rn);

  // the road: low noise by speed; the scrub: a band of noise on the bends
  const rdn = noiseSrc(ctx), roarLp = filt(ctx, "lowpass", 400), roar = gain(ctx, 0);
  rdn.connect(roarLp); roarLp.connect(roar); roar.connect(master);
  const scn = noiseSrc(ctx), scBp = filt(ctx, "bandpass", 1700, 2.2), scrub = gain(ctx, 0);
  scn.connect(scBp); scBp.connect(scrub); scrub.connect(master);
  loops.push(rdn, scn);

  // the team-mate's car (to your right, the other lane)
  const mf = osc(ctx, "sawtooth", 60), mlp = filt(ctx, "lowpass", 900, 1), mg = gain(ctx, 0);
  mf.connect(mlp); mlp.connect(mg); mg.connect(pan(ctx, 0.45, master));
  loops.push(mf);

  // town: a low far hum and far traffic; wind: soft low noise, slowly breathing; rain: a hiss on the roof
  const tn = noiseSrc(ctx), tLp = filt(ctx, "lowpass", 170), tBp = filt(ctx, "bandpass", 450, 0.8), tB = gain(ctx, 0.3), town = gain(ctx, 0);
  tn.connect(tLp); tn.connect(tBp); tBp.connect(tB); tLp.connect(town); tB.connect(town); town.connect(master);
  const hum = osc(ctx, "triangle", 100), humG = gain(ctx, 0.12); hum.connect(humG); humG.connect(town);
  const wn = noiseSrc(ctx), wLp = filt(ctx, "lowpass", 380, 0.5), wMod = gain(ctx, 1), wind = gain(ctx, 0);
  const lfo = osc(ctx, "sine", 0.13), lfoG = gain(ctx, 0.45); lfo.connect(lfoG); lfoG.connect(wMod.gain);
  wn.connect(wLp); wLp.connect(wMod); wMod.connect(wind); wind.connect(master);
  const rnn = noiseSrc(ctx), rHp = filt(ctx, "highpass", 1300), rLp = filt(ctx, "lowpass", 7000), rain = gain(ctx, 0);
  rnn.connect(rHp); rHp.connect(rLp); rLp.connect(rain); rain.connect(master);
  loops.push(tn, hum, wn, lfo, rnn);

  // start every loop at a different place in the noise (no two layers in step)
  loops.forEach((s, i) => { try { if ("buffer" in s && (s as AudioBufferSourceNode).buffer) (s as AudioBufferSourceNode).start(t, (i * 0.37) % 1.9); else s.start(t); } catch { /* fine */ } });
  master.gain.setValueAtTime(0, t);
  return { ctx, master, fx, loops, eng: { f: ef, sub, hi, lp, rasp, gain: eg }, mate: { f: mf, lp: mlp, gain: mg }, roar, roarLp, scrub, town, wind, rain };
}

// ───────────────────────── one-shots ─────────────────────────

/** An envelope on a fresh gain: up in `a`, held to `hold`, down by `end` (exponential tail). */
function env(ctx: AudioContext, into: AudioNode, t: number, peak: number, a: number, hold: number, end: number): GainNode {
  const x = gain(ctx, 0); x.connect(into);
  x.gain.setValueAtTime(0.0001, t);
  x.gain.linearRampToValueAtTime(peak, t + a);
  x.gain.setValueAtTime(peak, t + Math.max(a, hold));
  x.gain.exponentialRampToValueAtTime(0.0001, t + end);
  return x;
}
function burst(g: Graph, t: number, dur: number, type: BiquadFilterType, f: number, q: number, peak: number, p = 0) {
  const ctx = g.ctx;
  const s = noiseSrc(ctx, false), bf = filt(ctx, type, f, q);
  const e = env(ctx, p ? pan(ctx, p, g.fx) : g.fx, t, peak, 0.002, 0.004, dur);
  s.connect(bf); bf.connect(e);
  s.start(t, rnd() * 1.5); s.stop(t + dur + 0.02);
}
function tone(g: Graph, t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, into?: AudioNode) {
  const ctx = g.ctx;
  const o = osc(ctx, type, f0);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const e = env(ctx, into ?? g.fx, t, peak, 0.004, dur * 0.3, dur);
  o.connect(e); o.start(t); o.stop(t + dur + 0.02);
}

function horn(g: Graph, t: number, len: number, peak: number) {
  const ctx = g.ctx;
  const lp = filt(ctx, "lowpass", 2200, 0.8);
  const e = env(ctx, g.fx, t, peak, 0.012, len - 0.03, len + 0.06);
  lp.connect(e);
  for (const f of [415, 523]) { const o = osc(ctx, "square", f); const og = gain(ctx, 0.5); o.connect(og); og.connect(lp); o.start(t); o.stop(t + len + 0.08); }
}

/** A voice (a sawtooth through three formants): the fan's "yeah!", "wa-hey!". */
function shout(g: Graph, t: number, f0: [number, number, number], vowels: [number, number, number][], dur: number, peak: number, p: number) {
  const ctx = g.ctx;
  const src = osc(ctx, "sawtooth", f0[0]);
  src.frequency.setValueAtTime(f0[0], t);
  src.frequency.linearRampToValueAtTime(f0[1], t + dur * 0.3);
  src.frequency.linearRampToValueAtTime(f0[2], t + dur);
  const vib = osc(ctx, "sine", 5.8), vg = gain(ctx, 7); vib.connect(vg); vg.connect(src.frequency);
  const out = env(ctx, pan(ctx, p, g.fx), t, peak, 0.04, dur * 0.65, dur);
  const qs = [7, 11, 13], lv = [1, 0.55, 0.25];
  for (let k = 0; k < 3; k++) {
    const bf = filt(ctx, "bandpass", vowels[0][k], qs[k]);
    vowels.forEach((v, i) => { bf.frequency.linearRampToValueAtTime(v[k], t + (dur * (i + 0.2)) / vowels.length); });
    const lg = gain(ctx, lv[k] * 3); src.connect(bf); bf.connect(lg); lg.connect(out);
  }
  // breath
  const n = noiseSrc(ctx, false), nb = filt(ctx, "bandpass", 1800, 1); const ng = env(ctx, out, t, 0.25, 0.03, dur * 0.4, dur);
  n.connect(nb); nb.connect(ng); n.start(t, rnd()); n.stop(t + dur + 0.05);
  src.start(t); vib.start(t); src.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
}

function tick(g: Graph, t: number, on: boolean, peak: number) {
  burst(g, t, 0.012, "bandpass", on ? 2900 : 2200, 4, peak, -0.25);
  tone(g, t, "square", on ? 1500 : 1150, on ? 1400 : 1050, 0.012, peak * 0.35);
}
function ringTone(g: Graph, t: number, len: number) {
  const ctx = g.ctx;
  // through the car's speakers: telephone band only
  const bp = filt(ctx, "bandpass", 900, 0.5);
  const e = env(ctx, bp, t, 0.12, 0.01, len - 0.02, len + 0.03);
  bp.connect(g.fx);
  for (const f of RING.freqs) { const o = osc(ctx, "sine", f); o.connect(e); o.start(t); o.stop(t + len + 0.05); }
  // the iconic UK ring is two tones beating at 50 Hz: add a little edge so a phone speaker carries it
  const o2 = osc(ctx, "triangle", 850); const e2 = env(ctx, bp, t, 0.04, 0.01, len - 0.02, len + 0.03); o2.connect(e2); o2.start(t); o2.stop(t + len + 0.05);
}
function birds(g: Graph, t: number, level: number) {
  const n = 2 + Math.floor(rnd() * 4), base = 2600 + rnd() * 1800, p = rnd() * 1.4 - 0.7;
  const into = pan(g.ctx, p, g.fx);
  for (let i = 0; i < n; i++) {
    const tt = t + i * (0.08 + rnd() * 0.06);
    const up = rnd() > 0.4;
    tone(g, tt, "sine", base * (up ? 0.85 : 1.3), base * (up ? 1.35 : 0.9), 0.05 + rnd() * 0.05, 0.022 * level, into);
  }
}
function drop(g: Graph, t: number, level: number) {
  burst(g, t, 0.01 + rnd() * 0.012, "bandpass", 2500 + rnd() * 3000, 1.5, (0.03 + rnd() * 0.05) * level, rnd() * 1.6 - 0.8);
}

function oneShot(g: Graph, c: DriveCue, now: number) {
  const ctx = g.ctx;
  switch (c) {
    case "honk": horn(g, now + 0.02, 0.17, 0.22); horn(g, now + 0.32, 0.26, 0.22); break;
    case "blocked": horn(g, now + 0.01, 0.22, 0.15); break;
    case "cheer":
      // he waves back: "yeah!", a whoop, from across the road (left)
      shout(g, now + 0.75, [250, 340, 300], [[300, 2300, 3000], [700, 1750, 2600], [650, 1700, 2500]], 0.55, 0.3, 0.35);
      shout(g, now + 1.45, [280, 420, 380], [[350, 900, 2400], [300, 870, 2250]], 0.5, 0.22, 0.35);
      break;
    case "flash":
      // the flash's charge whine, then the shutter
      tone(g, now, "sine", 1800, 5200, 0.3, 0.025);
      burst(g, now + 0.3, 0.02, "bandpass", 3200, 1.2, 0.3);
      tone(g, now + 0.3, "sine", 900, 400, 0.05, 0.16);
      burst(g, now + 0.37, 0.015, "highpass", 4000, 0.7, 0.14);
      break;
    case "pickup": burst(g, now, 0.02, "bandpass", 1800, 2, 0.12); tone(g, now + 0.01, "sine", 1200, 1200, 0.06, 0.04); break;
    case "barrier": {
      // the arm's motor: a geared whirr rising as it lifts (about a second and a half)
      const len = 1.5;
      const m = osc(ctx, "sawtooth", 95); m.frequency.setValueAtTime(95, now); m.frequency.linearRampToValueAtTime(150, now + len * 0.6); m.frequency.linearRampToValueAtTime(120, now + len);
      const bp = filt(ctx, "bandpass", 700, 3), e = env(ctx, pan(ctx, -0.2, g.fx), now, 0.2, 0.12, len - 0.25, len);
      m.connect(bp); bp.connect(e); m.start(now); m.stop(now + len + 0.05);
      tone(g, now + 0.05, "sine", 1050, 1350, len - 0.1, 0.018);
      break;
    }
    case "barrier-stop": tone(g, now, "sine", 160, 70, 0.12, 0.14); burst(g, now, 0.05, "bandpass", 900, 1.5, 0.08); break;
    case "engine-off": burst(g, now + 0.05, 0.08, "lowpass", 300, 0.7, 0.06); break;
    case "door-open": burst(g, now, 0.03, "bandpass", 2200, 2, 0.12); burst(g, now + 0.05, 0.09, "lowpass", 900, 0.7, 0.07); break;
    case "door":
      // the body's thump, the latch, a little rattle
      tone(g, now, "sine", 95, 42, 0.22, 0.42);
      burst(g, now, 0.13, "lowpass", 420, 0.8, 0.3);
      burst(g, now + 0.015, 0.012, "bandpass", 2600, 3, 0.15);
      burst(g, now + 0.06, 0.05, "bandpass", 1300, 2, 0.05);
      break;
    case "steps":
      for (let i = 0; i < 3; i++) {
        const tt = now + 0.35 + i * 0.47;
        burst(g, tt, 0.06, "bandpass", 850 + (i % 2) * 150, 1.1, 0.14, i % 2 ? 0.1 : -0.1);
        tone(g, tt, "sine", 130, 70, 0.06, 0.07);
        burst(g, tt + 0.05, 0.03, "highpass", 3000, 0.7, 0.03);
      }
      break;
    case "rev": break;
  }
}
