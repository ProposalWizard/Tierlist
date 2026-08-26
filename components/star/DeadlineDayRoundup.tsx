"use client";
import { useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { kitsOf } from "@/lib/star/kits";
import { seasonStartYear } from "@/lib/star/calendar";

/**
 * DEADLINE DAY.
 *
 * The whole division's business, revealed once the moment a transfer window
 * actually closes — club by club, who came in and who went out. The data was
 * always there (leagueTransferNews/leagueLoanNews, "what just happened",
 * replaced whole every window — see LeagueScreen's own quieter "This Window"
 * list) but nothing ever made an occasion of it. This is that occasion:
 * requested with a real transfer-deadline broadcast graphic as the reference
 * for the vibe — dark ground, a bold diagonal gold panel, big condensed
 * type — built in this game's own voice rather than copying anyone's actual
 * branding.
 *
 * Shown exactly once per window (app/star-dev/page.tsx tracks that via
 * `deadlineDayShownFor`), and never for a window that never ran at all — a
 * fresh career's very first (summer) window is deliberately skipped so the
 * hand-curated starting rosters aren't immediately overwritten, and both
 * tracking fields are seeded to the same value for exactly that reason.
 */

interface Deal {
  player: string;
  counterpart: string;
  overall: number;
  detail: string; // "£28m" / "Free Transfer" / "Loan, back 2028/29"
  loan: boolean;
  unhappy: boolean;
}

interface ClubBusiness {
  club: string;
  in: Deal[];
  out: Deal[];
}

function loanReturnLabel(career: CareerState, returnSeason: number): string {
  const y = seasonStartYear(career.player.startYear, returnSeason + 1);
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

function buildBusiness(career: CareerState): ClubBusiness[] {
  const byClub = new Map<string, ClubBusiness>();
  const get = (club: string): ClubBusiness => {
    let b = byClub.get(club);
    if (!b) { b = { club, in: [], out: [] }; byClub.set(club, b); }
    return b;
  };

  for (const m of career.leagueTransferNews ?? []) {
    const detail = m.fee > 0 ? `£${m.fee}m` : "Free Transfer";
    get(m.to).in.push({ player: m.player, counterpart: m.from, overall: m.overall, detail, loan: false, unhappy: m.unhappy });
    get(m.from).out.push({ player: m.player, counterpart: m.to, overall: m.overall, detail, loan: false, unhappy: m.unhappy });
  }
  for (const l of career.leagueLoanNews ?? []) {
    const detail = `Loan · back ${loanReturnLabel(career, l.returnSeason)}`;
    get(l.loanClub).in.push({ player: l.player, counterpart: l.parentClub, overall: l.overall, detail, loan: true, unhappy: false });
    get(l.parentClub).out.push({ player: l.player, counterpart: l.loanClub, overall: l.overall, detail, loan: true, unhappy: false });
  }

  const list = Array.from(byClub.values());
  list.sort((a, b) => {
    if (a.club === career.player.club) return -1;
    if (b.club === career.player.club) return 1;
    return (b.in.length + b.out.length) - (a.in.length + a.out.length);
  });
  return list;
}

const WINDOW_LABEL: Record<string, string> = {
  summer: "Summer Window",
  january: "January Window",
};

export default function DeadlineDayRoundup({ career, onContinue }: { career: CareerState; onContinue: () => void }) {
  const business = useMemo(() => buildBusiness(career), [career]);
  const [selected, setSelected] = useState(() => business[0]?.club ?? career.player.club);
  const active = business.find(b => b.club === selected) ?? business[0];

  const totalDeals = (career.leagueTransferNews?.length ?? 0) + (career.leagueLoanNews?.length ?? 0);
  const totalSpend = (career.leagueTransferNews ?? []).reduce((sum, m) => sum + m.fee, 0);
  const windowKind = (career.lastTransferWindowKey ?? "").split("-")[1];
  const windowLabel = WINDOW_LABEL[windowKind] ?? "Transfer Window";

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#0a0a0d]">
      {/* ── The diagonal gold panel and background chevrons — the reference's
          whole visual signature: a dark ground, a slab of gold cut across it
          at an angle, arrow shapes reinforcing the same diagonal. ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-y-0 right-0 w-[46%] min-w-[280px]"
          style={{
            background: "linear-gradient(115deg, #d99a00 0%, #f5c518 38%, #ffe066 62%, #f0b400 100%)",
            clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0% 100%)",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-[46%] min-w-[280px] opacity-40"
          style={{
            background: "linear-gradient(115deg, transparent 60%, rgba(0,0,0,0.35) 100%)",
            clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0% 100%)",
          }}
        />
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute top-1/2 h-[70vh] w-[70vh] -translate-y-1/2 border-r-[3px] border-amber-400/25"
            style={{ right: `${-10 + i * 9}%`, transform: `translateY(-50%) rotate(${18}deg)` }}
          />
        ))}
      </div>

      {/* Vertical edge tab, matching the reference's rotated sidebar label. */}
      <div className="pointer-events-none absolute left-0 top-0 flex h-full w-8 flex-col items-center justify-start bg-black/70 pt-4">
        <span className="rotate-180 text-[9px] font-black uppercase tracking-[0.3em] text-amber-300" style={{ writingMode: "vertical-rl" }}>
          Transfers
        </span>
      </div>

      {/* ── Header ── */}
      <div className="relative z-10 flex flex-col items-start px-10 pb-2 pt-8 sm:pl-14">
        <span className="rounded-full border border-amber-400/50 bg-black/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
          Season {career.season} · {windowLabel} Closed
        </span>
        <h1 className="mt-3 flex flex-wrap items-baseline gap-x-4 leading-[0.85]">
          <span
            className="text-5xl font-black italic tracking-tight sm:text-7xl"
            style={{
              backgroundImage: "linear-gradient(180deg, #ffe066 0%, #f5c518 45%, #d99a00 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.4))",
            }}
          >
            DEADLINE
          </span>
          <span className="text-5xl font-black italic tracking-tight text-[#151008] sm:text-7xl">
            DAY
          </span>
        </h1>
        <p className="mt-2 max-w-md text-xs font-bold text-white/60 sm:text-sm">
          {totalDeals} deal{totalDeals === 1 ? "" : "s"} done across the division
          {totalSpend > 0 ? ` · £${totalSpend}m changed hands` : ""}.
        </p>
      </div>

      {/* ── Club selector ── */}
      <div className="relative z-10 mt-2 flex gap-1.5 overflow-x-auto px-10 pb-2 sm:pl-14" style={{ scrollbarWidth: "none" }}>
        {business.map(b => {
          const mine = b.club === career.player.club;
          const isActive = b.club === selected;
          const kit = kitsOf(b.club).home.shirt;
          const count = b.in.length + b.out.length;
          return (
            <button
              key={b.club}
              onClick={() => setSelected(b.club)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
                isActive
                  ? "border-black bg-black text-amber-300"
                  : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: kit }} />
              <span className="max-w-[9rem] truncate">{b.club}{mine ? " (You)" : ""}</span>
              <span className={`rounded-full px-1.5 text-[9px] ${isActive ? "bg-amber-400 text-black" : "bg-white/10 text-white/60"}`}>
                {count}
              </span>
            </button>
          );
        })}
        {business.length === 0 && (
          <span className="text-xs font-bold text-white/50">No business this window — a quiet one for everybody.</span>
        )}
      </div>

      {/* ── Selected club: incomings and outgoings ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-10 pb-28 pt-2 sm:pl-14">
        {active && (
          <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-400">
                <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" /> In — {active.in.length}
              </div>
              <div className="space-y-1.5">
                {active.in.length === 0 && <div className="text-xs font-bold text-white/40">No incomings.</div>}
                {active.in.map((d, i) => (
                  <div key={`in-${i}`} className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-black text-white">{d.player}</span>
                      <span className="whitespace-nowrap text-[10px] font-black tabular-nums text-emerald-300">{d.detail}</span>
                    </div>
                    <div className="text-[10px] font-bold text-white/60">
                      from {d.counterpart} · {d.overall} OVR
                      {d.unhappy && <span className="ml-1 text-amber-300">· forced the move</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-rose-400">
                <span className="inline-block h-2 w-2 rounded-sm bg-rose-400" /> Out — {active.out.length}
              </div>
              <div className="space-y-1.5">
                {active.out.length === 0 && <div className="text-xs font-bold text-white/40">No outgoings.</div>}
                {active.out.map((d, i) => (
                  <div key={`out-${i}`} className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-black text-white">{d.player}</span>
                      <span className="whitespace-nowrap text-[10px] font-black tabular-nums text-rose-300">{d.detail}</span>
                    </div>
                    <div className="text-[10px] font-bold text-white/60">
                      to {d.counterpart} · {d.overall} OVR
                      {d.unhappy && <span className="ml-1 text-amber-300">· forced the move</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Ticker + Continue ── */}
      <div className="relative z-10 border-t border-white/10 bg-black/70 px-10 py-3 sm:pl-14">
        <div className="mb-2 overflow-hidden whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-amber-300/70">
          Transfer Centre · {totalDeals} Deals This Window · {WINDOW_LABEL[windowKind] ?? "Transfer Window"} ·
          Transfer Centre · {totalDeals} Deals This Window ·
        </div>
        <button
          onClick={onContinue}
          className="rounded-lg bg-gradient-to-b from-[#ffe066] to-[#d99a00] px-6 py-2.5 text-sm font-black uppercase tracking-wide text-[#151008] shadow-lg transition hover:brightness-110"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
