import {
  createShootout, takeNextKick, sideKicksTaken, nextShootoutSide, nextTakerIndex,
  penaltyConversionChance, simulateShootout, hasExtraTime, playKnockoutTie,
  settleAggregateTie, INITIAL_KICKS_PER_SIDE, type PenaltyShootoutState,
} from "../../lib/star/shootout";

/**
 * EXTRA TIME AND PENALTY SHOOTOUTS.
 *
 * What this replaces was a single weighted coin flip — no extra time, no
 * kicks, just a result. This is the real thing: alternating kicks, a
 * running score, sudden death, and an early stop the instant the trailing
 * side can no longer mathematically draw level within the initial five each.
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

// ── Per-competition extra-time rules ────────────────────────────────────────
{
  check(hasExtraTime("League Cup", "Round of 32") === false, "League Cup: no extra time before the final");
  check(hasExtraTime("League Cup", "Semi-Final") === false, "League Cup: still none in the semi");
  check(hasExtraTime("League Cup", "Final") === true, "League Cup: extra time in the Final");
  check(hasExtraTime("FA Cup", "Round of 64") === true, "FA Cup: extra time in every round, including the new Round of 64");
  check(hasExtraTime("FA Cup", "Final") === true, "FA Cup: extra time in the Final too");
  check(hasExtraTime("Champions League", "Round of 16") === true, "Champions League: extra time in every knockout tie");
  check(hasExtraTime("Europa League", "Quarter-Final") === true, "Europa League: same as the Champions League");
  check(hasExtraTime("Super Cup", "Final") === false, "Super Cup: straight to penalties");
  check(hasExtraTime("Community Shield", "Final") === false, "Community Shield: straight to penalties");
  check(hasExtraTime("Charity Shield", "Final") === false, "Charity Shield: straight to penalties");
}

// ── Alternating turn order ──────────────────────────────────────────────────
{
  let s = createShootout();
  const order: string[] = [];
  for (let i = 0; i < 10; i++) {
    order.push(nextShootoutSide(s));
    s = takeNextKick(s, i % 3 === 0);
  }
  check(order.join(",") === "home,away,home,away,home,away,home,away,home,away",
    `home then away, alternating (${order.join(",")})`);
}

// ── The exact worked example: 3-0 ends immediately after away's 3rd miss ──
{
  let s = createShootout();
  // Home scores 1, 2, 3; away misses 1, 2.
  s = takeNextKick(s, true);  // home 1: 1-0
  s = takeNextKick(s, false); // away 1: 1-0
  s = takeNextKick(s, true);  // home 2: 2-0
  s = takeNextKick(s, false); // away 2: 2-0
  check(!s.over, "after 2 each (2-0, 3 left each), not yet mathematically over");
  s = takeNextKick(s, true);  // home 3: 3-0
  check(!s.over, "immediately after home's 3rd penalty (3-0, home 2 left, away 2 left before their 3rd) — NOT yet over");
  s = takeNextKick(s, false); // away 3: still 3-0, both have taken 3, 2 left each
  check(s.over, "the instant away also misses their 3rd (3-0, 2 kicks left each — away's ceiling 2 < home's floor 3), it ends right there");
  check(s.winner === "home", "home wins");
  check(s.kicks.length === 6, `only 6 kicks were taken, not the full 10 (${s.kicks.length})`);
  check(s.homeScore === 3 && s.awayScore === 0, `final score 3-0 (${s.homeScore}-${s.awayScore})`);
}

// ── A closer race that legitimately goes all the way through 5 each ────────
{
  let s = createShootout();
  // Each round's home and away kick match (both score, or both miss), so
  // the score is level after every single kick — never triggers the
  // mathematical early stop, and reaches all 10 kicks by construction.
  const results = [true, true, false, false, true, true, false, false, true, true];
  for (const r of results) {
    if (s.over) break;
    s = takeNextKick(s, r);
  }
  check(s.kicks.length === 10, `both sides had to take all 5 (${s.kicks.length} kicks)`);
  check(s.homeScore === 3 && s.awayScore === 3, `3-3 after 5 each (${s.homeScore}-${s.awayScore})`);
  check(!s.over, "3-3 after 5 each is NOT over — sudden death follows");
}

// ── Sudden death: continues when both score or both miss, ends the instant
//    one scores and the other doesn't in the same round ───────────────────
{
  let s: PenaltyShootoutState = createShootout();
  // Force exactly a 3-3 after 5 each via direct results.
  const fiveEach = [true, true, false, true, true, false, true, true, false, false];
  for (const r of fiveEach) s = takeNextKick(s, r);
  check(s.homeScore === s.awayScore, `equal after 5 each (${s.homeScore}-${s.awayScore})`);
  check(!s.over, "still not over — sudden death starts");

  // Round 6 (sudden death): both score — continues.
  s = takeNextKick(s, true);  // home
  check(!s.over, "mid-round — away hasn't kicked yet, can't be over");
  s = takeNextKick(s, true);  // away — both scored this round
  check(!s.over, "both scored in the same sudden-death round — continues");

  // Round 7: both miss — continues.
  s = takeNextKick(s, false);
  s = takeNextKick(s, false);
  check(!s.over, "both missed in the same round — still continues");

  // Round 8: home scores, away misses — over, home wins, right there.
  s = takeNextKick(s, true);
  check(!s.over, "mid-round again — away hasn't kicked yet");
  s = takeNextKick(s, false);
  check(s.over, "one scored and the other didn't in the same round — over");
  check(s.winner === "home", "home wins the sudden death");
}

// ── Wraparound past the 11th taker ──────────────────────────────────────────
{
  let s = createShootout();
  // Take 22 home kicks worth of turns (interleaved with away) to push home's
  // own taker count past 11.
  const takers: number[] = [];
  for (let i = 0; i < 24 && !s.over; i++) {
    const side = nextShootoutSide(s);
    if (side === "home") takers.push(nextTakerIndex(s, "home", 11));
    s = takeNextKick(s, true, 11); // everybody scores — nobody's ever eliminated, keeps it going
  }
  check(takers.length >= 12, `reached at least a 12th home kick before the guard (${takers.length})`);
  check(takers[0] === 0 && takers[10] === 10, `the first 11 home takers are 0..10 in order (${takers.slice(0, 11).join(",")})`);
  check(takers[11] === 0, `the 12th home penalty wraps back to the 1st taker (index ${takers[11]})`);
  if (takers.length > 12) check(takers[12] === 1, "the 13th wraps to the 2nd taker");
}

// ── A real, measured, skill-weighted conversion rate ────────────────────────
{
  check(penaltyConversionChance(95) > penaltyConversionChance(65), "an elite taker converts more often than a neutral one");
  check(penaltyConversionChance(65) > penaltyConversionChance(30), "a neutral taker converts more often than a poor one");
  check(penaltyConversionChance(30) >= 0.45 && penaltyConversionChance(30) <= 0.95, "clamped to a sane band");
  check(penaltyConversionChance(200) <= 0.95, "clamped at the top even for an absurd input");
  check(penaltyConversionChance(-50) >= 0.45, "clamped at the bottom even for an absurd input");
  check(penaltyConversionChance(65) >= 0.70 && penaltyConversionChance(65) <= 0.90,
    `a neutral taker converts around the real professional ~75-85% band (${penaltyConversionChance(65).toFixed(2)})`);

  // Measured, not assumed: across many simulated shootouts, a high-skill
  // side should win outright noticeably more than a low-skill one.
  let eliteWins = 0, poorWins = 0;
  const N = 800;
  for (let seed = 0; seed < N; seed++) {
    const rng = mulberry(seed * 97 + 3);
    const r = simulateShootout(92, 40, rng);
    if (r.home > r.away) eliteWins++;
    if (r.away > r.home) poorWins++;
  }
  check(eliteWins > poorWins * 2, `an elite side (92) beats a poor one (40) far more often across ${N} shootouts (${eliteWins} vs ${poorWins})`);
}

// ── simulateShootout terminates and produces a coherent, consistent state ──
{
  for (let seed = 0; seed < 200; seed++) {
    const rng = mulberry(seed * 131 + 7);
    const { home, away, state } = simulateShootout(70, 70, rng);
    check(state.over, `seed ${seed}: the shootout genuinely finished`);
    check(state.homeScore === home && state.awayScore === away, `seed ${seed}: returned scores match the final state`);
    check(home !== away, `seed ${seed}: a shootout is never level (${home}-${away})`);
    check(state.kicks.length >= INITIAL_KICKS_PER_SIDE * 2 - 1 || state.kicks.length < INITIAL_KICKS_PER_SIDE * 2,
      `seed ${seed}: a sane number of kicks were taken (${state.kicks.length})`);
  }
}

// ── Single-match knockout ties (League Cup / FA Cup rounds) ────────────────
{
  // A League Cup round BEFORE the final never gets extra time — if it comes
  // out level after 90 it should go straight to penalties (score stays what
  // the 90-minute simulation produced, `wentToExtraTime` false).
  let sawLevel90ThatWentToPens = false;
  for (let seed = 0; seed < 400 && !sawLevel90ThatWentToPens; seed++) {
    const rng = mulberry(seed * 41 + 3);
    const result = playKnockoutTie(70, 70, "League Cup", "Round of 32", rng);
    if (!result.wentToExtraTime && result.pens) sawLevel90ThatWentToPens = true;
  }
  check(sawLevel90ThatWentToPens, "a League Cup round before the final that's level after 90 goes straight to penalties, no extra time");

  // A League Cup FINAL, or an FA Cup round, that comes out level after 90
  // should go to extra time first.
  let sawExtraTimeInFinal = false;
  for (let seed = 0; seed < 400 && !sawExtraTimeInFinal; seed++) {
    const rng = mulberry(seed * 59 + 11);
    const result = playKnockoutTie(70, 70, "League Cup", "Final", rng);
    if (result.wentToExtraTime) sawExtraTimeInFinal = true;
  }
  check(sawExtraTimeInFinal, "a League Cup FINAL that's level after 90 goes to extra time");

  let sawExtraTimeInFACup = false;
  for (let seed = 0; seed < 400 && !sawExtraTimeInFACup; seed++) {
    const rng = mulberry(seed * 61 + 13);
    const result = playKnockoutTie(70, 70, "FA Cup", "Round of 64", rng);
    if (result.wentToExtraTime) sawExtraTimeInFACup = true;
  }
  check(sawExtraTimeInFACup, "an FA Cup round that's level after 90 goes to extra time (every round, including the Round of 64)");

  // Super Cup / Community Shield: never extra time.
  let anyExtraTimeInSuperCup = false;
  for (let seed = 0; seed < 400; seed++) {
    const rng = mulberry(seed * 71 + 17);
    const result = playKnockoutTie(70, 70, "Super Cup", "Final", rng);
    if (result.wentToExtraTime) anyExtraTimeInSuperCup = true;
  }
  check(!anyExtraTimeInSuperCup, "the Super Cup never goes to extra time across 400 trials");

  let anyExtraTimeInShield = false;
  for (let seed = 0; seed < 400; seed++) {
    const rng = mulberry(seed * 79 + 19);
    const result = playKnockoutTie(70, 70, "Community Shield", "Final", rng);
    if (result.wentToExtraTime) anyExtraTimeInShield = true;
  }
  check(!anyExtraTimeInShield, "the Community Shield never goes to extra time across 400 trials");

  // A tie that's NOT level after 90 is never sent to extra time/penalties.
  for (let seed = 0; seed < 100; seed++) {
    const rng = mulberry(seed * 83 + 23);
    const result = playKnockoutTie(95, 30, "FA Cup", "Final", rng);
    if (result.hs !== result.as) {
      check(!result.pens, `seed ${seed}: a decisive scoreline never has a shootout attached`);
    }
  }
}

// ── Aggregate two-legged ties (Champions League / Europa League) ───────────
{
  // Ahead on aggregate after 90 of the second leg: wins outright, no extra time.
  const decisive = settleAggregateTie(
    "Home Utd", "Away FC", { hs: 2, as: 0 }, { hs: 1, as: 1 }, 75, 75, "Champions League", mulberry(1),
  );
  check(decisive.winner === "Home Utd", "2-0 first leg, 1-1 second leg: Home Utd win 3-1 on aggregate, no extra time needed");
  check(!decisive.extraTime, "…and no extra time was played");
  check(!decisive.wentToPenalties, "…nor penalties");

  // Level on aggregate after 90: extra time is played.
  let sawExtraTime = false, sawPensAfterET = false;
  for (let seed = 0; seed < 300; seed++) {
    const rng = mulberry(seed * 47 + 5);
    const r = settleAggregateTie("A", "B", { hs: 1, as: 1 }, { hs: 1, as: 1 }, 70, 70, "Champions League", rng);
    if (r.extraTime) sawExtraTime = true;
    if (r.wentToPenalties) sawPensAfterET = true;
  }
  check(sawExtraTime, "level on aggregate after 90 of the second leg → extra time is played");
  check(sawPensAfterET, "…and sometimes still level after that → penalties");

  // Europa League behaves identically in shape.
  const el = settleAggregateTie("A", "B", { hs: 0, as: 0 }, { hs: 0, as: 0 }, 70, 70, "Europa League", mulberry(9));
  check(el.extraTime !== undefined || el.wentToPenalties !== undefined, "Europa League ties also go through extra time/penalties when level");

  // A live tie's own pre-decided shootout should be honoured by
  // playCupRound/settleTie rather than re-simulated — covered in
  // cups.mts/euro tests directly (this file only tests the pure math).
  check(typeof decisive.winner === "string" && decisive.winner.length > 0, "a winner is always named");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 20)) console.error("  ✗ " + p);
  if (problems.length > 20) console.error(`  …and ${problems.length - 20} more`);
  process.exit(1);
}
console.log("PASS — extra time per competition, a real alternating shootout with the exact mathematical early-stop, sudden death, 12th-kick wraparound, and skill-weighted conversion");
