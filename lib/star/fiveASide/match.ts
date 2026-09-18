import type { Outcome, Vec2, Scenario, Ball } from "../canvasEngine";
import { mulberry32 } from "../season";
import {
  type MatchRules, FIVE_A_SIDE, centreSpot, fullTimeMinutes, halfwayY, goalCentreX,
} from "./rules";
import { type FiveWorld, kickOffWorld, worldFromScenario } from "./passage";
import { leftPitch, clampToPitch, insideFivePitch } from "./geometry";

/**
 * THE GAME AROUND THE KICKS.
 *
 * The engine knows how to play ONE touch: here is a picture, you strike the
 * ball, here is what happened. It has no idea what a match is. This is the
 * part that makes a match out of those touches — the referee, the scoreboard
 * and the clock.
 *
 * It does four things the engine does not:
 *
 *   1. **Remembers where everybody is.** The whole reason this is a real
 *      small-sided game rather than a run of unrelated chances: the ten
 *      players carry over from touch to touch, so nobody teleports.
 *   2. **Keeps the score and the clock**, and knows when it is over.
 *   3. **Decides what happens when it is not your ball** — the other side's
 *      attacks, and where a restart is taken from.
 *   4. **Is a pure reducer**, so it can be saved to your career between
 *      touches and picked up exactly where it was. Closing the app mid-match
 *      loses nothing.
 *
 * Every function here takes the rules as data (see rules.ts), so this same
 * layer can run a game of any size — the reason that matters is written up
 * there.
 */

export type Possession = "you" | "them";

/** What one touch of yours was worth, kept so the stage can be scored at the
 *  end without having to remember the match. */
export interface PassageEvent {
  /** 0-1, how good it was. See score.ts. */
  quality: number;
  outcome: Outcome | "out";
  /** A goal you scored yourself. */
  goal?: boolean;
  /** A goal somebody scored because you found them. */
  assist?: boolean;
  minute: number;
}

/** Why the ball is where it is. Drives what the next passage looks like and
 *  what the screen says. */
export type Restart = "kick-off" | "open-play" | "kick-in" | "goal-kick" | "corner" | "none";

export interface FiveMatchState {
  rules: MatchRules;
  seed: number;
  /** How far into the seeded stream we are, so a resume continues it rather
   *  than replaying it. */
  draws: number;
  minute: number;
  half: number;
  /** Yours first. */
  score: [number, number];
  possession: Possession;
  restart: Restart;
  world: FiveWorld;
  events: PassageEvent[];
  /** Newest last. Short on purpose — this is a caption, not a commentary
   *  feed; the five-a-side is three minutes a half, not ninety. */
  log: string[];
  over: boolean;
}

/**
 * How much of the clock one touch of yours costs.
 *
 * A dozen touches if you keep the ball; nearer five if you shoot every time
 * you see the goal, because every shot outcome — scored, saved, wide, off the
 * post — hands possession over, and their attack costs the clock too. That is
 * the honest number, and it is worth knowing: the comment here used to claim
 * "roughly a dozen" flatly, which is only true of a player who never shoots.
 */
export const MINUTES_PER_PASSAGE = 0.5;
/** …and what one of their attacks costs. Slightly more, because it covers
 *  them building it as well as finishing it. */
export const MINUTES_PER_OPP_ATTACK = 0.7;

/**
 * The match's own random stream, wound forward to where it left off.
 *
 * Rebuilt from the seed and advanced past everything already drawn, so a match
 * resumed from a save gets the numbers it would have got anyway rather than
 * starting the stream over — which is what stops closing and re-opening the
 * app from being a way to re-roll a bad moment.
 *
 * `used()` is a FUNCTION, not a getter, and that is not a style choice: the
 * first version returned `{ rng, get nextDraws() }` and every caller did
 * `const { rng, nextDraws } = rngAt(state)`. Destructuring EVALUATES a getter
 * there and then — before a single number has been drawn — so `nextDraws` was
 * always the old value and the stream silently replayed itself on every
 * resume. Caught by the test that checks a resumed match moves the stream on.
 */
function rngAt(state: FiveMatchState): { rng: () => number; used: () => number } {
  const rng = mulberry32(state.seed);
  for (let i = 0; i < state.draws; i++) rng();
  let n = 0;
  return { rng: () => { n++; return rng(); }, used: () => n };
}

export function newFiveMatch(seed: number, rules: MatchRules = FIVE_A_SIDE): FiveMatchState {
  return {
    rules,
    seed,
    draws: 0,
    minute: 0,
    half: 1,
    score: [0, 0],
    possession: "you",
    restart: "kick-off",
    world: kickOffWorld(true),
    events: [],
    log: ["Kick-off."],
    over: false,
  };
}

export function isFullTime(state: FiveMatchState): boolean {
  return state.minute >= fullTimeMinutes(state.rules);
}

/** Which half a given minute falls in. */
export function halfAt(state: FiveMatchState): number {
  return Math.min(state.rules.halves, Math.floor(state.minute / state.rules.minutesPerHalf) + 1);
}

const push = (log: string[], line: string) => [...log, line].slice(-6);

/**
 * Where the ball goes once your touch has resolved, and whose it is.
 *
 * This is the judgement call the engine cannot make for us, because the engine
 * only ever answers "what happened to this kick" — never "and so whose ball is
 * it now". Every branch here is a real football answer to that question.
 */
function afterOutcome(
  outcome: Outcome | "out", ballAt: Vec2, rules: MatchRules,
): { possession: Possession; restart: Restart; ball: Vec2; note: string } {
  const centre = centreSpot(rules);
  switch (outcome) {
    case "goal":
      return { possession: "them", restart: "kick-off", ball: centre, note: "GOAL!" };
    case "rebound":
    case "delivered":
    case "touchOn":
      // Still yours — the move goes on from wherever it got to.
      return { possession: "you", restart: "open-play", ball: clampToPitch(ballAt, 0.5), note: "" };
    case "saved":
    case "caught":
    case "tipped":
      return {
        possession: "them", restart: "goal-kick",
        ball: { x: goalCentreX(rules), y: rules.pitch.y1 + 2 },
        note: "Saved.",
      };
    case "post":
      return {
        possession: "them", restart: "goal-kick",
        ball: { x: goalCentreX(rules), y: rules.pitch.y1 + 2 },
        note: "Off the woodwork!",
      };
    case "over":
    case "wide":
      return {
        possession: "them", restart: "goal-kick",
        ball: { x: goalCentreX(rules), y: rules.pitch.y1 + 2 },
        note: outcome === "over" ? "Over the bar." : "Wide.",
      };
    case "blocked":
    case "tackled":
      return { possession: "them", restart: "open-play", ball: clampToPitch(ballAt, 1), note: "Lost it." };
    case "offside":
      return { possession: "them", restart: "open-play", ball: clampToPitch(ballAt, 1), note: "Offside." };
    case "short":
      // Nobody got to it and it stopped. Whoever is nearest, which on a pitch
      // this size is a coin-flip we resolve as a turnover rather than
      // pretending to simulate a scramble.
      return { possession: "them", restart: "open-play", ball: clampToPitch(ballAt, 1), note: "Ran out of steam." };
    case "out": {
      const side = leftPitch(ballAt);
      if (side === "goal-line-theirs") {
        return {
          possession: "them", restart: "goal-kick",
          ball: { x: goalCentreX(rules), y: rules.pitch.y1 + 2 },
          note: "Behind for a goal kick.",
        };
      }
      if (side === "goal-line-ours") {
        // Your own miskick over your own line. A corner against you in real
        // football; here it is simply their ball near your goal. An own goal
        // from a backward miskick is NOT modelled, and the caption says
        // "behind" rather than pretending otherwise.
        return {
          possession: "them", restart: "corner",
          ball: clampToPitch({ x: ballAt.x, y: rules.pitch.y2 - 1 }, 0.5),
          note: "Behind.",
        };
      }
      return {
        possession: "them", restart: "kick-in",
        ball: clampToPitch(ballAt, 0.5),
        note: "Out for a kick-in.",
      };
    }
    default:
      return { possession: "them", restart: "open-play", ball: clampToPitch(ballAt, 1), note: "" };
  }
}

/**
 * Fold one of YOUR touches into the match.
 *
 * `quality` is what the touch was worth (see score.ts) — passed in rather than
 * computed here so this stays a pure bookkeeping step and the judging lives in
 * one place.
 */
export function applyOutcome(
  state: FiveMatchState,
  outcome: Outcome | "out",
  scenario: Scenario,
  ball: Ball,
  quality: number,
  opts: { assist?: boolean } = {},
): FiveMatchState {
  if (state.over) return state;

  // Where the ball actually finished. `afterOutcome` decides what that means
  // and clamps it; this hands it the raw position, because a ball that has
  // genuinely left the pitch is exactly what its "out" branch needs to see.
  // (A previous version read `insideFivePitch(ball.pos) ? ball.pos : ball.pos`
  // — a condition whose two branches were identical. Caught in review.)
  const next = afterOutcome(outcome, ball.pos, state.rules);
  const scored = outcome === "goal";
  const minute = Math.min(fullTimeMinutes(state.rules), state.minute + MINUTES_PER_PASSAGE);

  const world = worldFromScenario(scenario, next.ball, state.world);
  const score: [number, number] = scored ? [state.score[0] + 1, state.score[1]] : [...state.score];

  const event: PassageEvent = {
    quality, outcome, minute,
    ...(scored ? { goal: true } : {}),
    ...(opts.assist ? { assist: true } : {}),
  };

  const s: FiveMatchState = {
    ...state,
    minute,
    score,
    possession: next.possession,
    restart: next.restart,
    // A goal or a restart puts everybody back in a sensible shape rather than
    // leaving them where the last passage happened to end.
    world: next.restart === "kick-off"
      ? kickOffWorld(next.possession === "you")
      : { ...world, ball: next.ball },
    events: [...state.events, event],
    log: next.note ? push(state.log, `${Math.floor(minute)}' ${next.note}`) : state.log,
  };
  return closeOutIfDone(s);
}

/**
 * The other side's turn.
 *
 * ── The honest version of this, stated rather than buried ──
 *
 * Right now their attack is a single fair roll, not the real physics: their
 * quality against your keeper's, goal or no goal. That is exactly the same
 * abstraction the big match already uses for the eighty-nine minutes you are
 * not on the ball, so it is not a new compromise — it is the existing one,
 * applied to a shorter game.
 *
 * The real version (their attack decided by the live engine, mirrored, and
 * replayed back so your keeper genuinely dives) is a later step and is
 * designed for in geometry.ts's `mirror`. This is what ships first, and the
 * difference is one function.
 */
export function oppAttack(
  state: FiveMatchState,
  /** 0-1, how good they are this match. */
  difficulty: number,
  /** 0-100, your keeper. */
  keeper: number,
): FiveMatchState {
  if (state.over) return state;
  const stream = rngAt(state);
  const rng = stream.rng;

  // A bounded edge, the same shape the rule book's own penalty resolver uses:
  // a better side scores more often, a better keeper saves more, and neither
  // is ever a certainty.
  const attack = 0.35 + difficulty * 0.30;
  const save = (keeper / 100) * 0.30;
  const chance = Math.max(0.08, Math.min(0.6, attack - save));
  const scored = rng() < chance;

  const minute = Math.min(fullTimeMinutes(state.rules), state.minute + MINUTES_PER_OPP_ATTACK);
  const score: [number, number] = scored ? [state.score[0], state.score[1] + 1] : [...state.score];

  const s: FiveMatchState = {
    ...state,
    draws: state.draws + stream.used(),
    minute,
    score,
    possession: "you",
    restart: scored ? "kick-off" : "open-play",
    world: scored
      ? kickOffWorld(true)
      : { ...state.world, ball: clampToPitch({ x: goalCentreX(state.rules), y: state.rules.pitch.y2 - 6 }) },
    log: push(state.log, scored
      ? `${Math.floor(minute)}' They score.`
      : `${Math.floor(minute)}' Your keeper holds it.`),
  };
  return closeOutIfDone(s);
}

function closeOutIfDone(state: FiveMatchState): FiveMatchState {
  const half = halfAt(state);
  const withHalf = half !== state.half
    ? { ...state, half, log: push(state.log, half > state.rules.halves ? "Full time." : `Half time.`) }
    : state;
  if (!isFullTime(withHalf)) return withHalf;
  return {
    ...withHalf,
    over: true,
    log: withHalf.log[withHalf.log.length - 1] === "Full time."
      ? withHalf.log
      : push(withHalf.log, "Full time."),
  };
}

/** Who won, from your side of it. */
export function resultOf(state: FiveMatchState): "win" | "draw" | "loss" {
  return state.score[0] > state.score[1] ? "win" : state.score[0] < state.score[1] ? "loss" : "draw";
}

/** The kind of moment the next passage is, from where the ball is. Exposed so
 *  the screen can caption it. */
export function zoneOf(state: FiveMatchState): "final-third" | "midfield" | "own-half" {
  const y = state.world.ball.y;
  if (y <= 12) return "final-third";
  if (y <= halfwayY(state.rules)) return "midfield";
  return "own-half";
}
