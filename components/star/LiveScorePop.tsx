"use client";
import { useEffect } from "react";
import type { LiveGoal } from "@/lib/star/liveScores";
import { shortClub } from "@/lib/star/media/grammar";
import ClubBadge from "./ClubBadge";

/**
 * A GOAL ELSEWHERE, AS IT GOES IN (v0.15 plan item 35).
 *
 * A goal for a club you have ticked (Settings → Live scores, or the bell in
 * the live-scores panel) slides in over the commentary at the minute it is
 * scored. One card at a time: a newer goal replaces it. It closes itself
 * after a few seconds, or with the ×. It never covers the pitch: the match
 * file only draws it while the commentary is on screen.
 */
export const LIVE_POP_MS = 4000;

export default function LiveScorePop({ pop, onClose }: { pop: LiveGoal & { id: number }; onClose: () => void }) {
  // Auto-dismiss; a newer goal (a new id) restarts the clock.
  useEffect(() => {
    const t = setTimeout(onClose, LIVE_POP_MS);
    return () => clearTimeout(t);
  }, [pop.id, onClose]);
  return (
    <div className="absolute left-2 right-16 top-2 z-30">
      <style>{`
        @keyframes kibLivePop { 0% { transform: translateY(-10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .kib-live-pop { animation: kibLivePop 0.25s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .kib-live-pop { animation: none; } }
      `}</style>
      <div
        key={pop.id}
        data-live-score={`${pop.minute}' ${pop.home} ${pop.hs}-${pop.as} ${pop.away}`}
        className="kib-live-pop flex items-center gap-1.5 rounded-lg border border-white/15 border-l-4 border-l-red-500 bg-gray-950/95 py-1 pl-1.5 pr-1 shadow-xl"
      >
        <span className="shrink-0 text-[9px] font-black tabular-nums text-white">⚽ {pop.minute}&apos;</span>
        <ClubBadge club={pop.home} size={14} />
        <span className={`min-w-0 flex-1 truncate text-[11px] ${pop.scoredBy === "home" ? "font-black text-white" : "font-bold text-white/80"}`}>
          {shortClub(pop.home)}
        </span>
        <span className="shrink-0 rounded bg-white px-1 text-[11px] font-black tabular-nums text-gray-950">
          {pop.hs}-{pop.as}
        </span>
        <span className={`min-w-0 flex-1 truncate text-right text-[11px] ${pop.scoredBy === "away" ? "font-black text-white" : "font-bold text-white/80"}`}>
          {shortClub(pop.away)}
        </span>
        <ClubBadge club={pop.away} size={14} />
        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-white/10 text-[11px] font-black text-white hover:bg-white/20"
        >
          ×
        </button>
      </div>
    </div>
  );
}
