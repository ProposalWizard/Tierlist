/**
 * lib/draft/matchTimeline.ts — a simulated match told minute by minute, for the
 * Draft's Match Centre (Leo, 27 Nov 2026: "watching games or commentary …
 * do all that for finals too … or let the user decide").
 *
 * Built from the result the season sim already made (never re-simulated):
 * your goals keep their real scorer, assist and minute; the other side's
 * goals get minutes from a seed so the same match always tells the same way.
 * Between the goals: kick-off, chances, half-time, full-time, extra time and
 * penalties when the match had them. Pure.
 */
import { seeded, hashString } from "./daily";

export interface TimelineMatch {
  you: string;
  them: string;
  youHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  goalScorers: { player: string; minute: number }[];
  assistProviders?: { player: string; minute: number }[];
  extraTime?: boolean;
  penalties?: boolean;
  penaltyScore?: { player: number; opponent: number };
  /** Your squad's names, for the chances lines. */
  squad?: string[];
  title?: string;
}

export interface TimelineEvent { minute: number; text: string; you: number; them: number; kind: "start" | "chance" | "goal-you" | "goal-them" | "half" | "end" | "pens" }

const CHANCE_YOU = [
  "{p} lets fly from 25 yards: just wide.",
  "{p} gets in behind, the keeper is out quickly to smother it.",
  "Lovely move, {p} heads it over the bar.",
  "{p} curls one towards the far corner: tipped round the post.",
];
const CHANCE_THEM = [
  "{t} break quickly, the shot is blocked.",
  "{t} hit the bar! Lucky escape.",
  "A long ball from {t}, cleared off the line.",
  "{t} are pressing high now.",
];
const GOAL_YOU = ["GOAL! {p} finishes it!", "GOAL! {p} buries it into the bottom corner!", "GOAL! {p} rises highest and heads it in!", "GOAL! What a strike from {p}!"];
const GOAL_THEM = ["Goal for {t}. A sweeping move and they finish it.", "{t} score. A scramble in the box and it's in.", "{t} have one. Clinical."];

export function matchTimeline(m: TimelineMatch): TimelineEvent[] {
  const rnd = seeded(hashString(`${m.you}|${m.them}|${m.goalsFor}-${m.goalsAgainst}|${m.goalScorers.map((g) => g.player + g.minute).join(",")}`));
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const len = m.extraTime ? 120 : 90;
  const squad = m.squad?.length ? m.squad : m.goalScorers.map((g) => g.player);
  const name = () => (squad.length ? pick(squad) : "Your striker");
  const assistAt = (min: number) => m.assistProviders?.find((a) => a.minute === min)?.player;

  type Raw = { minute: number; kind: TimelineEvent["kind"]; text: string };
  const raw: Raw[] = [];
  const yourGoals = [...m.goalScorers].sort((a, b) => a.minute - b.minute).slice(0, m.goalsFor);
  while (yourGoals.length < m.goalsFor) yourGoals.push({ player: name(), minute: 1 + Math.floor(rnd() * (len - 1)) });
  for (const g of yourGoals) {
    const a = assistAt(g.minute);
    raw.push({ minute: g.minute, kind: "goal-you", text: pick(GOAL_YOU).replace("{p}", g.player) + (a ? ` Assist: ${a}.` : "") });
  }
  for (let i = 0; i < m.goalsAgainst; i++) raw.push({ minute: 1 + Math.floor(rnd() * (len - 1)), kind: "goal-them", text: pick(GOAL_THEM).replace("{t}", m.them) });
  const chances = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < chances; i++) {
    const mine = rnd() < 0.55;
    raw.push({ minute: 1 + Math.floor(rnd() * (len - 1)), kind: "chance", text: mine ? pick(CHANCE_YOU).replace("{p}", name()) : pick(CHANCE_THEM).replace("{t}", m.them) });
  }
  raw.push({ minute: 0, kind: "start", text: m.title ? `${m.title}. We're under way!` : "Kick-off. We're under way!" });
  raw.push({ minute: 45, kind: "half", text: "Half-time." });
  if (m.extraTime) raw.push({ minute: 90, kind: "half", text: "Full-time in normal time. Extra time!" });
  raw.sort((a, b) => a.minute - b.minute || (a.kind === "half" ? 1 : 0) - (b.kind === "half" ? 1 : 0));

  let you = 0, them = 0;
  const out: TimelineEvent[] = raw.map((e) => {
    if (e.kind === "goal-you") you++;
    if (e.kind === "goal-them") them++;
    return { ...e, you, them };
  });
  if (m.penalties && m.penaltyScore) {
    const won = m.penaltyScore.player > m.penaltyScore.opponent;
    out.push({ minute: len, kind: "pens", you, them, text: `Penalties: ${m.penaltyScore.player}-${m.penaltyScore.opponent}. ${won ? "You win the shoot-out!" : `${m.them} win the shoot-out.`}` });
  }
  const res = you > them ? "You win!" : you < them ? `${m.them} win.` : m.penalties ? "" : "A draw.";
  out.push({ minute: len, kind: "end", you, them, text: `Full-time: ${you}-${them}. ${res}`.trim() });
  return out;
}
