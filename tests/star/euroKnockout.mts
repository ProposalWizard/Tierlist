import { settleTie, type EuroTie } from "../../lib/star/euro";

/**
 * CHAMPIONS/EUROPA LEAGUE KNOCKOUT TIES — EXTRA TIME AND PENALTIES.
 *
 * `settleTie` used to be a single coin flip weighted by quality the moment
 * the aggregate came out level. Now: ahead on aggregate after 90 wins
 * outright; level goes to extra time (added into the second leg's own
 * score); still level after that goes to a real penalty shootout.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tieAt(usLeg1: number, themLeg1: number, usLeg2: number, themLeg2: number): EuroTie {
  return {
    round: "Round of 16",
    opponent: "Some Club",
    opponentStrength: 75,
    legs: [{ home: true, us: usLeg1, them: themLeg1 }, { home: false, us: usLeg2, them: themLeg2 }],
  };
}

// ── Ahead on aggregate after 90: wins outright, no extra time ──────────────
{
  const tie = tieAt(2, 0, 1, 1); // 3-1 on aggregate
  const decided = settleTie(tie, 75, mulberry(1));
  check(decided.result === "W", "2-0 then 1-1: 3-1 on aggregate — you win outright");
  check(!decided.wentToExtraTime, "…no extra time needed");
  check(!decided.onPenalties, "…nor penalties");
  check(decided.legs[1].us === 1 && decided.legs[1].them === 1, "the second leg's own score is untouched — nothing was added");
}

{
  const tie = tieAt(0, 2, 1, 1); // 1-3 down on aggregate
  const decided = settleTie(tie, 75, mulberry(2));
  check(decided.result === "L", "0-2 then 1-1: 1-3 on aggregate — you lose outright");
  check(!decided.wentToExtraTime, "…no extra time needed either way");
}

// ── Level on aggregate after 90: extra time, then maybe penalties ─────────
{
  let sawExtraTime = false, sawDecidedInExtraTime = false, sawPensAfterExtraTime = false;
  for (let seed = 0; seed < 300; seed++) {
    const tie = tieAt(1, 1, 1, 1); // 2-2 on aggregate after 90
    const decided = settleTie(tie, 75, mulberry(seed * 37 + 3));
    check(decided.legs.every(l => l.us !== undefined && l.them !== undefined), `seed ${seed}: both legs stay fully scored`);
    if (decided.wentToExtraTime) {
      sawExtraTime = true;
      if (!decided.onPenalties) sawDecidedInExtraTime = true;
      if (decided.onPenalties) sawPensAfterExtraTime = true;
      check(!!decided.extraTime, `seed ${seed}: extraTime detail is recorded when it's played`);
      // The extra-time goals are genuinely folded into the second leg's own score.
      const secondLeg = decided.legs[1];
      check(secondLeg.us === 1 + (decided.extraTime?.us ?? 0) && secondLeg.them === 1 + (decided.extraTime?.them ?? 0),
        `seed ${seed}: the second leg's score includes the real extra-time goals`);
    }
    check(decided.result === "W" || decided.result === "L", `seed ${seed}: always resolves to a real winner`);
  }
  check(sawExtraTime, "a level-after-90 aggregate tie genuinely goes to extra time");
  check(sawDecidedInExtraTime, "…and sometimes it's settled during extra time itself");
  check(sawPensAfterExtraTime, "…and sometimes it's STILL level after 120, going to real penalties");
}

// ── A live shootout the player actually took is honoured, not re-simulated ─
{
  const livePens = { us: 5, them: 4 };
  let found = false;
  for (let seed = 0; seed < 2000 && !found; seed++) {
    const tie = tieAt(1, 1, 1, 1);
    const decided = settleTie(tie, 75, mulberry(seed), livePens);
    if (decided.onPenalties) {
      found = true;
      check(decided.pens?.us === 5 && decided.pens?.them === 4,
        `the exact live shootout score is used, not a new random one (${JSON.stringify(decided.pens)})`);
      check(decided.result === "W", "the live shootout result decides the winner");
    }
  }
  check(found, "found a seed where extra time is also level, reaching the penalties branch, within 2000 tries");
}

// ── A single-leg Final also gets extra time/penalties when level ──────────
{
  let sawFinalExtraTime = false;
  for (let seed = 0; seed < 300; seed++) {
    const tie: EuroTie = { round: "Final", opponent: "Final Opponent", opponentStrength: 75, legs: [{ home: false, us: 1, them: 1 }] };
    const decided = settleTie(tie, 75, mulberry(seed * 61 + 5));
    if (decided.wentToExtraTime) sawFinalExtraTime = true;
    check(decided.result === "W" || decided.result === "L", `seed ${seed}: the final always resolves`);
  }
  check(sawFinalExtraTime, "a level Champions/Europa League final also goes to extra time");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 20)) console.error("  ✗ " + p);
  if (problems.length > 20) console.error(`  …and ${problems.length - 20} more`);
  process.exit(1);
}
console.log("PASS — Champions/Europa League knockout ties: ahead on aggregate wins outright, level goes to real extra time then real penalties, and a live shootout is honoured rather than re-simulated");
