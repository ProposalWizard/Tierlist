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
import { toScreen, makeCam, type Cam } from "./view";
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
export function drawPitch(d: MatchDriver, kits: MatchKits, W: number, H: number): SkPicture {
  const S = sk();
  const rec = S.PictureRecorder();
  const c = rec.beginRecording(S.XYWHRect(0, 0, W, H));
  paintPitch(c, d, kits, W, H);
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
  if (scene?.you !== false) man("you", sc.player, "you", true);
  queue.sort((a, q) => a.y - q.y).forEach((f) => f.draw());

  // The ball (and its shadow on the grass): the website's drawn match ball (lib/star/matchBall.ts).
  const bp = b ? b.pos : sc.ball, bz = b ? b.z : 0;
  paintBall(c, cam, bp, bz, W, H);

  // The aim: an arrow from the ball the opposite way to the drag, as long as the power.
  if (d.drag && d.phase === "aim") {
    const ball = sc.ball;
    const dir = { x: ball.x - d.drag.x, y: ball.y - d.drag.y };
    const tip = { x: ball.x + dir.x * 1.6, y: ball.y + dir.y * 1.6 };
    const s0 = toScreen(cam, ball), s1 = toScreen(cam, tip);
    c.drawLine(s0.X, s0.Y, s1.X, s1.Y, stroke("#f97316", 6));
    c.drawCircle(s1.X, s1.Y, 6, fill("#f97316"));
  }
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
