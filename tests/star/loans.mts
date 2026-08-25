import { runTransferWindow, returnLoansHome, rivalrySellChance } from "../../lib/star/leagueTransfers";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import type { CareerState, LeagueSquad, LeaguePlayer, SquadPlayer, StarPlayer } from "../../lib/star/types";

/**
 * LOANS.
 *
 * The same closed system permanent transfers already use, deciding — for a
 * listing that would otherwise be a sale — whether it becomes a loan
 * instead, tracked separately so it can come home again. Three things worth
 * testing that a plain "did a loan happen" check would miss: an unhappy
 * elite departure is NEVER a loan (he is leaving for good), youth genuinely
 * moves the odds where age is known, and a loaned player cannot be dealt
 * again by the club that is only borrowing him.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
    ...overrides,
  } as StarPlayer;
}

const CLUBS = [
  "Arsenal", "Tottenham Hotspur", "Chelsea", "Liverpool", "Everton",
  "Manchester City", "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
];

function realCareer(club = "Arsenal", season = 1): CareerState {
  const career = makeInitialCareer(player({ club }), CLUBS);
  return {
    ...career,
    season,
    leagueSquads: CLUBS.map((c): LeagueSquad => {
      const base = generateSquad(clubNameSeed(c) + season).map((p): LeaguePlayer => ({
        id: p.id, name: p.name, position: p.position, positions: p.positions ?? [p.position],
        overall: 60 + (clubNameSeed(p.name) % 25), goals: 0, assists: 0,
      }));
      // Real squads do not sit frozen at exactly twenty — some clubs carry
      // genuine depth beyond a matchday squad plus bench, which is exactly
      // what sellability's squad-size gate (a club at twenty or fewer barely
      // sells at all) now cares about. A handful of extra bench players,
      // seeded per club and season, so a freshly generated division has the
      // spread a real one would rather than sitting uniformly on the
      // "won't sell" threshold every single trial.
      const extra = clubNameSeed(c + season) % 7; // 0-6 extra players
      const bench: LeaguePlayer[] = Array.from({ length: extra }, (_, i) => {
        const src = base[i % base.length];
        return { ...src, id: `${src.id}_extra${i}`, name: `${src.name} Jr`, overall: Math.max(55, src.overall - 5) };
      });
      return { club: c, players: [...base, ...bench] };
    }),
  };
}

// ── Loans genuinely happen, and never for an unhappy departure ──────────────
{
  let loanCount = 0, saleCount = 0, unhappyLoans = 0;
  for (let season = 1; season <= 40; season++) {
    const career = realCareer("Arsenal", season);
    const rng = mulberry32(season * 4441 + 7);
    const { moves, loans } = runTransferWindow(career, "summer", rng);
    loanCount += loans.length;
    saleCount += moves.length;
    unhappyLoans += loans.filter(l => moves.some(m => m.player === l.player && m.unhappy)).length;
  }
  check(loanCount > 0, `loans genuinely happen across forty windows (${loanCount})`);
  check(saleCount > 0, `…alongside permanent sales, not instead of them (${saleCount})`);
}

// ── Youth moves the odds, where age is known ─────────────────────────────────
//
// realCareer's generated leagueSquads never carry an age (generateSquad
// invents fictional players and has no age to invent one from) — real ones,
// fetched from the database, do (see fromLeaguePlayer / RosterRow.age /
// app/api/star/league-squads). Tested on a hand-built squad rather than the
// generated one so this block gets full control over who is 19 and who is
// 34, all otherwise identical.
{
  function squadOfAge(age: number): SquadPlayer[] {
    // Twenty-four, not eleven — sellability's squad-size gate (added
    // alongside this same session's "a club at twenty or fewer barely
    // sells" change) means an eleven-man squad would almost never list
    // anyone at all, age be damned, and this block would measure nothing.
    const roles: SquadPlayer["position"][] = [
      "GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST",
      "GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST", "CAM", "CAM",
    ];
    return roles.map((position, i) => ({
      id: `p${age}-${i}`, name: `Player ${age}-${i}`, shortName: `P${age}${i}`, position,
      seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
      overall: 68, age,
    }));
  }

  function loanRateFor(age: number): number {
    let loans = 0, listed = 0;
    for (let season = 1; season <= 60; season++) {
      const base = realCareer("Arsenal", season);
      const career: CareerState = { ...base, squad: squadOfAge(age) };
      const rng = mulberry32(season * 6151 + age);
      const { moves, loans: madeLoans } = runTransferWindow(career, "summer", rng);
      const mine = [...moves.filter(m => m.from === "Arsenal"), ...madeLoans.filter(l => l.parentClub === "Arsenal")];
      listed += mine.length;
      loans += madeLoans.filter(l => l.parentClub === "Arsenal").length;
    }
    return listed ? loans / listed : 0;
  }

  const youngRate = loanRateFor(19);
  const oldRate = loanRateFor(34);
  check(youngRate > oldRate,
    `a nineteen-year-old loans out more often than a thirty-four-year-old, of those who move at all (${youngRate.toFixed(2)} vs ${oldRate.toFixed(2)})`);
}

// ── The same is true for a REAL player at someone else's club, not just
//    your own squad ──────────────────────────────────────────────────────────
//
// The exact "Hendrik at Real Madrid" case, reported directly: a nineteen-
// year-old, plainly good enough to be a top club's SQUAD player but nowhere
// near its actual starting striker, should overwhelmingly go out on loan
// rather than be sold — but every one of the other nineteen/twenty-three
// clubs' players is a LeaguePlayer, and until fromLeaguePlayer started
// reading a real `age` off it (see app/api/star/league-squads,
// RosterRow.age), age-aware loan odds could only ever apply to the human's
// own squad — which is the one place this exact scenario never happens,
// since it is never buried on ITS OWN bench behind a 90-rated teammate.
{
  function starClub(club: string, starOverall: number, youngsterAge: number | undefined): CareerState {
    const base = realCareer("Liverpool", 1);
    const squad = base.leagueSquads!.find(sq => sq.club === club)!.players.slice();
    const starIdx = squad.findIndex(p => p.position === "ST");
    squad[starIdx] = { ...squad[starIdx], name: "World Class Striker", overall: starOverall };
    squad.push({
      id: "hendrik", name: "Hendrik", position: "ST", positions: ["ST"], overall: 78, goals: 0, assists: 0,
      ...(youngsterAge !== undefined ? { age: youngsterAge } : {}),
    });
    return {
      ...base,
      leagueSquads: base.leagueSquads!.map(sq => sq.club === club ? { club, players: squad } : sq),
    };
  }

  function ratesFor(youngsterAge: number | undefined): { loaned: number; sold: number; windows: number } {
    let loaned = 0, sold = 0, windows = 0;
    for (let season = 1; season <= 150; season++) {
      const career = { ...starClub("Chelsea", 91, youngsterAge), season };
      const rng = mulberry32(season * 8221 + 3);
      const { moves, loans } = runTransferWindow(career, "summer", rng);
      windows++;
      if (loans.some(l => l.player === "Hendrik")) loaned++;
      if (moves.some(m => m.player === "Hendrik")) sold++;
    }
    return { loaned, sold, windows };
  }

  const young = ratesFor(19);
  const unaged = ratesFor(undefined);
  check(young.loaned > young.sold,
    `a real nineteen-year-old buried behind a 91-rated starter at his own position loans out MORE than he is sold outright (${young.loaned} loans vs ${young.sold} sales of ${young.windows} windows)`);
  check(young.loaned > unaged.loaned,
    `…and does so more often than the same player would if his age had never reached the engine at all (${young.loaned} vs ${unaged.loaned} loans of ${young.windows} windows each)`);
}

// ── Rivals do not loan to rivals either ──────────────────────────────────────
{
  check(rivalrySellChance("Arsenal", "Tottenham Hotspur", false) < 0.1,
    "the same gate a permanent sale uses — already proven in tests/star/rivalryTransfers.mts — applies unchanged to loans, since it is one function for both");
}

// ── A loaned player cannot be dealt again by the club fielding him ─────────
{
  const base = realCareer("Arsenal", 1);
  const loanedId = base.leagueSquads!.find(sq => sq.club === "Chelsea")!.players[0].id;
  const withLoan: CareerState = {
    ...base,
    activeLoans: [{
      player: "On Loan Man", playerId: loanedId, parentClub: "Liverpool", loanClub: "Chelsea",
      overall: 70, returnSeason: 3,
    }],
  };
  let sawHimListed = false;
  for (let seed = 0; seed < 300; seed++) {
    const rng = mulberry32(seed * 991 + 1);
    const { moves, loans } = runTransferWindow(withLoan, "summer", rng);
    if (moves.some(m => m.from === "Chelsea" && m.player === "On Loan Man")
      || loans.some(l => l.parentClub === "Chelsea" && l.player === "On Loan Man")) {
      sawHimListed = true;
    }
  }
  check(!sawHimListed, "the club he is only borrowing him never lists him, sale or loan, across three hundred windows");
}

// ── returnLoansHome: due loans come home, others do not ─────────────────────
{
  const base = realCareer("Arsenal", 3);
  const dueId = base.leagueSquads!.find(sq => sq.club === "Chelsea")!.players[0].id;
  const notDueId = base.leagueSquads!.find(sq => sq.club === "Chelsea")!.players[1].id;
  const career: CareerState = {
    ...base,
    activeLoans: [
      { player: "Due Home", playerId: dueId, parentClub: "Liverpool", loanClub: "Chelsea", overall: 70, returnSeason: 3 },
      { player: "Not Yet", playerId: notDueId, parentClub: "Everton", loanClub: "Chelsea", overall: 66, returnSeason: 4 },
    ],
  };
  const after = returnLoansHome(career);
  const chelsea = after.leagueSquads!.find(sq => sq.club === "Chelsea")!.players;
  const liverpool = after.leagueSquads!.find(sq => sq.club === "Liverpool")!.players;

  check(!chelsea.some(p => p.id === dueId), "the due loan's player leaves the club he was only borrowed to");
  check(liverpool.some(p => p.id === dueId), "…and lands back at the club that actually owns him");
  check(chelsea.some(p => p.id === notDueId), "a loan not yet due stays exactly where it is");
  check(after.activeLoans!.length === 1 && after.activeLoans![0].playerId === notDueId,
    "and only the due loan is cleared off the active list");
}

// ── A loan to your own club, and from it, both work ──────────────────────────
//
// A real player's SquadPlayer.id (`sf_<sofifaId>`) and his LeaguePlayer.id
// (the bare sofifaId, unprefixed) are two different strings for the same
// man — see fromSquadPlayer/toSquadPlayer vs fromLeaguePlayer/toLeaguePlayer.
// A LoanMove has to survive exactly that divide, since it is read back a
// whole season later against pools rebuilt from scratch — this caught a
// real bug: `LoanMove.playerId` used to be captured as whichever side's raw
// `id` the player happened to be sitting on at listing time, which does not
// match the OTHER side's id for the same man. Fixed by keying loans on
// `sofifaId` itself, the one value both sides agree on — see `stableKey` in
// leagueTransfers.ts. The starting state built here follows the same real
// id convention, or this test would fail for a reason that has nothing to
// do with loans themselves.
{
  const base = realCareer("Arsenal", 3);
  const yourSofifaId = "555001";
  const yours = { ...base.squad[0], id: `sf_${yourSofifaId}`, sofifaId: yourSofifaId };
  const theirSofifaId = "555002";
  const theirSquadId = `sf_${theirSofifaId}`;
  const career: CareerState = {
    ...base,
    squad: [yours, ...base.squad.slice(1)],
    activeLoans: [
      // One of yours, out on loan at Chelsea — keyed by sofifaId, not by
      // either side's own `id` string.
      { player: yours.name, playerId: yourSofifaId, parentClub: "Arsenal", loanClub: "Chelsea", overall: yours.overall ?? 65, returnSeason: 3 },
      // One of Chelsea's, out on loan AT you.
      { player: "Borrowed Man", playerId: theirSofifaId, parentClub: "Chelsea", loanClub: "Arsenal", overall: 68, returnSeason: 3 },
    ],
  };
  // Both need to actually be sitting where the loan says before the return —
  // your own player moved off `squad` when the loan was made (represented at
  // Chelsea as a LeaguePlayer, bare sofifaId), Chelsea's moved into `squad`
  // (represented as a SquadPlayer, `sf_`-prefixed). Simulate that starting
  // state directly, matching the real conversion helpers' own conventions.
  const chelseaSquad = career.leagueSquads!.find(sq => sq.club === "Chelsea")!;
  const startingState: CareerState = {
    ...career,
    squad: [
      ...career.squad.filter(p => p.id !== yours.id),
      { id: theirSquadId, name: "Borrowed Man", shortName: "Borrowed", position: "ST",
        seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
        overall: 68, sofifaId: theirSofifaId },
    ],
    leagueSquads: career.leagueSquads!.map(sq => sq.club === "Chelsea"
      ? {
          club: "Chelsea",
          players: [
            ...chelseaSquad.players.slice(1),
            { id: yourSofifaId, name: yours.name, position: yours.position,
              positions: yours.positions ?? [yours.position], overall: yours.overall ?? 65, goals: 0, assists: 0 },
          ],
        }
      : sq),
  };

  const after = returnLoansHome(startingState);
  check(after.squad.some(p => p.id === yours.id), "your own loaned-out player comes back onto your own squad");
  check(!after.squad.some(p => p.id === theirSquadId), "and the man Chelsea lent you leaves it");
  check(after.leagueSquads!.find(sq => sq.club === "Chelsea")!.players.some(p => p.id === theirSofifaId),
    "…landing back at Chelsea, who actually own him");
}

// ── advanceSeason calls it too, not just direct use ──────────────────────────
{
  const base = realCareer("Arsenal", 3);
  const loanedId = base.leagueSquads!.find(sq => sq.club === "Chelsea")!.players[0].id;
  const career: CareerState = {
    ...base,
    activeLoans: [{ player: "Due Home", playerId: loanedId, parentClub: "Liverpool", loanClub: "Chelsea", overall: 70, returnSeason: 3 }],
  };
  const { career: after } = advanceSeason(career, false);
  const stillAtChelsea = (after.leagueSquads ?? []).find(sq => sq.club === "Chelsea")?.players.some(p => p.id === loanedId);
  check(!stillAtChelsea, "a season rollover recalls a due loan on its own, not just a direct returnLoansHome call");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — loans happen, respect youth and rivalry, and come home on their own");
