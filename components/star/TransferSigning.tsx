"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CongratulationsBanner, SignaturePad, type ContractTerms } from "./TrialReward";
import ClubBadge from "./ClubBadge";
import { Burst, PressButton, Shine, clubTheme } from "./ui";
import { Screen, Rays } from "./ui/Screen";
import { prefersReducedMotion } from "./ui/motion";

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
 *
 * Wave 2 reskin (28 Sep 2026): the new club's colours light the night
 * stadium behind it, and the moment the signature is done the new crest
 * rises into light with confetti in its colours ("signing gets a
 * celebration") before the game carries on, exactly as it always did. Tap
 * Continue to go straight on; a phone set to reduce motion goes straight on.
 */
export default function TransferSigning({
  playerName,
  club,
  onDone,
  terms,
}: {
  playerName: string;
  club: string;
  onDone: () => void;
  /** What the new contract says, written onto it. */
  terms?: ContractTerms;
}) {
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const theme = clubTheme(club);

  // The celebration holds for a beat, then the move goes through — once,
  // whether the timer or the Continue button gets there first.
  const doneRef = useRef(false);
  const celebrateRef = useRef<HTMLDivElement>(null);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);
  useEffect(() => {
    if (!signed) return;
    // Bring the moment into view: on a short phone the Sign button sits
    // below the contract, so the page is scrolled past the crest.
    celebrateRef.current?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    const t = setTimeout(finish, prefersReducedMotion() ? 0 : 2600);
    return () => clearTimeout(t);
  }, [signed, finish]);

  return (
    <Screen glow={theme.glow} center className="max-w-sm px-4 py-8">
      <div className="relative w-full text-center">
        <CongratulationsBanner
          title="Welcome!"
          subtitle={`You have agreed to join ${club}.`}
          detail="Sign here to complete the move."
        />

        <div className="relative">
          <SignaturePad name={playerName} club={club} signing={signing} onFinished={() => setSigned(true)} terms={terms} />

          {signed && (
            <div ref={celebrateRef} className="absolute inset-0 z-10 grid place-items-center rounded-2xl" style={{ background: "radial-gradient(closest-side, rgba(5,7,13,.72), rgba(5,7,13,.35))" }}>
              <Rays color={theme.glow} size={340} />
              <Burst colors={[theme.shirt, theme.trim, "#fde047", "#ffffff"]} count={34} spread={1.5} />
              <div className="relative flex flex-col items-center">
                <div className="kit-trophy-in" style={{ filter: `drop-shadow(0 0 22px ${theme.glow}) drop-shadow(0 6px 10px rgba(0,0,0,.6))` }}>
                  <ClubBadge club={club} size={96} />
                </div>
                <div className="kit-stamp mt-3 rounded-xl border-4 border-emerald-400 bg-emerald-950/85 px-5 py-1.5 text-[26px] font-black uppercase tracking-widest text-emerald-300" style={{ boxShadow: "0 0 40px rgba(52,211,153,.5)", animationDelay: "350ms" }}>
                  Signed
                </div>
                <div className="kit-rise mt-2 text-[13px] font-black uppercase tracking-[0.2em] text-white" style={{ animationDelay: "600ms", textShadow: "0 2px 6px rgba(0,0,0,.8)" }}>
                  {club}
                </div>
              </div>
            </div>
          )}
        </div>

        {signed ? (
          <PressButton variant="primary" size="lg" pulse onClick={finish} className="relative mt-5 w-full overflow-hidden tracking-widest">
            <Shine loop every={3} />
            Continue
          </PressButton>
        ) : (
          <PressButton
            variant="gold"
            size="lg"
            pulse={!signing}
            onClick={() => setSigning(true)}
            disabled={signing}
            className="relative mt-5 w-full overflow-hidden tracking-widest"
          >
            {!signing && <Shine loop every={3.5} />}
            {signing ? "Signing…" : "Sign it"}
          </PressButton>
        )}
      </div>
    </Screen>
  );
}
