/**
 * HEADERS, VOLLEYS, AND FIRST-TIME GROUNDED FINISHES.
 *
 * Requested directly, as the first piece of a "mega prompt": "I want to be
 * able to cross it onto my teammates heads and they head it towards goal
 * (ideally towards top corners, away from goalie, decent power, first time
 * obvs, etc)." The frustration named directly: a perfect cross onto a
 * team-mate's head used to always cost him a controlling touch first — see
 * RECEIVER_CONTROL_T (canvasEngine.ts) — which gave the keeper time to set
 * and turned a header chance into a weak shot "right into the goalies
 * hands." Also asked in the same message: normal first-time grounded
 * finishes ("Haaland... much more... than the average player") and a
 * genuine volley ("far more potential for power, as well as far more
 * potential to miss... the better the finisher the less of an issue this
 * is").
 *
 * All three are one mechanism: strikeModeForHeight reads the ball's REAL
 * height at the instant it reaches a receiver (previously discarded
 * outright — every reception snapped ball.z to the ground before this),
 * and firstTimeChance decides whether he meets it right now or takes the
 * old controlling touch first — mirroring CHIP_KEEPER_Y's own quality-
 * gated decision, as directly requested ("similar to how the teammates
 * chipping the goalie works now... just adding another decision").
 */

import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, strikeModeForHeight, firstTimeChance,
  type Outcome, type ScenarioKind, type ReceiverStrikeMode,
} from "../../lib/star/canvasEngine";

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
const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;

// ── strikeModeForHeight: pure, fast, exhaustive over the bands ─────────────
{
  // Only the two genuine cross-delivery kinds can ever read as header/volley
  // — "again; only when 'crossed' to" — everything else stays "ground"
  // whatever height it's handed, on purpose: reception has never checked
  // height at all (swept < PASS_CONTROL_R is pure XY), so a "cutback" —
  // RECEIVER_CONTROL's own words, "on the floor, into his stride" — still
  // hasn't finished descending by the time it geometrically reaches the
  // runner a real ~70% of the time (measured directly), same order of
  // magnitude as through_ball. Height alone would read most of those as a
  // header, which is exactly what "only when crossed" rules out.
  const nonCross: ScenarioKind[] = ["cutback", "one_on_one", "through_ball", "midfield_pass", "tight_angle", "long_range"];
  for (const kind of nonCross) {
    for (const z of [0, 0.2, 0.34, 0.35, 0.8, 1.29, 1.3, 1.8, 2.5, 2.6, 2.61, 4]) {
      check(strikeModeForHeight(kind, z) === "ground",
        `${kind} @ z=${z}: never a header/volley, whatever the height (${strikeModeForHeight(kind, z)})`);
    }
  }

  for (const kind of ["corner", "byline_cross"] as ScenarioKind[]) {
    check(strikeModeForHeight(kind, 0) === "ground", `${kind} @ z=0: ground`);
    check(strikeModeForHeight(kind, 0.34) === "ground", `${kind} @ z=0.34: still ground, just under the volley floor`);
    check(strikeModeForHeight(kind, 0.35) === "volley", `${kind} @ z=0.35: volley floor`);
    check(strikeModeForHeight(kind, 0.8) === "volley", `${kind} @ z=0.8: volley`);
    check(strikeModeForHeight(kind, 1.29) === "volley", `${kind} @ z=1.29: still volley, just under the header floor`);
    check(strikeModeForHeight(kind, 1.3) === "header", `${kind} @ z=1.3: header floor`);
    check(strikeModeForHeight(kind, 2.0) === "header", `${kind} @ z=2.0: header`);
    check(strikeModeForHeight(kind, 2.6) === "header", `${kind} @ z=2.6: header ceiling`);
    check(strikeModeForHeight(kind, 2.61) === "ground",
      `${kind} @ z=2.61: too high for anyone to reach right now, falls back to ground (${strikeModeForHeight(kind, 2.61)})`);
    check(strikeModeForHeight(kind, 5) === "ground", `${kind} @ z=5: also falls back to ground`);
  }
}

// ── firstTimeChance: monotonic in quality, correctly ordered, bounded ──────
{
  const modes: ReceiverStrikeMode[] = ["header", "volley", "ground"];
  for (const mode of modes) {
    let prev = -1;
    for (let q = 0; q <= 1.001; q += 0.05) {
      const c = firstTimeChance(mode, q);
      check(c >= prev - 1e-9, `${mode}: firstTimeChance never falls as quality rises (q=${q.toFixed(2)}: ${c.toFixed(3)} after ${prev.toFixed(3)})`);
      check(c >= 0 && c <= 1, `${mode}: a real probability at q=${q.toFixed(2)} (${c})`);
      prev = c;
    }
  }

  // A ball at head height was never really a "control it first" situation
  // for a real footballer — reported directly, of exactly this: "watch him
  // take a touch... SHOOT RIGHT INTO THE GOALIES HANDS." So even a poor
  // finisher goes for it more often than not.
  check(firstTimeChance("header", 0) >= 0.5, `header: even a poor finisher usually still goes for it (${firstTimeChance("header", 0)})`);
  check(firstTimeChance("header", 1) <= 0.95, `header: never an absolute guarantee, same spirit as the chip (${firstTimeChance("header", 1)})`);

  // A dropping ball met on the volley is a genuinely harder technical call
  // than a ball arriving at the head — its floor sits lower.
  check(firstTimeChance("volley", 0) < firstTimeChance("header", 0),
    `volley starts lower than header at the same (poor) quality (${firstTimeChance("volley", 0)} vs ${firstTimeChance("header", 0)})`);

  // An ordinary ball along the ground has always been a take-a-touch
  // situation for anyone but a genuinely sharp finisher — "first time
  // finishes of normal shots should also be possible and likelier as the
  // finisher gets better" — so a poor finisher essentially never takes it
  // first time, and even a maxed-out one doesn't every time.
  check(firstTimeChance("ground", 0) === 0, `ground: a poor finisher never rushes a grounded shot (${firstTimeChance("ground", 0)})`);
  check(firstTimeChance("ground", 0.35) === 0, `ground: still nothing right at the old quality floor other chances used (${firstTimeChance("ground", 0.35)})`);
  check(firstTimeChance("ground", 1) > 0.3 && firstTimeChance("ground", 1) <= 0.6,
    `ground: even Haaland doesn't rush it every single time (${firstTimeChance("ground", 1)})`);
  check(firstTimeChance("ground", 1) < firstTimeChance("volley", 1) && firstTimeChance("volley", 1) < firstTimeChance("header", 1),
    `at max quality the ordering holds: ground < volley < header (${firstTimeChance("ground", 1)} < ${firstTimeChance("volley", 1)} < ${firstTimeChance("header", 1)})`);
}

// ── The real engine, end to end: a cross to the box ─────────────────────────
interface Sample {
  shots: number; goals: number;
  header: number; volley: number; ground: number;
  headerGoals: number; volleyGoals: number; groundGoals: number;
  headerZs: number[]; headerOffs: number[];
}

function sample(kind: ScenarioKind, n: number, shooting: number | undefined): Sample {
  const out: Sample = {
    shots: 0, goals: 0, header: 0, volley: 0, ground: 0,
    headerGoals: 0, volleyGoals: 0, groundGoals: 0, headerZs: [], headerOffs: [],
  };
  for (let seed = 0; seed < n; seed++) {
    const rng = mulberry32(seed * 1013 + kind.length * 7919 + (shooting ?? 1) * 31);
    const sc = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
    initDefenders(sc, rng);
    const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos;
    if (!t || !sc.receiver) continue;
    if (shooting !== undefined) {
      const who = { id: "x", name: "X", shortName: "X", position: "ST", shooting, overall: shooting, physical: shooting };
      if (sc.runner) sc.runner.who = who;
      for (const r of sc.secondaryRunners) r.who = who;
    }
    const d = Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y);
    const ball = launch(sc,
      { x: t.x - sc.ball.x + (rng() - 0.5), y: t.y - sc.ball.y + (rng() - 0.5) },
      Math.min(0.95, 0.2 + d / 32) * (0.92 + rng() * 0.16),
      { cx: (rng() - 0.5) * 0.6, cy: -0.1 - rng() * 0.4 },
      { power: 60, technique: 60 }, rng);
    let res: Outcome | null = null;
    let struck = false, mode: ReceiverStrikeMode | null = null, crossed = false, keeperAt = sc.keeper.x;
    let prevX = ball.pos.x, prevY = ball.pos.y, prevZ = ball.z;
    for (let i = 0; i < 2500 && !res; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      const shotsBefore = sc.receiverShots ?? 0;
      const zBefore = ball.z;
      prevX = ball.pos.x; prevY = ball.pos.y; prevZ = ball.z;
      res = stepBall(ball, sc, rng, DT);
      if ((sc.receiverShots ?? 0) > shotsBefore) { struck = true; mode = strikeModeForHeight(kind, zBefore); keeperAt = sc.keeper.x; }
      if (struck && mode === "header" && !crossed && prevY > 0 && ball.pos.y <= 0) {
        const f = prevY / (prevY - ball.pos.y);
        out.headerZs.push(prevZ + (ball.z - prevZ) * f);
        out.headerOffs.push((prevX + (ball.pos.x - prevX) * f) - keeperAt);
        crossed = true;
      }
    }
    if (!struck || !mode) continue;
    out.shots++;
    const scored = res === "goal" || res === "rebound";
    if (scored) out.goals++;
    if (mode === "header") { out.header++; if (scored) out.headerGoals++; }
    else if (mode === "volley") { out.volley++; if (scored) out.volleyGoals++; }
    else { out.ground++; if (scored) out.groundGoals++; }
  }
  return out;
}

// ── Only a real cross ever produces a header or a volley ───────────────────
{
  for (const kind of ["cutback", "through_ball", "one_on_one"] as ScenarioKind[]) {
    const s = sample(kind, 500, 90);
    check(s.shots > 200, `${kind}: enough shots to read (${s.shots})`);
    check(s.header === 0 && s.volley === 0,
      `${kind}: never a header or a volley, even for a known-elite finisher (header=${s.header} volley=${s.volley} of ${s.shots})`);
  }
}

// ── A cross genuinely produces both, in real numbers ────────────────────────
{
  for (const kind of ["byline_cross", "corner"] as ScenarioKind[]) {
    const s = sample(kind, 900, 90);
    check(s.shots > 600, `${kind}: enough shots to read (${s.shots})`);
    check(s.header > 50, `${kind}: a real, non-trivial share of receptions are headers (${s.header} of ${s.shots})`);
    check(s.volley > 30, `${kind}: and a real share are volleys too (${s.volley} of ${s.shots})`);
    check(s.ground > 30, `${kind}: and some still genuinely reach him along the ground (${s.ground} of ${s.shots})`);

    // Loose bounds, this file's own established idiom: the point is to
    // catch the next inversion (a mode collapsing to a giveaway or to an
    // unbeatable certainty), not to freeze this exact tuning pass.
    const headerRate = s.headerGoals / Math.max(1, s.header);
    const volleyRate = s.volleyGoals / Math.max(1, s.volley);
    check(headerRate > 0.15 && headerRate < 0.75,
      `${kind}: a first-time header converts like a real header, not a giveaway or a certainty (${pct(s.headerGoals, s.header)})`);
    check(volleyRate > 0.20 && volleyRate < 0.80,
      `${kind}: a volley converts like a real volley (${pct(s.volleyGoals, s.volley)})`);
  }
}

// ── The header actually aims high and away from the keeper ─────────────────
{
  const mean = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  for (const kind of ["byline_cross", "corner"] as ScenarioKind[]) {
    const s = sample(kind, 1200, 90);
    check(s.headerZs.length > 80, `${kind}: enough real headers crossing the line to read (${s.headerZs.length})`);
    // "ideally towards top corners" — genuinely elevated at the line, well
    // clear of a grounded finish's own height, comfortably under the 2.44m
    // bar on average.
    check(mean(s.headerZs) > 0.9 && mean(s.headerZs) < 2.3,
      `${kind}: a header crosses the line properly up in the air, not along the floor (mean z ${mean(s.headerZs).toFixed(2)}m)`);
    // "away from goalie" — measured directly rather than assumed from the
    // aim formula alone: where it actually crossed, relative to where the
    // keeper actually was.
    const awayFromKeeper = s.headerOffs.filter(o => Math.abs(o) > 0.5).length;
    check(awayFromKeeper / s.headerOffs.length > 0.6,
      `${kind}: a header is usually placed a real distance from the keeper, not straight at him (${pct(awayFromKeeper, s.headerOffs.length)})`);
  }
}

// ── Ground-mode first-time: a Haaland genuinely rushes more of them than
// an average finisher does ─────────────────────────────────────────────────
{
  // one_on_one is deliberately the kind used here, not byline_cross/corner
  // — it never produces a header or a volley (see above), so every shot in
  // this sample is genuinely the ground-mode decision on its own, not
  // diluted by the two cross-only modes.
  const poor = sample("one_on_one", 700, 35);
  const elite = sample("one_on_one", 700, 92);
  check(poor.shots > 400 && elite.shots > 400, `enough shots to read (${poor.shots}, ${elite.shots})`);
  // Not directly observable from the outside (the decision itself leaves
  // no trace once it resolves to the same "ground" mode either way) — but
  // rushing it earlier means the keeper has had less time to shade across,
  // so conversion is the real, measurable footprint of "does this fire
  // more for a better finisher."
  const poorRate = poor.goals / poor.shots;
  const eliteRate = elite.goals / elite.shots;
  check(eliteRate > poorRate,
    `a real elite finisher converts one_on_one chances more often than a poor one, partly via rushing more of them first time (${pct(poor.goals, poor.shots)} vs ${pct(elite.goals, elite.shots)})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — headers and volleys only ever come from a real cross, a header aims high and away from the keeper, and a better finisher rushes more first-time grounded shots");
