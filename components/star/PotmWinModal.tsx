"use client";
import { useEffect } from "react";
import Graphic from "./media/Graphics";
import type { GraphicSpec } from "@/lib/star/media/types";
import type { CareerState } from "@/lib/star/types";
import type { MonthAward } from "@/lib/star/potm";
import { KitStyles, Burst, Shine, PressButton, clubTheme, rgba } from "./ui";
import { Rays } from "./ui/Screen";

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
 *
 * Wave 2 reskin (28 Sep 2026): it lands like a trophy — rises into slowly
 * turning light rays, confetti in your club's colours, a shine across the
 * card. All CSS; still for a phone set to reduce motion.
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

  const theme = clubTheme(career.player.club, career);
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-hidden p-4 backdrop-blur-sm"
      style={{ background: `radial-gradient(70% 50% at 50% 40%, ${rgba(theme.glow, 0.35)}, transparent 70%), rgba(2,4,10,.86)` }}
      role="dialog"
      aria-modal="true"
      aria-label={`${award.monthName} Player of the Month`}
      onClick={onClose}
    >
      <KitStyles />
      {/* Stop a click on the card itself from dismissing — the backdrop is the
          dismiss target, and losing the moment by tapping the picture of it is
          exactly the wrong behaviour. */}
      <div
        className="kit-trophy-in relative w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <Rays color="#fde68a" size={520} className="top-[44%]" />
        <Burst colors={[theme.shirt, theme.trim, "#fde047", "#ffffff"]} count={30} spread={1.4} className="left-1/2 top-[40%]" />

        <div className="relative mb-3 text-center">
          <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-300" style={{ textShadow: "0 0 10px rgba(251,191,36,.5)" }}>
            Player of the Month
          </div>
          <div className="kit-drop-in" style={{ animationDelay: "250ms" }}>
            <div
              className="kit-text-shine mt-1 text-[30px] font-black uppercase italic leading-none"
              style={{ backgroundImage: "linear-gradient(100deg,#fde68a 20%,#ffffff 45%,#fbbf24 60%,#fde68a 80%)", filter: "drop-shadow(0 3px 0 rgba(0,0,0,.5))" }}
            >
              You won it
            </div>
          </div>
          <div className="mt-1.5 text-[12px] font-bold text-white/85">
            {award.monthName} — {award.goals} goal{award.goals === 1 ? "" : "s"} and{" "}
            {award.assists} assist{award.assists === 1 ? "" : "s"}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl" style={{ boxShadow: `0 0 0 1px rgba(253,230,138,.35), 0 0 40px ${rgba("#fbbf24", 0.35)}, 0 18px 36px -12px rgba(0,0,0,.9)` }}>
          <Graphic spec={spec} />
          <Shine trigger={1} className="z-10" />
        </div>

        <PressButton
          variant="gold"
          size="lg"
          onClick={onClose}
          autoFocus
          className="relative mt-4 w-full overflow-hidden tracking-widest"
        >
          <Shine loop every={4} />
          OK
        </PressButton>
      </div>
    </div>
  );
}
