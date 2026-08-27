"use client";
import { useMemo, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { kitsOf } from "@/lib/star/kits";
import { seasonStartYear } from "@/lib/star/calendar";
import { FREE_AGENTS_CLUB } from "@/lib/star/leagueSquads";
import { shortClub } from "@/lib/star/media/grammar";

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

/**
 * Every club, not just the ones that happened to do business.
 *
 * Reported directly: the selector used to list only clubs that appeared in
 * `leagueTransferNews`/`leagueLoanNews` — so a quiet window for, say,
 * Everton meant Everton was simply not there to click on at all, with no
 * way to confirm "nothing happened" versus "this list doesn't cover them."
 * Seeded from `career.league` (the player's own division, all twenty or all
 * twenty-four) so every real club has a tile, empty or not — a business a
 * club with an actual deal still sorts to the top, ahead of the honestly
 * quiet ones. `FREE_AGENTS_CLUB` is excluded on purpose: it is a pool, not
 * a club, and never earns a tile of its own — a signing FROM it already
 * shows up on the real signing club's own incomings card either way.
 */
function buildBusiness(career: CareerState): ClubBusiness[] {
  const byClub = new Map<string, ClubBusiness>();
  const get = (club: string): ClubBusiness => {
    let b = byClub.get(club);
    if (!b) { b = { club, in: [], out: [] }; byClub.set(club, b); }
    return b;
  };

  for (const t of career.league) get(t.name);

  for (const m of career.leagueTransferNews ?? []) {
    const detail = m.fee > 0 ? `£${m.fee}m` : "Free Transfer";
    if (m.to !== FREE_AGENTS_CLUB) get(m.to).in.push({ player: m.player, counterpart: m.from, overall: m.overall, detail, loan: false, unhappy: m.unhappy });
    if (m.from !== FREE_AGENTS_CLUB) get(m.from).out.push({ player: m.player, counterpart: m.to, overall: m.overall, detail, loan: false, unhappy: m.unhappy });
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
    const byBusiness = (b.in.length + b.out.length) - (a.in.length + a.out.length);
    return byBusiness !== 0 ? byBusiness : a.club.localeCompare(b.club);
  });
  return list;
}

const WINDOW_LABEL: Record<string, string> = {
  summer: "Summer Window",
  january: "January Window",
};

/** A crisp black outline around the gold title, so it reads over black
 *  ground and the gold panel alike — see the note above the title itself. */
const TITLE_OUTLINE =
  "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 6px rgba(0,0,0,0.5)";

export default function DeadlineDayRoundup({ career, onContinue }: { career: CareerState; onContinue: () => void }) {
  const business = useMemo(() => buildBusiness(career), [career]);
  const [selected, setSelected] = useState(() => business[0]?.club ?? career.player.club);
  const active = business.find(b => b.club === selected) ?? business[0];

  const totalDeals = (career.leagueTransferNews?.length ?? 0) + (career.leagueLoanNews?.length ?? 0);
  // Individual fees are already one-decimal (see feeFor in leagueTransfers.ts),
  // but summing several of them hits ordinary float noise — a real window
  // reproduced this as literally "£31.700000000000003m changed hands."
  const totalSpend = Math.round((career.leagueTransferNews ?? []).reduce((sum, m) => sum + m.fee, 0) * 10) / 10;
  const windowKind = (career.lastTransferWindowKey ?? "").split("-")[1];
  const windowLabel = WINDOW_LABEL[windowKind] ?? "Transfer Window";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0a0a0d]">
      {/*
        Everything below lives inside this one narrow column — the same
        max-w-md rectangle every other screen in this game mode runs in
        (DashboardShell, VersusScreen). Reported directly: built and
        screenshotted at desktop width, where the diagonal gold panel below
        (sized as a % of the *viewport*) sprawled into a slab wide enough to
        sit behind the header no matter where it wrapped — so "DAY" being
        dark text depended on the panel reaching it, which broke as soon as
        this was actually seen at the width the game is played at. Confining
        the whole scene to this column fixes both the sizing AND makes the
        panel's own width % mean something real again; the title itself no
        longer depends on the panel at all — see below.
      */}
      <div className="relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden">
        {/* ── The diagonal gold panel and background chevrons — the
            reference's whole visual signature: a dark ground, a slab of
            gold cut across it at an angle, arrow shapes reinforcing the
            same diagonal. ── */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-y-0 right-0 w-[52%]"
            style={{
              background: "linear-gradient(115deg, #d99a00 0%, #f5c518 38%, #ffe066 62%, #f0b400 100%)",
              clipPath: "polygon(22% 0, 100% 0, 100% 100%, 0% 100%)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-[52%] opacity-40"
            style={{
              background: "linear-gradient(115deg, transparent 60%, rgba(0,0,0,0.35) 100%)",
              clipPath: "polygon(22% 0, 100% 0, 100% 100%, 0% 100%)",
            }}
          />
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="absolute top-1/2 h-[70vh] w-[70vh] -translate-y-1/2 border-r-[3px] border-amber-400/25"
              style={{ right: `${-30 + i * 16}%`, transform: `translateY(-50%) rotate(${18}deg)` }}
            />
          ))}
        </div>

        {/* Vertical edge tab, matching the reference's rotated sidebar label. */}
        <div className="pointer-events-none absolute left-0 top-0 flex h-full w-7 flex-col items-center justify-start bg-black/70 pt-4">
          <span className="rotate-180 text-[9px] font-black uppercase tracking-[0.3em] text-amber-300" style={{ writingMode: "vertical-rl" }}>
            Transfers
          </span>
        </div>

        {/* ── Header ── */}
        <div className="relative z-10 flex flex-col items-start px-3 pb-2 pt-9 pl-9">
          <span className="rounded-full border border-amber-400/50 bg-black/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-300">
            Season {career.season} · {windowLabel} Closed
          </span>
          {/*
            Both words the same solid gold now — no more "DAY" set in a
            colour meant to disappear into the panel behind it, which only
            worked when the panel actually reached that far. A black outline
            (the same layered-shadow trick VersusScreen's player names use,
            not a background-clip gradient — that combined with a text-shadow
            outline into something unreadable in testing) keeps it legible
            over black ground OR gold panel, wherever the line wraps on a
            given screen, rather than needing the two to line up by luck.
          */}
          <h1
            className="mt-2 whitespace-nowrap text-[2.15rem] font-black italic leading-[0.85] tracking-tight text-[#ffd23f]"
            style={{ textShadow: TITLE_OUTLINE }}
          >
            DEADLINE DAY
          </h1>
          <p className="mt-1.5 text-[11px] font-bold text-white/70">
            {totalDeals} deal{totalDeals === 1 ? "" : "s"} done across the division
            {totalSpend > 0 ? ` · £${totalSpend}m changed hands` : ""}.
          </p>
        </div>

        {/* ── Club selector — every club in the division, not just the ones
            with a deal to show. See buildBusiness above.
            A single horizontal-scrolling row used to hold all of these —
            reported directly: "I can only see three clubs to click on." A
            wrapping grid shows most of a twenty-club division at once
            instead of one at a time off-screen, with its own short vertical
            scroll for the rest (a twenty-four-club Championship season, or
            a phone too narrow to fit four per row). ── */}
        <div className="relative z-10 mt-1 flex max-h-[176px] flex-wrap content-start gap-1.5 overflow-y-auto px-3 pb-2 pl-9">
          {business.map(b => {
            const mine = b.club === career.player.club;
            const isActive = b.club === selected;
            const kit = kitsOf(b.club).home;
            const count = b.in.length + b.out.length;
            return (
              <button
                key={b.club}
                onClick={() => setSelected(b.club)}
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide transition ${
                  isActive
                    ? "border-black bg-black text-amber-300"
                    : count > 0
                      ? "border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
                      : "border-white/10 bg-white/[0.02] text-white/45 hover:bg-white/10"
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full border border-white/30" style={{ backgroundColor: kit.shirt }} />
                <span className="max-w-[5.5rem] truncate">{shortClub(b.club)}{mine ? " (You)" : ""}</span>
                <span className={`rounded-full px-1.5 text-[9px] ${isActive ? "bg-amber-400 text-black" : count > 0 ? "bg-white/10 text-white/60" : "bg-white/5 text-white/35"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Selected club: incomings and outgoings, stacked — a phone-
            width column has no room for the two side by side. ── */}
        <div className="relative z-10 flex-1 overflow-y-auto px-3 pb-28 pt-2 pl-9">
          {active && (
            <div className="flex flex-col gap-4">
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
        <div className="relative z-10 border-t border-white/10 bg-black/70 px-3 py-3 pl-9">
          <div className="mb-2 overflow-hidden whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-amber-300/70">
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
    </div>
  );
}
