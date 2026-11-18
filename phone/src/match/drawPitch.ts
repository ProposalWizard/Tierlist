/**
 * ONE FRAME OF THE PITCH, recorded as a Skia picture (no React work per frame).
 * Reads the driver; never changes it.
 */
import { Skia, PaintStyle, StrokeCap, createPicture, type SkCanvas, type SkPaint, type SkPicture } from "@shopify/react-native-skia";
import { PITCH_W, HALF_LEN, CX, POST_L, POST_R, SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH, PEN_SPOT_Y, ARC_R, CENTRE_R, NET_DEPTH } from "@/lib/star/pitch";
import type { MatchKits } from "@/lib/star/kits";
import type { MatchDriver } from "./driver";
import { toScreen, makeCam, type Cam } from "./view";
import { drawFigure } from "./figures";

const cache = new Map<string, SkPaint>();
function fill(color: string): SkPaint {
  let p = cache.get("f" + color);
  if (!p) { p = Skia.Paint(); p.setAntiAlias(true); p.setColor(Skia.Color(color)); cache.set("f" + color, p); }
  return p;
}
function stroke(color: string, w: number): SkPaint {
  const k = `s${color}|${w}`;
  let p = cache.get(k);
  if (!p) { p = Skia.Paint(); p.setAntiAlias(true); p.setColor(Skia.Color(color)); p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(w); p.setStrokeCap(StrokeCap.Round); cache.set(k, p); }
  return p;
}

/** The camera the pitch is drawn with this frame. */
export function camFor(d: MatchDriver, W: number, H: number): Cam {
  const lead = d.leadCamera();
  return makeCam(lead ?? d.viewport, d.facing, d.tiltDeg, W, H);
}

function polyline(c: SkCanvas, cam: Cam, pts: { x: number; y: number }[], p: SkPaint, close = false) {
  const b = Skia.PathBuilder.Make();
  pts.forEach((q, i) => { const s = toScreen(cam, q); if (i === 0) b.moveTo(s.X, s.Y); else b.lineTo(s.X, s.Y); });
  if (close) b.close();
  c.drawPath(b.build(), p);
}
function rectLine(c: SkCanvas, cam: Cam, x1: number, y1: number, x2: number, y2: number, p: SkPaint) {
  polyline(c, cam, [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }], p, true);
}
function arc(c: SkCanvas, cam: Cam, cx: number, cy: number, r: number, a0: number, a1: number, p: SkPaint) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  polyline(c, cam, pts, p);
}

/** A metre on the pitch at this spot, in screen px (perspective included). */
function mPx(cam: Cam, k: number): number {
  const across = cam.facing === "up" ? cam.vp.x2 - cam.vp.x1 : cam.vp.y2 - cam.vp.y1;
  return (cam.W / across) * k;
}

export function drawPitch(d: MatchDriver, kits: MatchKits, W: number, H: number): SkPicture {
  return createPicture((c) => {
    const cam = camFor(d, W, H);
    c.drawRect(Skia.XYWHRect(0, 0, W, H), fill("#3f9142"));
    // Mowing stripes, 6 m bands across the pitch.
    for (let y = -12; y < 110; y += 12) polyline(c, cam, [{ x: -10, y }, { x: PITCH_W + 10, y }, { x: PITCH_W + 10, y: y + 6 }, { x: -10, y: y + 6 }], fill("#46994a"), true);
    const line = stroke("rgba(255,255,255,0.88)", 2);
    polyline(c, cam, [{ x: 0, y: 0 }, { x: PITCH_W, y: 0 }], line);
    polyline(c, cam, [{ x: 0, y: 0 }, { x: 0, y: 105 }], line);
    polyline(c, cam, [{ x: PITCH_W, y: 0 }, { x: PITCH_W, y: 105 }], line);
    polyline(c, cam, [{ x: 0, y: HALF_LEN }, { x: PITCH_W, y: HALF_LEN }], line);
    arc(c, cam, CX, HALF_LEN, CENTRE_R, Math.PI, 2 * Math.PI, line);
    rectLine(c, cam, BOX_L, 0, BOX_R, BOX_DEPTH, line);
    rectLine(c, cam, SIX_L, 0, SIX_R, SIX_DEPTH, line);
    const a = Math.acos((BOX_DEPTH - PEN_SPOT_Y) / ARC_R);
    arc(c, cam, CX, PEN_SPOT_Y, ARC_R, Math.PI / 2 - a, Math.PI / 2 + a, line);
    { const s = toScreen(cam, { x: CX, y: PEN_SPOT_Y }); c.drawCircle(s.X, s.Y, 2.5, fill("#ffffff")); }
    // The goal: its net behind the line, the posts on it.
    polyline(c, cam, [{ x: POST_L, y: 0 }, { x: POST_L, y: -NET_DEPTH - 0.8 }, { x: POST_R, y: -NET_DEPTH - 0.8 }, { x: POST_R, y: 0 }], fill("rgba(255,255,255,0.28)"), true);
    polyline(c, cam, [{ x: POST_L, y: 0 }, { x: POST_R, y: 0 }], stroke("#ffffff", 5));

    if (d.phase === "tdDribble" && d.td) { drawDribble(c, d, cam, kits); return; }

    const sc = d.sc;
    const home = d.setup.fixture.home !== false;
    const ours = home ? kits.home : kits.away, theirs = home ? kits.away : kits.home;
    const r0 = Math.max(4, mPx(cam, 0.42));
    const fig = (p: { x: number; y: number }, role: "you" | "mate" | "opp" | "keeper", hi = false) => {
      const s = toScreen(cam, p);
      drawFigure(c, s.X, s.Y, r0 * s.k, role, role === "opp" ? theirs : role === "keeper" ? kits.keeper : ours, hi);
    };
    for (const df of sc.defenders) fig(df, "opp");
    fig({ x: sc.keeper.x + (sc.keeper.dive || 0), y: sc.keeper.y }, "keeper");
    for (const m of sc.teammates) fig(m, "mate");
    if (sc.runner) fig(sc.runner.pos, "mate", sc.relayTo === sc.runner);
    for (const r of sc.secondaryRunners) fig(r.pos, "mate", sc.relayTo === r);
    if (sc.follower && (sc.follower.active || sc.follower.who)) fig(sc.follower, "mate", !!sc.relayToFollower);
    fig(sc.player, "you", true);

    // The ball (and its shadow on the grass).
    const b = d.ball;
    const bp = b ? b.pos : sc.ball, bz = b ? b.z : (d.lead ? 0 : 0);
    const bs = toScreen(cam, bp);
    const br = Math.max(3, mPx(cam, 0.3) * bs.k);
    c.drawCircle(bs.X + bz * br * 0.6, bs.Y + bz * br * 0.3, br, fill("rgba(0,0,0,0.3)"));
    c.drawCircle(bs.X, bs.Y - bz * br * 1.6, br * (1 + bz * 0.06), fill("#ffffff"));
    c.drawCircle(bs.X, bs.Y - bz * br * 1.6, br * (1 + bz * 0.06), stroke("#222222", 1));

    // The aim: an arrow from the ball the opposite way to the drag, as long as the power.
    if (d.drag && d.phase === "aim") {
      const ball = sc.ball;
      const dir = { x: ball.x - d.drag.x, y: ball.y - d.drag.y };
      const tip = { x: ball.x + dir.x * 1.6, y: ball.y + dir.y * 1.6 };
      const s0 = toScreen(cam, ball), s1 = toScreen(cam, tip);
      c.drawLine(s0.X, s0.Y, s1.X, s1.Y, stroke("#f97316", 6));
      c.drawCircle(s1.X, s1.Y, 6, fill("#f97316"));
    }
  }, { width: W, height: H });
}

function drawDribble(c: SkCanvas, d: MatchDriver, cam: Cam, kits: MatchKits) {
  const run = d.td!;
  const home = d.setup.fixture.home !== false;
  const ours = home ? kits.home : kits.away, theirs = home ? kits.away : kits.home;
  const r0 = Math.max(4, mPx(cam, 0.42));
  for (const m of run.mates) { const s = toScreen(cam, m); drawFigure(c, s.X, s.Y, r0 * s.k, "mate", ours); }
  for (const df of run.defenders) {
    if (df.phase === "beaten") continue;
    const s = toScreen(cam, df); drawFigure(c, s.X, s.Y, r0 * s.k, "opp", theirs);
  }
  const s = toScreen(cam, { x: run.x, y: run.y });
  drawFigure(c, s.X, s.Y, r0 * s.k, "you", ours, true);
  const bs = toScreen(cam, { x: run.x + 0.3, y: run.y - 0.6 });
  c.drawCircle(bs.X, bs.Y, Math.max(3, mPx(cam, 0.3) * bs.k), fill("#ffffff"));
}
