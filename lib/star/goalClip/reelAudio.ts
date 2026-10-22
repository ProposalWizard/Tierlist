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
      for (const c of p.cues) if (c.at < seg.dur) cues.push({ ...c, at: c.at + seg.at, gain: seg.kind === "goal" ? c.gain * 0.9 : c.gain });
      for (const b of p.bed) bed.push({ at: Math.min(seg.at + seg.dur, b.at + seg.at), gain: b.gain });
    } else if (seg.kind === "goal" || seg.kind === "best") {
      // A card: a short cheer as the drawn ball goes in.
      bed.push({ at: seg.at, gain: BED_CARD }, { at: seg.at + seg.dur, gain: BED_CARD });
      cues.push({ at: seg.at + (seg.goal.assist ? 1.1 : 0.7), sound: "crowd-cheer-stadium", gain: 0.55, rate: 1 });
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
export async function mixReelAudio(plan: ReelPlan, tracks: Map<string, GoalTrack>, timings: Record<string, ClipTiming>): Promise<AudioBuffer | null> {
  if (typeof window === "undefined" || plan.duration <= 0) return null;
  const crowd = await mixAudio(reelCrowdPlan(plan, tracks)).catch(() => null);
  const OAC = window.OfflineAudioContext
    || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OAC) return crowd;
  let ctx: OfflineAudioContext;
  try {
    ctx = new OAC(MIX_CHANNELS, Math.ceil(plan.duration * MIX_RATE), MIX_RATE);
  } catch { return crowd; }

  const id = reelMusicFor(plan);
  const bytes = await fetchMusic(cueUrl(id));
  const music = bytes ? await decode(ctx, bytes) : null;
  if (!music) return crowd;

  // A gentle limiter, so a roar on top of the music never clips.
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -8; master.knee.value = 8; master.ratio.value = 5;
  master.attack.value = 0.005; master.release.value = 0.25;
  master.connect(ctx.destination);
  if (crowd) {
    const src = ctx.createBufferSource();
    src.buffer = crowd;
    src.connect(master);
    src.start(0);
  }
  const m = ctx.createBufferSource();
  m.buffer = music;
  const meta = CUES[id];
  if (meta.loop) { m.loop = true; m.loopStart = meta.pre; m.loopEnd = meta.pre + meta.len; }
  const g = ctx.createGain();
  const levels = musicLevels(plan, timings);
  g.gain.setValueAtTime(levels[0]?.gain ?? 0, 0);
  for (const p of levels) g.gain.linearRampToValueAtTime(p.gain, Math.max(0, p.at));
  m.connect(g); g.connect(master);
  m.start(0, meta.loop ? meta.pre : 0);
  try {
    return await ctx.startRendering();
  } catch { return crowd; }
}
