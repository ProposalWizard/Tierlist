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
import { applyChoice, applyManualMatchResult, CLUB_SQUADS } from "@/lib/ballonDorEngine";
import MatchGame from "./MatchGame";
import type { MatchGameResult } from "./MatchGame";

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
  { id: 'energy',    emoji: '⚡', name: 'Energy Drink',           desc: '+30 Energy instantly',                      price: 8,   stat: '+30 Energy'    },
  { id: 'boots',     emoji: '👟', name: 'Premium Boots',           desc: '+0.10 season avg rating',                   price: 20,  stat: '+0.10 Rating'  },
  { id: 'psych',     emoji: '🧘', name: 'Sports Psychologist',     desc: '+10 Morale — mental edge',                  price: 15,  stat: '+10 Morale'    },
  { id: 'nutrition', emoji: '🥗', name: 'Nutrition Plan',          desc: '+10 Fitness · +5 Energy — eat right',       price: 30,  stat: '+10 Fit +5⚡'  },
  { id: 'charity',   emoji: '💝', name: 'Charity Campaign',        desc: '+20 Morale — the fans love you',            price: 35,  stat: '+20 Morale'    },
  { id: 'trainer',   emoji: '🏋️', name: 'Personal Trainer',       desc: '+12 Fitness for the rest of season',        price: 40,  stat: '+12 Fitness'   },
  { id: 'pr',        emoji: '📱', name: 'PR Agency',               desc: '+15 Fame — global exposure',                price: 25,  stat: '+15 Fame'      },
  { id: 'agent',     emoji: '🤝', name: 'Agent Upgrade',           desc: '+10 Fame · unlocks bigger contract offers', price: 55,  stat: '+10 Fame'      },
  { id: 'camp',      emoji: '🏕️', name: 'Fitness Camp',           desc: '+20 Fitness — costs 15 Energy',             price: 70,  stat: '+20 Fit −15⚡'  },
  { id: 'house',     emoji: '🏠', name: 'Luxury Mansion',          desc: '+15 Morale · +10 Fame — living well',       price: 150, stat: '+15M +10F'     },
  { id: 'car',       emoji: '🚗', name: 'Supercar',                desc: '+20 Fame · +5 Morale — status symbol',      price: 250, stat: '+20F +5M'      },
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
  const [matchGameEvent, setMatchGameEvent] = useState<BDEvent | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [quickNote, setQuickNote] = useState<string | null>(null);
  // Tracks which quick actions have been used since the last event was resolved
  const [usedToday, setUsedToday] = useState<Set<string>>(new Set());

  const currentIdx  = season.events.findIndex(e => !e.chosenId);
  const currentEvent = currentIdx >= 0 ? season.events[currentIdx] : null;
  const isAllDone   = currentIdx === -1;
  const completedCount = season.events.filter(e => e.chosenId).length;
  const energy = season.energy ?? 85;
  const money  = season.money ?? 50;
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
    setUsedToday(new Set()); // reset quick actions for the next event
  }

  function handleSeeTable() {
    if (pendingUpdated) onUpdate(pendingUpdated);
    setPendingUpdated(null);
    setLastResult(null);
    setGamePhase('choices');
    setUsedToday(new Set());
    setActiveTab('stats');
    setStatsView('table');
  }

  function handleQuickAction(action: 'rest' | 'train' | 'social') {
    if (usedToday.has(action)) { setQuickNote('Already done that today — play the next event first!'); return; }
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
    setUsedToday(prev => { const s = new Set(Array.from(prev)); s.add(action); return s; });
    setQuickNote(note);
    setTimeout(() => setQuickNote(null), 2500);
  }

  function handlePlayMatch() {
    if (!currentEvent || currentEvent.category !== 'match') return;
    setMatchGameEvent(currentEvent);
    setActiveTab('home');
  }

  function handleMatchGameComplete(result: MatchGameResult) {
    if (!matchGameEvent || !matchGameEvent.matchContext) return;
    const updated = applyManualMatchResult(season, matchGameEvent.id, result, player.position);
    const resolved = updated.events.find(e => e.id === matchGameEvent.id);
    setPendingUpdated(updated);
    setLastResult({
      type: 'match',
      eventTitle: matchGameEvent.title,
      choiceLabel: 'Full-time',
      choiceEmoji: '⚽',
      outcomeText: resolved?.outcomeText ?? '',
      matchResult: resolved?.matchResult,
      matchContext: matchGameEvent.matchContext,
      clubName: season.club.name,
    });
    setMatchGameEvent(null);
    setGamePhase('result');
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
    // Enforce the one-per-season limit against persisted state (energy is repurchasable)
    const alreadyOwned = base.purchasedItems ?? [];
    if (itemId !== 'energy' && alreadyOwned.includes(itemId)) return;
    const withMoney = {
      ...base,
      money: (base.money ?? 0) - cost,
      purchasedItems: alreadyOwned.includes(itemId) ? alreadyOwned : [...alreadyOwned, itemId],
    };
    let updated = withMoney;
    switch (itemId) {
      case 'energy':  updated = { ...withMoney, energy: Math.min(100, (withMoney.energy ?? 85) + 30) }; break;
      case 'boots':   updated = { ...withMoney, eventStats: { ...withMoney.eventStats, avgRating: Number((withMoney.eventStats.avgRating + 0.10).toFixed(2)) } }; break;
      case 'trainer': updated = { ...withMoney, attributes: { ...withMoney.attributes, fitness: Math.min(100, withMoney.attributes.fitness + 12) } }; break;
      case 'pr':      updated = { ...withMoney, attributes: { ...withMoney.attributes, fame: Math.min(100, withMoney.attributes.fame + 15) } }; break;
      case 'psych':   updated = { ...withMoney, attributes: { ...withMoney.attributes, morale: Math.min(100, withMoney.attributes.morale + 10) } }; break;
      case 'house':   updated = { ...withMoney, attributes: { ...withMoney.attributes, morale: Math.min(100, withMoney.attributes.morale + 15), fame: Math.min(100, withMoney.attributes.fame + 10) } }; break;
      case 'car':      updated = { ...withMoney, attributes: { ...withMoney.attributes, fame: Math.min(100, withMoney.attributes.fame + 20), morale: Math.min(100, withMoney.attributes.morale + 5) } }; break;
      case 'nutrition': updated = { ...withMoney, energy: Math.min(100, (withMoney.energy ?? 85) + 5), attributes: { ...withMoney.attributes, fitness: Math.min(100, withMoney.attributes.fitness + 10) } }; break;
      case 'charity':   updated = { ...withMoney, attributes: { ...withMoney.attributes, morale: Math.min(100, withMoney.attributes.morale + 20) } }; break;
      case 'agent':     updated = { ...withMoney, attributes: { ...withMoney.attributes, fame: Math.min(100, withMoney.attributes.fame + 10) } }; break;
      case 'camp':      updated = { ...withMoney, energy: Math.max(0, (withMoney.energy ?? 85) - 15), attributes: { ...withMoney.attributes, fitness: Math.min(100, withMoney.attributes.fitness + 20) } }; break;
    }
    if (pendingUpdated) setPendingUpdated(updated);
    else onUpdate(updated);
  }

  const lockNav = gamePhase === 'revealing';
  const displayMoney = (pendingUpdated?.money ?? money);
  const displayEnergy = (pendingUpdated?.energy ?? energy);

  if (matchGameEvent && matchGameEvent.matchContext) {
    return (
      <MatchGame
        opponent={matchGameEvent.matchContext.opponent}
        competition={matchGameEvent.matchContext.competition}
        isHome={matchGameEvent.matchContext.isHome}
        opponentPrestige={matchGameEvent.matchContext.opponentPrestige}
        clubName={season.club.name}
        clubPrestige={season.club.prestige}
        playerPosition={player.position}
        playerOverall={season.playerOverall}
        onComplete={handleMatchGameComplete}
      />
    );
  }

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
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
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
            usedToday={usedToday}
            onChoice={handleChoice}
            onContinue={handleContinue}
            onSeeTable={handleSeeTable}
            onQuickAction={handleQuickAction}
            onPlayMatch={handlePlayMatch}
          />
        )}

        {activeTab === 'stats' && (
          <StatsTab
            table={displayTable ?? []}
            playerClubId={season.club.id}
            teammates={displayTeammates ?? []}
            playerName={player.name}
            playerPosition={player.position}
            playerOverall={season.playerOverall}
            clubId={season.club.id}
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
      <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
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
          <span className="text-[10px] text-gray-300">⚡ ENERGY</span>
          <span className="text-[10px] font-bold text-white">{energy}</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-800">
          <div className={`h-1.5 rounded-full transition-all ${eColor}`} style={{ width: `${energy}%` }} />
        </div>
      </div>
      <div className="rounded-xl bg-gray-900 border border-gray-800 px-3 py-2.5 shrink-0">
        <p className="text-[10px] text-gray-300">💰 BAL</p>
        <p className="text-sm font-black text-amber-400">{formatMoney(money)}</p>
      </div>
    </div>
  );
}

// ── Quick actions ──────────────────────────────────────────────────
function QuickActions({ energy, note, usedToday, onAction }: {
  energy: number; note: string | null; usedToday: Set<string>;
  onAction: (a: 'rest' | 'train' | 'social') => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Quick Actions <span className="text-gray-500">(once per event)</span></p>
      <div className="grid grid-cols-3 gap-2">
        {([
          { id: 'rest'   as const, emoji: '😴', label: 'Rest',  sub: '+20 Energy', cost: 0,  color: 'hover:border-green-700/40'  },
          { id: 'train'  as const, emoji: '🏋️', label: 'Train', sub: '−15⚡ +Rating', cost: 15, color: 'hover:border-blue-700/40'   },
          { id: 'social' as const, emoji: '📱', label: 'Post',  sub: '−8⚡ +Fame', cost: 8,  color: 'hover:border-purple-700/40' },
        ] as const).map(({ id, emoji, label, sub, cost, color }) => {
          const alreadyUsed = usedToday.has(id);
          const disabled = energy < cost || alreadyUsed;
          return (
            <button
              key={id}
              onClick={() => onAction(id)}
              disabled={disabled}
              className={`rounded-xl border border-gray-800 bg-gray-900 p-3 text-center transition ${disabled ? 'opacity-30 cursor-not-allowed' : color}`}
            >
              <p className="text-xl mb-1">{alreadyUsed ? '✓' : emoji}</p>
              <p className="text-[10px] font-bold text-white">{label}</p>
              <p className="text-[9px] text-gray-300 mt-0.5">{alreadyUsed ? 'done' : sub}</p>
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
  lastResult, energy, money, quickNote, usedToday,
  onChoice, onContinue, onSeeTable, onQuickAction, onPlayMatch,
}: {
  season: SeasonData; player: BDPlayer; gamePhase: 'choices' | 'revealing' | 'result';
  currentEvent: BDEvent | null; isAllDone: boolean; completedCount: number;
  lastResult: LastResult | null; energy: number; money: number; quickNote: string | null;
  usedToday: Set<string>;
  onChoice: (eid: string, cid: string) => void; onContinue: () => void;
  onSeeTable: () => void; onQuickAction: (a: 'rest' | 'train' | 'social') => void;
  onPlayMatch: () => void;
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
        <CurrentEventCard
          event={currentEvent}
          season={season}
          onChoice={(id) => onChoice(currentEvent.id, id)}
          onPlayMatch={onPlayMatch}
        />
      )}

      {gamePhase === 'choices' && isAllDone && (
        <div className="rounded-2xl border border-amber-800/30 bg-amber-950/15 p-7 text-center">
          <p className="text-4xl mb-3">⏳</p>
          <p className="text-base font-black text-amber-400 mb-1">Season Complete</p>
          <p className="text-sm text-gray-300">Calculating trophies & Ballon d'Or nominations…</p>
        </div>
      )}

      {gamePhase === 'choices' && !isAllDone && (
        <QuickActions energy={energy} note={quickNote} usedToday={usedToday} onAction={onQuickAction} />
      )}

      {gamePhase === 'choices' && completedCount > 0 && (
        <SeasonDiary events={season.events} />
      )}
    </div>
  );
}

// Category-specific card styles for non-match events
const CAT_CARD: Record<string, { bg: string; border: string; titleColor: string; ctxColor: string }> = {
  career:    { bg: 'bg-blue-950/30',   border: 'border-blue-800/40',   titleColor: 'text-blue-100',   ctxColor: 'text-blue-200/90'   },
  lifestyle: { bg: 'bg-purple-950/30', border: 'border-purple-800/40', titleColor: 'text-purple-100', ctxColor: 'text-purple-200/90' },
  decision:  { bg: 'bg-amber-950/25',  border: 'border-amber-800/40',  titleColor: 'text-amber-100',  ctxColor: 'text-amber-200/90'  },
  match:     { bg: 'bg-gray-900',      border: 'border-gray-700',      titleColor: 'text-white',      ctxColor: 'text-gray-200'      },
};

// ── Current event card ─────────────────────────────────────────────
function CurrentEventCard({ event, season, onChoice, onPlayMatch }: {
  event: BDEvent; season: SeasonData;
  onChoice: (id: string) => void;
  onPlayMatch: () => void;
}) {
  const ctx  = event.matchContext;
  const comp = ctx ? (COMP[ctx.competition] ?? COMP['Premier League']) : null;
  const catCard = CAT_CARD[event.category] ?? CAT_CARD.match;

  return (
    <div className="space-y-3">
      {ctx && comp && (
        <div className={`rounded-2xl border p-4 ${comp.bg} ${comp.border}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${comp.bg} ${comp.border} ${comp.text}`}>
              {comp.icon} {ctx.competition}
            </span>
            <span className="text-[10px] text-gray-300 font-semibold">
              {ctx.matchweek === 0 ? 'Pre-Season' : `Matchweek ${ctx.matchweek}`}
            </span>
          </div>
          <div className="grid grid-cols-3 items-center gap-2 mb-4">
            <div className="text-center">
              <p className="text-[10px] text-gray-300 mb-1 uppercase tracking-wider">{ctx.isHome ? 'HOME' : 'AWAY'}</p>
              <p className="text-sm font-black text-white leading-tight">{season.club.name}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-600">vs</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-gray-300 mb-1 uppercase tracking-wider">{ctx.isHome ? 'AWAY' : 'HOME'}</p>
              <p className="text-sm font-black text-white leading-tight">{ctx.opponent}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={`block w-2.5 h-2.5 rounded-full ${i <= Math.ceil(ctx.opponentPrestige / 20) ? 'bg-amber-500' : 'bg-gray-800'}`} />
              ))}
            </div>
            <span className="text-[10px] text-gray-300">
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
                <span className="text-[10px] text-gray-300">{label}</span>
                <span className="text-[10px] font-bold text-white">{v}</span>
              </div>
              <div className="h-1 rounded-full bg-gray-800">
                <div className={`h-1 rounded-full ${color} transition-all`} style={{ width: `${v}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`rounded-2xl border p-5 ${catCard.bg} ${catCard.border}`}>
        <div className="flex items-center gap-2 mb-2.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CAT_BADGE[event.category] ?? 'bg-gray-700 text-gray-400'}`}>
            {event.category}
          </span>
        </div>
        <h3 className={`text-xl font-black mb-2 leading-snug ${catCard.titleColor}`}>{event.title}</h3>
        <p className={`text-sm leading-relaxed mb-5 ${catCard.ctxColor}`}>{event.context}</p>
        {event.category === 'match' ? (
          <button
            onClick={onPlayMatch}
            className="w-full rounded-2xl bg-green-600 hover:bg-green-500 active:scale-95 py-5 flex flex-col items-center gap-1.5 transition-all"
          >
            <span className="text-3xl">⚽</span>
            <span className="text-base font-black text-white">Kick Off — Play the Match</span>
            <span className="text-xs text-green-200/70">6 interactive moments</span>
          </button>
        ) : (
          <div className="space-y-2.5">
            {event.choices.map(choice => {
              const h = choice.hint ? HINT[choice.hint] : null;
              return (
                <button key={choice.id} onClick={() => onChoice(choice.id)}
                  className="w-full rounded-xl border border-white/8 bg-black/20 p-4 text-left transition hover:border-amber-500/40 hover:bg-black/30">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-white leading-snug">{choice.emoji} {choice.label}</p>
                    {h && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${h.bg} ${h.text}`}>{h.label}</span>}
                  </div>
                  {choice.description && <p className="text-xs text-gray-200 leading-relaxed">{choice.description}</p>}
                </button>
              );
            })}
          </div>
        )}
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
      <p className="text-sm text-gray-300 mb-5">Simulating result…</p>
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
                <p className="text-[9px] text-gray-300 uppercase tracking-wider mt-0.5">Goals</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{mr.playerAssists}</p>
                <p className="text-[9px] text-gray-300 uppercase tracking-wider mt-0.5">Assists</p>
              </div>
            </>
          )}
          {isDefOrGK && mr.cleanSheet && (
            <div className="text-center">
              <p className="text-2xl">🧤</p>
              <p className="text-[9px] text-gray-300 uppercase tracking-wider mt-0.5">Clean Sheet</p>
            </div>
          )}
          <div className="text-center">
            <p className={`text-2xl font-black ${mr.playerRating >= 8 ? 'text-amber-400' : nightmare ? 'text-red-400' : 'text-white'}`}>
              {mr.playerRating.toFixed(1)}
            </p>
            <p className="text-[9px] text-gray-300 uppercase tracking-wider mt-0.5">Rating</p>
          </div>
        </div>
      </div>

      {result.outcomeText && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
          <p className="text-xs text-gray-200 leading-relaxed">{result.outcomeText}</p>
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">{result.eventTitle}</p>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{result.choiceEmoji}</span>
          <p className="text-sm font-bold text-white">{result.choiceLabel}</p>
        </div>
        {result.outcomeText && (
          <p className="text-sm text-gray-200 leading-relaxed italic">"{result.outcomeText}"</p>
        )}
      </div>

      {/* Stat changes */}
      {deltas.length > 0 && (
        <div className="p-5 border-b border-gray-800 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">What Changed</p>
          {deltas.map(([key, val]) => {
            const meta = EFFECT_META[key];
            if (!meta || !val) return null;
            const pos = (val as number) > 0;
            const formatted = meta.decimal
              ? (pos ? `+${(val as number).toFixed(2)}` : (val as number).toFixed(2))
              : (pos ? `+${val}` : `${val}`);
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-gray-200">{meta.emoji} {meta.label}</span>
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
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Season so far</p>
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
                <p className="text-xs font-semibold text-white truncate">{ev.title}</p>
                {isMatch && mr
                  ? <p className="text-[10px] text-gray-300">{mr.teamGoals}–{mr.opponentGoals} · {mr.isWin ? 'W' : mr.isDraw ? 'D' : 'L'} · {mr.playerRating.toFixed(1)} rating{mr.playerGoals > 0 ? ` · ${mr.playerGoals}G` : ''}{mr.playerAssists > 0 ? ` ${mr.playerAssists}A` : ''}</p>
                  : <p className="text-[10px] text-gray-300 truncate">{ch?.label ?? ''}</p>
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
function StatsTab({ table, playerClubId, teammates, playerName, playerPosition, playerOverall, clubId, view, onViewChange }: {
  table: LeagueTableRow[]; playerClubId: string; teammates: BDTeammate[];
  playerName: string; playerPosition: BDPosition; playerOverall: number; clubId: string;
  view: 'table' | 'squad'; onViewChange: (v: 'table' | 'squad') => void;
}) {
  return (
    <div>
      <div className="sticky top-0 bg-gray-950 border-b border-gray-800 px-4 py-3 flex gap-2 z-10">
        <button onClick={() => onViewChange('table')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${view === 'table' ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40' : 'bg-gray-900 text-gray-300 border border-gray-800'}`}>
          📊 Table
        </button>
        <button onClick={() => onViewChange('squad')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${view === 'squad' ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40' : 'bg-gray-900 text-gray-300 border border-gray-800'}`}>
          👥 Starting XI
        </button>
      </div>
      {view === 'table' && <FullTableView table={table} playerClubId={playerClubId} />}
      {view === 'squad' && <SquadView teammates={teammates} playerName={playerName} playerPosition={playerPosition} playerOverall={playerOverall} clubId={clubId} />}
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
          {!allZero && playerPos >= 0 && <p className="text-[10px] text-gray-300 mt-0.5">Your position: #{playerPos + 1}</p>}
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
        <span className="w-6 text-[9px] text-gray-400">#</span>
        <span className="flex-1 text-[9px] text-gray-400 uppercase">Club</span>
        <span className="w-5 text-center text-[9px] text-gray-400">P</span>
        <span className="w-5 text-center text-[9px] text-gray-400">W</span>
        <span className="w-5 text-center text-[9px] text-gray-400">D</span>
        <span className="w-5 text-center text-[9px] text-gray-400">L</span>
        <span className="w-7 text-center text-[9px] text-gray-400">GD</span>
        <span className="w-7 text-center text-[9px] text-gray-400 font-bold">Pts</span>
        <span className="w-12 text-[9px] text-gray-400 text-right">Form</span>
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
            <span className="w-5 text-center text-xs text-gray-300">{row.p}</span>
            <span className="w-5 text-center text-xs text-gray-300">{row.w}</span>
            <span className="w-5 text-center text-xs text-gray-300">{row.d}</span>
            <span className="w-5 text-center text-xs text-gray-300">{row.l}</span>
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
function SquadView({ teammates, playerName, playerPosition, playerOverall, clubId }: {
  teammates: BDTeammate[]; playerName: string; playerPosition: BDPosition; playerOverall: number; clubId: string;
}) {
  const posLabel: Record<BDPosition, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', ATT: 'FWD' };
  const posOrder: BDPosition[] = ['GK', 'DEF', 'MID', 'ATT'];
  const posColor: Record<BDPosition, string> = { GK: 'bg-yellow-600', DEF: 'bg-blue-700', MID: 'bg-green-700', ATT: 'bg-red-700' };

  const clubSquad = CLUB_SQUADS[clubId] ?? [];
  // Build a map of tracked teammates by name for quick lookup
  const trackedMap = new Map(teammates.map(tm => [tm.name, tm]));

  // Inject the player into the squad (replacing if already present by name)
  const squadWithPlayer = clubSquad.filter(p => p.name !== playerName);
  const playerSquadEntry = { name: playerName, pos: playerPosition, ovr: playerOverall };
  const fullSquad = [...squadWithPlayer, playerSquadEntry];

  const byPos: Record<BDPosition, typeof fullSquad> = { GK: [], DEF: [], MID: [], ATT: [] };
  fullSquad.forEach(p => { if (byPos[p.pos]) byPos[p.pos].push(p); });

  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <h2 className="text-sm font-black text-white">Starting XI</h2>
        <p className="text-[10px] text-gray-300 mt-0.5">Full squad · tracked teammates show season stats</p>
      </div>

      {posOrder.map(pos => {
        const players = byPos[pos];
        if (!players.length) return null;
        return (
          <div key={pos}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{posLabel[pos]}</p>
            <div className="space-y-2">
              {players.map(p => {
                const isPlayer = p.name === playerName;
                const tracked = trackedMap.get(p.name);
                const isDefGK = pos === 'DEF' || pos === 'GK';
                const hasStats = tracked && tracked.appearances > 0;

                return (
                  <div key={p.name} className={`rounded-xl border p-3 ${isPlayer ? 'border-amber-500/40 bg-amber-500/8' : 'border-gray-800 bg-gray-900'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isPlayer ? 'bg-amber-500' : posColor[pos]}`}>
                        <span className="text-[9px] font-black text-white">{posLabel[pos]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isPlayer ? 'text-amber-300' : 'text-white'}`}>
                          {isPlayer ? '★ ' : ''}{p.name}
                        </p>
                        {tracked && <p className="text-[10px] text-gray-300">{tracked.role}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        {hasStats ? (
                          <>
                            <p className={`text-sm font-black ${tracked!.avgRating >= 7.5 ? 'text-amber-400' : 'text-white'}`}>{tracked!.avgRating.toFixed(1)}</p>
                            <p className="text-[9px] text-gray-300">Rating</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-black text-gray-300">{p.ovr}</p>
                            <p className="text-[9px] text-gray-400">OVR</p>
                          </>
                        )}
                      </div>
                    </div>
                    {hasStats && (
                      <div className="flex gap-4 pt-2 mt-1 border-t border-gray-800">
                        {!isDefGK ? (
                          <>
                            <div className="text-center"><p className="text-sm font-black text-white">{tracked!.goals}</p><p className="text-[9px] text-gray-300">G</p></div>
                            <div className="text-center"><p className="text-sm font-black text-white">{tracked!.assists}</p><p className="text-[9px] text-gray-300">A</p></div>
                          </>
                        ) : (
                          <div className="text-center"><p className="text-sm font-black text-white">{tracked!.cleanSheets}</p><p className="text-[9px] text-gray-300">CS</p></div>
                        )}
                        <div className="text-center"><p className="text-sm font-black text-white">{tracked!.appearances}</p><p className="text-[9px] text-gray-300">Apps</p></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {clubSquad.length === 0 && (
        <p className="text-sm text-gray-300 text-center py-4">Squad data not available for this club.</p>
      )}
    </div>
  );
}

// ── Casino tab ─────────────────────────────────────────────────────
function CasinoTab({ money, onResult }: { money: number; onResult: (net: number) => void }) {
  const [game, setGame] = useState<'menu' | 'coin' | 'slots' | 'horses' | 'blackjack' | 'roulette'>('menu');

  if (game === 'coin')      return <CoinFlipGame    money={money} onResult={onResult} onBack={() => setGame('menu')} />;
  if (game === 'slots')     return <SlotsGame        money={money} onResult={onResult} onBack={() => setGame('menu')} />;
  if (game === 'horses')    return <HorseRacingGame  money={money} onResult={onResult} onBack={() => setGame('menu')} />;
  if (game === 'blackjack') return <BlackjackGame    money={money} onResult={onResult} onBack={() => setGame('menu')} />;
  if (game === 'roulette')  return <RouletteGame     money={money} onResult={onResult} onBack={() => setGame('menu')} />;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="text-center mb-2">
        <p className="text-4xl mb-2">🎰</p>
        <h2 className="text-lg font-black text-white">Casino</h2>
        <p className="text-sm text-gray-300">Balance: {formatMoney(money)}</p>
      </div>
      {money < 50 && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-center">
          <p className="text-sm text-red-400 font-bold">Broke! Win matches or visit the Shop to earn more.</p>
        </div>
      )}
      {[
        { id: 'coin'      as const, emoji: '🪙', name: 'Coin Flip',    desc: 'Pick heads or tails — 50/50 odds. Double or nothing.'         },
        { id: 'slots'     as const, emoji: '🎰', name: 'Slot Machine',  desc: 'Spin 3 reels. Match symbols to win up to ×20.'                },
        { id: 'horses'    as const, emoji: '🏇', name: 'Horse Racing',  desc: 'Pick a horse. Bigger odds = bigger payout.'                   },
        { id: 'blackjack' as const, emoji: '🃏', name: 'Blackjack',     desc: 'Beat the dealer to 21. Blackjack pays 3:2.'                   },
        { id: 'roulette'  as const, emoji: '🎡', name: 'Roulette',      desc: 'Pick a colour, range, dozen, or single number. Up to ×35.'   },
      ].map(g => (
        <button key={g.id} onClick={() => setGame(g.id)} disabled={money < 50}
          className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left hover:border-amber-600/40 transition disabled:opacity-40">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{g.emoji}</span>
            <div>
              <p className="text-base font-black text-white">{g.name}</p>
              <p className="text-sm text-gray-300">{g.desc}</p>
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
      <button onClick={onBack} className="text-xs text-gray-300 hover:text-amber-400 transition">← Back to Casino</button>
      <div className="text-center py-4">
        <p className={`text-6xl mb-3 block transition-transform ${flipping ? 'animate-spin' : ''}`} style={{ animationDuration: '0.5s' }}>🪙</p>
        <p className="text-base font-black text-white">Coin Flip</p>
        <p className="text-sm text-gray-300">Balance: {formatMoney(money)}</p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-2">Bet Amount</p>
        <div className="flex gap-2 flex-wrap">
          {bets.map(b => (
            <button key={b} onClick={() => setBet(b)}
              className={`flex-1 min-w-[60px] rounded-xl border py-2.5 text-sm font-bold transition ${bet === b ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-gray-800 bg-gray-900 text-gray-200 hover:border-gray-600'}`}>
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
          <p className="text-xs text-gray-300">Landed: {outcome.landed} · You picked: {outcome.picked}</p>
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Clear reel timers on unmount so we don't setState after leaving mid-spin
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

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

    timeoutRef.current = setTimeout(() => {
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
      <button onClick={onBack} className="text-xs text-gray-300 hover:text-amber-400 transition">← Back to Casino</button>
      <div className="text-center">
        <p className="text-base font-black text-white mb-0.5">Slot Machine</p>
        <p className="text-sm text-gray-300">Balance: {formatMoney(money)}</p>
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-2">Bet Amount</p>
        <div className="flex gap-2">
          {bets.map(b => (
            <button key={b} onClick={() => setBet(b)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition ${bet === b ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-gray-800 bg-gray-900 text-gray-200'}`}>
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-2">Payouts</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-200">
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

// ── Horse racing game ──────────────────────────────────────────────
// Chances sum to exactly 1.0 and every horse carries a house edge
// (chance × odds < 1), so no bet is a positive-EV money farm.
const HORSES = [
  { name: 'Ballon Bleu',    emoji: '🔵', odds: 2,  chance: 0.46, desc: 'Favourite — steady and reliable' },
  { name: 'Golden Boot',    emoji: '🟡', odds: 3,  chance: 0.30, desc: 'Strong contender, good recent form' },
  { name: 'Dark Horse',     emoji: '⚫', odds: 6,  chance: 0.15, desc: 'Outsider with a point to prove' },
  { name: 'Longshot Larry', emoji: '🔴', odds: 10, chance: 0.09, desc: 'Rank outsider — but dreams are free' },
];

function HorseRacingGame({ money, onResult, onBack }: { money: number; onResult: (net: number) => void; onBack: () => void }) {
  const [bet, setBet] = useState(100);
  const [picked, setPicked] = useState<number | null>(null);
  const [racing, setRacing] = useState(false);
  const [progress, setProgress] = useState([0, 0, 0, 0]);
  const [winner, setWinner] = useState<number | null>(null);
  const bets = [50, 100, 250, 500].filter(b => b <= money);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stop the race animation if the user leaves mid-race
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  function race() {
    if (picked === null || racing) return;
    setRacing(true);
    setWinner(null);
    setProgress([0, 0, 0, 0]);

    // determine winner using odds-based probability. Chances sum to 1.0, but
    // default to the last horse as a float-safety fallthrough.
    const roll = Math.random();
    let cum = 0;
    let winnerIdx = HORSES.length - 1;
    for (let i = 0; i < HORSES.length; i++) {
      cum += HORSES[i].chance;
      if (roll < cum) { winnerIdx = i; break; }
    }

    // animate progress bars over 2.5s
    const start = Date.now();
    const duration = 2500;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / duration, 1);
      setProgress(HORSES.map((_, i) => {
        // winner reaches 100%, others get randomised but cap below 100%
        if (i === winnerIdx) return t * 100;
        const base = t * (65 + Math.random() * 20);
        return Math.min(base, t >= 1 ? 92 : base);
      }));
      if (t >= 1) {
        clearInterval(interval);
        intervalRef.current = null;
        setProgress(HORSES.map((_, i) => i === winnerIdx ? 100 : 60 + Math.random() * 30));
        setWinner(winnerIdx);
        const won = winnerIdx === picked;
        onResult(won ? bet * (HORSES[picked].odds - 1) : -bet);
        setRacing(false);
      }
    }, 60);
    intervalRef.current = interval;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <button onClick={onBack} className="text-xs text-gray-300 hover:text-amber-400 transition">← Back to Casino</button>
      <div className="text-center">
        <p className="text-base font-black text-white mb-0.5">🏇 Horse Racing</p>
        <p className="text-sm text-gray-300">Balance: {formatMoney(money)}</p>
      </div>

      {/* Bet selector */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-2">Bet Amount</p>
        <div className="flex gap-2 flex-wrap">
          {bets.map(b => (
            <button key={b} onClick={() => setBet(b)}
              className={`flex-1 min-w-[60px] rounded-xl border py-2.5 text-sm font-bold transition ${bet === b ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-gray-800 bg-gray-900 text-gray-200'}`}>
              {formatMoney(b)}
            </button>
          ))}
        </div>
      </div>

      {/* Horse picker */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300">Pick a Horse</p>
        {HORSES.map((h, i) => (
          <button key={i} onClick={() => !racing && setPicked(i)} disabled={racing}
            className={`w-full rounded-xl border p-3 text-left transition ${picked === i ? 'border-amber-500/60 bg-amber-500/10' : 'border-gray-800 bg-gray-900 hover:border-gray-600'} ${racing ? 'cursor-not-allowed' : ''}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{h.emoji}</span>
                <p className={`text-sm font-bold ${picked === i ? 'text-amber-300' : 'text-white'}`}>{h.name}</p>
              </div>
              <span className="text-xs font-black text-amber-400">{h.odds}× odds</span>
            </div>
            <p className="text-[10px] text-gray-300 mb-2">{h.desc}</p>
            {(racing || winner !== null) && (
              <div className="h-1.5 rounded-full bg-gray-800">
                <div
                  className={`h-1.5 rounded-full transition-all duration-200 ${i === winner ? 'bg-amber-400' : 'bg-gray-600'}`}
                  style={{ width: `${progress[i].toFixed(0)}%` }}
                />
              </div>
            )}
          </button>
        ))}
      </div>

      {winner !== null && (
        <div className={`rounded-2xl border p-4 text-center ${winner === picked ? 'border-green-700/40 bg-green-950/20' : 'border-red-700/40 bg-red-950/20'}`}
          style={{ animation: 'fadeSlideIn 0.3s ease' }}>
          <p className="text-2xl mb-1">{HORSES[winner].emoji}</p>
          <p className="text-base font-black text-white mb-1">{HORSES[winner].name} wins!</p>
          <p className={`text-lg font-black ${winner === picked ? 'text-green-400' : 'text-red-400'}`}>
            {winner === picked
              ? `+${formatMoney(bet * (HORSES[picked].odds - 1))} — Winner!`
              : `-${formatMoney(bet)} — Better luck next time`}
          </p>
        </div>
      )}

      {!racing && (
        <button onClick={race} disabled={picked === null || money < bet}
          className="w-full rounded-xl bg-amber-500 py-4 text-base font-black text-black hover:bg-amber-400 transition disabled:opacity-40">
          {picked === null ? 'Pick a horse first' : `🏁 Race! (${HORSES[picked].odds}× odds)`}
        </button>
      )}
      {racing && (
        <p className="text-center text-sm text-amber-400 animate-pulse py-2">🏇 They're off!</p>
      )}
    </div>
  );
}

// ── Blackjack game ─────────────────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function makeCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { rank, suit };
}

function cardValue(rank: string): number {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
}

function handTotal(cards: { rank: string; suit: string }[]): number {
  let total = cards.reduce((s, c) => s + cardValue(c.rank), 0);
  let aces = cards.filter(c => c.rank === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function CardEl({ rank, suit, hidden }: { rank: string; suit: string; hidden?: boolean }) {
  const red = suit === '♥' || suit === '♦';
  return (
    <div className={`w-12 h-16 rounded-lg border flex items-center justify-center text-sm font-black select-none ${hidden ? 'bg-blue-900 border-blue-700 text-blue-700' : 'bg-gray-100 border-gray-300'}`}>
      {hidden ? '?' : <span className={red ? 'text-red-600' : 'text-gray-900'}>{rank}{suit}</span>}
    </div>
  );
}

function BlackjackGame({ money, onResult, onBack }: { money: number; onResult: (net: number) => void; onBack: () => void }) {
  const [bet, setBet] = useState(100);
  const [phase, setPhase] = useState<'bet' | 'playing' | 'done'>('bet');
  const [playerHand, setPlayerHand] = useState<{ rank: string; suit: string }[]>([]);
  const [dealerHand, setDealerHand] = useState<{ rank: string; suit: string }[]>([]);
  const [resultText, setResultText] = useState('');
  const [netChange, setNetChange] = useState(0);

  const bets = [50, 100, 250, 500].filter(b => b <= money);

  function deal() {
    const p = [makeCard(), makeCard()];
    const d = [makeCard(), makeCard()];
    setPlayerHand(p);
    setDealerHand(d);
    const pTotal = handTotal(p);
    if (pTotal === 21) {
      // blackjack — dealer might also have 21
      const dTotal = handTotal(d);
      if (dTotal === 21) { finish(d, p, 0, 'Push — both Blackjack!'); }
      else { finish(d, p, Math.round(bet * 1.5), '🎰 Blackjack! +' + formatMoney(Math.round(bet * 1.5))); }
      return;
    }
    setPhase('playing');
  }

  function hit() {
    const newHand = [...playerHand, makeCard()];
    setPlayerHand(newHand);
    if (handTotal(newHand) > 21) {
      finish(dealerHand, newHand, -bet, 'Bust! −' + formatMoney(bet));
    }
  }

  function stand() {
    let dHand = [...dealerHand];
    while (handTotal(dHand) < 17) dHand = [...dHand, makeCard()];
    const pTotal = handTotal(playerHand);
    const dTotal = handTotal(dHand);
    let net = 0, msg = '';
    if (dTotal > 21) { net = bet; msg = 'Dealer busts! +' + formatMoney(bet); }
    else if (pTotal > dTotal) { net = bet; msg = 'You win! +' + formatMoney(bet); }
    else if (pTotal === dTotal) { net = 0; msg = 'Push — it\'s a tie'; }
    else { net = -bet; msg = 'Dealer wins. −' + formatMoney(bet); }
    finish(dHand, playerHand, net, msg);
  }

  function finish(dHand: { rank: string; suit: string }[], pHand: { rank: string; suit: string }[], net: number, msg: string) {
    setDealerHand(dHand);
    setPlayerHand(pHand);
    setResultText(msg);
    setNetChange(net);
    onResult(net);
    setPhase('done');
  }

  const pTotal = handTotal(playerHand);
  const dTotal = handTotal(dealerHand);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <button onClick={onBack} className="text-xs text-gray-300 hover:text-amber-400 transition">← Back to Casino</button>
      <div className="text-center">
        <p className="text-base font-black text-white mb-0.5">🃏 Blackjack</p>
        <p className="text-sm text-gray-300">Balance: {formatMoney(money)}</p>
      </div>

      {phase === 'bet' && (
        <>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-2">Bet Amount</p>
            <div className="flex gap-2 flex-wrap">
              {bets.map(b => (
                <button key={b} onClick={() => setBet(b)}
                  className={`flex-1 min-w-[60px] rounded-xl border py-2.5 text-sm font-bold transition ${bet === b ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600'}`}>
                  {formatMoney(b)}
                </button>
              ))}
            </div>
          </div>
          <button onClick={deal} disabled={money < bet}
            className="w-full rounded-xl bg-amber-500 py-4 text-base font-black text-black hover:bg-amber-400 transition disabled:opacity-40">
            Deal Cards
          </button>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-xs text-gray-300 space-y-1">
            <p className="font-bold text-white text-sm mb-1">How to play</p>
            <p>Get closer to 21 than the dealer without going over.</p>
            <p>Aces = 1 or 11 · Face cards = 10</p>
            <p>Dealer hits until 17+ · Blackjack pays 1.5×</p>
          </div>
        </>
      )}

      {(phase === 'playing' || phase === 'done') && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-xs font-bold text-gray-300 mb-2">Dealer {phase === 'done' ? `(${dTotal})` : ''}</p>
            <div className="flex gap-2 flex-wrap">
              {dealerHand.map((c, i) => (
                <CardEl key={i} rank={c.rank} suit={c.suit} hidden={phase === 'playing' && i === 1} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-xs font-bold text-gray-300 mb-2">You ({pTotal})</p>
            <div className="flex gap-2 flex-wrap">
              {playerHand.map((c, i) => <CardEl key={i} rank={c.rank} suit={c.suit} />)}
            </div>
          </div>

          {phase === 'done' && (
            <div className={`rounded-2xl border p-4 text-center ${netChange > 0 ? 'border-green-700/40 bg-green-950/20' : netChange === 0 ? 'border-amber-700/40 bg-amber-950/10' : 'border-red-700/40 bg-red-950/20'}`}
              style={{ animation: 'fadeSlideIn 0.3s ease' }}>
              <p className={`text-base font-black ${netChange > 0 ? 'text-green-400' : netChange === 0 ? 'text-amber-400' : 'text-red-400'}`}>{resultText}</p>
            </div>
          )}

          {phase === 'playing' && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={hit}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 py-4 text-base font-black text-white transition">
                Hit
              </button>
              <button onClick={stand}
                className="rounded-xl bg-gray-700 hover:bg-gray-600 py-4 text-base font-black text-white transition">
                Stand
              </button>
            </div>
          )}
          {phase === 'done' && (
            <button onClick={() => { setPhase('bet'); setPlayerHand([]); setDealerHand([]); setResultText(''); setNetChange(0); }}
              className="w-full rounded-xl bg-amber-500 py-4 text-base font-black text-black hover:bg-amber-400 transition">
              Play Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Roulette game ──────────────────────────────────────────────────
const ROULETTE_REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

type RouletteBetType = 'red' | 'black' | 'low' | 'high' | 'dozen1' | 'dozen2' | 'dozen3' | 'single';

const ROULETTE_BETS: { id: RouletteBetType; label: string; payout: number; desc: string }[] = [
  { id: 'red',    label: '🔴 Red',        payout: 1,  desc: 'Numbers 1–36 in red · Pays 1×'   },
  { id: 'black',  label: '⚫ Black',      payout: 1,  desc: 'Numbers 1–36 in black · Pays 1×' },
  { id: 'low',    label: '1–18 Low',      payout: 1,  desc: 'Numbers 1–18 · Pays 1×'          },
  { id: 'high',   label: '19–36 High',    payout: 1,  desc: 'Numbers 19–36 · Pays 1×'         },
  { id: 'dozen1', label: '1st Dozen',     payout: 2,  desc: 'Numbers 1–12 · Pays 2×'          },
  { id: 'dozen2', label: '2nd Dozen',     payout: 2,  desc: 'Numbers 13–24 · Pays 2×'         },
  { id: 'dozen3', label: '3rd Dozen',     payout: 2,  desc: 'Numbers 25–36 · Pays 2×'         },
  { id: 'single', label: 'Single Number', payout: 35, desc: 'Pick 0–36 exactly · Pays 35×'    },
];

function roulettePick(landed: number, betType: RouletteBetType, singleNum: number): boolean {
  if (landed === 0) return false; // 0 loses all except single on 0
  switch (betType) {
    case 'red':    return ROULETTE_REDS.has(landed);
    case 'black':  return !ROULETTE_REDS.has(landed);
    case 'low':    return landed >= 1 && landed <= 18;
    case 'high':   return landed >= 19 && landed <= 36;
    case 'dozen1': return landed >= 1 && landed <= 12;
    case 'dozen2': return landed >= 13 && landed <= 24;
    case 'dozen3': return landed >= 25 && landed <= 36;
    case 'single': return landed === singleNum;
  }
}

function RouletteGame({ money, onResult, onBack }: { money: number; onResult: (net: number) => void; onBack: () => void }) {
  const [bet, setBet] = useState(100);
  const [betType, setBetType] = useState<RouletteBetType>('red');
  const [singleNum, setSingleNum] = useState(7);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<number | null>(null);
  const [net, setNet] = useState(0);

  const bets = [50, 100, 250].filter(b => b <= money);
  const payout = ROULETTE_BETS.find(b => b.id === betType)?.payout ?? 1;

  function spin() {
    if (spinning) return;
    setSpinning(true);
    setLanded(null);
    setTimeout(() => {
      const n = Math.floor(Math.random() * 37); // 0–36
      const won = roulettePick(n, betType, singleNum) || (betType === 'single' && n === singleNum && n === 0);
      const realWon = betType === 'single' ? n === singleNum : roulettePick(n, betType, singleNum);
      const change = realWon ? bet * payout : -bet;
      setLanded(n);
      setNet(change);
      onResult(change);
      setSpinning(false);
    }, 1600);
  }

  const isRed = landed !== null && landed > 0 && ROULETTE_REDS.has(landed);
  const isGreen = landed === 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <button onClick={onBack} className="text-xs text-gray-300 hover:text-amber-400 transition">← Back to Casino</button>
      <div className="text-center">
        <p className="text-base font-black text-white mb-0.5">🎡 Roulette</p>
        <p className="text-sm text-gray-300">Balance: {formatMoney(money)}</p>
      </div>

      {/* Wheel display */}
      <div className="rounded-2xl border border-gray-700 bg-gray-900 py-8 text-center">
        {spinning ? (
          <p className="text-5xl font-black text-white animate-pulse">?</p>
        ) : landed !== null ? (
          <div>
            <p className={`text-5xl font-black ${isGreen ? 'text-green-400' : isRed ? 'text-red-400' : 'text-white'}`}>{landed}</p>
            <p className={`text-xs font-bold mt-1 ${isGreen ? 'text-green-400' : isRed ? 'text-red-400' : 'text-gray-300'}`}>
              {isGreen ? 'Green' : isRed ? 'Red' : 'Black'}
            </p>
          </div>
        ) : (
          <p className="text-gray-300 text-sm">Spin to play</p>
        )}
      </div>

      {/* Result */}
      {landed !== null && !spinning && (
        <div className={`rounded-2xl border p-4 text-center ${net > 0 ? 'border-green-700/40 bg-green-950/20' : 'border-red-700/40 bg-red-950/20'}`}
          style={{ animation: 'fadeSlideIn 0.3s ease' }}>
          <p className={`text-base font-black ${net > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {net > 0 ? `+${formatMoney(net)} — Winner!` : `${formatMoney(net)} — Better luck next time`}
          </p>
        </div>
      )}

      {/* Bet type */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-2">Bet Type</p>
        <div className="grid grid-cols-2 gap-2">
          {ROULETTE_BETS.map(b => (
            <button key={b.id} onClick={() => setBetType(b.id)}
              className={`rounded-xl border p-2.5 text-left transition ${betType === b.id ? 'border-amber-500 bg-amber-500/10' : 'border-gray-800 bg-gray-900 hover:border-gray-600'}`}>
              <p className={`text-xs font-bold ${betType === b.id ? 'text-amber-300' : 'text-white'}`}>{b.label}</p>
              <p className="text-[9px] text-gray-300 mt-0.5">{b.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {betType === 'single' && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-2">Pick a Number (0–36)</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setSingleNum(Math.max(0, singleNum - 1))} className="w-10 h-10 rounded-full bg-gray-800 text-white font-black text-lg flex items-center justify-center hover:bg-gray-700">−</button>
            <p className="flex-1 text-center text-3xl font-black text-white">{singleNum}</p>
            <button onClick={() => setSingleNum(Math.min(36, singleNum + 1))} className="w-10 h-10 rounded-full bg-gray-800 text-white font-black text-lg flex items-center justify-center hover:bg-gray-700">+</button>
          </div>
        </div>
      )}

      {/* Bet amount */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-2">Bet Amount</p>
        <div className="flex gap-2">
          {bets.map(b => (
            <button key={b} onClick={() => setBet(b)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-bold transition ${bet === b ? 'border-amber-500 bg-amber-500/20 text-amber-400' : 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600'}`}>
              {formatMoney(b)}
            </button>
          ))}
        </div>
      </div>

      <button onClick={spin} disabled={spinning || money < bet}
        className="w-full rounded-xl bg-amber-500 py-4 text-base font-black text-black hover:bg-amber-400 transition disabled:opacity-40">
        {spinning ? 'Spinning…' : `🎡 Spin! (${payout}× payout)`}
      </button>
    </div>
  );
}

// ── Shop tab ───────────────────────────────────────────────────────
function ShopTab({ money, energy, season, onPurchase }: {
  money: number; energy: number; season: SeasonData;
  onPurchase: (itemId: string, cost: number) => void;
}) {
  // Derived from persisted season state so the one-per-season limit survives tab switches
  const bought = new Set(season.purchasedItems ?? []);
  const [notif, setNotif] = useState<string | null>(null);

  function purchase(item: typeof SHOP_ITEMS[0]) {
    if (money < item.price || (item.id !== 'energy' && bought.has(item.id))) return;
    onPurchase(item.id, item.price);
    setNotif(`${item.emoji} ${item.name} purchased!`);
    setTimeout(() => setNotif(null), 2500);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-white">Player Store</h2>
          <p className="text-[10px] text-gray-300">Invest your earnings wisely</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-300">Balance</p>
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
                  <p className="text-xs text-gray-200 mt-0.5 leading-snug">{item.desc}</p>
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300">Current Status</p>
        {[
          { label: 'Fitness', v: season.attributes.fitness, color: 'bg-green-500' },
          { label: 'Morale',  v: season.attributes.morale,  color: 'bg-blue-500'  },
          { label: 'Fame',    v: season.attributes.fame,    color: 'bg-amber-500' },
          { label: 'Energy',  v: energy,                    color: 'bg-cyan-500'  },
        ].map(({ label, v, color }) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-gray-300">{label}</span>
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
