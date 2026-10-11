import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import {
  callUpChance, callUpBar, decideCallUp, windowDue, applyCallUp, nationalSquad, internationalCareer,
  windowWeekends, windowWeek, INTL_WINDOWS_PREMIER,
} from "../../lib/star/international";
import { fixtureTimestamp, divisionOf } from "../../lib/star/calendar";
import { displayOverall } from "../../lib/star/rating";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * THE INTERNATIONAL BREAKS — call-up rates by rating and nation, four
 * windows a season, a cap credited once.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function base(nationality = "England", club = "Arsenal"): CareerState {
  const p = { firstName: "Test", lastName: "Player", age: 24, position: "ST", club, nationality, startYear: 2027 } as StarPlayer;
  return makeInitialCareer(p, PREMIER_LEAGUE_CLUBS);
}
function stats(over: Partial<MatchStats>): MatchStats {
  return {
    chances: 3, goals: 0, assists: 0, passes: 8, rating: 7.0, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0,
    sponsorPay: 0, totalCash: 1, homeScore: 1, awayScore: 0, minutes: 90,
    ...over,
  };
}

// ── Chance by rating and nation ─────────────────────────────────────────────
const at = (stars: number, nation: string, form = 6.8) =>
  callUpChance({ starRating: stars, form: [form], injury: null, international: undefined, player: { nationality: nation } });
{
  const rows: string[] = [];
  for (const nation of ["England", "Brazil", "Scotland", "San Marino"]) {
    const line = [1.5, 2.5, 3.0, 3.5, 4.0, 4.5].map(s => `${s}★ ${(at(s, nation) * 100).toFixed(0)}%`).join("  ");
    rows.push(`${nation.padEnd(10)} bar ${callUpBar(nation)}  ${line}`);
  }
  console.log(rows.join("\n"));
  check(at(2.5, "England") < 0.05, `a 2.5-star Englishman is rarely picked (${at(2.5, "England")})`);
  check(at(4.5, "England") > 0.9, `a 4.5-star Englishman nearly always is (${at(4.5, "England")})`);
  check(at(3.0, "England") < at(3.0, "Scotland"), "a deep nation is harder to get into than a shallow one");
  check(at(3.0, "Brazil") < at(3.0, "England"), "…and Brazil is harder than England");
  check(at(2.5, "San Marino") > 0.9, "a small nation takes a 2.5-star player");
  for (const n of ["England", "Brazil", "Scotland"]) for (let s = 1; s < 5; s += 0.25) {
    check(at(s + 0.25, n) >= at(s, n), `chance never falls as rating rises (${n} ${s})`);
  }
  check(at(3.4, "England", 8.0) > at(3.4, "England", 6.0), "form counts");
  check(callUpChance({ starRating: 5, form: [9], injury: { weeksRemaining: 2, note: "x" }, international: undefined, player: { nationality: "England" } }) === 0,
    "an injured player is never picked");
  // Bar sits where the overall formula says it should.
  check(Math.abs(displayOverall(3.43) - callUpBar("England")) <= 1, "England's bar is about 3.4 stars");
}

// ── Measured over seeds: rates by rating ────────────────────────────────────
{
  const rate = (stars: number, nation: string) => {
    let n = 0, hit = 0;
    for (let seed = 0; seed < 400; seed++) {
      const c = base(nation);
      c.player.lastName = `P${seed}`;
      c.starRating = stars;
      c.form = [6.8];
      n++; if (decideCallUp(c, 0).called) hit++;
    }
    return hit / n;
  };
  const low = rate(2.5, "England"), mid = rate(3.5, "England"), high = rate(4.5, "England");
  console.log(`England over 400 seeds: 2.5★ ${(low * 100).toFixed(1)}%  3.5★ ${(mid * 100).toFixed(1)}%  4.5★ ${(high * 100).toFixed(1)}%`);
  check(low < 0.08 && mid > 0.3 && mid < 0.85 && high > 0.85, "measured rates follow the chance");
  const c = base(); c.player.lastName = "Same";
  check(decideCallUp(c, 1).called === decideCallUp(c, 1).called
    && decideCallUp(c, 1).fixture.opponent === decideCallUp(c, 1).fixture.opponent, "seeded: same save, same answer");
}

// ── Four windows a season, on real dates, before the next match ─────────────
{
  const c = base();
  check(windowWeekends("premier").length === 4, "four windows a season");
  const d = divisionOf(c);
  const months = INTL_WINDOWS_PREMIER.map((_, i) =>
    new Date(fixtureTimestamp(c.player.startYear, c.season, windowWeek(d, i), "international", d)).getUTCMonth());
  check(JSON.stringify(months) === JSON.stringify([8, 9, 10, 2]), `windows in Sep, Oct, Nov, Mar (${months})`);
  // Every Premier League window clashes with no other fixture on its day.
  for (const i of [0, 1, 2, 3]) {
    const t = fixtureTimestamp(c.player.startYear, c.season, windowWeek(d, i), "international", d);
    const same = c.fixtures.filter(f => fixtureTimestamp(c.player.startYear, c.season, f.week, f.kind, d) === t);
    check(same.length === 0, `window ${i} has its day to itself`);
  }

  // Play the league until a window comes due; count how many come due a season.
  let s = c;
  s.starRating = 4.5; s.form = [8];
  let windows = 0, called = 0, intlPlayed = 0, guard = 0;
  while (guard++ < 120) {
    const due = windowDue(s);
    if (due !== null) {
      windows++;
      const dec = decideCallUp(s, due);
      if (dec.called) called++;
      s = applyCallUp(s, dec);
      check(windowDue(s) !== due, "a decided window does not come back");
      continue;
    }
    const next = s.fixtures.filter(f => !f.played)
      .sort((a, b) => fixtureTimestamp(s.player.startYear, s.season, a.week, a.kind, d) - fixtureTimestamp(s.player.startYear, s.season, b.week, b.kind, d))[0];
    if (!next) break;
    if (next.kind === "international") intlPlayed++;
    s = creditMatchResult(s, next, stats({ goals: next.kind === "international" ? 1 : 0 })).career;
    s.starRating = 4.5; s.form = [8];
  }
  check(windows === 4, `four windows came due in one season (${windows})`);
  check(called >= 3, `a 4.5-star player was picked for most of them (${called})`);
  check(intlPlayed === called, `every call-up was a match played (${intlPlayed} of ${called})`);
  check((s.caps ?? 0) === intlPlayed, `caps credited once each (${s.caps} vs ${intlPlayed})`);
  check((s.internationalGoals ?? 0) === intlPlayed, `international goals credited (${s.internationalGoals})`);
  check((s.international?.matches.length ?? 0) === intlPlayed, "each international is on the record");
  check(s.careerStats.goals === 0, "international goals stay out of the club tally");

  // A replayed international adds no second cap.
  const intl = s.fixtures.find(f => f.kind === "international" && f.played);
  if (intl) {
    const again = creditMatchResult(s, intl, stats({ goals: 1 })).career;
    check(again.caps === s.caps && again.international?.matches.length === s.international?.matches.length, "a replay is not a second cap");
  }
}

// ── Skipping past several windows offers only the latest ────────────────────
{
  const c = base();
  const d = divisionOf(c);
  const t2 = fixtureTimestamp(c.player.startYear, c.season, windowWeek(d, 2), "international", d);
  const skipped = { ...c, fixtures: c.fixtures.map(f =>
    fixtureTimestamp(c.player.startYear, c.season, f.week, f.kind, d) < t2 ? { ...f, played: true } : f) };
  check(windowDue(skipped) === 2, `jumping to mid-November offers November (${windowDue(skipped)})`);
  const after = applyCallUp(skipped, decideCallUp(skipped, 2));
  check(windowDue(after) === null, "and September/October are marked passed");
}

// ── The national squad ──────────────────────────────────────────────────────
{
  const c = base();
  const { players } = nationalSquad(c);
  check(players.length === 20, `a 20-man national squad (${players.length})`);
  check(players.filter(p => p.position === "GK").length === 2, "two keepers");
  check(players.every(p => p.nationality === "England"), "all of your nationality");
  check(players.every(p => !!p.imageUrl), "every man has a face");
  check(new Set(players.map(p => p.id)).size === 20, "no one twice");
  // A real Englishman in the division's squads is picked over a made-up one.
  const real = { ...c, leagueSquads: [{ club: "Chelsea", players: [{ id: "x1", name: "Real Striker", position: "ST" as const, overall: 88, goals: 0, assists: 0, nation: "England", image: "https://x/y.png" }] }] };
  const sq = nationalSquad(real);
  check(sq.players.some(p => p.name === "Real Striker") && sq.real >= 1, "real players of your nation come first");
  const stand = internationalCareer(real, { week: 4, opponent: "Brazil", home: true, played: false, kind: "international", competition: "World Cup Qualifier", opponentStrength: 90 });
  check(stand.player.club === "England" && stand.squad.length === 20, "the match is handed England, with England's squad");
  check(stand.league.some(t => t.name === "Brazil" && t.strength === 90), "…and Brazil at their strength");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — four international breaks a season, call-ups by rating, form and nation, caps credited once");
