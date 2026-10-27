/**
 * THE MATCH, WITHOUT THE SCREEN.
 *
 * The website's match screen (components/star/CanvasMatch.tsx) runs the real
 * engine: the hidden ninety minutes, a chance whenever one comes to you, your
 * drag and your touch on the ball, the physics frame by frame, the result,
 * the chain to the next chance, full time. That screen is React and canvas and
 * cannot be converted, so this file repeats its GAME steps, in the same order,
 * on the same lib/star functions. Roblox draws what this holds and feeds it
 * your input; the converter turns it into Luau like the rest.
 *
 * What is left out, on purpose, because on the website it only changes the
 * PICTURE, never the football: build-up replays before a chance (they end
 * with everyone where the chance has them), camera moves after the frame is
 * set, goal videos and replays, sound and music, celebrations (off unless
 * Leo's update is on), big-moment slow motion, live scores from other
 * grounds, the radar, effects. Each function names the CanvasMatch part it copies.
 *
 * Time: everything the website does with setTimeout runs on this file's own
 * clock (`after`), moved on by `tick(m, dt)`. The same inputs at the same
 * times give the same match, so it is twin-tested like the rest.
 */
import {
  buildWeightedScenario, buildScenario, launch, stepBall, stepBallInNet, settleBall, stepBallPastBar, stepBallCleared,
  stepKeeper, settleJumps, stepDefenders, stepReactions, stepTouchChase, touchChaseSpeed, initDefenders, resetForTouchOn,
  chainReturnChance, CHAIN_MAX, TOUCH_CHAIN_MAX, applyFirstTouch, goalInView, OUTCOME_TEXT, clamp, dragForFullPower,
  VIEW_ASPECT, orderableRunners, acceptsCaptainOrders, curveDirFromSwipe, applyCurveSwipe, setOffsideRuleEnabled,
  setClearanceRules, getClearanceRules,
  type Scenario, type Ball, type Outcome, type KickSkills, type ScenarioKind, type Viewport, type Runner, type Vec2,
} from "../../lib/star/canvasEngine";
import {
  newMatch, advanceTo, resolveScenario, lateSubQuota, noteServedKind,
  type HiddenMatchState, type HiddenMatchInputs, type ScenarioRequest, type ScenarioResult, type HiddenMatchEvent,
} from "../../lib/star/hiddenMatch";
import { BOX_L, BOX_R, BOX_DEPTH, CX, POST_L, POST_R } from "../../lib/star/pitch";
import { line as logLine, linesFrom, dwellFor, HALF_TIME_MINUTE, type LogLine } from "../../lib/star/matchLog";
import { commentaryBuildup, commentaryStrike, commentaryReceived, commentaryReceiverShot, commentaryResult } from "../../lib/star/matchCommentary";
import {
  penaltyRunupOf, freeKickRunupOf, takerRunupFor, yourRunupFor, standBackFor, planRunup, runupPositionAt, RUNUP_MOTION, LEAF_RUNUP,
  careerPenaltyRunup, careerFreeKickRunup, type StyledRunup,
} from "../../lib/star/runupStyles";
import {
  attachAutoKick, autoKickOf, aimFor, planPenalty, takerSkills, takerRating, yourPenaltyRating, shootoutOrder, designatedTaker,
  clearForShootout, AUTO_STAND_MS, type PenaltyTaker,
} from "../../lib/star/penaltyTaking";
import {
  shotsPro, knucklePowerOn, launchShot, shotSeedFor, stepKnuckle, stepWindUp, aimedAtGoal, powerShotStrike,
  POWER_SHOT_WINDUP_S, POWER_SHOT_CONTACT, type ShotExtras,
} from "../../lib/star/shotModel";
import { brainOptionsHere, hasBrain, brainSetup, keeperSaltFor, brainAim, brainRunUp, brainStrike, brainStep } from "../../lib/star/keeperBrain";
import {
  RUNUP, strikeTimerFor, hasRunup, canNudge, plantBeside, goalLineX, nudgedDir, nudgeFromDrag, scuffStrike, cheekyStrike, isCheekyMiss,
  type CheekyKind,
} from "../../lib/star/penaltyRunup";
import { matchView, frameForNewView, crossCutCamera, turnWideChance, figureShrinkFor } from "../../lib/star/matchView";
import { cameraTilt } from "../../lib/star/cameraTilt";
import { stageScene } from "../../lib/star/scenePicture";
import { isSwitchedOff, playableKind } from "../../lib/star/switchedOffKinds";
import { KIB_CANS } from "../../lib/star/shopData";
import { giveAndGoChance } from "../../lib/star/giveAndGo";
import { makeChance, pictureMemory, type PictureMemory } from "../../lib/star/chanceMaker";
import { separateBodies } from "../../lib/star/spacing";
import { newSelectionMemory } from "../../lib/star/scenarioSelect";
import { finishServedFrame } from "../../lib/star/goalFrame";
import { pressSpeedFor, PRESS_REACT_S, PRESS_WIN_R, pressFromBehind, foulShareFor, pressStep, pressureForDivision } from "../../lib/star/pressure";
import { setPieceSkills, setPieceDuties, type SetPieceDuties } from "../../lib/star/setPieces";
import { conditionsFor, type Conditions } from "../../lib/star/weather";
import { matchConditions } from "../../lib/star/matchWeather";
import {
  pickWaveSizes, newRun as newFpRun, stepRun as stepFpRun, applyBurst as fpBurst, applyPass as fpPass, applyStick as fpStick,
  wavesBeaten as fpWavesBeaten, type FpRunState, type RunPhase as FpRunPhase, type FpIdentity,
} from "../../lib/star/firstPersonDribble";
import { dribbleReward } from "../../lib/star/dribbleReward";
import { oldBallPhysics, gameplayVersion } from "../../lib/star/gameplayVersion";
import { setHitboxes, hitboxesOn } from "../../lib/star/hitbox";
import { setBallPhysics, realBallOn } from "../../lib/star/ballPhysics";
import { getTuning } from "../../lib/star/tuningStore";
import { mulberry32 } from "../../lib/star/season";
import { newChancesOn } from "../../lib/star/newChances";
import { stepPlayOn, MAX_LAY_OFFS, steerPlayOn, callForIt, runAfterWanted, startPlayOnRun, sprintPlayOn, type PlayOn } from "../../lib/star/playOn";
import { takeEnergySpent, setLegsEnergy, barCap, KEY_PUSH } from "../../lib/star/legs";
import { afterPassStickOn } from "../../lib/star/afterPass";
import { mechanicOpen, aerialIntroGame, type Mechanic } from "../../lib/star/mechanics";
import { dealDribble, dribbleLevelFor, newDribbleDeal, type DribbleDeal } from "../../lib/star/dribbleDeal";
import { ruleBookFor } from "../../lib/star/ruleBook";
import { deflectBlock } from "../../lib/star/deflection";
import { steerDeflectionFromOwnGoal, clearLooseWin } from "../../lib/star/defenderTouch";
import { matchInputsFor, careerMatchSpec, opponentMatchStrength } from "../../lib/star/matchInputs";
import { finaliseMatch, fairRating } from "../../lib/star/matchStats";
import { goalZone, passGrade, missKind } from "../../lib/star/chanceRating";
import { runStretch } from "../../lib/star/stretchRun";
import { hookCheck, subComesOnNow, SUB_OFF_ENERGY, selectionFor, type HookReason } from "../../lib/star/selection";
import type { ChanceEntry, ChanceOutcome } from "../../lib/star/chanceLog";
import { GOAL_LINES, ASSIST_LINES } from "../../lib/star/commentaryExtra";
import { pickSquadScorer, pickSquadAssist } from "../../lib/star/squadData";
import { castScenario, castDefence, creatorOf, orderDefensively, type OpponentSheetPlayer } from "../../lib/star/lineup";
import { formationShapeInput, type ShapeInput } from "../../lib/star/formationShape";
import { fakeFaceFor } from "../../lib/star/fakeFaces";
import { applyAirborne, airborneOn, airborneMotion, type StrikeContact } from "../../lib/star/airborneChance";
import type { BallMotion } from "../../components/star/ContactBall";
import { isAirKind, airZOf, HEADER_Z } from "../../lib/star/airDrawings";
import { airTapOn, airTapAim, airTapStrike, AIR_TAP_OPEN_S, AIR_TAP_OPEN_NO_LEAD_S, type AirKind } from "../../lib/star/airTap";
import { aerialMovesOn, forcedAerialMove, pickAerialMove, aerialStrikeTint, AERIAL_SPECS, CONTACT_SHOW_S, type AerialMove } from "../../lib/star/aerialMoves";
import { startingTeammateRoles, onPitchToday, fillMissingFromFullRoster, opponentStartingXI } from "../../lib/star/teamsheet";
import { creditChance, assistFor, noteMatePlays, probeMatePlays, type MatePlay } from "../../lib/star/credit";
import { kitsFor, keeperKit, type MatchKits } from "../../lib/star/kits";
import { shortClub } from "../../lib/star/media/grammar";
import { divisionOf } from "../../lib/star/calendar";
import type { CareerState, MatchStats, Fixture, GoalEvent, OppGoalEvent, SquadPlayer, Playstyle } from "../../lib/star/types";
import { shotPowerOn, contactFieldOn, feelPower, feelLift, struckAtGoal } from "../../lib/star/shotFeel";
import { energyFactorFor, energyPerMinute, clampEnergy, tiredKickSkills, fatigueCut, type EnergyMode } from "../../lib/star/energy";
import { aerialOf } from "../../lib/star/aerial";
import { penaltyReadFor, decidePenaltyRead, applyPenaltyRead } from "../../lib/star/penaltyKeeper";
import { setupKind, strikeKind, stepKind, enforceHardRules, type StrikeDecision } from "../../lib/star/kindRules";
import { switchOn } from "../../lib/star/compareSwitches";
import { strikingPower } from "../../lib/star/strikePower";
import { hasExtraTime, type ExtraTimeCompetition } from "../../lib/star/shootout";
import { createShootout, takeNextKick, nextShootoutSide, nextTakerIndex, type PenaltyShootoutState, type ShootoutSide } from "../../lib/star/shootout";
import { currentTie as euroCurrentTie, currentLeg as euroCurrentLeg } from "../../lib/star/euro";
import { rollAddedTime, addedTimeSeed } from "../../lib/star/addedTime";
import { nextFixtureFor } from "../../lib/star/competitions";
import { internationalCareer } from "../../lib/star/international";
import { projectedEnergy } from "../../lib/star/week";
import { leoUpdateOn } from "../../lib/star/leoUpdate";

// ─────────────────────────────────────────────────────────────── constants ──

/** CanvasMatch's own constants. */
const BALL_GRAB_FRACTION = 0.18;
const MIN_PULL = 0.008;
const CAPTAIN_DRAG_MIN = 3.0;
const DEFAULT_MATCH_DURATION = 90;
const MINUTE_TICK_MS = 700;
const QUICK_START_MAX = 12;
const FOLLOWER_RUN_SPEED = 7.0;
/** The phone pitch box CanvasMatch falls back to (height / width, 38 x 83). */
export const PITCH_HW = 83 / 38;

type Phase = "feed" | "aim" | "contact" | "runup" | "flight" | "result" | "tdDribble" | "postmatch";

const SIM_COMMENTARY_USER = [
  "{club} share the ball around patiently in midfield.", "{club}'s defence holds firm under pressure.",
  "{club}'s counter-attack breaks down in the final third.", "A tidy passing move from {club} comes to nothing.",
  "The ball is recycled patiently at the back for {club}.", "A promising run down the wing for {club} is halted by a strong tackle.",
  "{club}'s keeper comes out to claim a hopeful cross.", "A long ball forward for {club} finds nobody — easily dealt with.",
  "Neat footwork from {club} in the middle of the park creates some space.", "{club}'s fans are starting to get restless.",
  "A crunching challenge from {club} draws a free kick — nothing comes of it.", "The tempo drops as {club} look to regroup.",
  "A lovely piece of skill from {club} on the touchline, but the final ball lets them down.", "Chances have been at a premium for {club} here.",
];
const SIM_COMMENTARY_OPP = [
  "They share the ball around patiently in midfield.", "Their defence holds firm under pressure.",
  "Their counter-attack breaks down in the final third.", "A tidy passing move from them comes to nothing.",
  "The ball is recycled patiently at the back for them.", "A promising run down the wing for them is halted by a strong tackle.",
  "Their keeper comes out to claim a hopeful cross.", "A long ball forward for them finds nobody — easily dealt with.",
  "Neat footwork from them in the middle of the park creates some space.", "Their fans are starting to get restless.",
  "A crunching challenge from them draws a free kick — nothing comes of it.", "The tempo drops as they look to regroup.",
  "A lovely piece of skill from them on the touchline, but the final ball lets them down.", "Chances have been at a premium for them here.",
];

// ─────────────────────────────────────────────────────────────────── setup ──

/** What app/star-dev/page.tsx hands CanvasMatch for a career match (phase "match"). */
export interface MatchSetup {
  career: CareerState;
  fixture: Fixture;
  skills: KickSkills;
  canCurve: boolean;
  canExtraTouch: boolean;
  keeperStrength: number;
  oppStrength: number;
  position: string;
  teamRelationship: number;
  startMinute: number;
  plannedOffAt?: number;
  duties?: SetPieceDuties;
  conditions: Conditions;
  seed: number;
  pressure: number;
  penaltyRunup?: string;
  freeKickRunup?: string;
  /** The pictures already shown (the website keeps them in the browser). Default: this device's. */
  pictures?: PictureMemory;
}

/** page.tsx's match mount, from the readied career (handlePlayMatch). */
export function matchSetupFor(career: CareerState): MatchSetup | null {
  const nextFixture = nextFixtureFor(career);
  if (!nextFixture) return null;
  const selection = selectionFor(career);
  const duties = setPieceDuties(career, selection.status);
  const baseStrength = nextFixture.opponentStrength ?? career.league.find((t) => t.name === nextFixture.opponent)?.strength ?? 65;
  const oppStrength = opponentMatchStrength(baseStrength, nextFixture.home);
  const bootMatchesLeft = career.currentBoot.matches > 0;
  const effectivePower = Math.min(100, career.skills.power + (bootMatchesLeft ? career.currentBoot.power : 0));
  const effectiveTechnique = Math.min(100, career.skills.technique + (bootMatchesLeft ? career.currentBoot.technique : 0));
  const canCurve = (bootMatchesLeft && !!career.currentBoot.curve) || !!career.kibAbility?.curve;
  const canExtraTouch = (bootMatchesLeft && !!career.currentBoot.extraTouch) || !!career.kibAbility?.extraTouch;
  const intlMatchCareer = nextFixture.kind === "international" ? internationalCareer(career, nextFixture) : null;
  return {
    career: intlMatchCareer ?? career,
    fixture: nextFixture,
    skills: { power: effectivePower, technique: effectiveTechnique },
    canCurve, canExtraTouch,
    keeperStrength: oppStrength,
    oppStrength,
    position: career.playAs ?? career.player.position,
    teamRelationship: career.relationships.team,
    startMinute: selection.onAt ?? 0,
    plannedOffAt: selection.offAt,
    duties: duties ?? undefined,
    conditions: leoUpdateOn("weather") ? matchConditions(career, nextFixture) : conditionsFor(career.season, nextFixture.week, career.homeCity),
    seed: career.season * 1000 + career.week,
    pressure: pressureForDivision(career.division),
    penaltyRunup: careerPenaltyRunup(career),
    freeKickRunup: careerFreeKickRunup(career),
  };
}

/** handlePlayMatch: the week's actions spent and the rest days' energy banked. */
export function readyForMatch(career: CareerState): CareerState {
  return { ...career, weekActions: 0, energy: projectedEnergy(career) };
}

/**
 * The career the match needs, without what it never reads (the phone feed,
 * the rest of the world, other countries' squads): what is sent to a player's
 * device. Checked by the match twin test: the match plays the same on both.
 */
export function matchCareer(c: CareerState): CareerState {
  const out = { ...c } as CareerState & Record<string, unknown>;
  for (const k of ["media", "world", "lastWorld", "externalSquads", "freeAgents", "lastSeasonAwardStats", "seasonHistory", "hallOfFame"]) delete out[k];
  return out;
}

// ─────────────────────────────────────────────────────────────── the state ──

interface Tally {
  shots: number; goals: number; passes: number; passesCompleted: number; chances: number; assists: number; misses: number;
  lost: number; dribbles: number; goalsPen: number; goalsTap: number; goalsOut: number; passesSafe: number; passesAmb: number;
  missesOn: number; missesPen: number; misses1v1: number;
}
const newTally = (): Tally => ({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0, goalsPen: 0, goalsTap: 0, goalsOut: 0, passesSafe: 0, passesAmb: 0, missesOn: 0, missesPen: 0, misses1v1: 0 });

interface SimEvent { minute: number; text: string; isGoal?: boolean; isOpponent?: boolean; tone?: LogLine["tone"] }

interface Timer { at: number; gen: number | null; fn: () => void }

export interface Pause { label?: string; cta: string; halfTime?: boolean; go: () => void }

export interface RunupState {
  t: number; dir0: Vec2; power: number; nudgeM: number; nudge: boolean; arrived: boolean;
  styled: StyledRunup; runS: number;
  auto?: { contact: { cx: number; cy: number }; skills: KickSkills };
}

export interface LiveShootoutInfo {
  homeClub: string; awayClub: string; yourSide: ShootoutSide;
  home: PenaltyTaker[]; away: PenaltyTaker[];
  homeKeeper: { strength: number; id?: string; name?: string; shortName?: string; face?: string };
  awayKeeper: { strength: number; id?: string; name?: string; shortName?: string; face?: string };
  state: PenaltyShootoutState;
  handed: number;
}

export interface MatchState {
  setup: MatchSetup;
  career: CareerState;
  fixture: Fixture;
  /** The clock: seconds since kick-off of this session (timers run on it). */
  now: number;
  timers: Timer[];
  sceneGen: number;
  phase: Phase;
  sc: Scenario;
  ball: Ball | null;
  rng: () => number;
  rngCalls: number;
  seed: number;
  MATCH_DURATION: number;
  ADDED: number;
  matchCeiling: number;
  extraTimeStage: 0 | 1 | 2;
  wentToExtraTime: boolean;
  shootoutResult: { home: number; away: number } | null;
  // the hidden match
  st: HiddenMatchState;
  pendingRequest: ScenarioRequest | null;
  chain: { pos: Vec2; depth: number; ambition: number; touchTouches?: number; kind?: ScenarioKind } | null;
  chanceMemory: ReturnType<typeof newSelectionMemory>;
  lastDeal: ScenarioRequest["deal"] | undefined;
  dribbleDeal: { deal: DribbleDeal; rng: () => number } | null;
  setPieceNext: ScenarioKind | null;
  handover: ScenarioKind | null;
  // the score and the record
  tally: Tally;
  attempts: number;
  userScore: number;
  oppScore: number;
  goalEvents: GoalEvent[];
  oppGoalEvents: OppGoalEvent[];
  chanceLog: ChanceEntry[];
  cheekyStrike: CheekyKind | null;
  cheekyMisses: { kind: CheekyKind; minute: number }[];
  strikeAt: Vec2 | null;
  matePlays: MatePlay[];
  deflections: number;
  // the clock and the commentary
  minute: number;
  log: LogLine[];
  queue: LogLine[];
  feed: string[];
  speed: number;
  pause: Pause | null;
  halfTimeShown: boolean;
  simContinue: (() => void) | null;
  feedWait: number | null;
  quickStart: boolean;
  boardShown: boolean;
  stretch: {
    snapshot: HiddenMatchState; seed: number; inputs: HiddenMatchInputs; userScore: number; oppScore: number;
    goalEvents: number; oppGoalEvents: number; hooked: HookReason | null; hookedAt: number | null; feed: string[];
    changes: { minute: number; mode: EnergyMode }[]; queued: number; handover?: ScenarioKind | null; board?: boolean;
  } | null;
  // you
  energy: number;
  energyClock: number;
  energyMode: EnergyMode;
  energyFactor: number;
  playstyle: Playstyle;
  playstyleChanges: { minute: number; playstyle: Playstyle }[];
  kibUsed: number;
  enteredAt: number;
  subOn: boolean;
  subChances: number;
  subFitness: number;
  hooked: HookReason | null;
  hookedAt: number | null;
  // the chance in hand
  aim: { dir: Vec2; power: number } | null;
  drag: Vec2 | null;
  thumbOrigin: Vec2 | null;
  dragging: boolean;
  aimCommitAt: number | null;
  presser: Scenario["defenders"][number] | null;
  presserBehind: boolean;
  captainDrag: { target: Runner | "follower"; from: Vec2; to: Vec2 } | null;
  runup: RunupState | null;
  contactTimerS: number | null;
  windUp: number | null;
  powerArmed: boolean;
  powerStrike: boolean;
  strikeRule: StrikeDecision | null;
  outcome: Outcome | null;
  banner: { text: string; at: number } | null;
  keeperSalt: number;
  physAcc: number;
  airWait: { sc: Scenario; t: number } | null;
  airOpened: Scenario | null;
  aerial: { sc: Scenario; move: AerialMove; e: number; preS: number; opened: boolean } | null;
  playOn: PlayOn | null;
  playOnRng: () => number;
  layOffsLeft: number;
  playOnCaught: boolean;
  bar: number;
  steer: { x: number; y: number; sprint: boolean } | null;
  touchModeOn: boolean;
  bootWait: { t: number; stopT: number | null; then: (() => void) | null } | null;
  // the dribble
  td: FpRunState | null;
  tdReady: boolean;
  fpDribble: { waveSizes: number[]; seed: number; duels?: boolean } | null;
  // the shootout and automatic kicks
  liveShootout: LiveShootoutInfo | null;
  shootoutKick: { resolve: (scored: boolean) => void } | null;
  // camera (the chance's framing; the engine's play area is sc.viewport)
  camera: Viewport;
  facing: "up" | "left" | "right";
  tiltSetting: number;
  tiltDeg: number;
  // fixed for the match
  strength: number;
  vision: number;
  kits: MatchKits;
  ourKeeperKit: { shirt: string; trim: string };
  startingXI: ReturnType<typeof startingTeammateRoles> | null;
  oppXIForCast: OpponentSheetPlayer[] | null;
  oppXI: ReturnType<typeof opponentStartingXI> | null;
  fpRoster: FpIdentity[] | undefined;
  /** Set at full time: what goes back to the career (handleMatchComplete). */
  result: MatchStats | null;
}

// ──────────────────────────────────────────────────────────────── helpers ──

function countedRng(m: MatchState, seed: number): () => number {
  const raw = mulberry32(seed);
  m.rngCalls = 0;
  return () => { m.rngCalls++; return raw(); };
}

/** window.setTimeout, on the match's own clock. `gen`: run only if no new scene has started since. */
function after(m: MatchState, ms: number, fn: () => void, guard = true) {
  m.timers.push({ at: m.now + ms / 1000, gen: guard ? m.sceneGen : null, fn });
}

function setPhase(m: MatchState, p: Phase) { m.phase = p; }
function showAction(m: MatchState, text: string) { m.banner = { text, at: m.now }; }
function pushLine(m: MatchState, line: string) { m.feed = [...m.feed, line].slice(-4); }
function logMoment(m: MatchState, text: string, tone: LogLine["tone"], minute?: number) {
  const shown = tone === "assist" ? undefined : (minute ?? m.minute);
  m.log = [...m.log, logLine(text, tone, shown)];
}
function playerLabel(m: MatchState): string { return m.career.player.lastName || "you"; }
function attributeClub(m: MatchState, text: string, isOpponent?: boolean): string {
  if (!text.includes("{club}")) return text;
  const club = isOpponent ? shortClub(m.fixture.opponent) : shortClub(m.career.player.club);
  return text.replaceAll("{club}", club);
}
function onPitch(m: MatchState, squad: SquadPlayer[]): SquadPlayer[] {
  return onPitchToday(fillMissingFromFullRoster(squad, m.startingXI, m.career), m.startingXI);
}
function mayTake(m: MatchState, kind: ScenarioKind): boolean {
  const d = m.setup.duties;
  if (!d) return true;
  if (kind === "free_kick") return d.freeKicks;
  if (kind === "penalty") return d.penalties;
  if (kind === "corner") return d.corners ?? true;
  return true;
}
function mechOpen(m: MatchState, id: Mechanic): boolean { return mechanicOpen(m.career, id); }

/** The score as revealed so far (CanvasMatch's displayScore). */
export function displayScore(m: MatchState): { user: number; opp: number } {
  return { user: m.log.filter((l) => l.tone === "goal").length, opp: m.log.filter((l) => l.tone === "oppGoal").length };
}

// ─────────────────────────────────────────────────────────────── energy ──

function liveEnergyAt(m: MatchState, minute: number): number {
  if (m.hooked) return m.energy;
  const extra = Math.max(0, minute - m.energyClock) * energyPerMinute(m.energyMode, m.energyFactor);
  return clampEnergy(m.energy - extra);
}
function chargeEnergyTo(m: MatchState, minute: number) {
  if (minute > m.energyClock) { m.energy = liveEnergyAt(m, minute); m.energyClock = minute; }
}
function setClock(m: MatchState, minute: number) { chargeEnergyTo(m, minute); m.minute = minute; }
function tiredSkills(m: MatchState): KickSkills {
  const t = tiredKickSkills(m.setup.skills, liveEnergyAt(m, m.minute));
  return { power: t.power, technique: t.technique };
}
function ratingSoFar(t: Tally, us: number, them: number): number {
  return fairRating({ ...t, passes: t.passesCompleted }, us, them).rating;
}
function matchExtras(m: MatchState) {
  const t = m.tally;
  return {
    tally: { misses: t.misses, lost: t.lost, dribbles: t.dribbles, goalsPen: t.goalsPen, goalsTap: t.goalsTap, goalsOut: t.goalsOut,
      passesSafe: t.passesSafe, passesAmb: t.passesAmb, missesOn: t.missesOn, missesPen: t.missesPen, misses1v1: t.misses1v1 },
    extra: { ...(m.subOn ? { cameo: true, enteredAt: m.enteredAt } : {}), chanceLog: m.chanceLog.slice() },
  };
}

/** CanvasMatch.hiddenInputs. */
function hiddenInputs(m: MatchState): HiddenMatchInputs {
  const car = m.career;
  const live = {
    oppStrength: m.setup.oppStrength,
    position: m.setup.position,
    kick: m.setup.skills,
    energy: liveEnergyAt(m, m.minute),
    energyMode: m.energyMode,
    impactSub: m.setup.startMinute > 0,
    farewell: false,
    lateSub: m.subOn ? { enteredAt: m.enteredAt, owed: Math.max(0, lateSubQuota(m.enteredAt) - m.subChances), fitness: m.subFitness } : undefined,
    addedTime: m.ADDED,
    fullTime: m.MATCH_DURATION,
  };
  const inputs = matchInputsFor(careerMatchSpec(car, m.fixture, { ...live, teamFallback: m.setup.teamRelationship, playstyle: m.playstyle }));
  const withCorners = m.setup.duties?.corners === false ? { ...inputs, canTakeCorners: false } : inputs;
  return car.unlocks?.story
    ? { ...withCorners, mechanics: { air: mechanicOpen(car, "aerial"), airIntro: aerialIntroGame(car), dribble: mechanicOpen(car, "dribble") } }
    : withCorners;
}

function matchResultFor(res: Outcome): ScenarioResult {
  if (OUTCOME_TEXT[res].kind === "goal") return "goal";
  if (res === "delivered" || res === "touchOn") return "delivered";
  if (res === "tackled" || res === "blocked") return "lost";
  return "saved";
}

function applyClearanceRules() {
  setClearanceRules({
    speedMin: getTuning("clearance.speedMin"), speedMax: getTuning("clearance.speedMax"), maxAngleDeg: getTuning("clearance.maxAngle"),
    miscues: true, miscueWeak: getTuning("clearance.miscueWeak"), miscueStrong: getTuning("clearance.miscueStrong"),
    bodyLen: getTuning("clearance.bodyLen"), bodyWidth: getTuning("clearance.bodyWidth"),
    secondBalls: Math.round(getTuning("clearance.secondBalls")),
  });
  setBallPhysics(oldBallPhysics() ? "old" : "new");
  setHitboxes(gameplayVersion("hitboxes"));
}

function formationShapeFor(m: MatchState): ShapeInput | null {
  const myStrength = m.career.league.find((t) => t.name === m.career.player.club)?.strength ?? 65;
  return formationShapeInput(m.fixture.opponent, myStrength, m.setup.oppStrength);
}

/** CanvasMatch.nameTeamGoals. */
function nameTeamGoals(m: MatchState, raw: HiddenMatchEvent[], squad: SquadPlayer[], rng: () => number, announce: boolean): SimEvent[] {
  const attackers = squad.filter((p) => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
  return raw.flatMap((e): SimEvent[] => {
    if (!e.isGoal) return [{ minute: e.minute, text: attributeClub(m, e.text, e.isOpponent), isOpponent: e.isOpponent }];
    if (!e.teammateGoal) {
      if (m.oppXI === null) return [{ minute: e.minute, text: `⚽ ${m.fixture.opponent} score!`, isGoal: true, isOpponent: true }];
      const oppCandidates = m.oppXI.map((p) => ({ id: p.id, name: p.name, shortName: p.short, position: p.role }));
      const oppScorer = pickSquadScorer(oppCandidates, rng) ?? { id: "unnamed", name: "Team-mate", shortName: "Team-mate" };
      const oppAssister = oppScorer.id !== "unnamed" ? pickSquadAssist(oppCandidates, oppScorer.id, rng) : null;
      m.oppGoalEvents.push({ minute: e.minute, scorerId: oppScorer.id, scorer: oppScorer.name, assistId: oppAssister?.id, assist: oppAssister?.name });
      const oppGoalLine = variedLine(GOAL_LINES, oppScorer.shortName, e.minute);
      if (announce) pushLine(m, `${e.minute}' ${oppGoalLine}${oppAssister ? ` (${oppAssister.shortName})` : ""}`);
      return oppAssister
        ? [{ minute: e.minute, text: oppGoalLine, isGoal: true, isOpponent: true },
          { minute: e.minute, text: variedLine(ASSIST_LINES, oppAssister.shortName, e.minute), tone: "assist", isOpponent: true }]
        : [{ minute: e.minute, text: oppGoalLine, isGoal: true, isOpponent: true }];
    }
    const scorer = pickSquadScorer(attackers.length > 0 ? attackers : squad, rng) ?? ({ id: "unnamed", name: "Team-mate", shortName: "Team-mate" } as SquadPlayer);
    const assister = scorer.id !== "unnamed" ? pickSquadAssist(squad, scorer.id, rng) : null;
    m.goalEvents.push({ minute: e.minute, scorer: scorer.name, assist: assister?.name, isUserGoal: false });
    const goalLine = variedLine(GOAL_LINES, scorer.shortName, e.minute);
    if (announce) pushLine(m, `${e.minute}' ${goalLine}${assister ? ` (${assister.shortName})` : ""}`);
    return assister
      ? [{ minute: e.minute, text: goalLine, isGoal: true }, { minute: e.minute, text: variedLine(ASSIST_LINES, assister.shortName, e.minute), tone: "assist" }]
      : [{ minute: e.minute, text: goalLine, isGoal: true }];
  });
}

/** CanvasMatch's variedLine (module level there): a line from a bank, by minute. */
/** CanvasMatch.variedLine: varies without drawing a random number. */
function variedLine(pool: readonly string[], name: string, minute: number): string {
  let h = minute;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length].replace("{name}", name);
}

/** CanvasMatch.strikeMotion: how the ball moves on the strike screen. */
export function strikeMotion(kind: string, seed: number): BallMotion {
  return airborneOn() ? airborneMotion(kind, seed) : contactMotion(kind, seed);
}
function contactMotion(kind: string, seed: number): BallMotion {
  if (kind === "header") return "float";
  if (kind === "volley") return "bounce";
  if (kind === "one_on_one" || kind === "tight_angle" || kind === "long_range") {
    return ((Math.imul(seed, 2654435761) >>> 0) % 100) < 35 ? "bobble" : "still";
  }
  return "still";
}

// ──────────────────────────────────────────────────────────── the camera ──

/** CanvasMatch.frameScenario, new view: the engine's play area and the chance's camera. */
function frameScenario(m: MatchState, sc: Scenario) {
  turnWideChance(sc, !hasRunup(sc.kind), PITCH_HW);
  m.facing = sc.facing ?? "up";
  m.tiltDeg = tiltForChance(m, sc);
  const wasFacing = sc.facing ?? "up";
  const cam = frameForNewView(sc, PITCH_HW, false, m.tiltDeg);
  if ((sc.facing ?? "up") !== wasFacing) { m.facing = sc.facing ?? "up"; m.tiltDeg = tiltForChance(m, sc); }
  m.camera = { ...cam };
}
function tiltForChance(m: MatchState, sc: Scenario): number {
  return sc.kind === "corner" || sc.kind === "byline_cross" || (sc.facing ?? "up") !== "up" ? 0 : m.tiltSetting;
}
/** Metres across the screen at this camera. */
function acrossM(m: MatchState): number {
  const v = m.camera;
  return m.facing === "up" ? v.x2 - v.x1 : v.y2 - v.y1;
}
/** CanvasMatch.screenPull (new view, flat): a drag in metres as a share of the classic frame. */
export function screenPull(m: MatchState, drag: Vec2, ball: Vec2): number {
  return (Math.hypot(drag.x - ball.x, drag.y - ball.y) * VIEW_ASPECT) / Math.max(1e-6, acrossM(m));
}
export function powerFromDrag(m: MatchState, drag: Vec2, ball: Vec2): number {
  return clamp(screenPull(m, drag, ball) / dragForFullPower(m.setup.skills.power), 0, 1);
}
/** CanvasMatch.sameOnScreenM (new view): a share of the classic frame's height, in metres. */
function sameOnScreenM(m: MatchState, share: number): number {
  return (share * acrossM(m)) / VIEW_ASPECT;
}

// ──────────────────────────────────────────────────────────── the start ──

/** CanvasMatch's mount: the refs, then the mount effect. */
export function startMatch(setup: MatchSetup): MatchState {
  const career = setup.career;
  const fixture = setup.fixture;
  const MATCH_DURATION = ruleBookFor(career, "FA").matchLengthMinutes ?? DEFAULT_MATCH_DURATION;
  setOffsideRuleEnabled(!ruleBookFor(career, "FA").offsideAbolished);
  applyClearanceRules();
  const startingXI = startingTeammateRoles(career, fixture);
  const oppXI = opponentStartingXI(career, fixture);
  const oppXIForCast: OpponentSheetPlayer[] | null = oppXI
    ? oppXI.map((p) => ({ id: p.id, name: p.name, shortName: p.short, position: p.role, overall: p.overall,
      face: p.face ?? fakeFaceFor(p.id), isGK: p.role === "GK", y: p.y, defending: p.defending }))
    : null;
  const realKeeperOverall = oppXIForCast?.find((p) => p.isGK)?.overall;
  const strength = realKeeperOverall !== undefined ? Math.max(20, Math.min(99, realKeeperOverall)) : setup.keeperStrength;
  const fpRoster: FpIdentity[] | undefined = oppXIForCast
    ? orderDefensively(oppXIForCast.filter((p) => !p.isGK)).map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, face: p.face, defending: p.defending, overall: p.overall }))
    : undefined;
  const ADDED = rollAddedTime(mulberry32(addedTimeSeed(setup.seed)));
  const kits = fixture.home
    ? kitsFor(career.player.club, fixture.opponent, career.clubKits?.[career.player.club], career.clubKits?.[fixture.opponent])
    : kitsFor(fixture.opponent, career.player.club, career.clubKits?.[fixture.opponent], career.clubKits?.[career.player.club]);
  const ourKit = fixture.home ? kits.home : kits.away;
  const vision = career.skills.vision ?? 55;
  const m = {
    setup, career, fixture, now: 0, timers: [], sceneGen: 0, phase: "aim",
    sc: null as unknown as Scenario, ball: null, rng: Math.random, rngCalls: 0, seed: setup.seed,
    MATCH_DURATION, ADDED, matchCeiling: MATCH_DURATION + ADDED, extraTimeStage: 0, wentToExtraTime: false, shootoutResult: null,
    st: newMatch(mulberry32(setup.seed)), pendingRequest: null, chain: null, chanceMemory: newSelectionMemory(), lastDeal: undefined,
    dribbleDeal: null, setPieceNext: null, handover: null,
    tally: newTally(), attempts: 0, userScore: 0, oppScore: 0, goalEvents: [], oppGoalEvents: [], chanceLog: [],
    cheekyStrike: null, cheekyMisses: [], strikeAt: null, matePlays: [], deflections: 0,
    minute: 0, log: [], queue: [], feed: [], speed: 1, pause: null, halfTimeShown: false, simContinue: null, feedWait: null,
    quickStart: false, boardShown: false, stretch: null,
    energy: career.energy ?? 100, energyClock: 0, energyMode: "medium", energyFactor: energyFactorFor(career, fixture),
    playstyle: career.playstyle ?? "balanced", playstyleChanges: [], kibUsed: 0,
    enteredAt: setup.startMinute, subOn: false, subChances: 0, subFitness: 100, hooked: null, hookedAt: null,
    aim: null, drag: null, thumbOrigin: null, dragging: false, aimCommitAt: null, presser: null, presserBehind: false,
    captainDrag: null, runup: null, contactTimerS: null, windUp: null, powerArmed: false, powerStrike: false,
    strikeRule: null, outcome: null, banner: null, keeperSalt: keeperSaltFor(false), physAcc: 0,
    airWait: null, airOpened: null, aerial: null,
    playOn: null, playOnRng: Math.random, layOffsLeft: MAX_LAY_OFFS, playOnCaught: false, bar: 1, steer: null,
    touchModeOn: false, bootWait: null,
    td: null, tdReady: false, fpDribble: null, liveShootout: null, shootoutKick: null,
    camera: { x1: -5, x2: 105, y1: -5, y2: 100 }, facing: "up", tiltSetting: matchView() === "new" ? cameraTilt() : 0, tiltDeg: 0,
    strength, vision, kits, ourKeeperKit: keeperKit(ourKit.shirt, kits.keeper.shirt),
    startingXI, oppXIForCast, oppXI, fpRoster, result: null,
  } as MatchState;
  m.rng = countedRng(m, setup.seed);
  // The opening scenario (CanvasMatch's scenarioRef initial value).
  let sc = buildWeightedScenario(mulberry32(setup.seed), setup.position, strength, setup.teamRelationship, vision);
  if (isSwitchedOff(sc.kind)) {
    const r = mulberry32(setup.seed ^ 0x51f7);
    sc = buildScenario(playableKind(sc.kind, r), r, strength, setup.teamRelationship, vision);
  }
  setupKind(sc, mulberry32(setup.seed ^ 0x7e11), { appliedAuthored: false, appliedPlan: false, keeperStrength: strength });
  enforceHardRules(sc);
  finishServedFrame(sc);
  stageScene(sc, undefined);
  m.sc = sc;
  // The mount effect.
  sc.conditions = setup.conditions;
  castScenario(sc, onPitch(m, career.squad ?? []));
  initDefenders(sc, m.rng);
  castDefence(sc, oppXIForCast);
  dressAutoKeeper(sc);
  standBackForRunup(m, sc);
  setUpKeeper(m, sc, (setup.seed ^ 0x4b7e) >>> 0);
  frameScenario(m, sc);
  if (setup.startMinute > 0) {
    m.seed += 1;
    const rng = countedRng(m, m.seed);
    m.rng = rng;
    const st = m.st;
    const jitter = ((career.week ?? 0) * 37 + (career.season ?? 0) * 11) % 5;
    const rung = setup.startMinute;
    const before = advanceTo(st, hiddenInputs(m), rng, 50);
    while (st.minute < 88 && !subComesOnNow(st.minute, st.userScore - st.oppScore, jitter, rung)) {
      before.push(...advanceTo(st, hiddenInputs(m), rng, st.minute + 1));
    }
    m.enteredAt = st.minute;
    m.subOn = true;
    m.subChances = 0;
    m.userScore = st.userScore;
    m.oppScore = st.oppScore;
    m.energyClock = st.minute;
    m.subFitness = liveEnergyAt(m, st.minute);
    m.minute = st.minute;
    m.halfTimeShown = st.minute > HALF_TIME_MINUTE;
    const named = nameTeamGoals(m, before, onPitch(m, career.squad ?? []), rng, false);
    const early = named.slice(0, Math.max(0, named.length - 14)).filter((e) => e.isGoal);
    m.log = [logLine("Kick Off", "period", 0), ...linesFrom([...early, ...named.slice(-14)]), logLine("You are coming on.", "you", st.minute)];
    setPhase(m, "feed");
    m.pause = { label: "You are going on", cta: "Get out there →", go: () => { m.pause = null; m.quickStart = true; startSimulation(m); } };
    return m;
  }
  m.enteredAt = 0;
  m.log = [logLine("Kick Off", "period", 0)];
  m.quickStart = true;
  startSimulation(m);
  return m;
}

function setUpKeeper(m: MatchState, sc: Scenario, seed: number) {
  seed = (seed ^ m.keeperSalt) >>> 0;
  const opts = brainOptionsHere();
  const facing = autoKickOf(sc)?.keeper?.strength ?? m.strength;
  opts.penalty = penaltyReadFor(facing, undefined);
  brainSetup(sc, seed, sc.keeperStrength, opts);
}
function dressAutoKeeper(sc: Scenario) {
  const k = autoKickOf(sc)?.keeper;
  if (!k) return;
  sc.keeperStrength = k.strength;
  if (k.name) sc.keeper.who = { id: k.id ?? "gk", name: k.name, shortName: k.shortName ?? k.name, position: "GK", face: k.face };
}
function runupStyleFor(m: MatchState, sc: Scenario) {
  const auto = autoKickOf(sc);
  return auto
    ? takerRunupFor(sc.kind, auto.taker.id || auto.taker.name)
    : yourRunupFor(sc.kind, penaltyRunupOf(m.setup.penaltyRunup as never), freeKickRunupOf(m.setup.freeKickRunup as never));
}
function standBackForRunup(m: MatchState, sc: Scenario) {
  if (hasRunup(sc.kind)) sc.player = standBackFor(runupStyleFor(m, sc), sc.ball, sc.player, sc.viewport);
}

function extraTimeEligibility(m: MatchState): { extraTime: boolean; isLevelNow: () => boolean } | null {
  const fixture = m.fixture;
  if (!fixture?.competition) return null;
  const comp = fixture.competition;
  if (comp === "Community Shield" || comp === "Super Cup") return { extraTime: false, isLevelNow: () => m.userScore === m.oppScore };
  if (fixture.kind === "cup") {
    if (fixture.leg === 1) return null;
    let firstUs = 0, firstThem = 0;
    if (fixture.leg === 2) {
      const you = m.career.player.club;
      const st = m.career.cupState?.find((c) => c.competition === comp && !c.winner);
      const tie = st?.rounds[st.rounds.length - 1]?.ties.find((t) => t.home === you || t.away === you);
      const l1 = tie?.legs?.[0];
      if (tie && l1) { firstUs = tie.home === you ? l1.hs : l1.as; firstThem = tie.home === you ? l1.as : l1.hs; }
    }
    return { extraTime: hasExtraTime(comp as ExtraTimeCompetition, fixture.round ?? "Final"), isLevelNow: () => (firstUs + m.userScore) === (firstThem + m.oppScore) };
  }
  if (fixture.kind === "europe") {
    const state = m.career.euroState;
    if (!state || comp !== state.competition) return null;
    const tie = euroCurrentTie(state);
    if (!tie) return null;
    const legIdx = euroCurrentLeg(state) ?? 0;
    if (tie.legs.length > 1 && legIdx === 0) return null;
    const firstLeg = tie.legs[0];
    const firstUs = firstLeg?.us ?? 0, firstThem = firstLeg?.them ?? 0;
    return { extraTime: true, isLevelNow: () => (firstUs + m.userScore) === (firstThem + m.oppScore) };
  }
  if (fixture.intlKo) {
    const ko = fixture.intlKo;
    if (ko.firstLeg) { const f = ko.firstLeg; return { extraTime: true, isLevelNow: () => f.us + m.userScore === f.them + m.oppScore }; }
    return { extraTime: ko.level === "et-pens", isLevelNow: () => m.userScore === m.oppScore };
  }
  if (fixture.kind === "international" && fixture.round && !fixture.round.startsWith("Group") && m.career.tournament?.season === m.career.season) {
    return { extraTime: true, isLevelNow: () => m.userScore === m.oppScore };
  }
  return null;
}

// ──────────────────────────────────────────────────── the hidden match ──

/** CanvasMatch.startSimulation. */
function startSimulation(m: MatchState, resim = false) {
  m.sceneGen += 1;
  const prior = resim ? m.stretch : null;
  if (prior) {
    m.st = { ...prior.snapshot };
    m.userScore = prior.userScore;
    m.oppScore = prior.oppScore;
    m.goalEvents.length = prior.goalEvents;
    m.oppGoalEvents.length = prior.oppGoalEvents;
    m.hooked = prior.hooked;
    m.hookedAt = prior.hookedAt;
    m.feed = prior.feed;
  } else m.seed += 1;
  const stretchSeed = prior ? prior.seed : m.seed;
  const rng = countedRng(m, stretchSeed);
  m.rng = rng;
  const st = m.st;
  st.userScore = m.userScore;
  st.oppScore = m.oppScore;
  if (!prior) m.playstyleChanges = [];
  const baseInputs: HiddenMatchInputs = prior
    ? { ...prior.inputs, energyModeChanges: prior.changes, context: { ...prior.inputs.context, playstyleChanges: m.playstyleChanges } }
    : hiddenInputs(m);
  if (!prior) {
    m.stretch = {
      snapshot: { ...st }, seed: stretchSeed, inputs: baseInputs, userScore: m.userScore, oppScore: m.oppScore,
      goalEvents: m.goalEvents.length, oppGoalEvents: m.oppGoalEvents.length, hooked: m.hooked, hookedAt: m.hookedAt,
      feed: m.feed, changes: [], queued: 0,
    };
  }
  let offAt = Infinity;
  if (m.subOn && !m.hooked) {
    const perMin = energyPerMinute(m.energyMode, m.energyFactor);
    const e = liveEnergyAt(m, st.minute);
    if (perMin > 0) offAt = e <= SUB_OFF_ENERGY ? st.minute : st.minute + Math.ceil((e - SUB_OFF_ENERGY) / perMin);
  }
  let plannedOff = false;
  const po = m.setup.plannedOffAt;
  if (po && !m.hooked && po < offAt) { offAt = Math.max(st.minute, po); plannedOff = true; }
  const stretchEnd = Math.min(m.matchCeiling, offAt);
  const handedOver: HiddenMatchEvent[] = [];
  const handover = prior ? (prior.handover ?? null) : m.handover;
  m.handover = null;
  if (!prior && m.stretch) m.stretch.handover = handover;
  if (handover) {
    const label = handover === "penalty" ? "penalty" : "free kick";
    const scored = rng() < (handover === "penalty" ? 0.76 : 0.09);
    handedOver.push(scored
      ? { minute: st.minute, text: `⚽ Your side score the ${label}!`, isGoal: true, teammateGoal: true }
      : { minute: st.minute, text: `A ${label} — someone else steps up, and it comes to nothing.`, isOpponent: false });
    resolveScenario(st, scored ? "goal" : "saved");
  }
  let step = m.hooked
    ? { events: [...handedOver, ...advanceTo(st, baseInputs, rng, m.matchCeiling)], request: null as ScenarioRequest | null, fullTime: true }
    : runStretch(st, baseInputs, rng, stretchEnd, (k: ScenarioKind) => mayTake(m, k), handedOver);
  const legsGone = !step.request && offAt < m.matchCeiling && st.minute >= offAt;
  if (legsGone) step = { ...step, fullTime: false };
  const squad = onPitch(m, m.career.squad ?? []);
  const events: SimEvent[] = nameTeamGoals(m, step.events, squad, mulberry32(stretchSeed * 31 + 7), true);
  m.userScore = st.userScore;
  m.oppScore = st.oppScore;
  if (events.length === 0) {
    const isOpponent = st.possession !== "user";
    const bank = isOpponent ? SIM_COMMENTARY_OPP : SIM_COMMENTARY_USER;
    events.push({ minute: st.minute, text: attributeClub(m, bank[Math.floor(rng() * bank.length)], isOpponent), isOpponent });
  }
  if (!m.hooked && !step.fullTime) {
    const t = m.tally;
    const decision = legsGone && plannedOff
      ? { hooked: true, reason: "rested" as HookReason, message: `${st.minute}' — a planned change. The manager wants a look at someone else; you come off.` }
      : legsGone
      ? { hooked: true, reason: "legs" as HookReason, message: `Out on your feet at ${Math.round(liveEnergyAt(m, st.minute))}% energy — you are taken off.` }
      : hookCheck({ minute: st.minute, startMinute: m.enteredAt, liveRating: ratingSoFar(t, st.userScore, st.oppScore),
        scoreDiff: st.userScore - st.oppScore, rng, liveEnergy: liveEnergyAt(m, st.minute), cameo: m.subOn });
    if (decision.hooked) {
      chargeEnergyTo(m, st.minute);
      m.hooked = decision.reason;
      m.hookedAt = st.minute;
      events.push({ minute: st.minute, text: decision.message });
      const after2 = advanceTo(st, baseInputs, rng, m.matchCeiling);
      events.push(...nameTeamGoals(m, after2, onPitch(m, m.career.squad ?? []), rng, false));
      m.userScore = st.userScore;
      m.oppScore = st.oppScore;
      step = { ...step, request: null, fullTime: true };
    }
  }
  m.pendingRequest = step.request;
  if (step.request && m.subOn) m.subChances += 1;
  const board = prior ? !!prior.board : m.ADDED > 0 && !m.boardShown && m.extraTimeStage === 0 && st.minute > m.MATCH_DURATION;
  if (board) {
    m.boardShown = true;
    if (m.stretch) m.stretch.board = true;
    const at = events.findIndex((e) => e.minute > m.MATCH_DURATION);
    events.splice(at < 0 ? events.length : at, 0, { minute: m.MATCH_DURATION, tone: "period", text: `+${m.ADDED} minute${m.ADDED === 1 ? "" : "s"} added` });
  }
  const shown = prior ? Math.max(0, prior.queued - m.queue.length) : 0;
  if (m.stretch) m.stretch.queued = events.length;
  const quick = m.quickStart && !prior && !!step.request && !step.fullTime && st.minute <= QUICK_START_MAX
    && (st.minute <= HALF_TIME_MINUTE || m.halfTimeShown);
  m.quickStart = false;
  if (quick) {
    m.log = [...m.log, ...linesFrom(events, m.minute)];
    m.queue = [];
    setClock(m, st.minute);
  } else {
    m.queue = linesFrom(events.slice(shown), m.minute);
  }
  setPhase(m, "feed");
  m.feedWait = null;
  m.simContinue = () => {
    if (step.fullTime) fullTime(m);
    else loadScenario(m, false);
  };
  if (quick) {
    after(m, 0, () => {
      const go = m.simContinue;
      m.simContinue = null;
      m.stretch = null;
      go?.();
    });
  }
}

/** The full-time branch of startSimulation's continuation. */
function fullTime(m: MatchState) {
  const finalize = () => { m.pause = null; finish(m); };
  if (m.extraTimeStage === 1) {
    m.log = [...m.log, logLine("End of the first half of extra time.", "period", m.matchCeiling)];
    m.pause = { cta: "Second half (extra time) →", go: () => {
      m.pause = null;
      m.extraTimeStage = 2;
      m.matchCeiling = m.MATCH_DURATION + m.ADDED + 30;
      m.log = [...m.log, logLine("Second half of extra time.", "period", m.matchCeiling)];
      startSimulation(m);
    } };
    return;
  }
  if (m.extraTimeStage === 2) {
    const el = extraTimeEligibility(m);
    if (el && el.isLevelNow()) startShootout(m);
    else {
      const home = m.fixture.home;
      m.log = [...m.log, logLine(`After Extra Time  ${home ? m.userScore : m.oppScore} - ${home ? m.oppScore : m.userScore}`, "period", m.matchCeiling)];
      m.pause = { cta: "Full time →", go: finalize };
    }
    return;
  }
  const ds = displayScore(m);
  const home = m.fixture.home;
  m.log = [...m.log, logLine(`Full Time  ${home ? ds.user : ds.opp} - ${home ? ds.opp : ds.user}`, "period", m.MATCH_DURATION + m.ADDED)];
  m.minute = m.MATCH_DURATION + m.ADDED;
  const eligibility = extraTimeEligibility(m);
  if (!(eligibility && eligibility.isLevelNow())) { m.pause = { cta: "Full time →", go: finalize }; return; }
  if (!eligibility.extraTime) { m.pause = { cta: "Penalties →", go: () => { m.pause = null; startShootout(m); } }; return; }
  m.pause = { cta: "Extra time →", go: () => {
    m.pause = null;
    m.wentToExtraTime = true;
    m.extraTimeStage = 1;
    m.matchCeiling = m.MATCH_DURATION + m.ADDED + 15;
    m.log = [...m.log, logLine("Extra time — first half.", "period", m.MATCH_DURATION + m.ADDED)];
    startSimulation(m);
  } };
}

/** The finalize of startSimulation (and finishShootout): the match's MatchStats. */
function finish(m: MatchState, shootout?: { home: number; away: number }) {
  const t = m.tally;
  const stats: MatchStats = {
    ...finaliseMatch(
      m.attempts, t.goals, t.assists, t.passesCompleted,
      Math.max(1, (m.hookedAt ?? m.minute) - m.enteredAt),
      m.userScore, m.oppScore, m.career, m.goalEvents, m.hooked, m.oppGoalEvents, m.fixture, matchExtras(m).tally,
    ),
    ...matchExtras(m).extra,
    endEnergy: liveEnergyAt(m, m.hookedAt ?? m.minute),
    kibCansUsed: m.kibUsed,
    playstyle: m.playstyle,
    ...(shootout ? { wentToExtraTime: m.wentToExtraTime, shootout } : m.wentToExtraTime ? { wentToExtraTime: true } : {}),
    ...(m.cheekyMisses.length ? { cheekyMisses: [...m.cheekyMisses] } : {}),
  };
  m.result = stats;
  setPhase(m, "postmatch");
}

// ───────────────────────────────────────────────────────── the chance ──

function clearChance(m: MatchState) {
  m.ball = null;
  m.aim = null;
  m.runup = null;
  m.contactTimerS = null;
  m.airWait = null; m.airOpened = null; m.aerial = null;
  m.outcome = null;
  m.drag = null;
  m.dragging = false;
  m.captainDrag = null;
  m.aimCommitAt = null; m.presser = null; m.thumbOrigin = null;
}

/** CanvasMatch.loadScenario. */
function loadScenario(m: MatchState, attacking: boolean) {
  m.sceneGen += 1;
  m.bootWait = null;
  applyClearanceRules();
  m.seed += 1;
  m.rng = countedRng(m, m.seed);
  const rng = m.rng;
  const rawRequest = attacking ? null : m.pendingRequest;
  m.pendingRequest = null;
  const chain = m.chain;
  m.chain = null;
  let request = rawRequest;
  if (rawRequest && !chain && newChancesOn()) {
    const d = (m.dribbleDeal ??= { deal: newDribbleDeal(), rng: mulberry32((m.setup.seed ^ 0xd21bb1e) >>> 0) });
    request = dealDribble(rawRequest, dribbleLevelFor(divisionOf(m.career), m.fixture.competition), d.deal, d.rng);
  }
  const setPiece = chain ? null : m.setPieceNext;
  m.setPieceNext = null;
  m.td = null;
  m.fpDribble = null;
  if (!attacking && !chain && request?.penaltyWon && !mayTake(m, "penalty")) {
    if (loadTeammatePenalty(m, request, rng)) return;
  }
  if (!attacking && request?.dribble) {
    m.fpDribble = { waveSizes: pickWaveSizes(rng, { minRounds: 3 }), seed: Math.floor(rng() * 1e9) };
    clearChance(m);
    m.facing = "up";
    setPhase(m, startTopDownDribble(m));
    logMoment(m, momentLine(m), "you");
    pushLine(m, request.reason);
    pushLine(m, "Beat your man to win the ball forward.");
    return;
  }
  const isTouchContinuation = chain !== null && chain.touchTouches !== undefined;
  const legsWas = m.playOn?.stick?.legs;
  m.bar = isTouchContinuation && legsWas ? legsWas.stamina.v : 1;
  m.playOn = null;
  m.steer = null;
  if (!isTouchContinuation) m.layOffsLeft = MAX_LAY_OFFS;
  if (chain && isTouchContinuation) {
    resetForTouchOn(m.sc, chain.pos);
  } else {
    if (request) m.lastDeal = request.deal;
    const made = makeChance({
      deal: m.lastDeal,
      source: chain?.kind ? { from: "kind", kind: chain.kind }
        : chain ? { from: "chain", pos: chain.pos, ambition: chain.ambition, position: m.setup.position }
        : setPiece ? { from: "kind", kind: setPiece }
        : attacking ? { from: "attacking" }
        : request ? { from: "request", request, position: m.setup.position }
        : { from: "weighted", position: m.setup.position },
      rng,
      strength: { keeper: m.strength, team: m.setup.teamRelationship, vision: m.vision },
      memory: m.setup.pictures ?? pictureMemory("game"),
      selection: m.chanceMemory,
      formation: formationShapeFor(m),
    });
    m.sc = made.sc;
    noteServedKind(m.st, made.sc.kind);
  }
  if (chain) {
    m.sc.chainDepth = chain.depth;
    m.sc.touchTouches = chain.touchTouches;
  }
  m.sc.conditions = m.setup.conditions;
  if (!isTouchContinuation) castScenario(m.sc, onPitch(m, m.career.squad ?? []));
  m.strikeRule = null;
  initDefenders(m.sc, rng);
  castDefence(m.sc, m.oppXIForCast);
  setUpKeeper(m, m.sc, (m.seed ^ 0x4b7e) >>> 0);
  let heavyTouch = 0;
  if (chain && !isTouchContinuation) {
    const sc = m.sc;
    const stance = { x: sc.player.x - sc.ball.x, y: sc.player.y - sc.ball.y };
    heavyTouch = applyFirstTouch(sc, tiredSkills(m).technique, rng);
    const vp = sc.viewport, inset = 1.4;
    sc.player = {
      x: Math.min(Math.max(sc.ball.x + stance.x, vp.x1 + inset), vp.x2 - inset),
      y: Math.min(Math.max(sc.ball.y + stance.y, Math.max(vp.y1 + inset, 0.3)), vp.y2 - inset),
    };
    separateBodies(sc);
  }
  standBackForRunup(m, m.sc);
  frameScenario(m, m.sc);
  clearChance(m);
  setPhase(m, "aim");
  logMoment(m, request?.lateCharge ? `Everyone's forward — it's launched into the box for ${playerLabel(m)}.` : momentLine(m), "you");
  if (request) pushLine(m, request.reason);
  if (heavyTouch > 0.55) pushLine(m, "Heavy touch — it has got away from you.");
  pushLine(m, isTouchContinuation ? "Still got it — looks up again." : commentaryBuildup(m.sc.kind, m.rng, targetName(m.sc)));
}

function momentLine(m: MatchState): string {
  const you = playerLabel(m);
  const pool = [
    `The move works its way to ${you}.`, `It breaks for ${you}.`, `The ball is worked through to ${you}.`, `It's picked out for ${you}.`,
    `The move reaches ${you}.`, `It comes to ${you}.`, `A gap opens up for ${you}.`, `The ball finds its way to ${you}.`,
  ];
  return pool[Math.floor(m.rng() * pool.length)];
}
function targetName(sc: Scenario | null): string | undefined {
  if (!sc) return undefined;
  if (sc.kind === "volley" || sc.kind === "header") return sc.crosser?.shortName;
  return sc.runner?.who?.shortName ?? sc.secondaryRunners.find((r) => r.role === "target")?.who?.shortName;
}

/** CanvasMatch.startTopDownDribble. Played on the stick in Roblox (WASD / thumbstick). */
function startTopDownDribble(m: MatchState): Phase {
  const fp = m.fpDribble;
  if (!fp) return "tdDribble";
  const car = m.career;
  const run = newFpRun({
    pace: fp.duels ? (car.skills.pace ?? 60) : 100,
    oppStrength: fp.duels ? Math.round(m.setup.oppStrength ?? 70) : 100,
    waveSizes: fp.waveSizes, roster: m.fpRoster, rng: mulberry32(fp.seed),
    mates: Math.round(getTuning("dribble.mates")),
    ...(fp.duels ? { duels: true, dribbling: car.skills.technique ?? 55 } : {}),
  });
  fpStick(run, 0, 0);
  m.td = run;
  m.tdReady = true;
  return "tdDribble";
}

/** CanvasMatch.loadTeammatePenalty. */
function loadTeammatePenalty(m: MatchState, request: ScenarioRequest, rng: () => number): boolean {
  const us = ourTakers(m);
  const taker = designatedTaker(us.outfield);
  if (!taker) return false;
  const sc = buildScenario("penalty", rng, m.strength, m.setup.teamRelationship, m.vision);
  enforceHardRules(sc);
  sc.conditions = m.setup.conditions;
  castScenario(sc, onPitch(m, m.career.squad ?? []).filter((p) => p.id !== taker.id));
  initDefenders(sc, rng);
  castDefence(sc, m.oppXIForCast);
  const kw = sc.keeper.who;
  const plan = planPenalty(taker.rating, mulberry32((m.seed ^ 0x7a11c) >>> 0));
  attachAutoKick(sc, { side: "us", taker, plan, context: "match",
    keeper: { strength: m.strength, id: kw?.id, name: kw?.name, shortName: kw?.shortName, face: kw?.face } });
  standBackForRunup(m, sc);
  setUpKeeper(m, sc, (m.seed ^ 0x4b7e) >>> 0);
  m.sc = sc;
  frameScenario(m, sc);
  clearChance(m);
  setPhase(m, "aim");
  logMoment(m, `Penalty! ${taker.shortName} to take it.`, "you");
  pushLine(m, request.reason);
  scheduleAutoKick(m);
  return true;
}

function ourTakers(m: MatchState): { outfield: PenaltyTaker[]; keeper: (PenaltyTaker & { overall?: number }) | null } {
  const squad = onPitch(m, m.career.squad ?? []);
  const all = squad.map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, face: p.imageUrl ?? fakeFaceFor(p.id),
    rating: takerRating(p), isGK: p.position === "GK", overall: p.overall }));
  const outfield = all.filter((t) => !t.isGK);
  for (let i = outfield.length; i < 5; i++) {
    outfield.push({ id: `mate-${i}`, name: `Team-mate ${i + 1}`, shortName: `No. ${i + 7}`, face: fakeFaceFor(`mate-${i}`), rating: 62, isGK: false, overall: undefined });
  }
  return { outfield, keeper: all.find((t) => t.isGK) ?? null };
}
function theirTakers(m: MatchState): { outfield: PenaltyTaker[]; keeper: PenaltyTaker | null } {
  const all: PenaltyTaker[] = (m.oppXIForCast ?? []).map((p) => ({ id: p.id, name: p.name, shortName: p.shortName,
    face: p.face ?? fakeFaceFor(p.id), rating: takerRating({ overall: p.overall }), isGK: p.isGK }));
  const outfield = all.filter((t) => !t.isGK);
  for (let i = outfield.length; i < 5; i++) {
    outfield.push({ id: `opp-${i}`, name: `Their No. ${i + 7}`, shortName: `No. ${i + 7}`, face: fakeFaceFor(`opp-${i}`), rating: 62 });
  }
  return { outfield, keeper: all.find((t) => t.isGK) ?? null };
}

/** CanvasMatch.scheduleAutoKick. */
function scheduleAutoKick(m: MatchState) {
  if (!autoKickOf(m.sc)) return;
  after(m, AUTO_STAND_MS, () => {
    if (m.phase !== "aim") return;
    const sc = m.sc;
    const k = autoKickOf(sc);
    if (!k) return;
    const a = aimFor(sc, k.plan);
    startRunup(m, a.dir, a.power, { contact: a.contact, skills: takerSkills(k.taker.rating) });
  });
}

// ──────────────────────────────────────────────────────── the shootout ──

/** CanvasMatch.startShootout + LiveShootout's state. */
function startShootout(m: MatchState) {
  const home = m.fixture.home;
  const yourSide: ShootoutSide = home ? "home" : "away";
  const car = m.career;
  const us = ourTakers(m), them = theirTakers(m);
  const you: PenaltyTaker | null = m.hooked ? null : {
    id: "you", name: `${car.player.firstName} ${car.player.lastName}`, shortName: playerLabel(m), face: car.player.portrait ?? "",
    rating: yourPenaltyRating({ technique: m.setup.skills.technique, freeKick: car.skills.freeKick ?? m.setup.skills.technique }, car.starRating ?? 0),
    you: true,
  };
  const ourOrder = shootoutOrder([...us.outfield, ...(us.keeper ? [us.keeper] : [])], you);
  const theirOrder = shootoutOrder([...them.outfield, ...(them.keeper ? [them.keeper] : [])]);
  const ourClubStrength = car.league.find((t) => t.name === car.player.club)?.strength ?? m.setup.teamRelationship;
  const ourKeeper = { strength: Math.max(20, Math.min(99, us.keeper?.overall ?? ourClubStrength)), id: us.keeper?.id, name: us.keeper?.name, shortName: us.keeper?.shortName, face: us.keeper?.face };
  const theirKeeper = { strength: m.strength, id: them.keeper?.id, name: them.keeper?.name, shortName: them.keeper?.shortName, face: them.keeper?.face };
  m.liveShootout = {
    homeClub: home ? car.player.club : m.fixture.opponent, awayClub: home ? m.fixture.opponent : car.player.club, yourSide,
    home: home ? ourOrder : theirOrder, away: home ? theirOrder : ourOrder,
    homeKeeper: home ? ourKeeper : theirKeeper, awayKeeper: home ? theirKeeper : ourKeeper,
    state: createShootout(), handed: -1,
  };
  logMoment(m, "Penalties.", "period");
  nextShootoutKick(m);
}

/** LiveShootout's effect: hand the next kick to the match, once per kick. */
function nextShootoutKick(m: MatchState) {
  const info = m.liveShootout;
  if (!info) return;
  const state = info.state;
  if (state.over) {
    after(m, 2600, () => finishShootout(m, { home: state.homeScore, away: state.awayScore }), false);
    return;
  }
  const side = nextShootoutSide(state);
  const order = side === "home" ? info.home : info.away;
  const idx = nextTakerIndex(state, side, Math.max(1, order.length));
  const taker = order[idx];
  const n = state.kicks.length;
  if (info.handed === n || !taker) return;
  info.handed = n;
  loadShootoutKick(m, { side, taker }, (scored) => {
    if (info.state.kicks.length === n) info.state = takeNextKick(info.state, scored, Math.max(1, order.length));
    nextShootoutKick(m);
  });
}

/** CanvasMatch.loadShootoutKick. */
function loadShootoutKick(m: MatchState, kick: { side: ShootoutSide; taker: PenaltyTaker }, submit: (scored: boolean) => void) {
  const info = m.liveShootout!;
  m.sceneGen += 1;
  m.seed += 1;
  m.rng = countedRng(m, m.seed);
  const rng = m.rng;
  m.chain = null;
  m.td = null;
  m.fpDribble = null;
  const ours = kick.side === info.yourSide;
  const keeper = kick.side === "home" ? info.awayKeeper : info.homeKeeper;
  const sc = buildScenario("penalty", rng, keeper.strength, m.setup.teamRelationship, m.vision);
  enforceHardRules(sc);
  sc.conditions = m.setup.conditions;
  initDefenders(sc, rng);
  stageScene(sc, { teammates: false });
  clearForShootout(sc);
  if (keeper.name) sc.keeper.who = { id: keeper.id ?? "gk", name: keeper.name, shortName: keeper.shortName ?? keeper.name, position: "GK", face: keeper.face };
  if (!kick.taker.you) {
    const plan = planPenalty(kick.taker.rating, mulberry32((m.seed ^ 0x7a11c) >>> 0));
    attachAutoKick(sc, { side: ours ? "us" : "them", taker: kick.taker, plan, keeper, context: "shootout" });
  }
  standBackForRunup(m, sc);
  setUpKeeper(m, sc, (m.seed ^ 0x4b7e) >>> 0);
  m.sc = sc;
  frameScenario(m, sc);
  clearChance(m);
  m.shootoutKick = { resolve: submit };
  setPhase(m, "aim");
  logMoment(m, kick.taker.you ? "Your penalty — up to you." : `${kick.taker.shortName} steps up…`, "you");
  if (!kick.taker.you) scheduleAutoKick(m);
}

function finishShootout(m: MatchState, result: { home: number; away: number }) {
  m.shootoutResult = result;
  m.liveShootout = null;
  finish(m, result);
}

// ──────────────────────────────────────────────────────────── the input ──

/**
 * Pointer down on the pitch at `p` (pitch metres): CanvasMatch.onPointerDown's
 * aim branch (and the curve swipe in flight, the run-up nudge).
 */
export function pointerDown(m: MatchState, p: Vec2) {
  if (m.phase === "aim" && autoKickOf(m.sc)) return;
  if (m.phase === "aim" && isAirKind(m.sc.kind) && airTapOn()) return;
  if (m.phase === "tdDribble") { if (m.tdReady) m.tdReady = false; return; }
  if (m.phase !== "aim" || m.windUp !== null) return;
  const b = m.sc.ball;
  const r = captainPickAt(m, p);
  if (r) { m.captainDrag = { target: r, from: p, to: p }; return; }
  const ballD = Math.hypot(p.x - b.x, p.y - b.y);
  if (ballD >= nearestCaptainCandidateDist(m, p)) return;
  if (ballD > sameOnScreenM(m, BALL_GRAB_FRACTION)) return;
  m.dragging = true;
  m.thumbOrigin = p;
  m.drag = { x: b.x, y: b.y };
}

/** Pointer move: the drag back (onPointerMove). */
export function pointerMove(m: MatchState, p: Vec2) {
  if (m.captainDrag) { m.captainDrag.to = p; return; }
  if (!m.dragging) return;
  const o = m.thumbOrigin, bb = m.sc.ball;
  m.drag = o ? { x: bb.x + (p.x - o.x), y: bb.y + (p.y - o.y) } : p;
  if (m.aimCommitAt === null && m.phase === "aim" && acceptsCaptainOrders(m.sc.kind) && screenPull(m, m.drag, bb) >= MIN_PULL) commitAim(m);
}

/** Pointer up: let go of the aim (onPointerUp's aim branch). */
export function pointerUp(m: MatchState) {
  if (m.captainDrag) {
    const { target, from, to } = m.captainDrag;
    m.captainDrag = null;
    const sc = m.sc;
    const isTap = Math.hypot(to.x - from.x, to.y - from.y) < CAPTAIN_DRAG_MIN;
    if (target === "follower") {
      if (isTap) { sc.relayToFollower = !sc.relayToFollower; if (sc.relayToFollower) sc.relayTo = null; }
      else sc.follower.commandedTo = { x: to.x, y: to.y };
    } else if (isTap) {
      sc.relayTo = sc.relayTo === target ? null : target;
      if (sc.relayTo) sc.relayToFollower = false;
    } else target.commandedTo = { x: to.x, y: to.y };
    return;
  }
  if (!m.dragging) return;
  m.dragging = false;
  const d = m.drag;
  m.drag = null;
  m.thumbOrigin = null;
  if (!d) return;
  const b = m.sc.ball;
  const power = powerFromDrag(m, d, b);
  if (m.aimCommitAt !== null && (screenPull(m, d, b) < MIN_PULL || power < 0.02)) { loseChance(m, "letgo"); return; }
  if (screenPull(m, d, b) < MIN_PULL) return;
  if (power < 0.02) return;
  const dir = { x: b.x - d.x, y: b.y - d.y };
  if (hasRunup(m.sc.kind)) { startRunup(m, dir, power); return; }
  m.aim = { dir, power };
  if (m.powerArmed && knucklePowerOn() && mechOpen(m, "powerShot") && aimedAtGoal(m.sc, dir)) {
    m.powerStrike = true;
    m.powerArmed = false;
    m.windUp = POWER_SHOT_WINDUP_S;
    pushLine(m, "He pulls the leg right back…");
    return;
  }
  m.powerStrike = false;
  setPhase(m, "contact");
}

/** The ⚡ power-shot button (arms the next shot). */
export function armPowerShot(m: MatchState, on: boolean) { m.powerArmed = on; }

/** A swipe while the ball is in the air (curve boots): pitch-space delta, lateral first. */
export function curveSwipe(m: MatchState, lateral: number, other: number) {
  if (m.phase !== "flight" || !m.setup.canCurve || !m.ball) return;
  const dir = curveDirFromSwipe(lateral, other);
  if (dir) applyCurveSwipe(m.ball, dir);
}

/** The run-up's sideways drag: metres of finger travel along the goal line (as a share of the frame). */
export function runupNudge(m: MatchState, alongShareOfWidth: number, base: number) {
  const ru = m.runup;
  if (!ru || ru.arrived || !ru.nudge) return;
  const vp = m.camera;
  const width = m.facing === "up" ? vp.x2 - vp.x1 : vp.y2 - vp.y1;
  const mm = nudgeFromDrag(alongShareOfWidth, 1, width);
  ru.nudgeM = Math.max(-RUNUP.nudgeMaxM, Math.min(RUNUP.nudgeMaxM, base + mm));
}

/** The strike screen's tap (ContactBall's onContact). */
export function contact(m: MatchState, c: { cx: number; cy: number; lift?: number; late?: boolean }) {
  if (m.phase !== "contact") return;
  const sc = m.sc;
  if (m.powerStrike) {
    m.powerStrike = false;
    return;
  }
  if (isAirKind(sc.kind) && airTapOn()) {
    const st = airTapStrike(sc.kind as AirKind, sc.ball, c, airAerialNow(m));
    handleContact(m, { ...st.contact, aim: st.aim });
  } else handleContact(m, c);
}

/** The power shot's strike screen (PowerShotContact's onStrike, q = how well it was timed). */
export function powerContact(m: MatchState, q: number) {
  if (m.phase !== "contact" || !m.powerStrike) return;
  const r = mulberry32(shotSeedFor(m.seed ^ 0x9073, m.rngCalls));
  m.powerStrike = false;
  handleContact(m, POWER_SHOT_CONTACT, undefined, { ...powerShotStrike(q, r), noKnuckle: true });
}

/** The strike screen's countdown ran out (handleScuff). */
export function contactTimeout(m: MatchState) {
  if (m.phase !== "contact" || !m.aim) return;
  const r = mulberry32(((m.seed ^ Math.imul(m.rngCalls + 1, 0x27d4eb2d)) ^ 0x5c0f) >>> 0);
  const s = scuffStrike(m.aim.dir, m.aim.power, r);
  showAction(m, "SCUFFED");
  handleContact(m, s.contact, { dir: s.dir, power: s.power });
}

/** Your run after a pass: a pitch direction (0..1 long) and sprint (WASD, the stick). */
export function steerRun(m: MatchState, x: number, y: number, sprint: boolean) {
  m.steer = { x, y, sprint };
}
/** "Call for it" (captain, during your run). */
export function callForBall(m: MatchState): string | null {
  const po = m.playOn;
  if (!po?.stick || m.phase !== "flight") return null;
  const r = callForIt(po, m.sc);
  if (r === "late") return "Too late, he's shooting";
  if (r === "coming") return "It's coming!";
  pushLine(m, `${playerLabel(m)} calls for it…`);
  return "Calling for it!";
}

/** The top-down dribble on the stick: x right, y up the pitch, each -1..1. */
export function dribbleStick(m: MatchState, x: number, y: number) {
  const run = m.td;
  if (!run || m.phase !== "tdDribble") return;
  if (m.tdReady && Math.hypot(x, y) > 0.08) m.tdReady = false;
  fpStick(run, x, y);
}
/** Knock it past him, left (-1) or right (1). */
export function dribbleBurst(m: MatchState, dir: -1 | 1): boolean {
  const run = m.td;
  if (!run || m.phase !== "tdDribble" || run.phase !== "running") return false;
  if (m.tdReady) m.tdReady = false;
  return fpBurst(run, dir);
}
/** Pass to the team-mate nearest `p` (within 3 m). */
export function dribblePass(m: MatchState, p: Vec2): boolean {
  const run = m.td;
  if (!run || m.phase !== "tdDribble" || run.phase !== "running") return false;
  const mi = run.mates.findIndex((mm) => Math.hypot(mm.x - p.x, mm.y - p.y) < 3);
  if (mi < 0) return false;
  fpPass(run, mi, m.vision);
  return true;
}

/** The pause's button: Second half, Full time, Extra time, Penalties, Get out there. */
export function continuePause(m: MatchState) {
  const p = m.pause;
  if (!p) return;
  p.go();
}
/** Half time: drink a Basic KIB can (+65 energy). */
export function drinkKib(m: MatchState) {
  const restore = KIB_CANS.find((c) => c.id === "basic")?.restore ?? 65;
  const owned = (m.career.kibCans?.basic ?? 0) - m.kibUsed;
  if (owned <= 0 || m.energy >= 100) return;
  m.kibUsed += 1;
  m.energy = clampEnergy(m.energy + restore);
}
export function cycleSpeed(m: MatchState) {
  m.speed = m.speed === 1 ? 2 : m.speed === 2 ? 4 : m.speed === 4 ? 8 : 1;
  m.feedWait = null;
}
/** Low / Medium / High (CanvasMatch.setEnergyMode). */
export function setEnergyMode(m: MatchState, mode: EnergyMode) {
  if (mode === m.energyMode) return;
  chargeEnergyTo(m, m.minute);
  m.energyMode = mode;
  const stretch = m.stretch;
  if (stretch && m.phase === "feed" && !m.hooked) {
    stretch.changes.push({ minute: m.minute + 1, mode });
    startSimulation(m, true);
  }
}
/** Defensive / Balanced / Attacking (CanvasMatch.setPlaystyle). */
export function setPlaystyle(m: MatchState, ps: Playstyle) {
  if (ps === m.playstyle) return;
  m.playstyle = ps;
  const stretch = m.stretch;
  if (stretch && m.phase === "feed" && !m.hooked) {
    m.playstyleChanges = [...m.playstyleChanges, { minute: m.minute + 1, playstyle: ps }];
    startSimulation(m, true);
  }
}
export function toggleTouchMode(m: MatchState) { m.touchModeOn = !m.touchModeOn; }

function captainPickAt(m: MatchState, p: Vec2): Runner | "follower" | null {
  if (!m.career.captain) return null;
  const sc = m.sc;
  if (!acceptsCaptainOrders(sc.kind)) return null;
  const grab = Math.max(sameOnScreenM(m, 2.2 / 42), sameOnScreenM(m, 0.09));
  let best: Runner | "follower" | null = null;
  let bestD = grab;
  for (const r of orderableRunners(sc)) {
    const d = Math.hypot(p.x - r.pos.x, p.y - r.pos.y);
    if (d < bestD) { bestD = d; best = r; }
  }
  if (goalInView(sc.kind)) {
    const d = Math.hypot(p.x - sc.follower.x, p.y - sc.follower.y);
    if (d < bestD) { bestD = d; best = "follower"; }
  }
  return best;
}
function nearestCaptainCandidateDist(m: MatchState, p: Vec2): number {
  if (!m.career.captain) return Infinity;
  const sc = m.sc;
  if (!acceptsCaptainOrders(sc.kind)) return Infinity;
  let best = Infinity;
  for (const r of orderableRunners(sc)) best = Math.min(best, Math.hypot(p.x - r.pos.x, p.y - r.pos.y));
  if (goalInView(sc.kind)) best = Math.min(best, Math.hypot(p.x - sc.follower.x, p.y - sc.follower.y));
  return best;
}

/** CanvasMatch.commitAim: past the dead zone, the presser comes. */
function commitAim(m: MatchState) {
  m.aimCommitAt = m.now;
  const sc = m.sc;
  m.presser = null;
  if (m.setup.pressure > 0) {
    let best: Scenario["defenders"][number] | null = null;
    let bestD = Infinity;
    for (const d of sc.defenders) {
      const dist = Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    m.presser = best;
    m.presserBehind = !!best && pressFromBehind(best, sc.ball, sc.player);
  }
  if (m.career.captain && (orderableRunners(sc).some((r) => !!r.commandedTo) || !!sc.follower.commandedTo)) {
    pushLine(m, "He's off — play it before he's past the last man.");
  }
}

function loseChance(m: MatchState, why: "letgo" | "pressed") {
  if (m.phase !== "aim" && m.phase !== "contact") return;
  m.aimCommitAt = null;
  m.presser = null;
  m.dragging = false;
  m.drag = null;
  m.thumbOrigin = null;
  m.aim = null;
  if (why === "pressed" && mulberry32((m.seed ^ 0x0f0c1a5) >>> 0)() < foulShareFor(m.presserBehind)) { fouled(m); return; }
  resolveOutcome(m, "tackled");
  showAction(m, why === "letgo" ? "CHANCE GONE" : "CLOSED DOWN");
  pushLine(m, why === "letgo" ? "Hesitates, lets it go — and the chance is gone." : "Closed down before he could play it!");
}

function fouled(m: MatchState) {
  const b = m.sc.ball;
  const inBox = b.y <= BOX_DEPTH && b.x >= BOX_L && b.x <= BOX_R;
  const kind: ScenarioKind = inBox ? "penalty" : "free_kick";
  m.outcome = null;
  setPhase(m, "result");
  showAction(m, inBox ? "PENALTY" : "FOUL");
  pushLine(m, inBox ? "Brought down in the box — penalty!" : "Chopped down as he pulls back — free kick.");
  if (mayTake(m, kind)) {
    m.setPieceNext = kind;
    resolveScenario(m.st, "delivered");
    after(m, 1600, () => loadScenario(m, true));
  } else {
    m.handover = kind;
    after(m, 1800, () => startSimulation(m));
  }
}

function stepCommitted(m: MatchState, dt: number) {
  const sc = m.sc;
  const since = m.now - (m.aimCommitAt ?? m.now);
  for (const r of orderableRunners(sc)) {
    const to = r.commandedTo;
    if (!to) continue;
    const dx = to.x - r.pos.x, dy = to.y - r.pos.y, togo = Math.hypot(dx, dy);
    if (togo < 0.6) { r.heldAt = { x: to.x, y: to.y }; r.commandedTo = undefined; r.moving = false; continue; }
    const step = Math.min(togo, r.speed * dt);
    r.pos.x += (dx / togo) * step; r.pos.y += (dy / togo) * step;
    r.moving = true; r.sprint = true;
  }
  const f = sc.follower;
  if (f.commandedTo) {
    const dx = f.commandedTo.x - f.x, dy = f.commandedTo.y - f.y, togo = Math.hypot(dx, dy);
    if (togo < 0.6) { f.heldAt = { x: f.commandedTo.x, y: f.commandedTo.y }; f.commandedTo = undefined; f.active = false; }
    else { const step = Math.min(togo, FOLLOWER_RUN_SPEED * dt); f.x += (dx / togo) * step; f.y += (dy / togo) * step; f.active = true; }
  }
  const d = m.presser;
  if (d && since > PRESS_REACT_S) {
    const b = sc.ball;
    if (Math.hypot(b.x - d.x, b.y - d.y) <= PRESS_WIN_R) { loseChance(m, "pressed"); return; }
    pressStep(d, b, sc.player, pressSpeedFor(m.setup.pressure) * dt);
  }
}

/** CanvasMatch.startRunup. */
function startRunup(m: MatchState, rawDir: Vec2, power: number, auto?: { contact: { cx: number; cy: number }; skills: KickSkills }) {
  const sc = m.sc;
  const L = Math.hypot(rawDir.x, rawDir.y) || 1;
  const dir0 = { x: rawDir.x / L, y: rawDir.y / L };
  const styleId = runupStyleFor(m, sc);
  const styled = planRunup(styleId, sc.ball, sc.player);
  void plantBeside;
  m.runup = { t: 0, dir0, power, nudgeM: 0, nudge: !auto && canNudge(sc.kind), arrived: false, styled, runS: RUNUP_MOTION[styleId].runS, ...(auto ? { auto } : {}) };
  if (auto) { setPhase(m, "runup"); return; }
  m.aim = { dir: dir0, power };
  setPhase(m, "runup");
  pushLine(m, "He runs up…");
}

function airAerialNow(m: MatchState): number {
  return Math.round(aerialOf(m.career.skills) * (1 - fatigueCut(liveEnergyAt(m, m.minute))));
}

/** CanvasMatch.handleContact: the strike. */
function handleContact(
  m: MatchState,
  tapped: { cx: number; cy: number; lift?: number; late?: boolean; aim?: { dir: Vec2; power: number } },
  over?: { dir: Vec2; power: number; skills?: KickSkills },
  extras?: ShotExtras,
) {
  let a = over ? { dir: over.dir, power: over.power } : tapped.aim ?? m.aim;
  if (!a) return;
  const aerNow = !over && m.aerial?.sc === m.sc && m.aerial.opened ? m.aerial : null;
  if (aerNow) a = aerialStrikeTint(aerNow.move, a.dir, a.power, (m.seed ^ Math.imul(m.rngCalls + 1, 0x27d4eb2d)) >>> 0);
  let ct: StrikeContact = { cx: tapped.cx, cy: tapped.cy };
  if (!over && tapped.lift !== undefined && (airborneOn() || isAirKind(m.sc.kind))) {
    const mo = strikeMotion(m.sc.kind, m.seed);
    if (mo === "float" || mo === "bounce") ct = { ...ct, air: { kind: mo === "float" ? "header" : "volley", lift: tapped.lift, cx: tapped.cx, cy: tapped.cy } };
  }
  const auto = over?.skills ? { skills: over.skills } : null;
  m.contactTimerS = null;
  const tired = tiredSkills(m);
  const fkRaw = m.career.skills.freeKick;
  const strikeWith = auto ? auto.skills : setPieceSkills(
    tired, fkRaw === undefined ? tired.technique : fkRaw * (1 - fatigueCut(liveEnergyAt(m, m.minute))), m.sc.kind);
  const feelPow = !auto && shotPowerOn() && struckAtGoal(m.sc, a.dir, ct.cx);
  const launchWith = feelPow ? { ...strikeWith, power: feelPower(strikeWith.power) }
    : switchOn("powerCurve") ? { ...strikeWith, power: strikingPower(strikeWith.power) } : strikeWith;
  if (ct.air) ct = { ...ct, air: { ...ct.air, tech: launchWith.technique, aerial: Math.round(aerialOf(m.career.skills) * (1 - fatigueCut(liveEnergyAt(m, m.minute)))) } };
  const shotPro = !auto && shotsPro();
  const shotKnuckle = !auto && knucklePowerOn() && mechOpen(m, "knuckle");
  const shotField = !auto && contactFieldOn();
  const shotLift = feelPow ? feelLift(strikeWith.power) : 1;
  const shotRec = (shotPro || shotKnuckle || extras || shotField || shotLift !== 1)
    ? { seed: shotSeedFor(m.seed, m.rngCalls), extras, pro: shotPro, knuckle: shotKnuckle, field: shotField, lift: shotLift } : null;
  m.physAcc = 0;
  m.deflections = 0;
  m.matePlays = [];
  m.strikeAt = { x: m.sc.ball.x, y: m.sc.ball.y };
  if (shotRec) m.ball = launchShot(m.sc, a.dir, a.power, ct, launchWith, m.rng, shotRec, shotRec, launch).ball;
  else m.ball = launch(m.sc, a.dir, a.power, ct, launchWith, m.rng);
  applyAirborne(m.ball, m.sc, ct.air);
  if (hasBrain(m.sc)) {
    const bs = ((m.seed ^ Math.imul(m.rngCalls + 1, 0xc2b2ae35)) ^ 0x4b7f ^ m.keeperSalt) >>> 0;
    brainStrike(m.sc, m.ball, bs);
  } else if (m.sc.kind === "penalty") {
    const facing = autoKickOf(m.sc)?.keeper?.strength ?? m.strength;
    const read = penaltyReadFor(facing, undefined);
    const r = mulberry32(((m.seed ^ Math.imul(m.rngCalls + 1, 0x9e3779b1)) ^ 0x5eed ^ m.keeperSalt) >>> 0);
    applyPenaltyRead(m.sc, decidePenaltyRead(m.sc, m.ball, read, [r(), r()]));
  }
  m.runup = null;
  m.cheekyStrike = auto ? null : cheekyStrike(m.sc.kind, m.ball, (m.sc.goal.x1 + m.sc.goal.x2) / 2, m.ball.youStruckAtGoal === true);
  {
    const r = mulberry32(((m.seed ^ Math.imul(m.rngCalls + 1, 0x85ebca6b)) ^ 0x6b1d) >>> 0);
    m.strikeRule = strikeKind(m.sc, m.ball, r, {
      keeperStrength: m.strength, setPieceSkill: undefined, power: strikeWith.power, technique: strikeWith.technique,
      ...(!auto && runupStyleFor(m, m.sc) === LEAF_RUNUP ? { runup: LEAF_RUNUP } : {}),
    });
  }
  if (m.touchModeOn && m.setup.canExtraTouch && !auto) m.sc.player = { x: m.ball.pos.x, y: m.ball.pos.y };
  m.playOn = null;
  m.playOnCaught = false;
  {
    const sc = m.sc;
    delete sc.matePace;
    const touchOn = m.touchModeOn && m.setup.canExtraTouch;
    if (!touchOn && !m.shootoutKick && runAfterWanted({ kind: sc.kind, youShotAtGoal: m.ball.youStruckAtGoal === true, auto: !!auto })) {
      m.playOnRng = mulberry32(((m.seed ^ Math.imul(m.rngCalls + 1, 0x9e3779b1)) ^ 0x61a7) >>> 0);
      const bl = m.ball;
      const stick = afterPassStickOn() && mechOpen(m, "steer");
      m.playOn = startPlayOnRun(sc, m.playOnRng, { x: bl.pos.x + bl.vel.x * 0.8, y: bl.pos.y + bl.vel.y * 0.8 }, {
        stick, pace: m.career.skills.pace, energy: liveEnergyAt(m, m.minute), bar: m.bar,
      });
      m.steer = null;
    }
  }
  setPhase(m, "flight");
  if (m.sc.kind === "header" && m.ball.lastTouch === "defence") pushLine(m, "He gets up highest and heads it clear!");
  else pushLine(m, commentaryStrike(m.sc.kind, m.rng, targetName(m.sc)));
}

// ─────────────────────────────────────────────────────────── the result ──

/** CanvasMatch.resolveOutcome. */
function resolveOutcome(m: MatchState, res: Outcome) {
  m.outcome = res;
  setPhase(m, "result");
  {
    const b = m.ball;
    m.bootWait = b?.cleared && !b.inNet ? { t: m.now, stopT: null, then: null } : null;
  }
  const sc = m.sc;
  const receiverShot = sc.receiverShot === true;
  const auto = autoKickOf(sc);
  const youShot = !auto && m.ball?.youStruckAtGoal === true && !receiverShot;
  const isSimplePass = !youShot && !receiverShot && sc.passTarget != null;
  const kind = OUTCOME_TEXT[res].kind;
  const yourFinish: "chip" | "curl" | undefined = (() => {
    if (auto) return undefined;
    if (m.cheekyStrike === "chip") return "chip";
    const log = m.ball?.actionLog ?? [];
    const last = [...log].reverse().find((x) => x.kind === "shot" && x.actor === "you");
    return last?.mode === "curl" ? "curl" : undefined;
  })();
  {
    const ch = m.cheekyStrike;
    m.cheekyStrike = null;
    if (ch && !auto && (sc.kind === "penalty" || youShot) && isCheekyMiss(res)) m.cheekyMisses.push({ kind: ch, minute: m.minute });
  }
  const isShootoutKick = m.shootoutKick != null;
  const assist = assistFor(m.matePlays);
  const d = creditChance(res, { youShot, receiverShot, isSimplePass, assistYours: assist.yours });
  const t = m.tally;
  if (!isShootoutKick && !auto) {
    t.shots += d.shots; t.goals += d.goals; t.passes += d.passes; t.passesCompleted += d.passesCompleted;
    t.chances += d.chances; t.assists += d.assists;
    if (kind !== "goal" && res !== "delivered" && res !== "touchOn" && !receiverShot) {
      if (youShot) {
        t.misses += 1;
        const mk = missKind(sc.kind, res);
        if (mk === "penalty") t.missesPen += 1;
        else if (mk === "oneOnOne") t.misses1v1 += 1;
        else if (mk === "on") t.missesOn += 1;
      } else t.lost += 1;
    }
    if (d.goals > 0) {
      const z = goalZone(sc.kind, m.strikeAt);
      if (z === "penalty") t.goalsPen += d.goals;
      else if (z === "tapIn") t.goalsTap += d.goals;
      else if (z === "outside") t.goalsOut += d.goals;
    }
    if (d.passesCompleted > 0) {
      const pg = passGrade(sc.passDifficulty, sc.passAmbition);
      if (pg === "safe") t.passesSafe += d.passesCompleted;
      else if (pg === "ambitious") t.passesAmb += d.passesCompleted;
    }
    m.strikeAt = null;
    if (res !== "touchOn") {
      const out: ChanceOutcome = kind === "goal" ? (d.goals > 0 ? "goal" : d.assists > 0 ? "assist" : "pass")
        : res === "delivered" ? "pass" : res === "offside" ? "offside" : receiverShot ? "setup" : youShot ? "miss" : res === "tackled" ? "tackled" : "lost";
      m.chanceLog.push({ minute: m.minute, kind: sc.kind, outcome: out });
    }
  }
  if (!isShootoutKick && !auto && kind === "goal") m.userScore += 1;
  if (!isShootoutKick && !auto) resolveScenario(m.st, matchResultFor(res));
  // what it says on the screen
  if (auto?.side === "them") showAction(m, kind === "goal" ? "SCORED" : res === "saved" || res === "caught" || res === "tipped" ? "SAVED!" : "MISSED!");
  else if (auto && kind !== "goal") showAction(m, res === "saved" || res === "caught" || res === "tipped" ? "SAVED" : "MISSED");
  else if (kind === "goal") showAction(m, "GOAL");
  else if (res === "tackled" || res === "blocked") showAction(m, res === "blocked" ? "BLOCKED" : "INTERCEPTED");
  else if (res === "offside") showAction(m, "OFFSIDE");
  else if (res === "delivered") showAction(m, m.deflections > 0 ? (sc.kind === "free_kick" ? "OFF THE WALL" : "DEFLECTED") : "PASS");
  else if (res === "touchOn") showAction(m, "TOUCH ON");
  else if (res === "out" || res === "wide" || res === "over" || res === "short") showAction(m, res === "wide" ? "WIDE" : res === "over" ? "OVER" : res === "short" ? "NOBODY THERE" : "OUT OF PLAY");
  else if (res === "post") showAction(m, "POST");
  else if (res === "saved" || res === "caught" || res === "tipped") showAction(m, "SAVED");
  // who scored
  let roleLabel = sc.receiver?.roleLabel;
  if (!isShootoutKick && !auto && kind === "goal") {
    const squad = onPitch(m, m.career.squad ?? []);
    const playerName = `${m.career.player.firstName} ${m.career.player.lastName}`;
    const rng = m.rng;
    const how = res === "rebound" ? "rebound" : sc.kind;
    const distance = Math.hypot(sc.ball.x - (sc.goal.x1 + sc.goal.x2) / 2, sc.ball.y);
    const mateGoal = d.assists === 1 || (receiverShot && !assist.yours);
    if (mateGoal && sc.receiver) {
      const scorer = sc.receiver.who ?? (() => {
        const forwards = squad.filter((p) => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
        return pickSquadScorer(forwards.length > 0 ? forwards : squad, rng) ?? undefined;
      })();
      if (scorer) roleLabel = scorer.shortName;
      const scorerLabel = scorer?.shortName ?? sc.receiver.roleLabel ?? "Team-mate";
      const mateAssist = assist.yours ? undefined : assist.by?.who;
      m.goalEvents.push({
        minute: m.minute, scorer: scorer?.name ?? sc.receiver.roleLabel ?? "Team-mate",
        assist: assist.yours ? playerName : mateAssist?.name, isUserGoal: false, how, distance: Math.round(distance),
        ...(assist.yours && sc.receivedAt ? { passLength: Math.round(Math.hypot(sc.receivedAt.x - sc.ball.x, sc.receivedAt.y - sc.ball.y)) } : {}),
      });
      logMoment(m, `⚽ ${scorerLabel} scores!`, "goal");
      if (assist.yours) logMoment(m, `🎯 ${playerLabel(m)} assists!`, "assist");
      else if (mateAssist) logMoment(m, `🎯 ${mateAssist.shortName} assists!`, "assist");
    } else if (d.goals === 1) {
      const assister = res === "rebound" ? undefined : creatorOf(sc, squad, rng);
      m.goalEvents.push({ minute: m.minute, scorer: playerName, assist: assister?.name, isUserGoal: true, how, distance: Math.round(distance),
        ...(yourFinish ? { finish: yourFinish } : {}) });
      logMoment(m, `⚽ ${playerLabel(m)} scores!`, "goal");
      if (assister) logMoment(m, `🎯 ${assister.shortName} assists!`, "assist");
    } else {
      m.goalEvents.push({ minute: m.minute, scorer: playerName, isUserGoal: true, how, distance: Math.round(distance), ...(yourFinish ? { finish: yourFinish } : {}) });
      logMoment(m, `⚽ ${playerLabel(m)} scores!`, "goal");
    }
  }
  pushLine(m, commentaryResult(res, m.rng, { chain: sc.receiver != null, receiverReached: sc.receiverReached === true, roleLabel, isPass: isSimplePass }));
  if (isShootoutKick) {
    const cb = m.shootoutKick;
    m.shootoutKick = null;
    const scored = kind === "goal";
    after(m, 1400, () => cb?.resolve(scored));
    return;
  }
  if (auto && auto.context === "match") {
    const saved = res === "saved" || res === "caught" || res === "tipped";
    if (kind === "goal") {
      m.userScore += 1;
      m.goalEvents.push({ minute: m.minute, scorer: auto.taker.name, isUserGoal: false, how: "penalty", distance: 11 });
      logMoment(m, `⚽ ${auto.taker.shortName} scores the penalty!`, "goal");
    } else logMoment(m, `${auto.taker.shortName}'s penalty is ${saved ? "saved" : "missed"}.`, "chance");
    resolveScenario(m.st, kind === "goal" ? "goal" : "saved");
    after(m, 1800, () => startSimulation(m));
    return;
  }
  if (auto) { after(m, 1600, () => loadScenario(m, false)); return; }
  let quickOn = false;
  if (res === "delivered" && m.playOnCaught) {
    m.playOnCaught = false;
    const b = m.ball;
    if (b) {
      m.chain = { pos: { x: b.pos.x, y: b.pos.y }, depth: sc.chainDepth ?? 0, ambition: Math.max(sc.passDifficulty, sc.passAmbition ?? 0), touchTouches: sc.touchTouches ?? 0 };
      logMoment(m, `${sc.receivedBy?.who?.shortName ?? "He"} lays it back to ${playerLabel(m)}.`, "chance");
      quickOn = true;
    }
  } else if (res === "delivered") {
    const depth = sc.chainDepth ?? 0;
    const at = sc.receivedAt ?? sc.runner?.pos ?? sc.passTarget;
    const onlyPlay = !goalInView(sc.kind);
    const who = sc.receivedBy?.who?.shortName ?? targetName(sc);
    const returnChance = onlyPlay && at ? giveAndGoChance(sc, at) : chainReturnChance(sc);
    if (at && depth < CHAIN_MAX && m.rng() < returnChance) {
      const ambition = Math.max(sc.passDifficulty, sc.passAmbition ?? 0);
      m.chain = { pos: { x: at.x, y: at.y }, depth: depth + 1, ambition };
      pushLine(m, at.y < 25 ? "It comes straight back to you, higher up…" : "He lays it off — the move keeps going…");
      logMoment(m, `${who ?? "He"} plays it back to ${playerLabel(m)}.`, "chance");
      if (newChancesOn() && !goalInView(sc.kind)) quickOn = true;
      else after(m, 900, () => showAction(m, "BACK TO YOU"));
    } else {
      logMoment(m, `${who ?? "He"} keeps it — the move goes on without ${playerLabel(m)}.`, "chance");
    }
  } else if (res === "touchOn") {
    const touches = sc.touchTouches ?? 0;
    const b = m.ball;
    if (b && touches < TOUCH_CHAIN_MAX) {
      m.chain = { pos: { x: b.pos.x, y: b.pos.y }, depth: sc.chainDepth ?? 0, ambition: Math.max(0.3, sc.passDifficulty ?? 0), touchTouches: touches + 1 };
    }
  }
  m.attempts += 1;
  if (m.chain) { after(m, quickOn ? 250 : 1600, () => loadScenario(m, true)); return; }
  handOver(m, () => startSimulation(m), 1800);
}

/** CanvasMatch.handOver: after `ms`, or once a cleared ball has left the picture. */
function handOver(m: MatchState, fn: () => void, ms: number) {
  if (m.bootWait) { const gen = m.sceneGen; m.bootWait.then = () => { if (m.sceneGen === gen) fn(); }; }
  else after(m, ms, fn);
}

/** CanvasMatch.finishTopDownDribble + finishFpDribble. */
function finishTopDownDribble(m: MatchState, out: FpRunPhase) {
  const run = m.td;
  if (!run || m.phase !== "tdDribble") return;
  const pass = run.pass;
  setPhase(m, "result");
  m.fpDribble = null;
  m.attempts += 1;
  const rng = m.rng;
  const cleared = out === "clear";
  const beaten = run.defenders.filter((d) => d.phase === "beaten").length;
  const fouledOut = out === "fouled";
  if (fouledOut) {
    if (beaten > 0) m.tally.dribbles += 1;
    m.chanceLog.push({ minute: m.minute, kind: "dribble", outcome: "dribble" });
    showAction(m, "FOUL");
    pushLine(m, "Brought down as he goes past him — free kick.");
    if (mayTake(m, "free_kick")) {
      m.setPieceNext = "free_kick";
      resolveScenario(m.st, "delivered");
      after(m, 1600, () => loadScenario(m, true));
    } else {
      m.handover = "free_kick";
      after(m, 1800, () => startSimulation(m));
    }
    return;
  }
  const passed = !!pass && pass.success;
  if (cleared || passed) {
    const t = m.tally;
    if (passed) { t.passes += 1; t.passesCompleted += 1; }
    if (beaten > 0 || cleared) t.dribbles += 1;
    m.chanceLog.push({ minute: m.minute, kind: "dribble", outcome: "dribble" });
    const reward = dribbleReward({
      cleared, menBeaten: beaten, wavesBeaten: fpWavesBeaten(run) ?? (cleared ? 1 : 0), totalWaves: run.roundSizes.length ?? 1,
      mateX: passed ? pass!.at.x : undefined, ...(run.duels ? { bonusMen: 4 } : {}),
    }, rng);
    if (passed) {
      pushLine(m, reward.tier >= 3 ? "Picks out the free man — and he's in." : reward.tier >= 2 ? "Draws them in and slips it wide." : "Lays it off early.");
      showAction(m, "PASS");
    } else {
      pushLine(m, reward.tier >= 4 ? "Clean through — you've beaten the lot of them." : "You are through — and the chance is on.");
      showAction(m, "BEAT HIM");
    }
    m.chain = { pos: reward.pos, depth: 0, ambition: reward.ambition, kind: reward.kind };
    resolveScenario(m.st, "delivered");
    after(m, 1200, () => loadScenario(m, true));
    return;
  }
  const passFailed = !!pass && !pass.success;
  pushLine(m, passFailed ? "The pass is cut out." : "Taken off you.");
  m.outcome = "tackled";
  resolveScenario(m.st, "lost");
  const t = m.tally;
  t.chances += 1;
  t.lost += 1;
  if (passFailed) t.passes += 1;
  m.chanceLog.push({ minute: m.minute, kind: "dribble", outcome: "tackled" });
  after(m, 1600, () => startSimulation(m));
}

// ───────────────────────────────────────────────────────────── the frame ──

/** One frame: the commentary clock, the timers, the physics (CanvasMatch's loop). */
export function tick(m: MatchState, dt: number) {
  dt = Math.min(Math.max(0, dt), 0.05);
  m.now += dt;
  // timers (window.setTimeout)
  for (;;) {
    let idx = -1;
    for (let i = 0; i < m.timers.length; i++) {
      const t = m.timers[i];
      if (t.at <= m.now && (idx < 0 || t.at < m.timers[idx].at)) idx = i;
    }
    if (idx < 0) break;
    const t = m.timers.splice(idx, 1)[0];
    if (t.gen === null || t.gen === m.sceneGen) t.fn();
  }
  if (m.phase === "feed") stepFeed(m, dt);
  else if (m.phase !== "postmatch") stepPlay(m, dt);
}

/** The commentary's two effects: read a line, walk the clock, then go on. */
function stepFeed(m: MatchState, dt: number) {
  if (m.pause) return;
  const speed = Math.max(1, m.speed);
  if (m.feedWait !== null) {
    m.feedWait -= dt * 1000;
    if (m.feedWait > 0) return;
    m.feedWait = null;
    feedStep(m);
    return;
  }
  // schedule the next step
  if (m.queue.length > 0) {
    const next = m.queue[0];
    m.feedWait = next.minute !== undefined && next.minute > m.minute ? Math.round(MINUTE_TICK_MS / speed) : dwellFor(next.tone, speed);
  } else if (m.simContinue) {
    m.feedWait = m.st.minute > m.minute ? Math.round(MINUTE_TICK_MS / speed) : Math.round(700 / speed);
  }
}

function feedStep(m: MatchState) {
  if (m.queue.length > 0) {
    const next = m.queue[0];
    const cur = m.minute;
    if (next.minute !== undefined && next.minute > cur) {
      const target = cur + 1;
      if (!m.halfTimeShown && target > HALF_TIME_MINUTE && cur >= HALF_TIME_MINUTE) { m.halfTimeShown = true; showHalfTime(m); return; }
      setClock(m, target);
      return;
    }
    m.log = [...m.log, next];
    m.queue = m.queue.slice(1);
    if (next.minute !== undefined) setClock(m, next.minute);
    if (!m.halfTimeShown && next.minute !== undefined && next.minute > HALF_TIME_MINUTE) { m.halfTimeShown = true; showHalfTime(m); }
    return;
  }
  const go = m.simContinue;
  if (!go) return;
  if (m.st.minute > m.minute) {
    const cur = m.minute, target = cur + 1;
    if (!m.halfTimeShown && target > HALF_TIME_MINUTE && cur >= HALF_TIME_MINUTE) { m.halfTimeShown = true; showHalfTime(m); return; }
    setClock(m, target);
    return;
  }
  m.simContinue = null;
  m.stretch = null;
  go();
}

function showHalfTime(m: MatchState) {
  m.halfTimeShown = true;
  const ds = displayScore(m);
  const home = m.fixture.home;
  m.log = [...m.log, logLine(`Half Time  ${home ? ds.user : ds.opp} - ${home ? ds.opp : ds.user}`, "period", HALF_TIME_MINUTE)];
  m.pause = { cta: "Second half →", halfTime: true, go: () => { m.pause = null; } };
}

/** The play phases of CanvasMatch's loop. */
function stepPlay(m: MatchState, dt: number) {
  const sc = m.sc;
  if (m.phase === "tdDribble" && m.td && !m.tdReady) {
    const out = stepFpRun(m.td, dt);
    if (out !== "running") finishTopDownDribble(m, out);
    return;
  }
  if (m.phase === "aim") {
    stepKeeper(sc, dt);
    brainAim(sc, dt);
  }
  if (m.phase === "aim" && m.windUp !== null) {
    stepWindUp(sc, dt);
    m.windUp -= dt;
    if (m.windUp <= 0) { m.windUp = null; setPhase(m, "contact"); }
  }
  // a header or volley: the ball screen opens by itself (airTap.ts)
  if (m.phase === "aim" && !m.playOn && !m.ball && isAirKind(sc.kind) && airTapOn() && !autoKickOf(sc) && m.windUp === null && !m.dragging) {
    if (aerialMovesOn()) {
      let ar = m.aerial;
      if (!ar || ar.sc !== sc) {
        const kind = sc.kind as "header" | "volley";
        const mate = sc.teammates[0];
        const move = forcedAerialMove(kind) ?? pickAerialMove({
          kind, ballZ: airZOf(sc),
          inDir: mate ? { x: sc.ball.x - mate.x, y: sc.ball.y - mate.y } : { x: 0, y: -1 },
          toGoal: { x: CX - sc.ball.x, y: -sc.ball.y },
          aerial: airAerialNow(m) ?? 60, flair: m.career.skills.technique ?? 50,
          seed: (m.seed ^ Math.imul(Math.round(sc.ball.x * 100), 31) ^ Math.round(sc.ball.y * 100)) >>> 0,
        });
        ar = m.aerial = { sc, move, e: 0, preS: AIR_TAP_OPEN_NO_LEAD_S - AIR_TAP_OPEN_S, opened: false };
      } else ar.e += dt;
      if (!ar.opened && ar.e >= ar.preS + AERIAL_SPECS[ar.move].riseS + CONTACT_SHOW_S) {
        ar.opened = true;
        m.airOpened = sc;
        m.aim = airTapAim(sc.kind as AirKind, sc.ball, 0);
        m.powerStrike = false;
        setPhase(m, "contact");
      }
    } else {
      const w = m.airWait;
      const t = w && w.sc === sc ? w.t + dt : 0;
      m.airWait = { sc, t };
      if (t >= AIR_TAP_OPEN_NO_LEAD_S && m.airOpened !== sc) {
        m.airOpened = sc;
        m.aim = airTapAim(sc.kind as AirKind, sc.ball, 0);
        m.powerStrike = false;
        setPhase(m, "contact");
      }
    }
  }
  if (m.phase === "aim" && m.aimCommitAt !== null) stepCommitted(m, dt);
  if (m.phase === "runup") {
    const ru = m.runup;
    stepKeeper(sc, dt);
    if (ru && !ru.arrived) {
      ru.t += dt;
      const dirNow = ru.nudge ? nudgedDir(sc.ball, ru.dir0, ru.nudgeM) : ru.dir0;
      brainRunUp(sc, dt, ru.t, goalLineX(sc.ball, dirNow));
      sc.player = runupPositionAt(ru.styled, ru.t);
      if (ru.t >= ru.runS && ru.auto) {
        ru.arrived = true;
        handleContact(m, ru.auto.contact, { dir: dirNow, power: ru.power, skills: ru.auto.skills });
      } else if (ru.t >= ru.runS) {
        ru.arrived = true;
        m.aim = { dir: dirNow, power: ru.power };
        m.contactTimerS = strikeTimerFor(sc.kind);
        setPhase(m, "contact");
      }
    }
  }
  // the cut on a cross: the engine's play area moves with the picture
  if (m.ball && m.facing !== "up") {
    const at = sc.crossSwitchY ?? 0;
    const view = sc.crossSwitchView ? crossCutCamera(sc.crossSwitchView, PITCH_HW, m.ball.pos, m.tiltDeg) : sc.crossSwitchView;
    const withinX = view ? m.ball.pos.x > view.x1 - 1 && m.ball.pos.x < view.x2 + 1 : false;
    if (view && m.ball.pos.y < at && withinX) {
      m.facing = "up";
      m.camera = { ...view };
      sc.viewport = { ...view };
      void figureShrinkFor;
    }
  }
  if (m.phase === "flight" && m.ball) stepFlight(m, dt);
  if (m.phase === "result" && m.ball) {
    const b = m.ball;
    if (b.inNet) stepBallInNet(b, dt);
    if (b.settling) settleBall(b, dt, sc);
    if (b.overBar) stepBallPastBar(b, dt);
    if (b.cleared) {
      stepBallCleared(b, dt, sc);
      const boot = m.bootWait;
      if (boot) {
        if (b.resting && boot.stopT == null) boot.stopT = m.now;
        const off = b.pos.x < m.camera.x1 - 2 || b.pos.x > m.camera.x2 + 2 || b.pos.y < m.camera.y1 - 2 || b.pos.y > m.camera.y2 + 2;
        const done = off || (boot.stopT != null && m.now - boot.stopT >= getTuning("clearance.handOverAfterStop"))
          || m.now - boot.t >= getTuning("clearance.handOverMax");
        if (done) { m.bootWait = null; boot.then?.(); }
      }
    }
  }
  if (m.phase === "result" && !sc.keeper.done) { stepKeeper(sc, dt); brainStep(sc, m.ball, dt); }
  if (m.phase === "result" && hitboxesOn()) settleJumps(sc, dt);
}

/** The flight: fixed 1/180 s steps (the new ball), everyone reacting, the run, the result. */
function stepFlight(m: MatchState, dt: number) {
  const sc = m.sc;
  const fixed = realBallOn();
  let steps = 3;
  if (fixed) {
    m.physAcc += dt;
    steps = Math.floor(m.physAcc * 180 + 1e-6);
    m.physAcc = Math.max(0, m.physAcc - steps / 180);
  }
  // your run's steering, once a frame (applyRunKeys / the stick)
  const po0 = m.playOn;
  if (po0?.stick && mechOpen(m, "steer") && m.steer) {
    sprintPlayOn(po0, m.steer.sprint && mechOpen(m, "sprint"));
    const l = Math.hypot(m.steer.x, m.steer.y);
    if (l > 1e-6) steerPlayOn(po0, (m.steer.x / Math.max(1, l)) * KEY_PUSH, (m.steer.y / Math.max(1, l)) * KEY_PUSH);
    else steerPlayOn(po0, 0, 0);
  }
  for (let i = 0; i < steps; i++) {
    const ball = m.ball!;
    const h = fixed ? 1 / 180 : dt / steps;
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, m.rng);
    stepKind(sc, ball, h, m.strikeRule);
    brainStep(sc, ball, h);
    const touchLive = m.touchModeOn && m.setup.canExtraTouch && ball.owner === "you" && ball.lastTouch !== "keeper" && acceptsCaptainOrders(sc.kind);
    const caughtUp = touchLive && stepTouchChase(sc, ball, h, touchChaseSpeed(m.career.skills.pace));
    const incoming = { vx: ball.vel.x, vy: ball.vel.y, vz: ball.vz, z: ball.z, spin: ball.spin };
    const mateProbe = probeMatePlays(sc);
    stepKnuckle(ball, h);
    const po = m.playOn;
    if (po && !touchLive) {
      const wasLive = po.layOffLive;
      if (po.stick) po.stick.kicking = false;
      const caughtIt = stepPlayOn(po, sc, ball, h, m.playOnRng, m.layOffsLeft) === "caught";
      noteRunStep(m, po);
      if (caughtIt) { m.playOnCaught = true; resolveOutcome(m, "delivered"); break; }
      if (po.layOffLive && !wasLive) {
        m.layOffsLeft -= 1;
        pushLine(m, po.stick?.choice === "through" ? "Through ball, into your run!" : po.stick ? "He plays it back to your feet…" : "He lays it back into your run…");
      }
      if (po.stick?.note) po.stick.note = null;
    }
    let res = stepBall(ball, sc, m.rng, h);
    noteMatePlays(m.matePlays, mateProbe, sc);
    const clr = getClearanceRules();
    const secondLeft = !clr.miscues || (sc.secondBalls ?? 0) < clr.secondBalls;
    if (res === "blocked" && m.deflections < 1 && secondLeft) {
      m.deflections += 1;
      if (clr.miscues) sc.secondBalls = (sc.secondBalls ?? 0) + 1;
      const r = mulberry32(((m.seed ^ Math.imul(m.rngCalls + 1, 0x27d4eb2d)) ^ 0xdef1) >>> 0);
      deflectBlock(ball, sc, incoming, r);
      steerDeflectionFromOwnGoal(ball, sc);
      res = null;
      showAction(m, "DEFLECTED");
      pushLine(m, "Blocked — and it's come off him loose!");
    }
    if (!res && caughtUp) res = "touchOn";
    if (res === "short") clearLooseWin(ball, sc);
    if (res) { resolveOutcome(m, res); break; }
  }
  const ev = m.ball?.event;
  const receiver = sc.receiver;
  if (ev === "miscue") { pushLine(m, "He's miscued it — it's loose!"); showAction(m, "MISCUED"); }
  if (ev === "clearHit") { pushLine(m, "Cleared — but it cannons off a body and it's loose!"); showAction(m, "DEFLECTED"); }
  if (ev === "post") { pushLine(m, "Off the woodwork — and it's still live!"); showAction(m, "POST"); }
  if (ev && receiver) {
    const label = receiver.who?.shortName ?? receiver.roleLabel;
    if (ev === "received") { pushLine(m, commentaryReceived(label, m.rng)); showAction(m, m.deflections > 0 ? (sc.kind === "free_kick" ? "OFF THE WALL" : "DEFLECTED") : "PASS"); }
    else if (ev === "receiverShot") pushLine(m, commentaryReceiverShot(label, m.rng));
    else if (ev === "relay") { pushLine(m, `${label} leaves it — the captain wanted it moved on.`); showAction(m, "PASS"); }
  }
  if (m.ball) m.ball.event = null;
}

function noteRunStep(m: MatchState, po: PlayOn) {
  const legs = po.stick?.legs;
  if (!legs) return;
  const spent = takeEnergySpent(legs);
  if (spent > 0 && !m.hooked) m.energy = clampEnergy(m.energy - spent);
  setLegsEnergy(legs, liveEnergyAt(m, m.minute));
}

// ──────────────────────────────────────────────────────────── for the view ──

/** The live energy, as the bar shows it. */
export function energyNow(m: MatchState): number { return liveEnergyAt(m, m.minute); }
/** The stamina bar during your run: how full, the cap your energy sets, sprinting. */
export function staminaNow(m: MatchState): { v: number; cap: number; sprint: boolean } | null {
  const legs = m.playOn?.stick?.legs;
  if (legs) return { v: legs.stamina.v, cap: legs.cap, sprint: legs.sprinting };
  if (m.phase === "aim") { const cap = barCap(energyNow(m)); return { v: Math.min(m.bar, cap), cap, sprint: false }; }
  return null;
}
/** The aim arrow while dragging: the direction and power the release would kick with. */
export function aimPreview(m: MatchState): { dir: Vec2; power: number } | null {
  if (!m.dragging || !m.drag) return null;
  const b = m.sc.ball;
  return { dir: { x: b.x - m.drag.x, y: b.y - m.drag.y }, power: powerFromDrag(m, m.drag, b) };
}
/** The strike screen: what kind of ball to draw and its countdown. */
export function contactScreen(m: MatchState): { motion: string; timerS: number | null; power: number; power2: boolean; aimFromTap: boolean; ballZ?: number } | null {
  if (m.phase !== "contact" || !m.aim) return null;
  const motion = strikeMotion(m.sc.kind, m.seed);
  return {
    motion, timerS: m.contactTimerS, power: m.aim.power, power2: m.powerStrike, aimFromTap: isAirKind(m.sc.kind) && airTapOn(),
    ballZ: motion === "float" ? (m.sc.kind === "header" ? airZOf(m.sc) : HEADER_Z) : undefined,
  };
}
/** Your side's and their kit colours. */
export function matchKits(m: MatchState): { us: { shirt: string; trim: string }; them: { shirt: string; trim: string }; keeper: { shirt: string; trim: string }; ourKeeper: { shirt: string; trim: string } } {
  return { us: m.fixture.home ? m.kits.home : m.kits.away, them: m.fixture.home ? m.kits.away : m.kits.home, keeper: m.kits.keeper, ourKeeper: m.ourKeeperKit };
}
export { POST_L, POST_R };
