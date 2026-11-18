import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { periodDue, decide, applyDecision, syncIntl, intlOf, worldOf } from "../../lib/star/intl/career";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { CareerState, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * A June window still unanswered when the season rolls over is passed, not
 * left waiting: while it waited, every later international waited too (the
 * world stood still at Spain v England, 10 Jun 2027, Mikey 3 Nov 2026).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const st = { chances: 3, goals: 0, assists: 0, passes: 8, rating: 7, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1, homeScore: 1, awayScore: 0, minutes: 90 } as MatchStats;
const p = { firstName: "Test", lastName: "Player", age: 24, position: "ST", club: "Arsenal", nationality: "England", startYear: 2026 } as StarPlayer;
let s: CareerState = syncIntl(makeInitialCareer(p, PREMIER_LEAGUE_CLUBS, "premier"));
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
for (let season = 1; season <= 2; season++) {
  for (let g = 0; g < 400; g++) {
    const clubLeft = (s.fixtures ?? []).some((f) => !f.played && f.kind !== "international");
    if (!clubLeft) break; // the season ends with the June window unanswered
    const due = periodDue(s);
    if (due) { s = applyDecision(s, { ...decide(s, due), called: false }); continue; }
    const n = nextFixtureFor(s);
    if (!n) break;
    s = creditMatchResult(s, n, st).career;
  }
  if (s.season === 2) check(!intlOf(s).periods["W:2027-jun"], "the June 2027 window is still unanswered at the end of season 2 (the case under test)");
  s = syncIntl(advanceSeason(s, false).career);
}
const w = worldOf(s);
const firstOpen = w.matches.filter((m) => m.hs == null).sort((a, b) => a.date - b.date)[0];
check(intlOf(s).periods["W:2027-jun"]?.called === false, "the skipped June window is marked as passed");
check(!!firstOpen && firstOpen.date > Date.UTC(2027, 6, 1), `the world plays on past June 2027 (first unplayed: ${firstOpen ? iso(firstOpen.date) : "none"})`);
console.log(`season ${s.season} starts: first unplayed international ${firstOpen ? iso(firstOpen.date) : "none"}, ${w.matches.filter((m) => m.hs != null).length} played`);
if (problems.length) { console.log("FAIL"); for (const x of problems) console.log("  ✗ " + x); process.exit(1); }
console.log("PASS — a window left unanswered at the rollover never stops the international world");
