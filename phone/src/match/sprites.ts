/**
 * THE MATCH'S PLAYERS AS THE WEBSITE DRAWS THEM: its 3D sprite sheets
 * (public/star/sprites/, Players in the match: 3D, the website's default),
 * coloured per kit, drawn per frame as one picture cut.
 *
 * lib/star/sprites.ts does this in the browser (fetch, <img>, getImageData,
 * a per-pixel colour pass into a hidden canvas). The phone has none of that,
 * so this file ports it onto Skia, line for line in what it decides:
 *   - the same index.json (cells, anchors, clips, fps, loops, 8 or 4 facings,
 *     contact points, mirrored clips) and the same six atlases:
 *       0 idle, jog, sprint, kick, celebrate; the keeper's ready, jog, dives
 *       1 the touch / pass / shot / volley / chip / header / block / clearance
 *         kicks; the keeper's one-hand stretch, low dive, parry, catch, fumble,
 *         getting up
 *       2 and 4 the goal celebrations
 *       3 the aerial moves (headers, volleys, bicycle, scorpion), with points
 *       5 the keeper's catches and dives (Leo's "keeperCatch" switch)
 *   - the same kit colouring (tintRows): the same formula, run ONCE per kit
 *     per atlas on the graphics chip as a Skia shader (pre-rendered);
 *   - the same frame pick (spriteFrame, cellDir, mirrorDir) and placement
 *     (drawSprite: boots anchor, the dive's centre blend, mirroring);
 *   - the same loading rule: atlas 0 first, the others when one of their
 *     clips is first asked for (spriteClipReady), never mid-kick: until an
 *     atlas is in and coloured, the old clips play, as on the website.
 * kitWhite (the lit-white reference the colouring divides by) is measured off
 * atlas-0 with the website's own rule (tools/match-frame.ts prints it).
 * Per frame only drawImageRect calls remain.
 *
 * Two ways to draw: onto a Skia canvas (the match, drawSprite), or through
 * the canvas-2D stand-in (draw/ctx2d.ts) for the goal videos' ported
 * renderer (drawSpriteCtx), which is lib/star/sprites.ts drawSprite word for
 * word with the tinted Skia picture as the image.
 */
import type { SkCanvas, SkImage, SkRuntimeEffect, SkPaint } from "@shopify/react-native-skia";
import { sk, FILTER_LINEAR, MIPMAP_NONE } from "./skiaApi";

export type SpriteChar = "player" | "keeper";
export type SpriteClip = string;
export interface SpriteKit { shirt: string; shorts: string; socks: string }
export interface ClipIndex {
  fps: number; loop: "loop" | "pingpong" | "once"; dirs: number; frames: number;
  strikeFrame?: number; contactFrame?: number; landFrame?: number; landM?: [number, number]; ballPx?: number;
  atlas?: number; mirrorOf?: string; t3d?: number[];
  cells?: [number, number, number, number, number, number][];
  pts?: number[][];
}
interface AtlasInfo { color: string; mask: string; w: number; h: number }
export interface SpriteIndex {
  standH: number;
  atlas: AtlasInfo;
  atlases?: Record<string, AtlasInfo>;
  chars: Record<SpriteChar, { clips: Record<string, ClipIndex | undefined> }>;
}

/** lib/star/sprites.ts kitWhite for atlas-0 (a high percentile of the kit pixels' brightness). */
export const KIT_WHITE = 253;

let index: SpriteIndex | null = null;
const atlases = new Map<number, { color: SkImage; mask: SkImage }>();
const loadingAtlas = new Map<number, Promise<boolean>>();
/** Atlas n's two pictures, decoded (the phone: spriteAssets.ts; node: the tools). */
type AtlasLoader = (n: number) => Promise<{ color: SkImage; mask: SkImage } | null>;
let loader: AtlasLoader | null = null;
const tinted = new Map<string, SkImage>();
const seenKits = new Map<string, SpriteKit>();
/** Atlases whose every seen kit is coloured: their clips may be drawn (the website's warmDone). */
const warm = new Set<number>([0]);
let effect: SkRuntimeEffect | null = null;
/** Timing of the last colouring passes (ms), for tools/match-frame.ts. */
export const tintTimes: number[] = [];

/** Hand over the index and atlas 0 (decoded), and how to fetch the rest. */
export function setSpriteSheet(idx: SpriteIndex, colorImg: SkImage, maskImg: SkImage, later?: AtlasLoader) {
  index = idx; atlases.clear(); tinted.clear(); loadingAtlas.clear(); warm.clear(); warm.add(0);
  atlases.set(0, { color: colorImg, mask: maskImg });
  loader = later ?? null;
}
/** Hand over a later atlas directly (node tools load every atlas up front). */
export function setAtlas(n: number, colorImg: SkImage, maskImg: SkImage) {
  atlases.set(n, { color: colorImg, mask: maskImg });
  for (const kit of seenKits.values()) atlasFor(kit, n);
  warm.add(n);
}
export function spritesReady(): boolean { return !!(index && atlases.get(0)); }
let sheetLoader: (() => Promise<boolean>) | null = null;
/** How the sheet is fetched (spriteAssets.ts on the phone). */
export function setSheetLoader(f: () => Promise<boolean>) { sheetLoader = f; }
/** lib/star/sprites.ts loadSprites: resolves true when drawSprite can draw. */
export function loadSprites(): Promise<boolean> {
  if (spritesReady()) return Promise.resolve(true);
  return sheetLoader ? sheetLoader() : Promise.resolve(false);
}
export function spriteIndex(): SpriteIndex | null { return index; }

/** Load atlas n (n ≥ 1) once. Every kit already seen is coloured before its clips switch on. */
function loadAtlas(n: number): Promise<boolean> {
  const have = loadingAtlas.get(n);
  if (have) return have;
  const p = (async () => {
    if (!loader) return false;
    try {
      const got = await loader(n);
      if (!got) { loadingAtlas.delete(n); return false; }
      setAtlas(n, got.color, got.mask);
      return true;
    } catch { loadingAtlas.delete(n); return false; }
  })();
  loadingAtlas.set(n, p);
  return p;
}
/**
 * Start fetching later atlases now (the website's preloadLaterAtlases: 1, 2, 4 at idle; 3 and 5 wait for an ask,
 * to save a download). `all` (the phone: every sheet is in the app, nothing to download) takes 3 and 5 as well,
 * one after another, so the first header, volley or keeper's catch never stops the match to colour a sheet:
 * that pause came in the middle of a chance, and the men jumped on when it ended.
 */
export function preloadLaterAtlases(all = false) {
  if (!index) return;
  const kAtlas = index.chars.keeper?.clips.kCatchDiveR?.atlas;
  const want = Object.keys(index.atlases ?? {}).map(Number).filter((n) => n >= 1 && (all || (n !== 3 && n !== kAtlas)));
  if (!all) { for (const n of want) void loadAtlas(n); return; }
  void (async () => { for (const n of want) await loadAtlas(n); })();
}

/** A clip's own entry and where its cells come from (itself, or the clip it mirrors). */
function resolveClip(char: SpriteChar, clip: SpriteClip): { c: ClipIndex; src: ClipIndex; mirror: boolean } | null {
  const c = index?.chars[char]?.clips[clip];
  if (!c) return null;
  if (!c.mirrorOf) return c.cells ? { c, src: c, mirror: false } : null;
  const src = index?.chars[char]?.clips[c.mirrorOf];
  return src && src.cells ? { c, src, mirror: true } : null;
}

/** True once this clip can be drawn. The first ask for a later atlas's clip starts loading it. */
export function spriteClipReady(char: SpriteChar, clip: SpriteClip): boolean {
  if (!spritesReady()) return false;
  const r = resolveClip(char, clip);
  if (!r) return false;
  const n = r.src.atlas ?? 0;
  if (atlases.has(n) && warm.has(n)) return true;
  void loadAtlas(n);
  return false;
}

// The website's tintRows, as a shader: unpremultiplied colour, the mask's three
// channels as shirt/shorts/socks shares, shaded like the white kit was.
const TINT_SKSL = `
uniform shader color;
uniform shader mask;
uniform float3 c0;
uniform float3 c1;
uniform float3 c2;
uniform float kw;
half4 main(float2 p) {
  float4 s = float4(color.eval(p));
  if (s.a <= 0.0) return half4(0);
  float3 rgb = s.rgb / s.a;
  float3 m = float3(mask.eval(p).rgb);
  float sum = m.r + m.g + m.b;
  if (sum < 8.0 / 255.0) return half4(s);
  float wgt = sum < s.a ? sum / s.a : 1.0;
  float shade = dot(rgb, float3(0.2126, 0.7152, 0.0722)) / kw;
  shade = min(shade, 1.12);
  float3 f = m / sum;
  float3 t = c0 * f.r + c1 * f.g + c2 * f.b;
  float hi = shade > 1.0 ? shade - 1.0 : 0.0;
  float3 x = min(t * shade + hi, float3(1.0));
  float3 o = rgb * (1.0 - wgt) + x * wgt;
  return half4(half3(o * s.a), half(s.a));
}`;

function hexRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [235, 235, 235];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Atlas `n` in this kit's colours: made once (on the graphics chip when there is one), then kept. */
export function atlasFor(kit: SpriteKit, n = 0): SkImage | null {
  const data = atlases.get(n);
  if (!index || !data) return null;
  const kk = `${kit.shirt}|${kit.shorts}|${kit.socks}`;
  const key = `${n}|${kk}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  if (!seenKits.has(kk)) seenKits.set(kk, kit);
  const t0 = Date.now();
  const S = sk();
  effect ??= S.RuntimeEffect.Make(TINT_SKSL);
  if (!effect) return null;
  const { color, mask } = data;
  const w = color.width(), h = color.height();
  const [a, b, c] = [hexRgb(kit.shirt), hexRgb(kit.shorts), hexRgb(kit.socks)];
  const uniforms = [...a, ...b, ...c, KIT_WHITE / 255];
  const cs = color.makeShaderOptions(0, 0, 0, 0);
  const ms = mask.makeShaderOptions(0, 0, 0, 0);
  const shader = effect.makeShaderWithChildren(uniforms, [cs, ms]);
  const paint = S.Paint();
  paint.setShader(shader);
  const surface = S.Surface.MakeOffscreen?.(w, h) ?? S.Surface.Make(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(S.Color("transparent"));
  canvas.drawRect(S.XYWHRect(0, 0, w, h), paint);
  surface.flush();
  let img = surface.makeImageSnapshot();
  // A picture on the chip belongs to this thread's graphics context: keep a plain copy the screen's thread can draw.
  img = img.makeNonTextureImage?.() ?? img;
  tinted.set(key, img);
  tintTimes.push(Date.now() - t0);
  if (tinted.size > 48) tinted.delete(tinted.keys().next().value as string);
  return img;
}
/** Colour these kits now (before kick-off), in every atlas already in. */
export function warmSpriteKits(kits: SpriteKit[]) {
  for (const kit of kits) for (const n of atlases.keys()) atlasFor(kit, n);
}

// ── lib/star/sprites.ts frame pick and placement ──
function dirIndex(facing: number, dirs: number): number {
  const step = (Math.PI * 2) / dirs;
  let k = Math.round(facing / step) % dirs;
  if (k < 0) k += dirs;
  return k;
}
export function cellDir(clip: string, facing: number, dirs: number): number {
  const k = dirIndex(facing, dirs);
  if (dirs === 8 && (clip === "jog" || clip === "sprint")) {
    if (k === 0 || k === 1) return 7;
    if (k === 4 || k === 3) return 5;
  }
  return k;
}
function mirrorDir(k: number, dirs: number): number {
  return (((dirs / 2 - k) % dirs) + dirs) % dirs;
}
export function mirroredFacing(facing: number): number { return Math.PI - facing; }
export function spriteFrame(clip: { fps: number; loop: string; frames: number; t3d?: number[] }, t: number): number {
  const n = clip.frames;
  if (n <= 1) return 0;
  if (clip.t3d && clip.loop === "once") {
    let i = 0;
    while (i + 1 < n && clip.t3d[i + 1] <= t + 1e-6) i++;
    return i;
  }
  const f = Math.max(0, Math.floor(t * clip.fps));
  if (clip.loop === "once") return Math.min(n - 1, f);
  if (clip.loop === "pingpong") { const p = 2 * n - 2; const q = f % p; return q < n ? q : p - q; }
  return f % n;
}
function cellOf(r: { c: ClipIndex; src: ClipIndex; mirror: boolean }, clip: SpriteClip, facing: number, t: number) {
  const k = cellDir(clip, facing, r.c.dirs);
  const dir = r.mirror ? mirrorDir(k, r.c.dirs) : k;
  return r.src.cells?.[dir * r.src.frames + spriteFrame(r.src, t)] ?? null;
}
export function spriteClipLength(char: SpriteChar, clip: SpriteClip): number {
  const c = index?.chars[char]?.clips[clip];
  return c ? c.frames / c.fps : 0;
}
export function spriteKickStrikeT(): number {
  const c = index?.chars.player.clips.kick;
  return c ? (c.strikeFrame ?? 0) / c.fps : 0;
}
export function spriteClipFps(char: SpriteChar, clip: SpriteClip): number { return index?.chars[char]?.clips[clip]?.fps ?? 0; }
export function spriteClipFrames(char: SpriteChar, clip: SpriteClip): number { return index?.chars[char]?.clips[clip]?.frames ?? 0; }
export function keeperDiveClip(facing: number, dx: number, dy: number): "diveL" | "diveR" {
  return dx * -Math.sin(facing) + dy * Math.cos(facing) >= 0 ? "diveR" : "diveL";
}

export interface DrawSpriteOpts {
  char?: SpriteChar; clip: SpriteClip; t: number; facingRad: number; kit: SpriteKit;
  height?: number; centre?: number; mirror?: boolean; alpha?: number; shadow?: boolean;
}
/** Where a frame lands: the cell, the picture, its scale, and where to put its top-left. */
function place(x: number, y: number, o: DrawSpriteOpts) {
  if (!spritesReady() || !index) return null;
  const char = o.char ?? "player";
  const r = (spriteClipReady(char, o.clip) ? resolveClip(char, o.clip) : null) ?? resolveClip(char, char === "keeper" ? "ready" : "idle");
  if (!r) return null;
  const atlas = atlasFor(o.kit, r.src.atlas ?? 0);
  if (!atlas) return null;
  const facing = o.mirror ? mirroredFacing(o.facingRad) : o.facingRad;
  const cell = cellOf(r, o.clip, facing, o.t);
  if (!cell) return null;
  const [cx, cy, cw, ch, ax, ay] = cell;
  const height = o.height ?? 22;
  const s = height / index.standH;
  const k = Math.max(0, Math.min(1, o.centre ?? 0));
  const axS = r.mirror ? cw - ax : ax;
  const dx = (x - axS * s) * (1 - k) + (x - (cw * s) / 2) * k;
  const dy = (y - ay * s) * (1 - k) + (y - height * 0.25 - (ch * s) / 2) * k;
  return { atlas, cx, cy, cw, ch, s, dx, dy, flip: r.mirror };
}

/** Men asked for whose picture could not be drawn (tools/match-popin.ts reads it: it must stay 0). */
export const spriteMiss = { n: 0, last: "" };
let imgPaint: SkPaint | null = null;
const alphaPaints = new Map<number, SkPaint>();
function paintFor(alpha?: number): SkPaint {
  const S = sk();
  if (alpha == null || alpha >= 1) {
    imgPaint ??= (() => { const p = S.Paint(); p.setAntiAlias(true); return p; })();
    return imgPaint;
  }
  const a = Math.round(alpha * 100) / 100;
  let p = alphaPaints.get(a);
  if (!p) { p = S.Paint(); p.setAntiAlias(true); p.setAlphaf(a); alphaPaints.set(a, p); }
  return p;
}
/** lib/star/sprites.ts drawSprite onto a Skia canvas: (x, y) is where his boots are; `height` px is a man standing. */
export function drawSprite(c: SkCanvas, x: number, y: number, o: DrawSpriteOpts): boolean {
  const p = place(x, y, o);
  if (!p) { spriteMiss.n++; spriteMiss.last = `${o.char ?? "player"}/${o.clip} t ${o.t.toFixed(2)}`; return false; }
  const S = sk();
  const paint = paintFor(o.alpha);
  if (o.mirror) { c.save(); c.translate(x, 0); c.scale(-1, 1); c.translate(-x, 0); }
  if (p.flip) {
    c.save();
    c.translate(p.dx + p.cw * p.s, p.dy);
    c.scale(-1, 1);
    c.drawImageRectOptions(p.atlas, S.XYWHRect(p.cx, p.cy, p.cw, p.ch), S.XYWHRect(0, 0, p.cw * p.s, p.ch * p.s), FILTER_LINEAR, MIPMAP_NONE, paint);
    c.restore();
  } else {
    c.drawImageRectOptions(p.atlas, S.XYWHRect(p.cx, p.cy, p.cw, p.ch), S.XYWHRect(p.dx, p.dy, p.cw * p.s, p.ch * p.s), FILTER_LINEAR, MIPMAP_NONE, paint);
  }
  if (o.mirror) c.restore();
  return true;
}
/** The same, through a canvas-2D context (draw/ctx2d.ts): lib/star/sprites.ts drawSprite verbatim. */
export function drawSpriteCtx(ctx: CanvasRenderingContext2D, x: number, y: number, o: DrawSpriteOpts): boolean {
  const p = place(x, y, o);
  if (!p) return false;
  const height = o.height ?? 22;
  if (o.shadow) drawSpriteShadowCtx(ctx, x, y, height);
  const img = p.atlas as unknown as CanvasImageSource;
  if (o.mirror) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
  const prevA = ctx.globalAlpha;
  if (o.alpha != null) ctx.globalAlpha = prevA * o.alpha;
  if (p.flip) {
    ctx.save();
    ctx.translate(p.dx + p.cw * p.s, p.dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, p.cx, p.cy, p.cw, p.ch, 0, 0, p.cw * p.s, p.ch * p.s);
    ctx.restore();
  } else {
    ctx.drawImage(img, p.cx, p.cy, p.cw, p.ch, p.dx, p.dy, p.cw * p.s, p.ch * p.s);
  }
  ctx.globalAlpha = prevA;
  if (o.mirror) ctx.restore();
  return true;
}
/** lib/star/sprites.ts drawSpriteShadow. */
export function drawSpriteShadowCtx(ctx: CanvasRenderingContext2D, x: number, y: number, height: number): void {
  const rx = height * 0.36, ry = height * 0.13;
  const cx = x + height * 0.12, cy = y + height * 0.02;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, "rgba(0,0,0,0.38)");
  g.addColorStop(0.6, "rgba(0,0,0,0.18)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** lib/star/sprites.ts spriteCell (the goal videos' depth sort reads it). */
export interface SpriteCellInfo { sx: number; sy: number; sw: number; sh: number; ax: number; ay: number; scale: number; atlasW: number; atlasH: number; atlas: number; mirror: boolean }
export function spriteCell(char: SpriteChar, clip: SpriteClip, t: number, facingRad: number, height = 22): SpriteCellInfo | null {
  if (!spriteClipReady(char, clip) || !index) return null;
  const r = resolveClip(char, clip);
  if (!r) return null;
  const cell = cellOf(r, clip, facingRad, t);
  if (!cell) return null;
  const [sx, sy, sw, sh, ax0, ay] = cell;
  const n = r.src.atlas ?? 0;
  const info = n === 0 ? index.atlas : index.atlases?.[String(n)];
  if (!info) return null;
  const ax = r.mirror ? sw - ax0 : ax0;
  return { sx, sy, sw, sh, ax, ay, scale: height / index.standH, atlasW: info.w, atlasH: info.h, atlas: n, mirror: r.mirror };
}

export interface SpritePoint { x: number; y: number; g: number; nx: number; ny: number }
/** lib/star/sprites.ts spritePoints: where an aerial clip's head, chest and foot meet the ball. */
export function spritePoints(char: SpriteChar, clip: SpriteClip, t: number, facingRad: number, height: number, mirror = false): { head: SpritePoint; chest: SpritePoint; foot: SpritePoint } | null {
  if (!spriteClipReady(char, clip) || !index) return null;
  const r = resolveClip(char, clip);
  if (!r || !r.src.pts) return null;
  const facing = mirror ? mirroredFacing(facingRad) : facingRad;
  const k = cellDir(clip, facing, r.c.dirs);
  const dir = r.mirror ? mirrorDir(k, r.c.dirs) : k;
  const p = r.src.pts[dir * r.src.frames + spriteFrame(r.src, t)];
  if (!p) return null;
  const s = height / index.standH;
  const flip = (mirror ? -1 : 1) * (r.mirror ? -1 : 1);
  const at = (i: number): SpritePoint => ({ x: flip * p[i] * s, y: p[i + 1] * s, g: p[i + 2] * s, nx: flip * p[i + 3], ny: p[i + 4] });
  return { head: at(0), chest: at(5), foot: at(10) };
}

// The soft contact shadow under every man (lib/star/figure3d.ts drawSoftShadow), as one picture scaled.
let shadowImg: SkImage | null = null;
function shadow(): SkImage | null {
  if (shadowImg) return shadowImg;
  const S = sk();
  const surf = S.Surface.Make(64, 64);
  if (!surf) return null;
  const p = S.Paint();
  p.setShader(S.Shader.MakeRadialGradient({ x: 32, y: 32 }, 32, [S.Color("rgba(0,0,0,0.36)"), S.Color("rgba(0,0,0,0.16)"), S.Color("rgba(0,0,0,0)")], [0, 0.6, 1], 0));
  surf.getCanvas().drawRect(S.XYWHRect(0, 0, 64, 64), p);
  surf.flush();
  shadowImg = surf.makeImageSnapshot();
  shadowImg = shadowImg.makeNonTextureImage?.() ?? shadowImg;
  return shadowImg;
}
/** drawMatchFigure's contact shadow: soft, a little long, to the lower right. `r` is the figure's radius. */
export function drawFigureShadow(c: SkCanvas, x: number, groundY: number, r: number) {
  const img = shadow();
  if (!img) return;
  const S = sk();
  const sr = r * 0.42 * 1.25, ry = r * 0.17;
  const cx = x + r * 0.22, cy = groundY + r * 0.05;
  c.drawImageRectOptions(img, S.XYWHRect(0, 0, 64, 64), S.XYWHRect(cx - sr, cy - ry, sr * 2, ry * 2), FILTER_LINEAR, MIPMAP_NONE, paintFor());
}
