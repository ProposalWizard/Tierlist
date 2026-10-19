/**
 * What the Real Goals test page (/star-real-goals-dev) hands the real match
 * (CanvasMatch's optional `realGoal` prop, off by default): the real sides,
 * the real names and the real goal's ball as a ghost. Drawing and labels
 * only — nothing here is read by the ball, the keeper or an outcome.
 *
 * Holds no data: the StatsBomb goals stay in lib/star/realGoals.ts, which the
 * real game never imports.
 */
import type { Scenario } from "./canvasEngine";
import type { Kit } from "./kits";

export interface RealGoalSide { name: string; kit: Kit }

export interface RealGoalGhost {
  /** The real ball's flight, pitch metres (z up), from the strike to the goal line. */
  pts: { x: number; y: number; z: number }[];
  /** How long the real ball took, seconds. */
  durS: number;
}

export interface RealGoalView {
  /** The side that scored (you), and the side that conceded. */
  us: RealGoalSide;
  them: RealGoalSide;
  /** Their keeper's kit. */
  keeperKit?: Kit;
  /** The scoreboard's competition box ("WC", "EURO"). */
  badge?: string;
  /** Your name on the pitch (the real scorer). */
  youName?: string;
  /** Show every man's name over his head (the real names). */
  showNames?: boolean;
  /** Put the real names on the chance's men (called after the match casts its own). */
  dress?: (sc: Scenario) => void;
  /** The real goal's ball, drawn faintly on the pitch. Null: hidden. */
  ghost?: RealGoalGhost | null;
}
