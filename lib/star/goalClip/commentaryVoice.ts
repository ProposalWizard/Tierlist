/**
 * WHICH COMMENTARY RECORDINGS PLAY (Leo, 30 Oct 2026: "the voice/audio is
 * still rlly bad … such a clear ai voice … should sound like a real
 * commentator").
 *
 * Two sets of the same lines (commentary.ts), same ids:
 *  - "v1": the first recordings, public/sfx/<id>.mp3 (Kokoro);
 *  - "v2": the new broadcast voice, public/sfx/v2/<id>.mp3 (Chatterbox,
 *    an original voice, made by scripts/commentary/generate_v2.py).
 *
 * v2 plays only when Leo's update switch AND its "New commentary voice"
 * part are on (lib/star/leoUpdate.ts). Off, on the server and in tests:
 * always v1, exactly as before.
 *
 * A Sound Board replacement of a line (sfxUrl override) wins in both sets.
 */
import { sfxUrl } from "../sfx";
import { leoUpdateOn } from "../leoUpdate";
import { COMMENTARY_SECONDS } from "./commentaryDurations";
import { COMMENTARY_SECONDS_V2 } from "./commentaryDurationsV2";

export type CommentarySet = "v1" | "v2";

/** The set this device plays now. "v1" unless Leo's switch says otherwise. */
export function commentarySet(): CommentarySet {
  return leoUpdateOn("commentaryVoice") ? "v2" : "v1";
}

/** The file for one line in a set. */
export function commentaryUrl(id: string, set: CommentarySet): string {
  const u = sfxUrl(id);
  if (set !== "v2") return u;
  // Replaced on the Sound Board: that recording, whichever set.
  return u === `/sfx/${id}.mp3` ? `/sfx/v2/${id}.mp3` : u;
}

/** Seconds each line lasts in a set. */
export function commentaryTable(set: CommentarySet): Record<string, number> {
  return set === "v2" ? COMMENTARY_SECONDS_V2 : COMMENTARY_SECONDS;
}
