import {
  buildLeagueSquad, relabelOutOfPosition, moveSquadsWithLadder, withoutPlayersElsewhere, addFullRoster, nameGoals,
  type RosterRow,
} from "../../lib/star/leagueSquads";
import { mulberry32 } from "../../lib/star/season";
import type { LeagueSquad, LeaguePlayer } from "../../lib/star/types";

/**
 * Mikey's farewell playtest (8 Oct 2026):
 *  - Man City's centre-back Khusanov won the Golden Boot as a striker: the
 *    squad builder labelled him with the slot he filled (their second
 *    striker) when nothing in his positions fit it.
 *  - After 19 seasons Man United and Wolves lined up as on day one: squads
 *    were dropped on relegation and refetched fresh on promotion, and your
 *    new club was refetched over its own transfers.
 *  - Assists were bunched: the assist king on 10-14.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── 1. A centre-back filling a striker slot stays a centre-back ──
const city: RosterRow[] = [
  { id: "gk", name: "Keeper", positions: "GK", overall: 85 },
  { id: "gk2", name: "Keeper Two", positions: "GK", overall: 78 },
  { id: "st", name: "Erling Haaland", positions: "ST", overall: 91 },
  ...["CB", "CB", "CB", "CB", "RB", "LB", "CDM", "CDM", "CM", "CM", "CM", "RW", "RW", "LW", "LW", "CAM", "CAM"].map((p, i) => ({ id: `p${i}`, name: `Player ${i}`, positions: p, overall: 80 - i * 0.5 })),
  { id: "kh", name: "Abdukodir Khusanov", positions: "CB", overall: 90 },
];
const sq = buildLeagueSquad("Manchester City", city);
const kh = sq.players.find(p => p.id === "kh");
check(!!kh && kh.position === "CB", `Khusanov stays a centre-back (${kh?.position})`);
check(sq.players.filter(p => p.position === "ST").map(p => p.id).join() === "st", "only the real striker is a striker");

// …and an old save that already has him as a striker is put right.
const old: LeagueSquad[] = [{ club: "Manchester City", players: [{ ...kh!, position: "ST", positions: ["CB"] } as LeaguePlayer] }];
check(relabelOutOfPosition(old)[0].players[0].position === "CB", "an old save's striker-labelled centre-back goes back to CB");
const fine: LeagueSquad[] = [{ club: "X", players: [{ id: "w", name: "W", position: "ST", positions: ["LW", "RW"], overall: 80, goals: 0, assists: 0 } as LeaguePlayer] }];
check(relabelOutOfPosition(fine) === fine, "a winger playing up front is left alone (a real fit)");

// ── 2. Squads follow their clubs up and down ──
const P = (id: string): LeaguePlayer => ({ id, name: id, position: "CM", overall: 70, goals: 3, assists: 1 });
const league: LeagueSquad[] = [{ club: "A", players: [P("a1")] }, { club: "Wolves", players: [P("w1"), P("signed")] }];
const world: LeagueSquad[] = [{ club: "Leeds", players: [P("l1")] }, { club: "Real", players: [P("r1")] }];
const down = moveSquadsWithLadder(league, world, ["A", "Leeds"]);
check(down.leagueSquads.map(s => s.club).join() === "A,Leeds", "the promoted club brings its own squad in");
check(!!down.externalSquads.find(s => s.club === "Wolves")?.players.some(p => p.id === "signed"), "the relegated club keeps its squad, signings and all");
check(!down.externalSquads.some(s => s.club === "Leeds"), "a club is never in both lists");
const back = moveSquadsWithLadder(down.leagueSquads, down.externalSquads, ["A", "Wolves"]);
check(back.leagueSquads.find(s => s.club === "Wolves")?.players.map(p => p.id).join() === "w1,signed", "back up a season later: the same Wolves, not day one's");

// A fetched squad never brings back a man the career has moved on.
const fresh: LeagueSquad[] = [{ club: "Wolves", players: [P("w1"), P("a1")] }];
check(withoutPlayersElsewhere(fresh, league)[0].players.map(p => p.id).join() === "w1", "a player now at another club is not added twice");

// Your new club's full register adds men; it never undoes its transfers.
const full: LeagueSquad = { club: "Wolves", players: [P("w1"), P("youth"), P("a1"), P("sold")] };
const mine = addFullRoster(full, league[1], [league[0]]);
const ids = mine.players.map(p => p.id);
check(ids.includes("signed"), "a signing the club made is still there");
check(ids.includes("youth"), "the academy player the slots left out is added");
check(!ids.includes("a1"), "a man playing for another club is not added");
check(mine.players.find(p => p.id === "w1")?.goals === 3, "this season's tallies stay");

// ── 3. Assists: a few real creators, not everybody on 8 ──
const mk = (id: string, position: LeaguePlayer["position"], overall: number): LeaguePlayer => ({ id, name: id, position, overall, goals: 0, assists: 0 });
const squad: LeagueSquad = { club: "S", players: [
  mk("gk", "GK", 80), mk("cb1", "CB", 80), mk("cb2", "CB", 79), mk("rb", "RB", 78), mk("lb", "LB", 78),
  mk("cdm", "CDM", 80), mk("cm1", "CM", 82), mk("cm2", "CM", 79), mk("rw", "RW", 86), mk("lw", "LW", 80), mk("cam", "CAM", 88), mk("st", "ST", 87),
  mk("b1", "CB", 74), mk("b2", "CM", 73), mk("b3", "RW", 72), mk("b4", "ST", 74),
] };
const rng = mulberry32(7);
for (let i = 0; i < 70; i++) nameGoals(squad, 1, rng);
const total = squad.players.reduce((n, p) => n + p.assists, 0);
const top = Math.max(...squad.players.map(p => p.assists));
check(total / 70 > 0.66 && total / 70 < 0.82, `about three goals in four have an assist (${(total / 70).toFixed(2)})`);
check(squad.players.find(p => p.assists === top)?.position !== "CB", "the assist leader is not a centre-back");
check(top >= 9, `a club's best creator stands out (${top} of ${total})`);

if (problems.length) { console.error("FAIL squadsFollowClubs:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("squadsFollowClubs: ok");
