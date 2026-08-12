import type { SquadPlayer } from "./types";
import type { Identity, Scenario, Runner } from "./canvasEngine";
import { goalInView } from "./canvasEngine";

/**
 * THE TEAM SHEET.
 *
 * Every blue shirt on the pitch is a man out of your squad, and the engine is
 * told which is which before a ball is kicked.
 *
 * It used not to be. A situation contained a `runner`, some `secondaryRunners`,
 * a poacher and a `receiver` carrying a role label — "the striker", "the
 * attacking midfielder" — and that label was the whole of anybody's identity.
 * So you played the pass, a team-mate scored, and the game had nothing to
 * attribute it to: the commentary said "the attacking midfielder finishes it
 * off", the goal went down as a team goal, and the squad screen showed nobody
 * with anything against their name. Reported as exactly that.
 *
 * The rule now: whoever is standing there is somebody, whoever gets on the end
 * of it is that somebody, and the goal, the assist and the commentary all read
 * off the same man.
 *
 * ── How the shirts are handed out ──
 *
 * By where the man is standing and what the situation is asking of him, not at
 * random. A poacher in the six-yard box is your centre-forward; the outlet in a
 * build-up thirty metres out is a midfielder; the man arriving at the far post
 * from a corner might be a centre-half. Each is filled by the best available
 * player for that shape, so your best finisher tends to be the one in the box —
 * which is both how a team is picked and what makes "Salah scores" land.
 *
 * Nobody appears twice in the same situation, and the whole thing is driven off
 * the scenario's own seeded rng, so a match replays identically.
 */

type Pos = SquadPlayer["position"];

const idOf = (p: SquadPlayer): Identity => ({
  id: p.id, name: p.name, shortName: p.shortName, position: p.position,
});

/**
 * Who plays where, in preference order.
 *
 * First choice is the position the role IS; the rest are who else would
 * plausibly be standing there. Everything falls through to "any outfielder",
 * because a shirt with nobody in it is worse than a full-back on the end of a
 * cross — which, in fairness, happens.
 */
const ROLE_POSITIONS: Record<string, Pos[]> = {
  "the striker": ["ST", "CAM", "LW", "RW"],
  "the attacking midfielder": ["CAM", "CM", "LW", "RW", "ST"],
  "the winger": ["LW", "RW", "CAM", "ST"],
  "the center-back": ["CB", "CDM", "LB", "RB"],
  "the far-post runner": ["ST", "LW", "RW", "CB"],
  "the midfielder arriving": ["CM", "CAM", "CDM"],
};

/** Where on the pitch a man is standing, translated into what he probably is. */
function positionsForSpot(sc: Scenario, y: number, wide: boolean): Pos[] {
  // In and around the box, with a goal to attack.
  if (goalInView(sc.kind) && y < 20) {
    return wide ? ["LW", "RW", "ST", "CAM"] : ["ST", "CAM", "LW", "RW"];
  }
  if (y < 34) return wide ? ["LW", "RW", "CAM", "CM"] : ["CAM", "CM", "ST", "LW"];
  if (y < 46) return wide ? ["LB", "RB", "CM", "LW"] : ["CM", "CDM", "CAM"];
  return wide ? ["LB", "RB", "CB"] : ["CDM", "CB", "CM"];
}

/**
 * Hand out one shirt.
 *
 * Best available by the preference list, then best available outfielder, then
 * nothing — and nothing is a legitimate answer, because a career can be a
 * sandbox match with no squad behind it at all.
 */
function claim(pool: SquadPlayer[], taken: Set<string>, prefer: Pos[]): Identity | undefined {
  for (const want of prefer) {
    let best: SquadPlayer | undefined;
    for (const p of pool) {
      if (taken.has(p.id) || p.position !== want) continue;
      if (!best || (p.overall ?? 0) > (best.overall ?? 0)) best = p;
    }
    if (best) { taken.add(best.id); return idOf(best); }
  }
  let any: SquadPlayer | undefined;
  for (const p of pool) {
    if (taken.has(p.id) || p.position === "GK") continue;
    if (!any || (p.overall ?? 0) > (any.overall ?? 0)) any = p;
  }
  if (any) { taken.add(any.id); return idOf(any); }
  return undefined;
}

/**
 * Put the squad on the pitch.
 *
 * Call once, on a built scenario, before it is played. Safe to call with an
 * empty squad — every figure simply keeps the role label it already had.
 */
export function castScenario(sc: Scenario, squad: SquadPlayer[]): void {
  const pool = squad.filter(p => p.position !== "GK");
  if (pool.length === 0) return;
  const taken = new Set<string>();

  // The man the pass is aimed at goes first — he is the point of the situation,
  // so he gets first pick of the shirts that fit where he is standing.
  const order: Runner[] = [
    ...(sc.runner ? [sc.runner] : []),
    ...sc.secondaryRunners.filter(r => r.role === "target"),
    ...sc.secondaryRunners.filter(r => r.role !== "target"),
  ];
  for (const r of order) {
    const wide = Math.abs(r.pos.x - 34) > 13;
    r.who = claim(pool, taken, positionsForSpot(sc, r.pos.y, wide));
  }

  // The poacher. He lives on the penalty spot waiting for a spill, which is a
  // centre-forward's job and nobody else's.
  if (goalInView(sc.kind)) {
    sc.follower.who = claim(pool, taken, ["ST", "CAM", "LW", "RW"]);
  }

  // The man who crossed it, on the two situations that arrive from somebody.
  if (sc.teammates.length > 0) {
    const t = sc.teammates[0];
    const wide = Math.abs(t.x - 34) > 13;
    sc.crosser = claim(pool, taken, wide ? ["LW", "RW", "LB", "RB"] : ["CAM", "CM", "LW", "RW"]);
  }

  // And the finisher, if the situation rolled one. He is provisional: whoever
  // the ball actually reaches overwrites this at reception. It matters only for
  // the chances nobody is found in — and for the poacher, who is not a runner.
  if (sc.receiver && !sc.receiver.who) {
    const prefer = ROLE_POSITIONS[sc.receiver.roleLabel];
    const already = order.find(r => r.who)?.who;
    sc.receiver.who = prefer
      ? claim(pool, new Set(taken), prefer)   // may double up with a runner; he is the same man
      : already;
  }
}

/**
 * The creator of a goal YOU scored.
 *
 * Only ever a man who was actually part of the move: the one who crossed it, or
 * the one who played you in. Returns nothing otherwise, and nothing is the right
 * answer — a goal you cut in and curled home from twenty-five yards has no
 * assist, and inventing one out of the squad list (which is what this used to
 * do, 65% of the time) put goals against players who had not been on the screen.
 */
export function creatorOf(sc: Scenario): Identity | undefined {
  return sc.crosser;
}
