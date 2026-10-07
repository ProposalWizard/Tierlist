"use client";

/**
 * EXTRA SESSION — one of the manager's three games (Harry, 6 Oct 2026;
 * MANAGER_PLAN.md; scoring in lib/star/bossSession.ts). Four shots of
 * Training's power drill, each a level harder, with the manager watching.
 *
 * Played on the real match engine (EngineFeature, .claude/skills/one-engine):
 * the real ball, drag, contact, flight and keeper. This file only builds each
 * rep's picture (Training's own buildStrike) and counts the goals.
 */
import { useCallback, useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { powerDrillForLevel } from "@/lib/star/trainingDrills";
import { CX, PITCH_W } from "@/lib/star/pitch";
import { FRAME_TOP_FOR_GOAL } from "@/lib/star/goalFrame";
import { fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { SESSION_REPS, SESSION_FIRST_LEVEL, sessionGain, sessionHits } from "@/lib/star/bossSession";
import { EngineFeature } from "../EnginePlay";
import { buildStrike, DRILL_SCENE } from "../TrainingMinigame";
import type { ChanceResolved } from "../CanvasMatch";
import { GameShell, ResultPanel, type GameResult } from "./Shell";

export default function BossExtraSession({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = career.relationships.boss;
  const boss = career.manager?.name ?? "The manager";
  const seed = career.season * 5113 + career.week * 173;
  const power = career.skills.power;
  const face = useMemo(() => {
    const yours = career.player.portrait ?? DEFAULT_FAKE_FACE;
    const f = fakeFaceFor(`manager:${boss}`);
    return f === yours ? fakeFaceFor(`gaffer:${boss}:2`) : f;
  }, [boss, career.player.portrait]);

  const [rep, setRep] = useState(0);
  const [goals, setGoals] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const level = SESSION_FIRST_LEVEL + rep;
  const byLevel = useMemo(() => ({ trainingLevel: level, power }), [level, power]);
  const drill = powerDrillForLevel(level, rep, power);

  const openOn = useCallback((): Scenario => {
    const setup = buildStrike("power", 1, rep, mulberry32(seed + rep * 911), byLevel);
    // The woodwork challenge's close camera on the goal and the ball
    // (scene.ownFrame): the match's own frame is far too tall for one shot.
    const ball = setup.scenario.ball;
    const h = Math.max(22, ball.y + 10);
    const w = h * (5 / 8);
    const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, (ball.x + CX) / 2));
    setup.scenario.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
    return setup.scenario;
  }, [rep, seed, byLevel]);

  const onChanceResolved = useCallback((info: ChanceResolved) => {
    const o = info.teammateShot ? "saved" : info.outcome;
    const scored = o === "goal" || o === "rebound";
    const total = goals + (scored ? 1 : 0);
    setGoals(total);
    setFlash(scored ? "GOAL!" : o === "saved" || o === "tipped" || o === "caught" ? "SAVED" : o === "blocked" || o === "tackled" ? "BLOCKED" : o === "post" ? "OFF THE POST" : o === "over" ? "OVER" : "WIDE");
    window.setTimeout(() => setFlash(null), 1000);
    const next = rep + 1;
    if (next >= SESSION_REPS) {
      const hits = sessionHits(total);
      window.setTimeout(() => setResult({
        won: hits > 0,
        gain: sessionGain(total),
        line: total === SESSION_REPS ? "Every one in. He nods and writes something down." : total > 0 ? `${total} of ${SESSION_REPS} in.` : "Not one in. He walks off before you finish.",
      }), 1100);
    } else window.setTimeout(() => setRep(next), 1100);
  }, [goals, rep]);

  return (
    <GameShell title="Extra session" who="Boss" current={current} tone="#60a5fa" onBack={rep === 0 && !result ? onCancel : undefined}>
      <div className="mb-2 flex items-center gap-2" data-boss-watching>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={face} alt="" className="h-[40px] w-[40px] shrink-0 rounded-full object-cover object-top ring-2 ring-blue-300/70" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-black uppercase text-amber-300">The manager is watching</div>
          <div className="text-[12px] font-bold text-white">{boss} · score as many as you can</div>
        </div>
      </div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-black uppercase">
        <span>Shot {Math.min(rep + 1, SESSION_REPS)} / {SESSION_REPS}</span>
        <span>{Array.from({ length: SESSION_REPS }).map((_, i) => <span key={i} className={i < goals ? "text-emerald-300" : "opacity-30"}>⚽</span>)}</span>
      </div>
      <div className="relative">
        {!result && <EngineFeature
          key={rep}
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          skills={{ power: career.skills.power, technique: career.skills.technique }}
          keeperStrength={drill.keeperStrength}
          seed={seed + rep}
          scene={drill.keeper ? { ...DRILL_SCENE.power, ownFrame: true } : { ...DRILL_SCENE.power, keeper: false, ownFrame: true }}
        />}
        {flash && <div className="pointer-events-none absolute inset-x-0 top-1/3 z-30 text-center text-[26px] font-black uppercase text-white" style={{ textShadow: "0 2px 6px #000" }}>{flash}</div>}
      </div>
      {result && <ResultPanel result={result} who="Boss" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}
