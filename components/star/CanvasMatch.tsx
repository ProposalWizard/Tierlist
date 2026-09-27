"use client";
import { stageScene, type ScenePicture } from "@/lib/star/scenePicture";
import { isSwitchedOff, playableKind } from "@/lib/star/switchedOffKinds";
import { KIB_CANS } from "@/lib/star/shopData";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  buildWeightedScenario, buildScenario,
  launch, stepBall, stepBallInNet, settleBall, stepBallPastBar,
  stepKeeper, stepDefenders, stepReactions, stepTouchChase, touchChaseSpeed, initDefenders, resetForTouchOn,
  chainReturnChance, CHAIN_MAX, TOUCH_CHAIN_MAX, applyFirstTouch, goalInView,
  OUTCOME_TEXT, clamp, dragForFullPower, VIEW_ASPECT,
  orderableRunners, acceptsCaptainOrders,
  curveDirFromSwipe, applyCurveSwipe,
  setOffsideRuleEnabled,
  type Scenario, type Ball, type Outcome, type KickSkills, type ScenarioKind, type Viewport,
  type Facing, type Runner, type Vec2,
} from "@/lib/star/canvasEngine";
import {
  newMatch, advanceUntilInvolved, advanceTo, resolveScenario, lateSubQuota,
  type HiddenMatchState, type HiddenMatchInputs, type ScenarioRequest, type ScenarioResult, type HiddenMatchEvent,
} from "@/lib/star/hiddenMatch";
import { makeChance, pictureMemory, DEFAULT_CHANCE_MAKER, type ChanceMakerMode } from "@/lib/star/chanceMaker";
import { separateBodies } from "@/lib/star/spacing";
import { newSelectionMemory } from "@/lib/star/scenarioSelect";
import { finishServedFrame } from "@/lib/star/goalFrame";
import { pressSpeedFor, PRESS_REACT_S, PRESS_WIN_R, FOUL_SHARE } from "@/lib/star/pressure";
import { setPieceSkills, type SetPieceDuties } from "@/lib/star/setPieces";
import { conditionsFor, conditionsLine, type Conditions } from "@/lib/star/weather";
import {
  newDribble, stepDribble, flick, dribbleProgress, dribbleViewport, type DribbleState,
} from "@/lib/star/dribble";
import { pickWaveSizes } from "@/lib/star/firstPersonDribble";
import FirstPersonDribble from "./FirstPersonDribble";
import type { FpIdentity } from "@/lib/star/firstPersonDribble";
import {
  PITCH_W, HALF_LEN, CX,
  SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH,
  PEN_SPOT_Y, ARC_R, CENTRE_R, CORNER_R,
} from "@/lib/star/pitch";
import { mulberry32 } from "@/lib/star/season";
import { ruleBookFor } from "@/lib/star/ruleBook";
import { deflectBlock } from "@/lib/star/deflection";
import {
  commentaryBuildup, commentaryStrike, commentaryReceived, commentaryReceiverShot, commentaryResult,
} from "@/lib/star/matchCommentary";
import {
  primeMatchSound, setMatchSoundMuted, playKick, playNet, playPost, playSave, playWhistle, playCrowdSwell,
} from "@/lib/star/matchSound";
import { finaliseMatch, regressForMinutes, fairRating } from "@/lib/star/matchStats";
import { hookCheck, subComesOnNow, SUB_OFF_ENERGY, type HookReason } from "@/lib/star/selection";
import type { ChanceEntry, ChanceOutcome } from "@/lib/star/chanceLog";
import { pickSquadScorer, pickSquadAssist } from "@/lib/star/squadData";
import { castScenario, castDefence, creatorOf, orderDefensively, type OpponentSheetPlayer } from "@/lib/star/lineup";
import { formationShapeInput, type ShapeInput } from "@/lib/star/formationShape";
import { loadFaceStyle, DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle, DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import { DEFAULT_FAKE_FACE, fakeFaceFor } from "@/lib/star/fakeFaces";
import {
  drawFigureAt, drawKeeperAt, figureRForHeight, MATCH_FIGURE_HEIGHT_R, MATCH_FIGURE_R_MULT, MATCH_KEEPER_R_SHARE,
  MAX_KEEPER_LEAN, ROLE_KIT,
  runPhase as sharedRunPhase, poseFor as sharedPoseFor, bodyPoseFor, type FigurePose,
} from "@/lib/star/fiveASide/render";
import { createFaceImageCache } from "@/lib/star/faceImageCache";
import { startingTeammateRoles, onPitchToday, fillMissingFromFullRoster, opponentStartingXI } from "@/lib/star/teamsheet";
import { creditChance, type CreditDelta } from "@/lib/star/credit";
import { matchTeamStrength } from "@/lib/star/matchday";
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
import ContactBall from "./ContactBall";
import PostMatch from "./PostMatch";
import MatchCommentary from "./MatchCommentary";
import { energyFactorFor, energyPerMinute, clampEnergy, type EnergyMode } from "@/lib/star/energy";
import { getTuning } from "@/lib/star/tuningStore";
import { penaltyReadFor, decidePenaltyRead, applyPenaltyRead, type PenaltyReadSettings } from "@/lib/star/penaltyKeeper";
import { setupKind, strikeKind, replayStrike, stepKind, enforceHardRules, type StrikeDecision } from "@/lib/star/kindRules";
import { drawMatchGoal } from "@/lib/star/matchGoal";
import { switchOn } from "@/lib/star/compareSwitches";
import { strikingPower } from "@/lib/star/strikePower";
import {
  brainOptionsHere, hasBrain, brainSetup, brainAim, brainRunUp, brainStrike, brainStep, brainSnapshot, brainRestore,
} from "@/lib/star/keeperBrain";
import {
  RUNUP, hasRunup, canNudge, standBack, plantBeside, playerAt, goalLineX, nudgedDir, nudgeFromDrag,
  scuffStrike, cheekyStrike, isCheekyMiss,
  type RunupPath, type CheekyKind,
} from "@/lib/star/penaltyRunup";
import { revealOnScreen } from "@/lib/revealOnScreen";
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
type Phase = "aim" | "runup" | "contact" | "flight" | "result" | "feed" | "postmatch" | "dribble" | "fpDribble" | "shootout";

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
  /** How chances are made: your drawings (the game, and the default) or the
   *  generator (the Play Area's Chances dial). See lib/star/chanceMaker.ts. */
  chanceMaker?: ChanceMakerMode;
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

/** How long "PASS" / "GOAL" stays on screen after the action. */
const ACTION_BANNER_MS = 1000;
/** Seconds the kicking pose is held so the swing is actually visible. */
const KICK_POSE_S = 0.28;

/** A deep copy of a scenario for a caller to keep — plain data throughout. */
function snapshotScenario(sc: Scenario): Scenario | undefined {
  try { return structuredClone(sc); } catch { return undefined; }
}

export default function CanvasMatch({ skills = { power: 55, technique: 55 }, canCurve = false, canExtraTouch = false, keeperStrength = 62, position = "ST", teamRelationship = 60, career = null, seed = 12345, fixture, oppStrength, onComplete, startMinute = 0, duties, conditions, replayOf, onGoalScored, onChanceServed, neverHooked = false, openOn, bare = false, forceKeeperStrength = false, chanceMaker = DEFAULT_CHANCE_MAKER, fatigueResetEvery, onChanceResolved, penaltyRead, setPieceSkill, markers, onBallStep, dragReferenceHeightPx, scene, pressure = 0 }: Props) {
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
  const startingXI = career && fixture ? startingTeammateRoles(career, fixture) : null;
  const onPitch = (squad: SquadPlayer[]): SquadPlayer[] =>
    onPitchToday(fillMissingFromFullRoster(squad, startingXI, career ?? null), startingXI);
  // The other lot's actual starting XI — see opponentStartingXI's own note.
  // Null (not an empty array) when there's nothing to scout, same as
  // `startingXI`, so the opponent-goal branch below can tell "nobody to
  // draw from" apart from "a real XI with, say, no listed CAM this week".
  const oppXI = career && fixture ? opponentStartingXI(career, fixture) : null;
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

        const oppGoalLine = `⚽ ${oppScorer.shortName} scores!`;
        if (announce) pushLine(`${e.minute}' ${oppGoalLine}${oppAssister ? ` (${oppAssister.shortName})` : ""}`);
        return oppAssister
          ? [
              { minute: e.minute, text: oppGoalLine, isGoal: true, isOpponent: true },
              { minute: e.minute, text: `🎯 ${oppAssister.shortName} assists!`, tone: "assist", isOpponent: true },
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

      const goalLine = `⚽ ${scorer.shortName} scores!`;
      if (announce) pushLine(`${e.minute}' ${goalLine}${assister ? ` (${assister.shortName})` : ""}`);
      // The assist is its own line, not a parenthetical on the goal's — "A:
      // Cucurella" reads as a fact about the goal rather than as trivia tucked
      // onto the end of the sentence.
      return assister
        ? [
            { minute: e.minute, text: goalLine, isGoal: true },
            { minute: e.minute, text: `🎯 ${assister.shortName} assists!`, tone: "assist" },
          ]
        : [{ minute: e.minute, text: goalLine, isGoal: true }];
    });
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const careerRef = useRef(career);
  careerRef.current = career;

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
      return {
        extraTime: hasExtraTime(comp as ExtraTimeCompetition, fixture.round ?? "Final"),
        isLevelNow: () => userScoreRef.current === oppScoreRef.current,
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
  const tallyRef = useRef({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0 });
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
      if (fixture && onComplete && career) week = liveWeekFor(career, fixture);
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
  const chainRef = useRef<{ pos: { x: number; y: number }; depth: number; ambition: number; touchTouches?: number } | null>(null);

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
      if (saved === 1 || saved === 2 || saved === 4) setSpeed(saved);
    } catch { /* ignore */ }
  }, []);
  const cycleSpeed = () => {
    setSpeed((sp) => {
      const next = sp === 1 ? 2 : sp === 2 ? 4 : 1;
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
  const fpDribbleRef = useRef<{ waveSizes: number[]; seed: number } | null>(null);
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
  /** See the `chanceMaker` prop — read when each chance is made. */
  const chanceMakerRef = useRef(chanceMaker);
  chanceMakerRef.current = chanceMaker;
  /** See the `openOn` prop. Held in a ref so the render loop reads the
   *  current one without re-creating every callback that touches it. */
  const openOnRef = useRef(openOn);
  openOnRef.current = openOn;
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
  const setUpKeeper = (sc: Scenario, seed: number) => {
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
  const setPieceSkillRef = useRef(setPieceSkill);
  setPieceSkillRef.current = setPieceSkill;
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const onBallStepRef = useRef(onBallStep);
  onBallStepRef.current = onBallStep;
  const neverHookedRef = useRef(neverHooked);
  neverHookedRef.current = neverHooked;

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
    // A player who has been taken off stops spending energy.
    if (hookedRef.current) return energyRef.current;
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
  const TIRED_SKILLS_MAX_CUT = getTuning("energy.tiredSkillCut");
  const tiredSkills = (): KickSkills => {
    const energy = liveEnergyAt(matchMinuteRef.current);
    const cut = (1 - energy / 100) * TIRED_SKILLS_MAX_CUT;
    return { power: skills.power * (1 - cut), technique: skills.technique * (1 - cut) };
  };

  /**
   * The rating so far, the one formula every reader uses: the manager's hook,
   * the live AVG RAT box and the post-match screen. Item 26: the fair rating
   * (only real misses cost you).
   */
  const ratingSoFar = (t: typeof tallyRef.current, us: number, them: number): number =>
    fairRating({ goals: t.goals, assists: t.assists, passes: t.passesCompleted, dribbles: t.dribbles, misses: t.misses, lost: t.lost }, us, them).rating;
  /** What finaliseMatch needs beyond the old tally, and the extras for the post-match screen. */
  const matchExtras = () => {
    const t = tallyRef.current;
    return {
      tally: { misses: t.misses, lost: t.lost, dribbles: t.dribbles },
      extra: {
        ...(subOnRef.current ? { cameo: true, enteredAt: enteredAtRef.current } : {}),
        chanceLog: chanceLogRef.current.slice(),
      },
    };
  };

  const hiddenInputs = (): HiddenMatchInputs => {
    const car = careerRef.current;
    return {
      // Your CLUB's strength (Chelsea 83), not the team relationship (60 on
      // day one) — see matchTeamStrength (lib/star/matchday.ts, item 0).
      // The relationship keeps its own job: how team-mates combine inside a
      // chance (buildScenario's teamRelationship, via teamRef below).
      teamStrength: matchTeamStrength(car, teamRef.current, fixture),
      oppStrength: oppStrengthRef.current,
      playerSkill: car ? (car.skills.power + car.skills.technique + car.skills.vision) / 3 : 55,
      home: fixture?.home,
      pace: careerRef.current?.skills.pace,
      freeKick: careerRef.current?.skills.freeKick,
      // So a corner/free kick/penalty is weighted by the position you play
      // like every other chance is, instead of bypassing it — see
      // buildRequest's dead-ball block in hiddenMatch.ts.
      position: positionRef.current,
      energy: liveEnergyAt(matchMinuteRef.current),
      energyMode: energyModeRef.current,
      impactSub: startMinuteRef.current > 0,
      // The talisman tactic — see clubPowers.ts's `setTalisman`. Only ever
      // true while you're a majority owner of the club you're actually
      // playing for right now, which `talisman` is stored against.
      talisman: !!(car && car.ownedClubs?.[car.player.club]?.talisman),
      // v0.15 item 6: penalties won in any move, not only yours.
      livePenalties: true,
      // Item 24: once you are on as a sub, your chances are squeezed into the
      // minutes left (allowing for your energy), and from 70' one is owed.
      lateSub: subOnRef.current
        ? { enteredAt: enteredAtRef.current, owed: Math.max(0, lateSubQuota(enteredAtRef.current) - subChancesRef.current), fitness: subFitnessRef.current }
        : undefined,
      // Added time: chasing in it, everyone goes forward (hiddenMatch.ts's FERGIE_*).
      ...(ADDED > 0 ? { fergie: { from: MATCH_DURATION, to: MATCH_DURATION + ADDED } } : {}),
    };
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
    fixture && career
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

  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);

  // ── The run-up (lib/star/penaltyRunup.ts) — every penalty and direct free kick ──
  //
  // Between letting go of the aim and the strike screen: `t` seconds into the
  // jog, the aim you let go with (`dir0`) and how far you've swung it
  // (`nudgeM`, metres along the goal line — a penalty only, `nudge`). The
  // keeper's hop is the keeper brain's own (brainRunUp). Null otherwise.
  const runupRef = useRef<{
    t: number; dir0: Vec2; power: number; nudgeM: number; path: RunupPath;
    nudge: boolean; arrived: boolean;
    /** Somebody else's penalty (v0.15 items 6/7): struck for him on arrival, no strike screen. */
    auto?: { contact: { cx: number; cy: number }; skills: KickSkills };
  } | null>(null);
  /** A sideways drag during the run-up: where it started, and the swing then. */
  const nudgeDragRef = useRef<{ x0: number; base: number } | null>(null);
  /** The strike screen's countdown for this kick, seconds — null = no limit (every kick but a run-up). */
  const [contactTimerS, setContactTimerS] = useState<number | null>(null);
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
  /** When the drag passed the dead zone (performance.now()). From then on an
   *  ordered run is under way, the nearest opponent closes you down, and the
   *  chance can no longer be taken back. */
  const aimCommitRef = useRef<number | null>(null);
  /** The defender closing you down this chance, if anyone is. */
  const presserRef = useRef<Scenario["defenders"][number] | null>(null);
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
  const [stats, setStats] = useState({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0 });
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
  const playerLabel = () => careerRef.current?.player.lastName || "you";

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
  useEffect(() => {
    if (pause || queue.length === 0) return;
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
  }, [queue, pause, speed, matchMinute]);

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
    setLog(l => [...l, ...mine.map(g => logLine(
      `📻 ${shortClub(g.home)} ${g.hs}-${g.as} ${shortClub(g.away)}${g.scorer ? ` · ${g.scorer}` : ""}`,
      "elsewhere", g.minute,
    ))]);
    // A jump in the clock (coming off the bench) logs the older goals quietly;
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
    if (pause || queue.length > 0 || phase !== "feed") return;
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
  }, [queue, pause, phase, speed, matchMinute]);

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  // Last-seen position per figure, so the renderer can tell who is moving and
  // put them in a running pose. Purely cosmetic — nothing reads it back.
  const motionRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Seconds remaining on the player's kicking pose. A strike takes one frame,
  // so without a hold the swing would never actually be seen.
  const kickPoseRef = useRef(0);
  // Action banner ("PASS" / "GOAL") and how long it stays up.
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const showAction = useCallback((text: string) => {
    if (sceneRef.current?.banners === false) return;
    setActionBanner(text);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setActionBanner(null), ACTION_BANNER_MS);
  }, []);

  // --- Cosmetic FX state (never touches physics) ---
  const reducedMotionRef = useRef(false);
  const trailRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shakeRef = useRef({ t: 0, dur: 1, mag: 0 });   // camera nudge
  const flashRef = useRef({ t: 0, dur: 1 });            // goal flash
  const seamRef = useRef(0);                            // ball roll angle
  /**
   * The same real ball ContactBall already puts on the strike screen —
   * public/star/ball.png — instead of a canvas-drawn white disc. Reported
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
      img.src = attempt === 0 ? "/star/ball.png" : `/star/ball.png?retry=${attempt}`;
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
  const faceImageCacheRef = useRef(createFaceImageCache());
  const getFaceImage = (url: string | undefined): HTMLImageElement | undefined =>
    faceImageCacheRef.current.get(url);

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
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
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
      facingRef.current = scenarioRef.current.facing ?? "up";
      viewportRef.current = { ...scenarioRef.current.viewport };
      baseViewportRef.current = { ...scenarioRef.current.viewport };
      const replayRng = countedRng(r.seed, rngCallCountRef);
      for (let i = 0; i < r.callsBeforeStrike; i++) replayRng();
      rngRef.current = replayRng;
      ballRef.current = launch(scenarioRef.current, r.dir, r.power, r.contact, r.skills, replayRng);
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
    dressAutoKeeper(scenarioRef.current);
    standBackForRunup(scenarioRef.current);
    setUpKeeper(scenarioRef.current, (seed ^ 0x4b7e) >>> 0);
    facingRef.current = scenarioRef.current.facing ?? "up";
    viewportRef.current = { ...scenarioRef.current.viewport };
    baseViewportRef.current = { ...scenarioRef.current.viewport };
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
        setLog([
          logLine("Kick Off", "period", 0),
          ...linesFrom(named.slice(-14)),
          logLine("You are coming on.", "you", st.minute),
        ]);
        setPhase("feed");
        setPause({
          label: "You are going on",
          cta: "Get out there →",
          onContinue: () => { setPause(null); startSimulation(); },
        });
        return;
      }
      // Starting: the match opens on the commentary, at nil-nil, with a
      // whistle — not on a pitch waiting for a chance that has not arrived.
      enteredAtRef.current = 0;
      setLog([logLine("Kick Off", "period", 0)]);
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

  /**
   * Which way the frame is turned. "up" is the ordinary view; a crossing
   * situation is watched from the side until the ball reaches the box.
   */
  const facingRef = useRef<Facing>("up");
  /** The grass grain, built once on first paint. */
  const grassRef = useRef<HTMLCanvasElement | null>(null);

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

  const pitchFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const vp = viewportRef.current;
    // NOT clamped to the canvas. You aim by dragging back from the ball, and a
    // chance near the bottom of the frame needs to be dragged back past the
    // bottom of it — clamping turned that into an arrow that stuck and a shot
    // you could not take.
    const sx = (clientX - rect.left) / rect.width;
    const sy = (clientY - rect.top) / rect.height;
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
    const a = toScreen(drag), b = toScreen(ball);
    // sx is a fraction of the canvas WIDTH and sy of its HEIGHT, so put them in
    // the same units before measuring.
    const pull = Math.hypot((a.sx - b.sx) * VIEW_ASPECT, a.sy - b.sy);
    // A fixed reference height (see `dragReferenceHeightPx`): the same pixels
    // of finger travel, measured against the real match's canvas instead.
    const refH = dragRefHeightRef.current;
    const ownH = canvasRef.current?.getBoundingClientRect().height ?? 0;
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
    const grab = Math.max(2.2, (vp.y2 - vp.y1) * 0.09);
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
  // box, a penalty inside it.
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
    if (why === "pressed" && mulberry32((seedRef.current ^ 0x0f0c1a5) >>> 0)() < FOUL_SHARE) {
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
      if (togo < 0.6) { r.commandedTo = undefined; r.moving = false; continue; }
      const step = Math.min(togo, r.speed * dt);
      r.pos.x += (dx / togo) * step; r.pos.y += (dy / togo) * step;
      r.moving = true; r.sprint = true;
    }
    const f = sc.follower;
    if (f.commandedTo) {
      const dx = f.commandedTo.x - f.x, dy = f.commandedTo.y - f.y, togo = Math.hypot(dx, dy);
      if (togo < 0.6) { f.commandedTo = undefined; f.active = false; }
      else { const step = Math.min(togo, FOLLOWER_RUN_SPEED * dt); f.x += (dx / togo) * step; f.y += (dy / togo) * step; f.active = true; }
    }
    const d = presserRef.current;
    if (d && since > PRESS_REACT_S) {
      const b = sc.ball;
      const dx = b.x - d.x, dy = b.y - d.y, dist = Math.hypot(dx, dy);
      if (dist <= PRESS_WIN_R) { loseChance("pressed"); return; }
      const step = Math.min(dist - PRESS_WIN_R * 0.5, pressSpeedFor(pressureRef.current) * dt);
      d.x += (dx / dist) * step; d.y += (dy / dist) * step;
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
    const BALL_PX = Math.max(4.5, unit * 0.5);

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
    ctx.save();
    ctx.translate(ox, oy);

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
      wear(CX, 1.9, 6.2, 2.4, 0.22);      // the goalmouth
      wear(CX, PEN_SPOT_Y, 3.2, 2.2, 0.16); // the penalty spot
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
    const lw = Math.max(1, unit * 0.12); // ~12 cm painted line
    ctx.lineWidth = lw;
    ctx.strokeStyle = C.line;

    // Touchlines + goal line
    pLine(0, 0, PITCH_W, 0);
    pLine(0, 0, 0, HALF_LEN);
    pLine(PITCH_W, 0, PITCH_W, HALF_LEN);
    // Penalty area (40.32 x 16.5) and six-yard box (18.32 x 5.5)
    pRect(BOX_L, 0, BOX_R, BOX_DEPTH);
    pRect(SIX_L, 0, SIX_R, SIX_DEPTH);
    // Penalty spot + the D (an arc of radius 9.15 m clipped to outside the box)
    {
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
    // Halfway line + centre circle
    ctx.strokeStyle = C.lineFaint;
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
    if (sceneRef.current?.goal !== false) drawMatchGoal(ctx, P, unit, heightScale);

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

    type FigureOpts = { pose?: Pose; phase?: number; facing?: number; label?: string; labelColor?: string; shorts?: string; star?: boolean; face?: HTMLImageElement };

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
    const footballer = (
      x: number, y: number, rBase: number,
      shirt: string, rim: string,
      opts: FigureOpts = {},
    ) => {
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
      const limbs = bodyPoseFor(pose, phase);

      // ── Anchored at the FEET ──
      //
      // (px, py) is where this man is standing, and it is where his boots are:
      // the shadow goes there and the body is drawn upward from it. The figure
      // used to hang off its own middle, so every player was drawn half a body
      // ahead of the spot he actually occupied — a keeper on his line had his
      // head on the line and his feet two metres in front of it, and looked
      // like he had come out. It also put the ball, which IS drawn at its
      // ground point, level with a player's waist rather than his boots.
      drawFigureAt(
        ctx, px, py, r,
        { shirt, shorts, trim: rim, skin: SKIN, face: opts.face },
        faceStyleRef.current, fakeFaceStyleRef.current,
        {
          facing: opts.facing,
          shadowR: r * 0.42,
          pose: limbs,
          label: opts.label,
          labelColor: opts.labelColor,
          star: opts.star,
          // A gold star on a bright shirt or against a floodlit sky needs an
          // edge or it dissolves into whatever is behind it.
          starRim: "rgba(0,0,0,0.55)",
        },
      );
    };

    // Sized against the reference rather than against the laws of the game: a
    // sprite there stands about 7% of the frame's width tall, which works out
    // near enough to two and a half metres. Footballers are not two and a half
    // metres tall, and it does not matter — at a true 1.8 m they are specks.
    //
    // Now that the projection is flat this holds everywhere on the frame, which
    // it never could before: a man at the goal used to be drawn at 64% of a man
    // at your feet.
    const R = unit * MATCH_FIGURE_R_MULT;

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
      footballer(sc.follower.x, sc.follower.y, R, ourKit().shirt, ourKit().trim, {
        pose: poseFor("follower", sc.follower.x, sc.follower.y),
        phase: runPhase(sc.follower.x),
        face: getFaceImage(sc.follower.who?.face),
        label: faceStyleRef.current.namesEnabled ? sc.follower.who?.shortName : undefined,
      });
    }

    /**
     * The armband's two orders, drawn on the grass.
     *
     * Gold, because that is what the armband is, and because nothing else on
     * this pitch is — a defender is never gold and neither is the ball, so an
     * order can never be mistaken for a thing that is about to happen to you.
     */
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
        pose: poseFor(`mate${i}`, t.x, t.y),
        phase: runPhase(t.x),
        face: getFaceImage(t.who?.face),
        label: faceStyleRef.current.namesEnabled ? t.who?.shortName : undefined,
      });
    });

    // The runner a pass is aimed at — drawn at their LIVE position, which is the
    // exact point reception is tested against, so the ball can never appear to
    // pass through them without being controlled.
    [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners].forEach((r, i) => {
      // Arms out the moment they take the ball down, so a completed pass reads
      // on the pitch and not only in the commentary.
      const receiving = i === 0 && !!rb && rb.receiverControlT > 0;
      footballer(r.pos.x, r.pos.y, R, ourKit().shirt, ourKit().trim, {
        pose: receiving ? "receive" : poseFor(`run${i}`, r.pos.x, r.pos.y),
        phase: runPhase(r.pos.x),
        face: getFaceImage(r.who?.face),
        label: faceStyleRef.current.namesEnabled ? r.who?.shortName : undefined,
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
        pose: (d.z ?? 0) > 0.15 ? "kick" : poseFor(`def${i}`, d.x, d.y),
        phase: runPhase(d.x),
        face: getFaceImage(d.who?.face),
        label: faceStyleRef.current.namesEnabled ? d.who?.shortName : undefined,
      });
    });
    // An automatic kick (v0.15 items 6/7): the man over the ball is the taker —
    // a team-mate in your shirt, or one of theirs in theirs — named, no star.
    const auto = autoKickOf(sc);
    const takerKit = auto?.side === "them" ? theirKit() : ourKit();
    if (auto) {
      footballer(sc.player.x, sc.player.y, R, takerKit.shirt, takerKit.trim, {
        pose: kickPoseRef.current > 0 ? "kick" : poseFor("you", sc.player.x, sc.player.y),
        phase: runPhase(sc.player.x),
        face: getFaceImage(auto.taker.face),
        label: auto.taker.shortName,
      });
    } else
    // You wear the same shirt as everybody else on your side — you are one of
    // eleven, not a differently-coloured avatar. The armband of a name label is
    // what picks you out, which is how you pick a player out watching football.
    footballer(sc.player.x, sc.player.y, R, ourKit().shirt, ourKit().trim, {
      // Held briefly after a strike so the swing is visible rather than
      // happening entirely between two frames.
      pose: kickPoseRef.current > 0 ? "kick" : poseFor("you", sc.player.x, sc.player.y),
      phase: runPhase(sc.player.x),
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
      label: faceStyleRef.current.namesEnabled ? playerLabel() : undefined,
    });

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
      const KIND = {
        catch:     { lean: 0.15, armUp:  0.25, spread: 0.45, reachK: 0.55, crouch: 0.10 },
        central:   { lean: 0.05, armUp: -0.10, spread: 1.05, reachK: 0.80, crouch: 0.22 },
        low:       { lean: 1.15, armUp: -0.85, spread: 0.95, reachK: 1.35, crouch: 0.30 },
        high:      { lean: 0.55, armUp:  1.00, spread: 0.80, reachK: 1.30, crouch: -0.35 },
        fingertip: { lean: 1.30, armUp:  0.35, spread: 0.70, reachK: 1.70, crouch: 0.05 },
      } as const;
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
      const KR = R * MATCH_KEEPER_R_SHARE * kScale;   // smaller than an outfielder, smaller again far away
      // Capped just past flat — see MAX_KEEPER_LEAN. Purely the artwork:
      // nothing in the engine reads this rotation.
      const lean = clamp(sign * diveN * (K ? K.lean : 0.9), -MAX_KEEPER_LEAN, MAX_KEEPER_LEAN);
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
      const spread = K ? K.spread : 1;
      const armUp = K ? K.armUp : 0;

      ctx.save();
      ctx.globalAlpha = 0.92;

      // No highlight ring on a save. The dive is the thing you are watching;
      // a yellow disc drawn over it only told you what you had already seen.
      // Their penalty at YOUR keeper (a shootout): he wears your keeper's kit.
      const gkKit = autoKickOf(sc)?.side === "them" ? ourKeeperKitRef.current : kitsRef.current.keeper;
      drawKeeperAt(
        ctx,
        cx + KR * weight * (1 - lunge), py, kr,
        {
          shirt: gkKit.shirt,
          shorts: gkKit.trim,
          trim: gkKit.trim,
          skin: SKIN,
          face: getFaceImage(kk.who?.face),
        },
        // The lean below is this screen's own, per-save-kind one rather than
        // the shared renderer's generic one, so every save still pitches over
        // exactly as far as it did — hence dive 0 and the lean handed in as a
        // facing. `lunge` still drives the shared set-crouch-to-full-stretch.
        { dive: 0, lunge },
        faceStyleRef.current, fakeFaceStyleRef.current,
        {
          facing: lean,
          // cyOff is the save's own vertical drop plus his breathing. It moves
          // the BODY, never the shadow, which is what a negative lift means.
          liftPx: -cyOff,
          shadowR: kr * (0.53 + diveN * 0.38),
          pose: {
            // Direction and spread come from the save being played. A high
            // save drives the arms up, a low save down, a catch brings them
            // together in front; the leading glove goes furthest and the
            // trailing one stays tucked.
            armSpread: clamp(0.45 + spread * 0.35 + diveN * 0.4, 0, 1),
            armLift: 0.15 + armUp * diveN * 0.85 + lunge * 0.5,
            armLead: sign,
          },
          // A kick you are watching names both men: who is taking it, who is in goal.
          label: faceStyleRef.current.namesEnabled || autoKickOf(sc) ? kk.who?.shortName : undefined,
        },
      );

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
    const keeperInView = goalInView(sc.kind) && sceneRef.current?.keeper !== false;
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

    // --- Ball trail (fades along the flight; curl makes it sing) ---
    const trail = trailRef.current;
    for (let i = 0; i < trail.length; i++) {
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
      ctx.beginPath();
      ctx.ellipse(px, py, bScale * 1.05 * shadowShrink, bScale * 0.5 * shadowShrink, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.34 * shadowShrink})`;
      ctx.fill();

      // The ball, lifted off the shadow and grown a little with height.
      const by = py - h * heightScale * scale;
      const br = bScale * (1 + Math.min(h, 8) * 0.055);
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
    const ballAt = ball ? { x: ball.pos.x, y: ball.pos.y, z: ball.z }
      : onTheSpot ? { x: sc.ball.x, y: sc.ball.y, z: 0 } : null;
    if (ballAt) {
      const drawIt = () => drawBall(ballAt.x, ballAt.y, ballAt.z);
      if (figureQueue) figureQueue.push({ py: toPx(ballAt.x, ballAt.y).py, draw: drawIt });
      else drawIt();
    }
    flushFigures();
    // The orders go over every man now rather than between the groups — the
    // groups no longer exist as layers. Thin gold lines, so they never hide
    // what you are aiming at.
    if (isCaptainRef.current && phaseRef.current === "aim" && acceptsCaptainOrders(sc.kind)) {
      drawCaptainOrders(sc);
    }

    // He's been beaten — draw him now, after the ball, so his body is what
    // occludes it rather than the other way round.
    if (ballBehindKeeper) drawKeeper();

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
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const toCanvasPx = (clientX: number, clientY: number) => ({
            px: ((clientX - rect.left) / rect.width) * canvas.width,
            py: ((clientY - rect.top) / rect.height) * canvas.height,
          });
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
      const heightSpan = facingRef.current === "up" ? vp.y2 - vp.y1 : vp.x2 - vp.x1;
      const lineLen = power * heightSpan * 0.132;
      const ex = sc.ball.x + (dx / len) * lineLen;
      const ey = sc.ball.y + (dy / len) * lineLen;
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
  }, [toPx]);

  // --- Cosmetic FX helpers ---
  const nudge = (dur: number, mag: number) => {
    if (reducedMotionRef.current) return;
    shakeRef.current = { t: dur, dur, mag };
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

  // --- Main animation loop ---
  useEffect(() => {
    const loop = (ts: number) => {
      const last = lastTsRef.current ?? ts;
      let dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      dt = Math.min(dt, 0.05); // clamp big frame gaps

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
      if (phaseRef.current === "aim") {
        stepKeeper(scenarioRef.current, dt);
        // …with the keeper brain he also gets set while you aim: a walk from
        // where he was put toward his spot for this ball. No-op when it's off.
        brainAim(scenarioRef.current, dt);
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
      if (phaseRef.current === "runup") {
        const ru = runupRef.current;
        const sc = scenarioRef.current;
        stepKeeper(sc, dt);
        if (ru && !ru.arrived) {
          ru.t += dt;
          const dirNow = ru.nudge ? nudgedDir(sc.ball, ru.dir0, ru.nudgeM) : ru.dir0;
          brainRunUp(sc, dt, ru.t, goalLineX(sc.ball, dirNow));
          sc.player = playerAt(ru.path, ru.t / RUNUP.runupS);
          if (ru.t >= RUNUP.runupS && ru.auto) {
            // Somebody else's penalty: struck for him the moment he gets there.
            ru.arrived = true;
            handleContactRef.current?.(ru.auto.contact, { dir: dirNow, power: ru.power, skills: ru.auto.skills });
          } else if (ru.t >= RUNUP.runupS) {
            ru.arrived = true;
            nudgeDragRef.current = null;
            setAim({ dir: dirNow, power: ru.power });
            setContactTimerS(RUNUP.timerS);
            setPhase("contact");
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
        const view = sc.crossSwitchView;
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
        const steps = 3;
        for (let i = 0; i < steps; i++) {
          const recorded = replaySubstepsRef.current;
          let h: number;
          if (recorded && replaySubstepIdxRef.current < recorded.length) {
            h = recorded[replaySubstepIdxRef.current];
            replaySubstepIdxRef.current++;
          } else {
            h = dt / steps;
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
          let res = stepBall(ballRef.current, scenarioRef.current, rngRef.current, h);
          // ── v0.15 item 16: a block deflects instead of ending the chance ──
          // The engine has already cleared it; put it back into play off the
          // defender at a new angle, loose, and let the normal rules decide
          // who gets it. Once per strike — the next defender to get there
          // wins it, exactly as today. Its own seeded stream (off the chance's
          // seed and how far through it we are), so a replay deflects the same.
          if (res === "blocked" && deflectionsRef.current < 1) {
            deflectionsRef.current += 1;
            const r = mulberry32(((seedRef.current ^ Math.imul(rngCallCountRef.current + 1, 0x27d4eb2d)) ^ 0xdef1) >>> 0);
            deflectBlock(ballRef.current, scenarioRef.current, incoming, r);
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
          if (res) { resolveOutcome(res); break; }
        }
        // Surface mid-flight moments (pass reception / the teammate's own shot /
        // the woodwork) once.
        const ev = ballRef.current?.event;
        const receiver = scenarioRef.current.receiver;
        // The frame no longer ends the move — the ball cannons back out and is
        // live — so it is narrated here rather than in resolveOutcome.
        if (ev === "post") {
          pushLine("Off the woodwork — and it's still live!");
          showAction("POST");
          nudge(0.28, 0.25);
          playPost();
          playCrowdSwell("groan");
        }
        if (ev && receiver) {
          // His name, if we know it — and by now we do, because the identity is
          // taken off whoever the ball actually reached. See lib/star/lineup.ts.
          const label = receiver.who?.shortName ?? receiver.roleLabel;
          if (ev === "received") { pushLine(commentaryReceived(label, rngRef.current)); showAction("PASS"); }
          else if (ev === "receiverShot") { pushLine(commentaryReceiverShot(label, rngRef.current)); playKick(); kickPoseRef.current = KICK_POSE_S; }
          // He was told to leave it, and he has left it. Named, because the
          // whole point of the order is that the move went through somebody
          // rather than ending at the first man who could see the goal.
          else if (ev === "relay") {
            pushLine(`${label} leaves it — the captain wanted it moved on.`);
            showAction("PASS");
            playKick();
            kickPoseRef.current = KICK_POSE_S;
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
      if (phaseRef.current === "result" && ballRef.current?.settling) {
        settleBall(ballRef.current, dt, scenarioRef.current);
      }
      // …and a ball shot over the bar keeps flying, so it visibly leaves the
      // frame instead of stopping dead exactly where "over" was decided.
      if (phaseRef.current === "result" && ballRef.current?.overBar) {
        stepBallPastBar(ballRef.current, dt);
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

      // Cosmetic FX advance (pausing the rAF pauses everything together)
      if (kickPoseRef.current > 0) kickPoseRef.current = Math.max(0, kickPoseRef.current - dt);

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

      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
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

  const resolveOutcome = (res: Outcome) => {
    setOutcome(res);
    setPhase("result");
    const sc = scenarioRef.current;
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
    const d = creditChance(res, { youShot, receiverShot, isSimplePass });
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
        if (youShot) t.misses += 1; else t.lost += 1;
      }
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
      showAction("PASS");
    } else if (res === "touchOn") {
      // Touch Mode's own catch had no banner at all — the result screen paused
      // exactly the way a genuinely dead chance does, with nothing on screen
      // to say a catch had just happened and another kick was coming. Reported
      // live as part of the same "it just stops" complaint the matchResultFor
      // fix above addresses; this is the other half — making the real
      // continuation actually visible, not just correct underneath.
      showAction("TOUCH ON");
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

      if (d.assists === 1 && sc.receiver) {
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
        goalEventsRef.current.push({
          minute: matchMinuteRef.current,
          scorer: scorer?.name ?? sc.receiver.roleLabel ?? "Team-mate",
          assist: playerName,
          isUserGoal: false, how, distance: Math.round(distance),
        });
        logMoment(`⚽ ${scorerLabel} scores!`, "goal");
        logMoment(`🎯 ${playerLabel()} assists!`, "assist");
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
        goalEventsRef.current.push({
          minute: matchMinuteRef.current, scorer: playerName, assist: assister?.name,
          isUserGoal: true, how, distance: Math.round(distance),
        });
        logMoment(`⚽ ${playerLabel()} scores!`, "goal");
        if (assister) logMoment(`🎯 ${assister.shortName} assists!`, "assist");
      } else {
        // The scoreline has gone up and neither branch claimed it. It is still a
        // goal, and a goal with nobody's name on it is a goal missing from the
        // match report, the scoresheet and the squad stats. Yours: nobody else
        // was involved, or one of the branches above would have fired.
        goalEventsRef.current.push({
          minute: matchMinuteRef.current, scorer: playerName,
          isUserGoal: true, how, distance: Math.round(distance),
        });
        logMoment(`⚽ ${playerLabel()} scores!`, "goal");
      }

      // A goal that's yours — not a team-mate's, which the first branch
      // above claims — is exactly what a saved replay is for. Never during a
      // replay itself: watching a saved goal again is not a new goal to
      // capture. `pendingReplayRef` is only ever set right before a real
      // strike (handleContact), so it is naturally absent for anything that
      // scored without you having personally struck it.
      if (!(d.assists === 1 && sc.receiver) && pendingReplayRef.current && !replayOfRef.current) {
        const verb = SCENARIO_LABEL[sc.kind]?.verb.replace("!", "") ?? sc.kind;
        onGoalScoredRef.current?.({
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          savedAt: new Date().toISOString(),
          label: `${verb} · ${minuteLabel(matchMinuteRef.current, ADDED, MATCH_DURATION)}'`,
          ...pendingReplayRef.current,
          flightDtLog: flightDtLogRef.current.slice(),
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
        goalEventsRef.current.push({
          minute: matchMinuteRef.current, scorer: auto.taker.name, isUserGoal: false, how: "penalty", distance: 11,
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
    if (res === "delivered") {
      const depth = sc.chainDepth ?? 0;
      const at = sc.receivedAt ?? sc.runner?.pos ?? sc.passTarget;
      if (at && depth < CHAIN_MAX && rngRef.current() < chainReturnChance(sc)) {
        const ambition = Math.max(sc.passDifficulty, sc.passAmbition ?? 0);
        chainRef.current = { pos: { x: at.x, y: at.y }, depth: depth + 1, ambition };
        pushLine(at.y < 25 ? "It comes straight back to you, higher up…" : "He lays it off — the move keeps going…");
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
      window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(true); }, 1600);
      return;
    }

    // Watching a saved goal ends here — no next chance to load, no match to
    // simulate onward, no sandbox chance count ticking over. The parent
    // decides what happens next (watch it again, by remounting with the
    // same replayOf; or close).
    if (replayOfRef.current) return;

    // In career/match mode, enter simulation phase. In sandbox, go directly.
    if (matchModeRef.current) {
      const gen = sceneGenRef.current;
      window.setTimeout(() => { if (sceneGenRef.current === gen) startSimulation(); }, 1800);
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
          ...cheekyStats(),
        };
        const gen = sceneGenRef.current;
        window.setTimeout(() => { if (sceneGenRef.current === gen) { setFinalStats(stats); setPhase("postmatch"); } }, 1800);
      } else {
        const gen = sceneGenRef.current;
        window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(false); }, 1800);
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
  const finishFpDribble = (result: { cleared: boolean; beaten: number }) => {
    fpDribbleRef.current = null;
    attemptsRef.current += 1;
    const rng = rngRef.current;

    if (result.cleared) {
      tallyRef.current.dribbles += 1;
      setStats({ ...tallyRef.current });
      logChance("dribble", "dribble");
      const bonus = result.beaten >= 7;
      pushLine(bonus ? "Clean through — you've beaten the lot of them." : "You are through — and the chance is on.");
      showAction("BEAT HIM");
      chainRef.current = bonus
        ? { pos: { x: CX + (rng() - 0.5) * 8, y: PEN_SPOT_Y - 2 + rng() * 4 }, depth: 0, ambition: 1 }
        : { pos: { x: CX + (rng() - 0.5) * 12, y: 28 + rng() * 3 }, depth: 0, ambition: 1 };
      if (matchModeRef.current) resolveScenario(matchStateRef.current, "delivered");
      {
        const gen = sceneGenRef.current;
        window.setTimeout(() => { if (sceneGenRef.current === gen) loadScenario(true); }, 1200);
      }
      return;
    }

    pushLine("Taken off you.");
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

    const baseInputs: HiddenMatchInputs = prior
      ? { ...prior.inputs, energyModeChanges: prior.changes }
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
    if (subOnRef.current && !hookedRef.current && !neverHookedRef.current) {
      const perMin = energyPerMinute(energyModeRef.current, energyFactorRef.current);
      const e = liveEnergyAt(st.minute);
      if (perMin > 0) offAt = e <= SUB_OFF_ENERGY ? st.minute : st.minute + Math.ceil((e - SUB_OFF_ENERGY) / perMin);
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
    let step = advanceUntilInvolved(st, baseInputs, rng, stretchEnd);
    for (let guard = 0; guard < 20; guard++) {
      const kind = step.request?.kinds.length === 1 ? step.request.kinds[0] : null;
      if (!kind || mayTake(kind) || (kind !== "free_kick" && kind !== "penalty")) break;
      // v0.15 item 6: a penalty your side has won is taken LIVE by the team's
      // taker (loadScenario → loadTeammatePenalty), not handed over as a line.
      if (kind === "penalty" && step.request?.penaltyWon) break;

      const label = kind === "penalty" ? "penalty" : "free kick";
      const scored = rng() < (kind === "penalty" ? 0.76 : 0.09);
      if (scored) {
        // resolveScenario (below) is the one place that increments the
        // score for a "goal" result — this used to also do it here, which
        // counted a handed-over set piece twice on the board while only
        // ever pushing the one event, leaving the scoreline a goal ahead
        // of the commentary and the results page for good.
        handedOver.push({ minute: st.minute, text: `⚽ Your side score the ${label}!`, isGoal: true, teammateGoal: true });
      } else {
        handedOver.push({ minute: st.minute, text: `A ${label} — someone else steps up, and it comes to nothing.` });
      }
      resolveScenario(st, scored ? "goal" : "saved");
      step = advanceUntilInvolved(st, baseInputs, rng, stretchEnd);
    }
    /** Item 25: the stretch ran out because his legs did, not the clock. */
    const legsGone = !step.request && offAt < matchCeilingRef.current && st.minute >= offAt;
    if (legsGone) step = { ...step, fullTime: false };

    const raw = [...handedOver, ...step.events];

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
      const decision = legsGone
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
    setQueue(linesFrom(events.slice(shown), matchMinuteRef.current));
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
  };

  /**
   * A penalty or a direct free kick (lib/star/penaltyRunup.ts): you stand a
   * few steps back and to one side before you aim, not on the ball.
   * Everything else about the picture is untouched. A function declaration
   * so the mount effect above can reach it.
   */
  function standBackForRunup(sc: Scenario) {
    if (hasRunup(sc.kind)) sc.player = standBack(sc.ball, sc.player);
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
    facingRef.current = sc.facing ?? "up";
    viewportRef.current = { ...sc.viewport };
    baseViewportRef.current = { ...sc.viewport };
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
    facingRef.current = sc.facing ?? "up";
    viewportRef.current = { ...sc.viewport };
    baseViewportRef.current = { ...sc.viewport };
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

  // Load a new scenario onto the canvas and enter aim phase.
  const loadScenario = (attacking: boolean) => {
    sceneGenRef.current += 1;
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
    if (openOnRef.current && !chainRef.current) {
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
      // A feature's automatic kick (the Shootout on Infinite Highlights)
      // names its own keeper — castDefence has just put theirs in goal.
      dressAutoKeeper(scenarioRef.current);
      standBackForRunup(scenarioRef.current);
      setUpKeeper(scenarioRef.current, (seedRef.current ^ 0x4b7e) >>> 0);
      facingRef.current = scenarioRef.current.facing ?? "up";
      viewportRef.current = { ...scenarioRef.current.viewport };
      baseViewportRef.current = { ...scenarioRef.current.viewport };
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
      setPhase("aim");
      playWhistle();
      scheduleAutoKick();
      return;
    }

    // What the match has just handed you, if anything. Its zone narrows the
    // scenario to what makes football sense from there; your position still
    // decides which of those you are likeliest to be the one taking.
    const request = attacking ? null : pendingRequestRef.current;
    pendingRequestRef.current = null;

    const chain = chainRef.current;
    chainRef.current = null;

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
        // each, never more than ten men across the whole run.
        fpDribbleRef.current = { waveSizes: pickWaveSizes(rng), seed: Math.floor(rng() * 1e9) };
        setAim(null);
        runupRef.current = null;
        setContactTimerS(null);
        setOutcome(null);
        dragRef.current = null;
        draggingRef.current = false;
        facingRef.current = "up";
        setPhase("fpDribble");
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
        source: chain ? { from: "chain", pos: chain.pos, ambition: chain.ambition, position: positionRef.current }
          : setPiece ? { from: "kind", kind: setPiece }
          : attacking ? { from: "attacking" }
          : request ? { from: "request", request, position: positionRef.current }
          : { from: "weighted", position: positionRef.current },
        rng,
        strength: { keeper: strengthRef.current, team: teamRef.current, vision: visionRef.current },
        memory: pictureMemory("game"),
        selection: chanceMemoryRef.current,
        formation: formationShapeFor(),
        mode: chanceMakerRef.current,
      });
      scenarioRef.current = made.sc;
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

    facingRef.current = scenarioRef.current.facing ?? "up";
    viewportRef.current = { ...scenarioRef.current.viewport };
    baseViewportRef.current = { ...scenarioRef.current.viewport };
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
    playWhistle();
  };

  const restartSession = () => {
    sceneGenRef.current += 1;
    attemptsRef.current = 0;
    tallyRef.current = { shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0 };
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
    kibUsedRef.current = 0;
    setKibUsed(0);
    matchStateRef.current = newMatch(mulberry32(seedRef.current));
    simContinueRef.current = null;
    stretchRef.current = null;
    pendingRequestRef.current = null;
    dribbleRef.current = null;
    flickStartRef.current = null;
    hookedRef.current = null;
    hookedAtRef.current = null;
    chainRef.current = null;
    setStats({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0, misses: 0, lost: 0, dribbles: 0 });
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
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    primeMatchSound();
    // Somebody else's penalty (v0.15 items 6/7): you watch it, you don't take it.
    if (phaseRef.current === "aim" && autoKickOf(scenarioRef.current)) return;
    if (phaseRef.current === "dribble") {
      flickStartRef.current = pitchFromPointer(e.clientX, e.clientY);
      try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
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
      nudgeDragRef.current = { x0: e.clientX, base: ru.nudgeM };
      try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      return;
    }
    if (phaseRef.current !== "aim") return;
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
    if (ballD > (vp.y2 - vp.y1) * 0.28) {
      // Missed both a player and the ball — nothing happens, exactly as
      // before the armband existed.
      return;
    }
    draggingRef.current = true;
    // v0.15 item 21: measured from where the thumb landed, so the pull starts
    // at nothing wherever on the ball's grab zone it lands.
    thumbOriginRef.current = p;
    dragRef.current = { x: b.x, y: b.y };
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current === "dribble") return;
    if (nudgeDragRef.current) {
      const ru = runupRef.current;
      const canvas = canvasRef.current;
      if (ru && !ru.arrived && canvas) {
        // A penalty is always watched straight on ("up"), so sideways on the
        // screen is sideways along the goal line.
        const vp = viewportRef.current;
        const m = nudgeFromDrag(e.clientX - nudgeDragRef.current.x0, canvas.getBoundingClientRect().width, vp.x2 - vp.x1);
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
    dragRef.current = o ? { x: bb.x + (pp.x - o.x), y: bb.y + (pp.y - o.y) } : pp;
    // v0.15 item 22: past the dead zone, the aim is committed.
    if (aimCommitRef.current === null && phaseRef.current === "aim"
        && acceptsCaptainOrders(scenarioRef.current.kind) && screenPull(dragRef.current, bb) >= MIN_PULL) {
      commitAim();
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (nudgeDragRef.current) {
      // The swing stays where you left it; another drag carries on from there.
      nudgeDragRef.current = null;
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
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
    runupRef.current = {
      t: 0, dir0, power, nudgeM: 0,
      path: { from: { x: sc.player.x, y: sc.player.y }, to: plantBeside(sc.ball, sc.player) },
      nudge: !auto && canNudge(sc.kind), arrived: false,
      ...(auto ? { auto } : {}),
    };
    if (auto) { setPhase("runup"); return; }
    nudgeDragRef.current = null;
    setAim({ dir: dir0, power });
    setPhase("runup");
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
    contact: { cx: number; cy: number },
    over?: { dir: { x: number; y: number }; power: number; skills?: KickSkills },
  ) => {
    const a = over ? { dir: over.dir, power: over.power } : aim;
    if (!a) return;
    const auto = over?.skills ? { skills: over.skills } : null;
    setContactTimerS(null);
    // A dead ball is struck with your free-kick rating, not your general
    // technique — the one strike in football that is purely placement and curl.
    const tired = tiredSkills();
    const strikeWith = auto ? auto.skills : setPieceSkills(
      tired,
      careerRef.current?.skills.freeKick ?? setPieceSkillRef.current ?? tired.technique,
      scenarioRef.current.kind,
    );
    // ── Shot power: the top is flattened (v0.15, item 11b) ── the ball is
    // struck with the curve's power (lib/star/strikePower.ts): the same number
    // up to 80, much less added above it. The drag was already read off your
    // real power (powerFromDrag), so it feels exactly the same. The Play
    // Area's compare switch "Shot power" puts the old straight line back on
    // one device's test screens (never the real game).
    const launchWith = switchOn("powerCurve")
      ? { ...strikeWith, power: strikingPower(strikeWith.power) }
      : strikeWith;
    // Snapshot everything a replay would need to reproduce this exact strike
    // — see GoalReplay and rngCallCountRef. Cheap and thrown away unless the
    // ball actually ends up in the net (resolveOutcome), so this costs
    // nothing on the far more common outcome of a shot that doesn't score.
    // `skills` is what the ball was struck WITH, so a goal replays at the
    // pace it was scored at. Never for somebody else's kick: it is not a
    // goal of yours to save.
    pendingReplayRef.current = auto ? null : {
      seed: seedRef.current,
      callsBeforeStrike: rngCallCountRef.current,
      scenario: JSON.parse(JSON.stringify(scenarioRef.current)),
      dir: a.dir,
      power: a.power,
      contact,
      skills: launchWith,
    };
    // Starts recording this strike's own substep sizes — see
    // GoalReplay.flightDtLog. Reset here, alongside pendingReplayRef, so a
    // follow-up strike on a loose ball starts its own log rather than
    // carrying over the shot that came before it.
    flightDtLogRef.current = [];
    deflectionsRef.current = 0;
    ballRef.current = launch(scenarioRef.current, a.dir, a.power, contact, launchWith, rngRef.current);
    // ── The keeper brain sees you strike it ── its own seeded stream (built
    // the way the penalty read's is), and a snapshot of him as he stands, so
    // a goal replay throws exactly the same dive. For a penalty the brain
    // throws the dive the penalty rule set decides (penaltyKeeper.ts), so the
    // plain read below is only for a chance with no brain.
    if (hasBrain(scenarioRef.current)) {
      const bs = ((seedRef.current ^ Math.imul(rngCallCountRef.current + 1, 0xc2b2ae35)) ^ 0x4b7f) >>> 0;
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
      const r = mulberry32(((seedRef.current ^ Math.imul(rngCallCountRef.current + 1, 0x9e3779b1)) ^ 0x5eed) >>> 0);
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
    } else {
      pushLine(commentaryStrike(scenarioRef.current.kind, rngRef.current, targetName(scenarioRef.current)));
    }
    playKick();
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
  const homeTeam = matchMode ? (fixture!.home ? career?.player.club ?? "You" : fixture!.opponent) : "";
  const awayTeam = matchMode ? (fixture!.home ? fixture!.opponent : career?.player.club ?? "You") : "";
  const homeScore = matchMode ? (fixture!.home ? displayScore.user : displayScore.opp) : 0;
  const awayScore = matchMode ? (fixture!.home ? displayScore.opp : displayScore.user) : 0;

  const statCell = (label: string, value: string, valueClass: string) => (
    <div className="min-w-0 px-1 py-1 text-center">
      <div className="whitespace-nowrap text-[11px] uppercase tracking-tight text-white font-bold leading-none">{label}</div>
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

  return (
    <div className="w-full max-w-sm mx-auto">
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

      {/* Scoreboard plate. Hidden in `bare` — see the prop. */}
      {!bare && (
      <div className="mb-2 rounded-lg overflow-hidden border border-emerald-800/70 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 shadow-lg">
        <div className="flex items-stretch">
          <div className="px-2.5 flex items-center border-r border-white/5 text-[11px] font-black uppercase tracking-[0.08em] text-emerald-300/90">
            {matchMode && career ? competitionAbbrev(fixture!, divisionOf(career)) : "Match Lab"}
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
          <button
            onClick={toggleMuted}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            className="px-2.5 flex items-center border-l border-white/10 text-white/80 hover:text-amber-300 transition"
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
        className="relative w-full aspect-[5/8] rounded-xl overflow-hidden border-2 border-emerald-800/80 shadow-2xl shadow-emerald-950/60"
        style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`absolute inset-0 w-full h-full ${phase === "aim" ? "cursor-grab" : phase === "runup" ? "cursor-ew-resize" : "cursor-default"}`}
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
            className={`absolute top-2 right-2 z-30 pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black tracking-wide shadow-lg transition ${
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

        {/* The first-person duel — see USE_FIRST_PERSON_DRIBBLE. A full
            overlay over the canvas (it manages its own camera/render loop
            entirely), not something drawn onto it the way the old top-down
            dribble is. `waveSizes`/`seed` are rolled once at trigger time
            (fpDribbleRef) and held fixed so this never remounts mid-run. */}
        {phase === "fpDribble" && fpDribbleRef.current && (
          <FirstPersonDribble
            embedded
            pace={100}
            oppStrength={100}
            waveSizes={fpDribbleRef.current.waveSizes}
            roster={fpRoster}
            seed={fpDribbleRef.current.seed}
            chaseEye={5}
            chasePitchDeg={5}
            chaseOffset={4}
            cameraFollowRate={10}
            onComplete={finishFpDribble}
          />
        )}

        {/* Contact overlay. After a run-up it has a countdown
            (penaltyRunup.ts); run out and the kick is scuffed. */}
        {phase === "contact" && aim && (
          <ContactBall
            power={aim.power}
            onContact={(c) => handleContact(c)}
            timeLimitS={contactTimerS ?? undefined}
            onTimeout={contactTimerS ? handleScuff : undefined}
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

        {/* Action banner — the moment an action actually completes. "PASS" when
            a team-mate brings your ball under control, "GOAL" when it goes in.
            Sits high so it never covers the strike itself. */}
        {actionBanner && (
          <div className="absolute inset-x-0 top-[18%] flex items-center justify-center pointer-events-none z-20">
            <div
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
        {phase === "result" && outcome === "offside" && scene?.banners !== false && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="kib-pop text-4xl font-black tracking-wider drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] px-6 py-3 rounded-xl text-yellow-200 bg-gray-950/70 ring-1 ring-yellow-400/50">
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
            onEnergyMode={setEnergyMode}
            kibCans={Math.max(0, (career?.kibCans?.basic ?? 0) - kibUsed)}
            onUseKib={drinkHalfTimeKib}
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
      </div>

      {/* Live commentary ticker and the situation hint — both only for the
          standalone sandbox now. In a real match the commentary phase already
          shows every one of these lines (and more) a moment later, so running
          both was the same four lines twice; the hint was explanatory copy a
          returning player does not need re-explained to them every single
          chance. Reported directly: neither is wanted once you are actually
          playing, only while learning the game. */}
      {!matchMode && !bare && (
        <>
          <div className={`mt-2 rounded-lg border border-gray-800 bg-gray-950/85 px-3 py-2 min-h-[3.8rem] ${phase === "feed" ? "hidden" : ""}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="kib-live inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[8px] font-black tracking-[0.22em] text-white/70 uppercase">Live Commentary</span>
            </div>
            <div className="space-y-0.5">
              {feed.length === 0 && <div className="text-[11px] text-white/65 italic">Kick-off…</div>}
              {feed.map((line, i) => (
                <div
                  key={i}
                  className={`text-[11px] leading-snug pl-2 border-l-2 ${
                    i === feed.length - 1 ? "text-white font-bold border-emerald-500/80" : "text-white/70 border-transparent"
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 bg-gray-900/70 border border-gray-800 rounded-lg px-3 py-2 text-[10px] text-white/85 text-center">
            <span className="text-amber-300">💡</span> {scenarioLabel.hint}
          </div>
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
