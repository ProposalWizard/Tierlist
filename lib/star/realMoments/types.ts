/**
 * REAL MOMENTS — the shapes of the real-football files in data/realmoments/
 * (made by scripts/realmoments/, read its README). Every source here allows
 * commercial use; the credit lines are data/opendata/LICENCES.md's.
 *
 * All positions are OUR pitch metres (lib/star/pitch.ts): x 0..68 across from
 * the attacker's left touchline, y from the goal being attacked (0) up the
 * pitch. The acting team always attacks the goal at y = 0.
 *
 * Two kinds of picture:
 *  - FULLY REAL ("tracked"): tracking data had all 22 men and the ball, so
 *    everyone stands where he really stood, and `tracks.json` has where
 *    everyone was over the seconds before (IDSSE / DFL, SkillCorner).
 *  - REAL SHOT, PLACED DEFENDERS ("placed"): event data (Wyscout) has the
 *    shot's real spot, who, when, how and what happened, but nobody else;
 *    the rest of the picture is placed by the game's own scenario rules.
 */

import { creditLine } from "../dataCredits";

/** [x, y] in our pitch metres. */
export type XY = [number, number];

export type RealSource = "dfl" | "skillcorner" | "soccertrack" | "wyscout";

/** The credit lines (data/opendata/LICENCES.md, "Real moments"; one list in lib/star/dataCredits.ts): show the ones a page uses. */
export const REAL_CREDIT: Record<RealSource, string> = {
  wyscout: creditLine("wyscout-moments"),
  dfl: creditLine("dfl-moments"),
  skillcorner: creditLine("skillcorner-moments"),
  soccertrack: creditLine("soccertrack-moments"),
};

/** One real pass of the move: [seconds before the shot, from, to, passer, recipient]. */
export type RealPass = [number, XY, XY, string, string];

/** The last real passes before a shot (Wyscout events, real timing). */
export interface RealLead {
  passes: RealPass[];
  /** Earlier touches of the move, [match minute (decimal), x, y] — the radar's path. */
  path: [number, number, number][];
  /** Where everyone stood at the first pass: [x, y, team-mate, keeper, actor]. Tracking only; Wyscout never has it. */
  start?: [number, number, number, number, number][];
}

interface MomentBase {
  id: string;
  src: RealSource;
  comp: string;
  /** "Home 2-1 Away" (the final score). */
  match: string;
  /** The match clock's minute (1 = the first minute). */
  minute: number;
  /** Who did it (the shooter / the corner taker). */
  player: string;
  team: string;
  opp: string;
  /** Situation: Open Play / Free Kick / Penalty / Corner. */
  type: string;
  /** The ball where it was struck. */
  ball: XY;
  /** Everyone else at that instant: [x, y, team-mate 0/1, opposing keeper 0/1]. Tracked moments only. */
  ff?: [number, number, number, number][];
}

export interface RealShot extends MomentBase {
  what?: "shot";
  /** Goal / Saved / Off T / Blocked / Post (DFL, Wyscout); Goal / Shot (SkillCorner: no more detail). */
  outcome: string;
  /** Chance of a goal: DFL's own xG for DFL shots, else our model fitted on 45,287 Wyscout shots. */
  xg: number;
  /** Right Foot / Left Foot / Head / Other (SkillCorner: Foot, it does not say). */
  body: string;
  /** Where it went: on the goal line (x across, y 0), or where the ball was 1 s later. Null: not known. */
  end: XY | null;
  /** Its height crossing the line (m), when known. */
  endZ?: number | null;
  /** A counter-attack (as the source tags it). */
  counter?: 1;
  /** The real passes before it (Wyscout). */
  lead?: RealLead;
}

export interface RealCorner extends MomentBase {
  what: "corner";
  type: "Corner";
  /** Where the source says it was aimed (DFL: nearPost / farPost / center / short). */
  delivery?: string;
  /** What the corner led to: goal / shot / no shot. */
  led?: string;
}

export type TrackedMoment = (RealShot & { what: "shot" }) | RealCorner;

/** Where everyone was over a few seconds (tracks.json). */
export interface RealTrack {
  /** Seconds from the event (shot / corner kick) of the first frame: -4 for a shot, -1 for a corner. */
  t0: number;
  /** Seconds between frames (0.2). */
  dt: number;
  /** The ball, flat [x, y, z, x, y, z, ...] (z: metres up). */
  ball: number[];
  /** Each man: [side, name, x, y, x, y, ...]. side: you (the shooter / taker), mate, opp, keeper (theirs). */
  men: (string | number)[][];
}

export interface WyscoutShotFile { meta: { credit: string; xg_model: unknown }; shots: RealShot[] }
export interface TrackedFile { meta: { credit: Record<string, string> }; moments: TrackedMoment[] }
export interface TrackFile { tracks: Record<string, RealTrack> }

/** Is every man in this picture where he really stood? */
export const isFullyReal = (m: { src: RealSource }) => m.src !== "wyscout";

/** The words the pages use for the two kinds of picture. */
export const PICTURE_WORDS = {
  full: "Fully real: every player where he really stood",
  placed: "Real shot, placed defenders: the shot is real, the others are placed by the game's rules",
} as const;
