"use client";
import { useMemo, useState } from "react";
import type { SeasonResult, PlayerStats, MatchResult } from "@/lib/seasonSimulator";
import type { RoomPlayer } from "@/components/draft/MultiplayerLobby";

interface Props {
  allSeasons: SeasonResult[];
  roomPlayers?: RoomPlayer[];
  onClose: () => void;
}

interface H2HRecord {
  name: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

interface AllTimePlayer {
  name: string;
  goals: number;
  assists: number;
  cleanSheets: number;
  appearances: number;
  seasons: number;
  bestRating: number;
  avgRating: number;
}

export default function CareerRecap({ allSeasons, roomPlayers, onClose }: Props) {
  const [tab, setTab] = useState<"overview" | "records" | "h2h" | "players">(
    roomPlayers && roomPlayers.length > 1 ? "h2h" : "overview"
  );

  const humanTeamNames = useMemo(() => {
    if (!roomPlayers) return new Set<string>();
    return new Set(roomPlayers.map(rp => `${rp.display_name}'s XI`));
  }, [roomPlayers]);

  const stats = useMemo(() => {
    const totalSeasons = allSeasons.length;
    const totalPoints = allSeasons.reduce((s, r) => s + r.teamRecord.points, 0);
    const avgPoints = Math.round(totalPoints / totalSeasons);
    const totalWins = allSeasons.reduce((s, r) => s + r.teamRecord.wins, 0);
    const totalDraws = allSeasons.reduce((s, r) => s + r.teamRecord.draws, 0);
    const totalLosses = allSeasons.reduce((s, r) => s + r.teamRecord.losses, 0);
    const totalGoalsFor = allSeasons.reduce((s, r) => s + r.teamRecord.goalsFor, 0);
    const totalGoalsAgainst = allSeasons.reduce((s, r) => s + r.teamRecord.goalsAgainst, 0);
    const winRate = Math.round((totalWins / (totalWins + totalDraws + totalLosses)) * 100);

    const bestFinish = Math.min(...allSeasons.map(r => r.actualFinish));
    const worstFinish = Math.max(...allSeasons.map(r => r.actualFinish));
    const titles = allSeasons.filter(r => r.actualFinish === 1).length;
    const topFour = allSeasons.filter(r => r.actualFinish <= 4).length;
    const faCups = allSeasons.filter(r => r.faCup.winner).length;
    const uclWins = allSeasons.filter(r => r.ucl?.winner).length;
    const uelWins = allSeasons.filter(r => r.uel?.winner).length;

    const bestPoints = Math.max(...allSeasons.map(r => r.teamRecord.points));
    const bestPointsSeason = allSeasons.findIndex(r => r.teamRecord.points === bestPoints) + 1;
    const bestWinStreak = Math.max(...allSeasons.map(r => r.longestWinStreak));
    const bestUnbeaten = Math.max(...allSeasons.map(r => r.longestUnbeatenRun));

    return {
      totalSeasons, totalPoints, avgPoints,
      totalWins, totalDraws, totalLosses,
      totalGoalsFor, totalGoalsAgainst, winRate,
      bestFinish, worstFinish, titles, topFour,
      faCups, uclWins, uelWins,
      bestPoints, bestPointsSeason, bestWinStreak, bestUnbeaten,
    };
  }, [allSeasons]);

  const h2hRecords = useMemo(() => {
    if (!roomPlayers || roomPlayers.length <= 1) return [];
    const records: Record<string, H2HRecord> = {};
    for (const rp of roomPlayers) {
      const teamName = `${rp.display_name}'s XI`;
      records[teamName] = { name: rp.display_name, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    }
    for (const season of allSeasons) {
      for (const m of season.matches) {
        if (humanTeamNames.has(m.opponent) && records[m.opponent]) {
          const r = records[m.opponent];
          r.goalsFor += m.goalsFor;
          r.goalsAgainst += m.goalsAgainst;
          if (m.result === 'W') { r.wins++; r.points += 3; }
          else if (m.result === 'D') { r.draws++; r.points += 1; }
          else { r.losses++; }
        }
      }
    }
    return Object.values(records).filter(r => r.wins + r.draws + r.losses > 0)
      .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst));
  }, [allSeasons, roomPlayers, humanTeamNames]);

  const finishComparison = useMemo(() => {
    if (!roomPlayers || roomPlayers.length <= 1) return [];
    const data: { name: string; finishes: (number | null)[]; avgFinish: number; bestFinish: number; titles: number }[] = [];
    for (const rp of roomPlayers) {
      const teamName = `${rp.display_name}'s XI`;
      const finishes: (number | null)[] = [];
      for (const season of allSeasons) {
        const entry = season.leagueTable.find(t => t.name === teamName);
        if (entry) {
          finishes.push(season.leagueTable.indexOf(entry) + 1);
        } else {
          finishes.push(null);
        }
      }
      const validFinishes = finishes.filter((f): f is number => f !== null);
      data.push({
        name: rp.display_name,
        finishes,
        avgFinish: validFinishes.length > 0 ? Math.round((validFinishes.reduce((a, b) => a + b, 0) / validFinishes.length) * 10) / 10 : 99,
        bestFinish: validFinishes.length > 0 ? Math.min(...validFinishes) : 99,
        titles: validFinishes.filter(f => f === 1).length,
      });
    }
    return data.sort((a, b) => a.avgFinish - b.avgFinish);
  }, [allSeasons, roomPlayers]);

  const allTimePlayers = useMemo(() => {
    const map: Record<string, AllTimePlayer> = {};
    for (let si = 0; si < allSeasons.length; si++) {
      const season = allSeasons[si];
      for (const ps of season.playerStats) {
        if (!map[ps.name]) {
          map[ps.name] = { name: ps.name, goals: 0, assists: 0, cleanSheets: 0, appearances: 0, seasons: 0, bestRating: 0, avgRating: 0 };
        }
        const p = map[ps.name];
        p.goals += ps.goals;
        p.assists += ps.assists;
        p.cleanSheets += ps.cleanSheets;
        p.appearances += ps.appearances;
        p.seasons++;
        if (ps.avgRating > p.bestRating) p.bestRating = ps.avgRating;
      }
    }
    for (const p of Object.values(map)) {
      const totalRatingSum = allSeasons.reduce((sum, season) => {
        const ps = season.playerStats.find(s => s.name === p.name);
        return sum + (ps ? ps.avgRating * ps.appearances : 0);
      }, 0);
      p.avgRating = p.appearances > 0 ? Math.round((totalRatingSum / p.appearances) * 10) / 10 : 0;
    }
    return Object.values(map);
  }, [allSeasons]);

  const singleSeasonRecords = useMemo(() => {
    const records: { label: string; value: string; detail: string }[] = [];

    let bestGoals = { name: "", goals: 0, season: 0 };
    let bestAssists = { name: "", assists: 0, season: 0 };
    let bestRating = { name: "", rating: 0, season: 0 };
    let bestCleanSheets = { name: "", cleanSheets: 0, season: 0 };
    let mostGoalsMatch = { opponent: "", goalsFor: 0, goalsAgainst: 0, season: 0 };
    let worstDefeatAll = { opponent: "", goalsFor: 99, goalsAgainst: 0, season: 0 };

    for (let si = 0; si < allSeasons.length; si++) {
      const season = allSeasons[si];
      for (const ps of season.playerStats) {
        if (ps.goals > bestGoals.goals) bestGoals = { name: ps.name, goals: ps.goals, season: si + 1 };
        if (ps.assists > bestAssists.assists) bestAssists = { name: ps.name, assists: ps.assists, season: si + 1 };
        if (ps.avgRating > bestRating.rating && ps.appearances >= 10) bestRating = { name: ps.name, rating: ps.avgRating, season: si + 1 };
        if (ps.cleanSheets > bestCleanSheets.cleanSheets) bestCleanSheets = { name: ps.name, cleanSheets: ps.cleanSheets, season: si + 1 };
      }
      for (const m of season.matches) {
        if (m.goalsFor > mostGoalsMatch.goalsFor) {
          mostGoalsMatch = { opponent: m.opponent, goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst, season: si + 1 };
        }
        const margin = m.goalsAgainst - m.goalsFor;
        const worstMargin = worstDefeatAll.goalsAgainst - worstDefeatAll.goalsFor;
        if (margin > worstMargin || (margin === worstMargin && m.goalsAgainst > worstDefeatAll.goalsAgainst)) {
          worstDefeatAll = { opponent: m.opponent, goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst, season: si + 1 };
        }
      }
    }

    records.push({ label: "Most Goals (Season)", value: `${bestGoals.goals}`, detail: `${bestGoals.name} (S${bestGoals.season})` });
    records.push({ label: "Most Assists (Season)", value: `${bestAssists.assists}`, detail: `${bestAssists.name} (S${bestAssists.season})` });
    records.push({ label: "Best Avg Rating", value: `${bestRating.rating}`, detail: `${bestRating.name} (S${bestRating.season})` });
    records.push({ label: "Most Clean Sheets", value: `${bestCleanSheets.cleanSheets}`, detail: `${bestCleanSheets.name} (S${bestCleanSheets.season})` });
    records.push({ label: "Most Goals in a Match", value: `${mostGoalsMatch.goalsFor}-${mostGoalsMatch.goalsAgainst}`, detail: `vs ${mostGoalsMatch.opponent} (S${mostGoalsMatch.season})` });
    if (worstDefeatAll.goalsAgainst > worstDefeatAll.goalsFor) {
      records.push({ label: "Worst Defeat", value: `${worstDefeatAll.goalsFor}-${worstDefeatAll.goalsAgainst}`, detail: `vs ${worstDefeatAll.opponent} (S${worstDefeatAll.season})` });
    }

    return records;
  }, [allSeasons]);

  const funStats = useMemo(() => {
    const items: { label: string; value: string }[] = [];

    const totalMatches = allSeasons.reduce((s, r) => s + r.matches.length, 0);
    items.push({ label: "Total Matches Played", value: `${totalMatches}` });
    items.push({ label: "Goals Per Game", value: `${(stats.totalGoalsFor / totalMatches).toFixed(1)}` });

    const cleanSheetSeasons = allSeasons.map((r, i) => ({
      count: r.matches.filter(m => m.goalsAgainst === 0).length,
      season: i + 1,
    }));
    const bestCS = cleanSheetSeasons.reduce((a, b) => b.count > a.count ? b : a, cleanSheetSeasons[0]);
    items.push({ label: "Most Clean Sheets (Season)", value: `${bestCS.count} (S${bestCS.season})` });

    const allGoalScorers = new Set<string>();
    for (const season of allSeasons) {
      for (const m of season.matches) {
        for (const gs of m.goalScorers) allGoalScorers.add(gs.player);
      }
    }
    items.push({ label: "Unique Goal Scorers", value: `${allGoalScorers.size}` });

    const seasonGoals = allSeasons.map((r, i) => ({ goals: r.teamRecord.goalsFor, season: i + 1 }));
    const bestSG = seasonGoals.reduce((a, b) => b.goals > a.goals ? b : a);
    items.push({ label: "Most Goals in a Season", value: `${bestSG.goals} (S${bestSG.season})` });

    const unbeatenHome = allSeasons.reduce((total, r) => total + r.matches.filter(m => m.isHome && m.result !== 'L').length, 0);
    const homeGames = allSeasons.reduce((total, r) => total + r.matches.filter(m => m.isHome).length, 0);
    items.push({ label: "Home Win %", value: `${Math.round((unbeatenHome / homeGames) * 100)}%` });

    const comebacks = allSeasons.reduce((total, season) => {
      let count = 0;
      for (const m of season.matches) {
        if (m.result === 'W' && m.goalScorers.length > 0) {
          const oppFirstGoalMin = m.goalsAgainst > 0 ? 1 : 999;
          const myFirstGoalMin = m.goalScorers[0]?.minute ?? 999;
          if (oppFirstGoalMin < myFirstGoalMin && m.goalsFor > m.goalsAgainst) count++;
        }
      }
      return total + count;
    }, 0);
    if (comebacks > 0) items.push({ label: "Comeback Wins", value: `${comebacks}` });

    const overperformed = allSeasons.filter(r => r.performance === 'OVERPERFORMED').length;
    if (overperformed > 0) items.push({ label: "Seasons Overperformed", value: `${overperformed}/${stats.totalSeasons}` });

    return items;
  }, [allSeasons, stats]);

  const topScorers = useMemo(() =>
    [...allTimePlayers].sort((a, b) => b.goals - a.goals).slice(0, 10),
    [allTimePlayers]
  );

  const topAssisters = useMemo(() =>
    [...allTimePlayers].sort((a, b) => b.assists - a.assists).slice(0, 10),
    [allTimePlayers]
  );

  const topRatings = useMemo(() =>
    [...allTimePlayers].filter(p => p.appearances >= 15).sort((a, b) => b.avgRating - a.avgRating).slice(0, 5),
    [allTimePlayers]
  );

  const clubLegends = useMemo(() =>
    [...allTimePlayers].filter(p => p.seasons >= 2).sort((a, b) => b.seasons - a.seasons || (b.goals + b.assists) - (a.goals + a.assists)).slice(0, 5),
    [allTimePlayers]
  );

  const faCupAbbr = (exitRound: string | null, winner: boolean): string => {
    if (winner) return "W";
    if (!exitRound) return "-";
    if (exitRound === "Round 3") return "R3";
    if (exitRound === "Round 4") return "R4";
    if (exitRound === "Round 5") return "R5";
    if (exitRound === "Quarter-Final") return "QF";
    if (exitRound === "Semi-Final") return "SF";
    if (exitRound === "Final") return "F";
    return exitRound;
  };

  const euroAbbr = (exitStage: string | null, winner: boolean): string => {
    if (winner) return "W";
    if (!exitStage) return "-";
    if (exitStage === "League Phase") return "LP";
    if (exitStage === "Round of 32") return "R32";
    if (exitStage === "Round of 16") return "R16";
    if (exitStage === "Quarter-Final") return "QF";
    if (exitStage === "Semi-Final") return "SF";
    if (exitStage === "Final") return "F";
    return exitStage;
  };

  const hasAnyUCL = allSeasons.some(s => s.ucl?.qualified);
  const hasAnyUEL = allSeasons.some(s => s.uel?.qualified);

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const trophyCount = stats.titles + stats.faCups + stats.uclWins + stats.uelWins;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-4 px-3">
      <div className="w-full max-w-2xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Career Recap</h2>
            <p className="text-xs text-gray-500">{stats.totalSeasons} seasons completed</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-2">
          {(["overview", "records", ...(roomPlayers && roomPlayers.length > 1 ? ["h2h"] : []), "players"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition border-b-2 ${
                tab === t ? "text-white border-emerald-500" : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              {t === "h2h" ? "Head-to-Head" : t === "players" ? "All-Time XI" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5">
          {/* Overview Tab */}
          {tab === "overview" && (
            <>
              {/* Trophy Cabinet */}
              {trophyCount > 0 && (
                <div className="bg-gradient-to-br from-yellow-900/20 to-amber-900/10 border border-yellow-700/30 rounded-xl p-4 text-center">
                  <div className="text-[10px] font-bold tracking-widest text-yellow-600 uppercase mb-2">Trophy Cabinet</div>
                  <div className="flex items-center justify-center gap-6 flex-wrap">
                    {stats.titles > 0 && (
                      <div className="text-center">
                        <div className="text-3xl mb-1">{"\u{1F3C6}"}</div>
                        <div className="text-xs font-bold text-yellow-400">{stats.titles}x PL Champion{stats.titles > 1 ? "s" : ""}</div>
                      </div>
                    )}
                    {stats.faCups > 0 && (
                      <div className="text-center">
                        <div className="text-3xl mb-1">{"\u{1F3C6}"}</div>
                        <div className="text-xs font-bold text-emerald-400">{stats.faCups}x FA Cup{stats.faCups > 1 ? "s" : ""}</div>
                      </div>
                    )}
                    {stats.uclWins > 0 && (
                      <div className="text-center">
                        <div className="text-3xl mb-1">{"\u{1F31F}"}</div>
                        <div className="text-xs font-bold text-blue-400">{stats.uclWins}x UCL Winner{stats.uclWins > 1 ? "s" : ""}</div>
                      </div>
                    )}
                    {stats.uelWins > 0 && (
                      <div className="text-center">
                        <div className="text-3xl mb-1">{"\u{1F3C5}"}</div>
                        <div className="text-xs font-bold text-orange-400">{stats.uelWins}x UEL Winner{stats.uelWins > 1 ? "s" : ""}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Career Numbers */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Career Numbers</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="Total Points" value={`${stats.totalPoints}`} />
                  <StatBox label="Avg Points/Season" value={`${stats.avgPoints}`} />
                  <StatBox label="Win Rate" value={`${stats.winRate}%`} />
                  <StatBox label="Overall Record" value={`${stats.totalWins}W ${stats.totalDraws}D ${stats.totalLosses}L`} small />
                  <StatBox label="Goals Scored" value={`${stats.totalGoalsFor}`} />
                  <StatBox label="Goals Conceded" value={`${stats.totalGoalsAgainst}`} />
                  <StatBox label="Best Finish" value={ordinal(stats.bestFinish)} highlight={stats.bestFinish === 1} />
                  <StatBox label="Worst Finish" value={ordinal(stats.worstFinish)} />
                  <StatBox label="Top-4 Finishes" value={`${stats.topFour}/${stats.totalSeasons}`} />
                </div>
              </div>

              {/* Season-by-Season */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Season by Season</div>
                <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden overflow-x-auto">
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-gray-600 px-3 py-2 border-b border-gray-800/50 uppercase min-w-0">
                    <span className="w-8 shrink-0">S</span>
                    <span className="w-8 text-center shrink-0">#</span>
                    <span className="w-9 text-center shrink-0">Pts</span>
                    <span className="w-[88px] text-center shrink-0">Record</span>
                    <span className="w-8 text-center shrink-0">GF</span>
                    <span className="w-8 text-center shrink-0">GA</span>
                    <span className="w-8 text-center shrink-0">FA</span>
                    {hasAnyUCL && <span className="w-9 text-center shrink-0">UCL</span>}
                    {hasAnyUEL && <span className="w-9 text-center shrink-0">UEL</span>}
                  </div>
                  {allSeasons.map((s, i) => {
                    const fa = faCupAbbr(s.faCup.exitRound, s.faCup.winner);
                    const ucl = s.ucl?.qualified ? euroAbbr(s.ucl.exitStage, s.ucl.winner) : null;
                    const uel = s.uel?.qualified ? euroAbbr(s.uel.exitStage, s.uel.winner) : null;
                    return (
                      <div key={i} className={`flex items-center text-xs px-3 py-2 min-w-0 ${i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className="w-8 font-bold text-gray-400 shrink-0">S{i + 1}</span>
                        <span className={`w-8 text-center font-black shrink-0 ${s.actualFinish === 1 ? "text-yellow-400" : s.actualFinish <= 4 ? "text-blue-400" : s.actualFinish >= 18 ? "text-red-400" : "text-white"}`}>
                          {ordinal(s.actualFinish)}
                        </span>
                        <span className="w-9 text-center font-bold shrink-0">{s.teamRecord.points}</span>
                        <span className="w-[88px] text-center font-bold shrink-0">
                          <span className="text-emerald-400">{s.teamRecord.wins}W</span>{" "}
                          <span className="text-yellow-400">{s.teamRecord.draws}D</span>{" "}
                          <span className="text-red-400">{s.teamRecord.losses}L</span>
                        </span>
                        <span className="w-8 text-center text-emerald-400 shrink-0">{s.teamRecord.goalsFor}</span>
                        <span className="w-8 text-center text-red-400 shrink-0">{s.teamRecord.goalsAgainst}</span>
                        <span className={`w-8 text-center shrink-0 font-bold ${fa === "W" ? "text-yellow-400" : fa === "F" ? "text-gray-300" : "text-gray-500"}`}>
                          {fa}
                        </span>
                        {hasAnyUCL && (
                          <span className={`w-9 text-center shrink-0 font-bold ${ucl === "W" ? "text-yellow-400" : ucl === "F" || ucl === "SF" ? "text-blue-300" : ucl ? "text-blue-400/60" : "text-gray-700"}`}>
                            {ucl || "-"}
                          </span>
                        )}
                        {hasAnyUEL && (
                          <span className={`w-9 text-center shrink-0 font-bold ${uel === "W" ? "text-yellow-400" : uel === "F" || uel === "SF" ? "text-orange-300" : uel ? "text-orange-400/60" : "text-gray-700"}`}>
                            {uel || "-"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fun Stats */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Fun Stats</div>
                <div className="grid grid-cols-2 gap-2">
                  {funStats.map((f, i) => (
                    <div key={i} className="bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-800/50">
                      <div className="text-sm font-black">{f.value}</div>
                      <div className="text-[10px] text-gray-500">{f.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Records Tab */}
          {tab === "records" && (
            <>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Single-Season Records</div>
                <div className="space-y-2">
                  {singleSeasonRecords.map((r, i) => (
                    <div key={i} className="bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-800/50 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-gray-400">{r.label}</div>
                        <div className="text-[10px] text-gray-600">{r.detail}</div>
                      </div>
                      <div className="text-xl font-black">{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Career Milestones</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label="Best Points Tally" value={`${stats.bestPoints}`} sub={`Season ${stats.bestPointsSeason}`} />
                  <StatBox label="Longest Win Streak" value={`${stats.bestWinStreak}`} sub="consecutive" />
                  <StatBox label="Longest Unbeaten" value={`${stats.bestUnbeaten}`} sub="consecutive" />
                  <StatBox label="Total Goal Diff" value={`${stats.totalGoalsFor - stats.totalGoalsAgainst >= 0 ? "+" : ""}${stats.totalGoalsFor - stats.totalGoalsAgainst}`} />
                </div>
              </div>

              {/* Top Avg Ratings */}
              {topRatings.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Highest Career Avg Rating</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    {topRatings.map((p, i) => (
                      <div key={i} className={`flex items-center text-sm px-4 py-2.5 ${i === 0 ? "bg-yellow-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-yellow-400" : i < 3 ? "text-gray-300" : "text-gray-600"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{p.name}</span>
                        <span className="text-xs text-gray-500 mr-3">{p.appearances} apps</span>
                        <span className={`text-sm font-black ${p.avgRating >= 7.5 ? "text-emerald-400" : p.avgRating >= 7.0 ? "text-yellow-400" : "text-gray-300"}`}>
                          {p.avgRating.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Club Legends */}
              {clubLegends.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Club Legends (2+ Seasons)</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    {clubLegends.map((p, i) => (
                      <div key={i} className={`flex items-center text-sm px-4 py-2.5 ${i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className="flex-1 font-bold">{p.name}</span>
                        <span className="text-xs text-gray-500 mr-3">{p.seasons} seasons</span>
                        <span className="text-xs text-emerald-400 font-bold mr-2">{p.goals}G</span>
                        <span className="text-xs text-blue-400 font-bold">{p.assists}A</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* H2H Tab */}
          {tab === "h2h" && roomPlayers && roomPlayers.length > 1 && (
            <>
              {/* Overall standings across all seasons */}
              {finishComparison.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Who Came Out on Top?</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    <div className="flex items-center text-[9px] font-bold tracking-widest text-gray-600 px-4 py-2 border-b border-gray-800/50 uppercase">
                      <span className="w-6">#</span>
                      <span className="flex-1">Player</span>
                      <span className="w-10 text-center">Avg</span>
                      <span className="w-10 text-center">Best</span>
                      <span className="w-8 text-center">
                        {"\u{1F3C6}"}
                      </span>
                      {allSeasons.map((_, i) => (
                        <span key={i} className="w-8 text-center">S{i + 1}</span>
                      ))}
                    </div>
                    {finishComparison.map((fc, i) => (
                      <div key={i} className={`flex items-center text-xs px-4 py-2 ${i === 0 ? "bg-yellow-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-yellow-400" : "text-gray-600"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{fc.name}</span>
                        <span className="w-10 text-center font-bold">{fc.avgFinish}</span>
                        <span className="w-10 text-center text-emerald-400 font-bold">{ordinal(fc.bestFinish)}</span>
                        <span className="w-8 text-center font-bold text-yellow-400">{fc.titles || "-"}</span>
                        {fc.finishes.map((f, fi) => (
                          <span key={fi} className={`w-8 text-center font-bold ${f === 1 ? "text-yellow-400" : (f ?? 0) <= 4 ? "text-blue-400" : (f ?? 20) >= 18 ? "text-red-400" : "text-gray-400"}`}>
                            {f !== null ? ordinal(f) : "-"}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* H2H Records */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">Your Record vs Each Opponent</div>
                <div className="space-y-2">
                  {h2hRecords.map((r, i) => {
                    const played = r.wins + r.draws + r.losses;
                    const winPct = played > 0 ? Math.round((r.wins / played) * 100) : 0;
                    return (
                      <div key={i} className="bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-800/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">vs {r.name}</span>
                          <span className="text-[10px] text-gray-500">{played} games</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-emerald-400 font-bold">{r.wins}W</span>
                          <span className="text-yellow-400 font-bold">{r.draws}D</span>
                          <span className="text-red-400 font-bold">{r.losses}L</span>
                          <span className="text-gray-500">|</span>
                          <span className="text-gray-400">{r.goalsFor}-{r.goalsAgainst}</span>
                          <span className="ml-auto font-bold">{winPct}% win rate</span>
                        </div>
                        {/* Win/Draw/Loss bar */}
                        {played > 0 && (
                          <div className="flex mt-2 h-1.5 rounded-full overflow-hidden bg-gray-800">
                            {r.wins > 0 && <div className="bg-emerald-500" style={{ width: `${(r.wins / played) * 100}%` }} />}
                            {r.draws > 0 && <div className="bg-yellow-500" style={{ width: `${(r.draws / played) * 100}%` }} />}
                            {r.losses > 0 && <div className="bg-red-500" style={{ width: `${(r.losses / played) * 100}%` }} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Players Tab */}
          {tab === "players" && (
            <>
              {/* All-Time Top Scorers */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">All-Time Top Scorers</div>
                <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-gray-600 px-3 py-2 border-b border-gray-800/50 uppercase">
                    <span className="w-6">#</span>
                    <span className="flex-1">Player</span>
                    <span className="w-10 text-center">App</span>
                    <span className="w-10 text-center">Goals</span>
                    <span className="w-12 text-center">Per Game</span>
                  </div>
                  {topScorers.map((p, i) => (
                    <div key={i} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-yellow-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                      <span className={`w-6 font-black ${i === 0 ? "text-yellow-400" : i < 3 ? "text-gray-300" : "text-gray-600"}`}>{i + 1}</span>
                      <span className="flex-1 font-bold truncate">
                        {p.name}
                        {p.seasons > 1 && <span className="text-[9px] text-gray-600 ml-1">({p.seasons}yr)</span>}
                      </span>
                      <span className="w-10 text-center text-gray-500">{p.appearances}</span>
                      <span className="w-10 text-center font-black text-emerald-400">{p.goals}</span>
                      <span className="w-12 text-center text-gray-400">{p.appearances > 0 ? (p.goals / p.appearances).toFixed(2) : "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* All-Time Top Assisters */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">All-Time Top Assist Providers</div>
                <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-gray-600 px-3 py-2 border-b border-gray-800/50 uppercase">
                    <span className="w-6">#</span>
                    <span className="flex-1">Player</span>
                    <span className="w-10 text-center">App</span>
                    <span className="w-12 text-center">Assists</span>
                    <span className="w-12 text-center">Per Game</span>
                  </div>
                  {topAssisters.map((p, i) => (
                    <div key={i} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-blue-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                      <span className={`w-6 font-black ${i === 0 ? "text-blue-400" : i < 3 ? "text-gray-300" : "text-gray-600"}`}>{i + 1}</span>
                      <span className="flex-1 font-bold truncate">
                        {p.name}
                        {p.seasons > 1 && <span className="text-[9px] text-gray-600 ml-1">({p.seasons}yr)</span>}
                      </span>
                      <span className="w-10 text-center text-gray-500">{p.appearances}</span>
                      <span className="w-12 text-center font-black text-blue-400">{p.assists}</span>
                      <span className="w-12 text-center text-gray-400">{p.appearances > 0 ? (p.assists / p.appearances).toFixed(2) : "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* All-Time Combined G+A */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-2">All-Time Goals + Assists</div>
                <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-gray-600 px-3 py-2 border-b border-gray-800/50 uppercase">
                    <span className="w-6">#</span>
                    <span className="flex-1">Player</span>
                    <span className="w-8 text-center">G</span>
                    <span className="w-8 text-center">A</span>
                    <span className="w-10 text-center">G+A</span>
                    <span className="w-10 text-center">Szns</span>
                  </div>
                  {[...allTimePlayers]
                    .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
                    .slice(0, 10)
                    .map((p, i) => (
                      <div key={i} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-purple-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-purple-400" : i < 3 ? "text-gray-300" : "text-gray-600"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{p.name}</span>
                        <span className="w-8 text-center text-emerald-400 font-bold">{p.goals}</span>
                        <span className="w-8 text-center text-blue-400 font-bold">{p.assists}</span>
                        <span className="w-10 text-center font-black">{p.goals + p.assists}</span>
                        <span className="w-10 text-center text-gray-500">{p.seasons}</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, highlight, small }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`rounded-xl px-3 py-2 border ${highlight ? "bg-yellow-900/20 border-yellow-700/30" : "bg-gray-900/50 border-gray-800/50"}`}>
      <div className={`font-black ${small ? "text-sm" : "text-lg"} ${highlight ? "text-yellow-400" : ""}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
      {sub && <div className="text-[9px] text-gray-600">{sub}</div>}
    </div>
  );
}
