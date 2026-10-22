"use client";
import { stageScene, type ScenePicture } from "@/lib/star/scenePicture";
import { isSwitchedOff, playableKind } from "@/lib/star/switchedOffKinds";
import { KIB_CANS } from "@/lib/star/shopData";
import { giveAndGoChance } from "@/lib/star/giveAndGo";
import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo, useContext } from "react";
import { EngineFrameContext, keeperFrame, frameHasKeeper, type EngineFrameFigure, type EngineFrameKeeper, type EngineFrameAct, type EngineFrameOrders } from "@/lib/star/engineFrame";
import {
  buildWeightedScenario, buildScenario,
  launch, stepBall, stepBallInNet, settleBall, stepBallPastBar, stepBallCleared,
  stepKeeper, settleJumps, hitboxShapes, stepDefenders, stepReactions, stepTouchChase, touchChaseSpeed, initDefenders, resetForTouchOn,
  chainReturnChance, CHAIN_MAX, TOUCH_CHAIN_MAX, applyFirstTouch, goalInView,
  OUTCOME_TEXT, clamp, dragForFullPower, VIEW_ASPECT,
  orderableRunners, acceptsCaptainOrders,
  curveDirFromSwipe, applyCurveSwipe,
  setOffsideRuleEnabled, setClearanceRules, getClearanceRules,
  type Scenario, type Ball, type Outcome, type KickSkills, type ScenarioKind, type Viewport,
  type Facing, type Runner, type Vec2,
} from "@/lib/star/canvasEngine";
import { leadInEntities, leadInCamera, stakesOf, type LeadIn, type LeadEntity, type LeadMoment } from "@/lib/star/leadIn";
import { fhrOn } from "@/lib/star/fhr/toggle";
import type { RealGoalView } from "@/lib/star/realGoalView";
import {
  newMatch, advanceUntilInvolved, advanceTo, resolveScenario, lateSubQuota, noteServedKind,
  type HiddenMatchState, type RadarTick, type HiddenMatchInputs, type ScenarioRequest, type ScenarioResult, type HiddenMatchEvent,
} from "@/lib/star/hiddenMatch";
import { makeChance, pictureMemory } from "@/lib/star/chanceMaker";
import { separateBodies } from "@/lib/star/spacing";
import { newSelectionMemory } from "@/lib/star/scenarioSelect";
import { warmChanceSpace } from "@/lib/star/chanceFormula";
import { finishServedFrame } from "@/lib/star/goalFrame";
import { pressSpeedFor, PRESS_REACT_S, PRESS_WIN_R, pressFromBehind, foulShareFor, pressStep } from "@/lib/star/pressure";
import { setPieceSkills, type SetPieceDuties } from "@/lib/star/setPieces";
import { conditionsFor, conditionsLine, type Conditions } from "@/lib/star/weather";
import {
  newDribble, stepDribble, flick, dribbleProgress, dribbleViewport, type DribbleState,
} from "@/lib/star/dribble";
import { passBand, pickWaveSizes, duelWaveSizes, newRun as newFpRun, stepRun as stepFpRun, applySteer as fpSteer, applyBurst as fpBurst, applyFeint as fpFeint, applyPass as fpPass, applyStick as fpStick, stickBallLead, wavesBeaten as fpWavesBeaten, carryLead, BURST_T as FP_BURST_T, type FpRunState, type RunPhase as FpRunPhase, type DuelEvent } from "@/lib/star/firstPersonDribble";
import { classifyRelease } from "@/lib/star/dribbleGesture";
import { PASS_RING } from "@/lib/star/firstPersonRender";
import FirstPersonDribble, { type FpDribbleResult } from "./FirstPersonDribble";
import { dribbleReward } from "@/lib/star/dribbleReward";
import { oldBallPhysics, gameplayVersion } from "@/lib/star/gameplayVersion";
import { setHitboxes, hitboxesOn, showHitboxes } from "@/lib/star/hitbox";
import { inTestArea } from "@/lib/star/testArea";
import { setBallPhysics, realBallOn } from "@/lib/star/ballPhysics";
import { getTuning } from "@/lib/star/tuningStore";
import type { FpIdentity } from "@/lib/star/firstPersonDribble";
import {
  PITCH_W, HALF_LEN, CX,
  SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH,
  PEN_SPOT_Y, ARC_R, CENTRE_R, CORNER_R,
} from "@/lib/star/pitch";
import { mulberry32 } from "@/lib/star/season";
import { newChancesOn } from "@/lib/star/newChances";
import { stepPlayOn, carryFrom, carryOnLeadIn, MAX_LAY_OFFS, steerPlayOn, callForIt, callForItShown, runAfterWanted, startPlayOnRun, sprintPlayOn, type PlayOn, type CarryFrom } from "@/lib/star/playOn";
import { pickBarCorner, type BarCorner, type Box as BarBox } from "@/lib/star/barSpot";
import { panToKeep, followStep, widenToHold, easeCam, BACK_EASE_S } from "@/lib/star/runCamera";
import { takeEnergySpent, setLegsEnergy, barCap, moveKeyOf, keysScreenDir, noKeys, KEY_PUSH, type MoveKeys } from "@/lib/star/legs";
import { afterPassStickOn } from "@/lib/star/afterPass";
import { dealDribble, dribbleLevelFor, newDribbleDeal, type DribbleDeal } from "@/lib/star/dribbleDeal";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { deflectBlock } from "@/lib/star/deflection";
import { steerDeflectionFromOwnGoal, clearLooseWin } from "@/lib/star/defenderTouch";
import { footSign, takerFootSign, drawnTakerAt, activeFoot } from "@/lib/star/kickFoot";
import { clearYouSpot } from "@/lib/star/youSpot";
import { matchInputsFor, careerMatchSpec } from "@/lib/star/matchInputs";
import type { PreferredFoot } from "@/lib/star/playerIdentity";
import {
  commentaryBuildup, commentaryStrike, commentaryReceived, commentaryReceiverShot, commentaryResult,
} from "@/lib/star/matchCommentary";
import {
  primeMatchSound, setMatchSoundMuted, playKick, playNet, playPost, playSave, playWhistle, playCrowdSwell,
  playStrike, playThud, playClang, playGlove, playGoalSting, playHeader,
} from "@/lib/star/matchSound";
import { finaliseMatch, liveRating, regressForMinutes, fairRating } from "@/lib/star/matchStats";
import { goalZone, passGrade, missKind } from "@/lib/star/chanceRating";
import { runStretch } from "@/lib/star/stretchRun";
import { hookCheck, subComesOnNow, SUB_OFF_ENERGY, type HookReason } from "@/lib/star/selection";
import type { ChanceEntry, ChanceOutcome } from "@/lib/star/chanceLog";
import { GOAL_LINES, ASSIST_LINES } from "@/lib/star/commentaryExtra";

/** How close to the ball a drag has to start, as a fraction of the framed
 *  height (see onPointerDown). 0.10 until 3 Oct 2026, when Harry: "make the
 *  ball drag start from further away from the centre of the ball because rn
 *  the thumb blocks the ball." 0.18 is about two thumb-widths on a phone, so
 *  you can start BESIDE the ball and still see it; still well short of the
 *  0.28 Mikey turned down on 28 Sep ("start dragging only from the ball").
 *  The pull is measured from where the thumb lands, so starting further out
 *  does not add power. */
const BALL_GRAB_FRACTION = 0.18;

/** A completed pass: how long the ball takes to roll the last bit into the
 *  receiver's feet, and how far in front of his middle it stops. */
const RECEIVE_GLIDE_S = 0.32;
const RECEIVE_LEAD_M = 0.45;

/**
 * How the ball moves on the contact screen for this chance (Mikey, 27 Sep
 * 2026): a header floats across in the air, a volley bounces across, and a
 * ball at your feet bobbles about a third of the time. Dead balls — penalties,
 * free kicks, corners — and passes you play from your feet stay still.
 * Picked from the chance's seed, so it never draws a random number.
 */
/** What the commentator says about a strike that came off the boot badly — or
 *  knuckled (Shots / Knuckleball switches, lib/star/shotModel.ts). */
const SHOT_LINES: Partial<Record<ContactRead["grade"], string>> = {
  knuckle: "No spin on it at all — it's moving all over the place!",
  sliced: "He's sliced it — off the side of the boot!",
  topped: "Topped it! Straight into the turf.",
  scuffed: "Scuffed! He's barely caught it.",
};

/** The strike screen's ball: the airborne test switch's picks when it is on
 *  (lib/star/airborneChance.ts), today's otherwise. */
function strikeMotion(kind: string, seed: number): BallMotion {
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

/** A goal or assist line that varies without drawing a random number (so
 *  nothing else in a seeded match moves): picked by the minute and the name. */
function variedLine(pool: string[], name: string, minute: number): string {
  let h = minute;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length].replace("{name}", name);
}
import { pickSquadScorer, pickSquadAssist } from "@/lib/star/squadData";
import { castScenario, castDefence, creatorOf, orderDefensively, type OpponentSheetPlayer } from "@/lib/star/lineup";
import { formationShapeInput, type ShapeInput } from "@/lib/star/formationShape";
import { loadFaceStyle, DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle, DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import { DEFAULT_FAKE_FACE, FAKE_FACES, fakeFaceFor } from "@/lib/star/fakeFaces";
import {
  figureRForHeight, MATCH_FIGURE_HEIGHT_R, MATCH_FIGURE_R_MULT, MATCH_KEEPER_R_SHARE,
  ROLE_KIT,
  runPhase as sharedRunPhase, poseFor as sharedPoseFor, bodyPoseFor, type FigurePose, FIGURE_HEIGHT_R,
} from "@/lib/star/fiveASide/render";
import {
  penaltyRunupOf, freeKickRunupOf, takerRunupFor, yourRunupFor, standBackFor, planRunup, runupPositionAt, runupPoseAt,
  RUNUP_MOTION, type RunupId, type PenaltyRunupId, type FreeKickRunupId, type StyledRunup, type RunupPose,
} from "@/lib/star/runupStyles";
import { createFaceImageCache, fallbackFaceFor } from "@/lib/star/faceImageCache";
import { airborneOn, airborneMotion, applyAirborne, type StrikeContact } from "@/lib/star/airborneChance";
import { isAirKind, airWaitZ, airZOf, HEADER_Z } from "@/lib/star/airDrawings";
import { useFitWidth } from "./useFitWidth";
import ArcadeBanner, { useArcadeBanner, type BannerSide } from "./ArcadeBanner";
import { bannerStyle, soundSet } from "@/lib/star/style3d/texturePack";
import MikeyPopup, { useMikeyPopup, type PopupGoal } from "./MikeyPopup";
import { mikeyPopupsLook, popupName, useMikeyPopupsLook } from "@/lib/star/mikeyPopups";
import { startingTeammateRoles, onPitchToday, fillMissingFromFullRoster, opponentStartingXI } from "@/lib/star/teamsheet";
import { creditChance, assistFor, noteMatePlays, probeMatePlays, type CreditDelta, type MatePlay } from "@/lib/star/credit";
import { kitsFor, keeperKit, type MatchKits } from "@/lib/star/kits";
import { competitionAbbrev } from "@/lib/star/competitions";
import {
  attachAutoKick, autoKickOf, aimFor, planPenalty, takerSkills, takerRating, yourPenaltyRating,
  shootoutOrder, designatedTaker, clearForShootout, AUTO_STAND_MS,
  type AutoKick, type PenaltyTaker,
} from "@/lib/star/penaltyTaking";
import LiveShootout, { type LiveKick } from "./LiveShootout";
import { shortClub } from "@/lib/star/media/grammar";
import { divisionOf } from "@/lib/star/calendar";
import type { CareerState, MatchStats, Fixture, GoalEvent, OppGoalEvent, SquadPlayer, GoalReplay } from "@/lib/star/types";
import ContactBall, { type BallMotion } from "./ContactBall";
import PowerShotContact from "./PowerShotContact";
import {
  shotsPro, knucklePowerOn, launchShot, shotSeedFor, stepKnuckle, stepWindUp, aimedAtGoal, spreadDeg,
  powerShotStrike, POWER_SHOT_WINDUP_S, POWER_SHOT_CONTACT, type ShotExtras, type ContactRead,
  gradeContact,
} from "@/lib/star/shotModel";
import { shotPowerOn, contactFieldOn, feelPower, feelLift, struckAtGoal, fieldApplies } from "@/lib/star/shotFeel";
import {
  matchFeelOn, feelDials, strikeFeel, squashAt, streakMetres, speedStretch, punchOffset,
  keeperSetHop, keeperDiveArc, feelHaptic, HEADER_FEEL_FLOOR, type StrikeFeel,
} from "@/lib/star/matchFeel";
import { drawImpactBurst, drawDustPuff, drawSpeedStreak, drawGloveSpark, drawClang, drawNetBulge } from "@/lib/star/matchFeelDraw";
import { drawVfx, drawVfxTrail, vfxShake, vfxZoom, vfxDurS, type VfxEvent, type VfxOverride, type VfxRecipe } from "@/lib/star/vfxLab";
import PostMatch from "./PostMatch";
import MatchCommentary from "./MatchCommentary";
import { LiveRadar } from "./MatchRadar";
import { useMatchRadarLook } from "@/lib/star/matchRadarLook";
import { kitLabelOnDark } from "@/lib/star/kits";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { energyFactorFor, energyPerMinute, clampEnergy, tiredKickSkills, fatigueCut, type EnergyMode } from "@/lib/star/energy";
import { aerialOf } from "@/lib/star/aerial";
import type { Playstyle } from "@/lib/star/types";
import { penaltyReadFor, decidePenaltyRead, applyPenaltyRead, type PenaltyReadSettings } from "@/lib/star/penaltyKeeper";
import { setupKind, strikeKind, replayStrike, stepKind, enforceHardRules, type StrikeDecision } from "@/lib/star/kindRules";
import { drawMatchGoal } from "@/lib/star/matchGoal";
import { GoalRecorder } from "@/lib/star/goalClip/recorder";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import type { GoalTrack, ClipBody, FrameState as ClipFrame } from "@/lib/star/goalClip/track";
import { switchOn } from "@/lib/star/compareSwitches";
import { strikingPower } from "@/lib/star/strikePower";
import {
  brainOptionsHere, hasBrain, brainSetup, keeperSaltFor, brainAim, brainRunUp, brainStrike, brainStep, brainSnapshot, brainRestore,
} from "@/lib/star/keeperBrain";
import {
  RUNUP, strikeTimerFor, hasRunup, canNudge, plantBeside, goalLineX, nudgedDir, nudgeFromDrag,
  scuffStrike, cheekyStrike, isCheekyMiss,
  type RunupPath, type CheekyKind,
} from "@/lib/star/penaltyRunup";
import { revealOnScreen, pinnedTopHeight } from "@/lib/revealOnScreen";
import {
  matchView, frameForNewView, crossCutCamera, newViewCanvasHeight, engineFrameOf, turnWideChance,
  NEW_FIGURE_SCALE, NEW_BALL_SCALE, NEW_OUTFIELD_SHRINK, MATCH_VIEW_DEFAULT, figureGrow,
  playZoom, playZoomOf, playZoomProbe,
} from "@/lib/star/matchView";
import { drawMatchFigure } from "@/lib/star/matchFigure";
import {
  animFromAction, outfieldAnimFrame, keeperAnimFrame, keeperLeanWithAnim, STRIKE_S,
  type ActorAnim, type OutfieldAnimFrame,
} from "@/lib/star/actionAnim";
import { animSettings, animFamilyOn, type AnimFamily } from "@/lib/star/animDials";
import { drawContactFlash } from "@/lib/star/actionAnimDraw";
import { keeperBasePose, KEEPER_SAVE_KIND } from "@/lib/star/keeperSaveKinds";
import { hasExtraTime, extraTimeScore, type ExtraTimeCompetition } from "@/lib/star/shootout";
import { currentTie as euroCurrentTie, currentLeg as euroCurrentLeg } from "@/lib/star/euro";
import {
  line as logLine, linesFrom, halfTimeSplit, dwellFor, HALF_TIME_MINUTE,
  type LogLine,
} from "@/lib/star/matchLog";
import { rollAddedTime, addedTimeSeed, minuteLabel } from "@/lib/star/addedTime";
import { liveWeekFor, goalsForFollowed, scoresAt, type LiveGoal } from "@/lib/star/liveScores";
import { followedTeams, toggleFollowedTeam } from "@/lib/star/matchDayPrefs";
import LiveScorePop from "./LiveScorePop";
import LiveScoresPanel from "./LiveScoresPanel";
import FigureSkinToggle from "./FigureSkinToggle";
import type { MatchSpriteHint } from "@/lib/star/matchFigure";
import { spriteKickStrikeT, keeperDiveClip, spriteClipReady, spriteClipFps, spriteClipFrames, warmSpriteKits, type SpriteClip } from "@/lib/star/sprites";
import { outfieldSpriteClip, keeperDiveClipNew, keeperStandingClip, keeperGetUpT, sideOfDive } from "@/lib/star/sprite3dAnim";
import { POST_L, POST_R, GOAL_H as VFX_GOAL_H } from "@/lib/star/pitch";
import { cameraTilt, tiltFor, tiltCss, screenToCanvas, canvasToScreen, type Tilt } from "@/lib/star/cameraTilt";

/** The net's drawn depth from the side, metres: a real goal's ~2 m. */
const SIDE_NET_DEPTH = 2.0;
/** B14b: the stamina bar in its corner (lib/star/barSpot.ts BAR_INSET = 8 px; 36 px down at the top while the added-time badge is up). */
const barCornerStyle = (c: "bl" | "br" | "tl" | "tr", addedUp: boolean): React.CSSProperties => ({
  ...(c === "bl" || c === "tl" ? { left: 8 } : { right: 8 }),
  ...(c === "tl" || c === "tr" ? { top: addedUp ? 36 : 8 } : { bottom: 8 }),
});
import { showYouFigure, matchBallLook, useMatchPlayersLook, matchPlayersLook } from "@/lib/star/newLook";
import { drawMatchBall } from "@/lib/star/matchBall";
import { setMusicScene, clearMusicScene, setMusicMuted, playTurningPoint, isTurningPoint } from "@/lib/star/gameMusic";

/**
 * `feed` is the commentary screen, and it is where a match LIVES — see
 * lib/star/matchLog. The pitch phases are what it cuts away to. It used to be
 * called `sim` and was a panel that appeared over the pitch to report minutes
 * you had already skipped past.
 */
/**
 * `runup` is the run-up to a penalty or a direct free kick
 * (lib/star/penaltyRunup.ts): between letting go of the aim and the strike
 * screen, you jog to the ball. On a penalty you may swing your aim and the
 * keeper may hop (the keeper brain's `brainRunUp`).
 */
type Phase = "aim" | "runup" | "contact" | "flight" | "result" | "feed" | "postmatch" | "dribble" | "fpDribble" | "tdDribble" | "shootout";

/**
 * WHICH DRIBBLE SCENARIO REAL MATCHES USE.
 *
 * Replaced directly, with the explicit condition that the old one stays
 * fully intact and reachable, not deleted — "I want you to have the
 * dribbling scenario as it currently was... so that we cannot lose it and
 * we can go back to it at some point if we need to." Every line of the old
 * system is still here and still works: `lib/star/dribble.ts`, `dribbleRef`,
 * `finishDribble`, the `"dribble"` phase's own draw()/pointer-handling code
 * below, all untouched. This flag is the entire difference between the two
 * — flip it back to `false` and the old top-down flick-to-run scenario is
 * exactly what real matches use again, with nothing else to restore.
 *
 * See CLAUDE.md's "Recent Session" note for the full writeup of what the
 * old system was and why the new one (the first-person duel mode built and
 * tuned in `/star-dribble-dev`) replaced it.
 */
const USE_FIRST_PERSON_DRIBBLE = true;

// Match runs from minute 0 to 90 by default. Chances are distributed
// organically — no fixed session length. The number of chances depends on
// player/team quality. Phase 4 of STAR_POWER_POLITICS.md's match-length
// rule (ruleBook.ts) can change the actual figure per career — see the
// local `MATCH_DURATION` shadow inside the component, which reads it off
// `career.ruleBook`'s FA entry when a real career is attached.
const DEFAULT_MATCH_DURATION = 90;
/** A club's name short enough for the live radar's corner labels. */
const radarShort = (club: string) => {
  const n = CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
  return n.length > 12 ? n.slice(0, 11) + "…" : n;
};

// The figures' anatomy, their height and the keeper's lean cap all live in
// lib/star/fiveASide/render.ts, which is the one place this game draws a
// footballer — see MATCH_FIGURE_HEIGHT_R there for what they mean and why.

interface Props {
  skills?: KickSkills;
  /** Curve boots equipped, with matches left — see Boot.curve. Lets you
   *  swipe the screen during flight to bend/lift/dip a shot already struck. */
  canCurve?: boolean;
  /** Touch Mode boots equipped, with matches left — see Boot.extraTouch.
   *  Shows an in-match toggle: with it on, a settled, still-uncontested
   *  touch of your own chains into a fresh aim/kick instead of ending the
   *  passage of play. */
  canExtraTouch?: boolean;
  /**
   * The minute you come on. 0 when you start. Anything else means the match has
   * already been going on without you, and the score you inherit is one your
   * team-mates earned.
   */
  startMinute?: number;
  /** Which dead balls are yours to take. Ones that are not go to someone else. */
  duties?: SetPieceDuties;
  /** The surface and the air. Absent is a perfect pitch in still air. */
  conditions?: Conditions;
  keeperStrength?: number;
  position?: string;
  teamRelationship?: number;
  career?: CareerState | null;
  seed?: number;
  // Career-match mode: when a fixture + onComplete are supplied, this runs a real
  // match — it tallies the scoreline, simulates the opponent between chances, and
  // hands finaliseMatch()'s MatchStats back to the career flow instead of showing
  // its own post-match summary. Without them it's the standalone sandbox.
  fixture?: Fixture;
  oppStrength?: number;
  onComplete?: (stats: MatchStats) => void;
  /**
   * Watch a previously-saved goal happen again, exactly as it did — see
   * GoalReplay and lib/star/season's mulberry32. When set, this ignores
   * `fixture`/`onComplete` entirely (sandbox rules: no hidden match, no
   * career crediting, no auto-advance to a new chance once it resolves) and
   * jumps straight from mount to the saved strike, skipping aim and contact.
   */
  replayOf?: GoalReplay;
  /**
   * PLAY ONE PARTICULAR PICTURE (the Scenario Gallery / Infinite Highlights
   * "Play" button).
   *
   * A factory rather than a value: it is called for every chance that is not
   * a continuation of a move, so striking the ball, seeing it out, and going
   * again puts you back on the SAME picture rather than a random one — which
   * is what makes it useful for judging a scenario rather than a match.
   * Passing it into a move you started (a lay-off, a touch-mode re-touch)
   * still chains normally, because those are the same move continuing.
   *
   * Additive and fully reversible: absent, nothing about this component
   * changes. Nothing in canvasEngine.ts is touched.
   */
  openOn?: () => Scenario;
  /**
   * A LEAD-IN before the opening chance (the Real shots test page: the real
   * passes before a real shot). Called once, with the opening chance as the
   * match has set it up; what it returns is played as a REPLAY of recorded
   * positions in this picture (and so in the 3D view reading its frames):
   * the people and the ball are put where it says, nothing is stepped, no
   * touch is taken. It ends with everyone exactly where the chance has them,
   * and the chance starts. Absent: nothing changes.
   * lib/star/leadIn.ts.
   *
   * With `openOn` (one picture) it is asked once, for the opening chance. Without
   * it (the career's build-ups, lib/star/leadInGen.ts) it is asked for every
   * chance the match serves, with the moment the chance came from; null = none.
   */
  leadIn?: (sc: Scenario, moment?: LeadMoment) => LeadIn | null;
  /**
   * TEST PAGES ONLY (/star-dribble-stick-dev): how you move on the top-down
   * dribble run. "swipe" (absent) = the game's own, unchanged. "stick" = a
   * floating stick under the left thumb steers your speed and way
   * (firstPersonDribble.ts "THE STICK"); on the right a tap on a team-mate
   * passes and a sideways swipe knocks it past. Same men, tackle and passes.
   */
  dribbleControl?: "swipe" | "stick";
  /** TEST PAGES ONLY: every chance the match hands you is a dribble run. */
  dribbleOnly?: boolean;
  /**
   * TEST PAGES ONLY (/star-vfx-lab-dev, Leo 15 Oct 2026): the picture to draw
   * for each moment (a kick, a save, the net...) instead of Match feel's — a
   * recipe from lib/star/vfxLab.ts. Drawing, camera shake and a short freeze
   * only: nothing here is read by the ball, the keeper or the outcome.
   * Absent (the career match): exactly as before.
   */
  vfxOverride?: VfxOverride;
  /**
   * Strip the match furniture — the scoreboard plate, the live commentary
   * ticker and the situation hint — leaving the pitch and nothing else.
   *
   * For the Scenario Gallery / Infinite Highlights, where the canvas sits
   * INSIDE a card that already has its own controls under it. Reported
   * directly: "forget the commentator stuff at the bottom, just keep the
   * original ui". None of it says anything about a scenario you are judging,
   * and a goals-and-assists tally is actively misleading in a practice
   * screen that counts nothing.
   */
  bare?: boolean;
  /**
   * Fired once, right when a personal goal (not a team-mate's) is confirmed
   * — everything needed to watch this exact goal again, bit-for-bit. Never
   * fired while replaying one (`replayOf` set): re-watching a replay is not
   * itself a new goal to capture.
   */
  onGoalScored?: (replay: GoalReplay) => void;
  /**
   * GOAL VIDEOS (Leo, 7 Oct 2026): every goal your side scores in a chance
   * you watch — yours or a team-mate's — recorded frame by frame as it is
   * drawn, and handed out once its last moments (the ball in the net) are in.
   * A replay draws these positions back; nothing is simulated again, so the
   * same goal is the same video every time (lib/star/goalClip/). Absent: the
   * recorder never runs and nothing about the match changes.
   */
  onGoalClip?: (track: GoalTrack) => void;
  /**
   * Fired once per chance the match hands you, the instant the picture is
   * settled and before you are asked to aim at it.
   *
   * Purely an OBSERVER — nothing here reads it back, and a caller that does
   * not pass it changes nothing. It exists because there was no way at all
   * to find out what a real match actually serves: a match's chance kinds
   * were decided in `loadScenario` and never left it, so "I've played five
   * games and seen ZERO one-on-ones" could not be checked against anything.
   * See /star-play-dev's Infinite Match, which is the one caller.
   *
   * A dribble has no `ScenarioKind` at all — it is its own phase — so it is
   * reported as the string "dribble" rather than left out, which would make
   * the tally silently not add up to the chances played.
   */
  onChanceServed?: (info: {
    kind: ScenarioKind | "dribble"; minute: number; reason?: string;
    /** A copy of the chance as it stands before you strike it — for a screen
     *  that lets you edit the chance you are playing (Infinite Match). Never
     *  the live object: the match goes on mutating its own. Absent for a
     *  dribble, which has no picture. */
    scenario?: Scenario;
  }) => void;
  /**
   * Never take you off, whatever the match thinks.
   *
   * `hookCheck` can end your afternoon from minute 60 on — bad form, tired
   * legs, or a game already won. That is right for a career and fatal for a
   * tool whose whole job is to play thousands of minutes and see what comes
   * up: a 10,000-minute match was measured ending around minute 75.
   *
   * Opt-in and off by default, so a real career is untouched.
   */
  neverHooked?: boolean;
  /**
   * ── TEST-AREA DIALS (see lib/star/engineProfile.ts) ──
   *
   * Each one is a guardrailed override a test screen may pass to ITS OWN
   * mount of the engine. The real career match never passes any of them, so
   * absent they change nothing — which is what keeps a dial inside the test
   * area: "adapting that gameplay should only happen inside the test area
   * and not uniformly."
   */
  /** Use `keeperStrength` even when the opposition's real starting keeper is
   *  known (the Play Area's Keeper slider with "Real keeper" off). */
  forceKeeperStrength?: boolean;
  /** Fresh legs every this-many minutes — for a test match that runs for
   *  thousands, so energy behaves as it would across a run of real matches
   *  rather than draining once and never coming back. */
  fatigueResetEvery?: number;
  /**
   * Fired once per chance, the moment it resolves — the engine's own outcome
   * and what the ball did. The hook a feature built ON TOP of the engine
   * (a drill, a trial stage, a test tool) reads instead of running its own
   * copy of the match loop. Purely an observer: nothing here reads it back.
   */
  onChanceResolved?: (info: ChanceResolved) => void;
  /**
   * A penalty keeper who reads you better (or worse) than a real match's —
   * the trial's difficulty dial. Replaces fields of the real game's default
   * read (lib/star/penaltyKeeper.ts). The real career match never passes it.
   */
  penaltyRead?: Partial<PenaltyReadSettings>;
  /**
   * The set-piece (free kick) rating to strike penalties and free kicks with
   * when there is no career to read it from — the trial's "invisible stat",
   * so a trial free kick is struck the way the same player would strike one
   * in a match. A career's own rating always wins.
   */
  setPieceSkill?: number;
  /**
   * EXTRAS ON TOP — for a feature built around the engine (a training drill).
   * `markers`: cones drawn on the pitch, in pitch metres. Decoration only:
   * nothing in the engine reads them, so the football is untouched.
   */
  markers?: { x: number; y: number; color?: string }[];
  /** Observer: the ball's position, once per physics step while it flies —
   *  so a drill can judge "did it go through the gate" off the real flight. */
  onBallStep?: (ball: { x: number; y: number; z: number }) => void;
  /**
   * REAL GOALS TEST PAGE ONLY (/star-real-goals-dev; Leo, 18 Oct 2026: "make
   * the teams and players actually accurate ... rn its always city vs
   * brighton", and his dad's "ghost thing like mariokart"). The real match's
   * sides and names instead of the test club's, and the real goal's ball as a
   * ghost on the grass. Drawing and labels only: nothing here is read by the
   * ball, the keeper or an outcome. Absent: exactly as before.
   */
  realGoal?: RealGoalView;
  /**
   * Read a drag against a canvas THIS many CSS pixels tall, instead of this
   * canvas's own height. A drag is a fraction of the canvas height, so the
   * same finger movement kicks softer on a bigger canvas; a test screen that
   * draws the match bigger than a career's passes the real match's own
   * canvas height here, and the same finger movement kicks exactly as hard.
   * The real career match never passes it (its canvas IS the reference).
   */
  dragReferenceHeightPx?: number;
  /**
   * What is on the pitch, for a feature that only needs the mechanics.
   * Asked for by Harry (24 Sep 2026): "different modes and training/trials
   * will be COMPLETELY looking different... technique training does not need
   * a goalie/goal yet in every drill there's a keeper... we literally just need
   * the mechanics." The ball, the kick, the contact and the flight are always
   * the real match's; this only takes things OFF the pitch. Every field
   * defaults to on, and the real career match never passes it.
   */
  scene?: ScenePicture;
  /**
   * v0.15 item 22: how hard the nearest opponent closes you down
   * while you pull back, 0 (never) to 1 (Premier League). The real match
   * passes its division (lib/star/pressure.ts); the Play Area passes its dial.
   */
  pressure?: number;
  /**
   * How YOU run up to a penalty, and to a direct free kick — two separate sets
   * (lib/star/runupStyles.ts): the career's equipped ones, or the Play Area's
   * dials. Looks only: the kick is the same. A team-mate's or an opponent's
   * kick uses his own style from the right set (takerRunupFor). Absent: each
   * set's Standard.
   */
  penaltyRunup?: PenaltyRunupId;
  freeKickRunup?: FreeKickRunupId;
  /**
   * The foot you kick with (v0.25 item 4) — looks only: which leg swings,
   * and on a penalty or direct free kick which side of the ball you run up
   * from. Absent: the career's foot, else the star page's (kickFoot.ts),
   * else right.
   */
  preferredFoot?: PreferredFoot;
  /**
   * A feature's teaching pause (the trial's free kick, 2 Oct 2026): called the
   * moment YOUR run-up starts and the moment the strike screen opens. Return
   * true to freeze the match right there — nobody moves, the strike screen's
   * clock does not start — until the feature calls `release()`. Absent (the
   * real match): never called, nothing is ever held.
   */
  holdAt?: (moment: "runup" | "contact", release: () => void) => boolean;
  /**
   * THE FAREWELL MATCH (Leo, 6 Oct 2026) — one last game after the final
   * whistle of a career, played on a stand-in career (lib/star/farewell.ts)
   * and credited to nothing. With it:
   *   - nearly every chance your side works is yours (the hidden match's
   *     `farewell`), and every set piece (the caller's `duties`);
   *   - energy never drains, and the energy panel is not shown;
   *   - nobody takes you off for form or legs; at `offAt` you come off to a
   *     standing ovation (a banner over the match) and it plays out to full
   *     time without you;
   *   - no other scores, and the plate reads "Farewell".
   * Absent — every real match — nothing here changes.
   */
  farewell?: { offAt: number; onOvation?: (minute: number) => void };
  /**
   * A planned change (international friendlies, Mikey 12 Oct 2026): you start
   * and the manager takes you off at this minute to look at other players.
   * The ordinary substitution rules still apply before it.
   */
  plannedOffAt?: number;
}


/** What `onChanceResolved` reports. */
export interface ChanceResolved {
  outcome: Outcome;
  kind: ScenarioKind;
  /** You struck it at goal (not a pass, not a team-mate's finish). */
  youShot: boolean;
  /** A team-mate struck it after you — a finish that is his, not yours. */
  teammateShot: boolean;
  /** Where the ball was when it resolved, in pitch metres; z is its height. */
  ball: { x: number; y: number; z: number } | null;
  /** Set when the match struck it for somebody else (a team-mate's or an
   *  opponent's penalty — see lib/star/penaltyTaking.ts). */
  autoKick?: "us" | "them";
  /** The move ended in its build-up (a called offside, Full highlights
   *  rebuild): no kick was taken and nothing is yours. */
  buildUp?: boolean;
}

// Only the fields finaliseMatch reads — lets the standalone sandbox produce a
// summary via the same canonical scorer without a real career loaded (all cash
// figures come out 0 rather than fabricated).
const FALLBACK_CAREER = {
  contract: { wage: 0, goalBonus: 0, assistBonus: 0 },
  relationships: { sponsors: 0 },
} as unknown as CareerState;

/**
 * The shortest drag that counts as aiming at all, as a fraction of the canvas
 * height. About a thumb's width of slop — below it, you pressed the ball and
 * your finger moved, which is not a shot.
 *
 * Production's old 0.04 was the real reason a light touch needed ~20% power
 * to register at all — powerFromDrag divides this by dragForFullPower
 * (0.12-0.18), so 0.04 alone already forced a floor of roughly 22-33% power
 * before the 0.12 power check further down even ran. Reported directly.
 * Dropped to a genuine mis-tap-sized floor instead.
 */
const MIN_PULL = 0.008;

/**
 * The shortest pull off a team-mate that counts as pointing him somewhere,
 * in METRES on the pitch rather than as a fraction of the screen.
 *
 * Metres because this gesture means a distance on the grass — three metres is
 * a step, and sending a man three metres is not a run. Below it the touch is
 * read as a tap, which is the other order entirely.
 */
const CAPTAIN_DRAG_MIN = 3.0;

/**
 * The shortest swipe, in screen pixels, that counts as a curve-boot
 * correction rather than an idle finger resting on the glass while the shot
 * flies. Pixels rather than a pitch distance or a fraction of canvas height
 * — same reasoning as CAPTAIN_DRAG_MIN, just for a gesture read in screen
 * space instead of world space.
 */
const CURVE_SWIPE_MIN_PX = 16;

// --- Knowitball match identity: "night match under floodlights" ---
// Deep cool pitch greens + floodlight wash, near-black glass chrome, gold accent.
const C = {
  // Sampled off the reference: rgb(31,144,6). See the pitch block in render().
  pitch: "#1f9006",
  // Sampled off the reference too: its markings come back at rgb(224,255,217)
  // at their brightest — near enough solid white, with a green cast that is the
  // grass bleeding through the compression. Ours were at 0.55 alpha, which lands
  // at rgb(154,204,137): a pale grey-green, and the reason the pitch read as a
  // diagram rather than as a painted field.
  line: "rgba(255,255,250,0.85)",
  lineFaint: "rgba(255,255,250,0.5)",
  // New view: thin lines read better a touch brighter.
  lineNew: "rgba(255,255,255,0.92)",
  // you/youRim/mate/mateRim/opp/oppRim/gk/gkRim: the shared ROLE_KIT
  // (lib/star/fiveASide/render.ts) — one source now, not a fourth
  // independently-typed copy of the same numbers. See that constant's own
  // doc for why this mattered: the trial had quietly drifted off these.
  ...ROLE_KIT,
  gold: "#fbbf24",
  goldSoft: "#fde68a",
};

// What the situation is, shown to the player so it reads clearly before they aim.
const SCENARIO_LABEL: Record<ScenarioKind, { verb: string; hint: string }> = {
  one_on_one: { verb: "1-ON-1!", hint: "Clean through on goal — pick your finish." },
  tight_angle: { verb: "TIGHT ANGLE!", hint: "Acute angle — the keeper's covering the near post." },
  long_range: { verb: "SHOOT!", hint: "Long way out — give it some pace." },
  volley: { verb: "VOLLEY!", hint: "Meet it first time — drag back to strike." },
  header: { verb: "HEADER!", hint: "Get up and meet the cross." },
  cutback: { verb: "CUTBACK!", hint: "Square it back — find the man arriving." },
  byline_cross: { verb: "CROSS IT!", hint: "Whip it in — pick out a man in the middle." },
  through_ball: { verb: "THROUGH BALL!", hint: "Split the line — find the man on the last shoulder." },
  midfield_pass: { verb: "PASS!", hint: "Keep it simple — find your teammate." },
  penalty: { verb: "PENALTY!", hint: "12 yards out — pick your spot." },
  free_kick: { verb: "FREE KICK!", hint: "Bend it over the wall." },
  corner: { verb: "CORNER!", hint: "Deliver it into the box for the header." },
  buildup: { verb: "BUILD UP!", hint: "Find a teammate — forward passes may win you the ball back." },
};

interface Particle {
  x: number; y: number;       // pitch units
  vx: number; vy: number;     // pitch units/sec
  rot: number; vrot: number;
  life: number; maxLife: number;
  size: number;               // pitch units
  color: string;
}

// Draws the pitch, entities and ball to a canvas. Physics runs in an rAF loop.
// The frame never moves — see "There is no camera" in the loop below.

/**
 * A tile of grass grain.
 *
 * Deliberately almost invisible: the reference's grass spans about eight
 * luminance levels from p5 to p95, so this is ±4 either side of nothing. It is
 * there to stop the pitch reading as flat paint, not to be seen.
 */
const GRASS_TILE = 96;

function makeGrassTile(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = GRASS_TILE; c.height = GRASS_TILE;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(GRASS_TILE, GRASS_TILE);
  // A fixed pattern rather than Math.random, so the grain is the same every
  // session and never shimmers between one frame and the next.
  let seed = 0x2f6f2b;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 16) & 0xff) / 255;          // 0..1
    const light = n > 0.5;
    img.data[i] = light ? 255 : 0;
    img.data[i + 1] = light ? 255 : 0;
    img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = Math.round(Math.abs(n - 0.5) * 2 * 16);   // ≤ 16/255
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * THE NEW VIEW'S GRASS (option D, Harry 3 Oct 2026): a soft two-tone checker
 * mow — big squares turned 45° (diamonds), two close greens — the classic
 * grain over it, and a soft vignette at the screen's edges. Pinned to PITCH
 * space through `P`, so it turns with a side-on frame and sits still between
 * chances. Painted once per frame and size into a cache (CanvasMatch's
 * mowRef), never per animation frame.
 */
const MOW_SQUARE_M = 6.4;                 // side of one square of the mow
const MOW_BASE = "#22920b";
const MOW_LIGHT = "rgba(150,230,90,0.085)"; // the lighter pass, laid over the base
function drawMowedPitch(
  g: CanvasRenderingContext2D, W: number, H: number,
  P: (x: number, y: number) => { px: number; py: number },
  unit: number, grain: HTMLCanvasElement | null,
) {
  g.fillStyle = MOW_BASE;
  g.fillRect(0, 0, W, H);

  // The visible pitch rectangle, from the four screen corners.
  // Diamond lattice: u = (x + y) / s, v = (x - y) / s, every cell with an odd
  // (u + v) gets the lighter pass. Only the cells near the screen are drawn.
  const s = MOW_SQUARE_M * Math.SQRT2 / 2;     // half-diagonal steps
  const pxPerM = unit;
  const spanM = Math.hypot(W, H) / Math.max(1e-6, pxPerM);
  // Centre of the screen in pitch space: invert P on two axes by sampling.
  const o = P(0, 0), ex = P(1, 0), ey = P(0, 1);
  const ax = { x: ex.px - o.px, y: ex.py - o.py }, ay = { x: ey.px - o.px, y: ey.py - o.py };
  const det = ax.x * ay.y - ax.y * ay.x || 1;
  const toPitch = (sx: number, sy: number) => {
    const dx = sx - o.px, dy = sy - o.py;
    return { x: (dx * ay.y - dy * ay.x) / det, y: (ax.x * dy - ax.y * dx) / det };
  };
  const c = toPitch(W / 2, H / 2);
  const reach = spanM / 2 + MOW_SQUARE_M * 2;
  const u0 = Math.floor((c.x + c.y - reach * 1.5) / (2 * s)), u1 = Math.ceil((c.x + c.y + reach * 1.5) / (2 * s));
  const v0 = Math.floor((c.x - c.y - reach * 1.5) / (2 * s)), v1 = Math.ceil((c.x - c.y + reach * 1.5) / (2 * s));
  g.fillStyle = MOW_LIGHT;
  g.beginPath();
  for (let u = u0; u <= u1; u++) {
    for (let v = v0; v <= v1; v++) {
      if (((u + v) & 1) === 0) continue;
      // Cell centre in pitch space (x + y = (2u+1)s, x - y = (2v+1)s).
      const su = (2 * u + 1) * s, sv = (2 * v + 1) * s;
      const cx = (su + sv) / 2, cy = (su - sv) / 2;
      if (Math.abs(cx - c.x) > reach || Math.abs(cy - c.y) > reach) continue;
      const a = P(cx - s, cy), b = P(cx, cy - s), d = P(cx + s, cy), e = P(cx, cy + s);
      g.moveTo(a.px, a.py); g.lineTo(b.px, b.py); g.lineTo(d.px, d.py); g.lineTo(e.px, e.py); g.closePath();
    }
  }
  g.fill();

  // The grain, pinned to pitch space like the classic grass.
  if (grain) {
    const pat = g.createPattern(grain, "repeat");
    if (pat) {
      g.save();
      g.translate(o.px % GRASS_TILE, o.py % GRASS_TILE);
      g.fillStyle = pat;
      g.fillRect(-GRASS_TILE, -GRASS_TILE, W + GRASS_TILE * 2, H + GRASS_TILE * 2);
      g.restore();
    }
  }

  // A soft vignette: the edges of the SCREEN a little darker.
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.56);
  vg.addColorStop(0, "rgba(0,20,0,0)");
  vg.addColorStop(1, "rgba(0,20,0,0.26)");
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
}

/**
 * A fresh rng from `seed`, wrapped to count its own draws into `counter` —
 * see rngCallCountRef's own comment on why the count matters. `counter` is
 * reset to 0 here, at the moment this rng is created, so it always reads
 * "draws since THIS scenario's rng started" rather than accumulating
 * forever across a whole match.
 */
function countedRng(seed: number, counter: { current: number }): () => number {
  const raw = mulberry32(seed);
  counter.current = 0;
  return () => { counter.current++; return raw(); };
}

/** useLayoutEffect in the browser, useEffect on the server (no warning). */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** How long the old "PASS" / "GOAL" banner stays up, and when BACK TO YOU follows a PASS (ms).
 *  The Arcade pack's PASS is up 0.7 s (ArcadeBanner.tsx), so its BACK TO YOU pops fresh. */
const ACTION_BANNER_MS = 1000;
/** Seconds the kicking pose is held so the swing is actually visible. */
const KICK_POSE_S = 0.28;
/** B20 (C1): the most a lead-in's replay clock moves in one frame (s): real time down to 4 fps. */
const LEAD_REPLAY_MAX_DT = 0.25;

/** A deep copy of a scenario for a caller to keep — plain data throughout. */
function snapshotScenario(sc: Scenario): Scenario | undefined {
  try { return structuredClone(sc); } catch { return undefined; }
}

/** The latest minute Play may jump straight to (the v0.25 quick start).
 *  Most first chances come by 7' (measured); a later one is read out. */
const QUICK_START_MAX = 12;

export default function CanvasMatch({ skills = { power: 55, technique: 55 }, canCurve = false, canExtraTouch = false, keeperStrength = 62, position = "ST", teamRelationship = 60, career = null, seed = 12345, fixture, oppStrength, onComplete, startMinute = 0, duties, conditions, replayOf, onGoalScored, onGoalClip, onChanceServed, neverHooked = false, openOn, bare = false, forceKeeperStrength = false, fatigueResetEvery, onChanceResolved, penaltyRead, setPieceSkill, markers, onBallStep, dragReferenceHeightPx, scene, pressure = 0, penaltyRunup, freeKickRunup, holdAt, preferredFoot, farewell, plannedOffAt, leadIn, dribbleControl, dribbleOnly = false, vfxOverride, realGoal }: Props) {
  // Phase 4 of STAR_POWER_POLITICS.md's match-length rule — see this file's
  // own note by DEFAULT_MATCH_DURATION. Deliberately scoped: this changes
  // when the match ends and how fast in-match energy drains, NOT
  // matchLog.ts's own commentary-density pacing, which stays tuned for 90
  // minutes regardless (see ruleBook.ts's header for the honest reasoning).
  const MATCH_DURATION = career ? ruleBookFor(career, "FA").matchLengthMinutes : DEFAULT_MATCH_DURATION;

  // Phase 6's offside toggle (§4.4 #1) — see canvasEngine.ts's own note on
  // why this is a module-level setting rather than threaded through every
  // scenario-building call: set once per mount of a real match, read by
  // every offside judgement canvasEngine.ts makes for the rest of it.
  useEffect(() => {
    setOffsideRuleEnabled(!(career ? ruleBookFor(career, "FA").offsideAbolished : false));
  }, [career]);

  // ── Clearances (Mikey, 7 Oct 2026) ──
  // The boot's size from the tuning dials, and miscues / body hits / the live
  // second ball only when Settings → Look → Gameplay → Clearances is New.
  // Read again at every chance (loadScenario), so flipping it takes effect on
  // the next one. See canvasEngine.ts's ClearanceRules.
  const applyClearanceRules = () => {
    setClearanceRules({
      speedMin: getTuning("clearance.speedMin"),
      speedMax: getTuning("clearance.speedMax"),
      maxAngleDeg: getTuning("clearance.maxAngle"),
      miscues: true, // Clearances: always on (decided 12 Oct 2026)
      miscueWeak: getTuning("clearance.miscueWeak"),
      miscueStrong: getTuning("clearance.miscueStrong"),
      bodyLen: getTuning("clearance.bodyLen"),
      bodyWidth: getTuning("clearance.bodyWidth"),
      secondBalls: Math.round(getTuning("clearance.secondBalls")),
    });
    // Ball physics New | Old (lib/star/ballPhysics.ts), read at every chance too.
    setBallPhysics(oldBallPhysics() ? "old" : "new");
    // Hitboxes & jumping New | Old (lib/star/hitbox.ts), read at every chance too.
    setHitboxes(gameplayVersion("hitboxes"));
  };
  useEffect(() => { applyClearanceRules(); }, []);

  // ── Who else is actually out there ──
  //
  // A goal your side scores while you are not on the ball has always needed a
  // name — see the note above `goalEventsRef.current.push` for the version of
  // this bug that meant nobody had one. The version that replaced it was worse
  // in a quieter way: the name it gave was drawn from the WHOLE squad, so a
  // sub who was an unused substitute — or never made the eighteen at all —
  // could be credited with a goal in a match he did not play in. See
  // lib/star/teamsheet.ts — this is the same eleven the pre-match team sheet
  // showed, and every place that puts a name to a team-mate's goal reads from
  // it instead of from the full squad list.
  // Worked out once per career/fixture, not on every render: each call reads
  // the saved line-ups from localStorage (JSON.parse) and builds both team
  // sheets, and the match re-renders on every phase change — the kick
  // included (speed pass, 12 Oct 2026). Same values: both are pure in
  // (career, fixture).
  const startingXI = useMemo(() => (career && fixture ? startingTeammateRoles(career, fixture) : null), [career, fixture]);
  const onPitch = (squad: SquadPlayer[]): SquadPlayer[] =>
    onPitchToday(fillMissingFromFullRoster(squad, startingXI, career ?? null), startingXI);
  // The other lot's actual starting XI — see opponentStartingXI's own note.
  // Null (not an empty array) when there's nothing to scout, same as
  // `startingXI`, so the opponent-goal branch below can tell "nobody to
  // draw from" apart from "a real XI with, say, no listed CAM this week".
  const oppXI = useMemo(() => (career && fixture ? opponentStartingXI(career, fixture) : null), [career, fixture]);
  // Reshaped for castDefence (lib/star/lineup.ts) — the keeper and the men
  // marking you, drawn from this same real sheet rather than left as
  // anonymous shirts. See that function's own doc for why position-matching
  // stays simple here (nothing is credited off a Defender the way a goal is
  // credited off a Runner, so there's no wrong-man bug to guard against).
  const oppXIForCast: OpponentSheetPlayer[] | null = oppXI
    ? oppXI.map(p => ({
        id: p.id, name: p.name, shortName: p.short, position: p.role,
        overall: p.overall,
        // A real photo when the database has one, otherwise a stable fake
        // face — resolved here rather than baked into LeaguePlayer.image
        // itself, since shouldUpgradeLeagueSquads (leagueSquads.ts) reads
        // that field's real coverage as a staleness signal. Covers
        // castDefence AND fpRoster below in one place, since both derive
        // from this same array.
        face: p.face ?? fakeFaceFor(p.id),
        isGK: p.role === "GK", y: p.y,
        defending: p.defending,
      }))
    : null;
  // The real starting goalkeeper's own rating, when there's a real sheet to
  // read one off — see the strengthRef override just below, and
  // opponentStartingXI's own doc on why oppXI can be null (an international
  // fixture, or a side too thin to draw a sheet from) — the flat prop stays
  // the honest fallback for both.
  const realKeeperOverall = oppXIForCast?.find(p => p.isGK)?.overall;
  // The same real sheet, reshaped for the first-person dribble mode's own
  // roster (FirstPersonDribble.tsx) — genuinely defensive players first
  // (orderDefensively, lib/star/lineup.ts — the same real fix castDefence
  // just below needed: a plain outfield list, unfiltered, put whichever
  // striker or winger the shuffle happened to land on in front of you as
  // often as a real defender). Excludes the goalkeeper, same as
  // castDefence's own `defenders` array: a keeper never comes out to
  // contest a dribble. undefined (not []) when there's nothing to scout,
  // so newRun's own "omit for anonymous men" default applies.
  const fpRoster: FpIdentity[] | undefined = oppXIForCast
    ? orderDefensively(oppXIForCast.filter(p => !p.isGK))
        .map(p => ({ id: p.id, name: p.name, shortName: p.shortName, face: p.face, defending: p.defending, overall: p.overall }))
    : undefined;
  // Read by the top-down dribble, which starts from the match loop.
  const fpRosterRef = useRef(fpRoster);
  fpRosterRef.current = fpRoster;

  /**
   * The opponent's defensive block shape for this fixture — their formation,
   * their playstyle, and the strength gap to your side — fed to
   * applyFormationShape (lib/star/formationShape.ts) so the defence sets up
   * the way that specific side actually would. Null in the sandbox / any match
   * with no real opponent to scout, which makes the whole layer a no-op there,
   * leaving existing behaviour untouched.
   */
  const formationShapeFor = (): ShapeInput | null => {
    if (!career || !fixture) return null;
    const myStrength = career.league.find(t => t.name === career.player.club)?.strength ?? 65;
    return formationShapeInput(fixture.opponent, myStrength, oppStrengthRef.current);
  };

  /**
   * Put a name to every goal in a run of hidden-match events, and record it.
   *
   * The one function both the normal in-match flow and the "coming on as a
   * substitute" replay use, which is the point of it existing: the replay used
   * to show the hour before you arrived as TEXT only, with no call to
   * `goalEventsRef.current.push` anywhere in that branch — so a goal scored
   * before you came on counted on the scoreboard and nowhere else. It was
   * missing from the scorer's season tally and missing from the scoreline
   * graphic the game posts about the result, both of which read `goalEvents`,
   * not the score.
   *
   * The other half of the same guarantee: `pickSquadScorer` returning null used
   * to mean the goal was reported as text and then simply not recorded — one
   * fewer name than the scoreline had goals, which is the "5-0 with four
   * scorers" report. It cannot return null against a starting XI (ten
   * outfielders, always), but a career saved before squads existed, or a
   * fixture with no restriction to compute, still can — so the fallback now
   * credits an unnamed team-mate rather than dropping the goal from the count.
   * An unnamed scorer in the graphic is honest; a goal with no line in it at
   * all reads as a mistake in the goal difference.
   */
  const nameTeamGoals = (
    raw: { minute: number; text: string; isGoal?: boolean; teammateGoal?: boolean; isOpponent?: boolean }[],
    squad: SquadPlayer[],
    rng: () => number,
    announce: boolean,
  ): SimEvent[] => {
    const attackers = squad.filter(p => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
    return raw.flatMap((e): SimEvent[] => {
      if (!e.isGoal) return [{ minute: e.minute, text: attributeClub(e.text, e.isOpponent), isOpponent: e.isOpponent }];

      if (!e.teammateGoal) {
        // The opponent's own goal, named the same way yours is — off their
        // real starting XI (opponentStartingXI, teamsheet.ts), not their
        // whole scouted roster, so an unused substitute can't be credited
        // with a goal in a match he didn't play. `oppXI` is null only when
        // there is genuinely nothing to scout (an international fixture, or
        // a side too thin to draw an XI from) — the one case with no honest
        // name to give, so it alone keeps the old generic line untracked.
        // Every OTHER opponent goal is recorded here exactly once, same as
        // every one of your side's team-mate goals already is — the results
        // page (careerFlow.ts) reads this list to credit the SAME name it
        // showed live, rather than rolling a second, different one.
        if (oppXI === null) {
          return [{ minute: e.minute, text: `⚽ ${fixtureOpponentRef.current} score!`, isGoal: true, isOpponent: true }];
        }
        const oppCandidates = oppXI.map(p => ({ id: p.id, name: p.name, shortName: p.short, position: p.role }));
        const oppScorer = pickSquadScorer(oppCandidates, rng)
          ?? { id: "unnamed", name: "Team-mate", shortName: "Team-mate" };
        const oppAssister = oppScorer.id !== "unnamed" ? pickSquadAssist(oppCandidates, oppScorer.id, rng) : null;
        oppGoalEventsRef.current.push({
          minute: e.minute, scorerId: oppScorer.id, scorer: oppScorer.name,
          assistId: oppAssister?.id, assist: oppAssister?.name,
        });

        const oppGoalLine = variedLine(GOAL_LINES, oppScorer.shortName, e.minute);
        if (announce) pushLine(`${e.minute}' ${oppGoalLine}${oppAssister ? ` (${oppAssister.shortName})` : ""}`);
        return oppAssister
          ? [
              { minute: e.minute, text: oppGoalLine, isGoal: true, isOpponent: true },
              { minute: e.minute, text: variedLine(ASSIST_LINES, oppAssister.shortName, e.minute), tone: "assist", isOpponent: true },
            ]
          : [{ minute: e.minute, text: oppGoalLine, isGoal: true, isOpponent: true }];
      }

      const scorer = pickSquadScorer(attackers.length > 0 ? attackers : squad, rng)
        // No name reachable at all — still a goal, still recorded, under an
        // identity that names what it is rather than inventing who.
        ?? { id: "unnamed", name: "Team-mate", shortName: "Team-mate" } as SquadPlayer;
      const assister = scorer.id !== "unnamed" ? pickSquadAssist(squad, scorer.id, rng) : null;
      goalEventsRef.current.push({
        minute: e.minute, scorer: scorer.name, assist: assister?.name, isUserGoal: false,
      });

      const goalLine = variedLine(GOAL_LINES, scorer.shortName, e.minute);
      if (announce) pushLine(`${e.minute}' ${goalLine}${assister ? ` (${assister.shortName})` : ""}`);
      // The assist is its own line, not a parenthetical on the goal's — "A:
      // Cucurella" reads as a fact about the goal rather than as trivia tucked
      // onto the end of the sentence.
      return assister
        ? [
            { minute: e.minute, text: goalLine, isGoal: true },
            { minute: e.minute, text: variedLine(ASSIST_LINES, assister.shortName, e.minute), tone: "assist" },
          ]
        : [{ minute: e.minute, text: goalLine, isGoal: true }];
    });
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /**
   * A screen reading the match frame by frame (lib/star/engineFrame.ts): the
   * Style Testing page's 3D view of the real game. Absent everywhere else
   * (no provider), and then nothing below that reads it runs. It only ever
   * READS: what was just drawn is handed over after the frame.
   */
  const frameObs = useContext(EngineFrameContext);
  const frameObsRef = useRef(frameObs);
  frameObsRef.current = frameObs;
  /** The screen holds the match (its Settings is open): see EngineFrameObserver.hold. */
  const heldByScreen = !!frameObs?.hold;
  /** A frame reader has thrown once already (logged once, not every frame). */
  const frameReaderErrRef = useRef(false);
  /**
   * The match view (lib/star/matchView.ts): Settings → Match view, read once
   * when the match opens. "classic" draws, frames and plays exactly as before.
   * The ref is for the render loop; the state is for the pitch's own height.
   */
  const newViewRef = useRef(typeof window !== "undefined" ? matchView() === "new" : MATCH_VIEW_DEFAULT === "new");
  const newView = newViewRef.current;
  /** New view: the pitch box's height in CSS px (fills the phone; see newViewCanvasHeight). */
  const [newViewH, setNewViewH] = useState<number | null>(null);
  const newViewHRef = useRef<number | null>(null);
  newViewHRef.current = newViewH;
  /** New view: the sandbox's commentary and hint sit at the top of the pitch
   *  when the ball is down at the bottom (a corner), else at the bottom. */
  const [overlayTop, setOverlayTop] = useState(false);
  const careerRef = useRef(career);
  careerRef.current = career;
  const preferredFootRef = useRef(preferredFoot);
  preferredFootRef.current = preferredFoot;

  // Career-match mode is active when the career flow passes a fixture + callback.
  const matchMode = !!(fixture && onComplete);
  const matchModeRef = useRef(matchMode);
  matchModeRef.current = matchMode;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const replayOfRef = useRef(replayOf);
  replayOfRef.current = replayOf;
  const onGoalScoredRef = useRef(onGoalScored);
  onGoalScoredRef.current = onGoalScored;
  const onGoalClipRef = useRef(onGoalClip);
  onGoalClipRef.current = onGoalClip;
  // The goal recorder (lib/star/goalClip/recorder.ts) and the chance it is
  // recording. Made on the first frame a real match asks for clips.
  const goalRecRef = useRef<GoalRecorder | null>(null);
  const recSceneRef = useRef<Scenario | null>(null);
  // Everything needed to watch the goal that is about to be attempted again,
  // captured right before the strike — see the GoalReplay prop doc and
  // rngCallCountRef below. Only ever surfaced (via onGoalScored) if this
  // particular strike actually goes in.
  const pendingReplayRef = useRef<Omit<GoalReplay, "id" | "savedAt" | "label" | "flightDtLog"> | null>(null);
  // Every physics substep size actually used while `pendingReplayRef` is
  // live — see GoalReplay.flightDtLog's own note for why this exists at
  // all. Reset alongside `pendingReplayRef` in handleContact, and folded
  // into the saved GoalReplay only if the strike actually scores.
  const flightDtLogRef = useRef<number[]>([]);
  // The other half of the same fix, read during a replay instead of a live
  // strike: the recorded substep queue to draw `h` from instead of this
  // session's own device timing, and how far into it playback has got.
  // `null` for an older saved replay with no log to draw from, which falls
  // back to live device timing exactly as replay always used to.
  const replaySubstepsRef = useRef<number[] | null>(null);
  const replaySubstepIdxRef = useRef(0);
  const oppStrengthRef = useRef(oppStrength ?? 65);
  oppStrengthRef.current = oppStrength ?? 65;
  const fixtureOpponent = fixture?.opponent ?? "The opposition";
  const fixtureOpponentRef = useRef(fixtureOpponent);
  fixtureOpponentRef.current = fixtureOpponent;
  const fixtureHomeRef = useRef(fixture?.home !== false);
  fixtureHomeRef.current = fixture?.home !== false;

  /**
   * A knockout cannot be drawn. Returns null for anything that isn't a
   * decisive knockout fixture (a league match, a Euro league-phase night, or
   * the first leg of a two-legged tie — a draw genuinely stands in all
   * three); otherwise says whether this competition/round plays extra time
   * before penalties (see shootout.ts's `hasExtraTime`) and how to check
   * "level" for THIS fixture — plain scoreline for a single match, real
   * aggregate (first leg + this leg) for a Champions/Europa League second
   * leg or final.
   */
  const extraTimeEligibility = (): { extraTime: boolean; isLevelNow: () => boolean } | null => {
    if (!fixture?.competition) return null;
    const comp = fixture.competition;
    if (comp === "Community Shield" || comp === "Super Cup") {
      return { extraTime: false, isLevelNow: () => userScoreRef.current === oppScoreRef.current };
    }
    if (fixture.kind === "cup") {
      // A two-legged League Cup semi: the first leg can end level; the
      // second is level only on aggregate (first leg + this leg).
      if (fixture.leg === 1) return null;
      let firstUs = 0, firstThem = 0;
      if (fixture.leg === 2) {
        const you = careerRef.current?.player.club;
        const st = careerRef.current?.cupState?.find((c) => c.competition === comp && !c.winner);
        const tie = st?.rounds[st.rounds.length - 1]?.ties.find((t) => t.home === you || t.away === you);
        const l1 = tie?.legs?.[0];
        if (tie && l1) {
          firstUs = tie.home === you ? l1.hs : l1.as;
          firstThem = tie.home === you ? l1.as : l1.hs;
        }
      }
      return {
        extraTime: hasExtraTime(comp as ExtraTimeCompetition, fixture.round ?? "Final"),
        isLevelNow: () => (firstUs + userScoreRef.current) === (firstThem + oppScoreRef.current),
      };
    }
    if (fixture.kind === "europe") {
      const state = careerRef.current?.euroState;
      if (!state || comp !== state.competition) return null;
      const tie = euroCurrentTie(state);
      if (!tie) return null; // the league phase — a draw stands
      const legIdx = euroCurrentLeg(state) ?? 0;
      if (tie.legs.length > 1 && legIdx === 0) return null; // first leg — the second leg decides it
      const firstLeg = tie.legs[0];
      const firstUs = firstLeg?.us ?? 0;
      const firstThem = firstLeg?.them ?? 0;
      return {
        extraTime: true,
        isLevelNow: () => (firstUs + userScoreRef.current) === (firstThem + oppScoreRef.current),
      };
    }
    // An international knockout from the world (lib/star/intl): extra time
    // then penalties, or penalties straight away; a second leg on aggregate.
    if (fixture.intlKo) {
      const ko = fixture.intlKo;
      if (ko.firstLeg) {
        const f = ko.firstLeg;
        return { extraTime: true, isLevelNow: () => f.us + userScoreRef.current === f.them + oppScoreRef.current };
      }
      return { extraTime: ko.level === "et-pens", isLevelNow: () => userScoreRef.current === oppScoreRef.current };
    }
    // A summer-tournament knockout (lib/star/tournament.ts): extra time, then
    // penalties. A group game, and an old save's counter-style run, can be drawn.
    if (fixture.kind === "international" && fixture.round && !fixture.round.startsWith("Group")
      && careerRef.current?.tournament?.season === careerRef.current?.season) {
      return { extraTime: true, isLevelNow: () => userScoreRef.current === oppScoreRef.current };
    }
    return null;
  };

  // --- Session / scoreline tracking ---
  /**
   * Bumped every time a new scenario or simulation pass actually starts
   * (`loadScenario`/`startSimulation`). The result screen schedules its own
   * advance a second or two later with a bare `setTimeout` — nothing was
   * ever cancelling one of those if the tab went to the background and it
   * fired late, well after something else had already moved the match on.
   * Reported directly: leave the app mid-result and come back to find it has
   * silently "cut to a different scene" — a stale timer finally firing on
   * top of whatever you had already moved on to. Each timer captures the
   * generation at the moment it is scheduled and checks it is still current
   * before doing anything; a late one that lost the race is a no-op.
   */
  const sceneGenRef = useRef(0);
  const attemptsRef = useRef(0);
  const strikeAtRef = useRef<{ x: number; y: number } | null>(null);
  const tallyRef = useRef({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0, goalsPen: 0, goalsTap: 0, goalsOut: 0, passesSafe: 0, passesAmb: 0, missesOn: 0, missesPen: 0, misses1v1: 0 });
  const userScoreRef = useRef(0);
  const oppScoreRef = useRef(0);
  const goalEventsRef = useRef<GoalEvent[]>([]);
  const oppGoalEventsRef = useRef<OppGoalEvent[]>([]);
  const [finalStats, setFinalStats] = useState<MatchStats | null>(null);

  // --- Simulation between chances ---
  const matchMinuteRef = useRef(0);
  const [matchMinute, setMatchMinute] = useState(0);

  // ── Added time (v0.15 plan item 30) ──
  // The fourth official's board: 1-5 minutes, rolled once per match off its
  // own seed (addedTime.ts), so the ninety minutes play exactly as before.
  // 0 outside a real career match.
  const addedRef = useRef<number | null>(null);
  if (addedRef.current === null) {
    addedRef.current = fixture && onComplete
      ? rollAddedTime(mulberry32(addedTimeSeed(seed))) : 0;
  }
  const ADDED = addedRef.current;
  const boardShownRef = useRef(false);

  // ── Other scores (v0.15 plan item 35) ──
  // The rest of the division's games are played at kick-off, off their own
  // seed (liveScores.ts) — the very scores the table records at full time.
  // A goal for a club you have ticked pops up as the clock passes it (one
  // card at a time), and the Scores button shows every game as it stands.
  const liveWeekRef = useRef<{ fixtures: { home: string; away: string }[]; goals: LiveGoal[] } | null>(null);
  if (liveWeekRef.current === null) {
    let week: { fixtures: { home: string; away: string }[]; goals: LiveGoal[] } = { fixtures: [], goals: [] };
    try {
      // The farewell is the only game being played: no other scores.
      if (fixture && onComplete && career && !farewell) week = liveWeekFor(career, fixture);
    } catch { /* no other games to show */ }
    liveWeekRef.current = week;
  }
  const liveShownRef = useRef(0);
  const livePopIdRef = useRef(0);
  const [livePop, setLivePop] = useState<(LiveGoal & { id: number }) | null>(null);
  const [following, setFollowing] = useState<string[]>(() => followedTeams());
  const followingRef = useRef(following);
  followingRef.current = following;
  const [scoresOpen, setScoresOpen] = useState(false);
  const closeLivePop = useCallback(() => setLivePop(null), []);
  /**
   * Energy at kickoff, seeded once (React's lazy useRef initializer, not
   * re-synced like careerRef) — the career's own value isn't touched again
   * until this whole match reports back via onComplete, so there's nothing
   * to re-seed from mid-match. Falls back to fully fresh for the sandbox,
   * which has no real career (or no energy tracking) to seed from at all.
   */
  const startEnergyRef = useRef(career?.energy ?? 100);
  /**
   * LIVE ENERGY (22 Sep 2026 — see lib/star/energy.ts).
   *
   * `energyRef` is what you have right now; `energyClockRef` is the match
   * minute it has been charged up to. Every time the clock moves on, the
   * minutes in between are charged at the CURRENT mode's rate for this
   * competition — so switching mode takes effect from the very next minute,
   * and the bar at the bottom of the commentary drops as the clock ticks.
   */
  const energyRef = useRef(career?.energy ?? 100);
  const energyClockRef = useRef(0);
  const fatigueResetEveryRef = useRef(fatigueResetEvery);
  fatigueResetEveryRef.current = fatigueResetEvery;
  const [liveEnergy, setLiveEnergy] = useState(career?.energy ?? 100);
  const energyModeRef = useRef<EnergyMode>("medium");
  const [energyMode, setEnergyModeState] = useState<EnergyMode>("medium");
  /** v0.26: Defensive / Balanced / Attacking — kept on the career, changed
   *  live (see setPlaystyle). `playstyleChangesRef` holds switches made
   *  inside the stretch in flight, like the energy mode's `changes`. */
  const playstyleRef = useRef<Playstyle>(career?.playstyle ?? "balanced");
  const [playstyle, setPlaystyleState] = useState<Playstyle>(career?.playstyle ?? "balanced");
  const playstyleChangesRef = useRef<{ minute: number; playstyle: Playstyle }[]>([]);
  const energyFactorRef = useRef(career ? energyFactorFor(career, fixture) : 1);
  /** Basic KIB cans drunk at half time this match — reported back in the
   *  match stats and taken off your stock once the match is over. */
  const kibUsedRef = useRef(0);
  const [kibUsed, setKibUsed] = useState(0);
  // Where a completed pass left the move, and how many passes deep it is. The
  // next scenario is built from this rather than drawn at random, so a move can
  // actually be built instead of every chance starting from nothing.
  // `ambition` is how brave the ball that got you here was — see passAmbition.
  // The next situation is read off it as well as off where the ball arrived.
  // `touchTouches` (optional) is Touch Mode's own separate re-touch count —
  // see TOUCH_CHAIN_MAX's own doc for why it can't share `depth` with an
  // ordinary pass chain.
  /** `kind` (optional): the next chance's kind is decided already — the
   *  first-person dribble's reward ladder (lib/star/dribbleReward.ts). Absent
   *  for every other chain, which is dealt exactly as before. */
  const chainRef = useRef<{ pos: { x: number; y: number }; depth: number; ambition: number; touchTouches?: number; kind?: ScenarioKind } | null>(null);

  interface SimEvent {
    minute: number; text: string; isGoal?: boolean; isOpponent?: boolean;
    /** Overrides the isGoal-derived tone — an assist line is not itself a goal. */
    tone?: LogLine["tone"];
  }

  // ── The running commentary ──
  //
  // `log` is everything that has happened, kept for the whole match. `queue` is
  // what has happened but has not been read out yet — the streaming screen
  // moves one line at a time from the second into the first. Splitting them is
  // what makes the match play out rather than arrive: the simulation still
  // computes a whole passage at once, but you watch it.
  const [log, setLog] = useState<LogLine[]>([]);
  const [queue, setQueue] = useState<LogLine[]>([]);
  const queueRef = useRef<LogLine[]>([]);
  queueRef.current = queue;
  // The number painted on the scoreboard — read off what has actually been
  // REVEALED so far, not off the simulation's own running total. Those two
  // used to be the same `score` state, set the instant a whole simulated
  // passage resolved, well before the queue above had streamed out the goal
  // line that passage contained — reported directly: the scoreline jumped to
  // 3-1 minutes (sometimes a whole half-time pause) before the commentary
  // ever showed the goal that made it 3-1. A goal you score yourself, or come
  // on as a substitute already trailing by, still updates instantly — those
  // lines are pushed straight into `log`, never queued, so there is nothing
  // to lag behind.
  const displayScore = useMemo(() => ({
    user: log.filter(l => l.tone === "goal").length,
    opp: log.filter(l => l.tone === "oppGoal").length,
  }), [log]);
  // The score as shown, for Mikey's pop-ups' scoreboard (the "before" of a goal).
  const scoreForPopupRef = useRef(displayScore);
  scoreForPopupRef.current = displayScore;
  // Commentary speed — reported directly: it reset to the slowest setting
  // at the start of every single match, which is real friction across a
  // session where you might play ten or fifteen games in a row on your
  // preferred speed. Persisted the same way `star-match-muted` already is
  // just below — read once on mount, written back on every change — so it
  // holds across matches (and reloads) until you change it again yourself.
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("star-match-speed"));
      if (saved === 1 || saved === 2 || saved === 4 || saved === 8) setSpeed(saved);
    } catch { /* ignore */ }
  }, []);
  const cycleSpeed = () => {
    setSpeed((sp) => {
      // 8x added (Harry, 5 Oct 2026: "maybe we just make it even quicker, the
      // top one"; the first-time playtest waited 4-9 s of ticker per chance).
      const next = sp === 1 ? 2 : sp === 2 ? 4 : sp === 4 ? 8 : 1;
      try { localStorage.setItem("star-match-speed", String(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [pause, setPause] = useState<{ label?: string; cta: string; halfTime?: boolean; onContinue: () => void } | null>(null);
  const halfTimeShownRef = useRef(false);
  /** What to do once the queue has emptied. */
  const simContinueRef = useRef<(() => void) | null>(null);
  /**
   * THE STRETCH OF PLAY IN FLIGHT, so an energy-mode switch is instant.
   *
   * `startSimulation` works out everything up to your next chance the moment
   * the last one ends, and the commentary then plays it out minute by minute.
   * A mode switch made while that plays used to change nothing until the NEXT
   * stretch. Asked for directly: "if you change to high energy, it changes
   * everything to high energy mode straight away." So the start of the
   * stretch is kept here, and a switch re-runs it from the same seed with the
   * new mode taking over from the next minute: everything already on screen
   * comes out identical, everything after it is played at the new mode,
   * including when your next chance arrives. Cleared the moment the stretch
   * hands over to a chance, so a switch can never rewind an old one.
   */
  const stretchRef = useRef<{
    snapshot: HiddenMatchState;
    seed: number;
    inputs: HiddenMatchInputs;
    userScore: number;
    oppScore: number;
    goalEvents: number;
    oppGoalEvents: number;
    hooked: HookReason | null;
    hookedAt: number | null;
    feed: string[];
    changes: { minute: number; mode: EnergyMode }[];
    /** How many lines the stretch queued, so the ones already read out can
     *  be told apart from the ones still to come. */
    queued: number;
    /** A foul's set piece handed over at the start of the stretch (item 22). */
    handover?: ScenarioKind | null;
    /** This stretch carried the added-time board (item 30), so a re-run carries it too. */
    board?: boolean;
  } | null>(null);

  // The match going on around you. It owns possession, territory and momentum;
  // your chances are what it hands you, and their kind is decided by where the
  // ball actually was when it found you.
  const matchStateRef = useRef<HiddenMatchState>(newMatch(mulberry32(seed)));
  // Chances: New only — the deal that turns a fitting moment into a top-down
  // dribble (lib/star/dribbleDeal.ts). Its own stream; Old never touches it.
  const dribbleDealRef = useRef<{ deal: DribbleDeal; rng: () => number } | null>(null);
  /** The live radar (Settings → Look → Match radar): every minute the unseen
   *  match plays, by minute (hiddenMatch.ts's radarTrace). */
  const radarTraceRef = useRef(new Map<number, RadarTick>());
  const radarLook = useMatchRadarLook();
  const startMinuteRef = useRef(startMinute);
  startMinuteRef.current = startMinute;
  /** The minute you actually came on. For a substitute this follows the game
   *  (subComesOnNow, selection.ts), so it can differ from `startMinute`,
   *  which now only says "you're on the bench". Minutes played, the rating's
   *  cameo adjustment and "settled in before being taken off" all read it. */
  const enteredAtRef = useRef(startMinute);
  /** Item 24: true once you are actually on as a substitute, and how many
   *  chances the unseen match has handed you since. */
  const subOnRef = useRef(false);
  const subChancesRef = useRef(0);
  /** Item 24: your energy the minute you came on — a fresher sub squeezes more in. */
  const subFitnessRef = useRef(100);
  /** Item 26: every chance that came to you, one line each (chanceLog.ts). */
  const chanceLogRef = useRef<ChanceEntry[]>([]);
  const logChance = (kind: string, outcome: ChanceOutcome) => {
    chanceLogRef.current.push({ minute: matchMinuteRef.current, kind, outcome });
  };
  /** Set once the manager has taken you off, so nothing after it can play. */
  const hookedRef = useRef<HookReason | null>(null);
  /** The minute you came off. The rest of the match is played without you, so
   *  the clock runs on to ninety and this is what you were actually on for. */
  const hookedAtRef = useRef<number | null>(null);
  const dutiesRef = useRef(duties);
  dutiesRef.current = duties;
  // Fixed for the whole match: every scenario is played in the same conditions,
  // because the weather does not change between one chance and the next.
  const conditionsRef = useRef<Conditions>(conditions ?? conditionsFor(0, 0));
  conditionsRef.current = conditions ?? conditionsRef.current;

  // ── The run ──
  // A scenario where you carry it rather than strike it. Lives outside the
  // Scenario machinery entirely: no ball flight, no keeper, no builders.
  const dribbleRef = useRef<DribbleState | null>(null);
  // The new first-person duel mode's own run — see USE_FIRST_PERSON_DRIBBLE.
  // Rolled once, the moment the scenario triggers (loadScenario), and held
  // fixed for the run's whole lifetime so re-renders while phase ===
  // "fpDribble" never reroll the waves out from under an in-progress run.
  const fpDribbleRef = useRef<{ waveSizes: number[]; seed: number; duels?: boolean } | null>(null);
  // Settings → Match → Dribble style: Top-down — the same run (the first-person
  // duel's own sim, lib/star/firstPersonDribble.ts) played in this match view,
  // stepped by the main loop below and drawn with the match's own players and
  // ball. Kept through a lost run's "result" beat, like dribbleRef.
  const tdRef = useRef<FpRunState | null>(null);
  /** Top-down: waiting for the first touch before anyone moves. */
  const tdReadyRef = useRef(false);
  /** Top-down: the drawn ball's sideways spring, and the thumb. */
  const tdBallRef = useRef<{ x: number; vx: number }>({ x: 0, vx: 0 });
  const tdTouchRef = useRef<{ x: number; y: number; t: number; anchorLane: number; anchorPitchX: number; samples: { x: number; t: number }[] } | null>(null);
  /** Top-down on the stick (the `dribbleControl` prop): the stick's thumb (client px origin,
   *  canvas-fraction origin for drawing, its push now, recent x for a flick) and a right-hand tap. */
  const dribbleControlRef = useRef(dribbleControl);
  dribbleControlRef.current = dribbleControl;
  const dribbleOnlyRef = useRef(dribbleOnly);
  dribbleOnlyRef.current = dribbleOnly;
  const tdStickRef = useRef<{ id: number; cx: number; cy: number; fx: number; fy: number; vx: number; vy: number; hist: { vx: number; t: number }[] } | null>(null);
  const tdTapRef = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  /** Development only: when a push from rest first moves you (input to moved, ms). */
  const tdLatRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const [tdNote, setTdNote] = useState<DuelEvent | null>(null);
  const tdNoteCountRef = useRef(0);
  const [tdReady, setTdReady] = useState(false);
  /** Settings → Look → "Dribble runs 3D", read once per match (switching mid-run would remount it). */
  const flickStartRef = useRef<{ x: number; y: number } | null>(null);
  // Curve boots: a swipe captured in screen pixels (not pitch metres — the
  // ball is in flight, moving through 3D space the aim gesture never has to
  // reason about, so "which way did the thumb move on the glass" is both
  // simpler and the actually-correct read of the gesture).
  const curveSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  // The swipe's CURRENT point while it's in progress — separate from the
  // start above so the draw loop can paint a live guide line, the same
  // feedback every other drag in this game already gives (the aim arrow,
  // the captain's order). Without this the gesture was invisible while it
  // happened: reported as "I'm doing stuff... nothing's happening."
  const curveSwipeCurrentRef = useRef<{ x: number; y: number } | null>(null);

  /** Is this dead ball yours? With no duties supplied (the sandbox), everything is. */
  const mayTake = (kind: ScenarioKind) => {
    const d = dutiesRef.current;
    if (!d) return true;
    if (kind === "free_kick") return d.freeKicks;
    if (kind === "penalty") return d.penalties;
    return true;
  };
  // The situation the simulation has just produced, consumed by the next
  // loadScenario() so the scenario matches the football that led to it.
  const pendingRequestRef = useRef<ScenarioRequest | null>(null);
  /** The last few situations you were shown — the chance formula's anti-repeat. */
  const chanceMemoryRef = useRef(newSelectionMemory());
  /** See the `openOn` prop. Held in a ref so the render loop reads the
   *  current one without re-creating every callback that touches it. */
  const openOnRef = useRef(openOn);
  openOnRef.current = openOn;
  /** See the `leadIn` prop: the builder, and the lead-in while it plays. */
  const leadInPropRef = useRef(leadIn);
  leadInPropRef.current = leadIn;
  const leadRef = useRef<{ lead: LeadIn; t: number; ents: LeadEntity[]; ends: Vec2[]; ball: Vec2; z: number; mates0: number; defs0: number; cam: { at(t: number, chance: Viewport): Viewport; lockAt(t: number, chance: Viewport): number }; endAt: Record<string, Vec2>; endKeeper: Vec2 | null } | null>(null);
  // B10: when a header or volley chance became yours (for the ball hanging /
  // bouncing while you aim — lib/star/airDrawings.ts airWaitZ). Drawing only.
  const airT0Ref = useRef<{ sc: Scenario; t0: number } | null>(null);
  const leadTriedRef = useRef(false);
  /**
   * PLAYERS ALREADY MOVING (the lead-in's `runOnS`, Full highlights rebuild
   * phase 3): after the hand-over the men in `ents` keep running along the
   * lead-in (posAt past durS) while you aim, and stop on their drawn spots.
   * Strike it before then and they stop where they are: from the strike the
   * engine moves them as it moves everyone. Null: nobody is still running.
   */
  const runOnRef = useRef<{ lead: LeadIn; t: number; ents: LeadEntity[]; ends: Vec2[] } | null>(null);
  // ── The move plays on after your pass (lib/star/playOn.ts, Chances: New) ──
  /** A lead-in played before this chance (a build-up, or a carry-on). */
  const leadPlayedRef = useRef(false);
  /** Your run and the team-mate's lay-off, while your pass plays on. */
  const playOnRef = useRef<PlayOn | null>(null);
  /** Chances whose opening spot for your man has been set (youSpot.ts). */
  const youPlacedRef = useRef(new WeakSet<object>());
  const playOnRngRef = useRef<() => number>(Math.random);
  const layOffsLeftRef = useRef(MAX_LAY_OFFS);
  /** The lay-off reached you: the same picture, your next kick. */
  const playOnCaughtRef = useRef(false);
  /** Where everyone was when a pass in a no-goal picture found its man: the next picture is reached from here. */
  const carryOnRef = useRef<CarryFrom | null>(null);
  /** "After you pass: Joystick" (lib/star/afterPass.ts): the stick is up, your thumb on it, and the captain's call's answer. */
  const [stickLive, setStickLive] = useState(false);
  // ── B14 THE RUN (lib/star/playOn.ts startPlayOnRun, lib/star/legs.ts) ──
  /** A run is live (any pass in open play): the stamina bar shows, keys steer. */
  const [runLive, setRunLive] = useState(false);
  /** The stamina bar on screen: how full (0..1), the cap your energy sets (0..1), sprinting. */
  const [stamUi, setStamUi] = useState<{ v: number; cap: number; sprint: boolean; auto: boolean } | null>(null);
  const stamUiAtRef = useRef(0);
  /** B14b: which corner of the pitch the stamina bar sits in (lib/star/barSpot.ts). */
  const [barCorner, setBarCorner] = useState<BarCorner>("bl");
  const barCornerRef = useRef<BarCorner>("bl");
  /** The bar as it was at the end of the last run in this move (a run that carries on keeps it). */
  const barRef = useRef(1);
  /** W A S D / arrows and Shift, held (PC). */
  const keysRef = useRef<MoveKeys>(noKeys());
  const keysSteeringRef = useRef(false);
  /** A keyboard was used in this match: the bar's label says W A S D. */
  const [keysSeen, setKeysSeen] = useState(false);
  /** A computer (a mouse, hover): the bar says which keys. A phone never shows it. */
  const [pcPointer, setPcPointer] = useState(false);
  useEffect(() => {
    try { setPcPointer(window.matchMedia("(hover: hover) and (pointer: fine)").matches); } catch { /* no matchMedia */ }
  }, []);
  const pcKeys = pcPointer || keysSeen;
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const set = (e: KeyboardEvent, down: boolean) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = moveKeyOf(e.code);
      if (!k) return;
      keysRef.current[k] = down;
      // Only while your run is live do the keys belong to the match (no page scroll under it).
      if (playOnRef.current?.stick && phaseRef.current === "flight") {
        e.preventDefault();
        if (down && k !== "sprint") setKeysSeen(true);
      }
    };
    const onDown = (e: KeyboardEvent) => set(e, true);
    const onUp = (e: KeyboardEvent) => set(e, false);
    const clear = () => { keysRef.current = noKeys(); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); window.removeEventListener("blur", clear); };
  }, []);
  const poStickUiRef = useRef<{ id: number; cx: number; cy: number; fx: number; fy: number; vx: number; vy: number } | null>(null);
  const [callMsg, setCallMsg] = useState<string | null>(null);
  const callMsgTimerRef = useRef<number | null>(null);
  const flashCallMsg = (m: string) => {
    setCallMsg(m);
    if (callMsgTimerRef.current !== null) window.clearTimeout(callMsgTimerRef.current);
    callMsgTimerRef.current = window.setTimeout(() => setCallMsg(null), 1500);
  };
  const [leadInOn, setLeadInOn] = useState(false);
  /** The lead-in's own line while it plays, when it asks for it shown (`captionShown`: "Foul! Free kick."). */
  const [leadCap, setLeadCap] = useState<string | null>(null);
  const leadCapRef = useRef<string | null>(null);
  /** See the `onChanceServed` / `neverHooked` props. Held in refs for the
   *  same reason `openOn` is — the loop reads them outside React's render. */
  const onChanceServedRef = useRef(onChanceServed);
  onChanceServedRef.current = onChanceServed;
  const onChanceResolvedRef = useRef(onChanceResolved);
  onChanceResolvedRef.current = onChanceResolved;
  const penaltyReadRef = useRef(penaltyRead);
  penaltyReadRef.current = penaltyRead;
  /**
   * THE KEEPER BRAIN (lib/star/keeperBrain.ts, v0.15) — one goalkeeper on
   * top of the per-kind rules: he sets himself while you aim, reacts a human
   * beat after the strike, steps while he reads it and throws ONE dive, all
   * by his rating. Set up once a chance is fully placed (after the kind's
   * rules and the defence's roles), from the chance's own seed — never the
   * match's stream. His rating is the one the engine judges his reach with
   * (`keeperStrength`). A penalty's dive is the penalty rule set's decision
   * (with a trial's harder keeper riding through as its override); a free
   * kick keeps its own rules and gets no brain. On everywhere, at the
   * "Middle" dial; only the Play Area can pick another, on a test screen.
   */
  /** A feature's keeper draws off this mount's own random salt (keeperSaltFor):
   *  the same picture, played again, is not the same kick. 0 in the real match. */
  const keeperSaltRef = useRef<number | null>(null);
  if (keeperSaltRef.current === null) keeperSaltRef.current = keeperSaltFor(!!openOn);
  const setUpKeeper = (sc: Scenario, seed: number) => {
    seed = (seed ^ (keeperSaltRef.current ?? 0)) >>> 0;
    const opts = brainOptionsHere();
    // The keeper facing THIS kick: an automatic kick (a shootout, a
    // team-mate's penalty) names him; otherwise the match's.
    const facing = autoKickOf(sc)?.keeper?.strength ?? strengthRef.current;
    opts.penalty = penaltyReadFor(facing, penaltyReadRef.current);
    brainSetup(sc, seed, sc.keeperStrength, opts);
  };
  /** The strike rule in play for this ball (lib/star/kindRules), if any. */
  const strikeRuleRef = useRef<StrikeDecision | null>(null);
  /** v0.15 item 16: blocks deflected this strike (one per strike; the next
   *  defender to get to it wins it, as today). */
  const deflectionsRef = useRef(0);
  /**
   * SHOW THE BOOT (clearances, 7 Oct 2026). Set when a chance ends on a
   * defender's clean clearance: the ball keeps flying (stepBallCleared) and the
   * hand-back to the commentary waits until the WHOLE drawn ball, and its
   * shadow, is past an edge of the match picture — or it stops on screen
   * (clearance.handOverAfterStop), or clearance.handOverMax runs out.
   */
  const bootRef = useRef<{ t: number; stopT: number | null; then: (() => void) | null } | null>(null);
  /** A completed pass rolls the last metre or two into the receiver's feet
   *  during the PASS banner (Mikey, 16 Oct 2026: it froze ~1.9 m short of him,
   *  because a pass counts from 2.0 m). Picture only: the outcome is decided. */
  const receiveGlideRef = useRef<{ from: { x: number; y: number }; to: { x: number; y: number }; z0: number; t0: number } | null>(null);
  /** Every team-mate lay-off and shot since your strike, in order — who the
   *  assist belongs to (lib/star/credit.ts assistFor). Reset at each strike. */
  const matePlaysRef = useRef<MatePlay[]>([]);
  /**
   * The banner for a ball that reached a team-mate. A strike that came off a
   * defender first was not a pass: a free kick into the wall that fell to a
   * team-mate read "PASS" (final playtest, 27 Sep 2026).
   */
  const passBanner = () => (deflectionsRef.current > 0
    ? (scenarioRef.current.kind === "free_kick" ? "OFF THE WALL" : "DEFLECTED")
    : "PASS");
  const setPieceSkillRef = useRef(setPieceSkill);
  setPieceSkillRef.current = setPieceSkill;
  const markersRef = useRef(markers);
  markersRef.current = markers;
  // The Real Goals page's real sides, names and ghost (drawing only).
  const realGoalRef = useRef(realGoal);
  realGoalRef.current = realGoal;
  /** When the ghost started running alongside your strike (null: looping). */
  const ghostRaceRef = useRef<number | null>(null);
  /** Names over heads: the Settings row, or the Real Goals page (the real names). */
  const namesOn = () => faceStyleRef.current.namesEnabled || !!realGoalRef.current?.showNames;
  /** See the `vfxOverride` prop: the lab's recipes and the effects they are drawing. */
  const vfxRef = useRef(vfxOverride);
  vfxRef.current = vfxOverride;
  const vfxFxRef = useRef<{ ev: VfxEvent; r: VfxRecipe; at: number; x: number; y: number; z: number; vx: number; vy: number; power: number; salt: number }[]>([]);
  const onBallStepRef = useRef(onBallStep);
  onBallStepRef.current = onBallStep;
  const neverHookedRef = useRef(neverHooked);
  neverHookedRef.current = neverHooked;
  /** See the `farewell` prop. */
  const farewellRef = useRef(farewell);
  farewellRef.current = farewell;
  const plannedOffRef = useRef(plannedOffAt);
  plannedOffRef.current = plannedOffAt;
  /** The farewell: the minute you came off to the standing ovation. */
  const [ovation, setOvation] = useState<number | null>(null);
  // The ovation waits for the commentary to reach that minute: the match
  // decides it a stretch ahead, and a playtest saw the banner at 85' while
  // the clock still read 75' (6 Oct 2026). The cheer plays when it shows.
  const ovationShown = !!farewell && ovation !== null && matchMinute >= ovation;
  const ovationHeardRef = useRef(false);
  useEffect(() => {
    if (ovationShown && !ovationHeardRef.current) {
      ovationHeardRef.current = true;
      playCrowdSwell("cheer");
      // The 3D standing ovation plays over the match (the page's, Settings → Look).
      if (ovation !== null) farewellRef.current?.onOvation?.(ovation);
    }
  }, [ovationShown]);

  /**
   * How much you have left, RIGHT NOW, at this point in the match — not the
   * pre-match value creditMatchResult will drain once, but a transient,
   * match-local figure that eases down over the ninety minutes on its own.
   * Deliberately a pure function of the match clock rather than a
   * separately-ticked ref: it can be read at any point (hiddenInputs,
   * hookCheck, tiredSkills) and is always exactly consistent with whatever
   * minute the game currently considers itself at, with nothing to
   * desynchronise. Loses up to ENERGY_MATCH_DECAY points by full time.
   */
  const liveEnergyAt = (minute: number) => {
    // A player who has been taken off stops spending energy — and in the
    // farewell match nobody spends any.
    if (hookedRef.current || farewellRef.current) return energyRef.current;
    const extra = Math.max(0, minute - energyClockRef.current)
      * energyPerMinute(energyModeRef.current, energyFactorRef.current);
    return clampEnergy(energyRef.current - extra);
  };
  /** Charge energy up to this minute, at the current mode. */
  const chargeEnergyTo = (minute: number) => {
    if (minute > energyClockRef.current) {
      energyRef.current = liveEnergyAt(minute);
      energyClockRef.current = minute;
      setLiveEnergy(energyRef.current);
    }
  };
  /** Move the match clock — the one place energy is charged as it passes. */
  const setClock = (minute: number) => {
    // A test match thousands of minutes long: fresh legs at each new "match"
    // (see the fatigueResetEvery prop). Never set by the real career match.
    const every = fatigueResetEveryRef.current;
    if (every && every > 0 && Math.floor(minute / every) > Math.floor(energyClockRef.current / every)) {
      energyRef.current = startEnergyRef.current;
      energyClockRef.current = Math.floor(minute / every) * every;
    }
    chargeEnergyTo(minute);
    matchMinuteRef.current = minute;
    setMatchMinute(minute);
  };
  /** v0.26: switch playstyle. Like the energy mode, it takes over from the
   *  next minute of the stretch already being read out. */
  const setPlaystyle = (ps: Playstyle) => {
    if (ps === playstyleRef.current) return;
    playstyleRef.current = ps;
    setPlaystyleState(ps);
    const stretch = stretchRef.current;
    if (stretch && phaseRef.current === "feed" && !hookedRef.current) {
      playstyleChangesRef.current = [...playstyleChangesRef.current, { minute: matchMinuteRef.current + 1, playstyle: ps }];
      startSimulation(true);
    }
  };
  const setEnergyMode = (mode: EnergyMode) => {
    if (mode === energyModeRef.current) return;
    // Bank what the old mode cost up to now before the new rate applies.
    chargeEnergyTo(matchMinuteRef.current);
    energyModeRef.current = mode;
    setEnergyModeState(mode);
    // And the football changes now too, not from your next chance: see
    // stretchRef. From the next minute, so nothing already read out changes.
    const stretch = stretchRef.current;
    if (stretch && phaseRef.current === "feed" && !hookedRef.current) {
      stretch.changes.push({ minute: matchMinuteRef.current + 1, mode });
      startSimulation(true);
    }
  };
  // It IS a Basic can, so it gives what a Basic can gives (+65, owners 23 Sep 2026).
  const KIB_HALF_TIME_RESTORE = KIB_CANS.find(c => c.id === "basic")?.restore ?? 65;
  const drinkHalfTimeKib = () => {
    const owned = (careerRef.current?.kibCans?.basic ?? 0) - kibUsedRef.current;
    if (owned <= 0 || energyRef.current >= 100) return;
    kibUsedRef.current += 1;
    setKibUsed(kibUsedRef.current);
    energyRef.current = clampEnergy(energyRef.current + KIB_HALF_TIME_RESTORE);
    setLiveEnergy(energyRef.current);
  };

  /**
   * Power/technique, shaved down as the live match-local energy above
   * depletes — a tired player is less sharp, not a different player, so the
   * cut tops out modest (15% at fully spent) rather than dramatic. Read only
   * at the moment of contact (handleContact) — the aim arrow itself
   * deliberately keeps using the raw, static `skills` prop so the gesture's
   * required drag distance never becomes a moving target mid-match; see the
   * note by dragForFullPower's call site.
   */
  // v0.26: full strength at 85+ energy, then a smooth drop to 40% off at 0
  // (energy.ts's fatigueCut). Starts from the career's kick-off energy.
  const tiredSkills = (): KickSkills => {
    const t = tiredKickSkills(skills, liveEnergyAt(matchMinuteRef.current));
    return { power: t.power, technique: t.technique };
  };

  /**
   * The rating so far, the one formula every reader uses: the manager's hook,
   * the live AVG RAT box and the post-match screen. Item 26: the fair rating
   * (only real misses cost you).
   */
  const ratingSoFar = (t: typeof tallyRef.current, us: number, them: number): number =>
    fairRating({ ...t, passes: t.passesCompleted }, us, them).rating;
  /** What finaliseMatch needs beyond the old tally, and the extras for the post-match screen. */
  const matchExtras = () => {
    const t = tallyRef.current;
    return {
      tally: { misses: t.misses, lost: t.lost, dribbles: t.dribbles, goalsPen: t.goalsPen, goalsTap: t.goalsTap, goalsOut: t.goalsOut,
        passesSafe: t.passesSafe, passesAmb: t.passesAmb, missesOn: t.missesOn, missesPen: t.missesPen, misses1v1: t.misses1v1 },
      extra: {
        ...(subOnRef.current ? { cameo: true, enteredAt: enteredAtRef.current } : {}),
        chanceLog: chanceLogRef.current.slice(),
      },
    };
  };

  const hiddenInputs = (): HiddenMatchInputs => {
    const car = careerRef.current;
    // ONE SET OF MATCH INPUTS (lib/star/matchInputs.ts): the radar, sim90,
    // the ruler and "Sim this match" build theirs the same way.
    const live = {
      oppStrength: oppStrengthRef.current,
      position: positionRef.current,
      // Can your best corner reach the middle of the box? Measured with the
      // match's own ball physics on your kicking skills (lib/star/cornerReach.ts).
      kick: skillsRef.current,
      energy: liveEnergyAt(matchMinuteRef.current),
      energyMode: energyModeRef.current,
      impactSub: startMinuteRef.current > 0,
      // The farewell match: nearly every chance is yours.
      farewell: !!farewellRef.current,
      // Item 24: once you are on as a sub, your chances are squeezed into the
      // minutes left (allowing for your energy), and from 70' one is owed.
      lateSub: subOnRef.current
        ? { enteredAt: enteredAtRef.current, owed: Math.max(0, lateSubQuota(enteredAtRef.current) - subChancesRef.current), fitness: subFitnessRef.current }
        : undefined,
      // Added time: chasing in it, everyone goes forward (hiddenMatch.ts's FERGIE_*).
      addedTime: ADDED,
      fullTime: MATCH_DURATION,
    };
    return matchInputsFor(car
      // Your CLUB's strength (Chelsea 83), not the team relationship (60 on
      // day one) — see matchTeamStrength (lib/star/matchday.ts, item 0).
      ? careerMatchSpec(car, fixture, { ...live, teamFallback: teamRef.current, playstyle: playstyleRef.current })
      : { ...live, teamStrength: teamRef.current, home: fixture?.home, skills: { power: 55, technique: 55, vision: 55 }, context: { playstyle: playstyleRef.current } });
  };

  // Translate what the physics produced into what the match needs to know.
  // Only a completed pass keeps the ball; everything else ends the move.
  //
  // touchOn is the one other real exception. Reported live, still broken
  // after the chase and the chain-budget were both already fixed: "it
  // stops... ends the chance instead of starting the new chance from that
  // position." Root cause, found by re-reading this function specifically —
  // touchOn matched none of the explicit cases here and fell through to the
  // generic "saved" default, which resolveScenario (hiddenMatch.ts) treats
  // as a miss: it calls endOfMove, flipping the HIDDEN match's own
  // possession to the opponent and marking the move over at the simulation
  // level — completely independent of, and invisible to, CanvasMatch's own
  // local chainRef/loadScenario continuation, which was genuinely working
  // the whole time. A genuinely uncontested touch of your own was being
  // scored, underneath the visible game, as if the goalkeeper had saved it.
  // "delivered" is the one existing result whose real meaning — "you kept
  // the move alive and moved it forward, the ball stays yours" — is
  // actually true of a touch-mode re-touch; there's no dedicated
  // ScenarioResult for "touch mode continued" worth adding a whole new
  // union member for when an existing one already means exactly this.
  const matchResultFor = (res: Outcome): ScenarioResult => {
    if (OUTCOME_TEXT[res].kind === "goal") return "goal";
    if (res === "delivered" || res === "touchOn") return "delivered";
    if (res === "tackled" || res === "blocked") return "lost";
    return "saved";
  };

  // Two banks, not one shared neutral set — reported directly, same as
  // hiddenMatch.ts's QUIET lines: nothing here should read as about nobody.
  // Attributed to whoever actually has the ball when this fires (SEE the
  // call site's `st.possession` check), which this rare fallback path — a
  // whole skipped batch producing no events at all — otherwise had no way
  // to say.
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
    "{club}'s fans are starting to get restless.",
    "A crunching challenge from {club} draws a free kick — nothing comes of it.",
    "The tempo drops as {club} look to regroup.",
    "A lovely piece of skill from {club} on the touchline, but the final ball lets them down.",
    "Chances have been at a premium for {club} here.",
  ];
  const SIM_COMMENTARY_OPP = [
    "They share the ball around patiently in midfield.",
    "Their defence holds firm under pressure.",
    "Their counter-attack breaks down in the final third.",
    "A tidy passing move from them comes to nothing.",
    "The ball is recycled patiently at the back for them.",
    "A promising run down the wing for them is halted by a strong tackle.",
    "Their keeper comes out to claim a hopeful cross.",
    "A long ball forward for them finds nobody — easily dealt with.",
    "Neat footwork from them in the middle of the park creates some space.",
    "Their fans are starting to get restless.",
    "A crunching challenge from them draws a free kick — nothing comes of it.",
    "The tempo drops as they look to regroup.",
    "A lovely piece of skill from them on the touchline, but the final ball lets them down.",
    "Chances have been at a premium for them here.",
  ];

  // --- Sound: muted by default until primed by the first user gesture ---
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("star-match-muted");
      if (saved === "1") { setMuted(true); setMatchSoundMuted(true); }
    } catch { /* ignore */ }
  }, []);
  const toggleMuted = () => {
    setMuted((m) => {
      const next = !m;
      setMatchSoundMuted(next);
      try { localStorage.setItem("star-match-muted", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const strengthRef = useRef(keeperStrength);
  // `keeperStrength` (the prop) is a whole-club average with a small home/
  // away nudge — page.tsx's own honest stand-in for "how hard is this
  // keeper to beat" when there's nobody specific to ask. The moment there
  // IS a real starting goalkeeper on the sheet (realKeeperOverall, above),
  // his own rating wins outright: a real keeper isn't a different man home
  // or away, so the nudge is deliberately dropped here too, not carried
  // over. Clamped to the same 20-99 band the prop itself already uses.
  strengthRef.current = realKeeperOverall !== undefined && !forceKeeperStrength
    ? Math.max(20, Math.min(99, realKeeperOverall))
    : keeperStrength;
  const positionRef = useRef(position);
  positionRef.current = position;
  const teamRef = useRef(teamRelationship);
  teamRef.current = teamRelationship;
  // Vision decides how much of the pitch you are told about — see visibleOptions.
  const visionRef = useRef(career?.skills.vision ?? 55);
  visionRef.current = career?.skills.vision ?? 55;

  /**
   * What the two sides are wearing.
   *
   * Resolved once per match from who is at home — see lib/star/kits. Everybody
   * used to be in the same two colours whoever was playing: you green, your
   * team-mates blue, the opposition red, at Manchester City, for fifteen
   * seasons. The sandbox has no fixture and no clubs, so it keeps a neutral
   * pair rather than pretending to be a game between two teams.
   */
  const kitsRef = useRef<MatchKits>(
    realGoal && fixture
      // The Real Goals page: the two real national sides.
      ? (fixture.home
        ? { home: realGoal.us.kit, away: realGoal.them.kit, keeper: realGoal.keeperKit ?? { shirt: C.gk, trim: C.gkRim } }
        : { home: realGoal.them.kit, away: realGoal.us.kit, keeper: realGoal.keeperKit ?? { shirt: C.gk, trim: C.gkRim } })
      : fixture && career
      ? (fixture.home
        ? kitsFor(career.player.club, fixture.opponent, career.clubKits?.[career.player.club], career.clubKits?.[fixture.opponent])
        : kitsFor(fixture.opponent, career.player.club, career.clubKits?.[fixture.opponent], career.clubKits?.[career.player.club]))
      : { home: { shirt: C.mate, trim: C.mateRim }, away: { shirt: C.opp, trim: C.oppRim },
          keeper: { shirt: C.gk, trim: C.gkRim } },
  );
  /** Yours and theirs, whichever end of the fixture you are. */
  const ourKit = () => (fixtureHomeRef.current ? kitsRef.current.home : kitsRef.current.away);
  const theirKit = () => (fixtureHomeRef.current ? kitsRef.current.away : kitsRef.current.home);
  /**
   * YOUR keeper's kit — only ever drawn when they take a penalty at him (a
   * shootout, v0.15 item 7). Picked like any keeper's (kits.ts keeperKit), and
   * away from the other keeper's colours so the two are never the same man.
   */
  const ourKeeperKitRef = useRef(keeperKit(ourKit().shirt, kitsRef.current.keeper.shirt));
  // Lag pass 4 (9 Oct 2026): the first chance's one-off work done in the
  // background at kick-off (the bench's commentary, or the first seconds of
  // play), not in one freeze as it opens: the chance space (chanceFormula.ts)
  // and the 3D players' kits coloured (sprites.ts). Same chances, same picture.
  useEffect(() => {
    warmChanceSpace();
    if (matchPlayersLook() === "3d") {
      const sk = (k: { shirt: string; trim: string }) => ({ shirt: k.shirt, shorts: k.trim, socks: k.shirt });
      warmSpriteKits([sk(ourKit()), sk(theirKit()), sk(kitsRef.current.keeper), sk(ourKeeperKitRef.current)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // strengthRef.current is already the real keeper's own rating here when
  // there is one — see its own assignment just above — so the very first
  // scenario of the match reads the same number every later one does.
  // The FIRST chance is built right here, at ref creation — `loadScenario`
  // only ever runs once one has RESOLVED. So a hand-picked picture has to be
  // honoured in both places: a first attempt wired only `loadScenario` and
  // the Play overlay opened on a build-up, because the opening scene had
  // already been built before that function was ever called. See `openOn`.
  // Built once: `useRef(expr)` would evaluate the builder on every render
  // and throw the result away — and call a feature's `openOn` each time.
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const scenarioRef = useRef<Scenario | null>(null) as React.MutableRefObject<Scenario>;
  if (scenarioRef.current === null) {
    scenarioRef.current = openOn
      ? openOn()
      : buildWeightedScenario(mulberry32(seed), position, strengthRef.current, teamRelationship, career?.skills.vision ?? 55);
    // Volley and header are switched off for now (lib/star/switchedOffKinds.ts).
    if (!openOn && isSwitchedOff(scenarioRef.current.kind)) {
      const r = mulberry32(seed ^ 0x51f7);
      scenarioRef.current = buildScenario(playableKind(scenarioRef.current.kind, r), r, strengthRef.current, teamRelationship, career?.skills.vision ?? 55);
    }
    // The kind's hard ruleset (lib/star/kindRules) — its own seeded stream,
    // so the match's opening draws are exactly what they were. A feature's
    // own picture (openOn) is played as given.
    if (!openOn) setupKind(scenarioRef.current, mulberry32(seed ^ 0x7e11), { appliedAuthored: false, appliedPlan: false, keeperStrength: strengthRef.current });
    // A kind's hard rules hold for a feature's own picture too (a penalty in
    // the trial, the gallery's Play) — see enforceHardRules.
    enforceHardRules(scenarioRef.current);
    // v0.15 items 12 + 20 — the same last word makeChance gives every later
    // chance (the whole goal, room to pull back). A feature's own picture
    // (openOn) arrives finished.
    if (!openOn) finishServedFrame(scenarioRef.current);
    stageScene(scenarioRef.current, scene);
  }
  const ballRef = useRef<Ball | null>(null);
  /**
   * How many times THIS scenario's rng has been drawn from, since it was
   * (re)seeded — reset to 0 every time rngRef itself is reassigned. Exists
   * for exactly one reason: a goal replay has to reproduce the rng in the
   * exact state it was in the instant `launch()` was called, not just start
   * a fresh stream from the same seed — see `launch`'s own noise term and
   * every rng draw the physics loop makes after it. Nothing between a
   * scenario being (re)seeded and the strike depends on real elapsed time
   * (stepKeeper takes no rng; nothing runs during aim but stepKeeper), so
   * this count is exactly reproducible on replay regardless of how long the
   * player actually took to aim.
   */
  const rngCallCountRef = useRef(0);
  const rngRef = useRef<() => number>(countedRng(seed, rngCallCountRef));
  const seedRef = useRef(seed);

  const phaseRef = useRef<Phase>("aim");
  const [phase, setPhaseState] = useState<Phase>("aim");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  // Game music (Settings → Game music, off by default; lib/star/gameMusic.ts).
  // A career match only: the score, the clock, a knockout and a dribble pick
  // the bed; a goal of yours from behind plays the turning-point cue once.
  const musicScoreRef = useRef(displayScore);
  useEffect(() => {
    if (!matchMode) return;
    const before = musicScoreRef.current;
    musicScoreRef.current = displayScore;
    if (isTurningPoint(before.user, before.opp, displayScore.user)) playTurningPoint();
  }, [matchMode, displayScore]);
  useEffect(() => {
    if (!matchMode) return;
    setMusicScene("match", phase === "postmatch"
      ? { kind: "full-time", us: displayScore.user, them: displayScore.opp }
      : { kind: "match", state: {
          us: displayScore.user, them: displayScore.opp,
          minute: matchMinute, duration: MATCH_DURATION,
          knockout: !!extraTimeEligibility(),
          dribbling: phase === "dribble" || phase === "fpDribble" || phase === "tdDribble",
        } }, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extraTimeEligibility reads refs; the fixture is fixed for the match
  }, [matchMode, phase, displayScore, matchMinute, MATCH_DURATION]);
  useEffect(() => { if (matchMode) setMusicMuted(muted); }, [matchMode, muted]);
  useEffect(() => () => { clearMusicScene("match"); setMusicMuted(false); }, []);

  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  // ── Knuckleball & power shot (lib/star/shotModel.ts; Settings → Gameplay) ──
  // The ⚡ button arms the next shot; letting go of the drag winds up (the
  // defence keeps closing) and then the green-circle strike screen opens.
  const [powerArmed, setPowerArmed] = useState(false);
  const powerArmedRef = useRef(false);
  powerArmedRef.current = powerArmed;
  const windUpRef = useRef<number | null>(null);
  const [windingUp, setWindingUp] = useState(false);
  const [powerStrike, setPowerStrike] = useState(false);

  // ── The run-up (lib/star/penaltyRunup.ts) — every penalty and direct free kick ──
  //
  // Between letting go of the aim and the strike screen: `t` seconds into the
  // jog, the aim you let go with (`dir0`) and how far you've swung it
  // (`nudgeM`, metres along the goal line — a penalty only, `nudge`). The
  // keeper's hop is the keeper brain's own (brainRunUp). Null otherwise.
  const runupRef = useRef<{
    t: number; dir0: Vec2; power: number; nudgeM: number; path: RunupPath;
    nudge: boolean; arrived: boolean;
    /** The taker's run-up style (lib/star/runupStyles.ts): the path, how
     *  long it takes (`runS`) and how his body moves. Looks only. */
    styled: StyledRunup; runS: number;
    /** Somebody else's penalty (v0.15 items 6/7): struck for him on arrival, no strike screen. */
    auto?: { contact: { cx: number; cy: number }; skills: KickSkills };
  } | null>(null);
  /** A sideways drag during the run-up: where it started, and the swing then. */
  const nudgeDragRef = useRef<{ x0: number; y0: number; base: number } | null>(null);
  /** Your two run-up styles, read live (a prop can change between chances). */
  const runupStyleRef = useRef({ pen: penaltyRunupOf(penaltyRunup), fk: freeKickRunupOf(freeKickRunup) });
  runupStyleRef.current = { pen: penaltyRunupOf(penaltyRunup), fk: freeKickRunupOf(freeKickRunup) };
  /**
   * Whose run-up this picture's kick is, from the set for this kind of kick
   * (a penalty's or a free kick's): yours, or — on a kick the match takes for
   * somebody else (items 6/7) — that taker's own, picked from his id so the
   * same player always runs up the same way.
   */
  const runupStyleFor = (sc: Scenario): RunupId => {
    const auto = autoKickOf(sc);
    return auto
      ? takerRunupFor(sc.kind, auto.taker.id || auto.taker.name)
      : yourRunupFor(sc.kind, runupStyleRef.current.pen, runupStyleRef.current.fk);
  };
  /** The strike screen's countdown for this kick, seconds — null = no limit (every kick but a run-up). */
  const [contactTimerS, setContactTimerS] = useState<number | null>(null);
  // ── A feature's teaching pause (`holdAt`) — never set in the real match ──
  const holdAtRef = useRef(holdAt);
  holdAtRef.current = holdAt;
  const heldRef = useRef(false);
  const [held, setHeld] = useState(false);
  /** Ask the feature whether to freeze here; if so, stay frozen until it lets go. */
  const tryHold = (moment: "runup" | "contact") => {
    const ask = holdAtRef.current;
    if (!ask) return;
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      heldRef.current = false;
      setHeld(false);
    };
    if (ask(moment, release) && !done) {
      heldRef.current = true;
      setHeld(true);
    }
  };
  // Item 5r — a "cheeky" kick (a penalty chipped or down the middle, or an
  // open-play chip) that didn't go in costs a little reputation. The kind of the kick just struck,
  // and the misses so far this match (handed out with the match's stats).
  const cheekyStrikeRef = useRef<CheekyKind | null>(null);
  const cheekyMissesRef = useRef<{ kind: CheekyKind; minute: number }[]>([]);
  const cheekyStats = () => (cheekyMissesRef.current.length ? { cheekyMisses: [...cheekyMissesRef.current] } : {});

  // ── Extra time / penalty shootout ──
  //
  // Set only when a level knockout tie needs a shootout — see
  // `resolveFullTime` below, called from the Full Time pause instead of
  // finalising the match immediately. `wentToExtraTimeRef` records whether
  // extra time was played at all (even if it then resolved outright,
  // without needing penalties) so the final MatchStats carries it either way.
  const wentToExtraTimeRef = useRef(false);
  const shootoutResultRef = useRef<{ home: number; away: number } | null>(null);
  // The live-chance loop's own "how far can this match still run" ceiling.
  // Every `advanceUntilInvolved`/`advanceTo` call in `startSimulation` reads
  // THIS, not the constant `MATCH_DURATION`, so extra time can extend it in
  // two real 15-minute stages and the interactive aim/contact/flight loop
  // just keeps running against the new ceiling — instead of extra time being
  // a single non-interactive jump straight to the final minute. 0 = normal
  // time; 1 = first half of extra time in progress; 2 = second half.
  const matchCeilingRef = useRef(MATCH_DURATION + ADDED);
  const extraTimeStageRef = useRef<0 | 1 | 2>(0);
  // A live shootout kick in progress — see `loadShootoutKick`. Non-null
  // while one kick of the shootout is on the pitch; resolveOutcome reads
  // this to report the REAL physical result back to the shootout state
  // machine instead of resuming the ordinary match simulation.
  const shootoutKickRef = useRef<{ resolve: (scored: boolean) => void } | null>(null);
  /**
   * The live shootout (v0.15 item 7): every kick played on the pitch — yours
   * to take, everybody else's watched (their kicks at your keeper, from the
   * same camera end). Set when a knockout goes to penalties.
   */
  const [liveShootout, setLiveShootout] = useState<{
    homeClub: string; awayClub: string; yourSide: "home" | "away";
    home: PenaltyTaker[]; away: PenaltyTaker[];
    homeKeeper: { strength: number; id?: string; name?: string; shortName?: string; face?: string };
    awayKeeper: { strength: number; id?: string; name?: string; shortName?: string; face?: string };
  } | null>(null);
  /** The latest handleContact, for an automatic kick struck from a timer. */
  const handleContactRef = useRef<((contact: { cx: number; cy: number }, over?: { dir: { x: number; y: number }; power: number; skills?: KickSkills }) => void) | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  // ── v0.15 items 21 + 22 ──
  /** Where the thumb landed, in pitch metres. The pull is measured from HERE,
   *  not from the ball's centre: a thumb that lands on the goal side of the
   *  ball no longer has to drag back across it before any power starts (the
   *  ball can be grabbed from up to 28% of the frame away). */
  const thumbOriginRef = useRef<{ x: number; y: number } | null>(null);
  /** The same landing spot on the glass (client px). With the camera tipped
   *  back the drag is copied across on the SCREEN, so a given finger movement
   *  is the same pull (and the same direction) wherever on the zone it starts. */
  const thumbOriginClientRef = useRef<{ x: number; y: number } | null>(null);
  /** When the drag passed the dead zone (performance.now()). From then on an
   *  ordered run is under way, the nearest opponent closes you down, and the
   *  chance can no longer be taken back. */
  const aimCommitRef = useRef<number | null>(null);
  /** The defender closing you down this chance, if anyone is. */
  const presserRef = useRef<Scenario["defenders"][number] | null>(null);
  /** The closer started behind you (on your side of the ball) — he goes round
   *  you, and fouls you more often (lib/star/pressure.ts, Harry 1 Oct 2026). */
  const presserBehindRef = useRef(false);
  const pressureRef = useRef(pressure);
  pressureRef.current = pressure;
  /** A foul while you pulled back: the set piece the next chance is. */
  const setPieceNextRef = useRef<ScenarioKind | null>(null);
  /** …or, when it is not yours to take, the one handed over at the next run-on. */
  const handoverRef = useRef<ScenarioKind | null>(null);
  /** The power stat as it is NOW — it used to be read once, at the first
   *  render, so a boot or a Play Area dial changed mid-match never reached the
   *  drag. */
  const skillsRef = useRef(skills);
  skillsRef.current = skills;

  // ── THE ARMBAND ────────────────────────────────────────────────────────────
  //
  // Two things a captain can do that nobody else on the pitch can, both of them
  // decided before the ball is struck and neither of them costing you the
  // unlimited time to decide that every situation gives you.
  //
  //   TAP a team-mate   — the man you want it laid off to. Whoever receives your
  //                       pass plays it to him instead of shooting, and HE
  //                       shoots. Tap again to take the order back.
  //   DRAG from one     — where you want him to run. He goes when you play it.
  //
  // Both live on the scenario itself (`relayTo`, `Runner.commandedTo`), because
  // the engine is what has to read them. These refs are the gesture in progress
  // and a version counter to get the overlay redrawn.
  const isCaptain = !!career?.captain;
  const isCaptainRef = useRef(isCaptain);
  isCaptainRef.current = isCaptain;
  // `target` is "follower" for the poacher — he has no `.pos`, only `.x`/`.y`
  // (see Follower's own doc), so he can't share a Runner-shaped slot here.
  const captainDragRef = useRef<{ target: Runner | "follower"; from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);
  /** Bumped whenever an order changes, purely so the React overlay re-renders. */
  const [orderTick, setOrderTick] = useState(0);
  const bumpOrders = () => setOrderTick(t => t + 1);

  // Touch Mode (Boot.extraTouch) — a personal in-match toggle, not a
  // persisted preference (unlike mute): defaulting to off every match is
  // safer than a returning player being confused why kicks behave
  // differently without remembering they left it on last time.
  const [touchModeOn, setTouchModeOn] = useState(false);
  const touchModeOnRef = useRef(touchModeOn);
  touchModeOnRef.current = touchModeOn;

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [stats, setStats] = useState({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0, goalsPen: 0, goalsTap: 0, goalsOut: 0, passesSafe: 0, passesAmb: 0, missesOn: 0, missesPen: 0, misses1v1: 0 });
  const [feed, setFeed] = useState<string[]>([]);
  const feedRef = useRef<string[]>([]);
  feedRef.current = feed;
  /**
   * The four-line ticker under the canvas, and ONLY the ticker.
   *
   * Every beat of a scenario building up gets one of these — the cross being
   * swung in, the knock-down, the shot going in off the woodwork — and that is
   * right for a strip that lives beside the pitch and only has to say what is
   * happening right now. It is wrong for the permanent record: piping every one
   * of these into the match log put a whole buildup's worth of flavour text
   * into the highlighted list meant for the moments that actually matter, and
   * a five-line scramble in the six-yard box read as five separate highlights.
   * See `logMoment` for what is actually worth keeping.
   */
  const pushLine = useCallback((line: string) => {
    setFeed((f) => [...f, line].slice(-4));
  }, []);

  /**
   * The permanent record — a chance opening up, a goal, who made it.
   *
   * Three things only. Not "everything said while the ball was near your
   * player": one line when a chance becomes yours to play, one when it ends in
   * a goal, one more when that goal had a name behind it.
   */
  const logMoment = useCallback((text: string, tone: LogLine["tone"], minute?: number) => {
    // An assist follows straight under its goal, which has already printed the
    // minute — repeating it a line down says the same minute twice for what
    // reads as one moment. See the matching rule in linesFrom.
    const shown = tone === "assist" ? undefined : (minute ?? matchMinuteRef.current);
    setLog(l => [...l, logLine(text, tone, shown)]);
  }, []);

  /** Your own name, the way the commentary says everybody else's — a surname,
   *  never the second person. The sandbox has no career and so no name; "you"
   *  is right there, since there is nobody else it could mean. */
  const playerLabel = () => realGoalRef.current?.youName || careerRef.current?.player.lastName || "you";

  /**
   * The ball reaching you — one line, once per chance, and it used to be the
   * exact same sentence every single time ("The move works its way to X."),
   * which stood out precisely because everything AROUND it (QUIET_USER/OPP,
   * SIM_COMMENTARY_USER/OPP) already had a real pool to draw from. `X` is
   * always the OBJECT of these, never the subject — `playerLabel()` can read
   * "you" (the sandbox, with no career to name), and "you is picked out"
   * is not a sentence, so every line here is built to take that safely.
   */
  const momentPool = (): string[] => {
    const you = playerLabel();
    return [
      `The move works its way to ${you}.`,
      `It breaks for ${you}.`,
      `The ball is worked through to ${you}.`,
      `It's picked out for ${you}.`,
      `The move reaches ${you}.`,
      `It comes to ${you}.`,
      `A gap opens up for ${you}.`,
      `The ball finds its way to ${you}.`,
    ];
  };
  const momentLine = () => {
    const pool = momentPool();
    return pool[Math.floor(rngRef.current() * pool.length)];
  };

  /**
   * A real commentator never says "your team" — he names the side. Reported
   * directly, with "Your team have the better of this spell" as the example:
   * it reads as the game talking AT the player rather than describing the
   * match. `QUIET_USER`/`SIM_COMMENTARY_USER` (below, and in hiddenMatch.ts)
   * carry a `{club}` token instead of hardcoding "your"/"you"; this is the
   * one place that token gets resolved, so every line that flows through it
   * — whichever bank it came from — ends up naming the actual club. The
   * sandbox has no real career to name, so it falls back to a plain "Your
   * Side" there, same reasoning as `playerLabel`'s "you".
   */
  const attributeClub = (text: string, isOpponent?: boolean): string => {
    if (!text.includes("{club}")) return text;
    const club = isOpponent
      ? shortClub(fixtureOpponentRef.current)
      : careerRef.current ? shortClub(careerRef.current.player.club) : "Your Side";
    return text.replaceAll("{club}", club);
  };

  /**
   * Read out the next line, and stop when the queue is empty.
   *
   * A timer rather than a Continue button, because a match is a thing that
   * happens to you at its own pace. The pace is `dwellFor`, which holds a goal
   * longer than a throw-in, divided by whatever speed you have chosen — and
   * `pause` freezes it entirely at the interval and at full time, which are the
   * only two moments the game genuinely needs an answer from you.
   */
  /** Stop at the interval: the half-time line, the score so far, and the
   *  Second Half button (with the half-time KIB can beside it). */
  const showHalfTime = () => {
        halfTimeShownRef.current = true;
        // Read off REVEALED goals, same fix and same reason as
        // `displayScore` above — not `userScoreRef`/`oppScoreRef`, which are
        // the simulation's raw running total for the whole batch just
        // resolved and can already be well ahead of what's actually been
        // shown. Reported directly: half time read Coventry 1-0 up at
        // minute 45 when their goal didn't actually happen (commentary-wise)
        // until minute 61 — the batch that produced the half-time line had
        // already simulated straight through to 61 and committed that goal
        // to the ref before any of it had streamed out. Counting from `l` —
        // the functional updater's own argument — is guaranteed to include
        // exactly what's been pushed to the log so far, `next` included,
        // with no risk of reading a stale closure.
        //
        // Real scoreline order — home side's goals first — not "yours,
        // then theirs" regardless of ground. Reported directly: away at
        // Sunderland, losing 0-1, read as "Half Time 0-1" — which, printed
        // in that order, reads as the AWAY side (you) leading 1-0, the
        // opposite of what was actually happening.
        setLog(l => {
          const userGoals = l.filter(x => x.tone === "goal").length;
          const oppGoals = l.filter(x => x.tone === "oppGoal").length;
          const homeHalfScore = fixtureHomeRef.current ? userGoals : oppGoals;
          const awayHalfScore = fixtureHomeRef.current ? oppGoals : userGoals;
          return [...l, logLine(`Half Time  ${homeHalfScore} - ${awayHalfScore}`, "period", HALF_TIME_MINUTE)];
        });
        setPause({
          cta: "Second half →",
          halfTime: true,
          onContinue: () => setPause(null),
        });
  };

  /**
   * THE MATCH CLOCK (22 Sep 2026).
   *
   * It used to jump straight to each commentary line's minute (4', then 9',
   * then 21'). Now it walks up one minute at a time, about MINUTE_TICK_MS
   * per minute divided by your speed, and each line appears when the clock
   * reaches it. Energy is charged minute by minute as it passes (setClock),
   * which is what makes the energy bar fall live.
   */
  const MINUTE_TICK_MS = 700;
  /** v0.25: the first stretch of a match you start skips the clock walk. */
  const quickStartRef = useRef(false);
  useEffect(() => {
    if (pause || heldByScreen || queue.length === 0) return;
    const next = queue[0];
    const cur = matchMinuteRef.current;
    if (next.minute !== undefined && next.minute > cur) {
      const t = setTimeout(() => {
        const target = cur + 1;
        if (!halfTimeShownRef.current && target > HALF_TIME_MINUTE && cur >= HALF_TIME_MINUTE) {
          halfTimeShownRef.current = true;
          showHalfTime();
          return;
        }
        setClock(target);
      }, Math.round(MINUTE_TICK_MS / Math.max(1, speed)));
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLog(l => [...l, next]);
      setQueue(q => q.slice(1));
      if (next.minute !== undefined) setClock(next.minute);
      if (!halfTimeShownRef.current && next.minute !== undefined && next.minute > HALF_TIME_MINUTE) {
        halfTimeShownRef.current = true;
        showHalfTime();
      }
    }, dwellFor(next.tone, speed));
    return () => clearTimeout(t);
  }, [queue, pause, heldByScreen, speed, matchMinute]);

  // ── Other scores, revealed as the clock passes each goal (item 35) ──
  // Only clubs you have ticked get a commentary line and a card, and only
  // one card is up at a time: the newest goal replaces the last.
  useEffect(() => {
    const goals = liveWeekRef.current?.goals;
    if (!goals || liveShownRef.current >= goals.length) return;
    const due: LiveGoal[] = [];
    while (liveShownRef.current < goals.length && goals[liveShownRef.current].minute <= matchMinute) {
      due.push(goals[liveShownRef.current++]);
    }
    const mine = goalsForFollowed(due, followingRef.current);
    if (!mine.length) return;
    // The card only, no 📻 line in the commentary: Harry, 28 Sep 2026, "I
    // prefered the old score notification to the in chat one, fit the
    // aesthetic more". Every score is still in the Scores panel.
    // A jump in the clock (coming off the bench) skips the older goals;
    // only one from the last few minutes pops up.
    const latest = mine.filter(g => matchMinute - g.minute <= 3).pop();
    if (latest) setLivePop({ ...latest, id: ++livePopIdRef.current });
  }, [matchMinute]);

  /** The queue has run dry: go wherever the passage was heading.
   *
   * Reported directly: tapping the speed button mid-passage could freeze
   * the match dead at whatever minute it happened to land on, with no
   * error and no way to progress short of a refresh — worse right after
   * a fast run of taps (1x→2x→4x), and it had happened to more than one
   * person, so this was a real, recurring race rather than bad luck.
   *
   * The bug: `simContinueRef.current` used to be cleared the moment this
   * effect SCHEDULED the timeout, not when it actually RAN — so if `speed`
   * (or `pause`/`phase`) changed before that ~700ms/speed beat elapsed,
   * React re-ran the effect, the cleanup below cancelled the pending
   * timer, and the re-run read `simContinueRef.current` back out as
   * already-null. The continuation — the only thing that ever moves the
   * match past an empty queue — was gone for good, and nothing ever put
   * it back. Consuming it inside the timeout callback itself, right
   * before calling it, means a cancelled-and-rescheduled timer simply
   * finds the same continuation still sitting there next time.
   */
  useEffect(() => {
    if (pause || heldByScreen || queue.length > 0 || phase !== "feed") return;
    const go = simContinueRef.current;
    if (!go) return;
    // Walk the clock up to the minute the next chance happens, rather than
    // jumping to it — same ticking clock as the commentary above.
    const simMinute = matchStateRef.current.minute;
    if (simMinute > matchMinuteRef.current) {
      const cur = matchMinuteRef.current;
      const t = setTimeout(() => {
        const target = cur + 1;
        if (!halfTimeShownRef.current && target > HALF_TIME_MINUTE && cur >= HALF_TIME_MINUTE) {
          halfTimeShownRef.current = true;
          showHalfTime();
          return;
        }
        setClock(target);
      }, Math.round(MINUTE_TICK_MS / Math.max(1, speed)));
      return () => clearTimeout(t);
    }
    // A beat on the last line before the pitch takes the screen, so a chance
    // does not arrive on top of the sentence that set it up.
    const t = setTimeout(() => {
      simContinueRef.current = null;
      // The stretch is over; a mode switch from here on shapes the next one.
      stretchRef.current = null;
      go();
    }, Math.round(700 / Math.max(1, speed)));
    return () => clearTimeout(t);
  }, [queue, pause, heldByScreen, phase, speed, matchMinute]);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  // New ball: flight time not yet stepped (fixed 1/180 s steps, see the loop).
  const physAccRef = useRef(0);
  // Last-seen position per figure, so the renderer can tell who is moving and
  // put them in a running pose. Purely cosmetic — nothing reads it back.
  const motionRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Seconds remaining on the player's kicking pose. A strike takes one frame,
  // so without a hold the swing would never actually be seen.
  const kickPoseRef = useRef(0);
  // Animations: New (lib/star/actionAnim.ts) — each man's latest touch of the
  // ball and when it started, keyed by the id he is drawn under, plus how far
  // through the current ball's action log the screen has read.
  const actorAnimRef = useRef<Map<string, ActorAnim>>(new Map());
  const seenActionRef = useRef<{ ball: Ball | null; seq: number }>({ ball: null, seq: 0 });
  const playersLook = useMatchPlayersLook();
  // New view, 3D figures (lib/star/sprites.ts): each man's smoothed speed,
  // heading and distance run, so the baked clip matches what he is doing and
  // his feet keep pace with the grass. Pictures only — nothing reads it back.
  /** The camera angle (lib/star/cameraTilt.ts): degrees, read once at mount,
   *  and the canvas's tilt geometry, rebuilt whenever the canvas is sized.
   *  Classic is always flat. */
  const tiltDegRef = useRef(0);
  /** The angle chosen in Settings (0 in Classic). */
  const tiltSettingRef = useRef(0);
  /** The angle for this chance. Corners and byline crosses stay flat (Harry,
   *  3 Oct 2026: "I don't think the 20 degrees should apply to the
   *  crosses/byline and corners") — they are watched side-on, then cut. */
  const tiltForChance = (sc: Scenario | null | undefined): number =>
    sc && (sc.kind === "corner" || sc.kind === "byline_cross" || (sc.facing ?? "up") !== "up") ? 0 : tiltSettingRef.current;
  /** Tip the canvas to `deg` (0 = flat) for its current size. */
  const applyTilt = (deg: number) => {
    tiltDegRef.current = deg;
    const c = canvasRef.current;
    if (!c) return;
    const w = parseFloat(c.style.width) || c.offsetWidth, h = parseFloat(c.style.height) || c.offsetHeight;
    tiltGeomRef.current = tiltFor(deg, w, h);
    c.style.transform = tiltCss(tiltGeomRef.current);
  };
  const tiltGeomRef = useRef<Tilt | null>(null);
  /** When the 3D keeper's dive clip started (seconds), or null. */
  const keeperDiveStartRef = useRef<number | null>(null);
  /** Where the 3D keeper landed (canvas px), held while he lies there. */
  const keeperLandRef = useRef<{ x: number; y: number; sc: Scenario; clip: SpriteClip } | null>(null);
  const spriteMotionRef = useRef<Map<string, { x: number; y: number; t: number; vx: number; vy: number; dist: number; facing: number }>>(new Map());
  // Whose goal it was, while the result is up (they celebrate). Picture only.
  const goalSideRef = useRef<"us" | "them" | null>(null);
  // Action banner ("PASS" / "GOAL") and how long it stays up. The texture pack
  // picks the style (texturePack.ts bannerStyle): the Arcade pack plays
  // "Arcade pop" (ArcadeBanner.tsx, its own clock); every other pack keeps the
  // old banner exactly as it was.
  const arcade = useArcadeBanner();
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const actionBannerTextRef = useRef<HTMLDivElement>(null);
  const offsideBannerTextRef = useRef<HTMLDivElement>(null);
  const bannerTimerRef = useRef<number | null>(null);
  // Mikey's new pop-ups (Settings, default Old): TV graphics instead
  // (MikeyPopup.tsx). Old leaves everything below exactly as it was.
  const mikey = useMikeyPopup();
  const mikeyLook = useMikeyPopupsLook();
  const showAction = useCallback((text: string) => {
    if (sceneRef.current?.banners === false) return;
    if (mikeyPopupsLook() === "new") { showMikeyPopup(text); return; }
    if (bannerStyle() === "arcade") { arcade.show(text, bannerSideNow()); return; }
    setActionBanner(text);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setActionBanner(null), ACTION_BANNER_MS);
  }, [arcade.show]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Cosmetic FX state (never touches physics) ---
  const reducedMotionRef = useRef(false);
  const trailRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ t: 0, dur: 1, mag: 0 });   // camera nudge
  const flashRef = useRef({ t: 0, dur: 1 });            // goal flash
  const seamRef = useRef(0);                            // ball roll angle
  /** A ball in the air leaves a few puffs of air behind it (Harry, 13 Oct 2026). Screen px, newest last. */
  const airPuffsRef = useRef<{ x: number; y: number; r: number; t: number }[]>([]);
  /**
   * Match feel: New (lib/star/matchFeel.ts) — the juice on every hit. Looks
   * and sound only: the freeze (`hitStop`) holds the whole loop for a few
   * frames, which only delays the flight; the ball is stepped exactly as
   * before once it lets go. Times are performance.now() seconds.
   */
  const feelRef = useRef<{
    /** Seconds the loop is held (wind-up + freeze at the contact). */
    hitStop: number;
    /** Seconds of that which are the wind-up (before the contact). */
    windUp: number;
    windUpTotal: number;
    /** The strike waiting for the end of the wind-up to land. */
    pending: { f: StrikeFeel; x: number; y: number; z: number; vx: number; vy: number } | null;
    /** The strike that landed: when, how hard, which way. */
    struck: { at: number; f: StrikeFeel } | null;
    /** The camera punch: started at, length, px, pitch direction. */
    punch: { at: number; dur: number; px: number; vx: number; vy: number };
    /** Ball squash: started at, amount, pitch axis. */
    squash: { at: number; amt: number; ax: number; ay: number };
    /** Bursts, puffs, sparks and clangs being drawn (pitch metres). */
    fx: { kind: "impact" | "dust" | "glove" | "clang"; at: number; dur: number; x: number; y: number; z: number; size: number; vx: number; vy: number; power: number; turf: boolean; scuff: boolean; salt: number }[];
    /** The ball as it was last frame, to see it land or be hit. */
    prev: { ball: object; x: number; y: number; z: number; vx: number; vy: number; vz: number } | null;
    /** The net bulging round a goal. */
    net: { at: number; amt: number } | null;
    /** How fast your follow-through plays (harder = held longer). */
    followRate: number;
    salt: number;
  }>({
    hitStop: 0, windUp: 0, windUpTotal: 0, pending: null, struck: null,
    punch: { at: -9, dur: 0.3, px: 0, vx: 0, vy: -1 },
    squash: { at: -9, amt: 0, ax: 0, ay: -1 },
    fx: [], prev: null, net: null, followRate: 1, salt: 0,
  });
  /**
   * The same real ball ContactBall already puts on the strike screen —
   * public/star/ball.webp — instead of a canvas-drawn white disc. Reported
   * directly: "the football that you kick in the game... is something that
   * you have created, which looks just like a white circle" next to a real
   * photo everywhere else the ball appears. Loaded once per match rather
   * than at module scope so it never touches `Image` during SSR.
   */
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    // ── The plain white ball, actually explained ──
    //
    // Reported directly, more than once: "the ball is invisible to kick,
    // and it's just plain white, like the graphics are lost." That IS the
    // real bug, not a mystery — it is exactly `drawBall`'s own fallback
    // circle, further down, which only ever draws when `img.complete &&
    // img.naturalWidth > 0` is false. The comment that used to sit here
    // called that "effectively never" — true for the ordinary one-frame
    // gap while the image is still loading, but there was NO handling at
    // all for the image genuinely FAILING to load (a real network hiccup,
    // far more likely on the mobile connections this game is mostly played
    // on) — a single failed fetch left `ballImgRef.current` pointed at a
    // permanently-incomplete Image for the rest of that match, with nothing
    // ever trying again. "Sometimes in a match" is exactly what a rare,
    // never-retried failure looks like.
    //
    // Retries with backoff, a fresh Image() each attempt (reassigning `src`
    // on the same failed element does not reliably restart the load in
    // every browser) and a cache-busting query param (so a CDN edge that
    // cached the failure itself doesn't just hand back the same failure
    // immediately). Five attempts spans a little over ten seconds — long
    // enough to ride out a real hiccup, short enough that a genuinely
    // offline device still just plays with the plain fallback disc, which
    // was always the safe worst case here, never a crash.
    let cancelled = false;
    let attempt = 0;
    const MAX_ATTEMPTS = 5;
    const load = () => {
      const img = new Image();
      img.onerror = () => {
        if (cancelled) return;
        attempt++;
        if (attempt >= MAX_ATTEMPTS) return;
        window.setTimeout(load, 400 * 3 ** (attempt - 1));
      };
      img.src = attempt === 0 ? "/star/ball.webp" : `/star/ball.webp?retry=${attempt}`;
      ballImgRef.current = img;
    };
    load();
    return () => { cancelled = true; };
  }, []);

  /**
   * Real player photos, composited onto the same head circle `footballer`
   * already draws for everybody — see Identity.face and its doc.
   *
   * Keyed by URL rather than the one ref the ball above uses, because a
   * single match can put dozens of different real faces on screen over its
   * lifetime — both squads, subs included — not one fixed graphic. Lighter
   * retry than the ball on purpose: a slow or missing photo just leaves that
   * one man drawn as the plain circle every figure with no real identity at
   * all already falls back to — a completely ordinary state here, not a
   * broken one, so it isn't worth chasing as hard as the one asset the whole
   * pitch would otherwise be missing.
   */
  // See lib/star/faceImageCache.ts — extracted from what used to be a local
  // closure here so the first-person dribble mode can draw real faces too
  // off the exact same cache shape, not a second copy of it.
  // Never a blank circle: a man with no identity to draw from (the trial,
  // training — no squad) wears a stable fake face for his role, and a photo
  // that fails to load becomes one too (faceImageCache.ts).
  const faceImageCacheRef = useRef(createFaceImageCache());
  const getFaceImage = (url: string | undefined): HTMLImageElement | undefined =>
    faceImageCacheRef.current.get(url);
  /**
   * A face that is on screen THIS frame. A shootout brings on a new taker every
   * kick and the kick is struck ~0.7 s later (AUTO_STAND_MS), so his photo is
   * still loading — or failing, and its fake-face fallback only lands after a
   * retry — for the whole kick: a plain circle head (Kluivert in the filmed
   * shootout). Until the real photo has actually loaded he wears the fake face
   * the cache would fall back to for that photo anyway (fallbackFaceFor), so a
   * photo that never loads keeps the SAME fake face throughout; the real photo
   * takes over the frame it arrives. No photo at all: the fake face for `key`.
   */
  const readyFaceOr = (url: string | undefined, key: string): HTMLImageElement | undefined => {
    const img = getFaceImage(url);
    if (img && url && ((img.complete && img.naturalWidth > 0) || FAKE_FACES.includes(url))) return img;
    return getFaceImage(fallbackFaceFor(url || key));
  };

  // Respect prefers-reduced-motion: no shake, no confetti, only a faint brief flash.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const on = (e: MediaQueryListEvent) => { reducedMotionRef.current = e.matches; };
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  /**
   * How every head on the pitch draws — position, scale, backing circle,
   * outline — see lib/star/faceStyle.ts and drawPlayerHead.ts. Read once on
   * mount, same as reduced-motion above: Settings (and the Face Editor
   * reached from it) is a separate phase this component isn't mounted
   * during, so there's no live change to react to here — only ever a fresh
   * value the NEXT time a match opens.
   */
  const faceStyleRef = useRef(DEFAULT_FACE_STYLE);
  useEffect(() => { faceStyleRef.current = loadFaceStyle(); }, []);
  // A separate scale/offset/crop specifically for the seven fake headshots
  // (lib/star/fakeFaceStyle.ts) — a different batch of images from real
  // photos, with their own framing, so they need their own tuned values.
  // Same load-once-per-match convention as faceStyleRef just above.
  const fakeFaceStyleRef = useRef(DEFAULT_FAKE_FACE_STYLE);
  useEffect(() => { fakeFaceStyleRef.current = loadFakeFaceStyle(); }, []);

  // --- Canvas sizing (device-pixel-ratio aware) ---
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      // Capped at 2, like every other canvas in the game (FiveASide,
      // FirstPersonDribble, TrainingMinigame…). Most phones report 3 (some
      // Androids 3.5); drawing the match at 3× paints 9 pixels for every 4
      // at 2×, 2.25× the work every frame, for a difference nobody can see
      // at arm's length. Everything here is drawn in proportion to
      // canvas.width, so only sharpness changes, never size or position.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      // The camera angle: the finished picture tipped back (cameraTilt.ts).
      tiltSettingRef.current = newViewRef.current ? cameraTilt() : 0;
      applyTilt(tiltForChance(scenarioRef.current));
      // New view: the camera holds the canvas's own shape, so a new shape
      // means a new frame — never while a ball is in flight. Framed on the
      // chance's own spots (frameOnChance): a resize during a build-up (a
      // phone's address bar sliding away) used to frame the chance on the
      // build-up's men and play it there — measured 20 px off and 38% out.
      if (newViewRef.current && !ballRef.current && scenarioRef.current) frameOnChance();
    };
    resize();
    window.addEventListener("resize", resize);
    // The new view's pitch box changes height after mount (it measures the
    // room it has), which a window resize never reports.
    const ro = newViewRef.current && typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    return () => { window.removeEventListener("resize", resize); ro?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A frame reader's picture goes in the pitch box, over the 2D canvas.
  useEffect(() => {
    const o = frameObsRef.current;
    if (!o?.attach || !wrapRef.current || !canvasRef.current) return;
    return o.attach(wrapRef.current, canvasRef.current) || undefined;
  }, []);

  // ── New view: the pitch fills the phone's height ──
  //
  // As tall as the room under whatever sits above it (the site's pinned bars,
  // this match's own scoreboard), between the classic 5:8 and option D's
  // 38 × 83 m. Measured once, and again only when the WIDTH changes — a phone's
  // address bar sliding away changes the height every scroll, and the pitch
  // must not change shape under a drag.
  const measuredWRef = useRef(0);
  useIsoLayoutEffect(() => {
    if (!newViewRef.current) return;
    const measure = (force: boolean) => {
      const wrap = wrapRef.current, root = rootRef.current;
      if (!wrap || !root) return;
      const w = wrap.getBoundingClientRect().width;
      if (!force && Math.abs(w - measuredWRef.current) < 1) return;
      measuredWRef.current = w;
      const above = wrap.getBoundingClientRect().top - root.getBoundingClientRect().top;
      let room = window.innerHeight - pinnedTopHeight(root) - above - 12;
      // Inside a clipped box smaller than the screen (the phone's Kickabout
      // app), the box is the room. A wrapper that merely hugs this match
      // (its bottom is ours) says nothing about the room, so it is skipped.
      const rootBottom = root.getBoundingClientRect().bottom;
      const rootTop = root.getBoundingClientRect().top;
      for (let el = root.parentElement; el && el !== document.body; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY;
        if (oy !== "hidden" && oy !== "clip") continue;
        const b = el.getBoundingClientRect().bottom;
        if (b > rootBottom + 1 && b < window.innerHeight) room = Math.min(room, b - rootTop - above - 4);
      }
      setNewViewH(newViewCanvasHeight(w, room));
    };
    measure(true);
    const on = () => measure(false);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // --- Announce the very first scenario + set its viewport ---
  useEffect(() => {
    // Watching a saved goal: skip the whole opening entirely. The scenario,
    // rng and strike are all already decided — see GoalReplay — so this
    // restores that exact moment and goes straight to the flight that
    // follows it, rather than building a new random chance and waiting on
    // aim/contact input nobody is going to give it.
    if (replayOfRef.current) {
      const r = replayOfRef.current;
      scenarioRef.current = JSON.parse(JSON.stringify(r.scenario));
      frameScenario(scenarioRef.current, true);
      const replayRng = countedRng(r.seed, rngCallCountRef);
      for (let i = 0; i < r.callsBeforeStrike; i++) replayRng();
      rngRef.current = replayRng;
      matePlaysRef.current = [];
      ballRef.current = r.shot
        ? launchShot(scenarioRef.current, r.dir, r.power, r.contact, r.skills, replayRng, r.shot, r.shot, launch).ball
        : launch(scenarioRef.current, r.dir, r.power, r.contact, r.skills, replayRng);
      applyAirborne(ballRef.current, scenarioRef.current, (r.contact as StrikeContact).air);
      // The keeper brain, put back exactly as he was at the strike, then the
      // same strike stream — so the replay throws the same dive.
      if (r.keeperBrain) {
        brainRestore(scenarioRef.current, r.keeperBrain);
        brainStrike(scenarioRef.current, ballRef.current, r.keeperBrain.strikeSeed);
      } else if (r.penaltyRead) applyPenaltyRead(scenarioRef.current, r.penaltyRead);
      strikeRuleRef.current = r.kindStrike ?? null;
      if (r.kindStrike) replayStrike(scenarioRef.current, ballRef.current, r.kindStrike);
      // Draw the flight's substep sizes from the recorded queue instead of
      // this session's own frame timing — see GoalReplay.flightDtLog. Absent
      // on a replay saved before this existed, which falls back to live
      // device timing the way replay always used to (imperfectly).
      replaySubstepsRef.current = r.flightDtLog ?? null;
      replaySubstepIdxRef.current = 0;
      setLog([logLine("Replay", "period", 0)]);
      setPhase("flight");
      return;
    }
    // The opening scenario is built before this component mounts, so it needs
    // its defensive shape assigning here too — and its PEOPLE, the same as
    // every later chance gets in loadScenario. Without the two cast calls the
    // first chance of a test screen (the gallery's Play, which only ever plays
    // its opening picture) was played by nobody in particular: blank heads,
    // and team-mates finishing on the generic formula instead of their own.
    scenarioRef.current.conditions = conditionsRef.current;
    castScenario(scenarioRef.current, onPitch(careerRef.current?.squad ?? []));
    initDefenders(scenarioRef.current, rngRef.current);
    castDefence(scenarioRef.current, oppXIForCast);
    realGoalRef.current?.dress?.(scenarioRef.current);
    dressAutoKeeper(scenarioRef.current);
    standBackForRunup(scenarioRef.current);
    setUpKeeper(scenarioRef.current, (seed ^ 0x4b7e) >>> 0);
    frameScenario(scenarioRef.current);
    // In a real match, kick-off belongs to the match, not to you: it plays until
    // the ball finds you rather than dropping you into a chance in the first
    // minute. The sandbox still opens on a scenario, which is its whole point.
    if (matchModeRef.current) {
      // Coming on as a substitute: the match has already been played without
      // you, so play it — team-mate chances, opponent goals and all — and take
      // the scoreline you inherit rather than starting a fresh 0-0 at the hour.
      if (startMinuteRef.current > 0) {
        seedRef.current += 1;
        const rng = countedRng(seedRef.current, rngCallCountRef);
        rngRef.current = rng;
        const st = matchStateRef.current;
        // Play the match without you until the manager decides to send you
        // on: from the 50th minute, when the scoreline says so.
        const jitter = ((careerRef.current?.week ?? 0) * 37 + (careerRef.current?.season ?? 0) * 11) % 5;
        // Item 24: `startMinute` is the manager's plan off your ladder rung
        // (selectionFor); chasing the game only brings you on earlier.
        const rung = startMinuteRef.current;
        const before = advanceTo(st, hiddenInputs(), rng, 50);
        while (st.minute < 88 && !subComesOnNow(st.minute, st.userScore - st.oppScore, jitter, rung)) {
          before.push(...advanceTo(st, hiddenInputs(), rng, st.minute + 1));
        }
        enteredAtRef.current = st.minute;
        subOnRef.current = true;
        subChancesRef.current = 0;
        userScoreRef.current = st.userScore;
        oppScoreRef.current = st.oppScore;
        // You were on the bench until now — nothing to charge for.
        energyClockRef.current = st.minute;
        subFitnessRef.current = liveEnergyAt(st.minute);
        matchMinuteRef.current = st.minute;
        setMatchMinute(st.minute);
        // The hour you were not on for, read out rather than summarised — the
        // whole point of the commentary screen is that the match you are
        // walking into is one you watched.
        halfTimeShownRef.current = st.minute > HALF_TIME_MINUTE;
        // `announce: false` — nothing here goes into the four-line ticker,
        // which does not exist yet at this point in the match; it all goes
        // straight into the permanent log below instead.
        const named = nameTeamGoals(before, onPitch(careerRef.current?.squad ?? []), rng, false);
        // Every goal stays in, even from before the last 14 lines: the
        // scoreboard counts goal lines in the log (displayScore), so a goal
        // trimmed off here vanished from it — a sub came on at 1-1 on the
        // board in a match the stats screen then called 2-1.
        const early = named.slice(0, Math.max(0, named.length - 14)).filter(e => e.isGoal);
        setLog([
          logLine("Kick Off", "period", 0),
          ...linesFrom([...early, ...named.slice(-14)]),
          logLine("You are coming on.", "you", st.minute),
        ]);
        setPhase("feed");
        setPause({
          label: "You are going on",
          cta: "Get out there →",
          // v0.25: straight into your first chance, as for a starter.
          onContinue: () => { setPause(null); quickStartRef.current = true; startSimulation(); },
        });
        return;
      }
      // Starting: the match opens on the commentary, at nil-nil, with a
      // whistle — not on a pitch waiting for a chance that has not arrived.
      enteredAtRef.current = 0;
      setLog([logLine("Kick Off", "period", 0)]);
      quickStartRef.current = true;
      startSimulation();
      return;
    }
    pushLine(commentaryBuildup(scenarioRef.current.kind, rngRef.current, targetName(scenarioRef.current)));
    playWhistle(); // no-op until the first user gesture primes audio — harmless
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Coordinate helpers (pitch <-> canvas pixels, viewport-aware) ---
  //
  // FLAT. A metre is the same number of pixels everywhere on the frame, in both
  // directions: the pitch is a grid seen from directly above, lines stay
  // parallel, the centre circle is a circle, and a player at the goal is exactly
  // the size of a player at your feet.
  //
  // There used to be a shallow pinhole perspective here, and it was the single
  // biggest reason the game looked wrong. Everything at the goal end was drawn
  // at 64% scale — and in a shooting situation the goal end is where all of it
  // happens, so the goal, the keeper and every defender were a third smaller
  // than they should have been while the empty grass in front of you was full
  // size. It read as "zoomed out" no matter how tight the framing got, because
  // the tightening was being spent on the part of the frame with nothing in it.
  //
  // The game this is modelled on is flat, and looking at the two side by side
  // that is the whole difference.
  const viewportRef = useRef<Viewport>({ x1: -5, x2: 105, y1: -5, y2: 100 });
  /** The situation's framing. It is set once and never moves — see the loop. */
  const baseViewportRef = useRef<Viewport>({ x1: -5, x2: 105, y1: -5, y2: 100 });
  /** PROTOTYPE zoom-to-play: how far this chance's camera is zoomed in (1 = today). */
  const playZoomRef = useRef(1);
  /**
   * B14b (lib/star/runCamera.ts): the ball came back into your run — keep the
   * camera you were watching (set by resolveOutcome, read once by loadScenario).
   */
  const keepRunCamRef = useRef(false);
  /** B14b: an eased widen in progress (from, to, seconds in, zoom at the start). */
  const camEaseRef = useRef<{ from: Viewport; to: Viewport; t: number; zoom0: number } | null>(null);
  /** Figures and ball: divide their size by this (Z2 keeps them today's size). */
  const figZoomDiv = () => (playZoom() === "z2" || playZoom() === "z2max" ? playZoomRef.current : 1);

  /**
   * Which way the frame is turned. "up" is the ordinary view; a crossing
   * situation is watched from the side until the ball reaches the box.
   */
  const facingRef = useRef<Facing>("up");
  /** The grass grain, built once on first paint. */
  const grassRef = useRef<HTMLCanvasElement | null>(null);
  /** New view: the mown pitch under everything, cached per frame and size. */
  const mowRef = useRef<{ key: string; cv: HTMLCanvasElement } | null>(null);

  /**
   * Point the camera at a chance.
   *
   * Classic: the engine's own frame, exactly as it always was. New view
   * (lib/star/matchView.ts): the zoomed-out camera, and the play area — what
   * the engine calls "out" — grows with it. `replay`: a saved goal keeps the
   * play area it was recorded with, so it replays exactly.
   */
  function frameScenario(sc: Scenario, replay = false) {
    // Wide chances: New (lib/star/wideChances.ts) — a tight angle, a cutback
    // or a penalty is watched side-on, like a corner. The real match and plain
    // EnginePlay only: a feature with its own scene keeps its picture, and a
    // goal replay keeps the facing it was recorded in.
    if (newViewRef.current && !replay && !sceneRef.current) turnWideChance(sc, !hasRunup(sc.kind), canvasHW());
    facingRef.current = sc.facing ?? "up";
    // A feature that asks for its own close camera keeps it (scene.ownFrame).
    if (!newViewRef.current || sceneRef.current?.ownFrame) {
      // The new view's canvas is taller than a feature's 5:8 frame. Drawn
      // as it was, the frame was stretched down the screen (a 5:8 frame on a
      // 38 × 83 box: everything 36% too tall). Give the frame the canvas's
      // shape instead: more grass below, the goal end where it was.
      if (newViewRef.current && (sc.facing ?? "up") === "up") {
        const v = sc.viewport, hw = canvasHW(), w = v.x2 - v.x1, h = v.y2 - v.y1;
        if (w > 0 && h > 0 && Math.abs(h / w - hw) > 0.01) {
          if (h / w < hw) sc.viewport = { ...v, y2: v.y1 + w * hw };
          else { const cx = (v.x1 + v.x2) / 2, w2 = h / hw; sc.viewport = { ...v, x1: cx - w2 / 2, x2: cx + w2 / 2 }; }
        }
      }
      viewportRef.current = { ...sc.viewport };
      baseViewportRef.current = { ...sc.viewport };
      return;
    }
    applyTilt(tiltForChance(sc));
    const wasFacing = sc.facing ?? "up";
    const cam = frameForNewView(sc, canvasHW(), replay, tiltDegRef.current);
    // Framing V2 may turn a wide chance side-on while framing it.
    if ((sc.facing ?? "up") !== wasFacing) { facingRef.current = sc.facing ?? "up"; applyTilt(tiltForChance(sc)); }
    viewportRef.current = { ...cam };
    baseViewportRef.current = { ...cam };
    playZoomRef.current = playZoomOf(sc);
    if (playZoomProbe() && typeof window !== "undefined") {
      (window as unknown as { __zg?: unknown }).__zg = {
        sc, cam: { ...cam }, zoom: playZoomRef.current,
        /** A finger pull of (dx, dy) glass px from the ball: power, aim and launch speed. */
        drag: (dx: number, dy: number) => {
          const s = scenarioRef.current, b = s.ball;
          const c = pitchToClient(b);
          const d = pitchFromPointer(c.x + dx, c.y + dy);
          const power = powerFromDrag(d, b);
          const dir = { x: b.x - d.x, y: b.y - d.y };
          const ball = launch(JSON.parse(JSON.stringify(s)), dir, power, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, () => 0.5);
          return {
            pull: screenPull(d, b), power, aimDeg: (Math.atan2(dir.x, -dir.y) * 180) / Math.PI,
            speed: Math.hypot(ball.vel.x, ball.vel.y, ball.vz ?? 0),
          };
        },
      };
    }
    // Where the ball sits down the screen decides where the sandbox's
    // commentary goes: under a corner's ball it would cover the pull-back.
    const fx = (sc.ball.x - cam.x1) / (cam.x2 - cam.x1);
    const f = facingRef.current;
    const down = f === "right" ? fx : f === "left" ? 1 - fx : (sc.ball.y - cam.y1) / (cam.y2 - cam.y1);
    setOverlayTop(f !== "up" && down > 0.62);
  }

  /** The canvas's height / width; until it is measured, the height the pitch box is asking for. */
  function canvasHW(): number {
    const c = canvasRef.current;
    if (c && c.width > 0 && c.height > 0) return c.height / c.width;
    const w = wrapRef.current?.getBoundingClientRect().width ?? 0;
    return w > 0 && newViewHRef.current ? newViewHRef.current / w : 83 / 38;
  }

  const toPx = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current!;
    const vp = viewportRef.current;
    const W = canvas.width, H = canvas.height;
    const fx = (x - vp.x1) / (vp.x2 - vp.x1);      // 0..1 across the pitch
    const fy = (y - vp.y1) / (vp.y2 - vp.y1);      // 0..1 up the pitch, 0 = goal
    // A quarter turn, not a mirror: "right" is the ordinary view rotated
    // clockwise, so the goal ends up on the right and pitch x runs down the
    // screen; "left" is the same turn the other way.
    if (facingRef.current === "right") return { px: (1 - fy) * W, py: fx * H, scale: 1 };
    if (facingRef.current === "left") return { px: fy * W, py: (1 - fx) * H, scale: 1 };
    // Kept so every call site still reads the same; nothing shrinks with
    // distance any more, so it is always 1.
    return { px: fx * W, py: fy * H, scale: 1 };
  }, []);

  /**
   * Is the ball, as DRAWN, wholly outside the match picture? Uses the same
   * numbers the ball is drawn with (drawBall): its spot, lifted by its height,
   * its size growing with height, and its shadow on the grass. True only when
   * the ball AND its shadow are completely past an edge — top, bottom, left or
   * right — in any camera facing. (Clearances, 7 Oct 2026: the hand-back to
   * the commentary happens "when it crosses completely off the screen".)
   */
  const ballOffPicture = (b: Ball): boolean => {
    const c = canvasRef.current;
    if (!c || c.width <= 0 || c.height <= 0) return true;
    const W = c.width, H = c.height;
    const vp = viewportRef.current;
    const turned = facingRef.current !== "up";
    const unit = turned ? H / (vp.x2 - vp.x1) : W / (vp.x2 - vp.x1);
    const uy = turned ? W / (vp.y2 - vp.y1) : H / (vp.y2 - vp.y1);
    const ballPx = newViewRef.current ? Math.max(3, (unit / figZoomDiv()) * 0.5 * NEW_BALL_SCALE * figureGrow()) : Math.max(4.5, unit * 0.5);
    const { px, py, scale } = toPx(b.pos.x, b.pos.y);
    const h = Math.max(0, b.z);
    const by = py - h * uy * scale;
    const br = ballPx * scale * (1 + Math.min(h, 8) * 0.055);
    // The shadow, with room for the new ball's own offset shadow.
    const sr = ballPx * scale * 2;
    const off = (x: number, y: number, r: number) => x + r < 0 || x - r > W || y + r < 0 || y - r > H;
    return off(px, by, br) && off(px, py, sr);
  };

  /** The canvas's own box on the page, as laid out (a tilted canvas's
   *  getBoundingClientRect is the tipped picture's box, not this). */
  const canvasBox = () => {
    const c = canvasRef.current, w = wrapRef.current;
    const r = (w ?? c)?.getBoundingClientRect();
    return {
      left: (r?.left ?? 0) + (w?.clientLeft ?? 0), top: (r?.top ?? 0) + (w?.clientTop ?? 0),
      width: c?.offsetWidth || r?.width || 0, height: c?.offsetHeight || r?.height || 0,
    };
  };
  /** A touch -> where it lands on the (untilted) canvas, as fractions. */
  const clientToCanvasFrac = (clientX: number, clientY: number) => {
    const b = canvasBox();
    if (!(b.width > 0 && b.height > 0)) return { sx: 0, sy: 0 };
    return screenToCanvas(tiltGeomRef.current, clientX - b.left, clientY - b.top, b.width, b.height);
  };

  /** The banner goes to the half of the pitch the ball is NOT in (Arcade pop).
   *  3D: above the play. Polled while a banner is up, so it follows the ball
   *  (a team-mate holding it after your pass is never covered). Near the
   *  middle a banner already up stays put, so it never flip-flops. */
  const bannerSideNow = (cur?: BannerSide): BannerSide => {
    try {
      if (frameObsRef.current?.hide2D) return "top3d";
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r || !(r.height > 0)) return "top";
      const q = pitchToClient(ballRef.current ? ballRef.current.pos : scenarioRef.current.ball);
      const fy = (q.y - r.top) / r.height;
      if ((cur === "top" || cur === "bottom") && fy > 0.4 && fy < 0.6) return cur;
      return fy < 0.5 ? "bottom" : "top";
    } catch { return cur ?? "top"; }
  };
  /**
   * Mikey's new pop-ups: a GOAL (yours, a team-mate's, or theirs from the
   * spot) is a scoreboard whose number rolls over, with the scorer and the
   * assist; any other word is a caption strip. The names are read a moment
   * later, once the goal has been written down (goalEventsRef, just below the
   * banner call in resolveOutcome). Picture only.
   */
  const showMikeyPopup = (text: string) => {
    const side = () => (bannerSideNow() === "bottom" ? "bottom" : "top") as "top" | "bottom";
    const isGoal = text === "GOAL" || text === "SCORED";
    if (!isGoal) { mikey.show({ text, side: side() }); return; }
    const before = { ...scoreForPopupRef.current };
    const eventsBefore = goalEventsRef.current.length;
    const theirs = text === "SCORED";
    window.setTimeout(() => {
      const ev = goalEventsRef.current.length > eventsBefore ? goalEventsRef.current[goalEventsRef.current.length - 1] : undefined;
      let goal: PopupGoal | undefined;
      if (matchModeRef.current) {
        const car = careerRef.current;
        const us = realGoalRef.current?.us.name ?? car?.player.club ?? "You";
        const them = realGoalRef.current?.them.name ?? fixtureOpponentRef.current ?? "";
        const home = fixtureHomeRef.current;
        const after = theirs ? { user: before.user, opp: before.opp + 1 } : { user: before.user + 1, opp: before.opp };
        const team = (name: string, k: { shirt: string; trim: string }) => ({ name: shortClub(name), shirt: k.shirt, trim: k.trim, ink: "#ffffff" });
        goal = {
          home: team(home ? us : them, kitsRef.current.home),
          away: team(home ? them : us, kitsRef.current.away),
          from: home ? [before.user, before.opp] : [before.opp, before.user],
          to: home ? [after.user, after.opp] : [after.opp, after.user],
          scorer: theirs ? undefined : popupName(ev?.scorer),
          assist: theirs ? undefined : popupName(ev?.assist),
          theirs,
        };
      }
      mikey.show({ text, side: "top", goal });
    }, 0);
  };
  /** B14b: a man's height on the glass (CSS px, head to boots) at this camera,
   *  the size the loop draws him (R, below, times MATCH_FIGURE_HEIGHT_R). */
  const figPxOnGlass = () => {
    const b = canvasBox(), vp = viewportRef.current, turned = facingRef.current !== "up";
    const unitCss = turned ? b.height / (vp.x2 - vp.x1) : b.width / (vp.x2 - vp.x1);
    const nv = newViewRef.current;
    const R = (unitCss / (nv ? figZoomDiv() : 1)) * MATCH_FIGURE_R_MULT * (nv ? NEW_FIGURE_SCALE * NEW_OUTFIELD_SHRINK * figureGrow() : 1);
    return R * MATCH_FIGURE_HEIGHT_R;
  };
  /**
   * B14b: the stamina bar's corner (lib/star/barSpot.ts). The goal (posts,
   * net, bar), the ball (and how high it is) and every man, as boxes in the
   * pitch wrapper's own CSS px; the bar takes the first corner clear of all of
   * them and stays there while it is clear.
   */
  const updateBarCorner = () => {
    const w = wrapRef.current;
    if (!w) return;
    const r = w.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return;
    const loc = (p: { x: number; y: number }) => { const q = pitchToClient(p); return { x: q.x - r.left, y: q.y - r.top }; };
    const sc = scenarioRef.current;
    const pl = loc({ x: POST_L, y: 0 }), pr = loc({ x: POST_R, y: 0 });
    const unitCss = Math.hypot(pr.x - pl.x, pr.y - pl.y) / (POST_R - POST_L);
    const gh = unitCss * (VFX_GOAL_H + 0.4);
    const gpts = [pl, pr, loc({ x: POST_L, y: -SIDE_NET_DEPTH }), loc({ x: POST_R, y: -SIDE_NET_DEPTH })];
    const things: { box: BarBox; weight?: number }[] = [{
      box: { x1: Math.min(...gpts.map((q) => q.x)) - gh, x2: Math.max(...gpts.map((q) => q.x)) + gh, y1: Math.min(...gpts.map((q) => q.y)) - gh, y2: Math.max(...gpts.map((q) => q.y)) + gh * 0.3 },
      weight: 10,
    }];
    const fh = figPxOnGlass();
    const man = (p: { x: number; y: number } | null | undefined, weight = 1) => {
      if (!p) return;
      const q = loc(p);
      things.push({ box: { x1: q.x - fh * 0.45, x2: q.x + fh * 0.45, y1: q.y - fh * 1.05, y2: q.y + fh * 0.15 }, weight });
    };
    man(sc.player, 3); man(sc.keeper);
    sc.defenders.forEach((d) => man(d)); sc.teammates.forEach((t) => man(t));
    if (sc.runner) man(sc.runner.pos);
    (sc.secondaryRunners ?? []).forEach((m) => man(m.pos));
    if (sc.follower) man(sc.follower);
    const bl = ballRef.current, bp = loc(bl ? bl.pos : sc.ball), bz = (bl?.z ?? 0) * unitCss;
    things.push({ box: { x1: bp.x - 8, x2: bp.x + 8, y1: bp.y - bz - 8, y2: bp.y + 8 }, weight: 10 });
    const topPad = (addedRef.current ?? 0) > 0 && matchMinuteRef.current > MATCH_DURATION ? 28 : 0;
    const c = pickBarCorner(r.width, r.height, things, barCornerRef.current, topPad);
    if (c !== barCornerRef.current) { barCornerRef.current = c; setBarCorner(c); }
  };
  // Five looks a second while the bar is up: it moves only when something
  // comes into its corner (pickBarCorner keeps a clear corner).
  const barUp = !!stamUi;
  useEffect(() => {
    if (!barUp) return;
    try { updateBarCorner(); } catch { /* a missed look keeps the corner */ }
    const id = window.setInterval(() => { try { updateBarCorner(); } catch { /* ignore */ } }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barUp]);
  /** A pitch point -> where it is on the glass (client px). The inverse of
   *  pitchFromPointer, turn and tilt and all. */
  const pitchToClient = (p: { x: number; y: number }) => {
    const vp = viewportRef.current, b = canvasBox(), f = facingRef.current;
    const fx = (p.x - vp.x1) / (vp.x2 - vp.x1), fy = (p.y - vp.y1) / (vp.y2 - vp.y1);
    const sx = f === "right" ? 1 - fy : f === "left" ? fy : fx;
    const sy = f === "right" ? fx : f === "left" ? 1 - fx : fy;
    const g = canvasToScreen(tiltGeomRef.current, sx, sy, b.width, b.height);
    return { x: b.left + g.X, y: b.top + g.Y };
  };

  const pitchFromPointer = (clientX: number, clientY: number) => {
    const vp = viewportRef.current;
    // NOT clamped to the canvas. You aim by dragging back from the ball, and a
    // chance near the bottom of the frame needs to be dragged back past the
    // bottom of it — clamping turned that into an arrow that stuck and a shot
    // you could not take. Tilted, the touch is first un-tipped.
    const { sx, sy } = clientToCanvasFrac(clientX, clientY);
    // The exact inverse of toPx, turn and all.
    const f = facingRef.current;
    const fx = f === "right" ? sy : f === "left" ? 1 - sy : sx;
    const fy = f === "right" ? 1 - sx : f === "left" ? sx : sy;
    return {
      x: fx * (vp.x2 - vp.x1) + vp.x1,
      y: fy * (vp.y2 - vp.y1) + vp.y1,
    };
  };

  // How hard the drag pulled, as a fraction of a full-power strike. Measured
  // against the VISIBLE height of the pitch rather than a fixed number of metres,
  // so a full-length drag means full power at every zoom level. Keying it to a
  // fixed metre count meant that on a tightly-framed chance the longest drag the
  // screen allowed was only a fraction of full power — which is why shots
  // sometimes travelled a fifth of the way and rolled to a stop.
  // Power now also shortens the pull: a stronger player reaches everything he
  // has with less drag, so the same flick is worth more of a shot. See
  // dragForFullPower — the attribute expands what a gesture buys rather than
  // silently multiplying the result.
  /**
   * How far the thumb travelled, as a fraction of the canvas height.
   *
   * Measured on the SCREEN, not on the pitch, and that is a fix rather than a
   * detail. A crossing situation is watched from the side, so the frame is
   * turned a quarter turn and the screen's vertical axis is pitch X — and the
   * frame is 5:8, so the same physical drag bought 1.6× fewer metres there than
   * it did anywhere else. Full power in a byline cross needed a pull 60% of the
   * screen long. The thumb does not know which way the pitch is facing; it only
   * knows how far it moved.
   */
  const dragRefHeightRef = useRef(dragReferenceHeightPx);
  dragRefHeightRef.current = dragReferenceHeightPx;
  /**
   * The height a drag (and every size kept "the same on screen as today") is
   * measured against: the prop when given; in the new view, the classic 5:8
   * canvas this width would have had; otherwise nothing (the canvas itself).
   */
  const classicHeightPx = (): number | undefined => {
    if (dragRefHeightRef.current) return dragRefHeightRef.current;
    if (!newViewRef.current) return undefined;
    const w = canvasBox().width;
    return w > 0 ? w / VIEW_ASPECT : undefined;
  };
  /** New view: CSS pixels on screen to metres on the pitch, at this camera. */
  const pxToM = (px: number): number => {
    const vp = viewportRef.current;
    const w = canvasBox().width;
    const across = facingRef.current === "up" ? vp.x2 - vp.x1 : vp.y2 - vp.y1;
    return w > 0 ? (px * across) / w : 0;
  };
  /**
   * A size the classic view takes as a share of its frame (a grab radius, the
   * aim arrow), kept the same number of PIXELS in the new view. `classicM` is
   * the classic expression; `share` of `axis` ("height" = the screen's height,
   * "y" = the frame's pitch-y span, as the classic code reads it).
   */
  const sameOnScreenM = (classicM: number, share: number, axis: "height" | "y"): number => {
    if (!newViewRef.current) return classicM;
    const w = canvasBox().width;
    const refH = classicHeightPx() ?? 0;
    const classicPx = axis === "height" || facingRef.current === "up" ? refH : w;
    return pxToM(share * classicPx);
  };
  const screenPull = useCallback((drag: { x: number; y: number }, ball: { x: number; y: number }) => {
    const vp = viewportRef.current;
    const W = vp.x2 - vp.x1, H = vp.y2 - vp.y1;
    // The exact inverse of pitchFromPointer, turn and all.
    const f = facingRef.current;
    const toScreen = (p: { x: number; y: number }) => {
      const fx = (p.x - vp.x1) / W, fy = (p.y - vp.y1) / H;
      if (f === "right") return { sx: 1 - fy, sy: fx };
      if (f === "left") return { sx: fy, sy: 1 - fx };
      return { sx: fx, sy: fy };
    };
    // Tilted: measured where the finger actually is on the glass, so the
    // same movement kicks exactly as hard as it does flat.
    const t = tiltGeomRef.current;
    const onGlass = (q: { sx: number; sy: number }) => {
      if (!t) return q;
      const g = canvasToScreen(t, q.sx, q.sy, t.W, t.H);
      return { sx: g.X / t.W, sy: g.Y / t.H };
    };
    const a = onGlass(toScreen(drag)), b = onGlass(toScreen(ball));
    // sx is a fraction of the canvas WIDTH and sy of its HEIGHT, so put them in
    // the same units before measuring.
    // New view: the canvas is not 5:8 any more, so its own shape is used.
    const cr = canvasBox();
    const ownW = cr.width;
    const ownH = cr.height;
    const aspect = newViewRef.current && ownW > 0 && ownH > 0 ? ownW / ownH : VIEW_ASPECT;
    const pull = Math.hypot((a.sx - b.sx) * aspect, a.sy - b.sy);
    // A fixed reference height (see `dragReferenceHeightPx`): the same pixels
    // of finger travel, measured against the real match's canvas instead.
    // The new view's taller pitch always reads against the classic 5:8
    // canvas this width would have had, so a drag kicks exactly as hard.
    const refH = classicHeightPx();
    return refH && refH > 0 && ownH > 0 ? pull * (ownH / refH) : pull;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const powerFromDrag = useCallback((drag: { x: number; y: number }, ball: { x: number; y: number }) => {
    return clamp(screenPull(drag, ball) / dragForFullPower(skillsRef.current.power), 0, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The team-mate under the thumb, if the man with the armband is asking.
   *
   * Generous on purpose — a footballer is a centimetre wide on a phone and the
   * whole ability is worthless if picking him out is fiddly. Nearest man inside
   * the radius wins, so two players standing close together still resolve to
   * one of them rather than to neither.
   *
   * The follower/poacher is a candidate too, drawn with a face and a name
   * exactly like a real orderable Runner whenever he's on screen (goalInView)
   * — reported directly as a broken hitbox ("other players work but theirs
   * doesn't") when tapping him did nothing, because `orderableRunners` never
   * included him at all. He returns as the literal string "follower" rather
   * than a Runner, since he has no `.pos`-shaped fields to hand back — see
   * onPointerUp's own handling of that case.
   */
  const captainPickAt = (p: { x: number; y: number }): Runner | "follower" | null => {
    if (!isCaptainRef.current) return null;
    const sc = scenarioRef.current;
    if (!acceptsCaptainOrders(sc.kind)) return null;
    const vp = viewportRef.current;
    const grab = newViewRef.current
      ? Math.max(sameOnScreenM(2.2, 2.2 / 42, "y"), sameOnScreenM(0, 0.09, "y"))
      : Math.max(2.2, (vp.y2 - vp.y1) * 0.09);
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
  };

  // ── v0.15 item 22: runs start as you pull back, and you are closed down ──
  //
  // Harry: "As captain, the run I order should start as soon as I pull back,
  // so I have to time the pass to stay onside." No taking it back once the
  // drag has passed the dead zone — "the chance just goes" — and in the
  // Premier League "the closest opponent closing down the ball as soon as
  // you're dragging back", ordered run or not. He comes at the lighter pace
  // Harry picked (lib/star/pressure.ts), and when he gets there you are
  // either tackled or, about 1 time in 3, fouled: a free kick outside the
  // box, a penalty inside it. A closer who starts behind you goes round you,
  // not through you, and fouls you 2 times in 3 (Harry, 1 Oct 2026).
  //
  // All of it happens here, in the aim phase. An ordered run moves by the
  // same rule the engine uses for a man running to orders (stepReactions'
  // commanded-run block: his own speed, arrives within 0.6 m). It is mirrored
  // in stepCommitted below, not called, because stepReactions also moves
  // everybody else, who must stay still until the kick. Offside is still
  // judged by the engine at the strike, off wherever he has got to — a run
  // held too long goes offside. Letting go FREEZES the moment: the "where do
  // you strike it" screen is a menu, not match time, so the release is what
  // has to be in time.
  /** The engine's RUNNER_SPEED — what the follower's own ordered run uses. */
  const FOLLOWER_RUN_SPEED = 7.0;
  const resetCommitted = () => {
    aimCommitRef.current = null;
    presserRef.current = null;
    thumbOriginRef.current = null;
  };
  const hasOrderedRun = (sc: Scenario) =>
    orderableRunners(sc).some((r) => !!r.commandedTo) || !!sc.follower.commandedTo;
  const commitAim = () => {
    aimCommitRef.current = performance.now();
    const sc = scenarioRef.current;
    presserRef.current = null;
    if (pressureRef.current > 0) {
      let best: Scenario["defenders"][number] | null = null;
      let bestD = Infinity;
      for (const d of sc.defenders) {
        const dist = Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y);
        if (dist < bestD) { bestD = dist; best = d; }
      }
      presserRef.current = best;
      presserBehindRef.current = !!best && pressFromBehind(best, sc.ball, sc.player);
    }
    if (isCaptainRef.current && hasOrderedRun(sc)) pushLine("He's off — play it before he's past the last man.");
  };
  /** The chance is gone without a kick: you let go, or you were closed down. */
  const loseChance = (why: "letgo" | "pressed") => {
    if (phaseRef.current !== "aim" && phaseRef.current !== "contact") return;
    aimCommitRef.current = null;
    presserRef.current = null;
    draggingRef.current = false;
    dragRef.current = null;
    thumbOriginRef.current = null;
    setAim(null);
    // Tackled, or fouled about 1 time in 3. Its own seeded draw, so the
    // chance's counted stream (goal replays read it) is untouched.
    // From behind he fouls you more often (2 in 3, not 1 in 3) — Harry.
    if (why === "pressed" && mulberry32((seedRef.current ^ 0x0f0c1a5) >>> 0)() < foulShareFor(presserBehindRef.current)) {
      fouled();
      return;
    }
    resolveOutcome("tackled");
    showAction(why === "letgo" ? "CHANCE GONE" : "CLOSED DOWN");
    pushLine(why === "letgo" ? "Hesitates, lets it go — and the chance is gone." : "Closed down before he could play it!");
  };
  /**
   * The presser brought you down. Your side keeps the ball and the next
   * chance is a set piece — the game's own free-kick chance outside the box,
   * its own penalty inside it — taken by you if it is yours to take, and by
   * whoever's on them if not (the same hand-over the match already does).
   */
  const fouled = () => {
    const sc = scenarioRef.current;
    const b = sc.ball;
    const inBox = b.y <= BOX_DEPTH && b.x >= BOX_L && b.x <= BOX_R;
    const kind: ScenarioKind = inBox ? "penalty" : "free_kick";
    setOutcome(null);
    setPhase("result");
    showAction(inBox ? "PENALTY" : "FOUL");
    pushLine(inBox ? "Brought down in the box — penalty!" : "Chopped down as he pulls back — free kick.");
    nudge(0.18, 0.14);
    playWhistle();
    const gen = sceneGenRef.current;
    if (mayTake(kind)) {
      setPieceNextRef.current = kind;
      // Possession stays yours, like a dribble that got through.
      if (matchModeRef.current) resolveScenario(matchStateRef.current, "delivered");
      window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(true); }, 1600);
    } else if (matchModeRef.current) {
      handoverRef.current = kind;
      window.setTimeout(() => { if (sceneGenRef.current === gen) startSimulation(); }, 1800);
    } else {
      window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(false); }, 1600);
    }
  };
  /** One frame of the committed aim: ordered runs, and the presser. */
  const stepCommitted = (dt: number) => {
    const sc = scenarioRef.current;
    const since = (performance.now() - (aimCommitRef.current ?? performance.now())) / 1000;
    for (const r of orderableRunners(sc)) {
      const to = r.commandedTo;
      if (!to) continue;
      const dx = to.x - r.pos.x, dy = to.y - r.pos.y, togo = Math.hypot(dx, dy);
      // Arrived while you aim: he holds the spot, still on orders (heldAt).
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
    const d = presserRef.current;
    if (d && since > PRESS_REACT_S) {
      const b = sc.ball;
      const dist = Math.hypot(b.x - d.x, b.y - d.y);
      if (dist <= PRESS_WIN_R) { loseChance("pressed"); return; }
      // Straight at the ball — round you, never through you, if you are in
      // the way (Harry, 1 Oct 2026: "on the wrong side of me").
      pressStep(d, b, sc.player, pressSpeedFor(pressureRef.current) * dt);
    }
  };

  /**
   * Raw distance to the nearest captain-orderable man (Runner or follower),
   * ignoring captainPickAt's own hit radius entirely — Infinity when
   * captaincy isn't active, or there's nobody to order. Used only to keep a
   * near-miss tap on a team-mate from falling through to the ball's own,
   * much larger grab zone — see onPointerDown.
   */
  const nearestCaptainCandidateDist = (p: { x: number; y: number }): number => {
    if (!isCaptainRef.current) return Infinity;
    const sc = scenarioRef.current;
    if (!acceptsCaptainOrders(sc.kind)) return Infinity;
    let best = Infinity;
    for (const r of orderableRunners(sc)) {
      best = Math.min(best, Math.hypot(p.x - r.pos.x, p.y - r.pos.y));
    }
    if (goalInView(sc.kind)) {
      best = Math.min(best, Math.hypot(p.x - sc.follower.x, p.y - sc.follower.y));
    }
    return best;
  };

  // --- Render one frame ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const sc = scenarioRef.current;
    const vp = viewportRef.current;
    // A frame reader (lib/star/engineFrame.ts) is told what this frame drew.
    // Absent (every real match, every other screen): null, nothing recorded.
    const rec: { figures: EngineFrameFigure[]; keeper: EngineFrameKeeper | null; aim: { from: { x: number; y: number }; to: { x: number; y: number }; power: number } | null } | null =
      frameObsRef.current ? { figures: [], keeper: null, aim: null } : null;
    const actOf = (sid: string): EngineFrameAct | undefined => {
      const a = actorAnimRef.current.get(sid);
      return a && a.scene === sc ? { kind: a.kind, mode: a.mode, save: a.save, start: a.start } : undefined;
    };
    // Pixels per metre. The viewport holds the canvas aspect exactly, so these
    // two agree — a metre is a metre whichever way it points, and circles stay
    // circles. In a turned frame the pitch axes have swapped places on the
    // screen, so the spans swap with them.
    const turned = facingRef.current !== "up";
    const unit = turned ? H / (vp.x2 - vp.x1) : W / (vp.x2 - vp.x1);
    const uy = turned ? W / (vp.y2 - vp.y1) : H / (vp.y2 - vp.y1);
    // ── Height ──
    //
    // One metre up is drawn as one metre across. TRUE scale, not foreshortened:
    // the goal is drawn standing on its line at this same scale, so a ball that
    // clears the crossbar visibly clears it and one that hits the bar hits the
    // bar you can see. Foreshortening height to 0.75 broke that agreement — and
    // the agreement is the only reason drawing height at all is honest on a
    // camera that is otherwise a flat plan.
    const heightScale = uy;
    // A real ball is only 22 cm across — drawn true to scale it disappears, so it
    // is exaggerated a little and floored at a readable pixel size.
    // New view (option D): the zoom already shrinks it; 0.7 of that again.
    const nv = newViewRef.current;
    const BALL_PX = nv ? Math.max(3, (unit / figZoomDiv()) * 0.5 * NEW_BALL_SCALE * figureGrow()) : Math.max(4.5, unit * 0.5);

    // Pitch-space drawing helpers — everything below goes through these so the
    // markings sit exactly where the physics thinks they are.
    const P = (x: number, y: number) => toPx(x, y);
    const pLine = (x1: number, y1: number, x2: number, y2: number) => {
      const a = P(x1, y1), b = P(x2, y2);
      ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
    };
    const pRect = (x1: number, y1: number, x2: number, y2: number) => {
      const a = P(x1, y1), b = P(x2, y2);
      ctx.strokeRect(a.px, a.py, b.px - a.px, b.py - a.py);
    };

    // Camera nudge — a decaying oscillation, big events only. Never under reduced motion.
    let ox = 0, oy = 0;
    const sh = shakeRef.current;
    if (sh.t > 0 && !reducedMotionRef.current) {
      const k = sh.t / sh.dur;
      const m = sh.mag * unit * k;
      ox = Math.sin(sh.t * 73) * m;
      oy = Math.cos(sh.t * 57) * m * 0.7;
    }
    // Match feel: New — the camera punch along the hit (lib/star/matchFeel.ts).
    // The lab's own pictures (vfxOverride) replace Match feel's drawing.
    const feelOn = matchFeelOn() && !vfxRef.current;
    const feelT = performance.now() / 1000;
    const feelSt = feelRef.current;
    /** A pitch direction as a unit screen direction. */
    const screenDir = (vx: number, vy: number) => {
      const a = toPx(CX, 10), b = toPx(CX + vx, 10 + vy);
      const dx = b.px - a.px, dy = b.py - a.py, l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    };
    if (feelOn && !reducedMotionRef.current && feelSt.punch.px > 0) {
      const d = screenDir(feelSt.punch.vx, feelSt.punch.vy);
      const o = punchOffset(feelT - feelSt.punch.at, feelSt.punch.dur, feelSt.punch.px, d.x, d.y);
      ox += o.x; oy += o.y;
    }
    // The lab (vfxOverride): each live effect's camera shake and punch-in.
    let vfxZ = 1, vfxZx = 0, vfxZy = 0;
    if (vfxFxRef.current.length) {
      for (const e of vfxFxRef.current) {
        const u = (feelT - e.at) / vfxDurS(e.r);
        if (u < 0 || u >= 1) continue;
        if (!reducedMotionRef.current) {
          const d = screenDir(e.vx, e.vy);
          const o = vfxShake(e.r, u, d.x, d.y);
          ox += o.x; oy += o.y;
        }
        const z = vfxZoom(e.r, u);
        if (z > vfxZ) { const f = toPx(e.x, e.y); vfxZ = z; vfxZx = f.px; vfxZy = f.py - Math.max(0, e.z) * heightScale * f.scale; }
      }
    }
    ctx.save();
    ctx.translate(ox, oy);
    if (vfxZ > 1) { ctx.translate(vfxZx, vfxZy); ctx.scale(vfxZ, vfxZ); ctx.translate(-vfxZx, -vfxZy); }

    // --- Pitch ---
    //
    // Sampled off the reference rather than chosen: its grass is rgb(31,144,6),
    // a saturated yellow-green with almost no blue in it. Ours was rgb(20,144,70)
    // — the same green with seventy points of blue, which is why it read as
    // emerald or teal beside it.
    //
    // And it has NO MOWING STRIPES. Six patches sampled at six different heights
    // came back within two units of each other; if there were five-metre bands
    // they would differ by far more than that. Ours differed by twenty-six, and
    // that banding was the loudest thing on the screen.
    //
    // What it does have is a very fine grain: luminance p5 to p95 spans about
    // eight levels, so the noise below is deliberately almost invisible. It stops
    // the pitch reading as flat paint without ever becoming a texture you notice.
    // NEW VIEW (option D): a soft two-tone checker mow, the grain on top and
    // a soft vignette at the screen's edges, painted once per frame and size
    // (drawMowedPitch) and stamped here. Classic: the flat grass below.
    if (nv) {
      const key = `${W}x${H}|${facingRef.current}|${vp.x1.toFixed(2)},${vp.y1.toFixed(2)},${vp.x2.toFixed(2)},${vp.y2.toFixed(2)}`;
      if (!mowRef.current || mowRef.current.key !== key) {
        const cv = mowRef.current?.cv ?? document.createElement("canvas");
        cv.width = W; cv.height = H;
        const g = cv.getContext("2d");
        if (!grassRef.current) grassRef.current = makeGrassTile();
        if (g) drawMowedPitch(g, W, H, P, unit, grassRef.current);
        mowRef.current = { key, cv };
      }
      ctx.drawImage(mowRef.current.cv, 0, 0);
    } else {
    ctx.fillStyle = C.pitch;
    ctx.fillRect(0, 0, W, H);

    // The grain, built once and tiled. Pinned to PITCH space, so it sits still
    // on the grass rather than crawling when the frame changes between chances.
    if (!grassRef.current) grassRef.current = makeGrassTile();
    if (grassRef.current) {
      const pat = ctx.createPattern(grassRef.current, "repeat");
      if (pat) {
        const o = P(0, 0);
        ctx.save();
        ctx.translate(o.px % GRASS_TILE, o.py % GRASS_TILE);
        ctx.fillStyle = pat;
        ctx.fillRect(-GRASS_TILE, -GRASS_TILE, W + GRASS_TILE * 2, H + GRASS_TILE * 2);
        ctx.restore();
      }
    }
    } // end classic grass

    // Worn grass where a season's football happens: the goalmouth, the penalty
    // spot, the centre. The reference has these and they are most of what stops
    // a pitch looking printed — measured at rgb(78,134,16), which is the same
    // green with the red pushed up.
    {
      const wear = (x: number, y: number, rx: number, ry: number, alpha: number) => {
        const c = P(x, y);
        const g = ctx.createRadialGradient(c.px, c.py, 0, c.px, c.py, Math.max(rx, ry) * unit);
        g.addColorStop(0, `rgba(120,132,26,${alpha})`);
        g.addColorStop(1, "rgba(120,132,26,0)");
        ctx.save();
        ctx.translate(c.px, c.py);
        ctx.scale(1, ry / rx);
        ctx.translate(-c.px, -c.py);
        ctx.fillStyle = g;
        ctx.fillRect(c.px - rx * unit * 1.2, c.py - rx * unit * 1.2, rx * unit * 2.4, rx * unit * 2.4);
        ctx.restore();
      };
      if (sceneRef.current?.box !== false) {
        wear(CX, 1.9, 6.2, 2.4, 0.22);      // the goalmouth
        wear(CX, PEN_SPOT_Y, 3.2, 2.2, 0.16); // the penalty spot
      }
      wear(CX, HALF_LEN, 3.4, 2.4, 0.14);   // the centre
    }

    // There is nothing behind the goal, and nothing needs to be. A terrace was
    // drawn back there so the camera could sit further back and still frame a
    // corner — a black band of speckles that read, correctly, as nonsense. The
    // camera does not sit back any more; a wide delivery has its own rectangle.
    //
    // The floodlight wash and the vignette went with the same reasoning. The
    // reference is evenly lit from end to end: a gradient across the pitch is a
    // television idea, and it fought the flat overhead camera every time.

    // --- Markings: every line at its real IFAB distance, drawn in pitch space ---
    //
    // Straight lines go through P and rotate with everything else. ARCS do not:
    // ctx.arc takes screen-space angles, and those were written for the ordinary
    // view — so in a turned frame the D detached itself from the front of the
    // penalty area and floated out into the middle of the pitch, which is
    // exactly what it looked like. A pitch-space angle turns with the frame.
    const facing = facingRef.current;
    const arcAngle = (pitchAngle: number) =>
      pitchAngle + (facing === "right" ? Math.PI / 2 : facing === "left" ? -Math.PI / 2 : 0);
    // New view: thin and crisp — a fixed ~1.2 px, never thicker.
    const lw = nv ? Math.max(1.4, Math.min(2.4, unit * 0.12)) : Math.max(1, unit * 0.12); // ~12 cm painted line
    ctx.lineWidth = lw;
    ctx.strokeStyle = nv ? C.lineNew : C.line;

    // Touchlines + goal line
    pLine(0, 0, PITCH_W, 0);
    pLine(0, 0, 0, HALF_LEN);
    pLine(PITCH_W, 0, PITCH_W, HALF_LEN);
    // Penalty area (40.32 x 16.5) and six-yard box (18.32 x 5.5) — a feature
    // can leave them off (`scene.box === false`, the trial's gate drill).
    const drawBox = sceneRef.current?.box !== false;
    if (drawBox) {
      pRect(BOX_L, 0, BOX_R, BOX_DEPTH);
      pRect(SIX_L, 0, SIX_R, SIX_DEPTH);
    }
    // Penalty spot + the D (an arc of radius 9.15 m clipped to outside the box)
    if (drawBox) {
      const spot = P(CX, PEN_SPOT_Y);
      ctx.beginPath();
      ctx.arc(spot.px, spot.py, Math.max(1.5, unit * 0.11), 0, Math.PI * 2);
      ctx.fillStyle = C.line;
      ctx.fill();
      // Only the portion beyond the 16.5 m line is painted.
      const half = Math.acos(clamp((BOX_DEPTH - PEN_SPOT_Y) / ARC_R, -1, 1));
      ctx.beginPath();
      ctx.arc(spot.px, spot.py, unit * ARC_R, arcAngle(Math.PI / 2 - half), arcAngle(Math.PI / 2 + half));
      ctx.stroke();
    }
    // Corner arcs (1 m quarter circles at each corner flag)
    {
      const c1 = P(0, 0), c2 = P(PITCH_W, 0);
      ctx.beginPath(); ctx.arc(c1.px, c1.py, unit * CORNER_R, arcAngle(0), arcAngle(Math.PI / 2)); ctx.stroke();
      ctx.beginPath(); ctx.arc(c2.px, c2.py, unit * CORNER_R, arcAngle(Math.PI / 2), arcAngle(Math.PI)); ctx.stroke();
    }
    // Halfway line + centre circle (on screen in the new view: full strength)
    ctx.strokeStyle = nv ? C.lineNew : C.lineFaint;
    pLine(0, HALF_LEN, PITCH_W, HALF_LEN);
    {
      const cc = P(CX, HALF_LEN);
      ctx.beginPath();
      ctx.arc(cc.px, cc.py, unit * CENTRE_R, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- The goal ---
    //
    // Drawn by lib/star/matchGoal.ts — moved there unchanged so the gallery,
    // its editor and Infinite Highlights draw exactly this goal too (v0.15).
    if (sceneRef.current?.goal !== false) {
      // Posts stand straight on the tipped-back screen (Mikey, 13 Oct 2026).
      // The goal is drawn in the canvas's own pixels; the tilt works in
      // fractions of it. The top keeps its height on screen and moves to
      // straight above the foot.
      const tg = tiltGeomRef.current;
      const cw = canvasRef.current?.width ?? 0, chh = canvasRef.current?.height ?? 0;
      const upright = tg && cw > 0 && chh > 0 ? (foot: { px: number; py: number }, top: { px: number; py: number }) => {
        const F = canvasToScreen(tg, foot.px / cw, foot.py / chh, tg.W, tg.H);
        const T = canvasToScreen(tg, top.px / cw, top.py / chh, tg.W, tg.H);
        const q = screenToCanvas(tg, F.X, T.Y, tg.W, tg.H);
        return { px: q.sx * cw, py: q.sy * chh };
      } : undefined;
      // From the side the net is drawn a real goal's depth (Mikey, 13 Oct 2026).
      const sideOn = facingRef.current === "left" || facingRef.current === "right";
      drawMatchGoal(ctx, P, unit, heightScale, upright, sideOn ? SIDE_NET_DEPTH : undefined);
    }

    // ── What you can SEE ──
    //
    // Vision buys information, and for a while that information was drawn as a
    // ring floating over the men you could pick out. It was the last of the
    // rings on the pitch and it went the same way as the others: two of your
    // three team-mates wearing a marker and one not is not a hint, it is a
    // puzzle about the UI. Vision still decides what the commentary tells you
    // and what the engine considers an option — it just does not draw on the
    // grass any more.

    // There is no pass marker, and there was one for far too long: a ring on the
    // grass showing exactly where to put the ball. Finding the man is the game.
    // If you need to be told where he wants it, you are not playing it.

    // --- Footballers ---
    //
    // Drawn as actual figures rather than discs: shadow, legs, shorts, shirt,
    // arms and head, with the limbs posed by what the player is doing. The
    // camera looks down the pitch from behind and slightly above, so the head
    // sits high on the body and the limbs splay out below it.
    //
    // Poses are cosmetic only. Every position, collision and reception test
    // still uses the single point the figure is centred on, exactly as the
    // discs did — so nothing about the physics changed with the artwork.
    const SKIN = "#c68642";
    type Pose = FigurePose;

    type FigureOpts = {
      pose?: Pose; phase?: number; facing?: number; label?: string; labelColor?: string; shorts?: string; star?: boolean; face?: HTMLImageElement;
      /** A run-up style's own body (runupStyles.ts): stride, arms, crouch, a skip off the ground, a lean. Replaces `pose`. */
      body?: RunupPose | null;
      /** Which foot a kick is struck with: +1 right, −1 left (lib/star/kickFoot.ts). Looks only. */
      kickFoot?: number;
      /** Who this is, for the 3D figure's own motion (new view). Looks only. */
      sid?: string;
      /** Animations: New — what he is doing with the ball right now
       *  (lib/star/actionAnim.ts). Replaces `pose`. Looks only. */
      anim?: OutfieldAnimFrame | null;
    };

    // ── Nearer men in front of further ones ──
    //
    // Figures used to be painted in groups — team-mates, then runners, then
    // defenders, then you — so whoever's group came later was always on top.
    // A striker standing BEHIND his marker was drawn over him, head planted in
    // the marker's shirt, "like he is standing on top of him" (Mikey, 25 Sep
    // 2026, a far-post cross seen from the right). While `figureQueue` is open
    // every call below is held, then all of them are painted far-to-near by
    // where their boots land on screen — the one depth that is right from
    // every camera facing, since up the screen is always further away.
    let figureQueue: { py: number; draw: () => void }[] | null = null;

    // ── The 3D figure's clip (new view; Settings → Look → Players: 3D) ──
    // From how the man actually moved: standing, jogging, sprinting; the
    // strike on your kick; a celebration once a goal is in. Running clips are
    // timed by the ground he covers, so the feet keep pace with the grass.
    // Facing: where he is heading, or the ball when he is standing.
    const spriteMotion = spriteMotionRef.current;
    // Animations: New — each man's current action animation and how far into
    // it he is (filled by animOf below), for the 3D twin of the drawn move
    // (lib/star/sprite3dAnim.ts). Empty with Animations: Old.
    const animNow = new Map<string, { a: ActorAnim; e: number }>();
    const spriteBall = ballRef.current ? ballRef.current.pos : sc.ball;
    const spriteSeed = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return (Math.abs(h) % 997) / 97; };
    const screenAngle = (x: number, y: number, wx: number, wy: number) => {
      const a = toPx(x, y), b = toPx(wx, wy);
      return Math.atan2(b.py - a.py, b.px - a.px);
    };
    const spriteHint = (x: number, y: number, opts: FigureOpts, shirt: string, shorts: string): MatchSpriteHint | undefined => {
      if (!nv || !opts.sid) return undefined;
      const id = opts.sid;
      let m = spriteMotion.get(id);
      if (!m) { m = { x, y, t: now, vx: 0, vy: 0, dist: 0, facing: NaN }; spriteMotion.set(id, m); }
      const dt = now - m.t;
      if (dt > 0) {
        const dx = x - m.x, dy = y - m.y, d = Math.hypot(dx, dy);
        if (dt < 0.25 && d < 4) {
          const k = Math.min(1, dt * 8);
          m.vx += (dx / dt - m.vx) * k; m.vy += (dy / dt - m.vy) * k;
          m.dist += d;
        } else { m.vx = 0; m.vy = 0; } // a new picture, not a run
        m.x = x; m.y = y; m.t = now;
      }
      const speed = Math.hypot(m.vx, m.vy);
      let facing: number;
      if (speed > 0.6) facing = screenAngle(x, y, x + m.vx, y + m.vy);
      else if (Math.hypot(spriteBall.x - x, spriteBall.y - y) > 0.25) facing = screenAngle(x, y, spriteBall.x, spriteBall.y);
      else facing = Number.isFinite(m.facing) ? m.facing : -Math.PI / 2;
      // A little hysteresis so a man between two of the eight facings does not flicker.
      if (Number.isFinite(m.facing)) {
        const diff = Math.atan2(Math.sin(facing - m.facing), Math.cos(facing - m.facing));
        if (Math.abs(diff) < 0.3) facing = m.facing;
      }
      m.facing = facing;
      const them = id.startsWith("def") || id.startsWith("chase") || (id === "you" && autoKickOf(sc)?.side === "them");
      let clip: SpriteClip, t: number;
      // Animations: New — the 3D twin of his move (touch, pass, shot, volley,
      // chip, header, block, clearance), once its atlas is in. Until then, and
      // always with Animations: Old, the old clips below.
      const na = opts.anim ? animNow.get(id) : undefined;
      const nc = na ? outfieldSpriteClip(na.a, na.e, (c) => spriteClipFps("player", c)) : null;
      const newClip = !!nc && !(opts.pose === "kick" && id === "you") && spriteClipReady("player", nc.clip);
      if (newClip && nc) {
        clip = nc.clip; t = nc.t;
      } else if (opts.pose === "kick" && id === "you") {
        clip = "kick";
        t = Math.max(0, spriteKickStrikeT() - 0.12 + (KICK_POSE_S - kickPoseRef.current));
        // Match feel: New — the leg drawn back through the wind-up, held at
        // the contact while the picture freezes, then the follow-through.
        if (feelOn) {
          if (feelSt.windUp > 0 && feelSt.windUpTotal > 0) t = Math.max(0, spriteKickStrikeT() - 0.12 - 0.28 * (feelSt.windUp / feelSt.windUpTotal));
          else if (feelSt.hitStop > 0 && kickPoseRef.current >= KICK_POSE_S) t = spriteKickStrikeT();
          else t = spriteKickStrikeT() + (KICK_POSE_S - kickPoseRef.current);
        }
      } else if (opts.anim && opts.anim.kickClipU !== null) {
        // Animations: New — the kick clip on whoever actually struck it.
        clip = "kick";
        t = Math.max(0, spriteKickStrikeT() * opts.anim.kickClipU);
      } else if (phaseRef.current === "result" && goalSideRef.current === (them ? "them" : "us")) {
        clip = "celebrate"; t = now + spriteSeed(id);
      } else if (speed > 4.8) {
        clip = "sprint"; t = m.dist / 5.2;
      } else if (speed > 0.6) {
        clip = "jog"; t = m.dist / 2.8;
      } else {
        clip = "idle"; t = now + spriteSeed(id);
      }
      // A left-footer strikes with his left: the baked kick is right-footed,
      // so his kick is drawn mirrored (v0.26 known issue, "left-footers kick
      // with the wrong foot in 3D"). The drawn figure already swings the
      // left leg (bodyPoseFor reads kickFoot).
      const mirror = clip === "kick" && (opts.kickFoot ?? 1) < 0;
      // A new clip has its own lean baked in; the code lean is for the old ones.
      return { char: "player", clip, t, facing, kit: { shirt, shorts, socks: shirt }, ...(!newClip && opts.anim?.lean ? { tilt: opts.anim.lean } : {}), ...(mirror ? { mirror } : {}) };
    };
    const footballer = (
      x: number, y: number, rBase: number,
      shirt: string, rim: string,
      opts: FigureOpts = {},
    ) => {
      if (rec) {
        const sid = opts.sid ?? `fig${rec.figures.length}`;
        const them = shirt === theirKit().shirt || sid.startsWith("def") || sid.startsWith("chase");
        rec.figures.push({
          sid, x, y, shirt, shorts: opts.shorts ?? rim, team: them ? "them" : "us",
          kick: opts.pose === "kick", kickFoot: opts.kickFoot ?? 1, act: sid === "you" ? undefined : actOf(sid),
          star: opts.star, label: opts.label, face: opts.face?.src, drawn: true,
        });
      }
      if (figureQueue) {
        const at = toPx(x, y).py;
        figureQueue.push({ py: at, draw: () => paintFootballer(x, y, rBase, shirt, rim, opts) });
        return;
      }
      paintFootballer(x, y, rBase, shirt, rim, opts);
    };
    const flushFigures = () => {
      const q = figureQueue;
      figureQueue = null;
      if (!q) return;
      // Stable: two men on exactly the same line keep their old order.
      q.map((f, i) => ({ f, i }))
        .sort((a, b) => a.f.py - b.f.py || a.i - b.i)
        .forEach(({ f }) => f.draw());
    };
    const paintFootballer = (
      x: number, y: number, rBase: number,
      shirt: string, rim: string,
      opts: FigureOpts = {},
    ) => {
      const { px, py, scale } = toPx(x, y);
      // Further up the pitch is further from the camera, so figures there are
      // drawn smaller. This is most of what sells the depth.
      const r = figureRForHeight(rBase * scale * MATCH_FIGURE_HEIGHT_R);
      const pose = opts.pose ?? "idle";
      const phase = opts.phase ?? 0;
      // Shorts default to the shirt's rim rather than a near-black everybody
      // shares. Two blocks of team colour instead of one is most of what makes
      // a figure readable when it is the size of a thumbnail: on the old
      // proportions the shirt was a small patch and the skin-coloured head,
      // arms and legs dominated, so at any distance both sides were the same
      // tan smudge and a crowd in the box was unreadable.
      const shorts = opts.shorts ?? rim;

      // Limb swing — the shared mapping (fiveASide/render.ts's own
      // bodyPoseFor), not a second local copy of it. Running scissors the
      // legs and counter-swings the arms; a kick throws one leg through and
      // the arms wide for balance; a man waiting for the ball opens his arms.
      const body = opts.body;
      const anim = body ? null : opts.anim ?? null;
      const limbs = body
        ? { legSwing: body.legSwing, kick: 0, armSpread: body.armSpread, armLift: body.armLift, crouch: body.crouch }
        : anim
          ? { legSwing: 0, kick: 0, armSpread: 0, armLift: -0.55, ...anim.pose }
          : bodyPoseFor(pose, phase, opts.kickFoot);

      // ── Anchored at the FEET ──
      //
      // (px, py) is where this man is standing, and it is where his boots are:
      // the shadow goes there and the body is drawn upward from it. The figure
      // used to hang off its own middle, so every player was drawn half a body
      // ahead of the spot he actually occupied — a keeper on his line had his
      // head on the line and his feet two metres in front of it, and looked
      // like he had come out. It also put the ball, which IS drawn at its
      // ground point, level with a player's waist rather than his boots.
      drawMatchFigure(ctx, nv ? "new" : "classic", px, py, r, {
        sprite: spriteHint(x, y, opts, shirt, shorts),
        look: { shirt, shorts, trim: rim, skin: SKIN, face: opts.face },
        faceStyle: faceStyleRef.current, fakeFaceStyle: fakeFaceStyleRef.current,
        opts: {
          facing: anim ? ((opts.facing ?? 0) + anim.lean) || undefined : opts.facing ?? (body?.lean || undefined),
          liftPx: body ? body.lift * r * FIGURE_HEIGHT_R : anim && anim.liftR > 0 ? anim.liftR * r : undefined,
          shadowR: r * 0.42,
          pose: limbs,
          label: opts.label,
          labelColor: opts.labelColor,
          star: opts.star,
          // A gold star on a bright shirt or against a floodlit sky needs an
          // edge or it dissolves into whatever is behind it.
          starRim: "rgba(0,0,0,0.55)",
        },
      });
    };

    // Sized against the reference rather than against the laws of the game: a
    // sprite there stands about 7% of the frame's width tall, which works out
    // near enough to two and a half metres. Footballers are not two and a half
    // metres tall, and it does not matter — at a true 1.8 m they are specks.
    //
    // Now that the projection is flat this holds everywhere on the frame, which
    // it never could before: a man at the goal used to be drawn at 64% of a man
    // at your feet.
    // New view (option D): 0.8 of the zoomed-out size, then 0.8 again for the
    // outfield men (~18 px on a phone). The keeper is put back to full size below.
    // Chance framing "Zoom": divided by the zoom, so the men stay today's size.
    const R = (unit / (nv ? figZoomDiv() : 1)) * MATCH_FIGURE_R_MULT * (nv ? NEW_FIGURE_SCALE * NEW_OUTFIELD_SHRINK * figureGrow() : 1);

    // Running phase, shared by everyone so the crowd of figures does not march
    // in lockstep — each is offset by its own position. Thin wrappers over
    // fiveASide/render.ts's own shared runPhase/poseFor now, not a second
    // copy of them — every call site below (`poseFor("id", x, y)`,
    // `runPhase(x)`) is unchanged.
    const now = performance.now() / 1000;
    const runPhase = (seedX: number) => sharedRunPhase(now, seedX);

    // Whether a figure is moving, from how far it travelled since last frame.
    // Cheaper and more reliable than threading velocity out of every entity,
    // and it works for the ones that only expose a position.
    const motion = motionRef.current;
    const poseFor = (id: string, x: number, y: number): Pose => sharedPoseFor(motion, id, x, y);

    // Animations: New | Old (Settings → Look; lib/star/animLook.ts). New: the
    // man who touched the ball is drawn doing it (lib/star/actionAnim.ts).
    // Old: nothing below changes a single figure.
    const animNew = true; // Animations: always New (decided 12 Oct 2026)
    // How big each animation is, and which families are on (animDials.ts,
    // edited on /star-animations-dev). A family switched off is drawn Old.
    const animSet = animSettings();
    // Match feel: New — team-mates' and defenders' moves drawn a size bigger
    // so they read at phone size (the "Team-mate moves bigger" feel dial).
    const mateDials = feelOn ? { ...animSet.dials, exaggeration: animSet.dials.exaggeration * feelDials().mateBoost } : animSet.dials;
    // Animations: New with the 3D players: start fetching the New clips' atlas
    // now, so the first touch already has its 3D twin. Never with Old.
    if (animNew && nv) spriteClipReady("player", "touch");
    const familyOf = (a: ActorAnim): AnimFamily =>
      a.kind === "touch" ? "touch"
        : a.mode === "header" ? "headers"
          : a.kind === "block" || a.kind === "clearance" ? "blocks"
            : a.kind === "pass" ? "passes" : "shots";
    // Contact flashes at the boot, drawn over the men once they are all down.
    const bootFlashes: { x: number; y: number; z: number; f: OutfieldAnimFrame }[] = [];
    const animOf = (sid: string, x: number, y: number): OutfieldAnimFrame | null => {
      if (!animNew) return null;
      const a = actorAnimRef.current.get(sid);
      if (!a || a.scene !== sc) return null;
      if (!animSet.on[familyOf(a)]) return null;
      // Which foot: the side of him the ball is on, on screen.
      const me = toPx(x, y);
      const bp = ballRef.current?.pos ?? a.at ?? { x, y };
      const ref = a.kind === "block" && a.at ? a.at : bp;
      const dx = toPx(ref.x, ref.y).px - me.px;
      const fr = outfieldAnimFrame(a, now - a.start, Math.abs(dx) < 1 ? 1 : Math.sign(dx), mateDials);
      if (fr) animNow.set(sid, { a, e: now - a.start });
      if (fr && fr.flash > 0 && animSet.on.flashes && a.at) bootFlashes.push({ x: a.at.x, y: a.at.y, z: a.at.z, f: fr });
      return fr;
    };

    // Highlight the runner while they control a pass they've just won
    const rb = ballRef.current;
    if (rb && rb.receiverControlT > 0 && sc.runner) {
      const { px, py } = toPx(sc.runner.pos.x, sc.runner.pos.y);
      ctx.beginPath();
      ctx.arc(px, py, R * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(167,139,250,0.4)";
      ctx.fill();
    }

    // The man in the box. Always drawn — he used to appear only once he had
    // started chasing something, so a team-mate materialised next to the keeper
    // out of thin air halfway through a highlight. He is standing there the
    // whole time; you should be able to see him and aim for him. There is no
    // box to lurk in when the goal is not part of the situation.
    // ── The run ──
    //
    // Drawn instead of the scenario: you, the men in your way, and the line you
    // are trying to reach. What this replaced was a dashed yellow line across
    // the pitch and two thin white verticals — a diagram, and one nobody could
    // read as football. The line to reach is now a band of turf, and the sides
    // of the corridor are just the edges of the frame.
    // ── The top-down dribble (Dribble style: Top-down) ──
    // The duel's own run, in this view: its men, you, the ball at your feet,
    // the line to reach. Drawn through the "result" beat too (frozen).
    const td = tdRef.current;
    if ((phaseRef.current === "tdDribble" || phaseRef.current === "result") && td) {
      // The line: a lit band of turf.
      {
        const a1 = P(td.minX - 8, td.clearY), a2 = P(td.maxX + 8, td.clearY);
        const b1 = P(td.minX - 8, td.clearY - 2.2), b2 = P(td.maxX + 8, td.clearY - 2.2);
        ctx.beginPath();
        ctx.moveTo(a1.px, a1.py); ctx.lineTo(a2.px, a2.py); ctx.lineTo(b2.px, b2.py); ctx.lineTo(b1.px, b1.py);
        ctx.closePath();
        ctx.fillStyle = "rgba(52,211,153,0.18)";
        ctx.fill();
      }
      const chevron = (x: number, y: number, dir: number, color: string, size: number) => {
        const c0 = P(x, y);
        const r = Math.max(5, unit * size);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(c0.px + dir * r, c0.py);
        ctx.lineTo(c0.px - dir * r * 0.45, c0.py - r * 0.6);
        ctx.lineTo(c0.px - dir * r * 0.45, c0.py + r * 0.6);
        ctx.closePath();
        ctx.fill();
      };
      // On the grass first, under everyone: the side each man shows you, and
      // the side he is about to tackle (amber running to red).
      for (const d of td.defenders) {
        if (d.phase === "jockey" && d.show) chevron(d.x + d.show * 1.3, d.y + 0.3, d.show, "rgba(255,255,255,0.45)", 0.42);
        if (d.phase === "telegraph") {
          const f = 1 - Math.max(0, Math.min(1, d.tell / Math.max(0.01, d.tellT)));
          chevron(d.x + d.commitSide * (0.9 + 0.5 * f), d.y, d.commitSide, `rgba(${Math.round(251 - 12 * f)},${Math.round(191 - 123 * f)},${Math.round(36 + 32 * f)},${0.6 + 0.35 * f})`, 0.55);
        }
      }
      for (const m of td.mates) {
        const c0 = P(m.x, m.y);
        ctx.strokeStyle = PASS_RING[passBand(m.difficulty)];
        ctx.lineWidth = Math.max(2, unit * 0.16);
        ctx.beginPath();
        ctx.ellipse(c0.px, c0.py, Math.max(10, unit * 1.3), Math.max(5, unit * 0.6), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      figureQueue = [];
      td.defenders.forEach((d, i) => {
        const lean = d.phase === "committed" ? d.commitSide * 0.5 * Math.min(1, d.lunge * 1.5)
          : d.phase === "bitten" ? (d.leanDir ?? 0) * 0.45
          : d.phase === "telegraph" ? d.commitSide * 0.18
          : d.phase === "jockey" ? (d.show ?? 0) * 0.1 : 0;
        ctx.globalAlpha = d.phase === "beaten" ? 0.55 : d.phase === "waiting" ? 0.8 : 1;
        footballer(d.x, d.y, R, theirKit().shirt, theirKit().trim, {
          sid: `td${i}`,
          pose: d.phase === "waiting" ? "idle" : poseFor(`td${i}`, d.x, d.y),
          phase: runPhase(d.x + i),
          facing: lean || undefined,
          face: getFaceImage(d.who?.face ?? fakeFaceFor(d.who?.id ?? `td${i}`)),
          label: namesOn() ? d.who?.shortName : undefined,
        });
        ctx.globalAlpha = 1;
      });
      td.mates.forEach((m, i) => {
        footballer(m.x, m.y, R, ourKit().shirt, ourKit().trim, {
          sid: `tdm${i}`, pose: poseFor(`tdm${i}`, m.x, m.y), phase: runPhase(m.x + 7 * i),
          face: getFaceImage(m.who?.face ?? fakeFaceFor(m.who?.id ?? `tdm${i}`)),
        });
      });
      const feint = td.feint;
      footballer(td.x, td.y, R, ourKit().shirt, ourKit().trim, {
        sid: "you",
        pose: feint && feint.kind === "stepover" ? "kick" : td.stick && (td.fwd ?? 0) < 0.4 && !td.burst ? "idle" : "run",
        kickFoot: feint ? feint.dir : 1,
        phase: (td.stride / 1.4) * Math.PI * 2,
        facing: feint && feint.kind === "shoulder" ? feint.dir * 0.3 : td.burst ? td.burst.dir * 0.22 : undefined,
        star: true,
        face: getFaceImage(careerRef.current?.player.portrait ?? DEFAULT_FAKE_FACE),
      });
      // The ball: ahead of your feet, touched on once a stride, knocked further on a burst.
      {
        const burst = td.burst ? Math.min(1, td.burst.t / FP_BURST_T) : 0;
        const lead = td.stick ? stickBallLead(td, tdBallRef.current.x >= td.x ? 1 : -1, burst)
          : 0.55 + 1.5 * (carryLead(td.stride, tdBallRef.current.x >= td.x ? 1 : -1, burst) - 0.42);
        const bx = tdBallRef.current.x, by = td.y - lead;
        const drawTdBall = () => {
          const { px, py, scale } = toPx(bx, by);
          const br = BALL_PX * scale;
          if (nv && matchBallLook() === "new") { drawMatchBall(ctx, px, py, py, br, seamRef.current, 0, 1); return; }
          ctx.beginPath();
          ctx.ellipse(px, py, br * 1.05, br * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,0.34)";
          ctx.fill();
          const img = ballImgRef.current;
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save(); ctx.translate(px, py); ctx.rotate(seamRef.current); ctx.drawImage(img, -br, -br, br * 2, br * 2); ctx.restore();
          } else {
            ctx.beginPath(); ctx.arc(px, py, br, 0, Math.PI * 2); ctx.fillStyle = "#fefefe"; ctx.fill();
          }
        };
        figureQueue.push({ py: toPx(bx, by).py, draw: drawTdBall });
      }
      flushFigures();
      // The stick (dribbleControl "stick"): where your thumb is, or where to put it.
      if (td.stick && phaseRef.current === "tdDribble") {
        const st = tdStickRef.current;
        const rr = Math.min(W, H) * 0.13;
        // Resting above the commentary box, which covers the bottom of the pitch.
        const ox = st ? st.fx * W : W * 0.22, oy = st ? st.fy * H : H * 0.7;
        ctx.beginPath(); ctx.arc(ox, oy, rr, 0, Math.PI * 2);
        ctx.fillStyle = st ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.18)"; ctx.fill();
        ctx.lineWidth = Math.max(2, rr * 0.06); ctx.strokeStyle = st ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)"; ctx.stroke();
        const kx = ox + (st ? st.vx : 0) * rr, ky = oy + (st ? st.vy : 0) * rr;
        ctx.beginPath(); ctx.arc(kx, ky, rr * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = st ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)"; ctx.fill();
        if (!st) {
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.font = `700 ${Math.max(11, Math.round(W * 0.03))}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("Move", ox, oy - rr - 8);
          ctx.fillText("Tap a mate", W * 0.74, oy);
          ctx.textAlign = "left";
        }
      }
      // How far up the pitch you are.
      const prog = Math.max(0, Math.min(1, (td.startY - td.y) / Math.max(1, td.startY - td.clearY)));
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(W * 0.08, H * 0.045, W * 0.84, H * 0.014);
      ctx.fillStyle = prog > 0.75 ? "#fbbf24" : "#34d399";
      ctx.fillRect(W * 0.08, H * 0.045, W * 0.84 * prog, H * 0.014);
      return;
    }

    const dr = dribbleRef.current;
    // Also drawn (frozen — nothing steps it once phase leaves "dribble", see
    // the physics update below) through "result": a run that ends in a
    // tackle sets phase to "result" without clearing the ref (finishDribble),
    // specifically so this branch keeps catching it instead of falling
    // through to whatever `sc` (a stale, unrelated scenario) happens to
    // still be. Reported directly: after losing the ball to a tackle, the
    // pitch flashed a completely different situation for about a second
    // before cutting to commentary.
    if ((phaseRef.current === "dribble" || phaseRef.current === "result") && dr) {
      // The line. A lit band of grass rather than a rule drawn over the top.
      {
        const a1 = P(dr.minX - 6, dr.targetY), a2 = P(dr.maxX + 6, dr.targetY);
        const b1 = P(dr.minX - 6, dr.targetY - 2.2), b2 = P(dr.maxX + 6, dr.targetY - 2.2);
        ctx.beginPath();
        ctx.moveTo(a1.px, a1.py); ctx.lineTo(a2.px, a2.py);
        ctx.lineTo(b2.px, b2.py); ctx.lineTo(b1.px, b1.py);
        ctx.closePath();
        ctx.fillStyle = "rgba(52,211,153,0.18)";
        ctx.fill();
        ctx.lineWidth = Math.max(2, unit * 0.16);
        ctx.strokeStyle = "rgba(52,211,153,0.75)";
        ctx.beginPath(); ctx.moveTo(a1.px, a1.py); ctx.lineTo(a2.px, a2.py); ctx.stroke();
      }

      // The men in your way. One who has not seen you yet is drawn dimmer, so
      // "he is coming now" is information you get before it costs you the ball.
      dr.chasers.forEach((c, i) => {
        ctx.globalAlpha = c.awake ? 1 : 0.62;
        footballer(c.x, c.y, R, theirKit().shirt, theirKit().trim, {
          sid: `chase${i}`,
          pose: c.awake ? poseFor(`chase${i}`, c.x, c.y) : "idle",
          phase: runPhase(c.x),
        });
        ctx.globalAlpha = 1;
      });

      // You, with the ball just ahead of your feet, and the line you are on.
      const bx = dr.pos.x + dr.heading.x * 1.1;
      const by = dr.pos.y + dr.heading.y * 1.1;
      const tip = P(dr.pos.x + dr.heading.x * 4.5, dr.pos.y + dr.heading.y * 4.5);
      const base = P(dr.pos.x, dr.pos.y);
      ctx.strokeStyle = "rgba(52,211,153,0.5)";
      ctx.lineWidth = Math.max(2, unit * 0.14);
      ctx.beginPath(); ctx.moveTo(base.px, base.py); ctx.lineTo(tip.px, tip.py); ctx.stroke();

      footballer(dr.pos.x, dr.pos.y, R, ourKit().shirt, ourKit().trim, {
        sid: "you",
        pose: "run",
        phase: runPhase(dr.pos.x),
        star: true,
      });
      const bp = toPx(bx, by);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(bp.px, bp.py, Math.max(2.5, unit * 0.34 * bp.scale), 0, Math.PI * 2);
      ctx.fill();

      // How far through the run you are.
      const prog = dribbleProgress(dr);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(W * 0.08, H * 0.045, W * 0.84, H * 0.014);
      ctx.fillStyle = prog > 0.75 ? "#fbbf24" : "#34d399";
      ctx.fillRect(W * 0.08, H * 0.045, W * 0.84 * prog, H * 0.014);
      return;
    }

    // ── Nobody is on the pitch while the match is somewhere else ──
    //
    // The simulation panel sits over the canvas between chances, and the canvas
    // was still drawing a scenario underneath it — at kick-off the throwaway one
    // `scenarioRef` was initialised with, and later the frozen aftermath of the
    // chance you had just taken. Neither is what happens next: press Continue
    // and a completely different situation is built. So the first thing every
    // match showed you was a fully drawn chance that was never played, and every
    // panel after it showed one that already had been.
    //
    // Reported as "why does it always start off previewing something that
    // doesn't ever show". It was visible at all because the panel's own backdrop
    // was `bg-gray-950/92`, and 92 is not on Tailwind's opacity scale — the class
    // was silently dropped and the overlay had no background whatsoever.
    if (phaseRef.current === "feed") return;

    // The poacher. He used to be drawn ABOVE the run, which meant a dribble —
    // built with no team-mates in it on purpose, because the question it asks is
    // whether YOU can beat these men — had one lone blue shirt standing in it,
    // left over from the scenario before. Same leak as the panel above: a figure
    // from a situation that is not the one on screen.
    figureQueue = [];
    if (goalInView(sc.kind) && sceneRef.current?.teammates !== false) {
      const fJump = sc.follower.jump?.z ?? 0;
      footballer(sc.follower.x, sc.follower.y - fJump * 0.42, R, ourKit().shirt, ourKit().trim, {
        sid: "follower",
        pose: fJump > 0.15 ? "receive" : poseFor("follower", sc.follower.x, sc.follower.y),
        anim: animOf("follower", sc.follower.x, sc.follower.y),
        phase: runPhase(sc.follower.x),
        face: getFaceImage(sc.follower.who?.face ?? fakeFaceFor("follower")),
        label: namesOn() ? sc.follower.who?.shortName : undefined,
      });
    }

    /**
     * The armband's two orders, drawn on the grass.
     *
     * Gold, because that is what the armband is, and because nothing else on
     * this pitch is — a defender is never gold and neither is the ball, so an
     * order can never be mistaken for a thing that is about to happen to you.
     */
    // The same orders, for a frame reader (a 3D view draws them on its own
    // pitch): read only, built from what drawCaptainOrders below draws.
    const captainOrdersFrame = (s: Scenario): EngineFrameOrders | null => {
      if (!isCaptainRef.current || phaseRef.current !== "aim" || !acceptsCaptainOrders(s.kind)) return null;
      const runners = orderableRunners(s);
      const all = [s.runner, ...s.secondaryRunners].filter(Boolean) as Runner[];
      const pickable = runners.map((r) => `run${all.indexOf(r)}`).filter((id) => id !== "run-1");
      if (goalInView(s.kind)) pickable.push("follower");
      const runs: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
      for (const r of runners) if (r.commandedTo) runs.push({ from: { x: r.pos.x, y: r.pos.y }, to: { x: r.commandedTo.x, y: r.commandedTo.y } });
      if (s.follower.commandedTo) runs.push({ from: { x: s.follower.x, y: s.follower.y }, to: { x: s.follower.commandedTo.x, y: s.follower.commandedTo.y } });
      const relay = s.relayTo ? { x: s.relayTo.pos.x, y: s.relayTo.pos.y } : s.relayToFollower ? { x: s.follower.x, y: s.follower.y } : null;
      const d = captainDragRef.current;
      const drag = d && Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) >= CAPTAIN_DRAG_MIN
        ? { from: d.target === "follower" ? { x: s.follower.x, y: s.follower.y } : { x: d.target.pos.x, y: d.target.pos.y }, to: { x: d.to.x, y: d.to.y } }
        : null;
      return { pickable, runs, relay, drag };
    };

    const drawCaptainOrders = (s: Scenario) => {
      const GOLD = "#fbbf24";

      const arrow = (from: { x: number; y: number }, to: { x: number; y: number }, alpha: number, dashed: boolean) => {
        const a = toPx(from.x, from.y), b = toPx(to.x, to.y);
        const dx = b.px - a.px, dy = b.py - a.py;
        const len = Math.hypot(dx, dy);
        if (len < 6) return;
        const ux = dx / len, uy = dy / len;
        // Starts clear of the man's feet so the shaft does not grow out of his
        // shins, and stops short of the head so the head is the point of it.
        const HEAD = Math.min(16, len * 0.34);
        const sx = a.px + ux * 10, sy = a.py + uy * 10;
        const ex = b.px - ux * HEAD * 0.6, ey = b.py - uy * HEAD * 0.6;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        if (dashed) ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        // The head, as a filled triangle rather than two more strokes — a
        // stroked chevron reads as a bend in the line at this size.
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.moveTo(b.px, b.py);
        ctx.lineTo(b.px - ux * HEAD - uy * HEAD * 0.42, b.py - uy * HEAD + ux * HEAD * 0.42);
        ctx.lineTo(b.px - ux * HEAD + uy * HEAD * 0.42, b.py - uy * HEAD - ux * HEAD * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      // Runs already given: where each man has been sent, and where he is going
      // to be standing when the ball gets there. The follower/poacher gets the
      // same treatment off his own commandedTo — he has no `.pos`, so his own
      // live `.x`/`.y` stand in for it.
      for (const r of orderableRunners(s)) {
        if (!r.commandedTo) continue;
        arrow(r.pos, r.commandedTo, 0.75, true);
      }
      if (s.follower.commandedTo) {
        arrow({ x: s.follower.x, y: s.follower.y }, s.follower.commandedTo, 0.75, true);
      }

      // The man it gets laid off to. A ring around him rather than a marker
      // beside him: the order is about HIM, and a ring is the only shape that
      // says "this one" without pointing anywhere.
      const relayRing = (px: number, py: number) => {
        ctx.save();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(px, py, 15, 0, Math.PI * 2);
        ctx.stroke();
        // …and a second, fainter ring, so it reads as deliberate rather than as
        // a selection halo that might be the game highlighting something.
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(px, py, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };
      if (s.relayTo) {
        const { px, py } = toPx(s.relayTo.pos.x, s.relayTo.pos.y);
        relayRing(px, py);
      } else if (s.relayToFollower) {
        const { px, py } = toPx(s.follower.x, s.follower.y);
        relayRing(px, py);
      }

      // The gesture in the thumb right now, drawn solid so it is plainly the
      // live one and the committed orders behind it are plainly not.
      const drag = captainDragRef.current;
      if (drag && Math.hypot(drag.to.x - drag.from.x, drag.to.y - drag.from.y) >= CAPTAIN_DRAG_MIN) {
        const from = drag.target === "follower" ? { x: s.follower.x, y: s.follower.y } : drag.target.pos;
        arrow(from, drag.to, 1, false);
      }
    };

    // Decorative team-mates (the crosser on a volley/header, everyone else
    // milling around the box on a corner) — every one of them a real
    // identity now (castScenario, lineup.ts), not just teammates[0]/the
    // crosser. Reported directly: "on corners not all players face show."
    sc.teammates.forEach((t, i) => {
      footballer(t.x, t.y, R, ourKit().shirt, ourKit().trim, {
        sid: `mate${i}`,
        pose: poseFor(`mate${i}`, t.x, t.y),
        phase: runPhase(t.x),
        face: getFaceImage(t.who?.face ?? fakeFaceFor(`mate${i}`)),
        label: namesOn() ? t.who?.shortName : undefined,
      });
    });

    // The runner a pass is aimed at — drawn at their LIVE position, which is the
    // exact point reception is tested against, so the ball can never appear to
    // pass through them without being controlled.
    [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners].forEach((r, i) => {
      // Arms out the moment they take the ball down, so a completed pass reads
      // on the pitch and not only in the commentary.
      const receiving = i === 0 && !!rb && rb.receiverControlT > 0;
      // Animations: New — he takes a touch and sets himself (actionAnim.ts)
      // instead of standing still with his arms open.
      const anim = animOf(`run${i}`, r.pos.x, r.pos.y);
      // Hitboxes & jumping (New): a man going up for it is drawn in the air,
      // at the same height the engine tests (r.jump), like a jumping wall.
      const jumpZ = r.jump?.z ?? 0;
      footballer(r.pos.x, r.pos.y - jumpZ * 0.42, R, ourKit().shirt, ourKit().trim, {
        sid: `run${i}`,
        anim,
        pose: receiving || jumpZ > 0.15 ? "receive" : poseFor(`run${i}`, r.pos.x, r.pos.y),
        phase: runPhase(r.pos.x),
        face: getFaceImage(r.who?.face ?? fakeFaceFor(`run${i}`)),
        label: namesOn() ? r.who?.shortName : undefined,
      });
    });

    // ── The captain's orders, drawn over his players ──
    //
    // Deliberately drawn AFTER the men and BEFORE the defenders and you, so an
    // order is never hidden behind a shirt and never hides the thing you are
    // aiming at. Only while you still have the ball: once it is struck the
    // orders are being carried out, and a pitch covered in arrows during the
    // flight is noise.

    // A feature's cones (the markers prop) — on the grass, under everyone.
    if (markersRef.current?.length) {
      for (const m of markersRef.current) {
        const { px, py } = toPx(m.x, m.y);
        const vpm = viewportRef.current;
        // A cone about 0.35 m across, at this camera's own pixels per metre.
        const pxPerM = Math.max(canvas.width, canvas.height) / Math.max(vpm.x2 - vpm.x1, vpm.y2 - vpm.y1);
        const r = Math.max(3, 0.35 * pxPerM);
        ctx.fillStyle = m.color ?? "#f97316";
        ctx.beginPath();
        ctx.moveTo(px, py - r * 1.6);
        ctx.lineTo(px + r, py + r * 0.4);
        ctx.lineTo(px - r, py + r * 0.4);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Defenders + you. A wall man in the air is drawn where he actually is —
    // the same height the block test uses, so what you see is what resolves.
    sc.defenders.forEach((d, i) => {
      const lift = (d.z ?? 0) * 0.42;
      footballer(d.x, d.y - lift, R, theirKit().shirt, theirKit().trim, {
        sid: `def${i}`,
        pose: (d.z ?? 0) > 0.15 ? "kick" : poseFor(`def${i}`, d.x, d.y),
        anim: animOf(`def${i}`, d.x, d.y),
        phase: runPhase(d.x),
        face: getFaceImage(d.who?.face ?? fakeFaceFor(`def${i}`)),
        label: namesOn() ? d.who?.shortName : undefined,
      });
    });
    // An automatic kick (v0.15 items 6/7): the man over the ball is the taker —
    // a team-mate in your shirt, or one of theirs in theirs — named, no star.
    const auto = autoKickOf(sc);
    const takerKit = auto?.side === "them" ? theirKit() : ourKit();
    // During a run-up the taker moves the way his style does (runupStyles.ts).
    const ruNow = phaseRef.current === "runup" ? runupRef.current : null;
    const runBody0 = ruNow && !ruNow.arrived && kickPoseRef.current <= 0 ? runupPoseAt(ruNow.styled, ruNow.t) : null;
    // v0.25 item 4 — the foot he kicks with (lib/star/kickFoot.ts). Picture
    // only: on a penalty or a direct free kick a left-footer is DRAWN coming
    // from the right of the ball, the mirror of a right-footer, and the kick
    // swings that foot. `sc.player`, the aim and the ball are untouched.
    const takerFoot = auto
      ? takerFootSign(auto.taker.id || auto.taker.name)
      : footSign(preferredFootRef.current ?? careerRef.current?.player.preferredFoot ?? activeFoot());
    // Mikey, 20 Oct 2026: your man is drawn on every chance, so the moment a
    // chance opens (its first aim frame, before you see it) he is moved off
    // the ball and the arrow's line to goal (lib/star/youSpot.ts). Once per
    // chance; penalties and free kicks keep their own run-up spot.
    if (!auto && phaseRef.current === "aim" && !leadRef.current && !playOnRef.current
      && !hasRunup(sc.kind) && sceneRef.current?.you !== false && !youPlacedRef.current.has(sc)) {
      youPlacedRef.current.add(sc);
      const vpNow = viewportRef.current;
      const span = facingRef.current === "up" ? vpNow.y2 - vpNow.y1 : vpNow.x2 - vpNow.x1;
      const spot = clearYouSpot({ ball: sc.ball, player: sc.player, foot: takerFoot, toPx, R, ballR: BALL_PX, arrowM: span * 0.132 * 1.05 });
      sc.player.x = spot.x; sc.player.y = spot.y;
    }
    const drawnTaker = hasRunup(sc.kind) ? drawnTakerAt(sc.ball, sc.player, takerFoot) : { at: sc.player, mirrored: false };
    const runBody = runBody0 && drawnTaker.mirrored ? { ...runBody0, lean: -runBody0.lean } : runBody0;
    const tx = drawnTaker.at.x, ty = drawnTaker.at.y;
    // New view (option D): a thin ring on the grass under the man on the
    // ball, so he is findable at the smaller size. Under everyone: the figure
    // queue has not painted anybody yet.
    // Harry, 3 Oct 2026: in open play your own man is not drawn (new view) —
    // the ball, with this ring under it, is "you". lib/star/newLook.ts.
    // During a lead-in you are a man running onto the last pass, so you are drawn.
    // …and while your pass plays on you are the man making the run (playOn.ts).
    const youShown = leadRef.current || playOnRef.current ? sceneRef.current?.you !== false : showYouFigure(sc.kind, { newView: nv, sceneYou: sceneRef.current?.you });
    const ringOnBall = !auto && !youShown && sceneRef.current?.you !== false;
    if (nv && (phaseRef.current === "aim" || phaseRef.current === "runup") && (auto || youShown || ringOnBall)) {
      const f = ringOnBall ? toPx(sc.ball.x, sc.ball.y) : toPx(tx, ty);
      const rr = R * 0.62;
      ctx.save();
      ctx.lineWidth = Math.max(1.5, R * 0.07);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      // On the ball it is a round ring a clear gap outside it: the flat
      // ellipse a man stands in, put round a ball, made ball + ring read as
      // an eye (Harry, 3 Oct 2026).
      if (ringOnBall) ctx.arc(f.px, f.py, Math.max(BALL_PX * f.scale * 2.3, R * 0.34), 0, Math.PI * 2);
      else ctx.ellipse(f.px, f.py, rr, rr * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Match feel: New — your own strike (drawn players): a wind-up, then the
    // big follow-through from the Animations system, sized by how hard you
    // hit it. The 3D players get the same from their kick clip (spriteHint).
    let youFeelAnim: OutfieldAnimFrame | null = null;
    if (feelOn && kickPoseRef.current > 0) {
      const fs = takerFoot >= 0 ? 1 : -1;
      if (feelSt.windUp > 0 && feelSt.windUpTotal > 0) {
        const w = Math.sin((Math.PI / 2) * (1 - feelSt.windUp / feelSt.windUpTotal)) ;
        youFeelAnim = { pose: { crouch: 0.22 * w, armSpread: 0.5 * w, armLift: -0.3, legSwing: -0.6 * w * fs }, liftR: 0, lean: -0.14 * w * fs, kickClipU: null, flash: 0, flashSize: 0, dust: false };
      } else {
        const pw = feelSt.struck?.f.power ?? 0.6;
        const dials = { ...animSet.dials, strikeSwing: animSet.dials.strikeSwing * (0.7 + 0.6 * pw), contactFlash: 0 };
        const e = feelSt.hitStop > 0 && kickPoseRef.current >= KICK_POSE_S ? 0.06 : ((KICK_POSE_S - kickPoseRef.current) / KICK_POSE_S) * STRIKE_S;
        youFeelAnim = outfieldAnimFrame({ kind: "shot", mode: "ground", start: 0, scene: sc }, Math.min(STRIKE_S, e), fs, dials);
      }
    }
    if (auto) {
      footballer(tx, ty, R, takerKit.shirt, takerKit.trim, {
        anim: youFeelAnim,
        sid: "you",
        pose: kickPoseRef.current > 0 ? "kick" : poseFor("you", tx, ty),
        phase: runPhase(tx),
        body: runBody,
        kickFoot: takerFoot,
        face: readyFaceOr(auto.taker.face, auto.taker.id || auto.taker.name),
        label: auto.taker.shortName,
      });
    } else if (youShown)
    // You wear the same shirt as everybody else on your side — you are one of
    // eleven, not a differently-coloured avatar. The armband of a name label is
    // what picks you out, which is how you pick a player out watching football.
    // (A feature can leave you off the picture: `scene.you === false`.)
    footballer(tx, ty, R, ourKit().shirt, ourKit().trim, {
      // Held briefly after a strike so the swing is visible rather than
      // happening entirely between two frames.
      sid: "you",
      pose: kickPoseRef.current > 0 ? "kick" : poseFor("you", tx, ty),
      anim: youFeelAnim,
      phase: runPhase(tx),
      body: runBody,
      kickFoot: takerFoot,
      star: true,
      // Your own photo (Settings → Photo, PortraitPicker) — every OTHER
      // figure already gets one when there's a real identity to draw from;
      // this was the one deliberately left out of the first pass (the star
      // marker already answers "which one is me"), and was reported
      // directly afterward as a real gap: "for some reason my face doesnt
      // show up." A data: URL, not an http(s) one — getFaceImage still
      // caches and draws it exactly the same way; its onerror retry (which
      // appends a query string) just never has anything to fire on, since a
      // data URL either decodes immediately or not at all. Falls back to
      // the default fake face — not the "no photo" circle — when nothing's
      // been chosen; `portrait` itself stays genuinely undefined so Player
      // of the Month/Ballon d'Or cards still fall back to the back of your
      // shirt unless you've actually set something.
      face: getFaceImage(careerRef.current?.player.portrait ?? DEFAULT_FAKE_FACE),
      label: namesOn() ? playerLabel() : undefined,
    });
    // A frame reader gets you even where the 2D picture lets the ball stand for you.
    if (rec && !auto && !youShown && sceneRef.current?.you !== false) {
      rec.figures.push({
        sid: "you", x: tx, y: ty, shirt: ourKit().shirt, shorts: ourKit().trim, team: "us",
        kick: kickPoseRef.current > 0, kickFoot: takerFoot, star: true, drawn: false,
        face: getFaceImage(careerRef.current?.player.portrait ?? DEFAULT_FAKE_FACE)?.src,
      });
    }

    // ── Keeper ──
    // Only where there is a goal to keep. A midfield situation has no goal in
    // the rectangle, so it has no keeper in it either. A function now, not an
    // inline block — see where it's called, below the ball section, for why.
    const drawKeeper = () => {
      // Drawn DELIBERATELY SMALL and at reduced opacity while the ball is live.
      // He stands right in the mouth of the goal from this camera, so a keeper
      // drawn at full size hid the very thing you are trying to watch: whether
      // your shot went in. He is still exactly where the save maths says he is —
      // only the artwork is restrained.
      const kk = sc.keeper;
      if (rec) {
        const k0 = autoKickOf(sc)?.side === "them" ? ourKeeperKitRef.current : kitsRef.current.keeper;
        rec.keeper = keeperFrame(kk, k0, fakeFaceFor("keeper"), actOf("keeper"), true);
      }
      const { px, py, scale: kScale } = toPx(kk.x, kk.y);
      // `dive` is a lean while patrolling and a committed lunge once a save has
      // been decided; saveLunge eases the second one in after the fact.
      const lunge = kk.saveLunge > 0 ? kk.saveLunge : 0;

      // ── Which save is being played ──
      // Set by the engine only after the outcome was decided, so the pose always
      // matches what actually happened rather than predicting it.
      // lean   : how far the body pitches over
      // armUp  : -1 arms driven down, +1 thrown up
      // spread : how wide the arms go
      // reachK : how far the leading glove extends
      // crouch : vertical drop of the whole body
      // (The table itself: KEEPER_SAVE_KIND, lib/star/keeperSaveKinds.ts.)
      const KIND = KEEPER_SAVE_KIND;
      const kind = kk.saveKind ?? null;
      const K = kind ? KIND[kind] : null;

      // ── Idle life ──
      // Breathing and a slow weight shift, so a keeper waiting on his line never
      // looks frozen. Tiny on purpose — it should read as alive, not as fidgeting.
      const breathe = Math.sin(kk.idleT * 2.1) * 0.02;
      const weight = Math.sin(kk.idleT * 0.9) * 0.05;

      // How far the body is committed: a lean while patrolling, a full lunge once
      // a save is being played.
      const diveN = clamp(Math.abs(kk.dive) / 1.6, 0, 1) * 0.45 + lunge * (K ? K.reachK : 0.55);
      const sign = kk.saveLunge > 0 ? (kk.saveDir || 1) : (kk.dive === 0 ? 0 : Math.sign(kk.dive));
      const KR = R * MATCH_KEEPER_R_SHARE * kScale / (nv ? NEW_OUTFIELD_SHRINK : 1);   // smaller than an outfielder, smaller again far away; the keeper is not shrunk with the men
      // Capped just past flat — see MAX_KEEPER_LEAN. Purely the artwork:
      // nothing in the engine reads this rotation.
      // Animations: New — what he did with the ball (lib/star/actionAnim.ts):
      // held it, palmed it, one glove at full stretch, spilled it, got up.
      // Each half can be switched off on its own (animDials.ts): the catch
      // and the fumble, or every other save.
      const ka = animNew ? actorAnimRef.current.get("keeper") : undefined;
      const kFamilyOn = !!ka && (ka.save === "catch" || ka.save === "fumble" ? animSet.on.keeperCatch : animSet.on.keeperSaves);
      const kAnim0 = ka && ka.scene === sc && ka.kind === "save" && kFamilyOn
        ? keeperAnimFrame(ka, now - ka.start, kind === "high" || kind === "fingertip", animSet.dials)
        : null;
      const kAnim = kAnim0 && !animSet.on.flashes ? { ...kAnim0, flash: 0 } : kAnim0;
      const kBase = keeperBasePose(kind, lunge, diveN, sign);
      // A one-handed stretch is a diagonal body reaching up, not a man flat
      // on his side (New only; the "Keeper one-hand lean" dial).
      const lean = keeperLeanWithAnim(kBase.leanRaw, kAnim, animSet.dials.oneHandLean);
      // He is already standing at the ball by the time a save is drawn (the
      // engine puts him there), so the lunge is a pose rather than a journey —
      // a big horizontal offset here would throw the figure straight past the
      // thing he just saved.
      const cx = px + sign * KR * lunge * (K ? K.reachK : 1.0) * 0.3;
      const cyOff = KR * ((K ? K.crouch : 0) * lunge + breathe);
      // The same man as everybody else, in a keeper's pose — see the note on
      // MATCH_FIGURE_HEIGHT_R. He used to be a second figure drawn by a second
      // piece of code with his own head size, his own body and his own arms,
      // which is why he read as a different species standing in the same goal.
      // His old drawn height was 2.482 KR against an outfielder's 2.509 r —
      // inside 1%, so one conversion does for both.
      const kr = figureRForHeight(KR * MATCH_FIGURE_HEIGHT_R);
      // Match feel: New — he gets set and hops onto his toes as it is struck,
      // and a dive has a flight: push off, airborne at full stretch, down on
      // the grass (lib/star/matchFeel.ts). Drawing only.
      let feelLiftPx = 0;
      if (feelOn) {
        const FD = feelDials();
        if (feelSt.struck && lunge < 0.05) feelLiftPx += keeperSetHop(now - feelSt.struck.at, FD) * kr;
        const diving = lunge > 0.04 && sign !== 0 && (kind === "low" || kind === "high" || kind === "fingertip");
        if (diving) feelLiftPx += keeperDiveArc(lunge, kind === "low", FD) * kr * (nv ? 0.5 : 1);
      }

      ctx.save();
      ctx.globalAlpha = 0.92;

      // No highlight ring on a save. The dive is the thing you are watching;
      // a yellow disc drawn over it only told you what you had already seen.
      // Their penalty at YOUR keeper (a shootout): he wears your keeper's kit.
      const gkKit = autoKickOf(sc)?.side === "them" ? ourKeeperKitRef.current : kitsRef.current.keeper;
      // The 3D keeper (new view): faces the ball; once a save is being played
      // (or he is flinging himself well over) he dives, to his own left or
      // right as seen on screen, as far into the clip as the lunge has got.
      let keeperSprite: MatchSpriteHint | undefined;
      let keeperDrawAt: { x: number; y: number } | null = null;
      if (nv) {
        // Harry, 3 Oct 2026: "he's usually not facing the right way, I think
        // his animations need slowing." He has four facings; turning to the
        // ball snapped him side-on whenever it was more than 45° off straight
        // out, and flicked between frames as it moved. A keeper stays square
        // to the pitch, so he faces straight out of his goal.
        const f = facingRef.current;
        const kFacing = f === "right" ? Math.PI : f === "left" ? 0 : Math.PI / 2;
        // Only a real save is a dive. His patrol lean used to trigger the dive
        // clip too, so he flopped about while shuffling across his line.
        // A ball going well wide of the goal is not a save to dive for: the
        // engine still sends him after it (it judges every ball that crosses
        // his line), but he shuffles across rather than throwing himself at a
        // ball rolling out (playtest film, 3 Oct 2026). Drawing only.
        const bl = ballRef.current;
        const wideOfGoal = !!bl && kk.saves === 0 && Math.abs(bl.pos.x - (POST_L + POST_R) / 2) > (POST_R - POST_L) / 2 + 2.5;
        if (lunge > 0.04 && sign !== 0 && wideOfGoal && keeperLandRef.current?.sc !== sc) {
          const a = toPx(kk.x, kk.y), b = toPx(kk.x + sign, kk.y);
          keeperDiveStartRef.current = null;
          keeperSprite = { char: "keeper", clip: "jog", t: kk.idleT, facing: Math.atan2(b.py - a.py, b.px - a.px), kit: { shirt: gkKit.shirt, shorts: gkKit.trim, socks: gkKit.shirt } };
        } else if (lunge > 0.04 && sign !== 0) {
          const a = toPx(kk.x, kk.y), b = toPx(kk.x + sign, kk.y);
          // The dive plays no faster than 0.75× the clip's own speed, however
          // quickly the save itself happens.
          // Animations: New — the clip starts at the save itself, not at
          // the first frame the lunge happened to be seen.
          if (keeperDiveStartRef.current === null) keeperDiveStartRef.current = ka && kAnim ? Math.min(now, ka.start) : now;
          const t = Math.min(lunge * 0.6, (now - keeperDiveStartRef.current) * 0.75);
          // Once he has landed he stays where he landed: the engine still
          // walks him on toward the save point, and a man lying flat slid
          // along the grass after the ball (playtest film, 3 Oct 2026).
          let clip: SpriteClip = keeperDiveClip(kFacing, b.px - a.px, b.py - a.py);
          // Animations: New — a one-handed stretch into the top corner, a low
          // dive along the grass, a palm away (lib/star/sprite3dAnim.ts).
          if (kAnim && ka) {
            const nc = keeperDiveClipNew(ka.save, ka.at?.z ?? 0, kind === "high" || kind === "fingertip", sideOfDive(clip));
            if (nc && spriteClipReady("keeper", nc)) clip = nc;
          }
          if (t >= 0.55 && keeperLandRef.current?.sc !== sc) keeperLandRef.current = { x: cx + KR * weight * (1 - lunge), y: py, sc, clip };
          if (keeperLandRef.current?.sc === sc) keeperDrawAt = keeperLandRef.current;
          keeperSprite = { char: "keeper", clip, t, facing: kFacing, kit: { shirt: gkKit.shirt, shorts: gkKit.trim, socks: gkKit.shirt }, centre: Math.min(1, t / 0.4) };
        } else if (keeperLandRef.current?.sc === sc) {
          // Down is down: once he has landed in this chance he stays lying
          // where he landed until the next one (a goal briefly stood him back
          // up mid-celebration — playtest film, 3 Oct 2026).
          const land = keeperLandRef.current;
          keeperDrawAt = land;
          keeperSprite = { char: "keeper", clip: land.clip, t: 1, facing: kFacing, kit: { shirt: gkKit.shirt, shorts: gkKit.trim, socks: gkKit.shirt }, centre: 1 };
          // Animations: New — he pushes himself back up off the grass.
          const upClip: SpriteClip = sideOfDive(land.clip) === "R" ? "getUpR" : "getUpL";
          if (kAnim && kAnim.getUp > 0 && spriteClipReady("keeper", upClip)) {
            keeperSprite = { ...keeperSprite, clip: upClip, t: keeperGetUpT(kAnim.getUp, spriteClipFrames("keeper", upClip), spriteClipFps("keeper", upClip)), centre: 1 - kAnim.getUp };
          }
        } else {
          keeperDiveStartRef.current = null;
          keeperLandRef.current = null;
          // The ready bounce at 60% speed (about 2 frames a second).
          keeperSprite = { char: "keeper", clip: "ready", t: kk.idleT * 0.6, facing: kFacing, kit: { shirt: gkKit.shirt, shorts: gkKit.trim, socks: gkKit.shirt } };
          // Animations: New — a ball taken standing: held to his chest, or spilled.
          const sc3 = kAnim && ka ? keeperStandingClip(ka.save) : null;
          if (sc3 && ka && spriteClipReady("keeper", sc3)) keeperSprite = { ...keeperSprite, clip: sc3, t: now - ka.start };
        }
      }
      drawMatchFigure(ctx, nv ? "new" : "classic",
        keeperDrawAt ? keeperDrawAt.x : cx + KR * weight * (1 - lunge), keeperDrawAt ? keeperDrawAt.y : py, kr, {
        sprite: keeperSprite,
        look: {
          shirt: gkKit.shirt,
          shorts: gkKit.trim,
          trim: gkKit.trim,
          skin: SKIN,
          // A kick the match takes for someone (a shootout): his keeper may be
          // new this picture too, so never a blank head while his photo loads.
          face: autoKickOf(sc)
            ? readyFaceOr(kk.who?.face, kk.who?.id ?? "keeper")
            : getFaceImage(kk.who?.face ?? fakeFaceFor("keeper")),
        },
        // The lean below is this screen's own, per-save-kind one rather than
        // the shared renderer's generic one, so every save still pitches over
        // exactly as far as it did — hence dive 0 and the lean handed in as a
        // facing. `lunge` still drives the shared set-crouch-to-full-stretch.
        keeper: { dive: 0, lunge },
        extraLiftPx: feelLiftPx,
        faceStyle: faceStyleRef.current, fakeFaceStyle: fakeFaceStyleRef.current,
        opts: {
          facing: lean,
          // cyOff is the save's own vertical drop plus his breathing. It moves
          // the BODY, never the shadow, which is what a negative lift means.
          liftPx: -cyOff + feelLiftPx,
          shadowR: kr * (0.53 + diveN * 0.38),
          pose: {
            // Direction and spread come from the save being played. A high
            // save drives the arms up, a low save down, a catch brings them
            // together in front; the leading glove goes furthest and the
            // trailing one stays tucked.
            armSpread: clamp(kBase.armSpread + (kAnim?.armSpreadAdd ?? 0), 0, 1),
            armLift: kBase.armLift + (kAnim?.armLiftAdd ?? 0),
            armLead: sign,
            ...(kAnim && (kAnim.trailDrop > 0 || kAnim.handsIn > 0) ? { trailDrop: kAnim.trailDrop, handsIn: kAnim.handsIn } : {}),
          },
          // A kick you are watching names both men: who is taking it, who is in goal.
          label: namesOn() || autoKickOf(sc) ? kk.who?.shortName : undefined,
        },
      });

      // The contact flash at the ball the moment he touches it (the glow
      // Keeper.flash has always marked and nothing ever drew). New only.
      if (kAnim && kAnim.flash > 0 && ka?.at) {
        const f = toPx(ka.at.x, ka.at.y);
        const fy = f.py - Math.max(0, ka.at.z) * heightScale * f.scale;
        drawContactFlash(ctx, f.px, fy, KR * kAnim.flashSize, kAnim.flash);
      }

      ctx.restore();
    };

    // He draws first, with the ball painting over him, by default — he
    // stands between the camera and the goal until the ball actually beats
    // him. Once the ball's own pitch-y has crossed his (into the net, or
    // otherwise past his line rather than still approaching it), HE is the
    // one nearer the camera, so the order flips further down and his body
    // occludes the ball instead of the ball painting over him. Reported
    // directly: "the ball renders in front of goalie even when its behind
    // it in the goal."
    // A chance with no goal in it (build-up, midfield pass) has no keeper —
    // but the new view's camera can still show the goal mouth, and an empty
    // net read as "the goalie isn't in his goal" (Harry, 3 Oct 2026). He
    // stands on his line there, drawn only: nothing in the engine reads it.
    const goalOnCamera = nv && (sc.facing ?? "up") === "up" && viewportRef.current.y1 < 1.5;
    const keeperInView = (goalInView(sc.kind) || goalOnCamera) && sceneRef.current?.keeper !== false;
    const liveBall = ballRef.current;
    const onTheSpot = phaseRef.current === "aim" || phaseRef.current === "runup";
    const ballY = liveBall ? liveBall.pos.y : (onTheSpot ? sc.ball.y : null);
    const ballBehindKeeper = keeperInView && ballY !== null && ballY < sc.keeper.y;

    // The keeper joins the same far-to-near sort as everyone else, so a man
    // standing between him and the camera at a corner is drawn in front of
    // him, not behind. (Once the ball is behind him he is drawn after it,
    // further down, exactly as before.)
    if (keeperInView && !ballBehindKeeper && figureQueue) {
      figureQueue.push({ py: toPx(sc.keeper.x, sc.keeper.y).py, draw: drawKeeper });
    }

    // --- Real Goals (test page): the real goal's ball, a ghost ---
    // Leo's dad: "ghost thing like mariokart where u see the real goal". The
    // real flight as a faint dashed line (and its shadow on the grass), and a
    // pale ball running it: on a loop while you aim, and from your strike
    // while your own ball flies, so the two race. Drawing only.
    const ghost = realGoalRef.current?.ghost;
    const ghostPhase = phaseRef.current;
    if (ghostPhase === "flight") { if (ghostRaceRef.current === null) ghostRaceRef.current = performance.now(); }
    else ghostRaceRef.current = null;
    if (ghost && ghost.pts.length > 1 && !leadRef.current && (ghostPhase === "aim" || ghostPhase === "contact" || ghostPhase === "flight" || ghostPhase === "result")) {
      const S = ghost.pts.map((q) => { const f = toPx(q.x, q.y); return { gx: f.px, gy: f.py, x: f.px, y: f.py - q.z * heightScale * f.scale }; });
      ctx.save();
      ctx.lineWidth = Math.max(1.5, BALL_PX * 0.45);
      ctx.setLineDash([BALL_PX * 1.4, BALL_PX * 1.1]);
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); S.forEach((q, i) => (i ? ctx.lineTo(q.gx, q.gy) : ctx.moveTo(q.gx, q.gy))); ctx.stroke();
      ctx.strokeStyle = "rgba(125,211,252,0.85)";
      ctx.beginPath(); S.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
      ctx.setLineDash([]);
      const dur = Math.max(0.3, ghost.durS);
      const now = performance.now();
      const tt = ghostRaceRef.current !== null ? (now - ghostRaceRef.current) / 1000 : ((now / 1000) % (dur + 1.2));
      const f = Math.min(1, tt / dur);
      const at = f * (S.length - 1), i0 = Math.min(S.length - 2, Math.floor(at)), w = at - i0;
      const gxp = S[i0].x + (S[i0 + 1].x - S[i0].x) * w, gyp = S[i0].y + (S[i0 + 1].y - S[i0].y) * w;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#e0f2fe";
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = Math.max(1, BALL_PX * 0.25);
      ctx.beginPath(); ctx.arc(gxp, gyp, BALL_PX * 1.05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // --- Ball trail (fades along the flight; curl makes it sing) ---
    const trail = trailRef.current;
    // Match feel: New — a speed streak instead of the dots: a tapered smear
    // behind the ball whose length follows how fast it is going.
    const feelBall = ballRef.current;
    const feelSpeed = feelBall ? Math.hypot(feelBall.vel.x, feelBall.vel.y, feelBall.vz) : 0;
    const vfxTrail = vfxRef.current?.trail;
    if (vfxTrail) {
      // The lab's trail (vfxOverride): the same path, the picked picture.
      if (feelBall && trail.length > 1 && phaseRef.current === "flight") {
        const toS = (q: { x: number; y: number; z: number }) => { const f = toPx(q.x, q.y); return { x: f.px, y: f.py - q.z * heightScale * f.scale }; };
        const pts = trail.map(toS);
        pts.push(toS({ x: feelBall.pos.x, y: feelBall.pos.y, z: Math.max(0, feelBall.z) }));
        const hb = toPx(feelBall.pos.x, feelBall.pos.y);
        drawVfxTrail(ctx, vfxTrail, pts, BALL_PX * hb.scale, Math.min(1, Math.max(0, (feelSpeed - 6) / 20)), feelT);
      }
    } else if (feelOn && feelBall && trail.length > 1) {
      const want = streakMetres(feelSpeed, feelDials());
      const pts: { x: number; y: number }[] = [];
      const head = { x: feelBall.pos.x, y: feelBall.pos.y, z: Math.max(0, feelBall.z) };
      let acc = 0, last = head;
      const toS = (q: { x: number; y: number; z: number }) => { const f = toPx(q.x, q.y); return { x: f.px, y: f.py - q.z * heightScale * f.scale }; };
      pts.push(toS(head));
      for (let i = trail.length - 1; i >= 0 && acc < want; i--) {
        const q = trail[i];
        acc += Math.hypot(q.x - last.x, q.y - last.y, q.z - last.z);
        pts.push(toS(q));
        last = q;
      }
      if (want > 0 && pts.length > 1 && phaseRef.current === "flight") {
        pts.reverse();
        const hb = toPx(head.x, head.y);
        drawSpeedStreak(ctx, pts, BALL_PX * hb.scale * 1.05, Math.min(1, (feelSpeed - 9) / 14));
      }
    } else for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const k = (i + 1) / trail.length;
      const { px, py, scale } = toPx(t.x, t.y);
      ctx.beginPath();
      ctx.arc(px, py - t.z * heightScale * scale, BALL_PX * scale * (0.3 + 0.5 * k), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.06 + 0.24 * k})`;
      ctx.fill();
    }

    // --- Ball ---
    // Three cues tell you how high it is, because one is never enough:
    //   1. it lifts off its own shadow, and the gap grows with height;
    //   2. the shadow shrinks and fades as it climbs away from the grass;
    //   3. the ball itself grows as it rises toward the camera.
    // The old version had the first of these and almost none of the other two,
    // which is why a chip and a driven shot looked much the same.
    const drawBall = (x: number, y: number, z: number) => {
      const { px, py, scale } = toPx(x, y);
      const bScale = BALL_PX * scale;
      const h = Math.max(0, z);

      // Ground shadow — stays ON the pitch, directly under the ball.
      const shadowShrink = 1 / (1 + h * 0.16);
      if (!(nv && matchBallLook() === "new")) {
      ctx.beginPath();
      ctx.ellipse(px, py, bScale * 1.05 * shadowShrink, bScale * 0.5 * shadowShrink, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.34 * shadowShrink})`;
      ctx.fill();
      }

      // The ball, lifted off the shadow and grown a little with height.
      const by = py - h * heightScale * scale;
      // Harry, 13 Oct 2026: "actually the ball rising up in the air": it grows clearly as it climbs (was +5.5%
      // a metre, now +9%, up to +72% at 8 m), and leaves faint puffs of air behind it while it is up.
      const br = bScale * (1 + Math.min(h, 8) * 0.09);
      {
        const now = performance.now();
        const puffs = airPuffsRef.current;
        const last = puffs[puffs.length - 1];
        if (h > 0.4 && (!last || now - last.t > 45 || Math.hypot(px - last.x, by - last.y) > br * 1.2)) {
          puffs.push({ x: px, y: by, r: br, t: now });
          if (puffs.length > 14) puffs.shift();
        }
        while (puffs.length && now - puffs[0].t > 420) puffs.shift();
        for (const q of puffs) {
          const age = (now - q.t) / 420;
          if (age <= 0.02) continue;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.r * (0.55 + age * 0.6), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${0.22 * (1 - age)})`;
          ctx.fill();
        }
      }
      // Match feel: New — the ball squashes at a hit and springs back, and
      // stretches along its flight with speed. Drawing only.
      let feelXf = false;
      if (feelOn) {
        const FD = feelDials();
        const q = squashAt(feelT - feelSt.squash.at, feelSt.squash.amt);
        const st = phaseRef.current === "flight" && feelBall && !feelBall.resting ? speedStretch(feelSpeed, FD) : 1;
        if (Math.abs(q) > 0.01 || st > 1.01) {
          feelXf = true;
          ctx.save();
          ctx.translate(px, by);
          if (st > 1.01 && feelBall) {
            const d = screenDir(feelBall.vel.x, feelBall.vel.y);
            const th = Math.atan2(d.y, d.x);
            ctx.rotate(th); ctx.scale(st, 1 / Math.sqrt(st)); ctx.rotate(-th);
          }
          if (Math.abs(q) > 0.01) {
            const d = screenDir(feelSt.squash.ax, feelSt.squash.ay);
            const th = Math.atan2(d.y, d.x);
            ctx.rotate(th); ctx.scale(1 - 0.38 * q, 1 + 0.28 * q); ctx.rotate(-th);
          }
          ctx.translate(-px, -by);
        }
      }
      // New view, Settings → Look → Ball: New — a clean drawn match ball with
      // its own soft offset shadow (lib/star/matchBall.ts). Classic: below.
      if (nv && matchBallLook() === "new") {
        drawMatchBall(ctx, px, py, by, br, seamRef.current, h, 1);
        if (feelXf) ctx.restore();
        return;
      }
      const img = ballImgRef.current;
      const a = seamRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        // The real photo, spun by the same roll angle the seam patches used
        // to fake — rotating the actual ball reads as roll far better two
        // drawn smudges ever did.
        ctx.save();
        ctx.translate(px, by);
        ctx.rotate(a);
        ctx.drawImage(img, -br, -br, br * 2, br * 2);
        ctx.restore();
      } else {
        // Before the image has loaded (the ordinary one-frame gap), or —
        // the case that was actually reported — a real failed fetch the
        // mount effect above is now busy retrying. A blank spot where the
        // ball should be is worse than this plain fallback either way.
        ctx.beginPath();
        ctx.arc(px, by, br, 0, Math.PI * 2);
        ctx.fillStyle = "#fefefe";
        ctx.fill();
        ctx.lineWidth = Math.max(1, 2 * scale);
        ctx.strokeStyle = "#0f172a";
        ctx.stroke();
      }
      if (feelXf) ctx.restore();
    };

    // ── Where it will land ──
    //
    // A ball in the air gets a mark on the grass at the spot it will first
    // bounce, and only the first: once it is down you can see perfectly well
    // where a rolling ball is going. It is the one thing drawn on the pitch that
    // is not part of the pitch, and it earns that because judging the flight of
    // a lofted ball from directly above is otherwise guesswork — height is the
    // one thing this camera cannot show you.
    // Worked out once, at the kick, and pinned — see markLanding. Recomputing it
    // each frame made it crawl across the grass after a curling ball.
    if (ballRef.current && phaseRef.current === "flight" && !ballRef.current.inNet
        && ballRef.current.z > 0.15) {
      const land = ballRef.current.landAt;
      if (land) {
        const m = P(land.x, land.y);
        const r = Math.max(3.5, unit * 0.5);
        ctx.strokeStyle = "rgba(250,214,74,0.95)";
        ctx.lineWidth = Math.max(2.5, unit * 0.19);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.px - r, m.py - r); ctx.lineTo(m.px + r, m.py + r);
        ctx.moveTo(m.px + r, m.py - r); ctx.lineTo(m.px - r, m.py + r);
        ctx.stroke();
        ctx.lineCap = "butt";
      }
    }

    // The ball joins the same far-to-near sort as the players, placed by its
    // shadow — the spot on the grass it is actually over. It used to be
    // painted after everybody, so a ball at your feet with a defender standing
    // in front of you was drawn across HIS head, as if he had it (Mikey, 25
    // Sep 2026). Now whoever is nearer the camera covers it, the way he would.
    // The trail and the landing mark above stay on the grass, under everyone.
    const ball = ballRef.current;
    // B10: a header or volley chance — the ball is IN THE AIR while you aim,
    // its shadow on the grass under it (the gap is the height): a header hangs
    // at your head, a volley bounces (lib/star/airDrawings.ts airWaitZ).
    let airZ = 0;
    if (onTheSpot && !leadRef.current && isAirKind(sc.kind)) {
      const now = performance.now() / 1000;
      if (airT0Ref.current?.sc !== sc) airT0Ref.current = { sc, t0: now };
      airZ = airWaitZ(sc.kind, now - airT0Ref.current.t0, sc);
      // …and a faint line from its shadow up to it, so the height reads at a
      // phone's size (the gap alone is a few pixels on a wide frame).
      if (airZ > 0.12) {
        const g = toPx(sc.ball.x, sc.ball.y);
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = Math.max(1, BALL_PX * g.scale * 0.25);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(g.px, g.py);
        ctx.lineTo(g.px, g.py - airZ * heightScale * g.scale);
        ctx.stroke();
        ctx.restore();
      }
    }
    const ballAt = ball ? { x: ball.pos.x, y: ball.pos.y, z: ball.z }
      : onTheSpot ? { x: sc.ball.x, y: sc.ball.y, z: leadRef.current?.z ?? airZ } : null;
    if (ballAt) {
      const drawIt = () => drawBall(ballAt.x, ballAt.y, ballAt.z);
      if (figureQueue) figureQueue.push({ py: toPx(ballAt.x, ballAt.y).py, draw: drawIt });
      else drawIt();
    }
    // Match feel: New — the back of the net bulges round a goal and ripples
    // out (under the ball, over the goal's mesh).
    if (feelOn && feelSt.net && feelBall && feelBall.inNet) {
      const t = feelT - feelSt.net.at;
      const env = t < 0 ? 0 : t < 0.1 ? Math.sin((Math.PI / 2) * (t / 0.1))
        : (0.55 + 0.45 * Math.cos((t - 0.1) * 16) * Math.exp(-(t - 0.1) * 5)) * Math.max(0, 1 - Math.max(0, t - 1.2) / 0.8);
      if (env > 0.01) {
        const g = toPx(feelBall.pos.x, feelBall.pos.y);
        const gy = g.py - Math.max(0, feelBall.z) * heightScale * g.scale;
        const back = toPx(feelBall.pos.x, feelBall.pos.y - 1);
        drawNetBulge(ctx, g.px, gy, back.px, back.py - Math.max(0, feelBall.z) * heightScale * back.scale,
          BALL_PX * g.scale * 5, feelSt.net.amt * env);
      }
    }
    flushFigures();
    // Hitboxes test view (lib/star/hitbox.ts): test screens only, and only
    // with "Show hitboxes" on in their Hitboxes panel. Each body's outline is
    // drawn at the scale the ball's height is drawn, so you can see whether
    // the ball is over his head or inside his reach.
    if (inTestArea() && showHitboxes()) {
      ctx.save();
      for (const hb of hitboxShapes(sc)) {
        const { px, py } = toPx(hb.x, hb.y);
        const col = hb.side === "def" ? "#f87171" : hb.side === "keeper" ? "#facc15" : "#60a5fa";
        // On the grass: his reach at his feet.
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(px, py, hb.rings[0].r * unit, 0, Math.PI * 2); ctx.stroke();
        // A ball played to him (team-mates): the ring he goes for it in.
        if (hb.control) {
          ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.55;
          ctx.beginPath(); ctx.arc(px, py, hb.control.r * unit, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          // ...and how high he can meet it (a tick on his outline's centre line).
          const ty = py - hb.control.top * heightScale;
          ctx.beginPath(); ctx.moveTo(px - 6, ty); ctx.lineTo(px + 6, ty); ctx.stroke();
        }
        // Standing up off the grass: his outline at each height.
        ctx.globalAlpha = 0.22; ctx.fillStyle = hb.foot > 0.02 ? "#fde047" : col;
        ctx.beginPath();
        hb.rings.forEach((g, i) => { const X = px - g.r * unit, Y = py - g.z * heightScale; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
        for (let i = hb.rings.length - 1; i >= 0; i--) ctx.lineTo(px + hb.rings[i].r * unit, py - hb.rings[i].z * heightScale);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.95; ctx.strokeStyle = hb.foot > 0.02 ? "#fde047" : col; ctx.stroke();
        if (hb.foot > 0.02) {
          ctx.fillStyle = "#fde047"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(`jump ${hb.foot.toFixed(2)}m`, px, py - hb.rings[hb.rings.length - 1].z * heightScale - 4);
        }
      }
      // The ball: a line from its shadow up to it, so its height reads against them.
      const bl = ballRef.current;
      if (bl) {
        const { px, py } = toPx(bl.pos.x, bl.pos.y);
        ctx.globalAlpha = 0.9; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - Math.max(0, bl.z) * heightScale); ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "left";
        ctx.fillText(`${Math.max(0, bl.z).toFixed(2)}m`, px + 6, py - Math.max(0, bl.z) * heightScale);
      }
      ctx.restore();
    }
    // The orders go over every man now rather than between the groups — the
    // groups no longer exist as layers. Thin gold lines, so they never hide
    // what you are aiming at.
    if (isCaptainRef.current && phaseRef.current === "aim" && acceptsCaptainOrders(sc.kind)) {
      drawCaptainOrders(sc);
    }

    // He's been beaten — draw him now, after the ball, so his body is what
    // occludes it rather than the other way round.
    if (ballBehindKeeper) drawKeeper();

    // Animations: New — the flash where a team-mate's or defender's boot (or
    // head) met the ball, over everything so it reads at phone size.
    for (const b of bootFlashes) {
      const f = toPx(b.x, b.y);
      drawContactFlash(ctx, f.px, f.py - Math.max(0, b.z) * heightScale * f.scale, R * 0.55 * f.scale * b.f.flashSize, b.f.flash, b.f.dust);
    }

    // Match feel: New — the contact bursts, landing puffs, glove sparks and
    // woodwork clangs (lib/star/matchFeelDraw.ts). Over everything.
    if (feelOn && feelSt.fx.length) {
      const live: typeof feelSt.fx = [];
      for (const e of feelSt.fx) {
        const u = (feelT - e.at) / e.dur;
        if (u >= 1) continue;
        live.push(e);
        if (u < 0) continue;
        const f = toPx(e.x, e.y);
        const sy = f.py - Math.max(0, e.z) * heightScale * f.scale;
        const sz = BALL_PX * f.scale * 4.2 * e.size;
        if (e.kind === "impact") {
          const d = screenDir(e.vx, e.vy);
          drawImpactBurst(ctx, f.px, sy, sz, u, d.x, d.y, e.power, e.turf, e.scuff);
        } else if (e.kind === "dust") drawDustPuff(ctx, f.px, f.py, sz * 0.8, u, 6, e.salt);
        else if (e.kind === "glove") drawGloveSpark(ctx, f.px, sy, sz * 0.8, u, e.salt);
        else drawClang(ctx, f.px, sy, sz, u);
      }
      feelSt.fx = live;
    }
    // The lab's pictures (vfxOverride, lib/star/vfxLab.ts). Over everything.
    if (vfxFxRef.current.length) {
      const vfxFx = vfxFxRef.current;
      const live = vfxFx.filter((e) => (feelT - e.at) / vfxDurS(e.r) < 1);
      for (const e of live) {
        const u = (feelT - e.at) / vfxDurS(e.r);
        if (u < 0) continue;
        const f = toPx(e.x, e.y);
        const d = screenDir(e.vx, e.vy);
        drawVfx(ctx, e.ev, e.r, u, {
          x: f.px, y: f.py - Math.max(0, e.z) * heightScale * f.scale, dx: d.x, dy: d.y,
          s: BALL_PX * f.scale * 4.2, power: e.power, w: W, h: H, salt: e.salt,
        });
      }
      vfxFxRef.current = live;
    }

    // "After you pass: Joystick" (lib/star/afterPass.ts): the stick, bottom-left,
    // in the match's own picture (the same stick the top-down dribble draws).
    if (phaseRef.current === "flight" && playOnRef.current?.stick?.thumb) {
      const st = poStickUiRef.current;
      const rr = Math.min(W, H) * 0.13;
      // Resting above the commentary box, which covers the bottom of the pitch.
      const ox = st ? st.fx * W : Math.max(rr * 1.25, W * 0.27), oy = st ? st.fy * H : H * 0.72;
      ctx.beginPath(); ctx.arc(ox, oy, rr, 0, Math.PI * 2);
      ctx.fillStyle = st ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.22)"; ctx.fill();
      ctx.lineWidth = Math.max(2, rr * 0.06); ctx.strokeStyle = st ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.45)"; ctx.stroke();
      const kx = ox + (st ? st.vx : 0) * rr, ky = oy + (st ? st.vy : 0) * rr;
      ctx.beginPath(); ctx.arc(kx, ky, rr * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = st ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)"; ctx.fill();
      if (!st) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = `700 ${Math.max(11, Math.round(W * 0.03))}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("Keep running", ox, oy - rr - 8);
        ctx.textAlign = "left";
      }
    }

    // --- Curve boots: a live guide line while the swipe is in progress ---
    //
    // Every other drag in this game shows something happening while you're
    // still holding it down (the aim arrow, the captain's order line). This
    // one drew nothing at all until release — reported directly as "I'm
    // doing stuff... nothing's happening," which is true of the FEEDBACK
    // even on frames where the gesture itself is being read correctly. A
    // screen-space line, not a pitch one — the swipe itself is read in
    // screen pixels — drawn exactly where the finger/mouse actually is. What
    // that raw gesture MEANS (left/right/up/down) is worked out from the
    // pitch's own lateral axis on release, not from these screen pixels
    // directly — see onPointerUp's own note on why.
    if (phaseRef.current === "flight" && canCurve && curveSwipeStartRef.current && curveSwipeCurrentRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvasBox();
        if (rect.width > 0 && rect.height > 0) {
          const toCanvasPx = (clientX: number, clientY: number) => {
            const q = clientToCanvasFrac(clientX, clientY);
            return { px: q.sx * canvas.width, py: q.sy * canvas.height };
          };
          const a = toCanvasPx(curveSwipeStartRef.current.x, curveSwipeStartRef.current.y);
          const b = toCanvasPx(curveSwipeCurrentRef.current.x, curveSwipeCurrentRef.current.y);
          ctx.save();
          ctx.strokeStyle = "rgba(56,189,248,0.9)"; // sky blue — distinct from the orange aim arrow
          ctx.lineWidth = Math.max(2, canvas.width * 0.01);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(a.px, a.py);
          ctx.lineTo(b.px, b.py);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(b.px, b.py, Math.max(3, canvas.width * 0.012), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(56,189,248,0.9)";
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // --- Aim slingshot overlay (brand gold) ---
    // One arrow, drawn for the drag and for the aim you run up with (the
    // penalty run-up, below) — the same arrow both times, so it reads the same.
    const drawAimArrow = (dx: number, dy: number, power: number) => {
      const len = Math.hypot(dx, dy) || 1;
      // Half the previous length at full power, then 20% longer again on top
      // of that (0.11 * 1.2) — reported as reading a little short once the
      // meter beside it was removed and the arrow became the only power
      // readout. Purely the drawn length — `power` itself (and how far you
      // actually have to drag to reach it) is untouched, since this is
      // computed FROM `power`, not the other way round.
      //
      // The metre span used here has to be whichever axis actually fills the
      // screen's HEIGHT — vp.y2-vp.y1 in the ordinary "up" view, where pitch
      // Y genuinely is that axis, but in a turned crossing view the frame is
      // rotated a quarter turn and it is pitch X that fills the height (see
      // toPx). Always reading vp.y2-vp.y1 drew the arrow against the
      // turned frame's WIDTH-sized span instead — about 60% of the metres
      // it should have had — so the exact same power looked visibly shorter
      // on every corner and cross. Reported directly.
      // ── The spread (Shots: New, lib/star/shotModel.ts) ── a faint cone on
      // to the goal line, as wide as this strike really scatters (1.5 sd
      // each side: about 87 in 100 of your clean strikes land inside it). So
      // the arrow tells the truth about where the ball goes, skill and all.
      // The cone is drawn in the test area only (Harry, 12 Oct 2026; lib/star/testArea.ts).
      if (shotsPro() && inTestArea() && aimedAtGoal(sc, { x: dx, y: dy })) {
        const sd = spreadDeg(sc, power, skills.technique) * 0.85;
        const half = (Math.min(25, sd * 1.5) * Math.PI) / 180;
        const n0 = Math.hypot(dx, dy) || 1;
        const ux0 = dx / n0, uy0 = dy / n0;
        const reach = sc.ball.y / Math.max(0.15, -uy0);
        const edge = (s: number) => {
          const c = Math.cos(s * half), sn = Math.sin(s * half);
          const ex2 = ux0 * c - uy0 * sn, ey2 = ux0 * sn + uy0 * c;
          const t = ey2 < -0.05 ? sc.ball.y / -ey2 : reach;
          return toPx(sc.ball.x + ex2 * t, sc.ball.y + ey2 * t);
        };
        const o = toPx(sc.ball.x, sc.ball.y), l = edge(-1), r = edge(1);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(o.px, o.py);
        ctx.lineTo(l.px, l.py);
        ctx.lineTo(r.px, r.py);
        ctx.closePath();
        const g = ctx.createLinearGradient(o.px, o.py, (l.px + r.px) / 2, (l.py + r.py) / 2);
        g.addColorStop(0, "rgba(251,146,60,0.32)");
        g.addColorStop(1, "rgba(251,146,60,0.08)");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,237,213,0.55)";
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      const heightSpan = facingRef.current === "up" ? vp.y2 - vp.y1 : vp.x2 - vp.x1;
      const lineLen = power * sameOnScreenM(heightSpan, 1, "height") * 0.132;
      const ex = sc.ball.x + (dx / len) * lineLen;
      const ey = sc.ball.y + (dy / len) * lineLen;
      if (rec) rec.aim = { from: { x: sc.ball.x, y: sc.ball.y }, to: { x: ex, y: ey }, power };
      const a = toPx(sc.ball.x, sc.ball.y);
      const b = toPx(ex, ey);
      // Solid, tapered orange arrow: a round-capped shaft into a clean triangular
      // head. Same length as before (tip stays at b) — only the styling changed.
      const ang = Math.atan2(b.py - a.py, b.px - a.px);
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const nx = -uy, ny = ux; // perpendicular
      const arrowLen = Math.hypot(b.px - a.px, b.py - a.py) || 1;
      // Slimmer, more tapered arrow — the old shaft/head were roughly a third
      // of the arrow's own length wide, which read as a fat wedge rather than
      // a thrown dart. Reported directly against a reference screenshot of a
      // slim, needle-like drag arrow.
      const headLen = clamp(W * 0.045, W * 0.02, arrowLen * 0.45);
      const headHalf = W * 0.022;
      const shaftW = W * 0.014;
      const bx = b.px - ux * headLen, by = b.py - uy * headLen; // head base

      // shaft
      const shaftGrad = ctx.createLinearGradient(a.px, a.py, b.px, b.py);
      shaftGrad.addColorStop(0, "#fb923c");
      shaftGrad.addColorStop(1, "#ea580c");
      ctx.strokeStyle = shaftGrad;
      ctx.lineWidth = shaftW;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.lineCap = "butt";

      // head
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(bx + nx * headHalf, by + ny * headHalf);
      ctx.lineTo(bx - nx * headHalf, by - ny * headHalf);
      ctx.closePath();
      ctx.fillStyle = "#f97316";
      ctx.fill();
      // subtle darker edge for definition
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1, unit * 0.22);
      ctx.strokeStyle = "rgba(124,45,18,0.6)";
      ctx.stroke();
      // The left-edge power meter that used to sit beside this arrow is gone
      // — reported as redundant with the arrow's own length, which already
      // is the power readout.
    };
    if (phaseRef.current === "aim" && draggingRef.current && dragRef.current) {
      const d = dragRef.current;
      drawAimArrow(sc.ball.x - d.x, sc.ball.y - d.y, powerFromDrag(d, sc.ball));
    }
    // ── The run-up (penaltyRunup.ts) ──
    // The aim you're running up with stays on screen. On a penalty it swings
    // with your drag, with a faint line on to the goal line and a ring where
    // it crosses — so a swing can be judged against the keeper's hop.
    if (phaseRef.current === "runup" && runupRef.current && !runupRef.current.auto) {
      const ru = runupRef.current;
      const dir = ru.nudge ? nudgedDir(sc.ball, ru.dir0, ru.nudgeM) : ru.dir0;
      if (ru.nudge) {
        const from = toPx(sc.ball.x, sc.ball.y), to = toPx(goalLineX(sc.ball, dir), 0);
        ctx.save();
        ctx.setLineDash([Math.max(3, unit * 0.5), Math.max(3, unit * 0.45)]);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = Math.max(1.5, W * 0.005);
        ctx.beginPath();
        ctx.moveTo(from.px, from.py);
        ctx.lineTo(to.px, to.py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(to.px, to.py, Math.max(4, unit * 0.55), 0, Math.PI * 2);
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = Math.max(2, W * 0.007);
        ctx.stroke();
        ctx.restore();
      }
      drawAimArrow(dir.x, dir.y, ru.power);
    }

    // --- Confetti (brand colours, goal only) ---
    for (const p of particlesRef.current) {
      const { px, py } = toPx(p.x, p.y);
      const s = p.size * unit;
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-s / 2, -s / 4, s, s / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // end camera nudge

    // --- Goal flash (screen-space, not shaken; faint + brief under reduced motion) ---
    const fl = flashRef.current;
    if (fl.t > 0) {
      const k = fl.t / fl.dur;
      const maxA = reducedMotionRef.current ? 0.14 : 0.32;
      const gm = toPx(CX, 0);
      const fg = ctx.createRadialGradient(gm.px, gm.py, 0, gm.px, gm.py, W * 0.75);
      fg.addColorStop(0, `rgba(253,230,138,${maxA * k})`);
      fg.addColorStop(1, "rgba(253,230,138,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Hand the frame to a reader (lib/star/engineFrame.ts) ──
    // What was just drawn, in pitch metres, and the camera it was drawn with.
    // Read only: nothing a reader does reaches the match.
    const obs = frameObsRef.current;
    // Never let a reader stop the match: this runs inside the match's own
    // frame loop, so a throw here would end the loop and freeze both pictures
    // (Harry, 9 Oct 2026: "3D just stopped working mid game").
    try {
    // The keeper the 2D didn't draw (no goal in its frame): still in his goal
    // for a 3D camera that shows it (Harry, 9 Oct 2026: "no goalie in the goal on some").
    if (rec && !rec.keeper && frameHasKeeper(sceneRef.current?.keeper)) {
      const k0 = autoKickOf(sc)?.side === "them" ? ourKeeperKitRef.current : kitsRef.current.keeper;
      rec.keeper = keeperFrame(sc.keeper, k0, fakeFaceFor("keeper"), actOf("keeper"), false);
    }
    if (obs && rec) {
      const box = canvasBox();
      const lb = ballRef.current;
      obs.onFrame({
        t: performance.now() / 1000,
        phase: phaseRef.current,
        kind: sc.kind,
        cam: { viewport: { ...viewportRef.current }, facing: facingRef.current, tilt: tiltGeomRef.current, W: box.width, H: box.height },
        ball: ballAt ? {
          x: ballAt.x, y: ballAt.y, z: ballAt.z,
          vx: lb?.vel.x ?? 0, vy: lb?.vel.y ?? 0, vz: lb?.vz ?? 0, live: !!lb, inNet: !!lb?.inNet,
        } : null,
        landing: lb && phaseRef.current === "flight" && !lb.inNet && lb.z > 0.15 && lb.landAt ? { ...lb.landAt } : null,
        keeper: rec.keeper,
        figures: rec.figures,
        aim: rec.aim,
        ring: nv && (phaseRef.current === "aim" || phaseRef.current === "runup") && (auto || youShown || ringOnBall)
          ? (ringOnBall ? { x: sc.ball.x, y: sc.ball.y } : { x: tx, y: ty }) : null,
        goalSide: phaseRef.current === "result" ? goalSideRef.current : null,
        goalInView: goalInView(sc.kind) || goalOnCamera,
        orders: captainOrdersFrame(sc),
        runup: phaseRef.current === "runup" && runupRef.current ? { t: runupRef.current.t, runS: runupRef.current.runS } : null,
        leadIn: leadRef.current ? {
          lock: leadRef.current.cam.lockAt(leadRef.current.t, baseViewportRef.current),
          ball: { ...leadRef.current.ball }, keeper: leadRef.current.endKeeper, at: leadRef.current.endAt,
        } : null,
      });
    }
    } catch (e) {
      if (!frameReaderErrRef.current) { frameReaderErrRef.current = true; console.error("Match frame reader failed (the match carries on)", e); }
    }
  }, [toPx]);

  // --- Cosmetic FX helpers ---
  const nudge = (dur: number, mag: number) => {
    if (reducedMotionRef.current) return;
    shakeRef.current = { t: dur, dur, mag };
  };

  // ── Match feel: New (lib/star/matchFeel.ts) ── looks and sound only.
  // Nothing below reads or writes the ball, the keeper or rngRef.
  const feelNow = () => performance.now() / 1000;
  const feelFx = (kind: "impact" | "dust" | "glove" | "clang", x: number, y: number, z: number, size: number, dur: number,
    extra: { vx?: number; vy?: number; power?: number; turf?: boolean; scuff?: boolean } = {}) => {
    const fl = feelRef.current;
    fl.salt = (fl.salt + 1) % 997;
    fl.fx.push({ kind, at: feelNow(), dur, x, y, z, size, vx: extra.vx ?? 0, vy: extra.vy ?? -1, power: extra.power ?? 0.5,
      turf: !!extra.turf, scuff: !!extra.scuff, salt: fl.salt * 13 });
    if (fl.fx.length > 24) fl.fx.shift();
  };
  const feelPunch = (px: number, dur: number, vx: number, vy: number) => {
    if (reducedMotionRef.current || !(px > 0)) return;
    const fl = feelRef.current;
    // A bigger punch already ringing is not cut short by a smaller one.
    const left = fl.punch.at + fl.punch.dur - feelNow();
    if (left > 0 && fl.punch.px * (left / fl.punch.dur) > px) return;
    fl.punch = { at: feelNow(), dur, px, vx, vy };
  };
  const feelSquash = (amt: number, ax: number, ay: number) => {
    const l = Math.hypot(ax, ay) || 1;
    feelRef.current.squash = { at: feelNow(), amt, ax: ax / l, ay: ay / l };
  };
  /** The strike lands: the moment of contact, after the wind-up. */
  const feelLandStrike = () => {
    const fl = feelRef.current;
    const p = fl.pending;
    fl.pending = null;
    if (!p) return;
    const f = p.f;
    fl.struck = { at: feelNow(), f };
    feelFx("impact", p.x, p.y, p.z, f.flash, 0.28 + 0.14 * f.power, { vx: p.vx, vy: p.vy, power: f.power, turf: p.z < 0.3, scuff: f.scuff });
    feelSquash(f.squash, p.vx, p.vy);
    feelPunch(f.shakePx, 0.22 + 0.12 * f.power, p.vx, p.vy);
    // A header: the head-on-ball thump (matchSound playHeader), firm enough to hear.
    if (f.header) playHeader(Math.max(f.power, HEADER_FEEL_FLOOR), Math.max(f.gain, (0.35 + 0.75 * HEADER_FEEL_FLOOR) * feelDials().soundGain));
    else playStrike(f.power, f.gain, f.bass, f.scuff);
    feelHaptic(f.hapticMs);
  };
  /** Called every frame first thing: true while the picture is held. */
  const feelTick = (dt: number): boolean => {
    const fl = feelRef.current;
    if (!(fl.hitStop > 0)) return false;
    if (fl.windUp > 0) {
      fl.windUp -= dt;
      if (fl.windUp <= 0) { fl.windUp = 0; feelLandStrike(); }
    }
    fl.hitStop -= dt;
    if (fl.hitStop <= 0) {
      fl.hitStop = 0;
      if (fl.pending) feelLandStrike();
      return false;
    }
    return true;
  };
  /** Hold the picture for `s` seconds (a glove, the woodwork). */
  const feelFreeze = (s: number) => {
    if (!(s > 0)) return;
    const fl = feelRef.current;
    fl.hitStop = Math.max(fl.hitStop, s);
  };
  /** Every frame of a live ball: did it land, or was it hit (glove, post, a body)? */
  const feelWatchBall = () => {
    const b = ballRef.current;
    const fl = feelRef.current;
    if (!b) { fl.prev = null; return; }
    const D = feelDials();
    const p = fl.prev;
    if (p && p.ball === b) {
      const dvx = b.vel.x - p.vx, dvy = b.vel.y - p.vy, dvz = b.vz - p.vz;
      // Landing: it was up, now it is down, and it was coming down.
      if (D.landing > 0 && p.z > 0.3 && b.z < 0.12 && p.vz < -2) {
        const k = Math.min(1, -p.vz / 11);
        feelFx("dust", b.pos.x, b.pos.y, 0, (0.55 + 0.6 * k) * D.landing, 0.45);
        playThud(k, D.soundGain * D.landing);
        feelSquash(0.35 * k * D.squash, 0, 1);
      } else {
        // Hit by something (a glove, a post, a body): the ball squashes along the knock.
        const dv = Math.hypot(dvx, dvy, dvz);
        if (dv > 6) feelSquash(Math.min(1, dv / 22) * D.squash, dvx, dvy);
      }
    }
    fl.prev = { ball: b, x: b.pos.x, y: b.pos.y, z: b.z, vx: b.vel.x, vy: b.vel.y, vz: b.vz };
  };
  /** The keeper got a glove (or two) to it. */
  const feelGlove = (at: { x: number; y: number; z: number }, save: string) => {
    const D = feelDials();
    if (!(D.gloveImpact > 0)) return;
    const p = feelRef.current.prev;
    const speed = p ? Math.hypot(p.vx, p.vy, p.vz) : 15;
    const k = Math.max(0.25, Math.min(1, (speed - 6) / 20));
    const held = save === "catch";
    feelFx("glove", at.x, at.y, at.z, (held ? 0.8 : 1.1) * (0.6 + 0.6 * k) * D.gloveImpact, held ? 0.3 : 0.36);
    playGlove(k, D.soundGain, held);
    feelPunch(D.shakePx * 0.5 * k * D.gloveImpact, 0.22, 0, 1);
    feelFreeze((held ? 0.035 : 0.05) * k * D.gloveImpact);
    feelHaptic(Math.round(D.hapticMs * 0.5 * k));
  };
  /** The outcome of a chance, felt. */
  const feelOutcome = (res: string, isGoal: boolean) => {
    const b = ballRef.current;
    const D = feelDials();
    const p = feelRef.current.prev;
    const speed = p ? Math.hypot(p.vx, p.vy, p.vz) : 15;
    const k = Math.max(0.3, Math.min(1, (speed - 5) / 20));
    if (isGoal && b && D.netBulge > 0) {
      feelRef.current.net = { at: feelNow(), amt: k * D.netBulge };
      feelHaptic(Math.round(D.hapticMs * 1.4));
    }
    if (res === "post" && b) feelClang(b.pos.x, b.pos.y, b.z, k);
  };
  const feelClang = (x: number, y: number, z: number, k: number) => {
    const D = feelDials();
    // One clang per hit (the live "post" and the outcome can both name it).
    if (feelRef.current.fx.some((f) => f.kind === "clang" && feelNow() - f.at < 0.4)) return;
    feelFx("clang", x, y, z, 1.1 * (0.6 + 0.5 * k), 0.55);
    playClang(k, D.soundGain);
    feelPunch(D.shakePx * 0.9 * k, 0.4, 1, 0);
    feelFreeze(0.04 * k);
    feelHaptic(Math.round(D.hapticMs * 0.8 * k));
  };

  /** The lab (vfxOverride): start the picked picture for this moment. Pitch metres. */
  const vfxEmit = (ev: VfxEvent, x: number, y: number, z: number, vx: number, vy: number, power: number) => {
    const r = vfxRef.current?.[ev];
    if (!r) return;
    if (r.style === "none") return;
    const now = feelNow();
    // One of each moment at a time (a post can be named twice in one hit).
    if (vfxFxRef.current.some((e) => e.ev === ev && now - e.at < 0.25)) return;
    const salt = (vfxFxRef.current.length * 17 + Math.round(now * 1000)) % 997;
    vfxFxRef.current.push({ ev, r, at: now, x, y, z, vx, vy, power: Math.max(0, Math.min(1, power)), salt });
    if (vfxFxRef.current.length > 24) vfxFxRef.current.shift();
    if (r.params.hitStopMs > 0) feelFreeze(r.params.hitStopMs / 1000);
  };

  const spawnGoalFx = () => {
    if (sceneRef.current?.banners === false) return;
    if (reducedMotionRef.current) {
      flashRef.current = { t: 0.25, dur: 0.25 };
      return;
    }
    flashRef.current = { t: 0.55, dur: 0.55 };
    nudge(0.4, 0.35); // metres of camera travel — the shake is in pitch units now
    const b = ballRef.current;
    const origin = b ? { x: b.pos.x, y: Math.max(b.pos.y, 0.5) } : { x: CX, y: 0.5 };
    const rng = rngRef.current;
    const colors = [C.gold, C.goldSoft, "#34d399", "#ffffff", C.you];
    for (let i = 0; i < 46; i++) {
      const life = 0.8 + rng() * 0.6;
      particlesRef.current.push({
        x: origin.x + (rng() - 0.5) * 5,
        y: origin.y + (rng() - 0.5) * 2,
        vx: (rng() - 0.5) * 14,
        vy: -(3 + rng() * 11),
        rot: rng() * Math.PI * 2,
        vrot: (rng() - 0.5) * 10,
        life, maxLife: life,
        size: 0.5 + rng() * 0.7,
        color: colors[Math.floor(rng() * colors.length)],
      });
    }
  };

  // ── GOAL VIDEOS: what the recorder is told each frame ──
  //
  // The men in the order the screen draws them under (sid): you (or the
  // set-piece taker), the man in the box, the decorative team-mates, the
  // runners, the defenders, the keeper. Kits are the ones this match is
  // drawn in. Photos only when they are a link: your own picture can be a
  // 50 KB data URL, and the replay is handed it at draw time instead.
  const clipBodiesFor = (sc: Scenario): ClipBody[] => {
    const kitOf = (k: { shirt: string; trim: string }) => ({ shirt: k.shirt, shorts: k.trim });
    const link = (f?: string) => (f && !f.startsWith("data:") ? f : undefined);
    const us = kitOf(ourKit()), them = kitOf(theirKit());
    const auto = autoKickOf(sc);
    const out: ClipBody[] = [auto
      ? { id: "you", role: auto.side === "them" ? "opp" : "mate", side: auto.side === "them" ? "them" : "us", name: auto.taker.shortName, face: link(auto.taker.face), kit: auto.side === "them" ? them : us }
      : { id: "you", role: "you", side: "us", name: playerLabel(), kit: us }];
    out.push({ id: "follower", role: "mate", side: "us", name: sc.follower.who?.shortName, face: link(sc.follower.who?.face), kit: us });
    sc.teammates.forEach((t, i) => out.push({ id: `mate${i}`, role: "mate", side: "us", name: t.who?.shortName, face: link(t.who?.face), kit: us }));
    [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners].forEach((r, i) =>
      out.push({ id: `run${i}`, role: "mate", side: "us", name: r.who?.shortName, face: link(r.who?.face), kit: us }));
    sc.defenders.forEach((d, i) => out.push({ id: `def${i}`, role: "opp", side: "them", name: d.who?.shortName, face: link(d.who?.face), kit: them }));
    const gk = auto?.side === "them" ? ourKeeperKitRef.current : kitsRef.current.keeper;
    out.push({ id: "keeper", role: "keeper", side: auto?.side === "them" ? "us" : "them", name: sc.keeper.who?.shortName, face: link(sc.keeper.who?.face), kit: kitOf(gk) });
    return out;
  };
  // Where everything is this frame — the same positions render() draws.
  const clipFrameFor = (sc: Scenario): ClipFrame => {
    const b = ballRef.current;
    const auto = autoKickOf(sc);
    const foot = auto
      ? takerFootSign(auto.taker.id || auto.taker.name)
      : footSign(preferredFootRef.current ?? careerRef.current?.player.preferredFoot ?? activeFoot());
    const you = hasRunup(sc.kind) ? drawnTakerAt(sc.ball, sc.player, foot).at : sc.player;
    const runners = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
    return {
      ball: b ? { x: b.pos.x, y: b.pos.y, z: b.z } : { x: sc.ball.x, y: sc.ball.y, z: 0 },
      bodies: [
        { x: you.x, y: you.y, z: 0 },
        { x: sc.follower.x, y: sc.follower.y, z: 0 },
        ...sc.teammates.map(t => ({ x: t.x, y: t.y, z: 0 })),
        ...runners.map(r => ({ x: r.pos.x, y: r.pos.y, z: 0 })),
        ...sc.defenders.map(d => ({ x: d.x, y: d.y, z: d.z ?? 0 })),
        { x: sc.keeper.x, y: sc.keeper.y, z: 0 },
      ],
      keeper: { dive: sc.keeper.dive, lunge: sc.keeper.saveLunge, dir: sc.keeper.saveDir, kind: sc.keeper.saveKind },
    };
  };
  // One frame into the recorder, and any finished clip out to the career.
  // Only on a real match that asked for clips (onGoalClip), and only while a
  // chance with a goal in it is on the pitch.
  const recordGoalFrame = (dt: number) => {
    if (!onGoalClipRef.current || replayOfRef.current) return;
    const rec = goalRecRef.current ?? (goalRecRef.current = new GoalRecorder());
    const ph = phaseRef.current;
    const sc = scenarioRef.current;
    const live = (ph === "aim" || ph === "runup" || ph === "contact" || ph === "flight" || (ph === "result" && !dribbleRef.current && !tdRef.current))
      && goalInView(sc.kind);
    // A goal keeps being recorded after the match moves on (the commentary
    // comes back 1.8 s after it): the recorder cuts at POST_GOAL_S itself.
    // Only a new chance (begin) or the match closing cuts it early.
    if (live || (rec.recordingGoal && recSceneRef.current === sc)) {
      const bodies = 3 + sc.teammates.length + (sc.runner ? 1 : 0) + sc.secondaryRunners.length + sc.defenders.length;
      if (recSceneRef.current !== sc || rec.bodyIds().length !== bodies) {
        recSceneRef.current = sc;
        rec.begin(clipBodiesFor(sc));
      }
      rec.frame(dt, clipFrameFor(sc));
    } else if (rec.recordingGoal) {
      rec.finishNow();
    }
    for (const tr of rec.take()) {
      try { onGoalClipRef.current?.(tr); } catch { /* a clip never breaks the match */ }
    }
  };
  // The ball has just gone in: the recorder keeps going a moment longer for
  // the net, then cuts the clip. Returns the clip's id for the GoalEvent, or
  // undefined when nothing is being recorded.
  const markGoalClip = (scorer: string, scorerShort: string, isYou: boolean, assist: string | undefined, how: string | undefined, scorerBody?: string): string | undefined => {
    const rec = goalRecRef.current;
    if (!onGoalClipRef.current || replayOfRef.current || !rec?.active) return undefined;
    const id = `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const home = fixtureHomeRef.current;
    const club = careerRef.current?.player.club ?? "Home";
    const opp = fixture?.opponent ?? "Away";
    rec.markGoal({
      id, minute: matchMinuteRef.current, minuteLabel: minuteLabel(matchMinuteRef.current, ADDED, MATCH_DURATION),
      scorer, scorerShort, isYou, assist, how,
      ...(scorerBody ? { scorerBody } : {}),
      home: home ? club : opp, away: home ? opp : club, youAreHome: home,
      scoreAfter: home ? [userScoreRef.current, oppScoreRef.current] : [oppScoreRef.current, userScoreRef.current],
      competition: fixture?.competition,
      weather: conditionsRef.current.weather !== "clear" ? conditionsRef.current.weather : undefined,
      season: careerRef.current?.season, week: careerRef.current?.week,
    });
    return id;
  };

  // Development only — compiled out of the live site (devMode.ts): where the
  // ball and the goal are on the glass, so a playtest bot can aim a real
  // kick instead of guessing (in a real chance the ball can be anywhere in
  // the frame). Read-only: it changes nothing in the match.
  useEffect(() => {
    if (!offlineDevPlayEnabled() || typeof window === "undefined") return;
    const w = window as unknown as { __starMatch?: unknown };
    w.__starMatch = {
      phase: () => phaseRef.current,
      kind: () => scenarioRef.current.kind,
      // "After you pass: Joystick": is the stick up, your push, what he chose.
      playOn: () => {
        const po = playOnRef.current;
        if (!po) return null;
        const s = po.stick;
        return {
          stick: !!s, layOffLive: po.layOffLive, choice: s?.choice ?? null, push: s ? { ...s.push } : null, you: { ...scenarioRef.current.player }, youOnScreen: pitchToClient(scenarioRef.current.player),
          // B14: the run's legs (lib/star/legs.ts) and whether Auto run is steering.
          auto: !!s?.autoOn, thumb: !!s?.thumb, held: !!s?.held,
          legs: s?.legs ? { bar: s.legs.stamina.v, cap: s.legs.cap, sprinting: s.legs.sprinting, speed: Math.hypot(s.legs.vel.x, s.legs.vel.y) } : null,
          energy: energyRef.current,
        };
      },
      ball: () => pitchToClient(ballRef.current ? ballRef.current.pos : scenarioRef.current.ball),
      // show a banner word now, as the match would (banner stills)
      banner: (text: string) => showAction(text),
      goal: () => pitchToClient({ x: CX, y: 0 }),
      // the power a drag of (dx, dy) screen px back from the ball would give
      // (camera tests: the same finger travel must kick as hard whatever the zoom)
      power: (dx: number, dy: number) => {
        const sc = scenarioRef.current, q = pitchToClient(sc.ball);
        return powerFromDrag(pitchFromPointer(q.x + dx, q.y + dy), sc.ball);
      },
      // the camera and everyone in the chance, on the glass (camera tests)
      frame: () => {
        const sc = scenarioRef.current, c = canvasRef.current;
        const r = c?.getBoundingClientRect();
        const men: { role: string; x: number; y: number; cx: number; cy: number }[] = [];
        const add = (role: string, p: { x: number; y: number } | null | undefined) => {
          if (!p) return;
          const q = pitchToClient(p);
          men.push({ role, x: p.x, y: p.y, cx: q.x, cy: q.y });
        };
        add("ball", sc.ball); add("you", sc.player); add("keeper", sc.keeper);
        sc.defenders.forEach((d) => add("def", d));
        sc.teammates.forEach((t) => add("mate", t));
        if (sc.runner) add("runner", sc.runner.pos);
        (sc.secondaryRunners ?? []).forEach((s) => add("runner2", s.pos));
        if (sc.follower) add("follower", sc.follower);
        add("postL", { x: CX - 3.66, y: 0 }); add("postR", { x: CX + 3.66, y: 0 });
        return {
          kind: sc.kind, facing: facingRef.current, cam: { ...viewportRef.current }, tilt: tiltDegRef.current,
          zoom: playZoomRef.current, canvas: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
          box: (() => { const b = canvasBox(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })(),
          men, hw: canvasHW(), sc: JSON.parse(JSON.stringify(sc)),
          // B14b: how big a man is on the glass (CSS px, head to boots) and the
          // pitch in view (metres across x down), at this camera, this frame.
          ...(() => {
            const vp = viewportRef.current, turned = facingRef.current !== "up";
            return { figPx: figPxOnGlass(), barCorner: barCornerRef.current, metres: { across: turned ? vp.y2 - vp.y1 : vp.x2 - vp.x1, down: turned ? vp.x2 - vp.x1 : vp.y2 - vp.y1 } };
          })(),
        };
      },
      // the ball in flight, and a way to set it (ball-physics stills: send a
      // real strike at the post, the bar or the net). Dev only, like the rest.
      ballState: () => (ballRef.current ? { ...ballRef.current, pos: { ...ballRef.current.pos }, vel: { ...ballRef.current.vel } } : null),
      setBall: (b: { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin?: number; shot?: boolean }) => {
        const bl = ballRef.current;
        if (!bl || phaseRef.current !== "flight") return false;
        bl.pos = { x: b.x, y: b.y }; bl.z = b.z; bl.vel = { x: b.vx, y: b.vy }; bl.vz = b.vz; bl.spin = b.spin ?? 0;
        if (b.shot !== undefined) { bl.shot = b.shot; bl.youStruckAtGoal = b.shot; }
        bl.landAt = undefined;
        bl.realLane = undefined;   // the Real Goals page's lane is decided again on the next step
        return true;
      },
      // a dribble run now, while a chance is waiting to be taken (test bots:
      // the dribble chance is a roll of the hidden match, so it can take a
      // whole match to come up). The same set-up the hidden match's request does.
      dribble: () => {
        if (phaseRef.current !== "aim") return false;
        const rng = rngRef.current;
        fpDribbleRef.current = rollDribbleRun(rng);
        setAim(null); setOutcome(null); dragRef.current = null; draggingRef.current = false;
        setPhase(startTopDownDribble()); // Dribble: always top-down in matches (decided 12 Oct 2026)
        return true;
      },
    };
    return () => { delete w.__starMatch; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── A lead-in (the `leadIn` prop, lib/star/leadIn.ts) ──
  // A replay: the people and the ball are put where it says, and the frame is
  // carried with the ball. Nothing is stepped. At the end everyone is put back
  // exactly where the chance has them, and the chance starts.
  const applyLeadIn = () => {
    const L = leadRef.current;
    if (!L) return;
    const sc = scenarioRef.current;
    L.ents.forEach((e) => { const p = L.lead.posAt(e.key, L.t); if (p) e.set(p); });
    const b = L.lead.ballAt(L.t);
    sc.ball.x = b.x; sc.ball.y = b.y; L.z = b.z;
    viewportRef.current = L.cam.at(L.t, baseViewportRef.current);
  };
  const startLeadIn = (moment?: LeadMoment, own?: (sc: Scenario) => LeadIn | null) => {
    const build = own ? ((s: Scenario) => own(s)) : leadInPropRef.current;
    if (!build) return;
    const sc = scenarioRef.current;
    let lead: LeadIn | null = null;
    // One picture (openOn): the opening chance, with its frame and the match's minute and score.
    const opening: LeadMoment = {
      opening: true, fresh: true, seed: seedRef.current,
      frame: { ...baseViewportRef.current },
      minute: matchMinuteRef.current, scoreDiff: userScoreRef.current - oppScoreRef.current,
    };
    try { lead = build(sc, moment ?? opening); } catch (e) { console.error("Lead-in could not be built (the chance plays as normal)", e); }
    if (!lead || !(lead.durS > 0)) return;
    runOnRef.current = null;
    const ents = leadInEntities(sc);
    const ends = ents.map((e) => e.get());
    // Men who JOIN the chance (a covering defender in from off the screen):
    // a real defender from now on, in the shape the chance's own defence has
    // (cover; at rest he holds his place). Reset to his place at the end like everyone.
    for (const j of lead.joiners ?? []) {
      const at = lead.posAt(j.key, 0) ?? j.end;
      const d: Scenario["defenders"][number] = { x: at.x, y: at.y, homeX: j.end.x, homeY: j.end.y, containT: 0, speed: 1, role: "cover", baseRole: "cover" };
      sc.defenders.push(d);
      ents.push({ key: j.key, side: "opp", get: () => ({ x: d.x, y: d.y }), set: (p) => { d.x = p.x; d.y = p.y; } });
      ends.push({ ...j.end });
    }
    // Team-mates in the move but not in the chance: on the pitch for the lead-in only.
    const mates0 = sc.teammates.length;
    for (let i = 0; i < (lead.extraMates ?? 0); i++) {
      const m = { x: sc.ball.x, y: sc.ball.y };
      sc.teammates.push(m);
      ents.push({ key: `extra${i}`, side: "mate", get: () => ({ x: m.x, y: m.y }), set: (p) => { m.x = p.x; m.y = p.y; } });
    }
    // …and opponents (the man your side wins the ball from): the same, after the chance's own.
    const defs0 = sc.defenders.length;
    for (let i = 0; i < (lead.extraOpps ?? 0); i++) {
      const at = lead.posAt(`oppx${i}`, 0) ?? { x: sc.ball.x, y: sc.ball.y };
      const d: Scenario["defenders"][number] = { x: at.x, y: at.y, homeX: at.x, homeY: at.y, containT: 0, speed: 1, role: "cover", baseRole: "cover" };
      sc.defenders.push(d);
      ents.push({ key: `oppx${i}`, side: "opp", get: () => ({ x: d.x, y: d.y }), set: (p) => { d.x = p.x; d.y = p.y; } });
    }
    // Where the chance has each man, by the figure name the frame uses (for a 3D camera of its own).
    const endAt: Record<string, Vec2> = {};
    let endKeeper: Vec2 | null = null;
    ents.forEach((e, i) => {
      if (i >= ends.length) return;
      const sid = e.key === "keeper" ? null : e.key === "run" ? "run0" : e.key.startsWith("sec") ? `run${Number(e.key.slice(3)) + 1}` : e.key;
      if (sid) endAt[sid] = { ...ends[i] }; else endKeeper = { ...ends[i] };
    });
    leadRef.current = { lead, t: 0, ents, ends, ball: { x: sc.ball.x, y: sc.ball.y }, z: 0, mates0, defs0, cam: leadInCamera(lead, ents.map((e) => e.key)), endAt, endKeeper };
    leadPlayedRef.current = true;
    setLeadInOn(true);
    applyLeadIn();
  };
  const stepLeadIn = (dt: number) => {
    const L = leadRef.current;
    if (!L) return;
    // The screen's picture (the 3D view) is still loading: hold on the first frame.
    if (frameObsRef.current?.warming && L.t === 0) { applyLeadIn(); return; }
    const was = L.t;
    L.t += dt;
    // A foul before a set piece: the referee's whistle as it happens.
    const wAt = L.lead.whistleAt;
    if (wAt !== undefined && was < wAt && L.t >= wAt) playWhistle();
    // Its line over the picture, when it asks (a state change only when the line changes).
    const cap = L.lead.captionShown && L.t < L.lead.durS ? L.lead.captionAt?.(L.t) ?? null : null;
    if (cap !== leadCapRef.current) { leadCapRef.current = cap; setLeadCap(cap); }
    if (L.t < L.lead.durS) {
      applyLeadIn();
      try { L.lead.onTick?.(L.t, false); } catch { /* an observer never breaks the match */ }
      return;
    }
    // The move ended in a called offside: no chance follows (endInOffside).
    if (L.lead.offside) { endInOffside(L); return; }
    const sc = scenarioRef.current;
    // Still running at the hand-over (runOnS): those men stay where the lead-in
    // has them at durS and carry on (stepRunOn); everyone else is on his spot.
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
    viewportRef.current = baseViewportRef.current;
    leadRef.current = null;
    runOnRef.current = runEnts.length ? { lead: L.lead, t: 0, ents: runEnts, ends: runEnds } : null;
    setLeadInOn(false);
    try { L.lead.onTick?.(L.lead.durS, true); } catch { /* an observer never breaks the match */ }
  };
  /** Is this man under the captain's orders, or the man pressing you (they move by their own rules)? */
  const ownMover = (key: string): boolean => {
    const sc = scenarioRef.current;
    const presser = presserRef.current;
    if (key === "run") return !!(sc.runner?.commandedTo || sc.runner?.heldAt);
    if (key.startsWith("sec")) { const r = sc.secondaryRunners[Number(key.slice(3))]; return !!(r?.commandedTo || r?.heldAt); }
    if (key === "follower") return !!(sc.follower.commandedTo || sc.follower.heldAt);
    if (key.startsWith("def")) return !!presser && presser === sc.defenders[Number(key.slice(3))];
    return false;
  };
  /** Phase 3: the men still running after the hand-over, while you aim. They stop on their drawn spots. */
  const stepRunOn = (dt: number) => {
    const R = runOnRef.current;
    if (!R) return;
    R.t += dt;
    const T = R.lead.durS + R.t;
    const end = R.t >= (R.lead.runOnS ?? 0);
    R.ents.forEach((e, i) => {
      if (ownMover(e.key)) return;
      const p = end ? R.ends[i] : R.lead.posAt(e.key, T);
      if (p) e.set(p);
    });
    if (end) runOnRef.current = null;
  };
  /**
   * The ball is struck while they are still running: from the strike the
   * engine moves them, as it moves everyone (stepReactions: a man reacts when
   * the ball comes near him), so the run-on stops where they are. The match
   * engine itself is unchanged.
   */
  const handOverRunOn = () => { runOnRef.current = null; };
  /**
   * A BUILD-UP THAT ENDS IN A CALLED OFFSIDE (Full highlights rebuild: On,
   * lib/star/fhr/buildUp.ts; Harry, 20 Oct 2026: "Offsides can happen but
   * they must be called"). The flag went up (the whistle at the lead-in's
   * whistleAt): it is called the way a chance's offside is (OFFSIDE), the
   * free kick is theirs, and the move ends — no chance from it, in the
   * match's own count too (handed back as the match hands back an offside).
   * Nothing is credited to you. The men, the ball and the camera stay where
   * the build-up left them; then the match goes on as after any chance.
   */
  const endInOffside = (L: NonNullable<typeof leadRef.current>) => {
    leadRef.current = null;
    runOnRef.current = null;
    setLeadInOn(false);
    if (leadCapRef.current !== null) { leadCapRef.current = null; setLeadCap(null); }
    baseViewportRef.current = { ...viewportRef.current };
    try { L.lead.onTick?.(L.lead.durS, true); } catch { /* an observer never breaks the match */ }
    const sc = scenarioRef.current;
    setOutcome("offside");
    setPhase("result");
    showAction("OFFSIDE");
    pushLine(L.lead.offside?.by === "you" ? `Flag up — ${playerLabel()} went too early. Free kick to them.` : "Flag up — the run was too early. Offside, free kick to them.");
    try { onChanceResolvedRef.current?.({ outcome: "offside", kind: sc.kind, youShot: false, teammateShot: false, ball: null, buildUp: true }); } catch { /* an observer never breaks the match */ }
    if (matchModeRef.current) {
      resolveScenario(matchStateRef.current, matchResultFor("offside"));
      handOver(() => startSimulation(), 1800);
    } else if (!replayOfRef.current) handOver(() => loadScenario(false), 1800);
  };
  /**
   * Frame the chance from the chance's own spots. While a build-up (or its
   * run-on) plays, the scenario holds the build-up's positions; framing on
   * those gave the chance a camera of their own (B2b, Harry: "end on the
   * actual camera we have been using in game"). So its men and the ball are
   * put on the chance's spots for the framing — the build-up's own extras
   * out of it — and straight back. Outside a build-up: frameScenario as ever.
   */
  const frameOnChance = () => {
    const sc = scenarioRef.current;
    const L = leadRef.current, R = runOnRef.current;
    if (!L && !R) { frameScenario(sc); return; }
    const ents = L ? L.ents : R!.ents, ends = L ? L.ends : R!.ends;
    const now = ents.map((e) => e.get());
    const ball = { x: sc.ball.x, y: sc.ball.y };
    const mates = L ? sc.teammates.splice(L.mates0) : [];
    const opps = L ? sc.defenders.splice(L.defs0) : [];
    ents.forEach((e, i) => { if (i < ends.length) e.set(ends[i]); });
    if (L) { sc.ball.x = L.ball.x; sc.ball.y = L.ball.y; }
    try { frameScenario(sc); } finally {
      sc.teammates.push(...mates);
      sc.defenders.push(...opps);
      ents.forEach((e, i) => e.set(now[i]));
      sc.ball.x = ball.x; sc.ball.y = ball.y;
    }
    if (L) viewportRef.current = L.cam.at(L.t, baseViewportRef.current);
  };
  /** A tap on a skippable lead-in (the career's build-ups): straight to the chance. */
  const skipLeadIn = () => {
    const L = leadRef.current;
    if (!L) return;
    L.t = L.lead.durS;
    stepLeadIn(0);
  };

  // --- Main animation loop ---
  useEffect(() => {
    const loop = (ts: number) => {
      // held by the screen (its Settings open): nothing moves, and no jump on return
      if (frameObsRef.current?.hold) { lastTsRef.current = ts; rafRef.current = requestAnimationFrame(loop); return; }
      const last = lastTsRef.current ?? ts;
      let dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      // B20 (C1): a lead-in is a REPLAY (nothing is stepped, everyone is put where
      // it says), so its clock runs on real time up to LEAD_REPLAY_MAX_DT a frame.
      // Under 20 fps (a phone in Match view 3D) the old 0.05 clamp played a 6.5 s
      // build-up in about 13 s at 10 fps. The match's own steps keep the clamp.
      const replayDt = Math.min(Math.max(0, dt), LEAD_REPLAY_MAX_DT);
      dt = Math.min(dt, 0.05); // clamp big frame gaps

      // Match feel: New (lib/star/matchFeel.ts) — the picture holds at the
      // contact (the wind-up, then the hit-stop). Nothing is stepped while it
      // holds: the flight starts, step for step the same, when it lets go.
      if (feelTick(dt)) { render(); rafRef.current = requestAnimationFrame(loop); return; }

      // Top-down dribble (Dribble style: Top-down): the duel's own sim, stepped
      // here in the match's one loop — no loop of its own.
      if (phaseRef.current === "tdDribble" && tdRef.current) stepTopDownPicture(tdRef.current, dt);
      if (phaseRef.current === "tdDribble" && tdRef.current && !tdReadyRef.current) {
        const run = tdRef.current;
        const out = stepFpRun(run, dt);
        const lat = tdLatRef.current;
        if (lat && (run.x !== lat.x || run.y !== lat.y)) {
          tdLatRef.current = null;
          if (offlineDevPlayEnabled()) {
            const w = window as unknown as { __tdStickLat?: number[] };
            (w.__tdStickLat ??= []).push(performance.now() - lat.t);
          }
        }
        if (run.events && run.events.length !== tdNoteCountRef.current) {
          tdNoteCountRef.current = run.events.length;
          setTdNote(run.events[run.events.length - 1] ?? null);
        }
        if (out !== "running") finishTopDownDribble(out);
      }

      if (phaseRef.current === "dribble" && dribbleRef.current) {
        // No React state per frame: the render loop already runs every frame and
        // reads the ref directly, so a state update here would re-render the
        // whole component sixty times a second for nothing.
        const out = stepDribble(dribbleRef.current, dt);
        if (out !== "running") finishDribble(out);
      }

      // ── Nothing moves until you kick it ──
      //
      // You have unlimited time to decide. The defence does not close you down,
      // your team-mates do not drift, and no option gets quietly worse while you
      // are looking at it — the only thing you do in a scenario is strike the
      // ball, and everything else is a consequence of that.
      //
      // The keeper is no exception either: he stands on his line, and where he
      // is standing is the thing you are reading. He only breathes.
      // A lead-in (the `leadIn` prop) on a one-picture screen (openOn): started
      // on the opening chance, once. Without openOn, loadScenario asks for one
      // on every chance it serves (the career's build-ups).
      if (phaseRef.current === "aim" && !leadTriedRef.current && leadInPropRef.current && openOnRef.current) {
        leadTriedRef.current = true;
        startLeadIn();
      }
      if (phaseRef.current === "aim" && !leadRef.current) {
        stepKeeper(scenarioRef.current, dt);
        // …with the keeper brain he also gets set while you aim: a walk from
        // where he was put toward his spot for this ball. No-op when it's off.
        brainAim(scenarioRef.current, dt);
      }
      // The power shot's wind-up: the defence closes while the leg goes back.
      if (phaseRef.current === "aim" && windUpRef.current !== null) {
        stepWindUp(scenarioRef.current, dt);
        windUpRef.current -= dt;
        if (windUpRef.current <= 0) {
          windUpRef.current = null;
          setWindingUp(false);
          setPhase("contact");
        }
      }
      // v0.15 item 22: once the drag is committed, ordered runs
      // are under way and the presser is coming — until you let go. See
      // stepCommitted.
      if (phaseRef.current === "aim" && aimCommitRef.current !== null) {
        stepCommitted(dt);
      }

      // ── The run-up (lib/star/penaltyRunup.ts) ──
      //
      // Your figure jogs from where you stood to beside the ball — the same
      // figure, the same run animation any moving man gets — while the
      // camera stays put. On a penalty the keeper brain may hop (brainRunUp:
      // his one decision, made visible). Nothing else moves and the ball is
      // not touched: the kick itself is still handleContact → launch().
      if (phaseRef.current === "runup" && !heldRef.current) {
        const ru = runupRef.current;
        const sc = scenarioRef.current;
        stepKeeper(sc, dt);
        if (ru && !ru.arrived) {
          ru.t += dt;
          const dirNow = ru.nudge ? nudgedDir(sc.ball, ru.dir0, ru.nudgeM) : ru.dir0;
          brainRunUp(sc, dt, ru.t, goalLineX(sc.ball, dirNow));
          sc.player = runupPositionAt(ru.styled, ru.t);
          if (ru.t >= ru.runS && ru.auto) {
            // Somebody else's penalty: struck for him the moment he gets there.
            ru.arrived = true;
            handleContactRef.current?.(ru.auto.contact, { dir: dirNow, power: ru.power, skills: ru.auto.skills });
          } else if (ru.t >= ru.runS) {
            ru.arrived = true;
            nudgeDragRef.current = null;
            setAim({ dir: dirNow, power: ru.power });
            setContactTimerS(strikeTimerFor(sc.kind));
            setPhase("contact");
            tryHold("contact");
            // The page was scrolled to show the strike screen when the jog
            // began (startRunup). Only if it has moved since — the one cheap
            // check — scroll again.
            const w = wrapRef.current?.getBoundingClientRect();
            if (w && w.bottom > window.innerHeight + 1) {
              requestAnimationFrame(() => revealOnScreen(wrapRef.current, { smooth: false }));
            }
          }
        }
      }

      // ── The cut, on a cross ──
      //
      // A wide ball is watched from the side while it is in the air, because
      // that is the only view from which the box is a box rather than a line.
      // Once it has reached the area it cuts to the ordinary view — and it is a
      // CUT, not a pan: the camera does not move, it is replaced. The thing you
      // care about from here is who gets on the end of it.
      if (ballRef.current && facingRef.current !== "up") {
        const sc = scenarioRef.current;
        const at = sc.crossSwitchY ?? 0;
        // New view: the up-the-pitch camera it cuts to is the zoomed-out one,
        // and so is the play area that comes with it.
        const view = sc.crossSwitchView && newViewRef.current
          ? crossCutCamera(sc.crossSwitchView, canvasHW(), ballRef.current.pos, tiltDegRef.current)
          : sc.crossSwitchView;
        // Y alone used to be the whole test. A corner is struck from a few
        // metres off the touchline and has to travel fifteen to thirty
        // METRES sideways to reach the delivery frame's own width — and a
        // hard, fairly straight strike crosses the switch line in depth long
        // before it has covered that ground. The cut (and the viewport
        // reassignment with it — see the comment below on why the engine
        // reads this too) used to fire on depth alone, dropping the ball
        // into a frame narrower than where it actually was: reported
        // directly as the ball "never appearing" after a firm, well-lofted
        // cross, and it is worse than a camera glitch — stepBall rules a
        // ball outside `scenario.viewport` OUT OF PLAY, so the chance was
        // being wasted the instant the cut happened, not just badly framed.
        // Held in the wide side view — which the whole delivery already
        // fits inside — until the ball has ALSO drawn level with the
        // narrower frame's own width, same margin stepBall itself uses.
        const withinX = view ? ballRef.current.pos.x > view.x1 - 1 && ballRef.current.pos.x < view.x2 + 1 : false;
        if (view && ballRef.current.pos.y < at && withinX) {
          facingRef.current = "up";
          viewportRef.current = { ...view };
          baseViewportRef.current = { ...view };
          playZoomRef.current = 1;
          // The engine reads the frame too — out of it is out of the game — so
          // the situation moves with the picture.
          sc.viewport = { ...view };
        }
      }

      if (phaseRef.current === "flight" && ballRef.current) {
        // Substep for stable physics. The substep SIZE matters for more than
        // smoothness during a live strike — see GoalReplay.flightDtLog: `dt`
        // is real device frame timing, which a later replay session's own
        // requestAnimationFrame loop essentially never reproduces frame for
        // frame, so a fresh live `h` here would silently desync a replay's
        // substep count (and therefore its rng draws and its Euler
        // integration) from what actually happened. A replay in progress
        // (`replaySubstepsRef.current`) draws `h` from the queue recorded
        // during the real strike instead, one value per substep, until it
        // runs out — which should land almost exactly on the recorded
        // outcome, since that is exactly the sequence that produced it.
        // New ball (ballPhysics.ts): FIXED 1/180 s steps, as many as the
        // frame's time holds, the rest carried to the next frame — so a 30, 60
        // or 120 fps phone plays the exact same flight, step for step. 1/180 s
        // is what a 60 fps phone always got (3 × 1/60 ÷ 3). Old: three steps
        // of a third of whatever the frame took, as before.
        const fixedStep = realBallOn() && !replaySubstepsRef.current;
        let steps = 3;
        if (fixedStep) {
          physAccRef.current += dt;
          steps = Math.floor(physAccRef.current * 180 + 1e-6);
          physAccRef.current = Math.max(0, physAccRef.current - steps / 180);
        }
        // B14: W A S D / arrows + Shift steer your run (PC), turned into a pitch
        // direction through the match's own camera, once a frame.
        applyRunKeys();
        for (let i = 0; i < steps; i++) {
          const recorded = replaySubstepsRef.current;
          let h: number;
          if (recorded && replaySubstepIdxRef.current < recorded.length) {
            h = recorded[replaySubstepIdxRef.current];
            replaySubstepIdxRef.current++;
          } else {
            h = fixedStep ? 1 / 180 : dt / steps;
          }
          // Recording the other half of the same fix — only while a live
          // strike (not a replay) is pending one, see handleContact and
          // GoalReplay.flightDtLog.
          if (pendingReplayRef.current && !replayOfRef.current) flightDtLogRef.current.push(h);

          // Everyone reacts to the ball, and only to the ball: a player moves
          // when it comes inside his radius and not before, slowly, and both
          // sides at the same pace. See stepReactions.
          stepDefenders(scenarioRef.current, h, ballRef.current.pos, false, ballRef.current);
          stepKeeper(scenarioRef.current, h);
          stepReactions(scenarioRef.current, ballRef.current, h, rngRef.current);
          stepKind(scenarioRef.current, ballRef.current, h, strikeRuleRef.current);
          // The keeper brain, in the same slot: wait, step, dive. No-op when off.
          brainStep(scenarioRef.current, ballRef.current, h);
          // ── Touch Mode (Boot.extraTouch) ──
          //
          // Reported back live after the first version shipped: "my player
          // just doesnt chase the touch at all... he never moves at all. I
          // need him to like run to it as soon as he kicks it." That first
          // version never moved anything — it waited on stepBall's own
          // invisible dead-ball timeout and remapped whatever it returned.
          // This genuinely moves scenario.player, the same field footballer()
          // already reads live every frame for sc.player's own figure, so the
          // chase is seen, not inferred. Live only when every one of these
          // holds: the toggle is on, the boots are actually equipped, this
          // specific ball is YOUR OWN uncontested touch (never a save the
          // keeper's holding, never a ball a defender already claimed — both
          // would have already moved ball.owner off "you"), and it's a
          // situation orders would make sense in to begin with (no
          // penalty/free-kick/corner nudges).
          const touchLive = touchModeOnRef.current && canExtraTouch
              && ballRef.current.owner === "you" && ballRef.current.lastTouch !== "keeper"
              && acceptsCaptainOrders(scenarioRef.current.kind);
          const caughtUp = touchLive && stepTouchChase(scenarioRef.current, ballRef.current, h,
            careerRef.current ? touchChaseSpeed(careerRef.current.skills.pace) : undefined);
          // v0.15 item 16: the ball a moment before a defender gets to it.
          const bIn = ballRef.current;
          const incoming = { vx: bIn.vel.x, vy: bIn.vel.y, vz: bIn.vz, z: bIn.z, spin: bIn.spin };
          const mateProbe = probeMatePlays(scenarioRef.current);
          stepKnuckle(ballRef.current, h);
          // Your pass plays on (playOn.ts): your run, and his lay-off back into it.
          const po = playOnRef.current;
          if (po && !touchLive) {
            const wasLive = po.layOffLive;
            // B20: you finish the kick before you run (lib/star/playOn.ts PlayOnStick.kicking).
            if (po.stick) po.stick.kicking = kickPoseRef.current > 0;
            const caughtIt = stepPlayOn(po, scenarioRef.current, ballRef.current, h, playOnRngRef.current, layOffsLeftRef.current) === "caught";
            noteRunStep(po);
            if (caughtIt) {
              playOnCaughtRef.current = true;
              resolveOutcome("delivered");
              break;
            }
            if (po.layOffLive && !wasLive) {
              layOffsLeftRef.current -= 1;
              pushLine(po.stick?.choice === "through" ? "Through ball, into your run!" : po.stick ? "He plays it back to your feet…" : "He lays it back into your run…");
              playKick();
            }
            if (po.stick?.note) {
              flashCallMsg(po.stick.note === "late" ? "Too late, he's shooting" : "No lane to you");
              po.stick.note = null;
            }
          }
          let res = stepBall(ballRef.current, scenarioRef.current, rngRef.current, h);
          noteMatePlays(matePlaysRef.current, mateProbe, scenarioRef.current);
          // ── v0.15 item 16: a block deflects instead of ending the chance ──
          // The engine has already cleared it; put it back into play off the
          // defender at a new angle, loose, and let the normal rules decide
          // who gets it. Once per strike — the next defender to get there
          // wins it, exactly as today. Its own seeded stream (off the chance's
          // seed and how far through it we are), so a replay deflects the same.
          // New clearances: this counts as the chance's one live second ball,
          // so after it every defender touch is a clean boot.
          const clr = getClearanceRules();
          const secondLeft = !clr.miscues || (scenarioRef.current.secondBalls ?? 0) < clr.secondBalls;
          if (res === "blocked" && deflectionsRef.current < 1 && secondLeft) {
            deflectionsRef.current += 1;
            if (clr.miscues) scenarioRef.current.secondBalls = (scenarioRef.current.secondBalls ?? 0) + 1;
            const r = mulberry32(((seedRef.current ^ Math.imul(rngCallCountRef.current + 1, 0x27d4eb2d)) ^ 0xdef1) >>> 0);
            deflectBlock(ballRef.current, scenarioRef.current, incoming, r);
            // v0.25 item 20: on a rebound (the keeper or the post has had it)
            // the defender plays it away, never on at his own keeper.
            steerDeflectionFromOwnGoal(ballRef.current, scenarioRef.current);
            res = null;
            showAction("DEFLECTED");
            pushLine("Blocked — and it's come off him loose!");
            nudge(0.12, 0.1);
            playSave();
          }
          if (onBallStepRef.current) {
            const bb = ballRef.current;
            try { onBallStepRef.current({ x: bb.pos.x, y: bb.pos.y, z: bb.z }); } catch { /* an observer never breaks the match */ }
          }
          // stepBall's own resolution always wins if it fired the same tick —
          // a defender's clearance or the ball going out is real and takes
          // priority over a chase that only just closed the gap.
          // resolveOutcome's own "touchOn" branch does the rest — see its own
          // doc there.
          if (!res && caughtUp) res = "touchOn";
          // v0.25 item 20: a defender who wins the loose ball does not leave it
          // rolling on at his own goal after the whistle.
          if (res === "short") clearLooseWin(ballRef.current, scenarioRef.current);
          if (res) { resolveOutcome(res); break; }
        }
        // Surface mid-flight moments (pass reception / the teammate's own shot /
        // the woodwork) once.
        // Animations (New, lib/star/actionAnim.ts): every touch the engine
        // wrote down this frame goes to the man who made it, started at the
        // moment it happened (Ball.clock), not at the end of the frame.
        {
          const bl = ballRef.current;
          const seen = seenActionRef.current;
          if (bl && bl !== seen.ball) { seen.ball = bl; seen.seq = 0; }
          if (bl?.actionLog) {
            const nowS = performance.now() / 1000;
            for (const a of bl.actionLog) {
              if (a.seq <= seen.seq) continue;
              seen.seq = a.seq;
              // Goal videos: who touched it, when (it happened a moment ago,
              // in the ball's own clock).
              if (onGoalClipRef.current) goalRecRef.current?.event(a.kind, a.actor, { mode: a.mode, save: a.save }, Math.max(0, (bl.clock ?? 0) - a.t));
              // Match feel: New — the ball into the keeper's gloves.
              if (a.kind === "save" && a.actor === "keeper" && a.save && a.save !== "beaten" && a.at && matchFeelOn()) feelGlove(a.at, a.save);
              // The lab (vfxOverride): the same moments, the picked pictures.
              if (vfxRef.current && a.at) {
                const at = a.at, bv = bl.vel;
                const pw = Math.min(1, Math.hypot(bv.x, bv.y, bl.vz) / 27);
                if (a.kind === "save") {
                  const kp = scenarioRef.current.keeper;
                  vfxEmit("dive", kp.x, kp.y, 0.3, at.x - kp.x || 1, 0, pw);
                  if (a.save === "catch") vfxEmit("catch", at.x, at.y, at.z, bv.x, bv.y, pw);
                  else if (a.save !== "beaten") vfxEmit("save", at.x, at.y, at.z, bv.x, bv.y, pw);
                } else if (a.mode === "header") vfxEmit("header", at.x, at.y, at.z, bv.x, bv.y, pw);
                else if (a.kind === "block") vfxEmit("block", at.x, at.y, at.z, bv.x, bv.y, pw);
                else if (a.kind === "touch") vfxEmit("firstTouch", at.x, at.y, at.z, bv.x, bv.y, pw);
                else if (a.actor !== "you" && (a.kind === "shot" || a.kind === "pass")) vfxEmit(a.kind === "shot" ? "strike" : "pass", at.x, at.y, at.z, bv.x, bv.y, pw);
              }
              // Your own swing stays on kickPoseRef, as it always was.
              if (a.actor === "you") continue;
              actorAnimRef.current.set(a.actor, animFromAction(a, nowS - Math.max(0, (bl.clock ?? 0) - a.t), scenarioRef.current));
            }
          }
        }
        const ev = ballRef.current?.event;
        const receiver = scenarioRef.current.receiver;
        // The frame no longer ends the move — the ball cannons back out and is
        // live — so it is narrated here rather than in resolveOutcome.
        if (ev === "miscue") {
          pushLine("He's miscued it — it's loose!");
          showAction("MISCUED");
          nudge(0.08, 0.08);
        }
        if (ev === "clearHit") {
          pushLine("Cleared — but it cannons off a body and it's loose!");
          showAction("DEFLECTED");
          nudge(0.12, 0.1);
          playSave();
        }
        if (ev === "post") {
          if (onGoalClipRef.current) goalRecRef.current?.event("post");
          pushLine("Off the woodwork — and it's still live!");
          showAction("POST");
          nudge(0.28, 0.25);
          playPost();
          playCrowdSwell("groan");
          if (vfxRef.current) { const pb = ballRef.current; vfxEmit("woodwork", pb.pos.x, pb.pos.y, pb.z, pb.vel.x, pb.vel.y, 0.8); }
          if (matchFeelOn()) {
            const pb = ballRef.current, pp = feelRef.current.prev;
            feelClang(pb.pos.x, pb.pos.y, pb.z, pp ? Math.max(0.3, Math.min(1, (Math.hypot(pp.vx, pp.vy, pp.vz) - 5) / 20)) : 0.7);
          }
        }
        if (ev && receiver) {
          // His name, if we know it — and by now we do, because the identity is
          // taken off whoever the ball actually reached. See lib/star/lineup.ts.
          const label = receiver.who?.shortName ?? receiver.roleLabel;
          // PASS still shows while your pass plays on (Harry, 14 Oct: "I don't think
          // 'pass' 'goal' etc should go"): the words stay, the cut does not.
          if (ev === "received") { pushLine(commentaryReceived(label, rngRef.current)); showAction(passBanner()); }
          // Old animations: the team-mate's shot swung YOUR leg (the one
          // kick pose there was). New: he swings his own (actorAnimRef).
          else if (ev === "receiverShot") { pushLine(commentaryReceiverShot(label, rngRef.current)); playKick(); if (!animFamilyOn("shots")) kickPoseRef.current = KICK_POSE_S; }
          // He was told to leave it, and he has left it. Named, because the
          // whole point of the order is that the move went through somebody
          // rather than ending at the first man who could see the goal.
          else if (ev === "relay") {
            pushLine(`${label} leaves it — the captain wanted it moved on.`);
            showAction("PASS");
            playKick();
            if (!animFamilyOn("passes")) kickPoseRef.current = KICK_POSE_S;
          }
        }
        if (ballRef.current) ballRef.current.event = null;
      }

      // A scored ball keeps travelling into the netting after the outcome has
      // resolved, so the goal is seen rather than announced.
      if (phaseRef.current === "result" && ballRef.current?.inNet) {
        stepBallInNet(ballRef.current, dt);
      }
      // …and a ball the keeper has pushed clear keeps going, so you watch it go
      // rather than finding it already there.
      // …and a completed pass rolls on into his feet (receiveGlideRef).
      if (phaseRef.current === "result" && ballRef.current && receiveGlideRef.current) {
        const g = receiveGlideRef.current, bg = ballRef.current;
        const t = Math.min(1, (performance.now() - g.t0) / (RECEIVE_GLIDE_S * 1000));
        const e = 1 - (1 - t) * (1 - t);   // eases out, as a ball slowing into a touch
        bg.pos = { x: g.from.x + (g.to.x - g.from.x) * e, y: g.from.y + (g.to.y - g.from.y) * e };
        bg.z = g.z0 * (1 - e);
        bg.vel = { x: 0, y: 0 }; bg.vz = 0;
        if (t >= 1) receiveGlideRef.current = null;
      }
      if (phaseRef.current === "result" && ballRef.current?.settling) {
        settleBall(ballRef.current, dt, scenarioRef.current);
      }
      // …and a ball shot over the bar keeps flying, so it visibly leaves the
      // frame instead of stopping dead exactly where "over" was decided.
      if (phaseRef.current === "result" && ballRef.current?.overBar) {
        stepBallPastBar(ballRef.current, dt);
      }
      // …and a ball a defender has booted clear keeps flying, so you see the
      // boot (Mikey, 7 Oct 2026: "I never saw this happen"). It used to freeze
      // where he kicked it. The hand-back to the commentary waits for it to be
      // fully off the picture — see bootRef.
      if (phaseRef.current === "result" && ballRef.current?.cleared) {
        const bc = ballRef.current;
        stepBallCleared(bc, dt, scenarioRef.current);
        const boot = bootRef.current;
        if (boot) {
          const now = performance.now();
          if (bc.resting && boot.stopT == null) boot.stopT = now;
          const done = ballOffPicture(bc)
            || (boot.stopT != null && now - boot.stopT >= getTuning("clearance.handOverAfterStop") * 1000)
            || now - boot.t >= getTuning("clearance.handOverMax") * 1000;
          if (done) {
            bootRef.current = null;
            boot.then?.();
          }
        }
      }
      // …and a keeper mid-dive keeps travelling toward the ball, for exactly
      // the same reason the ball itself keeps moving in the three blocks
      // above. `stepKeeper` was only ever called from the "aim" and "flight"
      // branches further up this loop — once resolveOutcome fires it sets
      // phase to "result" on the very next frame, so a shot that beat him
      // outright (pendingDone true, real travel still in progress toward
      // targetX) simply stopped being simulated at all: he froze exactly
      // where he happened to be the instant the outcome was decided, often
      // having barely moved, while the result screen had already appeared.
      // Reported directly: "the keeper should still continue its dive... it
      // will look better if the ball goes in and hes still mid dive and
      // falling to the ground as the goal animation pops up." Guarded on
      // `!done` purely so this stops calling in once he's actually arrived —
      // stepKeeper reads only his own Keeper fields, never the ball, so
      // calling it here is exactly as safe as it was from "flight".
      if (phaseRef.current === "result" && !scenarioRef.current.keeper.done) {
        stepKeeper(scenarioRef.current, dt);
        // A dive still in the air lands, and a beaten keeper stays committed.
        brainStep(scenarioRef.current, ballRef.current, dt);
      }
      // Hitboxes & jumping (New): a man in the air when the move ended lands.
      if (phaseRef.current === "result" && hitboxesOn()) settleJumps(scenarioRef.current, dt);

      // Match feel: New — watch the live ball land and get hit (looks only).
      if (matchFeelOn() && (phaseRef.current === "flight" || phaseRef.current === "result")) feelWatchBall();

      // Cosmetic FX advance (pausing the rAF pauses everything together)
      // Match feel: New — a harder strike holds its follow-through longer.
      if (kickPoseRef.current > 0) kickPoseRef.current = Math.max(0, kickPoseRef.current - dt * (matchFeelOn() ? feelRef.current.followRate : 1));

      // ── There is no camera ──
      //
      // The rectangle IS the situation. It is set when the scenario loads and it
      // does not move again — not to follow the ball, not to lead it, not to
      // follow you on a run.
      //
      // This replaced a camera that panned toward the ball, and the panning was
      // the single most disorientating thing in the game. It is built on a
      // misreading: that there is a whole pitch and each situation is a snapshot
      // of some part of it that the camera visits. There is not. A situation is
      // the frame you are looking at, entire. A run is getting from the bottom
      // of this rectangle to the top of it; a pass is finding a man inside it.
      // Nothing outside the frame is part of the game, so there is nothing out
      // there to pan to — and when the camera went looking anyway, you lost your
      // bearings and, twice, the thing you were aiming at.
      // ── B14b: the one exception, your run (lib/star/runCamera.ts) ──
      // Harry, 21 Oct 2026: follow the run, never jump. While your pass plays
      // on, the chance's own camera pans (never zooms) just enough to keep you
      // — and a ball played back to you — in the picture, inside the chance's
      // play area. When the ball comes back, a widen (only if you, the ball and
      // the goal would not all fit) eases in over BACK_EASE_S, the men kept
      // their size. Everything else keeps the frame exactly as set.
      {
        const nvOk = newViewRef.current && !sceneRef.current?.ownFrame && !leadRef.current && !runOnRef.current;
        const ce = camEaseRef.current;
        if (ce) {
          ce.t += dt;
          const v = easeCam(ce.from, ce.to, ce.t / BACK_EASE_S);
          // The men stay the size they were (the zoom divides back, as Zoom does).
          playZoomRef.current = ce.zoom0 * (ce.from.x2 - ce.from.x1) / (v.x2 - v.x1);
          baseViewportRef.current = v;
          if (ce.t >= BACK_EASE_S) camEaseRef.current = null;
        } else if (nvOk && playOnRef.current && phaseRef.current === "flight") {
          const sc = scenarioRef.current, po = playOnRef.current, b = ballRef.current;
          const pts = [sc.player, ...(po.layOffLive && b ? [b.pos] : [])];
          const want = panToKeep(baseViewportRef.current, pts, sc.viewport);
          baseViewportRef.current = followStep(baseViewportRef.current, want, dt);
        }
      }
      viewportRef.current = baseViewportRef.current;

      if (shakeRef.current.t > 0) shakeRef.current.t = Math.max(0, shakeRef.current.t - dt);
      if (flashRef.current.t > 0) flashRef.current.t = Math.max(0, flashRef.current.t - dt);
      for (const p of particlesRef.current) {
        p.vy += 22 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.life -= dt;
      }
      if (particlesRef.current.length) particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      const b = ballRef.current;
      if (phaseRef.current === "flight" && b && !b.resting) {
        seamRef.current += (b.spin * 0.3 + Math.hypot(b.vel.x, b.vel.y) * 0.06) * dt;
        trailRef.current.push({ x: b.pos.x, y: b.pos.y, z: b.z });
        if (trailRef.current.length > 16) trailRef.current.shift();
      } else if (trailRef.current.length) {
        trailRef.current.shift(); // let it dissolve after the play resolves
      }

      // Phase 3: still running after the hand-over, while you aim (or pick the contact).
      if (runOnRef.current) {
        if (phaseRef.current === "aim" || phaseRef.current === "contact") stepRunOn(dt);
        else runOnRef.current = null; // the chance ended some other way: they stop where they are
      }
      if (leadRef.current) stepLeadIn(replayDt);
      recordGoalFrame(dt);
      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      // A goal still being recorded when the match closes keeps what it has.
      const rec = goalRecRef.current;
      if (rec && onGoalClipRef.current) {
        rec.finishNow();
        for (const tr of rec.take()) { try { onGoalClipRef.current?.(tr); } catch { /* never breaks the match */ } }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The man this situation is about.
   *
   * The target of the pass on the situations that are a pass, and the man who
   * put it into you on the two that arrive from somebody. Undefined on a
   * one-on-one or a shot from distance, which are about you and the keeper — and
   * on any career whose squad has not loaded, where the commentary falls back to
   * the shapes it always described.
   */
  const targetName = (sc: Scenario | null): string | undefined => {
    if (!sc) return undefined;
    if (sc.kind === "volley" || sc.kind === "header") return sc.crosser?.shortName;
    return sc.runner?.who?.shortName
      ?? sc.secondaryRunners.find(r => r.role === "target")?.who?.shortName;
  };

  /**
   * Go on to what comes after a chance. Ordinarily after `ms`, as it always
   * was; after a clean clearance, the moment the boot has left the picture
   * (bootRef, checked every frame in the result phase).
   */
  const handOver = (fn: () => void, ms: number) => {
    const gen = sceneGenRef.current;
    const run = () => { if (sceneGenRef.current === gen) fn(); };
    if (bootRef.current) bootRef.current.then = run;
    else window.setTimeout(run, ms);
  };

  const resolveOutcome = (res: Outcome) => {
    setOutcome(res);
    setPhase("result");
    // A clean clearance ended it: hold the hand-back until the boot is off
    // the picture (see bootRef and handOver).
    {
      const b = ballRef.current;
      bootRef.current = b?.cleared && !b.inNet ? { t: performance.now(), stopT: null, then: null } : null;
    }
    receiveGlideRef.current = null;
    {
      const b = ballRef.current, at = scenarioRef.current.receivedAt;
      if (res === "delivered" && b && at) {
        // Stop just in front of him, on the side the ball came from.
        const dx = b.pos.x - at.x, dy = b.pos.y - at.y, d = Math.hypot(dx, dy);
        const lead = Math.min(RECEIVE_LEAD_M, d);
        const to = d > 1e-6 ? { x: at.x + (dx / d) * lead, y: at.y + (dy / d) * lead } : { x: at.x, y: at.y };
        receiveGlideRef.current = { from: { x: b.pos.x, y: b.pos.y }, to, z0: b.z, t0: performance.now() };
      }
    }
    const sc = scenarioRef.current;
    goalSideRef.current = res === "goal" ? (autoKickOf(sc)?.side === "them" ? "them" : "us") : null;
    // Read off the ball and off what the team-mate actually did, never off the
    // scenario's shape. See creditChance.
    // ── What YOU did, not what the ball is doing ──
    //
    // `ball.shot` is true after a team-mate strikes it too — `launchReceiverShot`
    // sets it so your own players step out of HIS shot as well as yours. Reading
    // it here meant that the moment somebody you found pulled the trigger, the
    // chance was filed as your shot: you were credited with his goal, he got
    // nothing, and the assist you had just played was never recorded. That is
    // the whole of "it counted as a team goal", and of ASSISTS reading 0/0 on a
    // goal the commentary had just described you setting up.
    const receiverShot = sc.receiverShot === true;
    // A REBOUND A TEAM-MATE PUTS AWAY IS HIS GOAL, NOT YOURS.
    //
    // Reported directly: "when you shoot and then it rebounds or rebounds again
    // and a player scores, it counts as your goal."
    //
    // `ball.youStruckAtGoal` is set once, at your own strike, and the engine
    // clears it in exactly ONE place — the poacher's six-yard poke-in, where
    // this same bug was reported and fixed before. The other way a team-mate
    // finishes a loose ball is `launchReceiverShot`, which sets
    // `scenario.receiverShot` and never clears the flag. `creditChance` tests
    // "you shot" BEFORE "he shot", so on that path his goal came to you and
    // your assist vanished.
    //
    // Within one chance you strike at most once, and always first — your shot
    // comes from the aim gesture before the ball is live. So a team-mate
    // shooting means he struck it AFTER you, and it stopped being your shot the
    // moment he did. Fixed here rather than in the engine, which is never
    // modified; it is a credit rule, not a physics one.
    // An automatic kick (v0.15 items 6/7) was struck by the match for somebody
    // else: never your shot, never your stats.
    const auto = autoKickOf(sc);
    const youShot = !auto && ballRef.current?.youStruckAtGoal === true && !receiverShot;
    const isSimplePass = !youShot && !receiverShot && sc.passTarget != null;
    const kind = OUTCOME_TEXT[res].kind;

    // The observer hook for features built on top of the engine — see the
    // onChanceResolved prop. Read-only, and fired before anything below
    // mutates the scenario for the next chance.
    if (onChanceResolvedRef.current) {
      const b = ballRef.current;
      try {
        onChanceResolvedRef.current({
          outcome: res, kind: sc.kind, youShot, teammateShot: receiverShot,
          ball: b ? { x: b.pos.x, y: b.pos.y, z: b.z } : null,
          ...(auto ? { autoKick: auto.side } : {}),
        });
      } catch { /* an observer never breaks the match */ }
    }

    // Item 5r — a cheeky kick (a penalty chipped or down the middle, or an
    // open-play chip — tagged at the strike, see handleContact) that didn't
    // go in. A penalty you struck is always yours; an open-play chip only
    // while it is still your shot (a team-mate's follow-up is his). Your
    // shootout kicks count too. Credited as a
    // small reputation hit at full time (careerFlow's creditMatchResult).
    // Roadmap #4 (achievements): was YOUR strike a chip or a curler? Read
    // before the cheeky tag is cleared below; the curl from the ball's own
    // action log (canvasEngine's launch() writes it). Only ever your kick.
    const yourFinish: "chip" | "curl" | undefined = (() => {
      if (auto) return undefined;
      if (cheekyStrikeRef.current === "chip") return "chip";
      const log = ballRef.current?.actionLog ?? [];
      const last = [...log].reverse().find(a => a.kind === "shot" && a.actor === "you");
      return last?.mode === "curl" ? "curl" : undefined;
    })();
    {
      const ch = cheekyStrikeRef.current;
      cheekyStrikeRef.current = null;
      if (ch && (sc.kind === "penalty" || youShot) && isCheekyMiss(res)) {
        cheekyMissesRef.current.push({ kind: ch, minute: matchMinuteRef.current });
      }
    }

    // A live shootout kick (see loadShootoutKick) is NOT a chance in the
    // ongoing match — there is no ongoing match while a shootout is being
    // taken. It must not credit match stats, touch the match scoreline, or
    // feed the hidden-match simulation; its real result is reported back to
    // the shootout's own state machine instead, near the end of this
    // function.
    const isShootoutKick = shootoutKickRef.current != null;

    // The tally lives in a ref so it's authoritative the instant this chance
    // resolves — the rAF loop calls a stale resolveOutcome closure, so reading it
    // back off React state would risk under-counting the final chance. State is
    // just a mirror for the HUD.
    // Whose assist a team-mate's goal is: yours only if nobody else in your
    // shirt played it between your touch and his strike (Harry, 1 Oct 2026:
    // "I still get an assist for that even though I wasn't the one who
    // actually assisted him").
    const assist = assistFor(matePlaysRef.current);
    const d = creditChance(res, { youShot, receiverShot, isSimplePass, assistYours: assist.yours });
    const t = tallyRef.current;
    if (!isShootoutKick && !auto) {
      t.shots += d.shots;
      t.goals += d.goals;
      t.passes += d.passes;
      t.passesCompleted += d.passesCompleted;
      t.chances += d.chances;
      t.assists += d.assists;
      // Item 26: only a REAL miss counts against you — your own shot that
      // did not go in, or the ball lost. A pass that found its man (even if
      // he then missed) and a Touch Mode touch are not misses.
      if (kind !== "goal" && res !== "delivered" && res !== "touchOn" && !receiverShot) {
        if (youShot) {
          t.misses += 1;
          const mk = missKind(sc.kind, res);
          if (mk === "penalty") t.missesPen += 1;
          else if (mk === "oneOnOne") t.misses1v1 += 1;
          else if (mk === "on") t.missesOn += 1;
        } else t.lost += 1;
      }
      // Ratings revamp (Mikey, 6 Oct 2026): what kind of goal, how brave a pass.
      if (d.goals > 0) {
        const z = goalZone(sc.kind, strikeAtRef.current);
        if (z === "penalty") t.goalsPen += d.goals;
        else if (z === "tapIn") t.goalsTap += d.goals;
        else if (z === "outside") t.goalsOut += d.goals;
      }
      if (d.passesCompleted > 0) {
        const pg = passGrade(sc.passDifficulty, sc.passAmbition);
        if (pg === "safe") t.passesSafe += d.passesCompleted;
        else if (pg === "ambitious") t.passesAmb += d.passesCompleted;
      }
      strikeAtRef.current = null;
      setStats({ ...t });
      // …and one line in the list the post-match rating opens (chanceLog.ts).
      // A Touch Mode touch is the same chance carrying on, not a new one.
      if (res !== "touchOn") {
        logChance(sc.kind, kind === "goal" ? (d.goals > 0 ? "goal" : d.assists > 0 ? "assist" : "pass")
          : res === "delivered" ? "pass"
            : res === "offside" ? "offside"
              : receiverShot ? "setup"
                : youShot ? "miss"
                  : res === "tackled" ? "tackled" : "lost");
      }
    }

    // Your team scores whenever the ball ends up in the net — your own finish or a
    // teammate you set up (same rule the old DOM match used: goal || assist).
    if (!isShootoutKick && !auto && kind === "goal") {
      userScoreRef.current += 1;
    }

    // Hand the outcome back to the match. Without this it would carry on as
    // though your moment never happened — you would score and the ball would
    // still be in their box. Not for a shootout kick — there is no ongoing
    // hidden-match state to hand it back to. (A team-mate's penalty hands its
    // own result back, below.)
    if (!isShootoutKick && !auto && matchModeRef.current) resolveScenario(matchStateRef.current, matchResultFor(res));

    // Celebration / impact FX + sound, matched to what the physics produced.
    // Their penalty at your keeper reads the other way round.
    if (auto?.side === "them") {
      if (kind === "goal") { showAction("SCORED"); playNet(); playCrowdSwell("groan"); }
      else if (res === "saved" || res === "caught" || res === "tipped") { showAction("SAVED!"); nudge(0.18, 0.14); playSave(); playCrowdSwell("cheer"); }
      else { showAction("MISSED!"); if (res === "post") playPost(); playCrowdSwell("cheer"); }
    } else if (auto && kind !== "goal") {
      showAction(res === "saved" || res === "caught" || res === "tipped" ? "SAVED" : "MISSED");
      if (res === "post") playPost(); else playSave();
      playCrowdSwell("groan");
    } else if (kind === "goal") {
      showAction("GOAL");
      spawnGoalFx();
      if (soundSet() === "arcade") playGoalSting(); // the Arcade pack's goal sting
      playNet();
      playCrowdSwell("cheer");
    } else if (res === "tackled" || res === "blocked") {
      // It says what happened, like a goal or a pass does. Losing the ball used
      // to resolve into a beat of nothing and then the next highlight, so you
      // were left working out from the replay what had gone wrong.
      //
      // …and it says WHICH thing happened. Both used to read BLOCKED, including
      // the one the outcome text called DISPOSSESSED, so the banner and the line
      // under it disagreed about your own move.
      showAction(res === "blocked" ? "BLOCKED" : "INTERCEPTED");
      nudge(0.18, 0.14);
      playSave();
    } else if (res === "offside") {
      showAction("OFFSIDE");
      playWhistle();
    } else if (res === "delivered") {
      // A pass that found its man is a thing you DID, and in a situation with no
      // goal in it, it is the only thing you can do — so it says so, the same
      // way a goal does. It only said PASS when the move carried on into a
      // finish, so the safe ball in midfield resolved in silence and read as
      // nothing having happened.
      // Chances: New — a lay-off taken back in your stride, or a pass in a
      // no-goal picture, carries on in the same move (playOn.ts): its banner,
      // if any, is decided below where the move carries on or stops.
      showAction(passBanner()); // words stay (Harry, 14 Oct); the move still carries on
    } else if (res === "touchOn") {
      // Touch Mode's own catch had no banner at all — the result screen paused
      // exactly the way a genuinely dead chance does, with nothing on screen
      // to say a catch had just happened and another kick was coming. Reported
      // live as part of the same "it just stops" complaint the matchResultFor
      // fix above addresses; this is the other half — making the real
      // continuation actually visible, not just correct underneath.
      showAction("TOUCH ON");
    } else if (res === "out" || res === "wide" || res === "over" || res === "short") {
      // A ball that went out, wide, over or died used to end in silence: the
      // screen sat still for a second and a half and read as "the ball stops"
      // (Harry, 3 Oct 2026; filmed in build-ups and midfield passes). It says
      // what happened, like every other ending.
      showAction(res === "wide" ? "WIDE" : res === "over" ? "OVER" : res === "short" ? "NOBODY THERE" : "OUT OF PLAY");
    } else if (res === "post") {
      nudge(0.28, 0.25);
      playPost();
      playCrowdSwell("groan");
    } else if (res === "saved") {
      nudge(0.18, 0.14);
      playSave();
      playCrowdSwell("groan");
    } else if (res === "caught") {
      nudge(0.18, 0.14);
      playSave();
    }

    // Match feel: New — the net bulges on a goal, the woodwork clangs.
    if (matchFeelOn()) feelOutcome(res, kind === "goal");
    // The lab (vfxOverride): the net, the goal moment, the frame, a block, a near miss.
    if (vfxRef.current) {
      const b = ballRef.current;
      if (b) {
        const pw = Math.min(1, Math.hypot(b.vel.x, b.vel.y, b.vz) / 27);
        if (kind === "goal") {
          vfxEmit("net", b.pos.x, b.pos.y, b.z, 0, -1, pw);
          vfxEmit("celebration", b.pos.x, b.pos.y, b.z, 0, -1, 1);
        } else if (res === "post") vfxEmit("woodwork", b.pos.x, b.pos.y, b.z, b.vel.x, b.vel.y, pw);
        else if (res === "blocked") vfxEmit("block", b.pos.x, b.pos.y, b.z, b.vel.x, b.vel.y, pw);
        else if (res === "wide" || res === "over") {
          const offPost = b.pos.x < POST_L ? POST_L - b.pos.x : b.pos.x > POST_R ? b.pos.x - POST_R : 0;
          if (offPost < 3 && b.z < VFX_GOAL_H + 2.5) vfxEmit("nearMiss", b.pos.x, Math.max(0, b.pos.y), b.z, b.vel.x, b.vel.y, pw);
        }
      }
    }

    // Assign named squad players to goals and update the goal events log.
    // Chain goals → a named attacker from the squad scores; user assisted.
    // Direct user goals → optionally pick a named squad member as assister.
    let commentaryRoleLabel = sc.receiver?.roleLabel;
    if (!isShootoutKick && !auto && kind === "goal" && careerRef.current) {
      const squad = onPitch(careerRef.current.squad ?? []);
      const pFirst = careerRef.current.player.firstName;
      const pLast = careerRef.current.player.lastName;
      const playerName = `${pFirst} ${pLast}`;
      const rng = rngRef.current;

      // ── How it was scored ──
      //
      // The scenario the chance was built from and how far out the ball was
      // struck. Both are sitting right here and were thrown away, which meant a
      // goal was a number: nothing downstream could tell a tap-in from a
      // thirty-yard volley, so nothing downstream could say so. `res` is a
      // rebound outcome when it came off a second phase, which is a different
      // kind of goal again.
      const how = res === "rebound" ? "rebound" : sc.kind;
      const distance = Math.hypot(sc.ball.x - (sc.goal.x1 + sc.goal.x2) / 2, sc.ball.y);

      // A team-mate's goal: either you assisted it, or another team-mate did.
      const mateGoal = d.assists === 1 || (receiverShot && !assist.yours);
      // This goal's recording (goal videos), linked to a saved replay below.
      let goalClipId: string | undefined;
      if (mateGoal && sc.receiver) {
        // ── The man who scored it is the man who scored it ──
        //
        // He is decided on the pitch, at the moment the ball reaches him, and
        // carried on the receiver — not drawn from the squad list here. Drawing
        // him here was the bug: the game picked a plausible forward at the
        // whistle, which is a different question from "who was standing there",
        // and when there was no squad to draw from it picked nobody and the goal
        // went down as a team goal with the commentary saying "the attacking
        // midfielder". Now the commentary, the goal and the squad row all read
        // off one identity.
        //
        // The fallback still picks a forward, for the sandbox and for careers
        // whose squad has not loaded — and the goal is recorded either way,
        // because a goal that has been scored is a fact about the match whether
        // or not we can put a name to it.
        const scorer = sc.receiver.who
          ?? (() => {
            const forwards = squad.filter(p => ["ST", "CAM", "LW", "RW", "CM"].includes(p.position));
            return pickSquadScorer(forwards.length > 0 ? forwards : squad, rng) ?? undefined;
          })();
        if (scorer) commentaryRoleLabel = scorer.shortName;
        const scorerLabel = scorer?.shortName ?? sc.receiver.roleLabel ?? "Team-mate";
        // The assist: you, or the team-mate who played it last before him
        // (his lay-off, or his shot that came back) — named when we know him.
        const mateAssist = assist.yours ? undefined : assist.by?.who;
        const mateScorer = scorer?.name ?? sc.receiver.roleLabel ?? "Team-mate";
        const mateClip = markGoalClip(mateScorer, scorerLabel, false, assist.yours ? playerName : mateAssist?.name, how);
        goalEventsRef.current.push({
          minute: matchMinuteRef.current,
          scorer: mateScorer,
          assist: assist.yours ? playerName : mateAssist?.name,
          isUserGoal: false, how, distance: Math.round(distance),
          ...(mateClip ? { clipId: mateClip } : {}),
          // PROTOTYPE (home-screen proto): how far YOUR pass went — from where
          // you played it to where he took it. Feeds "furthest assist".
          ...(assist.yours && sc.receivedAt ? { passLength: Math.round(Math.hypot(sc.receivedAt.x - sc.ball.x, sc.receivedAt.y - sc.ball.y)) } : {}),
        });
        logMoment(`⚽ ${scorerLabel} scores!`, "goal");
        if (assist.yours) logMoment(`🎯 ${playerLabel()} assists!`, "assist");
        else if (mateAssist) logMoment(`🎯 ${mateAssist.shortName} assists!`, "assist");
      } else if (d.goals === 1) {
        // ── And an assist is somebody who was actually in the move ──
        //
        // The man who crossed it, on the situations that arrive from somebody;
        // nobody at all otherwise, which is the honest answer for a goal you cut
        // in and curled home on your own. It used to pull a random creator out
        // of the squad 65% of the time — so assists appeared against players who
        // had not been on the screen, which is exactly the kind of thing that
        // makes the whole stats column untrustworthy.
        // A rebound you followed in was created by whoever's shot came back,
        // which was yours.
        const assister = res === "rebound" ? undefined : creatorOf(sc, squad, rng);
        const yourClip = markGoalClip(playerName, playerLabel(), true, assister?.name, how, "you");
        goalClipId = yourClip;
        goalEventsRef.current.push({
          minute: matchMinuteRef.current, scorer: playerName, assist: assister?.name,
          isUserGoal: true, how, distance: Math.round(distance),
          ...(yourFinish ? { finish: yourFinish } : {}),
          ...(yourClip ? { clipId: yourClip } : {}),
        });
        logMoment(`⚽ ${playerLabel()} scores!`, "goal");
        if (assister) logMoment(`🎯 ${assister.shortName} assists!`, "assist");
      } else {
        // The scoreline has gone up and neither branch claimed it. It is still a
        // goal, and a goal with nobody's name on it is a goal missing from the
        // match report, the scoresheet and the squad stats. Yours: nobody else
        // was involved, or one of the branches above would have fired.
        const soloClip = markGoalClip(playerName, playerLabel(), true, undefined, how, "you");
        goalClipId = soloClip;
        goalEventsRef.current.push({
          minute: matchMinuteRef.current, scorer: playerName,
          isUserGoal: true, how, distance: Math.round(distance),
          ...(yourFinish ? { finish: yourFinish } : {}),
          ...(soloClip ? { clipId: soloClip } : {}),
        });
        logMoment(`⚽ ${playerLabel()} scores!`, "goal");
      }

      // A goal that's yours — not a team-mate's, which the first branch
      // above claims — is exactly what a saved replay is for. Never during a
      // replay itself: watching a saved goal again is not a new goal to
      // capture. `pendingReplayRef` is only ever set right before a real
      // strike (handleContact), so it is naturally absent for anything that
      // scored without you having personally struck it.
      if (!(mateGoal && sc.receiver) && pendingReplayRef.current && !replayOfRef.current) {
        const verb = SCENARIO_LABEL[sc.kind]?.verb.replace("!", "") ?? sc.kind;
        onGoalScoredRef.current?.({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          savedAt: new Date().toISOString(),
          label: `${verb} · ${minuteLabel(matchMinuteRef.current, ADDED, MATCH_DURATION)}'`,
          ...pendingReplayRef.current,
          flightDtLog: flightDtLogRef.current.slice(),
          ...(goalClipId ? { clipId: goalClipId } : {}),
        });
      }
    }

    // ── The two questions the commentary is asking ──
    //
    // "Was there a man to find?" and "did the ball get to him?" — and both were
    // being answered with the wrong flag, which inverted the line on every
    // chained chance in the game.
    //
    // `chain` was `receiverShot`, so a pass that never reached anybody was not
    // a chain at all and could never be described as a failed pass.
    // `receiverReached` was `receiverDone`, which is cleared the instant he
    // strikes it — so it was false for every chance where the pass had WORKED.
    // Between them: you picked out a team-mate, he shot, the keeper saved it,
    // and the game said "Cut out! A defender reads it well."
    pushLine(commentaryResult(res, rngRef.current, {
      chain: sc.receiver != null,
      receiverReached: sc.receiverReached === true,
      roleLabel: commentaryRoleLabel,
      isPass: isSimplePass,
    }));

    // ── Report the real outcome back to the shootout, and stop here ──
    //
    // A shootout kick never chains (a penalty has no receiver to lay it off
    // to), is never a saved-goal replay, and must not resume the ordinary
    // match simulation or the sandbox's own chance-count loop — none of the
    // logic below this point applies to it. `scored` is read the same way
    // every other goal/miss in this function already is: whether the
    // outcome's own OUTCOME_TEXT kind is "goal" — the ball genuinely beat
    // the keeper, decided by the same real physics as any other shot, not a
    // probability roll.
    if (isShootoutKick) {
      const cb = shootoutKickRef.current;
      shootoutKickRef.current = null;
      const scored = kind === "goal";
      const gen = sceneGenRef.current;
      window.setTimeout(() => { if (sceneGenRef.current === gen) cb?.resolve(scored); }, 1400);
      return;
    }

    // ── A team-mate's penalty in open play (v0.15 item 6) ──
    //
    // Your side's goal (or not), his name on it, nothing on your own stats —
    // then the match carries on exactly as it does after any chance.
    if (auto && auto.context === "match") {
      const gen = sceneGenRef.current;
      const saved = res === "saved" || res === "caught" || res === "tipped";
      if (kind === "goal") {
        userScoreRef.current += 1;
        const penClip = markGoalClip(auto.taker.name, auto.taker.shortName, false, undefined, "penalty", "you");
        goalEventsRef.current.push({
          minute: matchMinuteRef.current, scorer: auto.taker.name, isUserGoal: false, how: "penalty", distance: 11,
          ...(penClip ? { clipId: penClip } : {}),
        });
        logMoment(`⚽ ${auto.taker.shortName} scores the penalty!`, "goal");
      } else {
        logMoment(`${auto.taker.shortName}'s penalty is ${saved ? "saved" : "missed"}.`, "chance");
      }
      if (matchModeRef.current) {
        resolveScenario(matchStateRef.current, kind === "goal" ? "goal" : "saved");
        window.setTimeout(() => { if (sceneGenRef.current === gen) startSimulation(); }, 1800);
      } else {
        window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(false); }, 1800);
      }
      return;
    }
    // ── A shootout kick on a test screen (Infinite Highlights' Shootout) ──
    // The screen keeps the score through onChanceResolved (above); the engine
    // only asks it for the next kick. Never one of your chances, so it never
    // counts towards the sandbox's six.
    if (auto) {
      const gen = sceneGenRef.current;
      window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(false); }, 1600);
      return;
    }

    // A pass that found its man can keep the move going. This used to apply to
    // build-up only, and jumped to a random attacking situation; now any
    // completed pass can come back, and what you get next is read off where the
    // ball actually arrived.
    let quickOn = false;
    if (res === "delivered" && playOnCaughtRef.current) {
      // The lay-off came back into your run (playOn.ts): the same picture,
      // your next kick, straight away. Repositioned like a Touch Mode
      // re-touch (resetForTouchOn), without spending its budget.
      playOnCaughtRef.current = false;
      keepRunCamRef.current = true;   // B14b: the next kick keeps this camera (runCamera.ts)
      const b = ballRef.current;
      if (b) {
        chainRef.current = {
          pos: { x: b.pos.x, y: b.pos.y },
          depth: sc.chainDepth ?? 0,
          ambition: Math.max(sc.passDifficulty, sc.passAmbition ?? 0),
          touchTouches: sc.touchTouches ?? 0,
        };
        logMoment(`${sc.receivedBy?.who?.shortName ?? "He"} lays it back to ${playerLabel()}.`, "chance");
        quickOn = true;
      }
    } else if (res === "delivered") {
      const depth = sc.chainDepth ?? 0;
      const at = sc.receivedAt ?? sc.runner?.pos ?? sc.passTarget;
      // ── THE GIVE-AND-GO (v0.24, Harry's first National League match) ──
      // "When I pass off the ball there, I should get the ball back, and I
      // don't know if that's what happened." Two things were wrong:
      //  1. In a picture with no goal in it (a midfield pass, a build-up) a
      //     pass is the only thing you can do, and it still came back only
      //     about half the time (chainReturnChance: 0.30 + how brave it was).
      //     There, a completed pass now always comes back (still at most
      //     CHAIN_MAX links). Anywhere with a goal it is the same roll as before.
      //  2. Either way, nothing on screen said so: these lines went to the
      //     sandbox-only ticker. Now a banner says it came back, and the match
      //     commentary says which.
      //  v0.25 (review of v0.24, point 49): "always" was too much. In a
      //  no-goal picture a forward pass now comes back 92 in 100 and a
      //  sideways or backward one 60 in 100 (lib/star/giveAndGo.ts). Pictures
      //  with a goal keep chainReturnChance.
      const onlyPlay = !goalInView(sc.kind);
      const who = sc.receivedBy?.who?.shortName ?? targetName(sc);
      // One roll, drawn in exactly the cases it always was, so the rest of
      // the match's random stream is what it was.
      const returnChance = onlyPlay && at ? giveAndGoChance(sc, at) : chainReturnChance(sc);
      if (at && depth < CHAIN_MAX && rngRef.current() < returnChance) {
        const ambition = Math.max(sc.passDifficulty, sc.passAmbition ?? 0);
        chainRef.current = { pos: { x: at.x, y: at.y }, depth: depth + 1, ambition };
        pushLine(at.y < 25 ? "It comes straight back to you, higher up…" : "He lays it off — the move keeps going…");
        logMoment(`${who ?? "He"} plays it back to ${playerLabel()}.`, "chance");
        if (newChancesOn() && !goalInView(sc.kind)) {
          // Chances: New — no cut: the next picture is reached by a carry-on
          // from where everyone is now (playOn.ts carryOnLeadIn), the camera
          // following, with no PASS or BACK TO YOU.
          const b = ballRef.current;
          carryOnRef.current = carryFrom(sc, b ? { x: b.pos.x, y: b.pos.y } : at);
          quickOn = true;
        } else {
          const gen = sceneGenRef.current;
          window.setTimeout(() => { if (sceneGenRef.current === gen) showAction("BACK TO YOU"); }, ACTION_BANNER_MS - 100);
        }
      } else {
        logMoment(`${who ?? "He"} keeps it — the move goes on without ${playerLabel()}.`, "chance");
        // The move is over for you: it says what you did.
        if (newChancesOn() && !goalInView(sc.kind)) showAction(passBanner());
      }
    } else if (res === "touchOn") {
      // Touch Mode's own chain — deterministic, not chainReturnChance's
      // random roll. The whole point of paying real money for this boot is
      // that a genuinely uncontested touch always earns another go, never a
      // coin flip on top of actually getting there.
      //
      // Its own SEPARATE budget (touchTouches/TOUCH_CHAIN_MAX), not
      // chainDepth/CHAIN_MAX — reported live, after this originally shared
      // CHAIN_MAX's own tight 2-link cap with ordinary passing: "he IS
      // catching it... instead of the game pausing and giving me a new kick
      // like the chance just started, the chance just ends." A real passage
      // of play often reaches you via at least one pass already, so a
      // second or third genuine re-touch was routinely finding the shared
      // budget already spent. `chainDepth` itself is carried through
      // UNCHANGED here (never incremented) — touch-mode re-touches spend
      // their own budget, not the one an actual pass afterwards still needs
      // in full. Chains at the BALL's own resting position — never
      // receivedAt/runner/passTarget, none of which describe a nudge you
      // played to yourself.
      //
      // TOUCH_CHAIN_MAX is 1: exactly one extra touch, not a repeatable
      // dribble. And loadScenario reads chain.touchTouches to take a
      // completely different path for this chain than an ordinary
      // "delivered" one — resetForTouchOn repositions the SAME scenario at
      // this exact spot rather than rebuilding a new one via
      // chainKindFor/buildScenario, which is what a second touch actually
      // needs: it's one move continuing, not a new chance. See its own doc.
      const touches = sc.touchTouches ?? 0;
      const b = ballRef.current;
      if (b && touches < TOUCH_CHAIN_MAX) {
        chainRef.current = {
          pos: { x: b.pos.x, y: b.pos.y },
          depth: sc.chainDepth ?? 0,
          ambition: Math.max(0.3, sc.passDifficulty ?? 0),
          touchTouches: touches + 1,
        };
      }
    }

    attemptsRef.current += 1;

    // The move continues: no simulation, straight into the next link.
    if (chainRef.current) {
      const gen = sceneGenRef.current;
      window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(true); }, quickOn ? 250 : 1600);
      return;
    }

    // Watching a saved goal ends here — no next chance to load, no match to
    // simulate onward, no sandbox chance count ticking over. The parent
    // decides what happens next (watch it again, by remounting with the
    // same replayOf; or close).
    if (replayOfRef.current) return;

    // In career/match mode, enter simulation phase. In sandbox, go directly.
    if (matchModeRef.current) {
      handOver(() => startSimulation(), 1800);
    } else {
      // Sandbox mode: after 6 chances, show post-match
      if (attemptsRef.current >= 6) {
        const careerForStats = careerRef.current ?? FALLBACK_CAREER;
        const t = tallyRef.current;
        const stats = {
          ...finaliseMatch(
            attemptsRef.current, t.goals, t.assists, t.passesCompleted,
            90, userScoreRef.current, oppScoreRef.current, careerForStats,
            goalEventsRef.current, null, oppGoalEventsRef.current, fixture, matchExtras().tally,
          ),
          endEnergy: liveEnergyAt(matchMinuteRef.current),
          kibCansUsed: kibUsedRef.current,
          playstyle: playstyleRef.current,
          ...cheekyStats(),
        };
        handOver(() => { setFinalStats(stats); setPhase("postmatch"); }, 1800);
      } else {
        handOver(() => loadScenario(false), 1800);
      }
    }
  };

  /**
   * The run is over.
   *
   * Getting through is NOT the end of the move — §6.1: "dribbling is rewarded
   * when it creates a better football decision". So it chains straight into a
   * chance built from where you got to, using the same machinery a completed
   * pass uses. Losing it is a turnover like any other.
   */
  const finishDribble = (out: "through" | "lost" | "out") => {
    const s = dribbleRef.current;
    // Left set, deliberately, when the run ends in a tackle — see the draw
    // loop's own note on why "result" still reads it. Overwritten wholesale
    // the next time a dribble actually starts (newDribble, below), so there
    // is nothing to leak into a scenario that never uses it.
    if (out === "through") dribbleRef.current = null;
    attemptsRef.current += 1;

    if (out === "through" && s) {
      tallyRef.current.dribbles += 1;
      setStats({ ...tallyRef.current });
      logChance("dribble", "dribble");
      pushLine("You are through — and the chance is on.");
      showAction("BEAT HIM");
      // Beating your man is the bravest thing available, so what follows is read
      // the same way the ambitious pass is.
      chainRef.current = { pos: { x: s.pos.x, y: s.pos.y }, depth: 0, ambition: 1 };
      if (matchModeRef.current) resolveScenario(matchStateRef.current, "delivered");
      {
        const gen = sceneGenRef.current;
        window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(true); }, 1200);
      }
      return;
    }

    pushLine(out === "lost" ? "Taken off you." : "You run it out of play.");
    setOutcome("tackled");
    setPhase("result");
    if (matchModeRef.current) resolveScenario(matchStateRef.current, "lost");
    const t = tallyRef.current;
    t.chances += 1;
    t.lost += 1;
    setStats({ ...t });
    logChance("dribble", "tackled");
    if (matchModeRef.current) {
      const gen = sceneGenRef.current;
      window.setTimeout(() => { if (sceneGenRef.current === gen) startSimulation(); }, 1600);
    } else {
      const gen = sceneGenRef.current;
      window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(false); }, 1600);
    }
  };

  /**
   * A dribble run's waves and seed, rolled once when it starts. Dribble duels:
   * Old rolls exactly as before; New rolls the shorter duels run
   * (duelWaveSizes — one man takes you on at a time, so fewer men).
   */
  // Dribble duels: Old, no toggle (12 Oct 2026). The duels run is on /star-dribble-dev.
  const rollDribbleRun = (rng: () => number): { waveSizes: number[]; seed: number; duels?: boolean } => (
    { waveSizes: pickWaveSizes(rng, { minRounds: 3 }), seed: Math.floor(rng() * 1e9) }
  );

  /**
   * Dribble style: Top-down. The same run the first-person duel plays (same
   * waves, same seed, same roster), built here and stepped by this component's
   * own loop; drawn in the match view with the match's players and ball.
   */
  const startTopDownDribble = (): Phase => {
    const fp = fpDribbleRef.current;
    if (!fp) return "fpDribble";
    const car = careerRef.current;
    const run = newFpRun({
      pace: fp.duels ? (car?.skills.pace ?? 60) : 100,
      oppStrength: fp.duels ? Math.round(oppStrengthRef.current ?? 70) : 100,
      waveSizes: fp.waveSizes, roster: fpRosterRef.current, rng: mulberry32(fp.seed),
      mates: Math.round(getTuning("dribble.mates")),
      ...(fp.duels ? { duels: true, dribbling: car?.skills.technique ?? 55 } : {}),
    });
    if (dribbleControlRef.current === "stick") fpStick(run, 0, 0);
    tdStickRef.current = null;
    tdTapRef.current = null;
    tdRef.current = run;
    tdReadyRef.current = true;
    setTdReady(true);
    tdNoteCountRef.current = 0;
    setTdNote(null);
    tdBallRef.current = { x: run.x + 0.3, vx: 0 };
    tdTouchRef.current = null;
    facingRef.current = "up";
    viewportRef.current = topDownViewport(run);
    baseViewportRef.current = { ...viewportRef.current };
    playZoomRef.current = 1;
    return "tdDribble";
  };

  /** Top-down: the frame follows you up the pitch, about 30 m deep, and sideways too, centred on
   *  you (Harry, 13 Oct 2026: "what happened to our top-down dribbling that was actually moving with
   *  the ball?" — it was fixed sideways at the pitch centre). Same width; never past a touchline.
   *  The picture only: the run's rules and the hidden match are untouched. */
  const topDownViewport = (run: FpRunState) => {
    const c = canvasRef.current;
    const aspect = c && c.height > 0 ? c.width / c.height : 5 / 8;
    const y1 = run.y - 20, y2 = run.y + 9;
    const w = (y2 - y1) * aspect;
    const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, run.x));
    return { x1: cx - w / 2, x2: cx + w / 2, y1, y2 };
  };

  /** One frame of the top-down picture's own bits: the camera and the drawn ball. */
  const stepTopDownPicture = (run: FpRunState, dt: number) => {
    const want = topDownViewport(run);
    const vp = viewportRef.current;
    const k = 1 - Math.exp(-4 * dt);
    viewportRef.current = { x1: vp.x1 + (want.x1 - vp.x1) * k, x2: vp.x2 + (want.x2 - vp.x2) * k, y1: vp.y1 + (want.y1 - vp.y1) * k, y2: vp.y2 + (want.y2 - vp.y2) * k };
    baseViewportRef.current = { ...viewportRef.current };
    // The ball: just outside your boot, eased (a little overshoot) towards the
    // side you are touching it to, so a change of direction is seen as a touch.
    const b = tdBallRef.current;
    let dir = 0;
    if (run.burst) dir = run.burst.dir;
    else if (run.stick) dir = Math.abs(run.stick.x) > 0.15 ? Math.sign(run.stick.x) : 0;
    else if (run.feint) dir = run.feint.kind === "stepover" ? -run.feint.dir : run.feint.dir;
    else if (Math.abs(run.laneTarget - run.x) > 0.15) dir = Math.sign(run.laneTarget - run.x);
    const want2 = run.x + (dir === 0 ? 0.28 : dir * (run.burst ? 0.9 : 0.55));
    b.vx += (90 * (want2 - b.x) - 17 * b.vx) * dt;
    b.x += b.vx * dt;
    seamRef.current += dt * 9;
  };

  /** Top-down: the run is over — the same ending as the first-person duel. */
  const finishTopDownDribble = (out: FpRunPhase) => {
    const run = tdRef.current;
    if (!run || phaseRef.current !== "tdDribble") return;
    const pass = run.pass;
    const result: FpDribbleResult = {
      cleared: out === "clear",
      beaten: run.defenders.filter(d => d.phase === "beaten").length,
      wavesBeaten: fpWavesBeaten(run),
      totalWaves: run.roundSizes.length,
      ...(pass && pass.success ? { passedAfterWaves: pass.afterWaves, passTo: pass.at } : {}),
      ...(pass && !pass.success ? { passFailed: true } : {}),
      ...(out === "fouled" ? { fouled: true } : {}),
      ...(run.duels ? { duels: true } : {}),
    };
    // Frozen on screen through the beat that follows (cleared by loadScenario).
    setPhase("result");
    finishFpDribble(result);
  };

  /**
   * The first-person duel is over — see USE_FIRST_PERSON_DRIBBLE.
   *
   * Mirrors `finishDribble` above exactly on a loss. On a win, requested
   * directly with a specific threshold: beating SEVEN OR MORE men and still
   * making it through means you broke clean forward, not just past the one
   * or two who were actually near you — that earns a real attacking
   * scenario near the box (`chainKindFor`'s own close-range branch, at
   * `y < BOX_DEPTH + 2`: ~45% one_on_one, else volley/tight_angle — real
   * shooting-shape chances, no through-ball/cross routing) rather than the
   * ordinary advanced-midfield chain every other clear run gets, which
   * lands well short of the box on purpose, at roughly the same depth
   * `lib/star/dribble.ts`'s own old run used to end a normal win at.
   */
  const finishFpDribble = (result: FpDribbleResult) => {
    fpDribbleRef.current = null;
    attemptsRef.current += 1;
    const rng = rngRef.current;

    // Leo, 5 Oct 2026: a pass to a team-mate in the background ends the run
    // too — and what it earns climbs with the waves you beat first. Clearing
    // the run is on the same ladder (lib/star/dribbleReward.ts), and the ladder
    // picks the KIND, because a chained chance's position alone no longer
    // decides its kind while the even mix is on (lib/star/kindMix.ts).
    // Dribble duels: he brought you down — a free kick, the way the match's
    // own fouls are (see `fouled`): yours if you are on them, else watched.
    if (result.fouled) {
      const t = tallyRef.current;
      if (result.beaten > 0) t.dribbles += 1;
      setStats({ ...t });
      logChance("dribble", "dribble");
      showAction("FOUL");
      pushLine("Brought down as he goes past him — free kick.");
      playWhistle();
      const gen = sceneGenRef.current;
      if (mayTake("free_kick")) {
        setPieceNextRef.current = "free_kick";
        if (matchModeRef.current) resolveScenario(matchStateRef.current, "delivered");
        window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(true); }, 1600);
      } else if (matchModeRef.current) {
        handoverRef.current = "free_kick";
        window.setTimeout(() => { if (sceneGenRef.current === gen) startSimulation(); }, 1800);
      } else {
        window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(false); }, 1600);
      }
      return;
    }
    const passed = result.passedAfterWaves !== undefined;
    if (result.cleared || passed) {
      const t = tallyRef.current;
      if (passed) { t.passes += 1; t.passesCompleted += 1; }
      if (result.beaten > 0 || result.cleared) t.dribbles += 1;
      setStats({ ...t });
      logChance("dribble", "dribble");
      {
      const reward = dribbleReward({
        cleared: result.cleared, menBeaten: result.beaten,
        wavesBeaten: result.wavesBeaten ?? (result.cleared ? 1 : 0),
        totalWaves: result.totalWaves ?? 1,
        mateX: result.passTo?.x,
        // Duels runs are shorter (up to five men): beating four is the clean break.
        ...(result.duels ? { bonusMen: 4 } : {}),
      }, rng);
      if (passed) {
        pushLine(reward.tier >= 3 ? "Picks out the free man — and he's in."
          : reward.tier >= 2 ? "Draws them in and slips it wide."
          : "Lays it off early.");
        showAction("PASS");
      } else {
        pushLine(reward.tier >= 4 ? "Clean through — you've beaten the lot of them." : "You are through — and the chance is on.");
        showAction("BEAT HIM");
      }
      chainRef.current = { pos: reward.pos, depth: 0, ambition: reward.ambition, kind: reward.kind };
      }
      if (matchModeRef.current) resolveScenario(matchStateRef.current, "delivered");
      {
        const gen = sceneGenRef.current;
        window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(true); }, 1200);
      }
      return;
    }

    pushLine(result.passFailed ? "The pass is cut out." : "Taken off you.");
    setOutcome("tackled");
    setPhase("result");
    if (matchModeRef.current) resolveScenario(matchStateRef.current, "lost");
    const t = tallyRef.current;
    t.chances += 1;
    t.lost += 1;
    if (result.passFailed) t.passes += 1;
    setStats({ ...t });
    logChance("dribble", "tackled");
    if (matchModeRef.current) {
      const gen = sceneGenRef.current;
      window.setTimeout(() => { if (sceneGenRef.current === gen) startSimulation(); }, 1600);
    } else {
      const gen = sceneGenRef.current;
      window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(false); }, 1600);
    }
  };

  // Run the match on around you until it needs you again.
  //
  // This used to be a countdown: an interval computed from your skill decided
  // when the next chance arrived, and the opponent scored on an independent
  // coin flip. Nothing linked one moment to the next, so a chance never felt
  // earned. The clock is now driven by the simulation — you are pulled in when
  // your side works the ball into a dangerous area, and the situation you get
  // is whatever that area justifies.
  const startSimulation = (resim = false) => {
    sceneGenRef.current += 1;
    // A re-run (an energy-mode switch mid-stretch, see stretchRef) puts
    // everything the stretch touched back where it started and replays it
    // from the same seed.
    const prior = resim ? stretchRef.current : null;
    if (prior) {
      matchStateRef.current = { ...prior.snapshot };
      userScoreRef.current = prior.userScore;
      oppScoreRef.current = prior.oppScore;
      goalEventsRef.current.length = prior.goalEvents;
      oppGoalEventsRef.current.length = prior.oppGoalEvents;
      hookedRef.current = prior.hooked;
      hookedAtRef.current = prior.hookedAt;
      setFeed(prior.feed);
    } else {
      seedRef.current += 1;
    }
    const stretchSeed = prior ? prior.seed : seedRef.current;
    const rng = countedRng(stretchSeed, rngCallCountRef);
    rngRef.current = rng;

    // The refs are the authority on the scoreline (the HUD reads them, and your
    // own goals are credited in resolveOutcome), so the match is synced to them
    // before it runs rather than keeping a second, divergent count.
    const st = matchStateRef.current;
    st.userScore = userScoreRef.current;
    st.oppScore = oppScoreRef.current;
    // The live radar reads every minute played from here on (read-only).
    st.radarTrace = radarTraceRef.current;

    if (!prior) playstyleChangesRef.current = [];
    const baseInputs: HiddenMatchInputs = prior
      ? { ...prior.inputs, energyModeChanges: prior.changes, context: { ...prior.inputs.context, playstyleChanges: playstyleChangesRef.current } }
      : hiddenInputs();
    if (!prior) {
      stretchRef.current = {
        snapshot: { ...st },
        seed: stretchSeed,
        inputs: baseInputs,
        userScore: userScoreRef.current,
        oppScore: oppScoreRef.current,
        goalEvents: goalEventsRef.current.length,
        oppGoalEvents: oppGoalEventsRef.current.length,
        hooked: hookedRef.current,
        hookedAt: hookedAtRef.current,
        feed: feedRef.current,
        changes: [],
        queued: 0,
      };
    }

    // Dead balls you are not the taker for go to whoever is. Keep advancing
    // until the match hands you something that is actually yours — bounded,
    // because every pass moves the clock and the clock ends the match.
    // Item 25: a substitute comes off the minute his energy reaches
    // SUB_OFF_ENERGY — so the stretch stops there instead of at full time.
    let offAt = Infinity;
    // The farewell: off at the ovation minute, whatever happens before it.
    const fw = farewellRef.current;
    if (fw && !hookedRef.current) offAt = Math.max(st.minute, fw.offAt);
    else if (subOnRef.current && !hookedRef.current && !neverHookedRef.current) {
      const perMin = energyPerMinute(energyModeRef.current, energyFactorRef.current);
      const e = liveEnergyAt(st.minute);
      if (perMin > 0) offAt = e <= SUB_OFF_ENERGY ? st.minute : st.minute + Math.ceil((e - SUB_OFF_ENERGY) / perMin);
    }
    // A planned change (a friendly): off at that minute, if nothing took you off first.
    let plannedOff = false;
    const po = plannedOffRef.current;
    if (!fw && po && !hookedRef.current && !neverHookedRef.current && po < offAt) {
      offAt = Math.max(st.minute, po);
      plannedOff = true;
    }
    const stretchEnd = Math.min(matchCeilingRef.current, offAt);
    const handedOver: HiddenMatchEvent[] = [];
    // A foul on you while you pulled back (v0.15 item 22) whose set piece is
    // somebody else's: handed over exactly like the ones below, before the
    // match runs on. Consumed on the first run of the stretch; a re-run
    // replays it from the stretch's own record.
    const handover = prior ? prior.handover : handoverRef.current;
    handoverRef.current = null;
    if (!prior && stretchRef.current) stretchRef.current.handover = handover;
    if (handover) {
      const label = handover === "penalty" ? "penalty" : "free kick";
      const scored = rng() < (handover === "penalty" ? 0.76 : 0.09);
      handedOver.push(scored
        ? { minute: st.minute, text: `⚽ Your side score the ${label}!`, isGoal: true, teammateGoal: true }
        : { minute: st.minute, text: `A ${label} — someone else steps up, and it comes to nothing.` });
      resolveScenario(st, scored ? "goal" : "saved");
    }
    // Set pieces you do not take go to whoever does, and the match runs on.
    // runStretch keeps EVERY run's lines (lib/star/stretchRun.ts: the lost
    // goal that put the stats screen a goal ahead of the scoreboard).
    let step = runStretch(st, baseInputs, rng, stretchEnd, mayTake, handedOver);
    /** Item 25: the stretch ran out because his legs did, not the clock. */
    const legsGone = !step.request && offAt < matchCeilingRef.current && st.minute >= offAt;
    if (legsGone) step = { ...step, fullTime: false };

    const raw = step.events;

    // ── WHO SCORED ──
    //
    // A goal your side scores while you are not on the ball used to be reported
    // as "Your side score" and then vanish: no name on the sim screen, no line
    // in the running commentary, and nothing in the scoresheet. Half your team's
    // goals across a whole career belonged to nobody.
    //
    // Done in ONE pass now, mapping each raw event to its own SimEvent. The
    // previous version named the goal and then went looking for the line to
    // rename with `events.find(minute === e.minute && isGoal)`, which is not an
    // identity — two goals in the same minute renamed the same line twice and
    // left the other anonymous, and a minute where BOTH sides scored could put
    // your striker's name on the opposition's goal.
    const squad = onPitch(careerRef.current?.squad ?? []);
    // `announce: true` — these are happening now, live, so they belong in the
    // four-line ticker as well as in the permanent log.
    // Names come off their own seeded stream, not the match's: a re-run
    // (stretchRef) must name every goal already read out exactly as before,
    // and the match stream past the switch is different by design.
    const events: SimEvent[] = nameTeamGoals(raw, squad, mulberry32(stretchSeed * 31 + 7), true);

    if (!prior) {
      if (st.oppScore > oppScoreRef.current) playCrowdSwell("groan");
      else if (st.userScore > userScoreRef.current) playCrowdSwell("cheer");
    }
    userScoreRef.current = st.userScore;
    oppScoreRef.current = st.oppScore;

    // Nothing at all happened in the skipped minutes — say so rather than
    // showing an empty panel.
    if (events.length === 0) {
      const isOpponent = st.possession !== "user";
      const bank = isOpponent ? SIM_COMMENTARY_OPP : SIM_COMMENTARY_USER;
      const text = bank[Math.floor(rng() * bank.length)];
      // This fallback fires AFTER nameTeamGoals already ran (only when it
      // produced nothing at all), so it never gets nameTeamGoals' own
      // {club} resolution for free — has to do it itself.
      events.push({ minute: st.minute, text: attributeClub(text, isOpponent), isOpponent });
    }

    // ── Being taken off ──
    // Checked here, between chances, because that is where the clock actually
    // moves. Your afternoon decides it; the game being won decides the
    // flattering version of it.
    if (!hookedRef.current && !step.fullTime && !neverHookedRef.current) {
      const t = tallyRef.current;
      const decision = fw
        // The farewell: nobody takes you off — until the ovation minute.
        ? (legsGone
          ? { hooked: true, reason: "rested" as HookReason, message: `${st.minute}' — you come off. The whole ground is on its feet for you.` }
          : { hooked: false, reason: null, message: "" })
        : legsGone && plannedOff
        ? { hooked: true, reason: "rested" as HookReason, message: `${st.minute}' — a planned change. The manager wants a look at someone else; you come off.` }
        : legsGone
        ? { hooked: true, reason: "legs" as HookReason, message: `Out on your feet at ${Math.round(liveEnergyAt(st.minute))}% energy — you are taken off.` }
        : hookCheck({
          minute: st.minute,
          startMinute: enteredAtRef.current,
          liveRating: ratingSoFar(t, st.userScore, st.oppScore),
          scoreDiff: st.userScore - st.oppScore,
          rng,
          liveEnergy: liveEnergyAt(st.minute),
          cameo: subOnRef.current,
        });
      if (decision.hooked) {
        // Spend the energy up to the minute you came off BEFORE freezing it —
        // liveEnergyAt stops counting the moment hookedRef is set, and the
        // commentary has not reached this minute yet (filmed: off "at 11%"
        // while the bar and the saved energy stayed on 21).
        chargeEnergyTo(st.minute);
        hookedRef.current = decision.reason;
        hookedAtRef.current = st.minute;
        events.push({ minute: st.minute, text: decision.message });
        if (fw) setOvation(st.minute);
        // The rest of the match is played without you, exactly as the hour
        // before kick-off is when you come off the bench.
        //
        // Through `nameTeamGoals`, and that is the whole point. This branch
        // used to map the events by hand, which put the right TEXT on screen
        // and never once called `goalEventsRef.current.push` — so every goal
        // your side scored after you were taken off counted on the scoreboard
        // and existed nowhere else. Reported as a 3-0 win whose scoreline
        // graphic named two scorers. It is the same bug the comment above
        // `nameTeamGoals` describes for the hour BEFORE you come on, left
        // un-fixed in the mirror-image branch: the substitution that ends your
        // afternoon, rather than the one that starts it.
        const after = advanceTo(st, baseInputs, rng, matchCeilingRef.current);
        events.push(...nameTeamGoals(after, onPitch(careerRef.current?.squad ?? []), rng, false));
        userScoreRef.current = st.userScore;
        oppScoreRef.current = st.oppScore;
        step = { ...step, request: null, fullTime: true };
      }
    }

    pendingRequestRef.current = step.request;
    if (step.request && subOnRef.current) subChancesRef.current += 1;

    // ── Into the commentary, a line at a time ──
    //
    // The minute is NOT jumped to here: it is advanced by the streamer as each
    // line is read out, which is the difference between watching the clock run
    // and being told where it got to. See the queue effect.
    // On a re-run, the lines already read out came out identical; only the
    // ones still to come are replaced.
    // ── Added time: the fourth official's board (item 30) ──
    // Goes up once, in the stretch that first runs past 90', before the first
    // line of added time. A re-run of that stretch carries it again.
    const board = prior ? !!prior.board
      : ADDED > 0 && !boardShownRef.current && extraTimeStageRef.current === 0 && st.minute > MATCH_DURATION;
    if (board) {
      boardShownRef.current = true;
      if (stretchRef.current) stretchRef.current.board = true;
      const at = events.findIndex(e => e.minute > MATCH_DURATION);
      events.splice(at < 0 ? events.length : at, 0, {
        minute: MATCH_DURATION, tone: "period",
        text: `+${ADDED} minute${ADDED === 1 ? "" : "s"} added`,
      });
    }
    const shown = prior ? Math.max(0, prior.queued - queueRef.current.length) : 0;
    if (stretchRef.current) stretchRef.current.queued = events.length;
    // ── v0.25: Play goes straight into the first chance ──
    // Mikey, 2 Oct 2026 (review point 30): "as soon as you press Play" the
    // match should become the chance, not a kick-off card while the clock
    // walks up to it (measured: about 0.7 s a minute, so a first chance at
    // 14' was ten seconds of nothing). The first stretch of a match you
    // start is written straight into the log and the clock jumps to it.
    // Only when a chance of yours is waiting, and never across half time.
    // Only a SHORT jump. A first chance at 44' made the jump swallow the whole
    // first half: Play went straight to 44' with no commentary at all
    // (Mikey's farewell playtest, 8 Oct 2026). Past QUICK_START_MAX the first
    // stretch is read out like any other.
    const quick = quickStartRef.current && !prior && !!step.request && !step.fullTime
      && st.minute <= QUICK_START_MAX
      && (st.minute <= HALF_TIME_MINUTE || halfTimeShownRef.current);
    quickStartRef.current = false;
    if (quick) {
      const lines = linesFrom(events, matchMinuteRef.current);
      setLog(l => [...l, ...lines]);
      setQueue([]);
      setClock(st.minute);
    } else {
      setQueue(linesFrom(events.slice(shown), matchMinuteRef.current));
    }
    setPhase("feed");

    simContinueRef.current = () => {
      if (step.fullTime) {
        // `finalize`/`runShootout` are hoisted to the top of this branch
        // (rather than declared after the "Full Time" bookkeeping below, as
        // they used to be) because the two extra-time-stage branches right
        // below need to call them too, and neither closes over anything from
        // THIS particular call of startSimulation — only stable outer refs —
        // so moving them earlier changes nothing about what they do.
        const finalize = () => {
          setPause(null);
          const careerForStats = careerRef.current ?? FALLBACK_CAREER;
          const t = tallyRef.current;
          const stats: MatchStats = {
            ...finaliseMatch(
              attemptsRef.current, t.goals, t.assists, t.passesCompleted,
              Math.max(1, (hookedAtRef.current ?? matchMinuteRef.current) - enteredAtRef.current),
              userScoreRef.current, oppScoreRef.current, careerForStats,
              goalEventsRef.current, hookedRef.current, oppGoalEventsRef.current, fixture, matchExtras().tally,
            ),
            ...matchExtras().extra,
            // The moment the match actually ended for you — full time, or
            // the minute you were hooked — not necessarily 90.
            endEnergy: liveEnergyAt(hookedAtRef.current ?? matchMinuteRef.current),
            kibCansUsed: kibUsedRef.current,
            playstyle: playstyleRef.current,
            ...(wentToExtraTimeRef.current ? { wentToExtraTime: true } : {}),
            ...(shootoutResultRef.current ? { shootout: shootoutResultRef.current } : {}),
            ...cheekyStats(),
          };
          if (matchModeRef.current && onCompleteRef.current) {
            onCompleteRef.current(stats);
          } else {
            setFinalStats(stats);
            setPhase("postmatch");
          }
        };

        // See startShootout (component level: the live shootout).
        const runShootout = () => startShootout();

        // ── Reaching the ceiling mid-extra-time is not the match ending ──
        //
        // `matchCeilingRef`/`extraTimeStageRef` (see their own doc comments)
        // let extra time run through this SAME interactive
        // startSimulation/advanceUntilInvolved loop as normal time, just at
        // an extended ceiling — reached in two real 15-minute stages with a
        // genuine break in between, instead of one non-interactive jump
        // straight to the 120th minute. Handled here, before the ordinary
        // 90-minute full-time logic below, so that logic's own "is this a
        // decisive draw" check never re-fires partway through extra time.
        if (extraTimeStageRef.current === 1) {
          setLog(l => [...l, logLine(
            "End of the first half of extra time.", "period", matchCeilingRef.current,
          )]);
          setPause({
            cta: "Second half (extra time) →",
            onContinue: () => {
              setPause(null);
              extraTimeStageRef.current = 2;
              matchCeilingRef.current = MATCH_DURATION + ADDED + 30;
              setLog(l => [...l, logLine(
                "Second half of extra time.", "period", matchCeilingRef.current,
              )]);
              startSimulation();
            },
          });
          return;
        }

        if (extraTimeStageRef.current === 2) {
          const eligibilityAfterEt = extraTimeEligibility();
          const stillLevel = !!eligibilityAfterEt && eligibilityAfterEt.isLevelNow();
          if (stillLevel) {
            runShootout();
          } else {
            setLog(l => [...l, logLine(
              `After Extra Time  ${fixtureHomeRef.current ? userScoreRef.current : oppScoreRef.current} - ${fixtureHomeRef.current ? oppScoreRef.current : userScoreRef.current}`,
              "period", matchCeilingRef.current,
            )]);
            setPause({ cta: "Full time →", onContinue: finalize });
          }
          return;
        }

        // Full time stops the match rather than sliding into the summary: a
        // final whistle you did not notice is a result you find out about on a
        // stats screen.
        // Real scoreline order — home side first — same fix and same reason
        // as Half Time above: read off revealed goals from the log itself,
        // not the raw refs, in case a future change to the queue-draining
        // gate above ever lets this fire before every line has streamed out.
        setLog(l => {
          const userGoals = l.filter(x => x.tone === "goal").length;
          const oppGoals = l.filter(x => x.tone === "oppGoal").length;
          const homeFinal = fixtureHomeRef.current ? userGoals : oppGoals;
          const awayFinal = fixtureHomeRef.current ? oppGoals : userGoals;
          return [...l, logLine(`Full Time  ${homeFinal} - ${awayFinal}`, "period", MATCH_DURATION + ADDED)];
        });
        setMatchMinute(MATCH_DURATION + ADDED);

        // ── A knockout cannot be drawn ──
        //
        // See shootout.ts's `hasExtraTime` for the exact per-competition
        // table (League Cup: only the Final; FA Cup: every round;
        // Champions/Europa League: every decisive knockout leg, on
        // aggregate; Super Cup/Community Shield: straight to penalties).
        // League fixtures and a Euro league-phase night are never decisive
        // — a draw stands — `extraTimeEligibility()` returns null for both.
        const eligibility = extraTimeEligibility();
        const isDecisiveDraw = !!eligibility && eligibility.isLevelNow();

        if (!isDecisiveDraw) {
          setPause({ cta: "Full time →", onContinue: finalize });
          return;
        }

        if (!eligibility!.extraTime) {
          setPause({
            cta: "Penalties →",
            onContinue: () => { setPause(null); runShootout(); },
          });
          return;
        }

        setPause({
          cta: "Extra time →",
          onContinue: () => {
            setPause(null);
            wentToExtraTimeRef.current = true;
            // Extra time now plays out exactly like normal time: real,
            // interactive chances via startSimulation, just with the ceiling
            // extended to the first extra-time half. A genuine break follows
            // at that ceiling (handled by the extraTimeStageRef === 1 branch
            // above) before the second half resumes it further still.
            extraTimeStageRef.current = 1;
            matchCeilingRef.current = MATCH_DURATION + ADDED + 15;
            setLog(l => [...l, logLine(
              "Extra time — first half.", "period", MATCH_DURATION + ADDED,
            )]);
            startSimulation();
          },
        });
      } else {
        loadScenario(false);
      }
    };
    if (quick) {
      const gen = sceneGenRef.current;
      window.setTimeout(() => {
        if (sceneGenRef.current !== gen) return;
        const go = simContinueRef.current;
        simContinueRef.current = null;
        stretchRef.current = null;
        go?.();
      }, 0);
    }
  };

  /**
   * A penalty or a direct free kick (lib/star/penaltyRunup.ts): you stand a
   * few steps back and to one side before you aim, not on the ball.
   * Everything else about the picture is untouched. A function declaration
   * so the mount effect above can reach it.
   */
  function standBackForRunup(sc: Scenario) {
    // How far back and how wide depends on the taker's run-up style
    // (runupStyles.ts); Standard is exactly penaltyRunup.ts's standBack.
    if (hasRunup(sc.kind)) sc.player = standBackFor(runupStyleFor(sc), sc.ball, sc.player, sc.viewport);
  }

  // ── v0.15: the kicks you WATCH (items 6 and 7) ────────────────────────────
  //
  // A team-mate's penalty, and every kick of a shootout, played on the real
  // pitch. The kick itself is `handleContact` — the one strike — with the
  // taker's aim (lib/star/penaltyTaking.ts's plan) instead of your drag.

  /** The eleven on the pitch now (not you), as penalty takers. */
  const ourTakers = (): { outfield: PenaltyTaker[]; keeper: (PenaltyTaker & { overall?: number }) | null } => {
    const squad = onPitch(careerRef.current?.squad ?? []);
    const all = squad.map((p) => ({
      id: p.id, name: p.name, shortName: p.shortName, face: p.imageUrl ?? fakeFaceFor(p.id),
      rating: takerRating(p), isGK: p.position === "GK", overall: p.overall,
    }));
    const outfield = all.filter((t) => !t.isGK);
    // A generated or thin squad still has five men to take one.
    for (let i = outfield.length; i < 5; i++) {
      outfield.push({ id: `mate-${i}`, name: `Team-mate ${i + 1}`, shortName: `No. ${i + 7}`, face: fakeFaceFor(`mate-${i}`), rating: 62, isGK: false, overall: undefined });
    }
    return { outfield, keeper: all.find((t) => t.isGK) ?? null };
  };
  /** Their eleven, from the real team sheet when there is one. */
  const theirTakers = (): { outfield: PenaltyTaker[]; keeper: PenaltyTaker | null } => {
    const xi = oppXIForCast ?? [];
    const all: PenaltyTaker[] = xi.map((p) => ({
      id: p.id, name: p.name, shortName: p.shortName, face: p.face ?? fakeFaceFor(p.id),
      rating: takerRating({ overall: p.overall }), isGK: p.isGK,
    }));
    const outfield = all.filter((t) => !t.isGK);
    for (let i = outfield.length; i < 5; i++) {
      outfield.push({ id: `opp-${i}`, name: `Their No. ${i + 7}`, shortName: `No. ${i + 7}`, face: fakeFaceFor(`opp-${i}`), rating: 62 });
    }
    return { outfield, keeper: all.find((t) => t.isGK) ?? null };
  };
  const ourClubStrength = () => {
    const car = careerRef.current;
    return car?.league.find((t) => t.name === car.player.club)?.strength ?? teamRef.current;
  };
  const liveShootoutRef = useRef(liveShootout);
  liveShootoutRef.current = liveShootout;

  /**
   * A knockout goes to penalties: every kick is played on the pitch, in a
   * real order (v0.15 item 7 — it used to be your kick live and everybody
   * else's a dice roll shown as a tick or a cross).
   */
  const startShootout = () => {
    const yourSide: "home" | "away" = fixtureHomeRef.current ? "home" : "away";
    const homeClub = fixtureHomeRef.current ? (careerRef.current?.player.club ?? "Home") : (fixture?.opponent ?? "Away");
    const awayClub = fixtureHomeRef.current ? (fixture?.opponent ?? "Away") : (careerRef.current?.player.club ?? "Home");
    const car = careerRef.current;
    const us = ourTakers(), them = theirTakers();
    // You take one only if you are still on the pitch, and where your own
    // penalty rating puts you in the order — not always first.
    const you: PenaltyTaker | null = hookedRef.current ? null : {
      id: "you", name: car ? `${car.player.firstName} ${car.player.lastName}` : "You", shortName: playerLabel(),
      face: car?.player.portrait ?? DEFAULT_FAKE_FACE,
      rating: yourPenaltyRating({ technique: skills.technique, freeKick: car?.skills.freeKick ?? skills.technique }, car?.starRating ?? 0),
      you: true,
    };
    const ourOrder = shootoutOrder([...us.outfield, ...(us.keeper ? [us.keeper] : [])], you);
    const theirOrder = shootoutOrder([...them.outfield, ...(them.keeper ? [them.keeper] : [])]);
    // Each keeper's rating is his own where the squad data has one.
    const ourKeeper = {
      strength: Math.max(20, Math.min(99, us.keeper?.overall ?? ourClubStrength())),
      id: us.keeper?.id, name: us.keeper?.name, shortName: us.keeper?.shortName, face: us.keeper?.face,
    };
    const theirKeeper = {
      strength: strengthRef.current,
      id: them.keeper?.id, name: them.keeper?.name, shortName: them.keeper?.shortName, face: them.keeper?.face,
    };
    // Start every taker's and keeper's photo loading now, so each is ready by
    // his turn rather than requested the moment he steps up.
    for (const t of [...ourOrder, ...theirOrder]) getFaceImage(t.face);
    getFaceImage(ourKeeper.face); getFaceImage(theirKeeper.face);
    const home = yourSide === "home";
    setLiveShootout({
      homeClub, awayClub, yourSide,
      home: home ? ourOrder : theirOrder, away: home ? theirOrder : ourOrder,
      homeKeeper: home ? ourKeeper : theirKeeper, awayKeeper: home ? theirKeeper : ourKeeper,
    });
    logMoment("Penalties.", "period");
  };

  /** One kick of the live shootout, on the pitch. */
  const loadShootoutKick = (kick: LiveKick, submit: (scored: boolean) => void) => {
    const info = liveShootoutRef.current;
    if (!info) return;
    sceneGenRef.current += 1;
    seedRef.current += 1;
    rngRef.current = countedRng(seedRef.current, rngCallCountRef);
    const rng = rngRef.current;
    chainRef.current = null;
    dribbleRef.current = null;
    fpDribbleRef.current = null;
    tdRef.current = null;

    const ours = kick.side === info.yourSide;
    // The kicker faces the OTHER side's keeper.
    const keeper = kick.side === "home" ? info.awayKeeper : info.homeKeeper;
    const sc = buildScenario("penalty", rng, keeper.strength, teamRef.current, visionRef.current);
    // Harry's penalty rules (kindRules/penalty.ts): ball on the spot, keeper
    // centred on his line, the one penalty camera.
    enforceHardRules(sc);
    sc.conditions = conditionsRef.current;
    initDefenders(sc, rng);
    // A shootout: everybody else is in the centre circle.
    stageScene(sc, { teammates: false });
    clearForShootout(sc);
    if (keeper.name) sc.keeper.who = { id: keeper.id ?? "gk", name: keeper.name, shortName: keeper.shortName ?? keeper.name, position: "GK", face: keeper.face };
    if (!kick.taker.you) {
      const plan = planPenalty(kick.taker.rating, mulberry32((seedRef.current ^ 0x7a11c) >>> 0));
      attachAutoKick(sc, { side: ours ? "us" : "them", taker: kick.taker, plan, keeper, context: "shootout" });
    }
    // A few steps back for the run-up, and the keeper brain for THIS keeper.
    standBackForRunup(sc);
    setUpKeeper(sc, (seedRef.current ^ 0x4b7e) >>> 0);
    scenarioRef.current = sc;
    frameScenario(sc);
    ballRef.current = null;
    setAim(null);
    runupRef.current = null;
    setContactTimerS(null);
    setOutcome(null);
    dragRef.current = null;
    draggingRef.current = false;
    curveSwipeStartRef.current = null;
    captainDragRef.current = null;
    resetCommitted();
    bumpOrders();
    trailRef.current = [];
    particlesRef.current = [];
    shakeRef.current.t = 0;
    flashRef.current.t = 0;
    feelRef.current.fx = []; feelRef.current.net = null; feelRef.current.struck = null; vfxFxRef.current = [];
    shootoutKickRef.current = { resolve: submit };
    setPhase("aim");
    logMoment(kick.taker.you ? "Your penalty — up to you." : `${kick.taker.shortName} steps up…`, "you");
    playWhistle();
    if (!kick.taker.you) scheduleAutoKick();
  };

  /** A penalty your side has won that a team-mate takes, live (item 6). Built from `rng`. */
  const loadTeammatePenalty = (request: ScenarioRequest, rng: () => number): boolean => {
    const us = ourTakers();
    const taker = designatedTaker(us.outfield);
    if (!taker) return false;
    const sc = buildScenario("penalty", rng, strengthRef.current, teamRef.current, visionRef.current);
    enforceHardRules(sc);
    sc.conditions = conditionsRef.current;
    // The rest of your side on the edge of the box — not the taker twice.
    castScenario(sc, onPitch(careerRef.current?.squad ?? []).filter((p) => p.id !== taker.id));
    initDefenders(sc, rng);
    castDefence(sc, oppXIForCast);
    const kw = sc.keeper.who;
    const plan = planPenalty(taker.rating, mulberry32((seedRef.current ^ 0x7a11c) >>> 0));
    attachAutoKick(sc, {
      side: "us", taker, plan, context: "match",
      keeper: { strength: strengthRef.current, id: kw?.id, name: kw?.name, shortName: kw?.shortName, face: kw?.face },
    });
    standBackForRunup(sc);
    setUpKeeper(sc, (seedRef.current ^ 0x4b7e) >>> 0);
    scenarioRef.current = sc;
    frameScenario(sc);
    ballRef.current = null;
    setAim(null);
    runupRef.current = null;
    setContactTimerS(null);
    setOutcome(null);
    dragRef.current = null;
    draggingRef.current = false;
    curveSwipeStartRef.current = null;
    captainDragRef.current = null;
    bumpOrders();
    trailRef.current = [];
    particlesRef.current = [];
    shakeRef.current.t = 0;
    flashRef.current.t = 0;
    feelRef.current.fx = []; feelRef.current.net = null; feelRef.current.struck = null; vfxFxRef.current = [];
    setPhase("aim");
    onChanceServedRef.current?.({ kind: "penalty", minute: matchMinuteRef.current, reason: request.reason, scenario: snapshotScenario(sc) });
    logMoment(`Penalty! ${taker.shortName} to take it.`, "you");
    pushLine(request.reason);
    playWhistle();
    scheduleAutoKick();
    return true;
  };

  /** The shootout is over (either version): finish the match with its result. */
  const finishShootout = (result: { home: number; away: number }) => {
    shootoutResultRef.current = result;
    setLiveShootout(null);
    const careerForStats = careerRef.current ?? FALLBACK_CAREER;
    const t = tallyRef.current;
    const stats: MatchStats = {
      ...finaliseMatch(
        attemptsRef.current, t.goals, t.assists, t.passesCompleted,
        Math.max(1, (hookedAtRef.current ?? matchMinuteRef.current) - enteredAtRef.current),
        userScoreRef.current, oppScoreRef.current, careerForStats,
        goalEventsRef.current, hookedRef.current, oppGoalEventsRef.current, fixture, matchExtras().tally,
      ),
      ...matchExtras().extra,
      endEnergy: liveEnergyAt(hookedAtRef.current ?? matchMinuteRef.current),
      kibCansUsed: kibUsedRef.current,
      playstyle: playstyleRef.current,
      wentToExtraTime: wentToExtraTimeRef.current,
      shootout: result,
      ...cheekyStats(),
    };
    if (matchModeRef.current && onCompleteRef.current) {
      onCompleteRef.current(stats);
    } else {
      setFinalStats(stats);
      setPhase("postmatch");
    }
  };

  /** The keeper an automatic kick names: his rating and his face on the picture. */
  const dressAutoKeeper = (sc: Scenario) => {
    const k = autoKickOf(sc)?.keeper;
    if (!k) return;
    sc.keeperStrength = k.strength;
    if (k.name) sc.keeper.who = { id: k.id ?? "gk", name: k.name, shortName: k.shortName ?? k.name, position: "GK", face: k.face };
  };

  /** Start an automatic kick's run-up once the taker has stood over it for a beat. */
  const scheduleAutoKick = () => {
    if (!autoKickOf(scenarioRef.current)) return;
    const gen = sceneGenRef.current;
    window.setTimeout(() => {
      if (sceneGenRef.current !== gen || phaseRef.current !== "aim") return;
      const sc = scenarioRef.current;
      const k = autoKickOf(sc);
      if (!k) return;
      // He runs up like you do (penaltyRunup.ts) — the keeper may hop — and
      // it is struck for him when he gets there.
      const a = aimFor(sc, k.plan);
      startRunup(a.dir, a.power, { contact: a.contact, skills: takerSkills(k.taker.rating) });
    }, AUTO_STAND_MS);
  };
  // A feature's first picture (openOn) is built before the match mounts, so
  // an automatic kick on it is started here.
  useEffect(() => { scheduleAutoKick(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ── Every chance opens with the whole pitch on screen ──
  //
  // Final playtest (27 Sep 2026, 390x664): the match's first chance opened
  // with the page still at the top (the site's nav above the scoreboard), so
  // the pitch ran 160 px past the bottom of the screen — and the strike
  // screen that follows the pull-back fills the pitch with its ball at the
  // bottom: 44% of that ball was below the fold and the tap landed under it.
  // The frame itself was never the cause (1,000 served chances: the ball
  // always on screen with a full pull below it). The run-up already scrolled
  // for its strike screen; now every chance does, the moment it is served —
  // while nothing is timed or dragged. Only when the pitch is not already
  // fully showing, so nothing moves under someone reading.
  useEffect(() => {
    if (phase !== "aim") return;
    const w = wrapRef.current?.getBoundingClientRect();
    if (!w || w.bottom <= window.innerHeight + 1) return;
    const id = requestAnimationFrame(() => revealOnScreen(wrapRef.current, { smooth: false }));
    return () => cancelAnimationFrame(id);
  }, [phase]);

  // Load a new scenario onto the canvas and enter aim phase.
  const loadScenario = (attacking: boolean) => {
    sceneGenRef.current += 1;
    runOnRef.current = null;
    bootRef.current = null;
    applyClearanceRules();
    seedRef.current += 1;
    rngRef.current = countedRng(seedRef.current, rngCallCountRef);
    const rng = rngRef.current;

    // ── PLAYING ONE PARTICULAR PICTURE (the gallery's Play button) ──
    //
    // Ahead of EVERYTHING, including the early returns below for a build-up
    // and for a dribble request — a first attempt sat after those and the
    // overlay opened on "building from the back" instead of the chance it
    // was told to play, because the hidden match had asked for a build-up
    // and that branch returns before any scenario is built.
    //
    // Only when this is not the continuation of a move: a lay-off or a
    // touch-mode re-touch is the SAME move carrying on and still chains
    // normally. Everything else puts you back on the chosen picture, which
    // is what makes it useful for judging a scenario rather than a match.
    // …nor when a foul on you has just given a set piece (v0.15 item 22):
    // that is the next chance on a test screen too. Without this the banner
    // said PENALTY or FOUL and the same picture came back (final playtest:
    // 3 of 3 fouls on Infinite Highlights / the Play Area).
    if (openOnRef.current && !chainRef.current && !setPieceNextRef.current) {
      chainRef.current = null;
      pendingRequestRef.current = null;
      scenarioRef.current = openOnRef.current();
      // The picture is played as given — except for a kind's hard rules
      // (a penalty: keeper centred on his line, ball on the spot…).
      enforceHardRules(scenarioRef.current);
      scenarioRef.current.conditions = conditionsRef.current;
      castScenario(scenarioRef.current, onPitch(careerRef.current?.squad ?? []));
      initDefenders(scenarioRef.current, rng);
      castDefence(scenarioRef.current, oppXIForCast);
      stageScene(scenarioRef.current, sceneRef.current);
      realGoalRef.current?.dress?.(scenarioRef.current);
      // A feature's automatic kick (the Shootout on Infinite Highlights)
      // names its own keeper — castDefence has just put theirs in goal.
      dressAutoKeeper(scenarioRef.current);
      standBackForRunup(scenarioRef.current);
      setUpKeeper(scenarioRef.current, (seedRef.current ^ 0x4b7e) >>> 0);
      frameScenario(scenarioRef.current);
      ballRef.current = null;
      setAim(null);
      runupRef.current = null;
      setContactTimerS(null);
      setOutcome(null);
      dragRef.current = null;
      draggingRef.current = false;
      curveSwipeStartRef.current = null;
      captainDragRef.current = null;
      resetCommitted();
      bumpOrders();
      trailRef.current = [];
      particlesRef.current = [];
      shakeRef.current.t = 0;
      flashRef.current.t = 0;
      feelRef.current.fx = []; feelRef.current.net = null; feelRef.current.struck = null; vfxFxRef.current = [];
      setPhase("aim");
      playWhistle();
      scheduleAutoKick();
      return;
    }

    // What the match has just handed you, if anything. Its zone narrows the
    // scenario to what makes football sense from there; your position still
    // decides which of those you are likeliest to be the one taking.
    const rawRequest = attacking ? null : pendingRequestRef.current;
    pendingRequestRef.current = null;

    const chain = chainRef.current;
    chainRef.current = null;

    // Chances: New — the deal decides whether this moment is a top-down
    // dribble, by the league you play in (lib/star/dribbleDeal.ts). Old: the
    // match's own request, exactly as before.
    let request = rawRequest;
    if (rawRequest && !chain && newChancesOn()) {
      const d = (dribbleDealRef.current ??= { deal: newDribbleDeal(), rng: mulberry32((seed ^ 0xd21bb1e) >>> 0) });
      const car = careerRef.current;
      request = dealDribble(rawRequest, dribbleLevelFor(car ? divisionOf(car) : undefined, fixture?.competition), d.deal, d.rng);
    }

    // A test page asking for dribble runs only (the `dribbleOnly` prop).
    if (dribbleOnlyRef.current && !attacking && !chain) {
      request = { zone: request?.zone ?? "middle", kinds: ["one_on_one"], dribble: true, reason: request?.reason ?? "You pick it up with space to run into" };
    }

    // A foul on you while you pulled back (v0.15 item 22): the next chance is
    // the game's own free kick or penalty.
    const setPiece = chain ? null : setPieceNextRef.current;
    setPieceNextRef.current = null;

    // A finished run is kept around deliberately through its own "result"
    // phase (see the draw function's note above the dribble branch) so a
    // tackle or a run out of play doesn't flash a stale unrelated scenario
    // for a moment. But finishDribble only ever clears it back to null on
    // the "through" outcome — a "lost"/"out" ending left it sitting here
    // untouched, and the draw function keys off phase alone, not off which
    // scenario is actually current. The result: every scenario after that
    // point — a shot included — silently rendered the frozen dribble (its
    // chasers, its progress bar) the moment ITS OWN phase reached "result",
    // for as long as no new dribble came along to overwrite the ref.
    // Reported directly: kicking a ball "cut to a different scene" with a
    // bar across the top, and it kept doing it "onto the next highlight".
    // A new scenario loading is exactly the point its lifetime is over.
    dribbleRef.current = null;
    fpDribbleRef.current = null;
    tdRef.current = null;

    // ── A penalty your side has won, and you are not on them (v0.15 item 6) ──
    // The team's taker takes it, live, and you watch. On them, you take it —
    // the ordinary path below builds it for you exactly as before.
    if (!attacking && !chain && request?.penaltyWon && !mayTake("penalty")) {
      if (loadTeammatePenalty(request, rng)) return;
    }

    // A run at the defence rather than a ball to strike.
    if (!attacking && request?.dribble) {
      if (USE_FIRST_PERSON_DRIBBLE) {
        // Pace/opponent strength/wave shape are fixed production values, not
        // read off the career or tuned per scenario the way the old system's
        // `chasers` count was — requested directly, specific numbers: pace
        // 100, opponent strength 100, two to four waves of one to four men
        // each, never more than ten men across the whole run. Three to four
        // waves since 5 Oct 2026 (Leo: "harder, better rewards for more
        // waves") — with team-mates to pass to, a run is a ladder to climb,
        // and two waves left it only two rungs.
        // Settings → Gameplay → Dribble runs: Old = 2-4 waves, as before.
        fpDribbleRef.current = rollDribbleRun(rng);
        setAim(null);
        runupRef.current = null;
        setContactTimerS(null);
        setOutcome(null);
        dragRef.current = null;
        draggingRef.current = false;
        facingRef.current = "up";
        // Settings → Match → Dribble style: Top-down plays the same run here,
        // in the match view; First-person (the default) as before.
        setPhase(startTopDownDribble()); // Dribble: always top-down in matches (decided 12 Oct 2026)
        // A dribble has no ScenarioKind, so it is reported under its own name
        // rather than left out — see `onChanceServed`.
        onChanceServedRef.current?.({ kind: "dribble", minute: matchMinuteRef.current, reason: request.reason });
        logMoment(momentLine(), "you");
        pushLine(request.reason);
        pushLine("Beat your man to win the ball forward.");
        playWhistle();
        return;
      }
      dribbleRef.current = newDribble({
        pace: careerRef.current?.skills.pace ?? 50,
        oppStrength: oppStrengthRef.current,
        chasers: 3 + (rng() < 0.35 ? 1 : 0),
        rng,
      });
      setAim(null);
      runupRef.current = null;
      setContactTimerS(null);
      setOutcome(null);
      dragRef.current = null;
      draggingRef.current = false;
      // Its own camera, snapped into place rather than eased, so the run does
      // not begin on the frame the last chance was using.
      facingRef.current = "up";
      viewportRef.current = dribbleViewport(dribbleRef.current);
      baseViewportRef.current = { ...viewportRef.current };
      playZoomRef.current = 1;
      setPhase("dribble");
      onChanceServedRef.current?.({ kind: "dribble", minute: matchMinuteRef.current, reason: request.reason });
      logMoment(momentLine(), "you");
      pushLine(request.reason);
      pushLine("Swipe the way you want to run. Get past them to the line.");
      playWhistle();
      return;
    }

    // A touch-mode chain never went anywhere — it is the same move,
    // continuing from wherever your own touch actually settled, not a new
    // one. See resetForTouchOn's own doc for why this has to be a
    // completely different path from an ordinary completed pass's chain,
    // not just a different position fed into the same rebuild.
    const isTouchContinuation = chain !== null && chain.touchTouches !== undefined;
    // A new picture starts a new move (playOn.ts); a re-touch / a lay-off taken back is the same move.
    // B14: the same move keeps the stamina bar as your run left it; a new
    // chance comes a minute or more later, with your breath back (up to your energy).
    const legsWas = playOnRef.current?.stick?.legs;
    barRef.current = isTouchContinuation && legsWas ? legsWas.stamina.v : 1;
    playOnRef.current = null;
    poStickUiRef.current = null;
    setStickLive(false);
    setRunLive(false);
    {
      const cap = barCap(liveEnergyAt(matchMinuteRef.current));
      setStamUi({ v: Math.min(barRef.current, cap), cap, sprint: false, auto: false });
    }
    if (!isTouchContinuation) { leadPlayedRef.current = false; layOffsLeftRef.current = MAX_LAY_OFFS; }
    const carry = chain && !isTouchContinuation ? carryOnRef.current : null;
    carryOnRef.current = null;
    // ── EVERY NEW CHANCE COMES FROM ONE FUNCTION (lib/star/chanceMaker.ts) ──
    //
    // Harry, 27 Sep 2026: "every single highlight should feel different", and
    // "the current thing works pretty well I just don't like how it works in
    // game". makeChance is the same function the gallery's Sim and Infinite
    // Highlights use, so a chance served here is made the way it is made
    // there: one of your drawings (the drawing is the team), remembered
    // across matches so the last five pictures of a kind are not served
    // again, a one-on-one mostly on a break. It places everybody, the kind's
    // own rules (the free-kick wall) included; faces, roles and the camera
    // are done below. A touch-mode re-touch is the SAME move carrying on, so
    // it is repositioned, never remade.
    if (chain && isTouchContinuation) {
      resetForTouchOn(scenarioRef.current, chain.pos);
    } else {
      const made = makeChance({
        source: chain?.kind ? { from: "kind", kind: chain.kind }
          : chain ? { from: "chain", pos: chain.pos, ambition: chain.ambition, position: positionRef.current }
          : setPiece ? { from: "kind", kind: setPiece }
          : attacking ? { from: "attacking" }
          : request ? { from: "request", request, position: positionRef.current }
          : { from: "weighted", position: positionRef.current },
        rng,
        strength: { keeper: strengthRef.current, team: teamRef.current, vision: visionRef.current },
        memory: pictureMemory("game"),
        selection: chanceMemoryRef.current,
        formation: formationShapeFor(),
      });
      scenarioRef.current = made.sc;
      // v0.26: the match leans away from serving this kind straight back.
      noteServedKind(matchStateRef.current, made.sc.kind);
    }
    if (chain) {
      scenarioRef.current.chainDepth = chain.depth;
      // Touch Mode's own separate budget — absent (undefined, reading as 0)
      // for a chain that came from an ordinary completed pass, so touching
      // it always starts a fresh TOUCH_CHAIN_MAX allowance rather than
      // inheriting whatever a PRIOR touch-mode sequence had already spent.
      scenarioRef.current.touchTouches = chain.touchTouches;
    }

    scenarioRef.current.conditions = conditionsRef.current;

    // ── Put your actual team-mates in the shirts ──
    //
    // Every blue figure on the pitch becomes a man from your squad, chosen for
    // where he is standing. Whoever the ball reaches is who shoots, is who the
    // commentary names, and is who the goal goes to. See lib/star/lineup.ts.
    //
    // Skipped for a touch-mode continuation: nobody new has entered the
    // situation, so every runner/secondaryRunner/follower/crosser already
    // carries the exact real identity castScenario gave him a moment ago —
    // re-running it against positions that drifted slightly during the
    // flight risks reshuffling who's who for no reason, which is exactly
    // the "different... everything" this whole fix exists to prevent.
    if (!isTouchContinuation) {
      castScenario(scenarioRef.current, onPitch(careerRef.current?.squad ?? []));
    }

    strikeRuleRef.current = null;

    // (The served frame's last word — the whole goal on screen and room to
    // pull back, v0.15 items 12 + 20 — is makeChance's own last step.)

    // Give the defence its shape: who presses, who covers a lane, who holds.
    initDefenders(scenarioRef.current, rng);

    // ── And put real faces on the shirts marking you, where there's a real
    // sheet to draw them from ── see castDefence's own doc, lib/star/lineup.ts.
    castDefence(scenarioRef.current, oppXIForCast);

    // The keeper brain: everyone is in place, so he can plan where to get set.
    setUpKeeper(scenarioRef.current, (seedRef.current ^ 0x4b7e) >>> 0);

    // You are RECEIVING this one, not starting with it at your feet, so the
    // defence gets the time your first touch cost them. A heavy touch and they
    // are on you before you look up; a good one and you have a moment.
    //
    // A touch-mode re-kick is not a reception — it never left your own
    // feet — so it never pays this cost.
    //
    // ── …and you keep the stance the chance was made with ──
    // applyFirstTouch also re-stands you 1.3 m beside the ball, whatever the
    // drawing had (measured, audit #5: 100% of chained one-on-ones moved,
    // median 1.14 m) — and only here, never in the Sim. The heavy-touch BALL
    // move is kept and you go with it, as drawn. Then nobody starts on top of
    // anybody after the touch either (spacing.ts).
    let heavyTouch = 0;
    if (chain && !isTouchContinuation) {
      const sc = scenarioRef.current;
      const stance = { x: sc.player.x - sc.ball.x, y: sc.player.y - sc.ball.y };
      heavyTouch = applyFirstTouch(sc, tiredSkills().technique, rng);
      const vp = sc.viewport, inset = 1.4;
      sc.player = {
        x: Math.min(Math.max(sc.ball.x + stance.x, vp.x1 + inset), vp.x2 - inset),
        y: Math.min(Math.max(sc.ball.y + stance.y, Math.max(vp.y1 + inset, 0.3)), vp.y2 - inset),
      };
      separateBodies(sc);
    }
    standBackForRunup(scenarioRef.current);

    // B14b: the ball came back into your run — the camera you were watching
    // stays (no re-frame, no cut). It eases wider only if you, the ball and
    // the goal would not all be in the picture (runCamera.ts widenToHold).
    const keepCam = keepRunCamRef.current && isTouchContinuation && newViewRef.current && !sceneRef.current?.ownFrame;
    keepRunCamRef.current = false;
    if (keepCam) {
      const sc = scenarioRef.current, cur = { ...baseViewportRef.current };
      const to = widenToHold(cur, [sc.player, sc.ball, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }]);
      // The play area always holds the picture (the engine's "out" line is never on the glass).
      sc.viewport = { x1: Math.min(sc.viewport.x1, to.x1), x2: Math.max(sc.viewport.x2, to.x2), y1: Math.min(sc.viewport.y1, to.y1), y2: Math.max(sc.viewport.y2, to.y2) };
      camEaseRef.current = to.x1 === cur.x1 && to.x2 === cur.x2 && to.y1 === cur.y1 && to.y2 === cur.y2 ? null : { from: cur, to, t: 0, zoom0: playZoomRef.current };
    } else {
      camEaseRef.current = null;
      frameScenario(scenarioRef.current);
    }
    ballRef.current = null;
    setAim(null);
    runupRef.current = null;
    setContactTimerS(null);
    setOutcome(null);
    dragRef.current = null;
    draggingRef.current = false;
    curveSwipeStartRef.current = null;
    // Orders belong to the situation they were given in. A fresh scenario is a
    // fresh set of team-mates in fresh positions, so anything the captain said
    // about the last one is meaningless — and carrying a stale Runner reference
    // across would point at a man who is no longer on the pitch.
    captainDragRef.current = null;
    resetCommitted();
    bumpOrders();
    trailRef.current = [];
    particlesRef.current = [];
    shakeRef.current.t = 0;
    flashRef.current.t = 0;
    feelRef.current.fx = []; feelRef.current.net = null; feelRef.current.struck = null; vfxFxRef.current = [];
    setPhase("aim");
    // The kind is final from here: the authored-shape overlay above changes
    // where the bodies are, never which chance this is.
    onChanceServedRef.current?.({
      kind: scenarioRef.current.kind,
      minute: matchMinuteRef.current,
      reason: request?.reason,
      scenario: snapshotScenario(scenarioRef.current),
    });
    // One line, once per chance — see logMoment. This is the single thing kept
    // from what used to be an unbroken flood of buildup commentary: the moment
    // the ball actually reaches a player of yours to do something with.
    logMoment(request?.lateCharge
      ? `Everyone's forward — it's launched into the box for ${playerLabel()}.`
      : momentLine(), "you");
    // Say where the chance came from before describing it, so it reads as the
    // end of a move rather than as a situation that appeared from nowhere.
    if (request) pushLine(request.reason);
    // Nobody is "on you" any more — the pitch is frozen until you strike it. A
    // heavy touch costs you the POSITION you strike from, so that is what it
    // says.
    if (heavyTouch > 0.55) pushLine("Heavy touch — it has got away from you.");
    // A touch-mode re-kick is not a new situation arriving from nowhere —
    // the BUILDUP lines describe exactly that ("Clean through!", "Bursts to
    // the byline…"), which reads as a second, contradictory scene-setting
    // moment stacked right on top of the "TOUCH ON" banner that already
    // fired for this exact spot a moment ago.
    if (isTouchContinuation) {
      pushLine("Still got it — looks up again.");
    } else {
      pushLine(commentaryBuildup(scenarioRef.current.kind, rngRef.current, targetName(scenarioRef.current)));
    }
    // A build-up before it (the `leadIn` prop without openOn: the career's,
    // lib/star/leadInGen.ts). Asked for every chance; null = none.
    if (carry) {
      // A pass in a no-goal picture found its man: the new picture is reached
      // from where everyone was, the camera following (playOn.ts).
      startLeadIn(undefined, (s) => carryOnLeadIn(s, carry));
    } else if (leadInPropRef.current && !openOnRef.current) {
      leadTriedRef.current = true;
      startLeadIn({
        opening: false,
        fresh: !attacking && !chain && !setPiece,
        lane: request?.lane, pattern: request?.pattern,
        seed: seedRef.current,
        us: careerRef.current?.player.club, them: fixture?.opponent,
        themStrength: oppStrengthRef.current,
        // B2b (Full highlights rebuild: On only — Off hands over exactly what
        // it always did): your side's strength (the match's own number), how
        // your side won the ball this move as the match had it, and whether
        // the offside law is on.
        ...(fhrOn() ? {
          usStrength: hiddenInputs().teamStrength,
          regain: request?.regain,
          offsideOff: careerRef.current ? ruleBookFor(careerRef.current, "FA").offsideAbolished : false,
        } : {}),
        frame: { ...baseViewportRef.current },
        // How big the moment is (a build-up runs longer late in a close final).
        minute: matchMinuteRef.current,
        scoreDiff: userScoreRef.current - oppScoreRef.current,
        stakes: stakesOf(fixture),
      });
    }
    playWhistle();
  };

  const restartSession = () => {
    sceneGenRef.current += 1;
    dribbleDealRef.current = null;
    attemptsRef.current = 0;
    tallyRef.current = { shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0, goalsPen: 0, goalsTap: 0, goalsOut: 0, passesSafe: 0, passesAmb: 0, missesOn: 0, missesPen: 0, misses1v1: 0 };
    chanceLogRef.current = [];
    userScoreRef.current = 0;
    oppScoreRef.current = 0;
    goalEventsRef.current = [];
    oppGoalEventsRef.current = [];
    cheekyMissesRef.current = [];
    matchMinuteRef.current = 0;
    setMatchMinute(0);
    energyRef.current = careerRef.current?.energy ?? 100;
    energyClockRef.current = 0;
    setLiveEnergy(energyRef.current);
    energyModeRef.current = "medium";
    setEnergyModeState("medium");
    playstyleRef.current = careerRef.current?.playstyle ?? playstyleRef.current;
    setPlaystyleState(playstyleRef.current);
    playstyleChangesRef.current = [];
    kibUsedRef.current = 0;
    setKibUsed(0);
    matchStateRef.current = newMatch(mulberry32(seedRef.current));
    radarTraceRef.current = new Map();
    simContinueRef.current = null;
    stretchRef.current = null;
    pendingRequestRef.current = null;
    dribbleRef.current = null;
    flickStartRef.current = null;
    hookedRef.current = null;
    hookedAtRef.current = null;
    chainRef.current = null;
    setStats({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0, goalsPen: 0, goalsTap: 0, goalsOut: 0, passesSafe: 0, passesAmb: 0, missesOn: 0, missesPen: 0, misses1v1: 0 });
    setFinalStats(null);
    setFeed([]);
    setLog([]);
    setQueue([]);
    setPause(null);
    halfTimeShownRef.current = false;
    loadScenario(false);
  };

  // --- Pointer (slingshot) ---
  //
  // Curve boots reported as "not really showing anything on PC": touch
  // already gets `touchAction: "none"` (the wrapper, above) to stop the
  // browser's own scroll/zoom gestures from competing with a drag, but
  // nothing stopped a MOUSE drag from doing what an ordinary mouse drag over
  // text/an image does — starting a native text-selection or image-drag
  // instead of just moving the pointer. That is far more disruptive to a
  // short, fast, lateral swipe (exactly what a curve correction is) than to
  // the longer, mostly-vertical aim drag, which is likely why this was
  // reported specifically against curving rather than every drag in the
  // game. `preventDefault` on pointerdown, plus `user-select: none` on the
  // wrapper above, stop both.
  // `dribbleOnly`: the opening chance is built at mount (see scenarioRef), so
  // swap it for a dribble run straight away; every later one is loadScenario's.
  useEffect(() => {
    if (!dribbleOnlyRef.current) return;
    const gen = sceneGenRef.current;
    const t = window.setTimeout(() => { if (sceneGenRef.current === gen && phaseRef.current === "aim") loadScenario(false); }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The top-down dribble on the stick (the `dribbleControl` prop). Left half:
   * a floating stick where your thumb lands (it follows the thumb past its
   * rim); a fast flick of it sideways knocks the ball past, as the swipe's
   * flick does. Right half: a tap on a team-mate passes, a sideways swipe
   * knocks it past. Several fingers at once, told apart by pointer id.
   */
  const tdStickInput = (kind: "down" | "move" | "up", e: React.PointerEvent) => {
    const run = tdRef.current, c = canvasRef.current;
    if (!run || !c) return;
    const rect = c.getBoundingClientRect();
    const rr = Math.min(rect.width, rect.height) * 0.13;
    const now = performance.now();
    if (kind === "down") {
      try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (tdReadyRef.current) { tdReadyRef.current = false; setTdReady(false); }
      const f = clientToCanvasFrac(e.clientX, e.clientY);
      if (f.sx < 0.5 && !tdStickRef.current) tdStickRef.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, fx: f.sx, fy: f.sy, vx: 0, vy: 0, hist: [] };
      else if (!tdTapRef.current) tdTapRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: now };
      return;
    }
    const st = tdStickRef.current;
    if (st && st.id === e.pointerId) {
      if (kind === "up") {
        tdStickRef.current = null;
        fpStick(run, 0, 0);
        try { c.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
        return;
      }
      let dx = (e.clientX - st.cx) / rr, dy = (e.clientY - st.cy) / rr;
      const m = Math.hypot(dx, dy);
      if (m > 1.35) {
        // Past the rim: the stick comes with the thumb.
        const k = (m - 1.35) / m;
        st.cx += (e.clientX - st.cx) * k; st.cy += (e.clientY - st.cy) * k;
        const f = clientToCanvasFrac(st.cx, st.cy); st.fx = f.sx; st.fy = f.sy;
        dx = (e.clientX - st.cx) / rr; dy = (e.clientY - st.cy) / rr;
      }
      const ml = Math.hypot(dx, dy);
      if (ml > 1) { dx /= ml; dy /= ml; }
      const wasRest = Math.hypot(st.vx, st.vy) < 0.08 && (run.fwd ?? 0) < 0.05;
      st.vx = dx; st.vy = dy;
      fpStick(run, dx, -dy);
      if (wasRest && Math.hypot(dx, dy) >= 0.08) tdLatRef.current = { t: now, x: run.x, y: run.y };
      st.hist.push({ vx: dx, t: now });
      while (st.hist.length > 1 && now - st.hist[0].t > 140) st.hist.shift();
      const o = st.hist[0];
      if (Math.abs(dx) >= 0.85 && Math.abs(dx - o.vx) >= 1.1 && run.phase === "running" && fpBurst(run, dx > 0 ? 1 : -1)) st.hist = [{ vx: dx, t: now }];
      return;
    }
    const tap = tdTapRef.current;
    if (tap && tap.id === e.pointerId && kind === "up") {
      tdTapRef.current = null;
      try { c.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (run.phase !== "running") return;
      const dx = e.clientX - tap.x, dy = e.clientY - tap.y, dt = now - tap.t;
      if (Math.hypot(dx, dy) < 14 && dt < 400) {
        const at = pitchFromPointer(tap.x, tap.y);
        const mi = run.mates.findIndex((m) => Math.hypot(m.x - at.x, m.y - at.y) < 3);
        if (mi >= 0) fpPass(run, mi, visionRef.current);
        return;
      }
      if (Math.abs(dx) >= 0.08 * rect.width && Math.abs(dx) > Math.abs(dy) && dt < 350) fpBurst(run, dx > 0 ? 1 : -1);
    }
  };
  /**
   * "After you pass: Joystick" (lib/star/afterPass.ts): while your pass plays
   * on, the left of the screen is a floating stick (where your thumb lands; it
   * follows the thumb past its rim). The push is turned into a pitch direction
   * through the match's own camera, so up the screen is wherever the picture
   * has up. Returns true when it used the pointer.
   */
  const poStickInput = (kind: "down" | "move" | "up", e: React.PointerEvent): boolean => {
    const po = playOnRef.current, c = canvasRef.current;
    if (!po?.stick || !c) { poStickUiRef.current = null; return false; }
    const rect = c.getBoundingClientRect();
    const rr = Math.min(rect.width, rect.height) * 0.13;
    if (kind === "down") {
      if (poStickUiRef.current) return false;
      const f = clientToCanvasFrac(e.clientX, e.clientY);
      if (f.sx >= 0.6) return false;
      try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      poStickUiRef.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, fx: f.sx, fy: f.sy, vx: 0, vy: 0 };
      po.stick.held = true;
      return true;
    }
    const st = poStickUiRef.current;
    if (!st || st.id !== e.pointerId) return false;
    if (kind === "up") {
      poStickUiRef.current = null;
      po.stick.held = false;   // thumb off: Auto run takes over after AUTO_AFTER_S
      steerPlayOn(po, 0, 0);
      try { c.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      return true;
    }
    let dx = (e.clientX - st.cx) / rr, dy = (e.clientY - st.cy) / rr;
    const m = Math.hypot(dx, dy);
    if (m > 1.35) {
      // Past the rim: the stick comes with the thumb.
      const k = (m - 1.35) / m;
      st.cx += (e.clientX - st.cx) * k; st.cy += (e.clientY - st.cy) * k;
      const f = clientToCanvasFrac(st.cx, st.cy); st.fx = f.sx; st.fy = f.sy;
      dx = (e.clientX - st.cx) / rr; dy = (e.clientY - st.cy) / rr;
    }
    const ml = Math.hypot(dx, dy);
    if (ml > 1) { dx /= ml; dy /= ml; }
    st.vx = dx; st.vy = dy;
    const a = pitchFromPointer(st.cx, st.cy), b = pitchFromPointer(st.cx + dx * rr, st.cy + dy * rr);
    const pvx = b.x - a.x, pvy = b.y - a.y, pl = Math.hypot(pvx, pvy);
    const mag = Math.min(1, Math.hypot(dx, dy));
    steerPlayOn(po, pl > 1e-6 ? (pvx / pl) * mag : 0, pl > 1e-6 ? (pvy / pl) * mag : 0);
    return true;
  };
  /**
   * B14: W A S D (or the arrows) steer your run, Shift sprints. Up the keys is
   * up the screen, turned into a pitch direction through the match's camera,
   * as the thumb stick is. Let go: Auto run takes over again (playOn.ts
   * AUTO_AFTER_S), on "Joystick" too while the thumb is off the stick.
   */
  const applyRunKeys = () => {
    const po = playOnRef.current, c = canvasRef.current;
    if (!po?.stick || !c) return;
    const k = keysRef.current;
    sprintPlayOn(po, k.sprint);
    const d = keysScreenDir(k);
    if (d.x === 0 && d.y === 0) {
      if (keysSteeringRef.current) { keysSteeringRef.current = false; if (!poStickUiRef.current) steerPlayOn(po, 0, 0); }
      return;
    }
    keysSteeringRef.current = true;
    const r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const a = pitchFromPointer(cx, cy), b = pitchFromPointer(cx + d.x * 40, cy + d.y * 40);
    const pvx = b.x - a.x, pvy = b.y - a.y, pl = Math.hypot(pvx, pvy);
    if (pl > 1e-6) steerPlayOn(po, (pvx / pl) * KEY_PUSH, (pvy / pl) * KEY_PUSH);
  };
  /** B14: after each substep of the run, sprinting's cost comes off your match energy, and the bar on screen follows (10 a second). */
  const noteRunStep = (po: PlayOn) => {
    const legs = po.stick?.legs;
    if (!legs) return;
    const spent = takeEnergySpent(legs);
    if (spent > 0 && !hookedRef.current && !farewellRef.current) {
      energyRef.current = clampEnergy(energyRef.current - spent);
    }
    const now = performance.now();
    if (now - stamUiAtRef.current > 100) {
      stamUiAtRef.current = now;
      setLegsEnergy(legs, liveEnergyAt(matchMinuteRef.current));
      setStamUi({ v: legs.stamina.v, cap: legs.cap, sprint: legs.sprinting, auto: !!po.stick?.autoOn });
      setLiveEnergy(energyRef.current);
    }
  };
  /** Captain's "Call for it" (playOn.ts callForIt). */
  const onCallForIt = () => {
    const po = playOnRef.current;
    if (!po?.stick || phaseRef.current !== "flight") return;
    const r = callForIt(po, scenarioRef.current);
    if (r === "late") flashCallMsg("Too late, he's shooting");
    else if (r === "coming") flashCallMsg("It's coming!");
    else { flashCallMsg("Calling for it!"); pushLine(`${playerLabel()} calls for it…`); }
  };
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    primeMatchSound();
    // A lead-in is being replayed: it is watched, not played. A build-up skips on a tap.
    if (leadRef.current) { if (leadRef.current.lead.skippable) skipLeadIn(); return; }
    // Somebody else's penalty (v0.15 items 6/7): you watch it, you don't take it.
    if (phaseRef.current === "aim" && autoKickOf(scenarioRef.current)) return;
    if (phaseRef.current === "tdDribble" && dribbleControlRef.current === "stick") { tdStickInput("down", e); return; }
    if (phaseRef.current === "tdDribble") {
      const run = tdRef.current;
      if (!run) return;
      try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      // Nobody moves until your first touch (the run waits for you).
      if (tdReadyRef.current) { tdReadyRef.current = false; setTdReady(false); return; }
      const now = performance.now();
      tdTouchRef.current = { x: e.clientX, y: e.clientY, t: now, anchorLane: run.laneTarget, anchorPitchX: pitchFromPointer(e.clientX, e.clientY).x, samples: [{ x: e.clientX, t: now }] };
      return;
    }
    if (phaseRef.current === "dribble") {
      flickStartRef.current = pitchFromPointer(e.clientX, e.clientY);
      try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (phaseRef.current === "flight" && playOnRef.current?.stick?.thumb && poStickInput("down", e)) return;
    if (phaseRef.current === "flight") {
      if (!canCurve) return;
      curveSwipeStartRef.current = { x: e.clientX, y: e.clientY };
      curveSwipeCurrentRef.current = { x: e.clientX, y: e.clientY };
      try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    // The run-up: on a penalty a sideways drag anywhere on the pitch swings
    // your aim along the goal line (penaltyRunup.ts, up to RUNUP.nudgeMaxM
    // either way). A free kick's run-up takes no input.
    if (phaseRef.current === "runup") {
      const ru = runupRef.current;
      if (!ru || ru.arrived || !ru.nudge) return;
      nudgeDragRef.current = { x0: e.clientX, y0: e.clientY, base: ru.nudgeM };
      try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (phaseRef.current !== "aim") return;
    if (windUpRef.current !== null) return; // winding up a power shot — the shot is already chosen
    const p = pitchFromPointer(e.clientX, e.clientY);
    const b = scenarioRef.current.ball;
    // ── A team-mate takes priority over the ball ──
    //
    // Reported directly: "most of the time I try and click on a player to
    // select him [and] the game thinks I'm tryna aim." The ball's own grab
    // radius below is deliberately generous — 28% of the framed pitch
    // height — and used to be checked FIRST, so any tap anywhere near a
    // supporting runner (who, in a cutback/through-ball, is normally
    // standing well within that same 28%) was swallowed as "start aiming"
    // before `captainPickAt`'s own, much smaller (9%) player hit-test ever
    // ran. Checking the player first fixes this outright: it already
    // returns null immediately for anyone who isn't the captain or whose
    // scenario doesn't accept orders (`acceptsCaptainOrders`), so this
    // changes nothing about when captaincy applies — only the PRIORITY
    // between "pick a man" and "grab the ball" once it does.
    const r = captainPickAt(p);
    if (r) {
      captainDragRef.current = { target: r, from: p, to: p };
      try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    // Grab radius scales with the camera so the ball is equally easy to pick up
    // whether the chance is framed tight or wide.
    const vp = viewportRef.current;
    const ballD = Math.hypot(p.x - b.x, p.y - b.y);
    // ── Still not the ball, even after missing captainPickAt's own radius ──
    //
    // The fix above only helps once a tap is close ENOUGH to a team-mate to
    // register. Reported directly, still: "very frequently when tryna set a
    // run or direct a pass it thinks im tryna aim a kick and starts the
    // kick." Root cause: captainPickAt's own hit radius (9% of the framed
    // pitch, floor 2.2m) is more than 3x smaller than the ball's grab radius
    // just below (28%) — so a tap that's clearly aimed at a nearby player,
    // but falls a little outside HIS radius, used to fall straight through
    // into the ball's much bigger one regardless. A tap that's genuinely
    // closer to a team-mate than to the ball never starts an aim-drag now,
    // even when it missed every hit-circle — better a missed order than an
    // accidental, badly-aimed kick.
    if (ballD >= nearestCaptainCandidateDist(p)) return;
    // The grab zone round the ball: BALL_GRAB_FRACTION of the framed height
    // (28% let a drag start from a third of the screen away — Mikey, 28 Sep
    // 2026: "you're supposed to be able to start dragging only from the
    // ball"; 10% put the thumb on top of the ball — Harry, 3 Oct 2026).
    // New view: the same share of the screen's HEIGHT whichever way the
    // pitch faces (side-on it used to be a share of the width, about 64 px
    // against 100 px top-down — playtest, 3 Oct 2026). Classic is unchanged.
    if (ballD > sameOnScreenM((vp.y2 - vp.y1) * BALL_GRAB_FRACTION, BALL_GRAB_FRACTION, "height")) {
      // Missed both a player and the ball — nothing happens, exactly as
      // before the armband existed.
      return;
    }
    draggingRef.current = true;
    // v0.15 item 21: measured from where the thumb landed, so the pull starts
    // at nothing wherever on the ball's grab zone it lands.
    thumbOriginRef.current = p;
    thumbOriginClientRef.current = { x: e.clientX, y: e.clientY };
    dragRef.current = { x: b.x, y: b.y };
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (poStickUiRef.current && poStickInput("move", e)) return;
    if (phaseRef.current === "tdDribble" && dribbleControlRef.current === "stick") { tdStickInput("move", e); return; }
    if (phaseRef.current === "tdDribble") {
      // Drag steers (your lane follows your thumb); a fast sideways flick knocks it past.
      const run = tdRef.current, tch = tdTouchRef.current, c = canvasRef.current;
      if (!run || !tch || !c) return;
      fpSteer(run, tch.anchorLane + (pitchFromPointer(e.clientX, e.clientY).x - tch.anchorPitchX));
      const now = performance.now();
      tch.samples.push({ x: e.clientX, t: now });
      while (tch.samples.length > 1 && now - tch.samples[0].t > 150) tch.samples.shift();
      const o = tch.samples[0], w = c.getBoundingClientRect().width;
      if (now - o.t > 20) {
        const vx = (e.clientX - o.x) / ((now - o.t) / 1000);
        if (Math.abs(vx) >= 1.6 * w && Math.abs(e.clientX - o.x) >= 0.06 * w && fpBurst(run, vx > 0 ? 1 : -1)) {
          tch.anchorLane = run.laneTarget;
          tch.anchorPitchX = pitchFromPointer(e.clientX, e.clientY).x;
          tch.samples = [{ x: e.clientX, t: now }];
          tch.t = -1e9; // a flick, not a tap or a step-over
        }
      }
      return;
    }
    if (phaseRef.current === "dribble") return;
    if (nudgeDragRef.current) {
      const ru = runupRef.current;
      const canvas = canvasRef.current;
      if (ru && !ru.arrived && canvas) {
        // Watched straight on ("up"), sideways on the screen is sideways along
        // the goal line. Watched side-on (Wide chances: New) the goal line runs
        // down the screen: "right" has pitch x going down, "left" going up.
        const vp = viewportRef.current;
        const f = facingRef.current;
        const along = f === "right" ? e.clientY - nudgeDragRef.current.y0
          : f === "left" ? nudgeDragRef.current.y0 - e.clientY
          : e.clientX - nudgeDragRef.current.x0;
        const m = nudgeFromDrag(along, canvasBox().width,
          // New view: the same finger nudges as far as it does in the classic frame.
          newViewRef.current ? engineFrameOf(scenarioRef.current).x2 - engineFrameOf(scenarioRef.current).x1 : vp.x2 - vp.x1);
        ru.nudgeM = Math.max(-RUNUP.nudgeMaxM, Math.min(RUNUP.nudgeMaxM, nudgeDragRef.current.base + m));
      }
      return;
    }
    if (curveSwipeStartRef.current) {
      curveSwipeCurrentRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (captainDragRef.current) {
      captainDragRef.current.to = pitchFromPointer(e.clientX, e.clientY);
      return;
    }
    if (!draggingRef.current) return;
    const pp = pitchFromPointer(e.clientX, e.clientY);
    const o = thumbOriginRef.current, bb = scenarioRef.current.ball;
    const oc = thumbOriginClientRef.current;
    if (tiltGeomRef.current && oc) {
      // Tilted: the finger's movement on the glass, laid off from the ball's
      // own spot on the glass (playtest: the pitch-space copy came out 5%
      // weaker than flat, because the thumb lands where the picture is bigger).
      const bc = pitchToClient(bb);
      dragRef.current = pitchFromPointer(bc.x + (e.clientX - oc.x), bc.y + (e.clientY - oc.y));
    } else {
      dragRef.current = o ? { x: bb.x + (pp.x - o.x), y: bb.y + (pp.y - o.y) } : pp;
    }
    // v0.15 item 22: past the dead zone, the aim is committed.
    if (aimCommitRef.current === null && phaseRef.current === "aim"
        && acceptsCaptainOrders(scenarioRef.current.kind) && screenPull(dragRef.current, bb) >= MIN_PULL) {
      commitAim();
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (poStickUiRef.current && poStickInput("up", e)) return;
    if (phaseRef.current === "tdDribble" && dribbleControlRef.current === "stick") { tdStickInput("up", e); return; }
    if (nudgeDragRef.current) {
      // The swing stays where you left it; another drag carries on from there.
      nudgeDragRef.current = null;
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (phaseRef.current === "tdDribble") {
      const run = tdRef.current, tch = tdTouchRef.current, c = canvasRef.current;
      tdTouchRef.current = null;
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (!run || !tch || !c || run.phase !== "running") return;
      const r = c.getBoundingClientRect();
      const g = classifyRelease(tch, { x: e.clientX, y: e.clientY, t: performance.now() }, r.width, r.left);
      if (g.kind === "shoulder") {
        // A tap on a team-mate plays the pass.
        const at = pitchFromPointer(tch.x, tch.y);
        const mi = run.mates.findIndex((m) => Math.hypot(m.x - at.x, m.y - at.y) < 3);
        if (mi >= 0) { fpPass(run, mi, visionRef.current); return; }
        if (!run.duels) { fpSteer(run, run.laneTarget + 1.8 * g.side); return; }
      }
      if (g.kind !== "none" && run.duels) fpFeint(run, g.kind, g.side);
      return;
    }
    // A flick is a direction and nothing else. Short taps are ignored so a
    // mis-touch cannot send the run sideways.
    if (phaseRef.current === "dribble") {
      const from = flickStartRef.current;
      flickStartRef.current = null;
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      const d = dribbleRef.current;
      if (!from || !d) return;
      const to = pitchFromPointer(e.clientX, e.clientY);
      const dx = to.x - from.x, dy = to.y - from.y;
      if (Math.hypot(dx, dy) < 1.2) return;
      flick(d, dx, dy);
      return;
    }
    if (phaseRef.current === "flight") {
      const from = curveSwipeStartRef.current;
      curveSwipeStartRef.current = null;
      curveSwipeCurrentRef.current = null;
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (!from || !canCurve || !ballRef.current) return;
      const rawDx = e.clientX - from.x, rawDy = e.clientY - from.y;
      if (Math.hypot(rawDx, rawDy) < CURVE_SWIPE_MIN_PX) return;
      // Reported directly: the curve direction "changes depending on the
      // camera" — a crossing situation watches from the side (`toPx`'s own
      // "quarter turn"), which swaps which SCREEN axis is actually pitch-
      // lateral. Reading raw screen dx as "left/right" only matched pitch-
      // left/right by coincidence, in whichever facing happened to be
      // active when the shot was framed. Rotate the swipe into the same
      // pitch-lateral axis `toPx`/`pitchFromPointer` already use, so
      // "toward pitch-right" always means the same thing regardless of
      // which way the camera is currently turned.
      const f = facingRef.current;
      const lateral = f === "right" ? rawDy : f === "left" ? -rawDy : rawDx;
      const other = f === "up" ? rawDy : rawDx;
      const dir = curveDirFromSwipe(lateral, other);
      if (dir) applyCurveSwipe(ballRef.current, dir);
      return;
    }
    // ── The captain's gesture, settled ──
    //
    // One touch, two orders, told apart by how far it travelled. A tap is a
    // choice ("him") and a drag is a direction ("there") — the same distinction
    // a manager's hand makes on a touchline, and it means neither ability needs
    // a mode button taking up room on a phone screen.
    if (captainDragRef.current) {
      const { target, from, to } = captainDragRef.current;
      captainDragRef.current = null;
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      const sc = scenarioRef.current;
      const isTap = Math.hypot(to.x - from.x, to.y - from.y) < CAPTAIN_DRAG_MIN;
      if (target === "follower") {
        if (isTap) {
          // A tap: he is the man it gets laid off to, or he no longer is —
          // his own version of relayTo, see relayToFollower.
          sc.relayToFollower = !sc.relayToFollower;
          if (sc.relayToFollower) sc.relayTo = null;
        } else {
          sc.follower.commandedTo = { x: to.x, y: to.y };
        }
      } else {
        if (isTap) {
          // A tap: he is the man it gets laid off to, or he no longer is.
          sc.relayTo = sc.relayTo === target ? null : target;
          if (sc.relayTo) sc.relayToFollower = false;
        } else {
          // A drag: he runs that way, as far as you pulled, starting the moment
          // you play the ball. Dragging from a man you had picked out for the
          // lay-off does not take that order away — the two compose, and a man
          // running onto it is played in front of. See launchReceiverPass.
          target.commandedTo = { x: to.x, y: to.y };
        }
      }
      bumpOrders();
      return;
    }
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    dragRef.current = null;
    thumbOriginRef.current = null;
    if (!d) return;
    const b = scenarioRef.current.ball;
    const power = powerFromDrag(d, b);
    // v0.15 item 22: once committed there is no taking it back —
    // letting go without a kick, even back on the ball, loses the chance.
    if (aimCommitRef.current !== null && (screenPull(d, b) < MIN_PULL || power < 0.02)) {
      loseChance("letgo");
      return;
    }
    // ── Two floors, and the second one is not redundant ──
    //
    // A shot has to be worth taking, AND the gesture has to have been a gesture.
    // Shortening the full-power pull shortened everything proportionally, so
    // 12% power went from a 26-pixel drag to a 13-pixel one — inside the slop of
    // a thumb pressing the ball and slipping. The absolute floor keeps the
    // dead zone the size it has always been on the glass.
    if (screenPull(d, b) < MIN_PULL) return;
    // Production's old 0.12 floor is what made a real drag feel like it
    // needed ~20% power just to register as a kick at all — reported
    // directly. Any pull past the absolute pixel floor above now counts.
    if (power < 0.02) return;
    const dir = { x: b.x - d.x, y: b.y - d.y };
    // A penalty or a direct free kick: you jog to the ball first, and the
    // strike screen opens when you get there (lib/star/penaltyRunup.ts).
    if (hasRunup(scenarioRef.current.kind)) {
      startRunup(dir, power);
      return;
    }
    setAim({ dir, power });
    // An armed power shot winds up first (shotModel.ts): the pitch keeps
    // moving for POWER_SHOT_WINDUP_S, then the green-circle screen opens.
    if (powerArmedRef.current && knucklePowerOn() && aimedAtGoal(scenarioRef.current, dir)) {
      setPowerStrike(true);
      setPowerArmed(false);
      windUpRef.current = POWER_SHOT_WINDUP_S;
      setWindingUp(true);
      pushLine("He pulls the leg right back…");
      return;
    }
    setPowerStrike(false);
    setPhase("contact");
  };

  /**
   * THE RUN-UP BEGINS — you let go of the aim on a penalty or a direct free
   * kick. The loop below walks you to the ball; on a penalty the keeper
   * brain may hop on the way (brainRunUp — his own seeded stream, so the
   * match's random stream is exactly what it was); the strike screen opens
   * when you arrive, with its 1-second countdown.
   */
  const startRunup = (
    rawDir: { x: number; y: number }, power: number,
    auto?: { contact: { cx: number; cy: number }; skills: KickSkills },
  ) => {
    const sc = scenarioRef.current;
    const L = Math.hypot(rawDir.x, rawDir.y) || 1;
    const dir0 = { x: rawDir.x / L, y: rawDir.y / L };
    const styleId = runupStyleFor(sc);
    const styled = planRunup(styleId, sc.ball, sc.player);
    runupRef.current = {
      t: 0, dir0, power, nudgeM: 0,
      path: { from: { x: sc.player.x, y: sc.player.y }, to: plantBeside(sc.ball, sc.player) },
      nudge: !auto && canNudge(sc.kind), arrived: false,
      styled, runS: RUNUP_MOTION[styleId].runS,
      ...(auto ? { auto } : {}),
    };
    if (auto) { setPhase("runup"); return; }
    nudgeDragRef.current = null;
    setAim({ dir: dir0, power });
    setPhase("runup");
    tryHold("runup");
    pushLine("He runs up…");
    // The strike screen at the end of this jog has a countdown, so all of it
    // must be on screen when it opens. Measured on a 390x664 phone: the real
    // match left the bottom 44% of that ball below the fold (551-753 px of
    // 664). The scroll happens NOW, while nothing is timed: done as the
    // strike screen opened, the page froze for ~0.27 s in a recording and
    // the countdown ran on underneath (its ring was a quarter gone on the
    // first frame anyone could see).
    requestAnimationFrame(() => revealOnScreen(wrapRef.current, { smooth: false }));
  };

  // --- Contact chosen -> launch ---
  //
  // `over` replaces the aim for a kick you didn't drag yourself:
  //   - the run-up's timed-out kick (handleScuff below): the scuff's
  //     direction and power, struck with your skills;
  //   - an automatic kick (v0.15 items 6/7): the match strikes it for a
  //     team-mate or an opponent with HIS aim and HIS skills (`skills`) —
  //     the SAME strike as yours from here on.
  const handleContact = (
    tapped: { cx: number; cy: number; lift?: number },
    over?: { dir: { x: number; y: number }; power: number; skills?: KickSkills },
    extras?: ShotExtras,
  ) => {
    const a = over ? { dir: over.dir, power: over.power } : aim;
    if (!a) return;
    // Struck while the men were still running after the hand-over (phase 3):
    // each carries his speed into the play. Before the replay snapshot, so a
    // goal replay throws the same runs. Nobody running: nothing happens.
    handOverRunOn();
    // A ball you hit in the air (airborne test switch): a header or a volley,
    // started from the height it was at. Kept on the contact so a replay does the same.
    // B10: a header or volley chance is always struck this way (where you met
    // it and when count: airContactRead), switch or no switch.
    let contact: StrikeContact = { cx: tapped.cx, cy: tapped.cy };
    if (!over && tapped.lift !== undefined && (airborneOn() || isAirKind(scenarioRef.current.kind))) {
      const m = strikeMotion(scenarioRef.current.kind, seedRef.current);
      if (m === "float" || m === "bounce") contact = { ...contact, air: { kind: m === "float" ? "header" : "volley", lift: tapped.lift, cx: tapped.cx, cy: tapped.cy } };
    }
    const auto = over?.skills ? { skills: over.skills } : null;
    setContactTimerS(null);
    // A dead ball is struck with your free-kick rating, not your general
    // technique — the one strike in football that is purely placement and curl.
    const tired = tiredSkills();
    // v0.26: the free-kick rating tires like power and technique do.
    const fkRaw = careerRef.current?.skills.freeKick ?? setPieceSkillRef.current;
    const strikeWith = auto ? auto.skills : setPieceSkills(
      tired,
      fkRaw === undefined ? tired.technique : fkRaw * (1 - fatigueCut(liveEnergyAt(matchMinuteRef.current))),
      scenarioRef.current.kind,
    );
    // ── Shot power: the top is flattened (v0.15, item 11b) ── the ball is
    // struck with the curve's power (lib/star/strikePower.ts): the same number
    // up to 80, much less added above it. The drag was already read off your
    // real power (powerFromDrag), so it feels exactly the same. The Play
    // Area's compare switch "Shot power" puts the old straight line back on
    // one device's test screens (never the real game).
    // Oct 13 "Shot power (testing)" (lib/star/shotFeel.ts): a strike at goal
    // is struck with the lower curve instead, and keeps less of its rise.
    const feelPow = !auto && shotPowerOn() && struckAtGoal(scenarioRef.current, a.dir, contact.cx);
    const launchWith = feelPow
      ? { ...strikeWith, power: feelPower(strikeWith.power) }
      : switchOn("powerCurve")
      ? { ...strikeWith, power: strikingPower(strikeWith.power) }
      : strikeWith;
    // Your Aerial & Acrobatics (tired legs count) softens a mis-hit header or
    // volley; technique stays as the fallback (kept on the strike for the replay).
    // A drill or test screen without a career may hand Aerial in on `skills` (the Head & Volley drill).
    const skillAerial = (skills as KickSkills & { aerial?: number }).aerial;
    if (contact.air) contact = { ...contact, air: { ...contact.air, tech: launchWith.technique, aerial: career ? Math.round(aerialOf(career.skills) * (1 - fatigueCut(liveEnergyAt(matchMinuteRef.current)))) : skillAerial } };
    // Snapshot everything a replay would need to reproduce this exact strike
    // — see GoalReplay and rngCallCountRef. Cheap and thrown away unless the
    // ball actually ends up in the net (resolveOutcome), so this costs
    // nothing on the far more common outcome of a shot that doesn't score.
    // `skills` is what the ball was struck WITH, so a goal replays at the
    // pace it was scored at. Never for somebody else's kick: it is not a
    // goal of yours to save.
    // ── Shots (lib/star/shotModel.ts; Settings → Gameplay "Shots" and
    // "Knuckleball & power shot") ── only ever your own kick. Both Old: the
    // plain `launch` below, exactly as before.
    const shotPro = !auto && shotsPro();
    const shotKnuckle = !auto && knucklePowerOn();
    // Oct 13: the contact field and the power curve's rise ride the same record.
    const shotField = !auto && contactFieldOn();
    const shotLift = feelPow ? feelLift(strikeWith.power) : 1;
    const shotRec = (shotPro || shotKnuckle || extras || shotField || shotLift !== 1)
      ? { seed: shotSeedFor(seedRef.current, rngCallCountRef.current), extras, pro: shotPro, knuckle: shotKnuckle, field: shotField, lift: shotLift }
      : null;
    pendingReplayRef.current = auto ? null : {
      seed: seedRef.current,
      callsBeforeStrike: rngCallCountRef.current,
      scenario: JSON.parse(JSON.stringify(scenarioRef.current)),
      dir: a.dir,
      power: a.power,
      contact,
      skills: launchWith,
      ...(shotRec ? { shot: shotRec } : {}),
    };
    // Starts recording this strike's own substep sizes — see
    // GoalReplay.flightDtLog. Reset here, alongside pendingReplayRef, so a
    // follow-up strike on a loose ball starts its own log rather than
    // carrying over the shot that came before it.
    flightDtLogRef.current = [];
    physAccRef.current = 0;
    deflectionsRef.current = 0;
    matePlaysRef.current = [];
    // Where you struck it, for the kind of goal it was (ratings revamp, lib/star/chanceRating.ts).
    strikeAtRef.current = { x: scenarioRef.current.ball.x, y: scenarioRef.current.ball.y };
    let shotRead: ContactRead | undefined;
    if (shotRec) {
      const st = launchShot(scenarioRef.current, a.dir, a.power, contact, launchWith, rngRef.current, shotRec, shotRec, launch);
      ballRef.current = st.ball;
      shotRead = st.read;
    } else {
      ballRef.current = launch(scenarioRef.current, a.dir, a.power, contact, launchWith, rngRef.current);
    }
    applyAirborne(ballRef.current, scenarioRef.current, contact.air);
    // ── The keeper brain sees you strike it ── its own seeded stream (built
    // the way the penalty read's is), and a snapshot of him as he stands, so
    // a goal replay throws exactly the same dive. For a penalty the brain
    // throws the dive the penalty rule set decides (penaltyKeeper.ts), so the
    // plain read below is only for a chance with no brain.
    if (hasBrain(scenarioRef.current)) {
      const bs = ((seedRef.current ^ Math.imul(rngCallCountRef.current + 1, 0xc2b2ae35)) ^ 0x4b7f ^ (keeperSaltRef.current ?? 0)) >>> 0;
      if (pendingReplayRef.current) pendingReplayRef.current.keeperBrain = brainSnapshot(scenarioRef.current, bs);
      brainStrike(scenarioRef.current, ballRef.current, bs);
    } else
    // ── A penalty keeper reads your kick (Harry, 24 Sep 2026) ──
    // He stood still until now; at the strike he decides whether to go and
    // which way, from where you aimed. Its own seeded draw — not rngRef — so
    // the match's own random stream is exactly what it was, and the decision
    // is saved with the replay. See lib/star/penaltyKeeper.ts.
    if (scenarioRef.current.kind === "penalty") {
      // The keeper facing THIS kick: an automatic kick names him (their keeper
      // for your team-mate, yours for their taker); otherwise the match's.
      const facing = autoKickOf(scenarioRef.current)?.keeper?.strength ?? strengthRef.current;
      const read = penaltyReadFor(facing, penaltyReadRef.current);
      const r = mulberry32(((seedRef.current ^ Math.imul(rngCallCountRef.current + 1, 0x9e3779b1)) ^ 0x5eed ^ (keeperSaltRef.current ?? 0)) >>> 0);
      const decision = decidePenaltyRead(scenarioRef.current, ballRef.current, read, [r(), r()]);
      applyPenaltyRead(scenarioRef.current, decision);
      if (pendingReplayRef.current) pendingReplayRef.current.penaltyRead = decision;
    }
    // The run-up (penaltyRunup.ts) is over: the keeper's hop, if he took one,
    // was the brain's (brainRunUp) and rides into the strike above.
    runupRef.current = null;
    // Item 5r: was this a "cheeky" kick — a penalty chipped or driven down
    // the middle, or a chip at goal in open play? Judged off the ball as
    // struck; resolveOutcome decides whether it went in. Only ever yours —
    // never a team-mate's or an opponent's kick you are watching.
    cheekyStrikeRef.current = auto ? null : cheekyStrike(
      scenarioRef.current.kind, ballRef.current,
      (scenarioRef.current.goal.x1 + scenarioRef.current.goal.x2) / 2, ballRef.current.youStruckAtGoal === true,
    );
    // ── The kind's strike rules (lib/star/kindRules) ── e.g. who wins the
    // first contact at a corner. Its own seeded draw, like the penalty read,
    // and saved with the replay.
    {
      const r = mulberry32(((seedRef.current ^ Math.imul(rngCallCountRef.current + 1, 0x85ebca6b)) ^ 0x6b1d) >>> 0);
      const kd = strikeKind(scenarioRef.current, ballRef.current, r, {
        keeperStrength: strengthRef.current, setPieceSkill: setPieceSkillRef.current,
        power: strikeWith.power, technique: strikeWith.technique,
      });
      strikeRuleRef.current = kd;
      if (pendingReplayRef.current && kd) pendingReplayRef.current.kindStrike = kd;
    }
    // ── Touch Mode's real "instant catch" bug ──
    //
    // Reported live: "most times he gets it immediately, bad. probs to do
    // with the side the user kicks it (if ball on left then kick to left
    // is mostly fine but kick to right (towards user) means instant touch
    // and stop)." Root cause: every scenario builder plants scenario.player
    // 0.8-2.0m off from scenario.ball as a natural stand-off stance (e.g.
    // buildOneOnOne's own `player: {x: bx, y: by + 1.2}`) — never
    // gameplay-significant before touch mode existed, since nothing before
    // it ever read that gap for anything but drawing your figure. But that
    // is exactly the gap stepTouchChase measures separation from, and it
    // sits right on top of TOUCH_CHASE_START_R (1.3m) and
    // TOUCH_CHASE_CATCH_R (1.15m) — a kick that happened to widen the
    // pre-existing gap blew straight past "armed" within the very first
    // substep, sometimes already inside catch range before the ball had
    // gone anywhere, which is exactly "instant". A kick the other way,
    // which shrank or ran roughly parallel to that same stand-off gap
    // first, read as the genuinely fine, believable delay round 3 was
    // built for — same mechanism, opposite-looking result, which is why it
    // read as direction-dependent rather than as one bug.
    //
    // The instant your boot is actually on the ball you are standing where
    // it is, not wherever you happened to be lining it up from — so the fix
    // is to make that true, the moment it's struck, whenever Touch Mode
    // could possibly matter for this kick. Scoped to that case alone
    // (rather than always) so a player without the boots equipped sees no
    // behaviour change at all: `scenario.player` still drives real AI
    // reactions elsewhere in the engine during flight (initDefenders,
    // stepReactions), and only Touch Mode's own kicks should ever see it
    // move before it's actually kicked toward.
    if (touchModeOnRef.current && canExtraTouch && !auto) {
      scenarioRef.current.player = { x: ballRef.current.pos.x, y: ballRef.current.pos.y };
    }
    // ── B14 THE RUN: your pass plays on (lib/star/playOn.ts startPlayOnRun) ──
    // Any pass in open play with a goal in the picture (not a shot, not a set
    // piece) is one move, whatever the Chances setting: you run on (Auto run,
    // or W A S D + Shift on a computer, or the thumb stick on "After you pass:
    // Joystick"), the man who takes it shoots or plays it back to you, and
    // nothing cuts until the move is over. Its own seeded stream, so the
    // match's is unchanged.
    playOnRef.current = null;
    playOnCaughtRef.current = false;
    setRunLive(false);
    {
      const sc = scenarioRef.current;
      // The joystick's calmer tempo (playOn.ts stickReception) belongs to one
      // pass; startPlayOnRun below sets it again when this kick earns it.
      delete sc.matePace;
      const touchOn = touchModeOnRef.current && canExtraTouch;
      if (!touchOn && !shootoutKickRef.current && runAfterWanted({
        kind: sc.kind, youShotAtGoal: ballRef.current.youStruckAtGoal === true, auto: !!auto,
      })) {
        playOnRngRef.current = mulberry32(((seedRef.current ^ Math.imul(rngCallCountRef.current + 1, 0x9e3779b1)) ^ 0x61a7) >>> 0);
        const bl = ballRef.current;
        const stick = afterPassStickOn();
        // B20 (Harry, 21 Oct 2026: "your player runs after the ball while it's
        // being kicked whilst being in position"): you stay on the spot you were
        // standing on (youSpot.ts puts you beside the ball, ~1.4-1.6 m off it);
        // this used to snap you onto the ball's spot at the kick, a 1.5 m jump
        // after the ball, and the run then started at once. Now you finish the
        // kick where you are (PlayOnStick.kicking) and run from there, the
        // same spot a shot is struck from.
        const car = careerRef.current;
        playOnRef.current = startPlayOnRun(sc, playOnRngRef.current, { x: bl.pos.x + bl.vel.x * 0.8, y: bl.pos.y + bl.vel.y * 0.8 }, {
          stick, pace: car?.skills.pace, energy: liveEnergyAt(matchMinuteRef.current), bar: barRef.current,
        });
        poStickUiRef.current = null;
        keysSteeringRef.current = false;
        setStickLive(stick);
        setRunLive(true);
      }
    }
    setPhase("flight");
    // A header scenario can be lost in the air before your header ever
    // happens — see canvasEngine.ts's applyAerialContest: if the marker
    // rises above you, YOUR intended header is overridden entirely into
    // his clearance, sent back up the pitch instead of goalward. Real,
    // deliberate football (you can lose a header duel), reported as "the
    // ball just goes backwards" because nothing on screen ever said why —
    // it looked identical to your own header commentary firing, then the
    // ball inexplicably reversing. `launch()` already leaves the tell
    // (`lastTouch === "defence"`) — naming it here is the fix, not the
    // physics, which were already doing the right thing.
    if (scenarioRef.current.kind === "header" && ballRef.current.lastTouch === "defence") {
      pushLine("He gets up highest and heads it clear!");
    } else if (shotRead && SHOT_LINES[shotRead.grade]) {
      // How it came off the boot (Shots: New), said instead of the usual line.
      pushLine(SHOT_LINES[shotRead.grade]!);
      if (shotRead.grade === "knuckle") showAction("KNUCKLEBALL");
    } else {
      pushLine(commentaryStrike(scenarioRef.current.kind, rngRef.current, targetName(scenarioRef.current)));
    }
    if (extras?.powerMult) showAction(`⚡ x${extras.powerMult.toFixed(2)}`);
    // ── Match feel: New (lib/star/matchFeel.ts) ── read off the ball as it
    // left the boot (its real speed) and how cleanly it was hit; the ball is
    // only read here, never changed. A wind-up, then the contact lands (flash,
    // squash, punch, sound, buzz) and the picture holds a beat before the
    // flight starts. Old: the plain kick sound, as before.
    // The lab (vfxOverride): your kick, at the boot.
    if (vfxRef.current) {
      const bl = ballRef.current;
      const speed = Math.hypot(bl.vel.x, bl.vel.y, bl.vz);
      const ev: VfxEvent = scenarioRef.current.kind === "header" ? "header" : speed < 16 ? "pass" : "strike";
      vfxEmit(ev, bl.pos.x, bl.pos.y, bl.z, bl.vel.x, bl.vel.y, Math.min(1, speed / 27));
    }
    if (matchFeelOn()) {
      const bl = ballRef.current;
      const D = feelDials();
      const speed = Math.hypot(bl.vel.x, bl.vel.y, bl.vz);
      const grade = shotRead?.grade ?? gradeContact(contact, a.power, false).grade;
      // A header or volley gets its own beat, freeze, punch and sound (matchFeel AirFeel).
      const f = strikeFeel(speed, grade, D, contact.air?.kind);
      const fl = feelRef.current;
      fl.pending = { f, x: bl.pos.x, y: bl.pos.y, z: bl.z, vx: bl.vel.x, vy: bl.vel.y };
      fl.windUp = f.windUpS;
      fl.windUpTotal = f.windUpS;
      fl.hitStop = f.windUpS + f.hitStopS;
      fl.followRate = 1.2 - 0.5 * f.power;
      fl.prev = null;
      fl.net = null;
      if (!(fl.hitStop > 0)) { fl.hitStop = 0; feelLandStrike(); }
    } else {
      playKick();
    }
    kickPoseRef.current = KICK_POSE_S;
  };
  handleContactRef.current = handleContact;

  /**
   * The strike screen's countdown ran out (the run-up): the kick happens
   * without you, and it's a scuff — under a third of the power, up to 18°
   * off your line, struck on the top half of the ball (penaltyRunup.ts's
   * scuffStrike; measured in tests/star/penaltyRunup.mts). The same
   * launch() as any kick. Its own seeded draw, so the match's random stream
   * is untouched.
   */
  const handleScuff = () => {
    if (!aim) return;
    const r = mulberry32(((seedRef.current ^ Math.imul(rngCallCountRef.current + 1, 0x27d4eb2d)) ^ 0x5c0f) >>> 0);
    const s = scuffStrike(aim.dir, aim.power, r);
    showAction("SCUFFED");
    handleContact(s.contact, { dir: s.dir, power: s.power });
  };

  const scenarioLabel = SCENARIO_LABEL[scenarioRef.current.kind];

  // Match-mode scoreboard (user's club vs opponent, mapped to home/away)
  const usName = realGoal?.us.name ?? career?.player.club ?? "You";
  const themName = realGoal?.them.name ?? fixture?.opponent ?? "";
  const homeTeam = matchMode ? (fixture!.home ? usName : themName) : "";
  const awayTeam = matchMode ? (fixture!.home ? themName : usName) : "";
  const homeScore = matchMode ? (fixture!.home ? displayScore.user : displayScore.opp) : 0;
  const awayScore = matchMode ? (fixture!.home ? displayScore.opp : displayScore.user) : 0;

  // Labels drop to 9px under 390px wide: at 11px on a 360px phone
  // "ASSISTS" ran into "PASS" and "AVG RAT" into the 3D/2D pill.
  const statCell = (label: string, value: string, valueClass: string) => (
    <div className="min-w-0 px-1 py-1 text-center">
      <div className="whitespace-nowrap text-[11px] max-[389px]:text-[9px] uppercase tracking-tight text-white font-bold leading-none">{label}</div>
      <div className={`text-xs font-black tabular-nums leading-tight ${valueClass}`}>{value}</div>
    </div>
  );

  const passPct = stats.passes > 0 ? Math.round((stats.passesCompleted / stats.passes) * 100) : 0;

  // A crisp black outline around white club-name text, so it stays legible
  // over a light kit (Fulham/Leeds white, a bright yellow away strip) the
  // same way a plain white-on-white would not.
  const NAME_OUTLINE = {
    textShadow: "-1px -1px 1.5px #000, 1px -1px 1.5px #000, -1px 1px 1.5px #000, 1px 1px 1.5px #000",
  };

  // The big banner words fit the pitch they are on: on the phone's Kickabout
  // pitch (~226 px) a 48 px "DEFLECTED" ran off both edges. Only ever shrinks —
  // a word that already fits keeps its size (useFitWidth.ts).
  useFitWidth(actionBannerTextRef, actionBanner);
  // The Arcade banner never carries over onto a new screen: half time, full
  // time (both a `pause`), the scores sheet, the end of the match. It fades out
  // fast instead (ArcadeBanner.tsx cut). A cut to the commentary is not one.
  useEffect(() => {
    if (pause || scoresOpen || phase === "postmatch" || phase === "shootout") { arcade.cut(); mikey.cut(); }
  }, [pause, scoresOpen, phase, arcade.item?.id, mikey.item?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useFitWidth(offsideBannerTextRef, phase === "result" && outcome === "offside");

  // ── The sandbox's live commentary and the situation hint ──
  // Classic: two rows under the pitch. New view: the pitch fills the phone,
  // so they sit ON it as compact translucent strips — at the bottom, or at
  // the top when the ball is down at the bottom (a corner). Never shown in a
  // real match (see below), only while learning the game.
  const commentaryBox = (overlay: boolean) => (
    <div className={overlay
      ? `rounded-lg bg-gray-950/55 px-2.5 py-1.5 backdrop-blur-[2px] ${phase === "feed" ? "hidden" : ""}`
      : `mt-2 rounded-lg border border-gray-800 bg-gray-950/85 px-3 py-2 min-h-[3.8rem] ${phase === "feed" ? "hidden" : ""}`}>
      <div className={`flex items-center gap-1.5 ${overlay ? "mb-0.5" : "mb-1"}`}>
        <span className="kib-live inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="text-[8px] font-black tracking-[0.22em] text-white/70 uppercase">Live Commentary</span>
      </div>
      <div className="space-y-0.5">
        {feed.length === 0 && <div className="text-[11px] text-white/65 italic">Kick-off…</div>}
        {(overlay ? feed.slice(-2) : feed).map((line, i, arr) => (
          <div
            key={i}
            className={`text-[11px] leading-snug pl-2 border-l-2 ${
              i === arr.length - 1 ? "text-white font-bold border-emerald-500/80" : "text-white/70 border-transparent"
            }`}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
  const hintBox = (overlay: boolean) => (
    <div className={overlay
      ? "rounded-lg bg-gray-950/55 px-2.5 py-1 text-[10px] text-white/90 text-center backdrop-blur-[2px]"
      : "mt-2 bg-gray-900/70 border border-gray-800 rounded-lg px-3 py-2 text-[10px] text-white/85 text-center"}>
      <span className="text-amber-300">💡</span> {scenarioLabel.hint}
    </div>
  );

  return (
    <div ref={rootRef} className="w-full max-w-sm mx-auto">
      {/* Local keyframes; disabled wholesale under prefers-reduced-motion */}
      <style>{`
        @keyframes kibPop { 0% { transform: scale(0.55); opacity: 0; } 60% { transform: scale(1.07); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes kibLive { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .kib-pop { animation: kibPop 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.35) both; }
        .kib-live { animation: kibLive 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .kib-pop, .kib-live { animation: none; }
        }
      `}</style>

      {/* Live match scoreboard (career mode only) */}
      {matchMode && (
        <div className="mb-2 flex items-center justify-between gap-1">
          <div
            className="flex-1 rounded-l-lg border px-2 py-1.5 text-white font-black text-xs truncate"
            style={{ backgroundColor: kitsRef.current.home.shirt, borderColor: kitsRef.current.home.trim, ...NAME_OUTLINE }}
          >
            {shortClub(homeTeam).toUpperCase()}
          </div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow tabular-nums">{homeScore}</div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow tabular-nums">{awayScore}</div>
          <div
            className="flex-1 rounded-r-lg border px-2 py-1.5 text-white font-black text-xs truncate text-right"
            style={{ backgroundColor: kitsRef.current.away.shirt, borderColor: kitsRef.current.away.trim, ...NAME_OUTLINE }}
          >
            {shortClub(awayTeam).toUpperCase()}
          </div>
        </div>
      )}

      {/* The farewell: you have come off, and the whole ground stands. */}
      {ovationShown && (
        <div
          data-farewell-ovation
          className="kib-pop mb-2 px-3 py-2 text-center"
          style={{ background: "linear-gradient(90deg, rgba(251,191,36,.28), rgba(251,191,36,.10))", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.6)", borderRadius: 4 }}
        >
          <div className="text-[19px] font-black uppercase leading-none tracking-wide text-amber-200">👏 Standing ovation 👏</div>
          <div className="mt-1 text-[12.5px] font-bold leading-snug text-white">{ovation}&apos; — you come off. The whole ground is on its feet for you.</div>
        </div>
      )}

      {/* Scoreboard plate. Hidden in `bare` — see the prop. */}
      {!bare && (
      <div className="mb-2 rounded-lg overflow-hidden border border-emerald-800/70 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 shadow-lg">
        <div className="flex items-stretch">
          <div className="px-2.5 flex items-center border-r border-white/5 text-[11px] font-black uppercase tracking-[0.08em] text-emerald-300/90">
            {matchMode && career ? (farewell ? "Farewell" : realGoal?.badge ?? competitionAbbrev(fixture!, divisionOf(career))) : "Match Lab"}
          </div>
          <div className="flex-1 grid grid-cols-4 divide-x divide-white/5">
            {statCell("Goals", `${stats.goals}`, "text-amber-300")}
            {statCell("Assists", `${stats.assists}`, "text-emerald-300")}
            {statCell("Pass", `${passPct}%`, "text-violet-300")}
            {statCell("Avg Rat", regressForMinutes(
              // Item 26: the same formula the post-match screen uses (the old
              // box counted only lost dribbles as waste, the final counted
              // every chance — two different numbers for one match).
              ratingSoFar(stats, displayScore.user, displayScore.opp),
              Math.max(1, matchMinute - enteredAtRef.current),
              // Reported directly: this on-screen number used to jump the
              // moment the match ended, because only the FINAL rating
              // applied the cameo-minutes regression below — the live
              // widget called liveRating() raw. Now both read the exact
              // same formula, so the number at full time IS the number on
              // the stats screen, not a preview that gets recalculated.
            ).toFixed(1), "text-sky-300")}
          </div>
          {/* Players' look, 3D or Classic, flipped mid-match. Hidden when the
              new view draws the baked 3D players, which it does not change. */}
          {!(newViewRef.current && playersLook === "3d") && (
          <div className="flex items-center border-l border-white/10 px-1.5">
            <FigureSkinToggle compact />
          </div>
          )}
          {frameObs?.chrome}
          <button
            onClick={toggleMuted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="px-2.5 min-w-[40px] justify-center flex items-center border-l border-white/10 text-white/80 hover:text-amber-300 transition"
          >
            {muted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
                <path d="m17 9 6 6M23 9l-6 6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" strokeLinejoin="round" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
      )}

      <div
        ref={wrapRef}
        className={`relative w-full ${newView && newViewH ? "" : "aspect-[5/8]"} rounded-xl overflow-hidden border-2 border-emerald-800/80 shadow-2xl shadow-emerald-950/60`}
        style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none", ...(newView && newViewH ? { height: newViewH } : {}) }}
      >
        <canvas
          ref={canvasRef}
          // A frame reader drawing its own picture over it (lib/star/engineFrame.ts):
          // still drawn, still the one that takes every touch, just not seen.
          style={frameObs?.hide2D ? { opacity: 0 } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`absolute inset-0 w-full h-full ${phase === "aim" && !leadInOn ? "cursor-grab" : phase === "runup" ? "cursor-ew-resize" : "cursor-default"}${
            // Under the strike screen the pitch is fully covered, so it is
            // taken out of the picture and out of touch altogether: tipped
            // back in 3D, iOS Safari could draw or hit-test its near half
            // through the strike screen (Harry, 5 Oct 2026: only the bottom
            // of the ball took a tap). It keeps drawing; nothing else changes.
            phase === "contact" ? " invisible pointer-events-none" : ""}`}
        />

        {/* Added time on the pitch (item 30): the clock otherwise only lives on
            the commentary, so a chance in added time says so. */}
        {ADDED > 0 && matchMinute > MATCH_DURATION && extraTimeStageRef.current === 0
          && (phase === "aim" || phase === "contact" || phase === "flight" || phase === "result") && (
          <div className="pointer-events-none absolute left-2 top-2 z-30 rounded-md bg-amber-400 px-1.5 py-0.5 text-[12px] font-black tabular-nums text-gray-950 shadow-lg">
            ⏱ {minuteLabel(matchMinute, ADDED, MATCH_DURATION)}&apos;
          </div>
        )}
        {/* Other scores (item 35), over the commentary only — never over your chance. */}
        {phase === "feed" && livePop && !scoresOpen && <LiveScorePop pop={livePop} onClose={closeLivePop} />}
        {/* Every score in the division right now (item 35), from the button under the clock. */}
        {phase === "feed" && scoresOpen && liveWeekRef.current && (
          <LiveScoresPanel
            rows={scoresAt(liveWeekRef.current.fixtures, liveWeekRef.current.goals, matchMinute)}
            minuteLabel={minuteLabel(matchMinute, ADDED, MATCH_DURATION)}
            followed={following}
            onToggleFollow={(club) => setFollowing(toggleFollowedTeam(club))}
            onClose={() => setScoresOpen(false)}
          />
        )}

        {/* Touch Mode (Boot.extraTouch) — the button itself, not just the
            mechanic. A corner toggle rather than a Settings checkbox, since
            it's something you flip mid-match: requested directly as "a
            little extra touch button/toggle in the corner of the screen".
            The canvas beneath owns the whole area for its own pointer
            handlers (aim-drag, captain orders), so this needs its own
            explicit pointer-events-auto and a z-index above it, or a tap
            meant for this button would fall straight through and start an
            aim-drag underneath it — same class of bug the captain-order fix
            elsewhere in this file exists to prevent. */}
        {canExtraTouch && (phase === "aim" || phase === "runup" || phase === "contact" || phase === "flight" || phase === "result") && (
          <button
            onClick={() => setTouchModeOn(t => !t)}
            aria-label={touchModeOn ? "Turn off Touch Mode" : "Turn on Touch Mode"}
            className={`absolute top-2 right-2 z-30 pointer-events-auto flex items-center gap-1 px-2 py-1.5 min-h-[36px] rounded-lg text-[10px] font-black tracking-wide shadow-lg transition ${
              touchModeOn ? "bg-fuchsia-500 text-white" : "bg-gray-950/70 text-fuchsia-300 border border-fuchsia-500/50"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <circle cx="12" cy="12" r="8" />
              {touchModeOn && <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />}
            </svg>
            TOUCH
          </button>
        )}

        {/* "After you pass: Joystick" — the captain's call (playOn.ts callForIt). */}
        {/* B14: the stamina bar (lib/star/legs.ts). Fills to your energy at most
            (the dim part past the line is energy you no longer have); drains as
            you sprint, refills as you ease off. B14b: in the first corner of the
            pitch clear of the goal, the ball and every man (lib/star/barSpot.ts). */}
        {stamUi && !leadInOn && (runLive || ((phase === "aim" || phase === "result") && goalInView(scenarioRef.current.kind) && acceptsCaptainOrders(scenarioRef.current.kind))) && (
          <div
            data-stamina={stamUi.v.toFixed(2)}
            data-stamina-cap={stamUi.cap.toFixed(2)}
            data-stamina-corner={barCorner}
            className="pointer-events-none absolute z-30 w-[124px] rounded-md bg-black/60 px-1.5 py-1"
            style={barCornerStyle(barCorner, ADDED > 0 && matchMinute > MATCH_DURATION)}
          >
            <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wider leading-none text-white">
              <span>Stamina</span>
              {runLive && <span className={stamUi.sprint ? "text-amber-300" : "text-white/80"}>{stamUi.sprint ? "Sprint" : stamUi.auto ? "Auto run" : "Run"}</span>}
            </div>
            <div className="relative mt-1 h-2 w-full overflow-hidden rounded-sm bg-white/15">
              <div className="absolute inset-y-0 right-0 bg-black/55" style={{ width: `${(1 - stamUi.cap) * 100}%`, backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.18) 0 2px, transparent 2px 5px)" }} />
              <div
                className={`absolute inset-y-0 left-0 ${stamUi.v < 0.25 ? "bg-red-500" : stamUi.v < 0.5 ? "bg-amber-400" : "bg-emerald-400"}`}
                style={{ width: `${stamUi.v * 100}%`, transition: "width 100ms linear" }}
              />
            </div>
            {runLive && pcKeys && (
              <div className="mt-1 text-[9px] font-bold leading-none text-white/85">W A S D move · Shift sprint</div>
            )}
          </div>
        )}
        {phase === "flight" && callForItShown({ captain: isCaptain, stickLive: runLive, layOffLive: false }) && (
          <button
            type="button"
            data-call-for-it
            onPointerDown={(e) => { e.stopPropagation(); }}
            onClick={onCallForIt}
            className="absolute bottom-[30%] right-3 z-30 pointer-events-auto rounded-full bg-amber-400 px-4 py-2.5 text-[13px] font-black text-gray-950 shadow-lg active:scale-95"
          >
            Call for it
          </button>
        )}
        {callMsg && phase === "flight" && (
          <div data-call-msg className="absolute bottom-[38%] right-3 z-30 pointer-events-none rounded-full bg-black/70 px-3 py-1 text-[12px] font-black text-white">
            {callMsg}
          </div>
        )}

        {/* A build-up before the chance (lib/star/leadInGen.ts): a tap skips it. */}
        {leadInOn && leadRef.current?.lead.skippable && (
          <div data-buildup className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none rounded-full bg-black/60 px-3 py-1 text-[11px] font-black text-white">
            {leadCap ?? "Build-up"} · tap to skip
          </div>
        )}
        {/* ⚡ Power shot (Settings → Gameplay "Knuckleball & power shot",
            lib/star/shotModel.ts). Arms the next shot at goal; bottom-left,
            clear of the ball's own pull room. Its own pointer-events-auto so
            a tap never starts an aim-drag underneath. */}
        {knucklePowerOn() && phase === "aim" && !leadInOn && !windingUp && !replayOf
          && !["penalty", "free_kick", "corner", "byline_cross"].includes(scenarioRef.current.kind) && (
          <button
            onClick={() => setPowerArmed((v) => !v)}
            data-power-shot={powerArmed ? "on" : "off"}
            className={`absolute left-2 bottom-2 z-30 pointer-events-auto rounded-lg px-2.5 py-1.5 min-h-[36px] text-[11px] font-black uppercase tracking-wider border-2 shadow-lg ${
              powerArmed ? "bg-amber-400 text-gray-950 border-amber-200" : "bg-gray-950/70 text-amber-300 border-amber-400/60"}`}
          >
            ⚡ Power shot{powerArmed ? " — on" : ""}
          </button>
        )}
        {windingUp && (
          <div className="absolute inset-x-0 bottom-[12%] z-30 flex justify-center pointer-events-none">
            <div className="kib-pop rounded-xl bg-black/70 px-4 py-2 text-2xl font-black italic tracking-wider text-amber-300">
              WINDING UP…
            </div>
          </div>
        )}
        {/* The top-down dribble (Dribble style: Top-down): words over the
            canvas only — the run itself is drawn on the canvas. Never takes
            a touch (the canvas does). */}
        {phase === "tdDribble" && (
          <div className="pointer-events-none absolute inset-0 z-20" data-td-dribble>
            {tdNote && !tdReady && (
              <div key={`${tdNote.t}-${tdNote.text}`} className="absolute inset-x-0 top-[16%] flex justify-center px-3">
                <span className="bg-black/70 px-3 py-1 text-[15px] font-black uppercase tracking-wide" style={{ color: tdNote.tone === "good" ? "#6ee7b7" : tdNote.tone === "bad" ? "#fca5a5" : "#fff", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.9)" }} data-duel-note>
                  {tdNote.text}
                </span>
              </div>
            )}
            {tdReady ? (
              <div className="absolute inset-x-0 top-[10%] flex flex-col items-center gap-1.5 px-6 text-center">
                <span className="bg-emerald-500 px-6 py-3 text-base font-black uppercase tracking-widest text-emerald-950" style={{ boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.92)" }}>{tdRef.current?.stick ? "Push to start" : "Tap to start"}</span>
                <span className="bg-black/70 px-3 py-1.5 text-[12px] font-bold leading-snug text-white">
                  {tdRef.current?.stick
                    ? "Left thumb: push the stick to run with it. Flick it sideways to knock it past him. Right side: tap a team-mate to pass."
                    : tdRef.current?.duels
                    ? "He backs off and shows you one way. Sell him a step-over or a dropped shoulder, then go the other way — or flick past him the moment he plants."
                    : "Drag to steer. Flick to burst past him."}
                </span>
              </div>
            ) : tdRef.current?.stick ? null : (
              <div className="absolute inset-x-0 bottom-0 px-2 pb-2">
                <p className="bg-black/70 px-3 py-2 text-center text-[12px] font-bold leading-snug text-white">
                  {tdRef.current?.duels
                    ? "Tap a side: drop the shoulder. Swipe down: step-over. Flick: knock it past as he plants."
                    : "Drag to steer. Flick to burst past him. Tap a team-mate to pass."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* The first-person duel — see USE_FIRST_PERSON_DRIBBLE. A full
            overlay over the canvas (it manages its own camera/render loop
            entirely), not something drawn onto it the way the old top-down
            dribble is. `waveSizes`/`seed` are rolled once at trigger time
            (fpDribbleRef) and held fixed so this never remounts mid-run. */}
        {phase === "fpDribble" && fpDribbleRef.current && (() => {
          // The duel's own props, exactly as before. (The "Dribble runs 3D"
          // row is gone, 12 Oct 2026: Dribble3D.tsx is no longer mounted.)
          const duel = {
            pace: 100,
            oppStrength: 100,
            waveSizes: fpDribbleRef.current.waveSizes,
            roster: fpRoster,
            seed: fpDribbleRef.current.seed,
            chaseEye: 5,
            chasePitchDeg: 5,
            chaseOffset: 4,
            cameraFollowRate: 10,
            passOptions: Math.round(getTuning("dribble.mates")),
            vision: visionRef.current,
            onComplete: finishFpDribble,
          };
          // Dribble duels: New — the career's own pace and dribbling against the
          // real opponent; Old — exactly the props above.
          const fpd = fpDribbleRef.current;
          const car0 = careerRef.current;
          const duelExtra = fpd.duels
            ? { duels: true, dribbling: car0?.skills.technique ?? 55, pace: car0?.skills.pace ?? 60, oppStrength: Math.round(oppStrength ?? 70) }
            : {};
          // Only a safety net now: matches play the dribble top-down (decided
          // 12 Oct 2026). The first-person duel lives on /star-dribble-dev.
          return <FirstPersonDribble embedded {...duel} {...duelExtra} />;
        })()}

        {/* Contact overlay. After a run-up it has a countdown
            (penaltyRunup.ts); run out and the kick is scuffed. */}
        {phase === "contact" && aim && powerStrike && (
          <PowerShotContact power={aim.power} onStrike={(q) => {
            // Its own seeded draw, so the match's random stream is untouched.
            const r = mulberry32(shotSeedFor(seedRef.current ^ 0x9073, rngCallCountRef.current));
            setPowerStrike(false);
            handleContact(POWER_SHOT_CONTACT, undefined, { ...powerShotStrike(q, r), noKnuckle: true });
          }} />
        )}
        {phase === "contact" && aim && !powerStrike && (
          <ContactBall
            power={aim.power}
            grades={shotsPro() && aimedAtGoal(scenarioRef.current, aim.dir)}
            knuckles={knucklePowerOn()}
            field={contactFieldOn() && fieldApplies(scenarioRef.current.kind)}
            onContact={(c) => handleContact(c)}
            motion={strikeMotion(scenarioRef.current.kind, seedRef.current)}
            technique={skills.technique}
            aerial={career ? Math.round(aerialOf(career.skills) * (1 - fatigueCut(liveEnergyAt(matchMinuteRef.current)))) : (skills as KickSkills & { aerial?: number }).aerial}
            // A header: how high the cross reaches you, so the screen can say your jump (aerial.ts headerJump).
            ballZ={strikeMotion(scenarioRef.current.kind, seedRef.current) === "float" ? (scenarioRef.current.kind === "header" ? airZOf(scenarioRef.current) : HEADER_Z) : undefined}
            timeLimitS={contactTimerS ?? undefined}
            onTimeout={contactTimerS ? handleScuff : undefined}
            hold={held}
          />
        )}

        {/* The run-up's one line of instruction — the only new gesture in
            the flow, so it says what it is while it's live. On the empty
            grass under the penalty arc: at the bottom edge it sat under the
            trial's how-to-play box (filmed). */}
        {phase === "runup" && runupRef.current?.nudge && (
          <div className="pointer-events-none absolute inset-x-0 top-[64%] z-20 flex justify-center">
            <div className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-black text-white shadow">
              ↔ Drag sideways to change your aim
            </div>
          </div>
        )}

        {/* The live shootout (v0.15 item 7): the score and who is next, over
            the pitch every kick is played on. */}
        {liveShootout && (
          <LiveShootout
            homeClub={liveShootout.homeClub}
            awayClub={liveShootout.awayClub}
            home={liveShootout.home}
            away={liveShootout.away}
            homeColor={kitsRef.current.home.shirt}
            awayColor={kitsRef.current.away.shirt}
            onKick={loadShootoutKick}
            onComplete={finishShootout}
          />
        )}

        {/* Action banner — Arcade pop (ArcadeBanner.tsx). Over the commentary
            too, so a cut away never cuts it short. */}
        <ArcadeBanner item={arcade.item} follow={bannerSideNow} />
        {/* Mikey's new pop-ups (Settings, default Old): MikeyPopup.tsx. */}
        <MikeyPopup item={mikey.item} follow={() => (bannerSideNow() === "bottom" ? "bottom" : "top")} />

        {/* The old action banner (every pack but Arcade): the moment an action
            completes. "PASS" when a team-mate brings your ball under control,
            "GOAL" when it goes in. Sits high so it never covers the strike itself. */}
        {actionBanner && (
          <div className="absolute inset-x-0 top-[18%] flex items-center justify-center pointer-events-none z-20">
            <div
              ref={actionBannerTextRef}
              className={`kib-pop text-5xl font-black italic tracking-wider drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)] ${
                actionBanner === "GOAL" ? "text-emerald-300" : "text-cyan-200"
              }`}
            >
              {actionBanner}
            </div>
          </div>
        )}

        {/* Outcome. Deliberately NOT announced for anything the pitch already
            shows you — the ball in the net, off the post, wide, in the keeper's
            hands. The only banner is the referee's call, which has no visual. */}
        {phase === "result" && outcome === "offside" && scene?.banners !== false && mikeyLook !== "new" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div ref={offsideBannerTextRef} className="kib-pop text-4xl font-black tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] px-6 py-3 rounded-xl text-yellow-200 bg-gray-950/70 ring-1 ring-yellow-400/50">
              OFFSIDE
            </div>
          </div>
        )}

        {/* ── The match itself ──
            Not an overlay over the pitch: the commentary IS the match, and the
            canvas above is what it cuts away to. See lib/star/matchLog. */}
        {phase === "feed" && (
          <MatchCommentary
            lines={log}
            minute={matchMinute}
            minuteLabel={minuteLabel(matchMinute, ADDED, MATCH_DURATION)}
            added={ADDED}
            regulation={MATCH_DURATION}
            onOpenScores={liveWeekRef.current && liveWeekRef.current.fixtures.length ? () => setScoresOpen(true) : undefined}
            homeTeam={homeTeam}
            userIsHome={fixture ? !!fixture.home : true}
            radar={radarLook === "new" && matchMode ? (
              <LiveRadar
                trace={radarTraceRef.current}
                minute={matchMinute}
                stepMs={Math.round(MINUTE_TICK_MS / Math.max(1, speed))}
                fullTime={MATCH_DURATION}
                us={{ short: radarShort(career?.player.club ?? "You"), colour: kitLabelOnDark(ourKit().shirt, ourKit().trim) }}
                them={{ short: radarShort(fixture?.opponent ?? "Them"), colour: kitLabelOnDark(theirKit().shirt, theirKit().trim) }}
              />
            ) : undefined}
            awayTeam={awayTeam}
            homeScore={homeScore}
            awayScore={awayScore}
            userKit={ourKit()}
            oppKit={theirKit()}
            stats={stats}
            speed={speed}
            onSpeed={cycleSpeed}
            pause={pause}
            energy={liveEnergy}
            energyMode={energyMode}
            // The farewell match has no energy: no energy panel, no cans.
            onEnergyMode={farewell ? undefined : setEnergyMode}
            playstyle={playstyle}
            onPlaystyle={setPlaystyle}
            kibCans={farewell ? 0 : Math.max(0, (career?.kibCans?.basic ?? 0) - kibUsed)}
            onUseKib={farewell ? undefined : drinkHalfTimeKib}
            // Tapping the commentary empties the queue in one go. Nobody wants
            // to sit through four minutes of build-up twice, and the alternative
            // to letting them skip it is that they turn the speed up and leave
            // it there.
            onSkip={queue.length > 0 && !pause ? () => {
              setLog(l => [...l, ...queue]);
              const last = queue[queue.length - 1];
              if (last?.minute !== undefined) setClock(last.minute);
              setQueue([]);
            } : undefined}
          />
        )}

        {/* New view: the sandbox's commentary and hint, on the pitch. */}
        {newView && !matchMode && !bare && phase !== "feed" && phase !== "contact" && phase !== "fpDribble" && (
          <div className={`pointer-events-none absolute inset-x-1.5 z-20 flex flex-col gap-1 ${overlayTop ? "top-1.5" : "bottom-1.5"}`}>
            {commentaryBox(true)}
            {hintBox(true)}
          </div>
        )}
      </div>

      {/* Live commentary ticker and the situation hint — both only for the
          standalone sandbox now. In a real match the commentary phase already
          shows every one of these lines (and more) a moment later, so running
          both was the same four lines twice; the hint was explanatory copy a
          returning player does not need re-explained to them every single
          chance. Reported directly: neither is wanted once you are actually
          playing, only while learning the game. */}
      {!matchMode && !bare && !newView && (
        <>
          {commentaryBox(false)}
          {hintBox(false)}
        </>
      )}

      {/* ── The armband ──
          Only for the captain, only while the ball is still at your feet, and
          only in a situation orders mean anything in. It reports what has
          actually been given rather than repeating the instructions forever —
          a line you have already acted on is clutter. */}
      {isCaptain && phase === "aim" && acceptsCaptainOrders(scenarioRef.current.kind) && (
        <div className="mt-1.5 bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-1.5 text-[10px] text-amber-200/90 text-center">
          <span className="font-black text-amber-300">© CAPTAIN</span>
          {(() => {
            // Orders live on the scenario (a ref), so this line is re-read when
            // orderTick moves and at no other time. See bumpOrders.
            void orderTick;
            const sc = scenarioRef.current;
            const runs = orderableRunners(sc).filter(r => r.commandedTo).length + (sc.follower.commandedTo ? 1 : 0);
            const relay = !!sc.relayTo || !!sc.relayToFollower;
            if (!runs && !relay) return <> · tap a team-mate to have it laid off to him, drag to send him on a run</>;
            const relayName = sc.relayTo?.who?.shortName ?? (sc.relayToFollower ? sc.follower.who?.shortName : undefined) ?? "your man";
            return (
              <>
                {relay && <> · lay-off to <span className="font-black">{relayName}</span></>}
                {!!runs && <> · {runs} run{runs > 1 ? "s" : ""} called</>}
              </>
            );
          })()}
        </div>
      )}


      {/* Session complete — reuse the real post-match screen for the summary */}
      {phase === "postmatch" && finalStats && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <PostMatch
            stats={finalStats}
            homeTeam={careerRef.current?.player.club ?? "You"}
            awayTeam="Training Session"
            onContinue={restartSession}
          />
        </div>
      )}
    </div>
  );
}
