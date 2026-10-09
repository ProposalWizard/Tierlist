/**
 * THE KICK, AS STRUCK — which swing the 3D view plays for your kick
 * (Motion: Mocap only; Motion: Old plays shot_r every time, as before).
 *
 * Harry, 9 Oct 2026: "every kick animation is the same no matter the power".
 * The 2D engine has already struck the ball when the 3D view sees the kick, so
 * the ball's own launch tells us what kind of kick it was: how fast, and how
 * steeply it climbs. Pure, so tests/star/kickStyle.mts can check it.
 *
 * Speeds (m/s, the engine's launch: about 9 at a third of full power, 30 at
 * full power for a strong kicker):
 *   soft   < 13   a side-foot pass (pass_inside): short backswing, calm swing
 *   firm   13–22  a driven kick (kick_r): a normal backswing
 *   full   > 22   a laces strike (shot_r): big backswing, fast swing, big
 *                 follow-through, a little hop off the standing foot
 *   lofted        the ball climbs steeply: a chip (soft) or a lofted ball
 */

export type KickKind = "soft" | "firm" | "full" | "chip" | "lofted";

export interface KickStyle {
  kind: KickKind;
  /** The clip to play (falls back to shot_r / kick_l when the body hasn't got it). */
  clip: string;
  /** How long before contact the swing starts (s of clip). */
  backswing: number;
  /** Clip seconds per second from the swing to contact. */
  swing: number;
  /** Clip seconds per second after contact (the follow-through). */
  follow: number;
  /** The hop off the standing foot after a full-power strike, metres (0: none). */
  hop: number;
}

export const KICK_BANDS = { soft: 13, full: 22, loftRatio: 0.5, loftMinVz: 5 };

/** Which kick this was, from the ball just after it was struck. */
export function kickKindOf(ball: { vx: number; vy: number; vz: number }): KickKind {
  const hs = Math.hypot(ball.vx, ball.vy);
  const sp = Math.hypot(hs, ball.vz);
  if (ball.vz > KICK_BANDS.loftMinVz && ball.vz / Math.max(1, hs) > KICK_BANDS.loftRatio) return sp < KICK_BANDS.soft + 2 ? "chip" : "lofted";
  if (sp < KICK_BANDS.soft) return "soft";
  if (sp < KICK_BANDS.full) return "firm";
  return "full";
}

/**
 * The swing for this kick. `has` says which clips the body has; a left-foot
 * kick has only kick_l, so it varies by speed and backswing alone.
 */
export function kickStyleFor(ball: { vx: number; vy: number; vz: number } | null, leftFoot: boolean, has: (clip: string) => boolean): KickStyle {
  const kind: KickKind = ball ? kickKindOf(ball) : "firm";
  const sp = ball ? Math.hypot(ball.vx, ball.vy, ball.vz) : 18;
  // 0 at a soft touch, 1 at a full-power strike: the swing grows with it
  const p = Math.max(0, Math.min(1, (sp - 8) / 22));
  const pick = (...names: string[]) => names.find((n) => has(n)) ?? (leftFoot ? "kick_l" : "shot_r");
  const clip = leftFoot ? pick("kick_l")
    : kind === "soft" ? pick("pass_inside", "pass", "kick_r")
    : kind === "firm" ? pick("kick_r", "shot_low", "shot_r")
    : kind === "chip" ? pick("chip", "pass_lofted")
    : kind === "lofted" ? pick("pass_lofted", "chip")
    : pick("shot_r");
  return {
    kind,
    clip,
    backswing: kind === "soft" ? 0.22 : kind === "chip" ? 0.3 : 0.3 + 0.32 * p,
    swing: kind === "soft" ? 1.15 : kind === "chip" ? 1.3 : 1.5 + 1.3 * p,
    follow: kind === "soft" ? 0.9 : kind === "full" ? 1.15 : 1,
    hop: kind === "full" ? 0.04 + 0.05 * p : 0,
  };
}
