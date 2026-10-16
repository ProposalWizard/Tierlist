/**
 * SHOT FEEL — the Oct 13 gameplay update (Leo / Harry / Mikey feedback).
 *
 * Two switches, both "old" by default while they are tested
 * (Settings → Look → Gameplay · new vs old):
 *
 *  1. SHOT POWER ("shotPower"). Leo: "the power you get on a shot at like 40
 *     shooting is WAYYY too high, probably needs to be what it's like at 60.
 *     At 100 it's literally insane, sometimes guaranteed to go over the bar."
 *     The ball is struck with a lower "striking power" (`feelPower`): a 60
 *     now strikes like today's 40, a 100 like today's 70. It is the engine's
 *     own model of a weaker striker, so pace AND rise come down together and
 *     a 100 clears the bar about as often as a 70 does today. Only a strike
 *     AT GOAL (shotModel's `aimedAtGoal`): passes, crosses, corners and free
 *     kicks keep their pace. Replaces the v0.15 knee (strikePower.ts) while on.
 *
 *  2. CONTACT FIELD ("contactField"). Mikey: "to get max curve you hit the
 *     ball vertically in the middle and horizontally at the edge, and it takes
 *     that as a shot aimed up … near the middle sides there's barely any
 *     vertical movement." Where you tap the ball is read through a field:
 *     toward the left/right edges the up/down part fades out and the strike
 *     is a low, side-footed curler. The centre is unchanged (top = driven,
 *     bottom = lifted), the bottom corners still give curl and lift together.
 *     Works with Shots (testing) New and Old. Open-play strikes only — a
 *     corner, cross or free kick keeps the plain ball (their own rules).
 *
 * Nothing here touches canvasEngine.ts: the power curve changes the stat the
 * ball is struck with, the field changes the contact handed to `launch`.
 */
import { gameplayVersion } from "./gameplayVersion";
import type { Contact, Scenario, ScenarioKind, Vec2 } from "./canvasEngine";

export const shotPowerOn = () => gameplayVersion("shotPower") === "new";
export const contactFieldOn = () => gameplayVersion("contactField") === "new";

// ─────────────────────────────────────────────────────────────────────────
//  1. Shot power
// ─────────────────────────────────────────────────────────────────────────

/**
 * Real power stat → the stat the ball is struck with. The dials: one point per
 * row, straight lines between them. Full pull, struck through the middle:
 *   stat 20 →  5 (64 km/h)   stat 40 → 22 (69 km/h)   stat 60 → 40 (79 km/h)
 *   stat 80 → 56 (88 km/h)   stat 100 → 70 (96 km/h)
 * Today (with the v0.15 knee): 68 / 79 / 91 / 102 / 103 km/h.
 */
export const SHOT_POWER_CURVE: [number, number][] = [
  [0, 0], [20, 5], [40, 22], [60, 40], [80, 56], [100, 70],
];

export function feelPower(stat: number): number {
  return lerpCurve(SHOT_POWER_CURVE, stat);
}

/** Kinds that are never a strike at goal for the power curve: deliveries and
 *  the free kick (its own rules, already at the real conversion rate). */
const POWER_UNTOUCHED: ScenarioKind[] = ["corner", "byline_cross", "free_kick"];

/**
 * Is this drag a strike AT GOAL, for the power curve? Its line crosses the
 * goal line near the mouth — or, struck on the side of the ball, as far wide
 * as a curler is aimed to bend back (up to 14 m at the very edge).
 */
export function struckAtGoal(sc: Scenario, dir: Vec2, cx = 0): boolean {
  if (POWER_UNTOUCHED.includes(sc.kind)) return false;
  const n = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / n, uy = dir.y / n;
  if (uy > -0.15) return false;
  const x = sc.ball.x + ux * (sc.ball.y / -uy);
  const pad = 2.5 + 14 * Math.min(1, Math.abs(cx));
  return x > sc.goal.x1 - pad && x < sc.goal.x2 + pad;
}

/**
 * …and how much of its rise a strike at goal keeps (Shots (testing) Old only:
 * New aims the height at the line itself). A faster ball reaches the goal
 * while still climbing, so even at the lower striking power a 100 cleared
 * the bar 11% of the time against 1% at 40. Real stat → share of vz kept.
 */
export const SHOT_LIFT_CURVE: [number, number][] = [
  [0, 1], [40, 1], [70, 0.94], [100, 0.86],
];

function lerpCurve(p: [number, number][], stat: number): number {
  const s = Math.max(0, Math.min(100, Number.isFinite(stat) ? stat : 0));
  for (let i = 1; i < p.length; i++) {
    if (s <= p[i][0]) {
      const [a, ea] = p[i - 1], [b, eb] = p[i];
      return ea + ((s - a) / (b - a)) * (eb - ea);
    }
  }
  return p[p.length - 1][1];
}

export function feelLift(stat: number): number {
  return lerpCurve(SHOT_LIFT_CURVE, stat);
}

// ─────────────────────────────────────────────────────────────────────────
//  2. The contact field
// ─────────────────────────────────────────────────────────────────────────

/** Sideways distance from the middle (share of the radius) where the field starts. */
export const FIELD_START = 0.3;
/** What an edge strike at mid-height is read as: a little above the middle
 *  of the ball, a low drive (cy −1 top … +1 bottom). */
export const FIELD_SIDE_CY = -0.7;
/** How much of the up/down meaning is gone at the very edge (1 = all of it). */
export const FIELD_FADE = 0.85;

/** Kinds the field never touches (deliveries and the free kick's own rules). */
const FIELD_UNTOUCHED: ScenarioKind[] = ["corner", "byline_cross", "free_kick"];

export function fieldApplies(kind: ScenarioKind): boolean {
  return !FIELD_UNTOUCHED.includes(kind);
}

/** 0 in the middle third of the ball, rising smoothly to 1 at the edge. */
export function fieldWeight(cx: number): number {
  const t = Math.max(0, Math.min(1, (Math.abs(cx) - FIELD_START) / (1 - FIELD_START)));
  return t * t * (3 - 2 * t);
}

/**
 * The tap, read through the field: cx (curl) is kept, cy (height) is pulled
 * toward a low side-foot strike the nearer the edge you hit it.
 */
export function fieldContact(c: Contact): Contact {
  const w = fieldWeight(c.cx);
  if (w === 0) return { cx: c.cx, cy: c.cy };
  const keep = 1 - FIELD_FADE * w;
  return { cx: c.cx, cy: FIELD_SIDE_CY + (c.cy - FIELD_SIDE_CY) * keep };
}
