/**
 * THE FOOTBALL MEDIA ENGINE — every shape it passes around.
 *
 * The whole design turns on one rule: nothing downstream of `MatchRecord` ever
 * reads `CareerState`. A detector cannot reach into the career, a template
 * cannot reach into the league table. Each stage sees only what the stage before
 * it handed over, which is what makes any of this testable and what stops the
 * thing collapsing into one enormous function that knows everything.
 *
 * See ARCHITECTURE.md in this folder for the pipeline and the reasoning.
 */

// ── The seam ────────────────────────────────────────────────────────────────

/** Which scenario produced a goal. Mirrors ScenarioKind, plus two the engine
 *  produces without a scenario of their own. */
export type GoalKind =
  | "one_on_one" | "tight_angle" | "long_range" | "volley" | "header"
  | "penalty" | "free_kick" | "corner" | "cutback" | "byline_cross"
  | "through_ball" | "midfield_pass" | "buildup" | "rebound" | "solo";

export interface GoalRecord {
  minute: number;
  scorer: string;
  assist?: string;
  isUser: boolean;
  /** How it was struck. Absent on a career saved before this existed. */
  how?: GoalKind;
  /** Metres from the centre of the goal at the strike. */
  distance?: number;
  /** The score AFTER it went in, so opener/equaliser/winner is derivable. */
  scoreAfter?: { us: number; them: number };
}

export interface TableSnapshot {
  position: number;
  points: number;
  gd: number;
}

/**
 * Everything that happened, frozen.
 *
 * Built once at full time from the career on both sides of the match — "went
 * top of the table" is a comparison, and a record that only knows the after
 * cannot make it.
 */
export interface MatchRecord {
  /** "s3-w14-league". Deterministic, and the dedup key for the whole cycle. */
  id: string;
  season: number;
  week: number;
  competition: string;
  kind: "league" | "cup" | "europe" | "international";
  round?: string;
  derby: boolean;
  home: boolean;
  /** A final is played at neither ground. */
  neutral: boolean;

  club: string;
  opponent: string;
  clubStrength: number;
  opponentStrength: number;

  score: { us: number; them: number };
  result: "win" | "draw" | "loss";

  you: {
    name: string;
    shortName: string;
    goals: number;
    assists: number;
    rating: number;
    starMan: boolean;
    minutes: number;
    chances: number;
    passes: number;
    hooked: "form" | "legs" | "rested" | null;
    captain: boolean;
    squadNumber: number;
    position: string;
    /** After this match. */
    seasonGoals: number;
    seasonAssists: number;
    careerGoals: number;
    careerAssists: number;
    careerAppearances: number;
    clubAppearances: number;
  };

  goals: GoalRecord[];

  table: {
    before: TableSnapshot;
    after: TableSnapshot;
    /** Points behind the leader. Negative when you ARE the leader. */
    leaderGap: number;
    /** Points above the drop. */
    relegationGap: number;
    matchesLeft: number;
    clubs: number;
  };

  cup?: { advanced: boolean; eliminated: boolean; trophy: boolean };

  context: {
    managerName: string;
    conditions: string;
    fansStanding: number;
    fame: number;
    starRating: number;
    /** Whether the league title was mathematically settled by this result. */
    titleSettled?: boolean;
  };
}

/**
 * A career moment that is not a match: a transfer, an award, a sacking.
 *
 * It enters the pipeline in exactly the same place a match does, which is why
 * the Ballon d'Or generating a wave of congratulations costs one call rather
 * than a second engine.
 */
export interface CareerRecord {
  id: string;
  season: number;
  week: number;
  club: string;
  you: { name: string; shortName: string; position: string; squadNumber: number };
  context: { fame: number; starRating: number; fansStanding: number };
  moment:
    | { kind: "transfer"; from: string; to: string; fee: number }
    | { kind: "contract"; club: string; wage: number; seasons: number }
    | { kind: "award"; award: string; detail: string }
    | { kind: "ballon-dor"; won: boolean; total: number }
    | { kind: "manager-out"; name: string; incoming: string; reason: string }
    | { kind: "call-up"; nation: string; caps: number }
    | { kind: "captain"; club: string }
    | { kind: "testimonial"; club: string; season: number }
    | { kind: "retirement"; goals: number; apps: number; trophies: number }
    | { kind: "season-end"; position: number; headline: string; detail: string };
}

export type Record_ = MatchRecord | CareerRecord;

export function isMatchRecord(r: Record_): r is MatchRecord {
  return (r as MatchRecord).score !== undefined;
}

// ── Events ──────────────────────────────────────────────────────────────────

export type Tag =
  | "goal" | "assist" | "record" | "milestone" | "derby" | "cup" | "europe"
  | "table" | "title" | "relegation" | "transfer" | "contract" | "award"
  | "drama" | "shame" | "keeper" | "streak" | "form" | "debut" | "manager"
  | "international" | "trophy" | "stat" | "opinion" | "rumour";

export type Window = "instant" | "hour" | "evening" | "nextDay" | "weekly";

export type FactValue = string | number | boolean;
export type Facts = Record<string, FactValue>;

export interface Subject {
  kind: "you" | "club" | "teammate" | "opponent" | "league" | "rival" | "manager";
  name: string;
}

export interface FootballEvent {
  /** Stable id. Also the primary key templates are indexed by. */
  id: string;
  subject: Subject;
  facts: Facts;
  tags: Tag[];
  /** 0-100 before context is applied. `importance` is filled in by score(). */
  baseImportance: number;
  importance?: number;
  window: Window;
  /** Joins a running story. See memory.ts. */
  threadKey?: string;
  /** Filled in by memory.absorb() when a thread had something to add. */
  thread?: { key: string; facts: Facts; heat: number };
}

export type Detector = (r: MatchRecord, m: StoryMemory) => FootballEvent | FootballEvent[] | null;
export type CareerDetector = (r: CareerRecord, m: StoryMemory) => FootballEvent | FootballEvent[] | null;

// ── Memory ──────────────────────────────────────────────────────────────────

export interface MatchDigest {
  season: number;
  week: number;
  goals: number;
  assists: number;
  rating: number;
  result: "win" | "draw" | "loss";
  conceded: number;
  scored: number;
  opponent: string;
  competition: string;
}

export interface StoryThread {
  key: string;
  opened: { season: number; week: number };
  touched: { season: number; week: number };
  /** 0-100. Rises when reinforced, decays every week, closes below 20. */
  heat: number;
  facts: Facts;
}

export interface Streaks {
  scoring: number;
  assisting: number;
  unbeaten: number;
  winning: number;
  losing: number;
  cleanSheets: number;
  drought: number;
  scoringHome: number;
}

export interface StoryMemory {
  recent: MatchDigest[];
  streaks: Streaks;
  threads: StoryThread[];
  /** Template ids used lately, so the same line is not written twice. */
  saidRecently: string[];
  /** Every event id ever fired, with a count. Drives rarity weighting. */
  seen: Record<string, number>;
}

// ── Accounts ────────────────────────────────────────────────────────────────

export type Archetype =
  | "club" | "league" | "competition" | "broadsheet" | "tabloid" | "insider"
  | "stats" | "aggregator" | "pundit" | "fan" | "rivalFan" | "teammate" | "meme";

export type Platform = "x" | "instagram" | "youtube" | "tiktok" | "news";

export interface VoiceProfile {
  register: "formal" | "neutral" | "casual" | "raw";
  /** 0-1 chance of shouting the key phrase. */
  caps: number;
  /**
   * 0-1 chance of typing the whole thing in lower case.
   *
   * Separate from `register` because they came bundled and should not be: a
   * tabloid and a supporter are both "raw" and only one of them writes in lower
   * case. Tying the two together turned every back-page headline into
   * "arsenal 2-1 aston villa".
   */
  lowercase: number;
  emoji: number;
  hashtags: number;
  length: "short" | "medium" | "long";
  punctuation: "clean" | "loose" | "none";
  exclaim: number;
  firstPerson: boolean;
}

export interface MediaAccount {
  id: string;
  handle: string;
  name: string;
  archetype: Archetype;
  platform: Platform;
  verified: boolean;
  followers: number;
  /** Procedural avatar: two letters on a tint. No assets, no network. */
  avatar: { initials: string; tint: string };
  voice: VoiceProfile;
  interests: Partial<Record<Tag, number>>;
  /** polarity −1 means they enjoy your failures. */
  allegiance?: { club: string; polarity: 1 | -1 };
}

// ── Narration ───────────────────────────────────────────────────────────────

export type Frame =
  | "celebrate" | "analyse" | "question" | "mock" | "hype" | "report" | "joke" | "lament";

export interface Angle {
  lead: string;
  secondary?: string;
  sentiment: -1 | 0 | 1;
  frame: Frame;
  useThread: boolean;
}

// ── Graphics ────────────────────────────────────────────────────────────────

export interface GraphicRow { label: string; value: string; highlight?: boolean }
export interface GraphicTableRow { pos: number; name: string; played: number; gd: number; points: number }
export interface TotwSlot { name: string; position: string; note: string; isYou: boolean }

export type GraphicSpec =
  /**
   * A scoreline, with the goals under the team that scored them.
   *
   * Two lists rather than one, because a scorer belongs to a side: Liverpool are
   * on the right of "Forest 0-1 Liverpool", so "Isak 59'" goes on the right. It
   * used to be a single list printed under the left-hand team whoever had
   * scored, which reads as Forest having scored in a game they lost 0-1.
   *
   * `scorers` is the old single list. Kept, and read as the home side, because
   * posts are saved into the career and old ones still have to render.
   */
  | {
      type: "scoreline"; home: string; away: string; hs: number; as: number; competition: string;
      homeScorers?: string[]; awayScorers?: string[]; scorers?: string[];
    }
  | { type: "breaking"; strapline: string; headline: string }
  | { type: "playerCard"; name: string; number: number; position: string; rating: number; rows: GraphicRow[] }
  | { type: "statLine"; title: string; rows: GraphicRow[] }
  | { type: "tableSnippet"; rows: GraphicTableRow[]; highlight: string }
  | { type: "topScorers"; title: string; rows: GraphicRow[]; highlight: string }
  | { type: "teamOfTheWeek"; formation: string; players: TotwSlot[] }
  | { type: "hatTrick"; name: string; minutes: number[] }
  | { type: "transfer"; player: string; from: string; to: string; fee?: string }
  | { type: "trophy"; competition: string; club: string; season: number }
  | { type: "poll"; question: string; options: string[]; votes: number[] }
  | { type: "thumbnail"; title: string; badge: string };

export type GraphicKind = GraphicSpec["type"];

// ── Posts and the feed ──────────────────────────────────────────────────────

/**
 * A post as it is SAVED.
 *
 * The author is denormalised onto it deliberately. Storing an account id and
 * looking it up at render time is tidier right up until the player transfers,
 * at which point half the feed is written by accounts that no longer exist in
 * their world. And the text is stored rendered rather than as
 * (template, facts, seed): regenerating means that editing a template silently
 * rewrites history inside somebody's save. History should be history.
 */
export interface StoredPost {
  id: string;
  /** Virtual career clock: season*1e6 + week*1e4 + minutes. */
  at: number;
  author: {
    handle: string;
    name: string;
    archetype: Archetype;
    platform: Platform;
    verified: boolean;
    initials: string;
    tint: string;
  };
  text: string;
  graphic?: GraphicSpec;
  metrics: { likes: number; reposts: number; replies: number };
  eventId: string;
  tags: Tag[];
}

export interface Trend {
  label: string;
  volume: number;
  tag: Tag;
  hot: boolean;
}

export interface MediaState {
  posts: StoredPost[];
  memory: StoryMemory;
  trends: Trend[];
  /** The last cycle generated. A replayed match must not post twice. */
  lastCycleId: string;
  /**
   * The virtual clock the last cycle was stamped from.
   *
   * Needed because the career week ADVANCES the moment a match is credited, so
   * by the time the feed is shown, `career.week` is already the week after the
   * one the posts belong to. Staging the reveal off the career would make every
   * post instantly visible and quietly delete the news cycle.
   */
  lastCycleClock: number;
}

export interface MediaCycle {
  posts: StoredPost[];
  memory: StoryMemory;
  trends: Trend[];
}
