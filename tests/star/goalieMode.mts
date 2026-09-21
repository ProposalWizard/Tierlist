import {
  pickShot, resolveDive, streakMultiplier, shotLabel,
  MAX_REACH_X, MAX_REACH_Z, KEEPER_SET_X, KEEPER_SET_Z,
  type GoalieShot, type ShotKind,
} from "../../lib/star/goalieMode";
import { GOAL_W, GOAL_H } from "../../lib/star/pitch";
import { mulberry32 } from "../../lib/star/season";

/**
 * GOALIE MODE — is the one tension the whole game is built on actually
 * there: is diving right before/at the strike genuinely the best play, is
 * holding your gloves in a corner from the start genuinely a losing one,
 * and does that gap actually widen (not just hold flat) as difficulty
 * climbs?
 *
 * Same idiom as every other suite here: a problems[] array, PASS/FAIL,
 * process.exit(1) on failure. Every percentage threshold below was first
 * measured with a real scratch harness against this exact code (see the
 * commit history / CLAUDE.md's own session log for the two real bugs that
 * measurement caught and the redesign that fixed them) — the numbers here
 * are real, observed floors and ceilings with real margin, not vibes, and
 * comparisons between streaks are relative (streak N vs streak M) rather
 * than pinned to one exact percentage, so a later, deliberate retune of
 * DIVE_SPEED/EARLY_GRACE_T/etc. doesn't need this file rewritten unless it
 * actually breaks the fairness claim itself.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const pct = (n: number, d: number) => (n / Math.max(1, d)) * 100;

/** Save rate at a fixed commit offset from the strike, perfect aim, over a
 *  real batch of real generated shots (off-target ones excluded — they're
 *  never a test of the dive itself). */
function saveRateAtOffset(streak: number, offset: number, seed: number, n = 2500): number {
  const rng = mulberry32(seed);
  let saved = 0, total = 0;
  for (let i = 0; i < n; i++) {
    const shot = pickShot(streak, rng);
    if (shot.offTarget) continue;
    const commitT = shot.strikeAtT + offset;
    const res = resolveDive(shot, { commitT, targetX: shot.targetX, targetZ: shot.targetZ });
    total++;
    if (res.saved) saved++;
  }
  return pct(saved, total);
}

// ── The sweet spot: at/near the strike beats early, on both easy and hard ──

{
  const easyAtStrike = saveRateAtOffset(0, 0, 1);
  const easyShadeEarly = saveRateAtOffset(0, -0.10, 2);
  check(easyAtStrike >= 90, `committing exactly at the strike (easy) saves the large majority (got ${easyAtStrike.toFixed(1)}%)`);
  check(easyShadeEarly >= 90, `reading the tell and going a little early (easy) is still fine, not punished (got ${easyShadeEarly.toFixed(1)}%)`);

  const hardAtStrike = saveRateAtOffset(20, 0, 3);
  check(hardAtStrike >= 85, `committing exactly at the strike (streak 20) still saves the large majority (got ${hardAtStrike.toFixed(1)}%)`);
}

// ── Can't just hold your gloves somewhere — early commitment genuinely
// collapses, and holding from the very start of the sequence (t=0) is
// barely better than never diving at all. ──

{
  const easyDeepEarly = saveRateAtOffset(0, -0.55, 4);
  const easyAtStrike = saveRateAtOffset(0, 0, 1);
  check(easyDeepEarly <= 35, `committing 0.55s before the strike (easy) is clearly punished (got ${easyDeepEarly.toFixed(1)}%)`);
  check(easyAtStrike - easyDeepEarly >= 50, `at-strike beats deep-early by a real margin, not a token one (${easyAtStrike.toFixed(1)}% vs ${easyDeepEarly.toFixed(1)}%)`);

  // Holding from literally the start of the sequence (before any tell is
  // even visible) — the exact anti-pattern named directly in the request.
  const rng = mulberry32(5);
  let saved = 0, total = 0;
  const N = 2500;
  for (let i = 0; i < N; i++) {
    const shot = pickShot(0, rng);
    if (shot.offTarget) continue;
    const res = resolveDive(shot, { commitT: 0, targetX: shot.targetX, targetZ: shot.targetZ });
    total++;
    if (res.saved) saved++;
  }
  const holdFromStart = pct(saved, total);

  const rngNoDive = mulberry32(6);
  let savedNoDive = 0, totalNoDive = 0;
  for (let i = 0; i < N; i++) {
    const shot = pickShot(0, rngNoDive);
    if (shot.offTarget) continue;
    const res = resolveDive(shot, null);
    totalNoDive++;
    if (res.saved) savedNoDive++;
  }
  const neverDives = pct(savedNoDive, totalNoDive);

  check(holdFromStart <= neverDives + 20, `holding gloves from t=0 is close to never diving at all, not a real strategy (${holdFromStart.toFixed(1)}% vs ${neverDives.toFixed(1)}% baseline)`);
  check(neverDives > 0 && neverDives <= 30, `never touching the screen still saves some central shots, but not many (got ${neverDives.toFixed(1)}%)`);
}

// ── Difficulty genuinely narrows the window — the same "how early is too
// early" offset is far more punishing at streak 20 than at streak 0, and
// the same is true on the late side. This is the emergent, measured claim:
// nothing in pickShot/resolveDive explicitly reads streak when deciding the
// timing ceiling — the narrowing falls out of harder placement interacting
// with the fixed SAVE_REACH tolerance, and that's confirmed here, not just
// assumed from reading the formula. ──

{
  const OFF = -0.40;
  const easyAtOff = saveRateAtOffset(0, OFF, 7);
  const hardAtOff = saveRateAtOffset(20, OFF, 7);
  check(easyAtOff - hardAtOff >= 40, `the same early offset (${OFF}s) is far more punishing at streak 20 than streak 0 (easy ${easyAtOff.toFixed(1)}% vs hard ${hardAtOff.toFixed(1)}%)`);

  const LATE = 0.40;
  const easyLate = saveRateAtOffset(0, LATE, 8);
  const hardLate = saveRateAtOffset(20, LATE, 8);
  check(easyLate - hardLate >= 20, `the same late offset (+${LATE}s) is more punishing at streak 20 than streak 0 (easy ${easyLate.toFixed(1)}% vs hard ${hardLate.toFixed(1)}%)`);
}

// ── Direct, hand-built cases on resolveDive itself — no RNG involved ──

{
  // A shot dead centre on the keeper's own set position: even with no dive
  // at all, that's a save — he was already standing there.
  const central: GoalieShot = {
    kind: "drive", startY: 16, strikeAtT: 1.0, tellT: 0.3, flightT: 0.5,
    arriveAtT: 1.5, targetX: KEEPER_SET_X, targetZ: KEEPER_SET_Z,
    offTarget: false, tellSide: 1, strikerSide: 1, curl: 0,
  };
  const noDiveCentral = resolveDive(central, null);
  check(noDiveCentral.saved, "a shot dead at the keeper's set position is saved even with no dive at all");

  // Committed absurdly early relative to the strike, aimed at a real
  // corner: should land near the staleness floor (heavily reduced reach),
  // not anywhere close to full reach — and should read as "recovering".
  const corner: GoalieShot = {
    kind: "drive", startY: 18, strikeAtT: 2.0, tellT: 0.3, flightT: 1.0,
    arriveAtT: 3.0, targetX: MAX_REACH_X, targetZ: MAX_REACH_Z,
    offTarget: false, tellSide: 1, strikerSide: 1, curl: 0,
  };
  const staleDive = resolveDive(corner, { commitT: 0, targetX: MAX_REACH_X, targetZ: MAX_REACH_Z });
  check(staleDive.reachFrac < 0.25, `a dive committed 2s before the strike caps out at a heavily reduced reach (got reachFrac=${staleDive.reachFrac.toFixed(2)})`);
  check(staleDive.recovering, "a dive committed well before the strike reads as recovering/sagging by the time it matters");
  check(!staleDive.saved, "that heavily-reduced reach isn't enough to reach a real corner");

  // Committed exactly at the strike, aimed at that same close-in target far
  // enough out that the dive has ample time: full reach, no staleness.
  const primeDive = resolveDive(corner, { commitT: 2.0, targetX: MAX_REACH_X, targetZ: MAX_REACH_Z });
  check(primeDive.reachFrac > 0.95, `a dive committed exactly at the strike, with time to spare, reaches full stretch (got reachFrac=${primeDive.reachFrac.toFixed(2)})`);
  check(!primeDive.recovering, "a dive committed at the strike itself never reads as recovering");
  check(primeDive.saved, "full stretch at the actual target is a save");

  // Committed after the ball has already arrived: no time at all.
  const tooLate = resolveDive(corner, { commitT: 3.5, targetX: MAX_REACH_X, targetZ: MAX_REACH_Z });
  check(tooLate.reachFrac === 0, `a commit after the ball has already arrived gets zero reach (got ${tooLate.reachFrac})`);
  check(!tooLate.saved, "no time at all to react means a real corner beats him");

  // Off-target is always credited as safe, dive or no dive, and never
  // claims a real save distance.
  const wide: GoalieShot = {
    kind: "curl", startY: 15, strikeAtT: 1.0, tellT: 0.3, flightT: 0.6,
    arriveAtT: 1.6, targetX: 6, targetZ: 4, offTarget: true, tellSide: -1, strikerSide: -1, curl: 0.6,
  };
  const wideNoDive = resolveDive(wide, null);
  const wideWithDive = resolveDive(wide, { commitT: 0.9, targetX: 0, targetZ: 0 });
  check(wideNoDive.saved && wideWithDive.saved, "an off-target shot is always a non-event, whatever you did");
  check(wideNoDive.distance === 0 && wideWithDive.distance === 0, "an off-target shot never reports a real save distance");
}

// ── Shot generation stays within real, sane bounds ──

{
  const rng = mulberry32(9);
  let sawUnlocked: Partial<Record<ShotKind, boolean>> = {};
  let nearPost = 0, farPost = 0, labelledDrives = 0;
  for (let i = 0; i < 4000; i++) {
    const streak = i % 30;
    const shot = pickShot(streak, rng);
    sawUnlocked[shot.kind] = true;
    check(Math.abs(shot.targetX) <= MAX_REACH_X + 1e-9, `targetX stays within reach bounds (got ${shot.targetX} at streak ${streak})`);
    check(shot.targetZ >= -1e-9 && shot.targetZ <= MAX_REACH_Z + 1e-9, `targetZ stays within reach bounds (got ${shot.targetZ} at streak ${streak})`);
    check(shot.flightT > 0 && Number.isFinite(shot.flightT), "flightT is a real positive number");
    check(shot.tellT > 0 && Number.isFinite(shot.tellT), "tellT is a real positive number, never zero (always readable)");
    check(shot.strikeAtT > 0 && Number.isFinite(shot.strikeAtT), "strikeAtT is a real positive number");
    check(Math.abs(shot.arriveAtT - (shot.strikeAtT + shot.flightT)) < 1e-9, "arriveAtT is exactly strikeAtT + flightT");
    check(shot.tellSide === Math.sign(shot.targetX) || shot.targetX === 0, "tellSide always matches the true direction of the shot, never a decoy");
    check(shot.strikerSide === 1 || shot.strikerSide === -1, `strikerSide is always a real side, never anything else (got ${shot.strikerSide})`);

    if (streak === 0) check(shot.kind === "drive", `only 'drive' is available at streak 0 (got ${shot.kind})`);
    if (streak < 1) check(shot.kind !== "first_time", `first_time shouldn't unlock before streak 1 (got it at streak ${streak})`);
    if (streak < 2) check(shot.kind !== "curl", `curl shouldn't unlock before streak 2 (got it at streak ${streak})`);
    if (streak < 3) check(shot.kind !== "header", `header shouldn't unlock before streak 3 (got it at streak ${streak})`);
    if (streak < 4) check(shot.kind !== "volley", `volley shouldn't unlock before streak 4 (got it at streak ${streak})`);

    // Every shot gets a real, non-empty label, and it never claims something
    // the shot itself isn't doing.
    const label = shotLabel(shot);
    check(typeof label === "string" && label.length > 0, "shotLabel always returns a real, non-empty string");
    if (shot.kind === "header") check(label === "HEADER FROM A CROSS", `a header is always labelled as one (got "${label}")`);
    if (shot.kind === "volley") check(label === "VOLLEY", `a volley is always labelled as one (got "${label}")`);
    if (shot.kind === "first_time") check(label === "FIRST-TIME STRIKE", `a first-time strike is always labelled as one (got "${label}")`);
    if (shot.kind === "curl") check(label === "CURLING EFFORT", `a curler is always labelled as one (got "${label}")`);
    if (shot.kind === "drive") {
      labelledDrives++;
      if (shot.startY >= 17) {
        check(label === "LONG RANGE", `a drive from ${shot.startY.toFixed(1)}m is labelled long range (got "${label}")`);
      } else if (shot.strikerSide === shot.tellSide) {
        nearPost++;
        check(label === "NEAR POST", `a same-side drive under 17m is labelled near post (got "${label}")`);
      } else {
        farPost++;
        check(label === "FAR POST", `a cross-body drive under 17m is labelled far post (got "${label}")`);
      }
    }
  }
  check(sawUnlocked.drive === true, "drive shows up across a real batch of shots");
  check(sawUnlocked.first_time === true, "first_time shows up once streak reaches its unlock");
  check(sawUnlocked.curl === true, "curl shows up once streak reaches its unlock");
  check(sawUnlocked.header === true, "header shows up once streak reaches its unlock");
  check(sawUnlocked.volley === true, "volley shows up once streak reaches its unlock");
  // strikerSide is a real, independent roll — both a near-post and a
  // far-post finish actually occur, in real numbers, not one dominating.
  // Denominator is the near/far-eligible subset (drives under 17m), not
  // every drive — a long-range one never gets either label at all.
  const postEligible = nearPost + farPost;
  check(postEligible > 200, "enough near/far-post-eligible drives in this batch to judge the split");
  check(nearPost > postEligible * 0.3 && farPost > postEligible * 0.3,
    `both near-post and far-post finishes occur in real numbers, not one crowding the other out (${nearPost} near vs ${farPost} far of ${postEligible})`);
}

// ── Reach bounds are real geometry, not arbitrary numbers ──

{
  check(MAX_REACH_X > 0 && MAX_REACH_X < GOAL_W / 2, `MAX_REACH_X is a real fraction of the goal's own half-width (got ${MAX_REACH_X.toFixed(2)}m of ${(GOAL_W / 2).toFixed(2)}m)`);
  check(MAX_REACH_Z > 0 && MAX_REACH_Z < GOAL_H, `MAX_REACH_Z is a real fraction of the goal's own height (got ${MAX_REACH_Z.toFixed(2)}m of ${GOAL_H.toFixed(2)}m)`);
  check(KEEPER_SET_Z > 0 && KEEPER_SET_Z < MAX_REACH_Z, "the keeper's set position is a real height off the ground, under his own max reach");
}

// ── Streak multiplier: a real push-your-luck ladder, not a flat number ──

{
  check(streakMultiplier(0) === 1, "streak 0 is always a flat 1x, nothing risked yet");
  check(streakMultiplier(-5) === 1, "a nonsense negative streak never goes below 1x");

  let prev = streakMultiplier(0);
  let everGrew = false;
  for (let s = 1; s <= 40; s++) {
    const m = streakMultiplier(s);
    check(m >= prev, `streak multiplier never drops as the streak grows (streak ${s}: ${m} vs streak ${s - 1}: ${prev})`);
    if (m > prev) everGrew = true;
    prev = m;
  }
  check(everGrew, "the multiplier actually climbs somewhere, not pinned flat forever");
  check(prev >= 5 && prev <= 50, `the ladder caps at a real, bounded ceiling, not unbounded (capped at ${prev}x)`);
  check(streakMultiplier(3) > streakMultiplier(1), "a few consecutive saves is already worth meaningfully more than one");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — goalie mode: at-the-strike beats early on both difficulties, holding your gloves from the start is a losing move barely above never diving, and the window measurably tightens as the streak climbs");
