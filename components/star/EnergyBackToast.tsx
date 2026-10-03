"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/** How long the toast stays before the next thing on Home (a tour) gets its turn. */
export const ENERGY_BACK_TOAST_MS = 3200;

/** The toast's height, for finding a gap it fits in. */
const TOAST_H = 32;

/**
 * Where the toast goes on Home (Harry, 2 Oct 2026, live phone screenshot: it
 * ran off the right edge and sat over the Next Match crests and the "VS").
 * In the empty sky between the league strip and the goal/player when there is
 * room for it; otherwise just under the top bars. Never over the crests.
 */
function spotOnHome(): number {
  const hud = document.querySelector("[data-hud-block]")?.getBoundingClientRect();
  const underBars = hud ? Math.round(hud.bottom + 2) : 104;
  const league = document.querySelector("[data-home-league]")?.getBoundingClientRect();
  const goal = document.querySelector("[data-home-goal]")?.getBoundingClientRect();
  const player = document.querySelector('[data-tour="player"]')?.getBoundingClientRect();
  if (!league) return underBars;
  const limit = Math.min(goal?.top ?? Infinity, player?.top ?? Infinity);
  const gap = limit - league.bottom;
  if (!Number.isFinite(gap) || gap < TOAST_H + 12) return underBars;
  return Math.round(league.bottom + (gap - TOAST_H) / 2);
}

/**
 * "+N energy (rest days)", once on Home after a match (v0.24, P2-82).
 *
 * It used to wait for a Home with no tour at all, and after the first match
 * there never is one: the boss tour, then the shop tour, then the phone tour
 * all start on Home, so the toast never showed. Now it takes its turn after
 * the unlock pop-up and BEFORE the tours, closes itself, and the tour starts
 * when it has gone. A tap closes it early.
 *
 * It sits inside the screen with 16px each side (a full-width row that
 * centres it), not with a translate: the rise animation's transform used to
 * replace the -50% shift, so the toast started at the middle and ran off the
 * right edge.
 */
export default function EnergyBackToast({ amount, onDone }: { amount: number; onDone: () => void }) {
  const [top, setTop] = useState<number | null>(null);
  useLayoutEffect(() => {
    setTop(spotOnHome());
  }, []);
  useEffect(() => {
    const t = window.setTimeout(onDone, ENERGY_BACK_TOAST_MS);
    return () => window.clearTimeout(t);
    // Once per showing: the timer must not restart on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div data-energy-toast className="pointer-events-none fixed inset-x-4 z-[70] flex justify-center" style={{ top: top ?? 104, visibility: top === null ? "hidden" : undefined }}>
      <button
        onClick={onDone}
        className="kit-rise pointer-events-auto max-w-full truncate whitespace-nowrap rounded-[4px] px-3 text-[13px] font-black leading-none text-gray-950"
        style={{ height: TOAST_H, background: "linear-gradient(180deg,#bef264,#22c55e)", boxShadow: "0 8px 20px -6px rgba(34,197,94,.7), inset 0 1px 0 rgba(255,255,255,.5)" }}
        aria-label={`${amount} energy back from rest days`}
      >
        ⚡ +{amount} energy (rest days)
      </button>
    </div>
  );
}
