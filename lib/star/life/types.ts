/**
 * THE LIVING WORLD — phase 1 types (Harry, 20 Nov 2026; design:
 * docs/plans/living-world-design-2026-11-20.md).
 *
 * Two halves:
 *  - THE BOOK: events as data (book/events.json), in the design's schema
 *    (part 1.1). Nothing about an event lives in code.
 *  - THE SAVE: `career.life` (LifeState), small and additive. Every person you
 *    meet keeps respect / bond / grudge (0-100) and up to 6 memory lines.
 *
 * Off in the real career (flag.ts) until Harry says; played on /star-life-dev.
 */

// ═══════════════════════ THE BOOK ═══════════════════════

export type LifeSize = "small" | "medium" | "big";
/** The 4 phase-1 templates (design 1.4). talk-scene is a still in phase 1. */
export type LifeTemplate = "phone-call" | "text-thread" | "feed-post" | "talk-scene";
/** When the director looks for an event. */
export type LifeMoment =
  | "after-match" | "arrive:training" | "home:evening" | "driving"
  | "walkout" | "season-end" | "leave:casino"
  | "followUp" | "social:drive" | "social:races";

export const LIFE_MOMENTS: LifeMoment[] = [
  "after-match", "arrive:training", "home:evening", "driving", "walkout", "season-end", "leave:casino",
  "followUp", "social:drive", "social:races",
];

/** A cast slot and the rule that fills it (cast.ts). */
export interface CastSlot {
  slot: string;
  /** "squad" (a team-mate, filtered by `where`, ordered by `order`), a role
   *  ("manager", "agent", "dad", "mum", "brother", "physio", "kitman",
   *  "tabloid", "broadsheet"), "stranger" (a one-off, never stored),
   *  "social" (the team-mate a social action is with), "memory" (whoever
   *  holds one of `tags`), "carried" (handed over by the event that set up
   *  this follow-up). */
  pick: "squad" | "manager" | "agent" | "dad" | "mum" | "brother" | "physio" | "kitman" | "tabloid" | "broadsheet" | "stranger" | "social" | "memory" | "carried";
  /** Person conditions (cond.ts), all must hold. */
  where?: string[];
  order?: "bond-desc" | "bond-asc" | "grudge-desc" | "random" | "youngest" | "best";
  tags?: string[];
  /** The event still fires without this slot (the hit piece's source). */
  optional?: boolean;
}

export interface LifeCost {
  /** Weeks of your own wage (money.ts reads the same income). */
  moneyWeeks?: number;
  /** One of the week's actions (week.ts). */
  weekAction?: number;
  energy?: number;
}

export interface LifeEffects {
  boss?: number; team?: number; fans?: number; fame?: number; reputation?: number;
  /** + paid to you, − taken: weeks of your own wage. */
  moneyWeeks?: number;
  energy?: number;
  matchFitness?: number;
  /** Marks the season as not clean (dilemmas.ts applyEffects). */
  scandal?: boolean;
  /** "car" takes your best car for good (Harry: "u'd lose whatever u wager"). */
  take?: "car";
  kibCans?: { basic?: number; premium?: number; elite?: number };
  /** A life flag (LifeState.flags) the book itself reads later, e.g. "duel:shirt". */
  flag?: string;
}

export interface NpcDelta { slot: string; respect?: number; bond?: number; grudge?: number }
export interface Remember { slot: string; tag: string; strength: 1 | 2 | 3 }
export interface FollowUp { event: string; afterWeeks: [number, number]; if?: string }

export interface LifeOutcome {
  /** Share of the time this outcome happens; the chances of a choice add up to 1. */
  chance?: number;
  /** Or a condition (cond.ts); the first true one wins, a plain one is the fallback. */
  if?: string;
  text: string;
  effects?: LifeEffects;
  npc?: NpcDelta[];
  remember?: Remember[];
  followUp?: FollowUp;
}

/** A phase-1 minigame, resolved on the spot (no new art): a skill check
 *  against a number, or your own horse in a race. */
export type LifeMinigame =
  | { kind: "skill-check"; stat: "pace" | "power" | "technique" | "vision" | "freeKick"; target: number }
  | { kind: "horse-race" };

export interface LifeChoice {
  id: string;
  label: string;
  requires?: string[];
  cost?: LifeCost;
  minigame?: LifeMinigame;
  outcomes: LifeOutcome[];
}

export interface LifeCallback {
  /** "slot:tag": whoever holds the tag. */
  ifMemory: string;
  /** "event:any" (any later event he is in), "event:<id>", "social:chat",
   *  "social:any", or a later phase's hook ("match:…", "negotiation", …) which
   *  is stored and shown on the People page but not played yet. */
  where: string;
  line: string;
}

export interface LifeEvent {
  id: string;
  title: string;
  category: string;
  place: string;
  size: LifeSize;
  rarity: "common" | "uncommon" | "rare" | "follow-up" | "social-action" | "callback";
  template: LifeTemplate;
  trigger: {
    when: LifeMoment[];
    requires?: string[];
    cooldownWeeks?: number;
    group?: string;
    once?: boolean;
    maxPerCareer?: number;
  };
  /** Paid once when the event opens (a social outing's ticket). */
  cost?: LifeCost;
  cast: CastSlot[];
  setup: string[];
  choices: LifeChoice[];
  callbacks: LifeCallback[];
}

export interface LifeChat {
  id: string;
  /** Person conditions (cond.ts) on the team-mate. */
  where?: string[];
  /** Career conditions. */
  when?: string[];
  lines: string[];
}

// ═══════════════════════ THE SAVE ═══════════════════════

/** One memory line: [tag, life week, strength 1-3]. */
export type LifeMemory = [string, number, 1 | 2 | 3];

/** One person: respect, bond, grudge (0-100) and up to 6 memories. */
export interface LifePerson {
  r: number; b: number; g: number;
  m: LifeMemory[];
  /** Life week he was first met (a new signing is one met lately). */
  s: number;
  /** A fall-out is counted against the team bar (people.ts); cleared on repair. */
  f?: 1;
  /** A team-mate's name, kept so a man who has left can still come back. */
  n?: string;
}

export interface LifePending {
  event: string;
  due: number;
  cast: Record<string, string>;
  if?: string;
}

export interface LifeLogRow { w: number; e: string; c: string; t: string }

export interface LifeState {
  v: 1;
  people: Record<string, LifePerson>;
  /** Things the whole dressing room saw. */
  squad: LifeMemory[];
  /** Things about you (paid off a photo). */
  self: LifeMemory[];
  /** Event id → the life weeks it fired. */
  fired: Record<string, number[]>;
  pending: LifePending[];
  groups: Record<string, number>;
  cats: Record<string, number>;
  /** This week's budget: [life week, events, medium-or-big events]. */
  wk: [number, number, number];
  lastBig: number;
  /** Social actions this week: [life week, {person: count}]. */
  soc: [number, Record<string, number>];
  flags: string[];
  /** Kept fraction of the team bar's moves from one person (a fifth each). */
  teamCarry: number;
  /** The last 12 things that happened (the People page's "Lately"). */
  log: LifeLogRow[];
}

export const PERSON_MEMORY_CAP = 6;
export const PEOPLE_CAP = 60;
