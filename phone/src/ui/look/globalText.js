/**
 * THE PACKED APP'S RULES FOR EVERY WORD, in one place (phone/tools/look/GLOBAL-RULES.md).
 *
 * The packed app is a web page: three style sheets (components/star/ui/flat.css,
 * glassLook.css, pitchLook.css) and the browser's own defaults restyle EVERY word
 * on every screen. `src/rn.js` runs each <Text>'s style through `globalTextStyle`
 * here, so a screen gets the same look without setting it word by word:
 *
 *  1. LINE BOX. A word with no lineHeight sits on a line 1.5 times its size (the
 *     website's body line height; `text-[10px]` = a 15 px line). A style's own
 *     lineHeight always wins. Signs and emoji on their own are left alone.
 *  2. ANTON. Bold (700 or more) words of 16 px or more are drawn in Anton at its
 *     one weight (flat.css rule 1); 800/900 ones under 40 px get 0.012em spacing.
 *     A style that names a fontFamily is left alone (`FONT.sans` keeps the body font).
 *  3. SOFT SHADOW. White (any strength), amber and yellow words get the shadow
 *     0 1px 2px black 55 % (glassLook.css rule 3). A style with its own shadow is
 *     left alone (`NO_SHADOW` switches it off).
 *
 * Plain JavaScript with no imports, so rn.js can load it and a tool can test it.
 */
const ANTON = "Anton";
/** The body font, by name: a style that sets it is never turned into Anton. */
const SANS = "System";
const LINE = 1.5;
const SHADOW = { textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 };

function weightOf(w) {
  if (w == null) return 400;
  if (w === "bold") return 700;
  if (w === "normal") return 400;
  const n = parseInt(w, 10);
  return Number.isFinite(n) ? n : 400;
}

const NAMED = { white: [255, 255, 255, 1], yellow: [255, 255, 0, 1], gold: [255, 215, 0, 1], orange: [255, 165, 0, 1] };
const colourCache = new Map();
/** "#fff", "#ffffffcc", "rgb(…)", "rgba(…)", "white" → [r, g, b, a]; null when not understood. */
function parseColour(c) {
  if (typeof c !== "string") return null;
  if (colourCache.has(c)) return colourCache.get(c);
  let out = null;
  const s = c.trim().toLowerCase();
  if (s[0] === "#") {
    const h = s.slice(1);
    const full = h.length <= 4 ? h.split("").map((x) => x + x).join("") : h;
    if (full.length === 6 || full.length === 8) {
      const n = parseInt(full.slice(0, 6), 16);
      if (Number.isFinite(n)) out = [(n >> 16) & 255, (n >> 8) & 255, n & 255, full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1];
    }
  } else if (s.startsWith("rgb")) {
    const m = s.match(/[\d.]+%?/g);
    if (m && m.length >= 3) out = [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2]), m.length > 3 ? (m[3].endsWith("%") ? parseFloat(m[3]) / 100 : parseFloat(m[3])) : 1];
  } else if (NAMED[s]) out = NAMED[s];
  colourCache.set(c, out);
  return out;
}

// Tailwind's amber-600/700 and yellow-700: their hue is orange's, so they are named.
const DARK_AMBER = new Set(["217,119,6", "180,83,9", "161,98,7", "146,64,14"]);
/** White of any strength, or an amber / yellow (Tailwind's text-white, text-white/NN, text-amber-*, text-yellow-*). */
function isLightInk(c) {
  const v = parseColour(c);
  if (!v || v[3] <= 0.02) return false;
  const [r, g, b] = v;
  if (r >= 254 && g >= 254 && b >= 254) return true;
  if (DARK_AMBER.has(`${r},${g},${b}`)) return true;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min || max < 150) return false;
  const l = (max + min) / 510;
  const sat = (max - min) / 255 / (1 - Math.abs(2 * l - 1));
  let hue = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  return hue >= 34 && hue <= 58 && sat >= 0.7;
}

/** True for a string that is only signs or emoji (★, ▾, 🏆, ⚙): its line box is left to the font. */
function onlySigns(children) {
  let s = "";
  if (typeof children === "string") s = children;
  else if (Array.isArray(children) && children.every((c) => typeof c === "string")) s = children.join("");
  else return false;
  return s.length > 0 && s.length <= 8 && !/[A-Za-z0-9]/.test(s);
}

/**
 * What the packed app's global rules add to one Text.
 *   flat      the Text's own flattened style
 *   parent    { fontSize, anton } of the Text this one is inside (a nested Text), or null
 *   children  the Text's children (to tell a lone sign from words)
 * Returns { add, fontSize, anton }: `add` is a style to put AFTER the Text's own (or null).
 */
function globalTextStyle(flat, parent, children) {
  const f = flat || {};
  const nested = !!parent;
  const size = typeof f.fontSize === "number" ? f.fontSize : nested ? parent.fontSize : 14;
  const weight = weightOf(f.fontWeight);
  let add = null;
  let anton = nested ? parent.anton : false;
  if (f.fontFamily) anton = f.fontFamily === ANTON;
  else if (weight >= 700 && size >= 16 && (f.fontWeight != null || !nested)) {
    anton = true;
    add = { fontFamily: ANTON, fontWeight: "400" };
    if (weight >= 800 && size < 40 && f.letterSpacing == null) add.letterSpacing = +(size * 0.012).toFixed(3);
  }
  if (!nested && f.lineHeight == null && !onlySigns(children)) (add || (add = {})).lineHeight = +(size * LINE).toFixed(2);
  if (f.textShadowColor == null && f.textShadowRadius == null && f.textShadowOffset == null && f.textShadow == null && isLightInk(f.color)) add = Object.assign(add || {}, SHADOW);
  return { add, fontSize: size, anton };
}

module.exports = { globalTextStyle, isLightInk, parseColour, onlySigns, ANTON, SANS, LINE, SHADOW };
