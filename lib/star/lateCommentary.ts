/**
 * THE LATE CALL IN THE LIVE MATCH (Leo, 22 Oct 2026, "After you score").
 *
 * A goal YOU score at 85 minutes or later that wins it or levels it gets the
 * commentator's big late call ("Late, late, he's won it!"), the same
 * recordings the goal videos use (goalClip/commentary.ts LATE_CALLS,
 * public/sfx/cl-late-*.mp3, replaceable on the Sound Board).
 *
 *   import { playLateGoalCall, lateKindOf } from "@/lib/star/lateCommentary";
 *   const kind = lateKindOf(minute, true, usAfter, themAfter);
 *   if (kind) playLateGoalCall(kind, seed);
 *
 * Plays on the game's one audio context (audioOut.ts), only when Settings →
 * Sound effects is on and the match is not muted. Never throws; on the
 * server or in a test it does nothing.
 */
import { audioContext } from "./audioOut";
import { sfxOn, sfxUrl } from "./sfx";
import { isMatchSoundMuted } from "./matchSound";
import { LATE_CALLS, pickLine, lateKindOf, type LateKind } from "./goalClip/commentary";

export { lateKindOf };
export type { LateKind };

/** Every late lead line's id (the files are public/sfx/<id>.mp3). */
export const LATE_GOAL_LINES: string[] = Object.values(LATE_CALLS).flat().map(l => l.id);

/** How loud the call plays over the match (0-1). */
const GAIN = 0.95;
/** A call that is not loaded within this long after the goal is dropped: a late call late is worse than none. */
const MAX_WAIT_MS = 1500;

const buffers = new Map<string, AudioBuffer | null | Promise<AudioBuffer | null>>();

function load(id: string): Promise<AudioBuffer | null> {
  const have = buffers.get(id);
  if (have !== undefined) return have instanceof Promise ? have : Promise.resolve(have);
  const c = audioContext();
  if (!c || typeof fetch === "undefined") return Promise.resolve(null);
  const job = fetch(sfxUrl(id))
    .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("no file"))))
    .then(data => new Promise<AudioBuffer>((res, rej) => {
      // The callback form: old iOS Safari has no promise-returning decodeAudioData.
      const p = c.decodeAudioData(data, res, rej);
      if (p && typeof (p as Promise<AudioBuffer>).then === "function") (p as Promise<AudioBuffer>).then(res, rej);
    }))
    .then(b => { buffers.set(id, b); return b; })
    .catch(() => { buffers.set(id, null); return null; });
  buffers.set(id, job);
  return job;
}

/** Fetch the late calls ahead of time (e.g. at 80 minutes), so the call lands on the goal. Never throws. */
export function preloadLateGoalCalls(): void {
  try {
    if (typeof window === "undefined" || !audioContext()) return;
    LATE_GOAL_LINES.forEach(id => { void load(id); });
  } catch { /* no audio here */ }
}

/** The line a late goal gets: the same seed always the same line. */
export function lateGoalLine(kind: LateKind, seed: number): string {
  return pickLine(LATE_CALLS[kind] ?? LATE_CALLS.winner, `live:${seed}`).id;
}

/** Play the commentator's late call for this goal. Never throws. */
export function playLateGoalCall(kind: LateKind, seed: number): void {
  try {
    if (typeof window === "undefined") return;
    if (!sfxOn() || isMatchSoundMuted()) return;
    const c = audioContext();
    if (!c) return;
    const id = lateGoalLine(kind, seed);
    const t0 = Date.now();
    void load(id).then(b => {
      try {
        if (!b || Date.now() - t0 > MAX_WAIT_MS) return;
        if (!sfxOn() || isMatchSoundMuted() || c.state !== "running") return;
        const src = c.createBufferSource();
        src.buffer = b;
        const g = c.createGain();
        g.gain.value = GAIN;
        src.connect(g);
        g.connect(c.destination);
        src.start();
      } catch { /* never let a sound break the match */ }
    });
  } catch { /* never let a sound break the match */ }
}
