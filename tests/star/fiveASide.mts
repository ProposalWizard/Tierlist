import {
  FIVE_VIEW, FIVE_PITCH, FIVE_PITCH_W, FIVE_PITCH_L, FIVE_HALFWAY_Y,
  KICK_FLOOR_Y, insideFivePitch, leftPitch, mirror, clampToPitch,
  FIVE_GOAL, FIVE_GOAL_W, FIVE_CROSSBAR,
} from "../../lib/star/fiveASide/geometry";
import {
  buildScenario, VIEW_ASPECT, initDefenders, stepReactions, stepKeeper, stepBall, launch,
  setOffsideRuleEnabled,
} from "../../lib/star/canvasEngine";
import {
  buildPassage, worldFromScenario, kickOffWorld, kindForBall, passLeadsToShot, type FiveWorld,
} from "../../lib/star/fiveASide/passage";
import { mulberry32 } from "../../lib/star/season";
import { POST_L, POST_R, NET_DEPTH, CX } from "../../lib/star/pitch";

/**
 * THE ONE CLAIM THE WHOLE FEATURE RESTS ON.
 *
 * A real five-a-side pitch fits entirely inside the fixed rectangle the match
 * engine already frames every corner in. If that is true, the five-a-side can
 * be played by the live engine with no changes to it at all — same physics,
 * same keeper, same drag-to-aim. If it is false, the feature is a rewrite of
 * the match engine, which the project's governing rule forbids.
 *
 * So the first test does not check our arithmetic against our own arithmetic.
 * It builds a REAL corner through the engine's own `buildScenario` and
 * compares our frame against the frame the engine actually produced. If the
 * engine's camera is ever retuned, this fails loudly instead of the
 * five-a-side quietly drifting out of frame.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

// ── Our frame IS the engine's corner frame ──────────────────────────────
{
  // A corner is the one situation the engine frames the whole width of the
  // attacking third in, and it exposes that frame as `crossSwitchView`.
  let found = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const sc = buildScenario("corner", mulberry32(seed));
    const cut = sc.crossSwitchView;
    if (!cut) continue;
    found++;
    check(near(cut.x1, FIVE_VIEW.x1), `corner frame x1 ${cut.x1} vs ours ${FIVE_VIEW.x1}`);
    check(near(cut.x2, FIVE_VIEW.x2), `corner frame x2 ${cut.x2} vs ours ${FIVE_VIEW.x2}`);
    check(near(cut.y1, FIVE_VIEW.y1), `corner frame y1 ${cut.y1} vs ours ${FIVE_VIEW.y1}`);
    check(near(cut.y2, FIVE_VIEW.y2), `corner frame y2 ${cut.y2} vs ours ${FIVE_VIEW.y2}`);
  }
  check(found > 30, `expected real corner scenarios to compare against, got ${found}`);
}

// ── …and it is a real camera frame, not an arbitrary rectangle ──────────
{
  const w = FIVE_VIEW.x2 - FIVE_VIEW.x1;
  const h = FIVE_VIEW.y2 - FIVE_VIEW.y1;
  check(near(w / h, VIEW_ASPECT), `the frame must keep the engine's aspect (${w / h} vs ${VIEW_ASPECT})`);
  check(near(h, 42), `the engine's frame is 42 m deep, got ${h}`);
  check(near((FIVE_VIEW.x1 + FIVE_VIEW.x2) / 2, CX), "the frame is centred on the pitch");
}

// ── The pitch fits inside it, with real margin ──────────────────────────
{
  const margin = {
    left: FIVE_PITCH.x1 - FIVE_VIEW.x1,
    right: FIVE_VIEW.x2 - FIVE_PITCH.x2,
    behind: FIVE_VIEW.y2 - FIVE_PITCH.y2,
  };
  check(margin.left > 1, `grass to the left of the touchline (${margin.left.toFixed(3)} m)`);
  check(margin.right > 1, `grass to the right of the touchline (${margin.right.toFixed(3)} m)`);
  check(margin.behind > 1, `room behind your own goal (${margin.behind.toFixed(3)} m)`);
  check(FIVE_VIEW.y1 < -NET_DEPTH, "the far net is inside the frame, not cut off by it");

  check(FIVE_PITCH_W === 24 && FIVE_PITCH_L === 36, "the pitch is a real small-sided 24 x 36");
  check(
    FIVE_PITCH_W < 45 && FIVE_PITCH_L < 45 && FIVE_PITCH_W > 15 && FIVE_PITCH_L > 20,
    "the pitch is genuinely small-sided, neither a five-a-side cage nor a full pitch",
  );

  // The goal you are shooting at has to be ON the pitch, or you can never score.
  check(FIVE_GOAL.x1 > FIVE_PITCH.x1 && FIVE_GOAL.x2 < FIVE_PITCH.x2, "both posts are inside the touchlines");
  check(FIVE_PITCH.y1 === 0, "you attack the engine's own goal line");
  check(near(FIVE_HALFWAY_Y, 18), `halfway is halfway (${FIVE_HALFWAY_Y})`);
}

// ── The goal is a real small-sided goal, not a full-size one ───────────
//
// A full-size goal on a 24 m pitch is 30% of the width, in front of a keeper
// who reaches about two metres. That is a shooting gallery. This pins the
// proportion rather than the number, so it stays honest if the pitch changes.
{
  check(Math.abs(FIVE_GOAL_W - 3.66) < 1e-9, `a real five-a-side goal is 3.66 m, got ${FIVE_GOAL_W}`);
  check(FIVE_GOAL_W < (POST_R - POST_L) / 1.7, "it is meaningfully smaller than an eleven-a-side goal");
  const share = FIVE_GOAL_W / FIVE_PITCH_W;
  check(
    share > 0.12 && share < 0.20,
    `the goal should be 12-20% of the pitch width like real five-a-side and futsal, got ${(share * 100).toFixed(1)}%`,
  );
  check(Math.abs((FIVE_GOAL.x1 + FIVE_GOAL.x2) / 2 - CX) < 1e-9, "the goal is centred");
  check(FIVE_CROSSBAR < 2.44 && FIVE_CROSSBAR >= 2, "the bar is lower than a full goal, at a real futsal height");
}

// ── …and the eleven-a-side game is untouched by that being possible ────
//
// The goal became per-scenario rather than a fixed constant. Every one of the
// engine's own builders sets it to the real goal, so a normal match must be
// byte-identical — this checks the engine really does still use a full-size
// goal when nobody asks for anything else. (The four tuned engine suites —
// finishing, keeperDive, aiming, outcomes — are the real proof; this is the
// direct statement of the property they imply.)
{
  for (const kind of ["one_on_one", "tight_angle", "long_range", "penalty"] as const) {
    const sc = buildScenario(kind, mulberry32(kind.length * 31 + 7));
    check(
      Math.abs(sc.goal.x1 - POST_L) < 1e-9 && Math.abs(sc.goal.x2 - POST_R) < 1e-9,
      `an ordinary ${kind} still has a full-size goal (${sc.goal.x1}..${sc.goal.x2})`,
    );
    check(Math.abs(sc.crossbar - 2.44) < 1e-9, `an ordinary ${kind} still has a full-height bar`);
  }
}

// ── The drag floor matches the engine's own, derived not copied ─────────
{
  // The engine keeps a strikeable ball out of the bottom fifth of the frame
  // so there is room to drag backwards. We build our own scenarios, so we
  // have to apply the same rule — and it must be the SAME rule.
  const engineFloor = FIVE_VIEW.y2 - (FIVE_VIEW.y2 - FIVE_VIEW.y1) * 0.2;
  check(near(KICK_FLOOR_Y, engineFloor), `drag floor ${KICK_FLOOR_Y} should match the engine's ${engineFloor}`);
  check(near(KICK_FLOOR_Y, 29.1), `the floor works out at 29.1 m, got ${KICK_FLOOR_Y}`);
  // It has to leave a real playing area, or every restart is in your own half.
  check(KICK_FLOOR_Y > FIVE_HALFWAY_Y, "there is still room to take a kick in your own half");
  check(KICK_FLOOR_Y < FIVE_PITCH.y2, "…and the floor is genuinely inside the pitch");
}

// ── On the pitch, off the pitch, and which way it went ──────────────────
{
  check(insideFivePitch({ x: CX, y: 18 }), "the centre spot is on the pitch");
  check(insideFivePitch({ x: FIVE_PITCH.x1, y: 0 }), "a corner flag counts as on");
  check(!insideFivePitch({ x: FIVE_PITCH.x1 - 0.5, y: 18 }), "half a metre over the touchline is off");
  check(!insideFivePitch({ x: CX, y: -1 }), "over the goal line is off");

  check(leftPitch({ x: CX, y: 18 }) === null, "a ball in play has not left");
  check(leftPitch({ x: CX, y: -2 }) === "goal-line-theirs", "past their goal line");
  check(leftPitch({ x: CX, y: 40 }) === "goal-line-ours", "past our own goal line");
  check(leftPitch({ x: 10, y: 18 }) === "touchline", "over the touchline");
  // A ball over BOTH near a corner flag is a goal-line ball, not a throw-in.
  check(
    leftPitch({ x: 10, y: -2 }) === "goal-line-theirs",
    "a ball over the goal line near the flag is a goal-line ball, not a touchline one",
  );
}

// ── Mirroring the pitch is exactly reversible ───────────────────────────
{
  // The other side's attacks are handed to the engine mirrored and mirrored
  // back for the screen. If this is not an exact involution, their attacks
  // land in the wrong place — and the drift would be small enough to look
  // like a physics bug rather than a maths one.
  for (let i = 0; i < 2000; i++) {
    const p = {
      x: FIVE_PITCH.x1 + Math.random() * FIVE_PITCH_W,
      y: FIVE_PITCH.y1 + Math.random() * FIVE_PITCH_L,
    };
    const back = mirror(mirror(p));
    check(near(back.x, p.x, 1e-12) && near(back.y, p.y, 1e-12), "mirroring twice returns the same point");
  }
  // A mirrored point is still on the pitch — otherwise their attack starts
  // out of play.
  for (let i = 0; i < 500; i++) {
    const p = {
      x: FIVE_PITCH.x1 + Math.random() * FIVE_PITCH_W,
      y: FIVE_PITCH.y1 + Math.random() * FIVE_PITCH_L,
    };
    check(insideFivePitch(mirror(p)), "a mirrored point is still on the pitch");
  }
  // The two goals swap, which is the whole point of it.
  check(near(mirror({ x: CX, y: 0 }).y, FIVE_PITCH.y2), "their goal mirrors onto ours");
  check(near(mirror({ x: CX, y: FIVE_PITCH.y2 }).y, 0), "and ours onto theirs");
  check(near(mirror({ x: CX, y: 18 }).x, CX), "the centre spot mirrors onto itself");
}

// ── Clamping puts a restart on the pitch and never off it ───────────────
{
  for (const p of [{ x: -50, y: -50 }, { x: 999, y: 999 }, { x: CX, y: 18 }]) {
    const c = clampToPitch(p);
    check(insideFivePitch(c), `clamping ${JSON.stringify(p)} put it on the pitch`);
  }
  const inset = clampToPitch({ x: -50, y: -50 }, 2);
  check(
    inset.x >= FIVE_PITCH.x1 + 2 && inset.y >= FIVE_PITCH.y1 + 2,
    "an inset keeps a restart off the very line",
  );
  const already = { x: CX, y: 18 };
  const untouched = clampToPitch(already);
  check(untouched.x === already.x && untouched.y === already.y, "a point already on the pitch is unchanged");
}

// ════════════════════════════════════════════════════════════════════════
// THE PASSAGE BUILDER — and whether the real engine will actually play it
// ════════════════════════════════════════════════════════════════════════
//
// The scenarios here are built BY HAND rather than by the engine's own
// `buildScenario`, because the whole point of a five-a-side is that the ten
// players are still standing where they were a second ago. The price of that
// is the placement rules `buildScenario` applies privately on its way out —
// they do not come free, and every one of them exists because breaking it
// produces a real bug (a defender standing on the ball is a tackle before you
// have kicked anything; a ball at the very bottom of the frame cannot be
// dragged back from and the shot sticks).
//
// So the second half of this file does two things: checks the picture obeys
// those rules, and then DRIVES IT THROUGH THE REAL ENGINE, headless, a couple
// of thousand times — because a picture that satisfies every rule on paper and
// then makes the engine do something absurd is still wrong.

const CLEAR_OF_BALL = 1.8;
const KEEPER_CLEAR = 0.75 + 1.6;
const DT = 1 / 60;
const GOAL_CX = (POST_L + POST_R) / 2;

const bodies = (sc: import("../../lib/star/canvasEngine").Scenario) => [
  ...sc.defenders.map(d => ({ x: d.x, y: d.y, what: "a defender" })),
  ...sc.secondaryRunners.map(r => ({ ...r.pos, what: "a team-mate" })),
  { x: sc.follower.x, y: sc.follower.y, what: "the poacher" },
];

function randomWorld(rng: () => number): FiveWorld {
  const at = (): { x: number; y: number } => ({
    x: FIVE_PITCH.x1 + rng() * FIVE_PITCH_W,
    y: FIVE_PITCH.y1 + rng() * FIVE_PITCH_L,
  });
  return {
    ball: at(), you: at(),
    mates: [at(), at(), at()],
    yourKeeper: { x: CX + (rng() - 0.5) * 6, y: 34 },
    opps: [at(), at(), at(), at()],
    theirKeeper: { x: CX + (rng() - 0.5) * 6, y: 1 + rng() * 3 },
  };
}

// ── The picture obeys the engine's own placement rules ──────────────────
{
  let worst = 0;
  for (let seed = 1; seed <= 1200; seed++) {
    const rng = mulberry32(seed * 7717);
    const world = randomWorld(rng);
    const sc = buildPassage(world, { keeperStrength: 60, rng });

    check(sc.ball.y <= KICK_FLOOR_Y + 1e-9, `the ball must stay out of the bottom fifth (${sc.ball.y})`);

    for (const b of bodies(sc)) {
      const d = Math.hypot(b.x - sc.ball.x, b.y - sc.ball.y);
      check(d >= CLEAR_OF_BALL - 1e-6, `${b.what} stood ${d.toFixed(2)} m from the ball, inside the engine's own ${CLEAR_OF_BALL}`);
    }

    const kd = Math.hypot(sc.keeper.x - sc.ball.x, sc.keeper.y - sc.ball.y);
    check(kd >= KEEPER_CLEAR - 1e-6, `the keeper stood ${kd.toFixed(2)} m from the ball, inside ${KEEPER_CLEAR}`);
    check(
      sc.keeper.x >= POST_L - 2.5 - 1e-6 && sc.keeper.x <= POST_R + 2.5 + 1e-6,
      `the keeper must stay near his goal (x ${sc.keeper.x})`,
    );

    const youOff = Math.hypot(sc.player.x - sc.ball.x, sc.player.y - sc.ball.y);
    check(youOff > 0.5, "your figure stands beside the ball, not on top of it");
    check(youOff < 3, "…but within touching distance of it");

    // Everybody has to be in shot, or the engine considers them out of play.
    for (const b of [...bodies(sc), { x: sc.player.x, y: sc.player.y, what: "you" }]) {
      check(
        b.x >= FIVE_VIEW.x1 && b.x <= FIVE_VIEW.x2 && b.y >= FIVE_VIEW.y1 && b.y <= FIVE_VIEW.y2,
        `${b.what} was outside the camera frame`,
      );
    }

    // Nobody may be MOVED far to satisfy those rules — that would be the
    // teleport this whole design exists to avoid.
    for (let i = 0; i < 4; i++) {
      worst = Math.max(worst, Math.hypot(sc.defenders[i].x - world.opps[i].x, sc.defenders[i].y - world.opps[i].y));
    }
  }
  check(worst <= CLEAR_OF_BALL + 0.01, `nobody should be shifted more than the spacing rule needs, worst was ${worst.toFixed(2)} m`);
}

// ── Five a side, in the right engine slots ──────────────────────────────
{
  const rng = mulberry32(3);
  const sc = buildPassage(kickOffWorld(true), { keeperStrength: 60, rng });
  check(sc.defenders.length === 4, `four opponents on the pitch, got ${sc.defenders.length}`);
  check(sc.teammates.length === 1, "your own keeper is drawn but is never a pass option");
  check(!!sc.keeper, "their keeper is the real engine keeper");
  check(sc.defenders.length + 1 === 5, "five of theirs");
  // Your three outfield men are cast differently depending on whether the
  // goal is in view — see buildPassage's own note. Either way there are three
  // of them, and with you and your keeper that is five.
  const yourOutfield = sc.secondaryRunners.length + (passLeadsToShot(sc.kind) ? 1 : 0);
  check(yourOutfield === 3, `three outfield men of yours, got ${yourOutfield}`);
  check(1 + yourOutfield + sc.teammates.length === 5, "five of yours");

  // In the final third the poacher is genuinely the furthest forward, not
  // just whoever was listed first — otherwise "poacher" is a label rather
  // than a position.
  const fin = buildPassage({ ...kickOffWorld(true), ball: { x: CX, y: 6 } }, { keeperStrength: 60, rng: mulberry32(3) });
  check(passLeadsToShot(fin.kind), "a ball in the last third is a shooting situation");
  const furthest = Math.min(...kickOffWorld(true).mates.map(m => m.y));
  check(Math.abs(fin.follower.y - furthest) < 0.01, "the poacher is the man nearest their goal");
}

// ── Identities land on the right figures ────────────────────────────────
{
  const id = (n: string) => ({ id: n, name: n, shortName: n, overall: 70 } as import("../../lib/star/canvasEngine").Identity);
  const cast = {
    you: id("You"),
    mates: [id("M0"), id("M1"), id("M2")],
    yourKeeper: id("MyGK"),
    opps: [id("O0"), id("O1"), id("O2"), id("O3")],
    theirKeeper: id("TheirGK"),
  };
  const sc = buildPassage(kickOffWorld(true), { keeperStrength: 60, rng: mulberry32(5), cast });

  check(sc.keeper.who?.name === "TheirGK", "their keeper is who we said");
  check(sc.teammates[0].who?.name === "MyGK", "your keeper is who we said");
  const oppNames = sc.defenders.map(d => d.who?.name).sort().join(",");
  check(oppNames === "O0,O1,O2,O3", `all four opponents are real people, got ${oppNames}`);
  // Whoever is actually live this passage must be somebody. In a midfield
  // passage the follower is a shadow the engine ignores, so he is not counted.
  const live = passLeadsToShot(sc.kind)
    ? [...sc.secondaryRunners.map(r => r.who?.name), sc.follower.who?.name]
    : sc.secondaryRunners.map(r => r.who?.name);
  const mine = [...new Set(live)].sort().join(",");
  check(mine === "M0,M1,M2", `all three of your outfield men are real people, got ${mine}`);
  // Your keeper must never be able to take credit for your work — the engine
  // treats teammates[0] as the crosser, which is why this cast is built here
  // rather than through the engine's own castScenario.
  check(sc.crosser === undefined, "nobody is pre-assigned the assist");
}

// ── A pass is a pass in your own half, and a shot near their goal ───────
{
  check(kindForBall({ x: CX, y: 30 }) === "midfield_pass", "deep in your own half it is a pass");
  check(!passLeadsToShot(kindForBall({ x: CX, y: 30 })), "…and your man does not shoot from there");
  check(kindForBall({ x: CX, y: 20 }) === "midfield_pass", "just inside your own half it is still a pass");
  check(passLeadsToShot(kindForBall({ x: CX, y: 6 })), "in the last third, the man you find shoots");
  check(kindForBall({ x: CX, y: 5 }) === "one_on_one", "central and close is a chance");
  check(kindForBall({ x: FIVE_PITCH.x1 + 1, y: 5 }) === "tight_angle", "out by the touchline it is a tight angle");
}

// ── NOW DRIVE IT THROUGH THE REAL ENGINE ────────────────────────────────
//
// The point of everything above is that the engine will play these pictures
// honestly. The only way to know that is to hand it a couple of thousand of
// them and watch what comes back.
{
  // The engine's real `Outcome` union, read off the type rather than
  // remembered — the first version of this list was written from memory and
  // missed "caught" and "rebound", which the engine returns constantly.
  const OUTCOMES = new Set<string>([
    "goal", "rebound", "delivered", "saved", "caught", "tipped",
    "over", "post", "wide", "blocked", "out", "short", "offside",
    "tackled", "touchOn",
  ]);

  // A five-a-side has no offside, and the engine's rule is ON by default —
  // the first run of this test returned "offside" for real, which is the
  // proof that switching it off is a genuine requirement of the component and
  // not a precaution. Restored afterwards, because it is module-level state
  // shared with every real match.
  setOffsideRuleEnabled(false);

  let resolved = 0, ranOn = 0, goals = 0, instantLoss = 0;
  let intercepted = 0;
  const seen = new Set<string>();

  for (let seed = 1; seed <= 1400; seed++) {
    const rng = mulberry32(seed * 104729);
    const world = randomWorld(rng);
    // Put the ball somewhere a shot is actually on, so this measures the
    // engine playing football rather than measuring hopeless angles.
    world.ball = { x: CX + (rng() - 0.5) * 12, y: 5 + rng() * 12 };
    const sc = buildPassage(world, { keeperStrength: 45 + rng() * 30, rng });
    initDefenders(sc, rng);

    // Aim for a corner OF THE GOAL THAT IS ACTUALLY THERE, the way somebody
    // who knows what they are doing would. Aiming at a full-size goal's
    // corners scored 6.9% against the small goal — which is the small goal
    // working, not a bug, but it made this measure the wrong thing.
    const side = rng() < 0.5 ? -1 : 1;
    const half = (sc.goal.x2 - sc.goal.x1) / 2;
    const tx = GOAL_CX + side * Math.max(0.2, half - 0.35) * (0.55 + rng() * 0.45);
    const dir = { x: tx - sc.ball.x + (rng() - 0.5) * 1.2, y: -Math.max(sc.ball.y, 1) };
    const power = Math.min(1, 0.42 + Math.hypot(sc.ball.x - GOAL_CX, sc.ball.y) / 40) * (0.85 + rng() * 0.3);

    const ball = launch(sc, dir, power,
      { cx: (rng() - 0.5) * 0.8, cy: -0.1 - rng() * 0.45 },
      { power: 55 + rng() * 25, technique: 55 + rng() * 25 }, rng);

    let out: string | null = null;
    let steps = 0;
    for (; steps < 2000 && !out; steps++) {
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
    }

    if (!out) { ranOn++; continue; }
    resolved++;
    seen.add(out);
    check(OUTCOMES.has(out), `the engine returned an outcome we do not know about: ${out}`);
    if (out === "goal") goals++;
    // The bug worth catching is a picture that LOSES the ball on the very
    // first step — somebody standing close enough to take it before the kick
    // has travelled. (An instant "delivered" is not that: it is your own man
    // two metres away receiving a short pass, which is real football and is
    // why your men stand a little further off the ball than the engine's own
    // minimum. That distinction cost a measurement to find.)
    if (steps <= 1 && (out === "tackled" || out === "blocked")) instantLoss++;
  }

  check(ranOn === 0, `every passage should resolve, ${ranOn} ran past the step cap`);
  check(instantLoss === 0, `no passage should lose the ball before the kick has travelled, ${instantLoss} did`);
  const rate = goals / Math.max(1, resolved);
  check(
    rate > 0.15 && rate < 0.75,
    `a well-aimed shot from the last third should score sometimes and not always, scored ${(rate * 100).toFixed(1)}%`,
  );
  // Offside has no place in a five-a-side and must never come back.
  check(!seen.has("offside"), "offside should never be returned in a five-a-side");
  check(seen.size >= 4, `the engine should produce a real variety of outcomes, saw ${[...seen].join("/")}`);
  setOffsideRuleEnabled(true);
}

// ── Can a pass in your own half actually reach anybody? ─────────────────
//
// The engine normally clears a body out of the passing lane before a
// build-up starts (`clearThePassingLane`) — its own note records why: without
// it, "a man inside 1.5 m of the lane in 62% of build-ups… Half of every
// ambitious ball was cut out by somebody the builder had put there." We build
// our own pictures, so we do not get that for free, and our pitch is a third
// as wide with four defenders on it. Whether that is actually a problem is a
// question to MEASURE rather than reason about.
{
  setOffsideRuleEnabled(false);
  let completed = 0, lost = 0;
  for (let seed = 1; seed <= 800; seed++) {
    const rng = mulberry32(seed * 6151);
    const world = randomWorld(rng);
    world.ball = { x: CX + (rng() - 0.5) * 14, y: 20 + rng() * 8 };   // your own half
    const sc = buildPassage(world, { keeperStrength: 60, rng });
    check(!passLeadsToShot(sc.kind), "a ball in your own half is a pass, not a shot");
    initDefenders(sc, rng);

    const t = sc.secondaryRunners[0]?.pos;
    if (!t) continue;
    const dir = { x: t.x - sc.ball.x, y: t.y - sc.ball.y };
    const power = Math.min(0.95, 0.2 + Math.hypot(dir.x, dir.y) / 32);
    const ball = launch(sc, dir, power, { cx: 0, cy: -0.2 },
      { power: 60, technique: 60 }, rng);

    let out: string | null = null;
    for (let i = 0; i < 2000 && !out; i++) {
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
    }
    if (out === "delivered") completed++;
    if (out === "blocked" || out === "tackled") lost++;
  }
  const rate = completed / Math.max(1, completed + lost);
  check(
    rate > 0.45,
    `a pass in your own half must be able to find a man more often than not — `
    + `only ${(rate * 100).toFixed(1)}% got there (${completed} completed, ${lost} cut out). `
    + `If this fails, the passing lane needs clearing the way buildScenario does it.`,
  );
  setOffsideRuleEnabled(true);
}

// ── All three of your outfield men are real, in every kind ──────────────
//
// The engine gates its `follower` on whether the goal is in view: in a
// midfield passage he is not a pass candidate, not clamped into the frame and
// not drawn. Cast naively, half of all play would have been four v five with
// one of your men inert. This is the regression test for that.
{
  for (const [where, ballY] of [["your own half", 26], ["the last third", 6]] as const) {
    const rng = mulberry32(4242);
    const world = kickOffWorld(true);
    world.ball = { x: CX, y: ballY };
    world.mates = [{ x: CX - 6, y: ballY - 4 }, { x: CX + 6, y: ballY - 4 }, { x: CX, y: Math.max(2, ballY - 10) }];
    const sc = buildPassage(world, { keeperStrength: 60, rng });

    // However he is cast, every one of your three outfield men must be
    // somewhere the engine will actually use him.
    const asRunners = sc.secondaryRunners.length;
    const asPoacher = passLeadsToShot(sc.kind) ? 1 : 0;
    check(
      asRunners + asPoacher === 3,
      `in ${where} all three of your outfield men must be live, got ${asRunners} runners + ${asPoacher} poacher`,
    );
    if (!passLeadsToShot(sc.kind)) {
      check(sc.secondaryRunners.length === 3, `in ${where} all three must be pass options`);
    }
  }
}

// ── The ambition signal is alive ────────────────────────────────────────
//
// `forwardMostY` is set only by the engine's own builder. Left undefined, the
// engine pins `passAmbition` to zero forever — and the five-a-side's scoring
// reads it, so half the "how good was that pass" signal would be silently
// dead with nothing on screen to show it.
{
  const rng = mulberry32(11);
  const sc = buildPassage(kickOffWorld(true), { keeperStrength: 60, rng });
  check(sc.forwardMostY !== undefined, "the most advanced option is recorded, or pass ambition is dead");
  const ys = sc.secondaryRunners.map(r => r.pos.y);
  check(
    Math.abs(sc.forwardMostY! - Math.min(...ys)) < 1e-9,
    "…and it is genuinely the most advanced option",
  );
}

// ── Nobody teleports between touches ────────────────────────────────────
{
  // The real test of continuity: play a passage, read the world back out, and
  // check everybody is roughly where the engine left them rather than being
  // re-invented.
  const rng = mulberry32(90210);
  let world = kickOffWorld(true);
  for (let touch = 0; touch < 12; touch++) {
    const before = JSON.parse(JSON.stringify(world)) as FiveWorld;
    const sc = buildPassage(world, { keeperStrength: 60, rng });
    initDefenders(sc, rng);
    const ball = launch(sc, { x: 0.5, y: -8 }, 0.5,
      { cx: 0, cy: -0.3 }, { power: 60, technique: 60 }, rng);
    let out: string | null = null;
    for (let i = 0; i < 2000 && !out; i++) {
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      out = stepBall(ball, sc, rng, DT);
    }
    world = worldFromScenario(sc, ball.pos, before);

    for (const [i, m] of world.mates.entries()) {
      const moved = Math.hypot(m.x - before.mates[i].x, m.y - before.mates[i].y);
      check(moved < 30, `team-mate ${i} moved ${moved.toFixed(1)} m in one passage — that is a teleport, not a run`);
    }
    for (const [i, o] of world.opps.entries()) {
      const moved = Math.hypot(o.x - before.opps[i].x, o.y - before.opps[i].y);
      check(moved < 30, `opponent ${i} moved ${moved.toFixed(1)} m in one passage`);
    }
    check(insideFivePitch(world.ball), "the ball is put back on the pitch for the next touch");
    for (const m of world.mates) check(insideFivePitch(m), "every team-mate stays on the pitch");
    for (const o of world.opps) check(insideFivePitch(o), "every opponent stays on the pitch");
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the pitch fits the engine's own frame, and the engine really plays our hand-built passages");
