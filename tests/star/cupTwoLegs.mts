import { cupFixtureFor, settleCupTie } from "../../lib/star/competitions";
import { tieWinner, playCupRound, isTwoLeggedRound, type CupState } from "../../lib/star/cups";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * THE LEAGUE CUP SEMI-FINAL IS TWO LEGS (Mikey, 8 Oct 2026: "i thought they
 * were 2 legged"). The calendar always had two dates for it; the tie was
 * still one match. Now: leg one goes on the tie and puts leg two on the
 * calendar at the other ground; leg two settles it on aggregate, level goes
 * to penalties (no extra time in a League Cup semi).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const clubs = [...PREMIER_LEAGUE_CLUBS];
const you = clubs[3];
const player = { firstName: "T", lastName: "P", age: 20, skinTone: "light", club: you, clubBadge: null,
  position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;

check(isTwoLeggedRound("League Cup", "Semi-Final") && !isTwoLeggedRound("FA Cup", "Semi-Final")
  && !isTwoLeggedRound("League Cup", "Final"), "only the League Cup semi-final is two legs");

function atSemis(youHome: boolean): CareerState {
  const c = makeInitialCareer(player, clubs, "premier");
  const opp = clubs[8];
  const state: CupState = {
    competition: "League Cup",
    rounds: [
      { name: "Round of 32", ties: [] }, { name: "Round of 16", ties: [] }, { name: "Quarter-Final", ties: [] },
      { name: "Semi-Final", ties: [youHome ? { home: you, away: opp } : { home: opp, away: you }, { home: clubs[0], away: clubs[1] }] },
    ],
  };
  return { ...c, cupState: [state] };
}

for (const youHome of [true, false]) {
  let c = atSemis(youHome);
  const leg1 = cupFixtureFor(c.cupState![0], c, 3)!;
  check(leg1.leg === 1 && leg1.home === youHome && leg1.round === "Semi-Final", `leg one fixture (you home: ${youHome})`);

  const o1 = settleCupTie(c, leg1, 2, 1)!;
  const tie1 = o1.states[0].rounds[3].ties.find(t => t.home === you || t.away === you)!;
  check(tie1.hs === undefined && tie1.legs?.length === 1, "after leg one the tie is not decided");
  check(tie1.legs![0].hs === (youHome ? 2 : 1) && tie1.legs![0].as === (youHome ? 1 : 2), "leg one stored in the tie's home/away terms");
  const leg2 = o1.nextFixture!;
  check(leg2.leg === 2 && leg2.home === !youHome && leg2.week > leg1.week, `leg two at the other ground, later (${leg1.week} → ${leg2.week})`);
  check(o1.states[0].rounds.length === 4 && !o1.trophy, "no draw and no trophy after leg one");

  // Leg two: lose 0-1 → 2-2 on aggregate → penalties.
  c = { ...c, cupState: o1.states };
  const o2 = settleCupTie(c, leg2, 0, 1)!;
  const tie2 = o2.states[0].rounds[3].ties.find(t => t.home === you || t.away === you)!;
  check(tie2.hs === 2 && tie2.as === 2 && tie2.legs?.length === 2, `aggregate 2-2 (${tie2.hs}-${tie2.as})`);
  check(!!tie2.pens && !!tieWinner(tie2) && !tie2.wentToExtraTime, "level on aggregate: penalties, no extra time");
  const other = o2.states[0].rounds[3].ties.find(t => t !== tie2)!;
  check(other.legs?.length === 2 && other.hs === other.legs![0].hs + other.legs![1].hs, "the other semi is two legs too");
  const through = tieWinner(tie2) === you;
  check(through ? o2.states[0].rounds.length === 5 && o2.states[0].rounds[4].name === "Final" : !o2.nextFixture,
    "the final is drawn once both semis are settled");
}

// Simulated semis everywhere are two legs; nothing else is.
{
  const rng = mulberry32(5);
  const st: CupState = { competition: "FA Cup", rounds: [{ name: "Semi-Final", ties: [{ home: clubs[0], away: clubs[1] }, { home: clubs[2], away: clubs[3] }] }] };
  const fa = playCupRound(st, makeInitialCareer(player, clubs, "premier").league, "nobody", null, rng);
  check(fa.rounds[0].ties.every(t => !t.legs), "FA Cup semis stay one match");
}

if (problems.length) {
  console.error(`cupTwoLegs: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("cupTwoLegs: all good");
