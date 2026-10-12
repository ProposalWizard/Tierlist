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

// ── 11 Oct 2026 fixes, from playing the whole path ─────────────────────────
{
  // Every nation the game can name has a drawn flag (no network, no globe).
  const { hasDrawnFlag, flagMarkup } = await import("../../lib/star/nationFlags");
  const { NATION_STRENGTH, EUROPEAN } = await import("../../lib/star/international");
  const all = Array.from(new Set([...Object.keys(NATION_STRENGTH), ...Array.from(EUROPEAN)]));
  const missing = all.filter(n => !hasDrawnFlag(n));
  check(missing.length === 0, `every nation has a drawn flag (missing: ${missing.join(", ")})`);
  check(/<rect/.test(flagMarkup("England")) && /<rect/.test(flagMarkup("Atlantis", ["#ff0000", "#0000ff"])), "a flag, or two kit bands for an unknown nation");
  // …and no club is mistaken for a nation (ClubBadge draws a flag for those).
  const clubs = await import("../../lib/star/clubs");
  const clubNames = new Set<string>();
  for (const v of Object.values(clubs)) if (Array.isArray(v)) for (const c of v) if (typeof c === "string") clubNames.add(c);
  check(Array.from(clubNames).every(c => !hasDrawnFlag(c)), "no club name draws as a flag");

  // Made-up squads: no repeated surnames while the pool has any left (a France
  // XI had two Laurents, two Rousseaus and two Garniers).
  const { madeUpNames } = await import("../../lib/star/nationNames");
  for (const n of ["France", "England", "Brazil", "Japan", "Scotland"]) {
    const sur = madeUpNames(n, 20).map(x => x.split(" ").slice(-1)[0]);
    check(new Set(sur).size === sur.length, `${n}: 20 made-up men, 20 different surnames`);
  }

  // The "How close you are" line names what is holding you back.
  const { whatHoldsYouBack } = await import("../../lib/star/international");
  check(whatHoldsYouBack({ starRating: 1.5, form: [7.5], injury: null }, "England").holdingBack === "rating", "a low rating is named as the gap");
  check(whatHoldsYouBack({ starRating: 5, form: [5.5, 5.5], injury: null }, "San Marino").holdingBack === "form", "poor form is named as the gap");
  check(whatHoldsYouBack({ starRating: 3, form: [7], injury: { weeks: 2 } as never }, "England").holdingBack === "injury", "an injury is named");
  const d = decideCallUp({ ...base(), starRating: 1.5, form: [6] }, 0);
  check(!!d.closeLine && !/\d/.test(d.closeLine), "the call-up decision carries a line, with no numbers in it");

  // An international is not the club's match: no club wage, no goal bonus,
  // no boss/team/fans movement, no club form.
  const { finaliseMatch } = await import("../../lib/star/matchStats");
  const c0 = base();
  const intlFix = { week: 4, opponent: "France", home: false, played: false, kind: "international" as const, competition: "Euro Qualifier", opponentStrength: 90 };
  const fs = finaliseMatch(4, 2, 1, 10, 90, 2, 0, { ...c0, contract: { ...c0.contract, wage: 500, goalBonus: 100, assistBonus: 50 } }, [], null, [], intlFix);
  check(fs.wage === 0 && fs.goalBonus === 0 && fs.bossChange === 0 && fs.teamChange === 0 && fs.fansChange === 0,
    `an international pays no club money and moves no club bar (wage ${fs.wage}, bonus ${fs.goalBonus}, boss ${fs.bossChange})`);
  const withIntl = { ...c0, fixtures: [...c0.fixtures, intlFix] };
  const after = creditMatchResult(withIntl, intlFix, stats({ rating: 4.2, hooked: "form", homeScore: 0, awayScore: 3, bossChange: -6, teamChange: -3, fansChange: -8 })).career;
  check(after.relationships.boss === withIntl.relationships.boss && after.relationships.team === withIntl.relationships.team
    && after.relationships.fans === withIntl.relationships.fans, "a bad England game (even hooked) leaves the club's boss, team and fans where they were");
  check(JSON.stringify(after.form) === JSON.stringify(withIntl.form), "…and the club's form");
  check(after.caps === 1, "…but the cap counts");

  // The feed: the nation's own account posts, never the club's.
  const { generateForInternational, generateForCallUp } = await import("../../lib/star/media/feed");
  const { nationKits } = await import("../../lib/star/international");
  const scored = creditMatchResult(withIntl, intlFix, stats({ goals: 1, homeScore: 2, awayScore: 1, rating: 8 })).career;
  const media = generateForInternational(withIntl, scored, intlFix, stats({ goals: 1, homeScore: 2, awayScore: 1, rating: 8 }), "England", nationKits("England").home, 86);
  const posts = media.posts;
  check(posts.length >= 3, `an international gets posts (${posts.length})`);
  check(posts.some(p => p.author.name === "England"), "the England account posts");
  check(posts.every(p => !/Arsenal/.test(p.author.name) && !/Arsenal/.test(p.text)), `no club account or club name in an England game's posts: ${posts.filter(p => /Arsenal/.test(p.author.name + p.text)).map(p => p.text).join(" | ")}`);
  check(posts.some(p => /England 2-1 France|France 1-2 England/.test(p.text)), "the scoreline names both nations");
  check(posts.some(p => /first (England )?cap|England debut/i.test(p.text)), "a first cap is marked");
  check(posts.some(p => /first England goal|first goal for/i.test(p.text)), "a first international goal is marked");
  check(posts.every(p => !/\{|\}|undefined|NaN/.test(p.text)), "no holes in the posts");
  const again = generateForInternational({ ...withIntl, media }, scored, intlFix, stats({ goals: 1, homeScore: 2, awayScore: 1 }), "England", nationKits("England").home, 86);
  check(again.posts.length === posts.length, "credited once: a replay posts nothing new");
  const cu = generateForCallUp(withIntl, "England", 1, "September", "callup-1-0").posts;
  check(cu.length >= 2 && cu.some(p => /England/.test(p.text)) && cu.every(p => !/\{|\}|undefined/.test(p.text)), `a first call-up is announced (${cu.map(p => p.text).join(" | ")})`);
  check(cu.every(p => !/Keeping an eye/.test(p.text)), "no generic insider filler on a call-up");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — four international breaks a season, call-ups by rating, form and nation, caps credited once");
