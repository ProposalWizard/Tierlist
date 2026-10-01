"use client";
import { useCallback, useRef } from "react";
import type { Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { REPS, ladderLevel, techniqueSetup } from "@/lib/star/trialStages";
import { difficultyFor, type TrialProgress } from "@/lib/star/trial";
import { gateCrossing, gateQuality } from "@/lib/star/trainingDrills";
import { buildStrike, DRILL_SCENE, type StrikeSetup } from "@/components/star/TrainingMinigame";
import type { ChanceResolved } from "@/components/star/CanvasMatch";
import { StrikeStage } from "./TrialPenalties";

/**
 * THROUGH THE GATE — the trial's technique stage (1 Oct 2026).
 *
 * Harry: "remove the 5-side and find the player, and we just do the technique
 * drill there." So this IS training's technique drill, not a new one:
 *
 *   - the picture is training's own `buildStrike("technique", …)` — you, a
 *     ball and two cones, no keeper, no goal (training's `DRILL_SCENE`)
 *   - the gate recedes, narrows and slides off your line by training's own
 *     `techniqueDrill` ladder, on the rung the trial's difficulty points at
 *     (`techniqueSetup`)
 *   - a ball is judged where it really crossed the cones' line, by training's
 *     own `gateCrossing` / `gateQuality`
 *
 * The football is the real match, through `EngineFeature` inside the trial's
 * `StrikeStage` (the same frame, rep counter, pips and teaching card the free
 * kicks use). What differs from training is only what a trial needs: one ball
 * at the gate rather than three tries at a rising one (v0.23: "it's just a
 * tutorial on how to play the game"), and a 0-1 mark for it rather than a pass
 * or a fail.
 */

export interface TrialTechniqueProps {
  trial: TrialProgress;
  onDone: (quality: number) => void;
  skills?: { power: number; technique: number };
}

/** The ladder rung this trial's gate stands on (0-100). */
function levelFor(trial: TrialProgress): number {
  return ladderLevel(difficultyFor(trial, "technique"));
}

/** Seeded per rep, like every other stage — see trial.ts. */
const repRng = (seed: number, rep: number) => mulberry32((seed ^ ((rep + 1) * 0x9e3779b1)) >>> 0);

export default function TrialTechnique({
  trial, onDone, skills = { power: 55, technique: 55 },
}: TrialTechniqueProps) {
  const seed = (trial.seed ^ 0x7e4c) >>> 0;
  const setupRef = useRef<StrikeSetup | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossedRef = useRef<{ x: number; z: number } | null>(null);

  const build = useCallback((rep: number, rng: () => number): Scenario => {
    const setup = buildStrike("technique", levelFor(trial), rep, rng);
    setup.scenario.viewport = { ...setup.viewport };
    // Stood a stride behind it and off to the side, as on the free kicks. Training's own picture
    // puts you 0.8 m behind the ball, which on the screen draws the ball
    // between your boots where it cannot be seen (looked at on a phone,
    // 1 Oct 2026). Where the ball and the cones are is unchanged.
    const b = setup.scenario.ball;
    setup.scenario.player = { x: b.x + 1.2, y: b.y + 1.8 };
    setupRef.current = setup;
    prevRef.current = null;
    crossedRef.current = null;
    return setup.scenario;
  }, [trial]);

  // The cones for a rep — the same seeded build the engine is handed, so they
  // stand exactly where the gate is judged.
  const markersFor = useCallback((rep: number) => {
    const g = buildStrike("technique", levelFor(trial), rep, repRng(seed, rep)).gate;
    return g ? [{ x: g.left.x, y: g.left.y }, { x: g.right.x, y: g.right.y }] : [];
  }, [trial, seed]);

  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    const setup = setupRef.current;
    if (!setup?.gate || crossedRef.current) return;
    const prev = prevRef.current;
    if (prev) {
      const c = gateCrossing(prev, b, setup.gate.centre.y);
      if (c) crossedRef.current = c;
    }
    prevRef.current = { ...b };
  }, []);

  const judge = useCallback((_info: ChanceResolved) => {
    const setup = setupRef.current;
    if (!setup?.gate || !setup.gateCfg) return { quality: 0, text: "Missed the gate." };
    const q = gateQuality(crossedRef.current, setup.gateCfg, setup.gate.centre.x);
    const text = q >= 0.9 ? "Threaded it!" : q >= 0.45 ? "Through." : q > 0 ? "Clipped it." : "Missed the gate.";
    return { quality: q, text };
  }, []);

  return (
    <StrikeStage
      reps={REPS.technique}
      build={build}
      skills={skills}
      seed={seed}
      drill="technique"
      // No man on the pitch and no penalty box drawn (Harry, 1 Oct 2026: "let's
      // remove the guy" outside penalties and free kicks, and "the pitch
      // doesn't need to have the box in it at all times"): you, a ball, two
      // cones. Only what is drawn changes — the ball and the strike are the
      // real match's.
      scene={{ ...DRILL_SCENE.technique, you: false, box: false }}
      markersFor={markersFor}
      onBallStep={onBallStep}
      judge={judge}
      title="Through the gate"
      hint="Strike the side of the ball to bend it through the cones."
      teach={{
        headline: "Put it through the cones.",
        short: "Through the cones.",
        lines: [
          "Drag back to aim and set power, then pick your spot on the ball.",
          "The gate moves off your line — strike the side of the ball to bend it in.",
        ],
      }}
      subtitle={rep => {
        const cfg = techniqueSetup(trial, rep);
        return `${Math.round(cfg.gateDistance)} m out · ${cfg.gateWidth.toFixed(1)} m gap`;
      }}
      forceCompactTeach
      onDone={onDone}
    />
  );
}
