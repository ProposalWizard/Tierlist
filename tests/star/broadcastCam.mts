/**
 * THE CAREER MATCH'S 3D BROADCAST CAMERA (lib/star/style3d/broadcastCam.ts).
 *
 * Harry, 9 Oct 2026: "dragging is having to be done off the pitch alot and
 * players too big, angle too low" — and one chance drawn top-down. Over every
 * chance kind × 20 seeds, on a 390×844 phone:
 *   - always the same angle (40° down): never top-down, never at the grass;
 *   - the ball at 55–65% of the height, so ≥ 25% of the canvas is pitch below it;
 *   - a man at the ball 9–11% of the canvas height (measured through the camera);
 *   - everything in the action on the screen.
 */
import { buildScenario, initDefenders, goalInView, SCENARIO_KINDS } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { solveBroadcast, actionPoints, bcProject, BROADCAST, type BcFigure } from "../../lib/star/style3d/broadcastCam";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error("  ✗ " + m); } else console.log("  ✓ " + m); };
const W = 390, H = 844;
let n = 0, badAngle = 0, badRoom = 0, badMan = 0, offScreen = 0, kCapped = 0;
const room: number[] = [], man: number[] = [];
const sideKinds = new Set<string>();
for (const kind of SCENARIO_KINDS) {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = mulberry32(seed * 131 + kind.length * 7);
    const sc = buildScenario(kind, rng, 40 + (seed * 7) % 55);
    initDefenders(sc, rng);
    const figs: BcFigure[] = [
      { sid: "you", x: sc.player.x, y: sc.player.y, team: "us" },
      ...sc.defenders.map((d, i) => ({ sid: `def${i}`, x: d.x, y: d.y, team: "them" as const })),
      ...sc.teammates.map((t, i) => ({ sid: `mate${i}`, x: t.x, y: t.y, team: "us" as const })),
      ...(sc.runner ? [{ sid: "run0", x: sc.runner.pos.x, y: sc.runner.pos.y, team: "us" as const }] : []),
      ...((sc as unknown as { secondaryRunners?: { pos: { x: number; y: number } }[] }).secondaryRunners ?? []).map((r, i) => ({ sid: `run${i + 1}`, x: r.pos.x, y: r.pos.y, team: "us" as const })),
      { sid: "follower", x: sc.follower.x, y: sc.follower.y, team: "us" },
    ];
    const gv = goalInView(sc.kind);
    const pts = actionPoints({ x: sc.ball.x, y: sc.ball.y }, figs, { x: sc.keeper.x, y: sc.keeper.y, drawn: gv }, gv);
    const facing = sc.facing ?? "up";
    if (facing !== "up") sideKinds.add(kind);
    const c = solveBroadcast({ anchor: sc.ball, points: pts, facing, W, H });
    n++;
    const deg = (c.elev * 180) / Math.PI;
    if (deg < 35 || deg > 45) badAngle++;
    room.push(1 - c.anchorShare); man.push(c.man);
    if (c.anchorShare < 0.549 || c.anchorShare > 0.65 || 1 - c.anchorShare < 0.25) badRoom++;
    if (c.man < 0.09 || c.man > 0.11) { badMan++; if (process.env.V) console.log(kind, seed, facing, c.man.toFixed(3), c.k.toFixed(2)); }
    if (c.k >= BROADCAST.kMax - 1e-6) kCapped++;
    for (const p of pts) { const s = bcProject(c, W, H, p); if (Math.abs(s.nx) > 1 || s.fr < 0 || s.fr > 1) { offScreen++; break; } }
  }
}
const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
console.log(`${n} chances; room below the ball ${pct(room, 0).toFixed(2)}–${pct(room, 1).toFixed(2)}; man height ${(pct(man, 0) * 100).toFixed(1)}–${(pct(man, 1) * 100).toFixed(1)}% (median ${(pct(man, 0.5) * 100).toFixed(1)}%); k at its cap ${kCapped}`);
ok(SCENARIO_KINDS.length >= 13, `${SCENARIO_KINDS.length} chance kinds`);
ok(sideKinds.size > 0, `side-on chances are in the set (${[...sideKinds].join(", ")}) and use the same camera`);
ok(badAngle === 0, `every chance 35–45° down, never top-down (${badAngle} not)`);
ok(badRoom === 0, `the ball at 55–65% of the height, ≥ 25% pitch below it (${badRoom} not)`);
ok(badMan <= n * 0.03, `a man at the ball is 9–11% of the canvas height in ≥ 97% of chances (${badMan} of ${n} not: the widest, where the size cap holds)`);
ok(Math.min(...man) >= 0.075 && Math.max(...man) <= 0.11, `never under 7.5% or over 11% (${(Math.min(...man) * 100).toFixed(1)}–${(Math.max(...man) * 100).toFixed(1)}%)`);
ok(offScreen === 0, `everything in the action is on the screen (${offScreen} chances not)`);
if (fails) { console.error(`${fails} failed`); process.exit(1); }
