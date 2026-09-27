import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import { exitRound, stillIn } from "../../lib/star/cups";
import { liveWeekFor, goalsForFollowed, scoresAt, previewOtherGames } from "../../lib/star/liveScores";
import { newMatch, advanceTo, advanceUntilInvolved, resolveScenario, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import { mulberry32 } from "../../lib/star/season";
import { minuteLabel } from "../../lib/star/addedTime";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * MATCH DAY AND THE SEASON (v0.15 items 30, 31, 35), Harry's decisions of
 * 27 Sep 2026.
 *
 * 35: the rest of the division is played at kick-off off its own stream, so
 *     the scores that pop up are exactly the ones the table records; only
 *     ticked clubs pop up (none by default); the Scores panel shows every
 *     game as it stands.
 * 31: knocked out in the Round of 16, the cup tab's list is the latest round
 *     (the quarter-finals) — the data behind "Out in the Round of 16" above a
 *     list labelled "Quarter-Finals".
 * 30: added time reads 90+N; Fergie time when 1-2 behind, or level at home as
 *     the bigger side.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = ["Liverpool", "Arsenal", "Manchester City", "Chelsea", "Tottenham Hotspur", "Manchester United", "Newcastle United",
  "Aston Villa", "Brighton & Hove Albion", "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "AFC Bournemouth", "Leeds United", "Burnley", "Sunderland"];
const PLAYER = { firstName: "A", lastName: "B", age: 17, position: "ST", skinTone: "light", club: "Chelsea", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
// MatchStats.homeScore/awayScore are YOUR score / THEIR score.
const st = (us: number, them: number) => ({
  homeScore: us, awayScore: them, chances: 2, goals: 0, assists: 0, passes: 10, rating: 6.5, starMan: false,
  bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
} as MatchStats);

// ── 35: what pops up is what the table records ──
{
  let c: CareerState = makeInitialCareer(PLAYER, CLUBS);
  let weeks = 0, games = 0, same = 0;
  for (let g = 0; g < 60 && weeks < 12; g++) {
    const fx = nextFixtureFor(c);
    if (!fx) break;
    if ((fx.kind ?? "league") !== "league") { c = creditMatchResult(c, fx, st(2, 0)).career; continue; }
    const preview = previewOtherGames(c, fx);
    const { fixtures, goals } = liveWeekFor(c, fx);
    c = creditMatchResult(c, fx, st(g % 3, 1)).career;
    const recorded = (c.results ?? []).filter(r => r.week === fx.week && r.home !== "Chelsea" && r.away !== "Chelsea");
    weeks++;
    check(fixtures.length === recorded.length, `week ${fx.week}: every other game is in the panel`);
    for (const r of recorded) {
      games++;
      const p = preview.find(x => x.home === r.home && x.away === r.away);
      const final = scoresAt(fixtures, goals, 999).find(x => x.home === r.home && x.away === r.away);
      if (p && p.hs === r.hs && p.as === r.as && final && final.hs === r.hs && final.as === r.as) same++;
    }
  }
  check(weeks >= 10 && games >= 90, `enough league weeks measured (${weeks} weeks, ${games} games)`);
  check(same === games, `the live score of every other game is the one the table records (${same} of ${games})`);
}

// ── 35: only ticked clubs pop up; the panel is the score as it stands ──
{
  const c = makeInitialCareer(PLAYER, CLUBS);
  const fx = c.fixtures.find(f => !f.played && (f.kind ?? "league") === "league")!;
  const { fixtures, goals } = liveWeekFor(c, fx);
  check(goalsForFollowed(goals, []).length === 0, "nobody ticked: no pop-ups at all");
  const club = fixtures[0].home;
  const mine = goalsForFollowed(goals, [club]);
  check(mine.every(g => g.home === club || g.away === club), "ticked: only that club's game pops up");
  check(scoresAt(fixtures, goals, 0).every(r => r.hs === 0 && r.as === 0), "at kick-off every game is 0-0");
  const half = scoresAt(fixtures, goals, 45);
  const goalsByHalf = goals.filter(g => g.minute <= 45).length;
  check(half.reduce((a, r) => a + r.hs + r.as, 0) === goalsByHalf, "at half time the panel shows exactly the goals scored so far");
}

// ── 31: out in the Round of 16, the list is the quarter-finals ──
{
  let c: CareerState = makeInitialCareer(PLAYER, CLUBS);
  let out = false;
  for (let g = 0; g < 400 && !out; g++) {
    const fx = nextFixtureFor(c);
    if (!fx) break;
    const fa = c.cupState?.find(s => s.competition === "FA Cup");
    if (fx.competition === "FA Cup" && fa) {
      const lose = fa.rounds[fa.rounds.length - 1].name === "Round of 16";
      c = creditMatchResult(c, fx, lose ? st(0, 2) : st(2, 0)).career;
      out = lose;
    } else c = creditMatchResult(c, fx, fx.kind === "cup" ? st(2, 0) : st(1, 1)).career;
  }
  const fa = c.cupState?.find(s => s.competition === "FA Cup");
  const latest = fa?.rounds[fa.rounds.length - 1];
  check(out && !!fa && !stillIn(fa, "Chelsea"), "the career is knocked out of the FA Cup");
  check(!!fa && exitRound(fa, "Chelsea") === "Round of 16", "the heading's round is the Round of 16");
  check(latest?.name === "Quarter-Final" && latest.ties.length === 4, `the list under it is the quarter-finals, 4 ties (${latest?.name}, ${latest?.ties.length})`);
}

// ── 30: added time and who is chasing ──
{
  check(minuteLabel(90, 4) === "90" && minuteLabel(93, 4) === "90+3" && minuteLabel(95, 4) === "91", "the clock reads 90+N, then extra time counts on from 91");
  const charges = (home: boolean, us: number, them: number, teamStrength: number) => {
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const rng = mulberry32(100 + i);
      const inputs = { teamStrength, oppStrength: 70, playerSkill: 80, position: "ST", energy: 90, home, fergie: { from: 90, to: 95 } } as HiddenMatchInputs;
      const s = newMatch(rng);
      advanceTo(s, inputs, rng, 90);
      s.userScore = us; s.oppScore = them;
      for (;;) {
        const step = advanceUntilInvolved(s, inputs, rng, 95);
        if (!step.request) break;
        // Only while the score is still the one being tested.
        if (step.request.lateCharge && s.userScore === us && s.oppScore === them) n++;
        resolveScenario(s, "saved");
      }
    }
    return n;
  };
  check(charges(true, 0, 1, 83) > 0, "one down in added time: everyone forward");
  check(charges(true, 1, 1, 83) > 0, "level at home as the bigger side: everyone forward");
  check(charges(false, 1, 1, 83) === 0, "level away: no charge");
  check(charges(true, 1, 1, 60) === 0, "level at home as the smaller side: no charge");
  check(charges(true, 2, 1, 83) === 0, "winning: no charge");
}

if (problems.length) {
  console.error(`liveScores: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("liveScores: all checks passed");
