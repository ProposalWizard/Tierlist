"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { CLMatchResult, MatchEvent, CLKnockoutTie } from "@/lib/clSimulator";

interface Props {
  match: CLMatchResult;
  playerTeamName?: string;
  knockoutTie?: CLKnockoutTie;
  legNumber?: 1 | 2;
  onFinished: () => void;
}

function eventIcon(type: MatchEvent["type"]): string {
  switch (type) {
    case "goal": return "⚽";
    case "assist": return "🅰️";
    case "yellow-card": return "🟨";
    case "chance": return "💨";
    case "save": return "🧤";
    case "half-time": return "⏸";
    case "full-time": return "🏁";
    case "extra-time-start": return "⏱";
    case "penalty-shootout": return "🎯";
    default: return "•";
  }
}

function eventLabel(e: MatchEvent, playerTeamName: string, opponentName: string): string {
  const team = e.side === "player" ? playerTeamName : opponentName;
  switch (e.type) {
    case "goal": return e.playerName ? `GOAL! ${e.playerName}${e.detail ? ` (${e.detail})` : ""}` : `GOAL! ${team}`;
    case "assist": return e.playerName ? `Assist: ${e.playerName}` : "Assist";
    case "yellow-card": return e.playerName ? `Yellow card — ${e.playerName}` : `Yellow card — ${team}`;
    case "chance": return e.detail || `${team} chance`;
    case "save": return e.detail || `Great save by ${team}`;
    case "half-time": return "— HALF TIME —";
    case "full-time": return e.detail ? `— FULL TIME (${e.detail}) —` : "— FULL TIME —";
    case "extra-time-start": return "— EXTRA TIME —";
    case "penalty-shootout": return "— PENALTY SHOOTOUT —";
    default: return "";
  }
}

export default function CLMatchViewer({ match, playerTeamName = "KNOWITBALL FC", knockoutTie, legNumber, onFinished }: Props) {
  const [currentMinute, setCurrentMinute] = useState(0);
  const [visibleEvents, setVisibleEvents] = useState<MatchEvent[]>([]);
  const [displayGoalsFor, setDisplayGoalsFor] = useState(0);
  const [displayGoalsAgainst, setDisplayGoalsAgainst] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState(false);
  const eventListRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxMinute = match.extraTime ? (match.penalties ? 121 : 120) : 90;

  const tick = useCallback(() => {
    setCurrentMinute(prev => {
      const next = prev + 1;
      if (next > maxMinute) {
        setFinished(true);
        return prev;
      }
      return next;
    });
  }, [maxMinute]);

  useEffect(() => {
    if (finished || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const ms = Math.max(50, 1000 / speed);
    intervalRef.current = setInterval(tick, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [speed, finished, paused, tick]);

  // Reveal events as minutes pass
  useEffect(() => {
    const newEvents = match.events.filter(e => e.minute <= currentMinute);
    setVisibleEvents(newEvents);

    // Update displayed score
    let gf = 0;
    let ga = 0;
    for (const e of newEvents) {
      if (e.type === "goal") {
        if (e.side === "player") gf++;
        else ga++;
      }
    }
    setDisplayGoalsFor(gf);
    setDisplayGoalsAgainst(ga);
  }, [currentMinute, match.events]);

  // Auto-scroll event list
  useEffect(() => {
    if (eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [visibleEvents.length]);

  const handleSkip = () => {
    setCurrentMinute(maxMinute);
    setFinished(true);
    setDisplayGoalsFor(match.goalsFor);
    setDisplayGoalsAgainst(match.goalsAgainst);
    setVisibleEvents(match.events);
  };

  // Aggregate score for knockout ties
  let aggLine: string | null = null;
  if (knockoutTie && legNumber === 2 && knockoutTie.leg1) {
    const leg1For = knockoutTie.leg1.goalsFor;
    const leg1Against = knockoutTie.leg1.goalsAgainst;
    const totalFor = leg1For + displayGoalsFor;
    const totalAgainst = leg1Against + displayGoalsAgainst;
    aggLine = `Aggregate: ${totalFor} - ${totalAgainst}`;
  }

  const homeName = match.isHome ? playerTeamName : match.opponent;
  const awayName = match.isHome ? match.opponent : playerTeamName;
  const homeScore = match.isHome ? displayGoalsFor : displayGoalsAgainst;
  const awayScore = match.isHome ? displayGoalsAgainst : displayGoalsFor;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Match header */}
      <div className="bg-gray-800 rounded-xl p-6 text-center">
        {knockoutTie && (
          <div className="text-xs text-blue-400 font-semibold mb-2 uppercase tracking-wider">
            {knockoutTie.round}{legNumber ? ` — Leg ${legNumber}` : ""}
          </div>
        )}

        <div className="flex items-center justify-center gap-6">
          <div className="text-right flex-1">
            <div className={`text-lg font-bold ${match.isHome ? "text-blue-400" : "text-white"}`}>{homeName}</div>
          </div>
          <div className="text-4xl font-mono font-bold min-w-[100px] text-center">
            {homeScore} — {awayScore}
          </div>
          <div className="text-left flex-1">
            <div className={`text-lg font-bold ${!match.isHome ? "text-blue-400" : "text-white"}`}>{awayName}</div>
          </div>
        </div>

        {aggLine && (
          <div className="text-sm text-yellow-400 mt-2">{aggLine}</div>
        )}

        {match.penalties && finished && match.penaltyScore && (
          <div className="text-sm text-yellow-400 mt-1">
            Penalties: {match.penaltyScore.player} - {match.penaltyScore.opponent}
          </div>
        )}

        {/* Timer bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>0&apos;</span>
            <span className="font-mono text-white text-sm">{currentMinute}&apos;</span>
            <span>{maxMinute}&apos;</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${(currentMinute / maxMinute) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Speed controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setPaused(!paused)}
          className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${paused ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 hover:bg-gray-600"}`}
        >
          {paused ? "▶ Play" : "⏸ Pause"}
        </button>
        {[1, 3, 5, 10].map(s => (
          <button
            key={s}
            onClick={() => { setSpeed(s); setPaused(false); }}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${speed === s && !paused ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}
          >
            {s}x
          </button>
        ))}
        <button onClick={handleSkip} className="px-3 py-1.5 rounded text-sm font-semibold bg-gray-700 hover:bg-gray-600">
          Skip ⏭
        </button>
      </div>

      {/* Event feed */}
      <div
        ref={eventListRef}
        className="bg-gray-800/50 rounded-xl p-4 h-64 overflow-y-auto space-y-1"
      >
        {visibleEvents.filter(e => e.type !== "assist").map((event, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              event.type === "goal"
                ? event.side === "player" ? "text-green-400 font-semibold" : "text-red-400 font-semibold"
                : event.type === "half-time" || event.type === "full-time" || event.type === "extra-time-start" || event.type === "penalty-shootout"
                ? "text-yellow-400 text-center justify-center"
                : "text-gray-400"
            }`}
          >
            {event.type !== "half-time" && event.type !== "full-time" && event.type !== "extra-time-start" && event.type !== "penalty-shootout" && (
              <span className="text-gray-500 font-mono w-8 shrink-0 text-right">{event.minute}&apos;</span>
            )}
            <span>{eventIcon(event.type)}</span>
            <span>{eventLabel(event, playerTeamName, match.opponent)}</span>
          </div>
        ))}
        {visibleEvents.length === 0 && (
          <div className="text-gray-500 text-center py-8">Match starting...</div>
        )}
      </div>

      {/* Next button when finished */}
      {finished && (
        <div className="text-center space-y-2">
          <div className={`text-xl font-bold ${
            match.goalsFor > match.goalsAgainst ? "text-green-400" :
            match.goalsFor < match.goalsAgainst ? "text-red-400" : "text-yellow-400"
          }`}>
            {match.goalsFor > match.goalsAgainst ? "Victory!" :
             match.goalsFor < match.goalsAgainst ? "Defeat" : "Draw"}
            {match.penalties && match.penaltyScore && (
              <span className="text-sm ml-2">
                ({match.penaltyScore.player > match.penaltyScore.opponent ? "Won" : "Lost"} on penalties)
              </span>
            )}
          </div>

          {/* Goal scorers summary */}
          {match.goalScorers.length > 0 && (
            <div className="text-sm text-gray-400">
              ⚽ {match.goalScorers.map(g => `${g.player} ${g.minute}'`).join(", ")}
            </div>
          )}

          <button
            onClick={onFinished}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}
