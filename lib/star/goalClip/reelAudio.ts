/**
 * YOUR SEASON IN ONE VIDEO — the sound: the crowd for every goal, the
 * commentator over the goal of the season, and a music bed from the game's
 * own tracks (public/star/music) underneath.
 *
 * The crowd part reuses the goal videos' own sound plan (audio.ts planAudio)
 * for each goal shot, moved to where that goal sits in the reel, and mixes it
 * with mixAudio. The music is mixed in a second pass here, under the crowd,
 * following reel.ts's loudness line (it dips under each roar).
 *
 * Never throws. No Web Audio = null (the reel plays silent). A music file
 * that will not load = the crowd alone.
 */
import { planAudio, mixAudio, MIX_RATE, MIX_CHANNELS, type AudioPlan, type Cue, type BedPoint } from "./audio";
import type { Edit } from "./edit";
import { EDIT_FPS } from "./edit";
import type { GoalTrack } from "./track";
import { CUES, cueUrl } from "../gameMusic";
import { musicLevels, reelMusicFor, type ClipTiming, type ReelPlan } from "./reel";

/** The crowd's level on a card with no recording, and on the title/end. */
const BED_CARD = 0.07;
/** The quick-fire run: the crowd a step back, the music leads. */
const QUICK_CROWD = 0.6;

/** The sound plan for the whole reel (crowd, kicks, nets, the commentator). */
export function reelCrowdPlan(plan: ReelPlan, tracks: Map<string, GoalTrack>): AudioPlan {
  const cues: Cue[] = [];
  const bed: BedPoint[] = [{ at: 0, gain: 0 }];
  for (const seg of plan.segs) {
    const tr = (seg.kind === "goal" || seg.kind === "best") && seg.goal.clipId ? tracks.get(seg.goal.clipId) : undefined;
    if ((seg.kind === "goal" || seg.kind === "best") && tr && seg.shots.length) {
      // One goal: the fan's crowd for the quick clips (no commentator talking
      // over the next goal); the TV's sound, voice and all, for the goal of the season.
      const edit: Edit = {
        style: seg.kind === "best" ? "broadcast" : "fan", variant: 0, moves: "new",
        w: 360, h: 640, fps: EDIT_FPS, tracks: [tr],
        shots: seg.shots.map((s) => ({ track: 0, angle: s.angle, from: s.from, to: s.to, rate: s.rate, replay: s.replay })),
      };
      const p = planAudio(edit);
      for (const c of p.cues) if (c.at < seg.dur) cues.push({ ...c, at: c.at + seg.at, gain: seg.kind === "goal" ? c.gain * (seg.quick ? QUICK_CROWD : 0.9) : c.gain });
      for (const b of p.bed) bed.push({ at: Math.min(seg.at + seg.dur, b.at + seg.at), gain: b.gain });
    } else if (seg.kind === "goal" || seg.kind === "best") {
      // A card: a short cheer as the drawn ball goes in.
      bed.push({ at: seg.at, gain: BED_CARD }, { at: seg.at + seg.dur, gain: BED_CARD });
      const quick = seg.kind === "goal" && seg.quick;
      cues.push({ at: seg.at + (quick ? 0.55 : seg.goal.assist ? 1.1 : 0.7), sound: "crowd-cheer-stadium", gain: quick ? 0.35 : 0.55, rate: 1 });
    } else if (seg.kind === "end") {
      bed.push({ at: seg.at, gain: BED_CARD }, { at: seg.at + seg.dur - 0.5, gain: 0.02 });
      cues.push({ at: seg.at + 0.4, sound: "crowd-cheer-stadium", gain: 0.4, rate: 1 });
    } else {
      bed.push({ at: seg.at, gain: seg.kind === "title" ? 0 : BED_CARD }, { at: seg.at + seg.dur, gain: seg.kind === "title" ? 0.04 : BED_CARD });
    }
  }
  cues.sort((a, b) => a.at - b.at);
  bed.sort((a, b) => a.at - b.at);
  return { duration: plan.duration, cues, bed };
}

/** The timings reel.ts needs, read off a recording. */
export function timingOf(tr: GoalTrack): ClipTiming {
  const strike = tr.events.filter((e) => e.kind === "shot" && e.t <= tr.goalT + 0.05).pop();
  return {
    goalT: tr.goalT,
    strikeT: tr.strikeT,
    duration: Math.max(0, (tr.n - 1) / tr.fps),
    air: strike?.mode === "header" || strike?.mode === "volley",
  };
}

/** Where a whoosh rides a cut: into each full goal, into the goal of the
 *  season, into the end card. Not under the quick-fire run (too many). */
export function whooshTimes(plan: ReelPlan): number[] {
  const out: number[] = [];
  for (const s of plan.segs) {
    if ((s.kind === "goal" && !s.quick) || s.kind === "bestIntro" || s.kind === "end") out.push(s.at);
  }
  return out;
}

/** A short air whoosh peaking at `at`: filtered noise swept upwards. */
function whoosh(ctx: OfflineAudioContext, out: AudioNode, at: number): void {
  const len = 0.42;
  const t0 = at - len * 0.7;
  if (t0 < 0) return;
  const n = Math.floor(ctx.sampleRate * len);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 98765 + Math.floor(at * 100);
  for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = seed / 0x3fffffff - 1; }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(500, t0);
  bp.frequency.exponentialRampToValueAtTime(4200, t0 + len * 0.7);
  bp.frequency.exponentialRampToValueAtTime(1800, t0 + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(WHOOSH_GAIN, t0 + len * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  src.connect(bp); bp.connect(g); g.connect(out);
  src.start(t0);
}
const WHOOSH_GAIN = 0.22;
/**
 * The music's overall level and the mix's last trim, set by measuring the
 * mixed track (22 Oct 2026, 40-goal season, the winning track): music about
 * -18 dB RMS on the title card and -15 dB on the end card; under a goal's
 * roar the crowd sits about 6-7 dB above it; the loudest peak about -1.5 dBFS.
 */
const MUSIC_LIFT = 2.4;
const OUT_TRIM = 0.84;

const musicBytes = new Map<string, Promise<ArrayBuffer | null>>();
function fetchMusic(url: string): Promise<ArrayBuffer | null> {
  let hit = musicBytes.get(url);
  if (!hit) {
    hit = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    musicBytes.set(url, hit);
  }
  return hit;
}

function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer | null> {
  return new Promise<AudioBuffer | null>((res) => {
    try {
      const p = ctx.decodeAudioData(data.slice(0), res, () => res(null));
      if (p && typeof (p as Promise<AudioBuffer>).then === "function") (p as Promise<AudioBuffer>).then(res, () => res(null));
    } catch { res(null); }
  });
}

/**
 * The reel's whole soundtrack, one stereo track as long as the reel. Crowd
 * first (mixAudio), then the music laid under it. Resolves null only when
 * this browser has no Web Audio at all.
 */
export async function mixReelAudio(
  plan: ReelPlan, tracks: Map<string, GoalTrack>, timings: Record<string, ClipTiming>,
  /** For measuring only: the crowd or the music alone. */
  only?: "crowd" | "music",
): Promise<AudioBuffer | null> {
  if (typeof window === "undefined" || plan.duration <= 0) return null;
  const crowd = only === "music" ? null : await mixAudio(reelCrowdPlan(plan, tracks)).catch(() => null);
  const OAC = window.OfflineAudioContext
    || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OAC) return crowd;
  let ctx: OfflineAudioContext;
  try {
    ctx = new OAC(MIX_CHANNELS, Math.ceil(plan.duration * MIX_RATE), MIX_RATE);
  } catch { return crowd; }

  const id = reelMusicFor(plan);
  const bytes = only === "crowd" ? null : await fetchMusic(cueUrl(id));
  const music = bytes ? await decode(ctx, bytes) : null;
  if (!music && only === "music") return null;
  if (!music && only !== "crowd") return crowd;

  // A gentle limiter, so a roar on top of the music never clips.
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -8; master.knee.value = 8; master.ratio.value = 5;
  master.attack.value = 0.005; master.release.value = 0.25;
  // A last trim so the loudest roar peaks under -1 dBFS (measured, 22 Oct).
  const trim = ctx.createGain();
  trim.gain.value = OUT_TRIM;
  master.connect(trim); trim.connect(ctx.destination);
  if (crowd) {
    const src = ctx.createBufferSource();
    src.buffer = crowd;
    src.connect(master);
    src.start(0);
  }
  if (!music) return ctx.startRendering().catch(() => crowd);
  const m = ctx.createBufferSource();
  m.buffer = music;
  const meta = CUES[id];
  if (meta.loop) { m.loop = true; m.loopStart = meta.pre; m.loopEnd = meta.pre + meta.len; }
  const g = ctx.createGain();
  const levels = musicLevels(plan, timings);
  g.gain.setValueAtTime(levels[0]?.gain ?? 0, 0);
  for (const p of levels) g.gain.linearRampToValueAtTime(p.gain, Math.max(0, p.at));
  const lift = ctx.createGain();
  lift.gain.value = MUSIC_LIFT;
  m.connect(g); g.connect(lift); lift.connect(master);
  m.start(0, meta.loop ? meta.pre : 0);
  for (const at of whooshTimes(plan)) whoosh(ctx, master, at);
  try {
    return await ctx.startRendering();
  } catch { return crowd; }
}
