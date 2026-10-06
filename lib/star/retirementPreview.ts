/**
 * MADE-UP FINISHED CAREERS, TO PREVIEW THE END OF ONE.
 *
 * Leo, 5 Oct 2026: "give me the opportunity to preview the retirement or end
 * of career easily, because I don't want to have to play 15 seasons … just to
 * test out the retirement feature."
 *
 * Each shape is a whole career written in one go, from a seed: every season's
 * numbers, the table, who won what, the trophies, the awards, the transfers,
 * the money and the things bought. It is invented, but it is a real
 * `CareerState`, so the overview screen draws it exactly as it would draw
 * a played one. The totals agree with the seasons (tests/star/retirementPreview.mts).
 *
 * Only used by the test page (/star-retirement-dev). Nothing here ever runs in
 * a real career.
 */
import type { CareerState, LeaguePlayer, LeagueSquad, SeasonArchiveRow, SeasonHistoryRow, SquadPlayer, StarPlayer, Trophy, OwnedItem } from "./types";
import type { CareerDivision } from "./calendar";
import type { BrandDeal } from "./sponsorDeals";
import type { Award } from "./recognition";
import { makeInitialCareer } from "./careerFlow";
import { mulberry32 } from "./season";
import { ACHIEVEMENTS } from "./achievements";
import { LIFESTYLE_ALL_LEVELS } from "./shopData";
import { testimonialFor } from "./retirement";
import { generateSquad, clubNameSeed } from "./squadData";
import { bestMatesOf } from "./careerRecords";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS,
} from "./clubs";

export type PreviewShape = "legend" | "journeyman" | "oneClub" | "grafter" | "quiet";

export const PREVIEW_SHAPES: { id: PreviewShape; label: string; line: string }[] = [
  { id: "legend", label: "Legend", line: "Ballon d'Ors and a big club" },
  { id: "oneClub", label: "One club", line: "One shirt, a testimonial" },
  { id: "journeyman", label: "Journeyman", line: "Seven clubs, up and down" },
  { id: "grafter", label: "Lower leagues", line: "League Two to the Championship" },
  { id: "quiet", label: "Quiet one", line: "Two clubs, little to show for it" },
];

interface Spell {
  club: string;
  /** One division per season of the spell (a club can go up or down). */
  divisions: CareerDivision[];
  /** 0-1: how strong the club is, for trophies and where it finishes. */
  strength: number;
}

interface ShapeSpec {
  first: string;
  last: string;
  position: string;
  /** How good he gets at his best, 0-1. */
  ceiling: number;
  spells: Spell[];
  /** International career: caps start at this age (none when absent). */
  capsFrom?: number;
  items: [string, number][];
  horse?: boolean;
  girlfriend?: string;
  sponsors: [string, string, string][];
  stake?: [string, number];
  president?: boolean;
  son?: boolean;
}

const rep = <T,>(v: T, n: number): T[] => Array.from({ length: n }, () => v);

const SHAPES: Record<PreviewShape, ShapeSpec> = {
  legend: {
    first: "Jamie", last: "Calloway", position: "ST", ceiling: 1, capsFrom: 19,
    spells: [
      { club: "Brighton & Hove Albion", divisions: rep("premier", 4), strength: 0.55 },
      { club: "Manchester City", divisions: rep("premier", 9), strength: 0.95 },
      { club: "Arsenal", divisions: rep("premier", 5), strength: 0.88 },
      { club: "Brighton & Hove Albion", divisions: rep("premier", 2), strength: 0.5 },
    ],
    items: [["jet", 5], ["estate", 5], ["car-4", 5], ["rolex", 5], ["villa", 4], ["stable", 3], ["suv", 4]],
    horse: true, girlfriend: "Sophie",
    sponsors: [["Strikeforce", "Boots", "#f97316"], ["Volt", "Sports Drink", "#22c55e"], ["Halcyon", "Watch", "#eab308"], ["Nova", "Electronics", "#3b82f6"]],
    stake: ["Brighton & Hove Albion", 30], president: true, son: true,
  },
  oneClub: {
    first: "Danny", last: "Mercer", position: "CAM", ceiling: 0.78, capsFrom: 22,
    spells: [{ club: "Newcastle United", divisions: rep("premier", 20), strength: 0.72 }],
    items: [["house-2", 3], ["suv", 4], ["gold", 3], ["tv", 4]],
    girlfriend: "Hannah",
    sponsors: [["Strikeforce", "Boots", "#f97316"], ["Tyneside Motors", "Car", "#64748b"]],
  },
  journeyman: {
    first: "Tom", last: "Ashworth", position: "ST", ceiling: 0.62,
    spells: [
      { club: "Burton Albion", divisions: rep("league_one", 3), strength: 0.45 },
      { club: "Peterborough United", divisions: rep("league_one", 2), strength: 0.6 },
      { club: "Derby County", divisions: rep("championship", 3), strength: 0.55 },
      { club: "Norwich City", divisions: rep("championship", 2), strength: 0.65 },
      { club: "Crystal Palace", divisions: rep("premier", 3), strength: 0.45 },
      { club: "Middlesbrough", divisions: rep("championship", 3), strength: 0.6 },
      { club: "Barnsley", divisions: rep("league_one", 4), strength: 0.55 },
    ],
    items: [["car-2", 3], ["flat-2", 2], ["console", 2]],
    sponsors: [["Pace", "Boots", "#ef4444"]],
  },
  grafter: {
    first: "Rhys", last: "Doherty", position: "ST", ceiling: 0.66,
    spells: [
      { club: "Grimsby Town", divisions: [...rep<CareerDivision>("league_two", 6), ...rep<CareerDivision>("league_one", 5), ...rep<CareerDivision>("championship", 3)], strength: 0.62 },
      { club: "Stockport County", divisions: rep("league_one", 6), strength: 0.55 },
    ],
    items: [["car-1", 2], ["flat-1", 1], ["phone", 3]],
    sponsors: [],
  },
  quiet: {
    first: "Kai", last: "Brennan", position: "RW", ceiling: 0.5,
    spells: [
      { club: "Port Vale", divisions: rep("league_one", 12), strength: 0.3 },
      { club: "Cheltenham Town", divisions: rep("league_one", 8), strength: 0.28 },
    ],
    items: [["car-1", 1]],
    sponsors: [],
  },
};

const DIVISION_CLUBS: Record<string, readonly string[]> = {
  premier: PREMIER_LEAGUE_CLUBS, championship: CHAMPIONSHIP_CLUBS,
  league_one: LEAGUE_ONE_CLUBS, league_two: LEAGUE_TWO_CLUBS,
};
const TEAMS: Record<string, number> = { premier: 20, championship: 24, league_one: 24, league_two: 24 };
const TITLE: Record<string, string> = { premier: "Premier League", championship: "Championship", league_one: "League One", league_two: "League Two" };
/** Goals come easier further down. */
const SCORING: Record<string, number> = { premier: 1, championship: 1.12, league_one: 1.22, league_two: 1.3 };
/** Who usually wins things when you don't, strongest first. */
const PL_GIANTS = ["Manchester City", "Liverpool", "Arsenal", "Chelsea", "Manchester United", "Tottenham Hotspur", "Newcastle United", "Aston Villa"];
const CL_GIANTS = ["Real Madrid", "FC Bayern München", "Manchester City", "FC Barcelona", "Paris Saint-Germain", "Liverpool", "Inter", "Arsenal"];
const EL_SIDES = ["Roma", "Napoli", "Tottenham Hotspur", "Aston Villa", "Sporting CP", "Villarreal CF", "Atlético Madrid", "Eintracht Frankfurt"];
const BALLON_RIVALS: [string, string][] = [
  ["Kylian Mbappé", "Real Madrid"], ["Erling Haaland", "Manchester City"], ["Lamine Yamal", "FC Barcelona"],
  ["Jude Bellingham", "Real Madrid"], ["Florian Wirtz", "Liverpool"], ["Pedri", "FC Barcelona"],
  ["Bukayo Saka", "Arsenal"], ["Cole Palmer", "Chelsea"],
];
const OPPONENTS = ["Liverpool", "Chelsea", "Manchester United", "Tottenham Hotspur", "Everton", "Aston Villa", "Leeds United", "Sunderland"];

/** How good he is at an age, before his ceiling: up to 27, a plateau, then down. */
function curve(age: number): number {
  if (age <= 16) return 0.28;
  if (age <= 27) return 0.28 + (age - 16) * (0.72 / 11);
  if (age <= 31) return 1;
  return Math.max(0.42, 1 - (age - 31) * 0.085);
}

/**
 * A club's made-up squad: the farewell match needs real-looking team-mates
 * and rivals (Leo, 6 Oct 2026). Seeded off the club alone, on its own
 * stream, so nothing else in the made-up career changes.
 */
function previewSquad(club: string, strength: number): LeaguePlayer[] {
  const seed = clubNameSeed(club);
  const r = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const tag = seed % 100000;
  return generateSquad(seed).map((p, i) => ({
    id: `${tag}${String(i).padStart(2, "0")}`,
    name: p.name,
    position: p.position,
    positions: [p.position],
    overall: Math.max(45, Math.min(90, Math.round(56 + strength * 30 + (r() - 0.5) * 12))),
    goals: 0,
    assists: 0,
    ...(p.imageUrl ? { image: p.imageUrl } : {}),
  }));
}

/** Where each Ballon d'Or rival plays. */
const RIVAL_POSITION: Record<string, LeaguePlayer["position"]> = {
  "Kylian Mbappé": "ST", "Erling Haaland": "ST", "Lamine Yamal": "RW", "Jude Bellingham": "CAM",
  "Florian Wirtz": "CAM", "Pedri": "CM", "Bukayo Saka": "RW", "Cole Palmer": "CAM",
};

/** That season's best team-mates at the club (SeasonMate), off their own stream. */
function previewMates(club: string, strength: number, seed: number, season: number) {
  const r = mulberry32((seed * 131 + season * 977 + clubNameSeed(club)) >>> 0);
  const squad: SquadPlayer[] = previewSquad(club, strength).map(lp => {
    const attack = lp.position === "ST" || lp.position === "LW" || lp.position === "RW" || lp.position === "CAM";
    const mid = lp.position === "CM" || lp.position === "CDM";
    return {
      id: `sf_${lp.id}`, name: lp.name, shortName: lp.name.split(" ").slice(-1)[0], position: lp.position,
      seasonGoals: Math.round(r() * (attack ? 14 : mid ? 5 : 2)),
      seasonAssists: Math.round(r() * (attack ? 8 : mid ? 7 : 2)),
      careerGoals: 0, careerAssists: 0, overall: lp.overall, imageUrl: lp.image,
    };
  });
  return bestMatesOf(squad);
}

/** Every club the made-up world needs a squad for, with the Ballon d'Or rivals in theirs. */
function previewWorld(clubs: Iterable<string>, strengthOf: (club: string) => number): LeagueSquad[] {
  const out: LeagueSquad[] = [];
  for (const club of Array.from(new Set(clubs))) {
    const players = previewSquad(club, strengthOf(club));
    BALLON_RIVALS.filter(([, c]) => c === club).forEach(([name], i) => {
      const position = RIVAL_POSITION[name] ?? "ST";
      const at = players.findIndex(p => p.position === position);
      const star: LeaguePlayer = { id: `${clubNameSeed(name) % 100000}9${i}`, name, position, positions: [position], overall: 91, goals: 0, assists: 0 };
      if (at >= 0) players[at] = star; else players.push(star);
    });
    out.push({ club, players });
  }
  return out;
}

/**
 * `upTo`: stop after this many seasons, NOT retired — the career as it stood
 * then (the test page's "final season" warning and "final whistle" views).
 * Without it: the whole career, retired.
 */
export function previewCareer(shape: PreviewShape, seed = 1, opts: { upTo?: number } = {}): CareerState {
  const spec = SHAPES[shape];
  const rng = mulberry32(seed * 7919 + shape.length * 131);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];
  const between = (a: number, b: number) => a + rng() * (b - a);
  const startYear = 2026;

  const allSeasons: { club: string; division: CareerDivision; strength: number }[] = [];
  for (const sp of spec.spells) for (const d of sp.divisions) allSeasons.push({ club: sp.club, division: d, strength: sp.strength });
  const finished = !opts.upTo || opts.upTo >= allSeasons.length;
  const seasons = finished ? allSeasons : allSeasons.slice(0, Math.max(1, opts.upTo!));
  const total = seasons.length;
  const ageAtEnd = 16 + total - 1;

  const player: StarPlayer = {
    firstName: spec.first, lastName: spec.last, age: ageAtEnd, skinTone: "light",
    club: seasons[total - 1].club, clubBadge: null, position: spec.position,
    nationality: "England", startYear,
  } as StarPlayer;
  const firstDiv = seasons[total - 1].division;
  const base = makeInitialCareer(player, [...(DIVISION_CLUBS[firstDiv] ?? PREMIER_LEAGUE_CLUBS)], firstDiv);

  const archive: SeasonArchiveRow[] = [];
  const history: SeasonHistoryRow[] = [];
  const trophies: Trophy[] = [];
  const awards: Award[] = [];
  const transfers: CareerState["transfers"] = [];
  let money = 0, fame = 0, caps = 0, intlGoals = 0, ballonDors = 0;
  let hatTricks = 0, passes = 0, totalRating = 0, ratingCount = 0;
  let plGoals = 0, plApps = 0, bestPlGoalsSeason = 0, bestPlAssistsSeason = 0;
  let lastPosition = 10;

  for (let i = 0; i < total; i++) {
    const s = i + 1;
    const age = 16 + i;
    const { club, division, strength } = seasons[i];
    const q = Math.min(1, curve(age) * spec.ceiling * between(0.94, 1.06));
    const teams = TEAMS[division] ?? 24;

    // Up or down at the end of it: the spell says so, and the table agrees.
    const next = seasons[i + 1];
    const ladderOrder = ["premier", "championship", "league_one", "league_two"];
    const move: SeasonHistoryRow["move"] = next && next.club === club && next.division !== division
      ? (ladderOrder.indexOf(next.division) < ladderOrder.indexOf(division) ? "promoted" : "relegated")
      : null;
    // Where the club finished: strength, your form, and luck.
    const pull = strength * 0.7 + q * 0.3;
    let position = Math.max(1, Math.min(teams, Math.round((1 - pull) * teams * 0.95 + between(-3, 3))));
    if (move === "promoted") position = Math.round(between(1, 6.4));
    if (move === "relegated") position = teams - Math.floor(between(0, 3));
    // Staying up is not going down: never in the bottom three when you stay.
    if (!move && division !== "premier" && next && next.club === club && position > teams - 4) position = teams - 5;
    if (!move && division === "premier" && position > teams - 3) position = teams - 4;

    // Your numbers.
    const apps = age <= 16 ? Math.round(between(6, 14)) : age <= 17 ? Math.round(between(16, 26))
      : age >= 35 ? Math.round(between(18, 30)) : Math.round(between(36, 50));
    const perGame = q * q * 0.95 * (SCORING[division] ?? 1) * (spec.position === "CAM" ? 0.6 : spec.position === "RW" ? 0.75 : 1);
    const goals = Math.max(0, Math.round(apps * perGame * between(0.85, 1.15)));
    const assists = Math.max(0, Math.round(goals * (spec.position === "CAM" ? 1.1 : 0.38) + between(0, 4)));
    const avgRating = Math.round(Math.min(8.95, 6.15 + 1.95 * q + between(-0.2, 0.2)) * 100) / 100;
    const motm = Math.round(apps * q * q * 0.3);
    if (goals >= apps * 0.6 && apps > 20) hatTricks += Math.round(between(1, 4));
    passes += apps * Math.round(14 + q * 20);
    totalRating += avgRating * apps; ratingCount += apps;
    archive.push({ season: s, club, apps, goals, assists, avgRating, motm });
    if (division === "premier") {
      plGoals += goals; plApps += Math.round(apps * 0.75);
      bestPlGoalsSeason = Math.max(bestPlGoalsSeason, Math.round(goals * 0.75));
      bestPlAssistsSeason = Math.max(bestPlAssistsSeason, Math.round(assists * 0.75));
    }

    // Trophies.
    const won: string[] = [];
    if (position === 1) won.push(TITLE[division]);
    // A big club wins a cup now and then; a small one almost never.
    const cupChance = division === "premier" ? strength * strength * 0.24 : 0.008;
    if (rng() < cupChance) won.push("FA Cup");
    if (rng() < (division === "premier" ? strength * strength * 0.2 : 0.01)) won.push("League Cup");
    if (division === "premier" && lastPosition <= 4 && strength >= 0.85 && rng() < 0.3) won.push("Champions League");
    else if (division === "premier" && lastPosition >= 4 && lastPosition <= 7 && rng() < 0.1) won.push("Europa League");
    // Third to sixth and still promoted: the play-offs.
    if (move === "promoted" && position >= 3) won.push("Play-Offs");
    for (const w of won) trophies.push({ season: s, competition: w, club });
    if (spec.capsFrom !== undefined && shape === "legend" && (s === 11 || s === 13)) {
      trophies.push({ season: s, competition: s === 13 ? "World Cup" : "European Championship", club: "England" });
    }

    // Individual awards.
    const bootLine = division === "premier" ? 24 : 22;
    if (goals >= bootLine && rng() < 0.75) awards.push({ season: s, kind: "Golden Boot", detail: `${goals} goals` });
    if (q > 0.78 && rng() < q - 0.45) awards.push({ season: s, kind: "Player of the Season", detail: `${goals} goals, ${assists} assists` });
    const months = q > 0.6 ? Math.floor(between(0, q * 3.2)) : 0;
    for (let m = 0; m < months; m++) awards.push({ season: s, kind: "Player of the Month", week: 4 + m * 9, detail: "" });

    // The Ballon d'Or: only from the top flight.
    let yourRank = 0;
    if (division === "premier") {
      const score = goals + assists * 0.6 + won.length * 4 + strength * 10;
      yourRank = score >= 70 && q >= 0.95 ? 1 : score >= 62 ? 2 : score >= 55 ? 3 : score >= 48 ? 5 : score >= 42 ? 7 : score >= 36 ? 10 : 0;
    }
    if (yourRank === 1) ballonDors++;
    const rival = pick(BALLON_RIVALS);
    const ballonDor = yourRank === 1
      ? { winner: `${spec.first} ${spec.last}`, club, yourRank: 1 }
      : { winner: rival[0], club: rival[1], yourRank };

    // Who won what.
    const leagueWinner = position === 1 ? club
      : division === "premier" ? pick(PL_GIANTS.filter(c => c !== club))
        : pick((DIVISION_CLUBS[division] ?? []).filter(c => c !== club));
    const winners: SeasonHistoryRow["winners"] = {
      league: leagueWinner,
      faCup: won.includes("FA Cup") ? club : pick(PL_GIANTS.filter(c => c !== club)),
      leagueCup: won.includes("League Cup") ? club : pick(PL_GIANTS.filter(c => c !== club)),
      ...(division === "premier" ? {
        championsLeague: won.includes("Champions League") ? club : pick(CL_GIANTS.filter(c => c !== club)),
        europaLeague: won.includes("Europa League") ? club : pick(EL_SIDES.filter(c => c !== club)),
      } : {}),
    };

    // Money, fame, caps.
    const wage = Math.round((division === "premier" ? 9000 : division === "championship" ? 2600 : division === "league_one" ? 900 : 450) * (0.3 + q * 1.4));
    money += wage * 38 * between(0.35, 0.55);
    fame = Math.min(100, fame + q * (division === "premier" ? 6.5 : 2.6) + won.length * 1.5);
    if (spec.capsFrom !== undefined && age >= spec.capsFrom && age <= 34) {
      const c = Math.round(between(5, 10) * q);
      caps += c;
      intlGoals += Math.round(c * perGame * 0.7);
    }
    history.push({
      season: s, age, club, division, position, teams, move, winners, ballonDor,
      mates: previewMates(club, strength, seed, s),
      stars: Math.round(18 + q * 80), overall: Math.round((1 + q * 4) * 2) / 2,
      fame: Math.round(fame), money: Math.round(money), wage, caps, intlGoals,
    });

    // A move at the end of the season.
    if (next && next.club !== club) {
      const fee = Math.round(q * q * (next.division === "premier" ? 60_000_000 : 6_000_000) * between(0.6, 1.2) / 10000) * 10000;
      transfers.push({ season: s, from: club, to: next.club, fee });
    }
    lastPosition = position;
  }

  const sum = (k: "apps" | "goals" | "assists" | "motm") => archive.reduce((n, r) => n + r[k], 0);
  const last = archive[total - 1];
  const finalClub = seasons[total - 1].club;
  let clubApps = 0;
  for (let i = total - 1; i >= 0 && seasons[i].club === finalClub; i--) clubApps += archive[i].apps;

  const mostGoals = [...archive].sort((a, b) => b.goals - a.goals)[0];
  const mostAssists = [...archive].sort((a, b) => b.assists - a.assists)[0];
  const ownedItems: OwnedItem[] = spec.items.map(([b, level]) => LIFESTYLE_ALL_LEVELS.find(it => (it.baseId ?? it.id) === b && (it.level ?? 3) === level))
    .filter((x): x is OwnedItem => !!x);
  const deals: BrandDeal[] = spec.sponsors.map(([brand, category, color], i) => ({
    id: `preview-${i}`, brand, category, color, weekly: 2000 + i * 900, seasonsLeft: 1, seasonsTotal: 3,
    guaranteed: 0, happiness: 70, targets: [],
  }));
  const peakQ = spec.ceiling;

  const state: CareerState = {
    ...base,
    player,
    season: total,
    division: seasons[total - 1].division,
    retired: finished,
    seasonStats: { appearances: last.apps, goals: last.goals, assists: last.assists, hatTricks: 0, passes: last.apps * 20, starMan: last.motm, totalRating: last.avgRating * last.apps, ratingCount: last.apps },
    careerStats: { appearances: sum("apps"), goals: sum("goals"), assists: sum("assists"), hatTricks, passes, starMan: sum("motm"), totalRating, ratingCount },
    careerLeagueStats: { goals: Math.round(plGoals * 0.75), assists: 0, appearances: plApps },
    personalBests: { "pl-goals-season": bestPlGoalsSeason, "pl-assists-season": bestPlAssistsSeason, "pl-goals-match": shape === "legend" ? 5 : 3 },
    seasonArchive: archive,
    seasonHistory: history,
    // A world to draw the farewell's sides from: every club that won
    // something, the giants, and your own clubs (their own squads).
    leagueSquads: previewWorld(
      [
        ...seasons.map(x => x.club), ...PL_GIANTS, ...CL_GIANTS, ...EL_SIDES, ...BALLON_RIVALS.map(([, c]) => c),
        ...history.flatMap(r => Object.values(r.winners).filter((w): w is string => !!w)),
      ],
      club => seasons.find(x => x.club === club)?.strength ?? (PL_GIANTS.includes(club) || CL_GIANTS.includes(club) ? 0.88 : 0.6),
    ),
    trophies,
    awards,
    ballonDorWins: ballonDors,
    caps,
    internationalGoals: intlGoals,
    transfers,
    clubAppearances: clubApps,
    careerBests: {
      furthestGoal: { metres: Math.round(between(28, 41)), season: Math.max(1, Math.round(total * 0.55)), opponent: pick(OPPONENTS) },
      furthestAssist: { metres: Math.round(between(35, 55)), season: Math.max(1, Math.round(total * 0.4)), opponent: pick(OPPONENTS) },
      mostGoalsMatch: { goals: shape === "legend" ? 5 : shape === "oneClub" ? 3 : 4, season: mostGoals.season, opponent: pick(OPPONENTS) },
      mostGoalsSeason: { goals: mostGoals.goals, season: mostGoals.season },
      mostAssistsSeason: { assists: mostAssists.assists, season: mostAssists.season },
    },
    headToHead: Object.fromEntries(OPPONENTS.map(o => [o, {
      wins: Math.round(between(2, 14) * peakQ), draws: Math.round(between(1, 6)), losses: Math.round(between(1, 9) * (1.2 - peakQ)),
    }])),
    money: Math.round(money),
    fame: Math.round(fame),
    stars: history[total - 1].stars,
    starRating: history[total - 1].overall,
    reputation: Math.round(40 + peakQ * 55),
    happiness: Math.round(between(60, 90)),
    relationships: {
      ...base.relationships,
      boss: Math.round(between(55, 90)), team: Math.round(between(60, 95)), fans: Math.round(between(55, 99)),
      girlfriend: spec.girlfriend ? Math.round(between(60, 95)) : null,
    },
    girlfriend: spec.girlfriend ? { name: spec.girlfriend, happiness: 80, gifts: 12 } : null,
    ownedItems,
    horse: spec.horse ? { name: "Golden Volley", breed: "Thoroughbred", speed: 88, stamina: 81, energy: 70, racesRun: 46, racesWon: 17, earnings: 2_350_000 } : null,
    brands: { deals, offers: [], news: [], paid: [], seq: deals.length },
    investments: spec.stake ? [{ club: spec.stake[0], percent: spec.stake[1], avgBuyValuation: 0 }] : [],
    governingBodyPresidencies: spec.president ? ["FA"] : [],
    son: spec.son ? { name: `${spec.last} Junior`, age: 14, overall: 58, club: null, playerId: null } : null,
    achievements: [],
    captain: shape === "oneClub" || shape === "legend",
  } as CareerState;
  state.achievements = ACHIEVEMENTS.filter(a => { try { return a.check(state); } catch { return false; } }).map(a => a.id);
  // A testimonial is paid on retiring (retire, retirement.ts): not before.
  state.testimonial = finished ? testimonialFor(state) : null;
  if (state.testimonial) state.money += state.testimonial.payout;
  return state;
}
