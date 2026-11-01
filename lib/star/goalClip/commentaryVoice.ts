/**
 * WHICH COMMENTARY RECORDINGS PLAY (Leo, 30 Oct 2026: "the voice/audio is
 * still rlly bad … such a clear ai voice … should sound like a real
 * commentator"; 31 Oct 2026: "VARYING COMMENTATORS").
 *
 * Three sets:
 *  - "v1": the first recordings, public/sfx/<id>.mp3 (Kokoro);
 *  - "v2": the same lines in the new broadcast voice, public/sfx/v2/<id>.mp3
 *    (Chatterbox, an original voice, scripts/commentary/generate_v2.py);
 *  - "teams": four commentary teams, each with its own voices AND its own
 *    lines (commentators.ts), public/sfx/teams/<id>.mp3
 *    (scripts/commentary/generate_teams.py).
 *
 * "teams" plays only when Leo's update switch AND its "Different
 * commentators" part are on; else "v2" when "New commentary voice" is on
 * (lib/star/leoUpdate.ts). Off, on the server and in tests: always v1,
 * exactly as before.
 *
 * A Sound Board replacement of a line (sfxUrl override) wins in every set.
 */
import { sfxUrl } from "../sfx";
import { leoUpdateOn } from "../leoUpdate";
import { COMMENTARY_SECONDS } from "./commentaryDurations";
import { COMMENTARY_SECONDS_V2 } from "./commentaryDurationsV2";
import { COMMENTARY_SECONDS_TEAMS } from "./commentaryDurationsTeams";

export type CommentarySet = "v1" | "v2" | "teams";

/** The set this device plays now. "v1" unless Leo's switch says otherwise. */
export function commentarySet(): CommentarySet {
  if (leoUpdateOn("commentators")) return "teams";
  return leoUpdateOn("commentaryVoice") ? "v2" : "v1";
}

/** The file for one line in a set. */
export function commentaryUrl(id: string, set: CommentarySet): string {
  const u = sfxUrl(id);
  if (set === "v1") return u;
  // Replaced on the Sound Board: that recording, whichever set.
  if (u !== `/sfx/${id}.mp3`) return u;
  return set === "teams" ? `/sfx/teams/${id}.mp3` : `/sfx/v2/${id}.mp3`;
}

/** Seconds each line lasts in a set. */
export function commentaryTable(set: CommentarySet): Record<string, number> {
  return set === "teams" ? COMMENTARY_SECONDS_TEAMS : set === "v2" ? COMMENTARY_SECONDS_V2 : COMMENTARY_SECONDS;
}
