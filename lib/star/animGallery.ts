/**
 * THE ANIMATION GALLERY (/star-animations-dev) — every New animation, drawn
 * frame by frame from the same pose functions the match uses
 * (lib/star/actionAnim.ts), next to how the Old game draws that moment.
 *
 * No ball physics and no match loop: a moment here is a pose at a time. The
 * page paints each animation once into a strip of frames and lets the browser
 * step through the strip (a CSS sprite sheet), so nothing here runs a loop.
 *
 * The keeper's dive under the animation is a stand-in (a lunge that eases in
 * over a quarter of a second) using the match's own save shapes
 * (keeperSaveKinds.ts); in the match the dive comes from the engine.
 */
import type { BallAction } from "./canvasEngine";
import {
  animDuration, animFromAction, outfieldAnimFrame, keeperAnimFrame, keeperLeanWithAnim,
} from "./actionAnim";
import { DEFAULT_ANIM_SETTINGS, FIRST_VERSION_DIALS, type AnimFamily, type AnimSettings } from "./animDials";
import { keeperBasePose, KEEPER_SAVE_KIND, type KeeperSaveKind } from "./keeperSaveKinds";
import { drawFigureAt, drawKeeperAt, bodyPoseFor, FIGURE_HEIGHT_R, type BodyPose, type FigureLook } from "./fiveASide/render";
import type { FigureSkin } from "./figureSkin";
import { drawContactFlash } from "./actionAnimDraw";
import { DEFAULT_FACE_STYLE } from "./faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "./fakeFaceStyle";

export type GalleryVersion = "old" | "first" | "new";

export interface GalleryItem {
  id: string;
  label: string;
  group: "Keeper" | "Touches" | "Shots" | "Passes & headers" | "Defenders";
  family: AnimFamily;
  action: Pick<BallAction, "kind" | "mode" | "save"> & { z?: number };
  /** Keeper only: the save shape the dive is drawn with. */
  saveKind?: KeeperSaveKind;
  /** What the Old game showed at that moment. */
  oldNote: string;
}

export const GALLERY: GalleryItem[] = [
  { id: "k-top", label: "Top-corner save (one hand)", group: "Keeper", family: "keeperSaves", action: { kind: "save", save: "push", z: 2.2 }, saveKind: "fingertip", oldNote: "Two-handed flat dive" },
  { id: "k-beaten", label: "Beaten top corner", group: "Keeper", family: "keeperSaves", action: { kind: "save", save: "beaten", z: 2.3 }, saveKind: "high", oldNote: "Two-handed dive" },
  { id: "k-low", label: "Low save (palm)", group: "Keeper", family: "keeperSaves", action: { kind: "save", save: "parry", z: 0.3 }, saveKind: "low", oldNote: "Dive, stays down" },
  { id: "k-parry", label: "Parry", group: "Keeper", family: "keeperSaves", action: { kind: "save", save: "parry", z: 1.1 }, saveKind: "central", oldNote: "Arms wide, stays down" },
  { id: "k-catch", label: "Catch", group: "Keeper", family: "keeperCatch", action: { kind: "save", save: "catch", z: 1.0 }, saveKind: "catch", oldNote: "Arms out, never holds it" },
  { id: "k-fumble", label: "Fumble", group: "Keeper", family: "keeperCatch", action: { kind: "save", save: "fumble", z: 0.8 }, saveKind: "low", oldNote: "Dive only" },
  { id: "t-ground", label: "Touch (foot)", group: "Touches", family: "touch", action: { kind: "touch", mode: "ground" }, oldNote: "Stands, arms open" },
  { id: "t-thigh", label: "Touch (thigh)", group: "Touches", family: "touch", action: { kind: "touch", mode: "volley", z: 0.7 }, oldNote: "Stands, arms open" },
  { id: "t-chest", label: "Touch (chest)", group: "Touches", family: "touch", action: { kind: "touch", mode: "header", z: 1.3 }, oldNote: "Stands, arms open" },
  { id: "s-driven", label: "Driven shot", group: "Shots", family: "shots", action: { kind: "shot", mode: "ground" }, oldNote: "He stands still (your leg swung)" },
  { id: "s-curl", label: "Curled shot", group: "Shots", family: "shots", action: { kind: "shot", mode: "curl" }, oldNote: "He stands still" },
  { id: "s-volley", label: "Volley", group: "Shots", family: "shots", action: { kind: "shot", mode: "volley", z: 0.7 }, oldNote: "He stands still" },
  { id: "s-chip", label: "Chip", group: "Shots", family: "shots", action: { kind: "shot", mode: "chip" }, oldNote: "He stands still" },
  { id: "p-pass", label: "Side-foot pass", group: "Passes & headers", family: "passes", action: { kind: "pass", mode: "ground" }, oldNote: "He stands still" },
  { id: "p-header", label: "Header (shot)", group: "Passes & headers", family: "headers", action: { kind: "shot", mode: "header", z: 2.0 }, oldNote: "Stays on the grass" },
  { id: "d-block", label: "Block", group: "Defenders", family: "blocks", action: { kind: "block", mode: "ground" }, oldNote: "Stands still" },
  { id: "d-clear", label: "Clearance", group: "Defenders", family: "blocks", action: { kind: "clearance", mode: "ground" }, oldNote: "Stands still" },
  { id: "d-headclear", label: "Headed clearance", group: "Defenders", family: "headers", action: { kind: "clearance", mode: "header", z: 2.0 }, oldNote: "Stays on the grass" },
];

export const GALLERY_GROUPS = ["Keeper", "Touches", "Shots", "Passes & headers", "Defenders"] as const;

/** Before the animation starts, and the pause after it, in seconds. */
const PRE = 0.18, POST = 0.4, KEEPER_PRE = 0.25, KEEPER_AFTER = 1.75;

/** One loop of an item, in seconds. */
export function loopSeconds(it: GalleryItem): number {
  if (it.action.kind === "save") return KEEPER_PRE + KEEPER_AFTER;
  const a = animFromAction({ ...it.action, actor: "run0", seq: 1, t: 0 }, 0, {});
  return PRE + animDuration(a) + POST;
}

const OUR: FigureLook = { shirt: "#dc2626", shorts: "#f8fafc", trim: "#7f1d1d", skin: "#c68863", id: "gallery-mate" };
const KEEPER: FigureLook = { shirt: "#facc15", shorts: "#111827", trim: "#111827", skin: "#a8724f", id: "gallery-keeper" };
const DEF: FigureLook = { shirt: "#2563eb", shorts: "#1e3a8a", trim: "#1e3a8a", skin: "#8d5a3b", id: "gallery-def" };
const SCENE = {};

const easeOut = (u: number) => 1 - (1 - u) * (1 - u);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Paint one frame of `it` at loop time `t` into a cell whose ground line is
 * (cx, groundY), figure unit `r`. `foot` +1 right, −1 left (mirror).
 */
export function drawGalleryFrame(
  ctx: CanvasRenderingContext2D, it: GalleryItem, t: number,
  version: GalleryVersion, cx: number, groundY: number, r: number,
  skin: FigureSkin, foot: 1 | -1, settings: AnimSettings = DEFAULT_ANIM_SETTINGS,
): void {
  const dials = version === "first" ? FIRST_VERSION_DIALS : settings.dials;
  // A family switched off is drawn Old, as in the match.
  const isNew = version === "first" || (version === "new" && settings.on[it.family]);
  const flashOn = version === "first" ? false : settings.on.flashes;
  const a = animFromAction({ ...it.action, actor: it.action.kind === "save" ? "keeper" : "run0", seq: 1, t: 0, at: { x: 0, y: 0, z: it.action.z ?? 0 } }, 0, SCENE);
  const faceStyle = DEFAULT_FACE_STYLE, fake = DEFAULT_FAKE_FACE_STYLE;

  if (it.action.kind === "save") {
    // The stand-in dive: lunging from KEEPER_PRE − 0.1 s, the save at KEEPER_PRE.
    const lunge = easeOut(clamp01((t - KEEPER_PRE + 0.1) / 0.25));
    const kind = it.saveKind ?? null;
    const K = kind ? KEEPER_SAVE_KIND[kind] : null;
    const diveN = lunge * (K ? K.reachK : 0.55);
    const sign = foot;
    const e = t - KEEPER_PRE;
    const kAnim0 = isNew && e >= 0 ? keeperAnimFrame(a, e, kind === "high" || kind === "fingertip", dials) : null;
    const kAnim = kAnim0 && !flashOn ? { ...kAnim0, flash: 0 } : kAnim0;
    const base = keeperBasePose(kind, lunge, diveN, sign);
    const lean = keeperLeanWithAnim(base.leanRaw, kAnim, dials.oneHandLean);
    const x = cx - sign * r * 0.6 + sign * r * lunge * (K ? K.reachK : 1) * 0.3;
    const cyOff = r * (K ? K.crouch : 0) * lunge;
    const pose: BodyPose = {
      armSpread: Math.max(0, Math.min(1, base.armSpread + (kAnim?.armSpreadAdd ?? 0))),
      armLift: base.armLift + (kAnim?.armLiftAdd ?? 0),
      armLead: sign,
      ...(kAnim && (kAnim.trailDrop > 0 || kAnim.handsIn > 0) ? { trailDrop: kAnim.trailDrop, handsIn: kAnim.handsIn } : {}),
    };
    drawKeeperAt(ctx, x, groundY, r, KEEPER, { dive: 0, lunge }, faceStyle, fake, { facing: lean, liftPx: -cyOff, pose, skin });
    // Where the ball met him: off his leading glove.
    const bx = x + sign * r * (0.5 + diveN * 0.9);
    const by = groundY - r * 0.6 - (it.action.z ?? 0) * r * 0.55;
    if (e < 0) drawMarkerBall(ctx, bx + sign * r * (1 + (-e) * 4), by, r);
    else if (kAnim?.holding) drawMarkerBall(ctx, x + Math.sin(lean) * r * 0.9, groundY - r * 0.25 + cyOff - Math.cos(lean) * r * 0.9, r);
    if (kAnim && kAnim.flash > 0) drawContactFlash(ctx, bx, by, r * 0.82 * kAnim.flashSize, kAnim.flash);
    return;
  }

  const e = t - PRE;
  const look = it.action.kind === "block" || it.action.kind === "clearance" ? DEF : OUR;
  const fr = isNew ? outfieldAnimFrame(a, e, foot, dials) : null;
  let pose: BodyPose;
  if (fr) pose = { legSwing: 0, kick: 0, armSpread: 0, armLift: -0.55, ...fr.pose };
  else pose = bodyPoseFor(it.action.kind === "touch" && version === "old" && e >= 0 && e <= 0.45 ? "receive" : "idle", 0);
  const lift = fr && fr.liftR > 0 ? fr.liftR * r : 0;
  // The ball: waiting at his boot (or head) until he plays it.
  const z = it.action.z ?? 0;
  const ballX = cx + foot * r * 0.42;
  const ballY = z > 1.5 ? groundY - r * FIGURE_HEIGHT_R - r * 0.5 : groundY - r * 0.08 - z * r * 0.55;
  if (e < 0) drawMarkerBall(ctx, ballX, ballY + (it.action.kind === "touch" ? -e * r * 3 : 0), r);
  drawFigureAt(ctx, cx, groundY, r, look, faceStyle, fake, { facing: fr?.lean || undefined, liftPx: lift || undefined, pose, skin });
  if (fr && fr.flash > 0 && flashOn) {
    const hy = z > 1.5 ? groundY - r * FIGURE_HEIGHT_R - lift : ballY;
    drawContactFlash(ctx, z > 1.5 ? cx : ballX, hy, r * 0.82 * fr.flashSize, fr.flash, fr.dust);
  }
}

/** A plain ball, only as a marker of where the touch happens. */
function drawMarkerBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(3, r * 0.17), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
