import type { CareerState } from "./types";
import type { ManagerStyle } from "./manager";
import { recentForm } from "./selection";

/**
 * TALK TO YOUR MANAGER — the boss's relationship game.
 *
 * v1 (Mikey, 4 Oct 2026): he raises your real situation, you pick one of
 * three replies, and whether it lands was fixed by your form and his style.
 *
 * v2 (Mikey, 5 Oct 2026): "it's too obvious which one he will like… there's no
 * benefit to picking one that is obviously going to worsen your relationship."
 * It also showed him agreeing with you ("your numbers say you might be right")
 * and then the bar going down. Now:
 *  - Each talk he is in a hidden MOOD: fired up, calm, or all business. His
 *    style makes some moods likelier (a demanding boss is often fired up), and
 *    so does your form.
 *  - Each reply has a TRAIT: hungry, humble or bold. Which one he wants
 *    depends on his mood, not on which reply sounds nicest.
 *  - The only clue is how he opens. Each mood has its own way of speaking
 *    (fired up: short and sharp; calm: "come in, take a seat"; business: "two
 *    minutes", numbers). Two openers per mood per situation, so it is a read,
 *    not a memorised line.
 *  - Nothing is certain: the right read lands 85% of the time, a half-right
 *    one 45%, the wrong one 10%.
 *  - His answer always matches the result.
 *  - The replies come in a random order.
 *
 * Pure given `rng`: the screen is components/star/relgames/BossChat.tsx.
 */

export type Topic = "benched" | "flying" | "slump" | "settling";
export type Mood = "fired" | "calm" | "business";
export type Trait = "hungry" | "humble" | "bold";

export interface Reply {
  text: string;
  trait: Trait;
  /** The chance it lands, given his mood (shown to nobody; for tests). */
  chance: number;
  /** Does it land this time? */
  lands: boolean;
  /** What he says back — always matching `lands`. */
  answer: string;
}

export interface Chat {
  topic: Topic;
  mood: Mood;
  opener: string;
  replies: Reply[];
}

/** What he wants to talk about: your last few matches and your place. */
export function topicFor(career: Pick<CareerState, "status" | "form">): Topic {
  const form = recentForm(career.form);
  if (career.status === "Substitute" || career.status === "Squad") return "benched";
  if (form >= 7.5) return "flying";
  if (form > 0 && form < 6) return "slump";
  return "settling";
}

/** How likely each mood is, before your form nudges it. */
const MOOD_ODDS: Record<ManagerStyle, Record<Mood, number>> = {
  demanding: { fired: 0.55, calm: 0.2, business: 0.25 },
  trusting: { fired: 0.2, calm: 0.45, business: 0.35 },
  rotational: { fired: 0.25, calm: 0.5, business: 0.25 },
};

/** For each mood: the trait he wants, the one that half-works, the wrong one. */
const WANTS: Record<Mood, { best: Trait; ok: Trait }> = {
  fired: { best: "hungry", ok: "bold" },
  calm: { best: "humble", ok: "hungry" },
  business: { best: "bold", ok: "humble" },
};
export const LAND_BEST = 0.85;
export const LAND_OK = 0.45;
export const LAND_WRONG = 0.1;

export function landChance(mood: Mood, trait: Trait): number {
  const w = WANTS[mood];
  return trait === w.best ? LAND_BEST : trait === w.ok ? LAND_OK : LAND_WRONG;
}

export function moodFor(style: ManagerStyle, topic: Topic, roll: number): Mood {
  const odds = { ...MOOD_ODDS[style] };
  // A slump makes any boss more likely to be fired up; a good spell, more
  // likely to talk business.
  if (topic === "slump") odds.fired += 0.15;
  if (topic === "flying") odds.business += 0.15;
  const total = odds.fired + odds.calm + odds.business;
  let r = roll * total;
  for (const m of ["fired", "calm", "business"] as Mood[]) {
    r -= odds[m];
    if (r < 0) return m;
  }
  return "business";
}

type Line = { text: string; trait: Trait; yes: string; no: string };

const REPLIES: Record<Topic, Line[]> = {
  benched: [
    { trait: "hungry", text: "I'll show you in training. Watch me.", yes: "That's what I want to hear.", no: "Talk's cheap. I judge you on Saturdays." },
    { trait: "humble", text: "Whatever you think is best, boss.", yes: "Good attitude. Your chance will come.", no: "I need you hungrier than that." },
    { trait: "bold", text: "I deserve to start. You know I do.", yes: "Your numbers say you might be right. We'll see.", no: "Deserve it? Prove it first." },
  ],
  flying: [
    { trait: "humble", text: "It's the lads. They make it easy for me.", yes: "That's the right attitude. Keep it.", no: "Don't be modest. I need you to lead." },
    { trait: "bold", text: "I want my contract looked at.", yes: "Fair enough. Leave it with me.", no: "Now? Don't get ahead of yourself." },
    { trait: "hungry", text: "I've got more in me. Push me harder.", yes: "Oh, I will.", no: "Steady. Don't burn yourself out." },
  ],
  slump: [
    { trait: "humble", text: "I know. I'll fix it. No excuses.", yes: "Good. I'll hold you to that.", no: "Sorry doesn't win games. I need to see it." },
    { trait: "bold", text: "The way we play doesn't suit me.", yes: "Fair point. I'll look at your role.", no: "Then adapt. The system isn't changing for you." },
    { trait: "hungry", text: "Give me a run of games and I'll find it.", yes: "You'll get your run. Don't waste it.", no: "Runs are earned, not given." },
  ],
  settling: [
    { trait: "humble", text: "Loving it. Ready for whatever you need.", yes: "Good lad.", no: "Ready isn't enough. I want to see some fire." },
    { trait: "bold", text: "I'd like to know where I stand.", yes: "Straight question. Keep this up and you start.", no: "You'll know when I pick the team." },
    { trait: "hungry", text: "I want more of the ball in games.", yes: "Then demand it out there.", no: "Earn it first." },
  ],
};

/** How he opens: the only clue to his mood. `{n}` is your first name. */
const OPENERS: Record<Topic, Record<Mood, [string, string]>> = {
  benched: {
    fired: ["Sit down, {n}. Bench again. You know why?", "{n}. Bench. Again. Explain that to me."],
    calm: ["Come in, {n}. I know the bench is hard. Let's talk.", "{n}, take a seat. You've been patient on the bench."],
    business: ["Two minutes, {n}. You've been on the bench. Here's where we are.", "{n}. The bench. Let's be straight about it."],
  },
  flying: {
    fired: ["{n}! Good spell. Don't you dare ease off now.", "Good spell, {n}. Now I want more."],
    calm: ["Come in, {n}. Lovely spell. Everyone's talking about you.", "{n}, take a seat. Well played lately. How does it feel?"],
    business: ["{n}. Good numbers lately. Let's talk about what's next.", "Two minutes, {n}. Clubs are noticing you. Let's be straight."],
  },
  slump: {
    fired: ["{n}. Your form's gone. What's going on?", "Sit down, {n}. That's not good enough lately."],
    calm: ["{n}, take a seat. Rough few weeks. Talk to me.", "Come in, {n}. Form dips happen. How are you?"],
    business: ["{n}. Your numbers have dropped. Two minutes.", "{n}. Let's look at your last few games, straight."],
  },
  settling: {
    fired: ["{n}. You've been here a while. Are you hungry?", "{n}! Training was flat. Wake up."],
    calm: ["How are you settling in, {n}?", "Come in, {n}. Feeling at home yet?"],
    business: ["{n}. Quick chat about your place here.", "Two minutes, {n}. Where do you think you stand?"],
  },
};

export function chatFor(career: Pick<CareerState, "status" | "form" | "manager" | "player">, rng: () => number = Math.random): Chat {
  const topic = topicFor(career);
  const style: ManagerStyle = career.manager?.style ?? "trusting";
  const mood = moodFor(style, topic, rng());
  const name = career.player.firstName;
  const opener = OPENERS[topic][mood][rng() < 0.5 ? 0 : 1].replace("{n}", name);
  const replies: Reply[] = REPLIES[topic].map((l) => {
    const chance = landChance(mood, l.trait);
    const lands = rng() < chance;
    return { text: l.text, trait: l.trait, chance, lands, answer: lands ? l.yes : l.no };
  });
  // Random order, so the position gives nothing away.
  for (let i = replies.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [replies[i], replies[j]] = [replies[j], replies[i]];
  }
  return { topic, mood, opener, replies };
}
