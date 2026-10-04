import type { CareerDivision } from "./calendar";

/**
 * THE XP BOOK — every amount of XP the game gives, in one place.
 *
 * Mikey, 3 Oct 2026: "create some sort of area … that's easy for me to add
 * different records and edit them and different awards and achievements and
 * milestones … so that we know what ones should be in the game, how much XP
 * they are, instead of me having to tell you every single time."
 *
 * DEFAULT_XP is what the code ships with. /admin/star-xp edits a copy, saved
 * to the shared `star_xp_config` row (lib/star/xpStore.ts); the game applies
 * it with setXpConfig. lib/star/starPoints.ts reads every amount through xp().
 *
 * The amounts are the XP at a ×1 competition; a match's XP is multiplied by
 * where it was played (mult). Trophies, awards and the rest are flat.
 */

export type ItemStatus = "unchecked" | "confirmed" | "change" | "idea";
export type AchievementTier = "easy" | "medium" | "hard";

/** Something in the game that gives XP, as the XP Book lists it. */
export interface XpNote {
  status?: ItemStatus;
  /** What to change, in Mikey's words. */
  note?: string;
}

/** A new achievement, record, award or milestone that isn't in the game yet. */
export interface XpIdea {
  id: string;
  kind: "achievement" | "record" | "award" | "milestone";
  name: string;
  /** How you get it, in plain words. */
  how: string;
  xp: number;
  status: ItemStatus;
}

export type MultKey =
  | CareerDivision
  | "champions_league" | "europa_league" | "conference_league" | "intl";

export interface XpConfig {
  match: {
    /** XP for each minute on the pitch. 90 minutes = 90 × this. */
    perMinute: number;
    win: number;
    draw: number;
    goal: number;
    assist: number;
    /** XP for each match-rating point above 6 (7.0 → 1×, 9.5 → 3.5×). */
    ratingPerPoint: number;
  };
  /** Competition multipliers. A domestic cup uses your league's. */
  mult: Record<MultKey, number>;
  /** Winning each trophy. Anything not listed pays otherTrophy. */
  trophies: Record<string, number>;
  otherTrophy: number;
  /** Going up without winning the league (2nd, 3rd or the play-offs): this
   *  share of what winning that league pays. */
  promotionShare: number;
  /** Individual awards by the division you won them in. */
  awards: Record<string, Partial<Record<CareerDivision, number>>>;
  ballon: { win: number; top3: number; top10: number };
  milestones: { firstCap: number; premierDebut: number };
  /** What each achievement tier pays, and which tier each achievement is in.
   *  A number in achievementXp overrides the tier for that one. */
  achievementTiers: Record<AchievementTier, number>;
  achievementTier: Record<string, AchievementTier>;
  achievementXp: Record<string, number>;
  /** Each record, by id. */
  records: Record<string, number>;
  /** Fame levels (best you've reached): fame needed → XP. */
  fame: [number, number][];
  trainingStar: number;
  clubOwner: number;
  topItem: number;
  island: number;
  president: number;
  /** Checks and notes on any item, keyed "achievement:<id>", "record:<id>",
   *  "trophy:<name>", "award:<name>", "match:<field>" and so on. */
  notes: Record<string, XpNote>;
  ideas: XpIdea[];
}

const DIVS_ALL: CareerDivision[] = [
  "national_league_north", "national_league_south", "national_league",
  "league_two", "league_one", "championship", "premier",
];
const byDiv = (north: number, nl: number, l2: number, l1: number, ch: number, pl: number) => ({
  national_league_north: north, national_league_south: north, national_league: nl,
  league_two: l2, league_one: l1, championship: ch, premier: pl,
});

export const DEFAULT_XP: XpConfig = {
  // Mikey, 3 Oct 2026: XP by the minute instead of play/start/sub; no
  // hat-trick bonus (the goals already pay); one rating bonus instead of
  // star man + "rating 8+", which paid twice for the same good game.
  match: { perMinute: 10, win: 360, draw: 120, goal: 1200, assist: 840, ratingPerPoint: 400 },
  mult: {
    national_league_north: 1, national_league_south: 1, national_league: 1.25,
    league_two: 1.5, league_one: 2, championship: 3, premier: 4,
    champions_league: 5, europa_league: 4, conference_league: 3, intl: 4,
  },
  trophies: {
    "National League North": 21_600, "National League South": 21_600,
    "National League": 30_000, "League Two": 42_000, "League One": 60_000,
    "Championship": 96_000, "Premier League": 240_000,
    "Community Shield": 18_000, "Super Cup": 65_000,
    "League Cup": 108_000, "Conference League": 108_000,
    "FA Cup": 144_000, "Europa League": 156_000, "Champions League": 360_000,
    "World Cup": 400_000, "European Championship": 300_000,
    "Play-Offs": 0, // the promotion it wins is paid by promotionShare
  },
  otherTrophy: 12_000,
  promotionShare: 0.8,
  awards: {
    "Player of the Month": byDiv(4_800, 6_000, 12_000, 18_000, 24_000, 30_000),
    "Golden Boot": byDiv(19_200, 24_000, 60_000, 96_000, 132_000, 180_000),
    "Player of the Season": byDiv(28_800, 36_000, 84_000, 132_000, 180_000, 240_000),
  },
  ballon: { win: 720_000, top3: 300_000, top10: 120_000 },
  milestones: { firstCap: 48_000, premierDebut: 6_000 },
  achievementTiers: { easy: 600, medium: 2_400, hard: 12_000 },
  achievementTier: {
    // first steps and first things
    "first-two-sessions": "easy", "first-game": "easy", "boss-meeting": "easy", "buy-phone": "easy",
    "first-match": "easy", "first-goal": "easy", "first-assist": "easy", "5-passes": "easy", "10-passes": "easy", "rich": "easy",
    // a good spell
    "hat-trick": "medium", "3-assists": "medium", "star-man": "medium", "10-goals": "medium",
    "boss-90": "medium", "team-90": "medium", "fans-90": "medium", "star-4": "medium", "loaded": "medium",
    "trophy-cabinet": "medium", "european-nights": "medium", "first-cap": "medium", "international-goal": "medium",
    // a career's worth
    "50-goals": "hard", "100-goals": "hard", "star-5": "hard", "ballon-dor": "hard",
    "max-technique": "hard", "max-pace": "hard", "max-power": "hard", "max-vision": "hard", "max-fk": "hard",
    "cup-winner": "hard", "champions-of-europe": "hard", "fifty-caps": "hard",
    "world-champion": "hard", "continental-champion": "hard", "the-treble": "hard",
  },
  // Signing comes with starting a career, so it earns nothing.
  achievementXp: { "first-contract": 0 },
  records: {
    "pl-assists-season": 300_000, "pl-goals-season": 300_000, "pl-goals-match": 300_000,
    "pl-goals-career": 300_000, "pl-appearances-career": 300_000,
  },
  fame: [[25, 9_000], [40, 24_000], [60, 120_000], [80, 300_000]],
  trainingStar: 360,
  clubOwner: 180_000,
  topItem: 36_000,
  island: 120_000,
  president: 360_000,
  notes: {},
  ideas: [],
};

let current: XpConfig = DEFAULT_XP;

/** The XP amounts in use right now. */
export function xp(): XpConfig {
  return current;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

/** Numbers only, never negative; anything missing or broken keeps the default. */
function mergeNums<T extends Record<string, unknown>>(base: T, over: unknown): T {
  if (!over || typeof over !== "object") return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (isNum(v)) out[k] = v;
    else if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
      out[k] = mergeNums(base[k] as Record<string, unknown>, v);
    }
  }
  return out as T;
}

/** A saved XP Book on top of the defaults. New defaults (a record added in
 *  code) show up even when the saved copy is older. */
export function mergeXpConfig(saved: unknown): XpConfig {
  if (!saved || typeof saved !== "object") return DEFAULT_XP;
  const s = saved as Partial<XpConfig>;
  const tiers = new Set<AchievementTier>(["easy", "medium", "hard"]);
  const tierMap: Record<string, AchievementTier> = { ...DEFAULT_XP.achievementTier };
  for (const [k, v] of Object.entries(s.achievementTier ?? {})) if (tiers.has(v as AchievementTier)) tierMap[k] = v as AchievementTier;
  const fame = Array.isArray(s.fame) && s.fame.every(p => Array.isArray(p) && isNum(p[0]) && isNum(p[1]))
    ? (s.fame as [number, number][]).slice().sort((a, b) => a[0] - b[0])
    : DEFAULT_XP.fame;
  const awards: XpConfig["awards"] = {};
  for (const [k, row] of Object.entries({ ...DEFAULT_XP.awards, ...(s.awards ?? {}) })) {
    awards[k] = mergeNums((DEFAULT_XP.awards[k] ?? {}) as Record<string, number>, row);
  }
  return {
    match: mergeNums(DEFAULT_XP.match, s.match),
    mult: mergeNums(DEFAULT_XP.mult, s.mult),
    trophies: mergeNums(DEFAULT_XP.trophies, s.trophies),
    otherTrophy: isNum(s.otherTrophy) ? s.otherTrophy : DEFAULT_XP.otherTrophy,
    promotionShare: isNum(s.promotionShare) ? Math.min(1, s.promotionShare) : DEFAULT_XP.promotionShare,
    awards,
    ballon: mergeNums(DEFAULT_XP.ballon, s.ballon),
    milestones: mergeNums(DEFAULT_XP.milestones, s.milestones),
    achievementTiers: mergeNums(DEFAULT_XP.achievementTiers, s.achievementTiers),
    achievementTier: tierMap,
    achievementXp: mergeNums(DEFAULT_XP.achievementXp, s.achievementXp),
    records: mergeNums(DEFAULT_XP.records, s.records),
    fame,
    trainingStar: isNum(s.trainingStar) ? s.trainingStar : DEFAULT_XP.trainingStar,
    clubOwner: isNum(s.clubOwner) ? s.clubOwner : DEFAULT_XP.clubOwner,
    topItem: isNum(s.topItem) ? s.topItem : DEFAULT_XP.topItem,
    island: isNum(s.island) ? s.island : DEFAULT_XP.island,
    president: isNum(s.president) ? s.president : DEFAULT_XP.president,
    notes: s.notes && typeof s.notes === "object" ? s.notes as Record<string, XpNote> : {},
    ideas: Array.isArray(s.ideas) ? s.ideas.filter(i => i && typeof i.id === "string" && typeof i.name === "string") : [],
  };
}

/** Use a saved XP Book from now on (or the defaults, with null). */
export function setXpConfig(saved: unknown | null): void {
  current = saved ? mergeXpConfig(saved) : DEFAULT_XP;
}

/** What one achievement pays. */
export function achievementXp(id: string, cfg: XpConfig = current): number {
  if (id in cfg.achievementXp) return cfg.achievementXp[id];
  return cfg.achievementTiers[cfg.achievementTier[id] ?? "medium"];
}

export const ALL_DIVISIONS = DIVS_ALL;
