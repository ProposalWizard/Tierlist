import type { Vec2 } from "../canvasEngine";
import type { MatchRules } from "./rules";
import { clampToPitch } from "./geometry";

/**
 * WHERE THE FOUR MEN WITH THE BALL SHOULD ACTUALLY BE STANDING.
 *
 * ── The thing this file exists to fix ──
 *
 * `shape.ts` did this for the DEFENDING four last week. This is the other half
 * and it had the same disease, from the same cause, written down in shape.ts's
 * own header:
 *
 *   "the old shape leaned on `lean`, the ball's own offset from the middle,
 *    and `lean` is a FIXED POINT AT ZERO. The ball sets the lean, the lean
 *    sets the attacking slots, the attacking slots decide who carries the
 *    ball, and the carrier is where the ball then is."
 *
 * MEASURED, over 13,990 beats of real football:
 *
 *   the ball's median x, on a pitch running 22 to 46      34.0
 *   mean |lean| (how far off centre the ball ever gets)   0.157
 *   your four men's spread across the pitch               1.35 m
 *   nearest two of them to each other                     1.65 m
 *   how many of the four were near a touchline            0.01 of 4
 *
 * One man in a hundred was ever anywhere near a touchline. Four attackers in
 * a metre-and-a-bit-wide column in the middle of a twenty-four-metre pitch is
 * not an attack, and the consequence is the one the owner actually reported:
 * his own players stand in front of his shot, and there is no width to play
 * into because nobody is out there.
 *
 * ── Why the old geometry could not escape, and what replaces it ──
 *
 * `lean` was PROPORTIONAL: `(ballX - cx) / (W/2)`, and the carrier then stood
 * at `cx + lean * W * 0.30`. Each beat multiplies the offset by 0.6, so it
 * decays to nothing from any starting point — a kick-off on the centre spot
 * never escapes.
 *
 * The fix is the idiom `shape.ts` already uses for the same question: a SIGN,
 * not a magnitude. `side = ball.x >= cx ? 1 : -1` says which flank the move is
 * on, and a sign cannot decay toward zero. A move worked down the right stays
 * on the right until somebody genuinely switches it, and switching it is a
 * real thing that happens here — see `carrier` below.
 *
 * ── What the four jobs are, in football terms ──
 *
 * Real small-sided football has two common shapes and rotates between them: a
 * 1-2-1 (a holding man, two wide men, a pivot furthest forward) and a 2-2.
 * Both are built here out of the same four jobs, so a man's job survives the
 * structure changing under him:
 *
 *   hold      The holding man. Behind the ball, just off centre on the ball's
 *             side. He recycles, and he is the out-ball when the move breaks
 *             down. Nothing in front of your own goal is his problem; being
 *             available backwards is.
 *   wideNear  The wide man on the ball's side. He HUGS THE TOUCHLINE, which is
 *             the entire reason wide men exist in a five-a-side: four
 *             defenders cannot cover twenty-four metres of width, so somebody
 *             has to make them try.
 *   wideFar   The wide man on the other side. The switch — the ball that turns
 *             a crowded flank into an empty one — and, once the move is near
 *             goal, the far post.
 *   pivot     Furthest forward, on the last defender's shoulder. He occupies
 *             the last man so the other three have room to play in front of
 *             him, and he is the one the ball is looking for.
 *
 * The structure is chosen from the situation rather than set: a 2-2 building
 * out of your own half (two to receive, two ahead), a 1-2-1 from the middle
 * third forward (width, and a man on the last defender). See `structureFor`.
 */

/** The four jobs, in the order `attackingShape` returns them. */
export type AttackRole = "hold" | "wideNear" | "wideFar" | "pivot";

export const ATTACK_ROLES: AttackRole[] = ["hold", "wideNear", "wideFar", "pivot"];

/** The two real small-sided shapes this builds. */
export type AttackStructure = "1-2-1" | "2-2";

/**
 * How far off centre a wide man stands, nearest his own goal and nearest
 * theirs.
 *
 * `MAX_WIDE` is the touchline: half of a 24 m pitch is 12, so 9.4 leaves him
 * 2.6 m of grass, which is as wide as a man can stand and still be on the
 * pitch after `clampToPitch` and a metre of jitter. That is the point — in the
 * middle third his job is to stretch four men across the full width, and a
 * winger who stands eight metres infield is not stretching anybody.
 *
 * `MIN_WIDE` is the far post, near enough: the goal is 5.2 m, so its posts are
 * 2.6 m off centre and a far-post runner stands a metre or two outside one.
 * A wide man who stays on the touchline as the move reaches the box is a man
 * who cannot score, and the same player's job there is genuinely different —
 * he attacks the back post. So the width closes as the move gets near goal,
 * which is what a real wide player does rather than a compromise.
 */
const MAX_WIDE = 9.4;
const MIN_WIDE = 4.6;

/** How far ahead of the ball's own band the pivot plays, as a fraction of the
 *  pitch's length. He is the furthest man forward; this is what makes him it. */
const PIVOT_AHEAD = 0.13;

/** How far behind it the holding man sits. Far enough to be a genuine
 *  out-ball — a pass backwards that buys a second — rather than a fourth man
 *  in the same picture. */
const HOLD_BEHIND = 0.15;

/** How far across the last defender the pivot stands. "On his shoulder" is a
 *  real distance: close enough that the defender has to account for him, far
 *  enough that a ball played in front of him is not a ball played at the
 *  defender. */
const SHOULDER = 2.7;

// ── TRIED, MEASURED, AND NOT SHIPPED: a cap on how far the pivot pushes up ──
//
// The pivot plays on the last defender's shoulder, and if that defender is a
// long way up the pitch — you building out of your own box against a side that
// has dropped off — the pivot goes with him and ends up detached from the
// other three. That reads like a fault, and a cap of a few metres beyond his
// own line was built for it.
//
// It is not a fault, it is the job. A pivot who stays high while his side
// plays out from the back is the out-ball, and the whole reason the other
// three have room to play in front of him. MEASURED over 600 matches, capping
// it cost 0.12 goals a match (1.747 -> 1.632) and a point and a half of stage
// score (73.8 -> 70.5) for nothing in return.
//
// The cap was introduced to satisfy a "two banks of two" check in this round's
// own new test, which was the test bending the football rather than measuring
// it. That check is now written against what a 2-2 actually is — the deepest
// man has a partner at his own depth, where in a 1-2-1 he is alone — which
// holds either way.

/**
 * How far off centre the pivot is ever allowed to drift.
 *
 * A pivot is a CENTRAL player — that is what the job is. He may take a half
 * space to get on a defender's shoulder, and he may not end up on a touchline,
 * because the man occupying the last defender is also the man the chance is
 * eventually taken by.
 *
 * MEASURED, with no clamp and with your own slot allowed to be a wide one: the
 * chances the move found you in went from 5.66 m off centre to 6.98 m, and the
 * share struck from more than 8 m off centre — on a pitch whose goal is 5.2 m
 * wide — went from 11% to 42%. Conversion collapsed with it: the open post
 * 54.6% -> 32.0%, and the post the keeper was covering 23.2% -> 32.4%, which
 * is the two becoming the same number and placement having stopped being a
 * decision at all. See `pickYours`.
 */
const PIVOT_MAX_OFF = 4.5;

/** The nearest anybody but the carrier stands to the ball. Above the engine's
 *  own 1.8 m spacing and above `buildPassage`'s own 2.2 m for your men, so the
 *  picture survives being built without anybody being shoved. */
const MIN_BALL_GAP = 2.8;

/** How near two attackers may stand before the second one is not an option,
 *  he is a duplicate. Matches `shape.ts`'s own MIN_SEP — four men on this
 *  pitch need the same amount of room whichever way they are facing. */
const MIN_SEP = 3.0;

/** How much room is worth having. A cap rather than a target, the same
 *  reasoning as flow.ts's `SPACE_ENOUGH`: without one the best man to pass to
 *  is always whoever is furthest from everybody, which is whoever has wandered
 *  furthest from the game. */
const SPACE_CAP = 6.0;

/** What the carrier choice is actually trading off. See `pickCarrier`. */
const W_FORWARD = 0.30;
/** …and what it costs to keep the ball with the man who already has it. A
 *  beat is half a minute of football: the ball gets passed. */
const KEEP_IT_PENALTY = 2.5;
/** How near counts as "he has already got it". */
const ALREADY_HIS = 3.0;

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export interface AttackingShape {
  /** Four points, one per entry of `ATTACK_ROLES`. */
  slots: Vec2[];
  roles: AttackRole[];
  /** Which of the four the ball is with this beat. */
  carrier: number;
  /** Which of the four is YOURS — never the carrier, because a beat you are
   *  not involved in is one somebody else is playing. */
  yours: number;
  /** Which real shape this is, for whoever reads it back. */
  structure: AttackStructure;
}

/**
 * A 2-2 building out, a 1-2-1 once you are up the pitch.
 *
 * `ay` is how far the move's own band sits from the goal being attacked, so
 * this is "which third am I in" and nothing else. Your own half is where you
 * want two men available to receive and two ahead of the ball; from the middle
 * third the ball wants width and a man on the last defender, which is the
 * diamond.
 */
export function structureFor(rules: MatchRules, ay: number): AttackStructure {
  const L = rules.pitch.y2 - rules.pitch.y1;
  return ay > rules.pitch.y1 + L * 0.60 ? "2-2" : "1-2-1";
}

/**
 * The four attacking slots for a move in this band, against these defenders.
 *
 * Written in the canonical frame `flow.ts` uses: the attacking side is going
 * toward `y1`, so the goal being attacked is the one at `y1` and the goal
 * being defended is at `y2`. The caller turns the whole thing round when it is
 * the other way up — one shape, not two.
 *
 * `ay` is the band's own depth (a y, in that frame). `ball` is where the ball
 * actually is right now, which decides only which flank the move is on.
 * `defenders` is where the OTHER side's four actually are — their real
 * positions from the beat just played, not a prediction of them, because the
 * real ones cannot be wrong and asking `defensiveShape` would be circular.
 */
export function attackingShape(
  rules: MatchRules, ay: number, ball: Vec2, defenders: Vec2[], jitter: () => number = () => 0.5,
): AttackingShape {
  const { x1, x2, y1, y2 } = rules.pitch;
  const W = x2 - x1;
  const L = y2 - y1;
  const cx = (x1 + x2) / 2;
  const gc: Vec2 = { x: (rules.goal.x1 + rules.goal.x2) / 2, y: y1 };
  const j = (m: number) => (jitter() - 0.5) * m;
  const at = (x: number, y: number): Vec2 =>
    clampToPitch({ x, y: Math.max(y1 + L * 0.03, Math.min(y2 - L * 0.03, y)) }, 0.6);

  // ── Which flank the move is on ──
  //
  // A SIGN, not a fraction. This is the whole fix: the old `lean` was the
  // ball's own offset divided by the half-width, which the shape then
  // multiplied by 0.30 and handed back as the next ball, decaying to dead
  // centre from anywhere. A sign has nowhere to decay to. Same idiom, and the
  // same line of code, as `shape.ts` uses to decide which post is the near one.
  const side = ball.x >= cx ? 1 : -1;

  const structure = structureFor(rules, ay);

  // How wide the wide men stand: the touchline out here, the far post in
  // there. See MAX_WIDE / MIN_WIDE.
  const t = Math.max(0, Math.min(1, (ay - y1) / L));
  const wide = MIN_WIDE + (MAX_WIDE - MIN_WIDE) * t;

  // ── The last defender, and the shoulder the pivot plays on ──
  //
  // "Occupying the last man" is a real job and it needs a real last man. He is
  // whichever of their four is nearest the goal being attacked; the pivot
  // stands beside him, on whichever shoulder has more room. Nobody there to
  // occupy — the tests build those — and the pivot simply plays high and
  // central, which is where he would be anyway.
  let last: Vec2 | null = null;
  for (const d of defenders) if (!last || d.y < last.y) last = d;

  const roomAt = (p: Vec2): number => {
    let near = Infinity;
    for (const d of defenders) near = Math.min(near, dist(p, d));
    return Math.min(near, SPACE_CAP);
  };

  const pivotY = Math.max(y1 + L * 0.05, ay - L * PIVOT_AHEAD);
  const central = (x: number) => Math.max(cx - PIVOT_MAX_OFF, Math.min(cx + PIVOT_MAX_OFF, x));
  let pivot: Vec2;
  if (last && last.y < ay + L * 0.10) {
    // On his shoulder: level with him, or as far forward as his own line is,
    // whichever is further up the pitch. See the note on the cap that was
    // tried here and backed out.
    const onHim = Math.min(pivotY, last.y + L * 0.01);
    const a = at(central(last.x + SHOULDER), onHim);
    const b = at(central(last.x - SHOULDER), onHim);
    pivot = roomAt(a) >= roomAt(b) ? a : b;
  } else {
    pivot = at(central(cx + side * W * 0.08 + j(W * 0.10)), pivotY);
  }
  // Shaded off the line from the ball to the middle of the goal, and this is
  // the one slot where that is worth doing deliberately. A pivot standing
  // exactly in front of the ball is a team-mate in the shooting lane, which is
  // what the owner reported as "his own players block the shot" — the engine
  // treats a man on the line of a struck ball as having received it.
  {
    const lx = gc.x - ball.x, ly = gc.y - ball.y;
    const ll = Math.max(1e-6, Math.hypot(lx, ly));
    const px = -ly / ll, py = lx / ll;
    const off = (pivot.x - ball.x) * px + (pivot.y - ball.y) * py;
    if (Math.abs(off) < SHOULDER) {
      const push = (off >= 0 ? 1 : -1) * (SHOULDER - Math.abs(off));
      pivot = at(central(pivot.x + px * push), pivot.y + py * push);
    }
  }

  let hold: Vec2, wideNear: Vec2, wideFar: Vec2;
  if (structure === "1-2-1") {
    // The diamond. One behind, two across, one beyond.
    hold = at(cx + side * W * 0.06 + j(W * 0.08), ay + L * HOLD_BEHIND + j(L * 0.03));
    wideNear = at(cx + side * wide + j(W * 0.05), ay - L * 0.01 + j(L * 0.04));
    wideFar = at(cx - side * wide + j(W * 0.05), ay + L * 0.02 + j(L * 0.04));
  } else {
    // Two banks of two, building out. The back pair is the holding man and the
    // ball-side wide man — the two angles a keeper or a man under pressure
    // actually has. The front pair is the far-side wide man and the pivot.
    hold = at(cx - side * W * 0.14 + j(W * 0.08), ay + L * 0.09 + j(L * 0.03));
    wideNear = at(cx + side * wide + j(W * 0.05), ay + L * 0.05 + j(L * 0.04));
    wideFar = at(cx - side * wide * 0.85 + j(W * 0.05), ay - L * 0.07 + j(L * 0.04));
  }

  const slots = [hold, wideNear, wideFar, pivot];

  // ── Nobody stands on anybody else, and nobody stands on the ball ──
  //
  // Straight out of `shape.ts`, for the same reason and with the same shape of
  // bug behind it: four men who each picked a sensible spot can have picked
  // the same one, and the three rules — clear of each other, clear of the
  // ball, on the pitch — all fight. Doing them once each in an order somebody
  // has to get right put a defender ON the ball ten times in 2,108 chances
  // last week. So they are relaxed TOGETHER, several passes of all three.
  //
  // The ball rule is one-sided here in a way the defensive one is not: one of
  // these four IS the man on the ball, and he is chosen below, after the
  // spots. So every slot is kept clear of the ball's CURRENT position and the
  // carrier is then allowed to be whichever of them the move should go to —
  // which is the pass, rather than a man standing on a ball he has not
  // received yet.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < slots.length; i++) {
      for (let k = i + 1; k < slots.length; k++) {
        const dx = slots[k].x - slots[i].x, dy = slots[k].y - slots[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= MIN_SEP) continue;
        const ux = d < 1e-6 ? 1 : dx / d;
        const uy = d < 1e-6 ? 0 : dy / d;
        const push = (MIN_SEP - d) / 2;
        slots[i] = { x: slots[i].x - ux * push, y: slots[i].y - uy * push };
        slots[k] = { x: slots[k].x + ux * push, y: slots[k].y + uy * push };
      }
    }
    for (let i = 0; i < slots.length; i++) {
      // The pivot's central clamp is re-applied every pass, not just when his
      // spot is first picked. Separation pushes men apart along the line
      // between them, and the man he is nearest is a wide man — so a clamp
      // applied once, before the relaxation, is a clamp the relaxation then
      // undoes, and the striker ends up on a touchline anyway.
      const x = i === 3 ? central(slots[i].x) : slots[i].x;
      slots[i] = clearOf(clampToPitch({
        x, y: Math.max(y1 + L * 0.03, Math.min(y2 - L * 0.03, slots[i].y)),
      }, 0.6), ball, rules, (i * Math.PI) / 2);
    }
  }

  // You are the pivot, always, and the ball is worked between the other three
  // until it finds you. See `pickYours`.
  const yours = ATTACK_ROLES.indexOf("pivot");
  const carrier = pickCarrier(slots, ball, ay, defenders, yours);
  return { slots, roles: [...ATTACK_ROLES], carrier, yours, structure };
}

/**
 * WHO THE BALL GOES TO — and the second half of why this shape does not
 * collapse.
 *
 * Three things, and they are the three things a five-a-side player weighs in
 * the half-second he has:
 *
 *   room      how much of it the man has, capped (SPACE_CAP) because the most
 *             open man on the pitch is often the one who has wandered out of
 *             the game entirely.
 *   forward   how far up the pitch the pass goes. Progress is the point.
 *   not you   a real penalty for keeping it with whoever already has it. A
 *             beat is half a minute of football; the ball is passed in it.
 *
 * The room term is what moves the ball ACROSS the pitch, and it does it
 * honestly rather than by construction: the defending shape is arranged around
 * where the ball is right now (`shape.ts` — the presser, the cover man and the
 * last man are all on the ball's own line to goal), so the emptiest of these
 * four slots is systematically the one furthest from the ball. That is a
 * switch of play, and it is the same thing a real side does to a defence that
 * has shifted over.
 */
function pickCarrier(
  slots: Vec2[], ball: Vec2, ay: number, defenders: Vec2[], skip: number,
): number {
  let best = skip === 0 ? 1 : 0, bestScore = -Infinity;
  slots.forEach((s, i) => {
    if (i === skip) return;
    let room = Infinity;
    for (const d of defenders) room = Math.min(room, dist(s, d));
    const score = Math.min(room, SPACE_CAP)
      + (ay - s.y) * W_FORWARD
      - (dist(s, ball) < ALREADY_HIS ? KEEP_IT_PENALTY : 0);
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

// ── TRIED, MEASURED, AND NOT SHIPPED: you take whichever slot is furthest
// ── forward
//
// It reads right — a striker plays on the last shoulder, and if somebody else
// has taken that spot this beat he takes the next one up. In a shape with two
// men on the touchlines it puts you on a touchline whenever the pivot is the
// one carrying, and the chance the move then finds you in is a chance from the
// byline. MEASURED over 600 real chances, against a baseline of 5.66 m off
// centre and 11% of them struck from more than 8 m off centre:
//
//                                   off centre   over 8 m   open post   stage
//   furthest-forward slot is yours     6.98 m       42%        32.0%      56.3
//   the pivot is always yours          (below)
//
// The goal is 5.2 m wide. Forty per cent of your chances arriving from wider
// than eight metres off centre is not a wide attack, it is a corner-taking
// exercise, and the open post and the post the keeper was covering converged
// to the same number — placement having stopped being a decision, which is the
// failure this stage's own tests exist to catch.
//
// So the pivot is yours, always, and the ball is worked between the other
// three until the move finds you. That is also what the job IS: the pivot
// occupies the last defender and is the man the chance is for.

/**
 * The nearest spot to `p` that is clear of the ball and still on the pitch.
 *
 * The same sweep, and the same reason for sweeping rather than pushing
 * straight out, as `shape.ts`'s `clearOfBall` and `passage.ts`'s `nudgeClear`:
 * pushing a man away from a ball near a touchline sends him off the pitch, and
 * clamping him back drags him into the radius he was just moved out of.
 */
function clearOf(p: Vec2, ball: Vec2, rules: MatchRules, bias: number): Vec2 {
  const d = dist(p, ball);
  if (d >= MIN_BALL_GAP) return p;
  const own = d < 1e-6 ? bias : Math.atan2(p.y - ball.y, p.x - ball.x);
  const { x1, x2, y1, y2 } = rules.pitch;
  const on = (q: Vec2) => q.x >= x1 && q.x <= x2 && q.y >= y1 && q.y <= y2;
  const STEPS = 24;
  for (let i = 0; i <= STEPS; i++) {
    const off = Math.ceil(i / 2) * ((Math.PI * 2) / STEPS) * (i % 2 === 0 ? 1 : -1);
    const cand = {
      x: ball.x + Math.cos(own + off) * MIN_BALL_GAP,
      y: ball.y + Math.sin(own + off) * MIN_BALL_GAP,
    };
    if (on(cand)) return cand;
  }
  return { x: ball.x + Math.cos(own) * MIN_BALL_GAP, y: ball.y + Math.sin(own) * MIN_BALL_GAP };
}
