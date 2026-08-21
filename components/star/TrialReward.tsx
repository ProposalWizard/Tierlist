"use client";
import { useEffect, useRef, useState } from "react";
import NewspaperHeadline from "./NewspaperHeadline";

/**
 * WHAT THE TRIAL GETS YOU.
 *
 * Two beats after the penalty finally goes in, before the game proper starts.
 *
 *  1. The back page. A supplied newspaper splash (see NewspaperHeadline) with
 *     the player's own surname, club and "wins the FA Youth Cup!" set into its
 *     headline band — nothing to interact with, just a Continue. There is
 *     nothing to persist here: it is read once and gone, the same as the real
 *     thing.
 *  2. The offer, and the signing. The button does not say Continue — it says
 *     Sign it, because that is the action. Pressing it writes a signature
 *     across the page and only then moves on.
 */

export default function TrialReward({
  playerName,
  surname,
  club,
  onDone,
}: {
  playerName: string;
  /** Just the surname — the newspaper headline reads "SURNAME WINS...", not the full name. */
  surname: string;
  club: string;
  onDone: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [signing, setSigning] = useState(false);

  return step === 1 ? (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="flex-1 grid place-items-center p-4">
        <NewspaperHeadline surname={surname} club={club} />
      </div>
      <div className="p-4">
        <button
          onClick={() => setStep(2)}
          className="w-full rounded-xl bg-white/10 py-3.5 text-sm font-black uppercase tracking-widest text-white transition hover:bg-white/20 active:scale-[0.99]"
        >
          Continue
        </button>
      </div>
    </div>
  ) : (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 text-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-3 text-2xl font-black leading-tight">Congratulations</h1>
        <p className="mt-3 text-base font-bold text-emerald-200">
          You have been offered a pro contract.
        </p>
        <p className="mt-1 text-sm text-white/70">
          You are ready to join the first team.
        </p>

        <SignaturePad name={playerName} club={club} signing={signing} onFinished={onDone} />

        <button
          onClick={() => setSigning(true)}
          disabled={signing}
          className="mt-5 w-full rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 py-3.5 text-sm font-black uppercase tracking-widest text-amber-950 shadow-[0_6px_18px_-4px_rgba(251,191,36,0.6)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60"
        >
          {signing ? "Signing…" : "Sign it"}
        </button>
      </div>
    </div>
  );
}

/**
 * The contract, and a hand writing across it.
 *
 * The signature is a real stroke drawn over time rather than a fade-in of
 * finished text: `stroke-dashoffset` walking to zero along a hand-shaped path,
 * which is the one way to make a line look WRITTEN without shipping an
 * animation file. `prefers-reduced-motion` skips straight to the signed state
 * and still calls back, so the flow can never strand somebody who has motion
 * turned off.
 */
function SignaturePad({
  name, club, signing, onFinished,
}: {
  name: string; club: string; signing: boolean; onFinished: () => void;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, []);

  useEffect(() => {
    if (!signing || firedRef.current) return;
    firedRef.current = true;
    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const wait = reduced ? 250 : 1900;
    const t = window.setTimeout(onFinished, wait);
    return () => window.clearTimeout(t);
  }, [signing, onFinished]);

  return (
    <div className="mt-6 rounded-xl border border-white/15 bg-white/[0.06] p-4 text-left">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/45">
        Professional contract
      </div>
      <div className="mt-1 text-sm font-black text-white">{club}</div>

      {/* Three ruled lines, so it reads as a document rather than a box. */}
      <div className="mt-3 space-y-1.5" aria-hidden>
        <div className="h-1 w-full rounded bg-white/10" />
        <div className="h-1 w-11/12 rounded bg-white/10" />
        <div className="h-1 w-9/12 rounded bg-white/10" />
      </div>

      <div className="relative mt-4 h-14">
        <svg viewBox="0 0 300 60" className="absolute inset-0 h-full w-full" aria-hidden>
          <path
            ref={pathRef}
            d="M12 44 C 26 12, 38 12, 44 30 C 50 48, 58 48, 66 26 C 72 10, 84 14, 86 34 C 88 50, 100 48, 108 32 C 116 16, 130 18, 132 36 C 134 52, 148 50, 158 30 C 168 10, 184 14, 190 32 C 196 50, 212 48, 224 30 C 234 16, 250 16, 262 34 C 268 43, 278 46, 288 40"
            fill="none"
            stroke="#fef3c7"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: len || 1,
              strokeDashoffset: signing ? 0 : (len || 1),
              // Hidden until the path has been MEASURED, not merely until you
              // sign. Before `len` is known the dash pattern is 1 on / 1 off,
              // which on a 700-unit path draws a near-solid line — so the
              // signature appeared already written for the frame before the
              // effect ran, which is the one thing this animation exists to
              // avoid.
              opacity: len === 0 ? 0 : 1,
              transition: signing ? "stroke-dashoffset 1.6s cubic-bezier(.55,.1,.35,1)" : "none",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
            }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/25" />
      </div>
      <div className="mt-1 text-[10px] font-bold text-white/50">{name}</div>
    </div>
  );
}
