"use client";
import type { HTMLAttributes, ReactNode } from "react";
import { useRealMatchWidth } from "@/components/star/EnginePlay";

/**
 * THE TRIAL'S ONE FRAME — every stage looks like the penalty shootout.
 *
 * Harry, 3 Oct 2026: "how the penalties are in the trial is how all of them
 * should be looks wise, remove the white bar". So no stage sits on the old
 * white card any more. Every stage is:
 *
 *   - the dark-green page (`TrialPage`)
 *   - its own scoreboard strip above the pitch (`TrialBoard`, with a ✓ / ✗
 *     `TrialSlot` per attempt)
 *   - the pitch, full width — the real match's width (`TrialPitchBox` for the
 *     two stages that draw their own picture; the striking stages and the
 *     shootout mount the match, which already sizes itself)
 *   - two lines under the pitch: what just happened, then what to do
 *     (`TrialCaption`)
 *
 * Looks only. Nothing here scores, times or moves anything.
 */

/** The page behind every trial stage. */
export const TRIAL_PAGE_BG = "radial-gradient(90% 50% at 50% 30%, #14532d, #052e16 70%, #02140a)";

/** The scoreboard strip's own background (the shootout's). */
const BOARD_STYLE = {
  background: "linear-gradient(180deg, rgba(8,14,28,.9), rgba(8,14,28,.78))",
  boxShadow: "0 6px 16px -6px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.12)",
} as const;

/** The full dark-green page a stage sits on. `top` is the dev bar, the stage
 *  pips and any trial-day banner. */
export function TrialPage({ top, children, ...rest }: { top?: ReactNode; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="min-h-[100dvh] w-full pb-3 text-white" style={{ background: TRIAL_PAGE_BG }} data-trial-page {...rest}>
      <div className="mx-auto w-full max-w-md">
        {top}
        {children}
      </div>
    </div>
  );
}

export type SlotState = "scored" | "close" | "missed" | "to-come";

/** One attempt on the board: ✓ green, ✗ red, a half-way one amber, or an
 *  empty ring still to come (★ in it when it is yours). */
export function TrialSlot({ state, you }: { state: SlotState; you?: boolean }) {
  const filled = {
    scored: "bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,.7)]",
    close: "bg-amber-400 text-gray-950 shadow-[0_0_8px_rgba(251,191,36,.6)]",
    missed: "bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,.6)]",
  } as const;
  return (
    <span
      data-kick={state === "close" ? "scored" : state}
      className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[12px] font-black leading-none ${
        state === "to-come" ? `border-2 ${you ? "border-sky-300" : "border-white/45"} bg-white/10` : filled[state]}`}
    >
      {state === "scored" ? "✓" : state === "missed" ? "✗" : state === "close" ? "~"
        : you ? <span className="text-[10px] text-sky-200">★</span> : ""}
    </span>
  );
}

/** A row of slots, one per attempt, the ones not yet taken empty. */
export function TrialSlots({ states, total, align = "left", youAt }: {
  states: SlotState[]; total: number; align?: "left" | "right"; youAt?: number;
}) {
  return (
    <div className={`mt-0.5 flex gap-1 ${align === "right" ? "justify-end" : ""}`}>
      {Array.from({ length: total }, (_, i) => (
        <TrialSlot key={i} state={states[i] ?? "to-come"} you={i === youAt} />
      ))}
    </div>
  );
}

/**
 * THE SCOREBOARD — sits right above the pitch, never on it (on the pitch it
 * hid the goal and the keeper). Left: the stage name and its attempts. Middle:
 * the score. Right: optional. Under: one short line (who is next, the setup).
 */
export function TrialBoard({
  title, titleClass = "text-sky-300", left, centreLabel, centreValue, right, footer, ...rest
}: {
  title: ReactNode;
  titleClass?: string;
  left?: ReactNode;
  centreLabel?: ReactNode;
  centreValue?: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="mx-3 mb-1.5 rounded-xl px-3 pb-1.5 pt-1" style={BOARD_STYLE} data-trial-board {...rest}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0">
          <div className={`truncate text-[11px] font-black uppercase tracking-wide ${titleClass}`}>{title}</div>
          {left}
        </div>
        <div className="text-center">
          {centreLabel != null && <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">{centreLabel}</div>}
          {centreValue != null && <div className="text-[24px] font-black tabular-nums leading-none text-white">{centreValue}</div>}
        </div>
        <div className="min-w-0 text-right">{right}</div>
      </div>
      <div className="mt-1 min-h-[14px] text-center text-[10.5px] font-black uppercase tracking-wide text-white/75">
        {footer}
      </div>
    </div>
  );
}

/** The two lines under the pitch: what just happened, then what to do. */
export function TrialCaption({ line, prompt }: { line?: ReactNode; prompt?: ReactNode }) {
  return (
    <>
      <p className="mt-1.5 min-h-[16px] px-3 text-center text-[12px] font-bold text-white/75">{line}</p>
      <p className="min-h-[16px] px-3 text-center text-[13px] font-black text-white">{prompt}</p>
    </>
  );
}

/**
 * The box a stage that draws its own picture (Take him on, Find the pass)
 * puts it in: the real match's width and its border, so it lines up exactly
 * with the stages that mount the match.
 */
export function TrialPitchBox({ children, className = "", style, boxRef }: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  boxRef?: React.Ref<HTMLDivElement>;
}) {
  const w = useRealMatchWidth();
  return (
    <div style={{ width: w, maxWidth: "100%", margin: "0 auto" }}>
      <div
        ref={boxRef}
        className={`relative w-full overflow-hidden rounded-xl border-2 border-emerald-800/80 shadow-2xl shadow-emerald-950/60 ${className}`}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}
