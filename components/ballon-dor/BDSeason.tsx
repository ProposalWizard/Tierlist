"use client";

import { useState } from "react";
import type { BDSeason, BDPlayer, BDEvent, LeagueTableRow, BDTeammate } from "@/lib/ballonDorTypes";
import { applyChoice } from "@/lib/ballonDorEngine";

interface Props {
  season: BDSeason;
  player: BDPlayer;
  onUpdate: (s: BDSeason) => void;
}

const PHASE_LABELS: Record<string, string> = {
  pre_season: 'Pre-Season',
  first_half: 'Aug – Dec',
  january: 'January',
  second_half: 'Feb – Apr',
  run_in: 'May',
};

const PHASE_ORDER = ['pre_season', 'first_half', 'january', 'second_half', 'run_in'];

const HINT_STYLE: Record<string, { label: string; color: string }> = {
  safe:    { label: 'Safe',       color: 'bg-green-500/20 text-green-400' },
  risky:   { label: 'High Risk',  color: 'bg-red-500/20 text-red-400' },
  selfish: { label: 'Selfish',    color: 'bg-orange-500/20 text-orange-400' },
  team:    { label: 'Team-First', color: 'bg-blue-500/20 text-blue-400' },
  media:   { label: 'Media Play', color: 'bg-purple-500/20 text-purple-400' },
};

function combineStats(season: BDSeason) {
  const b = season.baseStats;
  const e = season.eventStats;
  return {
    goals: Math.max(0, b.goals + e.goals),
    assists: Math.max(0, b.assists + e.assists),
    cleanSheets: Math.max(0, b.cleanSheets + e.cleanSheets),
    avgRating: Math.min(9.9, Number((b.avgRating + e.avgRating).toFixed(2))),
    appearances: Math.max(0, b.appearances + e.appearances),
    manOfTheMatch: Math.max(0, b.manOfTheMatch + e.manOfTheMatch),
  };
}

function getSortedTable(table: LeagueTableRow[]) {
  return [...table].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
}

function FormDot({ result }: { result: 'W' | 'D' | 'L' | undefined }) {
  if (!result) return <span className="inline-block w-2 h-2 rounded-full bg-gray-700" />;
  const color = result === 'W' ? 'bg-green-500' : result === 'D' ? 'bg-yellow-500' : 'bg-red-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

function LeagueTableWidget({ table, clubId }: { table: LeagueTableRow[]; clubId: string }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = getSortedTable(table);
  const playerIdx = sorted.findIndex(r => r.clubId === clubId);
  const start = Math.max(0, playerIdx - 3);
  const end = Math.min(sorted.length, playerIdx + 4);
  const visible = sorted.slice(start, end);

  if (!expanded) {
    const playerRow = sorted[playerIdx];
    const pos = playerIdx + 1;
    const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3 py-2.5 text-left hover:border-gray-700 transition"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Premier League</span>
            {playerRow && playerRow.p > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-400">
                {pos}{suffix}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-600">tap to expand ▾</span>
        </div>
        {playerRow && playerRow.p > 0 && (
          <div className="mt-1 flex items-center gap-3">
            <span className="text-xs text-gray-400">{playerRow.pts} pts</span>
            <span className="text-xs text-gray-500">{playerRow.p} played</span>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <FormDot key={i} result={playerRow.form[i]} />
              ))}
            </div>
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Premier League Table</span>
        <button onClick={() => setExpanded(false)} className="text-[10px] text-gray-600 hover:text-gray-400">collapse ▴</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-gray-600">
              <th className="pb-1 text-left w-6">#</th>
              <th className="pb-1 text-left">Club</th>
              <th className="pb-1 text-right w-6">P</th>
              <th className="pb-1 text-right w-8">GD</th>
              <th className="pb-1 text-right w-8">Pts</th>
              <th className="pb-1 text-right w-16">Form</th>
            </tr>
          </thead>
          <tbody>
            {start > 0 && (
              <tr>
                <td colSpan={6} className="py-0.5 text-center text-[9px] text-gray-700">···</td>
              </tr>
            )}
            {visible.map((row, vi) => {
              const pos = start + vi + 1;
              const gd = row.gf - row.ga;
              const isHighlighted = row.clubId === clubId;
              return (
                <tr
                  key={row.clubId}
                  className={`${isHighlighted ? 'bg-amber-500/10 rounded' : ''}`}
                >
                  <td className={`py-0.5 pr-1 font-bold ${isHighlighted ? 'text-amber-400' : 'text-gray-500'}`}>{pos}</td>
                  <td className={`py-0.5 pr-2 font-medium truncate max-w-[7rem] ${isHighlighted ? 'text-amber-300' : 'text-gray-300'}`}>
                    {row.name.length > 12 ? row.name.slice(0, 12) + '…' : row.name}
                  </td>
                  <td className="py-0.5 text-right text-gray-400">{row.p}</td>
                  <td className={`py-0.5 text-right ${gd > 0 ? 'text-green-400' : gd < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                  <td className={`py-0.5 text-right font-bold ${isHighlighted ? 'text-amber-400' : 'text-gray-300'}`}>{row.pts}</td>
                  <td className="py-0.5 text-right">
                    <span className="flex justify-end gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <FormDot key={i} result={row.form[i]} />
                      ))}
                    </span>
                  </td>
                </tr>
              );
            })}
            {end < sorted.length && (
              <tr>
                <td colSpan={6} className="py-0.5 text-center text-[9px] text-gray-700">···</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeammatesWidget({ teammates, position }: { teammates: BDTeammate[]; position: string }) {
  const [expanded, setExpanded] = useState(false);

  const withStats = teammates.some(t => t.appearances > 0);

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full rounded-xl border border-gray-800 bg-gray-900 px-3 py-2.5 text-left hover:border-gray-700 transition"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">Teammates</span>
          <span className="text-[10px] text-gray-600">tap to expand ▾</span>
        </div>
        <div className="mt-1 flex gap-1.5 flex-wrap">
          {teammates.slice(0, 3).map(t => (
            <span key={t.name} className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">{t.name}</span>
          ))}
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Teammates</span>
        <button onClick={() => setExpanded(false)} className="text-[10px] text-gray-600 hover:text-gray-400">collapse ▴</button>
      </div>
      <div className="space-y-2">
        {teammates.map(t => {
          const isDefOrGK = t.position === 'DEF' || t.position === 'GK';
          const noData = t.appearances === 0;
          return (
            <div key={t.name} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-2.5 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-200 leading-none">{t.name}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{t.role}</p>
              </div>
              <div className="flex gap-3 text-right text-[11px] shrink-0">
                {noData ? (
                  <span className="text-gray-600">—</span>
                ) : isDefOrGK ? (
                  <>
                    <div>
                      <p className="font-bold text-gray-300">{t.cleanSheets}</p>
                      <p className="text-[9px] text-gray-600">CS</p>
                    </div>
                    <div>
                      <p className={`font-bold ${t.avgRating >= 7.5 ? 'text-amber-400' : 'text-gray-300'}`}>{t.avgRating.toFixed(1)}</p>
                      <p className="text-[9px] text-gray-600">Rat</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-bold text-gray-300">{t.goals}</p>
                      <p className="text-[9px] text-gray-600">G</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-300">{t.assists}</p>
                      <p className="text-[9px] text-gray-600">A</p>
                    </div>
                    <div>
                      <p className={`font-bold ${t.avgRating >= 7.5 ? 'text-amber-400' : 'text-gray-300'}`}>{t.avgRating > 0 ? t.avgRating.toFixed(1) : '—'}</p>
                      <p className="text-[9px] text-gray-600">Rat</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!withStats && (
        <p className="mt-2 text-center text-[10px] text-gray-600">Stats appear after your first match.</p>
      )}
    </div>
  );
}

function MatchOutcomePanel({
  event,
  playerPosition,
  clubName,
  season,
  prevLeagueTable,
  onContinue,
}: {
  event: BDEvent;
  playerPosition: string;
  clubName: string;
  season: BDSeason;
  prevLeagueTable: LeagueTableRow[] | undefined;
  onContinue: () => void;
}) {
  const result = event.matchResult;
  const ctx = event.matchContext;

  if (!result || !ctx) {
    // Non-match outcome fallback
    const ch = event.choices.find(c => c.id === event.chosenId);
    const fx = ch?.effects ?? {};
    const entries = Object.entries(fx).filter(([k, v]) =>
      v !== undefined && v !== 0 &&
      ['goals','assists','cleanSheets','manOfTheMatch','avgRating','appearances','fitness','morale','fame','overall'].includes(k)
    );
    const labels: Record<string, string> = {
      goals: 'Goals', assists: 'Assists', cleanSheets: 'Clean Sheets',
      manOfTheMatch: 'MOTM', avgRating: 'Avg Rating', appearances: 'Apps',
      fitness: 'Fitness', morale: 'Morale', fame: 'Fame', overall: 'OVR',
    };
    return (
      <div className="rounded-2xl border border-green-800/40 bg-green-950/25 p-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-400">Outcome</p>
        <p className="mb-4 text-sm leading-relaxed text-gray-200">{event.outcomeText}</p>
        {entries.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {entries.map(([k, v]) => {
              const n = v as number;
              return (
                <span key={k} className={`rounded-full px-2.5 py-1 text-xs font-bold ${n > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {n > 0 ? '+' : ''}{k === 'avgRating' ? n.toFixed(2) : n} {labels[k]}
                </span>
              );
            })}
          </div>
        )}
        <button onClick={onContinue} className="w-full rounded-xl bg-white/10 py-3 text-sm font-bold text-white transition hover:bg-white/15">
          Continue →
        </button>
      </div>
    );
  }

  const { teamGoals, opponentGoals, isWin, isDraw, playerGoals, playerAssists, playerRating, cleanSheet } = result;
  const home = ctx.isHome ? clubName : ctx.opponent;
  const away = ctx.isHome ? ctx.opponent : clubName;
  const hg = ctx.isHome ? teamGoals : opponentGoals;
  const ag = ctx.isHome ? opponentGoals : teamGoals;

  const resultColor = isWin ? 'border-green-700/50 bg-green-950/30' : isDraw ? 'border-yellow-700/40 bg-yellow-950/20' : 'border-red-700/40 bg-red-950/20';
  const resultLabel = isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS';
  const resultBadgeColor = isWin ? 'bg-green-500/20 text-green-400' : isDraw ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';

  const isDefOrGK = playerPosition === 'DEF' || playerPosition === 'GK';

  // Compute league position change
  let posChange: number | null = null;
  if (prevLeagueTable && season.leagueTable && ctx.competition === 'Premier League') {
    const prevSorted = getSortedTable(prevLeagueTable);
    const newSorted = getSortedTable(season.leagueTable);
    const prevPos = prevSorted.findIndex(r => r.isPlayer) + 1;
    const newPos = newSorted.findIndex(r => r.isPlayer) + 1;
    if (prevPos > 0 && newPos > 0) posChange = prevPos - newPos; // positive = moved up
  }

  return (
    <div className={`rounded-2xl border p-5 ${resultColor}`}>
      {/* Competition badge */}
      <div className="mb-3 flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${resultBadgeColor}`}>
          {resultLabel}
        </span>
        <span className="text-xs text-gray-500">{ctx.competition} · {ctx.matchweek === 0 ? 'Pre-Season' : `MW${ctx.matchweek}`}</span>
        <span className="text-xs text-gray-600">{ctx.isHome ? 'Home' : 'Away'}</span>
      </div>

      {/* Score */}
      <div className="mb-4 text-center">
        <p className="text-2xl font-black text-white tracking-tight">
          {home} <span className="text-amber-400">{hg}–{ag}</span> {away}
        </p>
      </div>

      {/* Your match */}
      <div className="mb-4 rounded-xl bg-black/20 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Your Match</p>
        <div className="flex gap-4 justify-center">
          {isDefOrGK ? (
            <>
              <div className="text-center">
                <p className={`text-xl font-black ${cleanSheet ? 'text-green-400' : 'text-gray-400'}`}>{cleanSheet ? '✓' : '✗'}</p>
                <p className="text-[9px] text-gray-600 uppercase">Clean Sheet</p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-xl font-black text-white">{playerGoals}</p>
                <p className="text-[9px] text-gray-600 uppercase">Goals</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-white">{playerAssists}</p>
                <p className="text-[9px] text-gray-600 uppercase">Assists</p>
              </div>
            </>
          )}
          <div className="text-center">
            <p className={`text-xl font-black ${playerRating >= 8.5 ? 'text-amber-400' : playerRating >= 7.5 ? 'text-green-400' : playerRating <= 6.2 ? 'text-red-400' : 'text-white'}`}>
              {playerRating.toFixed(1)}
            </p>
            <p className="text-[9px] text-gray-600 uppercase">Rating</p>
          </div>
        </div>
      </div>

      {/* Table position change */}
      {posChange !== null && (
        <div className="mb-3 flex items-center justify-center gap-1.5 text-xs">
          {posChange > 0 ? (
            <span className="text-green-400">▲ {posChange} position{posChange > 1 ? 's' : ''} gained</span>
          ) : posChange < 0 ? (
            <span className="text-red-400">▼ {Math.abs(posChange)} position{Math.abs(posChange) > 1 ? 's' : ''} dropped</span>
          ) : (
            <span className="text-gray-600">No change in position</span>
          )}
        </div>
      )}

      <button onClick={onContinue} className="w-full rounded-xl bg-white/10 py-3 text-sm font-bold text-white transition hover:bg-white/15">
        Continue →
      </button>
    </div>
  );
}

export default function BDSeason({ season, player, onUpdate }: Props) {
  const [showingOutcome, setShowingOutcome] = useState<BDEvent | null>(null);
  const [prevLeagueTable, setPrevLeagueTable] = useState<LeagueTableRow[] | undefined>(undefined);

  const currentEvent = season.events.find(e => !e.chosenId);
  const stats = combineStats(season);
  const doneCount = season.events.filter(e => e.chosenId).length;
  const totalEvents = season.events.length;
  const phaseIdx = PHASE_ORDER.indexOf(season.phase);
  const pos = player.position;

  const hasPlayedFirstMatch = season.events.some(e => e.category === 'match' && e.chosenId);

  function handleChoice(event: BDEvent, choiceId: string) {
    const tableBefore = season.leagueTable ? [...season.leagueTable] : undefined;
    const updated = applyChoice(season, event.id, choiceId, player.position);
    const chosen = updated.events.find(e => e.id === event.id);
    setPrevLeagueTable(tableBefore);
    setShowingOutcome(chosen ?? null);
    onUpdate(updated);
  }

  function handleContinue() {
    setShowingOutcome(null);
    setPrevLeagueTable(undefined);
  }

  const isAllDone = !currentEvent && !showingOutcome;

  function attrColor(val: number, attr: string) {
    if (attr === 'fitness') return val >= 75 ? 'bg-green-500' : val >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    if (attr === 'morale') return val >= 75 ? 'bg-blue-500' : val >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    return val >= 60 ? 'bg-amber-500' : val >= 35 ? 'bg-amber-700' : 'bg-gray-600';
  }

  function attrImpact(attr: string) {
    if (attr === 'fitness') return 'Affects appearances & injury risk';
    if (attr === 'morale') return 'Affects your average match rating';
    return 'Affects Ballon d\'Or vote weight';
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-6">
      <div className="mx-auto max-w-lg">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Season {season.number} · {season.year}
            </p>
            <h2 className="text-lg font-black text-white">{player.name}</h2>
            <p className="text-xs text-gray-500">
              {season.club.name} · {pos}
              {season.inCL ? ' · ⭐ Champions League' : season.inEL ? ' · 🏆 Europa League' : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">OVR</p>
            <p className="text-2xl font-black text-amber-400">{season.playerOverall}</p>
            <p className="text-[10px] text-gray-600 capitalize">{player.archetype.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Phase progress */}
        <div className="mb-2 flex gap-1">
          {PHASE_ORDER.map((p, i) => (
            <div
              key={p}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < phaseIdx ? 'bg-amber-400' : i === phaseIdx ? 'bg-amber-500' : 'bg-gray-800'
              }`}
            />
          ))}
        </div>
        <p className="mb-5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
          {PHASE_LABELS[season.phase] ?? season.phase} · {doneCount}/{totalEvents} events
        </p>

        {/* Stats panel */}
        {hasPlayedFirstMatch ? (
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">{pos === 'GK' || pos === 'DEF' ? 'Clean Sheets' : 'Goals'}</p>
              <p className="text-2xl font-black text-white">
                {pos === 'GK' || pos === 'DEF' ? stats.cleanSheets : stats.goals}
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">{pos === 'GK' ? 'MOTM' : 'Assists'}</p>
              <p className="text-2xl font-black text-white">
                {pos === 'GK' ? stats.manOfTheMatch : stats.assists}
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">Avg Rating</p>
              <p className={`text-2xl font-black ${stats.avgRating >= 7.5 ? 'text-amber-400' : 'text-white'}`}>
                {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 text-center">
            <p className="text-xs text-gray-500">Your first match event will unlock season statistics.</p>
          </div>
        )}

        {/* League table widget */}
        {season.leagueTable && season.leagueTable.length > 0 && (
          <div className="mb-3">
            <LeagueTableWidget table={season.leagueTable} clubId={season.club.id} />
          </div>
        )}

        {/* Teammates widget */}
        {season.teammates && season.teammates.length > 0 && (
          <div className="mb-4">
            <TeammatesWidget teammates={season.teammates} position={pos} />
          </div>
        )}

        {/* Attribute bars */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {(['fitness', 'morale', 'fame'] as const).map(attr => {
            const v = season.attributes[attr];
            return (
              <div key={attr} className="rounded-xl border border-gray-800 bg-gray-900 p-2.5">
                <div className="mb-1 flex justify-between">
                  <span className="text-xs capitalize text-gray-500">{attr}</span>
                  <span className={`text-xs font-black ${v >= 70 ? 'text-green-400' : v >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{v}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-800">
                  <div className={`h-1.5 rounded-full ${attrColor(v, attr)} transition-all`} style={{ width: `${v}%` }} />
                </div>
                <p className="mt-1 text-[9px] text-gray-600 leading-tight">{attrImpact(attr)}</p>
              </div>
            );
          })}
        </div>

        {/* Event display */}
        {showingOutcome ? (
          <MatchOutcomePanel
            event={showingOutcome}
            playerPosition={pos}
            clubName={season.club.name}
            season={season}
            prevLeagueTable={prevLeagueTable}
            onContinue={handleContinue}
          />

        ) : currentEvent ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            {/* Event header */}
            <div className="mb-2 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                currentEvent.category === 'match' ? 'bg-green-500/20 text-green-400' :
                currentEvent.category === 'career' ? 'bg-blue-500/20 text-blue-400' :
                currentEvent.category === 'lifestyle' ? 'bg-purple-500/20 text-purple-400' :
                'bg-gray-700 text-gray-400'
              }`}>
                {currentEvent.category}
              </span>
              <span className="text-xs text-gray-500">{PHASE_LABELS[currentEvent.phase]}</span>
            </div>

            {/* Match-specific header */}
            {currentEvent.category === 'match' && currentEvent.matchContext && (
              <div className="mb-3 rounded-xl bg-gray-800/60 px-3 py-2">
                <p className="text-sm font-black text-white">{currentEvent.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {currentEvent.matchContext.isHome ? 'Home vs ' : 'Away at '}
                  <span className="font-semibold text-gray-300">{currentEvent.matchContext.opponent}</span>
                </p>
              </div>
            )}

            {currentEvent.category !== 'match' && (
              <h3 className="mb-2 text-base font-black text-white">{currentEvent.title}</h3>
            )}

            <p className="mb-5 text-sm leading-relaxed text-gray-400">{currentEvent.context}</p>

            <div className="space-y-2.5">
              {currentEvent.choices.map(choice => {
                const hint = choice.hint ? HINT_STYLE[choice.hint] : null;
                return (
                  <button
                    key={choice.id}
                    onClick={() => handleChoice(currentEvent, choice.id)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-800/50 p-3.5 text-left transition hover:border-amber-500/40 hover:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-white leading-snug">
                        {choice.emoji} {choice.label}
                      </p>
                      {hint && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${hint.color}`}>
                          {hint.label}
                        </span>
                      )}
                    </div>
                    {choice.description && (
                      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{choice.description}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        ) : isAllDone ? (
          <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 p-5 text-center">
            <p className="mb-2 text-2xl">⏳</p>
            <p className="mb-1 text-sm font-bold text-amber-400">Season complete</p>
            <p className="text-xs text-gray-500">Simulating trophies and Ballon d'Or nominations...</p>
          </div>
        ) : null}

        {/* Past events log */}
        {season.events.filter(e => e.chosenId).length > 0 && !showingOutcome && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">Season log</p>
            <div className="space-y-1.5">
              {season.events.filter(e => e.chosenId).map(e => {
                const ch = e.choices.find(c => c.id === e.chosenId);
                const isMatch = e.category === 'match';
                const mr = e.matchResult;
                return (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2">
                    <span className="text-base">{ch?.emoji ?? '•'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-300">{e.title}</p>
                      {isMatch && mr ? (
                        <p className="text-xs text-gray-600">
                          {mr.isWin ? 'W' : mr.isDraw ? 'D' : 'L'} · {mr.teamGoals}–{mr.opponentGoals} · {mr.playerRating.toFixed(1)}
                        </p>
                      ) : (
                        <p className="truncate text-xs text-gray-600">{ch?.label}</p>
                      )}
                    </div>
                    {ch?.hint && !isMatch && (
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${HINT_STYLE[ch.hint]?.color ?? ''}`}>
                        {HINT_STYLE[ch.hint]?.label}
                      </span>
                    )}
                    {isMatch && mr && (
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${mr.isWin ? 'bg-green-500/20 text-green-400' : mr.isDraw ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                        {mr.isWin ? 'WIN' : mr.isDraw ? 'DRAW' : 'LOSS'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
