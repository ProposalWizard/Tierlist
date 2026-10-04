"use client";

/**
 * WOODWORK CHALLENGE — the team-mates' game. After training, you and two
 * team-mates take five shots each at an empty goal. Hitting the post or the
 * bar scores a point. Beat (or match) the best of them to win.
 *
 * Played on the real match engine (EngineFeature, .claude/skills/one-engine):
 * the real ball, drag, contact and flight. This file only builds each shot's
 * picture (Training's own buildStrike, open goal, no keeper) and watches the
 * ball for the frame.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { gameReward, touchingFrame } from "@/lib/star/relationships";
import { CX, PITCH_W } from "@/lib/star/pitch";
import { FRAME_TOP_FOR_GOAL } from "@/lib/star/goalFrame";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { EngineFeature } from "../EnginePlay";
import { buildStrike, DRILL_SCENE } from "../TrainingMinigame";
import type { ChanceResolved } from "../CanvasMatch";
import { GameShell, ResultPanel, type GameResult } from "./Shell";

const SHOTS = 5;

export default function WoodworkChallenge({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = career.relationships.team;
  // Two team-mates and their scores, fixed when the challenge starts. A
  // better player hits the frame a bit more often (about 1 in 4 to 1 in 3).
  const mates = useMemo(() => {
    const rng = mulberry32(career.season * 991 + career.week * 37);
    const pool = (career.squad ?? []).filter((p) => p.position !== "GK");
    const pick = [pool[Math.floor(rng() * pool.length)], pool[Math.floor(rng() * pool.length)]].filter(Boolean);
    return pick.slice(0, 2).map((p, i) => {
      const chance = 0.16 + Math.min(99, p.overall ?? 60) / 600;
      let hits = 0;
      for (let s = 0; s < SHOTS; s++) if (rng() < chance) hits++;
      return { id: p.id ?? String(i), name: p.name.split(" ").slice(-1)[0], face: p.imageUrl ?? fakeFaceFor(p.id ?? String(i)), hits };
    });
  }, [career.season, career.week, career.squad]);
  const best = Math.max(1, ...mates.map((m) => m.hits));

  const [shot, setShot] = useState(0);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const hitRef = useRef(false);

  const openOn = useCallback((): Scenario => {
    const setup = buildStrike("power", 1, shot, mulberry32(career.season * 131 + career.week * 17 + shot), { trainingLevel: 1, power: career.skills.power });
    // A close camera on the goal: training's frame is the match's (42 m tall),
    // far too wide to see the posts and the bar you're aiming at.
    const ball = setup.scenario.ball;
    const h = Math.max(22, ball.y + 10);
    const w = h * (5 / 8);
    const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, (ball.x + CX) / 2));
    setup.scenario.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
    hitRef.current = false;
    return setup.scenario;
  }, [shot, career.season, career.week, career.skills.power]);

  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    if (!hitRef.current && touchingFrame(b)) hitRef.current = true;
  }, []);

  const onChanceResolved = useCallback((_info: ChanceResolved) => {
    const hit = hitRef.current;
    const total = hits + (hit ? 1 : 0);
    setHits(total);
    setFlash(hit ? "OFF THE WOODWORK!" : "MISSED THE FRAME");
    window.setTimeout(() => setFlash(null), 900);
    const next = shot + 1;
    if (next >= SHOTS) {
      const won = total >= best;
      window.setTimeout(() => setResult({ won, gain: gameReward(won, current, Math.random(), "team"), line: `You hit the frame ${total} of ${SHOTS}. Best of the lads: ${best}.` }), 900);
    } else window.setTimeout(() => setShot(next), 900);
  }, [hits, shot, best, current]);

  return (
    <GameShell title="Woodwork challenge" who="Team" current={current} tone="#34d399" onBack={shot === 0 && !result ? onCancel : undefined}>
      <div className="mb-2 text-[14px] font-bold">Hit the post or the bar. Five shots each. Beat the lads.</div>
      <div className="mb-2 grid grid-cols-3 gap-1 text-center">
        <Score name="You" score={`${hits}`} sub={`shot ${Math.min(shot + 1, SHOTS)}/${SHOTS}`} />
        {mates.map((m) => <Score key={m.id} name={m.name} face={m.face} score={`${m.hits}`} sub="5 shots" />)}
      </div>
      <div className="relative">
        {!result && <EngineFeature
          key={shot}
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          onBallStep={onBallStep}
          skills={{ power: career.skills.power, technique: career.skills.technique }}
          keeperStrength={0}
          seed={career.season * 131 + career.week * 17 + shot}
          scene={{ ...DRILL_SCENE.power, keeper: false, ownFrame: true }}
        />}
        {flash && <div className="pointer-events-none absolute inset-x-0 top-1/3 z-30 text-center text-[24px] font-black uppercase text-white" style={{ textShadow: "0 2px 6px #000" }}>{flash}</div>}
      </div>
      {result && <ResultPanel result={result} who="Team" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}

function Score({ name, score, sub, face }: { name: string; score: string; sub: string; face?: string }) {
  return (
    <div className="bg-white/10 px-1 py-1.5" style={{ borderRadius: 4 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {face ? <img src={face} alt="" className="mx-auto h-[28px] w-[28px] rounded-full object-cover object-top" /> : <div className="mx-auto grid h-[28px] w-[28px] place-items-center text-[18px]">⭐</div>}
      <div className="truncate text-[11px] font-black uppercase">{name}</div>
      <div className="text-[20px] font-black leading-none">{score}</div>
      <div className="text-[10px] font-bold">{sub}</div>
    </div>
  );
}
