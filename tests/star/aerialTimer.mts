/**
 * THE TIMED HEADER AND VOLLEY (Harry, 0.108h, 24 Oct 2026: "the header
 * animation needs to be quicker, it standing still after a live animation for
 * too long is weird, maybe have it be timed").
 *
 * Pins:
 *   1. the timer's one formula (airborneChance.ts airStrikeTimerS): header
 *      1.5 s and volley 1.3 s at Aerial 60, +0.3 s at 90, -0.15 s at 30, read
 *      inside 30..100, absent Aerial = 60;
 *   2. running out is a weak, mistimed touch read by the normal strike
 *      (airLateContact through airContactRead): a header GLANCED, a volley
 *      MISTIMED, never a good one, at any Aerial, either side;
 *   3. the strike screen (ContactBall.tsx) times every ball in the air with
 *      that formula and, when it runs out, strikes through onContact (the one
 *      engine path), not a stall; the penalty run-up's own countdown is kept.
 */
import { readFileSync } from "node:fs";
import { airStrikeTimerS, airLateContact, airContactRead, AIR_TIMER_HEADER_S, AIR_TIMER_VOLLEY_S } from "../../lib/star/airborneChance";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// 1.
check(AIR_TIMER_HEADER_S === 1.5 && AIR_TIMER_VOLLEY_S === 1.3, "the base times moved (header 1.5 s, volley 1.3 s)");
const table: [number | undefined, number, number][] = [[undefined, 1.5, 1.3], [60, 1.5, 1.3], [90, 1.8, 1.6], [30, 1.35, 1.15], [0, 1.35, 1.15], [40, 1.4, 1.2], [100, 1.9, 1.7], [120, 1.9, 1.7], [Number.NaN, 1.5, 1.3]];
for (const [a, h, v] of table) {
  check(near(airStrikeTimerS("header", a), h), `header at Aerial ${a}: ${airStrikeTimerS("header", a)} s, want ${h}`);
  check(near(airStrikeTimerS("volley", a), v), `volley at Aerial ${a}: ${airStrikeTimerS("volley", a)} s, want ${v}`);
}
let prev = 0;
for (let a = 30; a <= 100; a++) { const t = airStrikeTimerS("header", a); check(t >= prev, `the header timer drops at Aerial ${a}`); prev = t; }

// 2.
for (const aerial of [30, 60, 90]) {
  for (const side of [-1, 1]) {
    for (const lift of [0.2, 0.6, 1]) {
      const h = airLateContact("header", lift, side);
      const rh = airContactRead({ kind: "header", aerial, ...h });
      check(!rh.good && rh.label === "GLANCED", `a late header (Aerial ${aerial}, side ${side}) reads ${rh.label}`);
      const v = airLateContact("volley", lift, side);
      const rv = airContactRead({ kind: "volley", aerial, ...v });
      check(!rv.good && rv.label === "MISTIMED", `a late volley (Aerial ${aerial}, side ${side}) reads ${rv.label}`);
      check(rv.pace < 1 && rh.pace < 1, `a late touch (Aerial ${aerial}) comes off at full pace`);
    }
  }
}

// 3.
const cb = readFileSync(new URL("../../components/star/ContactBall.tsx", import.meta.url), "utf8");
check(/airStrikeTimerS\(airKind, aerial\)/.test(cb), "ContactBall no longer times a ball in the air with airStrikeTimerS");
check(/onContactRef\.current\(airLateContact\(/.test(cb), "running out on a ball in the air no longer strikes it late through onContact");
check(/onTimeoutRef\.current\?\.\(\)/.test(cb), "the penalty run-up's own timeout path is gone");
check(/timeLimitS && timeLimitS > 0 \? timeLimitS/.test(cb), "the run-up's own countdown no longer wins over the air timer");

if (problems.length) {
  console.log(`aerialTimer FAIL — ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.log("  " + p);
  process.exit(1);
}
console.log(`aerialTimer: header ${airStrikeTimerS("header", 30)} / ${airStrikeTimerS("header", 60)} / ${airStrikeTimerS("header", 90)} s and volley ${airStrikeTimerS("volley", 30)} / ${airStrikeTimerS("volley", 60)} / ${airStrikeTimerS("volley", 90)} s at Aerial 30/60/90; running out is a GLANCED header / MISTIMED volley through onContact — all checks pass`);
