/**
 * Who reacts to one strike of a served chance — the Full Highlights Rebuild
 * ruler's "players reacting" (lib/star/fhr/ruler.ts). Runs the real engine's
 * substep loop (stepDefenders / stepKeeper / stepReactions / stepBall, three
 * substeps a 60th of a second, as CanvasMatch runs it), so it lives here, not
 * in shipped code: the one-engine guard allows the engine's physics only in
 * the real match. Terminal and tests only.
 *
 * The strike: a firm, low shot at the middle of the goal on a chance with the
 * goal in view; a firm pass to the runner otherwise.
 */
import {
  launch, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  goalInView, type Scenario,
} from "../../lib/star/canvasEngine";
import { CX } from "../../lib/star/pitch";
import { mulberry32, REACT_MOVE_M, REACT_MAX_S, REACT_EARLY_S, type Reaction } from "../../lib/star/fhr/ruler";

const DT = 1 / 60;

/** Every body the engine can move, by a stable name, at this instant. */
function bodies(sc: Scenario): Map<string, { x: number; y: number }> {
  const m = new Map<string, { x: number; y: number }>();
  sc.defenders.forEach((d, i) => m.set(`d${i}`, { x: d.x, y: d.y }));
  if (sc.runner) m.set("runner", { ...sc.runner.pos });
  sc.secondaryRunners.forEach((r, i) => m.set(`r${i}`, { ...r.pos }));
  if (sc.follower) m.set("follower", { x: sc.follower.x, y: sc.follower.y });
  return m;
}

/** Strike the served chance once and count the men who react. */
export function reactingAfterStrike(sc: Scenario, seed: number): Reaction {
  return strikeOnce(sc, seed).reaction;
}

/** The same strike, with how it ended (for the B2 measure: the extra defender's effect). */
export function strikeOnce(sc: Scenario, seed: number): { reaction: Reaction; result: string | null } {
  const rng = mulberry32(seed);
  const s: Scenario = JSON.parse(JSON.stringify(sc));
  initDefenders(s, rng);
  const before = bodies(s);
  const b = s.ball;
  const shoot = goalInView(s.kind);
  const to = shoot ? { x: CX, y: 0 } : (s.runner?.pos ?? s.passTarget ?? { x: CX, y: 0 });
  const dir = { x: to.x - b.x, y: to.y - b.y };
  const ball = launch(s, dir, shoot ? 0.75 : 0.5, { cx: 0, cy: 0 }, { power: 65, technique: 65 }, rng);
  const h = DT / 3;
  let t = 0;
  let res: unknown = null;
  let early: Map<string, { x: number; y: number }> | null = null;
  while (t < REACT_MAX_S && !res) {
    stepDefenders(s, h, ball.pos, false, ball);
    stepKeeper(s, h);
    stepReactions(s, ball, h, rng);
    res = stepBall(ball, s, rng, h);
    t += h;
    if (!early && t >= REACT_EARLY_S) early = bodies(s);
  }
  const after = bodies(s);
  early ??= after;
  const moved = (m: Map<string, { x: number; y: number }>, k: string, p: { x: number; y: number }) => {
    const q = m.get(k);
    return !!q && Math.hypot(q.x - p.x, q.y - p.y) >= REACT_MOVE_M;
  };
  const r: Reaction = { all: 0, mates: 0, early: 0 };
  for (const [k, p] of Array.from(before.entries())) {
    if (moved(after, k, p)) { r.all++; if (!k.startsWith("d")) r.mates++; }
    if (moved(early, k, p)) r.early++;
  }
  return { reaction: r, result: typeof res === "string" ? res : null };
}

