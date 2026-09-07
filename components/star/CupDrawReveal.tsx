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
 * Two deliberate departures from the reference, both for reasons already
 * settled elsewhere in this codebase:
 *  - No real club crest images. ClubCrest.tsx's own header is explicit about
 *    why: "There are no crest files, and a wrong crest is worse than none."
 *    `TeamBadge` below is the same device that component already uses
 *    everywhere a club needs to read as more than a name — the club's own
 *    kit colour with its initials on it — just laid out for a horizontal
 *    row instead of ClubCrest's badge-over-name stack (which would have
 *    doubled the club name up: once tiny under the badge, once again next
 *    to it).
 *  - No photographic trophy artwork. Every other big moment in this game
 *    (the Ballon d'Or ceremony, the pro-contract banner) builds its hero
 *    art the same way — CSS gradients, an emoji at a large size with a
 *    glow, and a scatter of small coloured flecks — rather than a bitmap
 *    asset, so this reuses that same technique instead of introducing the
 *    one screen in the game that looks like a rendered photo.
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
          <Flecks count={started ? 10 : 0} />

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
                  className="relative flex flex-col items-center justify-center rounded-xl w-full py-8"
                  style={{
                    background: "radial-gradient(65% 90% at 50% 15%, rgba(56,132,255,0.28), transparent 70%)",
                  }}
                >
                  <Flecks count={6} />
                  <div
                    className="relative text-6xl"
                    style={{ filter: "drop-shadow(0 0 26px rgba(251,191,36,0.5))" }}
                  >
                    🏆
                  </div>
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
        @keyframes cup-fleck-drift {
          0%, 100% { transform: translateY(0) rotate(var(--fleck-rot)); opacity: 0.55; }
          50% { transform: translateY(-6px) rotate(calc(var(--fleck-rot) + 12deg)); opacity: 0.9; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes draw-pop { from { opacity: 1; } to { opacity: 1; } }
          @keyframes cup-fleck-drift { from { opacity: 0.7; } to { opacity: 0.7; } }
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

const FLECK_COLORS = ["#F0C040", "#60A5FA", "#F472B6", "#4ADE80", "#FBBF24"];

/** A quiet scatter of coloured flecks — the same "static confetti" device
 *  TrialReward.tsx's CongratulationsBanner uses for a moment that is
 *  festive but not the full falling-confetti burst BallonDor.tsx fires for
 *  an actual trophy win. A draw is a nice moment, not THE moment. Purely
 *  decorative and positioned deterministically (no rng) so server and
 *  client render the same markup. */
function Flecks({ count }: { count: number }) {
  if (count <= 0) return null;
  const pieces = Array.from({ length: count }, (_, i) => {
    const left = `${(i * 37 + 8) % 94}%`;
    const top = `${(i * 53 + 12) % 88}%`;
    const rot = (i * 67) % 360;
    const size = 5 + (i % 3) * 2;
    return { left, top, rot, size, color: FLECK_COLORS[i % FLECK_COLORS.length], delay: `${(i * 0.23) % 2}s` };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute block rounded-[1px]"
          style={{
            left: p.left, top: p.top, width: p.size, height: p.size * 1.8,
            background: p.color,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ["--fleck-rot" as any]: `${p.rot}deg`,
            transform: `rotate(${p.rot}deg)`,
            animation: `cup-fleck-drift ${2.4 + (i % 4) * 0.4}s ease-in-out ${p.delay} infinite`,
          }}
        />
      ))}
    </div>
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
