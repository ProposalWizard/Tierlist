"use client";
import { useState } from "react";
import type { CareerState } from "@/lib/star/types";
import {
  allInvestableClubs, clubValuation, stakeIn, isMajorityOwner, canInvestIn, MAJORITY_THRESHOLD,
  ownedClubState,
} from "@/lib/star/investments";
import { FREE_AGENTS_CLUB } from "@/lib/star/leagueSquads";
import { allPoolManagers, managerInterest } from "@/lib/star/managerPool";
import { loadLineup } from "@/lib/star/lineupStore";
import { FORMATIONS } from "@/lib/star/formations";
import { clubKitFor, clubStrengthWithFormation, type ClubKit, type RecommendationKind } from "@/lib/star/clubPowers";
import { kitsOf, type Kit } from "@/lib/star/kits";
import { facilitiesFor } from "@/lib/star/facilities";
import { playerMarketValue } from "@/lib/star/marketValue";
import { interestedClubs, type TransferInterest } from "@/lib/star/transferMarket";
import { formatMoney, formatMoneyPrecise, niceMoneyStep } from "@/lib/star/money";
import NegotiationScreen from "./NegotiationScreen";
import type { NegotiationState } from "@/lib/star/negotiation";

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
  /** Deep-link straight into a tab (and, for "boardroom", a specific club)
   *  instead of always opening on Market — lets OwnershipScreen's hub jump a
   *  club card straight to that club's boardroom rather than making the
   *  player re-navigate through tabs they just came from. */
  initialTab?: "market" | "portfolio" | "boardroom";
  initialBoardroomClub?: string;
  initialBoardroomSection?: "squad" | "sign" | "manager" | "powers" | "history";
  onBuyStake: (club: string, percent: number) => void;
  onSellStake: (club: string, percent: number) => void;
  onTopUpBudget: (club: string, amount: number) => void;
  onSignPlayer: (club: string, playerId: string, fromClub: string, agreedFee?: number) => ActionResult;
  onSellPlayer: (club: string, playerId: string, agreedFee?: number, buyerClub?: string) => ActionResult;
  /** Optional, reported directly 14 Sep 2026: selling used to FORCE a
   *  shareholder vote even for a 100% owner — a real obstacle, not a real
   *  choice. `onSellPlayer` now sells directly; this is offered as its own
   *  button on the same confirmation screen for anyone who actually wants
   *  to see fan reaction (and can still overrule a bad result exactly as
   *  before) rather than the only path to a sale. */
  onProposeSellVote: (club: string, playerId: string, agreedFee?: number, buyerClub?: string) => ActionResult;
  onReplaceManager: (club: string, managerName: string, agreedFee?: number) => ActionResult;
  onManagerNegotiationFailed: (club: string, managerName: string) => void;
  /** Phase 3 of STAR_POWER_POLITICS.md — the rest of the ownership layer. */
  onRecommend: (club: string, kind: RecommendationKind, detail: string) => ActionResult;
  onSetFormation: (club: string, formationId: string) => ActionResult;
  onSetKit: (club: string, kit: ClubKit) => ActionResult;
  onProposeKitVote: (club: string, optionA: ClubKit, optionB: ClubKit, favor: "a" | "b" | undefined) => ActionResult;
  onStandForPresident: (club: string) => ActionResult;
  onSetPresidentWage: (club: string, wage: number) => ActionResult;
  onMergeClubs: (primaryClub: string, absorbedClub: string) => ActionResult;
  onHaveASon: () => ActionResult;
  onAgeUpSon: () => ActionResult;
  onPromoteSon: (club: string) => ActionResult;
  onTransferSon: (toClub: string) => ActionResult;
  /** Phase 7 of STAR_POWER_POLITICS.md — club facilities. */
  onRenameStadium: (club: string, name: string) => ActionResult;
  onUpgradeStadiumCapacity: (club: string) => ActionResult;
  onUpgradeTrainingGround: (club: string) => ActionResult;
  onUpgradeYouthAcademy: (club: string) => ActionResult;
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function money(n: number): string {
  return formatMoney(n);
}

/** A real, if simple, jersey shape in the club's actual colours — requested
 *  directly: "there should be an area somewhere which shows the kit of that
 *  club because we don't always know what exactly the colors of that kit
 *  and what they look like." Takes a single real Kit (shirt + trim) — a
 *  club now has a real home AND away kit (kits.ts's own shape), rebuilt
 *  15 Sep 2026 after it was rightly pointed out that real football has kit
 *  clashes and away strips, which the old single-design vote ignored. */
export function KitSwatch({ kit, size = 44 }: { kit: Kit; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0">
      <path d="M8 6 L1 15 L7 20 L11 13 Z" fill={kit.trim} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
      <path d="M32 6 L39 15 L33 20 L29 13 Z" fill={kit.trim} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
      <path d="M11 7 Q20 12 29 7 L32 35 Q20 38.5 8 35 Z" fill={kit.shirt} stroke="rgba(0,0,0,0.35)" strokeWidth="0.6" />
      <path d="M15.5 5.5 Q20 9.5 24.5 5.5 L22.5 3 Q20 5.5 17.5 3 Z" fill={kit.trim} />
    </svg>
  );
}

export default function Investments(props: Props) {
  const { career } = props;
  const [tab, setTab] = useState<"market" | "portfolio" | "boardroom">(props.initialTab ?? "market");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [boardroomClub, setBoardroomClub] = useState<string | null>(props.initialBoardroomClub ?? null);

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
                tab === t ? "bg-emerald-600" : "bg-gray-700 text-white font-semibold"
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

        {tab === "portfolio" && (
          <Portfolio career={career} owned={owned} onSellStake={props.onSellStake} onRecommend={props.onRecommend} />
        )}

        {tab === "boardroom" && (
          boardroomClub
            ? (
              <Boardroom
                career={career} club={boardroomClub} onBack={() => setBoardroomClub(null)}
                initialSection={boardroomClub === props.initialBoardroomClub ? props.initialBoardroomSection : undefined}
                onTopUpBudget={props.onTopUpBudget} onSignPlayer={props.onSignPlayer}
                onSellPlayer={props.onSellPlayer} onProposeSellVote={props.onProposeSellVote} onReplaceManager={props.onReplaceManager}
                onManagerNegotiationFailed={props.onManagerNegotiationFailed}
                onSetFormation={props.onSetFormation} onSetKit={props.onSetKit}
                onProposeKitVote={props.onProposeKitVote} onStandForPresident={props.onStandForPresident}
                onSetPresidentWage={props.onSetPresidentWage}
                otherOwnedClubs={owned.map(i => i.club).filter(c => c !== boardroomClub && c !== career.player.club)}
                onMergeClubs={props.onMergeClubs}
                son={career.son} onHaveASon={props.onHaveASon} onAgeUpSon={props.onAgeUpSon}
                onPromoteSon={props.onPromoteSon} onTransferSon={props.onTransferSon}
                onRenameStadium={props.onRenameStadium} onUpgradeStadiumCapacity={props.onUpgradeStadiumCapacity}
                onUpgradeTrainingGround={props.onUpgradeTrainingGround} onUpgradeYouthAcademy={props.onUpgradeYouthAcademy}
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
  // Reported directly: the market only ever sorted A-Z, with no way to see
  // the biggest (or smallest) clubs at a glance without reading every row.
  const [sortBy, setSortBy] = useState<"name" | "value">("name");
  const clubs = allInvestableClubs()
    .filter(c => canInvestIn(career, c))
    .filter(c => c.toLowerCase().includes(search.toLowerCase()));
  // Computed once per club, up front, so sorting by value doesn't call
  // clubValuation (a real, non-trivial calculation) a second time per
  // comparison on top of the one render already needs below.
  const valuations = new Map(clubs.map(c => [c, clubValuation(c, career)]));
  const sortedClubs = sortBy === "value"
    ? [...clubs].sort((a, b) => (valuations.get(b) ?? 0) - (valuations.get(a) ?? 0))
    : [...clubs].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <div className="mb-2 flex gap-2">
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search clubs…"
          className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <div className="flex rounded-lg overflow-hidden border border-gray-700 shrink-0">
          <button
            onClick={() => setSortBy("name")}
            className={`px-2.5 py-2 text-[10px] font-black ${sortBy === "name" ? "bg-emerald-600 text-white" : "bg-gray-800 text-white/70"}`}
          >
            A–Z
          </button>
          <button
            onClick={() => setSortBy("value")}
            className={`px-2.5 py-2 text-[10px] font-black ${sortBy === "value" ? "bg-emerald-600 text-white" : "bg-gray-800 text-white/70"}`}
          >
            ★ High→Low
          </button>
        </div>
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto">
        {sortedClubs.map(club => {
          const valuation = valuations.get(club) ?? clubValuation(club, career);
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
                  <div className="text-[9px] text-white font-semibold">full value</div>
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
          <div className="px-3 py-6 text-center text-xs text-white font-semibold">No clubs match &ldquo;{search}&rdquo;.</div>
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
  // What buying up to 100% TOTAL would cost you, capped by what's actually
  // in the bank and by whatever room is left above what you already own —
  // reported directly, from a real save: buying 100% and still being
  // offered more let one club end up 200%-owned. `buyStake` itself now
  // clamps too (the real backstop), but the control shouldn't dangle a
  // bigger purchase than is actually possible in the first place.
  const stakePct = stake?.percent ?? 0;
  const roomPct = Math.max(0, 100 - stakePct);
  const maxBuySpend = Math.max(0, Math.min(bank, Math.round(valuation * (roomPct / 100))));
  const [buyAmount, setBuyAmount] = useState(() => Math.max(1, Math.min(maxBuySpend, Math.round(valuation * 0.001))));
  const clampedBuy = Math.max(0, Math.min(maxBuySpend, Math.round(buyAmount) || 0));
  const buyPct = valuation > 0 ? (clampedBuy / valuation) * 100 : 0;
  const canAfford = clampedBuy > 0 && clampedBuy <= bank;

  const [sellFraction, setSellFraction] = useState(1); // of your OWN holding
  const sellPct = stakePct * sellFraction;
  const sellAmount = Math.round(valuation * (sellPct / 100));

  const profit = stake ? Math.round((valuation - stake.avgBuyValuation) * (stakePct / 100)) : 0;

  return (
    <div className="bg-gray-900/60 px-3 py-3 space-y-3">
      {stake && (
        <div className="text-[11px] text-white font-semibold">
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
        <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-white font-semibold">Buy</div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-300 font-black text-sm">★</span>
          <input
            type="number" min={0} max={maxBuySpend} step={niceMoneyStep(clampedBuy)}
            value={clampedBuy}
            onChange={e => setBuyAmount(Math.max(0, Math.min(maxBuySpend, Math.round(Number(e.target.value) || 0))))}
            className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-white tabular-nums"
          />
          <span className="w-16 text-right text-xs font-black text-white font-semibold tabular-nums">
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
          <div className="mt-1 text-[9px] text-center text-white font-semibold">
            Most you can afford: ★{money(maxBuySpend)} ({((maxBuySpend / valuation) * 100).toFixed(2)}%)
          </div>
        )}
      </div>

      {/* ── Sell, by share of what you own ── */}
      {stakePct > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-white font-semibold">Sell</div>
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

      <div className="text-[9px] text-center text-white font-semibold">Club: {club}</div>
    </div>
  );
}

// ── PORTFOLIO ────────────────────────────────────────────────────────────

function Portfolio({
  career, owned, onSellStake, onRecommend,
}: {
  career: CareerState; owned: { club: string; percent: number; avgBuyValuation: number }[];
  onSellStake: (club: string, percent: number) => void;
  onRecommend: (club: string, kind: RecommendationKind, detail: string) => ActionResult;
}) {
  const [recommendClub, setRecommendClub] = useState<string | null>(null);
  const [recommendKind, setRecommendKind] = useState<RecommendationKind>("sign");
  const [recommendDetail, setRecommendDetail] = useState("");
  const [recommendMessage, setRecommendMessage] = useState<string | null>(null);
  const totalValue = owned.reduce((s, i) => s + clubValuation(i.club, career) * (i.percent / 100), 0);
  const totalCost = owned.reduce((s, i) => s + i.avgBuyValuation * (i.percent / 100), 0);
  const totalProfit = totalValue - totalCost;

  if (owned.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-8 text-center text-sm text-white/90">
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
                  <div className="text-[10px] text-white/90">
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
              {i.percent < MAJORITY_THRESHOLD && (
                <div className="mt-1.5">
                  {recommendClub === i.club ? (
                    <div className="space-y-1">
                      <select
                        value={recommendKind}
                        onChange={e => setRecommendKind(e.target.value as RecommendationKind)}
                        className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[10px] text-white"
                      >
                        <option value="sign">Sign a player</option>
                        <option value="formation">Change formation</option>
                        <option value="manager">Change manager</option>
                        <option value="wage">Adjust wages</option>
                      </select>
                      <input
                        value={recommendDetail} onChange={e => setRecommendDetail(e.target.value)}
                        placeholder="What would you suggest?"
                        className="w-full rounded-md bg-gray-900 border border-gray-700 px-2 py-1 text-[10px] text-white"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            const result = onRecommend(i.club, recommendKind, recommendDetail || "No detail given");
                            setRecommendMessage(result.ok ? "Recommendation filed — the board will consider it." : (result.reason ?? "Failed"));
                            if (result.ok) { setRecommendClub(null); setRecommendDetail(""); }
                          }}
                          className="flex-1 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black"
                        >
                          Submit
                        </button>
                        <button
                          onClick={() => setRecommendClub(null)}
                          className="px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-[10px] font-black"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setRecommendClub(i.club); setRecommendMessage(null); }}
                      className="w-full py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 text-[10px] font-black"
                    >
                      Recommend to the board
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {recommendMessage && (
        <div className="mt-2 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-center text-[11px] font-bold text-white/80">
          {recommendMessage}
        </div>
      )}
      {(career.recommendations ?? []).length > 0 && (
        <div className="mt-3 bg-gray-800/70 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/60 border-b border-black/20">
            Your recommendations
          </div>
          {[...(career.recommendations ?? [])].reverse().slice(0, 8).map(r => (
            <div key={r.id} className="px-3 py-1.5 border-b border-black/10 last:border-b-0 flex items-center justify-between gap-2">
              <div className="text-[10px] text-white/80 truncate">{r.club}: {r.detail}</div>
              <span className={`text-[9px] font-black uppercase shrink-0 ${
                r.status === "adopted" ? "text-emerald-300" : r.status === "dismissed" ? "text-white font-semibold" : "text-yellow-300"
              }`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── BOARDROOM ────────────────────────────────────────────────────────────

function BoardroomList({ clubs, career, onOpen }: { clubs: string[]; career: CareerState; onOpen: (c: string) => void }) {
  if (clubs.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-8 text-center text-sm text-white/90">
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
            <div className="text-[10px] text-white/90">Budget: ★{money(ownedClubState(career, club).budget)}</div>
          </div>
          <span className="text-white font-semibold">→</span>
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
  career, club, onBack, initialSection, onTopUpBudget, onSignPlayer, onSellPlayer, onProposeSellVote, onReplaceManager,
  onManagerNegotiationFailed,
  onSetFormation, onSetKit, onProposeKitVote, onStandForPresident, onSetPresidentWage,
  otherOwnedClubs, onMergeClubs, son, onHaveASon, onAgeUpSon, onPromoteSon, onTransferSon,
  onRenameStadium, onUpgradeStadiumCapacity, onUpgradeTrainingGround, onUpgradeYouthAcademy,
}: {
  career: CareerState; club: string; onBack: () => void;
  initialSection?: "squad" | "sign" | "manager" | "powers" | "history";
  onTopUpBudget: (club: string, amount: number) => void;
  onSignPlayer: (club: string, playerId: string, fromClub: string, agreedFee?: number) => ActionResult;
  onSellPlayer: (club: string, playerId: string, agreedFee?: number, buyerClub?: string) => ActionResult;
  onProposeSellVote: (club: string, playerId: string, agreedFee?: number, buyerClub?: string) => ActionResult;
  onReplaceManager: (club: string, managerName: string, agreedFee?: number) => ActionResult;
  onManagerNegotiationFailed: (club: string, managerName: string) => void;
  onSetFormation: (club: string, formationId: string) => ActionResult;
  onSetKit: (club: string, kit: ClubKit) => ActionResult;
  onProposeKitVote: (club: string, optionA: ClubKit, optionB: ClubKit, favor: "a" | "b" | undefined) => ActionResult;
  onStandForPresident: (club: string) => ActionResult;
  onSetPresidentWage: (club: string, wage: number) => ActionResult;
  otherOwnedClubs: string[];
  onMergeClubs: (primaryClub: string, absorbedClub: string) => ActionResult;
  son: CareerState["son"];
  onHaveASon: () => ActionResult;
  onAgeUpSon: () => ActionResult;
  onPromoteSon: (club: string) => ActionResult;
  onTransferSon: (toClub: string) => ActionResult;
  onRenameStadium: (club: string, name: string) => ActionResult;
  onUpgradeStadiumCapacity: (club: string) => ActionResult;
  onUpgradeTrainingGround: (club: string) => ActionResult;
  onUpgradeYouthAcademy: (club: string) => ActionResult;
}) {
  const isOwnClub = club === career.player.club;
  // Squad/Sign genuinely can't work here yet — see the note above the
  // manager-appointment own-club branch in investments.ts — so this never
  // defaults into a tab that would just show "No squad data on file."
  const [section, setSection] = useState<"squad" | "sign" | "manager" | "powers" | "history">(initialSection ?? (isOwnClub ? "manager" : "squad"));
  const [topUp, setTopUp] = useState(1000);
  const [message, setMessage] = useState<string | null>(null);
  const state = ownedClubState(career, club);
  const squad = squadFor(career, club);

  const runAction = (result: ActionResult) => {
    setMessage(result.ok ? null : (result.reason ?? "That didn't go through."));
  };

  // Negotiating a real fee (negotiation.ts) before either action actually
  // fires — a free-agent signing has no seller to negotiate with, so that
  // one path still goes straight through as before. A "sell" negotiation
  // now always names a real buyer club (`buyerClub`) — see `interestList`
  // below, the real destination this whole flow was built around.
  const [negotiating, setNegotiating] = useState<
    | { kind: "sign"; playerId: string; fromClub: string; playerName: string; marketValue: number }
    | { kind: "sell"; playerId: string; playerName: string; buyerClub: string; marketValue: number }
    | { kind: "manager"; club: string; managerName: string; marketValue: number }
    | null
  >(null);
  // A completed sale negotiation waits here for one more real choice —
  // reported directly, 14 Sep 2026: selling used to fire the moment
  // negotiation ended, with no chance to put it to a fan vote first (and no
  // way to skip the vote either, before that same fix). Only "sell" needs
  // this extra step; a completed sign negotiates once and is done.
  const [pendingSale, setPendingSale] = useState<{ playerId: string; playerName: string; fee: number; buyerClub: string } | null>(null);
  // The realistic destination market itself — reported directly, 14 Sep
  // 2026: selling used to just remove a player with nowhere to go. Clicking
  // Sell now opens this instead of going straight to a negotiation:
  // transferMarket.ts's real reach/need scoring decides who's genuinely
  // interested and what they'd expect to pay. A club that genuinely rejects
  // or walks away (a real negotiation failure, not a pause) is dropped from
  // this same list rather than ended outright — the interest was real,
  // that specific attempt wasn't.
  const [interestList, setInterestList] = useState<
    { playerId: string; playerName: string; interests: TransferInterest[] } | null
  >(null);
  // Requested directly, 14 Sep 2026: "you should be able to go back" mid-
  // negotiation to check other clubs, then return to the SAME one later and
  // see their real current position, not the original expected offer.
  // Keyed by club — a full NegotiationScreen state, not just a number, so
  // resuming restores the exact log/mood/round it was stepped away at.
  const [savedNegotiations, setSavedNegotiations] = useState<Record<string, NegotiationState>>({});

  if (pendingSale) {
    return (
      <div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-4 mb-2 text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1">Confirm sale</div>
          <div className="font-black text-white text-lg">{pendingSale.playerName}</div>
          <div className="text-[10px] font-bold text-white/70 mt-1">to {pendingSale.buyerClub}</div>
          <div className="text-yellow-300 font-black text-sm mt-1">for ★{money(pendingSale.fee)}</div>
        </div>
        <button
          onClick={() => { const sale = pendingSale; setPendingSale(null); runAction(onSellPlayer(club, sale.playerId, sale.fee, sale.buyerClub)); }}
          className="w-full mb-2 px-3 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-sm"
        >
          Confirm Sale
        </button>
        <button
          onClick={() => { const sale = pendingSale; setPendingSale(null); runAction(onProposeSellVote(club, sale.playerId, sale.fee, sale.buyerClub)); }}
          className="w-full mb-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs"
        >
          Put It To A Shareholder Vote First
        </button>
        <button onClick={() => setPendingSale(null)} className="w-full text-xs font-black text-white/70 hover:text-white">Cancel</button>
      </div>
    );
  }

  if (negotiating) {
    const savedState = negotiating.kind === "sell" ? savedNegotiations[negotiating.buyerClub] : undefined;
    return (
      <NegotiationScreen
        mode={negotiating.kind === "sell" ? "selling" : "buying"}
        playerName={negotiating.kind === "manager" ? negotiating.managerName : negotiating.playerName}
        counterpartLabel={negotiating.kind === "sell" ? negotiating.buyerClub : negotiating.kind === "manager" ? "His Representatives" : undefined}
        marketValue={negotiating.marketValue}
        initialState={savedState}
        onStepAway={negotiating.kind === "sell" ? state => {
          const deal = negotiating;
          setSavedNegotiations(s => ({ ...s, [deal.buyerClub]: state }));
          setNegotiating(null);
        } : undefined}
        onDone={finalPrice => {
          const deal = negotiating;
          setNegotiating(null);
          if (finalPrice === null) {
            setMessage("Talks broke down — no deal was made.");
            if (deal.kind === "sell") {
              // A real rejection/walkout, not a step-away — this club is
              // genuinely done, not just paused.
              setSavedNegotiations(s => { const { [deal.buyerClub]: _, ...rest } = s; return rest; });
              setInterestList(list => list && { ...list, interests: list.interests.filter(i => i.club !== deal.buyerClub) });
            }
            if (deal.kind === "manager") onManagerNegotiationFailed(deal.club, deal.managerName);
            return;
          }
          if (deal.kind === "sign") { runAction(onSignPlayer(club, deal.playerId, deal.fromClub, finalPrice)); return; }
          if (deal.kind === "manager") { runAction(onReplaceManager(deal.club, deal.managerName, finalPrice)); return; }
          setInterestList(null);
          setSavedNegotiations({});
          setPendingSale({ playerId: deal.playerId, playerName: deal.playerName, fee: finalPrice, buyerClub: deal.buyerClub });
        }}
      />
    );
  }

  if (interestList) {
    return (
      <div>
        <button onClick={() => { setInterestList(null); setSavedNegotiations({}); }} className="mb-2 text-xs font-black text-white/90 hover:text-white">← Back</button>
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 mb-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/80">Selling</div>
          <div className="font-black text-white">{interestList.playerName}</div>
        </div>
        {interestList.interests.length === 0 && (
          <div className="text-center text-xs font-bold text-white/70 py-6">No club is genuinely interested right now.</div>
        )}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          {interestList.interests.map(i => {
            const inTalks = savedNegotiations[i.club];
            return (
              <div key={i.club} className="flex items-center justify-between px-3 py-2.5 border-b border-black/20 last:border-b-0">
                <div>
                  <div className="text-sm font-bold text-white">{i.club}</div>
                  <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wide">
                    Wants him as a {i.roleIntent} ·{" "}
                    {inTalks
                      ? `★${money(inTalks.theirPosition)} current offer`
                      : `★${money(i.expectedOffer)} expected offer`}
                  </div>
                </div>
                <button
                  onClick={() => setNegotiating({
                    kind: "sell", playerId: interestList.playerId, playerName: interestList.playerName,
                    buyerClub: i.club, marketValue: i.expectedOffer,
                  })}
                  className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-[10px] font-black"
                >
                  {inTalks ? "Resume" : "Negotiate"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Requested directly: majority (or full) ownership of your own club now
  // unlocks the same real powers as any other club, not just a budget top-
  // up — Manager (into the real career.manager, not the cosmetic record
  // every other club's appointment writes to) and Powers' Kit/Facilities/
  // Presidency, none of which touch your own squad's data at all. Squad and
  // Sign stay hidden here specifically — they read the OTHER 19 clubs'
  // LeagueSquad shape, and your own real teammates live in a different,
  // richer SquadPlayer[] this Boardroom doesn't translate to yet. Powers'
  // Formation/Son/Merger are hidden below for the same reason.
  return (
    <div>
      <button onClick={onBack} className="mb-2 text-xs font-black text-white/90 hover:text-white">← All boards</button>
      <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 mb-2">
        <div className="flex items-center gap-2">
          {clubKitFor(career, club) && <KitSwatch kit={clubKitFor(career, club)!.home} size={32} />}
          <div>
            <div className="font-black text-white">{club}</div>
            <div className="text-[10px] text-white/90">
              Manager: {isOwnClub ? (career.manager?.name || "Vacant") : (loadLineup(club)?.manager || state.managerName || "Vacant")}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-gray-900 rounded-lg px-2 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-white font-semibold">Budget</span>
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

      <div className={`grid gap-1 mb-2 ${isOwnClub ? "grid-cols-3" : "grid-cols-5"}`}>
        {(isOwnClub ? (["manager", "powers", "history"] as const) : (["squad", "sign", "manager", "powers", "history"] as const)).map(s => (
          <button
            key={s}
            onClick={() => { setSection(s); setMessage(null); }}
            className={`py-1.5 rounded-lg font-black text-[10px] uppercase transition ${
              section === s ? "bg-emerald-600" : "bg-gray-700 text-white font-semibold"
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
                <div className="text-[10px] text-white font-semibold">{p.position} · OVR {p.overall}</div>
              </div>
              <button
                onClick={() => { setSavedNegotiations({}); setInterestList({ playerId: p.id, playerName: p.name, interests: interestedClubs(p, club, career) }); }}
                className="px-2.5 py-1 rounded-md bg-red-600/80 hover:bg-red-500 text-[10px] font-black"
              >
                Sell
              </button>
            </div>
          ))}
          {(!squad || squad.players.length === 0) && (
            <div className="px-3 py-6 text-center text-xs text-white font-semibold">No squad data on file yet.</div>
          )}
        </div>
      )}

      {section === "sign" && (
        <SignPlayerPanel
          career={career} club={club}
          onSignFreeAgent={(c, p, f) => runAction(onSignPlayer(c, p, f))}
          onNegotiateSigning={(playerId, fromClub, playerName, marketValue) =>
            setNegotiating({ kind: "sign", playerId, fromClub, playerName, marketValue })
          }
        />
      )}

      {section === "manager" && (
        <ManagerPanel
          career={career} club={club}
          onNegotiate={(c, n, anchorFee) => setNegotiating({ kind: "manager", club: c, managerName: n, marketValue: anchorFee })}
        />
      )}

      {section === "powers" && (
        <PowersPanel
          career={career} club={club}
          onSetFormation={(c, f) => runAction(onSetFormation(c, f))}
          onSetKit={(c, k) => runAction(onSetKit(c, k))}
          onProposeKitVote={(c, a, b, favor) => runAction(onProposeKitVote(c, a, b, favor))}
          onStandForPresident={(c) => runAction(onStandForPresident(c))}
          onSetPresidentWage={(c, w) => runAction(onSetPresidentWage(c, w))}
          otherOwnedClubs={otherOwnedClubs}
          onMergeClubs={(p, a) => runAction(onMergeClubs(p, a))}
          son={son} onHaveASon={() => runAction(onHaveASon())} onAgeUpSon={() => runAction(onAgeUpSon())}
          onPromoteSon={(c) => runAction(onPromoteSon(c))} onTransferSon={(c) => runAction(onTransferSon(c))}
          onRenameStadium={(c, n) => runAction(onRenameStadium(c, n))}
          onUpgradeStadiumCapacity={(c) => runAction(onUpgradeStadiumCapacity(c))}
          onUpgradeTrainingGround={(c) => runAction(onUpgradeTrainingGround(c))}
          onUpgradeYouthAcademy={(c) => runAction(onUpgradeYouthAcademy(c))}
        />
      )}

      {section === "history" && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
          {(career.clubTransferHistory?.[club] ?? []).map((t, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 border-b border-black/20 last:border-b-0">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{t.playerName}</div>
                <div className="text-[10px] text-white font-semibold">
                  {t.direction === "in" ? `In from ${t.otherClub}` : `Out to ${t.otherClub}`} · Season {t.season}
                </div>
              </div>
              <span className={`shrink-0 font-black text-sm ${t.direction === "in" ? "text-red-300" : "text-emerald-300"}`}>
                {t.direction === "in" ? "-" : "+"}★{formatMoneyPrecise(t.fee)}
              </span>
            </div>
          ))}
          {(!career.clubTransferHistory?.[club] || career.clubTransferHistory[club].length === 0) && (
            <div className="px-3 py-6 text-center text-xs text-white font-semibold">No transfers done through this club yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PHASE 3 OF STAR_POWER_POLITICS.MD — THE REST OF THE OWNERSHIP LAYER ────

function PowersPanel({
  career, club, onSetFormation, onSetKit, onProposeKitVote, onStandForPresident, onSetPresidentWage,
  otherOwnedClubs, onMergeClubs, son, onHaveASon, onAgeUpSon, onPromoteSon, onTransferSon,
  onRenameStadium, onUpgradeStadiumCapacity, onUpgradeTrainingGround, onUpgradeYouthAcademy,
}: {
  career: CareerState; club: string;
  onSetFormation: (club: string, formationId: string) => void;
  onSetKit: (club: string, kit: ClubKit) => void;
  onProposeKitVote: (club: string, optionA: ClubKit, optionB: ClubKit, favor: "a" | "b" | undefined) => void;
  onStandForPresident: (club: string) => void;
  onSetPresidentWage: (club: string, wage: number) => void;
  otherOwnedClubs: string[];
  onMergeClubs: (primaryClub: string, absorbedClub: string) => void;
  son: CareerState["son"];
  onHaveASon: () => void;
  onAgeUpSon: () => void;
  onPromoteSon: (club: string) => void;
  onTransferSon: (toClub: string) => void;
  onRenameStadium: (club: string, name: string) => void;
  onUpgradeStadiumCapacity: (club: string) => void;
  onUpgradeTrainingGround: (club: string) => void;
  onUpgradeYouthAcademy: (club: string) => void;
}) {
  const state = ownedClubState(career, club);
  const kit = clubKitFor(career, club);
  const facilities = facilitiesFor(career, club);
  // Formation and the Son/Merger mechanics all move players through
  // findSquadEntry, which only ever holds the OTHER 19 clubs' LeagueSquad —
  // your own real teammates (career.squad) are a different shape this
  // Boardroom doesn't translate to yet, so these three stay hidden for your
  // own club specifically. Kit, Facilities, and the Presidency below have no
  // such conflict and work exactly the same as any other club.
  const isOwnClub = club === career.player.club;
  const [formationId, setFormationId] = useState(state.formation ?? "433");
  // Defaults to this club's REAL current kit (kitsOf, kits.ts) rather than a
  // flat hardcoded red — Design A starts as "what you already wear," same
  // idea as the negotiation screens defaulting to a real anchor, not zero.
  const realDefault = kitsOf(club);
  const [kitA, setKitA] = useState<ClubKit>(kit ?? realDefault);
  // Reported directly, and reproduced exactly: put a kit to a fan vote,
  // Design B (this picker's own fixed default) wins, and the NEXT time the
  // kit picker opens, Design A now shows the just-adopted current kit —
  // which IS that same fixed default — while Design B still defaults to
  // the identical literal. Two options that are always meant to be a real
  // choice ended up showing the same colours because one of them was never
  // anything but a hardcoded constant. Guaranteed different from whatever
  // the current kit actually is now, picking a second alternate only if the
  // first alternate happens to already be the current kit.
  const KIT_ALT_1: ClubKit = { home: { shirt: "#1d4ed8", trim: "#facc15" }, away: { shirt: "#ffffff", trim: "#1d4ed8" } };
  const KIT_ALT_2: ClubKit = { home: { shirt: "#111827", trim: "#dc2626" }, away: { shirt: "#dc2626", trim: "#111827" } };
  const sameKit = (a: ClubKit, b: ClubKit) =>
    a.home.shirt === b.home.shirt && a.home.trim === b.home.trim && a.away.shirt === b.away.shirt && a.away.trim === b.away.trim;
  const [kitB, setKitB] = useState<ClubKit>(kit && sameKit(kit, KIT_ALT_1) ? KIT_ALT_2 : KIT_ALT_1);
  const [wage, setWage] = useState(state.presidentWage ?? 0);
  const [mergeTarget, setMergeTarget] = useState(otherOwnedClubs[0] ?? "");
  const [stadiumName, setStadiumName] = useState(facilities.stadiumName);

  return (
    <div className="space-y-3">
      {isOwnClub ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-3 text-[11px] font-semibold text-white/90">
          Formation is already yours to set on the real team sheet — this Powers tab only stands in for a manager
          this club doesn't have, and you already do.
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1.5">Formation (manager's tactics)</div>
          <div className="flex items-center gap-2">
            <select
              value={formationId} onChange={e => setFormationId(e.target.value)}
              className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white"
            >
              {FORMATIONS.map(f => <option key={f.id} value={f.id}>{f.name ?? f.id}</option>)}
            </select>
            <button
              onClick={() => onSetFormation(club, formationId)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-black text-xs whitespace-nowrap"
            >
              Set
            </button>
          </div>
          <div className="mt-1 text-[9px] text-white font-semibold">Real strength with this shape: {clubStrengthWithFormation(career, club)}</div>
        </div>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1.5">Kit</div>
        <div className="mb-2 text-[9px] text-white/70 leading-snug">
          A real home AND away kit, exactly like a real match — clash rules still apply. Design A and B below are two full candidates you can put to a real fan vote (or set directly); whichever wins genuinely becomes this club's kit in real matches, not just here.
        </div>
        {kit && (
          <div className="mb-2 flex items-center gap-3 text-[10px] text-white font-semibold">
            <div className="flex items-center gap-1.5">
              <KitSwatch kit={kit.home} size={36} />
              <span>Home <span className="w-3.5 h-3.5 rounded-full border border-white/30 inline-block align-middle ml-1" style={{ background: kit.home.shirt }} /></span>
            </div>
            <div className="flex items-center gap-1.5">
              <KitSwatch kit={kit.away} size={36} />
              <span>Away <span className="w-3.5 h-3.5 rounded-full border border-white/30 inline-block align-middle ml-1" style={{ background: kit.away.shirt }} /></span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {([["A", kitA, setKitA], ["B", kitB, setKitB]] as const).map(([label, design, setDesign]) => (
            <div key={label}>
              <div className="text-[9px] font-bold text-white/90 mb-1">Design {label}</div>
              {(["home", "away"] as const).map(side => (
                <div key={side} className="flex items-center gap-1.5 mb-1">
                  <KitSwatch kit={design[side]} size={26} />
                  <span className="text-[8px] font-bold text-white/60 uppercase w-8">{side}</span>
                  <input
                    type="color" value={design[side].shirt}
                    onChange={e => setDesign({ ...design, [side]: { ...design[side], shirt: e.target.value } })}
                    className="w-5 h-5 rounded" title={`${side} shirt`}
                  />
                  <input
                    type="color" value={design[side].trim}
                    onChange={e => setDesign({ ...design, [side]: { ...design[side], trim: e.target.value } })}
                    className="w-5 h-5 rounded" title={`${side} trim`}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          <button onClick={() => onSetKit(club, kitA)} className="flex-1 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-[10px] font-black">
            Set Design A directly
          </button>
          <button onClick={() => onSetKit(club, kitB)} className="flex-1 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-[10px] font-black">
            Set Design B directly
          </button>
        </div>
        {/* Reported directly: this used to always nominate Design A as the
            owner's favourite, with no way to actually root for B — so a
            legitimate Design B win read as the vote "failing" on the
            ceremony screen even though it won fairly. Two real options now. */}
        <div className="mt-1.5 flex gap-1">
          <button onClick={() => onProposeKitVote(club, kitA, kitB, "a")} className="flex-1 py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 text-[10px] font-black">
            Vote — favour A
          </button>
          <button onClick={() => onProposeKitVote(club, kitA, kitB, "b")} className="flex-1 py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 text-[10px] font-black">
            Vote — favour B
          </button>
        </div>
        <button onClick={() => onProposeKitVote(club, kitA, kitB, undefined)} className="mt-1.5 w-full py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-[10px] font-black text-white/90">
          Vote — no favourite, let the fans decide
        </button>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1.5">Presidency</div>
        {state.isPresident ? (
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} value={wage} onChange={e => setWage(Math.max(0, Number(e.target.value)))}
              className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white"
            />
            <button onClick={() => onSetPresidentWage(club, wage)} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-black text-xs whitespace-nowrap">
              Set wage
            </button>
          </div>
        ) : (
          <button onClick={() => onStandForPresident(club)} className="w-full py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 text-[10px] font-black">
            Stand for president (shareholder vote)
          </button>
        )}
      </div>

      {!isOwnClub && otherOwnedClubs.length > 0 && (
        <div className="bg-gray-800 border border-red-900/60 rounded-xl p-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-red-300 mb-1.5">Merge/takeover (100% ownership of both required)</div>
          <div className="flex items-center gap-2">
            <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white">
              {otherOwnedClubs.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => onMergeClubs(club, mergeTarget)} className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-500 font-black text-xs whitespace-nowrap">
              Absorb
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1.5">Son</div>
        {!son ? (
          <button onClick={onHaveASon} className="w-full py-1.5 rounded-md bg-blue-600/80 hover:bg-blue-500 text-[10px] font-black">
            Have a son
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="text-[10px] text-white font-semibold">
              {son.name} · Age {son.age} · OVR {son.overall} · {son.club ?? "Not on a team yet"}
            </div>
            <div className="flex gap-1">
              <button onClick={onAgeUpSon} className="flex-1 py-1.5 rounded-md bg-purple-600/80 hover:bg-purple-500 text-[10px] font-black">
                Use the potion
              </button>
              {isOwnClub ? (
                <div className="flex-1 text-[9px] text-white/60 font-semibold flex items-center justify-center text-center px-1">
                  Getting him into YOUR squad isn't wired up here yet — see the transfer market instead.
                </div>
              ) : !son.club ? (
                <button onClick={() => onPromoteSon(club)} className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[10px] font-black">
                  Promote to first team
                </button>
              ) : (
                <button onClick={() => onTransferSon(club)} className="flex-1 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-[10px] font-black">
                  Transfer here
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1.5">Facilities</div>
        <div className="flex items-center gap-2 mb-1.5">
          <input value={stadiumName} onChange={e => setStadiumName(e.target.value)} className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white" />
          <button onClick={() => onRenameStadium(club, stadiumName)} className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 font-black text-xs whitespace-nowrap">
            Rename
          </button>
        </div>
        <div className="text-[11px] text-white font-semibold mb-1.5">
          Capacity {facilities.stadiumCapacity.toLocaleString()} · Training tier {facilities.trainingGroundTier}/3 · Youth tier {facilities.youthAcademyTier}/3
        </div>
        {facilities.stadiumBuild && (
          <div className="mb-1.5 rounded-lg bg-amber-900/30 border border-amber-700/60 px-2.5 py-1.5 text-[10px] font-bold text-amber-200">
            🏗️ Expanding to {facilities.stadiumBuild.targetCapacity.toLocaleString()} — {facilities.stadiumBuild.seasonsRemaining} season{facilities.stadiumBuild.seasonsRemaining === 1 ? "" : "s"} left
          </div>
        )}
        <div className="flex gap-1">
          <button
            disabled={!!facilities.stadiumBuild}
            onClick={() => onUpgradeStadiumCapacity(club)}
            className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[10px] font-black"
          >
            {facilities.stadiumBuild ? "Expansion under way" : "+5,000 seats (real build time)"}
          </button>
          <button
            disabled={facilities.trainingGroundTier >= 3}
            onClick={() => onUpgradeTrainingGround(club)}
            className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[10px] font-black"
          >
            Upgrade training
          </button>
          <button
            disabled={facilities.youthAcademyTier >= 3}
            onClick={() => onUpgradeYouthAcademy(club)}
            className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[10px] font-black"
          >
            Upgrade academy
          </button>
        </div>
        <div className="mt-1.5 text-[9px] text-white font-semibold">A bigger stadium earns this club real gate-receipt revenue every season.</div>
      </div>
    </div>
  );
}

function SignPlayerPanel({
  career, club, onSignFreeAgent, onNegotiateSigning,
}: {
  career: CareerState; club: string;
  onSignFreeAgent: (club: string, playerId: string, fromClub: string) => void;
  onNegotiateSigning: (playerId: string, fromClub: string, playerName: string, marketValue: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [positionFilter, setPositionFilter] = useState<Set<string>>(new Set());
  const [nationFilter, setNationFilter] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [minRating, setMinRating] = useState("");
  const [maxRating, setMaxRating] = useState("");
  const [sortBy, setSortBy] = useState<"rating" | "value">("rating");
  const [sortDesc, setSortDesc] = useState(true);
  const freeAgents = (career.freeAgents ?? []).map(p => ({ ...p, fromClub: FREE_AGENTS_CLUB }));
  // Reported directly, 14 Sep 2026, and a real bug: signing "from" the
  // human player's own club pulled from a stale, redundant copy of that
  // club's squad `leagueSquads` carries (fetched as part of the whole
  // division, nothing ever excludes it) — never career.squad, the club's
  // REAL roster. The player got added to the buying club for real but was
  // never actually removed from his own club's real team sheet. This
  // system was never built to touch career.squad at all, so the fix is to
  // never offer the human's own club as a "from" option here in the first
  // place — see transferMarket.ts's own note on the same root cause.
  // Reported directly, 15 Sep 2026, and a real bug: a huge run of DIFFERENT
  // clubs' fake, generated players sorted straight to the top of the list,
  // right behind the real free agents — because leagueSquads.ts's own
  // fallback formula (`62 + (seed % 22)`) tops out at EXACTLY 83 for every
  // generated squad, so once sorted by overall descending, dozens of
  // unrelated clubs' fake "best player" all land on the identical 83 and
  // cluster together. Checked directly against the live database
  // afterward: every Champions/Europa/Other club this game tracks DOES have
  // real player rows on file under the exact name asked for — so a save
  // showing this isn't missing data, it's almost always a stale
  // `externalSquads` snapshot taken before a name-matching fix landed.
  // `leagueSquads.ts`'s own `shouldUpgradeExternalSquads` already re-fetches
  // a snapshot like that automatically on next load — but regardless of
  // WHY a squad is still fake, `generatedSquad`'s own `gen:` id prefix (the
  // same tell `shouldUpgradeExternalSquads` uses) means a fictional player
  // is never offered as a signing option here.
  // Reported directly, 16 Sep 2026, a real bug with real money lost over
  // it: the human player's own character showed up as a signable candidate
  // FROM a club he no longer even played for (his original club, long since
  // left for good) — "buying" it did something (money left the buying
  // club's budget) but connected to nothing real: this system was never
  // built to move `career.player`/`career.squad` at all, only the
  // LeaguePlayer-shaped records the OTHER 19 clubs carry, so it can never
  // legitimately contain the human character in the first place. Whatever
  // stale snapshot let a leftover record with his exact name survive under
  // an old club long after he actually transferred away, the fix that
  // matters is the same shape as the "gen:" filter just above it: never
  // offer HIM as a buyable candidate, full stop, regardless of which club's
  // data he's stuck in or why.
  const yourName = `${career.player.firstName} ${career.player.lastName}`;
  const rawOthers = [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])]
    .filter(s => s.club !== club && s.club !== career.player.club)
    .flatMap(s => s.players.map(p => ({ ...p, fromClub: s.club })))
    .filter(p => !p.id.startsWith("gen:"))
    .filter(p => p.name !== yourName);
  // Reported directly, and a real bug: the same real player turning up
  // "four in a row and then two more further down" — spamming filters
  // afterward made it look like the panel had stopped responding at all,
  // which duplicate rows explain too: this list is keyed on
  // `${fromClub}:${id}`, and a genuinely duplicate (fromClub, id) pair
  // gives React two siblings sharing one key, which is exactly the kind of
  // thing that leaves a list rendering stale/wrong on the next update.
  // `career.leagueSquads`/`career.externalSquads` aren't mutually
  // exclusive by construction — the same real player.id can legitimately
  // turn up in both (a stale snapshot overlap, or a club briefly present
  // in both lists at once) — so dedupe by id here rather than chasing every
  // possible way the two source lists could overlap upstream, keeping only
  // the first sighting of each real player.
  const seenIds = new Set<string>();
  const others = rawOthers.filter(p => {
    if (seenIds.has(p.id)) return false;
    seenIds.add(p.id);
    return true;
  });
  const everyone = [...freeAgents, ...others];

  // Requested directly, researched for feasibility first: every field these
  // filters need (multi-position, nationality, rating, club, market value)
  // was already on the data reaching this screen — nothing new to fetch.
  const withValue = everyone.map(p => ({ ...p, marketValue: playerMarketValue(p, p.fromClub, career) }));

  // Options are built off the FULL pool (before any filter narrows it) so
  // the dropdowns always offer every real choice, not just whatever
  // happens to survive the filters already applied.
  const allPositions = Array.from(new Set(everyone.flatMap(p => (p.positions?.length ? p.positions : [p.position])))).sort();
  const allNations = Array.from(new Set(everyone.map(p => p.nation).filter((n): n is string => !!n))).sort();
  const allClubs = Array.from(new Set(everyone.map(p => p.fromClub))).sort();

  const min = minRating === "" ? undefined : Number(minRating);
  const max = maxRating === "" ? undefined : Number(maxRating);

  let pool = withValue.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  if (positionFilter.size > 0) {
    pool = pool.filter(p => (p.positions?.length ? p.positions : [p.position]).some(pos => positionFilter.has(pos)));
  }
  if (nationFilter) pool = pool.filter(p => p.nation === nationFilter);
  if (clubFilter) pool = pool.filter(p => p.fromClub === clubFilter);
  if (min !== undefined && !Number.isNaN(min)) pool = pool.filter(p => p.overall >= min);
  if (max !== undefined && !Number.isNaN(max)) pool = pool.filter(p => p.overall <= max);

  pool = [...pool].sort((a, b) => {
    const diff = sortBy === "rating" ? a.overall - b.overall : a.marketValue - b.marketValue;
    return sortDesc ? -diff : diff;
  }).slice(0, 60);

  const togglePosition = (pos: string) => setPositionFilter(prev => {
    const next = new Set(prev);
    if (next.has(pos)) next.delete(pos); else next.add(pos);
    return next;
  });

  const activeFilterCount = positionFilter.size + (nationFilter ? 1 : 0) + (clubFilter ? 1 : 0) + (min !== undefined ? 1 : 0) + (max !== undefined ? 1 : 0);

  return (
    <>
      <div className="flex gap-2 mb-2">
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players…"
          className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`shrink-0 px-3 rounded-lg text-[10px] font-black ${showFilters || activeFilterCount > 0 ? "bg-emerald-600 text-white" : "bg-gray-800 border border-gray-700 text-white/70"}`}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {showFilters && (
        <div className="mb-2 bg-gray-800 border border-gray-700 rounded-xl p-2.5 space-y-2">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Position</div>
            <div className="flex flex-wrap gap-1">
              {allPositions.map(pos => (
                <button
                  key={pos}
                  onClick={() => togglePosition(pos)}
                  className={`px-2 py-1 rounded text-[10px] font-black ${positionFilter.has(pos) ? "bg-emerald-500 text-emerald-950" : "bg-gray-700 text-white/80"}`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Nationality</div>
              <select
                value={nationFilter} onChange={e => setNationFilter(e.target.value)}
                className="w-full rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-[11px] text-white"
              >
                <option value="">Any</option>
                {allNations.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Club</div>
              <select
                value={clubFilter} onChange={e => setClubFilter(e.target.value)}
                className="w-full rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-[11px] text-white"
              >
                <option value="">Any</option>
                {allClubs.map(c => <option key={c} value={c}>{c === FREE_AGENTS_CLUB ? "Free agent" : c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Rating range</div>
            <div className="flex items-center gap-2">
              <input
                type="number" placeholder="Min" value={minRating} onChange={e => setMinRating(e.target.value)}
                className="w-full rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-[11px] text-white"
              />
              <span className="text-white/50 text-[10px]">to</span>
              <input
                type="number" placeholder="Max" value={maxRating} onChange={e => setMaxRating(e.target.value)}
                className="w-full rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-[11px] text-white"
              />
            </div>
          </div>

          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-1">Sort by</div>
            <div className="flex gap-1">
              {(["rating", "value"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase ${sortBy === s ? "bg-emerald-600 text-white" : "bg-gray-700 text-white/80"}`}
                >
                  {s === "rating" ? "Rating" : "Market value"}
                </button>
              ))}
              <button
                onClick={() => setSortDesc(v => !v)}
                className="px-3 py-1.5 rounded-md bg-gray-700 text-white/80 text-[10px] font-black"
              >
                {sortDesc ? "High→Low" : "Low→High"}
              </button>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setPositionFilter(new Set()); setNationFilter(""); setClubFilter(""); setMinRating(""); setMaxRating(""); }}
              className="w-full py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-[10px] font-black text-white/80"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-[45vh] overflow-y-auto">
        {pool.map(p => (
          <div key={`${p.fromClub}:${p.id}`} className="flex items-center justify-between px-3 py-2 border-b border-black/20 last:border-b-0">
            <div>
              <div className="text-sm font-bold text-white">{p.name}</div>
              <div className="text-[10px] text-white font-semibold">
                {p.position} · OVR {p.overall} · ★{formatMoney(p.marketValue)} · {p.fromClub === FREE_AGENTS_CLUB ? "Free agent" : p.fromClub}
              </div>
            </div>
            <button
              onClick={() => p.fromClub === FREE_AGENTS_CLUB
                ? onSignFreeAgent(club, p.id, p.fromClub)
                : onNegotiateSigning(p.id, p.fromClub, p.name, p.marketValue)}
              className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-[10px] font-black text-emerald-950"
            >
              {p.fromClub === FREE_AGENTS_CLUB ? "Sign" : "Negotiate"}
            </button>
          </div>
        ))}
        {pool.length === 0 && <div className="px-3 py-6 text-center text-xs text-white font-semibold">No players match.</div>}
      </div>
    </>
  );
}

function ManagerPanel({
  career, club, onNegotiate,
}: { career: CareerState; club: string; onNegotiate: (club: string, managerName: string, anchorFee: number) => void }) {
  // Own club reads the REAL career.manager — that's what appointing someone
  // here actually writes to (see investments.ts's replaceManagerForOwnedClub).
  // Every other club keeps the same read priority as the Boardroom header
  // above: the real saved lineup's manager wins over this club's own
  // separate managerName record, since that's what every other screen
  // actually displays.
  const current = club === career.player.club
    ? career.manager?.name
    : (loadLineup(club)?.manager || ownedClubState(career, club).managerName);
  // The real, single source of truth for "who's actually on the market" —
  // career.availableManagers, maintained by every hire/sack this game
  // already does (careerFlow.ts's own-club sacking, replaceManagerForOwnedClub
  // for an owned club). Reported directly: a manager already in a job used
  // to stay ON this list, greyed out with an "At <club>" label — reads as
  // "still technically pickable," when the whole point of a real transfer
  // market is that an employed manager isn't in it at all. He's just left
  // off the list now, exactly like the just-sacked man he replaced is
  // already correctly added BACK to this same list by the code that fired
  // him — nothing new needed there, it just was never reflected here.
  const marketPool = career.availableManagers ?? allPoolManagers();
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
      {allPoolManagers().map(name => {
        if (name === current) {
          return (
            <div key={name} className="flex items-center justify-between px-3 py-2 border-b border-black/20 last:border-b-0">
              <span className="text-sm font-bold text-emerald-300">{name} (current)</span>
            </div>
          );
        }
        if (!marketPool.includes(name)) return null;
        const interest = managerInterest(career, name, club);
        return (
          <div key={name} className="flex items-center justify-between px-3 py-2 border-b border-black/20 last:border-b-0">
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">{name}</div>
              {!interest.willing && (
                <div className="text-[9px] font-semibold text-white/60 leading-snug">{interest.reason}</div>
              )}
            </div>
            <button
              disabled={!interest.willing}
              onClick={() => onNegotiate(club, name, interest.anchorFee)}
              className="shrink-0 ml-2 px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-[10px] font-black text-emerald-950"
            >
              {interest.willing ? "Negotiate" : "Not Interested"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
