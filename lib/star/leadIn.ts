/**
 * A LEAD-IN — the moves before a chance, replayed in the match's own picture.
 *
 * Harry, 13 Oct 2026: "u need to actually see the 3 moves before u". A test
 * screen (the Real shots page) can hand the real match a lead-in: where the
 * ball and every man are at each moment of the passes that came before the
 * chance. The match (CanvasMatch's optional `leadIn` prop, off by default)
 * plays it as a REPLAY before the chance starts: it puts the people and the
 * ball where the lead-in says, draws them the way it draws every frame (the
 * 2D picture, and the 3D view reading the same frames), and steps nothing.
 * No physics: the ball is where the recording has it. When the lead-in ends,
 * everyone is exactly where the chance has them, and the chance begins.
 *
 * Pure: no React, no canvas. tests/star/leadIn.mts checks it.
 */
import type { Scenario, Vec2, Viewport } from "./canvasEngine";
import type { Lane, ChancePattern } from "./hiddenMatch";
import { SIX_DEPTH, SIX_L, SIX_R, BOX_DEPTH, BOX_L, BOX_R, CX } from "./pitch";

export interface LeadIn {
  /** How long it lasts, seconds. */
  durS: number;
  /** The ball at t seconds (pitch metres, z up). At durS: the chance's ball. */
  ballAt(t: number): { x: number; y: number; z: number };
  /** Where one of the chance's people (see leadInEntities) is at t. Null: he stands where the chance has him. */
  posAt(key: string, t: number): Vec2 | null;
  /**
   * Team-mates in the move who are not in the chance's picture (a passer from
   * further back): drawn only while the lead-in plays, keys extra0, extra1…
   */
  extraMates?: number;
  /**
   * When each pass starts and arrives (seconds, in order). The camera frames
   * the passer and the receiver of the pass being played. Absent: it frames
   * the ball and the men near it.
   */
  passStart?: number[];
  passEnd?: number[];
  /** A line to show while it plays ("Kovačić → Brozović"). */
  captionAt?(t: number): string;
  /** Told every frame while it plays, and once with done = true. Read only. */
  onTick?(t: number, done: boolean): void;
  /** A tap ends it at once and the chance starts (the career's build-ups). Absent: it is watched to the end. */
  skippable?: boolean;
  /**
   * "tv": the TV camera (the Real shots page). The frame may be WIDER than the
   * chance's own, so the passer and the man the pass goes to are both on the
   * screen; it zooms out before a long pass and back in onto the chance's frame
   * at the end. Absent: the build-ups' camera (never wider than the chance's frame).
   */
  camera?: "tv";
  /**
   * PLAYERS ALREADY MOVING (the rebuild's phase 3). The men in `runOnKeys`
   * are still running when the chance becomes yours: posAt answers for them
   * up to durS + runOnS, easing each one to a stop EXACTLY on the drawing's
   * spot. The ball and you are done at durS; the chance is yours from durS.
   * Strike it before they stop and they stop where they are (from the strike
   * the engine moves everyone, unchanged). Absent: everyone stops at durS, as before.
   */
  runOnS?: number;
  runOnKeys?: string[];
  /**
   * Men who JOIN the chance (the rebuild's extra covering defender): drawn
   * from the start of the lead-in, at posAt(key, t), and kept in the chance
   * afterwards at `end` (or at posAt during the run-on). Absent: nobody joins.
   */
  joiners?: { key: string; side: "opp"; end: Vec2 }[];
  /** A referee's whistle at this second of the lead-in (a foul before a set piece). */
  whistleAt?: number;
  /** Show captionAt over the picture while it plays ("Foul! Free kick.", "One last attack"). Absent: the plain "Build-up" label. */
  captionShown?: boolean;
}

/**
 * What the match knows about the moment a chance comes from, handed to a
 * lead-in builder with the chance (CanvasMatch's `leadIn` prop).
 */
export interface LeadMoment {
  /** The opening chance of a screen that plays one picture (openOn): the Real shots page. */
  opening: boolean;
  /** A new chance from the match: not a move carrying on (a pass found its man,
   *  a lay-off, a re-touch) and not a set piece. */
  fresh: boolean;
  /** The radar's moment: which channel, and settled play or a break. */
  lane?: Lane;
  pattern?: ChancePattern;
  /** The chance's own seed (the same each time this chance is served). */
  seed: number;
  /** The two clubs and their strengths, for the team shapes (absent: made-up sides). */
  us?: string;
  them?: string;
  usStrength?: number;
  themStrength?: number;
  /** The chance's own camera frame as the match shows it (absent: sc.viewport). */
  frame?: Viewport;
  /**
   * How big the moment is, for how long a build-up runs (the rebuild: "in a
   * final, you get a big, longer build-up in the 90th minute"). The match
   * minute, your goals minus theirs, and what is at stake. Absent: an
   * ordinary moment (the build-up exactly as before these existed).
   */
  minute?: number;
  scoreDiff?: number;
  stakes?: "final" | "knockout" | "league" | "friendly";
}

/** What is at stake in a fixture, for LeadMoment.stakes (a final, a knockout round, a league match). */
export function stakesOf(f?: { kind?: string; round?: string; competition?: string } | null): LeadMoment["stakes"] {
  if (!f) return undefined;
  const round = f.round ?? "";
  if (/\bfinal\b/i.test(round) && !/semi|quarter|eighth/i.test(round)) return "final";
  if (f.kind && f.kind !== "league" && round) return "knockout";
  if (!f.kind || f.kind === "league") return "league";
  return f.kind === "international" ? "friendly" : "knockout";
}

/** One person in a chance, by a key that is stable within the chance. */
export interface LeadEntity {
  key: string;
  side: "you" | "mate" | "opp" | "keeper";
  get(): Vec2;
  set(p: Vec2): void;
}

/** Everyone in a chance, each with a key: you, keeper, def0…, mate0…, run, sec0…, follower. */
export function leadInEntities(sc: Scenario): LeadEntity[] {
  const out: LeadEntity[] = [];
  const pt = (o: { x: number; y: number }) => ({
    get: () => ({ x: o.x, y: o.y }),
    set: (p: Vec2) => { o.x = p.x; o.y = p.y; },
  });
  out.push({ key: "you", side: "you", ...pt(sc.player) });
  out.push({ key: "keeper", side: "keeper", ...pt(sc.keeper) });
  sc.defenders.forEach((d, i) => out.push({ key: `def${i}`, side: "opp", ...pt(d) }));
  sc.teammates.forEach((m, i) => out.push({ key: `mate${i}`, side: "mate", ...pt(m) }));
  if (sc.runner) out.push({ key: "run", side: "mate", ...pt(sc.runner.pos) });
  sc.secondaryRunners.forEach((r, i) => out.push({ key: `sec${i}`, side: "mate", ...pt(r.pos) }));
  out.push({ key: "follower", side: "mate", ...pt(sc.follower) });
  return out;
}

/** How long the camera takes to glide onto the chance's own frame (before it locks). */
export const LEAD_SETTLE_S = 1.5;
/** The men the lead-in camera keeps in frame: those this close to the ball (m). Used when the lead-in has no passes listed. */
export const LEAD_FRAME_NEAR = 16;
/** How quickly the following camera catches the play up (a spring, per second): higher = tighter. */
export const LEAD_FOLLOW_OMEGA = 3;
/** The following camera's top speed, m/s. */
export const LEAD_FOLLOW_TOP = 30;
/** The closest the lead-in frame comes in (m across), so it never jams in on one man. */
export const LEAD_FRAME_MIN_W = 28;

/**
 * THE TV CAMERA (lead.camera "tv"; Harry, 14 Oct 2026: "the camerawork needs to
 * change up until you get your chance").
 *
 * Filmed, round 1: the old follow frame was the chance's size but chased the
 * ball, so it slid up to 23 px a frame and jumped between passes. Round 2 made
 * it smooth but zoomed out to 54 m (the whole half; men 2/3 their size).
 * Round 3 (this): a TV operator's frame —
 *   - the SAME scale as the chance's own frame (men the size you play them at),
 *     widening at most LEAD_TV_MAX_RATIO only when the passer and the man the
 *     pass goes to can't both fit;
 *   - aimed between the ball and where it is going (lead room), looking
 *     LEAD_TV_AIM_S ahead, so it is already moving when the pass is hit;
 *   - the goal brought into the frame once the ball is within LEAD_TV_GOAL_Y;
 *   - eased springs and a top speed, never a snap;
 *   - glides onto the chance's frame over LEAD_TV_SETTLE_S, and IS it at the end.
 */
/** The widest it goes, as a multiple of the chance's own frame width. */
export const LEAD_TV_MAX_RATIO = 1.2;
/** Room round the ball and the receiver (m, added across and down). */
export const LEAD_TV_MARGIN = 3;
/** How far ahead it aims (s): the frame centre is the average of the next LEAD_TV_AIM_S. */
export const LEAD_TV_AIM_S = 0.9;
/** How far ahead it looks to pick its size (s): out before a long pass, not after it. */
export const LEAD_TV_LOOK_S = 1.2;
/** Once the ball is this close to the goal line (m), the goal comes into the frame. */
export const LEAD_TV_GOAL_Y = 42;
/** Its springs (per second): position, zooming out, zooming in. Lower = steadier. */
export const LEAD_TV_OMEGA = 2.4;
export const LEAD_TV_OMEGA_OUT = 1.6;
export const LEAD_TV_OMEGA_SIZE = 1.0;
/** Its top speed, m/s. */
export const LEAD_TV_TOP = 34;
/** How long it takes to glide onto the chance's own frame (s). */
export const LEAD_TV_SETTLE_S = 2.5;
/**
 * The part of the frame you can actually see (shares of the frame; the Real
 * shots page always faces up, goal at the top). Filmed: the match canvas is
 * wider than a 390-px phone (about 11% cut off each side) and the commentary
 * box covers the bottom quarter, so a ball "in frame" down the touchline or at
 * the bottom was hidden. The TV camera keeps the ball and the move inside this.
 */
export const LEAD_TV_SAFE = { l: 0.15, r: 0.15, t: 0.1, b: 0.3 };

/**
 * WHERE THE CAMERA STOPS FOLLOWING (Harry, 14 Oct 2026: "maybe do it on the
 * pass and then fixed once in the 6 yard box"). While the passes play, the
 * camera follows the move. Once the ball is inside this box it is FIXED on the
 * shot's own frame and does not move or zoom again. A shot that starts outside
 * the box: the camera fixes on the shot's frame as the lead-in ends.
 *
 *   "six" = the 6-yard box.   "box" = the 18-yard box (the penalty area).
 *
 * Change this one word to move the line.
 */
export const LEAD_LOCK_AREA: "six" | "box" = "six";
const LOCK_AREAS = {
  six: { depth: SIX_DEPTH, l: SIX_L, r: SIX_R },
  box: { depth: BOX_DEPTH, l: BOX_L, r: BOX_R },
} as const;

/** Whether a point (pitch metres, goal line at y = 0) is inside the box the camera locks in. */
export function inLockArea(p: Vec2, area: "six" | "box" = LEAD_LOCK_AREA): boolean {
  const a = LOCK_AREAS[area];
  return p.y >= 0 && p.y <= a.depth && p.x >= a.l && p.x <= a.r;
}

const smooth = (f: number) => { const c = Math.min(1, Math.max(0, f)); return c * c * (3 - 2 * c); };

/** The ball and the men near it at t, as a box (pitch metres). */
function actionBox(lead: LeadIn, t: number, keys: readonly string[]) {
  const tt = Math.min(lead.durS, Math.max(0, t));
  const b = lead.ballAt(tt);
  let x1 = b.x, x2 = b.x, y1 = b.y, y2 = b.y;
  for (const k of keys) {
    const p = lead.posAt(k, tt);
    if (!p || Math.hypot(p.x - b.x, p.y - b.y) > LEAD_FRAME_NEAR) continue;
    x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y);
  }
  // The ball counts twice: the frame leans to where it is.
  return { x1, x2, y1, y2, bx: b.x, by: b.y };
}

/** The margin keepBall keeps round the ball in a frame. */
const ballMargin = (v: Viewport) => Math.min(2.5, (v.x2 - v.x1) / 5, (v.y2 - v.y1) / 5);

/** The frame moved (never resized) just enough to keep the ball a few metres inside it. */
function keepBall(v: Viewport, b: Vec2): Viewport {
  const m = ballMargin(v);
  const dx = b.x < v.x1 + m ? b.x - (v.x1 + m) : b.x > v.x2 - m ? b.x - (v.x2 - m) : 0;
  const dy = b.y < v.y1 + m ? b.y - (v.y1 + m) : b.y > v.y2 - m ? b.y - (v.y2 - m) : 0;
  return { x1: v.x1 + dx, x2: v.x2 + dx, y1: v.y1 + dy, y2: v.y2 + dy };
}

/** keepBall for the TV camera: the ball kept inside LEAD_TV_SAFE (scaled by k; never less than keepBall's margin). */
function keepSafe(v: Viewport, b: Vec2, k = 1): Viewport {
  const w = v.x2 - v.x1, h = v.y2 - v.y1, m = ballMargin(v);
  const l = Math.max(m, LEAD_TV_SAFE.l * w * k), r = Math.max(m, LEAD_TV_SAFE.r * w * k);
  const t = Math.max(m, LEAD_TV_SAFE.t * h * k), bo = Math.max(m, LEAD_TV_SAFE.b * h * k);
  // A soft edge: the frame starts and stops moving with the ball gradually (no
  // sudden stop when the ball comes back in); the ball may go up to 0.8 x the
  // margin past the line, so it is always still inside the frame.
  const soft = (e: number, mm: number) => { const K = 0.8 * mm; return e <= 0 ? 0 : (e * e) / (e + K); };
  const dx = b.x < v.x1 + l ? -soft(v.x1 + l - b.x, l) : b.x > v.x2 - r ? soft(b.x - (v.x2 - r), r) : 0;
  const dy = b.y < v.y1 + t ? -soft(v.y1 + t - b.y, t) : b.y > v.y2 - bo ? soft(b.y - (v.y2 - bo), bo) : 0;
  return { x1: v.x1 + dx, x2: v.x2 + dx, y1: v.y1 + dy, y2: v.y2 + dy };
}

/**
 * When the camera is fixed: the first moment the ball is inside the lock box
 * (LEAD_LOCK_AREA) and stays inside the chance's own frame from then on (so a
 * fixed camera never loses it). Never: the end of the lead-in.
 */
export function leadLockTime(lead: LeadIn, chance: Viewport, area: "six" | "box" = LEAD_LOCK_AREA): number {
  const m = ballMargin(chance);
  const STEP = 1 / 60;
  const n = Math.floor(lead.durS / STEP);
  let lockT = lead.durS;
  // From the end backwards: while the ball stays in the frame, the earliest moment it is in the box.
  for (let i = n; i >= 0; i--) {
    const t = i * STEP;
    const b = lead.ballAt(t);
    if (b.x < chance.x1 + m || b.x > chance.x2 - m || b.y < chance.y1 + m || b.y > chance.y2 - m) break;
    if (inLockArea(b, area)) lockT = t;
  }
  return lockT;
}

/**
 * The camera during a lead-in.
 *
 * FOLLOW. While the passes play it follows the move: framed on the ball, the
 * man playing the pass and the man it goes to (with the lead-in's passStart /
 * passEnd; without them, the ball and the men near it), in the chance's own
 * shape, never closer than LEAD_FRAME_MIN_W across nor wider than the chance's
 * frame. It moves like a camera operator, eased and with a top speed.
 *
 * LOCK. Once the ball is in the lock box (LEAD_LOCK_AREA; see leadLockTime) it
 * is FIXED on the chance's own frame: no movement, no zoom, to the end. It
 * glides onto that frame over the LEAD_SETTLE_S before (eased in and out, so
 * no jump). A shot from outside the box locks as the lead-in ends, so at
 * t = durS it IS the chance's frame: no jump when the chance starts.
 *
 * `keys`: the people to keep in frame (leadInEntities' keys, and extras).
 * Ask it for times in order (a match's frames); an earlier time starts it again.
 */
export function leadInCamera(lead: LeadIn, keys: readonly string[] = []) {
  // A camera operator: a critically damped spring on the frame's middle and size
  // (it speeds up and slows down smoothly, never a jolt when the play moves on to
  // the next pass), with a top speed.
  const tv = lead.camera === "tv";
  const STEP = 1 / 60;
  const W_POS = tv ? LEAD_TV_OMEGA : LEAD_FOLLOW_OMEGA;
  const W_SIZE = tv ? LEAD_TV_OMEGA_SIZE : LEAD_FOLLOW_OMEGA * 0.6;
  const TOP = tv ? LEAD_TV_TOP : LEAD_FOLLOW_TOP;
  const SETTLE = tv ? LEAD_TV_SETTLE_S : LEAD_SETTLE_S;
  const MARGIN = tv ? LEAD_TV_MARGIN : 14;
  const ps = lead.passStart, pe = lead.passEnd;
  const hasPasses = !!ps && !!pe && ps.length > 0 && ps.length === pe.length;
  const box = (pts: Vec2[]) => {
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
    for (const p of pts) { x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y); }
    return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, sx: x2 - x1 + MARGIN, sy: y2 - y1 + MARGIN };
  };
  const target0 = (t: number) => {
    if (hasPasses) {
      // The pass being played, or the next one: its passer's spot and where it goes.
      const tt = Math.min(lead.durS, Math.max(0, t));
      const i = pe!.findIndex((e) => tt < e);
      const b = lead.ballAt(tt);
      return box(i >= 0 ? [b, lead.ballAt(ps![i]), lead.ballAt(pe![i])] : [b, lead.ballAt(lead.durS)]);
    }
    const a = actionBox(lead, t, keys);
    const ahead = lead.ballAt(Math.min(lead.durS, t + 0.35));
    const x1 = Math.min(a.x1, ahead.x), x2 = Math.max(a.x2, ahead.x), y1 = Math.min(a.y1, ahead.y), y2 = Math.max(a.y2, ahead.y);
    return { cx: ((x1 + x2) / 2 + a.bx) / 2, cy: ((y1 + y2) / 2 + a.by) / 2, sx: x2 - x1 + MARGIN, sy: y2 - y1 + MARGIN };
  };
  // The chance's frame shape (the TV camera works at its scale); set by at().
  let cw0 = 30, ch0 = 58;
  // TV: what to keep in frame at t — the ball, the pass being played or the next
  // one (its passer until it is hit, and where it goes), and the goal near the box.
  const tvGoal = { x: CX, y: 0 };
  const tvTarget0 = (t: number) => {
    const tt = Math.min(lead.durS, Math.max(0, t));
    const b = lead.ballAt(tt);
    const pts: Vec2[] = [b];
    if (hasPasses) {
      const i = pe!.findIndex((e) => tt < e);
      if (i >= 0) { if (tt < ps![i]) pts.push(lead.ballAt(ps![i])); pts.push(lead.ballAt(pe![i])); }
      else pts.push(lead.ballAt(lead.durS));
    } else pts.push(lead.ballAt(Math.min(lead.durS, tt + 0.8)));
    if (b.y < LEAD_TV_GOAL_Y) pts.push(tvGoal);
    return box(pts);
  };
  // TV: the frame it wants at t, at the chance's scale (width cw..cw x LEAD_TV_MAX_RATIO).
  const tvTarget = (t: number) => {
    let cx = 0, cy = 0, sx = 0, sy = 0;
    const N = 6;
    for (let k = 0; k < N; k++) { const g = tvTarget0(t + (LEAD_TV_AIM_S * k) / (N - 1)); cx += g.cx / N; cy += g.cy / N; }
    for (let k = 0; k < N; k++) { const g = tvTarget0(t + (LEAD_TV_LOOK_S * k) / (N - 1)); sx = Math.max(sx, g.sx); sy = Math.max(sy, g.sy); }
    // It frames the move inside the part you can see (LEAD_TV_SAFE).
    const fw = 1 - LEAD_TV_SAFE.l - LEAD_TV_SAFE.r, fh = 1 - LEAD_TV_SAFE.t - LEAD_TV_SAFE.b;
    const need = Math.max(sx / fw, (sy / fh) * cw0 / ch0);
    const w = Math.min(cw0 * LEAD_TV_MAX_RATIO, Math.max(cw0, need)), h = (w * ch0) / cw0;
    // Too much to fit: the ball keeps its place, the rest is pulled in towards it.
    const b = lead.ballAt(Math.min(lead.durS, Math.max(0, t)));
    if (sx > w * fw) cx = b.x + ((cx - b.x) * w * fw) / sx;
    if (sy > h * fh) cy = b.y + ((cy - b.y) * h * fh) / sy;
    // The seen part's middle sits above the frame's middle: move the frame so the move is in it.
    cx += (LEAD_TV_SAFE.r - LEAD_TV_SAFE.l) / 2 * w;
    cy += (LEAD_TV_SAFE.b - LEAD_TV_SAFE.t) / 2 * h;
    return { cx, cy, sx: w, sy: h };
  };
  // The TV camera picks its size from the next LEAD_TV_LOOK_S: out before a long pass, not after it.
  const target = (t: number) => (tv ? tvTarget(t) : target0(t));
  const rest = (t: number) => ({ t: 0, ...target(t), vx: 0, vy: 0, vsx: 0, vsy: 0 });
  let st: ReturnType<typeof rest> | null = null;
  const advance = (to: number) => {
    if (!st || to < st.t) st = rest(0);
    while (st.t + STEP <= to + 1e-9) {
      const g = target(st.t + STEP);
      let vx = st.vx + (W_POS * W_POS * (g.cx - st.cx) - 2 * W_POS * st.vx) * STEP;
      let vy = st.vy + (W_POS * W_POS * (g.cy - st.cy) - 2 * W_POS * st.vy) * STEP;
      const sp = Math.hypot(vx, vy);
      if (sp > TOP) { vx *= TOP / sp; vy *= TOP / sp; }
      const wx = tv && g.sx > st.sx ? LEAD_TV_OMEGA_OUT : W_SIZE, wy = tv && g.sy > st.sy ? LEAD_TV_OMEGA_OUT : W_SIZE;
      const vsx = st.vsx + (wx * wx * (g.sx - st.sx) - 2 * wx * st.vsx) * STEP;
      const vsy = st.vsy + (wy * wy * (g.sy - st.sy) - 2 * wy * st.vsy) * STEP;
      st = { t: st.t + STEP, cx: st.cx + vx * STEP, cy: st.cy + vy * STEP, sx: st.sx + vsx * STEP, sy: st.sy + vsy * STEP, vx, vy, vsx, vsy };
      if (tv) {
        // A ball faster than the operator (a sped-up long ball): he keeps it on the
        // screen by panning with it, and holds the zoom while he does (no pan + zoom at once).
        const w = Math.min(cw0 * LEAD_TV_MAX_RATIO, Math.max(cw0, st.sx)), h = (w * ch0) / cw0;
        const v = { x1: st.cx - w / 2, x2: st.cx + w / 2, y1: st.cy - h / 2, y2: st.cy + h / 2 };
        const k = keepSafe(v, lead.ballAt(Math.min(lead.durS, st.t)));
        if (k.x1 !== v.x1 || k.y1 !== v.y1) {
          const prev = st.sx - vsx * STEP, prevY = st.sy - vsy * STEP;
          st = { ...st, cx: st.cx + (k.x1 - v.x1), cy: st.cy + (k.y1 - v.y1), sx: prev, sy: prevY, vsx: 0, vsy: 0 };
        }
      }
    }
  };
  const clampC = (c: number, half: number, lo: number, hi: number) => (hi - lo <= 2 * half ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, c)));
  // The lock time, worked out once per chance frame (the match may re-frame it, e.g. on a resize).
  let lockMemo: { key: string; t: number } | null = null;
  const lockTime = (chance: Viewport) => {
    const key = `${chance.x1},${chance.x2},${chance.y1},${chance.y2}`;
    if (!lockMemo || lockMemo.key !== key) lockMemo = { key, t: leadLockTime(lead, chance) };
    return lockMemo.t;
  };
  /** 0 = following, 1 = fixed on the chance's frame; eased between. */
  const lockAt = (t: number, chance: Viewport) => {
    const lt = lockTime(chance);
    if (lt <= 0) return 1;
    return smooth((t - (lt - SETTLE)) / SETTLE);
  };
  return {
    /** When the camera is fixed (seconds into the lead-in), for this chance frame. */
    lockTime,
    lockAt,
    /** The frame at t, given the chance's own frame now. */
    at(t: number, chance: Viewport): Viewport {
      const f = lockAt(t, chance);
      if (f >= 1) return { ...chance };
      const cw = chance.x2 - chance.x1, ch = chance.y2 - chance.y1;
      if (tv && (cw !== cw0 || ch !== ch0)) { cw0 = cw; ch0 = ch; }
      advance(t);
      const s = st!;
      // The build-ups: never wider than the chance's frame. The TV camera: the chance's scale, up to LEAD_TV_MAX_RATIO wider.
      const lo = tv ? cw : Math.min(cw, LEAD_FRAME_MIN_W);
      const hi = tv ? cw * LEAD_TV_MAX_RATIO : cw;
      const w = Math.min(hi, Math.max(lo, s.sx, s.sy * cw / ch)), h = w * ch / cw;
      const cx = clampC(s.cx, w / 2, -4, 72), cy = clampC(s.cy, h / 2, -7, 112);
      const raw = { x1: cx - w / 2, x2: cx + w / 2, y1: cy - h / 2, y2: cy + h / 2 };
      const own = tv ? keepSafe(raw, lead.ballAt(t)) : keepBall(raw, lead.ballAt(t));
      const mix = (a: number, b: number) => a + (b - a) * f;
      if (tv) {
        // The TV camera zooms onto the chance's frame at an even rate (the width
        // eased in ratio, not in metres), so the zoom-in never rushes at the start.
        const ow = own.x2 - own.x1, oh = own.y2 - own.y1;
        const zw = ow * Math.pow(cw / ow, f), zh = oh * Math.pow(ch / oh, f);
        const zx = mix((own.x1 + own.x2) / 2, (chance.x1 + chance.x2) / 2), zy = mix((own.y1 + own.y2) / 2, (chance.y1 + chance.y2) / 2);
        const z = { x1: zx - zw / 2, x2: zx + zw / 2, y1: zy - zh / 2, y2: zy + zh / 2 };
        // The seen-part margin fades to keepBall's as it lands on the chance's frame.
        return keepSafe(z, lead.ballAt(t), 1 - f);
      }
      return keepBall({ x1: mix(own.x1, chance.x1), x2: mix(own.x2, chance.x2), y1: mix(own.y1, chance.y1), y2: mix(own.y2, chance.y2) }, lead.ballAt(t));
    },
  };
}

/** A point along keyframes (each segment eased), held at the ends. */
export interface KeyPt { t: number; p: Vec2 }
export function alongKeys(keys: KeyPt[], t: number, ease = true): Vec2 {
  if (t <= keys[0].t) return { ...keys[0].p };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      const g = ease ? smooth(f) : f;
      return { x: a.p.x + (b.p.x - a.p.x) * g, y: a.p.y + (b.p.y - a.p.y) * g };
    }
  }
  return { ...keys[keys.length - 1].p };
}

// ── Shared with the Real shots lead-in (lib/star/realMoments/leadin.ts) and the build-ups (leadInGen.ts) ──

/** The ball's keyframes: when it is where, and whether it got there by a pass (lofted or not). */
export interface LeadBallKey { t: number; p: Vec2; pass?: { h: number } }

/** The fastest a man may be made to run in a lead-in, m/s (lead-in time). */
export const LEAD_MAX_RUN = 9;

/** The ball along its keys: straight lines on the grass, a long pass lofted. */
export function ballAlong(keys: LeadBallKey[], t: number): { x: number; y: number; z: number } {
  if (t <= keys[0].t) return { ...keys[0].p, z: 0 };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      // A pass slows a little as it runs; a carry is steady.
      const g = b.pass ? f * (1.3 - 0.3 * f) : f;
      const z = b.pass && b.pass.h > 0 ? 4 * b.pass.h * f * (1 - f) : 0;
      return { x: a.p.x + (b.p.x - a.p.x) * g, y: a.p.y + (b.p.y - a.p.y) * g, z };
    }
  }
  const e = keys[keys.length - 1].p;
  return { x: e.x, y: e.y, z: 0 };
}
