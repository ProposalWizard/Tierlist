"use client";

import { useState, useEffect, useRef } from "react";
import type {
  BDSeason as SeasonData,
  BDPlayer,
  BDEvent,
  BDPosition,
  LeagueTableRow,
  BDTeammate,
  EventChoice,
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

const EFFECT_META: Record<string, { label: string; emoji: string; decimal?: boolean }> = {
  goals:        { label: 'Goals',           emoji: '⚽' },
  assists:      { label: 'Assists',          emoji: '🎯' },
  cleanSheets:  { label: 'Clean Sheets',     emoji: '🧤' },
  manOfTheMatch:{ label: 'Player of Match',  emoji: '⭐' },
  avgRating:    { label: 'Avg Rating',       emoji: '📊', decimal: true },
  appearances:  { label: 'Appearances',      emoji: '📅' },
  fitness:      { label: 'Fitness',          emoji: '💪' },
  morale:       { label: 'Morale',           emoji: '😊' },
  fame:         { label: 'Fame',             emoji: '🌟' },
  overall:      { label: 'Overall',          emoji: '🔝' },
  energy:       { label: 'Energy',           emoji: '⚡' },
  money:        { label: 'Earnings',         emoji: '💰' },
};

function formatMoney(k: number): string {
  if (k >= 1000) return `£${(k / 1000).toFixed(1)}M`;
  return `£${k}k`;
}

// ── Shop config ────────────────────────────────────────────────────
const SHOP_ITEMS = [
  { id: 'energy',   emoji: '⚡', name: 'Energy Boost',         desc: '+30 Energy instantly',              price: 500,  stat: '+30 Energy'  },
  { id: 'boots',    emoji: '👟', name: 'Premium Boots',         desc: '+0.10 season avg rating',           price: 1500, stat: '+0.10 Rating' },
  { id: 'trainer',  emoji: '🏋️', name: 'Personal Trainer',      desc: '+12 Fitness for the rest of season', price: 2000, stat: '+12 Fitness' },
  { id: 'pr',       emoji: '📱', name: 'PR Agency',              desc: '+15 Fame — global exposure',         price: 1000, stat: '+15 Fame'    },
  { id: 'psych',    emoji: '🧘', name: 'Sports Psychologist',    desc: '+10 Morale — mental edge',           price: 800,  stat: '+10 Morale'  },
];

// ── Slot symbols ───────────────────────────────────────────────────
const SLOT_SYMS = ['⚽', '🏆', '⭐', '💰', '7️⃣', '💎', '🔥', '🎯'];

// ── Types ──────────────────────────────────────────────────────────
interface LastResult {
  type: 'match' | 'lifestyle';
  eventTitle: string;
  choiceLabel: string;
  choiceEmoji: string;
  outcomeText: string;
  effects?: EventChoice['effects'];
  matchResult?: BDEvent['matchResult'];
  matchContext?: BDEvent['matchContext'];
  clubName?: string;
}

interface Props {
  season: SeasonData;
  player: BDPlayer;
  onUpdate: (s: SeasonData) => void;
  onReturnToHub?: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export default function BDSeason({ season, player, onUpdate, onReturnToHub }: Props) {
  const [activeTab, setActiveTab] = useState<'home' | 'stats' | 'casino' | 'shop'>('home');
  const [statsView, setStatsView] = useState<'table' | 'squad'>('table');
  const [gamePhase, setGamePhase] = useState<'choices' | 'revealing' | 'result'>('choices');
  const [pendingUpdated, setPendingUpdated] = useState<SeasonData | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [quickNote, setQuickNote] = useState<string | null>(null);

  const currentIdx  = season.events.findIndex(e => !e.chosenId);
  const currentEvent = currentIdx >= 0 ? season.events[currentIdx] : null;
  const isAllDone   = currentIdx === -1;
  const completedCount = season.events.filter(e => e.chosenId).length;
  const energy = season.energy ?? 85;
  const money  = season.money ?? 3000;
  const isDefOrGK = player.position === 'GK' || player.position === 'DEF';
  const totalGoals   = season.baseStats.goals   + season.eventStats.goals;
  const totalAssists = season.baseStats.assists  + season.eventStats.assists;
  const totalCS      = season.baseStats.cleanSheets + season.eventStats.cleanSheets;
  const totalRating  = Number((season.baseStats.avgRating + season.eventStats.avgRating).toFixed(1));

  const displayTable     = gamePhase === 'result' && pendingUpdated ? pendingUpdated.leagueTable     : season.leagueTable;
  const displayTeammates = gamePhase === 'result' && pendingUpdated ? pendingUpdated.teammates : season.teammates;

  useEffect(() => {
    if (gamePhase !== 'result') {
      setGamePhase('choices');
      setPendingUpdated(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.id]);

  function handleChoice(eventId: string, choiceId: string) {
    const ev = season.events.find(e => e.id === eventId);
    if (!ev) return;
    if (ev.category === 'match') {
      setGamePhase('revealing');
      setActiveTab('home');
      setTimeout(() => {
        const updated = applyChoice(season, eventId, choiceId, player.position);
        const resolved = updated.events.find(e => e.id === eventId);
        setPendingUpdated(updated);
        setLastResult({
          type: 'match',
          eventTitle: ev.title,
          choiceLabel: ev.choices.find(c => c.id === choiceId)?.label ?? '',
          choiceEmoji: ev.choices.find(c => c.id === choiceId)?.emoji ?? '⚽',
          outcomeText: resolved?.outcomeText ?? '',
          matchResult: resolved?.matchResult,
          matchContext: ev.matchContext,
          clubName: season.club.name,
        });
        setGamePhase('result');
      }, 800);
    } else {
      const updated = applyChoice(season, eventId, choiceId, player.position);
      const choice  = ev.choices.find(c => c.id === choiceId);
      setPendingUpdated(updated);
      setLastResult({
        type: 'lifestyle',
        eventTitle: ev.title,
        choiceLabel: choice?.label ?? '',
        choiceEmoji: choice?.emoji ?? '•',
        outcomeText: choice?.outcome ?? '',
        effects: choice?.effects ?? {},
      });
      setGamePhase('result');
    }
  }

  function handleContinue() {
    if (pendingUpdated) onUpdate(pendingUpdated);
    setPendingUpdated(null);
    setLastResult(null);
    setGamePhase('choices');
  }

  function handleSeeTable() {
    // Commit the match result first, then show the table
    if (pendingUpdated) onUpdate(pendingUpdated);
    setPendingUpdated(null);
    setLastResult(null);
    setGamePhase('choices');
    setActiveTab('stats');
    setStatsView('table');
  }

  function handleQuickAction(action: 'rest' | 'train' | 'social') {
    const e = season.energy ?? 85;
    let note = '';
    let updated: SeasonData;
    switch (action) {
      case 'rest':
        if (e >= 100) { setQuickNote('Already at full energy!'); return; }
        updated = { ...season, energy: Math.min(100, e + 20) };
        note = `+${Math.min(100, e + 20) - e} Energy — feeling fresh!`;
        break;
      case 'train':
        if (e < 15) { setQuickNote('Not enough energy to train'); return; }
        updated = { ...season, energy: Math.max(0, e - 15), eventStats: { ...season.eventStats, avgRating: Number((season.eventStats.avgRating + 0.05).toFixed(2)) } };
        note = '+0.05 Rating — great session!';
        break;
      case 'social':
        if (e < 8) { setQuickNote('Not enough energy to post'); return; }
        updated = { ...season, energy: Math.max(0, e - 8), attributes: { ...season.attributes, fame: Math.min(100, season.attributes.fame + 5) } };
        note = '+5 Fame — trending online!';
        break;
      default:
        return;
    }
    onUpdate(updated);
    setQuickNote(note);
    setTimeout(() => setQuickNote(null), 2500);
  }

  function handleCasinoResult(netChange: number) {
    // If we're mid-result, apply to pending so it doesn't get overwritten
    const base = pendingUpdated ?? season;
    const updated = { ...base, money: Math.max(0, (base.money ?? 3000) + netChange) };
    if (pendingUpdated) setPendingUpdated(updated);
    else onUpdate(updated);
  }

  function handlePurchase(itemId: string, cost: number) {
    const base = pendingUpdated ?? season;
    if ((base.money ?? 0) < cost) return;
    const withMoney = { ...base, money: (base.money ?? 0) - cost };
    let updated = withMoney;
    switch (itemId) {
      case 'energy':  updated = { ...withMoney, energy: Math.min(100, (withMoney.energy ?? 85) + 30) }; break;
      case 'boots':   updated = { ...withMoney, eventStats: { ...withMoney.eventStats, avgRating: Number((withMoney.eventStats.avgRating + 0.10).toFixed(2)) } }; break;
      case 'trainer': updated = { ...withMoney, attributes: { ...withMoney.attributes, fitness: Math.min(100, withMoney.attributes.fitness + 12) } }; break;
      case 'pr':      updated = { ...withMoney, attributes: { ...withMoney.attributes, fame: Math.min(100, withMoney.attributes.fame + 15) } }; break;
      case 'psych':   updated = { ...withMoney, attributes: { ...withMoney.attributes, morale: Math.min(100, withMoney.attributes.morale + 10) } }; break;
    }
    if (pendingUpdated) setPendingUpdated(updated);
    else onUpdate(updated);
  }

  const lockNav = gamePhase === 'revealing';
  const displayMoney = (pendingUpdated?.money ?? money);
  const displayEnergy = (pendingUpdated?.energy ?? energy);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-gray-800/80">
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center gap-3">
          {onReturnToHub && (
            <button onClick={onReturnToHub} className="shrink-0 text-gray-500 hover:text-amber-400 transition text-xs font-medium">
              ← Hub
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">
              Season {season.number} · {season.year}/{String(season.year + 1).slice(2)} · {season.club.name}
            </p>
            <p className="text-sm font-black text-white truncate">{player.name}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {!isDefOrGK ? (
              <>
                <MiniStat label="G" value={totalGoals} />
                <MiniStat label="A" value={totalAssists} />
              </>
            ) : (
              <MiniStat label="CS" value={totalCS} />
            )}
            <MiniStat label="RAT" value={totalRating.toFixed(1)} gold />
          </div>
        </div>
        <div className="px-4 pb-2">
          <TimelineDots events={season.events} currentIdx={currentIdx} />
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto pb-20">

        {activeTab === 'home' && (
          <HomeTab
            season={season}
            player={player}
            gamePhase={gamePhase}
            currentEvent={currentEvent}
            isAllDone={isAllDone}
            completedCount={completedCount}
            lastResult={lastResult}
            energy={displayEnergy}
            money={displayMoney}
            quickNote={quickNote}
            onChoice={handleChoice}
            onContinue={handleContinue}
            onSeeTable={handleSeeTable}
            onQuickAction={handleQuickAction}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab
            table={displayTable ?? []}
            playerClubId={season.club.id}
            teammates={displayTeammates ?? []}
            playerName={player.name}
            playerPosition={player.position}
            view={statsView}
            onViewChange={setStatsView}
          />
        )}

        {activeTab === 'casino' && (
          <CasinoTab money={displayMoney} onResult={handleCasinoResult} />
        )}

        {activeTab === 'shop' && (
          <ShopTab money={displayMoney} energy={displayEnergy} season={pendingUpdated ?? season} onPurchase={handlePurchase} />
        )}
      </div>

      {/* ── Bottom nav ── */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(t) => { if (!lockNav) setActiveTab(t as typeof activeTab); }}
        locked={lockNav}
      />
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
                  <span key={ev.id} className={[
                    'rounded-full transition-all duration-300',
                    current
                      ? `w-3 h-3 ${isMatch ? 'bg-green-400 shadow-green-400/60' : 'bg-amber-400 shadow-amber-400/60'} shadow-md`
                      : done
                      ? `w-2 h-2 ${isMatch ? 'bg-green-700' : 'bg-gray-600'}`
                      : `w-2 h-2 border ${isMatch ? 'border-green-800/60' : 'border-gray-700'} bg-transparent`,
                  ].join(' ')} />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Status bar ─────────────────────────────────────────────────────
function StatusBar({ energy, money }: { energy: number; money: number }) {
  const eColor = energy > 60 ? 'bg-green-500' : energy > 30 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-xl bg-gray-900 border border-gray-800 px-3 py-2">
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-gray-500">⚡ ENERGY</span>
          <span className="text-[10px] font-bold text-white">{energy}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-800">
          <div className={`h-1.5 rounded-full transition-all ${eColor}`} style={{ width: `${energy}%` }} />
        </div>
      </div>
      <div className="rounded-xl bg-gray-900 border border-gray-800 px-3 py-2.5 shrink-0">
        <p className="text-[10px] text-gray-500">💰 BAL</p>
        <p className="text-sm font-black text-amber-400">{formatMoney(money)}</p>
      </div>
    </div>
  );
}

// ── Quick actions ──────────────────────────────────────────────────
function QuickActions({ energy, note, onAction }: { energy: number; note: string | null; onAction: (a: 'rest' | 'train' | 'social') => void }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-700 mb-2">Quick Actions</p>
      <div className="grid grid-cols-3 gap-2">
        {([
          { id: 'rest'   as const, emoji: '😴', label: 'Rest',  sub: '+20 Energy', cost: 0,  color: 'hover:border-green-700/40'  },
          { id: 'train'  as const, emoji: '🏋️', label: 'Train', sub: '−15⚡ +Rating', cost: 15, color: 'hover:border-blue-700/40'   },
          { id: 'social' as const, emoji: '📱', label: 'Post',  sub: '−8⚡ +Fame', cost: 8,  color: 'hover:border-purple-700/40' },
        ] as const).map(({ id, emoji, label, sub, cost, color }) => {
          const disabled = energy < cost;
          return (
            <button
              key={id}
              onClick={() => onAction(id)}
              disabled={disabled}
              className={`rounded-xl border border-gray-800 bg-gray-900 p-3 text-center transition ${disabled ? 'opacity-40 cursor-not-allowed' : color}`}
            >
              <p className="text-xl mb-1">{emoji}</p>
              <p className="text-[10px] font-bold text-white">{label}</p>
              <p className="text-[9px] text-gray-500 mt-0.5">{sub}</p>
            </button>
          );
        })}
      </div>
      {note && (
        <p className="mt-2 text-center text-xs text-amber-400 font-semibold" style={{ animation: 'fadeIn 0.2s ease' }}>
          {note}
        </p>
      )}
    </div>
  );
}

// ── Home tab ───────────────────────────────────────────────────────
function HomeTab({
  season, player, gamePhase, currentEvent, isAllDone, completedCount,
  lastResult, energy, money, quickNote,
  onChoice, onContinue, onSeeTable, onQuickAction,
}: {
  season: SeasonData; player: BDPlayer; gamePhase: 'choices' | 'revealing' | 'result';
  currentEvent: BDEvent | null; isAllDone: boolean; completedCount: number;
  lastResult: LastResult | null; energy: number; money: number; quickNote: string | null;
  onChoice: (eid: string, cid: string) => void; onContinue: () => void;
  onSeeTable: () => void; onQuickAction: (a: 'rest' | 'train' | 'social') => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-3">
      <StatusBar energy={energy} money={money} />

      {gamePhase === 'revealing' && <MatchRevealCard />}

      {gamePhase === 'result' && lastResult && (
        lastResult.type === 'match'
          ? <MatchResultCard result={lastResult} position={player.position} onContinue={onContinue} onSeeTable={onSeeTable} />
          : <LifestyleResultCard result={lastResult} onContinue={onContinue} />
      )}

      {gamePhase === 'choices' && currentEvent && !isAllDone && (
        <CurrentEventCard event={currentEvent} season={season} onChoice={(id) => onChoice(currentEvent.id, id)} />
      )}

      {gamePhase === 'choices' && isAllDone && (
        <div className="rounded-2xl border border-amber-800/30 bg-amber-950/15 p-7 text-center">
          <p className="text-4xl mb-3">⏳</p>
          <p className="text-base font-black text-amber-400 mb-1">Season Complete</p>
          <p className="text-sm text-gray-500">Calculating trophies & Ballon d'Or nominations…</p>
        </div>
      )}

      {gamePhase === 'choices' && !isAllDone && (
        <QuickActions energy={energy} note={quickNote} onAction={onQuickAction} />
      )}

      {gamePhase === 'choices' && completedCount > 0 && (
        <SeasonDiary events={season.events} />
      )}
    </div>
  );
}

// ── Current event card ─────────────────────────────────────────────
function CurrentEventCard({ event, season, onChoice }: { event: BDEvent; season: SeasonData; onChoice: (id: string) => void }) {
  const ctx  = event.matchContext;
  const comp = ctx ? (COMP[ctx.competition] ?? COMP['Premier League']) : null;

  return (
    <div className="space-y-3">
      {ctx && comp && (
        <div className={`rounded-2xl border p-4 ${comp.bg} ${comp.border}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${comp.bg} ${comp.border} ${comp.text}`}>
              {comp.icon} {ctx.competition}
            </span>
            <span className="text-[10px] text-gray-500 font-semibold">
              {ctx.matchweek === 0 ? 'Pre-Season' : `Matchweek ${ctx.matchweek}`}
            </span>
          </div>
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
          <div className="flex items-center justify-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={`block w-2.5 h-2.5 rounded-full ${i <= Math.ceil(ctx.opponentPrestige / 20) ? 'bg-amber-500' : 'bg-gray-800'}`} />
              ))}
            </div>
            <span className="text-[10px] text-gray-500">
              {ctx.opponentPrestige >= 92 ? 'Elite' : ctx.opponentPrestige >= 82 ? 'Strong' : ctx.opponentPrestige >= 72 ? 'Solid' : 'Beatable'}
            </span>
          </div>
        </div>
      )}

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
              <button key={choice.id} onClick={() => onChoice(choice.id)}
                className="w-full rounded-xl border border-gray-700 bg-gray-800/40 p-4 text-left transition hover:border-amber-500/40 hover:bg-gray-800">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-white leading-snug">{choice.emoji} {choice.label}</p>
                  {h && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${h.bg} ${h.text}`}>{h.label}</span>}
                </div>
                {choice.description && <p className="text-xs text-gray-500 leading-relaxed">{choice.description}</p>}
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
    <div className="rounded-2xl border border-gray-700 bg-gray-900 py-12 text-center" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-800 mb-4">
        <span className="text-3xl animate-spin" style={{ animationDuration: '0.8s' }}>⚽</span>
      </div>
      <p className="text-lg font-black text-white mb-1">Match Day</p>
      <p className="text-sm text-gray-500 mb-5">Simulating result…</p>
      <div className="flex justify-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full bg-amber-400 opacity-0"
            style={{ animation: `fadeIn 0.4s ease ${i * 0.2 + 0.2}s forwards` }} />
        ))}
      </div>
    </div>
  );
}

// ── Match: result card ─────────────────────────────────────────────
function MatchResultCard({ result, position, onContinue, onSeeTable }: {
  result: LastResult; position: BDPosition; onContinue: () => void; onSeeTable: () => void;
}) {
  const mr  = result.matchResult!;
  const ctx = result.matchContext!;
  const club = result.clubName ?? '';

  const home = ctx.isHome ? club : ctx.opponent;
  const away = ctx.isHome ? ctx.opponent : club;
  const hg   = ctx.isHome ? mr.teamGoals : mr.opponentGoals;
  const ag   = ctx.isHome ? mr.opponentGoals : mr.teamGoals;

  const isDefOrGK = position === 'GK' || position === 'DEF';
  const hatTrick  = mr.playerGoals >= 3;
  const motm      = mr.playerRating >= 9.0;
  const nightmare = mr.playerRating < 6.0;

  const resultGrad  = mr.isWin ? 'from-green-950/40 border-green-700/30' : mr.isDraw ? 'from-amber-950/40 border-amber-700/30' : 'from-red-950/40 border-red-700/30';
  const resultLabel = mr.isWin ? 'WIN' : mr.isDraw ? 'DRAW' : 'LOSS';
  const resultColor = mr.isWin ? 'text-green-400' : mr.isDraw ? 'text-amber-400' : 'text-red-400';
  const comp = COMP[ctx.competition] ?? COMP['Premier League'];
  const isPL = ctx.competition === 'Premier League';

  return (
    <div className="space-y-3" style={{ animation: 'fadeSlideIn 0.4s ease' }}>
      <div className={`rounded-2xl border bg-gradient-to-b to-gray-900 p-5 ${resultGrad}`}>
        <div className="flex items-center justify-between mb-4">
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${comp.bg} ${comp.border} ${comp.text}`}>
            {comp.icon} {ctx.competition}
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-black bg-gray-950/50 ${resultColor}`}>{resultLabel}</span>
        </div>

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

        <div className="flex items-center justify-center gap-6">
          {!isDefOrGK && (
            <>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{mr.playerGoals}</p>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Goals</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{mr.playerAssists}</p>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Assists</p>
              </div>
            </>
          )}
          {isDefOrGK && mr.cleanSheet && (
            <div className="text-center">
              <p className="text-2xl">🧤</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Clean Sheet</p>
            </div>
          )}
          <div className="text-center">
            <p className={`text-2xl font-black ${mr.playerRating >= 8 ? 'text-amber-400' : nightmare ? 'text-red-400' : 'text-white'}`}>
              {mr.playerRating.toFixed(1)}
            </p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Rating</p>
          </div>
        </div>
      </div>

      {result.outcomeText && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
          <p className="text-xs text-gray-400 leading-relaxed">{result.outcomeText}</p>
        </div>
      )}

      <div className="flex gap-2">
        {isPL && (
          <button onClick={onSeeTable} className="flex-1 rounded-xl border border-purple-800/40 bg-purple-950/20 py-3 text-sm font-bold text-purple-300 transition hover:bg-purple-900/30">
            📊 Table
          </button>
        )}
        <button onClick={onContinue} className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-black text-black transition hover:bg-amber-400">
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Lifestyle result card (NEW) ────────────────────────────────────
function LifestyleResultCard({ result, onContinue }: { result: LastResult; onContinue: () => void }) {
  const effects = result.effects ?? {};
  const deltas = Object.entries(effects).filter(([, v]) => v !== undefined && v !== 0);

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-900 overflow-hidden" style={{ animation: 'fadeSlideIn 0.3s ease' }}>
      {/* Header */}
      <div className="p-5 border-b border-gray-800">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2">{result.eventTitle}</p>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{result.choiceEmoji}</span>
          <p className="text-sm font-bold text-white">{result.choiceLabel}</p>
        </div>
        {result.outcomeText && (
          <p className="text-sm text-gray-400 leading-relaxed italic">"{result.outcomeText}"</p>
        )}
      </div>

      {/* Stat changes */}
      {deltas.length > 0 && (
        <div className="p-5 border-b border-gray-800 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-3">What Changed</p>
          {deltas.map(([key, val]) => {
            const meta = EFFECT_META[key];
            if (!meta || !val) return null;
            const pos = (val as number) > 0;
            const formatted = meta.decimal
              ? (pos ? `+${(val as number).toFixed(2)}` : (val as number).toFixed(2))
              : (pos ? `+${val}` : `${val}`);
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{meta.emoji} {meta.label}</span>
                <span className={`text-sm font-black ${pos ? 'text-green-400' : 'text-red-400'}`}>{formatted}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4">
        <button onClick={onContinue} className="w-full rounded-xl bg-amber-500 py-3 text-sm font-black text-black hover:bg-amber-400 transition">
          Continue →
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
          const bg = isMatch && mr ? (mr.isWin ? 'bg-green-950/30 border-green-900/30' : mr.isDraw ? 'bg-amber-950/30 border-amber-900/30' : 'bg-red-950/30 border-red-900/30') : 'bg-gray-900 border-gray-800/50';
          return (
            <div key={ev.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${bg}`}>
              <span className="text-base shrink-0">{ch?.emoji ?? '•'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-300 truncate">{ev.title}</p>
                {isMatch && mr
                  ? <p className="text-[10px] text-gray-600">{mr.teamGoals}–{mr.opponentGoals} · {mr.isWin ? 'W' : mr.isDraw ? 'D' : 'L'} · {mr.playerRating.toFixed(1)} rating{mr.playerGoals > 0 ? ` · ${mr.playerGoals}G` : ''}{mr.playerAssists > 0 ? ` ${mr.playerAssists}A` : ''}</p>
                  : <p className="text-[10px] text-gray-600 truncate">{ch?.label ?? ''}</p>
                }
              </div>
              {isMatch && mr && (
                <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${mr.isWin ? 'bg-green-800 text-green-300' : mr.isDraw ? 'bg-amber-800 text-amber-300' : 'bg-red-900 text-red-300'}`}>
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

// ── Stats tab ──────────────────────────────────────────────────────
function StatsTab({ table, playerClubId, teammates, playerName, playerPosition, view, onViewChange }: {
  table: LeagueTableRow[]; playerClubId: string; teammates: BDTeammate[];
  playerName: string; playerPosition: BDPosition; view: 'table' | 'squad';
  onViewChange: (v: 'table' | 'squad') => void;
}) {
  return (
    <div>
      <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-4 py-3 flex gap-2 z-10">
        <button onClick={() => onViewChange('table')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${view === 'table' ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40' : 'bg-gray-900 text-gray-500 border border-gray-800'}`}>
          📊 Table
        </button>
        <button onClick={() => onViewChange('squad')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${view === 'squad' ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40' : 'bg-gray-900 text-gray-500 border border-gray-800'}`}>
          👥 Squad
        </button>
      </div>
      {view === 'table' && <FullTableView table={table} playerClubId={playerClubId} />}
      {view === 'squad' && <SquadView teammates={teammates} playerName={playerName} playerPosition={playerPosition} />}
    </div>
  );
}

// ── Full league table ──────────────────────────────────────────────
function FullTableView({ table, playerClubId }: { table: LeagueTableRow[]; playerClubId: string }) {
  const [showFull, setShowFull] = useState(false);

  const sorted = [...table].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });

  const allZero   = sorted.every(r => r.p === 0);
  const playerPos = sorted.findIndex(r => r.clubId === playerClubId);
  const start = allZero ? 0 : Math.max(0, Math.min(playerPos - 3, sorted.length - 7));
  const end   = allZero ? sorted.length : Math.min(sorted.length, start + 7);
  const visible = showFull || allZero ? sorted : sorted.slice(start, end);

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-black text-white">Premier League</h2>
          {!allZero && playerPos >= 0 && <p className="text-[10px] text-gray-600 mt-0.5">Your position: #{playerPos + 1}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!allZero && playerPos >= 0 && (
            <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-sm font-black text-amber-400">#{playerPos + 1}</span>
          )}
          {!allZero && (
            <button onClick={() => setShowFull(!showFull)} className="text-[10px] text-gray-500 hover:text-amber-400 transition px-2 py-1 rounded-lg border border-gray-800 bg-gray-900">
              {showFull ? 'Your 7' : 'All 20'}
            </button>
          )}
        </div>
      </div>

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

      {!showFull && !allZero && start > 0 && <p className="text-center text-[9px] text-gray-700 py-1">· · ·</p>}

      {visible.map((row, vi) => {
        const pos      = (showFull || allZero ? vi : start + vi) + 1;
        const isPlayer = row.clubId === playerClubId;
        const gd       = row.gf - row.ga;
        const posColor = pos <= 4 ? 'text-blue-400' : pos >= 18 ? 'text-red-400' : isPlayer ? 'text-amber-400' : 'text-gray-600';
        return (
          <div key={row.clubId} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 ${isPlayer ? 'bg-amber-500/10 border border-amber-500/20' : vi % 2 === 0 ? 'bg-gray-900/30' : ''}`}>
            <span className={`w-6 text-xs font-bold ${posColor}`}>{pos}</span>
            <span className={`flex-1 text-xs font-bold truncate ${isPlayer ? 'text-amber-300' : 'text-white'}`}>{isPlayer ? '★ ' : ''}{row.name}</span>
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
                <span key={i} className={`w-2 h-2 rounded-full ${r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-amber-500' : 'bg-red-500'}`} />
              ))}
            </div>
          </div>
        );
      })}

      {!showFull && !allZero && end < sorted.length && <p className="text-center text-[9px] text-gray-700 py-1">· · ·</p>}
    </div>
  );
}

// ── Squad view ─────────────────────────────────────────────────────
function SquadView({ teammates, playerName, playerPosition }: { teammates: BDTeammate[]; playerName: string; playerPosition: BDPosition }) {
  const posLabel: Record<BDPosition, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', ATT: 'FWD' };
  return (
    <div className="px-4 py-4 space-y-3">
      <div>
        <h2 className="text-sm font-black text-white">Your Squad</h2>
        <p className="text-[10px] text-gray-600 mt-0.5">Key teammates this season</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3">
        <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-black">{posLabel[playerPosition]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-amber-300 truncate">★ {playerName}</p>
          <p className="text-[10px] text-gray-500">You</p>
        </div>
      </div>

      {teammates.length === 0 && <p className="text-sm text-gray-600 text-center py-4">Teammates appear after matches are played.</p>}

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
                  <p className={`text-sm font-black ${tm.avgRating >= 7.5 ? 'text-amber-400' : 'text-white'}`}>{tm.avgRating.toFixed(1)}</p>
                  <p className="text-[9px] text-gray-600">Avg</p>
                </div>
              )}
            </div>
            {hasData ? (
              <div className="flex gap-4 pt-2 border-t border-gray-800">
                {!isDefGK && (
                  <>
                    <div className="text-center"><p className="text-sm font-black text-white">{tm.goals}</p><p className="text-[9px] text-gray-600">Goals</p></div>
                    <div className="text-center"><p className="text-sm font-black text-white">{tm.assists}</p><p className="text-[9px] text-gray-600">Assists</p></div>
                  </>
                )}
                {isDefGK && <div className="text-center"><p className="text-sm font-black text-white">{tm.cleanSheets}</p><p className="text-[9px] text-gray-600">Clean Sheets</p></div>}
                <div className="text-center"><p className="text-sm font-black text-white">{tm.appearances}</p><p className="text-[9px] text-gray-600">Apps</p></div>
              </div>
            ) : (
              <p className="text-[10px] text-gray-700 pt-2 border-t border-gray-800">No matches played yet</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Casino tab ─────────────────────────────────────────────────────
function CasinoTab({ money, onResult }: { money: number; onResult: (net: number) => void }) {
  const [game, setGame] = useState<'menu' | 'coin' | 'slots'>('menu');

  if (game === 'coin') return <CoinFlipGame money={money} onResult={onResult} onBack={() => setGame('menu')} />;
  if (game === 'slots') return <SlotsGame money={money} onResult={onResult} onBack={() => setGame('menu')} />;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="text-center mb-2">
        <p className="text-4xl mb-2">🎰</p>
        <h2 className="text-lg font-black text-white">Casino</h2>
        <p className="text-sm text-gray-500">Balance: {formatMoney(money)}</p>
      </div>
      {money < 50 && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-center">
          <p className="text-sm text-red-400 font-bold">Broke! Win matches or visit the Shop to earn more.</p>
        </div>
      )}
      {[
        { id: 'coin' as const, emoji: '🪙', name: 'Coin Flip', desc: 'Pick heads or tails — 50/50 odds. Double or nothing.' },
        { id: 'slots' as const, emoji: '🎰', name: 'Slot Machine', desc: 'Spin 3 reels. Match symbols to win up to ×20.' },
      ].map(g => (
        <button key={g.id} onClick={() => setGame(g.id)} disabled={money < 50}
          className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left hover:border-amber-600/40 transition disabled:opacity-40">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{g.emoji}</span>
            <div>
              <p className="text-base font-black text-white">{g.name}</p>
              <p className="text-sm text-gray-500">{g.desc}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Coin flip game ─────────────────────────────────────────────────
function CoinFlipGame({ money, onResult, onBack }: { money: number; onResult: (net: number) => void; onBack: () => void }) {
  const [bet, setBet] = useState(100);
  const [flipping, setFlipping] = useState(false);
  const [outcome, setOutcome] = useState<{ won: boolean; landed: 'heads' | 'tails'; picked: 'heads' | 'tails' } | null>(null);

  const bets = [50, 100, 250, 500].filter(b => b <= money);

  function flip(picked: 'heads' | 'tails') {
    if (flipping || money < bet) return;
    setFlipping(true);
    setOutcome(null);
    setTimeout(() => {
      const landed: 'heads' | 'tails' = Math.random() > 0.5 ? 'heads' : 'tails';
      const won = landed === picked;
      setOutcome({ won, landed, picked });
      onResult(won ? bet : -bet);
      setFlipping(false);
    }, 1200);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-amber-400 transition">← Back to Casino</button>
      <div className="text-center py-4">
        <p className={`text-6xl mb-3 block transition-transform ${flipping ? 'animate-spin' : ''}`} style={{ animationDuration: '0.5s' }}>🪙</p>
        <p className="text-base font-black text-white">Coin Flip</p>
        <p className="text-sm text-gray-500">Balance: {formatMoney(money)}</p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2">Bet Amount</p>
        <div className="flex gap-2 flex-wrap">
          {bets.map(b => (
            <button key={b} onClick={() => setBet(b)}
              className={`flex-1 min-w-[60px] rounded-xl border py-2.5 text-sm font-bold transition ${bet === b ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-gray-800 bg-gray-900 text-gray-400 hover:border-gray-600'}`}>
              {formatMoney(b)}
            </button>
          ))}
        </div>
      </div>

      {outcome && !flipping && (
        <div className={`rounded-2xl border p-5 text-center ${outcome.won ? 'border-green-700/40 bg-green-950/20' : 'border-red-700/40 bg-red-950/20'}`} style={{ animation: 'fadeSlideIn 0.3s ease' }}>
          <p className="text-3xl mb-2">{outcome.landed === 'heads' ? '🟡' : '⚫'}</p>
          <p className={`text-lg font-black mb-1 ${outcome.won ? 'text-green-400' : 'text-red-400'}`}>
            {outcome.won ? `+${formatMoney(bet)} WIN!` : `-${formatMoney(bet)} LOSS`}
          </p>
          <p className="text-xs text-gray-500">Landed: {outcome.landed} · You picked: {outcome.picked}</p>
        </div>
      )}

      {!flipping && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => flip('heads')} disabled={money < bet}
            className="rounded-xl bg-amber-500 py-4 text-base font-black text-black hover:bg-amber-400 transition disabled:opacity-40">
            🟡 Heads
          </button>
          <button onClick={() => flip('tails')} disabled={money < bet}
            className="rounded-xl bg-gray-700 py-4 text-base font-black text-white hover:bg-gray-600 transition disabled:opacity-40">
            ⚫ Tails
          </button>
        </div>
      )}
      {flipping && <p className="text-center text-sm text-gray-400 animate-pulse py-2">Flipping…</p>}
    </div>
  );
}

// ── Slots game ─────────────────────────────────────────────────────
function SlotsGame({ money, onResult, onBack }: { money: number; onResult: (net: number) => void; onBack: () => void }) {
  const [bet, setBet] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(['⚽', '🏆', '⭐']);
  const [winInfo, setWinInfo] = useState<{ net: number; label: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bets = [50, 100, 250].filter(b => b <= money);

  function spin() {
    if (spinning || money < bet) return;
    setSpinning(true);
    setWinInfo(null);

    intervalRef.current = setInterval(() => {
      setReels([
        SLOT_SYMS[Math.floor(Math.random() * SLOT_SYMS.length)],
        SLOT_SYMS[Math.floor(Math.random() * SLOT_SYMS.length)],
        SLOT_SYMS[Math.floor(Math.random() * SLOT_SYMS.length)],
      ]);
    }, 80);

    setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const r = [
        SLOT_SYMS[Math.floor(Math.random() * SLOT_SYMS.length)],
        SLOT_SYMS[Math.floor(Math.random() * SLOT_SYMS.length)],
        SLOT_SYMS[Math.floor(Math.random() * SLOT_SYMS.length)],
      ];
      setReels(r);

      let mult = 0, label = '';
      if (r[0] === r[1] && r[1] === r[2]) {
        if (r[0] === '💎') { mult = 20; label = '💎 JACKPOT! ×20'; }
        else if (r[0] === '7️⃣') { mult = 10; label = '7️⃣ Lucky Sevens! ×10'; }
        else if (r[0] === '🏆') { mult = 7; label = '🏆 Hat-Trick! ×7'; }
        else { mult = 5; label = '3 of a Kind! ×5'; }
      } else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) {
        mult = 2; label = '2 of a Kind ×2';
      } else {
        label = 'No match — try again';
      }

      const net = bet * mult - bet;
      setWinInfo({ net, label });
      onResult(net);
      setSpinning(false);
    }, 1400);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-amber-400 transition">← Back to Casino</button>
      <div className="text-center">
        <p className="text-base font-black text-white mb-0.5">Slot Machine</p>
        <p className="text-sm text-gray-500">Balance: {formatMoney(money)}</p>
      </div>

      <div className="rounded-2xl border border-amber-700/30 bg-amber-950/10 p-6">
        <div className="flex justify-center gap-3 mb-4">
          {reels.map((sym, i) => (
            <div key={i} className={`w-20 h-20 rounded-2xl bg-gray-900 border border-gray-700 flex items-center justify-center text-4xl transition-all ${spinning ? 'scale-95 opacity-80' : ''}`}>
              {sym}
            </div>
          ))}
        </div>
        {winInfo && !spinning && (
          <p className={`text-center text-sm font-black ${winInfo.net > 0 ? 'text-green-400' : winInfo.net === 0 ? 'text-amber-400' : 'text-red-400'}`} style={{ animation: 'fadeIn 0.3s ease' }}>
            {winInfo.label}{winInfo.net > 0 ? ` — +${formatMoney(winInfo.net)}` : winInfo.net < 0 ? ` — ${formatMoney(winInfo.net)}` : ''}
          </p>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2">Bet Amount</p>
        <div className="flex gap-2">
          {bets.map(b => (
            <button key={b} onClick={() => setBet(b)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition ${bet === b ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-gray-800 bg-gray-900 text-gray-400'}`}>
              {formatMoney(b)}
            </button>
          ))}
        </div>
      </div>

      <button onClick={spin} disabled={spinning || money < bet}
        className="w-full rounded-xl bg-amber-500 py-4 text-base font-black text-black hover:bg-amber-400 transition disabled:opacity-40">
        {spinning ? 'Spinning…' : '🎰 Spin!'}
      </button>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 mb-2">Payouts</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
          <p>💎💎💎 → ×20</p>
          <p>7️⃣7️⃣7️⃣ → ×10</p>
          <p>🏆🏆🏆 → ×7</p>
          <p>Any 3 same → ×5</p>
          <p>Any 2 same → ×2</p>
          <p>No match → lose bet</p>
        </div>
      </div>
    </div>
  );
}

// ── Shop tab ───────────────────────────────────────────────────────
function ShopTab({ money, energy, season, onPurchase }: {
  money: number; energy: number; season: SeasonData;
  onPurchase: (itemId: string, cost: number) => void;
}) {
  const [bought, setBought] = useState<Set<string>>(new Set());
  const [notif, setNotif] = useState<string | null>(null);

  function purchase(item: typeof SHOP_ITEMS[0]) {
    if (money < item.price || bought.has(item.id)) return;
    onPurchase(item.id, item.price);
    setBought(prev => { const s = new Set(Array.from(prev)); s.add(item.id); return s; });
    setNotif(`${item.emoji} ${item.name} purchased!`);
    setTimeout(() => setNotif(null), 2500);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-white">Player Store</h2>
          <p className="text-[10px] text-gray-500">Invest your earnings wisely</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500">Balance</p>
          <p className="text-sm font-black text-amber-400">{formatMoney(money)}</p>
        </div>
      </div>

      {notif && (
        <div className="rounded-xl bg-green-500/15 border border-green-500/30 px-4 py-2.5 text-sm font-bold text-green-400 text-center" style={{ animation: 'fadeIn 0.2s ease' }}>
          ✅ {notif}
        </div>
      )}

      <div className="space-y-3">
        {SHOP_ITEMS.map(item => {
          const canAfford    = money >= item.price;
          const alreadyBought = bought.has(item.id);
          // Energy item re-purchasable if below 70
          const blocked = alreadyBought && item.id !== 'energy';
          const reallyBought = blocked;

          return (
            <div key={item.id} className={`rounded-2xl border p-4 transition ${reallyBought ? 'border-green-800/30 bg-green-950/10' : canAfford ? 'border-gray-800 bg-gray-900' : 'border-gray-800/50 bg-gray-900/50 opacity-60'}`}>
              <div className="flex items-center gap-4">
                <span className="text-3xl shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{item.desc}</p>
                  <span className="inline-block mt-1.5 rounded-full bg-blue-500/15 border border-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-400">
                    {item.stat}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  {reallyBought ? (
                    <span className="text-sm font-bold text-green-400">✓</span>
                  ) : (
                    <button onClick={() => purchase(item)} disabled={!canAfford}
                      className={`rounded-xl px-4 py-2 text-sm font-black transition ${canAfford ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>
                      {formatMoney(item.price)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Current attributes */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Current Status</p>
        {[
          { label: 'Fitness', v: season.attributes.fitness, color: 'bg-green-500' },
          { label: 'Morale',  v: season.attributes.morale,  color: 'bg-blue-500'  },
          { label: 'Fame',    v: season.attributes.fame,    color: 'bg-amber-500' },
          { label: 'Energy',  v: energy,                    color: 'bg-cyan-500'  },
        ].map(({ label, v, color }) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-gray-500">{label}</span>
              <span className="text-[10px] font-bold text-white">{v}</span>
            </div>
            <div className="h-1 rounded-full bg-gray-800">
              <div className={`h-1 rounded-full ${color} transition-all`} style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bottom nav ─────────────────────────────────────────────────────
function BottomNav({ activeTab, onTabChange, locked }: { activeTab: string; onTabChange: (t: string) => void; locked: boolean }) {
  const tabs = [
    { id: 'home',   emoji: '🏠', label: 'Home'   },
    { id: 'stats',  emoji: '📊', label: 'Stats'  },
    { id: 'casino', emoji: '🎰', label: 'Casino' },
    { id: 'shop',   emoji: '🛒', label: 'Shop'   },
  ];
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-20 bg-gray-950/95 backdrop-blur border-t border-gray-800 transition-opacity ${locked ? 'opacity-30 pointer-events-none' : ''}`}>
      <div className="mx-auto max-w-lg flex">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center py-3 transition ${activeTab === tab.id ? 'text-amber-400' : 'text-gray-600 hover:text-gray-400'}`}>
            <span className="text-xl leading-none">{tab.emoji}</span>
            <span className="text-[9px] mt-1 font-semibold uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
