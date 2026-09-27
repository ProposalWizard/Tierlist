"use client";
import type { LiveScoreRow } from "@/lib/star/liveScores";
import { shortClub } from "@/lib/star/media/grammar";
import ClubBadge from "./ClubBadge";

/**
 * EVERY SCORE IN THE DIVISION, RIGHT NOW (v0.15 plan item 35).
 *
 * Harry: "a small arrow that opens a panel listing every live score in the
 * division right now, Football Manager style." Opened from the button under
 * the match clock, closed with the ×. The bell on each club ticks it for goal
 * notifications (the same list as Settings → Live scores).
 */
export default function LiveScoresPanel({
  rows, minuteLabel, followed, onToggleFollow, onClose,
}: {
  rows: LiveScoreRow[];
  minuteLabel: string;
  followed: readonly string[];
  onToggleFollow: (club: string) => void;
  onClose: () => void;
}) {
  const bell = (club: string) => {
    const on = followed.includes(club);
    return (
      <button
        onClick={() => onToggleFollow(club)}
        aria-label={`${on ? "Stop" : "Get"} goal alerts for ${club}`}
        aria-pressed={on}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] ${on ? "bg-amber-400 text-gray-950" : "bg-white/10 text-white/60"}`}
      >
        🔔
      </button>
    );
  };
  return (
    <div className="absolute inset-x-2 top-2 bottom-2 z-40 flex flex-col overflow-hidden rounded-xl border border-white/15 bg-gray-950/95 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="rounded bg-red-600 px-1 text-[9px] font-black uppercase tracking-wider text-white">Live</span>
        <span className="flex-1 text-[11px] font-black uppercase tracking-widest text-white">Scores · {minuteLabel}&apos;</span>
        <button
          onClick={onClose}
          aria-label="Close live scores"
          className="grid h-6 w-6 place-items-center rounded bg-white/10 text-sm font-black text-white hover:bg-white/20"
        >
          ×
        </button>
      </div>
      <p className="px-3 pt-1.5 text-[10px] font-bold text-white/70">Tap 🔔 to get a club&apos;s goals during your match.</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1.5">
        {rows.map((r) => (
          <div key={`${r.home}-${r.away}`} className="flex items-center gap-1.5 border-b border-white/5 py-1.5">
            {bell(r.home)}
            <ClubBadge club={r.home} size={16} />
            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">{shortClub(r.home)}</span>
            <span className="shrink-0 rounded bg-white px-1.5 text-[12px] font-black tabular-nums text-gray-950">{r.hs}-{r.as}</span>
            <span className="min-w-0 flex-1 truncate text-right text-[12px] font-bold text-white">{shortClub(r.away)}</span>
            <ClubBadge club={r.away} size={16} />
            {bell(r.away)}
          </div>
        ))}
      </div>
    </div>
  );
}
