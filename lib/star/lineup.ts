import type { SquadPlayer } from "./types";
import type { Identity, Scenario, Runner, ScenarioKind } from "./canvasEngine";
import { goalInView } from "./canvasEngine";
import { fakeFaceFor } from "./fakeFaces";

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
  id: p.id, name: p.name, shortName: p.shortName, position: p.position, overall: p.overall,
  // A real photo when he has one; otherwise a stable fake face rather than
  // the plain "no photo" circle drawPlayerHead used to fall back to.
  // Resolved here, at the point a squad player actually becomes something
  // drawn on the pitch — `p.imageUrl` itself stays genuinely absent (see
  // its own doc), since a staleness check elsewhere reads that real gap.
  face: p.imageUrl ?? fakeFaceFor(p.id),
  pace: p.pace, shooting: p.shooting, passing: p.passing,
  dribbling: p.dribbling, defending: p.defending, physical: p.physical,
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
  /**
   * Once the exact preference list is exhausted (every candidate at those
   * positions already claimed elsewhere in the same scenario — several
   * runners, a poacher and a crosser can all want from the same small
   * pool), this used to fall back to the single highest-overall outfielder
   * left, position ignored entirely. Reported directly, from real play:
   * "why am i seeing centre backs in attack over midfielders" — the exact
   * same "highest overall wins regardless of position" shape the
   * opposition-defenders bug had (see orderDefensively's own doc), just on
   * the other side of the ball and via a different mechanism (an
   * exhausted-pool fallback rather than a wrong sort direction).
   *
   * `prefer[0]` is the role's own truest signal of what it actually is —
   * stay within that broad attacking-vs-defensive category first, so an
   * attacking role can't reach for a centre-back just because he outrates
   * whoever else is left forward. Genuinely falls through to anyone once
   * THAT narrower pool is also exhausted — a centre-back still ends up
   * forward as the real last-man-standing case, which does happen at a
   * corner (see "the far-post runner"'s own explicit CB entry above).
   */
  const wantDefensive = prefer.length > 0 && DEFENSIVE_POSITIONS.has(prefer[0]);
  for (const stayInCategory of [true, false]) {
    let any: SquadPlayer | undefined;
    for (const p of pool) {
      if (taken.has(p.id) || p.position === "GK") continue;
      if (stayInCategory && DEFENSIVE_POSITIONS.has(p.position) !== wantDefensive) continue;
      if (!any || (p.overall ?? 0) > (any.overall ?? 0)) any = p;
    }
    if (any) { taken.add(any.id); return idOf(any); }
  }
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

  // The man who crossed it, on the two situations that arrive from somebody
  // — and every OTHER body standing around, most visibly the extra men a
  // corner puts in the box. `teammates[0]` alone used to be the only one
  // that was ever really somebody; CanvasMatch.tsx's own face-drawing loop
  // (`i === 0 ? ... : undefined`) was being honest about a real gap, not
  // misreading real data — reported directly: "on corners not all players
  // face show." Cast the same way a runner standing in the same spot would
  // be (positionsForSpot, reused rather than a second heuristic), off the
  // same shared `taken` set so nobody doubles up with a runner or the
  // poacher.
  if (sc.teammates.length > 0) {
    const t0 = sc.teammates[0];
    const wide0 = Math.abs(t0.x - 34) > 13;
    sc.crosser = claim(pool, taken, wide0 ? ["LW", "RW", "LB", "RB"] : ["CAM", "CM", "LW", "RW"]);
    t0.who = sc.crosser;
    for (let i = 1; i < sc.teammates.length; i++) {
      const t = sc.teammates[i];
      const wide = Math.abs(t.x - 34) > 13;
      t.who = claim(pool, taken, positionsForSpot(sc, t.y, wide));
    }
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
 * The other end of the same idea, for the other shirts.
 *
 * `castScenario` puts a name to every blue shirt; nothing has ever put one to
 * a red one. The keeper and the men marking you are drawn from the real
 * opposing XI when there is one — same photo the pre-match team sheet
 * already shows (see opponentStartingXI, teamsheet.ts) — so a defender on
 * screen is Van Dijk rather than a generic dot with no name behind it.
 *
 * Deliberately not the nuanced position-preference matching `claim` does
 * above: nobody scores or gets an assist off a Defender or a Keeper, so
 * there is no wrong-man-credited bug to guard against here, only a face to
 * put on the right kind of figure. The keeper is whoever the sheet has at
 * GK; outfield defenders are matched to the sheet's outfield men by how far
 * back each is standing, closest-to-goal first on both sides, which is
 * enough to usually put a real centre-back's face on the man actually
 * defending centrally rather than on a winger tracking back.
 *
 * Purely cosmetic — see Defender.who / Keeper.who. Safe to call with
 * nothing to scout (an international fixture, a side too thin for a sheet,
 * a sandbox match with no career at all): every figure just keeps drawing
 * as the plain shirt it always has.
 */
export interface OpponentSheetPlayer {
  id: string;
  name: string;
  shortName: string;
  position: string;
  overall?: number;
  face?: string;
  isGK: boolean;
  y: number;
  /** See Identity's own six attribute fields. */
  pace?: number;
  shooting?: number;
  passing?: number;
  dribbling?: number;
  defending?: number;
  physical?: number;
}

/** Positions that actually defend — used to prefer a real defender's face
 *  for a real defender, rather than trusting formation depth (`y`) alone.
 *  See orderDefensively's own doc for why depth alone was not safe here. */
const DEFENSIVE_POSITIONS = new Set(["CB", "LB", "RB", "CDM"]);

/**
 * Real outfielders, genuinely defensive ones first — CB/LB/RB/CDM, deepest
 * first within that group — everyone else (CM/CAM/wingers/strikers) after,
 * as a fallback for when a scenario needs more defenders drawn than the
 * side actually has back-four-or-holding-mid players.
 *
 * A real, live bug lived in a plain depth sort this replaces: formations.ts's
 * own `y` scale runs `GK = 0.94` down to `FWD = 0.17` — HIGHER y is DEEPER,
 * toward the side's own goal. Sorting ascending (the way this used to) put
 * the LOWEST y first, which is strikers and wingers, not defenders — every
 * "defender" drawn on the pitch was actually the opposing attack. Reported
 * directly, from a real played match, once real faces made it obvious:
 * "the oppositions defenders are just the highest rated players im guessing
 * coz im seeing loads of attackers." Filtering by the real position label
 * first (rather than just correcting the sort direction and hoping depth
 * alone always tracks position) is the more robust fix — a CDM's `y` can
 * sit close to a CM's, and a real defender's face belongs on him regardless
 * of exactly where the two happen to rank against each other.
 *
 * Shared by castDefence (below) and the first-person dribble mode's own
 * roster (CanvasMatch.tsx) — both need the same real answer to "who on the
 * other side actually defends," not two copies of the same judgement call.
 */
export function orderDefensively(outfield: OpponentSheetPlayer[]): OpponentSheetPlayer[] {
  const byDepth = (a: OpponentSheetPlayer, b: OpponentSheetPlayer) => b.y - a.y;
  const real = outfield.filter(p => DEFENSIVE_POSITIONS.has(p.position)).sort(byDepth);
  const rest = outfield.filter(p => !DEFENSIVE_POSITIONS.has(p.position)).sort(byDepth);
  return [...real, ...rest];
}

export function castDefence(sc: Scenario, oppXI: OpponentSheetPlayer[] | null | undefined): void {
  if (!oppXI || oppXI.length === 0) return;
  const toIdentity = (p: OpponentSheetPlayer): Identity => ({
    id: p.id, name: p.name, shortName: p.shortName, position: p.position, overall: p.overall, face: p.face,
    pace: p.pace, shooting: p.shooting, passing: p.passing,
    dribbling: p.dribbling, defending: p.defending, physical: p.physical,
  });

  const gk = oppXI.find(p => p.isGK);
  if (gk) sc.keeper.who = toIdentity(gk);

  if (sc.defenders.length === 0) return;
  const pool = orderDefensively(oppXI.filter(p => !p.isGK));
  if (pool.length === 0) return;
  const defenders = [...sc.defenders].sort((a, b) => a.y - b.y);
  defenders.forEach((d, i) => {
    d.who = toIdentity(pool[i % pool.length]);
  });
}

/**
 * The creator of a goal YOU scored.
 *
 * ── Why this is generated rather than observed ──
 *
 * The engine only ever shows you the last touch of a move: you are handed a
 * ball and you strike it. Nobody passes it to you on screen, because there is no
 * screen before the screen. So the man who set you up is real football that the
 * highlight cannot contain, and if the game does not name him nobody ever gets
 * an assist for anything you score — which is what was happening.
 *
 * Preference order, and it matters. First the man who ACTUALLY put it into you,
 * on the two situations that arrive from somebody. Then one of the team-mates
 * who was on the pitch in that very scenario — he was there, you can see him.
 * Only then the squad at large, weighted toward the men who make goals.
 *
 * Three situations are left alone, because football leaves them alone: a
 * penalty and a free kick are never assisted, and a rebound you followed in was
 * created by whoever's shot came back, which was yours.
 */
const NEVER_ASSISTED: ScenarioKind[] = ["penalty", "free_kick"];

const CREATOR_WEIGHT: Record<string, number> = {
  LW: 18, RW: 18, CAM: 16, CM: 12, ST: 9, LB: 7, RB: 7, CDM: 4, CB: 2, GK: 0.2,
};

export function creatorOf(sc: Scenario, squad: SquadPlayer[] = [], rng?: () => number): Identity | undefined {
  if (NEVER_ASSISTED.includes(sc.kind)) return undefined;
  // The man who crossed it. Real, and always preferred.
  if (sc.crosser) return sc.crosser;

  // Somebody who was on the pitch with you. Also real.
  const onPitch = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]
    .map(r => r.who)
    .filter((w): w is Identity => !!w);
  if (onPitch.length > 0) {
    const i = rng ? Math.floor(rng() * onPitch.length) : 0;
    return onPitch[Math.min(i, onPitch.length - 1)];
  }

  // Nobody identifiable was in frame. Somebody still played the pass that got
  // the ball to you — pick whoever in the squad most plausibly did.
  const pool = squad.filter(p => p.position !== "GK");
  if (pool.length === 0) return undefined;
  let total = 0;
  const w = pool.map((p) => {
    const x = CREATOR_WEIGHT[p.position] ?? 5;
    total += x;
    return x;
  });
  let r = (rng ? rng() : 0.5) * total;
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return idOf(pool[i]);
  }
  const last = pool[pool.length - 1];
  return idOf(last);
}
