/**
 * Chips and shots at his body: a report (not a test). KEEPER=old for Old.
 *   npx tsx tests/star/keeperPro/chips.mts
 */
import { shoot, saveRate, pctS } from "./harness.mts";

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};
if (process.env.KEEPER === "old") store.set("star-gameplay-keeperPro", "old");
const N = Number(process.env.N ?? 400);
const chips = [], body = [];
for (const kind of ["one_on_one", "through_ball"] as const) for (let s = 1; s <= N; s++) {
  chips.push(shoot(kind, s * 3301 + 9, 80, { aim: "any", power: [0.3, 0.55], cy: [0.75, 1.0] }));
  body.push(shoot(kind, s * 3301 + 9, 80, { aim: "body", power: [0.8, 0.95], cy: [-1, -0.6] }));
}
const ch1 = chips.filter((r) => r.kind === "one_on_one");
console.log(`chips, one-on-ones: scored ${pctS(ch1.filter((r) => r.goal).length, ch1.length)}, on target ${pctS(ch1.filter((r) => r.onTarget).length, ch1.length)}; keeper off his line median ${ch1.map((r) => r.keeperY).sort((a, b) => a - b)[ch1.length >> 1].toFixed(1)} m`);
const adv = chips.filter((r) => r.keeperY > 3);
console.log(`chips, keeper > 3 m out: scored ${pctS(adv.filter((r) => r.goal).length, adv.length)}`);
const low = body.filter((r) => r.onTarget);
console.log(`driven low at his body: saved ${pctS(Math.round(saveRate(low).rate * low.length), low.length)}; through him (nutmeg/under) ${pctS(low.filter((r) => r.goal && r.save === null).length, low.length)}`);
