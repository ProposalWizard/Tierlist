import {
  newMatch, tick, kindsForZone, advanceUntilInvolved, resolveScenario,
  type Zone, type HiddenMatchInputs, type ScenarioResult,
} from "../../lib/star/hiddenMatch";

/**
 * The hidden match simulation, judged against the checklist the NSS document
 * sets for it: possession changes naturally, stronger teams create more without
 * dominating, chances only come from areas that justify them, quiet periods
 * exist without being tedious, and the scoreline lands in a footballing range.
 *
 * All of this is statistical, so it is measured over thousands of matches
 * rather than asserted on one.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// Deterministic RNG so a failure is always reproducible.
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FULL_TIME = 90;

/**
 * Stand in for the player taking the chance, at roughly the rates a decent one
 * manages, so momentum and the scoreline move the way they would in play.
 * Deep requests are passes, which are usually completed and keep the ball.
 */
function standInResult(zone: Zone, rng: () => number): ScenarioResult {
  const roll = rng();
  if (zone === "box") return roll < 0.24 ? "goal" : roll < 0.85 ? "saved" : "lost";
  if (zone === "attacking") return roll < 0.11 ? "goal" : roll < 0.6 ? "saved" : roll < 0.85 ? "delivered" : "lost";
  return roll < 0.72 ? "delivered" : "lost";
}

interface Sample {
  userGoals: number;
  oppGoals: number;
  requests: number;
  requestZones: Zone[];
  possessionFlips: number;
  minutesUser: number;
  longestGap: number;
  zoneCounts: Record<Zone, number>;
}

/** Play one whole match, taking every scenario request without resolving it. */
function playMatch(inputs: HiddenMatchInputs, seed: number): Sample {
  const rng = mulberry32(seed);
  const state = newMatch(rng);
  const s: Sample = {
    userGoals: 0, oppGoals: 0, requests: 0, requestZones: [],
    possessionFlips: 0, minutesUser: 0, longestGap: 0,
    zoneCounts: { own_box: 0, defensive: 0, middle: 0, attacking: 0, box: 0 },
  };
  let last = state.possession;
  let gap = 0;

  while (state.minute < FULL_TIME) {
    const before = state.possession;
    const { request } = tick(state, inputs, rng);
    if (state.possession !== last) { s.possessionFlips += 1; last = state.possession; }
    if (before === "user") s.minutesUser += 1;
    s.zoneCounts[state.zone] += 1;
    gap += 1;
    if (request) {
      s.requests += 1;
      s.requestZones.push(request.zone);
      s.longestGap = Math.max(s.longestGap, gap);
      gap = 0;
      resolveScenario(state, standInResult(request.zone, rng));
    }
  }
  s.longestGap = Math.max(s.longestGap, gap);
  s.userGoals = state.userScore;
  s.oppGoals = state.oppScore;
  return s;
}

function run(inputs: HiddenMatchInputs, n = 2000, seed0 = 1): Sample[] {
  return Array.from({ length: n }, (_, i) => playMatch(inputs, seed0 + i * 7919));
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const EVEN: HiddenMatchInputs = { teamStrength: 70, oppStrength: 70, energy: 80, playerSkill: 65 };
const STRONG: HiddenMatchInputs = { teamStrength: 88, oppStrength: 58, energy: 80, playerSkill: 65 };
const WEAK: HiddenMatchInputs = { teamStrength: 55, oppStrength: 88, energy: 80, playerSkill: 65 };

const even = run(EVEN);
const strong = run(STRONG);
const weak = run(WEAK);

// ── Possession changes naturally ────────────────────────────────────────────
{
  const flips = mean(even.map(s => s.possessionFlips));
  check(flips >= 12 && flips <= 45, `possession turns over a believable number of times (got ${flips.toFixed(1)}/match)`);

  const share = mean(even.map(s => s.minutesUser / FULL_TIME));
  check(Math.abs(share - 0.5) < 0.06, `two equal teams share the ball (user had ${(share * 100).toFixed(1)}%)`);

  // Nobody should ever hold the ball for a whole half.
  const monopolies = even.filter(s => s.minutesUser === 0 || s.minutesUser === FULL_TIME).length;
  check(monopolies === 0, "no match is one-sided possession from first minute to last");
}

// ── Stronger teams create more, without dominating ──────────────────────────
{
  const s = mean(strong.map(x => x.requests));
  const e = mean(even.map(x => x.requests));
  const w = mean(weak.map(x => x.requests));
  check(s > e && e > w, `chances scale with team quality (${w.toFixed(1)} < ${e.toFixed(1)} < ${s.toFixed(1)})`);
  check(s / w < 3.2, `the good team does not get triple the chances (ratio ${(s / w).toFixed(2)})`);
  check(w >= 1.5, `even the worst team gets involved (${w.toFixed(1)} chances/match)`);

  const strongShare = mean(strong.map(x => x.minutesUser / FULL_TIME));
  check(strongShare > 0.5 && strongShare < 0.72, `a much better team edges possession without owning it (${(strongShare * 100).toFixed(1)}%)`);

  // Upsets must stay possible: the underdog sometimes gets as much of the game
  // as a player in an evenly matched side would.
  const weakBigDays = weak.filter(x => x.requests >= mean(even.map(y => y.requests))).length / weak.length;
  check(weakBigDays > 0.015, `underdogs still have their days (${(weakBigDays * 100).toFixed(1)}% of matches)`);
}

// ── Chances only come from areas that justify them ──────────────────────────
{
  const zones = even.flatMap(s => s.requestZones);
  check(zones.length > 0, "matches produce chances at all");
  check(!zones.includes("own_box"), "you are never handed a scenario inside your own six-yard box");

  const attackingThird = zones.filter(z => z === "attacking" || z === "box").length / zones.length;
  check(attackingThird > 0.6, `most of what you are asked to do is in the final third (${(attackingThird * 100).toFixed(1)}%)`);

  const inBox = zones.filter(z => z === "box").length / zones.length;
  check(inBox > 0.15 && inBox < 0.7, `chances split between the final third and the box (${(inBox * 100).toFixed(1)}% in the box)`);

  // The deep ones exist so a defender or a holding midfielder gets a game, and
  // they must only ever be safe football — never a shooting chance from your
  // own third, which would be the old random-kind bug wearing a new hat.
  const deepKinds = new Set([...kindsForZone("defensive"), ...kindsForZone("middle")]);
  check(!deepKinds.has("one_on_one") && !deepKinds.has("volley") && !deepKinds.has("header"),
    "deep requests never offer a finishing chance");
}

// ── Zone-to-kind mapping is football-shaped ─────────────────────────────────
{
  check(!kindsForZone("defensive").includes("one_on_one"), "you cannot get a one-on-one from your own defensive third");
  check(!kindsForZone("box").includes("buildup"), "you are not asked to play a build-up pass in the six-yard box");
  check(kindsForZone("box").includes("one_on_one"), "the box can produce a one-on-one");
  check(kindsForZone("attacking").includes("cutback"), "the final third can produce a cutback");
  check((["own_box", "defensive", "middle", "attacking", "box"] as Zone[]).every(z => kindsForZone(z).length > 0), "every zone maps to at least one scenario");
}

// ── Quiet periods exist, but nobody is stranded ─────────────────────────────
{
  const gaps = even.map(s => s.longestGap);
  check(mean(gaps) > 8, `there are genuine quiet spells (longest gap averages ${mean(gaps).toFixed(1)} min)`);
  check(Math.max(...gaps) <= FULL_TIME, "gaps cannot exceed the match");
  const stranded = even.filter(s => s.requests === 0).length / even.length;
  check(stranded < 0.05, `almost nobody plays a whole match without a touch (${(stranded * 100).toFixed(2)}%)`);

  const per = mean(even.map(s => s.requests));
  check(per >= 3 && per <= 10, `a match hands you a playable number of moments (${per.toFixed(1)})`);
}

// ── Scorelines land in a footballing range ──────────────────────────────────
{
  const totals = even.map(s => s.userGoals + s.oppGoals);
  check(mean(totals) > 1.2 && mean(totals) < 5, `goals per match are sane (${mean(totals).toFixed(2)})`);

  const strongWins = strong.filter(s => s.userGoals > s.oppGoals).length / strong.length;
  const weakWins = weak.filter(s => s.userGoals > s.oppGoals).length / weak.length;
  check(strongWins > weakWins, `the better team wins more often (${(strongWins * 100).toFixed(1)}% vs ${(weakWins * 100).toFixed(1)}%)`);
  check(weakWins > 0.05, `the worse team can still win (${(weakWins * 100).toFixed(1)}%)`);
  check(strongWins < 0.9, `nothing is a foregone conclusion (${(strongWins * 100).toFixed(1)}%)`);
}

// ── Effort buys involvement, not better football ────────────────────────────
{
  const fresh = mean(run({ ...EVEN, energy: 100 }, 800).map(s => s.requests));
  const spent = mean(run({ ...EVEN, energy: 10 }, 800).map(s => s.requests));
  check(fresh > spent, `tired legs see less of the ball (${spent.toFixed(1)} vs ${fresh.toFixed(1)})`);
  check(spent > 1, `an exhausted player is not frozen out entirely (${spent.toFixed(1)})`);

  const great = mean(run({ ...EVEN, playerSkill: 95 }, 800).map(s => s.requests));
  const poor = mean(run({ ...EVEN, playerSkill: 25 }, 800).map(s => s.requests));
  check(great > poor, `better players are found more often (${poor.toFixed(1)} vs ${great.toFixed(1)})`);
}

// ── Time compression returns the same match, just faster ────────────────────
{
  const rng = mulberry32(4242);
  const state = newMatch(rng);
  let calls = 0;
  let totalEvents = 0;
  while (state.minute < FULL_TIME) {
    const step = advanceUntilInvolved(state, EVEN, rng, FULL_TIME);
    calls += 1;
    totalEvents += step.events.length;
    if (step.fullTime) {
      check(state.minute >= FULL_TIME, "advanceUntilInvolved only reports full time at full time");
      break;
    }
    check(step.request !== null, "a non-full-time return always carries a request");
    check(state.minute <= FULL_TIME, "the clock never runs past ninety");
    resolveScenario(state, "saved");
  }
  check(calls > 1 && calls < 30, `the match is reached in a handful of jumps (${calls})`);
  check(totalEvents > 0, "skipped minutes still report what happened in them");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — possession, territory, involvement, scorelines and compression all behave");
