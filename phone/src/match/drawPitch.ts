/**
 * ONE FRAME OF THE PITCH, recorded as a Skia picture (no React work per frame).
 * Reads the driver; never changes it. The players are the website's sprites
 * (match/figures.ts), the rest the phone's own lines and ball.
 * Draws with match/skiaApi.ts's Skia, so tools/match-frame.ts can time the
 * very same code headless.
 */
import type { SkCanvas, SkPicture } from "@shopify/react-native-skia";
import { OUTCOME_TEXT } from "@/lib/star/canvasEngine";
import { autoKickOf } from "@/lib/star/penaltyTaking";
import { keeperKit, type MatchKits } from "@/lib/star/kits";
import type { MatchDriver } from "./driver";
import { toScreen, makeCam, screenPull, grabMetres, type Cam } from "./view";
import { dragForFullPower } from "@/lib/star/canvasEngine";
import { matchFeelOn, feelDials, streakMetres } from "@/lib/star/matchFeel";
import { drawSpeedStreak } from "@/lib/star/matchFeelDraw";
import { nudgedDir, goalLineX } from "@/lib/star/penaltyRunup";
import { sk, fill, stroke } from "./skiaApi";
import { drawMan, drawKeeperFig, beginFigures, unitPx, type FigureRole } from "./figures";
import { footSign } from "@/lib/star/kickFoot";
import { drawGround } from "./drawGround";
import { drawMatchBall } from "@/lib/star/matchBall";
import { NEW_BALL_SCALE, NEW_VIEW_WIDTH_M, REFERENCE_CAMERA_M } from "@/lib/star/matchView";
import { createCtx2D } from "../draw/ctx2d";

/** CanvasMatch's figure zoom divisor in the new view (figures.ts FIG_DIV). */
const BALL_DIV = NEW_VIEW_WIDTH_M / REFERENCE_CAMERA_M;

/** The camera the pitch is drawn with this frame. */
export function camFor(d: MatchDriver, W: number, H: number): Cam {
  const lead = d.leadCamera();
  return makeCam(lead ?? d.viewport, d.facing, d.tiltDeg, W, H);
}

/** Which side's men celebrate (CanvasMatch goalSideRef): a goal in the result phase. */
function celebrating(d: MatchDriver): "us" | "them" | null {
  if (d.phase !== "result" || !d.outcome || OUTCOME_TEXT[d.outcome].kind !== "goal") return null;
  return autoKickOf(d.sc)?.side === "them" ? "them" : "us";
}
let strikeBall: unknown = null, strikeAt = 0;

/** Record one frame. */
export function drawPitch(d: MatchDriver, kits: MatchKits, W: number, H: number, shake?: { x: number; y: number }): SkPicture {
  const S = sk();
  const rec = S.PictureRecorder();
  const c = rec.beginRecording(S.XYWHRect(0, 0, W, H));
  // The camera nudge and punch (match/feel.ts; CanvasMatch's ox, oy): the whole picture moves.
  const moved = !!shake && (shake.x !== 0 || shake.y !== 0);
  if (moved) { c.save(); c.translate(shake!.x, shake!.y); }
  paintPitch(c, d, kits, W, H);
  if (moved) c.restore();
  return rec.finishRecordingAsPicture();
}

/** The frame's drawing onto any Skia canvas (a picture on the phone, a surface in the timing tool). */
export function paintPitch(c: SkCanvas, d: MatchDriver, kits: MatchKits, W: number, H: number) {
  const S = sk();
  const cam = camFor(d, W, H);
  const scene = d.feature?.scene;
  // The grass, lines and goal: recorded once per camera, stamped here (drawGround.ts).
  drawGround(c, cam, scene);
  // A feature's cones on the grass (the markers prop), under everyone.
  for (const m of d.markersNow()) {
    const s = toScreen(cam, m), r = Math.max(3, unitPx(cam) * 0.35 * s.k);
    const p = S.PathBuilder.Make();
    p.moveTo(s.X, s.Y - r * 1.6); p.lineTo(s.X + r * 0.8, s.Y); p.lineTo(s.X - r * 0.8, s.Y); p.close();
    c.drawPath(p.build(), fill(m.color ?? "#f97316"));
  }

  const b = d.ball;
  if (b !== strikeBall) { strikeBall = b; strikeAt = d.now; }
  beginFigures(d.phase === "tdDribble" ? d.td : d.sc, {
    now: d.now / 1000,
    ball: b ? b.pos : d.phase === "tdDribble" && d.td ? { x: d.td.x, y: d.td.y } : d.sc.ball,
    celebrate: celebrating(d),
    kickT: b ? (d.now - strikeAt) / 1000 : null,
    live: b, sc: d.phase === "tdDribble" ? null : d.sc,
    foot: footSign(d.setup.career?.player.preferredFoot),
    aerial: d.aerialNow(),
  });

  if (d.phase === "tdDribble" && d.td) { drawDribble(c, d, cam, kits); return; }

  paintTrailAndLanding(c, d, cam);

  const sc = d.sc;
  const home = d.setup.fixture.home !== false;
  const ours = home ? kits.home : kits.away, theirs = home ? kits.away : kits.home;
  // Men are drawn far to near (CanvasMatch's figure queue, sorted by screen y).
  const queue: { y: number; draw: () => void }[] = [];
  const man = (id: string, p: { x: number; y: number }, role: FigureRole, hi = false) => {
    queue.push({ y: toScreen(cam, p).Y, draw: () => drawMan(c, cam, id, p, role, role === "opp" ? theirs : ours, hi) });
  };
  sc.defenders.forEach((df, i) => man(`def${i}`, df, "opp"));
  {
    const kk = sc.keeper;
    // Their penalty at YOUR keeper (a shootout): he wears your keeper's kit.
    const gk = autoKickOf(sc)?.side === "them" ? keeperKit(ours.shirt, kits.keeper.shirt) : kits.keeper;
    if (!(scene?.keeper === false)) queue.push({ y: toScreen(cam, kk).Y, draw: () => drawKeeperFig(c, cam, kk, gk) });
  }
  sc.teammates.forEach((m, i) => man(`mate${i}`, m, "mate"));
  // CanvasMatch's sids (and the engine's actors, canvasEngine runnerActor): run0 the runner, then the others.
  [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners].forEach((r, i) => man(`run${i}`, r.pos, "mate", sc.relayTo === r));
  if (sc.follower && (sc.follower.active || sc.follower.who)) man("follower", sc.follower, "mate", !!sc.relayToFollower);
  if (scene?.you !== false) {
    // A penalty someone else takes (a shootout, the trial's takers): he wears his own side's kit,
    // named over his head, no star (CanvasMatch: takerKit, label, labelBig).
    const auto = autoKickOf(sc);
    if (auto) {
      const role: FigureRole = auto.side === "them" ? "opp" : "mate";
      queue.push({ y: toScreen(cam, sc.player).Y, draw: () => drawMan(c, cam, "you", sc.player, role, auto.side === "them" ? theirs : ours, false, auto.taker.shortName) });
    } else man("you", sc.player, "you", true);
  }
  queue.sort((a, q) => a.y - q.y).forEach((f) => f.draw());

  // The ball (and its shadow on the grass): the website's drawn match ball (lib/star/matchBall.ts).
  const bp = b ? b.pos : sc.ball, bz = b ? b.z : 0;
  paintBall(c, cam, bp, bz, W, H);

  // The aim (CanvasMatch drawAimArrow): drawn for the drag, and kept on screen
  // through the run-up (the same arrow both times, so it reads the same).
  if (d.drag && d.phase === "aim") {
    const ball = sc.ball;
    const power = clamp01(screenPull(cam, d.drag, ball) / dragForFullPower(d.setup.skills.power));
    paintAimArrow(c, cam, ball, ball.x - d.drag.x, ball.y - d.drag.y, power);
  }
  const ru = d.runup;
  if (d.phase === "runup" && ru && !ru.auto) {
    const dir = ru.nudge ? nudgedDir(sc.ball, ru.dir0, ru.nudgeM) : ru.dir0;
    if (ru.nudge) {
      // A faint line on to the goal line and a ring where it crosses (CanvasMatch's runup frame).
      const unit = unitPx(cam);
      const from = toScreen(cam, sc.ball), to = toScreen(cam, { x: goalLineX(sc.ball, dir), y: 0 });
      const g = ctx2d(c, cam);
      g.save();
      g.setLineDash([Math.max(3, unit * 0.5), Math.max(3, unit * 0.45)]);
      g.strokeStyle = "rgba(255,255,255,0.6)";
      g.lineWidth = Math.max(1.5, cam.W * 0.005);
      g.beginPath(); g.moveTo(from.X, from.Y); g.lineTo(to.X, to.Y); g.stroke();
      g.setLineDash([]);
      g.beginPath(); g.arc(to.X, to.Y, Math.max(4, unit * 0.55), 0, Math.PI * 2);
      g.strokeStyle = "#fbbf24"; g.lineWidth = Math.max(2, cam.W * 0.007); g.stroke();
      g.restore();
    }
    paintAimArrow(c, cam, sc.ball, dir.x, dir.y, ru.power);
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** CanvasMatch trailRef: where the ball was on each drawn frame of the flight (16 kept). */
const trail: { x: number; y: number; z: number }[] = [];
let trailBall: unknown = null;

/**
 * The ball's trail and where it will land (CanvasMatch's "Ball trail" and
 * "Where it will land"): drawn on the grass, under everyone. Match feel New
 * (the default) draws a speed streak; Old the fading dots. A ball in the air
 * gets a yellow ✕ on its first bounce (ball.landAt, pinned at the kick).
 */
function paintTrailAndLanding(c: SkCanvas, d: MatchDriver, cam: Cam) {
  const b = d.ball;
  if (b !== trailBall) { trailBall = b; trail.length = 0; }
  if (d.phase === "flight" && b && !b.resting) {
    trail.push({ x: b.pos.x, y: b.pos.y, z: b.z });
    if (trail.length > 16) trail.shift();
  } else if (trail.length) trail.shift();
  const unit = unitPx(cam);
  const ballPx = (k: number) => Math.max(3, (unit / BALL_DIV) * 0.5 * NEW_BALL_SCALE * k);
  const toS = (q: { x: number; y: number; z: number }) => { const f = toScreen(cam, q); return { x: f.X, y: f.Y - Math.max(0, q.z) * unit * f.k, k: f.k }; };
  let g: CanvasRenderingContext2D | null = null;
  const G = () => (g ??= ctx2d(c, cam));
  if (matchFeelOn()) {
    if (b && trail.length > 1 && d.phase === "flight") {
      const speed = Math.hypot(b.vel.x, b.vel.y, b.vz);
      const want = streakMetres(speed, feelDials());
      const head = { x: b.pos.x, y: b.pos.y, z: Math.max(0, b.z) };
      const pts: { x: number; y: number }[] = [toS(head)];
      let acc = 0, last = head;
      for (let i = trail.length - 1; i >= 0 && acc < want; i--) {
        const q = trail[i];
        acc += Math.hypot(q.x - last.x, q.y - last.y, q.z - last.z);
        pts.push(toS(q));
        last = q;
      }
      if (want > 0 && pts.length > 1) {
        pts.reverse();
        drawSpeedStreak(G(), pts, ballPx(toS(head).k) * 1.05, Math.min(1, (speed - 9) / 14));
      }
    }
  } else {
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i], k = (i + 1) / trail.length, s = toS(t);
      c.drawCircle(s.x, s.y, ballPx(s.k) * (0.3 + 0.5 * k), fill(`rgba(255,255,255,${(0.06 + 0.24 * k).toFixed(3)})`));
    }
  }
  if (b && d.phase === "flight" && !b.inNet && b.z > 0.15 && b.landAt) {
    const m = toScreen(cam, b.landAt);
    const r = Math.max(3.5, unit * 0.5);
    const p = stroke("rgba(250,214,74,0.95)", Math.max(2.5, unit * 0.19));
    c.drawLine(m.X - r, m.Y - r, m.X + r, m.Y + r, p);
    c.drawLine(m.X + r, m.Y - r, m.X - r, m.Y + r, p);
  }
}
const ctx2d = (c: SkCanvas, cam: Cam) => createCtx2D(sk(), c, { width: cam.W, height: cam.H }) as unknown as CanvasRenderingContext2D;

/**
 * CanvasMatch drawAimArrow: a solid, tapered orange arrow (a round-capped
 * gradient shaft into a triangular head with a darker edge), as long as the
 * power: power × the classic canvas height in metres × 0.132.
 */
function paintAimArrow(c: SkCanvas, cam: Cam, ball: { x: number; y: number }, dx: number, dy: number, power: number) {
  const len = Math.hypot(dx, dy) || 1;
  const lineLen = power * grabMetres(cam, 1) * 0.132;
  const a = toScreen(cam, ball);
  const b = toScreen(cam, { x: ball.x + (dx / len) * lineLen, y: ball.y + (dy / len) * lineLen });
  // Widths in the website's flat-canvas px, grown by the tilt's perspective where the ball is (its CSS tilt scales the drawn arrow too).
  const W = cam.W * a.k, unit = unitPx(cam) * a.k;
  const ang = Math.atan2(b.Y - a.Y, b.X - a.X);
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const nx = -uy, ny = ux;
  const arrowLen = Math.hypot(b.X - a.X, b.Y - a.Y) || 1;
  const headLen = Math.min(Math.max(W * 0.045, W * 0.02), arrowLen * 0.45);
  const headHalf = W * 0.022, shaftW = W * 0.014;
  const bx = b.X - ux * headLen, by = b.Y - uy * headLen;
  const g = ctx2d(c, cam);
  const grad = g.createLinearGradient(a.X, a.Y, b.X, b.Y);
  grad.addColorStop(0, "#fb923c");
  grad.addColorStop(1, "#ea580c");
  g.strokeStyle = grad;
  g.lineWidth = shaftW;
  g.lineCap = "round";
  g.beginPath(); g.moveTo(a.X, a.Y); g.lineTo(bx, by); g.stroke();
  g.lineCap = "butt";
  g.beginPath();
  g.moveTo(b.X, b.Y);
  g.lineTo(bx + nx * headHalf, by + ny * headHalf);
  g.lineTo(bx - nx * headHalf, by - ny * headHalf);
  g.closePath();
  g.fillStyle = "#f97316";
  g.fill();
  g.lineJoin = "round";
  g.lineWidth = Math.max(1, unit * 0.22);
  g.strokeStyle = "rgba(124,45,18,0.6)";
  g.stroke();
}

/**
 * The new view's ball (CanvasMatch drawBall → drawMatchBall): CanvasMatch's BALL_PX
 * (a man's scale: unit / the zoom divisor × 0.5 × NEW_BALL_SCALE), lifted by its height
 * and grown a little as it climbs, the panels turned by how far it has rolled.
 */
function paintBall(c: SkCanvas, cam: Cam, p: { x: number; y: number }, z: number, W: number, H: number) {
  const s = toScreen(cam, p);
  const h = Math.max(0, z);
  const r = Math.max(3, (unitPx(cam) / BALL_DIV) * 0.5 * NEW_BALL_SCALE * s.k) * (1 + Math.min(h, 8) * 0.09);
  // Height drawn straight up the screen at the pitch's own scale (CanvasMatch heightScale).
  const up = h * unitPx(cam) * s.k;
  const g = createCtx2D(sk(), c, { width: W, height: H }) as unknown as CanvasRenderingContext2D;
  drawMatchBall(g, s.X, s.Y, s.Y - up, r, (p.x + p.y) * 1.7, h, 1);
}

function drawDribble(c: SkCanvas, d: MatchDriver, cam: Cam, kits: MatchKits) {
  const run = d.td!;
  const home = d.setup.fixture.home !== false;
  const ours = home ? kits.home : kits.away, theirs = home ? kits.away : kits.home;
  const queue: { y: number; draw: () => void }[] = [];
  run.mates.forEach((m, i) => queue.push({ y: toScreen(cam, m).Y, draw: () => drawMan(c, cam, `mate${i}`, m, "mate", ours) }));
  run.defenders.forEach((df, i) => { if (df.phase !== "beaten") queue.push({ y: toScreen(cam, df).Y, draw: () => drawMan(c, cam, `chase${i}`, df, "opp", theirs) }); });
  const you = { x: run.x, y: run.y };
  queue.push({ y: toScreen(cam, you).Y, draw: () => drawMan(c, cam, "you", you, "you", ours, true) });
  queue.sort((a, q) => a.y - q.y).forEach((f) => f.draw());
  paintBall(c, cam, { x: run.x + 0.3, y: run.y - 0.6 }, 0, cam.W, cam.H);
}
