/**
 * THE SOUND OF A GOAL VIDEO (Leo, 8 Oct 2026: "crowd noise and commentator
 * but a mute toggle too").
 *
 * Two parts:
 *  - planAudio(edit): pure numbers. Which sound plays when, how loud, from
 *    the recording's own kicks, saves and goal — so the boot hits the ball on
 *    the frame the video shows it. Tested on its own.
 *  - mixAudio(plan): mixes the plan into one stereo track on the phone
 *    (OfflineAudioContext), from the game's own sound files (public/sfx), so
 *    an admin's replacement on the Sound Board is used here too.
 *
 * What plays:
 *  - a crowd murmur under everything, rising as the shot comes, a roar at the
 *    goal;
 *  - the kick, the keeper's gloves, the net;
 *  - the commentator ("What a finish!") just after the goal, and a replay
 *    line over the slow motion. Not on a fan's phone video: a fan in the
 *    stand has no commentator, only the crowd round him, louder.
 *  - In slow motion the kick and the net play slower and deeper, and the
 *    crowd drops back.
 *
 * Never throws; a browser with no Web Audio gets null and the video is silent.
 */
import type { Edit } from "./edit";
import { shotLength } from "./edit";
import { sfxUrl } from "../sfx";

export const COMMENTARY_GOAL = ["comm-goal-1", "comm-goal-2", "comm-goal-3", "comm-goal-4", "comm-goal-5", "comm-goal-6"] as const;
export const COMMENTARY_REPLAY = ["comm-replay-1", "comm-replay-2", "comm-replay-3"] as const;

/** Every file a goal video may use. */
export const CLIP_SOUNDS = [
  "kick-hard", "kick-soft", "goal-net", "keeper-save", "crowd-cheer-stadium",
  ...COMMENTARY_GOAL, ...COMMENTARY_REPLAY,
] as const;
export type ClipSound = (typeof CLIP_SOUNDS)[number];

export interface Cue {
  /** Video seconds. */
  at: number;
  sound: ClipSound;
  /** 0..1. */
  gain: number;
  /** Playback speed: below 1 is slower and deeper (slow motion). */
  rate: number;
}

/** A point on the crowd murmur's loudness line. */
export interface BedPoint { at: number; gain: number }

export interface AudioPlan {
  duration: number;
  cues: Cue[];
  bed: BedPoint[];
}

/** Crowd murmur levels. */
export const BED_LIVE = 0.16;
export const BED_SHOT = 0.3;
export const BED_GOAL = 0.42;
export const BED_REPLAY = 0.08;

/** Seconds after the ball crosses the line that the commentator speaks. */
export const COMMENTARY_DELAY = 0.3;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * The sound plan for an edit. The same goal always gets the same lines (picked
 * from its id), so a video sounds the same every time it is made.
 */
export function planAudio(edit: Edit): AudioPlan {
  const cues: Cue[] = [];
  const bed: BedPoint[] = [];
  const fan = edit.style === "fan";
  let acc = 0;
  let goalNo = 0;
  // One starting line for the whole video, then the next one per goal, so a
  // reel never says the same thing twice in a row.
  const base = hash(edit.tracks[0]?.meta.id ?? "");
  edit.shots.forEach((s, si) => {
    const tr = edit.tracks[s.track];
    const len = shotLength(s);
    if (!tr || len <= 0) return;
    const out = (t: number) => acc + (t - s.from) / s.rate;
    const inShot = (t: number) => t >= s.from - 1e-6 && t <= s.to + 1e-6;
    const slow = s.replay || s.rate < 0.99;
    const rate = slow ? Math.max(0.5, s.rate + 0.2) : 1;
    const id = tr.meta.id || `${si}`;

    // The ball being played: kicks, the keeper's gloves.
    // One sound per touch: a strike wins over a touch logged at the same moment,
    // and a keeper who was beaten makes no glove sound.
    const strikes = tr.events.filter(e => e.kind === "shot").map(e => e.t);
    const nearStrike = (t: number) => strikes.some(st => Math.abs(st - t) < 0.08);
    for (const e of tr.events) {
      if (!inShot(e.t)) continue;
      if (e.kind === "shot") cues.push({ at: out(e.t), sound: "kick-hard", gain: slow ? 0.55 : 0.8, rate });
      else if ((e.kind === "pass" || e.kind === "clearance" || e.kind === "touch" || e.kind === "block") && !nearStrike(e.t)) {
        cues.push({ at: out(e.t), sound: "kick-soft", gain: slow ? 0.4 : 0.6, rate });
      } else if (e.kind === "save" && e.save !== "beaten") cues.push({ at: out(e.t), sound: "keeper-save", gain: 0.6, rate });
    }

    const goalIn = inShot(tr.goalT);
    if (goalIn) cues.push({ at: out(tr.goalT), sound: "goal-net", gain: slow ? 0.5 : 0.75, rate });

    if (!slow) {
      // The crowd: a murmur, rising from the strike, a roar at the goal.
      bed.push({ at: acc, gain: BED_LIVE });
      const strike = Math.max(s.from, Math.min(s.to, tr.strikeT));
      bed.push({ at: out(strike) - 0.6 < acc ? acc : out(strike) - 0.6, gain: BED_LIVE });
      bed.push({ at: out(strike), gain: BED_SHOT });
      if (goalIn) {
        bed.push({ at: out(tr.goalT), gain: BED_GOAL });
        cues.push({ at: Math.max(acc, out(tr.goalT) - 0.05), sound: "crowd-cheer-stadium", gain: fan ? 1 : 0.85, rate: 1 });
        if (!fan) {
          const line = COMMENTARY_GOAL[(base + goalNo) % COMMENTARY_GOAL.length];
          cues.push({ at: out(tr.goalT) + COMMENTARY_DELAY, sound: line, gain: 1, rate: 1 });
        }
        goalNo++;
      }
      bed.push({ at: acc + len, gain: goalIn ? BED_SHOT : BED_LIVE });
    } else {
      // The replay: the crowd drops back; the commentator talks over it.
      bed.push({ at: acc, gain: BED_REPLAY });
      bed.push({ at: acc + len, gain: BED_REPLAY });
      if (!fan) {
        const line = COMMENTARY_REPLAY[hash(id) % COMMENTARY_REPLAY.length];
        cues.push({ at: acc + 0.35, sound: line, gain: 0.95, rate: 1 });
      }
    }
    acc += len;
  });
  cues.sort((a, b) => a.at - b.at);
  bed.sort((a, b) => a.at - b.at);
  return { duration: acc, cues, bed };
}

// ── Mixing ──────────────────────────────────────────────────────────────────

export const MIX_RATE = 48000;
export const MIX_CHANNELS = 2;

/** The files' bytes, fetched once a session (decoded per mix). */
const bytes = new Map<ClipSound, Promise<ArrayBuffer | null>>();

function fetchBytes(name: ClipSound): Promise<ArrayBuffer | null> {
  let hit = bytes.get(name);
  if (!hit) {
    hit = fetch(sfxUrl(name))
      .then(r => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
    bytes.set(name, hit);
  }
  return hit;
}

function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer | null> {
  return new Promise<AudioBuffer | null>((res) => {
    try {
      // A copy: decoding takes the buffer away, and the bytes are reused.
      const p = ctx.decodeAudioData(data.slice(0), res, () => res(null));
      if (p && typeof (p as Promise<AudioBuffer>).then === "function") (p as Promise<AudioBuffer>).then(res, () => res(null));
    } catch { res(null); }
  });
}

/** Two seconds of crowd: pink noise, slowly swelling, a little different per ear. */
function crowdNoise(ctx: BaseAudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 4);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, seed = 12345 + ch * 777;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
    for (let i = 0; i < len; i++) {
      const w = rnd();
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      const t = i / ctx.sampleRate;
      // A slow swell of voices, so it never sounds like a hiss.
      const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * (0.5 * t + ch * 0.3)) * Math.sin(2 * Math.PI * 0.25 * t);
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11 * swell;
    }
    // Fade the ends into each other so the loop has no click.
    const f = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < f; i++) { const k = i / f; d[i] *= k; d[len - 1 - i] *= k; }
  }
  return buf;
}

/**
 * Mix the plan into one stereo track. Resolves null when this browser has no
 * Web Audio (the video is then silent). A missing file is just left out.
 */
export async function mixAudio(plan: AudioPlan): Promise<AudioBuffer | null> {
  if (typeof window === "undefined" || plan.duration <= 0) return null;
  const OAC = window.OfflineAudioContext
    || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OAC) return null;
  let ctx: OfflineAudioContext;
  try {
    ctx = new OAC(MIX_CHANNELS, Math.ceil(plan.duration * MIX_RATE), MIX_RATE);
  } catch { return null; }

  const names = Array.from(new Set(plan.cues.map(c => c.sound)));
  const decoded = new Map<ClipSound, AudioBuffer>();
  await Promise.all(names.map(async n => {
    const b = await fetchBytes(n);
    const a = b ? await decode(ctx, b) : null;
    if (a) decoded.set(n, a);
  }));

  // Everything goes through a gentle limiter so a roar plus a line never clips.
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -10;
  master.knee.value = 8;
  master.ratio.value = 6;
  master.attack.value = 0.005;
  master.release.value = 0.2;
  master.connect(ctx.destination);

  // The crowd murmur.
  if (plan.bed.length) {
    const src = ctx.createBufferSource();
    src.buffer = crowdNoise(ctx);
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900;
    band.Q.value = 0.45;
    const g = ctx.createGain();
    g.gain.setValueAtTime(plan.bed[0].gain, 0);
    for (const p of plan.bed) g.gain.linearRampToValueAtTime(p.gain, Math.max(0, p.at));
    src.connect(band); band.connect(g); g.connect(master);
    src.start(0);
  }

  for (const c of plan.cues) {
    const b = decoded.get(c.sound);
    if (!b || c.at >= plan.duration) continue;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = c.rate;
    const g = ctx.createGain();
    g.gain.value = c.gain;
    src.connect(g); g.connect(master);
    src.start(Math.max(0, c.at));
  }

  try {
    return await ctx.startRendering();
  } catch { return null; }
}
