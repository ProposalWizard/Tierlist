import {
  PITCH_W, CX, POST_L, POST_R, NET_DEPTH, GOAL_H,
  SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH, PEN_SPOT_Y, ARC_R,
} from "./pitch";

/**
 * DRAWING A TRAINING SESSION.
 *
 * Reported directly, about the drills this replaces: "they just look
 * terrible." They were CSS — coloured `div`s, an emoji goal, a ball that was
 * a white circle sliding on a `transition`. Nothing in them was a football
 * pitch, which is most of why none of them felt like football.
 *
 * This is one canvas renderer shared by every rebuilt drill: real grass,
 * real IFAB markings straight out of `pitch.ts`, the same five-surface goal
 * and the same hand-drawn figures the real match draws, a ball that has a
 * height and a shadow that stays on the ground under it.
 *
 * ── Why this is a copy and not an import ──
 *
 * The visual technique here (the grass grain tile, the goal's five surfaces
 * back-to-front, the footballer, the ball's height-as-size cue) is copied
 * from `CanvasMatch.tsx` via the two files that already copied it —
 * `scenarioRender.ts` and `TrialPenalty.tsx` — rather than imported. That is
 * this codebase's established, deliberate precedent (see scenarioRender.ts's
 * own header at length): the live match renderer is threaded through refs
 * that only make sense inside a running ninety minutes, it is the one thing
 * that must never break, and every previous second caller has copied it
 * rather than made it serve two masters. `renderScenario` itself was the
 * near miss — it is a safe lib module and it draws most of this — but it has
 * no keeper, no ball height, no cones and no aim arrow, all of which the
 * drills genuinely need, so this ends up its sibling rather than its caller.
 */

export interface TrainingViewport { x1: number; x2: number; y1: number; y2: number; }

const C = {
  pitch: "#1f9006",
  line: "rgba(255,255,250,0.85)",
  lineFaint: "rgba(255,255,250,0.5)",
  you: "#10b981",
  youRim: "#065f46",
  opp: "#dc2626",
  oppRim: "#7f1d1d",
  gk: "#fbbf24",
  gkRim: "#92400e",
  cone: "#f97316",
  coneRim: "#7c2d12",
  skin: "#c68642",
};

const GRASS_TILE = 96;
let cachedGrass: HTMLCanvasElement | null = null;
function grassTile(): HTMLCanvasElement | null {
  if (cachedGrass) return cachedGrass;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = GRASS_TILE; c.height = GRASS_TILE;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(GRASS_TILE, GRASS_TILE);
  let seed = 0x2f6f2b;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 16) & 0xff) / 255;
    const light = n > 0.5;
    img.data[i] = light ? 255 : 0;
    img.data[i + 1] = light ? 255 : 0;
    img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = Math.round(Math.abs(n - 0.5) * 2 * 16);
  }
  g.putImageData(img, 0, 0);
  cachedGrass = c;
  return c;
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export interface TrainingSceneOptions {
  viewport: TrainingViewport;
  /** Draw the goal, its net and the box markings — the striking drills. */
  goal?: boolean;
  /** The keeper, if this drill has one. `dive` is -1..1, where he's going. */
  keeper?: { x: number; y: number; dive?: number; lunge?: number } | null;
  /** Outfield men in the way: a wall, blockers, or chasers. `z` lifts a
   *  jumping wall off the turf, exactly as the engine's own Defender does. */
  defenders?: { x: number; y: number; z?: number; awake?: boolean }[];
  /** Your own figure, when the drill has you on the pitch rather than
   *  standing over a dead ball. */
  you?: { x: number; y: number } | null;
  /** Team-mates to pick out — the vision drill. `highlight` rings one. */
  mates?: { x: number; y: number; highlight?: boolean; dim?: boolean }[];
  /** The two cones of a gate, drawn as real cones with a line between. */
  gate?: { left: { x: number; y: number }; right: { x: number; y: number } } | null;
  /** The ball, with a real height above the turf. */
  ball?: { x: number; y: number; z: number } | null;
  ballImage?: HTMLImageElement | null;
  /** Where the ball has been this attempt — the shot's own trail. */
  trail?: { x: number; y: number }[];
  /** The aim arrow while a drag is live. */
  aim?: { from: { x: number; y: number }; dir: { x: number; y: number }; power: number } | null;
  /** A defensive line to read against — the vision drill's offside line. */
  offsideLine?: number | null;
}

/**
 * Paint one frame. The canvas's backing-store size is used as-is, so set
 * `canvas.width/height` (CSS box × devicePixelRatio) before calling.
 */
export function renderTrainingScene(canvas: HTMLCanvasElement, opts: TrainingSceneOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const vp = opts.viewport;
  const sx = W / (vp.x2 - vp.x1), sy = H / (vp.y2 - vp.y1);
  const unit = Math.min(sx, sy);
  const px = (x: number) => (x - vp.x1) * sx;
  const py = (y: number) => (y - vp.y1) * sy;

  // ── Grass ──
  ctx.fillStyle = C.pitch;
  ctx.fillRect(0, 0, W, H);
  const grass = grassTile();
  if (grass) {
    const pat = ctx.createPattern(grass, "repeat");
    if (pat) {
      ctx.save();
      ctx.translate(px(0) % GRASS_TILE, py(0) % GRASS_TILE);
      ctx.fillStyle = pat;
      ctx.fillRect(-GRASS_TILE, -GRASS_TILE, W + GRASS_TILE * 2, H + GRASS_TILE * 2);
      ctx.restore();
    }
  }
  {
    const wear = (x: number, y: number, rx: number, ry: number, alpha: number) => {
      const cx = px(x), cy = py(y);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry) * unit);
      g.addColorStop(0, `rgba(120,132,26,${alpha})`);
      g.addColorStop(1, "rgba(120,132,26,0)");
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
      ctx.fillStyle = g;
      ctx.fillRect(cx - rx * unit * 1.2, cy - rx * unit * 1.2, rx * unit * 2.4, rx * unit * 2.4);
      ctx.restore();
    };
    if (opts.goal) { wear(CX, 1.9, 6.2, 2.4, 0.22); wear(CX, PEN_SPOT_Y, 3.2, 2.2, 0.16); }
  }

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath(); ctx.moveTo(px(x1), py(y1)); ctx.lineTo(px(x2), py(y2)); ctx.stroke();
  };

  // ── Markings ──
  ctx.strokeStyle = C.line;
  ctx.lineWidth = Math.max(1.4, unit * 0.12);
  if (opts.goal) {
    line(vp.x1, 0, vp.x2, 0);
    ctx.strokeRect(px(SIX_L), py(0), (SIX_R - SIX_L) * sx, SIX_DEPTH * sy);
    ctx.strokeRect(px(BOX_L), py(0), (BOX_R - BOX_L) * sx, BOX_DEPTH * sy);
    ctx.strokeStyle = C.lineFaint;
    ctx.beginPath();
    const halfD = Math.acos(clamp((BOX_DEPTH - PEN_SPOT_Y) / ARC_R, -1, 1));
    ctx.arc(px(CX), py(PEN_SPOT_Y), ARC_R * unit, Math.PI / 2 - halfD, Math.PI / 2 + halfD);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px(CX), py(PEN_SPOT_Y), Math.max(2, unit * 0.16), 0, Math.PI * 2);
    ctx.fillStyle = C.line; ctx.fill();
  } else {
    // A drill away from goal still needs SOMETHING to read distance against,
    // or the run happens on a featureless green field and you cannot tell you
    // are moving. Touchlines plus metre-marked bands, same idea as the
    // first-person mode's mowing stripes.
    ctx.strokeStyle = C.lineFaint;
    line(0, vp.y1, 0, vp.y2);
    line(PITCH_W, vp.y1, PITCH_W, vp.y2);
    ctx.save();
    ctx.globalAlpha = 0.10;
    const band = 5;
    const first = Math.floor(vp.y1 / band) * band;
    for (let y = first; y < vp.y2 + band; y += band * 2) {
      ctx.fillStyle = "#0d5c04";
      ctx.fillRect(0, py(y), W, band * sy);
    }
    ctx.restore();
  }

  // ── The offside line, when a drill is asking you to read one ──
  if (opts.offsideLine != null) {
    ctx.save();
    ctx.strokeStyle = "rgba(250,204,21,0.55)";
    ctx.lineWidth = Math.max(1.5, unit * 0.09);
    ctx.setLineDash([unit * 0.9, unit * 0.6]);
    line(vp.x1, opts.offsideLine, vp.x2, opts.offsideLine);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── The goal — five surfaces, back to front, exactly as a real match ──
  if (opts.goal) {
    const hpx = GOAL_H * sy;
    const bl = { px: px(POST_L), py: py(0) }, br = { px: px(POST_R), py: py(0) };
    const tl = { px: bl.px, py: bl.py - hpx }, tr = { px: br.px, py: br.py - hpx };
    const rl = { px: px(POST_L), py: py(-NET_DEPTH) }, rr = { px: px(POST_R), py: py(-NET_DEPTH) };
    const ul = { px: rl.px, py: rl.py - hpx }, ur = { px: rr.px, py: rr.py - hpx };
    type Pt = { px: number; py: number };
    const path = (q: Pt[]) => {
      ctx.beginPath(); ctx.moveTo(q[0].px, q[0].py);
      for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].px, q[i].py);
      ctx.closePath();
    };
    const quad = (q: Pt[], fill: string) => { path(q); ctx.fillStyle = fill; ctx.fill(); };
    const seg = (a: Pt, b: Pt) => { ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke(); };
    const lerp = (a: Pt, b: Pt, f: number) => ({ px: a.px + (b.px - a.px) * f, py: a.py + (b.py - a.py) * f });
    const netting = (q: Pt[], cols: number, rows: number, alpha: number) => {
      ctx.save(); path(q); ctx.clip();
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = Math.max(0.7, unit * 0.028);
      for (let i = 0; i <= cols; i++) { const f = i / cols; seg(lerp(q[0], q[1], f), lerp(q[3], q[2], f)); }
      for (let j = 0; j <= rows; j++) { const f = j / rows; seg(lerp(q[0], q[3], f), lerp(q[1], q[2], f)); }
      ctx.restore();
    };
    const sh = unit * 0.5;
    quad([rl, rr, br, bl].map(q => ({ px: q.px + sh, py: q.py + sh * 0.3 })), "rgba(0,0,0,0.09)");
    quad([bl, br, rr, rl], "rgba(20,50,32,0.05)");
    quad([rl, rr, ur, ul], "rgba(22,52,34,0.16)");
    netting([rl, rr, ur, ul], 34, 10, 0.42);
    ctx.strokeStyle = "#0f1a14";
    ctx.lineWidth = Math.max(1.8, unit * 0.15);
    seg(rl, ul); seg(rr, ur); seg(ul, ur);
    quad([tl, tr, ur, ul], "rgba(236,245,239,0.30)");
    netting([tl, tr, ur, ul], 34, 5, 0.8);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#f6faf7";
    ctx.lineWidth = Math.max(1.8, unit * 0.12);
    seg(bl, tl); seg(br, tr);
    ctx.lineWidth = Math.max(2, unit * 0.16);
    seg(tl, tr);
    ctx.lineCap = "butt";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(1.5, unit * 0.11);
    line(POST_L, 0, POST_R, 0);
  }

  // ── A footballer — same figure grammar the match uses ──
  const footballer = (
    x: number, y: number, shirt: string, rim: string,
    o: { star?: boolean; z?: number; dim?: boolean; ring?: string } = {},
  ) => {
    const lift = (o.z ?? 0) * sy * 0.55;
    const fx = px(x), fy = py(y);
    const r = Math.max(5, unit * 1.0);
    ctx.save();
    if (o.dim) ctx.globalAlpha = 0.55;

    ctx.beginPath();
    ctx.ellipse(fx, fy, r * 0.78, r * 0.30, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fill();

    ctx.save();
    ctx.translate(fx, fy - r * 0.8 - lift);
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.3, r * 0.24);
    ctx.strokeStyle = C.skin;
    const hipY = r * 0.18, legL = r * 0.62;
    ctx.beginPath(); ctx.moveTo(-r * 0.24, hipY); ctx.lineTo(-r * 0.24, hipY + legL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.24, hipY); ctx.lineTo(r * 0.24, hipY + legL); ctx.stroke();
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.roundRect?.(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36, r * 0.12);
    if (!ctx.roundRect) ctx.rect(-r * 0.46, -r * 0.02, r * 0.92, r * 0.36);
    ctx.fill();
    ctx.strokeStyle = C.skin;
    ctx.lineWidth = Math.max(1.2, r * 0.20);
    ctx.beginPath(); ctx.moveTo(-r * 0.34, -r * 0.30); ctx.lineTo(-r * 0.52, r * 0.24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.34, -r * 0.30); ctx.lineTo(r * 0.52, r * 0.24); ctx.stroke();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.roundRect?.(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72, r * 0.17);
    if (!ctx.roundRect) ctx.rect(-r * 0.52, -r * 0.56, r * 1.04, r * 0.72);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.strokeStyle = rim;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -r * 0.76, r * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = C.skin; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.10);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();
    ctx.restore();

    if (o.ring) {
      ctx.beginPath();
      ctx.arc(fx, fy, r * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = o.ring;
      ctx.lineWidth = Math.max(1.6, r * 0.16);
      ctx.stroke();
    }
    if (o.star) {
      const sr = r * 0.23, cx = fx, cy = fy - r * 2.15 - lift;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? sr : sr * 0.44;
        const ax = cx + Math.cos(ang) * rad, ay = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
      }
      ctx.closePath();
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1.5, sr * 0.34);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.stroke();
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
    }
    ctx.restore();
  };

  for (const d of opts.defenders ?? []) {
    footballer(d.x, d.y, d.awake === false ? "#7a8a8f" : C.opp, d.awake === false ? "#3f4a4e" : C.oppRim, { z: d.z });
  }
  for (const m of opts.mates ?? []) {
    footballer(m.x, m.y, "#3b82f6", "#1e3a5f", {
      dim: m.dim,
      ring: m.highlight ? "#facc15" : undefined,
    });
  }

  // ── Cones ──
  if (opts.gate) {
    const cone = (x: number, y: number) => {
      const cx = px(x), cy = py(y);
      const h = Math.max(6, unit * 0.85), w = Math.max(5, unit * 0.7);
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.62, w * 0.24, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - h);
      ctx.lineTo(cx + w * 0.55, cy);
      ctx.lineTo(cx - w * 0.55, cy);
      ctx.closePath();
      ctx.fillStyle = C.cone;
      ctx.fill();
      ctx.strokeStyle = C.coneRim;
      ctx.lineWidth = Math.max(1, unit * 0.07);
      ctx.stroke();
      // The white band a real training cone has — the thing that stops it
      // reading as an orange triangle.
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.34, cy - h * 0.38);
      ctx.lineTo(cx + w * 0.34, cy - h * 0.38);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = Math.max(1, unit * 0.11);
      ctx.stroke();
    };
    ctx.save();
    ctx.strokeStyle = "rgba(250,204,21,0.35)";
    ctx.lineWidth = Math.max(1, unit * 0.07);
    ctx.setLineDash([unit * 0.4, unit * 0.35]);
    line(opts.gate.left.x, opts.gate.left.y, opts.gate.right.x, opts.gate.right.y);
    ctx.setLineDash([]);
    ctx.restore();
    cone(opts.gate.left.x, opts.gate.left.y);
    cone(opts.gate.right.x, opts.gate.right.y);
  }

  // ── The keeper ──
  if (opts.keeper) {
    const k = opts.keeper;
    const kpx = px(k.x), kpy = py(k.y);
    const KR = unit * 1.15 * 0.82;
    const dive = k.dive ?? 0;
    const lunge = k.lunge ?? 0;
    const reach = KR * (0.62 + Math.abs(dive) * 0.9);
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.beginPath();
    ctx.ellipse(kpx, kpy, KR * (0.7 + Math.abs(dive) * 0.5), KR * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    ctx.translate(kpx + dive * KR * lunge * 0.4, kpy - KR * 0.8);
    ctx.rotate(dive * 0.5 * lunge);
    ctx.lineCap = "round";
    ctx.strokeStyle = C.skin;
    ctx.lineWidth = Math.max(1.2, KR * 0.28);
    ctx.beginPath(); ctx.moveTo(-KR * 0.22, KR * 0.16); ctx.lineTo(-KR * 0.30, KR * 0.76); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(KR * 0.22, KR * 0.16); ctx.lineTo(KR * 0.30, KR * 0.76); ctx.stroke();
    ctx.fillStyle = C.gkRim;
    ctx.beginPath();
    ctx.roundRect?.(-KR * 0.52, -KR * 0.02, KR * 1.04, KR * 0.34, KR * 0.12);
    if (!ctx.roundRect) ctx.rect(-KR * 0.52, -KR * 0.02, KR * 1.04, KR * 0.34);
    ctx.fill();
    ctx.strokeStyle = C.skin;
    ctx.lineWidth = Math.max(1.1, KR * 0.24);
    const gloves: { x: number; y: number }[] = [];
    for (const s of [-1, 1]) {
      const leading = dive === 0 || Math.sign(s) === Math.sign(dive);
      const ex = s * reach * (leading ? 1 : 0.62);
      const ey = -KR * 0.28;
      ctx.beginPath(); ctx.moveTo(s * KR * 0.32, -KR * 0.28); ctx.lineTo(ex, ey); ctx.stroke();
      gloves.push({ x: ex, y: ey });
    }
    ctx.fillStyle = C.gk;
    ctx.beginPath();
    ctx.roundRect?.(-KR * 0.56, -KR * 0.50, KR * 1.12, KR * 0.58, KR * 0.15);
    if (!ctx.roundRect) ctx.rect(-KR * 0.56, -KR * 0.50, KR * 1.12, KR * 0.58);
    ctx.fill();
    ctx.lineWidth = Math.max(1, KR * 0.11);
    ctx.strokeStyle = C.gkRim;
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = C.gkRim;
    ctx.lineWidth = Math.max(1, KR * 0.09);
    for (const g of gloves) {
      ctx.beginPath(); ctx.arc(g.x, g.y, KR * 0.24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, -KR * 0.70, KR * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = C.skin; ctx.fill();
    ctx.lineWidth = Math.max(1, KR * 0.09);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();
    ctx.restore();
  }

  if (opts.you) footballer(opts.you.x, opts.you.y, C.you, C.youRim, { star: true });

  // ── The ball's trail ──
  if (opts.trail && opts.trail.length > 1) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(1, unit * 0.09);
    ctx.setLineDash([unit * 0.35, unit * 0.3]);
    ctx.beginPath();
    ctx.moveTo(px(opts.trail[0].x), py(opts.trail[0].y));
    for (let i = 1; i < opts.trail.length; i++) ctx.lineTo(px(opts.trail[i].x), py(opts.trail[i].y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── The ball — height reads as size plus a shadow that stays on the grass,
  // the same +5.5%-per-metre cue the real match uses. ──
  if (opts.ball) {
    const b = opts.ball;
    const bx = px(b.x), by = py(b.y);
    const lift = Math.max(0, b.z);
    const br = Math.max(4, unit * 0.5 * (1 + Math.min(lift, 8) * 0.055));
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(bx, by, br * 0.95, br * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    const drawnY = by - lift * sy * 0.55;
    const img = opts.ballImage;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, bx - br, drawnY - br, br * 2, br * 2);
    } else {
      ctx.beginPath(); ctx.arc(bx, drawnY, br, 0, Math.PI * 2);
      ctx.fillStyle = "#fefefe"; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = Math.max(1, br * 0.16);
      ctx.stroke();
    }
  }

  // ── The aim arrow — the same tapered gold shaft the real match draws ──
  if (opts.aim) {
    const a = opts.aim;
    const len = Math.hypot(a.dir.x, a.dir.y) || 1;
    const shown = a.power * (vp.y2 - vp.y1) * 0.11;
    const ax = px(a.from.x), ay = py(a.from.y);
    const bx = px(a.from.x + (a.dir.x / len) * shown);
    const by = py(a.from.y + (a.dir.y / len) * shown);
    const ang = Math.atan2(by - ay, bx - ax);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const nx = -uy, ny = ux;
    const arrowLen = Math.hypot(bx - ax, by - ay) || 1;
    const headLen = clamp(W * 0.045, W * 0.02, arrowLen * 0.45);
    const headHalf = W * 0.022, shaftW = W * 0.014;
    const hbx = bx - ux * headLen, hby = by - uy * headLen;
    const grad = ctx.createLinearGradient(ax, ay, bx, by);
    grad.addColorStop(0, "#fb923c");
    grad.addColorStop(1, "#ea580c");
    ctx.strokeStyle = grad;
    ctx.lineWidth = shaftW;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hbx, hby); ctx.stroke();
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(hbx + nx * headHalf, hby + ny * headHalf);
    ctx.lineTo(hbx - nx * headHalf, hby - ny * headHalf);
    ctx.closePath();
    ctx.fillStyle = "#f97316";
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, unit * 0.22);
    ctx.strokeStyle = "rgba(124,45,18,0.6)";
    ctx.stroke();

    const meterX = W * 0.045, meterTop = H * 0.15, meterH = H * 0.7, meterW = W * 0.055;
    ctx.fillStyle = "rgba(2,6,23,0.55)";
    ctx.fillRect(meterX, meterTop, meterW, meterH);
    const fillH = meterH * a.power;
    const mg = ctx.createLinearGradient(0, meterTop + meterH, 0, meterTop);
    mg.addColorStop(0, "#22c55e"); mg.addColorStop(0.6, "#eab308"); mg.addColorStop(1, "#ef4444");
    ctx.fillStyle = mg;
    ctx.fillRect(meterX, meterTop + meterH - fillH, meterW, fillH);
    ctx.strokeStyle = "rgba(251,191,36,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX, meterTop, meterW, meterH);
    ctx.fillStyle = "#fde68a";
    ctx.font = `bold ${Math.round(W * 0.05)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round(a.power * 100)}%`, meterX + meterW / 2, meterTop - W * 0.022);
  }
}

/** The frame a striking drill is watched in: the goal at the top, the ball
 *  near the bottom, and enough room either side that a wide angle still fits. */
export function strikeViewport(ball: { x: number; y: number }): TrainingViewport {
  const depth = Math.max(18, ball.y + 6);
  const height = depth + NET_DEPTH + 2;
  const width = height * (5 / 8);
  const cx = clamp((ball.x + CX) / 2, width / 2, PITCH_W - width / 2);
  return { x1: cx - width / 2, x2: cx + width / 2, y1: -NET_DEPTH - 2, y2: depth };
}

/** The frame a gate drill is watched in — ball at the bottom, gate at the
 *  top, both comfortably inside it however far off-line the gate sits. */
export function gateViewport(
  ball: { x: number; y: number },
  gate: { left: { x: number; y: number }; right: { x: number; y: number } },
): TrainingViewport {
  const y2 = ball.y + 5;
  const y1 = Math.min(gate.left.y, gate.right.y) - 6;
  const height = y2 - y1;
  const width = height * (5 / 8);
  const spanCx = (ball.x + (gate.left.x + gate.right.x) / 2) / 2;
  const needed = Math.abs(gate.right.x - ball.x) + Math.abs(gate.left.x - ball.x) + 6;
  const w = Math.max(width, needed);
  const h = w / (5 / 8);
  const cy = (y1 + y2) / 2;
  return {
    x1: spanCx - w / 2, x2: spanCx + w / 2,
    y1: cy - h / 2, y2: cy + h / 2,
  };
}
