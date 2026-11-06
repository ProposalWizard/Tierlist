/**
 * THE EDIT BEATS (Leo's switch part "coldEdits", 31 Oct 2026).
 *
 * Four short original loops, made from sine waves and noise by
 * tools/edit-music/make_loops.py (no samples, no copied songs; licence:
 * public/star/edits/LICENSE.txt). Each has a build, then a DROP on a known
 * beat. A cold edit (editCold.ts) is cut in whole beats and starts the music
 * so the goal lands on the drop: every cut, flash and shake is then on a beat
 * of the music by construction.
 *
 * Keep these numbers in step with make_loops.py.
 */
export interface EditBeat {
  id: string;
  url: string;
  bpm: number;
  /** The beat the drop lands on (counted from 0 at the file's start). */
  dropBeat: number;
  /** Beats in the file (the music fades out after). */
  beats: number;
}

export const EDIT_BEATS = {
  /** Phonk-style half-time, cowbell riff, 808: the cold edit. */
  ice: { id: "ice", url: "/star/edits/ice-140.mp3", bpm: 140, dropBeat: 16, beats: 48 },
  /** A fast funk-style groove: montages and the angles edit. */
  drift: { id: "drift", url: "/star/edits/drift-150.mp3", bpm: 150, dropBeat: 16, beats: 48 },
  /** Slow pads and bells: the aura edit. */
  halo: { id: "halo", url: "/star/edits/halo-80.mp3", bpm: 80, dropBeat: 16, beats: 40 },
  /** Lo-fi boom-bap with crackle: the rewind and the stat card. */
  tape: { id: "tape", url: "/star/edits/tape-96.mp3", bpm: 96, dropBeat: 16, beats: 40 },
} as const satisfies Record<string, EditBeat>;

export type EditBeatId = keyof typeof EDIT_BEATS;

/** Seconds per beat. */
export const beatSecs = (b: EditBeat): number => 60 / b.bpm;
