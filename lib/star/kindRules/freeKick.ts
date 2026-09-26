/**
 * The free-kick ruleset — see ./index.ts for how rules plug into the match.
 *
 * Harry, 26 Sep 2026, from real Premier League numbers: direct free kicks
 * that go in were 3.9% in 2023/24 (11 of 283), the lowest on record; the best
 * specialists sit at 12-15% (Ward-Prowse 17/137, Mata 9/60); the median shot
 * is taken 27.6 m out. Laws: the wall stands 9.15 m from the ball; a central
 * 20-25 m free kick gets a wall of four to six; the keeper stays on his line.
 *
 * ── What was wrong (measured, tests/star/freeKickRules.mts) ──
 *
 * The keeper stood still for the whole flight, wherever he happened to be
 * standing (a random ±1.25 m, on the wall's side as often as not), so any
 * ball that got past the wall and more than his arm's length from him went in.
 * A sensible taker — one who picks over, round or under the wall and then
 * misses his intended line by a realistic amount — scored about three in four.
 *
 * ── The rules ──
 *
 *  1. Where it is taken: 18-30 m from the goal, within 8 m of the centre
 *     (central to slightly wide; a wider one becoming a cross is LATER).
 *  2. The wall: 9.15 m from the ball, facing it. Its end man lines up just
 *     outside the NEAR post (the post on the ball's side) and the rest build
 *     inward from him. Size by angle: 4-5 men central, 3-4 half-angled,
 *     2-3 at an angle.
 *  3. The keeper: on his line, cheated toward the FAR post — the half of the
 *     goal the wall does not cover.
 *  4. At the strike: most walls jump; about one in seven is told to stay
 *     down (which is what makes going under it a gamble, not a free goal).
 *  5. In flight: the keeper cannot see the ball through his wall. Once it has
 *     passed the wall he reacts after a beat and shuffles across on the line
 *     it is travelling — so pace, a late curl and the far corners beat him,
 *     and a ball he has time to read does not.
 *
 * Everything is ADDED: people are moved and the keeper's public fields
 * (x/startX/targetX/adjusting) are set; canvasEngine.ts is not touched.
 */
import type { KindRule, StrikeDecision } from "./index";
import type { Ball, Scenario } from "../canvasEngine";
import { CX, GOAL_W, POST_L, POST_R, ARC_R } from "../pitch";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Every dial in one place. */
export const FREE_KICK = {
  /** Rule 1 — metres from the goal centre, and from the centre line. */
  minDist: 18,
  maxDist: 30,
  maxLateral: 8,
  /** Rule 2 — the wall. */
  wallGap: ARC_R,            // 9.15 m, the law
  wallSpacing: 1.0,          // shoulder to shoulder, still reads as separate men
  postManOutside: 0.45,      // the end man stands this far outside the near-post line
  /** Rule 3 — the keeper's cheat toward the far post, metres off centre. */
  keeperCheat: [0.35, 0.95] as [number, number],
  /** Rule 4 — chance the whole wall stays down instead of jumping. */
  wallStaysDown: 0.15,
  /** Rule 5 — the keeper's read once he can see it. */
  reactS: [0.14, 0.26] as [number, number],   // seconds from seeing it to moving
  reactPerPoint: 0.0025,                       // quicker per keeper point above 62
  readLagS: 0.08,                              // he reads where it WAS, a beat ago
  sightedPast: 0.4,                            // metres beyond the wall line before he sees it
  dive: true,                                  // across at the engine's dive speed, not a shuffle
};

/** Wall size for how far off centre the kick is (degrees off the goal's axis). */
export function wallSizeFor(angleDeg: number, draw: number): number {
  if (angleDeg < 10) return draw < 0.55 ? 5 : 4;
  if (angleDeg < 18) return draw < 0.5 ? 4 : 3;
  return draw < 0.5 ? 3 : 2;
}

export interface FreeKickSetup { side: number; wall: number; moved: boolean }

/**
 * Rules 1-3. `appliedAuthored`: a hand-drawn free kick keeps the drawn ball
 * spot (only pulled into the legal range); a procedural one gets its distance
 * redrawn across the full real range.
 */
export function setupFreeKick(sc: Scenario, rng: () => number, appliedAuthored = false): FreeKickSetup {
  const F = FREE_KICK;
  // The wall is whoever the builder or drawing stood near the ball; a marker
  // drawn elsewhere (a man on the edge of the box) is left where he is.
  // Read before the ball moves.
  const holders = sc.defenders.filter((d) => Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 12.5);
  // ── Rule 1: where ──
  let moved = false;
  {
    const b = sc.ball;
    let lat = clamp(b.x - CX, -F.maxLateral, F.maxLateral);
    let dist = Math.hypot(lat, b.y);
    if (!appliedAuthored) {
      // Real distances run 18-30 m with the middle of them around 24-28 m:
      // the mean of two draws leans toward the middle without a hard peak.
      dist = F.minDist + ((rng() + rng()) / 2) * (F.maxDist - F.minDist);
    }
    dist = clamp(dist, F.minDist, F.maxDist);
    lat = clamp(lat, -Math.min(F.maxLateral, dist - 1), Math.min(F.maxLateral, dist - 1));
    const depth = Math.sqrt(Math.max(1, dist * dist - lat * lat));
    // Keep it inside the frame the scenario was built with.
    const vp = sc.viewport;
    const yMax = vp ? vp.y2 - 3.5 : depth;
    const ny = Math.min(depth, yMax);
    const nx = CX + lat;
    if (Math.abs(nx - b.x) > 1e-6 || Math.abs(ny - b.y) > 1e-6) {
      const dx = nx - b.x, dy = ny - b.y;
      sc.player = { x: sc.player.x + dx, y: sc.player.y + dy };
      sc.ball = { x: nx, y: ny };
      moved = true;
    }
  }
  const b = sc.ball;

  // ── Rule 2: the wall ──
  const lat = b.x - CX;
  const side = Math.abs(lat) < 1 ? (rng() < 0.5 ? -1 : 1) : Math.sign(lat);
  const angle = (Math.atan2(Math.abs(lat), b.y) * 180) / Math.PI;
  const n = wallSizeFor(angle, rng());
  const nearPost = { x: CX + side * (GOAL_W / 2), y: 0 };
  const u = norm({ x: nearPost.x - b.x, y: nearPost.y - b.y });
  // Across the kick, pointing from the near post toward the goal's middle.
  let across = { x: -u.y, y: u.x };
  if (across.x * -side < 0) across = { x: -across.x, y: -across.y };
  const anchor = {
    x: b.x + u.x * F.wallGap - across.x * F.postManOutside,
    y: b.y + u.y * F.wallGap - across.y * F.postManOutside,
  };
  const wall: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    let p = { x: anchor.x + across.x * F.wallSpacing * i, y: anchor.y + across.y * F.wallSpacing * i };
    // Never closer than the law allows.
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < F.wallGap) p = { x: b.x + ((p.x - b.x) / d) * F.wallGap, y: b.y + ((p.y - b.y) / d) * F.wallGap };
    wall.push(p);
  }
  // Re-use the builder's men first (they carry any real faces), then add or
  // drop to the size the angle asks for. Anyone else stays exactly where he is.
  const others = sc.defenders.filter((d) => !holders.includes(d));
  const men = holders.slice(0, n);
  while (men.length < n) men.push({ x: 0, y: 0 });
  men.forEach((m, i) => { m.x = wall[i].x; m.y = wall[i].y; m.z = 0; m.vz = 0; });
  sc.defenders = [...men, ...others];

  // ── Your team-mate stands over the ball with you ──
  // He used to wait at the penalty spot, goal-side of the wall, so every
  // rebound he touched was flagged offside — and stood level with the wall
  // instead (measured) he followed in 7% of all free kicks, because the wall
  // holds its ground while the ball is live and nobody marks him. Real direct
  // free kicks have the second man over the ball; that is where he goes.
  sc.follower.x = clamp(b.x + side * 2.6, 2, 66);
  sc.follower.y = b.y + 2.6;   // 3.7 m off, clear of the 2 m a man takes a ball in

  // ── Rule 3: the keeper ──
  const k = sc.keeper;
  const cheat = F.keeperCheat[0] + rng() * (F.keeperCheat[1] - F.keeperCheat[0]);
  k.x = clamp(CX - side * cheat, POST_L + 0.6, POST_R - 0.6);
  k.startX = k.x;
  k.targetX = k.x;
  k.adjusting = false;
  k.scrambling = false;

  return { side, wall: n, moved };
}

function norm(v: { x: number; y: number }) {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

// ── Rules 4-5: at the strike, and in flight ─────────────────────────────────

interface FlightState {
  t: number;
  seenAt: number | null;
  trail: { t: number; x: number; y: number; vx: number; vy: number }[];
  wallDist: number;
}
const flights = new WeakMap<Ball, FlightState>();

/** Seconds from seeing it to moving, from a uniform draw and his rating. */
export function freeKickReaction(draw: number, keeperStrength: number): number {
  const F = FREE_KICK;
  const base = F.reactS[0] + draw * (F.reactS[1] - F.reactS[0]);
  return clamp(base - (keeperStrength - 62) * F.reactPerPoint, 0.08, 0.4);
}

export const freeKickRules: KindRule = {
  setup(sc, rng, ctx) {
    if (sc.kind !== "free_kick") return;
    setupFreeKick(sc, rng, ctx.appliedAuthored);
  },
  draws: 2,
  decide(sc, ball, draws, ctx): StrikeDecision | null {
    if (sc.kind !== "free_kick") return null;
    return {
      kind: "free_kick",
      data: {
        jump: draws[0] >= FREE_KICK.wallStaysDown,
        react: freeKickReaction(draws[1], ctx.keeperStrength),
      },
    };
  },
  apply(sc, ball) {
    // Fresh per strike, so a replay starts from nothing exactly as the live
    // strike did; nothing is written back into the saved decision.
    const wall = sc.defenders.filter((d) => d.baseRole === "hold");
    const wallDist = wall.length
      ? Math.min(...wall.map((d) => Math.hypot(d.x - ball.pos.x, d.y - ball.pos.y)))
      : 0;
    flights.set(ball, { t: 0, seenAt: null, trail: [], wallDist });
  },
  step(sc, ball, dt, d) {
    const st = flights.get(ball);
    if (!st) return;
    st.t += dt;
    // Rule 4: a wall told to stay down never leaves the turf. The engine starts
    // the jump once a man has been "ready" for a tenth of a second; holding
    // that clock at zero keeps him grounded.
    if (d.data.jump === false) {
      for (const m of sc.defenders) if (m.baseRole === "hold") m.containT = 0;
    }
    const k = sc.keeper;
    // Only the shot you struck, only while it is still coming at him.
    // Once the engine has had its say (a save, a spill) he is its business again.
    if (k.done || k.saves > 0 || ball.lastTouch !== "attack" || ball.loose || ball.pos.y <= k.y) {
      if (k.adjusting && !k.scrambling) k.adjusting = false;
      flights.delete(ball);
      return;
    }
    st.trail.push({ t: st.t, x: ball.pos.x, y: ball.pos.y, vx: ball.vel.x, vy: ball.vel.y });
    // Rule 5: unsighted until it is past his wall.
    if (st.seenAt === null) {
      const from = sc.ball;
      if (Math.hypot(ball.pos.x - from.x, ball.pos.y - from.y) < st.wallDist + FREE_KICK.sightedPast) return;
      st.seenAt = st.t;
    }
    const react = Number(d.data.react ?? 0.2);
    if (st.t < st.seenAt + react) return;
    const seen = st.t - FREE_KICK.readLagS;
    let s = st.trail[0];
    for (const p of st.trail) { if (p.t <= seen) s = p; else break; }
    while (st.trail.length > 2 && st.trail[1].t <= seen) st.trail.shift();
    if (s.vy >= -0.5) return;
    const xAt = s.x + s.vx * ((s.y - k.y) / -s.vy);
    k.targetX = clamp(xAt, POST_L - 0.8, POST_R + 0.8);
    // A set keeper goes across the way he does for anything he has seen: the
    // engine's own scramble (dive speed, lean and all) when FREE_KICK.dive,
    // else the slower shuffle.
    if (FREE_KICK.dive) k.scrambling = true;
    else k.adjusting = true;
  },
};
