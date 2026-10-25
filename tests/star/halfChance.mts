/**
 * AT LEAST ONE CHANCE A HALF (Mikey, 25 Oct 2026): "you should be guaranteed
 * minimum one chance per half … in regular time … if you are playing on
 * medium energy or above". Plays many seeded matches through the hidden match
 * and counts your chances in each half.
 */
import { newMatch, advanceUntilInvolved, resolveScenario, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import { mulberry32 } from "../../lib/star/season";

let fails = 0;
const check = (ok: boolean, what: string) => { if (!ok) { fails++; console.log("  ✗", what); } else console.log("  ✓", what); };

// A weak side away at a strong one: the case where a half can go by without the ball.
const base: HiddenMatchInputs = { teamStrength: 45, oppStrength: 85, playerSkill: 45, home: false } as HiddenMatchInputs;

function play(seed: number, inputs: HiddenMatchInputs, fullTime = 90): [number, number] {
  const rng = mulberry32(seed);
  const state = newMatch(rng);
  const per: [number, number] = [0, 0];
  while (state.minute < fullTime) {
    const step = advanceUntilInvolved(state, inputs, rng, fullTime);
    if (step.fullTime) break;
    per[state.minute < 45 ? 0 : 1] += state.minute < 90 ? 1 : 0;
    resolveScenario(state, "saved");
  }
  return per;
}

for (const mode of ["medium", "high"] as const) {
  let emptyHalves = 0, n = 0, total = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const [a, b] = play(seed, { ...base, energyMode: mode });
    n++; total += a + b;
    if (a === 0) emptyHalves++;
    if (b === 0) emptyHalves++;
  }
  check(emptyHalves === 0, `${mode}: no half of normal time without a chance (${emptyHalves} of ${n * 2} halves empty; ${(total / n).toFixed(1)} chances a match)`);
}
{
  let emptyHalves = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const [a, b] = play(seed, { ...base, energyMode: "low" });
    if (a === 0) emptyHalves++;
    if (b === 0) emptyHalves++;
  }
  check(true, `low: no guarantee (${emptyHalves} of 600 halves empty, as before)`);
}
if (fails) { console.log(`FAIL (${fails})`); process.exit(1); }
console.log("PASS — at least one chance in each half of normal time on Medium and High");
