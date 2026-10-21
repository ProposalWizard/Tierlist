import { makeInitialCareer } from "../../lib/star/careerFlow";
import { buildSquadFromRoster, shouldUpgradeSquad, squadAfterFetch } from "../../lib/star/realSquad";
import { NATIONAL_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { StarPlayer } from "../../lib/star/types";

/**
 * TEAM-MATE GOALS SURVIVE A RELOAD (Mikey, 20 Oct 2026).
 *
 * A National League season: him 40 goals and 43 assists, his team-mates 5
 * and 2 between four players. His club has no real players, so every time
 * the game was opened it "upgraded" the squad to a fresh invented one with
 * every tally at nought. squadAfterFetch keeps the save's squad when nothing
 * real comes back, and keeps tallies when something real does.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const club = NATIONAL_LEAGUE_CLUBS[0];
const p = { firstName: "T", lastName: "P", age: 16, skinTone: "light", club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
const c = makeInitialCareer(p, [...NATIONAL_LEAGUE_CLUBS], "national_league");
const played = c.squad.map((x, i) => ({ ...x, seasonGoals: i, seasonAssists: 2 * i, leagueGoals: i, leagueAssists: 2 * i, careerGoals: i, careerAssists: 2 * i }));
const goals = played.reduce((n, x) => n + x.seasonGoals, 0);

// 1. The old way: what a reload fetched for a club with no real players.
const invented = buildSquadFromRoster([], club);
check(shouldUpgradeSquad(played), "an invented squad always asks to be upgraded (why it ran on every load)");
check(invented.reduce((n, x) => n + x.seasonGoals, 0) === 0, "…and what came back had every tally at nought (the bug)");

// 2. Now: nothing real came back, so the save's squad stays as it is.
check(squadAfterFetch(played, invented) === null, "no real players fetched: the squad is kept");

// 3. Ten reloads in a season lose nothing.
let squad = played;
for (let i = 0; i < 10; i++) squad = squadAfterFetch(squad, buildSquadFromRoster([], club)) ?? squad;
check(squad.reduce((n, x) => n + x.seasonGoals, 0) === goals, `ten reloads keep every team-mate goal (${goals})`);

// 4. Real players do come back: they replace the invented men, and anyone in both keeps his tally.
const real = buildSquadFromRoster([{ sofifa_id: "123", name: "Real Man", positions: "ST", overall: 70 } as never], club);
const merged = squadAfterFetch([{ ...played[0], sofifaId: "123", seasonGoals: 9 }], real);
check(!!merged && merged.some(x => x.sofifaId === "123" && x.seasonGoals === 9), "a real squad keeps the tally of a man already in the save");

if (problems.length) { console.log("FAIL squadReload"); for (const x of problems) console.log("  ✗ " + x); process.exit(1); }
console.log("PASS squadReload");
