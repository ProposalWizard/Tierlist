/**
 * CSS WORDS THE WEBSITE'S DRAWINGS USE, READ WITHOUT A BROWSER.
 * Colours ("#d71920", "rgba(0,0,0,0.4)", "hsl(120 50% 40%)", "gold"), the
 * canvas font shorthand ("900 15px system-ui, sans-serif") and the canvas
 * `filter` (only blur() and "none" draw anything). Pure code: no Skia here,
 * so tools/draw-check.ts can test it in node.
 */

/** A colour as four numbers 0..1, not premultiplied. */
export type RGBA = [number, number, number, number];

// Every CSS named colour (CSS Color 4), as 6-digit hex.
const NAMED_SRC =
  "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 " +
  "blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 " +
  "chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b " +
  "darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b " +
  "darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f " +
  "darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 " +
  "deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 " +
  "fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f " +
  "grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa " +
  "lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff " +
  "lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a " +
  "lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 " +
  "lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd " +
  "mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a " +
  "mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 " +
  "navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 " +
  "palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 " +
  "peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f " +
  "royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d " +
  "silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f " +
  "steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 " +
  "white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32";
const NAMED = new Map<string, string>();
{
  const p = NAMED_SRC.split(" ");
  for (let i = 0; i + 1 < p.length; i += 2) NAMED.set(p[i], p[i + 1]);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** One number in rgb(): "255", "50%", "12.5". Returns 0..1. */
function channel(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (t.endsWith("%")) { const v = parseFloat(t); return Number.isFinite(v) ? clamp01(v / 100) : null; }
  const v = parseFloat(t);
  return Number.isFinite(v) ? clamp01(v / 255) : null;
}
/** An alpha: "0.4", "40%". Returns 0..1. */
function alphaOf(s: string | undefined): number | null {
  if (s === undefined) return 1;
  const t = s.trim();
  if (!t) return null;
  const v = parseFloat(t);
  if (!Number.isFinite(v)) return null;
  return clamp01(t.endsWith("%") ? v / 100 : v);
}
/** "120", "120deg", "0.5turn", "2rad" → degrees. */
function hueOf(s: string): number | null {
  const t = s.trim().toLowerCase();
  const v = parseFloat(t);
  if (!Number.isFinite(v)) return null;
  if (t.endsWith("turn")) return v * 360;
  if (t.endsWith("grad")) return v * 0.9;
  if (t.endsWith("rad")) return (v * 180) / Math.PI;
  return v;
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}
/** "a, b, c / d" or "a b c / d" or "a,b,c,d" → its parts (3 or 4). */
function args(inner: string): string[] | null {
  let main = inner, alpha: string | undefined;
  const slash = inner.indexOf("/");
  if (slash >= 0) { main = inner.slice(0, slash); alpha = inner.slice(slash + 1); }
  const parts = main.includes(",") ? main.split(",") : main.trim().split(/\s+/);
  if (alpha !== undefined) parts.push(alpha);
  const out = parts.map((p) => p.trim());
  return out.length === 3 || out.length === 4 ? out : null;
}

const cache = new Map<string, RGBA | null>();

/**
 * A CSS colour as [r, g, b, a] (0..1), or null when the browser would not
 * accept it (then the canvas keeps its previous colour, as a browser does).
 */
export function parseColor(input: string): RGBA | null {
  const hit = cache.get(input);
  if (hit !== undefined) return hit;
  const out = parse(input);
  if (cache.size > 4000) cache.clear();
  cache.set(input, out);
  return out;
}

function parse(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === "transparent") return [0, 0, 0, 0];
  if (s === "currentcolor") return [0, 0, 0, 1];
  const named = NAMED.get(s);
  if (named) return parse("#" + named);
  if (s[0] === "#") {
    const h = s.slice(1);
    if (!/^[0-9a-f]+$/.test(h)) return null;
    if (h.length === 3 || h.length === 4) {
      const v = [...h].map((c) => parseInt(c + c, 16) / 255);
      return [v[0], v[1], v[2], h.length === 4 ? v[3] : 1];
    }
    if (h.length === 6 || h.length === 8) {
      const v = [0, 2, 4, 6].map((i) => (i < h.length ? parseInt(h.slice(i, i + 2), 16) / 255 : 1));
      return [v[0], v[1], v[2], v[3]];
    }
    return null;
  }
  const m = /^(rgba?|hsla?)\((.*)\)$/.exec(s);
  if (!m) return null;
  const a = args(m[2]);
  if (!a) return null;
  const alpha = alphaOf(a[3]);
  if (alpha === null) return null;
  if (m[1].startsWith("rgb")) {
    const r = channel(a[0]), g = channel(a[1]), b = channel(a[2]);
    if (r === null || g === null || b === null) return null;
    return [r, g, b, alpha];
  }
  const h = hueOf(a[0]);
  const sat = parseFloat(a[1]), lig = parseFloat(a[2]);
  if (h === null || !Number.isFinite(sat) || !Number.isFinite(lig)) return null;
  const [r, g, b] = hslToRgb(h, clamp01(sat / 100), clamp01(lig / 100));
  return [r, g, b, alpha];
}

/** The canvas font shorthand, read into what a font finder needs. */
export interface FontSpec {
  family: string;      // the first family named, unquoted ("system-ui")
  families: string[];  // all of them, in order
  size: number;        // px
  weight: number;      // 100..900
  italic: boolean;
}

const WEIGHT_WORDS: Record<string, number> = { normal: 400, bold: 700, bolder: 700, lighter: 300 };

/** "italic 900 15px/1.2 system-ui, 'Segoe UI', sans-serif" → FontSpec, or null if unreadable. */
export function parseFont(font: string): FontSpec | null {
  const m = /^\s*((?:[a-z0-9-]+\s+)*?)(\d*\.?\d+)(px|pt|em|rem)(?:\s*\/\s*[^\s]+)?\s+(.+)$/i.exec(font);
  if (!m) return null;
  let weight = 400, italic = false;
  for (const w of m[1].trim().split(/\s+/).filter(Boolean)) {
    const lw = w.toLowerCase();
    if (/^\d+$/.test(lw)) weight = Math.max(1, Math.min(1000, parseInt(lw, 10)));
    else if (lw in WEIGHT_WORDS) weight = WEIGHT_WORDS[lw];
    else if (lw === "italic" || lw === "oblique") italic = true;
  }
  let size = parseFloat(m[2]);
  const unit = m[3].toLowerCase();
  if (unit === "pt") size *= 4 / 3;
  else if (unit === "em" || unit === "rem") size *= 16;
  const families = m[4].split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  if (!families.length) return null;
  return { family: families[0], families, size, weight, italic };
}

/** The canvas `filter`: what this adapter can draw. Only blur() is used by the game. */
export interface FilterSpec { blur: number }
export function parseFilter(filter: string): FilterSpec | null {
  const s = filter.trim().toLowerCase();
  if (!s || s === "none") return null;
  const m = /blur\(\s*(\d*\.?\d+)\s*(px)?\s*\)/.exec(s);
  return m ? { blur: parseFloat(m[1]) } : null;
}
