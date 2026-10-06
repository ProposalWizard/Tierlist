"use client";

/**
 * THE MANAGER'S TARGET PENALTIES — the boss's game (Mikey, 5 Oct 2026; rules
 * in lib/star/bossPenalties.ts). Three penalties at an empty goal; before
 * each, the manager beside you names one of six spots. A board above the
 * pitch shows the goal front-on with an archery target on every spot, the
 * one he asked for lit up, and a dot where your shot went.
 *
 * Played on the real match engine (EngineFeature, .claude/skills/one-engine):
 * the real ball, drag, contact and flight. This file only builds each kick's
 * picture and watches where the ball crosses the line. The match camera looks
 * down on the pitch, so it cannot draw a target on the face of the goal —
 * hence the board.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import type { Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { CX, PEN_SPOT_Y, PITCH_W, POST_L, GOAL_W, GOAL_H } from "@/lib/star/pitch";
import { FRAME_TOP_FOR_GOAL } from "@/lib/star/goalFrame";
import { careerPenaltyRunup } from "@/lib/star/runupStyles";
import { fakeFaceFor, DEFAULT_FAKE_FACE } from "@/lib/star/fakeFaces";
import { BOSS_KICKS, SPOTS, askLine, bossGain, pickSpots, spotCentre, spotOf, SPOT_LABEL, type Spot } from "@/lib/star/bossPenalties";
import { EngineFeature } from "../EnginePlay";
import { buildStrike, DRILL_SCENE } from "../TrainingMinigame";
import type { ChanceResolved } from "../CanvasMatch";
import { GameShell, ResultPanel, type GameResult } from "./Shell";

export default function BossPenalties({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = career.relationships.boss;
  const boss = career.manager?.name ?? "The manager";
  const seed = career.season * 7307 + career.week * 131;
  const { spots, lines } = useMemo(() => {
    const rng = mulberry32(seed + (Date.now() % 100000));
    const s = pickSpots(rng);
    return { spots: s, lines: s.map((sp, i) => askLine(sp, i, rng)) };
  }, [seed]);
  const face = useMemo(() => {
    const yours = career.player.portrait ?? DEFAULT_FAKE_FACE;
    const f = fakeFaceFor(`manager:${boss}`);
    return f === yours ? fakeFaceFor(`gaffer:${boss}:2`) : f;
  }, [boss, career.player.portrait]);

  const [kick, setKick] = useState(0);
  const [hits, setHits] = useState(0);
  const [last, setLast] = useState<{ x: number; z: number; hit: boolean } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const crossRef = useRef<{ x: number; z: number } | null>(null);
  const target = spots[Math.min(kick, BOSS_KICKS - 1)];

  const openOn = useCallback((): Scenario => {
    // Built the way the woodwork challenge builds its shot (Training's own
    // buildStrike, an open goal), with the ball on the penalty spot. A
    // "penalty" picture would bring the match's own penalty camera, which is
    // too far out to see the spots you're aiming at.
    const setup = buildStrike("power", 1, kick, mulberry32(seed + kick * 977), { trainingLevel: 1, power: career.skills.power });
    const sc = setup.scenario;
    sc.ball = { x: CX, y: PEN_SPOT_Y };
    sc.player = { x: CX, y: PEN_SPOT_Y + 1.2 };
    sc.defenders = [];
    const h = 22, w = h * (5 / 8);
    const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, CX));
    sc.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
    crossRef.current = null;
    return sc;
  }, [seed, kick, career.skills.power]);

  // Where the ball crosses the goal line (y = 0), read off the real flight.
  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    if (!crossRef.current && b.y <= 0) crossRef.current = { x: b.x, z: b.z };
  }, []);

  const onChanceResolved = useCallback((info: ChanceResolved) => {
    const at = crossRef.current ?? (info.ball && info.ball.y <= 0.5 ? { x: info.ball.x, z: info.ball.z } : null);
    const hit = !!at && spotOf(at.x, at.z) === target;
    const total = hits + (hit ? 1 : 0);
    setHits(total);
    setLast(at ? { ...at, hit } : null);
    setFlash(hit ? "BANG ON!" : at && spotOf(at.x, at.z) ? "WRONG SPOT" : "MISSED THE GOAL");
    window.setTimeout(() => setFlash(null), 1000);
    const next = kick + 1;
    if (next >= BOSS_KICKS) {
      window.setTimeout(() => setResult({
        won: total > 0,
        gain: bossGain(total),
        line: total === BOSS_KICKS ? "Every one. He's impressed." : total > 0 ? `${total} of ${BOSS_KICKS} where he asked.` : "None where he asked. He walks off.",
      }), 1100);
    } else window.setTimeout(() => { setKick(next); setLast(null); }, 1100);
  }, [hits, kick, target]);

  return (
    <GameShell title="The manager's penalties" who="Boss" current={current} tone="#60a5fa" onBack={kick === 0 && !result ? onCancel : undefined}>
      {/* The manager, beside you, with what he wants. */}
      <div className="mb-2 flex items-start gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={face} alt="" className="h-[48px] w-[48px] shrink-0 rounded-full object-cover object-top ring-2 ring-blue-300/70" />
        <div className="relative min-w-0 flex-1 bg-slate-700 px-3 py-2" style={{ borderRadius: 6 }} data-boss-ask={target}>
          <span aria-hidden className="absolute -left-[6px] top-4 h-3 w-3 rotate-45 bg-slate-700" />
          <div className="text-[11px] font-black uppercase tracking-wider text-blue-200">{boss}</div>
          <div className="text-[15px] font-black text-white">{result ? "That'll do." : lines[kick]}</div>
        </div>
      </div>
      <div className="mb-2 flex items-center justify-between text-[13px] font-black uppercase">
        <span>Kick {Math.min(kick + 1, BOSS_KICKS)} / {BOSS_KICKS}</span>
        <span>{Array.from({ length: BOSS_KICKS }).map((_, i) => <span key={i} className={i < hits ? "text-emerald-300" : "opacity-30"}>◎</span>)}</span>
      </div>
      <TargetBoard target={result ? null : target} last={last} />
      <div className="relative mt-2">
        {!result && <EngineFeature
          key={kick}
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          onBallStep={onBallStep}
          skills={{ power: career.skills.power, technique: career.skills.technique }}
          keeperStrength={0}
          seed={seed + kick}
          penaltyRunup={careerPenaltyRunup(career)}
          scene={{ ...DRILL_SCENE.power, keeper: false, ownFrame: true }}
        />}
        {flash && <div className="pointer-events-none absolute inset-x-0 top-1/3 z-30 text-center text-[26px] font-black uppercase text-white" style={{ textShadow: "0 2px 6px #000" }}>{flash}</div>}
      </div>
      {result && <ResultPanel result={result} who="Boss" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}

/** The goal front-on (7.32 m × 2.44 m), a target on each of the six spots. */
function TargetBoard({ target, last }: { target: Spot | null; last: { x: number; z: number; hit: boolean } | null }) {
  const W = 300, H = Math.round(W * (GOAL_H / GOAL_W)) + 8, pad = 6;
  const sx = (x: number) => pad + ((x - POST_L) / GOAL_W) * (W - pad * 2);
  const sy = (z: number) => H - 4 - (z / GOAL_H) * (H - 8);
  const r = (H - 8) / 4.6;
  return (
    <div className="mx-auto" style={{ maxWidth: W }} data-target-board>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        <rect x={pad} y={4} width={W - pad * 2} height={H - 8} fill="rgba(255,255,255,0.06)" />
        {/* the net */}
        {Array.from({ length: 13 }).map((_, i) => <line key={`v${i}`} x1={pad + (i * (W - pad * 2)) / 12} y1={4} x2={pad + (i * (W - pad * 2)) / 12} y2={H - 4} stroke="rgba(255,255,255,0.08)" />)}
        {Array.from({ length: 5 }).map((_, i) => <line key={`h${i}`} x1={pad} y1={4 + (i * (H - 8)) / 4} x2={W - pad} y2={4 + (i * (H - 8)) / 4} stroke="rgba(255,255,255,0.08)" />)}
        {SPOTS.map((s) => {
          const c = spotCentre(s);
          const on = s === target;
          return (
            <g key={s} opacity={on ? 1 : 0.28} data-target={s}>
              <circle cx={sx(c.x)} cy={sy(c.z)} r={r} fill="#ffffff" />
              <circle cx={sx(c.x)} cy={sy(c.z)} r={r * 0.78} fill="#1d4ed8" />
              <circle cx={sx(c.x)} cy={sy(c.z)} r={r * 0.56} fill="#dc2626" />
              <circle cx={sx(c.x)} cy={sy(c.z)} r={r * 0.32} fill="#facc15" />
              {on && <circle cx={sx(c.x)} cy={sy(c.z)} r={r + 3} fill="none" stroke="#facc15" strokeWidth={2.5} className="animate-pulse" />}
            </g>
          );
        })}
        {/* posts and bar */}
        <path d={`M${pad} ${H} V4 H${W - pad} V${H}`} fill="none" stroke="#ffffff" strokeWidth={4} />
        {last && <circle cx={Math.max(2, Math.min(W - 2, sx(last.x)))} cy={Math.max(2, Math.min(H - 2, sy(last.z)))} r={6} fill={last.hit ? "#34d399" : "#f87171"} stroke="#000" strokeWidth={1.5} />}
      </svg>
      {target && <div className="mt-1 text-center text-[12px] font-black uppercase tracking-wider text-amber-300">Aim: {SPOT_LABEL[target]}</div>}
    </div>
  );
}
