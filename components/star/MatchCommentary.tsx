"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import type { LogLine } from "@/lib/star/matchLog";
import { labelInk, type Kit } from "@/lib/star/kits";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import type { EnergyMode } from "@/lib/star/energy";
import { MIN_ENERGY_TO_START } from "@/lib/star/selection";
import KibCanIcon from "./KibCanIcon";
import { minuteLabel as labelFor } from "@/lib/star/addedTime";
import EnergyModeIcon from "./EnergyModeIcon";
import { useUiVersion } from "@/lib/star/uiLook";

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
  /** Added time (v0.15 item 30): the clock as it reads — "90+3" — and how to read a line's minute. */
  minuteLabel?: string;
  added?: number;
  regulation?: number;
  /** Item 35: opens every live score in the division. Absent: no button. */
  onOpenScores?: () => void;
  /** Which side is yours, so the kick-off card can colour each name. */
  userIsHome?: boolean;
}

export default function MatchCommentary({
  lines, minute, homeTeam, awayTeam, homeScore, awayScore, userKit, oppKit,
  speed, onSpeed, pause, onSkip, energy = 100, energyMode = "medium", onEnergyMode, kibCans = 0, onUseKib,
  minuteLabel, added = 0, regulation = 90, onOpenScores, userIsHome = true,
}: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // Settings → UI: Old keeps this panel as it was before v0.23 — no kick-off
  // pitch card, the old energy-ring colours (lib/star/uiLook.ts).
  const oldUi = useUiVersion() === "old";

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
        {/* Every line keeps a right-hand gutter the width of the minute plate
            and the Scores button, which float over the feed's top-right
            corner: at any scroll position one of them used to sit on a
            line's text ("breaks dow…" under 90+5', the Scores button over
            "the middle." — final playtest, 27 Sep 2026). The rows' colours
            still run the full width; only the words stop short of it. */}
        <div className="flex min-h-full flex-col justify-start [&>div]:pr-16">
          {lines.map(l => <Line key={l.id} l={l} userKit={userKit} oppKit={oppKit} added={added} regulation={regulation} />)}
          {/* Until the first real line lands the panel was only the "Kick Off"
              strip over a black screen for a couple of seconds (Harry's 1 Oct
              2026 recording, 14:59). This is the kick-off itself: who is
              playing, in whose colours, and that the first chance is coming. */}
          {lines.length <= 1 && !oldUi && (
            <KickOffCard
              homeTeam={homeTeam} awayTeam={awayTeam}
              homeKit={userIsHome ? userKit : oppKit} awayKit={userIsHome ? oppKit : userKit}
            />
          )}
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
        <span className={`font-black leading-none tabular-nums ${minuteLabel && minuteLabel.includes("+") ? "text-[12px] text-amber-300" : "text-sm text-white"}`}>{minuteLabel ?? minute}&#39;</span>
        <span className={`mt-0.5 text-[9px] font-black leading-none ${
          speed > 1 ? "text-amber-300" : "text-white/45"}`}
        >
          {"▶".repeat(speed === 4 ? 3 : speed)}
        </span>
      </button>

      {/* Every other score in the division, right now (item 35). */}
      {onOpenScores && (
        <button
          onClick={onOpenScores}
          aria-label="Live scores"
          className="absolute right-2 top-[3.1rem] z-20 flex w-12 items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-gray-900/85 py-1 text-[9px] font-black uppercase text-white shadow-md backdrop-blur-sm transition hover:bg-gray-800"
        >
          Scores <span aria-hidden className="text-[10px]">▸</span>
        </button>
      )}

      {/* ── Waiting on you ── */}
      {pause && (
        <div className="shrink-0 border-t border-amber-400/40 bg-amber-950/40 px-3 pt-2 pb-2.5">
          {pause.label && (
            <div className="text-center text-[11px] font-black uppercase tracking-widest text-amber-200">
              {pause.label}
            </div>
          )}
          <div className={`flex gap-2 ${pause.label ? "mt-2.5" : ""}`}>
            {/* Half time only: drink a Basic KIB can (+65) before the second
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
            // Icons, not words (owners, 23 Sep 2026). Green Low, amber
            // Medium, red High — red is the most intense (Harry, 1 Oct 2026,
            // P95); see EnergyModeIcon.
            const ring = oldUi
              ? (m === "low" ? "ring-red-500/70" : m === "high" ? "ring-green-500/70" : "ring-amber-400/70")
              : (m === "low" ? "ring-green-500/70" : m === "high" ? "ring-red-500/70" : "ring-amber-400/70");
            return (
              <button
                key={m}
                role="radio"
                aria-checked={on}
                aria-label={`${m} energy`}
                title={`${m[0].toUpperCase()}${m.slice(1)} energy`}
                onClick={() => onEnergyMode(m)}
                className={`grid place-items-center rounded-lg py-0.5 transition active:scale-[0.95] ${
                  on ? `bg-white/[0.08] ring-2 ${ring}` : "bg-gray-800 hover:bg-gray-700"}`}
              >
                <EnergyModeIcon mode={m} active={on} size={46} />
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
 * The opening beat: the two sides in their colours, before the first line —
 * on a pitch, not a black box (Harry, 1 Oct 2026, P94: "this is the pitch
 * screen — that should definitely be more pitch related"). Mown stripes, the
 * touchlines, the halfway line and centre circle; the two teams' names are
 * set on it like a broadcast graphic.
 */
function KickOffCard({ homeTeam, awayTeam, homeKit, awayKit }: { homeTeam: string; awayTeam: string; homeKit: Kit; awayKit: Kit }) {
  const chip = (name: string, kit: Kit) => (
    <div
      className="min-w-0 flex-1 truncate px-2 py-2 text-center text-[12px] font-black uppercase tracking-normal"
      style={{ backgroundColor: kit.shirt, color: labelInk(kit.shirt), borderRadius: 2, boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), 0 4px 12px -6px rgba(0,0,0,.8)" }}
    >
      {CLUB_SHORT_NAMES[name] ?? name}
    </div>
  );
  const line = "rgba(255,255,255,.78)";
  return (
    <div
      data-kickoff-pitch
      className="relative my-2 mr-3 flex min-h-[210px] flex-1 flex-col items-center justify-center overflow-hidden text-center"
      style={{
        marginLeft: 12,
        paddingRight: 0, // the feed gives its rows a right gutter for the minute plate; a pitch runs full width
        backgroundColor: "#1f7a3a",
        backgroundImage: "repeating-linear-gradient(90deg, #22853f 0 38px, #1c6f35 38px 76px), radial-gradient(120% 90% at 50% 50%, rgba(255,255,255,.1), rgba(0,0,0,.28))",
        backgroundBlendMode: "normal",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,.5), inset 0 0 40px rgba(0,0,0,.45)",
      }}
    >
      {/* The markings: halfway line, centre circle, both boxes. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" fill="none" stroke={line} strokeWidth="1.2">
        <line x1="100" y1="0" x2="100" y2="120" />
        <circle cx="100" cy="60" r="20" />
        <rect x="0" y="32" width="26" height="56" />
        <rect x="0" y="46" width="9" height="28" />
        <rect x="174" y="32" width="26" height="56" />
        <rect x="191" y="46" width="9" height="28" />
      </svg>
      <div className="relative flex w-full items-center gap-2 px-3">
        {chip(homeTeam, homeKit)}
        <span className="shrink-0 text-[15px] font-black italic text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>v</span>
        {chip(awayTeam, awayKit)}
      </div>
      <div className="relative mt-2 text-[11px] font-black uppercase tracking-[0.25em] text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>⚽ Kick off</div>
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
function Line({ l, userKit, oppKit, added = 0, regulation = 90 }: { l: LogLine; userKit: Kit; oppKit: Kit; added?: number; regulation?: number }) {
  const shownMinute = l.minute !== undefined ? labelFor(l.minute, added, regulation) : "";
  if (l.tone === "period") {
    return (
      <div className="kib-line flex items-center gap-2 border-y border-white/10 bg-gray-800/80 px-3 py-1.5">
        {l.minute !== undefined && (
          <span className="min-w-6 shrink-0 text-[10px] font-black tabular-nums text-white">{shownMinute}</span>
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

  // Another game's score (item 35): its own quiet broadcast-strip look.
  if (l.tone === "elsewhere") {
    return (
      <div className="kib-line flex items-baseline gap-2 bg-sky-950/90 px-3 py-1.5 text-sky-100">
        <span className="min-w-6 shrink-0 rounded bg-black/70 px-0.5 py-0.5 text-center text-[10px] font-black tabular-nums text-white">{shownMinute}</span>
        <span className="flex-1 text-[11px] font-bold leading-snug">{l.text}</span>
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
      <span className="min-w-6 shrink-0 rounded bg-black/70 px-0.5 py-0.5 text-center text-[10px] font-black tabular-nums text-white">
        {shownMinute}
      </span>
      <span className="flex-1 text-[12px] leading-snug">{l.text}</span>
    </div>
  );
}
