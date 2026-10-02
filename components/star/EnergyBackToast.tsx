"use client";

import { useEffect } from "react";

/** How long the toast stays before the next thing on Home (a tour) gets its turn. */
export const ENERGY_BACK_TOAST_MS = 3200;

/**
 * "+N energy back from rest days", once on Home after a match (v0.24, P2-82).
 *
 * It used to wait for a Home with no tour at all, and after the first match
 * there never is one: the boss tour, then the shop tour, then the phone tour
 * all start on Home, so the toast never showed. Now it takes its turn after
 * the unlock pop-up and BEFORE the tours, closes itself, and the tour starts
 * when it has gone. A tap closes it early.
 */
export default function EnergyBackToast({ amount, onDone }: { amount: number; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, ENERGY_BACK_TOAST_MS);
    return () => window.clearTimeout(t);
    // Once per showing: the timer must not restart on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button
      onClick={onDone}
      className="kit-rise fixed left-1/2 top-[118px] z-[70] -translate-x-1/2 whitespace-nowrap rounded-[4px] px-3 py-1.5 text-[13px] font-black text-gray-950"
      style={{ background: "linear-gradient(180deg,#bef264,#22c55e)", boxShadow: "0 8px 20px -6px rgba(34,197,94,.7), inset 0 1px 0 rgba(255,255,255,.5)" }}
      aria-label={`${amount} energy back from rest days`}
    >
      ⚡ +{amount} energy back from rest days
    </button>
  );
}
