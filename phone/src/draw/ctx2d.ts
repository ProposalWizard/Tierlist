/**
 * THE WEBSITE'S CANVAS, ON THE PHONE'S GRAPHICS.
 *
 * The website draws its players, heads, kits and match pictures with the
 * browser's 2D canvas (CanvasRenderingContext2D), in lib/star. The phone has
 * no browser; it draws with Skia. `Ctx2D` is a canvas that records into a
 * Skia canvas, so the SAME lib/star drawer, with the SAME arguments, draws the
 * same picture on the phone. Nothing in lib/ is copied or changed.
 *
 * Made with `createCtx2D(Skia, skCanvas, { width, height, fontFor })`, usually
 * through <Drawn/> (useDrawing.tsx), which records into a Skia Picture.
 *
 * WHAT IT DOES (audited from lib/star's figure, head, hero, ball, goal drawers):
 *   save/restore · translate/rotate/scale/transform/setTransform/resetTransform/getTransform
 *   beginPath/moveTo/lineTo/quadraticCurveTo/bezierCurveTo/arc/arcTo/ellipse/rect/roundRect/closePath
 *   fill(rule)/stroke/clip(rule) · fillRect/strokeRect/clearRect
 *   fillStyle/strokeStyle: CSS colours, linear/radial/conic gradients, image patterns
 *   lineWidth/lineCap/lineJoin/miterLimit/setLineDash/getLineDash/lineDashOffset
 *   globalAlpha · globalCompositeOperation (every mode, unbounded ones like a browser)
 *   shadowColor/shadowBlur/shadowOffsetX/Y · filter: blur(Npx) only
 *   font/fillText/strokeText/measureText/textAlign/textBaseline (fonts from `fontFor`)
 *   drawImage (3, 5 and 9 arguments) from a Skia image, an offscreen canvas
 *   (offscreen.ts) or a face picture holder · imageSmoothingEnabled
 *   getImageData/putImageData on offscreen canvases (they have pixels; a
 *   recorded Picture does not)
 * NOT YET: Path2D arguments, isPointInPath/isPointInStroke, filters other than
 *   blur(), letterSpacing/wordSpacing/direction "rtl", putImageData's "ignore
 *   the clip" rule, shadows exactly in device space under rotation.
 *
 * SPEED (a phone pays for every call from JS into Skia): the transform is
 * put on the Skia canvas once and kept until it changes (not saved, set and
 * restored around every shape); a plain colour's paint is made once and
 * reused; a path goes to Skia in one call (MakeFromCmds); a path that is just
 * one full circle, oval or rectangle is drawn as that (drawCircle / drawOval /
 * drawRect). Measured by tools/goal-video-bench.ts, same pixels.
 *
 * No Skia import at run time (types only): tools/draw-check.ts runs this file
 * in node against CanvasKit, which is the same Skia.
 */
import type { Skia as SkiaValue, SkCanvas, SkFont, SkImage, SkPaint, SkShader, SkPath, SkColor } from "@shopify/react-native-skia";
type SkiaApi = typeof SkiaValue;
import { parseColor, parseFont, parseFilter, type RGBA, type FontSpec } from "./css";
import { PathRecorder, IDENTITY, mul, invert, apply, scaleOf, toSkia, transformCmds, arcSweep, type Mat, type DOMPointLike } from "./path";

// Skia's enum numbers (its enums are not importable without React Native).
const BM = { Clear: 0, Src: 1, SrcOver: 3, DstOver: 4, SrcIn: 5, DstIn: 6, SrcOut: 7, DstOut: 8, SrcATop: 9, DstATop: 10, Xor: 11, Plus: 12, Screen: 14, Overlay: 15, Darken: 16, Lighten: 17, ColorDodge: 18, ColorBurn: 19, HardLight: 20, SoftLight: 21, Difference: 22, Exclusion: 23, Multiply: 24, Hue: 25, Saturation: 26, Color: 27, Luminosity: 28 } as const;
const BLEND: Record<string, number> = {
  "source-over": BM.SrcOver, "source-in": BM.SrcIn, "source-out": BM.SrcOut, "source-atop": BM.SrcATop,
  "destination-over": BM.DstOver, "destination-in": BM.DstIn, "destination-out": BM.DstOut, "destination-atop": BM.DstATop,
  lighter: BM.Plus, copy: BM.Src, xor: BM.Xor, multiply: BM.Multiply, screen: BM.Screen, overlay: BM.Overlay,
  darken: BM.Darken, lighten: BM.Lighten, "color-dodge": BM.ColorDodge, "color-burn": BM.ColorBurn,
  "hard-light": BM.HardLight, "soft-light": BM.SoftLight, difference: BM.Difference, exclusion: BM.Exclusion,
  hue: BM.Hue, saturation: BM.Saturation, color: BM.Color, luminosity: BM.Luminosity,
};
const CAP: Record<string, number> = { butt: 0, round: 1, square: 2 };
const JOIN: Record<string, number> = { miter: 0, round: 1, bevel: 2 };
const TILE = { Clamp: 0, Repeat: 1, Decal: 3 };
const FILTER_LINEAR = 1, FILTER_NEAREST = 0, MIP_NONE = 0;
const CLIP_INTERSECT = 1, FILL_EVENODD = 1, PAINT_STROKE = 1;
const RGBA_8888 = 4, UNPREMUL = 3;

/** Finds a Skia font for a canvas font. The app passes one built on matchFont. */
export type FontFor = (spec: FontSpec) => SkFont | null;

/** Something drawImage can draw: a Skia image, or anything that can hand one over. */
export interface SkiaImageSource { __skiaImage(): SkImage | null }

// ── Gradients and patterns ──────────────────────────────────────────────────

export class Gradient {
  stops: { o: number; c: RGBA }[] = [];
  constructor(public kind: "linear" | "radial" | "conic", public g: number[]) {}
  addColorStop(offset: number, color: string) {
    if (!(offset >= 0 && offset <= 1)) throw new RangeError("IndexSizeError: offset out of range");
    const c = parseColor(String(color));
    if (!c) throw new SyntaxError(`SyntaxError: "${color}" is not a colour`);
    let i = this.stops.length;
    while (i > 0 && this.stops[i - 1].o > offset) i--;
    this.stops.splice(i, 0, { o: offset, c });
  }
}
export class Pattern {
  m: Mat = IDENTITY;
  constructor(public image: SkImage, public rx: boolean, public ry: boolean) {}
  setTransform(t?: { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number }) {
    this.m = t ? [t.a ?? 1, t.b ?? 0, t.c ?? 0, t.d ?? 1, t.e ?? 0, t.f ?? 0] : IDENTITY;
  }
}
type Style = { css: string | Gradient | Pattern; rgba: RGBA | null; fill1?: SkPaint; fill1Of?: unknown };
/** One Style per colour word, shared (a crowd sets the same few colours thousands of times). */
const styleCache = new Map<string, Style | null>();
function styleOfString(v: string): Style | null {
  let st = styleCache.get(v);
  if (st !== undefined) return st;
  const rgba = parseColor(v);
  st = rgba ? { css: v, rgba } : null;
  if (styleCache.size > 4000) styleCache.clear();
  styleCache.set(v, st);
  return st;
}
/** Paints for plain colours, made once per look and reused (Skia copies a paint when it records). */
let paintCache = new Map<string, { p: SkPaint; w: number }>();
let paintCacheOwner: unknown = null;

/** The bits of a DOMMatrix that drawers read back from getTransform(). */
export class Matrix2D {
  constructor(public a: number, public b: number, public c: number, public d: number, public e: number, public f: number) {}
  get m11() { return this.a; } get m12() { return this.b; } get m21() { return this.c; }
  get m22() { return this.d; } get m41() { return this.e; } get m42() { return this.f; }
  get is2D() { return true; }
  get isIdentity() { return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0; }
  inverse() { const i = invert([this.a, this.b, this.c, this.d, this.e, this.f]) ?? [NaN, NaN, NaN, NaN, NaN, NaN]; return new Matrix2D(...i); }
  transformPoint(p: { x?: number; y?: number } = {}) { const [x, y] = apply([this.a, this.b, this.c, this.d, this.e, this.f], p.x ?? 0, p.y ?? 0); return { x, y, z: 0, w: 1 }; }
}

interface State {
  m: Mat;
  fill: Style; stroke: Style;
  lineWidth: number; lineCap: string; lineJoin: string; miterLimit: number;
  dash: number[]; dashOffset: number;
  alpha: number; op: string;
  shadowColor: string; shadowRGBA: RGBA; shadowBlur: number; shadowOffsetX: number; shadowOffsetY: number;
  font: string; textAlign: string; textBaseline: string; filter: string; blur: number;
  smoothing: boolean; smoothingQuality: string;
}
const BLACK: Style = { css: "#000000", rgba: [0, 0, 0, 1] };
function freshState(): State {
  return {
    m: IDENTITY, fill: BLACK, stroke: BLACK,
    lineWidth: 1, lineCap: "butt", lineJoin: "miter", miterLimit: 10, dash: [], dashOffset: 0,
    alpha: 1, op: "source-over",
    shadowColor: "rgba(0, 0, 0, 0)", shadowRGBA: [0, 0, 0, 0], shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    font: "10px sans-serif", textAlign: "start", textBaseline: "alphabetic", filter: "none", blur: 0,
    smoothing: true, smoothingQuality: "low",
  };
}

export interface Ctx2DOptions {
  width: number;
  height: number;
  fontFor?: FontFor;
  /** Set for an offscreen canvas: lets getImageData/putImageData read and write pixels. */
  pixels?: boolean;
  /**
   * The device's own scale under the drawing, like a phone screen under a
   * page: the drawer works in points (setTransform(1,0,0,1,0,0) is "points")
   * while the picture is made in device pixels. Omitted: none, as a browser canvas.
   */
  base?: Mat;
  /** The object handed back as ctx.canvas (an offscreen canvas passes itself). */
  canvasObject?: { width: number; height: number };
}

/** Warn once per missing feature, so a drawer that uses one is noticed in the logs. */
const warned = new Set<string>();
function warnOnce(what: string) {
  if (warned.has(what)) return;
  warned.add(what);
  // eslint-disable-next-line no-console
  console.warn(`[draw/ctx2d] not supported yet: ${what}`);
}

export class Ctx2D {
  private s: State = freshState();
  private stack: State[] = [];
  private path = new PathRecorder();
  private fonts = new Map<string, SkFont | null>();
  /** Bumped by every drawing; offscreen canvases use it to know their picture changed. */
  version = 0;
  readonly canvas: { width: number; height: number };
  private base: Mat | null;
  /** The full transform (base x the drawing's own), worked out when the drawing's own changes. */
  private mFor: Mat | null = null;
  private mFull: Mat = IDENTITY;
  /** The transform now set on the Skia canvas (inside one save of ours), or null for none. */
  private applied: Mat | null = null;
  /** The current path when it is only one full circle, oval or rectangle, in the drawing's space under `m`. */
  private prim: { k: "circle"; x: number; y: number; r: number; m: Mat } | { k: "oval"; x: number; y: number; rx: number; ry: number; m: Mat } | { k: "rect"; x: number; y: number; w: number; h: number; m: Mat } | null = null;
  private clearPaint: SkPaint | null = null;

  constructor(private Skia: SkiaApi, private c: SkCanvas, private o: Ctx2DOptions) {
    this.canvas = o.canvasObject ?? { width: o.width, height: o.height };
    this.base = o.base ?? null;
  }

  // ── State ──
  save() { this.dropM(); this.stack.push({ ...this.s, dash: [...this.s.dash] }); this.c.save(); }
  restore() { const p = this.stack.pop(); if (!p) return; this.dropM(); this.s = p; this.c.restore(); }
  /** Back to a fresh canvas state (the clip too); keeps the pixels. */
  reset() { while (this.stack.length) this.restore(); this.dropM(); this.s = freshState(); this.path.reset(); this.prim = null; this.pending = null; }
  /** Put the transform on the Skia canvas (once, until it changes). */
  private ensureM() {
    const M = this.M;
    if (this.applied === M) return;
    if (this.applied) this.c.restore();
    this.c.save();
    this.c.concat(this.Skia.Matrix(toSkia(M)));
    this.applied = M;
  }
  /** Take our transform off the Skia canvas (before the drawer's save, restore, clip, or a pixel write). */
  private dropM() {
    if (!this.applied) return;
    this.c.restore();
    this.applied = null;
  }
  getContextAttributes() { return { alpha: true, colorSpace: "srgb", desynchronized: false, willReadFrequently: !!this.o.pixels }; }
  isContextLost() { return false; }

  // ── Transforms ──
  translate(x: number, y: number) { if (fin(x, y)) this.s.m = mul(this.s.m, [1, 0, 0, 1, x, y]); }
  scale(x: number, y: number) { if (fin(x, y)) this.s.m = mul(this.s.m, [x, 0, 0, y, 0, 0]); }
  rotate(a: number) { if (fin(a)) { const c = Math.cos(a), s = Math.sin(a); this.s.m = mul(this.s.m, [c, s, -s, c, 0, 0]); } }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) { if (fin(a, b, c, d, e, f)) this.s.m = mul(this.s.m, [a, b, c, d, e, f]); }
  setTransform(a?: number | { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number; m11?: number; m12?: number; m21?: number; m22?: number; m41?: number; m42?: number }, b?: number, c?: number, d?: number, e?: number, f?: number) {
    if (a === undefined) { this.s.m = IDENTITY; return; }
    if (typeof a === "object") {
      const t = a;
      const full: Mat = [t.a ?? t.m11 ?? 1, t.b ?? t.m12 ?? 0, t.c ?? t.m21 ?? 0, t.d ?? t.m22 ?? 1, t.e ?? t.m41 ?? 0, t.f ?? t.m42 ?? 0];
      const inv = this.base ? invert(this.base) : null;
      this.s.m = inv ? mul(inv, full) : full;
      return;
    }
    if (fin(a, b!, c!, d!, e!, f!)) this.s.m = [a, b!, c!, d!, e!, f!];
  }
  resetTransform() { this.s.m = IDENTITY; }
  /** The whole transform: the device's (`base`) and then the drawing's own. */
  private get M(): Mat {
    if (this.mFor !== this.s.m) { this.mFor = this.s.m; this.mFull = this.base ? mul(this.base, this.s.m) : this.s.m; }
    return this.mFull;
  }
  /** What the canvas would answer: with a `base`, the full transform to device pixels (so a
   *  drawer that sizes a hidden picture by it makes it sharp), and setTransform(thatObject) puts it back. */
  getTransform() { const m = this.M; return new Matrix2D(m[0], m[1], m[2], m[3], m[4], m[5]); }

  // ── Styles ──
  get fillStyle(): string | Gradient | Pattern { return this.s.fill.css; }
  set fillStyle(v: string | Gradient | Pattern) { const st = this.style(v); if (st) this.s.fill = st; }
  get strokeStyle(): string | Gradient | Pattern { return this.s.stroke.css; }
  set strokeStyle(v: string | Gradient | Pattern) { const st = this.style(v); if (st) this.s.stroke = st; }
  private style(v: unknown): Style | null {
    if (typeof v === "string") return styleOfString(v);
    if (v instanceof Gradient || v instanceof Pattern) return { css: v, rgba: null };
    return null;
  }
  get lineWidth() { return this.s.lineWidth; }
  set lineWidth(v: number) { if (v > 0 && Number.isFinite(v)) this.s.lineWidth = v; }
  get lineCap() { return this.s.lineCap; }
  set lineCap(v: string) { if (v in CAP) this.s.lineCap = v; }
  get lineJoin() { return this.s.lineJoin; }
  set lineJoin(v: string) { if (v in JOIN) this.s.lineJoin = v; }
  get miterLimit() { return this.s.miterLimit; }
  set miterLimit(v: number) { if (v > 0 && Number.isFinite(v)) this.s.miterLimit = v; }
  setLineDash(seg: number[]) {
    if (!seg.every((n) => Number.isFinite(n) && n >= 0)) return;
    this.s.dash = seg.length % 2 ? [...seg, ...seg] : [...seg];
  }
  getLineDash() { return [...this.s.dash]; }
  get lineDashOffset() { return this.s.dashOffset; }
  set lineDashOffset(v: number) { if (Number.isFinite(v)) this.s.dashOffset = v; }
  get globalAlpha() { return this.s.alpha; }
  set globalAlpha(v: number) { if (v >= 0 && v <= 1) this.s.alpha = v; }
  get globalCompositeOperation() { return this.s.op; }
  set globalCompositeOperation(v: string) { if (v in BLEND) this.s.op = v; }
  get shadowColor() { return this.s.shadowColor; }
  set shadowColor(v: string) { const c = parseColor(v); if (c) { this.s.shadowColor = v; this.s.shadowRGBA = c; } }
  get shadowBlur() { return this.s.shadowBlur; }
  set shadowBlur(v: number) { if (v >= 0 && Number.isFinite(v)) this.s.shadowBlur = v; }
  get shadowOffsetX() { return this.s.shadowOffsetX; }
  set shadowOffsetX(v: number) { if (Number.isFinite(v)) this.s.shadowOffsetX = v; }
  get shadowOffsetY() { return this.s.shadowOffsetY; }
  set shadowOffsetY(v: number) { if (Number.isFinite(v)) this.s.shadowOffsetY = v; }
  get filter() { return this.s.filter; }
  set filter(v: string) {
    this.s.filter = v;
    const f = v && v !== "none" ? parseFilter(v) : null;
    this.s.blur = f && f.blur > 0 ? f.blur : 0;
    if (v && v !== "none" && !f) warnOnce(`filter "${v}"`);
  }
  get font() { return this.s.font; }
  set font(v: string) { if (parseFont(v)) this.s.font = v; }
  get textAlign() { return this.s.textAlign; }
  set textAlign(v: string) { if (["start", "end", "left", "right", "center"].includes(v)) this.s.textAlign = v; }
  get textBaseline() { return this.s.textBaseline; }
  set textBaseline(v: string) { if (["top", "hanging", "middle", "alphabetic", "ideographic", "bottom"].includes(v)) this.s.textBaseline = v; }
  get imageSmoothingEnabled() { return this.s.smoothing; }
  set imageSmoothingEnabled(v: boolean) { this.s.smoothing = !!v; }
  get imageSmoothingQuality() { return this.s.smoothingQuality; }
  set imageSmoothingQuality(v: string) { if (["low", "medium", "high"].includes(v)) this.s.smoothingQuality = v; }
  // Accepted and ignored (the browser's defaults are what the game uses).
  direction = "ltr"; letterSpacing = "0px"; wordSpacing = "0px"; fontKerning = "auto";

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) { return new Gradient("linear", [x0, y0, x1, y1]); }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    if (r0 < 0 || r1 < 0) throw new RangeError("IndexSizeError: negative radius");
    return new Gradient("radial", [x0, y0, r0, x1, y1, r1]);
  }
  createConicGradient(start: number, x: number, y: number) { return new Gradient("conic", [start, x, y]); }
  createPattern(src: unknown, repetition: string | null): Pattern | null {
    const img = this.imageOf(src);
    if (!img) return null;
    const r = repetition || "repeat";
    return new Pattern(img, r === "repeat" || r === "repeat-x", r === "repeat" || r === "repeat-y");
  }

  // ── The path ──
  beginPath() { this.path.reset(); this.prim = null; this.pending = null; }
  /** A lone full circle is kept as its numbers (`pending`) and only turned into curves if the path goes on. */
  private pending: { x: number; y: number; r: number; a0: number; a1: number; ccw: boolean; M: Mat } | null = null;
  private mat() {
    const q = this.pending;
    if (!q) return;
    this.pending = null;
    this.path.arc(q.M, q.x, q.y, q.r, q.a0, q.a1, q.ccw);
  }
  moveTo(x: number, y: number) { this.mat(); this.prim = null; this.path.moveTo(this.M, x, y); }
  lineTo(x: number, y: number) { this.mat(); this.prim = null; this.path.lineTo(this.M, x, y); }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) { this.mat(); this.prim = null; this.path.quadraticCurveTo(this.M, cx, cy, x, y); }
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number) { this.mat(); this.prim = null; this.path.bezierCurveTo(this.M, a, b, c, d, x, y); }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean) {
    const first = this.path.cmds.length === 0 && !this.pending;
    if (first && r > 0 && fin(x, y, r, a0, a1) && Math.abs(arcSweep(a0, a1, !!ccw)) === Math.PI * 2) {
      this.prim = { k: "circle", x, y, r, m: this.s.m };
      this.pending = { x, y, r, a0, a1, ccw: !!ccw, M: this.M };
      return;
    }
    this.mat();
    this.prim = null;
    this.path.arc(this.M, x, y, r, a0, a1, !!ccw);
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) { this.mat(); this.prim = null; this.path.arcTo(this.M, x1, y1, x2, y2, r); }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean) {
    this.mat();
    const first = this.path.cmds.length === 0;
    this.prim = null;
    this.path.ellipse(this.M, x, y, rx, ry, rot, a0, a1, !!ccw);
    if (first && rot === 0 && rx > 0 && ry > 0 && fin(x, y, rx, ry, a0, a1) && Math.abs(arcSweep(a0, a1, !!ccw)) === Math.PI * 2) this.prim = { k: "oval", x, y, rx, ry, m: this.s.m };
  }
  rect(x: number, y: number, w: number, h: number) {
    this.mat();
    const first = this.path.cmds.length === 0;
    this.prim = null;
    this.path.rect(this.M, x, y, w, h);
    if (first && w > 0 && h > 0 && fin(x, y, w, h)) this.prim = { k: "rect", x, y, w, h, m: this.s.m };
  }
  roundRect(x: number, y: number, w: number, h: number, r?: number | DOMPointLike | (number | DOMPointLike)[]) { this.mat(); this.prim = null; this.path.roundRect(this.M, x, y, w, h, r ?? 0); }
  /** Closing one full circle or rectangle leaves the same shape, so it keeps `prim`. */
  closePath() { this.mat(); this.path.closePath(); }

  /** Draw the current path as one shape when it is one full circle, oval or rectangle under this same transform. */
  private drawPrim(paint: SkPaint): boolean {
    const pr = this.prim;
    if (!pr || pr.m !== this.s.m) return false;
    // Skia's own circle and oval (a browser's arc is Skia's too): closer to the website than our curves.
    if (pr.k === "circle") this.draw(paint, (c, p) => c.drawCircle(pr.x, pr.y, pr.r, p));
    else if (pr.k === "oval") this.draw(paint, (c, p) => c.drawOval({ x: pr.x - pr.rx, y: pr.y - pr.ry, width: pr.rx * 2, height: pr.ry * 2 } as never, p));
    else this.draw(paint, (c, p) => c.drawRect({ x: pr.x, y: pr.y, width: pr.w, height: pr.h } as never, p));
    return true;
  }

  fill(a?: unknown, b?: unknown) {
    if (a !== undefined && typeof a !== "string") { warnOnce("fill(Path2D)"); return; }
    if (!this.path.cmds.length && !this.pending) return;
    const paint = this.paint(this.s.fill, false);
    if (!paint) return;
    if (this.drawPrim(paint)) return;
    this.mat();
    const path = this.userPath(typeof a === "string" ? a : (b as string | undefined));
    if (path) this.draw(paint, (c, p) => c.drawPath(path, p));
  }
  stroke(a?: unknown) {
    if (a !== undefined) { warnOnce("stroke(Path2D)"); return; }
    if (!this.path.cmds.length && !this.pending) return;
    const paint = this.paint(this.s.stroke, true);
    if (!paint) return;
    // A dash starts where the path starts, so a dashed circle keeps its own path.
    if (!this.s.dash.length && this.drawPrim(paint)) return;
    this.mat();
    const path = this.userPath();
    if (path) this.draw(paint, (c, p) => c.drawPath(path, p));
  }
  clip(a?: unknown, b?: unknown) {
    if (a !== undefined && typeof a !== "string") { warnOnce("clip(Path2D)"); return; }
    const rule = typeof a === "string" ? a : (b as string | undefined);
    // Clipped in picture pixels: the points are already turned.
    this.mat();
    this.dropM();
    this.c.clipPath(this.skPath(this.path.cmds, null, rule === "evenodd"), CLIP_INTERSECT, true);
  }
  isPointInPath() { warnOnce("isPointInPath"); return false; }
  isPointInStroke() { warnOnce("isPointInStroke"); return false; }

  fillRect(x: number, y: number, w: number, h: number) {
    if (!fin(x, y, w, h) || !w || !h) return;
    const paint = this.paint(this.s.fill, false);
    // A plain {x, y, width, height}: Skia reads it without making a rectangle object first.
    if (paint) this.draw(paint, (c, p) => c.drawRect({ x, y, width: w, height: h } as never, p));
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    if (!fin(x, y, w, h)) return;
    const paint = this.paint(this.s.stroke, true);
    if (!paint) return;
    const path = this.Skia.Path.MakeFromCmds([[0, x, y], [1, x + w, y], [1, x + w, y + h], [1, x, y + h], [5]]);
    if (path) this.draw(paint, (c, p) => c.drawPath(path, p));
  }
  clearRect(x: number, y: number, w: number, h: number) {
    if (!fin(x, y, w, h) || !w || !h) return;
    let p = this.clearPaint;
    if (!p) { p = this.Skia.Paint(); p.setBlendMode(BM.Clear); this.clearPaint = p; }
    this.ensureM();
    this.c.drawRect({ x, y, width: w, height: h } as never, p);
    this.version++;
  }

  // ── Text ──
  private fontNow(): SkFont | null {
    const key = this.s.font;
    if (this.fonts.has(key)) return this.fonts.get(key)!;
    const spec = parseFont(key);
    let f: SkFont | null = null;
    if (spec && this.o.fontFor) f = this.o.fontFor(spec);
    if (!f) warnOnce(`font "${key}" (no font finder)`);
    this.fonts.set(key, f);
    return f;
  }
  private advance(font: SkFont, text: string): number {
    if (!text) return 0;
    const ids = font.getGlyphIDs(text);
    return font.getGlyphWidths(ids).reduce((a, b) => a + b, 0);
  }
  measureText(text: string) {
    const font = this.fontNow();
    const t = String(text).replace(/[\t\n\f\r]/g, " ");
    const width = font ? this.advance(font, t) : 0;
    const met = font?.getMetrics();
    const box = font && t ? font.measureText(t) : null;
    return {
      width,
      actualBoundingBoxLeft: box ? -box.x : 0,
      actualBoundingBoxRight: box ? box.x + box.width : width,
      actualBoundingBoxAscent: box ? -box.y : 0,
      actualBoundingBoxDescent: box ? box.y + box.height : 0,
      fontBoundingBoxAscent: met ? -met.ascent : 0,
      fontBoundingBoxDescent: met ? met.descent : 0,
      emHeightAscent: met ? -met.ascent : 0,
      emHeightDescent: met ? met.descent : 0,
      hangingBaseline: met ? -met.ascent * 0.8 : 0,
      alphabeticBaseline: 0,
      ideographicBaseline: met ? -met.descent : 0,
    };
  }
  fillText(text: string, x: number, y: number, maxWidth?: number) { this.text(text, x, y, maxWidth, false); }
  strokeText(text: string, x: number, y: number, maxWidth?: number) { this.text(text, x, y, maxWidth, true); }
  private text(text: string, x: number, y: number, maxWidth: number | undefined, stroke: boolean) {
    if (!fin(x, y) || (maxWidth !== undefined && !(maxWidth > 0))) return;
    const font = this.fontNow();
    if (!font) return;
    const t = String(text).replace(/[\t\n\f\r]/g, " ");
    const w = this.advance(font, t);
    const squeeze = maxWidth !== undefined && w > maxWidth ? maxWidth / w : 1;
    const al = this.s.textAlign;
    const dx = al === "center" ? -w / 2 : al === "right" || al === "end" ? -w : 0;
    const met = font.getMetrics();
    const asc = -met.ascent, desc = met.descent;
    const bl = this.s.textBaseline;
    const dy = bl === "top" ? asc : bl === "hanging" ? asc * 0.8 : bl === "middle" ? (asc - desc) / 2 : bl === "bottom" || bl === "ideographic" ? -desc : 0;
    const paint = this.paint(stroke ? this.s.stroke : this.s.fill, stroke);
    if (!paint) return;
    this.draw(paint, (c, p) => {
      if (squeeze !== 1) { c.save(); c.translate(x, 0); c.scale(squeeze, 1); c.translate(-x, 0); }
      c.drawText(t, x + dx, y + dy, p, font);
      if (squeeze !== 1) c.restore();
    });
  }

  // ── Images ──
  /** A Skia image from whatever drawImage was handed, or null. */
  private imageOf(src: unknown): SkImage | null {
    if (!src || typeof src !== "object") return null;
    const s = src as Partial<SkiaImageSource> & { skImage?: SkImage | null; width?: unknown; makeShaderOptions?: unknown };
    if (typeof s.__skiaImage === "function") return s.__skiaImage();
    if (s.skImage) return s.skImage;
    if (typeof s.width === "function" && typeof s.makeShaderOptions === "function") return src as SkImage;
    return null;
  }
  drawImage(src: unknown, ...a: number[]) {
    const img = this.imageOf(src);
    if (!img) { if (src) warnOnce("drawImage from a source with no Skia picture (an <img> or browser canvas)"); return; }
    const iw = img.width(), ih = img.height();
    if (!iw || !ih) return;
    let sx = 0, sy = 0, sw = iw, sh = ih, dx: number, dy: number, dw: number, dh: number;
    if (a.length >= 8) [sx, sy, sw, sh, dx, dy, dw, dh] = a;
    else if (a.length >= 4) [dx, dy, dw, dh] = a;
    else { [dx, dy] = a; dw = iw; dh = ih; }
    if (!fin(sx, sy, sw, sh, dx, dy, dw, dh) || !sw || !sh || !dw || !dh) return;
    // Negative sizes flip to positive; a source rectangle past the picture is
    // trimmed and the destination trimmed with it (as a browser does).
    if (sw < 0) { sx += sw; sw = -sw; } if (sh < 0) { sy += sh; sh = -sh; }
    if (dw < 0) { dx += dw; dw = -dw; } if (dh < 0) { dy += dh; dh = -dh; }
    const kx = dw / sw, ky = dh / sh;
    if (sx < 0) { dx -= sx * kx; dw += sx * kx; sw += sx; sx = 0; }
    if (sy < 0) { dy -= sy * ky; dh += sy * ky; sh += sy; sy = 0; }
    if (sx + sw > iw) { const cut = sx + sw - iw; sw -= cut; dw -= cut * kx; }
    if (sy + sh > ih) { const cut = sy + sh - ih; sh -= cut; dh -= cut * ky; }
    if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
    const paint = this.basePaint();
    paint.setAlphaf(this.s.alpha);
    const fm = this.s.smoothing ? FILTER_LINEAR : FILTER_NEAREST;
    const S = this.Skia;
    this.draw(paint, (c, p) => c.drawImageRectOptions(img, S.XYWHRect(sx, sy, sw, sh), S.XYWHRect(dx, dy, dw, dh), fm, MIP_NONE, p));
  }

  // ── Pixels (offscreen canvases only) ──
  createImageData(w: number | { width: number; height: number }, h?: number) {
    const W = typeof w === "number" ? Math.abs(Math.round(w)) : w.width, H = typeof w === "number" ? Math.abs(Math.round(h ?? 0)) : w.height;
    return { width: W, height: H, data: new Uint8ClampedArray(W * H * 4), colorSpace: "srgb" as const };
  }
  getImageData(sx: number, sy: number, sw: number, sh: number) {
    if (!this.o.pixels) throw new Error("getImageData: this canvas is a recorded picture and has no pixels (use an offscreen canvas)");
    const W = Math.max(1, Math.round(Math.abs(sw))), H = Math.max(1, Math.round(Math.abs(sh)));
    const px = this.c.readPixels(Math.round(sx), Math.round(sy), { width: W, height: H, colorType: RGBA_8888, alphaType: UNPREMUL });
    const data = new Uint8ClampedArray(W * H * 4);
    if (px) data.set(px as Uint8Array);
    return { width: W, height: H, data, colorSpace: "srgb" as const };
  }
  putImageData(img: { width: number; height: number; data: Uint8ClampedArray }, dx: number, dy: number) {
    if (!this.o.pixels) throw new Error("putImageData: this canvas is a recorded picture and has no pixels");
    const S = this.Skia;
    const bytes = new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength);
    const sk = S.Image.MakeImage({ width: img.width, height: img.height, colorType: RGBA_8888, alphaType: UNPREMUL }, S.Data.fromBytes(bytes), img.width * 4);
    if (!sk) return;
    this.dropM();
    const p = S.Paint();
    p.setBlendMode(BM.Src);
    this.c.drawImage(sk, Math.round(dx), Math.round(dy), p);
    this.version++;
  }

  // ── Inside ──
  /** The current path, turned back into the drawing's space (for fill/stroke). */
  private userPath(rule?: string): SkPath | null {
    if (!this.path.cmds.length) return null;
    const inv = invert(this.M);
    if (!inv) return null;
    return this.skPath(this.path.cmds, inv, rule === "evenodd");
  }
  /** A Skia path from the recorded commands, each point put through `m` (null: as they are), in one call. */
  private skPath(cmds: PathRecorder["cmds"], m: Mat | null, evenodd: boolean): SkPath {
    if (evenodd) {
      // MakeFromCmds has no fill rule: the builder way.
      const bl = this.Skia.PathBuilder.Make();
      for (const k of m ? transformCmds(cmds, m) : cmds) {
        switch (k.k) {
          case "M": bl.moveTo(k.p[0], k.p[1]); break;
          case "L": bl.lineTo(k.p[0], k.p[1]); break;
          case "Q": bl.quadTo(k.p[0], k.p[1], k.p[2], k.p[3]); break;
          case "C": bl.cubicTo(k.p[0], k.p[1], k.p[2], k.p[3], k.p[4], k.p[5]); break;
          case "Z": bl.close(); break;
        }
      }
      bl.setFillType(FILL_EVENODD);
      return bl.build();
    }
    const a = m ? m[0] : 1, b = m ? m[1] : 0, c = m ? m[2] : 0, d = m ? m[3] : 1, e = m ? m[4] : 0, f = m ? m[5] : 0;
    const out: number[][] = new Array(cmds.length);
    for (let i = 0; i < cmds.length; i++) {
      const k = cmds[i];
      if (k.k === "Z") { out[i] = [5]; continue; }
      const p = k.p;
      const row: number[] = [k.k === "M" ? 0 : k.k === "L" ? 1 : k.k === "Q" ? 2 : 4];
      for (let j = 0; j < p.length; j += 2) row.push(a * p[j] + c * p[j + 1] + e, b * p[j] + d * p[j + 1] + f);
      out[i] = row;
    }
    return this.Skia.Path.MakeFromCmds(out) ?? this.Skia.Path.Make();
  }
  private color(c: RGBA, alpha = 1): SkColor { return Float32Array.of(c[0], c[1], c[2], c[3] * alpha) as unknown as SkColor; }

  /** Antialiasing plus the shadow and the blur filter, in force now. */
  private basePaint(): SkPaint {
    const S = this.Skia;
    const p = S.Paint();
    p.setAntiAlias(true);
    if (!this.s.blur && !this.hasShadow()) return p;
    const k = scaleOf(this.M) || 1;
    const blur = this.s.blur;
    let f = blur > 0 ? S.ImageFilter.MakeBlur(blur / k, blur / k, TILE.Decal, null) : null;
    const sc = this.s.shadowRGBA;
    if (sc[3] > 0 && (this.s.shadowBlur > 0 || this.s.shadowOffsetX || this.s.shadowOffsetY)) {
      // Shadow offsets are in picture pixels, not turned by the transform.
      const inv = invert([this.M[0], this.M[1], this.M[2], this.M[3], 0, 0]);
      const [ox, oy] = inv ? apply(inv, this.s.shadowOffsetX, this.s.shadowOffsetY) : [0, 0];
      const sig = this.s.shadowBlur / 2 / k;
      f = S.ImageFilter.MakeDropShadow(ox, oy, sig, sig, this.color(sc, this.s.alpha), f);
    }
    if (f) p.setImageFilter(f);
    return p;
  }
  private hasShadow(): boolean {
    const s = this.s;
    return s.shadowRGBA[3] > 0 && (s.shadowBlur > 0 || s.shadowOffsetX !== 0 || s.shadowOffsetY !== 0);
  }
  /** The paint for a fill or a stroke, or null when it would draw nothing. */
  private paint(st: Style, stroke: boolean): SkPaint | null {
    const s = this.s;
    // A plain colour with no shadow or blur: one paint per look, made once.
    if (st.rgba && !s.blur && !this.hasShadow()) {
      if (st.rgba[3] * s.alpha === 0 && s.op === "source-over") return null;
      // The commonest case of all (a crowd's shirts): a fill at full strength, kept on the colour itself.
      if (!stroke && s.alpha === 1 && st.fill1Of === this.Skia) return st.fill1!;
      if (paintCacheOwner !== this.Skia) { paintCache = new Map(); paintCacheOwner = this.Skia; }
      // A stroke's width changes shape by shape (net meshes, lines far and near), so it is
      // set on the kept paint when it differs, not part of what picks the paint.
      const key = stroke
        ? `s${st.css as string}|${s.alpha}|${s.lineCap}|${s.lineJoin}|${s.miterLimit}|${s.dash.length ? s.dash.join(",") + "@" + s.dashOffset : ""}`
        : `f${st.css as string}|${s.alpha}`;
      const hit = paintCache.get(key);
      if (hit) {
        if (stroke && hit.w !== s.lineWidth) { hit.p.setStrokeWidth(s.lineWidth); hit.w = s.lineWidth; }
        return hit.p;
      }
      const made = this.paintNow(st, stroke);
      if (made && !stroke && s.alpha === 1) { st.fill1 = made; st.fill1Of = this.Skia; }
      if (made) {
        if (paintCache.size > 2000) paintCache.clear();
        paintCache.set(key, { p: made, w: s.lineWidth });
      }
      return made;
    }
    return this.paintNow(st, stroke);
  }
  private paintNow(st: Style, stroke: boolean): SkPaint | null {
    const p = this.basePaint();
    if (st.rgba) {
      if (st.rgba[3] * this.s.alpha === 0 && this.s.op === "source-over") return null;
      p.setColor(this.color(st.rgba, this.s.alpha));
    } else {
      const sh = this.shaderOf(st.css as Gradient | Pattern);
      if (sh === null) return null; // a gradient that paints nothing (no stops, zero size)
      if (Array.isArray(sh)) p.setColor(this.color(sh as RGBA, this.s.alpha));
      else { p.setShader(sh as SkShader); p.setAlphaf(this.s.alpha); }
    }
    if (stroke) {
      p.setStyle(PAINT_STROKE);
      p.setStrokeWidth(this.s.lineWidth);
      p.setStrokeCap(CAP[this.s.lineCap]);
      p.setStrokeJoin(JOIN[this.s.lineJoin]);
      p.setStrokeMiter(this.s.miterLimit);
      if (this.s.dash.length && this.s.dash.some((d) => d > 0)) p.setPathEffect(this.Skia.PathEffect.MakeDash(this.s.dash, this.s.dashOffset));
    }
    return p;
  }
  /** A Skia shader for a gradient/pattern, a single colour, or null (draws nothing). */
  private shaderOf(g: Gradient | Pattern): SkShader | RGBA | null {
    const S = this.Skia;
    if (g instanceof Pattern) {
      const tx = g.rx ? TILE.Repeat : TILE.Decal, ty = g.ry ? TILE.Repeat : TILE.Decal;
      return g.image.makeShaderOptions(tx, ty, this.s.smoothing ? FILTER_LINEAR : FILTER_NEAREST, MIP_NONE, S.Matrix(toSkia(g.m)));
    }
    const st = g.stops;
    if (!st.length) return null;
    if (st.length === 1) return st[0].c;
    const pos = st.map((s) => s.o), cols = st.map((s) => this.color(s.c));
    // Pad to 0 and 1 so the ends are the first and last colours.
    if (pos[0] > 0) { pos.unshift(0); cols.unshift(cols[0]); }
    if (pos[pos.length - 1] < 1) { pos.push(1); cols.push(cols[cols.length - 1]); }
    const v = g.g;
    if (g.kind === "linear") {
      if (v[0] === v[2] && v[1] === v[3]) return null;
      return S.Shader.MakeLinearGradient({ x: v[0], y: v[1] }, { x: v[2], y: v[3] }, cols, pos, TILE.Clamp);
    }
    if (g.kind === "radial") {
      if (v[0] === v[3] && v[1] === v[4] && v[2] === v[5]) return null;
      return S.Shader.MakeTwoPointConicalGradient({ x: v[0], y: v[1] }, v[2], { x: v[3], y: v[4] }, v[5], cols, pos, TILE.Clamp);
    }
    // conic: Skia's sweep starts at 3 o'clock like the canvas; turn it by the start angle.
    const [a, cx, cy] = v;
    const m = mul(mul([1, 0, 0, 1, cx, cy], [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    return S.Shader.MakeSweepGradient(cx, cy, cols, pos, TILE.Clamp, S.Matrix(toSkia(m)));
  }
  /**
   * Draw with the transform in force. A composite mode other than
   * source-over draws into a layer first, then lays the layer down with that
   * mode — so "source-in", "copy" and friends also clear what lies outside
   * the shape, exactly like a browser canvas.
   */
  private draw(p: SkPaint, fn: (c: SkCanvas, p: SkPaint) => void) {
    const c = this.c;
    this.ensureM();
    const mode = this.s.op === "source-over" ? BM.SrcOver : BLEND[this.s.op] ?? BM.SrcOver;
    if (mode !== BM.SrcOver) {
      const lp = this.Skia.Paint();
      lp.setBlendMode(mode);
      c.saveLayer(lp);
    }
    fn(c, p);
    if (mode !== BM.SrcOver) c.restore();
    this.version++;
  }
}

function fin(...v: number[]) { for (const n of v) if (!Number.isFinite(n)) return false; return true; }

/**
 * A canvas 2D context over a Skia canvas. Typed as the browser's own
 * CanvasRenderingContext2D so it can be handed straight to a lib/star drawer.
 */
export function createCtx2D(Skia: SkiaApi, canvas: SkCanvas, o: Ctx2DOptions): CanvasRenderingContext2D & Ctx2D {
  return new Ctx2D(Skia, canvas, o) as unknown as CanvasRenderingContext2D & Ctx2D;
}
