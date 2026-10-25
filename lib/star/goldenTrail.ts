/**
 * THE GOLDEN RUN-UP'S TRAIL (Star Pass reward, piece 4).
 *
 * The Golden Run-up (runupStyles.ts, id "golden") is a confident, gently
 * curved jog to a penalty. Behind him he leaves a glowing gold trail: a
 * streak along the ground where he has just been, and sparks dropped on the
 * grass that twinkle and fade. Looks only: nothing here touches the ball,
 * the keeper or the kick.
 *
 * Pure: no canvas, no React. `goldenTrailAt` says where every piece of the
 * trail is and how bright it is, `t` seconds into the run-up (and `afterS`
 * seconds after he got to the ball, so it fades away rather than vanishing).
 * CanvasMatch draws it in 2D; the 3D match view gets the same points in its
 * frame (EngineFrame.goldTrail) and draws them as sparks.
 *
 * Measured in tests/star/goldenTrail.mts.
 */
import type { Vec2 } from "./canvasEngine";
import { runupPositionAt, RUNUP_MOTION, GOLDEN_RUNUP, type StyledRunup } from "./runupStyles";
import { backDir } from "./penaltyRunup";

export const GOLDEN_TRAIL = {
  /** How long a spot stays lit behind him, seconds. */
  lifeS: 1.1,
  /** The streak: one point every this many seconds of his run. */
  streakStepS: 0.03,
  /** Sparks: one dropped every this many seconds of his run. */
  sparkStepS: 0.05,
  /** Sparks are scattered this far (metres) either side of his line. */
  scatterM: 0.45,
  /** …and float up off the grass to this height (metres) as they fade. */
  riseM: 0.55,
  /** After he reaches the ball the whole trail fades out over this long. */
  fadeS: 0.6,
};

export interface TrailPoint {
  x: number;
  y: number;
  /** Metres above the grass. */
  h: number;
  /** 0 (gone) .. 1 (just made). */
  life: number;
}

export interface GoldenTrail {
  /** Oldest first: a line through these is the streak. */
  streak: TrailPoint[];
  sparks: (TrailPoint & { size: number; twinkle: number })[];
}

/** A stable 0..1 number for spark `i` (the same spark always lands in the same spot). */
function hash01(i: number, salt: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x27d4eb2f, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/**
 * The trail for a man DRAWN on the other side of the ball (a left-footer,
 * kickFoot.ts drawnTakerAt): every point reflected across the line straight
 * back from the ball, the same reflection his figure gets.
 */
export function mirrorTrail(g: GoldenTrail, ball: Vec2): GoldenTrail {
  const b = backDir(ball);
  const m = <P extends TrailPoint>(p: P): P => {
    const lateral = (p.x - ball.x) * b.y - (p.y - ball.y) * b.x;
    return { ...p, x: p.x - 2 * lateral * b.y, y: p.y + 2 * lateral * b.x };
  };
  return { streak: g.streak.map(m), sparks: g.sparks.map(m) };
}

/** One list for a 3D view (EngineFrame.goldTrail): the streak's points and the sparks, each a glowing dot. */
export function goldTrailPoints(g: GoldenTrail): { x: number; y: number; h: number; life: number; size: number }[] {
  return [
    ...g.streak.filter((_, i) => i % 2 === 0).map((p) => ({ x: p.x, y: p.y, h: 0.12, life: p.life, size: 0.5 })),
    ...g.sparks.map((s) => ({ x: s.x, y: s.y, h: s.h, life: s.life * s.twinkle, size: s.size })),
  ];
}

export function isGolden(r: StyledRunup | null | undefined): boolean {
  return !!r && r.id === GOLDEN_RUNUP;
}

/**
 * The trail `t` seconds into a Golden run-up, `afterS` seconds after he
 * arrived (0 while still running). Empty for any other style, before he
 * moves, and once it has faded.
 */
export function goldenTrailAt(r: StyledRunup, t: number, afterS = 0): GoldenTrail {
  const none: GoldenTrail = { streak: [], sparks: [] };
  if (!isGolden(r)) return none;
  const G = GOLDEN_TRAIL;
  const T = RUNUP_MOTION[r.id].runS;
  const now = Math.min(t, T);
  const fade = afterS > 0 ? Math.max(0, 1 - afterS / G.fadeS) : 1;
  if (fade <= 0 || now <= 0) return none;
  // The "age" of a spot is how long ago he was there, in real seconds: run
  // time behind him plus the time since he arrived.
  const ageOf = (ts: number) => now - ts + Math.max(0, afterS);
  const moved = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y) > 0.02;
  const here = runupPositionAt(r, now);

  const streak: TrailPoint[] = [];
  const from = Math.max(0, now - G.lifeS);
  for (let ts = from; ts <= now + 1e-9; ts += G.streakStepS) {
    const p = runupPositionAt(r, ts);
    const life = (1 - (now - ts) / G.lifeS) * fade;
    if (life > 0) streak.push({ x: p.x, y: p.y, h: 0.05, life: Math.min(1, life) });
  }
  // A man standing still leaves no streak.
  if (streak.length < 2 || !moved(streak[0], here)) streak.length = 0;

  const sparks: GoldenTrail["sparks"] = [];
  const first = Math.max(0, Math.ceil((now - G.lifeS) / G.sparkStepS));
  const last = Math.floor(now / G.sparkStepS);
  for (let i = first; i <= last; i++) {
    const ts = i * G.sparkStepS;
    const age = ageOf(ts);
    const life = (1 - age / G.lifeS) * fade;
    if (life <= 0) continue;
    const p = runupPositionAt(r, ts);
    const q = runupPositionAt(r, Math.min(T, ts + 0.02));
    if (!moved(p, q) && ts > 0) continue; // dropped only while he is moving
    // Sideways off his line, by a stable amount per spark.
    const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
    const side = (hash01(i, 1) * 2 - 1) * G.scatterM;
    sparks.push({
      x: p.x + (-dy / L) * side,
      y: p.y + (dx / L) * side,
      h: 0.1 + G.riseM * (1 - life) * (0.5 + hash01(i, 2)),
      life: Math.min(1, life),
      size: 0.6 + 0.8 * hash01(i, 3),
      twinkle: 0.6 + 0.4 * Math.abs(Math.sin(age * 18 + i * 1.7)),
    });
  }
  return { streak, sparks };
}
