import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch,
  goalInView, SCENARIO_KINDS,
  type Outcome, type Scenario, type Ball,
} from "../../lib/star/canvasEngine";
import { castScenario, creatorOf } from "../../lib/star/lineup";
import { generateSquad } from "../../lib/star/squadData";
import { creditMatchResult, makeInitialCareer } from "../../lib/star/careerFlow";
import type { SquadPlayer, GoalEvent } from "../../lib/star/types";
import { commentaryBuildup, commentaryStrike, commentaryResult } from "../../lib/star/matchCommentary";

/**
 * Who did what.
 *
 * A goal is a thing a person did. The engine used to know that a goal had been
 * scored and nothing else about it: the man who scored was "the attacking
 * midfielder", a role label rolled at kick-off, and the squad screen showed
 * nobody with anything against their name. Worse, the credit for it went to the
 * wrong man entirely — `ball.shot` goes true when a TEAM-MATE strikes it, and
 * the chance was filed off that flag, so you were given his goal and never given
 * the assist you had just played.
 *
 * Reported, with screenshots: "IT'S THERE! the attacking midfielder finishes it
 * off", ASSISTS 0/0, and a squad list of Liverpool players on nought.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;
const SQUAD: SquadPlayer[] = generateSquad("liverpool");
const names = new Set(SQUAD.map(p => p.name));

function playOut(sc: Scenario, ball: Ball, rng: () => number): Outcome | "none" {
  let out: Outcome | null = null;
  for (let i = 0; i < 900 && !out; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT);
    out = stepBall(ball, sc, rng, DT);
  }
  return out ?? "none";
}

const mates = (sc: Scenario) => [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];

// ── Everybody on the pitch is somebody ──────────────────────────────────────
{
  for (const kind of SCENARIO_KINDS) {
    const rng = mulberry32(1000 + kind.length * 37);
    let anonymous = 0, dupes = 0, offSquad = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const sc = buildScenario(kind, rng, 62, 60, 55);
      castScenario(sc, SQUAD);
      const seen = new Set<string>();
      for (const r of mates(sc)) {
        if (!r.who) { anonymous += 1; continue; }
        if (!names.has(r.who.name)) offSquad += 1;
        if (seen.has(r.who.id)) dupes += 1;
        seen.add(r.who.id);
      }
      if (goalInView(kind)) {
        if (!sc.follower.who) anonymous += 1;
        else if (seen.has(sc.follower.who.id)) dupes += 1;
      }
    }
    check(anonymous === 0, `${kind}: nobody on the pitch is anonymous (${anonymous} were)`);
    check(dupes === 0, `${kind}: nobody is in two places at once (${dupes})`);
    check(offSquad === 0, `${kind}: everybody is a player from the squad (${offSquad} were not)`);
  }

  // No squad — the sandbox, and every test that does not pass one — must still
  // build and play. It simply has nobody to name.
  const sc = buildScenario("cutback", mulberry32(5), 62, 60, 55);
  castScenario(sc, []);
  check(mates(sc).every(r => r.who === undefined), "with no squad, nobody is invented");
}

// ── The man in the box is a forward ─────────────────────────────────────────
//
// Not decoration. Your best finisher standing on the penalty spot is what makes
// a name in the commentary land, and it is also how a team is picked.
{
  const rng = mulberry32(77);
  const N = 400;
  let forward = 0;
  for (let i = 0; i < N; i++) {
    const sc = buildScenario("cutback", rng, 62, 60, 55);
    castScenario(sc, SQUAD);
    const p = sc.follower.who?.position;
    if (p && ["ST", "CAM", "LW", "RW"].includes(p)) forward += 1;
  }
  check(forward === N, `the poacher in the six-yard box is a forward (${pct(forward, N)})`);
}

// ── Whoever the ball reaches is who shoots ──────────────────────────────────
{
  for (const kind of ["cutback", "through_ball", "byline_cross"] as const) {
    const rng = mulberry32(kind.length * 91 + 3);
    const N = 600;
    let reached = 0, named = 0, matched = 0;
    for (let i = 0; i < N; i++) {
      const sc = buildScenario(kind, rng, 62, 60, 55);
      castScenario(sc, SQUAD);
      initDefenders(sc, rng);
      const opts = mates(sc);
      if (!opts.length) continue;
      const t = opts.reduce((a, b) => (b.pos.y < a.pos.y ? b : a));
      const who = t.who;
      const ball = launch(sc, { x: t.pos.x - sc.ball.x, y: t.pos.y - sc.ball.y }, 0.6,
        { cx: 0, cy: 0 }, { power: 72, technique: 72 }, rng);
      playOut(sc, ball, rng);
      if (!sc.receiverReached) continue;
      reached += 1;
      if (sc.receiver?.who) named += 1;
      // It found SOMEBODY on the pitch — usually the man aimed at, sometimes the
      // poacher who got across him, and either is a real person.
      const landed = sc.receiver?.who?.id;
      if (landed && (landed === who?.id || mates(sc).some(r => r.who?.id === landed) || sc.follower.who?.id === landed)) {
        matched += 1;
      }
    }
    check(reached > N * 0.2, `${kind}: the pass reaches somebody often enough to measure (${pct(reached, N)})`);
    check(named === reached, `${kind}: every man who receives it has a name (${named}/${reached})`);
    check(matched === reached, `${kind}: and it is one of the men who was on the pitch (${matched}/${reached})`);
  }
}

// ── Your shot is yours; his is his ──────────────────────────────────────────
//
// The bug that made a team-mate's goal read as yours. `ball.shot` goes true when
// he strikes it too, so the credit — which read that flag — handed you his goal,
// gave him nothing, and dropped the assist.
{
  const rng = mulberry32(404);
  const N = 500;
  let youShotStuck = 0, receiverGoals = 0;
  for (let i = 0; i < N; i++) {
    const sc = buildScenario("cutback", rng, 62, 60, 55);
    castScenario(sc, SQUAD);
    initDefenders(sc, rng);
    const opts = mates(sc);
    if (!opts.length) continue;
    const t = opts[0].pos;
    const ball = launch(sc, { x: t.x - sc.ball.x, y: t.y - sc.ball.y }, 0.6,
      { cx: 0, cy: 0 }, { power: 72, technique: 72 }, rng);
    const struckByYou = ball.youStruckAtGoal === true;
    playOut(sc, ball, rng);
    if (!sc.receiverShot) continue;
    receiverGoals += 1;
    // The ball says "shot" because HE hit it. The record of what you did must not.
    if (!struckByYou && ball.youStruckAtGoal === true) youShotStuck += 1;
  }
  check(receiverGoals > 50, `team-mates take enough shots to measure (${receiverGoals})`);
  check(youShotStuck === 0, `a team-mate's strike is never recorded as yours (${youShotStuck})`);

  // And the direct case: a shot you take at goal is still yours after it lands.
  const r2 = mulberry32(909);
  let mine = 0, tries = 0;
  for (let i = 0; i < 300; i++) {
    const sc = buildScenario("one_on_one", r2, 62, 60, 55);
    castScenario(sc, SQUAD);
    initDefenders(sc, r2);
    const ball = launch(sc, { x: 34 - sc.ball.x, y: -sc.ball.y }, 0.75,
      { cx: 0, cy: 0 }, { power: 78, technique: 74 }, r2);
    if (!ball.youStruckAtGoal) continue;
    tries += 1;
    playOut(sc, ball, r2);
    if (ball.youStruckAtGoal === true) mine += 1;
  }
  check(tries > 200 && mine === tries, `a shot you struck stays yours (${mine}/${tries})`);
}

// ── An assist is somebody who was in the move ───────────────────────────────
{
  const rng = mulberry32(31);
  let crossed = 0, open = 0;
  for (let i = 0; i < 300; i++) {
    const volley = buildScenario("volley", rng, 62, 60, 55);
    castScenario(volley, SQUAD);
    if (creatorOf(volley)) crossed += 1;
    const solo = buildScenario("long_range", rng, 62, 60, 55);
    castScenario(solo, SQUAD);
    if (!creatorOf(solo)) open += 1;
  }
  check(crossed === 300, `a volley was crossed by somebody (${crossed}/300)`);
  check(open === 300, `a shot from distance has no creator to invent (${open}/300)`);
}

// ── …and it lands on his row in the squad screen ────────────────────────────
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  const clubs = ["Liverpool", "Arsenal", "Chelsea", "Everton", "Fulham", "Brentford"];
  const career = { ...makeInitialCareer(player, clubs), squad: SQUAD.map(p => ({ ...p })) };
  const fixture = career.fixtures[0];

  const scorer = SQUAD.find(p => p.position === "ST")!;
  const creator = SQUAD.find(p => p.position === "LW")!;
  const events: GoalEvent[] = [
    { minute: 61, scorer: scorer.name, assist: "Mikey Vass", isUserGoal: false },
    { minute: 78, scorer: "Mikey Vass", assist: creator.name, isUserGoal: true },
  ];
  const stats = {
    goalEvents: events, goals: 1, assists: 1, chances: 2, passes: 4, rating: 7.5, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
    homeScore: 2, awayScore: 0,
  } as never;

  const after = creditMatchResult(career, fixture, stats).career;
  const row = (id: string) => (after.squad ?? []).find(p => p.id === id);
  check((row(scorer.id)?.seasonGoals ?? 0) === 1,
    `the goal lands on the scorer's row (${row(scorer.id)?.seasonGoals} for ${scorer.shortName})`);
  check((row(scorer.id)?.careerGoals ?? 0) === 1, "…and on his career total");
  check((row(creator.id)?.seasonAssists ?? 0) === 1,
    `the assist lands on the creator's row (${row(creator.id)?.seasonAssists} for ${creator.shortName})`);
  check(after.seasonStats.assists === 1, `and your assist lands on yours (${after.seasonStats.assists})`);
  check(after.seasonStats.goals === 1, `along with the one you scored (${after.seasonStats.goals})`);
  // Nobody who was not involved picks anything up.
  const bystanders = (after.squad ?? []).filter(
    p => p.id !== scorer.id && p.id !== creator.id && (p.seasonGoals > 0 || p.seasonAssists > 0));
  check(bystanders.length === 0, `nobody who was not involved is credited (${bystanders.length} were)`);
}

// ── And the commentary says his name ────────────────────────────────────────
//
// The whole point of knowing who is on the pitch. "A team-mate is arriving in
// the middle" was true of nobody; "Chiesa is arriving in the middle" is true of
// somebody. Every moment that can name a man now does: the situation, the
// strike, the touch, the shot and the result.
{
  const PASSING = ["cutback", "byline_cross", "through_ball", "midfield_pass", "buildup", "corner"] as const;
  for (const kind of PASSING) {
    const rng = mulberry32(kind.length * 13 + 7);
    const N = 200;
    let named = 0, anon = 0;
    for (let i = 0; i < N; i++) {
      const sc = buildScenario(kind, rng, 62, 60, 55);
      castScenario(sc, SQUAD);
      const who = sc.runner?.who?.shortName
        ?? sc.secondaryRunners.find(r => r.role === "target")?.who?.shortName;
      const line = commentaryBuildup(kind, rng, who) + " " + commentaryStrike(kind, rng, who);
      if (who && line.includes(who)) named += 1;
      // The same call with nobody to name must still produce a sentence, and
      // must never leave a hole where the name would have gone.
      const blank = commentaryBuildup(kind, rng) + " " + commentaryStrike(kind, rng);
      if (blank.trim().length > 10 && !blank.includes("{")) anon += 1;
    }
    check(named === N, `${kind}: the commentary names the man it is about (${named}/${N})`);
    check(anon === N, `${kind}: …and reads fine when there is nobody to name (${anon}/${N})`);
  }

  // A one-on-one is you and the keeper. Nobody else gets written into it.
  const r = mulberry32(21);
  for (const kind of ["one_on_one", "long_range", "penalty"] as const) {
    const line = commentaryBuildup(kind, r, "Chiesa") + " " + commentaryStrike(kind, r, "Chiesa");
    check(!line.includes("Chiesa"), `${kind}: a chance that is about you does not invent an involvement`);
  }

  // And the result line, which is where the report started: "IT'S THERE! the
  // attacking midfielder finishes it off" — lower case, mid-sentence, nobody.
  const r2 = mulberry32(88);
  let capitalised = 0;
  for (let i = 0; i < 300; i++) {
    const line = commentaryResult("goal", r2, { chain: true, receiverReached: true, roleLabel: "Chiesa" });
    if (line.includes("Chiesa")) capitalised += 1;
  }
  check(capitalised === 300, "a team-mate's goal is announced by name");
  const roleLine = commentaryResult("goal", mulberry32(2), {
    chain: true, receiverReached: true, roleLabel: "the attacking midfielder",
  });
  check(!/[.!?] [a-z]/.test(roleLine), `sentences start with a capital ("${roleLine}")`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — every shirt on the pitch is a real player, and the goal goes to the man who scored it");
