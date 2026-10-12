import type { CareerState, Fixture, LeagueTeam } from "./types";
import type { TransferOffer } from "./transfers";
import { acceptOffer } from "./transfers";
import { makeManager } from "./manager";
import {
  buildFixtures, buildLeague, buildSeasonFixtures, playLeagueWeek, simulateFixtureScore,
  updateLeagueWithUserResult, mulberry32,
} from "./season";
import { calendarMonthOf, divisionOf, fixtureTimestamp, transferWindowFor, type CareerDivision } from "./calendar";
import { membershipOf, estimateClubStrength, type DivisionMembership } from "./promotion";
import { moveSquadsWithLadder } from "./leagueSquads";
import { ruleBookFor } from "./ruleBook";
import { cupFixtureFor } from "./competitions";
import { requestOf, clearAfterWindow } from "./transferRequest";

/**
 * THE JANUARY MOVE (Leo, 11 Oct 2026).
 *
 * Before this, a deal you asked for always waited for the summer: joining a
 * club half-way through meant rebuilding the season's fixture list, and
 * `attachClub` only knows how to start one at week 1.
 *
 * Now, while the January window is open, an agreed deal can be signed there
 * and then. You join the new club in THIS season, at the week you are at:
 *
 *   - Same division: the table stays exactly as it is. Your fixtures become
 *     the new club's fixtures from the next round on. Your old club plays on
 *     without you, off the same schedule everybody else uses.
 *   - Another division: you swap to that division's real table, with every
 *     round up to now played (simulated) so it is not empty, and its
 *     fixtures from the round that falls on the same date.
 *   - Cups: you are cup-tied. A cup you already played in this season is
 *     over for you, even if the new club is still in it (it plays on
 *     without you). A cup you have not played in yet is yours to play for
 *     the new club, if the new club is still in it.
 *   - Europe: your old club's European run is over for you.
 *   - Your season's goals, apps and ratings are kept. Contract, wage, kit,
 *     manager, squad number and team-mates switch the same way they do in
 *     the summer (`acceptOffer`).
 */

/** Unplayed league fixtures: the round you are on is the earliest. */
function nextLeagueRound(career: CareerState): number | null {
  const weeks = career.fixtures
    .filter(f => !f.played && (f.kind ?? "league") === "league")
    .map(f => f.week);
  return weeks.length ? Math.min(...weeks) : null;
}

/** Is the January window open on the career's own calendar right now? */
export function januaryWindowOpen(career: CareerState): boolean {
  if (!career.player.club || career.league.length === 0) return false;
  return transferWindowFor(career.player.startYear, career.season, career.week, divisionOf(career)) === "january";
}

/** Can the agreed deal be signed now, mid-season? */
export function canMoveNow(career: CareerState): boolean {
  const agreed = requestOf(career).agreed;
  return !!agreed && agreed.club !== career.player.club
    && januaryWindowOpen(career) && nextLeagueRound(career) !== null;
}

/** True when this competition is closed to you this season (cup-tied). */
export function isCupTied(career: CareerState, competition: string | undefined): boolean {
  const t = career.cupTied;
  return !!competition && !!t && t.season === career.season && t.competitions.includes(competition);
}

const MEMBERSHIP_KEY: Record<CareerDivision, keyof DivisionMembership> = {
  premier: "premier", championship: "championship", league_one: "leagueOne",
  league_two: "leagueTwo", national_league: "nationalLeague",
  national_league_north: "nationalLeagueNorth", national_league_south: "nationalLeagueSouth",
};

/**
 * Another division's table "as it stands": every round before `upTo` played
 * off its real schedule. Same simulation the league uses for every game you
 * are not in (playLeagueWeek), with the new club's own game simulated too.
 */
export function simulateTableTo(
  career: CareerState, names: string[], club: string, upTo: number, squadsIn: CareerState["leagueSquads"],
): { league: LeagueTeam[]; squads: NonNullable<CareerState["leagueSquads"]> } {
  const squads = (squadsIn ?? []).map(sq => ({ ...sq, players: sq.players.map(p => ({ ...p })) }));
  let league: LeagueTeam[] = buildLeague(names, club)
    .map(t => ({ ...t, strength: estimateClubStrength(career, t.name) }));
  const rules = ruleBookFor(career, "FA");
  const schedule = buildSeasonFixtures(names);
  const rng = mulberry32(career.season * 92821 + names.length * 31 + club.length);
  for (let w = 1; w < upTo; w++) {
    const yours = schedule.find(f => f.week === w && (f.home === club || f.away === club));
    if (!yours) continue;
    const home = yours.home === club;
    const opponent = home ? yours.away : yours.home;
    const str = (n: string) => league.find(t => t.name === n)?.strength ?? 65;
    const sc = simulateFixtureScore(str(yours.home), str(yours.away), rng);
    const scored = home ? sc.home : sc.away;
    const conceded = home ? sc.away : sc.home;
    league = updateLeagueWithUserResult(league, club, opponent, scored, conceded, rules, rng);
    league = playLeagueWeek(league, w, { club, opponent, home, scored, conceded }, rng, squads, rules).league;
  }
  return { league, squads };
}

/**
 * Sign the agreed deal now, in the January window. Returns the career
 * unchanged when there is nothing to sign or the season has no league
 * football left to join.
 */
export function completeJanuaryMove(career: CareerState, offerIn?: TransferOffer): CareerState {
  const offer = offerIn ?? requestOf(career).agreed;
  if (!offer || offer.club === career.player.club) return career;
  const round = nextLeagueRound(career);
  if (round === null) return career;

  const oldDivision = divisionOf(career);
  const newDivision = offer.division ?? oldDivision;
  const sameDivision = newDivision === oldDivision;
  const newClub = offer.club;

  // Contract, wage, kit, squad, number, relationships: the summer's own rules.
  const signed = acceptOffer(career, offer);
  const moved: CareerState = {
    ...signed,
    // …but the manager is this season's man, not next season's.
    manager: makeManager(signed, newClub, career.season),
    // The season is not over: no "last season's team-mates" to keep.
    outgoingMates: career.outgoingMates,
    transfers: (signed.transfers ?? []).map((t, i, a) => (i === a.length - 1 ? { ...t, window: "january" as const } : t)),
    thisSeasonClub: newClub,
  };

  // ── The league ──
  let league = career.league;
  let leagueSquads = career.leagueSquads;
  let externalSquads = career.externalSquads;
  let results = career.results;
  let fromRound = round;
  if (sameDivision) {
    if (!league.some(t => t.name === newClub)) return career;
  } else {
    const names = membershipOf(career)[MEMBERSHIP_KEY[newDivision]];
    if (!names.includes(newClub)) return career;
    // The round of the new division that falls on (or after) today.
    const today = fixtureTimestamp(career.player.startYear, career.season, round, undefined, oldDivision);
    const rounds = Math.max(...buildSeasonFixtures(names).map(f => f.week));
    fromRound = rounds + 1;
    for (let w = 1; w <= rounds; w++) {
      if (fixtureTimestamp(career.player.startYear, career.season, w, undefined, newDivision) >= today) { fromRound = w; break; }
    }
    if (fromRound > rounds) return career;
    const swapped = moveSquadsWithLadder(career.leagueSquads ?? [], career.externalSquads ?? [], names);
    const sim = simulateTableTo(career, names, newClub, fromRound, swapped.leagueSquads);
    league = sim.league;
    leagueSquads = sim.squads;
    externalSquads = swapped.externalSquads;
    results = [];
  }
  const newLeagueFixtures = buildFixtures(league.map(t => t.name), newClub).filter(f => f.week >= fromRound);

  // ── Everything else on the calendar ──
  // Played matches stay (they are your season). Unplayed club matches (cup,
  // Europe, the old club's league games) go; internationals stay.
  const keep = career.fixtures.filter(f => f.played || f.kind === "international");
  const playedCups = new Set(
    career.fixtures.filter(f => f.played && f.kind === "cup" && f.competition).map(f => String(f.competition)),
  );
  const tied = Array.from(playedCups);

  let next: CareerState = {
    ...moved,
    division: newDivision,
    league,
    leagueSquads,
    externalSquads,
    results,
    fixtures: [...keep, ...newLeagueFixtures],
    cupTied: { season: career.season, competitions: tied },
    euroState: career.euroState && !career.euroState.winner && !career.euroState.eliminated
      ? { ...career.euroState, eliminated: true }
      : career.euroState,
    transferRequest: clearAfterWindow(career).transferRequest,
  };

  // A cup you have not played in yet: if the new club is still in it, its
  // next tie is yours.
  const cupFixtures: Fixture[] = [];
  for (const st of next.cupState ?? []) {
    if (st.winner || tied.includes(st.competition)) continue;
    const f = cupFixtureFor(st, next, st.rounds.length - 1);
    if (f) cupFixtures.push(f);
  }
  if (cupFixtures.length) next = { ...next, fixtures: [...next.fixtures, ...cupFixtures] };

  return next;
}

/** Still to come this season: we are between August and December. */
export function januaryAhead(career: CareerState): boolean {
  if (!career.player.club || career.league.length === 0) return false;
  const month = calendarMonthOf(career.player.startYear, career.season, career.week, divisionOf(career));
  return month >= 6;
}
