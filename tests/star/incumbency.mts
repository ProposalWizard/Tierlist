import { advanceIncumbencyWeek, incumbencyRecordsFor, graceGamesFor } from "../../lib/star/incumbency";
import { formationForClub } from "../../lib/star/clubFormation";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, LeagueResult, StarPlayer } from "../../lib/star/types";
import type { Role } from "../../lib/star/formations";

/**
 * A GRACE PERIOD BEFORE THE BETTER BENCH PLAYER TAKES THE JOB.
 *
 * Requested directly, in full mechanical detail: a newly-signed, higher-
 * rated player doesn't take over the starting XI the instant he's signed —
 * the incumbent gets real games to keep proving himself first, fewer the
 * bigger the rating gap, judged by goal contributions for the attacking
 * positions and by the team's own result for everyone else. A demoted
 * starter isn't gone for good — he gets a real recall specifically for a
 * cup tie (see teamsheet.mts's own coverage of that half).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 20, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

const CLUB = PREMIER_LEAGUE_CLUBS.find(c => c !== "Arsenal")!; // never the player's own club
const RIVAL = PREMIER_LEAGUE_CLUBS.find(c => c !== "Arsenal" && c !== CLUB)!;

function baseCareer(): CareerState {
  return makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
}

/** A real squad for CLUB, its own real formation, with a chosen starting
 *  striker (index < 11) and a chosen bench striker (index >= 11) — every
 *  other slot filled with plain, unremarkable players so bestFitness has
 *  no other real ST-capable candidate to confuse the pairing. */
function squadWithStrikers(club: string, starterOverall: number, benchOverall: number): LeagueSquad {
  const formation = formationForClub(club);
  const roles = formation.slots.map(s => s.role);
  const nonSt = roles.filter(r => r !== "ST");
  const players: LeaguePlayer[] = [];
  let id = 0;
  // Starting XI: the chosen striker plus a real fit for every OTHER slot.
  players.push({ id: `${club}-st-starter`, name: "Incumbent Striker", position: "ST", overall: starterOverall, goals: 0, assists: 0 });
  for (const role of nonSt) {
    players.push({ id: `${club}-${id++}`, name: `${club} Player ${id}`, position: role, overall: 70, goals: 0, assists: 0 });
  }
  // Bench, starting at index 11: the challenger striker, then padding.
  while (players.length < 11) players.push({ id: `${club}-pad-${id++}`, name: `Pad ${id}`, position: "CM", overall: 60, goals: 0, assists: 0 });
  players.push({ id: `${club}-st-bench`, name: "Challenger Striker", position: "ST", overall: benchOverall, goals: 0, assists: 0 });
  while (players.length < 18) players.push({ id: `${club}-pad-${id++}`, name: `Pad ${id}`, position: "CM", overall: 55, goals: 0, assists: 0 });
  return { club, players };
}

function noResults(): LeagueResult[] { return []; }

// ── graceGamesFor: the exact agreed curve ────────────────────────────────
{
  check(graceGamesFor(1) === 3, `a barely-there gap earns full grace (${graceGamesFor(1)})`);
  check(graceGamesFor(2) === 2, `a real 2-point gap earns slightly less (${graceGamesFor(2)})`);
  check(graceGamesFor(4) === 1, `a real 4-point gap earns much less grace (${graceGamesFor(4)})`);
  check(graceGamesFor(6) === 0, `a wide 6-point gap earns none at all — the challenger starts immediately (${graceGamesFor(6)})`);
  check(graceGamesFor(0) === 3, `a challenger who ISN'T actually better yet gets treated the same as a tiny gap (${graceGamesFor(0)})`);
}

// ── A small gap: the incumbent survives real failures before losing his job ──
{
  let career: CareerState = { ...baseCareer(), leagueSquads: [squadWithStrikers(CLUB, 85, 86)] };
  const starterId = `${CLUB}-st-starter`;
  const challengerId = `${CLUB}-st-bench`;

  // Week 1: the rivalry is only just detected this week — a fresh
  // baseline, never an immediate fail.
  career = advanceIncumbencyWeek(career, noResults());
  let squad = career.leagueSquads!.find(s => s.club === CLUB)!;
  check(squad.players.slice(0, 11).some(p => p.id === starterId), "week 1: the incumbent is still genuinely in the starting XI");
  const rec1 = incumbencyRecordsFor(career, CLUB).find(r => r.position === "ST");
  check(!!rec1 && rec1.starterId === starterId, `week 1: a real rivalry is now tracked, incumbent still holds it (${JSON.stringify(rec1)})`);

  // Weeks 2-4: no goals for anyone — three real failures, the exact grace
  // this gap (86-85=1) earns him.
  for (let w = 0; w < 3; w++) {
    career = advanceIncumbencyWeek(career, noResults());
    squad = career.leagueSquads!.find(s => s.club === CLUB)!;
    check(squad.players.slice(0, 11).some(p => p.id === starterId),
      `week ${w + 2}: still within his grace, still starting`);
  }

  // One more scoreless week exhausts it.
  career = advanceIncumbencyWeek(career, noResults());
  squad = career.leagueSquads!.find(s => s.club === CLUB)!;
  check(squad.players.slice(0, 11).some(p => p.id === challengerId), "grace exhausted: the better challenger is now genuinely in the starting XI");
  check(!squad.players.slice(0, 11).some(p => p.id === starterId), "…and the old incumbent has genuinely moved to the bench");
  const rec2 = incumbencyRecordsFor(career, CLUB).find(r => r.position === "ST");
  check(rec2?.starterId === challengerId && rec2?.previousStarterId === starterId,
    `the record reflects the real swap, remembering who was demoted (${JSON.stringify(rec2)})`);
}

// ── A wide gap: no grace period at all ───────────────────────────────────
{
  let career: CareerState = { ...baseCareer(), leagueSquads: [squadWithStrikers(RIVAL, 80, 90)] };
  career = advanceIncumbencyWeek(career, noResults());
  const squad = career.leagueSquads!.find(s => s.club === RIVAL)!;
  check(squad.players.slice(0, 11).some(p => p.id === `${RIVAL}-st-bench`),
    "a ten-point gap promotes the challenger the very first week — no grace period to wait out");
}

// ── A real contribution resets grace back to full ────────────────────────
{
  let career: CareerState = { ...baseCareer(), leagueSquads: [squadWithStrikers(CLUB, 85, 86)] };
  career = advanceIncumbencyWeek(career, noResults()); // week 1: baseline
  // Two scoreless weeks spend two of his three grace games.
  career = advanceIncumbencyWeek(career, noResults());
  career = advanceIncumbencyWeek(career, noResults());
  let rec = incumbencyRecordsFor(career, CLUB).find(r => r.position === "ST")!;
  check(rec.graceRemaining === 1, `two real failures have spent two of his three grace games (${rec.graceRemaining})`);

  // He scores — credit it the same way nameGoals/creditNamedGoals do, on
  // the real squad object, then advance the week.
  career = {
    ...career,
    leagueSquads: career.leagueSquads!.map(s => s.club !== CLUB ? s : {
      ...s, players: s.players.map(p => p.id === `${CLUB}-st-starter` ? { ...p, goals: p.goals + 1 } : p),
    }),
  };
  career = advanceIncumbencyWeek(career, noResults());
  rec = incumbencyRecordsFor(career, CLUB).find(r => r.position === "ST")!;
  check(rec.graceRemaining === 3, `a real goal resets his grace straight back to full (${rec.graceRemaining})`);
  const squad = career.leagueSquads!.find(s => s.club === CLUB)!;
  check(squad.players.slice(0, 11).some(p => p.id === `${CLUB}-st-starter`), "…and he's still genuinely the starter");
}

// ── Non-attacking positions are judged by team result, not contributions ──
{
  const formation = formationForClub(CLUB);
  const cbRole: Role = formation.slots.some(s => s.role === "CB") ? "CB" : "CDM";
  // Every OTHER real slot filled first (index 0-9), the incumbent taking
  // the tenth starting spot (index 10), THEN the challenger — genuinely
  // on the bench (index 11+), not just the eleventh starting name. Only
  // the FIRST occurrence of a duplicated role (a formation with two CBs,
  // say) is skipped to make room for the incumbent; a second real slot of
  // that same role still gets its own filler.
  const roles = formation.slots.map(s => s.role);
  const firstCbIndex = roles.indexOf(cbRole);
  const players: LeaguePlayer[] = [];
  roles.forEach((role, i) => {
    if (i === firstCbIndex) return;
    players.push({ id: `${CLUB}-fill-${i}`, name: `Fill ${role}`, position: role, overall: 70, goals: 0, assists: 0 });
  });
  // A small, 1-point gap — full grace (3), matching the earlier attacking-
  // position test, so this block tests the RESULT-based judgment specifically,
  // not a second copy of the immediate-swap case.
  players.push({ id: "def-starter", name: "Incumbent Defender", position: cbRole, overall: 80, goals: 0, assists: 0 });
  players.push({ id: "def-bench", name: "Challenger Defender", position: cbRole, overall: 81, goals: 0, assists: 0 });
  while (players.length < 18) players.push({ id: `${CLUB}-pad-${players.length}`, name: "Pad", position: "CM", overall: 55, goals: 0, assists: 0 });

  let career: CareerState = { ...baseCareer(), leagueSquads: [{ club: CLUB, players }] };
  career = advanceIncumbencyWeek(career, noResults()); // week 1: baseline

  // A genuine loss for this club, three weeks running — the same "real
  // miss spends a grace game" rule, judged by result instead of goals.
  const lossResult = (): LeagueResult[] => [{ week: 1, home: CLUB, away: "Nobody FC", hs: 0, as: 1 }];
  for (let w = 0; w < 3; w++) career = advanceIncumbencyWeek(career, lossResult());
  let squad = career.leagueSquads!.find(s => s.club === CLUB)!;
  check(squad.players.slice(0, 11).some(p => p.id === "def-starter"), "still within his grace after three losses (the same curve, judged on results)");

  career = advanceIncumbencyWeek(career, lossResult());
  squad = career.leagueSquads!.find(s => s.club === CLUB)!;
  check(squad.players.slice(0, 11).some(p => p.id === "def-bench"),
    "a fourth straight loss exhausts his grace — the challenger takes over, judged entirely on results, never a contribution he could never have got");

  // And a win/draw genuinely counts as a pass — reset grace with a fresh
  // rivalry (same club, same real formation, so the role is guaranteed to
  // still be one `advanceIncumbencyWeek` actually checks).
  const freshCareer: CareerState = { ...baseCareer(), leagueSquads: [{ club: CLUB, players }] };
  let c2 = advanceIncumbencyWeek(freshCareer, noResults());
  const winResult = (): LeagueResult[] => [{ week: 1, home: CLUB, away: "Nobody FC", hs: 2, as: 0 }];
  c2 = advanceIncumbencyWeek(c2, winResult());
  const rec = incumbencyRecordsFor(c2, CLUB).find(r => r.position === cbRole)!;
  check(rec.graceRemaining === graceGamesFor(1), `a real win resets grace to full rather than spending one (${rec.graceRemaining})`);
}

// ── The human player's own club is never touched ─────────────────────────
{
  const career: CareerState = { ...baseCareer(), leagueSquads: [squadWithStrikers("Arsenal", 85, 95)] };
  const after = advanceIncumbencyWeek(career, noResults());
  check((after.incumbents ?? []).every(r => r.club !== "Arsenal"), "no incumbency record is ever created for the human player's own club");
  const squad = after.leagueSquads!.find(s => s.club === "Arsenal")!;
  check(squad.players.slice(0, 11).some(p => p.id === "Arsenal-st-starter"),
    "…and its own squad order is left completely untouched, however wide the gap");
}

// ── No strictly-better bench player means no rivalry at all ──────────────
{
  const career: CareerState = { ...baseCareer(), leagueSquads: [squadWithStrikers(CLUB, 85, 85)] };
  const after = advanceIncumbencyWeek(career, noResults());
  check((after.incumbents ?? []).length === 0, "an equally-rated bench player is just depth, never a real rivalry");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a better bench player earns a real, rating-gap-sized grace period before taking the starting job, judged by goal contributions for attacking roles and by result everywhere else, never touching the human's own club");
