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
import type { GoalTrack } from "./track";
import { frameAt } from "./track";
import {
  pickCall, pickLine, pickReplayLine, SCORE_LINES, REEL_LINES, REPLAY_LINES, allCommentaryLines,
  type FinishTag, type ScoreTag,
} from "./commentary";
import { COMMENTARY_SECONDS } from "./commentaryDurations";

/** The effects a goal video may use (the commentary lines are the rest). */
export const EFFECT_SOUNDS = ["kick-hard", "kick-soft", "goal-net", "keeper-save", "crowd-cheer-stadium"] as const;
/** Every file a goal video may use. */
export const CLIP_SOUNDS: string[] = [...EFFECT_SOUNDS, ...allCommentaryLines().map(l => l.id)];
export type ClipSound = string;

/** The shortest co-commentator line, seconds. */
const MIN_REPLAY_LINE = Math.min(...Object.values(REPLAY_LINES).flat().map(l => COMMENTARY_SECONDS[l.id] ?? 2.5));
const isComm = (s: string) => s.startsWith("cl-") || s.startsWith("cc-");
const secs = (id: string) => COMMENTARY_SECONDS[id] ?? 1.8;

/** How the goal went in, for the commentator. */
export function finishOf(tr: GoalTrack): FinishTag {
  const strike = tr.events.filter(e => e.kind === "shot" && e.t <= tr.goalT + 0.05).pop();
  const mode = strike?.mode;
  if (mode === "header") return "header";
  if (mode === "volley") return "volley";
  if (mode === "chip") return "chip";
  const how = tr.meta.how;
  if (how === "penalty" || how === "free_kick" || how === "corner" || how === "rebound"
    || how === "tight_angle" || how === "one_on_one" || how === "cutback" || how === "header" || how === "volley") return how;
  const at = frameAt(tr, Math.max(0, tr.strikeT)).ball;
  if (at.y > 21) return "long_range";
  if (how === "long_range") return "long_range";
  if (mode === "curl") return "curl";
  return "generic";
}

/** What the goal did to the score, from the scorer's side. */
export function scoreTagOf(tr: GoalTrack): ScoreTag {
  const sa = tr.meta.scoreAfter;
  if (!sa) return "none";
  const us = tr.meta.youAreHome ? sa[0] : sa[1];
  const them = tr.meta.youAreHome ? sa[1] : sa[0];
  if (us + them === 1) return "opener";
  if (us === them) return "level";
  if (us < them) return "consolation";
  if (us - them >= 3) return "rout";
  if (us - them === 1) return tr.meta.minute >= 80 ? "late_winner" : "ahead";
  return "none";
}

/** How many saves the keeper made before it went in. */
function savesOf(tr: GoalTrack): number {
  return tr.events.filter(e => e.kind === "save" && e.save !== "beaten" && e.t < tr.goalT).length;
}

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
/** The pitch's level while a commentator is talking. */
export const DUCK = 0.55;

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
  const total = edit.shots.reduce((a, sh) => a + shotLength(sh), 0);
  // The commentators never talk over each other or over themselves.
  let voiceFree = 0;
  const used: string[] = [];
  // Video time of the next goal after shot `si` (a reel), or the end.
  const nextGoalAt = (si: number): number => {
    let a = 0;
    for (let i = 0; i < edit.shots.length; i++) {
      const sh = edit.shots[i];
      const t2 = edit.tracks[sh.track];
      if (i > si && t2 && !sh.replay && t2.goalT >= sh.from && t2.goalT <= sh.to) return a + (t2.goalT - sh.from) / sh.rate;
      a += shotLength(sh);
    }
    return a;
  };
  edit.shots.forEach((s, si) => {
    const tr = edit.tracks[s.track];
    const len = shotLength(s);
    if (!tr || len <= 0) return;
    const out = (t: number) => acc + (t - s.from) / s.rate;
    const inShot = (t: number) => t >= s.from - 1e-6 && t <= s.to + 1e-6;
    const slow = s.replay || s.rate < 0.99;
    const rate = slow ? Math.max(0.5, s.rate + 0.2) : 1;
    // A TikTok cut's slow-down is still "live" for the crowd and the call.
    const liveShot = !s.replay;
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

    if (liveShot) {
      // The crowd: a murmur, rising from the strike, a roar at the goal.
      bed.push({ at: acc, gain: BED_LIVE });
      const strike = Math.max(s.from, Math.min(s.to, tr.strikeT));
      bed.push({ at: out(strike) - 0.6 < acc ? acc : out(strike) - 0.6, gain: BED_LIVE });
      bed.push({ at: out(strike), gain: BED_SHOT });
      if (goalIn) {
        bed.push({ at: out(tr.goalT), gain: BED_GOAL });
        cues.push({ at: Math.max(acc, out(tr.goalT) - 0.05), sound: "crowd-cheer-stadium", gain: fan ? 1 : 0.85, rate: 1 });
        if (!fan) {
          // The call, then (if there is room before the next goal) what it means.
          const call = pickCall(finishOf(tr), `${id}:${base}:${goalNo}`, used);
          used.push(call.id);
          const at = Math.max(out(tr.goalT) + COMMENTARY_DELAY, voiceFree);
          cues.push({ at, sound: call.id, gain: 1, rate: 1 });
          voiceFree = at + secs(call.id) + 0.15;
          const tag = scoreTagOf(tr);
          const nextGoal = nextGoalAt(si);
          // Leave room for the co-commentator over the replay, if there is one.
          const replayAfter = edit.shots.some((sh, k) => k > si && sh.replay);
          const keep = replayAfter && edit.style !== "tiktok" ? MIN_REPLAY_LINE + 0.4 : 0;
          if (tag !== "none") {
            const say = pickLine(SCORE_LINES[tag], `${id}:score`, used);
            if (voiceFree + secs(say.id) + keep < Math.min(nextGoal, total) - 0.2) {
              cues.push({ at: voiceFree, sound: say.id, gain: 1, rate: 1 });
              used.push(say.id);
              voiceFree += secs(say.id) + 0.25;
            }
          }
        }
        goalNo++;
      }
      bed.push({ at: acc + len, gain: goalIn ? BED_SHOT : BED_LIVE });
    } else {
      // The replay: the crowd drops back; the commentator talks over it.
      bed.push({ at: acc, gain: BED_REPLAY });
      bed.push({ at: acc + len, gain: BED_REPLAY });
      if (!fan && edit.style !== "tiktok") {
        // A reel: a line about the game first, if there is room.
        const reel = edit.tracks.length > 1;
        const lines = [
          ...(reel ? [pickLine(REEL_LINES, `${id}:reel`, used)] : []),
          pickReplayLine(finishOf(tr), savesOf(tr), `${id}:replay`, used),
        ];
        for (let line of lines) {
          const at = Math.max(acc + 0.35, voiceFree);
          if (at + secs(line.id) > total + 0.1) {
            // Too long for the time left: the longest line that still fits.
            const room = total + 0.1 - at;
            const fits = Object.values(REPLAY_LINES).flat().filter(l => !used.includes(l.id) && secs(l.id) <= room);
            if (!fits.length) continue;
            line = pickLine(fits, `${id}:fit`);
          }
          cues.push({ at, sound: line.id, gain: 0.95, rate: 1 });
          used.push(line.id);
          voiceFree = at + secs(line.id) + 0.3;
        }
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
  const decodedOk = (n: string) => decoded.has(n);
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

  // The pitch (crowd, ball) and the commentary box are two buses. While a
  // commentator talks, the pitch dips a little, as on a real broadcast.
  const pitchBus = ctx.createGain();
  pitchBus.connect(master);
  const talk = plan.cues.filter(c => isComm(c.sound) && decodedOk(c.sound));
  pitchBus.gain.setValueAtTime(1, 0);
  for (const c of talk) {
    const end = c.at + secs(c.sound);
    pitchBus.gain.setTargetAtTime(DUCK, Math.max(0, c.at - 0.08), 0.06);
    pitchBus.gain.setTargetAtTime(1, end, 0.25);
  }
  // The commentary box: a broadcast mic — no rumble, a little presence.
  const lowCut = ctx.createBiquadFilter();
  lowCut.type = "highpass";
  lowCut.frequency.value = 140;
  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 3200;
  presence.Q.value = 0.9;
  presence.gain.value = 3;
  const boxGain = ctx.createGain();
  boxGain.gain.value = 1.2;
  lowCut.connect(presence); presence.connect(boxGain); boxGain.connect(master);

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
    src.connect(band); band.connect(g); g.connect(pitchBus);
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
    src.connect(g); g.connect(isComm(c.sound) ? lowCut : pitchBus);
    src.start(Math.max(0, c.at));
  }

  try {
    return await ctx.startRendering();
  } catch { return null; }
}
