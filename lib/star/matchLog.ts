/**
 * THE RUNNING COMMENTARY.
 *
 * A match used to be a series of jump cuts: a chance on the pitch, then a
 * full-screen panel announcing the minute it had skipped to with a handful of
 * lines about what you had missed, then a Continue button. Everything between
 * the moments you were involved in happened somewhere you could not see, and
 * was reported to you afterwards like a summary of a game somebody else played.
 *
 * So the commentary is the match now, and the pitch is what it cuts away to.
 * One list, accumulating for ninety minutes, streaming a line at a time — and
 * when the ball reaches you, the screen leaves the list and goes to the pitch,
 * then comes back to it. Nothing is skipped past; it is played out.
 *
 * This file is the model only: what a line is, and the two questions the
 * streaming screen has to ask of one. It renders nothing.
 */

/** How a line reads, which is the only thing the screen needs to style it. */
export type LogTone =
  /** Ordinary play. The bulk of a match. */
  | "play"
  /** Your side scored. */
  | "goal"
  /** They scored. */
  | "oppGoal"
  /** Who made it. Always follows a "goal" line, never stands alone. */
  | "assist"
  /**
   * A chance has opened up for a named player of yours to play out.
   *
   * The ONLY thing this tone means. It used to mean "everything narrated while
   * you had the ball" — every cross, every knock-down, every deflection in a
   * passage that ended in somebody else's shot — which was every line of a
   * five-line buildup highlighted as though each one mattered on its own.
   * Reported as exactly that: "a lot of text there… I don't think it needs to
   * be there." One line, once per chance: who the ball has reached.
   */
  | "you"
  /** Kick-off, half time, full time. A marker, not an event. */
  | "period"
  /** A chance that came to nothing, either way. */
  | "chance";

export interface LogLine {
  /** Stable across re-renders and unique within a match. */
  id: number;
  /**
   * The minute, when it is worth printing.
   *
   * Absent on continuation lines — "But the shot goes wide" belongs to the
   * minute above it and repeating the number down the left makes a passage of
   * play read as four separate incidents.
   */
  minute?: number;
  text: string;
  tone: LogTone;
}

/**
 * The two halves, so a line knows which one it is in.
 *
 * `hiddenMatch` has never had a concept of half time — it runs 1 to 90 without
 * a break — and it does not need one to simulate football. But a match with no
 * interval does not read like a match, so the boundary lives here, in the
 * presentation, which is the only place that cares.
 */
export const HALF_TIME_MINUTE = 45;

let nextId = 1;

/** A fresh line. Ids are a counter rather than an index so a line keeps its
 *  identity when the list in front of it changes. */
export function line(text: string, tone: LogTone = "play", minute?: number): LogLine {
  return { id: nextId++, text, tone, minute };
}

/**
 * Turn a run of simulated events into lines, with the minute printed only when
 * it changes.
 *
 * The minute-once rule is what makes a passage of play read as a passage: four
 * events in the sixty-eighth minute are one attack, and stamping 68 on each of
 * them turns it into four unrelated things that happened to share a number.
 */
export function linesFrom(
  events: {
    minute: number; text: string; isGoal?: boolean; isOpponent?: boolean;
    /** Overrides the isGoal/isOpponent-derived tone — the assist line that
     *  follows a goal is not itself a goal, and has no other way to say so. */
    tone?: LogTone;
  }[],
  startAfterMinute = -1,
): LogLine[] {
  const out: LogLine[] = [];
  let last = startAfterMinute;
  for (const e of events) {
    const tone: LogTone = e.tone ?? (e.isGoal ? (e.isOpponent ? "oppGoal" : "goal") : "play");
    // An assist follows its goal in the same minute, so the goal above it has
    // already printed the number — repeating it would say the same minute
    // twice for what reads as one moment.
    const showMinute = e.minute !== last && e.tone !== "assist";
    out.push(line(e.text, tone, showMinute ? e.minute : undefined));
    last = e.minute;
  }
  return out;
}

/**
 * Where half time falls in a run of lines, if it falls in one at all.
 *
 * Returns the index to insert the interval marker BEFORE — the first line of
 * the second half. -1 when the whole run is on one side of the break, which is
 * almost always.
 */
export function halfTimeSplit(lines: LogLine[], alreadyShown: boolean): number {
  if (alreadyShown) return -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].minute;
    if (m !== undefined && m > HALF_TIME_MINUTE) return i;
  }
  return -1;
}

/**
 * How long a line sits on screen before the next one arrives.
 *
 * A goal holds longer than a throw-in because it is worth holding on, and
 * because a scoreline changing under you at the same pace as "they push
 * forward" is how you miss it. Divided by the speed the player has chosen.
 */
export function dwellFor(tone: LogTone, speed: number): number {
  const base = tone === "goal" || tone === "oppGoal" ? 1500
    : tone === "assist" ? 1000
      : tone === "period" ? 1200
        : tone === "chance" ? 900
          : 620;
  return Math.max(60, Math.round(base / Math.max(1, speed)));
}
