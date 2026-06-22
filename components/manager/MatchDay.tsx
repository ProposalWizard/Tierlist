"use client";
import { useState, useEffect, useRef } from "react";
import { generateMatch } from "@/lib/matchEvents";
import type { MatchEvent, MatchResult } from "@/lib/matchEvents";
import { getPositionColor } from "@/components/draft/formations";
import type { DraftPlayer } from "@/app/draft/page";

interface Props {
  squad: DraftPlayer[];
  opponent: { name: string; strength: number };
  isHome: boolean;
  matchweek: number;
  seed: number;
  onComplete: (result: MatchResult, finalSquad: DraftPlayer[]) => void;
}

const TICK_MS = 220;
const MINUTES_PER_TICK = 1.5;

export default function MatchDay({ squad: initialSquad, opponent, isHome, matchweek, seed, onComplete }: Props) {
  const [squad, setSquad] = useState<DraftPlayer[]>(initialSquad);
  const [result] = useState<MatchResult>(() => generateMatch(initialSquad, opponent, isHome, seed));
  const [currentMinute, setCurrentMinute] = useState(0);
  const [shownEvents, setShownEvents] = useState<MatchEvent[]>([]);
  const [phase, setPhase] = useState<"pre" | "first-half" | "halftime" | "second-half" | "fulltime">("pre");
  const [paused, setPaused] = useState(false);
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [pendingSubs, setPendingSubs] = useState<{ off: string; on: string }[]>([]);
  const eventQueueIdx = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const goalsFor = shownEvents.filter(e => e.type === "goal" && e.team === "us").length;
  const goalsAgainst = shownEvents.filter(e => e.type === "goal" && e.team === "them").length;

  // Tick loop — just advances the minute counter
  useEffect(() => {
    if (phase !== "first-half" && phase !== "second-half") return;
    if (paused) return;

    const id = setInterval(() => {
      setCurrentMinute(m => {
        const next = m + MINUTES_PER_TICK;
        if (phase === "first-half" && next >= 45) return 45;
        if (phase === "second-half" && next >= 90) return 90;
        return next;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, [phase, paused]);

  // Phase transitions driven by minute reaching threshold
  useEffect(() => {
    if (phase === "first-half" && currentMinute >= 45) setPhase("halftime");
    if (phase === "second-half" && currentMinute >= 90) setPhase("fulltime");
  }, [currentMinute, phase]);

  // Flush events whose minute has been reached
  useEffect(() => {
    const cap = phase === "halftime" ? 45 : phase === "fulltime" ? 90 : currentMinute;
    const toFlush: MatchEvent[] = [];
    while (
      eventQueueIdx.current < result.events.length &&
      result.events[eventQueueIdx.current].minute <= cap
    ) {
      toFlush.push(result.events[eventQueueIdx.current]);
      eventQueueIdx.current++;
    }
    if (toFlush.length > 0) {
      setShownEvents(prev => [...prev, ...toFlush]);
    }
  }, [currentMinute, phase, result.events]);

  // Auto-scroll commentary
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [shownEvents.length]);

  const handleStart = () => {
    setPhase("first-half");
  };

  const handleStartSecondHalf = () => {
    setShowSubSheet(false);
    // Apply subs
    if (pendingSubs.length > 0) {
      const newSquad = [...squad];
      for (const sub of pendingSubs) {
        const offIdx = newSquad.findIndex(p => p.name === sub.off);
        const onIdx = newSquad.findIndex(p => p.name === sub.on);
        if (offIdx >= 0 && onIdx >= 0) {
          const off = newSquad[offIdx];
          const on = newSquad[onIdx];
          newSquad[offIdx] = { ...on, isSub: false, assignedPosition: off.assignedPosition };
          newSquad[onIdx] = { ...off, isSub: true };
        }
      }
      setSquad(newSquad);
    }
    setPhase("second-half");
  };

  const handleFinish = () => {
    onComplete(result, squad);
  };

  const toggleSub = (offName: string, onName: string) => {
    setPendingSubs(prev => {
      const exists = prev.find(s => s.off === offName && s.on === onName);
      if (exists) return prev.filter(s => !(s.off === offName && s.on === onName));
      // Prevent same player being subbed in/out twice
      const filtered = prev.filter(s => s.off !== offName && s.on !== onName);
      if (filtered.length >= 3) return filtered;
      return [...filtered, { off: offName, on: onName }];
    });
  };

  const starters = squad.filter(p => !p.isSub);
  const subs = squad.filter(p => p.isSub);

  // === PRE-MATCH ===
  if (phase === "pre") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-block px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/5 mb-3">
              <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Matchday {matchweek}</span>
            </div>
            <h1 className="text-3xl font-black text-white">
              {isHome ? "Home" : "Away"} vs {opponent.name}
            </h1>
            <p className="text-white text-sm mt-2">Strength rating · {opponent.strength}</p>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 rounded-2xl p-6 mb-5 border border-gray-800/50">
            <div className="flex items-center justify-around">
              <div className="text-center">
                <div className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase mb-1">You</div>
                <div className="text-3xl font-black text-white">
                  {Math.round(starters.reduce((s, p) => s + p.overall, 0) / Math.max(1, starters.length))}
                </div>
                <div className="text-[10px] text-white mt-0.5">Avg OVR</div>
              </div>
              <div className="text-2xl font-black text-white">VS</div>
              <div className="text-center">
                <div className="text-[10px] font-bold tracking-widest text-red-400 uppercase mb-1">{opponent.name.slice(0, 8)}</div>
                <div className="text-3xl font-black text-white">{opponent.strength}</div>
                <div className="text-[10px] text-white mt-0.5">Rating</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-black py-4 rounded-xl text-base tracking-wide transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99]"
          >
            ▶ Kick Off
          </button>
        </div>
      </div>
    );
  }

  // === MAIN MATCH UI ===
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Score header */}
      <div className="sticky top-0 z-20 bg-gradient-to-b from-black to-gray-950 border-b border-gray-900/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Minute */}
            <div className="text-center min-w-[60px]">
              <div className={`text-2xl font-black ${phase === "fulltime" ? "text-white" : "text-emerald-400"}`}>
                {phase === "halftime" ? "HT" : phase === "fulltime" ? "FT" : `${Math.floor(currentMinute)}'`}
              </div>
              <div className="text-[9px] text-white uppercase tracking-wider">
                {phase === "first-half" ? "1st Half" : phase === "second-half" ? "2nd Half" : phase === "halftime" ? "Halftime" : "Final"}
              </div>
            </div>

            {/* Score */}
            <div className="flex-1 flex items-center justify-center gap-2">
              <div className="text-right flex-1 min-w-0">
                <div className="text-xs font-bold text-emerald-400 truncate">YOU</div>
              </div>
              <div className="text-3xl font-black text-white tabular-nums px-2">{goalsFor}</div>
              <div className="text-2xl font-black text-white">-</div>
              <div className="text-3xl font-black text-white tabular-nums px-2">{goalsAgainst}</div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-xs font-bold text-red-400 truncate">{opponent.name.slice(0, 10)}</div>
              </div>
            </div>

            {/* Pause */}
            {(phase === "first-half" || phase === "second-half") && (
              <button
                onClick={() => setPaused(p => !p)}
                className="w-10 h-10 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 flex items-center justify-center text-white text-sm"
                aria-label={paused ? "Resume" : "Pause"}
              >
                {paused ? "▶" : "⏸"}
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-0.5 bg-gray-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-200"
              style={{ width: `${(currentMinute / 90) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Halftime overlay */}
      {phase === "halftime" && !showSubSheet && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-gradient-to-br from-amber-900/30 to-amber-950/20 border border-amber-700/30 rounded-2xl p-6 text-center mb-4">
              <div className="text-[10px] font-bold tracking-widest text-amber-400 uppercase mb-3">Halftime</div>
              <div className="text-5xl font-black text-white mb-2 tabular-nums">{goalsFor} - {goalsAgainst}</div>
              <p className="text-sm text-white">
                {goalsFor > goalsAgainst ? "You're winning. Hold the lead." :
                 goalsFor < goalsAgainst ? "Down at the break. Time to change it up?" :
                 "All level. Make it count in the second half."}
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setShowSubSheet(true)}
                className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white font-bold py-3 rounded-xl transition-all"
              >
                🔁 Make Substitutions {pendingSubs.length > 0 && `(${pendingSubs.length})`}
              </button>
              <button
                onClick={handleStartSecondHalf}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-black font-black py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                ▶ Start Second Half
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub sheet */}
      {showSubSheet && phase === "halftime" && (
        <div className="flex-1 overflow-auto p-4">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Halftime Subs</h2>
              <button
                onClick={() => setShowSubSheet(false)}
                className="text-xs text-white hover:text-gray-300"
              >
                ✕ Cancel
              </button>
            </div>
            <p className="text-xs text-white mb-4">
              Tap a starter, then a sub to swap them. Up to 3 changes.
              <span className="text-amber-400"> Fresh subs get a chance-creation bonus.</span>
            </p>

            <div className="space-y-4">
              <div>
                <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Currently On</h3>
                <div className="space-y-1.5">
                  {starters.map(p => {
                    const beingSubbed = pendingSubs.find(s => s.off === p.name);
                    return (
                      <div
                        key={p.name}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                          beingSubbed ? "border-red-500/40 bg-red-950/20 opacity-60" : "border-gray-800 bg-gray-900"
                        }`}
                      >
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-8 text-center`}>
                          {p.assignedPosition}
                        </span>
                        <span className="flex-1 text-sm text-white truncate">{p.name}</span>
                        <span className="text-xs text-white">{p.overall}</span>
                        {beingSubbed && <span className="text-[10px] text-red-400 font-bold">→ {beingSubbed.on.split(" ").slice(-1)[0]}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Bench</h3>
                <div className="space-y-1.5">
                  {subs.map(p => {
                    const beingBroughtOn = pendingSubs.find(s => s.on === p.name);
                    return (
                      <div key={p.name} className={`bg-gray-900 rounded-lg border ${beingBroughtOn ? "border-emerald-500/40 bg-emerald-950/20" : "border-gray-800"} p-2`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-700 text-white">SUB</span>
                          <span className="flex-1 text-sm text-white truncate">{p.name}</span>
                          <span className="text-xs text-white">{p.overall}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {starters
                            .filter(s => !pendingSubs.find(ps => ps.off === s.name && ps.on !== p.name))
                            .slice(0, 6)
                            .map(s => {
                              const active = pendingSubs.find(ps => ps.off === s.name && ps.on === p.name);
                              return (
                                <button
                                  key={s.name}
                                  onClick={() => toggleSub(s.name, p.name)}
                                  className={`text-[10px] py-1.5 rounded border transition-all ${
                                    active
                                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold"
                                      : "border-gray-800 bg-gray-950 text-white hover:border-gray-700"
                                  }`}
                                >
                                  ⇄ {s.name.split(" ").slice(-1)[0]}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleStartSecondHalf}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-black font-black py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                Confirm{pendingSubs.length > 0 ? ` ${pendingSubs.length} Sub${pendingSubs.length > 1 ? "s" : ""}` : ""} → Start 2nd Half
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fulltime overlay */}
      {phase === "fulltime" && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
              <div className={`inline-block px-4 py-1.5 rounded-full border mb-4 ${
                goalsFor > goalsAgainst ? "border-emerald-500/40 bg-emerald-500/10" :
                goalsFor < goalsAgainst ? "border-red-500/40 bg-red-500/10" :
                "border-gray-500/40 bg-gray-500/10"
              }`}>
                <span className={`text-xs font-black tracking-widest uppercase ${
                  goalsFor > goalsAgainst ? "text-emerald-400" :
                  goalsFor < goalsAgainst ? "text-red-400" : "text-white"
                }`}>
                  {goalsFor > goalsAgainst ? "Victory" : goalsFor < goalsAgainst ? "Defeat" : "Draw"}
                </span>
              </div>
              <div className="text-7xl font-black text-white mb-2 tabular-nums">{goalsFor} - {goalsAgainst}</div>
              <p className="text-white text-sm mb-6">{isHome ? "Home" : "Away"} · vs {opponent.name}</p>

              {result.scorers.length > 0 && (
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6">
                  <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Scorers</h3>
                  <div className="space-y-1">
                    {result.scorers.map(s => (
                      <div key={s.name} className="text-sm text-white flex items-center justify-between">
                        <span>⚽ {s.name}</span>
                        {s.goals > 1 && <span className="text-amber-400 font-bold">×{s.goals}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleFinish}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black py-4 rounded-xl text-base tracking-wide transition-all shadow-lg shadow-amber-500/20"
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commentary feed — only during live play */}
      {(phase === "first-half" || phase === "second-half") && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-4 pb-6">
          <div className="space-y-2 pt-3">
            {shownEvents.length === 0 && (
              <div className="text-center text-white text-xs py-12">Match underway...</div>
            )}
            {shownEvents.map((e, i) => {
              const isGoal = e.type === "goal";
              const isOurGoal = isGoal && e.team === "us";
              const isTheirGoal = isGoal && e.team === "them";
              return (
                <div
                  key={i}
                  className={`flex gap-3 p-2.5 rounded-lg border animate-in fade-in slide-in-from-bottom-2 ${
                    isOurGoal
                      ? "bg-emerald-950/30 border-emerald-700/40"
                      : isTheirGoal
                        ? "bg-red-950/30 border-red-700/40"
                        : "bg-gray-900/50 border-gray-800/50"
                  }`}
                >
                  <div className="shrink-0 w-10 text-center">
                    <div className={`text-xs font-black ${isGoal ? "text-white" : "text-white"}`}>{e.minute}'</div>
                    {isGoal && <div className="text-[9px] font-bold text-amber-400 tabular-nums">{e.goalsFor}-{e.goalsAgainst}</div>}
                  </div>
                  <div className="flex-1 text-sm text-white">{e.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
