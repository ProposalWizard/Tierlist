"use client";
import { reputationLabel } from "@/lib/star/reputation";
import { fameOf, fameLevel } from "@/lib/star/fame";
import type { CareerState } from "@/lib/star/types";
import { MAJORITY_THRESHOLD, clubValuation } from "@/lib/star/investments";
import { GOVERNING_BODIES, influenceIn, canProposeRuleChange } from "@/lib/star/governingBodies";
import { isBodyPresident } from "@/lib/star/leadership";
import { formatMoney } from "@/lib/star/money";

/**
 * OWNERSHIP — THE ONE HOME FOR EVERYTHING STAR POWER & POLITICS BUILT.
 *
 * Reported directly: Reputation, the Rule Book, and Invest used to be three
 * separate, unrelated-looking home-page buttons with no sense that they were
 * one system — "being kind of a chairman or a shareholder or a president."
 * This is a single nicely-designed hub, not a fourth wall of text: a
 * condensed reputation strip, your governing-body standing, and a real card
 * per club you hold a stake in, each one tapping straight through to the
 * genuine screen that already does the work (ReputationScreen, RuleBookScreen,
 * Investments' own boardroom) — nothing here reimplements any of them, it
 * only gives them one visible front door.
 */

function money(n: number): string {
  return formatMoney(n);
}

function RepBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between text-[9px] font-black text-white mb-0.5">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function OwnershipScreen({
  career, onBack, onReputation, onRuleBook, onOpenMarket, onOpenBoardroom,
}: {
  career: CareerState;
  onBack: () => void;
  onReputation: () => void;
  onRuleBook: () => void;
  onOpenMarket: () => void;
  onOpenBoardroom: (club: string) => void;
}) {
  const rep = career.reputation;
  const owned = (career.investments ?? []).filter(i => i.percent > 0).sort((a, b) => b.percent - a.percent);
  const anyPresidency = GOVERNING_BODIES.some(b => isBodyPresident(career, b));
  const anyCanPropose = GOVERNING_BODIES.some(b => canProposeRuleChange(career, b));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="px-3 py-2 bg-gray-700 rounded-lg font-black text-sm">← Back</button>
          <div className="font-black text-white text-lg">Ownership</div>
          <div />
        </div>

        {/* ── Reputation strip ── */}
        <button
          onClick={onReputation}
          className="w-full text-left bg-emerald-900/30 border border-emerald-700 rounded-xl p-3 mb-2.5 hover:bg-emerald-900/45 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/90">🌍 Reputation</div>
            <div className="text-[10px] font-black text-emerald-300">Details →</div>
          </div>
          <div className="flex gap-2">
            <RepBar label={`Reputation · ${reputationLabel(rep)}`} value={rep} />
            <RepBar label={`Fame · ${fameLevel(fameOf(career)).name}`} value={fameOf(career)} />
          </div>
        </button>

        {/* ── Governing bodies / Rule Book ── */}
        <button
          onClick={onRuleBook}
          className="w-full text-left bg-indigo-900/30 border border-indigo-700 rounded-xl p-3 mb-2.5 hover:bg-indigo-900/45 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/90">⚖️ Rule Book &amp; Governing Bodies</div>
            <div className="text-[10px] font-black text-indigo-300">Open →</div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {GOVERNING_BODIES.map(b => {
              const inf = influenceIn(career, b);
              const president = isBodyPresident(career, b);
              return (
                <div
                  key={b}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black ${
                    president ? "bg-amber-400 text-black" : "bg-black/30 text-white"
                  }`}
                >
                  {president && "👑"}{b} {inf}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 text-[9px] font-semibold text-white/90">
            {anyPresidency
              ? "You hold a presidency — real powers unlocked."
              : anyCanPropose
              ? "You have enough influence to propose a rule change."
              : "Invest influence with a governing body to start proposing changes."}
          </div>
        </button>

        {/* ── Your clubs ── */}
        <div className="text-[10px] font-black uppercase tracking-widest text-white/90 mb-1.5 mt-1">
          Your Clubs {owned.length > 0 && `(${owned.length})`}
        </div>
        {owned.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-6 text-center text-sm font-semibold text-white/90">
            You don&apos;t hold a stake in any club yet.
          </div>
        ) : (
          <div className="space-y-2 mb-2.5">
            {owned.map(stake => {
              const majority = stake.percent >= MAJORITY_THRESHOLD;
              const valuation = clubValuation(stake.club, career);
              const holdingValue = Math.round(valuation * (stake.percent / 100));
              return (
                <button
                  key={stake.club}
                  onClick={() => (majority ? onOpenBoardroom(stake.club) : onOpenMarket())}
                  className="w-full text-left bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 hover:bg-gray-700 transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-black text-white text-sm truncate">{stake.club}</div>
                    <div className="text-[10px] font-bold text-white/90">
                      {stake.percent.toFixed(stake.percent < 1 ? 3 : 1)}% owned
                      {majority && <span className="ml-1.5 text-amber-300">· Majority</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] font-black text-yellow-300 tabular-nums">★{money(holdingValue)}</div>
                    <div className="text-[9px] font-bold text-white/80">{majority ? "Boardroom →" : "Portfolio →"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={onOpenMarket}
          className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-black text-sm text-black"
        >
          Browse Clubs to Invest In
        </button>
      </div>
    </div>
  );
}
