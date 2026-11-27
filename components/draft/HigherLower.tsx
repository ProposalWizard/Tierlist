"use client";
/**
 * components/draft/HigherLower.tsx — "Convince to stay" as a higher-or-lower
 * card game (Leo, 27 Nov 2026: "maybe a higher or lower card minigame").
 * Your own squad's cards. Is the next one's overall higher or lower? Three
 * right in a row and he stays; one wrong and he goes. A tie counts as right.
 * Played well that's about the old 50/50, but now it's your call.
 */
import { useMemo, useState } from "react";
import type { DraftPlayer } from "@/app/draft/page";

export const ROUNDS = 3;

/** Four different cards from the squad, in a random order. Pure apart from the random source. */
export function dealCards(squad: readonly DraftPlayer[], rnd: () => number = Math.random): DraftPlayer[] {
  const pool = [...squad];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, ROUNDS + 1);
}

export function rightCall(prev: number, next: number, call: "higher" | "lower"): boolean {
  return next === prev || (call === "higher" ? next > prev : next < prev);
}

export default function HigherLower({ who, squad, onDone }: { who: string; squad: DraftPlayer[]; onDone: (stays: boolean) => void }) {
  const cards = useMemo(() => dealCards(squad), [squad]);
  const [round, setRound] = useState(0);
  const [shown, setShown] = useState<null | boolean>(null); // last call right?
  const cur = cards[round];
  const next = cards[round + 1];
  if (!cur || !next) { onDone(true); return null; }

  const call = (c: "higher" | "lower") => {
    if (shown !== null) return;
    const ok = rightCall(cur.overall, next.overall, c);
    setShown(ok);
    setTimeout(() => {
      if (!ok) return onDone(false);
      if (round + 1 >= ROUNDS) return onDone(true);
      setRound(round + 1);
      setShown(null);
    }, 1100);
  };

  const card = (p: DraftPlayer, hide: boolean) => (
    <div className="flex w-28 flex-col items-center rounded-xl border border-amber-500/40 bg-gray-900 p-3 text-center">
      <div className="text-3xl font-black text-white tabular-nums">{hide ? "?" : p.overall}</div>
      <div className="mt-1 line-clamp-2 text-xs font-bold text-white">{p.name}</div>
      <div className="text-[10px] text-gray-400">{p.assignedPosition}</div>
    </div>
  );

  return (
    <div data-higher-lower className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
      <p className="text-xs font-bold text-amber-300">Keep {who}: get {ROUNDS} right in a row · card {round + 1} of {ROUNDS}</p>
      <div className="mt-3 flex items-center justify-center gap-3">
        {card(cur, false)}
        <span className="text-lg font-black text-white">→</span>
        {card(next, shown === null)}
      </div>
      {shown === null ? (
        <div className="mt-3 flex justify-center gap-2">
          <button data-hl="higher" onClick={() => call("higher")} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white active:scale-95">▲ Higher</button>
          <button data-hl="lower" onClick={() => call("lower")} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white active:scale-95">▼ Lower</button>
        </div>
      ) : (
        <p className={`mt-3 text-center text-sm font-black ${shown ? "text-emerald-400" : "text-red-400"}`}>{shown ? "Right!" : "Wrong: he's going"}</p>
      )}
    </div>
  );
}
