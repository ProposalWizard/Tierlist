"use client";
import { useEffect, useRef, useState } from "react";
import { labelInk, kitsFor, type Kit } from "@/lib/star/kits";
import { initials } from "./ClubCrest";

/**
 * Deliberately just strings, not CupRound/CupTie from lib/star/cups.ts —
 * this reveal now also plays a Champions/Europa League tie draw, which comes
 * from a different state shape (EuroTie, one tie rather than a round of
 * many). Both call sites hand it the same two fields either way.
 */
export interface DrawTie {
  home: string;
  away: string;
}
export interface DrawRound {
  name: string;
  ties: DrawTie[];
}

interface Props {
  /** Shown in the header, e.g. "FA Cup" or "Champions League". */
  competition: string;
  round: DrawRound;
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
 *
 * ── The broadcast-graphics redesign ──
 *
 * Requested directly, with two reference mockups: a proper "cup competition"
 * look — a dark stadium-light card, a trophy-and-ticket hero before the draw
 * starts, lightning-bolt accents on the call to action, and a team-badge on
 * each side of every tie once it's drawn, with the tie that has YOUR club in
 * it glowing gold.
 *
 * One deliberate departure from the reference, for a reason already settled
 * elsewhere in this codebase: no real club crest images. ClubCrest.tsx's own
 * header is explicit about why: "There are no crest files, and a wrong crest
 * is worse than none." `TeamBadge` below is the same device that component
 * already uses everywhere a club needs to read as more than a name — the
 * club's own kit colour with its initials on it — just laid out for a
 * horizontal row instead of ClubCrest's badge-over-name stack (which would
 * have doubled the club name up: once tiny under the badge, once again next
 * to it). Unchanged by everything below — better tools don't make a wrong
 * crest less wrong.
 *
 * ── Real photography, via the Adobe connector ──
 *
 * The first pass of this redesign built the trophy and the confetti scatter
 * out of an emoji and CSS-drawn flecks — deliberately, matching how every
 * other big moment in this game (the Ballon d'Or ceremony, the pro-contract
 * banner) builds its hero art, since this codebase had no way to produce
 * real imagery. With the Adobe Creative Cloud connector now available for
 * this session, that's no longer true here: `public/star/cup-draw/` holds
 * three licensed Adobe Stock photos — trophy, gold confetti, stadium
 * floodlights — found and processed through the connector (the trophy
 * tightly cropped to its subject via Photoshop API's subject-aware crop).
 * All three were deliberately picked for a TRUE BLACK background rather
 * than cut out to alpha transparency, so they composite here with plain CSS
 * `mix-blend-mode: screen` (screen(black, x) = x — the black contributes
 * nothing, only the bright subject shows through) instead of needing a real
 * masking pipeline. `ConfettiOverlay`/`StadiumGlow` below are that trick.
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
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-black text-white flex items-center justify-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
          style={{ background: "linear-gradient(180deg, #131b2e 0%, #0a0f1c 55%, #070a12 100%)" }}
        >
          <StadiumGlow />
          {started && <ConfettiOverlay opacity={0.5} />}

          {/* ── Header ── */}
          <div className="relative z-10 text-center pt-5 pb-3 px-4">
            <div className="text-[10px] uppercase tracking-[0.35em] font-black text-sky-300/70">
              {competition} Draw
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-3">
              <span className="h-px flex-1 max-w-10 bg-gradient-to-r from-transparent to-white/25" />
              <h2 className="text-xl font-black tracking-tight text-white">{round.name}</h2>
              <span className="h-px flex-1 max-w-10 bg-gradient-to-l from-transparent to-white/25" />
            </div>
          </div>

          {/* ── Body ── */}
          <div className="relative z-10 px-3 pb-3 min-h-[280px]">
            {!started && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div
                  className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl w-full py-8"
                  style={{
                    background: "radial-gradient(65% 90% at 50% 15%, rgba(56,132,255,0.28), transparent 70%)",
                  }}
                >
                  <ConfettiOverlay opacity={0.65} />
                  <img
                    src={TROPHY_SRC}
                    alt=""
                    aria-hidden
                    className="relative h-32 w-auto"
                    style={{
                      mixBlendMode: "screen",
                      filter: "drop-shadow(0 0 26px rgba(251,191,36,0.5)) drop-shadow(0 12px 16px rgba(0,0,0,0.5))",
                    }}
                  />
                  <div className="relative -mt-1 text-3xl rotate-[-8deg]" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }}>
                    🎟️
                  </div>
                </div>

                <div className="text-sm font-bold text-white/80 text-center px-4">
                  <span className="text-rose-400">{total}</span> {total === 1 ? "tie" : "ties"} to be drawn for the{" "}
                  <span className="text-rose-400">{round.name}</span>.
                </div>

                <div className="relative flex items-center gap-2">
                  <Bolt />
                  <button
                    onClick={run}
                    className="px-7 py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-emerald-950 font-black text-sm uppercase tracking-wide transition shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                  >
                    Run the Draw
                  </button>
                  <Bolt flip />
                </div>
              </div>
            )}

            {started && (
              <div className="space-y-2 pt-2">
                {round.ties.slice(0, done ? total : revealed + 1).map((tie, i) => {
                  const isCurrent = !done && i === revealed;
                  const isYours = tie.home === yourClub || tie.away === yourClub;
                  const showAway = !isCurrent || homeShown;
                  const kits = kitsFor(tie.home, tie.away);
                  return (
                    <div
                      key={`${tie.home}-${tie.away}-${i}`}
                      className={`relative flex items-center gap-1.5 rounded-xl border px-2.5 py-2 transition-colors ${
                        isYours
                          ? "border-amber-400/70 bg-gradient-to-r from-amber-400/[0.12] via-amber-400/[0.06] to-amber-400/[0.12] shadow-[0_0_16px_rgba(251,191,36,0.28)]"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex flex-1 min-w-0 items-center gap-2">
                        <TeamBadge club={tie.home} kit={kits.home} />
                        <span
                          className={`truncate text-sm font-bold ${isYours ? "text-amber-300" : "text-white"} ${
                            isCurrent ? "animate-[draw-pop_0.35s_ease-out]" : ""
                          }`}
                        >
                          {tie.home}
                        </span>
                      </div>

                      <span className="text-white/30 text-[10px] font-bold px-1 shrink-0">v</span>

                      <div className="flex flex-1 min-w-0 items-center justify-end gap-2">
                        {showAway ? (
                          <>
                            <span
                              className={`truncate text-right text-sm font-bold ${isYours ? "text-amber-300" : "text-white"} ${
                                isCurrent ? "animate-[draw-pop_0.35s_ease-out]" : ""
                              }`}
                            >
                              {tie.away}
                            </span>
                            <TeamBadge club={tie.away} kit={kits.away} />
                          </>
                        ) : (
                          <span className="text-right text-white/25 text-xs shrink-0 pr-1">drawing…</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {!done && (
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
            )}
          </div>

          {/* ── Footer ── */}
          <div className="relative z-10 border-t border-white/10 p-3">
            <button
              onClick={onContinue}
              disabled={!done}
              className="w-full py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 disabled:from-white/10 disabled:to-white/10 disabled:text-white/30 text-emerald-950 font-black text-sm uppercase tracking-wide transition"
            >
              Continue
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes draw-pop {
          0% { opacity: 0; transform: scale(0.7) translateY(4px); }
          60% { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        .cup-confetti-pulse {
          animation: cup-confetti-shimmer 3.2s ease-in-out infinite;
        }
        @keyframes cup-confetti-shimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.35); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes draw-pop { from { opacity: 1; } to { opacity: 1; } }
          .cup-confetti-pulse { animation: none; }
        }
      `}</style>
    </div>
  );
}

/** A club, as a badge, laid out for a single horizontal row rather than
 *  ClubCrest.tsx's badge-over-name stack — see the file header on why this
 *  is a separate small component instead of reusing ClubCrest directly
 *  (it would have printed the club's name twice). Same device, same
 *  reasoning: the club's own kit colour with its initials on it, since
 *  there are no crest images and a wrong crest is worse than none. */
function TeamBadge({ club, kit }: { club: string; kit: Kit }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full border-2 font-black"
      style={{
        height: 26, width: 26, backgroundColor: kit.shirt, borderColor: kit.trim,
        color: labelInk(kit.shirt), fontSize: 9,
      }}
    >
      {initials(club)}
    </div>
  );
}

const TROPHY_SRC = "/star/cup-draw/trophy.webp";
const CONFETTI_SRC = "/star/cup-draw/confetti.webp";
const STADIUM_SRC = "/star/cup-draw/stadium-lights.webp";

/** Real gold confetti/glitter, shot on true black — see the file header on
 *  why `mix-blend-mode: screen` is enough to drop that black without any
 *  cutout. A gentle brightness pulse stands in for the old per-fleck drift
 *  animation (a static photo has no individual pieces to animate). */
function ConfettiOverlay({ opacity = 0.55 }: { opacity?: number }) {
  return (
    <img
      src={CONFETTI_SRC}
      alt=""
      aria-hidden
      className="cup-confetti-pulse pointer-events-none absolute inset-0 h-full w-full object-cover"
      style={{ mixBlendMode: "screen", opacity }}
    />
  );
}

/** A real stadium-floodlight photo, screen-blended in at low, constant
 *  opacity as ambience behind the whole card — the same true-black trick as
 *  ConfettiOverlay, just static and much fainter. Replaces the flat radial
 *  glow that used to be the only thing giving the card any depth. */
function StadiumGlow() {
  return (
    <img
      src={STADIUM_SRC}
      alt=""
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      style={{ mixBlendMode: "screen", opacity: 0.32, objectPosition: "85% 15%" }}
    />
  );
}

/** A small lightning-bolt accent flanking the "Run the Draw" button. */
function Bolt({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="14" height="22" viewBox="0 0 14 22" fill="none"
      className={flip ? "scale-x-[-1]" : ""}
      style={{ filter: "drop-shadow(0 0 6px rgba(52,211,153,0.65))" }}
    >
      <path d="M8 0L0 13H5.5L4 22L14 8H8.5L8 0Z" fill="#6EE7B7" />
    </svg>
  );
}
