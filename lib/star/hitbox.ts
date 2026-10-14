/**
 * HITBOXES & JUMPING (Leo, 14 Oct 2026).
 *
 * "A BIG problem in the game has always been hitboxes are too high, so it's
 * really hard to chip the ball over defenders or the goalie or even to shoot
 * sometimes over a teammate's head … I want jumping to actually affect the
 * hitbox … throw in a bit of a cheat for things like headers and blocks."
 *
 * Old (before this): every outfield man was a tall cylinder. A defender took a
 * pass anywhere within 0.95–1.15 m of him from the grass up to 1.9 m, as wide
 * at his head as at his feet; a team-mate collected any ball within 2 m of him
 * below 2.6 m, whoever it was meant for. Measured: a chip from 3 m had to pass
 * a defender at 2.75 m to get by, and a chip over a team-mate to the man
 * behind him was taken by the first man 99.9% of the time.
 *
 * New: a man is the shape of a man. He reaches widest at his feet (a leg goes
 * out), narrower at the chest, narrowest at his head, and nothing above the
 * top of his head (1.85 m) — unless he JUMPS. Jumping is real: he leaves the
 * ground when an aerial ball he is going for is about to reach him, and his
 * reach rises and falls with the jump (the same height the picture draws).
 * Two small "cheats" keep the good things good: a man the ball is played to
 * attacks it (header bonus), and a defender in a shot's path stretches for it
 * (block bonus).
 *
 * Dials: HITBOX_DEFAULTS, overridden per device from the Hitboxes test panel
 * (localStorage "star-hitbox-dials"). The switch (Settings → Gameplay →
 * "Hitboxes & jumping (Leo)") is read by CanvasMatch per chance and handed to
 * the engine with setHitboxes(); node tests run Old unless STAR_HITBOX=new.
 */
import { BALL_R } from "./pitch";

export interface HitboxDials {
  /** Top of his head, standing (m). */
  standHeight: number;
  /** How far his feet leave the ground at the top of a jump (m). */
  jumpHeight: number;
  /** Multiplier on how far he reaches at his feet (1 = the game's old reach). */
  reachLow: number;
  /** How far he reaches at head height, as a share of his reach at his feet. */
  reachHead: number;
  /** Extra reach (up and out, m) for a header he is going for on purpose. */
  headerBonus: number;
  /** Extra reach (out, m) for a defender stretching to block a shot. */
  blockBonus: number;
  /** How much harder a keeper finds a ball above his standing reach (0 = old). */
  keeperJump: number;
}

export const HITBOX_DEFAULTS: HitboxDials = {
  standHeight: 1.85,
  jumpHeight: 0.5,
  reachLow: 1,
  reachHead: 0.45,
  headerBonus: 0.3,
  blockBonus: 0.2,
  keeperJump: 0.9,
};

/** Each dial's slider range and step (the test panel). */
export const HITBOX_RANGES: Record<keyof HitboxDials, { min: number; max: number; step: number; label: string; unit: string }> = {
  standHeight: { min: 1.4, max: 2.2, step: 0.05, label: "Standing height", unit: "m" },
  jumpHeight: { min: 0, max: 1, step: 0.05, label: "Jump height", unit: "m" },
  reachLow: { min: 0.5, max: 1.5, step: 0.05, label: "Reach at feet", unit: "×" },
  reachHead: { min: 0.2, max: 1, step: 0.05, label: "Reach at head", unit: "×" },
  headerBonus: { min: 0, max: 0.8, step: 0.05, label: "Header bonus", unit: "m" },
  blockBonus: { min: 0, max: 0.6, step: 0.05, label: "Block bonus", unit: "m" },
  keeperJump: { min: 0, max: 2, step: 0.1, label: "Keeper: over-head penalty", unit: "×" },
};

const DIALS_KEY = "star-hitbox-dials";
const SHOW_KEY = "star-hitbox-show";

let on = (() => {
  try { return typeof process !== "undefined" && process.env?.STAR_HITBOX === "new"; } catch { return false; }
})();
let dials: HitboxDials = loadDials();

/** Switch the New hitboxes on or off (CanvasMatch, per chance, from the setting). */
export function setHitboxes(v: "new" | "old"): void { on = v === "new"; dials = loadDials(); }
/** Are the New hitboxes on? */
export function hitboxesOn(): boolean { return on; }
/** The dials in force. */
export function hitboxDials(): HitboxDials { return dials; }

function loadDials(): HitboxDials {
  try {
    if (typeof localStorage === "undefined") return { ...HITBOX_DEFAULTS };
    const raw = localStorage.getItem(DIALS_KEY);
    if (!raw) return { ...HITBOX_DEFAULTS };
    const p = JSON.parse(raw) as Partial<HitboxDials>;
    const out = { ...HITBOX_DEFAULTS };
    for (const k of Object.keys(HITBOX_DEFAULTS) as (keyof HitboxDials)[]) {
      const v = p[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        const r = HITBOX_RANGES[k];
        out[k] = Math.max(r.min, Math.min(r.max, v));
      }
    }
    return out;
  } catch { return { ...HITBOX_DEFAULTS }; }
}

/** Save dials from the test panel (and use them at once). */
export function setHitboxDials(d: Partial<HitboxDials>): void {
  dials = { ...dials, ...d };
  try { localStorage.setItem(DIALS_KEY, JSON.stringify(dials)); } catch { /* private window */ }
}
/** Back to the defaults. */
export function resetHitboxDials(): void {
  dials = { ...HITBOX_DEFAULTS };
  try { localStorage.removeItem(DIALS_KEY); } catch { /* private window */ }
}
/** For tests: set dials without touching storage. */
export function applyHitboxDials(d: HitboxDials): void { dials = { ...d }; }

/** Draw the hitboxes (test screens only — CanvasMatch also needs inTestArea()). */
export function showHitboxes(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(SHOW_KEY) === "1"; } catch { return false; }
}
export function setShowHitboxes(v: boolean): void {
  try { if (v) localStorage.setItem(SHOW_KEY, "1"); else localStorage.removeItem(SHOW_KEY); } catch { /* private window */ }
}

// ── The shape of a man ──────────────────────────────────────────────────────

/** The highest a ball's centre can be and still touch his head (feet at foot). */
export function headTop(foot: number, d: HitboxDials = dials): number {
  return foot + d.standHeight + BALL_R;
}

/**
 * How far from his middle (m, along the ground) a ball at height `z` touches
 * him, for a man whose feet are at `foot` and whose reach at the grass is
 * `lowR`. Widest at his feet, narrower at his chest, narrowest at his head;
 * 0 above his head and under his feet.
 */
export function bodyReach(lowR: number, z: number, foot: number, d: HitboxDials = dials): number {
  const h = z - foot;
  const top = d.standHeight + BALL_R;
  if (h < -BALL_R || h > top) return 0;
  const low = lowR * d.reachLow;
  const head = low * d.reachHead;
  const hip = d.standHeight * 0.27;    // 0.5 m on a 1.85 m man
  const chest = d.standHeight * 0.7;   // 1.3 m
  let r: number;
  if (h <= hip) r = low;
  else if (h <= chest) r = low + (low * 0.65 - low) * ((h - hip) / (chest - hip));
  else if (h <= d.standHeight) r = low * 0.65 + (head - low * 0.65) * ((h - chest) / (d.standHeight - chest));
  else r = head * (1 - 0.4 * ((h - d.standHeight) / BALL_R));
  return Math.max(0.12, r);
}

/** Vertical speed off the ground for a jump of the dialled height. */
export function jumpSpeed(d: HitboxDials = dials): number {
  return Math.sqrt(2 * 9.8 * Math.max(0, d.jumpHeight));
}

/** Seconds from leaving the ground to the top of the jump. */
export function jumpRiseTime(d: HitboxDials = dials): number {
  return jumpSpeed(d) / 9.8;
}

/** One body's jump: its feet height and vertical speed. */
export interface JumpState { z?: number; vz?: number }

/** Leave the ground (if on it). */
export function startJump(j: JumpState, d: HitboxDials = dials): void {
  if ((j.z ?? 0) > 0 || (j.vz ?? 0) > 0) return;
  j.vz = jumpSpeed(d);
  j.z = 0;
}

/** Gravity on a jump in progress. */
export function stepJump(j: JumpState, dt: number): void {
  if ((j.z ?? 0) <= 0 && (j.vz ?? 0) <= 0) return;
  j.vz = (j.vz ?? 0) - 9.8 * dt;
  j.z = Math.max(0, (j.z ?? 0) + j.vz * dt);
  if (j.z === 0) j.vz = 0;
}

/**
 * Where an airborne ball passes a man, if it carried straight on: the time
 * until it is nearest him (s), how far away it is then (m, along the ground)
 * and its height then. Drag and curl ignored — it is a jumping man's guess,
 * re-made every frame.
 */
export function passOver(
  ball: { pos: { x: number; y: number }; vel: { x: number; y: number }; z: number; vz: number },
  p: { x: number; y: number },
): { t: number; miss: number; z: number } | null {
  const v2 = ball.vel.x * ball.vel.x + ball.vel.y * ball.vel.y;
  if (v2 < 1) return null;
  const t = ((p.x - ball.pos.x) * ball.vel.x + (p.y - ball.pos.y) * ball.vel.y) / v2;
  if (t < 0) return null;
  const x = ball.pos.x + ball.vel.x * t, y = ball.pos.y + ball.vel.y * t;
  return { t, miss: Math.hypot(p.x - x, p.y - y), z: ball.z + ball.vz * t - 0.5 * 9.8 * t * t };
}

/**
 * Should he jump now? Only for a ball that will pass within `reach` of him
 * above what he can reach standing and below what a jump (plus `bonus`)
 * reaches, and only when it is about to arrive (so the top of the jump meets
 * the ball).
 */
export function wantsJump(
  ball: { pos: { x: number; y: number }; vel: { x: number; y: number }; z: number; vz: number },
  p: { x: number; y: number }, reach: number, bonus: number, d: HitboxDials = dials,
): boolean {
  const po = passOver(ball, p);
  if (!po || po.miss > reach) return false;
  const stand = d.standHeight + BALL_R;
  if (po.z <= stand - 0.1 || po.z > stand + d.jumpHeight + bonus) return false;
  return po.t <= jumpRiseTime(d) + 0.05;
}
