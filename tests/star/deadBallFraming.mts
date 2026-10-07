/**
 * THREE MATCH BUGS FROM HARRY'S v0.26/v0.27 KNOWN ISSUES, KEPT FIXED.
 *
 *  1. "After a deflected free kick, the wall chases the loose ball."
 *     (lib/star/canvasEngine.ts stepShape) Once the ball came to a stop every
 *     wall man joined the back line's shift and slid across with it. Measured
 *     before: of 344 drives deflected off the wall (400 kicks), 160 had two or
 *     more wall men move over half a metre; 594 of 1,266 wall men moved, mean
 *     1.72 m. Now the wall holds; at most the one nearest a stopped ball goes
 *     for it.
 *
 *  2. "A cutback struck along the byline can sit for 1.6 s before it is called
 *     intercepted." (stepBallRaw, "a ball that has died where only they can
 *     have it") A soft ball along the byline stopped short with none of ours
 *     near it and the nearest defender jogged 10+ m to it. Measured before: 17
 *     of 460 intercepted byline crosses sat (moved under 1 m) for 1 s or more,
 *     the longest 1.88 s. Now it is called "short" (under-hit, never reached
 *     anyone) after 0.3 s: none over 1 s.
 *
 *  3. "New chances put extra players off screen when the pitch is flat."
 *     (lib/star/matchView.ts fitCameraToTilt) The pull-back that keeps every
 *     man in the chance on screen only ran when the camera was tipped. Flat,
 *     a drawn cutback left one of its own men off screen in 92 of 150 chances
 *     (Classic chances), and the New chances' extra players were off screen
 *     in 1,597 of 1,650. Flat now gets the same check as 20°.
 */
import {
  initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch,
  type Outcome, type Scenario,
} from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import { strikeKind, stepKind } from "../../lib/star/kindRules";
import { deflectBlock } from "../../lib/star/deflection";
import { steerDeflectionFromOwnGoal, clearLooseWin } from "../../lib/star/defenderTouch";
import { frameForNewView } from "../../lib/star/matchView";
import { CX, POST_L, POST_R } from "../../lib/star/pitch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SUB = 1 / 180;
const served = (kind: "free_kick" | "byline_cross" | "cutback", seed: number, set: "new" | "classic" = "new"): Scenario => {
  const rng = mulberry32(seed);
  const sc = makeChance({ source: { from: "kind", kind }, rng, strength: { keeper: 62, team: 60, vision: 55 }, memory: null, set }).sc;
  initDefenders(sc, rng);
  return sc;
};

/** One substep exactly as CanvasMatch's flight loop runs it, deflection included. */
function play(sc: Scenario, ball: ReturnType<typeof launch>, rng: () => number, seed: number,
  kd: ReturnType<typeof strikeKind> = null, onDeflect?: () => void, each?: (t: number) => void): Outcome | null {
  let out: Outcome | null = null, defl = 0, t = 0;
  for (let i = 0; i < 6000 && !out; i++) {
    stepDefenders(sc, SUB, ball.pos, false, ball);
    stepKeeper(sc, SUB);
    stepReactions(sc, ball, SUB, rng);
    stepKind(sc, ball, SUB, kd);
    const pre = { vx: ball.vel.x, vy: ball.vel.y, vz: ball.vz, z: ball.z, spin: ball.spin };
    let res = stepBall(ball, sc, rng, SUB);
    if (res === "blocked" && defl < 1) {
      defl++;
      deflectBlock(ball, sc, pre, mulberry32(seed * 31 + 7));
      steerDeflectionFromOwnGoal(ball, sc);
      res = null;
      onDeflect?.();
    }
    if (res === "short") clearLooseWin(ball, sc);
    t += SUB; out = res;
    each?.(t);
  }
  return out;
}

// ── 1. The wall holds after a deflection ────────────────────────────────────
{
  let deflected = 0, wallsThatMoved = 0, menMoved = 0, men = 0;
  for (let s = 0; s < 200; s++) {
    const sc = served("free_kick", 4000 + s);
    const rng = mulberry32(77 + s);
    const ball = launch(sc, { x: CX - sc.ball.x, y: -sc.ball.y }, 0.85, { cx: 0, cy: 0 }, { power: 60, technique: 60 }, rng);
    const kd = strikeKind(sc, ball, mulberry32(s ^ 0x6b1d), { keeperStrength: 62, power: 60, technique: 60 });
    const wall = sc.defenders.filter((d) => d.baseRole === "hold" && Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 12.5);
    let at: { x: number; y: number }[] | null = null;
    play(sc, ball, rng, s, kd, () => { at = wall.map((d) => ({ x: d.x, y: d.y })); });
    if (!at) continue;
    deflected++;
    const moved = wall.filter((d, i) => Math.hypot(d.x - at![i].x, d.y - at![i].y) > 0.5).length;
    menMoved += moved; men += wall.length;
    if (moved > 1) wallsThatMoved++;
  }
  console.log(`  wall: ${deflected} deflected; 2+ wall men moved in ${wallsThatMoved}; ${menMoved}/${men} men moved`);
  check(deflected > 120, `enough kicks are deflected off the wall to judge (${deflected})`);
  check(wallsThatMoved / deflected < 0.03, `the wall does not slide after the loose ball (${wallsThatMoved} of ${deflected} walls had 2+ men move; was 160 of 344)`);
  check(menMoved / men < 0.15, `at most one man goes for it (${menMoved}/${men} moved; was 594/1,266)`);
}

// ── 2. A dead byline ball is not left sitting ──────────────────────────────
{
  let tackled = 0, sat1 = 0, longest = 0;
  for (let s = 0; s < 600; s++) {
    const sc = served("byline_cross", 7000 + s);
    const rng = mulberry32(13 + s);
    const side = Math.sign(sc.ball.x - CX) || 1;
    const mode = s % 3;
    const tgt = mode === 0 ? { x: CX, y: 0.4 + rng() * 1.2 }
      : mode === 1 ? { x: side > 0 ? POST_R + 0.5 : POST_L - 0.5, y: 0.3 }
      : { x: side > 0 ? POST_R - 0.4 : POST_L + 0.4, y: 0 };
    const ball = launch(sc, { x: tgt.x - sc.ball.x, y: tgt.y - sc.ball.y }, 0.12 + rng() * 0.7,
      { cx: 0, cy: -0.2 - rng() * 0.3 }, { power: 60, technique: 60 }, rng);
    const trail: { t: number; x: number; y: number }[] = [];
    const out = play(sc, ball, rng, s, null, undefined, (t) => trail.push({ t, x: ball.pos.x, y: ball.pos.y }));
    // Lost to the defence: cut out, or (since the fix) called under-hit.
    if (out !== "tackled" && out !== "short") continue;
    tackled++;
    const end = trail[trail.length - 1];
    let k = trail.length - 1;
    while (k > 0 && Math.hypot(trail[k].x - end.x, trail[k].y - end.y) < 1) k--;
    const sat = end.t - trail[k].t;
    longest = Math.max(longest, sat);
    if (sat >= 1) sat1++;
  }
  console.log(`  byline: ${tackled} lost to the defence; sat 1 s+ before the call in ${sat1}; longest ${longest.toFixed(2)} s`);
  check(tackled > 200, `enough byline crosses are lost to the defence to judge (${tackled})`);
  check(sat1 === 0, `no lost byline ball sits a second before the call (${sat1}; was 17 of 460)`);
}

// ── 3. Flat frames every man in the chance, as 20° does ─────────────────────
{
  let flatOff = 0, tiltOff = 0, n = 0;
  for (let s = 0; s < 120; s++) {
    for (const tilt of [0, 20]) {
      const sc = served("cutback", 55000 + s * 13, "classic");
      const cam = frameForNewView(sc, 1.8, false, tilt);
      const men = [sc.ball, sc.player, ...sc.defenders, ...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((r) => r.pos)];
      const off = men.some((p) => p.x < cam.x1 || p.x > cam.x2 || p.y < cam.y1 || p.y > cam.y2);
      if (off) { if (tilt === 0) flatOff++; else tiltOff++; }
    }
    n++;
  }
  console.log(`  framing: a drawn cutback's man off screen flat ${flatOff}/${n}, at 20° ${tiltOff}/${n}`);
  check(flatOff <= tiltOff + 2, `flat keeps the chance on screen as well as 20° does (${flatOff} vs ${tiltOff}; flat was 92 of 150)`);
  check(flatOff / n < 0.05, `a drawn cutback's men are on screen flat (${flatOff}/${n} not)`);
}

if (problems.length) {
  console.error("FAIL —\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("PASS — the wall holds, a dead byline ball is called, and Flat keeps the chance on screen");
