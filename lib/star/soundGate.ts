/**
 * HOW OFTEN A SOUND MAY PLAY (v0.25 item 6).
 *
 * Harry and Mikey, live on their phones, 2 Oct 2026: "the sound effects are
 * too frequent", "some of them … sound different on iPhone". Every button
 * tapped, every whistle and every crowd swell played, however close
 * together, and on an iPhone each <audio> copy stacked at full volume.
 *
 * Two limits, both in one pure function so a test can count what plays:
 *   - the same sound waits a short gap before it may play again (a burst of
 *     unlock pops is one pop, not five on top of each other);
 *   - at most MAX_AT_ONCE sounds start inside WINDOW_MS, whatever they are.
 *
 * Pure: the caller passes the clock. `makeSoundGate()` gives each player of
 * sounds (UI sounds, match sounds) its own memory.
 */

/** The shortest gap, in ms, before the same sound may play again. */
export const MIN_GAP_MS: Record<string, number> = {
  // UI (lib/star/sfx.ts)
  "ui-tap": 180,
  "ui-confirm": 300,
  "coin-in": 600,
  "star-tick": 250,
  "level-up": 1200,
  "achievement-pop": 900,
  "breaking-news": 4000,
  "phone-notification": 5000,
  "can-open": 600,
  // The match (lib/star/matchSound.ts)
  kick: 90,
  net: 600,
  post: 500,
  save: 350,
  whistle: 1200,
  "crowd-cheer": 1500,
  "crowd-groan": 1500,
};
const DEFAULT_GAP_MS = 250;
/** No more than this many sounds start in any WINDOW_MS. */
export const MAX_AT_ONCE = 3;
export const WINDOW_MS = 400;

export type SoundGate = (name: string, nowMs: number) => boolean;

export function makeSoundGate(): SoundGate {
  const last = new Map<string, number>();
  let recent: number[] = [];
  return (name, nowMs) => {
    const prev = last.get(name);
    if (prev !== undefined && nowMs - prev < (MIN_GAP_MS[name] ?? DEFAULT_GAP_MS)) return false;
    recent = recent.filter((t) => nowMs - t < WINDOW_MS);
    if (recent.length >= MAX_AT_ONCE) return false;
    recent.push(nowMs);
    last.set(name, nowMs);
    return true;
  };
}

/** The clock both players use. */
export function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}
