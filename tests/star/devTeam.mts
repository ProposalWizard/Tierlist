import { moveToClub, devClubsByDivision, squadPlayerFromHit, addToSquad, removeFromSquad, setDevStart } from "../../lib/star/devTeam";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { matchdayFor } from "../../lib/star/teamsheet";
import { PREMIER_LEAGUE_CLUBS, LEAGUE_ONE_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS } from "../../lib/star/clubs";
import type { CareerState, Fixture, StarPlayer } from "../../lib/star/types";

/**
 * DEV CHEATS: move to any English club, add / remove / pin squad players.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = (club: string): StarPlayer => ({
  firstName: "Test", lastName: "Player", age: 19, skinTone: "light",
  club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
}) as StarPlayer;

const start = (): CareerState => makeInitialCareer(player("Liverpool"), [...PREMIER_LEAGUE_CLUBS].concat(["Liverpool"].filter(c => !PREMIER_LEAGUE_CLUBS.includes(c))), "premier");

// ── Every English division is offered, with real clubs ──
{
  const c = start();
  const divs = devClubsByDivision(c);
  check(divs.length === 7, `seven playable divisions offered (${divs.length})`);
  check(divs.every(d => d.clubs.length >= 20), "every division lists its clubs");
}

// ── Cross-division move rebuilds league, fixtures, squad ──
for (const [division, list] of [["league_one", LEAGUE_ONE_CLUBS], ["national_league_north", NATIONAL_LEAGUE_NORTH_CLUBS]] as const) {
  const c = start();
  const target = list[3];
  const moved = moveToClub(c, division, target)!;
  check(!!moved, `${division}: move succeeds`);
  if (!moved) continue;
  check(moved.player.club === target, `${division}: player is at ${target}`);
  check(moved.division === division, `${division}: career division switched`);
  check(moved.league.some(t => t.name === target) && moved.league.length === list.length,
    `${division}: table is that division's (${moved.league.length} vs ${list.length})`);
  check(!moved.league.some(t => t.name === "Arsenal"), `${division}: no Premier League clubs in the table`);
  check(moved.fixtures.some(f => f.opponent !== target) && moved.fixtures.every(f => f.opponent !== target), `${division}: fixtures never against himself`);
  check(moved.contract.club === target, `${division}: contract is with the new club`);
  check(moved.money === c.money, `${division}: no signing fee charged`);
  check(moved.divisions?.[division === "league_one" ? "leagueOne" : "nationalLeagueNorth"]?.includes(target) === true, `${division}: ladder membership knows the division`);
  check((moved.leagueSquads ?? []).every(s => list.includes(s.club)), `${division}: only this division's squads kept in leagueSquads`);
  check(moveToClub(c, division, "Arsenal") === null, `${division}: a club from another division is refused`);
}

// ── Add / remove / pin ──
const hit = { sofifaId: "99999", name: "K. Mbappé", club: "Real Madrid", overall: 91, positions: "ST, LW, CF", age: 27, shooting: 90, pace: 97 };
{
  const sp = squadPlayerFromHit(hit);
  check(sp.id === "sf_99999" && sp.position === "ST" && sp.overall === 91 && sp.shooting === 90 && !("passing" in sp), "search hit becomes a real SquadPlayer");
  check(JSON.stringify(sp.positions) === JSON.stringify(["ST", "LW"]), "unmodelled CF dropped from his positions");
  let c = start();
  const before = c.squad.length;
  c = addToSquad(c, sp, true);
  check(c.squad.length === before + 1 && c.squad.find(p => p.id === "sf_99999")?.devStart === true, "added and pinned");
  c = addToSquad(c, sp, false);
  check(c.squad.filter(p => p.id === "sf_99999").length === 1 && !c.squad.find(p => p.id === "sf_99999")?.devStart, "re-adding never duplicates");
  c = setDevStart(c, "sf_99999", true);
  check(c.squad.find(p => p.id === "sf_99999")?.devStart === true, "pin on");
  c = setDevStart(c, "sf_99999", false);
  check(!("devStart" in c.squad.find(p => p.id === "sf_99999")!), "pin off removes the flag");
  c = removeFromSquad(c, "sf_99999");
  check(c.squad.length === before, "removed");
}

// ── Pinned men start; nothing pinned changes nothing ──
{
  const fx: Fixture = { week: 3, opponent: "Arsenal", home: true, played: false };
  const base = start();
  const plain = matchdayFor(base, fx, true).home;
  check(plain.xi.length === 11, "baseline eleven");

  // A deliberately terrible striker and keeper, pinned.
  const weakST = { ...squadPlayerFromHit({ sofifaId: "1", name: "A. Weak", club: "x", overall: 30, positions: "ST" }) };
  const weakGK = { ...squadPlayerFromHit({ sofifaId: "2", name: "B. Weak", club: "x", overall: 30, positions: "GK" }) };
  let c = addToSquad(addToSquad(base, weakST, true), weakGK, true);
  const md = matchdayFor(c, fx, true).home;
  check(md.xi.length === 11, `still eleven with pins (${md.xi.length})`);
  check(new Set(md.xi.map(p => p.id)).size === 11, "nobody twice");
  check(md.xi.some(p => p.id === "sf_1"), "pinned striker starts");
  check(md.xi.some(p => p.id === "sf_2"), "pinned keeper starts");
  check(md.xi.filter(p => p.role === "GK").length === 1, "still exactly one goalkeeper");
  check(md.xi.some(p => p.isYou), "you still start");
  check(!md.bench.some(p => p.id === "sf_1" || p.id === "sf_2"), "pinned men are not also on the bench");
  const starting = new Set(md.xi.map(p => p.id));
  check(!md.bench.some(p => starting.has(p.id)), "nobody starts and sits");

  // Unpinned: the same weak men do not start.
  c = setDevStart(setDevStart(c, "sf_1", false), "sf_2", false);
  const md2 = matchdayFor(c, fx, true).home;
  check(!md2.xi.some(p => p.id === "sf_1" || p.id === "sf_2"), "unpinned weak men stay out");

  // Pinned and not starting yourself.
  const md3 = matchdayFor(setDevStart(addToSquad(base, weakST, false), "sf_1", true), fx, false).home;
  check(md3.xi.some(p => p.id === "sf_1"), "pin holds when you are not starting");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 20)) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — dev club move rebuilds the division, pinned players start");
