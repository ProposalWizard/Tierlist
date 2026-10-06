/**
 * THE CAREER OVERVIEW — everything the end of a career shows, in one place.
 *
 * Leo, 5 Oct 2026: "a very well designed and perfected career overview …
 * season by season stats, all your achievements, all your records, all your
 * goals, all your assists, your clubs, all your records for each club, how
 * many times you won the league, the winners of every competition every
 * season you played, all of your stats such as money, relationships, fame,
 * all of your items … basically every single thing possible."
 *
 * Pure: a save in, a picture-ready summary out. The screen
 * (components/star/CareerOverview.tsx) only draws what this returns, so the
 * preview page and the real retirement show exactly the same thing.
 *
 * Older saves: the season-by-season stats start on 27 Sep 2026 (seasonArchive)
 * and who won what on 5 Oct 2026 (seasonHistory). Trophies, awards and
 * transfers go back to the start. Anything a save never recorded comes back
 * as `undefined`, never as a guess, and the screen shows it blacked out.
 */
import type { CareerState, FarewellRecord, SeasonHistoryRow, Trophy } from "./types";
import type { CareerDivision } from "./calendar";
import { careerVerdict, type CareerVerdict } from "./retirement";
import { allSeasons } from "./careerRecords";
import { ACHIEVEMENTS } from "./achievements";
import { RECORDS } from "./records";
import { fameOf } from "./fame";

// ── Labels ───────────────────────────────────────────────────────────────────

/** "26/27" — season 1 is the start year's season. */
export function shortSeason(startYear: number, season: number): string {
  const y = startYear + season - 1;
  return `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
}

/** "2026/27". */
export function longSeason(startYear: number, season: number): string {
  const y = startYear + season - 1;
  return `${y}/${String(y + 1).slice(2)}`;
}

export const DIVISION_SHORT: Record<CareerDivision, string> = {
  premier: "PL",
  championship: "CH",
  league_one: "L1",
  league_two: "L2",
  national_league: "NL",
  national_league_north: "NLN",
  national_league_south: "NLS",
};

/**
 * Trophies ordered by how much they mean, the biggest first. The same order
 * the garden's shelf uses (gardenLevel.ts), plus the ones it leaves out.
 */
export const HONOUR_ORDER = [
  "Ballon d'Or", "World Cup", "European Championship", "Champions League", "Premier League",
  "Europa League", "FA Cup", "Conference League", "League Cup", "Super Cup", "Community Shield",
  "Championship", "Play-Offs", "League One", "League Two", "National League",
];
const honourRank = (n: string) => {
  const i = HONOUR_ORDER.indexOf(n);
  return i < 0 ? HONOUR_ORDER.length : i;
};

/** The competitions that are a league title (counted on the hero as "titles"). */
const LEAGUE_TITLES = new Set(["Premier League", "Championship", "League One", "League Two", "National League"]);

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface OverviewSeason {
  season: number;
  /** "26/27". */
  label: string;
  age: number;
  club: string;
  /** Your numbers that season; absent when the save never recorded them. */
  stats?: { apps: number; goals: number; assists: number; avgRating: number; motm: number };
  /** The season still being played (a preview of a career that is not over). */
  live: boolean;
  /** Who won what, your club's finish, the Ballon d'Or: absent on older saves. */
  world?: SeasonHistoryRow;
  /** What you won that season, biggest first. */
  trophies: string[];
  /** Your individual awards that season, e.g. "Golden Boot", "Player of the Month ×2". */
  awards: string[];
  /** Ballon d'Or: 1 = won it. 0/absent = not on the shortlist or not recorded. */
  ballonDorRank?: number;
  /** Moved here at the end of the season before (the fee). */
  arrivedFrom?: { club: string; fee: number };
}

export interface OverviewClub {
  club: string;
  /** "2026–29" or "2026–29 · 2035–37" for a return. */
  years: string;
  firstSeason: number;
  seasons: number;
  apps: number;
  goals: number;
  assists: number;
  /** Across the seasons with a rating. 0 when none. */
  avgRating: number;
  /** Seasons whose stats were recorded (the rest are missing on older saves). */
  recordedSeasons: number;
  trophies: { competition: string; count: number }[];
  /** What the club paid to sign you, and what you left for. */
  feeIn?: number;
  feeOut?: number;
  best?: { season: number; label: string; goals: number; assists: number };
  testimonial?: number;
  /** The club you finished at. */
  last: boolean;
}

export interface OverviewHonour {
  competition: string;
  count: number;
  /** Season labels, oldest first. Empty for a Ballon d'Or on an older save. */
  seasons: string[];
}

export interface OverviewRecord {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}

export interface RealRecordRow {
  label: string;
  holder: string;
  record: number;
  you: number;
  unit: string;
  beaten: boolean;
}

export interface OverviewItem {
  /** The shop item's base id ("phone"), for its drawing (StylePicture). */
  base: string;
  name: string;
  level: number;
  category: "item" | "vehicle" | "property";
}

/** One unbroken spell at a club, in order: Brighton, City, Arsenal, Brighton. */
export interface OverviewSpell {
  club: string;
  from: number;
  to: number;
  /** "2026–30". */
  years: string;
  /** What the next club paid for you (absent for the last spell). */
  feeOut?: number;
}

export interface CareerOverviewData {
  name: string;
  nation: string;
  position: string;
  /** "2026–2049". */
  years: string;
  firstYear: number;
  lastYear: number;
  ageAtEnd: number;
  seasonsPlayed: number;
  retired: boolean;
  finalClub: string;
  verdict: CareerVerdict;
  totals: {
    apps: number; goals: number; assists: number; avgRating: number;
    motm: number; hatTricks: number; caps: number; intlGoals: number;
    trophies: number; leagueTitles: number; ballonDors: number;
    goalsPerGame: number;
  };
  seasons: OverviewSeason[];
  clubs: OverviewClub[];
  spells: OverviewSpell[];
  honours: OverviewHonour[];
  individual: OverviewHonour[];
  records: OverviewRecord[];
  realRecords: RealRecordRow[];
  achievements: { id: string; label: string; description: string; unlocked: boolean }[];
  life: {
    money: number;
    testimonial?: { club: string; payout: number };
    fame: number;
    stars?: number;
    overall: number;
    reputation: number;
    happiness: number;
    relationships: { boss: number; team: number; fans: number; girlfriend?: number };
    girlfriend?: string;
    items: OverviewItem[];
    horse?: { name: string; won: number; run: number; earnings: number };
    sponsors: { brand: string; category: string; color: string }[];
    clubsOwned: { club: string; percent: number }[];
    presidencies: string[];
    son?: { name: string; age: number; overall: number; club: string | null };
    boot?: string;
  };
  /** One point per season for the career arc: goals, and the star rating when recorded. */
  arc: { season: number; label: string; age: number; goals?: number; assists?: number; stars?: number; live: boolean }[];
  /** The best season (goals + assists), for the hero. */
  peak?: { season: number; label: string; club: string; goals: number; assists: number };
  /** The first season whose winners were recorded; undefined when none were. */
  historyFrom?: number;
  /** The farewell match, when it was played (lib/star/farewell.ts). */
  farewell?: FarewellRecord;
}

// ── Building it ──────────────────────────────────────────────────────────────

/** The club you were at in a season the save has no row for, from the transfers. */
function clubInSeason(career: CareerState, season: number): string {
  const moves = [...(career.transfers ?? [])].sort((a, b) => a.season - b.season);
  if (moves.length === 0) return career.player.club;
  // A move recorded in season s is signed at its end: you play for `to` from s+1.
  let club = moves[0].from;
  for (const m of moves) if (m.season < season) club = m.to;
  return club;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function countBy(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

function yearsSpan(startYear: number, seasons: number[]): string {
  // Consecutive runs: 1,2,3,7,8 → "2026–29 · 2032–34".
  const sorted = Array.from(new Set(seasons)).sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const s of sorted) {
    const last = runs[runs.length - 1];
    if (last && s === last[1] + 1) last[1] = s;
    else runs.push([s, s]);
  }
  return runs.map(([a, b]) => {
    const from = startYear + a - 1;
    const to = startYear + b;
    return `${from}–${String(to).slice(2)}`;
  }).join(" · ");
}

/** A history row without its best team-mates (careerRecords.ts bestMatesOf). */
function withoutMates(row: SeasonHistoryRow): SeasonHistoryRow {
  if (!row.mates) return row;
  const { mates: _mates, ...rest } = row;
  return rest;
}

export function careerOverview(career: CareerState): CareerOverviewData {
  const startYear = career.player.startYear;
  const lastSeason = Math.max(1, career.season);
  const stats = allSeasons(career);
  const statsBy = new Map(stats.map(r => [r.season, r]));
  const historyBy = new Map((career.seasonHistory ?? []).map(r => [r.season, r]));
  const awards = career.awards ?? [];
  const trophies: Trophy[] = career.trophies ?? [];
  const transfers = [...(career.transfers ?? [])].sort((a, b) => a.season - b.season);

  // ── Seasons ──
  const seasons: OverviewSeason[] = [];
  for (let s = 1; s <= lastSeason; s++) {
    const st = statsBy.get(s);
    const world = historyBy.get(s);
    const club = st?.club ?? world?.club ?? clubInSeason(career, s);
    const won = trophies.filter(t => t.season === s).map(t => t.competition)
      .sort((a, b) => honourRank(a) - honourRank(b));
    const awardCounts = countBy(awards.filter(a => a.season === s).map(a => a.kind));
    const awardList = Array.from(awardCounts.entries())
      .sort((a, b) => honourRank(a[0]) - honourRank(b[0]))
      .map(([k, n]) => (n > 1 ? `${k} ×${n}` : k));
    const arrived = transfers.find(t => t.season === s - 1);
    // Only a season that actually ended can have a live row; a retired
    // career's last season is closed (careerFlow.ts closeFinalSeason).
    const live = !!st?.live && !career.retired;
    seasons.push({
      season: s,
      label: shortSeason(startYear, s),
      age: world?.age ?? career.player.age - (lastSeason - s),
      club,
      ...(st ? { stats: { apps: st.apps, goals: st.goals, assists: st.assists, avgRating: st.avgRating, motm: st.motm } } : {}),
      live,
      // The season's best team-mates are for the farewell match; the
      // overview never draws them, and the Hall's slim copy drops them.
      ...(world ? { world: withoutMates(world) } : {}),
      trophies: won,
      awards: awardList,
      ...(world?.ballonDor ? { ballonDorRank: world.ballonDor.yourRank } : {}),
      ...(arrived ? { arrivedFrom: { club: arrived.from, fee: arrived.fee } } : {}),
    });
  }

  // ── Clubs, in the order you joined them ──
  const clubOrder: string[] = [];
  for (const s of seasons) if (!clubOrder.includes(s.club)) clubOrder.push(s.club);
  const finalClub = seasons[seasons.length - 1]?.club ?? career.player.club;
  const clubs: OverviewClub[] = clubOrder.map((club) => {
    const mine = seasons.filter(s => s.club === club);
    const rated = mine.filter(s => s.stats && s.stats.avgRating > 0 && s.stats.apps > 0);
    const ratedApps = rated.reduce((n, s) => n + (s.stats?.apps ?? 0), 0);
    const avgRating = ratedApps > 0
      ? round2(rated.reduce((n, s) => n + (s.stats!.avgRating * s.stats!.apps), 0) / ratedApps)
      : 0;
    const best = [...mine].filter(s => s.stats)
      .sort((a, b) => (b.stats!.goals + b.stats!.assists) - (a.stats!.goals + a.stats!.assists))[0];
    const won = countBy(trophies.filter(t => t.club === club).map(t => t.competition));
    const feeIn = transfers.find(t => t.to === club)?.fee;
    const feeOut = [...transfers].reverse().find(t => t.from === club)?.fee;
    return {
      club,
      years: yearsSpan(startYear, mine.map(s => s.season)),
      firstSeason: mine[0].season,
      seasons: mine.length,
      apps: mine.reduce((n, s) => n + (s.stats?.apps ?? 0), 0),
      goals: mine.reduce((n, s) => n + (s.stats?.goals ?? 0), 0),
      assists: mine.reduce((n, s) => n + (s.stats?.assists ?? 0), 0),
      avgRating,
      recordedSeasons: mine.filter(s => s.stats).length,
      trophies: Array.from(won.entries())
        .map(([competition, count]) => ({ competition, count }))
        .sort((a, b) => honourRank(a.competition) - honourRank(b.competition)),
      ...(feeIn !== undefined ? { feeIn } : {}),
      ...(feeOut !== undefined ? { feeOut } : {}),
      ...(best?.stats ? { best: { season: best.season, label: best.label, goals: best.stats.goals, assists: best.stats.assists } } : {}),
      ...(career.testimonial && career.testimonial.club === club ? { testimonial: career.testimonial.payout } : {}),
      last: club === finalClub,
    };
  });

  const spells: OverviewSpell[] = [];
  for (const s of seasons) {
    const cur = spells[spells.length - 1];
    if (cur && cur.club === s.club) { cur.to = s.season; continue; }
    spells.push({ club: s.club, from: s.season, to: s.season, years: "" });
  }
  for (let i = 0; i < spells.length; i++) {
    const sp = spells[i];
    sp.years = yearsSpan(startYear, Array.from({ length: sp.to - sp.from + 1 }, (_, k) => sp.from + k));
    const out = transfers.find(t => t.season === sp.to && t.from === sp.club);
    if (i < spells.length - 1 && out) sp.feeOut = out.fee;
  }

  // ── Honours ──
  const bySeasons = new Map<string, number[]>();
  for (const t of trophies) bySeasons.set(t.competition, [...(bySeasons.get(t.competition) ?? []), t.season]);
  const honours: OverviewHonour[] = Array.from(bySeasons.entries()).map(([competition, list]) => ({
    competition,
    count: list.length,
    seasons: [...list].sort((a, b) => a - b).map(s => shortSeason(startYear, s)),
  }));
  if (career.ballonDorWins > 0) {
    const won = (career.seasonHistory ?? []).filter(r => r.ballonDor?.yourRank === 1).map(r => r.season);
    honours.push({
      competition: "Ballon d'Or",
      count: career.ballonDorWins,
      // Seasons only for the wins the save recorded; never more than the count.
      seasons: won.slice(0, career.ballonDorWins).map(s => shortSeason(startYear, s)),
    });
  }
  honours.sort((a, b) => honourRank(a.competition) - honourRank(b.competition) || b.count - a.count);

  const byAward = new Map<string, number[]>();
  for (const a of awards) byAward.set(a.kind, [...(byAward.get(a.kind) ?? []), a.season]);
  const individual: OverviewHonour[] = Array.from(byAward.entries()).map(([competition, list]) => ({
    competition,
    count: list.length,
    seasons: Array.from(new Set(list)).sort((a, b) => a - b).map(s => shortSeason(startYear, s)),
  })).sort((a, b) => honourRank(a.competition) - honourRank(b.competition) || b.count - a.count);

  // ── Totals ──
  const c = career.careerStats;
  const leagueTitles = trophies.filter(t => LEAGUE_TITLES.has(t.competition)).length;
  const totals = {
    apps: c.appearances,
    goals: c.goals,
    assists: c.assists,
    avgRating: c.ratingCount > 0 ? round2(c.totalRating / c.ratingCount) : 0,
    motm: c.starMan,
    hatTricks: c.hatTricks,
    caps: career.caps ?? 0,
    intlGoals: career.internationalGoals ?? 0,
    trophies: trophies.length,
    leagueTitles,
    ballonDors: career.ballonDorWins,
    goalsPerGame: c.appearances > 0 ? round2(c.goals / c.appearances) : 0,
  };

  // ── Records ──
  const b = career.careerBests ?? {};
  const seasonText = (s: number) => longSeason(startYear, s);
  const withStats = seasons.filter(s => s.stats && s.stats.apps > 0);
  const bestRated = [...withStats].filter(s => s.stats!.apps >= 10)
    .sort((a, b2) => b2.stats!.avgRating - a.stats!.avgRating)[0];
  const mostMotm = [...withStats].sort((a, b2) => b2.stats!.motm - a.stats!.motm)[0];
  const h2h = Object.entries(career.headToHead ?? {});
  const favourite = [...h2h].sort((a, b2) => b2[1].wins - a[1].wins || a[1].losses - b2[1].losses)[0];
  const bogey = [...h2h].sort((a, b2) => b2[1].losses - a[1].losses || a[1].wins - b2[1].wins)[0];
  const records: OverviewRecord[] = [
    { icon: "🚀", label: "Furthest goal", value: b.furthestGoal ? `${b.furthestGoal.metres} m` : "—", sub: b.furthestGoal ? `v ${b.furthestGoal.opponent} · ${seasonText(b.furthestGoal.season)}` : undefined },
    { icon: "🎯", label: "Furthest assist", value: b.furthestAssist ? `${b.furthestAssist.metres} m` : "—", sub: b.furthestAssist ? `v ${b.furthestAssist.opponent} · ${seasonText(b.furthestAssist.season)}` : undefined },
    { icon: "⚽", label: "Most goals in a game", value: b.mostGoalsMatch ? String(b.mostGoalsMatch.goals) : "—", sub: b.mostGoalsMatch ? `v ${b.mostGoalsMatch.opponent} · ${seasonText(b.mostGoalsMatch.season)}` : undefined },
    { icon: "📈", label: "Most goals in a season", value: b.mostGoalsSeason ? String(b.mostGoalsSeason.goals) : "—", sub: b.mostGoalsSeason ? seasonText(b.mostGoalsSeason.season) : undefined },
    { icon: "🅰️", label: "Most assists in a season", value: b.mostAssistsSeason ? String(b.mostAssistsSeason.assists) : "—", sub: b.mostAssistsSeason ? seasonText(b.mostAssistsSeason.season) : undefined },
    { icon: "⭐", label: "Best season rating", value: bestRated?.stats ? bestRated.stats.avgRating.toFixed(2) : "—", sub: bestRated ? `${seasonText(bestRated.season)} · ${bestRated.club}` : undefined },
    { icon: "🎩", label: "Hat-tricks", value: String(c.hatTricks) },
    { icon: "🏅", label: "Most Star Man in a season", value: mostMotm?.stats && mostMotm.stats.motm > 0 ? String(mostMotm.stats.motm) : "—", sub: mostMotm?.stats && mostMotm.stats.motm > 0 ? seasonText(mostMotm.season) : undefined },
    ...(favourite && favourite[1].wins > 0 ? [{ icon: "😁", label: "Favourite opponent", value: `${favourite[1].wins}W`, sub: `${favourite[0]} · ${favourite[1].wins}-${favourite[1].draws}-${favourite[1].losses}` }] : []),
    ...(bogey && bogey[1].losses > 0 ? [{ icon: "😤", label: "Bogey team", value: `${bogey[1].losses}L`, sub: `${bogey[0]} · ${bogey[1].wins}-${bogey[1].draws}-${bogey[1].losses}` }] : []),
  ];
  const realRecords: RealRecordRow[] = RECORDS.map(r => {
    const you = r.progress(career);
    return { label: r.label, holder: r.holder, record: r.value, you, unit: r.unit, beaten: you >= r.value };
  });

  const achievements = ACHIEVEMENTS.map(a => ({
    id: a.id, label: a.label, description: a.description, unlocked: career.achievements.includes(a.id),
  }));

  // ── Life ──
  // One drawing per thing owned: the highest level of each.
  const top = new Map<string, OverviewItem>();
  for (const it of career.ownedItems ?? []) {
    const base = it.baseId ?? it.id;
    const level = it.level ?? 1;
    const had = top.get(base);
    if (!had || level > had.level) top.set(base, { base, name: it.name, level, category: it.category });
  }
  const order = { property: 0, vehicle: 1, item: 2 } as const;
  const items = Array.from(top.values()).sort((a, b2) => order[a.category] - order[b2.category] || b2.level - a.level);
  const deals = career.brands?.deals ?? [];
  const life: CareerOverviewData["life"] = {
    money: career.money,
    ...(career.testimonial ? { testimonial: { club: career.testimonial.club, payout: career.testimonial.payout } } : {}),
    fame: fameOf(career),
    ...(typeof career.stars === "number" ? { stars: career.stars } : {}),
    overall: career.starRating,
    reputation: typeof career.reputation === "number" ? career.reputation : 50,
    happiness: career.happiness,
    relationships: {
      boss: career.relationships.boss,
      team: career.relationships.team,
      fans: career.relationships.fans,
      ...(career.girlfriend && career.relationships.girlfriend !== null ? { girlfriend: career.relationships.girlfriend } : {}),
    },
    ...(career.girlfriend ? { girlfriend: career.girlfriend.name } : {}),
    items,
    ...(career.horse ? { horse: { name: career.horse.name, won: career.horse.racesWon, run: career.horse.racesRun, earnings: career.horse.earnings } } : {}),
    sponsors: deals.map(d => ({ brand: d.brand, category: d.category, color: d.color })),
    clubsOwned: (career.investments ?? []).filter(s => s.percent > 0)
      .map(s => ({ club: s.club, percent: Math.round(s.percent) }))
      .sort((a, b2) => b2.percent - a.percent),
    presidencies: [...(career.governingBodyPresidencies ?? [])],
    ...(career.son ? { son: { name: career.son.name, age: career.son.age, overall: career.son.overall, club: career.son.club } } : {}),
    ...(career.currentBoot ? { boot: career.currentBoot.name } : {}),
  };

  // ── The arc and the peak ──
  const arc = seasons.map(s => ({
    season: s.season,
    label: s.label,
    age: s.age,
    ...(s.stats ? { goals: s.stats.goals, assists: s.stats.assists } : {}),
    ...(typeof s.world?.stars === "number" ? { stars: s.world.stars } : {}),
    live: s.live,
  }));
  const peakSeason = [...withStats].sort((a, b2) =>
    (b2.stats!.goals + b2.stats!.assists) - (a.stats!.goals + a.stats!.assists))[0];
  const peak = peakSeason?.stats ? {
    season: peakSeason.season, label: longSeason(startYear, peakSeason.season), club: peakSeason.club,
    goals: peakSeason.stats.goals, assists: peakSeason.stats.assists,
  } : undefined;

  const firstHistory = (career.seasonHistory ?? []).map(r => r.season).sort((a, b2) => a - b2)[0];
  const lastYear = startYear + lastSeason;

  return {
    name: `${career.player.firstName} ${career.player.lastName}`,
    nation: career.player.nationality,
    position: career.player.position,
    years: `${startYear}–${lastYear}`,
    firstYear: startYear,
    lastYear,
    ageAtEnd: career.player.age,
    seasonsPlayed: lastSeason,
    retired: !!career.retired,
    finalClub,
    verdict: careerVerdict(career),
    totals,
    seasons,
    clubs,
    spells,
    honours,
    individual,
    records,
    realRecords,
    achievements,
    life,
    arc,
    ...(peak ? { peak } : {}),
    ...(firstHistory !== undefined ? { historyFrom: firstHistory } : {}),
    ...(career.farewell?.played ? { farewell: career.farewell } : {}),
  };
}
