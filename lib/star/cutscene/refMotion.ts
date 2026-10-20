/**
 * ARMS COPIED FROM REAL PEOPLE (B5c, Harry 20 Oct 2026: "I don't like how
 * robotic the arms can end up being … go on Higgsfield and generate the
 * cutscenes exactly how they are now … rebuild based on that").
 *
 * Each cut-scene moment was played by real-looking people in a Higgsfield
 * video (docs/handoffs/2026-10-20-builds/b5c/ref-*.mp4). MediaPipe read
 * their bodies frame by frame and tools/motionref/ref_paths.py kept, for each
 * arm, where the wrist and the elbow were against the shoulder, in the chest's
 * own frame and in arm lengths, plus the trunk's lean (refMotion.json). A
 * "ref-…" pose hold (perform3d.ts) puts our man's wrist where the real man's
 * was, his elbow pointing where the real elbow did, at the real timing: so the
 * arm keeps the real person's arcs, overlaps, settles and small drifts,
 * instead of a hand flown in a straight line to a point and pinned there.
 *
 * Pure: a sample is worked out from t alone (cut scenes are seekable).
 */
import data from "./refMotion.json";

export type RefArmClip = "talk-hands" | "trophy-lift" | "roar" | "wave-clap" | "shirt-up";
type V3 = [number, number, number];

interface RawClip { fps: number; n: number; L: number[]; R: number[]; Le: number[]; Re: number[]; lean: number[] }
const CLIPS = (data as unknown as { clips: Record<string, RawClip> }).clips;

export interface RefArmSample {
  /** Wrist and elbow, from the same side's shoulder, in arm lengths (x his left, y up, z his front). */
  L: V3; R: V3; Le: V3; Re: V3;
  /** Trunk lean against the first frame: [forward +, to his left +], radians. */
  lean: [number, number];
}

export const refArmDuration = (name: RefArmClip): number => {
  const c = CLIPS[name];
  return c ? (c.n - 1) / c.fps : 0;
};

/** Catmull-Rom through the frames (the path is already smooth: this only keeps the speed continuous between frames). */
function at(arr: number[], dim: number, n: number, f: number): number[] {
  const i = Math.max(0, Math.min(n - 1, Math.floor(f)));
  const u = Math.max(0, Math.min(1, f - i));
  const g = (k: number, d: number) => arr[Math.max(0, Math.min(n - 1, k)) * dim + d];
  const out: number[] = [];
  for (let d = 0; d < dim; d++) {
    const p0 = g(i - 1, d), p1 = g(i, d), p2 = g(i + 1, d), p3 = g(i + 2, d);
    out.push(0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u));
  }
  return out;
}

/**
 * The real person's arms `t` seconds into the clip. `loop`: wrap round (the
 * seam is crossfaded over 0.4 s); otherwise the last frame holds.
 */
export function refArms(name: RefArmClip, t: number, loop = false): RefArmSample | null {
  const c = CLIPS[name];
  if (!c) return null;
  const dur = (c.n - 1) / c.fps;
  const one = (tt: number): RefArmSample => {
    const f = Math.max(0, Math.min(dur, tt)) * c.fps;
    return {
      L: at(c.L, 3, c.n, f) as V3, R: at(c.R, 3, c.n, f) as V3,
      Le: at(c.Le, 3, c.n, f) as V3, Re: at(c.Re, 3, c.n, f) as V3,
      lean: at(c.lean, 2, c.n, f) as [number, number],
    };
  };
  if (!loop) return one(t);
  const fade = Math.min(0.4, dur / 4);
  const tt = ((t % dur) + dur) % dur;
  const a = one(tt);
  if (tt < dur - fade) return a;
  // near the end: mix towards the start, so the loop never pops
  const k = (tt - (dur - fade)) / fade, s = k * k * (3 - 2 * k);
  const b = one(tt - (dur - fade));
  const mix = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * s);
  return { L: mix(a.L, b.L) as V3, R: mix(a.R, b.R) as V3, Le: mix(a.Le, b.Le) as V3, Re: mix(a.Re, b.Re) as V3, lean: mix(a.lean, b.lean) as [number, number] };
}
