/**
 * B2b, points 2 and 3 (Harry, 20 Oct 2026):
 *   "All of this has to scale with level of npc's your teammates intelligence
 *    vs opposition. How easy it is to get the ball back." — and later the same
 *    day, "chance count = to build up all of that is all just highlights
 *    intelligence and should work together."
 *   "A lot of times in the moving build-ups offsides occur that aren't called.
 *    Offsides can happen but they must be called."
 *
 * Pins:
 *   1. intel.ts moves every dial the right way as the gap grows, smoothly,
 *      and is exactly the middle at even sides (and with strengths unknown).
 *   2. THE LAW, read independently of the builder's own report: in every
 *      build-up (strong v weak, even, weak v strong), at the moment each
 *      pass is played, the man it goes to is never in an offside position
 *      (their half, nearer their goal line than the ball and their
 *      second-last man, keeper included) — unless it is the pass the flag
 *      goes up for, which then ends the move: 0 uncalled.
 *   3. A called offside ends the move: the whistle and "Offside!" at the
 *      flag, nothing after it, no run-on, no hand-over.
 *   4. The regain agrees with the match: shown only when the match's request
 *      says the ball was won this minute, won inside the zone the match won
 *      it in; never shown when the match had none.
 *   5. The sides scale it together: their spell (how long they keep it) is
 *      shorter, the regain higher, the touches quicker and a run mistimed
 *      less often for the better side; a weak side's regains are scrappier.
 *   6. hiddenMatch.ts hands the regain on without a single new random draw:
 *      the chances it serves are the same with or without anyone reading it.
 */
import { fhrIntel, sideGap } from "../../lib/star/fhr/intel";
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import { forceChancesMode } from "../../lib/star/newChances";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { fhrBuildUpFor, fhrWantsBuildUp, REGAIN_BAND, type FhrBuildUp } from "../../lib/star/fhr/buildUp";
import { goalInView } from "../../lib/star/canvasEngine";
import { HALF_LEN } from "../../lib/star/pitch";
import type { HiddenMatchInputs } from "../../lib/star/hiddenMatch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// 1.
{
  const a = fhrIntel(85, 65), e = fhrIntel(75, 75), w = fhrIntel(65, 85), u = fhrIntel(undefined, 70);
  check(sideGap(85, 65) === 1 && sideGap(75, 75) === 0 && sideGap(65, 85) === -1 && sideGap(80, 70) === 0.5, "the gap is not (us − them) / 20, held to ±1");
  check(!u.known && u.gap === 0, "unknown strengths are not the even middle");
  check(e.touch === 1 && e.pressOnUs === 1 && e.tiers.mid === 1, "even sides moved the passing or the press");
  check(a.touch < e.touch && e.touch < w.touch, "the better side is not quicker on the ball");
  check(a.oppSpellS[0] < e.oppSpellS[0] && e.oppSpellS[0] < w.oppSpellS[0] && a.oppSpellS[1] < w.oppSpellS[1], "the better side does not win it back quicker");
  check(a.regainHigh > e.regainHigh && e.regainHigh > w.regainHigh, "the better side does not win it higher up");
  check(a.scrappy < e.scrappy && e.scrappy < w.scrappy, "the weaker side's regains are not scrappier");
  check(a.mistime < e.mistime && e.mistime < w.mistime, "the better side's runs are not timed better");
  check(a.pressOnUs > e.pressOnUs && e.pressOnUs > w.pressOnUs && a.squeeze < w.squeeze, "a better opposition does not press tighter");
  // Smooth: a point of strength never jumps a dial.
  for (let d = -25; d < 25; d++) {
    const p = fhrIntel(70 + d, 70), q = fhrIntel(70 + d + 1, 70);
    check(Math.abs(q.mistime - p.mistime) < 0.02 && Math.abs(q.touch - p.touch) < 0.01 && Math.abs(q.oppSpellS[0] - p.oppSpellS[0]) < 0.05, `a jump in the dials between ${70 + d} and ${71 + d}`);
  }
}

// 2–5. The build-ups, by how the sides compare.
const inputsFor = (us: number, them: number): HiddenMatchInputs => ({ teamStrength: us, oppStrength: them, playerSkill: 60, position: "ST", matchFlow: true, context: {}, livePenalties: true });
forceFhrMode("on"); forceChancesMode("new");
const table: Record<string, { n: number; called: number; regain: number; had: number; spell: number; height: number; scrappy: number; onBall: number; onBallN: number; uncalled: number; passes: number }> = {};
for (const [us, them] of [[85, 65], [75, 75], [65, 85]] as const) {
  const key = `${us} v ${them}`;
  const row = (table[key] = { n: 0, called: 0, regain: 0, had: 0, spell: 0, height: 0, scrappy: 0, onBall: 0, onBallN: 0, uncalled: 0, passes: 0 });
  for (const c of servedChances({ count: 420, seed: 77, inputs: inputsFor(us, them) })) {
    if (!fhrWantsBuildUp(c.sc.kind, c.moment)) continue;
    const before = JSON.stringify(c.sc);
    const b = fhrBuildUpFor(c.sc, c.moment) as FhrBuildUp;
    check(JSON.stringify(c.sc) === before, `${key} ${c.sc.kind}: the build-up changed the chance`);
    row.n++;
    row.passes += b.acts.filter((a) => a.type === "pass").length;
    for (let k = 1; k < b.acts.length; k++) { row.onBall += b.acts[k].t0 - b.acts[k - 1].t1; row.onBallN++; }
    // 2. The law, read from the build-up's own positions (posAt), nobody else's report.
    if (goalInView(c.sc.kind)) {
      const opps = b.people.filter((p) => p.side === "opp" || p.side === "keeper" || p.side === "oppx").map((p) => p.key);
      b.acts.forEach((a, k) => {
        if (a.type !== "pass") return;
        const by = k + 1 < b.acts.length ? b.actOwners[k + 1] : b.offside?.pass === k ? b.offside.by : "you";
        const p = b.posAt(by, a.t0);
        if (!p) return;
        const ys = opps.map((o) => b.posAt(o, a.t0)!.y).sort((x, y) => x - y);
        const off = p.y < HALF_LEN - 0.05 && p.y < a.from.y - 0.05 && p.y < ys[1] - 0.05;
        const isCalled = b.offside?.pass === k;
        if (off && !isCalled) { row.uncalled++; check(false, `${key} ${c.sc.kind}: ${by} offside at touch ${k + 1}, not called`); }
        if (isCalled) check(off, `${key} ${c.sc.kind}: the flag went up for ${by}, who was onside`);
      });
    }
    // 3. A called offside ends the move.
    if (b.offside) {
      row.called++;
      const last = b.acts[b.acts.length - 1];
      check(b.offside.pass === b.acts.length - 1 && last.type === "pass", `${key}: touches after the flag`);
      check(b.whistleAt === b.offside.at && b.offside.at > last.t1 && b.durS > b.offside.at, `${key}: no whistle when the flag goes up`);
      check(b.captionAt?.(b.offside.at + 0.05) === "Offside!", `${key}: the flag is not called "Offside!"`);
      check(!b.runOnKeys?.length, `${key}: a called offside hands over to a chance`);
    }
    // 4. The regain agrees with the match.
    const had = !!c.moment.regain && c.moment.regain.ago === 0;
    if (had) row.had++;
    if (b.regain) {
      row.regain++;
      check(had, `${key} ${c.sc.kind}: a regain the match did not have`);
      const band = REGAIN_BAND[c.moment.regain!.zone];
      check(b.regain.heightM >= band.y1 - 4 && b.regain.heightM <= band.y2 + 4, `${key}: won at ${b.regain.heightM.toFixed(1)} m, not in the match's ${c.moment.regain!.zone} (${band.y1}–${band.y2} m)`);
      check(b.regain.at > 0.3 && b.regain.at <= b.regain.spellS + 1e-9, `${key}: the regain is not after their spell`);
      row.spell += b.regain.spellS; row.height += b.regain.heightM; if (b.regain.scrappy) row.scrappy++;
    }
  }
  check(row.n > 60, `${key}: only ${row.n} build-ups`);
  check(row.uncalled === 0, `${key}: ${row.uncalled} offsides not called`);
  check(row.regain >= row.had * 0.85, `${key}: the regain shown in only ${row.regain} of ${row.had} build-ups the match had one`);
}
const T = Object.fromEntries(Object.entries(table).map(([k, r]) => [k, {
  buildUps: r.n, calledPct: +((100 * r.called) / r.n).toFixed(1), regainPct: +((100 * r.regain) / r.n).toFixed(1),
  spellS: +(r.spell / Math.max(1, r.regain)).toFixed(2), regainHeightM: +(r.height / Math.max(1, r.regain)).toFixed(1),
  scrappyPct: +((100 * r.scrappy) / Math.max(1, r.regain)).toFixed(1), onBallS: +(r.onBall / Math.max(1, r.onBallN)).toFixed(2), passes: +(r.passes / r.n).toFixed(2),
}]));
// 5. Together, by the gap.
const S = T["85 v 65"], E = T["75 v 75"], W = T["65 v 85"];
check(S.spellS < E.spellS && E.spellS < W.spellS, `their spell: ${S.spellS} / ${E.spellS} / ${W.spellS} s`);
check(S.regainHeightM < W.regainHeightM, `the regain is not higher up for the better side: ${S.regainHeightM} vs ${W.regainHeightM} m from their goal`);
check(S.onBallS < E.onBallS && E.onBallS < W.onBallS, `time on the ball: ${S.onBallS} / ${E.onBallS} / ${W.onBallS} s`);
check(S.scrappyPct < W.scrappyPct, `scrappy regains: ${S.scrappyPct}% / ${W.scrappyPct}%`);
check(W.calledPct > S.calledPct, `called offsides a build-up: ${S.calledPct}% / ${E.calledPct}% / ${W.calledPct}%`);
forceFhrMode(null); forceChancesMode(null);

// 6. The regain is handed on without a new random draw: same chances either way.
{
  const a = servedChances({ count: 120, seed: 5 }).map((c) => `${c.sc.kind}@${c.sc.ball.x.toFixed(2)},${c.sc.ball.y.toFixed(2)}:${c.minute}`).join("|");
  const b = servedChances({ count: 120, seed: 5 }).map((c) => `${c.sc.kind}@${c.sc.ball.x.toFixed(2)},${c.sc.ball.y.toFixed(2)}:${c.minute}`).join("|");
  check(a === b, "the match does not serve the same chances twice running");
  check(servedChances({ count: 60, seed: 5 }).every((c) => !c.moment.regain || (c.moment.regain.ago >= 0 && !!REGAIN_BAND[c.moment.regain.zone])), "a regain without a zone or a time");
}

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.log("  " + p);
  console.log("  table:", JSON.stringify(T));
  process.exit(1);
}
console.log("fhrIntel: the dials move the right way with the gap, smoothly; 0 offsides left uncalled (read independently from the positions); a called offside ends the move; the regain is the match's own and in its zone; the better side wins it back quicker and higher, is quicker on the ball and is caught offside less — all checks pass");
for (const [k, r] of Object.entries(T)) console.log(`  ${k}: ${JSON.stringify(r)}`);
