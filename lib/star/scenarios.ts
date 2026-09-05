import { PITCH_W, HALF_LEN } from "./pitch";
import type { Facing } from "./scenarioRender";

/**
 * HAND-BUILT MATCH SCENARIOS — THE DATA MODEL, NOTHING WIRED UP YET.
 *
 * Asked directly, and asked to build ONLY the authoring side first: could a
 * camera framing and a set of teammate/opponent positions be hand-placed,
 * saved, and later drawn from at random the way a corner or a free kick
 * already picks a starting shape? The answer worked out yes — the pieces
 * this needs already exist and agree with each other (a pool of authored
 * content, chosen from at random at runtime, is the exact same idea
 * `lib/star/media/templates.ts`'s post templates and `lib/star/dilemmas.ts`
 * already are) — but nothing here is READ by the real match engine. This is
 * the editor's own save format, built so you can place one scenario
 * completely, save it, and see it played back, before any of the hundred
 * are actually built or the game is asked to draw from any of them.
 *
 * Coordinates deliberately reuse `pitch.ts`'s own real-metre system (x: 0 at
 * the left touchline to PITCH_W=68 at the right; y: 0 at the goal line this
 * scenario faces, growing upfield) rather than a separate 0-100 scale
 * invented for the editor — that file is already "the single source of
 * truth... scenario building and rendering all read from here", so a
 * scenario built against real pitch metres is the one shape that could
 * eventually be handed straight to the real renderer with no translation
 * step, if this is ever actually wired in.
 */

export type ScenarioSide = "you" | "teammate" | "opponent";

/** What moment this scenario is a starting shape FOR. A different list from
 *  canvasEngineTest.ts's own SCENARIO_KINDS on purpose — that one names
 *  KINDS OF CHANCE (a volley, a cutback, a long-range strike), all of which
 *  start from open play already under way; this one names the dead-ball
 *  and kickoff MOMENTS a hand-placed starting shape actually makes sense
 *  for, which is a different question entirely. */
export const SCENARIO_KINDS = [
  "corner", "free_kick", "throw_in", "kickoff", "open_play",
] as const;
export type ScenarioMomentKind = (typeof SCENARIO_KINDS)[number];

export interface ScenarioPlayer {
  id: string;
  side: ScenarioSide;
  /** Metres from the left touchline, 0-68. */
  x: number;
  /** Metres from the goal line this scenario faces, growing upfield. */
  y: number;
  /** A free-text label only — "GK", "far post", whatever the editor finds
   *  useful when placing. Never read by anything that matters. */
  label?: string;
}

/**
 * The framing this scenario is viewed through — a rectangle over the real
 * pitch, exactly the shape canvasEngine.ts's own `Viewport` is (see
 * `scenarioRender.ts`, which shares its `Viewport`/`Facing` types with the
 * real match engine's own model on purpose). Requested directly, once the
 * editor started drawing the pitch the way a real match actually looks: a
 * free rotation angle had nothing to match it against, because the real
 * camera only ever turns in the three ways `facing` names below, never a
 * free degree — so an arbitrary tilt could show a scenario built at an
 * angle the game would never actually film it at.
 */
export interface ScenarioCamera {
  /** Centre of the framed view, in the same pitch metres as the players. */
  centerX: number;
  centerY: number;
  /** How much pitch the frame shows, in metres, along the LONGER (y) axis
   *  — the shorter axis is derived from the editor/canvas's own aspect
   *  ratio so the frame is never stretched. Smaller is a tighter shot. */
  viewHeight: number;
  /** "up" is the ordinary view (goal in front of you); "left"/"right" are
   *  the same quarter-turn a crossing situation is watched from in a real
   *  match — see canvasEngine.ts's own Facing. */
  facing: Facing;
}

export interface MatchScenario {
  id: string;
  /** Whatever the person building it wants to call it — "back post corner",
   *  "wide free kick, right side", nothing this reads structurally. */
  name: string;
  kind: ScenarioMomentKind;
  camera: ScenarioCamera;
  /** Kept in the save format for whenever this is actually wired into the
   *  real game — but in the editor itself it is never independently placed
   *  or selected: it always mirrors the "you" player's own position, kept
   *  in sync the moment he moves (ScenarioEditor.tsx), the same way the
   *  ball genuinely is at your feet a moment before you strike it. */
  ball: { x: number; y: number };
  players: ScenarioPlayer[];
  /** When this scenario was last saved — for sorting the list, nothing more. */
  updatedAt: number;
}

export function newScenarioId(): string {
  return `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** A goal-line-facing scenario's usual working area: the attacking third,
 *  centred on goal. A sensible starting camera and a sensible starting
 *  spot for the ball and the You marker — all freely moved from there. */
export function blankScenario(kind: ScenarioMomentKind = "corner"): MatchScenario {
  const nearGoal = kind === "corner" || kind === "free_kick" || kind === "throw_in";
  const ballY = kind === "kickoff" ? HALF_LEN : nearGoal ? 8 : HALF_LEN - 15;
  return {
    id: newScenarioId(),
    name: "Untitled scenario",
    kind,
    camera: {
      centerX: PITCH_W / 2,
      centerY: nearGoal ? 16 : ballY,
      viewHeight: nearGoal ? 40 : 55,
      facing: "up",
    },
    ball: { x: kind === "corner" ? 2 : PITCH_W / 2, y: ballY },
    players: [
      { id: "you", side: "you", x: PITCH_W / 2, y: nearGoal ? 12 : ballY },
    ],
    updatedAt: Date.now(),
  };
}

/** Add one more body to the pitch, offset a little from the ball so a
 *  freshly-added dot is never sitting exactly on top of another one. */
export function addPlayer(scenario: MatchScenario, side: ScenarioSide): MatchScenario {
  const n = scenario.players.filter(p => p.side === side).length;
  const spread = (n % 5) - 2;
  return {
    ...scenario,
    players: [
      ...scenario.players,
      {
        id: newScenarioId(),
        side,
        x: Math.max(1, Math.min(PITCH_W - 1, scenario.ball.x + spread * 3 + (side === "opponent" ? 4 : -4))),
        y: Math.max(1, Math.min(HALF_LEN * 2 - 1, scenario.ball.y + 6 + Math.floor(n / 5) * 3)),
      },
    ],
  };
}
