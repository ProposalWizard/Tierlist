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
 * A SECOND atlas (atlas-1.webp + mask-1.png, Leo, 7 Oct 2026) holds the
 * Animations: New clips — the touch, pass, shot, volley, chip, header, block
 * and clearance, and the keeper's one-hand stretch, low dive, parry, catch,
 * fumble and getting up. Baked on the same body (people3d player.glb) by
 * tools/sprites/new/. Its clips say `atlas: 1` in index.json and it loads
 * only when one of them is first asked for (spriteClipReady), so with
 * Animations: Old it is never fetched. A clip with `mirrorOf` (the keeper's
 * left-side saves) is its right-side twin drawn flipped.
 *
 * This module only draws pictures. No physics, no loop, no timing of its own:
 * the caller says which clip, how far into it, which way he faces.
 *
 * Facing is a SCREEN angle, canvas style: 0 = right, PI/2 = down the screen.
 */

export type SpriteChar = "player" | "keeper";
export type SpriteClip =
  | "idle" | "jog" | "sprint" | "kick" | "celebrate" // player
  | "ready" | "diveL" | "diveR"                      // keeper (and "jog")
  | NewSpriteClip;

/** Animations: New only (atlas 1). */
export const NEW_PLAYER_CLIPS = ["touch", "passKick", "shotKick", "volley", "chipKick", "header", "block", "clearance"] as const;
export const NEW_KEEPER_CLIPS = [
  "oneHandR", "oneHandL", "lowDiveR", "lowDiveL", "parryR", "parryL", "catchHold", "fumble", "getUpR", "getUpL",
] as const;
export type NewSpriteClip = (typeof NEW_PLAYER_CLIPS)[number] | (typeof NEW_KEEPER_CLIPS)[number];

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
  /** Which atlas its cells are in (absent = 0). */
  atlas?: number;
  /** Drawn as this clip of the same man, flipped left to right (no cells of its own). */
  mirrorOf?: string;
  /** [x, y, w, h, anchorX, anchorY] per cell; cell = dir * frames + frame. */
  cells?: [number, number, number, number, number, number][];
}
interface AtlasInfo { color: string; mask: string; w: number; h: number }
interface SpriteIndex {
  version: number;
  tilt: number;
  ppm: number;
  outlinePx: number;
  /** Boots to top of head of a standing man, in baked pixels. */
  standH: number;
  atlas: AtlasInfo;
  /** Further atlases by number (1 = the Animations: New clips). */
  atlases?: Record<string, AtlasInfo>;
  chars: Record<SpriteChar, { clips: Partial<Record<SpriteClip, ClipIndex>> }>;
}

export const SPRITE_BASE = "/star/sprites/";

let index: SpriteIndex | null = null;
let indexBase = SPRITE_BASE;
/** Each loaded atlas's pixels, by atlas number. */
const atlasData = new Map<number, { color: ImageData; mask: ImageData }>();
const atlasLoading = new Map<number, Promise<boolean>>();
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
      indexBase = base;
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
      atlasData.set(0, { color: c, mask: m });
      index = idx;
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

/** Load atlas `n` (n ≥ 1) once the index is in. Resolves true when ready. */
function loadAtlas(n: number): Promise<boolean> {
  const have = atlasLoading.get(n);
  if (have) return have;
  const p = (async () => {
    try {
      const info = index?.atlases?.[String(n)];
      if (!info) return false;
      const [ci, mi] = await Promise.all([loadImage(indexBase + info.color), loadImage(indexBase + info.mask)]);
      const c = pixels(ci), m = pixels(mi);
      if (!c || !m) { atlasLoading.delete(n); return false; }
      atlasData.set(n, { color: c, mask: m });
      return true;
    } catch {
      atlasLoading.delete(n); // let a later frame try again
      return false;
    }
  })();
  atlasLoading.set(n, p);
  return p;
}

/** A clip's own entry and where its cells come from (itself, or the clip it mirrors). */
function resolveClip(char: SpriteChar, clip: SpriteClip): { c: ClipIndex; src: ClipIndex; mirror: boolean } | null {
  const c = index?.chars[char]?.clips[clip];
  if (!c) return null;
  if (!c.mirrorOf) return c.cells ? { c, src: c, mirror: false } : null;
  const src = index?.chars[char]?.clips[c.mirrorOf as SpriteClip];
  return src && src.cells ? { c, src, mirror: true } : null;
}

/**
 * True once this clip can be drawn (its atlas is in). For a clip in a later
 * atlas, the first ask starts loading it — so the Animations: New atlas is
 * only ever fetched by a match that wants a New clip. False for a clip the
 * index does not have at all.
 */
export function spriteClipReady(char: SpriteChar, clip: SpriteClip): boolean {
  if (!spritesReady()) return false;
  const r = resolveClip(char, clip);
  if (!r) return false;
  const n = r.src.atlas ?? 0;
  if (atlasData.has(n)) return true;
  void loadAtlas(n);
  return false;
}

/** The facing frame of a mirrored clip: his facing reflected left to right. */
function mirrorDir(k: number, dirs: number): number {
  return (((dirs / 2 - k) % dirs) + dirs) % dirs;
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
function atlasFor(kit: SpriteKit, n = 0): HTMLCanvasElement | null {
  const data = atlasData.get(n);
  if (!index || !data) return null;
  const { color: colorData, mask: maskData } = data;
  const key = `${n}|${kit.shirt}|${kit.shorts}|${kit.socks}`;
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
 *
 * The down-diagonals (running across and toward the camera) sprawl the same
 * way. With only the sideways frames swapped, a man running across the
 * screen with a little downward drift flipped between a standing frame (7)
 * and a sprawled one (1) every few frames — "two players overlap and flip
 * between lying and standing" on byline crosses (v0.27 known issue). So they
 * use the up-diagonal too: every run to the right stands as 7, to the left as
 * 5, and the only change of frame left is to the straight-down frame (2),
 * which also stands.
 */
export function cellDir(clip: string, facing: number, dirs: number): number {
  const k = dirIndex(facing, dirs);
  if (dirs === 8 && (clip === "jog" || clip === "sprint")) {
    if (k === 0 || k === 1) return 7;
    if (k === 4 || k === 3) return 5;
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

/** The frame (dir, frame) cell of a resolved clip, and whether to flip it. */
function cellOf(r: { c: ClipIndex; src: ClipIndex; mirror: boolean }, clip: SpriteClip, facing: number, t: number) {
  const k = cellDir(clip, facing, r.c.dirs);
  const dir = r.mirror ? mirrorDir(k, r.c.dirs) : k;
  return r.src.cells?.[dir * r.src.frames + spriteFrame(r.src, t)] ?? null;
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
  /** 0..1: how far to draw the frame's MIDDLE over (x, y − ¼ height) instead
   *  of his boots (1 = fully), blended so the dive starts from his feet. For a
   *  keeper's dive, whose boots fly off to one side of the frame. Anchored on
   *  the boots, the stretched-out body landed a body-length past the ball he
   *  was saving (Harry, 3 Oct 2026: "the goalie isn't in his goal"). */
  centre?: number;
  /** Draw him mirrored left-right, still facing `facingRad`: a left-footer's
   *  kick. The baked kick is struck with the right foot, so a left-footer
   *  is that frame for the mirrored heading, flipped about his boots. */
  mirror?: boolean;
}

/** The heading whose frame, flipped left-right, faces `facing`. */
export function mirroredFacing(facing: number): number {
  return Math.PI - facing;
}

/**
 * Draw one man with his boots at (x, y). Returns false if the sprites are not
 * loaded yet (or the clip is missing) so the caller can fall back.
 */
export function drawSprite(ctx: CanvasRenderingContext2D, x: number, y: number, o: DrawSpriteOpts): boolean {
  if (!spritesReady() || !index) return false;
  const char = o.char ?? "player";
  const r = resolveClip(char, o.clip) ?? resolveClip(char, char === "keeper" ? "ready" : "idle");
  if (!r) return false;
  const atlas = atlasFor(o.kit, r.src.atlas ?? 0);
  if (!atlas) return false;
  const facing = o.mirror ? mirroredFacing(o.facingRad) : o.facingRad;
  const cell = cellOf(r, o.clip, facing, o.t);
  if (!cell) return false;
  const [cx, cy, cw, ch, ax, ay] = cell;
  const s = (o.height ?? 22) / index.standH;
  if (o.shadow) drawSpriteShadow(ctx, x, y, o.height ?? 22);
  if (o.mirror) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
  const prevA = ctx.globalAlpha;
  if (o.alpha != null) ctx.globalAlpha = prevA * o.alpha;
  const prevS = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  const k = Math.max(0, Math.min(1, o.centre ?? 0));
  // Flipped, his boots sit as far from the frame's right edge as they were from its left.
  const axS = r.mirror ? cw - ax : ax;
  const dx = (x - axS * s) * (1 - k) + (x - (cw * s) / 2) * k;
  const dy = (y - ay * s) * (1 - k) + (y - (o.height ?? 22) * 0.25 - (ch * s) / 2) * k;
  if (r.mirror) {
    ctx.save();
    ctx.translate(dx + cw * s, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(atlas, cx, cy, cw, ch, 0, 0, cw * s, ch * s);
    ctx.restore();
  } else {
    ctx.drawImage(atlas, cx, cy, cw, ch, dx, dy, cw * s, ch * s);
  }
  ctx.imageSmoothingEnabled = prevS;
  ctx.globalAlpha = prevA;
  if (o.mirror) ctx.restore();
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
  /** Which atlas (for spriteAtlasUrl), and whether to draw it flipped. */
  atlas: number;
  mirror: boolean;
}
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

const atlasUrls = new Map<string, string | null>();
/** The tinted atlas as an image URL (for DOM previews). Null for the first
 *  few frames while the picture is being encoded. */
export function spriteAtlasUrl(kit: SpriteKit, atlas = 0): string | null {
  const key = `${atlas}|${kit.shirt}|${kit.shorts}|${kit.socks}`;
  if (atlasUrls.has(key)) return atlasUrls.get(key) ?? null;
  const cv = atlasFor(kit, atlas);
  if (!cv) return null;
  atlasUrls.set(key, null);
  cv.toBlob((b) => { if (b) atlasUrls.set(key, URL.createObjectURL(b)); else atlasUrls.delete(key); }, "image/png");
  return null;
}

/** A clip's frames a second as baked (0 if the index does not have it). */
export function spriteClipFps(char: SpriteChar, clip: SpriteClip): number {
  return index?.chars[char]?.clips[clip]?.fps ?? 0;
}
/** A clip's frame count as baked (0 if the index does not have it). */
export function spriteClipFrames(char: SpriteChar, clip: SpriteClip): number {
  return index?.chars[char]?.clips[clip]?.frames ?? 0;
}
