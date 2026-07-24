"use client";
import { useEffect, useRef, useState } from "react";
import type { CareerState, MatchStats, Fixture } from "@/lib/star/types";
import { buildMatchScript, finaliseMatch, type PlayableEvent } from "@/lib/star/matchEngine";
import { simulateKick, type KickResult } from "@/lib/star/kickPhysics";
import { mulberry32 } from "@/lib/star/season";
import ContactBall from "./ContactBall";

interface Props {
  career: CareerState;
  fixture: Fixture;
  oppStrength: number;
  onComplete: (stats: MatchStats) => void;
}

interface RunningState {
  minute: number;
  userScore: number;
  oppScore: number;
  chances: number;
  goals: number;
  assists: number;
  passes: number;
  commentary: string[];
  script: ReturnType<typeof buildMatchScript>;
  scriptIndex: number;
  currentEvent: PlayableEvent | null;
  resultText: string;
  paused: boolean;
}

type Phase = "aim" | "contact" | "flight" | "flight2" | "result";

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function colorForResult(result: KickResult): "goal" | "miss" | "neutral" {
  if (result.secondary) return result.secondary.outcome === "goal" ? "goal" : "miss";
  if (result.goal) return "goal";
  if (result.outcomeKind === "teammate" || result.outcomeKind === "offside") return "neutral";
  return "miss";
}

export default function Match({ career, fixture, oppStrength, onComplete }: Props) {
  const [state, setState] = useState<RunningState>(() => {
    const script = buildMatchScript(career, fixture, oppStrength);
    return {
      minute: 0,
      userScore: 0,
      oppScore: 0,
      chances: 0,
      goals: 0,
      assists: 0,
      passes: 0,
      commentary: [`Kick off! ${fixture.home ? career.player.club : fixture.opponent} v ${fixture.home ? fixture.opponent : career.player.club}`],
      script,
      scriptIndex: 0,
      currentEvent: null,
      resultText: "",
      paused: false,
    };
  });
  const [fullTime, setFullTime] = useState(false);

  // --- Interaction state ---
  const [phase, setPhase] = useState<Phase>("aim");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  const [ballScreen, setBallScreen] = useState<{ x: number; y: number; h: number } | null>(null);
  const [gkX, setGkX] = useState<number | null>(null);
  const [resultColor, setResultColor] = useState<"goal" | "miss" | "neutral">("neutral");

  const rngRef = useRef<() => number>(mulberry32(state.script.seed));
  const pitchRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const homeTeam = fixture.home ? career.player.club : fixture.opponent;
  const awayTeam = fixture.home ? fixture.opponent : career.player.club;
  const homeScore = fixture.home ? state.userScore : state.oppScore;
  const awayScore = fixture.home ? state.oppScore : state.userScore;

  // --- Advance the match script ---
  useEffect(() => {
    if (state.paused || state.currentEvent || fullTime) return;
    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.scriptIndex >= prev.script.events.length) {
          return { ...prev, minute: 90 };
        }
        const next = prev.script.events[prev.scriptIndex];
        if ("commentary" in next) {
          return {
            ...prev,
            minute: Math.max(prev.minute, next.minute),
            commentary: [next.commentary, ...prev.commentary].slice(0, 6),
            scriptIndex: prev.scriptIndex + 1,
          };
        }
        // Opponent chance to score in the gap
        const oppGoalChance = 0.07 + (oppStrength - 65) / 500;
        const oppScored = rngRef.current() < oppGoalChance;
        const oppText = oppScored ? [`${fixture.home ? fixture.opponent : career.player.club} score! ${next.minute}'`] : [];
        return {
          ...prev,
          minute: Math.max(prev.minute, next.minute),
          currentEvent: next,
          chances: prev.chances + 1,
          scriptIndex: prev.scriptIndex + 1,
          oppScore: prev.oppScore + (oppScored ? 1 : 0),
          commentary: [...oppText, ...prev.commentary].slice(0, 6),
          paused: true,
        };
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [state, oppStrength, fixture, career.player.club, fullTime]);

  useEffect(() => {
    if (state.scriptIndex >= state.script.events.length && !state.currentEvent && !fullTime) {
      setFullTime(true);
    }
  }, [state.scriptIndex, state.script.events.length, state.currentEvent, fullTime]);

  // --- Reset interaction when a new event begins ---
  useEffect(() => {
    if (state.currentEvent) {
      setPhase("aim");
      setAim(null);
      setDrag(null);
      setBallScreen(null);
      setGkX(state.currentEvent.goalkeeper.x);
      draggingRef.current = false;
    }
  }, [state.currentEvent]);

  // --- Cleanup any running animation on unmount ---
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  // --- Convert a pointer event to pitch coordinates (0-100) ---
  const pitchPoint = (e: React.PointerEvent): { x: number; y: number } | null => {
    if (!pitchRef.current) return null;
    const rect = pitchRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const onPitchPointerDown = (e: React.PointerEvent) => {
    if (!state.currentEvent || phase !== "aim") return;
    const p = pitchPoint(e);
    if (!p) return;
    const ball = state.currentEvent.ball;
    if (Math.hypot(p.x - ball.x, p.y - ball.y) > 14) return; // must grab near the ball
    draggingRef.current = true;
    try {
      pitchRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setDrag(p);
  };

  const onPitchPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const p = pitchPoint(e);
    if (p) setDrag(p);
  };

  const onPitchPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current || !state.currentEvent) return;
    draggingRef.current = false;
    try {
      pitchRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const d = drag;
    setDrag(null);
    if (!d) return;
    const ball = state.currentEvent.ball;
    const dragDist = Math.hypot(d.x - ball.x, d.y - ball.y);
    const power = clamp(dragDist / 35, 0, 1);
    if (power < 0.12) return; // too weak — stay in aim
    const dx = ball.x - d.x;
    const dy = ball.y - d.y;
    const len = Math.hypot(dx, dy) || 1;
    setAim({ dir: { x: dx / len, y: dy / len }, power });
    setPhase("contact");
  };

  // Duration of a flight path, based on its geometric length.
  const flightDuration = (path: { x: number; y: number; h: number }[]): number => {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return clamp(500 + length * 14, 700, 1600);
  };

  // Purely COSMETIC animation. It never drives game progression — the outcome
  // is scheduled by explicit timers in handleContact — so even if a frame throws
  // or the tab is backgrounded, the match can never freeze.
  const runFlight = (
    path: { x: number; y: number; h: number }[],
    savePoint: { x: number; y: number } | null,
    gkStartX: number,
    duration: number,
  ) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (!path || path.length === 0) return;
    const start = performance.now();
    const step = (now: number) => {
      try {
        const t = Math.min(1, (now - start) / duration);
        const maxIdx = path.length - 1;
        const fpos = t * maxIdx;
        const idx = Math.max(0, Math.min(maxIdx, Math.floor(fpos)));
        const frac = fpos - idx;
        const a = path[idx];
        const b = path[Math.min(maxIdx, idx + 1)];
        if (a && b) {
          setBallScreen({
            x: a.x + (b.x - a.x) * frac,
            y: a.y + (b.y - a.y) * frac,
            h: a.h + (b.h - a.h) * frac,
          });
        }
        if (savePoint) {
          const saveStart = 1 - 200 / duration;
          if (t >= saveStart) {
            const st = clamp((t - saveStart) / (1 - saveStart), 0, 1);
            setGkX(gkStartX + (savePoint.x - gkStartX) * st);
          }
        }
        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      } catch {
        // Never let a cosmetic frame stall the match — the outcome timer handles progression.
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const handleContact = (contact: { cx: number; cy: number }) => {
    const evt = state.currentEvent;
    if (!evt || !aim) return;
    const result = simulateKick(
      evt,
      { dir: aim.dir, power: aim.power, contact },
      career.skills,
      career.relationships.team,
      oppStrength,
      rngRef.current,
    );
    setPhase("flight");

    const dur1 = flightDuration(result.path);
    runFlight(result.path, result.savePoint ?? null, evt.goalkeeper.x, dur1);

    if (result.secondary) {
      const secondary = result.secondary;
      const dur2 = flightDuration(secondary.path);
      // After the primary flight + a 500ms beat, play the teammate's shot.
      window.setTimeout(() => {
        setPhase("flight2");
        runFlight(secondary.path, null, evt.goalkeeper.x, dur2);
      }, dur1 + 500);
      // Outcome is revealed once the secondary finishes — driven by a timer, not the rAF.
      window.setTimeout(() => showOutcome(result), dur1 + 500 + dur2);
    } else {
      window.setTimeout(() => showOutcome(result), dur1);
    }
  };

  const showOutcome = (result: KickResult) => {
    setPhase("result");
    setResultColor(colorForResult(result));
    setState((prev) => {
      const primaryLine = `${prev.minute}': ${result.narrative}`;
      const newComm = result.secondary
        ? [`${prev.minute}': ${result.secondary.narrative}`, primaryLine, ...prev.commentary]
        : [primaryLine, ...prev.commentary];
      return {
        ...prev,
        goals: prev.goals + (result.goal ? 1 : 0),
        assists: prev.assists + (result.assist ? 1 : 0),
        passes: prev.passes + (result.passCompleted ? 1 : 0),
        userScore: prev.userScore + (result.goal || result.assist ? 1 : 0),
        resultText: result.secondary ? result.secondary.narrative : result.narrative,
        commentary: newComm.slice(0, 6),
      };
    });
    setTimeout(() => {
      setBallScreen(null);
      setAim(null);
      setState((prev) => ({ ...prev, currentEvent: null, resultText: "", paused: false }));
    }, 1500);
  };

  const finishMatch = () => {
    const stats = finaliseMatch(
      state.chances, state.goals, state.assists, state.passes, 90,
      state.userScore, state.oppScore, career,
    );
    onComplete(stats);
  };

  const evt = state.currentEvent;
  const flying = phase === "flight" || phase === "flight2";

  // Aim overlay geometry (viewBox 0 0 100 133, y scaled by 1.33)
  let aimLine: { bx: number; by: number; ex: number; ey: number; arrow: string } | null = null;
  let dragPower = 0;
  if (evt && phase === "aim" && drag) {
    const ball = evt.ball;
    const dist = Math.hypot(drag.x - ball.x, drag.y - ball.y);
    dragPower = clamp(dist / 35, 0, 1);
    const dx = ball.x - drag.x;
    const dy = ball.y - drag.y;
    const len = Math.hypot(dx, dy) || 1;
    const ndx = dx / len;
    const ndy = dy / len;
    const lineLen = dragPower * 30;
    const endX = ball.x + ndx * lineLen;
    const endY = ball.y + ndy * lineLen;
    const bx = ball.x;
    const by = ball.y * 1.33;
    const ex = endX;
    const ey = endY * 1.33;
    // Arrowhead in viewBox space
    const vdx = ex - bx;
    const vdy = ey - by;
    const vlen = Math.hypot(vdx, vdy) || 1;
    const uxx = vdx / vlen;
    const uyy = vdy / vlen;
    const px = -uyy;
    const py = uxx;
    const baseX = ex - uxx * 3;
    const baseY = ey - uyy * 3;
    const arrow = `${ex},${ey} ${baseX + px * 1.6},${baseY + py * 1.6} ${baseX - px * 1.6},${baseY - py * 1.6}`;
    aimLine = { bx, by, ex, ey, arrow };
  }

  return (
    <div className="min-h-screen bg-emerald-900 text-white flex flex-col items-center py-2 px-2">
      <div className="w-full max-w-sm">
        {/* Scoreboard */}
        <div className="flex items-center justify-between mb-2 gap-1">
          <div className="flex-1 bg-red-600 border border-red-500 rounded-l-lg px-2 py-1.5 text-white font-black text-xs truncate flex items-center gap-1">
            <PlayIcon />
            {homeTeam.slice(0, 6).toUpperCase()}
          </div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow">{homeScore}</div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow">{awayScore}</div>
          <div className="flex-1 bg-yellow-500 border border-yellow-400 rounded-r-lg px-2 py-1.5 text-white font-black text-xs truncate text-right">
            {awayTeam.slice(0, 6).toUpperCase()}
          </div>
        </div>

        {/* Pitch */}
        <div
          ref={pitchRef}
          onPointerDown={onPitchPointerDown}
          onPointerMove={onPitchPointerMove}
          onPointerUp={onPitchPointerUp}
          onPointerCancel={onPitchPointerUp}
          className={`relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-800 shadow-2xl select-none ${
            evt && phase === "aim" ? "cursor-grab" : "cursor-default"
          }`}
          style={{
            touchAction: "none",
            background: "repeating-linear-gradient(0deg, #16a34a 0px, #16a34a 32px, #15803d 32px, #15803d 64px)",
          }}
        >
          <PitchLines offsideLine={evt?.offsideLine} />

          {evt && (
            <>
              {/* Goal frame at top */}
              <div className="absolute pointer-events-none" style={{ left: `${evt.goal.x1}%`, top: 0, width: `${evt.goal.x2 - evt.goal.x1}%`, height: "5%" }}>
                <div className="w-full h-full border-2 border-white bg-white/10 border-b-0" />
              </div>
              {/* Goalkeeper */}
              <Dot x={gkX ?? evt.goalkeeper.x} y={evt.goalkeeper.y} color="bg-yellow-400" size="lg" label="GK" />
              {/* Defenders */}
              {evt.defenders.map((d, i) => (
                <Dot key={`d${i}`} x={d.x} y={d.y} color="bg-red-600" />
              ))}
              {/* Teammates */}
              {evt.teammates.map((t, i) => (
                <Dot key={t.id} x={t.x} y={t.y} color="bg-blue-400" label={`${i + 1}`} />
              ))}
              {/* Player (you) */}
              <Dot x={evt.player.x} y={evt.player.y} color="bg-emerald-500 ring-2 ring-white" label="YOU" />

              {/* Static ball (aim phase) */}
              {phase === "aim" && (
                <div
                  className="absolute w-3.5 h-3.5 rounded-full bg-white border border-black -translate-x-1/2 -translate-y-1/2 shadow z-10"
                  style={{ left: `${evt.ball.x}%`, top: `${evt.ball.y}%` }}
                />
              )}

              {/* Slingshot aim overlay */}
              {aimLine && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 133" preserveAspectRatio="none">
                  <line
                    x1={aimLine.bx}
                    y1={aimLine.by}
                    x2={aimLine.ex}
                    y2={aimLine.ey}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth="0.7"
                    strokeDasharray="2 1.4"
                  />
                  <polygon points={aimLine.arrow} fill="rgba(255,255,255,0.95)" />
                </svg>
              )}

              {/* Power meter (left edge) */}
              {phase === "aim" && drag && (
                <div className="absolute left-1 top-2 bottom-2 w-3 z-30 pointer-events-none flex flex-col justify-end">
                  <div className="relative flex-1 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-full"
                      style={{
                        height: `${Math.round(dragPower * 100)}%`,
                        background: "linear-gradient(to top, #22c55e, #eab308, #ef4444)",
                      }}
                    />
                  </div>
                  <div className="text-[8px] font-black text-white text-center mt-0.5 drop-shadow">
                    {Math.round(dragPower * 100)}%
                  </div>
                </div>
              )}

              {/* Prompt (aim, before dragging) */}
              {phase === "aim" && !drag && !state.resultText && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="bg-black/70 border-2 border-yellow-400 rounded-lg px-6 py-3">
                    <div className="text-2xl font-black text-yellow-300 tracking-widest text-center">{evt.prompt}</div>
                    <div className="text-[10px] text-yellow-200 text-center mt-0.5">Drag from the ball to kick</div>
                  </div>
                </div>
              )}

              {/* Animated ball in flight */}
              {flying && ballScreen && (
                <>
                  <div
                    className="absolute rounded-full bg-black pointer-events-none z-10"
                    style={{
                      left: `${ballScreen.x}%`,
                      top: `${ballScreen.y}%`,
                      width: "11px",
                      height: "5px",
                      opacity: 0.35,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                  <div
                    className="absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-black shadow-lg pointer-events-none z-20"
                    style={{
                      left: `${ballScreen.x}%`,
                      top: `${ballScreen.y - ballScreen.h * 0.32}%`,
                      transform: `translate(-50%, -50%) scale(${1 + ballScreen.h / 12})`,
                    }}
                  />
                </>
              )}

              {/* Contact-point overlay (phase 2) */}
              {phase === "contact" && aim && (
                <ContactBall
                  power={aim.power}
                  onContact={handleContact}
                  onCancel={() => {
                    setPhase("aim");
                    setAim(null);
                  }}
                />
              )}
            </>
          )}

          {/* Result text */}
          {state.resultText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
              <div
                className={`text-3xl font-black tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] px-4 py-2 rounded-lg text-center ${
                  resultColor === "goal"
                    ? state.resultText.includes("ASSIST")
                      ? "text-yellow-300 bg-black/50"
                      : "text-emerald-300 bg-black/50"
                    : resultColor === "neutral"
                    ? "text-yellow-200 bg-black/50"
                    : "text-red-400 bg-black/50"
                }`}
              >
                {state.resultText}
              </div>
            </div>
          )}

          {!evt && !fullTime && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 rounded-full px-4 py-1 text-white font-black text-lg">
                {state.minute}&apos;
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="bg-red-600 py-1 px-2 text-white text-[10px] font-black uppercase tracking-widest">Commentary</div>
          <div className="p-2 space-y-1 min-h-[100px] max-h-[140px] overflow-y-auto">
            {state.commentary.map((c, i) => (
              <div key={i} className={`text-xs ${i === 0 ? "text-white font-black" : "text-gray-400"} leading-tight`}>
                {c}
              </div>
            ))}
          </div>
        </div>

        {/* Hint bar */}
        {evt && phase === "aim" && (
          <div className="mt-2 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-[10px] text-gray-300 text-center">
            <span className="text-yellow-300">💡</span> Drag back from the ball to aim and power up — release, then pick where on the ball to strike.
          </div>
        )}

        {fullTime && (
          <button
            onClick={finishMatch}
            className="mt-2 w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-black transition"
          >
            Full Time — View Stats →
          </button>
        )}
      </div>
    </div>
  );
}

function PitchLines({ offsideLine }: { offsideLine?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 133" preserveAspectRatio="none">
      <line x1="0" y1="66" x2="100" y2="66" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
      <circle cx="50" cy="66" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" fill="none" />
      <rect x="30" y="0" width="40" height="18" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" fill="none" />
      <rect x="40" y="0" width="20" height="7" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" fill="none" />
      <rect x="30" y="115" width="40" height="18" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" fill="none" />
      <rect x="40" y="126" width="20" height="7" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" fill="none" />
      {offsideLine !== undefined && (
        <line x1="0" y1={offsideLine * 1.33} x2="100" y2={offsideLine * 1.33} stroke="rgba(255,220,0,0.6)" strokeWidth="0.3" strokeDasharray="1 1" />
      )}
    </svg>
  );
}

function Dot({ x, y, color, label, size = "md", ring }: { x: number; y: number; color: string; label?: string; size?: "md" | "lg"; ring?: boolean }) {
  const sz = size === "lg" ? "w-6 h-6" : "w-5 h-5";
  return (
    <div
      className={`absolute ${sz} rounded-full ${color} shadow-lg -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none border-2 border-black/40 ${ring ? "ring-2 ring-white/60 ring-offset-1 ring-offset-transparent" : ""}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {label && <span className="text-[8px] font-black text-white">{label}</span>}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-white">
      <path d="M0 0 L10 5 L0 10 Z" />
    </svg>
  );
}
