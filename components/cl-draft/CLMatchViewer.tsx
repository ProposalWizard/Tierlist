"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { CLMatchResult, MatchEvent, CLKnockoutTie } from "@/lib/clSimulator";

interface MatchDecision {
  minute: number;
  type: "tactical" | "substitution";
  prompt: string;
  options: { label: string; description: string; effect: "attacking" | "defensive" | "none" }[];
  resolved: boolean;
}

interface Props {
  match: CLMatchResult;
  playerTeamName?: string;
  knockoutTie?: CLKnockoutTie;
  legNumber?: 1 | 2;
  squadPlayers?: { name: string; assignedPosition: string; isSub?: boolean }[];
  onFinished: (modifiedMatch: CLMatchResult) => void;
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

function generateDecisions(match: CLMatchResult, squad?: { name: string; assignedPosition: string; isSub?: boolean }[]): MatchDecision[] {
  const decisions: MatchDecision[] = [];

  // Tactical decision around minute 60-70
  const tacticalMinute = 60 + Math.floor(Math.random() * 10);
  decisions.push({
    minute: tacticalMinute,
    type: "tactical",
    prompt: "Tactical Change",
    options: [
      { label: "Go Attacking", description: "Push forward — more likely to score but also more likely to concede", effect: "attacking" },
      { label: "Go Defensive", description: "Sit back — less likely to concede but harder to score", effect: "defensive" },
      { label: "No Change", description: "Keep current approach", effect: "none" },
    ],
    resolved: false,
  });

  // Substitution around minute 55-65
  if (squad && squad.some(p => p.isSub)) {
    const subMinute = 55 + Math.floor(Math.random() * 10);
    decisions.push({
      minute: subMinute,
      type: "substitution",
      prompt: "Make a Substitution?",
      options: [
        { label: "Fresh Legs (Attacking)", description: "Bring on an attacker to change the game", effect: "attacking" },
        { label: "Shore Up Defence", description: "Bring on a defender to protect the lead", effect: "defensive" },
        { label: "No Sub", description: "Keep the current XI", effect: "none" },
      ],
      resolved: false,
    });
  }

  decisions.sort((a, b) => a.minute - b.minute);
  return decisions;
}

function applyDecisionToMatch(
  match: CLMatchResult,
  decision: MatchDecision,
  choice: "attacking" | "defensive" | "none",
): CLMatchResult {
  if (choice === "none") return match;

  const modified = {
    ...match,
    goalsFor: match.goalsFor,
    goalsAgainst: match.goalsAgainst,
    goalScorers: [...match.goalScorers],
    assistProviders: [...match.assistProviders],
    events: [...match.events],
  };

  const afterMinute = decision.minute;

  if (choice === "attacking") {
    // 40% chance to add an extra player goal
    if (Math.random() < 0.40) {
      const minute = afterMinute + 5 + Math.floor(Math.random() * (85 - afterMinute));
      const scorerName = modified.goalScorers.length > 0
        ? modified.goalScorers[Math.floor(Math.random() * modified.goalScorers.length)].player
        : "Unknown";
      modified.goalsFor++;
      modified.goalScorers.push({ player: scorerName, minute });
      modified.events.push({ minute, type: "goal", side: "player", playerName: scorerName });
    }
    // 30% chance opponent also scores
    if (Math.random() < 0.30) {
      const minute = afterMinute + 5 + Math.floor(Math.random() * (85 - afterMinute));
      modified.goalsAgainst++;
      modified.events.push({ minute, type: "goal", side: "opponent", detail: `${match.opponent} goal` });
    }
  } else if (choice === "defensive") {
    // Try to remove an opponent goal after this minute
    const oppGoalsAfter = modified.events.filter(e => e.type === "goal" && e.side === "opponent" && e.minute > afterMinute);
    if (oppGoalsAfter.length > 0 && Math.random() < 0.50) {
      const toRemove = oppGoalsAfter[0];
      modified.events = modified.events.filter(e => e !== toRemove);
      modified.goalsAgainst--;
    }
    // But also might lose a player goal
    const playerGoalsAfter = modified.events.filter(e => e.type === "goal" && e.side === "player" && e.minute > afterMinute);
    if (playerGoalsAfter.length > 0 && Math.random() < 0.30) {
      const toRemove = playerGoalsAfter[0];
      modified.events = modified.events.filter(e => e !== toRemove);
      modified.goalScorers = modified.goalScorers.filter(g => !(g.minute === toRemove.minute && g.player === toRemove.playerName));
      modified.goalsFor--;
    }
  }

  // Recalculate result
  if (modified.goalsFor > modified.goalsAgainst) modified.result = "W";
  else if (modified.goalsFor < modified.goalsAgainst) modified.result = "L";
  else modified.result = "D";

  modified.events.sort((a, b) => a.minute - b.minute);
  modified.goalScorers.sort((a, b) => a.minute - b.minute);

  return modified;
}

export default function CLMatchViewer({ match: initialMatch, playerTeamName = "KNOWITBALL FC", knockoutTie, legNumber, squadPlayers, onFinished }: Props) {
  const [liveMatch, setLiveMatch] = useState<CLMatchResult>(initialMatch);
  const [currentMinute, setCurrentMinute] = useState(0);
  const [visibleEvents, setVisibleEvents] = useState<MatchEvent[]>([]);
  const [displayGoalsFor, setDisplayGoalsFor] = useState(0);
  const [displayGoalsAgainst, setDisplayGoalsAgainst] = useState(0);
  const [speed, setSpeed] = useState(5);
  const [finished, setFinished] = useState(false);
  const [paused, setPaused] = useState(false);
  const [decisions, setDecisions] = useState<MatchDecision[]>([]);
  const [activeDecision, setActiveDecision] = useState<MatchDecision | null>(null);
  const eventListRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxMinute = liveMatch.extraTime ? (liveMatch.penalties ? 121 : 120) : 90;

  // Reset all state when the match prop changes
  useEffect(() => {
    setLiveMatch(initialMatch);
    setCurrentMinute(0);
    setVisibleEvents([]);
    setDisplayGoalsFor(0);
    setDisplayGoalsAgainst(0);
    setFinished(false);
    setPaused(false);
    setActiveDecision(null);
    setDecisions(generateDecisions(initialMatch, squadPlayers));
  }, [initialMatch, squadPlayers]);

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

  // Check for decisions at current minute
  useEffect(() => {
    if (activeDecision || finished) return;
    const pending = decisions.find(d => !d.resolved && d.minute <= currentMinute);
    if (pending) {
      setActiveDecision(pending);
      setPaused(true);
    }
  }, [currentMinute, decisions, activeDecision, finished]);

  useEffect(() => {
    if (finished || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const ms = Math.max(30, 1000 / speed);
    intervalRef.current = setInterval(tick, ms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [speed, finished, paused, tick]);

  // Reveal events as minutes pass
  useEffect(() => {
    const newEvents = liveMatch.events.filter(e => e.minute <= currentMinute);
    setVisibleEvents(newEvents);
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
  }, [currentMinute, liveMatch.events]);

  useEffect(() => {
    if (eventListRef.current) {
      eventListRef.current.scrollTop = eventListRef.current.scrollHeight;
    }
  }, [visibleEvents.length]);

  const handleDecisionChoice = (choice: "attacking" | "defensive" | "none") => {
    if (!activeDecision) return;
    const modified = applyDecisionToMatch(liveMatch, activeDecision, choice);
    setLiveMatch(modified);
    setDecisions(prev => prev.map(d => d === activeDecision ? { ...d, resolved: true } : d));
    setActiveDecision(null);
    setPaused(false);
  };

  const handleSkip = () => {
    // Resolve any pending decisions as "none"
    setDecisions(prev => prev.map(d => ({ ...d, resolved: true })));
    setActiveDecision(null);
    setCurrentMinute(maxMinute);
    setFinished(true);
    setDisplayGoalsFor(liveMatch.goalsFor);
    setDisplayGoalsAgainst(liveMatch.goalsAgainst);
    setVisibleEvents(liveMatch.events);
  };

  const aggLine = (() => {
    if (!knockoutTie || legNumber !== 2 || !knockoutTie.leg1) return null;
    const totalFor = knockoutTie.leg1.goalsFor + displayGoalsFor;
    const totalAgainst = knockoutTie.leg1.goalsAgainst + displayGoalsAgainst;
    return `Aggregate: ${totalFor} - ${totalAgainst}`;
  })();

  const homeName = liveMatch.isHome ? playerTeamName : liveMatch.opponent;
  const awayName = liveMatch.isHome ? liveMatch.opponent : playerTeamName;
  const homeScore = liveMatch.isHome ? displayGoalsFor : displayGoalsAgainst;
  const awayScore = liveMatch.isHome ? displayGoalsAgainst : displayGoalsFor;

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
            <div className={`text-lg font-bold ${liveMatch.isHome ? "text-blue-400" : "text-white"}`}>{homeName}</div>
          </div>
          <div className="text-4xl font-mono font-bold min-w-[100px] text-center">
            {homeScore} — {awayScore}
          </div>
          <div className="text-left flex-1">
            <div className={`text-lg font-bold ${!liveMatch.isHome ? "text-blue-400" : "text-white"}`}>{awayName}</div>
          </div>
        </div>

        {aggLine && <div className="text-sm text-yellow-400 mt-2">{aggLine}</div>}

        {liveMatch.penalties && finished && liveMatch.penaltyScore && (
          <div className="text-sm text-yellow-400 mt-1">
            Penalties: {liveMatch.penaltyScore.player} - {liveMatch.penaltyScore.opponent}
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
            <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${(currentMinute / maxMinute) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Decision popup */}
      {activeDecision && (
        <div className="bg-yellow-900/30 border-2 border-yellow-500/50 rounded-xl p-5 space-y-3 animate-in fade-in duration-300">
          <div className="text-center">
            <div className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">{currentMinute}&apos; — Decision</div>
            <div className="text-xl font-bold mt-1">{activeDecision.prompt}</div>
          </div>
          <div className="space-y-2">
            {activeDecision.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleDecisionChoice(opt.effect)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  opt.effect === "attacking" ? "bg-red-900/30 hover:bg-red-900/50 border border-red-500/30" :
                  opt.effect === "defensive" ? "bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/30" :
                  "bg-gray-700/50 hover:bg-gray-700 border border-gray-600/30"
                }`}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Speed controls */}
      {!activeDecision && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${paused ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 hover:bg-gray-600"}`}
          >
            {paused ? "▶ Play" : "⏸ Pause"}
          </button>
          {[5, 6, 7, 8].map(s => (
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
      )}

      {/* Event feed */}
      <div ref={eventListRef} className="bg-gray-800/50 rounded-xl p-4 h-64 overflow-y-auto space-y-1">
        {visibleEvents.filter(e => e.type !== "assist").map((event, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 text-sm ${
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
            <span>{eventLabel(event, playerTeamName, liveMatch.opponent)}</span>
          </div>
        ))}
        {visibleEvents.length === 0 && (
          <div className="text-gray-500 text-center py-8">Match starting...</div>
        )}
      </div>

      {/* Post-match */}
      {finished && (
        <div className="text-center space-y-2">
          <div className={`text-xl font-bold ${
            liveMatch.goalsFor > liveMatch.goalsAgainst ? "text-green-400" :
            liveMatch.goalsFor < liveMatch.goalsAgainst ? "text-red-400" : "text-yellow-400"
          }`}>
            {liveMatch.goalsFor > liveMatch.goalsAgainst ? "Victory!" :
             liveMatch.goalsFor < liveMatch.goalsAgainst ? "Defeat" : "Draw"}
            {liveMatch.penalties && liveMatch.penaltyScore && (
              <span className="text-sm ml-2">
                ({liveMatch.penaltyScore.player > liveMatch.penaltyScore.opponent ? "Won" : "Lost"} on penalties)
              </span>
            )}
          </div>
          {liveMatch.goalScorers.length > 0 && (
            <div className="text-sm text-gray-400">
              ⚽ {liveMatch.goalScorers.map(g => `${g.player} ${g.minute}'`).join(", ")}
            </div>
          )}
          <button
            onClick={() => onFinished(liveMatch)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}
