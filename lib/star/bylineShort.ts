/**
 * THE SHORT OPTION ON A BYLINE CROSS (Mikey, 26 Oct 2026: "always add a short
 * option, a teammate 6 to 10 metres away for a cutback or square ball, so weak
 * power still has a play").
 *
 * A byline cross asks for a ball into the middle, which a new player's power
 * can't always reach. So every byline cross also has one team-mate close by:
 * 6 to 10 m from the ball, towards the middle of the pitch and BEHIND the ball
 * (further from the goal line than it is, so he can never be offside), in the
 * clearest space there is, at least CLEAR_M from everybody. He is a real pass
 * target (a support runner, like vision's extra men), so a pass to him plays
 * on: he shoots or lays it off, as any receiver does.
 *
 * Deterministic: no random numbers, so the match's random stream is untouched.
 * Pure: changes only `sc.secondaryRunners` (and adds nothing when he is there).
 */
import type { Runner, Scenario, Vec2 } from "./canvasEngine";
import { CX, PITCH_W } from "./pitch";

/** Nearest and furthest the short option stands from the ball, metres. */
export const SHORT_MIN_M = 6;
export const SHORT_MAX_M = 10;
/** Room round him: nobody (yours or theirs) nearer than this. */
export const CLEAR_M = 2.5;
/** At least this much further from the goal line than the ball (onside, a cutback). */
const BEHIND_M = 1.5;

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** Is there already a team-mate you could play a short ball to? */
export function hasShortOption(sc: Scenario): boolean {
  const mates = [...(sc.runner ? [sc.runner] : []), ...(sc.secondaryRunners ?? [])];
  return mates.some((r) => {
    const d = dist(r.pos, sc.ball);
    return d >= SHORT_MIN_M - 0.5 && d <= SHORT_MAX_M + 0.5 && r.pos.y >= sc.ball.y + BEHIND_M - 0.01;
  });
}

/** The spot: towards the middle and back from the ball, as clear as possible. */
export function shortOptionSpot(sc: Scenario): Vec2 | null {
  const b = sc.ball;
  const others: Vec2[] = [
    sc.player, sc.keeper, ...sc.defenders, ...sc.teammates,
    ...(sc.runner ? [sc.runner.pos, sc.runner.to] : []),
    ...(sc.secondaryRunners ?? []).flatMap((r) => [r.pos, r.to]),
  ].filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > -50 && p.x < PITCH_W + 50 && p.y < 150);
  // Towards the penalty spot's line (the middle, 11 m out): a cutback.
  const aim = Math.atan2(11 - b.y, CX - b.x);
  let best: { p: Vec2; clear: number } | null = null;
  for (let a = -70; a <= 70; a += 5) {
    const ang = aim + (a * Math.PI) / 180;
    for (let d = SHORT_MIN_M; d <= SHORT_MAX_M + 1e-9; d += 0.5) {
      const p = { x: b.x + Math.cos(ang) * d, y: b.y + Math.sin(ang) * d };
      if (p.y < b.y + BEHIND_M) continue;
      if (p.x < 1 || p.x > PITCH_W - 1 || p.y < 0.5) continue;
      const clear = others.length ? Math.min(...others.map((o) => dist(o, p))) : 99;
      // Prefer clear space, then nearer the middle of the 6-10 m band.
      const score = Math.min(clear, 6) - Math.abs(d - 8) * 0.15 - Math.abs(a) * 0.004;
      if (!best || score > best.clear) best = { p, clear: score };
    }
  }
  if (!best) return null;
  const p = best.p;
  const clear = others.length ? Math.min(...others.map((o) => dist(o, p))) : 99;
  return clear >= CLEAR_M ? p : null;
}

/** Give a byline cross its short option (does nothing to any other kind). */
export function addShortOption(sc: Scenario): boolean {
  if (sc.kind !== "byline_cross" || hasShortOption(sc)) return false;
  const p = shortOptionSpot(sc);
  if (!p) return false;
  const r: Runner = { pos: { ...p }, to: { ...p }, speed: 6, moving: false, role: "support", sprint: false } as Runner;
  sc.secondaryRunners = [...(sc.secondaryRunners ?? []), r];
  return true;
}
