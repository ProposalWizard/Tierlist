"use client";
import { useEffect } from "react";
import Graphic from "./media/Graphics";
import type { GraphicSpec } from "@/lib/star/media/types";
import type { CareerState } from "@/lib/star/types";
import type { MonthAward } from "@/lib/star/potm";

/**
 * WINNING IT.
 *
 * The award already existed in three places — the feed, the Awards tab and your
 * honours — and in none of them did it interrupt you. You found out you had won
 * Player of the Month by scrolling past it, which is a strange way to be told.
 *
 * So it stops the game. Once, on the night, only when it is you: somebody else
 * winning is news and yours is a moment, and a modal that fired ten times a
 * season for other people's months would be the first thing anybody turned off.
 *
 * The card is the same `potmWinner` graphic the feed carries, at the size a
 * graphic deserves when it is the only thing on screen. Building a second
 * celebratory layout would mean two things to keep in step.
 */

interface Props {
  award: MonthAward;
  career: CareerState;
  onClose: () => void;
}

export default function PotmWinModal({ award, career, onClose }: Props) {
  // Escape and Enter both dismiss it. It is a single OK button, and a modal
  // with one action should take any reasonable key as that action.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const spec: GraphicSpec = {
    type: "potmWinner",
    month: award.monthName,
    firstName: career.player.firstName,
    lastName: career.player.lastName,
    club: career.player.club,
    goals: award.goals,
    assists: award.assists,
    isYou: true,
    // The same rule as everywhere else: your photograph if you took one, the
    // back of your shirt if you did not.
    ...(career.player.portrait
      ? { face: career.player.portrait, own: true as const }
      : { number: career.squadNumber ?? 0 }),
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${award.monthName} Player of the Month`}
      onClick={onClose}
    >
      {/* Stop a click on the card itself from dismissing — the backdrop is the
          dismiss target, and losing the moment by tapping the picture of it is
          exactly the wrong behaviour. */}
      <div
        className="w-full max-w-sm animate-[potm-in_260ms_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 text-center">
          <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-300">
            Player of the Month
          </div>
          <div className="mt-1 text-2xl font-black uppercase leading-none text-white">
            You won it
          </div>
          <div className="mt-1.5 text-[12px] font-bold text-white/80">
            {award.monthName} — {award.goals} goal{award.goals === 1 ? "" : "s"} and{" "}
            {award.assists} assist{award.assists === 1 ? "" : "s"}
          </div>
        </div>

        <Graphic spec={spec} />

        <button
          onClick={onClose}
          autoFocus
          className="mt-4 w-full rounded-xl bg-amber-400 py-3 text-sm font-black uppercase tracking-widest text-gray-950 transition hover:bg-amber-300 active:scale-[0.98]"
        >
          OK
        </button>
      </div>

      <style jsx global>{`
        @keyframes potm-in {
          from { opacity: 0; transform: scale(0.92) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes potm-in { from { opacity: 1; } to { opacity: 1; } }
        }
      `}</style>
    </div>
  );
}
