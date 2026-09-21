import type { Outcome, Vec2, Scenario, Ball } from "../canvasEngine";
import { mulberry32 } from "../season";
import {
  type MatchRules, FIVE_A_SIDE, centreSpot, fullTimeMinutes, halfwayY, goalCentreX,
} from "./rules";
import { type FiveWorld, kickOffWorld, worldFromScenario } from "./passage";
import { leftPitch, clampToPitch } from "./geometry";
import {
  type FiveFlowState, type FlowBeat, type FlowEvent, type FlowStop, type FlowInputs,
  newFlow, playOn, flowAfterTouch, bandOf, MINUTES_PER_BEAT,
} from "./flow";

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

/**
 * What the match is waiting for.
 *
 * OPTIONAL, and it has to stay optional: a career saved before the flow
 * existed has no such field, and a save that cannot be loaded is worse than a
 * save that plays one passage the old way. Absent reads as "whatever
 * `possession` says", which is exactly the old behaviour.
 *
 *   "flow"    — nobody needs you. The CPUs play on until somebody does.
 *   "passage" — the move has found you. Build the picture and let them aim.
 *   "mate"    — a team-mate has worked a chance. Play it out and watch him.
 *   "opp"     — they have worked a chance. Play it out and watch it.
 */
export type Awaiting = "flow" | "passage" | "mate" | "opp";

export interface FiveMatchState {
  rules: MatchRules;
  seed: number;
  /** How far into the seeded stream we are, so a resume continues it rather
   *  than replaying it. */
  draws: number;
  /**
   * The same thing for the SCREEN's own stream — the one that builds each
   * passage, launches the ball and steps the physics.
   *
   * Two streams, deliberately, because they are drawn from in two different
   * places: `draws` belongs to this file and is spent by `oppAttack`, and this
   * one belongs to the component and is spent by `buildPassage`/`launch`/
   * `stepBall`. Folding them into one would mean the component reaching into
   * the match state on every physics substep.
   *
   * OPTIONAL, and it has to stay optional: a career saved before this existed
   * has no such field, and a save that cannot be loaded is worse than a save
   * that re-rolls one passage. Absent reads as zero, which is exactly what the
   * old behaviour was.
   *
   * Without it the exploit is real and cheap: the component rebuilt
   * `mulberry32(seed)` from scratch on every mount, so closing the app and
   * re-opening it replayed numbers the match had already used — a way to
   * re-roll a passage you did not like, which is the same thing `draws` was
   * added to stop on the other stream.
   */
  passageDraws?: number;
  minute: number;
  half: number;
  /** Yours first. */
  score: [number, number];
  possession: Possession;
  restart: Restart;
  world: FiveWorld;
  /** The small-sided hidden match — see flow.ts. Optional for the same
   *  reason `awaiting` is: an older save has never heard of it. */
  flow?: FiveFlowState;
  awaiting?: Awaiting;
  events: PassageEvent[];
  /** Newest last. Short on purpose — this is a caption, not a commentary
   *  feed; the five-a-side is three minutes a half, not ninety. */
  log: string[];
  over: boolean;
}

/**
 * How much of the clock one touch of yours costs — and one of their chances.
 *
 * Both are one beat's worth, because that is what they are: a moment of
 * football, exactly like the ones the simulation plays between them. Keeping
 * them equal to `MINUTES_PER_BEAT` is also what makes the involvement rate
 * measurable — the flow's own tuning was measured against a budget of beats,
 * and a touch that cost a different amount would quietly move it.
 *
 * They are still separate constants rather than one, because they are
 * separate facts about the game and one of them may want to change.
 */
export const MINUTES_PER_PASSAGE = MINUTES_PER_BEAT;
/** …and what one of their chances costs. */
export const MINUTES_PER_OPP_ATTACK = MINUTES_PER_BEAT;
/** …and one of a team-mate's, which you watch. One beat, like the rest. */
export const MINUTES_PER_MATE_ATTACK = MINUTES_PER_BEAT;

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
    passageDraws: 0,
    minute: 0,
    half: 1,
    score: [0, 0],
    possession: "you",
    restart: "kick-off",
    world: kickOffWorld(true),
    flow: newFlow(true),
    awaiting: "flow",
    events: [],
    log: ["Kick-off."],
    over: false,
  };
}

/** The flow as it stands, built for a save that predates it. */
export function flowOf(state: FiveMatchState): FiveFlowState {
  return state.flow ?? {
    ...newFlow(state.possession === "you"),
    band: bandOf(state.rules, state.world.ball.y),
  };
}

/** What the match is waiting for, for a save that predates the field. */
export function awaitingOf(state: FiveMatchState): Awaiting {
  return state.awaiting ?? (state.possession === "them" ? "opp" : "passage");
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
 * Which engine outcomes actually put the ball in the net.
 *
 * Both of them. See `afterOutcome`'s "rebound" branch for the bug this exists
 * to make impossible to write again.
 */
export function isGoalOutcome(outcome: Outcome | "out"): boolean {
  return outcome === "goal" || outcome === "rebound";
}

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
    /**
     * ── A rebound IS a goal ──
     *
     * The engine returns "rebound" for a finish from a second phase — a
     * deflected shot, a follow-up off the keeper — and it sets `ball.inNet`
     * when it does. Its own `OUTCOME_TEXT` calls it "GOAL — rebound!" and
     * files it under `kind: "goal"`.
     *
     * This layer filed it with "delivered" and "touchOn" as open play, and
     * `applyOutcome` read only `outcome === "goal"` for the scoreboard. So a
     * deflected shot that crossed the line was drawn going into the net,
     * announced as a goal by the engine's own caption, and then not counted —
     * reported directly as "oh, that actually wasn't a goal".
     */
    case "rebound":
      return { possession: "them", restart: "kick-off", ball: centre, note: "GOAL — off the deflection!" };
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
  opts: {
    assist?: boolean;
    /** How far into the SCREEN's own stream this passage left it. See
     *  `FiveMatchState.passageDraws`. */
    passageDraws?: number;
  } = {},
): FiveMatchState {
  if (state.over) return state;

  // Where the ball actually finished. `afterOutcome` decides what that means
  // and clamps it; this hands it the raw position, because a ball that has
  // genuinely left the pitch is exactly what its "out" branch needs to see.
  // (A previous version read `insideFivePitch(ball.pos) ? ball.pos : ball.pos`
  // — a condition whose two branches were identical. Caught in review.)
  const next = afterOutcome(outcome, ball.pos, state.rules);
  const scored = isGoalOutcome(outcome);
  const minute = Math.min(fullTimeMinutes(state.rules), state.minute + MINUTES_PER_PASSAGE);

  const world = worldFromScenario(scenario, next.ball, state.world);
  const score: [number, number] = scored ? [state.score[0] + 1, state.score[1]] : [...state.score];

  const event: PassageEvent = {
    quality, outcome, minute,
    ...(scored ? { goal: true } : {}),
    ...(opts.assist ? { assist: true } : {}),
  };

  const nextWorld = next.restart === "kick-off"
    ? kickOffWorld(next.possession === "you")
    : { ...world, ball: next.ball };

  const s: FiveMatchState = {
    ...state,
    minute,
    score,
    passageDraws: opts.passageDraws ?? state.passageDraws,
    possession: next.possession,
    restart: next.restart,
    // A goal or a restart puts everybody back in a sensible shape rather than
    // leaving them where the last passage happened to end.
    world: nextWorld,
    // ── And then the football carries on without you ──
    //
    // The single most important line in this file. Your touch is not the end
    // of anything: the side that has it plays on, and you rejoin when the move
    // finds you again. Territory comes from where the ball ACTUALLY finished,
    // so a ball you won ground with is ground your side keeps and a ball you
    // lost deep is lost deep.
    flow: flowAfterTouch(
      state.rules,
      flowOf(state),
      next.possession === "you" ? "you" : "them",
      nextWorld.ball.y,
    ),
    awaiting: "flow",
    events: [...state.events, event],
    log: next.note ? push(state.log, `${Math.floor(minute)}' ${next.note}`) : state.log,
  };
  return closeOutIfDone(s);
}

/**
 * PLAY ON.
 *
 * Runs the simulation forward from wherever the last touch left it until
 * somebody needs you — which is either you (build a passage) or them (a chance
 * to be played out and watched) — or until the whistle.
 *
 * Returns the beats it played as well as the new state, because the beats are
 * what the screen ANIMATES and none of them belong in a save: a snapshot of
 * ten players, ninety times a match, written into a career for no reason.
 *
 * The stream is the match's own, wound forward past `draws`, so a match picked
 * up from a save plays the football it was always going to play rather than
 * re-rolling it.
 */
export function advanceFlow(
  state: FiveMatchState,
  inputs: FlowInputs,
  opts: { passageDraws?: number } = {},
): { state: FiveMatchState; beats: FlowBeat[]; events: FlowEvent[]; stop: FlowStop } {
  if (state.over) return { state, beats: [], events: [], stop: "full-time" };
  const stream = rngAt(state);

  const left = fullTimeMinutes(state.rules) - state.minute;
  // Every beat there is clock for, and no reserve. A reserve sounds prudent —
  // leave room for whatever the flow stops FOR — but it is charged on EVERY
  // call, and the flow is called a dozen times a match: MEASURED, holding one
  // beat back cost about a minute of football a call and dropped the stage
  // from 7.7 involvements to 6.7, which is the one number the whole rebuild
  // was tuned to. A chance worked on the final beat of the match is a chance
  // the whistle went on, which is a thing that happens in football.
  const budget = Math.max(0, Math.floor(left / MINUTES_PER_BEAT));
  if (budget <= 0) {
    // Not enough clock left to play anything. Run it out rather than handing
    // back a state the caller would ask the same question of forever — a
    // match that cannot end is worse than one that ends a beat early.
    const done = closeOutIfDone({ ...state, minute: fullTimeMinutes(state.rules) });
    return { state: done, beats: [], events: [], stop: "full-time" };
  }

  const r = playOn(state.rules, state.world, flowOf(state), inputs, stream.rng, budget);

  const minute = Math.min(
    fullTimeMinutes(state.rules),
    state.minute + r.beatsPlayed * MINUTES_PER_BEAT,
  );
  const score: [number, number] = [state.score[0] + r.scored[0], state.score[1] + r.scored[1]];
  let log = state.log;
  for (const e of r.events) log = push(log, `${Math.floor(minute)}' ${e.text}`);

  const possession: Possession = r.flow.possession === "you" ? "you" : "them";
  const s: FiveMatchState = {
    ...state,
    minute,
    score,
    passageDraws: opts.passageDraws ?? state.passageDraws,
    draws: state.draws + stream.used(),
    possession,
    restart: "open-play",
    world: r.world,
    flow: r.flow,
    log,
    awaiting: r.stop === "you" ? "passage"
      : r.stop === "mate" ? "mate"
      : r.stop === "them" ? "opp" : "flow",
  };
  return { state: closeOutIfDone(s), beats: r.beats, events: r.events, stop: r.stop };
}

/**
 * THE OTHER SIDE'S TURN, AS IT ACTUALLY HAPPENED.
 *
 * This used to be a single fair roll — their quality against your keeper's,
 * goal or no goal — and the honest version of that was stated rather than
 * buried: "the real version (their attack decided by the live engine,
 * mirrored, and replayed back so your keeper genuinely dives) is a later step
 * and is designed for in geometry.ts's `mirror`."
 *
 * This is that step. The caller builds their move with `buildTheirAttack`,
 * plays it out through the same `launch`/`stepBall`/`stepKeeper` every other
 * kick in the game goes through, and hands the real `Outcome` back here. So a
 * conceded goal is one you watched go in past a keeper who genuinely dived,
 * and a save is one he genuinely made.
 *
 * Two consequences worth stating, because they are the point rather than side
 * effects:
 *
 *  1. **Territory matters.** Their chance is only ever built once the
 *     simulation has worked them into your half, so a ball lost on the edge of
 *     their box is not a chance at all — it is a long way back to your goal
 *     with your four men in front of it. The old roll was the same 33% wherever
 *     the ball had been lost, which is what made two-nil down the single
 *     likeliest scoreline in the stage.
 *  2. **Your keeper is worth having.** His rating is the engine's
 *     `keeperStrength` on the scenario, which is the same number that decides
 *     every save in the game, rather than a flat 30% subtraction.
 *
 * `ballAt` is in the MIRRORED picture the engine played — `mirror` is an
 * involution, so handing it straight back is exactly right, and
 * `worldFromTheirAttack` has already turned the players round.
 */
export function applyTheirAttack(
  state: FiveMatchState,
  /** What the engine said, from THEIR point of view. */
  outcome: Outcome | "out",
  /** The world read back out of their move — see `worldFromTheirAttack`. */
  world: FiveWorld,
  opts: { passageDraws?: number } = {},
): FiveMatchState {
  if (state.over) return state;

  const scored = isGoalOutcome(outcome);
  const minute = Math.min(fullTimeMinutes(state.rules), state.minute + MINUTES_PER_OPP_ATTACK);
  const score: [number, number] = scored ? [state.score[0], state.score[1] + 1] : [...state.score];

  // What it leaves behind. Every branch is a real football answer to "and so
  // whose ball is it now", the same way `afterOutcome` is for your own touch.
  const note = scored ? "They score."
    : outcome === "saved" || outcome === "caught" || outcome === "tipped" ? "Your keeper holds it."
    : outcome === "post" ? "Off your post!"
    : outcome === "wide" || outcome === "over" ? "They drag it wide."
    : outcome === "blocked" || outcome === "tackled" ? "Blocked — you win it back."
    : "The move breaks down.";

  const keeperHasIt = outcome === "saved" || outcome === "caught" || outcome === "tipped"
    || outcome === "post" || outcome === "wide" || outcome === "over";

  const nextWorld: FiveWorld = scored
    ? kickOffWorld(true)
    : keeperHasIt
      // Your keeper plays it out from his own line.
      ? { ...world, ball: clampToPitch({ x: goalCentreX(state.rules), y: state.rules.pitch.y2 - 3 }) }
      : world;

  const s: FiveMatchState = {
    ...state,
    passageDraws: opts.passageDraws ?? state.passageDraws,
    minute,
    score,
    possession: "you",
    restart: scored ? "kick-off" : keeperHasIt ? "goal-kick" : "open-play",
    world: nextWorld,
    // Back to the simulation either way: the ball is yours and your side plays
    // out from wherever it ended up.
    flow: flowAfterTouch(state.rules, flowOf(state), "you", nextWorld.ball.y),
    awaiting: "flow",
    log: push(state.log, `${Math.floor(minute)}' ${note}`),
  };
  return closeOutIfDone(s);
}

/**
 * A TEAM-MATE'S CHANCE, FOLDED BACK IN — the mirror of `applyTheirAttack`.
 *
 * A team-mate worked a chance near their goal and took it himself while you
 * watched (see `buildMateAttack`). This is your side attacking their goal, so
 * the geometry is exactly your own touch's — a goal is YOURS (the scoreboard),
 * and afterwards the ball is theirs to restart from, whatever became of the
 * shot.
 *
 * Deliberately records NO `PassageEvent`: a chance that bypassed you is not
 * your goal and not your assist, so it must not move your personal rating — the
 * same way the flow's own rolled team-mate goals never have. It moves the
 * SCOREBOARD and nothing else, which is what watching a team-mate score is.
 */
export function applyMateAttack(
  state: FiveMatchState,
  /** What the engine said, from your side's point of view. */
  outcome: Outcome | "out",
  /** The world read back out of the move — see `worldFromMateAttack`. */
  world: FiveWorld,
  opts: { passageDraws?: number } = {},
): FiveMatchState {
  if (state.over) return state;

  const scored = isGoalOutcome(outcome);
  const minute = Math.min(fullTimeMinutes(state.rules), state.minute + MINUTES_PER_MATE_ATTACK);
  const score: [number, number] = scored ? [state.score[0] + 1, state.score[1]] : [...state.score];

  const note = scored ? "Your side score!"
    : outcome === "saved" || outcome === "caught" || outcome === "tipped" ? "Their keeper holds it."
    : outcome === "post" ? "Off the woodwork!"
    : outcome === "wide" || outcome === "over" ? "A team-mate drags it wide."
    : outcome === "blocked" || outcome === "tackled" ? "Blocked."
    : "The move breaks down.";

  // Their keeper gathers a shot that did not go in; otherwise their side simply
  // has it back where the move ended. Either way it is theirs to restart.
  const keeperHasIt = outcome === "saved" || outcome === "caught" || outcome === "tipped"
    || outcome === "post" || outcome === "wide" || outcome === "over";

  const nextWorld: FiveWorld = scored
    ? kickOffWorld(false)
    : keeperHasIt
      // Their keeper plays it out from his own line (their goal is at y1).
      ? { ...world, ball: clampToPitch({ x: goalCentreX(state.rules), y: state.rules.pitch.y1 + 3 }) }
      : world;

  const s: FiveMatchState = {
    ...state,
    passageDraws: opts.passageDraws ?? state.passageDraws,
    minute,
    score,
    possession: "them",
    restart: scored ? "kick-off" : keeperHasIt ? "goal-kick" : "open-play",
    world: nextWorld,
    // The ball is theirs now; the simulation plays on from wherever it ended up.
    flow: flowAfterTouch(state.rules, flowOf(state), "them", nextWorld.ball.y),
    awaiting: "flow",
    log: push(state.log, `${Math.floor(minute)}' ${note}`),
  };
  return closeOutIfDone(s);
}

function closeOutIfDone(state: FiveMatchState): FiveMatchState {
  const half = halfAt(state);
  let withHalf = state;
  if (half !== state.half) {
    // `halfAt` is clamped to `rules.halves`, so it can only ever step UP at a
    // real interval — never past the last one. The old version branched on
    // `half > rules.halves` for a "Full time." caption, which that clamp makes
    // unreachable; full time is handled below, where it actually happens.
    withHalf = { ...state, half, log: push(state.log, "Half time.") };
    if (!isFullTime(withHalf)) {
      // ── The interval is a reset, not just a caption ──
      //
      // It used to be a log line and nothing else: both sides stayed exactly
      // where the last passage had left them and play resumed from that
      // picture, which is not what happens at half time in any game of
      // football. Everybody goes back to the kick-off shape.
      //
      // The ball is given to YOU rather than swapped to them, which is the one
      // departure from the real law and is deliberate: `possession` here also
      // decides who ATTACKS next, and a kick-off is not an attack — handing it
      // over would open the second half with an opposition chance rather than
      // a kick-off. Ends are not swapped either; the engine only knows one
      // direction (see geometry.ts's `mirror`), so the kick-off shape is the
      // same shape both halves.
      withHalf = {
        ...withHalf,
        possession: "you",
        restart: "kick-off",
        world: kickOffWorld(true),
        // The simulation restarts from the middle too, or the second half
        // opens with the ball nominally at kick-off and the flow still
        // convinced play is camped in somebody's box.
        flow: newFlow(true),
        awaiting: "flow",
      };
    }
  }
  if (!isFullTime(withHalf)) return withHalf;
  return {
    ...withHalf,
    over: true,
    log: withHalf.log[withHalf.log.length - 1] === "Full time."
      ? withHalf.log
      : push(withHalf.log, "Full time."),
  };
}

/**
 * WHAT A RESUMED MATCH MUST DO BEFORE IT DOES ANYTHING ELSE.
 *
 * Pure, and exported, so the rule can be tested — the screen that obeys it is
 * a React mount effect and cannot be. It exists because that effect used to
 * build the next passage flatly, without ever asking whose ball it was, and
 * that single missing question was a complete exploit:
 *
 * every touch of yours that hands the ball over — a save, a miss, a tackle, a
 * goal — wrote the match away with `possession: "them"`, and the screen then
 * waited a beat before rolling their attack. Close the app in that beat and
 * re-open it, and their attack was skipped entirely: you got the ball back
 * wherever `afterOutcome` had left it, which after a save was two metres from
 * their goal line, dead centre. Tap in. Repeat.
 *
 * ── Why the flow does not put it back ──
 *
 * Two independent guards now, rather than one. The rule below still refuses to
 * hand you a passage when the match is waiting on anything else. AND the
 * payload is gone structurally: after a save, the ball no longer sits on their
 * goal line waiting for you — the simulation runs, their keeper plays it out,
 * and by the time anybody asks you to do anything the ball is at the other end
 * of the pitch. There is nothing left to skip TO.
 *
 *   "flow"    — nobody needs you yet. Play the simulation forward.
 *   "opp"     — they have a chance. It gets played out, and you watch it.
 *   "mate"    — a team-mate has a chance. It gets played out, and you watch it.
 *   "passage" — it is genuinely yours. Build the picture and let them aim.
 *   "done"    — the match is already over; finish the stage rather than
 *               sitting on it with no way forward.
 *
 * "mate" needs no exploit guard the way "passage" does: a team-mate's chance is
 * played out automatically and watched — there is no free tap-in to skip to.
 */
export function resumeAction(state: FiveMatchState): "flow" | "opp" | "mate" | "passage" | "done" {
  if (state.over || isFullTime(state)) return "done";
  const awaiting = awaitingOf(state);
  // Belt and braces: whatever a save claims it is waiting for, it can never be
  // waiting for YOUR touch while the ball is theirs.
  if (awaiting === "passage" && state.possession === "them") return "opp";
  return awaiting;
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
