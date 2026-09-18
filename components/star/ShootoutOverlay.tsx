"use client";
import { useEffect, useRef, useState } from "react";
import {
  createShootout, takeNextKick, nextShootoutSide, nextTakerIndex,
  penaltyConversionChance, type PenaltyShootoutState, type ShootoutSide,
} from "@/lib/star/shootout";

/**
 * THE PENALTY SHOOTOUT — LIVE.
 *
 * Every kick, both teams', is watched one at a time — a running tick/cross
 * record and the score are always on screen. Every kick that isn't yours
 * (teammate or opponent) resolves on a real skill-weighted chance (see
 * `penaltyConversionChance`) after a short beat, so it still reads as
 * watched live rather than instantly decided — there is no real per-player
 * roster of shooting stats for all twenty-two takers to draw on instead.
 *
 * The player's OWN kick is a real, live penalty: reported directly that a
 * corner-pick-then-strike button was "a dice roll dressed up as a choice"
 * and unacceptable — it must go through the exact same real drag-to-aim,
 * contact, and flight canvas mechanic an ordinary in-game penalty already
 * uses, with a real physically-determined outcome and no time limit. So
 * this component does not resolve the player's own kick at all: the instant
 * it's genuinely their turn, `onYourKick` hands the parent (CanvasMatch) a
 * `submit` function and this overlay goes `hidden` — the parent loads a
 * real live penalty scenario on its own canvas underneath, and once that
 * scenario resolves for real, it calls `submit(scored)`, which feeds the
 * genuine outcome straight into `takeNextKick` exactly like any other kick.
 */

export interface ShootoutOverlayProps {
  homeClub: string;
  awayClub: string;
  /** Which side "you" are on for this fixture. */
  yourSide: ShootoutSide;
  /** Your own real conversion skill (shooting, falling back to overall) — kept for API stability, no longer read here (see the doc comment above); the parent's own live penalty is what actually decides your kick now. */
  yourSkill: number;
  /** A flat stand-in for whichever teammate is up when it isn't you. */
  teamSkill: number;
  /** A flat stand-in for the opponent's takers. */
  oppSkill: number;
  /**
   * True while a live penalty scenario elsewhere (the parent's own canvas)
   * is standing in for this overlay's UI for exactly one kick — the overlay
   * stays mounted (so its running score/tally state survives) but renders
   * nothing, so the real gameplay underneath is what's actually seen.
   */
  hidden?: boolean;
  /**
   * Called exactly once each time it's genuinely the player's own turn to
   * kick, handing back a `submit` function. The parent plays out a real
   * live penalty and calls `submit(scored)` with the genuine result once
   * it's known — this component then advances its own state machine with
   * that real outcome, exactly as it already does for every other kick.
   */
  onYourKick: (submit: (scored: boolean) => void) => void;
  onComplete: (result: { home: number; away: number }) => void;
}

export default function ShootoutOverlay({
  homeClub, awayClub, yourSide, teamSkill, oppSkill, hidden, onYourKick, onComplete,
}: ShootoutOverlayProps) {
  const [state, setState] = useState<PenaltyShootoutState>(createShootout);
  const [resolving, setResolving] = useState(false);
  const doneRef = useRef(false);
  const yourKickHandedOffRef = useRef(false);

  const side: ShootoutSide = nextShootoutSide(state);
  const takerIndex = nextTakerIndex(state, side, 11);
  const isYourKick = !state.over && side === yourSide && takerIndex === 0;
  const isYourTeammateKick = !state.over && side === yourSide && takerIndex !== 0;
  const isOpponentKick = !state.over && side !== yourSide;

  // Report the final result once, the instant the state machine says it's over.
  useEffect(() => {
    if (state.over && !doneRef.current) {
      doneRef.current = true;
      onComplete({ home: state.homeScore, away: state.awayScore });
    }
  }, [state, onComplete]);

  // The moment it's genuinely your turn, hand off to the parent's real live
  // penalty instead of showing any picker here. Guarded by a ref (not just
  // `isYourKick` in the dependency array) so a re-render that doesn't
  // change whose kick it is — recomputing `isYourKick` fresh from the same
  // `state` — can never hand off the same kick twice; it's reset the moment
  // `state` actually advances to a different kick.
  useEffect(() => {
    if (state.over || !isYourKick || yourKickHandedOffRef.current) return;
    yourKickHandedOffRef.current = true;
    onYourKick((scored: boolean) => {
      setState(s => takeNextKick(s, scored));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isYourKick]);

  useEffect(() => {
    if (!isYourKick) yourKickHandedOffRef.current = false;
  }, [isYourKick]);

  // Every kick that isn't yours resolves on its own after a short, watchable
  // beat — a teammate's or the opponent's turn, skill-weighted, never
  // instant.
  useEffect(() => {
    if (state.over || isYourKick || resolving) return;
    setResolving(true);
    const skill = side === yourSide ? teamSkill : oppSkill;
    const chance = penaltyConversionChance(skill);
    const timer = window.setTimeout(() => {
      setState(s => takeNextKick(s, Math.random() < chance));
      setResolving(false);
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isYourKick]);

  if (hidden) return null;

  const rowFor = (s: ShootoutSide) => state.kicks.filter(k => k.side === s);

  const roundNumber = Math.max(1, Math.ceil((state.kicks.length + 1) / 2));
  const inSuddenDeath = roundNumber > 5;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/85 px-4 text-center">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
        {inSuddenDeath ? "Sudden Death" : "Penalty Shootout"}
      </div>

      <div className="flex items-center gap-4 text-2xl font-black text-white">
        <span className="truncate max-w-[9rem]">{homeClub}</span>
        <span className="tabular-nums text-amber-300">{state.homeScore} - {state.awayScore}</span>
        <span className="truncate max-w-[9rem]">{awayClub}</span>
      </div>

      <div className="flex w-full max-w-sm justify-between gap-6">
        <KickRow label={homeClub} kicks={rowFor("home")} />
        <KickRow label={awayClub} kicks={rowFor("away")} />
      </div>

      {!state.over && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <div className="text-xs font-bold text-white/60">
            {isYourKick
              ? "Your penalty — over to the spot…"
              : isYourTeammateKick ? "Your team-mate steps up…"
              : isOpponentKick ? "Watching them step up…" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

function KickRow({ label, kicks }: { label: string; kicks: PenaltyShootoutState["kicks"] }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="mb-1 truncate text-[10px] font-bold text-white/70">{label}</div>
      <div className="flex flex-wrap justify-center gap-1">
        {kicks.map((k, i) => (
          <span
            key={i}
            className={`grid h-5 w-5 place-items-center rounded text-[11px] font-black ${
              k.scored ? "bg-emerald-500/80 text-white" : "bg-red-600/80 text-white"}`}
          >
            {k.scored ? "✓" : "✗"}
          </span>
        ))}
        {kicks.length === 0 && <span className="text-[10px] text-white/30">—</span>}
      </div>
    </div>
  );
}
