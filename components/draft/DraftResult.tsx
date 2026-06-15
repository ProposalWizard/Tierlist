"use client";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { simulateSeason } from "@/lib/seasonSimulator";
import type { SeasonResult } from "@/lib/seasonSimulator";
import Link from "next/link";
import { getPositionColor, getPositionTextColor } from "./formations";
import type { DraftPlayer } from "@/app/draft/page";

interface Props {
  players: DraftPlayer[];
  onNewRun: () => void;
  onPlayNextSeason?: (season: SeasonResult, players: DraftPlayer[]) => void;
  seasonNumber?: number;
  previousResult?: SeasonResult;
  formationName?: string;
  isSignedIn?: boolean;
}

interface PLRecord {
  label: string;
  record: number;
  holder: string;
  lowerIsBetter?: boolean;
}

const PL_RECORDS: PLRecord[] = [
  { label: "Most PL points", record: 100, holder: "Man City (17/18)" },
  { label: "Most PL wins", record: 32, holder: "Man City (17/18 & 18/19)" },
  { label: "Most consecutive wins", record: 18, holder: "Man City (2017)" },
  { label: "Fewest PL defeats", record: 0, holder: "Arsenal (03/04)", lowerIsBetter: true },
  { label: "Longest unbeaten run", record: 49, holder: "Arsenal (03–04)" },
  { label: "Most PL goals (team)", record: 106, holder: "Man City (17/18)" },
  { label: "Best goal difference", record: 79, holder: "Man City (17/18)" },
  { label: "Most PL goals (player)", record: 36, holder: "Haaland (22/23)" },
  { label: "Most PL assists", record: 21, holder: "Bruno Fernandes (25/26)" },
  { label: "Most goals + assists", record: 47, holder: "Salah (24/25)" },
  { label: "Most PL clean sheets", record: 24, holder: "Petr Cech (04/05)" },
];

function RecordsSection({ season, previousResult }: { season: SeasonResult; previousResult?: SeasonResult }) {
  const plGoalsByPlayer: Record<string, number> = {};
  const plAssistsByPlayer: Record<string, number> = {};
  for (const m of season.matches) {
    for (const gs of m.goalScorers) {
      plGoalsByPlayer[gs.player] = (plGoalsByPlayer[gs.player] || 0) + 1;
    }
    for (const ap of m.assistProviders) {
      plAssistsByPlayer[ap.player] = (plAssistsByPlayer[ap.player] || 0) + 1;
    }
  }
  const topPLGoals = Object.values(plGoalsByPlayer).length > 0
    ? Math.max(...Object.values(plGoalsByPlayer))
    : 0;
  const topPLScorer = Object.entries(plGoalsByPlayer).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const topPLAssists = Object.values(plAssistsByPlayer).length > 0
    ? Math.max(...Object.values(plAssistsByPlayer))
    : 0;
  const topPLAssister = Object.entries(plAssistsByPlayer).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const allPlayerNames = Array.from(new Set([...Object.keys(plGoalsByPlayer), ...Object.keys(plAssistsByPlayer)]));
  let topGA = 0;
  let topGAPlayer = "";
  for (const name of allPlayerNames) {
    const combined = (plGoalsByPlayer[name] || 0) + (plAssistsByPlayer[name] || 0);
    if (combined > topGA) {
      topGA = combined;
      topGAPlayer = name;
    }
  }

  const gkStats = season.playerStats.find((ps) =>
    ps.assignedPosition === "GK"
  );
  const plCleanSheetsByGk = gkStats
    ? season.matches.filter((m) => m.goalsAgainst === 0).length
    : 0;

  const crossSeasonWinStreak = previousResult
    ? previousResult.trailingWinStreak + season.leadingWinStreak
    : season.longestWinStreak;
  const effectiveConsecutiveWins = Math.max(season.longestWinStreak, crossSeasonWinStreak);

  const crossSeasonUnbeaten = previousResult
    ? previousResult.trailingUnbeatenRun + season.leadingUnbeatenRun
    : season.longestUnbeatenRun;
  const effectiveUnbeatenRun = Math.max(season.longestUnbeatenRun, crossSeasonUnbeaten);

  const gd = season.teamRecord.goalsFor - season.teamRecord.goalsAgainst;

  const values: number[] = [
    season.teamRecord.points,
    season.teamRecord.wins,
    effectiveConsecutiveWins,
    season.teamRecord.losses,
    effectiveUnbeatenRun,
    season.teamRecord.goalsFor,
    gd,
    topPLGoals,
    topPLAssists,
    topGA,
    plCleanSheetsByGk,
  ];

  const brokenCount = PL_RECORDS.filter((r, i) =>
    r.lowerIsBetter ? values[i] < r.record : values[i] > r.record
  ).length;

  const matchedCount = PL_RECORDS.filter((r, i) =>
    values[i] === r.record
  ).length;

  return (
    <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">&#127942;</span>
        <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
          PL Records
        </h3>
        {brokenCount > 0 && (
          <span className="ml-auto text-[10px] font-black text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">
            {brokenCount} BROKEN
          </span>
        )}
        {brokenCount === 0 && matchedCount > 0 && (
          <span className="ml-auto text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
            {matchedCount} MATCHED
          </span>
        )}
      </div>
      <div className="space-y-1">
        {PL_RECORDS.map((rec, i) => {
          const val = values[i];
          const broken = rec.lowerIsBetter ? val < rec.record : val > rec.record;
          const matched = val === rec.record;
          const close = rec.lowerIsBetter
            ? val <= rec.record + 2 && !broken && !matched
            : val >= rec.record - 2 && !broken && !matched;

          return (
            <div
              key={rec.label}
              className={`flex items-center gap-2 text-sm py-2 px-2 rounded-lg ${
                broken
                  ? "bg-yellow-900/20 border border-yellow-600/30"
                  : matched
                    ? "bg-amber-900/15 border border-amber-700/25"
                    : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium ${broken ? "text-yellow-300" : matched ? "text-amber-300" : "text-gray-400"}`}>
                  {rec.label}
                </div>
                <div className="text-[10px] text-gray-600">{rec.holder}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-black tabular-nums ${
                  broken ? "text-yellow-400" :
                  matched ? "text-amber-400" :
                  close ? "text-white" : "text-gray-500"
                }`}>
                  {val}
                </span>
                <span className="text-gray-700 text-xs">/</span>
                <span className="text-gray-600 text-xs font-bold tabular-nums w-6 text-right">
                  {rec.record}
                </span>
              </div>
              {broken && (
                <span className="text-[9px] font-black text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded shrink-0">
                  BROKEN
                </span>
              )}
              {matched && !broken && (
                <span className="text-[9px] font-black text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded shrink-0">
                  MATCHED
                </span>
              )}
            </div>
          );
        })}
      </div>
      {previousResult && (effectiveConsecutiveWins > season.longestWinStreak || effectiveUnbeatenRun > season.longestUnbeatenRun) && (
        <div className="mt-2 pt-2 border-t border-gray-800/50 text-[10px] text-gray-600">
          Win streak &amp; unbeaten run include carry-over from previous season
        </div>
      )}
      {(topPLGoals > 0 || topPLAssists > 0) && (
        <div className="mt-2 pt-2 border-t border-gray-800/50 text-[10px] text-gray-600 space-y-0.5">
          {topPLScorer && <div>Top scorer: {topPLScorer} ({topPLGoals}G)</div>}
          {topPLAssister && <div>Top assists: {topPLAssister} ({topPLAssists}A)</div>}
          {topGAPlayer && <div>Top G+A: {topGAPlayer} ({topGA})</div>}
          {gkStats && <div>GK clean sheets: {gkStats.name} ({plCleanSheetsByGk})</div>}
        </div>
      )}
    </div>
  );
}

export interface DraftRunRecord {
  id: string;
  date: string;
  formation: string;
  seasonNumber: number;
  finish: number;
  points: number;
  record: { wins: number; draws: number; losses: number };
  goalsFor: number;
  goalsAgainst: number;
  goalsScored: number;
  avgOvr: number;
  players: { name: string; assignedPosition: string; overall: number; clubYear: string }[];
}

async function saveRunToHistory(run: DraftRunRecord, isSignedIn: boolean) {
  if (!isSignedIn) return;
  try {
    await fetch("/api/draft/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run),
    });
  } catch {}
}

export async function loadDraftHistory(): Promise<DraftRunRecord[]> {
  try {
    const res = await fetch("/api/draft/history");
    if (!res.ok) return [];
    const data = await res.json();
    return data.runs || [];
  } catch {
    return [];
  }
}

export default function DraftResult({ players, onNewRun, onPlayNextSeason, seasonNumber = 1, previousResult, formationName, isSignedIn = false }: Props) {
  const season = useMemo(() => simulateSeason(players, undefined, seasonNumber), [players, seasonNumber]);
  const [showMatches, setShowMatches] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [statsView, setStatsView] = useState<"pl" | "all">("all");

  // Match-by-match reveal
  const [revealedWeek, setRevealedWeek] = useState(0);
  const [seasonComplete, setSeasonComplete] = useState(false);
  const matchListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seasonComplete) return;
    if (revealedWeek < 38) {
      const timer = setTimeout(() => setRevealedWeek(w => w + 1), 350);
      return () => clearTimeout(timer);
    }
    if (revealedWeek >= 38) {
      const timer = setTimeout(() => setSeasonComplete(true), 600);
      return () => clearTimeout(timer);
    }
  }, [revealedWeek, seasonComplete]);

  useEffect(() => {
    if (matchListRef.current) {
      matchListRef.current.scrollTop = matchListRef.current.scrollHeight;
    }
  }, [revealedWeek]);

  const historySaved = useRef(false);
  useEffect(() => {
    if (seasonComplete && !historySaved.current) {
      historySaved.current = true;
      const avgOvr = Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length);
      saveRunToHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date().toISOString(),
        formation: formationName || "",
        seasonNumber,
        finish: season.actualFinish,
        points: season.teamRecord.points,
        record: { wins: season.teamRecord.wins, draws: season.teamRecord.draws, losses: season.teamRecord.losses },
        goalsFor: season.teamRecord.goalsFor,
        goalsAgainst: season.teamRecord.goalsAgainst,
        goalsScored: season.teamRecord.goalsFor,
        avgOvr,
        players: players.map(p => ({ name: p.name, assignedPosition: p.assignedPosition, overall: p.overall, clubYear: p.clubYear })),
      }, isSignedIn);
    }
  }, [seasonComplete, players, season, seasonNumber, isSignedIn]);

  const handleSkip = useCallback(() => {
    setRevealedWeek(38);
    setSeasonComplete(true);
  }, []);

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const titleMessage = () => {
    if (season.actualFinish === 1)
      return { title: "CHAMPIONS", sub: "TITLE WON. JOB DONE.", color: "text-emerald-400" };
    if (season.actualFinish <= 4)
      return { title: "TOP 4", sub: "Champions League secured.", color: "text-blue-400" };
    if (season.actualFinish <= 6)
      return { title: "EUROPE", sub: "European football earned.", color: "text-orange-400" };
    if (season.actualFinish <= 17)
      return { title: "MID-TABLE", sub: "Safe but unremarkable.", color: "text-gray-400" };
    return { title: "RELEGATED", sub: "Down to the Championship.", color: "text-red-400" };
  };

  const msg = titleMessage();

  const positionOrder: Record<string, number> = { GK: 0, CB: 1, RB: 2, LB: 3, RWB: 2, LWB: 3, SW: 1, CDM: 4, DM: 4, CM: 5, CAM: 6, RM: 7, LM: 7, RAM: 6, LAM: 6, RW: 8, LW: 8, ST: 9, CF: 9 };
  const starterPlayers = useMemo(() =>
    [...players.filter(p => !p.isSub)].sort((a, b) => (positionOrder[a.assignedPosition] ?? 5) - (positionOrder[b.assignedPosition] ?? 5)),
    [players]
  );

  const subPlayers = useMemo(() =>
    players.filter(p => p.isSub),
    [players]
  );

  const sortedStats = useMemo(() => {
    const source = statsView === "pl" ? season.plPlayerStats : season.playerStats;
    return [...source].sort((a, b) => (positionOrder[a.assignedPosition] ?? 5) - (positionOrder[b.assignedPosition] ?? 5));
  }, [season.playerStats, season.plPlayerStats, statsView]);

  const handleShare = useCallback(async () => {
    if (!shareRef.current || sharing) return;
    setSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: "#030712",
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `pl-draft-${ordinal(season.actualFinish)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      const avgOvr = Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length);
      const text = `PL Draft: Finished ${ordinal(season.actualFinish)} with ${season.teamRecord.points}pts (${avgOvr} avg OVR) — ${season.performance.toLowerCase()}! 🏆`;
      const url = typeof window !== "undefined" ? window.location.href : "";
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
        "_blank"
      );
    } catch (err) {
      console.error("Share screenshot failed:", err);
    } finally {
      setSharing(false);
    }
  }, [sharing, season.actualFinish, season.teamRecord.points, season.performance, players]);

  const getLeaguePositionStyle = (pos: number, isPlayer: boolean) => {
    if (isPlayer) return "";
    if (pos === 1) return "border-l-2 border-l-yellow-500";
    if (pos <= 4) return "border-l-2 border-l-blue-500";
    if (pos <= 6) return "border-l-2 border-l-emerald-500";
    if (pos >= 18) return "border-l-2 border-l-red-500";
    return "";
  };

  const getLeaguePositionBadge = (pos: number) => {
    if (pos === 1) return "bg-yellow-500/20 text-yellow-400";
    if (pos <= 4) return "bg-blue-500/20 text-blue-400";
    if (pos <= 6) return "bg-emerald-500/20 text-emerald-400";
    if (pos >= 18) return "bg-red-500/20 text-red-400";
    return "text-gray-500";
  };

  // Group matches into matchweeks (2 matches per week for a 38-match season against 19 opponents)
  const matchweeks = useMemo(() => {
    const weeks: { week: number; matches: typeof season.matches }[] = [];
    for (let i = 0; i < season.matches.length; i++) {
      weeks.push({ week: i + 1, matches: [season.matches[i]] });
    }
    return weeks;
  }, [season.matches]);

  // --- Match-by-match reveal phase ---
  if (!seasonComplete) {
    const revealedMatches = season.matches.slice(0, revealedWeek);
    const runW = revealedMatches.filter(m => m.result === 'W').length;
    const runD = revealedMatches.filter(m => m.result === 'D').length;
    const runL = revealedMatches.filter(m => m.result === 'L').length;
    const runPts = runW * 3 + runD;
    const runGF = revealedMatches.reduce((s, m) => s + m.goalsFor, 0);
    const runGA = revealedMatches.reduce((s, m) => s + m.goalsAgainst, 0);
    const currentMatch = revealedWeek > 0 ? season.matches[revealedWeek - 1] : null;
    const avgOvr = Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length);

    return (
      <div className="max-w-2xl mx-auto p-4 pb-20">
        {/* Squad header */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
            {seasonNumber > 1 ? `Season ${seasonNumber} Squad` : "Your XI"}
          </h3>
          <div className="space-y-0.5">
            {starterPlayers.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1 px-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-8 text-center`}>
                  {p.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium">{p.name}</span>
                <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800/50 flex justify-between text-xs text-gray-500">
            <span>Average OVR</span>
            <span className="font-bold text-white">{avgOvr}</span>
          </div>
        </div>

        {/* Matchweek header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            Matchweek {revealedWeek} / 38
          </span>
          <button
            onClick={handleSkip}
            className="text-xs font-bold text-gray-400 hover:text-white transition px-3 py-2 -mr-3 rounded-lg active:bg-gray-800"
          >
            Skip all &rarr;
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-800 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(revealedWeek / 38) * 100}%` }}
          />
        </div>

        {/* Recent match results */}
        <div ref={matchListRef} className="space-y-1 mb-4 max-h-[260px] overflow-y-auto scrollbar-hide">
          {revealedMatches.slice(-5).map((match, i) => {
            const weekNum = revealedWeek - (revealedMatches.slice(-5).length - 1 - i);
            const isLatest = i === revealedMatches.slice(-5).length - 1;
            return (
              <div
                key={weekNum}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-all duration-300 ${
                  isLatest
                    ? "bg-gray-800/80 border-gray-700/50 scale-[1.01]"
                    : "bg-gray-900/60 border-gray-800/30 opacity-70"
                } ${
                  match.result === "W"
                    ? "border-l-2 border-l-emerald-500"
                    : match.result === "D"
                      ? "border-l-2 border-l-yellow-500"
                      : "border-l-2 border-l-red-500"
                }`}
              >
                <span className="text-[10px] font-bold text-gray-600 w-8 shrink-0">GW{weekNum}</span>
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                  match.result === "W"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : match.result === "D"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                }`}>
                  {match.result}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {match.opponent}
                    <span className="text-gray-600 text-[10px] ml-1.5">
                      ({match.isHome ? "H" : "A"})
                    </span>
                  </div>
                  {match.goalScorers.length > 0 && (
                    <div className="text-[10px] text-gray-500 truncate">
                      &#9917; {match.goalScorers.map(g => `${g.player.split(" ").pop()} ${g.minute}'`).join(", ")}
                    </div>
                  )}
                </div>
                <div className={`text-lg font-black tabular-nums ${
                  match.result === "W" ? "text-emerald-400" :
                  match.result === "D" ? "text-yellow-400" : "text-red-400"
                }`}>
                  {match.goalsFor}&ndash;{match.goalsAgainst}
                </div>
              </div>
            );
          })}
        </div>

        {/* Form guide (building up) */}
        {revealedWeek > 0 && (
          <div className="bg-gray-900 rounded-xl p-3 mb-3 border border-gray-800/50">
            <div className="flex gap-[3px] flex-wrap">
              {revealedMatches.map((m, i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center ${
                    m.result === "W"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : m.result === "D"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {m.result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Running stats */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black text-emerald-400">{runW}</div>
            <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Won</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black text-yellow-400">{runD}</div>
            <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Drawn</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black text-red-400">{runL}</div>
            <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Lost</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black text-white">{runPts}</div>
            <div className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Pts</div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-600 mb-6">
          GF {runGF} &middot; GA {runGA} &middot; GD {runGF - runGA >= 0 ? "+" : ""}{runGF - runGA}
        </div>
      </div>
    );
  }

  // --- Full results phase (after season complete) ---
  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      {/* Shareable area */}
      <div ref={shareRef} className="bg-gray-950 pb-4">
        {/* Champion / Relegated Banner */}
        {(season.actualFinish === 1 || season.actualFinish >= 18) && (
          <div className={`relative overflow-hidden rounded-xl mb-6 py-8 px-4 text-center ${
            season.actualFinish === 1
              ? "bg-gradient-to-r from-yellow-900/40 via-yellow-600/20 to-yellow-900/40 border border-yellow-600/40"
              : "bg-gradient-to-r from-red-900/40 via-red-600/20 to-red-900/40 border border-red-600/40"
          }`}>
            {/* Glow effect */}
            <div className={`absolute inset-0 ${
              season.actualFinish === 1
                ? "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent"
                : "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent"
            }`} />
            <div className="relative">
              {season.actualFinish === 1 && (
                <div className="text-3xl mb-2">&#9733;</div>
              )}
              <h1 className={`text-4xl font-black tracking-tighter ${
                season.actualFinish === 1 ? "text-yellow-400" : "text-red-400"
              }`}>
                {season.actualFinish === 1 ? "CHAMPIONS" : "RELEGATED"}
              </h1>
              <p className={`text-sm font-medium mt-1 ${
                season.actualFinish === 1 ? "text-yellow-500/70" : "text-red-500/70"
              }`}>
                {season.actualFinish === 1 ? "Premier League Title Winners" : "Dropped to the Championship"}
              </p>
            </div>
          </div>
        )}

        {/* Finish Cards */}
        <div className="flex justify-center gap-3 mb-4">
          <div className="bg-gray-900 rounded-xl px-6 py-3 text-center border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Finished</div>
            <div className={`text-3xl font-black ${
              season.actualFinish === 1 ? "text-yellow-400" :
              season.actualFinish <= 4 ? "text-blue-400" :
              season.actualFinish <= 6 ? "text-emerald-400" :
              season.actualFinish >= 18 ? "text-red-400" : "text-white"
            }`}>{ordinal(season.actualFinish)}</div>
          </div>
          <div className="bg-gray-900 rounded-xl px-6 py-3 text-center border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Projected</div>
            <div className="text-3xl font-black text-gray-300">{ordinal(season.projectedFinish)}</div>
          </div>
          <div className={`rounded-xl px-4 py-3 flex items-center border ${
            season.performance === "OVERPERFORMED"
              ? "bg-emerald-900/30 text-emerald-400 border-emerald-700/40"
              : season.performance === "UNDERPERFORMED"
                ? "bg-red-900/30 text-red-400 border-red-700/40"
                : "bg-gray-900 text-gray-400 border-gray-800/50"
          }`}>
            <span className="text-xs font-bold tracking-wide">{season.performance}</span>
          </div>
        </div>

        {/* Title message (only when no big banner) */}
        {season.actualFinish > 1 && season.actualFinish < 18 && (
          <div className="bg-gray-900 rounded-xl p-4 mb-6 text-center border border-gray-800/50">
            <h2 className={`text-xl font-black ${msg.color}`}>{msg.title}</h2>
            <p className="text-gray-500 text-sm">{msg.sub}</p>
          </div>
        )}

        {/* Your XI */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
            {seasonNumber > 1 ? `Season ${seasonNumber} Squad` : "Your Squad"}
          </h3>
          <div className="space-y-0.5">
            {starterPlayers.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1 px-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-8 text-center`}>
                  {p.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium">{p.name}</span>
                <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
              </div>
            ))}
          </div>
          {subPlayers.length > 0 && (
            <>
              <div className="mt-2 pt-2 border-t border-gray-800/50">
                <div className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-1">Substitutes</div>
              </div>
              <div className="space-y-0.5">
                {subPlayers.map((p, i) => (
                  <div key={`sub-${i}`} className="flex items-center gap-2 text-sm py-1 px-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-8 text-center`}>
                      {p.assignedPosition}
                    </span>
                    <span className="flex-1 ml-1 font-medium">{p.name}</span>
                    <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                    <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="mt-2 pt-2 border-t border-gray-800/50 flex justify-between text-xs text-gray-500">
            <span>Average OVR</span>
            <span className="font-bold text-white">
              {Math.round(players.reduce((acc, p) => acc + p.overall, 0) / players.length)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>Team Strength</span>
            <span className="font-bold text-emerald-400">
              {Math.round(season.phaseRatings.teamStrength)}
            </span>
          </div>
          <div className="mt-1 flex gap-3 text-[10px] text-gray-600 justify-end">
            <span>ATK {Math.round(season.phaseRatings.attack)}</span>
            <span>MID {Math.round(season.phaseRatings.midfield)}</span>
            <span>DEF {Math.round(season.phaseRatings.defense)}</span>
            <span>GK {Math.round(season.phaseRatings.gk)}</span>
          </div>
        </div>

        {/* Record */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-emerald-400">{season.teamRecord.wins}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Wins</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-yellow-400">{season.teamRecord.draws}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Draws</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-red-400">{season.teamRecord.losses}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Losses</div>
          </div>
        </div>

        {/* Form Guide */}
        <div className="bg-gray-900 rounded-xl p-3 mb-3 border border-gray-800/50">
          <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Form</div>
          <div className="flex gap-[3px] flex-wrap">
            {season.matches.map((m, i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center ${
                  m.result === "W"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : m.result === "D"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                }`}
                title={`MW${i + 1}: ${m.result} ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponent}`}
              >
                {m.result}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-white">{season.teamRecord.points}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Points</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-emerald-400">{season.teamRecord.goalsFor}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Goals For</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-3xl font-black text-red-400">{season.teamRecord.goalsAgainst}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Goals Against</div>
          </div>
        </div>

        {/* FA Cup */}
        <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">&#127942;</span>
            <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">FA Cup</h3>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
              season.faCup.winner
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {season.faCup.winner ? "WINNER" : `Out: ${season.faCup.exitRound}`}
            </span>
          </div>
          <div className="space-y-1.5">
            {season.faCup.matches.map((m, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg ${
                  m.result === "W" ? "bg-emerald-900/20" : "bg-red-900/20"
                }`}
              >
                <span className="text-[10px] font-bold text-gray-500 w-20 shrink-0">{m.round}</span>
                <span className="flex-1 font-medium truncate">{m.opponent}</span>
                <span className={`font-black tabular-nums ${m.result === "W" ? "text-emerald-400" : "text-red-400"}`}>
                  {m.goalsFor}-{m.goalsAgainst}
                </span>
                {m.extraTime && !m.penalties && (
                  <span className="text-[9px] font-bold text-yellow-400/70 bg-yellow-500/10 px-1 py-0.5 rounded">AET</span>
                )}
                {m.penalties && m.penaltyScore && (
                  <span className="text-[9px] font-bold text-purple-400/70 bg-purple-500/10 px-1 py-0.5 rounded">
                    PEN {m.penaltyScore.player}-{m.penaltyScore.opponent}
                  </span>
                )}
              </div>
            ))}
          </div>
          {season.faCup.matches.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-800/50 flex gap-4 text-[10px] text-gray-600">
              <span>
                Goals: {season.faCup.matches.reduce((s, m) => s + m.goalsFor, 0)}
              </span>
              <span>
                Conceded: {season.faCup.matches.reduce((s, m) => s + m.goalsAgainst, 0)}
              </span>
            </div>
          )}
        </div>

        {/* Season Awards */}
        <div className="mb-6">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">
            Season Awards
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-yellow-400 text-xs">&#9917;</span>
                <span className="text-[10px] font-bold tracking-widest text-yellow-400 uppercase">Golden Boot</span>
              </div>
              <div className="font-bold text-sm">{season.awards.goldenBoot.name}</div>
              <div className="text-emerald-400 text-sm font-bold">{season.awards.goldenBoot.goals} goals</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-purple-400 text-xs">&#127919;</span>
                <span className="text-[10px] font-bold tracking-widest text-purple-400 uppercase">Playmaker</span>
              </div>
              <div className="font-bold text-sm">{season.awards.playmaker.name}</div>
              <div className="text-emerald-400 text-sm font-bold">{season.awards.playmaker.assists} assists</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-blue-400 text-xs">&#129351;</span>
                <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">Golden Glove</span>
              </div>
              <div className="font-bold text-sm">{season.awards.goldenGlove.name}</div>
              <div className="text-emerald-400 text-sm font-bold">{season.awards.goldenGlove.cleanSheets} clean sheets</div>
            </div>
            <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-700/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-emerald-400 text-xs">&#11088;</span>
                <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">Player of Season</span>
              </div>
              <div className="font-bold text-sm">{season.awards.playerOfSeason.name}</div>
              <div className="text-emerald-400 text-sm font-bold">
                {season.awards.playerOfSeason.goals}G &middot; {season.awards.playerOfSeason.assists}A
              </div>
            </div>
          </div>
        </div>

        {/* Player Stats */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              Squad Stats
            </h3>
            <div className="flex rounded-lg overflow-hidden border border-gray-700/50">
              <button
                onClick={() => setStatsView("pl")}
                className={`text-[10px] font-bold px-2.5 py-1 transition ${
                  statsView === "pl"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-gray-600 hover:text-gray-400"
                }`}
              >
                PL
              </button>
              <button
                onClick={() => setStatsView("all")}
                className={`text-[10px] font-bold px-2.5 py-1 transition ${
                  statsView === "all"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "text-gray-600 hover:text-gray-400"
                }`}
              >
                ALL COMPS
              </button>
            </div>
          </div>
          <div className="flex items-center text-[10px] font-bold tracking-widest text-gray-600 mb-2 px-1 uppercase">
            <span className="w-8"></span>
            <span className="flex-1 ml-2">Player</span>
            <span className="w-8 text-center">APP</span>
            <span className="w-8 text-center">G</span>
            <span className="w-8 text-center">A</span>
            <span className="w-8 text-center">CS</span>
            <span className="w-9 text-center">AVG</span>
          </div>
          <div className="space-y-0.5">
            {sortedStats.map((ps, i) => (
              <div key={i} className="flex items-center text-sm py-1.5 px-1 rounded hover:bg-gray-800/50 transition">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(ps.assignedPosition)} text-white w-8 text-center`}>
                  {ps.assignedPosition}
                </span>
                <span className="flex-1 ml-2 font-medium">{ps.name}</span>
                <span className={`w-8 text-center text-xs font-bold ${ps.appearances < 38 ? "text-purple-400" : "text-gray-500"}`}>
                  {ps.appearances}
                </span>
                <span className={`w-8 text-center font-bold ${ps.goals > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                  {ps.goals > 0 ? ps.goals : "-"}
                </span>
                <span className={`w-8 text-center font-bold ${ps.assists > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                  {ps.assists > 0 ? ps.assists : "-"}
                </span>
                <span className={`w-8 text-center font-bold ${ps.cleanSheets > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                  {ps.cleanSheets > 0 ? ps.cleanSheets : "-"}
                </span>
                <span className={`w-9 text-center text-xs font-bold ${
                  ps.avgRating >= 7.5 ? "text-emerald-400" :
                  ps.avgRating >= 7.0 ? "text-yellow-400" :
                  ps.avgRating >= 6.5 ? "text-orange-400" : "text-gray-500"
                }`}>
                  {ps.avgRating.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Extra stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black">{season.awards.goldenGlove.cleanSheets}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Clean Sheets</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black">{season.longestWinStreak}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Win Streak</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black">{season.longestUnbeatenRun}</div>
            <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Unbeaten Run</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">Biggest Win</div>
            <div className="font-bold text-emerald-400 text-sm mt-0.5">
              {season.teamRecord.wins > 0
                ? <>{season.biggestWin.score} vs {season.biggestWin.opponent}</>
                : <span className="text-gray-600">No wins</span>
              }
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">Worst Defeat</div>
            <div className="font-bold text-red-400 text-sm mt-0.5">
              {season.teamRecord.losses > 0
                ? <>{season.worstDefeat.score} vs {season.worstDefeat.opponent}</>
                : <span className="text-emerald-400">Undefeated!</span>
              }
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">Highest Scoring</div>
            <div className="font-bold text-emerald-400 text-sm mt-0.5">
              {season.highestScoring.score} vs {season.highestScoring.opponent}
            </div>
          </div>
        </div>

        {/* PL Records */}
        <RecordsSection season={season} previousResult={previousResult} />
      </div>

      {/* League Table Toggle */}
      <button
        onClick={() => setShowTable(!showTable)}
        className="w-full bg-gray-900 rounded-xl p-4 mb-3 flex items-center justify-between hover:bg-gray-800/80 transition border border-gray-800/50"
      >
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Final League Table</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showTable ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {showTable && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4 overflow-x-auto border border-gray-800/50">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-gray-500">Champion</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-500">Champions League</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-500">Europa League</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-500">Relegation</span>
            </div>
          </div>

          <div className="flex items-center text-[10px] font-bold tracking-widest text-gray-600 mb-2 px-1 uppercase">
            <span className="w-7 text-center">#</span>
            <span className="flex-1 ml-2">Club</span>
            <span className="w-8 text-center">P</span>
            <span className="w-8 text-center">W</span>
            <span className="w-8 text-center">D</span>
            <span className="w-8 text-center">L</span>
            <span className="w-10 text-right">GD</span>
            <span className="w-10 text-right">PTS</span>
          </div>
          <div className="space-y-0.5">
            {season.leagueTable.map((team, i) => {
              const pos = i + 1;
              return (
                <div
                  key={team.name}
                  className={`flex items-center text-sm py-1.5 px-1 rounded transition ${
                    team.isPlayer
                      ? "bg-emerald-900/30 border border-emerald-700/30 font-bold"
                      : `hover:bg-gray-800/50 ${getLeaguePositionStyle(pos, team.isPlayer)}`
                  }`}
                >
                  <span className={`w-7 text-center text-xs font-bold rounded ${getLeaguePositionBadge(pos)}`}>
                    {pos}
                  </span>
                  <span className={`flex-1 ml-2 ${team.isPlayer ? "text-emerald-400 font-bold" : "text-gray-300"}`}>
                    {team.isPlayer ? "Knowitball FC" : team.name}
                  </span>
                  <span className="w-8 text-center text-gray-500 text-xs">{team.played}</span>
                  <span className="w-8 text-center text-gray-500 text-xs">{team.won}</span>
                  <span className="w-8 text-center text-gray-500 text-xs">{team.drawn}</span>
                  <span className="w-8 text-center text-gray-500 text-xs">{team.lost}</span>
                  <span className={`w-10 text-right text-xs font-bold ${
                    team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-gray-500"
                  }`}>
                    {team.goalDifference > 0 ? "+" : ""}{team.goalDifference}
                  </span>
                  <span className={`w-10 text-right font-black ${team.isPlayer ? "text-emerald-400" : "text-white"}`}>
                    {team.points}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Match Results Toggle */}
      <button
        onClick={() => setShowMatches(!showMatches)}
        className="w-full bg-gray-900 rounded-xl p-4 mb-3 flex items-center justify-between hover:bg-gray-800/80 transition border border-gray-800/50"
      >
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Match Results</span>
        <svg className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${showMatches ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {showMatches && (
        <div className="space-y-1 mb-6">
          {matchweeks.map(({ week, matches }) => (
            <div key={week}>
              {/* Matchweek header */}
              <div className="flex items-center gap-2 py-2 px-1">
                <div className="h-px flex-1 bg-gray-800" />
                <span className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">
                  MW {week} / 38
                </span>
                <div className="h-px flex-1 bg-gray-800" />
              </div>
              {matches.map((match, mi) => (
                <div
                  key={mi}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-gray-900/80 border border-gray-800/50 hover:bg-gray-800/60 transition"
                >
                  {/* Result badge */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                    match.result === "W"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : match.result === "D"
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}>
                    {match.result}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      <span className="text-gray-500 text-xs mr-1.5">
                        {match.isHome ? "H" : "A"}
                      </span>
                      {match.opponent}
                    </div>
                    {match.goalScorers.length > 0 && (
                      <div className="text-[11px] text-gray-500 truncate">
                        {match.goalScorers.map((g) => `${g.player.split(" ").pop()} ${g.minute}'`).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className={`text-lg font-black tabular-nums ${
                    match.result === "W"
                      ? "text-emerald-400"
                      : match.result === "D"
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}>
                    {match.goalsFor}-{match.goalsAgainst}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Season comparison */}
      {seasonNumber > 1 && previousResult && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-3">Season Comparison</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase">S{seasonNumber - 1}</div>
              <div className="text-lg font-black text-gray-400">{ordinal(previousResult.actualFinish)}</div>
              <div className="text-xs text-gray-600">{previousResult.teamRecord.points} pts</div>
            </div>
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase">S{seasonNumber}</div>
              <div className={`text-lg font-black ${
                season.actualFinish < previousResult.actualFinish ? "text-emerald-400" :
                season.actualFinish > previousResult.actualFinish ? "text-red-400" : "text-yellow-400"
              }`}>{ordinal(season.actualFinish)}</div>
              <div className="text-xs text-gray-600">{season.teamRecord.points} pts</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className={`grid gap-3 ${onPlayNextSeason ? "grid-cols-3" : "grid-cols-2"}`}>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="py-4 bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sharing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Share
            </>
          )}
        </button>
        {onPlayNextSeason && (
          <button
            onClick={() => onPlayNextSeason(season, players)}
            className="py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl font-bold transition-all shadow-lg shadow-amber-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            Season {seasonNumber + 1}
          </button>
        )}
        <button
          onClick={onNewRun}
          className="py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          New Run
        </button>
      </div>

      {/* History link */}
      <Link
        href="/draft/history"
        className="block w-full mt-3 py-3 text-center text-sm font-bold text-gray-500 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800/50 rounded-xl transition"
      >
        View Draft History &rarr;
      </Link>
    </div>
  );
}
