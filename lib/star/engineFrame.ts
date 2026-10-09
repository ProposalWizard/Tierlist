/**
 * THE REAL MATCH, READ FRAME BY FRAME — "same brain, new camera".
 *
 * Harry, 9 Oct 2026: "the top down also is obviously not the real game — you
 * need to update the actual 3D of the real base 2D engine." So a 3D picture
 * of the real game must be drawn FROM the real game: CanvasMatch runs every
 * chance exactly as always (the ball, the drag, the keeper, the scoring) and,
 * when a screen asks, hands over what it has just drawn: every man where the
 * 2D picture put him, the keeper and his dive, the ball with its height, the
 * aim arrow, and the camera (the frame on the pitch, which way it faces, its
 * tilt). A 3D view (lib/star/style3d/engineView.ts) draws that. It never
 * simulates anything and never writes back.
 *
 * How a screen asks: wrap EnginePlay in `<EngineFrameContext.Provider>`.
 * No prop on CanvasMatch, so the real career match and every test screen
 * mount it exactly as before; without a provider nothing here runs.
 *
 * Pitch metres, the engine's own frame: x across (0..68, goal centre 34),
 * y out from the goal line (goal line at 0), z up.
 */
import { createContext } from "react";
import type { Facing, ScenarioKind, Vec2, Viewport, SaveKind } from "./canvasEngine";
import type { Tilt } from "./cameraTilt";

/** What a man is doing with the ball right now (the engine's action log). */
export interface EngineFrameAct {
  kind: string;
  mode?: string;
  save?: string;
  /** performance.now() / 1000 when it happened. */
  start: number;
}

export interface EngineFrameFigure {
  /** Who: "you", "follower", "run0", "mate1", "def2", "chase0"… (stable within a chance). */
  sid: string;
  x: number;
  y: number;
  shirt: string;
  shorts: string;
  team: "us" | "them";
  /** Your own swing, held for a moment after the strike. */
  kick: boolean;
  /** +1 right foot, −1 left. */
  kickFoot: number;
  act?: EngineFrameAct;
  star?: boolean;
  label?: string;
  /** The photo the 2D picture puts on his head. */
  face?: string;
  /** Drawn by the 2D picture. False: a man the 3D view may add (you, in open play, where 2D draws the ball as you). */
  drawn: boolean;
}

export interface EngineFrameKeeper {
  x: number;
  y: number;
  /** Lean while patrolling (m, signed). */
  dive: number;
  /** 0..1 once a save is being played. */
  saveLunge: number;
  saveDir: number;
  saveKind: SaveKind | null;
  idleT: number;
  shirt: string;
  shorts: string;
  face?: string;
  act?: EngineFrameAct;
}

export interface EngineFrameCamera {
  /** The pitch rectangle the canvas shows (before the tilt). */
  viewport: Viewport;
  facing: Facing;
  /** The tilt the finished canvas is tipped back by (lib/star/cameraTilt.ts), null when flat. */
  tilt: Tilt | null;
  /** The canvas box, CSS px. */
  W: number;
  H: number;
}

export interface EngineFrame {
  /** performance.now() / 1000. */
  t: number;
  phase: string;
  kind: ScenarioKind;
  cam: EngineFrameCamera;
  /** The ball as drawn (null: none on the pitch this frame). */
  ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number; live: boolean; inNet: boolean } | null;
  /** Where a ball in the air will first land (the 2D's cross on the grass). */
  landing: Vec2 | null;
  keeper: EngineFrameKeeper | null;
  figures: EngineFrameFigure[];
  /** The aim arrow (drag or run-up): from the ball to its tip, and the power 0..1. */
  aim: { from: Vec2; to: Vec2; power: number } | null;
  /** The ring under the man on the ball (new view): where it is. */
  ring: Vec2 | null;
  /** Whose goal it was while the result is up. */
  goalSide: "us" | "them" | null;
  /** The goal is part of this picture (a keeper may stand in it). */
  goalInView: boolean;
}

export interface EngineFrameObserver {
  /** Keep drawing the 2D canvas but make it invisible (it still takes every touch). */
  hide2D?: boolean;
  /** Called once with the pitch box and its canvas: put a picture in it. Return a clean-up. */
  attach?: (wrap: HTMLDivElement, canvas: HTMLCanvasElement) => void | (() => void);
  /** Called after every frame the 2D picture draws. Read only: never change what it hands you. */
  onFrame: (f: EngineFrame) => void;
}

export const EngineFrameContext = createContext<EngineFrameObserver | null>(null);
