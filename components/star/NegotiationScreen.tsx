"use client";
import { useMemo, useRef, useState } from "react";
import { niceMoneyStep } from "@/lib/star/money";
import {
  startNegotiation, makeOffer, moodToFace,
  type NegotiationMode, type NegotiationState, type CounterpartMood,
} from "@/lib/star/negotiation";
import { formatMoney } from "@/lib/star/money";

/**
 * THE NEGOTIATION — FACE TO FACE ACROSS TWO DESKS.
 *
 * Requested directly: buying/selling a player used to just hand over a
 * fixed fee. Now it's a real back-and-forth (lib/star/negotiation.ts) —
 * this is just its presentation, the same split every other engine module
 * here keeps (VoteCeremony.tsx is the closest sibling in spirit): the
 * counterpart's mood is shown as an actual changing face, not a number or a
 * word, per the direct request ("show that on their face") — happy, neutral,
 * or visibly angry, right up to the moment they might get up and leave.
 */

function money(n: number): string {
  return formatMoney(n);
}

const FACE: Record<CounterpartMood, string> = { happy: "😊", neutral: "😐", angry: "😠" };
const FACE_RING: Record<CounterpartMood, string> = {
  happy: "border-emerald-400 bg-emerald-900/30",
  neutral: "border-gray-500 bg-gray-800",
  angry: "border-red-500 bg-red-900/30",
};

export default function NegotiationScreen({
  mode, playerName, marketValue, counterpartLabel, initialState, onStepAway, onDone,
}: {
  mode: NegotiationMode;
  playerName: string;
  marketValue: number;
  /** A real destination club's name, when one's known (a boardroom sale
   *  through transferMarket.ts's interested-clubs list always has one) —
   *  shown in place of the generic "Interested Buyer"/"Their Agent" label.
   *  Requested directly, 14 Sep 2026: negotiating no longer means haggling
   *  with a nameless buyer. */
  counterpartLabel?: string;
  /** Resume a negotiation stepped away from earlier (see `onStepAway`)
   *  instead of opening a fresh one — the exact state as it was left,
   *  including the log and their current position. */
  initialState?: NegotiationState;
  /** Requested directly, 14 Sep 2026: "you should be able to go back" to
   *  check other interested clubs mid-negotiation without losing this one —
   *  only offered while a real deal is still live (`state.status ===
   *  "negotiating"`); an actual rejection or walkout is a real, final
   *  failure, not a pause, and has no step-away option. Absent means this
   *  screen has nowhere to save state to (e.g. signing, which has no
   *  "other candidates" list to step back to) — the button simply isn't
   *  shown. */
  onStepAway?: (state: NegotiationState) => void;
  /** `null` on the caller's side means "no deal" (rejected or walked away). */
  onDone: (finalPrice: number | null) => void;
}) {
  const [state, setState] = useState<NegotiationState>(() => initialState ?? startNegotiation(marketValue, mode, Math.random));
  const [amount, setAmount] = useState(() => state.yourPosition);
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Requested directly: the old +/- arrows moved by ★1 per click — with
  // amounts running into the millions, that's meaningless even held down
  // for a while. Steps now widen with the amount itself (niceMoneyStep,
  // same "clean numbers" idea as the Casino's own bet-amount stepper), and
  // holding the button repeats it — typing an exact number directly is
  // still completely free-form, this only governs the +/- buttons.
  const nudge = (dir: 1 | -1) => setAmount(a => Math.max(1, a + dir * niceMoneyStep(a)));
  const startHold = (dir: 1 | -1) => {
    nudge(dir);
    stopHold();
    holdRef.current = setInterval(() => nudge(dir), 120);
  };
  const stopHold = () => {
    if (holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; }
  };
  const mood = moodToFace(state);
  const verb = mode === "buying" ? "You're offering" : "You're asking";
  const theirVerb = mode === "buying" ? "Their asking price" : "Their offer";

  const finished = state.status !== "negotiating";

  const presets = useMemo(() => {
    const meetTheirs = state.theirPosition;
    const halfway = Math.round((state.yourPosition + state.theirPosition) / 2);
    const smallStep = mode === "buying"
      ? Math.round(state.yourPosition * 1.08)
      : Math.round(state.yourPosition * 0.92);
    return [
      { label: "Small move", value: smallStep },
      { label: "Meet halfway", value: halfway },
      { label: mode === "buying" ? "Meet their price" : "Accept their price", value: meetTheirs },
    ];
  }, [state, mode]);

  function propose(value: number) {
    if (finished) return;
    const next = makeOffer(state, Math.max(1, Math.round(value)), Math.random);
    setState(next);
    setAmount(next.status === "negotiating" ? next.yourPosition : next.yourPosition);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">
            {mode === "buying" ? "Negotiating a Signing" : "Negotiating a Sale"}
          </div>
          <div className="font-black text-white text-lg">{playerName}</div>
          <div className="text-[10px] font-bold text-white/80">Estimated value: ★{money(marketValue)}</div>
        </div>

        {/* ── Two desks, facing each other ── */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl border-2 border-gray-600 bg-gray-800 p-3 text-center">
            <div className="text-3xl mb-1">🧑</div>
            <div className="text-[9px] font-black uppercase tracking-widest text-white/85">You</div>
          </div>
          <div className={`rounded-xl border-2 p-3 text-center transition-colors ${FACE_RING[mood]}`}>
            <div className="text-3xl mb-1 transition-transform" style={{ transform: mood === "angry" ? "scale(1.1)" : "scale(1)" }}>
              {FACE[mood]}
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-white/85">
              {counterpartLabel ?? (mode === "buying" ? "Their Agent" : "Interested Buyer")}
            </div>
          </div>
        </div>

        {/* ── Positions on the table ── */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-2.5">
          <div className="flex justify-between text-[11px] font-bold text-white mb-1">
            <span>{verb}</span>
            <span className="tabular-nums text-yellow-300 font-black">★{money(state.yourPosition)}</span>
          </div>
          <div className="flex justify-between text-[11px] font-bold text-white">
            <span>{theirVerb}</span>
            <span className="tabular-nums text-yellow-300 font-black">★{money(state.theirPosition)}</span>
          </div>
          <div className="mt-1.5 text-[9px] font-semibold text-white/80">Round {state.round + (finished ? 0 : 1)}</div>
        </div>

        {/* ── Log ── */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-2.5 mb-3 max-h-32 overflow-y-auto space-y-1">
          {state.log.map((line, i) => (
            <div key={i} className="text-[10px] font-semibold text-white/90">{line}</div>
          ))}
        </div>

        {!finished && (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-yellow-300 font-black text-sm">★</span>
              <input
                type="text" inputMode="numeric"
                value={amount}
                onChange={e => setAmount(Math.max(1, Math.round(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)))}
                className="flex-1 min-w-0 rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-white tabular-nums"
              />
              <button
                onMouseDown={() => startHold(-1)} onMouseUp={stopHold} onMouseLeave={stopHold}
                onTouchStart={() => startHold(-1)} onTouchEnd={stopHold}
                className="shrink-0 w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 font-black text-white text-lg select-none"
              >
                −
              </button>
              <button
                onMouseDown={() => startHold(1)} onMouseUp={stopHold} onMouseLeave={stopHold}
                onTouchStart={() => startHold(1)} onTouchEnd={stopHold}
                className="shrink-0 w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 font-black text-white text-lg select-none"
              >
                +
              </button>
            </div>
            <div className="text-[9px] font-semibold text-white/70 text-right -mt-1 mb-2">± ★{niceMoneyStep(amount).toLocaleString()} per press</div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {presets.map(p => (
                <button
                  key={p.label}
                  onClick={() => propose(p.value)}
                  className="py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-[9px] font-black text-white"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => propose(amount)}
              className="w-full py-3 rounded-lg font-black text-sm bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition"
            >
              {mode === "buying" ? "Make Offer" : "Set Asking Price"}
            </button>
            {onStepAway && (
              <button
                onClick={() => onStepAway(state)}
                className="w-full mt-2 py-2 rounded-lg font-bold text-xs text-white/80 hover:text-white bg-gray-800 hover:bg-gray-700"
              >
                Step Away (check other interested clubs)
              </button>
            )}
            {/* Requested directly: there was no way to actually leave a
                negotiation without waiting it out to a rejection — a real
                Walk Away, ending it right now with no deal, exactly the
                same real outcome (and, where wired up, the same real
                cooldown before trying THIS pairing again) as talks
                genuinely falling through on their own. */}
            <button
              onClick={() => onDone(null)}
              className="w-full mt-2 py-2 rounded-lg font-bold text-xs text-red-300 hover:text-red-200 bg-red-950/40 hover:bg-red-900/40"
            >
              Walk Away
            </button>
          </>
        )}

        {finished && (
          <>
            <div className={`rounded-lg p-3 text-center mb-3 font-black ${
              state.status === "accepted" ? "bg-emerald-700/40 text-emerald-300" : "bg-red-900/40 text-red-300"
            }`}>
              {state.status === "accepted" && `Deal agreed — ★${money(state.finalPrice ?? 0)}`}
              {state.status === "rejected" && "No deal — talks broke down"}
              {state.status === "walked_away" && (mode === "buying" ? "They walked away, angry" : "The buyer walked away, angry")}
            </div>
            <button
              onClick={() => onDone(state.status === "accepted" ? (state.finalPrice ?? null) : null)}
              className="w-full py-3 rounded-lg font-black text-sm bg-gray-700 hover:bg-gray-600 active:scale-[0.98] transition"
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
