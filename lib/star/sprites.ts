/**
 * PRE-RENDERED 3D MATCH FIGURES — load, tint, draw.
 *
 * The small "simple clean modern 3D" players and keepers Harry approved
 * (3 Oct 2026). They are baked offline from the rigged models by
 * tools/sprites/bake.mjs into public/star/sprites/:
 *   - atlas-0.webp  the figures, kit flattened to plain lit white, boots dark,
 *                   a 1 px dark outline already round each one (at the game's
 *                   size — the bake is 2x for crisp phones);
 *   - mask-0.png    red = shirt, green = shorts, blue = socks, so any club's
 *                   colours go on at runtime and skin and hair stay as they are;
 *   - index.json    every frame's rectangle and the point under his boots.
 *
 * This module only draws pictures. No physics, no loop, no timing of its own:
 * the caller says which clip, how far into it, which way he faces.
 *
 * Facing is a SCREEN angle, canvas style: 0 = right, PI/2 = down the screen.
 */

export type SpriteChar = "player" | "keeper";
export type SpriteClip =
  | "idle" | "jog" | "sprint" | "kick" | "celebrate" // player
  | "ready" | "diveL" | "diveR";                     // keeper (and "jog")

export interface SpriteKit {
  shirt: string;
  shorts: string;
  socks: string;
}

interface ClipIndex {
  fps: number;
  loop: "loop" | "pingpong" | "once";
  dirs: number;
  frames: number;
  strikeFrame?: number;
  /** [x, y, w, h, anchorX, anchorY] per cell; cell = dir * frames + frame. */
  cells: [number, number, number, number, number, number][];
}
interface SpriteIndex {
  version: number;
  tilt: number;
  ppm: number;
  outlinePx: number;
  /** Boots to top of head of a standing man, in baked pixels. */
  standH: number;
  atlas: { color: string; mask: string; w: number; h: number };
  chars: Record<SpriteChar, { clips: Partial<Record<SpriteClip, ClipIndex>> }>;
}

export const SPRITE_BASE = "/star/sprites/";

let index: SpriteIndex | null = null;
let colorData: ImageData | null = null;
let maskData: ImageData | null = null;
let loading: Promise<boolean> | null = null;
/** Brightness of a lit white kit in the bake — what "full colour" means. */
let kitWhite = 220;
const tinted = new Map<string, HTMLCanvasElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("sprite image " + src));
    im.src = src;
  });
}
function pixels(im: HTMLImageElement): ImageData | null {
  const c = document.createElement("canvas");
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(im, 0, 0);
  return g.getImageData(0, 0, c.width, c.height);
}

/** Start loading the atlases (safe to call every frame). Resolves true when ready. */
export function loadSprites(base: string = SPRITE_BASE): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  if (loading) return loading;
  loading = (async () => {
    try {
      const r = await fetch(base + "index.json");
      if (!r.ok) return false;
      const idx = (await r.json()) as SpriteIndex;
      const [ci, mi] = await Promise.all([loadImage(base + idx.atlas.color), loadImage(base + idx.atlas.mask)]);
      const c = pixels(ci), m = pixels(mi);
      if (!c || !m) return false;
      // The lit-white reference: a high percentile of the kit pixels' brightness.
      const hist = new Uint32Array(256);
      let n = 0;
      for (let i = 0; i < c.data.length; i += 4) {
        if (c.data[i + 3] < 250) continue;
        const k = m.data[i] + m.data[i + 1] + m.data[i + 2];
        if (k < 240) continue;
        hist[Math.round(lum(c.data[i], c.data[i + 1], c.data[i + 2]))]++; n++;
      }
      let acc = 0;
      for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.1) { kitWhite = Math.max(120, v); break; } }
      index = idx; colorData = c; maskData = m;
      return true;
    } catch {
      loading = null; // let a later frame try again
      return false;
    }
  })();
  return loading;
}

/** True once drawSprite can draw. Kicks off the load if it hasn't started. */
export function spritesReady(): boolean {
  if (!index) void loadSprites();
  return !!index;
}

function lum(r: number, g: number, b: number): number { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function hexRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [235, 235, 235];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The atlas in one club's colours (made once per kit, then reused). */
function atlasFor(kit: SpriteKit): HTMLCanvasElement | null {
  if (!index || !colorData || !maskData) return null;
  const key = `${kit.shirt}|${kit.shorts}|${kit.socks}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const { width: w, height: h } = colorData;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  if (!g) return null;
  const out = new ImageData(w, h);
  const s = colorData.data, m = maskData.data, o = out.data;
  const cols = [hexRgb(kit.shirt), hexRgb(kit.shorts), hexRgb(kit.socks)];
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3];
    o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; o[i + 3] = a;
    if (a === 0) continue;
    const mr = m[i], mg = m[i + 1], mb = m[i + 2];
    const sum = mr + mg + mb;
    if (sum < 8) continue;
    // Share of this pixel that is kit (the mask is coverage; the colour's
    // alpha also holds the outline's coverage).
    const wgt = Math.min(1, sum / a);
    const shade = Math.min(1.12, lum(s[i], s[i + 1], s[i + 2]) / kitWhite);
    let tr = 0, tg = 0, tb = 0;
    const parts = [mr, mg, mb];
    for (let k = 0; k < 3; k++) {
      const f = parts[k] / sum;
      if (f === 0) continue;
      tr += cols[k][0] * f; tg += cols[k][1] * f; tb += cols[k][2] * f;
    }
    // A lit kit: the club colour, shaded as the white kit was, a touch of
    // the highlight kept so dark shirts still have form.
    const hi = Math.max(0, shade - 1) * 255;
    o[i] = s[i] * (1 - wgt) + Math.min(255, tr * shade + hi) * wgt;
    o[i + 1] = s[i + 1] * (1 - wgt) + Math.min(255, tg * shade + hi) * wgt;
    o[i + 2] = s[i + 2] * (1 - wgt) + Math.min(255, tb * shade + hi) * wgt;
  }
  g.putImageData(out, 0, 0);
  tinted.set(key, cv);
  if (tinted.size > 24) tinted.delete(tinted.keys().next().value as string);
  return cv;
}

function dirIndex(facing: number, dirs: number): number {
  const step = (Math.PI * 2) / dirs;
  let k = Math.round(facing / step) % dirs;
  if (k < 0) k += dirs;
  return k;
}

/**
 * The facing frame to show. Seen from above with the tilt, a man running
 * straight across the screen leans and strides flat and reads as lying down;
 * the up-diagonal frame (running across and a touch away from the camera)
 * stands him up. So pure sideways running uses that frame instead.
 */
function cellDir(clip: string, facing: number, dirs: number): number {
  const k = dirIndex(facing, dirs);
  if (dirs === 8 && (clip === "jog" || clip === "sprint")) {
    if (k === 0) return 7;
    if (k === 4) return 5;
  }
  return k;
}

/** Which frame of a clip `t` seconds in. */
export function spriteFrame(clip: { fps: number; loop: string; frames: number }, t: number): number {
  const n = clip.frames;
  if (n <= 1) return 0;
  const f = Math.max(0, Math.floor(t * clip.fps));
  if (clip.loop === "once") return Math.min(n - 1, f);
  if (clip.loop === "pingpong") {
    const p = 2 * n - 2;
    const q = f % p;
    return q < n ? q : p - q;
  }
  return f % n;
}

/** How long a "once" clip lasts, in seconds (0 if unknown). */
export function spriteClipLength(char: SpriteChar, clip: SpriteClip): number {
  const c = index?.chars[char]?.clips[clip];
  return c ? c.frames / c.fps : 0;
}
/** Seconds into the kick clip at which the boot meets the ball. */
export function spriteKickStrikeT(): number {
  const c = index?.chars.player.clips.kick;
  return c ? (c.strikeFrame ?? 0) / c.fps : 0;
}

/**
 * The keeper's dive clip for a dive toward screen direction (dx, dy), given
 * the way he faces. His own right is the screen vector (-sin a, cos a).
 */
export function keeperDiveClip(facing: number, dx: number, dy: number): "diveL" | "diveR" {
  return dx * -Math.sin(facing) + dy * Math.cos(facing) >= 0 ? "diveR" : "diveL";
}

export interface DrawSpriteOpts {
  char?: SpriteChar;
  clip: SpriteClip;
  /** Seconds since the clip started. */
  t: number;
  /** Screen angle he faces (0 = right, PI/2 = down). */
  facingRad: number;
  kit: SpriteKit;
  /** Height on screen of a standing man, boots to head, in CSS px. Default 22. */
  height?: number;
  /** Draw a soft contact shadow thrown to the lower right. Default false
   *  (the match draws its own). */
  shadow?: boolean;
  alpha?: number;
}

/**
 * Draw one man with his boots at (x, y). Returns false if the sprites are not
 * loaded yet (or the clip is missing) so the caller can fall back.
 */
export function drawSprite(ctx: CanvasRenderingContext2D, x: number, y: number, o: DrawSpriteOpts): boolean {
  if (!spritesReady() || !index) return false;
  const char = o.char ?? "player";
  const clip = index.chars[char]?.clips[o.clip] ?? (char === "keeper" ? index.chars.keeper.clips.ready : index.chars.player.clips.idle);
  if (!clip) return false;
  const atlas = atlasFor(o.kit);
  if (!atlas) return false;
  const cell = clip.cells[cellDir(o.clip, o.facingRad, clip.dirs) * clip.frames + spriteFrame(clip, o.t)];
  if (!cell) return false;
  const [cx, cy, cw, ch, ax, ay] = cell;
  const s = (o.height ?? 22) / index.standH;
  if (o.shadow) drawSpriteShadow(ctx, x, y, o.height ?? 22);
  const prevA = ctx.globalAlpha;
  if (o.alpha != null) ctx.globalAlpha = prevA * o.alpha;
  const prevS = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(atlas, cx, cy, cw, ch, x - ax * s, y - ay * s, cw * s, ch * s);
  ctx.imageSmoothingEnabled = prevS;
  ctx.globalAlpha = prevA;
  return true;
}

/** A soft contact shadow, a little long, thrown to the lower right. */
export function drawSpriteShadow(ctx: CanvasRenderingContext2D, x: number, y: number, height: number): void {
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

/** A club's kit (shirt + trim, see kits.ts) as sprite colours: shorts in the trim. */
export function spriteKitOf(kit: { shirt: string; trim: string }, socks?: string): SpriteKit {
  return { shirt: kit.shirt, shorts: kit.trim, socks: socks ?? kit.shirt };
}

/** One frame's place in the atlas, scaled so a standing man is `height` px. */
export interface SpriteCellInfo {
  sx: number; sy: number; sw: number; sh: number;
  /** Where the boots are inside the frame, in baked px. */
  ax: number; ay: number;
  /** Baked px → screen px. */
  scale: number;
  atlasW: number; atlasH: number;
}
export function spriteCell(char: SpriteChar, clip: SpriteClip, t: number, facingRad: number, height = 22): SpriteCellInfo | null {
  if (!spritesReady() || !index) return null;
  const c = index.chars[char]?.clips[clip];
  if (!c) return null;
  const cell = c.cells[cellDir(clip, facingRad, c.dirs) * c.frames + spriteFrame(c, t)];
  if (!cell) return null;
  const [sx, sy, sw, sh, ax, ay] = cell;
  return { sx, sy, sw, sh, ax, ay, scale: height / index.standH, atlasW: index.atlas.w, atlasH: index.atlas.h };
}

const atlasUrls = new Map<string, string | null>();
/** The tinted atlas as an image URL (for DOM previews). Null for the first
 *  few frames while the picture is being encoded. */
export function spriteAtlasUrl(kit: SpriteKit): string | null {
  const key = `${kit.shirt}|${kit.shorts}|${kit.socks}`;
  if (atlasUrls.has(key)) return atlasUrls.get(key) ?? null;
  const cv = atlasFor(kit);
  if (!cv) return null;
  atlasUrls.set(key, null);
  cv.toBlob((b) => { if (b) atlasUrls.set(key, URL.createObjectURL(b)); else atlasUrls.delete(key); }, "image/png");
  return null;
}
