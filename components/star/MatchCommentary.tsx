"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import type { LogLine } from "@/lib/star/matchLog";
import { labelInk, type Kit } from "@/lib/star/kits";
import type { EnergyMode } from "@/lib/star/energy";
import { MIN_ENERGY_TO_START } from "@/lib/star/selection";
import KibCanIcon from "./KibCanIcon";

/**
 * THE MATCH, AS IT IS BEING PLAYED.
 *
 * The screen a match lives on. It is not an overlay over the pitch and not a
 * summary of minutes already gone — it is the match, streaming a line at a
 * time, and the pitch is the thing it cuts away to when the ball reaches you.
 *
 * Three fixed parts: the scoreline and clock at the top, the commentary in the
 * middle, and what you have done and how much you have left at the bottom. The
 * middle is the only part that moves, and it stays pinned to its newest line so
 * the thing that just happened is always the thing you are looking at.
 */

interface Props {
  lines: LogLine[];
  minute: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  /** What your side and the opposition are wearing, for tinting a line about
   *  either of them by that team's own colour. */
  userKit: Kit;
  oppKit: Kit;
  stats: { shots: number; goals: number; assists: number; passesCompleted: number };
  /** How fast the commentary is running. 1, 2 or 4. */
  speed: number;
  onSpeed: () => void;
  /**
   * Set when the match has stopped and is waiting on you — the interval, full
   * time. Absent while it is streaming, which is most of the time and is the
   * whole point: you are watching a match, not clicking through one.
   */
  pause?: { label?: string; cta: string; halfTime?: boolean; onContinue: () => void } | null;
  /** Reveal everything queued at once. Absent when there is nothing waiting. */
  onSkip?: () => void;
  /** Live energy, 0-100, falling as the clock runs (see energy.ts). */
  energy?: number;
  energyMode?: EnergyMode;
  /** Absent (dev screens): no energy bar is shown. */
  onEnergyMode?: (mode: EnergyMode) => void;
  /** Basic KIB cans you still have — usable at half time only. */
  kibCans?: number;
  onUseKib?: () => void;
}

export default function MatchCommentary({
  lines, minute, homeTeam, awayTeam, homeScore, awayScore, userKit, oppKit,
  speed, onSpeed, pause, onSkip, energy = 100, energyMode = "medium", onEnergyMode, kibCans = 0, onUseKib,
}: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Pinned to the newest line. `scrollTop = scrollHeight` rather than
  // `scrollIntoView` on the last child: the latter scrolls the PAGE as well
  // when the feed is inside another scrollable, which on a phone throws the
  // whole match screen around every time a line lands.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length, pause]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-gray-950">
      {/* A goal line brightens for a moment when it lands, then settles to its
          steady green — plays once on mount, which is exactly when a goal
          line is new. */}
      <style>{`
        @keyframes kibGoalFlash {
          0% { background-color: rgba(255,255,255,0.6); }
          20% { background-color: var(--kib-flash-mid, rgba(5,150,105,0.95)); }
          100% { background-color: var(--kib-flash-end, rgba(5,150,105,0.7)); }
        }
        .kib-goal-flash { animation: kibGoalFlash 1.7s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .kib-goal-flash { animation: none; }
        }
        /* The screen above this one already has a scoreboard — a second one
           here just repeated it. The minute/speed control still needs
           somewhere to live, so it floats over the feed instead of owning a
           header row of its own; on a desktop-width viewport the feed's own
           scrollbar is hidden too, since it visibly shoved the whole panel
           over and nothing here needs it drawn — the div still scrolls. */
        .kib-feed::-webkit-scrollbar { display: none; }
        .kib-feed { scrollbar-width: none; -ms-overflow-style: none; }
        /* Each line its own panel, not just a colour change that runs
           several rows together into one slab — reported directly, with a
           real NSS screenshot for comparison: theirs beveled every row so a
           run of same-toned lines still read as separate incidents, ours
           only had a border so faint (4% white) it was invisible the moment
           two rows shared a colour. A soft gloss top-to-bottom plus a hard
           inset seam at the very bottom of each row does the same job here
           — layered as its own background-image/box-shadow rather than
           touching background-color, so it sits over a team-tinted row,
           a neutral one, and the goal-flash animation identically. */
        .kib-line {
          background-image: linear-gradient(to bottom, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.16) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.4);
        }
      `}</style>

      {/* ── The commentary ── */}
      <div
        ref={bodyRef}
        onClick={onSkip}
        className="kib-feed min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {/* Starts filling from the TOP — kick-off is the first thing you see,
            at the top of the panel, and the match builds down from there.
            Reported directly: `justify-end` pinned sparse content (kick-off
            alone, early on) to the BOTTOM of the panel instead, which read
            as the commentary "building up" from the bottom rather than
            playing out downward. The auto-scroll effect above (pinning
            `scrollTop` to the newest line once there's enough of it to
            overflow) is untouched and still does its job either way. */}
        <div className="flex min-h-full flex-col justify-start">
          {lines.map(l => <Line key={l.id} l={l} userKit={userKit} oppKit={oppKit} />)}
        </div>
      </div>

      {/* The minute, and the speed control on the same plate — the number and
          how fast it is moving are one idea. Floats over the feed rather than
          reserving its own row, so the panel underneath scrolls past it. */}
      <button
        onClick={onSpeed}
        aria-label={`Commentary speed ${speed}x`}
        className="absolute right-2 top-2 z-20 flex w-12 flex-col items-center justify-center rounded-lg border border-white/10 bg-gray-900/85 py-1 shadow-md backdrop-blur-sm transition hover:bg-gray-800"
      >
        <span className="text-sm font-black leading-none tabular-nums text-white">{minute}&#39;</span>
        <span className={`mt-0.5 text-[9px] font-black leading-none ${
          speed > 1 ? "text-amber-300" : "text-white/45"}`}
        >
          {"▶".repeat(speed === 4 ? 3 : speed)}
        </span>
      </button>

      {/* ── Waiting on you ── */}
      {pause && (
        <div className="shrink-0 border-t border-amber-400/40 bg-amber-950/40 px-3 pt-2 pb-2.5">
          {pause.label && (
            <div className="text-center text-[11px] font-black uppercase tracking-widest text-amber-200">
              {pause.label}
            </div>
          )}
          <div className={`flex gap-2 ${pause.label ? "mt-2.5" : ""}`}>
            {/* Half time only: drink a Basic KIB can (+25) before the second
                half. Takes the left third of the row, same height as the
                button beside it, so the two read as one bar. */}
            {pause.halfTime && onUseKib && (
              <button
                onClick={onUseKib}
                disabled={kibCans <= 0 || energy >= 100}
                aria-label={`Use a Basic KIB can, ${kibCans} left`}
                className="flex basis-1/3 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-1.5 py-1 text-gray-950 transition hover:bg-orange-400 active:scale-[0.98] disabled:bg-gray-700 disabled:text-white"
              >
                <KibCanIcon can={{ color: "bg-orange-400", image: "/star/kib-basic.png" }} className="h-8 w-5 shrink-0" />
                <span className="flex flex-col items-start leading-none">
                  <span className="text-[10px] font-black uppercase tracking-wide">Use KIB can</span>
                  <span className="mt-0.5 text-sm font-black tabular-nums">&times;{kibCans}</span>
                </span>
              </button>
            )}
            <button
              onClick={pause.onContinue}
              className="flex-1 rounded-lg bg-amber-400 py-2.5 text-sm font-black uppercase tracking-widest text-gray-950 transition hover:bg-amber-300 active:scale-[0.99]"
            >
              {pause.cta}
            </button>
          </div>
        </div>
      )}

      {/* ── Your energy ──
          Replaces the stats row that used to sit here (it only repeated the
          stats at the top of the match screen). Falls live as the clock
          runs, at the rate of the mode you pick — see lib/star/energy.ts. */}
      {onEnergyMode && (
      <div className="shrink-0 border-t border-white/10 bg-gray-900 px-3 pt-2 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Energy</span>
          <div
            className="relative h-3 flex-1 overflow-hidden rounded-full bg-gray-700"
            role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(energy)} aria-label="Energy"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                energy >= MIN_ENERGY_TO_START ? "bg-emerald-500" : energy >= 30 ? "bg-amber-400" : "bg-red-500"}`}
              style={{ width: `${Math.max(0, Math.min(100, energy))}%` }}
            />
          </div>
          <span className="w-8 text-right text-sm font-black tabular-nums text-white">{Math.round(energy)}</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Energy mode">
          {(["low", "medium", "high"] as EnergyMode[]).map(m => {
            const on = energyMode === m;
            const tint = m === "low" ? "bg-sky-500" : m === "high" ? "bg-rose-500" : "bg-emerald-500";
            return (
              <button
                key={m}
                role="radio"
                aria-checked={on}
                onClick={() => onEnergyMode(m)}
                className={`rounded-md py-1.5 text-[11px] font-black uppercase tracking-widest transition active:scale-[0.97] ${
                  on ? `${tint} text-gray-950` : "bg-gray-800 text-white hover:bg-gray-700"}`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * One line of commentary.
 *
 * The minute is printed down the left ONLY when it changes — see
 * `linesFrom`. Everything else is a continuation of the passage above it, and a
 * number on each row turns one attack into four unrelated incidents.
 */
function Line({ l, userKit, oppKit }: { l: LogLine; userKit: Kit; oppKit: Kit }) {
  if (l.tone === "period") {
    return (
      <div className="kib-line flex items-center gap-2 border-y border-white/10 bg-gray-800/80 px-3 py-1.5">
        {l.minute !== undefined && (
          <span className="w-6 shrink-0 text-[10px] font-black tabular-nums text-white">{l.minute}</span>
        )}
        <span className="flex-1 text-center text-[11px] font-black uppercase tracking-[0.18em] text-white">
          {l.text}
        </span>
        {/* Balances the minute badge on the left — otherwise "text-center"
            only centres in the space left over after it, and the line reads
            visibly off-centre. */}
        {l.minute !== undefined && <span className="w-6 shrink-0" aria-hidden />}
      </div>
    );
  }

  // Every tone that is about one specific side reads in that side's own kit
  // colour — reported directly, with a real example: Manchester City scoring
  // showed in a flat red instead of their own blue, and a line about your
  // own play sat in a fixed amber regardless of what you actually wear.
  // `goal` and `assist` used to be the deliberate exception — a fixed
  // celebratory green and a fixed violet, on the reasoning that a goal
  // "already reads as a highlight moment on its own." Reported directly as
  // wrong, with a concrete example: a goal and its assist stayed green/black
  // regardless of which club actually scored — "it all stays for the
  // team," i.e. it should be that team's own colour like every other tinted
  // line, not a fixed pair. `goal` means "your side" by definition (see
  // LogTone) — an opponent's goal is always tone "oppGoal" instead — so it
  // simply reads in `userKit`, no `isOpponent` check needed. `assist` is the
  // one tone either side can carry now that the opponent's own goals are
  // named too (CanvasMatch.tsx's opponent-goal branch), so it reads
  // `isOpponent` the same way a plain "play" line already does.
  const kit: Kit | null =
    l.tone === "goal" || l.tone === "you" ? userKit
      : l.tone === "assist" ? (l.isOpponent ? oppKit : userKit)
        : l.tone === "oppGoal" ? oppKit
          : l.tone === "play" && l.isOpponent !== undefined ? (l.isOpponent ? oppKit : userKit)
            : null;

  // Goal lines still get the brief brighten-then-settle flash
  // (`kib-goal-flash`) so a goal reads as a moment and not just a
  // differently-coloured row — it now settles into the scoring team's own
  // kit colour (via the `--kib-flash-*` custom properties below) instead of
  // a fixed green.
  const tone =
    l.tone === "goal" ? "kib-goal-flash font-black"
      : l.tone === "oppGoal" ? "font-black"
        // Follows straight under its goal, indented as the supporting fact
        // rather than the headline — same team colour as the goal above it
        // now, not its own fixed shade.
        : l.tone === "assist" ? "pl-8 font-bold"
          : l.tone === "you" ? "font-bold"
            : l.tone === "chance" ? "text-white font-bold"
              // A plain line about a specific team's play (a near-miss, a
              // blocked shot) is coloured further down, straight from that
              // team's own shirt — a flat "text-white" here would fight the
              // inline style rather than just staying out of its way.
              : kit ? "font-bold"
                : "text-white";

  // Near-solid so the colour actually reads, with ink picked the same way the
  // scoreboard picks ink for a name printed on a shirt — dark on a light kit,
  // white on a dark one — rather than one text colour fighting every club.
  const teamStyle: CSSProperties | undefined = kit
    ? {
      backgroundColor: `${kit.shirt}E6`,
      color: labelInk(kit.shirt),
      // Read only by the `goal` tone's flash animation — the CSS custom
      // property syntax isn't in React's CSSProperties typing, hence the cast.
      ...(l.tone === "goal"
        ? {
          "--kib-flash-mid": `color-mix(in srgb, ${kit.shirt} 75%, white)`,
          "--kib-flash-end": `${kit.shirt}E6`,
        }
        : {}),
    } as CSSProperties
    : undefined;

  return (
    <div
      className={`kib-line flex items-baseline gap-2 px-3 py-1.5 ${tone}`}
      style={teamStyle}
    >
      {/* The clock, not the commentary — reported directly: sitting in
          whichever team's colour the row happened to be made the timings
          hard to read at a glance. A fixed black chip keeps it legible and
          visibly separate from the line it's timing, on every row. */}
      <span className="w-6 shrink-0 rounded bg-black/70 py-0.5 text-center text-[10px] font-black tabular-nums text-white">
        {l.minute !== undefined ? l.minute : ""}
      </span>
      <span className="flex-1 text-[12px] leading-snug">{l.text}</span>
    </div>
  );
}
