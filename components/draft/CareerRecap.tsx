"use client";
import { useMemo, useState } from "react";
import type { SeasonResult } from "@/lib/seasonSimulator";
import type { RoomPlayer } from "@/components/draft/MultiplayerLobby";

interface Props {
  allSeasons: SeasonResult[];
  roomPlayers?: RoomPlayer[];
  allRoomPlayerSeasons?: Record<string, SeasonResult[]>;
  onClose: () => void;
  onNewRun?: () => void;
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
  owner?: string;
  position?: string;
  goals: number;
  assists: number;
  cleanSheets: number;
  appearances: number;
  seasons: number;
  bestRating: number;
  bestRatingSeason: number;
  avgRating: number;
}

export default function CareerRecap({ allSeasons, roomPlayers, allRoomPlayerSeasons, onClose, onNewRun }: Props) {
  const [tab, setTab] = useState<"overview" | "records" | "h2h" | "players">("overview");
  const [playerStatsView, setPlayerStatsView] = useState<"all" | "pl">("all");

  const humanTeamNames = useMemo(() => {
    if (!roomPlayers) return new Set<string>();
    return new Set(roomPlayers.map(rp => `${rp.display_name} FC`));
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
    const topFour = allSeasons.filter(r => r.actualFinish <= 5).length;
    const faCups = allSeasons.filter(r => r.faCup.winner).length;
    const leagueCups = allSeasons.filter(r => r.leagueCup.winner).length;
    const uclWins = allSeasons.filter(r => r.ucl?.winner).length;
    const uelWins = allSeasons.filter(r => r.uel?.winner).length;
    const superCups = allSeasons.filter(r => r.superCup?.result === 'W').length;
    const charityShields = allSeasons.filter(r => r.charityShield?.result === 'W').length;

    const bestPoints = Math.max(...allSeasons.map(r => r.teamRecord.points));
    const bestPointsSeason = allSeasons.findIndex(r => r.teamRecord.points === bestPoints) + 1;
    const bestWinStreak = Math.max(...allSeasons.map(r => r.longestWinStreak));
    const bestUnbeaten = Math.max(...allSeasons.map(r => r.longestUnbeatenRun));

    return {
      totalSeasons, totalPoints, avgPoints,
      totalWins, totalDraws, totalLosses,
      totalGoalsFor, totalGoalsAgainst, winRate,
      bestFinish, worstFinish, titles, topFour,
      faCups, leagueCups, uclWins, uelWins, superCups, charityShields,
      bestPoints, bestPointsSeason, bestWinStreak, bestUnbeaten,
    };
  }, [allSeasons]);

  const h2hRecords = useMemo(() => {
    if (!roomPlayers || roomPlayers.length <= 1) return [];
    const records: Record<string, H2HRecord> = {};
    for (const rp of roomPlayers) {
      const teamName = `${rp.display_name} FC`;
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
    const data: { name: string; finishes: (number | null)[]; totalPoints: number; bestFinish: number; titles: number }[] = [];
    for (const rp of roomPlayers) {
      const teamName = `${rp.display_name} FC`;
      const finishes: (number | null)[] = [];
      let totalPoints = 0;
      for (const season of allSeasons) {
        const entry = season.leagueTable.find(t => t.name === teamName);
        if (entry) {
          finishes.push(season.leagueTable.indexOf(entry) + 1);
          totalPoints += entry.points;
        } else {
          finishes.push(null);
        }
      }
      const validFinishes = finishes.filter((f): f is number => f !== null);
      data.push({
        name: rp.display_name,
        finishes,
        totalPoints,
        bestFinish: validFinishes.length > 0 ? Math.min(...validFinishes) : 99,
        titles: validFinishes.filter(f => f === 1).length,
      });
    }
    return data.sort((a, b) => b.totalPoints - a.totalPoints || a.bestFinish - b.bestFinish);
  }, [allSeasons, roomPlayers]);

  const collectAllSeasonSets = () => {
    const sets: { ownerName: string | undefined; seasons: SeasonResult[] }[] = [];
    if (allRoomPlayerSeasons && Object.keys(allRoomPlayerSeasons).length > 0) {
      for (const [ownerName, seasons] of Object.entries(allRoomPlayerSeasons)) {
        sets.push({ ownerName, seasons });
      }
    } else {
      sets.push({ ownerName: undefined, seasons: allSeasons });
    }
    return sets;
  };

  const buildAllTimePlayers = (usePl: boolean) => {
    const map: Record<string, AllTimePlayer> = {};
    const seasonSets = collectAllSeasonSets();

    for (const { ownerName, seasons } of seasonSets) {
      for (let si = 0; si < seasons.length; si++) {
        const season = seasons[si];
        const stats = usePl && season.plPlayerStats ? season.plPlayerStats : season.playerStats;
        for (const ps of stats) {
          const key = ownerName ? `${ps.name}::${ownerName}` : ps.name;
          if (!map[key]) {
            map[key] = { name: ps.name, owner: ownerName, position: ps.assignedPosition, goals: 0, assists: 0, cleanSheets: 0, appearances: 0, seasons: 0, bestRating: 0, bestRatingSeason: 0, avgRating: 0 };
          }
          const p = map[key];
          p.goals += ps.goals;
          p.assists += ps.assists;
          p.cleanSheets += ps.cleanSheets;
          p.appearances += ps.appearances;
          p.seasons++;
          if (!p.position) p.position = ps.assignedPosition;
          if (ps.avgRating > p.bestRating) {
            p.bestRating = ps.avgRating;
            p.bestRatingSeason = si + 1;
            p.position = ps.assignedPosition; // track position from the best-rated season
          }
        }
      }
    }

    for (const p of Object.values(map)) {
      let totalRatingSum = 0;
      for (const { ownerName, seasons } of seasonSets) {
        if (ownerName && ownerName !== p.owner) continue;
        if (!ownerName && p.owner) continue;
        for (const season of seasons) {
          const stats = usePl && season.plPlayerStats ? season.plPlayerStats : season.playerStats;
          const ps = stats.find(s => s.name === p.name);
          if (ps) totalRatingSum += ps.avgRating * ps.appearances;
        }
      }
      p.avgRating = p.appearances > 0 ? Math.round((totalRatingSum / p.appearances) * 10) / 10 : 0;
    }
    return Object.values(map);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allTimePlayers = useMemo(() => buildAllTimePlayers(false), [allSeasons, allRoomPlayerSeasons]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allTimePlayersPL = useMemo(() => buildAllTimePlayers(true), [allSeasons, allRoomPlayerSeasons]);

  const activeAllTime = playerStatsView === "pl" ? allTimePlayersPL : allTimePlayers;

  const bestXI = useMemo(() => {
    const positionSlots: { pos: string; label: string }[] = [
      { pos: "GK", label: "GK" },
      { pos: "LB", label: "LB" }, { pos: "CB", label: "CB" }, { pos: "CB", label: "CB" }, { pos: "RB", label: "RB" },
      { pos: "CM", label: "CM" }, { pos: "CM", label: "CM" }, { pos: "CM", label: "CM" },
      { pos: "LW", label: "LW" }, { pos: "ST", label: "ST" }, { pos: "RW", label: "RW" },
    ];
    const used = new Set<string>();
    const xi: { slot: string; player: AllTimePlayer | null }[] = [];

    for (const slot of positionSlots) {
      const candidates = activeAllTime
        .filter(p => p.position === slot.pos && !used.has(p.owner ? `${p.name}::${p.owner}` : p.name))
        .sort((a, b) => b.bestRating - a.bestRating);
      if (candidates.length > 0) {
        const pick = candidates[0];
        used.add(pick.owner ? `${pick.name}::${pick.owner}` : pick.name);
        xi.push({ slot: slot.label, player: pick });
      } else {
        xi.push({ slot: slot.label, player: null });
      }
    }
    return xi;
  }, [activeAllTime]);

  interface SeasonRecord { name: string; owner?: string; value: number; season: number }

  const buildSeasonRecords = (usePl: boolean) => {
    const goals: SeasonRecord[] = [];
    const assists: SeasonRecord[] = [];
    const cleanSheets: SeasonRecord[] = [];
    const ratings: SeasonRecord[] = [];

    const seasonSets = collectAllSeasonSets();
    for (const { ownerName, seasons } of seasonSets) {
      for (let si = 0; si < seasons.length; si++) {
        const season = seasons[si];
        const stats = usePl && season.plPlayerStats ? season.plPlayerStats : season.playerStats;
        for (const ps of stats) {
          if (ps.goals > 0) goals.push({ name: ps.name, owner: ownerName, value: ps.goals, season: si + 1 });
          if (ps.assists > 0) assists.push({ name: ps.name, owner: ownerName, value: ps.assists, season: si + 1 });
          if (ps.cleanSheets > 0) cleanSheets.push({ name: ps.name, owner: ownerName, value: ps.cleanSheets, season: si + 1 });
          if (ps.appearances >= 10) ratings.push({ name: ps.name, owner: ownerName, value: Math.round(ps.avgRating * 100) / 100, season: si + 1 });
        }
      }
    }

    return {
      goals: goals.sort((a, b) => b.value - a.value).slice(0, 5),
      assists: assists.sort((a, b) => b.value - a.value).slice(0, 5),
      cleanSheets: cleanSheets.sort((a, b) => b.value - a.value).slice(0, 5),
      ratings: ratings.sort((a, b) => b.value - a.value).slice(0, 5),
    };
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seasonRecordsAll = useMemo(() => buildSeasonRecords(false), [allSeasons, allRoomPlayerSeasons]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seasonRecordsPL = useMemo(() => buildSeasonRecords(true), [allSeasons, allRoomPlayerSeasons]);
  const activeSeasonRecords = playerStatsView === "pl" ? seasonRecordsPL : seasonRecordsAll;

  const singleSeasonRecords = useMemo(() => {
    const records: { label: string; value: string; detail: string }[] = [];

    let bestGoals = { name: "", goals: 0, season: 0 };
    let bestAssists = { name: "", assists: 0, season: 0 };
    let bestRating = { name: "", rating: 0, season: 0 };
    let bestCleanSheets = { name: "", cleanSheets: 0, season: 0 };
    let mostGoalsMatch = { opponent: "", goalsFor: 0, goalsAgainst: 0, season: 0 };
    let worstDefeatAll = { opponent: "", goalsFor: 99, goalsAgainst: 0, season: 0 };
    let fewestConceded = { goals: 999, season: 0 };
    let mostPoints = { points: 0, season: 0 };

    for (let si = 0; si < allSeasons.length; si++) {
      const season = allSeasons[si];
      for (const ps of season.playerStats) {
        if (ps.goals > bestGoals.goals) bestGoals = { name: ps.name, goals: ps.goals, season: si + 1 };
        if (ps.assists > bestAssists.assists) bestAssists = { name: ps.name, assists: ps.assists, season: si + 1 };
        if (ps.avgRating > bestRating.rating && ps.appearances >= 10) bestRating = { name: ps.name, rating: ps.avgRating, season: si + 1 };
        if (ps.cleanSheets > bestCleanSheets.cleanSheets) bestCleanSheets = { name: ps.name, cleanSheets: ps.cleanSheets, season: si + 1 };
      }
      const seasonGA = season.teamRecord.goalsAgainst;
      if (seasonGA < fewestConceded.goals) fewestConceded = { goals: seasonGA, season: si + 1 };
      if (season.teamRecord.points > mostPoints.points) mostPoints = { points: season.teamRecord.points, season: si + 1 };
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
    records.push({ label: "Best Avg Rating", value: bestRating.rating > 0 ? bestRating.rating.toFixed(2) : "—", detail: bestRating.name ? `${bestRating.name} (S${bestRating.season})` : "No data" });
    records.push({ label: "Most Clean Sheets", value: `${bestCleanSheets.cleanSheets}`, detail: `${bestCleanSheets.name} (S${bestCleanSheets.season})` });
    if (fewestConceded.season > 0) records.push({ label: "Fewest Goals Conceded", value: `${fewestConceded.goals}`, detail: `Season ${fewestConceded.season}` });
    if (mostPoints.season > 0) records.push({ label: "Most Points", value: `${mostPoints.points}`, detail: `Season ${mostPoints.season}` });
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

  const topScorers = [...activeAllTime].sort((a, b) => b.goals - a.goals).slice(0, 5);
  const topAssisters = [...activeAllTime].sort((a, b) => b.assists - a.assists).slice(0, 5);
  const topRatings = [...activeAllTime].filter(p => p.appearances >= 15).sort((a, b) => b.avgRating - a.avgRating).slice(0, 5);
  const clubLegends = [...activeAllTime].filter(p => p.seasons >= 2).sort((a, b) => b.seasons - a.seasons || (b.goals + b.assists) - (a.goals + a.assists)).slice(0, 5);
  const topCleanSheets = [...activeAllTime].filter(p => p.cleanSheets > 0).sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 5);

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

  const leagueCupAbbr = (exitRound: string | null, winner: boolean): string => {
    if (winner) return "W";
    if (!exitRound) return "-";
    if (exitRound === "Round of 32") return "Ro32";
    if (exitRound === "Round of 16") return "Ro16";
    if (exitRound === "Quarter-Final") return "QF";
    if (exitRound === "Semi-Final") return "SF";
    if (exitRound === "Final") return "F";
    return exitRound;
  };

  const euroAbbr = (exitStage: string | null, winner: boolean): string => {
    if (winner) return "W";
    if (!exitStage) return "-";
    if (exitStage === "League Phase") return "LP";
    if (exitStage === "Round of 32") return "Ro32";
    if (exitStage === "Round of 16") return "Ro16";
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

  const trophyCount = stats.titles + stats.faCups + stats.leagueCups + stats.uclWins + stats.uelWins + stats.superCups + stats.charityShields;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-4 px-3">
      <div className="w-full max-w-2xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 rounded-t-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Career Recap</h2>
            <p className="text-xs text-white">{stats.totalSeasons} seasons completed</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-white transition p-1">
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
                tab === t ? "text-white border-emerald-500" : "text-white border-transparent hover:text-gray-200"
              }`}
            >
              {t === "h2h" ? "vs Friends" : t === "players" ? "Group Statistics" : t.charAt(0).toUpperCase() + t.slice(1)}
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
                    {stats.leagueCups > 0 && (
                      <div className="text-center">
                        <div className="text-3xl mb-1">{"\u{1F3C6}"}</div>
                        <div className="text-xs font-bold text-teal-400">{stats.leagueCups}x League Cup{stats.leagueCups > 1 ? "s" : ""}</div>
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
                    {stats.superCups > 0 && (
                      <div className="text-center">
                        <div className="text-3xl mb-1">{"\u{1F3C5}"}</div>
                        <div className="text-xs font-bold text-amber-400">{stats.superCups}x Super Cup{stats.superCups > 1 ? "s" : ""}</div>
                      </div>
                    )}
                    {stats.charityShields > 0 && (
                      <div className="text-center">
                        <div className="text-3xl mb-1">{"\u{1F3C5}"}</div>
                        <div className="text-xs font-bold text-white">{stats.charityShields}x Charity Shield{stats.charityShields > 1 ? "s" : ""}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Career Numbers */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Career Numbers</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="Total Points" value={`${stats.totalPoints}`} color="purple" />
                  <StatBox label="Avg Points/Season" value={`${stats.avgPoints}`} color="purple" />
                  <StatBox label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 60 ? "green" : stats.winRate >= 40 ? "amber" : "red"} />
                  <div className="rounded-xl px-3 py-2 border bg-gray-900/50 border-gray-800/50 col-span-3">
                    <div className="text-[10px] text-white mb-1.5">Overall Record</div>
                    <div className="flex gap-1.5 items-end">
                      <div className="flex-1 rounded-lg bg-emerald-900/30 border border-emerald-700/30 px-2 py-1.5 text-center">
                        <div className="text-lg font-black text-emerald-400">{stats.totalWins}</div>
                        <div className="text-[9px] text-emerald-400/80 font-bold">WINS</div>
                      </div>
                      <div className="flex-1 rounded-lg bg-yellow-900/30 border border-yellow-700/30 px-2 py-1.5 text-center">
                        <div className="text-lg font-black text-yellow-400">{stats.totalDraws}</div>
                        <div className="text-[9px] text-yellow-400/80 font-bold">DRAWS</div>
                      </div>
                      <div className="flex-1 rounded-lg bg-red-900/30 border border-red-700/30 px-2 py-1.5 text-center">
                        <div className="text-lg font-black text-red-400">{stats.totalLosses}</div>
                        <div className="text-[9px] text-red-400/80 font-bold">LOSSES</div>
                      </div>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full overflow-hidden flex bg-gray-800">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(stats.totalWins / (stats.totalWins + stats.totalDraws + stats.totalLosses) * 100)}%` }} />
                      <div className="bg-yellow-500 h-full" style={{ width: `${(stats.totalDraws / (stats.totalWins + stats.totalDraws + stats.totalLosses) * 100)}%` }} />
                      <div className="bg-red-500 h-full" style={{ width: `${(stats.totalLosses / (stats.totalWins + stats.totalDraws + stats.totalLosses) * 100)}%` }} />
                    </div>
                  </div>
                  <StatBox label="Goals Scored" value={`${stats.totalGoalsFor}`} color="green" />
                  <StatBox label="Goals Conceded" value={`${stats.totalGoalsAgainst}`} color="red" />
                  <StatBox label="Goal Difference" value={`${stats.totalGoalsFor - stats.totalGoalsAgainst >= 0 ? "+" : ""}${stats.totalGoalsFor - stats.totalGoalsAgainst}`} color={stats.totalGoalsFor >= stats.totalGoalsAgainst ? "green" : "red"} />
                  <StatBox label="Best Finish" value={ordinal(stats.bestFinish)} highlight={stats.bestFinish === 1} color={stats.bestFinish <= 5 ? "blue" : "default"} />
                  <StatBox label="Worst Finish" value={ordinal(stats.worstFinish)} color={stats.worstFinish >= 18 ? "red" : "default"} />
                  <StatBox label="Top-5 Finishes" value={`${stats.topFour}/${stats.totalSeasons}`} color="blue" />
                </div>
              </div>

              {/* Season-by-Season */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Season by Season</div>
                <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden overflow-x-auto">
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase min-w-0">
                    <span className="w-8 shrink-0">S</span>
                    <span className="w-8 text-center shrink-0">#</span>
                    <span className="w-9 text-center shrink-0">Pts</span>
                    <span className="w-[88px] text-center shrink-0">Record</span>
                    <span className="w-9 text-center shrink-0">GF</span>
                    <span className="w-9 text-center shrink-0">GA</span>
                    <span className="w-10 text-center shrink-0">FA</span>
                    <span className="w-10 text-center shrink-0">LC</span>
                    {hasAnyUCL && <span className="w-12 text-center shrink-0">UCL</span>}
                    {hasAnyUEL && <span className="w-12 text-center shrink-0">UEL</span>}
                  </div>
                  {allSeasons.map((s, i) => {
                    const fa = faCupAbbr(s.faCup.exitRound, s.faCup.winner);
                    const lc = leagueCupAbbr(s.leagueCup.exitRound, s.leagueCup.winner);
                    const ucl = s.ucl?.qualified ? euroAbbr(s.ucl.exitStage, s.ucl.winner) : null;
                    const uel = s.uel?.qualified ? euroAbbr(s.uel.exitStage, s.uel.winner) : null;
                    return (
                      <div key={i} className={`flex items-center text-xs px-3 py-2 min-w-0 ${i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className="w-8 font-bold text-white shrink-0">S{i + 1}</span>
                        <span className={`w-8 text-center font-black shrink-0 ${s.actualFinish === 1 ? "text-yellow-400" : s.actualFinish <= 5 ? "text-blue-400" : s.actualFinish >= 18 ? "text-red-400" : "text-white"}`}>
                          {ordinal(s.actualFinish)}
                        </span>
                        <span className="w-9 text-center font-bold shrink-0">{s.teamRecord.points}</span>
                        <span className="w-[88px] text-center font-bold shrink-0">
                          <span className="text-emerald-400">{s.teamRecord.wins}W</span>{" "}
                          <span className="text-yellow-400">{s.teamRecord.draws}D</span>{" "}
                          <span className="text-red-400">{s.teamRecord.losses}L</span>
                        </span>
                        <span className="w-9 text-center text-emerald-400 shrink-0">{s.teamRecord.goalsFor}</span>
                        <span className="w-9 text-center text-red-400 shrink-0">{s.teamRecord.goalsAgainst}</span>
                        <span className={`w-10 text-center shrink-0 font-bold ${fa === "W" ? "text-yellow-400" : fa === "F" ? "text-white" : "text-white"}`}>
                          {fa}
                        </span>
                        <span className={`w-10 text-center shrink-0 font-bold ${lc === "W" ? "text-yellow-400" : "text-teal-400"}`}>
                          {lc}
                        </span>
                        {hasAnyUCL && (
                          <span className={`w-12 text-center shrink-0 font-bold ${ucl === "W" ? "text-yellow-400" : ucl === "F" || ucl === "SF" ? "text-blue-300" : ucl ? "text-blue-400/70" : "text-white"}`}>
                            {ucl || "-"}
                          </span>
                        )}
                        {hasAnyUEL && (
                          <span className={`w-12 text-center shrink-0 font-bold ${uel === "W" ? "text-yellow-400" : uel === "F" || uel === "SF" ? "text-orange-300" : uel ? "text-orange-400/70" : "text-white"}`}>
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
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Fun Stats</div>
                <div className="grid grid-cols-2 gap-2">
                  {funStats.map((f, i) => {
                    const colors = [
                      "bg-blue-900/15 border-blue-800/30",
                      "bg-emerald-900/15 border-emerald-800/30",
                      "bg-cyan-900/15 border-cyan-800/30",
                      "bg-purple-900/15 border-purple-800/30",
                      "bg-amber-900/15 border-amber-800/30",
                      "bg-pink-900/15 border-pink-800/30",
                      "bg-teal-900/15 border-teal-800/30",
                      "bg-indigo-900/15 border-indigo-800/30",
                      "bg-orange-900/15 border-orange-800/30",
                    ];
                    const textColors = [
                      "text-blue-400", "text-emerald-400", "text-cyan-400",
                      "text-purple-400", "text-amber-400", "text-pink-400",
                      "text-teal-400", "text-indigo-400", "text-orange-400",
                    ];
                    return (
                      <div key={i} className={`rounded-lg px-3 py-2 border ${colors[i % colors.length]}`}>
                        <div className={`text-sm font-black ${textColors[i % textColors.length]}`}>{f.value}</div>
                        <div className="text-[10px] text-white">{f.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Records Tab */}
          {tab === "records" && (
            <>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Single-Season Records</div>
                <div className="space-y-2">
                  {singleSeasonRecords.map((r, i) => {
                    const accents = [
                      "border-l-yellow-500", "border-l-emerald-500", "border-l-blue-500",
                      "border-l-purple-500", "border-l-cyan-500", "border-l-amber-500",
                      "border-l-pink-500", "border-l-teal-500",
                    ];
                    const valueColors = [
                      "text-yellow-400", "text-emerald-400", "text-blue-400",
                      "text-purple-400", "text-cyan-400", "text-amber-400",
                      "text-pink-400", "text-teal-400",
                    ];
                    return (
                      <div key={i} className={`bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-800/50 border-l-4 ${accents[i % accents.length]} flex items-center justify-between`}>
                        <div>
                          <div className="text-xs font-bold text-white">{r.label}</div>
                          <div className="text-[10px] text-white">{r.detail}</div>
                        </div>
                        <div className={`text-xl font-black ${valueColors[i % valueColors.length]}`}>{r.value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Career Milestones</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatBox label="Best Points Tally" value={`${stats.bestPoints}`} sub={`Season ${stats.bestPointsSeason}`} color="purple" />
                  <StatBox label="Longest Win Streak" value={`${stats.bestWinStreak}`} sub="consecutive" color="green" />
                  <StatBox label="Longest Unbeaten" value={`${stats.bestUnbeaten}`} sub="consecutive" color="blue" />
                  <StatBox label="Total Goal Diff" value={`${stats.totalGoalsFor - stats.totalGoalsAgainst >= 0 ? "+" : ""}${stats.totalGoalsFor - stats.totalGoalsAgainst}`} color={stats.totalGoalsFor >= stats.totalGoalsAgainst ? "green" : "red"} />
                </div>
              </div>

              {/* Top Avg Ratings */}
              {topRatings.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Highest Career Avg Rating</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    {topRatings.map((p, i) => (
                      <div key={i} className={`flex items-center text-sm px-4 py-2.5 ${i === 0 ? "bg-yellow-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-yellow-400" : i < 3 ? "text-white" : "text-white"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{p.name}</span>
                        <span className="text-xs text-white mr-3">{p.appearances} apps</span>
                        <span className={`text-sm font-black ${p.avgRating >= 7.5 ? "text-emerald-400" : p.avgRating >= 7.0 ? "text-yellow-400" : "text-white"}`}>
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
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Club Legends (2+ Seasons)</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    {clubLegends.map((p, i) => (
                      <div key={i} className={`flex items-center text-sm px-4 py-2.5 ${i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className="flex-1 font-bold">{p.name}</span>
                        <span className="text-xs text-white mr-3">{p.seasons} seasons</span>
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
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Who Came Out on Top?</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-x-auto">
                    <div className="min-w-fit">
                      <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                        <span className="w-5 shrink-0">#</span>
                        <span className="w-16 shrink-0">Player</span>
                        <span className="w-8 text-center shrink-0">Pts</span>
                        <span className="w-8 text-center shrink-0">Best</span>
                        <span className="w-6 text-center shrink-0">{"\u{1F3C6}"}</span>
                        {allSeasons.map((_, i) => (
                          <span key={i} className="w-7 text-center shrink-0">S{i + 1}</span>
                        ))}
                      </div>
                      {finishComparison.map((fc, i) => (
                        <div key={i} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-yellow-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                          <span className={`w-5 shrink-0 font-black ${i === 0 ? "text-yellow-400" : "text-white"}`}>{i + 1}</span>
                          <span className="w-16 shrink-0 font-bold truncate">{fc.name}</span>
                          <span className="w-8 text-center font-black shrink-0">{fc.totalPoints}</span>
                          <span className="w-8 text-center text-emerald-400 font-bold shrink-0">{ordinal(fc.bestFinish)}</span>
                          <span className="w-6 text-center font-bold text-yellow-400 shrink-0">{fc.titles || "-"}</span>
                          {fc.finishes.map((f, fi) => (
                            <span key={fi} className={`w-7 text-center font-bold shrink-0 ${f === 1 ? "text-yellow-400" : (f ?? 0) <= 5 ? "text-blue-400" : (f ?? 20) >= 18 ? "text-red-400" : "text-white"}`}>
                              {f !== null ? ordinal(f) : "-"}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* H2H Records */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Your Record vs Each Opponent</div>
                <div className="space-y-2">
                  {h2hRecords.map((r, i) => {
                    const played = r.wins + r.draws + r.losses;
                    const winPct = played > 0 ? Math.round((r.wins / played) * 100) : 0;
                    return (
                      <div key={i} className="bg-gray-900/50 rounded-xl px-4 py-3 border border-gray-800/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">vs {r.name}</span>
                          <span className="text-[10px] text-white">{played} games</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-emerald-400 font-bold">{r.wins}W</span>
                          <span className="text-yellow-400 font-bold">{r.draws}D</span>
                          <span className="text-red-400 font-bold">{r.losses}L</span>
                          <span className="text-white">|</span>
                          <span className="text-white">{r.goalsFor}-{r.goalsAgainst}</span>
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
              {/* PL / All Comps Toggle */}
              <div className="flex items-center gap-1.5 bg-gray-900/50 border border-gray-800/50 rounded-lg p-0.5 w-fit">
                <button
                  onClick={() => setPlayerStatsView("all")}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${
                    playerStatsView === "all"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-white hover:text-gray-200"
                  }`}
                >
                  All Competitions
                </button>
                <button
                  onClick={() => setPlayerStatsView("pl")}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition ${
                    playerStatsView === "pl"
                      ? "bg-purple-600 text-white shadow"
                      : "text-white hover:text-gray-200"
                  }`}
                >
                  Premier League
                </button>
              </div>

              {/* Best XI */}
              {bestXI.some(s => s.player !== null) && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Best XI (Highest Season Rating)</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                      <span className="w-8">Pos</span>
                      <span className="flex-1">Player</span>
                      {allRoomPlayerSeasons && <span className="w-16 text-center">Manager</span>}
                      <span className="w-10 text-center">Season</span>
                      <span className="w-12 text-center">Rating</span>
                    </div>
                    {bestXI.map((s, i) => (
                      <div key={i} className={`flex items-center text-xs px-3 py-2 ${i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className="w-8 font-black text-white">{s.slot}</span>
                        <span className="flex-1 font-bold truncate">{s.player?.name ?? "-"}</span>
                        {allRoomPlayerSeasons && (
                          <span className="w-16 text-center text-[10px] text-white truncate">{s.player?.owner ?? "-"}</span>
                        )}
                        <span className="w-10 text-center text-white">{s.player ? `S${s.player.bestRatingSeason}` : "-"}</span>
                        <span className={`w-12 text-center font-black ${(s.player?.bestRating ?? 0) >= 7.5 ? "text-emerald-400" : (s.player?.bestRating ?? 0) >= 7.0 ? "text-yellow-400" : "text-white"}`}>
                          {s.player ? s.player.bestRating.toFixed(1) : "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Most Goals in a Season */}
              {activeSeasonRecords.goals.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Most Goals in a Season</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                      <span className="w-6">#</span>
                      <span className="flex-1">Player</span>
                      <span className="w-10 text-center">Season</span>
                      <span className="w-10 text-center">Goals</span>
                    </div>
                    {activeSeasonRecords.goals.map((r, i) => (
                      <div key={`${r.name}-${r.season}-${i}`} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-yellow-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-yellow-400" : i < 3 ? "text-white" : "text-white"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{r.name}{r.owner && <span className="text-[9px] text-white ml-1">({r.owner})</span>}</span>
                        <span className="w-10 text-center text-white">S{r.season}</span>
                        <span className="w-10 text-center font-black text-emerald-400">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Most Assists in a Season */}
              {activeSeasonRecords.assists.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Most Assists in a Season</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                      <span className="w-6">#</span>
                      <span className="flex-1">Player</span>
                      <span className="w-10 text-center">Season</span>
                      <span className="w-12 text-center">Assists</span>
                    </div>
                    {activeSeasonRecords.assists.map((r, i) => (
                      <div key={`${r.name}-${r.season}-${i}`} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-blue-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-blue-400" : i < 3 ? "text-white" : "text-white"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{r.name}{r.owner && <span className="text-[9px] text-white ml-1">({r.owner})</span>}</span>
                        <span className="w-10 text-center text-white">S{r.season}</span>
                        <span className="w-12 text-center font-black text-blue-400">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Most Clean Sheets in a Season */}
              {activeSeasonRecords.cleanSheets.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Most Clean Sheets in a Season</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                      <span className="w-6">#</span>
                      <span className="flex-1">Player</span>
                      <span className="w-10 text-center">Season</span>
                      <span className="w-10 text-center">CS</span>
                    </div>
                    {activeSeasonRecords.cleanSheets.map((r, i) => (
                      <div key={`${r.name}-${r.season}-${i}`} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-cyan-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-cyan-400" : i < 3 ? "text-white" : "text-white"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{r.name}{r.owner && <span className="text-[9px] text-white ml-1">({r.owner})</span>}</span>
                        <span className="w-10 text-center text-white">S{r.season}</span>
                        <span className="w-10 text-center font-black text-cyan-400">{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Best Avg Rating in a Season */}
              {activeSeasonRecords.ratings.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Best Avg Rating in a Season</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                      <span className="w-6">#</span>
                      <span className="flex-1">Player</span>
                      <span className="w-10 text-center">Season</span>
                      <span className="w-12 text-center">Rating</span>
                    </div>
                    {activeSeasonRecords.ratings.map((r, i) => (
                      <div key={`${r.name}-${r.season}-${i}`} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-amber-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-amber-400" : i < 3 ? "text-white" : "text-white"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{r.name}{r.owner && <span className="text-[9px] text-white ml-1">({r.owner})</span>}</span>
                        <span className="w-10 text-center text-white">S{r.season}</span>
                        <span className={`w-12 text-center font-black ${r.value >= 7.5 ? "text-emerald-400" : r.value >= 7.0 ? "text-yellow-400" : "text-white"}`}>{r.value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All-Time Top Scorers */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">All-Time Top Scorers</div>
                <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                    <span className="w-6">#</span>
                    <span className="flex-1">Player</span>
                    <span className="w-10 text-center">App</span>
                    <span className="w-10 text-center">Goals</span>
                    <span className="w-12 text-center">Per Game</span>
                  </div>
                  {topScorers.map((p, i) => (
                    <div key={i} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-yellow-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                      <span className={`w-6 font-black ${i === 0 ? "text-yellow-400" : i < 3 ? "text-white" : "text-white"}`}>{i + 1}</span>
                      <span className="flex-1 font-bold truncate">
                        {p.name}
                        {p.owner ? <span className="text-[9px] text-white ml-1">({p.owner})</span> : p.seasons > 1 && <span className="text-[9px] text-white ml-1">({p.seasons}yr)</span>}
                      </span>
                      <span className="w-10 text-center text-white">{p.appearances}</span>
                      <span className="w-10 text-center font-black text-emerald-400">{p.goals}</span>
                      <span className="w-12 text-center text-white">{p.appearances > 0 ? (p.goals / p.appearances).toFixed(2) : "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* All-Time Top Assisters */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">All-Time Top Assist Providers</div>
                <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                    <span className="w-6">#</span>
                    <span className="flex-1">Player</span>
                    <span className="w-10 text-center">App</span>
                    <span className="w-12 text-center">Assists</span>
                    <span className="w-12 text-center">Per Game</span>
                  </div>
                  {topAssisters.map((p, i) => (
                    <div key={i} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-blue-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                      <span className={`w-6 font-black ${i === 0 ? "text-blue-400" : i < 3 ? "text-white" : "text-white"}`}>{i + 1}</span>
                      <span className="flex-1 font-bold truncate">
                        {p.name}
                        {p.owner ? <span className="text-[9px] text-white ml-1">({p.owner})</span> : p.seasons > 1 && <span className="text-[9px] text-white ml-1">({p.seasons}yr)</span>}
                      </span>
                      <span className="w-10 text-center text-white">{p.appearances}</span>
                      <span className="w-12 text-center font-black text-blue-400">{p.assists}</span>
                      <span className="w-12 text-center text-white">{p.appearances > 0 ? (p.assists / p.appearances).toFixed(2) : "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* All-Time Combined G+A */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">All-Time Goals + Assists</div>
                <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                    <span className="w-6">#</span>
                    <span className="flex-1">Player</span>
                    <span className="w-8 text-center">G</span>
                    <span className="w-8 text-center">A</span>
                    <span className="w-10 text-center">G+A</span>
                    <span className="w-10 text-center">Szns</span>
                  </div>
                  {[...allTimePlayers]
                    .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
                    .slice(0, 5)
                    .map((p, i) => (
                      <div key={i} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-purple-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-purple-400" : i < 3 ? "text-white" : "text-white"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{p.name}{p.owner && <span className="text-[9px] text-white ml-1">({p.owner})</span>}</span>
                        <span className="w-8 text-center text-emerald-400 font-bold">{p.goals}</span>
                        <span className="w-8 text-center text-blue-400 font-bold">{p.assists}</span>
                        <span className="w-10 text-center font-black">{p.goals + p.assists}</span>
                        <span className="w-10 text-center text-white">{p.seasons}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* All-Time Clean Sheets */}
              {topCleanSheets.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">All-Time Clean Sheets</div>
                  <div className="bg-gray-900/50 rounded-xl border border-gray-800/50 overflow-hidden">
                    <div className="flex items-center text-[9px] font-bold tracking-widest text-white px-3 py-2 border-b border-gray-800/50 uppercase">
                      <span className="w-6">#</span>
                      <span className="flex-1">Player</span>
                      <span className="w-10 text-center">App</span>
                      <span className="w-10 text-center">CS</span>
                      <span className="w-10 text-center">Szns</span>
                    </div>
                    {topCleanSheets.map((p, i) => (
                      <div key={i} className={`flex items-center text-xs px-3 py-2 ${i === 0 ? "bg-cyan-900/10" : i % 2 === 0 ? "" : "bg-gray-900/30"}`}>
                        <span className={`w-6 font-black ${i === 0 ? "text-cyan-400" : i < 3 ? "text-white" : "text-white"}`}>{i + 1}</span>
                        <span className="flex-1 font-bold truncate">{p.name}{p.owner && <span className="text-[9px] text-white ml-1">({p.owner})</span>}</span>
                        <span className="w-10 text-center text-white">{p.appearances}</span>
                        <span className="w-10 text-center font-black text-cyan-400">{p.cleanSheets}</span>
                        <span className="w-10 text-center text-white">{p.seasons}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 px-5 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Close
          </button>
          {onNewRun && (
            <button
              onClick={onNewRun}
              className="flex-1 py-3 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 rounded-xl font-bold text-sm transition-all shadow-lg shadow-sky-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              New Draft
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type StatColor = "default" | "green" | "red" | "blue" | "yellow" | "amber" | "purple";
const STAT_COLORS: Record<StatColor, { bg: string; border: string; text: string }> = {
  default: { bg: "bg-gray-900/50", border: "border-gray-800/50", text: "" },
  green:   { bg: "bg-emerald-900/20", border: "border-emerald-700/30", text: "text-emerald-400" },
  red:     { bg: "bg-red-900/20", border: "border-red-700/30", text: "text-red-400" },
  blue:    { bg: "bg-blue-900/20", border: "border-blue-700/30", text: "text-blue-400" },
  yellow:  { bg: "bg-yellow-900/20", border: "border-yellow-700/30", text: "text-yellow-400" },
  amber:   { bg: "bg-amber-900/20", border: "border-amber-700/30", text: "text-amber-400" },
  purple:  { bg: "bg-purple-900/20", border: "border-purple-700/30", text: "text-purple-400" },
};

function StatBox({ label, value, sub, highlight, small, color = "default" }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  small?: boolean;
  color?: StatColor;
}) {
  const c = highlight ? STAT_COLORS.yellow : STAT_COLORS[color];
  return (
    <div className={`rounded-xl px-3 py-2 border ${c.bg} ${c.border}`}>
      <div className={`font-black ${small ? "text-sm" : "text-lg"} ${c.text}`}>{value}</div>
      <div className="text-[10px] text-white">{label}</div>
      {sub && <div className="text-[9px] text-white">{sub}</div>}
    </div>
  );
}
