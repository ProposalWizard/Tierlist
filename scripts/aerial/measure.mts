/**
 * AERIAL & ACROBATICS — goals from headers and volleys at Aerial 30 / 60 / 90.
 *
 *   npx tsx scripts/aerial/measure.mts [--n=600]
 *
 * B10's own method (scripts/b10/measure.mts): the pictures the game serves
 * (the team's cross drawings, airDrawings.ts), struck the B10 way
 * (airContactRead: where you met it and when), by the same seeded bot thumb
 * (tests/star/shotLab.ts). One change: the bot's hand is held at B10's
 * "average" finisher (tap sd 0.30, timing sd 0.22) for every row, so only
 * the skill moves.
 *
 *   before  today: the strike reads Power = Technique = the skill (30/60/90).
 *   after   Aerial: Power = Technique = 60, Aerial = 30/60/90 on the strike.
 *
 * The 60 rows must match closely (Aerial 60 plays as Technique 60 does).
 */
import { shoot, type Thumb, type LabOptions } from "../../tests/star/shotLab";
import { applyAirborne } from "../../lib/star/airborneChance";
import type { Scenario, ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "600"));
const TAP_SD = 0.3, TIME_SD = 0.22;

function gauss(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const airThumb = (kind: "header" | "volley") => (sc: Scenario, r: () => number): Thumb => {
  const farSide = sc.keeper.x < CX ? 1 : -1;
  const side = r() < 0.75 ? farSide : -farSide;
  const inset = 0.35 + r() * 0.6;
  const targetX = side > 0 ? POST_R - inset : POST_L + inset;
  const meant = kind === "header" ? (r() < 0.6 ? { cx: 0, cy: -0.35 } : { cx: 0, cy: 0 }) : { cx: 0, cy: -0.1 };
  const power = kind === "header" ? 0.7 + r() * 0.3 : 0.75 + r() * 0.25;
  let cx = meant.cx + gauss(r) * TAP_SD, cy = meant.cy + gauss(r) * TAP_SD;
  const d = Math.hypot(cx, cy); if (d > 1) { cx /= d; cy /= d; }
  return { aimErrDeg: gauss(r) * 2.5, power, contact: { cx, cy }, intent: "placed", targetX, aimX: targetX };
};

function liftFor(kind: "header" | "volley", seed: number): number {
  const r = mulberry32((seed ^ 0x1f7a3) >>> 0);
  if (kind === "header") return 0.84 + 0.16 * r();
  return Math.max(0, Math.min(1, 0.55 + gauss(r) * TIME_SD));
}

function rate(kind: "header" | "volley", how: "before" | "after", skill: number): number {
  let goals = 0;
  for (let i = 1; i <= N; i++) {
    const seed = (i * 7919 + kind.length * 104729) >>> 0;
    const base = how === "before" ? skill : 60;
    const o: LabOptions = { skills: { power: base, technique: base }, thumbFor: airThumb(kind) };
    o.afterLaunch = (ball, sc, thumb) => {
      applyAirborne(ball, sc, {
        kind, lift: liftFor(kind, seed), cx: thumb.contact.cx, cy: thumb.contact.cy, tech: base,
        ...(how === "after" ? { aerial: skill } : {}),
      });
    };
    if (shoot(kind as ScenarioKind, seed, o).goal) goals++;
  }
  return (100 * goals) / N;
}

for (const kind of ["header", "volley"] as const) {
  const row = (how: "before" | "after") => [30, 60, 90].map((s) => rate(kind, how, s).toFixed(1).padStart(5)).join("  ");
  console.log(`\n${kind.toUpperCase()} — goals per 100 (${N} each)     30     60     90`);
  console.log(`before (Power = Technique = skill)   ${row("before")}`);
  console.log(`after  (Aerial = skill, P/T 60)      ${row("after")}`);
}
