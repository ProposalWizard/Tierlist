"use client";
import { useEffect, useRef, useState } from "react";
import {
  createShootout, takeNextKick, nextShootoutSide, nextTakerIndex, INITIAL_KICKS_PER_SIDE,
  type PenaltyShootoutState, type ShootoutSide,
} from "@/lib/star/shootout";
import type { PenaltyTaker } from "@/lib/star/penaltyTaking";
import { shortClub } from "@/lib/star/media/grammar";

/**
 * THE SHOOTOUT, EVERY KICK LIVE (v0.15 plan, item 7).
 *
 * Harry: "you are to watch your team and the other team take the penalties as
 * if it were you taking it … your teammate will shoot, and the goalie will
 * attempt to save it. The same works for the other team."
 *
 * The old ShootoutOverlay rolled a dice for every kick but yours and showed a
 * tick or a cross. This drives the same state machine (lib/star/shootout.ts —
 * alternate kicks, the early finish, sudden death after five) but hands EVERY
 * kick to the match (`onKick`), which plays it on the real pitch: yours for
 * you to take, everybody else's struck automatically through the same strike
 * a player's kick goes through. It only keeps the score, says who is up next,
 * and draws the strip over the pitch.
 */

export interface LiveKick { side: ShootoutSide; taker: PenaltyTaker; round: number; index: number }

export interface LiveShootoutProps {
  homeClub: string;
  awayClub: string;
  /** Each side's takers, in the order they go (shootoutOrder). */
  home: PenaltyTaker[];
  away: PenaltyTaker[];
  homeColor?: string;
  awayColor?: string;
  /** Called once per kick. The match plays it and calls `submit(scored)` with the real outcome. */
  onKick: (kick: LiveKick, submit: (scored: boolean) => void) => void;
  onComplete: (result: { home: number; away: number }) => void;
  /** Where the strip sits over the pitch. */
  at?: "top" | "bottom";
}

export default function LiveShootout({
  homeClub, awayClub, home, away, homeColor, awayColor, onKick, onComplete, at = "bottom",
}: LiveShootoutProps) {
  const [state, setState] = useState<PenaltyShootoutState>(createShootout);
  const handedRef = useRef(-1);
  const doneRef = useRef(false);
  const [final, setFinal] = useState(false);

  const side = nextShootoutSide(state);
  const order = side === "home" ? home : away;
  const idx = nextTakerIndex(state, side, Math.max(1, order.length));
  const taker = order[idx];

  // Hand the next kick to the match — once per kick, never twice.
  useEffect(() => {
    if (state.over) return;
    const n = state.kicks.length;
    if (handedRef.current === n || !taker) return;
    handedRef.current = n;
    onKick({ side, taker, round: Math.floor(n / 2) + 1, index: n }, (scored) => {
      setState((s) => (s.kicks.length === n ? takeNextKick(s, scored, Math.max(1, order.length)) : s));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Over: hold the final strip a moment, then report.
  useEffect(() => {
    if (!state.over || doneRef.current) return;
    doneRef.current = true;
    setFinal(true);
    const t = window.setTimeout(() => onComplete({ home: state.homeScore, away: state.awayScore }), 2600);
    return () => window.clearTimeout(t);
  }, [state, onComplete]);

  return (
    <ShootoutStrip
      homeClub={homeClub} awayClub={awayClub} homeColor={homeColor} awayColor={awayColor}
      state={state} at={at}
      upNext={state.over ? null : taker ? { side, name: taker.you ? "You" : taker.shortName } : null}
      final={final}
    />
  );
}

/** The score, the kicks so far, and who is next — drawn over the pitch, never covering the ball. */
export function ShootoutStrip({
  homeClub, awayClub, homeColor, awayColor, state, upNext, final, at = "bottom", fixed = false,
}: {
  homeClub: string; awayClub: string; homeColor?: string; awayColor?: string;
  state: PenaltyShootoutState;
  upNext?: { side: ShootoutSide; name: string } | null;
  final?: boolean;
  at?: "top" | "bottom";
  /** In normal flow (above a picture) rather than laid over it. */
  fixed?: boolean;
}) {
  const round = Math.max(1, Math.ceil((state.kicks.length + 1) / 2));
  const sudden = round > INITIAL_KICKS_PER_SIDE && !state.over;
  const row = (s: ShootoutSide) => {
    const ks = state.kicks.filter((k) => k.side === s);
    const slots = Math.max(INITIAL_KICKS_PER_SIDE, ks.length);
    return Array.from({ length: slots }, (_, i) => ks[i]);
  };
  const winner = state.over ? (state.winner === "home" ? homeClub : awayClub) : null;
  const pos = fixed ? "relative" : `absolute inset-x-1.5 ${at === "top" ? "top-1.5" : "bottom-1.5"}`;
  return (
    <div className={`${pos} z-30 pointer-events-none rounded-xl border border-white/10 bg-gray-950/80 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-300">
          {state.over ? "Penalties — final" : sudden ? "Sudden death" : "Penalty shootout"}
        </span>
        {upNext && (
          <span className="truncate text-[10px] font-bold text-white/85">
            Next: <span className="font-black" style={{ color: (upNext.side === "home" ? homeColor : awayColor) ?? "#fff" }}>{upNext.name}</span>
          </span>
        )}
      </div>
      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Side name={homeClub} color={homeColor} kicks={row("home")} align="left" />
        <div className="text-lg font-black tabular-nums text-amber-200">{state.homeScore}–{state.awayScore}</div>
        <Side name={awayClub} color={awayColor} kicks={row("away")} align="right" />
      </div>
      {final && winner && (
        <div className="kib-pop mt-1 text-center text-[12px] font-black uppercase tracking-wide text-emerald-300">
          {shortClub(winner)} win {Math.max(state.homeScore, state.awayScore)}–{Math.min(state.homeScore, state.awayScore)} on penalties
        </div>
      )}
    </div>
  );
}

function Side({ name, color, kicks, align }: {
  name: string; color?: string; kicks: (PenaltyShootoutState["kicks"][number] | undefined)[]; align: "left" | "right";
}) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <div className="truncate text-[10px] font-black" style={{ color: color ?? "#fff" }}>{shortClub(name)}</div>
      <div className={`mt-0.5 flex gap-0.5 ${align === "right" ? "justify-end" : ""}`}>
        {kicks.map((k, i) => (
          <span
            key={i}
            className={`grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-black ${
              !k ? "border border-white/25" : k.scored ? "bg-emerald-500 text-white" : "bg-red-600 text-white"}`}
          >
            {k ? (k.scored ? "✓" : "✗") : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
