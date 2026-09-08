import {
  powerDrill, techniqueDrill, freeKickDrill, paceDrill, visionDrill,
  strikeSpot, conePositions, gateCrossing, gateQuality, shotQuality, ladder,
} from "../../lib/star/trainingDrills";
import { CX, POST_L, POST_R, PITCH_W, GOAL_W } from "../../lib/star/pitch";

/**
 * THE TRAINING LADDER.
 *
 * Reported directly: the drills were "extremely basic", "unrelated to the
 * abilities", and never once read the player's actual stat — a pace-5 and a
 * pace-95 player got the identical drill at the identical difficulty. The
 * brief for the rebuild was explicit about the shape of the fix, with two
 * worked examples: cones that move "further back… further to the side" every
 * level until "you had to curl the ball a bit", and a shooting drill that
 * "starts off very close" and then "keeps moving you back, keeps adding
 * players in the way", so that near level 100 "it would be very difficult to
 * complete".
 *
 * That is a testable claim, and this is the test: every curve rises the whole
 * way up, the bottom of the ladder is genuinely gentle, and the top is
 * genuinely severe. None of it needs a canvas — the same reason
 * `firstPersonDribble.ts`'s own maths lives apart from its renderer.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── ladder() is the 0-1 the whole file is built on ─────────────────────────
{
  check(ladder(0) === 0, "level 0 sits at the bottom of the ladder");
  check(ladder(100) === 1, "level 100 sits at the top");
  check(ladder(50) === 0.5, "level 50 is halfway");
  check(ladder(-20) === 0 && ladder(180) === 1, "a level outside 0-100 is clamped, not extrapolated");
}

// ── Every curve is monotonic in level ─────────────────────────────────────
//
// The single property the whole feature rests on: training a stat must never
// make its own drill EASIER. Checked across the full range at every level
// rather than at a few sampled points, because a curve that sags in the
// middle is exactly the kind of thing a three-point spot check misses.
{
  for (let rep = 0; rep < 4; rep++) {
    let lastPowerDist = -Infinity, lastKeeper = -Infinity, lastBlockers = -Infinity;
    let lastGateDist = -Infinity, lastGateWidth = Infinity;
    let lastFkDist = -Infinity, lastWall = -Infinity;
    let lastChasers = -Infinity, lastOpp = -Infinity;
    let lastOptions = -Infinity, lastWindow = Infinity, lastMargin = Infinity;

    for (let level = 0; level <= 100; level++) {
      const p = powerDrill(level, rep);
      check(p.distance >= lastPowerDist - 1e-9, `power: shooting distance never comes back in (level ${level}, rep ${rep})`);
      check(p.keeperStrength >= lastKeeper - 1e-9, `power: the keeper never gets worse (level ${level})`);
      check(p.blockers >= lastBlockers, `power: blockers never disappear as you improve (level ${level})`);
      lastPowerDist = p.distance; lastKeeper = p.keeperStrength; lastBlockers = p.blockers;

      const t = techniqueDrill(level, rep);
      check(t.gateDistance >= lastGateDist - 1e-9, `technique: the gate never comes closer (level ${level})`);
      check(t.gateWidth <= lastGateWidth + 1e-9, `technique: the gate never widens (level ${level})`);
      lastGateDist = t.gateDistance; lastGateWidth = t.gateWidth;

      const f = freeKickDrill(level, rep);
      check(f.distance >= lastFkDist - 1e-9, `free kick: never moves nearer the goal (level ${level})`);
      check(f.wall >= lastWall, `free kick: the wall never loses men (level ${level})`);
      lastFkDist = f.distance; lastWall = f.wall;

      const pa = paceDrill(level, rep);
      check(pa.chasers >= lastChasers, `pace: never fewer men to beat (level ${level})`);
      check(pa.oppStrength >= lastOpp - 1e-9, `pace: they never get slower (level ${level})`);
      lastChasers = pa.chasers; lastOpp = pa.oppStrength;

      const v = visionDrill(level, rep);
      check(v.options >= lastOptions, `vision: never fewer options to read (level ${level})`);
      check(v.window <= lastWindow + 1e-9, `vision: the window never grows (level ${level})`);
      check(v.margin <= lastMargin + 1e-9, `vision: the right pass never becomes MORE obvious (level ${level})`);
      lastOptions = v.options; lastWindow = v.window; lastMargin = v.margin;
    }
  }
}

// ── The bottom of the ladder is a beginner's drill ────────────────────────
//
// A 16-year-old on 5 pace with 20 technique has to be able to actually
// complete a session, or training can never start.
{
  const p = powerDrill(5, 0);
  check(p.distance < 13, `power at level 5 is a shot from inside the box (${p.distance.toFixed(1)}m)`);
  check(p.blockers === 0, "power at level 5 has nobody in the way");
  check(p.keeperStrength < 45, `power at level 5 faces a weak keeper (${p.keeperStrength.toFixed(0)})`);

  const t = techniqueDrill(5, 0);
  check(t.gateWidth > 4.5, `technique at level 5 is a wide gate (${t.gateWidth.toFixed(1)}m)`);
  check(Math.abs(t.gateOffset) < 1, `technique at level 5 is more or less straight ahead (${t.gateOffset.toFixed(1)}m off)`);
  check(t.gateWidth > GOAL_W / 2, "…wider than half a goal, which is a gate you can hit without a technique to speak of");

  const pa = paceDrill(5, 0);
  check(pa.chasers <= 2, `pace at level 5 is two men (${pa.chasers})`);

  const v = visionDrill(5, 0);
  check(v.window > 2.4, `vision at level 5 gives you time to look (${v.window.toFixed(2)}s)`);
  check(v.margin > 6, `vision at level 5 has one obviously free man (${v.margin.toFixed(1)}m of space)`);
}

// ── …and the top of it is meant to hurt ───────────────────────────────────
{
  const p = powerDrill(99, 3);
  check(p.distance > 33, `power at level 99 is a long-range effort (${p.distance.toFixed(1)}m)`);
  check(p.blockers >= 4, `power at level 99 has a crowd in the way (${p.blockers})`);
  check(p.keeperStrength > 90, `power at level 99 faces a top keeper (${p.keeperStrength.toFixed(0)})`);

  const t = techniqueDrill(99, 3);
  check(t.gateWidth < 2.0, `technique at level 99 is a gap barely wider than a ball (${t.gateWidth.toFixed(2)}m)`);
  check(t.gateDistance > 30, `technique at level 99 is a long pass (${t.gateDistance.toFixed(1)}m)`);
  check(Math.abs(t.gateOffset) > 5, `technique at level 99 sits well off your own line — it has to be bent (${t.gateOffset.toFixed(1)}m)`);

  const f = freeKickDrill(99, 3);
  check(f.wall >= 5, `free kick at level 99 has a full wall (${f.wall})`);
  check(f.distance > 29, `free kick at level 99 is from distance (${f.distance.toFixed(1)}m)`);

  const pa = paceDrill(99, 3);
  check(pa.chasers >= 6, `pace at level 99 is a gauntlet (${pa.chasers} men)`);
  check(pa.oppStrength > 90, `pace at level 99 is chased by quick defenders (${pa.oppStrength.toFixed(0)})`);

  const v = visionDrill(99, 3);
  check(v.window < 1.0, `vision at level 99 is a glance (${v.window.toFixed(2)}s)`);
  check(v.margin < 1.5, `vision at level 99 is a genuine choice, not a spot-the-gap (${v.margin.toFixed(1)}m)`);
  check(v.options >= 8, `vision at level 99 has a full picture to read (${v.options})`);
}

// ── The geometry stays on an actual football pitch ────────────────────────
//
// The curves push distance and offset a long way; nothing they produce may
// ever put the ball, or a cone, off the grass.
{
  for (let level = 0; level <= 100; level += 5) {
    for (let rep = 0; rep < 4; rep++) {
      const p = powerDrill(level, rep);
      const spot = strikeSpot(p.distance, p.offset);
      check(spot.x > 0 && spot.x < PITCH_W, `power spot stays on the pitch (level ${level} rep ${rep}: x=${spot.x.toFixed(1)})`);
      check(spot.y > 0, `power spot is in front of the goal line (level ${level} rep ${rep})`);

      const f = freeKickDrill(level, rep);
      const fkSpot = strikeSpot(f.distance, f.offset);
      check(fkSpot.x > 0 && fkSpot.x < PITCH_W, `free-kick spot stays on the pitch (level ${level} rep ${rep})`);

      const t = techniqueDrill(level, rep);
      const cones = conePositions(strikeSpot(20, 0), t);
      check(cones.left.x > 0 && cones.right.x < PITCH_W, `both cones stay on the pitch (level ${level} rep ${rep})`);
      check(cones.left.x < cones.right.x, "the left cone is always left of the right one");
      check(cones.centre.y >= 0, "the gate never sits behind the goal line");
    }
  }
}

// ── gateCrossing: interpolated, not sampled ───────────────────────────────
{
  // A ball travelling from y=20 to y=10 across a gate at y=15, drifting right.
  const cross = gateCrossing({ x: 30, y: 20, z: 0.4 }, { x: 34, y: 10, z: 0.8 }, 15);
  check(!!cross, "a pair of samples straddling the gate produces a crossing");
  check(!!cross && Math.abs(cross.x - 32) < 1e-9, `…interpolated exactly halfway (${cross?.x})`);
  check(!!cross && Math.abs(cross.z - 0.6) < 1e-9, `…including the height at that instant (${cross?.z})`);

  check(gateCrossing({ x: 30, y: 20, z: 0 }, { x: 31, y: 18, z: 0 }, 15) === null,
    "samples entirely short of the gate do not count as a crossing");
  check(gateCrossing({ x: 30, y: 12, z: 0 }, { x: 31, y: 8, z: 0 }, 15) === null,
    "samples entirely beyond the gate do not count either");

  // The bug this exists to prevent: a fast shot that skips the whole gate
  // between two frames must still be judged on where it actually crossed.
  const fast = gateCrossing({ x: 20, y: 26, z: 0.2 }, { x: 40, y: 4, z: 0.6 }, 15);
  check(!!fast, "a shot fast enough to skip the gate between frames is still judged");
  check(!!fast && fast.x > 29 && fast.x < 31, `…at the real crossing point, not a sampled one (${fast?.x.toFixed(2)})`);
}

// ── gateQuality: centre beats edge beats miss, and you cannot chip it ─────
{
  const cfg = techniqueDrill(50, 0);
  const centreX = 34;
  const dead = gateQuality({ x: centreX, z: 0.3 }, cfg, centreX);
  const edge = gateQuality({ x: centreX + cfg.gateWidth / 2 - 0.05, z: 0.3 }, cfg, centreX);
  const past = gateQuality({ x: centreX + cfg.gateWidth, z: 0.3 }, cfg, centreX);
  const miles = gateQuality({ x: centreX + 30, z: 0.3 }, cfg, centreX);

  check(dead === 1 || Math.abs(dead - 1) < 1e-9, `straight through the middle is a perfect rep (${dead})`);
  check(edge < dead && edge > past, `clipping the inside of a cone beats going outside it (${edge.toFixed(2)} vs ${past.toFixed(2)})`);
  check(past > miles, `just outside the gate still beats missing by miles (${past.toFixed(2)} vs ${miles.toFixed(2)})`);
  check(miles === 0, "a ball nowhere near the gate scores nothing");
  check(gateQuality(null, cfg, centreX) === 0, "a ball that never crossed the gate line at all scores nothing");

  // The height ceiling — the whole point of which is that a narrowing gate
  // can never be answered by lifting it over the cones.
  check(gateQuality({ x: centreX, z: cfg.maxHeight + 0.01 }, cfg, centreX) === 0,
    "a ball chipped over the cones scores nothing, however central");
  check(gateQuality({ x: centreX, z: cfg.maxHeight - 0.01 }, cfg, centreX) > 0.9,
    "…and one that squeaks under the ceiling still counts");
}

// ── shotQuality: a goal always beats a save, placement decides the rest ───
{
  const cornerGoal = shotQuality("goal", POST_L + 0.2);
  const centralGoal = shotQuality("goal", CX);
  const saved = shotQuality("saved", CX);
  const blocked = shotQuality("blocked", null);
  const narrowlyWide = shotQuality("wide", POST_R + 0.3);
  const miles = shotQuality("wide", POST_R + 12);

  check(cornerGoal > centralGoal, `a corner is worth more than a shot down the middle (${cornerGoal.toFixed(2)} vs ${centralGoal.toFixed(2)})`);
  check(centralGoal >= 0.55, "…but any goal at all is still a good rep");
  check(centralGoal > saved && saved > blocked, `goal > save > block (${centralGoal.toFixed(2)} > ${saved.toFixed(2)} > ${blocked.toFixed(2)})`);
  check(narrowlyWide > miles, `inches wide beats hopelessly wide (${narrowlyWide.toFixed(2)} vs ${miles.toFixed(2)})`);
  check(shotQuality("post", CX) > saved, "hitting the post is the best of the ones that stayed out");
  check(cornerGoal <= 1 && miles >= 0, "every quality stays inside 0-1");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}
console.log("PASS — every training drill scales with the stat it trains, gently at the bottom and brutally at the top");
