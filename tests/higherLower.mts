import assert from "node:assert/strict";
import { dealCards, rightCall, ROUNDS } from "../components/draft/HigherLower";
const sq = Array.from({ length: 11 }, (_, i) => ({ name: "p" + i, overall: 70 + i } as never));
const c = dealCards(sq, () => 0.3);
assert.equal(c.length, ROUNDS + 1); assert.equal(new Set(c.map((x: { name: string }) => x.name)).size, ROUNDS + 1);
assert.equal(rightCall(80, 85, "higher"), true); assert.equal(rightCall(80, 75, "higher"), false);
assert.equal(rightCall(80, 80, "lower"), true, "a tie counts as right");
// Odds with sensible play (call towards the middle), random squads of 70–90:
let wins = 0; const N = 20000;
for (let k = 0; k < N; k++) {
  const squad = Array.from({ length: 14 }, (_, i) => ({ name: "q" + i, overall: 70 + Math.floor(Math.random() * 21) } as never));
  const d = dealCards(squad); let ok = true;
  for (let r = 0; r < ROUNDS && ok; r++) { const cur = (d[r] as { overall: number }).overall; ok = rightCall(cur, (d[r + 1] as { overall: number }).overall, cur < 80 ? "higher" : "lower"); }
  if (ok) wins++;
}
console.log("higherLower: ok · stays", Math.round((wins / N) * 100) + "% with sensible play (old coin flip 50%)");
