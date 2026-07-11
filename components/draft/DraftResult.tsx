"use client";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { simulateSeason, positionFitness } from "@/lib/seasonSimulator";
import type { SeasonResult, UCLMatch, UCLResult, FaCupMatch, SuperCupResult, CharityShieldResult } from "@/lib/seasonSimulator";
import { XP_AWARDS, FRAME_STYLES } from "@/lib/xp";
import XPPopup from "./XPPopup";
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
  allRoomPlayerSeasons?: Record<string, SeasonResult[]>;
  mode?: "normal" | "prime";
  revealStartTime?: number;
  speedMultiplier?: 0.5 | 1 | 1.5;
  playerTeamName?: string;
  /** True only on the final season of a draft (all 5 seasons played). Gates the
   * "draft complete" XP so it's awarded once per full draft, not per season. */
  isFinalSeason?: boolean;
}

function formatGoalScorers(scorers: { player: string; minute: number }[]): string {
  if (scorers.length === 0) return "";
  const groups = new Map<string, number[]>();
  for (const g of scorers) {
    const lastName = g.player.split(" ").pop() ?? g.player;
    if (!groups.has(lastName)) groups.set(lastName, []);
    groups.get(lastName)!.push(g.minute);
  }
  const sorted = Array.from(groups.entries()).sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
  return sorted.map(([name, mins]) => `${name} ${mins.sort((x, y) => x - y).map(m => `${m}'`).join(", ")}`).join(" • ");
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
        <h3 className="text-[10px] font-bold tracking-widest text-white uppercase">
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
            className={`w-4 h-4 text-white transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
                    <div className={`text-xs font-medium ${broken ? "text-yellow-300" : matched ? "text-amber-300" : close ? "text-orange-300" : "text-white"}`}>
                      {rec.label}
                    </div>
                    <div className="text-[10px] text-white">{rec.holder}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-black tabular-nums ${
                      broken ? "text-yellow-400" :
                      matched ? "text-amber-400" :
                      close ? "text-orange-400" : "text-white"
                    }`}>
                      {val}
                    </span>
                    <span className="text-white text-xs">/</span>
                    <span className="text-white text-xs font-bold tabular-nums w-6 text-right">
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
            <div className="mt-2 pt-2 border-t border-gray-800/50 text-[10px] text-white">
              Win streak &amp; unbeaten run include carry-over from previous season
            </div>
          )}
          {(topPLGoals > 0 || topPLAssists > 0) && (
            <div className="mt-2 pt-2 border-t border-gray-800/50 text-[10px] text-white space-y-0.5">
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
  kind: 'league-cup';
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

  // Charity Shield — first event of the season
  if (season.charityShield?.played) {
    const cs = season.charityShield;
    events.push({
      kind: 'fa-cup' as const,
      match: {
        opponent: cs.opponent,
        isHome: true,
        goalsFor: cs.goalsFor,
        goalsAgainst: cs.goalsAgainst,
        goalScorers: cs.goalScorers,
        assistProviders: cs.assistProviders,
        result: cs.result as 'W' | 'D' | 'L',
      },
      label: 'Charity Shield',
    });
  }

  // Super Cup — before the season
  if (season.superCup?.played) {
    const sc = season.superCup;
    events.push({
      kind: 'fa-cup' as const,
      match: {
        opponent: sc.opponent,
        isHome: true,
        goalsFor: sc.goalsFor,
        goalsAgainst: sc.goalsAgainst,
        goalScorers: sc.goalScorers,
        assistProviders: sc.assistProviders,
        result: sc.result as 'W' | 'D' | 'L',
      },
      label: 'Super Cup',
    });
  }

  const euroComp = season.ucl?.qualified ? season.ucl : season.uel?.qualified ? season.uel : null;
  const isUCL = !!season.ucl?.qualified;
  const compPrefix = isUCL ? 'UCL' : 'UEL';

  // FA Cup events — inserted at fixed PL weeks
  const faCupSlots = [5, 12, 22, 30, 36]; // R32, R16, QF, SF placed during season; Final after MW38
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

  // League Cup events — different weeks to FA Cup
  // Semi-final is 2-legged: slots are [R32, R16, QF, SF-L1, SF-L2, Final]
  const leagueCupSlots = [3, 8, 16, 25, 28, 33]; // R32, R16, QF, SF-L1, SF-L2; Final after MW38
  const leagueCupEvents: RevealEvent[] = [];
  let lcSlotIdx = 0;
  for (const m of season.leagueCup.matches) {
    leagueCupEvents.push({
      kind: 'league-cup' as const,
      match: {
        opponent: m.opponent,
        isHome: m.isHome ?? false,
        goalsFor: m.goalsFor,
        goalsAgainst: m.goalsAgainst,
        goalScorers: m.goalScorers,
        assistProviders: m.assistProviders,
        result: m.result as 'W' | 'D' | 'L',
      },
      label: m.leg2 ? `League Cup ${m.round} (L1)` : `League Cup ${m.round}`,
    });
    lcSlotIdx++;
    if (m.leg2) {
      // Second leg of semi-final
      leagueCupEvents.push({
        kind: 'league-cup' as const,
        match: {
          opponent: m.opponent,
          isHome: m.leg2.isHome,
          goalsFor: m.leg2.goalsFor,
          goalsAgainst: m.leg2.goalsAgainst,
          goalScorers: m.leg2.goalScorers,
          assistProviders: [],
          result: m.result as 'W' | 'D' | 'L',
        },
        label: `League Cup ${m.round} (L2)`,
      });
      lcSlotIdx++;
    }
  }

  const leagueCupInsertMap = new Map<number, number>();
  let lcEvtIdx = 0;
  for (const m of season.leagueCup.matches) {
    if (m.round === 'Final') {
      leagueCupInsertMap.set(39, (leagueCupInsertMap.get(39) || 0) + 1);
      lcEvtIdx++;
    } else if (m.leg2) {
      // Two events for 2-legged semi
      const slot1 = leagueCupSlots[lcEvtIdx] ?? 25;
      const slot2 = leagueCupSlots[lcEvtIdx + 1] ?? 28;
      leagueCupInsertMap.set(slot1, (leagueCupInsertMap.get(slot1) || 0) + 1);
      leagueCupInsertMap.set(slot2, (leagueCupInsertMap.get(slot2) || 0) + 1);
      lcEvtIdx += 2;
    } else {
      const slot = leagueCupSlots[lcEvtIdx] ?? 38;
      leagueCupInsertMap.set(slot, (leagueCupInsertMap.get(slot) || 0) + 1);
      lcEvtIdx++;
    }
  }

  if (!euroComp?.qualified) {
    let fcIdx = 0;
    let lcIdx = 0;
    for (let i = 0; i < 38; i++) {
      const week = i + 1;
      events.push({ kind: 'pl' as const, match: season.matches[i], week });
      const lcCount = leagueCupInsertMap.get(week) || 0;
      for (let j = 0; j < lcCount && lcIdx < leagueCupEvents.length; j++) {
        events.push(leagueCupEvents[lcIdx++]);
      }
      const fcCount = faCupInsertMap.get(week) || 0;
      for (let j = 0; j < fcCount && fcIdx < faCupEvents.length; j++) {
        events.push(faCupEvents[fcIdx++]);
      }
    }
    // Cup Finals after last matchweek
    const lcFinalCount = leagueCupInsertMap.get(39) || 0;
    for (let j = 0; j < lcFinalCount && lcIdx < leagueCupEvents.length; j++) {
      events.push(leagueCupEvents[lcIdx++]);
    }
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

  const roundAbbr = (r: string) => {
    if (r === 'Round of 32') return 'R32';
    if (r === 'Round of 16') return 'R16';
    if (r === 'Quarter-Final') return 'QF';
    if (r === 'Semi-Final') return 'SF';
    if (r === 'Final') return 'FINAL';
    return r;
  };
  for (const tie of euroComp.knockoutTies) {
    if (tie.leg2) {
      euroEvents.push({ kind: 'ucl', match: tie.leg1, label: `${compPrefix} ${roundAbbr(tie.round)} L1` });
      euroEvents.push({ kind: 'ucl', match: tie.leg2, label: `${compPrefix} ${roundAbbr(tie.round)} L2` });
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
  let lcIdx = 0;
  // Build a map: after PL week X → how many European events
  const insertMap = new Map<number, number>();
  for (const w of slots) {
    insertMap.set(w, (insertMap.get(w) || 0) + 1);
  }

  for (let i = 0; i < 38; i++) {
    const week = i + 1;
    events.push({ kind: 'pl', match: season.matches[i], week });
    // Insert League Cup round if scheduled here
    const lcCount = leagueCupInsertMap.get(week) || 0;
    for (let j = 0; j < lcCount && lcIdx < leagueCupEvents.length; j++) {
      events.push(leagueCupEvents[lcIdx++]);
    }
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
  // Cup Finals after last matchweek
  const lcFinalCount = leagueCupInsertMap.get(39) || 0;
  for (let j = 0; j < lcFinalCount && lcIdx < leagueCupEvents.length; j++) {
    events.push(leagueCupEvents[lcIdx++]);
  }
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
  eflCupWinner?: boolean;
  uclWinner?: boolean;
  uelWinner?: boolean;
  superCupWinner?: boolean;
  charityShieldWinner?: boolean;
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

export default function DraftResult({ players, onNewRun, onPlayNextSeason, seasonNumber = 1, previousResult, allSeasonResults, formationName, isSignedIn = false, preComputedSeason, roomPlayers, roomCode, allRoomPlayerSeasons, mode = "normal", revealStartTime, speedMultiplier = 1, playerTeamName, isFinalSeason = false }: Props) {
  const computedSeason = useMemo(
    () => preComputedSeason ?? simulateSeason(players, undefined, seasonNumber, previousResult?.leagueTable, previousResult ?? undefined, playerTeamName),
    [players, seasonNumber, previousResult, preComputedSeason, playerTeamName],
  );
  const season = computedSeason;
  const [showMatches, setShowMatches] = useState(false);
  const [showTable, setShowTable] = useState(true);
  // The redesigned neon table is now the default. The classic renderer is kept
  // below (gated by this flag) so it can be restored by flipping this to false.
  const USE_NEW_LEAGUE_TABLE = true;
  const [showLiveTable, setShowLiveTable] = useState(true);
  const [showUCLTable, setShowUCLTable] = useState(false);
  const [showUELTable, setShowUELTable] = useState(false);
  const [showCareerRecap, setShowCareerRecap] = useState(false);
  const [equippedFrame, setEquippedFrame] = useState("frame_default");
  const [xpPopups, setXpPopups] = useState<{
    id: string;
    title: string;
    xp: number;
    oldLevel: number;
    newLevel: number;
    newRewards: string[];
    newSeasonCards: { name: string; image_url: string | null }[];
  }[]>([]);
  const seasonRewardsRef = useRef<{
    id: string; level: number; card_name: string | null; image_url: string | null;
  }[]>([]);
  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [statsView, setStatsView] = useState<"pl" | "all">("all");

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/profile/progression")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.equippedFrame) setEquippedFrame(data.equippedFrame); })
      .catch(() => {});
    fetch("/api/season-rewards")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.rewards) seasonRewardsRef.current = data.rewards; })
      .catch(() => {});
  }, [isSignedIn]);

  // Combined schedule for interleaved PL + UCL reveal
  const schedule = useMemo(() => buildSchedule(season), [season]);
  const totalEvents = schedule.length;

  // Match-by-match reveal — wall-clock anchored so background tab throttling can't cause drift
  const revealStartRef = useRef<number>(revealStartTime ?? Date.now());
  // If a revealStartTime prop arrives (multiplayer: set when simulation completed), update the anchor
  useEffect(() => {
    if (revealStartTime !== undefined) revealStartRef.current = revealStartTime;
  }, [revealStartTime]);

  const [revealedIdx, setRevealedIdx] = useState(0);
  const [seasonComplete, setSeasonComplete] = useState(false);
  const matchListRef = useRef<HTMLDivElement>(null);

  // Poll every 100ms using real wall-clock time — immune to background-tab setTimeout throttling
  const eventDurationMs = 900 / speedMultiplier;
  useEffect(() => {
    if (seasonComplete) return;
    const tick = () => {
      const elapsed = Date.now() - revealStartRef.current;
      // elapsed may be negative during the pre-reveal buffer — clamp to 0 so nothing shows early
      const idx = Math.max(0, Math.min(totalEvents, Math.floor(elapsed / eventDurationMs)));
      setRevealedIdx(idx);
    };
    tick(); // run immediately in case we need to fast-forward (e.g. tab was backgrounded)
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [seasonComplete, totalEvents, eventDurationMs]);

  useEffect(() => {
    if (!seasonComplete && revealedIdx >= totalEvents) {
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
    // Award XP/objectives/history as soon as the season result is computed — don't gate behind
    // the visual reveal animation finishing, or a player who navigates away mid-animation loses credit
    // for a season that already finished simulating.
    if (!historySaved.current) {
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
        eflCupWinner: season.leagueCup.winner,
        uclWinner: season.ucl?.winner || false,
        uelWinner: season.uel?.winner || false,
        superCupWinner: season.superCup?.result === 'W' || false,
        charityShieldWinner: season.charityShield?.result === 'W' || false,
      }, isSignedIn);

      if (isSignedIn) {
        (async () => {
          const runId = `s${seasonNumber}-${Date.now()}`;
          // Track the user's level as XP is awarded sequentially
          let currentLevel: number | null = null;
          const awardXp = async (eventType: string, ref: string, amount: number) => {
            try {
              const res = await fetch("/api/xp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event_type: eventType, event_ref: ref, xp_amount: amount }),
              });
              const data = await res.json() as { old_level?: number; new_level?: number; new_rewards?: string[]; duplicate?: boolean };
              if (!data.duplicate) {
                if (currentLevel === null && data.old_level) currentLevel = data.old_level;
                if (data.new_level) currentLevel = data.new_level;
              }
              return data;
            } catch { return null; }
          };

          // Award regular milestone XP silently — no popup for these.
          // "draft_complete" is a whole-draft reward: only granted on the final
          // season (all 5 played), not once per season.
          if (isFinalSeason) {
            await awardXp("draft_complete", `draft-${runId}`, XP_AWARDS.draft_complete);
          }
          if (season.actualFinish === 1) {
            await awardXp("draft_win", runId, XP_AWARDS.draft_win);
          }
          if (season.teamRecord.losses === 0) {
            await awardXp("draft_invincible", runId, XP_AWARDS.draft_invincible);
          }

          // Check objectives
          try {
            const competition: "pl_draft" | "cl_draft" = (season.ucl || season.uel) ? "cl_draft" : "pl_draft";

            const winEvents: import("@/lib/objectiveTypes").WinEvent[] = [];
            winEvents.push("pl_complete");
            if (season.actualFinish === 1) winEvents.push("pl_win");
            if (season.actualFinish <= 4) winEvents.push("pl_top4");
            if (season.actualFinish <= 10) winEvents.push("pl_top_half");
            if (season.teamRecord.losses === 0) winEvents.push("unbeaten");
            if (season.faCup.winner) winEvents.push("fa_cup_win");
            if (season.leagueCup.winner) winEvents.push("efl_cup_win");
            if (season.charityShield?.result === "W") winEvents.push("community_shield_win");
            if (season.superCup?.result === "W") winEvents.push("super_cup_win");
            if (season.actualFinish === 1 && season.faCup.winner) winEvents.push("double");
            if (season.ucl) {
              winEvents.push("cl_complete");
              if (season.ucl.knockoutTies.length > 0) { winEvents.push("cl_qualify"); winEvents.push("cl_r16"); }
              const uclExitStages = ["Quarter-Final", "Semi-Final", "Final"];
              if (season.ucl.winner || uclExitStages.slice(1).some(s => s === season.ucl!.exitStage)) winEvents.push("cl_sf");
              if (season.ucl.winner || season.ucl.exitStage === "Final") { winEvents.push("cl_final"); }
              if (season.ucl.winner || uclExitStages.some(s => s === season.ucl!.exitStage)) winEvents.push("cl_qf");
              if (season.ucl.winner) winEvents.push("cl_win");
              if (season.actualFinish === 1 && season.ucl.winner) winEvents.push("treble");
            }
            if (season.uel) {
              if (season.uel.winner) winEvents.push("europa_win");
              if (season.uel.winner || season.uel.exitStage === "Final") winEvents.push("europa_final");
              if (season.uel.winner || season.uel.exitStage === "Final" || season.uel.exitStage === "Semi-Final") winEvents.push("europa_sf");
              if (season.actualFinish === 1 && season.uel.winner) winEvents.push("double");
            }

            const plMatchResults = season.matches.map(m => ({ goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst }));
            const historicalPlMatchResults = (allSeasonResults ?? []).map(s =>
              s.matches.map(m => ({ goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst }))
            );

            const matchResults: { goalsFor: number; goalsAgainst: number }[] = [
              ...plMatchResults,
              ...season.faCup.matches.map(m => ({ goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst })),
              ...season.leagueCup.matches.flatMap(m => [
                { goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst },
                ...(m.leg2 ? [{ goalsFor: m.leg2.goalsFor, goalsAgainst: m.leg2.goalsAgainst }] : []),
              ]),
              ...(season.ucl?.leagueMatches ?? []).map(m => ({ goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst })),
              ...(season.ucl?.knockoutTies ?? []).flatMap(t => [
                { goalsFor: t.leg1.goalsFor, goalsAgainst: t.leg1.goalsAgainst },
                ...(t.leg2 ? [{ goalsFor: t.leg2.goalsFor, goalsAgainst: t.leg2.goalsAgainst }] : []),
              ]),
              ...(season.uel?.leagueMatches ?? []).map(m => ({ goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst })),
              ...(season.uel?.knockoutTies ?? []).flatMap(t => [
                { goalsFor: t.leg1.goalsFor, goalsAgainst: t.leg1.goalsAgainst },
                ...(t.leg2 ? [{ goalsFor: t.leg2.goalsFor, goalsAgainst: t.leg2.goalsAgainst }] : []),
              ]),
            ];

            const objRes = await fetch("/api/objectives/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                competition,
                seasonNumber,
                squad: players.map(p => ({
                  name: p.name,
                  nationality: p.nationality ?? "",
                  club: p.club,
                  assignedPosition: p.assignedPosition,
                  naturalPositions: p.positions,
                  isSub: p.isSub ?? false,
                  age: p.age ?? 0,
                  overall: p.overall ?? 0,
                })),
                playerStats: season.playerStats.map(ps => ({
                  name: ps.name,
                  goals: ps.goals,
                  assists: ps.assists,
                  cleanSheets: ps.cleanSheets,
                })),
                plPlayerStats: season.plPlayerStats.map(ps => ({
                  name: ps.name,
                  goals: ps.goals,
                  assists: ps.assists,
                  cleanSheets: ps.cleanSheets,
                })),
                events: winEvents,
                matchResults,
                plMatchResults,
                historicalPlMatchResults,
              }),
            });
            if (objRes.ok) {
              const objData = await objRes.json();
              const completedObjs = objData.completed as { id: string; xp_reward: number; title: string; card_image_url: string | null; card_name: string | null }[] ?? [];
              const pendingPopups: typeof xpPopups = [];
              for (const obj of completedObjs) {
                const levelBefore = currentLevel ?? 1;
                let newRewards: string[] = [];
                if (obj.xp_reward > 0) {
                  const r = await awardXp(`objective_${obj.id}`, `${runId}_obj_${obj.id}`, obj.xp_reward);
                  newRewards = (!r?.duplicate ? r?.new_rewards : null) ?? [];
                }
                const levelAfter = currentLevel ?? levelBefore;
                const newSeasonCards = seasonRewardsRef.current
                  .filter(sr => sr.level > levelBefore && sr.level <= levelAfter)
                  .map(sr => ({ name: sr.card_name ?? "Season Card", image_url: sr.image_url }));
                pendingPopups.push({
                  id: obj.id,
                  title: obj.title || "Objective Complete!",
                  xp: obj.xp_reward,
                  oldLevel: levelBefore,
                  newLevel: levelAfter,
                  newRewards,
                  newSeasonCards,
                });
              }
              if (pendingPopups.length > 0) {
                setXpPopups(pendingPopups);
                // Nudge the nav's objective notification to refresh immediately.
                try { window.dispatchEvent(new Event("objectives-updated")); } catch { /* ignore */ }
              }
            }
          } catch { /* objectives check is non-critical */ }

          fetch("/api/stats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              drafts_played: 1,
              draft_wins: season.actualFinish === 1 ? 1 : 0,
              draft_invincibles: season.teamRecord.losses === 0 ? 1 : 0,
              total_goals_scored: season.teamRecord.goalsFor,
              seasons_played: 1,
            }),
          }).catch(() => {});
        })();

        // Submit season records to global leaderboard
        (async () => {
          const findOvr = (name: string) => players.find(p => p.name === name)?.overall ?? null;
          const hasDevPlayers = players.some(p => /^Dev\s/i.test(p.name));

          const topBy = (stats: { name: string; goals: number; assists: number; cleanSheets: number; avgRating?: number }[], field: "goals" | "assists" | "cleanSheets") => {
            const best = stats.reduce((a, b) => b[field] > a[field] ? b : a, { name: "", goals: 0, assists: 0, cleanSheets: 0 });
            return { value: best[field], playerName: best.name || null, playerOvr: best.name ? findOvr(best.name) : null };
          };

          const bestAvgRating = (stats: { name: string; avgRating: number }[]) => {
            const best = stats.reduce((a, b) => b.avgRating > a.avgRating ? b : a, { name: "", avgRating: 0 });
            return { value: Math.round(best.avgRating * 10), playerName: best.name || null, playerOvr: best.name ? findOvr(best.name) : null };
          };

          const teamOvr = players.length > 0
            ? Math.round(players.reduce((acc, p) => acc + p.overall, 0) / players.length)
            : null;

          // GK-only clean sheets
          const gkPlStats = season.plPlayerStats.filter(s => s.assignedPosition === "GK");
          const gkAllStats = season.playerStats.filter(s => s.assignedPosition === "GK");

          const faCupWins = season.faCup.matches.filter(m =>
            m.goalsFor > m.goalsAgainst || (m.penalties && m.penaltyScore && m.penaltyScore.player > m.penaltyScore.opponent)
          ).length;
          const leagueCupWins = season.leagueCup.matches.filter(m => m.result === 'W').length;
          const uclWins = (season.ucl?.leagueMatches.filter(m => m.result === "W").length ?? 0)
            + (season.ucl?.knockoutTies.filter(t => t.result === "W").length ?? 0);
          const uelWins = (season.uel?.leagueMatches.filter(m => m.result === "W").length ?? 0)
            + (season.uel?.knockoutTies.filter(t => t.result === "W").length ?? 0);

          const superCupWins = season.superCup?.result === 'W' ? 1 : 0;
          const charityShieldWins = season.charityShield?.result === 'W' ? 1 : 0;
          const allWins = season.teamRecord.wins + faCupWins + leagueCupWins + uclWins + uelWins + superCupWins + charityShieldWins;

          // Biggest win (goal difference) — PL only and all comps
          let plBiggestWin = 0;
          let plBiggestWinScore = "";
          for (const m of season.matches) {
            const diff = m.goalsFor - m.goalsAgainst;
            if (diff > plBiggestWin || (diff === plBiggestWin && m.goalsFor > parseInt(plBiggestWinScore))) {
              plBiggestWin = diff;
              plBiggestWinScore = `${m.goalsFor}-${m.goalsAgainst}`;
            }
          }
          let allBiggestWin = plBiggestWin;
          let allBiggestWinScore = plBiggestWinScore;
          for (const m of season.faCup.matches) {
            const diff = m.goalsFor - m.goalsAgainst;
            if (diff > allBiggestWin) { allBiggestWin = diff; allBiggestWinScore = `${m.goalsFor}-${m.goalsAgainst}`; }
          }
          for (const m of season.leagueCup.matches) {
            const diff = m.goalsFor - m.goalsAgainst;
            if (diff > allBiggestWin) { allBiggestWin = diff; allBiggestWinScore = `${m.goalsFor}-${m.goalsAgainst}`; }
          }
          if (season.ucl) {
            for (const m of season.ucl.leagueMatches) {
              const diff = m.goalsFor - m.goalsAgainst;
              if (diff > allBiggestWin) { allBiggestWin = diff; allBiggestWinScore = `${m.goalsFor}-${m.goalsAgainst}`; }
            }
            for (const t of season.ucl.knockoutTies) {
              const diff1 = t.leg1.goalsFor - t.leg1.goalsAgainst;
              if (diff1 > allBiggestWin) { allBiggestWin = diff1; allBiggestWinScore = `${t.leg1.goalsFor}-${t.leg1.goalsAgainst}`; }
              if (t.leg2) {
                const diff2 = t.leg2.goalsFor - t.leg2.goalsAgainst;
                if (diff2 > allBiggestWin) { allBiggestWin = diff2; allBiggestWinScore = `${t.leg2.goalsFor}-${t.leg2.goalsAgainst}`; }
              }
            }
          }
          if (season.uel) {
            for (const m of season.uel.leagueMatches) {
              const diff = m.goalsFor - m.goalsAgainst;
              if (diff > allBiggestWin) { allBiggestWin = diff; allBiggestWinScore = `${m.goalsFor}-${m.goalsAgainst}`; }
            }
            for (const t of season.uel.knockoutTies) {
              const diff1 = t.leg1.goalsFor - t.leg1.goalsAgainst;
              if (diff1 > allBiggestWin) { allBiggestWin = diff1; allBiggestWinScore = `${t.leg1.goalsFor}-${t.leg1.goalsAgainst}`; }
              if (t.leg2) {
                const diff2 = t.leg2.goalsFor - t.leg2.goalsAgainst;
                if (diff2 > allBiggestWin) { allBiggestWin = diff2; allBiggestWinScore = `${t.leg2.goalsFor}-${t.leg2.goalsAgainst}`; }
              }
            }
          }

          // All-comps goals conceded: PL + FA Cup + League Cup + UCL/UEL
          const faCupGoalsAgainst = season.faCup.matches.reduce((sum, m) => sum + m.goalsAgainst, 0);
          const leagueCupGoalsAgainst = season.leagueCup.matches.reduce((sum, m) => sum + m.goalsAgainst + (m.leg2?.goalsAgainst ?? 0), 0);
          const uclGoalsAgainst = (season.ucl?.leagueMatches.reduce((s, m) => s + m.goalsAgainst, 0) ?? 0)
            + (season.ucl?.knockoutTies.reduce((s, t) => s + t.leg1.goalsAgainst + (t.leg2?.goalsAgainst ?? 0), 0) ?? 0);
          const uelGoalsAgainst = (season.uel?.leagueMatches.reduce((s, m) => s + m.goalsAgainst, 0) ?? 0)
            + (season.uel?.knockoutTies.reduce((s, t) => s + t.leg1.goalsAgainst + (t.leg2?.goalsAgainst ?? 0), 0) ?? 0);
          const allGoalsAgainst = season.teamRecord.goalsAgainst + faCupGoalsAgainst + leagueCupGoalsAgainst + uclGoalsAgainst + uelGoalsAgainst;

          // Career stats: accumulate across all seasons
          const careerGoalMap = new Map<string, { goals: number; assists: number; ovr: number | null; totalRating: number; matchCount: number }>();
          for (const s of allSeasonResults ?? []) {
            for (const ps of s.playerStats) {
              const prev = careerGoalMap.get(ps.name) ?? { goals: 0, assists: 0, ovr: null, totalRating: 0, matchCount: 0 };
              careerGoalMap.set(ps.name, {
                goals: prev.goals + ps.goals,
                assists: prev.assists + ps.assists,
                ovr: null,
                totalRating: prev.totalRating + ps.avgRating * ps.appearances,
                matchCount: prev.matchCount + ps.appearances,
              });
            }
          }
          for (const ps of season.playerStats) {
            const prev = careerGoalMap.get(ps.name) ?? { goals: 0, assists: 0, ovr: null, totalRating: 0, matchCount: 0 };
            careerGoalMap.set(ps.name, {
              goals: prev.goals + ps.goals,
              assists: prev.assists + ps.assists,
              ovr: findOvr(ps.name),
              totalRating: prev.totalRating + ps.avgRating * ps.appearances,
              matchCount: prev.matchCount + ps.appearances,
            });
          }

          let topCareerGoals = 0, topCareerScorer = "", topCareerGoalsOvr: number | null = null;
          let topCareerAssists = 0, topCareerAssister = "", topCareerAssistsOvr: number | null = null;
          let topCareerAvgRating = 0, topCareerRatingPlayer = "", topCareerRatingOvr: number | null = null;
          Array.from(careerGoalMap.entries()).forEach(([name, data]) => {
            if (data.goals > topCareerGoals) {
              topCareerGoals = data.goals; topCareerScorer = name; topCareerGoalsOvr = data.ovr;
            }
            if (data.assists > topCareerAssists) {
              topCareerAssists = data.assists; topCareerAssister = name; topCareerAssistsOvr = data.ovr;
            }
            if (data.matchCount > 0) {
              const avg = data.totalRating / data.matchCount;
              if (avg > topCareerAvgRating) {
                topCareerAvgRating = avg; topCareerRatingPlayer = name; topCareerRatingOvr = data.ovr;
              }
            }
          });

          // Career trophies: PL title + FA Cup + League Cup + UCL + UEL across all seasons
          const countTrophies = (s: SeasonResult) =>
            (s.actualFinish === 1 ? 1 : 0) +
            (s.faCup.winner ? 1 : 0) +
            (s.leagueCup?.winner ? 1 : 0) +
            (s.ucl?.winner ? 1 : 0) +
            (s.uel?.winner ? 1 : 0) +
            (s.superCup?.result === 'W' ? 1 : 0) +
            (s.charityShield?.result === 'W' ? 1 : 0);
          const totalTrophies = [...(allSeasonResults ?? []), season].reduce((sum, s) => sum + countTrophies(s), 0);

          await fetch("/api/draft/records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              hasDevPlayers,
              mode,
              pl: {
                wins: { value: season.teamRecord.wins, teamOvr },
                unbeaten: { value: season.longestUnbeatenRun, teamOvr },
                goals: topBy(season.plPlayerStats, "goals"),
                assists: topBy(season.plPlayerStats, "assists"),
                cleanSheets: topBy(gkPlStats.length > 0 ? gkPlStats : season.plPlayerStats, "cleanSheets"),
                goalsConceded: { value: season.teamRecord.goalsAgainst, teamOvr },
                biggestWin: { value: plBiggestWin, teamOvr, score: plBiggestWinScore || undefined },
                avgRating: bestAvgRating(season.plPlayerStats),
                mostPoints: { value: season.teamRecord.points, teamOvr },
              },
              all: {
                wins: { value: allWins, teamOvr },
                unbeaten: { value: season.longestUnbeatenRun, teamOvr },
                goals: topBy(season.playerStats, "goals"),
                assists: topBy(season.playerStats, "assists"),
                cleanSheets: topBy(gkAllStats.length > 0 ? gkAllStats : season.playerStats, "cleanSheets"),
                goalsConceded: { value: allGoalsAgainst, teamOvr },
                biggestWin: { value: allBiggestWin, teamOvr, score: allBiggestWinScore || undefined },
                avgRating: bestAvgRating(season.playerStats),
                squadOvr: { value: teamOvr ?? 0, teamOvr },
              },
              career: {
                goals: { value: topCareerGoals, playerName: topCareerScorer || null, playerOvr: topCareerGoalsOvr },
                assists: { value: topCareerAssists, playerName: topCareerAssister || null, playerOvr: topCareerAssistsOvr },
                trophies: totalTrophies,
                avgRating: { value: Math.round(topCareerAvgRating * 10), playerName: topCareerRatingPlayer || null, playerOvr: topCareerRatingOvr },
              },
              seasonNumber,
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const body = await res.json().catch(() => null);
                console.error("Failed to save draft records:", res.status, body?.error);
              }
            })
            .catch((err) => console.error("Failed to save draft records:", err));
        })();
      }
    }
  }, [players, season, seasonNumber, isSignedIn]);

  const handleSkip = useCallback(() => {
    // Push anchor far into the past so the interval also computes idx = totalEvents
    revealStartRef.current = Date.now() - totalEvents * eventDurationMs - 1000;
    setRevealedIdx(totalEvents);
    setSeasonComplete(true);
  }, [totalEvents, eventDurationMs]);

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
      return { title: "MID-TABLE", sub: "Safe but unremarkable.", color: "text-white" };
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

  const displayRating = useCallback((p: DraftPlayer) => {
    const fitness = positionFitness(p);
    if (fitness >= 1.0) return p.overall.toString();
    return (Math.round(p.overall * fitness * 10) / 10).toFixed(1);
  }, []);

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

  // Compute actual qualification spots accounting for cup winners displacing PL spots
  const tableQualification = useMemo(() => {
    const table = season.leagueTable;
    const n = table.length;
    // Base: positions 1-5 UCL, 6-7 UEL, bottom 3 relegated (20-team league)
    const clNames = new Set<string>(table.slice(0, 5).map(t => t.name));
    // pl6, pl7 are the two PL-based UEL slots (may be displaced by cup winners)
    const plUelSlots = [table[5]?.name, table[6]?.name].filter(Boolean) as string[];
    const uelNames = new Set<string>(plUelSlots);
    const relegNames = new Set<string>(table.slice(Math.max(n - 3, 0)).map(t => t.name));

    // Track how many PL UEL slots get displaced (lowest first: index 2 = 7th, then 1 = 6th)
    let displaced = 0;
    const faCupWinner = season.faCup.faCupWinner;
    const lcWinner = season.leagueCup.faCupWinner;
    const cupWinnersGrantingEL = new Set<string>();

    const faCupPos = table.findIndex(t => t.name === faCupWinner) + 1;
    if (faCupWinner && faCupPos > 7) {
      cupWinnersGrantingEL.add(faCupWinner);
      displaced++;
    }
    const lcPos = table.findIndex(t => t.name === lcWinner) + 1;
    if (lcWinner && lcWinner !== faCupWinner && lcPos > 7) {
      cupWinnersGrantingEL.add(lcWinner);
      displaced++;
    }

    // Remove displaced PL slots from the bottom up (7th first, then 6th)
    for (let i = 0; i < displaced; i++) {
      const removeIdx = plUelSlots.length - 1 - i;
      if (removeIdx >= 0) uelNames.delete(plUelSlots[removeIdx]);
    }
    // Add cup winners
    cupWinnersGrantingEL.forEach(name => uelNames.add(name));

    return { clNames, uelNames, relegNames };
  }, [season.leagueTable, season.faCup.faCupWinner, season.leagueCup.faCupWinner]);

  const getLeaguePositionStyle = (pos: number, teamName: string) => {
    if (pos === 1) return "border-l-2 border-l-yellow-500";
    if (tableQualification.clNames.has(teamName)) return "border-l-2 border-l-blue-500";
    if (tableQualification.uelNames.has(teamName)) return "border-l-2 border-l-orange-500";
    if (tableQualification.relegNames.has(teamName)) return "border-l-2 border-l-red-500";
    return "";
  };

  const getLeaguePositionBadge = (pos: number, teamName: string) => {
    if (pos === 1) return "bg-yellow-500/20 text-yellow-400";
    if (tableQualification.clNames.has(teamName)) return "bg-blue-500/20 text-blue-400";
    if (tableQualification.uelNames.has(teamName)) return "bg-orange-500/20 text-orange-400";
    if (tableQualification.relegNames.has(teamName)) return "bg-red-500/20 text-red-400";
    return "text-white";
  };

  // Build a static schedule that interleaves PL matches, FA Cup, and European events
  // (same ordering as the reveal animation)
  const staticSchedule = useMemo(() => {
    const events = buildSchedule(season);
    type StaticEntry =
      | { type: 'pl-header'; week: number; hasEuro: boolean }
      | { type: 'pl'; match: typeof season.matches[0]; week: number }
      | { type: 'fa-cup'; match: { opponent: string; isHome: boolean; goalsFor: number; goalsAgainst: number; result: 'W' | 'D' | 'L'; goalScorers: { player: string; minute: number }[]; assistProviders?: { player: string; minute: number }[] }; label: string; faCupMatch?: FaCupMatch }
      | { type: 'league-cup'; match: { opponent: string; isHome: boolean; goalsFor: number; goalsAgainst: number; result: 'W' | 'D' | 'L'; goalScorers: { player: string; minute: number }[]; assistProviders?: { player: string; minute: number }[] }; label: string; faCupMatch?: FaCupMatch }
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
      } else if (event.kind === 'league-cup') {
        const lcMatch = season.leagueCup.matches.find(m => `League Cup ${m.round}` === event.label);
        entries.push({ type: 'league-cup', match: event.match, label: event.label, faCupMatch: lcMatch });
      } else if (event.kind === 'fa-cup') {
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
    // Live running average rating computed from revealed PL matches
    const liveAvgRatings: Record<string, { total: number; count: number }> = {};
    for (const e of revealedPL) {
      const base = e.match.result === 'W' ? 7.2 : e.match.result === 'D' ? 6.8 : 6.2;
      const isCS = e.match.goalsAgainst === 0;
      for (const p of players.filter(pp => !pp.isSub)) {
        const goals = e.match.goalScorers.filter(g => g.player === p.name).length;
        const assists = (e.match.assistProviders ?? []).filter(a => a.player === p.name).length;
        let r = base + goals * 1.5 + assists * 0.8;
        const isDefensive = ['GK','CB','LB','RB','LWB','RWB'].includes(p.assignedPosition);
        if (isCS && isDefensive) r += 0.4;
        r = Math.min(9.5, Math.max(4.0, r));
        if (!liveAvgRatings[p.name]) liveAvgRatings[p.name] = { total: 0, count: 0 };
        liveAvgRatings[p.name].total += r;
        liveAvgRatings[p.name].count++;
      }
    }
    const liveRating = (name: string) => {
      const r = liveAvgRatings[name];
      if (!r || r.count === 0) return null;
      return r.total / r.count;
    };

    // Live league table — all 20 teams, derived from allFixtures through the revealed matchweek
    const liveTable = season.allFixtures ? (() => {
      const table: Record<string, { name: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; isPlayer: boolean }> = {};
      for (const t of season.leagueTable) {
        table[t.name] = { name: t.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, isPlayer: t.isPlayer };
      }
      for (const wk of season.allFixtures!.slice(0, plWeek)) {
        for (const fx of wk.matches) {
          const ht = table[fx.home];
          const at = table[fx.away];
          if (!ht || !at) continue;
          ht.played++; at.played++;
          ht.goalsFor += fx.homeGoals; ht.goalsAgainst += fx.awayGoals;
          at.goalsFor += fx.awayGoals; at.goalsAgainst += fx.homeGoals;
          if (fx.homeGoals > fx.awayGoals) { ht.won++; ht.points += 3; at.lost++; }
          else if (fx.homeGoals === fx.awayGoals) { ht.drawn++; ht.points += 1; at.drawn++; at.points += 1; }
          else { ht.lost++; at.won++; at.points += 3; }
        }
      }
      for (const t of Object.values(table)) t.goalDifference = t.goalsFor - t.goalsAgainst;
      return Object.values(table).sort((a, b) =>
        b.points !== a.points ? b.points - a.points :
        b.goalDifference !== a.goalDifference ? b.goalDifference - a.goalDifference :
        b.goalsFor - a.goalsFor
      );
    })() : null;

    return (
      <div className="max-w-2xl mx-auto p-4 pb-20">
        {/* Matchweek header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold tracking-widest text-white uppercase">
            {hasEuro ? `GW ${plWeek}/38` : `Matchweek ${plWeek} / 38`}
            {hasUCL && <span className="text-blue-400 ml-2">+ UCL</span>}
            {hasUEL && !hasUCL && <span className="text-orange-400 ml-2">+ UEL</span>}
          </span>
          {!roomCode && (
            <button
              onClick={handleSkip}
              className="text-xs font-bold text-white hover:text-white transition px-3 py-2 -mr-3 rounded-lg active:bg-gray-800"
            >
              Skip all &rarr;
            </button>
          )}
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
                    <div className="text-[10px] text-white">{event.subtext}</div>
                  </div>
                </div>
              );
            }

            const isEuroEvent = event.kind === 'ucl';
            const isFACup = event.kind === 'fa-cup';
            const isLeagueCup = event.kind === 'league-cup';
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
                      : isLeagueCup
                        ? "border-l-2 border-l-teal-500"
                        : match.result === "W"
                          ? "border-l-2 border-l-emerald-500"
                          : match.result === "D"
                            ? "border-l-2 border-l-yellow-500"
                            : "border-l-2 border-l-red-500"
                }`}
              >
                <span className={`text-[10px] font-bold w-12 sm:w-14 shrink-0 truncate ${isEuroEvent ? (isUELEvent ? "text-orange-400" : "text-blue-400") : isFACup ? "text-purple-400" : isLeagueCup ? "text-teal-400" : "text-white"}`}>
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
                    <span className="text-white text-[10px] ml-1.5">
                      ({match.isHome ? "H" : "A"})
                    </span>
                  </div>
                  {match.goalScorers.length > 0 && (
                    <div className="text-[11px] text-white truncate">
                      &#9917; {formatGoalScorers(match.goalScorers)}
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
            <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-1.5">PL Form</div>
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

        {/* Live League Table — updates as matchweeks are revealed */}
        {liveTable && plWeek > 0 && (
          <div className="bg-gray-900 rounded-xl p-3 mb-3 border border-gray-800/50">
            <button
              onClick={() => setShowLiveTable(!showLiveTable)}
              className="w-full flex items-center justify-between mb-1.5"
            >
              <span className="text-[10px] font-bold tracking-widest text-white uppercase">Live Table &middot; GW {plWeek}/38</span>
              <svg className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${showLiveTable ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showLiveTable && (
              <div className="space-y-0.5">
                {liveTable.map((team, i) => {
                  const pos = i + 1;
                  const zoneClass = pos === 1
                    ? "border-l-2 border-l-yellow-500"
                    : pos <= 5
                      ? "border-l-2 border-l-blue-500"
                      : pos <= 7
                        ? "border-l-2 border-l-orange-500"
                        : pos >= 18
                          ? "border-l-2 border-l-red-500"
                          : "";
                  return (
                    <div key={team.name} className={`flex items-center text-xs py-1 px-1 rounded transition ${zoneClass} ${team.isPlayer ? "bg-emerald-900/30 border border-emerald-700/30 font-bold" : ""}`}>
                      <span className="w-5 text-center text-[10px] font-bold text-white shrink-0">{pos}</span>
                      <span className={`flex-1 ml-1 truncate min-w-0 ${team.isPlayer ? "text-emerald-400 font-bold" : "text-white"}`}>{team.name}</span>
                      <span className="w-6 text-center text-white text-[10px] shrink-0">{team.played}</span>
                      <span className="w-6 text-center text-white text-[10px] shrink-0">{team.won}</span>
                      <span className="w-6 text-center text-white text-[10px] shrink-0">{team.drawn}</span>
                      <span className="w-6 text-center text-white text-[10px] shrink-0">{team.lost}</span>
                      <span className={`w-7 text-right text-[10px] font-bold shrink-0 ${team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-white"}`}>{team.goalDifference > 0 ? "+" : ""}{team.goalDifference}</span>
                      <span className={`w-7 text-right font-black text-xs shrink-0 ${team.isPlayer ? "text-emerald-400" : "text-white"}`}>{team.points}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Running PL stats */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black text-emerald-400">{runW}</div>
            <div className="text-[9px] font-bold tracking-widest text-white uppercase">Won</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black text-yellow-400">{runD}</div>
            <div className="text-[9px] font-bold tracking-widest text-white uppercase">Drawn</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black text-red-400">{runL}</div>
            <div className="text-[9px] font-bold tracking-widest text-white uppercase">Lost</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800/50">
            <div className="text-2xl font-black text-white">{runPts}</div>
            <div className="text-[9px] font-bold tracking-widest text-white uppercase">Pts</div>
          </div>
        </div>

        <div className="text-center text-xs text-white mb-4">
          GF {runGF} &middot; GA {runGA} &middot; GD {runGF - runGA >= 0 ? "+" : ""}{runGF - runGA}
        </div>

        {/* Live squad stats — below matches so games are visible without scrolling */}
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-bold tracking-widest text-white uppercase">
              {seasonNumber > 1 ? `Season ${seasonNumber} Squad` : "Squad Stats"}
            </h3>
            {plWeek > 0 && (
              <div className="flex text-[10px] text-white">
                <span className="w-6 text-right">G</span>
                <span className="w-6 text-right ml-1">A</span>
                <span className="w-9 text-right ml-1">RAT</span>
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
                  <span className="flex-1 ml-1 font-medium truncate min-w-0">{p.name}{plWeek > 0 && <span className="text-emerald-400 font-bold text-xs"> {displayRating(p)}</span>}</span>
                  {plWeek > 0 ? (
                    <div className="flex shrink-0">
                      <span className={`w-6 text-right font-black text-xs tabular-nums ${g > 0 ? "text-emerald-400" : "text-white"}`}>{g || "-"}</span>
                      <span className={`w-6 text-right font-black text-xs tabular-nums ml-1 ${a > 0 ? "text-blue-400" : "text-white"}`}>{a || "-"}</span>
                      <span className={`w-9 text-right font-black text-xs tabular-nums ml-1 ${(liveRating(p.name) ?? 0) >= 7.5 ? "text-emerald-400" : (liveRating(p.name) ?? 0) >= 6.5 ? "text-white" : "text-white"}`}>
                        {liveRating(p.name) !== null ? liveRating(p.name)!.toFixed(1) : "-"}
                      </span>
                    </div>
                  ) : (
                    <>
                      <span className="text-white text-[10px] font-medium">{p.clubYear}</span>
                      <span className="font-black text-emerald-400 w-10 text-right tabular-nums">{displayRating(p)}</span>
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
                      <span className="flex-1 ml-1 font-medium text-white truncate min-w-0">{p.name}<span className="text-emerald-400 font-bold text-xs"> {p.overall}</span></span>
                      <div className="flex shrink-0">
                        <span className={`w-6 text-right font-black text-xs tabular-nums ${g > 0 ? "text-emerald-400" : "text-white"}`}>{g || "-"}</span>
                        <span className={`w-6 text-right font-black text-xs tabular-nums ml-1 ${a > 0 ? "text-blue-400" : "text-white"}`}>{a || "-"}</span>
                        <span className={`w-9 text-right font-black text-xs tabular-nums ml-1 ${(liveRating(p.name) ?? 0) >= 7.5 ? "text-emerald-400" : "text-white"}`}>
                          {liveRating(p.name) !== null ? liveRating(p.name)!.toFixed(1) : "-"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800/50 flex justify-between text-xs text-white">
            <span>{plWeek > 0 ? `${plWeek} match${plWeek > 1 ? "es" : ""} played` : "Average OVR"}</span>
            <span className="font-bold text-white">{plWeek > 0 ? `${runW}W ${runD}D ${runL}L · ${runPts}pts` : avgOvr}</span>
          </div>
        </div>
      </div>
    );
  }

  // --- Full results phase (after season complete) ---
  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      {/* Shareable area — key summary only */}
      <div ref={shareRef} className={`bg-gray-950 pb-4 rounded-xl ${FRAME_STYLES[equippedFrame]?.border ?? ""} ${FRAME_STYLES[equippedFrame]?.shadow ?? ""}`}>
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
              {(() => {
                const tc = [season.actualFinish === 1, season.faCup.winner, season.leagueCup.winner, season.ucl?.winner, season.uel?.winner, season.superCup?.result === 'W', season.charityShield?.result === 'W'].filter(Boolean).length;
                return tc > 0 ? <div className="text-2xl mb-2 tracking-widest">{"★".repeat(tc)}</div> : null;
              })()}
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
          <div className="bg-gray-900 rounded-xl px-6 py-3 text-center">
            <div className="text-[10px] font-bold tracking-widest text-white uppercase">Finished</div>
            <div className={`text-3xl font-black ${
              season.actualFinish === 1 ? "text-yellow-400" :
              season.actualFinish <= 4 ? "text-blue-400" :
              season.actualFinish <= 6 ? "text-emerald-400" :
              season.actualFinish >= 18 ? "text-red-400" : "text-white"
            }`}>{ordinal(season.actualFinish)}</div>
          </div>
          <div className="bg-gray-900 rounded-xl px-6 py-3 text-center">
            <div className="text-[10px] font-bold tracking-widest text-white uppercase">Projected</div>
            <div className="text-3xl font-black text-white">{ordinal(season.projectedFinish)}</div>
          </div>
          <div className={`rounded-xl px-4 py-3 flex items-center ${
            season.performance === "OVERPERFORMED"
              ? "bg-emerald-900/30 text-emerald-400"
              : season.performance === "UNDERPERFORMED"
                ? "bg-red-900/30 text-red-400"
                : "bg-gray-900 text-white"
          }`}>
            <span className="text-xs font-bold tracking-wide">{season.performance}</span>
          </div>
        </div>

        {/* Trophy shelf — shows every trophy won this season */}
        {(season.actualFinish === 1 || season.faCup.winner || season.leagueCup.winner || season.ucl?.winner || season.uel?.winner || season.superCup?.result === 'W' || season.charityShield?.result === 'W') && (
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {season.actualFinish === 1 && (
              <div className="bg-gray-900 rounded-xl px-4 py-2 text-center border border-yellow-700/30">
                <div className="text-lg">🏆</div>
                <div className="text-[9px] font-bold tracking-widest text-yellow-400 uppercase">Premier League</div>
              </div>
            )}
            {season.ucl?.winner && (
              <div className="bg-gray-900 rounded-xl px-4 py-2 text-center border border-blue-700/30">
                <div className="text-lg">🏆</div>
                <div className="text-[9px] font-bold tracking-widest text-blue-400 uppercase">Champions League</div>
              </div>
            )}
            {season.uel?.winner && (
              <div className="bg-gray-900 rounded-xl px-4 py-2 text-center border border-orange-700/30">
                <div className="text-lg">🏆</div>
                <div className="text-[9px] font-bold tracking-widest text-orange-400 uppercase">Europa League</div>
              </div>
            )}
            {season.faCup.winner && (
              <div className="bg-gray-900 rounded-xl px-4 py-2 text-center border border-gray-800/50">
                <div className="text-lg">🏆</div>
                <div className="text-[9px] font-bold tracking-widest text-amber-400 uppercase">FA Cup</div>
              </div>
            )}
            {season.leagueCup.winner && (
              <div className="bg-gray-900 rounded-xl px-4 py-2 text-center border border-gray-800/50">
                <div className="text-lg">🏆</div>
                <div className="text-[9px] font-bold tracking-widest text-teal-400 uppercase">League Cup</div>
              </div>
            )}
            {season.superCup?.result === 'W' && (
              <div className="bg-gray-900 rounded-xl px-4 py-2 text-center border border-gray-800/50">
                <div className="text-lg">🏆</div>
                <div className="text-[9px] font-bold tracking-widest text-blue-400 uppercase">Super Cup</div>
              </div>
            )}
            {season.charityShield?.result === 'W' && (
              <div className="bg-gray-900 rounded-xl px-4 py-2 text-center border border-gray-800/50">
                <div className="text-lg">🏆</div>
                <div className="text-[9px] font-bold tracking-widest text-emerald-400 uppercase">Community Shield</div>
              </div>
            )}
          </div>
        )}

        {/* Title message (only when no big banner) */}
        {season.actualFinish > 1 && season.actualFinish < 18 && !season.ucl?.winner && !season.uel?.winner && (
          <div className="bg-gray-900 rounded-xl p-4 mb-6 text-center border border-gray-800/50">
            <h2 className={`text-xl font-black ${msg.color}`}>{msg.title}</h2>
            <p className="text-white text-sm">{msg.sub}</p>
          </div>
        )}

      </div>{/* end shareRef */}

      {/* League Table — starts OPEN */}
      <button
        onClick={() => setShowTable(!showTable)}
        className="w-full bg-gray-900 rounded-xl p-4 mt-4 mb-3 flex items-center justify-between hover:bg-gray-800/80 transition border border-gray-800/50"
      >
        <span className="text-[10px] font-bold tracking-widest text-white uppercase">Final League Table</span>
        <svg className={`w-4 h-4 text-white transition-transform duration-200 ${showTable ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {showTable && (
        <div className="bg-gray-900 rounded-xl p-3 sm:p-4 mb-4 border border-gray-800/50">
          {USE_NEW_LEAGUE_TABLE ? (
            <div className="rounded-[20px] bg-gradient-to-br from-teal-400/40 via-white/5 to-amber-400/30 p-[1.5px] shadow-[0_0_36px_-14px_rgba(45,212,191,0.5)]">
              <div className="rounded-[19px] bg-[#0a0f1c] p-3">
                <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px]">
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="text-white/70">Champion</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /><span className="text-white/70">Champions League</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" /><span className="text-white/70">Europa League</span></div>
                  <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" /><span className="text-white/70">Relegation</span></div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/20">
                  <div className="grid grid-cols-[1.8rem_1fr_1.5rem_1.5rem_1.5rem_1.5rem_2.1rem_2.3rem] items-center gap-1 border-b border-white/10 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <div className="text-center">#</div><div>Club</div>
                    <div className="text-center">MP</div>
                    <div className="text-center">W</div><div className="text-center">D</div><div className="text-center">L</div>
                    <div className="text-center">GD</div><div className="text-center">PTS</div>
                  </div>
                  {season.leagueTable.map((team, i) => {
                    const pos = i + 1;
                    // Same qualification logic as the classic table (accounts for
                    // cup winners displacing Europa spots), so zones are correct.
                    const isCL = tableQualification.clNames.has(team.name);
                    const isUEL = tableQualification.uelNames.has(team.name);
                    const isReleg = tableQualification.relegNames.has(team.name);
                    const edge = pos === 1 ? "bg-amber-400" : isCL ? "bg-blue-500" : isUEL ? "bg-orange-500" : isReleg ? "bg-red-500" : "bg-transparent";
                    const badge = pos === 1 ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40" : isCL ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40" : isUEL ? "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/40" : isReleg ? "bg-red-500/15 text-red-300 ring-1 ring-red-500/40" : "bg-white/5 text-white/70";
                    // Red relegation line drawn just above the first relegated team.
                    const isFirstReleg = pos === season.leagueTable.length - 2;
                    return (
                      <div key={team.name}>
                        {isFirstReleg && (
                          <div className="my-0.5 flex items-center gap-2 px-2">
                            <div className="h-[2px] flex-1 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-red-400">Relegation</span>
                            <div className="h-[2px] flex-1 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                          </div>
                        )}
                        <div className="relative">
                          <span className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-full ${edge}`} />
                          <div className={`grid grid-cols-[1.8rem_1fr_1.5rem_1.5rem_1.5rem_1.5rem_2.1rem_2.3rem] items-center gap-1 px-2 py-2 ${team.isPlayer ? "bg-gradient-to-r from-emerald-400/15 via-emerald-400/[0.05] to-transparent ring-1 ring-inset ring-emerald-400/50" : "border-b border-white/5"}`}>
                            <div className="flex justify-center"><span className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-black tabular-nums ${badge}`}>{pos}</span></div>
                            <div className="flex items-center gap-1.5 truncate">
                              <span className={`truncate text-sm font-bold ${team.isPlayer ? "text-emerald-400" : "text-white"}`}>{team.name}</span>
                              {pos === 1 && <span className="text-xs">🏆</span>}
                            </div>
                            <div className="text-center text-xs font-semibold tabular-nums text-white/55">{team.played}</div>
                            <div className="text-center text-xs font-semibold tabular-nums text-white/80">{team.won}</div>
                            <div className="text-center text-xs font-semibold tabular-nums text-white/80">{team.drawn}</div>
                            <div className="text-center text-xs font-semibold tabular-nums text-white/80">{team.lost}</div>
                            <div className={`text-center text-xs font-bold tabular-nums ${team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-white/70"}`}>{team.goalDifference > 0 ? "+" : ""}{team.goalDifference}</div>
                            <div className={`text-center text-sm font-black tabular-nums ${team.isPlayer ? "text-emerald-400" : "text-white"}`}>{team.points}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
          <>
          <div className="flex flex-wrap items-center gap-4 mb-3 text-[10px]">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-white">Champion</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-white">Champions League</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-white">Europa League</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-white">Relegation</span></div>
          </div>
          <div className="flex items-center text-[10px] font-bold tracking-widest text-white mb-2 px-1 uppercase">
            <span className="w-6 text-center shrink-0">#</span>
            <span className="flex-1 ml-1 min-w-0">Club</span>
            <span className="w-7 text-center shrink-0">GP</span>
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
                <div key={team.name} className={`flex items-center text-sm py-1.5 px-1 rounded transition ${getLeaguePositionStyle(pos, team.name)} ${team.isPlayer ? "bg-emerald-900/30 border border-emerald-700/30 font-bold" : "hover:bg-gray-800/50"}`}>
                  <span className={`w-6 text-center text-xs font-bold rounded shrink-0 ${getLeaguePositionBadge(pos, team.name)}`}>{pos}</span>
                  <span className={`flex-1 ml-1 truncate min-w-0 ${team.isPlayer ? "text-emerald-400 font-bold" : "text-white"}`}>{team.name}</span>
                  <span className="w-7 text-center text-white text-xs shrink-0">{team.played}</span>
                  <span className="w-7 text-center text-white text-xs shrink-0">{team.won}</span>
                  <span className="w-7 text-center text-white text-xs shrink-0">{team.drawn}</span>
                  <span className="w-7 text-center text-white text-xs shrink-0">{team.lost}</span>
                  <span className={`w-8 text-right text-xs font-bold shrink-0 ${team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-white"}`}>{team.goalDifference > 0 ? "+" : ""}{team.goalDifference}</span>
                  <span className={`w-8 text-right font-black shrink-0 ${team.isPlayer ? "text-emerald-400" : "text-white"}`}>{team.points}</span>
                </div>
              );
            })}
          </div>
          </>
          )}
        </div>
      )}

      {/* Match Results — starts CLOSED */}
      <button
        onClick={() => setShowMatches(!showMatches)}
        className="w-full bg-gray-900 rounded-xl p-4 mb-3 flex items-center justify-between hover:bg-gray-800/80 transition border border-gray-800/50"
      >
        <span className="text-[10px] font-bold tracking-widest text-white uppercase">Match Results</span>
        <svg className={`w-4 h-4 text-white transition-transform duration-200 ${showMatches ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {showMatches && (
        <div className="mb-6 max-h-[420px] overflow-y-auto rounded-xl border border-gray-800/50 bg-gray-900/40" style={{ scrollbarWidth: "thin", scrollbarColor: "#374151 transparent" }}>
          <div className="space-y-0.5 p-2">
          {staticSchedule.map((entry, idx) => {
            if (entry.type === 'pl-header') {
              return null;
            }
            if (entry.type === 'pl') {
              const match = entry.match;
              return (
                <div key={`pl-${idx}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-gray-900/80 hover:bg-gray-800/60 transition">
                  <span className="text-[10px] font-bold text-white w-8 shrink-0 tabular-nums">MW{entry.week}</span>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${match.result === "W" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : match.result === "D" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>{match.result}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate"><span className="text-white text-xs mr-1">{match.isHome ? "H" : "A"}</span>{match.opponent}</div>
                    {match.goalScorers.length > 0 && <div className="text-[10px] text-white truncate">{formatGoalScorers(match.goalScorers)}</div>}
                  </div>
                  <div className={`text-base font-black tabular-nums shrink-0 ${match.result === "W" ? "text-emerald-400" : match.result === "D" ? "text-yellow-400" : "text-red-400"}`}>{match.goalsFor}-{match.goalsAgainst}</div>
                </div>
              );
            }
            if (entry.type === 'fa-cup') {
              const match = entry.match;
              const fcm = entry.faCupMatch;
              return (
                <div key={`fa-${idx}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-purple-950/30 border-l-2 border-l-purple-500 hover:bg-gray-800/60 transition">
                  <span className="text-[10px] font-bold text-purple-400/70 w-8 shrink-0 truncate">{entry.label.replace("FA Cup ", "FA ")}</span>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${match.result === "W" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>{match.result}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{match.opponent}</div>
                    <div className="text-[10px] text-white truncate">
                      {match.goalScorers.length > 0 && <span>{formatGoalScorers(match.goalScorers)}</span>}
                      {fcm?.extraTime && <span className="ml-1 text-purple-400/70">(AET)</span>}
                      {fcm?.penalties && fcm.penaltyScore && <span className="ml-1 text-purple-400/70">(Pens {fcm.penaltyScore.player}-{fcm.penaltyScore.opponent})</span>}
                    </div>
                  </div>
                  <div className={`text-base font-black tabular-nums shrink-0 ${match.result === "W" ? "text-emerald-400" : "text-red-400"}`}>{match.goalsFor}-{match.goalsAgainst}</div>
                </div>
              );
            }
            if (entry.type === 'league-cup') {
              const match = entry.match;
              const lcm = entry.faCupMatch;
              return (
                <div key={`lc-${idx}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-teal-950/30 border-l-2 border-l-teal-500 hover:bg-gray-800/60 transition">
                  <span className="text-[10px] font-bold text-teal-400/70 w-8 shrink-0 truncate">{entry.label.replace("League Cup ", "LC ")}</span>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${match.result === "W" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>{match.result}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{match.opponent}</div>
                    <div className="text-[10px] text-white truncate">
                      {match.goalScorers.length > 0 && <span>{formatGoalScorers(match.goalScorers)}</span>}
                      {lcm?.extraTime && <span className="ml-1 text-teal-400/70">(AET)</span>}
                      {lcm?.penalties && lcm.penaltyScore && <span className="ml-1 text-teal-400/70">(Pens {lcm.penaltyScore.player}-{lcm.penaltyScore.opponent})</span>}
                    </div>
                  </div>
                  <div className={`text-base font-black tabular-nums shrink-0 ${match.result === "W" ? "text-emerald-400" : "text-red-400"}`}>{match.goalsFor}-{match.goalsAgainst}</div>
                </div>
              );
            }
            if (entry.type === 'ucl') {
              const match = entry.match;
              const isUEL = entry.label.startsWith('UEL');
              return (
                <div key={`ucl-${idx}`} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border-l-2 ${isUEL ? 'border-l-orange-500 bg-orange-950/20' : 'border-l-blue-500 bg-blue-950/20'} hover:bg-gray-800/60 transition`}>
                  <span className={`text-[10px] font-bold w-8 shrink-0 truncate ${isUEL ? 'text-orange-400/70' : 'text-blue-400/70'}`}>{entry.label.split(" ")[1] ?? entry.label}</span>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-black shrink-0 ${match.result === "W" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : match.result === "D" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>{match.result}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{match.opponent}<span className="text-white text-[10px] ml-1">({match.isHome ? "H" : "A"})</span></div>
                    {match.goalScorers.length > 0 && <div className="text-[10px] text-white truncate">{formatGoalScorers(match.goalScorers)}{match.extraTime && <span className={`ml-1 ${isUEL ? 'text-orange-400/70' : 'text-blue-400/70'}`}>(AET)</span>}{match.penalties && match.penaltyScore && <span className={`ml-1 ${isUEL ? 'text-orange-400/70' : 'text-blue-400/70'}`}>(Pens {match.penaltyScore.player}-{match.penaltyScore.opponent})</span>}</div>}
                  </div>
                  <div className={`text-base font-black tabular-nums shrink-0 ${match.result === "W" ? "text-emerald-400" : match.result === "D" ? "text-yellow-400" : "text-red-400"}`}>{match.goalsFor}-{match.goalsAgainst}</div>
                </div>
              );
            }
            if (entry.type === 'ucl-status') {
              const isUEL = !!(season.uel?.qualified && !season.ucl?.qualified);
              return (
                <div key={`status-${idx}`} className={`flex items-center gap-3 rounded-lg px-3 py-3 border ${entry.positive ? isUEL ? "bg-orange-900/30 border-orange-700/40" : "bg-blue-900/30 border-blue-700/40" : "bg-red-900/20 border-red-700/30"}`}>
                  <span className="text-sm">&#9917;</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm ${entry.positive ? (isUEL ? "text-orange-300" : "text-blue-300") : "text-red-400"}`}>{entry.text}</div>
                    <div className="text-[10px] text-white">{entry.subtext}</div>
                  </div>
                </div>
              );
            }
            return null;
          })}
          </div>
        </div>
      )}

      {/* Form Guide */}
      <div className="bg-gray-900 rounded-xl p-3 mb-6 border border-gray-800/50">
        <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Form</div>
        <div className="flex gap-[3px] flex-wrap">
          {season.matches.map((m, i) => (
            <div key={i} className={`w-5 h-5 rounded text-[9px] font-black flex items-center justify-center ${m.result === "W" ? "bg-emerald-500/20 text-emerald-400" : m.result === "D" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`} title={`MW${i + 1}: ${m.result} ${m.goalsFor}-${m.goalsAgainst} vs ${m.opponent}`}>
              {m.result}
            </div>
          ))}
        </div>
      </div>

      {/* Charity Shield */}
      {season.charityShield?.played && (() => {
        const cs = season.charityShield!;
        const won = cs.result === 'W';
        return (
          <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">&#127942;</span>
              <h3 className="text-[10px] font-bold tracking-widest text-purple-400 uppercase">Charity Shield</h3>
              <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
                won
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                {won ? "WINNER" : "DEFEATED"}
              </span>
            </div>
            <div className="text-[10px] text-white mb-2">
              {cs.playerRole} vs {cs.opponentRole}
            </div>
            <div className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg ${won ? "bg-emerald-900/20" : "bg-red-900/20"}`}>
              <span className="flex-1 font-medium truncate">{cs.opponent}</span>
              <span className={`font-black tabular-nums ${won ? "text-emerald-400" : "text-red-400"}`}>
                {cs.goalsFor}-{cs.goalsAgainst}
              </span>
              {cs.penalties && cs.penaltyScore && (
                <span className="text-[9px] font-bold text-purple-400/70 bg-purple-500/10 px-1 py-0.5 rounded">
                  PEN {cs.penaltyScore.player}-{cs.penaltyScore.opponent}
                </span>
              )}
            </div>
            {cs.goalScorers.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-800/50 text-[10px] text-white">
                Goals: {formatGoalScorers(cs.goalScorers)}
              </div>
            )}
          </div>
        );
      })()}

      {/* Super Cup */}
      {season.superCup?.played && (() => {
        const sc = season.superCup!;
        const won = sc.result === 'W';
        return (
          <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">&#127941;</span>
              <h3 className="text-[10px] font-bold tracking-widest text-amber-400 uppercase">Super Cup</h3>
              <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
                won
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                {won ? "WINNER" : "DEFEATED"}
              </span>
            </div>
            <div className="text-[10px] text-white mb-2">
              {sc.playerRole} vs {sc.opponentRole}
            </div>
            <div className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg ${won ? "bg-emerald-900/20" : "bg-red-900/20"}`}>
              <span className="flex-1 font-medium truncate">{sc.opponent}</span>
              <span className={`font-black tabular-nums ${won ? "text-emerald-400" : "text-red-400"}`}>
                {sc.goalsFor}-{sc.goalsAgainst}
              </span>
              {sc.penalties && sc.penaltyScore && (
                <span className="text-[9px] font-bold text-purple-400/70 bg-purple-500/10 px-1 py-0.5 rounded">
                  PEN {sc.penaltyScore.player}-{sc.penaltyScore.opponent}
                </span>
              )}
            </div>
            {sc.goalScorers.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-800/50 text-[10px] text-white">
                Goals: {formatGoalScorers(sc.goalScorers)}
              </div>
            )}
          </div>
        );
      })()}

      {/* FA Cup */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">&#127942;</span>
          <h3 className="text-[10px] font-bold tracking-widest text-white uppercase">FA Cup</h3>
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
                <span className="text-[10px] font-bold text-white w-20 shrink-0">{m.round}</span>
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
            <div className="mt-2 pt-2 border-t border-gray-800/50 flex gap-4 text-[10px] text-white">
              <span>
                Goals: {season.faCup.matches.reduce((s, m) => s + m.goalsFor, 0)}
              </span>
              <span>
                Conceded: {season.faCup.matches.reduce((s, m) => s + m.goalsAgainst, 0)}
              </span>
            </div>
          )}
        </div>

        {/* League Cup */}
        <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">&#127942;</span>
            <h3 className="text-[10px] font-bold tracking-widest text-white uppercase">League Cup</h3>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
              season.leagueCup.winner
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              {season.leagueCup.winner ? "WINNER" : `Out: ${season.leagueCup.exitRound}`}
            </span>
          </div>
          <div className="space-y-1.5">
            {season.leagueCup.matches.map((m, i) => {
              if (m.leg2) {
                // 2-legged semi-final
                const aggFor = m.goalsFor + m.leg2.goalsFor;
                const aggAgainst = m.goalsAgainst + m.leg2.goalsAgainst;
                return (
                  <div key={i} className={`rounded-lg px-2 py-2 ${m.result === "W" ? "bg-emerald-900/20" : "bg-red-900/20"}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold text-white w-20 shrink-0">{m.round}</span>
                      <span className="flex-1 font-medium text-sm truncate">{m.opponent}</span>
                      <span className={`text-[10px] font-bold ${m.result === "W" ? "text-emerald-400" : "text-red-400"}`}>
                        Agg {aggFor}-{aggAgainst}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white pl-20">
                      <span>L1 ({m.isHome ? "H" : "A"}): {m.goalsFor}-{m.goalsAgainst}</span>
                      <span>L2 ({m.leg2.isHome ? "H" : "A"}): {m.leg2.goalsFor}-{m.leg2.goalsAgainst}</span>
                      {m.leg2.extraTime && <span className="text-yellow-400/70 font-bold">AET</span>}
                      {m.leg2.penalties && m.leg2.penaltyScore && (
                        <span className="text-purple-400/70 font-bold">PEN {m.leg2.penaltyScore.player}-{m.leg2.penaltyScore.opponent}</span>
                      )}
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg ${
                    m.result === "W" ? "bg-emerald-900/20" : "bg-red-900/20"
                  }`}
                >
                  <span className="text-[10px] font-bold text-white w-20 shrink-0">{m.round}</span>
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
              );
            })}
          </div>
          {season.leagueCup.matches.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-800/50 flex gap-4 text-[10px] text-white">
              <span>
                Goals: {season.leagueCup.matches.reduce((s, m) => s + m.goalsFor + (m.leg2?.goalsFor ?? 0), 0)}
              </span>
              <span>
                Conceded: {season.leagueCup.matches.reduce((s, m) => s + m.goalsAgainst + (m.leg2?.goalsAgainst ?? 0), 0)}
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
                      ? "bg-gray-500/20 text-white border border-gray-500/30"
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
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">League Phase</div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                  <span className="font-bold text-blue-300">{ordinal(ucl.leaguePosition)}</span>
                  <span className="text-white hidden sm:inline">|</span>
                  <span className="text-white">{uclW}W {uclD}D {uclL}L</span>
                  <span className="text-white hidden sm:inline">|</span>
                  <span className="font-bold text-white">{uclPts} pts</span>
                  <span className="text-white hidden sm:inline">|</span>
                  <span className="text-xs text-white">{uclGF}GF {uclGA}GA</span>
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
                      <span className="text-white text-[10px] ml-1">({m.isHome ? "H" : "A"})</span>
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
                <span className="text-[10px] font-bold tracking-widest text-white uppercase">League Table</span>
                <svg className={`w-3 h-3 text-white transition-transform duration-200 ${showUCLTable ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {showUCLTable && (
                <div className="mb-3">
                  <div>
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-white mb-1 px-1 uppercase">
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
                            isTop8 ? "text-blue-400" : isPlayoff ? "text-cyan-400/70" : "text-white"
                          }`}>{pos}</span>
                          <span className={`flex-1 ml-1 truncate min-w-0 ${team.isPlayer ? "text-blue-300" : "text-white"}`}>
                            {team.name}
                          </span>
                          <span className="w-6 text-center text-white shrink-0">{team.won}</span>
                          <span className="w-6 text-center text-white shrink-0">{team.drawn}</span>
                          <span className="w-6 text-center text-white shrink-0">{team.lost}</span>
                          <span className={`w-7 text-right text-[10px] font-bold shrink-0 ${
                            team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-white"
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
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-white">R16</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500/50" /><span className="text-white">Playoff</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500/50" /><span className="text-white">Eliminated</span></div>
                  </div>
                  </div>
                </div>
              )}

              {/* Knockout Results */}
              {ucl.knockoutTies.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Knockout Stage</div>
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
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white">
                            {isFinal ? (
                              <span className="font-bold">{tie.leg1.goalsFor}-{tie.leg1.goalsAgainst}</span>
                            ) : (
                              <>
                                <span>L1: {tie.leg1.goalsFor}-{tie.leg1.goalsAgainst} ({tie.leg1.isHome ? "H" : "A"})</span>
                                {tie.leg2 && (
                                  <>
                                    <span>L2: {tie.leg2.goalsFor}-{tie.leg2.goalsAgainst} ({tie.leg2.isHome ? "H" : "A"})</span>
                                    <span className="font-bold text-white">Agg: {aggFor}-{aggAgainst}</span>
                                  </>
                                )}
                              </>
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
                      ? "bg-gray-500/20 text-white border border-gray-500/30"
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
                <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">League Phase</div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                  <span className="font-bold text-orange-300">{ordinal(uel.leaguePosition)}</span>
                  <span className="text-white hidden sm:inline">|</span>
                  <span className="text-white">{uelW}W {uelD}D {uelL}L</span>
                  <span className="text-white hidden sm:inline">|</span>
                  <span className="font-bold text-white">{uelPts} pts</span>
                  <span className="text-white hidden sm:inline">|</span>
                  <span className="text-xs text-white">{uelGF}GF {uelGA}GA</span>
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
                      <span className="text-white text-[10px] ml-1">({m.isHome ? "H" : "A"})</span>
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
                <span className="text-[10px] font-bold tracking-widest text-white uppercase">League Table</span>
                <svg className={`w-3 h-3 text-white transition-transform duration-200 ${showUELTable ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {showUELTable && (
                <div className="mb-3">
                  <div>
                  <div className="flex items-center text-[9px] font-bold tracking-widest text-white mb-1 px-1 uppercase">
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
                            isTop8 ? "text-orange-400" : isPlayoff ? "text-amber-400/70" : "text-white"
                          }`}>{pos}</span>
                          <span className={`flex-1 ml-1 truncate min-w-0 ${team.isPlayer ? "text-orange-300" : "text-white"}`}>
                            {team.name}
                          </span>
                          <span className="w-6 text-center text-white shrink-0">{team.won}</span>
                          <span className="w-6 text-center text-white shrink-0">{team.drawn}</span>
                          <span className="w-6 text-center text-white shrink-0">{team.lost}</span>
                          <span className={`w-7 text-right text-[10px] font-bold shrink-0 ${
                            team.goalDifference > 0 ? "text-emerald-400" : team.goalDifference < 0 ? "text-red-400" : "text-white"
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
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-white">R16</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500/50" /><span className="text-white">Playoff</span></div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500/50" /><span className="text-white">Eliminated</span></div>
                  </div>
                  </div>
                </div>
              )}

              {/* Knockout Results */}
              {uel.knockoutTies.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-white uppercase mb-2">Knockout Stage</div>
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
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white">
                            {isFinal ? (
                              <span className="font-bold">{tie.leg1.goalsFor}-{tie.leg1.goalsAgainst}</span>
                            ) : (
                              <>
                                <span>L1: {tie.leg1.goalsFor}-{tie.leg1.goalsAgainst} ({tie.leg1.isHome ? "H" : "A"})</span>
                                {tie.leg2 && (
                                  <>
                                    <span>L2: {tie.leg2.goalsFor}-{tie.leg2.goalsAgainst} ({tie.leg2.isHome ? "H" : "A"})</span>
                                    <span className="font-bold text-white">Agg: {aggFor}-{aggAgainst}</span>
                                  </>
                                )}
                              </>
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

      {/* Squad Stats */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-bold tracking-widest text-white uppercase">
            {seasonNumber > 1 ? `Season ${seasonNumber} Squad` : "Squad Stats"}
          </h3>
          <div className="flex rounded-lg overflow-hidden border border-gray-700/50">
            <button onClick={() => setStatsView("pl")} className={`text-[10px] font-bold px-2.5 py-1 transition ${statsView === "pl" ? "bg-emerald-500/20 text-emerald-400" : "text-white hover:text-gray-400"}`}>PL</button>
            <button onClick={() => setStatsView("all")} className={`text-[10px] font-bold px-2.5 py-1 transition ${statsView === "all" ? "bg-emerald-500/20 text-emerald-400" : "text-white hover:text-gray-400"}`}>ALL COMPS</button>
          </div>
        </div>
        <div className="flex items-center text-[10px] font-bold tracking-widest text-white mb-2 px-1 uppercase">
          <span className="w-7 shrink-0"></span>
          <span className="flex-1 ml-2 min-w-0">Player</span>
          <span className="w-7 text-center shrink-0">APP</span>
          <span className="w-6 text-center shrink-0">G</span>
          <span className="w-6 text-center shrink-0">A</span>
          <span className="w-6 text-center shrink-0">CS</span>
          <span className="w-8 text-center shrink-0">AVG</span>
        </div>
        <div className="space-y-0.5">
          {starterPlayers.map((p, i) => {
            const ps = sortedStats.find(s => s.name === p.name);
            return (
              <div key={i} className="flex items-center text-sm py-1.5 px-1 rounded hover:bg-gray-800/50 transition">
                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${getPositionColor(p.assignedPosition)} text-white w-7 text-center shrink-0`}>{p.assignedPosition}</span>
                <span className="flex-1 ml-2 font-medium truncate min-w-0">{p.name} <span className="text-emerald-400 font-black text-xs">{displayRating(p)}</span></span>
                <span className="w-7 text-center text-xs font-bold shrink-0 text-white">{ps?.appearances ?? "-"}</span>
                <span className={`w-6 text-center text-xs font-bold shrink-0 ${(ps?.goals ?? 0) > 0 ? "text-emerald-400" : "text-white"}`}>{(ps?.goals ?? 0) > 0 ? ps!.goals : "-"}</span>
                <span className={`w-6 text-center text-xs font-bold shrink-0 ${(ps?.assists ?? 0) > 0 ? "text-emerald-400" : "text-white"}`}>{(ps?.assists ?? 0) > 0 ? ps!.assists : "-"}</span>
                <span className={`w-6 text-center text-xs font-bold shrink-0 ${(ps?.cleanSheets ?? 0) > 0 ? "text-emerald-400" : "text-white"}`}>{(ps?.cleanSheets ?? 0) > 0 ? ps!.cleanSheets : "-"}</span>
                <span className={`w-8 text-center text-xs font-bold shrink-0 ${(ps?.avgRating ?? 0) >= 7.5 ? "text-emerald-400" : (ps?.avgRating ?? 0) >= 7.0 ? "text-yellow-400" : (ps?.avgRating ?? 0) >= 6.5 ? "text-orange-400" : "text-white"}`}>{ps ? ps.avgRating.toFixed(1) : "-"}</span>
              </div>
            );
          })}
        </div>
        {subPlayers.length > 0 && (
          <>
            <div className="border-t border-gray-800/50 my-2" />
            <div className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-1.5 px-1">Substitutes</div>
            <div className="space-y-0.5">
              {subPlayers.map((p, i) => {
                const ps = sortedStats.find(s => s.name === p.name);
                return (
                  <div key={`sub-${i}`} className="flex items-center text-sm py-1.5 px-1 rounded hover:bg-gray-800/50 transition opacity-80">
                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-700 text-white w-7 text-center shrink-0">SUB</span>
                    <span className="flex-1 ml-2 font-medium truncate min-w-0 text-white">{p.name} <span className="text-emerald-400/70 font-black text-xs">{p.overall}</span></span>
                    <span className="w-7 text-center text-xs font-bold shrink-0 text-white">{ps?.appearances ?? "-"}</span>
                    <span className={`w-6 text-center text-xs font-bold shrink-0 ${(ps?.goals ?? 0) > 0 ? "text-emerald-400" : "text-white"}`}>{(ps?.goals ?? 0) > 0 ? ps!.goals : "-"}</span>
                    <span className={`w-6 text-center text-xs font-bold shrink-0 ${(ps?.assists ?? 0) > 0 ? "text-emerald-400" : "text-white"}`}>{(ps?.assists ?? 0) > 0 ? ps!.assists : "-"}</span>
                    <span className={`w-6 text-center text-xs font-bold shrink-0 ${(ps?.cleanSheets ?? 0) > 0 ? "text-emerald-400" : "text-white"}`}>{(ps?.cleanSheets ?? 0) > 0 ? ps!.cleanSheets : "-"}</span>
                    <span className={`w-8 text-center text-xs font-bold shrink-0 ${(ps?.avgRating ?? 0) >= 7.5 ? "text-emerald-400" : (ps?.avgRating ?? 0) >= 7.0 ? "text-yellow-400" : (ps?.avgRating ?? 0) >= 6.5 ? "text-orange-400" : "text-white"}`}>{ps ? ps.avgRating.toFixed(1) : "-"}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="mt-3 pt-2 border-t border-gray-800/50 flex justify-between text-xs text-white">
          <span>Average OVR</span>
          <span className="font-bold text-white">{Math.round(players.reduce((acc, p) => acc + p.overall, 0) / players.length)}</span>
        </div>
        <div className="mt-1 flex justify-between text-xs text-white">
          <span>Team Strength</span>
          <span className="font-bold text-emerald-400">{Math.round(season.phaseRatings.teamStrength)}</span>
        </div>
        <div className="mt-1 flex gap-3 text-[10px] text-white justify-end">
          <span>ATK {Math.round(season.phaseRatings.attack)}</span>
          <span>MID {Math.round(season.phaseRatings.midfield)}</span>
          <span>DEF {Math.round(season.phaseRatings.defense)}</span>
          <span>GK {Math.round(season.phaseRatings.gk)}</span>
        </div>
      </div>

      {/* Season Awards */}
      <div className="mb-6">
        <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">
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
                {season.awards.playerOfSeason.avgRating.toFixed(1)} avg rating
              </div>
            </div>
          </div>
        </div>

      {/* Competition Winners */}
      {(() => {
        const myTeamName = season.leagueTable.find(t => t.isPlayer)?.name ?? 'KNOWITBALL FC';
        const plWinner = season.actualFinish === 1
          ? myTeamName
          : (season.leagueTable[0]?.name ?? '—');
        const faCupWin = season.faCup.faCupWinner || '—';
        const leagueCupWin = season.leagueCup.faCupWinner || '—';
        const uclWin = season.ucl?.tournamentWinner || season.uclTournamentWinner || null;
        const uelWin = season.uel?.tournamentWinner || season.uelTournamentWinner || null;
        const hasSuperCup = season.superCup?.played;
        const hasCharityShield = season.charityShield?.played;
        const superCupWin = hasSuperCup ? (season.superCup!.result === 'W'
          ? myTeamName
          : season.superCup!.opponent) : null;
        const charityShieldWin = hasCharityShield ? (season.charityShield!.result === 'W'
          ? myTeamName
          : season.charityShield!.opponent) : null;
        return (
          <div className="mb-6">
            <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">Competition Winners</h3>
            <div className="space-y-1.5">
              {hasCharityShield && charityShieldWin && (
                <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 border border-gray-800/50">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wide">Charity Shield</span>
                  <span className="text-xs font-bold text-white">{charityShieldWin}</span>
                </div>
              )}
              <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 border border-gray-800/50">
                <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wide">Premier League</span>
                <span className="text-xs font-bold text-yellow-300">{plWinner}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 border border-gray-800/50">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">FA Cup</span>
                <span className="text-xs font-bold text-emerald-300">{faCupWin}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 border border-gray-800/50">
                <span className="text-[10px] font-bold text-teal-500 uppercase tracking-wide">League Cup</span>
                <span className="text-xs font-bold text-teal-300">{leagueCupWin}</span>
              </div>
              {uclWin && (
                <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 border border-blue-900/30">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Champions League</span>
                  <span className="text-xs font-bold text-blue-300">{uclWin}</span>
                </div>
              )}
              {uelWin && (
                <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 border border-orange-900/30">
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">Europa League</span>
                  <span className="text-xs font-bold text-orange-300">{uelWin}</span>
                </div>
              )}
              {hasSuperCup && superCupWin && (
                <div className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2 border border-amber-900/30">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Super Cup</span>
                  <span className="text-xs font-bold text-amber-300">{superCupWin}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Season comparison */}
      {seasonNumber > 1 && previousResult && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <h3 className="text-[10px] font-bold tracking-widest text-white uppercase mb-3">Season Comparison</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] text-white font-bold uppercase">S{seasonNumber - 1}</div>
              <div className="text-lg font-black text-white">{ordinal(previousResult.actualFinish)}</div>
              <div className="text-xs text-white">{previousResult.teamRecord.points} pts</div>
            </div>
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </div>
            <div>
              <div className="text-[10px] text-white font-bold uppercase">S{seasonNumber}</div>
              <div className={`text-lg font-black ${
                season.actualFinish < previousResult.actualFinish ? "text-emerald-400" :
                season.actualFinish > previousResult.actualFinish ? "text-red-400" : "text-yellow-400"
              }`}>{ordinal(season.actualFinish)}</div>
              <div className="text-xs text-white">{season.teamRecord.points} pts</div>
            </div>
          </div>
        </div>
      )}

      {/* Room Standings */}
      {roomCode && roomPlayers && roomPlayers.length > 1 && (
        <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">&#127942;</span>
            <h3 className="text-[10px] font-bold tracking-widest text-white uppercase">
              Room Standings
            </h3>
            <span className="ml-auto text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {roomCode}
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[320px]">
              <div className="flex items-center text-[9px] font-bold tracking-widest text-white mb-1.5 px-1 uppercase">
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
                        <span className={`w-6 text-center text-xs font-black ${isWinner ? "text-yellow-400" : "text-white"}`}>
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
                        <span className={`w-10 text-right text-xs font-bold ${gd > 0 ? "text-emerald-400" : gd < 0 ? "text-red-400" : "text-white"}`}>
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
          <p className="text-sm text-white">
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

      {/* Season N+1 — big prominent button */}
      {onPlayNextSeason && season.actualFinish < 18 && (
        <button
          onClick={() => onPlayNextSeason(season, players)}
          className="w-full py-5 mb-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 rounded-xl text-lg font-black transition-all shadow-lg shadow-amber-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          Season {seasonNumber + 1}
        </button>
      )}

      {/* Share + New Draft — smaller, side by side */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700/50 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
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
          className="py-3.5 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 rounded-xl font-bold transition-all shadow-lg shadow-sky-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          New Draft
        </button>
      </div>

      {/* Career Recap Modal */}
      {showCareerRecap && allSeasonResults && (
        <CareerRecap
          allSeasons={[...allSeasonResults, season]}
          roomPlayers={roomPlayers}
          allRoomPlayerSeasons={allRoomPlayerSeasons}
          formationName={formationName}
          onClose={() => setShowCareerRecap(false)}
          onNewRun={onNewRun}
        />
      )}

      {/* Objective completion popups — one per completed objective, stacked vertically */}
      {xpPopups.map((popup, i) => (
        <XPPopup
          key={popup.id}
          index={i}
          title={popup.title}
          xp={popup.xp}
          oldLevel={popup.oldLevel}
          newLevel={popup.newLevel}
          newRewards={popup.newRewards}
          newSeasonCards={popup.newSeasonCards}
          onDismiss={() => setXpPopups(prev => prev.filter(p => p.id !== popup.id))}
        />
      ))}
    </div>
  );
}
