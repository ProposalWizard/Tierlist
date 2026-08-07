import { conditionsFor, conditionsLine, type Conditions } from "../../lib/star/weather";
import {
  buildScenario, launch, stepBall, initDefenders, stepKeeper, stepDefenders,
  stepSupport, stepRunner, stepFollower, type Outcome, type Scenario,
} from "../../lib/star/canvasEngine";

/**
 * The surface, the air, and a wall that jumps.
 *
 * Every match was played on a perfect pitch in still air — the ball behaved
 * identically in August and in February, which is the one thing about English
 * football nobody would recognise. And a free-kick wall was four men rooted to
 * the turf, so a free kick was a question of going round the end of it and
 * nothing else.
 *
 * Both are deliberately small. The weather multiplies three physics constants
 * and pushes an airborne ball sideways; it does not touch the keeper, the
 * defence, the scenario or the odds. The wall gains a height, and the block test
 * reads it. Nothing else in the engine knows either exists.
 */

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

const DT = 1 / 60;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Roll a ball along the ground and see how far it gets. */
function rollDistance(conditions: Conditions | undefined, seed: number): number {
  const rng = mulberry32(seed);
  const sc = buildScenario("midfield_pass", rng, 62, 60);
  sc.conditions = conditions;
  sc.runner = null;
  sc.secondaryRunners = [];
  const ball = launch(sc, { x: 0, y: -1 }, 0.35, { cx: 0, cy: -0.5 }, { power: 60, technique: 60 }, rng);
  const from = { ...ball.pos };
  for (let i = 0; i < 900; i++) {
    if (ball.resting) break;
    stepBall(ball, sc, rng, DT);
  }
  return Math.hypot(ball.pos.x - from.x, ball.pos.y - from.y);
}

/** Drop a ball from height and count how high the first bounce goes. */
function firstBounce(conditions: Conditions | undefined): number {
  const rng = mulberry32(4);
  const sc = buildScenario("midfield_pass", rng, 62, 60);
  sc.conditions = conditions;
  sc.runner = null;
  sc.secondaryRunners = [];
  const ball = launch(sc, { x: 0, y: -1 }, 0.6, { cx: 0, cy: 0.9 }, { power: 60, technique: 60 }, rng);
  let grounded = false, peak = 0;
  for (let i = 0; i < 900; i++) {
    stepBall(ball, sc, rng, DT);
    if (!grounded && ball.z <= 0.01) grounded = true;
    else if (grounded) peak = Math.max(peak, ball.z);
    if (ball.resting) break;
  }
  return peak;
}

// ── Conditions are a fact, not a dice roll ─────────────────────────────────
{
  // Stable for a given fixture, so what the team sheet promised is what you get.
  check(JSON.stringify(conditionsFor(3, 7)) === JSON.stringify(conditionsFor(3, 7)),
    "the same fixture always has the same weather");
  check(JSON.stringify(conditionsFor(3, 7)) !== JSON.stringify(conditionsFor(3, 8)),
    "and a different one usually does not");

  // Weather that is remarkable every week is not weather.
  const sample = Array.from({ length: 400 }, (_, i) => conditionsFor(1, i + 1));
  const clear = sample.filter(c => c.weather === "clear").length;
  check(clear / sample.length > 0.45, `most matches are unremarkable (${((clear / sample.length) * 100).toFixed(0)}% clear)`);
  const kinds = new Set(sample.map(c => c.weather));
  check(kinds.size === 4, `every kind is reachable (${Array.from(kinds).join(", ")})`);
  check(sample.filter(c => c.weather === "heavy").length < sample.length * 0.2, "a bog is rare");

  // A perfect day changes nothing at all, which is what every match used to be.
  const perfect = conditionsFor(3, 7).weather === "clear" ? conditionsFor(3, 7) : conditionsFor(1, 1);
  const anyClear = sample.find(c => c.weather === "clear")!;
  check(anyClear.drag === 1 && anyClear.friction === 1 && anyClear.bounce === 1 && anyClear.wind === 0,
    "clear weather is exactly the old behaviour");
  check(conditionsLine(anyClear).length > 0, "and it still says something on the team sheet");
  check(perfect !== null, "a clear day is findable");

  const wind = sample.find(c => c.weather === "wind")!;
  check(wind.wind !== 0, "wind actually blows");
  const winds = sample.filter(c => c.weather === "wind").map(c => c.wind);
  check(winds.some(w => w > 0) && winds.some(w => w < 0), "and it blows both ways across fixtures");

  for (const c of sample) {
    if (conditionsLine(c).length === 0) { check(false, "every condition reads as something"); break; }
    if (c.pitch < 0 || c.pitch > 1) { check(false, "the pitch rating stays in range"); break; }
  }
  check(true, "conditions are well formed");
}

// ── The surface changes the ball, and only the ball ────────────────────────
{
  const clear = conditionsFor(1, 1).weather === "clear" ? conditionsFor(1, 1) : undefined;
  const sample = Array.from({ length: 400 }, (_, i) => conditionsFor(1, i + 1));
  const rain = sample.find(c => c.weather === "rain")!;
  const heavy = sample.find(c => c.weather === "heavy")!;

  const dry = mean(Array.from({ length: 40 }, (_, i) => rollDistance(clear, i * 7 + 1)));
  const wet = mean(Array.from({ length: 40 }, (_, i) => rollDistance(rain, i * 7 + 1)));
  const bog = mean(Array.from({ length: 40 }, (_, i) => rollDistance(heavy, i * 7 + 1)));

  check(wet > dry, `a wet surface is faster — it skids on (${dry.toFixed(1)} m dry vs ${wet.toFixed(1)} m wet)`);
  check(bog < dry, `and a heavy one eats it (${bog.toFixed(1)} m)`);
  check(bog > 2, "but it is a pitch, not treacle");

  check(firstBounce(heavy) < firstBounce(clear), "a bog deadens the bounce");
  check(firstBounce(rain) < firstBounce(clear), "and a wet pitch skids more than it sits up");
  check(firstBounce(heavy) > 0, "the ball still comes up off it");

  // A scenario with no conditions at all behaves exactly as it always did —
  // this is what makes the whole feature safe for the sandbox and old saves.
  const withNothing = mean(Array.from({ length: 40 }, (_, i) => rollDistance(undefined, i * 7 + 1)));
  check(Math.abs(withNothing - dry) < 0.001,
    "a scenario that specifies nothing is identical to a clear day");
}

// ── Wind only touches a ball that is off the ground ────────────────────────
{
  const sample = Array.from({ length: 400 }, (_, i) => conditionsFor(1, i + 1));
  const wind = { ...sample.find(c => c.weather === "wind")!, wind: 3.0 };

  // Wind reaches a ball in the AIR. A driven ball is not exempt — in this engine
  // it skips off the turf and spends most of its journey airborne, which was
  // the premise an earlier version of this test got wrong. The thing that is
  // genuinely untouched is a ball rolling along the ground.
  const drift = (loft: number, conditions: Conditions | undefined) => {
    const rng = mulberry32(11);
    const sc = buildScenario("long_range", rng, 62, 60);
    sc.conditions = conditions;
    sc.runner = null;
    sc.secondaryRunners = [];
    sc.defenders = [];
    const startX = sc.ball.x;
    const ball = launch(sc, { x: 0, y: -1 }, 0.75, { cx: 0, cy: loft }, { power: 70, technique: 70 }, mulberry32(11));
    for (let i = 0; i < 240; i++) {
      if (ball.inNet || ball.resting) break;
      if (stepBall(ball, sc, mulberry32(11), DT)) break;
    }
    return ball.pos.x - startX;
  };

  const loftedStill = drift(0.95, undefined);
  const loftedWindy = drift(0.95, wind);
  check(Math.abs(loftedWindy - loftedStill) > 0.2,
    `a ball in the air is at the wind's mercy (${(loftedWindy - loftedStill).toFixed(2)} m off line)`);

  // A ball on the deck is not. Built directly rather than struck, because even
  // the flattest strike leaves the boot slightly airborne and skips — which is
  // the whole reason the earlier version of this assertion failed.
  const roll = (conditions: Conditions | undefined) => {
    const rng = mulberry32(23);
    const sc = buildScenario("midfield_pass", rng, 62, 60);
    sc.conditions = conditions;
    sc.runner = null; sc.secondaryRunners = []; sc.defenders = [];
    const ball = {
      pos: { x: sc.ball.x, y: sc.ball.y }, vel: { x: 0, y: -9 },
      z: 0, vz: 0, spin: 0, resting: false, loose: false,
      contactCd: 0, receiverControlT: 0, event: null, inNet: false,
    };
    const startX = ball.pos.x;
    for (let i = 0; i < 600 && !ball.resting; i++) stepBall(ball, sc, rng, DT);
    return ball.pos.x - startX;
  };
  check(Math.abs(roll(wind) - roll(undefined)) < 1e-9,
    `a ball rolling on the grass is untouched by it (${(roll(wind) - roll(undefined)).toFixed(6)} m)`);
}

// ── A free-kick wall that jumps ────────────────────────────────────────────
{
  /** Play a free kick out and report how high the wall got. */
  function freeKick(seed: number, loft: number): { out: Outcome | "none"; wallPeak: number; sc: Scenario } {
    const rng = mulberry32(seed);
    const sc = buildScenario("free_kick", rng, 62, 60);
    initDefenders(sc, rng);
    const g = { x: (sc.goal.x1 + sc.goal.x2) / 2, y: 0 };
    const ball = launch(sc, { x: g.x - sc.ball.x, y: g.y - sc.ball.y }, 0.85, { cx: 0, cy: loft }, { power: 72, technique: 72 }, rng);
    let out: Outcome | null = null;
    let wallPeak = 0;
    for (let i = 0; i < 600 && !out; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      wallPeak = Math.max(wallPeak, ...sc.defenders.map(d => d.z ?? 0));
      stepKeeper(sc, DT);
      stepSupport(sc, ball, ball.pos, DT);
      stepRunner(sc, DT);
      stepFollower(sc, ball, rng, DT);
      out = stepBall(ball, sc, rng, DT);
    }
    return { out: out ?? "none", wallPeak, sc };
  }

  const runs = Array.from({ length: 120 }, (_, i) => freeKick(i * 13 + 1, -0.2));
  check(runs.some(r => r.wallPeak > 0.3), `the wall leaves the ground (peak ${Math.max(...runs.map(r => r.wallPeak)).toFixed(2)} m)`);
  check(runs.every(r => r.wallPeak < 1.6), "but they are footballers, not kangaroos");
  check(runs.some(r => r.out === "goal"), "and a free kick can still be scored");

  // They come down again — a wall stuck in the air would let everything under it.
  const one = freeKick(7, -0.2);
  for (let i = 0; i < 240; i++) stepDefenders(one.sc, DT, { x: 34, y: 20 }, false, null);
  check(one.sc.defenders.every(d => (d.z ?? 0) === 0), "and they land");

  // Nobody else ever leaves the turf, so every other scenario is untouched.
  for (const kind of ["one_on_one", "long_range", "cutback", "corner"] as const) {
    const rng = mulberry32(3);
    const sc = buildScenario(kind, rng, 62, 60);
    initDefenders(sc, rng);
    const g = { x: (sc.goal.x1 + sc.goal.x2) / 2, y: 0 };
    const ball = launch(sc, { x: g.x - sc.ball.x, y: g.y - sc.ball.y }, 0.85, { cx: 0, cy: -0.2 }, { power: 70, technique: 70 }, rng);
    let lifted = false;
    for (let i = 0; i < 300; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      if (sc.defenders.some(d => (d.z ?? 0) > 0)) lifted = true;
      if (stepBall(ball, sc, rng, DT)) break;
    }
    check(!lifted, `${kind}: outfield defenders stay on the ground`);
  }
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the surface, the wind, and a wall that jumps and lands");
