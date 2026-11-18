/**
 * THE PAINTING STEPS OF THE WEBSITE'S PLAYER PICTURES, WITHOUT ANY SCREEN CODE.
 * Lifted line for line from components/star/DrawnHeadChip.tsx and
 * components/star/PlayerAvatar.tsx (those are website screens, so they can't
 * be imported here), calling the same lib/star drawers. Plain functions on a
 * canvas context: PlayerHead.tsx / PlayerFigure.tsx use them on the phone,
 * and tools/draw-check.ts runs them in node and in a real browser to compare.
 */
import { drawFigureAt, drawBall, bodyPoseFor, FIGURE_HEIGHT_R, FEET_Y } from "@/lib/star/fiveASide/render";
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import { paintHeroBack } from "@/lib/star/heroBack";
import { compositeLit, paintHeroFigure, paintHeroShadow, HERO_W, HERO_H, HERO_TOP, HERO_CREST, type AvatarStyle } from "@/lib/star/heroFigure";
import type { FittedHead } from "@/lib/star/faceFit";

/** DrawnHeadChip's drawing (its dpr step is the caller's: the phone draws in points). */
export function paintHeadChip(g: CanvasRenderingContext2D, { id, shirt, shorts, trim, size, skin }: {
  id: string; shirt: string; shorts: string; trim: string; size: number; skin?: string;
}): void {
  g.clearRect(0, 0, size, size);
  const r = size * 1.25;
  const crown = size * 0.1;
  const groundY = crown + r * FIGURE_HEIGHT_R;
  drawFigureAt(g, size / 2, groundY, r, { shirt, shorts, trim, id, skin }, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { shadowR: 0 });
}

/** components/star/PlayerAvatar.tsx AVATAR_STYLE. */
export const AVATAR_STYLE: AvatarStyle = "A2";

export function rimOf(kit: { shirt: string; trim: string }): string {
  return /^#?f{6}$/i.test(kit.shirt.trim()) ? kit.trim : kit.shirt;
}
export function heroScale(width: number, height: number): number {
  return Math.min(width / HERO_W, height / (HERO_H - HERO_TOP));
}
export function a1Geometry(width: number, height: number, ball: boolean) {
  const groundY = height - Math.max(8, height * 0.07);
  const r = Math.min((groundY - height * 0.1) / FIGURE_HEIGHT_R, width / 1.45);
  const x = width / 2 - (ball ? r * 0.2 : 0);
  return { groundY, r, x };
}

export interface FigureArgs {
  width: number; height: number; dpr: number;
  kit: { shirt: string; trim: string };
  skin: string;
  face?: HTMLImageElement;
  number: number | null;
  fitted: FittedHead | null;
  look: AvatarStyle;
  celebrate: boolean;
  view: "front" | "back";
  ball: boolean;
  firstName: string; lastName: string;
}

/**
 * PlayerAvatar's draw(): the canvas is width×dpr by height×dpr pixels.
 * `layer(w, h)` makes a hidden canvas (document.createElement("canvas") on
 * the website). compositeLit makes more of its own through `document`.
 */
export function paintPlayerFigure(ctx: CanvasRenderingContext2D, a: FigureArgs, layer: (w: number, h: number) => HTMLCanvasElement): void {
  const { width, height, dpr, kit, skin, face, number, look, celebrate, view, ball } = a;
  const canvas = ctx.canvas;
  const drawA1 = () => {
    const lyr = layer(canvas.width, canvas.height);
    const lx = lyr.getContext("2d");
    if (!lx) return;
    lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { groundY, r, x } = a1Geometry(width, height, ball);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fs = ctx.createRadialGradient(x, groundY, 2, x, groundY, r * 0.75);
    fs.addColorStop(0, "rgba(0,0,0,0.55)"); fs.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fs;
    ctx.beginPath(); ctx.ellipse(x, groundY, r * 0.75, r * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    const pose = celebrate ? { armSpread: 0.15, armLift: 2.2 } : { ...bodyPoseFor("idle", 0), armSpread: 0.12 };
    drawFigureAt(lx, x, groundY, r, { shirt: kit.shirt, shorts: kit.trim, trim: kit.trim, skin, face },
      { ...DEFAULT_FACE_STYLE, outlineEnabled: false }, DEFAULT_FAKE_FACE_STYLE,
      { pose, shadowR: 0.001, liftPx: celebrate ? r * 0.05 : 0, skin: "classic", edge: 0.35 });
    if (ball) {
      const unit = r / 1.05;
      drawBall(lx, { px: (v) => v, py: (v) => v, unit, W: width, H: height }, { x: x + r * 0.62, y: groundY - r * 0.02 }, 0, 0.42);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lyr, 0, 0);
  };
  const drawA2 = () => {
    const lyr = layer(canvas.width, canvas.height);
    const lx = lyr.getContext("2d");
    if (!lx) return;
    const s = heroScale(width, height);
    const fitted = look === "A2" ? a.fitted : null;
    lx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (width - HERO_W * s) / 2, dpr * (height - HERO_H * s));
    const heroLook = { shirt: kit.shirt, shorts: kit.trim, trim: kit.trim, skin: fitted?.skin ?? skin, face, number, fitted };
    if (view === "back") paintHeroBack(lx, { ...heroLook, surname: a.lastName, key: `${a.firstName} ${a.lastName}` });
    else paintHeroFigure(lx, heroLook, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { armsUp: celebrate, shadow: false });
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (width - HERO_W * s) / 2, dpr * (height - HERO_H * s));
    paintHeroShadow(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    compositeLit(ctx, lyr, { rim: rimOf(kit), d: Math.max(3, 2 * dpr), shade: false });
  };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (look === "A2" || view === "back") drawA2(); else drawA1();
}

/** Where PlayerAvatar puts the chest crest (centre and size, in points), or null. */
export function crestPlace(width: number, height: number, look: AvatarStyle, celebrate: boolean, view: "front" | "back", ball: boolean) {
  if (celebrate || view !== "front") return null;
  if (look === "A2") {
    const s = heroScale(width, height);
    return {
      left: (width - HERO_W * s) / 2 + HERO_CREST.x * HERO_W * s,
      top: (height - HERO_H * s) + HERO_CREST.y * HERO_H * s,
      size: Math.max(12, Math.round(HERO_CREST.size * HERO_W * s)),
    };
  }
  const a1 = a1Geometry(width, height, ball);
  return { left: a1.x + a1.r * 0.17, top: a1.groundY - a1.r * (FEET_Y + 0.78), size: Math.max(12, Math.round(a1.r * 0.2)) };
}
