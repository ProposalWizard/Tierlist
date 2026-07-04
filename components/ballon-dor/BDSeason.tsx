"use client";

import { useState, useEffect } from "react";
import type {
  BDSeason as SeasonData,
  BDPlayer,
  BDEvent,
  BDPosition,
  LeagueTableRow,
  BDTeammate,
} from "@/lib/ballonDorTypes";
import { applyChoice } from "@/lib/ballonDorEngine";

// ── Competition badge styles ───────────────────────────────────────
const COMP: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  'Premier League':   { bg: 'bg-purple-950/50', border: 'border-purple-700/40', text: 'text-purple-300', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'Champions League': { bg: 'bg-blue-950/50',   border: 'border-blue-700/40',   text: 'text-blue-300',   icon: '⭐' },
  'Europa League':    { bg: 'bg-orange-950/50', border: 'border-orange-700/40', text: 'text-orange-300', icon: '🔶' },
  'FA Cup':           { bg: 'bg-red-950/50',    border: 'border-red-700/40',    text: 'text-red-300',   icon: '🏆' },
  'Pre-Season':       { bg: 'bg-gray-900',      border: 'border-gray-700',      text: 'text-gray-400',  icon: '⚽' },
};

const HINT: Record<string, { bg: string; text: string; label: string }> = {
  safe:    { bg: 'bg-green-500/15',  text: 'text-green-400',  label: 'SAFE'    },
  risky:   { bg: 'bg-red-500/15',    text: 'text-red-400',    label: 'RISKY'   },
  team:    { bg: 'bg-blue-500/15',   text: 'text-blue-400',   label: 'TEAM'    },
  selfish: { bg: 'bg-amber-500/15',  text: 'text-amber-400',  label: 'SELFISH' },
  media:   { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'MEDIA'   },
};

const CAT_BADGE: Record<string, string> = {
  match:     'bg-green-500/20 text-green-400',
  career:    'bg-blue-500/20 text-blue-400',
  lifestyle: 'bg-purple-500/20 text-purple-400',
  decision:  'bg-amber-500/20 text-amber-400',
};

interface Props {
  season: SeasonData;
  player: BDPlayer;
  onUpdate: (s: SeasonData) => void;
  onReturnToHub?: () => void;
}

export default function BDSeason({ season, player, onUpdate, onReturnToHub }: Props) {
  // One event at a time
  const currentIdx = season.events.findIndex(e => !e.chosenId);
  const currentEvent = currentIdx >= 0 ? season.events[currentIdx] : null;
  const isAllDone = currentIdx === -1;
  const completedCount = season.events.filter(e => e.chosenId).length;

  // Match reveal state machine
  const [matchPhase, setMatchPhase] = useState<'choices' | 'revealing' | 'result'>('choices');
  // Deferred season update — stored until user clicks "Next Week"
  const [pendingUpdated, setPendingUpdated] = useState<SeasonData | null>(null);

  // Drawer state
  const [showTable, setShowTable] = useState(false);
  const [showSquad, setShowSquad] = useState(false);

  // Reset when a new event becomes current (but preserve 'result' phase)
  useEffect(() => {
    if (matchPhase !== 'result') {
      setMatchPhase('choices');
      setPendingUpdated(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.id]);

  function handleChoice(eventId: string, choiceId: string) {
    const ev = season.events.find(e => e.id === eventId);
    if (!ev) return;

    if (ev.category === 'match') {
      setMatchPhase('revealing');
      setTimeout(() => {
        const updated = applyChoice(season, eventId, choiceId, player.position);
        setPendingUpdated(updated);
        setMatchPhase('result');
      }, 1800);
    } else {
      const updated = applyChoice(season, eventId, choiceId, player.position);
      onUpdate(updated);
    }
  }

  function handleNextWeek() {
    if (pendingUpdated) {
      onUpdate(pendingUpdated);
    }
    setPendingUpdated(null);
    setMatchPhase('choices');
  }

  // The most recently resolved match event from the pending update
  const latestMatchEvent = pendingUpdated
    ? [...pendingUpdated.events].reverse().find(e => e.chosenId && e.category === 'match') ?? null
    : null;

  // Use pending table when showing match result (it has the updated positions)
  const displayTable = matchPhase === 'result' && pendingUpdated
    ? pendingUpdated.leagueTable
    : season.leagueTable;
  const displayTeammates = matchPhase === 'result' && pendingUpdated
    ? pendingUpdated.teammates
    : season.teammates;

  // Running totals
  const totalGoals     = season.baseStats.goals + season.eventStats.goals;
  const totalAssists   = season.baseStats.assists + season.eventStats.assists;
  const totalCS        = season.baseStats.cleanSheets + season.eventStats.cleanSheets;
  const totalRating    = Number((season.baseStats.avgRating + season.eventStats.avgRating).toFixed(1));
  const isDefOrGK      = player.position === 'GK' || player.position === 'DEF';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* ── Sticky top header ── */}
      <div className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-gray-800/80">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center justify-between gap-3">
          {onReturnToHub && (
            <button
              onClick={onReturnToHub}
              className="shrink-0 text-gray-500 hover:text-amber-400 transition text-xs font-medium"
            >
              ← Hub
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">
              Season {season.number} · {season.year}/{String(season.year + 1).slice(2)} · {season.club.name}
            </p>
            <p className="text-sm font-black text-white truncate">{player.name}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {!isDefOrGK ? (
              <>
                <MiniStat label="G"   value={totalGoals} />
                <MiniStat label="A"   value={totalAssists} />
              </>
            ) : (
              <MiniStat label="CS" value={totalCS} />
            )}
            <MiniStat label="RAT" value={totalRating.toFixed(1)} gold />
          </div>
        </div>

        {/* Season timeline dots */}
        <div className="px-4 pb-2">
          <TimelineDots events={season.events} currentIdx={currentIdx} />
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 mx-auto w-full max-w-lg px-4 py-4 space-y-3">

        {/* MATCH: animated reveal */}
        {matchPhase === 'revealing' && <MatchRevealCard />}

        {/* MATCH: result screen */}
        {matchPhase === 'result' && latestMatchEvent && (
          <MatchResultCard
            event={latestMatchEvent}
            clubName={season.club.name}
            position={player.position}
            onNextWeek={handleNextWeek}
            onSeeTable={() => { setShowTable(true); }}
          />
        )}

        {/* Current event (choices) */}
        {matchPhase === 'choices' && currentEvent && !isAllDone && (
          <CurrentEventCard
            event={currentEvent}
            season={season}
            onChoice={(id) => handleChoice(currentEvent.id, id)}
          />
        )}

        {/* Season complete holding card */}
        {isAllDone && (
          <div className="rounded-2xl border border-amber-800/30 bg-amber-950/15 p-7 text-center">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-base font-black text-amber-400 mb-1">Season Complete</p>
            <p className="text-sm text-gray-500">Calculating trophies & Ballon d'Or nominations…</p>
          </div>
        )}

        {/* Season diary — last 3 completed events */}
        {matchPhase === 'choices' && !isAllDone && completedCount > 0 && (
          <SeasonDiary events={season.events} />
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="sticky bottom-0 z-20 bg-gray-950/95 backdrop-blur border-t border-gray-800/80">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => { setShowTable(true); setShowSquad(false); }}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-800 bg-gray-900 py-2.5 text-sm font-bold text-gray-300 hover:border-purple-700/50 hover:text-purple-300 transition"
          >
            <span className="text-base">📊</span> Table
          </button>
          <button
            onClick={() => { setShowSquad(true); setShowTable(false); }}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-gray-800 bg-gray-900 py-2.5 text-sm font-bold text-gray-300 hover:border-blue-700/50 hover:text-blue-300 transition"
          >
            <span className="text-base">👥</span> Squad
          </button>
          <div className="shrink-0 text-right">
            <p className="text-xs font-black text-gray-500">{completedCount}/{season.events.length}</p>
            <p className="text-[9px] text-gray-700 uppercase">events</p>
          </div>
        </div>
      </div>

      {/* ── League Table Drawer ── */}
      {showTable && (
        <Drawer onClose={() => setShowTable(false)}>
          <TableContent
            table={displayTable ?? []}
            playerClubId={season.club.id}
          />
        </Drawer>
      )}

      {/* ── Squad Drawer ── */}
      {showSquad && (
        <Drawer onClose={() => setShowSquad(false)}>
          <SquadContent
            teammates={displayTeammates ?? []}
            playerName={player.name}
            playerPosition={player.position}
          />
        </Drawer>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function MiniStat({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className="text-center leading-none">
      <p className={`text-base font-black ${gold ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      <p className="text-[9px] text-gray-600 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// ── Timeline dots ──────────────────────────────────────────────────
function TimelineDots({ events, currentIdx }: { events: BDEvent[]; currentIdx: number }) {
  const phases: BDEvent['phase'][] = ['pre_season', 'first_half', 'january', 'second_half', 'run_in'];
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {phases.map((phase, pi) => {
        const phaseEvts = events.filter(e => e.phase === phase);
        if (!phaseEvts.length) return null;
        return (
          <div key={phase} className="flex items-center gap-1 shrink-0">
            {pi > 0 && <div className="w-2.5 h-px bg-gray-800" />}
            <div className="flex gap-1 items-center">
              {phaseEvts.map(ev => {
                const evIdx = events.indexOf(ev);
                const done = !!ev.chosenId;
                const current = evIdx === currentIdx;
                const isMatch = ev.category === 'match';
                return (
                  <span
                    key={ev.id}
                    className={[
                      'rounded-full transition-all duration-300',
                      current
                        ? `w-3 h-3 ${isMatch ? 'bg-green-400 shadow-green-400/60' : 'bg-amber-400 shadow-amber-400/60'} shadow-md`
                        : done
                        ? `w-2 h-2 ${isMatch ? 'bg-green-700' : 'bg-gray-600'}`
                        : `w-2 h-2 border ${isMatch ? 'border-green-800/60' : 'border-gray-700'} bg-transparent`,
                    ].join(' ')}
                    title={ev.title}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Current event card ─────────────────────────────────────────────
function CurrentEventCard({
  event,
  season,
  onChoice,
}: {
  event: BDEvent;
  season: SeasonData;
  onChoice: (choiceId: string) => void;
}) {
  const ctx = event.matchContext;
  const comp = ctx ? (COMP[ctx.competition] ?? COMP['Premier League']) : null;
  const cat = COMP[event.category as string] ?? null;

  return (
    <div className="space-y-3">
      {/* Match fixture header */}
      {ctx && comp && (
        <div className={`rounded-2xl border p-4 ${comp.bg} ${comp.border}`}>
          {/* Competition + matchweek */}
          <div className="flex items-center justify-between mb-4">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${comp.bg} ${comp.border} ${comp.text}`}>
              {comp.icon} {ctx.competition}
            </span>
            <span className="text-[10px] text-gray-500 font-semibold">
              {ctx.matchweek === 0 ? 'Pre-Season' : `Matchweek ${ctx.matchweek}`}
            </span>
          </div>

          {/* Teams */}
          <div className="grid grid-cols-3 items-center gap-2 mb-4">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">{ctx.isHome ? 'HOME' : 'AWAY'}</p>
              <p className="text-sm font-black text-white leading-tight">{season.club.name}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-600">vs</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">{ctx.isHome ? 'AWAY' : 'HOME'}</p>
              <p className="text-sm font-black text-white leading-tight">{ctx.opponent}</p>
            </div>
          </div>

          {/* Difficulty */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <span
                  key={i}
                  className={`block w-2.5 h-2.5 rounded-full ${i <= Math.ceil(ctx.opponentPrestige / 20) ? 'bg-amber-500' : 'bg-gray-800'}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-500">
              {ctx.opponentPrestige >= 92 ? 'Elite' : ctx.opponentPrestige >= 82 ? 'Strong' : ctx.opponentPrestige >= 72 ? 'Solid' : 'Beatable'}
            </span>
          </div>
        </div>
      )}

      {/* Attribute pills for non-match events */}
      {!ctx && (
        <div className="flex gap-2">
          {([
            { label: 'Fitness', v: season.attributes.fitness, color: 'bg-green-500' },
            { label: 'Morale',  v: season.attributes.morale,  color: 'bg-blue-500'  },
            { label: 'Fame',    v: season.attributes.fame,    color: 'bg-amber-500' },
          ] as const).map(({ label, v, color }) => (
            <div key={label} className="flex-1 rounded-xl border border-gray-800 bg-gray-900 p-2.5">
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px] text-gray-500">{label}</span>
                <span className="text-[10px] font-bold text-white">{v}</span>
              </div>
              <div className="h-1 rounded-full bg-gray-800">
                <div className={`h-1 rounded-full ${color} transition-all`} style={{ width: `${v}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event card with choices */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CAT_BADGE[event.category] ?? 'bg-gray-700 text-gray-400'}`}>
            {event.category}
          </span>
        </div>
        <h3 className="text-base font-black text-white mb-2 leading-snug">{event.title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed mb-5">{event.context}</p>

        <div className="space-y-2.5">
          {event.choices.map(choice => {
            const h = choice.hint ? HINT[choice.hint] : null;
            return (
              <button
                key={choice.id}
                onClick={() => onChoice(choice.id)}
                className="w-full rounded-xl border border-gray-700 bg-gray-800/40 p-4 text-left transition hover:border-amber-500/40 hover:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-white leading-snug">
                    {choice.emoji} {choice.label}
                  </p>
                  {h && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${h.bg} ${h.text}`}>
                      {h.label}
                    </span>
                  )}
                </div>
                {choice.description && (
                  <p className="text-xs text-gray-500 leading-relaxed">{choice.description}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Match: animated reveal ─────────────────────────────────────────
function MatchRevealCard() {
  return (
    <div
      className="rounded-2xl border border-gray-700 bg-gray-900 py-12 text-center"
      style={{ animation: 'fadeIn 0.3s ease' }}
    >
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-800 mb-4">
        <span className="text-3xl">⚽</span>
      </div>
      <p className="text-lg font-black text-white mb-1">Match Day</p>
      <p className="text-sm text-gray-500 mb-5">Getting the result…</p>
      <div className="flex justify-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-amber-400 opacity-0"
            style={{ animation: `fadeIn 0.4s ease ${i * 0.2 + 0.3}s forwards` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Match: result card ─────────────────────────────────────────────
function MatchResultCard({
  event,
  clubName,
  position,
  onNextWeek,
  onSeeTable,
}: {
  event: BDEvent;
  clubName: string;
  position: BDPosition;
  onNextWeek: () => void;
  onSeeTable: () => void;
}) {
  const result = event.matchResult!;
  const ctx    = event.matchContext!;

  const home = ctx.isHome ? clubName    : ctx.opponent;
  const away = ctx.isHome ? ctx.opponent : clubName;
  const hg   = ctx.isHome ? result.teamGoals : result.opponentGoals;
  const ag   = ctx.isHome ? result.opponentGoals : result.teamGoals;

  const isDefOrGK = position === 'GK' || position === 'DEF';
  const hatTrick  = result.playerGoals >= 3;
  const motm      = result.playerRating >= 9.0;
  const nightmare = result.playerRating < 6.0;

  const resultGrad = result.isWin
    ? 'from-green-950/40 border-green-700/30'
    : result.isDraw
    ? 'from-amber-950/40 border-amber-700/30'
    : 'from-red-950/40 border-red-700/30';

  const resultLabel = result.isWin ? 'WIN' : result.isDraw ? 'DRAW' : 'LOSS';
  const resultColor = result.isWin ? 'text-green-400' : result.isDraw ? 'text-amber-400' : 'text-red-400';

  const comp = COMP[ctx.competition] ?? COMP['Premier League'];
  const isPL = ctx.competition === 'Premier League';

  return (
    <div className="space-y-3" style={{ animation: 'fadeSlideIn 0.4s ease' }}>
      {/* Score card */}
      <div className={`rounded-2xl border bg-gradient-to-b to-gray-900 p-5 ${resultGrad}`}>
        <div className="flex items-center justify-between mb-4">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${comp.bg} ${comp.border} ${comp.text}`}>
            {comp.icon} {ctx.competition}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-black bg-gray-950/50 ${resultColor}`}>
            {resultLabel}
          </span>
        </div>

        {/* Scoreline */}
        <div className="grid grid-cols-3 items-center gap-2 mb-5">
          <p className="text-sm font-bold text-white text-right leading-tight">{home}</p>
          <div className="text-center">
            <p className="text-5xl font-black tracking-tight leading-none">
              <span className={ctx.isHome ? resultColor : 'text-white'}>{hg}</span>
              <span className="text-gray-700 text-3xl mx-1">–</span>
              <span className={!ctx.isHome ? resultColor : 'text-white'}>{ag}</span>
            </p>
          </div>
          <p className="text-sm font-bold text-white text-left leading-tight">{away}</p>
        </div>

        {/* Special banner */}
        {hatTrick && (
          <div className="mb-4 rounded-xl bg-amber-500/20 border border-amber-500/30 py-2.5 text-center">
            <p className="text-sm font-black text-amber-400">🎩 Hat-Trick Hero!</p>
          </div>
        )}
        {motm && !hatTrick && (
          <div className="mb-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 py-2.5 text-center">
            <p className="text-sm font-black text-yellow-300">⭐ Player of the Match</p>
          </div>
        )}
        {nightmare && (
          <div className="mb-4 rounded-xl bg-red-900/30 border border-red-800/30 py-2.5 text-center">
            <p className="text-sm font-bold text-red-400">One to forget. Brush it off.</p>
          </div>
        )}

        {/* Personal stats */}
        <div className="flex items-center justify-center gap-6">
          {!isDefOrGK && (
            <>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{result.playerGoals}</p>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Goals</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{result.playerAssists}</p>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Assists</p>
              </div>
            </>
          )}
          {isDefOrGK && result.cleanSheet && (
            <div className="text-center">
              <p className="text-2xl">🧤</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Clean Sheet</p>
            </div>
          )}
          <div className="text-center">
            <p className={`text-2xl font-black ${result.playerRating >= 8 ? 'text-amber-400' : nightmare ? 'text-red-400' : 'text-white'}`}>
              {result.playerRating.toFixed(1)}
            </p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Rating</p>
          </div>
        </div>
      </div>

      {/* Outcome text */}
      {event.outcomeText && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
          <p className="text-xs text-gray-400 leading-relaxed">{event.outcomeText}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isPL && (
          <button
            onClick={onSeeTable}
            className="flex-1 rounded-xl border border-purple-800/40 bg-purple-950/20 py-3 text-sm font-bold text-purple-300 transition hover:bg-purple-900/30"
          >
            📊 See Table
          </button>
        )}
        <button
          onClick={onNextWeek}
          className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-black text-black transition hover:bg-amber-400"
        >
          Next Week →
        </button>
      </div>
    </div>
  );
}

// ── Season diary ───────────────────────────────────────────────────
function SeasonDiary({ events }: { events: BDEvent[] }) {
  const done = [...events].filter(e => e.chosenId).reverse().slice(0, 4);
  if (!done.length) return null;

  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-700">Season so far</p>
      <div className="space-y-1.5">
        {done.map(ev => {
          const ch  = ev.choices.find(c => c.id === ev.chosenId);
          const mr  = ev.matchResult;
          const isMatch = ev.category === 'match';
          const resultBg = isMatch && mr
            ? mr.isWin ? 'bg-green-950/30 border-green-900/30' : mr.isDraw ? 'bg-amber-950/30 border-amber-900/30' : 'bg-red-950/30 border-red-900/30'
            : 'bg-gray-900 border-gray-800/50';
          return (
            <div key={ev.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${resultBg}`}>
              <span className="text-base shrink-0">{ch?.emoji ?? '•'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-300 truncate">{ev.title}</p>
                {isMatch && mr ? (
                  <p className="text-[10px] text-gray-600">
                    {mr.teamGoals}–{mr.opponentGoals} · {mr.isWin ? 'W' : mr.isDraw ? 'D' : 'L'} · {mr.playerRating.toFixed(1)} rating
                    {mr.playerGoals > 0 ? ` · ${mr.playerGoals}G` : ''}
                    {mr.playerAssists > 0 ? ` ${mr.playerAssists}A` : ''}
                  </p>
                ) : (
                  <p className="text-[10px] text-gray-600 truncate">{ch?.label ?? ''}</p>
                )}
              </div>
              {isMatch && mr && (
                <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                  mr.isWin ? 'bg-green-800 text-green-300' : mr.isDraw ? 'bg-amber-800 text-amber-300' : 'bg-red-900 text-red-300'
                }`}>
                  {mr.isWin ? 'W' : mr.isDraw ? 'D' : 'L'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Drawer shell ───────────────────────────────────────────────────
function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ animation: 'fadeIn 0.15s ease' }}>
      <div className="flex-1 bg-black/70" onClick={onClose} />
      <div
        className="bg-gray-950 border-t border-gray-800 rounded-t-3xl overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh', animation: 'slideUp 0.3s ease' }}
      >
        {children}
      </div>
    </div>
  );
}

// ── League table content ───────────────────────────────────────────
function TableContent({ table, playerClubId }: { table: LeagueTableRow[]; playerClubId: string }) {
  const sorted = [...table].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });

  const allZero    = sorted.every(r => r.p === 0);
  const playerPos  = sorted.findIndex(r => r.clubId === playerClubId);
  const start      = allZero ? 0 : Math.max(0, Math.min(playerPos - 3, sorted.length - 7));
  const end        = allZero ? sorted.length : Math.min(sorted.length, start + 7);
  const visible    = allZero ? sorted : sorted.slice(start, end);

  return (
    <>
      <div className="px-5 pt-5 pb-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-black text-white">Premier League</h2>
          {!allZero && (
            <p className="text-[10px] text-gray-600 mt-0.5">Showing positions {start + 1}–{end}</p>
          )}
        </div>
        {!allZero && playerPos >= 0 && (
          <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-sm font-black text-amber-400">
            #{playerPos + 1}
          </span>
        )}
      </div>
      <div className="overflow-y-auto flex-1 px-4 py-3 pb-6">
        {/* Column headers */}
        <div className="flex items-center gap-1 px-2 py-1 mb-1">
          <span className="w-6 text-[9px] text-gray-600">#</span>
          <span className="flex-1 text-[9px] text-gray-600 uppercase">Club</span>
          <span className="w-5 text-center text-[9px] text-gray-600">P</span>
          <span className="w-5 text-center text-[9px] text-gray-600">W</span>
          <span className="w-5 text-center text-[9px] text-gray-600">D</span>
          <span className="w-5 text-center text-[9px] text-gray-600">L</span>
          <span className="w-7 text-center text-[9px] text-gray-600">GD</span>
          <span className="w-7 text-center text-[9px] text-gray-600 font-bold">Pts</span>
          <span className="w-12 text-[9px] text-gray-600 text-right">Form</span>
        </div>

        {!allZero && start > 0 && (
          <p className="text-center text-[9px] text-gray-700 py-1">· · ·</p>
        )}

        {visible.map((row, vi) => {
          const pos      = (allZero ? vi : start + vi) + 1;
          const isPlayer = row.clubId === playerClubId;
          const gd       = row.gf - row.ga;
          const posColor = pos <= 4 ? 'text-blue-400' : pos >= 18 ? 'text-red-400' : isPlayer ? 'text-amber-400' : 'text-gray-600';
          return (
            <div
              key={row.clubId}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${isPlayer ? 'bg-amber-500/10 border border-amber-500/20' : vi % 2 === 0 ? 'bg-gray-900/30' : ''}`}
            >
              <span className={`w-6 text-xs font-bold ${posColor}`}>{pos}</span>
              <span className={`flex-1 text-xs font-bold truncate ${isPlayer ? 'text-amber-300' : 'text-white'}`}>
                {isPlayer ? '★ ' : ''}{row.name}
              </span>
              <span className="w-5 text-center text-xs text-gray-500">{row.p}</span>
              <span className="w-5 text-center text-xs text-gray-500">{row.w}</span>
              <span className="w-5 text-center text-xs text-gray-500">{row.d}</span>
              <span className="w-5 text-center text-xs text-gray-500">{row.l}</span>
              <span className={`w-7 text-center text-xs ${gd > 0 ? 'text-green-400' : gd < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                {gd > 0 ? '+' : ''}{gd}
              </span>
              <span className={`w-7 text-center text-xs font-black ${isPlayer ? 'text-amber-400' : 'text-white'}`}>{row.pts}</span>
              <div className="w-12 flex justify-end gap-0.5">
                {row.form.slice(-5).map((r, i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full ${r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-amber-500' : 'bg-red-500'}`}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {!allZero && end < sorted.length && (
          <p className="text-center text-[9px] text-gray-700 py-1">· · ·</p>
        )}
      </div>
    </>
  );
}

// ── Squad content ──────────────────────────────────────────────────
function SquadContent({
  teammates,
  playerName,
  playerPosition,
}: {
  teammates: BDTeammate[];
  playerName: string;
  playerPosition: BDPosition;
}) {
  const posLabel: Record<BDPosition, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', ATT: 'FWD' };
  return (
    <>
      <div className="px-5 pt-5 pb-3 border-b border-gray-800 shrink-0">
        <h2 className="text-sm font-black text-white">Your Squad</h2>
        <p className="text-[10px] text-gray-600 mt-0.5">Key teammates this season</p>
      </div>
      <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3 pb-8">
        {/* You */}
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3">
          <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-black text-black">{posLabel[playerPosition]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-amber-300 truncate">★ {playerName}</p>
            <p className="text-[10px] text-gray-500">You</p>
          </div>
        </div>

        {teammates.length === 0 && (
          <p className="text-sm text-gray-600 text-center py-4">
            Teammates will appear here after your club is chosen.
          </p>
        )}

        {teammates.map(tm => {
          const isDefGK = tm.position === 'DEF' || tm.position === 'GK';
          const hasData = tm.appearances > 0;
          return (
            <div key={tm.name} className="rounded-xl border border-gray-800 bg-gray-900 p-3">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-black text-gray-400">{posLabel[tm.position]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{tm.name}</p>
                  <p className="text-[10px] text-gray-500">{tm.role}</p>
                </div>
                {hasData && (
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black ${tm.avgRating >= 7.5 ? 'text-amber-400' : 'text-white'}`}>
                      {tm.avgRating.toFixed(1)}
                    </p>
                    <p className="text-[9px] text-gray-600">Avg</p>
                  </div>
                )}
              </div>
              {hasData ? (
                <div className="flex gap-4 pt-2 border-t border-gray-800">
                  {!isDefGK && (
                    <>
                      <div className="text-center">
                        <p className="text-sm font-black text-white">{tm.goals}</p>
                        <p className="text-[9px] text-gray-600">Goals</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-white">{tm.assists}</p>
                        <p className="text-[9px] text-gray-600">Assists</p>
                      </div>
                    </>
                  )}
                  {isDefGK && (
                    <div className="text-center">
                      <p className="text-sm font-black text-white">{tm.cleanSheets}</p>
                      <p className="text-[9px] text-gray-600">Clean Sheets</p>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-sm font-black text-white">{tm.appearances}</p>
                    <p className="text-[9px] text-gray-600">Apps</p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-gray-700 pt-2 border-t border-gray-800">No matches played yet</p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
