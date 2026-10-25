/**
 * THE HEADER / VOLLEY MOMENT (lib/star/airPick.ts; Harry, 25 Oct 2026: "no
 * arrow drawback, you see the chance, angle - the animation happens and then
 * you get the timer to hit the ball in the right direction").
 *
 * Pins:
 *   1. the timer is the timed screen's own formula (airStrikeTimerS); the
 *      green band at its end grows with Aerial (the perfect circle's old job)
 *      and a volley's is narrower; the numbers tuned with
 *      scripts/aerial/pick-measure.mts;
 *   2. WHEN: a tap in the band is clean (no side, the aim's height), it reads
 *      good at every Aerial; earlier is worse, step by step (round the side
 *      and under for a header, up the bounce for a volley), and a very early
 *      one reads bad; the same early tap is forgiven more with a better Aerial;
 *   3. running out = the timed screen's late touch (airLateContact): GLANCED /
 *      MISTIMED;
 *   4. WHERE: the tap across the goal is the aim, inside the posts; low/high
 *      sets the spot on the ball the old screen read;
 *   5. the clock: approach, then the timer, then done; the cross keeps coming
 *      and reaches him as the timer ends; his jump hands over to the after-tap
 *      header (headerBeat) without a jump in the picture;
 *   6. the close camera keeps both posts, the net and the ball, is tighter than the
 *      chance's, the same shape, and shows the goal line;
 *   7. CanvasMatch uses it: no drag on a header/volley, AirPick on the strike
 *      screen, the pick's aim into handleContact; the old ContactBall stays.
 */
import { readFileSync } from "node:fs";
import {
  airPickWindowS, airSweetS, airSweetBand, airTimingError, airPickStrike, airAimX, airPickAim, airAimCy,
  airPickClock, airPickHeaderAnimE, airPickCamera, airCrossSide,
  AIR_PICK_APPROACH_S, AIR_PICK_RISE_S, AIR_AIM_INSET_M,
} from "../../lib/star/airPick";
import { airStrikeTimerS, airLateContact, airContactRead } from "../../lib/star/airborneChance";
import { headerBeat } from "../../lib/star/headerBeat";
import { HEADER_S } from "../../lib/star/actionAnim";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const kinds = ["header", "volley"] as const;
const ball = { x: 30, y: 7 };

// 1.
for (const k of kinds) for (const a of [undefined, 30, 45, 60, 75, 90, 100]) {
  check(near(airPickWindowS(k, a), airStrikeTimerS(k, a)), `${k} timer at Aerial ${a} is not the timed screen's`);
}
const bandTable: [number, number, number][] = [[30, 0.285, 0.114], [60, 0.3, 0.15], [90, 0.39, 0.255]];
for (const [a, h, v] of bandTable) {
  check(near(airSweetS("header", a), h, 1e-9), `header band at Aerial ${a}: ${airSweetS("header", a)} s, want ${h}`);
  check(near(airSweetS("volley", a), v, 1e-9), `volley band at Aerial ${a}: ${airSweetS("volley", a)} s, want ${v}`);
}
for (const k of kinds) {
  let prev = 0;
  for (let a = 0; a <= 120; a += 5) { const b = airSweetS(k, a); check(b >= prev - 1e-12, `${k} band shrinks at Aerial ${a}`); prev = b; }
  const [from, to] = airSweetBand(k, 60);
  check(to === 1 && from > 0.5 && from < 1, `${k} band is not near the end of the timer: ${from}..${to}`);
  check(airSweetS("volley", 60) < airSweetS("header", 60), "a volley's band is not narrower than a header's");
}

// 2.
for (const k of kinds) for (const a of [30, 60, 90]) {
  const w = airPickWindowS(k, a), b = airSweetS(k, a);
  for (const gy of [0.1, 0.5, 0.9]) {
    const s = airPickStrike(k, { tS: w - b / 2, gx: 0.8, gy }, ball, a, 1);
    check(s.err === 0 && s.cx === 0 && near(s.cy, airAimCy(k, gy)) && !s.late, `${k} tap in the band (Aerial ${a}, gy ${gy}) is not clean: ${JSON.stringify(s)}`);
    const r = airContactRead({ kind: k, lift: s.lift, cx: s.cx, cy: s.cy, aerial: a });
    check(r.good, `${k} clean tap (Aerial ${a}, gy ${gy}) reads ${r.label}`);
  }
  let pe = -1, pcx = -1, pcy = -9;
  for (let early = 0; early <= 1.2; early += 0.1) {
    const tS = Math.max(0, w - b - early);
    const s = airPickStrike(k, { tS, gx: 0, gy: 0.2 }, ball, a, 1);
    check(s.err >= pe && Math.abs(s.cx) >= pcx && s.cy >= pcy, `${k} at Aerial ${a}: ${early.toFixed(1)} s early is better than a later tap`);
    pe = s.err; pcx = Math.abs(s.cx); pcy = s.cy;
  }
  const worst = airPickStrike(k, { tS: 0, gx: 0, gy: 0.2 }, ball, a, -1);
  check(worst.err === 1 && worst.cx < 0, `${k} tapped at once (Aerial ${a}) is not the worst touch, on the cross's side`);
  const rw = airContactRead({ kind: k, lift: worst.lift, cx: worst.cx, cy: worst.cy, aerial: a });
  check(!rw.good, `${k} tapped at once (Aerial ${a}) reads ${rw.label}`);
}
for (const k of kinds) {
  // The same tap time (0.35 s before the end): a better Aerial is never more mistimed.
  const e30 = airTimingError(k, airPickWindowS(k, 30) - 0.35, airPickWindowS(k, 30), 30);
  const e90 = airTimingError(k, airPickWindowS(k, 90) - 0.35, airPickWindowS(k, 90), 90);
  check(e90 <= e30, `${k}: Aerial 90 is more mistimed than 30 for the same tap (${e90} > ${e30})`);
}

// 3.
for (const k of kinds) for (const a of [30, 60, 90]) for (const side of [-1, 1]) {
  for (const tS of [null, airPickWindowS(k, a), airPickWindowS(k, a) + 0.5]) {
    const s = airPickStrike(k, { tS, gx: 0.9, gy: 0.9 }, ball, a, side);
    const lc = airLateContact(k, 1, side);
    check(s.late && s.err === 1 && near(s.cx, lc.cx) && near(s.cy, lc.cy) && near(s.lift, lc.lift), `${k} ran out (Aerial ${a}, side ${side}) is not the late touch`);
    const r = airContactRead({ kind: k, lift: s.lift, cx: s.cx, cy: s.cy, aerial: a });
    check(!r.good && r.label === (k === "header" ? "GLANCED" : "MISTIMED"), `${k} ran out reads ${r.label}`);
  }
}

// 4.
check(near(airAimX(-1), POST_L + AIR_AIM_INSET_M) && near(airAimX(1), POST_R - AIR_AIM_INSET_M) && near(airAimX(0), CX), "the tap across the goal is not the aim inside the posts");
check(near(airAimX(-5), airAimX(-1)) && near(airAimX(5), airAimX(1)), "a tap past the post aims past the post");
for (const gx of [-1, -0.5, 0, 0.5, 1]) {
  const { dir, power } = airPickAim("header", ball, gx);
  const tLine = -ball.y / dir.y, x = ball.x + dir.x * tLine;
  check(near(x, airAimX(gx), 1e-6) && near(Math.hypot(dir.x, dir.y), 1) && power > 0.5 && power <= 1, `aim at gx ${gx} crosses the line at ${x}`);
}
check(airAimCy("header", 0) < -0.25 && airAimCy("header", 1) <= 0, "a header aimed low is not nodded down, or aimed high goes under the ball");
check(airAimCy("volley", 0) < airAimCy("volley", 1), "a volley aimed high is not met lower on the ball");
check(airCrossSide({ ball: { x: 30, y: 7 }, teammates: [{ x: 60, y: 2 }] }) === 1 && airCrossSide({ ball: { x: 30, y: 7 }, teammates: [{ x: 5, y: 2 }] }) === -1, "the cross's side is wrong");

// 5.
for (const k of kinds) {
  const w = airPickWindowS(k, 60);
  check(airPickClock(0, w).stage === "approach" && airPickClock(AIR_PICK_APPROACH_S + w / 2, w).stage === "window" && airPickClock(AIR_PICK_APPROACH_S + w + 0.01, w).stage === "done", `${k} clock stages wrong`);
  let prev = Infinity;
  for (let t = 0; t <= AIR_PICK_APPROACH_S + w + 0.2; t += 0.02) {
    const c = airPickClock(t, w);
    check(c.crossLeftS <= prev + 1e-12 && c.crossLeftS >= 0, `${k} the cross goes back at t ${t.toFixed(2)}`);
    prev = c.crossLeftS;
  }
  check(near(airPickClock(AIR_PICK_APPROACH_S + w, w).crossLeftS, 0), `${k} the cross does not reach him as the timer ends`);
  check(near(airPickClock(AIR_PICK_APPROACH_S - 1e-9, w).crossLeftS, airPickClock(AIR_PICK_APPROACH_S, w).crossLeftS, 1e-6), `${k} the cross jumps when the timer opens`);
}
{
  const w = airPickWindowS("header", 60);
  const end = airPickHeaderAnimE(airPickClock(AIR_PICK_APPROACH_S + w, w), HEADER_S);
  check(near(end, headerBeat(0, AIR_PICK_RISE_S, false).animE, 1e-9), `his jump at the end of the timer (${end}) is not where the after-tap header starts`);
  let prev = -1;
  for (let t = 0; t <= AIR_PICK_APPROACH_S + w; t += 0.02) { const e = airPickHeaderAnimE(airPickClock(t, w), HEADER_S); check(e >= prev, "his jump goes back"); prev = e; }
  check(headerBeat(AIR_PICK_RISE_S, AIR_PICK_RISE_S, false).up > 0.999, "the ball does not leave at the top of the jump");
}

// 6.
const base = { x1: 20, x2: 48, y1: -4, y2: 46 };
for (const b of [{ x: 34, y: 6 }, { x: 26, y: 4 }, { x: 44, y: 9 }, { x: 34, y: 15 }]) {
  const v = airPickCamera(base, b);
  const w = v.x2 - v.x1, h = v.y2 - v.y1;
  check(w <= base.x2 - base.x1 + 1e-9 && w < base.x2 - base.x1, `camera for ${JSON.stringify(b)} is not tighter`);
  check(near(h / w, (base.y2 - base.y1) / (base.x2 - base.x1), 1e-9), "camera changes shape");
  check(v.x1 <= Math.min(POST_L, b.x - 2) && v.x2 >= Math.max(POST_R, b.x + 2), `camera for ${JSON.stringify(b)} cuts a post or the ball: ${JSON.stringify(v)}`);
  check(v.y1 <= -2 && v.y2 > b.y + 3, `camera for ${JSON.stringify(b)} cuts the net or the ball: ${JSON.stringify(v)}`);
}

// 7.
const cm = readFileSync(new URL("../../components/star/CanvasMatch.tsx", import.meta.url), "utf8");
check(/if \(phaseRef\.current === "aim" && isAirKind\(scenarioRef\.current\.kind\) && airPickOn\(\)\) return;/.test(cm), "a header/volley can still be dragged");
check(/<AirPick[\s\S]{0,400}onPick=\{onAirPick\}/.test(cm), "the strike screen no longer shows AirPick");
check(/tapped\.aim \?\? aim/.test(cm), "handleContact no longer takes the pick's aim");
check(/handleContact\(\{ cx: st\.cx, cy: st\.cy, lift: st\.lift, late: st\.late, aim: \{ dir: st\.dir, power: st\.power \} \}\)/.test(cm), "a pick is no longer struck through handleContact");
check(/<ContactBall/.test(cm) && /!airPickOpen && \(/.test(cm), "the old strike screen is gone or shows over the pick");

if (problems.length) {
  console.log(`airPick FAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 40)) console.log("  " + p);
  process.exit(1);
}
console.log(`airPick: band header ${airSweetS("header", 30)}/${airSweetS("header", 60)}/${airSweetS("header", 90)} s, volley ${airSweetS("volley", 30)}/${airSweetS("volley", 60)}/${airSweetS("volley", 90)} s at Aerial 30/60/90; tap in the band clean, earlier worse, run out late; aim inside the posts; clock, jump and camera hold — all checks pass`);
