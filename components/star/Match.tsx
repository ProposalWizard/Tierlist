"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { CareerState, MatchStats, Fixture } from "@/lib/star/types";
import { buildMatchScript, resolveEvent, finaliseMatch, type PlayableEvent } from "@/lib/star/matchEngine";
import { mulberry32 } from "@/lib/star/season";

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
  ballAnim: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  resultText: string;
  paused: boolean;
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
      ballAnim: null,
      resultText: "",
      paused: false,
    };
  });
  const [fullTime, setFullTime] = useState(false);
  const rngRef = useRef<() => number>(mulberry32(state.script.seed));
  const pitchRef = useRef<HTMLDivElement>(null);

  const homeTeam = fixture.home ? career.player.club : fixture.opponent;
  const awayTeam = fixture.home ? fixture.opponent : career.player.club;
  const homeScore = fixture.home ? state.userScore : state.oppScore;
  const awayScore = fixture.home ? state.oppScore : state.userScore;

  // Advance script tick
  useEffect(() => {
    if (state.paused || state.currentEvent || fullTime) return;
    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.scriptIndex >= prev.script.events.length) {
          // Final whistle
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
        // Chance for opponent to score in the gap
        const oppGoalChance = 0.08 + (oppStrength - 65) / 400;
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

  // Trigger full time
  useEffect(() => {
    if (state.scriptIndex >= state.script.events.length && !state.currentEvent && !fullTime) {
      setFullTime(true);
    }
  }, [state.scriptIndex, state.script.events.length, state.currentEvent, fullTime]);

  const handleEventTap = useCallback((tapX: number, tapY: number) => {
    if (!state.currentEvent || state.ballAnim) return;
    const evt = state.currentEvent;
    setState((prev) => ({ ...prev, ballAnim: { from: evt.ball, to: { x: tapX, y: tapY } } }));
    setTimeout(() => {
      const result = resolveEvent(evt, { x: tapX, y: tapY }, 0.8, career.skills, rngRef.current);
      setState((prev) => {
        const newPasses = result.success && (evt.kind === "PASS" || evt.kind === "CROSS" || evt.kind === "THROUGH_BALL")
          ? prev.passes + 1 : prev.passes;
        const newGoals = result.goal ? prev.goals + 1 : prev.goals;
        const newAssists = result.assist ? prev.assists + 1 : prev.assists;
        return {
          ...prev,
          goals: newGoals,
          assists: newAssists,
          passes: newPasses,
          userScore: result.goal ? prev.userScore + 1 : prev.userScore,
          resultText: result.narrative,
          commentary: [`${prev.minute}': ${result.narrative}`, ...prev.commentary].slice(0, 6),
        };
      });
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          currentEvent: null,
          ballAnim: null,
          resultText: "",
          paused: false,
        }));
      }, 1500);
    }, 550);
  }, [state.currentEvent, state.ballAnim, career.skills]);

  const handlePitchClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (!pitchRef.current || !state.currentEvent) return;
    const rect = pitchRef.current.getBoundingClientRect();
    let cx = 0, cy = 0;
    if ("touches" in e) {
      cx = e.changedTouches[0].clientX;
      cy = e.changedTouches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    const x = ((cx - rect.left) / rect.width) * 100;
    const y = ((cy - rect.top) / rect.height) * 100;
    handleEventTap(x, y);
  };

  const finishMatch = () => {
    const stats = finaliseMatch(
      state.chances, state.goals, state.assists, state.passes, 90,
      state.userScore, state.oppScore, career,
    );
    onComplete(stats);
  };

  return (
    <div className="min-h-screen bg-emerald-900 text-white flex flex-col items-center py-2 px-2">
      <div className="w-full max-w-sm">
        {/* Scoreboard */}
        <div className="flex items-center justify-between mb-2 gap-1">
          <div className="flex-1 bg-red-600 border border-red-500 rounded-l-lg px-2 py-1.5 text-white font-black text-xs truncate flex items-center gap-1">
            <PlayIcon />
            {homeTeam.slice(0, 6).toUpperCase()}
          </div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow">
            {homeScore}
          </div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow">
            {awayScore}
          </div>
          <div className="flex-1 bg-yellow-500 border border-yellow-400 rounded-r-lg px-2 py-1.5 text-white font-black text-xs truncate text-right">
            {awayTeam.slice(0, 6).toUpperCase()}
          </div>
        </div>

        {/* Pitch */}
        <div
          ref={pitchRef}
          onClick={handlePitchClick}
          onTouchEnd={handlePitchClick}
          className={`relative w-full aspect-[3/4] rounded-xl overflow-hidden border-2 border-emerald-800 shadow-2xl select-none ${
            state.currentEvent ? "cursor-crosshair" : "cursor-default"
          }`}
          style={{
            background: "repeating-linear-gradient(0deg, #16a34a 0px, #16a34a 40px, #15803d 40px, #15803d 80px)",
          }}
        >
          {/* Pitch markings */}
          <PitchLines />

          {/* Current event scene */}
          {state.currentEvent && (
            <>
              {/* Goal frame at top */}
              <div className="absolute" style={{ left: `${state.currentEvent.goal.x1}%`, top: 0, width: `${state.currentEvent.goal.x2 - state.currentEvent.goal.x1}%`, height: "4%" }}>
                <div className="w-full h-full border-2 border-white bg-white/10 border-b-0" />
              </div>
              {/* Goalkeeper */}
              <Dot x={state.currentEvent.goalkeeper.x} y={state.currentEvent.goalkeeper.y} color="bg-yellow-400" size="lg" label="GK" />
              {/* Defenders (red) */}
              {state.currentEvent.defenders.map((d, i) => (
                <Dot key={`d${i}`} x={d.x} y={d.y} color="bg-red-600" />
              ))}
              {/* Teammates */}
              {state.currentEvent.teammates.map((t, i) => (
                <Dot key={t.id} x={t.x} y={t.y} color="bg-yellow-400" label={`${i + 1}`} />
              ))}
              {/* Player (you) */}
              <Dot x={state.currentEvent.player.x} y={state.currentEvent.player.y} color="bg-blue-500 ring-2 ring-white" label="YOU" />
              {/* Ball */}
              {!state.ballAnim && (
                <div
                  className="absolute w-3 h-3 rounded-full bg-white border border-black -translate-x-1/2 -translate-y-1/2 shadow"
                  style={{ left: `${state.currentEvent.ball.x}%`, top: `${state.currentEvent.ball.y + 3}%` }}
                />
              )}
              {/* Prompt */}
              {!state.ballAnim && !state.resultText && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/70 border-2 border-yellow-400 rounded-lg px-6 py-3 animate-pulse">
                    <div className="text-2xl font-black text-yellow-300 tracking-widest">{state.currentEvent.prompt}</div>
                    <div className="text-[10px] text-yellow-200 text-center mt-0.5">TAP where to aim</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Ball animation */}
          {state.ballAnim && (
            <div
              className="absolute w-4 h-4 rounded-full bg-white border-2 border-black shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-500 ease-out"
              style={{ left: `${state.ballAnim.to.x}%`, top: `${state.ballAnim.to.y}%` }}
            />
          )}

          {/* Result text overlay */}
          {state.resultText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`text-3xl font-black tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
                state.resultText.includes("GOAL") ? "text-emerald-300" :
                state.resultText.includes("ASSIST") ? "text-yellow-300" :
                "text-red-400"
              }`}>
                {state.resultText}
              </div>
            </div>
          )}

          {/* Between-events: minute display */}
          {!state.currentEvent && !fullTime && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/50 rounded-full px-4 py-1 text-white font-black text-lg">
                {state.minute}&apos;
              </div>
            </div>
          )}
        </div>

        {/* Commentary feed */}
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

        {/* Full time button */}
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

function PitchLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 133" preserveAspectRatio="none">
      {/* Halfway */}
      <line x1="0" y1="66" x2="100" y2="66" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
      <circle cx="50" cy="66" r="10" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" fill="none" />
      {/* Top box */}
      <rect x="30" y="0" width="40" height="18" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" fill="none" />
      <rect x="40" y="0" width="20" height="7" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" fill="none" />
      {/* Bottom box */}
      <rect x="30" y="115" width="40" height="18" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" fill="none" />
      <rect x="40" y="126" width="20" height="7" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" fill="none" />
    </svg>
  );
}

function Dot({ x, y, color, label, size = "md" }: { x: number; y: number; color: string; label?: string; size?: "md" | "lg" }) {
  const sz = size === "lg" ? "w-6 h-6" : "w-5 h-5";
  return (
    <div
      className={`absolute ${sz} rounded-full ${color} shadow-lg -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none border-2 border-black/40`}
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
