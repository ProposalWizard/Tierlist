/**
 * THE WHOLE MATCH, AS THE WEBSITE PLAYS IT — the phone's driver.
 *
 * A line-by-line port of the match-flow half of the website's match screen
 * (components/star/CanvasMatch.tsx, read-only reference): the 90 minutes on
 * lib/star/hiddenMatch.ts (startSimulation), every chance from the one chance
 * maker (loadScenario), the aim / strike / flight / result of a chance
 * (onPointerUp, handleContact, the frame loop's physics, resolveOutcome) and
 * full time (finaliseMatch). It calls the SAME lib/star functions in the SAME
 * order with the SAME inputs, so the same match gives the same result.
 *
 * Nothing here draws or touches React Native: the screen (screens/Match.tsx)
 * reads this object and sends it touches. That is also what lets
 * tools/match-parity.ts run it headless, many seeds, against a straight-line
 * transcription of the website's call order.
 *
 * TIME. The website steps the match from requestAnimationFrame. At 60 frames
 * a second each frame is dt = 1/60 s and the ball moves in three 1/180 s
 * steps (canvasEngine's old ball: dt/3 x3; the new ball: fixed 1/180). The
 * driver runs exactly that: tick() is one 1/60 s frame of the website at
 * 60 fps, whatever the phone's own refresh rate (the screen calls tick() as
 * many times as real time asks). Slow motion scales the frame's dt as the
 * website does (BIG_SLOW_RATE), so the physics steps match it there too.
 * The website's setTimeout delays are counted in ticks (1000/60 ms each).
 *
 * Where a CanvasMatch line is picture-only (sound, shake, particles, sprite
 * clips, VFX) it is left out; where it decides anything it is here, with the
 * CanvasMatch function named in a comment so it can be checked.
 */
import {
  buildScenario, launch, stepBall, stepBallInNet, settleBall, stepBallPastBar, stepBallCleared,
  stepKeeper, settleJumps, stepDefenders, stepReactions, stepTouchChase, touchChaseSpeed, initDefenders, resetForTouchOn,
  chainReturnChance, CHAIN_MAX, TOUCH_CHAIN_MAX, applyFirstTouch, goalInView,
  OUTCOME_TEXT, clamp, dragForFullPower, VIEW_ASPECT,
  orderableRunners, acceptsCaptainOrders,
  curveDirFromSwipe, applyCurveSwipe,
  setOffsideRuleEnabled, setClearanceRules, getClearanceRules,
  type Scenario, type Ball, type Outcome, type KickSkills, type ScenarioKind, type Viewport, type Runner, type Vec2,
} from "@/lib/star/canvasEngine";
import {
  newMatch, advanceTo, resolveScenario, lateSubQuota, noteServedKind,
  type HiddenMatchState, type HiddenMatchInputs, type ScenarioRequest, type ScenarioResult, type HiddenMatchEvent,
} from "@/lib/star/hiddenMatch";
import { makeChance, pictureMemory } from "@/lib/star/chanceMaker";
import { separateBodies } from "@/lib/star/spacing";
import { newSelectionMemory } from "@/lib/star/scenarioSelect";
import { PRESS_REACT_S, PRESS_WIN_R, pressFromBehind, foulShareFor, pressStep, pressSpeedFor } from "@/lib/star/pressure";
import { setPieceSkills } from "@/lib/star/setPieces";
import { pickWaveSizes, newRun as newFpRun, stepRun as stepFpRun, applySteer as fpSteer, applyBurst as fpBurst, applyFeint as fpFeint, applyPass as fpPass, wavesBeaten as fpWavesBeaten, type FpRunState, type RunPhase as FpRunPhase } from "@/lib/star/firstPersonDribble";
import { dribbleReward } from "@/lib/star/dribbleReward";
import { oldBallPhysics, gameplayVersion } from "@/lib/star/gameplayVersion";
import { setHitboxes, hitboxesOn } from "@/lib/star/hitbox";
import { setBallPhysics, realBallOn } from "@/lib/star/ballPhysics";
import { getTuning } from "@/lib/star/tuningStore";
import { PITCH_W, BOX_L, BOX_R, BOX_DEPTH, POST_L, POST_R, CX } from "@/lib/star/pitch";
import { mulberry32 } from "@/lib/star/season";
import { newChancesOn } from "@/lib/star/newChances";
import { stepPlayOn, carryFrom, carryOnLeadIn, MAX_LAY_OFFS, runAfterWanted, startPlayOnRun, callForIt, callForItShown, type PlayOn, type CarryFrom } from "@/lib/star/playOn";
import { barCap } from "@/lib/star/legs";
import { afterPassStickOn } from "@/lib/star/afterPass";
import { mechanicOpen, type Mechanic } from "@/lib/star/mechanics";
import { dealDribble, dribbleLevelFor, newDribbleDeal, type DribbleDeal } from "@/lib/star/dribbleDeal";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { deflectBlock } from "@/lib/star/deflection";
import { steerDeflectionFromOwnGoal, clearLooseWin } from "@/lib/star/defenderTouch";
import { matchInputsFor, careerMatchSpec } from "@/lib/star/matchInputs";
import { commentaryBuildup, commentaryStrike, commentaryReceived, commentaryReceiverShot, commentaryResult } from "@/lib/star/matchCommentary";
import { isBigMoment, headingIn, BIG_SLOW_RATE } from "@/lib/star/bigMoment";
import { leoUpdateOn } from "@/lib/star/leoUpdate";
import { finaliseMatch, fairRating } from "@/lib/star/matchStats";
import { goalZone, passGrade, missKind } from "@/lib/star/chanceRating";
import { runStretch } from "@/lib/star/stretchRun";
import { hookCheck, subComesOnNow, SUB_OFF_ENERGY, type HookReason } from "@/lib/star/selection";
import type { ChanceEntry, ChanceOutcome } from "@/lib/star/chanceLog";
import { GOAL_LINES, ASSIST_LINES } from "@/lib/star/commentaryExtra";
import { pickSquadScorer, pickSquadAssist } from "@/lib/star/squadData";
import { castScenario, castDefence, creatorOf, type OpponentSheetPlayer } from "@/lib/star/lineup";
import { formationShapeInput, type ShapeInput } from "@/lib/star/formationShape";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { penaltyRunupOf, freeKickRunupOf, takerRunupFor, yourRunupFor, standBackFor, planRunup, runupPositionAt, RUNUP_MOTION, LEAF_RUNUP, type RunupId, type StyledRunup } from "@/lib/star/runupStyles";
import { airborneOn, airborneMotion, applyAirborne, type StrikeContact } from "@/lib/star/airborneChance";
import { isAirKind, airZOf } from "@/lib/star/airDrawings";
import { crossDrawT } from "@/lib/star/headerBeat";
import { airTapOn, airTapAim, airTapStrike, AIR_TAP_OPEN_S, AIR_TAP_OPEN_NO_LEAD_S, type AirKind } from "@/lib/star/airTap";
import { aerialMovesOn, forcedAerialMove, pickAerialMove, aerialStrikeTint, AERIAL_SPECS, CONTACT_SHOW_S, type AerialMove } from "@/lib/star/aerialMoves";
import { startingTeammateRoles, onPitchToday, fillMissingFromFullRoster, opponentStartingXI } from "@/lib/star/teamsheet";
import { creditChance, assistFor, noteMatePlays, probeMatePlays, type MatePlay } from "@/lib/star/credit";
import { attachAutoKick, autoKickOf, aimFor, planPenalty, takerSkills, takerRating, designatedTaker, yourPenaltyRating, shootoutOrder, clearForShootout, AUTO_STAND_MS, type PenaltyTaker } from "@/lib/star/penaltyTaking";
import { shortClub } from "@/lib/star/media/grammar";
import { popupMs } from "@/lib/star/mikeyPopups";
import { divisionOf } from "@/lib/star/calendar";
import type { MatchStats, GoalEvent, OppGoalEvent, SquadPlayer } from "@/lib/star/types";
import { shotsPro, knucklePowerOn, launchShot, shotSeedFor, stepKnuckle, gradeContact, stepWindUp, aimedAtGoal, powerShotStrike, POWER_SHOT_WINDUP_S, POWER_SHOT_CONTACT, type ContactRead, type ShotExtras } from "@/lib/star/shotModel";
import { shotPowerOn, contactFieldOn, feelPower, feelLift, struckAtGoal } from "@/lib/star/shotFeel";
import { energyFactorFor, energyPerMinute, clampEnergy, tiredKickSkills, fatigueCut, type EnergyMode } from "@/lib/star/energy";
import { aerialOf } from "@/lib/star/aerial";
import type { Playstyle } from "@/lib/star/types";
import { penaltyReadFor, decidePenaltyRead, applyPenaltyRead } from "@/lib/star/penaltyKeeper";
import { strikeKind, stepKind, enforceHardRules, type StrikeDecision } from "@/lib/star/kindRules";
import { switchOn } from "@/lib/star/compareSwitches";
import { strikingPower } from "@/lib/star/strikePower";
import { brainOptionsHere, hasBrain, brainSetup, keeperSaltFor, brainAim, brainRunUp, brainStrike, brainStep } from "@/lib/star/keeperBrain";
import { strikeTimerFor, hasRunup, canNudge, plantBeside, goalLineX, nudgedDir, scuffStrike, cheekyStrike, isCheekyMiss, type CheekyKind } from "@/lib/star/penaltyRunup";
import { frameForNewView, crossCutCamera, turnWideChance } from "@/lib/star/matchView";
import { hasExtraTime, type ExtraTimeCompetition } from "@/lib/star/shootout";
import { currentTie as euroCurrentTie, currentLeg as euroCurrentLeg } from "@/lib/star/euro";
import { line as logLine, linesFrom, dwellFor, HALF_TIME_MINUTE, type LogLine } from "@/lib/star/matchLog";
import { rollAddedTime, addedTimeSeed } from "@/lib/star/addedTime";
import { leadInEntities, leadInCamera, stakesOf, type LeadIn, type LeadEntity, type LeadMoment } from "@/lib/star/leadIn";
import { careerBuildUp } from "@/lib/star/leadInGen";
import { fhrOn } from "@/lib/star/fhr/toggle";
import { cameraTilt } from "@/lib/star/cameraTilt";
import { giveAndGoChance } from "@/lib/star/giveAndGo";
import { createShootout, takeNextKick, nextShootoutSide, nextTakerIndex, type PenaltyShootoutState, type ShootoutSide } from "@/lib/star/shootout";
import { DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import type { MatchSetup, FeatureSpec } from "./setup";
import { KIB_CANS } from "@/lib/star/shopData";
import { GoalRecorder } from "@/lib/star/goalClip/recorder";
import type { GoalTrack, ClipBody, FrameState as ClipFrame } from "@/lib/star/goalClip/track";
import { lateKindOf } from "@/lib/star/goalClip/commentary";
import { minuteLabel } from "@/lib/star/addedTime";
import { footSign, takerFootSign, drawnTakerAt } from "@/lib/star/kickFoot";
import { panToKeep, followStep, widenToHold, easeCam, BACK_EASE_S } from "@/lib/star/runCamera";
import { keeperKit, type MatchKits } from "@/lib/star/kits";
import { stageScene } from "@/lib/star/scenePicture";
import { ballMotionAt, sweepPeriod, liftOf, contactLimitS, lateAirContact, TOO_SLOW_MS, AIR_VERDICT_MS, GROUND_TAP_MS } from "./contactBall";

/** It IS a Basic can, so it gives what a Basic can gives (CanvasMatch KIB_HALF_TIME_RESTORE). */
const KIB_HALF_TIME_RESTORE = KIB_CANS.find((c) => c.id === "basic")?.restore ?? 65;
/** One website frame at 60 fps. */
export const FRAME_DT = 1 / 60;
/** One tick of the driver in milliseconds (the website's setTimeouts are counted in these). */
export const TICK_MS = 1000 / 60;
/** A setTimeout of `ms` at 60 frames a second: how many frames later it runs. */
export const ticksFor = (ms: number) => Math.max(1, Math.ceil((ms * 60) / 1000 - 1e-9));

// ── Numbers copied from CanvasMatch.tsx ──────────────────────────────────────
const DEFAULT_MATCH_DURATION = 90;
const BALL_GRAB_FRACTION = 0.18;
const MIN_PULL = 0.008;
const CURVE_SWIPE_MIN_PX = 16;
const CAPTAIN_DRAG_MIN = 3.0;
const RECEIVE_GLIDE_S = 0.32;
const RECEIVE_LEAD_M = 0.45;
const MINUTE_TICK_MS = 700;
const ACTION_BANNER_MS = 1000;
/** MikeyPopup.tsx MIN_SHOW_MS. */
const POPUP_MIN_SHOW_MS = 350;
const isGoalWord = (t: string) => t === "GOAL" || t === "SCORED";
/** CanvasMatch's FOLLOWER_RUN_SPEED (stepCommitted). */
const FOLLOWER_RUN_SPEED = 7.0;
function savedSpeed(): number {
  try {
    const v = Number((globalThis as { localStorage?: { getItem(k: string): string | null } }).localStorage?.getItem("star-match-speed"));
    return v === 1 || v === 2 || v === 4 || v === 8 ? v : 1;
  } catch { return 1; }
}
/** The lead-in's replay clock cap (LEAD_REPLAY_MAX_DT). */
const LEAD_REPLAY_MAX_DT = 0.25;

/** CanvasMatch's countedRng: a seeded stream that counts its own draws. */
function countedRng(seed: number, counter: { current: number }): () => number {
  const raw = mulberry32(seed);
  counter.current = 0;
  return () => { counter.current++; return raw(); };
}

/** CanvasMatch's variedLine. */
function variedLine(pool: string[], name: string, minute: number): string {
  let h = minute;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length].replace("{name}", name);
}

const SIM_COMMENTARY_USER = [
  "{club} share the ball around patiently in midfield.",
  "{club}'s defence holds firm under pressure.",
  "{club}'s counter-attack breaks down in the final third.",
  "A tidy passing move from {club} comes to nothing.",
  "The ball is recycled patiently at the back for {club}.",
  "A promising run down the wing for {club} is halted by a strong tackle.",
  "{club}'s keeper comes out to claim a hopeful cross.",
  "A long ball forward for {club} finds nobody — easily dealt with.",
  "Neat footwork from {club} in the middle of the park creates some space.",
  "A crunching challenge from {club} draws a free kick — nothing comes of it.",
  "The tempo drops as {club} look to regroup.",
];
const SIM_COMMENTARY_OPP = SIM_COMMENTARY_USER;

interface ShootoutKeeper { strength: number; id?: string; name?: string; shortName?: string; face?: string }
export interface LiveShootoutState {
  homeClub: string; awayClub: string; yourSide: ShootoutSide;
  home: PenaltyTaker[]; away: PenaltyTaker[];
  homeKeeper: ShootoutKeeper; awayKeeper: ShootoutKeeper;
  state: PenaltyShootoutState; final: boolean;
  upNext: { side: ShootoutSide; name: string } | null;
}
export type Phase = "feed" | "aim" | "runup" | "contact" | "flight" | "result" | "tdDribble" | "done";
interface SimEvent { minute: number; text: string; isGoal?: boolean; isOpponent?: boolean; tone?: LogLine["tone"] }
export interface Pause { label?: string; cta: string; halfTime?: boolean; onContinue: () => void }
export interface Tally {
  shots: number; goals: number; passes: number; passesCompleted: number; chances: number; assists: number;
  misses: number; lost: number; dribbles: number; goalsPen: number; goalsTap: number; goalsOut: number;
  passesSafe: number; passesAmb: number; missesOn: number; missesPen: number; misses1v1: number;
}
const freshTally = (): Tally => ({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0, goalsPen: 0, goalsTap: 0, goalsOut: 0, passesSafe: 0, passesAmb: 0, missesOn: 0, missesPen: 0, misses1v1: 0 });

interface Chain { pos: Vec2; depth: number; ambition: number; kind?: ScenarioKind; touchTouches?: number }
interface Stretch {
  snapshot: HiddenMatchState; seed: number; inputs: HiddenMatchInputs;
  userScore: number; oppScore: number; goalEvents: number; oppGoalEvents: number;
  hooked: HookReason | null; hookedAt: number | null; feed: string[];
  changes: { minute: number; mode: EnergyMode }[]; queued: number;
  handover?: "penalty" | "free_kick" | null; board?: boolean;
}
interface Runup { t: number; dir0: Vec2; power: number; nudgeM: number; nudge: boolean; arrived: boolean; styled: StyledRunup; runS: number; auto?: { contact: { cx: number; cy: number }; skills: KickSkills } }
interface Aerial { sc: Scenario; move: AerialMove; e: number; preS: number; opened: boolean; /** Picture only: when the tap struck it (s, driver clock), for the follow-through frames. */ struckAt?: number }
interface Lead { lead: LeadIn; t: number; ents: LeadEntity[]; ends: Vec2[]; ball: Vec2; z: number; mates0: number; defs0: number; cam: { at(t: number, chance: Viewport): Viewport }; }
interface RunOn { lead: LeadIn; t: number; ents: LeadEntity[]; ends: Vec2[] }
type Timer = { at: number; gen: number; fn: () => void };

/** What the screen shows as the big caption (CanvasMatch showAction). */
export interface Banner { text: string; at: number; /** How long it stays up (mikeyPopups.ts popupMs). */ ms: number }

export class MatchDriver {
  // ── fixed for the match (CanvasMatch props / refs) ──
  readonly setup: MatchSetup;
  readonly MATCH_DURATION: number;
  readonly ADDED: number;
  /** The pitch view's height / width on this phone (frameScenario's canvasHW). */
  hw: number;
  private strength: number;
  private team: number;
  private vision: number;
  private oppStrength: number;
  private position: string;
  private pressure: number;
  private runupStyle: { pen: ReturnType<typeof penaltyRunupOf>; fk: ReturnType<typeof freeKickRunupOf> };
  private keeperSalt = keeperSaltFor(false);
  private startingXI: ReturnType<typeof startingTeammateRoles>;
  private oppXI: ReturnType<typeof opponentStartingXI>;
  private oppXIForCast: OpponentSheetPlayer[] | null;
  private energyFactor: number;

  // ── the match ──
  st: HiddenMatchState;
  seed: number;
  rng: () => number = Math.random;
  rngCalls = { current: 0 };
  userScore = 0;
  oppScore = 0;
  goalEvents: GoalEvent[] = [];
  oppGoalEvents: OppGoalEvent[] = [];
  tally: Tally = freshTally();
  attempts = 0;
  chanceLog: ChanceEntry[] = [];
  hooked: HookReason | null = null;
  hookedAt: number | null = null;
  enteredAt: number;
  subOn = false;
  subChances = 0;
  subFitness = 100;
  matchMinute = 0;
  private matchCeiling: number;
  private extraTimeStage: 0 | 1 | 2 = 0;
  private wentToExtraTime = false;
  private shootoutResult: { home: number; away: number } | null = null;
  private halfTimeShown = false;
  private boardShown = false;
  private stretch: Stretch | null = null;
  private pendingRequest: ScenarioRequest | null = null;
  private chanceMemory = newSelectionMemory();
  private lastDeal: ScenarioRequest["deal"] = undefined;
  private dribbleDeal: { deal: DribbleDeal; rng: () => number } | null = null;
  private handover: "penalty" | "free_kick" | null = null;
  private setPieceNext: ScenarioKind | null = null;
  private chain: Chain | null = null;
  private carryOn: CarryFrom | null = null;
  private cheekyMisses: { kind: CheekyKind; minute: number }[] = [];
  private playstyleChanges: { minute: number; playstyle: Playstyle }[] = [];
  energy: number;
  private energyClock = 0;
  energyMode: EnergyMode = "medium";
  playstyle: Playstyle;
  /** The match is over and finaliseMatch's stats are here. */
  finalStats: MatchStats | null = null;

  // ── the commentary (CanvasMatch's queue / log / feed) ──
  queue: LogLine[] = [];
  log: LogLine[] = [];
  feed: string[] = [];
  pause: Pause | null = null;
  /** The commentary's speed: the one you left it on last match (CanvasMatch reads "star-match-speed" as it mounts). */
  speed = savedSpeed();
  private simContinue: (() => void) | null = null;
  private feedWaitMs = 0;
  private feedWaitKey = "";

  // ── a chance ──
  phase: Phase = "feed";
  sc: Scenario;
  ball: Ball | null = null;
  outcome: Outcome | null = null;
  viewport: Viewport = { x1: 0, x2: PITCH_W, y1: -4, y2: 40 };
  facing: "up" | "left" | "right" = "up";
  tiltDeg = 0;
  aim: { dir: Vec2; power: number } | null = null;
  /** The aim drag in progress, in pitch metres (CanvasMatch dragRef). */
  drag: Vec2 | null = null;
  private thumbOrigin: Vec2 | null = null;
  private dragging = false;
  contactTimerS: number | null = null;
  private aimCommitAt: number | null = null;
  private presser: Scenario["defenders"][number] | null = null;
  private presserBehind = false;
  runup: Runup | null = null;
  private aerial: Aerial | null = null;
  /**
   * GOAL VIDEOS (CanvasMatch onGoalClip): set by the career match screen. Every
   * goal is recorded frame by frame as it is played (lib/star/goalClip/recorder.ts)
   * and handed out once cut. Never reads the engine's random numbers or changes
   * anything: the match plays the same with it or without it.
   */
  clipSink: { kits: MatchKits; onClip: (t: GoalTrack) => void } | null = null;
  private goalRec: GoalRecorder | null = null;
  private recScene: Scenario | null = null;
  private recSeen: { ball: Ball | null; seq: number } = { ball: null, seq: 0 };
  private airTapWait: { sc: Scenario; t: number } | null = null;
  private airTapOpened: Scenario | null = null;
  private airTapLead: Scenario | null = null;
  lead: Lead | null = null;
  private runOn: RunOn | null = null;
  private leadJoiners = new Set<Scenario["defenders"][number]>();
  private strikeRule: StrikeDecision | null = null;
  private deflections = 0;
  private matePlays: MatePlay[] = [];
  private strikeAt: Vec2 | null = null;
  private cheekyStrikeKind: CheekyKind | null = null;
  playOn: PlayOn | null = null;
  private playOnRng: () => number = Math.random;
  private playOnCaught = false;
  private layOffsLeft = MAX_LAY_OFFS;
  private bar = 1;
  private boot: { t: number; stopT: number | null; then: (() => void) | null } | null = null;
  private receiveGlide: { from: Vec2; to: Vec2; z0: number; t0: number } | null = null;
  private keepRunCam = false;
  /** The widen when the ball comes back into your run (CanvasMatch camEaseRef). */
  private camEase: { from: Viewport; to: Viewport; t: number } | null = null;
  private big = false;
  // ── The chance's own buttons (CanvasMatch state): Touch Mode, the ⚡ power shot, the captain's call ──
  /** Touch Mode (Boot.extraTouch / the KIB can): the corner toggle. Off at kick-off, as on the website. */
  touchModeOn = false;
  /** ⚡ Power shot armed for the next shot at goal (CanvasMatch powerArmed). */
  powerArmed = false;
  /** Seconds left of the power shot's wind-up, or null (CanvasMatch windUpRef). */
  private windUp: number | null = null;
  /** The strike screen is the power shot's green circle (CanvasMatch powerStrike). */
  powerStrike = false;
  /** What "Call for it" answered, for 1.5 s (CanvasMatch callMsg). */
  private callMsgNow: { text: string; untilTick: number } | null = null;
  get canExtraTouch(): boolean { return this.setup.canExtraTouch; }
  /** CanvasMatch: the TOUCH toggle is on screen whenever your boots or can give the extra touch and a chance is on. */
  get touchButtonShown(): boolean {
    return this.canExtraTouch && !this.feature && (this.phase === "aim" || this.phase === "runup" || this.phase === "contact" || this.phase === "flight" || this.phase === "result");
  }
  toggleTouchMode() { this.touchModeOn = !this.touchModeOn; this.bump(); }
  get windingUp(): boolean { return this.windUp !== null; }
  /** CanvasMatch: the ⚡ Power shot button (Settings → Gameplay "Knuckleball & power shot", off by default). */
  get powerShotShown(): boolean {
    return knucklePowerOn() && this.mechOpen("powerShot") && this.phase === "aim" && !this.lead && this.windUp === null
      && !["penalty", "free_kick", "corner", "byline_cross"].includes(this.sc.kind);
  }
  togglePowerShot() { this.powerArmed = !this.powerArmed; this.bump(); }
  /** CanvasMatch callForItShown: the captain, while his pass plays on. */
  get callForItShown(): boolean {
    return this.phase === "flight" && callForItShown({ captain: this.isCaptain, stickLive: !!this.playOn, layOffLive: false });
  }
  get callMsg(): string | null { const m = this.callMsgNow; return m && this.tickNo < m.untilTick && this.phase === "flight" ? m.text : null; }
  /** Captain's "Call for it" (CanvasMatch onCallForIt → playOn.ts callForIt). */
  callForIt() {
    const po = this.playOn;
    if (!po?.stick || this.phase !== "flight") return;
    const r = callForIt(po, this.sc);
    const text = r === "late" ? "Too late, he's shooting" : r === "coming" ? "It's coming!" : "Calling for it!";
    this.callMsgNow = { text, untilTick: this.tickNo + ticksFor(1500) };
    if (r === "calling") this.pushLine(`${this.playerLabel()} calls for it…`);
    this.later(1500, () => this.bump());
    this.bump();
  }
  /** The power shot's green circle was hit (or missed): quality 0..1 (CanvasMatch PowerShotContact onStrike). */
  powerStrikeDone(quality: number) {
    if (this.phase !== "contact" || !this.powerStrike) return;
    // Its own seeded draw, so the match's random stream is untouched.
    const r = mulberry32(shotSeedFor(this.seed ^ 0x9073, this.rngCalls.current));
    this.powerStrike = false;
    this.handleContact(POWER_SHOT_CONTACT, undefined, { ...powerShotStrike(quality, r), noKnuckle: true });
  }
  td: FpRunState | null = null;
  tdReady = false;
  private tdNotes = 0;
  /** The run's latest duel note (CanvasMatch tdNote): its words and whether it is good or bad news. */
  get tdNote() { const e = this.td?.events; return e && e.length ? e[e.length - 1] : null; }
  /** A chance in added time, not extra time (CanvasMatch's ⏱ chip). */
  get inAddedTime(): boolean { return this.ADDED > 0 && this.matchMinute > this.MATCH_DURATION && this.extraTimeStage === 0; }
  /** May the step-over be used (the dribble's how-to words change with it)? */
  get skillMovesOpen(): boolean { return this.mechOpen("skillMoves"); }
  private fpDribble: { waveSizes: number[]; seed: number; duels?: boolean } | null = null;
  /** A live shootout kick in progress (CanvasMatch shootoutKickRef). */
  private shootoutKick: { resolve: (scored: boolean) => void } | null = null;
  /** The live shootout on screen (CanvasMatch liveShootout + LiveShootout's state). */
  shootout: LiveShootoutState | null = null;
  banner: Banner | null = null;
  /** Bumped whenever something the React side shows (not the pitch) changes. */
  uiVersion = 0;
  /** Set: a feature on the match (EngineFeature: the trial, a drill), not a career match. */
  readonly feature: FeatureSpec | null;
  /** A feature's teaching pause is up (CanvasMatch heldRef): the run-up and the strike screen wait. */
  held = false;

  // ── the clock ──
  /** Driver time in ms (ticks x 1000/60): the website's setTimeouts and performance.now(). */
  now = 0;
  private timers: Timer[] = [];
  /** Frames since kick-off. */
  tickNo = 0;
  private gen = 0;

  constructor(setup: MatchSetup, opts: { hw: number }) {
    this.setup = setup;
    this.hw = opts.hw;
    const { career, fixture } = setup;
    this.feature = setup.feature ?? null;
    if (this.feature) {
      // EngineFeature's CanvasMatch: career = null, no fixture, its own keeper salt.
      const f = this.feature;
      this.MATCH_DURATION = DEFAULT_MATCH_DURATION;
      setOffsideRuleEnabled(true);
      this.ADDED = 0;
      this.matchCeiling = this.MATCH_DURATION;
      this.seed = setup.seed;
      this.st = newMatch(mulberry32(setup.seed));
      this.startingXI = [] as unknown as ReturnType<typeof startingTeammateRoles>;
      this.oppXI = null as unknown as ReturnType<typeof opponentStartingXI>;
      this.oppXIForCast = null;
      this.strength = f.keeperStrength();
      this.team = setup.teamRelationship;
      this.vision = 55;
      this.oppStrength = setup.oppStrength ?? 65;
      this.position = setup.position;
      this.pressure = setup.pressure;
      this.runupStyle = { pen: penaltyRunupOf(setup.penaltyRunup), fk: freeKickRunupOf(setup.freeKickRunup) };
      this.energyFactor = 1;
      this.energy = 100;
      this.playstyle = "balanced";
      this.enteredAt = 0;
      this.keeperSalt = keeperSaltFor(true);
      this.sc = buildScenario("one_on_one", mulberry32(1), 60, 60, 60);
      return;
    }
    this.MATCH_DURATION = ruleBookFor(career, "FA").matchLengthMinutes ?? DEFAULT_MATCH_DURATION;
    setOffsideRuleEnabled(!ruleBookFor(career, "FA").offsideAbolished);
    this.ADDED = rollAddedTime(mulberry32(addedTimeSeed(setup.seed)));
    this.matchCeiling = this.MATCH_DURATION + this.ADDED;
    this.seed = setup.seed;
    this.st = newMatch(mulberry32(setup.seed));
    this.startingXI = startingTeammateRoles(career, fixture);
    this.oppXI = opponentStartingXI(career, fixture);
    this.oppXIForCast = this.oppXI
      ? this.oppXI.map((p) => ({
          id: p.id, name: p.name, shortName: p.short, position: p.role, overall: p.overall,
          face: p.face ?? fakeFaceFor(p.id), isGK: p.role === "GK", y: p.y, defending: p.defending,
        }))
      : null;
    const realKeeperOverall = this.oppXIForCast?.find((p) => p.isGK)?.overall;
    this.strength = realKeeperOverall !== undefined ? Math.max(20, Math.min(99, realKeeperOverall)) : setup.keeperStrength;
    this.team = setup.teamRelationship;
    this.vision = career.skills.vision ?? 55;
    this.oppStrength = setup.oppStrength ?? 65;
    this.position = setup.position;
    this.pressure = setup.pressure;
    this.runupStyle = { pen: penaltyRunupOf(setup.penaltyRunup), fk: freeKickRunupOf(setup.freeKickRunup) };
    this.energyFactor = energyFactorFor(career, fixture);
    this.energy = career.energy ?? 100;
    this.playstyle = career.playstyle ?? "balanced";
    this.enteredAt = setup.startMinute;
    this.sc = buildScenario("one_on_one", mulberry32(1), 60, 60, 60);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SMALL HELPERS (CanvasMatch's own, same names)
  // ════════════════════════════════════════════════════════════════════════

  private bump() { this.uiVersion++; }
  /** A website setTimeout(fn, ms): fires on the tick `ticksFor(ms)` after this one. */
  private later(ms: number, fn: () => void) { this.timers.push({ at: this.tickNo + ticksFor(ms), gen: this.gen, fn }); }
  private mechOpen(id: Mechanic) { return mechanicOpen(this.setup.career, id); }
  private onPitch(squad: SquadPlayer[]): SquadPlayer[] {
    if (this.feature) return [];
    return onPitchToday(fillMissingFromFullRoster(squad, this.startingXI, this.setup.career ?? null), this.startingXI);
  }
  private mayTake(kind: ScenarioKind): boolean {
    const d = this.setup.duties;
    if (!d) return true;
    if (kind === "free_kick") return d.freeKicks;
    if (kind === "penalty") return d.penalties;
    if (kind === "corner") return d.corners ?? true;
    return true;
  }
  private matchResultFor(res: Outcome): ScenarioResult {
    if (OUTCOME_TEXT[res].kind === "goal") return "goal";
    if (res === "delivered" || res === "touchOn") return "delivered";
    if (res === "tackled" || res === "blocked") return "lost";
    return "saved";
  }
  pushLine(text: string) { this.feed = [...this.feed, text].slice(-4); this.bump(); }
  private logMoment(text: string, tone: LogLine["tone"], minute?: number) {
    const shown = tone === "assist" ? undefined : (minute ?? this.matchMinute);
    this.log = [...this.log, logLine(text, tone, shown)];
    this.bump();
  }
  /**
   * A pop-up (CanvasMatch showAction → MikeyPopup.tsx useMikeyPopup().show):
   * up for popupMs (1 s; GOAL 1.5 s; PASS 0.8 s). A goal shows at once and is
   * never knocked off by a lesser word; any other word waits until the last
   * one has been up MIN_SHOW_MS (0.35 s), the newest waiting word winning.
   * Picture only: nothing in the match reads it.
   */
  showAction(text: string) {
    const c = this.banner, goal = isGoalWord(text);
    const age = c ? this.now - c.at : Infinity;
    if (c && isGoalWord(c.text) && !goal && age < c.ms - 150) return;
    if (c && !goal && age < POPUP_MIN_SHOW_MS) { this.bannerPending = text; return; }
    this.bannerPending = null;
    this.banner = { text, at: this.now, ms: popupMs(text) };
    this.bump();
  }
  private bannerPending: string | null = null;
  /** The pop-up showing now (null when none): promotes a waiting word once the last has been read. */
  bannerNow(): Banner | null {
    const c = this.banner;
    if (c && this.bannerPending !== null && this.now - c.at >= POPUP_MIN_SHOW_MS) {
      const text = this.bannerPending;
      this.bannerPending = null;
      this.banner = { text, at: c.at + POPUP_MIN_SHOW_MS, ms: popupMs(text) };
      this.bump();
    }
    const b = this.banner;
    return b && this.now - b.at < b.ms ? b : null;
  }
  private playerLabel() { return this.setup.career?.player.lastName || "you"; }
  private momentLine() {
    const you = this.playerLabel();
    const pool = [
      `The move works its way to ${you}.`, `It breaks for ${you}.`, `The ball is worked through to ${you}.`,
      `It's picked out for ${you}.`, `The move reaches ${you}.`, `It comes to ${you}.`,
      `A gap opens up for ${you}.`, `The ball finds its way to ${you}.`,
    ];
    return pool[Math.floor(this.rng() * pool.length)];
  }
  private attributeClub(text: string, isOpponent?: boolean) {
    if (!text.includes("{club}")) return text;
    const club = isOpponent ? shortClub(this.setup.fixture.opponent) : shortClub(this.setup.career.player.club);
    return text.split("{club}").join(club);
  }
  private targetName(sc: Scenario): string | undefined {
    if (sc.kind === "volley" || sc.kind === "header") return sc.crosser?.shortName;
    return sc.runner?.who?.shortName ?? sc.secondaryRunners.find((r) => r.role === "target")?.who?.shortName;
  }
  private logChance(kind: string, outcome: ChanceOutcome) { this.chanceLog.push({ minute: this.matchMinute, kind, outcome }); }
  private passBanner() { return this.deflections > 0 ? (this.sc.kind === "free_kick" ? "OFF THE WALL" : "DEFLECTED") : "PASS"; }
  liveEnergyAt(minute: number) {
    // A player who has been taken off stops spending energy — and in the farewell match nobody spends any.
    if (this.hooked || this.setup.farewell) return this.energy;
    const extra = Math.max(0, minute - this.energyClock) * energyPerMinute(this.energyMode, this.energyFactor);
    return clampEnergy(this.energy - extra);
  }
  private chargeEnergyTo(minute: number) {
    if (minute > this.energyClock) { this.energy = this.liveEnergyAt(minute); this.energyClock = minute; }
  }
  private setClock(minute: number) { this.chargeEnergyTo(minute); this.matchMinute = minute; this.bump(); }
  private tiredSkills(): KickSkills {
    const t = tiredKickSkills(this.setup.skills, this.liveEnergyAt(this.matchMinute));
    return { power: t.power, technique: t.technique };
  }
  ratingSoFar(): number {
    const t = this.tally;
    return fairRating({ ...t, passes: t.passesCompleted }, this.userScore, this.oppScore).rating;
  }
  private matchExtras() {
    const t = this.tally;
    return {
      tally: { misses: t.misses, lost: t.lost, dribbles: t.dribbles, goalsPen: t.goalsPen, goalsTap: t.goalsTap, goalsOut: t.goalsOut,
        passesSafe: t.passesSafe, passesAmb: t.passesAmb, missesOn: t.missesOn, missesPen: t.missesPen, misses1v1: t.misses1v1 },
      extra: { ...(this.subOn ? { cameo: true, enteredAt: this.enteredAt } : {}), chanceLog: this.chanceLog.slice() },
    };
  }
  private cheekyStats() { return this.cheekyMisses.length ? { cheekyMisses: [...this.cheekyMisses] } : {}; }

  /** CanvasMatch hiddenInputs. */
  hiddenInputs(): HiddenMatchInputs {
    const car = this.setup.career;
    const live = {
      oppStrength: this.oppStrength,
      position: this.position,
      kick: this.setup.skills,
      energy: this.liveEnergyAt(this.matchMinute),
      energyMode: this.energyMode,
      impactSub: this.setup.startMinute > 0,
      farewell: !!this.setup.farewell,
      lateSub: this.subOn
        ? { enteredAt: this.enteredAt, owed: Math.max(0, lateSubQuota(this.enteredAt) - this.subChances), fitness: this.subFitness }
        : undefined,
      addedTime: this.ADDED,
      fullTime: this.MATCH_DURATION,
    };
    return matchInputsFor(careerMatchSpec(car, this.setup.fixture, { ...live, teamFallback: this.team, playstyle: this.playstyle }));
  }

  private formationShapeFor(): ShapeInput | null {
    const car = this.setup.career;
    const myStrength = car.league.find((t) => t.name === car.player.club)?.strength ?? 65;
    return formationShapeInput(this.setup.fixture.opponent, myStrength, this.oppStrength);
  }

  /** CanvasMatch nameTeamGoals. */
  private nameTeamGoals(raw: HiddenMatchEvent[], squad: SquadPlayer[], rng: () => number, announce: boolean): SimEvent[] {
    const attackers = squad.filter((p) => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
    return raw.flatMap((e): SimEvent[] => {
      if (!e.isGoal) return [{ minute: e.minute, text: this.attributeClub(e.text, e.isOpponent), isOpponent: e.isOpponent }];
      if (!e.teammateGoal) {
        if (this.oppXI === null) return [{ minute: e.minute, text: `⚽ ${this.setup.fixture.opponent} score!`, isGoal: true, isOpponent: true }];
        const oppCandidates = this.oppXI.map((p) => ({ id: p.id, name: p.name, shortName: p.short, position: p.role }));
        const oppScorer = pickSquadScorer(oppCandidates, rng) ?? { id: "unnamed", name: "Team-mate", shortName: "Team-mate" };
        const oppAssister = oppScorer.id !== "unnamed" ? pickSquadAssist(oppCandidates, oppScorer.id, rng) : null;
        this.oppGoalEvents.push({ minute: e.minute, scorerId: oppScorer.id, scorer: oppScorer.name, assistId: oppAssister?.id, assist: oppAssister?.name });
        const oppGoalLine = variedLine(GOAL_LINES, oppScorer.shortName, e.minute);
        if (announce) this.pushLine(`${e.minute}' ${oppGoalLine}${oppAssister ? ` (${oppAssister.shortName})` : ""}`);
        return oppAssister
          ? [{ minute: e.minute, text: oppGoalLine, isGoal: true, isOpponent: true },
             { minute: e.minute, text: variedLine(ASSIST_LINES, oppAssister.shortName, e.minute), tone: "assist", isOpponent: true }]
          : [{ minute: e.minute, text: oppGoalLine, isGoal: true, isOpponent: true }];
      }
      const scorer = pickSquadScorer(attackers.length > 0 ? attackers : squad, rng) ?? ({ id: "unnamed", name: "Team-mate", shortName: "Team-mate" } as SquadPlayer);
      const assister = scorer.id !== "unnamed" ? pickSquadAssist(squad, scorer.id, rng) : null;
      this.goalEvents.push({ minute: e.minute, scorer: scorer.name, assist: assister?.name, isUserGoal: false });
      const goalLine = variedLine(GOAL_LINES, scorer.shortName, e.minute);
      if (announce) this.pushLine(`${e.minute}' ${goalLine}${assister ? ` (${assister.shortName})` : ""}`);
      return assister
        ? [{ minute: e.minute, text: goalLine, isGoal: true },
           { minute: e.minute, text: variedLine(ASSIST_LINES, assister.shortName, e.minute), tone: "assist" }]
        : [{ minute: e.minute, text: goalLine, isGoal: true }];
    });
  }

  /** A tie that must be won tonight (the game music's knockout; reads only). */
  get knockoutTie(): boolean { return !!this.extraTimeEligibility(); }
  /** CanvasMatch extraTimeEligibility. */
  private extraTimeEligibility(): { extraTime: boolean; isLevelNow: () => boolean } | null {
    const fixture = this.setup.fixture, career = this.setup.career;
    if (!fixture?.competition) return null;
    const comp = fixture.competition;
    if (comp === "Community Shield" || comp === "Super Cup") return { extraTime: false, isLevelNow: () => this.userScore === this.oppScore };
    if (fixture.kind === "cup") {
      if (fixture.leg === 1) return null;
      let firstUs = 0, firstThem = 0;
      if (fixture.leg === 2) {
        const you = career.player.club;
        const st = career.cupState?.find((c) => c.competition === comp && !c.winner);
        const tie = st?.rounds[st.rounds.length - 1]?.ties.find((t) => t.home === you || t.away === you);
        const l1 = tie?.legs?.[0];
        if (tie && l1) { firstUs = tie.home === you ? l1.hs : l1.as; firstThem = tie.home === you ? l1.as : l1.hs; }
      }
      return { extraTime: hasExtraTime(comp as ExtraTimeCompetition, fixture.round ?? "Final"), isLevelNow: () => (firstUs + this.userScore) === (firstThem + this.oppScore) };
    }
    if (fixture.kind === "europe") {
      const state = career.euroState;
      if (!state || comp !== state.competition) return null;
      const tie = euroCurrentTie(state);
      if (!tie) return null;
      const legIdx = euroCurrentLeg(state) ?? 0;
      if (tie.legs.length > 1 && legIdx === 0) return null;
      const firstLeg = tie.legs[0];
      const firstUs = firstLeg?.us ?? 0, firstThem = firstLeg?.them ?? 0;
      return { extraTime: true, isLevelNow: () => (firstUs + this.userScore) === (firstThem + this.oppScore) };
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  KICK-OFF (CanvasMatch's mount effect, the match-mode branch)
  // ════════════════════════════════════════════════════════════════════════

  start() {
    this.applyClearanceRules();
    if (this.feature) { this.startFeature(); return; }
    if (this.setup.startMinute > 0) {
      // Coming off the bench: the match is played without you up to the minute you come on.
      this.seed += 1;
      const rng = countedRng(this.seed, this.rngCalls);
      this.rng = rng;
      const st = this.st;
      const car = this.setup.career;
      const jitter = ((car.week ?? 0) * 37 + (car.season ?? 0) * 11) % 5;
      const rung = this.setup.startMinute;
      const before = advanceTo(st, this.hiddenInputs(), rng, 50);
      while (st.minute < 88 && !subComesOnNow(st.minute, st.userScore - st.oppScore, jitter, rung)) {
        before.push(...advanceTo(st, this.hiddenInputs(), rng, st.minute + 1));
      }
      this.enteredAt = st.minute;
      this.subOn = true;
      this.subChances = 0;
      this.userScore = st.userScore;
      this.oppScore = st.oppScore;
      this.energyClock = st.minute;
      this.subFitness = this.liveEnergyAt(st.minute);
      this.matchMinute = st.minute;
      this.halfTimeShown = st.minute > HALF_TIME_MINUTE;
      const named = this.nameTeamGoals(before, this.onPitch(car.squad ?? []), rng, false);
      const early = named.slice(0, Math.max(0, named.length - 14)).filter((e) => e.isGoal);
      this.log = [logLine("Kick Off", "period", 0), ...linesFrom([...early, ...named.slice(-14)]), logLine("You are coming on.", "you", st.minute)];
      this.phase = "feed";
      this.pause = { label: "You are going on", cta: "Get out there →", onContinue: () => { this.pause = null; this.startSimulation(); } };
      this.bump();
      return;
    }
    this.enteredAt = 0;
    this.log = [logLine("Kick Off", "period", 0)];
    this.startSimulation();
  }

  /** CanvasMatch applyClearanceRules (read again at every chance). */
  private applyClearanceRules() {
    setClearanceRules({
      speedMin: getTuning("clearance.speedMin"), speedMax: getTuning("clearance.speedMax"),
      maxAngleDeg: getTuning("clearance.maxAngle"), miscues: true,
      miscueWeak: getTuning("clearance.miscueWeak"), miscueStrong: getTuning("clearance.miscueStrong"),
      bodyLen: getTuning("clearance.bodyLen"), bodyWidth: getTuning("clearance.bodyWidth"),
      secondBalls: Math.round(getTuning("clearance.secondBalls")),
    });
    setBallPhysics(oldBallPhysics() ? "old" : "new");
    setHitboxes(gameplayVersion("hitboxes"));
  }

  // ════════════════════════════════════════════════════════════════════════
  //  THE MATCH RUNS ON UNTIL IT NEEDS YOU (CanvasMatch startSimulation)
  // ════════════════════════════════════════════════════════════════════════

  startSimulation(resim = false) {
    this.gen += 1;
    const prior = resim ? this.stretch : null;
    if (prior) {
      this.st = { ...prior.snapshot };
      this.userScore = prior.userScore;
      this.oppScore = prior.oppScore;
      this.goalEvents.length = prior.goalEvents;
      this.oppGoalEvents.length = prior.oppGoalEvents;
      this.hooked = prior.hooked;
      this.hookedAt = prior.hookedAt;
      this.feed = prior.feed;
    } else {
      this.seed += 1;
    }
    const stretchSeed = prior ? prior.seed : this.seed;
    const rng = countedRng(stretchSeed, this.rngCalls);
    this.rng = rng;
    const st = this.st;
    st.userScore = this.userScore;
    st.oppScore = this.oppScore;

    if (!prior) this.playstyleChanges = [];
    const baseInputs: HiddenMatchInputs = prior
      ? { ...prior.inputs, energyModeChanges: prior.changes, context: { ...prior.inputs.context, playstyleChanges: this.playstyleChanges } }
      : this.hiddenInputs();
    if (!prior) {
      this.stretch = {
        snapshot: { ...st }, seed: stretchSeed, inputs: baseInputs,
        userScore: this.userScore, oppScore: this.oppScore,
        goalEvents: this.goalEvents.length, oppGoalEvents: this.oppGoalEvents.length,
        hooked: this.hooked, hookedAt: this.hookedAt, feed: this.feed, changes: [], queued: 0,
      };
    }

    let offAt = Infinity;
    // The farewell: off at the ovation minute, whatever happens before it.
    const fw = this.setup.farewell;
    if (fw && !this.hooked) offAt = Math.max(st.minute, fw.offAt);
    else if (this.subOn && !this.hooked) {
      const perMin = energyPerMinute(this.energyMode, this.energyFactor);
      const e = this.liveEnergyAt(st.minute);
      if (perMin > 0) offAt = e <= SUB_OFF_ENERGY ? st.minute : st.minute + Math.ceil((e - SUB_OFF_ENERGY) / perMin);
    }
    let plannedOff = false;
    const po = this.setup.plannedOffAt;
    if (!fw && po && !this.hooked && po < offAt) { offAt = Math.max(st.minute, po); plannedOff = true; }
    const stretchEnd = Math.min(this.matchCeiling, offAt);
    const handedOver: HiddenMatchEvent[] = [];
    const handover = prior ? prior.handover ?? null : this.handover;
    this.handover = null;
    if (!prior && this.stretch) this.stretch.handover = handover;
    if (handover) {
      const label = handover === "penalty" ? "penalty" : "free kick";
      const scored = rng() < (handover === "penalty" ? 0.76 : 0.09);
      handedOver.push(scored
        ? { minute: st.minute, text: `⚽ Your side score the ${label}!`, isGoal: true, teammateGoal: true }
        : { minute: st.minute, text: `A ${label} — someone else steps up, and it comes to nothing.`, isOpponent: false });
      resolveScenario(st, scored ? "goal" : "saved");
    }
    let step = this.hooked
      ? { events: [...handedOver, ...advanceTo(st, baseInputs, rng, this.matchCeiling)], request: null as ScenarioRequest | null, fullTime: true }
      : runStretch(st, baseInputs, rng, stretchEnd, (k) => this.mayTake(k), handedOver);
    const legsGone = !step.request && offAt < this.matchCeiling && st.minute >= offAt;
    if (legsGone) step = { ...step, fullTime: false };

    const squad = this.onPitch(this.setup.career.squad ?? []);
    const events: SimEvent[] = this.nameTeamGoals(step.events, squad, mulberry32(stretchSeed * 31 + 7), true);
    this.userScore = st.userScore;
    this.oppScore = st.oppScore;

    if (events.length === 0) {
      const isOpponent = st.possession !== "user";
      const bank = isOpponent ? SIM_COMMENTARY_OPP : SIM_COMMENTARY_USER;
      const text = bank[Math.floor(rng() * bank.length)];
      events.push({ minute: st.minute, text: this.attributeClub(text, isOpponent), isOpponent });
    }

    if (!this.hooked && !step.fullTime) {
      const decision = fw
        // The farewell: nobody takes you off — until the ovation minute.
        ? (legsGone
          ? { hooked: true, reason: "rested" as HookReason, message: `${st.minute}' — you come off. The whole ground is on its feet for you.` }
          : { hooked: false, reason: null, message: "" })
        : legsGone && plannedOff
        ? { hooked: true, reason: "rested" as HookReason, message: `${st.minute}' — a planned change. The manager wants a look at someone else; you come off.` }
        : legsGone
        ? { hooked: true, reason: "legs" as HookReason, message: `Out on your feet at ${Math.round(this.liveEnergyAt(st.minute))}% energy — you are taken off.` }
        : hookCheck({
          minute: st.minute, startMinute: this.enteredAt, liveRating: this.ratingSoFar(),
          scoreDiff: st.userScore - st.oppScore, rng, liveEnergy: this.liveEnergyAt(st.minute), cameo: this.subOn,
        });
      if (decision.hooked) {
        this.chargeEnergyTo(st.minute);
        this.hooked = decision.reason;
        this.hookedAt = st.minute;
        events.push({ minute: st.minute, text: decision.message });
        const after = advanceTo(st, baseInputs, rng, this.matchCeiling);
        events.push(...this.nameTeamGoals(after, this.onPitch(this.setup.career.squad ?? []), rng, false));
        this.userScore = st.userScore;
        this.oppScore = st.oppScore;
        step = { ...step, request: null, fullTime: true };
      }
    }

    this.pendingRequest = step.request;
    if (step.request && this.subOn) this.subChances += 1;

    const board = prior ? !!prior.board : this.ADDED > 0 && !this.boardShown && this.extraTimeStage === 0 && st.minute > this.MATCH_DURATION;
    if (board) {
      this.boardShown = true;
      if (this.stretch) this.stretch.board = true;
      const at = events.findIndex((e) => e.minute > this.MATCH_DURATION);
      events.splice(at < 0 ? events.length : at, 0, { minute: this.MATCH_DURATION, tone: "period", text: `+${this.ADDED} minute${this.ADDED === 1 ? "" : "s"} added` });
    }
    const shown = prior ? Math.max(0, prior.queued - this.queue.length) : 0;
    if (this.stretch) this.stretch.queued = events.length;
    this.queue = linesFrom(events.slice(shown), this.matchMinute);
    this.phase = "feed";
    this.feedWaitMs = 0; this.feedWaitKey = "";
    this.bump();

    this.simContinue = () => {
      if (step.fullTime) {
        if (this.extraTimeStage === 1) {
          this.log = [...this.log, logLine("End of the first half of extra time.", "period", this.matchCeiling)];
          this.pause = {
            cta: "Second half (extra time) →",
            onContinue: () => {
              this.pause = null;
              this.extraTimeStage = 2;
              this.matchCeiling = this.MATCH_DURATION + this.ADDED + 30;
              this.log = [...this.log, logLine("Second half of extra time.", "period", this.matchCeiling)];
              this.startSimulation();
            },
          };
          this.bump();
          return;
        }
        if (this.extraTimeStage === 2) {
          const el = this.extraTimeEligibility();
          if (el && el.isLevelNow()) this.runShootout();
          else {
            const home = this.setup.fixture.home !== false;
            this.log = [...this.log, logLine(`After Extra Time  ${home ? this.userScore : this.oppScore} - ${home ? this.oppScore : this.userScore}`, "period", this.matchCeiling)];
            this.pause = { cta: "Full time →", onContinue: () => this.finalize() };
            this.bump();
          }
          return;
        }
        {
          const l = this.log;
          const userGoals = l.filter((x) => x.tone === "goal").length;
          const oppGoals = l.filter((x) => x.tone === "oppGoal").length;
          const home = this.setup.fixture.home !== false;
          this.log = [...l, logLine(`Full Time  ${home ? userGoals : oppGoals} - ${home ? oppGoals : userGoals}`, "period", this.MATCH_DURATION + this.ADDED)];
        }
        this.setClock(this.MATCH_DURATION + this.ADDED);
        const eligibility = this.extraTimeEligibility();
        const isDecisiveDraw = !!eligibility && eligibility.isLevelNow();
        if (!isDecisiveDraw) { this.pause = { cta: "Full time →", onContinue: () => this.finalize() }; this.bump(); return; }
        if (!eligibility!.extraTime) { this.pause = { cta: "Penalties →", onContinue: () => { this.pause = null; this.runShootout(); } }; this.bump(); return; }
        this.pause = {
          cta: "Extra time →",
          onContinue: () => {
            this.pause = null;
            this.wentToExtraTime = true;
            this.extraTimeStage = 1;
            this.matchCeiling = this.MATCH_DURATION + this.ADDED + 15;
            this.log = [...this.log, logLine("Extra time — first half.", "period", this.MATCH_DURATION + this.ADDED)];
            this.startSimulation();
          },
        };
        this.bump();
      } else {
        this.loadScenario(false);
      }
    };
  }

  /** CanvasMatch's finalize (full time): finaliseMatch, the same arguments. */
  finalize() {
    this.pause = null;
    // A goal still being recorded when the match closes keeps what it has.
    if (this.goalRec && this.clipSink) { this.goalRec.finishNow(); this.handOutClips(); }
    const t = this.tally;
    const stats: MatchStats = {
      ...finaliseMatch(
        this.attempts, t.goals, t.assists, t.passesCompleted,
        Math.max(1, (this.hookedAt ?? this.matchMinute) - this.enteredAt),
        this.userScore, this.oppScore, this.setup.career,
        this.goalEvents, this.hooked, this.oppGoalEvents, this.setup.fixture, this.matchExtras().tally,
      ),
      ...this.matchExtras().extra,
      endEnergy: this.liveEnergyAt(this.hookedAt ?? this.matchMinute),
      kibCansUsed: this.kibUsed,
      playstyle: this.playstyle,
      ...(this.wentToExtraTime ? { wentToExtraTime: true } : {}),
      ...(this.shootoutResult ? { shootout: this.shootoutResult } : {}),
      ...this.cheekyStats(),
    };
    this.finalStats = stats;
    this.phase = "done";
    this.bump();
  }

  /**
   * A KNOCKOUT GOES TO PENALTIES, EVERY KICK PLAYED ON THE PITCH (CanvasMatch
   * startShootout + LiveShootout.tsx + loadShootoutKick): the real order
   * (shootoutOrder), each kick a real penalty on the engine (a team-mate's
   * and theirs struck for them by attachAutoKick), the score kept by
   * lib/star/shootout.ts's own state machine.
   */
  private runShootout() {
    const home = this.setup.fixture.home !== false;
    const yourSide: ShootoutSide = home ? "home" : "away";
    const car = this.setup.career;
    const homeClub = home ? (car?.player.club ?? "Home") : (this.setup.fixture.opponent ?? "Away");
    const awayClub = home ? (this.setup.fixture.opponent ?? "Away") : (car?.player.club ?? "Home");
    const us = this.ourTakers(), them = this.theirTakers();
    const you: PenaltyTaker | null = this.hooked ? null : {
      id: "you", name: car ? `${car.player.firstName} ${car.player.lastName}` : "You", shortName: this.playerLabel(),
      face: car?.player.portrait ?? DEFAULT_FAKE_FACE,
      rating: yourPenaltyRating({ technique: this.setup.skills.technique, freeKick: car?.skills.freeKick ?? this.setup.skills.technique }, car?.starRating ?? 0),
      you: true,
    };
    const ourOrder = shootoutOrder([...us.outfield, ...(us.keeper ? [us.keeper] : [])], you);
    const theirOrder = shootoutOrder([...them.outfield, ...(them.keeper ? [them.keeper] : [])]);
    const ourKeeper: ShootoutKeeper = {
      strength: Math.max(20, Math.min(99, us.keeper?.overall ?? this.ourClubStrength())),
      id: us.keeper?.id, name: us.keeper?.name, shortName: us.keeper?.shortName, face: us.keeper?.face,
    };
    const theirKeeper: ShootoutKeeper = {
      strength: this.strength,
      id: them.keeper?.id, name: them.keeper?.name, shortName: them.keeper?.shortName, face: them.keeper?.face,
    };
    this.shootout = {
      homeClub, awayClub, yourSide,
      home: home ? ourOrder : theirOrder, away: home ? theirOrder : ourOrder,
      homeKeeper: home ? ourKeeper : theirKeeper, awayKeeper: home ? theirKeeper : ourKeeper,
      state: createShootout(), final: false,
      upNext: null,
    };
    this.logMoment("Penalties.", "period");
    this.nextShootoutKick();
  }
  /** LiveShootout's effect: hand the next kick to the pitch, or finish. */
  private nextShootoutKick() {
    const so = this.shootout;
    if (!so) return;
    const st = so.state;
    if (st.over) {
      so.final = true;
      so.upNext = null;
      this.bump();
      this.later(2600, () => {
        this.shootoutResult = { home: st.homeScore, away: st.awayScore };
        this.shootout = null;
        this.log = [...this.log, logLine(`Penalties  ${st.homeScore} - ${st.awayScore}`, "period")];
        this.finalize();
      });
      return;
    }
    const side = nextShootoutSide(st);
    const order = side === "home" ? so.home : so.away;
    const idx = nextTakerIndex(st, side, Math.max(1, order.length));
    const taker = order[idx];
    if (!taker) return;
    so.upNext = { side, name: taker.you ? "You" : taker.shortName };
    this.loadShootoutKick({ side, taker, round: Math.floor(st.kicks.length / 2) + 1, index: st.kicks.length }, order.length);
  }
  /** CanvasMatch loadShootoutKick: one kick of the live shootout, on the pitch. */
  private loadShootoutKick(kick: { side: ShootoutSide; taker: PenaltyTaker; round: number; index: number }, rosterSize: number) {
    const info = this.shootout!;
    this.gen += 1;
    this.seed += 1;
    this.rng = countedRng(this.seed, this.rngCalls);
    const rng = this.rng;
    this.chain = null;
    this.fpDribble = null;
    this.td = null;
    const ours = kick.side === info.yourSide;
    const keeper = kick.side === "home" ? info.awayKeeper : info.homeKeeper;
    const sc = buildScenario("penalty", rng, keeper.strength, this.team, this.vision);
    enforceHardRules(sc);
    sc.conditions = this.setup.conditions;
    initDefenders(sc, rng);
    stageScene(sc, { teammates: false });
    clearForShootout(sc);
    if (keeper.name) sc.keeper.who = { id: keeper.id ?? "gk", name: keeper.name, shortName: keeper.shortName ?? keeper.name, position: "GK", face: keeper.face };
    if (!kick.taker.you) {
      const plan = planPenalty(kick.taker.rating, mulberry32((this.seed ^ 0x7a11c) >>> 0));
      attachAutoKick(sc, { side: ours ? "us" : "them", taker: kick.taker, plan, keeper, context: "shootout" });
    }
    this.standBackForRunup(sc);
    this.setUpKeeper(sc, (this.seed ^ 0x4b7e) >>> 0);
    this.sc = sc;
    this.frameScenario(sc);
    this.resetChanceState();
    const n = kick.index;
    this.shootoutKick = {
      resolve: (scored: boolean) => {
        const so = this.shootout;
        if (!so || so.state.kicks.length !== n) return;
        so.state = takeNextKick(so.state, scored, Math.max(1, rosterSize));
        this.bump();
        this.nextShootoutKick();
      },
    };
    this.phase = "aim";
    this.logMoment(kick.taker.you ? "Your penalty — up to you." : `${kick.taker.shortName} steps up…`, "you");
    this.bump();
    if (!kick.taker.you) this.scheduleAutoKick();
  }
  /** Their eleven, from the real team sheet when there is one (CanvasMatch theirTakers). */
  private theirTakers(): { outfield: PenaltyTaker[]; keeper: PenaltyTaker | null } {
    const xi = this.oppXIForCast ?? [];
    const all: PenaltyTaker[] = xi.map((p) => ({
      id: p.id, name: p.name, shortName: p.shortName, face: p.face ?? fakeFaceFor(p.id),
      rating: takerRating({ overall: p.overall }), isGK: p.isGK,
    }));
    const outfield = all.filter((t) => !t.isGK);
    for (let i = outfield.length; i < 5; i++) outfield.push({ id: `opp-${i}`, name: `Their No. ${i + 7}`, shortName: `No. ${i + 7}`, face: fakeFaceFor(`opp-${i}`), rating: 62 });
    return { outfield, keeper: all.find((t) => t.isGK) ?? null };
  }
  private ourClubStrength(): number {
    const car = this.setup.career;
    return car?.league.find((t) => t.name === car.player.club)?.strength ?? this.team;
  }

  /** Low / Medium / High (CanvasMatch setEnergyMode). */
  setEnergyMode(mode: EnergyMode) {
    if (mode === this.energyMode) return;
    this.chargeEnergyTo(this.matchMinute);
    this.energyMode = mode;
    this.bump();
    const stretch = this.stretch;
    if (stretch && this.phase === "feed" && !this.hooked) {
      stretch.changes.push({ minute: this.matchMinute + 1, mode });
      this.startSimulation(true);
    }
  }
  /** Basic KIB cans drunk at half time this match (CanvasMatch kibUsedRef). */
  kibUsed = 0;
  /** Basic cans you still have for this match. */
  kibCansLeft(): number { return Math.max(0, (this.setup.career?.kibCans?.basic ?? 0) - this.kibUsed); }
  /** Half time only: drink a Basic KIB can, +65 energy (CanvasMatch drinkHalfTimeKib). */
  drinkHalfTimeKib() {
    const owned = (this.setup.career?.kibCans?.basic ?? 0) - this.kibUsed;
    if (owned <= 0 || this.energy >= 100) return;
    this.kibUsed += 1;
    this.energy = clampEnergy(this.energy + KIB_HALF_TIME_RESTORE);
    this.bump();
  }
  /** Defensive / Balanced / Attacking (CanvasMatch setPlaystyle). */
  setPlaystyle(ps: Playstyle) {
    if (ps === this.playstyle) return;
    this.playstyle = ps;
    this.bump();
    if (this.stretch && this.phase === "feed" && !this.hooked) {
      this.playstyleChanges = [...this.playstyleChanges, { minute: this.matchMinute + 1, playstyle: ps }];
      this.startSimulation(true);
    }
  }
  setSpeed(s: number) { this.speed = s; this.bump(); }
  /** CanvasMatch cycleSpeed: 1 → 2 → 4 → 8 → 1, kept between matches ("star-match-speed", the website's own key). */
  cycleSpeed() {
    const next = this.speed === 1 ? 2 : this.speed === 2 ? 4 : this.speed === 4 ? 8 : 1;
    try { (globalThis as { localStorage?: { setItem(k: string, v: string): void } }).localStorage?.setItem("star-match-speed", String(next)); } catch { /* no storage */ }
    this.setSpeed(next);
  }
  /** True when a tap on the commentary would skip (CanvasMatch onSkip: lines waiting and no button up). */
  get canSkipFeed(): boolean { return this.phase === "feed" && this.queue.length > 0 && !this.pause; }
  /** CanvasMatch onSkip: a tap on the commentary empties the queue in one go (every line shown, the clock on its last minute). */
  skipFeed() {
    if (!this.canSkipFeed) return;
    const q = this.queue, last = q[q.length - 1];
    this.log = [...this.log, ...q];
    this.queue = [];
    this.feedWaitKey = "";
    if (last?.minute !== undefined) {
      this.setClock(last.minute);
      if (!this.halfTimeShown && last.minute > HALF_TIME_MINUTE) this.showHalfTime();
    }
    this.bump();
  }
  /** The pause's button (half time, full time, extra time…). */
  continuePause() { const p = this.pause; if (p) { p.onContinue(); this.bump(); } }

  // ════════════════════════════════════════════════════════════════════════
  //  THE COMMENTARY CLOCK (CanvasMatch's two queue effects)
  // ════════════════════════════════════════════════════════════════════════

  private showHalfTime() {
    this.halfTimeShown = true;
    const l = this.log;
    const userGoals = l.filter((x) => x.tone === "goal").length;
    const oppGoals = l.filter((x) => x.tone === "oppGoal").length;
    const home = this.setup.fixture.home !== false;
    this.log = [...l, logLine(`Half Time  ${home ? userGoals : oppGoals} - ${home ? oppGoals : userGoals}`, "period", HALF_TIME_MINUTE)];
    this.pause = { cta: "Second half →", halfTime: true, onContinue: () => { this.pause = null; } };
    this.bump();
  }

  /** One tick of the commentary: a wait (re-armed whenever what it waits for changes), then its step. */
  private feedTick() {
    if (this.pause) { this.feedWaitKey = ""; return; }
    let key: string, ms: number, act: () => void;
    if (this.queue.length > 0) {
      const next = this.queue[0];
      const cur = this.matchMinute;
      if (next.minute !== undefined && next.minute > cur) {
        key = `m${cur}`; ms = Math.round(MINUTE_TICK_MS / Math.max(1, this.speed));
        act = () => {
          const target = cur + 1;
          if (!this.halfTimeShown && target > HALF_TIME_MINUTE && cur >= HALF_TIME_MINUTE) { this.showHalfTime(); return; }
          this.setClock(target);
        };
      } else {
        key = `l${this.queue.length}:${next.text}`; ms = dwellFor(next.tone, this.speed);
        act = () => {
          this.log = [...this.log, next];
          this.queue = this.queue.slice(1);
          if (next.minute !== undefined) this.setClock(next.minute);
          if (!this.halfTimeShown && next.minute !== undefined && next.minute > HALF_TIME_MINUTE) this.showHalfTime();
          this.bump();
        };
      }
    } else {
      if (this.phase !== "feed") return;
      const go = this.simContinue;
      if (!go) return;
      if (this.st.minute > this.matchMinute) {
        const cur = this.matchMinute;
        key = `s${cur}`; ms = Math.round(MINUTE_TICK_MS / Math.max(1, this.speed));
        act = () => {
          const target = cur + 1;
          if (!this.halfTimeShown && target > HALF_TIME_MINUTE && cur >= HALF_TIME_MINUTE) { this.showHalfTime(); return; }
          this.setClock(target);
        };
      } else {
        key = "go"; ms = Math.round(700 / Math.max(1, this.speed));
        act = () => { this.simContinue = null; this.stretch = null; go(); };
      }
    }
    key += `@${this.speed}`;
    if (key !== this.feedWaitKey) { this.feedWaitKey = key; this.feedWaitMs = 0; }
    this.feedWaitMs += TICK_MS;
    if (this.feedWaitMs >= ms) { this.feedWaitKey = ""; this.feedWaitMs = 0; act(); }
  }

  /** Skip the commentary's waits (the screen's "skip to the next chance"). Same lines, same order. */
  fastForwardFeed(maxTicks = 100000) {
    for (let i = 0; i < maxTicks && this.phase === "feed" && !this.pause; i++) {
      this.feedWaitMs = 1e9;
      this.feedTick();
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  A CHANCE IS SERVED (CanvasMatch loadScenario)
  // ════════════════════════════════════════════════════════════════════════

  loadScenario(attacking: boolean) {
    this.gen += 1;
    this.runOn = null;
    this.boot = null;
    this.applyClearanceRules();
    this.seed += 1;
    this.rng = countedRng(this.seed, this.rngCalls);
    const rng = this.rng;

    // A feature's own picture (CanvasMatch loadScenario, "PLAYING ONE PARTICULAR PICTURE").
    if (this.feature) { this.chain = null; this.pendingRequest = null; this.setPieceNext = null; this.loadFeaturePicture(rng); return; }

    const rawRequest = attacking ? null : this.pendingRequest;
    this.pendingRequest = null;
    const chain = this.chain;
    this.chain = null;

    let request = rawRequest;
    if (rawRequest && !chain && newChancesOn()) {
      const d = (this.dribbleDeal ??= { deal: newDribbleDeal(), rng: mulberry32((this.setup.seed ^ 0xd21bb1e) >>> 0) });
      const car = this.setup.career;
      request = dealDribble(rawRequest, dribbleLevelFor(car ? divisionOf(car) : undefined, this.setup.fixture?.competition), d.deal, d.rng);
    }
    const setPiece = chain ? null : this.setPieceNext;
    this.setPieceNext = null;
    this.td = null;
    this.fpDribble = null;

    if (!attacking && !chain && request?.penaltyWon && !this.mayTake("penalty")) {
      if (this.loadTeammatePenalty(request, rng)) return;
    }

    if (!attacking && request?.dribble) {
      // USE_FIRST_PERSON_DRIBBLE → top-down in matches (decided 12 Oct 2026).
      this.fpDribble = { waveSizes: pickWaveSizes(rng, { minRounds: 3 }), seed: Math.floor(rng() * 1e9) };
      this.aim = null; this.runup = null; this.contactTimerS = null;
      this.airTapWait = null; this.airTapOpened = null;
      this.outcome = null; this.drag = null; this.dragging = false;
      this.facing = "up";
      this.phase = this.startTopDownDribble();
      this.logMoment(this.momentLine(), "you");
      this.pushLine(request.reason);
      this.pushLine("Beat your man to win the ball forward.");
      this.bump();
      return;
    }

    const isTouchContinuation = chain !== null && chain.touchTouches !== undefined;
    const legsWas = this.playOn?.stick?.legs;
    this.bar = isTouchContinuation && legsWas ? legsWas.stamina.v : 1;
    this.playOn = null;
    void barCap;
    if (!isTouchContinuation) { this.layOffsLeft = MAX_LAY_OFFS; }
    const carry = chain && !isTouchContinuation ? this.carryOn : null;
    this.carryOn = null;

    // A re-touch, or a lay-off taken back in your run, is the SAME move carrying on: it is
    // repositioned where the ball is, never remade (CanvasMatch loadScenario → resetForTouchOn).
    if (chain && isTouchContinuation) {
      resetForTouchOn(this.sc, chain.pos);
    } else {
      if (request) this.lastDeal = request.deal;
      const made = makeChance({
        deal: this.lastDeal,
        source: chain?.kind ? { from: "kind", kind: chain.kind }
          : chain ? { from: "chain", pos: chain.pos, ambition: chain.ambition, position: this.position }
          : setPiece ? { from: "kind", kind: setPiece }
          : attacking ? { from: "attacking" }
          : request ? { from: "request", request, position: this.position }
          : { from: "weighted", position: this.position },
        rng,
        strength: { keeper: this.strength, team: this.team, vision: this.vision },
        memory: pictureMemory("game"),
        selection: this.chanceMemory,
        formation: this.formationShapeFor(),
      });
      this.sc = made.sc;
      noteServedKind(this.st, made.sc.kind);
    }
    const sc0 = this.sc;
    if (chain) { sc0.chainDepth = chain.depth; sc0.touchTouches = chain.touchTouches; }
    sc0.conditions = this.setup.conditions;
    if (!isTouchContinuation) castScenario(sc0, this.onPitch(this.setup.career.squad ?? []));
    this.strikeRule = null;
    initDefenders(sc0, rng);
    castDefence(sc0, this.oppXIForCast);
    this.setUpKeeper(sc0, (this.seed ^ 0x4b7e) >>> 0);

    let heavyTouch = 0;
    if (chain && !isTouchContinuation) {
      const sc = sc0;
      const stance = { x: sc.player.x - sc.ball.x, y: sc.player.y - sc.ball.y };
      heavyTouch = applyFirstTouch(sc, this.tiredSkills().technique, rng);
      const vp = sc.viewport, inset = 1.4;
      sc.player = {
        x: Math.min(Math.max(sc.ball.x + stance.x, vp.x1 + inset), vp.x2 - inset),
        y: Math.min(Math.max(sc.ball.y + stance.y, Math.max(vp.y1 + inset, 0.3)), vp.y2 - inset),
      };
      separateBodies(sc);
    }
    this.standBackForRunup(sc0);
    // B14b (CanvasMatch loadScenario, lib/star/runCamera.ts): the ball came back into your run, so the
    // camera you were watching stays (no re-frame, no cut). It eases wider only if you, the ball and
    // the goal would not all be in the picture.
    const keepCam = this.keepRunCam && isTouchContinuation; // (a feature with its own frame never reaches here)
    this.keepRunCam = false;
    if (keepCam) {
      const cur = { ...this.viewport };
      const to = widenToHold(cur, [sc0.player, sc0.ball, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }]);
      sc0.viewport = { x1: Math.min(sc0.viewport.x1, to.x1), x2: Math.max(sc0.viewport.x2, to.x2), y1: Math.min(sc0.viewport.y1, to.y1), y2: Math.max(sc0.viewport.y2, to.y2) };
      this.camEase = to.x1 === cur.x1 && to.x2 === cur.x2 && to.y1 === cur.y1 && to.y2 === cur.y2 ? null : { from: cur, to, t: 0 };
    } else {
      this.camEase = null;
      this.frameScenario(sc0);
    }
    this.resetChanceState();
    this.phase = "aim";
    this.maybeBigMoment();
    this.logMoment(request?.lateCharge ? `Everyone's forward — it's launched into the box for ${this.playerLabel()}.` : this.momentLine(), "you");
    if (request) this.pushLine(request.reason);
    if (heavyTouch > 0.55) this.pushLine("Heavy touch — it has got away from you.");
    if (isTouchContinuation) this.pushLine("Still got it — looks up again.");
    else this.pushLine(commentaryBuildup(sc0.kind, this.rng, this.targetName(sc0)));
    if (carry) {
      this.startLeadIn(undefined, (s) => carryOnLeadIn(s, carry));
    } else {
      const car = this.setup.career;
      this.startLeadIn({
        opening: false,
        fresh: !attacking && !chain && !setPiece,
        lane: request?.lane, pattern: request?.pattern,
        seed: this.seed,
        us: car.player.club, them: this.setup.fixture.opponent,
        themStrength: this.oppStrength,
        ...(fhrOn() ? {
          usStrength: this.hiddenInputs().teamStrength,
          regain: request?.regain,
          offsideOff: ruleBookFor(car, "FA").offsideAbolished,
        } : {}),
        frame: { ...this.viewport },
        minute: this.matchMinute,
        scoreDiff: this.userScore - this.oppScore,
        stakes: stakesOf(this.setup.fixture),
      });
    }
    this.bump();
  }

  private resetChanceState() {
    this.ball = null;
    this.aim = null;
    this.runup = null;
    this.contactTimerS = null;
    this.airTapWait = null; this.airTapOpened = null;
    this.outcome = null;
    this.drag = null;
    this.dragging = false;
    this.aimCommitAt = null; this.presser = null; this.thumbOrigin = null;
    this.receiveGlide = null;
    this.windUp = null; this.powerStrike = false; this.callMsgNow = null;
  }

  /** CanvasMatch setUpKeeper. */
  private setUpKeeper(sc: Scenario, seed: number) {
    seed = (seed ^ (this.keeperSalt ?? 0)) >>> 0;
    const opts = brainOptionsHere();
    const facing = autoKickOf(sc)?.keeper?.strength ?? this.strength;
    opts.penalty = penaltyReadFor(facing, this.feature?.penaltyRead?.());
    brainSetup(sc, seed, sc.keeperStrength, opts);
  }
  private runupStyleFor(sc: Scenario): RunupId {
    const auto = autoKickOf(sc);
    return auto ? takerRunupFor(sc.kind, auto.taker.id || auto.taker.name) : yourRunupFor(sc.kind, this.runupStyle.pen, this.runupStyle.fk);
  }
  private standBackForRunup(sc: Scenario) {
    if (hasRunup(sc.kind)) sc.player = standBackFor(this.runupStyleFor(sc), sc.ball, sc.player, sc.viewport);
  }

  /** CanvasMatch frameScenario, the new view (the website's default). */
  private frameScenario(sc: Scenario) {
    const scene = this.feature?.scene;
    if (scene?.ownFrame) {
      // A feature's own close camera (a drill): its frame, given the canvas's shape (CanvasMatch frameScenario).
      this.facing = sc.facing ?? "up";
      if (this.facing === "up") {
        const v = sc.viewport, hw = this.hw, w = v.x2 - v.x1, h = v.y2 - v.y1;
        if (w > 0 && h > 0 && Math.abs(h / w - hw) > 0.01) {
          if (h / w < hw) sc.viewport = { ...v, y2: v.y1 + w * hw };
          else { const cx = (v.x1 + v.x2) / 2, w2 = h / hw; sc.viewport = { ...v, x1: cx - w2 / 2, x2: cx + w2 / 2 }; }
        }
      }
      this.viewport = { ...sc.viewport };
      return;
    }
    if (!scene) turnWideChance(sc, !hasRunup(sc.kind), this.hw);
    this.facing = sc.facing ?? "up";
    this.tiltDeg = this.tiltForChance(sc);
    const wasFacing = sc.facing ?? "up";
    const cam = frameForNewView(sc, this.hw, false, this.tiltDeg);
    if ((sc.facing ?? "up") !== wasFacing) { this.facing = sc.facing ?? "up"; this.tiltDeg = this.tiltForChance(sc); }
    this.viewport = { ...cam };
  }
  private tiltForChance(sc: Scenario): number {
    return sc.kind === "corner" || sc.kind === "byline_cross" || (sc.facing ?? "up") !== "up" ? 0 : cameraTilt();
  }

  /** CanvasMatch maybeBigMoment (Leo's update: off by default, as on the website). */
  private maybeBigMoment() {
    const sc = this.sc;
    this.big = leoUpdateOn("bigMoments") && !autoKickOf(sc)
      && isBigMoment(this.matchMinute, this.MATCH_DURATION, this.userScore, this.oppScore, goalInView(sc.kind));
  }
  private bigSlowNow(): boolean {
    if (!this.big || this.phase !== "flight") return false;
    const b = this.ball;
    if (!b || b.inNet || !b.youStruckAtGoal) return false;
    return headingIn(b.pos, b.z, b.vel, b.vz ?? 0);
  }

  // ── A penalty a team-mate takes, live (CanvasMatch loadTeammatePenalty + scheduleAutoKick) ──
  private ourTakers(): { outfield: PenaltyTaker[]; keeper: (PenaltyTaker & { overall?: number }) | null } {
    const squad = this.onPitch(this.setup.career.squad ?? []);
    const all = squad.map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, face: p.imageUrl ?? fakeFaceFor(p.id), rating: takerRating(p), isGK: p.position === "GK", overall: p.overall }));
    const outfield = all.filter((t) => !t.isGK);
    for (let i = outfield.length; i < 5; i++) outfield.push({ id: `mate-${i}`, name: `Team-mate ${i + 1}`, shortName: `No. ${i + 7}`, face: fakeFaceFor(`mate-${i}`), rating: 62, isGK: false, overall: undefined });
    return { outfield, keeper: all.find((t) => t.isGK) ?? null };
  }
  private loadTeammatePenalty(request: ScenarioRequest, rng: () => number): boolean {
    const us = this.ourTakers();
    const taker = designatedTaker(us.outfield);
    if (!taker) return false;
    const sc = buildScenario("penalty", rng, this.strength, this.team, this.vision);
    enforceHardRules(sc);
    sc.conditions = this.setup.conditions;
    castScenario(sc, this.onPitch(this.setup.career.squad ?? []).filter((p) => p.id !== taker.id));
    initDefenders(sc, rng);
    castDefence(sc, this.oppXIForCast);
    const kw = sc.keeper.who;
    const plan = planPenalty(taker.rating, mulberry32((this.seed ^ 0x7a11c) >>> 0));
    attachAutoKick(sc, { side: "us", taker, plan, context: "match", keeper: { strength: this.strength, id: kw?.id, name: kw?.name, shortName: kw?.shortName, face: kw?.face } });
    this.standBackForRunup(sc);
    this.setUpKeeper(sc, (this.seed ^ 0x4b7e) >>> 0);
    this.sc = sc;
    this.frameScenario(sc);
    this.resetChanceState();
    this.phase = "aim";
    this.logMoment(`Penalty! ${taker.shortName} to take it.`, "you");
    this.pushLine(request.reason);
    this.bump();
    this.later(AUTO_STAND_MS, () => {
      if (this.phase !== "aim") return;
      const k = autoKickOf(this.sc);
      if (!k) return;
      const a = aimFor(this.sc, k.plan);
      this.startRunup(a.dir, a.power, { contact: a.contact, skills: takerSkills(k.taker.rating) });
    });
    return true;
  }

  // ── The build-up before a chance (CanvasMatch startLeadIn / stepLeadIn / stepRunOn) ──
  private startLeadIn(moment?: LeadMoment, own?: (sc: Scenario) => LeadIn | null) {
    const build = own ?? careerBuildUp;
    const sc = this.sc;
    let lead: LeadIn | null = null;
    const opening: LeadMoment = { opening: true, fresh: true, seed: this.seed, frame: { ...this.viewport }, minute: this.matchMinute, scoreDiff: this.userScore - this.oppScore };
    try { lead = build(sc, moment ?? opening); } catch { lead = null; }
    if (!lead || !(lead.durS > 0)) return;
    this.runOn = null;
    this.leadJoiners = new Set();
    const ents = leadInEntities(sc);
    const ends = ents.map((e) => e.get());
    for (const j of lead.joiners ?? []) {
      const at = lead.posAt(j.key, 0) ?? j.end;
      const d: Scenario["defenders"][number] = { x: at.x, y: at.y, homeX: j.end.x, homeY: j.end.y, containT: 0, speed: 1, role: "cover", baseRole: "cover" };
      sc.defenders.push(d);
      this.leadJoiners.add(d);
      ents.push({ key: j.key, side: "opp", get: () => ({ x: d.x, y: d.y }), set: (p) => { d.x = p.x; d.y = p.y; } });
      ends.push({ ...j.end });
    }
    const mates0 = sc.teammates.length;
    for (let i = 0; i < (lead.extraMates ?? 0); i++) {
      const m = { x: sc.ball.x, y: sc.ball.y };
      sc.teammates.push(m);
      ents.push({ key: `extra${i}`, side: "mate", get: () => ({ x: m.x, y: m.y }), set: (p) => { m.x = p.x; m.y = p.y; } });
    }
    const defs0 = sc.defenders.length;
    for (let i = 0; i < (lead.extraOpps ?? 0); i++) {
      const at = lead.posAt(`oppx${i}`, 0) ?? { x: sc.ball.x, y: sc.ball.y };
      const d: Scenario["defenders"][number] = { x: at.x, y: at.y, homeX: at.x, homeY: at.y, containT: 0, speed: 1, role: "cover", baseRole: "cover" };
      sc.defenders.push(d);
      ents.push({ key: `oppx${i}`, side: "opp", get: () => ({ x: d.x, y: d.y }), set: (p) => { d.x = p.x; d.y = p.y; } });
    }
    this.lead = { lead, t: 0, ents, ends, ball: { x: sc.ball.x, y: sc.ball.y }, z: 0, mates0, defs0, cam: leadInCamera(lead, ents.map((e) => e.key)) };
    this.applyLeadIn();
  }
  private applyLeadIn() {
    const L = this.lead;
    if (!L) return;
    const sc = this.sc;
    L.ents.forEach((e) => { const p = L.lead.posAt(e.key, L.t); if (p) e.set(p); });
    const b = L.lead.ballAt(sc.kind === "header" ? crossDrawT(L.t, L.lead.durS) : L.t);
    sc.ball.x = b.x; sc.ball.y = b.y; L.z = b.z;
  }
  /** The lead-in's camera this frame (picture only). */
  leadCamera(): Viewport | null { const L = this.lead; return L ? L.cam.at(L.t, this.viewport) : null; }
  private stepLeadIn(dt: number) {
    const L = this.lead;
    if (!L) return;
    L.t += dt;
    if (L.t < L.lead.durS) { this.applyLeadIn(); return; }
    if (L.lead.offside) { this.endInOffside(L); return; }
    const sc = this.sc;
    const runKeys = new Set(L.lead.runOnS && L.lead.runOnS > 0 ? L.lead.runOnKeys ?? [] : []);
    const runEnts: LeadEntity[] = [], runEnds: Vec2[] = [];
    L.ents.forEach((e, i) => {
      if (i >= L.ends.length) return;
      const p = runKeys.has(e.key) ? L.lead.posAt(e.key, L.lead.durS) : null;
      if (p) { e.set(p); runEnts.push(e); runEnds.push(L.ends[i]); }
      else e.set(L.ends[i]);
    });
    sc.teammates.length = L.mates0;
    sc.defenders.length = L.defs0;
    sc.ball.x = L.ball.x; sc.ball.y = L.ball.y;
    this.lead = null;
    this.runOn = runEnts.length ? { lead: L.lead, t: 0, ents: runEnts, ends: runEnds } : null;
    this.airTapLead = sc;
    this.bump();
  }
  /** A tap on a skippable lead-in: straight to the chance. */
  skipLeadIn() {
    const L = this.lead;
    if (!L || !L.lead.skippable) return;
    L.t = L.lead.durS;
    this.stepLeadIn(0);
  }
  private endInOffside(L: Lead) {
    this.lead = null;
    this.runOn = null;
    this.viewport = { ...L.cam.at(L.lead.durS, this.viewport) };
    this.outcome = "offside";
    this.phase = "result";
    this.showAction("OFFSIDE");
    this.pushLine(L.lead.offside?.by === "you" ? `Flag up — ${this.playerLabel()} went too early. Free kick to them.` : "Flag up — the run was too early. Offside, free kick to them.");
    resolveScenario(this.st, this.matchResultFor("offside"));
    this.handOver(() => this.startSimulation(), 1800);
  }
  private ownMover(key: string): boolean {
    const sc = this.sc;
    if (key === "run") return !!(sc.runner?.commandedTo || sc.runner?.heldAt);
    if (key.startsWith("sec")) { const r = sc.secondaryRunners[Number(key.slice(3))]; return !!(r?.commandedTo || r?.heldAt); }
    if (key === "follower") return !!(sc.follower.commandedTo || sc.follower.heldAt);
    if (key.startsWith("def")) return !!this.presser && this.presser === sc.defenders[Number(key.slice(3))];
    return false;
  }
  private stepRunOn(dt: number) {
    const R = this.runOn;
    if (!R) return;
    R.t += dt;
    const T = R.lead.durS + R.t;
    const end = R.t >= (R.lead.runOnS ?? 0);
    R.ents.forEach((e, i) => {
      if (this.ownMover(e.key)) return;
      const p = end ? R.ends[i] : R.lead.posAt(e.key, T);
      if (p) e.set(p);
    });
    if (end) this.runOn = null;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  THE DRIBBLE RUN (CanvasMatch startTopDownDribble / finishFpDribble)
  // ════════════════════════════════════════════════════════════════════════

  private startTopDownDribble(): Phase {
    const fp = this.fpDribble;
    if (!fp) return "feed";
    const roster = this.oppXIForCast
      ? this.oppXIForCast.filter((p) => !p.isGK).map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, face: p.face, defending: p.defending, overall: p.overall }))
      : undefined;
    const run = newFpRun({
      pace: 100, oppStrength: 100, waveSizes: fp.waveSizes, roster, rng: mulberry32(fp.seed),
      mates: Math.round(getTuning("dribble.mates")),
    });
    this.td = run;
    this.tdNotes = 0;
    this.tdReady = true;
    this.viewport = this.topDownViewport(run);
    return "tdDribble";
  }
  private topDownViewport(run: FpRunState): Viewport {
    const aspect = 1 / this.hw;
    const y1 = run.y - 28, y2 = run.y + 12;
    const w = (y2 - y1) * aspect;
    const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, run.x));
    return { x1: cx - w / 2, x2: cx + w / 2, y1, y2 };
  }
  /** Dribble input: the first tap starts the run; then drag sideways to steer, tap a team-mate to pass. */
  tdTap(at: Vec2) {
    const run = this.td;
    if (!run || this.phase !== "tdDribble") return;
    if (this.tdReady) { this.tdReady = false; this.bump(); return; }
    const mi = run.mates.findIndex((m) => Math.hypot(m.x - at.x, m.y - at.y) < 3);
    if (mi >= 0) { fpPass(run, mi, this.vision); return; }
  }
  tdSteer(laneTarget: number) { if (this.td && !this.tdReady) fpSteer(this.td, laneTarget); }
  tdBurst(dir: -1 | 1) { return this.td ? fpBurst(this.td, dir) : false; }
  tdFeint(kind: "stepover" | "dragback" | "nutmeg" | "shoulder", dir: -1 | 1) {
    const run = this.td;
    if (!run || !run.duels) return;
    if (kind === "stepover" && !this.mechOpen("skillMoves")) return;
    fpFeint(run, kind as Parameters<typeof fpFeint>[1], dir);
  }
  private stepTopDown(dt: number) {
    const run = this.td;
    if (!run) return;
    const want = this.topDownViewport(run);
    const vp = this.viewport, k = 1 - Math.exp(-4 * dt);
    this.viewport = { x1: vp.x1 + (want.x1 - vp.x1) * k, x2: vp.x2 + (want.x2 - vp.x2) * k, y1: vp.y1 + (want.y1 - vp.y1) * k, y2: vp.y2 + (want.y2 - vp.y2) * k };
    if (this.tdReady) return;
    // A new duel note ("He backs off…"): the screen shows the latest (CanvasMatch tdNote).
    const notes = run.events?.length ?? 0;
    if (notes !== this.tdNotes) { this.tdNotes = notes; this.bump(); }
    const out = stepFpRun(run, dt);
    if (out !== "running") this.finishTopDownDribble(out);
  }
  private finishTopDownDribble(out: FpRunPhase) {
    const run = this.td;
    if (!run || this.phase !== "tdDribble") return;
    const pass = run.pass;
    const result = {
      cleared: out === "clear",
      beaten: run.defenders.filter((d) => d.phase === "beaten").length,
      wavesBeaten: fpWavesBeaten(run),
      totalWaves: run.roundSizes.length,
      ...(pass && pass.success ? { passedAfterWaves: pass.afterWaves, passTo: pass.at } : {}),
      ...(pass && !pass.success ? { passFailed: true } : {}),
      ...(out === "fouled" ? { fouled: true } : {}),
      ...(run.duels ? { duels: true } : {}),
    } as { cleared: boolean; beaten: number; wavesBeaten?: number; totalWaves?: number; passedAfterWaves?: number; passTo?: Vec2; passFailed?: boolean; fouled?: boolean; duels?: boolean };
    this.phase = "result";
    this.finishFpDribble(result);
  }
  private finishFpDribble(result: { cleared: boolean; beaten: number; wavesBeaten?: number; totalWaves?: number; passedAfterWaves?: number; passTo?: Vec2; passFailed?: boolean; fouled?: boolean; duels?: boolean }) {
    this.fpDribble = null;
    this.attempts += 1;
    const rng = this.rng;
    if (result.fouled) {
      const t = this.tally;
      if (result.beaten > 0) t.dribbles += 1;
      this.logChance("dribble", "dribble");
      this.showAction("FOUL");
      this.pushLine("Brought down as he goes past him — free kick.");
      if (this.mayTake("free_kick")) {
        this.setPieceNext = "free_kick";
        resolveScenario(this.st, "delivered");
        this.later(1600, () => this.loadScenario(true));
      } else {
        this.handover = "free_kick";
        this.later(1800, () => this.startSimulation());
      }
      return;
    }
    const passed = result.passedAfterWaves !== undefined;
    if (result.cleared || passed) {
      const t = this.tally;
      if (passed) { t.passes += 1; t.passesCompleted += 1; }
      if (result.beaten > 0 || result.cleared) t.dribbles += 1;
      this.logChance("dribble", "dribble");
      const reward = dribbleReward({
        cleared: result.cleared, menBeaten: result.beaten,
        wavesBeaten: result.wavesBeaten ?? (result.cleared ? 1 : 0),
        totalWaves: result.totalWaves ?? 1,
        mateX: result.passTo?.x,
        ...(result.duels ? { bonusMen: 4 } : {}),
      }, rng);
      if (passed) {
        this.pushLine(reward.tier >= 3 ? "Picks out the free man — and he's in." : reward.tier >= 2 ? "Draws them in and slips it wide." : "Lays it off early.");
        this.showAction("PASS");
      } else {
        this.pushLine(reward.tier >= 4 ? "Clean through — you've beaten the lot of them." : "You are through — and the chance is on.");
        this.showAction("BEAT HIM");
      }
      this.chain = { pos: reward.pos, depth: 0, ambition: reward.ambition, kind: reward.kind };
      resolveScenario(this.st, "delivered");
      this.later(1200, () => this.loadScenario(true));
      return;
    }
    this.pushLine(result.passFailed ? "The pass is cut out." : "Taken off you.");
    this.outcome = "tackled";
    this.phase = "result";
    resolveScenario(this.st, "lost");
    const t = this.tally;
    t.chances += 1;
    t.lost += 1;
    if (result.passFailed) t.passes += 1;
    this.logChance("dribble", "tackled");
    this.later(1600, () => this.startSimulation());
  }

  // ════════════════════════════════════════════════════════════════════════
  //  AIMING (CanvasMatch onPointerDown / onPointerMove / onPointerUp)
  //  The screen converts the finger to pitch metres and to glass fractions.
  // ════════════════════════════════════════════════════════════════════════

  /** Is the captain's armband on? */
  get isCaptain() { return !!this.setup.career?.captain; }
  private captainDrag: { target: Runner | "follower"; from: Vec2; to: Vec2 } | null = null;

  /**
   * A finger down on the pitch. `p` is the pitch point under it; `grabM` the
   * ball-grab radius in metres (BALL_GRAB_FRACTION of the classic canvas
   * height, measured at this camera: CanvasMatch sameOnScreenM).
   */
  pointerDown(p: Vec2, grabM: number, captainGrabM: number) {
    if (this.lead) { this.skipLeadIn(); return; }
    if (this.phase === "aim" && autoKickOf(this.sc)) return;
    if (this.phase === "aim" && isAirKind(this.sc.kind) && airTapOn()) return;
    if (this.phase !== "aim" || this.windUp !== null) return;
    const b = this.sc.ball;
    const r = this.captainPickAt(p, captainGrabM);
    if (r) { this.captainDrag = { target: r, from: p, to: p }; return; }
    const ballD = Math.hypot(p.x - b.x, p.y - b.y);
    if (ballD >= this.nearestCaptainCandidateDist(p)) return;
    if (ballD > grabM) return;
    this.dragging = true;
    this.thumbOrigin = p;
    this.drag = { x: b.x, y: b.y };
    this.bump();
  }
  /** `pull` is the screen pull for a drag point (CanvasMatch screenPull), from the screen. */
  pointerMove(p: Vec2, pullOf: (drag: Vec2, ball: Vec2) => number) {
    if (this.captainDrag) { this.captainDrag.to = p; return; }
    if (!this.dragging) return;
    const o = this.thumbOrigin, bb = this.sc.ball;
    this.drag = o ? { x: bb.x + (p.x - o.x), y: bb.y + (p.y - o.y) } : p;
    if (this.aimCommitAt === null && this.phase === "aim" && acceptsCaptainOrders(this.sc.kind) && pullOf(this.drag, bb) >= MIN_PULL) this.commitAim();
  }
  pointerUp(pullOf: (drag: Vec2, ball: Vec2) => number) {
    if (this.captainDrag) {
      const { target, from, to } = this.captainDrag;
      this.captainDrag = null;
      const sc = this.sc;
      const isTap = Math.hypot(to.x - from.x, to.y - from.y) < CAPTAIN_DRAG_MIN;
      if (target === "follower") {
        if (isTap) { sc.relayToFollower = !sc.relayToFollower; if (sc.relayToFollower) sc.relayTo = null; }
        else sc.follower.commandedTo = { x: to.x, y: to.y };
      } else if (isTap) { sc.relayTo = sc.relayTo === target ? null : target; if (sc.relayTo) sc.relayToFollower = false; }
      else target.commandedTo = { x: to.x, y: to.y };
      this.bump();
      return;
    }
    if (!this.dragging) return;
    this.dragging = false;
    const d = this.drag;
    this.drag = null;
    this.thumbOrigin = null;
    this.bump();
    if (!d) return;
    const b = this.sc.ball;
    const pull = pullOf(d, b);
    const power = clamp(pull / dragForFullPower(this.setup.skills.power), 0, 1);
    if (this.aimCommitAt !== null && (pull < MIN_PULL || power < 0.02)) { this.loseChance("letgo"); return; }
    if (pull < MIN_PULL) return;
    if (power < 0.02) return;
    const dir = { x: b.x - d.x, y: b.y - d.y };
    this.release(dir, power);
  }
  /** The aim is let go (the end of onPointerUp): run up, or open the strike screen. */
  release(dir: Vec2, power: number) {
    if (hasRunup(this.sc.kind)) { this.startRunup(dir, power); return; }
    this.aim = { dir, power };
    // An armed power shot winds up first (shotModel.ts): the pitch keeps moving for
    // POWER_SHOT_WINDUP_S, then the green-circle screen opens (CanvasMatch onPointerUp).
    if (this.powerArmed && knucklePowerOn() && this.mechOpen("powerShot") && aimedAtGoal(this.sc, dir)) {
      this.powerStrike = true;
      this.powerArmed = false;
      this.windUp = POWER_SHOT_WINDUP_S;
      this.pushLine("He pulls the leg right back…");
      this.bump();
      return;
    }
    this.powerStrike = false;
    this.openContact();
    this.bump();
  }
  /** The aim drag's power right now (for the arrow). */
  dragPower(pullOf: (drag: Vec2, ball: Vec2) => number): number {
    if (!this.drag) return 0;
    return clamp(pullOf(this.drag, this.sc.ball) / dragForFullPower(this.setup.skills.power), 0, 1);
  }

  private captainPickAt(p: Vec2, grab: number): Runner | "follower" | null {
    if (!this.isCaptain) return null;
    const sc = this.sc;
    if (!acceptsCaptainOrders(sc.kind)) return null;
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
  private nearestCaptainCandidateDist(p: Vec2): number {
    if (!this.isCaptain) return Infinity;
    const sc = this.sc;
    if (!acceptsCaptainOrders(sc.kind)) return Infinity;
    let best = Infinity;
    for (const r of orderableRunners(sc)) best = Math.min(best, Math.hypot(p.x - r.pos.x, p.y - r.pos.y));
    if (goalInView(sc.kind)) best = Math.min(best, Math.hypot(p.x - sc.follower.x, p.y - sc.follower.y));
    return best;
  }
  private commitAim() {
    this.aimCommitAt = this.now;
    const sc = this.sc;
    this.presser = null;
    if (this.pressure > 0) {
      let best: Scenario["defenders"][number] | null = null;
      let bestD = Infinity;
      for (const d of sc.defenders) {
        const dist = Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y);
        if (dist < bestD) { bestD = dist; best = d; }
      }
      this.presser = best;
      this.presserBehind = !!best && pressFromBehind(best, sc.ball, sc.player);
    }
    const ordered = orderableRunners(sc).some((r) => !!r.commandedTo) || !!sc.follower.commandedTo;
    if (this.isCaptain && ordered) this.pushLine("He's off — play it before he's past the last man.");
  }
  private stepCommitted(dt: number) {
    const sc = this.sc;
    const since = (this.now - (this.aimCommitAt ?? this.now)) / 1000;
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
    const d = this.presser;
    if (d && since > PRESS_REACT_S) {
      const b = sc.ball;
      const dist = Math.hypot(b.x - d.x, b.y - d.y);
      if (dist <= PRESS_WIN_R) { this.loseChance("pressed"); return; }
      pressStep(d, b, sc.player, pressSpeedFor(this.pressure) * dt);
    }
  }
  private loseChance(why: "letgo" | "pressed") {
    if (this.phase !== "aim" && this.phase !== "contact") return;
    this.aimCommitAt = null; this.presser = null; this.dragging = false; this.drag = null; this.thumbOrigin = null;
    this.aim = null;
    if (why === "pressed" && mulberry32((this.seed ^ 0x0f0c1a5) >>> 0)() < foulShareFor(this.presserBehind)) { this.fouled(); return; }
    this.resolveOutcome("tackled");
    this.showAction(why === "letgo" ? "CHANCE GONE" : "CLOSED DOWN");
    this.pushLine(why === "letgo" ? "Hesitates, lets it go — and the chance is gone." : "Closed down before he could play it!");
  }
  private fouled() {
    const b = this.sc.ball;
    const inBox = b.y <= BOX_DEPTH && b.x >= BOX_L && b.x <= BOX_R;
    const kind: ScenarioKind = inBox ? "penalty" : "free_kick";
    this.outcome = null;
    this.phase = "result";
    this.showAction(inBox ? "PENALTY" : "FOUL");
    this.pushLine(inBox ? "Brought down in the box — penalty!" : "Chopped down as he pulls back — free kick.");
    if (this.mayTake(kind)) {
      this.setPieceNext = kind;
      resolveScenario(this.st, "delivered");
      this.later(1600, () => this.loadScenario(true));
    } else {
      this.handover = kind;
      this.later(1800, () => this.startSimulation());
    }
  }

  // ── The run-up (CanvasMatch startRunup / the runup frame) ──
  private startRunup(rawDir: Vec2, power: number, auto?: { contact: { cx: number; cy: number }; skills: KickSkills }) {
    const sc = this.sc;
    const L = Math.hypot(rawDir.x, rawDir.y) || 1;
    const dir0 = { x: rawDir.x / L, y: rawDir.y / L };
    const styleId = this.runupStyleFor(sc);
    const styled = planRunup(styleId, sc.ball, sc.player);
    void plantBeside;
    this.runup = { t: 0, dir0, power, nudgeM: 0, nudge: !auto && canNudge(sc.kind), arrived: false, styled, runS: RUNUP_MOTION[styleId].runS, ...(auto ? { auto } : {}) };
    if (auto) { this.phase = "runup"; this.bump(); return; }
    this.aim = { dir: dir0, power };
    this.phase = "runup";
    this.pushLine("He runs up…");
    this.tryHold("runup");
    this.bump();
  }
  /** Nudge the run-up's aim sideways (metres at the goal line). */
  nudgeRunup(m: number) { const ru = this.runup; if (ru && !ru.arrived && ru.nudge) ru.nudgeM = m; }

  // ════════════════════════════════════════════════════════════════════════
  //  THE STRIKE (CanvasMatch handleContact, handleScuff)
  // ════════════════════════════════════════════════════════════════════════

  // ── The strike screen itself (the website's ContactBall.tsx): its moving
  // ball, its countdown and the beat between your tap and the kick, counted in
  // the driver's ticks so a headless run plays it exactly like the phone.
  contactT0 = 0;
  contactLocked = false;
  contactTimedOut = false;
  /** Where you hit it (ball radii) once tapped, for the spark. */
  contactSpark: { cx: number; cy: number } | null = null;
  /** Picture only: your last strike (the ball it launched, how cleanly, header/volley), for Match feel (match/feel.ts). */
  feelStrike: { ball: Ball; grade?: string; air?: "header" | "volley" } | null = null;
  private openContact() {
    this.phase = "contact";
    this.contactT0 = this.tickNo;
    this.contactLocked = false;
    this.contactTimedOut = false;
    this.contactSpark = null;
    this.contactFrozen = null;
    this.tryHold("contact");
    this.bump();
  }
  /** The strike screen's ball right now, as fractions of its area (ContactBall's mover). */
  contactBallNow(): { x: number; y: number } {
    if (this.contactLocked && this.contactFrozen) return this.contactFrozen;
    return ballMotionAt(this.strikeMotion(), (this.tickNo - this.contactT0) / 60, sweepPeriod(this.setup.skills.technique));
  }
  private contactFrozen: { x: number; y: number } | null = null;
  /** The countdown in seconds (null = none), and how much is left (0..1). */
  contactCountdown(): { limitS: number; left: number } | null {
    const limitS = contactLimitS(this.strikeMotion(), this.contactTimerS, this.airAerialNow());
    if (!limitS) return null;
    // The clock starts on the second frame the screen is drawn (ContactBall `started`).
    const t = Math.max(0, (this.tickNo - this.contactT0) / 60 - 2 / 60);
    return { limitS, left: Math.max(0, 1 - t / limitS) };
  }
  /** A touch on the strike screen's ball: (cx, cy) on it, +right/+down, in ball radii. */
  tapContact(cx: number, cy: number) {
    if (this.phase !== "contact" || this.contactLocked || this.powerStrike) return;
    const motion = this.strikeMotion();
    const at = this.contactBallNow();
    this.contactFrozen = at;
    this.contactLocked = true;
    this.contactSpark = { cx, cy };
    const air = motion === "float" || motion === "bounce";
    const lift = liftOf(motion, at.y);
    this.bump();
    this.later(air ? AIR_VERDICT_MS : GROUND_TAP_MS, () => this.contact(air ? { cx, cy, lift } : { cx, cy }));
  }
  private contactClock() {
    if (this.phase !== "contact" || this.contactLocked || this.powerStrike) return;
    const cd = this.contactCountdown();
    if (!cd || cd.left > 0) return;
    this.contactLocked = true;
    this.contactTimedOut = true;
    const motion = this.strikeMotion();
    const at = this.contactBallNow();
    this.contactFrozen = at;
    const airKind = motion === "float" || motion === "bounce";
    const runupLimit = !!(this.contactTimerS && this.contactTimerS > 0);
    this.bump();
    this.later(TOO_SLOW_MS, () => {
      if (airKind && !runupLimit) this.contact(lateAirContact(motion, liftOf(motion, at.y), at.x));
      else this.scuff();
    });
  }

  /** The strike screen's tap: where on the ball, cx +right, cy +down (ball radii); `lift` for a ball in the air. */
  contact(tapped: { cx: number; cy: number; lift?: number; late?: boolean }) {
    if (this.phase !== "contact") return;
    const sc = this.sc;
    if (isAirKind(sc.kind) && airTapOn()) {
      const st = airTapStrike(sc.kind as AirKind, sc.ball, tapped, this.airAerialNow());
      this.handleContact({ ...st.contact, aim: st.aim });
    } else this.handleContact(tapped);
  }
  /** The strike screen's countdown ran out (a run-up): the scuffed kick. */
  scuff() {
    if (!this.aim || this.phase !== "contact") return;
    const r = mulberry32(((this.seed ^ Math.imul(this.rngCalls.current + 1, 0x27d4eb2d)) ^ 0x5c0f) >>> 0);
    const s = scuffStrike(this.aim.dir, this.aim.power, r);
    this.showAction("SCUFFED");
    this.handleContact(s.contact, { dir: s.dir, power: s.power });
  }
  airAerialNow(): number | undefined {
    if (!this.setup.career) return this.feature?.aerial;
    return Math.round(aerialOf(this.setup.career.skills) * (1 - fatigueCut(this.liveEnergyAt(this.matchMinute))));
  }
  /** How the strike screen's ball moves (CanvasMatch strikeMotion). */
  strikeMotion(): "still" | "float" | "bounce" | "bobble" {
    const kind = this.sc.kind, seed = this.seed;
    if (airborneOn()) return airborneMotion(kind, seed);
    if (kind === "header") return "float";
    if (kind === "volley") return "bounce";
    if (kind === "one_on_one" || kind === "tight_angle" || kind === "long_range") return ((Math.imul(seed, 2654435761) >>> 0) % 100) < 35 ? "bobble" : "still";
    return "still";
  }

  private handleContact(
    tapped: { cx: number; cy: number; lift?: number; late?: boolean; aim?: { dir: Vec2; power: number } },
    over?: { dir: Vec2; power: number; skills?: KickSkills },
    extras?: ShotExtras,
  ) {
    let a = over ? { dir: over.dir, power: over.power } : tapped.aim ?? this.aim;
    if (!a) return;
    const aerNow = !over && this.aerial?.sc === this.sc && this.aerial.opened ? this.aerial : null;
    if (aerNow) a = aerialStrikeTint(aerNow.move, a.dir, a.power, (this.seed ^ Math.imul(this.rngCalls.current + 1, 0x27d4eb2d)) >>> 0);
    if (aerNow) aerNow.struckAt = this.now / 1000;
    this.runOn = null;
    let contact: StrikeContact = { cx: tapped.cx, cy: tapped.cy };
    if (!over && tapped.lift !== undefined && (airborneOn() || isAirKind(this.sc.kind))) {
      const m = this.strikeMotion();
      if (m === "float" || m === "bounce") contact = { ...contact, air: { kind: m === "float" ? "header" : "volley", lift: tapped.lift, cx: tapped.cx, cy: tapped.cy } };
    }
    const auto = over?.skills ? { skills: over.skills } : null;
    this.contactTimerS = null;
    const tired = this.tiredSkills();
    const fkRaw = this.setup.career?.skills.freeKick ?? this.feature?.setPieceSkill;
    const strikeWith = auto ? auto.skills : setPieceSkills(
      tired,
      fkRaw === undefined ? tired.technique : fkRaw * (1 - fatigueCut(this.liveEnergyAt(this.matchMinute))),
      this.sc.kind,
    );
    const feelPow = !auto && shotPowerOn() && struckAtGoal(this.sc, a.dir, contact.cx);
    const launchWith = feelPow
      ? { ...strikeWith, power: feelPower(strikeWith.power) }
      : switchOn("powerCurve") ? { ...strikeWith, power: strikingPower(strikeWith.power) } : strikeWith;
    if (contact.air) contact = { ...contact, air: { ...contact.air, tech: launchWith.technique, aerial: this.setup.career ? Math.round(aerialOf(this.setup.career.skills) * (1 - fatigueCut(this.liveEnergyAt(this.matchMinute)))) : this.feature?.aerial } };
    const shotPro = !auto && shotsPro();
    const shotKnuckle = !auto && knucklePowerOn() && this.mechOpen("knuckle");
    const shotField = !auto && contactFieldOn();
    const shotLift = feelPow ? feelLift(strikeWith.power) : 1;
    const shotRec = (shotPro || shotKnuckle || extras || shotField || shotLift !== 1)
      ? { seed: shotSeedFor(this.seed, this.rngCalls.current), extras, pro: shotPro, knuckle: shotKnuckle, field: shotField, lift: shotLift }
      : null;
    this.physAcc = 0;
    this.deflections = 0;
    this.matePlays = [];
    this.strikeAt = { x: this.sc.ball.x, y: this.sc.ball.y };
    let shotRead: ContactRead | undefined;
    if (shotRec) {
      const st = launchShot(this.sc, a.dir, a.power, contact, launchWith, this.rng, shotRec, shotRec, launch);
      this.ball = st.ball;
      shotRead = st.read;
    } else {
      this.ball = launch(this.sc, a.dir, a.power, contact, launchWith, this.rng);
    }
    applyAirborne(this.ball, this.sc, contact.air);
    // Picture only (Match feel, match/feel.ts): the strike as it left the boot, read, never changed.
    this.feelStrike = { ball: this.ball, grade: shotRead?.grade ?? gradeContact(contact, a.power, false).grade, air: contact.air?.kind };
    if (aerNow) {
      const banner = AERIAL_SPECS[aerNow.move].banner;
      if (banner) this.showAction(banner);
    }
    if (hasBrain(this.sc)) {
      const bs = ((this.seed ^ Math.imul(this.rngCalls.current + 1, 0xc2b2ae35)) ^ 0x4b7f ^ (this.keeperSalt ?? 0)) >>> 0;
      brainStrike(this.sc, this.ball, bs);
    } else if (this.sc.kind === "penalty") {
      const facing = autoKickOf(this.sc)?.keeper?.strength ?? this.strength;
      const read = penaltyReadFor(facing, this.feature?.penaltyRead?.());
      const r = mulberry32(((this.seed ^ Math.imul(this.rngCalls.current + 1, 0x9e3779b1)) ^ 0x5eed ^ (this.keeperSalt ?? 0)) >>> 0);
      const decision = decidePenaltyRead(this.sc, this.ball, read, [r(), r()]);
      applyPenaltyRead(this.sc, decision);
    }
    this.runup = null;
    this.cheekyStrikeKind = auto ? null : cheekyStrike(this.sc.kind, this.ball, (this.sc.goal.x1 + this.sc.goal.x2) / 2, this.ball.youStruckAtGoal === true);
    {
      const r = mulberry32(((this.seed ^ Math.imul(this.rngCalls.current + 1, 0x85ebca6b)) ^ 0x6b1d) >>> 0);
      const kd = strikeKind(this.sc, this.ball, r, {
        keeperStrength: this.strength, setPieceSkill: this.feature?.setPieceSkill,
        power: strikeWith.power, technique: strikeWith.technique,
        ...(!auto && this.runupStyleFor(this.sc) === LEAF_RUNUP ? { runup: LEAF_RUNUP } : {}),
      });
      this.strikeRule = kd;
    }
    // Touch Mode (CanvasMatch handleContact): the instant your boot is on the ball you stand where it
    // is, so the chase measures from there. Only with the toggle on and the boots (or the can) for it.
    if (this.touchModeOn && this.canExtraTouch && !auto) this.sc.player = { x: this.ball.pos.x, y: this.ball.pos.y };
    this.playOn = null;
    this.playOnCaught = false;
    {
      const sc = this.sc;
      delete sc.matePace;
      const touchOn = this.touchModeOn && this.canExtraTouch;
      if (!touchOn && !this.shootoutKick && runAfterWanted({ kind: sc.kind, youShotAtGoal: this.ball.youStruckAtGoal === true, auto: !!auto })) {
        this.playOnRng = mulberry32(((this.seed ^ Math.imul(this.rngCalls.current + 1, 0x9e3779b1)) ^ 0x61a7) >>> 0);
        const bl = this.ball;
        const stick = afterPassStickOn() && this.mechOpen("steer");
        const car = this.setup.career;
        this.playOn = startPlayOnRun(sc, this.playOnRng, { x: bl.pos.x + bl.vel.x * 0.8, y: bl.pos.y + bl.vel.y * 0.8 }, {
          stick, pace: car?.skills.pace, energy: this.liveEnergyAt(this.matchMinute), bar: this.bar,
        });
      }
    }
    this.phase = "flight";
    if (this.sc.kind === "header" && this.ball.lastTouch === "defence") this.pushLine("He gets up highest and heads it clear!");
    else if (shotRead && SHOT_LINES[shotRead.grade]) { this.pushLine(SHOT_LINES[shotRead.grade]!); if (shotRead.grade === "knuckle") this.showAction("KNUCKLEBALL"); }
    else this.pushLine(commentaryStrike(this.sc.kind, this.rng, this.targetName(this.sc)));
    if (extras?.powerMult) this.showAction(`⚡ x${extras.powerMult.toFixed(2)}`);
    this.bump();
  }

  /** A swipe during the flight bends a struck ball (curve boots only). `lateral`/`other` in screen px, already turned to the pitch. */
  curveSwipe(lateral: number, other: number) {
    if (this.phase !== "flight" || !this.setup.canCurve || !this.ball) return;
    if (Math.hypot(lateral, other) < CURVE_SWIPE_MIN_PX) return;
    const dir = curveDirFromSwipe(lateral, other);
    if (dir) applyCurveSwipe(this.ball, dir);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  ONE FRAME (CanvasMatch's requestAnimationFrame loop, at 60 fps)
  // ════════════════════════════════════════════════════════════════════════

  tick() {
    this.tickNo += 1;
    this.now = this.tickNo * TICK_MS;
    // Timers due (the website's setTimeouts): a timer from a superseded scene is dropped (sceneGenRef).
    // A setTimeout runs BETWEEN two frames, so a tick whose timer moved the match on to
    // another phase does nothing else: the next frame is the first of the new phase.
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.tickNo);
      if (due.length) {
        const before = this.phase;
        this.timers = this.timers.filter((t) => t.at > this.tickNo);
        for (const t of due) if (t.gen === this.gen) t.fn();
        if (this.phase !== before) return;
      }
    }
    if (this.phase === "feed") { this.feedTick(); this.recordGoalFrame(FRAME_DT); return; }
    if (this.phase === "done") return;
    // A feature's teaching pause: the run-up and the strike screen's clock stand still.
    if (this.held) { if (this.phase === "contact") this.contactT0 += 1; return; }

    let dt = FRAME_DT;
    const replayDt = Math.min(Math.max(0, dt), LEAD_REPLAY_MAX_DT);
    if (this.bigSlowNow()) dt *= BIG_SLOW_RATE;

    if (this.phase === "tdDribble" && this.td) this.stepTopDown(dt);

    if (this.phase === "aim" && !this.lead) {
      stepKeeper(this.sc, dt);
      brainAim(this.sc, dt);
    }
    // The power shot's wind-up: the defence closes while the leg goes back (CanvasMatch's frame loop).
    if (this.phase === "aim" && this.windUp !== null) {
      stepWindUp(this.sc, dt);
      this.windUp -= dt;
      if (this.windUp <= 0) { this.windUp = null; this.openContact(); }
    }
    // A header or volley: no drag, the strike screen opens by itself (the aerial move, or the air tap's wait).
    {
      const sc = this.sc;
      if (this.phase === "aim" && !this.lead && !this.playOn && !this.ball && isAirKind(sc.kind) && airTapOn() && !autoKickOf(sc) && !this.dragging && aerialMovesOn()) {
        let ar = this.aerial;
        if (!ar || ar.sc !== sc) {
          const kind = sc.kind as "header" | "volley";
          const mate = sc.teammates[0];
          const tech = this.setup.career?.skills.technique ?? this.setup.skills.technique;
          const move = forcedAerialMove(kind) ?? pickAerialMove({
            kind, ballZ: airZOf(sc),
            inDir: mate ? { x: sc.ball.x - mate.x, y: sc.ball.y - mate.y } : { x: 0, y: -1 },
            toGoal: { x: CX - sc.ball.x, y: -sc.ball.y },
            aerial: this.airAerialNow() ?? 60, flair: tech ?? 50,
            seed: (this.seed ^ Math.imul(Math.round(sc.ball.x * 100), 31) ^ Math.round(sc.ball.y * 100)) >>> 0,
          });
          ar = this.aerial = { sc, move, e: 0, preS: this.airTapLead === sc ? 0 : AIR_TAP_OPEN_NO_LEAD_S - AIR_TAP_OPEN_S, opened: false };
        } else ar.e += dt;
        if (!ar.opened && ar.e >= ar.preS + AERIAL_SPECS[ar.move].riseS + CONTACT_SHOW_S) {
          ar.opened = true;
          this.airTapOpened = sc;
          this.aim = airTapAim(sc.kind as AirKind, sc.ball, 0);
          this.openContact();
          this.bump();
        }
      } else if (this.phase === "aim" && !this.lead && !this.playOn && !this.ball && isAirKind(sc.kind) && airTapOn() && !autoKickOf(sc) && !this.dragging) {
        const w = this.airTapWait;
        const t = w && w.sc === sc ? w.t + dt : 0;
        this.airTapWait = { sc, t };
        if (t >= (this.airTapLead === sc ? AIR_TAP_OPEN_S : AIR_TAP_OPEN_NO_LEAD_S) && this.airTapOpened !== sc) {
          this.airTapOpened = sc;
          this.aim = airTapAim(sc.kind as AirKind, sc.ball, 0);
          this.openContact();
          this.bump();
        }
      }
    }
    if (this.phase === "aim" && this.aimCommitAt !== null) this.stepCommitted(dt);
    this.contactClock();

    if (this.phase === "runup") {
      const ru = this.runup;
      const sc = this.sc;
      stepKeeper(sc, dt);
      if (ru && !ru.arrived) {
        ru.t += dt;
        const dirNow = ru.nudge ? nudgedDir(sc.ball, ru.dir0, ru.nudgeM) : ru.dir0;
        brainRunUp(sc, dt, ru.t, goalLineX(sc.ball, dirNow));
        sc.player = runupPositionAt(ru.styled, ru.t);
        if (ru.t >= ru.runS && ru.auto) {
          ru.arrived = true;
          this.handleContact(ru.auto.contact, { dir: dirNow, power: ru.power, skills: ru.auto.skills });
        } else if (ru.t >= ru.runS) {
          ru.arrived = true;
          this.aim = { dir: dirNow, power: ru.power };
          this.contactTimerS = strikeTimerFor(sc.kind);
          this.openContact();
          this.bump();
        }
      }
    }

    // A side-on chance cuts to the up-the-pitch camera once the ball is level with it (and so does the play area).
    if (this.ball && this.facing !== "up") {
      const sc = this.sc;
      const at = sc.crossSwitchY ?? 0;
      const view = sc.crossSwitchView ? crossCutCamera(sc.crossSwitchView, this.hw, this.ball.pos, 0) : sc.crossSwitchView;
      const withinX = view ? this.ball.pos.x > view.x1 - 1 && this.ball.pos.x < view.x2 + 1 : false;
      if (view && this.ball.pos.y < at && withinX) {
        this.facing = "up";
        this.viewport = { ...view };
        sc.viewport = { ...view };
      }
    }

    if (this.phase === "flight" && this.ball) this.stepFlight(dt);

    if (this.phase === "result" && this.ball) {
      const b = this.ball;
      if (b.inNet) stepBallInNet(b, dt);
      if (this.receiveGlide) {
        const g = this.receiveGlide;
        const t = Math.min(1, (this.now - g.t0) / (RECEIVE_GLIDE_S * 1000));
        const e = 1 - (1 - t) * (1 - t);
        b.pos = { x: g.from.x + (g.to.x - g.from.x) * e, y: g.from.y + (g.to.y - g.from.y) * e };
        b.z = g.z0 * (1 - e);
        b.vel = { x: 0, y: 0 }; b.vz = 0;
        if (t >= 1) this.receiveGlide = null;
      }
      if (b.settling) settleBall(b, dt, this.sc);
      if (b.overBar) stepBallPastBar(b, dt);
      if (b.cleared) {
        stepBallCleared(b, dt, this.sc);
        const boot = this.boot;
        if (boot) {
          if (b.resting && boot.stopT == null) boot.stopT = this.now;
          const vp = this.viewport;
          const off = b.pos.x < vp.x1 - 1 || b.pos.x > vp.x2 + 1 || b.pos.y < vp.y1 - 1 || b.pos.y > vp.y2 + 1;
          const done = off
            || (boot.stopT != null && this.now - boot.stopT >= getTuning("clearance.handOverAfterStop") * 1000)
            || this.now - boot.t >= getTuning("clearance.handOverMax") * 1000;
          if (done) { this.boot = null; boot.then?.(); }
        }
      }
    }
    if (this.phase === "result" && !this.sc.keeper.done) {
      stepKeeper(this.sc, dt);
      brainStep(this.sc, this.ball, dt);
    }
    if (this.phase === "result" && hitboxesOn()) settleJumps(this.sc, dt);

    if (this.runOn) {
      if (this.phase === "aim" || this.phase === "contact") this.stepRunOn(dt);
      else this.runOn = null;
    }
    // The one moving camera, your run (CanvasMatch's frame loop, B14b): while your pass plays on, the
    // chance's camera pans (never zooms) just enough to keep you, and a ball played back to you, in the
    // picture, inside the play area. When the ball comes back a widen eases in over BACK_EASE_S.
    if (!this.feature?.scene?.ownFrame && !this.lead && !this.runOn && this.phase !== "tdDribble") {
      const ce = this.camEase;
      if (ce) {
        ce.t += dt;
        this.viewport = easeCam(ce.from, ce.to, ce.t / BACK_EASE_S);
        if (ce.t >= BACK_EASE_S) this.camEase = null;
      } else if (this.playOn && this.phase === "flight") {
        const sc = this.sc, b = this.ball;
        const want = panToKeep(this.viewport, [sc.player, ...(this.playOn.layOffLive && b ? [b.pos] : [])], sc.viewport);
        this.viewport = followStep(this.viewport, want, dt);
      }
    }
    if (this.lead) this.stepLeadIn(replayDt);
    this.recordGoalFrame(dt);
  }

  // ── GOAL VIDEOS: what the recorder is told each frame (CanvasMatch clipBodiesFor, clipFrameFor, recordGoalFrame, markGoalClip) ──
  private kitsNow() {
    const k = this.clipSink!.kits;
    const home = this.setup.fixture.home !== false;
    const ours = home ? k.home : k.away, theirs = home ? k.away : k.home;
    return { ours, theirs, keeper: k.keeper, ourKeeper: keeperKit(ours.shirt, k.keeper.shirt) };
  }
  private clipBodiesFor(sc: Scenario): ClipBody[] {
    const K = this.kitsNow();
    const kitOf = (k: { shirt: string; trim: string }) => ({ shirt: k.shirt, shorts: k.trim });
    const link = (f?: string) => (f && !f.startsWith("data:") ? f : undefined);
    const us = kitOf(K.ours), them = kitOf(K.theirs);
    const auto = autoKickOf(sc);
    const out: ClipBody[] = [auto
      ? { id: "you", role: auto.side === "them" ? "opp" : "mate", side: auto.side === "them" ? "them" : "us", name: auto.taker.shortName, face: link(auto.taker.face), kit: auto.side === "them" ? them : us }
      : { id: "you", role: "you", side: "us", name: this.playerLabel(), kit: us }];
    out.push({ id: "follower", role: "mate", side: "us", name: sc.follower.who?.shortName, face: link(sc.follower.who?.face), kit: us });
    sc.teammates.forEach((t, i) => out.push({ id: `mate${i}`, role: "mate", side: "us", name: t.who?.shortName, face: link(t.who?.face), kit: us }));
    [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners].forEach((r, i) =>
      out.push({ id: `run${i}`, role: "mate", side: "us", name: r.who?.shortName, face: link(r.who?.face), kit: us }));
    sc.defenders.forEach((d, i) => out.push({ id: `def${i}`, role: "opp", side: "them", name: d.who?.shortName, face: link(d.who?.face), kit: them }));
    const gk = auto?.side === "them" ? K.ourKeeper : K.keeper;
    out.push({ id: "keeper", role: "keeper", side: auto?.side === "them" ? "us" : "them", name: sc.keeper.who?.shortName, face: link(sc.keeper.who?.face), kit: kitOf(gk) });
    return out;
  }
  private clipFrameFor(sc: Scenario): ClipFrame {
    const b = this.ball;
    const auto = autoKickOf(sc);
    const foot = auto ? takerFootSign(auto.taker.id || auto.taker.name) : footSign(this.setup.career?.player.preferredFoot);
    const you = hasRunup(sc.kind) ? drawnTakerAt(sc.ball, sc.player, foot).at : sc.player;
    const runners = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
    return {
      ball: b ? { x: b.pos.x, y: b.pos.y, z: b.z } : { x: sc.ball.x, y: sc.ball.y, z: 0 },
      bodies: [
        { x: you.x, y: you.y, z: 0 },
        { x: sc.follower.x, y: sc.follower.y, z: 0 },
        ...sc.teammates.map((t) => ({ x: t.x, y: t.y, z: 0 })),
        ...runners.map((r) => ({ x: r.pos.x, y: r.pos.y, z: 0 })),
        ...sc.defenders.map((d) => ({ x: d.x, y: d.y, z: d.z ?? 0 })),
        { x: sc.keeper.x, y: sc.keeper.y, z: 0 },
      ],
      keeper: { dive: sc.keeper.dive, lunge: sc.keeper.saveLunge, dir: sc.keeper.saveDir, kind: sc.keeper.saveKind },
    } as ClipFrame;
  }
  private recordGoalFrame(dt: number) {
    if (!this.clipSink || !this.setup.career) return;
    const rec = this.goalRec ?? (this.goalRec = new GoalRecorder());
    const ph = this.phase, sc = this.sc;
    // Who touched the ball, when (the ball's own log, a moment after the fact).
    const bl = this.ball;
    if (bl && bl !== this.recSeen.ball) this.recSeen = { ball: bl, seq: 0 };
    const live = (ph === "aim" || ph === "runup" || ph === "contact" || ph === "flight" || (ph === "result" && !this.td)) && goalInView(sc.kind);
    if (live || (rec.recordingGoal && this.recScene === sc && leoUpdateOn("bugFixes"))) {
      const bodies = 3 + sc.teammates.length + (sc.runner ? 1 : 0) + sc.secondaryRunners.length + sc.defenders.length;
      if (this.recScene !== sc || rec.bodyIds().length !== bodies) {
        this.recScene = sc;
        rec.begin(this.clipBodiesFor(sc));
      }
      if (bl?.actionLog) {
        for (const a of bl.actionLog) {
          if (a.seq <= this.recSeen.seq) continue;
          this.recSeen.seq = a.seq;
          rec.event(a.kind, a.actor, { mode: a.mode, save: a.save }, Math.max(0, (bl.clock ?? 0) - a.t));
        }
      }
      rec.frame(dt, this.clipFrameFor(sc));
    } else if (rec.recordingGoal) {
      rec.finishNow();
    }
    this.handOutClips();
  }
  private handOutClips() {
    const rec = this.goalRec;
    if (!rec || !this.clipSink) return;
    for (const tr of rec.take()) { try { this.clipSink.onClip(tr); } catch { /* a clip never breaks the match */ } }
  }
  /** The ball has just gone in: the recorder keeps going a moment for the net, then cuts. Returns the clip's id. */
  private markGoalClip(scorer: string, scorerShort: string, isYou: boolean, assist: string | undefined, how: string | undefined, scorerBody?: string): string | undefined {
    const rec = this.goalRec;
    if (!this.clipSink || !rec?.active) return undefined;
    const id = `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const home = this.setup.fixture.home !== false;
    const car = this.setup.career;
    const club = car?.player.club ?? "Home";
    const opp = this.setup.fixture.opponent ?? "Away";
    const weather = this.setup.conditions.weather;
    rec.markGoal({
      id, minute: this.matchMinute, minuteLabel: minuteLabel(this.matchMinute, this.ADDED, this.MATCH_DURATION),
      scorer, scorerShort, isYou, assist, how,
      ...(scorerBody ? { scorerBody } : {}),
      home: home ? club : opp, away: home ? opp : club, youAreHome: home,
      scoreAfter: home ? [this.userScore, this.oppScore] : [this.oppScore, this.userScore],
      competition: this.setup.fixture.competition,
      weather: weather !== "clear" ? weather : undefined,
      season: car?.season, week: car?.week,
      ...(isYou && leoUpdateOn("bigMoments") ? (() => { const late = lateKindOf(this.matchMinute, true, this.userScore, this.oppScore); return late ? { late } : {}; })() : {}),
    });
    return id;
  }

  /** The flight: the ball and everyone, three steps a frame (CanvasMatch's frame loop, flight branch). */
  private stepFlight(dt: number) {
    const fixedStep = realBallOn();
    let steps = 3;
    if (fixedStep) {
      this.physAcc += dt;
      steps = Math.floor(this.physAcc * 180 + 1e-6);
      this.physAcc = Math.max(0, this.physAcc - steps / 180);
    }
    for (let i = 0; i < steps; i++) {
      const sc = this.sc, ball = this.ball!;
      const h = fixedStep ? 1 / 180 : dt / steps;
      stepDefenders(sc, h, ball.pos, false, ball);
      stepKeeper(sc, h);
      stepReactions(sc, ball, h, this.rng);
      stepKind(sc, ball, h, this.strikeRule);
      brainStep(sc, ball, h);
      // Touch Mode (CanvasMatch): you chase your own uncontested touch; catching it earns the second kick.
      const touchLive = this.touchModeOn && this.canExtraTouch
        && ball.owner === "you" && ball.lastTouch !== "keeper" && acceptsCaptainOrders(sc.kind);
      const caughtUp = touchLive && stepTouchChase(sc, ball, h, this.setup.career ? touchChaseSpeed(this.setup.career.skills.pace) : undefined);
      const incoming = { vx: ball.vel.x, vy: ball.vel.y, vz: ball.vz, z: ball.z, spin: ball.spin };
      const mateProbe = probeMatePlays(sc);
      stepKnuckle(ball, h);
      const po = this.playOn;
      if (po && !touchLive) {
        const wasLive = po.layOffLive;
        const caughtIt = stepPlayOn(po, sc, ball, h, this.playOnRng, this.layOffsLeft) === "caught";
        if (caughtIt) { this.playOnCaught = true; this.resolveOutcome("delivered"); break; }
        if (po.layOffLive && !wasLive) {
          this.layOffsLeft -= 1;
          this.pushLine(po.stick?.choice === "through" ? "Through ball, into your run!" : po.stick ? "He plays it back to your feet…" : "He lays it back into your run…");
        }
      }
      let res = stepBall(ball, sc, this.rng, h);
      noteMatePlays(this.matePlays, mateProbe, sc);
      const clr = getClearanceRules();
      const secondLeft = !clr.miscues || (sc.secondBalls ?? 0) < clr.secondBalls;
      if (res === "blocked" && this.deflections < 1 && secondLeft) {
        this.deflections += 1;
        if (clr.miscues) sc.secondBalls = (sc.secondBalls ?? 0) + 1;
        const r = mulberry32(((this.seed ^ Math.imul(this.rngCalls.current + 1, 0x27d4eb2d)) ^ 0xdef1) >>> 0);
        deflectBlock(ball, sc, incoming, r);
        steerDeflectionFromOwnGoal(ball, sc);
        res = null;
        this.showAction("DEFLECTED");
        this.pushLine("Blocked — and it's come off him loose!");
      }
      if (this.feature?.onBallStep) {
        try { this.feature.onBallStep({ x: ball.pos.x, y: ball.pos.y, z: ball.z }); } catch { /* an observer never breaks the match */ }
      }
      // stepBall's own ending wins if it came on the same step (a clearance, the ball going out).
      if (!res && caughtUp) res = "touchOn";
      if (res === "short") clearLooseWin(ball, sc);
      if (res) { this.resolveOutcome(res); break; }
    }
    const ev = this.ball?.event;
    const receiver = this.sc.receiver;
    if (ev === "miscue") { this.pushLine("He's miscued it — it's loose!"); this.showAction("MISCUED"); }
    if (ev === "clearHit") { this.pushLine("Cleared — but it cannons off a body and it's loose!"); this.showAction("DEFLECTED"); }
    if (ev === "post") { if (this.clipSink) this.goalRec?.event("post"); this.pushLine("Off the woodwork — and it's still live!"); this.showAction("POST"); this.postShownAt = this.now; }
    if (ev && receiver) {
      const label = receiver.who?.shortName ?? receiver.roleLabel;
      if (ev === "received") { this.pushLine(commentaryReceived(label, this.rng)); this.showAction(this.passBanner()); }
      else if (ev === "receiverShot") this.pushLine(commentaryReceiverShot(label, this.rng));
      else if (ev === "relay") { this.pushLine(`${label} leaves it — the captain wanted it moved on.`); this.showAction("PASS"); }
    }
    if (this.ball) this.ball.event = null;
  }
  private physAcc = 0;
  private postShownAt = -1e9;

  // ════════════════════════════════════════════════════════════════════════
  //  THE CHANCE IS OVER (CanvasMatch resolveOutcome)
  // ════════════════════════════════════════════════════════════════════════

  private resolveOutcome(res: Outcome) {
    this.outcome = res;
    this.phase = "result";
    { const b = this.ball; this.boot = b?.cleared && !b.inNet ? { t: this.now, stopT: null, then: null } : null; }
    this.receiveGlide = null;
    {
      const b = this.ball, at = this.sc.receivedAt;
      if (res === "delivered" && b && at) {
        const dx = b.pos.x - at.x, dy = b.pos.y - at.y, d = Math.hypot(dx, dy);
        const lead = Math.min(RECEIVE_LEAD_M, d);
        const to = d > 1e-6 ? { x: at.x + (dx / d) * lead, y: at.y + (dy / d) * lead } : { x: at.x, y: at.y };
        this.receiveGlide = { from: { x: b.pos.x, y: b.pos.y }, to, z0: b.z, t0: this.now };
      }
    }
    const sc = this.sc;
    const receiverShot = sc.receiverShot === true;
    const auto = autoKickOf(sc);
    const youShot = !auto && this.ball?.youStruckAtGoal === true && !receiverShot;
    const isSimplePass = !youShot && !receiverShot && sc.passTarget != null;
    const kind = OUTCOME_TEXT[res].kind;

    if (this.feature) {
      try {
        this.feature.onChanceResolved?.({
          outcome: res, kind: sc.kind, youShot, teammateShot: receiverShot,
          ball: this.ball ? { x: this.ball.pos.x, y: this.ball.pos.y, z: this.ball.z } : null,
          ...(auto ? { autoKick: auto.side } : {}),
        });
      } catch { /* an observer never breaks the match */ }
      this.featureAfter(res, kind, auto);
      return;
    }

    const yourFinish: "chip" | "curl" | undefined = (() => {
      if (auto) return undefined;
      if (this.cheekyStrikeKind === "chip") return "chip";
      const log = this.ball?.actionLog ?? [];
      const last = [...log].reverse().find((a) => a.kind === "shot" && a.actor === "you");
      return last?.mode === "curl" ? "curl" : undefined;
    })();
    {
      const ch = this.cheekyStrikeKind;
      this.cheekyStrikeKind = null;
      if (ch && !auto && (sc.kind === "penalty" || youShot) && isCheekyMiss(res)) this.cheekyMisses.push({ kind: ch, minute: this.matchMinute });
    }

    const assist = assistFor(this.matePlays);
    const d = creditChance(res, { youShot, receiverShot, isSimplePass, assistYours: assist.yours });
    // A live shootout kick: report the real outcome to the shootout and stop (CanvasMatch isShootoutKick).
    if (this.shootoutKick) {
      const cb = this.shootoutKick;
      this.shootoutKick = null;
      const scored = kind === "goal";
      if (scored) this.showAction("GOAL");
      else this.showAction(res === "saved" || res === "caught" || res === "tipped" ? "SAVED" : "MISSED");
      this.later(1400, () => cb.resolve(scored));
      this.bump();
      return;
    }
    const t = this.tally;
    if (!auto) {
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
        const z = goalZone(sc.kind, this.strikeAt);
        if (z === "penalty") t.goalsPen += d.goals;
        else if (z === "tapIn") t.goalsTap += d.goals;
        else if (z === "outside") t.goalsOut += d.goals;
      }
      if (d.passesCompleted > 0) {
        const pg = passGrade(sc.passDifficulty, sc.passAmbition);
        if (pg === "safe") t.passesSafe += d.passesCompleted;
        else if (pg === "ambitious") t.passesAmb += d.passesCompleted;
      }
      this.strikeAt = null;
      if (res !== "touchOn") {
        this.logChance(sc.kind, kind === "goal" ? (d.goals > 0 ? "goal" : d.assists > 0 ? "assist" : "pass")
          : res === "delivered" ? "pass" : res === "offside" ? "offside" : receiverShot ? "setup" : youShot ? "miss" : res === "tackled" ? "tackled" : "lost");
      }
    }
    if (!auto && kind === "goal") this.userScore += 1;
    if (!auto) resolveScenario(this.st, this.matchResultFor(res));

    // The caption (CanvasMatch's showAction calls, no sound).
    if (auto && kind !== "goal") this.showAction(res === "saved" || res === "caught" || res === "tipped" ? "SAVED" : "MISSED");
    else if (kind === "goal") this.showAction("GOAL");
    else if (res === "tackled" || res === "blocked") this.showAction(res === "blocked" ? "BLOCKED" : "INTERCEPTED");
    else if (res === "offside") this.showAction("OFFSIDE");
    else if (res === "delivered") this.showAction(this.passBanner());
    else if (res === "touchOn") this.showAction("TOUCH ON");
    else if (res === "out" || res === "wide" || res === "over" || res === "short") this.showAction(res === "wide" ? "WIDE" : res === "over" ? "OVER" : res === "short" ? "NOBODY THERE" : "OUT OF PLAY");
    else if (res === "post") { if (this.now - this.postShownAt > 4000) this.showAction("POST"); }
    else if (res === "saved" || res === "caught") this.showAction("SAVED");
    if (!(this.big && kind !== "goal" && res === "delivered")) this.big = false;

    let commentaryRoleLabel = sc.receiver?.roleLabel;
    if (!auto && kind === "goal") {
      const car = this.setup.career;
      const squad = this.onPitch(car.squad ?? []);
      const playerName = `${car.player.firstName} ${car.player.lastName}`;
      const rng = this.rng;
      const how = res === "rebound" ? "rebound" : sc.kind;
      const distance = Math.hypot(sc.ball.x - (sc.goal.x1 + sc.goal.x2) / 2, sc.ball.y);
      const mateGoal = d.assists === 1 || (receiverShot && !assist.yours);
      if (mateGoal && sc.receiver) {
        const scorer = sc.receiver.who ?? (() => {
          const forwards = squad.filter((p) => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
          return pickSquadScorer(forwards.length > 0 ? forwards : squad, rng) ?? undefined;
        })();
        if (scorer) commentaryRoleLabel = scorer.shortName;
        const scorerLabel = scorer?.shortName ?? sc.receiver.roleLabel ?? "Team-mate";
        const mateAssist = assist.yours ? undefined : assist.by?.who;
        const mateScorer = scorer?.name ?? sc.receiver.roleLabel ?? "Team-mate";
        const mateClip = this.markGoalClip(mateScorer, scorerLabel, false, assist.yours ? playerName : mateAssist?.name, how);
        this.goalEvents.push({
          minute: this.matchMinute, scorer: mateScorer, assist: assist.yours ? playerName : mateAssist?.name,
          isUserGoal: false, how, distance: Math.round(distance),
          ...(mateClip ? { clipId: mateClip } : {}),
          ...(assist.yours && sc.receivedAt ? { passLength: Math.round(Math.hypot(sc.receivedAt.x - sc.ball.x, sc.receivedAt.y - sc.ball.y)) } : {}),
        });
        this.logMoment(`⚽ ${scorerLabel} scores!`, "goal");
        if (assist.yours) this.logMoment(`🎯 ${this.playerLabel()} assists!`, "assist");
        else if (mateAssist) this.logMoment(`🎯 ${mateAssist.shortName} assists!`, "assist");
      } else if (d.goals === 1) {
        const assister = res === "rebound" ? undefined : creatorOf(sc, squad, rng);
        const yourClip = this.markGoalClip(playerName, this.playerLabel(), true, assister?.name, how, "you");
        this.goalEvents.push({
          minute: this.matchMinute, scorer: playerName, assist: assister?.name, isUserGoal: true, how, distance: Math.round(distance),
          ...(yourFinish ? { finish: yourFinish } : {}),
          ...(yourClip ? { clipId: yourClip } : {}),
        });
        this.logMoment(`⚽ ${this.playerLabel()} scores!`, "goal");
        if (assister) this.logMoment(`🎯 ${assister.shortName} assists!`, "assist");
      } else {
        const soloClip = this.markGoalClip(playerName, this.playerLabel(), true, undefined, how, "you");
        this.goalEvents.push({ minute: this.matchMinute, scorer: playerName, isUserGoal: true, how, distance: Math.round(distance), ...(yourFinish ? { finish: yourFinish } : {}), ...(soloClip ? { clipId: soloClip } : {}) });
        this.logMoment(`⚽ ${this.playerLabel()} scores!`, "goal");
      }
    }

    this.pushLine(commentaryResult(res, this.rng, {
      chain: sc.receiver != null, receiverReached: sc.receiverReached === true, roleLabel: commentaryRoleLabel, isPass: isSimplePass,
    }));

    if (auto && auto.context === "match") {
      const saved = res === "saved" || res === "caught" || res === "tipped";
      if (kind === "goal") {
        this.userScore += 1;
        const penClip = this.markGoalClip(auto.taker.name, auto.taker.shortName, false, undefined, "penalty", "you");
        this.goalEvents.push({ minute: this.matchMinute, scorer: auto.taker.name, isUserGoal: false, how: "penalty", distance: 11, ...(penClip ? { clipId: penClip } : {}) });
        this.logMoment(`⚽ ${auto.taker.shortName} scores the penalty!`, "goal");
      } else this.logMoment(`${auto.taker.shortName}'s penalty is ${saved ? "saved" : "missed"}.`, "chance");
      resolveScenario(this.st, kind === "goal" ? "goal" : "saved");
      this.later(1800, () => this.startSimulation());
      return;
    }
    if (auto) { this.later(1600, () => this.loadScenario(false)); return; }

    let quickOn = false;
    if (res === "delivered" && this.playOnCaught) {
      this.playOnCaught = false;
      this.keepRunCam = true;
      const b = this.ball;
      if (b) {
        this.chain = { pos: { x: b.pos.x, y: b.pos.y }, depth: sc.chainDepth ?? 0, ambition: Math.max(sc.passDifficulty, sc.passAmbition ?? 0), touchTouches: sc.touchTouches ?? 0 };
        this.logMoment(`${sc.receivedBy?.who?.shortName ?? "He"} lays it back to ${this.playerLabel()}.`, "chance");
        quickOn = true;
      }
    } else if (res === "delivered") {
      const depth = sc.chainDepth ?? 0;
      const at = sc.receivedAt ?? sc.runner?.pos ?? sc.passTarget;
      const onlyPlay = !goalInView(sc.kind);
      const who = sc.receivedBy?.who?.shortName ?? this.targetName(sc);
      const returnChance = onlyPlay && at ? giveAndGoChance(sc, at) : chainReturnChance(sc);
      if (at && depth < CHAIN_MAX && this.rng() < returnChance) {
        const ambition = Math.max(sc.passDifficulty, sc.passAmbition ?? 0);
        this.chain = { pos: { x: at.x, y: at.y }, depth: depth + 1, ambition };
        this.pushLine(at.y < 25 ? "It comes straight back to you, higher up…" : "He lays it off — the move keeps going…");
        this.logMoment(`${who ?? "He"} plays it back to ${this.playerLabel()}.`, "chance");
        if (newChancesOn() && !goalInView(sc.kind)) {
          const b = this.ball;
          this.carryOn = carryFrom(sc, b ? { x: b.pos.x, y: b.pos.y } : at);
          quickOn = true;
        } else {
          this.later(ACTION_BANNER_MS - 100, () => this.showAction("BACK TO YOU"));
        }
      } else {
        this.logMoment(`${who ?? "He"} keeps it — the move goes on without ${this.playerLabel()}.`, "chance");
        if (newChancesOn() && !goalInView(sc.kind)) this.showAction(this.passBanner());
      }
    } else if (res === "touchOn") {
      // Touch Mode's own chain (CanvasMatch): never a roll, one extra touch (its own budget,
      // TOUCH_CHAIN_MAX), from where the ball rests. chainDepth is carried, not spent.
      const touches = sc.touchTouches ?? 0;
      const b = this.ball;
      if (b && touches < TOUCH_CHAIN_MAX) {
        this.chain = { pos: { x: b.pos.x, y: b.pos.y }, depth: sc.chainDepth ?? 0, ambition: Math.max(0.3, sc.passDifficulty ?? 0), touchTouches: touches + 1 };
      }
    }
    this.attempts += 1;
    if (this.chain) { this.later(quickOn ? 250 : 1600, () => this.loadScenario(true)); return; }
    this.handOver(() => this.startSimulation(), 1800);
    this.bump();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  A FEATURE ON THE MATCH (EngineFeature: the trial's stages, the drills)
  // ════════════════════════════════════════════════════════════════════════

  /** CanvasMatch's ref creation + its mount effect, for a feature's opening picture. */
  private startFeature() {
    const f = this.feature!;
    this.rng = countedRng(this.seed, this.rngCalls);
    const sc = f.openOn();
    enforceHardRules(sc);
    stageScene(sc, f.scene);
    this.sc = sc;
    this.dressFeature(sc, this.rng, (this.setup.seed ^ 0x4b7e) >>> 0);
    this.phase = "aim";
    this.pushLine(commentaryBuildup(sc.kind, this.rng, this.targetName(sc)));
    this.scheduleAutoKick();
    this.bump();
  }
  /** CanvasMatch loadScenario's openOn branch. */
  private loadFeaturePicture(rng: () => number) {
    const f = this.feature!;
    this.strength = f.keeperStrength();
    const sc = f.openOn();
    enforceHardRules(sc);
    this.sc = sc;
    sc.conditions = this.setup.conditions;
    castScenario(sc, this.onPitch([]));
    initDefenders(sc, rng);
    castDefence(sc, this.oppXIForCast);
    stageScene(sc, f.scene);
    this.dressAutoKeeper(sc);
    this.standBackForRunup(sc);
    this.setUpKeeper(sc, (this.seed ^ 0x4b7e) >>> 0);
    this.frameScenario(sc);
    this.resetChanceState();
    this.phase = "aim";
    this.scheduleAutoKick();
    this.bump();
  }
  /** The mount effect's dressing of the opening picture (cast, shape, keeper, frame). */
  private dressFeature(sc: Scenario, rng: () => number, keeperSeed: number) {
    sc.conditions = this.setup.conditions;
    castScenario(sc, this.onPitch([]));
    initDefenders(sc, rng);
    castDefence(sc, this.oppXIForCast);
    this.dressAutoKeeper(sc);
    this.standBackForRunup(sc);
    this.setUpKeeper(sc, keeperSeed);
    this.frameScenario(sc);
  }
  /** CanvasMatch dressAutoKeeper: the keeper an automatic kick names. */
  private dressAutoKeeper(sc: Scenario) {
    const k = autoKickOf(sc)?.keeper;
    if (!k) return;
    sc.keeperStrength = k.strength;
    if (k.name) sc.keeper.who = { id: k.id ?? "gk", name: k.name, shortName: k.shortName ?? k.name, position: "GK", face: k.face };
  }
  /** CanvasMatch scheduleAutoKick: an automatic kick's taker stands over it, then runs up. */
  private scheduleAutoKick() {
    if (!autoKickOf(this.sc)) return;
    this.later(AUTO_STAND_MS, () => {
      if (this.phase !== "aim") return;
      const k = autoKickOf(this.sc);
      if (!k) return;
      const a = aimFor(this.sc, k.plan);
      this.startRunup(a.dir, a.power, { contact: a.contact, skills: takerSkills(k.taker.rating) });
    });
  }
  /** CanvasMatch tryHold: ask the feature whether to freeze here (its teaching card). */
  private tryHold(moment: "runup" | "contact") {
    const ask = this.feature?.holdAt;
    if (!ask) return;
    let done = false;
    const release = () => { if (done) return; done = true; this.held = false; this.bump(); };
    if (ask(moment, release) && !done) { this.held = true; this.bump(); }
  }
  /**
   * The end of resolveOutcome on a feature (no match to credit): the caption,
   * then the next picture (sandbox mode: CanvasMatch stops after six).
   */
  private featureAfter(res: Outcome, kind: string, auto: ReturnType<typeof autoKickOf>) {
    const sc = this.sc;
    const banners = this.feature?.scene?.banners !== false;
    if (banners) {
      if (auto && kind !== "goal") this.showAction(res === "saved" || res === "caught" || res === "tipped" ? "SAVED" : "MISSED");
      else if (kind === "goal") this.showAction("GOAL");
      else if (res === "tackled" || res === "blocked") this.showAction(res === "blocked" ? "BLOCKED" : "INTERCEPTED");
      else if (res === "out" || res === "wide" || res === "over" || res === "short") this.showAction(res === "wide" ? "WIDE" : res === "over" ? "OVER" : res === "short" ? "NOBODY THERE" : "OUT OF PLAY");
      else if (res === "saved" || res === "caught") this.showAction("SAVED");
      else if (res === "post") this.showAction("POST");
    }
    if (kind === "goal" && !auto) this.userScore += 1;
    void sc;
    if (auto) { this.later(1600, () => this.loadScenario(false)); this.bump(); return; }
    this.attempts += 1;
    if (this.attempts >= 6) { this.bump(); return; }
    this.handOver(() => this.loadScenario(false), 1800);
    this.bump();
  }
  /** A feature's cones on the grass this chance (the markers prop). */
  markersNow(): { x: number; y: number; color?: string }[] {
    return this.feature?.markers?.() ?? [];
  }

  /** CanvasMatch handOver: after `ms`, or once a cleared ball has left the picture. */
  private handOver(fn: () => void, ms: number) {
    if (this.boot) { const gen = this.gen; this.boot.then = () => { if (this.gen === gen) fn(); }; }
    else this.later(ms, fn);
  }

  /** Everything the screen needs to know changed since it last looked (cheap to compare). */
  get done() { return this.phase === "done"; }
  /** Picture only: your aerial move on this chance (the figure draws its clip), or null. */
  aerialNow(): { move: AerialMove; e: number; preS: number; struckAt: number | null } | null {
    const a = this.aerial;
    if (!a || a.sc !== this.sc || autoKickOf(this.sc)) return null;
    return { move: a.move, e: a.e, preS: a.preS, struckAt: a.struckAt ?? null };
  }
  /** Debug/parity: the pressed-for-foul and keeper-catch fields are internal; this exposes the match's random-draw count. */
  get rngDrawn() { return this.rngCalls.current; }
}

const SHOT_LINES: Partial<Record<ContactRead["grade"], string>> = {
  knuckle: "No spin on it at all — it's moving all over the place!",
  sliced: "He's sliced it — off the side of the boot!",
  topped: "Topped it! Straight into the turf.",
  scuffed: "Scuffed! He's barely caught it.",
};
void POST_L; void POST_R; void VIEW_ASPECT;
