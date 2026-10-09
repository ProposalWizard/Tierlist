/**
 * THE 3D KICK FOLLOWS THE REAL KICK (Harry, 9 Oct 2026: "every kick animation
 * is the same no matter the power"). lib/star/style3d/kickStyle.ts reads the
 * ball the 2D engine has just struck and picks the swing: a side-foot pass, a
 * driven kick, a full-power laces strike, a chip or a lofted ball — with a
 * backswing, swing speed and follow-through that grow with the power.
 * Checked against the engine's own launch() over its real power range.
 */
import { buildScenario, launch } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { kickKindOf, kickStyleFor } from "../../lib/star/style3d/kickStyle";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error("  ✗ " + m); } else console.log("  ✓ " + m); };
const MOCAP = new Set(["kick_r", "kick_l", "shot_low", "shot_r", "chip", "pass_lofted", "pass_inside", "volley"]);
const has = (n: string) => MOCAP.has(n);

const strike = (power: number, cy: number) => {
  const rng = mulberry32(11);
  const sc = buildScenario("one_on_one", rng, 60);
  const b = launch(sc, { x: 0, y: -1 }, power, { cx: 0, cy }, { power: 70, technique: 70 }, rng);
  return { vx: b.vel.x, vy: b.vel.y, vz: b.vz };
};

const soft = kickStyleFor(strike(0.3, -1), false, has);
const firm = kickStyleFor(strike(0.6, -0.6), false, has);
const full = kickStyleFor(strike(1, -0.6), false, has);
const chip = kickStyleFor(strike(0.35, 1), false, has);
console.log(`soft ${soft.kind}/${soft.clip}, firm ${firm.kind}/${firm.clip}, full ${full.kind}/${full.clip}, chip ${chip.kind}/${chip.clip}`);
ok(soft.kind === "soft" && soft.clip === "pass_inside", "a third-power kick is a side-foot pass");
ok(firm.kind === "firm" && firm.clip === "kick_r", "a firm kick is a driven kick");
ok(full.kind === "full" && full.clip === "shot_r", "a full-power kick is a laces strike");
ok(chip.kind === "chip" || chip.kind === "lofted", `a soft kick under the ball goes up: ${chip.kind}`);
ok(soft.backswing < firm.backswing && firm.backswing < full.backswing, `the backswing grows with power (${soft.backswing.toFixed(2)} < ${firm.backswing.toFixed(2)} < ${full.backswing.toFixed(2)} s)`);
ok(soft.swing < firm.swing && firm.swing < full.swing, `the swing gets faster with power (${soft.swing.toFixed(2)} < ${firm.swing.toFixed(2)} < ${full.swing.toFixed(2)}×)`);
ok(full.follow > soft.follow, "a full-power strike follows through further");
ok(full.hop > 0 && soft.hop === 0 && firm.hop === 0, "only a full-power strike hops");

// the left foot has only kick_l: it still varies by speed and backswing
const sl = kickStyleFor(strike(0.3, -1), true, has), fl = kickStyleFor(strike(1, -0.6), true, has);
ok(sl.clip === "kick_l" && fl.clip === "kick_l" && fl.swing > sl.swing && fl.backswing > sl.backswing, "a left-foot kick keeps kick_l, softer or harder");
// a body without the mocap clips plays shot_r, varied
const bare = kickStyleFor(strike(0.3, -1), false, (n) => n === "shot_r");
ok(bare.clip === "shot_r", "without the extra clips it falls back to shot_r");
ok(kickKindOf({ vx: 0, vy: -10, vz: 7 }) === "chip" && kickKindOf({ vx: 0, vy: -20, vz: 11 }) === "lofted" && kickKindOf({ vx: 0, vy: -16, vz: 6.5 }) === "firm", "steep and slow is a chip, steep and quick a lofted ball");
ok(kickStyleFor(null, false, has).kind === "firm", "no ball read: a firm kick");

if (fails) { console.error(`${fails} failed`); process.exit(1); }
console.log("kickStyle: all passed");
