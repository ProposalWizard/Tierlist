"use client";
import { useState } from "react";
import type { MatchStats } from "@/lib/star/types";
import { kitsFor } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { CHANCE_KIND_LABEL, CHANCE_OUTCOME_LABEL, chanceOutcomeGood, type ChanceOutcome } from "@/lib/star/chanceLog";
import { minuteLabel } from "@/lib/star/addedTime";

interface Props {
  stats: MatchStats;
  homeTeam: string;
  awayTeam: string;
  /**
   * Were YOU the home side? Needed because `MatchStats.homeScore` does not
   * mean what it says: `finaliseMatch` fills it with the USER's score and
   * `awayScore` with the opponent's, whatever the venue (every other reader —
   * careerFlow, the media record, the league table — treats them that way).
   * This screen was the one place pairing them with venue-ordered team names,
   * so an away win read back as a home defeat by the same scoreline.
   */
  youAreHome?: boolean;
  onContinue: () => void;
  /** The competition, when it was not a league game. */
  competition?: string;
  /** What the tie did to the run: through, out, or a trophy. */
  knockout?: string | null;
  /** Your star rating before and after this match — the bar on a simmed
   *  match's result (item 36). */
  starBefore?: number;
  starAfter?: number;
}

// The same black outline the live scoreboard puts on its club-name text —
// white over a light kit (Fulham/Leeds white, a bright yellow away strip)
// needs it to stay legible.
const NAME_OUTLINE = {
  textShadow: "-1px -1px 1.5px #000, 1px -1px 1.5px #000, -1px 1px 1.5px #000, 1px 1px 1.5px #000",
};

export default function PostMatch({ stats, homeTeam, awayTeam, onContinue, competition, knockout, youAreHome = true, starBefore, starAfter }: Props) {
  const hs = youAreHome ? stats.homeScore : stats.awayScore;
  const as = youAreHome ? stats.awayScore : stats.homeScore;
  const kits = kitsFor(homeTeam, awayTeam);
  // Item 26: tapping the rating opens the list of your chances.
  const [chancesOpen, setChancesOpen] = useState(false);
  const log = stats.chanceLog;
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white px-3 py-4">
      <div className="max-w-sm mx-auto">
        <div className="text-center text-[10px] uppercase tracking-widest font-black text-white/75 mb-1.5">
          {competition ? competition : "Full Time"}
        </div>
        {/* The same scoreboard-plate look the live match itself uses, real
            kit colours included, instead of a plain "Home 2 — 0 Away" line
            whose dash read oddly large next to two single-digit scores. */}
        <div className="flex items-center justify-between gap-1">
          <div
            className="flex-1 rounded-l-lg border px-2 py-1.5 text-white font-black text-xs truncate"
            style={{ backgroundColor: kits.home.shirt, borderColor: kits.home.trim, ...NAME_OUTLINE }}
          >
            {shortClub(homeTeam).toUpperCase()}
          </div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow tabular-nums">{hs}</div>
          <div className="bg-white text-black font-black text-lg px-3 py-1 rounded shadow tabular-nums">{as}</div>
          <div
            className="flex-1 rounded-r-lg border px-2 py-1.5 text-white font-black text-xs truncate text-right"
            style={{ backgroundColor: kits.away.shirt, borderColor: kits.away.trim, ...NAME_OUTLINE }}
          >
            {shortClub(awayTeam).toUpperCase()}
          </div>
        </div>
        {knockout && (
          <div className={`mt-2 rounded-t-xl border border-b-0 border-gray-600 py-2.5 px-3 text-center text-sm font-black ${
            knockout.startsWith("🏆") ? "bg-amber-400 text-gray-950"
              : knockout.startsWith("Into") || knockout.startsWith("Through") ? "bg-emerald-600 text-white"
                : "bg-red-700 text-white"}`}
          >
            {knockout}
          </div>
        )}
        {/* Item 36: a simmed match is just the score, your goals and assists,
            your rating and your star rating — then home. */}
        {stats.simmed ? (
          <div className={`bg-gray-700 border border-gray-600 ${knockout ? "rounded-b-xl" : "mt-2 rounded-xl"} overflow-hidden`}>
            <div className="bg-sky-900/70 py-1.5 text-center text-[11px] font-black uppercase tracking-widest text-sky-100">
              ⏩ Simulated{stats.enteredAt ? ` · on at ${stats.enteredAt}'` : ""}
            </div>
            <Row label="Goals" value={stats.goals} highlight={stats.goals > 0} />
            <Row label="Assists" value={stats.assists} highlight={stats.assists > 0} />
            <RowRating label="Match Rating" value={stats.rating} />
            <StarBar before={starBefore} after={starAfter} />
          </div>
        ) : (<>
        <div className={`bg-gray-800 border-x border-gray-600 py-3 text-center ${knockout ? "" : "mt-2 rounded-t-xl border-t"}`}>
          <div className="text-xl font-black text-white uppercase tracking-wider">Match Stats</div>
        </div>

        <div className="bg-gray-700 border-x border-b border-gray-600">
          <Row label="Chances" value={stats.chances} />
          <Row label="Goals" value={stats.goals} highlight={stats.goals > 0} />
          <Row label="Assists" value={stats.assists} highlight={stats.assists > 0} />
          <Row label="Passes" value={stats.passes} />
          <RowRating
            label="Match Rating"
            value={stats.rating}
            onTap={log ? () => setChancesOpen((o) => !o) : undefined}
            open={chancesOpen}
          />
          {log && chancesOpen && <ChanceList chances={log} />}
          <RowStar label="Wage" value={stats.wage} />
          <RowStar label="Goal Bonus" value={stats.goalBonus} />
          <RowStar label="Sponsors" value={stats.sponsorPay} />
          <div className="bg-emerald-700 py-2 px-3 flex items-center border-t border-black/30">
            <div className="font-black text-white text-sm flex-1">Total Cash</div>
            <div className="flex items-center gap-1 font-black text-white text-sm">
              <StarIcon /> {stats.totalCash}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 p-2 bg-gray-800">
            <RelChip label="Boss" delta={stats.bossChange} />
            <RelChip label="Team" delta={stats.teamChange} />
            <RelChip label="Fans" delta={stats.fansChange} />
          </div>

          <div className="p-3 flex items-center gap-2 border-t border-black/30">
            <StarIcon large />
            <div className="text-sm font-black text-white flex-1">Star Rating</div>
            {stats.starMan && (
              <div className="bg-yellow-500 text-white text-[10px] font-black px-2 py-1 rounded uppercase">Star Man!</div>
            )}
          </div>
        </div>
        </>)}

        <button
          onClick={onContinue}
          className="mt-3 w-full py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-xl font-black transition flex items-center justify-center gap-2"
        >
          Continue
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex items-center py-2 px-3 border-b border-black/30 ${highlight ? "bg-emerald-800/40" : ""}`}>
      <div className="font-black text-xs text-white flex-1">{label}</div>
      <div className={`font-black text-sm ${highlight ? "text-emerald-300" : "text-white"}`}>{value}</div>
    </div>
  );
}
function RowRating({ label, value, onTap, open }: { label: string; value: number; onTap?: () => void; open?: boolean }) {
  const color = value >= 8 ? "text-emerald-300" : value >= 7 ? "text-yellow-300" : value >= 6 ? "text-white" : "text-red-400";
  const inner = (
    <>
      <div className="font-black text-xs text-white flex-1 text-left">
        {label}
        {onTap && <span className="ml-1.5 text-[10px] font-bold text-white/75">{open ? "Hide chances ▴" : "Your chances ▾"}</span>}
      </div>
      <div className={`font-black text-lg ${color}`}>{value.toFixed(1)}</div>
    </>
  );
  return onTap ? (
    <button onClick={onTap} aria-expanded={open} className="flex w-full items-center py-2 px-3 border-b border-black/30 bg-emerald-800/50 hover:bg-emerald-800/70">
      {inner}
    </button>
  ) : (
    <div className="flex items-center py-2 px-3 border-b border-black/30 bg-emerald-800/50">{inner}</div>
  );
}
/** Item 26: every chance that came to you — the minute, what it was, what happened. */
function ChanceList({ chances }: { chances: { minute: number; kind: string; outcome: string }[] }) {
  return (
    <div className="px-3 py-2 border-b border-black/30 bg-gray-900/70">
      {chances.length === 0 && <div className="text-[12px] font-bold text-white/80">No chances came to you.</div>}
      {chances.map((c, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5 text-[12px] font-black text-white">
          <span className="w-10 shrink-0 tabular-nums text-white/75">{minuteLabel(c.minute)}&apos;</span>
          <span className="min-w-0 flex-1 truncate">{CHANCE_KIND_LABEL[c.kind] ?? c.kind}</span>
          <span className={`shrink-0 ${chanceOutcomeGood(c.outcome) ? "text-emerald-300" : "text-red-300"}`}>
            {CHANCE_OUTCOME_LABEL[c.outcome as ChanceOutcome] ?? c.outcome}
          </span>
        </div>
      ))}
    </div>
  );
}
/**
 * Item 36: your star rating and how far it has come towards the next tenth —
 * the one progress number a simmed match shows.
 */
function StarBar({ before, after }: { before?: number; after?: number }) {
  if (after === undefined) return null;
  const from = before ?? after;
  const tenth = (r: number) => Math.floor(r * 10 + 1e-9);
  const frac = (r: number) => Math.max(0, Math.min(1, r * 10 - tenth(r)));
  const up = tenth(after) > tenth(from);
  const startPct = up ? 0 : frac(from) * 100;
  const endPct = frac(after) * 100;
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <StarIcon large />
        <div className="flex-1 text-sm font-black text-white">Star Rating</div>
        <div className="text-sm font-black text-amber-300 tabular-nums">
          {up ? `${(tenth(from) / 10).toFixed(1)} → ` : ""}{(tenth(after) / 10).toFixed(1)}
        </div>
      </div>
      <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-900" role="meter" aria-label="Progress to the next star rating" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(endPct)}>
        <div className="absolute inset-y-0 left-0 bg-amber-500/60" style={{ width: `${startPct}%` }} />
        <div className="absolute inset-y-0 bg-amber-300" style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }} />
      </div>
      <div className="mt-1 text-[10px] font-bold text-white/80">
        {up ? "Up a notch!" : `${Math.round(endPct)}% of the way to ${((tenth(after) + 1) / 10).toFixed(1)}`}
      </div>
    </div>
  );
}
function RowStar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center py-2 px-3 border-b border-black/30">
      <div className="font-black text-xs text-white flex-1">{label}</div>
      <div className="flex items-center gap-1 font-black text-sm text-white">
        <StarIcon /> {value}
      </div>
    </div>
  );
}
function RelChip({ label, delta }: { label: string; delta: number }) {
  const bg = delta > 0 ? "bg-emerald-600" : delta < 0 ? "bg-red-600" : "bg-gray-600";
  const sign = delta > 0 ? "+" : "";
  return (
    <div className={`${bg} rounded-lg py-1.5 text-center`}>
      <div className="text-white font-black text-xs">{label} {sign}{delta}</div>
    </div>
  );
}
function StarIcon({ large }: { large?: boolean } = {}) {
  const s = large ? 22 : 14;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fbbf24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
