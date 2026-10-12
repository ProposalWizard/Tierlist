import { makeInitialCareer, creditMatchResult, simulateMissedFixture } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS, LEAGUE_ONE_CLUBS } from "../../lib/star/clubs";
import {
  periodDue, decide, applyDecision, syncIntl, intlOf, managerTarget, squadBar, managerAfterClubMatch,
  awayOnDuty, callUpChanceFor, SQUAD_AT, START_AT,
} from "../../lib/star/intl/career";
import { selectionFor } from "../../lib/star/selection";
import { nextFixtureFor } from "../../lib/star/competitions";
import { fixtureTimestamp, divisionOf } from "../../lib/star/calendar";
import { internationalCareer } from "../../lib/star/international";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * YOUR INTERNATIONAL CAREER ON THE WORLD — the national manager's bar,
 * call-ups for every window your nation plays in, the matches on their real
 * dates, caps credited once, club games missed while away.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function base(nationality = "England", club = "Arsenal", clubs = PREMIER_LEAGUE_CLUBS): CareerState {
  const p = { firstName: "Test", lastName: "Player", age: 24, position: "ST", club, nationality, startYear: 2027 } as StarPlayer;
  return syncIntl(makeInitialCareer(p, clubs, clubs === LEAGUE_ONE_CLUBS ? "league_one" : "premier"));
}
function stats(over: Partial<MatchStats>): MatchStats {
  return {
    chances: 3, goals: 0, assists: 0, passes: 8, rating: 7.0, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0,
    sponsorPay: 0, totalCash: 1, homeScore: 1, awayScore: 0, minutes: 90,
    ...over,
  };
}

// ── The bar: starts at 0; harder for a big nation ───────────────────────────
{
  const eng = base("England"), cod = base("DR Congo"), smr = base("San Marino");
  for (const c of [eng, cod, smr]) { c.starRating = 3.0; c.status = "1st Team"; }
  check(intlOf(eng).manager === 0, "the national manager's bar starts at 0");
  console.log(`3★ Premier League starter — squad bar / target: England ${squadBar(eng).toFixed(1)} / ${managerTarget(eng).toFixed(0)}, DR Congo ${squadBar(cod).toFixed(1)} / ${managerTarget(cod).toFixed(0)}, San Marino ${squadBar(smr).toFixed(1)} / ${managerTarget(smr).toFixed(0)}`);
  check(managerTarget(eng) < managerTarget(cod) && managerTarget(cod) < managerTarget(smr), "England harder than DR Congo, DR Congo harder than San Marino");
  // League matters: the same player in League One.
  const l1 = base("England", LEAGUE_ONE_CLUBS[0], LEAGUE_ONE_CLUBS); l1.starRating = 4.2; l1.status = "1st Team";
  const pl = { ...eng, starRating: 4.2 };
  check(managerTarget(l1) < managerTarget(pl), `the same player in League One is further from the squad (${managerTarget(l1).toFixed(0)} v ${managerTarget(pl).toFixed(0)})`);
  // Moves towards the target with good games.
  let m = { ...eng, starRating: 4.5 };
  for (let i = 0; i < 20; i++) m = managerAfterClubMatch(m, 7.5);
  check(intlOf(m).manager > SQUAD_AT, `20 good games as a 4.5★ England striker put you in the squad (${intlOf(m).manager})`);
  check(callUpChanceFor({ ...m, injury: { weeksRemaining: 2, note: "x" } } as CareerState) === 0, "an injured player is never picked");
}

// ── A season: every window your nation plays in comes due once ──────────────
{
  let s = base("England");
  s.starRating = 4.5; s.form = [8];
  s = { ...s, intl: { ...intlOf(s), manager: 80 } };
  const d = divisionOf(s);
  let due = 0, called = 0, intlPlayed = 0, guard = 0, keys: string[] = [];
  while (guard++ < 200) {
    const p = periodDue(s);
    if (p) {
      due++; keys.push(p.key);
      const dec = decide(s, p);
      if (dec.called) called++;
      s = applyDecision(s, dec);
      check(periodDue(s)?.key !== p.key, "an answered window does not come back");
      continue;
    }
    const next = nextFixtureFor(s);
    if (!next) break;
    if (next.kind === "international") {
      intlPlayed++;
      check(!!next.intlId, "every international on the calendar comes from the world");
      check(selectionFor(s).status === "1st Team", "a manager's-bar-80 player starts");
      const ic = internationalCareer(s, next);
      check(ic.squad.length === 23 || ic.squad.length === 26, "the national squad is 23 (26 at a tournament)");
    }
    s = creditMatchResult(s, next, stats({ goals: next.kind === "international" ? 1 : 0 })).career;
    s.starRating = 4.5; s.form = [8];
    s = { ...s, intl: { ...intlOf(s), manager: Math.max(intlOf(s).manager, 80) } };
  }
  console.log(`2026/27 as England: ${due} squads named (${keys.join(", ")}), ${called} call-ups, ${intlPlayed} internationals played`);
  check(due === 4, `four windows came due in the season (${due})`);
  check(called >= 3, `a manager's-bar-80 player was picked for most (${called})`);
  check(intlPlayed >= 2 * called, `each call-up brought its window's matches (${intlPlayed} for ${called})`);
  check((s.caps ?? 0) === intlPlayed, `caps credited once each (${s.caps} vs ${intlPlayed})`);
  check((s.internationalGoals ?? 0) === intlPlayed, `international goals credited (${s.internationalGoals})`);
  check(s.careerStats.goals === 0, "international goals stay out of the club tally");
  check(Object.keys(intlOf(s).played).length === intlPlayed, "every international you played is in the world's record");
  // Nations League 2026–27 group stage: England are in League A, Group 3.
  const nl = s.fixtures.filter((f) => f.competition === "Nations League" && f.played);
  check(nl.length === 0 || nl.every((f) => ["Spain", "Croatia", "Czech Republic"].includes(f.opponent)) || nl.some((f) => /Quarter|Semi|Final|Play-Off/.test(f.round ?? "")),
    `Nations League group games are against Spain, Croatia, Czech Republic (${nl.map((f) => f.opponent).join(", ")})`);
  const intl = s.fixtures.find((f) => f.kind === "international" && f.played);
  if (intl) {
    const again = creditMatchResult(s, intl, stats({ goals: 1 })).career;
    check(again.caps === s.caps, "a replay is not a second cap");
  }
}

// ── Away on duty: a League One break weekend ────────────────────────────────
{
  let s = base("Scotland", LEAGUE_ONE_CLUBS[0], LEAGUE_ONE_CLUBS);
  s = { ...s, starRating: 4.5, intl: { ...intlOf(s), manager: 90 } };
  const d = divisionOf(s);
  let away = 0, guard = 0, missedWhileAway = 0;
  while (guard++ < 80) {
    const p = periodDue(s);
    if (p) { s = applyDecision(s, { ...decide(s, p), called: true }); continue; }
    const next = nextFixtureFor(s);
    if (!next) break;
    if (next.kind !== "international" && awayOnDuty(s, next)) {
      away++;
      check(selectionFor(s).status === "Squad" && !!selectionFor(s).away, "a club game while away: the club plays without you");
      s = simulateMissedFixture(s, next).career;
      missedWhileAway++;
      continue;
    }
    if (fixtureTimestamp(s.player.startYear, s.season, next.week, next.kind, d) > Date.UTC(2026, 11, 31)) break;
    s = next.kind === "international"
      ? creditMatchResult(s, next, stats({})).career
      : creditMatchResult(s, next, stats({})).career;
    s = { ...s, intl: { ...intlOf(s), manager: 90 } };
  }
  console.log(`League One, Scotland, Aug–Dec 2026: ${away} club games missed while away`);
  check(away >= 1, `a League One player called up misses club games on break weekends (${away})`);
}

// ── Skipping past a window: it is gone, not offered late ────────────────────
{
  const c = base("England");
  const d = divisionOf(c);
  const cut = Date.UTC(2026, 10, 1);
  const skipped = { ...c, fixtures: c.fixtures.map(f =>
    fixtureTimestamp(c.player.startYear, c.season, f.week, f.kind, d) < cut ? { ...f, played: true } : f) };
  const p = periodDue(syncIntl(skipped));
  check(!p || !p.key.includes("sepoct"), `jumping past September–October does not offer it late (${p?.key})`);
}

// ── Friendlies: regulars rotated, changed early; squad players get minutes ──
for (const [bar, want] of [[65, 2], [85, 3], [45, 1]] as const) {
  let s = base("Japan");
  const keep = () => { s = { ...s, intl: { ...intlOf(s), manager: bar } }; };
  keep();
  const sepoct: { start: boolean; off?: number; on: number }[] = [];
  let guard = 0;
  while (guard++ < 120) {
    const p = periodDue(s);
    if (p) { s = applyDecision(s, { ...decide(s, p), called: true }); continue; }
    const next = nextFixtureFor(s);
    if (!next) break;
    if (next.kind === "international" && next.competition === "International Friendly" && new Date(fixtureTimestamp(s.player.startYear, s.season, next.week, next.kind, divisionOf(s))).getUTCMonth() <= 9) {
      const v = selectionFor(s);
      sepoct.push({ start: v.status === "1st Team", off: v.offAt, on: v.onAt });
    }
    if (fixtureTimestamp(s.player.startYear, s.season, next.week, next.kind, divisionOf(s)) > Date.UTC(2026, 9, 31)) break;
    s = creditMatchResult(s, next, stats({})).career; keep();
  }
  const starts = sepoct.filter((x) => x.start).length;
  console.log(`Japan, bar ${bar}, Sep–Oct 2026 friendlies: started ${starts} of ${sepoct.length}; ${sepoct.map((x) => x.start ? `off ${x.off}'` : `on ${x.on}'`).join(", ")}`);
  if (sepoct.length === 4) check(starts === want, `bar ${bar}: starts ${want} of 4 friendlies (${starts})`);
  check(sepoct.every((x) => x.start ? (x.off ?? 90) >= 55 && (x.off ?? 90) <= 80 : x.on >= 46 && x.on <= 65), "friendly minutes: off 55'–80' when starting, on 46'–65' from the bench");
}

check(SQUAD_AT === 34 && START_AT === 55, "the same thresholds as the club manager");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the national manager picks you on merit, every window comes due once, caps counted once");
