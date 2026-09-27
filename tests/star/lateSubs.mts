import {
  newMatch, advanceTo, advanceUntilInvolved, resolveScenario, lateSubQuota,
  lateSubInvolvement, lateSubExtra, LATE_SUB_GUARANTEE_FROM, type HiddenMatchInputs,
} from "../../lib/star/hiddenMatch";
import { hookCheck, SUB_OFF_ENERGY, SUB_TIRED_FROM, subLadderMinute, subComesOnNow } from "../../lib/star/selection";
import { mulberry32 } from "../../lib/star/season";
import { rollAddedTime, addedTimeSeed } from "../../lib/star/addedTime";

/**
 * SUBS (v0.15 items 24 and 25), Harry's decisions of 27 Sep 2026.
 *
 * 24: a sub's chances are squeezed into the minutes he has left, allowing for
 *     his fitness — on at 80' he still gets about two — and from 70' at least
 *     one is guaranteed.
 * 25: once on, a sub stays on unless his energy runs out: the chance of
 *     coming off only starts as he nears 0%, and at 0% he is off.
 *
 * Measured on the real unseen match (hiddenMatch.ts): a 99-rated striker at an
 * 83-rated side, against an 80-rated one, with the added time the real match
 * rolls. Chances are settled 50/50 goal/saved — only how many come is pinned.
 * Before this (the same cameos, no lateSub): on at 70' 1.49 chances and none
 * 18% of the time; on at 80' 0.75 and none 46%; on at 88' 0.16 and none 85%.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function cameo(entry: number, i: number, fitness = 90): number {
  const home = i % 2 === 0;
  const seed = 7 + i * 7919 + entry * 104729;
  const rng = mulberry32(seed);
  const end = 90 + rollAddedTime(mulberry32(addedTimeSeed(seed)));
  let on = false, got = 0;
  const inputs = (): HiddenMatchInputs => ({
    teamStrength: 83, oppStrength: home ? 77 : 84, playerSkill: 99, pace: 99, freeKick: 99, position: "ST",
    energy: fitness, energyMode: "medium", impactSub: true, home,
    fergie: { from: 90, to: end },
    lateSub: on ? { enteredAt: entry, owed: Math.max(0, lateSubQuota(entry) - got), fitness } : undefined,
  } as HiddenMatchInputs);
  const st = newMatch(rng);
  advanceTo(st, inputs(), rng, entry);
  on = true;
  for (;;) {
    const step = advanceUntilInvolved(st, inputs(), rng, end);
    if (!step.request) break;
    got++;
    resolveScenario(st, rng() < 0.5 ? "goal" : "saved");
  }
  return got;
}

// ── 24: the guarantee and the squeeze ──
{
  check(lateSubQuota(69) === 0 && lateSubQuota(LATE_SUB_GUARANTEE_FROM) === 1 && lateSubQuota(88) === 1,
    "one chance guaranteed from 70', none promised before");
  const N = 400;
  const avg: Record<number, number> = {};
  for (const e of [60, 70, 75, 80, 85, 88]) {
    let sum = 0, zero = 0;
    for (let i = 0; i < N; i++) { const c = cameo(e, i); sum += c; if (c === 0) zero++; }
    avg[e] = sum / N;
    if (e >= 70) check(zero === 0, `on at ${e}': never no chance at all (${zero} of ${N} had none)`);
  }
  // Measured 27 Sep 2026: 60' 3.3, 70' 3.0, 75' 2.7, 80' 2.1, 85' 1.7, 88' 1.4.
  check(avg[80] >= 1.8 && avg[80] <= 2.6, `on at 80' still about two chances (${avg[80].toFixed(2)})`);
  check(avg[70] > avg[80] && avg[80] > avg[88], `coming on earlier always gives more chances (70' ${avg[70].toFixed(2)}, 80' ${avg[80].toFixed(2)}, 88' ${avg[88].toFixed(2)})`);
  check(avg[88] / 2 > avg[60] / 30, "but the later you come on, the more chances a minute");
  // Fitness: a tired sub squeezes in less than a fresh one — never more.
  check(lateSubInvolvement({ enteredAt: 80, owed: 0, fitness: 30 }) < lateSubInvolvement({ enteredAt: 80, owed: 0, fitness: 100 }),
    "a tired sub is found less often than a fresh one");
  check(lateSubExtra({ enteredAt: 55, owed: 0 }) === 0, "no squeeze for a sub on at 55' or earlier");
}

// ── 24: the ladder ──
{
  check(subLadderMinute(34) === 80 && subLadderMinute(54) === 50, "the ladder runs 80' at the bottom of the bench band to 50' at the top");
  check(subComesOnNow(80, 0, 0, 80) && !subComesOnNow(79, 0, 0, 80), "a sub on the 80' rung comes on at 80'");
  check(subComesOnNow(70, -2, 0, 80), "two down, he comes on ten minutes early");
}

// ── 25: a sub stays on until his energy runs out ──
{
  const hook = (energy: number, i: number, over: Partial<Parameters<typeof hookCheck>[0]> = {}) => hookCheck({
    minute: 88, startMinute: 60, liveRating: 4.5, scoreDiff: -2, rng: mulberry32(i + 1), liveEnergy: energy, cameo: true, ...over,
  });
  const offAt = (energy: number) => Array.from({ length: 400 }, (_, i) => hook(energy, i).hooked).filter(Boolean).length;
  check(offAt(60) === 0 && offAt(SUB_TIRED_FROM) === 0, "a bad afternoon never takes a sub off while he has energy left");
  check(offAt(5) > 0 && offAt(5) < 400, `under ${SUB_TIRED_FROM}% it starts to be a chance (${offAt(5)} of 400 at 5%)`);
  check(offAt(1) > offAt(8), "…rising as he nears empty");
  check(offAt(SUB_OFF_ENERGY) === 400, `at ${SUB_OFF_ENERGY}% he is always off`);
  check(hook(0, 1).reason === "legs", "and the reason is his legs");
}

if (problems.length) {
  console.error(`lateSubs: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("lateSubs: all checks passed");
