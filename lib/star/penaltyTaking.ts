/**
 * PENALTIES YOU WATCH — who takes them, and where he puts it.
 *
 * Harry, playtest (v0.15 plan, items 6 and 7): "you are to watch your team and
 * the other team take the penalties as if it were you taking it … your
 * teammate will shoot, and the goalie will attempt to save it. The same works
 * for the other team." And: a penalty your team wins while you are not on the
 * ball, or not on penalties, is taken by a team-mate live on the pitch.
 *
 * ── One engine ──
 *
 * Nothing in this file moves a ball. A team-mate's kick is the SAME strike a
 * player's kick is — `launch()` with an aim, a power and a contact point, then
 * the match's own flight loop and the match's own penalty keeper
 * (penaltyKeeper.ts) — run by CanvasMatch, the one file allowed to run it.
 * This file only decides the aim, the way a player's drag decides it: a plan,
 * handed to the match, which strikes it through `handleContact`.
 *
 * Pure: no React, no canvas. Every random draw is handed in.
 */
import { loftRange, type Scenario } from "./canvasEngine";
import { CX, POST_L, POST_R } from "./pitch";

// ── Who takes it ─────────────────────────────────────────────────────────────

export interface PenaltyTaker {
  id: string;
  name: string;
  shortName: string;
  /** A real photo when there is one. */
  face?: string;
  /** 0-100: how good he is from the spot. */
  rating: number;
  /** Goalkeepers take one last, if a shootout ever gets that far. */
  isGK?: boolean;
  /** This taker is the player (you). */
  you?: boolean;
}

/** A team-mate's (or an opponent's) penalty ability: his finishing, then his overall. */
export function takerRating(p: { shooting?: number; overall?: number }): number {
  const r = p.shooting ?? p.overall ?? 62;
  return Math.max(25, Math.min(99, Number.isFinite(r) ? r : 62));
}

/**
 * Your penalty rating, on the same 0-100 scale as a team-mate's finishing: the
 * dead ball you would strike it with (60 % free kick, 40 % technique — exactly
 * what `setPieceSkills` gives the engine for a penalty) plus a little for being
 * a star. Only used to decide the ORDER of a shootout.
 */
export function yourPenaltyRating(skills: { technique: number; freeKick: number }, stars: number): number {
  const strike = skills.technique * 0.4 + skills.freeKick * 0.6;
  return Math.max(25, Math.min(99, strike + Math.max(0, stars) * 3));
}

/**
 * You are always one of your side's five takers — the kicks a manager names.
 * Final playtest (27 Sep 2026): ranked purely on rating, a player with a
 * modest dead ball (52 against a squad of 62s) went 10th of 11, so a shootout
 * almost never reached him — 0 kicks in 4 shootouts. Within the five, your
 * rating still decides where (a weaker taker goes 5th).
 */
export const YOU_WITHIN_FIRST = 5;

/**
 * The order a side takes a shootout in: best takers first, you where your own
 * penalty rating puts you — but never later than kick `youBy` (default: one of
 * the five) — the keeper last. Wraps after the eleventh kick (shootout.ts's
 * `nextTakerIndex`), the way a real shootout does.
 */
export function shootoutOrder(mates: PenaltyTaker[], you?: PenaltyTaker | null, youBy = YOU_WITHIN_FIRST): PenaltyTaker[] {
  const outfield = mates.filter((p) => !p.isGK);
  const keepers = mates.filter((p) => p.isGK);
  const all = you ? [...outfield, you] : outfield;
  // Stable: equal ratings keep the order they came in.
  const ranked = all.map((p, i) => ({ p, i })).sort((a, b) => b.p.rating - a.p.rating || a.i - b.i).map((x) => x.p);
  if (you) {
    const at = ranked.indexOf(you), latest = Math.max(0, youBy - 1);
    if (at > latest) { ranked.splice(at, 1); ranked.splice(latest, 0, you); }
  }
  return [...ranked, ...keepers];
}

/** The team's penalty taker in open play: the best outfield taker on the pitch. */
export function designatedTaker(mates: PenaltyTaker[]): PenaltyTaker | null {
  const outfield = mates.filter((p) => !p.isGK);
  if (outfield.length === 0) return null;
  return outfield.reduce((best, p) => (p.rating > best.rating ? p : best), outfield[0]);
}

// ── Stars count for more towards the duty (item 6) ──────────────────────────
// The rule itself lives with the duty: lib/star/setPieces.ts.
export { PENALTY_STAR_WEIGHT } from "./setPieces";

// ── Where he puts it ─────────────────────────────────────────────────────────

/**
 * A planned penalty, the same three things a player's own kick is made of:
 *   off   — where on the goal line he aims, metres from the middle (+ = right)
 *   cy    — where on the ball he strikes it (-1 top … +1 bottom): its height
 *   power — how hard, 0-1 (a player's drag length)
 */
export interface PenaltyPlan { off: number; cy: number; power: number; style: "placed" | "middle" | "chip" }

/**
 * A real taker's penalty. The spread is the one tests/star/penaltyKeeper.mts
 * measures the keeper against ("a realistic spread of kicks": 70 % placed
 * 1.4 m-to-the-post, 20 % down the middle, 10 % chipped), leaned by how good
 * he is: a better taker goes for the corner more, gets closer to the post and
 * hits it a little harder. His accuracy is not decided here — the engine's
 * own strike noise does that from his technique, exactly as it does for you.
 */
export function planPenalty(rating: number, rng: () => number): PenaltyPlan {
  const q = Math.max(0, Math.min(1, (rating - 45) / 50));
  const tech = takerSkills(rating).technique;
  const u = rng();
  const middleShare = 0.16;
  const chipShare = 0.05;
  const side = rng() < 0.5 ? -1 : 1;
  // A good taker strikes it firmer and truer: the pace is what beats a dive.
  const power = () => Math.min(0.94, 0.6 + 0.2 * q + rng() * 0.14);
  if (u < chipShare) {
    return { style: "chip", off: (rng() - 0.5) * 0.6, power: 0.4 + rng() * 0.05, cy: sameHeight(0.3 + rng() * 0.45, tech) };
  }
  if (u < chipShare + middleShare) {
    return { style: "middle", off: (rng() - 0.5) * 0.8, power: power(), cy: sameHeight(-1 + rng() * 1.2, tech) };
  }
  // Placed: 1.4 m off-centre to just inside the post; a good taker goes for
  // the corner a little more often.
  const reach = Math.pow(rng(), 0.5 - 0.12 * q);
  return {
    style: "placed",
    off: side * (1.4 + 2.0 * reach),
    power: power(),
    cy: sameHeight(-1 + rng() * 1.2, tech),
  };
}

/**
 * The contact that gives a technique-`tech` striker the same height a
 * technique-60 one gets from `cy60` — the aim model is measured at 60, and a
 * better technique reaches more of the ball (the engine's `loftRange`), so
 * the same intended height is a smaller contact. Matches launch()'s own
 * `loft × tMax` (the square of the lift), which is what sets the height.
 */
export function sameHeight(cy60: number, tech: number): number {
  const L60 = loftRange(60), LT = loftRange(tech);
  const target = ((cy60 * L60 + 1) / 2) * ((L60 + 1) / 2);
  const cy = (target / ((LT + 1) / 2) * 2 - 1) / LT;
  return Math.max(-1, Math.min(1, cy));
}

/**
 * A taker's striking skills, as the engine reads them. Technique is his
 * rating — the engine turns it into accuracy. Power is a typical player's
 * (60, the same the aim model is measured with), so a great finisher is a
 * more accurate one, not simply a harder hitter who balloons it.
 */
export function takerSkills(rating: number): { power: number; technique: number } {
  return { power: 60, technique: Math.round(Math.max(25, Math.min(99, rating))) };
}

/** The drag a plan stands for: a direction from the ball to the aim point, a power and a contact. */
export function aimFor(sc: Pick<Scenario, "ball" | "goal">, plan: PenaltyPlan): {
  dir: { x: number; y: number }; power: number; contact: { cx: number; cy: number };
} {
  const cx = sc.goal ? (sc.goal.x1 + sc.goal.x2) / 2 : CX;
  const tx = Math.max(POST_L - 1.5, Math.min(POST_R + 1.5, cx + plan.off));
  const dx = tx - sc.ball.x, dy = 0 - sc.ball.y;
  const L = Math.hypot(dx, dy) || 1;
  return { dir: { x: dx / L, y: dy / L }, power: plan.power, contact: { cx: 0, cy: plan.cy } };
}

// ── The kick the match takes for you ────────────────────────────────────────

/**
 * An automatic kick, carried on the picture it is struck from. The match
 * reads it when the picture loads: it draws the taker in his own shirt and
 * the keeper in his, holds the run-up for a beat, then strikes the plan
 * through the same `launch()` a player's kick goes through.
 */
export interface AutoKick {
  /** "us" — your team-mate, at their keeper. "them" — their taker, at yours. */
  side: "us" | "them";
  taker: PenaltyTaker;
  plan: PenaltyPlan;
  /** The keeper facing him (his real rating and face where the squad has one). */
  keeper?: { strength: number; id?: string; name?: string; shortName?: string; face?: string };
  /** A shootout kick, or a penalty in open play. */
  context: "shootout" | "match";
}
export type AutoKickScenario = Scenario & { autoKick?: AutoKick };

export function attachAutoKick(sc: Scenario, k: AutoKick): AutoKickScenario {
  (sc as AutoKickScenario).autoKick = k;
  return sc as AutoKickScenario;
}
export function autoKickOf(sc: Scenario | null | undefined): AutoKick | undefined {
  return (sc as AutoKickScenario | null | undefined)?.autoKick;
}

/**
 * How long the taker stands a few steps back before he starts his run-up,
 * ms. The run-up itself is a player's (penaltyRunup.ts, 2.4 s), so a kick you
 * watch looks exactly like one you take.
 */
export const AUTO_STAND_MS = 700;

/**
 * A shootout picture: just the taker, the ball and the keeper. Everybody else
 * is in the centre circle, so the men on the edge of the box are taken off
 * (the same way `stageScene` takes off team-mates — nothing is deleted from
 * the engine, the defenders list is simply empty).
 */
export function clearForShootout(sc: Scenario): void {
  sc.defenders = [];
}

/**
 * The conversion of a penalty the unseen match hands a team-mate while you
 * are off the pitch (on the bench, or after being substituted). The same
 * number a live team-mate's kick measured at on the real engine against a
 * typical keeper (tests/star/penaltyTaking.mts): 78 % in the prototype,
 * 76.1 % with the v0.15 keeper and the run-up (takers 70-85, keeper 62).
 */
export const OFF_PITCH_PEN_CONVERT = 0.76;
