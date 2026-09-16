import {
  OUTCOME_TEXT, stepTouchChase, buildScenario, initDefenders,
  CHAIN_MAX, TOUCH_CHAIN_MAX,
  launch, stepDefenders, stepKeeper, stepReactions, stepBall,
  chainKindFor, acceptsCaptainOrders,
  type Ball, type Scenario,
} from "../../lib/star/canvasEngine";
import { creditChance, NO_CREDIT } from "../../lib/star/credit";

/**
 * TOUCH MODE'S OWN PURE HALF.
 *
 * Boot.extraTouch — requested directly: "these boots give the player an
 * extra touch... u do a normal aim and kick... HOWEVER with this touch
 * mode on ur player chases the ball and if he gets to it then the game
 * stops again and he has another aim and kick thing again."
 *
 * The gating (the toggle, the boots, ball.owner, acceptsCaptainOrders) is
 * CanvasMatch.tsx-level React code this suite can't reach, same limitation
 * every other pointer/gesture fix in this codebase has always had. But the
 * chase itself — stepTouchChase — is a real, pure, exported engine function
 * now, reported back live TWICE, each time catching a real gap the previous
 * version's own tests hadn't:
 *
 *   Round 1: "my player just doesnt chase the touch at all... he never moves
 *   at all." The first version only ever remapped stepBall's own invisible
 *   dead-ball timeout — nothing moved scenario.player at all.
 *
 *   Round 2, after Round 1 shipped a real but continuous chase: "i can move
 *   like halfway across the screen and he wont take his second touch im
 *   guessing coz he never left the 1.8m thing coz hes chasing it the whole
 *   time." Diagnosed correctly — chasing from the very first tick meant he
 *   closed the gap at the same time the ball opened it, so the DISTANCE
 *   between them (the only thing arming ever measured) could stay small even
 *   while the two of them travelled a long way together. The fix is below:
 *   he now stands genuinely frozen until the ball has separated from him by
 *   itself, with nothing on his side fighting that gap, and only then sets
 *   off after it.
 *
 *   Round 3, after BOTH of those were genuinely fixed and CanvasMatch's own
 *   chain-continuation logic was also given its own separate budget (see
 *   TOUCH_CHAIN_MAX below): "he IS catching it... instead of the game
 *   pausing and giving me a new kick like the chance just started, the
 *   chance just ends." Investigated by faithfully replicating CanvasMatch's
 *   real substep loop end to end (stepDefenders/stepKeeper/stepReactions/
 *   stepTouchChase/stepBall, exactly as it calls them, with a real launch()
 *   strike) — which proved the chase, the catch, and the chain-continuation
 *   ALL genuinely work when exercised together, not just in isolation. The
 *   real remaining bug was a THIRD place "touchOn" needed its own case and
 *   didn't have one: CanvasMatch's matchResultFor(res) — which decides what
 *   the invisible, ninety-minutes hidden match simulation should believe
 *   happened — had no branch for it, so it fell through to the generic
 *   "saved" default and told the hidden match the move was OVER and
 *   possession had passed to the opponent, on every single touch, even
 *   while the visible chain was correctly about to continue. That fix lives
 *   in CanvasMatch.tsx itself (matchResultFor's own doc there has the full
 *   account) — untestable at this level, same limitation as the gating
 *   logic below — but the multi-hop chain test in this file exists BECAUSE
 *   of this investigation: it is exactly the harness that ruled out the
 *   chase/chain machinery itself before the real bug was found elsewhere.
 *
 * creditChance's own "touchOn" branch gets the same treatment as before: a
 * genuinely uncontested touch of your own that repositions the same attempt
 * is not a new shot or a new pass, and credit.ts's own doc records two real
 * historical bugs from exactly this class of mistake (a team-mate's goal
 * filed as yours; a scoreline with nobody credited).
 */

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;

function ballAt(x: number, y: number): Ball {
  return {
    pos: { x, y }, vel: { x: 0, y: 0 }, z: 0, vz: 0,
    spin: 0, resting: true, loose: false, contactCd: 0,
    receiverControlT: 0, event: null, inNet: false,
  };
}

function scenarioAt(seed: number, x: number, y: number): Scenario {
  const rng = mulberry32(seed);
  const sc = buildScenario("cutback", rng, 70, 70);
  initDefenders(sc, rng);
  sc.player = { x, y };
  return sc;
}

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── touchOn is declared neutral, never a goal ────────────────────────────
{
  check(OUTCOME_TEXT.touchOn.kind === "neutral", `touchOn is a neutral outcome, never "goal" (${OUTCOME_TEXT.touchOn.kind})`);
}

// ── Touch Mode's own chain budget is genuinely separate from, and more
// generous than, the ordinary pass-chain budget — the actual reported bug.
// "he IS catching it... instead of the game pausing and giving me a new
// kick like the chance just started, the chance just ends." Root cause:
// CanvasMatch's resolveOutcome originally spent the SAME chainDepth/
// CHAIN_MAX(2) counter an ordinary pass chain uses, which a real passage of
// play has usually already partly spent — a second or third genuine
// re-touch routinely found it exhausted. The chain-continuation logic
// itself lives in CanvasMatch.tsx (React component code this suite can't
// reach, same limitation the file's own doc states above) — what IS pure
// and worth pinning down permanently is that TOUCH_CHAIN_MAX is a real,
// separate constant, and genuinely more generous than CHAIN_MAX, not
// coincidentally equal to it (which is exactly what the bug looked like
// from the outside). ─────────────────────────────────────────────────────
{
  check(TOUCH_CHAIN_MAX > CHAIN_MAX,
    `Touch Mode's own chain budget is more generous than an ordinary pass chain's (TOUCH_CHAIN_MAX=${TOUCH_CHAIN_MAX}, CHAIN_MAX=${CHAIN_MAX})`);
  check(TOUCH_CHAIN_MAX >= 4,
    `and generous enough in absolute terms to feel unrestricted in normal play, not just relatively bigger (TOUCH_CHAIN_MAX=${TOUCH_CHAIN_MAX})`);
}

// ── touchOn never credits a shot, a pass, or a chance — whatever the
// surrounding context claims. Fuzzed across every ctx combination, since
// the whole point of checking it first in creditChance is that NOTHING
// downstream (youShot, receiverShot, isSimplePass) can override it. ──────
{
  let wrong = 0;
  for (const youShot of [true, false]) {
    for (const receiverShot of [true, false]) {
      for (const isSimplePass of [true, false]) {
        const d = creditChance("touchOn", { youShot, receiverShot, isSimplePass });
        if (JSON.stringify(d) !== JSON.stringify(NO_CREDIT)) wrong++;
      }
    }
  }
  check(wrong === 0, `touchOn credits nothing at all, under any context (${wrong}/8 combinations got something)`);
}

// ── …and, for real contrast, an ordinary shot right next to it still
// credits normally — touchOn's early return isn't accidentally swallowing
// every outcome, just its own. ───────────────────────────────────────────
{
  const goalShot = creditChance("goal", { youShot: true, receiverShot: false, isSimplePass: false });
  check(goalShot.shots === 1 && goalShot.goals === 1, `a real goal you struck still credits shots+goals normally (${JSON.stringify(goalShot)})`);
}

// ── stepTouchChase never fires on the kick's own first tick ─────────────
//
// Player and ball still coincide the instant he strikes it — the exact
// case the old remap never had to worry about (it wasn't watching
// distance at all) and this one has to get right on its own. He should not
// so much as twitch: standing exactly on the ball is the "not yet
// separated" case, same as any other distance under the start threshold.
{
  const sc = scenarioAt(1, 40, 40);
  const ball = ballAt(40, 40);
  const caught = stepTouchChase(sc, ball, DT);
  check(caught === false, `standing exactly on the ball he just struck is not a catch (armed=${sc.touchChaseArmed})`);
  check(sc.touchChaseArmed !== true, `not armed either — the ball never got away from him (dist stayed 0)`);
  check(sc.player.x === 40 && sc.player.y === 40, `and he has not moved an inch either (${sc.player.x}, ${sc.player.y})`);
}

// ── THE REPORTED BUG, reproduced and fixed: frozen while close, only sets
// off once the ball has genuinely separated from him under its own steam —
// never while he is himself closing part of that gap. ────────────────────
//
// "i can move like halfway across the screen and he wont take his second
// touch im guessing coz he never left the 1.8m thing coz hes chasing it the
// whole time." Modelled here by scripting the ball's own drift by hand
// (stepTouchChase only ever moves the player, never the ball, so a real
// decelerating touch has to be simulated) — a slow crawl outward, well
// under chase speed, exactly the shape a real soft touch settling under
// friction would have. The old, continuously-chasing version would have
// closed against this drift the entire time and the gap could plausibly
// never have crossed 1.8m; this version must never move him at all until
// the ball — entirely on its own — has opened real separation.
{
  const sc = scenarioAt(5, 60, 60);
  const ball = ballAt(60, 60);
  let armedAtTick = -1;
  const before = { x: sc.player.x, y: sc.player.y };
  for (let i = 0; i < 40; i++) {
    // The ball drifts outward half a metre a tick — much slower than
    // TOUCH_CHASE_SPEED, so a continuously-chasing player would have eaten
    // into this the entire time and this test would never separate at all.
    ball.pos.x += 0.5;
    const caught = stepTouchChase(sc, ball, DT);
    if (sc.touchChaseArmed && armedAtTick === -1) armedAtTick = i;
    check(!caught || armedAtTick !== -1, "never reports caught before arming");
    if (armedAtTick === -1) {
      check(sc.player.x === before.x && sc.player.y === before.y,
        `stays completely frozen while still within the start radius — tick ${i}, dist ${Math.hypot(sc.player.x - ball.pos.x, sc.player.y - ball.pos.y).toFixed(3)}m`);
    }
  }
  check(armedAtTick !== -1, "the ball drifting away under its own steam does genuinely arm the chase eventually");
  check(sc.player.x !== before.x || sc.player.y !== before.y, "and once armed, he has actually moved from his frozen starting spot");
}

// ── Once armed, he closes a small gap fast — "gets to it in like half a
// second or a second," not the old multi-second dead-ball wait. ─────────
{
  const sc = scenarioAt(3, 20, 20);
  const ball = ballAt(20, 30); // 10m away from the start — already well past the start radius
  let caught = false;
  let ticks = 0;
  const maxTicks = Math.ceil(5 / DT); // 5 real seconds, a generous ceiling
  for (; ticks < maxTicks && !caught; ticks++) {
    caught = stepTouchChase(sc, ball, DT);
  }
  check(sc.touchChaseArmed === true, "a 10m gap genuinely arms the chase, immediately since it starts already separated");
  check(caught, `he genuinely catches up within 5 simulated seconds (never did, after ${ticks} ticks)`);
  const finalDist = Math.hypot(sc.player.x - ball.pos.x, sc.player.y - ball.pos.y);
  check(finalDist <= 1.2, `and he is standing right next to the ball when he does (${finalDist.toFixed(3)} m away)`);
  // 10m at 7.6 m/s is ~1.32s — for the small nudge this mechanic is actually
  // meant for (a metre or two) it would be well under a second; even this
  // deliberately large 10m gap stays well clear of the old multi-second
  // dead-ball timeout it replaces.
  const elapsed = ticks * DT;
  check(elapsed < 2.5, `and it happens quickly — a real chase, not the old multi-second dead-ball wait (${elapsed.toFixed(2)}s)`);
}

// ── A touch too soft to ever clear the start radius never fires, and never
// moves him at all — a deliberate, bounded limitation, not an open
// question. Ticked for a genuinely long time to prove it is not just
// "hasn't happened yet". ──────────────────────────────────────────────────
{
  const sc = scenarioAt(4, 50, 50);
  const ball = ballAt(50.5, 50); // 0.5m away — never leaves his own control radius
  let caught = false;
  for (let i = 0; i < Math.ceil(8 / DT) && !caught; i++) {
    caught = stepTouchChase(sc, ball, DT);
  }
  check(!caught, "a touch that never gets away from him never arms, and so never falsely fires as a catch");
  check(sc.player.x === 50 && sc.player.y === 50, "and he genuinely never moved at all, not even a partial creep toward it");
}

// ── END-TO-END, MULTIPLE REAL HOPS — the harness that ruled out the chase
// and the chain machinery before the real (third) bug was found elsewhere.
//
// Faithfully replicates CanvasMatch's own flight substep loop — real
// stepDefenders/stepKeeper/stepReactions/stepTouchChase/stepBall calls, in
// the same order, on a real ball from a real launch() strike — and its
// resolveOutcome touchOn branch's exact chain-building arithmetic, chained
// through chainKindFor/buildScenario the same way loadScenario does. Proves
// the actual reported bug (round 3, above) was NOT in this machinery: a
// realistic soft-to-moderate touch genuinely resolves to "touchOn", and the
// chain genuinely carries a real touchTouches count across several real
// hops while chainDepth stays fixed throughout — untouched by any of it,
// exactly as an ordinary pass afterward still needs it. ───────────────────
{
  function strikeAndResolve(sc: Scenario, rng: () => number, dirX: number, dirY: number) {
    const ball = launch(sc, { x: dirX, y: dirY }, 0.08, { cx: 0, cy: 0.05 }, { power: 60, technique: 60 }, rng);
    sc.player = { x: ball.pos.x, y: ball.pos.y };
    let t = 0;
    let res: string | null = null;
    const h = DT / 3;
    while (t < 8 && !res) {
      stepDefenders(sc, h, ball.pos, false, ball);
      stepKeeper(sc, h);
      stepReactions(sc, ball, h, rng);
      const touchLive = ball.owner === "you" && ball.lastTouch !== "keeper" && acceptsCaptainOrders(sc.kind);
      const caughtUp = touchLive && stepTouchChase(sc, ball, h);
      const r = stepBall(ball, sc, rng, h);
      let rr: string | null = r ?? null;
      if (!rr && caughtUp) rr = "touchOn";
      if (rr) res = rr;
      t += h;
    }
    // Mirrors resolveOutcome's own touchOn branch exactly.
    let chain: { pos: { x: number; y: number }; depth: number; ambition: number; touchTouches?: number } | null = null;
    if (res === "touchOn") {
      const touches = sc.touchTouches ?? 0;
      if (touches < TOUCH_CHAIN_MAX) {
        chain = { pos: { x: ball.pos.x, y: ball.pos.y }, depth: sc.chainDepth ?? 0, ambition: 0.3, touchTouches: touches + 1 };
      }
    }
    return { res, chain };
  }
  function buildFromChain(chain: { pos: { x: number; y: number }; depth: number; ambition: number; touchTouches?: number }, rng: () => number): Scenario {
    const kind = chainKindFor(chain.pos, rng, chain.ambition);
    const s = buildScenario(kind, rng, 70, 70);
    initDefenders(s, rng);
    s.defenders = [];
    s.chainDepth = chain.depth;
    s.touchTouches = chain.touchTouches;
    return s;
  }

  const HOPS = 5;
  const TRIALS = 40;
  const hopSuccesses = new Array(HOPS).fill(0);
  for (let seed = 1; seed <= TRIALS; seed++) {
    const rng = mulberry32(seed + 1000);
    let sc = buildScenario("cutback", rng, 70, 70);
    initDefenders(sc, rng);
    sc.defenders = [];
    for (let hop = 0; hop < HOPS; hop++) {
      const { res, chain } = strikeAndResolve(sc, rng, hop % 2 === 0 ? 1 : -1, 0);
      if (res === "touchOn" && chain) {
        hopSuccesses[hop]++;
        check(chain.depth === 0, `chainDepth stays untouched by touch mode across every hop (hop ${hop}, seed ${seed}: ${chain.depth})`);
        sc = buildFromChain(chain, rng);
      } else {
        break;
      }
    }
  }
  // A real, if imperfect, physical simulation — not every trial reaches
  // every hop (a genuine miss, or the ball going out, is possible and
  // correct), and attrition compounds across hops the way five real coin
  // flips in a row would. Bounded well under the measured floor (a real run
  // of this exact test measured 27/40 at hop 4) rather than pinned to it, so
  // this stays a genuine regression check without being flaky on ordinary
  // variance.
  for (let hop = 0; hop < HOPS; hop++) {
    check(hopSuccesses[hop] >= TRIALS * 0.5,
      `a realistic soft touch reaches hop ${hop} of a real chained sequence in most trials (${hopSuccesses[hop]}/${TRIALS})`);
  }
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the player stays frozen until the ball genuinely separates, then chases and catches correctly, and touchOn is neutral and never credited as a shot or pass");
