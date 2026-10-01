"use client";
import type { CareerState, Skills } from "@/lib/star/types";
import {
  TRAINING_LEVELS, highestUnlocked, starsOf, totalStars, skillFromStars,
} from "@/lib/star/trainingLevels";
import { KitStyles, Shine, Glow, SquareBar, useClubTheme, rgba } from "./ui";

/**
 * Pick a training level (Mikey, 25 Sep 2026 — New Star Soccer's ladder).
 * Thirty per skill, stars on each, locked until the one before has a star.
 * Any unlocked level can be replayed to win the stars you missed.
 *
 * Restyled 29 Sep 2026 in the Training page's look (Mikey: "this looks very
 * boring how it is now"): the skill's own colour, glowing cards, and a level
 * grid that lights up with the stars you've won.
 */

const LOOK: Record<keyof Skills, { title: string; icon: string; accent: string; line: string }> = {
  pace: { title: "Pace", icon: "⚡", accent: "#facc15", line: "Faster dribbles, more runs into space" },
  power: { title: "Power", icon: "💪", accent: "#fb923c", line: "Long shots and stronger crosses" },
  technique: { title: "Technique", icon: "🎯", accent: "#22d3ee", line: "Ball control, curl, precise strikes" },
  vision: { title: "Vision", icon: "👁️", accent: "#a78bfa", line: "More team-mates to pass to" },
  freeKick: { title: "Free Kick", icon: "🎪", accent: "#f472b6", line: "Free kicks, corners and penalties" },
};

export default function TrainingLevelSelect({ career, skill, onPlay, onBack }: {
  career: CareerState;
  skill: keyof Skills;
  onPlay: (level: number) => void;
  onBack: () => void;
}) {
  const levels = starsOf(career, skill);
  const open = highestUnlocked(levels);
  const stars = totalStars(levels);
  const value = career.skills[skill];
  const ceiling = skillFromStars(stars);
  const { glow } = useClubTheme(career);
  const look = LOOK[skill];
  const a = look.accent;
  const max = TRAINING_LEVELS * 3;

  return (
    <div className="min-h-screen text-white px-4 py-4"
      style={{ background: `radial-gradient(90% 40% at 50% 0%, ${rgba(glow, 0.35)}, transparent 70%), var(--sk-page, linear-gradient(180deg, #0b1220, #05070d))` }}>
      <KitStyles />
      <div className="mx-auto w-full max-w-sm">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="kib-press rounded-xl bg-white/10 px-3 py-1.5 text-sm font-black text-white ring-1 ring-white/15">
            ‹ Back
          </button>
          <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: a }}>Training</div>
        </div>

        {/* The skill, as a big lit card — the same card as on the Training page. */}
        <div className="kit-rise relative mt-3 overflow-hidden rounded-2xl p-4"
          style={{
            background: `radial-gradient(110% 120% at 0% 0%, ${rgba(a, 0.35)}, transparent 60%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.94), rgba(10,14,24,.97)))`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px ${rgba(a, 0.45)}, 0 0 26px -6px ${rgba(a, 0.55)}`,
          }}>
          <Shine loop every={6} />
          <div className="relative flex items-center gap-3">
            <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-[30px]"
              style={{ background: `linear-gradient(160deg, ${rgba(a, 0.55)}, ${rgba(a, 0.15)})`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.35), 0 0 16px ${rgba(a, 0.55)}` }}>
              <Glow color={a} alpha={0.4} pulse className="inset-0 blur-md" />
              <span className="relative">{look.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[22px] font-black leading-none">{look.title}</div>
              <div className="mt-1 text-[11.5px] font-bold text-white">{look.line}</div>
            </div>
            <div className="text-right">
              <div className="text-[34px] font-black leading-none" style={{ color: a, textShadow: `0 0 14px ${rgba(a, 0.6)}` }}>{value}</div>
              <div className="text-[10px] font-black uppercase tracking-wider text-white">rating</div>
            </div>
          </div>

          <div className="relative mt-3 flex items-center justify-between text-[13px] font-black">
            <span className="text-amber-300" style={{ textShadow: "0 0 10px rgba(251,191,36,.5)" }}>★ {stars} / {max}</span>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-black text-gray-950" style={{ background: a, boxShadow: `0 0 12px ${rgba(a, 0.6)}` }}>
              Level {open} is next
            </span>
          </div>
          <SquareBar value={Math.max(2, (stars / max) * 100)} colors={[a, "#fde68a"]} className="mt-2 h-3" animate />
          <div className="relative mt-2 text-[11.5px] font-bold text-white">
            3 tries a level: first ★★★, second ★★, third ★. Every 3 new stars is +2 {look.title}.
            {value < ceiling && ` You've lost ${ceiling - value} since your best — pass any level to win them back.`}
          </div>
        </div>

        {/* The ladder. Done levels glow gold by stars, the next one pulses in
            the skill colour, locked ones sit dark. */}
        <div className="mt-3 grid grid-cols-5 gap-2">
          {levels.map((s, i) => {
            const n = i + 1;
            const locked = n > open;
            const next = n === open && s === 0;
            const full = s === 3;
            return (
              <button
                key={n}
                disabled={locked}
                onClick={() => onPlay(n)}
                aria-label={locked ? `Level ${n}, locked` : `Level ${n}, ${s} stars`}
                className={`kib-press relative overflow-hidden rounded-xl px-1 py-2 text-center ${next ? "animate-pulse" : ""}`}
                style={locked
                  ? { background: "rgba(15,23,42,.7)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05)" }
                  : next
                    ? { background: `linear-gradient(180deg, ${rgba(a, 0.35)}, rgba(15,23,42,.95))`, boxShadow: `inset 0 0 0 2px ${a}, 0 0 16px ${rgba(a, 0.6)}` }
                    : full
                      ? { background: "linear-gradient(180deg, rgba(251,191,36,.35), rgba(15,23,42,.95))", boxShadow: "inset 0 0 0 1px rgba(251,191,36,.7), 0 0 12px rgba(251,191,36,.35)" }
                      : { background: `linear-gradient(180deg, ${rgba(a, 0.18)}, rgba(15,23,42,.95))`, boxShadow: `inset 0 0 0 1px ${rgba(a, 0.4)}` }}
              >
                <div className={`text-[15px] font-black ${locked ? "opacity-40" : "text-white"}`}>{locked ? "🔒" : n}</div>
                <div className="mt-0.5 text-[11px] tracking-tight">
                  {[0, 1, 2].map(k => (
                    <span key={k} style={k < s ? { color: "#fcd34d", textShadow: "0 0 6px rgba(251,191,36,.8)" } : { color: "rgba(255,255,255,.18)" }}>★</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
