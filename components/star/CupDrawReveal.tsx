"use client";
import { useEffect, useRef, useState } from "react";
import type { CupId, CupRound } from "@/lib/star/cups";

interface Props {
  competition: CupId;
  round: CupRound;
  /** Whichever tie has this club in it gets picked out — it is the one you care about. */
  yourClub: string;
  onContinue: () => void;
}

const POP_MS = 550;      // one name popping in
const TIE_GAP_MS = 950;  // pause after a tie completes, before the next one starts

/**
 * The ceremony, not just the result.
 *
 * Both cups already redraw the whole round from a hat the instant your tie is
 * settled — the pairings exist in career.cupState the moment PostMatch shows.
 * What did not exist was ever SHOWING that draw happening: the round just
 * appeared, fully formed, wherever your next fixture turned up. Reported: "any
 * knockout round should have an actual draw... it'll be like Chelsea versus
 * Manchester United, and it will pop up with Chelsea and then Manchester
 * United, and then we'll go into the next fixture until it's done."
 *
 * So this is a REPLAY of a draw that already happened, not a second draw —
 * pressing the button does not re-roll anything, it starts revealing the
 * result one name at a time. A skip button jumps straight to the end for
 * anyone who has seen enough draws for one afternoon.
 */
export default function CupDrawReveal({ competition, round, yourClub, onContinue }: Props) {
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [homeShown, setHomeShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = round.ties.length;
  const done = revealed >= total;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (!started || done) return;
    // Home name is already visible the instant this tie becomes current (see
    // render below); this just times the away name's pop-in, then the pause
    // before moving on to the next tie.
    timer.current = setTimeout(() => setHomeShown(true), 60);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [started, revealed, done]);

  const advance = () => {
    if (!homeShown) return; // let the current tie's away name land first
    setHomeShown(false);
    setRevealed((n) => n + 1);
  };

  useEffect(() => {
    if (!started || done || !homeShown) return;
    timer.current = setTimeout(advance, POP_MS + TIE_GAP_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, homeShown, done]);

  const skip = () => {
    if (timer.current) clearTimeout(timer.current);
    setStarted(true);
    setHomeShown(false);
    setRevealed(total);
  };

  const run = () => {
    setStarted(true);
    setRevealed(0);
    setHomeShown(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 text-white flex items-center justify-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div className="bg-gray-700 rounded-t-xl border border-gray-600 py-2.5 px-3 text-center">
          <div className="text-[10px] uppercase tracking-widest font-black text-white/75">{competition} Draw</div>
          <div className="text-lg font-black text-white mt-0.5">{round.name}</div>
        </div>

        <div className="bg-gray-800 border-x border-gray-600 min-h-[280px] px-3 py-3 space-y-2">
          {!started && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="text-4xl">🎟️</div>
              <div className="text-sm text-white/70 text-center px-4">
                {total} ties to be drawn for the {round.name}.
              </div>
              <button
                onClick={run}
                className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-sm uppercase tracking-wide transition"
              >
                Run the Draw
              </button>
            </div>
          )}

          {started && round.ties.slice(0, done ? total : revealed + 1).map((tie, i) => {
            const isCurrent = !done && i === revealed;
            const isYours = tie.home === yourClub || tie.away === yourClub;
            const showAway = !isCurrent || homeShown;
            return (
              <div
                key={`${tie.home}-${tie.away}-${i}`}
                className={`rounded-lg border px-3 py-2 flex items-center justify-between text-sm font-bold transition-colors ${
                  isYours ? "bg-amber-400/15 border-amber-400/60" : "bg-gray-700/60 border-gray-600"
                }`}
              >
                <span className={`truncate ${isCurrent ? "animate-[draw-pop_0.35s_ease-out]" : ""}`}>
                  {tie.home}
                </span>
                <span className="text-white/40 text-xs px-2 shrink-0">v</span>
                {showAway ? (
                  <span
                    className={`truncate text-right ${isCurrent ? "animate-[draw-pop_0.35s_ease-out]" : ""}`}
                  >
                    {tie.away}
                  </span>
                ) : (
                  <span className="text-right text-white/25 text-xs shrink-0">drawing…</span>
                )}
                {isYours && <span className="ml-2 text-[9px] font-black text-amber-300 uppercase tracking-wide shrink-0">You</span>}
              </div>
            );
          })}

          {started && !done && (
            <div className="pt-2 text-center">
              <button
                onClick={skip}
                className="text-[11px] font-black uppercase tracking-widest text-white/50 hover:text-white/80 transition"
              >
                Skip ›
              </button>
            </div>
          )}
        </div>

        <div className="bg-gray-700 rounded-b-xl border border-t-0 border-gray-600 p-3">
          <button
            onClick={onContinue}
            disabled={!done}
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-600 disabled:text-white/40 text-gray-950 font-black text-sm uppercase tracking-wide transition"
          >
            Continue
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes draw-pop {
          0% { opacity: 0; transform: scale(0.7) translateY(4px); }
          60% { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes draw-pop { from { opacity: 1; } to { opacity: 1; } }
        }
      `}</style>
    </div>
  );
}
