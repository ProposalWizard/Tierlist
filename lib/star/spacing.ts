/**
 * NOBODY STARTS ON TOP OF ANYBODY.
 *
 * Harry, playtest video (27 Sep 2026): a "duplicated player" — two of your
 * team-mates drawn on the same spot; when one ran, the other appeared from
 * underneath him. Measured before this, 400 chances a kind, two of your own
 * men within 0.6 m of each other at the start: through ball 75, build-up 52,
 * volley 36, header 18, one-on-one 8, long range 8, tight angle 5, byline
 * cross 5, midfield pass 4, cutback 3. The builder's own helpers placed them
 * independently (a support runner on the target's spot, the poacher on the
 * runner's), and nothing checked the whole picture afterwards.
 *
 * So, once a chance has been placed, every figure on both sides — you, the
 * keeper, the pass target, the poacher, support runners, team-mates and
 * defenders — is at least MIN_GAP from every other on his own side, and from
 * you and the keeper. An attacker and the man marking him (opposite sides)
 * may stand as close as MARKING_GAP: Harry draws his corners with the markers
 * tight on their men (median 0.2 m apart), and pulling them to 1.2 m undid his
 * drawing on 184 corners in 400 (v0.15 follow-up). Where two are closer, the
 * LESS important of the two moves, by the shortest distance that makes room
 * without making the picture illegal: no new offside, no new fault of the
 * kind's own (scenarioFaults), no new break of the laws scanned off its
 * drawings. You and the keeper never move; a free kick's wall is shoulder to
 * shoulder on purpose, so its men may stand closer to each other.
 */
import { goalInView, type Scenario, type Vec2 } from "./canvasEngine";
import { scenarioFaults } from "./baseScenario";
import { ruleSetFor, sampleFromScenario } from "./authoredChance";
import { violations } from "./scenarioRules";
import { PITCH_W } from "./pitch";

/** How close two figures may start: two bodies plus a little air. */
export const MIN_GAP = 1.2;
/** An attacker and a defender marking him: tight, but not one body. */
export const MARKING_GAP = 0.6;
/** How far a figure may be moved to make room before we give up on him. */
const MAX_MOVE = 5;
const RING_STEP = 0.2;
const DIRS = 24;

type Side = "you" | "keeper" | "att" | "def";
interface Fig {
  p: Vec2;
  /** 0 = most important (never moves) … higher = moves first. */
  rank: number;
  side: Side;
  /** Also carried when he moves (a runner's `to`, a defender's home). */
  onMove?: (dx: number, dy: number) => void;
}

/** The engine parks a figure it does not want on screen far off the pitch. */
const parked = (p: Vec2) => p.x < -50 || p.x > PITCH_W + 50 || p.y > 150 || p.y < -50;

function figuresOf(sc: Scenario): Fig[] {
  const out: Fig[] = [
    { p: sc.player, rank: 0, side: "you" },
    { p: sc.keeper, rank: 1, side: "keeper" },
  ];
  if (sc.runner) {
    const r = sc.runner;
    out.push({
      p: r.pos, rank: 2, side: "att",
      onMove: (dx, dy) => {
        r.to = { x: r.to.x + dx, y: r.to.y + dy };
        if (sc.passTarget) sc.passTarget = { x: sc.passTarget.x + dx, y: sc.passTarget.y + dy };
      },
    });
  }
  if (goalInView(sc.kind) || !parked(sc.follower)) out.push({ p: sc.follower, rank: 3, side: "att" });
  for (const r of sc.secondaryRunners) {
    out.push({ p: r.pos, rank: 4, side: "att", onMove: (dx, dy) => { r.to = { x: r.to.x + dx, y: r.to.y + dy }; } });
  }
  // A free kick's wall is placed by Harry's own rule (9.15 m, sized by
  // angle): it never moves for anybody — whoever stands on it moves instead.
  const wallMan = (d: Vec2) => sc.kind === "free_kick" && Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 12.5;
  for (const d of sc.defenders) {
    out.push({
      p: d, rank: wallMan(d) ? 1 : 5, side: "def",
      onMove: (dx, dy) => {
        if (d.homeX !== undefined) d.homeX += dx;
        if (d.homeY !== undefined) d.homeY += dy;
      },
    });
  }
  for (const m of sc.teammates) out.push({ p: m, rank: 6, side: "att" });
  return out.filter((f) => !parked(f.p));
}

/** A free kick's wall stands a metre apart on purpose (freeKick.ts). */
function exempt(sc: Scenario, a: Fig, b: Fig): boolean {
  return sc.kind === "free_kick" && a.side === "def" && b.side === "def";
}

/** An attacker and a defender — a man and his marker. */
const marking = (a: Fig, b: Fig) =>
  (a.side === "att" && b.side === "def") || (a.side === "def" && b.side === "att");

/** How close this pair may stand: MIN_GAP (or the `gap` asked for) for two
 *  of one side and for you or the keeper; MARKING_GAP for a man and his
 *  marker (never more than the pair gap asked for). */
function pairGap(a: Fig, b: Fig, gap: number): number {
  return marking(a, b) ? Math.min(MARKING_GAP, gap) : gap;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** What is wrong with the picture now: its faults plus its drawn laws. */
function legalityOf(sc: Scenario): Set<string> {
  const out = new Set<string>(scenarioFaults(sc));
  const set = ruleSetFor(sc.kind);
  if (set) for (const v of violations(sampleFromScenario(sc), set)) out.add(`law:${v}`);
  return out;
}

/**
 * Move figures apart until nobody starts within MIN_GAP of anybody.
 * Returns how many moves were made. Deterministic: no random draws, so a
 * seeded chance still rebuilds to the same picture.
 */
export function separateBodies(sc: Scenario, gap = MIN_GAP): number {
  let moved = 0;
  const vp = sc.viewport;
  const givenUp = new Set<string>();

  /** Try to move `mover` clear of everybody; true if he found a legal spot. */
  const tryMove = (figs: Fig[], mover: Fig, other: Fig): boolean => {
    const before = legalityOf(sc);
    const others = figs.filter((f) => f !== mover);
    const home = { x: mover.p.x, y: mover.p.y };
    // Straight away from the man he is on top of first, then round the ring.
    // Exactly on top: sideways, away from the ball.
    let base = Math.atan2(home.y - other.p.y, home.x - other.p.x);
    if (dist(home, other.p) < 1e-3) base = home.x >= sc.ball.x ? 0 : Math.PI;
    for (let r = RING_STEP; r <= MAX_MOVE + 1e-9; r += RING_STEP) {
      for (let k = 0; k < DIRS; k++) {
        // 0, +1, -1, +2, -2 … steps round from straight away.
        const step = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2);
        const ang = base + (step * 2 * Math.PI) / DIRS;
        const c = { x: home.x + Math.cos(ang) * r, y: home.y + Math.sin(ang) * r };
        if (c.x < 0.5 || c.x > PITCH_W - 0.5 || c.y < 0.2) continue;
        if (vp && (c.x < vp.x1 + 0.5 || c.x > vp.x2 - 0.5 || c.y < vp.y1 + 0.2 || c.y > vp.y2 - 0.5)) continue;
        if (others.some((f) => !exempt(sc, f, mover) && dist(f.p, c) < pairGap(f, mover, gap))) continue;
        if (dist(c, sc.ball) < 0.8) continue;
        mover.p.x = c.x; mover.p.y = c.y;
        const after = legalityOf(sc);
        if (Array.from(after).every((f) => before.has(f))) {
          mover.onMove?.(c.x - home.x, c.y - home.y);
          return true;
        }
        mover.p.x = home.x; mover.p.y = home.y;
      }
    }
    return false;
  };

  for (let pass = 0; pass < 60; pass++) {
    const figs = figuresOf(sc);
    // The closest offending pair first (figuresOf's order is stable, so a
    // pair's indices name it across passes).
    let worst: [number, number] | null = null, worstD = Infinity;
    for (let i = 0; i < figs.length; i++) {
      for (let j = i + 1; j < figs.length; j++) {
        if (exempt(sc, figs[i], figs[j]) || givenUp.has(`${i}|${j}`)) continue;
        const d = dist(figs[i].p, figs[j].p);
        const need = pairGap(figs[i], figs[j], gap);
        // The worst offender is the one furthest inside its own allowance.
        if (d < need && d - need < worstD) { worstD = d - need; worst = [i, j]; }
      }
    }
    if (!worst) break;
    const [a, b] = [figs[worst[0]], figs[worst[1]]];
    // The less important one moves; if he cannot, the other one tries (unless
    // he is you or the keeper).
    const order = a.rank >= b.rank ? [a, b] : [b, a];
    let ok = false;
    for (const mover of order) {
      if (mover.rank <= 1) continue;
      if (tryMove(figs, mover, mover === a ? b : a)) { ok = true; break; }
    }
    if (ok) moved++;
    else givenUp.add(`${worst[0]}|${worst[1]}`);
  }
  return moved;
}

/** The smallest gap between two figures that must keep MIN_GAP — two of one
 *  side, or anybody and you or the keeper — for tests. */
export function closestFigures(sc: Scenario): number {
  const figs = figuresOf(sc);
  let best = Infinity;
  for (let i = 0; i < figs.length; i++) for (let j = i + 1; j < figs.length; j++) {
    if (exempt(sc, figs[i], figs[j]) || marking(figs[i], figs[j])) continue;
    best = Math.min(best, dist(figs[i].p, figs[j].p));
  }
  return best;
}

/** The smallest gap between an attacker and a defender (a man and his
 *  marker, who may stand MARKING_GAP apart), for tests. */
export function closestMarking(sc: Scenario): number {
  const figs = figuresOf(sc);
  let best = Infinity;
  for (let i = 0; i < figs.length; i++) for (let j = i + 1; j < figs.length; j++) {
    if (marking(figs[i], figs[j])) best = Math.min(best, dist(figs[i].p, figs[j].p));
  }
  return best;
}
