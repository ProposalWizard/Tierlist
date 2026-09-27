/**
 * tests/star/keeperOneDive.mts — a penalty keeper dives once (v0.15, item 3).
 *
 * Harry: "In the trial the keeper dives, then turns and goes back once the
 * ball crosses the line. He only needs one dive; if there's time left he just
 * stays where he is." Once he has committed at the strike
 * (lib/star/penaltyKeeper.ts's read), nothing sends him back the other way:
 * not the ball reaching his line, not a save he can stretch to, not a spill.
 * And a ball that goes BEHIND his dive (the side he threw himself away from,
 * clear of his body) beats him — before this it was still "saved" by a keeper
 * who never came back for it, and the ball stopped in mid-air beside him.
 *
 * This is the engine's one-dive hook, `Keeper.committedDir` (shared with the
 * keeper brain's open-play dive), driven the plain way: the penalty rule
 * set's read applied at the strike (applyPenaltyRead). The match throws the
 * same decision through the keeper brain — tests/star/keeperBrain.mts checks
 * that path never turns round either. Measured with the same per-substep
 * loop at 180 Hz, then 0.8 s more of the keeper (the match
 * keeps stepping him through the result). A TURN is: travelling one way
 * faster than 0.5 m/s, then the other way faster than 0.5 m/s, within 2 s of
 * the strike.
 *
 * Run: npx tsx tests/star/keeperOneDive.mts
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions,
  type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { penaltyReadFor, decidePenaltyRead, applyPenaltyRead, type PenaltyReadSettings } from "../../lib/star/penaltyKeeper";
import { CX } from "../../lib/star/pitch";
import { enforcePenalty } from "../../lib/star/kindRules/penalty";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

type Zone = "middle" | "corner" | "2m" | "placed";
function kickFor(zone: Zone, rng: () => number) {
  const side = rng() < 0.5 ? -1 : 1, p = 0.6 + rng() * 0.3, cy = -1 + rng() * 1.25;
  const off = zone === "middle" ? (rng() - 0.5) * 0.8
    : zone === "corner" ? side * (2.9 + rng() * 0.65)
    : zone === "2m" ? side * (1.6 + rng() * 0.8)
    : side * (1.4 + 2.15 * Math.sqrt(rng()));
  return { off, power: p, cy };
}

function penalty(seed: number, zone: Zone, read: PenaltyReadSettings, ks: number, oneDive: boolean, kicker: number) {
  const kick = kickFor(zone, mulberry32((seed ^ 0xa11ce) >>> 0));
  const rng = mulberry32(seed);
  const sc: Scenario = buildScenario("penalty", rng, ks, 60, 55);
  enforcePenalty(sc); // Harry's penalty rules: keeper centred on his line, everyone else on the box edge
  initDefenders(sc, rng);
  const dx = CX + kick.off - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
  const ball = launch(sc, { x: dx / L, y: dy / L }, kick.power, { cx: 0, cy: kick.cy }, { power: kicker, technique: kicker }, rng);
  const r = mulberry32((seed ^ 0x5eed) >>> 0);
  const d = decidePenaltyRead(sc, ball, read, [r(), r()]);
  applyPenaltyRead(sc, d);
  const committed = sc.keeper.committedDir !== undefined;
  if (!oneDive) sc.keeper.committedDir = undefined; // the keeper before v0.15, who turned back
  const h = 1 / 180;
  let res: string | null = null, t = 0, prevX = sc.keeper.x, lastDir = 0, turned = false, behind = false;
  const track = () => {
    const vx = (sc.keeper.x - prevX) / h; prevX = sc.keeper.x;
    if (t > 2) return;
    // A team-mate's follow-up is a NEW shot, which he is right to go for —
    // not a turn on his dive. (v0.15 A2, item 17: the nearest team-mate now
    // chases a loose ball, so a penalty off the bar can be followed in and
    // shot again inside the 2 s window — measured once in 800 kicks here.)
    if ((sc.receiverShots ?? 0) > 0 || sc.follower.shot) { lastDir = 0; return; }
    const dir = vx > 0.5 ? 1 : vx < -0.5 ? -1 : 0;
    if (dir !== 0) { if (lastDir !== 0 && dir !== lastDir) turned = true; lastDir = dir; }
  };
  for (; !res && t < 8; t += h) {
    const savesBefore = sc.keeper.saves, kx = sc.keeper.x;
    stepDefenders(sc, h, ball.pos, false, ball); stepKeeper(sc, h); stepReactions(sc, ball, h, rng);
    res = stepBall(ball, sc, rng, h);
    // His first save, made with the ball clear on the far side of the way he
    // dived (more than his body's 0.75 m back from where he was).
    if (d.went && savesBefore === 0 && sc.keeper.saves > 0 && (ball.pos.x - kx) * d.side < -0.75) behind = true;
    track();
  }
  for (let k = 0; k < 0.8 / h; k++) { stepKeeper(sc, h); t += h; track(); }
  const out = (res === "goal" || res === "rebound") && !sc.follower.shot ? "scored" : sc.keeper.saves > 0 ? "saved" : "missed";
  return { out, turned, committed, behind };
}

const N = 200;
const KEEPERS: { name: string; read: PenaltyReadSettings; ks: number; kicker: number }[] = [
  // Kickers as tests/star/penaltyKeeper.mts: power/technique 60, trial 55.
  { name: "real match (keeper 62)", read: penaltyReadFor(62), ks: 62, kicker: 60 },
  { name: "trial, easiest rep", read: penaltyReadFor(45, { commitChance: 0.65, readChance: 0.55 }), ks: 45, kicker: 55 },
  { name: "trial, hardest rep", read: penaltyReadFor(90, { commitChance: 0.95, readChance: 0.72 }), ks: 90, kicker: 55 },
];
for (const K of KEEPERS) {
  console.log(`\n${K.name.toUpperCase()} — ${N} penalties per row`);
  for (const zone of ["middle", "corner", "2m", "placed"] as Zone[]) {
    let turnsOld = 0, turnsNew = 0, turnsNewCommitted = 0, sameOut = 0, scOld = 0, scNew = 0, behindOld = 0, behindNew = 0, changedNotBehind = 0;
    for (let i = 0; i < N; i++) {
      const seed = 5000 + i * 7919;
      const a = penalty(seed, zone, K.read, K.ks, false, K.kicker);
      const b = penalty(seed, zone, K.read, K.ks, true, K.kicker);
      if (a.turned) turnsOld++;
      if (b.turned) { turnsNew++; if (b.committed) turnsNewCommitted++; }
      if (a.out === b.out) sameOut++;
      else if (!a.behind) changedNotBehind++;
      if (a.out === "scored") scOld++;
      if (b.out === "scored") scNew++;
      if (a.behind) behindOld++;
      if (b.behind) behindNew++;
    }
    console.log(`  ${zone.padEnd(7)} turns round: ${turnsOld} -> ${turnsNew} | saved behind his dive: ${behindOld} -> ${behindNew} | scored ${(100 * scOld / N).toFixed(1)}% -> ${(100 * scNew / N).toFixed(1)}%`);
    ok(turnsNewCommitted === 0, `${zone}: a keeper who has committed never turns back (${turnsNewCommitted}/${N})`);
    ok(behindNew === 0, `${zone}: a keeper who has committed never saves a ball behind his dive (${behindNew}/${N})`);
    // The real match's keeper already can't stretch back once committed
    // (reach 0.3), so only the odd save behind his dive changes.
    // (v0.15 build: a committed keeper who parries it finishes his dive
    // instead of chasing the spill, which can change the odd rebound — at
    // most 1 in 100 here, measured 2 of 200.)
    if (K.ks === 62) ok(changedNotBehind <= N / 100, `${zone}: a real-match penalty only ends differently where he used to save it behind his dive, or the odd rebound (${N - sameOut} changed, ${behindOld} were behind)`);
    if (K.ks === 62 && zone === "middle") ok(turnsOld > 100, `…and the test can see a turn: the old keeper turned on ${turnsOld}/${N} middle kicks`);
    // The trial keeper can stretch the full way back (PENALTY_READ_TRIAL). Off
    // the middle he rarely needs to: the rate barely moves. Down the middle
    // his behind-the-dive saves are exactly what one dive takes away.
    if (K.ks !== 62 && zone !== "middle") ok(Math.abs(scNew - scOld) <= 4, `${zone}: the trial keeper's scoring rate barely moves off the middle (${scOld} -> ${scNew} goals; ${N - sameOut} results changed)`);
    // (Since the v0.15 build the trial keeper also READS a kick down the
    // middle and stays, at his read chance, so fewer of them dive at all:
    // measured 44 and 32 of 200 saved behind the dive, was over 50.)
    if (K.ks !== 62 && zone === "middle") ok(behindOld > 20 && scNew > scOld, `middle: the test can see it — the old trial keeper saved ${behindOld}/${N} behind his dive; scored ${scOld} -> ${scNew}`);
  }
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
