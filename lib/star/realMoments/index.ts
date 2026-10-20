/**
 * REAL MOMENTS — real football moments from free-licensed data, for the test
 * pages (Real moments, Real shots, Real Goals) and the Full Highlights
 * Rebuild's build-ups.
 *
 * Data (data/realmoments/, made by scripts/realmoments/, read its README):
 *   tracked.json  every shot and corner of 7 DFL and 20 A-League matches,
 *                 all 22 men where they really stood (FULLY REAL);
 *   tracks.json   the same moments' ball and men every 0.2 s over the
 *                 seconds before (buildUpOf, trackLeadIn);
 *   wyscout_shots.json  every shot of the 2018 World Cup and Euro 2016: the
 *                 real spot, who, how, what happened and the real passes
 *                 before it; the others are PLACED by our scenario rules;
 *   wyscout_goals.json  the match facts for Real Goals.
 * Served to the pages by /api/star/real-moments?file=shots|tracked|tracks|goals.
 *
 * Credit (show it on any page that uses it): REAL_CREDIT, from
 * data/opendata/LICENCES.md.
 */
// Named re-exports (not `export *`): the tests import this from .mts files,
// and Node only sees a CommonJS module's names when they are spelled out.
export {
  REAL_CREDIT, isFullyReal, PICTURE_WORDS,
  type XY, type RealSource, type RealPass, type RealLead, type RealShot, type RealCorner, type TrackedMoment, type RealTrack,
  type WyscoutShotFile, type TrackedFile, type TrackFile,
} from "./types";
export {
  P, peopleOf, blockersOf, kindForShot, playKindForShot, KIND_LABEL, measureOf, measureReal, measureScenario, ourMeasures, meansOf,
  FRAME_PEOPLE_M, cameraFor, onScreen, frameHoldsShot, seedForShot, seedForPlaced, PLACED_TRIES, overrideForShot, scenarioForShot, scenarioForCorner, scenarioForMoment,
  playedKeeperOff,
  type ShotPeople, type ShotMeasure, type MeasureMeans,
} from "./shots";
export {
  ballAlong, LEAD_MAX_RUN, leadinPlan, lerpVec, LEAD_MAX_S, LEAD_HOLD_S, leadinBallKeys, leadinTrack,
  type LeadBallKey, type LeadKey, type LeadDot, type LeadPlan, type LeadTrack,
} from "./leadin";
export { buildUpOf, passesInTrack, trackLeadIn, type TrackSide, type BuildUpMan, type RealBuildUp } from "./track";

export const REAL_MOMENTS_API = "/api/star/real-moments";
export type RealFileName = "shots" | "tracked" | "tracks" | "goals";

/** Fetch one of the files (browser). */
export function fetchRealFile<T>(file: RealFileName): Promise<T> {
  return fetch(`${REAL_MOMENTS_API}?file=${file}`).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`HTTP ${r.status}`))));
}
