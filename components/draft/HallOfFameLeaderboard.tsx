"use client";
import { CrownIcon, Laurel } from "./HallOfFameChrome";
import { POINTS_BY_RANK } from "@/lib/hallOfFameLeaderboard";
import type { LeaderboardEntry } from "@/lib/hallOfFameLeaderboard";

/**
 * Overall standings across every record board on screen.
 *
 * Follows the mode and competition tabs rather than being a separate all-time
 * table, so the points always add up to what the boards below actually show.
 */

const RANK_STYLES = [
  { ring: "border-amber-400/60",  text: "text-amber-300",  glow: "shadow-[0_0_22px_-6px_rgba(251,191,36,0.55)]" },
  { ring: "border-slate-300/50",  text: "text-slate-200",  glow: "" },
  { ring: "border-orange-500/50", text: "text-orange-300", glow: "" },
  { ring: "border-white/15",      text: "text-white",      glow: "" },
  { ring: "border-white/15",      text: "text-white",      glow: "" },
];

export default function HallOfFameLeaderboard({
  table, scope, boardCount,
}: {
  table: LeaderboardEntry[];
  /** e.g. "Premier League · Best" — what these points were counted from. */
  scope: string;
  /** How many record boards fed the table. */
  boardCount: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-600/25 mb-5 bg-[radial-gradient(120%_140%_at_70%_0%,#1a1330_0%,#0b0d16_55%,#07080d_100%)]">
      <div className="relative px-4 sm:px-5 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-1">
          <CrownIcon className="w-7 h-5 shrink-0" />
          <h2 className="text-lg sm:text-xl font-black uppercase italic tracking-tight text-white leading-none">
            Standings
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-amber-500/40 to-transparent" />
        </div>
        <p className="text-[11px] text-white/75 mb-4">
          {POINTS_BY_RANK.join(" · ")} points for 1st through 5th on each record.
          {" "}Counted from {boardCount} {boardCount === 1 ? "board" : "boards"} — {scope}.
        </p>

        {table.length === 0 ? (
          <p className="text-sm text-white/75 py-3 text-center">
            No records set yet. Play a season and the standings start here.
          </p>
        ) : (
          <div className="space-y-1.5">
            {table.map((row, i) => {
              const style = RANK_STYLES[i] ?? RANK_STYLES[4];
              const golds = row.placings[0];
              return (
                <div
                  key={row.username}
                  className={`flex items-center gap-3 rounded-xl border ${style.ring} ${style.glow} bg-white/[0.03] px-3 py-2.5`}
                >
                  {/* Position */}
                  <div className="relative w-7 shrink-0 flex items-center justify-center">
                    {i === 0 && <Laurel className="absolute -left-1 w-4 h-6 opacity-70" />}
                    <span className={`text-lg font-black italic tabular-nums leading-none ${style.text}`}>
                      {i + 1}
                    </span>
                  </div>

                  {/* Who */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-white truncate leading-tight">
                      {row.username}
                    </div>
                    <div className="text-[10px] text-white/75 leading-tight">
                      {golds > 0 && (
                        <span className="text-amber-300 font-bold">
                          {golds} record{golds === 1 ? "" : "s"} held
                          <span className="text-white/50"> · </span>
                        </span>
                      )}
                      {row.boards} board{row.boards === 1 ? "" : "s"}
                      <span className="text-white/50"> · </span>
                      {row.placings
                        .map((n, r) => (n > 0 ? `${n}×${r + 1}${["st", "nd", "rd", "th", "th"][r]}` : null))
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right shrink-0">
                    <div className={`text-xl font-black tabular-nums leading-none ${style.text}`}>
                      {row.points}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/70">
                      pts
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
