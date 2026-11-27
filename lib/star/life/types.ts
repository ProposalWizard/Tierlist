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
  pick: "squad" | "manager" | "agent" | "dad" | "mum" | "brother" | "physio" | "kitman" | "tabloid" | "broadsheet" | "stranger" | "social" | "memory" | "carried"
    // Story arcs (Events v2 batch 1): people around the club and your life, each one id per career (people.ts).
    | "groundsman" | "canteen" | "chairman" | "coach" | "partner" | "sister" | "pal" | "fan" | "kidfan" | "reporter" | "neighbour" | "rival" | "legend" | "sponsor" | "referee";
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

/** How an answer sounds (decision screens, Harry 20 Nov 2026 15:35). The
 *  tone dial reads only humble / calm / confident / fiery; the Telltale lines
 *  may use any of them as their tag. */
export type LifeTone = "humble" | "calm" | "confident" | "fiery" | "honest" | "lie" | "kind" | "cold" | "brave" | "reckless";
/** Which screen asks the question: Telltale (the other person or the world
 *  forces the moment: slow-mo, a clock, silence is an answer), the football
 *  tone dial (press, mixed zone, training talks, dilemmas) or the plain card. */
export type LifeScreen = "telltale" | "dial" | "card";

export interface LifeChoice {
  id: string;
  label: string;
  /** The tone tag shown on the answer (Telltale) or its place on the dial. */
  tone?: LifeTone;
  /** "… Say nothing" / "… No comment": a real answer, and the one the clock
   *  picks when it runs out. At most one per event. */
  silent?: boolean;
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
  /** Which decision screen asks it (decision.ts screenFor; default "card"). */
  screen?: LifeScreen;
  /** The cast slot whose line it is (the one who stays in colour; default the first). */
  speaker?: string;
  /** Telltale only: seconds on the clock at Normal (default 8). */
  clockSeconds?: number;
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
  /** 1 = phase 1; 2 = the v2 fields below may be present (migrate.ts). */
  v: 1 | 2;
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
  /** When each team-mate joined (life week; 0 = there when the life block
   *  started), so "a new signing" means new to the club, not new to you. */
  roster?: Record<string, number>;
  /** Your voice this season (decision screens): [season, humble, calm, confident, fiery, said nothing]. */
  voice?: [number, number, number, number, number, number];
  /** A role's person pinned for this career (pool.ts): role → pool id. Only set when a save
   *  must keep someone the seed would not pick (an old save's Den). */
  pool?: Record<string, string>;
  // ── Events v2 (arcs, promises, objectives; lib/star/life/arcs.ts). All optional. ──
  /** Stories in progress (and finished ones not packed yet), by arc id. */
  arcs?: Record<string, ArcRun>;
  /** Finished stories, packed small (arcPack.ts): one short word each, joined by spaces, e.g.
   *  "k3f9q11b.7" = story code, ending code, start week, beats played. Read them with arcsOf. */
  fin?: string;
  /** Promises and debts: up to 6 open, the last 20 kept or broken. */
  promises?: PromiseRun[];
  /** Match objectives a talk set (at most 2). */
  objs?: ObjectiveRun[];
  /** Things a story gave you ("item:dens-ball-bag", "garden:hundred-balls-corner"). */
  got?: string[];
  /** Notices waiting to be shown once (a promise kept or broken, a reminder text). */
  notes?: ArcNotice[];
}

export const PERSON_MEMORY_CAP = 6;
export const PEOPLE_CAP = 60;

// ═══════════════════════ EVENTS V2 (docs/plans/living-world-events-v2-2026-11-20.md) ═══════════════════════

/** A value an arc keeps between beats (who won, your best, the path you took). */
export type ArcVar = number | string;

/** One reply in a talk. Goes to another node, or ends the talk. */
export interface TalkReply {
  id: string;
  label: string;
  tone?: LifeTone;
  silent?: boolean;
  requires?: string[];
  goto?: string;
  end?: string;
  /** The talk's running mood: how he is taking you. */
  mood?: number;
  /** A note for later in this same talk ("snapped"). */
  set?: string[];
  /** Values the arc keeps. */
  var?: Record<string, ArcVar>;
  /** Makes this promise (an id in the arc's promises). */
  promise?: string;
  cost?: LifeCost;
}

/** A value that depends on the arc: {"if": cond, "then": a, "else": b}. */
export interface IfValue { if: string; then: string; else: string }

/** A reply that opens a real game mode (activity.ts). */
export interface LifeActivity {
  /** "challenge": a list of rounds from the round library (drill.ts), any story; "strike-drill" is
   *  Den's hundred (the same screen with his six rounds). */
  mode: "strike-drill" | "crossbar" | "feed-drill" | "challenge";
  name: string;
  intro?: string;
  dials: {
    balls?: number; shots?: number; from?: string | IfValue; keeper?: boolean;
    targets?: ("bottom-left" | "bottom-right" | "bar")[]; light?: string; feed?: string;
    opponent?: { slot: string; else?: string }; shooter?: { slot: string };
    /** challenge: the rounds, in order (drill.ts RoundSpec: kind, balls, name, line, calls). */
    rounds?: { kind: string; balls?: number; name?: string; line?: string; calls?: string[]; voices?: (string | null)[] }[];
    /** challenge: who goes in goal for a keeper or double round (a cast slot; default the caller). */
    keeperSlot?: string;
    /** challenge: the story's own reaction lines (drill.ts ReactionLines: "hit", "saved",
     *  "keeper:saved", "streak3", "double:miss"…; {name} = who is in goal, {age} = the caller's age). */
    lines?: Record<string, string>;
  };
  score: string;
  /** Show the arc's best during it (an arc var name). */
  showBest?: string;
  /** Ten out of ten (the door). */
  target?: number;
  caller?: { slot: string; lines?: string[]; useLinesOf?: string };
  cost?: LifeCost;
  canAbandon: boolean;
  /** For a device that cannot run the mode: a skill check, shown as a roll. */
  fallback: { kind: "skill-check"; stat: "pace" | "power" | "technique" | "vision" | "freeKick"; target: number } | null;
}

export interface TalkNode {
  who?: string;
  /** This node on a different screen (the speech at Den's night: the dial). */
  screen?: LifeScreen;
  say?: string[];
  replies?: TalkReply[];
  activity?: LifeActivity;
  /** [condition, node]: the first that holds; "" is the fallback. */
  result?: [string, string][];
}

/** A v2 outcome: a v1 outcome plus what it does to the story. */
export interface ArcOutcome extends LifeOutcome {
  arc?: {
    set?: Record<string, ArcVar>;
    add?: Record<string, number>;
    next?: string;
    /** Weeks until `next` is due (default 0). */
    afterWeeks?: [number, number];
    end?: string;
    retry?: string;
    reopen?: string;
    check?: string;
  };
  promise?: string;
  promiseBroken?: string[];
  objective?: { id: string; text: string; window: { matches: number }; met: string; onMet: string; onMiss: string; /** Who set it and why, for the card (default: the kit man arc's words). */ why?: string };
  give?: string;
  /** What a `give` is called and does, for the card ([name, line]); the kit man's bag has its own. */
  giveWords?: [string, string];
  unlock?: string;
  noteSquad?: string;
  train?: Partial<Record<"pace" | "power" | "technique" | "vision", number>>;
  startArc?: { id: string; with: Record<string, string> };
}

export interface LifeTalk {
  start: string | IfValue;
  nodes: Record<string, TalkNode>;
  ends: Record<string, ArcOutcome[]>;
}

export interface ArcEntry {
  /** offer: a gold bubble on his round menu, gone when the week turns.
   *  standing: a bubble while the beat is open. invite: a text with three answers. */
  kind: "offer" | "standing" | "invite";
  on?: string;
  from?: string;
  bubble?: string;
  icon?: string;
  hint?: string;
  lastsDays?: number;
  /** The ending played if the offer runs out. */
  ifIgnored?: string | null;
  text?: string;
  /** invite: the three answers' labels. */
  labels?: Record<string, string>;
  choices?: string[];
  cost?: LifeCost;
  clash?: { if: string; cost: LifeCost; line: string };
}

/** A beat's event: a LifeEvent with a talk (or plain choices for a card). */
export interface ArcEvent extends Omit<LifeEvent, "choices"> {
  choices: (Omit<LifeChoice, "outcomes"> & { outcomes: ArcOutcome[] })[];
  talk?: LifeTalk;
  entry?: ArcEntry;
  variants?: { if: string; template?: LifeTemplate; place?: string; setupSwap?: string }[];
}

export interface ArcBeat {
  id: string;
  title: string;
  /** The quest log's line for this beat while it is the next thing (BotW's quest log). */
  hint: string;
  after?: { beat?: string; weeks?: [number, number]; seasons?: [number, number]; objective?: string; clock?: string };
  requires?: string[];
  repeat?: { everyWeeks: number; max: number };
  /** The card's picture: a chip, a big emoji or number, a paper note. */
  look?: { chip?: string; art?: string; big?: string; bigSub?: string; note?: { line: number; sign?: string; foot?: string } };
  /** Its number on the main line ("Beat 3 of 7"); none for a side beat. */
  n?: number;
  event: ArcEvent;
}

export interface ArcPromiseDef {
  id: string;
  to: string;
  text: string;
  /** weeks: due that many weeks after it is made. beat: due when that beat plays. */
  due: { weeks?: [number, number]; beat?: string };
  /** What keeps it: that beat played (reached its game) or ended one of these ways. */
  keptBy: { beat: string; played?: boolean; ends?: string[] };
  /** Said in the phone list: when it is due, in words. */
  dueText: string;
  /** A text a week before a week-based deadline. */
  remind?: string;
  kept?: ArcOutcome;
  broken?: ArcOutcome;
}

export interface LifeArc {
  id: string;
  /** Its short code in the save (arcPack.ts), 4 letters or digits. Leave it out: the code is made
   *  from the id. Set it only when the checker says two stories' codes clash; never change it later. */
  code?: string;
  title: string;
  owner: string;
  summary: string;
  /** small (one talk + a callback), medium (3-4 beats, a promise), big (5-7 beats across seasons, a game). */
  size?: LifeSize;
  /** Who it is about and how it feels (the writers' spread; the quest log does not read it). */
  about?: { who: string[]; tone: string[] };
  /** How often it starts when its first beat could (0-1, a seeded roll). No `start` = always (the kit man). */
  start?: {
    chance: number;
    /** Share of careers that ever meet this story (0-1), rolled once per career from the player's
     *  name (story batch 2). The save keeps every finished story, so one career cannot meet all of
     *  them; this spreads the book across careers. No `careers` = every career can. */
    careers?: number;
  };
  /** A game mode this story needs that the activity host cannot mount yet. Such a story is
   *  checked but never plays (arcBook.ts WAITING_ARCS) until the mode is built. */
  needsActivity?: string;
  cast: CastSlot[];
  vars: Record<string, ArcVar>;
  clocks: { id: string; label: string; segments: number; tick: { on: "season-end"; by: number }[]; startsAt: string; onFull: string }[];
  ends: { id: string; title: string; text: string }[];
  promises: Record<string, ArcPromiseDef>;
  beats: ArcBeat[];
}

/** One story in the save (small on purpose: ids, weeks, a few values). */
export interface ArcRun {
  /** Life week it started. */
  at: number;
  /** The club you were at when it started. */
  club: string;
  cast: Record<string, string>;
  v: Record<string, ArcVar>;
  /** Clock id → segments filled. */
  k: Record<string, number>;
  /** Beat id → life weeks it played. */
  f: Record<string, number[]>;
  /** Beat id → the life week it is due (set by an ending's `next`, an objective). */
  s: Record<string, number>;
  /** An open offer: [beat, person id, life week it goes]. */
  o?: [string, string, number];
  /** How it ended (an arc end id); a later beat can still change it. */
  done?: string;
  /** The last beat that played. */
  last?: string;
}

export interface PromiseRun {
  id: string;
  arc: string;
  to: string;
  /** What your phone shows, filled in when made. */
  text: string;
  made: number;
  /** Life week it is due by, or -1 when it is due at a beat. */
  due: number;
  st: "open" | "kept" | "broken";
  end?: number;
  /** A reminder was sent. */
  r?: 1;
}

export interface ObjectiveRun { id: string; arc: string; text: string; left: number; met: string; onMet: string; onMiss: string; made: number }

export interface ArcNotice { kind: "kept" | "broken" | "remind" | "ignored" | "objective"; arc: string; title: string; text: string; who?: string; w: number; changes?: { kind: "bar" | "money" | "energy" | "person" | "memory" | "item" | "team-rule" | "later"; label: string; delta?: number }[] }
