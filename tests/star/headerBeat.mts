/**
 * A HEADER THAT LOOKS LIKE A HEADER (lib/star/headerBeat.ts; Harry, 25 Oct
 * 2026: "that header animation and function does not work at all in those
 * videos").
 *
 * Pins:
 *   1. the cross never stops dead: crossDrawT is the build-up's own clock up
 *      to its last CROSS_TAIL_S, then slows from full speed (no jump, no
 *      kink), keeps moving while you aim, and never reaches the spot;
 *   2. a cross drawn with no build-up (the drill) starts at the crosser and
 *      ends on the chance's ball, at the chance's height;
 *   3. your header: he is under the ball and at the top of his jump when the
 *      ball leaves (e = rise); a late one meets it lower, earlier in the jump;
 *      the ball sits on his head at contact and settles back after;
 *   4. the jump always reads (at least MIN_JUMP of his height) and puts his
 *      head on a ball above it;
 *   5. CanvasMatch draws it: the build-up's ball through crossDrawT, your man
 *      through headerBeat with the header animation, and the late touch is
 *      marked; and none of it touches the struck ball (drawing only).
 */
import { readFileSync } from "node:fs";
import {
  tailLeft, crossDrawT, syntheticCross, headerBeat, headerLiftPx, headerBallLiftK,
  CROSS_TAIL_S, HEADER_RISE_S, HEADER_LATE_AT, MIN_JUMP, HEAD_AT, BALL_SETTLE_S,
} from "../../lib/star/headerBeat";
import { HEADER_S } from "../../lib/star/actionAnim";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

// 1.
const dur = 2;
check(near(crossDrawT(1, dur), 1) && near(crossDrawT(dur - CROSS_TAIL_S, dur), dur - CROSS_TAIL_S), "before its tail the cross is on the build-up's own clock");
const h = 1e-4, from = dur - CROSS_TAIL_S;
check(near((crossDrawT(from + h, dur) - crossDrawT(from, dur)) / h, 1, 1e-3), "the cross does not slow with a kink: full speed as the tail starts");
let prev = -1, prevSpeed = 2;
for (let t = from; t < dur + 10; t += 0.05) {
  const w = crossDrawT(t, dur);
  check(w > prev && w < dur, `the cross stops or reaches the spot at t = ${t.toFixed(2)} (drawn ${w})`);
  const sp = (crossDrawT(t + 0.01, dur) - w) / 0.01;
  check(sp <= prevSpeed + 1e-9, `the cross speeds up again at t = ${t.toFixed(2)}`);
  prev = w; prevSpeed = sp;
}
check(dur - crossDrawT(dur + 1, dur) > 0.05 * CROSS_TAIL_S, "a second into the aim the cross has already arrived (it must still be coming in)");
check(near(tailLeft(0), CROSS_TAIL_S), "tailLeft(0) is the whole tail");

// 2.
const sc = { kind: "header", ball: { x: 30, y: 10 }, teammates: [{ x: 60, y: 8 }] };
const path = syntheticCross(sc);
check(!!path, "a header with a crosser gets a drawn cross");
if (path) {
  const a = path.at(0), b = path.at(path.durS);
  check(near(a.x, 60) && near(a.y, 8), "the drawn cross starts at the crosser");
  check(near(b.x, 30) && near(b.y, 10) && near(b.z, 1.85, 1e-6), `the drawn cross ends on the chance's ball at its height (${b.z})`);
  check(path.at(path.durS / 2).z > 3, "the drawn cross arcs above head height");
}
check(syntheticCross({ kind: "header", ball: { x: 30, y: 10 }, teammates: [] }) === null, "a header with no crosser has no drawn cross");

// 3.
const at = headerBeat(HEADER_RISE_S);
check(near(at.animE, HEADER_S / 2) && near(at.up, 1) && near(at.moveU, 1) && near(at.ballU, 1), "at the strike he is under the ball, at the top of his jump, the ball on his head");
const start = headerBeat(0);
check(start.moveU === 0 && start.ballU === 0 && start.up > 0, "as he starts he is where he stood, already going up");
const late = headerBeat(HEADER_RISE_S, HEADER_RISE_S, true);
check(near(late.animE, HEADER_LATE_AT * HEADER_S) && late.up < 0.9, `a late header meets it lower (${late.up.toFixed(2)} of the jump)`);
check(headerBeat(HEADER_RISE_S + HEADER_S).animE >= HEADER_S, "the jump ends");
check(near(headerBallLiftK(HEADER_RISE_S), 1) && headerBallLiftK(HEADER_RISE_S + BALL_SETTLE_S) === 0 && headerBallLiftK(0) === 0, "the ball rises onto his head, sits there at contact and settles back");

// 4.
for (const fig of [20, 40]) {
  for (const ball of [0, 10, 30, 60, 200]) {
    const l = headerLiftPx(ball, fig);
    check(l >= MIN_JUMP * fig - 1e-9 && l <= 1.6 * fig + 1e-9, `jump ${l} px out of range for a ${fig} px man`);
    if (ball > (HEAD_AT + MIN_JUMP) * fig && ball < (HEAD_AT + 1.6) * fig) check(near(l + HEAD_AT * fig, ball), `his head misses a ball ${ball} px up`);
  }
}

// 5.
const cm = readFileSync(new URL("../../components/star/CanvasMatch.tsx", import.meta.url), "utf8");
check(/ballAt\(sc\.kind === "header" \? crossDrawT\(L\.t, L\.lead\.durS\) : L\.t\)/.test(cm), "the build-up's ball is no longer drawn through crossDrawT for a header");
check(/crossAt = crossBallNow\(sc\)/.test(cm), "the aim no longer draws the cross still coming in");
check(/headerBeat\(hb\.e, hb\.rise, hb\.late\)/.test(cm) && /mode: "header"/.test(cm), "your man is no longer drawn through headerBeat with the header animation");
check(/late: tapped\.late === true/.test(cm), "a late touch is no longer marked for the drawing");
check(/Math\.max\(f\.windUpS, HEADER_RISE_S\)/.test(cm), "the strike is no longer held while you rise to the ball");
const strikeBlock = cm.slice(cm.indexOf("headerBeatRef.current = null;"), cm.indexOf("headerBeatRef.current = null;") + 900);
check(!/ballRef\.current\.(pos|vel|z|vz)\s*=/.test(strikeBlock) && !/bl\.(pos|vel|z|vz)\s*=/.test(strikeBlock), "the header's drawing writes to the struck ball");

if (problems.length) {
  console.log(`headerBeat FAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.log("  " + p);
  process.exit(1);
}
console.log(`headerBeat: the cross slows from full speed and never stops (tail ${CROSS_TAIL_S} s); you rise for ${HEADER_RISE_S} s and meet it at the top of the jump (late: ${HEADER_LATE_AT} of it); the jump is at least ${MIN_JUMP} of your height — all checks pass`);
