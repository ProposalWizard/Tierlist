"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  buildWeightedScenario, buildAttackingScenario, buildScenario, pickScenarioKindFrom,
  launch, stepBall, stepBallInNet, settleBall, stepBallPastBar,
  stepKeeper, stepDefenders, stepReactions, stepTouchChase, initDefenders, resetForTouchOn,
  chainKindFor, chainReturnChance, CHAIN_MAX, TOUCH_CHAIN_MAX, applyFirstTouch, goalInView,
  OUTCOME_TEXT, clamp, dragForFullPower, VIEW_ASPECT,
  orderableRunners, acceptsCaptainOrders,
  curveDirFromSwipe, applyCurveSwipe,
  setOffsideRuleEnabled,
  type Scenario, type Ball, type Outcome, type KickSkills, type ScenarioKind, type Viewport,
  type Facing, type Runner,
} from "@/lib/star/canvasEngine";
import {
  newMatch, advanceUntilInvolved, advanceTo, resolveScenario,
  type HiddenMatchState, type HiddenMatchInputs, type ScenarioRequest, type ScenarioResult, type HiddenMatchEvent,
} from "@/lib/star/hiddenMatch";
import { applyChancePlan } from "@/lib/star/chanceFormula";
import { applyAuthoredShape, nextAuthoredShape } from "@/lib/star/authoredChance";
import { fixBaseScenario } from "@/lib/star/baseScenario";
import { selectChance, newSelectionMemory } from "@/lib/star/scenarioSelect";
import { setPieceSkills, type SetPieceDuties } from "@/lib/star/setPieces";
import { conditionsFor, conditionsLine, type Conditions } from "@/lib/star/weather";
import {
  newDribble, stepDribble, flick, dribbleProgress, dribbleViewport, type DribbleState,
} from "@/lib/star/dribble";
import { pickWaveSizes } from "@/lib/star/firstPersonDribble";
import FirstPersonDribble from "./FirstPersonDribble";
import type { FpIdentity } from "@/lib/star/firstPersonDribble";
import {
  PITCH_W, HALF_LEN, CX, POST_L, POST_R, NET_DEPTH, GOAL_H,
  SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH,
  PEN_SPOT_Y, ARC_R, CENTRE_R, CORNER_R,
} from "@/lib/star/pitch";
import { mulberry32 } from "@/lib/star/season";
import { ruleBookFor } from "@/lib/star/ruleBook";
import {
  commentaryBuildup, commentaryStrike, commentaryReceived, commentaryReceiverShot, commentaryResult,
} from "@/lib/star/matchCommentary";
import {
  primeMatchSound, setMatchSoundMuted, playKick, playNet, playPost, playSave, playWhistle, playCrowdSwell,
} from "@/lib/star/matchSound";
import { finaliseMatch, liveRating, regressForMinutes } from "@/lib/star/matchStats";
import { hookCheck, type HookReason } from "@/lib/star/selection";
import { pickSquadScorer, pickSquadAssist } from "@/lib/star/squadData";
import { castScenario, castDefence, creatorOf, orderDefensively, type OpponentSheetPlayer } from "@/lib/star/lineup";
import { applyFormationShape, formationShapeInput, type ShapeInput } from "@/lib/star/formationShape";
import { loadFaceStyle, DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle, DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import { DEFAULT_FAKE_FACE, fakeFaceFor } from "@/lib/star/fakeFaces";
import {
  drawFigureAt, drawKeeperAt, figureRForHeight, MATCH_FIGURE_HEIGHT_R, MATCH_FIGURE_R_MULT,
  MAX_KEEPER_LEAN, ROLE_KIT,
  runPhase as sharedRunPhase, poseFor as sharedPoseFor, bodyPoseFor, type FigurePose,
} from "@/lib/star/fiveASide/render";
import { createFaceImageCache } from "@/lib/star/faceImageCache";
import { startingTeammateRoles, onPitchToday, fillMissingFromFullRoster, opponentStartingXI } from "@/lib/star/teamsheet";
import { creditChance, type CreditDelta } from "@/lib/star/credit";
import { kitsFor, type MatchKits } from "@/lib/star/kits";
import { competitionAbbrev } from "@/lib/star/competitions";
import { shortClub } from "@/lib/star/media/grammar";
import { divisionOf } from "@/lib/star/calendar";
import type { CareerState, MatchStats, Fixture, GoalEvent, OppGoalEvent, SquadPlayer, GoalReplay } from "@/lib/star/types";
import ContactBall from "./ContactBall";
import PostMatch from "./PostMatch";
import MatchCommentary from "./MatchCommentary";
import ShootoutOverlay from "./ShootoutOverlay";
import { hasExtraTime, extraTimeScore, type ExtraTimeCompetition } from "@/lib/star/shootout";
import { currentTie as euroCurrentTie, currentLeg as euroCurrentLeg } from "@/lib/star/euro";
import {
  line as logLine, linesFrom, halfTimeSplit, dwellFor, HALF_TIME_MINUTE,
  type LogLine,
} from "@/lib/star/matchLog";

/**
 * `feed` is the commentary screen, and it is where a match LIVES — see
 * lib/star/matchLog. The pitch phases are what it cuts away to. It used to be
 * called `sim` and was a panel that appeared over the pitch to report minutes
 * you had already skipped past.
 */
type Phase = "aim" | "contact" | "flight" | "result" | "feed" | "postmatch" | "dribble" | "fpDribble" | "shootout";

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

export default function CanvasMatch({ skills = { power: 55, technique: 55 }, canCurve = false, canExtraTouch = false, keeperStrength = 62, position = "ST", teamRelationship = 60, career = null, seed = 12345, fixture, oppStrength, onComplete, startMinute = 0, duties, conditions, replayOf, onGoalScored, openOn, bare = false }: Props) {
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
  const tallyRef = useRef({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
  const userScoreRef = useRef(0);
  const oppScoreRef = useRef(0);
  const goalEventsRef = useRef<GoalEvent[]>([]);
  const oppGoalEventsRef = useRef<OppGoalEvent[]>([]);
  const [finalStats, setFinalStats] = useState<MatchStats | null>(null);

  // --- Simulation between chances ---
  const matchMinuteRef = useRef(0);
  const [matchMinute, setMatchMinute] = useState(0);
  /**
   * Energy at kickoff, seeded once (React's lazy useRef initializer, not
   * re-synced like careerRef) — the career's own value isn't touched again
   * until this whole match reports back via onComplete, so there's nothing
   * to re-seed from mid-match. Falls back to fully fresh for the sandbox,
   * which has no real career (or no energy tracking) to seed from at all.
   */
  const startEnergyRef = useRef(career?.energy ?? 100);
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
  const [pause, setPause] = useState<{ label?: string; cta: string; onContinue: () => void } | null>(null);
  const halfTimeShownRef = useRef(false);
  /** What to do once the queue has emptied. */
  const simContinueRef = useRef<(() => void) | null>(null);

  // The match going on around you. It owns possession, territory and momentum;
  // your chances are what it hands you, and their kind is decided by where the
  // ball actually was when it found you.
  const matchStateRef = useRef<HiddenMatchState>(newMatch(mulberry32(seed)));
  const startMinuteRef = useRef(startMinute);
  startMinuteRef.current = startMinute;
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
  /** The last few hand-authored scenarios served, so the same drawing is
   *  never two chances running. See lib/star/authoredChance.ts. */
  const authoredMemoryRef = useRef<string[]>([]);
  /** See the `openOn` prop. Held in a ref so the render loop reads the
   *  current one without re-creating every callback that touches it. */
  const openOnRef = useRef(openOn);
  openOnRef.current = openOn;

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
  const ENERGY_MATCH_DECAY = 20;
  const liveEnergyAt = (minute: number) => {
    const decay = Math.min(ENERGY_MATCH_DECAY, (Math.max(0, minute) / MATCH_DURATION) * ENERGY_MATCH_DECAY);
    return Math.max(0, startEnergyRef.current - decay);
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
  const TIRED_SKILLS_MAX_CUT = 0.15;
  const tiredSkills = (): KickSkills => {
    const energy = liveEnergyAt(matchMinuteRef.current);
    const cut = (1 - energy / 100) * TIRED_SKILLS_MAX_CUT;
    return { power: skills.power * (1 - cut), technique: skills.technique * (1 - cut) };
  };

  const hiddenInputs = (): HiddenMatchInputs => {
    const car = careerRef.current;
    return {
      teamStrength: teamRef.current,
      oppStrength: oppStrengthRef.current,
      playerSkill: car ? (car.skills.power + car.skills.technique + car.skills.vision) / 3 : 55,
      home: fixture?.home,
      pace: careerRef.current?.skills.pace,
      // So a corner/free kick/penalty is weighted by the position you play
      // like every other chance is, instead of bypassing it — see
      // buildRequest's dead-ball block in hiddenMatch.ts.
      position: positionRef.current,
      energy: liveEnergyAt(matchMinuteRef.current),
      impactSub: startMinuteRef.current > 0,
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
  strengthRef.current = realKeeperOverall !== undefined
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

  // strengthRef.current is already the real keeper's own rating here when
  // there is one — see its own assignment just above — so the very first
  // scenario of the match reads the same number every later one does.
  // The FIRST chance is built right here, at ref creation — `loadScenario`
  // only ever runs once one has RESOLVED. So a hand-picked picture has to be
  // honoured in both places: a first attempt wired only `loadScenario` and
  // the Play overlay opened on a build-up, because the opening scene had
  // already been built before that function was ever called. See `openOn`.
  const scenarioRef = useRef<Scenario>(
    openOn
      ? openOn()
      : buildWeightedScenario(mulberry32(seed), position, strengthRef.current, teamRelationship, career?.skills.vision ?? 55),
  );
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

  // ── Extra time / penalty shootout ──
  //
  // Set only when a level knockout tie needs a shootout — see
  // `resolveFullTime` below, called from the Full Time pause instead of
  // finalising the match immediately. `wentToExtraTimeRef` records whether
  // extra time was played at all (even if it then resolved outright,
  // without needing penalties) so the final MatchStats carries it either way.
  const [shootoutInfo, setShootoutInfo] = useState<{
    homeClub: string; awayClub: string; yourSide: "home" | "away";
    yourSkill: number; teamSkill: number; oppSkill: number;
  } | null>(null);
  const wentToExtraTimeRef = useRef(false);
  const shootoutResultRef = useRef<{ home: number; away: number } | null>(null);
  // The live-chance loop's own "how far can this match still run" ceiling.
  // Every `advanceUntilInvolved`/`advanceTo` call in `startSimulation` reads
  // THIS, not the constant `MATCH_DURATION`, so extra time can extend it in
  // two real 15-minute stages and the interactive aim/contact/flight loop
  // just keeps running against the new ceiling — instead of extra time being
  // a single non-interactive jump straight to the final minute. 0 = normal
  // time; 1 = first half of extra time in progress; 2 = second half.
  const matchCeilingRef = useRef(MATCH_DURATION);
  const extraTimeStageRef = useRef<0 | 1 | 2>(0);
  // A live, player-controlled shootout kick in progress — see
  // `loadShootoutPenalty`. Non-null while the aim/contact/flight canvas is
  // standing in for the corner-picker UI for exactly one kick; resolveOutcome
  // reads this to report the REAL physical result back to the shootout state
  // machine instead of resuming the ordinary match simulation.
  const shootoutKickRef = useRef<{ resolve: (scored: boolean) => void } | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);

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
  const [stats, setStats] = useState({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
  const [feed, setFeed] = useState<string[]>([]);
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
  useEffect(() => {
    if (pause || queue.length === 0) return;
    const next = queue[0];
    const t = setTimeout(() => {
      setLog(l => [...l, next]);
      setQueue(q => q.slice(1));
      if (next.minute !== undefined) {
        matchMinuteRef.current = next.minute;
        setMatchMinute(next.minute);
      }
      // Half time is inserted by the streamer rather than by the simulation,
      // which runs 1 to 90 and has never had an interval. See matchLog.
      if (!halfTimeShownRef.current && next.minute !== undefined && next.minute > HALF_TIME_MINUTE) {
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
          onContinue: () => setPause(null),
        });
      }
    }, dwellFor(next.tone, speed));
    return () => clearTimeout(t);
  }, [queue, pause, speed]);

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
    // A beat on the last line before the pitch takes the screen, so a chance
    // does not arrive on top of the sentence that set it up.
    const t = setTimeout(() => {
      simContinueRef.current = null;
      go();
    }, Math.round(700 / Math.max(1, speed)));
    return () => clearTimeout(t);
  }, [queue, pause, phase, speed]);

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
    // its defensive shape assigning here too.
    scenarioRef.current.conditions = conditionsRef.current;
    initDefenders(scenarioRef.current, rngRef.current);
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
        const before = advanceTo(st, hiddenInputs(), rng, startMinuteRef.current);
        userScoreRef.current = st.userScore;
        oppScoreRef.current = st.oppScore;
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
    return Math.hypot((a.sx - b.sx) * VIEW_ASPECT, a.sy - b.sy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const powerFromDrag = useCallback((drag: { x: number; y: number }, ball: { x: number; y: number }) => {
    return clamp(screenPull(drag, ball) / dragForFullPower(skills.power), 0, 1);
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
    // The pitch is a flat plan and the goal is the one thing on it drawn with
    // HEIGHT: posts standing on the goal line, a crossbar across their tops, the
    // netting stretched back behind them and a second frame at the back. That is
    // not a departure from the overhead camera — it is the same trick the ball
    // already uses, being lifted off its own shadow — and it is drawn at exactly
    // that scale, so a ball over the bar is visibly over the bar.
    //
    // Built as five surfaces, drawn back to front, because that is what a goal
    // is. What it replaced was a single flat panel with an even mesh over it,
    // and rendering the two side by side at matched width said why that read as
    // a window rather than a goal: **no tonal separation**. A goal's roof
    // catches the light and its mouth is in shadow, and with both the same
    // brightness there is nothing to tell you which way is in.
    {
      const hpx = GOAL_H * heightScale;
      const bl = P(POST_L, 0), br = P(POST_R, 0);                 // feet of the posts
      const tl = { px: bl.px, py: bl.py - hpx };                  // top of the near post
      const tr = { px: br.px, py: br.py - hpx };
      const rl = P(POST_L, -NET_DEPTH), rr = P(POST_R, -NET_DEPTH); // feet at the back
      const ul = { px: rl.px, py: rl.py - hpx };                  // and the back frame
      const ur = { px: rr.px, py: rr.py - hpx };

      type Pt = { px: number; py: number };
      const path = (q: Pt[]) => {
        ctx.beginPath();
        ctx.moveTo(q[0].px, q[0].py);
        for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].px, q[i].py);
        ctx.closePath();
      };
      const quad = (q: Pt[], fill: string) => { path(q); ctx.fillStyle = fill; ctx.fill(); };
      const seg = (a2: Pt, b2: Pt) => { ctx.beginPath(); ctx.moveTo(a2.px, a2.py); ctx.lineTo(b2.px, b2.py); ctx.stroke(); };
      const lerp = (a2: Pt, b2: Pt, f: number) => ({ px: a2.px + (b2.px - a2.px) * f, py: a2.py + (b2.py - a2.py) * f });
      // Netting over a surface: strands both ways, clipped to it.
      const netting = (q: Pt[], cols: number, rows: number, alpha: number) => {
        ctx.save();
        path(q); ctx.clip();
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = Math.max(0.7, unit * 0.028);
        for (let i = 0; i <= cols; i++) { const f = i / cols; seg(lerp(q[0], q[1], f), lerp(q[3], q[2], f)); }
        for (let j = 0; j <= rows; j++) { const f = j / rows; seg(lerp(q[0], q[3], f), lerp(q[1], q[2], f)); }
        ctx.restore();
      };

      // Its shadow on the grass.
      const sh = unit * 0.5;
      quad([rl, rr, br, bl].map(q => ({ px: q.px + sh, py: q.py + sh * 0.3 })), "rgba(0,0,0,0.09)");
      // The floor inside — barely shaded, because it is grass and you are
      // looking straight at it through an open mouth.
      quad([bl, br, rr, rl], "rgba(20,50,32,0.05)");
      // The back of the net: the deepest surface, and the one you see through
      // the mouth. Dimmer than the roof, which is what separates the two — in a
      // straight-down view a horizontal roof and a vertical back wall both come
      // out as flat bands, so shading is the only thing that can tell them apart.
      quad([rl, rr, ur, ul], "rgba(22,52,34,0.16)");
      netting([rl, rr, ur, ul], 34, 10, 0.42);
      ctx.strokeStyle = "#0f1a14";
      ctx.lineWidth = Math.max(1.8, unit * 0.15);
      seg(rl, ul); seg(rr, ur); seg(ul, ur);
      // The roof, catching the light — brighter than the back, deliberately.
      quad([tl, tr, ur, ul], "rgba(236,245,239,0.30)");
      netting([tl, tr, ur, ul], 34, 5, 0.8);
      // ── Nothing is drawn across the mouth ──
      //
      // The mouth is a hole. The net hangs BEHIND the posts and across the back,
      // and what you see through the opening is that back net in the upper part
      // and plain grass below it — which is exactly what the geometry gives you
      // once you stop drawing a second net across the front. Meshing the front
      // face too put netting on both sides of the frame: "it's everywhere, it's
      // at the front of the goal as well."

      // The frame at the front. The two objects a shot can actually hit.
      ctx.lineCap = "round";
      ctx.strokeStyle = "#f6faf7";
      ctx.lineWidth = Math.max(1.8, unit * 0.12);
      seg(bl, tl); seg(br, tr);
      ctx.lineWidth = Math.max(2, unit * 0.16);
      seg(tl, tr);
      ctx.lineCap = "butt";

      // The goal line on the ground, thin — the frame above it is the loud part.
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1.5, unit * 0.11);
      pLine(POST_L, 0, POST_R, 0);
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

    const footballer = (
      x: number, y: number, rBase: number,
      shirt: string, rim: string,
      opts: { pose?: Pose; phase?: number; facing?: number; label?: string; labelColor?: string; shorts?: string; star?: boolean; face?: HTMLImageElement } = {},
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
    if (goalInView(sc.kind)) {
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
    if (isCaptainRef.current && phaseRef.current === "aim" && acceptsCaptainOrders(sc.kind)) {
      drawCaptainOrders(sc);
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
      const KR = R * 0.82 * kScale;   // smaller than an outfielder, smaller again far away
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
      drawKeeperAt(
        ctx,
        cx + KR * weight * (1 - lunge), py, kr,
        {
          shirt: kitsRef.current.keeper.shirt,
          shorts: kitsRef.current.keeper.trim,
          trim: kitsRef.current.keeper.trim,
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
          label: faceStyleRef.current.namesEnabled ? kk.who?.shortName : undefined,
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
    const keeperInView = goalInView(sc.kind);
    const liveBall = ballRef.current;
    const ballY = liveBall ? liveBall.pos.y : (phaseRef.current === "aim" ? sc.ball.y : null);
    const ballBehindKeeper = keeperInView && ballY !== null && ballY < sc.keeper.y;

    if (keeperInView && !ballBehindKeeper) drawKeeper();

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

    const ball = ballRef.current;
    if (ball) drawBall(ball.pos.x, ball.pos.y, ball.z);
    else if (phaseRef.current === "aim") drawBall(sc.ball.x, sc.ball.y, 0);

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
    if (phaseRef.current === "aim" && draggingRef.current && dragRef.current) {
      const d = dragRef.current;
      const power = powerFromDrag(d, sc.ball);
      const dx = sc.ball.x - d.x, dy = sc.ball.y - d.y;
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
          const caughtUp = touchLive && stepTouchChase(scenarioRef.current, ballRef.current, h);
          let res = stepBall(ballRef.current, scenarioRef.current, rngRef.current, h);
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
    const youShot = ballRef.current?.youStruckAtGoal === true && !receiverShot;
    const isSimplePass = !youShot && !receiverShot && sc.passTarget != null;
    const kind = OUTCOME_TEXT[res].kind;

    // A live shootout kick (see loadShootoutPenalty) is NOT a chance in the
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
    if (!isShootoutKick) {
      t.shots += d.shots;
      t.goals += d.goals;
      t.passes += d.passes;
      t.passesCompleted += d.passesCompleted;
      t.chances += d.chances;
      t.assists += d.assists;
      setStats({ ...t });
    }

    // Your team scores whenever the ball ends up in the net — your own finish or a
    // teammate you set up (same rule the old DOM match used: goal || assist).
    if (!isShootoutKick && kind === "goal") {
      userScoreRef.current += 1;
    }

    // Hand the outcome back to the match. Without this it would carry on as
    // though your moment never happened — you would score and the ball would
    // still be in their box. Not for a shootout kick — there is no ongoing
    // hidden-match state to hand it back to.
    if (!isShootoutKick && matchModeRef.current) resolveScenario(matchStateRef.current, matchResultFor(res));

    // Celebration / impact FX + sound, matched to what the physics produced.
    if (kind === "goal") {
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
    if (!isShootoutKick && kind === "goal" && careerRef.current) {
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
          label: `${verb} · ${matchMinuteRef.current}'`,
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
            goalEventsRef.current, null, oppGoalEventsRef.current, fixture,
          ),
          endEnergy: liveEnergyAt(matchMinuteRef.current),
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
    setStats({ ...t });
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
    setStats({ ...t });
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
  const startSimulation = () => {
    sceneGenRef.current += 1;
    seedRef.current += 1;
    const rng = countedRng(seedRef.current, rngCallCountRef);
    rngRef.current = rng;

    // The refs are the authority on the scoreline (the HUD reads them, and your
    // own goals are credited in resolveOutcome), so the match is synced to them
    // before it runs rather than keeping a second, divergent count.
    const st = matchStateRef.current;
    st.userScore = userScoreRef.current;
    st.oppScore = oppScoreRef.current;

    // Dead balls you are not the taker for go to whoever is. Keep advancing
    // until the match hands you something that is actually yours — bounded,
    // because every pass moves the clock and the clock ends the match.
    let step = advanceUntilInvolved(st, hiddenInputs(), rng, matchCeilingRef.current);
    const handedOver: HiddenMatchEvent[] = [];
    for (let guard = 0; guard < 20; guard++) {
      const kind = step.request?.kinds.length === 1 ? step.request.kinds[0] : null;
      if (!kind || mayTake(kind) || (kind !== "free_kick" && kind !== "penalty")) break;

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
      step = advanceUntilInvolved(st, hiddenInputs(), rng, matchCeilingRef.current);
    }

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
    const events: SimEvent[] = nameTeamGoals(raw, squad, rng, true);

    if (st.oppScore > oppScoreRef.current) playCrowdSwell("groan");
    else if (st.userScore > userScoreRef.current) playCrowdSwell("cheer");
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
    if (!hookedRef.current && !step.fullTime) {
      const t = tallyRef.current;
      const decision = hookCheck({
        minute: st.minute,
        startMinute: startMinuteRef.current,
        liveRating: liveRating(attemptsRef.current, t.goals, t.assists, t.passesCompleted, st.userScore, st.oppScore),
        scoreDiff: st.userScore - st.oppScore,
        rng,
        liveEnergy: liveEnergyAt(st.minute),
      });
      if (decision.hooked) {
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
        const after = advanceTo(st, hiddenInputs(), rng, matchCeilingRef.current);
        events.push(...nameTeamGoals(after, onPitch(careerRef.current?.squad ?? []), rng, false));
        userScoreRef.current = st.userScore;
        oppScoreRef.current = st.oppScore;
        step = { ...step, request: null, fullTime: true };
      }
    }

    pendingRequestRef.current = step.request;

    // ── Into the commentary, a line at a time ──
    //
    // The minute is NOT jumped to here: it is advanced by the streamer as each
    // line is read out, which is the difference between watching the clock run
    // and being told where it got to. See the queue effect.
    setQueue(linesFrom(events, matchMinuteRef.current));
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
              Math.max(1, (hookedAtRef.current ?? matchMinuteRef.current) - startMinuteRef.current),
              userScoreRef.current, oppScoreRef.current, careerForStats,
              goalEventsRef.current, hookedRef.current, oppGoalEventsRef.current, fixture,
            ),
            // The moment the match actually ended for you — full time, or
            // the minute you were hooked — not necessarily 90.
            endEnergy: liveEnergyAt(hookedAtRef.current ?? matchMinuteRef.current),
            ...(wentToExtraTimeRef.current ? { wentToExtraTime: true } : {}),
            ...(shootoutResultRef.current ? { shootout: shootoutResultRef.current } : {}),
          };
          if (matchModeRef.current && onCompleteRef.current) {
            onCompleteRef.current(stats);
          } else {
            setFinalStats(stats);
            setPhase("postmatch");
          }
        };

        const runShootout = () => {
          const yourSide: "home" | "away" = fixtureHomeRef.current ? "home" : "away";
          const homeClub = fixtureHomeRef.current ? (careerRef.current?.player.club ?? "Home") : (fixture?.opponent ?? "Away");
          const awayClub = fixtureHomeRef.current ? (fixture?.opponent ?? "Away") : (careerRef.current?.player.club ?? "Home");
          // A deliberate, honestly-scoped simplification (see
          // ShootoutOverlay.tsx's own doc comment): every kick that isn't
          // yours (teammate or opponent) still resolves on a real
          // skill-weighted chance rather than a full per-player roster of
          // shooting stats for all twenty-two takers. Your OWN kick is now a
          // real, live aim/contact/flight penalty — see loadShootoutPenalty
          // and handleShootoutYourKick — not a corner pick.
          const yourSkill = ((skills.technique ?? 55) + (skills.power ?? 55)) / 2;
          const teamSkill = Math.max(30, yourSkill - 8);
          const oppSkill = oppStrengthRef.current;
          setShootoutInfo({ homeClub, awayClub, yourSide, yourSkill, teamSkill, oppSkill });
          setPhase("shootout");
        };

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
              matchCeilingRef.current = MATCH_DURATION + 30;
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
          return [...l, logLine(`Full Time  ${homeFinal} - ${awayFinal}`, "period", MATCH_DURATION)];
        });
        setMatchMinute(MATCH_DURATION);

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
            matchCeilingRef.current = MATCH_DURATION + 15;
            setLog(l => [...l, logLine(
              "Extra time — first half.", "period", MATCH_DURATION,
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
   * The player's OWN shootout kick — a real, live penalty.
   *
   * Every other kick in a shootout (teammate or opponent) still resolves on
   * `penaltyConversionChance`'s skill-weighted roll — there is no real
   * per-player roster of shooting stats for all twenty-two takers to draw
   * on. But the PLAYER's own kick used to be the same kind of roll dressed
   * up as a corner pick, which is exactly what was reported as
   * unacceptable: reused directly, the SAME real dead-ball penalty
   * `buildScenario("penalty", …)` already builds for an ordinary in-game
   * penalty (see the `mayTake`/`loadScenario` branch above) — you drag to
   * aim, strike, and the keeper's own real save physics decide it, with no
   * time limit, exactly like any other player-controlled chance in this
   * game. `onResult` is called once the real outcome is known (see
   * `resolveOutcome`'s `shootoutKickRef` branch).
   */
  const loadShootoutPenalty = (oppSkill: number, onResult: (scored: boolean) => void) => {
    sceneGenRef.current += 1;
    seedRef.current += 1;
    rngRef.current = countedRng(seedRef.current, rngCallCountRef);
    const rng = rngRef.current;

    chainRef.current = null;
    dribbleRef.current = null;
    fpDribbleRef.current = null;

    scenarioRef.current = buildScenario("penalty", rng, oppSkill, teamRef.current, visionRef.current);
    scenarioRef.current.conditions = conditionsRef.current;
    castScenario(scenarioRef.current, onPitch(careerRef.current?.squad ?? []));
    initDefenders(scenarioRef.current, rng);
    castDefence(scenarioRef.current, oppXIForCast);

    facingRef.current = scenarioRef.current.facing ?? "up";
    viewportRef.current = { ...scenarioRef.current.viewport };
    baseViewportRef.current = { ...scenarioRef.current.viewport };
    ballRef.current = null;
    setAim(null);
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
    shootoutKickRef.current = { resolve: onResult };
    setPhase("aim");
    logMoment("Your penalty — up to you.", "you");
    playWhistle();
  };

  /**
   * Wired to `<ShootoutOverlay onYourKick>`. Handed a `submit` function that
   * feeds the real outcome straight into the shootout's own state machine
   * (`takeNextKick`, untouched) — the overlay hides itself (see the render
   * call site's `hidden` prop) for the duration of the live kick, so the
   * canvas underneath is what the player actually sees and plays.
   */
  const handleShootoutYourKick = (submit: (scored: boolean) => void) => {
    const info = shootoutInfo;
    if (!info) return;
    loadShootoutPenalty(info.oppSkill, (scored) => {
      submit(scored);
      setPhase("shootout");
    });
  };

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
      scenarioRef.current.conditions = conditionsRef.current;
      castScenario(scenarioRef.current, onPitch(careerRef.current?.squad ?? []));
      initDefenders(scenarioRef.current, rng);
      castDefence(scenarioRef.current, oppXIForCast);
      facingRef.current = scenarioRef.current.facing ?? "up";
      viewportRef.current = { ...scenarioRef.current.viewport };
      baseViewportRef.current = { ...scenarioRef.current.viewport };
      ballRef.current = null;
      setAim(null);
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
      playWhistle();
      return;
    }

    // What the match has just handed you, if anything. Its zone narrows the
    // scenario to what makes football sense from there; your position still
    // decides which of those you are likeliest to be the one taking.
    const request = attacking ? null : pendingRequestRef.current;
    pendingRequestRef.current = null;

    const chain = chainRef.current;
    chainRef.current = null;

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
        setOutcome(null);
        dragRef.current = null;
        draggingRef.current = false;
        facingRef.current = "up";
        setPhase("fpDribble");
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
      setOutcome(null);
      dragRef.current = null;
      draggingRef.current = false;
      // Its own camera, snapped into place rather than eased, so the run does
      // not begin on the frame the last chance was using.
      facingRef.current = "up";
      viewportRef.current = dribbleViewport(dribbleRef.current);
      baseViewportRef.current = { ...viewportRef.current };
      setPhase("dribble");
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
    /** True once the chance formula has placed this scenario itself. */
    let appliedPlan = false;

    if (chain) {
      if (isTouchContinuation) {
        resetForTouchOn(scenarioRef.current, chain.pos);
      } else {
        // Built from where the pass actually arrived, so playing it into the
        // corner gives you a cutback and finding someone central gives you a shot.
        const kind = chainKindFor(chain.pos, rng, chain.ambition);
        scenarioRef.current = buildScenario(kind, rng, strengthRef.current, teamRef.current, visionRef.current);
      }
      scenarioRef.current.chainDepth = chain.depth;
      // Touch Mode's own separate budget — absent (undefined, reading as 0)
      // for a chain that came from an ordinary completed pass, so touching
      // it always starts a fresh TOUCH_CHAIN_MAX allowance rather than
      // inheriting whatever a PRIOR touch-mode sequence had already spent.
      scenarioRef.current.touchTouches = chain.touchTouches;
    } else if (attacking) {
      scenarioRef.current = buildAttackingScenario(rng, strengthRef.current, teamRef.current, visionRef.current);
    } else if (request) {
      // ── The chance formula (lib/star/chanceFormula.ts) ──
      //
      // Pick one of the generated situations for this request: the same
      // position weighting decides the KIND, and the formula decides which of
      // its many real variants of that kind you actually get, with a short
      // anti-repeat memory so the same situation is never served twice
      // running. Additive and fully reversible: `selectChance` returns null
      // for anything the formula has no variant of (a dead ball, a build-up,
      // a dribble), and that falls straight through to exactly today's
      // behaviour.
      const plan = selectChance({
        request, position: positionRef.current, rng, memory: chanceMemoryRef.current,
        shape: formationShapeFor(),
      });
      if (plan) {
        scenarioRef.current = buildScenario(plan.kind, rng, strengthRef.current, teamRef.current, visionRef.current);
        // The base first (its own defining property, repaired), then the
        // formula expands it. applyChancePlan re-runs fixBaseScenario at the
        // end, so the base always has the last word.
        fixBaseScenario(scenarioRef.current);
        applyChancePlan(scenarioRef.current, plan, rng);
        appliedPlan = true;
      } else {
        const kind = pickScenarioKindFrom(positionRef.current, rng, request.kinds);
        scenarioRef.current = buildScenario(kind, rng, strengthRef.current, teamRef.current, visionRef.current);
      }
    } else {
      scenarioRef.current = buildWeightedScenario(rng, positionRef.current, strengthRef.current, teamRef.current, visionRef.current);
    }

    // ── Play the pictures that were actually DRAWN ──
    //
    // Where a chance kind has hand-authored scenarios
    // (lib/star/authoredScenarios.json, written by the Scenario Gallery),
    // one of them is chosen and laid over the built scenario with a small
    // random nudge on every figure. The nudge is checked against the rule
    // set those same scenarios produce, so a variant that breaks the
    // situation's own definition is thrown away and redrawn — see
    // lib/star/authoredChance.ts for the measured numbers.
    //
    // Additive and fully reversible: a kind with nothing authored for it
    // gets `null` here and falls straight through to exactly today's
    // behaviour. Runs BEFORE castScenario so the real faces are assigned to
    // where the men END UP, not to the procedural positions they no longer
    // occupy.
    let appliedAuthored = false;
    if (!isTouchContinuation) {
      const shape = nextAuthoredShape(scenarioRef.current.kind, rng, authoredMemoryRef.current);
      if (shape) {
        applyAuthoredShape(scenarioRef.current, shape);
        authoredMemoryRef.current.push(shape.sourceId);
        if (authoredMemoryRef.current.length > 3) authoredMemoryRef.current.shift();
        appliedAuthored = true;
      }
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

    // ── Give the block its FORMATION shape ──
    //
    // Reposition the defenders + keeper into the opponent's real defensive
    // block — driven by their formation, their playstyle, and the strength gap
    // between the two sides (lib/star/formationShape.ts). Runs BEFORE
    // initDefenders (so press/cover roles and each man's home spot are read off
    // the new shape) and BEFORE castDefence (so the deepest man gets the
    // centre-back's face). A strict no-op in the sandbox / any match with no
    // real opponent (formationShapeFor is null), and for every kind the layer
    // doesn't touch, so nothing else regresses.
    // Skipped when the chance formula already placed this shape — it reads the
    // SAME targetBlock equations and then frames a deliberate slice of the
    // world shape, and re-running the block layer would drag every man back
    // toward the middle of the camera (the exact "forced into the viewport"
    // the owner ruled out).
    // Also skipped when a hand-authored shape was placed: the block in that
    // picture is where somebody deliberately put it, and re-running the
    // formation layer would drag those men somewhere else. Making a
    // formation MODULATE an authored shape rather than replace it is the
    // next piece of this, and is deliberately not guessed at here.
    if (!appliedPlan && !appliedAuthored) applyFormationShape(scenarioRef.current, formationShapeFor());

    // Give the defence its shape: who presses, who covers a lane, who holds.
    initDefenders(scenarioRef.current, rng);

    // ── And put real faces on the shirts marking you, where there's a real
    // sheet to draw them from ── see castDefence's own doc, lib/star/lineup.ts.
    castDefence(scenarioRef.current, oppXIForCast);

    // You are RECEIVING this one, not starting with it at your feet, so the
    // defence gets the time your first touch cost them. A heavy touch and they
    // are on you before you look up; a good one and you have a moment.
    //
    // A touch-mode re-kick is not a reception — it never left your own
    // feet — so it never pays this cost.
    let heavyTouch = 0;
    if (chain && !isTouchContinuation) heavyTouch = applyFirstTouch(scenarioRef.current, tiredSkills().technique, rng);

    facingRef.current = scenarioRef.current.facing ?? "up";
    viewportRef.current = { ...scenarioRef.current.viewport };
    baseViewportRef.current = { ...scenarioRef.current.viewport };
    ballRef.current = null;
    setAim(null);
    setOutcome(null);
    dragRef.current = null;
    draggingRef.current = false;
    curveSwipeStartRef.current = null;
    // Orders belong to the situation they were given in. A fresh scenario is a
    // fresh set of team-mates in fresh positions, so anything the captain said
    // about the last one is meaningless — and carrying a stale Runner reference
    // across would point at a man who is no longer on the pitch.
    captainDragRef.current = null;
    bumpOrders();
    trailRef.current = [];
    particlesRef.current = [];
    shakeRef.current.t = 0;
    flashRef.current.t = 0;
    setPhase("aim");
    // One line, once per chance — see logMoment. This is the single thing kept
    // from what used to be an unbroken flood of buildup commentary: the moment
    // the ball actually reaches a player of yours to do something with.
    logMoment(momentLine(), "you");
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
    tallyRef.current = { shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 };
    userScoreRef.current = 0;
    oppScoreRef.current = 0;
    goalEventsRef.current = [];
    oppGoalEventsRef.current = [];
    matchMinuteRef.current = 0;
    setMatchMinute(0);
    matchStateRef.current = newMatch(mulberry32(seedRef.current));
    simContinueRef.current = null;
    pendingRequestRef.current = null;
    dribbleRef.current = null;
    flickStartRef.current = null;
    hookedRef.current = null;
    hookedAtRef.current = null;
    chainRef.current = null;
    setStats({ shots: 0, goals: 0, passes: 0, passesCompleted: 0, chances: 0, assists: 0 });
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
    dragRef.current = p;
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (phaseRef.current === "dribble") return;
    if (curveSwipeStartRef.current) {
      curveSwipeCurrentRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (captainDragRef.current) {
      captainDragRef.current.to = pitchFromPointer(e.clientX, e.clientY);
      return;
    }
    if (!draggingRef.current) return;
    dragRef.current = pitchFromPointer(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
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
    if (!d) return;
    const b = scenarioRef.current.ball;
    const power = powerFromDrag(d, b);
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
    setAim({ dir, power });
    setPhase("contact");
  };

  // --- Contact chosen -> launch ---
  const handleContact = (contact: { cx: number; cy: number }) => {
    if (!aim) return;
    // A dead ball is struck with your free-kick rating, not your general
    // technique — the one strike in football that is purely placement and curl.
    const tired = tiredSkills();
    const strikeWith = setPieceSkills(
      tired,
      careerRef.current?.skills.freeKick ?? tired.technique,
      scenarioRef.current.kind,
    );
    // Snapshot everything a replay would need to reproduce this exact strike
    // — see GoalReplay and rngCallCountRef. Cheap and thrown away unless the
    // ball actually ends up in the net (resolveOutcome), so this costs
    // nothing on the far more common outcome of a shot that doesn't score.
    pendingReplayRef.current = {
      seed: seedRef.current,
      callsBeforeStrike: rngCallCountRef.current,
      scenario: JSON.parse(JSON.stringify(scenarioRef.current)),
      dir: aim.dir,
      power: aim.power,
      contact,
      skills: strikeWith,
    };
    // Starts recording this strike's own substep sizes — see
    // GoalReplay.flightDtLog. Reset here, alongside pendingReplayRef, so a
    // follow-up strike on a loose ball starts its own log rather than
    // carrying over the shot that came before it.
    flightDtLogRef.current = [];
    ballRef.current = launch(scenarioRef.current, aim.dir, aim.power, contact, strikeWith, rngRef.current);
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
    if (touchModeOnRef.current && canExtraTouch) {
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

  const scenarioLabel = SCENARIO_LABEL[scenarioRef.current.kind];

  // Match-mode scoreboard (user's club vs opponent, mapped to home/away)
  const homeTeam = matchMode ? (fixture!.home ? career?.player.club ?? "You" : fixture!.opponent) : "";
  const awayTeam = matchMode ? (fixture!.home ? fixture!.opponent : career?.player.club ?? "You") : "";
  const homeScore = matchMode ? (fixture!.home ? displayScore.user : displayScore.opp) : 0;
  const awayScore = matchMode ? (fixture!.home ? displayScore.opp : displayScore.user) : 0;

  const statCell = (label: string, value: string, valueClass: string) => (
    <div className="px-1.5 py-1 text-center">
      <div className="text-[8px] uppercase tracking-widest text-white font-bold leading-none">{label}</div>
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
          <div className="px-2.5 flex items-center border-r border-white/5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300/90">
            {matchMode && career ? competitionAbbrev(fixture!, divisionOf(career)) : "Match Lab"}
          </div>
          <div className="flex-1 grid grid-cols-4 divide-x divide-white/5">
            {statCell("Goals", `${stats.goals}`, "text-amber-300")}
            {statCell("Assists", `${stats.assists}`, "text-emerald-300")}
            {statCell("Pass", `${passPct}%`, "text-violet-300")}
            {statCell("Avg Rat", regressForMinutes(
              liveRating(stats.chances, stats.goals, stats.assists, stats.passesCompleted, displayScore.user, displayScore.opp),
              Math.max(1, matchMinute - startMinute),
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
          className={`absolute inset-0 w-full h-full ${phase === "aim" ? "cursor-grab" : "cursor-default"}`}
        />

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
        {canExtraTouch && (phase === "aim" || phase === "contact" || phase === "flight" || phase === "result") && (
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

        {/* Contact overlay */}
        {phase === "contact" && aim && (
          <ContactBall power={aim.power} onContact={handleContact} />
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
        {phase === "result" && outcome === "offside" && (
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
            // Tapping the commentary empties the queue in one go. Nobody wants
            // to sit through four minutes of build-up twice, and the alternative
            // to letting them skip it is that they turn the speed up and leave
            // it there.
            onSkip={queue.length > 0 && !pause ? () => {
              setLog(l => [...l, ...queue]);
              const last = queue[queue.length - 1];
              if (last?.minute !== undefined) {
                matchMinuteRef.current = last.minute;
                setMatchMinute(last.minute);
              }
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

      {shootoutInfo && (
        <ShootoutOverlay
          // Kept MOUNTED (not just visible) for the whole shootout, even
          // while `phase` swings away to "aim"/"contact"/"flight"/"result"
          // for the player's own live kick — its internal running
          // score/kick-tally state lives inside this component instance, and
          // unmounting it between kicks would lose that state. `hidden`
          // just stops it rendering its own UI over the canvas while the
          // real penalty scenario underneath is the thing to look at and
          // play; the black backdrop and score strip return the moment
          // control comes back (see handleShootoutYourKick).
          hidden={phase !== "shootout"}
          homeClub={shootoutInfo.homeClub}
          awayClub={shootoutInfo.awayClub}
          yourSide={shootoutInfo.yourSide}
          yourSkill={shootoutInfo.yourSkill}
          teamSkill={shootoutInfo.teamSkill}
          oppSkill={shootoutInfo.oppSkill}
          onYourKick={handleShootoutYourKick}
          onComplete={(result) => {
            shootoutResultRef.current = result;
            setShootoutInfo(null);
            const careerForStats = careerRef.current ?? FALLBACK_CAREER;
            const t = tallyRef.current;
            const stats: MatchStats = {
              ...finaliseMatch(
                attemptsRef.current, t.goals, t.assists, t.passesCompleted,
                Math.max(1, (hookedAtRef.current ?? matchMinuteRef.current) - startMinuteRef.current),
                userScoreRef.current, oppScoreRef.current, careerForStats,
                goalEventsRef.current, hookedRef.current, oppGoalEventsRef.current, fixture,
              ),
              endEnergy: liveEnergyAt(hookedAtRef.current ?? matchMinuteRef.current),
              wentToExtraTime: wentToExtraTimeRef.current,
              shootout: result,
            };
            if (matchModeRef.current && onCompleteRef.current) {
              onCompleteRef.current(stats);
            } else {
              setFinalStats(stats);
              setPhase("postmatch");
            }
          }}
        />
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
