import type { LeagueSquad, SquadPlayer } from "./types";
import { isRegenId, type RetiredPlayer } from "./worldAgeing";

/**
 * WHO THE MEDIA TALKS ABOUT AT THE ROLLOVER.
 *
 * worldAgeing.ts retires hundreds of men a season across the world. Only a
 * few are news: every one of YOUR team-mates (always), and the best-known
 * names elsewhere. This picks them, with the numbers that are real for each
 * (read off the squads BEFORE the rollover zeroed the season tallies), and
 * the boys worth watching among this season's regens.
 *
 * Kept small on purpose: the notes are saved on the career
 * (`CareerState.lastRetirements`) for one rollover, so the media pass can
 * run after advanceSeason without re-running the ageing.
 */

export interface RetirementNote {
  id: string;
  name: string;
  club: string;
  /** His age in the season he just finished. */
  age: number;
  position: string;
  /** True for your own team-mate. */
  own: boolean;
  /** His rating in his last season, when the squad has one. */
  overall?: number;
  /** Goals/assists in the season just finished (other clubs' men). */
  seasonGoals?: number;
  seasonAssists?: number;
  /** Goals/assists while your team-mate (your own club only). */
  goalsWithUs?: number;
  assistsWithUs?: number;
}

/** A man elsewhere must be at least this good to be news on retiring. */
export const FAMOUS_MIN_OVERALL = 76;
/** The best retiree in your own division is news from this rating. */
export const DIVISION_LEGEND_MIN = 66;
/** At most this many retirements from outside your club a season. */
export const MAX_FAMOUS = 3;
/** At most this many "one to watch" regens a season. */
export const MAX_REGENS = 3;

/**
 * The retirements worth a post. `retired` is the list the rollover's
 * ageing returned (league + external + your own squad); `before` is the
 * career's squads as they were before the rollover touched them.
 */
export function notableRetirements(
  retired: RetiredPlayer[],
  before: { leagueSquads?: LeagueSquad[]; externalSquads?: LeagueSquad[]; squad?: SquadPlayer[] },
  ownClub: string,
): RetirementNote[] {
  const leagueById = new Map<string, { overall: number; goals: number; assists: number }>();
  for (const s of [...(before.externalSquads ?? []), ...(before.leagueSquads ?? [])]) {
    for (const p of s.players) leagueById.set(`${s.club}|${p.id}`, { overall: p.overall, goals: p.goals, assists: p.assists });
  }
  const divisionClubs = new Set((before.leagueSquads ?? []).map(s => s.club));
  const squadById = new Map((before.squad ?? []).map(p => [p.id, p]));

  const own: RetirementNote[] = [];
  const others: (RetirementNote & { inDivision: boolean })[] = [];
  const seen = new Set<string>();
  for (const r of retired) {
    if (r.club === ownClub && squadById.has(r.id)) {
      const p = squadById.get(r.id)!;
      if (seen.has(`own|${p.name}`)) continue;
      seen.add(`own|${p.name}`);
      own.push({
        id: r.id, name: r.name, club: r.club, age: r.age, position: r.position, own: true,
        ...(typeof p.overall === "number" ? { overall: p.overall } : {}),
        ...(p.careerGoals > 0 ? { goalsWithUs: p.careerGoals } : {}),
        ...(p.careerAssists > 0 ? { assistsWithUs: p.careerAssists } : {}),
      });
      continue;
    }
    // Your club's copy in leagueSquads retires the same men: told once, above.
    if (r.club === ownClub) continue;
    if (isRegenId(r.id) || r.id.startsWith("sp_")) continue;   // invented men are not famous
    const l = leagueById.get(`${r.club}|${r.id}`);
    if (!l) continue;
    others.push({
      id: r.id, name: r.name, club: r.club, age: r.age, position: r.position, own: false,
      overall: l.overall,
      ...(l.goals > 0 ? { seasonGoals: l.goals } : {}),
      ...(l.assists > 0 ? { seasonAssists: l.assists } : {}),
      inDivision: divisionClubs.has(r.club),
    });
  }

  others.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0) || a.name.localeCompare(b.name));
  const famous = others.filter(o => (o.overall ?? 0) >= FAMOUS_MIN_OVERALL).slice(0, MAX_FAMOUS);
  const legend = others.find(o => o.inDivision && (o.overall ?? 0) >= DIVISION_LEGEND_MIN);
  if (legend && !famous.includes(legend)) {
    if (famous.length >= MAX_FAMOUS) famous[MAX_FAMOUS - 1] = legend;
    else famous.push(legend);
  }
  // Drop the helper field so the save stays the declared shape.
  return [...own, ...famous.map(({ inDivision: _d, ...n }) => n)];
}

export interface RegenNote {
  id: string;
  name: string;
  club: string;
  age: number;
  position: string;
  overall?: number;
  worldClass: boolean;
  own: boolean;
}

/**
 * The boys this rollover brought in who are worth watching: High Potential
 * regens made at the season `season` rollover (ids "rg<season>."). Your own
 * club's first, then World Class before High Potential, then rating.
 */
export function promisingRegens(
  after: { leagueSquads?: LeagueSquad[]; externalSquads?: LeagueSquad[]; squad?: SquadPlayer[] },
  ownClub: string,
  season: number,
): RegenNote[] {
  const prefix = `rg${season}.`;
  const out: RegenNote[] = [];
  const seen = new Set<string>();
  for (const p of after.squad ?? []) {
    if (!p.id.startsWith(prefix) || !p.highPotential || typeof p.age !== "number") continue;
    seen.add(p.id);
    out.push({
      id: p.id, name: p.name, club: ownClub, age: p.age, position: p.position,
      ...(typeof p.overall === "number" ? { overall: p.overall } : {}),
      worldClass: !!p.worldClassPotential, own: true,
    });
  }
  for (const s of [...(after.leagueSquads ?? []), ...(after.externalSquads ?? [])]) {
    for (const p of s.players) {
      if (!p.id.startsWith(prefix) || !p.highPotential || typeof p.age !== "number" || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({
        id: p.id, name: p.name, club: s.club, age: p.age, position: p.position, overall: p.overall,
        worldClass: !!p.worldClassPotential, own: s.club === ownClub,
      });
    }
  }
  out.sort((a, b) => Number(b.own) - Number(a.own) || Number(b.worldClass) - Number(a.worldClass)
    || (b.overall ?? 0) - (a.overall ?? 0) || a.name.localeCompare(b.name));
  return out.slice(0, MAX_REGENS);
}
