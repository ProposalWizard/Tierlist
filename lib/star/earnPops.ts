import type { CareerState } from "./types";
import { ACHIEVEMENTS } from "./achievements";
import { RECORDS, recordBeaten } from "./records";

/**
 * THINGS EARNED, AS POP-UPS (Harry and Mikey, P36: "achievements … should
 * actually start popping up automatically … and when you break records, the
 * same thing should happen").
 *
 * Pure: give it the career before and after a change, get back what is new —
 * achievements, your own records beaten (furthest goal, most in a match or a
 * season), and the real Premier League records you have passed. The screen
 * shows each one in the existing achievement pop-up (UnlockChain.tsx).
 *
 * A record is only "broken" when there was an earlier mark to beat: the first
 * goal you ever score is not a record, the second-longest is not either.
 */
export interface EarnPop { id: string; kind: "achievement" | "record"; label: string; unlocked: string }

const m = (n: number) => `${Math.round(n)}m`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Add newly broken records to this season's list: one entry per record,
 *  the latest mark replacing the earlier one (Mikey, 6 Oct 2026). */
export function addSeasonRecords(list: { label: string; unlocked: string }[] | undefined, fresh: EarnPop[]): { label: string; unlocked: string }[] {
  const out = [...(list ?? [])];
  for (const r of fresh) {
    if (r.kind !== "record") continue;
    // Premier League records each have their own line; own bests replace by label.
    const key = r.label === "Premier League record broken" ? r.unlocked : r.label;
    const i = out.findIndex((x) => (x.label === "Premier League record broken" ? x.unlocked : x.label) === key);
    if (i >= 0) out[i] = { label: r.label, unlocked: r.unlocked };
    else out.push({ label: r.label, unlocked: r.unlocked });
  }
  return out;
}

export function earnedBetween(prev: CareerState, next: CareerState): EarnPop[] {
  const out: EarnPop[] = [];
  // The same player, only moving forward — a different save loading is not a moment.
  if (prev.player.firstName !== next.player.firstName || prev.player.lastName !== next.player.lastName) return out;
  if (!prev.achievements.every((id) => next.achievements.includes(id))) return out;

  for (const id of next.achievements) {
    if (prev.achievements.includes(id)) continue;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) out.push({ id: `ach:${id}`, kind: "achievement", label: a.label, unlocked: a.description });
  }

  const p = prev.careerBests, n = next.careerBests;
  if (p && n) {
    if (p.furthestGoal && n.furthestGoal && n.furthestGoal.metres > p.furthestGoal.metres)
      out.push({ id: `rec:fg:${Math.round(n.furthestGoal.metres)}`, kind: "record", label: "Furthest goal", unlocked: `A new best: ${m(n.furthestGoal.metres)}` });
    if (p.furthestAssist && n.furthestAssist && n.furthestAssist.metres > p.furthestAssist.metres)
      out.push({ id: `rec:fa:${Math.round(n.furthestAssist.metres)}`, kind: "record", label: "Furthest assist", unlocked: `A new best: ${m(n.furthestAssist.metres)}` });
    if (p.mostGoalsMatch && n.mostGoalsMatch && n.mostGoalsMatch.goals > p.mostGoalsMatch.goals)
      out.push({ id: `rec:gm:${n.mostGoalsMatch.goals}`, kind: "record", label: "Most goals in a match", unlocked: `A new best: ${plural(n.mostGoalsMatch.goals, "goal")}` });
    if (p.mostGoalsSeason && n.mostGoalsSeason && n.mostGoalsSeason.goals > p.mostGoalsSeason.goals)
      out.push({ id: `rec:gs:${n.mostGoalsSeason.goals}`, kind: "record", label: "Most goals in a season", unlocked: `A new best: ${plural(n.mostGoalsSeason.goals, "goal")}` });
    if (p.mostAssistsSeason && n.mostAssistsSeason && n.mostAssistsSeason.assists > p.mostAssistsSeason.assists)
      out.push({ id: `rec:as:${n.mostAssistsSeason.assists}`, kind: "record", label: "Most assists in a season", unlocked: `A new best: ${plural(n.mostAssistsSeason.assists, "assist")}` });
  }

  for (const r of RECORDS) {
    if (!recordBeaten(prev, r) && recordBeaten(next, r)) {
      out.push({ id: `pl:${r.id}`, kind: "record", label: "Premier League record broken", unlocked: `${r.label} — beating ${r.holder.split(" — ")[0]}` });
    }
  }
  return out;
}
