import { openEuroBracket, advanceEuroBracket, euroTieFromBracket, settleYourKoTie, koAggregate } from "../../lib/star/euroBracket";
import { simulate } from "../../lib/star/euro";
import { mulberry32 } from "../../lib/star/season";
import type { EuroTie } from "../../lib/star/euro";

/**
 * THE REAL UEFA KNOCKOUT (lib/star/euroBracket.ts).
 *
 * 1st–8th to the round of 16, 9th–24th into the play-off (9/10 v 23/24,
 * 11/12 v 21/22, 13/14 v 19/20, 15/16 v 17/18), 1/2 v the 15–18 winners,
 * 3/4 v 13/14–19/20, 5/6 v 11/12–21/22, 7/8 v 9/10–23/24, then fixed:
 * 1/2 meets 7/8, 3/4 meets 5/6, 1 and 2 in different halves.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const table = Array.from({ length: 36 }, (_, i) => `C${i + 1}`);
const pos = (c: string) => Number(c.slice(1));
const str = (c: string) => 90 - pos(c) * 0.6;

for (let seed = 1; seed <= 200; seed++) {
  const rng = mulberry32(seed);
  const br = openEuroBracket(table, rng);
  const po = br.rounds[0].ties;
  check(po.length === 8 && br.seeds.length === 8, "8 play-off ties, 8 seeds");
  const bandOK = po.every(t => {
    const hi = pos(t.a!), lo = pos(t.b!);
    const k = Math.floor((hi - 9) / 2);
    return hi >= 9 && hi <= 16 && [23 - 2 * k, 24 - 2 * k].includes(lo);
  });
  check(bandOK, `play-off bands right (seed ${seed}): ${po.map(t => `${t.a}v${t.b}`).join(" ")}`);
  check(new Set(br.seeds).size === 8 && br.seeds.every(s => pos(s) <= 8), "seeds are 1st-8th once each");
  // Seed j meets play-off tie j: 1/2 v 15-18, 3/4 v 13/14-19/20, 5/6 v 11/12-21/22, 7/8 v 9/10-23/24.
  const want: Record<number, number[]> = { 1: [15, 16], 2: [15, 16], 3: [13, 14], 4: [13, 14], 5: [11, 12], 6: [11, 12], 7: [9, 10], 8: [9, 10] };
  check(br.seeds.every((s, j) => want[pos(s)].includes(pos(po[j].a!))), "each seed waits for the right play-off tie");
  const halves = [br.seeds.slice(0, 4), br.seeds.slice(4)];
  check(halves.every(h => h.filter(s => pos(s) <= 2).length === 1), "1 and 2 in different halves");
  check(halves.every(h => pos(h[0]) <= 2 && pos(h[1]) >= 7 && pos(h[2]) >= 3 && pos(h[2]) <= 4), "1/2 meets 7/8, 3/4 meets 5/6");

  // Nobody in it: plays out to a winner.
  const done = advanceEuroBracket(br, "nobody", str, simulate, rng);
  check(!!done.winner, "plays to a winner");
  for (const r of done.rounds) for (const t of r.ties) {
    check(!!t.winner && !!t.a && !!t.b, `${r.name}: every tie played`);
    if (!t.winner) continue;
    check(pos(t.a!) < pos(t.b!), `${r.name}: a is the better finisher`);
    if (r.name !== "Final") check(t.legs.length === 2 && !t.legs[0].aHome && t.legs[1].aHome, `${r.name}: two legs, the better finisher home second`);
    else check(t.legs.length === 1, "the final is one match");
    const agg = koAggregate(t)!;
    if (agg.a !== agg.b) check(t.winner === (agg.a > agg.b ? t.a : t.b) && !t.pens, `${r.name}: aggregate decides`);
    else check(!!t.pens && !!t.et, `${r.name}: level after extra time goes to penalties`);
  }
}

// ── You, 12th: your play-off tie waits; the rest are played ─────────────────
{
  const rng = mulberry32(7);
  const you = "C12";
  const br = advanceEuroBracket(openEuroBracket(table, rng), you, str, simulate, rng);
  const mine = br.rounds[0].ties.find(t => t.a === you || t.b === you)!;
  check(!mine.winner, "your play-off tie is not played for you");
  check(br.rounds[0].ties.filter(t => t !== mine).every(t => !!t.winner), "the other seven are played");
  check(!br.winner, "no winner while you are still in");
  const et = euroTieFromBracket(br, you, str)!;
  check(et.round === "Round of 32" && pos(et.opponent) >= 19 && pos(et.opponent) <= 22, `12th plays 19th-22nd (${et.opponent})`);
  check(!et.legs[0].home && et.legs[1].home, "the better finisher (you) at home in the second leg");

  // Win it 3-1 on aggregate.
  const won: EuroTie = { ...et, legs: [{ ...et.legs[0], us: 1, them: 1 }, { ...et.legs[1], us: 2, them: 0 }], result: "W" };
  const br2 = settleYourKoTie(br, you, won, str, simulate, rng);
  const r16 = br2.rounds[1].ties.find(t => t.a === you || t.b === you)!;
  check(!!r16 && pos(r16.a!) >= 5 && pos(r16.a!) <= 6, `12th's winner meets 5th or 6th (${r16?.a})`);
  const next = euroTieFromBracket(br2, you, str)!;
  check(next.round === "Round of 16" && next.legs[0].home && !next.legs[1].home, "round of 16: the seed at home second");

  // Lose that: the bracket plays out to a winner.
  const lost: EuroTie = { ...next, legs: [{ ...next.legs[0], us: 0, them: 1 }, { ...next.legs[1], us: 0, them: 2 }], result: "L" };
  const br3 = settleYourKoTie(br2, you, lost, str, simulate, rng);
  check(!!br3.winner && br3.winner !== you, "out: someone else wins it");
  check(br3.rounds.every(r => r.ties.every(t => !!t.winner)), "out: every tie played");
}

if (problems.length) {
  console.error(`euroBracket: ${problems.length} problem(s)`);
  for (const p of [...new Set(problems)].slice(0, 20)) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("euroBracket: all good");
