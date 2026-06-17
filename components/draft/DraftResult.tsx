"use client";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { simulateSeason, calculateSeasonOdds } from "@/lib/seasonSimulator";
import type { SeasonResult, SeasonOdds, UCLMatch, UCLResult, FaCupMatch } from "@/lib/seasonSimulator";
import Link from "next/link";
import { getPositionColor, getPositionTextColor } from "./formations";
import type { DraftPlayer } from "@/app/draft/page";
import CareerRecap from "./CareerRecap";

interface Props {
  players: DraftPlayer[];
  onNewRun: () => void;
  onPlayNextSeason?: (season: SeasonResult, players: DraftPlayer[]) => void;
  seasonNumber?: number;
  previousResult?: SeasonResult;
  allSeasonResults?: SeasonResult[];
  formationName?: string;
  isSignedIn?: boolean;
  preComputedSeason?: SeasonResult;
  roomPlayers?: import("@/components/draft/MultiplayerLobby").RoomPlayer[];
  roomCode?: string;
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
  const [open, setOpen] = useState(false);

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

  const closeCount = PL_RECORDS.filter((r, i) => {
    const val = values[i];
    const broken = r.lowerIsBetter ? val < r.record : val > r.record;
    const matched = val === r.record;
    return !broken && !matched && (
      r.lowerIsBetter ? val <= r.record + 3 : val >= r.record - 3
    );
  }).length;

  return (
    <div className="bg-gray-900 rounded-xl mb-4 border border-gray-800/50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-gray-800/40 transition-colors"
      >
        <span className="text-sm">&#127942;</span>
        <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
          PL Records
        </h3>
        <div className="ml-auto flex items-center gap-2">
          {brokenCount > 0 && (
            <span className="text-[10px] font-black text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/30">
              {brokenCount} BROKEN
            </span>
          )}
          {brokenCount === 0 && matchedCount > 0 && (
            <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              {matchedCount} MATCHED
            </span>
          )}
          {brokenCount === 0 && matchedCount === 0 && closeCount > 0 && (
            <span className="text-[10px] font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/30">
              SO CLOSE!
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="space-y-1">
            {PL_RECORDS.map((rec, i) => {
              const val = values[i];
              const broken = rec.lowerIsBetter ? val < rec.record : val > rec.record;
              const matched = val === rec.record;
              const close = !broken && !matched && (
                rec.lowerIsBetter ? val <= rec.record + 3 : val >= rec.record - 3
              );

              return (
                <div
                  key={rec.label}
                  className={`flex flex-wrap items-center gap-2 text-sm py-2 px-2 rounded-lg ${
                    broken
                      ? "bg-yellow-900/20 border border-yellow-600/30"
                      : matched
                        ? "bg-amber-900/15 border border-amber-700/25"
                        : close
                          ? "bg-orange-900/10 border border-orange-700/20"
                          : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium ${broken ? "text-yellow-300" : matched ? "text-amber-300" : close ? "text-orange-300" : "text-gray-400"}`}>
                      {rec.label}
                    </div>
                    <div className="text-[10px] text-gray-600">{rec.holder}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-black tabular-nums ${
                      broken ? "text-yellow-400" :
                      matched ? "text-amber-400" :
                      close ? "text-orange-400" : "text-gray-500"
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
                  {close && (
                    <span className="text-[9px] font-black text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded shrink-0">
                      SO CLOSE!
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
      )}
    </div>
  );
}

// --- Combined schedule for match reveal (interleaves PL + UCL/UEL) ---

type RevealEvent = {
  kind: 'pl';
  match: { opponent: string; isHome: boolean; goalsFor: number; goalsAgainst: number; result: 'W' | 'D' | 'L'; goalScorers: { player: string; minute: number }[]; assistProviders?: { player: string; minute: number }[] };
  week: number;
} | {
  kind: 'ucl';
  match: UCLMatch;
  label: string;
} | {
  kind: 'fa-cup';
  match: { opponent: string; isHome: boolean; goalsFor: number; goalsAgainst: number; result: 'W' | 'D' | 'L'; goalScorers: { player: string; minute: number }[]; assistProviders?: { player: string; minute: number }[] };
  label: string;
} | {
  kind: 'ucl-status';
  text: string;
  subtext: string;
  positive: boolean;
};

function buildSchedule(season: SeasonResult): RevealEvent[] {
  const events: RevealEvent[] = [];
  const euroComp = season.ucl?.qualified ? season.ucl : season.uel?.qualified ? season.uel : null;
  const isUCL = !!season.ucl?.qualified;
  const compPrefix = isUCL ? 'UCL' : 'UEL';

  // FA Cup events — inserted at fixed PL weeks
  const faCupSlots = [3, 8, 14, 20, 28, 36]; // R3, R4, R5, QF, SF placed during season; Final after MW38
  const faCupEvents: RevealEvent[] = season.faCup.matches.map((m, i) => ({
    kind: 'fa-cup' as const,
    match: {
      opponent: m.opponent,
      isHome: false,
      goalsFor: m.goalsFor,
      goalsAgainst: m.goalsAgainst,
      goalScorers: m.goalScorers,
      assistProviders: m.assistProviders,
      result: m.result as 'W' | 'D' | 'L',
    },
    label: `FA Cup ${m.round}`,
  }));

  // Build FA Cup insertion map
  const faCupInsertMap = new Map<number, number>();
  for (let i = 0; i < faCupEvents.length; i++) {
    const round = season.faCup.matches[i];
    if (round.round === 'Final') {
      faCupInsertMap.set(39, (faCupInsertMap.get(39) || 0) + 1); // after MW38
    } else {
      const slot = faCupSlots[i] ?? 38;
      faCupInsertMap.set(slot, (faCupInsertMap.get(slot) || 0) + 1);
    }
  }

  if (!euroComp?.qualified) {
    let fcIdx = 0;
    for (let i = 0; i < 38; i++) {
      const week = i + 1;
      events.push({ kind: 'pl' as const, match: season.matches[i], week });
      const fcCount = faCupInsertMap.get(week) || 0;
      for (let j = 0; j < fcCount && fcIdx < faCupEvents.length; j++) {
        events.push(faCupEvents[fcIdx++]);
      }
    }
    // FA Cup Final after last matchweek
    const fcFinalCount = faCupInsertMap.get(39) || 0;
    for (let j = 0; j < fcFinalCount && fcIdx < faCupEvents.length; j++) {
      events.push(faCupEvents[fcIdx++]);
    }
    return events;
  }

  // Build European competition events in chronological order
  const euroEvents: RevealEvent[] = [];

  for (let i = 0; i < euroComp.leagueMatches.length; i++) {
    euroEvents.push({ kind: 'ucl', match: euroComp.leagueMatches[i], label: `${compPrefix} MD${i + 1}` });
  }

  const ordSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return (s[(v - 20) % 10] || s[v] || s[0]);
  };

  euroEvents.push({
    kind: 'ucl-status',
    text: `League Phase: ${euroComp.leaguePosition}${ordSuffix(euroComp.leaguePosition)}`,
    subtext: euroComp.leaguePosition <= 8
      ? 'Through to Round of 16'
      : euroComp.leaguePosition <= 24
        ? 'Playoff Round next'
        : `Eliminated from ${compPrefix}`,
    positive: euroComp.leaguePosition <= 24,
  });

  for (const tie of euroComp.knockoutTies) {
    if (tie.leg2) {
      euroEvents.push({ kind: 'ucl', match: tie.leg1, label: `${tie.round} — L1` });
      const aggF = tie.leg1.goalsFor + tie.leg2.goalsFor;
      const aggA = tie.leg1.goalsAgainst + tie.leg2.goalsAgainst;
      euroEvents.push({
        kind: 'ucl',
        match: tie.leg2,
        label: `${tie.round} — L2 (${aggF}-${aggA} agg)`,
      });
    } else {
      euroEvents.push({ kind: 'ucl', match: tie.leg1, label: `${compPrefix} FINAL` });
    }
  }

  // Slots: after which PL week each European event is inserted
  const slots: number[] = [];
  // 8 league matchdays + 1 league result = 9 events
  const leagueWeeks = [5, 7, 9, 11, 13, 15, 22, 23];
  for (const w of leagueWeeks) slots.push(w);
  slots.push(23); // league result after MD8

  // Knockout slots
  if (euroComp.leaguePosition <= 24) {
    const needsR32 = euroComp.leaguePosition >= 9;
    const allKoSlotGroups = needsR32
      ? [[25, 26], [28, 29], [31, 32], [34, 35], [38]]
      : [[28, 29], [31, 32], [34, 35], [38]];

    let groupIdx = 0;
    for (const tie of euroComp.knockoutTies) {
      if (groupIdx >= allKoSlotGroups.length) break;
      const group = allKoSlotGroups[groupIdx];
      slots.push(group[0]);
      if (tie.leg2 && group.length > 1) slots.push(group[1]);
      groupIdx++;
    }
  }

  // Build combined schedule
  let euroIdx = 0;
  let fcIdx = 0;
  // Build a map: after PL week X → how many European events
  const insertMap = new Map<number, number>();
  for (const w of slots) {
    insertMap.set(w, (insertMap.get(w) || 0) + 1);
  }

  for (let i = 0; i < 38; i++) {
    const week = i + 1;
    events.push({ kind: 'pl', match: season.matches[i], week });
    // Insert FA Cup round if scheduled here
    const fcCount = faCupInsertMap.get(week) || 0;
    for (let j = 0; j < fcCount && fcIdx < faCupEvents.length; j++) {
      events.push(faCupEvents[fcIdx++]);
    }
    // Insert European competition matches
    const count = insertMap.get(week) || 0;
    for (let j = 0; j < count && euroIdx < euroEvents.length; j++) {
      events.push(euroEvents[euroIdx++]);
    }
  }
  // FA Cup Final after last matchweek
  const fcFinalCount = faCupInsertMap.get(39) || 0;
  for (let j = 0; j < fcFinalCount && fcIdx < faCupEvents.length; j++) {
    events.push(faCupEvents[fcIdx++]);
  }

  return events;
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
  topScorerGoals?: number;
  topAssists?: number;
  cleanSheets?: number;
  goalDifference?: number;
  longestWinStreak?: number;
  longestUnbeatenRun?: number;
  faCupWinner?: boolean;
  uclWinner?: boolean;
  uelWinner?: boolean;
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

export default function DraftResult({ players, onNewRun, onPlayNextSeason, seasonNumber = 1, previousResult, allSeasonResults, formationName, isSignedIn = false, preComputedSeason, roomPlayers, roomCode }: Props) {
  const computedSeason = useMemo(
    () => preComputedSeason ?? simulateSeason(players, undefined, seasonNumber, previousResult?.leagueTable),
    [players, seasonNumber, previousResult, preComputedSeason],
  );
  const season = computedSeason;
  const odds = useMemo(
    () => preComputedSeason ? null : calculateSeasonOdds(players, undefined, seasonNumber, 800),
    [players, seasonNumber, preComputedSeason],
  );
  const [showMatches, setShowMatches] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showUCLTable, setShowUCLTable] = useState(false);
  const [showUELTable, setShowUELTable] = useState(false);
  const [showCareerRecap, setShowCareerRecap] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [statsView, setStatsView] = useState<"pl" | "all">("all");

  // Combined schedule for interleaved PL + UCL reveal
  const schedule = useMemo(() => buildSchedule(season), [season]);
  const totalEvents = schedule.length;

  // Match-by-match reveal
  const [revealedIdx, setRevealedIdx] = useState(0);
  const [seasonComplete, setSeasonComplete] = useState(false);
  const matchListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seasonComplete) return;
    if (revealedIdx < totalEvents) {
      const timer = setTimeout(() => setRevealedIdx(i => i + 1), 900);
      return () => clearTimeout(timer);
    }
    if (revealedIdx >= totalEvents) {
      const timer = setTimeout(() => setSeasonComplete(true), 600);
      return () => clearTimeout(timer);
    }
  }, [revealedIdx, totalEvents, seasonComplete]);

  useEffect(() => {
    if (matchListRef.current) {
      matchListRef.current.scrollTop = matchListRef.current.scrollHeight;
    }
  }, [revealedIdx]);

  const historySaved = useRef(false);
  useEffect(() => {
    if (seasonComplete && !historySaved.current) {
      historySaved.current = true;
      const avgOvr = Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length);
      const plPlayerGoals: Record<string, number> = {};
      const plPlayerAssists: Record<string, number> = {};
      for (const m of season.matches) {
        for (const gs of m.goalScorers) {
          plPlayerGoals[gs.player] = (plPlayerGoals[gs.player] || 0) + 1;
        }
        for (const ap of m.assistProviders) {
          plPlayerAssists[ap.player] = (plPlayerAssists[ap.player] || 0) + 1;
        }
      }
      const topScorerGoals = Object.values(plPlayerGoals).length > 0 ? Math.max(...Object.values(plPlayerGoals)) : 0;
      const topAssists = Object.values(plPlayerAssists).length > 0 ? Math.max(...Object.values(plPlayerAssists)) : 0;
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
        topScorerGoals,
        topAssists,
        cleanSheets: season.awards.goldenGlove.cleanSheets,
        goalDifference: season.teamRecord.goalsFor - season.teamRecord.goalsAgainst,
        longestWinStreak: season.longestWinStreak,
        longestUnbeatenRun: season.longestUnbeatenRun,
        faCupWinner: season.faCup.winner,
        uclWinner: season.ucl?.winner || false,
        uelWinner: season.uel?.winner || false,
      }, isSignedIn);
    }
  }, [seasonComplete, players, season, seasonNumber, isSignedIn]);

  const handleSkip = useCallback(() => {
    setRevealedIdx(totalEvents);
    setSeasonComplete(true);
  }, [totalEvents]);

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const titleMessage = () => {
    const wonUCL = season.ucl?.winner;
    const wonUEL = season.uel?.winner;
    if (season.actualFinish === 1 && wonUCL)
      return { title: "THE TREBLE?!", sub: "League champions AND European champions.", color: "text-yellow-400" };
    if (wonUCL)
      return { title: "EUROPEAN CHAMPIONS", sub: `Champions League winners. Finished ${ordinal(season.actualFinish)} in the league.`, color: "text-blue-400" };
    if (season.actualFinish === 1 && wonUEL)
      return { title: "THE DOUBLE", sub: "League champions AND Europa League winners.", color: "text-yellow-400" };
    if (season.actualFinish === 1)
      return { title: "CHAMPIONS", sub: "TITLE WON. JOB DONE.", color: "text-emerald-400" };
    if (wonUEL)
      return { title: "EUROPA CHAMPIONS", sub: `Europa League winners. Finished ${ordinal(season.actualFinish)} in the league.`, color: "text-orange-400" };
    if (season.actualFinish <= 5)
      return { title: `TOP ${season.actualFinish}`, sub: "Champions League secured.", color: "text-blue-400" };
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
    if (pos <= 5) return "border-l-2 border-l-blue-500";
    if (pos <= 6) return "border-l-2 border-l-emerald-500";
    if (pos >= 18) return "border-l-2 border-l-red-500";
    return "";
  };

  const getLeaguePositionBadge = (pos: number) => {
    if (pos === 1) return "bg-yellow-500/20 text-yellow-400";
    if (pos <= 5) return "bg-blue-500/20 text-blue-400";
    if (pos <= 6) return "bg-emerald-500/20 text-emerald-400";
    if (pos >= 18) return "bg-red-500/20 text-red-400";
    return "text-gray-500";
  };

  // Build a static schedule that interleaves PL matches, FA Cup, and European events
  // (same ordering as the reveal animation)
  const staticSchedule = useMemo(() => {
    const events = buildSchedule(season);
    type StaticEntry =
      | { type: 'pl-header'; week: number; hasEuro: boolean }
      | { type: 'pl'; match: typeof season.matches[0]; week: number }
      | { type: 'fa-cup'; match: { opponent: string; isHome: boolean; goalsFor: number; goalsAgainst: number; result: 'W' | 'D' | 'L'; goalScorers: { player: string; minute: number }[]; assistProviders?: { player: string; minute: number }[] }; label: string; faCupMatch?: FaCupMatch }
      | { type: 'ucl'; match: UCLMatch; label: string }
      | { type: 'ucl-status'; text: string; subtext: string; positive: boolean };
    const entries: StaticEntry[] = [];
    const hasEuro = !!(season.ucl?.qualified || season.uel?.qualified);
    let lastPLWeek = 0;
    for (const event of events) {
      if (event.kind === 'pl') {
        if (event.week !== lastPLWeek) {
          entries.push({ type: 'pl-header', week: event.week, hasEuro });
          lastPLWeek = event.week;
        }
        entries.push({ type: 'pl', match: event.match as typeof season.matches[0], week: event.week });
      } else if (event.kind === 'fa-cup') {
        // Find the matching FaCupMatch for extra info (extraTime, penalties)
        const fcMatch = season.faCup.matches.find(m => `FA Cup ${m.round}` === event.label);
        entries.push({ type: 'fa-cup', match: event.match, label: event.label, faCupMatch: fcMatch });
      } else if (event.kind === 'ucl') {
        entries.push({ type: 'ucl', match: event.match, label: event.label });
      } else if (event.kind === 'ucl-status') {
        entries.push({ type: 'ucl-status', text: event.text, subtext: event.subtext, positive: event.positive });
      }
    }
    return entries;
  }, [season]);

  // --- Match-by-match reveal phase ---
  if (!seasonComplete) {
    const revealedEvents = schedule.slice(0, revealedIdx);
    const revealedPL = revealedEvents.filter((e): e is RevealEvent & { kind: 'pl' } => e.kind === 'pl');
    const plWeek = revealedPL.length;
    const runW = revealedPL.filter(e => e.match.result === 'W').length;
    const runD = revealedPL.filter(e => e.match.result === 'D').length;
    const runL = revealedPL.filter(e => e.match.result === 'L').length;
    const runPts = runW * 3 + runD;
    const runGF = revealedPL.reduce((s, e) => s + e.match.goalsFor, 0);
    const runGA = revealedPL.reduce((s, e) => s + e.match.goalsAgainst, 0);
    const avgOvr = Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length);
    const hasUCL = season.ucl?.qualified;
    const hasUEL = season.uel?.qualified;
    const hasEuro = hasUCL || hasUEL;

    const recentEvents = revealedEvents.slice(-6);

    // Compute live player stats from revealed PL matches
    const liveGoals: Record<string, number> = {};
    const liveAssists: Record<string, number> = {};
    for (const e of revealedPL) {
      for (const gs of e.match.goalScorers) liveGoals[gs.player] = (liveGoals[gs.player] || 0) + 1;
      for (const ap of e.match.assistProviders ?? []) liveAssists[ap.player] = (liveAssists[ap.player] || 0) + 1;
    }

    return (
      <div className="max-w-2xl mx-auto p-4 pb-20">
        {/* Live squad stats */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              {seasonNumber > 1 ? `Season ${seasonNumber} Squad` : "Squad Stats"}
            </h3>
            {plWeek > 0 && (
              <div className="flex gap-3 text-[10px] text-gray-500">
                <span>G</span>
                <span>A</span>
              </div>
            )}
          </div>
          <div className="space-y-0.5">
            {starterPlayers.map((p, i) => {
              const g = liveGoals[p.name] || 0;
              const a = liveAssists[p.name] || 0;
              const scored = g > 0 || a > 0;
              return (
                <div key={i} className={`flex items-center gap-2 text-sm py-1 px-1 rounded transition-colors ${scored ? "bg-emerald-950/20" : ""}`}>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-8 text-center`}>
                    {p.assignedPosition}
                  </span>
                  <span className="flex-1 ml-1 font-medium">{p.name}</span>
                  {plWeek > 0 ? (
                    <>
                      <span className={`w-6 text-right font-black text-xs tabular-nums ${g > 0 ? "text-emerald-400" : "text-gray-700"}`}>{g || "-"}</span>
                      <span className={`w-6 text-right font-black text-xs tabular-nums ${a > 0 ? "text-blue-400" : "text-gray-700"}`}>{a || "-"}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-600 text-[10px] font-medium">{p.clubYear}</span>
                      <span className="font-black text-emerald-400 w-7 text-right">{p.overall}</span>
                    </>
                  )}
                </div>
              );
            })}
            {subPlayers.length > 0 && plWeek > 0 && (
              <>
                <div className="border-t border-gray-800/50 my-1" />
                {subPlayers.map((p, i) => {
                  const g = liveGoals[p.name] || 0;
                  const a = liveAssists[p.name] || 0;
                  return (
                    <div key={`sub-${i}`} className="flex items-center gap-2 text-sm py-1 px-1 opacity-70">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-700 text-white w-8 text-center">SUB</span>
                      <span className="flex-1 ml-1 font-medium text-gray-400">{p.name}</span>
                      <span className={`w-6 text-right font-black text-xs tabular-nums ${g > 0 ? "text-emerald-400" : "text-gray-700"}`}>{g || "-"}</span>
                      <span className={`w-6 text-right font-black text-xs tabular-nums ${a > 0 ? "text-blue-400" : "text-gray-700"}`}>{a || "-"}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800/50 flex justify-between text-xs text-gray-500">
            <span>{plWeek > 0 ? `${plWeek} match${plWeek > 1 ? "es" : ""} played` : "Average OVR"}</span>
            <span className="font-bold text-white">{plWeek > 0 ? `${runW}W ${runD}D ${runL}L · ${runPts}pts` : avgOvr}</span>
          </div>
        </div>

        {/* Pre-Season Odds — shown before matches start */}
        {odds && revealedIdx === 0 && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">&#128202;</span>
            <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              Pre-Season Odds
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className={`text-2xl font-black ${odds.winLeague >= 50 ? "text-yellow-400" : odds.winLeague >= 20 ? "text-emerald-400" : "text-gray-300"}`}>
                {odds.winLeague.toFixed(1)}%
              </div>
              <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mt-0.5">Win League</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className={`text-2xl font-black ${odds.top4 >= 70 ? "text-blue-400" : odds.top4 >= 40 ? "text-emerald-400" : "text-gray-300"}`}>
                {odds.top4.toFixed(1)}%
              </div>
              <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mt-0.5">Top 4</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className={`text-2xl font-black ${odds.top7 >= 80 ? "text-emerald-400" : odds.top7 >= 50 ? "text-emerald-400/70" : "text-gray-300"}`}>
                {odds.top7.toFixed(1)}%
              </div>
              <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mt-0.5">Top 7</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className={`text-2xl font-black ${odds.relegation >= 30 ? "text-red-400" : odds.relegation >= 10 ? "text-orange-400" : "text-gray-300"}`}>
                {odds.relegation.toFixed(1)}%
              </div>
              <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mt-0.5">Relegation</div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-800/50 flex justify-between text-xs text-gray-500">
            <span>Predicted Points</span>
            <span className="font-bold text-white">{odds.avgPoints}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>Predicted Finish</span>
            <span className="font-bold text-white">{ordinal(Math.round(odds.avgFinish))}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>Avg Wins</span>
            <span className="font-bold text-white">{odds.avgWins}/38</span>
          </div>
          {/* Milestone Odds */}
          <div className="mt-3 pt-2 border-t border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Milestone Odds</div>
            <div className="space-y-1.5">
              {[
                { label: "100+ Points (Centurion)", pct: odds.centurion, color: "text-yellow-400" },
                { label: "Unbeaten Season (0 losses)", pct: odds.unbeaten, color: "text-emerald-400" },
                { label: "Perfect Season (38 wins)", pct: odds.perfectSeason, color: "text-purple-400" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400">{m.label}</div>
                    <div className="w-full h-1 bg-gray-800 rounded-full mt-0.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${m.pct > 0 ? "bg-gradient-to-r from-gray-600 to-gray-500" : ""}`}
                        style={{ width: `${Math.min(100, Math.max(m.pct > 0 ? 2 : 0, m.pct))}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-sm font-black w-14 text-right tabular-nums ${m.pct > 0 ? m.color : "text-gray-700"}`}>
                    {m.pct > 0 ? `${m.pct}%` : "0%"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Matchweek header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
            {hasEuro ? `GW ${plWeek}/38` : `Matchweek ${plWeek} / 38`}
            {hasUCL && <span className="text-blue-400 ml-2">+ UCL</span>}
            {hasUEL && !hasUCL && <span className="text-orange-400 ml-2">+ UEL</span>}
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
            style={{ width: `${(revealedIdx / totalEvents) * 100}%` }}
          />
        </div>

        {/* Recent events */}
        <div ref={matchListRef} className="space-y-1 mb-4 max-h-[300px] overflow-y-auto scrollbar-hide">
          {recentEvents.map((event, i) => {
            const isLatest = i === recentEvents.length - 1;

            if (event.kind === 'ucl-status') {
              const isUELStatus = hasUEL && !hasUCL;
              return (
                <div
                  key={`status-${i}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 border transition-all duration-500 ${
                    isLatest ? "scale-[1.01]" : "opacity-70"
                  } ${
                    event.positive
                      ? isUELStatus ? "bg-orange-900/30 border-orange-700/40" : "bg-blue-900/30 border-blue-700/40"
                      : "bg-red-900/20 border-red-700/30"
                  }`}
                >
                  <span className="text-sm">&#9917;</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm ${event.positive ? (isUELStatus ? "text-orange-300" : "text-blue-300") : "text-red-400"}`}>
                      {event.text}
                    </div>
                    <div className="text-[10px] text-gray-500">{event.subtext}</div>
                  </div>
                </div>
              );
            }

            const isEuroEvent = event.kind === 'ucl';
            const isFACup = event.kind === 'fa-cup';
            const isUELEvent = isEuroEvent && event.label.startsWith('UEL');
            const match = event.match;
            const label = event.kind === 'pl' ? `GW${event.week}` : event.label;

            return (
              <div
                key={`${event.kind}-${i}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border transition-all duration-300 ${
                  isLatest
                    ? "bg-gray-800/80 border-gray-700/50 scale-[1.01]"
                    : "bg-gray-900/60 border-gray-800/30 opacity-70"
                } ${
                  isEuroEvent
                    ? isUELEvent ? "border-l-2 border-l-orange-500" : "border-l-2 border-l-blue-500"
                    : isFACup
                      ? "border-l-2 border-l-purple-500"
                      : match.result === "W"
                        ? "border-l-2 border-l-emerald-500"
                        : match.result === "D"
                          ? "border-l-2 border-l-yellow-500"
                          : "border-l-2 border-l-red-500"
                }`}
              >
                <span className={`text-[10px] font-bold w-12 sm:w-14 shrink-0 truncate ${isEuroEvent ? (isUELEvent ? "text-orange-400" : "text-blue-400") : isFACup ? "text-purple-400" : "text-gray-600"}`}>
                  {label}
                </span>
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
                    <div className="text-[11px] text-gray-500 truncate">
                      &#9917; {match.goalScorers.map((g: { player: string; minute: number }) => `${g.player.split(" ").pop()} ${g.minute}'`).join(", ")}
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

        {/* PL Form guide (building up) */}
        {plWeek > 0 && (
          <div className="bg-gray-900 rounded-xl p-3 mb-3 border border-gray-800/50">
            <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-1.5">PL Form</div>
            <div className="flex gap-[3px] flex-wrap">
              {revealedPL.map((e, i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center ${
                    e.match.result === "W"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : e.match.result === "D"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {e.match.result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Running PL stats */}
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
        {/* Champion / UCL Winner / UEL Winner / Relegated Banner */}
        {(season.actualFinish === 1 || season.actualFinish >= 18 || season.ucl?.winner || season.uel?.winner) && (
          <div className={`relative overflow-hidden rounded-xl mb-6 py-8 px-4 text-center ${
            season.ucl?.winner && season.actualFinish === 1
              ? "bg-gradient-to-r from-yellow-900/40 via-blue-600/20 to-yellow-900/40 border border-yellow-600/40"
              : season.ucl?.winner
                ? "bg-gradient-to-r from-blue-900/40 via-blue-600/20 to-blue-900/40 border border-blue-600/40"
                : season.uel?.winner && season.actualFinish === 1
                  ? "bg-gradient-to-r from-yellow-900/40 via-orange-600/20 to-yellow-900/40 border border-yellow-600/40"
                  : season.uel?.winner
                    ? "bg-gradient-to-r from-orange-900/40 via-orange-600/20 to-orange-900/40 border border-orange-600/40"
                    : season.actualFinish === 1
                      ? "bg-gradient-to-r from-yellow-900/40 via-yellow-600/20 to-yellow-900/40 border border-yellow-600/40"
                      : "bg-gradient-to-r from-red-900/40 via-red-600/20 to-red-900/40 border border-red-600/40"
          }`}>
            <div className={`absolute inset-0 ${
              season.ucl?.winner
                ? "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent"
                : season.uel?.winner
                  ? "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent"
                  : season.actualFinish === 1
                    ? "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent"
                    : "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-500/10 via-transparent to-transparent"
            }`} />
            <div className="relative">
              {(season.actualFinish === 1 || season.ucl?.winner || season.uel?.winner) && (
                <div className="text-3xl mb-2">&#9733;</div>
              )}
              <h1 className={`text-4xl font-black tracking-tighter ${
                season.ucl?.winner && season.actualFinish === 1 ? "text-yellow-400" :
                season.ucl?.winner ? "text-blue-300" :
                season.uel?.winner && season.actualFinish === 1 ? "text-yellow-400" :
                season.uel?.winner ? "text-orange-300" :
                season.actualFinish === 1 ? "text-yellow-400" : "text-red-400"
              }`}>
                {season.ucl?.winner && season.actualFinish === 1 ? "THE DOUBLE" :
                 season.ucl?.winner ? "EUROPEAN CHAMPIONS" :
                 season.uel?.winner && season.actualFinish === 1 ? "THE DOUBLE" :
                 season.uel?.winner ? "EUROPA CHAMPIONS" :
                 season.actualFinish === 1 ? "CHAMPIONS" : "RELEGATED"}
              </h1>
              <p className={`text-sm font-medium mt-1 ${
                season.ucl?.winner ? "text-blue-400/70" :
                season.uel?.winner ? "text-orange-400/70" :
                season.actualFinish === 1 ? "text-yellow-500/70" : "text-red-500/70"
              }`}>
                {season.ucl?.winner && season.actualFinish === 1 ? "Premier League + Champions League" :
                 season.ucl?.winner ? "Champions League Winners" :
                 season.uel?.winner && season.actualFinish === 1 ? "Premier League + Europa League" :
                 season.uel?.winner ? "Europa League Winners" :
                 season.actualFinish === 1 ? "Premier League Title Winners" : "Dropped to the Championship"}
              </p>
            </div>
          </div>
        )}

        {/* Finish Cards */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4">
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
        {season.actualFinish > 1 && season.actualFinish < 18 && !season.ucl?.winner && !season.uel?.winner && (
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

        {/* Champions League */}
        {season.ucl?.qualified && (() => {
          const ucl = season.ucl!;
          const uclW = ucl.leagueMatches.filter(m => m.result === 'W').length;
          const uclD = ucl.leagueMatches.filter(m => m.result === 'D').length;
          const uclL = ucl.leagueMatches.filter(m => m.result === 'L').length;
          const uclPts = uclW * 3 + uclD;
          const uclGF = ucl.leagueMatches.reduce((s, m) => s + m.goalsFor, 0);
          const uclGA = ucl.leagueMatches.reduce((s, m) => s + m.goalsAgainst, 0);

          const exitLabel = ucl.winner ? 'WINNER' : ucl.exitStage ? `Out: ${ucl.exitStage}` : '';

          return (
            <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">&#9917;</span>
                <h3 className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">Champions League</h3>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
                  ucl.winner
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : ucl.exitStage === 'Final'
                      ? "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  {exitLabel}
                </span>
              </div>

              {/* UCL Winner Banner */}
              {ucl.winner && (
                <div className="bg-gradient-to-r from-blue-900/40 via-blue-600/20 to-blue-900/40 border border-blue-600/40 rounded-lg py-3 px-4 text-center mb-3">
                  <div className="text-xl font-black text-blue-300">CHAMPIONS OF EUROPE</div>
                </div>
              )}

              {/* League Phase Summary */}
              <div className="mb-3">
                <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">League Phase</div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                  <span className="font-bold text-blue-300">{ordinal(ucl.leaguePosition)}</span>
                  <span className="text-gray-600 hidden sm:inline">|</span>
                  <span className="text-gray-400">{uclW}W {uclD}D {uclL}L</span>
                  <span className="text-gray-600 hidden sm:inline">|</span>
                  <span className="font-bold text-white">{uclPts} pts</span>
                  <span className="text-gray-600 hidden sm:inline">|</span>
                  <span className="text-xs text-gray-500">{uclGF}GF {uclGA}GA</span>
                </div>
              </div>

              {/* League Phase Matches */}
              <div className="space-y-1 mb-3">
                {ucl.leagueMatches.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg ${
                      m.result === "W" ? "bg-emerald-900/20" : m.result === "D" ? "bg-yellow-900/10" : "bg-red-900/20"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-blue-400 w-10 shrink-0">MD{i + 1}</span>
                    <span className="flex-1 font-medium truncate">
                      {m.opponent}
                      <span className="text-gray-600 text-[10px] ml-1">({m.isHome ? "H" : "A"})</span>
                    </span>
                    <span className={`font-black tabular-nums ${m.result === "W" ? "text-emerald-400" : m.result === "D" ? "text-yellow-400" : "text-red-400"}`}>
                      {m.goalsFor}-{m.goalsAgainst}
                    </span>
                  </div>
                ))}
              </div>

              {/* UCL League Table Toggle */}
              <button
                onClick={() => setShowUCLTable(!showUCLTable)}
                className="w-full bg-gray-800/50 rounded-lg p-2.5 mb-3 flex items-center justify-between hover:bg-gray-800/80 transition"
              >
                <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">League Table</span>
                <svg className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${showUCLTable ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {showUCLTable && (
                <div className="mb-3">
                  <div>
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-gray-600 mb-1 px-1 uppercase">
                    <span className="w-5 text-center shrink-0">#</span>
                    <span className="flex-1 ml-1 min-w-0">Club</span>
                    <span className="w-6 text-center shrink-0">W</span>
                    <span className="w-6 text-center shrink-0">D</span>
                    <span className="w-6 text-center shrink-0">L</span>
                    <span className="w-7 text-right shrink-0">GD</span>
                    <span className="w-7 text-right shrink-0">PTS</span>
                  </div>
                  <div className="space-y-0.5">
                    {ucl.leagueTable.slice(0, 36).map((team, i) => {
                      const pos = i + 1;
                      const isTop8 = pos <= 8;
                      const isPlayoff = pos >= 9 && pos <= 24;
                      return (
                        <div
                          key={team.name}
                          className={`flex items-center text-xs py-1 px-1 rounded transition ${
                            team.isPlayer
                              ? "bg-blue-900/30 border border-blue-700/30 font-bold"
                              : isTop8
                                ? "border-l-2 border-l-blue-500"
                                : isPlayoff
                                  ? "border-l-2 border-l-cyan-500/50"
                                  : pos > 24
                                    ? "border-l-2 border-l-red-500/50 opacity-60"
                                    : ""
                          }`}
                        >
                          <span className={`w-5 text-center text-[10px] font-bold shrink-0 ${
                            isTop8 ? "text-blue-400" : isPlayoff ? "text-cyan-400/70" : "text-gray-600"
                          }`}>{pos}</span>
                          <span className={`flex-1 ml-1 truncate min-w-0 ${team.isPlayer ? "text-blue-300" : "text-gray-400"}`}>
                            {team.isPlayer ? "Knowitball FC" : team.name}
                          </span>
                          <span className="w-6 text-center text-gray-600 shrink-0">{team.won}</span>
                          <span className="w-6 text-center text-gray-600 shrink-0">{team.drawn}</span>
                          <span className="w-6 text-center text-gray-600 shrink-0">{team.lost}</span>
                          <span className={`w-7 text-right text-[10px] font-bold shrink-0 ${
                            team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-gray-600"
                          }`}>
                            {team.goalDifference > 0 ? "+" : ""}{team.goalDifference}
                          </span>
                          <span className={`w-7 text-right font-black shrink-0 ${team.isPlayer ? "text-blue-300" : "text-white"}`}>
                            {team.points}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[9px]">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-gray-500">R16</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500/50" /><span className="text-gray-500">Playoff</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500/50" /><span className="text-gray-500">Eliminated</span></div>
                  </div>
                  </div>
                </div>
              )}

              {/* Knockout Results */}
              {ucl.knockoutTies.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Knockout Stage</div>
                  <div className="space-y-2">
                    {ucl.knockoutTies.map((tie, i) => {
                      const isFinal = !tie.leg2;
                      const aggFor = tie.leg1.goalsFor + (tie.leg2?.goalsFor || 0);
                      const aggAgainst = tie.leg1.goalsAgainst + (tie.leg2?.goalsAgainst || 0);

                      return (
                        <div key={i} className={`rounded-lg border px-3 py-2 ${
                          tie.result === 'W' ? "bg-emerald-900/15 border-emerald-700/30" : "bg-red-900/15 border-red-700/30"
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-blue-400 uppercase">{tie.round}</span>
                            <span className={`text-[10px] font-bold ${tie.result === 'W' ? "text-emerald-400" : "text-red-400"}`}>
                              {tie.result === 'W' ? (isFinal ? 'WINNER' : 'ADVANCE') : 'ELIMINATED'}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white mb-1">vs {tie.opponent}</div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                            <span>
                              L1: {tie.leg1.goalsFor}-{tie.leg1.goalsAgainst} ({tie.leg1.isHome ? "H" : "A"})
                            </span>
                            {tie.leg2 && (
                              <>
                                <span>
                                  L2: {tie.leg2.goalsFor}-{tie.leg2.goalsAgainst} ({tie.leg2.isHome ? "H" : "A"})
                                </span>
                                <span className="font-bold text-white">Agg: {aggFor}-{aggAgainst}</span>
                              </>
                            )}
                            {isFinal && (
                              <span>{tie.leg1.goalsFor}-{tie.leg1.goalsAgainst}</span>
                            )}
                            {(tie.leg2?.extraTime || tie.leg1.extraTime) && (
                              <span className="text-yellow-400/70 font-bold">AET</span>
                            )}
                            {(tie.leg2?.penalties || tie.leg1.penalties) && (
                              <span className="text-purple-400/70 font-bold">
                                PEN {(tie.leg2 || tie.leg1).penaltyScore?.player}-{(tie.leg2 || tie.leg1).penaltyScore?.opponent}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Europa League */}
        {season.uel?.qualified && (() => {
          const uel = season.uel!;
          const uelW = uel.leagueMatches.filter(m => m.result === 'W').length;
          const uelD = uel.leagueMatches.filter(m => m.result === 'D').length;
          const uelL = uel.leagueMatches.filter(m => m.result === 'L').length;
          const uelPts = uelW * 3 + uelD;
          const uelGF = uel.leagueMatches.reduce((s, m) => s + m.goalsFor, 0);
          const uelGA = uel.leagueMatches.reduce((s, m) => s + m.goalsAgainst, 0);

          const exitLabel = uel.winner ? 'WINNER' : uel.exitStage ? `Out: ${uel.exitStage}` : '';

          return (
            <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">&#9917;</span>
                <h3 className="text-[10px] font-bold tracking-widest text-orange-400 uppercase">Europa League</h3>
                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
                  uel.winner
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                    : uel.exitStage === 'Final'
                      ? "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  {exitLabel}
                </span>
              </div>

              {/* UEL Winner Banner */}
              {uel.winner && (
                <div className="bg-gradient-to-r from-orange-900/40 via-orange-600/20 to-orange-900/40 border border-orange-600/40 rounded-lg py-3 px-4 text-center mb-3">
                  <div className="text-xl font-black text-orange-300">EUROPA LEAGUE WINNERS</div>
                </div>
              )}

              {/* League Phase Summary */}
              <div className="mb-3">
                <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">League Phase</div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                  <span className="font-bold text-orange-300">{ordinal(uel.leaguePosition)}</span>
                  <span className="text-gray-600 hidden sm:inline">|</span>
                  <span className="text-gray-400">{uelW}W {uelD}D {uelL}L</span>
                  <span className="text-gray-600 hidden sm:inline">|</span>
                  <span className="font-bold text-white">{uelPts} pts</span>
                  <span className="text-gray-600 hidden sm:inline">|</span>
                  <span className="text-xs text-gray-500">{uelGF}GF {uelGA}GA</span>
                </div>
              </div>

              {/* League Phase Matches */}
              <div className="space-y-1 mb-3">
                {uel.leagueMatches.map((m, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg ${
                      m.result === "W" ? "bg-emerald-900/20" : m.result === "D" ? "bg-yellow-900/10" : "bg-red-900/20"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-orange-400 w-10 shrink-0">MD{i + 1}</span>
                    <span className="flex-1 font-medium truncate">
                      {m.opponent}
                      <span className="text-gray-600 text-[10px] ml-1">({m.isHome ? "H" : "A"})</span>
                    </span>
                    <span className={`font-black tabular-nums ${m.result === "W" ? "text-emerald-400" : m.result === "D" ? "text-yellow-400" : "text-red-400"}`}>
                      {m.goalsFor}-{m.goalsAgainst}
                    </span>
                  </div>
                ))}
              </div>

              {/* UEL League Table Toggle */}
              <button
                onClick={() => setShowUELTable(!showUELTable)}
                className="w-full bg-gray-800/50 rounded-lg p-2.5 mb-3 flex items-center justify-between hover:bg-gray-800/80 transition"
              >
                <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">League Table</span>
                <svg className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${showUELTable ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {showUELTable && (
                <div className="mb-3">
                  <div>
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-gray-600 mb-1 px-1 uppercase">
                    <span className="w-5 text-center shrink-0">#</span>
                    <span className="flex-1 ml-1 min-w-0">Club</span>
                    <span className="w-6 text-center shrink-0">W</span>
                    <span className="w-6 text-center shrink-0">D</span>
                    <span className="w-6 text-center shrink-0">L</span>
                    <span className="w-7 text-right shrink-0">GD</span>
                    <span className="w-7 text-right shrink-0">PTS</span>
                  </div>
                  <div className="space-y-0.5">
                    {uel.leagueTable.slice(0, 36).map((team, i) => {
                      const pos = i + 1;
                      const isTop8 = pos <= 8;
                      const isPlayoff = pos >= 9 && pos <= 24;
                      return (
                        <div
                          key={team.name}
                          className={`flex items-center text-xs py-1 px-1 rounded transition ${
                            team.isPlayer
                              ? "bg-orange-900/30 border border-orange-700/30 font-bold"
                              : isTop8
                                ? "border-l-2 border-l-orange-500"
                                : isPlayoff
                                  ? "border-l-2 border-l-amber-500/50"
                                  : pos > 24
                                    ? "border-l-2 border-l-red-500/50 opacity-60"
                                    : ""
                          }`}
                        >
                          <span className={`w-5 text-center text-[10px] font-bold shrink-0 ${
                            isTop8 ? "text-orange-400" : isPlayoff ? "text-amber-400/70" : "text-gray-600"
                          }`}>{pos}</span>
                          <span className={`flex-1 ml-1 truncate min-w-0 ${team.isPlayer ? "text-orange-300" : "text-gray-400"}`}>
                            {team.isPlayer ? "Knowitball FC" : team.name}
                          </span>
                          <span className="w-6 text-center text-gray-600 shrink-0">{team.won}</span>
                          <span className="w-6 text-center text-gray-600 shrink-0">{team.drawn}</span>
                          <span className="w-6 text-center text-gray-600 shrink-0">{team.lost}</span>
                          <span className={`w-7 text-right text-[10px] font-bold shrink-0 ${
                            team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-gray-600"
                          }`}>
                            {team.goalDifference > 0 ? "+" : ""}{team.goalDifference}
                          </span>
                          <span className={`w-7 text-right font-black shrink-0 ${team.isPlayer ? "text-orange-300" : "text-white"}`}>
                            {team.points}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[9px]">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-gray-500">R16</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500/50" /><span className="text-gray-500">Playoff</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500/50" /><span className="text-gray-500">Eliminated</span></div>
                  </div>
                  </div>
                </div>
              )}

              {/* Knockout Results */}
              {uel.knockoutTies.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-gray-600 uppercase mb-2">Knockout Stage</div>
                  <div className="space-y-2">
                    {uel.knockoutTies.map((tie, i) => {
                      const isFinal = !tie.leg2;
                      const aggFor = tie.leg1.goalsFor + (tie.leg2?.goalsFor || 0);
                      const aggAgainst = tie.leg1.goalsAgainst + (tie.leg2?.goalsAgainst || 0);

                      return (
                        <div key={i} className={`rounded-lg border px-3 py-2 ${
                          tie.result === 'W' ? "bg-emerald-900/15 border-emerald-700/30" : "bg-red-900/15 border-red-700/30"
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-orange-400 uppercase">{tie.round}</span>
                            <span className={`text-[10px] font-bold ${tie.result === 'W' ? "text-emerald-400" : "text-red-400"}`}>
                              {tie.result === 'W' ? (isFinal ? 'WINNER' : 'ADVANCE') : 'ELIMINATED'}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-white mb-1">vs {tie.opponent}</div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                            <span>
                              L1: {tie.leg1.goalsFor}-{tie.leg1.goalsAgainst} ({tie.leg1.isHome ? "H" : "A"})
                            </span>
                            {tie.leg2 && (
                              <>
                                <span>
                                  L2: {tie.leg2.goalsFor}-{tie.leg2.goalsAgainst} ({tie.leg2.isHome ? "H" : "A"})
                                </span>
                                <span className="font-bold text-white">Agg: {aggFor}-{aggAgainst}</span>
                              </>
                            )}
                            {isFinal && (
                              <span>{tie.leg1.goalsFor}-{tie.leg1.goalsAgainst}</span>
                            )}
                            {(tie.leg2?.extraTime || tie.leg1.extraTime) && (
                              <span className="text-yellow-400/70 font-bold">AET</span>
                            )}
                            {(tie.leg2?.penalties || tie.leg1.penalties) && (
                              <span className="text-purple-400/70 font-bold">
                                PEN {(tie.leg2 || tie.leg1).penaltyScore?.player}-{(tie.leg2 || tie.leg1).penaltyScore?.opponent}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
          <div>
          <div className="flex items-center text-[10px] font-bold tracking-widest text-gray-600 mb-2 px-1 uppercase">
            <span className="w-7 shrink-0"></span>
            <span className="flex-1 ml-1 min-w-0">Player</span>
            <span className="w-7 text-center shrink-0">APP</span>
            <span className="w-6 text-center shrink-0">G</span>
            <span className="w-6 text-center shrink-0">A</span>
            <span className="w-6 text-center shrink-0">CS</span>
            <span className="w-8 text-center shrink-0">AVG</span>
          </div>
          <div className="space-y-0.5">
            {sortedStats.map((ps, i) => (
              <div key={i} className="flex items-center text-sm py-1.5 px-1 rounded hover:bg-gray-800/50 transition">
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${getPositionColor(ps.assignedPosition)} text-white w-7 text-center shrink-0`}>
                  {ps.assignedPosition}
                </span>
                <span className="flex-1 ml-1 font-medium truncate min-w-0">{ps.name}</span>
                <span className="w-7 text-center text-xs font-bold shrink-0 text-gray-500">
                  {ps.appearances}
                </span>
                <span className={`w-6 text-center text-xs font-bold shrink-0 ${ps.goals > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                  {ps.goals > 0 ? ps.goals : "-"}
                </span>
                <span className={`w-6 text-center text-xs font-bold shrink-0 ${ps.assists > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                  {ps.assists > 0 ? ps.assists : "-"}
                </span>
                <span className={`w-6 text-center text-xs font-bold shrink-0 ${ps.cleanSheets > 0 ? "text-emerald-400" : "text-gray-700"}`}>
                  {ps.cleanSheets > 0 ? ps.cleanSheets : "-"}
                </span>
                <span className={`w-8 text-center text-xs font-bold shrink-0 ${
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
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
        <div className="bg-gray-900 rounded-xl p-3 sm:p-4 mb-4 border border-gray-800/50">
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

          <div>
          <div className="flex items-center text-[10px] font-bold tracking-widest text-gray-600 mb-2 px-1 uppercase">
            <span className="w-6 text-center shrink-0">#</span>
            <span className="flex-1 ml-1 min-w-0">Club</span>
            <span className="w-7 text-center shrink-0">W</span>
            <span className="w-7 text-center shrink-0">D</span>
            <span className="w-7 text-center shrink-0">L</span>
            <span className="w-8 text-right shrink-0">GD</span>
            <span className="w-8 text-right shrink-0">PTS</span>
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
                  <span className={`w-6 text-center text-xs font-bold rounded shrink-0 ${getLeaguePositionBadge(pos)}`}>
                    {pos}
                  </span>
                  <span className={`flex-1 ml-1 truncate min-w-0 ${team.isPlayer ? "text-emerald-400 font-bold" : "text-gray-300"}`}>
                    {team.isPlayer ? "Knowitball FC" : team.name}
                  </span>
                  <span className="w-7 text-center text-gray-500 text-xs shrink-0">{team.won}</span>
                  <span className="w-7 text-center text-gray-500 text-xs shrink-0">{team.drawn}</span>
                  <span className="w-7 text-center text-gray-500 text-xs shrink-0">{team.lost}</span>
                  <span className={`w-8 text-right text-xs font-bold shrink-0 ${
                    team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-gray-500"
                  }`}>
                    {team.goalDifference > 0 ? "+" : ""}{team.goalDifference}
                  </span>
                  <span className={`w-8 text-right font-black shrink-0 ${team.isPlayer ? "text-emerald-400" : "text-white"}`}>
                    {team.points}
                  </span>
                </div>
              );
            })}
          </div>
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
          {staticSchedule.map((entry, idx) => {
            if (entry.type === 'pl-header') {
              return (
                <div key={`hdr-${entry.week}`} className="flex items-center gap-2 py-2 px-1">
                  <div className="h-px flex-1 bg-gray-800" />
                  <span className="text-[10px] font-bold tracking-widest text-gray-600 uppercase">
                    {entry.hasEuro ? 'GW' : 'MW'} {entry.week}/38
                  </span>
                  <div className="h-px flex-1 bg-gray-800" />
                </div>
              );
            }
            if (entry.type === 'pl') {
              const match = entry.match;
              return (
                <div
                  key={`pl-${idx}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-gray-900/80 border border-gray-800/50 hover:bg-gray-800/60 transition"
                >
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
              );
            }
            if (entry.type === 'fa-cup') {
              const match = entry.match;
              const fcm = entry.faCupMatch;
              return (
                <div
                  key={`fa-${idx}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-gray-900/80 border border-gray-800/50 border-l-2 border-l-purple-500 hover:bg-gray-800/60 transition"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                    match.result === "W"
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}>
                    {match.result}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      <span className="text-purple-400 text-xs mr-1.5">{entry.label}</span>
                      {match.opponent}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {match.goalScorers.length > 0 && (
                        <span>{match.goalScorers.map((g) => `${g.player.split(" ").pop()} ${g.minute}'`).join(", ")}</span>
                      )}
                      {fcm?.extraTime && <span className="ml-1 text-purple-400/70">(AET)</span>}
                      {fcm?.penalties && fcm.penaltyScore && (
                        <span className="ml-1 text-purple-400/70">(Pens {fcm.penaltyScore.player}-{fcm.penaltyScore.opponent})</span>
                      )}
                    </div>
                  </div>
                  <div className={`text-lg font-black tabular-nums ${
                    match.result === "W" ? "text-purple-400" : "text-red-400"
                  }`}>
                    {match.goalsFor}-{match.goalsAgainst}
                  </div>
                </div>
              );
            }
            if (entry.type === 'ucl') {
              const match = entry.match;
              const isUEL = entry.label.startsWith('UEL');
              return (
                <div
                  key={`ucl-${idx}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 bg-gray-900/80 border border-gray-800/50 border-l-2 ${isUEL ? 'border-l-orange-500' : 'border-l-blue-500'} hover:bg-gray-800/60 transition`}
                >
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
                      <span className={`text-xs mr-1.5 ${isUEL ? 'text-orange-400' : 'text-blue-400'}`}>{entry.label}</span>
                      {match.opponent}
                      <span className="text-gray-600 text-[10px] ml-1.5">({match.isHome ? "H" : "A"})</span>
                    </div>
                    {match.goalScorers.length > 0 && (
                      <div className="text-[11px] text-gray-500 truncate">
                        {match.goalScorers.map((g) => `${g.player.split(" ").pop()} ${g.minute}'`).join(", ")}
                        {match.extraTime && <span className={`ml-1 ${isUEL ? 'text-orange-400/70' : 'text-blue-400/70'}`}>(AET)</span>}
                        {match.penalties && match.penaltyScore && (
                          <span className={`ml-1 ${isUEL ? 'text-orange-400/70' : 'text-blue-400/70'}`}>(Pens {match.penaltyScore.player}-{match.penaltyScore.opponent})</span>
                        )}
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
              );
            }
            if (entry.type === 'ucl-status') {
              const isUEL = !!(season.uel?.qualified && !season.ucl?.qualified);
              return (
                <div
                  key={`status-${idx}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 border ${
                    entry.positive
                      ? isUEL ? "bg-orange-900/30 border-orange-700/40" : "bg-blue-900/30 border-blue-700/40"
                      : "bg-red-900/20 border-red-700/30"
                  }`}
                >
                  <span className="text-sm">&#9917;</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm ${entry.positive ? (isUEL ? "text-orange-300" : "text-blue-300") : "text-red-400"}`}>
                      {entry.text}
                    </div>
                    <div className="text-[10px] text-gray-500">{entry.subtext}</div>
                  </div>
                </div>
              );
            }
            return null;
          })}
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

      {/* Room Standings */}
      {roomCode && roomPlayers && roomPlayers.length > 1 && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">&#127942;</span>
            <h3 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              Room Standings
            </h3>
            <span className="ml-auto text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {roomCode}
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[320px]">
              <div className="flex items-center text-[9px] font-bold tracking-widest text-gray-600 mb-1.5 px-1 uppercase">
                <span className="w-6 text-center">#</span>
                <span className="flex-1 ml-1.5">Player</span>
                <span className="w-8 text-center">Pts</span>
                <span className="w-8 text-center">W</span>
                <span className="w-8 text-center">D</span>
                <span className="w-8 text-center">L</span>
                <span className="w-10 text-right">GD</span>
              </div>
              <div className="space-y-0.5">
                {[...roomPlayers]
                  .filter(p => p.actual_finish !== null && p.season_result !== null)
                  .sort((a, b) => (a.actual_finish ?? 99) - (b.actual_finish ?? 99))
                  .map((rp, i) => {
                    const record = rp.season_result?.teamRecord;
                    const gd = record ? record.goalsFor - record.goalsAgainst : 0;
                    const isWinner = i === 0;
                    return (
                      <div
                        key={rp.user_id}
                        className={`flex items-center text-sm py-1.5 px-1 rounded transition ${
                          isWinner ? "bg-yellow-900/20 border border-yellow-700/30" : "hover:bg-gray-800/40"
                        }`}
                      >
                        <span className={`w-6 text-center text-xs font-black ${isWinner ? "text-yellow-400" : "text-gray-600"}`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 ml-1.5 font-bold truncate">
                          {rp.display_name}
                          {isWinner && <span className="ml-1 text-yellow-400">&#9733;</span>}
                        </span>
                        <span className="w-8 text-center font-black text-white">{record?.points ?? "-"}</span>
                        <span className="w-8 text-center text-xs text-emerald-400 font-bold">{record?.wins ?? "-"}</span>
                        <span className="w-8 text-center text-xs text-yellow-400 font-bold">{record?.draws ?? "-"}</span>
                        <span className="w-8 text-center text-xs text-red-400 font-bold">{record?.losses ?? "-"}</span>
                        <span className={`w-10 text-right text-xs font-bold ${gd > 0 ? "text-emerald-400" : gd < 0 ? "text-red-400" : "text-gray-500"}`}>
                          {gd > 0 ? "+" : ""}{gd}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Relegated / Sacked message */}
      {season.actualFinish >= 18 && onPlayNextSeason && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-5 mb-4 text-center">
          <div className="text-3xl mb-2">&#128683;</div>
          <h2 className="text-xl font-black text-red-400 mb-1">SACKED</h2>
          <p className="text-sm text-gray-400">
            You were sacked after getting relegated. Better luck next time.
          </p>
        </div>
      )}

      {/* Career Recap button — shown at the end of career (final season or sacked) */}
      {!onPlayNextSeason && seasonNumber > 1 && allSeasonResults && allSeasonResults.length > 0 && (
        <button
          onClick={() => setShowCareerRecap(true)}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 rounded-xl font-bold transition-all shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mb-3"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Career Recap
        </button>
      )}

      {/* Actions */}
      <div className={onPlayNextSeason && season.actualFinish < 18 ? "flex flex-col gap-3" : "grid grid-cols-2 gap-3"}>
        {onPlayNextSeason && season.actualFinish < 18 && (
          <button
            onClick={() => onPlayNextSeason(season, players)}
            className="py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl font-bold transition-all shadow-lg shadow-amber-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            Season {seasonNumber + 1}
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
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
        <button
          onClick={onNewRun}
          className="py-4 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 rounded-xl font-bold transition-all shadow-lg shadow-sky-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          New Draft
        </button>
        </div>
      </div>

      {/* History link */}
      <Link
        href="/draft/history"
        className="block w-full mt-3 py-3 text-center text-sm font-bold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-xl transition"
      >
        View Draft History &rarr;
      </Link>

      {/* Career Recap Modal */}
      {showCareerRecap && allSeasonResults && (
        <CareerRecap
          allSeasons={[...allSeasonResults, season]}
          roomPlayers={roomPlayers}
          onClose={() => setShowCareerRecap(false)}
        />
      )}
    </div>
  );
}
