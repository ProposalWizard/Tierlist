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
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <NewspaperHeadline surname={surname} club={club} />
        <button
          onClick={() => setStep(2)}
          className="mt-4 w-full rounded-xl bg-white/10 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-white/20 active:scale-[0.99]"
        >
          Continue
        </button>
      </div>
    </div>
  ) : (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 text-white flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <CongratulationsBanner />

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

/** A crisp black outline, the same layered-shadow trick VersusScreen's
 *  player names and DeadlineDayRoundup's title already use. */
const GOLD_TITLE_OUTLINE =
  "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 8px rgba(0,0,0,0.6)";

/**
 * The top-of-page banner, matching the reference image directly: dark
 * ground, a bold gold "CONGRATULATIONS!", a green line underneath it, a
 * quieter white line under that, and a scatter of small gold flecks —
 * static decoration, not the full falling-confetti burst a bigger moment
 * (the Ballon d'Or) gets, since this is the top of a page you're about to
 * read on, not the whole screen for a few seconds.
 */
function CongratulationsBanner() {
  const flecks = [
    { left: "6%", top: "22%", size: 10, rotate: 18 },
    { left: "14%", top: "68%", size: 7, rotate: -25 },
    { left: "88%", top: "20%", size: 9, rotate: -12 },
    { left: "92%", top: "62%", size: 8, rotate: 30 },
    { left: "24%", top: "10%", size: 6, rotate: 50 },
    { left: "78%", top: "80%", size: 7, rotate: -40 },
  ];
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-400/25 px-4 py-6"
      style={{ background: "linear-gradient(180deg, #0a1410 0%, #050805 100%)" }}
    >
      {flecks.map((f, i) => (
        <div
          key={i}
          className="absolute rounded-[2px]"
          style={{
            left: f.left, top: f.top, width: f.size, height: f.size * 0.4,
            background: i % 2 === 0 ? "#fbbf24" : "#f59e0b",
            transform: `rotate(${f.rotate}deg)`,
            boxShadow: "0 0 4px rgba(251,191,36,0.5)",
          }}
        />
      ))}
      <h1
        className="text-3xl font-black uppercase tracking-tight text-amber-300"
        style={{ textShadow: GOLD_TITLE_OUTLINE }}
      >
        Congratulations!
      </h1>
      <p className="mt-2 text-sm font-black text-emerald-300">
        You have been offered a pro contract.
      </p>
      <p className="mt-1 text-xs font-bold text-white/70">
        You are ready to join the first team.
      </p>
    </div>
  );
}

/**
 * The contract, and a hand writing across it.
 *
 * A supplied document image (public/star/contract.png), the same pattern
 * NewspaperHeadline.tsx already established for the front page: real art
 * rather than anything drawn in CSS, with the two dynamic parts — the
 * club's name, and the signature — positioned over it as a percentage of
 * the image's own dimensions. Falls back to a plain drawn placeholder (the
 * box this replaced) if that file doesn't exist yet, via the <img>'s own
 * onError, so the trial never breaks while the real asset is still being
 * made — drop the file in later and it upgrades automatically, no code
 * change needed.
 *
 * CLUB_NAME_BOX/SIGNATURE_BOX below are read directly off the given
 * reference image — a two-column layout, "CLUB NAME" on the left above its
 * own ruled line, "PLAYER SIGNATURE" on the right above its own — as a
 * plain percentage of the image's width/height from each edge (top/left/
 * right/bottom). Estimated from the reference rather than measured pixel by
 * pixel, so worth a real visual check once the actual file is in place;
 * nudge these four numbers per box if either sits off the ruled line by eye.
 *
 * The signature is a real stroke drawn over time rather than a fade-in of
 * finished text: `stroke-dashoffset` walking to zero along a hand-shaped path,
 * which is the one way to make a line look WRITTEN without shipping an
 * animation file. `prefers-reduced-motion` skips straight to the signed state
 * and still calls back, so the flow can never strand somebody who has motion
 * turned off.
 */
const CONTRACT_SRC = "/star/contract.png";
const CLUB_NAME_BOX = { top: 71, left: 10, right: 55, bottom: 21 };
const SIGNATURE_BOX = { top: 71, left: 55, right: 10, bottom: 21 };

function SignaturePad({
  name, club, signing, onFinished,
}: {
  name: string; club: string; signing: boolean; onFinished: () => void;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  const firedRef = useRef(false);
  const [imgOk, setImgOk] = useState(true);

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

  const strokeStyle: React.CSSProperties = {
    strokeDasharray: len || 1,
    strokeDashoffset: signing ? 0 : (len || 1),
    // Hidden until the path has been MEASURED, not merely until you sign.
    // Before `len` is known the dash pattern is 1 on / 1 off, which on a
    // 700-unit path draws a near-solid line — so the signature appeared
    // already written for the frame before the effect ran, which is the
    // one thing this animation exists to avoid.
    opacity: len === 0 ? 0 : 1,
    transition: signing ? "stroke-dashoffset 1.6s cubic-bezier(.55,.1,.35,1)" : "none",
    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
  };
  const signaturePath = (
    <path
      ref={pathRef}
      d="M12 44 C 26 12, 38 12, 44 30 C 50 48, 58 48, 66 26 C 72 10, 84 14, 86 34 C 88 50, 100 48, 108 32 C 116 16, 130 18, 132 36 C 134 52, 148 50, 158 30 C 168 10, 184 14, 190 32 C 196 50, 212 48, 224 30 C 234 16, 250 16, 262 34 C 268 43, 278 46, 288 40"
      fill="none"
      stroke="#0f172a"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={strokeStyle}
    />
  );

  if (imgOk) {
    return (
      <div className="relative mx-auto mt-6 w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CONTRACT_SRC} alt="" className="block w-full" onError={() => setImgOk(false)} />
        <div
          className="absolute flex items-end justify-center overflow-hidden px-1 pb-[6%]"
          style={{
            top: `${CLUB_NAME_BOX.top}%`, bottom: `${CLUB_NAME_BOX.bottom}%`,
            left: `${CLUB_NAME_BOX.left}%`, right: `${CLUB_NAME_BOX.right}%`,
          }}
        >
          <span className="truncate font-serif text-[3.2vw] italic text-[#151008] sm:text-[13px]">
            {club}
          </span>
        </div>
        <div
          className="absolute"
          style={{
            top: `${SIGNATURE_BOX.top}%`, bottom: `${SIGNATURE_BOX.bottom}%`,
            left: `${SIGNATURE_BOX.left}%`, right: `${SIGNATURE_BOX.right}%`,
          }}
        >
          <svg viewBox="0 0 300 60" className="h-full w-full" aria-hidden>
            {signaturePath}
          </svg>
        </div>
      </div>
    );
  }

  // Placeholder, only ever seen until public/star/contract.png exists.
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
            fill="none"
            stroke="#fef3c7"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 44 C 26 12, 38 12, 44 30 C 50 48, 58 48, 66 26 C 72 10, 84 14, 86 34 C 88 50, 100 48, 108 32 C 116 16, 130 18, 132 36 C 134 52, 148 50, 158 30 C 168 10, 184 14, 190 32 C 196 50, 212 48, 224 30 C 234 16, 250 16, 262 34 C 268 43, 278 46, 288 40"
            style={strokeStyle}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 border-t border-white/25" />
      </div>
      <div className="mt-1 text-[10px] font-bold text-white/50">{name}</div>
    </div>
  );
}
