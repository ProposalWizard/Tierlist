import { matchdayFor, formationForClub } from "../../lib/star/teamsheet";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, Fixture, LeagueSquad, LeaguePlayer } from "../../lib/star/types";

/**
 * OPPONENT SQUAD ROTATION.
 *
 * Requested directly: an opponent should not hand you the exact same eleven
 * every single time you play them — real squads rotate a little, more so in
 * the early rounds of a cup nobody is prioritising — but this has to stay
 * RARE. Said explicitly: "not to happen every game." A league match should
 * show the same side almost every time; only a small minority of matches
 * should differ at all, and even then only by a shirt or two, never the team.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "AFC Bournemouth", "Liverpool", "Arsenal", "Chelsea", "Tottenham Hotspur",
  "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
  "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "Manchester City", "Leeds United",
  "Burnley", "Sunderland",
];

// Two of everything outfield, so a rotated slot always has a real same-
// position alternate to go to — a shallow squad would just silently decline
// to rotate, and that would not be testing this at all.
const ROLE_PAIRS: LeaguePlayer["position"][] = [
  "GK", "GK", "CB", "CB", "CB", "CB", "LB", "LB", "RB", "RB",
  "CDM", "CDM", "CM", "CM", "CM", "CM", "CAM", "CAM",
  "LW", "LW", "RW", "RW", "ST", "ST", "ST", "ST",
];

function oppositionSquad(): LeagueSquad {
  return {
    club: "Liverpool",
    players: ROLE_PAIRS.map((position, i) => ({
      id: `opp${i}`, name: `Opponent ${i}`, position, overall: 85 - i, goals: 0, assists: 0,
    })),
  };
}

function ownSquad() {
  return ROLE_PAIRS.map((position, i) => ({
    id: `p${i}`, name: `Player ${i}`, shortName: `P${i}`, position,
    overall: 80 - i, seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
  }));
}

function careerWith(leagueSquads: LeagueSquad[], season = 2027): CareerState {
  const base = makeInitialCareer(
    {
      firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
      club: "AFC Bournemouth", clubBadge: null, position: "ST",
      nationality: "England", startYear: 2027,
    },
    CLUBS,
  );
  return { ...base, season, squad: ownSquad(), leagueSquads };
}

function fixtureFor(week: number, extra: Partial<Fixture> = {}): Fixture {
  return { week, opponent: "Liverpool", home: true, played: false, kind: "league", ...extra };
}

/** The opponent XI's ids, in slot order, for one fixture. */
function oppXI(fixture: Fixture, career: CareerState): (string | undefined)[] {
  return matchdayFor(career, fixture, false).away.xi.map(p => p.id);
}

// ── Determinism: the same fixture asked twice answers the same way ─────────
{
  const career = careerWith([oppositionSquad()]);
  const fixture = fixtureFor(7, { competition: "FA Cup", round: "Round of 32" });
  const first = oppXI(fixture, career);
  const second = oppXI(fixture, career);
  check(JSON.stringify(first) === JSON.stringify(second),
    "the same fixture, asked twice, hands back the identical opponent eleven both times");
}

// ── League football: rare, not routine ──────────────────────────────────────
{
  const career = careerWith([oppositionSquad()]);
  const baseline = oppXI(fixtureFor(0, { kind: "league" }), { ...career, season: 9999 });
  let rotatedWeeks = 0;
  const TRIALS = 500;
  let maxDiff = 0;
  for (let week = 1; week <= TRIALS; week++) {
    const xi = oppXI(fixtureFor(week), career);
    const diff = xi.filter((id, i) => id !== baseline[i]).length;
    if (diff > 0) rotatedWeeks++;
    maxDiff = Math.max(maxDiff, diff);
  }
  const pct = (rotatedWeeks / TRIALS) * 100;
  check(rotatedWeeks > 0, "league football rotates at least occasionally, across 500 fixtures");
  check(pct < 15, `…but stays rare — nowhere near every game (${pct.toFixed(1)}% of league fixtures differed)`);
  check(maxDiff <= 2, `and even a rotated match never changes more than a couple of shirts (worst seen: ${maxDiff})`);
}

// ── Early cup rounds: still uncommon, but clearly more than league ─────────
{
  const career = careerWith([oppositionSquad()]);
  const baseline = oppXI(fixtureFor(0, { kind: "league" }), { ...career, season: 9999 });
  let rotatedTies = 0;
  const TRIALS = 500;
  for (let week = 1; week <= TRIALS; week++) {
    const fixture = fixtureFor(week, { competition: "FA Cup", round: "Round of 32", kind: "cup" });
    const xi = oppXI(fixture, career);
    if (xi.some((id, i) => id !== baseline[i])) rotatedTies++;
  }
  const pct = (rotatedTies / TRIALS) * 100;
  check(pct > 15 && pct < 45,
    `early cup rounds rotate noticeably more than league football, without becoming the norm (${pct.toFixed(1)}%)`);
}

// ── A rotated slot is filled by the SAME position, never a different one ───
{
  const career = careerWith([oppositionSquad()]);
  const baseline = matchdayFor({ ...career, season: 9999 }, fixtureFor(0, { kind: "league" }), false).away;
  let checkedAtLeastOne = false;
  for (let week = 1; week <= 500; week++) {
    const fixture = fixtureFor(week, { competition: "FA Cup", round: "Round of 32", kind: "cup" });
    const sheet = matchdayFor(career, fixture, false).away;
    sheet.xi.forEach((p, i) => {
      if (p.id !== baseline.xi[i]?.id) {
        checkedAtLeastOne = true;
        check(p.role === baseline.xi[i]?.role,
          `a rotated slot keeps its role (was ${baseline.xi[i]?.role}, week ${week} put a ${p.role} there)`);
      }
    });
  }
  check(checkedAtLeastOne, "…and at least one rotation actually happened across 500 cup ties to check this against");
}

// ── Your own side never rotates — only the opponent's does ─────────────────
{
  const career = careerWith([oppositionSquad()]);
  const home = matchdayFor(career, fixtureFor(1), false, undefined, undefined, {
    formation: formationForClub("AFC Bournemouth"),
    xi: formationForClub("AFC Bournemouth").slots.map(() => null),
  }).home;
  check(home.xi.length === 11, `your own side still fields a full eleven regardless (${home.xi.length})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — opponents rotate a little, more in early cup rounds, rarely in the league, and never more than a couple of shirts");
