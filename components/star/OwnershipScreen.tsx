"use client";
import { reputationLabel } from "@/lib/star/reputation";
import { fameOf, fameLevel } from "@/lib/star/fame";
import type { CareerState } from "@/lib/star/types";
import { MAJORITY_THRESHOLD, clubValuation } from "@/lib/star/investments";
import { GOVERNING_BODIES, influenceIn, canProposeRuleChange } from "@/lib/star/governingBodies";
import { isBodyPresident } from "@/lib/star/leadership";
import { formatMoney } from "@/lib/star/money";
import ClubBadge from "./ClubBadge";
import { CountUp, Glow, PressButton, Shine, StatBar, clubTheme } from "./ui";
import { Screen, ScreenHeader, SectionLabel, useLater } from "./ui/Screen";

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
  const on = useLater(250);
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between text-[9px] font-black text-white mb-0.5">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <StatBar value={on ? value : 0} className="h-2" />
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
  const theme = clubTheme(career.player.club, career);
  const countIn = useLater(400);

  return (
    <Screen glow={theme.glow}>
      <div className="w-full">
        <ScreenHeader title="Ownership" kicker="Your empire" onBack={onBack} />

        {/* ── Reputation strip ── */}
        <button
          onClick={onReputation}
          className="kit-card kit-rise kib-press w-full text-left p-3 mb-2.5"
          style={{ ["--kit-glow" as string]: "#10b981" } as React.CSSProperties}
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
          className="kit-card kit-rise kib-press w-full text-left p-3 mb-2.5"
          style={{ ["--kit-glow" as string]: "#6366f1", animationDelay: "80ms" } as React.CSSProperties}
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
                    president ? "bg-gradient-to-b from-yellow-300 to-amber-500 text-black" : "kit-row text-white"
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
        <SectionLabel className="mb-1.5 mt-1">
          Your Clubs {owned.length > 0 && `(${owned.length})`}
        </SectionLabel>
        {owned.length === 0 ? (
          <div className="kit-card px-4 py-6 text-center text-sm font-semibold text-white/90">
            You don&apos;t hold a stake in any club yet.
          </div>
        ) : (
          <div className="space-y-2 mb-2.5">
            {owned.map((stake, i) => {
              const majority = stake.percent >= MAJORITY_THRESHOLD;
              const valuation = clubValuation(stake.club, career);
              const holdingValue = Math.round(valuation * (stake.percent / 100));
              const glow = clubTheme(stake.club, career).glow;
              return (
                <button
                  key={stake.club}
                  onClick={() => (majority ? onOpenBoardroom(stake.club) : onOpenMarket())}
                  className="kit-card kit-rise kib-press relative w-full overflow-hidden text-left px-3 py-2.5 flex items-center justify-between gap-2"
                  style={{ ["--kit-glow" as string]: glow, animationDelay: `${160 + i * 80}ms`, ...(majority ? { boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5), 0 10px 24px -12px rgba(0,0,0,.8)" } : {}) } as React.CSSProperties}
                >
                  {majority && <Shine loop every={6} />}
                  <span className="relative shrink-0"><Glow color={glow} alpha={0.45} className="inset-0 blur-md" /><span className="relative block"><ClubBadge club={stake.club} size={34} /></span></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-white text-sm truncate">{stake.club}</div>
                    <div className="text-[10px] font-bold text-white/90">
                      {stake.percent.toFixed(stake.percent < 1 ? 3 : 1)}% owned
                      {majority && <span className="ml-1.5 text-amber-300">· Majority</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[12px] font-black text-yellow-300 tabular-nums">★<CountUp value={countIn ? holdingValue : 0} ms={800} format={(n) => money(Math.round(n))} /></div>
                    <div className="text-[9px] font-bold text-white/80">{majority ? "Boardroom →" : "Portfolio →"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <PressButton
          variant="primary"
          pulse
          onClick={onOpenMarket}
          className="relative w-full overflow-hidden"
        >
          <Shine loop every={5} />
          Browse Clubs to Invest In
        </PressButton>
      </div>
    </Screen>
  );
}
