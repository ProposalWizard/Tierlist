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
  /** A line to show while it plays ("Kovačić → Brozović"). */
  captionAt?(t: number): string;
  /** Told every frame while it plays, and once with done = true. Read only. */
  onTick?(t: number, done: boolean): void;
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

/** How long the camera takes to glide onto the chance's own frame at the end. */
export const LEAD_SETTLE_S = 1.5;
/** The men the lead-in camera keeps in frame: those this close to the ball (m). */
export const LEAD_FRAME_NEAR = 16;
/** The closest the lead-in frame comes in (m across), so it never jams in on one man. */
export const LEAD_FRAME_MIN_W = 28;

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

/** The frame moved (never resized) just enough to keep the ball a few metres inside it. */
function keepBall(v: Viewport, b: Vec2): Viewport {
  const m = Math.min(2.5, (v.x2 - v.x1) / 5, (v.y2 - v.y1) / 5);
  const dx = b.x < v.x1 + m ? b.x - (v.x1 + m) : b.x > v.x2 - m ? b.x - (v.x2 - m) : 0;
  const dy = b.y < v.y1 + m ? b.y - (v.y1 + m) : b.y > v.y2 - m ? b.y - (v.y2 - m) : 0;
  return { x1: v.x1 + dx, x2: v.x2 + dx, y1: v.y1 + dy, y2: v.y2 + dy };
}

/**
 * The camera during a lead-in. It frames the play the way the chance's camera
 * frames a chance: the ball and the men near it (a little ahead of the ball),
 * in the chance's own shape, as close as LEAD_FRAME_MIN_W across (never
 * wider than the chance's own frame). It follows like a camera operator, eased
 * and with a top speed, so it glides rather than jerks. Over the last
 * LEAD_SETTLE_S it glides onto the chance's own frame, and at t = durS it IS
 * that frame: no jump when the chance starts.
 * `keys`: the people to keep in frame (leadInEntities' keys, and extras).
 * Ask it for times in order (a match's frames); an earlier time starts it again.
 */
export function leadInCamera(lead: LeadIn, keys: readonly string[] = []) {
  const STEP = 1 / 60, EASE = 4, TOP = 60, ZOOM_EASE = 1.2;
  const target = (t: number) => {
    const a = actionBox(lead, t, keys);
    const ahead = lead.ballAt(Math.min(lead.durS, t + 0.35));
    const x1 = Math.min(a.x1, ahead.x), x2 = Math.max(a.x2, ahead.x), y1 = Math.min(a.y1, ahead.y), y2 = Math.max(a.y2, ahead.y);
    return { cx: ((x1 + x2) / 2 + a.bx) / 2, cy: ((y1 + y2) / 2 + a.by) / 2, sx: x2 - x1 + 14, sy: y2 - y1 + 14 };
  };
  let st = { t: 0, ...target(0) };
  const advance = (to: number) => {
    if (to < st.t) st = { t: 0, ...target(0) };
    while (st.t + STEP <= to + 1e-9) {
      const g = target(st.t + STEP);
      const k = 1 - Math.exp(-EASE * STEP);
      let dx = (g.cx - st.cx) * k, dy = (g.cy - st.cy) * k;
      const sp = Math.hypot(dx, dy) / STEP;
      if (sp > TOP) { dx *= TOP / sp; dy *= TOP / sp; }
      const kz = 1 - Math.exp(-ZOOM_EASE * STEP);
      st = { t: st.t + STEP, cx: st.cx + dx, cy: st.cy + dy, sx: st.sx + (g.sx - st.sx) * kz, sy: st.sy + (g.sy - st.sy) * kz };
    }
  };
  const clampC = (c: number, half: number, lo: number, hi: number) => (hi - lo <= 2 * half ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, c)));
  return {
    /** The frame at t, given the chance's own frame now (the match may re-frame it, e.g. on a resize). */
    at(t: number, chance: Viewport): Viewport {
      const cw = chance.x2 - chance.x1, ch = chance.y2 - chance.y1;
      const f = smooth((t - (lead.durS - LEAD_SETTLE_S)) / LEAD_SETTLE_S);
      if (f >= 1) return { ...chance };
      advance(t);
      const w = Math.min(cw, Math.max(Math.min(cw, LEAD_FRAME_MIN_W), st.sx, st.sy * cw / ch)), h = w * ch / cw;
      const cx = clampC(st.cx, w / 2, -4, 72), cy = clampC(st.cy, h / 2, -7, 112);
      const own = keepBall({ x1: cx - w / 2, x2: cx + w / 2, y1: cy - h / 2, y2: cy + h / 2 }, lead.ballAt(t));
      const mix = (a: number, b: number) => a + (b - a) * f;
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
