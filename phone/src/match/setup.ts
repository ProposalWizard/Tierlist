/**
 * WHAT THE MATCH IS HANDED, worked out the way the website's career screen
 * (app/star-dev/page.tsx, the `phase === "match"` branch that mounts
 * CanvasMatch) works it out. Only lib/star functions, same order, same sums.
 */
import type { CareerState, Fixture } from "@/lib/star/types";
import type { KickSkills } from "@/lib/star/canvasEngine";
import { selectionFor } from "@/lib/star/selection";
import { setPieceDuties, type SetPieceDuties } from "@/lib/star/setPieces";
import { opponentMatchStrength } from "@/lib/star/matchInputs";
import { conditionsFor, type Conditions } from "@/lib/star/weather";
import { pressureForDivision } from "@/lib/star/pressure";
import type { Scenario, ScenarioKind, Outcome } from "@/lib/star/canvasEngine";
import type { ScenePicture } from "@/lib/star/scenePicture";
import type { PenaltyReadSettings } from "@/lib/star/penaltyKeeper";

/** What the match tells a feature after each chance (CanvasMatch's ChanceResolved). */
export interface ChanceResolved {
  outcome: Outcome;
  kind: ScenarioKind;
  youShot: boolean;
  teammateShot: boolean;
  ball: { x: number; y: number; z: number } | null;
  autoKick?: "us" | "them";
  buildUp?: boolean;
}

/**
 * A FEATURE BUILT ON THE MATCH (the trial's stages, the training drills):
 * the website's EngineFeature props on CanvasMatch (openOn, onChanceResolved,
 * onBallStep, markers, scene, penaltyRead, setPieceSkill, keeperStrength,
 * holdAt). No career, no fixture, no 90 minutes: one picture at a time.
 * The getters are read again at every chance, as the website re-reads its
 * props on every render (a stage's keeper changes kick by kick).
 */
export interface FeatureSpec {
  openOn: () => Scenario;
  onChanceResolved?: (info: ChanceResolved) => void;
  onBallStep?: (ball: { x: number; y: number; z: number }) => void;
  markers?: () => { x: number; y: number; color?: string }[] | undefined;
  scene?: ScenePicture;
  keeperStrength: () => number;
  penaltyRead?: () => Partial<PenaltyReadSettings> | undefined;
  setPieceSkill?: number;
  /** A drill's own Aerial handed in on `skills` (the Head & Volley drill). */
  aerial?: number;
  holdAt?: (moment: "runup" | "contact", release: () => void) => boolean;
}
import { careerPenaltyRunup, careerFreeKickRunup, type PenaltyRunupId, type FreeKickRunupId } from "@/lib/star/runupStyles";

export interface MatchSetup {
  career: CareerState;
  fixture: Fixture;
  /** Power/technique with your boots on (page.tsx effectivePower/effectiveTechnique). */
  skills: KickSkills;
  canCurve: boolean;
  canExtraTouch: boolean;
  /** CanvasMatch's keeperStrength prop (the opponent's match strength). */
  keeperStrength: number;
  oppStrength: number;
  position: string;
  teamRelationship: number;
  startMinute: number;
  plannedOffAt?: number;
  duties?: SetPieceDuties;
  conditions: Conditions;
  /** The match's seed: season * 1000 + week, as page.tsx passes it. */
  seed: number;
  pressure: number;
  penaltyRunup?: PenaltyRunupId;
  freeKickRunup?: FreeKickRunupId;
  /** Set: a feature (EngineFeature), not a career match. `career` and `fixture` are then stand-ins nothing reads. */
  feature?: FeatureSpec;
}

/** EngineFeature's CanvasMatch mount (components/star/EnginePlay.tsx): your skills, no career, no fixture. */
export function featureSetup(f: FeatureSpec, o: { skills: KickSkills; seed?: number; penaltyRunup?: PenaltyRunupId; freeKickRunup?: FreeKickRunupId }): MatchSetup {
  return {
    career: null as unknown as CareerState,
    fixture: { opponent: "", home: true } as unknown as Fixture,
    skills: o.skills,
    canCurve: false, canExtraTouch: false,
    keeperStrength: f.keeperStrength(), oppStrength: 65,
    position: "ST", teamRelationship: 60, startMinute: 0,
    // CanvasMatch: conditions ?? conditionsFor(0, 0) (EngineFeature hands in none).
    conditions: conditionsFor(0, 0),
    seed: o.seed ?? 1,
    pressure: 0,
    penaltyRunup: o.penaltyRunup, freeKickRunup: o.freeKickRunup,
    feature: f,
  };
}

export function matchSetupFor(career: CareerState, fixture: Fixture): MatchSetup {
  const selection = selectionFor(career);
  const duties = setPieceDuties(career, selection.status);
  const baseStrength = fixture.opponentStrength
    ?? career.league.find((t) => t.name === fixture.opponent)?.strength
    ?? 65;
  const oppStrength = opponentMatchStrength(baseStrength, fixture.home);
  const bootMatchesLeft = career.currentBoot.matches > 0;
  const effectivePower = Math.min(100, career.skills.power + (bootMatchesLeft ? career.currentBoot.power : 0));
  const effectiveTechnique = Math.min(100, career.skills.technique + (bootMatchesLeft ? career.currentBoot.technique : 0));
  const canCurve = (bootMatchesLeft && !!career.currentBoot.curve) || !!career.kibAbility?.curve;
  const canExtraTouch = (bootMatchesLeft && !!career.currentBoot.extraTouch) || !!career.kibAbility?.extraTouch;
  return {
    career, fixture,
    skills: { power: effectivePower, technique: effectiveTechnique },
    canCurve, canExtraTouch,
    keeperStrength: oppStrength,
    oppStrength,
    position: career.playAs ?? career.player.position,
    teamRelationship: career.relationships.team,
    startMinute: selection.onAt ?? 0,
    plannedOffAt: selection.offAt,
    duties,
    // Leo's "weather" update is off by default (leoUpdateOn("weather") reads false): page.tsx then passes conditionsFor.
    conditions: conditionsFor(career.season, fixture.week, career.homeCity),
    seed: career.season * 1000 + career.week,
    pressure: pressureForDivision(career.division),
    penaltyRunup: careerPenaltyRunup(career),
    freeKickRunup: careerFreeKickRunup(career),
  };
}
