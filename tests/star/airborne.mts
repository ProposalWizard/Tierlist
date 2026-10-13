/**
 * Airborne chances (lib/star/airborneChance.ts): how often a close chance
 * arrives in the air, and that the strike starts from that height.
 */
import { airborneMotion, applyAirborne, HEADER_Z, VOLLEY_MAX_Z } from "../../lib/star/airborneChance";
import { buildScenario, launch, stepBall, type ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";

let fail = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) fail++; };

// 1. Shares, and no more pointless bobble.
const kinds: ScenarioKind[] = ["one_on_one", "tight_angle", "long_range", "cutback", "through_ball", "corner", "penalty", "free_kick"];
let n = 0, head = 0, vol = 0, bob = 0;
for (const k of kinds) for (let s = 1; s <= 2000; s++) {
  const m = airborneMotion(k, s); n++;
  if (m === "float") head++; else if (m === "bounce") vol++; else if (m === "bobble") bob++;
  if (["corner", "penalty", "free_kick"].includes(k)) check(m === "still" || s > 1, `${k} dead ball stays still`);
}
console.log(`  headers ${(100 * head / n).toFixed(1)}%  volleys ${(100 * vol / n).toFixed(1)}%  of ${n} chances (all kinds)`);
check(bob === 0, "no bobbles with the switch on");
check(head > 0 && vol > 0, "both happen");
check((head + vol) / n < 0.2, "rare: under 1 in 5 of all chances");
for (const k of ["corner", "penalty", "free_kick"] as ScenarioKind[]) {
  let moved = 0; for (let s = 1; s <= 2000; s++) if (airborneMotion(k, s) !== "still") moved++;
  check(moved === 0, `${k}: dead ball never in the air`);
}

// 2. The strike starts at the right height, and still goes in sometimes.
function strike(kind: "header" | "volley" | "ground", seed: number) {
  const rng = mulberry32(seed);
  const sc = buildScenario("cutback", rng);
  const gx = (sc.goal.x1 + sc.goal.x2) / 2;
  const d = { x: gx - sc.ball.x, y: -sc.ball.y }; const L = Math.hypot(d.x, d.y);
  const ball = launch(sc, { x: d.x / L, y: d.y / L }, 0.75, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
  if (kind !== "ground") applyAirborne(ball, sc, { kind, lift: 1 });
  const z0 = ball.z;
  let out = ""; for (let i = 0; i < 2000 && !out; i++) out = stepBall(ball, sc, rng, 1 / 120) ?? "";
  return { z0, out };
}
{ let g = 0; for (let s = 1; s <= 300; s++) if (strike("ground", s * 7 + 1).out === "goal") g++; console.log(`  same shot on the grass: ${g}/300 goals`); }
for (const kind of ["header", "volley"] as const) {
  let goals = 0, z = 0; const N = 300;
  for (let s = 1; s <= N; s++) { const r = strike(kind, s * 7 + 1); z += r.z0; if (r.out === "goal") goals++; }
  console.log(`  ${kind}: starts at ${(z / N).toFixed(2)} m, ${goals}/${N} goals`);
  check(Math.abs(z / N - (kind === "header" ? HEADER_Z : VOLLEY_MAX_Z)) < 0.05, `${kind} starts off the ground`);
  check(goals > 0 && goals < N, `${kind} can score and can miss`);
}

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("PASS");
