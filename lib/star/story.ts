/**
 * THE FIRST HOUR AS A STORY (Mikey, 23 Oct 2026). A new career opens one
 * thing at a time, each one brought in by a person at the right moment:
 *
 *   0  Signing day   Home: your player, energy, Play. League and Play open.
 *                    "Your first game is next. You're in the squad. Tap Play."
 *   1  After game 1  The gaffer: "Come and see me" → his office (the talk).
 *                    Then "Time to train": Training opens, and the
 *                    training day is Power and Technique, free, one by one (Mikey, 24 Oct).
 *                    Then "You're ready for the next game" → Play.
 *   2  After game 2  Energy is low: a free Basic can, and USE it on Home.
 *                    A team-mate gives you his cracked old phone: the Phone
 *                    opens (Messages, Fixtures, Squad, Relations); the first
 *                    message is from your agent.
 *   3  After game 3  The chairman: "Wages are in, the lads are off to the
 *                    shop." The Shop opens.
 *   First goal       Stats and Achievements open on your card.
 *   Star level 2     "You levelled up, claim your reward" → the Star Pass.
 *   First offer      Sponsors (the usual unlock pop-up).
 *
 * Only a career started from this build has `unlocks.story`. Every older save
 * keeps its own order (lib/star/unlocks.ts). Pure.
 */
import type { CareerState, CareerUnlocks } from "./types";
import type { Feature } from "./unlocks";
import { BOOTS_CATALOGUE } from "./shopData";

export type Beat = "boots" | "boss" | "training" | "ready" | "can" | "phone" | "shop" | "stats" | "starpass" | "sponsor";

/** The two drills of the training day (Mikey, 24 Oct 2026: "only do 2 drills, the power and technique"), in the order the pointer shows them. */
export const TRAINING_DAY: string[] = ["power", "technique"];

/** The order the beats come in. The first one that is due and not seen shows. */
const ORDER: Beat[] = ["boots", "boss", "training", "ready", "starpass", "can", "phone", "shop", "stats", "sponsor"];

type C = Pick<CareerState, "unlocks" | "achievements" | "careerStats" | "fixtures" | "brands">;

export function isStory(c: Pick<CareerState, "unlocks">): boolean {
  return !!c.unlocks?.story;
}

function games(c: C): number {
  return Math.max(c.careerStats?.appearances ?? 0, (c.fixtures ?? []).filter((f) => f.played).length);
}

/** Drills of the training day still to do, in order. */
export function trainingDayLeft(c: Pick<CareerState, "unlocks">): string[] {
  if (!isStory(c)) return [];
  const done = c.unlocks!.trainingDay ?? [];
  return TRAINING_DAY.filter((s) => !done.includes(s));
}

/** The training day is on: Training is open and drills cost nothing. */
export function trainingDayOn(c: Pick<CareerState, "unlocks">): boolean {
  return isStory(c) && (c.unlocks!.open.includes("training")) && trainingDayLeft(c).length > 0;
}

/** Is this beat due now (its moment has come)? */
function due(c: C, b: Beat, stars: number): boolean {
  const n = games(c);
  switch (b) {
    case "boots": return n === 0;
    case "boss": return n >= 1 && !c.achievements.includes("boss-meeting");
    case "training": return c.achievements.includes("boss-meeting");
    case "ready": return seenBeat(c, "training") && trainingDayLeft(c).length === 0 && n < 2;
    case "starpass": return stars >= 2 && n >= 1;
    case "can": return n >= 2;
    case "phone": return n >= 2;
    case "shop": return n >= 3;
    case "stats": return (c.careerStats?.goals ?? 0) >= 1;
    // The offer is in your messages, so it comes once you have a phone.
    case "sponsor": return seenBeat(c, "phone") && ((c.brands?.offers.length ?? 0) > 0 || (c.brands?.deals.length ?? 0) > 0);
  }
}

export function seenBeat(c: Pick<CareerState, "unlocks">, b: Beat): boolean {
  return !!c.unlocks?.seen.includes(`beat-${b}`);
}

/** The beat to show now, or null. `stars` = your star level (starsNow). */
export function storyBeat(c: C, stars: number): Beat | null {
  if (!isStory(c)) return null;
  for (const b of ORDER) if (!seenBeat(c, b) && due(c, b, stars)) return b;
  return null;
}

/** What each beat opens. */
const OPENS: Partial<Record<Beat, Feature[]>> = {
  training: ["training"],
  phone: ["phone", "relations"],
  shop: ["shop"],
  stats: ["stats", "achievements"],
  sponsor: ["sponsors"],
};

/** The beat was shown and its button pressed: mark it, open what it opens,
 *  and hand over what it gives (the can, the phone). */
export function ackBeat(c: CareerState, b: Beat): CareerState {
  if (!c.unlocks) return c;
  const opens = OPENS[b] ?? [];
  const u: CareerUnlocks = {
    ...c.unlocks,
    seen: [...c.unlocks.seen.filter((k) => k !== `beat-${b}`), `beat-${b}`, ...(b === "phone" ? ["phone-tour"] : [])],
    open: [...c.unlocks.open, ...opens.filter((f) => !c.unlocks!.open.includes(f))],
  };
  let out: CareerState = { ...c, unlocks: u };
  if (b === "boots") out = { ...out, currentBoot: storyBoots() };
  if (b === "can") out = { ...out, kibCans: { ...out.kibCans, basic: (out.kibCans?.basic ?? 0) + 1 } };
  if (b === "phone" && !out.achievements.includes("buy-phone")) out = { ...out, achievements: [...out.achievements, "buy-phone"] };
  return out;
}

/** A training-day drill was finished. */
export function recordTrainingDayDrill(c: CareerState, skill: string): CareerState {
  if (!trainingDayOn(c) || !TRAINING_DAY.includes(skill)) return c;
  const done = c.unlocks!.trainingDay ?? [];
  if (done.includes(skill)) return c;
  return { ...c, unlocks: { ...c.unlocks!, trainingDay: [...done, skill] } };
}

/** The person, their words and the button, for the beat's sheet. */
/** The team-mate's old boots: the starter pair, 5 games left (Mikey, 24 Oct 2026). */
export const STORY_BOOT_GAMES = 5;
export function storyBoots(): CareerState["currentBoot"] {
  return { ...BOOTS_CATALOGUE[0], matches: STORY_BOOT_GAMES };
}

export interface BeatText {
  who: string; icon: string; title: string; line: string; button: string;
  /** A pair of boots to show, with what they give (the "boots" beat). */
  boot?: { name: string; pic: string; stats: string[]; games: number };
}

export function beatText(c: CareerState, b: Beat): BeatText {
  const gaffer = c.manager?.name ? `The gaffer, ${c.manager.name}` : "The gaffer";
  const mate = teamMateName(c);
  switch (b) {
    case "boots": {
      const b = storyBoots();
      const stats = [b.power ? `Power +${b.power}` : "", b.technique ? `Technique +${b.technique}` : ""].filter(Boolean);
      return {
        who: mate, icon: "👟", title: "Have my old boots",
        line: `Your first game's coming up. Take my old boots. They've got ${STORY_BOOT_GAMES} games left in them.`,
        button: "Thanks!",
        boot: { name: b.name, pic: `/star/shop2d/items/boot-${b.baseId ?? b.id}-L${b.level ?? 1}.webp`, stats, games: STORY_BOOT_GAMES },
      };
    }
    case "boss": return { who: gaffer, icon: "🧢", title: "Come and see me", line: "Good first game, son. Come to my office, I want a word.", button: "Go to his office" };
    case "training": return { who: gaffer, icon: "🧢", title: "Time to train", line: "Training's open. Do two drills for me now, Power and Technique, so I can see what you've got. They cost no energy.", button: "Go to training" };
    case "ready": return { who: gaffer, icon: "🧢", title: "You're ready", line: "Great work. You're ready for the next game.", button: "Play" };
    // "Claim your reward" once the Star Pass has a reward at level 2 (the
    // level ladder is the next build); until then it shows the Pass.
    case "starpass": return { who: "Star Pass", icon: "⭐", title: "You levelled up", line: "You're star level 2. Every level on the Star Pass gives you something. Take a look.", button: "Open the Star Pass" };
    case "can": {
      const e = Math.round(c.energy ?? 0);
      return e < 75
        ? { who: "The physio", icon: "🩺", title: "Your energy's low", line: `Two games in and you're at ${e}% energy. Here's a free can. Drink it.`, button: "Use the can" }
        : { who: "The physio", icon: "🩺", title: "A can for you", line: `Two games in and you're at ${e}% energy. Here's a free can. When your energy drops, one can tops it up.`, button: "Use the can" };
    }
    case "phone": return { who: mate, icon: "📱", title: "Have my old phone", line: "Here, take my old phone. The screen's cracked but it works. Your agent's already texted you.", button: "Open the phone" };
    case "shop": return { who: "The chairman", icon: "💷", title: "Wages are in", line: "Wages are in. The lads are off to the shop. Get yourself some cans and some boots.", button: "Go to the shop" };
    case "stats": return { who: gaffer, icon: "⚽", title: "Your first goal", line: "Your first goal is on your card. Your stats, records and achievements are open now.", button: "See your card" };
    case "sponsor": {
      const brand = c.brands?.offers[0]?.brand ?? "A brand";
      return { who: "Your agent", icon: "💼", title: "A brand wants you", line: `${brand} want to sponsor you. I've sent you the offer. It's in your messages.`, button: "Open the phone" };
    }
  }
}

function teamMateName(c: CareerState): string {
  const me = `${c.player.firstName} ${c.player.lastName}`;
  const mates = (c.squad ?? []).filter((p) => p.name !== me);
  const m = mates.length ? mates[3 % mates.length] : null;
  return m ? `${m.shortName || m.name}, your team-mate` : "A team-mate";
}

/** The lock line for a feature on the story order (null = use the usual one). */
export function storyLockHint(c: Pick<CareerState, "unlocks">, f: Feature): string | null {
  if (!isStory(c)) return null;
  const hints: Partial<Record<Feature, string>> = {
    training: "The gaffer wants a word after your first game",
    phone: "After your second game",
    relations: "After your second game",
    shop: "After your third game",
    stats: "Score your first goal",
    achievements: "Score your first goal",
  };
  return hints[f] ?? null;
}

/** Your agent's hello: the phone's first message on the story order. */
export function agentHello(c: Pick<CareerState, "unlocks" | "player">): string | null {
  if (!isStory(c) || !c.unlocks!.open.includes("phone")) return null;
  return `${c.player.firstName}, I'm your agent. I look after your contract and your sponsors. Keep playing well and the offers will come.`;
}
