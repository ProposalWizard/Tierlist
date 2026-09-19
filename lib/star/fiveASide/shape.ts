import type { Vec2 } from "../canvasEngine";
import type { MatchRules } from "./rules";
import { clampToPitch } from "./geometry";

/**
 * WHERE A DEFENDER SHOULD ACTUALLY BE STANDING.
 *
 * ── The thing this file exists to fix ──
 *
 * Told directly, and it is the whole brief:
 *
 *   "the goal middle question is tough because in football scenarios aren't so
 *    set like that, each cpu should have an understanding of his position /
 *    know when to cover space and/or the game itself should understand
 *    football scenarios."
 *
 * The version before this one placed the defending four as FIXED OFFSETS FROM
 * THE ATTACKING FOUR (`slotsFor`, flow.ts — itself since replaced by
 * `attackingShape`, attack.ts, for the very same reason): the presser five
 * per cent of the pitch behind the carrier, the cover five per cent behind the
 * runner, and the other two anchored on the middle of the pitch. Not one of
 * the four slots mentioned the goal they were defending, the near post, or
 * the ball.
 *
 * MEASURED, over 500 real chances the flow actually produced:
 *
 *   defenders within 3 m of the centre line   3.85 of 4
 *   chances with three or more of them there  95.8%
 *   the four defenders' spread across a
 *     twenty-four-metre pitch                 1.02 m
 *   nearest pair of defenders                 0.99 m apart
 *
 * That is not a defence. It is four men standing on each other in a
 * one-metre-wide column in the middle of the pitch, while the ball — which
 * `receiveInSpace` deliberately puts in the emptiest place it can find — is
 * eight metres away on a touchline with nobody within reach of it. On screen
 * it reads as noise, which is exactly what was reported.
 *
 * The cause, for whoever comes next: the old shape leaned on `lean`, the
 * ball's own offset from the middle, and `lean` is a FIXED POINT AT ZERO. The
 * ball sets the lean, the lean sets the attacking slots, the attacking slots
 * decide who carries the ball, and the carrier is where the ball then is. From
 * a kick-off on the centre spot it never escapes: measured over 10,036 beats,
 * the ball's median x is 34.0 on a pitch running 22 to 46, and the four
 * defenders' spread across those beats is 1.20 m.
 *
 * ── What this file does instead ──
 *
 * Four slots, each one derived from the situation and each one a job somebody
 * in a five-a-side actually has:
 *
 *   press   goal-side of the ball, shown toward his near post, so the man on
 *           the ball has somebody in front of him and can see which way he is
 *           being shown.
 *   cover   about halfway along the line from the ball to the near post —
 *           that post is taken away without anybody standing on it, which is
 *           what makes the far one a target worth picking out.
 *   mark    on the most dangerous attacker who is NOT the one with the ball
 *           and is not behind it, goal-side of him. If a man is free,
 *           somebody steps to him.
 *   last    holds the middle: on the ball's own line to the middle of the
 *           goal, deepest of the four. The keeper shades to his near post, so
 *           the centre of the net is a real gap and somebody whose job it is
 *           has to be in it.
 *
 * Then a separation pass, because four men who each individually picked a
 * sensible spot can still have picked the SAME sensible spot.
 *
 * ── What this deliberately is not ──
 *
 * It is not an attempt to make the defence better at defending. The engine's
 * own rule is unchanged and is not ours to change: a defender does not move
 * until the ball comes within nine metres of him, and then he steps at it at
 * 2.6 m/s (`stepReactions`, canvasEngine.ts). `Defender.role` is written by
 * `initDefenders` and read by nothing. So where a man STANDS when the picture
 * is built is the entire defence, and the only thing on offer here is making
 * that picture legible: a man in a sensible place is one you can see and play
 * around, where four men in a heap are just noise.
 */

/** The four jobs, in the order `defensiveShape` returns them. */
export type DefendRole = "press" | "cover" | "mark" | "last";

export const DEFEND_ROLES: DefendRole[] = ["press", "cover", "mark", "last"];

/**
 * How close the presser stands to the ball.
 *
 * Floored by the engine's own spacing rule: `buildPassage` pushes anybody
 * within 1.8 m of the ball away from it, so a slot tighter than that is not a
 * slot, it is a suggestion that gets overruled. 2.4 m is close enough to be a
 * man in your way and far enough to survive the picture being built.
 */
const PRESS_GAP = 3.4;

/**
 * How far the presser is shaded across, toward the post he is protecting.
 *
 * A presser who stands exactly on the line from the ball to the middle of the
 * goal is a coin flip: he blocks everything equally and shows you nothing.
 * Shading him to the near side is what a defender actually does — it says
 * "not this way" and leaves the far post as the ball you are being invited to
 * play. That is the difference between a defender you read and a defender you
 * hit.
 */
const PRESS_SHADE = 1.7;

/** How far off his man a marker stands: close enough to be marking him,
 *  far enough that the pass is still on if it is struck well. */
const MARK_GAP = 2.1;

/** How far along the line from the ball to the near post the covering man
 *  stands. Near enough the post to have taken it away, far enough off it that
 *  he is a defender and not a second goalkeeper — see the note in
 *  `defensiveShape` about what putting a man ON a post did to the one target
 *  this goal actually has. */
const COVER_FRAC = 0.45;

/**
 * How far out the last man sits, as a fraction of the ball's own distance from
 * the goal he is defending.
 *
 * He holds the middle, ON the line from the ball to the middle of the goal,
 * and this is the one number in this file that had to be MEASURED rather than
 * reasoned, because both ways of being wrong are real and they point opposite
 * ways. Stand him too near his own goal and the lanes have not diverged yet —
 * at 3 m out on an 8 m chance the far-post lane is barely a metre away from
 * the middle one, so the man holding the centre is also standing in the ONE
 * target this goal leaves open. Stand him too far out and he is a second
 * presser covering nothing.
 *
 * Measured over 500 real chances and 250 whole matches per setting, against a
 * baseline (the old fixed-offset shape) of: middle 13.8%, open post 52.4%,
 * your touches blocked 31.2%, 1.704 goals a match, stage score 72.9.
 *
 *   fraction   middle   open post   blocked   goals   stage
 *     0.35      19.8%     52.0%      28.7%    1.452    67.2
 *     0.40      19.8%     50.4%      29.3%    1.512    72.6
 *     0.45      19.4%     54.8%      30.3%    1.600    72.3
 *     0.55      20.8%     56.8%      30.1%    1.524    70.8
 *     0.65      20.6%     58.8%      28.3%    1.564    70.6
 *     0.75      21.4%     54.4%      29.3%    1.512    69.8
 *
 * (And, before the relaxation below was made to run all three placement rules
 * together rather than once each: 0.12 gave 35.2% blocked and 1.364 goals —
 * a man that near his own goal line is standing in the far corner as well as
 * the middle, which is the failure this whole constant exists to avoid.)
 *
 * 0.45 is the setting that leaves the stage as hard as it was — blocked within
 * a point of the baseline, the stage score within a point of it — while the
 * picture is a defence rather than a huddle. Shading him off the centre line
 * toward the near post was tried at every fraction and measured WORSE at all
 * of them (0.55 with a 0.8 m shade: open post 50.0%, 1.296 goals), because the
 * near side is already the keeper's and the cover man's; it is not his.
 */
const LAST_FRAC = 0.45;

/** ...and never nearer his own goal than this, nor further out than this. */
const LAST_MIN = 2.2;
const LAST_MAX = 6.0;

/** The nearest anybody but the presser is allowed to the ball. Above the
 *  engine's own 1.8 m so the picture survives being built. */
const MIN_BALL_GAP = 2.6;

/** How near two defenders may stand before one of them is in the other's
 *  pocket rather than covering anything. */
const MIN_SEP = 3.0;

/** How near his own goal line the deepest man may get. Any closer and he is
 *  standing on his keeper. */
const MIN_GOAL_GAP = 2.2;

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** A point `gap` metres from `from`, along the line toward `to`. */
function toward(from: Vec2, to: Vec2, gap: number): Vec2 {
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: from.x, y: from.y };
  const g = Math.min(gap, d);
  return { x: from.x + (dx / d) * g, y: from.y + (dy / d) * g };
}

export interface DefensiveShape {
  /** Four points, one per entry of `DEFEND_ROLES`. */
  slots: Vec2[];
  roles: DefendRole[];
}

/**
 * The four defensive slots for a ball here, against these attackers.
 *
 * Written in the canonical frame `attackingShape` (attack.ts) uses: the
 * ATTACKING side is going
 * toward `y1`, so the goal being defended is the one at `y1`. The caller turns
 * the whole thing round when it is the other way up — one shape, not two.
 *
 * `attackers` is the attacking side's four, carrier first is NOT assumed: the
 * man on the ball is worked out here, from the ball, because that is the one
 * thing that cannot be wrong.
 */
export function defensiveShape(
  rules: MatchRules, ball: Vec2, attackers: Vec2[], jitter: () => number = () => 0.5,
): DefensiveShape {
  const { y1, y2 } = rules.pitch;
  const gc: Vec2 = { x: (rules.goal.x1 + rules.goal.x2) / 2, y: y1 };
  const L = y2 - y1;
  const j = (m: number) => (jitter() - 0.5) * m;

  // Which side of his own goal the ball is on. The near post is the one on
  // that side; the far post is the one you have to work the ball to.
  const side = ball.x >= gc.x ? 1 : -1;
  const nearPost: Vec2 = { x: side > 0 ? rules.goal.x2 : rules.goal.x1, y: y1 };
  /** How far out the ball is from the goal being defended. */
  const out = Math.max(1, ball.y - y1);

  // ── press ──
  // Goal-side of the ball, shaded toward the post he is protecting so the man
  // on it can read which way he is being shown.
  const onLine = toward(ball, gc, PRESS_GAP);
  const lane = { x: gc.x - ball.x, y: gc.y - ball.y };
  const laneLen = Math.max(1e-6, Math.hypot(lane.x, lane.y));
  // Perpendicular to the ball's own line to goal, pointing toward the near
  // post — so the shade is across the shot rather than along it.
  const perp = { x: -lane.y / laneLen, y: lane.x / laneLen };
  const shadeSign = (perp.x * (nearPost.x - gc.x)) >= 0 ? 1 : -1;
  const press: Vec2 = {
    x: onLine.x + perp.x * PRESS_SHADE * shadeSign + j(0.5),
    y: onLine.y + perp.y * PRESS_SHADE * shadeSign + j(0.5),
  };

  // ── cover ──
  // On the ball's line to the NEAR post, about halfway along it: the near post
  // is taken away without anybody standing on it.
  const cover = toward(ball, nearPost, dist(ball, nearPost) * COVER_FRAC);
  cover.x += j(0.6); cover.y += j(0.6);

  // ── mark, and last ──
  //
  // The two men nobody has picked up. Of the attackers, skipping whoever the
  // ball is with, the two nearest the goal being defended — stood goal-side of
  // each, which is what marking somebody means. "If the ball is central and a
  // man is free, somebody steps to him" is this, and it is also what gives the
  // defence its width: the attackers are spread, so their markers are.
  //
  // ── Why neither of these drops onto a post ──
  //
  // The first version of this file put the fourth man in front of his own goal
  // on the FAR side from the ball, as the cutback cover. It reads well and it
  // was measurably wrong: the keeper already shades to the near post
  // (`keeperHome`, flow.ts), so the far corner is the ONE target this 5.2 m
  // goal leaves open, and a man standing 2 m toward the far post at 3 m out is
  // standing in it. MEASURED, over 500 real chances: the open post fell from
  // 52.4% to 30.8% and the covered one to 29.6% — the two became the same
  // number, which is placement having stopped being a decision at all. The
  // goal mouth is the keeper's; these two mark men.
  let carrier = 0;
  attackers.forEach((a, i) => {
    if (dist(a, ball) < dist(attackers[carrier], ball)) carrier = i;
  });
  // Only somebody who is actually a threat gets marked: a man BEHIND the ball
  // is not one, and a defender who follows him there has taken himself out of
  // the picture entirely. MEASURED before this filter: only 1.48 of the four
  // defenders were goal-side of the ball at all, because `receiveInSpace`
  // gives the ball to the most advanced attacker and the other three are
  // therefore all deeper than it. Whoever has nobody to pick up holds the
  // middle in front of his own goal instead, which is the other half of what
  // was asked for.
  const free = attackers
    .map((a, i) => ({ a, i }))
    .filter(e => e.i !== carrier && e.a.y <= ball.y + 1)
    .sort((p, q) => p.a.y - q.a.y);

  const threat = free[0];
  const onHim = threat ? toward(threat.a, gc, MARK_GAP) : null;
  const mark: Vec2 = onHim
    ? {
      x: onHim.x + j(0.5),
      // Goal-side of the ball as well as of his man. A marker who ends up
      // behind the ball is a man the move has already gone past.
      y: Math.min(ball.y, onHim.y + j(0.5)),
    }
    // Nobody to pick up — every other attacker is behind the ball, or the
    // shape has only one man in it (the tests build those). Drop in alongside
    // the last man rather than mark thin air, off centre, because the last man
    // has the middle.
    : { x: gc.x + (side > 0 ? -1 : 1) * 1.6 + j(0.8), y: y1 + MIN_GOAL_GAP + out * 0.34 };

  // ── last ──
  //
  // Holds the middle, in front of his own goal, always — this is the other
  // half of "if the ball is wide, somebody covers the near post and somebody
  // holds the middle", and it is the only one of the four whose spot does not
  // depend on where anybody else is standing.
  //
  // The middle is a real gap and it is the KEEPER who opens it: `keeperHome`
  // shades him up to 1.2 m toward the near post, so a wide ball leaves the
  // centre of a 5.2 m goal genuinely open. Somebody has to be in it, and it
  // has to be somebody whose job that is rather than whoever happened to drift
  // there. MEASURED with nobody holding it, over 500 real chances: a ball
  // straight down the middle converted 25.4% against the open post's 56.6%,
  // and your touches were blocked 22.1% of the time against 31% before any of
  // this — the stage had quietly become a free shooting exercise.
  //
  // ON THE LINE from the ball to the middle of the goal, deliberately, and
  // never a post: the far corner is the one target this goal leaves open and a
  // man standing in it is the mistake this file's first version made. How far
  // along that line he stands is `LAST_FRAC`, which is measured.
  const lastOut = Math.max(LAST_MIN, Math.min(out * LAST_FRAC, LAST_MAX));
  const onCentreLane = toward(gc, ball, lastOut);
  const last: Vec2 = { x: onCentreLane.x + j(0.8), y: onCentreLane.y + j(0.5) };

  const slots = [press, cover, mark, last];

  // ── Nobody stands on the ball ──
  // The presser is meant to be the closest and keeps his gap; everybody else
  // is pushed out to MIN_BALL_GAP. Without this a marker whose man has dropped
  // onto the ball ends up inside the engine's own spacing rule, and the
  // picture-builder shoves him somewhere arbitrary on the way out.
  for (let i = 1; i < slots.length; i++) {
    const d = dist(slots[i], ball);
    if (d >= MIN_BALL_GAP) continue;
    const away = d < 1e-6
      ? { x: 0, y: -1 }
      : { x: (slots[i].x - ball.x) / d, y: (slots[i].y - ball.y) / d };
    slots[i] = { x: ball.x + away.x * MIN_BALL_GAP, y: ball.y + away.y * MIN_BALL_GAP };
  }

  // ── Nobody stands on anybody else, and everything holds at once ──
  //
  // Four men who each picked a sensible spot can still have picked the same
  // one: a central ball puts the press line, the cover line and the mark all
  // through the middle.
  //
  // The three rules — clear of the ball, clear of each other, on the pitch —
  // all fight, and each one can undo another. Separation pushes two men apart
  // along the line between them, which can point straight at the ball; the
  // pitch clamp drags a man who went over a touchline back inside the radius
  // he was just moved out of; and pushing a man off the ball in a corner puts
  // two of them on the same point of the same small arc. That is the same
  // shape of bug `nudgeClear` (passage.ts) already documents twice, and the
  // fuzz in tests/star/fiveASideShape.mts found the two-men-on-one-point
  // version of it before this shipped: two slots exactly 0.00 m apart.
  //
  // So they are relaxed TOGETHER, several passes of all three, rather than
  // once each in an order somebody has to get right.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < slots.length; i++) {
      for (let k = i + 1; k < slots.length; k++) {
        const dx = slots[k].x - slots[i].x, dy = slots[k].y - slots[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= MIN_SEP) continue;
        // Straight on top of each other: push apart across the pitch, which is
        // the axis a defence actually needs separating on. Deterministic, so
        // the same situation always produces the same shape.
        const ux = d < 1e-6 ? 1 : dx / d;
        const uy = d < 1e-6 ? 0 : dy / d;
        const push = (MIN_SEP - d) / 2;
        slots[i] = { x: slots[i].x - ux * push, y: slots[i].y - uy * push };
        slots[k] = { x: slots[k].x + ux * push, y: slots[k].y + uy * push };
      }
    }
    for (let i = 0; i < slots.length; i++) {
      slots[i] = clearOfBall(clampToPitch({
        x: slots[i].x,
        // Never behind his own goal line, and never on his keeper.
        y: Math.max(y1 + MIN_GOAL_GAP, Math.min(y1 + L * 0.96, slots[i].y)),
      }, 0.6), ball, rules, (i * Math.PI) / 2);
    }
  }

  return { slots, roles: [...DEFEND_ROLES] };
}

/** The nearest spot to `p` that is at least `MIN_BALL_GAP` from the ball and
 *  still on the pitch. Nothing to do if he is already clear, which he is
 *  almost always. Exported because the same guarantee has to survive a man
 *  being MOVED toward one of these slots as well as the slot being built —
 *  see `reactToBall` (flow.ts). */
export function clearOfBall(p: Vec2, ball: Vec2, rules: MatchRules, bias = Math.PI / 2): Vec2 {
  const d = dist(p, ball);
  if (d >= MIN_BALL_GAP) return p;
  // His own bearing from the ball, so he ends up at the smallest possible turn
  // from where he really was. A man standing EXACTLY on it has no bearing to
  // keep, and two of them would otherwise be swept to the same arc point —
  // hence the fallback is `bias`, which the caller varies per man.
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
  // The ball is in a corner tight enough that no point at this radius is on
  // the pitch. Standing clear of it matters more than standing on the grass —
  // same call, and the same reason, as `nudgeClear`'s own last line.
  return { x: ball.x + Math.cos(own) * MIN_BALL_GAP, y: ball.y + Math.sin(own) * MIN_BALL_GAP };
}

/**
 * How far the man in each slot is from the job he is doing, so a caller can
 * ask "is this picture actually a defence" without knowing how one is built.
 * Used by the tests.
 */
export function laneClearance(p: Vec2, a: Vec2, b: Vec2): number {
  const sx = b.x - a.x, sy = b.y - a.y;
  const l2 = sx * sx + sy * sy;
  if (l2 < 1e-6) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * sx + (p.y - a.y) * sy) / l2));
  return Math.hypot(p.x - (a.x + sx * t), p.y - (a.y + sy * t));
}
