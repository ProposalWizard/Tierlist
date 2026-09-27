/**
 * THE MATCH RADAR — watching the ninety minutes you never see.
 *
 * Asked for directly (Harry, 27 Sep 2026): "there is a full match being simmed
 * in the background. Is there a way we could do a test area that shows a full
 * 90 minutes of gameplay?"
 *
 * The unseen match (hiddenMatch.ts) has no twenty-two players to draw — it
 * knows, minute by minute, who has the ball, which fifth of the pitch it is in
 * and which channel, how the momentum is running, and when a chance comes and
 * how it ends. So this is a radar of exactly that, not a second football
 * simulation: every minute here is one call to the REAL `tick`, and every
 * chance that would have been yours is resolved through the REAL
 * `resolveScenario` — the same two functions a career match calls. Nothing in
 * this file decides anything about the football.
 *
 * The one thing the real match does that this cannot is PLAY your highlight —
 * that is the aim-and-strike game. Here a highlight either stops the clock and
 * lets you say how it went, or plays out at `benchConversion`: the rate the
 * game already uses for a chance that came to you while you were on the bench.
 */
import {
  newMatch, tick, resolveScenario, benchConversion, CHANCE_LINES,
  type HiddenMatchInputs, type HiddenMatchState, type HiddenMatchEvent,
  type ScenarioRequest, type Side, type Zone, type Lane,
} from "./hiddenMatch";
import { mulberry32 } from "./season";
import { energyPerMinute } from "./energy";
import { injuryRiskFor, rollInjury } from "./careerFlow";

export type RadarEventKind =
  | "goal-us" | "goal-them" | "chance-us" | "chance-them" | "quiet" | "highlight" | "highlight-goal" | "highlight-miss"
  | "injury";

export interface RadarEvent {
  minute: number;
  kind: RadarEventKind;
  text: string;
}

export interface RadarHighlight {
  minute: number;
  zone: Zone;
  lane: Lane;
  reason: string;
  /** What the match would have handed you to play — see kindsForZone. */
  kinds: string[];
  /** A run at the defence rather than a ball to strike. */
  dribble: boolean;
  /** Set once it has been played out. */
  result?: "goal" | "missed";
  /** How it was decided: chosen on screen, or at the bench rate. */
  decidedBy?: "you" | "bench-rate";
}

/** One minute of the match, as the radar draws it. */
export interface RadarFrame {
  minute: number;
  possession: Side;
  zone: Zone;
  lane: Lane;
  momentum: number;
  userScore: number;
  oppScore: number;
  events: RadarEvent[];
  highlight?: RadarHighlight;
}

export interface RadarMatch {
  seed: number;
  inputs: HiddenMatchInputs;
  fullTime: number;
  state: HiddenMatchState;
  rng: () => number;
  frames: RadarFrame[];
  /** A chance of yours waiting to be played out — the clock is stopped. */
  pending: RadarHighlight | null;
  /** Your energy at kick-off, 0-100 — what the full-time injury check reads. */
  startEnergy: number;
  /** The full-time injury check, once the clock has reached full time. */
  injuryCheck?: RadarInjuryCheck;
}

/**
 * INJURIES. The unseen match does not injure anyone minute by minute — a
 * career rolls your injury ONCE, at full time, from the energy you finish on
 * (creditMatchResult, careerFlow.ts). So the radar does exactly that roll,
 * with the career's own risk and the career's own lay-off lengths, and shows
 * it as a full-time event. Its own random stream, so the match itself — every
 * minute and every score — is untouched by it.
 */
export interface RadarInjuryCheck {
  /** Your energy when the whistle went: kick-off energy less ninety minutes. */
  endEnergy: number;
  /** The career's chance of an injury at that energy, 0-1. */
  risk: number;
  injury: { weeksRemaining: number; note: string } | null;
}

export function startRadar(seed: number, inputs: HiddenMatchInputs, fullTime = 90, startEnergy = 100): RadarMatch {
  const rng = mulberry32(seed);
  const state = newMatch(rng);
  return {
    seed, inputs, fullTime, state, rng, pending: null, startEnergy,
    frames: [snapshot(state, [], undefined)],
  };
}

/** The career's full-time injury roll, for a player on for the whole match. */
export function injuryCheckFor(seed: number, inputs: HiddenMatchInputs, fullTime: number, startEnergy: number): RadarInjuryCheck {
  const endEnergy = Math.max(0, startEnergy - energyPerMinute(inputs.energyMode ?? "medium") * fullTime);
  const risk = injuryRiskFor(endEnergy);
  const rng = mulberry32((seed ^ 0x5eed1e) >>> 0);
  return { endEnergy: Math.round(endEnergy), risk, injury: rng() < risk ? rollInjury(rng) : null };
}

export const radarOver = (m: RadarMatch) => m.pending === null && m.state.minute >= m.fullTime;

/**
 * Advance one real minute. Returns the new frame, or null if the match is over
 * or waiting on a highlight to be played out.
 */
export function stepRadar(m: RadarMatch): RadarFrame | null {
  if (m.pending || m.state.minute >= m.fullTime) return null;
  const { events, request } = tick(m.state, m.inputs, m.rng);
  const out = events.map(classify);
  let highlight: RadarHighlight | undefined;
  if (request) {
    highlight = fromRequest(m.state.minute, request);
    m.pending = highlight;
    out.push({ minute: m.state.minute, kind: "highlight", text: `Your highlight — ${request.reason.toLowerCase()}` });
  }
  if (m.state.minute >= m.fullTime && !m.injuryCheck) {
    m.injuryCheck = injuryCheckFor(m.seed, m.inputs, m.fullTime, m.startEnergy);
    const hurt = m.injuryCheck.injury;
    if (hurt) out.push({ minute: m.fullTime, kind: "injury", text: `🚑 You pick up an injury — ${hurt.note.toLowerCase()}` });
  }
  const frame = snapshot(m.state, out, highlight);
  m.frames.push(frame);
  return frame;
}

/**
 * Play the waiting highlight out. "bench-rate" is exactly `advanceTo`'s own
 * rule for a chance that fell to you while you weren't on the pitch.
 */
export function resolveHighlight(m: RadarMatch, how: "goal" | "missed" | "bench-rate"): void {
  const h = m.pending;
  if (!h) return;
  const scored = how === "bench-rate" ? m.rng() < benchConversion(h.zone) : how === "goal";
  resolveScenario(m.state, scored ? "goal" : "saved");
  h.result = scored ? "goal" : "missed";
  h.decidedBy = how === "bench-rate" ? "bench-rate" : "you";
  m.pending = null;
  // The resolution lands on the minute it happened in, so the score line and
  // the feed agree with the frame that showed the chance.
  const last = m.frames[m.frames.length - 1];
  last.userScore = m.state.userScore;
  last.oppScore = m.state.oppScore;
  last.possession = m.state.possession;
  last.zone = m.state.zone;
  last.momentum = m.state.momentum;
  last.events.push({
    minute: h.minute,
    kind: scored ? "highlight-goal" : "highlight-miss",
    text: scored ? "⚽ You score!" : "Your chance goes begging.",
  });
}

/** Run a whole match with no screen — highlights at the bench rate. */
export function playRadarMatch(seed: number, inputs: HiddenMatchInputs, fullTime = 90, startEnergy = 100): RadarMatch {
  const m = startRadar(seed, inputs, fullTime, startEnergy);
  for (let guard = 0; guard < fullTime * 4 && !radarOver(m); guard++) {
    if (m.pending) resolveHighlight(m, "bench-rate");
    else stepRadar(m);
  }
  return m;
}

export interface RadarSummary {
  userScore: number;
  oppScore: number;
  /** Share of minutes each side had the ball, 0-100. */
  possessionUs: number;
  /** Share of minutes the ball spent in their half (final third or box). */
  territoryUs: number;
  territoryThem: number;
  chancesUs: number;
  chancesThem: number;
  highlights: RadarHighlight[];
  goals: { minute: number; us: boolean; you: boolean }[];
  /** The full-time injury check (see RadarInjuryCheck). */
  injuryCheck?: RadarInjuryCheck;
}

export function radarSummary(m: RadarMatch): RadarSummary {
  const played = m.frames.slice(1);
  const n = Math.max(1, played.length);
  const ours = played.filter((f) => f.possession === "user").length;
  const theirHalf = played.filter((f) => f.zone === "attacking" || f.zone === "box").length;
  const ourHalf = played.filter((f) => f.zone === "defensive" || f.zone === "own_box").length;
  const events = played.flatMap((f) => f.events);
  return {
    userScore: m.state.userScore,
    oppScore: m.state.oppScore,
    possessionUs: Math.round((ours / n) * 100),
    territoryUs: Math.round((theirHalf / n) * 100),
    territoryThem: Math.round((ourHalf / n) * 100),
    chancesUs: events.filter((e) => e.kind === "goal-us" || e.kind === "chance-us" || e.kind === "highlight").length,
    chancesThem: events.filter((e) => e.kind === "goal-them" || e.kind === "chance-them").length,
    highlights: played.flatMap((f) => (f.highlight ? [f.highlight] : [])),
    injuryCheck: m.injuryCheck,
    goals: events.flatMap((e): RadarSummary["goals"] =>
      e.kind === "goal-us" || e.kind === "highlight-goal" ? [{ minute: e.minute, us: true, you: e.kind === "highlight-goal" }]
      : e.kind === "goal-them" ? [{ minute: e.minute, us: false, you: false }] : []),
  };
}

// ── Bits ───────────────────────────────────────────────────────────────────

function snapshot(s: HiddenMatchState, events: RadarEvent[], highlight: RadarHighlight | undefined): RadarFrame {
  return {
    minute: s.minute, possession: s.possession, zone: s.zone, lane: s.lane ?? "centre",
    momentum: s.momentum, userScore: s.userScore, oppScore: s.oppScore, events, highlight,
  };
}

function fromRequest(minute: number, r: ScenarioRequest): RadarHighlight {
  return {
    minute, zone: r.zone, lane: r.lane ?? "centre", reason: r.reason,
    kinds: Array.from(new Set(r.kinds)), dribble: !!r.dribble,
  };
}

function classify(e: HiddenMatchEvent): RadarEvent {
  if (e.isGoal) return { minute: e.minute, kind: e.teammateGoal ? "goal-us" : "goal-them", text: e.text };
  if (CHANCE_LINES.has(e.text)) return { minute: e.minute, kind: e.isOpponent ? "chance-them" : "chance-us", text: e.text };
  return { minute: e.minute, kind: "quiet", text: e.text };
}
