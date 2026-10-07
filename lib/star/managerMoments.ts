/**
 * TWO MANAGER MOMENTS THAT HAD NO SCREEN (Harry, 7 Oct 2026, MANAGER_PLAN.md §2).
 *
 *   1. MADE CAPTAIN. The armband used to be given silently (careerFlow.ts,
 *      `captaincyEarned`). Now careerFlow also sets `captainMomentPending`,
 *      and the next time you reach Home the manager tells you, once.
 *      The owner path (clubPowers.ts `appointSelfCaptain`) sets no flag: an
 *      owner who appoints himself needs no speech from his manager.
 *   2. DROPPED TO THE BENCH. Your last club match you started; this one
 *      the manager has you on the bench. On the pre-match screen he says why,
 *      with the real reason when there is one (energy, back from injury,
 *      a rival who has the shirt, your form, him).
 *
 * Pure rules and words only. The screens are in components/star/ManagerMoments.tsx.
 */
import type { CareerState, MatchStats } from "./types";
import type { SelectionVerdict } from "./selection";
import { MIN_ENERGY_TO_START, recentForm, shirtRival, shirtWon } from "./selection";
import { managerTalkStyle, type TalkStyle } from "./bossTalk";

export type LastPick = NonNullable<CareerState["lastPick"]>;
export type PickStatus = LastPick["status"];

// ── Recording what you were picked as ───────────────────────────────────────

/** After a club match you played in: did you start it, or come off the bench? */
export function pickAfterMatch(stats: Pick<MatchStats, "cameo" | "minutes">): LastPick {
  const fromBench = !!stats.cameo || (stats.minutes ?? 90) <= 0;
  return { status: fromBench ? "Substitute" : "1st Team" };
}

/** After a club match you missed. Injured: what you were stays, and we note
 *  you were out. Left out of the squad: you were "Squad". */
export function pickAfterMissed(prev: LastPick | undefined, injured: boolean): LastPick | undefined {
  if (injured) return prev ? { ...prev, injuredSince: true } : prev;
  return { status: "Squad" };
}

// ── 1. Made captain ─────────────────────────────────────────────────────────

/** The armband has just been given and he hasn't told you yet. */
export function captainMomentDue(career: Pick<CareerState, "captain" | "captainMomentPending">): boolean {
  return !!career.captain && !!career.captainMomentPending;
}

const CAPTAIN_LINES: Record<TalkStyle, string[]> = {
  press: [
    "You're my captain. You run more than anyone in that dressing room, and they follow the man who runs. Lead the press from the front.",
    "The armband's yours. I want the first tackle, the loudest voice and the last man still sprinting at ninety. That's a captain to me.",
  ],
  possession: [
    "You're my captain. You see the game the way I want it played. Keep the ball, keep the lads calm, and talk to them on the pitch.",
    "The armband's yours. When it gets messy out there, they look at you and the ball goes through you. That's the job now.",
  ],
  low: [
    "You're my captain. You do the dirty work and you never complain. Keep the shape, keep them honest, and we'll grind it out together.",
    "The armband's yours. I trust you to keep the lads switched on for ninety minutes. One lapse costs us. Not on your watch.",
  ],
  mid: [
    "You're my captain. On time, fit, no fuss, every week. That's what I want the others to copy. Wear it properly.",
    "The armband's yours. You've earned it the right way: you turn up and you do the job. Now make sure everyone else does.",
  ],
};

/** His words when he gives you the armband. Fixed per career moment. */
export function captainLine(career: Pick<CareerState, "manager" | "season" | "week">): string {
  const style = managerTalkStyle(career.manager?.name ?? "The manager");
  const lines = CAPTAIN_LINES[style];
  return lines[(career.season * 7 + career.week) % lines.length];
}

// ── 2. Dropped to the bench ─────────────────────────────────────────────────

export type BenchReason = "injury" | "energy" | "rival" | "boss" | "form";

/** A fixture's own key, so the moment shows once even if you go Back and Play again. */
export function fixtureMomentKey(career: Pick<CareerState, "season">, f: { week: number; kind?: string; opponent: string }): string {
  return `${career.season}:${f.week}:${f.kind ?? "league"}:${f.opponent}`;
}

/** Why he dropped you, in the same order selectionFor decides it. */
export function benchReason(career: CareerState, energy: number): BenchReason {
  if (career.lastPick?.injuredSince) return "injury";
  if (energy < MIN_ENERGY_TO_START) return "energy";
  if (!shirtWon(career) && shirtRival(career)) return "rival";
  if (career.relationships.boss < 40) return "boss";
  return "form";
}

const BENCH_LINES: Record<BenchReason, ((c: CareerState) => string)[]> = {
  injury: [
    () => "Good to have you back. But you've been out, and I won't throw you in for ninety. You start on the bench.",
    () => "You're fit again, and I'm glad. Bench today. Get some minutes in your legs and we'll go from there.",
  ],
  energy: [
    () => "You're running on fumes. I need fresh legs from the start, so you're on the bench. Be ready when I call you.",
    () => "I've seen the numbers: you're tired. You start on the bench today. Rest properly this week.",
  ],
  rival: [
    (c) => `${shirtRival(c)?.name ?? "He"} starts today. He's in form and the shirt is his to lose. Make me pick you when you come on.`,
    (c) => `I'm going with ${shirtRival(c)?.name ?? "him"} from the start. It's not over for you: come off that bench and change my mind.`,
  ],
  boss: [
    () => "I'm not happy with you, and you know why. Bench. Show me something in training and we'll talk.",
    () => "You start on the bench. Your attitude hasn't been right, and I pick people I can trust.",
  ],
  form: [
    (c) => `Your last few haven't been good enough (${recentForm(c.form).toFixed(1)} average). You start on the bench. Earn it back.`,
    () => "You've dipped. It happens to everyone, but I pick on form. Bench today, and take your chance when it comes.",
  ],
};

/** One closing line in his own voice (bossTalk's style off his name). */
const BENCH_TAIL: Record<TalkStyle, string> = {
  press: "When you come on, I want you running.",
  possession: "When you come on, keep it simple and keep the ball.",
  low: "When you come on, do your job and don't switch off.",
  mid: "When you come on, be professional about it.",
};

export interface BenchMoment { key: string; reason: BenchReason; text: string }

/**
 * Fires only when the last club match you STARTED and this one has you on the
 * bench. Not sub → sub, not when you're injured or out of the squad, not for
 * an international (another manager), and not twice for one fixture.
 */
export function benchMomentFor(
  career: CareerState,
  verdict: Pick<SelectionVerdict, "status"> | null,
  fixture: { week: number; kind?: string; opponent: string },
  energy: number = career.energy,
): BenchMoment | null {
  if (!verdict || verdict.status !== "Substitute") return null;
  if (fixture.kind === "international") return null;
  if (career.lastPick?.status !== "1st Team") return null;
  const key = fixtureMomentKey(career, fixture);
  if (career.benchMomentSeen === key) return null;
  const reason = benchReason(career, energy);
  const lines = BENCH_LINES[reason];
  const line = lines[(career.season * 5 + fixture.week) % lines.length](career);
  const style = managerTalkStyle(career.manager?.name ?? "The manager");
  return { key, reason, text: `${line} ${BENCH_TAIL[style]}` };
}
