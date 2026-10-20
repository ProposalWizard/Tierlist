import { makeInitialCareer, creditMatchResult, resolveSeasonWinners } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import {
  finishCupToWinner, roundNamesFor, tieWinner, currentRound, hasBye, stillIn,
  LOWER_LEAGUE_TROPHY_ROUND_NAMES, type CupState,
} from "../../lib/star/cups";
import { hasExtraTime } from "../../lib/star/shootout";
import {
  LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS,
  NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS, PREMIER_LEAGUE_CLUBS,
} from "../../lib/star/clubs";
import {
  fixtureDate, dayFor, faCupSlotsFor, lowerLeagueTrophySlotsFor, matchweeksFor,
  LOWER_LEAGUE_TROPHY_DIVISIONS, type CareerDivision,
} from "../../lib/star/calendar";
import {
  lowerLeagueTrophyField, lowerLeagueTrophyByes, openLowerLeagueTrophy,
  lowerLeagueTrophyInterest, lowerLeagueTrophyPrize, TROPHY_INTEREST_WIN, TROPHY_INTEREST_SEMI,
} from "../../lib/star/lowerLeagueTrophy";
import { estimateClubStrength } from "../../lib/star/promotion";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * THE LOWER LEAGUE TROPHY (20 Oct 2026): 120 clubs from League One down to
 * North/South, a 128-place draw with 8 byes, 7 rounds, 119 matches, penalties
 * straight away before the quarter-finals and extra time from them on,
 * midweek dates that never clash with these clubs' league or FA Cup games.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function playerAt(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 18, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function statsFor(scored: number, conceded: number) {
  return {
    homeScore: scored, awayScore: conceded, chances: 2, goals: 0, assists: 0, passes: 10,
    rating: 6.5, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
  } as never;
}

const llt = (c: CareerState) => c.cupState!.find(s => s.competition === "Lower League Trophy")!;

function matchesIn(st: CupState): number {
  return st.rounds.reduce((n, r) => n + r.ties.length, 0);
}

// ── The field and the draw ──────────────────────────────────────────────────
{
  const c = makeInitialCareer(playerAt(LEAGUE_TWO_CLUBS[3]), [...LEAGUE_TWO_CLUBS], "league_two");
  const field = lowerLeagueTrophyField(c);
  check(field.length === 120, `120 clubs in it (${field.length})`);
  const all = new Set([
    ...LEAGUE_ONE_CLUBS, ...LEAGUE_TWO_CLUBS, ...NATIONAL_LEAGUE_CLUBS,
    ...NATIONAL_LEAGUE_NORTH_CLUBS, ...NATIONAL_LEAGUE_SOUTH_CLUBS,
  ]);
  check(field.every(f => all.has(f)), "every club is from League One down to North/South");
  check(!field.some(f => PREMIER_LEAGUE_CLUBS.includes(f)), "no Premier League club");

  const st = llt(c);
  const r1 = st.rounds[0];
  check(r1.name === "Round 1", `first round is Round 1 (${r1.name})`);
  check((r1.byes ?? []).length === 8, `8 byes (${r1.byes?.length})`);
  check(r1.ties.length === 56, `56 Round 1 ties (${r1.ties.length})`);
  const inR1 = new Set([...r1.ties.flatMap(t => [t.home, t.away]), ...(r1.byes ?? [])]);
  check(inR1.size === 120, `all 120 clubs in Round 1, once each (${inR1.size})`);
  // First season: the 8 strongest League One clubs get the byes.
  const strongest = [...LEAGUE_ONE_CLUBS]
    .sort((a, b) => estimateClubStrength(c, b) - estimateClubStrength(c, a)).slice(0, 8);
  check(JSON.stringify([...(r1.byes ?? [])].sort()) === JSON.stringify([...strongest].sort()),
    "first season: byes go to the 8 strongest League One clubs");
}

// ── Byes after season 1: last season's League One, best who stayed ──────────
{
  const c = makeInitialCareer(playerAt(LEAGUE_TWO_CLUBS[3]), [...LEAGUE_TWO_CLUBS], "league_two");
  const field = lowerLeagueTrophyField(c);
  // Pretend the top 3 of the order went up (not in the field).
  const order = ["Promoted A", "Promoted B", "Promoted C", ...LEAGUE_ONE_CLUBS.slice(0, 12)];
  const byes = lowerLeagueTrophyByes(c, field, order);
  check(byes.length === 8, `8 byes from a given order (${byes.length})`);
  check(JSON.stringify(byes) === JSON.stringify(LEAGUE_ONE_CLUBS.slice(0, 8)),
    "byes are the top 8 of last season's League One still in the field, in order");
}

// ── 7 rounds, 119 matches, a real winner, every time ────────────────────────
{
  const c = makeInitialCareer(playerAt(PREMIER_LEAGUE_CLUBS[0]), [...PREMIER_LEAGUE_CLUBS], "premier");
  let winners = 0, pensBeforeQf = 0, etBeforeQf = 0, etFromQf = 0, drawsFromQf = 0, matches119 = 0;
  const SEEDS = 200;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const opened = openLowerLeagueTrophy(c, mulberry32(seed));
    const done = finishCupToWinner(opened, c.league, c.player.club, mulberry32(seed * 7 + 1));
    if (done.winner) winners++;
    if (matchesIn(done) === 119) matches119++;
    check(done.rounds.map(r => r.name).join("|") === LOWER_LEAGUE_TROPHY_ROUND_NAMES.join("|"),
      `seed ${seed}: the seven rounds in order (${done.rounds.map(r => r.name).join(", ")})`);
    for (const r of done.rounds) {
      const late = ["Quarter-Final", "Semi-Final", "Final"].includes(r.name);
      for (const t of r.ties) {
        check(tieWinner(t) !== null, `seed ${seed} ${r.name}: every tie has a winner`);
        if (!late) {
          if (t.wentToExtraTime) etBeforeQf++;
          if (t.pens) pensBeforeQf++;
        } else {
          if (t.wentToExtraTime) etFromQf++;
          if (t.pens && !t.wentToExtraTime) drawsFromQf++;
        }
      }
    }
  }
  check(winners === SEEDS, `a winner every time (${winners}/${SEEDS})`);
  check(matches119 === SEEDS, `119 matches every time (${matches119}/${SEEDS})`);
  check(etBeforeQf === 0, `no extra time before the quarter-finals (${etBeforeQf})`);
  check(pensBeforeQf > 0, `level ties before the quarter-finals go to penalties (${pensBeforeQf} shoot-outs)`);
  check(etFromQf > 0, `extra time happens from the quarter-finals (${etFromQf})`);
  check(drawsFromQf === 0, `from the quarter-finals, no shoot-out without extra time first (${drawsFromQf})`);
  console.log(`  ${SEEDS} draws: ${pensBeforeQf} shoot-outs before the QF (no extra time), ${etFromQf} extra times from the QF`);

  for (const r of LOWER_LEAGUE_TROPHY_ROUND_NAMES) {
    const want = r === "Quarter-Final" || r === "Semi-Final" || r === "Final";
    check(hasExtraTime("Lower League Trophy", r) === want, `${r}: extra time ${want ? "yes" : "no"}`);
  }
  check(roundNamesFor("Lower League Trophy").length === 7, "7 round names");
}

// ── The calendar: no clash with these clubs' league or FA Cup games ─────────
{
  const DAY = 86_400_000;
  for (const division of LOWER_LEAGUE_TROPHY_DIVISIONS as CareerDivision[]) {
    for (const season of [1, 2, 5]) {
      const leagueDays = new Map<number, string>();
      for (let w = 1; w <= matchweeksFor(division); w++) {
        const d = fixtureDate(2027, season, w, dayFor("league", w, division), division, "league");
        leagueDays.set(d.getTime(), `league round ${w} (${dayFor("league", w, division)})`);
      }
      const faDays = faCupSlotsFor(division)
        .map(s => fixtureDate(2027, season, s.week, dayFor("cup", s.week, division), division, "cup").getTime());
      const lastLeague = Math.max(...leagueDays.keys());
      const slots = lowerLeagueTrophySlotsFor(division);
      check(slots.length === 7, `${division}: 7 dates (${slots.length})`);
      let prev = 0;
      for (const s of slots) {
        const day = dayFor("cup", s.week, division);
        const t = fixtureDate(2027, season, s.week, day, division, "cup").getTime();
        const when = new Date(t).toUTCString().slice(0, 16);
        check(new Date(t).getUTCDay() === 3, `${division} s${season} ${s.round}: a Wednesday (${when})`);
        check(!leagueDays.has(t), `${division} s${season} ${s.round}: not on a league day (${when})`);
        const dayBefore = leagueDays.get(t - DAY);
        check(!dayBefore, `${division} s${season} ${s.round}: not the day after a league game (${when}; ${dayBefore})`);
        check(!leagueDays.has(t + DAY), `${division} s${season} ${s.round}: not the day before a league game (${when})`);
        check(!faDays.includes(t), `${division} s${season} ${s.round}: not on an FA Cup day (${when})`);
        check(t < lastLeague, `${division} s${season} ${s.round}: inside the league season (${when})`);
        check(t > prev, `${division} s${season} ${s.round}: after the round before`);
        prev = t;
      }
    }
  }
}

// ── A League Two career plays it: the fixture is on the calendar, the run ───
//    goes on, and the cup is won by somebody by the season's end ───────────
{
  let c = makeInitialCareer(playerAt(LEAGUE_TWO_CLUBS[5]), [...LEAGUE_TWO_CLUBS], "league_two");
  const r1 = c.fixtures.filter(f => f.competition === "Lower League Trophy");
  check(r1.length === 1, `your Round 1 tie is on the calendar (${r1.length})`);
  check(r1[0]?.round === "Round 1" && r1[0]?.kind === "cup", "as a cup tie in Round 1");
  // Win every Trophy tie (stats are YOUR score first), draw everything else.
  let played = 0, guard = 0;
  let wonOn = -1, finalGain = 0;
  while (guard++ < 120) {
    const fx = nextFixtureFor(c);
    if (!fx) break;
    if (fx.competition === "Lower League Trophy") {
      played++;
      const res = creditMatchResult(c, fx, statsFor(2, 0));
      if (res.career.trophies.some(t => t.competition === "Lower League Trophy") && wonOn < 0) {
        wonOn = played;
        // The final with the prize, against the same match without it.
        const plain = creditMatchResult({ ...c, cupState: c.cupState }, { ...fx, competition: "FA Cup" }, statsFor(2, 0));
        finalGain = res.career.money - plain.career.money;
      }
      c = res.career;
    } else {
      c = creditMatchResult(c, fx, statsFor(1, 1)).career;
    }
  }
  check(played === 7, `you play all 7 rounds when you win them all (${played})`);
  check(wonOn === 7, `the trophy is yours after the final (${wonOn})`);
  check(llt(c).winner === c.player.club, "the cup records you as the winner");
  check(matchesIn(llt(c)) === 119, `119 matches played (${matchesIn(llt(c))})`);
  check(lowerLeagueTrophyInterest(c, "league_one") === TROPHY_INTEREST_WIN,
    `winning it lifts interest from League One clubs by ${TROPHY_INTEREST_WIN}`);
  check(lowerLeagueTrophyInterest(c, "championship") === 0, "and not from the Championship");
  check(finalGain === lowerLeagueTrophyPrize(c), `winning the final pays the prize on top (${finalGain} vs ${lowerLeagueTrophyPrize(c)})`);
  check(lowerLeagueTrophyPrize(c) === Math.max(1, Math.round(c.contract.wage * 2)), `the prize is two weeks' wage (★${lowerLeagueTrophyPrize(c)} on ★${c.contract.wage} a week)`);
}

// ── Knocked out: it plays on without you and still finds a winner ──────────
{
  let c = makeInitialCareer(playerAt(NATIONAL_LEAGUE_CLUBS[2]), [...NATIONAL_LEAGUE_CLUBS], "national_league");
  let guard = 0, out = false;
  while (guard++ < 120) {
    const fx = nextFixtureFor(c);
    if (!fx) break;
    if (fx.competition === "Lower League Trophy" && !out) {
      c = creditMatchResult(c, fx, statsFor(0, 3)).career;
      out = true;
    } else {
      c = creditMatchResult(c, fx, statsFor(1, 1)).career;
    }
  }
  check(out, "you went out of it");
  const st = llt(c);
  check(!!st.winner, `the country's Trophy still reached a winner by the season's end (${st.rounds.length} rounds)`);
  check(lowerLeagueTrophyInterest(c, "league_one") === 0, "no interest bonus for going out in Round 1");
}

// ── A bye: no Round 1 tie, then the Round of 64 tie appears on its own ─────
{
  const probe = makeInitialCareer(playerAt(LEAGUE_ONE_CLUBS[0]), [...LEAGUE_ONE_CLUBS], "league_one");
  const byeClub = llt(probe).rounds[0].byes![0];
  let c = makeInitialCareer(playerAt(byeClub), [...LEAGUE_ONE_CLUBS], "league_one");
  check(hasBye(llt(c), byeClub), `${byeClub} has a bye`);
  check(stillIn(llt(c), byeClub), "a bye is still in it");
  check(!c.fixtures.some(f => f.competition === "Lower League Trophy"), "no Round 1 fixture for a bye");
  let guard = 0, r64: string | undefined;
  while (guard++ < 30) {
    const fx = nextFixtureFor(c)!;
    if (fx.competition === "Lower League Trophy") { r64 = fx.round; break; }
    c = creditMatchResult(c, fx, statsFor(1, 1)).career;
  }
  check(r64 === "Round of 64", `after the bye, your first tie is in the Round of 64 (${r64})`);
  check(currentRound(llt(c))?.name === "Round of 64", "and the cup has moved on to it");
}

// ── A Premier League career: never plays it, but it has a winner ────────────
{
  let c = makeInitialCareer(playerAt(PREMIER_LEAGUE_CLUBS[0]), [...PREMIER_LEAGUE_CLUBS], "premier");
  check(!c.fixtures.some(f => f.competition === "Lower League Trophy"), "a Premier League club has no Trophy fixture");
  let guard = 0;
  while (guard++ < 15) c = creditMatchResult(c, nextFixtureFor(c)!, statsFor(1, 1)).career;
  const rounds = llt(c).rounds.length;
  check(rounds >= 2 && rounds < 7, `it is played out round by round, not all at once (${rounds} rounds drawn after 15 fixtures)`);
  const w = resolveSeasonWinners(c);
  check(!!w.lowerLeagueTrophy, `the season's winners name a Trophy winner (${w.lowerLeagueTrophy})`);
  check(lowerLeagueTrophyInterest(c, "league_one") === 0, "no interest bonus without a run");
  check(TROPHY_INTEREST_SEMI < TROPHY_INTEREST_WIN, "semi-final bonus is smaller than winning it");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 40)) console.log("  ✗", p);
  if (problems.length > 40) console.log(`  … and ${problems.length - 40} more`);
  process.exit(1);
}
console.log("PASS lowerLeagueTrophy");
