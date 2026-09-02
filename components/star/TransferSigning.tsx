"use client";
import { useState } from "react";
import { CongratulationsBanner, SignaturePad } from "./TrialReward";

/**
 * SIGNING FOR A NEW CLUB.
 *
 * The same moment TrialReward's second step already builds for your very
 * first professional contract — the real contract art, the club's name
 * filled into it, a hand-drawn signature — now reused for every transfer
 * that follows it. Requested directly: "if you choose to sign for a new
 * club, it should do the exact same contract thing that it does when you
 * first sign for your first club."
 *
 * A deliberate reuse, not a rebuild: SignaturePad and CongratulationsBanner
 * both moved to exported, parameterised functions in TrialReward.tsx for
 * exactly this — the contract art, the writing animation, the reduced-motion
 * handling all stay in the one place that already got them right, and only
 * the banner's own words change here (a transfer is a move, not a debut —
 * "ready to join the first team" is specific to the trial and would be
 * wrong to repeat for a player already established elsewhere).
 */
export default function TransferSigning({
  playerName,
  club,
  onDone,
}: {
  playerName: string;
  club: string;
  onDone: () => void;
}) {
  const [signing, setSigning] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 text-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <CongratulationsBanner
          title="Welcome!"
          subtitle={`You have agreed to join ${club}.`}
          detail="Sign here to complete the move."
        />

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
