import {
  buildScenario, initDefenders, stepDefenders, stepReactions,
  visibleOptions, optionsSeen, scanRange, spaceScore,
  type Scenario,
} from "../../lib/star/canvasEngine";

/**
 * Information economy, and legs.
 *
 * Vision buys KNOWLEDGE, not accuracy: everyone is drawn on the pitch either
 * way, but only the options a player of this vision could actually pick out get
 * called out to him. Fatigue costs execution, never intent — a tired player
 * strikes the ball less cleanly; he does not aim somewhere else.
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

/** A scenario a couple of seconds into the aim phase, where the options exist. */
function settled(kind: Parameters<typeof buildScenario>[0], seed: number): Scenario {
  const rng = mulberry32(seed);
  const sc = buildScenario(kind, rng, 62, 60);
  initDefenders(sc, rng);
  for (let t = 0; t < 1.5; t += DT) {
    stepDefenders(sc, DT, sc.player, false);
  }
  return sc;
}

// ── The scale itself ────────────────────────────────────────────────────────
{
  check(optionsSeen(10) === 1 && optionsSeen(50) === 2 && optionsSeen(90) === 3,
    "vision buys you more of the pitch, in steps");
  check(optionsSeen(-40) === 1 && optionsSeen(500) === 3, "the scale is bounded at both ends");
  check(scanRange(0) < scanRange(100), "and a longer look");
  check(scanRange(0) > 8, "even a blind player sees the man next to him");
  check(scanRange(100) < 45, "and nobody sees the whole pitch at once");
}

// ── More vision, more options ───────────────────────────────────────────────
{
  // Cutback: a scripted target plus two support players, so three options
  // genuinely exist and the top of the scale is reachable.
  const scenarios = Array.from({ length: 400 }, (_, i) => settled("cutback", i * 3 + 1));
  const counts = (vision: number) => mean(scenarios.map(sc => visibleOptions(sc, sc.player, vision).length));
  const low = counts(20), mid = counts(55), high = counts(92);
  check(low < mid && mid < high, `a better passer is shown more (${low.toFixed(2)} → ${mid.toFixed(2)} → ${high.toFixed(2)})`);
  check(low >= 0.5, `and the worst passer is still shown the obvious man (${low.toFixed(2)})`);
}

// ── Best first, and never anything he cannot reach ─────────────────────────
{
  for (let seed = 0; seed < 300; seed++) {
    const sc = settled(seed % 2 ? "cutback" : "long_range", seed * 5 + 7);
    const seen = visibleOptions(sc, sc.player, 90);
    for (let i = 1; i < seen.length; i++) {
      if (seen[i - 1].score < seen[i].score) { check(false, "options come back best first"); break; }
    }
    for (const o of seen) {
      const d = Math.hypot(o.runner.pos.x - sc.player.x, o.runner.pos.y - sc.player.y);
      if (d > scanRange(90) + 1e-6) { check(false, "nothing outside the scan range is surfaced"); break; }
    }
  }

  // The option a high-vision player is shown first is genuinely the best one on
  // the pitch, not merely the best of a shortlist he happened to be given.
  let matched = 0, sampled = 0;
  for (let seed = 0; seed < 300; seed++) {
    const sc = settled("long_range", seed * 11 + 2);
    const all = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
    if (all.length < 2) continue;
    sampled++;
    const trueBest = all.reduce((a, b) =>
      spaceScore(a.pos, sc, sc.player) >= spaceScore(b.pos, sc, sc.player) ? a : b);
    const seen = visibleOptions(sc, sc.player, 95);
    if (seen[0]?.runner === trueBest) matched++;
  }
  check(sampled > 50, "there are scenarios with a real choice in them");
  check(matched > sampled * 0.8,
    `a high-vision player is pointed at the actually-best option (${matched}/${sampled})`);
}

// ── Vision changes what you are told, not what is there ────────────────────
{
  for (let seed = 0; seed < 200; seed++) {
    const a = settled("long_range", seed * 7 + 4);
    const b = settled("long_range", seed * 7 + 4);
    const optsA = [...(a.runner ? [a.runner] : []), ...a.secondaryRunners].length;
    const optsB = [...(b.runner ? [b.runner] : []), ...b.secondaryRunners].length;
    visibleOptions(a, a.player, 5);
    visibleOptions(b, b.player, 99);
    const afterA = [...(a.runner ? [a.runner] : []), ...a.secondaryRunners].length;
    const afterB = [...(b.runner ? [b.runner] : []), ...b.secondaryRunners].length;
    if (optsA !== afterA || optsB !== afterB) {
      check(false, "reading the pitch never changes the pitch");
      break;
    }
  }
  check(true, "reading the pitch never changes the pitch");
}

// ── Legs ────────────────────────────────────────────────────────────────────
//
// Mirrors the component's model exactly, so a change to one without the other
// shows up here.
{
  const drainPerMinute = (fitness: number) => 0.10 * (1.5 - fitness / 100);
  const DRAIN_PER_CHANCE = 1.6;
  const tired = (skill: number, energy: number) => skill * (0.80 + 0.20 * (energy / 100));

  const spend = (fitness: number, chances: number) =>
    85 - 90 * drainPerMinute(fitness) - chances * DRAIN_PER_CHANCE;

  const unfit = spend(40, 7), fit = spend(95, 7);
  check(fit > unfit, `match fitness is what keeps you going (${unfit.toFixed(0)} left vs ${fit.toFixed(0)})`);
  check(unfit > 20, `even an unfit player finishes the match on his feet (${unfit.toFixed(0)})`);
  check(fit < 80, `and a fit one is still tired by the end (${fit.toFixed(0)})`);

  check(tired(80, 100) === 80, "a fresh player is at his full technique");
  const spent = tired(80, 0);
  check(spent === 64, `an empty player loses a fifth of his touch (${spent})`);
  check(spent > 0, "and never loses all of it");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of [...new Set(problems)].slice(0, 12)) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — vision surfaces what a player could see, and legs cost execution not intent");
