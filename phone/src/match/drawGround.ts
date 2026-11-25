/**
 * THE GROUND UNDER THE MATCH: the website's new-view grass, lines and goal
 * (components/star/CanvasMatch.tsx drawMowedPitch + its markings, and
 * lib/star/matchGoal.ts drawMatchGoal through draw/ctx2d.ts), in the
 * website's flat-canvas pixels and then tipped back with the camera's tilt
 * (view.ts tiltMatrix), exactly as the website tips its whole canvas.
 *
 * Speed (nothing here is redrawn from scratch per frame):
 *   - the grass, worn patches and lines are recorded ONCE, in pitch metres;
 *     the camera only moves and turns that picture (pitchMatrix), so a
 *     camera that pans every frame re-uses it (again only on a big zoom);
 *   - the goal is recorded once per camera (its posts are stood up on the
 *     tipped screen, which depends on where the camera is);
 *   - the grass grain and the screen's vignette are ONE picture per size.
 * Drawing only: nothing here is read back by the match.
 */
import type { SkCanvas, SkImage, SkPicture } from "@shopify/react-native-skia";
import { PITCH_W, HALF_LEN, CX, SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH, PEN_SPOT_Y, ARC_R, CENTRE_R, CORNER_R } from "@/lib/star/pitch";
import { drawMatchGoal } from "@/lib/star/matchGoal";
import { canvasToScreen, screenToCanvas } from "@/lib/star/cameraTilt";
import type { ScenePicture } from "@/lib/star/scenePicture";
import { createCtx2D } from "../draw/ctx2d";
import { sk } from "./skiaApi";
import { toCanvasPx, tiltMatrix, type Cam } from "./view";

// CanvasMatch's own numbers (new view).
const MOW_SQUARE_M = 6.4;
const MOW_BASE = "#22920b";
const MOW_LIGHT = "rgba(150,230,90,0.085)";
const LINE_NEW = "rgba(255,255,255,0.92)";
const GRASS_TILE = 96;
/** From the side the net is drawn a real goal's depth (CanvasMatch SIDE_NET_DEPTH). */
const SIDE_NET_DEPTH = 2.0;
/** How far round the pitch the grass is drawn (metres): past any camera's frame. */
const AROUND = { x1: -60, y1: -60, x2: PITCH_W + 60, y2: 2 * HALF_LEN + 60 };

type Ctx = CanvasRenderingContext2D;
type Pt = { px: number; py: number };

/** CanvasMatch makeGrassTile: the same fixed grain (one 96 px tile, made once). */
let grain: SkImage | null = null;
function grainTile(): SkImage | null {
  if (grain) return grain;
  const S = sk();
  const data = new Uint8Array(GRASS_TILE * GRASS_TILE * 4);
  let seed = 0x2f6f2b;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 16) & 0xff) / 255;
    const v = n > 0.5 ? 255 : 0;
    data[i] = v; data[i + 1] = v; data[i + 2] = v;
    data[i + 3] = Math.round(Math.abs(n - 0.5) * 2 * 16);
  }
  grain = S.Image.MakeImage({ width: GRASS_TILE, height: GRASS_TILE, colorType: 4, alphaType: 3 }, S.Data.fromBytes(data), GRASS_TILE * 4);
  return grain;
}

/** The grass (drawMowedPitch's diamond mow), the worn patches and the lines, in pitch metres. */
function paintPitchSpace(g: Ctx, lwM: number, box: boolean) {
  const A = AROUND;
  g.fillStyle = MOW_BASE;
  g.fillRect(A.x1, A.y1, A.x2 - A.x1, A.y2 - A.y1);
  // The diamond lattice: u = (x + y) / 2s, v = (x - y) / 2s, the odd cells lighter.
  const s = MOW_SQUARE_M * Math.SQRT2 / 2;
  const u0 = Math.floor((A.x1 + A.y1) / (2 * s)), u1 = Math.ceil((A.x2 + A.y2) / (2 * s));
  const v0 = Math.floor((A.x1 - A.y2) / (2 * s)), v1 = Math.ceil((A.x2 - A.y1) / (2 * s));
  g.fillStyle = MOW_LIGHT;
  g.beginPath();
  for (let u = u0; u <= u1; u++) {
    for (let v = v0; v <= v1; v++) {
      if (((u + v) & 1) === 0) continue;
      const su = (2 * u + 1) * s, sv = (2 * v + 1) * s;
      const cx = (su + sv) / 2, cy = (su - sv) / 2;
      if (cx < A.x1 - s || cx > A.x2 + s || cy < A.y1 - s || cy > A.y2 + s) continue;
      g.moveTo(cx - s, cy); g.lineTo(cx, cy - s); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s); g.closePath();
    }
  }
  g.fill();

  // Worn grass where a season's football happens: the goalmouth, the spot, the centre.
  const wear = (x: number, y: number, rx: number, ry: number, alpha: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    gr.addColorStop(0, `rgba(120,132,26,${alpha})`);
    gr.addColorStop(1, "rgba(120,132,26,0)");
    g.save();
    g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
    g.fillStyle = gr;
    g.fillRect(x - rx * 1.2, y - rx * 1.2, rx * 2.4, rx * 2.4);
    g.restore();
  };
  if (box) { wear(CX, 1.9, 6.2, 2.4, 0.22); wear(CX, PEN_SPOT_Y, 3.2, 2.2, 0.16); }
  wear(CX, HALF_LEN, 3.4, 2.4, 0.14);

  // Markings, every line at its real distance.
  g.lineWidth = lwM;
  g.strokeStyle = LINE_NEW;
  // Every STRAIGHT line is a thin filled bar, not a stroked path. Stroked, the long ones (the goal line, the
  // 18-yard box: wider than the screen once the camera is close) were dropped whole by the phone's graphics
  // chip under the camera's tilt: a penalty showed the six-yard box and the D with no 18-yard line between
  // them (playtest round 2, `in-setpiece-n.jpg`; the same code on a plain surface drew them). A filled bar
  // is drawn at any size. Across-lines run the full length, corners included; up-lines fit between them.
  const h = lwM / 2;
  g.fillStyle = LINE_NEW;
  const across = (x1: number, x2: number, y: number) => g.fillRect(x1 - h, y - h, x2 - x1 + lwM, lwM);
  const up = (x: number, y1: number, y2: number) => g.fillRect(x - h, y1 + h, lwM, y2 - y1 - lwM);
  const boxLines = (l: number, r: number, depth: number) => { across(l, r, depth); up(l, 0, depth); up(r, 0, depth); };
  across(0, PITCH_W, 0); up(0, 0, HALF_LEN + lwM); up(PITCH_W, 0, HALF_LEN + lwM);
  if (box) {
    boxLines(BOX_L, BOX_R, BOX_DEPTH);
    boxLines(SIX_L, SIX_R, SIX_DEPTH);
    g.beginPath(); g.arc(CX, PEN_SPOT_Y, Math.max(lwM * 1.07, 0.11), 0, Math.PI * 2); g.fillStyle = "rgba(255,255,250,0.85)"; g.fill();
    const half = Math.acos(Math.max(-1, Math.min(1, (BOX_DEPTH - PEN_SPOT_Y) / ARC_R)));
    g.beginPath(); g.arc(CX, PEN_SPOT_Y, ARC_R, Math.PI / 2 - half, Math.PI / 2 + half); g.stroke();
  }
  g.beginPath(); g.arc(0, 0, CORNER_R, 0, Math.PI / 2); g.stroke();
  g.beginPath(); g.arc(PITCH_W, 0, CORNER_R, Math.PI / 2, Math.PI); g.stroke();
  g.fillStyle = LINE_NEW;
  g.fillRect(h, HALF_LEN - h, PITCH_W - lwM, lwM);
  g.beginPath(); g.arc(CX, HALF_LEN, CENTRE_R, 0, Math.PI * 2); g.stroke();
}

/** Pitch metres -> the website's flat-canvas px for this camera (view.ts toFrac, as one matrix). */
function pitchMatrix(cam: Cam): number[] {
  const { W, H, vp } = cam;
  const wv = vp.x2 - vp.x1, hv = vp.y2 - vp.y1;
  if (cam.facing === "right") return [0, -W / hv, W + (vp.y1 * W) / hv, H / wv, 0, (-vp.x1 * H) / wv, 0, 0, 1];
  if (cam.facing === "left") return [0, W / hv, (-vp.y1 * W) / hv, -H / wv, 0, H + (vp.x1 * H) / wv, 0, 0, 1];
  return [W / wv, 0, (-vp.x1 * W) / wv, 0, H / hv, (-vp.y1 * H) / hv, 0, 0, 1];
}

/** The goal (lib/star/matchGoal.ts) in the flat canvas's px, posts standing straight on the tipped screen. */
function paintGoal(g: Ctx, cam: Cam) {
  const { W, H, vp } = cam;
  const turned = cam.facing !== "up";
  const unit = turned ? H / (vp.x2 - vp.x1) : W / (vp.x2 - vp.x1);
  const uy = turned ? W / (vp.y2 - vp.y1) : H / (vp.y2 - vp.y1);
  const P = (x: number, y: number): Pt => { const s = toCanvasPx(cam, { x, y }); return { px: s.X, py: s.Y }; };
  const tg = cam.tilt;
  const upright = tg ? (foot: Pt, top: Pt): Pt => {
    const F = canvasToScreen(tg, foot.px / W, foot.py / H, tg.W, tg.H);
    const T = canvasToScreen(tg, top.px / W, top.py / H, tg.W, tg.H);
    const q = screenToCanvas(tg, F.X, T.Y, tg.W, tg.H);
    return { px: q.sx * W, py: q.sy * H };
  } : undefined;
  drawMatchGoal(g, P, unit, uy, upright, turned ? SIDE_NET_DEPTH : undefined);
}

/**
 * The grass grain and the soft vignette at the screen's edges, baked into ONE
 * picture per screen size (as shaders they are two full-screen passes per
 * frame; as a picture, one plain blit). The grain is pinned to the screen
 * here, not the pitch: at 16/255 at most it is not seen move.
 */
let overlay: { key: string; image: SkImage | null } | null = null;
function overlayImage(W: number, H: number): SkImage | null {
  const key = `${W}x${H}`;
  if (overlay && overlay.key === key) return overlay.image;
  const S = sk();
  const surf = S.Surface.Make(Math.max(1, Math.round(W)), Math.max(1, Math.round(H)));
  let image: SkImage | null = null;
  if (surf) {
    const c = surf.getCanvas();
    const tile = grainTile();
    if (tile) {
      const p = S.Paint();
      p.setShader(tile.makeShaderOptions(1, 1, 0, 0));
      c.drawRect(S.XYWHRect(0, 0, W, H), p);
    }
    const v = S.Paint();
    v.setShader(S.Shader.MakeTwoPointConicalGradient(
      { x: W / 2, y: H / 2 }, Math.min(W, H) * 0.45, { x: W / 2, y: H / 2 }, Math.hypot(W, H) * 0.56,
      [S.Color("rgba(0,20,0,0)"), S.Color("rgba(0,20,0,0.26)")], [0, 1], 0,
    ));
    c.drawRect(S.XYWHRect(0, 0, W, H), v);
    surf.flush();
    image = surf.makeImageSnapshot();
  }
  overlay = { key, image };
  return image;
}

let ground: { key: string; pic: SkPicture } | null = null;
let goal: { key: string; pic: SkPicture } | null = null;
/** How many times each part was recorded (tools/match-frame.ts reads it). */
export const groundStats = { recorded: 0, ms: 0, goals: 0, goalMs: 0 };

function camKey(cam: Cam): string {
  const v = cam.vp;
  return `${cam.W}x${cam.H}|${cam.facing}|${cam.tilt?.deg ?? 0}|${v.x1.toFixed(3)},${v.y1.toFixed(3)},${v.x2.toFixed(3)},${v.y2.toFixed(3)}`;
}

/** Stamp the ground under everything else in the frame. */
export function drawGround(c: SkCanvas, cam: Cam, scene: ScenePicture | undefined) {
  const S = sk();
  const vp = cam.vp;
  const unit = cam.facing !== "up" ? cam.H / (vp.x2 - vp.x1) : cam.W / (vp.x2 - vp.x1);
  // The website's line is 1.4 to 2.4 px whatever the zoom; in metres, for the zoom in 5% steps.
  const unitStep = Math.exp(Math.round(Math.log(Math.max(1e-3, unit)) / 0.05) * 0.05);
  const lwM = Math.max(1.4, Math.min(2.4, unitStep * 0.12)) / unitStep;
  const box = scene?.box !== false;
  const gKey = `${lwM.toFixed(4)}|${box ? 1 : 0}`;
  if (!ground || ground.key !== gKey) {
    const t0 = Date.now();
    const rec = S.PictureRecorder();
    const A = AROUND;
    const canvas = rec.beginRecording(S.XYWHRect(A.x1, A.y1, A.x2 - A.x1, A.y2 - A.y1));
    paintPitchSpace(createCtx2D(S, canvas, { width: A.x2, height: A.y2 }) as unknown as Ctx, lwM, box);
    ground = { key: gKey, pic: rec.finishRecordingAsPicture() };
    groundStats.recorded++;
    groundStats.ms += Date.now() - t0;
  }
  const wantGoal = scene?.goal !== false;
  const key = camKey(cam);
  if (wantGoal && (!goal || goal.key !== key)) {
    const t0 = Date.now();
    const rec = S.PictureRecorder();
    const canvas = rec.beginRecording(S.XYWHRect(-cam.W, -cam.H, cam.W * 3, cam.H * 3));
    paintGoal(createCtx2D(S, canvas, { width: cam.W, height: cam.H }) as unknown as Ctx, cam);
    goal = { key, pic: rec.finishRecordingAsPicture() };
    groundStats.goals++;
    groundStats.goalMs += Date.now() - t0;
  }
  const tilt = tiltMatrix(cam);
  c.save();
  if (tilt) c.concat(tilt);
  c.save();
  c.concat(S.Matrix(pitchMatrix(cam)));
  c.drawPicture(ground.pic);
  c.restore();
  if (wantGoal && goal) c.drawPicture(goal.pic);
  c.restore();
  const img = overlayImage(cam.W, cam.H);
  if (img) c.drawImage(img, 0, 0);
}
