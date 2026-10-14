/**
 * Fingerprint of the play-on as it was before the joystick (Old, and New on
 * "Auto run"), for tests/star/afterPassStick.mts: the same harness as
 * playOn.mts, every chance's end hashed (outcome, time, where you and the
 * ball finished). A change to the Auto-run path changes the hash.
 */
import { makeChance } from "../../lib/star/chanceMaker";
import { mulberry32 } from "../../lib/star/season";
import { launch, stepBall, stepReactions, stepDefenders, stepKeeper, initDefenders, orderableRunners, type Scenario, type Ball, type Outcome, type ScenarioKind } from "../../lib/star/canvasEngine";
import { playOnWanted, startPlayOn, stepPlayOn, MAX_LAY_OFFS } from "../../lib/star/playOn";

const H = 1 / 180;
export function playOnFingerprint(on: boolean): string {
  let h = 2166136261 >>> 0;
  const mix = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  for (const kind of ["one_on_one", "long_range", "byline_cross", "cutback"] as ScenarioKind[]) {
    for (let i = 0; i < 120; i++) {
      const rng = mulberry32(7100 + i * 37 + kind.length * 11);
      const sc: Scenario = makeChance({ source: { from: "kind", kind }, rng }).sc;
      initDefenders(sc, rng);
      const mates = orderableRunners(sc);
      if (!mates.length) continue;
      const to = mates[i % mates.length].pos;
      const dx = to.x - sc.ball.x, dy = to.y - sc.ball.y, d = Math.hypot(dx, dy) || 1;
      const ball: Ball = launch(sc, { x: dx, y: dy }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
      const sp = Math.max(12, Math.min(22, 10 + d * 0.45));
      ball.vel = { x: (dx / d) * sp, y: (dy / d) * sp }; ball.vz = 0; ball.z = 0.08; ball.spin = 0; ball.shot = false; ball.youStruckAtGoal = false;
      const st = playOnWanted({ newChances: on, hadBuildUp: true, kind, youShotAtGoal: false }) ? startPlayOn(sc, rng, to) : null;
      const lr = mulberry32(0x51ab ^ i);
      let res: Outcome | null = null, t = 0;
      for (; t < 14 && !res; t += H) {
        stepDefenders(sc, H, ball.pos, false, ball); stepKeeper(sc, H); stepReactions(sc, ball, H, rng);
        if (st && stepPlayOn(st, sc, ball, H, lr, MAX_LAY_OFFS) === "caught") { res = "delivered"; break; }
        res = stepBall(ball, sc, rng, H);
        if (ball.event) ball.event = null;
      }
      mix(`${kind}|${i}|${res}|${t.toFixed(4)}|${sc.player.x.toFixed(6)},${sc.player.y.toFixed(6)}|${ball.pos.x.toFixed(6)},${ball.pos.y.toFixed(6)}`);
    }
  }
  return h.toString(16);
}
