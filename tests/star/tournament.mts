import { makeInitialCareer, creditMatchResult, simulateMissedFixture, resolveSeasonWinners } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import {
  tournamentField, openTournament, applyTournament, tournamentDue, tournamentSquadChance, groupTable,
  qualifiers, finishTournament, settleTournamentMatch, isTournamentFixture, yourGroup,
} from "../../lib/star/tournament";
import { opponentNationSquad, internationalCareer, recordIntlMatch, nationalSquad as nationalSquadOf, windowDue } from "../../lib/star/international";
import { opponentStartingXI, matchdayFor } from "../../lib/star/teamsheet";
import { nextFixtureFor, seedSeasonKnockouts } from "../../lib/star/competitions";
import { mulberry32 } from "../../lib/star/season";
import { namePoolFor } from "../../lib/star/nationNames";
import type { CareerState, MatchStats, StarPlayer, Fixture } from "../../lib/star/types";

/**
 * THE SUMMER TOURNAMENT — fields, groups, the squad, a whole run through the
 * real crediting, the other nation's real squad.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function base(nationality = "England", season = 2, lastName = "Player"): CareerState {
  const p = { firstName: "Test", lastName, age: 24, position: "ST", club: "Arsenal", nationality, startYear: 2027 } as StarPlayer;
  const c = makeInitialCareer(p, PREMIER_LEAGUE_CLUBS);
  return { ...c, season, fixtures: c.fixtures.map(f => ({ ...f, played: true })) };
}
function stats(over: Partial<MatchStats>): MatchStats {
  return {
    chances: 3, goals: 0, assists: 0, passes: 8, rating: 7.0, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0,
    sponsorPay: 0, totalCash: 1, homeScore: 2, awayScore: 0, minutes: 90,
    ...over,
  };
}

// ── Fields and groups ───────────────────────────────────────────────────────
{
  for (let season = 2; season <= 40; season += 2) {
    const comp = season % 4 === 0 ? "World Cup" : "European Championship";
    const f = tournamentField(comp, season, "England");
    check(f.length === (comp === "World Cup" ? 32 : 24), `${comp} ${season}: field of ${f.length}`);
    check(new Set(f).size === f.length, `${comp} ${season}: no nation twice`);
    check(!f.includes("San Marino"), "San Marino never qualify");
    check(f.includes("England"), `England qualify (${comp} ${season})`);
    if (comp === "European Championship") check(!f.includes("Brazil"), "no Brazil at the Euros");
  }
  let scotland = 0;
  for (let season = 2; season <= 200; season += 4) if (tournamentField("European Championship", season, "Scotland").includes("Scotland")) scotland++;
  console.log(`Scotland reach the Euros in ${scotland} of 50`);
  check(scotland > 10 && scotland < 50, `Scotland sometimes qualify (${scotland}/50)`);
  check(tournamentField("European Championship", 2, "Turkey").includes("Turkey"), "your own spelling stands in (Turkey)");
  check(!tournamentField("European Championship", 2, "Turkey").includes("Türkiye"), "…not twice");

  const t = openTournament(base("England", 4))!;
  check(t.competition === "World Cup" && t.groups.length === 8, "a World Cup is eight groups");
  check(t.groups.every(g => g.teams.length === 4 && g.matches.length === 6), "four teams, six matches a group");
  check(t.groups.flatMap(g => g.teams).length === 32, "every nation in one group");
  for (const g of t.groups) for (const team of g.teams) {
    check(g.matches.filter(m => m.home === team || m.away === team).length === 3, "everyone plays three");
    check([1, 2, 3].every(md => g.matches.filter(m => m.md === md && (m.home === team || m.away === team)).length === 1), "one game a matchday");
  }
  const e = openTournament(base("England", 2))!;
  check(e.groups.length === 6, "the Euros are six groups");
  const done = finishTournament(e, mulberry32(5));
  const q = qualifiers(done);
  check(q.length === 16 && q.filter(x => x.place === 3).length === 4, "Euros: 12 + the four best thirds");
  check(done.ko.length === 4 && done.ko.map(r => r.ties.length).join() === "8,4,2,1", `bracket 8-4-2-1 (${done.ko.map(r => r.ties.length)})`);
  check(!!done.winner && q.some(x => x.name === done.winner), "a winner, from the last sixteen");
  const r16 = done.ko[0].ties;
  const groupOf = (n: string) => done.groups.find(g => g.teams.includes(n))!.name;
  check(r16.every(tie => groupOf(tie.home) !== groupOf(tie.away)), "no Round of 16 tie inside one group");
  const tbl = groupTable(done.groups[0]);
  check(tbl.reduce((s, r) => s + r.p, 0) === 12 && tbl.every((r, i) => i === 0 || tbl[i - 1].pts >= r.pts), "a full table, sorted on points");

  // Strong nations win more often (1,000 simulated World Cups).
  const wins: Record<string, number> = {};
  for (let s = 0; s < 250; s++) {
    const w = finishTournament(openTournament(base("England", 4 * (s + 1)))!, mulberry32(s)).winner!;
    wins[w] = (wins[w] ?? 0) + 1;
  }
  const top = Object.entries(wins).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n} ${c}`).join(", ");
  console.log(`World Cup winners over 250: ${top}`);
  check((wins.Brazil ?? 0) + (wins.France ?? 0) + (wins.Argentina ?? 0) > (wins.Wales ?? 0) + (wins.Iceland ?? 0) + (wins.Qatar ?? 0), "the strong win more");
}

// ── The squad ───────────────────────────────────────────────────────────────
{
  const c = base(); c.starRating = 3.3; c.form = [6.8];
  const none = tournamentSquadChance(c);
  let rec = c.international;
  const f: Fixture = { week: 4, opponent: "Spain", home: true, played: false, kind: "international", competition: "Euro Qualifier" };
  rec = recordIntlMatch(rec, c.season, f, stats({}));
  rec = recordIntlMatch(rec, c.season, f, stats({}));
  const two = tournamentSquadChance({ ...c, international: rec });
  console.log(`3.3★ England squad chance: no caps ${(none * 100).toFixed(0)}%, two this season ${(two * 100).toFixed(0)}%`);
  check(two > none + 0.1, "playing in the last squads helps");
  check(tournamentSquadChance({ ...c, injury: { weeksRemaining: 3, note: "x" } }) === 0, "injured: not going");
  let picked = 0;
  for (let i = 0; i < 300; i++) {
    const s = base("England", 2, `S${i}`); s.starRating = 4.5; s.form = [7.5];
    if (openTournament(s)!.selected) picked++;
  }
  check(picked > 270, `a 4.5-star Englishman goes (${picked}/300)`);
  let low = 0;
  for (let i = 0; i < 300; i++) {
    const s = base("England", 2, `L${i}`); s.starRating = 2.0; s.form = [6.5];
    if (openTournament(s)!.selected) low++;
  }
  check(low < 20, `a 2-star Englishman stays home (${low}/300)`);
}

// ── Due, applied, played through the real crediting ─────────────────────────
{
  const c = base(); c.starRating = 4.8; c.form = [8];
  check(tournamentDue(c), "due once the club season is played");
  check(!tournamentDue({ ...c, season: 3 }), "not in a summer with no tournament");
  check(!tournamentDue({ ...c, fixtures: [{ ...c.fixtures[0], played: false }, ...c.fixtures.slice(1)] }), "not while club fixtures remain");
  check(!tournamentDue({ ...c, cups: [{ competition: "European Championship", kind: "international", roundIndex: 0, eliminated: false, won: false }] }),
    "an old save's counter-style run finishes the old way");
  check(seedSeasonKnockouts({ ...c, season: 4 }).runs.every(r => r.kind !== "international"), "no old-style run is opened any more");

  let s = applyTournament(c, openTournament(c)!);
  check(!tournamentDue(s), "decided once");
  check(s.tournament!.selected, "a 4.8-star player is picked");
  check(windowDue(s) === null, "an undecided break never pops up in the summer");
  let played = 0, guard = 0, group = 0;
  while (guard++ < 10) {
    const next = nextFixtureFor(s);
    if (!next) break;
    check(isTournamentFixture(s, next), `fixture ${next.round} is a tournament match`);
    if (next.round!.startsWith("Group")) group++;
    s = creditMatchResult(s, next, stats({ goals: 1, homeScore: 3, awayScore: 0, rating: 8 })).career;
    played++;
  }
  check(group === 3, `three group games (${group})`);
  check(played === 7, `seven matches to win it (${played})`);
  check(s.tournament!.winner === "England" && s.tournament!.yourExit === "Winners", "England win it");
  check(s.trophies.filter(t => t.competition === "European Championship" && t.season === 2).length === 1, "one trophy in the cabinet");
  check((s.caps ?? 0) === 7 && (s.internationalGoals ?? 0) === 7, `caps and goals credited once each (${s.caps}, ${s.internationalGoals})`);
  check(s.careerStats.goals === c.careerStats.goals, "tournament goals stay out of the club tally");
  check(resolveSeasonWinners(s).tournament?.winner === "England", "the season's winners know who won it");
  // A replay of the final adds nothing.
  const fin = s.fixtures.find(f => f.round === "Final")!;
  const again = creditMatchResult(s, fin, stats({ goals: 1, homeScore: 3, awayScore: 0 })).career;
  check(again.caps === s.caps && again.trophies.length === s.trophies.length, "a replayed final is not a second trophy");
  check(!nextFixtureFor(s), "season can end once it is over");
}

// ── Going out, and missing a match ──────────────────────────────────────────
{
  const c = base(); c.starRating = 4.8; c.form = [8];
  let s = applyTournament(c, openTournament(c)!);
  for (let i = 0; i < 3; i++) {
    const next = nextFixtureFor(s)!;
    s = creditMatchResult(s, next, stats({ homeScore: 0, awayScore: 3 })).career;
  }
  check(s.tournament!.yourExit === "Group Stage" && !!s.tournament!.winner, "three defeats: home after the groups, winner crowned");
  check(!nextFixtureFor(s), "no more fixtures");
  check(groupTable(yourGroup(s.tournament!)!).at(-1)!.name === "England", "bottom of the group");

  // A level knockout goes to the live shootout.
  let k = applyTournament(c, openTournament(c)!);
  for (let i = 0; i < 3; i++) k = creditMatchResult(k, nextFixtureFor(k)!, stats({ homeScore: 2, awayScore: 0 })).career;
  const r16 = nextFixtureFor(k)!;
  check(r16.round === "Round of 16", "into the Round of 16");
  const youHome = r16.home;
  const lose = settleTournamentMatch(k, r16, { us: 1, them: 1, pens: youHome ? { home: 3, away: 4 } : { home: 4, away: 3 } })!;
  check(lose.state.yourExit === "Round of 16" && !lose.nextFixture, "lose the shootout, go home");
  const win = settleTournamentMatch(k, r16, { us: 1, them: 1, pens: youHome ? { home: 5, away: 4 } : { home: 4, away: 5 } })!;
  check(win.nextFixture?.round === "Quarter-Final", "win it, into the quarter-finals");

  // Injured for a group game: it is simulated, nation against nation.
  const inj = applyTournament(c, openTournament(c)!);
  const f1 = nextFixtureFor(inj)!;
  const missed = simulateMissedFixture({ ...inj, injury: { weeksRemaining: 1, note: "knock" } }, f1).career;
  check(missed.tournament!.matchday === 1 && !!nextFixtureFor(missed), "a missed group game still moves the group on");
  check((missed.caps ?? 0) === (inj.caps ?? 0), "no cap for a game you missed");

  // Left out: played without you, at once.
  const out = base("England", 2, "Nobody"); out.starRating = 1.5; out.form = [6];
  const o = applyTournament(out, openTournament(out)!);
  check(!o.tournament!.selected && !!o.tournament!.winner && !nextFixtureFor(o), "not picked: no fixtures, a winner all the same");
}

// ── The other nation's squad ────────────────────────────────────────────────
{
  const c = base();
  const real = {
    ...c, leagueSquads: [{ club: "Chelsea", players: [
      { id: "b1", name: "Real Brazilian", position: "ST" as const, overall: 89, goals: 0, assists: 0, nation: "Brazil", image: "https://x/b.png" },
    ] }],
  };
  const sq = opponentNationSquad(real, "Brazil");
  check(sq.length === 20 && sq.filter(p => p.position === "GK").length === 2, "a 20-man squad, two keepers");
  check(sq.some(p => p.name === "Real Brazilian" && p.image === "https://x/b.png"), "a real Brazilian in the save comes first");
  check(sq.every(p => !!p.image && p.nation === "Brazil"), "every man has a face and the flag");
  const pool = namePoolFor("Brazil");
  const made = sq.filter(p => p.id.startsWith("opp_gen_"));
  check(made.every(p => pool.first.includes(p.name.split(" ")[0])), `made-up Brazilians have Brazilian names (${made[0]?.name})`);
  check(new Set(sq.map(p => p.name)).size === 20, "no name twice");
  check(JSON.stringify(opponentNationSquad(c, "Japan").map(p => p.name)) === JSON.stringify(opponentNationSquad(c, "Japan").map(p => p.name)), "seeded");
  console.log(`Japan's made-up XI: ${opponentNationSquad(c, "Japan").slice(0, 4).map(p => p.name).join(", ")}…`);

  const own = nationalSquadOf(c).players.filter(p => p.id.startsWith("intl_gen_"));
  check(own.every(p => namePoolFor("England").first.includes(p.name.split(" ")[0])), `your own made-up team-mates sound English (${own[0]?.name})`);
  check(new Set(nationalSquadOf(c).players.map(p => p.name)).size === 20, "no team-mate's name twice");

  const fx: Fixture = { week: 4, opponent: "Brazil", home: true, played: false, kind: "international", competition: "World Cup", round: "Group A · Match 1", opponentStrength: 90 };
  const stand = internationalCareer(real, fx);
  const xi = opponentStartingXI(stand, fx);
  check(!!xi && xi.length === 11, `the other nation fields eleven on the pitch (${xi?.length})`);
  check(!!xi && xi.every(p => !!p.name && !!p.face), "named, with faces");
  check(opponentStartingXI(real, fx) === null, "the real career still has no sheet of its own");
  const md = matchdayFor(stand, fx, true);
  const theirs = md.home.yours ? md.away : md.home;
  check(theirs.xi.length === 11 && theirs.club === "Brazil", "the team sheet shows Brazil's eleven");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — summer tournaments: real groups and knockouts, a squad named off the call-up record, the other nation named");
