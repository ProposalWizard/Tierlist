/**
 * tests/star/strikePower.mts — the top of the shot-power curve is flattened
 * (v0.15, item 11b).
 *
 * Harry: "At 99 power in the normal game, shots are too strong." The approved
 * plan: power keeps climbing to about 80, then much more slowly, so a 99
 * leaves the boot at about 103 km/h instead of 113. The drag must feel
 * exactly the same.
 *
 * Run: npx tsx tests/star/strikePower.mts
 */
import { readFileSync } from "fs";
import { buildScenario, launch, dragForFullPower } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { strikingPower, topSpeedScale, fullPowerSpeed, POWER_POINTS, DEFAULT_POWER_SPEEDS } from "../../lib/star/strikePower";
import { POST_R } from "../../lib/star/pitch";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

console.log("\nTHE CURVE");
// Mikey, 26 Oct 2026: 40 is a starting player now (strikePower.ts DEFAULT_POWER_SPEEDS).
ok(POWER_POINTS.every((p, i) => Math.abs(fullPowerSpeed(p) - DEFAULT_POWER_SPEEDS[i]) < 1e-9), "the curve passes through its own speeds");
let rising = true;
for (let p = 0; p < 100; p += 0.5) if (!(strikingPower(p + 0.5) > strikingPower(p))) rising = false;
ok(rising, "more power is always a little more — 99 is still the best there is");
ok(Math.abs(strikingPower(100) - 82) < 0.3, `a 100 still strikes the ball like an ${strikingPower(100).toFixed(1)} (the top is where it was)`);

console.log("\nTHE BALL (full pull, struck through the middle, aimed at the top corner from the spot)");
/** km/h off the boot, as CanvasMatch strikes it: the curve's number into launch. */
const kmh = (stat: number) => {
  const sc = buildScenario("penalty", mulberry32(99), 62, 60, 55);
  const tx = POST_R - 0.3, dx = tx - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
  const b = launch(sc, { x: dx / L, y: dy / L }, 1, { cx: 0, cy: 0 }, { power: stat, technique: 99 }, () => 0.5);
  return Math.hypot(b.vel.x, b.vel.y) * 3.6;
};
const rows = [40, 60, 80, 90, 99].map((p) => ({ p, before: kmh(p), after: kmh(strikingPower(p)) }));
for (const r of rows) console.log(`  power ${r.p}: ${r.before.toFixed(1)} -> ${r.after.toFixed(1)} km/h`);
const r40 = rows.find((r) => r.p === 40)!, old40 = r40.before;
ok(r40.after < old40 * 0.9, `40 is clearly weaker: ${r40.after.toFixed(1)} km/h (was ${old40.toFixed(1)})`);
const at65 = kmh(strikingPower(65));
ok(Math.abs(at65 - old40) / old40 < 0.02, `65 hits it like the old 40: ${at65.toFixed(1)} km/h (old 40 ${old40.toFixed(1)})`);
const r99 = rows.find((r) => r.p === 99)!;
ok(r99.after > 102 && r99.after < 104, `99: ${r99.after.toFixed(1)} km/h, the top where it was (~102-103)`);

// topSpeedScale is the share of pace the curve keeps — pinned to launch's own
// formula, so the two cannot drift apart unnoticed.
let pinned = true;
for (const stat of [81, 85, 90, 95, 99]) for (const pw of [0.3, 0.7, 1]) for (const cy of [-1, 0, 0.8]) {
  const sc = buildScenario("one_on_one", mulberry32(stat), 62, 60, 55);
  const a = launch(sc, { x: 0, y: -1 }, pw, { cx: 0.4, cy }, { power: stat, technique: 70 }, () => 0.5);
  const b = launch(sc, { x: 0, y: -1 }, pw, { cx: 0.4, cy }, { power: strikingPower(stat), technique: 70 }, () => 0.5);
  if (Math.abs(Math.hypot(b.vel.x, b.vel.y) / Math.hypot(a.vel.x, a.vel.y) - topSpeedScale(stat)) > 1e-9) pinned = false;
}
ok(pinned, "the pace kept is exactly topSpeedScale, whatever the pull and the contact");

console.log("\nTHE DRAG FEELS THE SAME");
// The drag is read off your REAL power before the ball is struck (CanvasMatch's
// powerFromDrag -> dragForFullPower(skillsRef.current.power) — read live since
// v0.15 item 21, so a boot put on mid-match reaches the drag); only launch gets
// the curve's number. Pinned in the source, since it lives in a React component.
// (v0.15 A4: the aim is `a` — your drag, or a run-up scuff's / a watched
// team-mate's kick — so the pin reads `a.dir, a.power`.)
const src = readFileSync(new URL("../../components/star/CanvasMatch.tsx", import.meta.url), "utf8");
ok(/screenPull\(drag, ball\) \/ dragForFullPower\(skillsRef\.current\.power\)/.test(src), "the pull is measured against your real power");
ok(/power: strikingPower\(strikeWith\.power\)/.test(src) && /launch\(scenarioRef\.current, a\.dir, a\.power, contact, launchWith, rngRef\.current\)/.test(src),
  "the ball is struck with the curve's number");
ok(/skills: launchWith,/.test(src), "a goal's replay keeps the numbers it was struck with (so it replays at the same pace)");
for (const p of [40, 80, 99]) console.log(`  power ${p}: full power at ${(dragForFullPower(p) * 100).toFixed(2)}% of the screen, before and after`);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
