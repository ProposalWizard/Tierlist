/**
 * WHAT THE TWO 3D NIGHTS ARE BUILT FROM, off a career: the website's components/star/BallonDorNight.tsx `Stage3D`
 * and SeasonAwardsNight.tsx `Room3D`, the same fields the same way (each finalist's / winner's club kit, you in
 * yours, the seed, the season's name). No React and no phone-only imports, so the headless check
 * (tools/night-check.ts) builds the stage from the very same code the screens use.
 *
 * Not carried over: the clubs' crests (see ./nightScene.ts) and your photographed face (photo faces are off for the
 * whole game: the drawn head, as in the signing).
 */
import type { CareerState } from "@/lib/star/types";
import type { NightPlan } from "@/lib/star/ballonDorNight";
import type { AwardsPlan } from "@/lib/star/awardsNight";
import { kitsOf } from "@/lib/star/kits";
import { seasonLabelOf } from "@/lib/star/goalClip/reel";
import { youFor } from "./signingData";
import type { AwardsData, BallonData } from "./nightScene";

/** The seed the Ballon d'Or night uses (BallonDorNight.tsx). */
export const ballonSeed = (career: CareerState) => (career.player.startYear ?? 0) * 31 + career.season;
/** The seed the awards night uses (SeasonAwardsNight.tsx `seedOf`). */
export const awardsSeed = (career: CareerState) => (career.player.startYear ?? 0) * 37 + (career.lastSeasonAwardStats?.season ?? career.season);

export function ballonData(career: CareerState, plan: NightPlan, clock: () => number): BallonData {
  const club = career.player.club;
  const you = youFor(career, club, career.squadNumber ?? null);
  const kits: Record<number, { shirt: string; trim: string }> = {};
  for (const f of plan.finalists) {
    const k = f.entry.isPlayer ? you.kit : kitsOf(f.entry.club, career.clubKits?.[f.entry.club]).home;
    kits[f.rank] = { shirt: k.shirt, trim: k.trim };
  }
  return { plan, you, kits, seed: ballonSeed(career), clock };
}

export function awardsData(career: CareerState, plan: AwardsPlan, clock: () => number): AwardsData {
  const club = career.player.club;
  const you = youFor(career, club, career.squadNumber ?? null);
  const kits: Record<string, { shirt: string; trim: string }> = {};
  for (const a of plan.awards) {
    const w = a.winner;
    const k = w.isYou ? you.kit : kitsOf(w.club, career.clubKits?.[w.club]).home;
    kits[a.winnerId] = { shirt: k.shirt, trim: k.trim };
  }
  return { plan, you, kits, seed: awardsSeed(career), seasonLabel: seasonLabelOf(career.player.startYear ?? 0, plan.season), clock };
}
