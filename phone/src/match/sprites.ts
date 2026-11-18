/**
 * THE MATCH'S PLAYERS AS THE WEBSITE DRAWS THEM: its 3D sprite sheet
 * (public/star/sprites/, Settings → Look → Players in the match: 3D, the
 * website's default), coloured per kit, drawn per frame as one picture cut.
 *
 * lib/star/sprites.ts does this in the browser (fetch, <img>, getImageData,
 * a per-pixel colour pass into a hidden canvas). The phone has none of that,
 * so this file ports it onto Skia, line for line in what it decides:
 *   - the same index (cells, anchors, clips, fps, loops, 8 or 4 facings);
 *   - the same kit colouring (tintRows): the same formula, run ONCE per kit
 *     on the graphics chip as a Skia shader into an image (pre-rendered);
 *   - the same frame pick (spriteFrame, cellDir) and placement (drawSprite);
 *   - kitWhite (the lit-white reference the colouring divides by) measured
 *     off atlas-0 with the website's own rule (tools/match-frame.ts prints it).
 * Per frame only drawImageRect calls remain.
 *
 * Bundled: atlas 0 only (idle, jog, sprint, kick, celebrate; the keeper's
 * ready, jog and two dives): match/assets/sprites/index-0.json is the
 * website's index.json cut to those clips. Not bundled yet: atlases 1-5 (the
 * New touch/pass/shot clips, celebrations, aerial moves, keeper catches).
 */
import type { SkCanvas, SkImage, SkRuntimeEffect, SkPaint } from "@shopify/react-native-skia";
import { sk, FILTER_LINEAR, MIPMAP_NONE } from "./skiaApi";

export type SpriteChar = "player" | "keeper";
export type SpriteClip = "idle" | "jog" | "sprint" | "kick" | "celebrate" | "ready" | "diveR" | "diveL";
export interface SpriteKit { shirt: string; shorts: string; socks: string }
interface ClipIndex { fps: number; loop: "loop" | "pingpong" | "once"; dirs: number; frames: number; strikeFrame?: number; t3d?: number[]; cells: [number, number, number, number, number, number][] }
export interface SpriteIndex { standH: number; atlas: { w: number; h: number }; chars: Record<SpriteChar, { clips: Partial<Record<SpriteClip, ClipIndex>> }> }

/** lib/star/sprites.ts kitWhite for atlas-0 (a high percentile of the kit pixels' brightness). */
export const KIT_WHITE = 253;

let index: SpriteIndex | null = null;
let color: SkImage | null = null;
let mask: SkImage | null = null;
const tinted = new Map<string, SkImage>();
let effect: SkRuntimeEffect | null = null;

/** Hand the sheet over once its pictures are decoded (the phone: spriteAssets.ts; node: the tool). */
export function setSpriteSheet(idx: SpriteIndex, colorImg: SkImage, maskImg: SkImage) {
  index = idx; color = colorImg; mask = maskImg; tinted.clear();
}
export function spritesReady(): boolean { return !!(index && color && mask); }
export function spriteIndex(): SpriteIndex | null { return index; }

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

/** The sheet in this kit's colours: made once (on the graphics chip when there is one), then kept. */
export function atlasFor(kit: SpriteKit): SkImage | null {
  if (!index || !color || !mask) return null;
  const key = `${kit.shirt}|${kit.shorts}|${kit.socks}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const S = sk();
  effect ??= S.RuntimeEffect.Make(TINT_SKSL);
  if (!effect) return null;
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
  if (tinted.size > 24) tinted.delete(tinted.keys().next().value as string);
  return img;
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
export function spriteKickStrikeT(): number {
  const c = index?.chars.player.clips.kick;
  return c ? (c.strikeFrame ?? 0) / c.fps : 0;
}
export function keeperDiveClip(facing: number, dx: number, dy: number): "diveL" | "diveR" {
  return dx * -Math.sin(facing) + dy * Math.cos(facing) >= 0 ? "diveR" : "diveL";
}

let imgPaint: SkPaint | null = null;
/** lib/star/sprites.ts drawSprite: (x, y) is where his boots are; `height` px is a man standing. */
export function drawSprite(c: SkCanvas, x: number, y: number, o: { char: SpriteChar; clip: SpriteClip; t: number; facing: number; kit: SpriteKit; height: number; centre?: number }): boolean {
  if (!index) return false;
  const r = index.chars[o.char]?.clips[o.clip] ?? index.chars[o.char]?.clips[o.char === "keeper" ? "ready" : "idle"];
  if (!r) return false;
  const atlas = atlasFor(o.kit);
  if (!atlas) return false;
  const k0 = cellDir(o.clip, o.facing, r.dirs);
  const cell = r.cells[k0 * r.frames + spriteFrame(r, o.t)];
  if (!cell) return false;
  const [cx, cy, cw, ch, ax, ay] = cell;
  const s = o.height / index.standH;
  const k = Math.max(0, Math.min(1, o.centre ?? 0));
  const dx = (x - ax * s) * (1 - k) + (x - (cw * s) / 2) * k;
  const dy = (y - ay * s) * (1 - k) + (y - o.height * 0.25 - (ch * s) / 2) * k;
  const S = sk();
  imgPaint ??= (() => { const p = S.Paint(); p.setAntiAlias(true); return p; })();
  c.drawImageRectOptions(atlas, S.XYWHRect(cx, cy, cw, ch), S.XYWHRect(dx, dy, cw * s, ch * s), FILTER_LINEAR, MIPMAP_NONE, imgPaint);
  return true;
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
  return shadowImg;
}
/** drawMatchFigure's contact shadow: soft, a little long, to the lower right. `r` is the figure's radius. */
export function drawFigureShadow(c: SkCanvas, x: number, groundY: number, r: number) {
  const img = shadow();
  if (!img) return;
  const S = sk();
  const sr = r * 0.42 * 1.25, ry = r * 0.17;
  const cx = x + r * 0.22, cy = groundY + r * 0.05;
  imgPaint ??= (() => { const p = S.Paint(); p.setAntiAlias(true); return p; })();
  c.drawImageRectOptions(img, S.XYWHRect(0, 0, 64, 64), S.XYWHRect(cx - sr, cy - ry, sr * 2, ry * 2), FILTER_LINEAR, MIPMAP_NONE, imgPaint);
}
