import { nightPlan, beatAt, podiumHeightAt, finalistXAt, callingAt, placeWord, podiumX, PODIUM } from "../../lib/star/ballonDorNight";
import type { BallonDorEntry } from "../../lib/star/ballonDor";

/**
 * THE BALLON D'OR NIGHT'S PLAN (lib/star/ballonDorNight.ts): the full night
 * when you are in the top three, the short one when you are not; the winner
 * not given away by the podiums; every beat in order and in time.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const entry = (rank: number, isPlayer = false): BallonDorEntry => ({
  rank, isPlayer, name: isPlayer ? "You" : `Rival ${rank}`, club: "Arsenal", goals: 30 - rank, assists: 10,
  rating: 7.5, ratingIsReal: isPlayer, trophies: [], score: 500 - rank,
});
const list = (you: number) => Array.from({ length: 10 }, (_, i) => entry(i + 1, i + 1 === you));

for (const you of [0, 1, 2, 3, 4, 9]) {
  for (let seed = 1; seed <= 40; seed++) {
    const p = nightPlan(list(you), you, seed);
    const tag = `you ${you}, seed ${seed}`;
    check(p.kind === (you >= 1 && you <= 3 ? "full" : "short"), `${tag}: wrong kind ${p.kind}`);
    check(p.finalists.length === 3, `${tag}: ${p.finalists.length} finalists`);
    check(p.finalists.map((f) => f.rank).join() === "1,2,3", `${tag}: ranks out of order`);
    check(new Set(p.finalists.map((f) => f.slot)).size === 3, `${tag}: two on one podium`);
    // In order, and the whole night is 13-24 s.
    check(p.hostFrom < p.callAt && p.callAt < p.pauseAt && p.pauseAt < p.revealAt && p.revealAt <= p.yourPlaceAt && p.yourPlaceAt < p.end, `${tag}: beats out of order`);
    check(p.end >= 13 && p.end <= 24, `${tag}: night lasts ${p.end.toFixed(1)} s`);
    for (const f of p.finalists) check(f.walkTo <= p.callAt, `${tag}: ${f.entry.name} still walking at the call`);
    // Nobody's podium gives the winner away before the reveal.
    const before = p.finalists.map((f) => podiumHeightAt(p, f.rank, p.revealAt - 0.01));
    check(before.every((h) => Math.abs(h - PODIUM.even) < 1e-9), `${tag}: podiums differ before the reveal`);
    const after = p.finalists.map((f) => podiumHeightAt(p, f.rank, p.end));
    check(after[0] > after[1] && after[1] > after[2], `${tag}: 1st/2nd/3rd not in height order after the reveal`);
    // Everyone ends on his own podium.
    for (const f of p.finalists) {
      const at = finalistXAt(f, p.callAt);
      check(at.on && Math.abs(at.x - podiumX(f.slot)) < 1e-9, `${tag}: ${f.entry.name} not on his podium at the call`);
    }
    check(beatAt(p, 0) === "room" && beatAt(p, p.revealAt + 0.01) === "reveal" && beatAt(p, p.end) === "done", `${tag}: beats wrong`);
    if (you > 1) check(beatAt(p, p.yourPlaceAt + 0.01) === "yours", `${tag}: your place never said`);
    if (p.kind === "short") check(callingAt(p, 4) === null, `${tag}: short night calls names one by one`);
  }
}
// The winner is in the middle only about a third of the time.
let middle = 0;
for (let seed = 1; seed <= 300; seed++) if (nightPlan(list(2), 2, seed).finalists[0].slot === 0) middle++;
check(middle > 60 && middle < 140, `winner in the middle ${middle} of 300 nights`);
// The full night calls each of the three by name as he walks on.
const full = nightPlan(list(2), 2, 7);
const called = new Set<string>();
for (let t = 0; t < full.callAt; t += 0.1) { const c = callingAt(full, t); if (c) called.add(c.entry.name); }
check(called.size === 3, `full night called ${called.size} names`);
check(placeWord(1) === "1st" && placeWord(2) === "2nd" && placeWord(3) === "3rd" && placeWord(4) === "4th" && placeWord(11) === "11th", "placeWord");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 25)) console.log(`  ✗ ${p}`);
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
  process.exit(1);
}
const short = nightPlan(list(6), 6, 7);
console.log(`PASS — full night ${full.end.toFixed(1)} s (you 2nd), short night ${short.end.toFixed(1)} s; winner in the middle ${middle}/300; podiums even until the reveal`);
