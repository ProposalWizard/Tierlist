/**
 * ONE SET OF MATCH INPUTS (sim rebuild piece 4, 22 Oct 2026;
 * docs/plans/2026-10-21-sim-formula-rebuild.md §6c, §8 row 4).
 *
 * Five things play the unseen match (hiddenMatch.ts): the real match
 * (CanvasMatch), "Sim this match" (simMatch.ts), the match radar
 * (/star-radar-dev), the full 90 (sim90.ts) and the FHR ruler (fhr/ruler.ts).
 * Each used to write its own HiddenMatchInputs by hand, and they had drifted:
 * the radar, sim90 and the ruler left out the match context and the live
 * penalties, sim90 fixed every skill at 70, the ruler left out Match flow (so
 * it always measured the Old match) and "Sim this match" left out the live
 * penalties. Same seed, same sides, five different matches.
 *
 * Now every one of them describes the match (`MatchInputsSpec`) and this file
 * turns that into the inputs, the same way every time. A career match goes
 * through `careerMatchSpec` first, so the real match and "Sim this match" read
 * the career identically. Nothing here decides any football: it only decides
 * which numbers the unseen match is given.
 */
import type { HiddenMatchInputs, LateSub, MatchContext } from "./hiddenMatch";
import type { CareerState, Fixture, Playstyle } from "./types";
import { canTakeCorners } from "./cornerReach";
import { matchTeamStrength } from "./matchday";
import { oldMatchFlow } from "./gameplayVersion";

type Mode = "low" | "medium" | "high";

/** Everything the unseen match needs to know, in plain terms. */
export interface MatchInputsSpec {
  /** Your club's strength and theirs (0-100), as the match reads them. */
  teamStrength: number;
  oppStrength: number;
  /** true at home, false away, absent on neutral ground. */
  home?: boolean;
  /** Your own stats. playerSkill is the average of power, technique and vision. */
  skills: { power: number; technique: number; vision: number; pace?: number; freeKick?: number };
  /** The kicking skills your strike uses (boots included). Mikey's corner rule
   *  (cornerReach.ts) reads these; absent, power and technique above. */
  kick?: { power: number; technique: number };
  /** The position you are playing ("ST", "CAM" …). */
  position: string;
  energyMode?: Mode;
  energyModeChanges?: { minute: number; mode: Mode }[];
  /** 0-100, your energy now (kept for callers; the chance formula reads the mode). */
  energy?: number;
  /** On the pitch having come on as a substitute. */
  impactSub?: boolean;
  lateSub?: LateSub;
  talisman?: boolean;
  farewell?: boolean;
  /** Added time the board shows (minutes after full time). 0 or absent: none. */
  addedTime?: number;
  /** The match's length before added time. Absent: 90. */
  fullTime?: number;
  /** Playstyle, team-mates, fans, your stats. Absent: a balanced playstyle
   *  and nothing else, so the gap still reads the way the real match reads it. */
  context?: MatchContext;
  /** Settings → Look → Gameplay → Match flow. Absent: the player's setting. */
  matchFlow?: boolean;
}

/** Settings → Match flow, as every tool reads it (New = true). */
export const matchFlowOn = (): boolean => !oldMatchFlow();

/** The opposition's strength for a fixture: a little weaker away from home,
 *  a little stronger at theirs. The one rule the real match and "Sim this
 *  match" share (app/star-dev/page.tsx, simMatch.ts). */
export function opponentMatchStrength(base: number, home: boolean | undefined): number {
  return Math.max(20, Math.min(99, base + (home ? -3 : 4)));
}

/** The match's inputs. The same spec always gives the same inputs. */
export function matchInputsFor(s: MatchInputsSpec): HiddenMatchInputs {
  const kick = s.kick ?? { power: s.skills.power, technique: s.skills.technique };
  return {
    teamStrength: s.teamStrength,
    oppStrength: s.oppStrength,
    playerSkill: (s.skills.power + s.skills.technique + s.skills.vision) / 3,
    home: s.home,
    pace: s.skills.pace,
    freeKick: s.skills.freeKick,
    // Can your best corner reach the middle of the box? (Mikey, 20 Oct 2026)
    canTakeCorners: canTakeCorners(kick),
    position: s.position,
    energy: s.energy,
    energyMode: s.energyMode,
    ...(s.energyModeChanges ? { energyModeChanges: s.energyModeChanges } : {}),
    impactSub: !!s.impactSub,
    talisman: !!s.talisman,
    matchFlow: s.matchFlow ?? matchFlowOn(),
    ...(s.farewell ? { farewell: true } : {}),
    context: s.context ?? { playstyle: "balanced" },
    // Penalties are won in any move, not only yours (v0.15 item 6).
    livePenalties: true,
    lateSub: s.lateSub,
    ...(s.addedTime && s.addedTime > 0 ? { fergie: { from: s.fullTime ?? 90, to: (s.fullTime ?? 90) + s.addedTime } } : {}),
  };
}

/** A career fixture, read the same way by the real match and "Sim this match". */
export function careerMatchSpec(
  career: CareerState,
  fixture: Pick<Fixture, "home" | "kind"> | null | undefined,
  o: {
    oppStrength: number;
    /** Your club's strength when the career's league doesn't list it. */
    teamFallback: number;
    position: string;
    kick?: { power: number; technique: number };
    playstyle?: Playstyle;
  } & Pick<MatchInputsSpec, "energyMode" | "energyModeChanges" | "energy" | "impactSub" | "lateSub" | "farewell" | "addedTime" | "fullTime" | "matchFlow">,
): MatchInputsSpec {
  const sk = career.skills;
  const { oppStrength, teamFallback, position, kick, playstyle, ...rest } = o;
  return {
    ...rest,
    // Your CLUB's strength (Chelsea 83), not the team relationship.
    teamStrength: matchTeamStrength(career, teamFallback, fixture),
    oppStrength,
    home: fixture?.home,
    skills: { power: sk.power, technique: sk.technique, vision: sk.vision, pace: sk.pace, freeKick: sk.freeKick },
    kick,
    position,
    talisman: !!career.ownedClubs?.[career.player.club]?.talisman,
    context: {
      playstyle: playstyle ?? career.playstyle ?? "balanced",
      teamRelationship: career.relationships.team,
      fanRelationship: career.relationships.fans,
      skills: { pace: sk.pace, power: sk.power, technique: sk.technique, vision: sk.vision },
    },
  };
}

/**
 * A test tool's match (the radar page, sim90, the ruler): two strengths, one
 * number for all your stats, a position. Built exactly like a career match
 * (balanced playstyle, live penalties, Mikey's corner rule, Match flow).
 */
export function simpleMatchSpec(o: {
  teamStrength: number; oppStrength: number; home?: boolean; skill: number; position: string; matchFlow?: boolean;
}): MatchInputsSpec {
  const k = o.skill;
  return {
    teamStrength: o.teamStrength, oppStrength: o.oppStrength, home: o.home, position: o.position,
    skills: { power: k, technique: k, vision: k, pace: k, freeKick: k },
    energyMode: "medium",
    matchFlow: o.matchFlow,
  };
}
