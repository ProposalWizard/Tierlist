import { shuffle } from "@/lib/shuffle";
import type { PoolCandidate, RoundOptions } from "@/lib/americanDraft";
import { countMatching, eligibleIdentities, fetchCustomRoundPlayers } from "@/lib/americanDraft";
import type { AmPlayer } from "@/lib/americanDraft";
import { attributesFromJson } from "@/lib/playerAttributes";
import { fetchAllRows } from "@/lib/fetchAllRows";

/**
 * CHALLENGE DRAFT
 *
 * Fourteen rounds of ten cards, same as the American draft — but a round is not
 * a formation slot. Each one is a randomly generated BRIEF: a rating band, a
 * nationality, a minimum stat, a club, an era, an age bracket, a position
 * group. You draft whoever the brief throws up and work out the formation
 * afterwards, which is the whole game: the squad is a consequence of fourteen
 * constraints rather than a plan.
 *
 * Premier League only, like every other draft mode here.
 */

export type BriefKind =
  | "rating" | "stat" | "nation" | "position" | "club" | "era" | "age" | "wildcard";

export interface Brief {
  /** Stable id so a client can send a brief back without us trusting its rule. */
  id: string;
  kind: BriefKind;
  /** Short headline, e.g. "88 – 92 RATED". */
  title: string;
  /** One line of flavour explaining the constraint. */
  detail: string;
  /** Serialisable parameters — the rule is rebuilt from these server-side. */
  params: Record<string, string | number>;
}

/** The stat briefs can ask for, mapped to the resolved attribute key. */
const STAT_KEYS = {
  pace: "Pace",
  shooting: "Shooting",
  passing: "Passing",
  dribbling: "Dribbling",
  defending: "Defending",
  physical: "Physicality",
} as const;
export type StatKey = keyof typeof STAT_KEYS;

/**
 * Stat briefs only consider players at or above this rating.
 *
 * Two reasons, one practical and one about how the mode feels. Practically,
 * attributes live in a fat JSONB column that the cached pool deliberately does
 * not carry, so they have to be fetched separately — bounding that to the
 * draftable end of the pool keeps it to one modest query instead of pulling
 * megabytes for players nobody would pick. And a "92+ PACE" round is supposed
 * to offer flying wingers, not a 54-rated reserve who happens to be quick.
 */
export const STAT_BRIEF_MIN_OVERALL = 74;

/** A brief must be able to offer a full board, or it is not worth playing. */
export const MIN_BRIEF_POOL = 10;
/** How many rounds a challenge draft runs for: 11 starters + 3 subs. */
export const CHALLENGE_ROUNDS = 14;

// ── Brief vocabulary ────────────────────────────────────────────────────────

const NATIONS = [
  "England", "France", "Brazil", "Spain", "Argentina", "Portugal", "Netherlands",
  "Germany", "Italy", "Belgium", "Ivory Coast", "Senegal", "Nigeria", "Ghana",
  "Republic of Ireland", "Scotland", "Wales", "Denmark", "Sweden", "Norway",
  "Uruguay", "Colombia", "Serbia", "Croatia", "Poland", "Japan", "Korea Republic",
  "Australia", "United States", "Mexico", "Morocco", "Algeria", "Egypt", "Cameroon",
];

const CLUBS = [
  "Manchester United", "Manchester City", "Liverpool", "Chelsea", "Arsenal",
  "Tottenham Hotspur", "Everton", "Newcastle United", "Aston Villa", "West Ham United",
  "Leicester City", "Southampton", "Fulham", "Crystal Palace", "Wolverhampton Wanderers",
  "Brighton & Hove Albion", "Leeds United", "Sunderland", "Blackburn Rovers", "Bolton Wanderers",
];

const POSITION_GROUPS: { key: string; title: string; detail: string; parts: string[] }[] = [
  { key: "gk",     title: "KEEPERS ONLY",    detail: "Goalkeepers and nothing else.",            parts: ["GK"] },
  { key: "cb",     title: "CENTRE BACKS",    detail: "Only centre halves on the board.",         parts: ["CB"] },
  { key: "fb",     title: "FULL BACKS",      detail: "Right and left backs, wing backs included.", parts: ["RB", "LB", "RWB", "LWB"] },
  { key: "mid",    title: "MIDFIELDERS",     detail: "Anyone who lives in the middle third.",     parts: ["CDM", "CM", "CAM"] },
  { key: "wide",   title: "WIDE PLAYERS",    detail: "Wingers and wide midfielders.",            parts: ["RW", "LW", "RM", "LM"] },
  { key: "att",    title: "FORWARDS",        detail: "Strikers and centre forwards.",            parts: ["ST", "CF"] },
];

const ERAS: { key: string; title: string; detail: string; from: number; to: number }[] = [
  { key: "late2000s", title: "2006 – 2010",  detail: "The late-2000s Premier League.",        from: 2007, to: 2010 },
  { key: "early2010s", title: "2010 – 2014", detail: "The early 2010s.",                      from: 2011, to: 2014 },
  { key: "mid2010s",  title: "2014 – 2018",  detail: "The mid-2010s.",                        from: 2015, to: 2018 },
  { key: "late2010s", title: "2018 – 2022",  detail: "The late 2010s into the twenties.",     from: 2019, to: 2022 },
  { key: "modern",    title: "2022 – NOW",   detail: "The modern game.",                      from: 2023, to: 2026 },
];

const RATING_BANDS: { min: number; max: number; detail: string }[] = [
  { min: 88, max: 99, detail: "The very best the league has seen." },
  { min: 85, max: 89, detail: "Genuine stars." },
  { min: 82, max: 87, detail: "Top-four quality." },
  { min: 79, max: 84, detail: "Reliable first-team players." },
  { min: 76, max: 81, detail: "Solid mid-table starters." },
  { min: 72, max: 78, detail: "Squad men and scrappers." },
  { min: 68, max: 74, detail: "Rough around the edges." },
];

const STAT_BRIEFS: { stat: StatKey; min: number; detail: string }[] = [
  { stat: "pace",      min: 90, detail: "Genuinely frightening speed." },
  { stat: "pace",      min: 86, detail: "Quick enough to run in behind." },
  { stat: "shooting",  min: 85, detail: "Players who punish you." },
  { stat: "shooting",  min: 80, detail: "A real goal threat." },
  { stat: "passing",   min: 84, detail: "Range and vision." },
  { stat: "passing",   min: 79, detail: "Comfortable in possession." },
  { stat: "dribbling", min: 86, detail: "Take-on merchants." },
  { stat: "dribbling", min: 81, detail: "Tight control in traffic." },
  { stat: "defending", min: 84, detail: "Proper defenders." },
  { stat: "defending", min: 78, detail: "They can actually defend." },
  { stat: "physical",  min: 85, detail: "Immovable." },
  { stat: "physical",  min: 80, detail: "Wins his duels." },
];

const AGE_BRIEFS: { key: string; title: string; detail: string; min: number; max: number }[] = [
  { key: "wonderkids", title: "UNDER 21",  detail: "Kids only. Potential over polish.", min: 15, max: 21 },
  { key: "prime",      title: "AGED 24-28", detail: "Peak years.",                       min: 24, max: 28 },
  { key: "veterans",   title: "OVER 32",   detail: "Old heads. Legs optional.",          min: 33, max: 45 },
];

// ── Building briefs ─────────────────────────────────────────────────────────

const positionsOf = (c: PoolCandidate) =>
  (c.positions || "").toUpperCase().split(",").map(s => s.trim()).filter(Boolean);

/** The rule for a brief, rebuilt from its params — never trusted from a client. */
export function briefMatcher(brief: Brief): (c: PoolCandidate) => boolean {
  const p = brief.params;
  switch (brief.kind) {
    case "rating":
      return c => c.ovr >= Number(p.min) && c.ovr <= Number(p.max);
    case "nation": {
      const want = String(p.nation).toLowerCase();
      return c => c.nationality.toLowerCase() === want;
    }
    case "club": {
      const want = String(p.club).toLowerCase();
      return c => c.club.toLowerCase() === want;
    }
    case "position": {
      const parts = String(p.parts).split("|");
      return c => positionsOf(c).some(x => parts.includes(x));
    }
    case "era":
      return c => c.fifa_year >= Number(p.from) && c.fifa_year <= Number(p.to);
    case "age":
      return c => c.age >= Number(p.min) && c.age <= Number(p.max);
    case "wildcard":
      return () => true;
    case "stat":
      // Stat briefs cannot be judged from the cached pool — attributes are not
      // in it. The rating floor is the part that IS checkable here; the stat
      // itself is applied in fetchChallengeRound once attributes are loaded.
      return c => c.ovr >= STAT_BRIEF_MIN_OVERALL;
  }
}

const id = (kind: string, n: number) => `${kind}-${n}`;

/** Every brief the generator can draw from, in no particular order. */
export function allBriefs(): Brief[] {
  const out: Brief[] = [];

  RATING_BANDS.forEach((b, i) => out.push({
    id: id("rating", i), kind: "rating",
    title: `${b.min} – ${b.max} RATED`, detail: b.detail,
    params: { min: b.min, max: b.max },
  }));

  STAT_BRIEFS.forEach((s, i) => out.push({
    id: id("stat", i), kind: "stat",
    title: `${s.min}+ ${STAT_KEYS[s.stat].toUpperCase()}`, detail: s.detail,
    params: { stat: s.stat, min: s.min },
  }));

  NATIONS.forEach((n, i) => out.push({
    id: id("nation", i), kind: "nation",
    title: n.toUpperCase(), detail: `${n} internationals only.`,
    params: { nation: n },
  }));

  CLUBS.forEach((c, i) => out.push({
    id: id("club", i), kind: "club",
    title: c.toUpperCase(), detail: `Anyone who played for ${c}.`,
    params: { club: c },
  }));

  POSITION_GROUPS.forEach((g, i) => out.push({
    id: id("position", i), kind: "position",
    title: g.title, detail: g.detail,
    params: { parts: g.parts.join("|") },
  }));

  ERAS.forEach((e, i) => out.push({
    id: id("era", i), kind: "era",
    title: e.title, detail: e.detail,
    params: { from: e.from, to: e.to },
  }));

  AGE_BRIEFS.forEach((a, i) => out.push({
    id: id("age", i), kind: "age",
    title: a.title, detail: a.detail,
    params: { min: a.min, max: a.max },
  }));

  out.push({
    id: "wildcard-0", kind: "wildcard",
    title: "FREE PICK", detail: "Anyone in the league. No restrictions.",
    params: {},
  });

  return out;
}

export function briefById(briefId: string): Brief | undefined {
  return allBriefs().find(b => b.id === briefId);
}

/**
 * Choose the fourteen briefs for a draft.
 *
 * Rules that stop a run being unplayable or dull:
 *  - Exactly one KEEPERS ONLY round, and it is never last. Without a guaranteed
 *    keeper round you can finish a draft with no goalkeeper at all, and the
 *    arrange screen will not let you field a team; putting it late would mean
 *    spending it on whoever is left rather than choosing.
 *  - No brief repeats, and no more than three of any one kind, so a run cannot
 *    turn into six nationality rounds.
 *  - Every brief is checked against the real pool first, so a nation or club
 *    with too few Premier League players is never offered.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildBriefSequence(
  service: any,
  opts: RoundOptions = {},
): Promise<Brief[]> {
  const candidates = allBriefs();

  // Which briefs can actually fill a board? Stat briefs are checked by their
  // rating floor only; their pool is far larger than ten in practice and the
  // exact check needs attributes.
  const usable: Brief[] = [];
  for (const b of candidates) {
    const n = await countMatching(service, briefMatcher(b), opts);
    if (n >= MIN_BRIEF_POOL) usable.push(b);
  }

  const keeperBriefs = usable.filter(b => b.kind === "position" && b.params.parts === "GK");
  const rest = shuffle(usable.filter(b => !keeperBriefs.includes(b)));

  const picked: Brief[] = [];
  const kindCount = new Map<BriefKind, number>();
  const MAX_PER_KIND = 3;

  for (const b of rest) {
    if (picked.length >= CHALLENGE_ROUNDS - (keeperBriefs.length ? 1 : 0)) break;
    const used = kindCount.get(b.kind) ?? 0;
    if (used >= MAX_PER_KIND) continue;
    kindCount.set(b.kind, used + 1);
    picked.push(b);
  }

  // Top up from anything left if the kind caps were too strict for the pool.
  if (picked.length < CHALLENGE_ROUNDS - (keeperBriefs.length ? 1 : 0)) {
    for (const b of rest) {
      if (picked.length >= CHALLENGE_ROUNDS - (keeperBriefs.length ? 1 : 0)) break;
      if (!picked.includes(b)) picked.push(b);
    }
  }

  if (keeperBriefs.length > 0) {
    // Somewhere in the first two thirds, so it is a real choice.
    const slot = Math.floor(Math.random() * Math.max(1, Math.floor(CHALLENGE_ROUNDS * 0.66)));
    picked.splice(Math.min(slot, picked.length), 0, keeperBriefs[0]);
  }

  return picked.slice(0, CHALLENGE_ROUNDS);
}

// ── Attributes, for stat briefs ─────────────────────────────────────────────

/** sofifa_id:fifa_year → the six headline stats, as small ints. */
type StatIndex = Map<string, Record<StatKey, number>>;
const statCache = new Map<string, { index: StatIndex; at: number }>();
const STAT_TTL_MS = 30 * 60 * 1000;

const statKey = (sofifaId: string, year: number) => `${sofifaId}:${year}`;

/**
 * Load the six headline attributes for every draftable player in the era.
 *
 * Fetched separately from the pool and reduced to six numbers per row on
 * arrival, because the raw attributes column is 40-70 keys of JSONB per player
 * and the cached pool deliberately leaves it out — carrying it would bloat
 * every American draft too. Bounded by STAT_BRIEF_MIN_OVERALL, cached for half
 * an hour.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStatIndex(service: any, opts: RoundOptions): Promise<StatIndex> {
  const cacheKey = `${opts.eraStart ?? 2007}-${opts.eraEnd ?? 2026}`;
  const hit = statCache.get(cacheKey);
  if (hit && Date.now() - hit.at < STAT_TTL_MS) return hit.index;

  const ids = await eligibleIdentities(service, opts, STAT_BRIEF_MIN_OVERALL);
  const index: StatIndex = new Map();
  if (ids.length === 0) return index;

  const uniqueIds = Array.from(new Set(ids.map(i => i.sofifa_id)));
  const years = Array.from(new Set(ids.map(i => i.fifa_year)));

  // Chunked so no single request carries thousands of ids, AND paged within
  // each chunk. One player has a row per edition, so 400 ids over twenty
  // editions is up to 8000 rows — and PostgREST caps every response at 1000
  // regardless of what you ask for. Without the paging most attributes came
  // back missing and stat briefs quietly found nobody.
  const CHUNK = 300;
  for (let i = 0; i < uniqueIds.length; i += CHUNK) {
    const slice = uniqueIds.slice(i, i + CHUNK);
    const rows = await fetchAllRows<{ sofifa_id: string; fifa_year: number; attributes: unknown }>(
      (from, to) => service
        .from("sofifa_players")
        .select("sofifa_id, fifa_year, attributes")
        .in("sofifa_id", slice)
        .in("fifa_year", years)
        .order("sofifa_id")
        .order("fifa_year")
        .range(from, to),
      CHUNK * 40,
    );
    for (const row of rows) {
      const a = attributesFromJson(row.attributes);
      index.set(statKey(row.sofifa_id, row.fifa_year), {
        pace: a.pace, shooting: a.shooting, passing: a.passing,
        dribbling: a.dribbling, defending: a.defending, physical: a.physical,
      });
    }
  }

  statCache.set(cacheKey, { index, at: Date.now() });
  return index;
}

// ── Building a round ────────────────────────────────────────────────────────

/**
 * The ten cards for one brief.
 *
 * `excludeKeys` are everyone already drafted, by id and normalised name, so a
 * footballer can appear once per draft however many briefs he qualifies for.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchChallengeRound(
  service: any,
  brief: Brief,
  excludeKeys: Iterable<string> = [],
  opts: RoundOptions = {},
  size = 10,
): Promise<AmPlayer[]> {
  const base = briefMatcher(brief);

  if (brief.kind !== "stat") {
    return fetchCustomRoundPlayers(service, base, excludeKeys, opts, size);
  }

  const stat = String(brief.params.stat) as StatKey;
  const min = Number(brief.params.min);
  const index = await getStatIndex(service, opts);

  return fetchCustomRoundPlayers(
    service,
    c => {
      if (!base(c)) return false;
      const s = index.get(statKey(c.sofifa_id, c.fifa_year));
      return !!s && s[stat] >= min;
    },
    excludeKeys,
    opts,
    size,
  );
}

/** Human-readable summary of what a brief asked for, for the results screen. */
export function briefSummary(brief: Brief): string {
  return `${brief.title} — ${brief.detail}`;
}
