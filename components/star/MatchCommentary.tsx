"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import type { LogLine } from "@/lib/star/matchLog";
import { labelInk, type Kit } from "@/lib/star/kits";

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
  pause?: { label?: string; cta: string; onContinue: () => void } | null;
  /** Reveal everything queued at once. Absent when there is nothing waiting. */
  onSkip?: () => void;
}

export default function MatchCommentary({
  lines, minute, homeTeam, awayTeam, homeScore, awayScore, userKit, oppKit,
  stats, speed, onSpeed, pause, onSkip,
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
          20% { background-color: rgba(5,150,105,0.95); }
          100% { background-color: rgba(5,150,105,0.7); }
        }
        .kib-goal-flash { animation: kibGoalFlash 1.7s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .kib-goal-flash { animation: none; }
        }
      `}</style>
      {/* ── The clock and the score ── */}
      <div className="shrink-0 border-b border-white/10 bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="flex items-stretch">
          <div className="flex min-w-0 flex-1 items-center bg-emerald-800/60 px-2 py-1.5">
            <span className="truncate text-[11px] font-black uppercase text-white">{homeTeam}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1 bg-gray-950 px-2.5">
            <span className="text-lg font-black tabular-nums text-white">{homeScore}</span>
            <span className="text-white/40">-</span>
            <span className="text-lg font-black tabular-nums text-white">{awayScore}</span>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end bg-gray-800/80 px-2 py-1.5">
            <span className="truncate text-[11px] font-black uppercase text-white">{awayTeam}</span>
          </div>
          {/* The minute, and the speed control on the same plate — the number
              and how fast it is moving are one idea. */}
          <button
            onClick={onSpeed}
            aria-label={`Commentary speed ${speed}x`}
            className="flex w-14 shrink-0 flex-col items-center justify-center border-l border-white/10 bg-gray-900 transition hover:bg-gray-800"
          >
            <span className="text-sm font-black leading-none tabular-nums text-white">{minute}&#39;</span>
            <span className={`mt-0.5 text-[9px] font-black leading-none ${
              speed > 1 ? "text-amber-300" : "text-white/45"}`}
            >
              {"▶".repeat(speed === 4 ? 3 : speed)}
            </span>
          </button>
        </div>
      </div>

      {/* ── The commentary ── */}
      <div
        ref={bodyRef}
        onClick={onSkip}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="flex min-h-full flex-col justify-end">
          {lines.map(l => <Line key={l.id} l={l} userKit={userKit} oppKit={oppKit} />)}
        </div>
      </div>

      {/* ── Waiting on you ── */}
      {pause && (
        <div className="shrink-0 border-t border-amber-400/40 bg-amber-950/40 px-3 py-2.5">
          {pause.label && (
            <div className="text-center text-[11px] font-black uppercase tracking-widest text-amber-200">
              {pause.label}
            </div>
          )}
          <button
            onClick={pause.onContinue}
            className="mt-2 w-full rounded-lg bg-amber-400 py-2.5 text-sm font-black uppercase tracking-widest text-gray-950 transition hover:bg-amber-300 active:scale-[0.99]"
          >
            {pause.cta}
          </button>
        </div>
      )}

      {/* ── You ── */}
      <div className="shrink-0 border-t border-white/10 bg-gray-900">
        <div className="grid grid-cols-4 divide-x divide-white/5">
          <Cell label="Shots" value={stats.shots} tone="text-white" />
          <Cell label="Goals" value={stats.goals} tone="text-amber-300" />
          <Cell label="Assists" value={stats.assists} tone="text-emerald-300" />
          <Cell label="Passes" value={stats.passesCompleted} tone="text-violet-300" />
        </div>
      </div>
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
      <div className="flex items-center gap-2 border-y border-white/10 bg-gray-800/80 px-3 py-1.5">
        {l.minute !== undefined && (
          <span className="w-6 shrink-0 text-[10px] font-black tabular-nums text-white">{l.minute}</span>
        )}
        <span className="flex-1 text-center text-[11px] font-black uppercase tracking-[0.18em] text-white">
          {l.text}
        </span>
      </div>
    );
  }

  // Goal lines get a real green highlight, not a low-opacity tint that read
  // as barely-there-over-black — reported directly: "instead of black, it's
  // greenish." `kib-goal-flash` runs a brief brighten-then-settle pass so a
  // goal reads as a moment, not just a differently-coloured row.
  const tone =
    l.tone === "goal" ? "kib-goal-flash bg-emerald-600/70 text-white font-black"
      : l.tone === "oppGoal" ? "bg-red-600/45 text-white font-black"
        // Follows straight under its goal — a lighter touch than the goal
        // itself, since it is the supporting fact rather than the headline,
        // and violet to match the Assists stat cell below.
        : l.tone === "assist" ? "pl-8 text-violet-200 font-bold"
          : l.tone === "you" ? "bg-amber-500/15 text-white font-bold"
            : l.tone === "chance" ? "text-white font-bold"
              // A plain line about a specific team's play (a near-miss, a
              // blocked shot) is coloured further down, straight from that
              // team's own shirt — a flat "text-white" here would fight the
              // inline style rather than just staying out of its way.
              : l.tone === "play" && l.isOpponent !== undefined ? "font-bold"
                : "text-white";

  // Reported directly: "lines about Liverpool should have a red background;
  // lines about Spurs should have a white background." The line's own kit,
  // near-solid so the colour actually reads, with ink picked the same way the
  // scoreboard picks ink for a name printed on a shirt — dark on a light kit,
  // white on a dark one — rather than one text colour fighting every club.
  const teamStyle: CSSProperties | undefined =
    l.tone === "play" && l.isOpponent !== undefined
      ? (() => {
          const kit = l.isOpponent ? oppKit : userKit;
          return { backgroundColor: `${kit.shirt}E6`, color: labelInk(kit.shirt) };
        })()
      : undefined;

  return (
    <div
      className={`kib-line flex items-baseline gap-2 border-b border-white/[0.04] px-3 py-1.5 ${tone}`}
      style={teamStyle}
    >
      <span
        className="w-6 shrink-0 text-[10px] font-black tabular-nums text-white/70"
        style={teamStyle ? { color: teamStyle.color, opacity: 0.75 } : undefined}
      >
        {l.minute !== undefined ? l.minute : ""}
      </span>
      <span className="flex-1 text-[12px] leading-snug">{l.text}</span>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="px-1 py-1 text-center">
      <div className="text-[8px] font-black uppercase tracking-wider text-white">{label}</div>
      <div className={`text-sm font-black tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
