"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import {
  allInvestableClubs, clubValuation, stakeIn, isMajorityOwner, canInvestIn, MAJORITY_THRESHOLD,
  ownedClubState,
} from "@/lib/star/investments";
import { FREE_AGENTS_CLUB } from "@/lib/star/leagueSquads";
import { allPoolManagers } from "@/lib/star/managerPool";

/**
 * INVESTMENTS — BUY A STAKE, AND, PAST 50.1%, RUN THE BOARDROOM.
 *
 * Requested directly: buy a percentage stake in any club, priced off real
 * reputation/league position/squad rating (lib/star/investments.ts), and
 * past majority ownership, real control — sign and sell players, appoint a
 * manager, fund the club. Three tabs: browse the market and buy in, track
 * what you already own, and — only for clubs you actually control — the
 * Boardroom, where every action genuinely rewrites that club's real squad
 * (career.leagueSquads) and the money genuinely leaves your own balance.
 */

interface ActionResult {
  ok: boolean;
  reason?: string;
}

interface Props {
  career: CareerState;
  onBack: () => void;
  onBuyStake: (club: string, percent: number) => void;
  onSellStake: (club: string, percent: number) => void;
  onTopUpBudget: (club: string, amount: number) => void;
  onSignPlayer: (club: string, playerId: string, fromClub: string) => ActionResult;
  onSellPlayer: (club: string, playerId: string) => ActionResult;
  onReplaceManager: (club: string, managerName: string) => ActionResult;
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function money(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export default function Investments(props: Props) {
  const { career } = props;
  const [tab, setTab] = useState<"market" | "portfolio" | "boardroom">("market");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [boardroomClub, setBoardroomClub] = useState<string | null>(null);

  const owned = (career.investments ?? []).filter(i => i.percent > 0);
  const majorityClubs = owned.filter(i => isMajorityOwner(career, i.club));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={props.onBack} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="flex-1 bg-gray-700 rounded-lg px-3 py-2 flex items-center justify-between border border-gray-600">
            <span className="font-black text-white text-sm">Balance</span>
            <span className="flex items-center gap-1 font-black text-yellow-300"><StarIcon />{money(career.money)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 mb-3">
          {(["market", "portfolio", "boardroom"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setBoardroomClub(null); }}
              className={`py-2 rounded-lg font-black text-[11px] uppercase transition ${
                tab === t ? "bg-emerald-600" : "bg-gray-700 text-white/70"
              }`}
            >
              {t === "boardroom" ? `Boardroom${majorityClubs.length ? ` (${majorityClubs.length})` : ""}` : t}
            </button>
          ))}
        </div>

        {tab === "market" && (
          <Market
            career={career} search={search} onSearch={setSearch}
            expanded={expanded} onExpand={setExpanded}
            onBuyStake={props.onBuyStake} onSellStake={props.onSellStake}
          />
        )}

        {tab === "portfolio" && <Portfolio career={career} owned={owned} onSellStake={props.onSellStake} />}

        {tab === "boardroom" && (
          boardroomClub
            ? (
              <Boardroom
                career={career} club={boardroomClub} onBack={() => setBoardroomClub(null)}
                onTopUpBudget={props.onTopUpBudget} onSignPlayer={props.onSignPlayer}
                onSellPlayer={props.onSellPlayer} onReplaceManager={props.onReplaceManager}
              />
            )
            : <BoardroomList clubs={majorityClubs.map(i => i.club)} career={career} onOpen={setBoardroomClub} />
        )}
      </div>
    </div>
  );
}

// ── MARKET ───────────────────────────────────────────────────────────────

function Market({
  career, search, onSearch, expanded, onExpand, onBuyStake, onSellStake,
}: {
  career: CareerState; search: string; onSearch: (s: string) => void;
  expanded: string | null; onExpand: (c: string | null) => void;
  onBuyStake: (club: string, percent: number) => void; onSellStake: (club: string, percent: number) => void;
}) {
  const clubs = allInvestableClubs()
    .filter(c => canInvestIn(career, c))
    .filter(c => c.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <input
        value={search}
        onChange={e => onSearch(e.target.value)}
        placeholder="Search clubs…"
        className="w-full mb-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-white/40"
      />
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
        {clubs.map(club => {
          const valuation = clubValuation(club, career);
          const stake = stakeIn(career, club);
          const isOpen = expanded === club;
          return (
            <div key={club} className="border-b border-black/20 last:border-b-0">
              <button
                onClick={() => onExpand(isOpen ? null : club)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-gray-700 text-left"
              >
                <div className="min-w-0">
                  <div className="font-bold text-white text-sm truncate">{club}</div>
                  {stake && (
                    <div className="text-[10px] text-emerald-300 font-bold">
                      You own {stake.percent.toFixed(stake.percent < 1 ? 3 : 1)}%
                      {stake.percent >= MAJORITY_THRESHOLD ? " · Majority" : ""}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-black text-yellow-300 text-sm tabular-nums flex items-center gap-1 justify-end">
                    <StarIcon />{money(valuation)}
                  </div>
                  <div className="text-[9px] text-white/50">full value</div>
                </div>
              </button>
              {isOpen && (
                <StakeControls
                  club={club} valuation={valuation} money={career.money} stake={stake}
                  onBuy={pct => onBuyStake(club, pct)} onSell={pct => onSellStake(club, pct)}
                />
              )}
            </div>
          );
        })}
        {clubs.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-white/50">No clubs match &ldquo;{search}&rdquo;.</div>
        )}
      </div>
    </>
  );
}

/**
 * BUY/SELL, BY AMOUNT — NOT A 0-100% WHEEL.
 *
 * Requested directly: the old control was a single 0.01%-100% slider, which
 * has two real problems at once. First, it let you drag straight past what
 * you could actually afford — "buying" 2.83% of a club when you can afford
 * exactly that reads as a target you have to hit with a thumb on a slider a
 * pixel wide. Second, "I want to spend roughly ★2,000" is a much more
 * natural way to think about an investment than "I want 2.83%" — money is
 * hard enough to come by in this game that overshooting a good buy, or
 * undershooting one, is a real cost, and a percentage-only control makes
 * that mistake easy. A star-money amount, capped at what the bank can pay,
 * is both.
 */
function StakeControls({
  club, valuation, money: bank, stake, onBuy, onSell,
}: {
  club: string; valuation: number; money: number;
  stake?: { percent: number; avgBuyValuation: number };
  onBuy: (percent: number) => void; onSell: (percent: number) => void;
}) {
  // What buying 100% of this club would cost you, capped by what's actually
  // in the bank — the hard ceiling the old slider never had.
  const maxBuySpend = Math.max(0, Math.min(bank, Math.round(valuation)));
  const [buyAmount, setBuyAmount] = useState(() => Math.max(1, Math.min(maxBuySpend, Math.round(valuation * 0.001))));
  const clampedBuy = Math.max(0, Math.min(maxBuySpend, Math.round(buyAmount) || 0));
  const buyPct = valuation > 0 ? (clampedBuy / valuation) * 100 : 0;
  const canAfford = clampedBuy > 0 && clampedBuy <= bank;

  const stakePct = stake?.percent ?? 0;
  const [sellFraction, setSellFraction] = useState(1); // of your OWN holding
  const sellPct = stakePct * sellFraction;
  const sellAmount = Math.round(valuation * (sellPct / 100));

  const profit = stake ? Math.round((valuation - stake.avgBuyValuation) * (stakePct / 100)) : 0;

  return (
    <div className="bg-gray-900/60 px-3 py-3 space-y-3">
      {stake && (
        <div className="text-[11px] text-white/70">
          You own <span className="text-white font-bold">{stakePct.toFixed(stakePct < 1 ? 3 : 1)}%</span>, bought in at{" "}
          <span className="text-white font-bold">★{money(stake.avgBuyValuation)}</span> full value —
          {" "}
          <span className={profit >= 0 ? "text-emerald-300 font-bold" : "text-red-300 font-bold"}>
            {profit >= 0 ? "+" : ""}★{money(Math.abs(profit))} unrealised
          </span>
        </div>
      )}

      {/* ── Buy, by amount ── */}
      <div>
        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/50">Buy</div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-300 font-black text-sm">★</span>
          <input
            type="number" min={0} max={maxBuySpend} step={1}
            value={clampedBuy}
            onChange={e => setBuyAmount(Math.max(0, Math.min(maxBuySpend, Math.round(Number(e.target.value) || 0))))}
            className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-white tabular-nums"
          />
          <span className="w-16 text-right text-xs font-black text-white/70 tabular-nums">
            = {buyPct.toFixed(buyPct < 1 ? 3 : 1)}%
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {[0.1, 0.25, 0.5, 1].map(f => {
            const amt = Math.round(maxBuySpend * f);
            return (
              <button
                key={f}
                onClick={() => setBuyAmount(amt)}
                disabled={maxBuySpend <= 0}
                className="py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-[10px] font-black text-white/80"
              >
                {f === 1 ? "MAX" : `${Math.round(f * 100)}%`}
              </button>
            );
          })}
        </div>
        {buyPct >= MAJORITY_THRESHOLD && (
          <div className="mt-1 text-[10px] font-black text-emerald-300">→ MAJORITY at this amount</div>
        )}
        <button
          disabled={!canAfford}
          onClick={() => onBuy(buyPct)}
          className="mt-2 w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 font-black text-xs"
        >
          Buy ★{money(clampedBuy)} ({buyPct.toFixed(buyPct < 1 ? 3 : 1)}%)
        </button>
        {maxBuySpend < Math.round(valuation) && (
          <div className="mt-1 text-[9px] text-center text-white/40">
            Most you can afford: ★{money(maxBuySpend)} ({((maxBuySpend / valuation) * 100).toFixed(2)}%)
          </div>
        )}
      </div>

      {/* ── Sell, by share of what you own ── */}
      {stakePct > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/50">Sell</div>
          <div className="grid grid-cols-4 gap-1">
            {[0.25, 0.5, 0.75, 1].map(f => (
              <button
                key={f}
                onClick={() => setSellFraction(f)}
                className={`py-1.5 rounded-md text-[10px] font-black ${
                  sellFraction === f ? "bg-red-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-white/80"
                }`}
              >
                {f === 1 ? "ALL" : `${Math.round(f * 100)}%`}
              </button>
            ))}
          </div>
          <button
            onClick={() => onSell(sellPct)}
            className="mt-2 w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 font-black text-xs"
          >
            Sell {sellPct.toFixed(sellPct < 1 ? 3 : 1)}% for ★{money(sellAmount)}
          </button>
        </div>
      )}

      <div className="text-[9px] text-center text-white/40">Club: {club}</div>
    </div>
  );
}

// ── PORTFOLIO ────────────────────────────────────────────────────────────

function Portfolio({
  career, owned, onSellStake,
}: {
  career: CareerState; owned: { club: string; percent: number; avgBuyValuation: number }[];
  onSellStake: (club: string, percent: number) => void;
}) {
  const totalValue = owned.reduce((s, i) => s + clubValuation(i.club, career) * (i.percent / 100), 0);
  const totalCost = owned.reduce((s, i) => s + i.avgBuyValuation * (i.percent / 100), 0);
  const totalProfit = totalValue - totalCost;

  if (owned.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-8 text-center text-sm text-white/60">
        No stakes yet — buy into a club from the Market tab.
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 mb-2 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Portfolio value</div>
          <div className="text-lg font-black text-yellow-300 flex items-center gap-1"><StarIcon />{money(totalValue)}</div>
        </div>
        <div className={`text-sm font-black ${totalProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
          {totalProfit >= 0 ? "+" : ""}★{money(Math.abs(totalProfit))}
        </div>
      </div>
      <div className="space-y-1.5">
        {owned.map(i => {
          const value = clubValuation(i.club, career);
          const profit = (value - i.avgBuyValuation) * (i.percent / 100);
          return (
            <div key={i.club} className="bg-gray-800/70 border border-gray-700 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-sm">{i.club}</div>
                  <div className="text-[10px] text-white/60">
                    {i.percent.toFixed(i.percent < 1 ? 3 : 1)}%
                    {i.percent >= MAJORITY_THRESHOLD && <span className="ml-1 text-emerald-300 font-black">MAJORITY</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-yellow-300">★{money(value * (i.percent / 100))}</div>
                  <div className={`text-[10px] font-bold ${profit >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                    {profit >= 0 ? "+" : ""}★{money(Math.abs(profit))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => onSellStake(i.club, i.percent)}
                className="mt-1.5 w-full py-1.5 rounded-md bg-red-600/80 hover:bg-red-500 text-[10px] font-black"
              >
                Sell entire stake
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── BOARDROOM ────────────────────────────────────────────────────────────

function BoardroomList({ clubs, career, onOpen }: { clubs: string[]; career: CareerState; onOpen: (c: string) => void }) {
  if (clubs.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-8 text-center text-sm text-white/60">
        Own {MAJORITY_THRESHOLD}% or more of a club to take a seat on its board.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {clubs.map(club => (
        <button
          key={club}
          onClick={() => onOpen(club)}
          className="w-full flex items-center justify-between gap-2 px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 text-left"
        >
          <div>
            <div className="font-black text-white text-sm">{club}</div>
            <div className="text-[10px] text-white/60">Budget: ★{money(ownedClubState(career, club).budget)}</div>
          </div>
          <span className="text-white/40">→</span>
        </button>
      ))}
    </div>
  );
}

/** Wherever the game actually filed this club's real squad — see
 *  investments.ts's own `findSquadEntry` for why it can't only be
 *  `leagueSquads`: that array is only the OTHER clubs in the player's
 *  current division, and every club outside it (Europe, the other
 *  division, Other clubs) lives in `externalSquads` instead. */
function squadFor(career: CareerState, club: string) {
  return (career.leagueSquads ?? []).find(s => s.club === club)
    ?? (career.externalSquads ?? []).find(s => s.club === club);
}

function Boardroom({
  career, club, onBack, onTopUpBudget, onSignPlayer, onSellPlayer, onReplaceManager,
}: {
  career: CareerState; club: string; onBack: () => void;
  onTopUpBudget: (club: string, amount: number) => void;
  onSignPlayer: (club: string, playerId: string, fromClub: string) => ActionResult;
  onSellPlayer: (club: string, playerId: string) => ActionResult;
  onReplaceManager: (club: string, managerName: string) => ActionResult;
}) {
  const [section, setSection] = useState<"squad" | "sign" | "manager">("squad");
  const [topUp, setTopUp] = useState(1000);
  const [message, setMessage] = useState<string | null>(null);
  const state = ownedClubState(career, club);
  const squad = squadFor(career, club);

  const runAction = (result: ActionResult) => {
    setMessage(result.ok ? null : (result.reason ?? "That didn't go through."));
  };

  return (
    <div>
      <button onClick={onBack} className="mb-2 text-xs font-black text-white/60 hover:text-white">← All boards</button>
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 mb-2">
        <div className="font-black text-white">{club}</div>
        <div className="text-[10px] text-white/60">
          Manager: {state.managerName ?? "Vacant"}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-gray-900 rounded-lg px-2 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/70">Budget</span>
            <span className="font-black text-yellow-300 text-sm">★{money(state.budget)}</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number" min={0} value={topUp} onChange={e => setTopUp(Math.max(0, Number(e.target.value)))}
            className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white"
          />
          <button
            disabled={topUp <= 0 || topUp > career.money}
            onClick={() => onTopUpBudget(club, topUp)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 font-black text-xs whitespace-nowrap"
          >
            Fund club
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 mb-2">
        {(["squad", "sign", "manager"] as const).map(s => (
          <button
            key={s}
            onClick={() => { setSection(s); setMessage(null); }}
            className={`py-1.5 rounded-lg font-black text-[10px] uppercase transition ${
              section === s ? "bg-emerald-600" : "bg-gray-700 text-white/70"
            }`}
          >
            {s === "sign" ? "Sign a player" : s}
          </button>
        ))}
      </div>

      {message && (
        <div className="mb-2 rounded-lg bg-red-900/60 border border-red-500/60 px-3 py-2 text-center text-[11px] font-bold text-red-200">
          {message}
        </div>
      )}

      {section === "squad" && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
          {(squad?.players ?? []).map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 border-b border-black/20 last:border-b-0">
              <div>
                <div className="text-sm font-bold text-white">{p.name}</div>
                <div className="text-[10px] text-white/55">{p.position} · OVR {p.overall}</div>
              </div>
              <button
                onClick={() => runAction(onSellPlayer(club, p.id))}
                className="px-2.5 py-1 rounded-md bg-red-600/80 hover:bg-red-500 text-[10px] font-black"
              >
                Sell
              </button>
            </div>
          ))}
          {(!squad || squad.players.length === 0) && (
            <div className="px-3 py-6 text-center text-xs text-white/50">No squad data on file yet.</div>
          )}
        </div>
      )}

      {section === "sign" && (
        <SignPlayerPanel career={career} club={club} onSignPlayer={(c, p, f) => runAction(onSignPlayer(c, p, f))} />
      )}

      {section === "manager" && (
        <ManagerPanel career={career} club={club} onReplaceManager={(c, n) => runAction(onReplaceManager(c, n))} />
      )}
    </div>
  );
}

function SignPlayerPanel({
  career, club, onSignPlayer,
}: { career: CareerState; club: string; onSignPlayer: (club: string, playerId: string, fromClub: string) => void }) {
  const [search, setSearch] = useState("");
  const freeAgents = (career.freeAgents ?? []).map(p => ({ ...p, fromClub: FREE_AGENTS_CLUB }));
  const others = [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])]
    .filter(s => s.club !== club)
    .flatMap(s => s.players.map(p => ({ ...p, fromClub: s.club })));
  const pool = [...freeAgents, ...others]
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 60);

  return (
    <>
      <input
        value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players…"
        className="w-full mb-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-white/40"
      />
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-[45vh] overflow-y-auto">
        {pool.map(p => (
          <div key={`${p.fromClub}:${p.id}`} className="flex items-center justify-between px-3 py-2 border-b border-black/20 last:border-b-0">
            <div>
              <div className="text-sm font-bold text-white">{p.name}</div>
              <div className="text-[10px] text-white/55">
                {p.position} · OVR {p.overall} · {p.fromClub === FREE_AGENTS_CLUB ? "Free agent" : p.fromClub}
              </div>
            </div>
            <button
              onClick={() => onSignPlayer(club, p.id, p.fromClub)}
              className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-[10px] font-black text-emerald-950"
            >
              Sign
            </button>
          </div>
        ))}
        {pool.length === 0 && <div className="px-3 py-6 text-center text-xs text-white/50">No players match.</div>}
      </div>
    </>
  );
}

function ManagerPanel({
  career, club, onReplaceManager,
}: { career: CareerState; club: string; onReplaceManager: (club: string, managerName: string) => void }) {
  const current = ownedClubState(career, club).managerName;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
      {allPoolManagers().map(name => (
        <div key={name} className="flex items-center justify-between px-3 py-2 border-b border-black/20 last:border-b-0">
          <span className={`text-sm font-bold ${name === current ? "text-emerald-300" : "text-white"}`}>
            {name}{name === current ? " (current)" : ""}
          </span>
          <button
            disabled={name === current}
            onClick={() => onReplaceManager(club, name)}
            className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-[10px] font-black text-emerald-950"
          >
            Appoint
          </button>
        </div>
      ))}
    </div>
  );
}
