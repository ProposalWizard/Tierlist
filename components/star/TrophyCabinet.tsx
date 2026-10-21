"use client";
/**
 * THE TROPHY CABINET'S CONTENTS — the Ballon d'Or case, individual awards and
 * every trophy. Shown two ways (navigation round 1, 21 Oct 2026):
 *   - inside Stats, under its own "Trophies" chip (2 taps from Home, was 3);
 *   - as the Trophy Cabinet screen (SecondaryScreens.tsx TrophiesScreen).
 * Moved out of SecondaryScreens.tsx unchanged so both read the same code.
 */
import type React from "react";
import TrophyImage from "./TrophyImage";
import type { Trophy } from "@/lib/star/types";
import { Burst, CountUp, Shine, KitStyles } from "./ui";
import { Rays, useLater, SCREEN_CSS } from "./ui/Screen";

/** How individual honours read in the cabinet, rarest first — Ballon d'Or
 *  itself sits in its own hero tile above this list, not counted twice
 *  here. Anything not in this order (a future award kind) still shows, just
 *  after the named ones, so nothing silently disappears from the count. */
const AWARD_ORDER = ["Player of the Season", "Golden Boot", "Player of the Month"];
const AWARD_ICON: Record<string, string> = {
  "Player of the Season": "⭐", "Golden Boot": "👟", "Player of the Month": "🗓️",
};

export default function TrophyCabinet({ trophies, ballonDors, awards }: {
  trophies: Trophy[]; ballonDors: number;
  /** Every individual honour ever won — see CareerState.awards. Simply
   *  counted per kind ("Player of the Month ×11"), not listed one by one:
   *  requested directly, since a career can rack up a lot of these and the
   *  trophy cabinet is about the honours roll, not a monthly diary. */
  awards?: { kind: string }[];
}) {
  const counts = new Map<string, number>();
  for (const a of awards ?? []) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
  const kinds = Array.from(counts.keys()).sort((a, b) => {
    const ia = AWARD_ORDER.indexOf(a), ib = AWARD_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const shown = useLater(500);

  return (
    <div data-trophy-cabinet style={{ ["--kit-glow" as string]: "#d4a017" } as React.CSSProperties}>
      <KitStyles />
      <style>{SCREEN_CSS}</style>
      {/* The Ballon d'Or: rising into turning light, a shine across the
          case, and the count ticking up to the real number. */}
      <div className="kit-card relative mb-3 overflow-hidden p-4 text-center" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,.55), 0 0 30px rgba(251,191,36,.2)" }}>
        <Rays color="#fde68a" size={300} className="top-[40%]" />
        <Shine trigger={1} />
        <div className="kit-trophy-in relative mb-1 flex justify-center"><TrophyImage name="Ballon d'Or" height={96} /></div>
        <div className="relative text-3xl font-black tabular-nums text-yellow-300" style={{ textShadow: "0 0 14px rgba(251,191,36,.55)" }}><CountUp value={shown ? ballonDors : 0} ms={700} /></div>
        <div className="relative text-[10px] font-black uppercase tracking-widest text-yellow-200">Ballon d&apos;Or</div>
        {ballonDors > 0 && <Burst colors={["#fde047", "#fbbf24", "#ffffff"]} count={18} className="left-1/2 top-[38%]" />}
      </div>

      {kinds.length > 0 && (
        <div className="kit-card overflow-hidden mb-3">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/70 border-b border-white/[0.06]">
            Individual Awards
          </div>
          {kinds.map((kind, i) => (
            <div key={kind} className="kit-rise flex items-center gap-2.5 px-3 py-2 border-b border-white/[0.05]" style={{ animationDelay: `${200 + i * 70}ms` }}>
              <span className="kit-trophy-in flex w-8 justify-center" style={{ animationDelay: `${260 + i * 70}ms` }}><TrophyImage name={kind} height={34} fallback={AWARD_ICON[kind] ?? "🏅"} /></span>
              <span className="flex-1 font-bold text-white text-sm">{kind}</span>
              <span className="font-black text-amber-300 text-sm">×{counts.get(kind)}</span>
            </div>
          ))}
        </div>
      )}

      {trophies.length === 0 ? (
        <div className="kit-card p-6 text-center text-white text-sm">
          No trophies yet — win the league or a cup!
        </div>
      ) : (
        <div className="kit-card overflow-hidden">
          {trophies.map((t, i) => (
            <div key={i} className="kit-rise relative flex items-center gap-3 overflow-hidden p-3 border-b border-white/[0.06]" style={{ animationDelay: `${350 + Math.min(i, 10) * 80}ms` }}>
              <div className="kit-trophy-in flex w-10 justify-center" style={{ animationDelay: `${420 + Math.min(i, 10) * 80}ms`, filter: "drop-shadow(0 0 8px rgba(251,191,36,.35))" }}><TrophyImage name={t.competition} height={48} fallback="🥇" /></div>
              <div className="flex-1">
                <div className="font-black text-white text-sm">{t.competition}</div>
                <div className="text-[10px] text-white/80">{t.club} · Season {t.season}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
