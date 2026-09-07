import {
  buildScenario, initDefenders, clamp,
  type Scenario, type ScenarioKind,
} from "./canvasEngine";
import { PITCH_W } from "./pitch";

/**
 * A MOVING ATTACKING SITUATION — a standalone sandbox, not wired into the
 * real game yet.
 *
 * Requested directly: "Right now every attacking situation is essentially
 * just a still image, then the player aims the arrow... Not good enough,
 * not exciting enough... The player must aim the arrow on the moving ball...
 * then on the ball kick screen the ball should be moving too." Explicitly
 * asked to be built "in a new area for now to let me test it before making
 * it in the real game."
 *
 * The shape: a real shooting chance — `buildScenario` — is built exactly
 * as it always is, so the finish (defenders, keeper, viewport) is the same
 * balanced situation a real match would give you. What's new is everything
 * BEFORE the strike: the ball arrives from somewhere (a ground pass, a
 * through ball, a driven cross, a raking counter-attack ball), and YOU —
 * not just defenders and support runners — visibly arrive into the
 * position `buildScenario` already placed you at, rather than standing
 * there like a mannequin while everyone else plays a real football match
 * around you.
 *
 * PLAYTESTED AND REVISED (first real feedback pass): the original build had
 * a hard, punishing ready window — strike a beat early or late and the
 * whole chance was simply gone — which reads on paper as "a real timing
 * skill" but played as "confusing, and the only way to reliably act was to
 * already be dragging before you could see the moment had arrived." Two
 * changes came out of that: the player now makes a real run onto the ball
 * instead of standing fixed and offside-looking (see `playerFrom`), and
 * the ready window no longer expires on a short fuse — once the ball is
 * reachable it stays yours to deal with for a long time (`READY_TAIL`),
 * with the ball settling into a small, decaying, ever-so-slightly-alive
 * wobble near where it arrived rather than rolling off screen if you take
 * a moment to look at the picture. You can still strike it early, while it
 * is genuinely still travelling, if you want the sharper read — that part
 * of the original brief ("aim the arrow on the moving ball") is unchanged
 * — but taking your time is no longer punished the way it was.
 *
 * Deliberately NOT a rebuild of `dribble.ts`'s "carry the ball past people"
 * mode (that request is a separate, already-shipped feature — the
 * first-person dribbling sandbox). This is about the ordinary aim-and-shoot
 * moment gaining real movement, not about controlling a run.
 *
 * Pure simulation: no React, no canvas. `LiveAttack.tsx` draws it (reusing
 * `renderScenario` — the same top-down look a real chance already has,
 * since a `Scenario` built here is the exact same shape) and feeds it the
 * player's aim gesture; everything that decides anything is here.
 */

export type DeliveryKind = "ground" | "throughball" | "cross" | "counter";
export const DELIVERY_KINDS: DeliveryKind[] = ["ground", "throughball", "cross", "counter"];

export const DELIVERY_LABEL: Record<DeliveryKind, string> = {
  ground: "Ground pass",
  throughball: "Through ball",
  cross: "Driven cross",
  counter: "Counter-attack",
};

// Which real finish each delivery hands off into. Chosen so every delivery
// still ends in a chance where YOU strike it — a moving build-up into a
// pass-resolving kind (cutback, through_ball proper, midfield_pass) would
// hand the finish to a team-mate instead, which is a different feature.
const SHOT_KIND_FOR: Record<DeliveryKind, ScenarioKind> = {
  ground: "one_on_one",
  throughball: "tight_angle",
  cross: "volley",
  counter: "one_on_one",
};

export interface Vec2 { x: number; y: number; }

interface Approach {
  from: Vec2;
  duration: number;   // seconds until the ball reaches scenario.ball
  bounces: number;    // ground bounces along the way (0 = none / airborne arc)
  peak: number;        // arc height at the midpoint, metres (0 = stays low)
}

/** How long the delivery takes, where it comes from, and how it behaves in
 *  the air — one variant per DeliveryKind, so "diversity" is built in
 *  rather than left to chance within a single formula. */
const APPROACH_FOR: Record<DeliveryKind, (rng: () => number) => { duration: number; bounces: number; peak: number; offset: Vec2 }> = {
  ground: (rng) => ({
    duration: 1.15 + rng() * 0.2, bounces: 1, peak: 0,
    offset: { x: (rng() - 0.5) * 6, y: 11 + rng() * 4 },
  }),
  throughball: (rng) => ({
    duration: 1.5 + rng() * 0.25, bounces: 2, peak: 0,
    offset: { x: (rng() - 0.5) * 4, y: 17 + rng() * 5 },
  }),
  cross: (rng) => ({
    duration: 1.35 + rng() * 0.2, bounces: 0, peak: 3.2 + rng() * 1.2,
    offset: { x: (rng() < 0.5 ? -1 : 1) * (14 + rng() * 6), y: -2 + rng() * 4 },
  }),
  counter: (rng) => ({
    duration: 1.9 + rng() * 0.3, bounces: 1, peak: 0.4,
    offset: { x: (rng() - 0.5) * 5, y: 24 + rng() * 6 },
  }),
};

/** Seconds before the ball's "perfect" arrival that a strike may already be
 *  attempted — the "read it early" skill option, unchanged from the first
 *  build. */
const READY_LEAD = 0.35;
/**
 * Seconds after arrival before the chance is genuinely gone — a generous
 * safety net, not a real deadline. Reads as "basically unlimited" to a
 * human deciding what to do (the settle motion in `ballFlightAt` keeps the
 * ball visibly alive the whole time without drifting away), and only
 * exists at all so an abandoned sandbox run doesn't hang forever.
 */
const READY_TAIL = 12;

/** Metres a defender/support runner covers arriving into the position
 *  `buildScenario` already balanced the finish around. */
const RUN_IN = 7;
/** The same idea for YOU — a shorter run than a defender recovering from
 *  deep, since this is your own timed run onto the ball, not a scramble
 *  back. See the header note on why this exists at all. */
const PLAYER_RUN_IN = 4.5;

export interface LiveAttackState {
  kind: DeliveryKind;
  scenario: Scenario;
  t: number;
  approach: Approach;
  readyStart: number;
  readyEnd: number;
  /** Where you run in FROM, same idea as defenderFrom/runnerFrom below. */
  playerFrom: Vec2;
  /** Parallel to scenario.defenders / scenario.secondaryRunners — where each
   *  one runs in FROM. */
  defenderFrom: Vec2[];
  runnerFrom: Vec2[];
  phase: "buildup" | "struck" | "missed";
}

export function newLiveAttack(
  kind: DeliveryKind,
  rng: () => number,
  keeperStrength = 62,
  teamRelationship = 60,
  vision = 55,
): LiveAttackState {
  const scenario = buildScenario(SHOT_KIND_FOR[kind], rng, keeperStrength, teamRelationship, vision);
  initDefenders(scenario, rng);
  const spec = APPROACH_FOR[kind](rng);
  const from: Vec2 = {
    x: clamp(scenario.ball.x + spec.offset.x, 2, PITCH_W - 2),
    y: Math.max(1, scenario.ball.y + spec.offset.y),
  };
  const approach: Approach = { from, duration: spec.duration, bounces: spec.bounces, peak: spec.peak };
  const playerFrom: Vec2 = {
    x: clamp(scenario.player.x + (rng() - 0.5) * 4, 2, PITCH_W - 2),
    y: Math.max(0.5, scenario.player.y + PLAYER_RUN_IN + rng() * 2.5),
  };
  const defenderFrom = scenario.defenders.map(d => ({
    x: d.x + (rng() - 0.5) * 4,
    y: d.y + RUN_IN + rng() * 3,
  }));
  const runnerFrom = scenario.secondaryRunners.map(r => ({
    x: r.pos.x + (rng() - 0.5) * 4,
    y: r.pos.y + RUN_IN + rng() * 3,
  }));
  return {
    kind, scenario, t: 0, approach,
    readyStart: Math.max(0, approach.duration - READY_LEAD),
    readyEnd: approach.duration + READY_TAIL,
    playerFrom, defenderFrom, runnerFrom,
    phase: "buildup",
  };
}

/**
 * Where the ball actually is at time `t` — read every frame for rendering,
 * and read once more at the moment of the aim-release to find out exactly
 * where it was struck from.
 *
 * Past `approach.duration` it used to keep rolling on in its own direction
 * forever, which made striking late genuinely harder — but with the ready
 * window now generous (see READY_TAIL), a ball that never stops rolling
 * would eventually roll off the edge of the frame while you were still
 * looking at the picture. It settles instead: a small, quickly-decaying
 * wobble back and forth along the delivery's own line, centred on the real
 * arrival point, so it still reads as a ball that has just arrived rather
 * than a frozen photograph — without ever drifting away from where you're
 * about to strike it.
 */
export function ballFlightAt(state: LiveAttackState, t: number): { x: number; y: number; z: number } {
  const { approach, scenario } = state;
  const to = scenario.ball;
  const dx = to.x - approach.from.x, dy = to.y - approach.from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const dirX = dx / dist, dirY = dy / dist;
  let x: number, y: number, u: number;
  if (t <= approach.duration) {
    u = clamp(t / approach.duration, 0, 1);
    x = approach.from.x + dx * u;
    y = approach.from.y + dy * u;
  } else {
    const settleT = t - approach.duration;
    const decay = Math.exp(-settleT * 1.6);
    const wobble = Math.sin(settleT * 5.5) * 0.6 * decay;
    x = to.x + dirX * wobble;
    y = to.y + dirY * wobble;
    u = 1;
  }
  let z = 0;
  if (t <= approach.duration) {
    if (approach.peak > 0) {
      z = 4 * approach.peak * u * (1 - u);
    } else if (approach.bounces > 0) {
      const decay = Math.max(0, 1 - u * 0.6);
      z = Math.max(0, Math.sin(u * approach.bounces * Math.PI)) * 1.1 * decay;
    }
  } else {
    // A last little bounce right on arrival, settling fast — same spirit as
    // the lateral wobble above.
    const settleT = t - approach.duration;
    z = Math.max(0, Math.sin(settleT * 7)) * 0.3 * Math.exp(-settleT * 2.5);
  }
  return { x, y, z };
}

/** True during the window a strike may be attempted at all. */
export function isReady(state: LiveAttackState): boolean {
  return state.t >= state.readyStart && state.t <= state.readyEnd;
}

/** True once the window has closed with nothing done about it. */
export function hasMissed(state: LiveAttackState): boolean {
  return state.t > state.readyEnd && state.phase === "buildup";
}

export function stepLiveAttack(state: LiveAttackState, dt: number): void {
  if (state.phase !== "buildup") return;
  state.t += dt;
  if (state.t > state.readyEnd) state.phase = "missed";
}

/**
 * Live positions for you, defenders and support runners — all interpolated
 * from where they ran in from toward the real position `buildScenario`
 * placed them at, and held there once the ball has arrived, exactly like a
 * real chance. Your own run (`player`) is the direct fix for the most
 * concrete piece of playtesting feedback this design got: "everyone's
 * running because this is a football match, but my player is just
 * standing there... a lot of the time he's just standing offside."
 */
export function fieldPositionsAt(state: LiveAttackState): { player: Vec2; defenders: Vec2[]; runners: Vec2[] } {
  const u = clamp(state.t / state.approach.duration, 0, 1);
  const lerp = (a: number, b: number) => a + (b - a) * u;
  return {
    player: {
      x: lerp(state.playerFrom.x, state.scenario.player.x),
      y: lerp(state.playerFrom.y, state.scenario.player.y),
    },
    defenders: state.scenario.defenders.map((d, i) => ({
      x: lerp(state.defenderFrom[i].x, d.x), y: lerp(state.defenderFrom[i].y, d.y),
    })),
    runners: state.scenario.secondaryRunners.map((r, i) => ({
      x: lerp(state.runnerFrom[i].x, r.pos.x), y: lerp(state.runnerFrom[i].y, r.pos.y),
    })),
  };
}

/**
 * Locks in the strike: moves `scenario.ball` to wherever it actually was at
 * the moment of release (clamped inside the scenario's own viewport, since
 * a late strike can have rolled a couple of metres past the "perfect"
 * arrival point) and hands back that point for the aim gesture to measure
 * its direction from. Everything after this — aim direction, contact,
 * launch(), stepBall/stepKeeper — is the exact same real-match pipeline
 * every other chance in the game uses.
 */
export function strikeLiveAttack(state: LiveAttackState, t: number): Vec2 {
  const live = ballFlightAt(state, t);
  const vp = state.scenario.viewport;
  const margin = 1.5;
  const point: Vec2 = {
    x: clamp(live.x, vp.x1 + margin, vp.x2 - margin),
    y: clamp(live.y, vp.y1 + margin, vp.y2 - margin),
  };
  state.scenario.ball = point;
  state.phase = "struck";
  return point;
}

/** How many metres of drag a full-power strike takes, given the player's
 *  power stat — the pitch-metres equivalent of canvasEngine's own
 *  dragForFullPower, since this sandbox reads the aim gesture in pitch
 *  coordinates (pitchFromPx) rather than CanvasMatch's screen-fraction
 *  math. A stronger player needs less of a pull to reach full power, same
 *  relationship, different units. */
export function fullPowerPullMetres(power: number): number {
  return 9 - (clamp(power, 0, 100) / 100) * 2;
}

export function powerFromPull(pullMetres: number, power: number): number {
  return clamp(pullMetres / fullPowerPullMetres(power), 0, 1);
}
