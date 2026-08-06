"use client";
import { useEffect, useRef, useState } from "react";
import type { Brief } from "@/lib/challengeDraft";

/**
 * The one-second roll that reveals a round's brief.
 *
 * Flicks through other briefs, decelerating, then lands on the real one. Purely
 * presentational — the brief was already decided server-side when the draft
 * started; this only stops it appearing out of nowhere.
 *
 * Skipped entirely under prefers-reduced-motion, and never blocks: the board
 * behind it is already loading while this plays.
 */

/** How long the landed brief stays on screen before the board appears. */
const REVEAL_HOLD_MS = 1000;

const KIND_ACCENT: Record<string, string> = {
  rating: "#06b6d4", stat: "#f59e0b", nation: "#22c55e", position: "#3b82f6",
  club: "#a855f7", era: "#ec4899", age: "#14b8a6", wildcard: "#ffffff",
};

export default function BriefReel({
  brief, decoys, onDone,
}: {
  brief: Brief;
  /** Other brief titles to flick past on the way. */
  decoys: string[];
  onDone: () => void;
}) {
  const [label, setLabel] = useState(decoys[0] ?? brief.title);
  const [landed, setLanded] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setLabel(brief.title);
      setLanded(true);
      // Hold the landed title for a full second. At 320ms the reveal was over
      // before you could read what the round actually was, which defeats the
      // point of running the reel at all.
      window.setTimeout(onDone, REVEAL_HOLD_MS);
    };

    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || decoys.length === 0) { finish(); return; }

    // Decelerating flicks: quick at first, slowing into the reveal. The gaps
    // sum to ~700ms, plus the 320ms hold — about a second in total.
    const gaps = [45, 45, 50, 55, 65, 75, 90, 110, 165];
    const timers: number[] = [];
    let elapsed = 0;
    gaps.forEach((gap, i) => {
      elapsed += gap;
      timers.push(window.setTimeout(() => {
        setLabel(decoys[i % decoys.length]);
      }, elapsed));
    });
    timers.push(window.setTimeout(finish, elapsed + 120));

    return () => { timers.forEach(clearTimeout); };
  }, [brief, decoys, onDone]);

  const accent = KIND_ACCENT[brief.kind] ?? "#06b6d4";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060d1a] px-6">
      <div className="text-center">
        <div className="text-[10px] font-bold tracking-[0.3em] text-white/60 uppercase mb-3">
          This round
        </div>
        <div
          className={`text-3xl sm:text-5xl font-black uppercase italic tracking-tight leading-none transition-transform duration-200 ${
            landed ? "scale-110" : "scale-100"
          }`}
          style={{ color: landed ? accent : "#ffffff" }}
        >
          {label}
        </div>
        {landed && (
          <p className="mt-3 text-sm text-white/80">{brief.detail}</p>
        )}
      </div>
    </div>
  );
}
