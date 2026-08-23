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
  /**
   * How much this fixture is rated as a rivalry, independent of derby-ness —
   * a plain derby with no rated history (Chelsea-Fulham) carries `derby:
   * true` and no tier; Liverpool-Manchester United carries a tier and is not
   * geographically a derby at all. Absent when there is no rivalry either
   * way. See lib/star/rivalries.ts.
   */
  rivalryTier?: "R1" | "R2" | "R3";
  /** The name this fixture actually goes by, when it has one — "North London
   *  Derby", "Roses rivalry". Absent for most rivalries; most do not have one. */
  derbyName?: string;
  home: boolean;
  /** A final is played at neither ground. */
  neutral: boolean;

  club: string;
  opponent: string;
  clubStrength: number;
  opponentStrength: number;

  score: { us: number; them: number };
  result: "win" | "draw" | "loss";

  /**
   * Where you stand in this month's Player of the Month race, and how much of
   * the month is left.
   *
   * On the record rather than looked up by a detector, because a detector is
   * handed the match and the memory and never the career — and the race is a
   * fact about the league table's own record of the month, not about the
   * ninety minutes. Absent outside the league, where there is no award.
   */
  potmRace?: {
    /**
     * 0-9, August first — the index `monthCandidates` files results under.
     *
     * Here rather than recomputed downstream, and that is the whole point. The
     * graphic used to work it out again from `record.week`, which is the CAREER
     * week and drifts from the fixture week the moment a cup tie is played:
     * at league week 7 the career was on week 9, so the card asked for the
     * wrong month, got no contenders, and silently refused to render.
     */
    month: number;
    monthName: string;
    /** 1-based. Absent when you have not scored or made one all month. */
    place?: number;
    contenders: number;
    goals: number;
    assists: number;
    /** True on the last league week of the month — the vote runs after it. */
    decidesToday: boolean;
    /**
     * True on the league week BEFORE that one.
     *
     * Which is when the shortlist card goes out, and the distinction matters
     * more than it looks. The vote runs the moment the last round of a month is
     * played, so on `decidesToday` the award already exists — a "here are the
     * nominees" card published then is asking a question that has been answered.
     * The month reads as it does in life instead: the race through the month,
     * the shortlist with a round to go, the winner when it is done.
     */
    decidesNextWeek: boolean;
    leader: string;
  };

  /**
   * The month's award, on the match whose result decided it.
   *
   * Set by comparing the career either side of the match — the award is made
   * inside `creditMatchResult`, so `after` has one `before` does not. Absent on
   * every other match, which is all but ten a season.
   */
  potmAward?: {
    monthName: string;
    winner: string;
    club: string;
    goals: number;
    assists: number;
    isYou: boolean;
    /** The shortlist it came from, winner first. */
    nominees: { name: string; club: string; goals: number; assists: number; isYou: boolean }[];
    /** Where you finished, when you were on it. */
    yourPlace?: number;
  };
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

/**
 * What an account's avatar actually draws.
 *
 * One per kind of voice, so a feed reads as a crowd of different outlets at a
 * glance rather than a column of monograms. `crest` keeps the initials but
 * puts them on a shield in the club's own kit colours — a club badge is
 * lettering, so that one is right to keep letters.
 */
export type AvatarGlyph =
  | "crest" | "trophy" | "ball" | "newspaper" | "megaphone"
  | "chart" | "scoop" | "play" | "mic" | "scarf" | "shirt" | "grin"
  | "cup" | "flag" | "quote" | "grid" | "drum" | "boot";

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
  /**
   * Procedural avatar. No assets, no network — everything here is drawn.
   *
   * It used to be two letters on a flat tint for all forty accounts, which
   * made a feed of forty different voices look like one spreadsheet.
   * Reported as exactly that: "every account's profile picture is just the
   * initials of their name which is very boring."
   *
   * `glyph` names a shape the renderer draws instead of the letters — a
   * trophy for a competition, a microphone for a pundit, a scarf for a
   * supporter. `tint2` makes the disc a gradient rather than a block, and for
   * a club account both tints are that club's ACTUAL kit colours, so its
   * badge is recognisably theirs.
   */
  avatar: { initials: string; tint: string; tint2?: string; glyph?: AvatarGlyph };
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
  /**
   * `context` is what the numbers are FROM — "v Crystal Palace (H)".
   *
   * Without it a card is a bare number under a name, and the post above it is
   * usually about a run: "Mikey Vass has 4 assists in his last 4" over a card
   * reading "Assists 3" looks like the graphic disagreeing with the sentence.
   * It does not — the sentence is the run and the card is today — but nothing
   * on screen said so. Absent on a career moment, which has no match to be from.
   */
  | { type: "playerCard"; name: string; number: number; position: string; rating: number; rows: GraphicRow[]; context?: string }
  | { type: "statLine"; title: string; rows: GraphicRow[]; context?: string }
  | { type: "tableSnippet"; rows: GraphicTableRow[]; highlight: string }
  | { type: "topScorers"; title: string; rows: GraphicRow[]; highlight: string }
  | { type: "teamOfTheWeek"; formation: string; players: TotwSlot[] }
  | { type: "hatTrick"; name: string; minutes: number[] }
  | { type: "transfer"; player: string; from: string; to: string; fee?: string }
  | { type: "trophy"; competition: string; club: string; season: number }
  | { type: "poll"; question: string; options: string[]; votes: number[] }
  | { type: "thumbnail"; title: string; badge: string }
  /**
   * The month's shortlist, before anybody has voted.
   *
   * Eight names in a grid, which is the shape the award has actually had for
   * years — a shortlist is a different piece of information from a race, and the
   * race already has a card. `st-potm-race` runs through the month and is a
   * number; this goes out once, on the last round, and is a list of people.
   *
   * `winner` is deliberately optional and unset by anything today: the shortlist
   * is published before the vote. It exists so the same card can be reissued
   * with the result on it without a second component that looks almost the same.
   */
  | {
      type: "potmNominees";
      month: string;
      nominees: PotmNominee[];
      winner?: string;
    }
  /**
   * One man, once a month.
   *
   * A different card from the shortlist rather than the shortlist with a ring
   * round somebody, because it is a different piece of news and it is the only
   * graphic in this file whose subject is one person — so it is the only one
   * that can afford to give him the whole frame.
   */
  | {
      type: "potmWinner";
      month: string;
      /** Split, because the card sets them at different sizes. */
      firstName: string;
      lastName: string;
      club: string;
      goals: number;
      assists: number;
      isYou: boolean;
      face?: string;
      number?: number;
      /** See PotmNominee.own. */
      own?: boolean;
      /** Where you came, when the winner was somebody else and you were on it. */
      yourPlace?: number;
    };

export interface PotmNominee {
  name: string;
  club: string;
  goals: number;
  assists: number;
  isYou: boolean;
  /** His portrait, when the database has one for him. */
  face?: string;
  /**
   * Your squad number, and only ever yours.
   *
   * You are the one footballer in the division the database has no photograph
   * of — you were invented at the start of the career. Unless you took one (see
   * `own`), the tile shows the back of your shirt instead of a face: the club's
   * colours, the number you actually wear. It is the one thing on a pitch that
   * identifies a player without showing him.
   */
  number?: number;
  /**
   * This face is a photograph you supplied, not a database cut-out.
   *
   * It changes how it is drawn, and it has to. The cut-outs are busts on
   * transparent, so they are contained and stood on the bottom edge; a
   * photograph has a room behind it and is covered and centred, then put through
   * the club duotone so the background reads as texture rather than as the one
   * tile somebody pasted in.
   */
  own?: boolean;
}

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
    /**
     * Both optional, because a post saved before avatars had either still has
     * to render: the card falls back to initials on a flat tint, exactly as it
     * used to. See components/star/media/Avatar.
     */
    tint2?: string;
    glyph?: AvatarGlyph;
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
