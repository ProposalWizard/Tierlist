import {
  attackingShape, structureFor, ATTACK_ROLES, type AttackRole,
} from "../../lib/star/fiveASide/attack";
import { playOn, newFlow, flowAfterTouch } from "../../lib/star/fiveASide/flow";
import { buildPassage, kickOffWorld } from "../../lib/star/fiveASide/passage";
import { FIVE_A_SIDE } from "../../lib/star/fiveASide/rules";
import { FIVE_KEEPER_STRENGTH, insideFivePitch } from "../../lib/star/fiveASide/geometry";
import { initDefenders, setOffsideRuleEnabled, type Scenario, type Vec2 } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";

/**
 * AN ATTACK THAT STRETCHES THE PITCH.
 *
 * The defending half of this was `fiveASideShape.mts` last week. This is the
 * other half, and it had the same disease from the same cause — `slotsFor`'s
 * `lean` was a fixed point at zero, so the ball, and therefore all four of
 * your men, collapsed into the middle of the pitch from any kick-off.
 *
 * What is checked here is not that the attack is GOOD — that is the wrong
 * target — but that the picture is an attack: that the four men are doing four
 * different jobs, that two of them are genuinely on the flanks, that the man
 * furthest forward is a central striker rather than whoever drifted highest,
 * and that the ball actually gets out of the middle of the pitch.
 *
 * The numbers each check is set against were measured on the version this
 * replaced, over 250 real matches and ~14,000 beats of real football:
 *
 *                                              before     after
 *   your four's spread across a 24 m pitch     1.35 m     4.08 m
 *   the two furthest apart of them             3.45 m    10.72 m
 *   nearest two of them to each other          1.65 m     4.31 m
 *   how many of the four are out on a flank    0.20 of 4  1.64 of 4
 *   mean |lean| — how far off centre the
 *     ball ever gets, 0 = dead centre          0.157      0.400
 *
 * The ball's MEDIAN x is deliberately not one of the checks, and that is worth
 * saying rather than leaving as a gap: it was 34.0 on a pitch running 22 to 46
 * and it still is, because an attack that works the ball down BOTH flanks is
 * symmetric and the median of a symmetric thing is its middle whatever its
 * spread. The honest statistic for "has the ball escaped the centre" is how
 * far off it typically is, which is the mean |lean| above, and it has more
 * than doubled.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const R = FIVE_A_SIDE;
const CXP = (R.pitch.x1 + R.pitch.x2) / 2;
const L = R.pitch.y2 - R.pitch.y1;
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

// ── The four slots are four different jobs ──────────────────────────────
{
  check(ATTACK_ROLES.length === 4, "four attackers, four jobs");
  check(new Set(ATTACK_ROLES).size === 4, "…and no two of them are the same job");

  // A ball in the attacking third, on the right, against a back four sitting
  // in front of their own goal.
  const ball: Vec2 = { x: CXP + 5, y: 10 };
  const defenders: Vec2[] = [
    { x: CXP - 3, y: 5 }, { x: CXP + 1, y: 4 },
    { x: CXP + 4, y: 7 }, { x: CXP - 6, y: 8 },
  ];
  const sh = attackingShape(R, 10, ball, defenders);
  const at = (r: AttackRole) => sh.slots[sh.roles.indexOf(r)];

  check(sh.slots.length === 4, `four slots, got ${sh.slots.length}`);
  check(
    sh.slots.every(s => insideFivePitch(s)),
    `every attacker is on the pitch: ${JSON.stringify(sh.slots)}`,
  );
  check(sh.structure === "1-2-1", `the attacking third is a diamond, got ${sh.structure}`);

  // THE WHOLE POINT. The two wide men are on OPPOSITE flanks and both of them
  // are genuinely wide — this is the check the old shape failed, where all
  // four men stood inside a metre and a half of the centre line.
  const near = at("wideNear"), far = at("wideFar");
  check(
    near.x - CXP > 3.5,
    `the near-side wide man hugs his touchline — he is ${(near.x - CXP).toFixed(2)} m off centre`,
  );
  check(
    CXP - far.x > 3.5,
    `…and the far-side one hugs the other — he is ${(CXP - far.x).toFixed(2)} m off centre`,
  );
  check(
    Math.abs(near.x - far.x) > 8,
    `…so the two of them stretch the pitch between them (${Math.abs(near.x - far.x).toFixed(2)} m, `
    + "and the whole attack used to span 3.45 m)",
  );

  // The pivot is the man furthest forward, and he is a CENTRAL player: the
  // chance is eventually taken by him, and a striker on a touchline cannot
  // score. (`PIVOT_MAX_OFF` is 4.5 m; the relaxation may add a little.)
  const pivot = at("pivot"), hold = at("hold");
  check(
    sh.slots.every(s => s === pivot || s.y >= pivot.y),
    `the pivot is the furthest man forward, at y=${pivot.y.toFixed(2)}`,
  );
  check(
    Math.abs(pivot.x - CXP) < 5.5,
    `…and he is a central player, ${Math.abs(pivot.x - CXP).toFixed(2)} m off centre`,
  );

  // The holding man is behind the ball, which is what makes him an out-ball.
  check(hold.y > ball.y, `the holding man is behind the ball (${hold.y.toFixed(2)} v ${ball.y.toFixed(2)})`);
  check(
    sh.slots.every(s => s === hold || s.y <= hold.y),
    `…and is the deepest of the four, at y=${hold.y.toFixed(2)}`,
  );

  // The shape flips with the flank, rather than decaying toward the middle:
  // the whole fix is that which side the move is on is a SIGN, not a fraction.
  const left = attackingShape(R, 10, { x: CXP - 5, y: 10 }, defenders);
  const lNear = left.slots[left.roles.indexOf("wideNear")];
  check(
    lNear.x < CXP - 3.5,
    `a ball on the left puts the near-side wide man on the left (${lNear.x.toFixed(2)} v centre ${CXP})`,
  );
  // …and a ball only just off centre leans just as far as one out wide. This
  // is the fixed point being gone, stated as a test: under the old shape the
  // lean was proportional, so a ball 0.3 m off centre produced a shape 0.3 m
  // off centre, which produced a ball closer still.
  const barely = attackingShape(R, 10, { x: CXP + 0.3, y: 10 }, defenders);
  const bNear = barely.slots[barely.roles.indexOf("wideNear")];
  check(
    bNear.x - CXP > 3.5,
    `a ball barely off centre still gets a full-width shape (${(bNear.x - CXP).toFixed(2)} m) — `
    + "this is the fixed point at zero that the old `lean` could never escape",
  );
}

// ── The structure rotates with the third you are in ─────────────────────
{
  check(structureFor(R, L * 0.88) === "2-2", "building out of your own box is a 2-2");
  check(structureFor(R, L * 0.72) === "2-2", "…and so is your own defensive third");
  check(structureFor(R, L * 0.50) === "1-2-1", "the middle third is a diamond");
  check(structureFor(R, L * 0.12) === "1-2-1", "…and so is their box");

  // The 2-2 really is two banks of two rather than the same diamond renamed.
  // Their four pressing you high, which is what a side does when you are
  // playing out of your own box.
  const deep = attackingShape(R, L * 0.88, { x: CXP + 4, y: L * 0.88 }, [
    { x: CXP, y: L * 0.70 }, { x: CXP + 5, y: L * 0.78 },
    { x: CXP - 5, y: L * 0.78 }, { x: CXP, y: L * 0.62 },
  ]);
  check(deep.structure === "2-2", `deep in your own half is a 2-2, got ${deep.structure}`);
  // What actually makes it a 2-2 rather than a diamond is that the deepest man
  // HAS A PARTNER: two men available to receive, at the same sort of depth,
  // which is what playing out of your own box needs. In the 1-2-1 the holding
  // man is alone behind the ball, and the same measurement says so — which is
  // the contrast checked here, rather than a bank-spacing rule the shape would
  // then have to be bent to satisfy.
  const pairing = (sh: { slots: Vec2[] }) => {
    const y = sh.slots.map(s => s.y).sort((a, b) => a - b);
    return { backPair: y[3] - y[2], toTheThird: y[2] - y[1], y };
  };
  const d = pairing(deep);
  check(
    d.backPair < d.toTheThird,
    `…and the deepest man has a partner at his own depth (${d.backPair.toFixed(1)} m apart, `
    + `against ${d.toTheThird.toFixed(1)} m to the next man up): depths `
    + `${d.y.map(v => v.toFixed(1)).join(", ")}`,
  );
  const diamond = pairing(attackingShape(R, 10, { x: CXP + 5, y: 10 }, [
    { x: CXP - 3, y: 5 }, { x: CXP + 1, y: 4 }, { x: CXP + 4, y: 7 }, { x: CXP - 6, y: 8 },
  ]));
  check(
    diamond.backPair > diamond.toTheThird,
    `…where in a 1-2-1 he is alone behind the ball (${diamond.backPair.toFixed(1)} m to the next `
    + `man, against ${diamond.toTheThird.toFixed(1)} m between the two ahead of him)`,
  );
}

// ── The ball is never given to you, and it does not stay where it is ────
{
  let stayed = 0, yoursWasCarrier = 0, n = 0;
  const rng = mulberry32(99);
  for (let i = 0; i < 2000; i++) {
    const ball: Vec2 = {
      x: R.pitch.x1 + rng() * (R.pitch.x2 - R.pitch.x1),
      y: R.pitch.y1 + rng() * L,
    };
    const defenders = Array.from({ length: 4 }, () => ({
      x: R.pitch.x1 + rng() * (R.pitch.x2 - R.pitch.x1),
      y: R.pitch.y1 + rng() * L,
    }));
    const sh = attackingShape(R, ball.y, ball, defenders, rng);
    if (sh.carrier === sh.yours) yoursWasCarrier++;
    if (dist(sh.slots[sh.carrier], ball) < 3) stayed++;
    n++;
  }
  check(
    yoursWasCarrier === 0,
    `the ball may never be played to the man the player is controlling — it was ${yoursWasCarrier} times`,
  );
  // A beat is half a minute of football and the ball gets passed in it. The
  // old shape handed the ball straight back to the slot it came from every
  // time, which is the other half of the fixed point.
  check(
    stayed / n < 0.15,
    `the ball has to actually be passed — it stayed within three metres of itself `
    + `${((100 * stayed) / n).toFixed(1)}% of the time`,
  );
}

// ── Nobody stands on the ball, and nobody stands on anybody ─────────────
//
// The same fuzz, and the same two failures behind it, as the defensive
// shape's: separation pushes men apart along a line that can point at the
// ball, and the pitch clamp drags a man back into the radius he was just
// moved out of. Relaxing all three rules together is what fixes it, and this
// is what would catch it coming back.
{
  const rng = mulberry32(20260919);
  let worstBall = Infinity, worstPair = Infinity, off = 0;
  for (let i = 0; i < 4000; i++) {
    const ball: Vec2 = {
      x: R.pitch.x1 + rng() * (R.pitch.x2 - R.pitch.x1),
      y: R.pitch.y1 + rng() * L,
    };
    const defenders = Array.from({ length: 4 }, () => ({
      x: R.pitch.x1 + rng() * (R.pitch.x2 - R.pitch.x1),
      y: R.pitch.y1 + rng() * L,
    }));
    const { slots, carrier } = attackingShape(R, ball.y, ball, defenders, rng);
    for (let a = 0; a < slots.length; a++) {
      // The carrier is allowed to be on the ball — he is the one receiving it.
      if (a !== carrier) worstBall = Math.min(worstBall, dist(slots[a], ball));
      if (!insideFivePitch(slots[a])) off++;
      for (let b = a + 1; b < slots.length; b++) {
        worstPair = Math.min(worstPair, dist(slots[a], slots[b]));
      }
    }
  }
  check(
    worstBall >= 1.8,
    `nobody but the man receiving it may stand on the ball — closest over 4,000 shapes `
    + `was ${worstBall.toFixed(2)} m, and the engine tackles a carrier inside 1.8 m`,
  );
  check(
    worstPair >= 0.9,
    `no two attackers may occupy the same spot — closest over 4,000 shapes was ${worstPair.toFixed(2)} m`,
  );
  check(off === 0, `every attacker is on the pitch, ${off} were not`);
  console.log(
    `      4,000 fuzzed shapes: nearest anyone got to the ball ${worstBall.toFixed(2)} m, `
    + `to each other ${worstPair.toFixed(2)} m, off the pitch ${off}`,
  );
}

// ── …and it holds all the way through to real football ──────────────────
//
// Measured on the beats the flow actually plays, not on hand-built shapes.
{
  setOffsideRuleEnabled(false);
  const xs: number[] = [];
  const spread: number[] = [], pairMin: number[] = [], widest: number[] = [];
  const flanked: number[] = [];

  for (let seed = 1; seed <= 120; seed++) {
    const rng = mulberry32(seed * 6151 + 3);
    let world = kickOffWorld(true);
    let flow = newFlow(true);
    for (let hop = 0; hop < 14; hop++) {
      const r = playOn(R, world, flow, { difficulty: 0.5, playerSkill: 65 }, rng, 40);
      for (const b of r.beats) {
        xs.push(b.world.ball.x);
        const men = b.possession === "you"
          ? [b.world.you, ...b.world.mates] : [...b.world.opps];
        const mx = avg(men.map(p => p.x));
        spread.push(Math.sqrt(avg(men.map(p => (p.x - mx) ** 2))));
        let pm = Infinity, w = 0;
        for (let a = 0; a < men.length; a++) {
          for (let c = a + 1; c < men.length; c++) {
            pm = Math.min(pm, dist(men[a], men[c]));
            w = Math.max(w, Math.abs(men[a].x - men[c].x));
          }
        }
        pairMin.push(pm); widest.push(w);
        flanked.push(men.filter(p => Math.abs(p.x - CXP) > 4).length);
      }
      world = r.world; flow = r.flow;
      if (r.stop === "full-time") break;
      flow = flowAfterTouch(R, flow, r.stop === "you" ? "them" : "you", world.ball.y);
    }
  }

  const lean = avg(xs.map(x => Math.abs(x - CXP) / ((R.pitch.x2 - R.pitch.x1) / 2)));
  console.log(
    `      ${xs.length} beats: the attacking four spread ${avg(spread).toFixed(2)} m (was 1.35), `
    + `widest pair ${avg(widest).toFixed(2)} m (was 3.45), nearest pair ${avg(pairMin).toFixed(2)} m `
    + `(was 1.65), ${avg(flanked).toFixed(2)} of 4 out on a flank (was 0.20)`,
  );
  console.log(
    `      …and the ball: median x ${med(xs).toFixed(1)} on a pitch running `
    + `${R.pitch.x1}-${R.pitch.x2}, mean |lean| ${lean.toFixed(3)} (was 0.157)`,
  );

  check(xs.length > 8000, `enough real football to measure, got ${xs.length} beats`);
  // THE ONE THAT MATTERS. Not "is the attack good" — "is it an attack at all,
  // or four men standing on the centre spot".
  check(
    lean > 0.30,
    `the ball has to get out of the middle of the pitch — mean |lean| ${lean.toFixed(3)}, and it was 0.157`,
  );
  check(
    avg(spread) > 3.0,
    `your four cannot occupy one lane of a 24 m pitch — spread ${avg(spread).toFixed(2)} m, was 1.35`,
  );
  check(
    avg(widest) > 8,
    `…and somebody has to be out wide — the two furthest apart are `
    + `${avg(widest).toFixed(2)} m apart, and the whole attack used to span 3.45 m`,
  );
  check(
    avg(pairMin) > 2.5,
    `…nor stand on each other — nearest pair ${avg(pairMin).toFixed(2)} m on average, was 1.65`,
  );
  check(
    avg(flanked) > 1.4,
    `two wide men means two men genuinely on the flanks — ${avg(flanked).toFixed(2)} of four `
    + "are more than 4 m off centre, and it was 0.20",
  );
  setOffsideRuleEnabled(true);
}

// ── The picture survives being built for the engine ─────────────────────
//
// A shape is only worth anything if it is still there when `buildPassage`
// hands it over, which is the thing the engine actually plays.
{
  setOffsideRuleEnabled(false);
  const spread: number[] = [], lane: number[] = [];
  let n = 0;
  for (let seed = 1; seed <= 900 && n < 300; seed++) {
    const rng = mulberry32(seed * 32749);
    let world = kickOffWorld(true);
    let flow = newFlow(true);
    for (let hop = 0; hop < 8 && n < 300; hop++) {
      const r = playOn(R, world, flow, { difficulty: 0.5, playerSkill: 65 }, rng, 40);
      world = r.world; flow = r.flow;
      if (r.stop === "full-time") break;
      if (r.stop === "you" && world.ball.y < 13) {
        const sc: Scenario = buildPassage(world, { keeperStrength: FIVE_KEEPER_STRENGTH, rng });
        initDefenders(sc, rng);
        const men = [...sc.secondaryRunners.map(x => x.pos), { x: sc.follower.x, y: sc.follower.y }];
        const mx = avg(men.map(p => p.x));
        spread.push(Math.sqrt(avg(men.map(p => (p.x - mx) ** 2))));
        // How many of YOUR OWN men are standing on the line from the ball to
        // the middle of the goal. This is the complaint this round started
        // from — "his own players block the shot" — and the engine really does
        // treat a team-mate on the line of a struck ball as having received
        // it, which on screen reads as the shot never happening.
        const gx = (R.goal.x1 + R.goal.x2) / 2;
        const sx = gx - sc.ball.x, sy = 0 - sc.ball.y;
        const l2 = sx * sx + sy * sy;
        lane.push(men.filter(p => {
          const t = Math.max(0, Math.min(1, ((p.x - sc.ball.x) * sx + (p.y - sc.ball.y) * sy) / l2));
          return Math.hypot(p.x - (sc.ball.x + sx * t), p.y - (sc.ball.y + sy * t)) < 1.6;
        }).length);
        n++;
      }
      flow = flowAfterTouch(R, flow, r.stop === "you" ? "them" : "you", world.ball.y);
    }
  }
  console.log(
    `      ${n} real chances as the engine gets them: your three spread `
    + `${avg(spread).toFixed(2)} m, ${avg(lane).toFixed(2)} of them in your own shooting lane`,
  );
  check(n >= 200, `enough real chances to measure, got ${n}`);
  check(
    avg(spread) > 2.5,
    `the width survives the picture being built — your three are ${avg(spread).toFixed(2)} m apart`,
  );
  check(
    avg(lane) < 0.15,
    `your own men must not be standing in your shooting lane — ${avg(lane).toFixed(2)} of three are`,
  );
  setOffsideRuleEnabled(true);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the attack stretches the pitch, and the ball leaves the middle of it");
